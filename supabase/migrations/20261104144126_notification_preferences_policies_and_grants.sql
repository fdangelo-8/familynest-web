-- Issue #217: privileges and RLS policies of the notification preferences (page #41).
--
-- Two layers, as for space_interests:
-- 1. Privileges: the app reads its row, inserts and updates only the five choices (never
--    id, household, member or times: the database sets them) and deletes its row (back to
--    the defaults). anon has no privilege at all. service_role keeps the default
--    privileges of Supabase (administrative key, used by tests and by #39).
-- 2. RLS policies, `to authenticated` only. Choices are personal (issue #41, question 1):
--    every policy allows only the row of the caller's own member, in the caller's own
--    household. The other adults of the same household (administrators included) and
--    every other household read 0 rows and cannot insert, change or delete it.
-- The page uses get_notification_preferences() and set_notification_preference(); a
-- direct insert or update goes through the same trigger and policies.
-- Membership is checked with `household_id = (select public.current_household_id())`
-- and `member_id = (select private.current_member_id())`. No policy reads another table.

-- ---------------------------------------------------------------------------
-- Privileges on the table
-- ---------------------------------------------------------------------------

revoke all on table public.notification_preferences from anon, authenticated;
grant select on table public.notification_preferences to authenticated;
-- Only the five choices (LEZIONI: never insert on id).
grant insert (events, assigned_todos, shopping, free_together, morning_digest)
  on table public.notification_preferences to authenticated;
grant update (events, assigned_todos, shopping, free_together, morning_digest)
  on table public.notification_preferences to authenticated;
grant delete on table public.notification_preferences to authenticated;

-- ---------------------------------------------------------------------------
-- Privileges on functions
-- ---------------------------------------------------------------------------

-- Trigger function, never called directly.
revoke execute on function private.notification_preferences_before_insert() from public, anon, authenticated;

-- Operations for signed-in users only.
revoke execute on function public.get_notification_preferences() from public, anon;
revoke execute on function public.set_notification_preference(public.notification_preference, boolean) from public, anon;
grant execute on function public.get_notification_preferences() to authenticated;
grant execute on function public.set_notification_preference(public.notification_preference, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------

drop policy if exists notification_preferences_select on public.notification_preferences;
create policy notification_preferences_select on public.notification_preferences
  for select to authenticated
  using (
    household_id = (select public.current_household_id())
    and member_id = (select private.current_member_id())
  );

-- The household and the member are set by the before insert trigger.
drop policy if exists notification_preferences_insert on public.notification_preferences;
create policy notification_preferences_insert on public.notification_preferences
  for insert to authenticated
  with check (
    household_id = (select public.current_household_id())
    and member_id = (select private.current_member_id())
  );

drop policy if exists notification_preferences_update on public.notification_preferences;
create policy notification_preferences_update on public.notification_preferences
  for update to authenticated
  using (
    household_id = (select public.current_household_id())
    and member_id = (select private.current_member_id())
  )
  with check (
    household_id = (select public.current_household_id())
    and member_id = (select private.current_member_id())
  );

drop policy if exists notification_preferences_delete on public.notification_preferences;
create policy notification_preferences_delete on public.notification_preferences
  for delete to authenticated
  using (
    household_id = (select public.current_household_id())
    and member_id = (select private.current_member_id())
  );
