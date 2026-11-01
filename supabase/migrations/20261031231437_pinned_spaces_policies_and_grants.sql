-- Issue #187: privileges and RLS policies of the pinned spaces.
--
-- Two layers, as in the base schema:
-- 1. Privileges: the app reads its pinned spaces, inserts only the key of a space (never
--    id, household, member or pin time: the database sets them) and deletes. No update:
--    a space is pinned or unpinned, rows never change. anon has no privilege at all.
-- 2. RLS policies, `to authenticated` only. Pinned spaces are personal (issue #28,
--    question 1): every policy allows only the rows of the caller's own member, in the
--    caller's own household. The other adults of the same household and every other
--    household read 0 rows and cannot insert or delete them.
-- The pages use pin_space() and unpin_space(); a direct insert goes through the same
-- before insert trigger (availability, limit of six), a direct delete through the same
-- policy.
-- Membership is checked with `household_id = (select public.current_household_id())`
-- and `member_id = (select private.current_member_id())`: one account belongs to at most
-- one household, the subqueries run once per statement. No policy reads another table.

-- ---------------------------------------------------------------------------
-- Privileges on the table
-- ---------------------------------------------------------------------------

revoke all on table public.pinned_spaces from anon, authenticated;
grant select on table public.pinned_spaces to authenticated;
-- Only the key of the space (LEZIONI: never insert on id).
grant insert (space) on table public.pinned_spaces to authenticated;
-- No update privilege and no update policy.
grant delete on table public.pinned_spaces to authenticated;

-- ---------------------------------------------------------------------------
-- Privileges on functions
-- ---------------------------------------------------------------------------

-- Trigger function, never called directly.
revoke execute on function private.pinned_spaces_before_insert() from public, anon, authenticated;

-- Called by the before insert trigger, evaluated as the caller. The private schema is not
-- exposed by the Data API: the app cannot call it as RPC.
revoke execute on function private.space_is_available(uuid, public.space_key) from public, anon;
grant execute on function private.space_is_available(uuid, public.space_key) to authenticated;

-- Operations for signed-in users only.
revoke execute on function public.pin_space(public.space_key) from public, anon;
revoke execute on function public.unpin_space(public.space_key) from public, anon;
grant execute on function public.pin_space(public.space_key) to authenticated;
grant execute on function public.unpin_space(public.space_key) to authenticated;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------

drop policy if exists pinned_spaces_select on public.pinned_spaces;
create policy pinned_spaces_select on public.pinned_spaces
  for select to authenticated
  using (
    household_id = (select public.current_household_id())
    and member_id = (select private.current_member_id())
  );

-- The household and the member are set by the before insert trigger.
drop policy if exists pinned_spaces_insert on public.pinned_spaces;
create policy pinned_spaces_insert on public.pinned_spaces
  for insert to authenticated
  with check (
    household_id = (select public.current_household_id())
    and member_id = (select private.current_member_id())
  );

-- No update policy: rows are never changed.

drop policy if exists pinned_spaces_delete on public.pinned_spaces;
create policy pinned_spaces_delete on public.pinned_spaces
  for delete to authenticated
  using (
    household_id = (select public.current_household_id())
    and member_id = (select private.current_member_id())
  );
