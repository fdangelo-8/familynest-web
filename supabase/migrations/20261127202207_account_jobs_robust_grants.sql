-- Issue #658: privileges of the functions of the account_jobs_robust_functions migration.
--
-- - private.account_deletions() and private.run_scheduled_account_jobs() were created
--   again: the database owner only (pg_cron runs as postgres), as in #657.
-- - public.has_consent_evidence_key(): the server (administrative key) and the database
--   owner, never authenticated or anon.
-- - public.run_account_job() and public.invite_adult() were replaced with the same
--   signature and keep their grants (service_role; authenticated).

revoke execute on function private.account_deletions(timestamptz) from public, anon, authenticated, service_role;
revoke execute on function private.run_scheduled_account_jobs(timestamptz) from public, anon, authenticated, service_role;

revoke execute on function public.has_consent_evidence_key() from public, anon, authenticated;
grant execute on function public.has_consent_evidence_key() to service_role;
