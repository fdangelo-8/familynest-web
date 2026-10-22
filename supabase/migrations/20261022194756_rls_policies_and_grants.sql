-- RLS policies and privileges for the base schema (issue #9).
--
-- Two layers:
-- 1. Privileges (grants): which columns the Data API roles may write at all.
--    Default Supabase grants (ALL to anon and authenticated) are replaced with the
--    minimum needed. Columns that only the database may set (household_id of a
--    member, linked account, join time, tokens, codes, status of an invitation...)
--    are never writable from the app.
-- 2. RLS policies: which rows. Policies are `to authenticated` only: anon has no
--    policy, so it reads 0 rows and cannot write anything.
-- An operation without a policy is denied for every row (e.g. deleting a household:
-- a household disappears only when its last adult with an account leaves).

-- ---------------------------------------------------------------------------
-- Privileges on tables
-- ---------------------------------------------------------------------------

revoke all on table public.households from anon, authenticated;
grant select on table public.households to anon, authenticated;
grant update (name, household_type) on table public.households to authenticated;
-- No delete policy: every delete touches 0 rows.
grant delete on table public.households to authenticated;

revoke all on table public.household_members from anon, authenticated;
grant select on table public.household_members to anon, authenticated;
grant insert (household_id, kind, name, color, birth_date) on table public.household_members to authenticated;
grant update (name, color, birth_date, is_admin) on table public.household_members to authenticated;
grant delete on table public.household_members to authenticated;

revoke all on table public.invitations from anon, authenticated;
grant select on table public.invitations to anon, authenticated;
grant insert (household_id, member_id, message) on table public.invitations to authenticated;
grant update (status) on table public.invitations to authenticated;
-- No delete policy: invitations are revoked, not deleted (every delete touches 0 rows).
grant delete on table public.invitations to authenticated;

revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to anon, authenticated;
grant update (display_name) on table public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Privileges on functions
-- ---------------------------------------------------------------------------

-- Trigger functions are never called directly.
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.households_normalize() from public, anon, authenticated;
revoke execute on function public.household_members_normalize() from public, anon, authenticated;
revoke execute on function public.household_members_guard_update() from public, anon, authenticated;
revoke execute on function public.household_members_after_delete() from public, anon, authenticated;
revoke execute on function public.invitations_before_insert() from public, anon, authenticated;
revoke execute on function public.invitations_guard_update() from public, anon, authenticated;
revoke execute on function public.profiles_normalize() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Membership checks: used by policies and guard triggers, evaluated as the caller.
revoke execute on function public.is_household_member(uuid) from public, anon;
revoke execute on function public.is_household_admin(uuid) from public, anon;
grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.is_household_admin(uuid) to authenticated;

-- Operations for signed-in users only.
revoke execute on function public.current_household_id() from public, anon;
revoke execute on function public.create_household(text, public.household_type, text, public.member_color) from public, anon;
revoke execute on function public.accept_invitation(text) from public, anon;
grant execute on function public.current_household_id() to authenticated;
grant execute on function public.create_household(text, public.household_type, text, public.member_color) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;

-- ---------------------------------------------------------------------------
-- households
-- ---------------------------------------------------------------------------

drop policy if exists households_select on public.households;
create policy households_select on public.households
  for select to authenticated
  using (public.is_household_member(id));

-- No insert policy: households are created only by create_household().

drop policy if exists households_update on public.households;
create policy households_update on public.households
  for update to authenticated
  using (public.is_household_admin(id))
  with check (public.is_household_admin(id));

-- No delete policy (see header).

-- ---------------------------------------------------------------------------
-- household_members
-- ---------------------------------------------------------------------------

drop policy if exists household_members_select on public.household_members;
create policy household_members_select on public.household_members
  for select to authenticated
  using (public.is_household_member(household_id));

-- Every adult adds children and pets; only administrators add adults.
-- New members never have an account nor the administrator role.
drop policy if exists household_members_insert on public.household_members;
create policy household_members_insert on public.household_members
  for insert to authenticated
  with check (
    public.is_household_member(household_id)
    and user_id is null
    and not is_admin
    and (kind <> 'adult' or public.is_household_admin(household_id))
  );

-- Administrators change every member; other adults change themselves, children and pets.
-- Role changes are further restricted by the household_members_guard_update trigger.
drop policy if exists household_members_update on public.household_members;
create policy household_members_update on public.household_members
  for update to authenticated
  using (
    public.is_household_admin(household_id)
    or (
      public.is_household_member(household_id)
      and (user_id = (select auth.uid()) or kind <> 'adult')
    )
  )
  with check (
    public.is_household_admin(household_id)
    or (
      public.is_household_member(household_id)
      and (user_id = (select auth.uid()) or kind <> 'adult')
    )
  );

-- Administrators remove members; everyone can leave (remove themselves).
drop policy if exists household_members_delete on public.household_members;
create policy household_members_delete on public.household_members
  for delete to authenticated
  using (
    public.is_household_admin(household_id)
    or user_id = (select auth.uid())
  );

-- ---------------------------------------------------------------------------
-- invitations: administrators only
-- ---------------------------------------------------------------------------

drop policy if exists invitations_select on public.invitations;
create policy invitations_select on public.invitations
  for select to authenticated
  using (public.is_household_admin(household_id));

drop policy if exists invitations_insert on public.invitations;
create policy invitations_insert on public.invitations
  for insert to authenticated
  with check (public.is_household_admin(household_id));

-- Only revocation is possible (column grant + invitations_guard_update trigger).
drop policy if exists invitations_update on public.invitations;
create policy invitations_update on public.invitations
  for update to authenticated
  using (public.is_household_admin(household_id))
  with check (public.is_household_admin(household_id));

-- No delete policy (see header).

-- ---------------------------------------------------------------------------
-- profiles: each user sees and changes only their own profile
-- ---------------------------------------------------------------------------

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

-- No insert policy: profiles are created by the handle_new_user() trigger.

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- No delete policy: a profile is deleted with its account (on delete cascade).
