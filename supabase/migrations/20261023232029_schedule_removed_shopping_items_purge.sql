-- Issue #62 (privacy): the items removed by a strappo are kept only for the
-- 10 minute Annulla window. Besides the cleanup done by clear_checked_shopping_items()
-- and restore_shopping_items(), this job deletes the expired rows every 10 minutes,
-- even when nobody uses the shopping list: no removed item is ever kept for more
-- than about 20 minutes, well within the 24 hours allowed by issue #62.
-- The job runs as the role that schedules it (postgres, owner of the function).
-- Idempotent: an existing job with the same name is replaced.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'purge-removed-shopping-items') then
    perform cron.unschedule('purge-removed-shopping-items');
  end if;
end;
$$;

select cron.schedule(
  'purge-removed-shopping-items',
  '*/10 * * * *',
  'select private.purge_removed_shopping_items();'
);
