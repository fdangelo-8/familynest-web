-- Issue #90 (for page #30 Oggi): the starter list of the administrators and the welcome
-- of who has just joined with an invitation.
--
-- Conventions (same as the base schema, the events and the things to do):
-- - every function has `set search_path = ''` and fully qualified names;
-- - trigger functions live in the "private" schema (not exposed by the Data API);
-- - `security definer` only where the function must read or write rows the caller
--   cannot (households columns without update grant, invitations of a non administrator);
-- - nothing sent by the app is trusted: the RPCs take no parameter and work only on the
--   household and the member of the caller (LEZIONI).
-- Execute grants are set in the starter_list_grants migration.

-- ---------------------------------------------------------------------------
-- After insert on shopping_items: remember when the household added its first item.
-- The value is the creation time of the oldest item ever added (the same rule as the
-- backfill migration): an item inserted with an older created_at (seed, service role)
-- moves it back, every other insert leaves it as it is. Items added from the app get
-- created_at = now() (shopping_items_before_insert), so for them it is the time of the
-- first insert. Never cleared: deleting or taking items does not touch it.
-- Only the first insert of a household actually updates the row (the condition is
-- false afterwards), so the household row is locked only once.
-- Security definer: the app has no update privilege on this column, and a member who is
-- not an administrator has no update policy on households.
-- ---------------------------------------------------------------------------
create or replace function private.shopping_items_record_first_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.households h
  set first_shopping_item_at = new.created_at
  where h.id = new.household_id
    and (h.first_shopping_item_at is null or h.first_shopping_item_at > new.created_at);
  return null;
end;
$$;

create trigger shopping_items_record_first_item
  after insert on public.shopping_items
  for each row execute function private.shopping_items_record_first_item();

-- ---------------------------------------------------------------------------
-- RPC: the administrator marks the starter list of their household as completed.
-- The conditions are checked here, on the data of the server:
-- - the caller is an administrator of a household (otherwise 42501, the same error
--   whether the caller has no household or is not an administrator);
-- - at least one item was ever added to the shopping list (first_shopping_item_at);
-- - no invitation of the household is still pending and not expired.
-- The step «Collega il tuo calendario» is not checked yet: linked calendars arrive with
-- page #34, which will add its condition here with a new migration.
-- If a condition is false nothing changes and the result is false. Once completed the
-- time is never changed again (a new invitation does not reopen the list) and the
-- result is true.
-- ---------------------------------------------------------------------------
create or replace function public.complete_starter_list()
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_household_id uuid;
  v_first_item_at timestamptz;
  v_completed_at timestamptz;
begin
  select m.household_id into v_household_id
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

  update public.households h
  set starter_list_completed_at = now()
  where h.id = v_household_id;

  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: welcome of who has just joined with an invitation (page #30, §10).
-- For the member of the caller: if they joined by accepting an invitation less than
-- 24 hours ago, one row with the name of the member who invited them (null when that
-- member has left the household); otherwise no row.
-- Nothing else of the invitation is returned (no token, short code, message, times or
-- other invitations): a member who is not an administrator cannot read invitations,
-- and this is the only thing the page needs. When the caller joined is already readable
-- in household_members.joined_at.
-- Security definer: invitations are readable only by administrators.
-- ---------------------------------------------------------------------------
create or replace function public.current_member_welcome()
returns table (inviter_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select inviter.name
  from public.household_members me
  join public.invitations i
    on i.member_id = me.id
   and i.household_id = me.household_id
  left join public.household_members inviter
    on inviter.id = i.invited_by_member_id
   and inviter.household_id = i.household_id
  where me.user_id = (select auth.uid())
    and i.status = 'accepted'
    and i.accepted_at > now() - interval '24 hours'
  order by i.accepted_at desc
  limit 1;
$$;
