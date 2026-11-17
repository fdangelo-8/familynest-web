-- Issue #418: usage limit of the reading of shop links (wish list). Every reading of a
-- shop link by an adult is counted here, one row per reading, by
-- public.claim_shop_link_read() (functions migration). The rows are deleted after 24 hours
-- by the pg_cron job (schedule_shop_link_reads_purge migration).
--
-- The table is in the private schema, which the Data API does not expose. No API role
-- (anon, authenticated, service_role) has any privilege on it, and RLS is enabled with no
-- policy: only the owner (postgres) reads and writes it, through the functions.
--
-- Only the Supabase Auth id of the account and the instant: no link, no shop, no data of
-- the household or of the children. The rows go with the account (on delete cascade).

create table private.shop_link_reads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- The count of the limits reads the rows of one account in a time window; the index also
-- serves the foreign key.
create index shop_link_reads_user_id_created_at_idx
  on private.shop_link_reads (user_id, created_at);

alter table private.shop_link_reads enable row level security;

revoke all on table private.shop_link_reads from public, anon, authenticated, service_role;
