-- Issue #62: triggers and operations of the shopping list.
--
-- Conventions (same as the base schema):
-- - every function has `set search_path = ''` and fully qualified names;
-- - trigger functions live in the "private" schema (not exposed by the Data API);
-- - guard triggers are `security invoker`: `current_user` is then the role that runs
--   the statement. The Data API roles (authenticated, anon) get the checks, while
--   statements run by security definer functions (owner: postgres), foreign key
--   actions and the seed are trusted.
-- Execute grants are set in the shopping_items_policies_and_grants migration.

-- ---------------------------------------------------------------------------
-- Before insert: normalise the text, set the author, refuse duplicates to buy.
-- ---------------------------------------------------------------------------
create or replace function private.shopping_items_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_household_id uuid;
begin
  new.name := btrim(regexp_replace(new.name, '\s+', ' ', 'g'));
  new.quantity := nullif(btrim(regexp_replace(new.quantity, '\s+', ' ', 'g')), '');

  if current_user in ('authenticated', 'anon') then
    -- Checked before the duplicate rule, so that a refused insert into another
    -- household never reveals anything about its list.
    v_household_id := (select public.current_household_id());
    if v_household_id is null or new.household_id is distinct from v_household_id then
      raise exception 'new row violates row-level security policy for table "shopping_items"'
        using errcode = '42501';
    end if;

    -- The author is always the caller; the app never chooses it.
    select m.id into new.added_by_member_id
    from public.household_members m
    where m.user_id = (select auth.uid())
      and m.household_id = new.household_id;

    -- A new item is always to buy and gets server timestamps.
    new.checked_at := null;
    new.created_at := now();
    new.updated_at := now();
  elsif new.added_by_member_id is not null and not exists (
    select 1
    from public.household_members m
    where m.id = new.added_by_member_id
      and m.household_id = new.household_id
  ) then
    raise exception 'the author must belong to the household' using errcode = '23514';
  end if;

  -- No duplicate among the items to buy: same name ignoring case (after normalisation).
  -- The same name may be among the taken items. Unchecking an item ("Rimetti in lista")
  -- is not an insert and is never refused.
  if new.checked_at is null then
    -- Serialise inserts in the same shopping list. The lock lasts until the end of the
    -- transaction. The check below then sees the rows committed by the transaction that
    -- held the lock only in `read committed` (a new snapshot per statement), which is
    -- the isolation level of the Data API (PostgREST); under `repeatable read` or
    -- `serializable` two concurrent inserts of the same name could both pass.
    perform pg_advisory_xact_lock(hashtextextended('public.shopping_items:' || new.household_id::text, 0));
    if exists (
      select 1
      from public.shopping_items i
      where i.household_id = new.household_id
        and i.checked_at is null
        and lower(i.name) = lower(new.name)
    ) then
      raise exception 'shopping item already to buy'
        using errcode = '23505', constraint = 'shopping_items_to_buy_name_unique';
    end if;
  end if;

  return new;
end;
$$;

create trigger shopping_items_before_insert
  before insert on public.shopping_items
  for each row execute function private.shopping_items_before_insert();

-- ---------------------------------------------------------------------------
-- Before update: the app only checks and unchecks (column grant on checked_at).
-- The time of the check is the server time, whatever the app sends.
-- ---------------------------------------------------------------------------
create or replace function private.shopping_items_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if new.id is distinct from old.id
       or new.household_id is distinct from old.household_id
       or new.name is distinct from old.name
       or new.quantity is distinct from old.quantity
       or new.added_by_member_id is distinct from old.added_by_member_id
       or new.created_at is distinct from old.created_at then
      raise exception 'only checked_at can be changed' using errcode = '42501';
    end if;

    new.checked_at := case
      when new.checked_at is null then null
      when old.checked_at is null then now()
      else old.checked_at
    end;
  end if;

  return new;
end;
$$;

create trigger shopping_items_before_update
  before update on public.shopping_items
  for each row execute function private.shopping_items_before_update();

create trigger shopping_items_set_updated_at
  before update on public.shopping_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- "Annulla" window: items removed by a strappo can be put back for 10 minutes
-- (the toast lasts 5 seconds; the margin covers the offline queue of page #21 and
-- slow networks). Expired rows cannot be restored and are deleted (see below).
-- ---------------------------------------------------------------------------
create or replace function private.shopping_items_undo_window()
returns interval
language sql
immutable
set search_path = ''
as $$
  select interval '10 minutes';
$$;

