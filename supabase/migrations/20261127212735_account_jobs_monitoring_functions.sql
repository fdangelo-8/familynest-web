-- Issue #662 (monitoring of the jobs of the account, #660, and the security review of #659):
--
-- 1. private.run_scheduled_account_jobs(): at the end of every run it writes, in its own
--    sub-block, a row in private.account_job_runs (when, how many errors, whether the key
--    of the proof was there) and deletes the rows older than 30 days. An error there never
--    stops the run: it is counted and leaves a warning with the SQLSTATE only.
-- 2. public.get_account_jobs_health(): three true/false answers for the monitoring of the
--    server (service_role only). The thresholds are written there and nowhere else.
-- 3. The proof of the consents also with the previous keys: private.find_consent_evidence()
--    looks up the pseudonym computed with the active key and with every previous key of the
--    Vault. The writing (private.consent_subject_hmac()) uses always and only the active key.
--    Naming of the secrets of the Vault:
--    - active key:    consent_evidence_hmac_key (unchanged; the newest secret with that name);
--    - previous keys: consent_evidence_hmac_key_previous_YYYYMMDD, where YYYYMMDD is the last
--      day the key was active (for example consent_evidence_hmac_key_previous_20261127).
--      Any other name is ignored. A previous key is never used to write.
--    The value of a key never comes out of a function: they return only pseudonyms (owner
--    only) or rows of private.consent_evidence.
-- 4. private.purge_cron_job_run_details(): deletes the history of pg_cron older than 30 days
--    (scheduled by the schedule_cron_history_purge migration).
-- 5. public.invite_adult(): reads the row of the caller with `for key share` before the
--    advisory lock of the household, in the same order as the other «in coppia» rules (the
--    row of the member first, then the household).
--
-- Conventions: `set search_path = ''`, fully qualified names. The functions replaced with
-- `create or replace` keep their signature and their privileges; the privileges of every
-- function of this migration are set in the account_jobs_monitoring_grants migration, and
-- the new ones are revoked here at once.

-- ===========================================================================
-- 3. The pseudonym of an address, one source
-- ===========================================================================

-- HMAC-SHA256 of the address in lower case and without spaces, with the key p_key. Null when
-- the address or the key is empty. The one rule of the pseudonym, used for the active key
-- (consent_subject_hmac) and for the previous keys (previous_consent_subject_hmacs).
-- Owner only.
create or replace function private.consent_hmac(p_email text, p_key text)
returns bytea
language sql
immutable
set search_path = ''
as $$
  select case
    when lower(regexp_replace(coalesce(p_email, ''), '\s', '', 'g')) = ''
      or coalesce(p_key, '') = '' then null
    else extensions.hmac(
      convert_to(lower(regexp_replace(p_email, '\s', '', 'g')), 'UTF8'),
      convert_to(p_key, 'UTF8'),
      'sha256'
    )
  end;
$$;

revoke execute on function private.consent_hmac(text, text) from public, anon, authenticated, service_role;

-- consent_subject_hmac() of #513, same signature, result and rule: the newest secret named
-- exactly «consent_evidence_hmac_key» (the active key). Null when the address is empty, when
-- the Vault or the key is missing, or on any error. Never raises. Used to write the proof
-- (private.delete_account()), to check the key and to look up: never a previous key.
create or replace function private.consent_subject_hmac(p_email text)
returns bytea
language plpgsql
stable
set search_path = ''
as $$
declare
  v_key text;
begin
  if to_regclass('vault.decrypted_secrets') is null then
    return null;
  end if;

  execute 'select s.decrypted_secret from vault.decrypted_secrets s where s.name = $1 order by s.created_at desc limit 1'
    into v_key
    using 'consent_evidence_hmac_key';

  return private.consent_hmac(p_email, v_key);
exception
  when others then
    return null;
end;
$$;

-- The pseudonyms of the address with every previous key of the Vault (name
-- consent_evidence_hmac_key_previous_YYYYMMDD, not empty), newest name first. Empty when
-- there is no address, no Vault or no previous key. Only for the lookup
-- (find_consent_evidence), never for the writing. Owner only.
create or replace function private.previous_consent_subject_hmacs(p_email text)
returns bytea[]
language plpgsql
stable
set search_path = ''
as $$
declare
  v_hmacs bytea[];
