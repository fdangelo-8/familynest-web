-- Issue #512: privileges of the new functions of the shopping list. No change to the
-- privileges or policies of the tables: private.removed_shopping_items stays without any
-- privilege for the API roles (only the security definer functions read and write it).
-- restore_shopping_items() keeps its grants (`create or replace`).

-- Internal helpers and the job: the database owner only (pg_cron, run_shopping_purge).
revoke execute on function private.shopping_taken_lifetime() from public, anon, authenticated, service_role;
revoke execute on function private.purge_taken_shopping_items(timestamptz, uuid)
  from public, anon, authenticated, service_role;

-- «Svuota tutta la lista»: signed-in users only (the function checks the household).
revoke execute on function public.clear_shopping_list() from public, anon;
grant execute on function public.clear_shopping_list() to authenticated;

-- The job for the tests, one household at a time: administrative key and database owner only.
revoke execute on function public.run_shopping_purge(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.run_shopping_purge(uuid, timestamptz) to service_role;
