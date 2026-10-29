-- todos: schema, privileges, isolation between households, «Solo io», constraints,
-- «fatto il» window, «fatto da», cleanup when a member leaves and after 90 days
-- (issue #87, for #23 and #22).
-- Seed ids: A = Marco (Casa D'Angelo), B = Giulia (Casa Bianchi, admin),
-- B2 = Paolo (Casa Bianchi, not admin), C = Chiara (no household).
-- Members: Casa Bianchi Giulia b1…01, Paolo b1…02, Leo b1…03 (child), Anna b1…04 (adult
-- without account); Casa D'Angelo Marco a1…01, Laura a1…02, Sofia a1…03 (child),
-- Tommaso a1…04 (child), Biscotto a1…05 (pet).
-- Seed things to do: Casa D'Angelo a4…01–a4…04 (a4…04 done yesterday by Marco);
-- Casa Bianchi b4…01 «Prenotare il ristorante» («Solo io» of Paolo), b4…02
-- «Prenotare la palestra» (created by Giulia, Paolo takes care of it).
-- No health data (D1).
begin;
create extension if not exists pgtap with schema extensions;

select plan(108);

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------
select has_table('public', 'todos', 'todos exists');
select ok(
  (select c.relrowsecurity from pg_class c where c.oid = 'public.todos'::regclass),
  'RLS enabled on todos'
);
select columns_are(
  'public', 'todos',
  array[
    'id', 'household_id', 'title', 'created_by_member_id', 'assignee_member_id', 'for_member_id',
    'due_date', 'is_private', 'done_at', 'done_by_member_id', 'created_at', 'updated_at'
  ],
  'todos has exactly the planned columns (no health data)'
);
select fk_ok('public', 'todos', 'household_id', 'public', 'households', 'id', 'todos.household_id references households');
select fk_ok(
  'public', 'todos', array['created_by_member_id', 'household_id'],
  'public', 'household_members', array['id', 'household_id'],
  'the author is a member of the same household'
);
select fk_ok(
  'public', 'todos', array['assignee_member_id', 'household_id'],
  'public', 'household_members', array['id', 'household_id'],
  'who takes care of it is a member of the same household'
);
select fk_ok(
  'public', 'todos', array['for_member_id', 'household_id'],
  'public', 'household_members', array['id', 'household_id'],
  '«per chi è» is a member of the same household'
);
select fk_ok(
  'public', 'todos', array['done_by_member_id', 'household_id'],
  'public', 'household_members', array['id', 'household_id'],
  '«fatto da» is a member of the same household'
);
select has_index('public', 'todos', 'todos_household_done_idx', 'index on todos (household_id, done_at)');
select has_index('public', 'todos', 'todos_household_due_idx', 'index on todos (household_id, due_date)');
select has_index('public', 'todos', 'todos_created_by_member_id_idx', 'index on todos.created_by_member_id');
select has_index('public', 'todos', 'todos_assignee_member_id_idx', 'index on todos.assignee_member_id');
select has_index('public', 'todos', 'todos_for_member_id_idx', 'index on todos.for_member_id');
select has_index('public', 'todos', 'todos_done_by_member_id_idx', 'index on todos.done_by_member_id');
select has_index('public', 'todos', 'todos_done_at_idx', 'index on todos.done_at for the cleanup');
select ok(
  not exists (
    select 1 from pg_publication_tables p
    where p.pubname = 'supabase_realtime' and p.schemaname = 'public' and p.tablename = 'todos'
  ),
  'todos is not sent in real time (issue #23, question 12)'
);

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
select ok(
  not has_table_privilege('anon', 'public.todos', 'select, insert, update, delete'),
  'anon has no privilege on todos'
);
select ok(
  not has_column_privilege('authenticated', 'public.todos', 'id', 'insert')
  and not has_column_privilege('authenticated', 'public.todos', 'created_by_member_id', 'insert')
  and not has_column_privilege('authenticated', 'public.todos', 'done_at', 'insert')
  and not has_column_privilege('authenticated', 'public.todos', 'done_by_member_id', 'insert')
  and not has_column_privilege('authenticated', 'public.todos', 'created_at', 'insert')
  and not has_column_privilege('authenticated', 'public.todos', 'updated_at', 'insert'),
  'the app cannot choose id, author, «fatto il», «fatto da» or row times of a new thing'
);
select ok(
  not has_column_privilege('authenticated', 'public.todos', 'id', 'update')
  and not has_column_privilege('authenticated', 'public.todos', 'household_id', 'update')
  and not has_column_privilege('authenticated', 'public.todos', 'created_by_member_id', 'update')
  and not has_column_privilege('authenticated', 'public.todos', 'done_by_member_id', 'update')
  and not has_column_privilege('authenticated', 'public.todos', 'created_at', 'update'),
  'the app cannot change id, household, author, «fatto da» or creation time'
);
select ok(
  has_column_privilege('authenticated', 'public.todos', 'done_at', 'update')
  and has_column_privilege('authenticated', 'public.todos', 'title', 'update')
  and has_column_privilege('authenticated', 'public.todos', 'assignee_member_id', 'update')
  and has_column_privilege('authenticated', 'public.todos', 'for_member_id', 'update')
  and has_column_privilege('authenticated', 'public.todos', 'due_date', 'update')
  and has_column_privilege('authenticated', 'public.todos', 'is_private', 'update'),
  'the app marks done (#23) and edits the content (#22)'
);
select ok(
  not has_function_privilege('authenticated', 'private.todos_before_insert()', 'execute')
  and not has_function_privilege('authenticated', 'private.todos_before_update()', 'execute')
  and not has_function_privilege('authenticated', 'private.household_members_delete_private_todos()', 'execute')
  and not has_function_privilege('authenticated', 'private.purge_done_todos()', 'execute')
  and not has_function_privilege('anon', 'private.todos_check_assignee(uuid, uuid)', 'execute'),
  'internal functions of todos cannot be called by the app'
);
select results_eq(
  $$ select j.schedule, j.command, j.active from cron.job j where j.jobname = 'purge-done-todos' $$,
  $$ values ('17 3 * * *'::text, 'select private.purge_done_todos();'::text, true) $$,
  'one active job deletes every day the things done more than 90 days ago'
);

-- ---------------------------------------------------------------------------
-- Paolo (B2) creates his things
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';

select lives_ok(
  $$ insert into public.todos (title, is_private, assignee_member_id, due_date)
     values (E'  Comprare \t  i   fiori ', true, 'b1000000-0000-4000-8000-000000000002', '2026-11-03') $$,
  'B2 adds a «Solo io» thing that he takes care of (household omitted)'
);
select lives_ok(
  $$ insert into public.todos (household_id, title, assignee_member_id, for_member_id)
     values ('22222222-2222-4222-8222-222222222222', 'Ritirare il pacco',
             'b1000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000004') $$,
  'B2 adds a shared thing: Leo (child) takes care of it, for Anna'
);
select lives_ok(
  $$ insert into public.todos (title, assignee_member_id)
     values ('Lavare la macchina', 'b1000000-0000-4000-8000-000000000002') $$,
  'B2 adds a shared thing he takes care of'
);
select lives_ok(
  $$ insert into public.todos (title) values ('Cambiare la lampadina') $$,
  'B2 adds a shared thing with the title only (quick field of #23)'
);
select set_config('test.flowers', (select t.id::text from public.todos t where t.title = 'Comprare i fiori'), true);
select set_config('test.parcel', (select t.id::text from public.todos t where t.title = 'Ritirare il pacco'), true);
select set_config('test.car', (select t.id::text from public.todos t where t.title = 'Lavare la macchina'), true);
select set_config('test.bulb', (select t.id::text from public.todos t where t.title = 'Cambiare la lampadina'), true);

select results_eq(
  $$ select t.title, t.household_id, t.created_by_member_id, t.is_private, t.done_at, t.done_by_member_id
     from public.todos t where t.id = current_setting('test.flowers')::uuid $$,
  $$ values ('Comprare i fiori', '22222222-2222-4222-8222-222222222222'::uuid,
             'b1000000-0000-4000-8000-000000000002'::uuid, true, null::timestamptz, null::uuid) $$,
  'title cleaned of spaces, household and author = B2, to do'
);
select results_eq(
  $$ select t.is_private, t.assignee_member_id, t.for_member_id, t.due_date
     from public.todos t where t.id = current_setting('test.bulb')::uuid $$,
  $$ values (false, null::uuid, null::uuid, null::date) $$,
  'a thing with the title only is «Tutto il Nest», without people or date'
);

-- Writes the app cannot do.
select throws_ok(
  $$ insert into public.todos (title, created_by_member_id)
     values ('Falso autore', 'b1000000-0000-4000-8000-000000000001') $$,
  '42501', null,
  'B2 cannot choose the author'
);
select throws_ok(
  $$ insert into public.todos (id, title) values (gen_random_uuid(), 'Con id') $$,
  '42501', null,
  'B2 cannot choose the id'
);
select throws_ok(
  $$ insert into public.todos (title, done_at) values ('Già fatto', now()) $$,
  '42501', null,
  'B2 cannot add a thing already done'
);
select throws_ok(
  $$ insert into public.todos (household_id, title)
     values ('11111111-1111-4111-8111-111111111111', 'Intrusione') $$,
  '42501', null,
  'B2 cannot add a thing to Casa D''Angelo'
);

-- ---------------------------------------------------------------------------
-- Constraints
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.todos (title, assignee_member_id)
     values ('Assegnato fuori', 'a1000000-0000-4000-8000-000000000001') $$,
  '23514', null,
  'a member of another household cannot take care of it'
);
select throws_ok(
  $$ insert into public.todos (title, for_member_id)
     values ('Per fuori', 'a1000000-0000-4000-8000-000000000003') $$,
  '23503', null,
  'a member of another household cannot be «per chi è»'
);
select throws_ok(
  $$ insert into public.todos (title, is_private, assignee_member_id)
     values ('Solo io per Giulia', true, 'b1000000-0000-4000-8000-000000000001') $$,
  '23514', null,
  '«Solo io» with someone else taking care of it is refused'
);
select throws_ok(
  $$ insert into public.todos (title) values (E' \t ') $$,
  '23514', null,
  'blank title refused'
);
select throws_ok(
  $$ insert into public.todos (title) values (repeat('x', 81)) $$,
  '23514', null,
  'title longer than 80 characters refused'
);
select lives_ok(
  $$ insert into public.todos (title) values (repeat('x', 80)) $$,
  'title of 80 characters accepted'
);
select throws_ok(
  $$ update public.todos set assignee_member_id = 'b1000000-0000-4000-8000-000000000001'
     where id = current_setting('test.flowers')::uuid $$,
  '23514', null,
  '«Solo io» cannot be given to someone else on update either'
);

-- ---------------------------------------------------------------------------
-- «Fatto il» and «fatto da»
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ update public.todos set done_at = now() - interval '30 days 1 second'
     where id = current_setting('test.car')::uuid $$,
  '23514', null,
  '«fatto il» more than 30 days ago is refused'
);
select throws_ok(
  $$ update public.todos set done_at = now() + interval '5 minutes 1 second'
     where id = current_setting('test.car')::uuid $$,
  '23514', null,
  '«fatto il» more than 5 minutes in the future is refused'
);
select throws_ok(
  $$ update public.todos set done_at = 'infinity' where id = current_setting('test.car')::uuid $$,
  '23514', null,
  '«fatto il» infinity is refused'
);
select results_eq(
  $$ with u as (update public.todos set done_at = now() - interval '30 days'
                where id = current_setting('test.car')::uuid returning 1)
     select count(*)::integer from u $$,
  $$ values (1) $$,
  'B2 marks done with «fatto il» exactly 30 days ago (offline queue, tests)'
);
select results_eq(
  $$ select t.done_at, t.done_by_member_id from public.todos t where t.id = current_setting('test.car')::uuid $$,
  $$ values (now() - interval '30 days', 'b1000000-0000-4000-8000-000000000002'::uuid) $$,
  'the time sent is kept and «fatto da» is B2'
);
select lives_ok(
  $$ update public.todos set done_at = now() + interval '5 minutes'
     where id = current_setting('test.bulb')::uuid $$,
  '«fatto il» up to 5 minutes in the future is accepted (clock of the browser)'
);
select lives_ok(
  $$ update public.todos set done_at = now() - interval '1 day'
     where id = current_setting('test.car')::uuid $$,
  'marking done again a thing already done does not fail'
);
select is(
  (select t.done_at from public.todos t where t.id = current_setting('test.car')::uuid),
  now() - interval '30 days',
  'and keeps the first «fatto il»'
);
select throws_ok(
  $$ update public.todos set done_by_member_id = 'b1000000-0000-4000-8000-000000000001'
     where id = current_setting('test.car')::uuid $$,
  '42501', null,
  'B2 cannot choose «fatto da»'
);
select lives_ok(
  $$ update public.todos set done_at = null where id = current_setting('test.bulb')::uuid $$,
  'B2 puts a thing back to do'
);
select results_eq(
  $$ select t.done_at, t.done_by_member_id from public.todos t where t.id = current_setting('test.bulb')::uuid $$,
  $$ values (null::timestamptz, null::uuid) $$,
  'a thing back to do has no «fatto da»'
);
select is(
  (select t.updated_at >= t.created_at from public.todos t where t.id = current_setting('test.bulb')::uuid),
  true,
  'updated_at is maintained'
);

