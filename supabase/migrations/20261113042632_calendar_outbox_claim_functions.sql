-- Issue #373: the synchronisation service claims the rows of calendar_outbox before sending
-- them. Two runs started together (the job every 15 minutes, a manual run, a late run) never
-- take the same row, so the provider never receives the same «create» twice.
--
-- - claim_calendar_outbox_items() (new): takes at most p_limit due rows that nobody holds,
--   with `for update skip locked`, and holds them for 5 minutes (claimed_until) under a new
--   claim token. A run that dies leaves them held until then; afterwards they are due again
--   by themselves.
-- - complete_calendar_outbox_item() (new optional argument p_claim_token, same result): the
--   event changed while its row was held (changed_while_claimed): the row is kept as an
--   «update» with the id at the provider, free and due now, so that the latest values are
--   sent too. Otherwise as before: the row is removed. Returns false, changing nothing, when
--   the token no longer matches or when a «create» is completed on a row that is no longer a
--   «create».
-- - fail_calendar_outbox_item() (new optional argument p_claim_token): also frees the row;
--   changes nothing when the token no longer matches.
-- - private.queue_sent_event_update() (same signature): always locks the rows of the event,
--   and marks changed_while_claimed the ones held by a run (the insert of the «update» does
--   nothing when a row of the event is already waiting, and a pending «create» has no link
--   yet, so without the mark the change would be lost).
--
-- How the service uses it: claim, send, then complete or fail every claimed row with its
-- claim token. The rows are never read with a plain select to be sent. Without a token
-- (the code before #373) complete and fail work as before.
--
-- complete and fail get a new argument: they are dropped and created again (a second
-- function with the same name would make the calls with three arguments ambiguous). Their
-- grants are given again in the grants migration; until then the default privileges of the
-- schema would let the API roles execute the new functions, so every function created here
-- is revoked from public, anon and authenticated at once.
--
-- Every function is `security definer` (owner: postgres, `set search_path = ''`): the API
-- roles have no privilege on the outbox. The public ones are executable only by service_role
-- and the database owner (grants migration). Only POST through the Data API (lesson of #112).
--
-- Errors of claim_calendar_outbox_items():
-- - P0001 'use POST': called through the Data API with a method other than POST;
-- - 22023: invalid arguments (limit missing or not between 1 and 50, is_fake missing, an
--   instant missing or not finite).

-- ---------------------------------------------------------------------------
-- The rows to send now, held by the caller for 5 minutes:
-- - due: next_attempt_at not after p_at;
-- - free: never claimed, or the claim has expired (claimed_until not after now(), the real
--   time of the database, never p_at: a test run with an instant in the future cannot take
--   the rows of a real run);
-- - of the accounts of the fake provider when p_is_fake (development and tests), of the real
--   ones otherwise (the same rule as the service, #34 §11);
-- - when p_user_id is given: only of the accounts of the adult with that Supabase Auth id
--   (the fake service of the tests, #364); null: every adult (the scheduled job);
-- - the oldest due first; rows locked by another run at this instant (or by a change of the
--   event not yet committed) are skipped, never waited for.
-- Taking back a row whose claim has expired keeps its mark changed_while_claimed: the run
-- that held it may still complete it with old values, and the mark makes that completion
-- keep an «update». A free row has no mark (constraint), so it starts unmarked.
-- Returns the claimed rows with the claim token (the same for every row of this call), to
-- be passed to complete_calendar_outbox_item() and fail_calendar_outbox_item(). No text of
-- the events: the service reads the event. event_id is null for a «delete» (the event is
-- gone); provider_event_id is null for a «create» (no copy yet). The generated types say
-- string for both.
-- ---------------------------------------------------------------------------
create or replace function public.claim_calendar_outbox_items(
  p_limit integer,
  p_is_fake boolean,
  p_user_id uuid default null,
  p_at timestamptz default now()
)
returns table (
  id uuid,
  action public.calendar_outbox_action,
  calendar_id uuid,
  event_id uuid,
  provider_event_id text,
  attempts integer,
  claim_token uuid
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  c_max_items constant integer := 50;
  c_claim constant interval := interval '5 minutes';
  v_token uuid := gen_random_uuid();
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  if p_limit is null or p_limit not between 1 and c_max_items
     or p_is_fake is null
     or p_at is null or not isfinite(p_at) then
    raise exception 'invalid claim' using errcode = '22023';
  end if;

  return query
    with due as (
      select o.id
      from public.calendar_outbox o
      join public.external_calendars c on c.id = o.calendar_id
      join public.calendar_accounts a on a.id = c.account_id
      where o.next_attempt_at <= p_at
        and (o.claimed_until is null or o.claimed_until <= now())
        and a.is_fake = p_is_fake
        and (
          p_user_id is null
          or exists (
            select 1
            from public.household_members m
            where m.id = a.member_id
              and m.user_id = p_user_id
              and m.kind = 'adult'
          )
        )
      order by o.next_attempt_at, o.id
      limit p_limit
      for update of o skip locked
    )
    update public.calendar_outbox o
    set claimed_until = now() + c_claim,
        claim_token = v_token,
        changed_while_claimed = (o.claimed_until is not null and o.changed_while_claimed)
    from due d
    where o.id = d.id
    returning o.id, o.action, o.calendar_id, o.event_id, o.provider_event_id, o.attempts,
              o.claim_token;
end;
$$;

revoke execute on function public.claim_calendar_outbox_items(integer, boolean, uuid, timestamptz)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- A change of the outbox was done at the provider:
-- - create: the event of FamilyNest is now linked to p_provider_event_id (required);
-- - update: the new version is kept;
-- - delete: nothing to keep.
-- The row is then removed, unless the event changed while the row was held
-- (changed_while_claimed): then the row stays as an «update» of the copy at the provider,
-- free, due now and with no failed attempt, so that the latest values are sent too.
-- Returns false, and changes nothing, when:
-- - the row is gone (the user switched «Anche su» off, the event or the calendar went
--   meanwhile, or the row was already completed);
-- - p_claim_token is given and the row is no longer held with it (the claim expired and
--   another run took the row, or this run already completed or failed it);
-- - p_provider_event_id is given (the result of a «create») and the row is no longer a
--   «create»: a first completion already linked a copy and kept an «update».
-- After a false for a «create» the service deletes at the provider the copy it has just
-- created, unless the event is linked to that very copy (a first completion whose answer
-- got lost). After a false for an «update» or a «delete» there is nothing to do: another
-- run holds the row, or it is gone.
-- ---------------------------------------------------------------------------
drop function if exists public.complete_calendar_outbox_item(uuid, text, text);

create function public.complete_calendar_outbox_item(
  p_id uuid,
  p_provider_event_id text default null,
  p_provider_version text default null,
  p_claim_token uuid default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_item public.calendar_outbox;
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  if p_id is null
     or (p_provider_event_id is not null and char_length(p_provider_event_id) not between 1 and 1024)
     or (p_provider_version is not null and char_length(p_provider_version) > 1024) then
    raise exception 'invalid outbox result' using errcode = '22023';
  end if;

  select o.* into v_item
  from public.calendar_outbox o
  where o.id = p_id
  for update;

  if not found then
    return false;
  end if;

  if p_claim_token is not null and v_item.claim_token is distinct from p_claim_token then
    return false;
  end if;

  if p_provider_event_id is not null and v_item.action <> 'create' then
    return false;
  end if;

  if v_item.action = 'create' then
    if p_provider_event_id is null then
      raise exception 'invalid outbox result' using errcode = '22023';
    end if;
    insert into public.event_external_links (
      household_id, event_id, calendar_id, origin, provider_event_id, provider_version
    )
    values (
      v_item.household_id, v_item.event_id, v_item.calendar_id, 'sent', p_provider_event_id,
      nullif(p_provider_version, '')
    )
    on conflict do nothing;
  elsif v_item.action = 'update' then
    update public.event_external_links l
    set provider_version = nullif(p_provider_version, '')
    where l.event_id = v_item.event_id
      and l.origin = 'sent';
  end if;

  if v_item.changed_while_claimed and v_item.event_id is not null then
    update public.calendar_outbox o
    set action = 'update',
        provider_event_id = coalesce(
          (
            select l.provider_event_id
            from public.event_external_links l
            where l.event_id = v_item.event_id
              and l.calendar_id = v_item.calendar_id
              and l.origin = 'sent'
            limit 1
          ),
          v_item.provider_event_id,
          p_provider_event_id
        ),
        attempts = 0,
        next_attempt_at = now(),
        claimed_until = null,
        claim_token = null,
        changed_while_claimed = false
    where o.id = v_item.id;

    return true;
  end if;

  delete from public.calendar_outbox o
  where o.id = v_item.id;

  return true;
end;
$$;

revoke execute on function public.complete_calendar_outbox_item(uuid, text, text, uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- A change of the outbox could not be done (the provider did not answer): tried again from
-- p_retry_at, by any run (the row is free again). The save in FamilyNest stays valid
-- (#34 §16). With p_claim_token: nothing changes when the row is no longer held with it
-- (another run took it after the claim expired: its claim stays).
-- ---------------------------------------------------------------------------
drop function if exists public.fail_calendar_outbox_item(uuid, timestamptz);

create function public.fail_calendar_outbox_item(
  p_id uuid,
  p_retry_at timestamptz,
  p_claim_token uuid default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  if p_id is null or p_retry_at is null or not isfinite(p_retry_at) then
    raise exception 'invalid outbox result' using errcode = '22023';
  end if;

  update public.calendar_outbox o
  set attempts = o.attempts + 1,
      next_attempt_at = p_retry_at,
      claimed_until = null,
      claim_token = null,
      changed_while_claimed = false
  where o.id = p_id
    and (p_claim_token is null or o.claim_token = p_claim_token);
end;
$$;

revoke execute on function public.fail_calendar_outbox_item(uuid, timestamptz, uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- An event sent with «Anche su» changes title, place, times or repetition (also of one
-- occurrence): one «update» for the synchronisation service, unless one is already
-- pending (or the creation is still pending: it reads the latest values).
-- Every row of the event is updated, held or free, so that it is always locked until the
-- change of the user is committed: claim_calendar_outbox_items() skips a locked row and
-- takes it at a later run, which reads the new values. Were only the held rows touched, a
-- free row could be claimed and sent with the old values (the change is not committed
-- yet) and then removed by complete_calendar_outbox_item(), losing the change.
-- The mark itself goes only on the rows held by a run, which may have read the old values
-- (the expression is evaluated on the latest version of the row, also after waiting for a
-- claim that has just been committed); a free row needs no mark, as its next run reads the
-- latest values.
-- Security definer: the outbox is not writable by the app.
-- ---------------------------------------------------------------------------
create or replace function private.queue_sent_event_update(p_event_id uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.calendar_outbox o
  set changed_while_claimed = (o.changed_while_claimed or o.claimed_until is not null)
  where o.event_id = p_event_id;

  insert into public.calendar_outbox (household_id, calendar_id, action, event_id, provider_event_id)
  select l.household_id, l.calendar_id, 'update', l.event_id, l.provider_event_id
  from public.event_external_links l
  where l.event_id = p_event_id
    and l.origin = 'sent'
  on conflict (event_id) where event_id is not null do nothing;
$$;
