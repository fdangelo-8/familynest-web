-- Issue #86: privileges and RLS policies of events and event_members.
--
-- Two layers, as in the base schema:
-- 1. Privileges: the app writes only the content of an event (never id, author, times
--    of the row) and only adds or removes participants. anon has no privilege at all.
-- 2. RLS policies, `to authenticated` only. A member reads, changes and deletes directly
--    only the events of their household that they may see in full: «Tutto il Nest»
--    events, and events in which they are the author, the escort or a participant.
--    «Occupato» and «Solo io» events of the others are never readable from the tables:
--    the pages read the calendar with list_household_events(), which returns the
--    «Occupato» ones without any detail and never the «Solo io» ones.
-- Membership is checked with `household_id = (select public.current_household_id())`:
-- one account belongs to at most one household, the subquery runs once per statement.
-- The policies of the two tables never read each other's table: they use the security
-- definer helpers private.is_event_participant() and private.can_read_event().

-- ---------------------------------------------------------------------------
-- Privileges on the tables
-- ---------------------------------------------------------------------------

revoke all on table public.events from anon, authenticated;
grant select on table public.events to authenticated;
-- No id: the database generates it. No author: set by the before insert trigger.
grant insert (
  household_id, title, location, starts_at, ends_at, visibility, escort_member_id,
  recurrence, recurrence_weekdays, recurrence_until
) on table public.events to authenticated;
grant update (
  title, location, starts_at, ends_at, visibility, escort_member_id,
  recurrence, recurrence_weekdays, recurrence_until
) on table public.events to authenticated;
grant delete on table public.events to authenticated;

revoke all on table public.event_members from anon, authenticated;
grant select on table public.event_members to authenticated;
grant insert (event_id, member_id, household_id) on table public.event_members to authenticated;
-- No update: a participant is removed and added again.
grant delete on table public.event_members to authenticated;

-- ---------------------------------------------------------------------------
-- Privileges on functions
-- ---------------------------------------------------------------------------

-- Trigger and internal functions are never called directly.
revoke execute on function private.events_before_insert() from public, anon, authenticated;
revoke execute on function private.events_before_update() from public, anon, authenticated;
revoke execute on function private.household_members_delete_private_events() from public, anon, authenticated;
revoke execute on function private.event_occurrence_starts(
  timestamptz, public.event_recurrence, smallint[], date, timestamptz, timestamptz
) from public, anon, authenticated;

-- Used by the policies and the guard triggers, evaluated as the caller. The private
-- schema is not exposed by the Data API: the app cannot call them as RPC.
revoke execute on function private.events_normalize(public.events) from public, anon;
grant execute on function private.events_normalize(public.events) to authenticated;
revoke execute on function private.current_member_id() from public, anon;
revoke execute on function private.is_event_participant(uuid) from public, anon;
revoke execute on function private.can_read_event(uuid) from public, anon;
grant execute on function private.current_member_id() to authenticated;
grant execute on function private.is_event_participant(uuid) to authenticated;
grant execute on function private.can_read_event(uuid) to authenticated;

-- Reading the calendar: signed-in users only.
revoke execute on function public.list_household_events(timestamptz, timestamptz) from public, anon;
grant execute on function public.list_household_events(timestamptz, timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- events
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
      or private.is_event_participant(id)
    )
  );

-- New events always belong to the caller (the author is set by the before insert trigger).
drop policy if exists events_insert on public.events;
create policy events_insert on public.events
  for insert to authenticated
  with check (
    household_id = (select public.current_household_id())
    and author_member_id = (select private.current_member_id())
  );

-- Every adult who sees the event in full changes it (default of issue #19); only the
-- author changes the visibility (events_before_update trigger). The changed event must
-- still be visible in full to the caller.
drop policy if exists events_update on public.events;
create policy events_update on public.events
  for update to authenticated
  using (
    household_id = (select public.current_household_id())
    and (
      visibility = 'household'
      or author_member_id = (select private.current_member_id())
      or escort_member_id = (select private.current_member_id())
      or private.is_event_participant(id)
    )
  )
  with check (
    household_id = (select public.current_household_id())
    and (
      visibility = 'household'
      or author_member_id = (select private.current_member_id())
      or escort_member_id = (select private.current_member_id())
      or private.is_event_participant(id)
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
      or private.is_event_participant(id)
    )
  );

-- ---------------------------------------------------------------------------
-- event_members: visible and editable together with the event they belong to
-- ---------------------------------------------------------------------------

drop policy if exists event_members_select on public.event_members;
create policy event_members_select on public.event_members
  for select to authenticated
  using (
    household_id = (select public.current_household_id())
    and private.can_read_event(event_id)
  );

drop policy if exists event_members_insert on public.event_members;
create policy event_members_insert on public.event_members
  for insert to authenticated
  with check (
    household_id = (select public.current_household_id())
    and private.can_read_event(event_id)
  );

drop policy if exists event_members_delete on public.event_members;
create policy event_members_delete on public.event_members
  for delete to authenticated
  using (
    household_id = (select public.current_household_id())
    and private.can_read_event(event_id)
  );
