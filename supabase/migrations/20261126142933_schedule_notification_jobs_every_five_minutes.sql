-- Issue #511 (DB-2 «Notifiche 2.0», plan #501), part 2 of 2: the notification jobs run
-- every 5 minutes (rule 9 of #511), for the reminders of the events and of the rides, the
-- overlapping events and the summaries to send. The jobs of today keep their hours of Rome
-- (8:00, 9:00, 19:00, 3:00): private.run_scheduled_notification_jobs() runs them only in
-- the first 5 minutes of their hour, and every job is idempotent, so nothing doubles.
-- Same job name as #229: the existing entry is replaced (idempotent).

do $$
begin
  if exists (select 1 from cron.job where jobname = 'notification-jobs') then
    perform cron.unschedule('notification-jobs');
  end if;
end;
$$;

select cron.schedule(
  'notification-jobs',
  '*/5 * * * *',
  'select private.run_scheduled_notification_jobs();'
);
