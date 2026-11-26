-- Issue #511 (DB-2 «Notifiche 2.0», plan #501), part 2 of 2: privileges.
--
-- Who can see what (no policy changes in this migration):
-- - notification_preferences: unchanged policies (#217), only the caller's own row. The
--   app also inserts and updates the nine new switches.
-- - profiles: unchanged policies (only the caller's profile). The app does not write
--   morning_digest_intro_seen_at: only mark_morning_digest_intro_seen() does, once.
-- - notifications: unchanged select policy (private.notification_is_visible(id), the single
--   source shared with the push, now with the rules of the five new kinds). The app still
--   never writes notifications: request_ride() and the database do.
-- - private.push_digest_items: no privilege for any API role (not even service_role), RLS
--   with no policy, schema not exposed.
-- - get_morning_digest() and request_ride() act only for the member of the verified
--   session: another household never reads or writes anything of the caller's household
--   through them.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
grant insert (rides, event_reminders, deadlines, gifts, digest_events, digest_rides, digest_deadlines,
              digest_thanks, digest_shopping)
  on table public.notification_preferences to authenticated;
grant update (rides, event_reminders, deadlines, gifts, digest_events, digest_rides, digest_deadlines,
              digest_thanks, digest_shopping)
  on table public.notification_preferences to authenticated;

revoke all on table private.push_digest_items from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

-- Helpers, trigger functions and jobs: the database owner only (triggers, pg_cron,
-- run_notification_job, the security definer functions).
revoke execute on function private.event_occurrence_on(uuid, date) from public, anon, authenticated;
revoke execute on function private.push_ring_at(timestamptz, boolean) from public, anon, authenticated;
revoke execute on function private.push_schedule(uuid, boolean) from public, anon, authenticated;
revoke execute on function private.notifications_schedule_push() from public, anon, authenticated;
revoke execute on function private.morning_digest(uuid, date) from public, anon, authenticated;
revoke execute on function private.notifications_event_reminders(timestamptz, uuid) from public, anon, authenticated;
revoke execute on function private.notifications_ride_reminders(timestamptz, uuid) from public, anon, authenticated;
revoke execute on function private.notifications_overlaps(timestamptz, uuid) from public, anon, authenticated;
revoke execute on function private.push_digests(timestamptz, uuid) from public, anon, authenticated;

-- The page: signed-in users only. get_notification_preferences() was dropped and created
-- again: its grants are set again here, as in #217. set_notification_preference(),
-- get_push_content(), accept_invitation_with_color(), run_notification_job() and the
-- functions replaced in private keep their grants (same signatures).
revoke execute on function public.get_notification_preferences() from public, anon;
revoke execute on function public.mark_morning_digest_intro_seen() from public, anon;
revoke execute on function public.get_morning_digest(date) from public, anon;
revoke execute on function public.request_ride(uuid, date, public.ride_leg, uuid) from public, anon;
grant execute on function public.get_notification_preferences() to authenticated;
grant execute on function public.mark_morning_digest_intro_seen() to authenticated;
grant execute on function public.get_morning_digest(date) to authenticated;
grant execute on function public.request_ride(uuid, date, public.ride_leg, uuid) to authenticated;
