-- Issue #62: privileges and RLS policies of the shopping list.
--
-- Two layers, as in the base schema:
-- 1. Privileges: the app inserts only id, household_id, name and quantity, and updates
--    only checked_at. Author, times and the household of an existing item are set by
--    the database. anon has no privilege at all.
-- 2. RLS policies, `to authenticated` only: every adult with an account of the household
--    reads, adds, checks and unchecks; only taken items can be deleted (strappo).
-- Membership is checked with `household_id = (select public.current_household_id())`:
-- one account belongs to at most one household, the subquery runs once per statement.

-- ---------------------------------------------------------------------------
-- Privileges on the table
-- ---------------------------------------------------------------------------

revoke all on table public.shopping_items from anon, authenticated;
grant select on table public.shopping_items to authenticated;
grant insert (id, household_id, name, quantity) on table public.shopping_items to authenticated;
grant update (checked_at) on table public.shopping_items to authenticated;
grant delete on table public.shopping_items to authenticated;

-- ---------------------------------------------------------------------------
-- Privileges on functions
-- ---------------------------------------------------------------------------

-- Trigger functions are never called directly.
revoke execute on function private.shopping_items_before_insert() from public, anon, authenticated;
revoke execute on function private.shopping_items_before_update() from public, anon, authenticated;

-- Operations for signed-in users only.
revoke execute on function public.clear_checked_shopping_items(uuid[]) from public, anon;
revoke execute on function public.restore_shopping_items(jsonb) from public, anon;
grant execute on function public.clear_checked_shopping_items(uuid[]) to authenticated;
grant execute on function public.restore_shopping_items(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------

drop policy if exists shopping_items_select on public.shopping_items;
create policy shopping_items_select on public.shopping_items
  for select to authenticated
  using (household_id = (select public.current_household_id()));

-- New items are always to buy (the author is set by the before insert trigger).
drop policy if exists shopping_items_insert on public.shopping_items;
create policy shopping_items_insert on public.shopping_items
  for insert to authenticated
  with check (
    household_id = (select public.current_household_id())
    and checked_at is null
  );

-- Check and uncheck (column grant on checked_at only).
drop policy if exists shopping_items_update on public.shopping_items;
create policy shopping_items_update on public.shopping_items
  for update to authenticated
  using (household_id = (select public.current_household_id()))
  with check (household_id = (select public.current_household_id()));

-- Only taken items can be removed (strappo); an item to buy is never deleted.
drop policy if exists shopping_items_delete on public.shopping_items;
create policy shopping_items_delete on public.shopping_items
  for delete to authenticated
  using (
    household_id = (select public.current_household_id())
    and checked_at is not null
  );
