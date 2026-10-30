-- Issue #109: privileges and RLS policies of events.notes and event_exceptions, execute
-- grants of the new functions.
--
-- Same two layers as the events of #86:
-- 1. Privileges: the app writes the notes of an event and the values of an exception,
--    never the event, household, day or creation time of an exception after creating it.
--    anon has no privilege at all.
-- 2. RLS policies, `to authenticated` only: the exceptions of an event are read, created,
--    changed and deleted by the members of its household who see the event in full
--    (private.can_read_event: «Tutto il Nest», or author, escort, participant), the same
--    people who may change and delete the event itself. Who sees an occurrence of an
--    «Occupato» of the others learns only its times, through list_household_events().
-- The policies never read events or event_members directly (security definer helper).

-- ---------------------------------------------------------------------------
-- events.notes (adds to the column grants of #86)
-- ---------------------------------------------------------------------------
grant insert (notes) on table public.events to authenticated;
grant update (notes) on table public.events to authenticated;

-- ---------------------------------------------------------------------------
-- event_exceptions
-- ---------------------------------------------------------------------------
revoke all on table public.event_exceptions from anon, authenticated;
grant select on table public.event_exceptions to authenticated;
grant insert (
  event_id, household_id, occurrence_date, is_cancelled, title, location, notes,
  starts_at, ends_at, escort_member_id
) on table public.event_exceptions to authenticated;
grant update (
  is_cancelled, title, location, notes, starts_at, ends_at, escort_member_id
) on table public.event_exceptions to authenticated;
grant delete on table public.event_exceptions to authenticated;

drop policy if exists event_exceptions_select on public.event_exceptions;
create policy event_exceptions_select on public.event_exceptions
  for select to authenticated
  using (
    household_id = (select public.current_household_id())
    and private.can_read_event(event_id)
  );

drop policy if exists event_exceptions_insert on public.event_exceptions;
create policy event_exceptions_insert on public.event_exceptions
  for insert to authenticated
  with check (
    household_id = (select public.current_household_id())
    and private.can_read_event(event_id)
  );

drop policy if exists event_exceptions_update on public.event_exceptions;
create policy event_exceptions_update on public.event_exceptions
  for update to authenticated
  using (
    household_id = (select public.current_household_id())
    and private.can_read_event(event_id)
  )
  with check (
    household_id = (select public.current_household_id())
    and private.can_read_event(event_id)
  );

drop policy if exists event_exceptions_delete on public.event_exceptions;
create policy event_exceptions_delete on public.event_exceptions
  for delete to authenticated
  using (
    household_id = (select public.current_household_id())
    and private.can_read_event(event_id)
  );

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

-- Trigger functions are never called directly.
revoke execute on function private.event_exceptions_before_insert() from public, anon, authenticated;
revoke execute on function private.event_exceptions_before_update() from public, anon, authenticated;
revoke execute on function private.events_after_update_visibility() from public, anon, authenticated;

-- Helpers evaluated as the caller by the guard triggers and the security invoker
-- functions below. The private schema is not exposed by the Data API: the app cannot
-- call them as RPC. event_occurrence_starts() was internal in #86: it is now also used
-- by the security invoker functions (pure computation, it reads no table).
revoke execute on function private.event_occurrence_starts(
  timestamptz, public.event_recurrence, smallint[], date, timestamptz, timestamptz
) from public, anon;
grant execute on function private.event_occurrence_starts(
  timestamptz, public.event_recurrence, smallint[], date, timestamptz, timestamptz
) to authenticated;
revoke execute on function private.event_has_occurrence_on(
  timestamptz, public.event_recurrence, smallint[], date, date
) from public, anon;
grant execute on function private.event_has_occurrence_on(
  timestamptz, public.event_recurrence, smallint[], date, date
) to authenticated;
revoke execute on function private.event_occurrences(
  uuid, timestamptz, timestamptz, public.event_recurrence, smallint[], date, timestamptz, timestamptz
) from public, anon;
grant execute on function private.event_occurrences(
  uuid, timestamptz, timestamptz, public.event_recurrence, smallint[], date, timestamptz, timestamptz
) to authenticated;
revoke execute on function private.event_exceptions_normalize(public.event_exceptions, uuid, timestamptz) from public, anon;
grant execute on function private.event_exceptions_normalize(public.event_exceptions, uuid, timestamptz) to authenticated;
revoke execute on function private.event_has_remaining_occurrence(uuid) from public, anon;
grant execute on function private.event_has_remaining_occurrence(uuid) to authenticated;
-- Called by public.update_event() as the caller; checks by itself that the caller sees
-- the event in full.
revoke execute on function private.split_event_series(uuid, date) from public, anon;
grant execute on function private.split_event_series(uuid, date) to authenticated;

-- RPC: signed-in users only.
revoke execute on function public.get_event_occurrence(uuid, date) from public, anon;
grant execute on function public.get_event_occurrence(uuid, date) to authenticated;
revoke execute on function public.create_event(
  text, timestamptz, timestamptz, public.event_visibility, uuid[], text, uuid,
  public.event_recurrence, smallint[], date, text
) from public, anon;
grant execute on function public.create_event(
  text, timestamptz, timestamptz, public.event_visibility, uuid[], text, uuid,
  public.event_recurrence, smallint[], date, text
) to authenticated;
revoke execute on function public.update_event(
  uuid, date, text, timestamptz, timestamptz, public.event_visibility, uuid[], text, uuid,
  public.event_recurrence, smallint[], date, text
) from public, anon;
grant execute on function public.update_event(
  uuid, date, text, timestamptz, timestamptz, public.event_visibility, uuid[], text, uuid,
  public.event_recurrence, smallint[], date, text
) to authenticated;
revoke execute on function public.update_event_occurrence(
  uuid, date, text, timestamptz, timestamptz, text, uuid, text
) from public, anon;
grant execute on function public.update_event_occurrence(
  uuid, date, text, timestamptz, timestamptz, text, uuid, text
) to authenticated;
revoke execute on function public.delete_event_occurrence(uuid, date, public.event_change_scope) from public, anon;
grant execute on function public.delete_event_occurrence(uuid, date, public.event_change_scope) to authenticated;
-- list_household_events() keeps the grants of #86 (create or replace keeps them).