-- ---------------------------------------------------------------------------
-- Giulia (B): the «Solo io» things of Paolo do not exist for her
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';

select lives_ok(
  $$ insert into public.todos (title, is_private) values ('Sorpresa per Paolo', true) $$,
  'B adds a «Solo io» thing'
);
select set_config('test.surprise', (select t.id::text from public.todos t where t.title = 'Sorpresa per Paolo'), true);

select results_eq(
  $$ select t.title from public.todos t where t.household_id = '22222222-2222-4222-8222-222222222222'
     and t.title <> repeat('x', 80) order by t.created_at, t.title $$,
  $$ values ('Prenotare la palestra'), ('Cambiare la lampadina'), ('Lavare la macchina'),
            ('Ritirare il pacco'), ('Sorpresa per Paolo') $$,
  'B reads the shared things and her own «Solo io», not the «Solo io» of B2'
);
select is(
  (select count(*)::integer from public.todos t where t.done_at is null),
  5,
  'B does not count the «Solo io» things of B2 (counter of the selector)'
);
select is_empty(
  $$ select 1 from public.todos t
     where t.id in ('b4000000-0000-4000-8000-000000000001', current_setting('test.flowers')::uuid) $$,
  'B reads 0 «Solo io» things of B2, even by id'
);
select results_eq(
  $$ with u as (update public.todos set done_at = now()
                where id in ('b4000000-0000-4000-8000-000000000001', current_setting('test.flowers')::uuid) returning 1)
     select count(*)::integer from u $$,
  $$ values (0) $$,
  'B marks done 0 «Solo io» things of B2'
);
select results_eq(
  $$ with u as (update public.todos set title = 'Cambiato'
                where id in ('b4000000-0000-4000-8000-000000000001', current_setting('test.flowers')::uuid) returning 1)
     select count(*)::integer from u $$,
  $$ values (0) $$,
  'B changes 0 «Solo io» things of B2'
);
select results_eq(
  $$ with d as (delete from public.todos
                where id in ('b4000000-0000-4000-8000-000000000001', current_setting('test.flowers')::uuid) returning 1)
     select count(*)::integer from d $$,
  $$ values (0) $$,
  'B deletes 0 «Solo io» things of B2'
);

