-- Issue #216: functions and triggers of the «Avvisami» of the spaces of Esplora (page #29).
--
-- Conventions (same as pinned_spaces, #187):
-- - every function has `set search_path = ''` and fully qualified names;
-- - every function here is `security invoker`. The pages only touch their own rows and
--   the members of their own household, which RLS already allows; the count for Francesco
--   is executable only by service_role (which bypasses RLS) and the database owner;
-- - the guard trigger checks `current_user`: the Data API roles (authenticated, anon) get
--   the checks that depend on the caller, while statements run by the database owner
--   (foreign key actions, seed, tests set up as postgres) are trusted. The availability of
--   the space applies to every role.
-- Availability reuses private.space_is_available() and the member of the caller comes
-- from private.current_member_id().
-- Execute grants are set in the space_interests_policies_and_grants migration.
--
-- Errors (same codes as pinned_spaces):
-- - FN002 'space not available': the space is not available for the household (§4 of
--   issue #28);
-- - 42501: no signed-in user, or the caller has no household (or no privilege);
-- - 23514: the member is not an adult with an account of the household (trusted roles
--   only: the API roles always register for themselves);
-- - 22004: the space is null (add_space_interest, remove_space_interest);
-- - P0001 'use POST': add_space_interest or remove_space_interest called through the Data
--   API with a method other than POST (lesson of #112).

-- ---------------------------------------------------------------------------
-- Before insert:
-- - API roles: the household and the member are always those of the caller, the
--   registration time is set here (the app never chooses them);
-- - every role: the member is an adult with an account of the household;
-- - a space already registered by the member passes without checks:
--   add_space_interest() then does nothing (on conflict), a direct insert gets the unique
--   violation (23505);
-- - the space must be available for the household (FN002).
-- No limit, so no lock: two concurrent registrations of the same space are resolved by
-- the unique constraint.
-- ---------------------------------------------------------------------------
create or replace function private.space_interests_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_household_id uuid;
  v_member_id uuid;
begin
  if current_user in ('authenticated', 'anon') then
    v_household_id := (select public.current_household_id());
    v_member_id := (select private.current_member_id());
    if v_household_id is null or v_member_id is null then
      raise exception 'new row violates row-level security policy for table "space_interests"'
        using errcode = '42501';
    end if;

    new.household_id := v_household_id;
    new.member_id := v_member_id;
    new.created_at := clock_timestamp();
  end if;

  -- A null space is refused by the not null constraint.
  if new.space is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.household_members m
    where m.id = new.member_id
      and m.household_id = new.household_id
      and m.kind = 'adult'
      and m.user_id is not null
  ) then
    raise exception 'only adults with an account of the household register interests' using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.space_interests i
    where i.member_id = new.member_id
      and i.space = new.space
  ) then
    return new;
  end if;

  if not private.space_is_available(new.household_id, new.space) then
    raise exception 'space not available' using errcode = 'FN002';
  end if;

  return new;
end;
$$;

create trigger space_interests_before_insert
  before insert on public.space_interests
  for each row execute function private.space_interests_before_insert();

-- ---------------------------------------------------------------------------
-- RPC: «Avvisami quando è pronto». Receives only the key of the space; household, member
-- and time are set by the before insert trigger, which also checks availability.
-- A space already registered changes nothing and gives no error.
-- ---------------------------------------------------------------------------
create or replace function public.add_space_interest(p_space public.space_key)
returns void
language plpgsql
volatile
set search_path = ''
as $$
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  if p_space is null then
    raise exception 'space is required' using errcode = '22004';
  end if;

  insert into public.space_interests (space)
  values (p_space)
  on conflict (member_id, space) do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: «Ti avvisiamo appena è pronto» touched again: removes the caller's own row of that
-- space, also when the space is no longer available; when there is none, nothing happens
-- and there is no error.
-- ---------------------------------------------------------------------------
create or replace function public.remove_space_interest(p_space public.space_key)
returns void
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_member_id uuid;
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  if p_space is null then
    raise exception 'space is required' using errcode = '22004';
  end if;

  v_member_id := (select private.current_member_id());
  if v_member_id is null then
    raise exception 'permission denied for function remove_space_interest' using errcode = '42501';
  end if;

  delete from public.space_interests i
  where i.member_id = v_member_id
    and i.space = p_space;
end;
$$;

-- ---------------------------------------------------------------------------
-- The count for Francesco (issue #29, question 7): for each of the 10 spaces, in the
-- order of the catalogue, how many adults and how many households registered the
-- interest. Only numbers: no id, name, household or date. A space nobody registered
-- gives 0 and 0.
-- Executable only by service_role (the administrative key, which bypasses RLS) and the
-- database owner (console of Supabase): never by authenticated or anon (grants).
-- ---------------------------------------------------------------------------
create or replace function public.space_interest_counts()
returns table (space public.space_key, adults integer, households integer)
language sql
stable
set search_path = ''
as $$
  select
    s.space,
    count(distinct i.member_id)::integer as adults,
    count(distinct i.household_id)::integer as households
  from unnest(enum_range(null::public.space_key)) as s (space)
  left join public.space_interests i on i.space = s.space
  group by s.space
  order by s.space;
$$;
