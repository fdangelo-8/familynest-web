-- Issue #512 (DB-3 of plan #501, for page A7 #540): the new rules of the shopping list.
--
-- 1. The taken things disappear 12 hours after they were taken (decision 84 of Francesco):
--    private.shopping_taken_lifetime() is the only source of the 12 hours;
--    private.purge_taken_shopping_items(p_at, p_household_id) deletes for real (no copy for
--    «Annulla») every thing taken at or before p_at - 12 hours, skipping the rows locked by
--    a running statement (deleted at a later run). The things to buy never expire. Run every
--    10 minutes for every household by the pg_cron job purge-taken-shopping-items
--    (schedule_taken_shopping_items_purge migration, LEZIONI: expiry by pg_cron, not by a
--    write trigger); public.run_shopping_purge() runs it for ONE household for the tests of
--    the page (as run_notification_job).
--    What goes with a thing: its people (shopping_item_assignees, on delete cascade).
--    private.shopping_additions (the digest of 19:00) and households.first_shopping_item_at
--    do not change. Realtime sends the DELETE with the id only, as for every delete of
--    shopping_items (shopping_items_realtime migration): the pages ignore unknown ids.
--    «Rimetti in lista» sets checked_at back to null and stops the count; taken again, the
--    count starts from the new checked_at (server time, shopping_items_before_update).
-- 2. «Svuota tutta la lista» (decision 85): public.clear_shopping_list() for every member of
--    the household with an account (all adults: children have no account), not only the
--    administrator. Removes every thing of the household, to buy and taken, keeping a copy
--    with its people in private.removed_shopping_items for the «Annulla» window that already
--    exists (10 minutes, private.shopping_items_undo_window()). It takes the lock of the list
--    used by the insert, so an addition made at the same time either ends before (and is
--    removed) or after (and stays).
-- 3. «Annulla»: public.restore_shopping_items() (same arguments, results, errors and
--    privileges: `create or replace` keeps the owner and the grants) puts back also the
--    things to buy, with checked_at null. A thing to buy whose name (ignoring case) is
--    meanwhile again among the things to buy does not come back and its copy is deleted,
--    without error; the result has only the things put back. Same lock of the list, so
--    the check and the insert are not overtaken by an addition.
--
-- Conventions: `set search_path = ''` and fully qualified names; helpers and jobs in the
-- "private" schema (not exposed by the Data API, not in the generated types); the functions
-- that write refuse every Data API method other than POST before reading anything (lesson of
-- #112). Execute grants are in the shopping_list_purge_and_clear_grants migration.
--
-- Errors:
-- - 42501: no signed-in user, or a caller without household (clear_shopping_list,
--   restore_shopping_items);
-- - P0001 'use POST': clear_shopping_list or run_shopping_purge called through the Data API
--   with a method other than POST;
-- - 22023: run_shopping_purge without household, or a job without instant or with an
--   infinite instant;
-- - restore_shopping_items: 22023, 22004 and P0001 as before (#62).

-- ---------------------------------------------------------------------------
-- How long a taken thing stays in the list: 12 hours (decision 84).
-- ---------------------------------------------------------------------------
create or replace function private.shopping_taken_lifetime()
returns interval
language sql
immutable
set search_path = ''
as $$
  select interval '12 hours';
$$;

-- ---------------------------------------------------------------------------
-- Job: deletes the things taken at or before p_at - 12 hours, of one household or, with
-- p_household_id null, of every household (only from the pg_cron job; the RPC for the tests
-- always passes one household). Returns how many it deleted.
-- In `read committed` a row changed by another transaction after the snapshot is checked
-- again when it is locked: a thing put back in the list, or taken again, in the meantime
-- is kept.
-- ---------------------------------------------------------------------------
create or replace function private.purge_taken_shopping_items(p_at timestamptz, p_household_id uuid)
returns integer
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  if p_at is null or not isfinite(p_at) then
    raise exception 'invalid instant' using errcode = '22023';
  end if;

  with expired as (
    select i.id
    from public.shopping_items i
    where i.checked_at is not null
      and i.checked_at <= p_at - private.shopping_taken_lifetime()
      and (p_household_id is null or i.household_id = p_household_id)
    for update skip locked
  )
  delete from public.shopping_items s
  using expired e
  where s.id = e.id;

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC for the tests of page A7 (rule 3): runs the job for ONE household (p_household_id,
-- required: lesson of #237) as if it ran at the instant p_at (default now). Nothing of the
-- other households is deleted. Returns how many things it deleted. Executable only by
-- service_role (administrative key) and the database owner, never by authenticated or anon
-- (grants). Security definer: the job deletes rows the caller could not, and service_role
-- has no privilege on the private schema (lesson: the role check and the call to private
-- are not left to a security invoker expression). Only POST through the Data API.
-- ---------------------------------------------------------------------------
create or replace function public.run_shopping_purge(p_household_id uuid, p_at timestamptz default now())
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;
  if p_household_id is null then
    raise exception 'the household is required' using errcode = '22023';
  end if;
  if p_at is null or not isfinite(p_at) then
    raise exception 'invalid instant' using errcode = '22023';
  end if;

  return private.purge_taken_shopping_items(p_at, p_household_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: «Svuota tutta la lista» (rule 6). Removes every thing of the caller's household and
-- returns them (same columns as shopping_items): the things to buy first, oldest first, then
-- the taken things, last taken first. An empty list gives 0 rows and no error.
-- Security definer (the app has no privilege on the private table): the household is always
-- the caller's one, nothing else comes from the app.
-- Locks: first the rows of the list (so that a rename running at the same time, which
-- holds its row and then asks for the lock of the list, never waits in a circle with this
-- function), then the lock of the list used by the insert (read committed, see #62): the
-- delete below runs with a new snapshot and sees every addition that ended before.
-- The people are read in the same statement as the delete (same snapshot), before their
-- rows go with the thing (on delete cascade).
-- ---------------------------------------------------------------------------
create or replace function public.clear_shopping_list()
returns setof public.shopping_items
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_household_id uuid;
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  v_household_id := (select public.current_household_id());
  if (select auth.uid()) is null or v_household_id is null then
    raise exception 'permission denied for function clear_shopping_list' using errcode = '42501';
  end if;

  perform 1
  from public.shopping_items i
  where i.household_id = v_household_id
  for update;

  perform pg_advisory_xact_lock(hashtextextended('public.shopping_items:' || v_household_id::text, 0));

  perform private.purge_removed_shopping_items();

  return query
    with people as (
      select a.shopping_item_id, array_agg(a.member_id order by a.created_at, m.created_at, m.id) as member_ids
      from public.shopping_item_assignees a
      join public.household_members m on m.id = a.member_id
      where a.household_id = v_household_id
      group by a.shopping_item_id
    ),
    removed as (
      delete from public.shopping_items i
      where i.household_id = v_household_id
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
    select r.*
    from removed r
    order by r.checked_at is not null,
             case when r.checked_at is null then r.created_at end,
             r.checked_at desc,
             r.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: «Annulla» of the strappo and of «Svuota tutta la lista» (rules of #62 and #337,
-- rule 8 of #512). Puts back, by id, the things removed from the caller's household less
-- than the «Annulla» window ago, with their name, quantity, author (null if the author has
-- left), creation and check times (null for the things to buy) and their people (only those
-- still adults or children of the household): the data come only from
-- private.removed_shopping_items, never from the app. All or none: an id never removed,
-- removed from another household, expired or already restored gives the same error and
-- nothing is restored.
-- A thing to buy is not put back when, meanwhile, a thing to buy with the same name
-- (ignoring case) is in the list, or when another copy to buy with the same name is put back
-- by the same call (the last removed wins): its copy is deleted all the same, without error.
-- Returns the things put back: to buy first (oldest first), then taken (last taken first);
-- with only taken things, the same order as before. A taken thing put back with a check
-- older than 12 hours disappears at the next run of the job.
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
  v_skipped uuid[];
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

  -- Same lock as the insert: no addition can slip between the check of the names below
  -- and the insert.
  perform pg_advisory_xact_lock(hashtextextended('public.shopping_items:' || v_household_id::text, 0));

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

  -- Things to buy that do not come back (their copy is already deleted above).
  select coalesce(array_agg(t.id), '{}') into v_skipped
  from unnest(v_taken) as t
  where t.checked_at is null
    and (
      exists (
        select 1
        from public.shopping_items i
        where i.household_id = v_household_id
          and i.checked_at is null
          and lower(i.name) = lower(t.name)
      )
      or exists (
        select 1
        from unnest(v_taken) as o
        where o.checked_at is null
          and o.id <> t.id
          and lower(o.name) = lower(t.name)
          and (o.removed_at > t.removed_at or (o.removed_at = t.removed_at and o.id > t.id))
      )
    );

  insert into public.shopping_items (
    id, household_id, name, quantity, added_by_member_id, checked_at, created_at
  )
  select t.id, t.household_id, t.name, t.quantity, t.added_by_member_id, t.checked_at, t.created_at
  from unnest(v_taken) as t
  where t.id <> all (v_skipped);

  -- The people, in their order, once the things exist again: only those still adults or
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
  where t.id <> all (v_skipped)
  order by t.id, x.position
  on conflict do nothing;

  return query
    select s.*
    from public.shopping_items s
    where s.id = any (item_ids)
      and s.id <> all (v_skipped)
      and s.household_id = v_household_id
    order by s.checked_at is not null,
             case when s.checked_at is null then s.created_at end,
             s.checked_at desc,
             s.id;
end;
$$;