-- Giulia works on the shared things, also those of Paolo.
select results_eq(
  $$ with u as (update public.todos set done_at = now() - interval '2 hours'
                where id = 'b4000000-0000-4000-8000-000000000002' returning 1)
     select count(*)::integer from u $$,
  $$ values (1) $$,
  'B marks done a shared thing Paolo takes care of'
);
select results_eq(
  $$ select t.done_at, t.done_by_member_id from public.todos t where t.id = 'b4000000-0000-4000-8000-000000000002' $$,
  $$ values (now() - interval '2 hours', 'b1000000-0000-4000-8000-000000000001'::uuid) $$,
  '«fatto da» is B, who marked it'
);
select results_eq(
  $$ with u as (update public.todos set title = '  Ritirare   il pacco grande ', due_date = '2026-11-05'
                where id = current_setting('test.parcel')::uuid returning 1)
     select count(*)::integer from u $$,
  $$ values (1) $$,
  'B changes title and date of a shared thing of B2 (#22)'
);
select is(
  (select t.title from public.todos t where t.id = current_setting('test.parcel')::uuid),
  'Ritirare il pacco grande',
  'the changed title is cleaned of spaces'
);
select throws_ok(
  $$ update public.todos set is_private = true, assignee_member_id = null
     where id = current_setting('test.parcel')::uuid $$,
  '42501', null,
  'B cannot make «Solo io» a thing created by B2'
);
select throws_ok(
  $$ update public.todos set household_id = '11111111-1111-4111-8111-111111111111'
     where id = current_setting('test.parcel')::uuid $$,
  '42501', null,
  'B cannot move a thing to another household'
);
select throws_ok(
  $$ update public.todos set is_private = true where id = 'b4000000-0000-4000-8000-000000000002' $$,
  '23514', null,
  'B cannot make «Solo io» her thing while Paolo takes care of it'
);
select lives_ok(
  $$ update public.todos set for_member_id = 'b1000000-0000-4000-8000-000000000004'
     where id = 'b4000000-0000-4000-8000-000000000002' $$,
  'B sets Anna as «per chi è» of her thing'
);

