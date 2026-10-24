-- Issue #62: privileges and RLS policies of the shopping list.
--
-- Two layers, as in the base schema:
-- 1. Privileges: the app inserts only household_id, name and quantity, and updates
--    only checked_at. Author, times and the household of an existing item are set by
--    the database. anon has no privilege at all.
-- 2. RLS policies, `to authenticated` only: every adult with an account of the household
--    reads, adds, checks and unchecks; only taken items can be deleted. The page uses
--    clear_checked_shopping_items() for the strappo, so that Annulla is possible; a
--    direct delete removes the item without any copy.
-- Membership is checked with `household_id = (select public.current_household_id())`:
-- one account belongs to at most one household, the subquery runs once per statement.

-- ---------------------------------------------------------------------------
-- Privileges on the table
-- ---------------------------------------------------------------------------

revoke all on table public.shopping_items from anon, authenticated;
grant select on table public.shopping_items to authenticated;
-- No id: the database generates it, so an id seen elsewhere (for example in a realtime
-- DELETE event of another household) can never be reused to block an Annulla.
grant insert (household_id, name, quantity) on table public.shopping_items to authenticated;
grant update (checked_at) on table public.shopping_items to authenticated;
grant delete on table public.shopping_items to authenticated;

-- Items kept for Annulla: no privilege for the app (only the security definer
-- functions use the table; RLS without policies as a second barrier).
revoke all on table private.removed_shopping_items from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Privileges on functions
-- ---------------------------------------------------------------------------

-- Trigger and internal functions are never called directly.
revoke execute on function private.shopping_items_before_insert() from public, anon, authenticated;
revoke execute on function private.shopping_items_before_update() from public, anon, authenticated;
revoke execute on function private.purge_removed_shopping_items() from public, anon, authenticated;
revoke execute on function private.shopping_items_undo_window() from public, anon, authenticated;

-- Operations for signed-in users only.
revoke execute on function public.clear_checked_shopping_items(uuid[]) from public, anon;
revoke execute on function public.restore_shopping_items(uuid[]) from public, anon;
grant execute on function public.clear_checked_shopping_items(uuid[]) to authenticated;
grant execute on function public.restore_shopping_items(uuid[]) to authenticated;

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
