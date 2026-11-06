-- Issue #336 (for #327, decision D3): accounts registered with mail and password whose
-- mail is never confirmed are deleted 7 days after the registration, with their mail,
-- profile and Supabase Auth rows (privacy skill, «diritto all'oblio»). The pg_cron job is
-- in the schedule_unconfirmed_accounts_purge migration, the grants in
-- unconfirmed_accounts_purge_grants.
--
-- Which accounts (all conditions, checked again on the locked row):
-- - email set, email_confirmed_at and phone_confirmed_at null: never confirmed;
-- - last_sign_in_at null: never signed in (a Google or Apple account, or a mail account
--   that once entered with the magic link, is confirmed or has signed in: never deleted);
-- - created_at older than 7 days at p_now;
-- - no row in household_members. With mail confirmation on, an unconfirmed account has no
--   session, so it cannot create or join a Nest: such a row is not expected. If one exists
--   anyway, the account is kept: an automatic job never deletes data of a Nest.
--
-- What is deleted for each account, in one transaction (same list as delete_own_account
-- of #218, which stays the reference for the deletion asked by the user):
-- - auth.audit_log_entries in which the account is the actor (mail and IP, no foreign key);
-- - auth.flow_state of the account (no foreign key; SAML relay states cascade);
-- - auth.refresh_tokens of the account (user_id is text, no foreign key);
-- - auth.scim_users of the account, only in the Auth versions that have the table;
-- - auth.users: the account, with identities, sessions, one-time tokens and MFA factors
--   (on delete cascade), and public.profiles (on delete cascade).
-- pgTAP checks that every other table of the auth schema with a user_id cascades.
--
-- At most 1000 accounts per call (oldest first, rows locked with skip locked so that a
-- confirmation in progress is never deleted): the job runs every hour, so no unconfirmed
-- account stays much longer than 7 days and 1 hour.
-- Security invoker: it runs as the role that calls it, postgres for pg_cron (owner of the
-- function, allowed to delete in the auth schema like delete_own_account). The API roles
-- cannot execute it (grants migration). Returns how many accounts it deleted.

create or replace function private.purge_unconfirmed_accounts(p_now timestamptz)
returns integer
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_candidates uuid[];
  v_deleted uuid[];
  v_deleted_text text[];
begin
  if p_now is null then
    raise exception 'the reference time is required' using errcode = '22004';
  end if;

  select coalesce(array_agg(s.id), '{}'::uuid[]) into v_candidates
  from (
    select u.id
    from auth.users u
    where u.email is not null
      and u.email_confirmed_at is null
      and u.phone_confirmed_at is null
      and u.last_sign_in_at is null
      and u.created_at < p_now - interval '7 days'
      and not exists (select 1 from public.household_members m where m.user_id = u.id)
    order by u.created_at, u.id
    limit 1000
    for update of u skip locked
  ) s;

  if cardinality(v_candidates) = 0 then
    return 0;
  end if;

  with gone as (
    delete from auth.users u
    where u.id = any (v_candidates)
      and u.email_confirmed_at is null
      and u.phone_confirmed_at is null
      and u.last_sign_in_at is null
      and not exists (select 1 from public.household_members m where m.user_id = u.id)
    returning u.id
  )
  select coalesce(array_agg(gone.id), '{}'::uuid[]) into v_deleted from gone;

  if cardinality(v_deleted) = 0 then
    return 0;
  end if;

  v_deleted_text := (select array_agg(d::text) from unnest(v_deleted) as d);

  delete from auth.audit_log_entries a
  where a.payload ->> 'actor_id' = any (v_deleted_text);

  delete from auth.flow_state f
  where f.user_id = any (v_deleted);

  delete from auth.refresh_tokens r
  where r.user_id = any (v_deleted_text);

  -- Not every version of Supabase Auth has this table (it is resolved only when it exists).
  if to_regclass('auth.scim_users') is not null then
    execute 'delete from auth.scim_users s where s.user_id::text = any ($1)' using v_deleted_text;
  end if;

  return cardinality(v_deleted);
end;
$$;
