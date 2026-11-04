-- Issue #218 (for page #38 «Il tuo profilo», «Elimina l'account»; also usable by #41):
-- 1. delete_own_account(p_expect_household_deletion): deletes the account of the caller,
--    and only that one;
-- 2. get_account_deletion_outcome(): what the deletion would do to the household of the
--    caller, so that the page chooses the text and the button of the dialog with the same
--    rule the database applies.
--
-- What deleting an account does, all inside one call of delete_own_account(), so in one
-- transaction: it all happens or nothing does.
-- - auth.audit_log_entries: the rows of the Supabase Auth log in which the account is the
--   actor (payload ->> 'actor_id'): they hold the email (actor_username) and the IP
--   addresses of the account, and have no foreign key towards auth.users, so they are
--   deleted explicitly (review of PR #226);
-- - auth.flow_state: the PKCE sign-in flows of the account (user_id without foreign key),
--   deleted explicitly; their SAML relay states go with them (on delete cascade);
-- - auth.refresh_tokens: user_id is text without foreign key; the tokens linked to a session
--   go with the session, the others (session_id null) are deleted explicitly;
-- - auth.scim_users (only in the Auth versions that have it): the SCIM link of the account,
--   user_id without on delete cascade, deleted explicitly;
-- - auth.users: the account, with identities, sessions, refresh tokens, MFA factors and
--   one-time tokens (foreign keys of the auth schema, on delete cascade). The browser
--   session cannot be refreshed any more; the app also clears the cookies right after.
--   pgTAP checks that no other table of the auth schema keeps a user_id without
--   on delete cascade;
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
-- No copy and no bin is kept in the database of the project (privacy skill, «diritto
-- all'oblio»). Out of reach of SQL: the backups of the platform and the logs of the
-- Supabase services outside the database.
--
-- Conventions: `set search_path = ''`, fully qualified names. Execute grants are in the
-- account_deletion_grants migration.

-- ---------------------------------------------------------------------------
-- RPC (write): deletes the account of the caller.
--
-- The account is always the one of the verified session (auth.uid()); no parameter names
-- an account, so no value sent by the browser can point to another one.
-- p_expect_household_deletion: what the dialog announced (deletes_household of
-- get_account_deletion_outcome(), false for a caller without household). When the
-- outcome changed in the meantime (for example the other adult with an account left
-- after the page was opened), nothing is deleted and the function raises FN003: the page
-- reads the outcome again and shows the new dialog. The check and the deletion are
-- serialised with the household lock of household_members_after_delete.
-- Security definer (owner: postgres): the API roles have no privilege on the auth schema.
-- Only POST through the Data API (lesson of #112): any other method is refused before
-- anything is read or written.
-- Errors:
-- - P0001 'use POST': called through the Data API with a method other than POST;
-- - 42501 'not authenticated': no signed-in user;
-- - 22004: p_expect_household_deletion is null;
-- - FN003 'account deletion outcome changed': the household would (or would not) be
--   deleted, unlike what the caller expected. Nothing changed.
-- An account already deleted (for example a second tap with the same token) deletes
-- nothing and gives no error (with false: it has no household any more).
-- ---------------------------------------------------------------------------
create or replace function public.delete_own_account(p_expect_household_deletion boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_household_id uuid;
  v_deletes_household boolean := false;
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if p_expect_household_deletion is null then
    raise exception 'the expected outcome is required' using errcode = '22004';
  end if;

  select m.household_id into v_household_id
  from public.household_members m
  where m.user_id = v_uid;

  if v_household_id is not null then
    -- Same lock as household_members_after_delete: no other adult of the household leaves
    -- or deletes the account between this check and the deletion.
    perform pg_advisory_xact_lock(hashtextextended(v_household_id::text, 0));
    v_deletes_household := not exists (
      select 1
      from public.household_members m
      where m.household_id = v_household_id
        and m.user_id is not null
        and m.user_id <> v_uid
    );
  end if;

  if v_deletes_household is distinct from p_expect_household_deletion then
    raise exception 'account deletion outcome changed' using errcode = 'FN003';
  end if;

  delete from auth.audit_log_entries a
  where a.payload ->> 'actor_id' = v_uid::text;

  delete from auth.flow_state f
  where f.user_id = v_uid;

  delete from auth.refresh_tokens r
  where r.user_id = v_uid::text;

  -- Not every version of Supabase Auth has this table (it is resolved only when it exists).
  if to_regclass('auth.scim_users') is not null then
    execute 'delete from auth.scim_users s where s.user_id::text = $1' using v_uid::text;
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
-- answer matches what the deletion then does). next_admin_member_id is typed `string`
-- by the generated types but can be null (lesson of #96).
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
