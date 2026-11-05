-- Issue #266 (for #34 Calendari collegati, decision F1 = B): the functions of the
-- synchronisation service. The service runs inside Supabase with the administrative key
-- (service_role): it talks to the providers (Google, Outlook, the fake provider), encrypts
-- and decrypts the credentials with a key that never enters the database, and writes here
-- only through these functions, which hold the rules of the data in one place:
-- - save_calendar_account():         after the consent at the provider, the account (or the
--                                    same account linked again, «Ricollega»);
-- - save_external_calendars():       the calendars of an account, with the choices of a
--                                    new calendar (#34 §6);
-- - sync_external_calendar_events(): the events of one calendar, with the rules of #34 §7
--                                    (window, texts, «tutto il giorno», private, free,
--                                    declined, cancelled, «Solo giorni feriali», no
--                                    duplicates, at most 2,000);
-- - record_calendar_sync_result():   how the synchronisation of an account went;
-- - mark_external_calendar_failing(): one calendar alone does not synchronise;
-- - complete_calendar_outbox_item(), fail_calendar_outbox_item(): what happened to a change
--   sent with «Anche su».
-- The revocation queue and the outbox are read and emptied by the service directly (its
-- role reads the tables; the API roles never do).
--
-- Every function is `security definer` (owner: postgres, with `set search_path = ''`)
-- because it uses the private helpers, and is executable only by service_role and the
-- database owner, never by authenticated or anon (grants migration). Only POST through the
-- Data API (lesson of #112). Nothing here trusts the session: the adult is always found
-- from the id of the account at Supabase Auth, and every row written belongs to that adult.
--
-- Errors:
-- - P0001 'use POST': called through the Data API with a method other than POST;
-- - 22023: invalid arguments (missing values, a list that is not an array of objects, too
--   many items, an id too long, an event without start);
-- - P0002: unknown adult (no adult with that account in a household), account, calendar;
-- - FN008 / FN009: the limits of 5 accounts per adult and 50 calendars per account.

-- ---------------------------------------------------------------------------
-- Texts that arrive from a provider, with the rules of the columns of events (#34 §7):
-- inner whitespace runs become one space, no leading or trailing whitespace; longer than
-- 100 characters: the first 99 (without trailing space) and «…»; empty: p_fallback.
-- ---------------------------------------------------------------------------
create or replace function private.external_text(p_text text, p_fallback text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_text text := btrim(regexp_replace(coalesce(p_text, ''), '\s+', ' ', 'g'));
begin
  if v_text = '' then
    return p_fallback;
  end if;
  if char_length(v_text) > 100 then
    return btrim(left(v_text, 99)) || '…';
  end if;
  return v_text;
end;
$$;

-- ---------------------------------------------------------------------------
-- After the consent at the provider: the account of the adult whose Supabase Auth id is
-- p_user_id. The same account at the provider (same provider and provider_account_id)
-- linked again by the same adult updates its row: new email and credentials, state
-- «active», no account twice (#34 §8 «Ricollega»). The old credentials are not queued for
-- revocation: at Google, revoking them could also revoke the new ones of the same consent.
-- Otherwise a new account (at most 5 per adult: FN008). Returns its id and whether it is new.
-- ---------------------------------------------------------------------------
create or replace function public.save_calendar_account(
  p_user_id uuid,
  p_provider public.calendar_provider,
  p_provider_account_id text,
  p_email text,
  p_credentials_ciphertext text,
  p_is_fake boolean default false
)
returns table (account_id uuid, is_new boolean)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_member public.household_members;
  v_id uuid;
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  if p_user_id is null or p_provider is null or p_provider_account_id is null or p_email is null
     or p_credentials_ciphertext is null or p_is_fake is null then
    raise exception 'invalid account' using errcode = '22023';
  end if;

  select m.* into v_member
  from public.household_members m
  where m.user_id = p_user_id
    and m.kind = 'adult';

  if not found then
    raise exception 'member not found' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('public.calendar_accounts:' || v_member.id::text, 0));

  update public.calendar_accounts a
  set email = p_email,
      credentials_ciphertext = p_credentials_ciphertext,
      is_fake = p_is_fake,
      status = 'active',
      failing_since = null
  where a.member_id = v_member.id
    and a.provider = p_provider
    and a.provider_account_id = p_provider_account_id
  returning a.id into v_id;

  if found then
    return query select v_id, false;
    return;
  end if;

  insert into public.calendar_accounts (
    household_id, member_id, provider, provider_account_id, email, credentials_ciphertext, is_fake
  )
  values (
    v_member.household_id, v_member.id, p_provider, p_provider_account_id, p_email,
    p_credentials_ciphertext, p_is_fake
  )
  returning id into v_id;

  return query select v_id, true;
end;
$$;

-- ---------------------------------------------------------------------------
-- The calendars of an account, as the provider lists them now. p_calendars is a JSON array
-- of objects {"id": text, "name": text, "is_primary": boolean, "is_read_only": boolean}
-- (calendars the user sees only as free/busy are not sent by the service, #34 §10).
-- - at most 50 are kept: the main ones, then in alphabetical order (#34 §7);
-- - a calendar already known keeps its choices; its name, main and read-only flags follow
--   the provider (a calendar that becomes read only becomes «Solo in entrata»);
-- - a new calendar starts with the choices of #34 §6: switched on only when it is the main
--   one, «Entrata e uscita» when writable, «Occupato» (F5), counts for «Liberi insieme»,
--   all days;
-- - a calendar no longer listed is deleted, with the events imported from it.
-- Returns how many calendars the account has now.
-- ---------------------------------------------------------------------------
create or replace function public.save_external_calendars(p_account_id uuid, p_calendars jsonb)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c_max_calendars constant integer := 50;
  v_account public.calendar_accounts;
  v_input jsonb;
  v_count integer;
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  if p_account_id is null or p_calendars is null or jsonb_typeof(p_calendars) <> 'array'
     or jsonb_array_length(p_calendars) > 1000
     or exists (
       select 1
       from jsonb_array_elements(p_calendars) as c (value)
       where jsonb_typeof(c.value) <> 'object'
          or jsonb_typeof(c.value -> 'id') is distinct from 'string'
          or char_length(c.value ->> 'id') not between 1 and 1024
          or (c.value ? 'name' and jsonb_typeof(c.value -> 'name') not in ('string', 'null'))
          or (c.value ? 'is_primary' and jsonb_typeof(c.value -> 'is_primary') not in ('boolean', 'null'))
          or (c.value ? 'is_read_only' and jsonb_typeof(c.value -> 'is_read_only') not in ('boolean', 'null'))
     ) then
    raise exception 'invalid calendars' using errcode = '22023';
  end if;

  select a.* into v_account
  from public.calendar_accounts a
  where a.id = p_account_id
  for update;

  if not found then
    raise exception 'account not found' using errcode = 'P0002';
  end if;

  -- The calendars to keep, normalised (one per id, at most 50).
  select coalesce(jsonb_agg(to_jsonb(k) order by k.is_primary desc, lower(k.name), k.name, k.provider_calendar_id), '[]'::jsonb)
  into v_input
  from (
    select
      i.provider_calendar_id,
      i.name,
      i.is_primary,
      i.is_read_only
    from (
      select distinct on (c.id)
        c.id as provider_calendar_id,
        private.external_text(c.name, 'Senza nome') as name,
        coalesce(c.is_primary, false) as is_primary,
        coalesce(c.is_read_only, false) as is_read_only
      from jsonb_to_recordset(p_calendars) as c (id text, name text, is_primary boolean, is_read_only boolean)
      order by c.id, coalesce(c.is_primary, false) desc
    ) i
    order by i.is_primary desc, lower(i.name), i.name, i.provider_calendar_id
    limit c_max_calendars
  ) k;

  -- Gone at the provider (or beyond the limit): the calendar and its imported events go.
  delete from public.external_calendars c
  where c.account_id = v_account.id
    and not exists (
      select 1
      from jsonb_to_recordset(v_input) as i (provider_calendar_id text, name text, is_primary boolean, is_read_only boolean)
      where i.provider_calendar_id = c.provider_calendar_id
    );

  update public.external_calendars c
  set name = i.name,
      is_primary = i.is_primary,
      is_read_only = i.is_read_only
  from jsonb_to_recordset(v_input) as i (provider_calendar_id text, name text, is_primary boolean, is_read_only boolean)
  where c.account_id = v_account.id
    and c.provider_calendar_id = i.provider_calendar_id
    and (c.name, c.is_primary, c.is_read_only) is distinct from (i.name, i.is_primary, i.is_read_only);

  insert into public.external_calendars (
    household_id, member_id, account_id, provider_calendar_id, name, is_primary, is_read_only, is_enabled
  )
  select
    v_account.household_id, v_account.member_id, v_account.id, i.provider_calendar_id, i.name,
    i.is_primary, i.is_read_only, i.is_primary
  from jsonb_to_recordset(v_input) as i (provider_calendar_id text, name text, is_primary boolean, is_read_only boolean)
  where not exists (
    select 1
    from public.external_calendars c
    where c.account_id = v_account.id
      and c.provider_calendar_id = i.provider_calendar_id
  )
  order by i.is_primary desc, lower(i.name), i.name, i.provider_calendar_id;

  select count(*)::integer into v_count
  from public.external_calendars c
  where c.account_id = v_account.id;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- The events of one calendar (#34 §7). p_events is a JSON array of objects, one per event
-- of the provider (every occurrence of a repeated event is its own object, with the id of
-- the series and its own occurrence_key):
--   id              text, required: id of the event at the provider (the series for a
--                   repeated one);
--   occurrence_key  text: which occurrence ('' or absent for a single event), at most 200;
--   version         text: etag or change key;
--   title, location text;
--   starts_at, ends_at  timestamptz (events with a time);
--   all_day         boolean; then start_date and end_date (date, end excluded, as the
--                   providers send them);
--   status          'confirmed', 'tentative' or 'cancelled';
--   declined        boolean: the user declined the invitation;
--   is_private      boolean: marked private at the provider;
--   is_free         boolean: marked free at the provider;
--   deleted         boolean: the event is gone (incremental synchronisation).
-- Only these fields are read: descriptions, participants, organiser, attachments, links,
-- reminders and colours are never stored, even when sent.
-- p_full: true when p_events is the complete list of the window (every imported event of
-- the calendar not in it is deleted); false for the changes since p_cursor.
-- Rules:
-- - a calendar switched off: nothing is written (the user switched it off meanwhile);
-- - window: events that ended at most 30 days before p_at and start less than 12 months
--   after it; the older ones are deleted;
-- - cancelled, declined, deleted: not imported, and deleted if they were;
-- - «Solo giorni feriali»: events (and days of an event «tutto il giorno») starting on
--   Saturday or Sunday (Europe/Rome) are not imported, and deleted if they were;
-- - «tutto il giorno»: one event from 0:00 to 24:00 (Europe/Rome) of each of its days in
--   the window; never counts for «Liberi insieme»;
-- - free at the provider: never counts for «Liberi insieme»;
-- - title and place: external_text() (title «Senza titolo» when empty, no place when
--   empty); an end not after the start: 15 minutes;
-- - owner: the adult of the calendar, without participants nor escort; visibility of the
--   calendar, at most «Occupato» when private at the provider; an event whose visibility
--   the author changed keeps it (still at most «Occupato» when private at the provider);
-- - no duplicates: an event sent from FamilyNest with «Anche su» and found again here stays
--   one (the event of FamilyNest); the same event of the provider is one event here;
-- - at most 2,000 imported events per calendar: the nearest to p_at.
-- Changes made here never notify anybody (no session). Returns how many events were
-- imported for the first time and how many were deleted.
-- ---------------------------------------------------------------------------
create or replace function public.sync_external_calendar_events(
  p_calendar_id uuid,
  p_events jsonb,
  p_full boolean,
  p_cursor text default null,
  p_at timestamptz default now()
)
returns table (imported_count integer, deleted_count integer)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  c_max_events constant integer := 2000;
  c_max_items constant integer := 10000;
  v_calendar public.external_calendars;
  v_from timestamptz;
  v_to timestamptz;
  v_item record;
  v_key text;
  v_keep text[];
  v_touched uuid[] := array[]::uuid[];
  v_day date;
  v_last_day date;
  v_start timestamptz;
  v_end timestamptz;
  v_title text;
  v_location text;
  v_link public.event_external_links;
  v_visibility public.event_visibility;
  v_event_id uuid;
  v_link_id uuid;
  v_imported integer := 0;
  v_deleted integer := 0;
  v_rows integer;
  v_rows_to_write jsonb;
  v_row record;
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  if p_calendar_id is null or p_full is null or p_at is null or not isfinite(p_at)
     or p_events is null or jsonb_typeof(p_events) <> 'array'
     or jsonb_array_length(p_events) > c_max_items
     or (p_cursor is not null and char_length(p_cursor) > 8192)
     or exists (
       select 1
       from jsonb_array_elements(p_events) as i (value)
       where jsonb_typeof(i.value) <> 'object'
          or jsonb_typeof(i.value -> 'id') is distinct from 'string'
          or char_length(i.value ->> 'id') not between 1 and 1024
          or char_length(coalesce(i.value ->> 'occurrence_key', '')) > 200
          or char_length(coalesce(i.value ->> 'version', '')) > 1024
     ) then
    raise exception 'invalid events' using errcode = '22023';
  end if;

  select c.* into v_calendar
  from public.external_calendars c
  where c.id = p_calendar_id
  for update;

  if not found then
    raise exception 'calendar not found' using errcode = 'P0002';
  end if;

  if not v_calendar.is_enabled then
    return query select 0, 0;
    return;
  end if;

  v_from := p_at - interval '30 days';
  v_to := p_at + interval '12 months';

  for v_item in
    select
      i.id,
      coalesce(i.occurrence_key, '') as occurrence_key,
      nullif(i.version, '') as version,
      i.title,
      i.location,
      i.starts_at,
      i.ends_at,
      coalesce(i.all_day, false) as all_day,
      i.start_date,
      i.end_date,
      coalesce(i.status, 'confirmed') as status,
      coalesce(i.declined, false) as declined,
      coalesce(i.is_private, false) as is_private,
      coalesce(i.is_free, false) as is_free,
      coalesce(i.deleted, false) as deleted
    from jsonb_to_recordset(p_events) as i (
      id text, occurrence_key text, version text, title text, location text,
      starts_at timestamptz, ends_at timestamptz, all_day boolean, start_date date, end_date date,
      status text, declined boolean, is_private boolean, is_free boolean, deleted boolean
    )
  loop
    v_key := v_item.occurrence_key;

    -- An event sent from FamilyNest with «Anche su», found again: it stays one (#34 §7).
    continue when exists (
      select 1
      from public.event_external_links l
      where l.calendar_id = v_calendar.id
        and l.origin = 'sent'
        and l.provider_event_id = v_item.id
    );

    -- The events of FamilyNest this item gives: occurrence key, start, end.
    v_rows_to_write := '[]'::jsonb;
    if not v_item.deleted and v_item.status <> 'cancelled' and not v_item.declined then
      if v_item.all_day then
        if v_item.start_date is null then
          raise exception 'invalid events' using errcode = '22023';
        end if;
        v_last_day := coalesce(v_item.end_date, v_item.start_date + 1) - 1;
        if v_last_day < v_item.start_date then
          v_last_day := v_item.start_date;
        end if;
        for v_day in
          select d::date
          from generate_series(
            greatest(v_item.start_date, (v_from at time zone 'Europe/Rome')::date - 1)::timestamp,
            least(v_last_day, (v_to at time zone 'Europe/Rome')::date)::timestamp,
            interval '1 day'
          ) as d
        loop
          v_start := v_day::timestamp at time zone 'Europe/Rome';
          v_end := (v_day + 1)::timestamp at time zone 'Europe/Rome';
          continue when v_end <= v_from or v_start >= v_to;
          continue when v_calendar.weekdays_only and extract(isodow from v_day) in (6, 7);
          v_rows_to_write := v_rows_to_write || jsonb_build_array(jsonb_build_object(
            'key', v_key || '#' || to_char(v_day, 'YYYY-MM-DD'),
            'starts_at', v_start,
            'ends_at', v_end,
            'busy', false
          ));
        end loop;
      else
        if v_item.starts_at is null or not isfinite(v_item.starts_at)
           or (v_item.ends_at is not null and not isfinite(v_item.ends_at)) then
          raise exception 'invalid events' using errcode = '22023';
        end if;
        v_start := v_item.starts_at;
        v_end := v_item.ends_at;
        if v_end is null or v_end <= v_start then
          v_end := v_start + interval '15 minutes';
        end if;
        if v_end > v_from and v_start < v_to
           and not (
             v_calendar.weekdays_only
             and extract(isodow from (v_start at time zone 'Europe/Rome')) in (6, 7)
           ) then
          v_rows_to_write := jsonb_build_array(jsonb_build_object(
            'key', v_key,
            'starts_at', v_start,
            'ends_at', v_end,
            'busy', not v_item.is_free
          ));
        end if;
      end if;
    end if;

    v_title := private.external_text(v_item.title, 'Senza titolo');
    v_location := private.external_text(v_item.location, null);
    v_keep := array[]::text[];

    for v_row in
      select
        r.key,
        r.starts_at,
        r.ends_at,
        r.busy
      from jsonb_to_recordset(v_rows_to_write) as r (key text, starts_at timestamptz, ends_at timestamptz, busy boolean)
    loop
      v_keep := v_keep || v_row.key;
      v_visibility := private.imported_event_visibility(v_calendar.visibility, v_item.is_private);

      select l.* into v_link
      from public.event_external_links l
      where l.calendar_id = v_calendar.id
        and l.provider_event_id = v_item.id
        and l.occurrence_key = v_row.key;

      if found then
        update public.events e
        set title = v_title,
            location = v_location,
            starts_at = v_row.starts_at,
            ends_at = v_row.ends_at,
            visibility = case
              when v_link.visibility_overridden then private.imported_event_visibility(e.visibility, v_item.is_private)
              else v_visibility
            end
        where e.id = v_link.event_id
          and (e.title, e.location, e.starts_at, e.ends_at, e.visibility) is distinct from (
            v_title, v_location, v_row.starts_at, v_row.ends_at,
            case
              when v_link.visibility_overridden then private.imported_event_visibility(e.visibility, v_item.is_private)
              else v_visibility
            end
          );

        update public.event_external_links l
        set provider_version = v_item.version,
            is_private_on_provider = v_item.is_private,
            is_busy_on_provider = v_row.busy
        where l.id = v_link.id
          and (l.provider_version, l.is_private_on_provider, l.is_busy_on_provider)
              is distinct from (v_item.version, v_item.is_private, v_row.busy);

        v_touched := v_touched || v_link.id;
      else
        insert into public.events (
          household_id, author_member_id, title, location, starts_at, ends_at, visibility, recurrence
        )
        values (
          v_calendar.household_id, v_calendar.member_id, v_title, v_location, v_row.starts_at,
          v_row.ends_at, v_visibility, 'none'
        )
        returning id into v_event_id;

        insert into public.event_external_links (
          household_id, event_id, calendar_id, origin, provider_event_id, occurrence_key,
          provider_version, is_private_on_provider, is_busy_on_provider
        )
        values (
          v_calendar.household_id, v_event_id, v_calendar.id, 'imported', v_item.id, v_row.key,
          v_item.version, v_item.is_private, v_row.busy
        )
        returning id into v_link_id;

        v_touched := v_touched || v_link_id;
        v_imported := v_imported + 1;
      end if;
    end loop;

    -- What this event of the provider no longer gives (cancelled, declined, deleted, moved
    -- out of the window or to a weekend, a day less «tutto il giorno»).
    delete from public.events e
    using public.event_external_links l
    where l.calendar_id = v_calendar.id
      and l.origin = 'imported'
      and l.provider_event_id = v_item.id
      and (l.occurrence_key = v_key or left(l.occurrence_key, char_length(v_key) + 1) = v_key || '#')
      and l.occurrence_key <> all (v_keep)
      and e.id = l.event_id;
    get diagnostics v_rows = row_count;
    v_deleted := v_deleted + v_rows;
  end loop;

  -- Complete list: what the provider no longer has.
  if p_full then
    delete from public.events e
    using public.event_external_links l
    where l.calendar_id = v_calendar.id
      and l.origin = 'imported'
      and l.id <> all (v_touched)
      and e.id = l.event_id;
    get diagnostics v_rows = row_count;
    v_deleted := v_deleted + v_rows;
  end if;

  -- Out of the window in the past.
  delete from public.events e
  using public.event_external_links l
  where l.calendar_id = v_calendar.id
    and l.origin = 'imported'
    and e.id = l.event_id
    and e.ends_at <= v_from;
  get diagnostics v_rows = row_count;
  v_deleted := v_deleted + v_rows;

  -- At most 2,000: the nearest to p_at stay.
  delete from public.events e
  where e.id in (
    select x.id
    from public.events x
    join public.event_external_links l on l.event_id = x.id
    where l.calendar_id = v_calendar.id
      and l.origin = 'imported'
    order by abs(extract(epoch from (x.starts_at - p_at))), x.starts_at, x.id
    offset c_max_events
  );
  get diagnostics v_rows = row_count;
  v_deleted := v_deleted + v_rows;

  update public.external_calendars c
  set sync_cursor = p_cursor,
      last_synced_at = p_at,
      failing_since = null
  where c.id = v_calendar.id;

  return query select v_imported, v_deleted;
end;
$$;

-- ---------------------------------------------------------------------------
-- How the synchronisation of an account went (#34 §8):
-- - ok:              state «active», last synchronisation p_at;
-- - auth_error:      the provider refused the credentials: state «reconnect» («Ricollega»);
-- - temporary_error: the provider did not answer or asked to slow down: state
--                    «temporary_error» (unless already «reconnect»), retried in silence.
-- failing_since keeps the first failed attempt («dalle 13:10»).
-- ---------------------------------------------------------------------------
create or replace function public.record_calendar_sync_result(
  p_account_id uuid,
  p_outcome public.calendar_sync_outcome,
  p_at timestamptz default now()
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

  if p_account_id is null or p_outcome is null or p_at is null or not isfinite(p_at) then
    raise exception 'invalid result' using errcode = '22023';
  end if;

  update public.calendar_accounts a
  set status = case p_outcome
        when 'ok' then 'active'::public.calendar_account_status
        when 'auth_error' then 'reconnect'::public.calendar_account_status
        else case when a.status = 'reconnect' then a.status else 'temporary_error'::public.calendar_account_status end
      end,
      failing_since = case
        when p_outcome = 'ok' then null
        else coalesce(a.failing_since, p_at)
      end,
      last_synced_at = case when p_outcome = 'ok' then p_at else a.last_synced_at end
  where a.id = p_account_id;

  if not found then
    raise exception 'account not found' using errcode = 'P0002';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- One calendar alone cannot be read (for example a shared calendar no longer shared): the
-- first failed attempt is kept («Non si sincronizza dalle 13:10»). The next successful
-- synchronisation of the calendar clears it.
-- ---------------------------------------------------------------------------
create or replace function public.mark_external_calendar_failing(
  p_calendar_id uuid,
  p_at timestamptz default now()
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

  if p_calendar_id is null or p_at is null or not isfinite(p_at) then
    raise exception 'invalid calendar' using errcode = '22023';
  end if;

  update public.external_calendars c
  set failing_since = coalesce(c.failing_since, p_at)
  where c.id = p_calendar_id;

  if not found then
    raise exception 'calendar not found' using errcode = 'P0002';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- A change of the outbox was done at the provider:
-- - create: the event of FamilyNest is now linked to p_provider_event_id (required);
-- - update: the new version is kept;
-- - delete: nothing to keep.
-- The row is then removed. Returns false when the row is gone (the user switched «Anche
-- su» off, the event or the calendar went meanwhile): the service then deletes at the
-- provider the copy it has just created.
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

  delete from public.calendar_outbox o
  where o.id = v_item.id;

  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- A change of the outbox could not be done (the provider did not answer): tried again from
-- p_retry_at. The save in FamilyNest stays valid (#34 §16).
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
      next_attempt_at = p_retry_at
  where o.id = p_id;
end;
$$;
