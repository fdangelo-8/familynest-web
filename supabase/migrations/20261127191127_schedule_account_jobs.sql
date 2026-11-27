-- Issue #513 (DB-4 «Account e privacy», plan #501), part 2 of 2 (rules 10 – 13, decision B
-- of 27/11): every hour, at minute 7, the jobs of the account
-- (private.run_scheduled_account_jobs): deletions after the 14 days, exports stuck or
-- expired, addresses for the last mail after 72 hours, proof of the consents after 5 years.
-- The job runs as the role that schedules it (postgres, owner of the functions and of the
-- tables). pg_cron is installed by the pg_cron_extension migration. Idempotent: an existing
-- job with the same name is replaced.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'account-jobs') then
    perform cron.unschedule('account-jobs');
  end if;
end;
$$;

select cron.schedule(
  'account-jobs',
  '7 * * * *',
  'select private.run_scheduled_account_jobs(now());'
);
