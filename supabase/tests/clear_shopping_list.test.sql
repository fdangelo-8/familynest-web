-- «Svuota tutta la lista» and its «Annulla» (issue #512, DB-3 of plan #501):
-- public.clear_shopping_list() for every adult with an account, the copies of the things
-- to buy in private.removed_shopping_items (checked_at optional), public.restore_shopping_items()
-- with the things to buy (CA-8 – CA-15), isolation between households and anon (CA-16).
-- Seed ids: Marco (Casa D'Angelo, admin, user aaaaaaaa…01, member a1…01), Laura a1…02,
-- Sofia a1…03 (child), Tommaso a1…04 (child); Giulia (Casa Bianchi, bbbbbbbb…01, b1…01);
-- Chiara (cccccccc…01, no household).
-- This test gives Laura an account (user aaaaaaaa…02) and adds a third adult, Davide
-- (a1…06, user aaaaaaaa…03, not administrator). The seed list is deleted first; things
-- created here: f3… (Casa D'Angelo), c3… (Casa Bianchi). Every instant is relative to
-- now() (the time of the transaction), never a past date. No health data (D1).
begin;
create extension if not exists pgtap with schema extensions;

select plan(58);

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-4000-8000-000000000002', 'authenticated',
   'authenticated', 'utente-laura@example.com', '{"full_name":"Laura Test"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-4000-8000-000000000003', 'authenticated',
   'authenticated', 'utente-davide@example.com', '{"full_name":"Davide Test"}', now(), now());
update public.household_members
set user_id = 'aaaaaaaa-0000-4000-8000-000000000002', joined_at = now()
where id = 'a1000000-0000-4000-8000-000000000002';
insert into public.household_members (id, household_id, kind, name, color, user_id, joined_at)
values ('a1000000-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111', 'adult', 'Davide',
        'lampone', 'aaaaaaaa-0000-4000-8000-000000000003', now());

delete from public.shopping_items;
delete from private.removed_shopping_items;

-- Casa D'Angelo: to buy Latte (Marco), Pane (Laura), Mele (for Tommaso); taken Caffè
-- (5 hours ago) and Sale (13 hours ago). Casa Bianchi: to buy Yogurt, taken Tè.
insert into public.shopping_items (id, household_id, name, quantity, added_by_member_id, checked_at, created_at)
values
  ('f3000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Latte', '1 l',
   'a1000000-0000-4000-8000-000000000001', null, now() - interval '3 hours'),
  ('f3000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'Pane', null,
   'a1000000-0000-4000-8000-000000000002', null, now() - interval '2 hours'),
  ('f3000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'Mele', '1 kg',
   'a1000000-0000-4000-8000-000000000001', null, now() - interval '1 hour'),
  ('f3000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 'Caffè', null,
   'a1000000-0000-4000-8000-000000000002', now() - interval '5 hours', now() - interval '1 day'),
  ('f3000000-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111', 'Sale', null,
   'a1000000-0000-4000-8000-000000000001', now() - interval '13 hours', now() - interval '1 day'),
  ('c3000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'Yogurt', '4',
   'b1000000-0000-4000-8000-000000000001', null, now() - interval '1 day'),
  ('c3000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', 'Tè', null,
   'b1000000-0000-4000-8000-000000000001', now() - interval '2 hours', now() - interval '1 day');
insert into public.shopping_item_assignees (shopping_item_id, member_id, household_id)
values ('f3000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111');

-- Casa D'Angelo before «Svuota» (order of rule 6), for CA-10.
select set_config(
  'test.before',
  (select jsonb_agg(to_jsonb(i) - 'updated_at'
                    order by i.checked_at is not null, case when i.checked_at is null then i.created_at end,
                             i.checked_at desc, i.id)::text
   from public.shopping_items i where i.household_id = '11111111-1111-4111-8111-111111111111'),
  true
);
select set_config(
  'test.bianchi',
  (select jsonb_agg(to_jsonb(i) order by i.id)::text
   from public.shopping_items i where i.household_id = '22222222-2222-4222-8222-222222222222'),
  true
);

-- ---------------------------------------------------------------------------
-- Schema and privileges
-- ---------------------------------------------------------------------------
select col_is_null('private', 'removed_shopping_items', 'checked_at', 'rule 7: the copy of a thing to buy has no check time');
select has_function('public', 'clear_shopping_list', array[]::name[], 'clear_shopping_list() exists');
select ok(
  (select p.proretset and p.prorettype = 'public.shopping_items'::regtype
   from pg_proc p where p.oid = 'public.clear_shopping_list()'::regprocedure)
  and (select p.proretset and p.prorettype = 'public.shopping_items'::regtype
       from pg_proc p where p.oid = 'public.restore_shopping_items(uuid[])'::regprocedure),
  'both return a set of shopping_items; restore_shopping_items keeps its signature'
);
select ok(
  (select p.prosecdef and p.proconfig @> array['search_path=""']
   from pg_proc p where p.oid = 'public.clear_shopping_list()'::regprocedure)
  and (select p.prosecdef and p.proconfig @> array['search_path=""']
       from pg_proc p where p.oid = 'public.restore_shopping_items(uuid[])'::regprocedure)
  and (select p.prosecdef and p.proconfig @> array['search_path=""']
       from pg_proc p where p.oid = 'public.run_shopping_purge(uuid, timestamptz)'::regprocedure),
  'clear_shopping_list, restore_shopping_items and run_shopping_purge: security definer with an empty search_path'
);
select ok(
  has_function_privilege('authenticated', 'public.clear_shopping_list()', 'execute')
  and has_function_privilege('authenticated', 'public.restore_shopping_items(uuid[])', 'execute')
  and not has_function_privilege('anon', 'public.restore_shopping_items(uuid[])', 'execute'),
  'signed-in users only'
);
select ok(
  not has_function_privilege('anon', 'public.clear_shopping_list()', 'execute')
  and not has_function_privilege('anon', 'public.run_shopping_purge(uuid, timestamptz)', 'execute'),
  'CA-16: anon cannot execute clear_shopping_list nor run_shopping_purge'
);
select ok(
  not has_table_privilege('authenticated', 'private.removed_shopping_items', 'select, insert, update, delete')
  and not has_table_privilege('anon', 'private.removed_shopping_items', 'select, insert, update, delete'),
  'the copies for «Annulla» stay out of reach of the app'
);

-- ---------------------------------------------------------------------------
-- CA-8: Davide, adult not administrator, empties the whole list
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000003","role":"authenticated"}';
set local request.method to 'POST';

select results_eq(
  $$ select r.id from public.clear_shopping_list() r $$,
  $$ values ('f3000000-0000-4000-8000-000000000001'::uuid), ('f3000000-0000-4000-8000-000000000002'::uuid),
            ('f3000000-0000-4000-8000-000000000003'::uuid), ('f3000000-0000-4000-8000-000000000004'::uuid),
            ('f3000000-0000-4000-8000-000000000005'::uuid) $$,
  'CA-8: 5 rows, to buy first (oldest first), then taken (last taken first)'
);
select is_empty(
  $$ select 1 from public.shopping_items i where i.household_id = '11111111-1111-4111-8111-111111111111' $$,
  'CA-8: Casa D''Angelo has no thing left'
);
reset role;
select is(
  (select count(*)::integer from private.removed_shopping_items r where r.household_id = '11111111-1111-4111-8111-111111111111'),
  5,
  'CA-8: 5 copies for «Annulla»'
);
select results_eq(
  $$ select r.checked_at, r.assignee_member_ids from private.removed_shopping_items r
     where r.id = 'f3000000-0000-4000-8000-000000000003' $$,
  $$ values (null::timestamptz, array['a1000000-0000-4000-8000-000000000004']::uuid[]) $$,
  'CA-8: the copy of Mele has no check time and keeps Tommaso'
);
select is(
  (select count(*)::integer from private.removed_shopping_items r where r.checked_at is null),
  3,
  'CA-8: three copies of things to buy'
);
select is(
  (select jsonb_agg(to_jsonb(i) order by i.id)::text
   from public.shopping_items i where i.household_id = '22222222-2222-4222-8222-222222222222'),
  current_setting('test.bianchi'),
  'CA-16: the list of Casa Bianchi did not change'
);

-- ---------------------------------------------------------------------------
-- CA-10: Laura puts everything back with «Annulla»
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}';

select results_eq(
  $$ select to_jsonb(r) - 'updated_at' from public.restore_shopping_items(array[
       'f3000000-0000-4000-8000-000000000001', 'f3000000-0000-4000-8000-000000000002',
       'f3000000-0000-4000-8000-000000000003', 'f3000000-0000-4000-8000-000000000004',
       'f3000000-0000-4000-8000-000000000005'
     ]::uuid[]) r $$,
  $$ select e from jsonb_array_elements(current_setting('test.before')::jsonb) e $$,
  'CA-10: 5 rows with name, quantity, author, created_at and checked_at of before (null for the things to buy)'
);
select results_eq(
  $$ select a.member_id from public.shopping_item_assignees a where a.shopping_item_id = 'f3000000-0000-4000-8000-000000000003' $$,
  $$ values ('a1000000-0000-4000-8000-000000000004'::uuid) $$,
  'CA-10: Tommaso takes care of Mele again'
);
select is(
  (select count(*)::integer from public.shopping_items i where i.checked_at is null),
  3,
  'CA-10: the three things are to buy again'
);
reset role;
select is_empty(
  $$ select 1 from private.removed_shopping_items r where r.household_id = '11111111-1111-4111-8111-111111111111' $$,
  'CA-10: no copy left after «Annulla»'
);

-- ---------------------------------------------------------------------------
-- CA-13: a thing taken 13 hours ago, emptied and put back, disappears at the next job
-- ---------------------------------------------------------------------------
select is(
  private.purge_taken_shopping_items(now(), '11111111-1111-4111-8111-111111111111'),
  1,
  'CA-13: the job deletes one thing'
);
select results_eq(
  $$ select i.name from public.shopping_items i where i.household_id = '11111111-1111-4111-8111-111111111111'
     order by i.created_at, i.id $$,
  $$ values ('Caffè'::text), ('Latte'), ('Pane'), ('Mele') $$,
  'CA-13: Sale is gone, the rest stays'
);

-- ---------------------------------------------------------------------------
-- CA-11: «Annulla» when someone has meanwhile added the same thing to buy
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}';
select is(
  (select count(*)::integer from public.clear_shopping_list()),
  4,
  'CA-11: Laura (not administrator) empties the list (4 things)'
);
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok(
  $$ insert into public.shopping_items (name) values ('latte') $$,
  'CA-11: Marco adds «latte» again right after'
);
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}';
select results_eq(
  $$ select r.name from public.restore_shopping_items(array[
       'f3000000-0000-4000-8000-000000000001', 'f3000000-0000-4000-8000-000000000002',
       'f3000000-0000-4000-8000-000000000003', 'f3000000-0000-4000-8000-000000000004'
     ]::uuid[]) r $$,
  $$ values ('Pane'::text), ('Mele'), ('Caffè') $$,
  'CA-11: no error; the result has every other thing, not the emptied «Latte»'
);
select results_eq(
  $$ select i.name, i.added_by_member_id from public.shopping_items i
     where lower(i.name) = 'latte' and i.checked_at is null $$,
  $$ values ('latte'::text, 'a1000000-0000-4000-8000-000000000001'::uuid) $$,
  'CA-11: one «latte» to buy, the one of Marco'
);
select is_empty(
  $$ select 1 from public.shopping_items i where i.id = 'f3000000-0000-4000-8000-000000000001' $$,
  'CA-11: the emptied «Latte» did not come back'
);
reset role;
select is_empty(
  $$ select 1 from private.removed_shopping_items r where r.household_id = '11111111-1111-4111-8111-111111111111' $$,
  'CA-11: its copy is deleted too'
);

