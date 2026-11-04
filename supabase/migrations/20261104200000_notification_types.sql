-- Issue #229 (for page #39 «Notifiche»): enumerated types of the notifications.
--
-- The kinds of notification (requirement of #39 §4, decisions of the coordinator of
-- 04/11). Only these five exist; «regali presi» (gift_taken) arrives with #32 in its own
-- migration (`alter type ... add value`, separate from the migration that uses it):
--   todo_assigned       «Da fare assegnato»: an adult assigns a thing to do to another
--                       adult with an account (trigger on todos)
--   deadline_reminder   «Scadenza vicina»: 30, 7, 1 or 0 days before a deadline, one of
--                       its reminders (job of 9:00, Europe/Rome)
--   free_together       «Liberi insieme»: the first evening from tomorrow to 7 days later
--                       with the window «Liberi insieme» of the recipient (job of 8:00)
--   event_time_changed  «Cambio d'orario»: an adult changes start or end of an event, the
--                       whole series or one occurrence (triggers on events and
--                       event_exceptions). Added and deleted events are not notified.
--   shopping_added      «Spesa raggruppata»: another member added things to the shopping
--                       list in the last 24 hours (job of 19:00)
create type public.notification_kind as enum (
  'todo_assigned',
  'deadline_reminder',
  'free_together',
  'event_time_changed',
  'shopping_added'
);

-- The scheduled jobs of the notifications, for public.run_notification_job() (tests of
-- page #39, service_role only). The schedule itself runs them at their time of Rome.
--   free_together       8:00
--   deadline_reminders  9:00
--   shopping_digest     19:00
--   purge               every day: notifications older than 30 days
create type public.notification_job as enum (
  'free_together',
  'deadline_reminders',
  'shopping_digest',
  'purge'
);
