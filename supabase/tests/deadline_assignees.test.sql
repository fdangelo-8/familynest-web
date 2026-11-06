-- deadline_assignees (issue #337, for #333): several people per deadline. Schema,
-- privileges, data of the seed, the write functions, «Solo io», the compatibility column,
-- isolation between households, anon, the administrative key, and the reminders of 9:00
-- to every person who takes care of a deadline.
-- Seed ids: A = Marco (Casa D'Angelo, user aaaaaaaa…01, member a1…01), B = Giulia (Casa
-- Bianchi, bbbbbbbb…01, b1…01), B2 = Paolo (bbbbbbbb…02, b1…02). Members of Casa D'Angelo:
-- Marco a1…01, Laura a1…02, Sofia a1…03, Tommaso a1…04, Biscotto a1…05 (pet). Casa
-- Bianchi: Giulia b1…01, Paolo b1…02, Leo b1…03 (child), Anna b1…04 (adult without
-- account); this test adds Carla b1…10 (adult with an account, user dddddddd…01).
-- Seed deadlines: a5…01 (nobody), a5…02 (Marco); b5…01 created by Giulia (Paolo), b5…02
-- «Solo io» of Paolo (Paolo).
begin;
create extension if not exists pgtap with schema extensions;

select plan(52);

-- ---------------------------------------------------------------------------
-- Schema and privileges
-- ---------------------------------------------------------------------------
select has_table('public', 'deadline_assignees', 'deadline_assignees exists');
select ok(
  (select c.relrowsecurity from pg_class c where c.oid = 'public.deadline_assignees'::regclass),
  'RLS enabled on deadline_assignees'
);
select col_is_pk('public', 'deadline_assignees', array['deadline_id', 'member_id'], 'one row per deadline and person');
select fk_ok(
  'public', 'deadline_assignees', array['deadline_id', 'household_id'],
  'public', 'deadlines', array['id', 'household_id'],
  'the deadline belongs to the same household'
);
select fk_ok(
  'public', 'deadline_assignees', array['member_id', 'household_id'],
  'public', 'household_members', array['id', 'household_id'],
  'the person is a member of the same household'
);
select is(
  (select array_agg(k.confdeltype::text order by k.conname)
   from pg_constraint k
   where k.conrelid = 'public.deadline_assignees'::regclass and k.contype = 'f'),
  array['c', 'c', 'c'],
  'deadline, household and person: on delete cascade'
);
select has_index('public', 'deadline_assignees', 'deadline_assignees_member_id_idx', 'index on the person');
select has_index('public', 'deadline_assignees', 'deadline_assignees_household_id_idx', 'index on the household');
select ok(
  not has_table_privilege('anon', 'public.deadline_assignees', 'select, insert, update, delete')
  and has_table_privilege('authenticated', 'public.deadline_assignees', 'select')
  and has_table_privilege('authenticated', 'public.deadline_assignees', 'delete')
  and has_column_privilege('authenticated', 'public.deadline_assignees', 'deadline_id', 'insert')
  and not has_column_privilege('authenticated', 'public.deadline_assignees', 'created_at', 'insert')
  and not has_any_column_privilege('authenticated', 'public.deadline_assignees', 'update'),
  'anon nothing; the app reads, adds (never the time) and removes people'
);
select ok(
  not has_function_privilege('anon', 'public.create_deadline(text, date, uuid[], text, uuid, boolean, smallint[])', 'execute')
  and not has_function_privilege('anon', 'public.update_deadline(uuid, text, date, uuid[], text, uuid, boolean, smallint[])', 'execute')
  and has_function_privilege('authenticated', 'public.create_deadline(text, date, uuid[], text, uuid, boolean, smallint[])', 'execute')
  and has_function_privilege('authenticated', 'public.update_deadline(uuid, text, date, uuid[], text, uuid, boolean, smallint[])', 'execute')
  and not has_function_privilege('authenticated', 'private.deadline_first_assignee(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'private.deadlines_sync_assignees()', 'execute'),
  'only signed-in users call the write functions; helpers and triggers are never callable'
);

-- ---------------------------------------------------------------------------
-- Data of the seed (written through the compatibility column)
-- ---------------------------------------------------------------------------
select results_eq(
  $$ select a.deadline_id, a.member_id from public.deadline_assignees a order by a.deadline_id $$,
  $$ values ('a5000000-0000-4000-8000-000000000002'::uuid, 'a1000000-0000-4000-8000-000000000001'::uuid),
            ('b5000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002'),
            ('b5000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000002') $$,
  'every person of the seed is a row of deadline_assignees'
);
select is_empty(
  $$ select d.id from public.deadlines d
     where d.assignee_member_id is distinct from private.deadline_first_assignee(d.id) $$,
  'the compatibility column equals the first person of every deadline'
);

-- ---------------------------------------------------------------------------
-- Marco (A): write functions
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';

select lives_ok(
  $$ select set_config('test.d1', public.create_deadline(
       p_title => 'Rinnovo   assicurazione', p_due_date => '2026-12-15',
       p_assignee_member_ids => array['a1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001']::uuid[],
       p_note => ' Chiamare  l''agente ', p_reminder_days => array[1, 7]::smallint[]
     )::text, true) $$,
  'create_deadline with Laura and Marco'
);
select results_eq(
  $$ select d.title, d.note, d.created_by_member_id, d.assignee_member_id, d.reminder_days,
            (select array_agg(a.member_id order by a.member_id) from public.deadline_assignees a where a.deadline_id = d.id)
     from public.deadlines d where d.id = current_setting('test.d1')::uuid $$,
  $$ values ('Rinnovo assicurazione'::text, 'Chiamare l''agente'::text, 'a1000000-0000-4000-8000-000000000001'::uuid,
             'a1000000-0000-4000-8000-000000000001'::uuid, array[7, 1]::smallint[],
             array['a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002']::uuid[]) $$,
  'normalised like a direct insert, author Marco, first person Marco (order of the members), both people'
);
select throws_ok(
  $$ select public.create_deadline(p_title => 'Col cane', p_due_date => '2026-12-15',
       p_assignee_member_ids => array['a1000000-0000-4000-8000-000000000005']::uuid[]) $$,
  '23514', null,
  'a pet never takes care of a deadline'
);
select is(
  (select count(*)::integer from public.deadlines d where d.title = 'Col cane'),
  0,
  'nothing is created when a person is refused'
);
select throws_ok(
  $$ select public.create_deadline(p_title => 'Senza lista', p_due_date => '2026-12-15', p_assignee_member_ids => null) $$,
  '22023', null,
  'a null list of people is refused'
);
select throws_ok(
  $$ select public.create_deadline(p_title => 'Segreta', p_due_date => '2026-12-15',
       p_assignee_member_ids => array['a1000000-0000-4000-8000-000000000003']::uuid[], p_is_private => true) $$,
  '23514', null,
  '«Solo io» with someone else is refused'
);
select lives_ok(
  $$ select public.update_deadline(current_setting('test.d1')::uuid, 'Rinnovo assicurazione', '2026-12-20',
       array['a1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000003']::uuid[],
       null, 'a1000000-0000-4000-8000-000000000003', false, array[30]::smallint[]) $$,
  'update_deadline: Laura stays, Marco goes, Sofia comes'
);
select results_eq(
  $$ select d.due_date, d.note, d.for_member_id, d.assignee_member_id, d.reminder_days,
            (select array_agg(a.member_id order by a.member_id) from public.deadline_assignees a where a.deadline_id = d.id)
     from public.deadlines d where d.id = current_setting('test.d1')::uuid $$,
  $$ values ('2026-12-20'::date, null::text, 'a1000000-0000-4000-8000-000000000003'::uuid,
             'a1000000-0000-4000-8000-000000000002'::uuid, array[30]::smallint[],
             array['a1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000003']::uuid[]) $$,
  'every field changes; the first person is Laura'
);
select throws_ok(
  $$ select public.update_deadline(current_setting('test.d1')::uuid, 'Rinnovo assicurazione', '2026-12-20',
       array['a1000000-0000-4000-8000-000000000002']::uuid[], null, null, true, array[30]::smallint[]) $$,
  '23514', null,
  'becoming «Solo io» with someone else is refused'
);
select lives_ok(
  $$ select public.update_deadline(current_setting('test.d1')::uuid, 'Rinnovo assicurazione', '2026-12-20',
       array['a1000000-0000-4000-8000-000000000001']::uuid[], null, null, true, array[30]::smallint[]) $$,
  'the author makes it «Solo io» with himself only'
);
select results_eq(
  $$ select d.is_private, d.assignee_member_id,
            (select array_agg(a.member_id) from public.deadline_assignees a where a.deadline_id = d.id)
     from public.deadlines d where d.id = current_setting('test.d1')::uuid $$,
  $$ values (true, 'a1000000-0000-4000-8000-000000000001'::uuid, array['a1000000-0000-4000-8000-000000000001']::uuid[]) $$,
  '«Solo io», only Marco'
);
select throws_ok(
  $$ select public.update_deadline(current_setting('test.d1')::uuid, 'Rinnovo assicurazione', '2026-12-20',
       array['a1000000-0000-4000-8000-000000000001']::uuid[], null, null, null, array[30]::smallint[]) $$,
  '22023', null,
  'a null «Solo io» is refused, never turned into «Tutto il Nest»'
);
select is(
  (select d.is_private from public.deadlines d where d.id = current_setting('test.d1')::uuid),
  true,
  'after the refused null the deadline is still «Solo io»'
);
select throws_ok(
  $$ insert into public.deadline_assignees (deadline_id, member_id)
     values (current_setting('test.d1')::uuid, 'a1000000-0000-4000-8000-000000000002') $$,
  '23514', null,
  'nobody else can be added to a «Solo io» deadline'
);
select lives_ok(
  $$ insert into public.deadline_assignees (deadline_id, member_id)
     values ('a5000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000004') $$,
  'Marco adds Tommaso to «Bollo dell''auto»'
);
select throws_ok(
  $$ update public.deadlines set is_private = true where id = 'a5000000-0000-4000-8000-000000000002' $$,
  '23514', null,
  'it cannot become «Solo io» while Tommaso takes care of it'
);

-- Compatibility: the pages on main write assignee_member_id.
select lives_ok(
  $$ update public.deadlines set assignee_member_id = 'a1000000-0000-4000-8000-000000000003'
     where id = 'a5000000-0000-4000-8000-000000000002' $$,
  'an old page gives «Bollo dell''auto» to Sofia'
);
select results_eq(
  $$ select a.member_id from public.deadline_assignees a where a.deadline_id = 'a5000000-0000-4000-8000-000000000002' $$,
  $$ values ('a1000000-0000-4000-8000-000000000003'::uuid) $$,
  'as with one single person: Sofia only'
);
select lives_ok(
  $$ insert into public.deadlines (title, due_date, assignee_member_id) values ('Vecchia scadenza', '2026-12-01', 'a1000000-0000-4000-8000-000000000002') $$,
  'an old page creates a deadline for Laura'
);
select results_eq(
  $$ select a.member_id from public.deadline_assignees a join public.deadlines d on d.id = a.deadline_id where d.title = 'Vecchia scadenza' $$,
  $$ values ('a1000000-0000-4000-8000-000000000002'::uuid) $$,
  'Laura is its person'
);

-- A member leaves: their rows go, the first person moves on.
select lives_ok(
  $$ select set_config('test.d4', public.create_deadline(
       p_title => 'Per Laura e Sofia', p_due_date => '2026-12-01',
       p_assignee_member_ids => array['a1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000003']::uuid[]
     )::text, true) $$,
  'a deadline with Laura and Sofia'
);
reset role;
select lives_ok(
  $$ delete from public.household_members where id = 'a1000000-0000-4000-8000-000000000002' $$,
  'Laura is removed from Casa D''Angelo'
);
select results_eq(
  $$ select d.assignee_member_id, (select array_agg(a.member_id) from public.deadline_assignees a where a.deadline_id = d.id)
     from public.deadlines d where d.id = current_setting('test.d4')::uuid $$,
  $$ values ('a1000000-0000-4000-8000-000000000003'::uuid, array['a1000000-0000-4000-8000-000000000003']::uuid[]) $$,
  'Sofia stays and becomes the first person'
);
set local role authenticated;

-- ---------------------------------------------------------------------------
-- Isolation: Giulia (B)
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select results_eq(
  $$ select a.deadline_id, a.member_id from public.deadline_assignees a $$,
  $$ values ('b5000000-0000-4000-8000-000000000001'::uuid, 'b1000000-0000-4000-8000-000000000002'::uuid) $$,
  'Giulia reads only the shared deadline of Casa Bianchi'
);
select is_empty(
  $$ delete from public.deadline_assignees where household_id = '11111111-1111-4111-8111-111111111111' returning deadline_id $$,
  'Giulia removes 0 people of Casa D''Angelo'
);
select is_empty(
  $$ delete from public.deadline_assignees where deadline_id = 'b5000000-0000-4000-8000-000000000002' returning deadline_id $$,
  'Giulia removes 0 people of the «Solo io» of Paolo'
);
select throws_ok(
  $$ insert into public.deadline_assignees (deadline_id, member_id, household_id)
     values ('a5000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111') $$,
  '42501', null,
  'Giulia cannot add people to Casa D''Angelo'
);
select throws_ok(
  $$ select public.update_deadline('a5000000-0000-4000-8000-000000000001', 'Intrusione', '2026-12-01',
       array[]::uuid[], null, null, false, array[]::smallint[]) $$,
  'P0002', null,
  'Giulia cannot change a deadline of Casa D''Angelo'
);
select throws_ok(
  $$ select public.update_deadline('b5000000-0000-4000-8000-000000000002', 'Intrusione', '2026-12-01',
       array[]::uuid[], null, null, false, array[]::smallint[]) $$,
  'P0002', null,
  'Giulia cannot change the «Solo io» of Paolo'
);
select throws_ok(
  $$ select public.create_deadline(p_title => 'Per Marco', p_due_date => '2026-12-01',
       p_assignee_member_ids => array['a1000000-0000-4000-8000-000000000001']::uuid[]) $$,
  '23514', null,
  'Giulia cannot give a deadline to a member of Casa D''Angelo'
);

-- anon
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok($$ select 1 from public.deadline_assignees $$, '42501', null, 'anon cannot read the people');
select throws_ok(
  $$ select public.create_deadline(p_title => 'Anonima', p_due_date => '2026-12-01') $$,
  '42501', null,
  'anon cannot call create_deadline'
);

-- Administrative key (lesson of #276/#287)
set local role service_role;
set local request.jwt.claims to '{"role":"service_role"}';
select lives_ok(
  $$ insert into public.deadline_assignees (deadline_id, member_id, household_id)
     values ('a5000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111') $$,
  'the administrative key adds a person, with household_id'
);
select throws_ok(
  $$ insert into public.deadline_assignees (deadline_id, member_id, household_id)
     values ('b5000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222') $$,
  '23514', null,
  'the administrative key cannot add someone else to a «Solo io» deadline'
);
reset role;
select results_eq(
  $$ select a.member_id from public.deadline_assignees a where a.deadline_id = 'b5000000-0000-4000-8000-000000000002' $$,
  $$ values ('b1000000-0000-4000-8000-000000000002'::uuid) $$,
  'the «Solo io» of Paolo survived every attempt'
);

-- ---------------------------------------------------------------------------
-- Reminders of 9:00 to every person who takes care of a deadline
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
  $$ select set_config('test.two', public.create_deadline(
       p_title => 'Due adulti', p_due_date => (now() at time zone 'Europe/Rome')::date + 7,
       p_assignee_member_ids => array['b1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000010',
                                      'b1000000-0000-4000-8000-000000000003']::uuid[],
       p_reminder_days => array[7]::smallint[]
     )::text, true) $$,
  'Paolo creates a deadline in 7 days for Giulia, Carla and Leo'
);
select lives_ok(
  $$ select set_config('test.none', public.create_deadline(
       p_title => 'Senza account', p_due_date => (now() at time zone 'Europe/Rome')::date + 7,
       p_assignee_member_ids => array['b1000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000004']::uuid[],
       p_reminder_days => array[7]::smallint[]
     )::text, true) $$,
  'and one for Leo and Anna (no account)'
);
select lives_ok(
  $$ select set_config('test.mine', public.create_deadline(
       p_title => 'Solo di Paolo', p_due_date => (now() at time zone 'Europe/Rome')::date + 7,
       p_assignee_member_ids => array[]::uuid[], p_is_private => true, p_reminder_days => array[7]::smallint[]
     )::text, true) $$,
  'and a «Solo io» one without people'
);
reset role;
select is(
  public.run_notification_job('deadline_reminders', '22222222-2222-4222-8222-222222222222', now()),
  6,
  'the job creates 6 reminders'
);
select results_eq(
  $$ select d.title, n.recipient_member_id, n.days_before
     from public.notifications n join public.deadlines d on d.id = n.deadline_id
     where n.kind = 'deadline_reminder'
     order by d.title, n.recipient_member_id $$,
  $$ values ('Due adulti'::text, 'b1000000-0000-4000-8000-000000000001'::uuid, 7::smallint),
            ('Due adulti', 'b1000000-0000-4000-8000-000000000010', 7::smallint),
            ('Senza account', 'b1000000-0000-4000-8000-000000000001', 7::smallint),
            ('Senza account', 'b1000000-0000-4000-8000-000000000002', 7::smallint),
            ('Senza account', 'b1000000-0000-4000-8000-000000000010', 7::smallint),
            ('Solo di Paolo', 'b1000000-0000-4000-8000-000000000002', 7::smallint) $$,
  'every person with an account; nobody with an account: everybody («Tutto il Nest») or the author («Solo io»)'
);

select * from finish();
rollback;
