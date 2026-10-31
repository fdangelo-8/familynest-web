-- pinned_spaces: schema, privileges, isolation between households and between adults of
-- the same household, anon, availability of the spaces, limit of six (only available
-- spaces count), pin twice without duplicates, unpin, only POST, cleanup when a member
-- leaves and when an account is deleted, with the household that stays and with the
-- household that goes (issue #187, for #28, #29 and #30).
-- D = dddddddd-…-01, a new account created here, becomes Laura (a1…02).
-- Seed ids: A = Marco (Casa D'Angelo), B = Giulia (Casa Bianchi, admin),
-- B2 = Paolo (Casa Bianchi, not admin), C = Chiara (no household).
-- Members: Casa D'Angelo Marco a1…01, Laura a1…02 (adult without account), Sofia a1…03
-- and Tommaso a1…04 (children), Biscotto a1…05 (pet): all 10 spaces available.
-- Casa Bianchi Giulia b1…01, Paolo b1…02, Leo b1…03 (child), Anna b1…04 (adult without
-- account): no pet, so «Zampe» (pets) is not available.
-- The seed has no pinned spaces.
begin;
create extension if not exists pgtap with schema extensions;

select plan(120);

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------
select has_table('public', 'pinned_spaces', 'pinned_spaces exists');
select ok(
  (select c.relrowsecurity from pg_class c where c.oid = 'public.pinned_spaces'::regclass),
  'RLS enabled on pinned_spaces'
);
select columns_are(
  'public', 'pinned_spaces',
  array['id', 'household_id', 'member_id', 'space', 'pinned_at'],
  'pinned_spaces has exactly the planned columns (no free text)'
);
select fk_ok(
  'public', 'pinned_spaces', 'household_id', 'public', 'households', 'id',
  'pinned_spaces.household_id references households'
);
select fk_ok(
  'public', 'pinned_spaces', array['member_id', 'household_id'],
  'public', 'household_members', array['id', 'household_id'],
  'the member is a member of the same household'
);
select col_is_unique(
  'public', 'pinned_spaces', array['member_id', 'space'],
  'a member pins a space at most once'
);
select has_index(
  'public', 'pinned_spaces', 'pinned_spaces_member_household_idx',
  'index on pinned_spaces (member_id, household_id, pinned_at)'
);
select has_index('public', 'pinned_spaces', 'pinned_spaces_household_id_idx', 'index on pinned_spaces.household_id');
select enum_has_labels(
  'public', 'space_key',
  array['meals', 'couple', 'wellbeing', 'together', 'hobbies', 'chores', 'projects', 'expenses', 'children', 'pets'],
  'space_key has the 10 spaces in the order of the catalogue'
);
select ok(
  not exists (
    select 1 from pg_publication_tables p
    where p.pubname = 'supabase_realtime' and p.schemaname = 'public' and p.tablename = 'pinned_spaces'
  ),
  'pinned_spaces is not sent in real time'
);
select has_function('public', 'pin_space', array['space_key'], 'pin_space exists');
select has_function('public', 'unpin_space', array['space_key'], 'unpin_space exists');

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
select ok(
  not has_table_privilege('anon', 'public.pinned_spaces', 'select, insert, update, delete'),
  'anon has no privilege on pinned_spaces'
);
select ok(
  has_column_privilege('authenticated', 'public.pinned_spaces', 'space', 'insert')
  and not has_column_privilege('authenticated', 'public.pinned_spaces', 'id', 'insert')
  and not has_column_privilege('authenticated', 'public.pinned_spaces', 'household_id', 'insert')
  and not has_column_privilege('authenticated', 'public.pinned_spaces', 'member_id', 'insert')
  and not has_column_privilege('authenticated', 'public.pinned_spaces', 'pinned_at', 'insert'),
  'the app inserts only the key of the space (never id, household, member or pin time)'
);
select ok(
  not has_any_column_privilege('authenticated', 'public.pinned_spaces', 'update'),
  'the app cannot update pinned spaces'
);
select ok(
  has_table_privilege('authenticated', 'public.pinned_spaces', 'select')
  and has_table_privilege('authenticated', 'public.pinned_spaces', 'delete'),
  'the app reads and deletes (RLS limits both to its own rows)'
);
select ok(
  not has_function_privilege('anon', 'public.pin_space(public.space_key)', 'execute')
  and not has_function_privilege('anon', 'public.unpin_space(public.space_key)', 'execute')
  and has_function_privilege('authenticated', 'public.pin_space(public.space_key)', 'execute')
  and has_function_privilege('authenticated', 'public.unpin_space(public.space_key)', 'execute'),
  'only signed-in users pin and unpin'
);
select ok(
  not has_function_privilege('authenticated', 'private.pinned_spaces_before_insert()', 'execute')
  and not has_function_privilege('anon', 'private.space_is_available(uuid, public.space_key)', 'execute'),
  'internal functions of pinned_spaces cannot be called by the app'
);
select ok(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.prosecdef
      and (n.nspname, p.proname) in (
        ('public', 'pin_space'), ('public', 'unpin_space'),
        ('private', 'space_is_available'), ('private', 'pinned_spaces_before_insert')
      )
  ),
  'the functions of pinned_spaces run as the caller (no security definer)'
);

-- ---------------------------------------------------------------------------
-- Seed: no pinned spaces
-- ---------------------------------------------------------------------------
select is_empty($$ select 1 from public.pinned_spaces $$, 'the seed has no pinned spaces');

-- ---------------------------------------------------------------------------
-- Marco (A) pins his spaces
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
set local request.method to 'POST';

select is_empty($$ select 1 from public.pinned_spaces $$, 'A starts without pinned spaces');
select lives_ok($$ select public.pin_space('pets') $$, 'A pins «Zampe»');
select results_eq(
  $$ select p.household_id, p.member_id, p.space::text from public.pinned_spaces p $$,
  $$ values ('11111111-1111-4111-8111-111111111111'::uuid, 'a1000000-0000-4000-8000-000000000001'::uuid, 'pets'::text) $$,
  'the row belongs to the household and the member of A, set by the database'
);
select ok(
  (select p.pinned_at >= now() and p.pinned_at <= clock_timestamp() from public.pinned_spaces p),
  'the pin time is set by the database'
);
select lives_ok($$ select public.pin_space('pets') $$, 'A pins «Zampe» again: no error');
select results_eq(
  $$ select count(*)::integer from public.pinned_spaces p where p.space = 'pets' $$,
  $$ values (1) $$,
  'pinning twice leaves a single row'
);
select throws_ok(
  $$ insert into public.pinned_spaces (space) values ('pets') $$,
  '23505', null,
  'a direct insert of a space already pinned is refused'
);
select throws_ok(
  $$ insert into public.pinned_spaces (household_id, space)
     values ('22222222-2222-4222-8222-222222222222', 'meals') $$,
  '42501', null,
  'the app cannot choose the household'
);
select throws_ok(
  $$ insert into public.pinned_spaces (member_id, space)
     values ('a1000000-0000-4000-8000-000000000002', 'meals') $$,
  '42501', null,
  'the app cannot choose the member'
);
select throws_ok(
  $$ insert into public.pinned_spaces (id, space) values (gen_random_uuid(), 'meals') $$,
  '42501', null,
  'the app cannot choose the id'
);
select throws_ok(
  $$ insert into public.pinned_spaces (space, pinned_at) values ('meals', now() - interval '1 year') $$,
  '42501', null,
  'the app cannot choose the pin time'
);
select throws_ok(
  $$ update public.pinned_spaces set space = 'meals' $$,
  '42501', null,
  'pinned spaces are never changed'
);
select lives_ok($$ select public.pin_space('meals') $$, 'A pins «A tavola»');
select lives_ok(
  $$ insert into public.pinned_spaces (space) values ('hobbies') $$,
  'A pins «Passioni» with a direct insert (same checks as pin_space)'
);
select results_eq(
  $$ select p.space::text from public.pinned_spaces p order by p.pinned_at $$,
  $$ values ('pets'::text), ('meals'), ('hobbies') $$,
  'the pinned spaces of A are read in pin order'
);
select throws_ok($$ select public.pin_space(null) $$, '22004', null, 'pinning needs a space');
select throws_ok($$ select public.unpin_space(null) $$, '22004', null, 'unpinning needs a space');

set local request.method to 'GET';
select throws_ok($$ select public.pin_space('chores') $$, 'P0001', 'use POST', 'pin_space refuses GET');
select throws_ok($$ select public.unpin_space('pets') $$, 'P0001', 'use POST', 'unpin_space refuses GET');
set local request.method to 'HEAD';
select throws_ok($$ select public.pin_space('chores') $$, 'P0001', 'use POST', 'pin_space refuses HEAD');
select throws_ok($$ select public.unpin_space('pets') $$, 'P0001', 'use POST', 'unpin_space refuses HEAD');
set local request.method to 'PUT';
select throws_ok($$ select public.pin_space('chores') $$, 'P0001', 'use POST', 'pin_space refuses PUT');
select throws_ok($$ select public.unpin_space('pets') $$, 'P0001', 'use POST', 'unpin_space refuses PUT');
set local request.method to 'POST';
select results_eq(
  $$ select p.space::text from public.pinned_spaces p order by p.pinned_at $$,
  $$ values ('pets'::text), ('meals'), ('hobbies') $$,
  'the refused calls changed nothing'
);

-- ---------------------------------------------------------------------------
-- Giulia (B): nothing of Casa D'Angelo exists for her
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';

select is_empty($$ select 1 from public.pinned_spaces $$, 'B reads 0 pinned spaces of A');
select results_eq(
  $$ with d as (delete from public.pinned_spaces p where p.member_id = 'a1000000-0000-4000-8000-000000000001' returning 1)
     select count(*)::integer from d $$,
  $$ values (0) $$,
  'B cannot delete the pinned spaces of A'
);
select lives_ok($$ select public.unpin_space('pets') $$, 'B unpins «Zampe», that she never pinned: no error');
select lives_ok($$ select public.pin_space('couple') $$, 'B pins «Noi due» (three adults)');
select lives_ok($$ select public.pin_space('children') $$, 'B pins «Crescere» (Leo)');
select results_eq(
  $$ select p.household_id, p.member_id, p.space::text from public.pinned_spaces p order by p.pinned_at $$,
  $$ values ('22222222-2222-4222-8222-222222222222'::uuid, 'b1000000-0000-4000-8000-000000000001'::uuid, 'couple'::text),
            ('22222222-2222-4222-8222-222222222222'::uuid, 'b1000000-0000-4000-8000-000000000001'::uuid, 'children'::text) $$,
  'the rows of B are in her household, for her member'
);
select throws_ok(
  $$ select public.pin_space('pets') $$,
  'FN002', 'space not available',
  'B cannot pin «Zampe»: Casa Bianchi has no pet'
);

-- ---------------------------------------------------------------------------
-- Paolo (B2): the spaces of Giulia, in the same household, are personal
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';

select is_empty($$ select 1 from public.pinned_spaces $$, 'B2 reads 0 pinned spaces of B (same household)');
select results_eq(
  $$ with d as (delete from public.pinned_spaces p where p.member_id = 'b1000000-0000-4000-8000-000000000001' returning 1)
     select count(*)::integer from d $$,
  $$ values (0) $$,
  'B2 cannot delete the pinned spaces of B'
);
select lives_ok($$ select public.unpin_space('couple') $$, 'B2 unpins «Noi due»: only his own row would go');
select lives_ok($$ select public.pin_space('couple') $$, 'B2 pins «Noi due» for himself');
select results_eq(
  $$ select p.member_id, p.space::text from public.pinned_spaces p $$,
  $$ values ('b1000000-0000-4000-8000-000000000002'::uuid, 'couple'::text) $$,
  'B2 reads only his own pinned space'
);

reset role;
select results_eq(
  $$ select p.member_id, count(*)::integer from public.pinned_spaces p group by p.member_id order by p.member_id $$,
  $$ values ('a1000000-0000-4000-8000-000000000001'::uuid, 3),
            ('b1000000-0000-4000-8000-000000000001'::uuid, 2),
            ('b1000000-0000-4000-8000-000000000002'::uuid, 1) $$,
  'the pinned spaces of A and B survived the attempts of the others'
);

-- Trusted roles still pin only for adults with an account.
select throws_ok(
  $$ insert into public.pinned_spaces (household_id, member_id, space)
     values ('11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000003', 'meals') $$,
  '23514', null,
  'a child never has pinned spaces'
);
select throws_ok(
  $$ insert into public.pinned_spaces (household_id, member_id, space)
     values ('11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000002', 'meals') $$,
  '23514', null,
  'an adult without account never has pinned spaces'
);

-- ---------------------------------------------------------------------------
-- anon: no access at all
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';

select throws_ok($$ select 1 from public.pinned_spaces $$, '42501', null, 'anon cannot read pinned spaces');
select throws_ok($$ insert into public.pinned_spaces (space) values ('meals') $$, '42501', null, 'anon cannot insert');
select throws_ok($$ delete from public.pinned_spaces $$, '42501', null, 'anon cannot delete');
select throws_ok($$ select public.pin_space('meals') $$, '42501', null, 'anon cannot pin');
select throws_ok($$ select public.unpin_space('pets') $$, '42501', null, 'anon cannot unpin');

-- ---------------------------------------------------------------------------
-- Chiara (C): no household, then a «Solo io» household
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}';

