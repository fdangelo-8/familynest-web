-- Issue #216: privileges and RLS policies of the «Avvisami» of the spaces of Esplora.
--
-- Two layers, as for pinned_spaces:
-- 1. Privileges: the app reads its interests, inserts only the key of a space (never id,
--    household, member or time: the database sets them) and deletes. No update: an
--    interest is registered or removed, rows never change. anon has no privilege at all.
--    service_role keeps the default privileges of Supabase (administrative key, used by
--    space_interest_counts()).
-- 2. RLS policies, `to authenticated` only. Interests are personal (issue #29, question
--    8): every policy allows only the rows of the caller's own member, in the caller's own
--    household. The other adults of the same household and every other household read 0
--    rows and cannot insert or delete them.
-- The pages use add_space_interest() and remove_space_interest(); a direct insert goes
-- through the same before insert trigger (availability), a direct delete through the same
-- policy.
-- Membership is checked with `household_id = (select public.current_household_id())`
-- and `member_id = (select private.current_member_id())`. No policy reads another table.

-- ---------------------------------------------------------------------------
-- Privileges on the table
-- ---------------------------------------------------------------------------

revoke all on table public.space_interests from anon, authenticated;
grant select on table public.space_interests to authenticated;
-- Only the key of the space (LEZIONI: never insert on id).
grant insert (space) on table public.space_interests to authenticated;
-- No update privilege and no update policy.
grant delete on table public.space_interests to authenticated;

-- ---------------------------------------------------------------------------
-- Privileges on functions
-- ---------------------------------------------------------------------------

-- Trigger function, never called directly.
revoke execute on function private.space_interests_before_insert() from public, anon, authenticated;

-- Operations for signed-in users only.
revoke execute on function public.add_space_interest(public.space_key) from public, anon;
revoke execute on function public.remove_space_interest(public.space_key) from public, anon;
grant execute on function public.add_space_interest(public.space_key) to authenticated;
grant execute on function public.remove_space_interest(public.space_key) to authenticated;

-- The count for Francesco: administrative key and database owner only.
revoke execute on function public.space_interest_counts() from public, anon, authenticated;
grant execute on function public.space_interest_counts() to service_role;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------

drop policy if exists space_interests_select on public.space_interests;
create policy space_interests_select on public.space_interests
  for select to authenticated
  using (
    household_id = (select public.current_household_id())
    and member_id = (select private.current_member_id())
  );

-- The household and the member are set by the before insert trigger.
drop policy if exists space_interests_insert on public.space_interests;
create policy space_interests_insert on public.space_interests
  for insert to authenticated
  with check (
    household_id = (select public.current_household_id())
    and member_id = (select private.current_member_id())
  );

-- No update policy: rows are never changed.

drop policy if exists space_interests_delete on public.space_interests;
create policy space_interests_delete on public.space_interests
  for delete to authenticated
  using (
    household_id = (select public.current_household_id())
    and member_id = (select private.current_member_id())
  );
