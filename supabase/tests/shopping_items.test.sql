-- shopping_items: isolation, permissions, duplicates, strappo and Annulla (issue #62, for #21).
-- Seed ids: A = Marco (Casa D'Angelo), B = Giulia (Casa Bianchi, admin),
-- B2 = Paolo (Casa Bianchi, not admin), C = Chiara (no household).
-- Seed list: Casa D'Angelo to buy Latte (2 l), Pane, Mele (1 kg), taken Detersivo piatti;
-- Casa Bianchi to buy Yogurt, Biscotti, taken Caffè.
begin;
create extension if not exists pgtap with schema extensions;

select plan(98);

-- ---------------------------------------------------------------------------
-- Schema (CA-DB-1, CA-DB-2)
-- ---------------------------------------------------------------------------
select has_table('public', 'shopping_items', 'CA-DB-1: shopping_items exists');
select ok(
  (select c.relrowsecurity from pg_class c where c.oid = 'public.shopping_items'::regclass),
  'CA-DB-1: RLS enabled on shopping_items'
);
select columns_are(
  'public', 'shopping_items',
  array['id', 'household_id', 'name', 'quantity', 'added_by_member_id', 'checked_at', 'created_at', 'updated_at'],
  'CA-DB-1: shopping_items has exactly the planned columns (no "checked by")'
);
select fk_ok('public', 'shopping_items', 'household_id', 'public', 'households', 'id', 'household_id references households');
select fk_ok('public', 'shopping_items', 'added_by_member_id', 'public', 'household_members', 'id', 'added_by_member_id references household_members');
select has_index('public', 'shopping_items', 'shopping_items_household_created_idx', 'index on (household_id, created_at)');
select has_index('public', 'shopping_items', 'shopping_items_household_checked_idx', 'index on (household_id, checked_at)');
select has_index('public', 'shopping_items', 'shopping_items_added_by_member_id_idx', 'index on added_by_member_id');
select ok(
  exists (
    select 1 from pg_publication_tables p
    where p.pubname = 'supabase_realtime' and p.schemaname = 'public' and p.tablename = 'shopping_items'
  ),
  'CA-DB-2: shopping_items is in the supabase_realtime publication'
);
select is(
  (select c.relreplident::text from pg_class c where c.oid = 'public.shopping_items'::regclass),
  'd',
  'CA-DB-2: default replica identity (delete events carry only the id)'
);
select ok(
  not has_table_privilege('anon', 'public.shopping_items', 'select, insert, update, delete'),
  'CA-DB-3: anon has no privilege on shopping_items'
);
select ok(
  not has_column_privilege('authenticated', 'public.shopping_items', 'added_by_member_id', 'insert')
  and not has_column_privilege('authenticated', 'public.shopping_items', 'checked_at', 'insert')
  and not has_column_privilege('authenticated', 'public.shopping_items', 'created_at', 'insert'),
  'CA-DB-4: the app cannot insert author, check time or creation time'
);
select ok(
  has_column_privilege('authenticated', 'public.shopping_items', 'checked_at', 'update')
  and not has_column_privilege('authenticated', 'public.shopping_items', 'name', 'update')
  and not has_column_privilege('authenticated', 'public.shopping_items', 'quantity', 'update')
  and not has_column_privilege('authenticated', 'public.shopping_items', 'household_id', 'update'),
  'CA-DB-5: the app updates only checked_at'
);
select ok(
  not has_function_privilege('anon', 'public.clear_checked_shopping_items(uuid[])', 'execute')
  and not has_function_privilege('anon', 'public.restore_shopping_items(uuid[])', 'execute'),
  'CA-DB-3: anon cannot call the shopping list functions'
);
select ok(
  not has_table_privilege('authenticated', 'private.removed_shopping_items', 'select, insert, update, delete')
  and not has_table_privilege('anon', 'private.removed_shopping_items', 'select, insert, update, delete'),
  'CA-DB-16: the app has no privilege on the items kept for Annulla'
);
select ok(
  (select c.relrowsecurity from pg_class c where c.oid = 'private.removed_shopping_items'::regclass),
  'CA-DB-16: RLS enabled (no policy) on private.removed_shopping_items'
);
select ok(
  not has_function_privilege('authenticated', 'private.purge_removed_shopping_items()', 'execute'),
  'CA-DB-24: the app cannot call the cleanup directly'
);

-- ---------------------------------------------------------------------------
-- A (Marco) reads only the list of Casa D'Angelo (CA-DB-6)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';

select results_eq(
  $$ select i.name, i.quantity from public.shopping_items i where i.checked_at is null order by i.created_at, i.id $$,
  $$ values ('Latte', '2 l'), ('Pane', null::text), ('Mele', '1 kg') $$,
  'CA-DB-6: A reads the items to buy of Casa D''Angelo, oldest first'
);
select results_eq(
  $$ select i.name from public.shopping_items i where i.checked_at is not null $$,
  $$ values ('Detersivo piatti') $$,
  'CA-DB-6: A reads the taken items of Casa D''Angelo'
);
select is_empty(
  $$ select 1 from public.shopping_items i where i.household_id <> '11111111-1111-4111-8111-111111111111' $$,
  'CA-DB-7: A reads 0 items of other households'
);

-- ---------------------------------------------------------------------------
-- A adds items (CA-DB-8, CA-DB-9, CA-DB-10)
-- ---------------------------------------------------------------------------
select lives_ok(
  $$ insert into public.shopping_items (household_id, name)
     values ('11111111-1111-4111-8111-111111111111', E'   Basilico \t  fresco  ') $$,
  'CA-DB-8: A adds an item'
);
select results_eq(
  $$ select i.name, i.added_by_member_id, i.checked_at is null, i.household_id
     from public.shopping_items i where i.name like 'Basilico%' $$,
  $$ values ('Basilico fresco', 'a1000000-0000-4000-8000-000000000001'::uuid, true,
             '11111111-1111-4111-8111-111111111111'::uuid) $$,
  'CA-DB-8: name cleaned of spaces, author = A''s member, to buy'
);
select lives_ok(
  $$ insert into public.shopping_items (name, quantity) values ('Pomodori', '  2   kg ') $$,
  'CA-DB-8: household_id may be omitted (household of the caller)'
);
select results_eq(
  $$ select i.household_id, i.quantity from public.shopping_items i where i.name = 'Pomodori' $$,
  $$ values ('11111111-1111-4111-8111-111111111111'::uuid, '2 kg') $$,
  'CA-DB-8: omitted household_id becomes Casa D''Angelo, quantity cleaned'
);
select lives_ok(
  $$ insert into public.shopping_items (name, quantity) values ('Uova', '   ') $$,
  'blank quantity is accepted'
);
select is(
  (select i.quantity from public.shopping_items i where i.name = 'Uova'),
  null,
  'blank quantity is stored as null'
);
select lives_ok(
  $$ insert into public.shopping_items (name) values (repeat('x', 80)) $$,
  'CA-DB-9: 80 character name is accepted'
);
select throws_ok(
  $$ insert into public.shopping_items (name) values (repeat('y', 81)) $$,
  '23514', null,
  'CA-DB-9: 81 character name is refused'
);
select throws_ok(
  $$ insert into public.shopping_items (name) values ('   ') $$,
  '23514', null,
  'CA-DB-9: blank name is refused'
);
select throws_ok(
  $$ insert into public.shopping_items (name) values (null) $$,
  '23502', null,
  'CA-DB-9: missing name is refused'
);
select throws_ok(
  $$ insert into public.shopping_items (name, quantity) values ('Farina', repeat('1', 21)) $$,
  '23514', null,
  'CA-DB-9: 21 character quantity is refused'
);
select throws_ok(
  $$ insert into public.shopping_items (name, added_by_member_id)
     values ('Riso', 'a1000000-0000-4000-8000-000000000002') $$,
  '42501', null,
  'CA-DB-10: the app cannot choose the author'
);
select throws_ok(
  $$ insert into public.shopping_items (name, added_by_member_id)
     values ('Riso', 'b1000000-0000-4000-8000-000000000001') $$,
  '42501', null,
  'CA-DB-10: the app cannot set an author of another household'
);
select throws_ok(
  $$ insert into public.shopping_items (name, checked_at) values ('Riso', now()) $$,
  '42501', null,
  'CA-DB-10: the app cannot insert a taken item'
);
select throws_ok(
  $$ insert into public.shopping_items (name, created_at) values ('Riso', now() - interval '1 year') $$,
  '42501', null,
  'CA-DB-10: the app cannot choose the creation time'
);

-- ---------------------------------------------------------------------------
-- No duplicates among the items to buy (CA-DB-11)
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.shopping_items (name) values ('latte') $$,
  '23505', 'shopping item already to buy',
  'CA-DB-11: "latte" refused while "Latte" is to buy'
);
select throws_ok(
  $$ insert into public.shopping_items (name) values ('  LATTE ') $$,
  '23505', 'shopping item already to buy',
  'CA-DB-11: case and spaces are ignored'
);
select throws_ok(
  $$ insert into public.shopping_items (name) values ('Zucchine'), ('zucchine') $$,
  '23505', 'shopping item already to buy',
  'CA-DB-11: duplicates inside the same insert are refused'
);
select lives_ok(
  $$ insert into public.shopping_items (name) values ('detersivo piatti') $$,
  'CA-DB-11: a name that is only among the taken items is added'
);
select is(
  (select count(*)::integer from public.shopping_items i where lower(i.name) = 'latte'),
  1,
  'CA-DB-11: still one Latte'
);

-- ---------------------------------------------------------------------------
-- Check and uncheck (CA-DB-12, CA-DB-13)
-- ---------------------------------------------------------------------------
select results_eq(
  $$ update public.shopping_items set checked_at = '2000-01-01T00:00:00Z'
     where id = 'a3000000-0000-4000-8000-000000000002' returning checked_at $$,
  $$ values (now()) $$,
  'CA-DB-12: A checks Pane, the check time is the server time'
);
-- Detersivo piatti was taken yesterday (seed): checking it again keeps that time.
select set_config(
  'test.detersivo_checked_at',
  (select i.checked_at::text from public.shopping_items i where i.id = 'a3000000-0000-4000-8000-000000000004'),
  true
);
select ok(
  current_setting('test.detersivo_checked_at')::timestamptz < now() - interval '23 hours',
  'CA-DB-12: Detersivo piatti was taken yesterday'
);
select results_eq(
  $$ update public.shopping_items set checked_at = now()
     where id = 'a3000000-0000-4000-8000-000000000004' returning checked_at $$,
  $$ values (current_setting('test.detersivo_checked_at')::timestamptz) $$,
  'CA-DB-12: checking again an item already taken keeps the first check time'
);
select throws_ok(
  $$ update public.shopping_items set name = 'Pane integrale' where id = 'a3000000-0000-4000-8000-000000000002' $$,
  '42501', null,
  'CA-DB-12: the name cannot be changed'
);
select throws_ok(
  $$ update public.shopping_items set quantity = '3' where id = 'a3000000-0000-4000-8000-000000000002' $$,
  '42501', null,
  'CA-DB-12: the quantity cannot be changed'
);
select throws_ok(
  $$ update public.shopping_items set household_id = '22222222-2222-4222-8222-222222222222'
     where id = 'a3000000-0000-4000-8000-000000000002' $$,
  '42501', null,
  'CA-DB-12: an item cannot be moved to another household'
);
-- Latte taken, a new Latte added, then the old one put back: never refused.
select lives_ok(
  $$ update public.shopping_items set checked_at = now() where id = 'a3000000-0000-4000-8000-000000000001' $$,
  'CA-DB-13: A checks Latte'
);
select lives_ok(
  $$ insert into public.shopping_items (name) values ('Latte') $$,
  'CA-DB-13: Latte can be added again once taken'
);
select lives_ok(
  $$ update public.shopping_items set checked_at = null where id = 'a3000000-0000-4000-8000-000000000001' $$,
  'CA-DB-13: "Rimetti in lista" of the old Latte is not refused'
);
select results_eq(
  $$ select i.name from public.shopping_items i where i.checked_at is null order by i.created_at, i.id limit 2 $$,
  $$ values ('Latte'), ('Mele') $$,
  'CA-DB-13: the unchecked item is back in its original place'
);

-- ---------------------------------------------------------------------------
-- Delete only taken items (CA-DB-14)
-- ---------------------------------------------------------------------------
select is_empty(
  $$ delete from public.shopping_items where id = 'a3000000-0000-4000-8000-000000000003' returning id $$,
  'CA-DB-14: an item to buy cannot be deleted (0 rows)'
);
select ok(
  exists (select 1 from public.shopping_items i where i.id = 'a3000000-0000-4000-8000-000000000003'),
  'CA-DB-14: Mele is still there'
);

-- ---------------------------------------------------------------------------
-- Strappo and Annulla (CA-DB-15, CA-DB-16, CA-DB-17)
-- Taken now: Detersivo piatti (yesterday) and Pane (now).
-- ---------------------------------------------------------------------------
select set_config(
  'test.taken',
  (select jsonb_agg(to_jsonb(i) order by i.checked_at desc, i.id)::text
   from public.shopping_items i where i.checked_at is not null),
  true
);
select throws_ok(
  $$ select * from public.clear_checked_shopping_items(array[
       'a3000000-0000-4000-8000-000000000002',
       'a3000000-0000-4000-8000-000000000003'
     ]::uuid[]) $$,
  'P0001', null,
  'CA-DB-15: strappo with an item to buy removes nothing'
);
select is(
  (select count(*)::integer from public.shopping_items i where i.checked_at is not null),
  2,
  'CA-DB-15: both taken items are still there after the refused strappo'
);
select results_eq(
  $$ select r.name from public.clear_checked_shopping_items(array[
       'a3000000-0000-4000-8000-000000000004',
       'a3000000-0000-4000-8000-000000000002'
     ]::uuid[]) r $$,
  $$ values ('Pane'), ('Detersivo piatti') $$,
  'CA-DB-15: strappo returns the removed items, last taken first'
);
select is_empty(
  $$ select 1 from public.shopping_items i where i.checked_at is not null $$,
  'CA-DB-15: no taken item left'
);
select throws_ok(
  $$ select * from private.removed_shopping_items $$,
  '42501', null,
  'CA-DB-16: the app cannot read the items kept for Annulla'
);
select results_eq(
  $$ select r.name from public.restore_shopping_items(array[
       'a3000000-0000-4000-8000-000000000002',
       'a3000000-0000-4000-8000-000000000004'
     ]::uuid[]) r $$,
  $$ values ('Pane'), ('Detersivo piatti') $$,
  'CA-DB-16: Annulla puts back the 2 items, last taken first'
);
select results_eq(
  $$ select to_jsonb(i) - 'updated_at' from public.shopping_items i
     where i.checked_at is not null order by i.checked_at desc, i.id $$,
  $$ select e - 'updated_at' from jsonb_array_elements(current_setting('test.taken')::jsonb) e $$,
  'CA-DB-16: restored items keep id, name, quantity, author, household and times'
);
select throws_ok(
  $$ select * from public.restore_shopping_items(array['a3000000-0000-4000-8000-000000000002']::uuid[]) $$,
  'P0001', 'some items cannot be restored',
  'CA-DB-17: double Annulla is refused'
);
select throws_ok(
  $$ select * from public.restore_shopping_items(array['a3000000-0000-4000-8000-000000000003']::uuid[]) $$,
  'P0001', 'some items cannot be restored',
  'CA-DB-17: an item never removed (Mele, to buy) cannot be restored'
);
select throws_ok(
  $$ select * from public.restore_shopping_items(array[gen_random_uuid()]) $$,
  'P0001', 'some items cannot be restored',
  'CA-DB-17: an unknown id cannot be restored'
);

-- Pane removed again: kept for Annulla.
select results_eq(
  $$ select r.name from public.clear_checked_shopping_items(array['a3000000-0000-4000-8000-000000000002']::uuid[]) r $$,
  $$ values ('Pane') $$,
  'CA-DB-15: A removes Pane again'
);
select throws_ok(
  $$ select * from public.restore_shopping_items(array[
       'a3000000-0000-4000-8000-000000000002'::uuid, gen_random_uuid()
     ]) $$,
  'P0001', 'some items cannot be restored',
  'CA-DB-17: Annulla is all or none (one valid id, one unknown)'
);
select is_empty(
  $$ select 1 from public.shopping_items i where i.id = 'a3000000-0000-4000-8000-000000000002' $$,
  'CA-DB-17: after the refused Annulla, Pane is not back'
);

-- ---------------------------------------------------------------------------
-- B (Giulia) cannot see or touch Casa D'Angelo (CA-DB-7, CA-DB-18)
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';

select results_eq(
  $$ select i.name from public.shopping_items i order by i.created_at, i.id $$,
  $$ values ('Yogurt'), ('Biscotti'), ('Caffè') $$,
  'CA-DB-7: B reads only the list of Casa Bianchi'
);
select is_empty(
  $$ select 1 from public.shopping_items i where i.household_id = '11111111-1111-4111-8111-111111111111' $$,
  'CA-DB-7: B reads 0 items of Casa D''Angelo'
);
select throws_ok(
  $$ insert into public.shopping_items (household_id, name) values ('11111111-1111-4111-8111-111111111111', 'Latte') $$,
  '42501', null,
  'CA-DB-18: B cannot add to Casa D''Angelo (permission error, not duplicate: nothing leaks)'
);
select throws_ok(
  $$ insert into public.shopping_items (household_id, name) values ('11111111-1111-4111-8111-111111111111', 'Cioccolato') $$,
  '42501', null,
  'CA-DB-18: B cannot add any item to Casa D''Angelo'
);
select is_empty(
  $$ update public.shopping_items set checked_at = now()
     where household_id = '11111111-1111-4111-8111-111111111111' returning id $$,
  'CA-DB-18: B checks 0 items of Casa D''Angelo'
);
select is_empty(
  $$ update public.shopping_items set checked_at = null
     where id = 'a3000000-0000-4000-8000-000000000004' returning id $$,
  'CA-DB-18: B unchecks 0 items of Casa D''Angelo'
);
select is_empty(
  $$ delete from public.shopping_items
     where household_id = '11111111-1111-4111-8111-111111111111' returning id $$,
  'CA-DB-18: B deletes 0 items of Casa D''Angelo'
);
select throws_ok(
  $$ select * from public.clear_checked_shopping_items(array['a3000000-0000-4000-8000-000000000004']::uuid[]) $$,
  'P0001', null,
  'CA-DB-18: B cannot strappare items of Casa D''Angelo'
);
select throws_ok(
  $$ select * from public.restore_shopping_items(array['a3000000-0000-4000-8000-000000000002']::uuid[]) $$,
  'P0001', 'some items cannot be restored',
  'CA-DB-18: B cannot restore an item removed from Casa D''Angelo...'
);
select throws_ok(
  $$ select * from public.restore_shopping_items(array[gen_random_uuid()]) $$,
  'P0001', 'some items cannot be restored',
  'CA-DB-18: ...and gets the same answer as for an unknown id'
);
select lives_ok(
  $$ insert into public.shopping_items (name) values ('Latte') $$,
  'CA-DB-11: the same name in another household is not a duplicate'
);

-- B2 (Paolo, not admin) has the same rights in his household.
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';

select lives_ok(
  $$ update public.shopping_items set checked_at = now() where id = 'b3000000-0000-4000-8000-000000000001' $$,
  'CA-DB-19: B2 (not admin) checks Yogurt'
);
select results_eq(
  $$ select r.name from public.clear_checked_shopping_items(array[
       'b3000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000003'
     ]::uuid[]) r $$,
  $$ values ('Yogurt'), ('Caffè') $$,
  'CA-DB-19: B2 (not admin) removes the taken items'
);

-- ---------------------------------------------------------------------------
-- C without household reads and writes nothing (CA-DB-20)
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}';

