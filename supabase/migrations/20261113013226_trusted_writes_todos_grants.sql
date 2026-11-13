-- Issue #362: privileges of the trusted trigger of todos (previous migration).

-- Trigger functions are never called directly (a trigger does not need the privilege).
revoke execute on function private.todos_before_write_trusted() from public, anon, authenticated, service_role;
