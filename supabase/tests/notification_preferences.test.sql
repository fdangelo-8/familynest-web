-- notification_preferences: schema, privileges, defaults without any write (CA-15), one
-- switch at a time, isolation between households and between adults of the same
-- household (CA-4, CA-5, CA-20), anon, only POST, cleanup when a member leaves, when an
-- account is deleted and when the household is deleted (CA-29) (issue #217, for #41).
-- Seed ids: A = Marco (Casa D'Angelo, only adult with an account), B = Giulia (Casa
-- Bianchi, admin), B2 = Paolo (Casa Bianchi, not admin), C = Chiara (no household).
-- Members: Casa D'Angelo Marco a1…01, Laura a1…02 (adult without account), Sofia a1…03
-- (child); Casa Bianchi Giulia b1…01, Paolo b1…02.
-- D = dddddddd-…-01, a new account created here, becomes Laura (a1…02).
-- The seed has no notification preferences.
begin;
create extension if not exists pgtap with schema extensions;

select plan(121);

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------
select has_table('public', 'notification_preferences', 'notification_preferences exists');
select ok(
  (select c.relrowsecurity from pg_class c where c.oid = 'public.notification_preferences'::regclass),
  'RLS enabled on notification_preferences'
);
select columns_are(
  'public', 'notification_preferences',
  array['id', 'household_id', 'member_id', 'events', 'assigned_todos', 'shopping',
        'free_together', 'morning_digest', 'created_at', 'updated_at'],
  'notification_preferences has exactly the planned columns (five choices, nothing personal)'
);
select enum_has_labels(
  'public', 'notification_preference',
  array['events', 'assigned_todos', 'shopping', 'free_together', 'morning_digest'],
  'the five kinds of notification, in the order of the page'
);
select col_default_is('public', 'notification_preferences', 'events', 'true', '«Impegni e cambi d''orario» on by default');
select col_default_is('public', 'notification_preferences', 'assigned_todos', 'true', '«Da fare assegnati a me» on by default');
select col_default_is('public', 'notification_preferences', 'shopping', 'false', '«Spesa» off by default');
select col_default_is('public', 'notification_preferences', 'free_together', 'true', '«Liberi insieme» on by default');
select col_default_is('public', 'notification_preferences', 'morning_digest', 'true', '«Sintesi del mattino» on by default');
select ok(
  (select bool_and(a.attnotnull) from pg_attribute a
   where a.attrelid = 'public.notification_preferences'::regclass
     and a.attname in ('events', 'assigned_todos', 'shopping', 'free_together', 'morning_digest')),
  'the five choices are never null'
);
select fk_ok(
  'public', 'notification_preferences', 'household_id', 'public', 'households', 'id',
  'notification_preferences.household_id references households'
);
select fk_ok(
  'public', 'notification_preferences', array['member_id', 'household_id'],
  'public', 'household_members', array['id', 'household_id'],
  'the member is a member of the same household'
);
select col_is_unique('public', 'notification_preferences', 'member_id', 'at most one row per member');
select has_index(
  'public', 'notification_preferences', 'notification_preferences_household_id_idx',
  'index on notification_preferences.household_id'
);
select ok(
  not exists (
    select 1 from pg_publication_tables p
    where p.pubname = 'supabase_realtime' and p.schemaname = 'public' and p.tablename = 'notification_preferences'
  ),
  'notification_preferences is not sent in real time'
);
select has_function('public', 'get_notification_preferences', 'get_notification_preferences exists');
select has_function(
  'public', 'set_notification_preference', array['notification_preference', 'boolean'],
  'set_notification_preference exists'
);
select is(
  (select p.proargnames from pg_proc p where p.oid = 'public.get_notification_preferences()'::regprocedure),
  array['events', 'assigned_todos', 'shopping', 'free_together', 'morning_digest']::text[],
  'the read returns only the five choices (no id, member or household)'
);
select ok(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.prosecdef
      and (n.nspname, p.proname) in (
        ('public', 'get_notification_preferences'), ('public', 'set_notification_preference'),
        ('private', 'notification_preferences_before_insert')
      )
  ),
  'the functions of notification_preferences run as the caller (no security definer)'
);

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
select ok(
  not has_table_privilege('anon', 'public.notification_preferences', 'select, insert, update, delete'),
  'anon has no privilege on notification_preferences'
);
select ok(
  has_column_privilege('authenticated', 'public.notification_preferences', 'shopping', 'insert')
  and not has_column_privilege('authenticated', 'public.notification_preferences', 'id', 'insert')
  and not has_column_privilege('authenticated', 'public.notification_preferences', 'household_id', 'insert')
  and not has_column_privilege('authenticated', 'public.notification_preferences', 'member_id', 'insert')
  and not has_column_privilege('authenticated', 'public.notification_preferences', 'created_at', 'insert')
  and not has_column_privilege('authenticated', 'public.notification_preferences', 'updated_at', 'insert'),
  'the app inserts only the choices (never id, household, member or times)'
);
select ok(
  has_column_privilege('authenticated', 'public.notification_preferences', 'events', 'update')
  and not has_column_privilege('authenticated', 'public.notification_preferences', 'id', 'update')
  and not has_column_privilege('authenticated', 'public.notification_preferences', 'household_id', 'update')
  and not has_column_privilege('authenticated', 'public.notification_preferences', 'member_id', 'update')
  and not has_column_privilege('authenticated', 'public.notification_preferences', 'created_at', 'update')
  and not has_column_privilege('authenticated', 'public.notification_preferences', 'updated_at', 'update'),
  'the app updates only the choices (never id, household, member or times)'
);
select ok(
  has_table_privilege('authenticated', 'public.notification_preferences', 'select')
  and has_table_privilege('authenticated', 'public.notification_preferences', 'delete'),
  'the app reads and deletes (RLS limits both to its own row)'
);
select ok(
  not has_function_privilege('anon', 'public.get_notification_preferences()', 'execute')
  and not has_function_privilege('anon', 'public.set_notification_preference(public.notification_preference, boolean)', 'execute')
  and has_function_privilege('authenticated', 'public.get_notification_preferences()', 'execute')
  and has_function_privilege('authenticated', 'public.set_notification_preference(public.notification_preference, boolean)', 'execute'),
  'only signed-in users read and change their choices'
);
select ok(
  not has_function_privilege('authenticated', 'private.notification_preferences_before_insert()', 'execute'),
  'the trigger function cannot be called by the app'
);

