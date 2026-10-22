-- Administrator succession with several candidates (issue #49 CA-2; issue #9 punto 5
-- regola 2, decisione 6). The new admin is the adult with account who joined first
-- (oldest joined_at), not the one added first (created_at) nor the one who joined last.
--
-- Casa D'Angelo is prepared as database owner (accounts linked directly):
--   Marco    admin, joined 30 days ago
--   Laura    added 2nd, account C, joined 1 day ago
--   Gino     added after Laura, account D, joined 5 days ago
--   Rita     added after case 1 (last), account E, joined 10 days ago
-- Case 1 (Marco leaves): candidates Laura (-1d) and Gino (-5d) -> Gino.
-- Case 2 (account of Gino deleted): candidates Laura (-1d) and Rita (-10d) -> Rita.
begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'dddddddd-0000-4000-8000-000000000001', 'authenticated',
   'authenticated', 'utente-d@example.com', '{"full_name":"Gino Test"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'eeeeeeee-0000-4000-8000-000000000001', 'authenticated',
   'authenticated', 'utente-e@example.com', '{"full_name":"Rita Test"}', now(), now());

-- Free two colours (Tommaso and Biscotto) for the two new adults.
delete from public.household_members
where id in ('a1000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000005');

insert into public.household_members (id, household_id, kind, name, color, user_id, joined_at, created_at)
values
  ('a1000000-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111', 'adult', 'Gino', 'cobalto',
   'dddddddd-0000-4000-8000-000000000001', now() - interval '5 days', now() - interval '2 hours');

update public.household_members
set user_id = 'cccccccc-0000-4000-8000-000000000001', joined_at = now() - interval '1 day'
where id = 'a1000000-0000-4000-8000-000000000002';

select results_eq(
  $$ select m.name, m.is_admin from public.household_members m
     where m.household_id = '11111111-1111-4111-8111-111111111111' and m.user_id is not null
     order by m.created_at $$,
  $$ values ('Marco', true), ('Laura', false), ('Gino', false) $$,
  'setup: Marco admin, Laura and Gino adults with account'
);

-- ---------------------------------------------------------------------------
-- Case 1: the only admin leaves voluntarily.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';

select results_eq(
  $$ delete from public.household_members where user_id = 'aaaaaaaa-0000-4000-8000-000000000001' returning name $$,
  $$ values ('Marco') $$,
  'Marco (only admin) leaves Casa D''Angelo'
);

reset role;

select results_eq(
  $$ select m.name from public.household_members m
     where m.household_id = '11111111-1111-4111-8111-111111111111' and m.is_admin $$,
  $$ values ('Gino') $$,
  'case 1: Gino (joined 5 days ago) becomes the only admin, not Laura (added first, joined 1 day ago)'
);
select ok(
  exists (select 1 from public.households h where h.id = '11111111-1111-4111-8111-111111111111'),
  'case 1: Casa D''Angelo still exists'
);

-- ---------------------------------------------------------------------------
-- Case 2: the account of the only admin is deleted.
-- ---------------------------------------------------------------------------
insert into public.household_members (id, household_id, kind, name, color, user_id, joined_at, created_at)
values
  ('a1000000-0000-4000-8000-000000000007', '11111111-1111-4111-8111-111111111111', 'adult', 'Rita', 'zafferano',
   'eeeeeeee-0000-4000-8000-000000000001', now() - interval '10 days', now() - interval '1 hour');

select results_eq(
  $$ select m.name, m.is_admin from public.household_members m
     where m.household_id = '11111111-1111-4111-8111-111111111111' and m.user_id is not null
     order by m.created_at $$,
  $$ values ('Laura', false), ('Gino', true), ('Rita', false) $$,
  'setup: Gino admin, Laura and Rita adults with account'
);

delete from auth.users where id = 'dddddddd-0000-4000-8000-000000000001';

select results_eq(
  $$ select m.name from public.household_members m
     where m.household_id = '11111111-1111-4111-8111-111111111111' and m.is_admin $$,
  $$ values ('Rita') $$,
  'case 2: Rita (joined 10 days ago, added last) becomes the only admin, not Laura (joined 1 day ago)'
);
select is_empty(
  $$ select 1 from public.household_members m where m.user_id = 'dddddddd-0000-4000-8000-000000000001' $$,
  'case 2: the member row of Gino is deleted with the account'
);
select ok(
  exists (select 1 from public.households h where h.id = '11111111-1111-4111-8111-111111111111'),
  'case 2: Casa D''Angelo still exists'
);

select * from finish();
rollback;
