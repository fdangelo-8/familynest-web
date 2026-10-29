-- Issue #87: functions and triggers of the things to do ("Da fare").
--
-- Conventions (same as the base schema and the events):
-- - every function has `set search_path = ''` and fully qualified names;
-- - helpers and trigger functions live in the "private" schema (not exposed by the
--   Data API, not in the generated types);
-- - guard triggers are `security invoker`: `current_user` is then the role that runs
--   the statement. The Data API roles (authenticated, anon) get the checks, while
--   statements run by security definer functions (owner: postgres), foreign key
--   actions, pg_cron jobs and the seed are trusted;
-- - `security definer` only where the function must touch rows the caller cannot see.
-- Execute grants are set in the todos_policies_and_grants migration.
-- The member of the caller comes from private.current_member_id() (events migration).

-- ---------------------------------------------------------------------------
-- Used by insert and update: whoever takes care of a thing is an adult or a child of
-- its household (never a pet). The composite foreign keys already guarantee the
-- household of every member reference; this adds the kind.
-- Called only when the assignee is set or changed: the foreign key actions that run
-- while a member leaves (`on delete set null` of the other columns) must never be
-- refused because of an assignee that is being removed in the same statement.
-- Evaluated as the caller: an API role sees the members of its own household, and the
-- error is the same whether a member of another household exists or not.
-- ---------------------------------------------------------------------------
create or replace function private.todos_check_assignee(p_household_id uuid, p_member_id uuid)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.household_members m
    where m.id = p_member_id
      and m.household_id = p_household_id
      and m.kind in ('adult', 'child')
  ) then
    raise exception 'the assignee must be an adult or a child of the household' using errcode = '23514';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Before insert: household and author of the caller, server timestamps.
-- A new thing is always to do: done_at has no insert privilege and the insert policy
-- requires it to be null.
-- ---------------------------------------------------------------------------
create or replace function private.todos_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_household_id uuid;
begin
  if current_user in ('authenticated', 'anon') then
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
  end if;

  new.title := btrim(regexp_replace(new.title, '\s+', ' ', 'g'));
  if new.assignee_member_id is not null then
    perform private.todos_check_assignee(new.household_id, new.assignee_member_id);
  end if;
  return new;
end;
$$;

create trigger todos_before_insert
  before insert on public.todos
  for each row execute function private.todos_before_insert();

-- ---------------------------------------------------------------------------
-- Before update (API roles):
-- - household, author and creation time never change;
-- - only the author changes «Solo io» (a thing without author can never become «Solo io»);
-- - done_at from null to a value ("Segna come fatto"): the value sent by the app (time of
--   the tap, also from the offline queue) is accepted only between now() - 30 days and
--   now() + 5 minutes; who marked it done is always the caller;
-- - done_at back to null ("Rimetti da fare"): nobody marked it done;
-- - done_at from a value to another value (for example the same tap sent twice by the
--   offline queue): the first time and its author are kept.
-- ---------------------------------------------------------------------------
create or replace function private.todos_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_member_id uuid;
begin
  if current_user in ('authenticated', 'anon') then
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

create trigger todos_before_update
  before update on public.todos
  for each row execute function private.todos_before_update();

create trigger todos_set_updated_at
  before update on public.todos
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- A member leaves the household (or is removed, or deletes the account): their
-- «Solo io» things are deleted with them (nobody else could ever see them). Their
-- «Tutto il Nest» things stay for the household, without author; references as
-- assignee, «per chi» or «fatto da» become null (foreign keys `on delete set null`).
-- Security definer: the «Solo io» things of the leaving member are not visible to the
-- caller (for example an administrator removing an adult).
-- ---------------------------------------------------------------------------
create or replace function private.household_members_delete_private_todos()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.todos t
  where t.created_by_member_id = old.id
    and t.is_private;
  return old;
end;
$$;

create trigger household_members_delete_private_todos
  before delete on public.household_members
  for each row execute function private.household_members_delete_private_todos();

-- ---------------------------------------------------------------------------
-- Things done more than 90 days ago are deleted, in every household (issue #23,
-- question 10: no personal data without a documented expiry). Run every day by the
-- pg_cron job "purge-done-todos" (migration schedule_done_todos_purge) as the database
-- owner, so it does not depend on anybody using the page.
-- ---------------------------------------------------------------------------
create or replace function private.purge_done_todos()
returns void
language sql
volatile
set search_path = ''
as $$
  delete from public.todos t
  where t.done_at < now() - interval '90 days';
$$;