begin
  if to_regclass('vault.decrypted_secrets') is null then
    return '{}'::bytea[];
  end if;

  execute 'select coalesce(array_agg(x.h order by x.name desc), ''{}''::bytea[])
           from (
             select s.name, private.consent_hmac($1, s.decrypted_secret) as h
             from vault.decrypted_secrets s
             where s.name ~ $2
           ) x
           where x.h is not null'
    into v_hmacs
    using p_email, '^consent_evidence_hmac_key_previous_[0-9]{8}$';

  return v_hmacs;
end;
$$;

revoke execute on function private.previous_consent_subject_hmacs(text) from public, anon, authenticated, service_role;

-- find_consent_evidence() of #513, same signature and result: for the administrator of the
-- database only, by hand, when a complaint arrives. It now finds the proof saved with the
-- active key and with every previous key. The active key is still required (22023 without
-- it, or without an address): a lookup without it would miss every proof saved since the
-- last rotation and look complete.
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
  v_active bytea := private.consent_subject_hmac(p_email);
  v_hmacs bytea[];
begin
  if v_active is null then
    raise exception 'no address or no key in the Vault' using errcode = '22023';
  end if;

  v_hmacs := array[v_active] || private.previous_consent_subject_hmacs(p_email);

  return query
    select e.kind, e.granted, e.terms_version_id, e.privacy_version_id, e.source, e.decided_at,
           e.account_deleted_on, e.purge_after
    from private.consent_evidence e
    where e.subject_hmac = any (v_hmacs)
    order by e.decided_at, e.id;
end;
$$;

-- ===========================================================================
-- 1. The hourly job writes how it went
-- ===========================================================================

-- run_scheduled_account_jobs() of #658, same signature, steps and result, plus the record of
-- the run: after the four steps, in its own sub-block, one row in private.account_job_runs
-- (ran_at = now(), the errors of the four steps, has_consent_evidence_key()) and the rows
-- older than 30 days deleted. When the record fails it is undone alone, counted in the
-- result and left as a warning (SQLSTATE only); the steps already done stay. Owner only.
create or replace function private.run_scheduled_account_jobs(p_at timestamptz default now())
returns integer
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_errors integer := 0;
  v_failed integer;
begin
  if p_at is null or not isfinite(p_at) then
    raise exception 'invalid instant' using errcode = '22023';
  end if;

  begin
    select d.failed into v_failed from private.account_deletions(p_at) d;
    v_errors := v_errors + coalesce(v_failed, 0);
  exception
    when others then
      v_errors := v_errors + 1;
      raise warning 'account job deletions failed (SQLSTATE %)', sqlstate;
  end;

  begin
    perform private.data_exports_cleanup(p_at);
  exception
    when others then
      v_errors := v_errors + 1;
      raise warning 'account job exports failed (SQLSTATE %)', sqlstate;
  end;

  begin
    perform private.purge_account_deletion_mails(p_at);
  exception
    when others then
      v_errors := v_errors + 1;
      raise warning 'account job mail_purge failed (SQLSTATE %)', sqlstate;
  end;

  begin
    perform private.purge_consent_evidence(p_at);
  exception
    when others then
      v_errors := v_errors + 1;
      raise warning 'account job evidence_purge failed (SQLSTATE %)', sqlstate;
  end;

  begin
    insert into private.account_job_runs (ran_at, errors, has_key)
    values (now(), v_errors, public.has_consent_evidence_key());

    delete from private.account_job_runs r
    where r.ran_at < now() - interval '30 days';
  exception
    when others then
      v_errors := v_errors + 1;
      raise warning 'account job record failed (SQLSTATE %)', sqlstate;
  end;

  if v_errors > 0 then
    raise warning 'account jobs: % error(s)', v_errors;
  end if;

  return v_errors;
end;
$$;

-- ===========================================================================
-- 2. The summary for the monitoring
-- ===========================================================================

