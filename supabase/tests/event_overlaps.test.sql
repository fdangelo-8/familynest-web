-- Overlapping events «alla stessa ora per la stessa persona» (issue #510, DB-1 of plan
-- #501): find_event_conflicts() for the sheet «Nuovo impegno» and list_event_overlaps() for
-- Mese, Giorno and Oggi (CA-25 – CA-29), with the same visibility rules as the calendar and
-- the isolation between households (CA-24).
-- Seed ids: A = Marco (Casa D'Angelo, user aaaaaaaa…01, member a1…01), B = Giulia (Casa
-- Bianchi, bbbbbbbb…01, b1…01), C = Chiara (no household, cccccccc…01). Casa D'Angelo:
-- Laura a1…02 (adult without account), Sofia a1…03 (child), Tommaso a1…04 (child).
-- Events are inserted by the database owner with fixed ids and authors, in November 2026
-- (Europe/Rome +01:00). No rule tested here depends on the real clock. No health data (D1).
begin;
create extension if not exists pgtap with schema extensions;

select plan(32);

insert into public.events (
  id, household_id, author_member_id, title, location, starts_at, ends_at, visibility,
  escort_member_id, all_day
)
values
  -- CA-25: football of Tommaso, taken by Marco.
  ('a5300000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001',
   'Calcio Tommaso', 'Campo', '2026-11-19 18:00+01', '2026-11-19 19:00+01', 'household',
   'a1000000-0000-4000-8000-000000000001', false),
  -- CA-26: «Occupato» of Laura, with Laura among the people.
  ('a5300000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000002',
   'Visita segreta', 'Studio', '2026-11-20 17:00+01', '2026-11-20 18:00+01', 'busy', null, false),
  -- CA-27: «Occupato» of Laura with Sofia, and «Solo io» of Laura with Sofia.
  ('a5300000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000002',
   'Regalo per Marco', 'Negozio', '2026-11-21 17:00+01', '2026-11-21 18:00+01', 'busy', null, false),
  ('a5300000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000002',
   'Solo mio', 'Casa', '2026-11-21 17:00+01', '2026-11-21 18:00+01', 'private', null, false),
  -- CA-28: swimming of Sofia, an event of Sofia «tutto il giorno» and one that ends at 17:00.
  ('a5300000-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001',
   'Nuoto Sofia', null, '2026-11-23 17:00+01', '2026-11-23 18:30+01', 'household', null, false),
  ('a5300000-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001',
   'Gita scolastica', null, '2026-11-23 00:00+01', '2026-11-24 00:00+01', 'household', null, true),
  ('a5300000-0000-4000-8000-000000000007', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001',
   'Logopedia', null, '2026-11-23 16:00+01', '2026-11-23 17:00+01', 'household', null, false),
  -- Two «Occupato» of Laura at the same time: Marco sees two masked rows of Laura.
  ('a5300000-0000-4000-8000-000000000008', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000002',
   'Riunione A', null, '2026-11-25 09:00+01', '2026-11-25 10:00+01', 'busy', null, false),
  ('a5300000-0000-4000-8000-000000000009', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000002',
   'Riunione B', null, '2026-11-25 09:30+01', '2026-11-25 10:30+01', 'busy', null, false),
  -- Casa Bianchi: overlapping events of Giulia.
  ('b5300000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000001',
   'Cena Bianchi', null, '2026-11-23 17:00+01', '2026-11-23 19:00+01', 'household', 'b1000000-0000-4000-8000-000000000001', false),
  ('b5300000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000001',
   'Spesa Bianchi', null, '2026-11-23 18:00+01', '2026-11-23 18:30+01', 'household', 'b1000000-0000-4000-8000-000000000001', false);

insert into public.event_members (event_id, member_id, household_id)
values
  ('a5300000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111'),
  ('a5300000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111'),
  ('a5300000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111'),
  ('a5300000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111'),
  ('a5300000-0000-4000-8000-000000000005', 'a1000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111'),
  ('a5300000-0000-4000-8000-000000000006', 'a1000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111'),
  ('a5300000-0000-4000-8000-000000000007', 'a1000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111');

set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';

-- ---------------------------------------------------------------------------
-- find_event_conflicts (CA-25 – CA-27)
-- ---------------------------------------------------------------------------
select results_eq(
  $$ select c.member_id, c.event_id, c.occurrence_date, c.is_masked, c.title, c.escort_member_id
     from public.find_event_conflicts('2026-11-19 17:00+01', '2026-11-19 18:30+01',
       array['a1000000-0000-4000-8000-000000000001']::uuid[]) c $$,
  $$ values ('a1000000-0000-4000-8000-000000000001'::uuid, 'a5300000-0000-4000-8000-000000000001'::uuid,
             '2026-11-19'::date, false, 'Calcio Tommaso'::text, 'a1000000-0000-4000-8000-000000000001'::uuid) $$,
  'CA-25: Marco, who takes Tommaso to football, gets one row with the title'
);
select results_eq(
  $$ select c.member_id from public.find_event_conflicts('2026-11-19 17:00+01', '2026-11-19 18:30+01',
       array[]::uuid[], p_escort_member_id => 'a1000000-0000-4000-8000-000000000004') c $$,
  $$ values ('a1000000-0000-4000-8000-000000000004'::uuid) $$,
  'the people of the form include the escort and the pickup (Tommaso as a participant)'
);
select is_empty(
  $$ select 1 from public.find_event_conflicts('2026-11-19 17:00+01', '2026-11-19 18:00+01',
       array['a1000000-0000-4000-8000-000000000001']::uuid[]) $$,
  'an interval that ends when the other starts does not overlap'
);
select is_empty(
  $$ select 1 from public.find_event_conflicts('2026-11-19 17:00+01', '2026-11-19 18:30+01',
       array['a1000000-0000-4000-8000-000000000001']::uuid[], p_exclude_event_id => 'a5300000-0000-4000-8000-000000000001') $$,
  'the event being changed does not overlap itself'
);
select results_eq(
  $$ select c.member_id, c.is_masked, c.author_member_id, c.event_id, c.occurrence_date, c.title, c.member_ids,
            c.escort_member_id, c.pickup_member_id,
            (c.starts_at, c.ends_at) = ('2026-11-20 17:00+01'::timestamptz, '2026-11-20 18:00+01'::timestamptz)
     from public.find_event_conflicts('2026-11-20 17:30+01', '2026-11-20 18:30+01',
       array['a1000000-0000-4000-8000-000000000002']::uuid[]) c $$,
  $$ values ('a1000000-0000-4000-8000-000000000002'::uuid, true, 'a1000000-0000-4000-8000-000000000002'::uuid,
             null::uuid, null::date, null::text, null::uuid[], null::uuid, null::uuid, true) $$,
  'CA-26: a «Occupato» of Laura gives one masked row: author and times only'
);
select results_eq(
  $$ select count(*)::integer from public.find_event_conflicts('2026-11-20 17:30+01', '2026-11-20 18:30+01',
       array['a1000000-0000-4000-8000-000000000002']::uuid[], p_exclude_event_id => 'a5300000-0000-4000-8000-000000000002') $$,
  $$ values (1) $$,
  'an id of a masked event excludes nothing (the caller never knows it)'
);
select is_empty(
  $$ select 1 from public.find_event_conflicts('2026-11-21 17:00+01', '2026-11-21 18:00+01',
       array['a1000000-0000-4000-8000-000000000003']::uuid[]) $$,
  'CA-27: the «Occupato» and the «Solo io» of Laura with Sofia give Marco 0 rows for Sofia'
);
select is_empty(
  $$ select 1 from public.list_calendar_events('2026-11-21 00:00+01', '2026-11-22 00:00+01') c
     where c.title in ('Regalo per Marco', 'Solo mio') or c.location in ('Negozio', 'Casa')
        or c.id in ('a5300000-0000-4000-8000-000000000003', 'a5300000-0000-4000-8000-000000000004') $$,
  'CA-27: no answer of the calendar has their title, place or id'
);
select is_empty(
  $$ select 1 from public.list_event_overlaps('2026-11-21 00:00+01', '2026-11-22 00:00+01') o
     where o.event_id in ('a5300000-0000-4000-8000-000000000003', 'a5300000-0000-4000-8000-000000000004') $$,
  'CA-27: nor of list_event_overlaps'
);

-- ---------------------------------------------------------------------------
-- list_event_overlaps (CA-28)
-- ---------------------------------------------------------------------------
select is_empty(
  $$ select 1 from public.list_event_overlaps('2026-11-23 00:00+01', '2026-11-24 00:00+01') o
     where o.member_id = 'a1000000-0000-4000-8000-000000000003' $$,
  'CA-28: swimming, a day «tutto il giorno» and an event that ends at 17:00 do not overlap'
);
select is_empty(
  $$ select 1 from public.find_event_conflicts('2026-11-23 12:00+01', '2026-11-23 13:00+01',
       array['a1000000-0000-4000-8000-000000000003']::uuid[]) $$,
  'an event «tutto il giorno» is never a conflict'
);
reset role;
insert into public.events (id, household_id, author_member_id, title, starts_at, ends_at, visibility)
values ('a5300000-0000-4000-8000-000000000010', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001',
        'Danza Sofia', '2026-11-23 17:30+01', '2026-11-23 18:00+01', 'household');
insert into public.event_members (event_id, member_id, household_id)
values ('a5300000-0000-4000-8000-000000000010', 'a1000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111');
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select results_eq(
  $$ select o.member_id, o.day, o.event_id, o.is_masked
     from public.list_event_overlaps('2026-11-23 00:00+01', '2026-11-24 00:00+01') o
     where o.member_id = 'a1000000-0000-4000-8000-000000000003' $$,
  $$ values ('a1000000-0000-4000-8000-000000000003'::uuid, '2026-11-23'::date, 'a5300000-0000-4000-8000-000000000005'::uuid, false),
            ('a1000000-0000-4000-8000-000000000003', '2026-11-23', 'a5300000-0000-4000-8000-000000000010', false) $$,
  'CA-28: with the dance of Sofia 17:30–18:00: two rows, swimming and dance, for Sofia'
);
select results_eq(
  $$ select o.member_id, o.event_id, o.is_masked
     from public.list_event_overlaps('2026-11-25 00:00+01', '2026-11-26 00:00+01') o $$,
  $$ values ('a1000000-0000-4000-8000-000000000002'::uuid, null::uuid, true),
            ('a1000000-0000-4000-8000-000000000002', null, true) $$,
  'two «Occupato» of Laura at the same time: two masked rows of Laura, without ids'
);
select results_eq(
  $$ select count(*)::integer from public.list_event_overlaps('2026-11-01 00:00+01', '2026-12-13 00:00+01') $$,
  $$ values (4) $$,
  'a period of 42 days is accepted'
);
-- One occurrence moved: the occurrence overlaps another event only on that day.
reset role;
insert into public.events (id, household_id, author_member_id, title, starts_at, ends_at, visibility, recurrence, recurrence_weekdays)
values ('a5300000-0000-4000-8000-000000000011', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001',
        'Inglese Tommaso', '2026-11-16 16:00+01', '2026-11-16 17:00+01', 'household', 'weekly', '{1}');
insert into public.event_members (event_id, member_id, household_id)
values ('a5300000-0000-4000-8000-000000000011', 'a1000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111');
insert into public.event_exceptions (event_id, household_id, occurrence_date, title, starts_at, ends_at)
values ('a5300000-0000-4000-8000-000000000011', '11111111-1111-4111-8111-111111111111', '2026-11-16',
        'Inglese Tommaso', '2026-11-19 18:30+01', '2026-11-19 19:30+01');
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select results_eq(
  $$ select o.day, o.event_id from public.list_event_overlaps('2026-11-16 00:00+01', '2026-11-23 00:00+01') o
     where o.member_id = 'a1000000-0000-4000-8000-000000000004' order by o.day, o.event_id $$,
  $$ values ('2026-11-19'::date, 'a5300000-0000-4000-8000-000000000001'::uuid),
            ('2026-11-19', 'a5300000-0000-4000-8000-000000000011') $$,
  'a moved occurrence overlaps on its new day (Tommaso on Thursday 19)'
);
select results_eq(
  $$ select c.event_id, c.occurrence_date from public.find_event_conflicts('2026-11-19 19:00+01', '2026-11-19 20:00+01',
       array['a1000000-0000-4000-8000-000000000004']::uuid[]) c $$,
  $$ values ('a5300000-0000-4000-8000-000000000011'::uuid, '2026-11-16'::date) $$,
  'find_event_conflicts names the occurrence by its day in the series'
);

-- ---------------------------------------------------------------------------
-- Invalid arguments (CA-29)
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ select * from public.list_event_overlaps('2026-11-01 00:00+01', '2026-12-14 00:00+01') $$,
  '22023', null,
  'CA-29: a period of 43 days is refused'
);
select throws_ok(
  $$ select * from public.list_event_overlaps('2026-11-23 00:00+01', '2026-11-23 00:00+01') $$,
  '22023', null,
  'CA-29: an end not after the start is refused'
);
select throws_ok(
  $$ select * from public.find_event_conflicts('2026-11-23 18:00+01', '2026-11-23 18:00+01', array[]::uuid[]) $$,
  '22023', null,
  'CA-29: find_event_conflicts with an end not after the start is refused'
);
select throws_ok(
  $$ select * from public.find_event_conflicts('2026-11-23 18:00+01', null, array[]::uuid[]) $$,
  '22023', null,
  'find_event_conflicts without an end is refused'
);
select throws_ok(
  $$ select * from public.find_event_conflicts('2026-11-23 18:00+01', '2026-11-23 19:00+01', null) $$,
  '22023', null,
  'find_event_conflicts without people is refused'
);
select throws_ok(
  $$ select * from public.find_event_conflicts('2026-11-23 18:00+01', '2026-11-23 19:00+01', array[null]::uuid[]) $$,
  '22023', null,
  'find_event_conflicts with a null person is refused'
);
select throws_ok(
  $$ select * from public.find_event_conflicts('2026-11-23 18:00+01', '2026-11-23 19:00+01',
       array['b1000000-0000-4000-8000-000000000001']::uuid[]) $$,
  '22023', null,
  'find_event_conflicts with a person of another household is refused'
);
select throws_ok(
  $$ select * from public.find_event_conflicts('2026-11-23 18:00+01', '2026-11-23 19:00+01',
       array[]::uuid[], p_pickup_member_id => 'b1000000-0000-4000-8000-000000000001') $$,
  '22023', null,
  'also as the pickup'
);