-- Two copies to buy with the same name in one «Annulla»: only one comes back, no error.
set local role authenticated;
select set_config(
  'test.latte_1',
  (select i.id::text from public.shopping_items i where lower(i.name) = 'latte'),
  true
);
select is(
  (select count(*)::integer from public.clear_shopping_list()),
  4,
  'Laura empties the list again (latte, Pane, Mele, Caffè)'
);
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok(
  $$ insert into public.shopping_items (name) values ('LATTE') $$,
  'Marco adds «LATTE»'
);
select set_config(
  'test.latte_2',
  (select i.id::text from public.shopping_items i where lower(i.name) = 'latte'),
  true
);
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}';
select is(
  (select count(*)::integer from public.clear_shopping_list()),
  1,
  'Laura empties the list once more (LATTE)'
);
select is(
  (select count(*)::integer from public.restore_shopping_items(array[
     current_setting('test.latte_1')::uuid, current_setting('test.latte_2')::uuid,
     'f3000000-0000-4000-8000-000000000002', 'f3000000-0000-4000-8000-000000000003',
     'f3000000-0000-4000-8000-000000000004'
   ]::uuid[])),
  4,
  'one «Annulla» with two copies of the same thing to buy puts back one of them, without error'
);
select is(
  (select count(*)::integer from public.shopping_items i where lower(i.name) = 'latte' and i.checked_at is null),
  1,
  'still one «latte» to buy'
);

