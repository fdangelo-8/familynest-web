-- Issue #107 (for page #16 Ingresso con invito, requests R1 and R2).
--
-- R1 public.invitation_preview(p_token): what the welcome page (mockup 07) shows before
--    and after signing in, given the token of the invitation link.
-- R2 public.accept_invitation_with_color(p_token, p_color): joins the household with the
--    invitation and saves the chosen colour in one transaction (mockup 08, «Continua»).
--
-- Conventions (same as the base schema):
-- - `set search_path = ''` and fully qualified names;
-- - `security definer`: the caller is not (yet) a member, so RLS shows them nothing of
--   the household; these functions are the only way in, and they decide what comes out;
-- - nothing sent by the app is trusted except the token and the colour: household,
--   member and inviter always come from the invitation row (LEZIONI).
-- Execute grants are set in the invitation_preview_and_accept_with_color_grants migration.
-- public.accept_invitation(token) is unchanged.

-- ---------------------------------------------------------------------------
-- R1: preview of an invitation.
--
-- Always exactly one row.
-- - 'valid' only when an invitation has exactly this token (equality, case sensitive:
--   no prefix, pattern or short code lookup), is pending, has not expired, and its
--   member is an adult of the same household still without an account.
-- - Otherwise 'invalid' with every other field null, identical for every reason, and for
--   anonymous and signed-in callers alike. A token outside 32-128 characters is invalid
--   without reading the table (tokens are 64 hex characters, at least 32 by constraint).
--
-- A valid row contains only (decision of Francesco of 30/10 on #16, option B):
-- household_name, inviter_name (null when the inviter has left the household), message
-- (null when empty), invitee_name, invitee_color, expires_at, and members: the other
-- members of the household (everyone except the invitee, inviter included), in insertion
-- order, each with initial and colour. The name of each member is added only for a
-- signed-in caller who has no household yet (the colour page, after signing in, shows
-- «Pomodoro (già di Marco)»). Anonymous callers and callers who are already in a
-- household (this one or another) never get the names.
-- Never returned: ids of the household, of the invitation or of the members, kind, birth
-- dates, token, short code, status of the invitation, creation times.
--
-- Guessing: tokens are 256 random bits (invitations.token default), compared for
-- equality through the unique index, so they cannot be enumerated or guessed.
--
-- Only POST: the Data API (PostgREST) can also call a function with GET or HEAD, which
-- put the arguments in the query string of the URL. Through the Data API (request.method
-- set by PostgREST) any method other than POST is refused with P0001 'use POST', before
-- reading anything: a wrong call fails at once instead of working silently. This does not
-- keep a token out of gateway logs if a client sends it in a URL anyway; the protection is
-- the server action calling .rpc() with POST. Direct SQL calls (request.method null or
-- empty) are not affected.
-- supabase-js .rpc() uses POST unless asked otherwise. The function writes nothing.
-- ---------------------------------------------------------------------------
create or replace function public.invitation_preview(p_token text)
returns table (
  status public.invitation_preview_status,
  household_name text,
  inviter_name text,
  message text,
  invitee_name text,
  invitee_color public.member_color,
  expires_at timestamptz,
  members public.invitation_preview_member[]
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  return query
  with caller as (
    select
      (select auth.uid()) is not null
      and not exists (
        select 1
        from public.household_members cm
        where cm.user_id = (select auth.uid())
      ) as with_names
  ),
  invitation as (
    select i.household_id, i.member_id, i.invited_by_member_id, i.message, i.expires_at
    from public.invitations i
    join public.household_members invitee
      on invitee.id = i.member_id
     and invitee.household_id = i.household_id
    where char_length(p_token) between 32 and 128
      and i.token = p_token
      and i.status = 'pending'
      and i.expires_at > now()
      and invitee.kind = 'adult'
      and invitee.user_id is null
  ),
  preview as (
    select
      'valid'::public.invitation_preview_status as status,
      h.name as household_name,
      inviter.name as inviter_name,
      inv.message as message,
      invitee.name as invitee_name,
      invitee.color as invitee_color,
      inv.expires_at as expires_at,
      coalesce(
        (
          select array_agg(
            row(
              upper(left(o.name, 1)),
              o.color,
              case when c.with_names then o.name end
            )::public.invitation_preview_member
            order by o.created_at, o.id
          )
          from public.household_members o
          where o.household_id = inv.household_id
            and o.id <> inv.member_id
        ),
        '{}'::public.invitation_preview_member[]
      ) as members
    from invitation inv
    cross join caller c
    join public.households h on h.id = inv.household_id
    join public.household_members invitee on invitee.id = inv.member_id
    left join public.household_members inviter
      on inviter.id = inv.invited_by_member_id
     and inviter.household_id = inv.household_id
  )
  select p.status, p.household_name, p.inviter_name, p.message, p.invitee_name,
         p.invitee_color, p.expires_at, p.members
  from preview p
  union all
  select 'invalid'::public.invitation_preview_status, null::text, null::text, null::text,
         null::text, null::public.member_color, null::timestamptz,
         null::public.invitation_preview_member[]
  where not exists (select 1 from preview);
end;
$$;

-- ---------------------------------------------------------------------------
-- R2: join the household with the invitation and the chosen colour, all or nothing.
--
-- Same checks as accept_invitation(), in this order, plus the colour:
-- 0. any method other than POST through the Data API -> P0001 'use POST' (as for the
--    preview: a call with the token in a URL is refused);
-- 1. no session                                  -> 42501 'not authenticated'
--    (anonymous callers have no execute privilege: 42501 as well);
-- 2. no colour                                   -> 22023 'color is required';
-- 3. the caller already belongs to a household   -> P0001 'user already belongs to a household';
-- 4. unusable invitation (unknown, expired, revoked, accepted, member already linked)
--                                                -> P0001 'invalid invitation', always the same;
-- 5. colour of another member of that household  -> 23505 'color already taken'.
-- The colour is checked only after the invitation: an invalid token never tells anything
-- about the colours of any household. The colour already given to the invitee is always
-- accepted. A colour taken by a concurrent transaction is refused by the unique
-- constraint household_members_household_color_key, also with 23505.
--
-- Then: the member gets the account of the caller, joined_at = now(), is_admin = false
-- and the colour; the invitation becomes 'accepted' with accepted_at = now() (so
-- current_member_welcome() greets the new member). Returns the id of the household.
-- No member is added, so the 10 member limit (household_members_limit trigger, insert
-- only) never applies here.
-- Two callers with the same token are serialised by the row locks: the second one gets
-- 'invalid invitation'.
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
  where char_length(p_token) between 32 and 128
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
