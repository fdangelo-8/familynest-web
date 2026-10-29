-- household_members: isolation and data rules
-- (issue #9: CA-9, CA-10, CA-11, CA-12, CA-13, CA-19, CA-20, CA-21).
-- Seed ids: A = Marco (Casa D'Angelo, admin), B = Giulia (Casa Bianchi, admin),
-- C = Chiara (no household).
begin;
create extension if not exists pgtap with schema extensions;

select plan(29);

-- ---------------------------------------------------------------------------
-- A reads the 5 members of their household, in insertion order (CA-9).
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';

select results_eq(
  $$ select m.name from public.household_members m order by m.created_at $$,
  $$ values ('Marco'), ('Laura'), ('Sofia'), ('Tommaso'), ('Biscotto') $$,
  'CA-9: A sees the 5 members of Casa D''Angelo in insertion order'
);

-- CA-19: nobody, not even an admin, changes household, account or join time.
select throws_ok(
  $$ update public.household_members set household_id = '22222222-2222-4222-8222-222222222222'
     where id = 'a1000000-0000-4000-8000-000000000003' $$,
  '42501',
  null,
  'CA-19: admin cannot change household_id of a member'
);
select throws_ok(
  $$ update public.household_members set user_id = 'cccccccc-0000-4000-8000-000000000001'
     where id = 'a1000000-0000-4000-8000-000000000002' $$,
  '42501',
  null,
  'CA-19: admin cannot link an account to a member'
);
select throws_ok(
  $$ update public.household_members set joined_at = now() - interval '1 year'
     where id = 'a1000000-0000-4000-8000-000000000001' $$,
  '42501',
  null,
  'CA-19: admin cannot change joined_at'
);
select throws_ok(
  $$ update public.household_members set kind = 'adult'
     where id = 'a1000000-0000-4000-8000-000000000003' $$,
  '42501',
  null,
  'the kind of a member cannot be changed'
);
select throws_ok(
  $$ insert into public.household_members (household_id, kind, name, color, user_id)
     values ('11111111-1111-4111-8111-111111111111', 'adult', 'Intruso', 'zafferano', 'cccccccc-0000-4000-8000-000000000001') $$,
  '42501',
  null,
  'a member cannot be inserted with a linked account'
);

-- CA-20: colour unique inside the household.
select throws_ok(
  $$ insert into public.household_members (household_id, kind, name, color)
     values ('11111111-1111-4111-8111-111111111111', 'child', 'Nuovo', 'salvia') $$,
  '23505',
  null,
  'CA-20: salvia is already used by Sofia in Casa D''Angelo'
);

-- CA-21: free zafferano (remove Biscotto), then every invalid insert is refused.
select results_eq(
  $$ delete from public.household_members where id = 'a1000000-0000-4000-8000-000000000005' returning name $$,
  $$ values ('Biscotto') $$,
  'admin removes a pet'
);
select throws_ok(
  $$ insert into public.household_members (household_id, kind, name, color)
     values ('11111111-1111-4111-8111-111111111111', 'child', '', 'zafferano') $$,
  '23514',
  null,
  'CA-21: empty name refused'
);
select throws_ok(
  $$ insert into public.household_members (household_id, kind, name, color)
     values ('11111111-1111-4111-8111-111111111111', 'child', '    ', 'zafferano') $$,
  '23514',
  null,
  'CA-21: blank name refused'
);
select throws_ok(
  $$ insert into public.household_members (household_id, kind, name, color)
     values ('11111111-1111-4111-8111-111111111111', 'child', repeat('x', 41), 'zafferano') $$,
  '23514',
  null,
  'CA-21: 41 character name refused'
);
select throws_ok(
  $$ insert into public.household_members (household_id, kind, name, color)
     values ('11111111-1111-4111-8111-111111111111', 'child', 'Nuovo', 'verde') $$,
  '22P02',
  null,
  'CA-21: colour outside the ten refused'
);
select throws_ok(
  $$ insert into public.household_members (household_id, kind, name, color, birth_date)
     values ('11111111-1111-4111-8111-111111111111', 'adult', 'Nuovo', 'zafferano', '1990-01-01') $$,
  '23514',
  null,
  'CA-21: adult with birth date refused'
);
select throws_ok(
  $$ insert into public.household_members (household_id, kind, name, color, birth_date)
     values ('11111111-1111-4111-8111-111111111111', 'child', 'Nuovo', 'zafferano',
             (now() at time zone 'Europe/Rome')::date + 1) $$,
  '23514',
  null,
  'CA-21: child born tomorrow refused'
);
select lives_ok(
  $$ insert into public.household_members (household_id, kind, name, color, birth_date)
     values ('11111111-1111-4111-8111-111111111111', 'child', '  Nuovo  ', 'zafferano',
             (now() at time zone 'Europe/Rome')::date) $$,
  'a valid child born today is accepted'
);
select is(
  (select m.name from public.household_members m where m.color = 'zafferano'),
  'Nuovo',
  'the name is stored trimmed'
);

-- ---------------------------------------------------------------------------
-- B cannot see or touch the members of Casa D'Angelo (CA-10, CA-11).
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';

select is_empty(
  $$ select 1 from public.household_members m where m.household_id = '11111111-1111-4111-8111-111111111111' $$,
  'CA-10: B reads 0 members of Casa D''Angelo'
);
select throws_ok(
  $$ insert into public.household_members (household_id, kind, name, color)
     values ('11111111-1111-4111-8111-111111111111', 'child', 'Intruso', 'glicine') $$,
  '42501',
  null,
  'CA-11: B cannot insert a member in Casa D''Angelo'
);
select is_empty(
  $$ update public.household_members set name = 'Hacked'
     where household_id = '11111111-1111-4111-8111-111111111111' returning id $$,
  'CA-11: B updates 0 members of Casa D''Angelo'
);
select is_empty(
  $$ delete from public.household_members
     where household_id = '11111111-1111-4111-8111-111111111111' returning id $$,
  'CA-11: B deletes 0 members of Casa D''Angelo'
);

-- CA-20: the same colour is allowed in another household.
select lives_ok(
  $$ insert into public.household_members (household_id, kind, name, color)
     values ('22222222-2222-4222-8222-222222222222', 'child', 'Mia', 'glicine') $$,
  'CA-20: B adds a glicine member to Casa Bianchi (glicine is also used in Casa D''Angelo)'
);

-- CA-19 also for B on their own household.
select throws_ok(
  $$ update public.household_members set user_id = null, joined_at = null
     where id = 'b1000000-0000-4000-8000-000000000002' $$,
  '42501',
  null,
  'CA-19: admin cannot unlink the account of a member'
);

-- ---------------------------------------------------------------------------
-- C without household reads nothing and cannot join by writing (CA-13).
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}';

select is_empty($$ select 1 from public.household_members $$, 'CA-13: C reads 0 members');
select throws_ok(
  $$ insert into public.household_members (household_id, kind, name, color)
     values ('22222222-2222-4222-8222-222222222222', 'child', 'Intruso', 'pomodoro') $$,
  '42501',
  null,
  'C cannot insert a member in a household they do not belong to'
);

-- ---------------------------------------------------------------------------
-- Anonymous users (CA-12).
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';

select is_empty($$ select 1 from public.household_members $$, 'CA-12: anon reads 0 members');
select throws_ok(
  $$ insert into public.household_members (household_id, kind, name, color)
     values ('11111111-1111-4111-8111-111111111111', 'child', 'Intruso', 'glicine') $$,
  '42501',
  null,
  'CA-12: anon cannot insert a member'
);

-- ---------------------------------------------------------------------------
-- Final state: Casa D'Angelo only changed by A, account links untouched.
-- ---------------------------------------------------------------------------
reset role;

select results_eq(
  $$ select m.name from public.household_members m
     where m.household_id = '11111111-1111-4111-8111-111111111111' order by m.created_at $$,
  $$ values ('Marco'), ('Laura'), ('Sofia'), ('Tommaso'), ('Nuovo') $$,
  'CA-11: members of Casa D''Angelo changed only by its admin'
);
select results_eq(
  $$ select m.name, m.user_id, m.household_id from public.household_members m
     where m.user_id is not null order by m.name $$,
  $$ values
       ('Giulia', 'bbbbbbbb-0000-4000-8000-000000000001'::uuid, '22222222-2222-4222-8222-222222222222'::uuid),
       ('Marco', 'aaaaaaaa-0000-4000-8000-000000000001'::uuid, '11111111-1111-4111-8111-111111111111'::uuid),
       ('Paolo', 'bbbbbbbb-0000-4000-8000-000000000002'::uuid, '22222222-2222-4222-8222-222222222222'::uuid) $$,
  'CA-19: account links and households unchanged'
);
select is(
  (select m.joined_at < now() - interval '29 days' from public.household_members m
   where m.id = 'a1000000-0000-4000-8000-000000000001'),
  true,
  'CA-19: joined_at of Marco unchanged'
);

select * from finish();
rollback;
