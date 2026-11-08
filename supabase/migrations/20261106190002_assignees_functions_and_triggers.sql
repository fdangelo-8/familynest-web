-- Issue #337: triggers of the people who take care of a thing («Chi se ne occupa», several
-- people) and the compatibility column of todos and deadlines.
--
-- Conventions (same as todos, deadlines and events):
-- - every function has `set search_path = ''` and fully qualified names;
-- - helpers and trigger functions live in the "private" schema (not exposed by the Data
--   API, not in the generated types);
-- - guard triggers are `security invoker`: `current_user` is the role that runs the
--   statement. The Data API roles (authenticated, anon) get the household check; the
--   kind of the member and «Solo io» are checked for every role (seed, administrative
--   key, security definer functions included);
-- - lesson of #276/#287: a security invoker trigger tests the role in a statement of its
--   own before calling anything in "private"; the guards below call nothing in "private"
--   at all (only tables of public and public.current_household_id(), for the API roles),
--   so the administrative key (service_role, no usage on "private") is never blocked;
-- - `security definer` only where the function must write rows the caller does not write
--   itself (the compatibility column, the touch of the shopping item).
-- Execute grants are set in the assignees_policies_and_grants migration.
--
-- Compatibility column (spec 333 §6.6), todos.assignee_member_id and
-- deadlines.assignee_member_id, until every page reads the new tables:
-- - the database keeps it equal to the first person of the thing (earliest link, at equal
--   time the order of the members of the household), or null without people;
-- - the pages already on main still write it (insert and update of the column, also from
--   the tests and fixtures). Such a write is translated into the new table: on insert the
--   person becomes the only one; on update the new person stays (or is added) and every
--   other is removed, as with one single person; null removes everybody. The writes of the
--   database itself are never translated back: the sync below is recognised by the
--   trigger depth, the foreign key action of a member who leaves (`on delete set null`,
--   whose triggers run at the end of the outer statement) by the member that no longer
--   exists;
-- - a later migration removes the column and this translation, once the pages of spec 333
--   §6 read the new tables.

-- ===========================================================================
-- Helpers: the first person of a thing. Members that no longer exist are skipped (while
-- a household is deleted, its members go before their links).
-- ===========================================================================
create or replace function private.todo_first_assignee(p_todo_id uuid)
returns uuid
language sql
stable
set search_path = ''
as $$
  select a.member_id
  from public.todo_assignees a
  join public.household_members m on m.id = a.member_id and m.household_id = a.household_id
  where a.todo_id = p_todo_id
  order by a.created_at, m.created_at, m.id
  limit 1;
$$;

create or replace function private.deadline_first_assignee(p_deadline_id uuid)
returns uuid
language sql
stable
set search_path = ''
as $$
  select a.member_id
  from public.deadline_assignees a
  join public.household_members m on m.id = a.member_id and m.household_id = a.household_id
  where a.deadline_id = p_deadline_id
  order by a.created_at, m.created_at, m.id
  limit 1;
$$;

-- ===========================================================================
-- Guards of the link tables (before insert, security invoker)
-- ===========================================================================

-- todo_assignees:
-- - API roles: only in the household of the caller (42501, before anything is read, so
--   nothing about another household leaks), time of the link = now();
-- - the thing must be visible to the caller (API roles: RLS of todos; 42501 otherwise);
-- - every role: the person is an adult or a child of the household, never a pet (23514;
--   the same error whether a member of another household exists or not);
-- - every role: a «Solo io» thing has only its author (23514).
create or replace function private.todo_assignees_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_is_api boolean := current_user in ('authenticated', 'anon');
  v_household_id uuid;
  v_is_private boolean;
  v_author uuid;