select is_empty($$ select 1 from public.shopping_items $$, 'CA-DB-20: C reads 0 items');
select throws_ok(
  $$ insert into public.shopping_items (name) values ('Pane') $$,
  '42501', null,
  'CA-DB-20: C cannot add an item'
);
select throws_ok(
  $$ select * from public.restore_shopping_items(array['a3000000-0000-4000-8000-000000000002']::uuid[]) $$,
  '42501', null,
  'CA-DB-20: C cannot call Annulla'
);
select throws_ok(
  $$ select * from public.clear_checked_shopping_items(array['a3000000-0000-4000-8000-000000000004']::uuid[]) $$,
  '42501', null,
  'CA-DB-20: C cannot call the strappo'
);

-- ---------------------------------------------------------------------------
-- Anonymous users have no access (CA-DB-3)
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';

select throws_ok($$ select 1 from public.shopping_items $$, '42501', null, 'CA-DB-3: anon cannot read');
select throws_ok(
  $$ insert into public.shopping_items (household_id, name) values ('11111111-1111-4111-8111-111111111111', 'Pane') $$,
  '42501', null,
  'CA-DB-3: anon cannot insert'
);
select throws_ok(
  $$ select * from public.clear_checked_shopping_items(array['a3000000-0000-4000-8000-000000000004']::uuid[]) $$,
  '42501', null,
  'CA-DB-3: anon cannot call the strappo'
);

