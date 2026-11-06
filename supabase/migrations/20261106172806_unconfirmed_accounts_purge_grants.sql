-- Issue #336: the purge of the unconfirmed accounts runs only from pg_cron (as postgres).
-- No API role can execute it, not even the administrative key (lesson: the global work
-- runs only from the pg_cron job, through a private function).

revoke execute on function private.purge_unconfirmed_accounts(timestamptz)
  from public, anon, authenticated, service_role;
