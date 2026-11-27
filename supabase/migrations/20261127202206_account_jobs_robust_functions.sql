-- Issue #658: the jobs of the account more robust (non-blocking recommendations of the
-- review of #657 and of the security review of #652).
--
-- 1. public.run_account_job(): an instant in the future is refused (22023). A future p_at
--    passed by mistake would run at once every pending deletion and every purge.
-- 2. The hourly job: every step is isolated. private.account_deletions() deletes every
--    account in its own sub-block (an error on one account undoes only that account: its
--    last-mail address and its deletion; the request stays and the next run tries again),
--    and private.run_scheduled_account_jobs() runs each of the four steps in its own
--    sub-block. Both count the errors. The warnings carry only the step and the SQLSTATE:
--    never an address, a name or an id.
-- 3. public.invite_adult(): takes the advisory lock of the household used by the other
--    «in coppia» rules (household_members_guard_update, household_members_after_delete,
--    household_members_couple_guard, accept_invitation_with_color) before checking the role
--    and adding the adult, so a household never stops being a couple in the middle of
--    one of those checks.
-- 4. public.has_consent_evidence_key(): tells the server (service_role only) whether the
--    secret «consent_evidence_hmac_key» of the Vault is usable, never its value. For the
--    monitoring of the agente infrastruttura.
--
-- Conventions: `set search_path = ''`, fully qualified names. account_deletions() and
-- run_scheduled_account_jobs() change their result, so they are dropped and created again;
-- their privileges are revoked here at once and checked again in the
-- account_jobs_robust_grants migration. run_account_job() and invite_adult() keep the same
-- signature and their grants.

-- ===========================================================================
-- 2. The deletions, one account at a time
-- ===========================================================================

-- Same rule as before (#513): every account whose delete_on is before the day of p_at
-- (Europe/Rome), at most 200 per run; its address goes to private.account_deletion_mails
-- (deleted_on = the day of p_at), then private.delete_account(). Now each account runs in
-- its own sub-block: when it fails, only its own writes are undone, it is counted in
-- `failed`, and the loop goes on with the next account. Owner only.
drop function if exists private.account_deletions(timestamptz);

create function private.account_deletions(
  p_at timestamptz,
  out deleted integer,
  out failed integer
)
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_today date := (p_at at time zone 'Europe/Rome')::date;
  v_user uuid;
begin
  deleted := 0;
  failed := 0;

  for v_user in
    select r.user_id
    from private.account_deletion_requests r
    where r.delete_on < v_today
    order by r.delete_on, r.user_id
    limit 200
    for update skip locked
  loop
    begin
      insert into private.account_deletion_mails (email, deleted_on)
      select u.email, v_today
      from auth.users u
      where u.id = v_user
        and coalesce(btrim(u.email), '') <> '';

      if private.delete_account(v_user, p_at) then
        deleted := deleted + 1;
      end if;
    exception
      when others then
        failed := failed + 1;
        raise warning 'account job deletions: one account not deleted (SQLSTATE %)', sqlstate;
    end;
  end loop;
end;
$$;

revoke execute on function private.account_deletions(timestamptz) from public, anon, authenticated, service_role;

-- ===========================================================================
-- 1. The RPC refuses an instant in the future
-- ===========================================================================

-- RPC (rule 13): runs one job of the account as if it ran at the instant p_at, which can be
-- now or in the past, never in the future (22023). Returns what the job returns: for
-- deletions, how many accounts it deleted (an account that fails is undone alone, with a
-- warning, and stays for the next run). service_role and the database owner only. Only
-- POST through the Data API. Security definer (owner: postgres): the jobs write in the auth
-- and private schemas. The caller should leave p_at out (default now()).
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

  if p_at > now() then
    raise exception 'the instant cannot be in the future' using errcode = '22023';
  end if;

  return case p_job
    when 'deletions' then (select d.deleted from private.account_deletions(p_at) d)
    when 'exports' then private.data_exports_cleanup(p_at)
    when 'mail_purge' then private.purge_account_deletion_mails(p_at)
    when 'evidence_purge' then private.purge_consent_evidence(p_at)
  end;
end;
$$;

-- ===========================================================================
-- 2. The hourly job, one step at a time
-- ===========================================================================

-- The pg_cron entry (every hour): the four jobs, in this order, each in its own sub-block,
-- so an error in one step undoes only that step and the others still run. Returns the
-- number of errors: the accounts not deleted plus the steps that failed (0 when all went
-- well). Owner only; the instant is the one of pg_cron (now()).
drop function if exists private.run_scheduled_account_jobs(timestamptz);

create function private.run_scheduled_account_jobs(p_at timestamptz default now())
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

  if v_errors > 0 then
    raise warning 'account jobs: % error(s)', v_errors;
  end if;

  return v_errors;
end;
$$;

revoke execute on function private.run_scheduled_account_jobs(timestamptz) from public, anon, authenticated, service_role;

-- ===========================================================================
-- 3. invite_adult() with the lock of the household
-- ===========================================================================

-- invite_adult() of #617 (R1), same signature, grants, checks and errors. New: the
-- household of the caller is locked with the advisory lock of the «in coppia» rules before
-- the role is checked and the adult is added (an adult without account makes a couple stop
-- being one). The role is read again after the lock, so a role taken away meanwhile counts.
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

  select m.household_id into v_household_id
  from public.household_members m
  where m.user_id = (select auth.uid());

  if not found then
    raise exception 'permission denied for function invite_adult' using errcode = '42501';
  end if;

  -- Same lock as household_members_guard_update, household_members_after_delete,
  -- household_members_couple_guard and accept_invitation_with_color.
  perform pg_advisory_xact_lock(hashtextextended(v_household_id::text, 0));

  select m.id into v_caller_member_id
  from public.household_members m
  where m.user_id = (select auth.uid())
    and m.household_id = v_household_id
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

-- ===========================================================================
-- 4. Is the key of the proof there?
-- ===========================================================================

-- True when the secret «consent_evidence_hmac_key» of the Vault is usable, that is when
-- private.consent_subject_hmac() (the one source of the rule: the newest secret with that
-- name, not empty) can compute a pseudonym. It computes one for a fixed address of the
-- reserved domain .invalid and answers only true or false: never the key, never the
-- pseudonym. Without the key the deletions still go on, but no proof is kept (#657): the
-- monitoring of the server calls this to notice it. service_role only (grants migration).
-- Security definer (owner: postgres): only the owner reads the Vault.
create or replace function public.has_consent_evidence_key()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.consent_subject_hmac('key-check@familynest.invalid') is not null;
$$;

revoke execute on function public.has_consent_evidence_key() from public, anon, authenticated, service_role;
