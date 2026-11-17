-- Issue #418: every hour, at minute 47, the readings of shop links older than 24 hours are
-- deleted (private.purge_shop_link_reads). The job runs as the role that schedules it
-- (postgres, owner of the function and of the table). pg_cron is installed by the
-- pg_cron_extension migration. Idempotent: an existing job with the same name is replaced.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'purge-shop-link-reads') then
    perform cron.unschedule('purge-shop-link-reads');
  end if;
end;
$$;

select cron.schedule(
  'purge-shop-link-reads',
  '47 * * * *',
  'select private.purge_shop_link_reads(now());'
);