-- Paolo does not see the «Solo io» of Giulia.
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select is_empty(
  $$ select 1 from public.todos t where t.id = current_setting('test.surprise')::uuid $$,
  'B2 reads 0 «Solo io» things of B'
);
select is(
  (select count(*)::integer from public.todos t where t.done_at is null and t.title <> repeat('x', 80)),
  4,
  'B2 counts his «Solo io» things and the shared ones, not the «Solo io» of B'
);
select results_eq(
  $$ with u as (update public.todos set done_at = now() where id = current_setting('test.surprise')::uuid returning 1)
     select count(*)::integer from u $$,
  $$ values (0) $$,
  'B2 marks done 0 «Solo io» things of B'
);
select results_eq(
  $$ with d as (delete from public.todos where id = current_setting('test.surprise')::uuid returning 1)
     select count(*)::integer from d $$,
  $$ values (0) $$,
  'B2 deletes 0 «Solo io» things of B'
);
-- The author makes a shared thing «Solo io»; then the others no longer see it.
select lives_ok(
  $$ update public.todos set is_private = true, assignee_member_id = null
     where id = current_setting('test.parcel')::uuid $$,
  'B2 makes his shared thing «Solo io» (nobody else takes care of it)'
);
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select is_empty(
  $$ select 1 from public.todos t where t.id = current_setting('test.parcel')::uuid $$,
  'B no longer reads it'
);

