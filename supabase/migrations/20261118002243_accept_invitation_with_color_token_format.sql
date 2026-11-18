-- Issue #458: public.accept_invitation_with_color(text, public.member_color) reads the
-- token with the same rule as the app and the invitations_token_format constraint
-- (#438): exactly 64 lowercase hexadecimal characters. Until now it only checked
-- char_length(p_token) between 32 and 128. Any other token gives P0001
-- 'invalid invitation', exactly like an unknown token.
--
-- Same signature and return type as 20261030015510, so `create or replace` keeps the
-- execute privileges (authenticated only). Everything else is unchanged from
-- 20261030015510: security definer, search_path, only POST through the Data API, same
-- checks in the same order, same error codes and messages, same row locks.
-- ---------------------------------------------------------------------------
create or replace function public.accept_invitation_with_color(
  p_token text,
  p_color public.member_color
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_invitation public.invitations%rowtype;
  v_current_color public.member_color;
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if p_color is null then
    raise exception 'color is required' using errcode = '22023';
  end if;

  if exists (select 1 from public.household_members m where m.user_id = v_uid) then
    raise exception 'user already belongs to a household' using errcode = 'P0001';
  end if;

  select i.* into v_invitation
  from public.invitations i
  join public.household_members m
    on m.id = i.member_id
   and m.household_id = i.household_id
  where p_token ~ '^[0-9a-f]{64}$'
    and i.token = p_token
    and i.status = 'pending'
    and i.expires_at > now()
    and m.kind = 'adult'
    and m.user_id is null
  for update of i, m;

  if not found then
    raise exception 'invalid invitation' using errcode = 'P0001';
  end if;

  select m.color into v_current_color
  from public.household_members m
  where m.id = v_invitation.member_id;

  if p_color <> v_current_color and exists (
    select 1
    from public.household_members o
    where o.household_id = v_invitation.household_id
      and o.id <> v_invitation.member_id
      and o.color = p_color
  ) then
    raise exception 'color already taken' using errcode = '23505';
  end if;

  update public.household_members m
  set user_id = v_uid,
      joined_at = now(),
      is_admin = false,
      color = p_color
  where m.id = v_invitation.member_id;

  update public.invitations i
  set status = 'accepted',
      accepted_at = now()
  where i.id = v_invitation.id;

  return v_invitation.household_id;
end;
$$;
