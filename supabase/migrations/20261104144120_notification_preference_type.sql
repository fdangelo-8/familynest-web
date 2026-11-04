-- Issue #217 (for page #41 «Impostazioni della casa»): the five kinds of notification an
-- adult switches on or off, in the order of the page. Each value is also the name of a
-- boolean column of notification_preferences (table migration), and the argument of
-- set_notification_preference() (functions migration).
--   events          «Impegni e cambi d'orario»   on by default
--   assigned_todos  «Da fare assegnati a me»     on by default
--   shopping        «Spesa»                      off by default (mockup 28)
--   free_together   «Liberi insieme»             on by default
--   morning_digest  «Sintesi del mattino»        on by default
create type public.notification_preference as enum (
  'events',
  'assigned_todos',
  'shopping',
  'free_together',
  'morning_digest'
);
