-- Issue #108: functions and triggers of the deadlines ("Scadenze").
--
-- Conventions (same as the base schema, the events and the things to do):
-- - every function has `set search_path = ''` and fully qualified names;
-- - helpers and trigger functions live in the "private" schema (not exposed by the
--   Data API, not in the generated types);
-- - guard triggers are `security invoker`: `current_user` is then the role that runs
--   the statement. The Data API roles (authenticated, anon) get the checks, while
--   statements run by security definer functions (owner: postgres), foreign key
--   actions and the seed are trusted;
-- - `security definer` only where the function must touch rows the caller cannot see.
-- Execute grants are set in the deadlines_policies_and_grants migration.
-- The member of the caller comes from private.current_member_id() (events migration).

-- ---------------------------------------------------------------------------
-- Used by insert and update: whoever takes care of a deadline is an adult or a child
-- of its household (never a pet). The composite foreign keys already guarantee the
-- household of every member reference; this adds the kind.
-- Called only when the assignee is set or changed: the foreign key actions that run
-- while a member leaves (`on delete set null` of the other columns) must never be
-- refused because of an assignee that is being removed in the same statement.
-- Evaluated as the caller: an API role sees the members of its own household, and the
-- error is the same whether a member of another household exists or not.
-- ---------------------------------------------------------------------------
create or replace function private.deadlines_check_assignee(p_household_id uuid, p_member_id uuid)
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
-- Text and reminders as stored: title and note cleaned of whitespace (an empty note
-- stays empty and is refused by the length check), reminders sorted from the farthest.
-- Duplicates and values not allowed are left as they are, so that the check constraint
-- refuses them.
-- ---------------------------------------------------------------------------
create or replace function private.deadlines_normalize(p_row public.deadlines)
returns public.deadlines
language plpgsql
immutable
set search_path = ''
as $$
begin
  p_row.title := btrim(regexp_replace(p_row.title, '\s+', ' ', 'g'));
  if p_row.note is not null then
    p_row.note := btrim(regexp_replace(p_row.note, '\s+', ' ', 'g'));
  end if;
  if p_row.reminder_days is not null and coalesce(array_ndims(p_row.reminder_days), 1) = 1 then
    p_row.reminder_days := coalesce(
      (select array_agg(d.day order by d.day desc nulls last) from unnest(p_row.reminder_days) as d (day)),
      '{}'::smallint[]
    );
  end if;
  return p_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- Before insert: household and author of the caller, server timestamps.
-- ---------------------------------------------------------------------------
create or replace function private.deadlines_before_insert()
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
      raise exception 'new row violates row-level security policy for table "deadlines"'
        using errcode = '42501';
    end if;

    -- The author is always the caller; the app never chooses it.
    new.created_by_member_id := (select private.current_member_id());
    new.created_at := now();
    new.updated_at := now();
  end if;

  new := private.deadlines_normalize(new);
  if new.assignee_member_id is not null then
    perform private.deadlines_check_assignee(new.household_id, new.assignee_member_id);
  end if;
  return new;
end;
$$;

create trigger deadlines_before_insert
  before insert on public.deadlines
  for each row execute function private.deadlines_before_insert();

-- ---------------------------------------------------------------------------
-- Before update (API roles):
-- - household, author and creation time never change;
-- - only the author changes «Solo io» (a deadline without author can never become
--   «Solo io»).
-- For every role: text and reminders normalised, kind of a new assignee checked.
-- ---------------------------------------------------------------------------
create or replace function private.deadlines_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if new.id is distinct from old.id
       or new.household_id is distinct from old.household_id
       or new.created_by_member_id is distinct from old.created_by_member_id
       or new.created_at is distinct from old.created_at then
      raise exception 'this field of a deadline cannot be changed' using errcode = '42501';
    end if;

    if new.is_private is distinct from old.is_private
       and (old.created_by_member_id is null
            or old.created_by_member_id is distinct from (select private.current_member_id())) then
      raise exception 'only the author can change who sees a deadline' using errcode = '42501';
    end if;
  end if;

  new := private.deadlines_normalize(new);
  if new.assignee_member_id is not null
     and new.assignee_member_id is distinct from old.assignee_member_id then
    perform private.deadlines_check_assignee(new.household_id, new.assignee_member_id);
  end if;
  return new;
end;
$$;

create trigger deadlines_before_update
  before update on public.deadlines
  for each row execute function private.deadlines_before_update();

create trigger deadlines_set_updated_at
  before update on public.deadlines
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- A member leaves the household (or is removed, or deletes the account): their
-- «Solo io» deadlines are deleted with them (nobody else could ever see them). Their
-- «Tutto il Nest» deadlines stay for the household, without author; references as
-- assignee or «riguarda» become null (foreign keys `on delete set null`).
-- Security definer: the «Solo io» deadlines of the leaving member are not visible to
-- the caller (for example an administrator removing an adult).
-- ---------------------------------------------------------------------------
create or replace function private.household_members_delete_private_deadlines()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.deadlines d
  where d.created_by_member_id = old.id
    and d.is_private;
  return old;
end;
$$;

create trigger household_members_delete_private_deadlines
  before delete on public.household_members
  for each row execute function private.household_members_delete_private_deadlines();