-- ---------------------------------------------------------------------------
-- Seed: no preferences
-- ---------------------------------------------------------------------------
select is_empty($$ select 1 from public.notification_preferences $$, 'the seed has no notification preferences');

-- ---------------------------------------------------------------------------
-- Marco (A): defaults without writing (CA-15), then one switch at a time
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
set local request.method to 'POST';

select is_empty($$ select 1 from public.notification_preferences $$, 'A starts without a row');
select results_eq(
  $$ select * from public.get_notification_preferences() $$,
  $$ values (true, true, false, true, true) $$,
  'A never chose: all on, «Spesa» off'
);
reset role;
select is_empty(
  $$ select 1 from public.notification_preferences $$,
  'CA-15: reading the choices writes nothing'
);
set local role authenticated;

select lives_ok(
  $$ select public.set_notification_preference('shopping', true) $$,
  'CA-18: A switches «Spesa» on'
);
select results_eq(
  $$ select p.household_id, p.member_id, p.events, p.assigned_todos, p.shopping, p.free_together, p.morning_digest
     from public.notification_preferences p $$,
  $$ values ('11111111-1111-4111-8111-111111111111'::uuid, 'a1000000-0000-4000-8000-000000000001'::uuid,
             true, true, true, true, true) $$,
  'the first switch creates the row of A (household and member set by the database), with the defaults and «Spesa» on'
);
select results_eq(
  $$ select * from public.get_notification_preferences() $$,
  $$ values (true, true, true, true, true) $$,
  'the read gives the saved choices'
);
select lives_ok(
  $$ select public.set_notification_preference('shopping', false) $$,
  'CA-18: A switches «Spesa» off again'
);
select lives_ok(
  $$ select public.set_notification_preference('shopping', false) $$,
  'switching off what is already off gives no error'
);
select lives_ok($$ select public.set_notification_preference('events', false) $$, 'CA-19: A switches «Impegni» off');
select lives_ok($$ select public.set_notification_preference('assigned_todos', false) $$, 'CA-19: A switches «Da fare» off');
select lives_ok($$ select public.set_notification_preference('free_together', false) $$, 'CA-19: A switches «Liberi insieme» off');
select lives_ok($$ select public.set_notification_preference('morning_digest', false) $$, 'CA-19: A switches «Sintesi» off');
select results_eq(
  $$ select * from public.get_notification_preferences() $$,
  $$ values (false, false, false, false, false) $$,
  'CA-19: all five off, each switch changed only its own choice'
);
select results_eq(
  $$ select count(*)::integer from public.notification_preferences $$,
  $$ values (1) $$,
  'still a single row for A'
);
select lives_ok($$ select public.set_notification_preference('events', true) $$, 'A switches «Impegni» on again');
select results_eq(
  $$ select * from public.get_notification_preferences() $$,
  $$ values (true, false, false, false, false) $$,
  'only «Impegni» changed'
);
select has_trigger(
  'public', 'notification_preferences', 'notification_preferences_set_updated_at',
  'updated_at is kept by the database'
);

