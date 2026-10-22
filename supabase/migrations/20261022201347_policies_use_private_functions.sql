-- Issue #49: policies of households, household_members and invitations recreated with
-- the private membership checks (profiles policies do not use them: unchanged).
-- Membership of the caller's own household is checked with
-- `household_id = (select public.current_household_id())`: one account belongs to at
-- most one household, and the subquery is evaluated once per statement.
-- Same rules as the rls_policies_and_grants migration; operations without a policy
-- (insert and delete of households, delete of invitations) stay denied for every row.

-- ---------------------------------------------------------------------------
-- households
-- ---------------------------------------------------------------------------

drop policy if exists households_select on public.households;
create policy households_select on public.households
  for select to authenticated
  using (id = (select public.current_household_id()));

drop policy if exists households_update on public.households;
create policy households_update on public.households
  for update to authenticated
  using (private.is_household_admin(id))
  with check (private.is_household_admin(id));

-- ---------------------------------------------------------------------------
-- household_members
-- ---------------------------------------------------------------------------

drop policy if exists household_members_select on public.household_members;
create policy household_members_select on public.household_members
  for select to authenticated
  using (household_id = (select public.current_household_id()));

-- Every adult adds children and pets; only administrators add adults.
-- New members never have an account nor the administrator role.
drop policy if exists household_members_insert on public.household_members;
create policy household_members_insert on public.household_members
  for insert to authenticated
  with check (
    household_id = (select public.current_household_id())
    and user_id is null
    and not is_admin
    and (kind <> 'adult' or private.is_household_admin(household_id))
  );

-- Administrators change every member; other adults change themselves, children and pets.
-- Role changes are further restricted by the household_members_guard_update trigger.
drop policy if exists household_members_update on public.household_members;
create policy household_members_update on public.household_members
  for update to authenticated
  using (
    private.is_household_admin(household_id)
    or (
      household_id = (select public.current_household_id())
      and (user_id = (select auth.uid()) or kind <> 'adult')
    )
  )
  with check (
    private.is_household_admin(household_id)
    or (
      household_id = (select public.current_household_id())
      and (user_id = (select auth.uid()) or kind <> 'adult')
    )
  );

-- Administrators remove members; everyone can leave (remove themselves).
drop policy if exists household_members_delete on public.household_members;
create policy household_members_delete on public.household_members
  for delete to authenticated
  using (
    private.is_household_admin(household_id)
    or user_id = (select auth.uid())
  );

-- ---------------------------------------------------------------------------
-- invitations: administrators only
-- ---------------------------------------------------------------------------

drop policy if exists invitations_select on public.invitations;
create policy invitations_select on public.invitations
  for select to authenticated
  using (private.is_household_admin(household_id));

drop policy if exists invitations_insert on public.invitations;
create policy invitations_insert on public.invitations
  for insert to authenticated
  with check (private.is_household_admin(household_id));

-- Only revocation is possible (column grant + invitations_guard_update trigger).
drop policy if exists invitations_update on public.invitations;
create policy invitations_update on public.invitations
  for update to authenticated
  using (private.is_household_admin(household_id))
  with check (private.is_household_admin(household_id));

-- ---------------------------------------------------------------------------
-- The public membership functions are no longer used: remove them from the API.
-- ---------------------------------------------------------------------------
drop function public.is_household_member(uuid);
drop function public.is_household_admin(uuid);
