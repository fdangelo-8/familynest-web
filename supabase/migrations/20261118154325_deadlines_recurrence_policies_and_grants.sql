-- Issue #481 (part A of #460): privileges of the repetition and of «Fatta», and the policies
-- of the deadlines written with the single rule private.deadline_open_to_member().
--
-- The policies keep the same meaning as #108: a deadline is visible, changeable and
-- deletable by the members of its household when it is «Tutto il Nest», only by its author
-- when it is «Solo io». The household is still compared inline with
-- `household_id = (select public.current_household_id())`, so that the index on
-- (household_id, due_date, created_at) keeps serving the reads; the member of the caller is
-- read once per statement and passed to the rule.
-- The insert policy is unchanged (a new deadline is always written by its author).

-- ---------------------------------------------------------------------------
-- Privileges on the new columns: the edit sheet writes the repetition like the other
-- fields of the content.
-- ---------------------------------------------------------------------------
grant insert (recurrence, recurrence_interval_days) on table public.deadlines to authenticated;
grant update (recurrence, recurrence_interval_days) on table public.deadlines to authenticated;

-- ---------------------------------------------------------------------------
-- Privileges on functions
-- ---------------------------------------------------------------------------

-- Used by the policies, evaluated as the caller. The private schema is not exposed by the
-- Data API: the app cannot call it as RPC.
revoke execute on function private.deadline_open_to_member(boolean, uuid, uuid) from public, anon;
grant execute on function private.deadline_open_to_member(boolean, uuid, uuid) to authenticated;

-- Used only by complete_deadline (security definer, runs as the owner).
revoke execute on function private.deadline_next_due_date(public.deadline_recurrence, smallint, date)
  from public, anon, authenticated, service_role;

-- Operations for signed-in users only.
revoke execute on function public.complete_deadline(uuid, date) from public, anon;
grant execute on function public.complete_deadline(uuid, date) to authenticated;
revoke execute on function public.undo_complete_deadline(uuid, date) from public, anon;
grant execute on function public.undo_complete_deadline(uuid, date) to authenticated;
revoke execute on function public.create_deadline(
  text, date, uuid[], text, uuid, boolean, smallint[], public.deadline_recurrence, smallint
) from public, anon;
grant execute on function public.create_deadline(
  text, date, uuid[], text, uuid, boolean, smallint[], public.deadline_recurrence, smallint
) to authenticated;
revoke execute on function public.update_deadline(
  uuid, text, date, uuid[], text, uuid, boolean, smallint[], public.deadline_recurrence, smallint
) from public, anon;
grant execute on function public.update_deadline(
  uuid, text, date, uuid[], text, uuid, boolean, smallint[], public.deadline_recurrence, smallint
) to authenticated;

-- ---------------------------------------------------------------------------
-- Policies (same meaning as #108, one source for «Solo io»)
-- ---------------------------------------------------------------------------

drop policy if exists deadlines_select on public.deadlines;
create policy deadlines_select on public.deadlines
  for select to authenticated
  using (
    household_id = (select public.current_household_id())
    and private.deadline_open_to_member(is_private, created_by_member_id, (select private.current_member_id()))
  );

-- The changed deadline must still be visible to the caller.
drop policy if exists deadlines_update on public.deadlines;
create policy deadlines_update on public.deadlines
  for update to authenticated
  using (
    household_id = (select public.current_household_id())
    and private.deadline_open_to_member(is_private, created_by_member_id, (select private.current_member_id()))
  )
  with check (
    household_id = (select public.current_household_id())
    and private.deadline_open_to_member(is_private, created_by_member_id, (select private.current_member_id()))
  );

drop policy if exists deadlines_delete on public.deadlines;
create policy deadlines_delete on public.deadlines
  for delete to authenticated
  using (
    household_id = (select public.current_household_id())
    and private.deadline_open_to_member(is_private, created_by_member_id, (select private.current_member_id()))
  );
