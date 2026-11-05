-- Issue #277: the administrative key (service_role) could not write into
-- external_calendars at all: every insert or update got 42501 «permission denied for
-- schema private», whatever the value of is_new_events_target (same defect as #275).
--
-- Cause: external_calendars_before_write (20261105121817) is security invoker and tested
--   new.is_new_events_target and not private.external_calendar_is_target_eligible(new)
-- in one expression. PL/pgSQL prepares the whole expression before evaluating it, so the
-- name private.external_calendar_is_target_eligible is resolved with the privileges of
-- the caller even when the first part is false; service_role has no usage on the schema
-- private (only authenticated has it, 20261022201344).
--
-- Fix: unlike the guard of #275, this rule is not a check of the Data API roles that the
-- trusted roles may skip: it must hold for every role. The security definer functions
-- (owner postgres, for example save_external_calendars when a calendar becomes read only
-- at the provider) rely on it to clear «Dove vanno i nuovi impegni»; without it the check
-- external_calendars_target_eligible would refuse their writes (23514). So the trigger no
-- longer calls the schema private: the role is not checked, and the condition of
-- private.external_calendar_is_target_eligible() is written here, in its own statement
-- after the test of is_new_events_target. The helper stays (used by the security definer
-- trigger external_calendars_after_write); the test external_calendars_before_write.test
-- checks that the two conditions give the same answer for every combination.
--
-- Unchanged: every other rule of the trigger (name, read only, fields that never change,
-- position at the provider, at most 50 calendars per account), security invoker, empty
-- search_path, owner and privileges (execute revoked from public, anon, authenticated in
-- 20261105121824). No privilege is added to service_role.
create or replace function private.external_calendars_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  -- Maximum number of calendars of an account (#34 §7): the only place of this number in
  -- the database.
  c_max_calendars constant integer := 50;
  v_count integer;
begin
  new.name := btrim(regexp_replace(new.name, '\s+', ' ', 'g'));

  if new.is_read_only and (tg_op = 'INSERT' or not old.is_read_only) then
    new.direction := 'incoming';
  end if;

  -- «Dove vanno i nuovi impegni» only on a calendar switched on, «Entrata e uscita» and
  -- writable: the same condition as the helper external_calendar_is_target_eligible() and
  -- the check external_calendars_target_eligible, without calling the private schema, which
  -- the administrative key cannot use (#277).
  if new.is_new_events_target then
    if not coalesce(new.is_enabled and new.direction = 'two_way' and not new.is_read_only, false) then
      new.is_new_events_target := false;
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if new.household_id is distinct from old.household_id
       or new.member_id is distinct from old.member_id
       or new.account_id is distinct from old.account_id
       or new.provider_calendar_id is distinct from old.provider_calendar_id then
      raise exception 'this calendar field cannot be changed' using errcode = '42501';
    end if;

    if old.is_enabled and not new.is_enabled then
      new.sync_cursor := null;
    end if;
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('public.external_calendars:' || new.account_id::text, 0));

  if exists (
    select 1
    from public.external_calendars c
    where c.account_id = new.account_id
      and c.provider_calendar_id = new.provider_calendar_id
  ) then
    return new;
  end if;

  select count(*) into v_count
  from public.external_calendars c
  where c.account_id = new.account_id;

  if v_count >= c_max_calendars then
    raise exception 'external calendar limit reached' using errcode = 'FN009';
  end if;

  return new;
end;
$$;