-- ---------------------------------------------------------------------------
-- Marco (A, Casa D'Angelo) sees and touches nothing of Casa Bianchi
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';

select results_eq(
  $$ select t.title from public.todos t order by t.created_at $$,
  $$ values ('Firmare autorizzazione gita'), ('Comprare la cuffia da nuoto'), ('Sistemare la cantina'),
            ('Portare le scarpe dal calzolaio') $$,
  'A reads the things of Casa D''Angelo, and only those'
);
select is_empty(
  $$ select 1 from public.todos t where t.household_id = '22222222-2222-4222-8222-222222222222' $$,
  'A reads 0 things of Casa Bianchi'
);
select results_eq(
  $$ with u as (update public.todos set done_at = now() where household_id = '22222222-2222-4222-8222-222222222222' returning 1)
     select count(*)::integer from u $$,
  $$ values (0) $$,
  'A marks done 0 things of Casa Bianchi'
);
select results_eq(
  $$ with u as (update public.todos set title = 'Preso' where id = 'b4000000-0000-4000-8000-000000000002' returning 1)
     select count(*)::integer from u $$,
  $$ values (0) $$,
  'A changes 0 things of Casa Bianchi'
);
select results_eq(
  $$ with d as (delete from public.todos where household_id = '22222222-2222-4222-8222-222222222222' returning 1)
     select count(*)::integer from d $$,
  $$ values (0) $$,
  'A deletes 0 things of Casa Bianchi'
);
select throws_ok(
  $$ insert into public.todos (household_id, title)
     values ('22222222-2222-4222-8222-222222222222', 'Prenotare la palestra') $$,
  '42501', null,
  'A cannot add a thing to Casa Bianchi'
);
select throws_ok(
  $$ insert into public.todos (household_id, title, assignee_member_id)
     values ('22222222-2222-4222-8222-222222222222', 'Intrusione', 'b1000000-0000-4000-8000-000000000001') $$,
  '42501', null,
  'A cannot add a thing to Casa Bianchi naming one of its members'
);
select throws_ok(
  $$ insert into public.todos (title, assignee_member_id) values ('Passeggiata', 'a1000000-0000-4000-8000-000000000005') $$,
  '23514', null,
  'a pet cannot take care of a thing'
);
select lives_ok(
  $$ insert into public.todos (title, assignee_member_id, for_member_id, due_date)
     values ('Comprare le crocchette', 'a1000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000005', '2026-11-02') $$,
  'a child takes care of a thing for a pet'
);
select throws_ok(
  $$ update public.todos set assignee_member_id = 'a1000000-0000-4000-8000-000000000005'
     where title = 'Comprare le crocchette' $$,
  '23514', null,
  'a pet cannot take care of a thing on update either'
);
select results_eq(
  $$ with d as (delete from public.todos where title = 'Comprare le crocchette' returning 1)
     select count(*)::integer from d $$,
  $$ values (1) $$,
  'A deletes a shared thing of Casa D''Angelo (page tests, «Elimina» of #22)'
);

-- B sees and touches nothing of Casa D'Angelo.
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select is_empty(
  $$ select 1 from public.todos t where t.household_id = '11111111-1111-4111-8111-111111111111' $$,
  'B reads 0 things of Casa D''Angelo'
);
select results_eq(
  $$ with u as (update public.todos set done_at = null where id = 'a4000000-0000-4000-8000-000000000004' returning 1)
     select count(*)::integer from u $$,
  $$ values (0) $$,
  'B puts back to do 0 things of Casa D''Angelo'
);
select results_eq(
  $$ with d as (delete from public.todos where household_id = '11111111-1111-4111-8111-111111111111' returning 1)
     select count(*)::integer from d $$,
  $$ values (0) $$,
  'B deletes 0 things of Casa D''Angelo'
);

-- ---------------------------------------------------------------------------
-- Chiara (C, no household) and anonymous users
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}';
select is_empty($$ select 1 from public.todos $$, 'C reads 0 things');
select throws_ok(
  $$ insert into public.todos (title) values ('Senza Nest') $$,
  '42501', null,
  'C cannot add things'
);
select throws_ok(
  $$ insert into public.todos (household_id, title) values ('22222222-2222-4222-8222-222222222222', 'Senza Nest') $$,
  '42501', null,
  'C cannot add things to Casa Bianchi'
);
select results_eq(
  $$ with u as (update public.todos set done_at = now() returning 1) select count(*)::integer from u $$,
  $$ values (0) $$,
  'C marks done 0 things'
);

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok($$ select 1 from public.todos $$, '42501', null, 'anon cannot read todos');
select throws_ok(
  $$ insert into public.todos (household_id, title) values ('22222222-2222-4222-8222-222222222222', 'Anonimo') $$,
  '42501', null,
  'anon cannot add things'
);
select throws_ok($$ update public.todos set done_at = now() $$, '42501', null, 'anon cannot mark things done');
select throws_ok($$ delete from public.todos $$, '42501', null, 'anon cannot delete things');

