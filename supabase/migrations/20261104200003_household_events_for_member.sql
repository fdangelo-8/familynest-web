-- Issue #229 (for page #39 «Notifiche»): the calendar as one member sees it, for the job
-- «Liberi insieme» of 8:00, which computes the window of each recipient with what that
-- recipient sees (CA-18, CA-19), without a session.
--
-- private.household_events_for_member() holds the query of public.list_household_events()
-- (migration events_exceptions_functions_and_triggers, PR #120) with the member as an
-- argument instead of the caller. public.list_household_events() is replaced by a version
-- that checks the caller and the period exactly as before and then returns the rows of
-- this function for the member of the caller: same arguments, same columns, same rows,
-- same order, and one single place for the visibility rules of the calendar:
-- - events the member sees in full (author, escort or participant, or «Tutto il Nest»):
--   every field;
-- - «Occupato» events of the others: only start, end, visibility and author, with
--   is_masked = true; id, title, location, escort and participants are null;
-- - «Solo io» events of the others: never returned;
-- - removed occurrences are never returned; a modified occurrence is returned at its own
--   times with its own title, place and escort. Notes are never returned.
--
-- The private function trusts its arguments (no check of the period, no session): it is
-- executable only by the database owner (list_household_events is security definer, the
-- jobs run as the owner), never by the API roles (grants below). Security invoker: it
-- reads the tables as the role that runs it (the owner).

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
$$;

revoke execute on function private.household_events_for_member(uuid, timestamptz, timestamptz)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPC: the events of the caller's household that touch a period. Same arguments, same
-- columns, same checks and same errors as the version of PR #120; the rows come from
-- private.household_events_for_member() for the member of the caller.
-- `create or replace` keeps the owner and the execute grants (signed-in users only).
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

  select m.id into v_member_id
  from public.household_members m
  where m.user_id = (select auth.uid());

  if v_member_id is null then
    return;
  end if;

  return query
    select *
    from private.household_events_for_member(v_member_id, p_from, p_to);
end;
$$;
