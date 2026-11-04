-- Issue #229 (for page #39 «Notifiche»): the scheduled jobs of the notifications.
-- pg_cron (installed by the pg_cron_extension migration) counts in UTC, while the jobs
-- run at 8:00, 9:00 and 19:00 of Rome also with daylight saving time, and the cleanup
-- every day. One job at minute 0 of every hour calls
-- private.run_scheduled_notification_jobs(), which runs the job of that hour of Rome, if
-- any. The cleanup does not depend on anybody using the page (LEZIONI: expiry guaranteed
-- by pg_cron, not by a write trigger): no notification is kept for more than about
-- 31 days, no record of the shopping additions for more than about 3 days.
-- The job runs as the role that schedules it (postgres, owner of the functions and of the
-- tables). Idempotent: an existing job with the same name is replaced.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'notification-jobs') then
    perform cron.unschedule('notification-jobs');
  end if;
end;
$$;

select cron.schedule(
  'notification-jobs',
  '0 * * * *',
  'select private.run_scheduled_notification_jobs();'
);
