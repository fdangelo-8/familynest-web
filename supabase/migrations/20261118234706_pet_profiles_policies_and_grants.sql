-- Issue #488 (part C of #460): privileges and RLS policies of the profile and the photo of a
-- pet.
--
-- Two layers, as for the wish list:
-- 1. Privileges: the app only reads pet_profiles and pet_photos; it writes them only with
--    save_pet_profile() (security definer, pet_profiles_functions_and_triggers migration).
--    No insert, update or delete privilege, on any column (never id, household, kind or the
--    row times: the database sets them). anon has no privilege at all.
-- 2. RLS policies, `to authenticated` only, one per command. Profile, vet and photo of a pet
--    are seen by every adult with an account of the pet's household, administrator or not
--    (#460 C); every other household reads 0 rows and cannot insert, change or delete them.
--    The write policies have no privilege behind them today: they keep the same rule if a
--    privilege is ever granted. No exception for the public wish list (D2) or the
--    invitation preview: no other function reads these tables.
-- Membership is checked with `household_id = (select public.current_household_id())`: one
-- account belongs to at most one household, the subquery runs once per statement. No policy
-- reads another table; that the member is a pet of the same household is guaranteed by the
-- composite foreign key.

-- ---------------------------------------------------------------------------
-- Privileges on the tables
-- ---------------------------------------------------------------------------

revoke all on table public.pet_profiles from anon, authenticated;
grant select on table public.pet_profiles to authenticated;

revoke all on table public.pet_photos from anon, authenticated;
grant select on table public.pet_photos to authenticated;

-- ---------------------------------------------------------------------------
-- Privileges on functions
-- ---------------------------------------------------------------------------

-- Trigger functions, never called directly.
revoke execute on function private.household_members_pet_birth_date_range() from public, anon, authenticated;
revoke execute on function private.pet_profiles_before_write() from public, anon, authenticated;

-- Operation for signed-in users only.
revoke execute on function public.save_pet_profile(
  uuid, text, public.member_color, public.pet_species, public.pet_date_kind, public.pet_date_precision,
  date, integer, text, text, text, text, text, text, text, boolean
) from public, anon;
grant execute on function public.save_pet_profile(
  uuid, text, public.member_color, public.pet_species, public.pet_date_kind, public.pet_date_precision,
  date, integer, text, text, text, text, text, text, text, boolean
) to authenticated;

-- ---------------------------------------------------------------------------
-- Policies of pet_profiles
-- ---------------------------------------------------------------------------

drop policy if exists pet_profiles_select on public.pet_profiles;
create policy pet_profiles_select on public.pet_profiles
  for select to authenticated
  using (household_id = (select public.current_household_id()));

drop policy if exists pet_profiles_insert on public.pet_profiles;
create policy pet_profiles_insert on public.pet_profiles
  for insert to authenticated
  with check (household_id = (select public.current_household_id()));

drop policy if exists pet_profiles_update on public.pet_profiles;
create policy pet_profiles_update on public.pet_profiles
  for update to authenticated
  using (household_id = (select public.current_household_id()))
  with check (household_id = (select public.current_household_id()));

drop policy if exists pet_profiles_delete on public.pet_profiles;
create policy pet_profiles_delete on public.pet_profiles
  for delete to authenticated
  using (household_id = (select public.current_household_id()));

-- ---------------------------------------------------------------------------
-- Policies of pet_photos
-- ---------------------------------------------------------------------------

drop policy if exists pet_photos_select on public.pet_photos;
create policy pet_photos_select on public.pet_photos
  for select to authenticated
  using (household_id = (select public.current_household_id()));

drop policy if exists pet_photos_insert on public.pet_photos;
create policy pet_photos_insert on public.pet_photos
  for insert to authenticated
  with check (household_id = (select public.current_household_id()));

drop policy if exists pet_photos_update on public.pet_photos;
create policy pet_photos_update on public.pet_photos
  for update to authenticated
  using (household_id = (select public.current_household_id()))
  with check (household_id = (select public.current_household_id()));

drop policy if exists pet_photos_delete on public.pet_photos;
create policy pet_photos_delete on public.pet_photos
  for delete to authenticated
  using (household_id = (select public.current_household_id()));
