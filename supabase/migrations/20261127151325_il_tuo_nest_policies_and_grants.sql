-- Issue #617: execute grants of the functions of il_tuo_nest_functions_and_triggers.
-- No new policy: private.invitation_mails has RLS enabled and no policy, and no API role has
-- a privilege on it (il_tuo_nest_tables). The policies of household_members, invitations,
-- calendar_accounts and external_calendars do not change.
--
-- accept_invitation_with_color() keeps its grants (same signature, `create or replace`).

-- ---------------------------------------------------------------------------
-- Functions of the page: only authenticated (CA-34). anon never.
-- ---------------------------------------------------------------------------
revoke execute on function public.invite_adult(text, public.member_color) from public, anon, service_role;
grant execute on function public.invite_adult(text, public.member_color) to authenticated;

revoke execute on function public.renew_invitation(uuid) from public, anon, service_role;
grant execute on function public.renew_invitation(uuid) to authenticated;

revoke execute on function public.household_member_calendars() from public, anon, service_role;
grant execute on function public.household_member_calendars() to authenticated;

revoke execute on function public.record_invitation_mail(uuid) from public, anon, service_role;
grant execute on function public.record_invitation_mail(uuid) to authenticated;

revoke execute on function public.add_household_member(
  text, public.member_kind, public.member_color, date, public.pet_species
) from public, anon, service_role;
grant execute on function public.add_household_member(
  text, public.member_kind, public.member_color, date, public.pet_species
) to authenticated;

-- ---------------------------------------------------------------------------
-- Private functions.
-- ---------------------------------------------------------------------------
-- The guard trigger function and the purge of the pg_cron job: no API role. A trigger
-- function needs no execute privilege to fire.
revoke execute on function private.household_members_couple_guard() from public, anon, authenticated, service_role;
revoke execute on function private.purge_invitation_mails(timestamptz) from public, anon, authenticated, service_role;

-- The rule «in coppia» is evaluated as the caller by the guard trigger (security invoker,
-- running as authenticated), so authenticated needs it, like private.is_household_admin.
-- It is security invoker and reads only the rows the caller can already read: for a
-- household that is not the caller's it answers false.
revoke execute on function private.household_is_couple(uuid) from public, anon, service_role;
grant execute on function private.household_is_couple(uuid) to authenticated;
