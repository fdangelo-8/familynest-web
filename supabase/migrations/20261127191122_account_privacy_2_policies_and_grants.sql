-- Issue #513 (DB-4 «Account e privacy», plan #501), part 2 of 2: privileges and RLS
-- policies.
--
-- Who can see what:
-- - private.account_deletion_requests, private.account_deletion_mails,
--   private.consent_evidence, private.data_export_leftovers: no API role reads or writes
--   them (service_role included; the "private" schema is not exposed by the Data API). RLS
--   is on with no policy. Only the functions of the database use them; the proof of the
--   consents is read only by the administrator of the database (find_consent_evidence()).
-- - data_exports: personal to the account. Each adult reads only their own rows; the other
--   adults of the household (administrators included) and every other household read 0
--   rows; anon has no privilege. Nobody writes a row from the API (42501): only the
--   functions of the database.
-- - storage, bucket data-exports (private, 50 MiB): only the owner, only in their own path
--   <user_id>/<export_id>.zip; upload only for an own export preparing; download only for an
--   own export ready and not expired; nobody deletes from the app. No access for the other
--   adults (administrators included) nor for anon.
-- service_role keeps the default privileges of Supabase on the public tables
-- (administrative key, server only).

-- ---------------------------------------------------------------------------
-- Private tables: no API role at all
-- ---------------------------------------------------------------------------
revoke all on table private.account_deletion_requests from public, anon, authenticated, service_role;
revoke all on table private.account_deletion_mails from public, anon, authenticated, service_role;
revoke all on table private.consent_evidence from public, anon, authenticated, service_role;
revoke all on table private.data_export_leftovers from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- data_exports
-- ---------------------------------------------------------------------------
revoke all on table public.data_exports from anon, authenticated;
grant select on table public.data_exports to authenticated;

drop policy if exists data_exports_select on public.data_exports;
create policy data_exports_select on public.data_exports
  for select to authenticated
  using (user_id = (select auth.uid()));

-- No insert, update or delete privilege: these policies only make sure that, even with
-- one, nobody would write the exports of another account, nor change or delete one.
drop policy if exists data_exports_insert on public.data_exports;
create policy data_exports_insert on public.data_exports
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists data_exports_update on public.data_exports;
create policy data_exports_update on public.data_exports
  for update to authenticated
  using (false)
  with check (false);

drop policy if exists data_exports_delete on public.data_exports;
create policy data_exports_delete on public.data_exports
  for delete to authenticated
  using (false);

-- ---------------------------------------------------------------------------
-- storage.objects, bucket data-exports
-- ---------------------------------------------------------------------------
-- The path of the file of an export is exactly <user_id>/<export_id>.zip. The policies read
-- data_exports with the permissions of the caller (only their own rows); data_exports never
-- reads storage.objects in a policy, so the two never ask each other.
drop policy if exists data_exports_files_insert on storage.objects;
create policy data_exports_files_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'data-exports'
    and exists (
      select 1
      from public.data_exports e
      where e.user_id = (select auth.uid())
        and e.status = 'preparing'
        and objects.name = e.user_id::text || '/' || e.id::text || '.zip'
    )
  );

-- Upload again (upsert) of the same file, while the export is preparing.
drop policy if exists data_exports_files_update on storage.objects;
create policy data_exports_files_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'data-exports'
    and exists (
      select 1
      from public.data_exports e
      where e.user_id = (select auth.uid())
        and e.status = 'preparing'
        and objects.name = e.user_id::text || '/' || e.id::text || '.zip'
    )
  )
  with check (
    bucket_id = 'data-exports'
    and exists (
      select 1
      from public.data_exports e
      where e.user_id = (select auth.uid())
        and e.status = 'preparing'
        and objects.name = e.user_id::text || '/' || e.id::text || '.zip'
    )
  );

drop policy if exists data_exports_files_select on storage.objects;
create policy data_exports_files_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'data-exports'
    and exists (
      select 1
      from public.data_exports e
      where e.user_id = (select auth.uid())
        and e.status = 'ready'
        and e.expires_at > now()
        and objects.name = e.user_id::text || '/' || e.id::text || '.zip'
    )
  );

-- No delete policy: the files go through the Storage API of the server (service_role).

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

-- Helpers, triggers and jobs: the database owner only.
revoke execute on function private.household_heir(uuid, uuid) from public, anon, authenticated, service_role;
revoke execute on function private.consent_subject_hmac(text) from public, anon, authenticated, service_role;
revoke execute on function private.data_export_file_exists(text) from public, anon, authenticated, service_role;
revoke execute on function private.consent_records_refuse_update() from public, anon, authenticated, service_role;
revoke execute on function private.delete_account(uuid, timestamptz) from public, anon, authenticated, service_role;
revoke execute on function private.data_exports_keep_leftover_file() from public, anon, authenticated, service_role;
revoke execute on function private.auth_sessions_cancel_account_deletion() from public, anon, authenticated, service_role;
revoke execute on function private.find_consent_evidence(text) from public, anon, authenticated, service_role;
revoke execute on function private.account_deletions(timestamptz) from public, anon, authenticated, service_role;
revoke execute on function private.data_exports_cleanup(timestamptz) from public, anon, authenticated, service_role;
revoke execute on function private.purge_account_deletion_mails(timestamptz) from public, anon, authenticated, service_role;
revoke execute on function private.purge_consent_evidence(timestamptz) from public, anon, authenticated, service_role;
revoke execute on function private.run_scheduled_account_jobs(timestamptz) from public, anon, authenticated, service_role;

-- The page: signed-in users only. set_consent(), delete_own_account(),
-- private.has_consent(), private.profiles_set_password_changed_at(),
-- private.notification_is_visible(), private.push_schedule() and private.push_content()
-- were replaced with the same signature and keep their grants.
revoke execute on function public.request_account_deletion(boolean) from public, anon;
revoke execute on function public.cancel_account_deletion() from public, anon;
revoke execute on function public.get_my_account_deletion() from public, anon;
revoke execute on function public.start_data_export() from public, anon;
revoke execute on function public.finish_data_export(uuid, bigint) from public, anon;
revoke execute on function public.fail_data_export(uuid) from public, anon;
revoke execute on function public.get_my_data_export() from public, anon;
grant execute on function public.request_account_deletion(boolean) to authenticated;
grant execute on function public.cancel_account_deletion() to authenticated;
grant execute on function public.get_my_account_deletion() to authenticated;
grant execute on function public.start_data_export() to authenticated;
grant execute on function public.finish_data_export(uuid, bigint) to authenticated;
grant execute on function public.fail_data_export(uuid) to authenticated;
grant execute on function public.get_my_data_export() to authenticated;

-- The server (administrative key) and the database owner, never authenticated or anon.
revoke execute on function public.take_account_deletion_mails(integer) from public, anon, authenticated;
revoke execute on function public.list_expired_data_exports(integer) from public, anon, authenticated;
revoke execute on function public.forget_data_export(uuid) from public, anon, authenticated;
revoke execute on function public.run_account_job(public.account_job, timestamptz) from public, anon, authenticated;
grant execute on function public.take_account_deletion_mails(integer) to service_role;
grant execute on function public.list_expired_data_exports(integer) to service_role;
grant execute on function public.forget_data_export(uuid) to service_role;
grant execute on function public.run_account_job(public.account_job, timestamptz) to service_role;
