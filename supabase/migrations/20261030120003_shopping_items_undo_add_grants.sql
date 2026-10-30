-- Issue #110: privileges of the «Annulla» after an addition to the shopping list.
-- No change to the table privileges or policies of shopping_items: the app still
-- deletes directly only taken items (strappo rules of #62); items to buy are removed
-- only through undo_added_shopping_items(), with its stricter conditions.

-- Internal function, never called directly.
revoke execute on function private.shopping_items_undo_add_window() from public, anon, authenticated;

-- Operation for signed-in users only.
revoke execute on function public.undo_added_shopping_items(uuid[]) from public, anon;
grant execute on function public.undo_added_shopping_items(uuid[]) to authenticated;