select is_empty($$ select 1 from public.pinned_spaces $$, 'C without household reads 0 pinned spaces');
select throws_ok($$ select public.pin_space('meals') $$, '42501', null, 'C without household cannot pin');
select throws_ok($$ select public.unpin_space('meals') $$, '42501', null, 'C without household cannot unpin');

select lives_ok(
  $$ select public.create_household('Casa Neri', 'single', 'Chiara', 'salvia') $$,
  'C creates a «Solo io» household'
);
select throws_ok($$ select public.pin_space('couple') $$, 'FN002', 'space not available', '«Noi due» needs 2 adults');
select throws_ok($$ select public.pin_space('expenses') $$, 'FN002', 'space not available', '«Conti chiari» needs 2 adults');
select throws_ok($$ select public.pin_space('children') $$, 'FN002', 'space not available', '«Crescere» needs a child');
select throws_ok($$ select public.pin_space('pets') $$, 'FN002', 'space not available', '«Zampe» needs a pet');
select throws_ok(
  $$ insert into public.pinned_spaces (space) values ('pets') $$,
  'FN002', 'space not available',
  'a direct insert of a space not available is refused too'
);
select is_empty($$ select 1 from public.pinned_spaces $$, 'no row for the refused spaces');
select lives_ok($$ select public.pin_space('meals') $$, 'C pins «A tavola» (always available)');
select lives_ok(
  $$ insert into public.household_members (household_id, kind, name, color)
     values (public.current_household_id(), 'adult', 'Luca', 'glicine') $$,
  'C adds the adult Luca, without account'
);
select lives_ok($$ select public.pin_space('couple') $$, 'with 2 adults (one without account) «Noi due» can be pinned');
select lives_ok($$ select public.unpin_space('meals') $$, 'C unpins «A tavola»');
select lives_ok($$ select public.pin_space('meals') $$, 'C pins «A tavola» again («Annulla»)');
select results_eq(
  $$ select p.space::text from public.pinned_spaces p order by p.pinned_at $$,
  $$ values ('couple'::text), ('meals') $$,
  'a space pinned again goes to the end of the list'
);

