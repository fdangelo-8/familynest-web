-- Issue #266: privileges and RLS policies of the linked calendars.
--
-- Two layers, as for the other tables:
-- 1. Privileges:
--    - calendar_accounts: the app reads every column of its own accounts except the
--      credentials and the id of the account at the provider (a select of those columns,
--      or of `*`, is refused with 42501), and deletes its own accounts («Scollega»). It
--      never inserts nor changes them: the synchronisation service does, through the
--      functions of the linked_calendars_server_functions migration;
--    - external_calendars: the app reads every column of its own calendars except the
--      position of the synchronisation at the provider, and changes only the five choices
--      of #34 §5 (switched on, direction, visibility, «Liberi insieme», «Solo giorni
--      feriali»). «Dove vanno i nuovi impegni» changes with set_new_events_calendar();
--    - event_external_links, calendar_outbox, calendar_credential_revocations: no privilege
--      at all for the API roles (richiesta-db points 4, 7, 8);
--    - anon has no privilege on any of these tables.
--    service_role keeps the default privileges of Supabase (administrative key, used only
--    by the synchronisation service inside Supabase and by the page tests to prepare data).
-- 2. RLS policies, `to authenticated` only. Accounts and calendars are personal (#34 §1):
--    only the adult who linked them reads, changes and deletes them; the other adults of
--    the same household (administrators included) and every other household read 0 rows
--    and change nothing. There is no insert policy (and no insert privilege): every direct
--    insert is refused. The three other tables have RLS without any policy: even with a
--    privilege, an API role would read and write 0 rows.
-- Membership is checked with `household_id = (select public.current_household_id())` and
-- `member_id = (select private.current_member_id())`, evaluated once per statement. No
-- policy reads another table, so policies never call each other.

-- ---------------------------------------------------------------------------
-- Privileges on the tables
-- ---------------------------------------------------------------------------

revoke all on table public.calendar_accounts from anon, authenticated;
grant select (
  id, household_id, member_id, member_kind, provider, email, status, failing_since, last_synced_at,
  connected_at, is_fake, created_at, updated_at
) on table public.calendar_accounts to authenticated;
grant delete on table public.calendar_accounts to authenticated;

revoke all on table public.external_calendars from anon, authenticated;
grant select (
  id, household_id, member_id, account_id, name, is_primary, is_read_only, is_enabled, direction,
  visibility, counts_for_free_time, weekdays_only, is_new_events_target, last_synced_at,
  failing_since, created_at, updated_at
) on table public.external_calendars to authenticated;
grant update (is_enabled, direction, visibility, counts_for_free_time, weekdays_only)
  on table public.external_calendars to authenticated;

revoke all on table public.event_external_links from anon, authenticated;
revoke all on table public.calendar_outbox from anon, authenticated;
revoke all on table public.calendar_credential_revocations from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Privileges on functions
-- ---------------------------------------------------------------------------

-- Trigger functions, never called directly.
revoke execute on function private.calendar_accounts_before_write() from public, anon, authenticated;
revoke execute on function private.calendar_accounts_after_delete() from public, anon, authenticated;
revoke execute on function private.external_calendars_before_write() from public, anon, authenticated;
revoke execute on function private.external_calendars_after_write() from public, anon, authenticated;
revoke execute on function private.event_external_links_after_delete() from public, anon, authenticated;
revoke execute on function private.events_guard_imported() from public, anon, authenticated;
revoke execute on function private.event_members_guard_imported() from public, anon, authenticated;
revoke execute on function private.events_queue_sent_update() from public, anon, authenticated;
revoke execute on function private.event_exceptions_queue_sent_update() from public, anon, authenticated;
revoke execute on function private.events_queue_sent_delete() from public, anon, authenticated;

-- Internal helpers: the database owner only (security definer functions and triggers).
revoke execute on function private.queue_sent_event_update(uuid) from public, anon, authenticated;
revoke execute on function private.external_text(text, text) from public, anon, authenticated;
revoke execute on function private.imported_event_visibility(public.event_visibility, boolean)
  from public, anon, authenticated;

-- Used by the guard triggers of events, event_members and external_calendars, evaluated as
-- the caller. The private schema is not exposed by the Data API: the app cannot call them
-- as RPC.
revoke execute on function private.is_imported_event(uuid) from public, anon;
revoke execute on function private.is_private_imported_event(uuid) from public, anon;
revoke execute on function private.mark_imported_visibility_overridden(uuid) from public, anon;
revoke execute on function private.external_calendar_is_target_eligible(public.external_calendars) from public, anon;
grant execute on function private.is_imported_event(uuid) to authenticated;
grant execute on function private.is_private_imported_event(uuid) to authenticated;
grant execute on function private.mark_imported_visibility_overridden(uuid) to authenticated;
grant execute on function private.external_calendar_is_target_eligible(public.external_calendars) to authenticated;

-- The synchronisation service: administrative key and database owner only.
revoke execute on function public.save_calendar_account(
  uuid, public.calendar_provider, text, text, text, boolean
) from public, anon, authenticated;
revoke execute on function public.save_external_calendars(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.sync_external_calendar_events(uuid, jsonb, boolean, text, timestamptz)
  from public, anon, authenticated;
revoke execute on function public.record_calendar_sync_result(uuid, public.calendar_sync_outcome, timestamptz)
  from public, anon, authenticated;
revoke execute on function public.mark_external_calendar_failing(uuid, timestamptz) from public, anon, authenticated;
revoke execute on function public.complete_calendar_outbox_item(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.fail_calendar_outbox_item(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.save_calendar_account(
  uuid, public.calendar_provider, text, text, text, boolean
) to service_role;
grant execute on function public.save_external_calendars(uuid, jsonb) to service_role;
grant execute on function public.sync_external_calendar_events(uuid, jsonb, boolean, text, timestamptz)
  to service_role;
grant execute on function public.record_calendar_sync_result(uuid, public.calendar_sync_outcome, timestamptz)
  to service_role;
grant execute on function public.mark_external_calendar_failing(uuid, timestamptz) to service_role;
grant execute on function public.complete_calendar_outbox_item(uuid, text, text) to service_role;
grant execute on function public.fail_calendar_outbox_item(uuid, timestamptz) to service_role;

-- The pages: signed-in users only. complete_starter_list() keeps the grants of #90.
revoke execute on function public.set_new_events_calendar(uuid) from public, anon;
revoke execute on function public.set_event_also_on(uuid, boolean) from public, anon;
revoke execute on function public.get_event_calendar_link(uuid) from public, anon;
revoke execute on function public.count_imported_events(timestamptz) from public, anon;
grant execute on function public.set_new_events_calendar(uuid) to authenticated;
grant execute on function public.set_event_also_on(uuid, boolean) to authenticated;
grant execute on function public.get_event_calendar_link(uuid) to authenticated;
grant execute on function public.count_imported_events(timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- calendar_accounts: only the adult who linked them
-- ---------------------------------------------------------------------------

drop policy if exists calendar_accounts_select on public.calendar_accounts;
create policy calendar_accounts_select on public.calendar_accounts
  for select to authenticated
  using (
    household_id = (select public.current_household_id())
    and member_id = (select private.current_member_id())
  );

-- No insert policy: accounts are written by the synchronisation service only.

-- No update policy: the state of an account is written by the synchronisation service only.

-- «Scollega»: the credentials go to the revocation queue, calendars and imported events go
-- with the account (triggers and foreign keys).
drop policy if exists calendar_accounts_delete on public.calendar_accounts;
create policy calendar_accounts_delete on public.calendar_accounts
  for delete to authenticated
  using (
    household_id = (select public.current_household_id())
    and member_id = (select private.current_member_id())
  );

-- ---------------------------------------------------------------------------
-- external_calendars: only the adult of the account
-- ---------------------------------------------------------------------------

drop policy if exists external_calendars_select on public.external_calendars;
create policy external_calendars_select on public.external_calendars
  for select to authenticated
  using (
    household_id = (select public.current_household_id())
    and member_id = (select private.current_member_id())
  );

-- No insert policy: calendars are written by the synchronisation service only.

-- The five choices of #34 §5 (column grant); their effects are triggers.
drop policy if exists external_calendars_update on public.external_calendars;
create policy external_calendars_update on public.external_calendars
  for update to authenticated
  using (
    household_id = (select public.current_household_id())
    and member_id = (select private.current_member_id())
  )
  with check (
    household_id = (select public.current_household_id())
    and member_id = (select private.current_member_id())
  );

-- No delete policy: a calendar goes when the provider no longer lists it or its account
-- is unlinked.

-- event_external_links, calendar_outbox, calendar_credential_revocations: no policy (see
-- the header).
