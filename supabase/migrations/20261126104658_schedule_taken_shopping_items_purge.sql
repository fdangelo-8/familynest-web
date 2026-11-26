-- Issue #512 (privacy, decision 84 of Francesco): the taken things of the shopping list
-- disappear 12 hours after they were taken, even when nobody opens the page (LEZIONI:
-- expiry guaranteed by pg_cron, not by a write trigger). The job runs every 10 minutes for
-- every household, so a taken thing disappears between 12 hours and 12 hours and 10 minutes
-- after it was taken. Taken things already older than 12 hours when this migration is
-- applied disappear at the first run.
-- The job runs as the role that schedules it (postgres, owner of the function and of the
-- table). pg_cron is installed by the pg_cron_extension migration.
-- Idempotent: an existing job with the same name is replaced.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'purge-taken-shopping-items') then
    perform cron.unschedule('purge-taken-shopping-items');
  end if;
end;
$$;

select cron.schedule(
  'purge-taken-shopping-items',
  '*/10 * * * *',
  'select private.purge_taken_shopping_items(now(), null);'
);
