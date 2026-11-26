-- Issue #510 (DB-1 «Impegni 2.0», review of PR #580): the events «tutto il giorno» of a
-- linked calendar are saved with all_day = true.
-- Cause: sync_external_calendar_events() (20261105121818) was written before the column
-- events.all_day (20261125120004): it imports each day of an event «tutto il giorno» from
-- 0:00 to 0:00 (Europe/Rome) but leaves all_day = false, so the overlapping events
-- (find_event_conflicts, list_event_overlaps) count it and list_calendar_events returns it
-- as an event with a time (rule 7 of #510, decision 3 of 25/11).
-- New version of the function, same signature, same grants (create or replace keeps them),
-- same rules; the only change: all_day is written on insert and on update (true for the
-- days of an event «tutto il giorno», false for the events with a time). The rows already
-- saved are updated in the next migration (imported_all_day_backfill).
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

    -- The events of FamilyNest this item gives: occurrence key, start, end, all day.
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
            'busy', false,
            'all_day', true
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
            'busy', not v_item.is_free,
            'all_day', false
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
        r.busy,
        r.all_day
      from jsonb_to_recordset(v_rows_to_write) as r (
        key text, starts_at timestamptz, ends_at timestamptz, busy boolean, all_day boolean
      )
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
            all_day = v_row.all_day,
            visibility = case
              when v_link.visibility_overridden then private.imported_event_visibility(e.visibility, v_item.is_private)
              else v_visibility
            end
        where e.id = v_link.event_id
          and (e.title, e.location, e.starts_at, e.ends_at, e.all_day, e.visibility) is distinct from (
            v_title, v_location, v_row.starts_at, v_row.ends_at, v_row.all_day,
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
          household_id, author_member_id, title, location, starts_at, ends_at, visibility, recurrence,
          all_day
        )
        values (
          v_calendar.household_id, v_calendar.member_id, v_title, v_location, v_row.starts_at,
          v_row.ends_at, v_visibility, 'none', v_row.all_day
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
