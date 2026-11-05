-- Issue #275: after #270 (linked calendars) nobody but the Data API roles could add
-- people to an event: the administrative key (service_role) got 42501 «permission denied
-- for schema private» on every insert into event_members, also for normal events.
--
-- Cause: event_members_guard_imported (20261105121817) is security invoker and tested
--   current_user in ('authenticated', 'anon') and private.is_imported_event(new.event_id)
-- in one expression. PL/pgSQL prepares the whole expression before evaluating it, so the
-- name private.is_imported_event is resolved with the privileges of the caller even when
-- the first part is false; service_role has no usage on the schema private (only
-- authenticated has it, 20261022201344) and no execute on the helper.
--
-- Fix: the same rule, with the role checked first in its own statement (like
-- events_guard_imported). The helper is prepared only for the Data API roles, which have
-- the privileges. Unchanged rules: for authenticated and anon nobody is added to an
-- imported event (42501, #34 §7); security definer functions (owner postgres), the
-- synchronisation service and the administrative key are trusted, as the conventions of
-- 20261105121817 say. No privilege is added to service_role.
create or replace function private.event_members_guard_imported()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if private.is_imported_event(new.event_id) then
    raise exception 'nobody can be added to an imported event' using errcode = '42501';
  end if;

  return new;
end;
$$;
