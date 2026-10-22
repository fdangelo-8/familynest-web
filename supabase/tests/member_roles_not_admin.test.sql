-- Permissions of an adult who is not administrator (issue #9: CA-14, CA-15).
-- B2 = Paolo, adult of Casa Bianchi, not admin. Giulia (B) is the only admin.
begin;
create extension if not exists pgtap with schema extensions;

select plan(19);

set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';

-- CA-14: B2 cannot add an adult, but adds a child.
select throws_ok(
  $$ insert into public.household_members (household_id, kind, name, color)
     values ('22222222-2222-4222-8222-222222222222', 'adult', 'Sara', 'glicine') $$,
  '42501',
  null,
  'CA-14: B2 (not admin) cannot add an adult'
);
select lives_ok(
  $$ insert into public.household_members (household_id, kind, name, color)
     values ('22222222-2222-4222-8222-222222222222', 'child', 'Mia', 'glicine') $$,
  'CA-14: B2 adds the child Mia'
);
select lives_ok(
  $$ update public.household_members set name = 'Leonardo', birth_date = '2019-09-06'
     where id = 'b1000000-0000-4000-8000-000000000003' $$,
  'B2 changes name and birth date of a child'
);

-- CA-15: roles.
select throws_ok(
  $$ update public.household_members set is_admin = true
     where id = 'b1000000-0000-4000-8000-000000000002' $$,
  '42501',
  null,
  'CA-15: B2 cannot make themselves admin'
);
select throws_ok(
  $$ update public.household_members set is_admin = true
     where id = 'b1000000-0000-4000-8000-000000000003' $$,
  '42501',
  null,
  'CA-15: B2 cannot give the admin role to a child'
);
select is_empty(
  $$ update public.household_members set is_admin = false
     where id = 'b1000000-0000-4000-8000-000000000001' returning id $$,
  'CA-15: B2 cannot remove the admin role from Giulia (0 rows)'
);
select is_empty(
  $$ update public.household_members set is_admin = true
     where id = 'b1000000-0000-4000-8000-000000000004' returning id $$,
  'CA-15: B2 cannot give the admin role to Anna (0 rows)'
);

-- CA-15: other adults and removals.
select is_empty(
  $$ update public.household_members set name = 'Giulietta'
     where id = 'b1000000-0000-4000-8000-000000000001' returning id $$,
  'CA-15: B2 cannot rename Giulia (0 rows)'
);
select is_empty(
  $$ delete from public.household_members where id = 'b1000000-0000-4000-8000-000000000003' returning id $$,
  'CA-15: B2 cannot remove a child (0 rows)'
);
select is_empty(
  $$ delete from public.household_members where id = 'b1000000-0000-4000-8000-000000000001' returning id $$,
  'CA-15: B2 cannot remove Giulia (0 rows)'
);

-- CA-15: invitations are for admins only.
select is_empty(
  $$ select 1 from public.invitations $$,
  'CA-15: B2 reads 0 invitations of Casa Bianchi'
);
select throws_ok(
  $$ insert into public.invitations (household_id, member_id)
     values ('22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000004') $$,
  '42501',
  null,
  'CA-15: B2 cannot create an invitation'
);
select is_empty(
  $$ update public.invitations set status = 'revoked' returning id $$,
  'CA-15: B2 cannot revoke an invitation (0 rows)'
);

-- ---------------------------------------------------------------------------
-- Data unchanged except the allowed child changes.
-- ---------------------------------------------------------------------------
reset role;

select results_eq(
  $$ select m.name, m.is_admin from public.household_members m
     where m.household_id = '22222222-2222-4222-8222-222222222222' order by m.created_at $$,
  $$ values ('Giulia', true), ('Paolo', false), ('Leonardo', false), ('Anna', false), ('Mia', false) $$,
  'CA-15: names and roles of Casa Bianchi unchanged (only the child changes)'
);
select is(
  (select m.kind::text from public.household_members m where m.name = 'Mia'),
  'child',
  'CA-14: Mia is a child of Casa Bianchi'
);
select is(
  (select m.birth_date from public.household_members m where m.id = 'b1000000-0000-4000-8000-000000000003'),
  '2019-09-06'::date,
  'the child birth date was changed'
);
select is(
  (select i.status::text from public.invitations i where i.member_id = 'b1000000-0000-4000-8000-000000000004'),
  'pending',
  'CA-15: the invitation of Anna is unchanged'
);
select is(
  (select count(*)::integer from public.invitations i where i.household_id = '22222222-2222-4222-8222-222222222222'),
  1,
  'CA-15: no invitation created in Casa Bianchi'
);
select is(
  (select count(*)::integer from public.household_members m where m.is_admin and m.household_id = '22222222-2222-4222-8222-222222222222'),
  1,
  'CA-15: Casa Bianchi still has exactly one admin'
);

select * from finish();
rollback;