-- ---------------------------------------------------------------------------
-- CA-24: isolation, users without household, anon
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select * from public.find_event_conflicts('2026-11-19 17:00+01', '2026-11-19 18:30+01',
       array['a1000000-0000-4000-8000-000000000001']::uuid[]) $$,
  '22023', null,
  'CA-24: Giulia cannot ask about a person of A'
);
select results_eq(
  $$ select o.member_id, o.event_id from public.list_event_overlaps('2026-11-23 00:00+01', '2026-11-24 00:00+01') o $$,
  $$ values ('b1000000-0000-4000-8000-000000000001'::uuid, 'b5300000-0000-4000-8000-000000000001'::uuid),
            ('b1000000-0000-4000-8000-000000000001', 'b5300000-0000-4000-8000-000000000002') $$,
  'CA-24: Giulia gets only the overlapping events of her household'
);
select results_eq(
  $$ select c.event_id from public.find_event_conflicts('2026-11-23 17:00+01', '2026-11-23 19:00+01',
       array['b1000000-0000-4000-8000-000000000001']::uuid[]) c $$,
  $$ values ('b5300000-0000-4000-8000-000000000001'::uuid), ('b5300000-0000-4000-8000-000000000002') $$,
  'CA-24: and only conflicts of her household'
);
select is_empty(
  $$ select 1 from public.get_event_occurrence('a5300000-0000-4000-8000-000000000001') $$,
  'CA-24: get_event_occurrence gives Giulia nothing of A'
);

set local request.jwt.claims to '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select * from public.list_event_overlaps('2026-11-23 00:00+01', '2026-11-24 00:00+01') $$,
  '42501', null,
  'a user without household cannot call list_event_overlaps'
);
select throws_ok(
  $$ select * from public.find_event_conflicts('2026-11-23 17:00+01', '2026-11-23 19:00+01', array[]::uuid[]) $$,
  '42501', null,
  'nor find_event_conflicts'
);

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok(
  $$ select * from public.find_event_conflicts('2026-11-23 17:00+01', '2026-11-23 19:00+01', array[]::uuid[]) $$,
  '42501', null,
  'CA-24: anon cannot call find_event_conflicts'
);
select throws_ok(
  $$ select * from public.list_event_overlaps('2026-11-23 00:00+01', '2026-11-24 00:00+01') $$,
  '42501', null,
  'CA-24: anon cannot call list_event_overlaps'
);

select * from finish();
rollback;
