-- Leaving the household (issue #9: CA-29 and CA-30, "esce" case).
-- B = Giulia (only admin of Casa Bianchi), B2 = Paolo, C = Chiara (no household).
begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

-- ---------------------------------------------------------------------------
-- CA-29: the only admin leaves, the adult who joined first becomes admin.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';

select results_eq(
  $$ delete from public.household_members where user_id = 'bbbbbbbb-0000-4000-8000-000000000001' returning name $$,
  $$ values ('Giulia') $$,
  'CA-29: B leaves Casa Bianchi'
);
select is(public.current_household_id(), null, 'B has no household any more');
select is_empty($$ select 1 from public.households $$, 'B reads nothing of Casa Bianchi any more');

reset role;

select ok(
  exists (select 1 from public.households h where h.id = '22222222-2222-4222-8222-222222222222'),
  'CA-29: Casa Bianchi still exists'
);
select results_eq(
  $$ select m.name from public.household_members m
     where m.household_id = '22222222-2222-4222-8222-222222222222' and m.is_admin $$,
  $$ values ('Paolo') $$,
  'CA-29: B2 (Paolo) is now the admin'
);
select is(
  (select i.invited_by_member_id from public.invitations i where i.member_id = 'b1000000-0000-4000-8000-000000000004'),
  null,
  'the invitation of Anna no longer points to Giulia'
);

-- ---------------------------------------------------------------------------
-- CA-30: the last adult with an account leaves, the household is deleted.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}';

select lives_ok(
  $$ select set_config('test.household_id', public.create_household('Casa Neri', 'single', 'Chiara', 'salvia')::text, true) $$,
  'C creates Casa Neri'
);
select lives_ok(
  $$ insert into public.household_members (household_id, kind, name, color, birth_date)
     values (public.current_household_id(), 'child', 'Pietro', 'cobalto', '2021-05-10'),
            (public.current_household_id(), 'pet', 'Fufi', 'zafferano', null),
            (public.current_household_id(), 'adult', 'Marta', 'glicine', null) $$,
  'C adds a child, a pet and an adult without account'
);
select lives_ok(
  $$ insert into public.invitations (household_id, member_id)
     select m.household_id, m.id from public.household_members m where m.name = 'Marta' $$,
  'C invites Marta'
);
select lives_ok(
  $$ delete from public.household_members where user_id = 'cccccccc-0000-4000-8000-000000000001' $$,
  'CA-30: C leaves Casa Neri'
);

reset role;

select is_empty(
  $$ select 1 from public.households h where h.id = current_setting('test.household_id')::uuid $$,
  'CA-30: Casa Neri no longer exists'
);
select is_empty(
  $$ select 1 from public.household_members m where m.household_id = current_setting('test.household_id')::uuid
     union all
     select 1 from public.invitations i where i.household_id = current_setting('test.household_id')::uuid $$,
  'CA-30: its members (child and pet included) and invitations are deleted'
);

select * from finish();
rollback;
