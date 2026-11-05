-- Issue #266 (for #34 Calendari collegati, decision F1 = B of Francesco, 05/11): the job
-- that runs every 15 minutes (schedule_calendar_jobs migration) asks the synchronisation
-- service inside Supabase to work, with an HTTP call made by pg_net. pg_net keeps its
-- objects in the "net" schema, which the Data API does not expose.
create extension if not exists pg_net with schema extensions;
