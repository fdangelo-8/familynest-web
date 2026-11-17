-- Issue #418: claim_shop_link_read() is for the signed-in adults only (the server action
-- of the wish list calls it with the session of the user). Not for anon, and not for the
-- administrative key: the limit is per account, and service_role has no account.
-- The purge runs only from pg_cron (as postgres): no API role can execute it, not even the
-- administrative key (lesson: the global work runs only from the pg_cron job, through a
-- private function). The table has no privilege for any API role (table migration).

revoke execute on function public.claim_shop_link_read()
  from public, anon, authenticated, service_role;
grant execute on function public.claim_shop_link_read() to authenticated;

revoke execute on function private.purge_shop_link_reads(timestamptz)
  from public, anon, authenticated, service_role;