-- ---------------------------------------------------------------------------
-- CA-15: Marco empties a list with things added by Laura today, then the job runs
-- ---------------------------------------------------------------------------
select lives_ok(
  $$ insert into public.shopping_items (name) values ('Pasta') $$,
  'CA-15: Laura adds Pasta today'
);
reset role;
select set_config(
  'test.additions',
  (select count(*)::text from private.shopping_additions s where s.household_id = '11111111-1111-4111-8111-111111111111'),
  true
);
select set_config(
  'test.first_item',
  (select h.first_shopping_item_at::text from public.households h where h.id = '11111111-1111-4111-8111-111111111111'),
  true
);
select ok(
  current_setting('test.additions')::integer >= 1,
  'CA-15: the addition of Laura is recorded for the digest of 19:00'
);
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select is(
  (select count(*)::integer from public.clear_shopping_list()),
  5,
  'CA-15: Marco (administrator) empties the list'
);
reset role;
select is(
  private.purge_taken_shopping_items(now(), '11111111-1111-4111-8111-111111111111'),
  0,
  'CA-15: the job runs on the empty list'
);
select is(
  private.purge_taken_shopping_items(now(), null),
  0,
  'CA-15: and for every household (Tè of Casa Bianchi was taken 2 hours ago)'
);
select is(
  (select count(*)::text from private.shopping_additions s where s.household_id = '11111111-1111-4111-8111-111111111111'),
  current_setting('test.additions'),
  'CA-15: private.shopping_additions of Casa D''Angelo did not change'
);
select is(
  (select h.first_shopping_item_at::text from public.households h where h.id = '11111111-1111-4111-8111-111111111111'),
  current_setting('test.first_item'),
  'CA-15: households.first_shopping_item_at did not change'
);

