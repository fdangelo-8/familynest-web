-- Issue #74 (part 3): a household has at most 10 members. Everyone counts: adults with
-- an account, adults with a pending invitation, children and pets. With 10 colours,
-- all different inside a household, an eleventh member would have no colour; the
-- explicit limit gives a clear error instead of a colour error.
--
-- Rules:
-- - the limit applies to every insert, whoever runs it (administrator, other adult,
--   security definer functions, seed, service role): error P0001
--   'household member limit reached', no row is created;
-- - a signed-in user who is not a member of the target household never gets this
--   error: the trigger lets the row through without counting and RLS refuses it with
--   42501, as today. Otherwise they would learn how many people live in a household
--   that is not theirs;
-- - the trigger runs before household_members_normalize (BEFORE triggers fire in name
--   order) and the unique colour constraint is checked only after the BEFORE triggers,
--   so the eleventh member always gets the limit error, never 23505.
--
-- Concurrency: the household row is locked until the end of the transaction, so two
-- concurrent inserts in the same household are serialised and cannot reach 11.
-- `for no key update` conflicts with itself (and with updates of the household) but
-- not with the `for key share` locks taken by foreign key checks, so inserts in other
-- tables of the same household (e.g. shopping_items) are not blocked. The count below
-- sees the rows committed by the transaction that held the lock only in `read
-- committed` (a new snapshot per statement), the isolation level of the Data API
-- (PostgREST).
--
-- Security definer (owner: postgres): the count must include every member of the
-- household, whatever the caller can see.

create or replace function public.household_members_enforce_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Maximum number of members of a household (issue #74). The only place of this number
  -- in the database; the app has MAX_HOUSEHOLD_MEMBERS in src/lib/household-limits.ts.
  c_max_members constant integer := 10;
  v_count integer;
begin
  -- Not covered by this limit: a future security definer function that inserts for a
  -- caller who is not (yet) a member (skipped by the check below, like create_household
  -- for its first member) and an update of household_id run by postgres or service_role
  -- (this trigger fires on insert only; the API roles cannot change household_id).
  -- Not a member of the target household: RLS refuses the row with 42501.
  if (select auth.uid()) is not null
     and not private.is_household_member(new.household_id) then
    return new;
  end if;

  perform 1
  from public.households h
  where h.id = new.household_id
  for no key update;

  -- Unknown household: the foreign key refuses the row.
  if not found then
    return new;
  end if;

  select count(*) into v_count
  from public.household_members m
  where m.household_id = new.household_id;

  if v_count >= c_max_members then
    raise exception 'household member limit reached' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

-- Named so that it fires before household_members_normalize (alphabetical order).
create trigger household_members_limit
  before insert on public.household_members
  for each row execute function public.household_members_enforce_limit();

-- Trigger functions are never called directly.
revoke execute on function public.household_members_enforce_limit() from public, anon, authenticated;
