-- Issue #62: changes of the shopping list are sent in real time to the open pages
-- (Realtime Postgres Changes).
-- - INSERT and UPDATE events: Realtime applies the RLS select policy to every
--   subscriber, so they reach only the members of the same household.
-- - DELETE events: RLS cannot be applied to a row that no longer exists, and
--   subscription filters do not apply to deletes. A DELETE event therefore reaches
--   EVERY subscriber of the table, members of other households included. The replica
--   identity stays the default (primary key), so the event carries only the id of the
--   removed item: never its name, quantity, household or author. Another household can
--   at most notice that "some item was removed from some list".
--   Rule for the app (page #21): ignore DELETE events whose id is not in the list on
--   screen; never rely on a household filter for deletes.
-- Accepted by the coordinator on 23/10/2026 (issue #62); full isolation would need
-- Realtime Broadcast on a private channel per household.

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'shopping_items'
  ) then
    alter publication supabase_realtime add table public.shopping_items;
  end if;
end;
$$;
