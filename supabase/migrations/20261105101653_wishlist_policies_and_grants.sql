-- Issue #259: privileges and RLS policies of the wish list.
--
-- Two layers, as for the other tables:
-- 1. Privileges: the app only reads (select) the tables of the wish list, with the session
--    of an adult of the household. It never inserts, changes or deletes them directly: the
--    page functions (add_wishlist_item, update_wishlist_item, delete_wishlist_item,
--    share_wishlist, disable_wishlist_share_link) and the public function
--    reserve_public_wishlist_item are the only writers. So no insert privilege on id,
--    household, author, code or times can exist (LEZIONI).
--    The fingerprint of the browser key of a giver (wishlist_reservations.giver_key_hash)
--    is not readable by the app: the select privilege of that table lists its columns.
--    anon has no privilege at all on any table: the public page reads only through
--    get_public_wishlist() and get_public_wishlist_photo().
--    service_role keeps the default privileges of Supabase (administrative key, used by the
--    page tests to prepare lists, links and reservations).
-- 2. RLS policies, `to authenticated` only: every adult with an account of the household,
--    administrator or not, reads the list of every child of the household, its ideas,
--    photos, links (with the code) and who took what (#32 §1, §3.5). Every other household,
--    a user without household and anon read 0 rows.
--    There is no insert, update or delete policy: without a privilege and without a policy
--    every direct write is refused for every row (also if a privilege were ever granted by
--    mistake), the same choice as the notifications.
-- Membership is checked with `household_id = (select public.current_household_id())`: one
-- account belongs to at most one household, the subquery runs once per statement. No policy
-- reads another table, so policies never call each other.

-- ---------------------------------------------------------------------------
-- Privileges on the tables
-- ---------------------------------------------------------------------------

revoke all on table public.wishlists from anon, authenticated;
grant select on table public.wishlists to authenticated;

revoke all on table public.wishlist_items from anon, authenticated;
grant select on table public.wishlist_items to authenticated;

revoke all on table public.wishlist_item_photos from anon, authenticated;
grant select on table public.wishlist_item_photos to authenticated;

revoke all on table public.wishlist_share_links from anon, authenticated;
grant select on table public.wishlist_share_links to authenticated;

revoke all on table public.wishlist_reservations from anon, authenticated;
-- Every column but giver_key_hash.
grant select (id, household_id, item_id, share_link_id, giver_name, created_at)
  on table public.wishlist_reservations to authenticated;

-- ---------------------------------------------------------------------------
-- Privileges on functions
-- ---------------------------------------------------------------------------

-- Trigger functions, never called directly.
revoke execute on function private.wishlist_items_before_write() from public, anon, authenticated;
revoke execute on function private.wishlist_share_links_before_update() from public, anon, authenticated;
revoke execute on function private.wishlist_reservations_before_insert() from public, anon, authenticated;

-- Internal helpers and jobs: the database owner only (functions above, pg_cron).
revoke execute on function private.wishlist_next_birthday(date, date) from public, anon, authenticated;
revoke execute on function private.wishlist_link_expires_at(date) from public, anon, authenticated;
revoke execute on function private.wishlist_caller_child(uuid) from public, anon, authenticated;
revoke execute on function private.wishlist_active_link(text) from public, anon, authenticated;
revoke execute on function private.wishlist_giver_key_hash(text, uuid) from public, anon, authenticated;
revoke execute on function private.purge_past_wishlist_occasions(date, uuid) from public, anon, authenticated;
revoke execute on function private.run_scheduled_wishlist_cleanup() from public, anon, authenticated;

-- The page #32: signed-in users only.
revoke execute on function public.add_wishlist_item(uuid, text, text, text, integer, text, text, text) from public, anon;
revoke execute on function public.update_wishlist_item(uuid, text, text) from public, anon;
revoke execute on function public.delete_wishlist_item(uuid) from public, anon;
revoke execute on function public.share_wishlist(uuid) from public, anon;
revoke execute on function public.disable_wishlist_share_link(uuid) from public, anon;
grant execute on function public.add_wishlist_item(uuid, text, text, text, integer, text, text, text) to authenticated;
grant execute on function public.update_wishlist_item(uuid, text, text) to authenticated;
grant execute on function public.delete_wishlist_item(uuid) to authenticated;
grant execute on function public.share_wishlist(uuid) to authenticated;
grant execute on function public.disable_wishlist_share_link(uuid) to authenticated;

-- The public page #33 (decision D2): without an account. With invitation_preview(), the
-- only functions the anon role can execute in this project.
revoke execute on function public.get_public_wishlist(text, text) from public;
revoke execute on function public.get_public_wishlist_photo(text, uuid) from public;
revoke execute on function public.reserve_public_wishlist_item(text, uuid, text, text) from public;
grant execute on function public.get_public_wishlist(text, text) to anon, authenticated;
grant execute on function public.get_public_wishlist_photo(text, uuid) to anon, authenticated;
grant execute on function public.reserve_public_wishlist_item(text, uuid, text, text) to anon, authenticated;

-- The cleanup for the tests, one household at a time: administrative key and database owner only.
revoke execute on function public.run_wishlist_cleanup(uuid, date) from public, anon, authenticated;
grant execute on function public.run_wishlist_cleanup(uuid, date) to service_role;

-- ---------------------------------------------------------------------------
-- Policies (select only, see the header)
-- ---------------------------------------------------------------------------

drop policy if exists wishlists_select on public.wishlists;
create policy wishlists_select on public.wishlists
  for select to authenticated
  using (household_id = (select public.current_household_id()));

drop policy if exists wishlist_items_select on public.wishlist_items;
create policy wishlist_items_select on public.wishlist_items
  for select to authenticated
  using (household_id = (select public.current_household_id()));

drop policy if exists wishlist_item_photos_select on public.wishlist_item_photos;
create policy wishlist_item_photos_select on public.wishlist_item_photos
  for select to authenticated
  using (household_id = (select public.current_household_id()));

drop policy if exists wishlist_share_links_select on public.wishlist_share_links;
create policy wishlist_share_links_select on public.wishlist_share_links
  for select to authenticated
  using (household_id = (select public.current_household_id()));

drop policy if exists wishlist_reservations_select on public.wishlist_reservations;
create policy wishlist_reservations_select on public.wishlist_reservations
  for select to authenticated
  using (household_id = (select public.current_household_id()));
