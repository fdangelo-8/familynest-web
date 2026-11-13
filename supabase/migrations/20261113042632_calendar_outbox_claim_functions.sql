-- Issue #373: the synchronisation service claims the rows of calendar_outbox before sending
-- them. Two runs started together (the job every 15 minutes, a manual run, a late run) never
-- take the same row, so the provider never receives the same «create» twice.
--
-- - claim_calendar_outbox_items() (new): takes at most p_limit due rows that nobody holds,
--   with `for update skip locked`, and holds them for 5 minutes (claimed_until). A run that
--   dies leaves them held until then; afterwards they are due again by themselves.
-- - complete_calendar_outbox_item() (same signature, same result): the event changed while
--   its row was being sent (changed_while_claimed): the row is kept as an «update» with the
--   id at the provider, free and due now, so that the latest values are sent too. Otherwise
--   as before: the row is removed.
-- - fail_calendar_outbox_item() (same signature): also frees the row.
-- - private.queue_sent_event_update() (same signature): the event changed while a run holds
--   its row: the row is marked changed_while_claimed (the insert of the «update» does
--   nothing when a row of the event is already waiting, and a pending «create» has no link
--   yet, so without the mark the change would be lost).
--
-- How the service uses it: claim, send, then complete or fail every claimed row. The rows
-- are never read with a plain select to be sent.
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
-- - the oldest due first; rows locked by another run at this instant are skipped, never
--   waited for.
-- Returns the claimed rows (no text of the events: the service reads the event).
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
  attempts integer
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
        changed_while_claimed = false
    from due d
    where o.id = d.id
    returning o.id, o.action, o.calendar_id, o.event_id, o.provider_event_id, o.attempts;
end;
$$;

-- ---------------------------------------------------------------------------
-- A change of the outbox was done at the provider:
-- - create: the event of FamilyNest is now linked to p_provider_event_id (required);
-- - update: the new version is kept;
-- - delete: nothing to keep.
-- The row is then removed, unless the event changed while the row was being sent
-- (changed_while_claimed): then the row stays as an «update» of the copy at the provider,
-- free, due now and with no failed attempt, so that the latest values are sent too.
-- Returns false when the row is gone (the user switched «Anche su» off, the event or the
-- calendar went meanwhile): the service then deletes at the provider the copy it has just
-- created.
-- ---------------------------------------------------------------------------
create or replace function public.complete_calendar_outbox_item(
  p_id uuid,
  p_provider_event_id text default null,
  p_provider_version text default null
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
        changed_while_claimed = false
    where o.id = v_item.id;

    return true;
  end if;

  delete from public.calendar_outbox o
  where o.id = v_item.id;

  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- A change of the outbox could not be done (the provider did not answer): tried again from
-- p_retry_at, by any run (the row is free again). The save in FamilyNest stays valid
-- (#34 §16).
-- ---------------------------------------------------------------------------
create or replace function public.fail_calendar_outbox_item(p_id uuid, p_retry_at timestamptz)
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
      changed_while_claimed = false
  where o.id = p_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- An event sent with «Anche su» changes title, place, times or repetition (also of one
-- occurrence): one «update» for the synchronisation service, unless one is already
-- pending (or the creation is still pending: it reads the latest values). When a run is
-- sending the row of the event right now (claimed), the row is marked: the run may have
-- read the old values, and complete_calendar_outbox_item() then keeps an «update».
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
  set changed_while_claimed = true
  where o.event_id = p_event_id
    and o.claimed_until is not null
    and not o.changed_while_claimed;

  insert into public.calendar_outbox (household_id, calendar_id, action, event_id, provider_event_id)
  select l.household_id, l.calendar_id, 'update', l.event_id, l.provider_event_id
  from public.event_external_links l
  where l.event_id = p_event_id
    and l.origin = 'sent'
  on conflict (event_id) where event_id is not null do nothing;
$$;
