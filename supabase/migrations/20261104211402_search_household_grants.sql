-- Issue #230: privileges of the search. No change to table privileges or policies.

-- Helpers: used only inside public.search_household(), which runs as the database owner.
revoke execute on function private.search_normalize(text) from public, anon, authenticated;
revoke execute on function private.search_matches(text, text[]) from public, anon, authenticated;

-- The search: signed-in users only, never anon.
revoke execute on function public.search_household(
  text, uuid, date, date, public.search_result_kind[]
) from public, anon;
grant execute on function public.search_household(
  text, uuid, date, date, public.search_result_kind[]
) to authenticated;