-- ---------------------------------------------------------------------------
-- Checks as the database owner (CA-DB-7, CA-DB-21, CA-DB-22)
-- ---------------------------------------------------------------------------
reset role;

select results_eq(
  $$ select i.name from public.shopping_items i
     where i.household_id = '11111111-1111-4111-8111-111111111111' and i.checked_at is not null
     order by i.checked_at desc $$,
  $$ values ('Detersivo piatti') $$,
  'CA-DB-18: the taken items of Casa D''Angelo survived every attempt of B'
);
select results_eq(
  $$ select r.id, r.household_id from private.removed_shopping_items r order by r.id $$,
  $$ values
       ('a3000000-0000-4000-8000-000000000002'::uuid, '11111111-1111-4111-8111-111111111111'::uuid),
       ('b3000000-0000-4000-8000-000000000001'::uuid, '22222222-2222-4222-8222-222222222222'::uuid),
       ('b3000000-0000-4000-8000-000000000003'::uuid, '22222222-2222-4222-8222-222222222222'::uuid) $$,
  'CA-DB-16: the removed items are kept server side with their household (Pane not taken by B)'
);

-- ---------------------------------------------------------------------------
-- Annulla window and cleanup (CA-DB-23, CA-DB-24)
-- ---------------------------------------------------------------------------
select is(
  private.shopping_items_undo_window(),
  interval '10 minutes',
  'CA-DB-23: the Annulla window is 10 minutes'
);
update private.removed_shopping_items
set removed_at = now() - interval '11 minutes'
where id = 'a3000000-0000-4000-8000-000000000002';

