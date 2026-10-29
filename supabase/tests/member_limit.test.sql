-- household_members: 10 colours and at most 10 members per household
-- (issue #74: CA-19, CA-20, CA-21, CA-22, CA-23, CA-24, CA-25, CA-26, CA-27).
-- Seed ids: A = Marco (Casa D'Angelo, admin, 5 members), B = Giulia (Casa Bianchi,
-- admin, 4 members), B2 = Paolo (Casa Bianchi, not admin), C = Chiara (no household).
-- The 10 colours: pomodoro, glicine, salvia, cobalto, zafferano, then the new ones
-- lampone (1), ceruleo (2), peonia (3), basilico (4), cannella (5).
begin;
create extension if not exists pgtap with schema extensions;

select plan(44);

-- ---------------------------------------------------------------------------
-- Schema: the limit trigger exists and fires before household_members_normalize.
-- ---------------------------------------------------------------------------
select has_trigger('public', 'household_members', 'household_members_limit', 'household_members_limit trigger exists');
select trigger_is(
  'public', 'household_members', 'household_members_limit',
  'public', 'household_members_enforce_limit',
  'household_members_limit runs household_members_enforce_limit()'
);
select ok(
  (select t.tgtype & 2 = 2 and t.tgtype & 4 = 4 and t.tgtype & 1 = 1
   from pg_trigger t
   where t.tgrelid = 'public.household_members'::regclass and t.tgname = 'household_members_limit'),
  'household_members_limit is a before insert trigger for each row'
);
-- Postgres fires triggers of the same kind in name order (byte order, as the "C"
-- collation): the limit must be the first before insert row trigger of the table.
select results_eq(
  $$ select t.tgname::text collate "default"
     from pg_trigger t
     where t.tgrelid = 'public.household_members'::regclass
       and not t.tgisinternal
       and t.tgtype & 7 = 7
     order by t.tgname collate "C" $$,
  $$ values ('household_members_limit'), ('household_members_normalize') $$,
  'household_members_limit is the first before insert trigger, then household_members_normalize'
);
select ok(
  (select p.prosecdef from pg_proc p where p.oid = 'public.household_members_enforce_limit()'::regprocedure),
  'household_members_enforce_limit is security definer'
);
select ok(
  not has_function_privilege('authenticated', 'public.household_members_enforce_limit()', 'execute')
  and not has_function_privilege('anon', 'public.household_members_enforce_limit()', 'execute'),
  'household_members_enforce_limit cannot be called by the API roles'
);

-- ---------------------------------------------------------------------------
-- CA-19: A adds 5 children or pets, one per new colour: Casa D'Angelo reaches 10.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';

select lives_ok(
  $$ insert into public.household_members (household_id, kind, name, color)
     values ('11111111-1111-4111-8111-111111111111', 'child', 'Figlio 6', 'lampone') $$,
  'CA-19: A adds a child with lampone (6th member)'
);
select lives_ok(
  $$ insert into public.household_members (household_id, kind, name, color)
     values ('11111111-1111-4111-8111-111111111111', 'pet', 'Animale 7', 'ceruleo') $$,
  'CA-19: A adds a pet with ceruleo (7th member)'
);
select lives_ok(
  $$ insert into public.household_members (household_id, kind, name, color)
     values ('11111111-1111-4111-8111-111111111111', 'child', 'Figlio 8', 'peonia') $$,
  'CA-19: A adds a child with peonia (8th member)'
);
select lives_ok(
  $$ insert into public.household_members (household_id, kind, name, color)
     values ('11111111-1111-4111-8111-111111111111', 'pet', 'Animale 9', 'basilico') $$,
  'CA-19: A adds a pet with basilico (9th member)'
);
select lives_ok(
  $$ insert into public.household_members (household_id, kind, name, color)
     values ('11111111-1111-4111-8111-111111111111', 'child', 'Figlio 10', 'cannella') $$,
  'CA-19: A adds a child with cannella (10th member)'
);
select results_eq(
  $$ select m.color::text from public.household_members m
     where m.household_id = '11111111-1111-4111-8111-111111111111' order by m.color $$,
  $$ values ('pomodoro'), ('glicine'), ('salvia'), ('cobalto'), ('zafferano'),
            ('lampone'), ('ceruleo'), ('peonia'), ('basilico'), ('cannella') $$,
  'CA-19: Casa D''Angelo has 10 members, one per colour'
);

-- ---------------------------------------------------------------------------
-- CA-20: the eleventh member is refused with the limit error, never 23505.
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.household_members (household_id, kind, name, color)
     values ('11111111-1111-4111-8111-111111111111', 'child', 'Undicesimo', 'pomodoro') $$,
  'P0001',
  'household member limit reached',
  'CA-20: A cannot add an 11th child with pomodoro (limit error, not 23505)'
);
select throws_ok(
  $$ insert into public.household_members (household_id, kind, name, color)
     values ('11111111-1111-4111-8111-111111111111', 'pet', 'Undicesimo', 'cannella') $$,
  'P0001',
  'household member limit reached',
  'CA-20: A cannot add an 11th pet with a new colour'
);
select throws_ok(
  $$ insert into public.household_members (household_id, kind, name, color)
     values ('11111111-1111-4111-8111-111111111111', 'adult', 'Undicesimo', 'lampone') $$,
  'P0001',
  'household member limit reached',
  'CA-20: A cannot add an 11th adult'
);
select is(
  (select count(*)::integer from public.household_members m
   where m.household_id = '11111111-1111-4111-8111-111111111111'),
  10,
  'CA-20: Casa D''Angelo still has 10 members'
);

