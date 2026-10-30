-- Issue #132 (for page #16 Ingresso con invito, PR #130): public.invitation_preview()
-- also says whether the caller is already a member of the household of the invitation,
-- so the page no longer compares household names (two households can share a name).
--
-- New output column caller_is_member boolean:
-- - valid invitation: true when the signed-in caller has a member row in the household
--   of the invitation; false otherwise (signed in without a household, signed in to
--   another household, session without user, anonymous caller);
-- - invalid invitation: null, like every other field but status, so an unusable
--   invitation still gives the same answer for every reason and every caller.
-- It tells the caller only about themselves (they already know their household); it is
-- computed only for a valid token, so it cannot be used to probe any household.
--
-- Adding an output column changes the return type, which `create or replace` cannot do:
-- the function is dropped and created again. Nothing depends on it (no view, no other
-- function). Everything else is unchanged from 20261030015510 (same checks, same
-- columns, same rules for the member names, only POST through the Data API, writes
-- nothing). Execute grants are set again in the
-- invitation_preview_caller_is_member_grants migration.
-- ---------------------------------------------------------------------------
drop function public.invitation_preview(text);

create function public.invitation_preview(p_token text)
returns table (
  status public.invitation_preview_status,
  household_name text,
  inviter_name text,
  message text,
  invitee_name text,
  invitee_color public.member_color,
  expires_at timestamptz,
  members public.invitation_preview_member[],
  caller_is_member boolean
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
      ) as members,
      -- false for anonymous callers: auth.uid() is null and matches no row.
      exists (
        select 1
        from public.household_members me
        where me.household_id = inv.household_id
          and me.user_id = (select auth.uid())
      ) as caller_is_member
    from invitation inv
    cross join caller c
    join public.households h on h.id = inv.household_id
    join public.household_members invitee on invitee.id = inv.member_id
    left join public.household_members inviter
      on inviter.id = inv.invited_by_member_id
     and inviter.household_id = inv.household_id
  )
  select p.status, p.household_name, p.inviter_name, p.message, p.invitee_name,
         p.invitee_color, p.expires_at, p.members, p.caller_is_member
  from preview p
  union all
  select 'invalid'::public.invitation_preview_status, null::text, null::text, null::text,
         null::text, null::public.member_color, null::timestamptz,
         null::public.invitation_preview_member[], null::boolean
  where not exists (select 1 from preview);
end;
$$;
