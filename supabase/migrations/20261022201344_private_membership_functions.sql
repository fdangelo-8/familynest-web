-- Issue #49: membership checks move to the "private" schema, which the Data API does
-- not expose (not callable as RPC, not in the generated types). The guard triggers
-- are replaced to use them, and the invitation trigger now redraws a short code
-- already used by a valid invitation (the column has a server default since the
-- previous migration). The old public functions are dropped in
-- policies_use_private_functions, after the policies stop using them.

create schema if not exists private;

create or replace function private.is_household_member(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members m
    where m.household_id = target
      and m.user_id = (select auth.uid())
  );
$$;

create or replace function private.is_household_admin(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members m
    where m.household_id = target
      and m.user_id = (select auth.uid())
      and m.is_admin
  );
$$;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
-- Used by policies and guard triggers, evaluated as the caller.
revoke execute on function private.is_household_member(uuid) from public, anon;
revoke execute on function private.is_household_admin(uuid) from public, anon;
grant execute on function private.is_household_member(uuid) to authenticated;
grant execute on function private.is_household_admin(uuid) to authenticated;

-- Same rules as before, with the private membership check.
create or replace function public.household_members_guard_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if new.household_id is distinct from old.household_id
       or new.user_id is distinct from old.user_id
       or new.joined_at is distinct from old.joined_at
       or new.kind is distinct from old.kind then
      raise exception 'this member field cannot be changed' using errcode = '42501';
    end if;

    if new.is_admin is distinct from old.is_admin
       and not private.is_household_admin(old.household_id) then
      raise exception 'only administrators can change roles' using errcode = '42501';
    end if;
  end if;

  if old.is_admin and not new.is_admin then
    -- Serialise role changes inside the same household.
    perform pg_advisory_xact_lock(hashtextextended(old.household_id::text, 0));
    if not exists (
      select 1
      from public.household_members m
      where m.household_id = old.household_id
        and m.is_admin
        and m.id <> old.id
    ) then
      raise exception 'a household needs at least one administrator' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

-- Validates a new invitation and makes its short code unique among valid invitations.
-- Security definer: the short code must be unique among the valid invitations of
-- every household, which the caller cannot see.
create or replace function public.invitations_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_member public.household_members%rowtype;
  v_attempts integer := 0;
begin
  -- Same answer as RLS for non administrators: nothing about other households leaks.
  if v_uid is not null and not private.is_household_admin(new.household_id) then
    raise exception 'permission denied for table invitations' using errcode = '42501';
  end if;

  select * into v_member
  from public.household_members m
  where m.id = new.member_id;

  if not found
     or v_member.household_id <> new.household_id
     or v_member.kind <> 'adult'
     or v_member.user_id is not null then
    raise exception 'only adults of the household without an account can be invited'
      using errcode = '23514';
  end if;

  if new.invited_by_member_id is null and v_uid is not null then
    select m.id into new.invited_by_member_id
    from public.household_members m
    where m.user_id = v_uid
      and m.household_id = new.household_id;
  end if;

  if new.invited_by_member_id is not null and not exists (
    select 1
    from public.household_members m
    where m.id = new.invited_by_member_id
      and m.household_id = new.household_id
  ) then
    raise exception 'the inviter must belong to the household' using errcode = '23514';
  end if;

  new.message := nullif(btrim(new.message, E' \t\r\n'), '');

  -- Serialise short code assignment across all households.
  perform pg_advisory_xact_lock(hashtextextended('public.invitations.short_code', 0));

  -- The column default draws a random code; while it is used by a valid invitation,
  -- draw another one.
  while new.short_code is null or exists (
    select 1
    from public.invitations i
    where i.short_code = new.short_code
      and i.status = 'pending'
      and i.expires_at > now()
  ) loop
    v_attempts := v_attempts + 1;
    if v_attempts > 50 then
      raise exception 'no short code available' using errcode = 'P0001';
    end if;
    new.short_code := lpad(
      ((('x' || encode(extensions.gen_random_bytes(2), 'hex'))::bit(16)::integer) % 10000)::text,
      4,
      '0'
    );
  end loop;

  return new;
end;
$$;
