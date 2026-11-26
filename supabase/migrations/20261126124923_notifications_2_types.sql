-- Issue #511 (DB-2 «Notifiche 2.0», plan #501), part 1 of 2: the new enumerated types of
-- the push notifications. Only types in this migration (convenzioni-supabase); the tables
-- and the functions that use them come in the next migrations.

-- The kind of device that receives the push notifications (decision of Francesco of
-- 25/11/2026, #397: three kinds from the first day, even if at launch only the web is
-- used):
--   web   Web Push (browser, also the web app on the phone): endpoint + keys
--   apns  Apple Push Notification service (the iPhone app of N0–N5): device token
--   fcm   Firebase Cloud Messaging (the Android app of N0–N5): registration token
create type public.push_platform as enum ('web', 'apns', 'fcm');

-- «Come vuoi riceverle» (A18): when the phone rings for a notification.
--   each         «Ogni avviso»: every notification at once
--   mine_now     «Subito quelle per me» (default): the «Tocca a te» ones at once, the rest
--                in the evening summary
--   digest_only  «Solo il riepilogo»: everything in the evening summary
-- The rules that apply them (private.push_deliveries) come with part 2 of #511.
create type public.notification_delivery_mode as enum ('each', 'mine_now', 'digest_only');

-- What one push delivery carries (private.push_deliveries):
--   single          one notification
--   evening_digest  the evening summary of a recipient («Il riepilogo»)
--   morning_digest  the morning digest of a recipient («Sintesi del mattino»)
create type public.push_delivery_kind as enum ('single', 'evening_digest', 'morning_digest');

-- The lines of the morning digest (get_morning_digest() and get_push_content(), part 2 of
-- #511). Created now so that get_push_content() has its final columns from the start.
--   events, ride, todos, deadlines_today, deadlines_tomorrow, shopping, free_together
create type public.morning_digest_line as enum (
  'events',
  'ride',
  'todos',
  'deadlines_today',
  'deadlines_tomorrow',
  'shopping',
  'free_together'
);
