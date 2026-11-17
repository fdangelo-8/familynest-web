-- Issue #418: usage limit of the reading of shop links (wish list).
--
-- - public.claim_shop_link_read(): called by the app before it reads a shop link. Counts
--   the readings of the signed-in account; under the limits it records one more reading and
--   returns true, otherwise it records nothing and returns false (the app does not read
--   the link).
-- - private.purge_shop_link_reads(): run by the pg_cron job, deletes the readings older
--   than 24 hours.
--
-- The limits (decision of the coordinator), per account, are the constants at the top of
-- claim_shop_link_read() and nowhere else:
--   at most 20 readings in the last 10 minutes,
--   at most 100 readings in the last 24 hours.
-- The windows are sliding: a reading counts while it is younger than the window
-- (created_at after now() minus the window). The purge keeps 24 hours, the longest window:
-- were a window made longer, the purge must keep as long.
--
-- Concurrency (lesson: a limit checked with a count before the insert): the readings of
-- one account are serialised by a transaction advisory lock taken before counting, so two
-- requests close together cannot go over the limit.
--
-- Errors of claim_shop_link_read():
-- - P0001 'use POST': called through the Data API with a method other than POST
--   (lesson of #112: every method, not only GET, is refused before reading);
-- - 42501: no signed-in account.

-- ---------------------------------------------------------------------------
-- One more reading of a shop link by the signed-in account, if the limits allow it.
-- Security definer (owner: postgres, `set search_path = ''`): the API roles have no
-- privilege on private.shop_link_reads. Executable only by authenticated (grants migration).
-- ---------------------------------------------------------------------------
create or replace function public.claim_shop_link_read()
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  -- The limits of #418, per account.
  c_short_window constant interval := interval '10 minutes';
  c_short_max constant integer := 20;
  c_day_window constant interval := interval '24 hours';
  c_day_max constant integer := 100;

  v_user_id uuid;
  v_short_count integer;
  v_day_count integer;
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  v_user_id := (select auth.uid());
  if v_user_id is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('private.shop_link_reads:' || v_user_id::text, 0));

  select
    count(*) filter (where r.created_at > now() - c_short_window),
    count(*)
  into v_short_count, v_day_count
  from private.shop_link_reads r
  where r.user_id = v_user_id
    and r.created_at > now() - c_day_window;

  if v_short_count >= c_short_max or v_day_count >= c_day_max then
    return false;
  end if;

  insert into private.shop_link_reads (user_id)
  values (v_user_id);

  return true;
end;
$$;

-- The default privileges of the public schema would let every API role execute it until
-- the grants migration: revoked at once.
revoke execute on function public.claim_shop_link_read()
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Deletes the readings older than 24 hours at p_now (the longest window of the limits).
-- Security invoker: it runs as the role that calls it, postgres for pg_cron (owner of the
-- table). The API roles cannot execute it (grants migration). Returns how many readings
-- it deleted.
-- ---------------------------------------------------------------------------
create or replace function private.purge_shop_link_reads(p_now timestamptz)
returns integer
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  if p_now is null then
    raise exception 'the reference time is required' using errcode = '22004';
  end if;

  delete from private.shop_link_reads r
  where r.created_at <= p_now - interval '24 hours';

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke execute on function private.purge_shop_link_reads(timestamptz)
  from public, anon, authenticated, service_role;
