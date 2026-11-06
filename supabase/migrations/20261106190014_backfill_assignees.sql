-- Issue #337 (spec 333 §6.5): the people already chosen become rows of the new tables.
-- Every todos.assignee_member_id and deadlines.assignee_member_id that is not null becomes
-- one row of todo_assignees / deadline_assignees, linked at the time the thing was
-- created. Nothing is lost: the compatibility column keeps the same value (the only
-- person is the first one), so the sync trigger does not touch the things.
-- Idempotent (on conflict do nothing): rows already written by the compatibility trigger,
-- for things created or changed after the triggers migration, stay as they are.
-- Run as the owner without a session: the guards check the kind of the person and «Solo
-- io» (always true for the data on main: the same rules were already enforced on the
-- column), and nobody is notified (no person who acted).
-- The shopping list had no people: nothing to move.

insert into public.todo_assignees (todo_id, member_id, household_id, created_at)
select t.id, t.assignee_member_id, t.household_id, t.created_at
from public.todos t
where t.assignee_member_id is not null
order by t.created_at, t.id
on conflict do nothing;

insert into public.deadline_assignees (deadline_id, member_id, household_id, created_at)
select d.id, d.assignee_member_id, d.household_id, d.created_at
from public.deadlines d
where d.assignee_member_id is not null
order by d.created_at, d.id
on conflict do nothing;
