-- Issue #414: revoke privileges that no role of the Data API needs.
--
-- 1. public.rls_auto_enable(): event trigger function created by Supabase on the hosted
--    project when automatic RLS activation was turned on. It is not created by any
--    migration of this repository, so it does not exist on a database built from the
--    migrations (local stack, CI). The revoke runs only where the function exists.
--    Event trigger functions are fired by the database itself; no role ever calls them.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end
$$;

-- 2. invitations: anon has no policy (it read 0 rows anyway) and no code path reads the
--    table without a session; the invitation entry page uses invitation_preview()
--    (security definer). authenticated keeps select, still filtered by the policies.
revoke select on table public.invitations from anon;