select throws_ok($$ select public.set_notification_preference(null, true) $$, '22004', null, 'a switch needs the notification');
select throws_ok($$ select public.set_notification_preference('events', null) $$, '22004', null, 'a switch needs on or off');

-- Direct writes: only the choices, only the own row.
select throws_ok(
  $$ insert into public.notification_preferences (shopping) values (true) $$,
  '23505', null,
  'a direct insert when the row already exists is refused'
);
select throws_ok(
  $$ insert into public.notification_preferences (household_id, shopping)
     values ('22222222-2222-4222-8222-222222222222', true) $$,
  '42501', null,
  'the app cannot choose the household'
);
select throws_ok(
  $$ insert into public.notification_preferences (member_id, shopping)
     values ('a1000000-0000-4000-8000-000000000002', true) $$,
  '42501', null,
  'the app cannot choose the member'
);
select throws_ok(
  $$ insert into public.notification_preferences (id, shopping) values (gen_random_uuid(), true) $$,
  '42501', null,
  'the app cannot choose the id'
);
select throws_ok(
  $$ insert into public.notification_preferences (shopping, created_at) values (true, now() - interval '1 year') $$,
  '42501', null,
  'the app cannot choose the time'
);
select throws_ok(
  $$ update public.notification_preferences set member_id = 'a1000000-0000-4000-8000-000000000002' $$,
  '42501', null,
  'the app cannot move its row to another member'
);
select throws_ok(
  $$ update public.notification_preferences set household_id = '22222222-2222-4222-8222-222222222222' $$,
  '42501', null,
  'the app cannot move its row to another household'
);
select lives_ok(
  $$ update public.notification_preferences set morning_digest = true $$,
  'A changes a choice with a direct update'
);
select results_eq(
  $$ select * from public.get_notification_preferences() $$,
  $$ values (true, false, false, false, true) $$,
  'the direct update changed only «Sintesi»'
);

set local request.method to 'GET';
select throws_ok($$ select public.set_notification_preference('shopping', true) $$, 'P0001', 'use POST', 'set_notification_preference refuses GET');
set local request.method to 'HEAD';
select throws_ok($$ select public.set_notification_preference('shopping', true) $$, 'P0001', 'use POST', 'set_notification_preference refuses HEAD');
set local request.method to 'PUT';
select throws_ok($$ select public.set_notification_preference('shopping', true) $$, 'P0001', 'use POST', 'set_notification_preference refuses PUT');
set local request.method to 'GET';
select results_eq(
  $$ select * from public.get_notification_preferences() $$,
  $$ values (true, false, false, false, true) $$,
  'the read works with GET, and the refused calls changed nothing'
);
set local request.method to 'POST';

-- ---------------------------------------------------------------------------
-- Giulia (B): nothing of Casa D'Angelo exists for her (CA-5)
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';

select is_empty($$ select 1 from public.notification_preferences $$, 'B reads 0 rows of A');
select results_eq(
  $$ select * from public.get_notification_preferences() $$,
  $$ values (true, true, false, true, true) $$,
  'B gets her own defaults, never the choices of A'
);
select results_eq(
  $$ with u as (update public.notification_preferences p set shopping = true
               where p.member_id = 'a1000000-0000-4000-8000-000000000001' returning 1)
     select count(*)::integer from u $$,
  $$ values (0) $$,
  'B cannot change the row of A'
);
select results_eq(
  $$ with d as (delete from public.notification_preferences p
               where p.member_id = 'a1000000-0000-4000-8000-000000000001' returning 1)
     select count(*)::integer from d $$,
  $$ values (0) $$,
  'B cannot delete the row of A'
);
select lives_ok($$ select public.set_notification_preference('free_together', false) $$, 'B switches «Liberi insieme» off');
select results_eq(
  $$ select p.household_id, p.member_id, p.free_together from public.notification_preferences p $$,
  $$ values ('22222222-2222-4222-8222-222222222222'::uuid, 'b1000000-0000-4000-8000-000000000001'::uuid, false) $$,
  'B reads only her own row, in her household, for her member'
);

