-- add_household_member() (issue #617, from the analysis of #618 C2): a member and, for a
-- pet, its species, in one transaction, in the household of the session.
-- Seed: A = Marco (Casa D'Angelo, organises), B = Giulia (Casa Bianchi, organises),
-- B2 = Paolo (Casa Bianchi, does not organise), C = Chiara (no household).
-- Casa Bianchi has 4 members (Giulia cobalto, Paolo salvia, Leo zafferano, Anna pomodoro).
-- Every check runs inside one transaction, so now() is the same everywhere.
begin;
create extension if not exists pgtap with schema extensions;

select plan(44);

do $$
begin
  perform set_config('test.b_members', (select count(*)::text from public.household_members m
                                        where m.household_id = '22222222-2222-4222-8222-222222222222'), true);
end;
$$;

-- ---------------------------------------------------------------------------
-- The function and its privileges.
-- ---------------------------------------------------------------------------
select has_function(
  'public', 'add_household_member', array['text', 'member_kind', 'member_color', 'date', 'pet_species'],
  'add_household_member(text, member_kind, member_color, date, pet_species) exists'
);
select is(
  pg_get_function_result('public.add_household_member(text, public.member_kind, public.member_color, date, public.pet_species)'::regprocedure),
  'uuid',
  'it returns only the id of the new member'
);
select ok(
  (select p.prosecdef and p.proconfig @> array['search_path=""']
   from pg_proc p where p.oid = 'public.add_household_member(text, public.member_kind, public.member_color, date, public.pet_species)'::regprocedure),
  'add_household_member is security definer with an empty search_path'
);
select ok(
  has_function_privilege('authenticated', 'public.add_household_member(text, public.member_kind, public.member_color, date, public.pet_species)', 'execute')
    and not has_function_privilege('anon', 'public.add_household_member(text, public.member_kind, public.member_color, date, public.pet_species)', 'execute')
    and not has_function_privilege('service_role', 'public.add_household_member(text, public.member_kind, public.member_color, date, public.pet_species)', 'execute')
    and not has_function_privilege('public', 'public.add_household_member(text, public.member_kind, public.member_color, date, public.pet_species)', 'execute'),
  'only authenticated can execute add_household_member'
);

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok(
  $$ select public.add_household_member('Miele', 'pet', 'peonia') $$,
  '42501', null, 'anon cannot add a member'
);

-- ---------------------------------------------------------------------------
-- Only POST.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
set local request.method to 'GET';
select throws_ok($$ select public.add_household_member('Miele', 'pet', 'peonia') $$, 'P0001', 'use POST', 'GET is refused');
set local request.method to 'PUT';
select throws_ok($$ select public.add_household_member('Miele', 'pet', 'peonia') $$, 'P0001', 'use POST', 'PUT is refused');
set local request.method to 'POST';

-- ---------------------------------------------------------------------------
-- Invalid arguments: nothing written.
-- ---------------------------------------------------------------------------
select throws_ok($$ select public.add_household_member(null, 'pet', 'peonia') $$, '22023', null, 'a null name is refused');
select throws_ok($$ select public.add_household_member('   ', 'pet', 'peonia') $$, '22023', null, 'a name of spaces is refused');
select throws_ok($$ select public.add_household_member(repeat('a', 41), 'pet', 'peonia') $$, '22023', null, 'a name of 41 characters is refused');
select throws_ok($$ select public.add_household_member('Miele', null, 'peonia') $$, '22023', null, 'a null kind is refused');
select throws_ok($$ select public.add_household_member('Miele', 'pet', null) $$, '22023', null, 'a null colour is refused');
select throws_ok(
  $$ select public.add_household_member('Sofia', 'child', 'peonia', null, 'cat') $$,
  '22023', null, 'a species for a child is refused'
);
select throws_ok(
  $$ select public.add_household_member('Sofia', 'child', 'peonia', ((now() at time zone 'Europe/Rome')::date + 1)) $$,
  '23514', null, 'a birth date in the future is refused'
);
select throws_ok(
  $$ select public.add_household_member('Miele', 'pet', 'salvia', null, 'cat') $$,
  '23505', null, 'a colour already taken is refused'
);
select throws_ok(
  $$ select public.add_household_member('Nonna', 'adult', 'peonia') $$,
  '42501', 'permission denied for function add_household_member', 'Paolo (does not organise) cannot add an adult'
);
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select public.add_household_member('Nonna', 'adult', 'peonia', (now() at time zone 'Europe/Rome')::date - 20000) $$,
  '22023', null, 'a birth date for an adult is refused'
);
select throws_ok(
  $$ select public.add_household_member('Nonna', 'adult', 'peonia', null, 'dog') $$,
  '22023', null, 'a species for an adult is refused'
);
set local request.jwt.claims to '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select public.add_household_member('Miele', 'pet', 'peonia') $$,
  '42501', 'permission denied for function add_household_member', 'Chiara (no household) cannot add a member'
);
set local request.jwt.claims to '{"role":"authenticated"}';
select throws_ok(
  $$ select public.add_household_member('Miele', 'pet', 'peonia') $$,
  '42501', 'permission denied for function add_household_member', 'without a user in the session: refused'
);

