-- Permissions of an administrator (issue #9: CA-17, CA-18, CA-28).
-- B = Giulia, only admin of Casa Bianchi. B2 = Paolo. Anna: adult without account.
begin;
create extension if not exists pgtap with schema extensions;

select plan(17);

set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';

-- CA-28: the only admin cannot drop the role.
select throws_ok(
  $$ update public.household_members set is_admin = false
     where id = 'b1000000-0000-4000-8000-000000000001' $$,
  'P0001',
  'a household needs at least one administrator',
  'CA-28: the only admin cannot remove their own admin role'
);
select is(
  (select m.is_admin from public.household_members m where m.id = 'b1000000-0000-4000-8000-000000000001'),
  true,
  'CA-28: B is still admin'
);

-- CA-18: the admin role needs an adult with an account.
select throws_ok(
  $$ update public.household_members set is_admin = true
     where id = 'b1000000-0000-4000-8000-000000000004' $$,
  '23514',
  null,
  'CA-18: Anna (no account) cannot become admin'
);
select throws_ok(
  $$ update public.household_members set is_admin = true
     where id = 'b1000000-0000-4000-8000-000000000003' $$,
  '23514',
  null,
  'CA-18: Leo (child) cannot become admin'
);

-- CA-17: every admin operation succeeds.
select lives_ok(
  $$ insert into public.household_members (household_id, kind, name, color)
     values ('22222222-2222-4222-8222-222222222222', 'adult', 'Sara', 'glicine') $$,
  'CA-17: B adds the adult Sara'
);
select lives_ok(
  $$ update public.household_members set is_admin = true
     where id = 'b1000000-0000-4000-8000-000000000002' $$,
  'CA-17: B makes Paolo admin'
);
select results_eq(
  $$ delete from public.household_members where id = 'b1000000-0000-4000-8000-000000000003' returning name $$,
  $$ values ('Leo') $$,
  'CA-17: B removes the child Leo'
);
select throws_ok(
  $$ insert into public.invitations (household_id, member_id)
     values ('22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000004') $$,
  '23505',
  null,
  'a second pending invitation for Anna is refused while the expired one is pending'
);
select results_eq(
  $$ update public.invitations set status = 'revoked'
     where member_id = 'b1000000-0000-4000-8000-000000000004' and status = 'pending' returning short_code $$,
  $$ values ('7305') $$,
  'CA-17: B revokes the expired invitation of Anna'
);
select lives_ok(
  $$ insert into public.invitations (household_id, member_id, message)
     values ('22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000004', 'Ti aspettiamo!') $$,
  'CA-17: B creates a new invitation for Anna'
);
select throws_ok(
  $$ update public.invitations set status = 'pending'
     where member_id = 'b1000000-0000-4000-8000-000000000004' and status = 'revoked' $$,
  '42501',
  null,
  'a revoked invitation cannot be reopened'
);
select throws_ok(
  $$ update public.invitations set status = 'accepted', accepted_at = now()
     where member_id = 'b1000000-0000-4000-8000-000000000004' and status = 'pending' $$,
  '42501',
  null,
  'an admin cannot mark an invitation as accepted'
);

-- With a second admin, B can drop the role.
select lives_ok(
  $$ update public.household_members set is_admin = false
     where id = 'b1000000-0000-4000-8000-000000000001' $$,
  'with Paolo admin, B can drop the admin role'
);

reset role;

select results_eq(
  $$ select m.name, m.kind::text, m.is_admin from public.household_members m
     where m.household_id = '22222222-2222-4222-8222-222222222222' order by m.created_at $$,
  $$ values ('Giulia', 'adult', false), ('Paolo', 'adult', true), ('Anna', 'adult', false), ('Sara', 'adult', false) $$,
  'CA-17: members and roles of Casa Bianchi after the admin operations'
);
select results_eq(
  $$ select i.status::text, i.message from public.invitations i
     where i.member_id = 'b1000000-0000-4000-8000-000000000004' order by i.created_at $$,
  $$ values ('revoked', null::text), ('pending', 'Ti aspettiamo!') $$,
  'CA-17: Anna has the revoked invitation and a new pending one'
);
select is(
  (select i.invited_by_member_id from public.invitations i
   where i.member_id = 'b1000000-0000-4000-8000-000000000004' and i.status = 'pending'),
  'b1000000-0000-4000-8000-000000000001'::uuid,
  'the new invitation records Giulia as inviter'
);
select is(
  (select count(*)::integer from public.household_members m where m.household_id = '11111111-1111-4111-8111-111111111111'),
  5,
  'Casa D''Angelo untouched'
);

select * from finish();
rollback;
