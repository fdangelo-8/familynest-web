-- deadlines: schema, privileges, isolation between households, «Solo io», constraints,
-- reminders, cleanup when a member leaves (issue #108, for #24 and #22).
-- Seed ids: A = Marco (Casa D'Angelo), B = Giulia (Casa Bianchi, admin),
-- B2 = Paolo (Casa Bianchi, not admin), C = Chiara (no household).
-- Members: Casa Bianchi Giulia b1…01, Paolo b1…02, Leo b1…03 (child), Anna b1…04 (adult
-- without account); Casa D'Angelo Marco a1…01, Laura a1…02, Sofia a1…03 (child),
-- Tommaso a1…04 (child), Biscotto a1…05 (pet).
-- Seed deadlines: Casa D'Angelo a5…01 «Rinnovo carta d'identità di Sofia», a5…02
-- «Bollo dell'auto» (created by Marco); Casa Bianchi b5…01 «Revisione della caldaia»
-- (created by Giulia, Paolo takes care of it), b5…02 «Rinnovo del passaporto» («Solo io»
-- of Paolo).
-- No health data (D1).
begin;
create extension if not exists pgtap with schema extensions;

select plan(117);

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------
select has_table('public', 'deadlines', 'deadlines exists');
select ok(
  (select c.relrowsecurity from pg_class c where c.oid = 'public.deadlines'::regclass),
  'RLS enabled on deadlines'
);
select columns_are(
  'public', 'deadlines',
  array[
    'id', 'household_id', 'title', 'due_date', 'note', 'created_by_member_id', 'assignee_member_id',
    'for_member_id', 'is_private', 'reminder_days', 'created_at', 'updated_at'
  ],
  'deadlines has exactly the planned columns (no health data)'
);
select col_not_null('public', 'deadlines', 'due_date', 'the due date is mandatory');
select fk_ok(
  'public', 'deadlines', 'household_id', 'public', 'households', 'id',
  'deadlines.household_id references households'
);
select fk_ok(
  'public', 'deadlines', array['created_by_member_id', 'household_id'],
  'public', 'household_members', array['id', 'household_id'],
  'the author is a member of the same household'
);
select fk_ok(
  'public', 'deadlines', array['assignee_member_id', 'household_id'],
  'public', 'household_members', array['id', 'household_id'],
  'who takes care of it is a member of the same household'
);
select fk_ok(
  'public', 'deadlines', array['for_member_id', 'household_id'],
  'public', 'household_members', array['id', 'household_id'],
  '«riguarda» is a member of the same household'
);
select has_index('public', 'deadlines', 'deadlines_household_due_idx', 'index on deadlines (household_id, due_date, created_at)');
select has_index('public', 'deadlines', 'deadlines_created_by_member_id_idx', 'index on deadlines.created_by_member_id');
select has_index('public', 'deadlines', 'deadlines_assignee_member_id_idx', 'index on deadlines.assignee_member_id');
select has_index('public', 'deadlines', 'deadlines_for_member_id_idx', 'index on deadlines.for_member_id');
select ok(
  not exists (
    select 1 from pg_publication_tables p
    where p.pubname = 'supabase_realtime' and p.schemaname = 'public' and p.tablename = 'deadlines'
  ),
  'deadlines is not sent in real time (issue #24, question 11)'
);

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
select ok(
  not has_table_privilege('anon', 'public.deadlines', 'select, insert, update, delete'),
  'anon has no privilege on deadlines'
);
select ok(
  not has_column_privilege('authenticated', 'public.deadlines', 'id', 'insert')
  and not has_column_privilege('authenticated', 'public.deadlines', 'created_by_member_id', 'insert')
  and not has_column_privilege('authenticated', 'public.deadlines', 'created_at', 'insert')
  and not has_column_privilege('authenticated', 'public.deadlines', 'updated_at', 'insert'),
  'the app cannot choose id, author or row times of a new deadline'
);
select ok(
  not has_column_privilege('authenticated', 'public.deadlines', 'id', 'update')
  and not has_column_privilege('authenticated', 'public.deadlines', 'household_id', 'update')
  and not has_column_privilege('authenticated', 'public.deadlines', 'created_by_member_id', 'update')
  and not has_column_privilege('authenticated', 'public.deadlines', 'created_at', 'update'),
  'the app cannot change id, household, author or creation time'
);
select ok(
  has_column_privilege('authenticated', 'public.deadlines', 'title', 'update')
  and has_column_privilege('authenticated', 'public.deadlines', 'due_date', 'update')
  and has_column_privilege('authenticated', 'public.deadlines', 'note', 'update')
  and has_column_privilege('authenticated', 'public.deadlines', 'assignee_member_id', 'update')
  and has_column_privilege('authenticated', 'public.deadlines', 'for_member_id', 'update')
  and has_column_privilege('authenticated', 'public.deadlines', 'is_private', 'update')
  and has_column_privilege('authenticated', 'public.deadlines', 'reminder_days', 'update'),
  'the app edits the content of a deadline (#22)'
);
select ok(
  not has_function_privilege('authenticated', 'private.deadlines_before_insert()', 'execute')
  and not has_function_privilege('authenticated', 'private.deadlines_before_update()', 'execute')
  and not has_function_privilege('authenticated', 'private.household_members_delete_private_deadlines()', 'execute')
  and not has_function_privilege('anon', 'private.deadlines_check_assignee(uuid, uuid)', 'execute')
  and not has_function_privilege('anon', 'private.deadlines_normalize(public.deadlines)', 'execute')
  and not has_function_privilege('anon', 'private.deadlines_reminder_days_valid(smallint[])', 'execute'),
  'internal functions of deadlines cannot be called by the app'
);

-- ---------------------------------------------------------------------------
-- Paolo (B2) creates his deadlines
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';

select lives_ok(
  $$ insert into public.deadlines (title, due_date, note, is_private, assignee_member_id, reminder_days)
     values (E'  Rinnovo \t della   patente ', '2027-01-12', E' Prima   della  vacanza ', true,
             'b1000000-0000-4000-8000-000000000002', '{0,30}') $$,
  'B2 adds a «Solo io» deadline that he takes care of (household omitted)'
);
select lives_ok(
  $$ insert into public.deadlines (household_id, title, due_date, assignee_member_id, for_member_id)
     values ('22222222-2222-4222-8222-222222222222', 'Rinnovo abbonamento del bus', '2026-11-30',
             'b1000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000004') $$,
  'B2 adds a shared deadline: Leo (child) takes care of it, it concerns Anna'
);
select lives_ok(
  $$ insert into public.deadlines (title, due_date) values ('Assicurazione dello scooter', '2026-12-07') $$,
  'B2 adds a shared deadline with title and date only'
);
select set_config('test.licence', (select d.id::text from public.deadlines d where d.title = 'Rinnovo della patente'), true);
select set_config('test.bus', (select d.id::text from public.deadlines d where d.title = 'Rinnovo abbonamento del bus'), true);
select set_config('test.scooter', (select d.id::text from public.deadlines d where d.title = 'Assicurazione dello scooter'), true);

select results_eq(
  $$ select d.title, d.note, d.household_id, d.created_by_member_id, d.is_private, d.reminder_days
     from public.deadlines d where d.id = current_setting('test.licence')::uuid $$,
  $$ values ('Rinnovo della patente', 'Prima della vacanza', '22222222-2222-4222-8222-222222222222'::uuid,
             'b1000000-0000-4000-8000-000000000002'::uuid, true, '{30,0}'::smallint[]) $$,
  'title and note cleaned of spaces, household and author = B2, reminders sorted'
);
select results_eq(
  $$ select d.is_private, d.note, d.assignee_member_id, d.for_member_id, d.reminder_days
     from public.deadlines d where d.id = current_setting('test.scooter')::uuid $$,
  $$ values (false, null::text, null::uuid, null::uuid, '{30,7,1}'::smallint[]) $$,
  'a deadline with title and date only is «Tutto il Nest», without note or people, reminders 30, 7 and 1'
);

-- Accepted limits (rows named «Prova …», deleted right after by their author).
select lives_ok(
  $$ insert into public.deadlines (title, due_date, reminder_days) values ('Prova senza avvisi', '2026-12-01', '{}') $$,
  'no reminder at all is accepted'
);
select lives_ok(
  $$ insert into public.deadlines (title, due_date, reminder_days)
     values ('Prova tutti gli avvisi', '2026-12-01', '{1,0,7,30}') $$,
  'the four reminders together are accepted'
);
select is(
  (select d.reminder_days from public.deadlines d where d.title = 'Prova tutti gli avvisi'),
  '{30,7,1,0}'::smallint[],
  'and stored from the farthest'
);
select lives_ok(
  $$ insert into public.deadlines (title, due_date) values ('Prova ' || repeat('x', 74), '2026-12-01') $$,
  'title of 80 characters accepted'
);
select lives_ok(
  $$ insert into public.deadlines (title, due_date, note) values ('Prova nota lunga', '2026-12-01', repeat('n', 80)) $$,
  'note of 80 characters accepted'
);
select lives_ok(
  $$ insert into public.deadlines (title, due_date) values ('Prova già scaduta', '2026-10-15') $$,
  'a past day is accepted'
);
select results_eq(
  $$ with d as (delete from public.deadlines where title like 'Prova %' returning 1)
     select count(*)::integer from d $$,
  $$ values (5) $$,
  'B2 deletes his own deadlines'
);

-- Writes the app cannot do.
select throws_ok(
  $$ insert into public.deadlines (title, due_date, created_by_member_id)
     values ('Falso autore', '2026-12-01', 'b1000000-0000-4000-8000-000000000001') $$,
  '42501', null,
  'B2 cannot choose the author'
);
select throws_ok(
  $$ insert into public.deadlines (id, title, due_date) values (gen_random_uuid(), 'Con id', '2026-12-01') $$,
  '42501', null,
  'B2 cannot choose the id'
);
select throws_ok(
  $$ insert into public.deadlines (title, due_date, created_at) values ('Con data', '2026-12-01', now()) $$,
  '42501', null,
  'B2 cannot choose the creation time'
);
select throws_ok(
  $$ insert into public.deadlines (household_id, title, due_date)
     values ('11111111-1111-4111-8111-111111111111', 'Intrusione', '2026-12-01') $$,
  '42501', null,
  'B2 cannot add a deadline to Casa D''Angelo'
);

-- ---------------------------------------------------------------------------
-- Constraints
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.deadlines (title) values ('Senza data') $$,
  '23502', null,
  'a deadline without date is refused'
);
select throws_ok(
  $$ insert into public.deadlines (title, due_date, assignee_member_id)
     values ('Assegnata fuori', '2026-12-01', 'a1000000-0000-4000-8000-000000000001') $$,
  '23514', null,
  'a member of another household cannot take care of it'
);
select throws_ok(
  $$ insert into public.deadlines (title, due_date, for_member_id)
     values ('Riguarda fuori', '2026-12-01', 'a1000000-0000-4000-8000-000000000003') $$,
  '23503', null,
  'a member of another household cannot be «riguarda»'
);
select throws_ok(
  $$ insert into public.deadlines (title, due_date, is_private, assignee_member_id)
     values ('Solo io per Giulia', '2026-12-01', true, 'b1000000-0000-4000-8000-000000000001') $$,
  '23514', null,
  '«Solo io» with someone else taking care of it is refused'
);
select throws_ok(
  $$ insert into public.deadlines (title, due_date) values (E' \t ', '2026-12-01') $$,
  '23514', null,
  'blank title refused'
);
select throws_ok(
  $$ insert into public.deadlines (title, due_date) values (repeat('x', 81), '2026-12-01') $$,
  '23514', null,
  'title longer than 80 characters refused'
);
select throws_ok(
  $$ insert into public.deadlines (title, due_date, note) values ('Nota vuota', '2026-12-01', '   ') $$,
  '23514', null,
  'blank note refused (no note is null)'
);
select throws_ok(
  $$ insert into public.deadlines (title, due_date, note) values ('Nota lunga', '2026-12-01', repeat('n', 81)) $$,
  '23514', null,
  'note longer than 80 characters refused'
);
select throws_ok(
  $$ insert into public.deadlines (title, due_date, reminder_days) values ('Avviso strano', '2026-12-01', '{14}') $$,
  '23514', null,
  'a reminder other than 30, 7, 1 and 0 days is refused'
);
select throws_ok(
  $$ insert into public.deadlines (title, due_date, reminder_days) values ('Avviso doppio', '2026-12-01', '{7,7}') $$,
  '23514', null,
  'the same reminder twice is refused'
);
select throws_ok(
  $$ insert into public.deadlines (title, due_date, reminder_days) values ('Avviso nullo', '2026-12-01', '{30,NULL}') $$,
  '23514', null,
  'an empty reminder is refused'
);
select throws_ok(
  $$ insert into public.deadlines (title, due_date, reminder_days) values ('Avvisi a tabella', '2026-12-01', '{{30,7}}') $$,
  '23514', null,
  'a two-dimensional list of reminders is refused'
);
select throws_ok(
  $$ insert into public.deadlines (title, due_date, reminder_days) values ('Avvisi nulli', '2026-12-01', null) $$,
  '23502', null,
  'a null list of reminders is refused'
);
select throws_ok(
  $$ insert into public.deadlines (title, due_date) values ('Anno sbagliato', '0202-12-01') $$,
  '23514', null,
  'a day before the year 2000 is refused'
);
select throws_ok(
  $$ insert into public.deadlines (title, due_date) values ('Per sempre', 'infinity') $$,
  '23514', null,
  'an infinite day is refused'
);
select throws_ok(
  $$ update public.deadlines set assignee_member_id = 'b1000000-0000-4000-8000-000000000001'
     where id = current_setting('test.licence')::uuid $$,
  '23514', null,
  '«Solo io» cannot be given to someone else on update either'
);
select throws_ok(
  $$ update public.deadlines set reminder_days = '{2}' where id = current_setting('test.scooter')::uuid $$,
  '23514', null,
  'a reminder not allowed is refused on update too'
);
select lives_ok(
  $$ update public.deadlines set reminder_days = '{1,7}', note = '  Due   ruote ' where id = current_setting('test.scooter')::uuid $$,
  'B2 changes reminders and note of his deadline'
);
select results_eq(
  $$ select d.reminder_days, d.note, d.updated_at >= d.created_at
     from public.deadlines d where d.id = current_setting('test.scooter')::uuid $$,
  $$ values ('{7,1}'::smallint[], 'Due ruote', true) $$,
  'reminders sorted, note cleaned, updated_at maintained'
);

-- B2 works on the shared deadline created by Giulia.
select results_eq(
  $$ with u as (update public.deadlines set note = 'Chiamare il tecnico', due_date = '2026-11-12'
                where id = 'b5000000-0000-4000-8000-000000000001' returning 1)
     select count(*)::integer from u $$,
  $$ values (1) $$,
  'B2 changes a shared deadline created by B'
);
select throws_ok(
  $$ update public.deadlines set is_private = true, assignee_member_id = null
     where id = 'b5000000-0000-4000-8000-000000000001' $$,
  '42501', null,
  'B2 cannot make «Solo io» a deadline created by B'
);

-- ---------------------------------------------------------------------------
-- Giulia (B): the «Solo io» deadlines of Paolo do not exist for her
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';

select lives_ok(
  $$ insert into public.deadlines (title, due_date, is_private) values ('Regalo di compleanno per Paolo', '2026-12-20', true) $$,
  'B adds a «Solo io» deadline'
);
select lives_ok(
  $$ insert into public.deadlines (title, due_date) values ('Rinnovo dell''assicurazione', '2026-12-15') $$,
  'B adds a shared deadline'
);
select set_config('test.gift', (select d.id::text from public.deadlines d where d.title = 'Regalo di compleanno per Paolo'), true);
select set_config('test.insurance', (select d.id::text from public.deadlines d where d.title = 'Rinnovo dell''assicurazione'), true);

select results_eq(
  $$ select d.title from public.deadlines d order by d.due_date, d.created_at $$,
  $$ values ('Revisione della caldaia'), ('Rinnovo abbonamento del bus'), ('Assicurazione dello scooter'),
            ('Rinnovo dell''assicurazione'), ('Regalo di compleanno per Paolo') $$,
  'B reads the shared deadlines and her own «Solo io», not the «Solo io» of B2, in date order'
);
select is(
  (select count(*)::integer from public.deadlines),
  5,
  'B does not count the «Solo io» deadlines of B2 (counter of the selector)'
);
select is_empty(
  $$ select 1 from public.deadlines d
     where d.id in ('b5000000-0000-4000-8000-000000000002', current_setting('test.licence')::uuid) $$,
  'B reads 0 «Solo io» deadlines of B2, even by id'
);
select results_eq(
  $$ with u as (update public.deadlines set title = 'Cambiato'
                where id in ('b5000000-0000-4000-8000-000000000002', current_setting('test.licence')::uuid) returning 1)
     select count(*)::integer from u $$,
  $$ values (0) $$,
  'B changes 0 «Solo io» deadlines of B2'
);
select results_eq(
  $$ with u as (update public.deadlines set is_private = false
                where id in ('b5000000-0000-4000-8000-000000000002', current_setting('test.licence')::uuid) returning 1)
     select count(*)::integer from u $$,
  $$ values (0) $$,
  'B cannot share the «Solo io» deadlines of B2'
);
select results_eq(
  $$ with d as (delete from public.deadlines
                where id in ('b5000000-0000-4000-8000-000000000002', current_setting('test.licence')::uuid) returning 1)
     select count(*)::integer from d $$,
  $$ values (0) $$,
  'B deletes 0 «Solo io» deadlines of B2'
);

-- Giulia works on the shared deadlines, also those of Paolo.
select results_eq(
  $$ with u as (update public.deadlines set title = '  Rinnovo   abbonamento del treno ', due_date = '2026-12-01'
                where id = current_setting('test.bus')::uuid returning 1)
     select count(*)::integer from u $$,
  $$ values (1) $$,
  'B changes title and date of a shared deadline of B2 (#22)'
);
select is(
  (select d.title from public.deadlines d where d.id = current_setting('test.bus')::uuid),
  'Rinnovo abbonamento del treno',
  'the changed title is cleaned of spaces'
);
select throws_ok(
  $$ update public.deadlines set is_private = true where id = current_setting('test.scooter')::uuid $$,
  '42501', null,
  'B cannot make «Solo io» a deadline created by B2'
);
select throws_ok(
  $$ update public.deadlines set household_id = '11111111-1111-4111-8111-111111111111'
     where id = current_setting('test.bus')::uuid $$,
  '42501', null,
  'B cannot move a deadline to another household'
);
select throws_ok(
  $$ update public.deadlines set created_by_member_id = 'b1000000-0000-4000-8000-000000000001'
     where id = current_setting('test.bus')::uuid $$,
  '42501', null,
  'B cannot become the author of a deadline of B2'
);
select throws_ok(
  $$ update public.deadlines set is_private = true where id = 'b5000000-0000-4000-8000-000000000001' $$,
  '23514', null,
  'B cannot make «Solo io» her deadline while Paolo takes care of it'
);
select lives_ok(
  $$ update public.deadlines set is_private = true, assignee_member_id = null
     where id = 'b5000000-0000-4000-8000-000000000001' $$,
  'B makes her deadline «Solo io» (nobody else takes care of it)'
);

-- ---------------------------------------------------------------------------
-- Paolo (B2): the «Solo io» deadlines of Giulia do not exist for him
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';

select is_empty(
  $$ select 1 from public.deadlines d
     where d.id in (current_setting('test.gift')::uuid, 'b5000000-0000-4000-8000-000000000001') $$,
  'B2 reads 0 «Solo io» deadlines of B (also the one just made «Solo io»)'
);
select is(
  (select count(*)::integer from public.deadlines),
  5,
  'B2 counts his «Solo io» deadlines and the shared ones, not the «Solo io» of B'
);
select results_eq(
  $$ with u as (update public.deadlines set due_date = '2026-12-31'
                where id in (current_setting('test.gift')::uuid, 'b5000000-0000-4000-8000-000000000001') returning 1)
     select count(*)::integer from u $$,
  $$ values (0) $$,
  'B2 changes 0 «Solo io» deadlines of B'
);
select results_eq(
  $$ with d as (delete from public.deadlines
                where id in (current_setting('test.gift')::uuid, 'b5000000-0000-4000-8000-000000000001') returning 1)
     select count(*)::integer from d $$,
  $$ values (0) $$,
  'B2 deletes 0 «Solo io» deadlines of B'
);
select results_eq(
  $$ with d as (delete from public.deadlines where id = current_setting('test.insurance')::uuid returning 1)
     select count(*)::integer from d $$,
  $$ values (1) $$,
  'B2 deletes a shared deadline created by B'
);
-- The author changes «Solo io» both ways.
select lives_ok(
  $$ update public.deadlines set is_private = true where id = current_setting('test.scooter')::uuid $$,
  'B2 makes his shared deadline «Solo io»'
);
select lives_ok(
  $$ update public.deadlines set is_private = false where id = current_setting('test.licence')::uuid $$,
  'B2 shares his «Solo io» deadline with the household'
);

set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select is_empty(
  $$ select 1 from public.deadlines d where d.id = current_setting('test.scooter')::uuid $$,
  'B no longer reads the deadline B2 made «Solo io»'
);
select results_eq(
  $$ select d.title, d.note from public.deadlines d where d.id = current_setting('test.licence')::uuid $$,
  $$ values ('Rinnovo della patente', 'Prima della vacanza') $$,
  'B now reads the deadline B2 shared'
);

-- ---------------------------------------------------------------------------
-- Marco (A, Casa D'Angelo) sees and touches nothing of Casa Bianchi
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';

select results_eq(
  $$ select d.title, d.note, d.for_member_id, d.assignee_member_id, d.reminder_days
     from public.deadlines d order by d.due_date $$,
  $$ values ('Rinnovo carta d''identità di Sofia', 'Serve per la gita', 'a1000000-0000-4000-8000-000000000003'::uuid,
             null::uuid, '{30,7,1}'::smallint[]),
            ('Bollo dell''auto', null::text, null::uuid, 'a1000000-0000-4000-8000-000000000001'::uuid,
             '{30,7,1}'::smallint[]) $$,
  'A reads the deadlines of Casa D''Angelo, and only those'
);
select is_empty(
  $$ select 1 from public.deadlines d where d.household_id = '22222222-2222-4222-8222-222222222222' $$,
  'A reads 0 deadlines of Casa Bianchi'
);
select results_eq(
  $$ with u as (update public.deadlines set title = 'Preso' where household_id = '22222222-2222-4222-8222-222222222222' returning 1)
     select count(*)::integer from u $$,
  $$ values (0) $$,
  'A changes 0 deadlines of Casa Bianchi'
);
select results_eq(
  $$ with u as (update public.deadlines set due_date = '2026-10-21' where id = current_setting('test.bus')::uuid returning 1)
     select count(*)::integer from u $$,
  $$ values (0) $$,
  'A changes 0 deadlines of Casa Bianchi, even by id'
);
select results_eq(
  $$ with d as (delete from public.deadlines where household_id = '22222222-2222-4222-8222-222222222222' returning 1)
     select count(*)::integer from d $$,
  $$ values (0) $$,
  'A deletes 0 deadlines of Casa Bianchi'
);
select throws_ok(
  $$ insert into public.deadlines (household_id, title, due_date)
     values ('22222222-2222-4222-8222-222222222222', 'Revisione della caldaia', '2026-12-01') $$,
  '42501', null,
  'A cannot add a deadline to Casa Bianchi'
);
select throws_ok(
  $$ insert into public.deadlines (household_id, title, due_date, assignee_member_id)
     values ('22222222-2222-4222-8222-222222222222', 'Intrusione', '2026-12-01', 'b1000000-0000-4000-8000-000000000001') $$,
  '42501', null,
  'A cannot add a deadline to Casa Bianchi naming one of its members'
);
select throws_ok(
  $$ insert into public.deadlines (title, due_date, for_member_id)
     values ('Rinnovo per Leo', '2026-12-01', 'b1000000-0000-4000-8000-000000000003') $$,
  '23503', null,
  'A cannot add to his household a deadline that concerns Leo (Casa Bianchi)'
);
select throws_ok(
  $$ insert into public.deadlines (title, due_date, assignee_member_id)
     values ('Se ne occupa Anna', '2026-12-01', 'b1000000-0000-4000-8000-000000000004') $$,
  '23514', null,
  'A cannot add to his household a deadline Anna (Casa Bianchi) takes care of'
);
select throws_ok(
  $$ insert into public.deadlines (title, due_date, assignee_member_id)
     values ('Passeggiata', '2026-12-01', 'a1000000-0000-4000-8000-000000000005') $$,
  '23514', null,
  'a pet cannot take care of a deadline'
);
select lives_ok(
  $$ insert into public.deadlines (title, due_date, assignee_member_id, for_member_id)
     values ('Assicurazione di Biscotto', '2026-11-20', 'a1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000005') $$,
  'Laura takes care of a deadline that concerns a pet'
);
select lives_ok(
  $$ update public.deadlines set assignee_member_id = 'a1000000-0000-4000-8000-000000000003'
     where title = 'Assicurazione di Biscotto' $$,
  'a child takes care of a deadline'
);
select throws_ok(
  $$ update public.deadlines set assignee_member_id = 'a1000000-0000-4000-8000-000000000005'
     where title = 'Assicurazione di Biscotto' $$,
  '23514', null,
  'a pet cannot take care of a deadline on update either'
);
select results_eq(
  $$ with d as (delete from public.deadlines where title = 'Assicurazione di Biscotto' returning 1)
     select count(*)::integer from d $$,
  $$ values (1) $$,
  'A deletes a shared deadline of Casa D''Angelo (page tests, «Elimina» of #22)'
);

-- B sees and touches nothing of Casa D'Angelo.
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select is_empty(
  $$ select 1 from public.deadlines d where d.household_id = '11111111-1111-4111-8111-111111111111' $$,
  'B reads 0 deadlines of Casa D''Angelo'
);
select results_eq(
  $$ with u as (update public.deadlines set note = 'Cambiata' where id = 'a5000000-0000-4000-8000-000000000001' returning 1)
     select count(*)::integer from u $$,
  $$ values (0) $$,
  'B changes 0 deadlines of Casa D''Angelo'
);
select results_eq(
  $$ with d as (delete from public.deadlines where household_id = '11111111-1111-4111-8111-111111111111' returning 1)
     select count(*)::integer from d $$,
  $$ values (0) $$,
  'B deletes 0 deadlines of Casa D''Angelo'
);

-- ---------------------------------------------------------------------------
-- Chiara (C, no household) and anonymous users
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}';
select is_empty($$ select 1 from public.deadlines $$, 'C reads 0 deadlines');
select throws_ok(
  $$ insert into public.deadlines (title, due_date) values ('Senza Nest', '2026-12-01') $$,
  '42501', null,
  'C cannot add deadlines'
);
select throws_ok(
  $$ insert into public.deadlines (household_id, title, due_date)
     values ('22222222-2222-4222-8222-222222222222', 'Senza Nest', '2026-12-01') $$,
  '42501', null,
  'C cannot add deadlines to Casa Bianchi'
);
select results_eq(
  $$ with u as (update public.deadlines set title = 'Cambiato' returning 1) select count(*)::integer from u $$,
  $$ values (0) $$,
  'C changes 0 deadlines'
);
select results_eq(
  $$ with d as (delete from public.deadlines returning 1) select count(*)::integer from d $$,
  $$ values (0) $$,
  'C deletes 0 deadlines'
);

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok($$ select 1 from public.deadlines $$, '42501', null, 'anon cannot read deadlines');
select throws_ok(
  $$ insert into public.deadlines (household_id, title, due_date)
     values ('22222222-2222-4222-8222-222222222222', 'Anonimo', '2026-12-01') $$,
  '42501', null,
  'anon cannot add deadlines'
);
select throws_ok($$ update public.deadlines set title = 'Anonimo' $$, '42501', null, 'anon cannot change deadlines');
select throws_ok($$ delete from public.deadlines $$, '42501', null, 'anon cannot delete deadlines');

-- ---------------------------------------------------------------------------
-- Checks as the database owner
-- ---------------------------------------------------------------------------
reset role;

select results_eq(
  $$ select d.title, d.is_private, d.due_date from public.deadlines d where d.id = 'b5000000-0000-4000-8000-000000000002'
     union all
     select d.title, d.is_private, d.due_date from public.deadlines d where d.id = current_setting('test.gift')::uuid
     union all
     select d.title || ' / ' || d.note, d.is_private, d.due_date from public.deadlines d
     where d.id = 'a5000000-0000-4000-8000-000000000001' $$,
  $$ values ('Rinnovo del passaporto', true, (now() at time zone 'Europe/Rome')::date + 60),
            ('Regalo di compleanno per Paolo', true, '2026-12-20'::date),
            ('Rinnovo carta d''identità di Sofia / Serve per la gita', false, (now() at time zone 'Europe/Rome')::date + 14) $$,
  'the refused writes changed nothing'
);
select is(
  (select count(*)::integer from public.deadlines d where d.household_id = '22222222-2222-4222-8222-222222222222'),
  6,
  'Casa Bianchi has 6 deadlines in all (none deleted by the others)'
);

-- A member removed from the household (by the administrator, through the API): their
-- «Solo io» deadlines go, their shared deadlines stay without author.
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok(
  $$ delete from public.household_members where id = 'b1000000-0000-4000-8000-000000000004' $$,
  'B (admin) removes Anna from the household'
);
select results_eq(
  $$ select d.for_member_id, d.assignee_member_id from public.deadlines d where d.id = current_setting('test.bus')::uuid $$,
  $$ values (null::uuid, 'b1000000-0000-4000-8000-000000000003'::uuid) $$,
  'the deadline that concerned Anna stays, without «riguarda»'
);
select lives_ok(
  $$ delete from public.household_members where id = 'b1000000-0000-4000-8000-000000000002' $$,
  'B (admin) removes Paolo from the household'
);
reset role;
select is_empty(
  $$ select 1 from public.deadlines d
     where d.id in ('b5000000-0000-4000-8000-000000000002', current_setting('test.scooter')::uuid) $$,
  'the «Solo io» deadlines of Paolo are deleted with him'
);
select results_eq(
  $$ select d.title, d.created_by_member_id, d.assignee_member_id, d.is_private
     from public.deadlines d where d.id = current_setting('test.licence')::uuid $$,
  $$ values ('Rinnovo della patente', null::uuid, null::uuid, false) $$,
  'a shared deadline of Paolo stays, without author and assignee'
);
select results_eq(
  $$ select d.title, d.is_private from public.deadlines d
     where d.id in (current_setting('test.gift')::uuid, 'b5000000-0000-4000-8000-000000000001')
     order by d.title $$,
  $$ values ('Regalo di compleanno per Paolo', true), ('Revisione della caldaia', true) $$,
  'the «Solo io» deadlines of the others stay'
);

set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select is(
  (select d.title from public.deadlines d where d.id = current_setting('test.licence')::uuid),
  'Rinnovo della patente',
  'B still reads the deadline without author'
);
select throws_ok(
  $$ update public.deadlines set is_private = true where id = current_setting('test.licence')::uuid $$,
  '42501', null,
  'nobody makes «Solo io» a deadline without author'
);
reset role;

-- A household deleted with its last account: every deadline goes.
select lives_ok(
  $$ delete from auth.users where id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  'the account of A (last account of Casa D''Angelo) is deleted'
);
select is_empty(
  $$ select 1 from public.deadlines d where d.household_id = '11111111-1111-4111-8111-111111111111' $$,
  'Casa D''Angelo is deleted with all its deadlines'
);

select * from finish();
rollback;