reset role;
select is(
  (select count(*)::text from public.household_members m where m.household_id = '22222222-2222-4222-8222-222222222222'),
  current_setting('test.b_members'),
  'no member was written in Casa Bianchi'
);
select is_empty(
  $$ select 1 from public.pet_profiles p where p.household_id = '22222222-2222-4222-8222-222222222222' $$,
  'no pet profile was written in Casa Bianchi'
);

-- ---------------------------------------------------------------------------
-- A pet with its species, added by an adult who does not organise.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok(
  $$ select set_config('test.miele', public.add_household_member(E'  Miele \t Dolce  ', 'pet', 'peonia', null, 'cat')::text, true) $$,
  'Paolo adds the cat Miele'
);
reset role;
select results_eq(
  $$ select m.household_id, m.kind::text, m.name, m.color::text, m.birth_date, m.user_id, m.is_admin
     from public.household_members m where m.id = current_setting('test.miele')::uuid $$,
  $$ values ('22222222-2222-4222-8222-222222222222'::uuid, 'pet', 'Miele Dolce', 'peonia', null::date, null::uuid, false) $$,
  'the returned id is a new pet of Casa Bianchi, with the spaces of the name reduced'
);
select results_eq(
  $$ select p.household_id, p.species::text, p.date_kind is null, p.food is null, p.vet_name is null, p.note is null
     from public.pet_profiles p where p.member_id = current_setting('test.miele')::uuid $$,
  $$ values ('22222222-2222-4222-8222-222222222222'::uuid, 'cat', true, true, true, true) $$,
  'its profile holds only the species'
);

-- A pet without species: no profile row («Non indicata»).
set local role authenticated;
select lives_ok(
  $$ select set_config('test.fiocco', public.add_household_member('Fiocco', 'pet', 'basilico')::text, true) $$,
  'Paolo adds a pet without species'
);
-- A child with the birth date.
select lives_ok(
  $$ select set_config('test.sofia', public.add_household_member('Sofia', 'child', 'lampone', '2017-05-14')::text, true) $$,
  'Paolo adds a child with the birth date'
);
reset role;
select is_empty(
  $$ select 1 from public.pet_profiles p where p.member_id = current_setting('test.fiocco')::uuid $$,
  'a pet without species has no profile row'
);
select results_eq(
  $$ select m.kind::text, m.name, m.birth_date from public.household_members m where m.id = current_setting('test.sofia')::uuid $$,
  $$ values ('child', 'Sofia', '2017-05-14'::date) $$,
  'the child has her birth date'
);
select is_empty(
  $$ select 1 from public.pet_profiles p where p.member_id = current_setting('test.sofia')::uuid $$,
  'a child has no pet profile'
);

