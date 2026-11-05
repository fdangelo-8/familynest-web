-- Issue #230 (review of PR #239, point 1): one single place for the visibility rules of
-- the calendar, shared by the calendar, the notifications and the search.
--
-- private.household_event_rows_for_member() holds the query of
-- private.household_events_for_member() (migration household_events_for_member, #229)
-- unchanged, with four more columns:
-- - event_id: the id of the event, always present, also for masked rows. Only for the
--   functions of the database (for example «at most 3 occurrences per event» of the
--   search); it never leaves the database for a masked row;
-- - recurrence, recurrence_weekdays, series_starts_at: the repetition of the event and
--   the start of its first occurrence, null for masked rows.
-- For masked rows («Occupato» of the others) id, title, location, escort, participants
-- and the repetition are already null here: no function reading from it ever gets the
-- title or the details of an «Occupato» of the others.
--
-- private.household_events_for_member() becomes a wrapper: same arguments, same columns,
-- same rows, same order (start, end, id of the event). public.list_household_events()
-- and the notification jobs, which read it, do not change.
--
-- Both private functions trust their arguments (no session, no check of the period):
-- executable only by the database owner, never by the API roles. Security invoker.

create or replace function private.household_event_rows_for_member(
  p_member_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  event_id uuid,
  id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  visibility public.event_visibility,
  author_member_id uuid,
  is_masked boolean,
  title text,
  location text,
  escort_member_id uuid,
  member_ids uuid[],
  recurrence public.event_recurrence,
  recurrence_weekdays smallint[],
  series_starts_at timestamptz
)
language sql
stable
set search_path = ''
as $$
  with me as (
    select m.id as member_id, m.household_id
    from public.household_members m
    where m.id = p_member_id
  ),
  candidates as (
    select
      e.*,
      (
        e.author_member_id is not distinct from me.member_id
        or e.escort_member_id is not distinct from me.member_id
        or exists (
          select 1
          from public.event_members em
          where em.event_id = e.id
            and em.member_id = me.member_id
        )
      ) as involved
    from me
    join public.events e on e.household_id = me.household_id
    where (
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
    o.id,
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
    end,
    case when o.masked then null else o.recurrence end,
    case when o.masked then null else o.recurrence_weekdays end,
    case when o.masked then null else o.starts_at end
  from occurrences o
  where o.occurrence_start < p_to
    and o.occurrence_end > p_from
  order by o.occurrence_start, o.occurrence_end, o.id;
$$;

revoke execute on function private.household_event_rows_for_member(uuid, timestamptz, timestamptz)
  from public, anon, authenticated;

-- Same arguments, columns, rows and order as the version of #229. `create or replace`
-- keeps the owner and the privileges (owner only).
create or replace function private.household_events_for_member(
  p_member_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
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
language sql
stable
set search_path = ''
as $$
  select
    r.id,
    r.starts_at,
    r.ends_at,
    r.visibility,
    r.author_member_id,
    r.is_masked,
    r.title,
    r.location,
    r.escort_member_id,
    r.member_ids
  from private.household_event_rows_for_member(p_member_id, p_from, p_to) as r
  order by r.starts_at, r.ends_at, r.event_id;
$$;

revoke execute on function private.household_events_for_member(uuid, timestamptz, timestamptz)
  from public, anon, authenticated;
