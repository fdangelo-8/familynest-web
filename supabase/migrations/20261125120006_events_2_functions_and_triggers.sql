-- Issue #510 (DB-1 «Impegni 2.0», plan #501): functions and triggers of the new columns of
-- the events, of event_viewers («Solo alcune persone») and of the new repetitions; the new
-- RPC list_calendar_events(), find_event_conflicts(), list_event_overlaps() and
-- confirm_event_fields(); create_event(), update_event(), update_event_occurrence() and
-- get_event_occurrence() with the new values.
--
-- Conventions (same as the events migrations of #86, #109, #229, #266, #288):
-- - every function has `set search_path = ''` and fully qualified names;
-- - helpers and trigger functions live in the "private" schema (not exposed by the Data
--   API, not in the generated types);
-- - guard triggers are `security invoker` and check the role first, in a statement of its
--   own (lessons of #275 and #288): the Data API roles get the checks, the trusted roles
--   (security definer functions, the administrative key, foreign key actions, the seed)
--   are normalised by the trusted triggers of #288;
-- - one single place for the visibility rules of the calendar:
--   private.household_event_rows_for_member() (LEZIONI). The calendar, «Liberi insieme»,
--   the search and the overlapping events all read it;
-- - the functions that write refuse every Data API method other than POST (lesson of #112).
-- Execute grants and policies are in the events_2_policies_and_grants migration.
--
-- Who is «involved» in an event (sees it in full, and counts as busy): its author, the
-- escort («Lo porta»), the person who picks up («Lo riprende», new), the participants and,
-- for an event «Solo alcune persone», the chosen people. Everybody else in the household
-- sees «Occupato» and «Solo alcune persone» events as «Occupato» (only start, end and
-- author), and never sees «Solo io» events of the others.
--
-- Error codes the app can tell apart (in addition to those of #109):
-- - 23514: «Lo riprende» is a child or a pet; «Tutto il giorno» that does not start and end
--   at 0:00; «Ogni giorno» longer than one day; days of the week missing for «Ogni due
--   settimane» or given to «Ogni giorno»; a person and «Da decidere» together; a reminder
--   outside 1–10080 minutes; a chosen person who is a child or a pet;
-- - 23503: «Lo riprende» or a chosen person of another household;
-- - 42501: only the author sets «Lo riprende» on «Solo io», «Occupato» and «Solo alcune
--   persone» events and chooses the people; «Da verificare» only gets shorter; nothing new
--   on an imported event;
-- - 22023: «Solo alcune persone» without people, or people chosen for another visibility.

-- ===========================================================================
-- Helpers used by the RLS policies (security definer: no policy reads another table
-- directly, so the policies never call each other).
-- ===========================================================================

-- True when the caller is one of the people chosen for the event («Solo alcune persone»).
create or replace function private.is_event_viewer(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.event_viewers v
    join public.household_members m on m.id = v.member_id
    where v.event_id = p_event_id
      and m.user_id = (select auth.uid())
  );
$$;

-- True when the caller is the author of the event.
create or replace function private.is_event_author(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.events e
    join public.household_members me on me.id = e.author_member_id
    where e.id = p_event_id
      and me.user_id = (select auth.uid())
  );
$$;

-- True when the caller may see the event in full (same rule as the select policy of
-- events): «Tutto il Nest», or the caller is its author, escort, pickup, a participant or,
-- for «Solo alcune persone», a chosen person.
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
        or e.pickup_member_id = me.id
        or exists (
          select 1
          from public.event_members em
          where em.event_id = e.id
            and em.member_id = me.id
        )
        or (
          e.visibility = 'selected'
          and exists (
            select 1
            from public.event_viewers v
            where v.event_id = e.id
              and v.member_id = me.id
          )
        )
      )
  );
$$;

-- ===========================================================================
-- events: normalisation and guards
-- ===========================================================================

-- Shared by insert and update (same function as #109, with «Lo riprende» and «Da
-- verificare»): trims the texts, sorts the days of the week and the fields to verify, and
-- checks that the escort and the pickup are adults. A pickup of another household is
-- refused by the composite foreign key (23503).
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

  if p_event.unverified_fields is not null then
    p_event.unverified_fields := coalesce(
      (select array_agg(distinct f order by f) from unnest(p_event.unverified_fields) as f),
      array[]::public.event_field[]
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

  if p_event.pickup_member_id is not null and exists (
    select 1
    from public.household_members m
    where m.id = p_event.pickup_member_id
      and m.household_id = p_event.household_id
      and m.kind <> 'adult'
  ) then
    raise exception 'the pickup must be an adult of the household' using errcode = '23514';
  end if;

  return p_event;
end;
$$;

-- Household, author and creation time never change; only the author changes who sees the
-- event. On «Solo io», «Occupato» and «Solo alcune persone» events only the author sets a
-- new escort or a new pickup (it would widen who sees the event); removing them stays
-- allowed. «Da verificare» only gets shorter (confirmed fields go away, none is added).
create or replace function private.events_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Trusted roles: normalised by events_before_write_trusted (#288).
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

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

  if new.escort_member_id is not null
     and new.escort_member_id is distinct from old.escort_member_id
     and not private.can_manage_event_people(old.id) then
    raise exception 'only the author can add people to this event' using errcode = '42501';
  end if;

  if new.pickup_member_id is not null
     and new.pickup_member_id is distinct from old.pickup_member_id
     and not private.can_manage_event_people(old.id) then
    raise exception 'only the author can add people to this event' using errcode = '42501';
  end if;

  if new.unverified_fields is null
     or not (new.unverified_fields <@ old.unverified_fields) then
    raise exception 'the fields to verify can only be confirmed' using errcode = '42501';
  end if;

  new := private.events_normalize(new);
  return new;
end;
$$;

-- Imported events are read only (#34 §15), new version of #266 with the new columns: for
-- the Data API roles, title, place, times, repetition, notes, escort, «Tutto il giorno»,
-- «Lo riprende», «Da decidere», «Avviso» and «Avvisa chi porta e chi riprende» never
-- change (42501); only the visibility changes (only the author: events_before_update),
-- never to «Tutto il Nest» for an event private at the provider and never to «Solo
-- alcune persone»; nobody deletes it.
create or replace function private.events_guard_imported()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if not private.is_imported_event(old.id) then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    raise exception 'imported events are deleted on their calendar' using errcode = '42501';
  end if;

  if new.title is distinct from old.title
     or new.location is distinct from old.location
     or new.notes is distinct from old.notes
     or new.starts_at is distinct from old.starts_at
     or new.ends_at is distinct from old.ends_at
     or new.recurrence is distinct from old.recurrence
     or new.recurrence_weekdays is distinct from old.recurrence_weekdays
     or new.recurrence_until is distinct from old.recurrence_until
     or new.escort_member_id is distinct from old.escort_member_id
     or new.all_day is distinct from old.all_day
     or new.pickup_member_id is distinct from old.pickup_member_id
     or new.escort_undecided is distinct from old.escort_undecided
     or new.pickup_undecided is distinct from old.pickup_undecided
     or new.reminder_minutes_before is distinct from old.reminder_minutes_before
     or new.remind_rides is distinct from old.remind_rides then
    raise exception 'imported events change only on their calendar' using errcode = '42501';
  end if;

  if new.visibility is distinct from old.visibility then
    if new.visibility = 'selected' then
      raise exception 'an imported event cannot be shown only to some people' using errcode = '42501';
    end if;
    if new.visibility = 'household' and private.is_private_imported_event(old.id) then
      raise exception 'an event private on its calendar is never shown to everyone' using errcode = '42501';
    end if;
    perform private.mark_imported_visibility_overridden(old.id);
  end if;

  return new;
end;
$$;

-- An event changes who sees it (only its author can do it):
-- - it is no longer «Solo alcune persone»: the chosen people are removed (nobody is chosen
--   for another visibility; choosing again starts from nobody);
-- - it becomes «Solo io», «Occupato» or «Solo alcune persone»: the escort and the pickup
--   of a changed occurrence who do not see the event in full any more are removed from
--   that occurrence, so that an occurrence never names someone who cannot see it.
-- Security invoker (as in #109): the author sees the exceptions and the chosen people and
-- may change them. No private helper is called (it also runs for the trusted roles).
create or replace function private.events_after_update_visibility()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.visibility = 'selected' and new.visibility is distinct from 'selected' then
    delete from public.event_viewers v
    where v.event_id = new.id;
  end if;

  if new.visibility <> 'household' and new.visibility is distinct from old.visibility then
    update public.event_exceptions x
    set escort_member_id = null
    where x.event_id = new.id
      and x.escort_member_id is not null
      and x.escort_member_id is distinct from new.author_member_id
      and x.escort_member_id is distinct from new.escort_member_id
      and x.escort_member_id is distinct from new.pickup_member_id
      and not exists (
        select 1
        from public.event_members em
        where em.event_id = new.id
          and em.member_id = x.escort_member_id
      )
      and not exists (
        select 1
        from public.event_viewers v
        where new.visibility = 'selected'
          and v.event_id = new.id
          and v.member_id = x.escort_member_id
      );

    update public.event_exceptions x
    set pickup_member_id = null
    where x.event_id = new.id
      and x.pickup_member_id is not null
      and x.pickup_member_id is distinct from new.author_member_id
      and x.pickup_member_id is distinct from new.escort_member_id
      and x.pickup_member_id is distinct from new.pickup_member_id
      and not exists (
        select 1
        from public.event_members em
        where em.event_id = new.id
          and em.member_id = x.pickup_member_id
      )
      and not exists (
        select 1
        from public.event_viewers v
        where new.visibility = 'selected'
          and v.event_id = new.id
          and v.member_id = x.pickup_member_id
      );
  end if;
  return null;
end;
$$;

-- ===========================================================================
-- event_viewers: only adults of the household, only on «Solo alcune persone» events.
-- Who may choose (the author) is the insert policy. Security invoker; no private helper
-- (it also runs for the trusted roles, lesson of #275).
-- ===========================================================================
create or replace function private.event_viewers_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_visibility public.event_visibility;
begin
  if current_user in ('authenticated', 'anon') then
    -- Checked first, so that a refused insert into another household never reveals
    -- anything about its events or members.
    if new.household_id is distinct from (select public.current_household_id()) then
      raise exception 'new row violates row-level security policy for table "event_viewers"'
        using errcode = '42501';
    end if;
    new.created_at := now();
  end if;

  select e.visibility into v_visibility
  from public.events e
  where e.id = new.event_id
    and e.household_id = new.household_id;

  if not found then
    if current_user in ('authenticated', 'anon') then
      raise exception 'new row violates row-level security policy for table "event_viewers"'
        using errcode = '42501';
    end if;
    -- Trusted roles: the composite foreign key refuses it (23503).
    return new;
  end if;

  if v_visibility <> 'selected' then
    raise exception 'people are chosen only for events «Solo alcune persone»' using errcode = '22023';
  end if;

  -- A person of another household is refused by the composite foreign key (23503).
  if exists (
    select 1
    from public.household_members m
    where m.id = new.member_id
      and m.household_id = new.household_id
      and m.kind <> 'adult'
  ) then
    raise exception 'only adults of the household can be chosen' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger event_viewers_before_insert
  before insert on public.event_viewers
  for each row execute function private.event_viewers_before_insert();

-- An event «Solo alcune persone» keeps at least one chosen person also when the author
-- removes them from the table (the same rule as create_event and update_event: 22023).
-- Only for the Data API roles: when the event goes, changes visibility or a person leaves
-- the household, the rows go with the trusted roles or the event is no longer «Solo
-- alcune persone». Security invoker (only the author deletes rows); no private helper.
create or replace function private.event_viewers_after_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return null;
  end if;

  if exists (
    select 1
    from public.events e
    where e.id = old.event_id
      and e.visibility = 'selected'
  ) and not exists (
    select 1
    from public.event_viewers v
    where v.event_id = old.event_id
  ) then
    raise exception 'invalid chosen people' using errcode = '22023';
  end if;

  return null;
end;
$$;

create trigger event_viewers_after_delete
  after delete on public.event_viewers
  for each row execute function private.event_viewers_after_delete();

-- ===========================================================================
-- Repetitions
-- ===========================================================================

-- Start instants of the occurrences of an event that start between p_from and p_to (a few
-- occurrences just outside may be returned: the caller filters exactly). Same function
-- as #86 with the new rules. Occurrences keep the local time of the first one in
-- Europe/Rome (17:00 stays 17:00 across daylight saving time changes):
-- - none:     the event itself;
-- - daily:    every day, from the first occurrence on;
-- - weekly:   every listed day of the week, from the first occurrence on;
-- - biweekly: the listed days of the week of the ISO week (Monday to Sunday) of the first
--             occurrence, then one week yes and one no;
-- - monthly:  the same day of the month as the first occurrence; months without that day
--             (for example the 31st) are skipped;
-- - yearly:   the same day and month as the first occurrence; the 29th of February only
--             in leap years;
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
  where p_recurrence = 'daily'
    or (
      p_recurrence = 'weekly'
      and extract(isodow from d)::smallint = any (p_weekdays)
    )
    or (
      p_recurrence = 'biweekly'
      and extract(isodow from d)::smallint = any (p_weekdays)
      -- Monday of the week of d minus Monday of the week of the first occurrence: an even
      -- number of weeks.
      and (
        (d::date - (extract(isodow from d)::integer - 1))
        - (
          (p_starts_at at time zone 'Europe/Rome')::date
          - (extract(isodow from (p_starts_at at time zone 'Europe/Rome'))::integer - 1)
        )
      ) % 14 = 0
    )
    or (
      p_recurrence = 'monthly'
      and extract(day from d) = extract(day from (p_starts_at at time zone 'Europe/Rome'))
    )
    or (
      p_recurrence = 'yearly'
      and extract(day from d) = extract(day from (p_starts_at at time zone 'Europe/Rome'))
      and extract(month from d) = extract(month from (p_starts_at at time zone 'Europe/Rome'))
    );
$$;

-- The occurrences of one event that overlap [p_from, p_to), exceptions applied (new
-- version of #109). Two changes:
-- - p_all_day: an occurrence of an event «tutto il giorno» ends at 0:00 (Europe/Rome) of
--   the same number of days after its start as the first occurrence (not the same number
--   of hours: the clock may change in between);
-- - three more columns: pickup_member_id, escort_undecided and pickup_undecided of a
--   modified occurrence (null for regular occurrences: the caller takes them from the
--   series, as title, place, notes and escort).
-- The return type of a function cannot change with `create or replace`: dropped and
-- created again (grants in the policies migration). The existing callers pass eight
-- arguments and get p_all_day = false, as before.
drop function private.event_occurrences(
  uuid, timestamptz, timestamptz, public.event_recurrence, smallint[], date, timestamptz, timestamptz
);

create function private.event_occurrences(
  p_event_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_recurrence public.event_recurrence,
  p_weekdays smallint[],
  p_until date,
  p_from timestamptz,
  p_to timestamptz,
  p_all_day boolean default false
)
returns table (
  occurrence_date date,
  starts_at timestamptz,
  ends_at timestamptz,
  is_modified boolean,
  title text,
  location text,
  notes text,
  escort_member_id uuid,
  pickup_member_id uuid,
  escort_undecided boolean,
  pickup_undecided boolean
)
language sql
stable
set search_path = ''
as $$
  select
    r.occurrence_date,
    r.occurrence_start,
    r.occurrence_end,
    false,
    null::text,
    null::text,
    null::text,
    null::uuid,
    null::uuid,
    null::boolean,
    null::boolean
  from (
    select
      s.occurrence_start,
      (s.occurrence_start at time zone 'Europe/Rome')::date as occurrence_date,
      case
        when coalesce(p_all_day, false) then
          (
            (s.occurrence_start at time zone 'Europe/Rome')::date
            + ((p_ends_at at time zone 'Europe/Rome')::date - (p_starts_at at time zone 'Europe/Rome')::date)
          )::timestamp at time zone 'Europe/Rome'
        else s.occurrence_start + (p_ends_at - p_starts_at)
      end as occurrence_end
    from private.event_occurrence_starts(
      p_starts_at,
      p_recurrence,
      p_weekdays,
      p_until,
      p_from - (p_ends_at - p_starts_at) - interval '1 hour',
      p_to
    ) as s (occurrence_start)
  ) r
  where r.occurrence_start < p_to
    and r.occurrence_end > p_from
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
    x.escort_member_id,
    x.pickup_member_id,
    x.escort_undecided,
    x.pickup_undecided
  from public.event_exceptions x
  where p_recurrence <> 'none'
    and x.event_id = p_event_id
    and not x.is_cancelled
    and x.starts_at < p_to
    and x.ends_at > p_from
    and private.event_has_occurrence_on(p_starts_at, p_recurrence, p_weekdays, p_until, x.occurrence_date);
$$;

-- ===========================================================================
-- event_exceptions: normalisation and guards (new version of #109 with «Lo riprende»,
-- «Da decidere» and «Tutto il giorno»). One argument more, the previous pickup, so the
-- function is dropped and created again; the three trigger functions that call it are
-- replaced below with the same rules.
-- - a removed occurrence has no pickup and nothing «Da decidere»;
-- - the escort and the pickup of one occurrence are adults of the household and, on «Solo
--   io», «Occupato» and «Solo alcune persone» events, people who already see the event in
--   full (author, escort, pickup, participants and chosen people of the series): an
--   exception never widens who sees an event. Checked only when they change;
-- - an occurrence of an event «tutto il giorno» starts and ends at 0:00 (Europe/Rome).
-- ===========================================================================
create function private.event_exceptions_normalize(
  p_row public.event_exceptions,
  p_old_escort_member_id uuid,
  p_old_pickup_member_id uuid,
  p_old_starts_at timestamptz
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

  if p_row.is_cancelled then
    p_row.pickup_member_id := null;
    p_row.escort_undecided := false;
    p_row.pickup_undecided := false;
  end if;

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
       and p_row.escort_member_id is distinct from v_event.pickup_member_id
       and not exists (
         select 1
         from public.event_members em
         where em.event_id = v_event.id
           and em.member_id = p_row.escort_member_id
       )
       and not exists (
         select 1
         from public.event_viewers v
         where v_event.visibility = 'selected'
           and v.event_id = v_event.id
           and v.member_id = p_row.escort_member_id
       ) then
      raise exception 'the escort of one occurrence must already see the event' using errcode = '42501';
    end if;
  end if;

  if p_row.pickup_member_id is not null
     and p_row.pickup_member_id is distinct from p_old_pickup_member_id then
    -- A person of another household is refused by the composite foreign key (23503).
    if exists (
      select 1
      from public.household_members m
      where m.id = p_row.pickup_member_id
        and m.household_id = p_row.household_id
        and m.kind <> 'adult'
    ) then
      raise exception 'the pickup must be an adult of the household' using errcode = '23514';
    end if;

    if v_event.visibility <> 'household'
       and p_row.pickup_member_id is distinct from v_event.author_member_id
       and p_row.pickup_member_id is distinct from v_event.escort_member_id
       and p_row.pickup_member_id is distinct from v_event.pickup_member_id
       and not exists (
         select 1
         from public.event_members em
         where em.event_id = v_event.id
           and em.member_id = p_row.pickup_member_id
       )
       and not exists (
         select 1
         from public.event_viewers v
         where v_event.visibility = 'selected'
           and v.event_id = v_event.id
           and v.member_id = p_row.pickup_member_id
       ) then
      raise exception 'the pickup of one occurrence must already see the event' using errcode = '42501';
    end if;
  end if;

  if v_event.all_day
     and not p_row.is_cancelled
     and (
       (p_row.starts_at at time zone 'Europe/Rome')::time <> time '00:00'
       or (p_row.ends_at at time zone 'Europe/Rome')::time <> time '00:00'
     ) then
    raise exception 'an occurrence of an event «tutto il giorno» starts and ends at 0:00' using errcode = '23514';
  end if;

  if current_user in ('authenticated', 'anon')
     and not p_row.is_cancelled
     and p_row.starts_at is not null
     and (
       p_old_starts_at is null
       or (p_old_starts_at at time zone 'Europe/Rome')::date
          <> (p_row.starts_at at time zone 'Europe/Rome')::date
     )
     and exists (
       select 1
       from private.event_occurrences(
         v_event.id, v_event.starts_at, v_event.ends_at, v_event.recurrence,
         v_event.recurrence_weekdays, v_event.recurrence_until,
         ((p_row.starts_at at time zone 'Europe/Rome')::date)::timestamp at time zone 'Europe/Rome',
         ((p_row.starts_at at time zone 'Europe/Rome')::date + 1)::timestamp at time zone 'Europe/Rome',
         v_event.all_day
       ) o
       where o.occurrence_date <> p_row.occurrence_date
         and (o.starts_at at time zone 'Europe/Rome')::date = (p_row.starts_at at time zone 'Europe/Rome')::date
     ) then
    raise exception 'another occurrence of the event starts on that day' using errcode = 'P0001';
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
  -- Trusted roles: normalised and checked by event_exceptions_before_write_trusted (#288).
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  -- Checked first, so that a refused insert into another household never reveals
  -- anything about its events.
  v_household_id := (select public.current_household_id());
  if v_household_id is null or new.household_id is distinct from v_household_id then
    raise exception 'new row violates row-level security policy for table "event_exceptions"'
      using errcode = '42501';
  end if;

  new.created_at := now();
  new.updated_at := now();

  new := private.event_exceptions_normalize(new, null, null, null);
  return new;
end;
$$;

-- Event, household, day and creation time never change.
create or replace function private.event_exceptions_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Trusted roles: normalised and checked by event_exceptions_before_write_trusted (#288).
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if new.event_id is distinct from old.event_id
     or new.household_id is distinct from old.household_id
     or new.occurrence_date is distinct from old.occurrence_date
     or new.created_at is distinct from old.created_at then
    raise exception 'this exception field cannot be changed' using errcode = '42501';
  end if;

  new := private.event_exceptions_normalize(new, old.escort_member_id, old.pickup_member_id, old.starts_at);
  return new;
end;
$$;

create or replace function private.event_exceptions_before_write_trusted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new := private.event_exceptions_normalize(new, null, null, null);
  else
    new := private.event_exceptions_normalize(new, old.escort_member_id, old.pickup_member_id, old.starts_at);
  end if;
  return new;
end;
$$;

drop function private.event_exceptions_normalize(public.event_exceptions, uuid, timestamptz);

-- ===========================================================================
-- The rows of the calendar as one member sees it: the single place of the visibility
-- rules (new version of #266). Same arguments, same rows and order, the same columns plus
-- the new ones at the end. Changes:
-- - «Lo riprende» and, for «Solo alcune persone», the chosen people are involved: they see
--   the event in full;
-- - «Solo alcune persone» of the others: masked exactly as «Occupato», visibility
--   included ('busy'): the others never learn that some people were chosen;
-- - an event «tutto il giorno» never counts for «Liberi insieme»;
-- - the occurrences of an event «tutto il giorno» end at 0:00.
-- New columns:
-- - occurrence_date, all_day: always present, also for masked rows, like event_id: only for
--   the functions of the database (the overlapping events); they never leave the database
--   for a masked row;
-- - pickup_member_id, escort_undecided, pickup_undecided (of the occurrence),
--   reminder_minutes_before, remind_rides, unverified_fields: null for masked rows;
-- - viewer_ids: the chosen people (in the order of the household members), only for the
--   author, never on a masked row; null for everybody else.
-- Owner only, security invoker, trusts its arguments (as before).
-- ===========================================================================
drop function private.household_event_rows_for_member(uuid, timestamptz, timestamptz);

create function private.household_event_rows_for_member(
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
  series_starts_at timestamptz,
  source_provider public.calendar_provider,
  is_imported boolean,
  counts_for_free_time boolean,
  occurrence_date date,
  all_day boolean,
  pickup_member_id uuid,
  escort_undecided boolean,
  pickup_undecided boolean,
  reminder_minutes_before integer,
  remind_rides boolean,
  unverified_fields public.event_field[],
  viewer_ids uuid[]
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
        or e.pickup_member_id is not distinct from me.member_id
        or exists (
          select 1
          from public.event_members em
          where em.event_id = e.id
            and em.member_id = me.member_id
        )
        or (
          e.visibility = 'selected'
          and exists (
            select 1
            from public.event_viewers v
            where v.event_id = e.id
              and v.member_id = me.member_id
          )
        )
      ) as involved,
      src.provider as import_provider,
      src.counts as import_counts
    from me
    join public.events e on e.household_id = me.household_id
    left join lateral (
      select
        a.provider,
        (c.counts_for_free_time and l.is_busy_on_provider) as counts
      from public.event_external_links l
      join public.external_calendars c on c.id = l.calendar_id
      join public.calendar_accounts a on a.id = c.account_id
      where l.event_id = e.id
        and l.origin = 'imported'
    ) src on true
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
      o.occurrence_date,
      o.occurrence_start,
      o.occurrence_end,
      o.is_modified,
      o.occurrence_title,
      o.occurrence_location,
      o.occurrence_escort_member_id,
      o.occurrence_pickup_member_id,
      o.occurrence_escort_undecided,
      o.occurrence_pickup_undecided
    from visible v
    cross join lateral private.event_occurrences(
      v.id,
      v.starts_at,
      v.ends_at,
      v.recurrence,
      v.recurrence_weekdays,
      v.recurrence_until,
      p_from,
      p_to,
      v.all_day
    ) as o (
      occurrence_date,
      occurrence_start,
      occurrence_end,
      is_modified,
      occurrence_title,
      occurrence_location,
      occurrence_notes,
      occurrence_escort_member_id,
      occurrence_pickup_member_id,
      occurrence_escort_undecided,
      occurrence_pickup_undecided
    )
  )
  select
    o.id,
    case when o.masked then null else o.id end,
    o.occurrence_start,
    o.occurrence_end,
    case when o.masked and o.visibility = 'selected' then 'busy'::public.event_visibility else o.visibility end,
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
    case when o.masked then null else o.starts_at end,
    -- Fail closed: the provider only to the author, never on a masked row.
    case
      when not o.masked and o.author_member_id is not distinct from p_member_id then o.import_provider
    end,
    case when o.masked then null else o.import_provider is not null end,
    coalesce(o.import_counts, true) and not o.all_day,
    o.occurrence_date,
    o.all_day,
    case
      when o.masked then null
      when o.is_modified then o.occurrence_pickup_member_id
      else o.pickup_member_id
    end,
    case
      when o.masked then null
      when o.is_modified then o.occurrence_escort_undecided
      else o.escort_undecided
    end,
    case
      when o.masked then null
      when o.is_modified then o.occurrence_pickup_undecided
      else o.pickup_undecided
    end,
    case when o.masked then null else o.reminder_minutes_before end,
    case when o.masked then null else o.remind_rides end,
    case when o.masked then null else o.unverified_fields end,
    -- Fail closed: the chosen people only to the author, never on a masked row.
    case
      when not o.masked and o.author_member_id is not distinct from p_member_id then coalesce(
        (
          select array_agg(v.member_id order by m.created_at, m.id)
          from public.event_viewers v
          join public.household_members m on m.id = v.member_id
          where v.event_id = o.id
        ),
        array[]::uuid[]
      )
    end
  from occurrences o
  where o.occurrence_start < p_to
    and o.occurrence_end > p_from
  order by o.occurrence_start, o.occurrence_end, o.id;
$$;

-- ===========================================================================
-- «Liberi insieme» of one evening as one member sees it (new version of #266, same
-- arguments, result and rules): «Lo riprende» busies the person who picks up, like «Lo
-- porta»; the author of an event «Solo alcune persone» is busy like the author of an
-- «Occupato»; an event «tutto il giorno» busies nobody (counts_for_free_time). The chosen
-- people only see the event: they are not busy because of it.
-- ===========================================================================
create or replace function private.free_together_start(p_member_id uuid, p_day date)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  with bounds as (
    select
      ((p_day - (extract(isodow from p_day)::integer - 1))::timestamp at time zone 'Europe/Rome') as week_from,
      ((p_day - (extract(isodow from p_day)::integer - 1) + 7)::timestamp at time zone 'Europe/Rome') as week_to,
      ((p_day + time '18:00') at time zone 'Europe/Rome') as evening_from,
      ((p_day + time '23:00') at time zone 'Europe/Rome') as evening_to
  ),
  adults as (
    select a.id
    from public.household_members me
    join public.household_members a on a.household_id = me.household_id and a.kind = 'adult'
    where me.id = p_member_id
  ),
  seen as (
    select s.*
    from bounds b
    cross join lateral private.household_event_rows_for_member(p_member_id, b.week_from, b.week_to) s
  ),
  busy as (
    select tstzrange(greatest(s.starts_at, b.evening_from), least(s.ends_at, b.evening_to)) as span
    from seen s
    cross join bounds b
    where s.starts_at < b.evening_to
      and s.ends_at > b.evening_from
      and s.counts_for_free_time
      and exists (
        select 1
        from adults a
        where case
          when s.is_masked then s.author_member_id = a.id
          when s.visibility = 'private' then false
          else a.id = any (s.member_ids)
            or s.escort_member_id is not distinct from a.id
            or s.pickup_member_id is not distinct from a.id
            or (s.visibility in ('busy', 'selected') and s.author_member_id is not distinct from a.id)
        end
      )
  ),
  free as (
    select f.span
    from bounds b
    cross join lateral unnest(
      tstzmultirange(tstzrange(b.evening_from, b.evening_to))
      - coalesce((select range_agg(x.span) from busy x), '{}'::tstzmultirange)
    ) as f (span)
  )
  select lower(f.span)
  from free f
  where (select count(*) from adults) >= 2
    and exists (select 1 from seen)
    and upper(f.span) - lower(f.span) >= interval '60 minutes'
  order by upper(f.span) - lower(f.span) desc, lower(f.span)
  limit 1;
$$;

-- ===========================================================================
-- «Cambio d'orario»: the person who picks up is notified like the escort (new versions
-- of #229, same rules otherwise).
-- ===========================================================================
create or replace function private.events_notify_time_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
begin
  v_actor := private.notification_actor(new.household_id);
  if v_actor is null then
    return null;
  end if;

  insert into public.notifications (household_id, recipient_member_id, kind, actor_member_id, event_id)
  select new.household_id, r.member_id, 'event_time_changed', v_actor, new.id
  from (
    select new.author_member_id as member_id
    union
    select new.escort_member_id
    union
    select new.pickup_member_id
    union
    select em.member_id
    from public.event_members em
    where em.event_id = new.id
  ) r
  where r.member_id is not null
    and r.member_id <> v_actor
    and private.notification_recipient_wants(r.member_id, 'events');

  return null;
end;
$$;

create or replace function private.event_exceptions_notify_time_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_event public.events;
  v_before_start timestamptz;
  v_before_end timestamptz;
begin
  if new.is_cancelled or new.starts_at is null or new.ends_at is null then
    return null;
  end if;

  v_actor := private.notification_actor(new.household_id);
  if v_actor is null then
    return null;
  end if;

  select e.* into v_event
  from public.events e
  where e.id = new.event_id;
  if not found then
    return null;
  end if;

  if tg_op = 'UPDATE' then
    if not old.is_cancelled and old.starts_at is not null then
      v_before_start := old.starts_at;
      v_before_end := old.ends_at;
    end if;
  end if;
  if v_before_start is null then
    -- Same local time as every occurrence of the series (event_occurrence_starts).
    v_before_start := (new.occurrence_date + (v_event.starts_at at time zone 'Europe/Rome')::time)
      at time zone 'Europe/Rome';
    if v_event.all_day then
      v_before_end := (
        new.occurrence_date
        + ((v_event.ends_at at time zone 'Europe/Rome')::date - (v_event.starts_at at time zone 'Europe/Rome')::date)
      )::timestamp at time zone 'Europe/Rome';
    else
      v_before_end := v_before_start + (v_event.ends_at - v_event.starts_at);
    end if;
  end if;

  if new.starts_at = v_before_start and new.ends_at = v_before_end then
    return null;
  end if;

  insert into public.notifications (
    household_id, recipient_member_id, kind, actor_member_id, event_id, occurrence_date
  )
  select new.household_id, r.member_id, 'event_time_changed', v_actor, new.event_id, new.occurrence_date
  from (
    select v_event.author_member_id as member_id
    union
    select v_event.escort_member_id
    union
    select v_event.pickup_member_id
    union
    select new.escort_member_id
    union
    select new.pickup_member_id
    union
    select em.member_id
    from public.event_members em
    where em.event_id = new.event_id
  ) r
  where r.member_id is not null
    and r.member_id <> v_actor
    and private.notification_recipient_wants(r.member_id, 'events');

  return null;
end;
$$;

-- ===========================================================================
-- «Tutti i prossimi» on an occurrence after the first one: the series is split in two
-- (new version of #109, same rules). The copy also keeps «Tutto il giorno», «Lo
-- riprende», «Da decidere», «Avviso», «Avvisa chi porta e chi riprende», «Da verificare»
-- and the chosen people. Security definer only because the copy must keep the author.
-- ===========================================================================
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
  v_end timestamptz;
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
  if v_event.all_day then
    v_end := (
      p_day + ((v_event.ends_at at time zone 'Europe/Rome')::date - (v_event.starts_at at time zone 'Europe/Rome')::date)
    )::timestamp at time zone 'Europe/Rome';
  else
    v_end := v_start + (v_event.ends_at - v_event.starts_at);
  end if;

  insert into public.events (
    household_id, author_member_id, title, location, notes, starts_at, ends_at, visibility,
    escort_member_id, recurrence, recurrence_weekdays, recurrence_until,
    all_day, pickup_member_id, escort_undecided, pickup_undecided, reminder_minutes_before,
    remind_rides, unverified_fields
  )
  values (
    v_event.household_id, v_event.author_member_id, v_event.title, v_event.location, v_event.notes,
    v_start, v_end, v_event.visibility,
    v_event.escort_member_id, v_event.recurrence, v_event.recurrence_weekdays, v_event.recurrence_until,
    v_event.all_day, v_event.pickup_member_id, v_event.escort_undecided, v_event.pickup_undecided,
    v_event.reminder_minutes_before, v_event.remind_rides, v_event.unverified_fields
  )
  returning id into v_new_id;

  insert into public.event_members (event_id, member_id, household_id)
  select v_new_id, em.member_id, em.household_id
  from public.event_members em
  where em.event_id = p_event_id;

  insert into public.event_viewers (event_id, member_id, household_id)
  select v_new_id, v.member_id, v.household_id
  from public.event_viewers v
  where v.event_id = p_event_id;

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

-- ===========================================================================
-- RPC: one occurrence of an event, for the detail page (new version of #109: same
-- arguments, rules and rows; the end of an occurrence «tutto il giorno» at 0:00; eight
-- more columns at the end):
-- - all_day, reminder_minutes_before, remind_rides, unverified_fields: the series;
-- - pickup_member_id, escort_undecided, pickup_undecided: this occurrence (its own values
--   when is_modified, otherwise those of the series);
-- - viewer_ids: the chosen people (order of the household members), only for the author;
--   null for everybody else.
-- The return type changes: dropped and created again (grants in the policies migration).
-- Security invoker: the RLS policies decide what the caller reads.
-- ===========================================================================
drop function public.get_event_occurrence(uuid, date);

create function public.get_event_occurrence(p_event_id uuid, p_day date default null)
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
  is_modified boolean,
  all_day boolean,
  pickup_member_id uuid,
  escort_undecided boolean,
  pickup_undecided boolean,
  reminder_minutes_before integer,
  remind_rides boolean,
  unverified_fields public.event_field[],
  viewer_ids uuid[]
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
  v_member_id uuid;
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
      (p_day + 1)::timestamp at time zone 'Europe/Rome',
      v_event.all_day
    ) o
    where (o.starts_at at time zone 'Europe/Rome')::date = p_day
    order by o.starts_at, o.occurrence_date
    limit 1;
  elsif v_event.recurrence = 'none' then
    select o.* into v_occurrence
    from private.event_occurrences(
      v_event.id, v_event.starts_at, v_event.ends_at, v_event.recurrence,
      v_event.recurrence_weekdays, v_event.recurrence_until,
      v_event.starts_at, v_event.ends_at,
      v_event.all_day
    ) o
    limit 1;
  else
    -- In progress or next.
    v_horizon := greatest(now(), v_event.starts_at) + interval '400 days';
    select o.* into v_occurrence
    from private.event_occurrences(
      v_event.id, v_event.starts_at, v_event.ends_at, v_event.recurrence,
      v_event.recurrence_weekdays, v_event.recurrence_until,
      now(), v_horizon,
      v_event.all_day
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
        (v_upper + 1)::timestamp at time zone 'Europe/Rome',
        v_event.all_day
      ) o
      order by o.starts_at desc, o.occurrence_date desc
      limit 1;
    end if;
  end if;

  if not found then
    return;
  end if;

  v_member_id := (select private.current_member_id());

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
      v_occurrence.is_modified::boolean,
      v_event.all_day,
      case
        when v_occurrence.is_modified then v_occurrence.pickup_member_id::uuid
        else v_event.pickup_member_id
      end,
      case
        when v_occurrence.is_modified then v_occurrence.escort_undecided::boolean
        else v_event.escort_undecided
      end,
      case
        when v_occurrence.is_modified then v_occurrence.pickup_undecided::boolean
        else v_event.pickup_undecided
      end,
      v_event.reminder_minutes_before,
      v_event.remind_rides,
      v_event.unverified_fields,
      case
        when v_member_id is not null and v_event.author_member_id = v_member_id then coalesce(
          (
            select array_agg(v.member_id order by m.created_at, m.id)
            from public.event_viewers v
            join public.household_members m on m.id = v.member_id
            where v.event_id = v_event.id
          ),
          array[]::uuid[]
        )
      end;
end;
$$;

-- ===========================================================================
-- RPC: a new event with its participants and its chosen people, in one transaction (new
-- version of #109: the same eleven arguments, then the new ones with defaults, so every
-- call of today stays valid). The old signature is dropped (two signatures would make
-- the calls ambiguous).
-- - p_viewer_ids: the chosen people of «Solo alcune persone»: required (at least one) for
--   that visibility, refused for the others (22023). Duplicates count once. Only adults
--   of the household (23514; another household: 23503).
-- Everything else as before (author and household set by the database, every rule of the
-- events applies; one error and nothing is created).
-- ===========================================================================
drop function public.create_event(
  text, timestamptz, timestamptz, public.event_visibility, uuid[], text, uuid,
  public.event_recurrence, smallint[], date, text
);

create function public.create_event(
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
  p_notes text default null,
  p_all_day boolean default false,
  p_pickup_member_id uuid default null,
  p_escort_undecided boolean default false,
  p_pickup_undecided boolean default false,
  p_reminder_minutes_before integer default null,
  p_remind_rides boolean default false,
  p_unverified_fields public.event_field[] default '{}',
  p_viewer_ids uuid[] default null
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

  if array_position(p_viewer_ids, null) is not null
     or (p_visibility = 'selected' and coalesce(cardinality(p_viewer_ids), 0) = 0)
     or (p_visibility is distinct from 'selected' and coalesce(cardinality(p_viewer_ids), 0) > 0) then
    raise exception 'invalid chosen people' using errcode = '22023';
  end if;

  insert into public.events (
    title, location, notes, starts_at, ends_at, visibility, escort_member_id,
    recurrence, recurrence_weekdays, recurrence_until,
    all_day, pickup_member_id, escort_undecided, pickup_undecided, reminder_minutes_before,
    remind_rides, unverified_fields
  )
  values (
    p_title, p_location, p_notes, p_starts_at, p_ends_at, p_visibility, p_escort_member_id,
    p_recurrence, p_recurrence_weekdays, p_recurrence_until,
    coalesce(p_all_day, false), p_pickup_member_id, coalesce(p_escort_undecided, false),
    coalesce(p_pickup_undecided, false), p_reminder_minutes_before, coalesce(p_remind_rides, false),
    coalesce(p_unverified_fields, array[]::public.event_field[])
  )
  returning id into v_id;

  insert into public.event_members (event_id, member_id)
  select distinct v_id, m.member_id
  from unnest(coalesce(p_member_ids, array[]::uuid[])) as m (member_id);

  insert into public.event_viewers (event_id, member_id)
  select distinct v_id, v.member_id
  from unnest(coalesce(p_viewer_ids, array[]::uuid[])) as v (member_id);

  return v_id;
end;
$$;

-- ===========================================================================
-- RPC: change a whole event, or a repeated event from one occurrence on («Salva tutti i
-- prossimi»), in one transaction (new version of #122: the same thirteen arguments and
-- rules, then the new values with defaults). The old signature is dropped.
-- New rules:
-- - «Ogni due settimane» keeps its rhythm like «Ogni settimana» (same days of the week
--   moved by the shift);
-- - p_viewer_ids: null keeps the chosen people (for «Solo alcune persone»); a list is the
--   new choice. Only the author changes them (42501). After the change an event «Solo
--   alcune persone» has at least one chosen person and the others have none (22023);
--   leaving «Solo alcune persone» removes them (trigger).
-- ===========================================================================
drop function public.update_event(
  uuid, date, text, timestamptz, timestamptz, public.event_visibility, uuid[], text, uuid,
  public.event_recurrence, smallint[], date, text
);

create function public.update_event(
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
  p_notes text,
  p_all_day boolean default false,
  p_pickup_member_id uuid default null,
  p_escort_undecided boolean default false,
  p_pickup_undecided boolean default false,
  p_reminder_minutes_before integer default null,
  p_remind_rides boolean default false,
  p_viewer_ids uuid[] default null
)
returns table (id uuid, day date)
language plpgsql
volatile
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_event public.events;
  v_day date;
  v_target uuid;
  v_open_start timestamptz;
  v_delta integer := 0;
  v_same_rule boolean := false;
  v_new_start timestamptz := p_starts_at;
  v_cancelled date[] := array[]::date[];
  v_changed public.events;
  v_viewers uuid[];
  v_new_viewers uuid[];
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  if p_member_ids is null or array_position(p_member_ids, null) is not null then
    raise exception 'invalid participants' using errcode = '22023';
  end if;

  if array_position(p_viewer_ids, null) is not null
     or (p_visibility is distinct from 'selected' and coalesce(cardinality(p_viewer_ids), 0) > 0) then
    raise exception 'invalid chosen people' using errcode = '22023';
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

  -- The opened occurrence: its day in the series and where it starts now.
  v_day := coalesce(p_day, (v_event.starts_at at time zone 'Europe/Rome')::date);
  v_open_start := coalesce(
    (
      select x.starts_at
      from public.event_exceptions x
      where v_event.recurrence <> 'none'
        and x.event_id = p_event_id
        and x.occurrence_date = v_day
        and not x.is_cancelled
    ),
    (v_day + (v_event.starts_at at time zone 'Europe/Rome')::time) at time zone 'Europe/Rome'
  );

  if v_day <= (v_event.starts_at at time zone 'Europe/Rome')::date then
    v_target := p_event_id;
  else
    v_target := private.split_event_series(p_event_id, v_day);

    -- The old part may have nothing left (every occurrence before v_day removed).
    if not private.event_has_remaining_occurrence(p_event_id) then
      delete from public.events e
      where e.id = p_event_id;
    end if;
  end if;

  if v_event.recurrence <> 'none' then
    v_delta := (p_starts_at at time zone 'Europe/Rome')::date - (v_open_start at time zone 'Europe/Rome')::date;
    v_same_rule := coalesce(
      p_recurrence = v_event.recurrence
      and (
        p_recurrence not in ('weekly', 'biweekly')
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
      -- Keep the rhythm of the series: start on v_day + shift, at the time of the form.
      v_new_start := ((v_day + v_delta) + (p_starts_at at time zone 'Europe/Rome')::time) at time zone 'Europe/Rome';

      select coalesce(array_agg(x.occurrence_date + v_delta), array[]::date[]) into v_cancelled
      from public.event_exceptions x
      where x.event_id = v_target
        and x.is_cancelled;
    elsif p_recurrence is distinct from 'none' then
      -- A new rule (issue #122): removed days stay removed where the new rule still has
      -- an occurrence (filtered below); never the day the opened occurrence starts now,
      -- unless the opened occurrence was itself removed (only possible without p_day:
      -- the whole event changed from its first occurrence, which stays as it was).
      select coalesce(array_agg(x.occurrence_date), array[]::date[]) into v_cancelled
      from public.event_exceptions x
      where x.event_id = v_target
        and x.is_cancelled
        and (
          x.occurrence_date <> (v_new_start at time zone 'Europe/Rome')::date
          or exists (
            select 1
            from public.event_exceptions o
            where o.event_id = v_target
              and o.occurrence_date = v_day
              and o.is_cancelled
          )
        );
    end if;

    delete from public.event_exceptions x
    where x.event_id = v_target;
  end if;

  update public.events e
  set
    title = p_title,
    location = p_location,
    notes = p_notes,
    starts_at = v_new_start,
    -- «Tutto il giorno»: the same number of calendar days, ending at 0:00 also when the
    -- clock changes in between (as in split_event_series).
    ends_at = case
      when coalesce(p_all_day, false) then (
        (v_new_start at time zone 'Europe/Rome')::date
        + ((p_ends_at at time zone 'Europe/Rome')::date - (p_starts_at at time zone 'Europe/Rome')::date)
      )::timestamp at time zone 'Europe/Rome'
      else v_new_start + (p_ends_at - p_starts_at)
    end,
    visibility = p_visibility,
    escort_member_id = p_escort_member_id,
    recurrence = p_recurrence,
    recurrence_weekdays = p_recurrence_weekdays,
    recurrence_until = p_recurrence_until,
    all_day = coalesce(p_all_day, false),
    pickup_member_id = p_pickup_member_id,
    escort_undecided = coalesce(p_escort_undecided, false),
    pickup_undecided = coalesce(p_pickup_undecided, false),
    reminder_minutes_before = p_reminder_minutes_before,
    remind_rides = coalesce(p_remind_rides, false)
  where e.id = v_target;

  if cardinality(v_cancelled) > 0 then
    select e.* into v_changed
    from public.events e
    where e.id = v_target;

    insert into public.event_exceptions (event_id, household_id, occurrence_date, is_cancelled)
    select v_target, v_changed.household_id, d, true
    from unnest(v_cancelled) as d
    where v_changed.recurrence <> 'none'
      and private.event_has_occurrence_on(
        v_changed.starts_at, v_changed.recurrence, v_changed.recurrence_weekdays,
        v_changed.recurrence_until, d
      );
  end if;

  -- The chosen people («Solo alcune persone»): only the author reads all of them (RLS of
  -- event_viewers) and changes them. Anybody else keeps them as they are: p_viewer_ids
  -- null, otherwise 42501 (they never know who else was chosen).
  if p_visibility = 'selected' and not private.is_event_author(v_target) then
    if p_viewer_ids is not null then
      raise exception 'only the author chooses who sees the event' using errcode = '42501';
    end if;
  elsif p_visibility = 'selected' then
    select coalesce(array_agg(v.member_id order by v.member_id), array[]::uuid[]) into v_viewers
    from public.event_viewers v
    where v.event_id = v_target;

    if p_viewer_ids is not null then
      select coalesce(array_agg(distinct w order by w), array[]::uuid[]) into v_new_viewers
      from unnest(p_viewer_ids) as w;

      if v_new_viewers is distinct from v_viewers then
        insert into public.event_viewers (event_id, member_id, household_id)
        select v_target, w, v_event.household_id
        from unnest(v_new_viewers) as w
        where w <> all (v_viewers);

        delete from public.event_viewers v
        where v.event_id = v_target
          and v.member_id <> all (v_new_viewers);

        v_viewers := v_new_viewers;
      end if;
    end if;

    if cardinality(v_viewers) = 0 then
      raise exception 'invalid chosen people' using errcode = '22023';
    end if;
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

  return query
    select v_target, (v_new_start at time zone 'Europe/Rome')::date;
end;
$$;

-- ===========================================================================
-- RPC: change only one occurrence of a repeated event («Salva solo questo»), new version
-- of #109 with «Lo riprende» and «Da decidere» of that occurrence as arguments at the end
-- with defaults (complete values, like the others). The old signature is dropped.
-- ===========================================================================
drop function public.update_event_occurrence(uuid, date, text, timestamptz, timestamptz, text, uuid, text);

create function public.update_event_occurrence(
  p_event_id uuid,
  p_day date,
  p_title text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_location text,
  p_escort_member_id uuid,
  p_notes text,
  p_pickup_member_id uuid default null,
  p_escort_undecided boolean default false,
  p_pickup_undecided boolean default false
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
    escort_member_id = p_escort_member_id,
    pickup_member_id = p_pickup_member_id,
    escort_undecided = coalesce(p_escort_undecided, false),
    pickup_undecided = coalesce(p_pickup_undecided, false)
  where x.event_id = p_event_id
    and x.occurrence_date = p_day;

  if not found then
    insert into public.event_exceptions (
      event_id, household_id, occurrence_date, is_cancelled, title, location, notes,
      starts_at, ends_at, escort_member_id, pickup_member_id, escort_undecided, pickup_undecided
    )
    values (
      p_event_id, v_event.household_id, p_day, false, p_title, p_location, p_notes,
      p_starts_at, p_ends_at, p_escort_member_id, p_pickup_member_id,
      coalesce(p_escort_undecided, false), coalesce(p_pickup_undecided, false)
    );
  end if;
end;
$$;

-- ===========================================================================
-- RPC: «Sì, confermo» on «Da verificare» (mn1-26). Removes p_fields from the fields to
-- verify of the event; null = all of them. Never adds a field. For everybody who sees
-- the event in full (security invoker: RLS of events, as any change of the event);
-- otherwise P0002 'event not found', without saying why. 22023 for a list with null.
-- ===========================================================================
create function public.confirm_event_fields(p_event_id uuid, p_fields public.event_field[] default null)
returns void
language plpgsql
volatile
set search_path = ''
as $$
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  if array_position(p_fields, null) is not null then
    raise exception 'invalid fields' using errcode = '22023';
  end if;

  update public.events e
  set unverified_fields = case
    when p_fields is null then array[]::public.event_field[]
    else array(
      select f
      from unnest(e.unverified_fields) as f
      where f <> all (p_fields)
      order by f
    )
  end
  where e.id = p_event_id;

  if not found then
    raise exception 'event not found' using errcode = 'P0002';
  end if;
end;
$$;

-- ===========================================================================
-- RPC: the events of the caller's household that touch a period, for the calendar of
-- plan #501 (A4–A6). Same arguments, checks, errors, rows and order as
-- list_household_events_with_source() (which does not change, like
-- list_household_events()), with the new columns at the end:
-- - all_day, pickup_member_id, escort_undecided, pickup_undecided (of the occurrence),
--   reminder_minutes_before, remind_rides, unverified_fields: null on masked rows;
-- - viewer_ids: the chosen people, only for the author; null for everybody else.
-- counts_for_free_time is false for an event «tutto il giorno». The generated types say
-- `string`, `boolean`, … but every new column can be null (lesson of #96).
-- ===========================================================================
create function public.list_calendar_events(p_from timestamptz, p_to timestamptz)
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
  member_ids uuid[],
  source_provider public.calendar_provider,
  is_imported boolean,
  counts_for_free_time boolean,
  all_day boolean,
  pickup_member_id uuid,
  escort_undecided boolean,
  pickup_undecided boolean,
  reminder_minutes_before integer,
  remind_rides boolean,
  unverified_fields public.event_field[],
  viewer_ids uuid[]
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
    raise exception 'permission denied for function list_calendar_events' using errcode = '42501';
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
      r.member_ids,
      r.source_provider,
      r.is_imported,
      r.counts_for_free_time,
      case when r.is_masked then null else r.all_day end,
      r.pickup_member_id,
      r.escort_undecided,
      r.pickup_undecided,
      r.reminder_minutes_before,
      r.remind_rides,
      r.unverified_fields,
      r.viewer_ids
    from private.household_event_rows_for_member(v_member_id, p_from, p_to) as r
    order by r.starts_at, r.ends_at, r.event_id;
end;
$$;

-- ===========================================================================
-- Overlapping events («alla stessa ora per la stessa persona», mn1-21, mn1-22, ap1-23,
-- ap1-24, ap1-29). Two occurrences overlap when a.start < b.end and b.start < a.end,
-- neither is «tutto il giorno», and the same person is involved in both: one of the
-- participants, the escort or the pickup. The rows are those of the calendar of the
-- caller (private.household_event_rows_for_member, the single place of the visibility
-- rules):
-- - an event the caller sees only as «Occupato» (also «Solo alcune persone» of the
--   others) involves only its author, and its row is masked: no id, day of the series,
--   title, place or people;
-- - «Solo io» events of the others do not exist for these functions.
-- Nothing is stored: the result follows the events as they are (ap1-24).
-- Errors: 42501 without a signed-in user or without a household; 22023 for invalid
-- arguments (null, an end not after the start, more than 42 days on the Europe/Rome
-- clock, people with null or not of the caller's household).
-- ===========================================================================

-- The people involved in one row of the calendar, as these functions count them.
create function private.event_row_people(
  p_is_masked boolean,
  p_author_member_id uuid,
  p_member_ids uuid[],
  p_escort_member_id uuid,
  p_pickup_member_id uuid
)
returns uuid[]
language sql
immutable
set search_path = ''
as $$
  select case
    when p_is_masked then array_remove(array[p_author_member_id], null)
    else array(
      select distinct p
      from unnest(coalesce(p_member_ids, array[]::uuid[]) || array[p_escort_member_id, p_pickup_member_id]) as p
      where p is not null
    )
  end;
$$;

-- For the sheet «Nuovo impegno» (mn1-21): the occurrences that overlap one interval (the
-- occurrence being saved, domanda 4) for the people of the form. p_exclude_event_id: the
-- event being changed, none of its occurrences counts. One row per (person, occurrence),
-- ordered by start and person.
create function public.find_event_conflicts(
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_member_ids uuid[],
  p_escort_member_id uuid default null,
  p_pickup_member_id uuid default null,
  p_exclude_event_id uuid default null
)
returns table (
  member_id uuid,
  event_id uuid,
  occurrence_date date,
  starts_at timestamptz,
  ends_at timestamptz,
  is_masked boolean,
  title text,
  author_member_id uuid,
  member_ids uuid[],
  escort_member_id uuid,
  pickup_member_id uuid
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_member_id uuid;
  v_household_id uuid;
  v_people uuid[];
begin
  if (select auth.uid()) is null then
    raise exception 'permission denied for function find_event_conflicts' using errcode = '42501';
  end if;
  if p_starts_at is null or p_ends_at is null or not isfinite(p_starts_at) or not isfinite(p_ends_at)
     or p_ends_at <= p_starts_at then
    raise exception 'invalid period' using errcode = '22023';
  end if;
  if (p_ends_at at time zone 'Europe/Rome') - (p_starts_at at time zone 'Europe/Rome') > interval '42 days' then
    raise exception 'the period cannot last more than 42 days' using errcode = '22023';
  end if;
  if p_member_ids is null or array_position(p_member_ids, null) is not null then
    raise exception 'invalid people' using errcode = '22023';
  end if;

  select m.id, m.household_id into v_member_id, v_household_id
  from public.household_members m
  where m.user_id = (select auth.uid());

  if v_household_id is null then
    raise exception 'permission denied for function find_event_conflicts' using errcode = '42501';
  end if;

  v_people := array(
    select distinct p
    from unnest(p_member_ids || array[p_escort_member_id, p_pickup_member_id]) as p
    where p is not null
  );

  if exists (
    select 1
    from unnest(v_people) as p
    where not exists (
      select 1
      from public.household_members m
      where m.id = p
        and m.household_id = v_household_id
    )
  ) then
    raise exception 'invalid people' using errcode = '22023';
  end if;

  return query
    select
      p.member_id,
      r.id,
      case when r.is_masked then null else r.occurrence_date end,
      r.starts_at,
      r.ends_at,
      r.is_masked,
      r.title,
      r.author_member_id,
      r.member_ids,
      r.escort_member_id,
      r.pickup_member_id
    from private.household_event_rows_for_member(v_member_id, p_starts_at, p_ends_at) as r
    cross join lateral unnest(
      private.event_row_people(r.is_masked, r.author_member_id, r.member_ids, r.escort_member_id, r.pickup_member_id)
    ) as p (member_id)
    where not r.all_day
      and r.starts_at < p_ends_at
      and p_starts_at < r.ends_at
      and p.member_id = any (v_people)
      -- Only an event the caller sees in full can be the one being changed.
      and (r.is_masked or p_exclude_event_id is null or r.event_id <> p_exclude_event_id)
    order by r.starts_at, p.member_id, r.ends_at, r.event_id;
end;
$$;

-- For Mese, Giorno and Oggi (ap1-23, ap1-24, ap1-29): every occurrence of the period that
-- overlaps at least one other occurrence of the same person, one row per (person,
-- occurrence): the person, the day (Europe/Rome) on which the occurrence starts, the
-- event (null when masked), start, end, is_masked. The other occurrence may start in the
-- week before or end in the week after the period. Ordered by day, person and start.
create function public.list_event_overlaps(p_from timestamptz, p_to timestamptz)
returns table (
  member_id uuid,
  day date,
  event_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  is_masked boolean
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
    raise exception 'permission denied for function list_event_overlaps' using errcode = '42501';
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
    raise exception 'permission denied for function list_event_overlaps' using errcode = '42501';
  end if;

  return query
    with per_person as (
      select distinct
        p.member_id,
        r.event_id,
        r.occurrence_date,
        r.id,
        r.starts_at,
        r.ends_at,
        r.is_masked
      from private.household_event_rows_for_member(
        v_member_id, p_from - interval '7 days', p_to + interval '7 days'
      ) as r
      cross join lateral unnest(
        private.event_row_people(r.is_masked, r.author_member_id, r.member_ids, r.escort_member_id, r.pickup_member_id)
      ) as p (member_id)
      where not r.all_day
    )
    select
      a.member_id,
      (a.starts_at at time zone 'Europe/Rome')::date,
      a.id,
      a.starts_at,
      a.ends_at,
      a.is_masked
    from per_person a
    where a.starts_at < p_to
      and a.ends_at > p_from
      and exists (
        select 1
        from per_person b
        where b.member_id = a.member_id
          and (b.event_id, b.occurrence_date) is distinct from (a.event_id, a.occurrence_date)
          and b.starts_at < a.ends_at
          and a.starts_at < b.ends_at
      )
    order by (a.starts_at at time zone 'Europe/Rome')::date, a.member_id, a.starts_at, a.ends_at, a.event_id;
end;
$$;

-- ===========================================================================
-- RPC: search the caller's household (page #40). Same arguments, columns, rules, rows and
-- order as the version of #337 (migration search_household_with_assignees), one change:
-- the filter by person also finds the events in which the person picks up («Lo
-- riprende», risposta 81). `create or replace` keeps the owner and the grants.
-- ===========================================================================
create or replace function public.search_household(
  p_text text default null,
  p_member_id uuid default null,
  p_from date default null,
  p_to date default null,
  p_kinds public.search_result_kind[] default null
)
returns table (
  kind public.search_result_kind,
  sort_index integer,
  id uuid,
  title text,
  starts_at timestamptz,
  ends_at timestamptz,
  occurrence_day date,
  visibility public.event_visibility,
  is_masked boolean,
  author_member_id uuid,
  member_ids uuid[],
  escort_member_id uuid,
  location text,
  recurrence public.event_recurrence,
  recurrence_weekdays smallint[],
  series_starts_on date,
  due_date date,
  is_private boolean,
  assignee_member_id uuid,
  for_member_id uuid,
  quantity text,
  source_provider public.calendar_provider,
  assignee_member_ids uuid[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  -- Limits of issue #40 (§6 and domanda 7).
  c_max_rows constant integer := 20;
  c_max_per_series constant integer := 3;
  c_max_text_length constant integer := 100;
  c_min_text_length constant integer := 2;
  c_max_period_days constant integer := 400;
  c_default_days constant interval := interval '365 days';
  v_member_id uuid;
  v_household_id uuid;
  v_words text[];
  v_has_text boolean;
  v_has_period boolean;
  v_kinds public.search_result_kind[];
  v_from timestamptz;
  v_to timestamptz;
begin
  -- Before reading anything (the text must never travel in a URL).
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  if (select auth.uid()) is null then
    raise exception 'permission denied for function search_household' using errcode = '42501';
  end if;

  -- Arguments. The messages never contain what the user wrote.
  if p_text is not null and char_length(p_text) > c_max_text_length then
    raise exception 'the text cannot be longer than 100 characters' using errcode = '22023';
  end if;
  v_words := array(
    select w.word
    from regexp_split_to_table(private.search_normalize(p_text), '\s+') as w (word)
    where w.word <> ''
  );
  v_has_text := cardinality(v_words) > 0;
  if v_has_text and char_length(array_to_string(v_words, '')) < c_min_text_length then
    raise exception 'the text needs at least 2 characters' using errcode = '22023';
  end if;

  if (p_from is null) <> (p_to is null) then
    raise exception 'the period needs a start and an end' using errcode = '22023';
  end if;
  v_has_period := p_from is not null;
  if v_has_period then
    if not isfinite(p_from) or not isfinite(p_to) or p_to < p_from then
      raise exception 'invalid period' using errcode = '22023';
    end if;
    if p_to - p_from + 1 > c_max_period_days then
      raise exception 'the period cannot last more than 400 days' using errcode = '22023';
    end if;
  end if;

  if not v_has_text and p_member_id is null and not v_has_period then
    raise exception 'nothing to search' using errcode = '22023';
  end if;

  if p_kinds is not null and array_position(p_kinds, null) is not null then
    raise exception 'kinds cannot be null' using errcode = '22023';
  end if;
  v_kinds := coalesce(p_kinds, enum_range(null::public.search_result_kind));

  -- The household is always the caller's (one household per account).
  select m.id, m.household_id into v_member_id, v_household_id
  from public.household_members m
  where m.user_id = (select auth.uid());

  if v_household_id is null then
    return;
  end if;

  -- A person who is not a member of the caller's household: no rows, no error.
  if p_member_id is not null and not exists (
    select 1
    from public.household_members m
    where m.id = p_member_id
      and m.household_id = v_household_id
  ) then
    return;
  end if;

  -- -------------------------------------------------------------------------
  -- Events
  -- -------------------------------------------------------------------------
  if 'event' = any (v_kinds) then
    if v_has_period then
      v_from := p_from::timestamp at time zone 'Europe/Rome';
      v_to := (p_to + 1)::timestamp at time zone 'Europe/Rome';
    else
      v_from := now();
      v_to := now() + c_default_days;
    end if;

    return query
      with base as (
        -- The rows of the calendar as the caller sees it: the visibility rules live only in
        -- private.household_event_rows_for_member(), shared with list_household_events()
        -- and the notifications. Masked rows arrive there already without title, place,
        -- participants, escort, pickup and repetition. With a text they are dropped here,
        -- before any comparison, any limit and any count.
        select r.*
        from private.household_event_rows_for_member(v_member_id, v_from, v_to) as r
        where not (v_has_text and r.is_masked)
      ),
      matched as (
        select b.*
        from base b
        where (
            not v_has_text
            or case
              when b.is_masked then false
              else private.search_matches(b.title, v_words)
            end
          )
          and (
            p_member_id is null
            or b.author_member_id = p_member_id
            or (
              not b.is_masked
              and (
                b.escort_member_id = p_member_id
                or b.pickup_member_id = p_member_id
                or p_member_id = any (b.member_ids)
              )
            )
          )
      ),
      per_series as (
        select
          m.*,
          row_number() over (
            partition by m.event_id
            order by m.starts_at, m.ends_at
          ) as series_rank
        from matched m
      ),
      ranked as (
        select
          p.*,
          row_number() over (order by p.starts_at, p.ends_at, p.event_id) as rank_in_kind
        from per_series p
        where p.series_rank <= c_max_per_series
      )
      select
        'event'::public.search_result_kind,
        r.rank_in_kind::integer,
        r.id,
        r.title,
        r.starts_at,
        r.ends_at,
        (r.starts_at at time zone 'Europe/Rome')::date,
        -- Masked rows: only start, end, day and author (and is_masked).
        case when r.is_masked then null else r.visibility end,
        r.is_masked,
        r.author_member_id,
        r.member_ids,
        r.escort_member_id,
        r.location,
        r.recurrence,
        r.recurrence_weekdays,
        (r.series_starts_at at time zone 'Europe/Rome')::date,
        null::date,
        null::boolean,
        null::uuid,
        null::uuid,
        null::text,
        -- Only for the author (already null for everybody else in the rows).
        r.source_provider,
        null::uuid[]
      from ranked r
      where r.rank_in_kind <= c_max_rows
      order by r.rank_in_kind;
  end if;

  -- -------------------------------------------------------------------------
  -- Deadlines: all, also past ones; «Solo io» only of the caller.
  -- -------------------------------------------------------------------------
  if 'deadline' = any (v_kinds) then
    return query
      select
        'deadline'::public.search_result_kind,
        (row_number() over (order by d.due_date, d.created_at, d.id))::integer,
        d.id,
        d.title,
        null::timestamptz,
        null::timestamptz,
        null::date,
        null::public.event_visibility,
        false,
        d.created_by_member_id,
        null::uuid[],
        null::uuid,
        null::text,
        null::public.event_recurrence,
        null::smallint[],
        null::date,
        d.due_date,
        d.is_private,
        d.assignee_member_id,
        d.for_member_id,
        null::text,
        null::public.calendar_provider,
        coalesce(
          (
            select array_agg(a.member_id order by a.created_at, m.created_at, m.id)
            from public.deadline_assignees a
            join public.household_members m on m.id = a.member_id
            where a.deadline_id = d.id
          ),
          array[]::uuid[]
        )
      from public.deadlines d
      where d.household_id = v_household_id
        and (not d.is_private or d.created_by_member_id = v_member_id)
        and (not v_has_period or d.due_date between p_from and p_to)
        and (
          p_member_id is null
          or d.for_member_id = p_member_id
          or exists (
            select 1
            from public.deadline_assignees a
            where a.deadline_id = d.id
              and a.member_id = p_member_id
          )
        )
        and (not v_has_text or private.search_matches(d.title, v_words))
      order by d.due_date, d.created_at, d.id
      limit c_max_rows;
  end if;

  -- -------------------------------------------------------------------------
  -- Things to do: only to do; «Solo io» only of the caller.
  -- -------------------------------------------------------------------------
  if 'todo' = any (v_kinds) then
    return query
      select
        'todo'::public.search_result_kind,
        (row_number() over (order by t.due_date nulls last, t.created_at, t.id))::integer,
        t.id,
        t.title,
        null::timestamptz,
        null::timestamptz,
        null::date,
        null::public.event_visibility,
        false,
        t.created_by_member_id,
        null::uuid[],
        null::uuid,
        null::text,
        null::public.event_recurrence,
        null::smallint[],
        null::date,
        t.due_date,
        t.is_private,
        t.assignee_member_id,
        t.for_member_id,
        null::text,
        null::public.calendar_provider,
        coalesce(
          (
            select array_agg(a.member_id order by a.created_at, m.created_at, m.id)
            from public.todo_assignees a
            join public.household_members m on m.id = a.member_id
            where a.todo_id = t.id
          ),
          array[]::uuid[]
        )
      from public.todos t
      where t.household_id = v_household_id
        and t.done_at is null
        and (not t.is_private or t.created_by_member_id = v_member_id)
        and (not v_has_period or t.due_date between p_from and p_to)
        and (
          p_member_id is null
          or t.for_member_id = p_member_id
          or exists (
            select 1
            from public.todo_assignees a
            where a.todo_id = t.id
              and a.member_id = p_member_id
          )
        )
        and (not v_has_text or private.search_matches(t.title, v_words))
      order by t.due_date nulls last, t.created_at, t.id
      limit c_max_rows;
  end if;

  -- -------------------------------------------------------------------------
  -- Shopping items: only to buy; never with a person or a period.
  -- -------------------------------------------------------------------------
  if 'shopping_item' = any (v_kinds) and p_member_id is null and not v_has_period then
    return query
      select
        'shopping_item'::public.search_result_kind,
        (row_number() over (order by s.created_at, s.id))::integer,
        s.id,
        s.name,
        null::timestamptz,
        null::timestamptz,
        null::date,
        null::public.event_visibility,
        false,
        null::uuid,
        null::uuid[],
        null::uuid,
        null::text,
        null::public.event_recurrence,
        null::smallint[],
        null::date,
        null::date,
        null::boolean,
        null::uuid,
        null::uuid,
        s.quantity,
        null::public.calendar_provider,
        coalesce(
          (
            select array_agg(a.member_id order by a.created_at, m.created_at, m.id)
            from public.shopping_item_assignees a
            join public.household_members m on m.id = a.member_id
            where a.shopping_item_id = s.id
          ),
          array[]::uuid[]
        )
      from public.shopping_items s
      where s.household_id = v_household_id
        and s.checked_at is null
        and private.search_matches(s.name, v_words)
      order by s.created_at, s.id
      limit c_max_rows;
  end if;
end;
$$;