-- An adult, added by who organises: without account, without role, without invitation.
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok(
  $$ select set_config('test.nonna', public.add_household_member('Nonna', 'adult', 'ceruleo')::text, true) $$,
  'Giulia adds an adult'
);
reset role;
select results_eq(
  $$ select m.kind::text, m.user_id, m.is_admin, (select count(*)::integer from public.invitations i where i.member_id = m.id)
     from public.household_members m where m.id = current_setting('test.nonna')::uuid $$,
  $$ values ('adult', null::uuid, false, 0) $$,
  'the adult has no account, no role and no invitation'
);

-- ---------------------------------------------------------------------------
-- Isolation: Marco sees nothing of what Casa Bianchi added.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select is_empty(
  $$ select 1 from public.household_members m where m.id = current_setting('test.miele')::uuid $$,
  'Marco does not see Miele'
);
select is_empty(
  $$ select 1 from public.pet_profiles p where p.member_id = current_setting('test.miele')::uuid $$,
  'Marco does not see the profile of Miele'
);
select lives_ok(
  $$ select set_config('test.marco_pet', public.add_household_member('Pippo', 'pet', 'peonia', null, 'dog')::text, true) $$,
  'Marco adds a pet in his own household (the colour of Miele is free there)'
);
reset role;
select results_eq(
  $$ select m.household_id, p.household_id, p.species::text
     from public.household_members m join public.pet_profiles p on p.member_id = m.id
     where m.id = current_setting('test.marco_pet')::uuid $$,
  $$ values ('11111111-1111-4111-8111-111111111111'::uuid, '11111111-1111-4111-8111-111111111111'::uuid, 'dog') $$,
  'the household is always the caller''s, for the member and for the profile'
);
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select is_empty(
  $$ select 1 from public.pet_profiles p where p.household_id = '11111111-1111-4111-8111-111111111111' $$,
  'Paolo does not see the pet profiles of Casa D''Angelo'
);

-- ---------------------------------------------------------------------------
-- One transaction: an error on the profile leaves no member.
-- ---------------------------------------------------------------------------
reset role;
create function pg_temp.test_fail_pet_profile() returns trigger language plpgsql as $$
begin
  raise exception 'forced failure' using errcode = 'P0002';
end;
$$;
create trigger zz_test_fail_pet_profile before insert on public.pet_profiles
  for each row execute function pg_temp.test_fail_pet_profile();
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok(
  $$ select public.add_household_member('Fallito', 'pet', 'glicine', null, 'dog') $$,
  'P0002', 'forced failure', 'the forced error on the profile reaches the caller'
);
reset role;
select is_empty(
  $$ select 1 from public.household_members m where m.name = 'Fallito' $$,
  'the member does not exist'
);
drop trigger zz_test_fail_pet_profile on public.pet_profiles;

-- ---------------------------------------------------------------------------
-- The limit of 10 members. Casa Bianchi has 8 now.
-- ---------------------------------------------------------------------------
set local role authenticated;
select lives_ok(
  $$ select public.add_household_member('Nove', 'child', 'glicine') $$,
  'the ninth member'
);
select lives_ok(
  $$ select public.add_household_member('Dieci', 'pet', 'cannella', null, 'other') $$,
  'the tenth member'
);
select throws_ok(
  $$ select public.add_household_member('Undici', 'pet', 'cannella', null, 'dog') $$,
  'P0001', 'household member limit reached', 'the eleventh member is refused'
);
reset role;
select is(
  (select count(*)::integer from public.household_members m where m.household_id = '22222222-2222-4222-8222-222222222222'),
  10,
  'Casa Bianchi has 10 members'
);
select is(
  (select count(*)::integer from public.pet_profiles p where p.household_id = '22222222-2222-4222-8222-222222222222'),
  2,
  'only the profiles of Miele and Dieci exist in Casa Bianchi'
);

select * from finish();
rollback;
