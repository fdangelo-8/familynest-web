-- Issue #336 (for #327, decision D3): every hour, at minute 17, the accounts whose mail
-- was never confirmed within 7 days are deleted (private.purge_unconfirmed_accounts, at
-- most 1000 per run). The job runs as the role that schedules it (postgres, owner of the
-- function). pg_cron is installed by the pg_cron_extension migration. Idempotent: an
-- existing job with the same name is replaced.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'purge-unconfirmed-accounts') then
    perform cron.unschedule('purge-unconfirmed-accounts');
  end if;
end;
$$;

select cron.schedule(
  'purge-unconfirmed-accounts',
  '17 * * * *',
  'select private.purge_unconfirmed_accounts(now());'
);