begin
  if v_is_api then
    v_household_id := (select public.current_household_id());
    if v_household_id is null or new.household_id is distinct from v_household_id then
      raise exception 'new row violates row-level security policy for table "todo_assignees"'
        using errcode = '42501';
    end if;
    new.created_at := now();
  end if;

  -- Row lock on the thing (concurrency of «Solo io»): without it, an insert could read
  -- the thing as shared while the author, in another transaction, makes it «Solo io»;
  -- the check of todos_sync_assignees would not see this link (not yet committed) and
  -- the foreign key only takes FOR KEY SHARE, so another person would stay on a «Solo
  -- io» thing. With the lock:
  -- - a change of the thing (update_todo locks it FOR UPDATE, a direct UPDATE takes FOR
  --   NO KEY UPDATE) waits for this transaction, and its check then sees this link;
  -- - this insert waits for a change already under way and, in read committed, reads the
  --   new version of the row (RLS included): «Solo io» of someone else gives 42501 (no
  --   longer visible) or 23514 below.
  -- FOR NO KEY UPDATE rather than FOR SHARE: same effect on the change of visibility, but
  -- two transactions adding the first person at the same time are queued instead of
  -- ending in a deadlock (both holding FOR SHARE, then both updating the compatibility
  -- column in todo_assignees_sync_todo). It does not block the foreign keys (FOR KEY
  -- SHARE) nor any plain read. The API roles have the UPDATE privilege on columns of
  -- todos and the update policy has the same condition as the select policy, so the lock
  -- finds exactly the rows the caller sees. A single-session pgTAP test cannot reproduce
  -- the concurrency: this comment is the record of the rule.
  select t.is_private, t.created_by_member_id into v_is_private, v_author
  from public.todos t
  where t.id = new.todo_id
    and t.household_id = new.household_id
  for no key update;
  if not found then
    if v_is_api then
      raise exception 'new row violates row-level security policy for table "todo_assignees"'
        using errcode = '42501';
    end if;
    -- Trusted roles: the foreign key refuses it.
    return new;
  end if;

  if not exists (
    select 1
    from public.household_members m
    where m.id = new.member_id
      and m.household_id = new.household_id
      and m.kind in ('adult', 'child')
  ) then
    raise exception 'the assignee must be an adult or a child of the household' using errcode = '23514';
  end if;

  if v_is_private and new.member_id is distinct from v_author then
    raise exception 'only the author takes care of a «Solo io» thing' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger todo_assignees_before_insert
  before insert on public.todo_assignees
  for each row execute function private.todo_assignees_before_insert();

-- deadline_assignees: same rules as todo_assignees.
create or replace function private.deadline_assignees_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_is_api boolean := current_user in ('authenticated', 'anon');
  v_household_id uuid;
  v_is_private boolean;
  v_author uuid;
begin
  if v_is_api then
    v_household_id := (select public.current_household_id());
    if v_household_id is null or new.household_id is distinct from v_household_id then
      raise exception 'new row violates row-level security policy for table "deadline_assignees"'
        using errcode = '42501';
    end if;
    new.created_at := now();
  end if;

  -- Row lock on the deadline, for the same reason as todo_assignees_before_insert (a
  -- deadline made «Solo io» while another person is added): the change waits for this
  -- insert and sees it, or this insert waits for the change and reads the new row.
  -- FOR NO KEY UPDATE to queue two first additions instead of a deadlock in
  -- deadline_assignees_sync_deadline.
  select d.is_private, d.created_by_member_id into v_is_private, v_author
  from public.deadlines d
  where d.id = new.deadline_id
    and d.household_id = new.household_id
  for no key update;
  if not found then
    if v_is_api then
      raise exception 'new row violates row-level security policy for table "deadline_assignees"'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if not exists (
    select 1
    from public.household_members m
    where m.id = new.member_id
      and m.household_id = new.household_id
      and m.kind in ('adult', 'child')
  ) then
    raise exception 'the assignee must be an adult or a child of the household' using errcode = '23514';
  end if;

  if v_is_private and new.member_id is distinct from v_author then
    raise exception 'only the author takes care of a «Solo io» deadline' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger deadline_assignees_before_insert
  before insert on public.deadline_assignees
  for each row execute function private.deadline_assignees_before_insert();

-- shopping_item_assignees: same rules, without «Solo io» (the shopping list is always of
-- the whole household).
create or replace function private.shopping_item_assignees_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_is_api boolean := current_user in ('authenticated', 'anon');
  v_household_id uuid;
