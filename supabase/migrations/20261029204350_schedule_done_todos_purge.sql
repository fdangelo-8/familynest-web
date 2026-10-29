-- Issue #87 (privacy, issue #23 question 10): things done more than 90 days ago are
-- deleted every day, even when nobody opens the page (LEZIONI: expiry guaranteed by
-- pg_cron, not by a write trigger). The page shows only the last 7 days of «Fatti»;
-- no done thing is kept for more than about 91 days.
-- The job runs at 03:17 UTC as the role that schedules it (postgres, owner of the
-- function and of the table). pg_cron is installed by the pg_cron_extension migration.
-- Idempotent: an existing job with the same name is replaced.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'purge-done-todos') then
    perform cron.unschedule('purge-done-todos');
  end if;
end;
$$;

select cron.schedule(
  'purge-done-todos',
  '17 3 * * *',
  'select private.purge_done_todos();'
);
