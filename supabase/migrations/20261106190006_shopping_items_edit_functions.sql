-- Issue #337 (for #335, spec 333 §6.11 – §6.14): the things to buy can be renamed, their
-- quantity changed, and the strappo keeps their people for «Annulla».
--
-- 1. private.shopping_items_before_update: the app may now change name and quantity too
--    (column grants in the assignees_policies_and_grants migration). For every role they
--    are stored normalised exactly as on insert. For the API roles id, household, author
--    and creation time still never change (42501), and the time of the check is still the
--    server time.
--    Duplicates (same lock and same error as the insert, 23505
--    shopping_items_to_buy_name_unique): a thing to buy renamed like ANOTHER thing to buy,
--    ignoring case. Changing only upper and lower case is accepted (no other thing has
--    that name); a name present only among the taken things is accepted; «Rimetti in
--    lista» (checked_at back to null without a new name) is never refused, as before;
--    one update that renames a taken thing and puts it back in the list is checked
--    like a rename (the pages do not do it, but the table does not allow it either).
-- 2. clear_checked_shopping_items(): the removed items keep their people
--    (private.removed_shopping_items.assignee_member_ids, in their order).
-- 3. restore_shopping_items(): puts the people back, only those still adults or children
--    of the household (someone who left in the meantime is skipped, without error), in
--    the order saved.
-- Same arguments, results, errors and privileges as #62: `create or replace` keeps the
-- owner and the grants.

-- ---------------------------------------------------------------------------
-- 1. Before update
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
       or new.added_by_member_id is distinct from old.added_by_member_id
       or new.created_at is distinct from old.created_at then
      raise exception 'this field of a shopping item cannot be changed' using errcode = '42501';
    end if;

    new.checked_at := case
      when new.checked_at is null then null
      when old.checked_at is null then now()
      else old.checked_at
    end;
  end if;

  if new.name is distinct from old.name then
    new.name := btrim(regexp_replace(new.name, '\s+', ' ', 'g'));
  end if;
  if new.quantity is distinct from old.quantity then
    new.quantity := nullif(btrim(regexp_replace(new.quantity, '\s+', ' ', 'g')), '');
  end if;

  -- A thing that is to buy after the update and gets another name (renamed while to buy,
  -- or renamed and put back in the list in the same update): no other thing to buy with
  -- that name, ignoring case. Same lock as the insert (read committed, see #62).
  if new.name is distinct from old.name
     and new.checked_at is null then
    perform pg_advisory_xact_lock(hashtextextended('public.shopping_items:' || new.household_id::text, 0));
    if exists (
      select 1
      from public.shopping_items i
      where i.household_id = new.household_id
        and i.checked_at is null
        and i.id <> new.id
        and lower(i.name) = lower(new.name)
    ) then
      raise exception 'shopping item already to buy'
        using errcode = '23505', constraint = 'shopping_items_to_buy_name_unique';
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. RPC: strappo (rules of #62), keeping the people of every removed item.
-- The people are read in the same statement as the delete (same snapshot), before their
-- rows go with the item (on delete cascade).
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
    with people as (
      select a.shopping_item_id, array_agg(a.member_id order by a.created_at, m.created_at, m.id) as member_ids
      from public.shopping_item_assignees a
      join public.household_members m on m.id = a.member_id
      where a.shopping_item_id = any (item_ids)
        and a.household_id = v_household_id
      group by a.shopping_item_id
    ),
    removed as (
      delete from public.shopping_items i
      where i.id = any (item_ids)
        and i.household_id = v_household_id
        and i.checked_at is not null
      returning i.*
    ),
    kept as (
      insert into private.removed_shopping_items (
        id, household_id, name, quantity, added_by_member_id, checked_at, created_at, assignee_member_ids
      )
      select r.id, r.household_id, r.name, r.quantity, r.added_by_member_id, r.checked_at, r.created_at,
             coalesce(p.member_ids, '{}'::uuid[])
      from removed r
      left join people p on p.shopping_item_id = r.id
    )
    select r.* from removed r order by r.checked_at desc, r.id;

  get diagnostics v_deleted = row_count;

  if v_deleted <> v_expected then
    raise exception 'some items are no longer among the taken items' using errcode = 'P0001';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. RPC: «Annulla» of the strappo (rules of #62), with the people of every item.
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
  v_taken private.removed_shopping_items[];
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

  -- Taken out of the private table; all or none (the error undoes the delete).
  with taken_back as (
    delete from private.removed_shopping_items r
    where r.id = any (item_ids)
      and r.household_id = v_household_id
      and r.removed_at >= now() - private.shopping_items_undo_window()
    returning r
  )
  select coalesce(array_agg(t.r), '{}') into v_taken from taken_back t;

  if cardinality(v_taken) <> v_expected then
    raise exception 'some items cannot be restored' using errcode = 'P0001';
  end if;

  insert into public.shopping_items (
    id, household_id, name, quantity, added_by_member_id, checked_at, created_at
  )
  select t.id, t.household_id, t.name, t.quantity, t.added_by_member_id, t.checked_at, t.created_at
  from unnest(v_taken) as t;

  -- The people, in their order, once the items exist again: only those still adults or
  -- children of the household. The order is kept in created_at (one microsecond per
  -- position, the order every reader uses: created_at, then the members); this function
  -- runs as its owner, so the guard of the link table leaves created_at as given.
  insert into public.shopping_item_assignees (shopping_item_id, member_id, household_id, created_at)
  select t.id, m.id, v_household_id, now() + x.position * interval '1 microsecond'
  from unnest(v_taken) as t
  cross join lateral unnest(t.assignee_member_ids) with ordinality as x (member_id, position)
  join public.household_members m
    on m.id = x.member_id
   and m.household_id = v_household_id
   and m.kind in ('adult', 'child')
  order by t.id, x.position
  on conflict do nothing;

  return query
    select s.*
    from public.shopping_items s
    where s.id = any (item_ids)
      and s.household_id = v_household_id
    order by s.checked_at desc, s.id;
end;
$$;
