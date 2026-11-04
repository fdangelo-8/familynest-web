-- space_interests: schema, privileges, isolation between households and between adults of
-- the same household, anon, availability of the spaces, register twice without
-- duplicates, remove (also a space not registered or no longer available), only POST,
-- independence from pinned_spaces, the count for Francesco (service_role only), cleanup
-- when a member leaves and when an account is deleted, with the household that stays and
-- with the household that goes (issue #216, for #29).
-- Seed ids: A = Marco (Casa D'Angelo), B = Giulia (Casa Bianchi, admin),
-- B2 = Paolo (Casa Bianchi, not admin), C = Chiara (no household).
-- Members: Casa D'Angelo Marco a1…01, Laura a1…02 (adult without account), Sofia a1…03
-- and Tommaso a1…04 (children), Biscotto a1…05 (pet): all 10 spaces available.
-- Casa Bianchi Giulia b1…01, Paolo b1…02, Leo b1…03 (child), Anna b1…04 (adult without
-- account): no pet, so «Zampe» (pets) is not available.
-- D = dddddddd-…-01, a new account created here, becomes Laura (a1…02).
-- The seed has no interests.
begin;
create extension if not exists pgtap with schema extensions;

select plan(107);

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------
select has_table('public', 'space_interests', 'space_interests exists');
select ok(
  (select c.relrowsecurity from pg_class c where c.oid = 'public.space_interests'::regclass),
  'RLS enabled on space_interests'
);
select columns_are(
  'public', 'space_interests',
  array['id', 'household_id', 'member_id', 'space', 'created_at'],
  'space_interests has exactly the planned columns (no free text, no email, no channel)'
);
select fk_ok(
  'public', 'space_interests', 'household_id', 'public', 'households', 'id',
  'space_interests.household_id references households'
);
select fk_ok(
  'public', 'space_interests', array['member_id', 'household_id'],
  'public', 'household_members', array['id', 'household_id'],
  'the member is a member of the same household'
);
select col_is_unique(
  'public', 'space_interests', array['member_id', 'space'],
  'a member registers a space at most once'
);
select has_index(
  'public', 'space_interests', 'space_interests_member_household_idx',
  'index on space_interests (member_id, household_id)'
);
select has_index('public', 'space_interests', 'space_interests_household_id_idx', 'index on space_interests.household_id');
select ok(
  not exists (
    select 1 from pg_publication_tables p
    where p.pubname = 'supabase_realtime' and p.schemaname = 'public' and p.tablename = 'space_interests'
  ),
  'space_interests is not sent in real time'
);
select has_function('public', 'add_space_interest', array['space_key'], 'add_space_interest exists');
select has_function('public', 'remove_space_interest', array['space_key'], 'remove_space_interest exists');
select has_function('public', 'space_interest_counts', 'space_interest_counts exists');
select is(
  (select p.proargnames from pg_proc p where p.oid = 'public.space_interest_counts()'::regprocedure),
  array['space', 'adults', 'households']::text[],
  'the count returns only the space and two numbers (no id, name or date)'
);

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
select ok(
  not has_table_privilege('anon', 'public.space_interests', 'select, insert, update, delete'),
  'anon has no privilege on space_interests'
);
select ok(
  has_column_privilege('authenticated', 'public.space_interests', 'space', 'insert')
  and not has_column_privilege('authenticated', 'public.space_interests', 'id', 'insert')
  and not has_column_privilege('authenticated', 'public.space_interests', 'household_id', 'insert')
  and not has_column_privilege('authenticated', 'public.space_interests', 'member_id', 'insert')
  and not has_column_privilege('authenticated', 'public.space_interests', 'created_at', 'insert'),
  'the app inserts only the key of the space (never id, household, member or time)'
);
select ok(
  not has_any_column_privilege('authenticated', 'public.space_interests', 'update'),
  'the app cannot update interests'
);
select ok(
  has_table_privilege('authenticated', 'public.space_interests', 'select')
  and has_table_privilege('authenticated', 'public.space_interests', 'delete'),
  'the app reads and deletes (RLS limits both to its own rows)'
);
select ok(
  not has_function_privilege('anon', 'public.add_space_interest(public.space_key)', 'execute')
  and not has_function_privilege('anon', 'public.remove_space_interest(public.space_key)', 'execute')
  and has_function_privilege('authenticated', 'public.add_space_interest(public.space_key)', 'execute')
  and has_function_privilege('authenticated', 'public.remove_space_interest(public.space_key)', 'execute'),
  'only signed-in users register and remove interests'
);
select ok(
  not has_function_privilege('anon', 'public.space_interest_counts()', 'execute')
  and not has_function_privilege('authenticated', 'public.space_interest_counts()', 'execute')
  and has_function_privilege('service_role', 'public.space_interest_counts()', 'execute'),
  'only the administrative key runs the count'
);
select ok(
  not has_function_privilege('authenticated', 'private.space_interests_before_insert()', 'execute'),
  'the trigger function cannot be called by the app'
);
select ok(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.prosecdef
      and (n.nspname, p.proname) in (
        ('public', 'add_space_interest'), ('public', 'remove_space_interest'),
        ('public', 'space_interest_counts'), ('private', 'space_interests_before_insert')
      )
  ),
  'the functions of space_interests run as the caller (no security definer)'
);

-- ---------------------------------------------------------------------------
-- Seed: no interests
-- ---------------------------------------------------------------------------
select is_empty($$ select 1 from public.space_interests $$, 'the seed has no interests');

-- ---------------------------------------------------------------------------
-- Marco (A) registers his interests
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
set local request.method to 'POST';

select is_empty($$ select 1 from public.space_interests $$, 'A starts without interests');
select lives_ok($$ select public.add_space_interest('meals') $$, 'A registers «A tavola»');
select results_eq(
  $$ select i.household_id, i.member_id, i.space::text from public.space_interests i $$,
  $$ values ('11111111-1111-4111-8111-111111111111'::uuid, 'a1000000-0000-4000-8000-000000000001'::uuid, 'meals'::text) $$,
  'the row belongs to the household and the member of A, set by the database'
);
select ok(
  (select i.created_at >= now() and i.created_at <= clock_timestamp() from public.space_interests i),
  'the registration time is set by the database'
);
select is_empty(
  $$ select 1 from public.pinned_spaces $$,
  'registering an interest does not pin the space'
);
select lives_ok($$ select public.add_space_interest('meals') $$, 'A registers «A tavola» again: no error');
select results_eq(
  $$ select count(*)::integer from public.space_interests i where i.space = 'meals' $$,
  $$ values (1) $$,
  'registering twice leaves a single row'
);
select lives_ok($$ select public.pin_space('meals') $$, 'A pins «A tavola»');
select results_eq(
  $$ select count(*)::integer from public.space_interests i where i.space = 'meals' $$,
  $$ values (1) $$,
  'pinning does not add an interest'
);
select throws_ok(
  $$ insert into public.space_interests (space) values ('meals') $$,
  '23505', null,
  'a direct insert of a space already registered is refused'
);
select throws_ok(
  $$ insert into public.space_interests (household_id, space)
     values ('22222222-2222-4222-8222-222222222222', 'hobbies') $$,
  '42501', null,
  'the app cannot choose the household'
);
select throws_ok(
  $$ insert into public.space_interests (member_id, space)
     values ('a1000000-0000-4000-8000-000000000002', 'hobbies') $$,
  '42501', null,
  'the app cannot choose the member'
);
select throws_ok(
  $$ insert into public.space_interests (id, space) values (gen_random_uuid(), 'hobbies') $$,
  '42501', null,
  'the app cannot choose the id'
);
select throws_ok(
  $$ insert into public.space_interests (space, created_at) values ('hobbies', now() - interval '1 year') $$,
  '42501', null,
  'the app cannot choose the time'
);
select throws_ok(
  $$ update public.space_interests set space = 'hobbies' $$,
  '42501', null,
  'interests are never changed'
);
select lives_ok($$ select public.add_space_interest('pets') $$, 'A registers «Zampe» (Biscotto)');
select lives_ok(
  $$ insert into public.space_interests (space) values ('hobbies') $$,
  'A registers «Passioni» with a direct insert (same checks as add_space_interest)'
);
select results_eq(
  $$ select i.space::text from public.space_interests i order by i.created_at $$,
  $$ values ('meals'::text), ('pets'), ('hobbies') $$,
  'the interests of A'
);
select throws_ok($$ select public.add_space_interest(null) $$, '22004', null, 'registering needs a space');
select throws_ok($$ select public.remove_space_interest(null) $$, '22004', null, 'removing needs a space');
select throws_ok(
  $$ select * from public.space_interest_counts() $$,
  '42501', null,
  'a signed-in user cannot run the count'
);

set local request.method to 'GET';
select throws_ok($$ select public.add_space_interest('chores') $$, 'P0001', 'use POST', 'add_space_interest refuses GET');
select throws_ok($$ select public.remove_space_interest('meals') $$, 'P0001', 'use POST', 'remove_space_interest refuses GET');
set local request.method to 'HEAD';
select throws_ok($$ select public.add_space_interest('chores') $$, 'P0001', 'use POST', 'add_space_interest refuses HEAD');
select throws_ok($$ select public.remove_space_interest('meals') $$, 'P0001', 'use POST', 'remove_space_interest refuses HEAD');
set local request.method to 'PUT';
select throws_ok($$ select public.add_space_interest('chores') $$, 'P0001', 'use POST', 'add_space_interest refuses PUT');
select throws_ok($$ select public.remove_space_interest('meals') $$, 'P0001', 'use POST', 'remove_space_interest refuses PUT');
set local request.method to 'POST';
select results_eq(
  $$ select i.space::text from public.space_interests i order by i.created_at $$,
  $$ values ('meals'::text), ('pets'), ('hobbies') $$,
  'the refused calls changed nothing'
);

-- ---------------------------------------------------------------------------
-- Giulia (B): nothing of Casa D'Angelo exists for her
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';

select is_empty($$ select 1 from public.space_interests $$, 'B reads 0 interests of A');
select results_eq(
  $$ with d as (delete from public.space_interests i where i.member_id = 'a1000000-0000-4000-8000-000000000001' returning 1)
     select count(*)::integer from d $$,
  $$ values (0) $$,
  'B cannot delete the interests of A'
);
select lives_ok(
  $$ select public.remove_space_interest('meals') $$,
  'B removes «A tavola», that she never registered: no error'
);
select lives_ok($$ select public.add_space_interest('couple') $$, 'B registers «Noi due» (three adults)');
select lives_ok($$ select public.add_space_interest('meals') $$, 'B registers «A tavola»');
select results_eq(
  $$ select i.household_id, i.member_id, i.space::text from public.space_interests i order by i.created_at $$,
  $$ values ('22222222-2222-4222-8222-222222222222'::uuid, 'b1000000-0000-4000-8000-000000000001'::uuid, 'couple'::text),
            ('22222222-2222-4222-8222-222222222222'::uuid, 'b1000000-0000-4000-8000-000000000001'::uuid, 'meals'::text) $$,
  'the rows of B are in her household, for her member'
);
select throws_ok(
  $$ select public.add_space_interest('pets') $$,
  'FN002', 'space not available',
  'B cannot register «Zampe»: Casa Bianchi has no pet'
);

-- ---------------------------------------------------------------------------
-- Paolo (B2): the interests of Giulia, in the same household, are personal
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';

select is_empty($$ select 1 from public.space_interests $$, 'B2 reads 0 interests of B (same household)');
select results_eq(
  $$ with d as (delete from public.space_interests i where i.member_id = 'b1000000-0000-4000-8000-000000000001' returning 1)
     select count(*)::integer from d $$,
  $$ values (0) $$,
  'B2 cannot delete the interests of B'
);
select lives_ok($$ select public.remove_space_interest('couple') $$, 'B2 removes «Noi due»: only his own row would go');
select lives_ok($$ select public.add_space_interest('couple') $$, 'B2 registers «Noi due» for himself');
select results_eq(
  $$ select i.member_id, i.space::text from public.space_interests i $$,
  $$ values ('b1000000-0000-4000-8000-000000000002'::uuid, 'couple'::text) $$,
  'B2 reads only his own interest'
);

reset role;
select results_eq(
  $$ select i.member_id, count(*)::integer from public.space_interests i group by i.member_id order by i.member_id $$,
  $$ values ('a1000000-0000-4000-8000-000000000001'::uuid, 3),
            ('b1000000-0000-4000-8000-000000000001'::uuid, 2),
            ('b1000000-0000-4000-8000-000000000002'::uuid, 1) $$,
  'the interests of A and B survived the attempts of the others'
);

-- Trusted roles still register only for adults with an account.
select throws_ok(
  $$ insert into public.space_interests (household_id, member_id, space)
     values ('11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000003', 'meals') $$,
  '23514', null,
  'a child never has interests'
);
select throws_ok(
  $$ insert into public.space_interests (household_id, member_id, space)
     values ('11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000002', 'meals') $$,
  '23514', null,
  'an adult without account never has interests'
);

-- ---------------------------------------------------------------------------
-- anon: no access at all
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';

select throws_ok($$ select 1 from public.space_interests $$, '42501', null, 'anon cannot read interests');
select throws_ok($$ insert into public.space_interests (space) values ('meals') $$, '42501', null, 'anon cannot insert');
select throws_ok($$ delete from public.space_interests $$, '42501', null, 'anon cannot delete');
select throws_ok($$ select public.add_space_interest('meals') $$, '42501', null, 'anon cannot register');
select throws_ok($$ select public.remove_space_interest('meals') $$, '42501', null, 'anon cannot remove');
select throws_ok($$ select * from public.space_interest_counts() $$, '42501', null, 'anon cannot run the count');

-- ---------------------------------------------------------------------------
-- Chiara (C): no household, then a «Solo io» household
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}';