-- ---------------------------------------------------------------------------
-- Checks as the database owner
-- ---------------------------------------------------------------------------
reset role;

select results_eq(
  $$ select t.title, t.done_at is not null, t.done_by_member_id from public.todos t
     where t.id = 'b4000000-0000-4000-8000-000000000001'
     union all
     select t.title, t.done_at is not null, t.done_by_member_id from public.todos t
     where t.id = current_setting('test.surprise')::uuid
     union all
     select t.title, t.done_at is not null, t.done_by_member_id from public.todos t
     where t.id = 'a4000000-0000-4000-8000-000000000004' $$,
  $$ values ('Prenotare il ristorante', false, null::uuid), ('Sorpresa per Paolo', false, null::uuid),
            ('Portare le scarpe dal calzolaio', true, 'a1000000-0000-4000-8000-000000000001'::uuid) $$,
  'the refused writes changed nothing'
);

-- The cleanup after 90 days (the command of the pg_cron job, run as the owner like the job).
insert into public.todos (household_id, title, created_by_member_id, done_at, done_by_member_id, created_at)
values
  ('22222222-2222-4222-8222-222222222222', 'Fatto 91 giorni fa', 'b1000000-0000-4000-8000-000000000001',
   now() - interval '91 days', 'b1000000-0000-4000-8000-000000000001', now() - interval '100 days'),
  ('22222222-2222-4222-8222-222222222222', 'Fatto 89 giorni fa', 'b1000000-0000-4000-8000-000000000001',
   now() - interval '89 days', 'b1000000-0000-4000-8000-000000000001', now() - interval '100 days'),
  ('11111111-1111-4111-8111-111111111111', 'Vecchio da fare', 'a1000000-0000-4000-8000-000000000001',
   null, null, now() - interval '200 days');