begin
  if v_is_api then
    v_household_id := (select public.current_household_id());
    if v_household_id is null or new.household_id is distinct from v_household_id then
      raise exception 'new row violates row-level security policy for table "shopping_item_assignees"'
        using errcode = '42501';
    end if;
    new.created_at := now();
  end if;

  if not exists (
    select 1
    from public.shopping_items i
    where i.id = new.shopping_item_id
      and i.household_id = new.household_id
  ) then
    if v_is_api then
      raise exception 'new row violates row-level security policy for table "shopping_item_assignees"'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if not exists (
    select 1
    from public.household_members m
    where m.id = new.member_id
      and m.household_id = new.household_id
      and m.kind in ('adult', 'child')
  ) then
    raise exception 'the assignee must be an adult or a child of the household' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger shopping_item_assignees_before_insert
  before insert on public.shopping_item_assignees
  for each row execute function private.shopping_item_assignees_before_insert();

-- ===========================================================================
-- Link tables → thing (after insert or delete, security definer)
-- ===========================================================================

-- The compatibility column follows the first person. Written only when it changes, so
-- adding a second person, or the backfill of the existing data, does not touch the thing.
-- Security definer: the link may be removed by a foreign key action (a member who
-- leaves) or by an API role that may change the thing anyway (RLS of the link tables).
create or replace function private.todo_assignees_sync_todo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_todo_id uuid;
  v_first uuid;
begin
  if tg_op = 'DELETE' then
    v_todo_id := old.todo_id;
  else
    v_todo_id := new.todo_id;
  end if;

  v_first := private.todo_first_assignee(v_todo_id);

  update public.todos t
  set assignee_member_id = v_first
  where t.id = v_todo_id
    and t.assignee_member_id is distinct from v_first;

  return null;
end;
$$;

create trigger todo_assignees_sync_todo
  after insert or delete on public.todo_assignees
  for each row execute function private.todo_assignees_sync_todo();

create or replace function private.deadline_assignees_sync_deadline()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deadline_id uuid;
  v_first uuid;
begin
  if tg_op = 'DELETE' then
    v_deadline_id := old.deadline_id;
  else
    v_deadline_id := new.deadline_id;
  end if;

  v_first := private.deadline_first_assignee(v_deadline_id);

  update public.deadlines d
  set assignee_member_id = v_first
  where d.id = v_deadline_id
    and d.assignee_member_id is distinct from v_first;

  return null;
end;
$$;

create trigger deadline_assignees_sync_deadline
  after insert or delete on public.deadline_assignees
  for each row execute function private.deadline_assignees_sync_deadline();

