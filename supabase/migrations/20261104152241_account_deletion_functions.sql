-- Issue #218 (for page #38 «Il tuo profilo», «Elimina l'account»; also usable by #41):
-- 1. delete_own_account(): deletes the account of the caller, and only that one;
-- 2. get_account_deletion_outcome(): what the deletion would do to the household of the
--    caller, so that the page chooses the text and the button of the dialog with the same
--    rule the database applies.
--
-- What deleting an account does (rules already in the database, all in the one statement
-- `delete from auth.users`, so in one transaction: it all happens or nothing does):
-- - auth.users: the account, with its identities, sessions and refresh tokens (foreign
--   keys of the auth schema, on delete cascade). The browser session cannot be refreshed
--   any more; the app also signs out (cookies) right after;
-- - profiles: the profile with name and preferences (on delete cascade);
-- - household_members: the member row of the account (on delete cascade), and with it
--   (triggers and foreign keys of household_members):
--   - its «Solo io» and «Occupato» events, its «Solo io» things to do and deadlines;
--   - its pinned spaces, space interests and notification preferences, its accepted
--     invitation, its participations in events;
--   - shared things it created («Tutto il Nest» events, shared things to do and deadlines,
--     shopping items, invitations sent) stay in the household without author; it is no
--     longer the escort, the assignee or «per chi» of anything;
-- - household_members_after_delete (base schema):
--   - no adult with an account left: the household is deleted with all its data
--     (children, pets, adults without account, invitations, events, shopping list,
--     things to do, deadlines…), decision of Francesco of 04/11;
--   - otherwise, no administrator left: the adult with an account who joined first
--     (joined_at, then created_at, then id) becomes administrator.
-- Nothing is kept anywhere (no copy, no bin): the privacy skill, «diritto all'oblio».
--
-- Conventions: `set search_path = ''`, fully qualified names. Execute grants are in the
-- account_deletion_grants migration.

-- ---------------------------------------------------------------------------
-- RPC (write): deletes the account of the caller.
--
-- No parameter: the account is always the one of the verified session (auth.uid()); no
-- value sent by the browser can point to another account.
-- Security definer (owner: postgres): the API roles have no privilege on auth.users.
-- Only POST through the Data API (lesson of #112): any other method is refused before
-- anything is read or written.
-- Errors:
-- - P0001 'use POST': called through the Data API with a method other than POST;
-- - 42501 'not authenticated': no signed-in user.
-- An account already deleted (for example a second tap with the same token) deletes
-- nothing and gives no error.
-- ---------------------------------------------------------------------------
create or replace function public.delete_own_account()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  delete from auth.users u
  where u.id = v_uid;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC (read): what deleting the account of the caller would do to their household.
-- One row when the caller has a household, no row otherwise:
-- - deletes_household: true when no other adult with an account is left (the household
--   is deleted with all its data: button «Esci e cancella la casa»);
-- - next_admin_member_id: when the household stays and the caller is its only
--   administrator, the member who becomes administrator (the other adult with an
--   account who joined first); null otherwise.
-- Same rule and same order as household_members_after_delete (pgTAP checks that the
-- answer matches what the deletion then does).
-- Security invoker: it reads only the members of the caller's own household, which RLS
-- already shows to the caller. Never writes.
-- ---------------------------------------------------------------------------
create or replace function public.get_account_deletion_outcome()
returns table (
  deletes_household boolean,
  next_admin_member_id uuid
)
language sql
stable
set search_path = ''
as $$
  with me as (
    select m.id, m.household_id, m.is_admin
    from public.household_members m
    where m.user_id = (select auth.uid())
  ),
  heir as (
    select m.id
    from public.household_members m
    join me on m.household_id = me.household_id
    where m.user_id is not null
      and m.id <> me.id
    order by m.joined_at, m.created_at, m.id
    limit 1
  )
  select
    not exists (select 1 from heir) as deletes_household,
    case
      when me.is_admin
        and not exists (
          select 1
          from public.household_members m
          where m.household_id = me.household_id
            and m.is_admin
            and m.id <> me.id
        )
      then (select heir.id from heir)
    end as next_admin_member_id
  from me;
$$;