-- ---------------------------------------------------------------------------
-- CA-12: «Annulla» after more than 10 minutes
-- ---------------------------------------------------------------------------
update private.removed_shopping_items
set removed_at = now() - interval '11 minutes'
where household_id = '11111111-1111-4111-8111-111111111111';
select set_config(
  'test.cleared',
  (select array_agg(r.id order by r.id)::text from private.removed_shopping_items r
   where r.household_id = '11111111-1111-4111-8111-111111111111'),
  true
);
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok(
  $$ select * from public.restore_shopping_items(current_setting('test.cleared')::uuid[]) $$,
  'P0001', 'some items cannot be restored',
  'CA-12: removed 11 minutes ago: P0001'
);
select is_empty(
  $$ select 1 from public.shopping_items i where i.household_id = '11111111-1111-4111-8111-111111111111' $$,
  'CA-12: nothing came back'
);

-- ---------------------------------------------------------------------------
-- CA-9: an empty list
-- ---------------------------------------------------------------------------
select is_empty(
  $$ select * from public.clear_shopping_list() $$,
  'CA-9: Laura empties an empty list: 0 rows, no error'
);

-- ---------------------------------------------------------------------------
-- CA-14: without household, or with a method other than POST, nothing changes
-- ---------------------------------------------------------------------------
select lives_ok(
  $$ insert into public.shopping_items (name) values ('Farina') $$,
  'Laura adds Farina'
);
set local request.method to 'GET';
select throws_ok(
  $$ select * from public.clear_shopping_list() $$,
  'P0001', 'use POST',
  'CA-14: GET is refused'
);
set local request.method to 'HEAD';
select throws_ok(
  $$ select * from public.clear_shopping_list() $$,
  'P0001', 'use POST',
  'CA-14: HEAD is refused'
);
set local request.method to 'PATCH';
select throws_ok(
  $$ select * from public.clear_shopping_list() $$,
  'P0001', 'use POST',
  'CA-14: PATCH is refused'
);
set local request.method to 'POST';
set local request.jwt.claims to '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select * from public.clear_shopping_list() $$,
  '42501', null,
  'CA-14: Chiara, without household: 42501'
);
set local request.jwt.claims to '{"role":"authenticated"}';
select throws_ok(
  $$ select * from public.clear_shopping_list() $$,
  '42501', null,
  'CA-14: no user in the session: 42501'
);
reset role;
select results_eq(
  $$ select i.name from public.shopping_items i where i.household_id = '11111111-1111-4111-8111-111111111111' $$,
  $$ values ('Farina'::text) $$,
  'CA-14: Farina is still in the list'
);
select is(
  (select jsonb_agg(to_jsonb(i) order by i.id)::text
   from public.shopping_items i where i.household_id = '22222222-2222-4222-8222-222222222222'),
  current_setting('test.bianchi'),
  'CA-14: the list of Casa Bianchi did not change'
);
select is_empty(
  $$ select 1 from private.removed_shopping_items r where r.name = 'Farina' $$,
  'CA-14: no copy was made'
);

