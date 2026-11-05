-- Issue #295 (CA-21 of #34): switching «Solo giorni feriali» off on a calendar did not
-- bring back the events of Saturday and Sunday discarded before.
--
-- Cause: sync_external_calendar_events (20261105121818) does not import the events (and
-- the days of an event «tutto il giorno») starting on Saturday or Sunday while
-- weekdays_only is true, but the position at the provider (sync_cursor) still moves on.
-- When weekdays_only goes back to false, the next synchronisation asks the provider only
-- for the changes since that position: the weekend events, unchanged at the provider,
-- never arrive again. external_calendars_before_write (last version 20261105180925)
-- cleared sync_cursor only when the calendar was switched off.
--
-- Fields of external_calendars that decide which incoming events are kept (#270):
-- - is_enabled:    switched off, nothing is imported (the position was already cleared);
-- - weekdays_only: the only filter of a calendar switched on, cleared here.
-- The other fields do not discard incoming events: visibility is applied in place to the
-- events already imported (external_calendars_after_write), counts_for_free_time and
-- is_new_events_target are not read by the synchronisation, and direction only drops the
-- links of the copies sent with «Anche su» (re-reading everything after it would import
-- those copies as new events next to the events of FamilyNest).
--
-- Fix: the position at the provider is also cleared when weekdays_only changes (both ways:
-- after false -> true a complete reading is harmless, it imports nothing of the weekend and
-- deletes what is no longer there). The next synchronisation reads the whole window
-- (p_full) and the events discarded before come back.
--
-- Unchanged: every other rule of the trigger (name, read only, «Dove vanno i nuovi
-- impegni» without calling the private schema (#277), fields that never change, at most 50
-- calendars per account), security invoker, empty search_path, owner and privileges
-- (execute revoked from public, anon, authenticated in 20261105121824). No privilege is
-- added; the trigger still calls nothing in the schema private (#276, #287).
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

    -- Switched off, or a different filter of the incoming events (#295): the next
    -- synchronisation reads everything again.
    if (old.is_enabled and not new.is_enabled)
       or new.weekdays_only is distinct from old.weekdays_only then
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