-- ---------------------------------------------------------------------------
-- Paolo (B2): the choices of Giulia, in the same household and his administrator, are
-- personal (CA-4, CA-20)
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';

select is_empty($$ select 1 from public.notification_preferences $$, 'CA-4: B2 reads 0 rows of B (same household)');
select results_eq(
  $$ select * from public.get_notification_preferences() $$,
  $$ values (true, true, false, true, true) $$,
  'CA-20: for B2 «Liberi insieme» is still on after B switched it off'
);
select results_eq(
  $$ with u as (update public.notification_preferences p set free_together = true
               where p.member_id = 'b1000000-0000-4000-8000-000000000001' returning 1)
     select count(*)::integer from u $$,
  $$ values (0) $$,
  'CA-4: B2 cannot change the row of B'
);
select results_eq(
  $$ with d as (delete from public.notification_preferences p
               where p.member_id = 'b1000000-0000-4000-8000-000000000001' returning 1)
     select count(*)::integer from d $$,
  $$ values (0) $$,
  'B2 cannot delete the row of B'
);
select throws_ok(
  $$ insert into public.notification_preferences (member_id, events)
     values ('b1000000-0000-4000-8000-000000000001', false) $$,
  '42501', null,
  'CA-4: B2 cannot write a row for the member of B'
);
select lives_ok($$ select public.set_notification_preference('assigned_todos', false) $$, 'B2 switches «Da fare» off');
select results_eq(
  $$ select p.member_id, p.assigned_todos, p.free_together from public.notification_preferences p $$,
  $$ values ('b1000000-0000-4000-8000-000000000002'::uuid, false, true) $$,
  'B2 reads only his own row'
);

-- ---------------------------------------------------------------------------
-- Giulia (B), the administrator, against the row Paolo (B2) already has: the choices
-- are personal also towards the administrator (issue #217, point 3)
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';

select is_empty(
  $$ select 1 from public.notification_preferences p where p.member_id = 'b1000000-0000-4000-8000-000000000002' $$,
  'B (admin) reads 0 rows of B2'
);
select results_eq(
  $$ with u as (update public.notification_preferences p set assigned_todos = true, shopping = true
               where p.member_id = 'b1000000-0000-4000-8000-000000000002' returning 1)
     select count(*)::integer from u $$,
  $$ values (0) $$,
  'B (admin) cannot change the row of B2'
);
select results_eq(
  $$ with d as (delete from public.notification_preferences p
               where p.member_id = 'b1000000-0000-4000-8000-000000000002' returning 1)
     select count(*)::integer from d $$,
  $$ values (0) $$,
  'B (admin) cannot delete the row of B2'
);
select throws_ok(
  $$ insert into public.notification_preferences (member_id, shopping)
     values ('b1000000-0000-4000-8000-000000000002', true) $$,
  '42501', null,
  'B (admin) cannot write a row for the member of B2'
);

set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select results_eq(
  $$ select p.member_id, p.events, p.assigned_todos, p.shopping, p.free_together, p.morning_digest
     from public.notification_preferences p $$,
  $$ values ('b1000000-0000-4000-8000-000000000002'::uuid, true, false, false, true, true) $$,
  'read by B2, his row is unchanged after the attempts of the administrator'
);

reset role;
select results_eq(
  $$ select p.member_id, p.events, p.assigned_todos, p.shopping, p.free_together, p.morning_digest
     from public.notification_preferences p order by p.member_id $$,
  $$ values ('a1000000-0000-4000-8000-000000000001'::uuid, true, false, false, false, true),
            ('b1000000-0000-4000-8000-000000000001'::uuid, true, true, false, false, true),
            ('b1000000-0000-4000-8000-000000000002'::uuid, true, false, false, true, true) $$,
  'the rows of A and B survived the attempts of the others'
);

-- Trusted roles still write only for adults with an account.
select throws_ok(
  $$ insert into public.notification_preferences (household_id, member_id)
     values ('11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000003') $$,
  '23514', null,
  'a child never has notification preferences'
);
select throws_ok(
  $$ insert into public.notification_preferences (household_id, member_id)
     values ('11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000002') $$,
  '23514', null,
  'an adult without account never has notification preferences'
);
select throws_ok(
  $$ insert into public.notification_preferences (household_id, member_id)
     values ('22222222-2222-4222-8222-222222222222', 'a1000000-0000-4000-8000-000000000001') $$,
  '23514', null,
  'a row never mixes a member and another household'
);

-- ---------------------------------------------------------------------------
-- anon: no access at all
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';

select throws_ok($$ select 1 from public.notification_preferences $$, '42501', null, 'anon cannot read preferences');
select throws_ok($$ insert into public.notification_preferences (shopping) values (true) $$, '42501', null, 'anon cannot insert');
select throws_ok($$ update public.notification_preferences set shopping = true $$, '42501', null, 'anon cannot update');
select throws_ok($$ delete from public.notification_preferences $$, '42501', null, 'anon cannot delete');
select throws_ok($$ select * from public.get_notification_preferences() $$, '42501', null, 'anon cannot read the choices');
select throws_ok($$ select public.set_notification_preference('shopping', true) $$, '42501', null, 'anon cannot switch');

-- ---------------------------------------------------------------------------
-- Chiara (C): no household, then a «Solo io» household
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}';