-- ---------------------------------------------------------------------------
-- CA-16: isolation between households, anon
-- ---------------------------------------------------------------------------
select set_config(
  'test.dangelo',
  (select jsonb_agg(to_jsonb(i) order by i.id)::text
   from public.shopping_items i where i.household_id = '11111111-1111-4111-8111-111111111111'),
  true
);
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select results_eq(
  $$ select r.id from public.clear_shopping_list() r $$,
  $$ values ('c3000000-0000-4000-8000-000000000001'::uuid), ('c3000000-0000-4000-8000-000000000002'::uuid) $$,
  'CA-16: Giulia empties only the list of Casa Bianchi'
);
reset role;
select is(
  (select jsonb_agg(to_jsonb(i) order by i.id)::text
   from public.shopping_items i where i.household_id = '11111111-1111-4111-8111-111111111111'),
  current_setting('test.dangelo'),
  'CA-16: the list of Casa D''Angelo is identical'
);
select set_config(
  'test.farina',
  (select i.id::text from public.shopping_items i where i.name = 'Farina'),
  true
);
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}';
select is(
  (select count(*)::integer from public.clear_shopping_list()),
  1,
  'Laura empties the list of Casa D''Angelo (Farina)'
);
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok(
  format($$ select * from public.restore_shopping_items(array[%L]::uuid[]) $$, current_setting('test.farina')),
  'P0001', 'some items cannot be restored',
  'CA-16: Giulia cannot put back a thing emptied by Casa D''Angelo'
);
select throws_ok(
  format(
    $$ select * from public.restore_shopping_items(array['c3000000-0000-4000-8000-000000000001', %L]::uuid[]) $$,
    current_setting('test.farina')
  ),
  'P0001', 'some items cannot be restored',
  'CA-16: nor mixed with one of her own (all or none)'
);
reset role;
select is_empty(
  $$ select 1 from public.shopping_items i $$,
  'CA-16: nothing came back in any list'
);
set local role authenticated;
select is(
  (select count(*)::integer from public.restore_shopping_items(array[
     'c3000000-0000-4000-8000-000000000001', 'c3000000-0000-4000-8000-000000000002'
   ]::uuid[])),
  2,
  'Giulia puts back her own things'
);
reset role;
set local role anon;
select throws_ok(
  $$ select * from public.clear_shopping_list() $$,
  '42501', null,
  'CA-16: anon cannot empty any list'
);
reset role;
select is(
  (select count(*)::integer from private.removed_shopping_items r where r.household_id = '11111111-1111-4111-8111-111111111111'),
  1,
  'the copy of Farina is still kept for Casa D''Angelo'
);

select * from finish();
rollback;
