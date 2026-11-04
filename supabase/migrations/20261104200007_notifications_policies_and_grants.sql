-- Issue #229 (for page #39 «Notifiche»): privileges and RLS policies of the notifications.
--
-- Two layers, as for the other tables:
-- 1. Privileges: the app only reads notifications (select). It never inserts, changes or
--    deletes them directly (requirement of #229 point 3): the database writes them
--    (security definer triggers and jobs), mark_notifications_read() sets read_at, the
--    cleanup job and the foreign keys delete them. anon has no privilege at all.
--    service_role keeps the default privileges of Supabase (administrative key, used by
--    the page tests to prepare notifications at a given time).
--    private.shopping_additions: no privilege for any API role.
-- 2. RLS policies, `to authenticated` only. Notifications are personal (requirement §1,
--    CA-37, CA-38): only the recipient reads them, in their own household; the other adults
--    of the same household (administrators included) and every other household read 0
--    rows. A notification whose element of origin the recipient can no longer read is not
--    returned either (private.notification_is_visible, CA-21), so the page and the bell
--    never show or count it.
--    There is no insert, update or delete policy: without a privilege and without a policy
--    every direct write is refused.
-- Membership is checked with `household_id = (select public.current_household_id())` and
-- `recipient_member_id = (select private.current_member_id())`. The policy reads the
-- tables of origin (todos, deadlines, events, event_exceptions) through their own RLS;
-- none of their policies reads notifications, so policies never call each other.

-- ---------------------------------------------------------------------------
-- Privileges on the tables
-- ---------------------------------------------------------------------------

revoke all on table public.notifications from anon, authenticated;
grant select on table public.notifications to authenticated;

revoke all on table private.shopping_additions from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Privileges on functions
-- ---------------------------------------------------------------------------

-- Trigger functions, never called directly.
revoke execute on function private.todos_notify_assignee() from public, anon, authenticated;
revoke execute on function private.events_notify_time_change() from public, anon, authenticated;
revoke execute on function private.event_exceptions_notify_time_change() from public, anon, authenticated;
revoke execute on function private.shopping_items_record_addition() from public, anon, authenticated;

-- Internal helpers and jobs: the database owner only (triggers, pg_cron, run_notification_job).
revoke execute on function private.notification_recipient_wants(uuid, public.notification_preference)
  from public, anon, authenticated;
revoke execute on function private.notification_actor(uuid) from public, anon, authenticated;
revoke execute on function private.free_together_start(uuid, date) from public, anon, authenticated;
revoke execute on function private.notifications_free_together(timestamptz, uuid) from public, anon, authenticated;
revoke execute on function private.notifications_deadline_reminders(timestamptz, uuid) from public, anon, authenticated;
revoke execute on function private.notifications_shopping_digest(timestamptz, uuid) from public, anon, authenticated;
revoke execute on function private.purge_notifications(timestamptz, uuid) from public, anon, authenticated;
revoke execute on function private.run_scheduled_notification_jobs(timestamptz) from public, anon, authenticated;

-- Used by the select policy, evaluated as the reader. The private schema is not exposed
-- by the Data API: the app cannot call it as RPC.
revoke execute on function private.notification_is_visible(
  public.notification_kind, uuid, uuid, uuid, date
) from public, anon;
grant execute on function private.notification_is_visible(
  public.notification_kind, uuid, uuid, uuid, date
) to authenticated;

-- Operations for signed-in users only.
revoke execute on function public.mark_notifications_read(uuid[]) from public, anon;
revoke execute on function public.count_unread_notifications() from public, anon;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;
grant execute on function public.count_unread_notifications() to authenticated;

-- The jobs for the tests, one household at a time: administrative key and database owner only.
revoke execute on function public.run_notification_job(public.notification_job, uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.run_notification_job(public.notification_job, uuid, timestamptz) to service_role;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------

drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select to authenticated
  using (
    household_id = (select public.current_household_id())
    and recipient_member_id = (select private.current_member_id())
    and private.notification_is_visible(kind, todo_id, deadline_id, event_id, occurrence_date)
  );

-- No insert, update or delete policy (see the header).
