-- Issue #90: privileges of the starter list and welcome functions.
-- No change to the table privileges or policies of households: the new columns are read
-- with the existing select grant and households_select policy (members of the household
-- only), and they are not in the update grant (name, household_type), so the app can
-- never write them.

-- Trigger functions are never called directly.
revoke execute on function private.shopping_items_record_first_item() from public, anon, authenticated;

-- Operations for signed-in users only.
revoke execute on function public.complete_starter_list() from public, anon;
revoke execute on function public.current_member_welcome() from public, anon;
grant execute on function public.complete_starter_list() to authenticated;
grant execute on function public.current_member_welcome() to authenticated;
