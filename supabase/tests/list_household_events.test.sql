-- list_household_events(): visibility, isolation, repetitions and period limit
-- (issue #86, for #25 Calendario · Settimana, #30 Oggi and the month view).
-- Seed ids: A = Marco (Casa D'Angelo), B = Giulia (Casa Bianchi), B2 = Paolo (Casa
-- Bianchi), C = Chiara (no household). Members: Giulia b1…01, Paolo b1…02, Leo b1…03
-- (child), Anna b1…04 (adult without account); Marco a1…01, Sofia a1…03.
-- Events are inserted by the database owner with fixed ids and authors. Week under test:
-- Monday 19 – Sunday 25 October 2026 (Europe/Rome; daylight saving time ends on the 25th).
-- No health data (D1).
begin;
create extension if not exists pgtap with schema extensions;

select plan(29);

insert into public.events (
  id, household_id, author_member_id, title, location, starts_at, ends_at, visibility,
  escort_member_id, recurrence, recurrence_weekdays, recurrence_until
)
values
  -- Casa Bianchi
  ('b4000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000002',
   'Riunione segreta', 'Ufficio Nord', '2026-10-20 09:00+02', '2026-10-20 15:00+02', 'busy',
   'b1000000-0000-4000-8000-000000000004', 'none', null, null),
  ('b4000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000002',
   'Prova privata', null, '2026-10-20 10:00+02', '2026-10-20 11:00+02', 'private', null, 'none', null, null),
  ('b4000000-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000001',
   'Cena da Marta', 'Via Roma 1', '2026-10-23 20:00+02', '2026-10-23 23:00+02', 'household', null, 'none', null, null),
  ('b4000000-0000-4000-8000-000000000004', '22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000002',
   'Nuoto Leo', 'Piscina comunale', '2026-10-20 17:00+02', '2026-10-20 18:30+02', 'household',
   'b1000000-0000-4000-8000-000000000004', 'weekly', '{2,4}', '2026-11-05'),
  ('b4000000-0000-4000-8000-000000000005', '22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000001',
   'Notte', null, '2026-10-19 23:00+02', '2026-10-20 01:00+02', 'household', null, 'none', null, null),
  ('b4000000-0000-4000-8000-000000000006', '22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000001',
   'Affitto', null, '2026-01-31 09:00+01', '2026-01-31 10:00+01', 'household', null, 'monthly', null, null),
  ('b4000000-0000-4000-8000-000000000007', '22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000002',
   'Occupato con Giulia', null, '2026-10-20 12:00+02', '2026-10-20 13:00+02', 'busy', null, 'none', null, null),
  ('b4000000-0000-4000-8000-000000000008', '22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000002',
   'Solo io con Giulia', null, '2026-10-21 12:00+02', '2026-10-21 13:00+02', 'private', null, 'none', null, null),
  ('b4000000-0000-4000-8000-000000000009', '22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000002',
   'Corsa', null, '2026-10-22 07:00+02', '2026-10-22 08:00+02', 'busy',
   'b1000000-0000-4000-8000-000000000001', 'none', null, null),
  ('b4000000-0000-4000-8000-000000000010', '22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000001',
   'Vecchio', null, '2026-09-07 10:00+02', '2026-09-07 11:00+02', 'household', null, 'weekly', '{1}', '2026-10-12'),
  ('b4000000-0000-4000-8000-000000000011', '22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000001',
   'Domenica sera', null, '2026-10-18 20:00+02', '2026-10-18 21:00+02', 'household', null, 'weekly', '{7}', null),
  ('b4000000-0000-4000-8000-000000000012', '22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000001',
   'Mio privato', null, '2026-10-24 09:00+02', '2026-10-24 10:00+02', 'private', null, 'none', null, null),
  ('b4000000-0000-4000-8000-000000000013', '22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000002',
   'Allenamento', 'Palestra', '2026-10-14 19:00+02', '2026-10-14 20:00+02', 'busy', null, 'weekly', '{3}', null),
  ('b4000000-0000-4000-8000-000000000014', '22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000001',
   'Turno', null, '2026-10-11 23:00+02', '2026-10-12 01:00+02', 'household', null, 'weekly', '{7}', null),
  -- Casa D'Angelo
  ('a4000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001',
   'Cena dai nonni', null, '2026-10-20 19:30+02', '2026-10-20 21:30+02', 'household', null, 'none', null, null),
  ('a4000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001',
   'Lavoro Marco', null, '2026-10-20 09:00+02', '2026-10-20 18:00+02', 'busy', null, 'none', null, null);

insert into public.event_members (event_id, member_id, household_id)
values
  ('b4000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222'),
  ('b4000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222222'),
  -- Paolo first: the result follows the order of the members (Giulia, then Paolo).
  ('b4000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222'),
  ('b4000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222'),
  ('b4000000-0000-4000-8000-000000000004', 'b1000000-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222222'),
  ('b4000000-0000-4000-8000-000000000007', 'b1000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222'),
  ('b4000000-0000-4000-8000-000000000008', 'b1000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222'),
  ('a4000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111');

select has_function('public', 'list_household_events', array['timestamp with time zone', 'timestamp with time zone'], 'list_household_events exists');
select ok(
  (select p.prosecdef from pg_proc p where p.oid = 'public.list_household_events(timestamptz, timestamptz)'::regprocedure),
  'list_household_events is security definer (search_path checked in 00_schema)'
);

-- ---------------------------------------------------------------------------
-- Giulia (B): the week of 19 – 25 October
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';

select results_eq(
  $$ select e.id, e.title, e.starts_at, e.ends_at, e.visibility::text, e.is_masked
     from public.list_household_events('2026-10-19 00:00+02', '2026-10-26 00:00+01') e $$,
  $$ values
       ('b4000000-0000-4000-8000-000000000014'::uuid, 'Turno', '2026-10-18 21:00Z'::timestamptz, '2026-10-18 23:00Z'::timestamptz, 'household', false),
       ('b4000000-0000-4000-8000-000000000005'::uuid, 'Notte', '2026-10-19 21:00Z', '2026-10-19 23:00Z', 'household', false),
       (null, null, '2026-10-20 07:00Z', '2026-10-20 13:00Z', 'busy', true),
       ('b4000000-0000-4000-8000-000000000007', 'Occupato con Giulia', '2026-10-20 10:00Z', '2026-10-20 11:00Z', 'busy', false),
       ('b4000000-0000-4000-8000-000000000004', 'Nuoto Leo', '2026-10-20 15:00Z', '2026-10-20 16:30Z', 'household', false),
       ('b4000000-0000-4000-8000-000000000008', 'Solo io con Giulia', '2026-10-21 10:00Z', '2026-10-21 11:00Z', 'private', false),
       (null, null, '2026-10-21 17:00Z', '2026-10-21 18:00Z', 'busy', true),
       ('b4000000-0000-4000-8000-000000000009', 'Corsa', '2026-10-22 05:00Z', '2026-10-22 06:00Z', 'busy', false),
       ('b4000000-0000-4000-8000-000000000004', 'Nuoto Leo', '2026-10-22 15:00Z', '2026-10-22 16:30Z', 'household', false),
       ('b4000000-0000-4000-8000-000000000003', 'Cena da Marta', '2026-10-23 18:00Z', '2026-10-23 21:00Z', 'household', false),
       ('b4000000-0000-4000-8000-000000000012', 'Mio privato', '2026-10-24 07:00Z', '2026-10-24 08:00Z', 'private', false),
       ('b4000000-0000-4000-8000-000000000011', 'Domenica sera', '2026-10-25 19:00Z', '2026-10-25 20:00Z', 'household', false),
       ('b4000000-0000-4000-8000-000000000014', 'Turno', '2026-10-25 22:00Z', '2026-10-26 00:00Z', 'household', false) $$,
  'B gets every occurrence of the week in order: her own, «Tutto il Nest», the ones she is involved in, the «Occupato» of B2 masked; local times kept across the change of time'
);
select results_eq(
  $$ select e.id, e.title, e.location, e.escort_member_id, e.member_ids, e.author_member_id
     from public.list_household_events('2026-10-19 00:00+02', '2026-10-26 00:00+01') e
     where e.is_masked $$,
  $$ values
       (null::uuid, null::text, null::text, null::uuid, null::uuid[], 'b1000000-0000-4000-8000-000000000002'::uuid),
       (null, null, null, null, null, 'b1000000-0000-4000-8000-000000000002') $$,
  'an «Occupato» of B2 reaches B with only start, end and author: no id, title, place, escort or participants'
);
select is_empty(
  $$ select 1 from public.list_household_events('2026-10-19 00:00+02', '2026-10-26 00:00+01') e
     where e.title in ('Riunione segreta', 'Prova privata', 'Allenamento')
        or e.location in ('Ufficio Nord', 'Palestra')
        or e.starts_at = '2026-10-20 08:00Z' $$,
  'nothing of the «Solo io» of B2 and no detail of his «Occupato» reaches B'
);
select results_eq(
  $$ select e.title, e.location, e.escort_member_id, e.member_ids
     from public.list_household_events('2026-10-19 00:00+02', '2026-10-26 00:00+01') e
     where e.id in ('b4000000-0000-4000-8000-000000000003', 'b4000000-0000-4000-8000-000000000004')
     order by e.starts_at $$,
  $$ values
       ('Nuoto Leo', 'Piscina comunale', 'b1000000-0000-4000-8000-000000000004'::uuid, array['b1000000-0000-4000-8000-000000000003']::uuid[]),
       ('Nuoto Leo', 'Piscina comunale', 'b1000000-0000-4000-8000-000000000004'::uuid, array['b1000000-0000-4000-8000-000000000003']::uuid[]),
       ('Cena da Marta', 'Via Roma 1', null, array['b1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002']::uuid[]) $$,
  'full events carry place, escort and participants in the order of the household members'
);
select is(
  (select e.member_ids from public.list_household_events('2026-10-19 00:00+02', '2026-10-26 00:00+01') e
   where e.id = 'b4000000-0000-4000-8000-000000000012'),
  array[]::uuid[],
  'an event without participants has an empty list'
);
select is_empty(
  $$ select 1 from public.list_household_events('2026-10-19 00:00+02', '2026-10-26 00:00+01') e
     where e.title in ('Cena dai nonni', 'Lavoro Marco')
        or e.author_member_id = 'a1000000-0000-4000-8000-000000000001' $$,
  'nothing of Casa D''Angelo reaches B, not even masked'
);
select results_eq(
  $$ select e.title from public.list_household_events('2026-10-20 00:00+02', '2026-10-20 08:00+02') e $$,
  $$ values ('Notte') $$,
  'an event that started before the period and ends inside it is returned'
);
select results_eq(
  $$ select e.starts_at from public.list_household_events('2026-10-26 00:00+01', '2026-12-07 00:00+01') e
     where e.id = 'b4000000-0000-4000-8000-000000000004' $$,
  $$ values ('2026-10-27 16:00Z'::timestamptz), ('2026-10-29 16:00Z'), ('2026-11-03 16:00Z'), ('2026-11-05 16:00Z') $$,
  'a weekly event repeats on its days until its last day (5 November included)'
);
select results_eq(
  $$ select e.starts_at from public.list_household_events('2026-10-26 00:00+01', '2026-12-07 00:00+01') e
     where e.id = 'b4000000-0000-4000-8000-000000000006' $$,
  $$ values ('2026-10-31 08:00Z'::timestamptz) $$,
  'a monthly event on the 31st: 31 October, nothing in November'
);
select results_eq(
  $$ select e.starts_at from public.list_household_events('2026-12-01 00:00+01', '2027-01-05 00:00+01') e
     where e.id = 'b4000000-0000-4000-8000-000000000006' $$,
  $$ values ('2026-12-31 08:00Z'::timestamptz) $$,
  'a monthly event on the 31st: 31 December'
);
select results_eq(
  $$ select e.starts_at from public.list_household_events('2026-10-05 00:00+02', '2026-10-19 00:00+02') e
     where e.id = 'b4000000-0000-4000-8000-000000000010' $$,
  $$ values ('2026-10-05 08:00Z'::timestamptz), ('2026-10-12 08:00Z') $$,
  'a weekly event that ended on 12 October has its last occurrence that day'
);
select results_eq(
  $$ select e.starts_at from public.list_household_events('2026-03-23 00:00+01', '2026-04-06 00:00+02') e
     where e.id = 'b4000000-0000-4000-8000-000000000006' $$,
  $$ values ('2026-03-31 07:00Z'::timestamptz) $$,
  'repetitions keep the Rome time after the change to summer time (9:00 = 7:00 UTC)'
);

-- Period limit: at most 42 days on the Rome clock.
select lives_ok(
  $$ select * from public.list_household_events('2026-10-19 00:00+02', '2026-11-30 00:00+01') $$,
  'six weeks across the change of time are accepted (42 days on the Rome clock)'
);
select lives_ok(
  $$ select * from public.list_household_events('2026-11-02 00:00+01', '2026-12-14 00:00+01') $$,
  'exactly 42 days are accepted'
);
select throws_ok(
  $$ select * from public.list_household_events('2026-11-02 00:00+01', '2026-12-14 00:00:01+01') $$,
  '22023', null,
  'more than 42 days is refused'
);
select throws_ok(
  $$ select * from public.list_household_events('2026-11-02 00:00+01', '2026-11-02 00:00+01') $$,
  '22023', null,
  'an empty period is refused'
);
select throws_ok(
  $$ select * from public.list_household_events('2026-11-09 00:00+01', '2026-11-02 00:00+01') $$,
  '22023', null,
  'a period that ends before it starts is refused'
);
select throws_ok(
  $$ select * from public.list_household_events(null, '2026-11-02 00:00+01') $$,
  '22023', null,
  'a missing bound is refused'
);
select throws_ok(
  $$ select * from public.list_household_events('-infinity', 'infinity') $$,
  '22023', null,
  'infinite bounds are refused'
);

-- ---------------------------------------------------------------------------
-- Paolo (B2) sees his own events in full
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';

select results_eq(
  $$ select e.title, e.is_masked
     from public.list_household_events('2026-10-19 00:00+02', '2026-10-26 00:00+01') e $$,
  $$ values
       ('Turno', false), ('Notte', false), ('Riunione segreta', false), ('Prova privata', false),
       ('Occupato con Giulia', false), ('Nuoto Leo', false), ('Solo io con Giulia', false),
       ('Allenamento', false), ('Corsa', false), ('Nuoto Leo', false), ('Cena da Marta', false),
       ('Domenica sera', false), ('Turno', false) $$,
  'B2 gets his «Occupato» and «Solo io» in full, and not the «Solo io» of B'
);
select results_eq(
  $$ select e.location, e.escort_member_id, e.member_ids
     from public.list_household_events('2026-10-19 00:00+02', '2026-10-26 00:00+01') e
     where e.id = 'b4000000-0000-4000-8000-000000000001' $$,
  $$ values ('Ufficio Nord', 'b1000000-0000-4000-8000-000000000004'::uuid,
             array['b1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000003']::uuid[]) $$,
  'B2 gets the details of his «Occupato»'
);

-- ---------------------------------------------------------------------------
-- Marco (A): only Casa D'Angelo
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';

select results_eq(
  $$ select e.id, e.title, e.is_masked, e.member_ids
     from public.list_household_events('2026-10-19 00:00+02', '2026-10-26 00:00+01') e $$,
  $$ values
       ('a4000000-0000-4000-8000-000000000002'::uuid, 'Lavoro Marco', false, array[]::uuid[]),
       ('a4000000-0000-4000-8000-000000000001'::uuid, 'Cena dai nonni', false, array['a1000000-0000-4000-8000-000000000003']::uuid[]) $$,
  'A gets only the events of Casa D''Angelo'
);
select is_empty(
  $$ select 1 from public.list_household_events('2026-01-01 00:00+01', '2026-02-01 00:00+01') e
     where e.title = 'Affitto' or e.author_member_id::text like 'b1%' $$,
  'A never gets events of Casa Bianchi'
);

-- ---------------------------------------------------------------------------
-- Chiara (C, no household) and anonymous users
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}';
select is_empty(
  $$ select 1 from public.list_household_events('2026-10-19 00:00+02', '2026-10-26 00:00+01') $$,
  'C (no household) gets no rows'
);
select throws_ok(
  $$ select * from public.list_household_events('2026-10-19 00:00+02', '2026-12-26 00:00+01') $$,
  '22023', null,
  'C also gets the period error'
);

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok(
  $$ select * from public.list_household_events('2026-10-19 00:00+02', '2026-10-26 00:00+01') $$,
  '42501', null,
  'anon cannot call list_household_events'
);

-- An authenticated role without a user (no sub) gets the permission error.
set local role authenticated;
set local request.jwt.claims to '{"role":"authenticated"}';
select throws_ok(
  $$ select * from public.list_household_events('2026-10-19 00:00+02', '2026-10-26 00:00+01') $$,
  '42501', null,
  'a call without a user is refused'
);

select * from finish();
rollback;