-- Deletes the removed items older than the Annulla window, in every household.
-- Called by clear_checked_shopping_items(), restore_shopping_items() and after every
-- write on public.shopping_items (statement trigger below), so expired rows disappear
-- at the next change of any shopping list. Rows locked by a running restore are
-- skipped (no waits, no deadlocks) and deleted at a later call.
create or replace function private.purge_removed_shopping_items()
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  delete from private.removed_shopping_items r
  where r.id in (
    select x.id
    from private.removed_shopping_items x
    where x.removed_at < now() - private.shopping_items_undo_window()
    for update skip locked
  );
$$;

create or replace function private.shopping_items_after_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.purge_removed_shopping_items();
  return null;
end;
$$;

create trigger shopping_items_after_write
  after insert or update or delete on public.shopping_items
  for each statement execute function private.shopping_items_after_write();

-- ---------------------------------------------------------------------------
-- RPC: "strappo". Removes the given taken items of the caller's household, all or
-- none, and returns them. The removed rows are moved to
-- private.removed_shopping_items for the Annulla window.
-- Security definer (the app has no privilege on the private table): the same rules
-- as the RLS delete policy are applied explicitly (caller's household, taken items
-- only). If one of the items is unknown, of another household, no longer taken or
-- already removed by someone else, nothing is removed (same error in every case).
-- ---------------------------------------------------------------------------
create or replace function public.clear_checked_shopping_items(item_ids uuid[])
returns setof public.shopping_items
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_household_id uuid := (select public.current_household_id());
  v_expected integer;
  v_deleted integer;
begin
  if (select auth.uid()) is null or v_household_id is null then
    raise exception 'permission denied for function clear_checked_shopping_items' using errcode = '42501';
  end if;
  if item_ids is null or cardinality(item_ids) = 0 then
    return;
  end if;
  if cardinality(item_ids) > 1000 then
    raise exception 'too many items' using errcode = '22023';
  end if;
  if array_position(item_ids, null) is not null then
    raise exception 'item ids cannot be null' using errcode = '22004';
  end if;

  perform private.purge_removed_shopping_items();

  select count(distinct x) into v_expected from unnest(item_ids) as x;

  return query
    with removed as (
      delete from public.shopping_items i
      where i.id = any (item_ids)
        and i.household_id = v_household_id
        and i.checked_at is not null
      returning i.*
    ),
    kept as (
      insert into private.removed_shopping_items (
        id, household_id, name, quantity, added_by_member_id, checked_at, created_at
      )
      select r.id, r.household_id, r.name, r.quantity, r.added_by_member_id, r.checked_at, r.created_at
      from removed r
    )
    select r.* from removed r order by r.checked_at desc, r.id;

  get diagnostics v_deleted = row_count;

  if v_deleted <> v_expected then
    raise exception 'some items are no longer among the taken items' using errcode = 'P0001';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: "Annulla" of the strappo. Puts back, by id, items removed by
-- clear_checked_shopping_items() from the caller's household less than the Annulla
-- window ago, with their original name, quantity, author (null if the author has
-- left), creation and check times: the data come only from
-- private.removed_shopping_items, never from the app. All or none: an id never
-- removed, removed from another household, expired or already restored gives the
-- same error and nothing is restored. Returns the restored items.
-- ---------------------------------------------------------------------------
create or replace function public.restore_shopping_items(item_ids uuid[])
returns setof public.shopping_items
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_household_id uuid := (select public.current_household_id());
  v_expected integer;
  v_restored integer;
begin
  if (select auth.uid()) is null or v_household_id is null then
    raise exception 'permission denied for function restore_shopping_items' using errcode = '42501';
  end if;
  if item_ids is null or cardinality(item_ids) = 0 then
    return;
  end if;
  if cardinality(item_ids) > 1000 then
    raise exception 'too many items' using errcode = '22023';
  end if;
  if array_position(item_ids, null) is not null then
    raise exception 'item ids cannot be null' using errcode = '22004';
  end if;

  perform private.purge_removed_shopping_items();

  select count(distinct x) into v_expected from unnest(item_ids) as x;

  return query
    with taken_back as (
      delete from private.removed_shopping_items r
      where r.id = any (item_ids)
        and r.household_id = v_household_id
        and r.removed_at >= now() - private.shopping_items_undo_window()
      returning r.*
    ),
    restored as (
      insert into public.shopping_items (
        id, household_id, name, quantity, added_by_member_id, checked_at, created_at
      )
      select t.id, t.household_id, t.name, t.quantity, t.added_by_member_id, t.checked_at, t.created_at
      from taken_back t
      returning *
    )
    select s.* from restored s order by s.checked_at desc, s.id;

  get diagnostics v_restored = row_count;

  if v_restored <> v_expected then
    raise exception 'some items cannot be restored' using errcode = 'P0001';
  end if;
end;
$$;
