-- Issue #438 (database part of #417): the invitation triggers stop handling the short
-- code, which no page reads or shows any more. The column itself is dropped in the
-- invitations_remove_short_code_column migration, after these functions stop using it.
--
-- public.invitations_before_insert(): same checks as in 20261022201344, in the same
-- order and with the same errors; only the short code part goes away, together with
-- the advisory lock that serialised every invitation insert of every household.
-- The one pending invitation per member rule stays with the unique index
-- invitations_one_pending_per_member_idx. Security definer is kept: the member and the
-- inviter are looked up without the RLS of the caller, as before.
--
-- public.invitations_guard_update(): same rules as in 20261022194753, without the
-- short_code comparison.
--
-- `create or replace` keeps the triggers and the execute privileges (revoked from
-- public, anon and authenticated in 20261022194756).

create or replace function public.invitations_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_member public.household_members%rowtype;
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

  return new;
end;
$$;

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