-- CA-27: a value outside the ten colours is refused by the type.
select throws_ok(
  $$ insert into public.household_members (household_id, kind, name, color)
     values ('11111111-1111-4111-8111-111111111111', 'child', 'Nuovo', 'verde') $$,
  '22P02',
  null,
  'CA-27: a colour outside the ten is refused'
);

-- ---------------------------------------------------------------------------
-- CA-21: same refusal for postgres and service_role (seed script, admin client).
-- ---------------------------------------------------------------------------
reset role;
set local request.jwt.claims to '{}';

select throws_ok(
  $$ insert into public.household_members (household_id, kind, name, color)
     values ('11111111-1111-4111-8111-111111111111', 'child', 'Undicesimo', 'salvia') $$,
  'P0001',
  'household member limit reached',
  'CA-21: postgres cannot add an 11th member'
);

set local role service_role;
set local request.jwt.claims to '{"role":"service_role"}';

select throws_ok(
  $$ insert into public.household_members (household_id, kind, name, color)
     values ('11111111-1111-4111-8111-111111111111', 'child', 'Undicesimo', 'salvia') $$,
  'P0001',
  'household member limit reached',
  'CA-21: service_role cannot add an 11th member'
);

reset role;

select is(
  (select count(*)::integer from public.household_members m
   where m.household_id = '11111111-1111-4111-8111-111111111111'),
  10,
  'CA-21: Casa D''Angelo still has 10 members'
);

-- ---------------------------------------------------------------------------
-- CA-22: removing a member frees a place.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';

select results_eq(
  $$ delete from public.household_members where id = 'a1000000-0000-4000-8000-000000000005' returning name $$,
  $$ values ('Biscotto') $$,
  'CA-22: A removes Biscotto'
);
select lives_ok(
  $$ insert into public.household_members (household_id, kind, name, color)
     values ('11111111-1111-4111-8111-111111111111', 'pet', 'Pallina', 'zafferano') $$,
  'CA-22: A adds a pet with zafferano in the freed place'
);
select is(
  (select count(*)::integer from public.household_members m
   where m.household_id = '11111111-1111-4111-8111-111111111111'),
  10,
  'CA-22: Casa D''Angelo has 10 members again'
);

-- ---------------------------------------------------------------------------
-- CA-26: colours stay unique inside the household, new colours included.
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';

select lives_ok(
  $$ update public.household_members set color = 'ceruleo'
     where id = 'b1000000-0000-4000-8000-000000000002' $$,
  'CA-26: B2 changes their own colour to ceruleo'
);
select is(
  (select m.color::text from public.household_members m where m.id = 'b1000000-0000-4000-8000-000000000002'),
  'ceruleo',
  'CA-26: B2 now has ceruleo'
);

set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';

select throws_ok(
  $$ update public.household_members set color = 'ceruleo'
     where id = 'b1000000-0000-4000-8000-000000000001' $$,
  '23505',
  null,
  'CA-26: B cannot take ceruleo, already used by B2'
);

-- ---------------------------------------------------------------------------
-- CA-23 (isolation): another household never learns that Casa D'Angelo is full.
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.household_members (household_id, kind, name, color)
     values ('11111111-1111-4111-8111-111111111111', 'child', 'Intruso', 'pomodoro') $$,
  '42501',
  null,
  'CA-23: B gets the permission error (42501), not the limit error, on full Casa D''Angelo'
);
select throws_ok(
  $$ insert into public.household_members (household_id, kind, name, color)
     values ('11111111-1111-4111-8111-111111111111', 'adult', 'Intruso', 'lampone') $$,
  '42501',
  null,
  'CA-23: B gets 42501 also for an adult on full Casa D''Angelo'
);
select is_empty(
  $$ select 1 from public.household_members m where m.household_id = '11111111-1111-4111-8111-111111111111' $$,
  'CA-23: B reads 0 members of Casa D''Angelo'
);
select lives_ok(
  $$ insert into public.household_members (household_id, kind, name, color)
     values ('22222222-2222-4222-8222-222222222222', 'child', 'Mia', 'lampone') $$,
  'CA-23: B adds a child with lampone to Casa Bianchi (the limit is per household)'
);

