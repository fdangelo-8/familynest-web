-- undo_added_shopping_items(): «Annulla» after an addition to the shopping list
-- (issue #110, for page #22). Only items of the caller's household, still to buy, added
-- by the caller, created no more than 10 minutes ago. Isolation between households, no
-- leak about other items, no anonymous access, only POST through the Data API.
-- Seed ids: A = Marco (Casa D'Angelo, member a1..01; Laura a1..02 has no account),
-- B = Giulia (Casa Bianchi, member b1..01), B2 = Paolo (Casa Bianchi, member b1..02),
-- C = Chiara (no household).
begin;
create extension if not exists pgtap with schema extensions;

select plan(66);

-- ---------------------------------------------------------------------------
-- Fixtures, inserted as the owner (trusted: author and creation time are kept).
-- ---------------------------------------------------------------------------
insert into public.shopping_items (id, household_id, name, added_by_member_id, checked_at, created_at)
values
  -- Casa D'Angelo, added by Laura (another member of the same household), just now.
  ('e1100000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Origano',
   'a1000000-0000-4000-8000-000000000002', null, now()),
  -- Casa D'Angelo, added by Marco 11 minutes ago (outside the window).
  ('e1100000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'Sale',
   'a1000000-0000-4000-8000-000000000001', null, now() - interval '11 minutes'),
  -- Casa D'Angelo, added by Marco 9 minutes ago (inside the window).
  ('e1100000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'Zucchero',
   'a1000000-0000-4000-8000-000000000001', null, now() - interval '9 minutes'),
  -- Casa D'Angelo, added by Marco with a creation time in the future.
  ('e1100000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 'Farina',
   'a1000000-0000-4000-8000-000000000001', null, now() + interval '1 minute'),
  -- Casa Bianchi, added by Giulia just now.
  ('e1100000-0000-4000-8000-000000000005', '22222222-2222-4222-8222-222222222222', 'Miele',
   'b1000000-0000-4000-8000-000000000001', null, now()),
  -- Casa D'Angelo, added by Marco just now and already taken.
  ('e1100000-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111', 'Aceto',
   'a1000000-0000-4000-8000-000000000001', now(), now()),
  -- Casa D'Angelo, added by Marco just now, to buy (POST checks).
  ('e1100000-0000-4000-8000-000000000007', '11111111-1111-4111-8111-111111111111', 'Olio',
   'a1000000-0000-4000-8000-000000000001', null, now()),
  -- Casa Bianchi, added by Paolo just now.
  ('e1100000-0000-4000-8000-000000000008', '22222222-2222-4222-8222-222222222222', 'Tè',
   'b1000000-0000-4000-8000-000000000002', null, now()),
  -- Casa D'Angelo, author unknown (member who left), just now.
  ('e1100000-0000-4000-8000-000000000009', '11111111-1111-4111-8111-111111111111', 'Riso',
   null, null, now()),
  -- Casa D'Angelo, added by Marco just now (mixed list).
  ('e1100000-0000-4000-8000-000000000010', '11111111-1111-4111-8111-111111111111', 'Burro',
   'a1000000-0000-4000-8000-000000000001', null, now()),
  -- Casa D'Angelo, added by Marco just now (direct SQL call, no request method).
  ('e1100000-0000-4000-8000-000000000011', '11111111-1111-4111-8111-111111111111', 'Pepe',
   'a1000000-0000-4000-8000-000000000001', null, now()),
  -- Casa D'Angelo, added by Marco just now (Giulia tries to remove it).
  ('e1100000-0000-4000-8000-000000000012', '11111111-1111-4111-8111-111111111111', 'Sedano',
   'a1000000-0000-4000-8000-000000000001', null, now());

-- ---------------------------------------------------------------------------
-- Schema and privileges
-- ---------------------------------------------------------------------------
select has_function('public', 'undo_added_shopping_items', array['uuid[]'], 'undo_added_shopping_items exists');
select function_returns('public', 'undo_added_shopping_items', array['uuid[]'], 'setof uuid', 'it returns the ids actually removed');
select is_definer('public', 'undo_added_shopping_items', array['uuid[]'], 'it is security definer');
select ok(
  (select p.proconfig @> array['search_path=""']
   from pg_proc p where p.oid = 'public.undo_added_shopping_items(uuid[])'::regprocedure),
  'it has an empty search_path'
);
select ok(
  not has_function_privilege('anon', 'public.undo_added_shopping_items(uuid[])', 'execute')
  and has_function_privilege('authenticated', 'public.undo_added_shopping_items(uuid[])', 'execute'),
  'only signed-in users can call it (anon cannot)'
);
select ok(
  not has_function_privilege('anon', 'private.shopping_items_undo_add_window()', 'execute')
  and not has_function_privilege('authenticated', 'private.shopping_items_undo_add_window()', 'execute'),
  'the app cannot call the window function'
);
select is(
  (select v from (select private.shopping_items_undo_add_window() as v) w),
  interval '10 minutes',
  'the window is 10 minutes'
);
select ok(
  not has_column_privilege('authenticated', 'public.shopping_items', 'id', 'insert'),
  'the app still cannot choose the id of an item'
);

-- ---------------------------------------------------------------------------
-- Anonymous: no access
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok(
  $$ select * from public.undo_added_shopping_items(array['e1100000-0000-4000-8000-000000000007']::uuid[]) $$,
  '42501', null,
  'anon cannot call the function'
);
reset role;

-- ---------------------------------------------------------------------------
-- C (Chiara, no household): refused
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select * from public.undo_added_shopping_items(array['e1100000-0000-4000-8000-000000000007']::uuid[]) $$,
  '42501', 'permission denied for function undo_added_shopping_items',
  'a user without household is refused'
);

-- ---------------------------------------------------------------------------
-- A (Marco): undoes what he has just added
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
set local request.method to 'POST';

insert into public.shopping_items (name) values ('Rucola'), ('Basilico');
select is(
  (select count(*)::integer from public.undo_added_shopping_items(
     array(select i.id from public.shopping_items i where i.name in ('Rucola', 'Basilico')))),
  2,
  'A undoes the two items he has just added'
);
select is_empty(
  $$ select 1 from public.shopping_items i where i.name in ('Rucola', 'Basilico') $$,
  'the two items are gone'
);
select results_eq(
  $$ select * from public.undo_added_shopping_items(array['e1100000-0000-4000-8000-000000000003']::uuid[]) $$,
  $$ values ('e1100000-0000-4000-8000-000000000003'::uuid) $$,
  'an item added by A 9 minutes ago is removed and its id returned'
);
select is_empty(
  $$ select 1 from public.shopping_items i where i.id = 'e1100000-0000-4000-8000-000000000003' $$,
  'the item added 9 minutes ago is gone'
);

-- Taken items stay.
insert into public.shopping_items (name) values ('Cipolle');
update public.shopping_items set checked_at = now() where name = 'Cipolle';
select is_empty(
  $$ select * from public.undo_added_shopping_items(
       array(select i.id from public.shopping_items i where i.name = 'Cipolle')) $$,
  'an item just added by A and then taken is not removed'
);
select isnt_empty(
  $$ select 1 from public.shopping_items i where i.name = 'Cipolle' and i.checked_at is not null $$,
  'the taken item is still among the taken items'
);
select is_empty(
  $$ select * from public.undo_added_shopping_items(array['e1100000-0000-4000-8000-000000000006']::uuid[]) $$,
  'an item taken by someone else is not removed'
);
select isnt_empty(
  $$ select 1 from public.shopping_items i where i.id = 'e1100000-0000-4000-8000-000000000006' $$,
  'the item taken by someone else is still there'
);

-- Too old, or in the future.
select is_empty(
  $$ select * from public.undo_added_shopping_items(array['a3000000-0000-4000-8000-000000000001']::uuid[]) $$,
  'an item added by A two days ago (seed Latte) is not removed'
);
select isnt_empty(
  $$ select 1 from public.shopping_items i where i.id = 'a3000000-0000-4000-8000-000000000001' $$,
  'the seed Latte is still there'
);
select is_empty(
  $$ select * from public.undo_added_shopping_items(array['e1100000-0000-4000-8000-000000000002']::uuid[]) $$,
  'an item added by A 11 minutes ago is not removed'
);
select isnt_empty(
  $$ select 1 from public.shopping_items i where i.id = 'e1100000-0000-4000-8000-000000000002' $$,
  'the item added 11 minutes ago is still there'
);
select is_empty(
  $$ select * from public.undo_added_shopping_items(array['e1100000-0000-4000-8000-000000000004']::uuid[]) $$,
  'an item with a creation time in the future is not removed'
);
select isnt_empty(
  $$ select 1 from public.shopping_items i where i.id = 'e1100000-0000-4000-8000-000000000004' $$,
  'the item with a future creation time is still there'
);

-- Added by someone else in the same household, or by a member who left.
select is_empty(
  $$ select * from public.undo_added_shopping_items(array['e1100000-0000-4000-8000-000000000001']::uuid[]) $$,
  'an item just added by Laura is not removed by A'
);
select isnt_empty(
  $$ select 1 from public.shopping_items i where i.id = 'e1100000-0000-4000-8000-000000000001' $$,
  'the item of Laura is still there'
);
select is_empty(
  $$ select * from public.undo_added_shopping_items(array['e1100000-0000-4000-8000-000000000009']::uuid[]) $$,
  'an item without author (member who left) is not removed'
);
select isnt_empty(
  $$ select 1 from public.shopping_items i where i.id = 'e1100000-0000-4000-8000-000000000009' $$,
  'the item without author is still there'
);

-- Other household: same answer as an unknown id, nothing leaks.
select lives_ok(
  $$ select * from public.undo_added_shopping_items(array['e1100000-0000-4000-8000-000000000005']::uuid[]) $$,
  'an id of Casa Bianchi gives no error'
);
select is_empty(
  $$ select * from public.undo_added_shopping_items(array['e1100000-0000-4000-8000-000000000005']::uuid[]) $$,
  'an item just added by Giulia (Casa Bianchi) is not removed by A'
);
select is_empty(
  $$ select * from public.undo_added_shopping_items(array[gen_random_uuid()]) $$,
  'an unknown id gives the same empty answer'
);
select is_empty(
  $$ select 1 from public.shopping_items i where i.id = 'e1100000-0000-4000-8000-000000000005' $$,
  'A still reads nothing of Casa Bianchi'
);

-- Mixed list: only what meets every condition is removed, once.
select results_eq(
  $$ select * from public.undo_added_shopping_items(array[
       'e1100000-0000-4000-8000-000000000005', 'e1100000-0000-4000-8000-000000000006',
       'e1100000-0000-4000-8000-000000000001', 'e1100000-0000-4000-8000-000000000002',
       'e1100000-0000-4000-8000-000000000010', 'e1100000-0000-4000-8000-000000000010',
       gen_random_uuid()
     ]::uuid[]) $$,
  $$ values ('e1100000-0000-4000-8000-000000000010'::uuid) $$,
  'in a mixed list only the fresh item of A is removed, once'
);
select results_eq(
  $$ select i.id from public.shopping_items i
     where i.id in ('e1100000-0000-4000-8000-000000000001', 'e1100000-0000-4000-8000-000000000002',
                    'e1100000-0000-4000-8000-000000000006', 'e1100000-0000-4000-8000-000000000010')
     order by i.id $$,
  $$ values ('e1100000-0000-4000-8000-000000000001'::uuid), ('e1100000-0000-4000-8000-000000000002'::uuid),
            ('e1100000-0000-4000-8000-000000000006'::uuid) $$,
  'after the mixed list the other items of Casa D''Angelo are still there'
);

-- Input checks.
select is_empty(
  $$ select * from public.undo_added_shopping_items(null) $$,
  'null list: nothing removed, no error'
);
select is_empty(
  $$ select * from public.undo_added_shopping_items(array[]::uuid[]) $$,
  'empty list: nothing removed, no error'
);
select throws_ok(
  $$ select * from public.undo_added_shopping_items(array['e1100000-0000-4000-8000-000000000007', null]::uuid[]) $$,
  '22004', 'item ids cannot be null',
  'a null id is refused'
);
select throws_ok(
  $$ select * from public.undo_added_shopping_items(array(select gen_random_uuid() from generate_series(1, 1001))) $$,
  '22023', 'too many items',
  'more than 1000 ids are refused'
);
select isnt_empty(
  $$ select 1 from public.shopping_items i where i.id = 'e1100000-0000-4000-8000-000000000007' $$,
  'a refused list removes nothing'
);

-- Only POST through the Data API: any other method is refused before reading data.
set local request.method to 'GET';
select throws_ok(
  $$ select * from public.undo_added_shopping_items(array['e1100000-0000-4000-8000-000000000007']::uuid[]) $$,
  'P0001', 'use POST',
  'GET is refused'
);
set local request.method to 'HEAD';
select throws_ok(
  $$ select * from public.undo_added_shopping_items(array['e1100000-0000-4000-8000-000000000007']::uuid[]) $$,
  'P0001', 'use POST',
  'HEAD is refused'
);
set local request.method to 'PUT';
select throws_ok(
  $$ select * from public.undo_added_shopping_items(array['e1100000-0000-4000-8000-000000000007']::uuid[]) $$,
  'P0001', 'use POST',
  'PUT is refused'
);
set local request.method to 'PATCH';
select throws_ok(
  $$ select * from public.undo_added_shopping_items(array['e1100000-0000-4000-8000-000000000007']::uuid[]) $$,
  'P0001', 'use POST',
  'PATCH is refused'
);
set local request.method to 'DELETE';
select throws_ok(
  $$ select * from public.undo_added_shopping_items(array['e1100000-0000-4000-8000-000000000007']::uuid[]) $$,
  'P0001', 'use POST',
  'DELETE is refused'
);
set local request.method to 'post';
select throws_ok(
  $$ select * from public.undo_added_shopping_items(array['e1100000-0000-4000-8000-000000000007']::uuid[]) $$,
  'P0001', 'use POST',
  'a lowercase method is refused'
);
set local request.method to 'GET';
select throws_ok(
  $$ select * from public.undo_added_shopping_items(null) $$,
  'P0001', 'use POST',
  'GET is refused even with no ids'
);
select isnt_empty(
  $$ select 1 from public.shopping_items i where i.id = 'e1100000-0000-4000-8000-000000000007' $$,
  'the refused methods removed nothing'
);
set local request.method to 'POST';
select results_eq(
  $$ select * from public.undo_added_shopping_items(array['e1100000-0000-4000-8000-000000000007']::uuid[]) $$,
  $$ values ('e1100000-0000-4000-8000-000000000007'::uuid) $$,
  'the same call with POST removes the item'
);
set local request.method to '';
select results_eq(
  $$ select * from public.undo_added_shopping_items(array['e1100000-0000-4000-8000-000000000011']::uuid[]) $$,
  $$ values ('e1100000-0000-4000-8000-000000000011'::uuid) $$,
  'a direct SQL call (no request method) works'
);
set local request.method to 'POST';
select is_empty(
  $$ select * from public.undo_added_shopping_items(array['e1100000-0000-4000-8000-000000000007']::uuid[]) $$,
  'a second Annulla of the same item removes nothing and gives no error'
);

-- ---------------------------------------------------------------------------
-- B2 (Paolo, Casa Bianchi): cannot undo what Giulia added
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select is_empty(
  $$ select * from public.undo_added_shopping_items(array['e1100000-0000-4000-8000-000000000005']::uuid[]) $$,
  'Paolo does not remove the item just added by Giulia'
);
select isnt_empty(
  $$ select 1 from public.shopping_items i where i.id = 'e1100000-0000-4000-8000-000000000005' $$,
  'the item of Giulia is still there (neither A nor Paolo removed it)'
);
select is_empty(
  $$ select * from public.undo_added_shopping_items(array['e1100000-0000-4000-8000-000000000012']::uuid[]) $$,
  'Paolo does not remove an item just added by Marco (Casa D''Angelo)'
);

-- ---------------------------------------------------------------------------
-- B (Giulia, Casa Bianchi)
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select is_empty(
  $$ select * from public.undo_added_shopping_items(array['e1100000-0000-4000-8000-000000000012']::uuid[]) $$,
  'Giulia does not remove an item just added by Marco (Casa D''Angelo)'
);
select is_empty(
  $$ select 1 from public.shopping_items i where i.household_id = '11111111-1111-4111-8111-111111111111' $$,
  'Giulia reads nothing of Casa D''Angelo'
);
select is_empty(
  $$ select * from public.undo_added_shopping_items(array['e1100000-0000-4000-8000-000000000008']::uuid[]) $$,
  'Giulia does not remove the item just added by Paolo'
);
select results_eq(
  $$ select * from public.undo_added_shopping_items(array['e1100000-0000-4000-8000-000000000005']::uuid[]) $$,
  $$ values ('e1100000-0000-4000-8000-000000000005'::uuid) $$,
  'Giulia removes the item she has just added'
);
select is_empty(
  $$ select 1 from public.shopping_items i where i.id = 'e1100000-0000-4000-8000-000000000005' $$,
  'the item of Giulia is gone'
);

-- A list with her own new item and one of Paolo: only hers is removed.
insert into public.shopping_items (name) values ('Carote');
select is(
  (select count(*)::integer from public.undo_added_shopping_items(array(
     select i.id from public.shopping_items i where i.name in ('Carote', 'Tè')))),
  1,
  'Giulia removes only her own new item from a list with one of Paolo'
);
select results_eq(
  $$ select i.name from public.shopping_items i where i.name in ('Carote', 'Tè') $$,
  $$ values ('Tè'::text) $$,
  'Carote is gone, the item of Paolo is still there'
);

-- ---------------------------------------------------------------------------
-- B2 (Paolo): undoes his own item
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select results_eq(
  $$ select * from public.undo_added_shopping_items(array['e1100000-0000-4000-8000-000000000008']::uuid[]) $$,
  $$ values ('e1100000-0000-4000-8000-000000000008'::uuid) $$,
  'Paolo removes the item he has just added'
);

-- ---------------------------------------------------------------------------
-- A (Marco) again: the item Giulia and Paolo tried to remove is still his
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select isnt_empty(
  $$ select 1 from public.shopping_items i where i.id = 'e1100000-0000-4000-8000-000000000012' $$,
  'the item of Marco is still there after the attempts of Casa Bianchi'
);

reset role;

-- ---------------------------------------------------------------------------
-- As the owner: what really happened
-- ---------------------------------------------------------------------------
select results_eq(
  $$ select i.id from public.shopping_items i
     where i.id in (
       'e1100000-0000-4000-8000-000000000001', 'e1100000-0000-4000-8000-000000000002',
       'e1100000-0000-4000-8000-000000000003', 'e1100000-0000-4000-8000-000000000004',
       'e1100000-0000-4000-8000-000000000005', 'e1100000-0000-4000-8000-000000000006',
       'e1100000-0000-4000-8000-000000000007', 'e1100000-0000-4000-8000-000000000008',
       'e1100000-0000-4000-8000-000000000009', 'e1100000-0000-4000-8000-000000000010',
       'e1100000-0000-4000-8000-000000000011', 'e1100000-0000-4000-8000-000000000012')
     order by i.id $$,
  $$ values ('e1100000-0000-4000-8000-000000000001'::uuid), ('e1100000-0000-4000-8000-000000000002'::uuid),
            ('e1100000-0000-4000-8000-000000000004'::uuid), ('e1100000-0000-4000-8000-000000000006'::uuid),
            ('e1100000-0000-4000-8000-000000000009'::uuid), ('e1100000-0000-4000-8000-000000000012'::uuid) $$,
  'only the items that met every condition were removed'
);
select is(
  (select count(*)::integer from public.shopping_items i
   where i.household_id = '22222222-2222-4222-8222-222222222222'),
  3,
  'the seed items of Casa Bianchi are untouched'
);
select is(
  (select count(*)::integer from public.shopping_items i
   where i.id in ('a3000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000002',
                  'a3000000-0000-4000-8000-000000000003', 'a3000000-0000-4000-8000-000000000004')),
  4,
  'the seed items of Casa D''Angelo are untouched'
);
select is_empty(
  $$ select 1 from private.removed_shopping_items r
     where r.id in ('e1100000-0000-4000-8000-000000000003', 'e1100000-0000-4000-8000-000000000005',
                    'e1100000-0000-4000-8000-000000000007', 'e1100000-0000-4000-8000-000000000008',
                    'e1100000-0000-4000-8000-000000000010', 'e1100000-0000-4000-8000-000000000011') $$,
  'no copy of the undone items is kept'
);

select * from finish();
rollback;
