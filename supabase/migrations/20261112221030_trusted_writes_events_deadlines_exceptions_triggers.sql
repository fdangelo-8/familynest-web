-- Issue #288: the administrative key (service_role) could not write into events, deadlines
-- and event_exceptions: every insert or update got 42501 «permission denied for schema
-- private» (same defect as #275 and #277).
--
-- Cause: the before insert and before update triggers of the three tables (security
-- invoker) call private.events_normalize(), private.deadlines_normalize() with
-- private.deadlines_check_assignee(), and private.event_exceptions_normalize() for every
-- role. PL/pgSQL resolves those names with the privileges of the caller; service_role has
-- no usage on the schema private (only authenticated has it, 20261022201344).
--
-- Fix, the same rules for every role and one single source for each of them:
-- - the guard triggers (events_before_insert, events_before_update,
--   deadlines_before_insert, deadlines_before_update, event_exceptions_before_insert,
--   event_exceptions_before_update) check the role first, in a statement of its own (lesson
--   of #275), and return at once for the trusted roles. For the Data API roles
--   (authenticated, anon) nothing changes: same checks, same order, the same helpers
--   evaluated as the caller (RLS included, so a refused write never reveals anything about
--   another household or an event the caller does not see in full);
-- - a new trigger per table, «<table>_before_write_trusted», fires only for the other roles
--   (condition WHEN on current_user, evaluated as the role that runs the statement) and
--   calls the same helpers, with the same arguments as before. It is security definer
--   (owner postgres), so that it may use the schema private: it receives only the row being
--   written, reads no input of the caller and runs only for roles that already bypass RLS
--   (service_role, the database owner, foreign key actions, the seed). The helpers run as
--   the owner, as they already did for the security definer functions of the app;
-- - the names make the new trigger fire right after the guard of the same statement
--   (alphabetical order: before_insert, before_update, before_write_trusted), so the row is
--   normalised before events_guard_imported and the set_updated_at triggers, as before.
--
-- Unchanged: the helpers, their privileges, every check constraint and every other trigger.
-- No usage on the schema private is given to service_role; the grants migration only lets
-- service_role execute private.deadlines_reminder_days_valid(), called by the check
-- constraint deadlines_reminder_days_valid as the caller (as child_school_days_valid of
-- 20261104164919).

-- ===========================================================================
-- events
-- ===========================================================================
create or replace function private.events_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_household_id uuid;
begin
  -- Trusted roles: normalised by events_before_write_trusted (#288).
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

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

  new := private.events_normalize(new);
  return new;
end;
$$;

-- Household, author and creation time never change; only the author changes who sees the
-- event. On «Solo io» and «Occupato» events only the author sets a new escort.
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

  new := private.events_normalize(new);
  return new;
end;
$$;

-- Trusted roles only (see the trigger): the normalisation of every event.
create or replace function private.events_before_write_trusted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new := private.events_normalize(new);
  return new;
end;
$$;

create trigger events_before_write_trusted
  before insert or update on public.events
  for each row
  when (current_user not in ('authenticated', 'anon'))
  execute function private.events_before_write_trusted();

-- ===========================================================================
-- deadlines
-- ===========================================================================
create or replace function private.deadlines_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_household_id uuid;
begin
  -- Trusted roles: normalised and checked by deadlines_before_write_trusted (#288).
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  -- Checked first, so that a refused insert into another household never reveals
  -- anything about its members.
  v_household_id := (select public.current_household_id());
  if v_household_id is null or new.household_id is distinct from v_household_id then
    raise exception 'new row violates row-level security policy for table "deadlines"'
      using errcode = '42501';
  end if;

  -- The author is always the caller; the app never chooses it.
  new.created_by_member_id := (select private.current_member_id());
  new.created_at := now();
  new.updated_at := now();

  new := private.deadlines_normalize(new);
  if new.assignee_member_id is not null then
    perform private.deadlines_check_assignee(new.household_id, new.assignee_member_id);
  end if;
  return new;
end;
$$;

-- Household, author and creation time never change; only the author changes «Solo io».
create or replace function private.deadlines_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Trusted roles: normalised and checked by deadlines_before_write_trusted (#288).
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.household_id is distinct from old.household_id
     or new.created_by_member_id is distinct from old.created_by_member_id
     or new.created_at is distinct from old.created_at then
    raise exception 'this field of a deadline cannot be changed' using errcode = '42501';
  end if;

  if new.is_private is distinct from old.is_private
     and (old.created_by_member_id is null
          or old.created_by_member_id is distinct from (select private.current_member_id())) then
    raise exception 'only the author can change who sees a deadline' using errcode = '42501';
  end if;

  new := private.deadlines_normalize(new);
  if new.assignee_member_id is not null
     and new.assignee_member_id is distinct from old.assignee_member_id then
    perform private.deadlines_check_assignee(new.household_id, new.assignee_member_id);
  end if;
  return new;
end;
$$;

-- Trusted roles only (see the trigger): text and reminders normalised, kind of a new
-- assignee checked, with the same conditions as the guards above.
create or replace function private.deadlines_before_write_trusted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new := private.deadlines_normalize(new);

  if tg_op = 'INSERT' then
    if new.assignee_member_id is not null then
      perform private.deadlines_check_assignee(new.household_id, new.assignee_member_id);
    end if;
  elsif new.assignee_member_id is not null
        and new.assignee_member_id is distinct from old.assignee_member_id then
    perform private.deadlines_check_assignee(new.household_id, new.assignee_member_id);
  end if;

  return new;
end;
$$;

create trigger deadlines_before_write_trusted
  before insert or update on public.deadlines
  for each row
  when (current_user not in ('authenticated', 'anon'))
  execute function private.deadlines_before_write_trusted();

-- ===========================================================================
-- event_exceptions
-- ===========================================================================
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

  new := private.event_exceptions_normalize(new, null, null);
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

  new := private.event_exceptions_normalize(new, old.escort_member_id, old.starts_at);
  return new;
end;
$$;

-- Trusted roles only (see the trigger): texts, occurrence and escort checked, with the same
-- arguments as the guards above. The check «another occurrence of the event starts on that
-- day» stays for the Data API roles only, as before (current_user is the owner here).
create or replace function private.event_exceptions_before_write_trusted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new := private.event_exceptions_normalize(new, null, null);
  else
    new := private.event_exceptions_normalize(new, old.escort_member_id, old.starts_at);
  end if;
  return new;
end;
$$;

create trigger event_exceptions_before_write_trusted
  before insert or update on public.event_exceptions
  for each row
  when (current_user not in ('authenticated', 'anon'))
  execute function private.event_exceptions_before_write_trusted();
