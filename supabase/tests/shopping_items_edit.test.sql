-- Shopping list after #337 (for #335 and #333): name and quantity can be changed (with
-- the duplicate rule), every thing of the household can be deleted, several people per
-- thing (shopping_item_assignees), the write functions add_shopping_items() and
-- update_shopping_item(), and the strappo keeps the people for «Annulla» (#335 CA-31).
-- Isolation between households in both directions, anon, the administrative key.
-- Seed ids: A = Marco (Casa D'Angelo, user aaaaaaaa…01, member a1…01), B = Giulia (Casa
-- Bianchi, bbbbbbbb…01, b1…01), B2 = Paolo (bbbbbbbb…02, b1…02). Members of Casa D'Angelo:
-- Marco a1…01, Laura a1…02, Sofia a1…03, Tommaso a1…04, Biscotto a1…05 (pet).
-- Seed list: Casa D'Angelo to buy Latte a3…01 (2 l), Pane a3…02, Mele a3…03 (1 kg), taken
-- Detersivo piatti a3…04; Casa Bianchi to buy Yogurt b3…01, Biscotti b3…02, taken Caffè b3…03.
begin;
create extension if not exists pgtap with schema extensions;

select plan(74);

-- ---------------------------------------------------------------------------
-- Schema and privileges
-- ---------------------------------------------------------------------------
select has_table('public', 'shopping_item_assignees', 'shopping_item_assignees exists');
select ok(
  (select c.relrowsecurity from pg_class c where c.oid = 'public.shopping_item_assignees'::regclass),
  'RLS enabled on shopping_item_assignees'
);
select col_is_pk('public', 'shopping_item_assignees', array['shopping_item_id', 'member_id'], 'one row per thing and person');
select fk_ok(
  'public', 'shopping_item_assignees', array['shopping_item_id', 'household_id'],
  'public', 'shopping_items', array['id', 'household_id'],
  'the thing belongs to the same household'
);
select fk_ok(
  'public', 'shopping_item_assignees', array['member_id', 'household_id'],
  'public', 'household_members', array['id', 'household_id'],
  'the person is a member of the same household'
);
select is(
  (select array_agg(k.confdeltype::text order by k.conname)
   from pg_constraint k
   where k.conrelid = 'public.shopping_item_assignees'::regclass and k.contype = 'f'),
  array['c', 'c', 'c'],
  'household, thing and person: on delete cascade'
);
select has_index('public', 'shopping_item_assignees', 'shopping_item_assignees_member_id_idx', 'index on the person');
select has_index('public', 'shopping_item_assignees', 'shopping_item_assignees_household_id_idx', 'index on the household');
select has_column('private', 'removed_shopping_items', 'assignee_member_ids', 'the strappo keeps the people');
select ok(
  not exists (
    select 1 from pg_publication_tables p
    where p.pubname = 'supabase_realtime' and p.tablename = 'shopping_item_assignees'
  ),
  'the link table is not sent by Realtime (its changes arrive as an UPDATE of the item)'
);
select ok(
  not has_table_privilege('anon', 'public.shopping_item_assignees', 'select, insert, update, delete')
  and has_table_privilege('authenticated', 'public.shopping_item_assignees', 'select')
  and has_table_privilege('authenticated', 'public.shopping_item_assignees', 'delete')
  and has_column_privilege('authenticated', 'public.shopping_item_assignees', 'shopping_item_id', 'insert')
  and not has_column_privilege('authenticated', 'public.shopping_item_assignees', 'created_at', 'insert')
  and not has_any_column_privilege('authenticated', 'public.shopping_item_assignees', 'update'),
  'anon nothing; the app reads, adds (never the time) and removes people'
);
select ok(
  (select p.prosecdef from pg_proc p where p.oid = 'public.add_shopping_items(jsonb, uuid[])'::regprocedure)
  and not (select p.prosecdef from pg_proc p where p.oid = 'public.update_shopping_item(uuid, text, text, uuid[])'::regprocedure)
  and not has_function_privilege('anon', 'public.add_shopping_items(jsonb, uuid[])', 'execute')
  and not has_function_privilege('anon', 'public.update_shopping_item(uuid, text, text, uuid[])', 'execute')
  and has_function_privilege('authenticated', 'public.add_shopping_items(jsonb, uuid[])', 'execute')
  and has_function_privilege('authenticated', 'public.update_shopping_item(uuid, text, text, uuid[])', 'execute')
  and not has_function_privilege('authenticated', 'private.shopping_item_assignees_touch_item()', 'execute'),
  'add_shopping_items is security definer, update_shopping_item runs as the caller; signed-in users only'
);

-- ---------------------------------------------------------------------------
-- Marco (A): name and quantity
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';

select throws_ok(
  $$ update public.shopping_items set name = 'latte' where id = 'a3000000-0000-4000-8000-000000000002' $$,
  '23505', null,
  'Pane cannot be renamed like Latte, another thing to buy (ignoring case)'
);
select lives_ok(
  $$ update public.shopping_items set name = 'LATTE' where id = 'a3000000-0000-4000-8000-000000000001' $$,
  'changing only upper and lower case is accepted'
);
select lives_ok(
  $$ update public.shopping_items set name = 'detersivo piatti' where id = 'a3000000-0000-4000-8000-000000000002' $$,
  'a name present only among the taken things is accepted'
);
select results_eq(
  $$ select i.name, i.quantity from public.shopping_items i where i.checked_at is null order by i.created_at, i.id $$,
  $$ values ('LATTE'::text, '2 l'::text), ('detersivo piatti', null), ('Mele', '1 kg') $$,
  'the list keeps its order with the new names'
);
select lives_ok(
  $$ update public.shopping_items set checked_at = null where id = 'a3000000-0000-4000-8000-000000000004' $$,
  '«Rimetti in lista» of Detersivo piatti is never refused, also with the same name to buy'
);
select throws_ok(
  $$ update public.shopping_items set name = repeat('x', 81) where id = 'a3000000-0000-4000-8000-000000000003' $$,
  '23514', null,
  'a name longer than 80 characters is refused'
);
select throws_ok(
  $$ update public.shopping_items set quantity = repeat('1', 21) where id = 'a3000000-0000-4000-8000-000000000003' $$,
  '23514', null,
  'a quantity longer than 20 characters is refused'
);
select throws_ok(
  $$ update public.shopping_items set added_by_member_id = 'a1000000-0000-4000-8000-000000000002' where id = 'a3000000-0000-4000-8000-000000000003' $$,
  '42501', null,
  'the author still cannot be changed'
);

-- ---------------------------------------------------------------------------
-- update_shopping_item
-- ---------------------------------------------------------------------------
select lives_ok(
  $$ select public.update_shopping_item('a3000000-0000-4000-8000-000000000003', '  Mele   rosse ', ' 2 kg ',
       array['a1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000003']::uuid[]) $$,
  'Marco renames Mele, changes the quantity and gives it to Laura and Sofia'
);
select results_eq(
  $$ select i.name, i.quantity,
            (select array_agg(a.member_id order by a.member_id) from public.shopping_item_assignees a where a.shopping_item_id = i.id)
     from public.shopping_items i where i.id = 'a3000000-0000-4000-8000-000000000003' $$,
  $$ values ('Mele rosse'::text, '2 kg'::text,
             array['a1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000003']::uuid[]) $$,
  'name and quantity normalised, two people'
);
select lives_ok(
  $$ select set_config('test.mele_ctid', (select i.ctid::text from public.shopping_items i where i.id = 'a3000000-0000-4000-8000-000000000003'), true) $$,
  'position of the row of Mele before a change of people'
);
select lives_ok(
  $$ select public.update_shopping_item('a3000000-0000-4000-8000-000000000003', 'Mele rosse', '', array['a1000000-0000-4000-8000-000000000003']::uuid[]) $$,
  'Marco keeps only Sofia and empties the quantity'
);
select results_eq(
  $$ select i.quantity, (select array_agg(a.member_id) from public.shopping_item_assignees a where a.shopping_item_id = i.id)
     from public.shopping_items i where i.id = 'a3000000-0000-4000-8000-000000000003' $$,
  $$ values (null::text, array['a1000000-0000-4000-8000-000000000003']::uuid[]) $$,
  'no quantity, only Sofia'
);
select lives_ok(
  $$ select set_config('test.mele_ctid', (select i.ctid::text from public.shopping_items i where i.id = 'a3000000-0000-4000-8000-000000000003'), true) $$,
  'position of the row of Mele again'
);
select lives_ok(
  $$ insert into public.shopping_item_assignees (shopping_item_id, member_id)
     values ('a3000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000004') $$,
  'Marco adds Tommaso directly'
);
select isnt(
  (select i.ctid::text from public.shopping_items i where i.id = 'a3000000-0000-4000-8000-000000000003'),
  current_setting('test.mele_ctid'),
  'a change of the people touches the item (Realtime UPDATE for the other members)'
);
select throws_ok(
  $$ select public.update_shopping_item('a3000000-0000-4000-8000-000000000003', 'Mele rosse', null,
       array['a1000000-0000-4000-8000-000000000005']::uuid[]) $$,
  '23514', null,
  'a pet never takes care of a thing to buy'
);
select throws_ok(
  $$ select public.update_shopping_item('a3000000-0000-4000-8000-000000000003', 'Mele rosse', null,
       array['b1000000-0000-4000-8000-000000000001']::uuid[]) $$,
  '23514', null,
  'a member of another household is refused like an unknown one'
);
select throws_ok(
  $$ select public.update_shopping_item('a3000000-0000-4000-8000-000000000003', 'Latte', null, array[]::uuid[]) $$,
  '23505', null,
  'renaming like another thing to buy is refused'
);
select results_eq(
  $$ select i.name, (select count(*)::integer from public.shopping_item_assignees a where a.shopping_item_id = i.id)
     from public.shopping_items i where i.id = 'a3000000-0000-4000-8000-000000000003' $$,
  $$ values ('Mele rosse'::text, 2) $$,
  'after the refused changes nothing changed (one transaction)'
);
select throws_ok(
  $$ select public.update_shopping_item('b3000000-0000-4000-8000-000000000001', 'Intrusione', null, array[]::uuid[]) $$,
  'P0002', null,
  'a thing of Casa Bianchi is not found'
);
select throws_ok(
  $$ select public.update_shopping_item(gen_random_uuid(), 'Nessuna', null, array[]::uuid[]) $$,
  'P0002', null,
  'an unknown thing gives the same error'
);
select throws_ok(
  $$ select public.update_shopping_item('a3000000-0000-4000-8000-000000000003', 'Mele rosse', null, null) $$,
  '22023', null,
  'a null list of people is refused'
);

-- ---------------------------------------------------------------------------
-- Delete (#335): also the things to buy, only in the own household
-- ---------------------------------------------------------------------------
select results_eq(
  $$ delete from public.shopping_items where id = 'a3000000-0000-4000-8000-000000000002' returning name $$,
  $$ values ('detersivo piatti'::text) $$,
  'Marco deletes a thing still to buy'
);

-- ---------------------------------------------------------------------------
-- add_shopping_items
-- ---------------------------------------------------------------------------
select results_eq(
  $$ select count(*)::integer from public.add_shopping_items(
       '[{"name":"Uova","quantity":"6"},{"name":"  Pomodori "},{"name":"latte"},{"name":"Zucchine","quantity":null},{"name":"pomodori"}]'::jsonb,
       array['a1000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000001']::uuid[]
     ) $$,
  $$ values (3) $$,
  'five things, two already to buy (Latte; Pomodori twice): three saved'
);
select results_eq(
  $$ select i.name, i.quantity, i.added_by_member_id from public.shopping_items i
     where i.created_at = now() and i.checked_at is null order by i.created_at, i.id $$,
  $$ values ('Uova'::text, '6'::text, 'a1000000-0000-4000-8000-000000000001'::uuid),
            ('Pomodori', null, 'a1000000-0000-4000-8000-000000000001'),
            ('Zucchine', null, 'a1000000-0000-4000-8000-000000000001') $$,
  'saved in the order of the phrase (created_at, id), normalised, added by Marco'
);
select results_eq(
  $$ select i.name, array_agg(a.member_id order by a.member_id)
     from public.shopping_items i join public.shopping_item_assignees a on a.shopping_item_id = i.id
     where i.name in ('Uova', 'Pomodori', 'Zucchine') group by i.name order by i.name $$,
  $$ values ('Pomodori'::text, array['a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000004']::uuid[]),
            ('Uova', array['a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000004']::uuid[]),
            ('Zucchine', array['a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000004']::uuid[]) $$,
  'every saved thing has the same people'
);
select lives_ok(
  $$ select set_config('test.added', (select string_agg(x::text, ',') from public.add_shopping_items(
       '[{"name":"Farina"},{"name":"Riso"}]'::jsonb, array['a1000000-0000-4000-8000-000000000003']::uuid[]
     ) as x), true) $$,
  'Marco adds Farina and Riso for Sofia'
);
select results_eq(
  $$ select i.name from unnest(string_to_array(current_setting('test.added'), ',')::uuid[]) with ordinality as x (id, n)
     join public.shopping_items i on i.id = x.id order by x.n $$,
  $$ values ('Farina'::text), ('Riso'::text) $$,
  'the ids come back in the order of the phrase'
);
select results_eq(
  $$ select x from public.undo_added_shopping_items(string_to_array(current_setting('test.added'), ',')::uuid[]) as x order by x $$,
  $$ select x from unnest(string_to_array(current_setting('test.added'), ',')::uuid[]) as x order by x $$,
  '«Annulla» after the addition deletes them'
);
select is_empty(
  $$ select 1 from public.shopping_item_assignees a
     where a.shopping_item_id = any (string_to_array(current_setting('test.added'), ',')::uuid[]) $$,
  'their people went with them'
);
select throws_ok(
  $$ select * from public.add_shopping_items('[{"name":"Latte"}]'::jsonb, array['a1000000-0000-4000-8000-000000000005']::uuid[]) $$,
  '23514', null,
  'a pet is refused, even when every thing is already to buy'
);
select throws_ok(
  $$ select * from public.add_shopping_items('[]'::jsonb) $$,
  '22023', null,
  'an empty list is refused'
);
select throws_ok(
  $$ select * from public.add_shopping_items('[{"quantity":"1"}]'::jsonb) $$,
  '22023', null,
  'a thing without name is refused'
);
select throws_ok(
  $$ select * from public.add_shopping_items('{"name":"Pane"}'::jsonb) $$,
  '22023', null,
  'something that is not a list is refused'
);
select throws_ok(
  $$ select * from public.add_shopping_items('[{"name":"   "}]'::jsonb) $$,
  '23514', null,
  'a blank name is refused by the table'
);
set local request.method to 'GET';
select throws_ok(
  $$ select * from public.add_shopping_items('[{"name":"Sale"}]'::jsonb) $$,
  'P0001', 'use POST',
  'GET is refused'
);
set local request.method to 'POST';
reset role;
select is(
  (select count(*)::integer from private.shopping_additions s
   where s.member_id = 'a1000000-0000-4000-8000-000000000001' and s.created_at = now()),
  5,
  'every thing saved by the function counts for the shopping notification of 19:00'
);
set local role authenticated;

-- ---------------------------------------------------------------------------
-- Strappo and «Annulla» keep the people (#335 CA-31)
-- ---------------------------------------------------------------------------
select lives_ok(
  $$ update public.shopping_items set checked_at = now()
     where id in ('a3000000-0000-4000-8000-000000000003', 'a3000000-0000-4000-8000-000000000001') $$,
  'Marco takes Mele rosse (Sofia, Tommaso) and LATTE (nobody)'
);
select results_eq(
  $$ select r.name from public.clear_checked_shopping_items(array[
       'a3000000-0000-4000-8000-000000000003', 'a3000000-0000-4000-8000-000000000001']::uuid[]) r order by r.name $$,
  $$ values ('LATTE'::text), ('Mele rosse'::text) $$,
  'strappo of the two'
);
reset role;
select results_eq(
  $$ select r.id, r.assignee_member_ids from private.removed_shopping_items r order by r.id $$,
  $$ values ('a3000000-0000-4000-8000-000000000001'::uuid, array[]::uuid[]),
            ('a3000000-0000-4000-8000-000000000003', array['a1000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000004']::uuid[]) $$,
  'the removed items keep their people, in order (nobody for LATTE)'
);
select lives_ok(
  $$ delete from public.household_members where id = 'a1000000-0000-4000-8000-000000000004' $$,
  'Tommaso is removed from the household in the meantime'
);
set local role authenticated;
select results_eq(
  $$ select r.name from public.restore_shopping_items(array[
       'a3000000-0000-4000-8000-000000000003', 'a3000000-0000-4000-8000-000000000001']::uuid[]) r $$,
  $$ values ('LATTE'::text), ('Mele rosse'::text) $$,
  '«Annulla» of the strappo puts them back'
);
select results_eq(
  $$ select i.name, i.checked_at is not null,
            (select array_agg(a.member_id) from public.shopping_item_assignees a where a.shopping_item_id = i.id)
     from public.shopping_items i
     where i.id in ('a3000000-0000-4000-8000-000000000003', 'a3000000-0000-4000-8000-000000000001') order by i.name $$,
  $$ values ('LATTE'::text, true, null::uuid[]),
            ('Mele rosse', true, array['a1000000-0000-4000-8000-000000000003']::uuid[]) $$,
  'Mele rosse is back with Sofia (Tommaso has left), LATTE with nobody'
);

-- ---------------------------------------------------------------------------
-- Isolation: Giulia (B)
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select is_empty(
  $$ select 1 from public.shopping_item_assignees a $$,
  'Giulia reads no people of Casa D''Angelo'
);
select is_empty(
  $$ update public.shopping_items set name = 'Intrusione' where household_id = '11111111-1111-4111-8111-111111111111' returning id $$,
  'Giulia renames 0 things of Casa D''Angelo'
);
select is_empty(
  $$ update public.shopping_items set quantity = '99' where household_id = '11111111-1111-4111-8111-111111111111' returning id $$,
  'Giulia changes the quantity of 0 things of Casa D''Angelo'
);
select is_empty(
  $$ delete from public.shopping_items where household_id = '11111111-1111-4111-8111-111111111111' and checked_at is null returning id $$,
  'Giulia deletes 0 things to buy of Casa D''Angelo'
);
select is_empty(
  $$ delete from public.shopping_items where household_id = '11111111-1111-4111-8111-111111111111' and checked_at is not null returning id $$,
  'Giulia deletes 0 taken things of Casa D''Angelo'
);
select is_empty(
  $$ delete from public.shopping_item_assignees where household_id = '11111111-1111-4111-8111-111111111111' returning member_id $$,
  'Giulia removes 0 people of Casa D''Angelo'
);
select throws_ok(
  $$ insert into public.shopping_item_assignees (shopping_item_id, member_id, household_id)
     values ('a3000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111') $$,
  '42501', null,
  'Giulia cannot add people to Casa D''Angelo'
);
select throws_ok(
  $$ insert into public.shopping_item_assignees (shopping_item_id, member_id)
     values ('a3000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000001') $$,
  '42501', null,
  'Giulia cannot link herself to a thing of Casa D''Angelo'
);
select throws_ok(
  $$ select public.update_shopping_item('a3000000-0000-4000-8000-000000000003', 'Intrusione', null, array[]::uuid[]) $$,
  'P0002', null,
  'Giulia cannot change a thing of Casa D''Angelo'
);
select throws_ok(
  $$ select * from public.add_shopping_items('[{"name":"Per Marco"}]'::jsonb, array['a1000000-0000-4000-8000-000000000001']::uuid[]) $$,
  '23514', null,
  'Giulia cannot give her things to a member of Casa D''Angelo'
);
select results_eq(
  $$ delete from public.shopping_items where id = 'b3000000-0000-4000-8000-000000000002' returning name $$,
  $$ values ('Biscotti'::text) $$,
  'Giulia deletes a thing to buy of her household (added by her)'
);
select results_eq(
  $$ delete from public.shopping_items where id = 'b3000000-0000-4000-8000-000000000001' returning name $$,
  $$ values ('Yogurt'::text) $$,
  'and one added by Paolo: every adult deletes every thing'
);
reset role;
select results_eq(
  $$ select i.name from public.shopping_items i where i.household_id = '11111111-1111-4111-8111-111111111111' order by i.created_at, i.id $$,
  $$ values ('LATTE'::text), ('Mele rosse'), ('Detersivo piatti'), ('Uova'), ('Pomodori'), ('Zucchine') $$,
  'Casa D''Angelo survived every attempt of Giulia'
);

-- ---------------------------------------------------------------------------
-- anon and the administrative key
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok($$ select 1 from public.shopping_item_assignees $$, '42501', null, 'anon cannot read the people');
select throws_ok($$ select * from public.add_shopping_items('[{"name":"Sale"}]'::jsonb) $$, '42501', null, 'anon cannot add things');
select throws_ok(
  $$ select public.update_shopping_item('a3000000-0000-4000-8000-000000000003', 'Anonimo', null, array[]::uuid[]) $$,
  '42501', null,
  'anon cannot change things'
);
set local role service_role;
set local request.jwt.claims to '{"role":"service_role"}';
select lives_ok(
  $$ insert into public.shopping_item_assignees (shopping_item_id, member_id, household_id)
     values ('a3000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111') $$,
  'the administrative key adds a person, with household_id (as the fixtures do)'
);
select throws_ok(
  $$ insert into public.shopping_item_assignees (shopping_item_id, member_id, household_id)
     values ('a3000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111') $$,
  '23514', null,
  'the administrative key cannot give a thing to a pet either'
);
reset role;

select * from finish();
rollback;
