-- Issue #337: privileges and RLS policies of the people who take care of a thing, of the
-- new write functions, and the changes of the shopping list for #335.
--
-- Two layers, as everywhere:
-- 1. Privileges: the app reads the link rows, adds them (thing, member, household; never
--    the time) and removes them; it never changes one (a link is added or removed).
--    anon has no privilege at all.
-- 2. RLS policies, `to authenticated` only: whoever sees the thing sees its people and
--    changes them (every member who sees a thing to do, a deadline or a thing to buy may
--    change it). The thing is checked with its own RLS (the subquery on todos, deadlines
--    or shopping_items runs with the policies of the caller), so «Solo io» of someone
--    else and other households give 0 rows. The policies of todos, deadlines and
--    shopping_items never read the link tables: no policy calls another one back.
--
-- Shopping list (#335, spec 333 §6.11 and §6.13): the app may now change the name and
-- the quantity, and delete also the things still to buy, always only in its household.
-- A direct delete keeps no copy (the strappo goes on using clear_checked_shopping_items()
-- for «Annulla»). As for every delete of shopping_items, Realtime sends a DELETE event
-- carrying only the id (shopping_items_realtime migration): the pages ignore unknown ids.
-- The link tables are not in the Realtime publication: their changes reach the pages as
-- an UPDATE of the item (shopping_item_assignees_touch_item), filtered by RLS.
--
-- Compatibility (spec 333 §6.6, issue #337 point 5): todos.assignee_member_id and
-- deadlines.assignee_member_id keep their insert and update privileges for now, because
-- the pages on main (and their tests) still write them; the database turns every such
-- write into the link tables (todos_sync_assignees, deadlines_sync_assignees). They are
-- removed, privileges included, by a later migration once the pages use the functions
-- of the assignees_write_functions migration.

-- ---------------------------------------------------------------------------
-- Privileges on the link tables
-- ---------------------------------------------------------------------------
revoke all on table public.todo_assignees from anon, authenticated;
grant select on table public.todo_assignees to authenticated;
grant insert (todo_id, member_id, household_id) on table public.todo_assignees to authenticated;
grant delete on table public.todo_assignees to authenticated;

revoke all on table public.deadline_assignees from anon, authenticated;
grant select on table public.deadline_assignees to authenticated;
grant insert (deadline_id, member_id, household_id) on table public.deadline_assignees to authenticated;
grant delete on table public.deadline_assignees to authenticated;

revoke all on table public.shopping_item_assignees from anon, authenticated;
grant select on table public.shopping_item_assignees to authenticated;
grant insert (shopping_item_id, member_id, household_id) on table public.shopping_item_assignees to authenticated;
grant delete on table public.shopping_item_assignees to authenticated;

-- ---------------------------------------------------------------------------
-- Shopping list: name and quantity can be changed (checked_at already could)
-- ---------------------------------------------------------------------------
grant update (name, quantity) on table public.shopping_items to authenticated;

-- ---------------------------------------------------------------------------
-- Privileges on functions
-- ---------------------------------------------------------------------------

-- Trigger and internal functions are never called directly.
revoke execute on function private.todo_first_assignee(uuid) from public, anon, authenticated;
revoke execute on function private.deadline_first_assignee(uuid) from public, anon, authenticated;
revoke execute on function private.todo_assignees_before_insert() from public, anon, authenticated;
revoke execute on function private.deadline_assignees_before_insert() from public, anon, authenticated;
revoke execute on function private.shopping_item_assignees_before_insert() from public, anon, authenticated;
revoke execute on function private.todo_assignees_sync_todo() from public, anon, authenticated;
revoke execute on function private.deadline_assignees_sync_deadline() from public, anon, authenticated;
revoke execute on function private.shopping_item_assignees_touch_item() from public, anon, authenticated;
revoke execute on function private.todos_sync_assignees() from public, anon, authenticated;
revoke execute on function private.deadlines_sync_assignees() from public, anon, authenticated;
revoke execute on function private.todo_assignees_notify() from public, anon, authenticated;

-- Operations for signed-in users only.
revoke execute on function public.create_todo(text, uuid[], uuid, date, boolean) from public, anon;
grant execute on function public.create_todo(text, uuid[], uuid, date, boolean) to authenticated;
revoke execute on function public.update_todo(uuid, text, uuid[], uuid, date, boolean) from public, anon;
grant execute on function public.update_todo(uuid, text, uuid[], uuid, date, boolean) to authenticated;
revoke execute on function public.create_deadline(text, date, uuid[], text, uuid, boolean, smallint[]) from public, anon;
grant execute on function public.create_deadline(text, date, uuid[], text, uuid, boolean, smallint[]) to authenticated;
revoke execute on function public.update_deadline(uuid, text, date, uuid[], text, uuid, boolean, smallint[]) from public, anon;
grant execute on function public.update_deadline(uuid, text, date, uuid[], text, uuid, boolean, smallint[]) to authenticated;
revoke execute on function public.add_shopping_items(jsonb, uuid[]) from public, anon;
grant execute on function public.add_shopping_items(jsonb, uuid[]) to authenticated;
revoke execute on function public.update_shopping_item(uuid, text, text, uuid[]) from public, anon;
grant execute on function public.update_shopping_item(uuid, text, text, uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Policies of the link tables
-- ---------------------------------------------------------------------------

drop policy if exists todo_assignees_select on public.todo_assignees;
create policy todo_assignees_select on public.todo_assignees
  for select to authenticated
  using (
    household_id = (select public.current_household_id())
    and exists (select 1 from public.todos t where t.id = todo_assignees.todo_id)
  );

drop policy if exists todo_assignees_insert on public.todo_assignees;
create policy todo_assignees_insert on public.todo_assignees
  for insert to authenticated
  with check (
    household_id = (select public.current_household_id())
    and exists (select 1 from public.todos t where t.id = todo_assignees.todo_id)
  );

drop policy if exists todo_assignees_delete on public.todo_assignees;
create policy todo_assignees_delete on public.todo_assignees
  for delete to authenticated
  using (
    household_id = (select public.current_household_id())
    and exists (select 1 from public.todos t where t.id = todo_assignees.todo_id)
  );

drop policy if exists deadline_assignees_select on public.deadline_assignees;
create policy deadline_assignees_select on public.deadline_assignees
  for select to authenticated
  using (
    household_id = (select public.current_household_id())
    and exists (select 1 from public.deadlines d where d.id = deadline_assignees.deadline_id)
  );

drop policy if exists deadline_assignees_insert on public.deadline_assignees;
create policy deadline_assignees_insert on public.deadline_assignees
  for insert to authenticated
  with check (
    household_id = (select public.current_household_id())
    and exists (select 1 from public.deadlines d where d.id = deadline_assignees.deadline_id)
  );

drop policy if exists deadline_assignees_delete on public.deadline_assignees;
create policy deadline_assignees_delete on public.deadline_assignees
  for delete to authenticated
  using (
    household_id = (select public.current_household_id())
    and exists (select 1 from public.deadlines d where d.id = deadline_assignees.deadline_id)
  );

-- The shopping list has no «Solo io»: the household is enough; the item is checked too,
-- for symmetry and so that a link is never readable without its item.
drop policy if exists shopping_item_assignees_select on public.shopping_item_assignees;
create policy shopping_item_assignees_select on public.shopping_item_assignees
  for select to authenticated
  using (
    household_id = (select public.current_household_id())
    and exists (select 1 from public.shopping_items i where i.id = shopping_item_assignees.shopping_item_id)
  );

drop policy if exists shopping_item_assignees_insert on public.shopping_item_assignees;
create policy shopping_item_assignees_insert on public.shopping_item_assignees
  for insert to authenticated
  with check (
    household_id = (select public.current_household_id())
    and exists (select 1 from public.shopping_items i where i.id = shopping_item_assignees.shopping_item_id)
  );

drop policy if exists shopping_item_assignees_delete on public.shopping_item_assignees;
create policy shopping_item_assignees_delete on public.shopping_item_assignees
  for delete to authenticated
  using (
    household_id = (select public.current_household_id())
    and exists (select 1 from public.shopping_items i where i.id = shopping_item_assignees.shopping_item_id)
  );

-- ---------------------------------------------------------------------------
-- Shopping list: every thing of the household can be deleted, taken or still to buy
-- (#335 «Elimina dalla spesa»).
-- ---------------------------------------------------------------------------
drop policy if exists shopping_items_delete on public.shopping_items;
create policy shopping_items_delete on public.shopping_items
  for delete to authenticated
  using (household_id = (select public.current_household_id()));
