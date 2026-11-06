-- Issue #331: update_calendar_account_credentials() is for the synchronisation service only
-- (administrative key and database owner), never for authenticated or anon.

revoke execute on function public.update_calendar_account_credentials(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.update_calendar_account_credentials(uuid, text, text)
  to service_role;

-- The rule of the format is used only inside the functions of the service (owner postgres).
revoke execute on function private.calendar_credentials_format_ok(text)
  from public, anon, authenticated;
