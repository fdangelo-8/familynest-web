-- Issue #331: update_calendar_account_credentials() is for the synchronisation service only
-- (administrative key and database owner), never for authenticated or anon.

revoke execute on function public.update_calendar_account_credentials(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.update_calendar_account_credentials(uuid, text, text)
  to service_role;
