-- Account deletion (issue #9: CA-29 and CA-30, "elimina l'account" case, CA-31).
-- A = Marco (only adult with account of Casa D'Angelo), B = Giulia (only admin of
-- Casa Bianchi), C = Chiara (no household).
begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

-- ---------------------------------------------------------------------------
-- CA-29: the account of the only admin is deleted.
-- ---------------------------------------------------------------------------
delete from auth.users where id = 'bbbbbbbb-0000-4000-8000-000000000001';

select ok(
  exists (select 1 from public.households h where h.id = '22222222-2222-4222-8222-222222222222'),
  'CA-29: Casa Bianchi still exists'
);
select results_eq(
  $$ select m.name, m.is_admin from public.household_members m
     where m.household_id = '22222222-2222-4222-8222-222222222222' order by m.created_at $$,
  $$ values ('Paolo', true), ('Leo', false), ('Anna', false) $$,
  'CA-29: Giulia is gone and B2 (Paolo) is the admin'
);
select is_empty(
  $$ select 1 from public.profiles p where p.id = 'bbbbbbbb-0000-4000-8000-000000000001' $$,
  'the profile of B is deleted'
);

-- ---------------------------------------------------------------------------
-- CA-30: the account of the only adult with account of a household is deleted.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}';

select lives_ok(
  $$ select set_config('test.household_id', public.create_household('Casa Neri', 'single', 'Chiara', 'salvia')::text, true) $$,
  'C creates Casa Neri'
);
select lives_ok(
  $$ insert into public.household_members (household_id, kind, name, color)
     values (public.current_household_id(), 'child', 'Pietro', 'cobalto'),
            (public.current_household_id(), 'adult', 'Marta', 'glicine') $$,
  'C adds a child and an adult without account'
);
select lives_ok(
  $$ insert into public.invitations (household_id, member_id)
     select m.household_id, m.id from public.household_members m where m.name = 'Marta' $$,
  'C invites Marta'
);

reset role;

delete from auth.users where id = 'cccccccc-0000-4000-8000-000000000001';

select is_empty(
  $$ select 1 from public.households h where h.id = current_setting('test.household_id')::uuid
     union all
     select 1 from public.household_members m where m.household_id = current_setting('test.household_id')::uuid
     union all
     select 1 from public.invitations i where i.household_id = current_setting('test.household_id')::uuid $$,
  'CA-30: Casa Neri, its members and its invitations are deleted with the account of C'
);

-- ---------------------------------------------------------------------------
-- CA-31: the account of A is deleted.
-- ---------------------------------------------------------------------------
delete from auth.users where id = 'aaaaaaaa-0000-4000-8000-000000000001';

select is_empty(
  $$ select 1 from public.profiles p where p.id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  'CA-31: the profile of A is deleted'
);
select is_empty(
  $$ select 1 from public.household_members m where m.user_id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  'CA-31: the member row linked to A is deleted'
);
select is_empty(
  $$ select 1 from public.household_members m
     where m.id = 'a1000000-0000-4000-8000-000000000002' and m.is_admin $$,
  'CA-31: Laura (no account) did not become admin'
);
select is_empty(
  $$ select 1 from public.households h where h.id = '11111111-1111-4111-8111-111111111111'
     union all
     select 1 from public.household_members m where m.household_id = '11111111-1111-4111-8111-111111111111'
     union all
     select 1 from public.invitations i where i.household_id = '11111111-1111-4111-8111-111111111111' $$,
  'CA-31: without adults with account, Casa D''Angelo is deleted with all its data'
);
select is(
  (select count(*)::integer from public.households),
  1,
  'only Casa Bianchi remains'
);

select * from finish();
rollback;