-- ---------------------------------------------------------------------------
-- Limit of six (Marco: «Zampe», «A tavola», «Passioni» already pinned)
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';

select lives_ok(
  $$ select public.pin_space(s) from unnest(array['wellbeing', 'together', 'chores']::public.space_key[]) as s $$,
  'A pins three more spaces'
);
select results_eq($$ select count(*)::integer from public.pinned_spaces $$, $$ values (6) $$, 'A has six pinned spaces');
select throws_ok(
  $$ select public.pin_space('projects') $$,
  'FN001', 'pinned space limit reached',
  'the seventh space is refused with the limit error'
);
select throws_ok(
  $$ insert into public.pinned_spaces (space) values ('projects') $$,
  'FN001', 'pinned space limit reached',
  'a direct insert of a seventh space is refused too'
);
select results_eq($$ select count(*)::integer from public.pinned_spaces $$, $$ values (6) $$, 'A still has six pinned spaces');
select lives_ok($$ select public.pin_space('meals') $$, 'at the limit, pinning a space already pinned gives no error');
select results_eq($$ select count(*)::integer from public.pinned_spaces $$, $$ values (6) $$, 'and adds nothing');

-- The only pet leaves: «Zampe» is no longer available and no longer counts.
reset role;
select lives_ok(
  $$ delete from public.household_members where id = 'a1000000-0000-4000-8000-000000000005' $$,
  'Biscotto, the only pet of Casa D''Angelo, is removed'
);
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';

