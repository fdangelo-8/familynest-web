-- create_household() and current_household_id() (issue #9: CA-4, CA-5, CA-6, CA-7).
-- A = Marco (has a household), C = Chiara (no household).
begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

-- ---------------------------------------------------------------------------
-- CA-6: anonymous callers and sessions without user are refused.
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';

select throws_ok(
  $$ select public.create_household('Casa Anonima', 'single', 'Anonimo', 'salvia') $$,
  '42501',
  null,
  'CA-6: anon cannot call create_household'
);

set local role authenticated;
set local request.jwt.claims to '{"role":"authenticated"}';

select throws_ok(
  $$ select public.create_household('Casa Anonima', 'single', 'Anonimo', 'salvia') $$,
  '42501',
  'not authenticated',
  'CA-6: a session without user cannot create a household'
);

-- ---------------------------------------------------------------------------
-- C without household (CA-7, CA-4).
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}';

select is(public.current_household_id(), null, 'CA-7: C has no household');

select throws_ok(
  $$ select public.create_household('   ', 'single', 'Chiara', 'salvia') $$,
  '23514',
  null,
  'invalid household name refused'
);
select throws_ok(
  $$ select public.create_household('Casa Neri', 'single', '', 'salvia') $$,
  '23514',
  null,
  'invalid member name refused'
);
select is(public.current_household_id(), null, 'nothing created by the refused calls');

select lives_ok(
  $$ select set_config('test.household_id', public.create_household('Casa Neri', 'single', 'Chiara', 'salvia')::text, true) $$,
  'CA-4: C creates Casa Neri'
);
select is(
  public.current_household_id(),
  current_setting('test.household_id')::uuid,
  'CA-4: current_household_id() returns the new household'
);
select results_eq(
  $$ select h.name, h.household_type::text from public.households h $$,
  $$ values ('Casa Neri', 'single') $$,
  'CA-4: C sees only Casa Neri'
);
select results_eq(
  $$ select m.kind::text, m.name, m.color::text, m.user_id, m.is_admin, m.joined_at is not null
     from public.household_members m $$,
  $$ values ('adult', 'Chiara', 'salvia', 'cccccccc-0000-4000-8000-000000000001'::uuid, true, true) $$,
  'CA-4: one adult member, linked to C, admin, joined'
);
select throws_ok(
  $$ select public.create_household('Casa Neri 2', 'single', 'Chiara', 'salvia') $$,
  'P0001',
  'user already belongs to a household',
  'C cannot create a second household'
);

-- ---------------------------------------------------------------------------
-- CA-5: A already has a household.
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';

select is(
  public.current_household_id(),
  '11111111-1111-4111-8111-111111111111'::uuid,
  'current_household_id() of A is Casa D''Angelo'
);
select throws_ok(
  $$ select public.create_household('Casa Due', 'couple', 'Marco', 'glicine') $$,
  'P0001',
  'user already belongs to a household',
  'CA-5: A cannot create a second household'
);

reset role;

select is(
  (select count(*)::integer from public.households),
  3,
  'CA-4, CA-5, CA-6: only Casa Neri was added'
);
select is(
  (select count(*)::integer from public.households h where h.name = 'Casa Neri'),
  1,
  'CA-4: exactly one Casa Neri'
);
select is(
  (select count(*)::integer from public.household_members m where m.household_id = current_setting('test.household_id')::uuid),
  1,
  'CA-4: Casa Neri has exactly one member'
);

select * from finish();
rollback;
