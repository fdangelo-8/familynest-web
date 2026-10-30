-- Issue #110 (for page #22 Aggiungi, request B): «Annulla» after adding items to the
-- shopping list from the Aggiungi sheet.
--
-- The page sends the ids of the items it has just added (the ids come from a separate
-- read after the insert, never from a .select() chained to it). The function deletes
-- only the items that meet ALL these conditions, checked here on the data of the server
-- (LEZIONI: nothing sent by the app is trusted except a list of ids):
-- - they belong to the household of the caller;
-- - they are still to buy (checked_at is null): an item someone has already taken stays;
-- - they were added by the caller (added_by_member_id = the member of the caller);
-- - they were created no more than 10 minutes ago (and not in the future).
-- Every other id (unknown, of another household, added by someone else, taken, too old,
-- already deleted) is ignored without error, and the answer is the same in every case:
-- nothing about other items or other households can be learnt. The result is the list of
-- the ids actually deleted, oldest first.
--
-- No copy is kept: undoing an addition is a real delete (data minimisation). As for
-- every delete of shopping_items, Realtime sends a DELETE event carrying only the id
-- (see the shopping_items_realtime migration). households.first_shopping_item_at is not
-- changed (never cleared, see the starter_list migrations).
--
-- Security definer: the RLS delete policy of shopping_items allows deleting only taken
-- items, so the same rules (household of the caller) plus the stricter ones above are
-- applied explicitly. `set search_path = ''` and fully qualified names.
--
-- Only POST through the Data API (lesson of #112): PostgREST can also call a function
-- with GET or HEAD (arguments in the query string); any method other than POST is
-- refused with P0001 'use POST' before reading any data. A direct SQL call (no
-- request.method, for example the tests or the service role from SQL) is accepted.
--
-- Errors:
-- - P0001 'use POST': called through the Data API with a method other than POST;
-- - 42501: no signed-in user, or the caller has no household;
-- - 22023: more than 1000 ids;
-- - 22004: an id is null.
-- Execute grants are set in the shopping_items_undo_add_grants migration.

-- ---------------------------------------------------------------------------
-- Window of the «Annulla» after an addition: 10 minutes (the toast lasts 5 seconds;
-- the margin covers slow networks). Separate from private.shopping_items_undo_window()
-- (the strappo), so that one can change without the other.
-- ---------------------------------------------------------------------------
create or replace function private.shopping_items_undo_add_window()
returns interval
language sql
immutable
set search_path = ''
as $$
  select interval '10 minutes';
$$;

-- ---------------------------------------------------------------------------
-- RPC: «Annulla» of an addition to the shopping list.
-- ---------------------------------------------------------------------------
create or replace function public.undo_added_shopping_items(item_ids uuid[])
returns setof uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_household_id uuid;
  v_member_id uuid;
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  v_household_id := (select public.current_household_id());

  if (select auth.uid()) is not null and v_household_id is not null then
    select m.id into v_member_id
    from public.household_members m
    where m.user_id = (select auth.uid())
      and m.household_id = v_household_id;
  end if;

  if v_member_id is null then
    raise exception 'permission denied for function undo_added_shopping_items' using errcode = '42501';
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

  -- In `read committed` (the Data API), an item checked by someone else while this
  -- delete waits for its row lock is evaluated again and kept.
  return query
    with removed as (
      delete from public.shopping_items i
      where i.id = any (item_ids)
        and i.household_id = v_household_id
        and i.added_by_member_id = v_member_id
        and i.checked_at is null
        and i.created_at >= now() - private.shopping_items_undo_add_window()
        and i.created_at <= now()
      returning i.id, i.created_at
    )
    select r.id from removed r order by r.created_at, r.id;
end;
$$;