select results_eq(
  $$ select count(*)::integer from public.pinned_spaces p where p.space = 'pets' $$,
  $$ values (1) $$,
  'the database keeps «Zampe» pinned'
);
select lives_ok($$ select public.pin_space('pets') $$, 'pinning «Zampe» again, now not available but already pinned: no error');
select lives_ok($$ select public.pin_space('projects') $$, 'with five available pinned spaces, a sixth one is pinned');
select results_eq($$ select count(*)::integer from public.pinned_spaces $$, $$ values (7) $$, 'A has seven rows, six available');
select throws_ok(
  $$ select public.pin_space('expenses') $$,
  'FN001', 'pinned space limit reached',
  'with six available pinned spaces, another one is refused'
);

-- A pet comes back: «Zampe» is available again and stays pinned, even beyond six.
select lives_ok(
  $$ insert into public.household_members (household_id, kind, name, color)
     values (public.current_household_id(), 'pet', 'Fido', 'zafferano') $$,
  'A adds the pet Fido'
);
select results_eq($$ select count(*)::integer from public.pinned_spaces $$, $$ values (7) $$, 'the seven pinned spaces stay');
select throws_ok(
  $$ select public.pin_space('expenses') $$,
  'FN001', 'pinned space limit reached',
  'with seven available pinned spaces, new ones are refused'
);
select throws_ok(
  $$ select public.pin_space('couple') $$,
  'FN001', 'pinned space limit reached',
  'the limit applies to every new space'
);

