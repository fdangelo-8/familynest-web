-- Issue #510 (DB-1 «Impegni 2.0»): privileges and RLS policies of the new columns of the
-- events and of event_viewers, execute grants of the new and replaced functions.
--
-- Same two layers as the events of #86 and #109:
-- 1. Privileges: the app writes the new values of an event and of one occurrence, and adds
--    or removes chosen people; never ids, authors or times of the rows. anon has no
--    privilege at all on anything new.
-- 2. RLS policies, `to authenticated` only. Who sees an event in full now also includes
--    the person who picks up («Lo riprende») and, for «Solo alcune persone», the chosen
--    people: they read, change and delete it from the tables like the escort and the
--    participants. Everybody else in the household reads it only through the calendar
--    functions, as «Occupato». Only the author chooses the people (insert and delete of
--    event_viewers); nobody updates them.
-- Membership is checked with `household_id = (select public.current_household_id())`; the
-- other tables are read only through security definer helpers, so the policies never
-- call each other.

-- ---------------------------------------------------------------------------
-- Column privileges (add to those of #86 and #109)
-- ---------------------------------------------------------------------------
grant insert (
  all_day, pickup_member_id, escort_undecided, pickup_undecided, reminder_minutes_before,
  remind_rides, unverified_fields
) on table public.events to authenticated;
-- unverified_fields: only shorter (events_before_update).
grant update (
  all_day, pickup_member_id, escort_undecided, pickup_undecided, reminder_minutes_before,
  remind_rides, unverified_fields
) on table public.events to authenticated;

grant insert (pickup_member_id, escort_undecided, pickup_undecided) on table public.event_exceptions to authenticated;
grant update (pickup_member_id, escort_undecided, pickup_undecided) on table public.event_exceptions to authenticated;

revoke all on table public.event_viewers from anon, authenticated;
grant select on table public.event_viewers to authenticated;
grant insert (event_id, member_id, household_id) on table public.event_viewers to authenticated;
-- No update: a person is removed and added again.
grant delete on table public.event_viewers to authenticated;

-- ---------------------------------------------------------------------------
-- events: who sees an event in full (select, update, delete). Insert unchanged.
-- ---------------------------------------------------------------------------
drop policy if exists events_select on public.events;
create policy events_select on public.events
  for select to authenticated
  using (
    household_id = (select public.current_household_id())
    and (
      visibility = 'household'
      or author_member_id = (select private.current_member_id())
      or escort_member_id = (select private.current_member_id())
      or pickup_member_id = (select private.current_member_id())
      or private.is_event_participant(id)
      or (visibility = 'selected' and private.is_event_viewer(id))
    )
  );

drop policy if exists events_update on public.events;
create policy events_update on public.events
  for update to authenticated
  using (
    household_id = (select public.current_household_id())
    and (
      visibility = 'household'
      or author_member_id = (select private.current_member_id())
      or escort_member_id = (select private.current_member_id())
      or pickup_member_id = (select private.current_member_id())
      or private.is_event_participant(id)
      or (visibility = 'selected' and private.is_event_viewer(id))
    )
  )
  with check (
    household_id = (select public.current_household_id())
    and (
      visibility = 'household'
      or author_member_id = (select private.current_member_id())
      or escort_member_id = (select private.current_member_id())
      or pickup_member_id = (select private.current_member_id())
      or private.is_event_participant(id)
      or (visibility = 'selected' and private.is_event_viewer(id))
    )
  );

drop policy if exists events_delete on public.events;
create policy events_delete on public.events
  for delete to authenticated
  using (
    household_id = (select public.current_household_id())
    and (
      visibility = 'household'
      or author_member_id = (select private.current_member_id())
      or escort_member_id = (select private.current_member_id())
      or pickup_member_id = (select private.current_member_id())
      or private.is_event_participant(id)
      or (visibility = 'selected' and private.is_event_viewer(id))
    )
  );

-- ---------------------------------------------------------------------------
-- event_viewers: visible to everybody who sees the event in full; only the author adds
-- and removes people.
-- ---------------------------------------------------------------------------
drop policy if exists event_viewers_select on public.event_viewers;
create policy event_viewers_select on public.event_viewers
  for select to authenticated
  using (
    household_id = (select public.current_household_id())
    and private.can_read_event(event_id)
  );

drop policy if exists event_viewers_insert on public.event_viewers;
create policy event_viewers_insert on public.event_viewers
  for insert to authenticated
  with check (
    household_id = (select public.current_household_id())
    and private.is_event_author(event_id)
  );

drop policy if exists event_viewers_delete on public.event_viewers;
create policy event_viewers_delete on public.event_viewers
  for delete to authenticated
  using (
    household_id = (select public.current_household_id())
    and private.is_event_author(event_id)
  );

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

-- Trigger functions are never called directly.
revoke execute on function private.event_viewers_before_insert() from public, anon, authenticated;

-- Used by the policies, evaluated as the caller. The private schema is not exposed by the
-- Data API: the app cannot call them as RPC.
revoke execute on function private.is_event_viewer(uuid) from public, anon;
grant execute on function private.is_event_viewer(uuid) to authenticated;
revoke execute on function private.is_event_author(uuid) from public, anon;
grant execute on function private.is_event_author(uuid) to authenticated;

-- Helpers evaluated as the caller by the guard triggers and the security invoker
-- functions (dropped and created again: same privileges as before).
revoke execute on function private.event_occurrences(
  uuid, timestamptz, timestamptz, public.event_recurrence, smallint[], date, timestamptz, timestamptz, boolean
) from public, anon;
grant execute on function private.event_occurrences(
  uuid, timestamptz, timestamptz, public.event_recurrence, smallint[], date, timestamptz, timestamptz, boolean
) to authenticated;
revoke execute on function private.event_exceptions_normalize(public.event_exceptions, uuid, uuid, timestamptz)
  from public, anon;
grant execute on function private.event_exceptions_normalize(public.event_exceptions, uuid, uuid, timestamptz)
  to authenticated;

-- Owner only (read by the security definer functions and the jobs).
revoke execute on function private.household_event_rows_for_member(uuid, timestamptz, timestamptz)
  from public, anon, authenticated;
revoke execute on function private.event_row_people(boolean, uuid, uuid[], uuid, uuid)
  from public, anon, authenticated;

-- RPC: signed-in users only, never anon.
revoke execute on function public.get_event_occurrence(uuid, date) from public, anon;
grant execute on function public.get_event_occurrence(uuid, date) to authenticated;

revoke execute on function public.create_event(
  text, timestamptz, timestamptz, public.event_visibility, uuid[], text, uuid,
  public.event_recurrence, smallint[], date, text,
  boolean, uuid, boolean, boolean, integer, boolean, public.event_field[], uuid[]
) from public, anon;
grant execute on function public.create_event(
  text, timestamptz, timestamptz, public.event_visibility, uuid[], text, uuid,
  public.event_recurrence, smallint[], date, text,
  boolean, uuid, boolean, boolean, integer, boolean, public.event_field[], uuid[]
) to authenticated;

revoke execute on function public.update_event(
  uuid, date, text, timestamptz, timestamptz, public.event_visibility, uuid[], text, uuid,
  public.event_recurrence, smallint[], date, text,
  boolean, uuid, boolean, boolean, integer, boolean, uuid[]
) from public, anon;
grant execute on function public.update_event(
  uuid, date, text, timestamptz, timestamptz, public.event_visibility, uuid[], text, uuid,
  public.event_recurrence, smallint[], date, text,
  boolean, uuid, boolean, boolean, integer, boolean, uuid[]
) to authenticated;

revoke execute on function public.update_event_occurrence(
  uuid, date, text, timestamptz, timestamptz, text, uuid, text, uuid, boolean, boolean
) from public, anon;
grant execute on function public.update_event_occurrence(
  uuid, date, text, timestamptz, timestamptz, text, uuid, text, uuid, boolean, boolean
) to authenticated;

revoke execute on function public.confirm_event_fields(uuid, public.event_field[]) from public, anon;
grant execute on function public.confirm_event_fields(uuid, public.event_field[]) to authenticated;

revoke execute on function public.list_calendar_events(timestamptz, timestamptz) from public, anon;
grant execute on function public.list_calendar_events(timestamptz, timestamptz) to authenticated;

revoke execute on function public.find_event_conflicts(timestamptz, timestamptz, uuid[], uuid, uuid, uuid)
  from public, anon;
grant execute on function public.find_event_conflicts(timestamptz, timestamptz, uuid[], uuid, uuid, uuid)
  to authenticated;

revoke execute on function public.list_event_overlaps(timestamptz, timestamptz) from public, anon;
grant execute on function public.list_event_overlaps(timestamptz, timestamptz) to authenticated;
