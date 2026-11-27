-- Issue #513 (DB-4 «Account e privacy», plan #501), part 2 of 2: functions and triggers.
--
-- 1. Helpers: the heir of a household, the HMAC of an address.
-- 2. Consents (security review of #650, decision B of 27/11): set_consent() with source
--    signup only at sign-up, has_consent() off while a deletion is pending, consent_records
--    never changed (also by the administrative key), the password trigger that never fails.
-- 3. Deletion of the account: private.delete_account() (the one source, used by
--    delete_own_account() and by the job), request_account_deletion(),
--    cancel_account_deletion(), get_my_account_deletion(), the trigger on auth.sessions,
--    take_account_deletion_mails(), private.find_consent_evidence().
-- 4. Export of the data: start_data_export(), finish_data_export(), fail_data_export(),
--    get_my_data_export(), list_expired_data_exports(), forget_data_export().
-- 5. Notifications (DB-2): what the recipient sees, when the phone rings and what the push
--    says, with household_handed_over and data_export_ready.
-- 6. Jobs: run_account_job() and private.run_scheduled_account_jobs() (pg_cron).
--
-- Conventions: `set search_path = ''`, fully qualified names. Every function that writes
-- through the Data API refuses any method other than POST before reading anything (P0001,
-- lesson of #112). The account is always the one of the verified session (auth.uid()): no
-- parameter names an account. Execute grants are in the account_privacy_2_policies_and_grants
-- migration.
--
-- «In coppia» rules of #652 (household_members_couple_guard): they block only statements run
-- as authenticated or anon. Every write on household_members here runs inside a security
-- definer function (owner: postgres) or the job (postgres), so neither the handover of
-- request_account_deletion() nor the deletion of the account is ever blocked by them
-- (pgTAP: account_deletion_requests.test.sql, couple cases).

-- ===========================================================================
-- 1. Helpers
-- ===========================================================================

-- The member who takes over a household when p_leaving_member_id goes: the other adult with
-- an account who joined first (joined_at, then created_at, then id). Same rule and order as
-- household_members_after_delete and get_account_deletion_outcome() (pgTAP checks that they
-- agree). Null when no other adult with an account is left.
create or replace function private.household_heir(p_household_id uuid, p_leaving_member_id uuid)
returns uuid
language sql
stable
set search_path = ''
as $$
  select m.id
  from public.household_members m
  where m.household_id = p_household_id
    and m.user_id is not null
    and m.id is distinct from p_leaving_member_id
  order by m.joined_at, m.created_at, m.id
  limit 1;
$$;

-- The pseudonym of an address in private.consent_evidence: HMAC-SHA256 of the address in
-- lower case and without spaces, with the secret «consent_evidence_hmac_key» of the Vault
-- of Supabase (created by hand in the project, never in a file). Null when the address is
-- empty, when the Vault or the key is missing, or on any error: the caller then keeps no
-- proof and goes on (the right to be forgotten comes first). Never raises.
-- Owner only (security invoker, called by security definer functions and the job).
create or replace function private.consent_subject_hmac(p_email text)
returns bytea
language plpgsql
stable
set search_path = ''
as $$
declare
  v_email text := lower(regexp_replace(coalesce(p_email, ''), '\s', '', 'g'));
  v_key text;
begin
  if v_email = '' or to_regclass('vault.decrypted_secrets') is null then
    return null;
  end if;

  execute 'select s.decrypted_secret from vault.decrypted_secrets s where s.name = $1 order by s.created_at desc limit 1'
    into v_key
    using 'consent_evidence_hmac_key';

  if v_key is null or v_key = '' then
    return null;
  end if;

  return extensions.hmac(convert_to(v_email, 'UTF8'), convert_to(v_key, 'UTF8'), 'sha256');
exception
  when others then
    return null;
end;
$$;

-- True when a file of the bucket data-exports exists at that path. Owner only.
create or replace function private.data_export_file_exists(p_object_path text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from storage.objects o
    where o.bucket_id = 'data-exports'
      and o.name = p_object_path
  );
$$;

-- ===========================================================================
-- 2. Consents
-- ===========================================================================

-- set_consent() of part 1, same signature and grants, same rules, plus (security review of
-- #650): source signup only at sign-up, never afterwards. «At sign-up» means both:
-- - the account has no decision yet about that kind (the choice of «Crea account», or of the
--   first opening after Apple or Google);
-- - the first acceptance of terms and privacy of the account (sign-up trigger or
--   accept_required_consents()) was written less than 1 hour ago.
-- Otherwise 22023 and nothing is written: later changes are settings or first_use.
create or replace function public.set_consent(
  p_kind public.consent_kind,
  p_granted boolean,
  p_source public.consent_source default 'settings'
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_first_acceptance timestamptz;
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if p_kind is null or p_kind not in ('product_news_email', 'usage_analytics', 'assistant_questions') then
    raise exception 'only an optional consent can be changed' using errcode = '22023';
  end if;

  if p_granted is null then
    raise exception 'the choice is required' using errcode = '22023';
  end if;

  if p_source is null or p_source not in ('settings', 'first_use', 'signup') then
    raise exception 'invalid source' using errcode = '22023';
  end if;

  if p_source = 'signup' then
    -- Serialise the choices of the account: two calls cannot both be «the first».
    perform pg_advisory_xact_lock(hashtextextended('public.consent_records:' || v_uid::text, 0));

    select min(c.created_at) into v_first_acceptance
    from public.consent_records c
    where c.user_id = v_uid
      and c.kind = 'terms_and_privacy';

    if v_first_acceptance is null
       or v_first_acceptance <= now() - interval '1 hour'
       or exists (
         select 1
         from public.consent_records c
         where c.user_id = v_uid
           and c.kind = p_kind
       ) then
      raise exception 'source signup only at sign-up' using errcode = '22023';
    end if;
  end if;

  insert into public.consent_records (user_id, kind, granted, terms_version_id, privacy_version_id, source)
  values (
    v_uid, p_kind, p_granted,
    private.current_legal_version('terms'), private.current_legal_version('privacy'),
    p_source
  );
end;
$$;

-- has_consent() of part 1, same signature and grants: also false for an optional consent
-- while the account has a deletion request (advice of legale-privacy in #513: no news mail
-- and no usage numbers for who asked to leave). Cancelling the request brings the
-- decisions back as they were.
create or replace function private.has_consent(p_user_id uuid, p_kind public.consent_kind)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (
      select c.granted
      from public.consent_records c
      where c.user_id = p_user_id
        and c.kind = p_kind
      order by c.created_at desc, c.id desc
      limit 1
    ),
    false
  )
  and not (
    p_kind in ('product_news_email', 'usage_analytics', 'assistant_questions')
    and exists (select 1 from private.account_deletion_requests r where r.user_id = p_user_id)
  );
$$;

-- consent_records is append only for every role, the administrative key included (review of
-- #650): a row is never changed. Rows still go with the account (delete, cascade).
create or replace function private.consent_records_refuse_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'a consent record is never changed' using errcode = '42501';
end;
$$;

create trigger consent_records_refuse_update
  before update on public.consent_records
  for each row execute function private.consent_records_refuse_update();

-- The password trigger of part 1, same rules: it now never fails the sign-up or the change
-- of password (review of #650). password_changed_at is for display only (column comment).
create or replace function private.profiles_set_password_changed_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles p
  set password_changed_at = case when coalesce(new.encrypted_password, '') = '' then null else now() end
  where p.id = new.id;
  return null;
exception
  when others then
    return null;
end;
$$;

-- ===========================================================================
-- 3. Deletion of the account
-- ===========================================================================

-- The one deletion of an account (rule 10, CA-31): used by delete_own_account() (at once) and
-- by the job deletions (after the 14 days). Inside the caller's transaction: all or nothing.
-- 1. private.consent_evidence: a copy of every consent of the account with the HMAC of its
--    address, account_deleted_on = the day of p_at in Europe/Rome, purge_after 5 years later
--    (decision B of 27/11). Without the key in the Vault (or without an address) nothing is
--    copied and the account is deleted anyway.
-- 2. private.data_export_leftovers: the files of the account in the bucket data-exports, for
--    the server to remove through the Storage API (their rows go with the account).
-- 3. The same rows as delete_own_account() of #218: the Supabase Auth log entries in which
--    the account is the actor, the sign-in flows, the refresh tokens, the SCIM link, then the
--    account (identities, sessions, MFA factors, one-time tokens, profile, member row,
--    consents, exports, deletion request: on delete cascade). The triggers of
--    household_members keep a household with another adult with an account (who becomes
--    administrator when none is left) and delete one without.
-- Returns false when the account does not exist (nothing done). Owner only.
create or replace function private.delete_account(p_user_id uuid, p_at timestamptz)
returns boolean
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_email text;
  v_day date := (coalesce(p_at, now()) at time zone 'Europe/Rome')::date;
  v_hmac bytea;
begin
  select u.email into v_email
  from auth.users u
  where u.id = p_user_id
  for update;

  if not found then
    return false;
  end if;

  v_hmac := private.consent_subject_hmac(v_email);
  if v_hmac is not null then
    insert into private.consent_evidence (
      subject_hmac, kind, granted, terms_version_id, privacy_version_id, source, decided_at,
      account_deleted_on, purge_after
    )
    select v_hmac, c.kind, c.granted, c.terms_version_id, c.privacy_version_id, c.source, c.created_at,
           v_day, (v_day + interval '5 years')::date
    from public.consent_records c
    where c.user_id = p_user_id;
  end if;

  insert into private.data_export_leftovers (object_path)
  select o.name
  from storage.objects o
  where o.bucket_id = 'data-exports'
    and o.name like p_user_id::text || '/%'
  on conflict (object_path) do nothing;

  delete from auth.audit_log_entries a
  where a.payload ->> 'actor_id' = p_user_id::text;

  delete from auth.flow_state f
  where f.user_id = p_user_id;

  delete from auth.refresh_tokens r
  where r.user_id = p_user_id::text;

  -- Not every version of Supabase Auth has this table (it is resolved only when it exists).
  if to_regclass('auth.scim_users') is not null then
    execute 'delete from auth.scim_users s where s.user_id::text = $1' using p_user_id::text;
  end if;

  delete from auth.users u
  where u.id = p_user_id;

  return true;
end;
$$;

-- delete_own_account() of #218, same signature, grants, checks and errors (P0001, 42501,
-- 22004, FN003): it deletes at once, now through private.delete_account(), the same
-- function as the job (CA-31). A deletion request of the account goes with it.
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

  perform private.delete_account(v_uid, now());
end;
$$;

-- RPC (write): «Elimina l'account» with 14 days to think it over (rule 8, cb1-50 – cb1-52).
-- Same rule, lock and error FN003 as delete_own_account(): p_expect_household_deletion is
-- what the dialog announced (deletes_household of get_account_deletion_outcome()). Returns
-- delete_on: the day of the request in Europe/Rome + 14 (the last day to think it over).
-- In the same transaction:
-- - the caller is the only administrator and the household stays: the heir (the other adult
--   with an account who joined first) becomes administrator, the caller no longer is, and
--   the heir gets household_handed_over with the caller as actor. The «in coppia» guard of
--   #652 does not block it (it only checks authenticated and anon; this runs as the owner);
-- - every session, refresh token and push device of the caller is deleted (the current
--   access token works until it expires, about 1 hour, then it cannot be refreshed);
-- - deletes_household = true only when the caller is the only adult with an account.
-- A second request keeps the first one as it is (same delete_on, nothing else done).
-- Security definer (owner: postgres): the API roles have no privilege on the auth schema
-- nor on the private table.
-- Errors: P0001 'use POST'; 42501 'not authenticated'; 22004 p_expect_household_deletion is
-- null; FN003 'account deletion outcome changed' (nothing changed).
create or replace function public.request_account_deletion(p_expect_household_deletion boolean)
returns date
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_member_id uuid;
  v_household_id uuid;
  v_is_admin boolean := false;
  v_deletes_household boolean := false;
  v_heir uuid;
  v_delete_on date;
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
    -- Same lock as delete_own_account() and the role rules of household_members.
    perform pg_advisory_xact_lock(hashtextextended(v_household_id::text, 0));

    select m.id, m.is_admin into v_member_id, v_is_admin
    from public.household_members m
    where m.user_id = v_uid
      and m.household_id = v_household_id;

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

  -- One request per account: a second one (for example a second tap) changes nothing.
  perform pg_advisory_xact_lock(hashtextextended('private.account_deletion_requests:' || v_uid::text, 0));
  select r.delete_on into v_delete_on
  from private.account_deletion_requests r
  where r.user_id = v_uid;
  if found then
    return v_delete_on;
  end if;

  if v_member_id is not null
     and not v_deletes_household
     and v_is_admin
     and not exists (
       select 1
       from public.household_members m
       where m.household_id = v_household_id
         and m.is_admin
         and m.id <> v_member_id
     ) then
    v_heir := private.household_heir(v_household_id, v_member_id);

    update public.household_members m
    set is_admin = true
    where m.id = v_heir;

    update public.household_members m
    set is_admin = false
    where m.id = v_member_id;

    insert into public.notifications (household_id, recipient_member_id, kind, actor_member_id)
    values (v_household_id, v_heir, 'household_handed_over', v_member_id);
  end if;

  if v_member_id is not null then
    delete from public.push_subscriptions ps
    where ps.member_id = v_member_id;
  end if;

  delete from auth.refresh_tokens r
  where r.user_id = v_uid::text;

  delete from auth.sessions s
  where s.user_id = v_uid;

  v_delete_on := (now() at time zone 'Europe/Rome')::date + 14;

  insert into private.account_deletion_requests (user_id, household_id, delete_on, deletes_household)
  values (v_uid, v_household_id, v_delete_on, v_deletes_household);

  return v_delete_on;
end;
$$;

-- RPC (write): «Ho cambiato idea: annulla» (rule 9). Takes the request of the caller away,
-- until its delete_on included (Europe/Rome); afterwards, or without a request, nothing
-- changes and no error. Who became administrator stays administrator (question 6).
-- Security definer (owner: postgres): the table is private. Only the caller's own request.
create or replace function public.cancel_account_deletion()
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

  delete from private.account_deletion_requests r
  where r.user_id = v_uid
    and r.delete_on >= (now() at time zone 'Europe/Rome')::date;
end;
$$;

-- RPC (read): the deletion request of the caller, 0 or 1 row (delete_on, deletes_household).
-- Security definer (owner: postgres): the table is private. Only the caller's own request.
create or replace function public.get_my_account_deletion()
returns table (
  delete_on date,
  deletes_household boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.delete_on, r.deletes_household
  from private.account_deletion_requests r
  where r.user_id = (select auth.uid());
$$;

-- Trigger (after insert on auth.sessions): every new sign-in takes the deletion request of
-- the account away, until its delete_on included («se rientri, l'eliminazione si annulla»,
-- rule 9). It never fails the sign-in: any error is swallowed.
-- Security definer (owner: postgres): the auth service has no privilege on the private table.
create or replace function private.auth_sessions_cancel_account_deletion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from private.account_deletion_requests r
  where r.user_id = new.user_id
    and r.delete_on >= (now() at time zone 'Europe/Rome')::date;
  return null;
exception
  when others then
    return null;
end;
$$;

create trigger on_auth_session_created_cancel_account_deletion
  after insert on auth.sessions
  for each row execute function private.auth_sessions_cancel_account_deletion();

-- RPC for the server (rule 11, service_role only): the addresses for the last mail, the
-- oldest first, at most p_limit (1 – 50, 22023 otherwise). Each row is given once: it is
-- deleted in the same call. Rows older than 72 hours are never given (the job mail_purge
-- deletes them). Only POST through the Data API.
create or replace function public.take_account_deletion_mails(p_limit integer)
returns table (
  email text,
  deleted_on date
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  if p_limit is null or p_limit not between 1 and 50 then
    raise exception 'the limit is from 1 to 50' using errcode = '22023';
  end if;

  return query
    with picked as (
      select m.id
      from private.account_deletion_mails m
      where m.created_at > now() - interval '72 hours'
      order by m.created_at, m.id
      limit p_limit
      for update skip locked
    ),
    gone as (
      delete from private.account_deletion_mails m
      using picked
      where m.id = picked.id
      returning m.id, m.email, m.deleted_on, m.created_at
    )
    select g.email, g.deleted_on
    from gone g
    order by g.created_at, g.id;
end;
$$;

-- For the administrator of the database only, by hand, when a complaint arrives (decision B
-- of 27/11): the proof of the consents of a deleted account with that address. No API role
-- executes it (service_role included). 22023 when the key of the Vault is missing.
create or replace function private.find_consent_evidence(p_email text)
returns table (
  kind public.consent_kind,
  granted boolean,
  terms_version_id uuid,
  privacy_version_id uuid,
  source public.consent_source,
  decided_at timestamptz,
  account_deleted_on date,
  purge_after date
)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_hmac bytea := private.consent_subject_hmac(p_email);
begin
  if v_hmac is null then
    raise exception 'no address or no key in the Vault' using errcode = '22023';
  end if;

  return query
    select e.kind, e.granted, e.terms_version_id, e.privacy_version_id, e.source, e.decided_at,
           e.account_deleted_on, e.purge_after
    from private.consent_evidence e
    where e.subject_hmac = v_hmac
    order by e.decided_at, e.id;
end;
$$;

-- ===========================================================================
-- 4. Export of the data (rule 12)
-- ===========================================================================

create trigger data_exports_set_updated_at
  before update on public.data_exports
  for each row execute function public.set_updated_at();

-- Trigger (after delete on data_exports): a row that goes while its file is still in the
-- bucket (the account deleted in any way, also by the administrative key or by Supabase
-- Auth) leaves the path in private.data_export_leftovers, for the server to remove the file
-- through the Storage API. The job and forget_data_export() delete a row only once the file
-- is gone, so they leave nothing.
-- Security definer (owner: postgres): the cascade can run as the auth service, which has no
-- privilege on storage.objects nor on the private table.
create or replace function private.data_exports_keep_leftover_file()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_path text := old.user_id::text || '/' || old.id::text || '.zip';
begin
  if private.data_export_file_exists(v_path) then
    insert into private.data_export_leftovers (object_path)
    values (v_path)
    on conflict (object_path) do nothing;
  end if;
  return null;
end;
$$;

create trigger data_exports_keep_leftover_file
  after delete on public.data_exports
  for each row execute function private.data_exports_keep_leftover_file();

-- RPC (write): «Esporta i miei dati». Returns the id of the export to prepare:
-- - the caller's export preparing for less than 30 minutes, when there is one (a second tap);
-- - otherwise a new row preparing; at most 5 requests a day (Europe/Rome) per account: the
--   sixth gives 54000.
-- The server then uploads data-exports/<user_id>/<id>.zip with the session of the account
-- and calls finish_data_export() (or fail_data_export()).
-- Security definer (owner: postgres): the app has no insert privilege on data_exports.
create or replace function public.start_data_export()
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_id uuid;
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  -- Limit per account: lock before counting (LEZIONI).
  perform pg_advisory_xact_lock(hashtextextended('public.data_exports:' || v_uid::text, 0));

  select e.id into v_id
  from public.data_exports e
  where e.user_id = v_uid
    and e.status = 'preparing'
    and e.requested_at > now() - interval '30 minutes'
  order by e.requested_at desc, e.id desc
  limit 1;

  if v_id is not null then
    return v_id;
  end if;

  if (
    select count(*)
    from public.data_exports e
    where e.user_id = v_uid
      and e.requested_at >= ((now() at time zone 'Europe/Rome')::date::timestamp at time zone 'Europe/Rome')
  ) >= 5 then
    raise exception 'at most 5 exports a day' using errcode = '54000';
  end if;

  insert into public.data_exports (user_id)
  values (v_uid)
  returning id into v_id;

  return v_id;
end;
$$;

-- RPC (write): the file of an export is uploaded. Only on an export of the caller still
-- preparing, only when data-exports/<user_id>/<id>.zip exists, with p_size_bytes from 1 to
-- 50 MiB (22023 otherwise, nothing changes). Sets ready, ready_at = now(), expires_at =
-- ready_at + 24 hours, size_bytes; when the caller is a member of a household, a
-- data_export_ready notification for the caller (no actor).
-- Security definer (owner: postgres): the app has no update privilege on data_exports and
-- no access to storage.objects of the other paths.
create or replace function public.finish_data_export(p_id uuid, p_size_bytes bigint)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_now timestamptz := now();
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if p_id is null or p_size_bytes is null or p_size_bytes not between 1 and 52428800 then
    raise exception 'invalid export or size' using errcode = '22023';
  end if;

  perform 1
  from public.data_exports e
  where e.id = p_id
    and e.user_id = v_uid
    and e.status = 'preparing'
  for update;

  if not found then
    raise exception 'no export in preparation' using errcode = '22023';
  end if;

  if not private.data_export_file_exists(v_uid::text || '/' || p_id::text || '.zip') then
    raise exception 'the file of the export is missing' using errcode = '22023';
  end if;

  update public.data_exports e
  set status = 'ready',
      ready_at = v_now,
      expires_at = v_now + interval '24 hours',
      size_bytes = p_size_bytes
  where e.id = p_id;

  insert into public.notifications (household_id, recipient_member_id, kind)
  select m.household_id, m.id, 'data_export_ready'
  from public.household_members m
  where m.user_id = v_uid
    and m.kind = 'adult';
end;
$$;

-- RPC (write): the server could not prepare the file. Only on an export of the caller still
-- preparing (22023 otherwise): it becomes failed.
-- Security definer (owner: postgres): the app has no update privilege on data_exports.
create or replace function public.fail_data_export(p_id uuid)
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

  update public.data_exports e
  set status = 'failed'
  where e.id = p_id
    and e.user_id = v_uid
    and e.status = 'preparing';

  if not found then
    raise exception 'no export in preparation' using errcode = '22023';
  end if;
end;
$$;

-- RPC (read): the last export of the caller (cb1-47, cb1-48), or no row when there is none
-- or the last one is ready and expired.
-- Security invoker: it reads only the caller's own rows (RLS of data_exports).
create or replace function public.get_my_data_export()
returns table (
  id uuid,
  status public.data_export_status,
  requested_at timestamptz,
  ready_at timestamptz,
  expires_at timestamptz,
  size_bytes bigint
)
language sql
stable
set search_path = ''
as $$
  select l.id, l.status, l.requested_at, l.ready_at, l.expires_at, l.size_bytes
  from (
    select e.id, e.status, e.requested_at, e.ready_at, e.expires_at, e.size_bytes
    from public.data_exports e
    where e.user_id = (select auth.uid())
    order by e.requested_at desc, e.id desc
    limit 1
  ) l
  where not (l.status = 'ready' and l.expires_at <= now());
$$;

-- RPC for the server (service_role only): the files to remove through the Storage API, the
-- oldest first, at most p_limit (1 – 100, 22023 otherwise):
-- - every ready export past expires_at (also when its file is already gone, until
--   forget_data_export() or the job takes the row away);
-- - every failed export that still has a file;
-- - the files of the deleted accounts (private.data_export_leftovers).
-- export_id is the id to pass to forget_data_export(). Only POST through the Data API.
create or replace function public.list_expired_data_exports(p_limit integer)
returns table (
  export_id uuid,
  object_path text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  if p_limit is null or p_limit not between 1 and 100 then
    raise exception 'the limit is from 1 to 100' using errcode = '22023';
  end if;

  return query
    select f.id, f.path
    from (
      select e.id, e.user_id::text || '/' || e.id::text || '.zip' as path, e.expires_at as since
      from public.data_exports e
      where e.status = 'ready'
        and e.expires_at <= now()
      union all
      select e.id, e.user_id::text || '/' || e.id::text || '.zip', e.updated_at
      from public.data_exports e
      where e.status = 'failed'
        and private.data_export_file_exists(e.user_id::text || '/' || e.id::text || '.zip')
      union all
      select l.id, l.object_path, l.created_at
      from private.data_export_leftovers l
    ) f
    order by f.since, f.id
    limit p_limit;
end;
$$;

-- RPC for the server (service_role only): the file of p_id (an export of
-- list_expired_data_exports()) was removed through the Storage API: the row goes. When the
-- file is still there: 22023 and nothing changes (the row is the only trace of the file). An
-- unknown id, or an export that is not expired nor failed: nothing changes, no error. Only
-- POST through the Data API.
create or replace function public.forget_data_export(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_path text;
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  select e.user_id::text || '/' || e.id::text || '.zip' into v_path
  from public.data_exports e
  where e.id = p_id
    and ((e.status = 'ready' and e.expires_at <= now()) or e.status = 'failed')
  for update;

  if v_path is not null then
    if private.data_export_file_exists(v_path) then
      raise exception 'the file is still there' using errcode = '22023';
    end if;
    delete from public.data_exports e where e.id = p_id;
    return;
  end if;

  select l.object_path into v_path
  from private.data_export_leftovers l
  where l.id = p_id
  for update;

  if v_path is not null then
    if private.data_export_file_exists(v_path) then
      raise exception 'the file is still there' using errcode = '22023';
    end if;
    delete from private.data_export_leftovers l where l.id = p_id;
  end if;
end;
$$;

-- ===========================================================================
-- 5. Notifications (DB-2) with the two new kinds
-- ===========================================================================

-- private.notification_is_visible() of DB-2 part 2, same rules, plus:
-- - household_handed_over: visible while the previous organiser is in the household (the
--   notification goes with them, actor on delete cascade);
-- - data_export_ready: always (the recipient's own export).
create or replace function private.notification_is_visible(p_notification_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.notifications n
    join public.household_members r
      on r.id = n.recipient_member_id
     and r.household_id = n.household_id
    where n.id = p_notification_id
      and r.kind = 'adult'
      and r.user_id is not null
      and ((select auth.uid()) is null or r.user_id = (select auth.uid()))
      and case n.kind
        when 'todo_assigned' then exists (
          select 1
          from public.todos t
          where t.id = n.todo_id
            and t.household_id = n.household_id
            and (not t.is_private or t.created_by_member_id = r.id)
        )
        when 'deadline_reminder' then exists (
          select 1
          from public.deadlines d
          where d.id = n.deadline_id
            and d.household_id = n.household_id
            and private.deadline_open_to_member(d.is_private, d.created_by_member_id, r.id)
        )
        when 'event_time_changed' then
          private.event_open_to_member(n.event_id, r.id)
          and (
            n.occurrence_date is null
            or exists (
              select 1
              from public.events e
              where e.id = n.event_id
                and e.recurrence <> 'none'
                and private.event_has_occurrence_on(
                  e.starts_at, e.recurrence, e.recurrence_weekdays, e.recurrence_until, n.occurrence_date
                )
                and not exists (
                  select 1
                  from public.event_exceptions x
                  where x.event_id = e.id
                    and x.occurrence_date = n.occurrence_date
                    and x.is_cancelled
                )
            )
          )
        when 'gift_taken' then exists (
          select 1
          from public.wishlist_reservations w
          where w.id = n.wishlist_reservation_id
            and w.household_id = n.household_id
        )
        when 'free_together' then true
        when 'shopping_added' then true
        when 'member_joined' then true
        when 'event_reminder' then
          private.event_open_to_member(n.event_id, r.id)
          and exists (select 1 from private.event_occurrence_on(n.event_id, n.occurrence_date))
        when 'ride_reminder' then
          private.event_open_to_member(n.event_id, r.id)
          and exists (select 1 from private.event_occurrence_on(n.event_id, n.occurrence_date))
        when 'ride_request' then
          private.event_open_to_member(n.event_id, r.id)
          and exists (select 1 from private.event_occurrence_on(n.event_id, n.occurrence_date))
        when 'overlap_tomorrow' then
          private.event_open_to_member(n.event_id, r.id)
          and private.event_open_to_member(n.other_event_id, r.id)
          and exists (select 1 from private.event_occurrence_on(n.event_id, n.occurrence_date))
          and exists (select 1 from private.event_occurrence_on(n.other_event_id, n.other_occurrence_date))
        when 'household_handed_over' then true
        when 'data_export_ready' then true
        else false
      end
  );
$$;

-- private.push_schedule() of DB-2 part 2, same rules (CA-33), plus:
-- - household_handed_over rings at once in every way, «Solo il riepilogo» included (the
--   recipient now organises the household); «Silenzio di notte» as the recipient chose;
-- - data_export_ready is a «Tocca a te» kind: at once with «Ogni avviso» and «Subito quelle
--   per me», in the evening summary with «Solo il riepilogo».
create or replace function private.push_schedule(p_notification_id uuid, p_urgent boolean)
returns void
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_note record;
  v_mode public.notification_delivery_mode;
  v_quiet boolean;
  v_now boolean;
  v_due timestamptz;
  v_moment timestamptz;
begin
  select n.id, n.kind, n.household_id, n.recipient_member_id, n.created_at, n.event_id, n.occurrence_date,
         n.ride_leg
  into v_note
  from public.notifications n
  where n.id = p_notification_id;
  if not found then
    return;
  end if;

  if not exists (
    select 1 from public.push_subscriptions s where s.member_id = v_note.recipient_member_id
  ) then
    return;
  end if;

  select coalesce(p.delivery_mode, 'mine_now'), coalesce(p.quiet_hours, true)
  into v_mode, v_quiet
  from (select 1) one
  left join public.notification_preferences p on p.member_id = v_note.recipient_member_id;

  v_now := v_mode = 'each'
    or (
      v_mode = 'mine_now'
      and v_note.kind in (
        'todo_assigned', 'deadline_reminder', 'event_reminder', 'ride_reminder', 'ride_request', 'member_joined',
        'data_export_ready'
      )
    )
    or (v_note.kind = 'event_time_changed' and coalesce(p_urgent, false))
    or v_note.kind = 'household_handed_over';

  if not v_now then
    if v_note.kind = 'overlap_tomorrow' and exists (
      select 1
      from private.push_deliveries x
      where x.recipient_member_id = v_note.recipient_member_id
        and x.kind = 'evening_digest'
        and x.digest_day = (v_note.created_at at time zone 'Europe/Rome')::date
    ) then
      return;
    end if;
    insert into private.push_digest_items (notification_id, household_id, recipient_member_id, created_at)
    values (v_note.id, v_note.household_id, v_note.recipient_member_id, v_note.created_at)
    on conflict do nothing;
    return;
  end if;

  v_due := private.push_ring_at(v_note.created_at, v_quiet or v_note.kind = 'member_joined');

  if v_note.kind = 'overlap_tomorrow'
     and v_due >= (((v_note.created_at at time zone 'Europe/Rome')::date + 1)::timestamp at time zone 'Europe/Rome') then
    return;
  end if;

  if v_due > v_note.created_at and v_note.kind in ('event_reminder', 'ride_reminder') then
    select case when v_note.ride_leg = 'pickup' then o.ends_at else o.starts_at end
    into v_moment
    from private.event_occurrence_on(v_note.event_id, v_note.occurrence_date) o
    limit 1;
    if v_moment is null or v_moment <= v_due then
      return;
    end if;
  end if;

  insert into private.push_deliveries (household_id, recipient_member_id, kind, notification_id, due_at)
  values (v_note.household_id, v_note.recipient_member_id, 'single', v_note.id, v_due)
  on conflict do nothing;
end;
$$;

-- private.push_content() of DB-2 part 2, same rules, plus: household_handed_over gives the
-- name of who asked to delete the account as person_name (unless «Nascondi il contenuto»);
-- data_export_ready gives only its kind. at, title and place are null for both.
create or replace function private.push_content(p_delivery_id uuid)
returns table (
  notification_id uuid,
  kind public.notification_kind,
  line public.morning_digest_line,
  at timestamptz,
  title text,
  place text,
  person_name text,
  item_count integer,
  is_hidden boolean
)
language sql
stable
set search_path = ''
as $$
  with delivery as (
    select
      pd.id,
      pd.kind,
      pd.notification_id,
      pd.recipient_member_id,
      pd.digest_day,
      coalesce(p.hide_content, false) as hide
    from private.push_deliveries pd
    left join public.notification_preferences p on p.member_id = pd.recipient_member_id
    where pd.id = p_delivery_id
  ),
  carried as (
    select d.recipient_member_id, d.hide, d.notification_id
    from delivery d
    where d.kind = 'single'
    union all
    select d.recipient_member_id, d.hide, i.notification_id
    from delivery d
    join private.push_digest_items i
      on i.delivery_id = d.id
     and i.recipient_member_id = d.recipient_member_id
    where d.kind = 'evening_digest'
  ),
  notification_rows as (
    select
      n.id as notification_id,
      n.kind,
      n.created_at,
      case n.kind
        when 'todo_assigned' then t.due_date::timestamp at time zone 'Europe/Rome'
        when 'deadline_reminder' then dl.due_date::timestamp at time zone 'Europe/Rome'
        when 'event_time_changed' then
          case
            when n.occurrence_date is not null then coalesce(
              x.starts_at,
              (n.occurrence_date + (e.starts_at at time zone 'Europe/Rome')::time) at time zone 'Europe/Rome'
            )
            when e.recurrence = 'none' then e.starts_at
          end
        when 'free_together' then n.free_from
        when 'event_reminder' then o.starts_at
        when 'ride_request' then o.starts_at
        when 'ride_reminder' then case when n.ride_leg = 'pickup' then o.ends_at else o.starts_at end
        when 'overlap_tomorrow' then greatest(o.starts_at, o2.starts_at)
      end as happens_at,
      case
        when n.kind = 'todo_assigned' then t.title
        when n.kind = 'deadline_reminder' then dl.title
        when n.kind = 'event_time_changed' and e.visibility = 'household' then coalesce(x.title, e.title)
        when n.kind in ('event_reminder', 'ride_reminder', 'ride_request', 'overlap_tomorrow')
             and e.visibility = 'household' then o.title
      end as title,
      case
        when n.kind = 'event_time_changed' and e.visibility = 'household' then
          case when x.event_id is not null then x.location else e.location end
        when n.kind in ('event_reminder', 'ride_reminder', 'ride_request', 'overlap_tomorrow')
             and e.visibility = 'household' then o.location
      end as place,
      case
        when n.kind in (
          'todo_assigned', 'event_time_changed', 'shopping_added', 'member_joined', 'ride_request',
          'household_handed_over'
        )
          then a.name
        when n.kind = 'overlap_tomorrow' then s.name
      end as person_name,
      n.item_count,
      c.hide
    from carried c
    join public.notifications n
      on n.id = c.notification_id
     and n.recipient_member_id = c.recipient_member_id
    left join public.todos t on t.id = n.todo_id
    left join public.deadlines dl on dl.id = n.deadline_id
    left join public.events e on e.id = n.event_id
    left join public.event_exceptions x
      on n.kind = 'event_time_changed'
     and x.event_id = n.event_id
     and x.occurrence_date = n.occurrence_date
     and not x.is_cancelled
    left join lateral (
      select oc.starts_at, oc.ends_at, oc.title, oc.location
      from private.event_occurrence_on(n.event_id, n.occurrence_date) oc
      limit 1
    ) o on n.kind in ('event_reminder', 'ride_reminder', 'ride_request', 'overlap_tomorrow')
    left join lateral (
      select oc.starts_at
      from private.event_occurrence_on(n.other_event_id, n.other_occurrence_date) oc
      limit 1
    ) o2 on n.kind = 'overlap_tomorrow'
    left join public.household_members a on a.id = n.actor_member_id
    left join public.household_members s on s.id = n.subject_member_id
    where private.notification_is_visible(n.id)
  ),
  digest_rows as (
    select m.line, m.at, m.title, dm.name as person_name, m.count, d.hide, m.ord
    from delivery d
    cross join lateral private.morning_digest(d.recipient_member_id, d.digest_day)
      with ordinality as m (line, at, count, event_id, title, leg, driver_member_id, member_ids, ord)
    left join public.household_members dm on dm.id = m.driver_member_id
    where d.kind = 'morning_digest'
  ),
  all_rows as (
    select
      r.notification_id, r.kind, null::public.morning_digest_line as line, r.happens_at as at, r.title,
      r.place, r.person_name, r.item_count, r.hide,
      1 as sort_group, r.created_at as sort_at, r.notification_id as sort_id, 0::bigint as sort_ord
    from notification_rows r
    union all
    select
      null::uuid, null::public.notification_kind, g.line, g.at, g.title, null::text, g.person_name, g.count,
      g.hide, 2, null::timestamptz, null::uuid, g.ord
    from digest_rows g
  )
  select
    w.notification_id,
    w.kind,
    w.line,
    w.at,
    case when w.hide then null else w.title end,
    case when w.hide then null else w.place end,
    case when w.hide then null else w.person_name end,
    w.item_count,
    w.hide
  from all_rows w
  order by w.sort_group, w.sort_at, w.sort_id, w.sort_ord;
$$;

-- ===========================================================================
-- 6. Jobs (rules 10, 11, 12, 13; decision B of 27/11)
-- ===========================================================================

-- deletions: every account whose delete_on is before the day of p_at (Europe/Rome), so from
-- 00:00 of the day after delete_on. For each one, in this transaction: its address goes to
-- private.account_deletion_mails (deleted_on = the day of p_at), then
-- private.delete_account(). The household rule is the one of that moment: a household with
-- another adult with an account is never deleted (that adult becomes administrator when none
-- is left), whatever deletes_household said. At most 200 accounts per run (the job runs
-- every hour). Returns how many accounts it deleted. Owner only.
create or replace function private.account_deletions(p_at timestamptz)
returns integer
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_today date := (p_at at time zone 'Europe/Rome')::date;
  v_user uuid;
  v_count integer := 0;
begin
  for v_user in
    select r.user_id
    from private.account_deletion_requests r
    where r.delete_on < v_today
    order by r.delete_on, r.user_id
    limit 200
    for update skip locked
  loop
    insert into private.account_deletion_mails (email, deleted_on)
    select u.email, v_today
    from auth.users u
    where u.id = v_user
      and coalesce(btrim(u.email), '') <> '';

    if private.delete_account(v_user, p_at) then
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

-- exports: an export preparing for more than 30 minutes at p_at becomes failed; a ready one
-- expired at p_at, or a failed one older than 7 days, is deleted, but only when its file is
-- no longer there (Storage keeps a file whose row is deleted). Returns how many rows changed
-- or went. Owner only.
create or replace function private.data_exports_cleanup(p_at timestamptz)
returns integer
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_failed integer;
  v_deleted integer;
begin
  update public.data_exports e
  set status = 'failed'
  where e.status = 'preparing'
    and e.requested_at < p_at - interval '30 minutes';
  get diagnostics v_failed = row_count;

  delete from public.data_exports e
  where (
      (e.status = 'ready' and e.expires_at <= p_at)
      or (e.status = 'failed' and e.updated_at < p_at - interval '7 days')
    )
    and not private.data_export_file_exists(e.user_id::text || '/' || e.id::text || '.zip');
  get diagnostics v_deleted = row_count;

  return v_failed + v_deleted;
end;
$$;

-- mail_purge: the addresses for the last mail older than 72 hours at p_at, taken or not.
-- Returns how many. Owner only.
create or replace function private.purge_account_deletion_mails(p_at timestamptz)
returns integer
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from private.account_deletion_mails m
  where m.created_at < p_at - interval '72 hours';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- evidence_purge: the proof of the consents whose purge_after is before the day of p_at
-- (Europe/Rome). Returns how many. Owner only.
create or replace function private.purge_consent_evidence(p_at timestamptz)
returns integer
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from private.consent_evidence e
  where e.purge_after < (p_at at time zone 'Europe/Rome')::date;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- RPC (rule 13): runs one job of the account as if it ran at the instant p_at. Returns what
-- the job returns. service_role and the database owner only (grants migration). Every job
-- can run again without doing anything twice. Only POST through the Data API.
-- Security definer (owner: postgres): the jobs write in the auth and private schemas.
create or replace function public.run_account_job(
  p_job public.account_job,
  p_at timestamptz default now()
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  if p_job is null or p_at is null or not isfinite(p_at) then
    raise exception 'invalid job or instant' using errcode = '22023';
  end if;

  return case p_job
    when 'deletions' then private.account_deletions(p_at)
    when 'exports' then private.data_exports_cleanup(p_at)
    when 'mail_purge' then private.purge_account_deletion_mails(p_at)
    when 'evidence_purge' then private.purge_consent_evidence(p_at)
  end;
end;
$$;

-- The pg_cron entry (every hour): the four jobs, in this order. Owner only.
create or replace function private.run_scheduled_account_jobs(p_at timestamptz default now())
returns void
language plpgsql
volatile
set search_path = ''
as $$
begin
  perform private.account_deletions(p_at);
  perform private.data_exports_cleanup(p_at);
  perform private.purge_account_deletion_mails(p_at);
  perform private.purge_consent_evidence(p_at);
end;
$$;
