-- Issue #662 (monitoring of the jobs of the account, #660), point 1: the table of the runs
-- of the hourly job account-jobs.
--
-- private.account_job_runs: one row per run of private.run_scheduled_account_jobs(), written
-- at the end of the run (functions migration account_jobs_monitoring_functions):
-- - ran_at: when the run started (now() of the pg_cron transaction);
-- - errors: the number of errors of the run (accounts not deleted plus failed steps);
-- - has_key: whether the key of the proof of the consents was usable at that moment.
-- No personal data: no account, household, address or message of an error. The rows older
-- than 30 days are deleted by the run itself.
-- Read only by public.get_account_jobs_health() (security definer, service_role only). No
-- API role reads or writes the table (service_role included): RLS on, no policy, every
-- privilege revoked.

create table private.account_job_runs (
  id uuid primary key default gen_random_uuid(),
  ran_at timestamptz not null,
  errors integer not null,
  has_key boolean not null,
  created_at timestamptz not null default now(),

  constraint account_job_runs_errors_not_negative check (errors >= 0)
);

-- The newest runs first (the summary) and the purge after 30 days.
create index account_job_runs_ran_at_idx on private.account_job_runs (ran_at desc, id desc);

alter table private.account_job_runs enable row level security;

revoke all on table private.account_job_runs from public, anon, authenticated, service_role;
