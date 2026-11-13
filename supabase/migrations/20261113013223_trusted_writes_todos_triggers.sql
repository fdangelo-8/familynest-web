-- Issue #362: the administrative key (service_role) could not write a thing to do with a
-- person who takes care of it: the insert, or the update that sets a new assignee, got
-- 42501 «permission denied for schema private» (same defect as #288, fixed by
-- 20261112221030 for events, deadlines and event_exceptions).
--
-- Cause: the before insert and before update triggers of todos (security invoker) call
-- private.todos_check_assignee() for every role. PL/pgSQL resolves that name with the
-- privileges of the caller; service_role has no usage on the schema private.
--
-- Fix, the same schema as #288, one single source for each rule:
-- - the guard triggers todos_before_insert and todos_before_update check the role first,
--   in a statement of its own (lesson of #275), and return at once for the trusted roles.
--   For the Data API roles (authenticated, anon) nothing changes: same checks, same order,
--   private.todos_check_assignee() evaluated as the caller (RLS included, so a refused
--   write never reveals anything about the members of another household);
-- - a new trigger, todos_before_write_trusted, fires only for the other roles (condition
--   WHEN on current_user, evaluated as the role that runs the statement) and applies what
--   the guards applied to them before: the normalised title (insert: always; update: when
--   it changes) and private.todos_check_assignee() for a new assignee, with the same
--   arguments and conditions. It is security definer (owner postgres), so that it may use
--   the schema private: it receives only the row being written, reads no input of the
--   caller and runs only for roles that already bypass RLS (service_role, the database
--   owner, foreign key actions, the seed);
-- - the name makes the new trigger fire right after the guard of the same statement and
--   before todos_set_updated_at (alphabetical order), as the code it replaces.
--
-- Unchanged: todos_check_assignee and its privileges, every check constraint and every other
-- trigger. No usage on the schema private is given to service_role.

create or replace function private.todos_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_household_id uuid;
begin
  -- Trusted roles: normalised and checked by todos_before_write_trusted (#362).
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  -- Checked first, so that a refused insert into another household never reveals
  -- anything about its members.
  v_household_id := (select public.current_household_id());
  if v_household_id is null or new.household_id is distinct from v_household_id then
    raise exception 'new row violates row-level security policy for table "todos"'
      using errcode = '42501';
  end if;

  -- The author is always the caller; the app never chooses it.
  new.created_by_member_id := (select private.current_member_id());
  new.created_at := now();
  new.updated_at := now();

  new.title := btrim(regexp_replace(new.title, '\s+', ' ', 'g'));
  if new.assignee_member_id is not null then
    perform private.todos_check_assignee(new.household_id, new.assignee_member_id);
  end if;
  return new;
end;
$$;

-- Household, author and creation time never change; only the author changes «Solo io»;
-- done_at and «fatto da» as described in 20261029204344.
create or replace function private.todos_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_member_id uuid;
begin
  -- Trusted roles: normalised and checked by todos_before_write_trusted (#362).
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.household_id is distinct from old.household_id
     or new.created_by_member_id is distinct from old.created_by_member_id
     or new.created_at is distinct from old.created_at then
    raise exception 'this field of a thing to do cannot be changed' using errcode = '42501';
  end if;

  v_member_id := (select private.current_member_id());

  if new.is_private is distinct from old.is_private
     and (old.created_by_member_id is null or old.created_by_member_id is distinct from v_member_id) then
    raise exception 'only the author can change who sees a thing to do' using errcode = '42501';
  end if;

  if old.done_at is null and new.done_at is not null then
    if not (new.done_at between now() - interval '30 days' and now() + interval '5 minutes') then
      raise exception 'done_at must be between 30 days ago and 5 minutes from now'
        using errcode = '23514';
    end if;
    new.done_by_member_id := v_member_id;
  elsif new.done_at is null then
    new.done_by_member_id := null;
  else
    new.done_at := old.done_at;
    new.done_by_member_id := old.done_by_member_id;
  end if;

  if new.title is distinct from old.title then
    new.title := btrim(regexp_replace(new.title, '\s+', ' ', 'g'));
  end if;
  if new.assignee_member_id is not null
     and new.assignee_member_id is distinct from old.assignee_member_id then
    perform private.todos_check_assignee(new.household_id, new.assignee_member_id);
  end if;
  return new;
end;
$$;

-- Trusted roles only (see the trigger): title normalised and kind of a new assignee checked,
-- with the same conditions the guards above applied to these roles before #362.
create or replace function private.todos_before_write_trusted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.title := btrim(regexp_replace(new.title, '\s+', ' ', 'g'));
    if new.assignee_member_id is not null then
      perform private.todos_check_assignee(new.household_id, new.assignee_member_id);
    end if;
  else
    if new.title is distinct from old.title then
      new.title := btrim(regexp_replace(new.title, '\s+', ' ', 'g'));
    end if;
    if new.assignee_member_id is not null
       and new.assignee_member_id is distinct from old.assignee_member_id then
      perform private.todos_check_assignee(new.household_id, new.assignee_member_id);
    end if;
  end if;
  return new;
end;
$$;

create trigger todos_before_write_trusted
  before insert or update on public.todos
  for each row
  when (current_user not in ('authenticated', 'anon'))
  execute function private.todos_before_write_trusted();