-- The shopping list has no compatibility column, but its pages follow the changes with
-- Realtime on shopping_items only (UPDATE events filtered by RLS). A change of the people
-- touches the item (updated_at), so the other members see it within seconds (#335 CA-17)
-- and no event of the link table ever reaches another household. Nothing happens when
-- the item itself is being deleted (no row to touch).
create or replace function private.shopping_item_assignees_touch_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item_id uuid;
begin
  if tg_op = 'DELETE' then
    v_item_id := old.shopping_item_id;
  else
    v_item_id := new.shopping_item_id;
  end if;

  update public.shopping_items i
  set updated_at = now()
  where i.id = v_item_id;

  return null;
end;
$$;

create trigger shopping_item_assignees_touch_item
  after insert or delete on public.shopping_item_assignees
  for each row execute function private.shopping_item_assignees_touch_item();

-- ===========================================================================
-- Thing → link tables (after insert or update, security definer)
-- ===========================================================================

-- todos:
-- - a write of the compatibility column by a statement of the app, the tests, the
--   fixtures or the seed is translated into todo_assignees (see the header). The writes
--   made by the database (the sync above, depth > 1; the foreign key action of a member
--   who leaves) are already consistent and are not translated;
-- - «Solo io» keeps only its author among the people, also when the thing becomes
--   «Solo io» (23514), checked after the translation, so that «Solo io» and «nobody» in
--   one statement (as the pages on main do) is accepted; also for the writes of the
--   database itself.
-- Security definer: it writes the links on behalf of the database (the change of the
-- thing itself already passed RLS and the guards of todos).
create or replace function private.todos_sync_assignees()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.assignee_member_id is not null then
      insert into public.todo_assignees (todo_id, member_id, household_id)
      values (new.id, new.assignee_member_id, new.household_id)
      on conflict do nothing;
    end if;
    return null;
  end if;

  if pg_trigger_depth() > 1 then
    -- A write of the database itself: no translation, but «Solo io» is checked anyway
    -- (protection against a future trigger that changes is_private).
    if new.is_private and exists (
      select 1
      from public.todo_assignees a
      where a.todo_id = new.id
        and a.member_id is distinct from new.created_by_member_id
    ) then
      raise exception 'only the author takes care of a «Solo io» thing' using errcode = '23514';
    end if;
    return null;
  end if;

  -- The foreign key action of a member who leaves (`on delete set null`) is not a write
  -- of a page: its triggers run at the end of the outer statement (depth 1), when the
  -- member no longer exists. Its links go with it and todo_assignees_sync_todo moves the
  -- column to the next person.
  if new.assignee_member_id is distinct from old.assignee_member_id
     and new.assignee_member_id is distinct from private.todo_first_assignee(new.id)
     and not (
       new.assignee_member_id is null
       and not exists (select 1 from public.household_members m where m.id = old.assignee_member_id)
     ) then
    delete from public.todo_assignees a
    where a.todo_id = new.id
      and a.member_id is distinct from new.assignee_member_id;
    if new.assignee_member_id is not null then
      insert into public.todo_assignees (todo_id, member_id, household_id)
      values (new.id, new.assignee_member_id, new.household_id)
      on conflict do nothing;
    end if;
  end if;

  if new.is_private and exists (
    select 1
    from public.todo_assignees a
    where a.todo_id = new.id
      and a.member_id is distinct from new.created_by_member_id
  ) then
    raise exception 'only the author takes care of a «Solo io» thing' using errcode = '23514';
  end if;

  return null;
end;
$$;

create trigger todos_sync_assignees
  after insert or update of assignee_member_id, is_private on public.todos
  for each row execute function private.todos_sync_assignees();

-- deadlines: same rules as todos.
create or replace function private.deadlines_sync_assignees()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.assignee_member_id is not null then
      insert into public.deadline_assignees (deadline_id, member_id, household_id)
      values (new.id, new.assignee_member_id, new.household_id)
      on conflict do nothing;
    end if;
    return null;
  end if;

  if pg_trigger_depth() > 1 then
    -- A write of the database itself: «Solo io» checked anyway, see todos_sync_assignees.
    if new.is_private and exists (
      select 1
      from public.deadline_assignees a
      where a.deadline_id = new.id
        and a.member_id is distinct from new.created_by_member_id
    ) then
      raise exception 'only the author takes care of a «Solo io» deadline' using errcode = '23514';
    end if;
    return null;
  end if;

  -- Foreign key action of a member who leaves: see todos_sync_assignees.
  if new.assignee_member_id is distinct from old.assignee_member_id
     and new.assignee_member_id is distinct from private.deadline_first_assignee(new.id)
     and not (
       new.assignee_member_id is null
       and not exists (select 1 from public.household_members m where m.id = old.assignee_member_id)
     ) then
    delete from public.deadline_assignees a
    where a.deadline_id = new.id
      and a.member_id is distinct from new.assignee_member_id;
    if new.assignee_member_id is not null then
      insert into public.deadline_assignees (deadline_id, member_id, household_id)
      values (new.id, new.assignee_member_id, new.household_id)
      on conflict do nothing;
    end if;
  end if;

  if new.is_private and exists (
    select 1
    from public.deadline_assignees a
    where a.deadline_id = new.id
      and a.member_id is distinct from new.created_by_member_id
  ) then
    raise exception 'only the author takes care of a «Solo io» deadline' using errcode = '23514';
  end if;

  return null;
end;
$$;

create trigger deadlines_sync_assignees
  after insert or update of assignee_member_id, is_private on public.deadlines
  for each row execute function private.deadlines_sync_assignees();
