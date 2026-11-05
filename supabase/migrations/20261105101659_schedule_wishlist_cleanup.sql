-- Issue #259 (privacy, #32 §11): 30 days after the occasion of a link, the reservations
-- made for it (with the names of the givers), the ideas taken for it (with their photos)
-- and the link itself are deleted every day, even when nobody opens the page (LEZIONI:
-- expiry guaranteed by pg_cron, not by a write trigger). The day counted is the day of Rome
-- when the job runs: no name of a giver is kept for more than about 31 days after the
-- occasion. The ideas not taken stay for the next birthday.
-- The job runs at 02:40 UTC (03:40 or 04:40 in Rome, always the same day of Rome) as the
-- role that schedules it (postgres, owner of the functions and of the tables). pg_cron is
-- installed by the pg_cron_extension migration. Idempotent: an existing job with the same
-- name is replaced.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'purge-past-wishlist-occasions') then
    perform cron.unschedule('purge-past-wishlist-occasions');
  end if;
end;
$$;

select cron.schedule(
  'purge-past-wishlist-occasions',
  '40 2 * * *',
  'select private.run_scheduled_wishlist_cleanup();'
);
