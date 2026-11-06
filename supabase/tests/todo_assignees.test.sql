-- todo_assignees (issue #337, for #333): several people per thing to do. Schema,
-- privileges, data of the seed and of the backfill, the write functions, the
-- compatibility column for the pages on main, a member who leaves, isolation between
-- households, anon, the administrative key, and «Da fare assegnato» to several people.
-- Seed ids: A = Marco (Casa D'Angelo, user aaaaaaaa…01, member a1…01), B = Giulia (Casa
-- Bianchi, bbbbbbbb…01, b1…01), B2 = Paolo (bbbbbbbb…02, b1…02). Members of Casa D'Angelo:
-- Marco a1…01, Laura a1…02 (adult without account), Sofia a1…03 and Tommaso a1…04
-- (children), Biscotto a1…05 (pet). Casa Bianchi: Giulia b1…01, Paolo b1…02, Leo b1…03
-- (child), Anna b1…04 (adult without account); this test adds Carla b1…10 (adult with an
-- account, user dddddddd…01).
-- Seed things to do: a4…01 (Marco), a4…02 (Laura), a4…03 (nobody), a4…04 (Marco, done);
-- b4…01 «Solo io» of Paolo (Paolo), b4…02 created by Giulia (Paolo).
begin;
create extension if not exists pgtap with schema extensions;

select plan(94);

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------
select has_table('public', 'todo_assignees', 'todo_assignees exists');
select ok(
  (select c.relrowsecurity from pg_class c where c.oid = 'public.todo_assignees'::regclass),
  'RLS enabled on todo_assignees'
);
select col_is_pk('public', 'todo_assignees', array['todo_id', 'member_id'], 'one row per thing and person');
select fk_ok(
  'public', 'todo_assignees', array['todo_id', 'household_id'],
  'public', 'todos', array['id', 'household_id'],
  'the thing belongs to the same household'
);
select fk_ok(
  'public', 'todo_assignees', array['member_id', 'household_id'],
  'public', 'household_members', array['id', 'household_id'],
  'the person is a member of the same household'
);
select is(
  (select array_agg(k.confdeltype::text order by k.conname)
   from pg_constraint k
   where k.conrelid = 'public.todo_assignees'::regclass and k.contype = 'f'),
  array['c', 'c', 'c'],
  'household, person and thing: on delete cascade'
);
select has_index('public', 'todo_assignees', 'todo_assignees_member_id_idx', 'index on the person');
select has_index('public', 'todo_assignees', 'todo_assignees_household_id_idx', 'index on the household');
select ok(
  (select bool_and(
     p.proconfig @> array['search_path=""']
     and p.prosecdef = (p.oid <> 'private.todo_assignees_before_insert()'::regprocedure)
   )
   from pg_proc p
   where p.oid in (
     'private.todo_assignees_before_insert()'::regprocedure,
     'private.todo_assignees_sync_todo()'::regprocedure,
     'private.todos_sync_assignees()'::regprocedure,
     'private.todo_assignees_notify()'::regprocedure
   )),
  'the guard is security invoker, the sync and the notification security definer; empty search_path'
);
select ok(
  (select bool_and(not p.prosecdef and p.proconfig @> array['search_path=""'])
   from pg_proc p
   where p.oid in (
     'public.create_todo(text, uuid[], uuid, date, boolean)'::regprocedure,
     'public.update_todo(uuid, text, uuid[], uuid, date, boolean)'::regprocedure
   )),
  'create_todo and update_todo run as the caller (RLS), with an empty search_path'
);

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
select ok(
  not has_table_privilege('anon', 'public.todo_assignees', 'select, insert, update, delete'),
  'anon has no privilege on todo_assignees'
);
select ok(
  has_table_privilege('authenticated', 'public.todo_assignees', 'select')
  and has_table_privilege('authenticated', 'public.todo_assignees', 'delete')
  and has_column_privilege('authenticated', 'public.todo_assignees', 'todo_id', 'insert')
  and has_column_privilege('authenticated', 'public.todo_assignees', 'member_id', 'insert')
  and has_column_privilege('authenticated', 'public.todo_assignees', 'household_id', 'insert')
  and not has_column_privilege('authenticated', 'public.todo_assignees', 'created_at', 'insert')
  and not has_any_column_privilege('authenticated', 'public.todo_assignees', 'update'),
  'the app reads, adds (never the time) and removes people; it never changes a row'
);
select ok(
  not has_function_privilege('anon', 'public.create_todo(text, uuid[], uuid, date, boolean)', 'execute')
  and not has_function_privilege('anon', 'public.update_todo(uuid, text, uuid[], uuid, date, boolean)', 'execute')
  and has_function_privilege('authenticated', 'public.create_todo(text, uuid[], uuid, date, boolean)', 'execute')
  and has_function_privilege('authenticated', 'public.update_todo(uuid, text, uuid[], uuid, date, boolean)', 'execute')
  and not has_function_privilege('authenticated', 'private.todo_first_assignee(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'private.todos_sync_assignees()', 'execute')
  and not has_function_privilege('authenticated', 'private.todo_assignees_notify()', 'execute'),
  'only signed-in users call the write functions; helpers and triggers are never callable'
);

-- ---------------------------------------------------------------------------
-- Data: the seed (written through the compatibility column) and the backfill
-- ---------------------------------------------------------------------------
select results_eq(
  $$ select a.todo_id, a.member_id from public.todo_assignees a order by a.todo_id $$,
  $$ values ('a4000000-0000-4000-8000-000000000001'::uuid, 'a1000000-0000-4000-8000-000000000001'::uuid),
            ('a4000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000002'),
            ('a4000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000001'),
            ('b4000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002'),
            ('b4000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000002') $$,
  'every person of the seed is a row of todo_assignees'
);
select is_empty(
  $$ select t.id from public.todos t
     where t.assignee_member_id is distinct from private.todo_first_assignee(t.id) $$,
  'the compatibility column equals the first person of every thing'
);

-- A thing written before the new tables (simulated: the sync trigger off).
alter table public.todos disable trigger todos_sync_assignees;
insert into public.todos (id, household_id, title, created_by_member_id, assignee_member_id, created_at)
values ('a4000000-0000-4000-8000-000000000010', '11111111-1111-4111-8111-111111111111', 'Prima del cambio',
        'a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000003', now() - interval '5 days');
alter table public.todos enable trigger todos_sync_assignees;
select is_empty(
  $$ select 1 from public.todo_assignees a where a.todo_id = 'a4000000-0000-4000-8000-000000000010' $$,
  'before the backfill the old thing has no row'
);
-- Same statement as the backfill_assignees migration.
insert into public.todo_assignees (todo_id, member_id, household_id, created_at)
select t.id, t.assignee_member_id, t.household_id, t.created_at
from public.todos t
where t.assignee_member_id is not null
order by t.created_at, t.id
on conflict do nothing;
select results_eq(
  $$ select a.member_id, a.household_id, a.created_at = now() - interval '5 days'
     from public.todo_assignees a where a.todo_id = 'a4000000-0000-4000-8000-000000000010' $$,
  $$ values ('a1000000-0000-4000-8000-000000000003'::uuid, '11111111-1111-4111-8111-111111111111'::uuid, true) $$,
  'the backfill moves the person, linked at the time the thing was created'
);
select is(
  (select count(*)::integer from public.todo_assignees),
  6,
  'the backfill touches nothing else (the rows of the seed stay once)'
);
select is(
  (select t.assignee_member_id from public.todos t where t.id = 'a4000000-0000-4000-8000-000000000010'),
  'a1000000-0000-4000-8000-000000000003'::uuid,
  'the compatibility column keeps its value after the backfill'
);

-- ---------------------------------------------------------------------------
-- Marco (A): direct writes of the people
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';

select results_eq(
  $$ select a.todo_id, a.member_id from public.todo_assignees a order by a.todo_id $$,
  $$ values ('a4000000-0000-4000-8000-000000000001'::uuid, 'a1000000-0000-4000-8000-000000000001'::uuid),
            ('a4000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000002'),
            ('a4000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000001'),
            ('a4000000-0000-4000-8000-000000000010', 'a1000000-0000-4000-8000-000000000003') $$,
  'Marco reads the people of the things of Casa D''Angelo only'
);
select lives_ok(
  $$ insert into public.todo_assignees (todo_id, member_id)
     values ('a4000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002') $$,
  'Marco adds Laura to «Firmare autorizzazione gita» (household omitted)'
);
select is(
  (select t.assignee_member_id from public.todos t where t.id = 'a4000000-0000-4000-8000-000000000001'),
  'a1000000-0000-4000-8000-000000000001'::uuid,
  'the compatibility column stays the first person (Marco, linked earlier)'
);
select lives_ok(
  $$ delete from public.todo_assignees
     where todo_id = 'a4000000-0000-4000-8000-000000000001' and member_id = 'a1000000-0000-4000-8000-000000000001' $$,
  'Marco removes himself'
);
select is(
  (select t.assignee_member_id from public.todos t where t.id = 'a4000000-0000-4000-8000-000000000001'),
  'a1000000-0000-4000-8000-000000000002'::uuid,
  'the compatibility column follows: now Laura'
);
select throws_ok(
  $$ insert into public.todo_assignees (todo_id, member_id)
     values ('a4000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000005') $$,
  '23514', null,
  'a pet never takes care of a thing'
);
select throws_ok(
  $$ insert into public.todo_assignees (todo_id, member_id)
     values ('a4000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001') $$,
  '23514', null,
  'a member of another household is refused like an unknown one'
);
select throws_ok(
  $$ insert into public.todo_assignees (todo_id, member_id, household_id)
     values ('b4000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222') $$,
  '42501', null,
  'Marco cannot add people to a thing of Casa Bianchi'
);
select throws_ok(
  $$ insert into public.todo_assignees (todo_id, member_id)
     values ('b4000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000002') $$,
  '42501', null,
  'Marco cannot link a member of his to a thing of Casa Bianchi'
);

-- ---------------------------------------------------------------------------
-- create_todo
-- ---------------------------------------------------------------------------
select lives_ok(
  $$ select set_config('test.t1', public.create_todo(
       p_title => '  Comprare   il regalo ',
       p_assignee_member_ids => array['a1000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000002',
                                      'a1000000-0000-4000-8000-000000000003']::uuid[]
     )::text, true) $$,
  'create_todo with Sofia, Laura and Sofia again'
);
select results_eq(
  $$ select a.member_id from public.todo_assignees a where a.todo_id = current_setting('test.t1')::uuid order by a.member_id $$,
  $$ values ('a1000000-0000-4000-8000-000000000002'::uuid), ('a1000000-0000-4000-8000-000000000003'::uuid) $$,
  'the thing has Laura and Sofia, once each'
);
select results_eq(
  $$ select t.title, t.created_by_member_id, t.assignee_member_id, t.is_private, t.done_at is null
     from public.todos t where t.id = current_setting('test.t1')::uuid $$,
  $$ values ('Comprare il regalo'::text, 'a1000000-0000-4000-8000-000000000001'::uuid,
             'a1000000-0000-4000-8000-000000000002'::uuid, false, true) $$,
  'title normalised, author Marco, first person Laura (same time: order of the members), to do'
);
select throws_ok(
  $$ select public.create_todo(p_title => 'Con il cane', p_assignee_member_ids => array['a1000000-0000-4000-8000-000000000005']::uuid[]) $$,
  '23514', null,
  'create_todo with a pet is refused'
);
select is(
  (select count(*)::integer from public.todos t where t.title = 'Con il cane'),
  0,
  'nothing is created when a person is refused (one transaction)'
);
select throws_ok(
  $$ select public.create_todo(p_title => 'Senza lista', p_assignee_member_ids => null) $$,
  '22023', null,
  'a null list of people is refused'
);
select throws_ok(
  $$ select public.create_todo(p_title => 'Con un buco', p_assignee_member_ids => array[null]::uuid[]) $$,
  '22023', null,
  'a list with a null person is refused'
);
select throws_ok(
  $$ select public.create_todo(p_title => 'Segreto', p_assignee_member_ids => array['a1000000-0000-4000-8000-000000000002']::uuid[],
                               p_is_private => true) $$,
  '23514', null,
  '«Solo io» with someone else is refused'
);
select lives_ok(
  $$ select set_config('test.t2', public.create_todo(
       p_title => 'Solo mio', p_assignee_member_ids => array['a1000000-0000-4000-8000-000000000001']::uuid[], p_is_private => true
     )::text, true) $$,
  '«Solo io» with the author is accepted'
);
select is(
  (select t.assignee_member_id from public.todos t where t.id = current_setting('test.t2')::uuid),
  'a1000000-0000-4000-8000-000000000001'::uuid,
  'the «Solo io» thing has Marco'
);

-- ---------------------------------------------------------------------------
-- update_todo
-- ---------------------------------------------------------------------------
select lives_ok(
  $$ select public.update_todo(
       p_todo_id => current_setting('test.t1')::uuid, p_title => 'Comprare il regalo per Sofia',
       p_assignee_member_ids => array['a1000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000004']::uuid[],
       p_for_member_id => 'a1000000-0000-4000-8000-000000000003', p_due_date => '2026-12-01', p_is_private => false
     ) $$,
  'update_todo: Sofia stays, Laura goes, Tommaso comes'
);
select results_eq(
  $$ select a.member_id from public.todo_assignees a where a.todo_id = current_setting('test.t1')::uuid order by a.member_id $$,
  $$ values ('a1000000-0000-4000-8000-000000000003'::uuid), ('a1000000-0000-4000-8000-000000000004'::uuid) $$,
  'the people are now Sofia and Tommaso'
);
select results_eq(
  $$ select t.title, t.assignee_member_id, t.for_member_id, t.due_date
     from public.todos t where t.id = current_setting('test.t1')::uuid $$,
  $$ values ('Comprare il regalo per Sofia'::text, 'a1000000-0000-4000-8000-000000000003'::uuid,
             'a1000000-0000-4000-8000-000000000003'::uuid, '2026-12-01'::date) $$,
  'the other fields change too; the first person is Sofia'
);
select throws_ok(
  $$ select public.update_todo('b4000000-0000-4000-8000-000000000002', 'Intrusione', array[]::uuid[], null, null, false) $$,
  'P0002', null,
  'a thing of Casa Bianchi is not found'
);
select throws_ok(
  $$ select public.update_todo(gen_random_uuid(), 'Nessuna', array[]::uuid[], null, null, false) $$,
  'P0002', null,
  'an unknown thing gives the same error'
);
select throws_ok(
  $$ select public.update_todo(current_setting('test.t1')::uuid, 'Comprare il regalo per Sofia',
       array['a1000000-0000-4000-8000-000000000003']::uuid[], null, null, true) $$,
  '23514', null,
  'becoming «Solo io» with someone else is refused'
);
select results_eq(
  $$ select a.member_id from public.todo_assignees a where a.todo_id = current_setting('test.t1')::uuid order by a.member_id $$,
  $$ values ('a1000000-0000-4000-8000-000000000003'::uuid), ('a1000000-0000-4000-8000-000000000004'::uuid) $$,
  'after the refused change nothing changed (one transaction)'
);
select lives_ok(
  $$ select public.update_todo(current_setting('test.t1')::uuid, 'Comprare il regalo per Sofia',
       array['a1000000-0000-4000-8000-000000000001']::uuid[], null, null, true) $$,
  'the author makes it «Solo io» with himself only'
);
select results_eq(
  $$ select t.is_private, t.assignee_member_id,
            (select array_agg(a.member_id) from public.todo_assignees a where a.todo_id = t.id)
     from public.todos t where t.id = current_setting('test.t1')::uuid $$,
  $$ values (true, 'a1000000-0000-4000-8000-000000000001'::uuid, array['a1000000-0000-4000-8000-000000000001']::uuid[]) $$,
  '«Solo io», only Marco'
);
select throws_ok(
  $$ insert into public.todo_assignees (todo_id, member_id)
     values (current_setting('test.t1')::uuid, 'a1000000-0000-4000-8000-000000000002') $$,
  '23514', null,
  'nobody else can be added to a «Solo io» thing'
);
select lives_ok(
  $$ select set_config('test.t3', public.create_todo(
       p_title => 'Due persone',
       p_assignee_member_ids => array['a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002']::uuid[]
     )::text, true) $$,
  'a thing with Marco and Laura'
);
select throws_ok(
  $$ update public.todos set is_private = true where id = current_setting('test.t3')::uuid $$,
  '23514', null,
  'it cannot become «Solo io» while Laura takes care of it (direct update)'
);
select lives_ok(
  $$ update public.todos set is_private = true, assignee_member_id = null where id = current_setting('test.t3')::uuid $$,
  '«Solo io» and nobody in one statement, as the pages on main do'
);
select is_empty(
  $$ select 1 from public.todo_assignees a where a.todo_id = current_setting('test.t3')::uuid $$,
  'nobody takes care of it any more'
);

-- ---------------------------------------------------------------------------
-- Compatibility: the pages on main write assignee_member_id
-- ---------------------------------------------------------------------------
select lives_ok(
  $$ insert into public.todos (title, assignee_member_id) values ('Vecchia pagina', 'a1000000-0000-4000-8000-000000000002') $$,
  'an old page creates a thing for Laura'
);
select results_eq(
  $$ select a.member_id from public.todo_assignees a join public.todos t on t.id = a.todo_id where t.title = 'Vecchia pagina' $$,
  $$ values ('a1000000-0000-4000-8000-000000000002'::uuid) $$,
  'Laura is its person'
);
select lives_ok(
  $$ update public.todos set assignee_member_id = 'a1000000-0000-4000-8000-000000000003' where title = 'Vecchia pagina' $$,
  'the old page moves it to Sofia'
);
select results_eq(
  $$ select a.member_id, t.assignee_member_id from public.todo_assignees a join public.todos t on t.id = a.todo_id
     where t.title = 'Vecchia pagina' $$,
  $$ values ('a1000000-0000-4000-8000-000000000003'::uuid, 'a1000000-0000-4000-8000-000000000003'::uuid) $$,
  'Sofia only, in both places'
);
select lives_ok(
  $$ insert into public.todo_assignees (todo_id, member_id)
     select t.id, 'a1000000-0000-4000-8000-000000000004' from public.todos t where t.title = 'Vecchia pagina' $$,
  'a new page adds Tommaso'
);
select lives_ok(
  $$ update public.todos set title = 'Vecchia pagina', assignee_member_id = 'a1000000-0000-4000-8000-000000000003'
     where title = 'Vecchia pagina' $$,
  'the old page saves its sheet again with the same person'
);
select results_eq(
  $$ select a.member_id from public.todo_assignees a join public.todos t on t.id = a.todo_id
     where t.title = 'Vecchia pagina' order by a.member_id $$,
  $$ values ('a1000000-0000-4000-8000-000000000003'::uuid), ('a1000000-0000-4000-8000-000000000004'::uuid) $$,
  'the same person written again keeps Sofia and Tommaso'
);
select lives_ok(
  $$ update public.todos set assignee_member_id = null where title = 'Vecchia pagina' $$,
  'the old page removes the person'
);
select is_empty(
  $$ select 1 from public.todo_assignees a join public.todos t on t.id = a.todo_id where t.title = 'Vecchia pagina' $$,
  'nobody takes care of it'
);
select throws_ok(
  $$ update public.todos set assignee_member_id = 'a1000000-0000-4000-8000-000000000005' where title = 'Vecchia pagina' $$,
  '23514', null,
  'the old page cannot give it to a pet either'
);

-- ---------------------------------------------------------------------------
-- A member leaves: their rows go, the first person moves on
-- ---------------------------------------------------------------------------
select lives_ok(
  $$ select set_config('test.t4', public.create_todo(
       p_title => 'Per Laura e Sofia',
       p_assignee_member_ids => array['a1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000003']::uuid[]
     )::text, true) $$,
  'a thing with Laura and Sofia'
);
reset role;
select lives_ok(
  $$ delete from public.household_members where id = 'a1000000-0000-4000-8000-000000000002' $$,
  'Laura is removed from Casa D''Angelo'
);
select results_eq(
  $$ select t.assignee_member_id, (select array_agg(a.member_id) from public.todo_assignees a where a.todo_id = t.id)
     from public.todos t where t.id = current_setting('test.t4')::uuid $$,
  $$ values ('a1000000-0000-4000-8000-000000000003'::uuid, array['a1000000-0000-4000-8000-000000000003']::uuid[]) $$,
  'Sofia stays and becomes the first person'
);
select is_empty(
  $$ select 1 from public.todo_assignees a where a.member_id = 'a1000000-0000-4000-8000-000000000002' $$,
  'no row of Laura is left'
);
select is_empty(
  $$ select t.id from public.todos t
     where t.assignee_member_id is distinct from private.todo_first_assignee(t.id) $$,
  'the compatibility column is still the first person everywhere'
);

-- ---------------------------------------------------------------------------
-- Isolation: Giulia (B)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';

select results_eq(
  $$ select a.todo_id, a.member_id from public.todo_assignees a $$,
  $$ values ('b4000000-0000-4000-8000-000000000002'::uuid, 'b1000000-0000-4000-8000-000000000002'::uuid) $$,
  'Giulia reads only the shared thing of Casa Bianchi (not Casa D''Angelo, not the «Solo io» of Paolo)'
);
select is_empty(
  $$ delete from public.todo_assignees where household_id = '11111111-1111-4111-8111-111111111111' returning todo_id $$,
  'Giulia removes 0 people of Casa D''Angelo'
);
select is_empty(
  $$ delete from public.todo_assignees where todo_id = 'b4000000-0000-4000-8000-000000000001' returning todo_id $$,
  'Giulia removes 0 people of the «Solo io» of Paolo'
);
select throws_ok(
  $$ insert into public.todo_assignees (todo_id, member_id, household_id)
     values ('a4000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111') $$,
  '42501', null,
  'Giulia cannot add people to Casa D''Angelo'
);
select throws_ok(
  $$ insert into public.todo_assignees (todo_id, member_id)
     values ('b4000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001') $$,
  '42501', null,
  'Giulia cannot add herself to the «Solo io» of Paolo'
);
select throws_ok(
  $$ select public.update_todo('a4000000-0000-4000-8000-000000000003', 'Intrusione', array[]::uuid[], null, null, false) $$,
  'P0002', null,
  'Giulia cannot change a thing of Casa D''Angelo'
);
select throws_ok(
  $$ select public.update_todo('b4000000-0000-4000-8000-000000000001', 'Intrusione', array[]::uuid[], null, null, false) $$,
  'P0002', null,
  'Giulia cannot change the «Solo io» of Paolo'
);
select throws_ok(
  $$ select public.create_todo(p_title => 'Per Marco', p_assignee_member_ids => array['a1000000-0000-4000-8000-000000000001']::uuid[]) $$,
  '23514', null,
  'Giulia cannot give a thing to a member of Casa D''Angelo'
);

-- ---------------------------------------------------------------------------
-- anon
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok($$ select 1 from public.todo_assignees $$, '42501', null, 'anon cannot read the people');
select throws_ok(
  $$ insert into public.todo_assignees (todo_id, member_id, household_id)
     values ('a4000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111') $$,
  '42501', null,
  'anon cannot add people'
);
select throws_ok(
  $$ select public.create_todo(p_title => 'Anonimo') $$,
  '42501', null,
  'anon cannot call create_todo'
);

-- ---------------------------------------------------------------------------
-- Administrative key (fixtures of the e2e tests, lesson of #276/#287)
-- ---------------------------------------------------------------------------
set local role service_role;
set local request.jwt.claims to '{"role":"service_role"}';
select lives_ok(
  $$ insert into public.todo_assignees (todo_id, member_id, household_id)
     values ('a4000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111') $$,
  'the administrative key adds a person, with household_id (as the fixtures do)'
);
select throws_ok(
  $$ insert into public.todo_assignees (todo_id, member_id, household_id)
     values ('a4000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111') $$,
  '23514', null,
  'the administrative key cannot give a thing to a pet either'
);
select lives_ok(
  $$ delete from public.todo_assignees
     where todo_id = 'a4000000-0000-4000-8000-000000000003' and member_id = 'a1000000-0000-4000-8000-000000000004' $$,
  'the administrative key removes the person'
);
reset role;
select is(
  (select t.assignee_member_id from public.todos t where t.id = 'a4000000-0000-4000-8000-000000000003'),
  null::uuid,
  'after the administrative key the thing has nobody again'
);
select results_eq(
  $$ select a.member_id from public.todo_assignees a where a.todo_id = 'b4000000-0000-4000-8000-000000000001' $$,
  $$ values ('b1000000-0000-4000-8000-000000000002'::uuid) $$,
  'the «Solo io» of Paolo survived every attempt of Giulia'
);

-- ---------------------------------------------------------------------------
-- «Da fare assegnato» to several people
-- ---------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', 'dddddddd-0000-4000-8000-000000000001', 'authenticated',
        'authenticated', 'utente-d@example.com', '{"full_name":"Carla Test"}', now(), now());
insert into public.household_members (id, household_id, kind, name, color, user_id, joined_at, created_at)
values ('b1000000-0000-4000-8000-000000000010', '22222222-2222-4222-8222-222222222222', 'adult', 'Carla',
        'glicine', 'dddddddd-0000-4000-8000-000000000001', now(), now());
delete from public.notifications;

set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok(
  $$ select set_config('test.party', public.create_todo(
       p_title => 'Organizzare la festa',
       p_assignee_member_ids => array['b1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000010',
                                      'b1000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000002',
                                      'b1000000-0000-4000-8000-000000000004']::uuid[]
     )::text, true) $$,
  'Paolo creates a thing for Giulia, Carla, Leo, himself and Anna'
);
reset role;
select results_eq(
  $$ select n.recipient_member_id, n.actor_member_id from public.notifications n
     where n.kind = 'todo_assigned' and n.todo_id = current_setting('test.party')::uuid order by n.recipient_member_id $$,
  $$ values ('b1000000-0000-4000-8000-000000000001'::uuid, 'b1000000-0000-4000-8000-000000000002'::uuid),
            ('b1000000-0000-4000-8000-000000000010', 'b1000000-0000-4000-8000-000000000002') $$,
  'one notification to each adult with an account other than Paolo: Giulia and Carla'
);
set local role authenticated;
select lives_ok(
  $$ select public.update_todo(current_setting('test.party')::uuid, 'Organizzare la festa',
       array['b1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000010']::uuid[], null, null, false) $$,
  'Paolo keeps Giulia and Carla and removes the others'
);
reset role;
select is(
  (select count(*)::integer from public.notifications n where n.todo_id = current_setting('test.party')::uuid),
  2,
  'nobody already among the people is notified again, nobody removed is notified'
);
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok(
  $$ select public.update_todo(current_setting('test.party')::uuid, 'Organizzare la festa',
       array['b1000000-0000-4000-8000-000000000010', 'b1000000-0000-4000-8000-000000000002']::uuid[], null, null, false) $$,
  'Giulia removes herself and adds Paolo'
);
reset role;
select results_eq(
  $$ select n.recipient_member_id, n.actor_member_id from public.notifications n
     where n.todo_id = current_setting('test.party')::uuid order by n.recipient_member_id $$,
  $$ values ('b1000000-0000-4000-8000-000000000001'::uuid, 'b1000000-0000-4000-8000-000000000002'::uuid),
            ('b1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000001'),
            ('b1000000-0000-4000-8000-000000000010', 'b1000000-0000-4000-8000-000000000002') $$,
  'only Paolo, just added, is notified, by Giulia'
);
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok(
  $$ select public.create_todo(p_title => 'Privato di Paolo',
       p_assignee_member_ids => array['b1000000-0000-4000-8000-000000000002']::uuid[], p_is_private => true) $$,
  'Paolo creates a «Solo io» thing for himself'
);
set local request.jwt.claims to '{"sub":"dddddddd-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$ select public.set_notification_preference('assigned_todos', false) $$, 'Carla switches «Da fare assegnati a me» off');
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok(
  $$ select set_config('test.quiet', public.create_todo(p_title => 'Con interruttore spento',
       p_assignee_member_ids => array['b1000000-0000-4000-8000-000000000010', 'b1000000-0000-4000-8000-000000000001']::uuid[]
     )::text, true) $$,
  'Paolo creates a thing for Carla and Giulia'
);
reset role;
select results_eq(
  $$ select n.recipient_member_id from public.notifications n
     where n.todo_id = current_setting('test.quiet')::uuid $$,
  $$ values ('b1000000-0000-4000-8000-000000000001'::uuid) $$,
  'Carla, with the switch off, gets nothing; Giulia gets hers'
);
select is(
  (select count(*)::integer from public.notifications n join public.todos t on t.id = n.todo_id where t.is_private),
  0,
  '«Solo io» notifies nobody'
);

select * from finish();
rollback;
