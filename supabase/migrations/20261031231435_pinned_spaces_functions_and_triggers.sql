-- Issue #187: functions and triggers of the pinned spaces (pages #28, #29, #30).
--
-- Conventions (same as todos and events):
-- - every function has `set search_path = ''` and fully qualified names;
-- - helpers and trigger functions live in the "private" schema (not exposed by the Data
--   API, not in the generated types);
-- - every function here is `security invoker`: the caller only needs to see the members
--   of their own household and their own pinned spaces, which RLS already allows. Rows of
--   other households are never read;
-- - guard triggers check `current_user`: the Data API roles (authenticated, anon) get the
--   checks that depend on the caller, while statements run by the database owner
--   (foreign key actions, seed, tests set up as postgres) are trusted. The availability
--   of the space and the limit of six apply to every role.
-- The member of the caller comes from private.current_member_id() (events migration).
-- Execute grants are set in the pinned_spaces_policies_and_grants migration.
--
-- Errors (the app recognises them by code, src/lib/spaces.ts of #188):
-- - FN001 'pinned space limit reached': the member already has six pinned spaces that
--   are available for the household;
-- - FN002 'space not available': the space is not available for the household (§4 of
--   issue #28);
-- - 42501: no signed-in user, or the caller has no household (or no privilege);
-- - 23514: the member is not an adult with an account of the household (trusted roles
--   only: the API roles always pin for themselves);
-- - 22004: the space is null (pin_space, unpin_space);
-- - P0001 'use POST': pin_space or unpin_space called through the Data API with a method
--   other than POST (lesson of #112).

-- ---------------------------------------------------------------------------
-- Availability of a space for a household (issue #28, §4), counting the rows of
-- household_members by kind:
-- - couple («Noi due») and expenses («Conti chiari»): at least 2 adults, with or without
--   account (question 9);
-- - children («Crescere»): at least 1 child;
-- - pets («Zampe»): at least 1 pet;
-- - the other six spaces: always.
-- Evaluated as the caller: an API role sees only the members of its own household, so for
-- any other household the conditional spaces are simply not available.
-- ---------------------------------------------------------------------------
create or replace function private.space_is_available(p_household_id uuid, p_space public.space_key)
returns boolean
language sql
stable
set search_path = ''
as $$
  select case
    when p_space is null then false
    when p_space in ('couple', 'expenses') then (
      select count(*) >= 2
      from public.household_members m
      where m.household_id = p_household_id
        and m.kind = 'adult'
    )
    when p_space = 'children' then exists (
      select 1
      from public.household_members m
      where m.household_id = p_household_id
        and m.kind = 'child'
    )
    when p_space = 'pets' then exists (
      select 1
      from public.household_members m
      where m.household_id = p_household_id
        and m.kind = 'pet'
    )
    else true
  end;
$$;

-- ---------------------------------------------------------------------------
-- Before insert:
-- - API roles: the household and the member are always those of the caller, the pin
--   time is set here (the app never chooses them);
-- - every role: the member is an adult with an account of the household;
-- - a space already pinned by the member passes without checks: pin_space() then does
--   nothing (on conflict), a direct insert gets the unique violation (23505);
-- - the space must be available for the household (FN002);
-- - at most six pinned spaces that are available now (FN001). Spaces pinned earlier that
--   are no longer available do not count; when they become available again they stay
--   pinned, even beyond six (issue #28, question 7): only new pins are refused.
--
-- Concurrency: pins of the same member are serialised by a transaction advisory lock,
-- so two concurrent pins cannot reach seven. The trigger function is volatile, so in
-- `read committed` (the isolation level of the Data API) the reads after the lock see the
-- rows committed by the transaction that held it.
-- ---------------------------------------------------------------------------
create or replace function private.pinned_spaces_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  -- Maximum number of pinned spaces (issue #28). The only place of this number in the
  -- database; the app has its own constant in src/lib/spaces.ts (#188).
  c_max_pinned constant integer := 6;
  v_household_id uuid;
  v_member_id uuid;
  v_count integer;
begin
  if current_user in ('authenticated', 'anon') then
    v_household_id := (select public.current_household_id());
    v_member_id := (select private.current_member_id());
    if v_household_id is null or v_member_id is null then
      raise exception 'new row violates row-level security policy for table "pinned_spaces"'
        using errcode = '42501';
    end if;

    new.household_id := v_household_id;
    new.member_id := v_member_id;
    new.pinned_at := clock_timestamp();
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
    raise exception 'only adults with an account of the household pin spaces' using errcode = '23514';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('public.pinned_spaces:' || new.member_id::text, 0));

  if exists (
    select 1
    from public.pinned_spaces p
    where p.member_id = new.member_id
      and p.space = new.space
  ) then
    return new;
  end if;

  if not private.space_is_available(new.household_id, new.space) then
    raise exception 'space not available' using errcode = 'FN002';
  end if;

  select count(*) into v_count
  from public.pinned_spaces p
  where p.member_id = new.member_id
    and private.space_is_available(p.household_id, p.space);

  if v_count >= c_max_pinned then
    raise exception 'pinned space limit reached' using errcode = 'FN001';
  end if;

  return new;
end;
$$;

create trigger pinned_spaces_before_insert
  before insert on public.pinned_spaces
  for each row execute function private.pinned_spaces_before_insert();

-- ---------------------------------------------------------------------------
-- RPC: pin a space for the caller («Fissa ‹Nome› in Oggi», and «Annulla» after
-- unpinning). Receives only the key of the space; household, member and pin time are
-- set by the before insert trigger, which also checks availability and the limit.
-- A space already pinned changes nothing and gives no error (its pin time is kept).
-- An «Annulla» after unpinning pins the space again at the end of the list (question 3).
-- ---------------------------------------------------------------------------
create or replace function public.pin_space(p_space public.space_key)
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

  insert into public.pinned_spaces (space)
  values (p_space)
  on conflict (member_id, space) do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: unpin a space of the caller («Togli ‹Nome› da Oggi», and «Annulla» after pinning).
-- Deletes only the caller's own row of that space; when there is none, nothing happens
-- and there is no error.
-- ---------------------------------------------------------------------------
create or replace function public.unpin_space(p_space public.space_key)
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
    raise exception 'permission denied for function unpin_space' using errcode = '42501';
  end if;

  delete from public.pinned_spaces p
  where p.member_id = v_member_id
    and p.space = p_space;
end;
$$;
