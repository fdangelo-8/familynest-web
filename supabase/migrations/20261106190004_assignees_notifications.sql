-- Issue #337 (spec 333 §6.7 and §6.8): notifications and reminders go to every person who
-- takes care of a thing.
--
-- 1. «Da fare assegnato»: the trigger moves from todos (one assignee) to todo_assignees
--    (one row per person). One todo_assigned to every person ADDED to a thing, when it is
--    an adult with an account other than the person who acted, the thing is not «Solo io»
--    and «Da fare assegnati a me» is on. Nobody already among the people is notified
--    again, nobody removed is notified. The pages on main still write
--    todos.assignee_member_id: the compatibility trigger turns that write into a row of
--    todo_assignees, so they notify exactly as before (one new person, once). The shopping
--    list notifies nobody (#335, domanda 4). Same conventions as #229: security definer,
--    the person who acted is always the member of the verified session; a change made
--    without a session (seed, backfill, foreign key actions, jobs, the administrative key)
--    notifies nobody.
-- 2. «Scadenza vicina» (job of 9:00): the reminder goes to every person of the deadline
--    who is an adult with an account; when there is none (nobody, only children, only
--    adults without account), the rule of before: only the author for «Solo io»,
--    everybody with an account for «Tutto il Nest».
-- Execute grants: assignees_policies_and_grants migration.

-- ---------------------------------------------------------------------------
-- 1. «Da fare assegnato»
-- ---------------------------------------------------------------------------
drop trigger if exists todos_notify_assignee on public.todos;
drop function if exists private.todos_notify_assignee();

create or replace function private.todo_assignees_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_private boolean;
  v_actor uuid;
begin
  select t.is_private into v_is_private
  from public.todos t
  where t.id = new.todo_id;
  if not found or v_is_private then
    return null;
  end if;

  v_actor := private.notification_actor(new.household_id);
  if v_actor is null or v_actor = new.member_id then
    return null;
  end if;

  if private.notification_recipient_wants(new.member_id, 'assigned_todos') then
    insert into public.notifications (household_id, recipient_member_id, kind, actor_member_id, todo_id)
    values (new.household_id, new.member_id, 'todo_assigned', v_actor, new.todo_id);
  end if;

  return null;
end;
$$;

create trigger todo_assignees_notify
  after insert on public.todo_assignees
  for each row execute function private.todo_assignees_notify();

-- ---------------------------------------------------------------------------
-- 2. Job of 9:00 «Scadenza vicina» (same arguments, result and idempotency as #229;
-- `create or replace` keeps the owner and the privileges).
-- ---------------------------------------------------------------------------
create or replace function private.notifications_deadline_reminders(p_at timestamptz, p_household_id uuid)
returns integer
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_today date := (p_at at time zone 'Europe/Rome')::date;
  v_created integer;
begin
  insert into public.notifications (household_id, recipient_member_id, kind, deadline_id, days_before, created_at)
  select d.household_id, m.id, 'deadline_reminder', d.id, (d.due_date - v_today)::smallint, p_at
  from public.deadlines d
  join public.household_members m
    on m.household_id = d.household_id
   and m.kind = 'adult'
   and m.user_id is not null
  where (p_household_id is null or d.household_id = p_household_id)
    and d.due_date in (v_today, v_today + 1, v_today + 7, v_today + 30)
    and (d.due_date - v_today) = any (d.reminder_days)
    and case
      when exists (
        select 1
        from public.deadline_assignees da
        join public.household_members a on a.id = da.member_id
        where da.deadline_id = d.id
          and a.kind = 'adult'
          and a.user_id is not null
      ) then exists (
        select 1
        from public.deadline_assignees da
        where da.deadline_id = d.id
          and da.member_id = m.id
      )
      when d.is_private then m.id = d.created_by_member_id
      else true
    end
  order by d.household_id, d.id, m.id
  on conflict do nothing;

  get diagnostics v_created = row_count;
  return v_created;
end;
$$;
