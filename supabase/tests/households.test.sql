-- households: isolation and permissions (issue #9: CA-9, CA-10, CA-11, CA-12, CA-13, CA-22).
-- Seed ids: A = Marco (Casa D'Angelo, admin), B = Giulia (Casa Bianchi, admin),
-- B2 = Paolo (Casa Bianchi, not admin), C = Chiara (no household).
begin;
create extension if not exists pgtap with schema extensions;

select plan(21);

-- ---------------------------------------------------------------------------
-- A reads only their own household (CA-9).
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';

select results_eq(
  $$ select h.name from public.households h $$,
  $$ values ('Casa D''Angelo') $$,
  'CA-9: A sees only Casa D''Angelo'
);

-- CA-22: name rules, only valid names are accepted, spaces are trimmed.
select throws_ok(
  $$ update public.households set name = '' where id = '11111111-1111-4111-8111-111111111111' $$,
  '23514',
  null,
  'CA-22: empty household name is refused'
);
select throws_ok(
  $$ update public.households set name = '   ' where id = '11111111-1111-4111-8111-111111111111' $$,
  '23514',
  null,
  'CA-22: blank household name is refused'
);
select throws_ok(
  $$ update public.households set name = repeat('x', 61) where id = '11111111-1111-4111-8111-111111111111' $$,
  '23514',
  null,
  'CA-22: 61 character household name is refused'
);
select lives_ok(
  $$ update public.households set name = '  Casa D''Angelo Rossi  ' where id = '11111111-1111-4111-8111-111111111111' $$,
  'CA-22: admin renames the household'
);
select is(
  (select h.name from public.households h where h.id = '11111111-1111-4111-8111-111111111111'),
  'Casa D''Angelo Rossi',
  'CA-22: the new name is stored trimmed'
);

-- Nobody creates or deletes a household directly.
select throws_ok(
  $$ insert into public.households (name, household_type) values ('Casa Nuova', 'single') $$,
  '42501',
  null,
  'a household cannot be inserted directly'
);
select is_empty(
  $$ delete from public.households where id = '11111111-1111-4111-8111-111111111111' returning id $$,
  'even the admin cannot delete the household directly (0 rows)'
);

-- ---------------------------------------------------------------------------
-- B cannot see or touch Casa D'Angelo (CA-10, CA-11).
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';

select results_eq(
  $$ select h.name from public.households h $$,
  $$ values ('Casa Bianchi') $$,
  'B sees only Casa Bianchi'
);
select is_empty(
  $$ select 1 from public.households h where h.id = '11111111-1111-4111-8111-111111111111' $$,
  'CA-10: B reads 0 rows of Casa D''Angelo'
);
select is_empty(
  $$ update public.households set name = 'Hacked' where id = '11111111-1111-4111-8111-111111111111' returning id $$,
  'CA-11: B updates 0 rows of Casa D''Angelo'
);
select is_empty(
  $$ delete from public.households where id = '11111111-1111-4111-8111-111111111111' returning id $$,
  'CA-11: B deletes 0 rows of Casa D''Angelo'
);
select throws_ok(
  $$ update public.households set id = gen_random_uuid() where id = '22222222-2222-4222-8222-222222222222' $$,
  '42501',
  null,
  'the household id cannot be changed'
);

-- ---------------------------------------------------------------------------
-- B2 (not admin) cannot change the household.
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';

select results_eq(
  $$ select h.name from public.households h $$,
  $$ values ('Casa Bianchi') $$,
  'B2 reads their own household'
);
select is_empty(
  $$ update public.households set household_type = 'single' where id = '22222222-2222-4222-8222-222222222222' returning id $$,
  'B2 (not admin) cannot change the household (0 rows)'
);

-- ---------------------------------------------------------------------------
-- C without household reads nothing (CA-13).
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}';

select is_empty($$ select 1 from public.households $$, 'CA-13: C without household reads 0 households');

-- ---------------------------------------------------------------------------
-- Anonymous users read nothing and write nothing (CA-12).
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';

select is_empty($$ select 1 from public.households $$, 'CA-12: anon reads 0 households');
select throws_ok(
  $$ insert into public.households (name, household_type) values ('Casa Anonima', 'single') $$,
  '42501',
  null,
  'CA-12: anon cannot insert a household'
);
select throws_ok(
  $$ update public.households set name = 'Hacked' $$,
  '42501',
  null,
  'CA-12: anon cannot update households'
);

-- ---------------------------------------------------------------------------
-- Data of Casa D'Angelo and Casa Bianchi unchanged by the refused attempts.
-- ---------------------------------------------------------------------------
reset role;

select results_eq(
  $$ select h.name, h.household_type::text from public.households h order by h.name $$,
  $$ values ('Casa Bianchi', 'family_with_children'), ('Casa D''Angelo Rossi', 'family_with_children') $$,
  'CA-11: only the admin rename happened'
);
select is(
  (select count(*)::integer from public.households),
  2,
  'no household created or deleted'
);

select * from finish();
rollback;
