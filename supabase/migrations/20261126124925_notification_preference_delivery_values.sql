-- Issue #511 (DB-2 «Notifiche 2.0»), part 1 of 2: two new switches of
-- set_notification_preference(), each also a boolean column of notification_preferences
-- (next migration):
--   quiet_hours   «Silenzio di notte · 22:00–7:00»            on by default
--   hide_content  «Nascondi il contenuto» (mn1-39)             off by default
-- The switches of cb1-45 (rides, event_reminders, deadlines, gifts) and of the content of
-- the morning digest come with part 2 of #511, with the notifications they control.
-- Only these statements in this migration: a value added with ADD VALUE cannot be used in
-- the transaction that adds it (LEZIONI, CA-41).
alter type public.notification_preference add value if not exists 'quiet_hours';
alter type public.notification_preference add value if not exists 'hide_content';
