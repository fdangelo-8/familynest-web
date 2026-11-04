-- Issue #218: who may call the account deletion functions.
-- Signed-in users only: anon (and every role through public) cannot call them.
-- service_role keeps the default privileges of Supabase (administrative key, server only);
-- without a signed-in user delete_own_account() refuses with 42501 anyway.

revoke execute on function public.delete_own_account(boolean) from public, anon;
revoke execute on function public.get_account_deletion_outcome() from public, anon;
grant execute on function public.delete_own_account(boolean) to authenticated;
grant execute on function public.get_account_deletion_outcome() to authenticated;
