-- Issue #337 (spec 333 §6.4): a thing and its people are written in one transaction
-- (LEZIONI: no half-saved thing when the second write fails).
--
-- - create_todo / update_todo: a thing to do with its people (also «Annulla» after
--   «Salva»: the app sends the values read when the sheet opened);
-- - create_deadline / update_deadline: a deadline with its people;
-- - add_shopping_items: several things to buy, all with the same people, skipping the
--   ones already to buy (23505, as the page does today) and returning the ids saved, in
--   the order of the phrase (for «Annulla», undo_added_shopping_items() unchanged: the
--   people go with the items, on delete cascade);
-- - update_shopping_item: name, quantity and people of a thing of the shopping list (#335).
--
-- p_assignee_member_ids: the complete list of the people (empty = nobody). Duplicates
-- count once. Ids, authors, households and times are written by the database, never by
-- the app. The update functions keep the people who stay (their time of link, so the
-- first person does not change and nobody is notified again), remove the others and add
-- the new ones; only the people added get «Da fare assegnato» (todo_assignees_notify).
--
-- Security invoker for the todos, the deadlines and update_shopping_item: every rule of
-- the tables applies as for a direct write (RLS, guard triggers, constraints): a thing of
-- another household or a «Solo io» of someone else is never found; only the author changes
-- «Solo io»; the people are adults or children of the household; «Solo io» has only the
-- author. They call nothing in "private" (lesson of #276/#287).
-- Security definer for add_shopping_items only: the ids of the new items are drawn by the
-- database in increasing order, so that the items added together (same created_at) keep
-- the order of the phrase in the list (order by created_at, id), and the app has no
-- privilege on id. The rules of the insert policy are applied explicitly (household and
-- member of the verified session); the guard triggers still apply (normalisation,
-- duplicates, kind of the people).
-- Only POST through the Data API (lesson of #112). Execute grants are set in the
-- assignees_policies_and_grants migration.
--
-- Errors:
-- - P0001 'use POST': called through the Data API with a method other than POST;
-- - 42501: no signed-in user or no household (add_shopping_items); changing «Solo io» of
--   a thing of someone else (trigger); a write the RLS refuses;
-- - 22023: invalid people (null list, a null id, more than 20) or invalid items;
-- - P0002: the thing to change does not exist or is not visible to the caller (same
--   error in every case: nothing about another household leaks);
-- - 23514: a person who is not an adult or a child of the household, someone else on a
--   «Solo io», or a value refused by the constraints of the table.

-- ---------------------------------------------------------------------------
-- Things to do
-- ---------------------------------------------------------------------------
create or replace function public.create_todo(
  p_title text,
  p_assignee_member_ids uuid[] default '{}',
  p_for_member_id uuid default null,
  p_due_date date default null,
  p_is_private boolean default false
)
returns uuid
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;
  if p_assignee_member_ids is null
     or array_position(p_assignee_member_ids, null) is not null
     or cardinality(p_assignee_member_ids) > 20 then
    raise exception 'invalid assignees' using errcode = '22023';
  end if;

  insert into public.todos (title, for_member_id, due_date, is_private)
  values (p_title, p_for_member_id, p_due_date, coalesce(p_is_private, false))
  returning id into v_id;

  insert into public.todo_assignees (todo_id, member_id)
  select distinct v_id, a.member_id
  from unnest(p_assignee_member_ids) as a (member_id);

  return v_id;
end;
$$;

create or replace function public.update_todo(
  p_todo_id uuid,
  p_title text,
  p_assignee_member_ids uuid[],
  p_for_member_id uuid,
  p_due_date date,
  p_is_private boolean
)
returns void
language plpgsql
volatile
set search_path = ''
as $$
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;
  if p_assignee_member_ids is null
     or array_position(p_assignee_member_ids, null) is not null
     or cardinality(p_assignee_member_ids) > 20 then
    raise exception 'invalid assignees' using errcode = '22023';
  end if;

  -- RLS: only a thing the caller sees (and may therefore change).
  perform 1 from public.todos t where t.id = p_todo_id for update;
  if not found then
    raise exception 'todo not found' using errcode = 'P0002';
  end if;

  -- Removed first, so that a thing becoming «Solo io» has only its author when it changes.
  delete from public.todo_assignees a
  where a.todo_id = p_todo_id
    and a.member_id <> all (p_assignee_member_ids);

  update public.todos t
  set title = p_title,
      for_member_id = p_for_member_id,
      due_date = p_due_date,
      is_private = coalesce(p_is_private, false)
  where t.id = p_todo_id;

  insert into public.todo_assignees (todo_id, member_id)
  select distinct p_todo_id, a.member_id
  from unnest(p_assignee_member_ids) as a (member_id)
  where not exists (
    select 1
    from public.todo_assignees x
    where x.todo_id = p_todo_id
      and x.member_id = a.member_id
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Deadlines
-- ---------------------------------------------------------------------------
create or replace function public.create_deadline(
  p_title text,
  p_due_date date,
  p_assignee_member_ids uuid[] default '{}',
  p_note text default null,
  p_for_member_id uuid default null,
  p_is_private boolean default false,
  p_reminder_days smallint[] default '{30,7,1}'
)
returns uuid
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;
  if p_assignee_member_ids is null
     or array_position(p_assignee_member_ids, null) is not null
     or cardinality(p_assignee_member_ids) > 20 then
    raise exception 'invalid assignees' using errcode = '22023';
  end if;

  insert into public.deadlines (title, due_date, note, for_member_id, is_private, reminder_days)
  values (p_title, p_due_date, p_note, p_for_member_id, coalesce(p_is_private, false), p_reminder_days)
  returning id into v_id;

  insert into public.deadline_assignees (deadline_id, member_id)
  select distinct v_id, a.member_id
  from unnest(p_assignee_member_ids) as a (member_id);

  return v_id;
end;
$$;

create or replace function public.update_deadline(
  p_deadline_id uuid,
  p_title text,
  p_due_date date,
  p_assignee_member_ids uuid[],
  p_note text,
  p_for_member_id uuid,
  p_is_private boolean,
  p_reminder_days smallint[]
)
returns void
language plpgsql
volatile
set search_path = ''
as $$
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;
  if p_assignee_member_ids is null
     or array_position(p_assignee_member_ids, null) is not null
     or cardinality(p_assignee_member_ids) > 20 then
    raise exception 'invalid assignees' using errcode = '22023';
  end if;

  perform 1 from public.deadlines d where d.id = p_deadline_id for update;
  if not found then
    raise exception 'deadline not found' using errcode = 'P0002';
  end if;

  delete from public.deadline_assignees a
  where a.deadline_id = p_deadline_id
    and a.member_id <> all (p_assignee_member_ids);

  update public.deadlines d
  set title = p_title,
      due_date = p_due_date,
      note = p_note,
      for_member_id = p_for_member_id,
      is_private = coalesce(p_is_private, false),
      reminder_days = p_reminder_days
  where d.id = p_deadline_id;

  insert into public.deadline_assignees (deadline_id, member_id)
  select distinct p_deadline_id, a.member_id
  from unnest(p_assignee_member_ids) as a (member_id)
  where not exists (
    select 1
    from public.deadline_assignees x
    where x.deadline_id = p_deadline_id
      and x.member_id = a.member_id
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Shopping list
-- ---------------------------------------------------------------------------

-- p_items: a JSON array of 1 to 50 objects {"name": text, "quantity": text or null}, in
-- the order of the phrase. Returns the ids of the items saved, in that order; an item
-- already to buy (or twice in the same list) is skipped. An invalid person refuses the
-- whole call, even when every item is skipped.
create or replace function public.add_shopping_items(
  p_items jsonb,
  p_assignee_member_ids uuid[] default '{}'
)
returns setof uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_member_id uuid;
  v_household_id uuid;
  v_count integer;
  v_ids uuid[];
  v_item record;
  v_constraint text;
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  if (select auth.uid()) is not null then
    select m.id, m.household_id into v_member_id, v_household_id
    from public.household_members m
    where m.user_id = (select auth.uid());
  end if;
  if v_member_id is null then
    raise exception 'permission denied for function add_shopping_items' using errcode = '42501';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'invalid items' using errcode = '22023';
  end if;
  v_count := jsonb_array_length(p_items);
  if v_count = 0 or v_count > 50 or exists (
    select 1
    from jsonb_array_elements(p_items) as e (value)
    where jsonb_typeof(e.value) <> 'object'
       or jsonb_typeof(e.value -> 'name') is distinct from 'string'
       or coalesce(jsonb_typeof(e.value -> 'quantity'), 'null') not in ('string', 'null')
  ) then
    raise exception 'invalid items' using errcode = '22023';
  end if;

  if p_assignee_member_ids is null
     or array_position(p_assignee_member_ids, null) is not null
     or cardinality(p_assignee_member_ids) > 20 then
    raise exception 'invalid assignees' using errcode = '22023';
  end if;
  if exists (
    select 1
    from unnest(p_assignee_member_ids) as a (member_id)
    where not exists (
      select 1
      from public.household_members m
      where m.id = a.member_id
        and m.household_id = v_household_id
        and m.kind in ('adult', 'child')
    )
  ) then
    raise exception 'the assignee must be an adult or a child of the household' using errcode = '23514';
  end if;

  -- Random ids, given in increasing order to the items of the phrase.
  v_ids := array(select gen_random_uuid() as id from generate_series(1, v_count) order by 1);

  for v_item in
    select e.value, e.position
    from jsonb_array_elements(p_items) with ordinality as e (value, position)
    order by e.position
  loop
    begin
      insert into public.shopping_items (id, household_id, name, quantity, added_by_member_id)
      values (
        v_ids[v_item.position], v_household_id, v_item.value ->> 'name', v_item.value ->> 'quantity', v_member_id
      );

      insert into public.shopping_item_assignees (shopping_item_id, member_id, household_id)
      select distinct v_ids[v_item.position], a.member_id, v_household_id
      from unnest(p_assignee_member_ids) as a (member_id);

      return next v_ids[v_item.position];
    exception
      when unique_violation then
        get stacked diagnostics v_constraint = constraint_name;
        if v_constraint is distinct from 'shopping_items_to_buy_name_unique' then
          raise;
        end if;
    end;
  end loop;
end;
$$;

-- Name, quantity and people of a thing of the shopping list (#335). Every adult with an
-- account of the household changes every thing (no «Solo io» in the shopping list). The
-- name follows the rules of the table: normalised, at most 80 characters, no other thing
-- to buy with the same name (23505 shopping_items_to_buy_name_unique).
create or replace function public.update_shopping_item(
  p_item_id uuid,
  p_name text,
  p_quantity text,
  p_assignee_member_ids uuid[]
)
returns void
language plpgsql
volatile
set search_path = ''
as $$
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;
  if p_assignee_member_ids is null
     or array_position(p_assignee_member_ids, null) is not null
     or cardinality(p_assignee_member_ids) > 20 then
    raise exception 'invalid assignees' using errcode = '22023';
  end if;

  perform 1 from public.shopping_items i where i.id = p_item_id for update;
  if not found then
    raise exception 'shopping item not found' using errcode = 'P0002';
  end if;

  update public.shopping_items i
  set name = p_name,
      quantity = p_quantity
  where i.id = p_item_id;

  delete from public.shopping_item_assignees a
  where a.shopping_item_id = p_item_id
    and a.member_id <> all (p_assignee_member_ids);

  insert into public.shopping_item_assignees (shopping_item_id, member_id)
  select distinct p_item_id, a.member_id
  from unnest(p_assignee_member_ids) as a (member_id)
  where not exists (
    select 1
    from public.shopping_item_assignees x
    where x.shopping_item_id = p_item_id
      and x.member_id = a.member_id
  );
end;
$$;