select is_empty($$ select 1 from public.notification_preferences $$, 'C without household reads 0 rows');
select is_empty($$ select * from public.get_notification_preferences() $$, 'C without household gets no choices');
select throws_ok(
  $$ select public.set_notification_preference('shopping', true) $$,
  '42501', null,
  'C without household cannot switch'
);
select throws_ok(
  $$ insert into public.notification_preferences (shopping) values (true) $$,
  '42501', null,
  'C without household cannot insert'
);

select lives_ok(
  $$ select public.create_household('Casa Neri', 'single', 'Chiara', 'salvia') $$,
  'C creates a «Solo io» household'
);
select results_eq(
  $$ select * from public.get_notification_preferences() $$,
  $$ values (true, true, false, true, true) $$,
  'C with a new household gets the defaults'
);
select lives_ok(
  $$ insert into public.notification_preferences (shopping) values (true)
     on conflict (member_id) do update set shopping = excluded.shopping $$,
  'C saves «Spesa» with a direct upsert (same checks as the function)'
);
select lives_ok(
  $$ insert into public.notification_preferences (shopping) values (false)
     on conflict (member_id) do update set shopping = excluded.shopping $$,
  'the same upsert again updates the row'
);
select results_eq(
  $$ select count(*)::integer, bool_and(not p.shopping) from public.notification_preferences p $$,
  $$ values (1, true) $$,
  'C has a single row with «Spesa» off'
);
select lives_ok(
  $$ delete from public.notification_preferences $$,
  'C deletes her row'
);
select is_empty($$ select 1 from public.notification_preferences $$, 'the row of C is gone');
select results_eq(
  $$ select * from public.get_notification_preferences() $$,
  $$ values (true, true, false, true, true) $$,
  'without a row C is back to the defaults'
);
select lives_ok($$ select public.set_notification_preference('morning_digest', false) $$, 'C switches «Sintesi» off');

-- ---------------------------------------------------------------------------
-- A member leaves the household, which stays: only their row is deleted.
-- D (a new account, set up as the database owner) becomes Laura in Casa D'Angelo.
-- ---------------------------------------------------------------------------
reset role;
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', 'dddddddd-0000-4000-8000-000000000001', 'authenticated',
        'authenticated', 'utente-d@example.com', '{"full_name":"Laura Test"}', now(), now());
update public.household_members
set user_id = 'dddddddd-0000-4000-8000-000000000001', joined_at = now()
where id = 'a1000000-0000-4000-8000-000000000002';