select lives_ok(
  (select j.command from cron.job j where j.jobname = 'purge-done-todos'),
  'the cleanup job runs'
);
select results_eq(
  $$ select t.title from public.todos t where t.title in ('Fatto 91 giorni fa', 'Fatto 89 giorni fa', 'Vecchio da fare')
     order by t.title $$,
  $$ values ('Fatto 89 giorni fa'), ('Vecchio da fare') $$,
  'things done more than 90 days ago are deleted; recent ones and things to do stay'
);

-- A member removed from the household (by the administrator, through the API): their
-- «Solo io» things go, their shared things stay without author.
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok(
  $$ delete from public.household_members where id = 'b1000000-0000-4000-8000-000000000004' $$,
  'B (admin) removes Anna from the household'
);
select results_eq(
  $$ select t.for_member_id from public.todos t where t.id = 'b4000000-0000-4000-8000-000000000002' $$,
  $$ values (null::uuid) $$,
  'the thing for Anna stays, without «per chi è»'
);
select lives_ok(
  $$ delete from public.household_members where id = 'b1000000-0000-4000-8000-000000000002' $$,
  'B (admin) removes Paolo from the household'
);
reset role;
select is_empty(
  $$ select 1 from public.todos t
     where t.id in ('b4000000-0000-4000-8000-000000000001', current_setting('test.flowers')::uuid,
                    current_setting('test.parcel')::uuid) $$,
  'the «Solo io» things of Paolo are deleted with him'
);
select results_eq(
  $$ select t.title, t.created_by_member_id, t.assignee_member_id, t.done_at, t.done_by_member_id
     from public.todos t where t.id = current_setting('test.car')::uuid $$,
  $$ values ('Lavare la macchina', null::uuid, null::uuid, now() - interval '30 days', null::uuid) $$,
  'a shared thing of Paolo stays, without author, assignee and «fatto da», still done'
);
select results_eq(
  $$ select t.assignee_member_id, t.done_by_member_id from public.todos t where t.id = 'b4000000-0000-4000-8000-000000000002' $$,
  $$ values (null::uuid, 'b1000000-0000-4000-8000-000000000001'::uuid) $$,
  'the thing of Giulia that Paolo took care of stays, without assignee'
);
select is(
  (select t.title from public.todos t where t.id = current_setting('test.surprise')::uuid),
  'Sorpresa per Paolo',
  'the «Solo io» things of the others stay'
);

set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select is(
  (select t.title from public.todos t where t.id = current_setting('test.car')::uuid),
  'Lavare la macchina',
  'B still reads the thing without author'
);
select throws_ok(
  $$ update public.todos set is_private = true where id = current_setting('test.car')::uuid $$,
  '42501', null,
  'nobody makes «Solo io» a thing without author'
);
reset role;

-- A household deleted with its last account: every thing to do goes.
select lives_ok(
  $$ delete from auth.users where id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  'the account of A (last account of Casa D''Angelo) is deleted'
);
select is_empty(
  $$ select 1 from public.todos t where t.household_id = '11111111-1111-4111-8111-111111111111' $$,
  'Casa D''Angelo is deleted with all its things to do'
);

select * from finish();
rollback;
