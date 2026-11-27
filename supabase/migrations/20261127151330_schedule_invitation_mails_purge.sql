-- Issue #617, R4 (CA-25): every hour, at minute 53, the invitation mails recorded more than
-- 48 hours before are deleted (private.purge_invitation_mails). The job runs as the role
-- that schedules it (postgres, owner of the function and of the table). pg_cron is
-- installed by the pg_cron_extension migration. Idempotent: an existing job with the same
-- name is replaced.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'purge-invitation-mails') then
    perform cron.unschedule('purge-invitation-mails');
  end if;
end;
$$;

select cron.schedule(
  'purge-invitation-mails',
  '53 * * * *',
  'select private.purge_invitation_mails(now());'
);
