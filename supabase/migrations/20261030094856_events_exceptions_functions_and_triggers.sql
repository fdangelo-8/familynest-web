-- Issue #109 (for pages #19 Dettaglio impegno and #20 Aggiungi · Impegni): notes,
-- exceptions of the repetitions, reading one occurrence, creating, changing and deleting
-- events in one call.
--
-- Conventions (same as the events migrations of #86):
-- - every function has `set search_path = ''` and fully qualified names;
-- - helpers and trigger functions live in the "private" schema (not exposed by the Data
--   API, not in the generated types);
-- - guard triggers are `security invoker`: `current_user` is then the role that runs the
--   statement. The Data API roles get the checks; statements run by security definer
--   functions (owner: postgres) and foreign key actions are trusted;
-- - the public functions are `security invoker`: RLS, column privileges, triggers and
--   constraints of events, event_members and event_exceptions apply to every statement
--   they run, exactly as if the app ran them one by one, but in one transaction (all or
--   nothing). The only `security definer` function is private.split_event_series(), which
--   copies a series without changing who sees it (see there);
-- - the functions that receive what the user wrote (titles, places, notes) refuse any
--   Data API method other than POST (lesson of #112: with GET the arguments would end up
--   in the URL); the others that write do the same, for uniformity.
-- Execute grants are in the events_exceptions_policies_and_grants migration.
--
-- Error codes the app can tell apart:
-- - P0002 'event not found': the event does not exist, is not visible in full to the
--   caller, or the day is not an occurrence of it (or that occurrence was removed). Never
--   says which one;
-- - 23514 with the name of the constraint, for example events_repeated_duration or
--   event_exceptions_duration (a repeated event, or one occurrence, lasts more than 7
--   days), events_title_length, events_until_after_start;
-- - 42501: not allowed (only the author changes who sees an event or adds people to a
--   «Solo io» or «Occupato» event; the escort of one occurrence must already see it);
-- - 22023: invalid arguments (for example a scope or a list of participants with null);
-- - P0001 'use POST': called through the Data API with GET or HEAD.

-- ---------------------------------------------------------------------------
-- events: the notes are normalised with the other texts (same function as #86, one
-- line more). Leading and trailing whitespace is removed, line breaks stay; an empty
-- text becomes null.
-- ---------------------------------------------------------------------------
create or replace function private.events_normalize(p_event public.events)
returns public.events
language plpgsql
stable
set search_path = ''
as $$
begin
  p_event.title := btrim(regexp_replace(p_event.title, '\s+', ' ', 'g'));
  p_event.location := nullif(btrim(regexp_replace(p_event.location, '\s+', ' ', 'g')), '');
  p_event.notes := nullif(regexp_replace(p_event.notes, '^\s+|\s+$', '', 'g'), '');

  if p_event.recurrence_weekdays is not null then
    p_event.recurrence_weekdays := (
      select array_agg(distinct d order by d)
      from unnest(p_event.recurrence_weekdays) as d
    );
  end if;

  -- The composite foreign key already guarantees the household; the escort must also
  -- be an adult (children and pets do not accompany anyone).
  if p_event.escort_member_id is not null and not exists (
    select 1
    from public.household_members m
    where m.id = p_event.escort_member_id
      and m.household_id = p_event.household_id
      and m.kind = 'adult'
  ) then
    raise exception 'the escort must be an adult of the household' using errcode = '23514';
  end if;

  return p_event;
end;
$$;

-- ---------------------------------------------------------------------------
-- Occurrences
-- ---------------------------------------------------------------------------

-- True when the series has an occurrence starting on p_day (Europe/Rome), according to
-- its rule (exceptions not considered).
create or replace function private.event_has_occurrence_on(
  p_starts_at timestamptz,
  p_recurrence public.event_recurrence,
  p_weekdays smallint[],
  p_until date,
  p_day date
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_day is not null and exists (
    select 1
    from private.event_occurrence_starts(
      p_starts_at,
      p_recurrence,
      p_weekdays,
      p_until,
      p_day::timestamp at time zone 'Europe/Rome',
      (p_day + 1)::timestamp at time zone 'Europe/Rome'
    ) as s (occurrence_start)
    where (s.occurrence_start at time zone 'Europe/Rome')::date = p_day
  );
$$;

-- The occurrences of one event that overlap [p_from, p_to), exceptions applied:
-- - regular occurrences of the series, except the days that have an exception;
-- - modified occurrences (is_modified = true) with their own start, end, title, place,
--   notes and escort; for regular occurrences these four values are null (the caller
--   takes them from the series).
-- Removed occurrences are not returned. Exceptions count only for repeated events and
-- only on days that are still occurrences of the series (a series changed later leaves
-- no stray occurrence behind). occurrence_date identifies the occurrence in the series
-- (the day it starts according to the rule), even when it was moved to another day.
-- Security invoker: the rows of event_exceptions are those the caller may read (all of
-- them when called by a security definer function).
create or replace function private.event_occurrences(
  p_event_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_recurrence public.event_recurrence,
  p_weekdays smallint[],
  p_until date,
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  occurrence_date date,
  starts_at timestamptz,
  ends_at timestamptz,
  is_modified boolean,
  title text,
  location text,
  notes text,
  escort_member_id uuid
)
language sql
stable
set search_path = ''
as $$
  select
    r.occurrence_date,
    r.occurrence_start,
    r.occurrence_start + (p_ends_at - p_starts_at),
    false,
    null::text,
    null::text,
    null::text,
    null::uuid
  from (
    select
      s.occurrence_start,
      (s.occurrence_start at time zone 'Europe/Rome')::date as occurrence_date
    from private.event_occurrence_starts(
      p_starts_at,
      p_recurrence,
      p_weekdays,
      p_until,
      p_from - (p_ends_at - p_starts_at),
      p_to
    ) as s (occurrence_start)
  ) r
  where r.occurrence_start < p_to
    and r.occurrence_start + (p_ends_at - p_starts_at) > p_from
    and (
      p_recurrence = 'none'
      or not exists (
        select 1
        from public.event_exceptions x
        where x.event_id = p_event_id
          and x.occurrence_date = r.occurrence_date
      )
    )
  union all
  select
    x.occurrence_date,
    x.starts_at,
    x.ends_at,
    true,
    x.title,
    x.location,
    x.notes,
    x.escort_member_id
  from public.event_exceptions x
  where p_recurrence <> 'none'
    and x.event_id = p_event_id
    and not x.is_cancelled
    and x.starts_at < p_to
    and x.ends_at > p_from
    and private.event_has_occurrence_on(p_starts_at, p_recurrence, p_weekdays, p_until, x.occurrence_date);
$$;

-- ---------------------------------------------------------------------------
-- event_exceptions: normalisation and guards
-- ---------------------------------------------------------------------------

-- Shared by insert and update. Reads the event as the caller: an event the caller does
-- not see in full gives the same error as the RLS policy, without saying anything about
-- it. Then:
-- - texts normalised as in events;
-- - only repeated events have exceptions, and only on days that are occurrences;
-- - the escort of one occurrence is an adult of the household and, on «Solo io» and
--   «Occupato» events, someone who already sees the event in full (author, escort or
--   participant of the series): an exception never widens who sees an event. Checked
--   only when the escort changes (p_old_escort_member_id is the previous value).
create or replace function private.event_exceptions_normalize(
  p_row public.event_exceptions,
  p_old_escort_member_id uuid
)
returns public.event_exceptions
language plpgsql
stable
set search_path = ''
as $$
declare
  v_event public.events;
begin
  p_row.title := btrim(regexp_replace(p_row.title, '\s+', ' ', 'g'));
  p_row.location := nullif(btrim(regexp_replace(p_row.location, '\s+', ' ', 'g')), '');
  p_row.notes := nullif(regexp_replace(p_row.notes, '^\s+|\s+$', '', 'g'), '');

  select e.* into v_event
  from public.events e
  where e.id = p_row.event_id
    and e.household_id = p_row.household_id;

  if not found then
    raise exception 'new row violates row-level security policy for table "event_exceptions"'
      using errcode = '42501';
  end if;

  if v_event.recurrence = 'none' then
    raise exception 'only repeated events have exceptions' using errcode = '22023';
  end if;

  if not private.event_has_occurrence_on(
    v_event.starts_at, v_event.recurrence, v_event.recurrence_weekdays, v_event.recurrence_until,
    p_row.occurrence_date
  ) then
    raise exception 'the day is not an occurrence of the event' using errcode = '22023';
  end if;

  if p_row.escort_member_id is not null
     and p_row.escort_member_id is distinct from p_old_escort_member_id then
    if not exists (
      select 1
      from public.household_members m
      where m.id = p_row.escort_member_id
        and m.household_id = p_row.household_id
        and m.kind = 'adult'
    ) then
      raise exception 'the escort must be an adult of the household' using errcode = '23514';
    end if;

    if v_event.visibility <> 'household'
       and p_row.escort_member_id is distinct from v_event.author_member_id
       and p_row.escort_member_id is distinct from v_event.escort_member_id
       and not exists (
         select 1
         from public.event_members em
         where em.event_id = v_event.id
           and em.member_id = p_row.escort_member_id
       ) then
      raise exception 'the escort of one occurrence must already see the event' using errcode = '42501';
    end if;
  end if;

  return p_row;
end;
$$;

create or replace function private.event_exceptions_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_household_id uuid;
begin
  if current_user in ('authenticated', 'anon') then
    -- Checked first, so that a refused insert into another household never reveals
    -- anything about its events.
    v_household_id := (select public.current_household_id());
    if v_household_id is null or new.household_id is distinct from v_household_id then
      raise exception 'new row violates row-level security policy for table "event_exceptions"'
        using errcode = '42501';
    end if;

    new.created_at := now();
    new.updated_at := now();
  end if;

  new := private.event_exceptions_normalize(new, null);
  return new;
end;
$$;

create trigger event_exceptions_before_insert
  before insert on public.event_exceptions
  for each row execute function private.event_exceptions_before_insert();

-- The app changes the values of an occurrence (column grants); event, household, day and
-- creation time never change.
create or replace function private.event_exceptions_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if new.event_id is distinct from old.event_id
       or new.household_id is distinct from old.household_id
       or new.occurrence_date is distinct from old.occurrence_date
       or new.created_at is distinct from old.created_at then
      raise exception 'this exception field cannot be changed' using errcode = '42501';
    end if;
  end if;

  new := private.event_exceptions_normalize(new, old.escort_member_id);
  return new;
end;
$$;

create trigger event_exceptions_before_update
  before update on public.event_exceptions
  for each row execute function private.event_exceptions_before_update();

create trigger event_exceptions_set_updated_at
  before update on public.event_exceptions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- «Tutti i prossimi» on an occurrence after the first one: the series is split in two.
-- The occurrences before p_day stay in the event (recurrence_until = p_day - 1); a new
-- event, an exact copy (same author, visibility, escort, participants, texts, rule and
-- last day), starts with the occurrence of p_day and takes the exceptions from p_day on.
-- The caller then changes the copy with normal statements (public.update_event).
--
-- Security definer only because the copy must keep the author of the series: inserted
-- by the caller, the before insert trigger would make the caller its author, and a
-- participant of a «Solo io» or «Occupato» event of someone else would then be able to
-- show it to everyone. Nothing else changes: the caller must see the event in full (the
-- same rule that lets them change it), and the copy is seen in full by exactly the same
-- people. Returns the id of the copy.
-- ---------------------------------------------------------------------------
create or replace function private.split_event_series(p_event_id uuid, p_day date)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_event public.events;
  v_start timestamptz;
  v_new_id uuid;
begin
  if p_event_id is null or p_day is null or not private.can_read_event(p_event_id) then
    raise exception 'event not found' using errcode = 'P0002';
  end if;

  select e.* into v_event
  from public.events e
  where e.id = p_event_id
  for update;

  if not found then
    raise exception 'event not found' using errcode = 'P0002';
  end if;

  if v_event.recurrence = 'none'
     or p_day <= (v_event.starts_at at time zone 'Europe/Rome')::date
     or not private.event_has_occurrence_on(
       v_event.starts_at, v_event.recurrence, v_event.recurrence_weekdays, v_event.recurrence_until, p_day
     ) then
    raise exception 'event not found' using errcode = 'P0002';
  end if;

  -- Same local time as every occurrence of the series (see event_occurrence_starts).
  v_start := (p_day + (v_event.starts_at at time zone 'Europe/Rome')::time) at time zone 'Europe/Rome';

  insert into public.events (
    household_id, author_member_id, title, location, notes, starts_at, ends_at, visibility,
    escort_member_id, recurrence, recurrence_weekdays, recurrence_until
  )
  values (
    v_event.household_id, v_event.author_member_id, v_event.title, v_event.location, v_event.notes,
    v_start, v_start + (v_event.ends_at - v_event.starts_at), v_event.visibility,
    v_event.escort_member_id, v_event.recurrence, v_event.recurrence_weekdays, v_event.recurrence_until
  )
  returning id into v_new_id;

  insert into public.event_members (event_id, member_id, household_id)
  select v_new_id, em.member_id, em.household_id
  from public.event_members em
  where em.event_id = p_event_id;

  update public.event_exceptions x
  set event_id = v_new_id
  where x.event_id = p_event_id
    and x.occurrence_date >= p_day;

  update public.events e
  set recurrence_until = p_day - 1
  where e.id = p_event_id;

  return v_new_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: the events of the caller's household that touch a period (new version of #86,
-- same arguments, same columns, same rules), with the exceptions applied:
-- - a removed occurrence is never returned, to anybody, masked rows included;
-- - a modified occurrence is returned at its own times, with its own title, place and
--   escort (masked rows: only its times, as for every «Occupato» of the others).
-- Notes are never returned (the calendar does not show them).
-- ---------------------------------------------------------------------------
create or replace function public.list_household_events(p_from timestamptz, p_to timestamptz)
returns table (
  id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  visibility public.event_visibility,
  author_member_id uuid,
  is_masked boolean,
  title text,
  location text,
  escort_member_id uuid,
  member_ids uuid[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_household_id uuid;
  v_member_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'permission denied for function list_household_events' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or not isfinite(p_from) or not isfinite(p_to) or p_to <= p_from then
    raise exception 'invalid period' using errcode = '22023';
  end if;
  if (p_to at time zone 'Europe/Rome') - (p_from at time zone 'Europe/Rome') > interval '42 days' then
    raise exception 'the period cannot last more than 42 days' using errcode = '22023';
  end if;

  select m.id, m.household_id into v_member_id, v_household_id
  from public.household_members m
  where m.user_id = (select auth.uid());

  if v_household_id is null then
    return;
  end if;

  return query
    with candidates as (
      select
        e.*,
        (
          e.author_member_id is not distinct from v_member_id
          or e.escort_member_id is not distinct from v_member_id
          or exists (
            select 1
            from public.event_members em
            where em.event_id = e.id
              and em.member_id = v_member_id
          )
        ) as involved
      from public.events e
      where e.household_id = v_household_id
        and (
          (
            e.starts_at < p_to
            and (
              (e.recurrence = 'none' and e.ends_at > p_from)
              or (
                e.recurrence <> 'none'
                and (
                  e.recurrence_until is null
                  or e.recurrence_until >= (p_from at time zone 'Europe/Rome')::date - 8
                )
              )
            )
          )
          -- An occurrence moved into the period from far away.
          or exists (
            select 1
            from public.event_exceptions x
            where x.event_id = e.id
              and not x.is_cancelled
              and x.starts_at < p_to
              and x.ends_at > p_from
          )
        )
    ),
    visible as (
      select
        c.*,
        -- Fail closed: anything not provably involved is treated as not involved.
        (c.visibility <> 'household' and not coalesce(c.involved, false)) as masked
      from candidates c
      where coalesce(c.involved, false) or c.visibility <> 'private'
    ),
    occurrences as (
      select
        v.*,
        o.occurrence_start,
        o.occurrence_end,
        o.is_modified,
        o.occurrence_title,
        o.occurrence_location,
        o.occurrence_escort_member_id
      from visible v
      cross join lateral private.event_occurrences(
        v.id,
        v.starts_at,
        v.ends_at,
        v.recurrence,
        v.recurrence_weekdays,
        v.recurrence_until,
        p_from,
        p_to
      ) as o (
        occurrence_date,
        occurrence_start,
        occurrence_end,
        is_modified,
        occurrence_title,
        occurrence_location,
        occurrence_notes,
        occurrence_escort_member_id
      )
    )
    select
      case when o.masked then null else o.id end,
      o.occurrence_start,
      o.occurrence_end,
      o.visibility,
      o.author_member_id,
      o.masked,
      case
        when o.masked then null
        when o.is_modified then o.occurrence_title
        else o.title
      end,
      case
        when o.masked then null
        when o.is_modified then o.occurrence_location
        else o.location
      end,
      case
        when o.masked then null
        when o.is_modified then o.occurrence_escort_member_id
        else o.escort_member_id
      end,
      case
        when o.masked then null
        else coalesce(
          (
            select array_agg(em.member_id order by m.created_at, m.id)
            from public.event_members em
            join public.household_members m on m.id = em.member_id
            where em.event_id = o.id
          ),
          array[]::uuid[]
        )
      end
    from occurrences o
    where o.occurrence_start < p_to
      and o.occurrence_end > p_from
    order by o.occurrence_start, o.occurrence_end, o.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: one occurrence of an event, for the detail page (#19).
--
-- p_day is the day (Europe/Rome) on which the occurrence to show starts (the «giorno» of
-- the address). With p_day null: the occurrence in progress or the next one from now;
-- when there is none (the series has ended), the last one; for an event that does not
-- repeat, the event itself.
-- Exactly one row when the caller sees the event in full and the day has an occurrence
-- that was not removed; zero rows in every other case (unknown id, other household,
-- «Occupato» or «Solo io» of the others, wrong day, removed occurrence), never an error
-- that tells them apart. Two occurrences starting on the same day (one was moved there):
-- the one that starts first.
--
-- Columns:
-- - id, occurrence_date: what the app sends back to change or delete this occurrence
--   (occurrence_date is the day of the occurrence in the series, also when it was moved);
-- - starts_at, ends_at, title, location, notes, escort_member_id: this occurrence (its
--   own values when is_modified, otherwise those of the series);
-- - visibility, author_member_id, member_ids (in the order of the household members),
--   recurrence, recurrence_weekdays, recurrence_until: the series;
-- - series_starts_at, series_ends_at: the first occurrence of the series.
-- Security invoker: the RLS policies decide what the caller reads.
-- ---------------------------------------------------------------------------
create or replace function public.get_event_occurrence(p_event_id uuid, p_day date default null)
returns table (
  id uuid,
  occurrence_date date,
  starts_at timestamptz,
  ends_at timestamptz,
  title text,
  location text,
  notes text,
  visibility public.event_visibility,
  author_member_id uuid,
  escort_member_id uuid,
  member_ids uuid[],
  recurrence public.event_recurrence,
  recurrence_weekdays smallint[],
  recurrence_until date,
  series_starts_at timestamptz,
  series_ends_at timestamptz,
  is_modified boolean
)
language plpgsql
stable
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_event public.events;
  v_occurrence record;
  v_horizon timestamptz;
  v_upper date;
  v_lower date;
begin
  if p_event_id is null or (select auth.uid()) is null then
    return;
  end if;

  -- RLS: only an event the caller sees in full.
  select e.* into v_event
  from public.events e
  where e.id = p_event_id;

  if not found then
    return;
  end if;

  if p_day is not null then
    select o.* into v_occurrence
    from private.event_occurrences(
      v_event.id, v_event.starts_at, v_event.ends_at, v_event.recurrence,
      v_event.recurrence_weekdays, v_event.recurrence_until,
      p_day::timestamp at time zone 'Europe/Rome',
      (p_day + 1)::timestamp at time zone 'Europe/Rome'
    ) o
    where (o.starts_at at time zone 'Europe/Rome')::date = p_day
    order by o.starts_at, o.occurrence_date
    limit 1;
  elsif v_event.recurrence = 'none' then
    select o.* into v_occurrence
    from private.event_occurrences(
      v_event.id, v_event.starts_at, v_event.ends_at, v_event.recurrence,
      v_event.recurrence_weekdays, v_event.recurrence_until,
      v_event.starts_at, v_event.ends_at
    ) o
    limit 1;
  else
    -- In progress or next.
    v_horizon := greatest(now(), v_event.starts_at) + interval '400 days';
    select o.* into v_occurrence
    from private.event_occurrences(
      v_event.id, v_event.starts_at, v_event.ends_at, v_event.recurrence,
      v_event.recurrence_weekdays, v_event.recurrence_until,
      now(), v_horizon
    ) o
    order by o.starts_at, o.occurrence_date
    limit 1;

    -- Otherwise the last one.
    if not found then
      v_upper := coalesce(v_event.recurrence_until, (v_horizon at time zone 'Europe/Rome')::date);
      v_lower := greatest((v_event.starts_at at time zone 'Europe/Rome')::date, v_upper - 1000);
      select o.* into v_occurrence
      from private.event_occurrences(
        v_event.id, v_event.starts_at, v_event.ends_at, v_event.recurrence,
        v_event.recurrence_weekdays, v_event.recurrence_until,
        (v_lower - 8)::timestamp at time zone 'Europe/Rome',
        (v_upper + 1)::timestamp at time zone 'Europe/Rome'
      ) o
      order by o.starts_at desc, o.occurrence_date desc
      limit 1;
    end if;
  end if;

  if not found then
    return;
  end if;

  return query
    select
      v_event.id,
      v_occurrence.occurrence_date::date,
      v_occurrence.starts_at::timestamptz,
      v_occurrence.ends_at::timestamptz,
      case when v_occurrence.is_modified then v_occurrence.title::text else v_event.title end,
      case when v_occurrence.is_modified then v_occurrence.location::text else v_event.location end,
      case when v_occurrence.is_modified then v_occurrence.notes::text else v_event.notes end,
      v_event.visibility,
      v_event.author_member_id,
      case
        when v_occurrence.is_modified then v_occurrence.escort_member_id::uuid
        else v_event.escort_member_id
      end,
      coalesce(
        (
          select array_agg(em.member_id order by m.created_at, m.id)
          from public.event_members em
          join public.household_members m on m.id = em.member_id
          where em.event_id = v_event.id
        ),
        array[]::uuid[]
      ),
      v_event.recurrence,
      v_event.recurrence_weekdays,
      v_event.recurrence_until,
      v_event.starts_at,
      v_event.ends_at,
      v_occurrence.is_modified::boolean;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: a new event with its participants, in one transaction (#20 «Aggiungi», and the
-- full form «Nuovo impegno»). Returns the id of the event (for «Annulla»).
-- Author and household are set by the database (before insert trigger, column default);
-- every rule of the events applies (RLS, triggers, constraints). Duplicated participants
-- count once; an empty list adds nobody; a participant of another household makes the
-- whole call fail (23503) and nothing is created.
-- ---------------------------------------------------------------------------
create or replace function public.create_event(
  p_title text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_visibility public.event_visibility,
  p_member_ids uuid[],
  p_location text default null,
  p_escort_member_id uuid default null,
  p_recurrence public.event_recurrence default 'none',
  p_recurrence_weekdays smallint[] default null,
  p_recurrence_until date default null,
  p_notes text default null
)
returns uuid
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  if array_position(p_member_ids, null) is not null then
    raise exception 'invalid participants' using errcode = '22023';
  end if;

  insert into public.events (
    title, location, notes, starts_at, ends_at, visibility, escort_member_id,
    recurrence, recurrence_weekdays, recurrence_until
  )
  values (
    p_title, p_location, p_notes, p_starts_at, p_ends_at, p_visibility, p_escort_member_id,
    p_recurrence, p_recurrence_weekdays, p_recurrence_until
  )
  returning id into v_id;

  insert into public.event_members (event_id, member_id)
  select distinct v_id, m.member_id
  from unnest(coalesce(p_member_ids, array[]::uuid[])) as m (member_id);

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: change a whole event, or a repeated event from one occurrence on («Salva tutti
-- i prossimi»), in one transaction. Every argument is the new value (the complete form):
-- nothing is kept from before unless the app sends it again.
--
-- p_day is the occurrence the user opened (occurrence_date of get_event_occurrence):
-- - null, the first occurrence, or an event that does not repeat: the whole event
--   changes;
-- - a later occurrence: the series is split there (private.split_event_series): the
--   occurrences before stay as they were, the new values apply from p_day on, to a new
--   event whose id is returned (the app shows that one).
-- Returns the id of the event that now holds the changed occurrences.
--
-- Exceptions of the changed part:
-- - modified occurrences take the new values (their own values are dropped);
-- - removed occurrences stay removed when the rule stays the same, moved by as many days
--   as the start moved (a series of Tuesday and Thursday moved to Wednesday and Friday,
--   with the weekdays sent moved the same way, keeps its removed days one day later);
--   they are dropped when the rule changes (the series starts again from p_starts_at).
-- Participants: those of p_member_ids are added (RLS: only the author adds people to a
-- «Solo io» or «Occupato» event), the others removed.
-- ---------------------------------------------------------------------------
create or replace function public.update_event(
  p_event_id uuid,
  p_day date,
  p_title text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_visibility public.event_visibility,
  p_member_ids uuid[],
  p_location text,
  p_escort_member_id uuid,
  p_recurrence public.event_recurrence,
  p_recurrence_weekdays smallint[],
  p_recurrence_until date,
  p_notes text
)
returns uuid
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_event public.events;
  v_target uuid;
  v_old_start timestamptz;
  v_delta integer;
  v_same_rule boolean;
  v_cancelled date[] := array[]::date[];
  v_changed public.events;
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  if p_member_ids is null or array_position(p_member_ids, null) is not null then
    raise exception 'invalid participants' using errcode = '22023';
  end if;

  -- RLS: only an event the caller sees in full (and may therefore change).
  select e.* into v_event
  from public.events e
  where e.id = p_event_id
  for update;

  if not found then
    raise exception 'event not found' using errcode = 'P0002';
  end if;

  if p_day is not null and (
    not private.event_has_occurrence_on(
      v_event.starts_at, v_event.recurrence, v_event.recurrence_weekdays, v_event.recurrence_until, p_day
    )
    or (
      v_event.recurrence <> 'none'
      and exists (
        select 1
        from public.event_exceptions x
        where x.event_id = p_event_id
          and x.occurrence_date = p_day
          and x.is_cancelled
      )
    )
  ) then
    raise exception 'event not found' using errcode = 'P0002';
  end if;

  if p_day is null or p_day <= (v_event.starts_at at time zone 'Europe/Rome')::date then
    v_target := p_event_id;
    v_old_start := v_event.starts_at;
  else
    v_target := private.split_event_series(p_event_id, p_day);
    v_old_start := (p_day + (v_event.starts_at at time zone 'Europe/Rome')::time) at time zone 'Europe/Rome';
  end if;

  if v_event.recurrence <> 'none' then
    v_delta := (p_starts_at at time zone 'Europe/Rome')::date - (v_old_start at time zone 'Europe/Rome')::date;
    v_same_rule := coalesce(
      p_recurrence = v_event.recurrence
      and (
        p_recurrence <> 'weekly'
        or (
          select array_agg(d order by d)
          from (select distinct w as d from unnest(p_recurrence_weekdays) as w) s
        ) = (
          select array_agg(d order by d)
          from (
            select distinct ((((w - 1 + v_delta) % 7) + 7) % 7 + 1)::smallint as d
            from unnest(v_event.recurrence_weekdays) as w
          ) s
        )
      ),
      false
    );

    if v_same_rule then
      select coalesce(array_agg(x.occurrence_date + v_delta), array[]::date[]) into v_cancelled
      from public.event_exceptions x
      where x.event_id = v_target
        and x.is_cancelled;
    end if;

    delete from public.event_exceptions x
    where x.event_id = v_target;
  end if;

  update public.events e
  set
    title = p_title,
    location = p_location,
    notes = p_notes,
    starts_at = p_starts_at,
    ends_at = p_ends_at,
    visibility = p_visibility,
    escort_member_id = p_escort_member_id,
    recurrence = p_recurrence,
    recurrence_weekdays = p_recurrence_weekdays,
    recurrence_until = p_recurrence_until
  where e.id = v_target;

  if cardinality(v_cancelled) > 0 then
    select e.* into v_changed
    from public.events e
    where e.id = v_target;

    insert into public.event_exceptions (event_id, household_id, occurrence_date, is_cancelled)
    select v_target, v_changed.household_id, d, true
    from unnest(v_cancelled) as d
    where private.event_has_occurrence_on(
      v_changed.starts_at, v_changed.recurrence, v_changed.recurrence_weekdays,
      v_changed.recurrence_until, d
    );
  end if;

  -- Additions first: removing oneself from a «Solo io» or «Occupato» event of someone
  -- else ends what the caller may do on it.
  insert into public.event_members (event_id, member_id, household_id)
  select distinct v_target, m.member_id, v_event.household_id
  from unnest(p_member_ids) as m (member_id)
  where not exists (
    select 1
    from public.event_members em
    where em.event_id = v_target
      and em.member_id = m.member_id
  );

  delete from public.event_members em
  where em.event_id = v_target
    and em.member_id <> all (p_member_ids);

  return v_target;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: change only one occurrence of a repeated event («Salva solo questo»).
-- The occurrence (p_day = occurrence_date of get_event_occurrence) gets its own title,
-- start, end (also on another day), place, escort and notes: the complete values, not
-- only what changed. Visibility, participants and the rule belong to the series and
-- change only with update_event («Salva tutti i prossimi»): an occurrence never changes
-- who sees the event. The escort of the occurrence must already see the event in full
-- on «Solo io» and «Occupato» events (42501 otherwise).
-- An event that does not repeat: 22023 (the app uses update_event).
-- ---------------------------------------------------------------------------
create or replace function public.update_event_occurrence(
  p_event_id uuid,
  p_day date,
  p_title text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_location text,
  p_escort_member_id uuid,
  p_notes text
)
returns void
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_event public.events;
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  select e.* into v_event
  from public.events e
  where e.id = p_event_id
  for update;

  if not found then
    raise exception 'event not found' using errcode = 'P0002';
  end if;

  if v_event.recurrence = 'none' then
    raise exception 'the event does not repeat' using errcode = '22023';
  end if;

  if not private.event_has_occurrence_on(
    v_event.starts_at, v_event.recurrence, v_event.recurrence_weekdays, v_event.recurrence_until, p_day
  )
  or exists (
    select 1
    from public.event_exceptions x
    where x.event_id = p_event_id
      and x.occurrence_date = p_day
      and x.is_cancelled
  ) then
    raise exception 'event not found' using errcode = 'P0002';
  end if;

  -- The event row is locked: no concurrent call can insert the same exception.
  update public.event_exceptions x
  set
    is_cancelled = false,
    title = p_title,
    location = p_location,
    notes = p_notes,
    starts_at = p_starts_at,
    ends_at = p_ends_at,
    escort_member_id = p_escort_member_id
  where x.event_id = p_event_id
    and x.occurrence_date = p_day;

  if not found then
    insert into public.event_exceptions (
      event_id, household_id, occurrence_date, is_cancelled, title, location, notes,
      starts_at, ends_at, escort_member_id
    )
    values (
      p_event_id, v_event.household_id, p_day, false, p_title, p_location, p_notes,
      p_starts_at, p_ends_at, p_escort_member_id
    );
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: delete an occurrence (p_day = occurrence_date of get_event_occurrence):
-- - an event that does not repeat: the event is deleted (any scope);
-- - 'this' («Elimina solo questo»): only that occurrence is removed, for everybody;
-- - 'following' («Elimina tutti i prossimi»): that occurrence and every later one; the
--   series ends the day before (recurrence_until = p_day - 1). From the first occurrence
--   the event is deleted.
-- When no occurrence is left (a series with a last day whose occurrences are all
-- removed) the event is deleted.
-- ---------------------------------------------------------------------------
create or replace function public.delete_event_occurrence(
  p_event_id uuid,
  p_day date,
  p_scope public.event_change_scope
)
returns void
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_event public.events;
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  if p_scope is null then
    raise exception 'invalid scope' using errcode = '22023';
  end if;

  select e.* into v_event
  from public.events e
  where e.id = p_event_id
  for update;

  if not found then
    raise exception 'event not found' using errcode = 'P0002';
  end if;

  if not private.event_has_occurrence_on(
    v_event.starts_at, v_event.recurrence, v_event.recurrence_weekdays, v_event.recurrence_until, p_day
  )
  or (
    v_event.recurrence <> 'none'
    and exists (
      select 1
      from public.event_exceptions x
      where x.event_id = p_event_id
        and x.occurrence_date = p_day
        and x.is_cancelled
    )
  ) then
    raise exception 'event not found' using errcode = 'P0002';
  end if;

  if v_event.recurrence = 'none'
     or (p_scope = 'following' and p_day <= (v_event.starts_at at time zone 'Europe/Rome')::date) then
    delete from public.events e
    where e.id = p_event_id;
    return;
  end if;

  if p_scope = 'following' then
    delete from public.event_exceptions x
    where x.event_id = p_event_id
      and x.occurrence_date >= p_day;

    update public.events e
    set recurrence_until = p_day - 1
    where e.id = p_event_id;
  else
    update public.event_exceptions x
    set
      is_cancelled = true,
      title = null,
      location = null,
      notes = null,
      starts_at = null,
      ends_at = null,
      escort_member_id = null
    where x.event_id = p_event_id
      and x.occurrence_date = p_day;

    if not found then
      insert into public.event_exceptions (event_id, household_id, occurrence_date, is_cancelled)
      values (p_event_id, v_event.household_id, p_day, true);
    end if;
  end if;

  -- Nothing left to show: the event goes.
  select e.* into v_event
  from public.events e
  where e.id = p_event_id;

  if v_event.recurrence_until is not null and not exists (
    select 1
    from private.event_occurrences(
      v_event.id, v_event.starts_at, v_event.ends_at, v_event.recurrence,
      v_event.recurrence_weekdays, v_event.recurrence_until,
      v_event.starts_at - interval '400 days',
      ((v_event.recurrence_until + 1)::timestamp at time zone 'Europe/Rome') + interval '400 days'
    )
  ) then
    delete from public.events e
    where e.id = p_event_id;
  end if;
end;
$$;