-- ---------------------------------------------------------------------------
-- Unpin
-- ---------------------------------------------------------------------------
select lives_ok($$ select public.unpin_space('hobbies') $$, 'A unpins «Passioni»');
select is_empty($$ select 1 from public.pinned_spaces p where p.space = 'hobbies' $$, 'the row of «Passioni» is gone');
select lives_ok($$ select public.unpin_space('hobbies') $$, 'unpinning a space not pinned gives no error');
select results_eq($$ select count(*)::integer from public.pinned_spaces $$, $$ values (6) $$, 'A has six pinned spaces');
select results_eq(
  $$ with d as (delete from public.pinned_spaces p where p.space = 'projects' returning 1)
     select count(*)::integer from d $$,
  $$ values (1) $$,
  'A deletes his own row directly'
);

-- ---------------------------------------------------------------------------
-- A member leaves the household, which stays: only their pinned spaces are deleted.
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
select lives_ok($$ select public.pin_space('couple') $$, 'D (Laura) pins «Noi due»');
select lives_ok($$ select public.pin_space('meals') $$, 'D (Laura) pins «A tavola»');
select is_empty(
  $$ select 1 from public.pinned_spaces p where p.member_id = 'a1000000-0000-4000-8000-000000000001' $$,
  'D reads 0 pinned spaces of A (same household)'
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
  $$ select 1 from public.pinned_spaces p where p.member_id = 'a1000000-0000-4000-8000-000000000002' $$,
  'the pinned spaces of Laura are deleted when she leaves'
);
select results_eq(
  $$ select count(*)::integer from public.pinned_spaces p where p.member_id = 'a1000000-0000-4000-8000-000000000001' $$,
  $$ values (5) $$,
  'the pinned spaces of A stay'
);

-- ---------------------------------------------------------------------------
-- The account of an adult who is not the only one of the household is deleted: the
-- household stays, only their pinned spaces are deleted.
-- ---------------------------------------------------------------------------
select results_eq(
  $$ select count(*)::integer from public.pinned_spaces p where p.member_id = 'b1000000-0000-4000-8000-000000000002' $$,
  $$ values (1) $$,
  'B2 has one pinned space before the deletion'
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
  $$ select 1 from public.pinned_spaces p where p.member_id = 'b1000000-0000-4000-8000-000000000002' $$,
  'the pinned spaces of B2 are deleted with his account'
);
select results_eq(
  $$ select count(*)::integer from public.pinned_spaces p where p.member_id = 'b1000000-0000-4000-8000-000000000001' $$,
  $$ values (2) $$,
  'the pinned spaces of B stay'
);

-- One more pinned space for C, to check the cleanup when her account is deleted.
select lives_ok(
  $$ insert into public.pinned_spaces (household_id, member_id, space)
     select m.household_id, m.id, 'wellbeing' from public.household_members m where m.name = 'Chiara' $$,
  'C pins «Stare bene» (set up as the database owner)'
);
select results_eq(
  $$ select count(*)::integer from public.pinned_spaces p
     join public.household_members m on m.id = p.member_id where m.name = 'Chiara' $$,
  $$ values (3) $$,
  'C has three pinned spaces'
);

-- ---------------------------------------------------------------------------
-- The account of the only adult with an account is deleted: the household goes, and
-- with it the pinned spaces
-- ---------------------------------------------------------------------------
select lives_ok(
  $$ delete from auth.users where id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  'the account of A is deleted'
);
select is_empty(
  $$ select 1 from public.pinned_spaces p where p.member_id = 'a1000000-0000-4000-8000-000000000001' $$,
  'the pinned spaces of A are deleted with the account'
);
select lives_ok(
  $$ delete from auth.users where id = 'cccccccc-0000-4000-8000-000000000001' $$,
  'the account of C is deleted'
);
select results_eq(
  $$ select p.member_id, count(*)::integer from public.pinned_spaces p group by p.member_id $$,
  $$ values ('b1000000-0000-4000-8000-000000000001'::uuid, 2) $$,
  'only the pinned spaces of B remain'
);

select * from finish();
rollback;
