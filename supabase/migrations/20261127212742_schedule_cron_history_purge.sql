-- Issue #662, point 4: every day at 03:27 (UTC) the history of pg_cron older than 30 days is
-- deleted (private.purge_cron_job_run_details). pg_cron writes one row per run of every job
-- (account-jobs every hour, notification-jobs every 5 minutes, ...) and never deletes them.
-- The job runs as the role that schedules it (postgres). pg_cron is installed by the
-- pg_cron_extension migration. Idempotent: an existing job with the same name is replaced,
-- and running the purge twice deletes nothing more.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'purge-cron-history') then
    perform cron.unschedule('purge-cron-history');
  end if;
end;
$$;

select cron.schedule(
  'purge-cron-history',
  '27 3 * * *',
  'select private.purge_cron_job_run_details(now());'
);
