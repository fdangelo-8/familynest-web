-- Issue #511 (DB-2 «Notifiche 2.0», plan #501), part 1 of 2: privileges and RLS policies.
--
-- Who can see what:
-- - notification_preferences: unchanged policies (#217), only the caller's own row. The
--   app also inserts and updates the four new choices.
-- - profiles: unchanged policies (only the caller's profile). The app also updates the
--   days of the morning digest.
-- - push_subscriptions: personal, also inside the household (administrators included).
--   The app reads only id, platform, created_at and last_seen_at of its own rows: no
--   privilege on endpoint, p256dh, auth and token (42501), no insert, update or delete
--   privilege (it uses register_push_subscription() and unregister_push_subscription()).
--   anon has no privilege at all. service_role keeps the default privileges of Supabase
--   (administrative key, server only).
-- - private.push_deliveries: no privilege for any API role (not even service_role, which
--   uses the functions of the sending service), RLS with no policy, schema not exposed.
-- - notifications: the select policy now uses private.notification_is_visible(id), the
--   single source shared with the push (same rules as before).
-- No policy reads another table directly; membership is checked with
-- `household_id = (select public.current_household_id())` and
-- `member_id = (select private.current_member_id())`.

-- ---------------------------------------------------------------------------
-- notification_preferences and profiles: the new columns the app may write
-- ---------------------------------------------------------------------------
grant insert (delivery_mode, evening_digest_time, quiet_hours, hide_content)
  on table public.notification_preferences to authenticated;
grant update (delivery_mode, evening_digest_time, quiet_hours, hide_content)
  on table public.notification_preferences to authenticated;

grant update (morning_digest_weekdays) on table public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- push_subscriptions
-- ---------------------------------------------------------------------------
revoke all on table public.push_subscriptions from anon, authenticated;
grant select (id, platform, created_at, last_seen_at) on table public.push_subscriptions to authenticated;

drop policy if exists push_subscriptions_select on public.push_subscriptions;
create policy push_subscriptions_select on public.push_subscriptions
  for select to authenticated
  using (
    household_id = (select public.current_household_id())
    and member_id = (select private.current_member_id())
  );

-- No insert, update or delete privilege: these policies only make sure that, even with
-- one, nobody would write the devices of another member.
drop policy if exists push_subscriptions_insert on public.push_subscriptions;
create policy push_subscriptions_insert on public.push_subscriptions
  for insert to authenticated
  with check (
    household_id = (select public.current_household_id())
    and member_id = (select private.current_member_id())
  );

drop policy if exists push_subscriptions_update on public.push_subscriptions;
create policy push_subscriptions_update on public.push_subscriptions
  for update to authenticated
  using (
    household_id = (select public.current_household_id())
    and member_id = (select private.current_member_id())
  )
  with check (
    household_id = (select public.current_household_id())
    and member_id = (select private.current_member_id())
  );

drop policy if exists push_subscriptions_delete on public.push_subscriptions;
create policy push_subscriptions_delete on public.push_subscriptions
  for delete to authenticated
  using (
    household_id = (select public.current_household_id())
    and member_id = (select private.current_member_id())
  );

-- ---------------------------------------------------------------------------
-- private.push_deliveries
-- ---------------------------------------------------------------------------
revoke all on table private.push_deliveries from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- notifications: one source for what the recipient may see
-- ---------------------------------------------------------------------------
-- Evaluated as the reader by the select policy: authenticated executes it (security
-- definer; for a signed-in caller it answers only about the caller's notifications).
revoke execute on function private.notification_is_visible(uuid) from public, anon;
grant execute on function private.notification_is_visible(uuid) to authenticated;

drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select to authenticated
  using (
    household_id = (select public.current_household_id())
    and recipient_member_id = (select private.current_member_id())
    and private.notification_is_visible(id)
  );

-- The previous version (#259), no longer used by any policy or function.
drop function private.notification_is_visible(public.notification_kind, uuid, uuid, uuid, date, uuid);

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

-- Helpers and jobs: the database owner only.
revoke execute on function private.event_open_to_member(uuid, uuid) from public, anon, authenticated;
revoke execute on function private.push_content(uuid) from public, anon, authenticated;
revoke execute on function private.push_purge(timestamptz, uuid) from public, anon, authenticated;

-- The page: signed-in users only. set_notification_preference() was replaced with the same
-- signature and keeps its grants (#217).
revoke execute on function public.set_notification_options(
  public.notification_delivery_mode, time, smallint[]
) from public, anon;
revoke execute on function public.register_push_subscription(
  public.push_platform, text, text, text, text
) from public, anon;
revoke execute on function public.unregister_push_subscription(text, text) from public, anon;
grant execute on function public.set_notification_options(
  public.notification_delivery_mode, time, smallint[]
) to authenticated;
grant execute on function public.register_push_subscription(
  public.push_platform, text, text, text, text
) to authenticated;
grant execute on function public.unregister_push_subscription(text, text) to authenticated;

-- The sending service: service_role (administrative key, server only) and the database
-- owner, never authenticated or anon.
revoke execute on function public.claim_push_deliveries(integer, timestamptz) from public, anon, authenticated;
revoke execute on function public.list_push_targets(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.get_push_content(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.complete_push_delivery(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.fail_push_delivery(uuid, uuid, timestamptz) from public, anon, authenticated;
revoke execute on function public.remove_push_subscription(uuid) from public, anon, authenticated;
grant execute on function public.claim_push_deliveries(integer, timestamptz) to service_role;
grant execute on function public.list_push_targets(uuid, uuid) to service_role;
grant execute on function public.get_push_content(uuid, uuid) to service_role;
grant execute on function public.complete_push_delivery(uuid, uuid) to service_role;
grant execute on function public.fail_push_delivery(uuid, uuid, timestamptz) to service_role;
grant execute on function public.remove_push_subscription(uuid) to service_role;