-- C, without a household, also gets 42501.
set local request.jwt.claims to '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}';

select throws_ok(
  $$ insert into public.household_members (household_id, kind, name, color)
     values ('11111111-1111-4111-8111-111111111111', 'child', 'Intruso', 'pomodoro') $$,
  '42501',
  null,
  'C gets 42501, not the limit error, on full Casa D''Angelo'
);

-- Anonymous users get 42501 too.
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';

select throws_ok(
  $$ insert into public.household_members (household_id, kind, name, color)
     values ('11111111-1111-4111-8111-111111111111', 'child', 'Intruso', 'pomodoro') $$,
  '42501',
  null,
  'anon gets 42501, not the limit error, on full Casa D''Angelo'
);
select is_empty($$ select 1 from public.household_members $$, 'anon reads 0 members');

reset role;

select is(
  (select count(*)::integer from public.household_members m
   where m.household_id = '11111111-1111-4111-8111-111111111111'),
  10,
  'CA-23: Casa D''Angelo still has 10 members'
);

-- ---------------------------------------------------------------------------
-- CA-24: Casa Bianchi brought to 10 by B; B2 (not admin) cannot add an 11th.
-- Casa Bianchi now: cobalto (Giulia), ceruleo (Paolo), zafferano (Leo), pomodoro (Anna),
-- lampone (Mia).
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';

select lives_ok(
  $$ insert into public.household_members (household_id, kind, name, color)
     values
       ('22222222-2222-4222-8222-222222222222', 'child', 'Figlio 6', 'glicine'),
       ('22222222-2222-4222-8222-222222222222', 'pet', 'Animale 7', 'salvia'),
       ('22222222-2222-4222-8222-222222222222', 'child', 'Figlio 8', 'peonia'),
       ('22222222-2222-4222-8222-222222222222', 'pet', 'Animale 9', 'basilico'),
       ('22222222-2222-4222-8222-222222222222', 'adult', 'Adulto 10', 'cannella') $$,
  'CA-24: B brings Casa Bianchi to 10 members in one statement'
);
select is(
  (select count(*)::integer from public.household_members m
   where m.household_id = '22222222-2222-4222-8222-222222222222'),
  10,
  'CA-24: Casa Bianchi has 10 members'
);

set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';

select throws_ok(
  $$ insert into public.household_members (household_id, kind, name, color)
     values ('22222222-2222-4222-8222-222222222222', 'child', 'Undicesimo', 'salvia') $$,
  'P0001',
  'household member limit reached',
  'CA-24: B2 cannot add an 11th member to Casa Bianchi'
);
select is(
  (select count(*)::integer from public.household_members m
   where m.household_id = '22222222-2222-4222-8222-222222222222'),
  10,
  'CA-24: Casa Bianchi still has 10 members'
);

-- A statement that would take a household from 9 to 11 is refused as a whole.
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';

select results_eq(
  $$ delete from public.household_members where name = 'Animale 9' returning color::text $$,
  $$ values ('basilico') $$,
  'B removes a pet: Casa Bianchi has 9 members'
);
select throws_ok(
  $$ insert into public.household_members (household_id, kind, name, color)
     values
       ('22222222-2222-4222-8222-222222222222', 'pet', 'Animale 10', 'basilico'),
       ('22222222-2222-4222-8222-222222222222', 'pet', 'Animale 11', 'zafferano') $$,
  'P0001',
  'household member limit reached',
  'two members in one statement on 9: the statement is refused'
);
select is(
  (select count(*)::integer from public.household_members m
   where m.household_id = '22222222-2222-4222-8222-222222222222'),
  9,
  'no row of the refused statement is kept'
);

-- ---------------------------------------------------------------------------
-- CA-25: C creates a household with the 5th new colour.
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}';

select ok(
  (select public.create_household('Casa Neri', 'single', 'Chiara', 'cannella')) is not null,
  'CA-25: C creates a household with cannella'
);
select results_eq(
  $$ select m.name, m.color::text, m.is_admin, m.user_id from public.household_members m $$,
  $$ values ('Chiara', 'cannella', true, 'cccccccc-0000-4000-8000-000000000001'::uuid) $$,
  'CA-25: the new household has exactly one member, with cannella'
);

-- ---------------------------------------------------------------------------
-- Final state: nothing leaked between households.
-- ---------------------------------------------------------------------------
reset role;

select set_eq(
  $$ select m.name from public.household_members m
     where m.household_id = '11111111-1111-4111-8111-111111111111' $$,
  $$ values ('Marco'), ('Laura'), ('Sofia'), ('Tommaso'),
            ('Figlio 6'), ('Animale 7'), ('Figlio 8'), ('Animale 9'), ('Figlio 10'), ('Pallina') $$,
  'Casa D''Angelo changed only by its members'
);

select * from finish();
rollback;
