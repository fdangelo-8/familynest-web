-- Issue #62: changes of the shopping list are sent in real time to the open pages.
-- Realtime applies the RLS select policy to every subscriber, so changes reach only
-- the members of the same household. The replica identity stays the default (primary
-- key): delete events carry only the id of the item, never its content.

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