select is_empty($$ select 1 from public.space_interests $$, 'C without household reads 0 interests');
select throws_ok($$ select public.add_space_interest('meals') $$, '42501', null, 'C without household cannot register');
select throws_ok($$ select public.remove_space_interest('meals') $$, '42501', null, 'C without household cannot remove');

select lives_ok(
  $$ select public.create_household('Casa Neri', 'single', 'Chiara', 'salvia') $$,
  'C creates a «Solo io» household'
);
select throws_ok($$ select public.add_space_interest('couple') $$, 'FN002', 'space not available', '«Noi due» needs 2 adults');
select throws_ok($$ select public.add_space_interest('expenses') $$, 'FN002', 'space not available', '«Conti chiari» needs 2 adults');
select throws_ok($$ select public.add_space_interest('children') $$, 'FN002', 'space not available', '«Crescere» needs a child');
select throws_ok($$ select public.add_space_interest('pets') $$, 'FN002', 'space not available', '«Zampe» needs a pet');
select throws_ok(
  $$ insert into public.space_interests (space) values ('pets') $$,
  'FN002', 'space not available',
  'a direct insert of a space not available is refused too'
);
select is_empty($$ select 1 from public.space_interests $$, 'no row for the refused spaces');
select lives_ok($$ select public.add_space_interest('meals') $$, 'C registers «A tavola» (always available)');
select lives_ok($$ select public.remove_space_interest('meals') $$, 'C removes «A tavola»');
select is_empty($$ select 1 from public.space_interests $$, 'the row of C is gone');
select lives_ok($$ select public.remove_space_interest('meals') $$, 'removing a space not registered gives no error');
select lives_ok($$ select public.add_space_interest('projects') $$, 'C registers «Progetti»');

