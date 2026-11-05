-- Issue #34 part 2 (CA-55, CA-56, richiesta-db point 10): the step «Collega il tuo
-- calendario» of the starter list of Oggi (#30) now exists (page /calendari-collegati and
-- Onboarding · Calendario are on main), so complete_starter_list() checks it too: the
-- administrator who calls has at least one linked calendar account.
--
-- New version of public.complete_starter_list() (20261029215220), same signature, result,
-- errors and rules, one more condition:
-- - the caller is an administrator of a household (otherwise 42501, the same error whether
--   the caller has no household or is not an administrator);
-- - at least one item was ever added to the shopping list (first_shopping_item_at);
-- - no invitation of the household is still pending and not expired;
-- - new: the caller has at least one row in calendar_accounts, in their own place in the
--   household (member and household of the caller). Whatever its state: an account to
--   «Ricollega» is still linked, as the page /calendari-collegati shows it. The accounts of
--   the other adults of the same household (administrators included) never count: the step
--   is personal, like the accounts (#34 §1, §17).
-- If a condition is false nothing changes and the result is false. Once completed the time
-- is never changed again and the result is true: the households that completed the list
-- with three steps (before this migration) keep it completed, and unlinking a calendar
-- later does not reopen it.
--
-- Security: still `security definer` (owner postgres) with `set search_path = ''` and fully
-- qualified names, because the caller cannot update households.starter_list_completed_at
-- and a member who is not an administrator cannot read invitations. It reads only the
-- existence of an account of the caller: no column of the account (never the credentials)
-- leaves the function, which still returns only a boolean. Nothing of the schema private is
-- called. `create or replace` keeps owner and privileges (execute for authenticated only,
-- 20261029215226): no privilege is added.
create or replace function public.complete_starter_list()
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_member_id uuid;
  v_household_id uuid;
  v_first_item_at timestamptz;
  v_completed_at timestamptz;
begin
  select m.id, m.household_id into v_member_id, v_household_id
  from public.household_members m
  where m.user_id = (select auth.uid())
    and m.is_admin;

  if v_household_id is null then
    raise exception 'permission denied for function complete_starter_list' using errcode = '42501';
  end if;

  -- Serialises concurrent calls for the same household (same lock as the member limit
  -- trigger: it does not block the foreign key checks of the other tables).
  select h.first_shopping_item_at, h.starter_list_completed_at
  into v_first_item_at, v_completed_at
  from public.households h
  where h.id = v_household_id
  for no key update;

  if v_completed_at is not null then
    return true;
  end if;

  if v_first_item_at is null then
    return false;
  end if;

  if exists (
    select 1
    from public.invitations i
    where i.household_id = v_household_id
      and i.status = 'pending'
      and i.expires_at > now()
  ) then
    return false;
  end if;

  -- «Collega il tuo calendario»: an account of the caller (index of the unique constraint
  -- calendar_accounts_member_provider_account_key, leading column member_id).
  if not exists (
    select 1
    from public.calendar_accounts a
    where a.member_id = v_member_id
      and a.household_id = v_household_id
  ) then
    return false;
  end if;

  update public.households h
  set starter_list_completed_at = now()
  where h.id = v_household_id;

  return true;
end;
$$;