-- One row with three answers, for the route of the server that checks the jobs every hour
-- (docs/infrastruttura/avvisi-lavori-account.md):
-- - key_present:     the key of the proof is usable now (has_consent_evidence_key());
-- - repeated_errors: the last 3 runs all had errors (fewer than 3 runs: false);
-- - not_running:     no run in the last 2 hours (also when no run was ever recorded).
-- The thresholds are the constants at the top, and nowhere else. Never a key, an id, a
-- number of errors or a time: only true or false. service_role only (grants migration).
-- Security definer (owner: postgres): only the owner reads the table and the Vault.
create or replace function public.get_account_jobs_health()
returns table (
  key_present boolean,
  repeated_errors boolean,
  not_running boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c_failing_runs constant integer := 3;
  c_max_silence constant interval := interval '2 hours';
  v_runs integer;
  v_failing integer;
begin
  select count(*), count(*) filter (where last_runs.errors > 0)
  into v_runs, v_failing
  from (
    select r.errors
    from private.account_job_runs r
    order by r.ran_at desc, r.id desc
    limit c_failing_runs
  ) last_runs;

  key_present := coalesce(public.has_consent_evidence_key(), false);
  repeated_errors := v_runs = c_failing_runs and v_failing = c_failing_runs;
  not_running := not exists (
    select 1
    from private.account_job_runs r
    where r.ran_at > now() - c_max_silence
  );

  return next;
end;
$$;

revoke execute on function public.get_account_jobs_health() from public, anon, authenticated, service_role;

-- ===========================================================================
-- 4. The history of pg_cron
-- ===========================================================================

-- Deletes the rows of cron.job_run_details that ended (or, without an end, started) more
-- than 30 days before p_now, for every job. Returns how many it deleted. Security invoker:
-- it runs as postgres from pg_cron (owner of the history in Supabase). Owner only.
create or replace function private.purge_cron_job_run_details(p_now timestamptz)
returns integer
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  if p_now is null or not isfinite(p_now) then
    raise exception 'invalid instant' using errcode = '22023';
  end if;

  delete from cron.job_run_details d
  where coalesce(d.end_time, d.start_time) < p_now - interval '30 days';

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke execute on function private.purge_cron_job_run_details(timestamptz) from public, anon, authenticated, service_role;

-- ===========================================================================
-- 5. invite_adult(): the row of the caller, then the household
-- ===========================================================================

-- invite_adult() of #658, same signature, grants, checks and errors. New (security review
-- of #659): the row of the caller is read with `for key share` before the advisory lock of
-- the household. The insert of the invitation needs that lock anyway (foreign key
-- invited_by_member_id); taking it after the advisory lock was the opposite order of the
-- «in coppia» rules (a delete or an update of a member locks the row, then its trigger
-- takes the advisory lock), so «Togli» on the caller and an invitation at the same time
-- could deadlock. `for key share` does not block a change of the role (no key column), so
-- the role is still read again after the advisory lock.
create or replace function public.invite_adult(p_name text, p_color public.member_color)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_household_id uuid;
  v_caller_member_id uuid;
  v_name text;
  v_member_id uuid;
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  if (select auth.uid()) is null then
    raise exception 'permission denied for function invite_adult' using errcode = '42501';
  end if;

  -- The row of the caller first: same order as the «in coppia» rules.
  select m.household_id, m.id into v_household_id, v_caller_member_id
  from public.household_members m
  where m.user_id = (select auth.uid())
  for key share;

  if not found then
    raise exception 'permission denied for function invite_adult' using errcode = '42501';
  end if;

  -- Then the household: same lock as household_members_guard_update,
  -- household_members_after_delete, household_members_couple_guard and
  -- accept_invitation_with_color.
  perform pg_advisory_xact_lock(hashtextextended(v_household_id::text, 0));

  perform 1
  from public.household_members m
  where m.id = v_caller_member_id
    and m.household_id = v_household_id
    and m.user_id = (select auth.uid())
    and m.is_admin;

  if not found then
    raise exception 'permission denied for function invite_adult' using errcode = '42501';
  end if;

  v_name := btrim(regexp_replace(p_name, '\s+', ' ', 'g'));
  if v_name is null or char_length(v_name) not between 1 and 40 or p_color is null then
    raise exception 'a name of 1 to 40 characters and a colour are required' using errcode = '22023';
  end if;

  insert into public.household_members (household_id, kind, name, color)
  values (v_household_id, 'adult', v_name, p_color)
  returning id into v_member_id;

  insert into public.invitations (household_id, member_id, invited_by_member_id)
  values (v_household_id, v_member_id, v_caller_member_id);

  return v_member_id;
end;
$$;
