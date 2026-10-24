-- Issue #62: pg_cron runs the scheduled cleanup of the items kept for "Annulla"
-- (schedule in the next migration). Supabase installs pg_cron in pg_catalog; its
-- objects live in the "cron" schema, which the Data API does not expose.
create extension if not exists pg_cron with schema pg_catalog;
