-- Issue #288: privileges of the trusted triggers of events, deadlines and event_exceptions
-- (previous migration).

-- Trigger functions are never called directly (a trigger does not need the privilege).
revoke execute on function private.events_before_write_trusted() from public, anon, authenticated, service_role;
revoke execute on function private.deadlines_before_write_trusted() from public, anon, authenticated, service_role;
revoke execute on function private.event_exceptions_before_write_trusted() from public, anon, authenticated, service_role;

-- The check constraint deadlines_reminder_days_valid calls this function as the role that
-- writes: the administrative key writes deadlines too (as child_school_days_valid,
-- 20261104164919). Only the execute privilege: no usage on the schema private is needed to
-- run a function already bound by a constraint.
grant execute on function private.deadlines_reminder_days_valid(smallint[]) to service_role;
