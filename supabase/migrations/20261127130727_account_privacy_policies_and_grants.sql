-- Issue #513 (DB-4 «Account e privacy», plan #501), part 1 of 2: privileges and RLS
-- policies.
--
-- Who can see what:
-- - legal_document_versions: not personal data. Everyone reads it, also without a session
--   (the page «Crea account» and the public legal pages). Nobody writes it from the API:
--   versions come only with migrations (no privilege, no write policy).
-- - consent_records: personal to the account. Each adult reads only their own rows; the
--   other adults of the household (administrators included) and every other household read
--   0 rows; anon has no privilege at all. Nobody inserts, changes or deletes a row from the
--   API (no privilege: 42501): only the functions of the database write it, and the rows go
--   with the account.
-- - profiles: unchanged policies (only the caller's profile). The app also updates the
--   appearance; it reads but never writes password_changed_at (no privilege: 42501).
-- - push_subscriptions: unchanged; session_id is not readable by the app.
-- - auth.sessions: never readable by the API roles; list_my_sessions(), end_my_session()
--   and end_my_other_sessions() see only the sessions of the verified account.
-- service_role keeps the default privileges of Supabase (administrative key, server only).

-- ---------------------------------------------------------------------------
-- legal_document_versions
-- ---------------------------------------------------------------------------
revoke all on table public.legal_document_versions from anon, authenticated;
grant select on table public.legal_document_versions to anon, authenticated;

drop policy if exists legal_document_versions_select on public.legal_document_versions;
create policy legal_document_versions_select on public.legal_document_versions
  for select to anon, authenticated
  using (true);

-- No insert, update or delete policy (and no privilege): written only by migrations.

-- ---------------------------------------------------------------------------
-- consent_records
-- ---------------------------------------------------------------------------
revoke all on table public.consent_records from anon, authenticated;
grant select on table public.consent_records to authenticated;

drop policy if exists consent_records_select on public.consent_records;
create policy consent_records_select on public.consent_records
  for select to authenticated
  using (user_id = (select auth.uid()));

-- No insert, update or delete privilege: these policies only make sure that, even with
-- one, nobody would write the consents of another account, nor change or delete one.
drop policy if exists consent_records_insert on public.consent_records;
create policy consent_records_insert on public.consent_records
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists consent_records_update on public.consent_records;
create policy consent_records_update on public.consent_records
  for update to authenticated
  using (false)
  with check (false);

drop policy if exists consent_records_delete on public.consent_records;
create policy consent_records_delete on public.consent_records
  for delete to authenticated
  using (false);

-- ---------------------------------------------------------------------------
-- profiles: the appearance (A18 #551)
-- ---------------------------------------------------------------------------
grant update (appearance) on table public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

-- Helpers and triggers: the database owner only.
revoke execute on function private.current_legal_version(public.legal_document) from public, anon, authenticated;
revoke execute on function private.legal_versions_are_current(uuid, uuid) from public, anon, authenticated;
revoke execute on function private.current_session_id() from public, anon, authenticated;
revoke execute on function private.session_device_kind(text) from public, anon, authenticated;
revoke execute on function private.record_signup_consents() from public, anon, authenticated;
revoke execute on function private.has_consent(uuid, public.consent_kind) from public, anon, authenticated;
revoke execute on function private.profiles_set_password_changed_at() from public, anon, authenticated;

-- Versions: everyone, also without a session.
revoke execute on function public.get_legal_versions() from public;
grant execute on function public.get_legal_versions() to anon, authenticated;

-- The page: signed-in users only. register_push_subscription() was replaced with the same
-- signature and keeps its grants (DB-2).
revoke execute on function public.accept_required_consents(uuid, uuid, boolean) from public, anon;
revoke execute on function public.set_consent(public.consent_kind, boolean, public.consent_source) from public, anon;
revoke execute on function public.get_my_consents() from public, anon;
revoke execute on function public.get_privacy_update() from public, anon;
revoke execute on function public.mark_privacy_version_read(uuid) from public, anon;
revoke execute on function public.mark_password_changed() from public, anon;
revoke execute on function public.list_my_sessions() from public, anon;
revoke execute on function public.end_my_session(uuid) from public, anon;
revoke execute on function public.end_my_other_sessions() from public, anon;
grant execute on function public.accept_required_consents(uuid, uuid, boolean) to authenticated;
grant execute on function public.set_consent(public.consent_kind, boolean, public.consent_source) to authenticated;
grant execute on function public.get_my_consents() to authenticated;
grant execute on function public.get_privacy_update() to authenticated;
grant execute on function public.mark_privacy_version_read(uuid) to authenticated;
grant execute on function public.mark_password_changed() to authenticated;
grant execute on function public.list_my_sessions() to authenticated;
grant execute on function public.end_my_session(uuid) to authenticated;
grant execute on function public.end_my_other_sessions() to authenticated;
