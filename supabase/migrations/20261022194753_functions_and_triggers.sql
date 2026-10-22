-- Functions and triggers for the base schema (issue #9).
--
-- Conventions:
-- - every function has `set search_path = ''` and fully qualified names;
-- - `security definer` only where the function must read or write rows the caller
--   cannot see (membership checks, household creation, invitation acceptance,
--   administrator succession);
-- - guard triggers are `security invoker`: `current_user` is then the role that runs
--   the statement. The Data API roles (authenticated, anon) get the permission
--   checks, while statements run by the security definer functions below
--   (owner: postgres), foreign key actions, the auth service and the seed are trusted.
-- Execute grants are set in the rls_policies_and_grants migration.

-- ---------------------------------------------------------------------------
-- Generic helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Membership checks used by the RLS policies (no recursion between policies).
-- ---------------------------------------------------------------------------

create or replace function public.is_household_member(target uuid)
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

create or replace function public.is_household_admin(target uuid)
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

-- Household of the current user, or null when the user has none (onboarding).
create or replace function public.current_household_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.household_id
  from public.household_members m
  where m.user_id = (select auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- households
-- ---------------------------------------------------------------------------

create or replace function public.households_normalize()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name := btrim(new.name, E' \t\r\n');
  return new;
end;
$$;

create trigger households_normalize
  before insert or update on public.households
  for each row execute function public.households_normalize();

create trigger households_set_updated_at
  before update on public.households
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- household_members
-- ---------------------------------------------------------------------------

-- Trims the name and refuses birth dates after today (Europe/Rome).
create or replace function public.household_members_normalize()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name := btrim(new.name, E' \t\r\n');
  if new.birth_date is not null
     and new.birth_date > (now() at time zone 'Europe/Rome')::date then
    raise exception 'birth_date cannot be in the future' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger household_members_normalize
  before insert or update on public.household_members
  for each row execute function public.household_members_normalize();

-- Role rules on update:
-- - API roles never change household, account, join time or kind of a member;
-- - only administrators give or remove the administrator role;
-- - the last administrator of a household cannot lose the role (any role).
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
       and not public.is_household_admin(old.household_id) then
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

create trigger household_members_guard_update
  before update on public.household_members
  for each row execute function public.household_members_guard_update();

create trigger household_members_set_updated_at
  before update on public.household_members
  for each row execute function public.set_updated_at();

-- After an adult with an account leaves (or the account is deleted):
-- - if no adult with an account remains, the household is deleted with all its data;
-- - otherwise, if no administrator remains, the adult who joined first becomes administrator.
create or replace function public.household_members_after_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.user_id is null then
    return null;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(old.household_id::text, 0));

  -- Household already being deleted (cascade): nothing to do.
  if not exists (select 1 from public.households h where h.id = old.household_id) then
    return null;
  end if;

  if not exists (
    select 1
    from public.household_members m
    where m.household_id = old.household_id
      and m.user_id is not null
  ) then
    delete from public.households h where h.id = old.household_id;
    return null;
  end if;

  if not exists (
    select 1
    from public.household_members m
    where m.household_id = old.household_id
      and m.is_admin
  ) then
    update public.household_members m
    set is_admin = true
    where m.id = (
      select m2.id
      from public.household_members m2
      where m2.household_id = old.household_id
        and m2.user_id is not null
      order by m2.joined_at, m2.created_at, m2.id
      limit 1
    );
  end if;

  return null;
end;
$$;

create trigger household_members_after_delete
  after delete on public.household_members
  for each row execute function public.household_members_after_delete();

-- ---------------------------------------------------------------------------
-- invitations
-- ---------------------------------------------------------------------------

-- Validates a new invitation and generates its short code.
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
  v_code text;
  v_attempts integer := 0;
begin
  -- Same answer as RLS for non administrators: nothing about other households leaks.
  if v_uid is not null and not public.is_household_admin(new.household_id) then
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

  if new.short_code is null then
    loop
      v_attempts := v_attempts + 1;
      v_code := lpad(
        ((('x' || encode(extensions.gen_random_bytes(2), 'hex'))::bit(16)::integer) % 10000)::text,
        4,
        '0'
      );
      exit when not exists (
        select 1
        from public.invitations i
        where i.short_code = v_code
          and i.status = 'pending'
          and i.expires_at > now()
      );
      if v_attempts >= 50 then
        raise exception 'no short code available' using errcode = 'P0001';
      end if;
    end loop;
    new.short_code := v_code;
  elsif exists (
    select 1
    from public.invitations i
    where i.short_code = new.short_code
      and i.status = 'pending'
      and i.expires_at > now()
  ) then
    raise exception 'short code already used by a valid invitation' using errcode = '23505';
  end if;

  return new;
end;
$$;

create trigger invitations_before_insert
  before insert on public.invitations
  for each row execute function public.invitations_before_insert();

-- API roles can only revoke a pending invitation; nothing else changes.
create or replace function public.invitations_guard_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if new.household_id is distinct from old.household_id
       or new.member_id is distinct from old.member_id
       or new.invited_by_member_id is distinct from old.invited_by_member_id
       or new.token is distinct from old.token
       or new.short_code is distinct from old.short_code
       or new.message is distinct from old.message
       or new.expires_at is distinct from old.expires_at
       or new.accepted_at is distinct from old.accepted_at
       or new.created_at is distinct from old.created_at
       or not (old.status = 'pending' and new.status = 'revoked') then
      raise exception 'only a pending invitation can be revoked' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger invitations_guard_update
  before update on public.invitations
  for each row execute function public.invitations_guard_update();

create trigger invitations_set_updated_at
  before update on public.invitations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create or replace function public.profiles_normalize()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.display_name := nullif(btrim(new.display_name, E' \t\r\n'), '');
  return new;
end;
$$;

create trigger profiles_normalize
  before insert or update on public.profiles
  for each row execute function public.profiles_normalize();

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Creates the profile of every new account with the name given by the provider.
-- Never fails the sign-up: the name is trimmed and cut to the column limit.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  v_name := btrim(
    left(
      btrim(
        coalesce(
          new.raw_user_meta_data ->> 'full_name',
          new.raw_user_meta_data ->> 'name',
          new.raw_user_meta_data ->> 'display_name'
        ),
        E' \t\r\n'
      ),
      100
    ),
    E' \t\r\n'
  );

  insert into public.profiles (id, display_name)
  values (new.id, nullif(v_name, ''))
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Operations offered to the pages (RPC)
-- ---------------------------------------------------------------------------

-- Creates the household and its first adult (the caller), administrator. All or nothing.
create or replace function public.create_household(
  name text,
  household_type public.household_type,
  member_name text,
  color public.member_color
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := (select auth.uid());
  v_household_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if exists (select 1 from public.household_members m where m.user_id = v_uid) then
    raise exception 'user already belongs to a household' using errcode = 'P0001';
  end if;

  insert into public.households (name, household_type)
  values (create_household.name, create_household.household_type)
  returning id into v_household_id;

  insert into public.household_members (household_id, kind, name, color, user_id, is_admin, joined_at)
  values (v_household_id, 'adult', create_household.member_name, create_household.color, v_uid, true, now());

  return v_household_id;
end;
$$;

-- Links the caller to the invited adult. Every unusable invitation (unknown, expired,
-- revoked, already accepted) gives the same generic error.
create or replace function public.accept_invitation(token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := (select auth.uid());
  v_invitation public.invitations%rowtype;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if exists (select 1 from public.household_members m where m.user_id = v_uid) then
    raise exception 'user already belongs to a household' using errcode = 'P0001';
  end if;

  select i.* into v_invitation
  from public.invitations i
  join public.household_members m on m.id = i.member_id
  where i.token = accept_invitation.token
    and i.status = 'pending'
    and i.expires_at > now()
    and m.kind = 'adult'
    and m.user_id is null
  for update of i, m;

  if not found then
    raise exception 'invalid invitation' using errcode = 'P0001';
  end if;

  update public.household_members m
  set user_id = v_uid,
      joined_at = now(),
      is_admin = false
  where m.id = v_invitation.member_id;

  update public.invitations i
  set status = 'accepted',
      accepted_at = now()
  where i.id = v_invitation.id;

  return v_invitation.household_id;
end;
$$;
