-- Issue #511 (DB-2 «Notifiche 2.0», plan #501), part 2 of 2: the new values of three
-- enumerated types. Only `alter type ... add value` in this migration: a value added with
-- ADD VALUE cannot be used in the transaction that adds it (LEZIONI, CA-41), so the
-- constraints, functions and jobs that use them come in the next migrations.

-- The new kinds of notification (rule 4 of #511):
--   member_joined     an adult entered the household with an invitation (answer 162)
--   event_reminder    «Avviso» of an event: some minutes before an occurrence
--   ride_reminder     «Avvisa chi porta e chi riprende»: the evening before and an hour
--                     before the way there or back
--   overlap_tomorrow  two occurrences of tomorrow overlap for the same person (at the time
--                     of the evening summary of the recipient)
--   ride_request      «Chiedi a Laura di portare Tommaso» (mn1-21)
alter type public.notification_kind add value if not exists 'member_joined';
alter type public.notification_kind add value if not exists 'event_reminder';
alter type public.notification_kind add value if not exists 'ride_reminder';
alter type public.notification_kind add value if not exists 'overlap_tomorrow';
alter type public.notification_kind add value if not exists 'ride_request';

-- The new switches of set_notification_preference(), each also a boolean column of
-- notification_preferences (next migration):
--   rides, event_reminders, deadlines, gifts     cb1-45 «che cosa fa suonare il tuo
--                                                telefono»: on by default
--   digest_events, digest_rides,                 «Sintesi del mattino» → «Che cosa c'è
--   digest_deadlines, digest_thanks              dentro» (mn1-16): on by default
--   digest_shopping                              off by default
alter type public.notification_preference add value if not exists 'rides';
alter type public.notification_preference add value if not exists 'event_reminders';
alter type public.notification_preference add value if not exists 'deadlines';
alter type public.notification_preference add value if not exists 'gifts';
alter type public.notification_preference add value if not exists 'digest_events';
alter type public.notification_preference add value if not exists 'digest_rides';
alter type public.notification_preference add value if not exists 'digest_deadlines';
alter type public.notification_preference add value if not exists 'digest_thanks';
alter type public.notification_preference add value if not exists 'digest_shopping';

-- The new jobs, for public.run_notification_job() (rule 9 of #511):
--   event_reminders  the reminders of the events (every 5 minutes)
--   ride_reminders   the reminders of the rides (every 5 minutes)
--   overlaps         the overlapping events of tomorrow (at the evening summary)
--   push_digests     the evening summaries and the morning digests to send
--   push_purge       devices unused for 90 days, closed deliveries after 2 days (3:00)
alter type public.notification_job add value if not exists 'event_reminders';
alter type public.notification_job add value if not exists 'ride_reminders';
alter type public.notification_job add value if not exists 'overlaps';
alter type public.notification_job add value if not exists 'push_digests';
alter type public.notification_job add value if not exists 'push_purge';
