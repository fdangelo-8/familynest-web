-- Issue #86: functions and triggers of the events.
--
-- Conventions (same as the base schema):
-- - every function has `set search_path = ''` and fully qualified names;
-- - helpers and trigger functions live in the "private" schema (not exposed by the
--   Data API, not in the generated types);
-- - guard triggers are `security invoker`: `current_user` is then the role that runs
--   the statement. The Data API roles (authenticated, anon) get the checks, while
--   statements run by security definer functions (owner: postgres), foreign key
--   actions and the seed are trusted;
-- - `security definer` only where the function must read rows the caller cannot see.
-- Execute grants are set in the events_policies_and_grants migration.

-- ---------------------------------------------------------------------------
-- Helpers used by the RLS policies (no policy reads the other table directly, so the
-- policies of events and event_members never call each other).
-- ---------------------------------------------------------------------------

-- Member of the caller (one household per account), or null.
create or replace function private.current_member_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.id
  from public.household_members m
  where m.user_id = (select auth.uid());
$$;

-- True when the caller is one of the participants of the event.
create or replace function private.is_event_participant(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.event_members em
    join public.household_members m on m.id = em.member_id
    where em.event_id = p_event_id
      and m.user_id = (select auth.uid())
  );
$$;

-- True when the caller may see the event in full: an event of the caller's household
-- that is «Tutto il Nest», or in which the caller is the author, the escort or a
-- participant. Same rule as the select policy of events.
create or replace function private.can_read_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.events e
    join public.household_members me
      on me.household_id = e.household_id
     and me.user_id = (select auth.uid())
    where e.id = p_event_id
      and (
        e.visibility = 'household'
        or e.author_member_id = me.id
        or e.escort_member_id = me.id
        or exists (
          select 1
          from public.event_members em
          where em.event_id = e.id
            and em.member_id = me.id
        )
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- events: normalisation and guards
-- ---------------------------------------------------------------------------

-- Shared by insert and update: trims the texts, sorts the days of the week and checks
-- that the escort is an adult of the household.
create or replace function private.events_normalize(p_event public.events)
returns public.events
language plpgsql
stable
set search_path = ''
as $$
begin
  p_event.title := btrim(regexp_replace(p_event.title, '\s+', ' ', 'g'));
  p_event.location := nullif(btrim(regexp_replace(p_event.location, '\s+', ' ', 'g')), '');

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

create or replace function private.events_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_household_id uuid;
begin
  if current_user in ('authenticated', 'anon') then
    -- Checked first, so that a refused insert into another household never reveals
    -- anything about its members.
    v_household_id := (select public.current_household_id());
    if v_household_id is null or new.household_id is distinct from v_household_id then
      raise exception 'new row violates row-level security policy for table "events"'
        using errcode = '42501';
    end if;

    -- The author is always the caller; the app never chooses it.
    new.author_member_id := (select private.current_member_id());
    new.created_at := now();
    new.updated_at := now();
  end if;

  new := private.events_normalize(new);
  return new;
end;
$$;

create trigger events_before_insert
  before insert on public.events
  for each row execute function private.events_before_insert();

-- The app changes the content of an event (column grants). Household, author and
-- creation time never change; only the author changes who sees the event.
create or replace function private.events_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if new.id is distinct from old.id
       or new.household_id is distinct from old.household_id
       or new.author_member_id is distinct from old.author_member_id
       or new.created_at is distinct from old.created_at then
      raise exception 'this event field cannot be changed' using errcode = '42501';
    end if;

    if new.visibility is distinct from old.visibility
       and (old.author_member_id is null
            or old.author_member_id is distinct from (select private.current_member_id())) then
      raise exception 'only the author can change who sees an event' using errcode = '42501';
    end if;
  end if;

  new := private.events_normalize(new);
  return new;
end;
$$;

create trigger events_before_update
  before update on public.events
  for each row execute function private.events_before_update();

create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- A member leaves the household (or is removed, or deletes the account): their
-- «Solo io» and «Occupato» events are deleted with them (nobody else could ever see
-- them). Their «Tutto il Nest» events stay for the household, without author
-- (foreign key `on delete set null`). Participations and escort roles of the member
-- are removed by the foreign keys.
-- Security definer: the events of the leaving member are not all visible to the caller
-- (for example an administrator removing an adult).
-- ---------------------------------------------------------------------------
create or replace function private.household_members_delete_private_events()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.events e
  where e.author_member_id = old.id
    and e.visibility <> 'household';
  return old;
end;
$$;

create trigger household_members_delete_private_events
  before delete on public.household_members
  for each row execute function private.household_members_delete_private_events();

-- ---------------------------------------------------------------------------
-- Repetitions
-- ---------------------------------------------------------------------------

-- Start instants of the occurrences of an event that start between p_from and p_to
-- (a few occurrences just outside may be returned: the caller filters exactly).
-- Occurrences keep the local time of the first one in Europe/Rome (17:00 stays 17:00
-- across daylight saving time changes):
-- - none:    the event itself;
-- - weekly:  every listed day of the week, from the first occurrence on;
-- - monthly: the same day of the month as the first occurrence; months without that
--            day (for example the 31st) are skipped;
-- - never after recurrence_until (local date, included).
create or replace function private.event_occurrence_starts(
  p_starts_at timestamptz,
  p_recurrence public.event_recurrence,
  p_weekdays smallint[],
  p_until date,
  p_from timestamptz,
  p_to timestamptz
)
returns setof timestamptz
language sql
stable
set search_path = ''
as $$
  select p_starts_at
  where p_recurrence = 'none'
  union all
  select (d::date + (p_starts_at at time zone 'Europe/Rome')::time) at time zone 'Europe/Rome'
  from generate_series(
    greatest(
      (p_starts_at at time zone 'Europe/Rome')::date,
      (p_from at time zone 'Europe/Rome')::date - 1
    )::timestamp,
    least(
      coalesce(p_until, (p_to at time zone 'Europe/Rome')::date + 1),
      (p_to at time zone 'Europe/Rome')::date + 1
    )::timestamp,
    interval '1 day'
  ) as d
  where (
      p_recurrence = 'weekly'
      and extract(isodow from d)::smallint = any (p_weekdays)
    )
    or (
      p_recurrence = 'monthly'
      and extract(day from d) = extract(day from (p_starts_at at time zone 'Europe/Rome'))
    );
$$;

-- ---------------------------------------------------------------------------
-- RPC: the events of the caller's household that touch a period, repetitions
-- expanded, with the visibility rules of pages #25 and #30 applied by the database:
-- - events the caller may see in full (see private.can_read_event): every field;
-- - «Occupato» events of the others: only start, end, visibility and author, with
--   is_masked = true; id, title, location, escort and participants are null;
-- - «Solo io» events of the others: never returned.
-- The household is always the caller's (never chosen by the app). A user without
-- household gets no rows. The period [p_from, p_to) lasts at most 42 days, measured on
-- the Europe/Rome clock (six weeks of the month view, daylight saving time included).
-- One row per occurrence: a repeated event returns the same id with different times.
-- Participants are member ids in the order of the household members.
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
        and e.starts_at < p_to
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
        o.occurrence_start + (v.ends_at - v.starts_at) as occurrence_end
      from visible v
      cross join lateral private.event_occurrence_starts(
        v.starts_at,
        v.recurrence,
        v.recurrence_weekdays,
        v.recurrence_until,
        p_from - (v.ends_at - v.starts_at),
        p_to
      ) as o (occurrence_start)
    )
    select
      case when o.masked then null else o.id end,
      o.occurrence_start,
      o.occurrence_end,
      o.visibility,
      o.author_member_id,
      o.masked,
      case when o.masked then null else o.title end,
      case when o.masked then null else o.location end,
      case when o.masked then null else o.escort_member_id end,
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
