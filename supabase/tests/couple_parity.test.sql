-- Parity in a couple (issue #617, R5 and R6: CA-26…CA-32, CA-34). «In coppia» = exactly two
-- members, both adults with an account (private.household_is_couple).
-- Seed: A = Marco (Casa D'Angelo, organises, with children; Laura is invited).
-- Created here, as database owner, before any session (users 61700000-…):
--   H1 «Coppia»       D organises, Ivo is invited (nothing else): E enters with his link;
--   H2 «Con figlio»   F organises, a child, Pia is invited: G enters;
--   H3 «Con animale»  H organises, a pet, Rino is invited: I enters;
--   H4 «Due inviti»   J organises, Sara and Tea are invited: K enters as Sara;
--   H5 «Vecchia»      M organises, N does not: a couple that existed before #617;
--   H6 «Non coppia»   O organises, P does not, a child: not a couple;
--   user L: gets the account of Laura (Casa D'Angelo) for CA-32.
-- Every check runs inside one transaction, so now() is the same everywhere.
begin;
create extension if not exists pgtap with schema extensions;

select plan(42);

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', ('61700000-0000-4000-8000-0000000000' || u.n)::uuid,
       'authenticated', 'authenticated', 'utente-617-' || u.n || '@example.com', '{}'::jsonb, now(), now()
from (values ('0d'), ('0e'), ('0f'), ('10'), ('11'), ('12'), ('13'), ('14'), ('15'), ('16'), ('17'), ('18'), ('19'))
  as u (n);

insert into public.households (id, name, household_type)
select ('61710000-0000-4000-8000-00000000000' || h.n)::uuid, h.name, 'family_with_children'
from (values ('1', 'Coppia'), ('2', 'Con figlio'), ('3', 'Con animale'), ('4', 'Due inviti'),
             ('5', 'Vecchia'), ('6', 'Non coppia')) as h (n, name);

insert into public.household_members (id, household_id, kind, name, color, user_id, is_admin, joined_at, created_at)
values
  -- H1: D organises, Ivo is invited.
  ('61720000-0000-4000-8000-000000000101', '61710000-0000-4000-8000-000000000001', 'adult', 'Dora', 'pomodoro',
   '61700000-0000-4000-8000-00000000000d', true, now() - interval '9 days', now() - interval '9 days'),
  ('61720000-0000-4000-8000-000000000102', '61710000-0000-4000-8000-000000000001', 'adult', 'Ivo', 'glicine',
   null, false, null, now() - interval '8 days'),
  -- H2: F organises, a child, Pia is invited.
  ('61720000-0000-4000-8000-000000000201', '61710000-0000-4000-8000-000000000002', 'adult', 'Fede', 'pomodoro',
   '61700000-0000-4000-8000-00000000000f', true, now() - interval '9 days', now() - interval '9 days'),
  ('61720000-0000-4000-8000-000000000202', '61710000-0000-4000-8000-000000000002', 'child', 'Bimba', 'salvia',
   null, false, null, now() - interval '8 days'),
  ('61720000-0000-4000-8000-000000000203', '61710000-0000-4000-8000-000000000002', 'adult', 'Pia', 'glicine',
   null, false, null, now() - interval '7 days'),
  -- H3: H organises, a pet, Rino is invited.
  ('61720000-0000-4000-8000-000000000301', '61710000-0000-4000-8000-000000000003', 'adult', 'Ugo', 'pomodoro',
   '61700000-0000-4000-8000-000000000011', true, now() - interval '9 days', now() - interval '9 days'),
  ('61720000-0000-4000-8000-000000000302', '61710000-0000-4000-8000-000000000003', 'pet', 'Fido', 'salvia',
   null, false, null, now() - interval '8 days'),
  ('61720000-0000-4000-8000-000000000303', '61710000-0000-4000-8000-000000000003', 'adult', 'Rino', 'glicine',
   null, false, null, now() - interval '7 days'),
  -- H4: J organises, Sara and Tea are invited.
  ('61720000-0000-4000-8000-000000000401', '61710000-0000-4000-8000-000000000004', 'adult', 'Gio', 'pomodoro',
   '61700000-0000-4000-8000-000000000013', true, now() - interval '9 days', now() - interval '9 days'),
  ('61720000-0000-4000-8000-000000000402', '61710000-0000-4000-8000-000000000004', 'adult', 'Sara', 'glicine',
   null, false, null, now() - interval '8 days'),
  ('61720000-0000-4000-8000-000000000403', '61710000-0000-4000-8000-000000000004', 'adult', 'Tea', 'salvia',
   null, false, null, now() - interval '7 days'),
  -- H5: M organises, N does not (a couple of before #617).
  ('61720000-0000-4000-8000-000000000501', '61710000-0000-4000-8000-000000000005', 'adult', 'Mara', 'pomodoro',
   '61700000-0000-4000-8000-000000000015', true, now() - interval '9 days', now() - interval '9 days'),
  ('61720000-0000-4000-8000-000000000502', '61710000-0000-4000-8000-000000000005', 'adult', 'Nico', 'glicine',
   '61700000-0000-4000-8000-000000000016', false, now() - interval '8 days', now() - interval '8 days'),
  -- H6: O organises, P does not, a child.
  ('61720000-0000-4000-8000-000000000601', '61710000-0000-4000-8000-000000000006', 'adult', 'Olga', 'pomodoro',
   '61700000-0000-4000-8000-000000000017', true, now() - interval '9 days', now() - interval '9 days'),
  ('61720000-0000-4000-8000-000000000602', '61710000-0000-4000-8000-000000000006', 'adult', 'Pino', 'glicine',
   '61700000-0000-4000-8000-000000000018', false, now() - interval '8 days', now() - interval '8 days'),
  ('61720000-0000-4000-8000-000000000603', '61710000-0000-4000-8000-000000000006', 'child', 'Bimbo', 'salvia',
   null, false, null, now() - interval '7 days');

insert into public.invitations (household_id, member_id, invited_by_member_id, token)
values
  ('61710000-0000-4000-8000-000000000001', '61720000-0000-4000-8000-000000000102',
   '61720000-0000-4000-8000-000000000101', md5('617-ivo') || md5('617-ivo-2')),
  ('61710000-0000-4000-8000-000000000002', '61720000-0000-4000-8000-000000000203',
   '61720000-0000-4000-8000-000000000201', md5('617-pia') || md5('617-pia-2')),
  ('61710000-0000-4000-8000-000000000003', '61720000-0000-4000-8000-000000000303',
   '61720000-0000-4000-8000-000000000301', md5('617-rino') || md5('617-rino-2')),
  ('61710000-0000-4000-8000-000000000004', '61720000-0000-4000-8000-000000000402',
   '61720000-0000-4000-8000-000000000401', md5('617-sara') || md5('617-sara-2')),
  ('61710000-0000-4000-8000-000000000004', '61720000-0000-4000-8000-000000000403',
   '61720000-0000-4000-8000-000000000401', md5('617-tea') || md5('617-tea-2'));

-- ---------------------------------------------------------------------------
-- The rule «in coppia» and its privileges (CA-34).
-- ---------------------------------------------------------------------------
select results_eq(
  $$ select h.name, private.household_is_couple(h.id)
     from public.households h where h.id::text like '61710000-%' order by h.id $$,
  $$ values ('Coppia', false), ('Con figlio', false), ('Con animale', false), ('Due inviti', false),
            ('Vecchia', true), ('Non coppia', false) $$,
  'household_is_couple: only two adults with an account and nobody else (an invitee is somebody else)'
);
select ok(
  (select not p.prosecdef and p.proconfig @> array['search_path=""']
   from pg_proc p where p.oid = 'private.household_is_couple(uuid)'::regprocedure),
  'household_is_couple is security invoker with an empty search_path'
);
select ok(
  not has_function_privilege('anon', 'private.household_is_couple(uuid)', 'execute')
    and not has_function_privilege('public', 'private.household_is_couple(uuid)', 'execute'),
  'CA-34: anon cannot execute household_is_couple'
);
select ok(
  not has_function_privilege('anon', 'private.household_members_couple_guard()', 'execute')
    and not has_function_privilege('authenticated', 'private.household_members_couple_guard()', 'execute')
    and not has_function_privilege('service_role', 'private.household_members_couple_guard()', 'execute')
    and not has_function_privilege('public', 'private.household_members_couple_guard()', 'execute'),
  'CA-34: no API role can execute the guard trigger function'
);

-- ---------------------------------------------------------------------------
-- CA-29: the data migration makes the couples of before equal, nothing else changes.
-- The statements are the ones recorded for the migration itself.
-- ---------------------------------------------------------------------------
select is(
  (select array_length(s.statements, 1) from supabase_migrations.schema_migrations s where s.version = '20261127151328'),
  1,
  'CA-29: the migration couples_become_equal has one statement'
);
do $$
declare
  v_statement text;
begin
  foreach v_statement in array (
    select s.statements from supabase_migrations.schema_migrations s where s.version = '20261127151328'
  ) loop
    execute v_statement;
  end loop;
end;
$$;
select results_eq(
  $$ select m.name, m.is_admin from public.household_members m
     where m.household_id in ('61710000-0000-4000-8000-000000000005', '61710000-0000-4000-8000-000000000006')
       and m.kind = 'adult'
     order by m.id $$,
  $$ values ('Mara', true), ('Nico', true), ('Olga', true), ('Pino', false) $$,
  'CA-29: in «Vecchia» both organise now; «Non coppia» does not change'
);
select results_eq(
  $$ select m.household_id, m.name, m.is_admin from public.household_members m
     where m.household_id in ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222')
       and m.kind = 'adult'
     order by m.id $$,
  $$ values ('11111111-1111-4111-8111-111111111111'::uuid, 'Marco', true),
            ('11111111-1111-4111-8111-111111111111'::uuid, 'Laura', false),
            ('22222222-2222-4222-8222-222222222222'::uuid, 'Giulia', true),
            ('22222222-2222-4222-8222-222222222222'::uuid, 'Paolo', false),
            ('22222222-2222-4222-8222-222222222222'::uuid, 'Anna', false) $$,
  'CA-29: the households of the seed (not couples) do not change'
);

-- ---------------------------------------------------------------------------
-- CA-26, CA-28: E enters «Coppia»: the household becomes a couple, E organises too.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"61700000-0000-4000-8000-00000000000e","role":"authenticated"}';
select results_eq(
  $$ select public.accept_invitation_with_color(md5('617-ivo') || md5('617-ivo-2'), 'cobalto') $$,
  $$ values ('61710000-0000-4000-8000-000000000001'::uuid) $$,
  'CA-26: E enters «Coppia» with the link of Ivo'
);
reset role;
select results_eq(
  $$ select m.name, m.user_id, m.is_admin, m.color::text from public.household_members m
     where m.household_id = '61710000-0000-4000-8000-000000000001' order by m.created_at $$,
  $$ values ('Dora', '61700000-0000-4000-8000-00000000000d'::uuid, true, 'pomodoro'),
            ('Ivo', '61700000-0000-4000-8000-00000000000e'::uuid, true, 'cobalto') $$,
  'CA-26: who enters organises too, and the one who invited still organises'
);
select results_eq(
  $$ select n.recipient_member_id, n.kind::text, n.actor_member_id from public.notifications n
     where n.household_id = '61710000-0000-4000-8000-000000000001' $$,
  $$ values ('61720000-0000-4000-8000-000000000101'::uuid, 'member_joined', '61720000-0000-4000-8000-000000000102'::uuid) $$,
  'CA-28: Dora still receives member_joined, with Ivo as actor'
);
select is(
  (select i.status::text from public.invitations i where i.member_id = '61720000-0000-4000-8000-000000000102'),
  'accepted',
  'CA-28: the invitation is accepted, as before'
);
set local role authenticated;
select throws_ok(
  $$ select public.accept_invitation_with_color(md5('617-pia') || md5('617-pia-2'), 'cobalto') $$,
  'P0001', 'user already belongs to a household', 'CA-28: the errors do not change'
);

-- The rule answers only for the caller's household: E does not learn that «Vecchia» is a couple.
select is(private.household_is_couple('61710000-0000-4000-8000-000000000001'), true, 'E: «Coppia» is a couple');
select is(
  private.household_is_couple('61710000-0000-4000-8000-000000000005'),
  false,
  'E: another household is never a couple for him (he reads none of its rows)'
);

-- ---------------------------------------------------------------------------
-- CA-27: a child, a pet or another invitee: who enters does not organise.
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"61700000-0000-4000-8000-000000000010","role":"authenticated"}';
select lives_ok(
  $$ select public.accept_invitation_with_color(md5('617-pia') || md5('617-pia-2'), 'glicine') $$,
  'CA-27: G enters «Con figlio»'
);
set local request.jwt.claims to '{"sub":"61700000-0000-4000-8000-000000000012","role":"authenticated"}';
select lives_ok(
  $$ select public.accept_invitation_with_color(md5('617-rino') || md5('617-rino-2'), 'glicine') $$,
  'CA-27: I enters «Con animale»'
);
set local request.jwt.claims to '{"sub":"61700000-0000-4000-8000-000000000014","role":"authenticated"}';
select lives_ok(
  $$ select public.accept_invitation_with_color(md5('617-sara') || md5('617-sara-2'), 'glicine') $$,
  'CA-27: K enters «Due inviti» as Sara'
);
reset role;
select results_eq(
  $$ select m.name, m.is_admin from public.household_members m
     where m.id in ('61720000-0000-4000-8000-000000000203', '61720000-0000-4000-8000-000000000303',
                    '61720000-0000-4000-8000-000000000402')
     order by m.id $$,
  $$ values ('Pia', false), ('Rino', false), ('Sara', false) $$,
  'CA-27: with a child, a pet or another invitee, who enters does not organise'
);

-- ---------------------------------------------------------------------------
-- CA-30: in a couple nobody removes the other nor takes a role away.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"61700000-0000-4000-8000-00000000000e","role":"authenticated"}';
select throws_ok(
  $$ delete from public.household_members m where m.id = '61720000-0000-4000-8000-000000000101' $$,
  '42501', null, 'CA-30: E cannot remove Dora'
);
select throws_ok(
  $$ update public.household_members m set is_admin = false where m.id = '61720000-0000-4000-8000-000000000101' $$,
  '42501', null, 'CA-30: E cannot take the role away from Dora'
);
select throws_ok(
  $$ update public.household_members m set is_admin = false where m.id = '61720000-0000-4000-8000-000000000102' $$,
  '42501', null, 'CA-30: E cannot give up his own role either (the two stay equal)'
);
set local request.jwt.claims to '{"sub":"61700000-0000-4000-8000-00000000000d","role":"authenticated"}';
select throws_ok(
  $$ delete from public.household_members m where m.id = '61720000-0000-4000-8000-000000000102' $$,
  '42501', null, 'CA-30: Dora cannot remove E'
);
select throws_ok(
  $$ update public.household_members m set is_admin = false where m.id = '61720000-0000-4000-8000-000000000102' $$,
  '42501', null, 'CA-30: Dora cannot take the role away from E'
);
select lives_ok(
  $$ update public.household_members m set name = 'Dora Bella' where m.id = '61720000-0000-4000-8000-000000000101' $$,
  'in a couple the other changes still work (her own name)'
);
set local request.jwt.claims to '{"sub":"61700000-0000-4000-8000-000000000015","role":"authenticated"}';
select throws_ok(
  $$ delete from public.household_members m where m.id = '61720000-0000-4000-8000-000000000502' $$,
  '42501', null, 'CA-30: in «Vecchia» (made equal by the migration) Mara cannot remove Nico'
);
reset role;
select results_eq(
  $$ select m.name, m.is_admin from public.household_members m
     where m.household_id in ('61710000-0000-4000-8000-000000000001', '61710000-0000-4000-8000-000000000005')
     order by m.id $$,
  $$ values ('Dora Bella', true), ('Ivo', true), ('Mara', true), ('Nico', true) $$,
  'CA-30: nothing changed in the couples'
);

-- Isolation: an adult of another household removes nothing and changes nothing.
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select is_empty(
  $$ delete from public.household_members m where m.id = '61720000-0000-4000-8000-000000000102' returning m.id $$,
  'Marco removes 0 rows of «Coppia»'
);
select is_empty(
  $$ update public.household_members m set is_admin = false where m.id = '61720000-0000-4000-8000-000000000102'
     returning m.id $$,
  'Marco changes 0 rows of «Coppia»'
);

-- ---------------------------------------------------------------------------
-- CA-32: the trusted roles are not blocked; giving the role is never blocked.
-- ---------------------------------------------------------------------------
set local role service_role;
select lives_ok(
  $$ update public.household_members m set is_admin = false where m.id = '61720000-0000-4000-8000-000000000102' $$,
  'CA-32: service_role takes the role away from Ivo in a couple'
);
reset role;
select is(
  (select m.is_admin from public.household_members m where m.id = '61720000-0000-4000-8000-000000000102'),
  false,
  'CA-32: Ivo does not organise now'
);
set local role authenticated;
set local request.jwt.claims to '{"sub":"61700000-0000-4000-8000-00000000000d","role":"authenticated"}';
select lives_ok(
  $$ update public.household_members m set is_admin = true where m.id = '61720000-0000-4000-8000-000000000102' $$,
  'in a couple Dora can give the role back to Ivo: the two become equal'
);
reset role;
select is(
  (select m.is_admin from public.household_members m where m.id = '61720000-0000-4000-8000-000000000102'),
  true,
  'Ivo organises again'
);

-- A security definer function (owner: postgres) is trusted.
create function pg_temp.test_remove_member(p_member_id uuid) returns void
language sql security definer set search_path = '' as $$
  delete from public.household_members m where m.id = p_member_id;
$$;
set local role authenticated;
set local request.jwt.claims to '{"sub":"61700000-0000-4000-8000-000000000015","role":"authenticated"}';
select lives_ok(
  $$ select pg_temp.test_remove_member('61720000-0000-4000-8000-000000000502') $$,
  'CA-32: a security definer function removes Nico from «Vecchia»'
);
reset role;
select is_empty(
  $$ select 1 from public.household_members m where m.id = '61720000-0000-4000-8000-000000000502' $$,
  'CA-32: Nico is no longer in «Vecchia»'
);

-- Casa D'Angelo has children: Marco removes another adult with an account and changes roles.
update public.household_members
set user_id = '61700000-0000-4000-8000-000000000019', joined_at = now()
where id = 'a1000000-0000-4000-8000-000000000002';
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select isnt_empty(
  $$ update public.household_members m set is_admin = true where m.id = 'a1000000-0000-4000-8000-000000000002'
     returning m.id $$,
  'CA-32: Marco gives the role to Laura'
);
select isnt_empty(
  $$ update public.household_members m set is_admin = false where m.id = 'a1000000-0000-4000-8000-000000000002'
     returning m.id $$,
  'CA-32: Marco takes the role away from Laura'
);
select isnt_empty(
  $$ delete from public.household_members m where m.id = 'a1000000-0000-4000-8000-000000000002' returning m.id $$,
  'CA-32: Marco removes Laura, as today'
);
set local request.jwt.claims to '{"sub":"61700000-0000-4000-8000-000000000017","role":"authenticated"}';
select isnt_empty(
  $$ update public.household_members m set is_admin = true where m.id = '61720000-0000-4000-8000-000000000602'
     returning m.id $$,
  'CA-32: in «Non coppia» Olga gives the role to Pino'
);
select isnt_empty(
  $$ update public.household_members m set is_admin = false where m.id = '61720000-0000-4000-8000-000000000602'
     returning m.id $$,
  'CA-32: in «Non coppia» Olga takes it away again'
);

-- ---------------------------------------------------------------------------
-- CA-31: in a couple, leaving the household («Esci dalla casa») works as today.
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"61700000-0000-4000-8000-00000000000e","role":"authenticated"}';
select isnt_empty(
  $$ delete from public.household_members m where m.id = '61720000-0000-4000-8000-000000000102' returning m.id $$,
  'CA-31: E (Ivo) leaves «Coppia»'
);
reset role;
select results_eq(
  $$ select m.name, m.is_admin from public.household_members m where m.household_id = '61710000-0000-4000-8000-000000000001' $$,
  $$ values ('Dora Bella', true) $$,
  'CA-31: Dora stays, and still organises'
);
select is(private.household_is_couple('61710000-0000-4000-8000-000000000001'), false, '«Coppia» is no longer a couple');

select * from finish();
rollback;