set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select * from public.restore_shopping_items(array['a3000000-0000-4000-8000-000000000002']::uuid[]) $$,
  'P0001', 'some items cannot be restored',
  'CA-DB-23: after the window Pane cannot be restored'
);
select lives_ok(
  $$ insert into public.shopping_items (name) values ('Sale') $$,
  'CA-DB-24: any change of a shopping list...'
);
reset role;
select results_eq(
  $$ select r.id from private.removed_shopping_items r order by r.id $$,
  $$ values ('b3000000-0000-4000-8000-000000000001'::uuid), ('b3000000-0000-4000-8000-000000000003'::uuid) $$,
  'CA-DB-24: ...deletes the expired removed items (Pane), and keeps the recent ones'
);
update private.removed_shopping_items
set removed_at = now() - interval '25 hours'
where id = 'b3000000-0000-4000-8000-000000000001';
select lives_ok(
  $$ select private.purge_removed_shopping_items() $$,
  'CA-DB-24: cleanup runs'
);
select results_eq(
  $$ select r.id from private.removed_shopping_items r $$,
  $$ values ('b3000000-0000-4000-8000-000000000003'::uuid) $$,
  'CA-DB-24: nothing older than the window is kept'
);
select is(
  (select count(*)::integer from public.shopping_items i where i.household_id = '22222222-2222-4222-8222-222222222222'),
  2,
  'Casa Bianchi has Biscotti and Latte left'
);
select throws_ok(
  $$ insert into public.shopping_items (household_id, name, added_by_member_id)
     values ('11111111-1111-4111-8111-111111111111', 'Sale', 'b1000000-0000-4000-8000-000000000001') $$,
  '23514', null,
  'CA-DB-10: the author must belong to the household (also for the seed)'
);

-- CA-DB-21: the author leaves the household, the item stays without author.
delete from public.household_members where id = 'b1000000-0000-4000-8000-000000000001';
select results_eq(
  $$ select i.name, i.added_by_member_id from public.shopping_items i
     where i.household_id = '22222222-2222-4222-8222-222222222222' and i.name = 'Biscotti' $$,
  $$ values ('Biscotti', null::uuid) $$,
  'CA-DB-21: the item of a member who left stays, without author'
);

-- CA-DB-22: when a household is deleted its list is deleted too.
delete from public.households where id = '22222222-2222-4222-8222-222222222222';
select is_empty(
  $$ select 1 from public.shopping_items i where i.household_id = '22222222-2222-4222-8222-222222222222' $$,
  'CA-DB-22: the list of a deleted household is deleted'
);
select is_empty(
  $$ select 1 from private.removed_shopping_items r where r.household_id = '22222222-2222-4222-8222-222222222222' $$,
  'CA-DB-22: the items kept for Annulla of a deleted household are deleted'
);

select * from finish();
rollback;