-- ---------------------------------------------------------------------------
-- A space that is no longer available (Marco: «Zampe» registered, the only pet leaves)
-- ---------------------------------------------------------------------------
reset role;
select lives_ok(
  $$ delete from public.household_members where id = 'a1000000-0000-4000-8000-000000000005' $$,
  'Biscotto, the only pet of Casa D''Angelo, is removed'
);
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';

select lives_ok(
  $$ select public.add_space_interest('pets') $$,
  'registering «Zampe» again, now not available but already registered: no error'
);
select results_eq(
  $$ select count(*)::integer from public.space_interests i where i.space = 'pets' $$,
  $$ values (1) $$,
  'the interest for «Zampe» is still there, once'
);
select lives_ok($$ select public.remove_space_interest('pets') $$, 'A removes «Zampe», no longer available');
select is_empty($$ select 1 from public.space_interests i where i.space = 'pets' $$, 'the row of «Zampe» is gone');

-- ---------------------------------------------------------------------------
-- The count for Francesco, with the administrative key
-- A: meals, hobbies; B: couple, meals; B2: couple; C: projects.
-- ---------------------------------------------------------------------------
set local role service_role;
set local request.jwt.claims to '{"role":"service_role"}';

select results_eq(
  $$ select c.space::text, c.adults, c.households from public.space_interest_counts() c $$,
  $$ values ('meals'::text, 2, 2), ('couple', 2, 1), ('wellbeing', 0, 0), ('together', 0, 0),
            ('hobbies', 1, 1), ('chores', 0, 0), ('projects', 1, 1), ('expenses', 0, 0),
            ('children', 0, 0), ('pets', 0, 0) $$,
  'the count gives, for the 10 spaces in order, the adults and the households'
);

