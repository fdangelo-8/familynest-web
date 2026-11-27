-- Issue #662: privileges of the account_job_runs_table and account_jobs_monitoring_functions
-- migrations.
--
-- Who can see what:
-- - private.account_job_runs: no API role at all (service_role included); RLS on, no policy.
--   Read only through public.get_account_jobs_health().
-- - public.get_account_jobs_health(): the server (administrative key) and the database
--   owner; never authenticated or anon. It answers only three true/false.
-- - private.consent_hmac(), private.consent_subject_hmac(),
--   private.previous_consent_subject_hmacs(), private.find_consent_evidence(),
--   private.run_scheduled_account_jobs(), private.purge_cron_job_run_details(): the database
--   owner only (pg_cron runs as postgres; the lookup of the proof is done by hand by the
--   administrator of the database).
-- - public.invite_adult(): replaced with the same signature, keeps its grants (authenticated
--   only), set again here.

revoke all on table private.account_job_runs from public, anon, authenticated, service_role;

revoke execute on function public.get_account_jobs_health() from public, anon, authenticated;
grant execute on function public.get_account_jobs_health() to service_role;

revoke execute on function private.consent_hmac(text, text) from public, anon, authenticated, service_role;
revoke execute on function private.consent_subject_hmac(text) from public, anon, authenticated, service_role;
revoke execute on function private.previous_consent_subject_hmacs(text) from public, anon, authenticated, service_role;
revoke execute on function private.find_consent_evidence(text) from public, anon, authenticated, service_role;
revoke execute on function private.run_scheduled_account_jobs(timestamptz) from public, anon, authenticated, service_role;
revoke execute on function private.purge_cron_job_run_details(timestamptz) from public, anon, authenticated, service_role;

revoke execute on function public.invite_adult(text, public.member_color) from public, anon, service_role;
grant execute on function public.invite_adult(text, public.member_color) to authenticated;
