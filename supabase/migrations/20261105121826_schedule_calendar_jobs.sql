-- Issue #266 (for #34, decision F1 = B of Francesco, 05/11): the job of the linked
-- calendars, every 15 minutes, even when nobody opens the app (LEZIONI: expiry guaranteed
-- by pg_cron, not by a write trigger).
--
-- private.run_scheduled_calendar_jobs(p_at):
-- 1. deletes the rows of the revocation queue older than 23 hours, revoked or not: with a
--    run every 15 minutes no row is kept for 24 hours (#34 §9);
-- 2. asks the synchronisation service inside Supabase to work (synchronise every account,
--    revoke the queued credentials, send the changes of «Anche su»): an HTTP POST with
--    pg_net to the address kept in the Vault of Supabase as «calendar_sync_url», with the
--    secret «calendar_sync_secret» of the Vault as bearer token. Both are created by hand
--    in the Vault of the project, never in the repository; without them (local database,
--    CI, before the service exists) nothing is called. The call is asynchronous (pg_net)
--    and a failure never stops the cleanup.
-- Returns how many rows of the queue it deleted. Runs as the role that schedules it
-- (postgres, owner of the function and of the tables), never callable by the API roles.

create or replace function private.run_scheduled_calendar_jobs(p_at timestamptz default now())
returns integer
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_deleted integer;
  v_url text;
  v_secret text;
begin
  delete from public.calendar_credential_revocations r
  where r.created_at < p_at - interval '23 hours';
  get diagnostics v_deleted = row_count;

  if to_regclass('vault.decrypted_secrets') is not null then
    select
      max(s.decrypted_secret) filter (where s.name = 'calendar_sync_url'),
      max(s.decrypted_secret) filter (where s.name = 'calendar_sync_secret')
    into v_url, v_secret
    from vault.decrypted_secrets s
    where s.name in ('calendar_sync_url', 'calendar_sync_secret');
  end if;

  if v_url is not null and v_secret is not null then
    begin
      perform net.http_post(
        url := v_url,
        body := jsonb_build_object('job', 'scheduled'),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_secret
        ),
        timeout_milliseconds := 10000
      );
    exception when others then
      -- Never stops the cleanup; the next run tries again. Nothing of the call is logged.
      null;
    end;
  end if;

  return v_deleted;
end;
$$;

revoke execute on function private.run_scheduled_calendar_jobs(timestamptz) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'calendar-jobs') then
    perform cron.unschedule('calendar-jobs');
  end if;
end;
$$;

select cron.schedule(
  'calendar-jobs',
  '*/15 * * * *',
  'select private.run_scheduled_calendar_jobs();'
);