-- ---------------------------------------------------------------------------
-- A member leaves the household, which stays: only their interests are deleted.
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
select lives_ok($$ select public.add_space_interest('couple') $$, 'D (Laura) registers «Noi due»');
select lives_ok($$ select public.add_space_interest('meals') $$, 'D (Laura) registers «A tavola»');
select is_empty(
  $$ select 1 from public.space_interests i where i.member_id = 'a1000000-0000-4000-8000-000000000001' $$,
  'D reads 0 interests of A (same household)'
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
  $$ select 1 from public.space_interests i where i.member_id = 'a1000000-0000-4000-8000-000000000002' $$,
  'the interests of Laura are deleted when she leaves'
);
select results_eq(
  $$ select count(*)::integer from public.space_interests i where i.member_id = 'a1000000-0000-4000-8000-000000000001' $$,
  $$ values (2) $$,
  'the interests of A stay'
);

-- ---------------------------------------------------------------------------
-- The account of an adult who is not the only one of the household is deleted: the
-- household stays, only their interests are deleted.
-- ---------------------------------------------------------------------------
select results_eq(
  $$ select count(*)::integer from public.space_interests i where i.member_id = 'b1000000-0000-4000-8000-000000000002' $$,
  $$ values (1) $$,
  'B2 has one interest before the deletion'
);
select lives_ok(
  $$ delete from auth.users where id = 'bbbbbbbb-0000-4000-8000-000000000002' $$,
  'the account of B2 (Paolo) is deleted'
);
select ok(
  exists (select 1 from public.households h where h.id = '22222222-2222-4222-8222-222222222222'),
  'Casa Bianchi stays'
);
select is_empty(
  $$ select 1 from public.space_interests i where i.member_id = 'b1000000-0000-4000-8000-000000000002' $$,
  'the interests of B2 are deleted with his account'
);
select results_eq(
  $$ select count(*)::integer from public.space_interests i where i.member_id = 'b1000000-0000-4000-8000-000000000001' $$,
  $$ values (2) $$,
  'the interests of B stay'
);

-- ---------------------------------------------------------------------------
-- The account of the only adult with an account is deleted: the household goes, and with
-- it the interests
-- ---------------------------------------------------------------------------
select lives_ok(
  $$ delete from auth.users where id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  'the account of A is deleted'
);
select is_empty(
  $$ select 1 from public.space_interests i where i.member_id = 'a1000000-0000-4000-8000-000000000001' $$,
  'the interests of A are deleted with the account'
);
select results_eq(
  $$ select m.name, count(*)::integer from public.space_interests i
     join public.household_members m on m.id = i.member_id group by m.name order by m.name $$,
  $$ values ('Chiara'::text, 1), ('Giulia', 2) $$,
  'only the interests of B and C remain'
);

select * from finish();
rollback;