set local role authenticated;
set local request.jwt.claims to '{"sub":"dddddddd-0000-4000-8000-000000000001","role":"authenticated"}';
select is_empty($$ select 1 from public.notification_preferences $$, 'D reads 0 rows of A (same household)');
select results_eq(
  $$ select * from public.get_notification_preferences() $$,
  $$ values (true, true, false, true, true) $$,
  'D (Laura) gets the defaults, not the choices of A'
);
select lives_ok($$ select public.set_notification_preference('shopping', true) $$, 'D (Laura) switches «Spesa» on');
select results_eq(
  $$ select p.member_id, p.shopping from public.notification_preferences p $$,
  $$ values ('a1000000-0000-4000-8000-000000000002'::uuid, true) $$,
  'D reads only her own row'
);
select lives_ok(
  $$ delete from public.household_members m where m.user_id = 'dddddddd-0000-4000-8000-000000000001' $$,
  'D (Laura) leaves Casa D''Angelo'
);

reset role;
select ok(
  exists (select 1 from public.households h where h.id = '11111111-1111-4111-8111-111111111111'),
  'Casa D''Angelo stays after Laura leaves'
);
select is_empty(
  $$ select 1 from public.notification_preferences p where p.member_id = 'a1000000-0000-4000-8000-000000000002' $$,
  'the row of Laura is deleted when she leaves'
);
select results_eq(
  $$ select count(*)::integer from public.notification_preferences p where p.member_id = 'a1000000-0000-4000-8000-000000000001' $$,
  $$ values (1) $$,
  'the row of A stays'
);

-- ---------------------------------------------------------------------------
-- An administrator removes another adult, who loses their row.
-- ---------------------------------------------------------------------------
select results_eq(
  $$ select count(*)::integer from public.notification_preferences p where p.member_id = 'b1000000-0000-4000-8000-000000000002' $$,
  $$ values (1) $$,
  'B2 has a row before being removed'
);
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok(
  $$ delete from public.household_members m where m.id = 'b1000000-0000-4000-8000-000000000002' $$,
  'B (admin) removes B2 (Paolo) from Casa Bianchi'
);
reset role;
select ok(
  not exists (select 1 from public.household_members m where m.id = 'b1000000-0000-4000-8000-000000000002')
  and exists (select 1 from public.households h where h.id = '22222222-2222-4222-8222-222222222222'),
  'Paolo is removed, Casa Bianchi stays'
);
select is_empty(
  $$ select 1 from public.notification_preferences p where p.member_id = 'b1000000-0000-4000-8000-000000000002' $$,
  'the row of B2 is deleted when he is removed'
);
select results_eq(
  $$ select count(*)::integer from public.notification_preferences p where p.member_id = 'b1000000-0000-4000-8000-000000000001' $$,
  $$ values (1) $$,
  'the row of B stays'
);

-- ---------------------------------------------------------------------------
-- CA-29: the only adult with an account leaves, the household is deleted with the row.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok(
  $$ delete from public.household_members m where m.user_id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  'A, the only adult with an account, leaves Casa D''Angelo'
);
reset role;
select ok(
  not exists (select 1 from public.households h where h.id = '11111111-1111-4111-8111-111111111111'),
  'Casa D''Angelo is deleted'
);
select is_empty(
  $$ select 1 from public.notification_preferences p where p.household_id = '11111111-1111-4111-8111-111111111111' $$,
  'CA-29: no preference of Casa D''Angelo remains'
);

-- ---------------------------------------------------------------------------
-- The account of the only adult with an account is deleted: the household goes, and with
-- it the row.
-- ---------------------------------------------------------------------------
select lives_ok(
  $$ delete from auth.users where id = 'bbbbbbbb-0000-4000-8000-000000000001' $$,
  'the account of B is deleted'
);
select ok(
  not exists (select 1 from public.households h where h.id = '22222222-2222-4222-8222-222222222222'),
  'Casa Bianchi is deleted'
);
select is_empty(
  $$ select 1 from public.notification_preferences p where p.member_id = 'b1000000-0000-4000-8000-000000000001' $$,
  'the row of B is deleted with the account'
);
select results_eq(
  $$ select m.name, p.morning_digest from public.notification_preferences p
     join public.household_members m on m.id = p.member_id $$,
  $$ values ('Chiara'::text, false) $$,
  'only the row of C remains'
);

-- A household deleted directly (as the database owner) takes the rows with it.
select lives_ok(
  $$ delete from public.households h
     where h.id = (select m.household_id from public.household_members m
                   where m.user_id = 'cccccccc-0000-4000-8000-000000000001') $$,
  'Casa Neri is deleted'
);
select is_empty($$ select 1 from public.notification_preferences $$, 'no preference remains');

select * from finish();
rollback;
