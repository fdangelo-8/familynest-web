-- create_event(): one call creates an event and its participants (issue #109, for #20
-- Aggiungi · Impegni and the full form of #19). Also the notes column of events.
-- Seed ids: A = Marco (Casa D'Angelo), B = Giulia (Casa Bianchi), B2 = Paolo (Casa
-- Bianchi), C = Chiara (no household). Members: Casa D'Angelo Marco a1…01, Laura a1…02
-- (adult without account), Sofia a1…03 (child); Casa Bianchi Giulia b1…01, Paolo b1…02,
-- Leo b1…03 (child), Anna b1…04 (adult without account).
-- No health data (D1): the notes of the examples are «Portare la cuffia».
begin;
create extension if not exists pgtap with schema extensions;

select plan(33);

-- ---------------------------------------------------------------------------
-- Schema and privileges
-- ---------------------------------------------------------------------------
select has_function(
  'public', 'create_event',
  array[
    'text', 'timestamp with time zone', 'timestamp with time zone', 'event_visibility', 'uuid[]',
    'text', 'uuid', 'event_recurrence', 'smallint[]', 'date', 'text'
  ],
  'create_event exists'
);
select ok(
  not (select p.prosecdef from pg_proc p where p.oid = 'public.create_event(text, timestamptz, timestamptz, public.event_visibility, uuid[], text, uuid, public.event_recurrence, smallint[], date, text)'::regprocedure),
  'create_event is security invoker: RLS, triggers and constraints apply'
);
select ok(
  (select p.proconfig @> array['search_path=""'] from pg_proc p where p.oid = 'public.create_event(text, timestamptz, timestamptz, public.event_visibility, uuid[], text, uuid, public.event_recurrence, smallint[], date, text)'::regprocedure),
  'create_event has an empty search_path'
);
select ok(
  not has_function_privilege('anon', 'public.create_event(text, timestamptz, timestamptz, public.event_visibility, uuid[], text, uuid, public.event_recurrence, smallint[], date, text)', 'execute')
  and has_function_privilege('authenticated', 'public.create_event(text, timestamptz, timestamptz, public.event_visibility, uuid[], text, uuid, public.event_recurrence, smallint[], date, text)', 'execute'),
  'create_event is for signed-in users only'
);
select ok(
  has_column_privilege('authenticated', 'public.events', 'notes', 'insert')
  and has_column_privilege('authenticated', 'public.events', 'notes', 'update')
  and not has_column_privilege('authenticated', 'public.events', 'id', 'insert')
  and not has_column_privilege('anon', 'public.events', 'notes', 'select'),
  'notes are written by signed-in users; the id never (the database generates it)'
);

-- ---------------------------------------------------------------------------
-- Marco (A) creates the «Nuoto»
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';

select lives_ok(
  $$ select set_config('test.nuoto', public.create_event(
       '  Nuoto   Sofia ', '2026-10-06 17:00+02', '2026-10-06 18:30+02', 'household',
       array['a1000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000003']::uuid[],
       'Piscina comunale, Lissone', 'a1000000-0000-4000-8000-000000000002', 'weekly', '{4,2}', null,
       E'  Portare la cuffia\n  e gli occhialini \n'
     )::text, true) $$,
  'A creates a repeated event with participants, escort and notes in one call'
);
select results_eq(
  $$ select e.household_id, e.author_member_id, e.title, e.location, e.notes, e.recurrence_weekdays
     from public.events e where e.id = current_setting('test.nuoto')::uuid $$,
  $$ values (
       '11111111-1111-4111-8111-111111111111'::uuid, 'a1000000-0000-4000-8000-000000000001'::uuid,
       'Nuoto Sofia', 'Piscina comunale, Lissone', E'Portare la cuffia\n  e gli occhialini', '{2,4}'::smallint[]
     ) $$,
  'the event belongs to the household of A, A is the author, texts are normalised (line breaks of the notes stay)'
);
select results_eq(
  $$ select em.member_id from public.event_members em where em.event_id = current_setting('test.nuoto')::uuid $$,
  $$ values ('a1000000-0000-4000-8000-000000000003'::uuid) $$,
  'a participant listed twice counts once'
);
select results_eq(
  $$ select g.notes, g.member_ids from public.get_event_occurrence(current_setting('test.nuoto')::uuid, '2026-10-20') g $$,
  $$ values (E'Portare la cuffia\n  e gli occhialini', array['a1000000-0000-4000-8000-000000000003']::uuid[]) $$,
  'the detail of an occurrence carries the notes'
);
select lives_ok(
  $$ select set_config('test.empty', public.create_event(
       'Senza persone', '2026-10-21 10:00+02', '2026-10-21 11:00+02', 'busy', array[]::uuid[]
     )::text, true) $$,
  'an empty list of participants adds nobody'
);
select is(
  (select count(*)::int from public.event_members em where em.event_id = current_setting('test.empty')::uuid),
  0,
  'no participant for an empty list'
);
select is(
  (select e.notes from public.events e where e.id = current_setting('test.empty')::uuid),
  null,
  'notes not sent are null'
);
select lives_ok(
  $$ delete from public.events e where e.id = current_setting('test.empty')::uuid $$,
  'the returned id lets the author delete the event («Annulla»)'
);
select is_empty(
  $$ select 1 from public.events e where e.id = current_setting('test.empty')::uuid $$,
  'the event is gone'
);

-- Atomicity and isolation.
select throws_ok(
  $$ select public.create_event(
       'Con Leo', '2026-10-22 10:00+02', '2026-10-22 11:00+02', 'household',
       array['a1000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000003']::uuid[]
     ) $$,
  '23503', null,
  'a participant of another household makes the call fail'
);
select is_empty(
  $$ select 1 from public.events e where e.title = 'Con Leo' $$,
  'nothing was created by the failed call (not even the event)'
);
select throws_ok(
  $$ select public.create_event(
       'Con Anna', '2026-10-22 10:00+02', '2026-10-22 11:00+02', 'household',
       array['a1000000-0000-4000-8000-000000000003']::uuid[], null, 'b1000000-0000-4000-8000-000000000004'
     ) $$,
  '23514', 'the escort must be an adult of the household',
  'an escort of another household is refused (same error as for a child: nothing about the other household)'
);
select throws_ok(
  $$ select public.create_event(
       'Con nessuno', '2026-10-22 10:00+02', '2026-10-22 11:00+02', 'household', array[null]::uuid[]
     ) $$,
  '22023', null,
  'a list with null is refused'
);

-- Limits.
select throws_ok(
  $$ select public.create_event(repeat('a', 101), '2026-10-22 10:00+02', '2026-10-22 11:00+02', 'household', array[]::uuid[]) $$,
  '23514', null,
  'a title of 101 characters is refused'
);
select throws_ok(
  $$ select public.create_event('Note lunghe', '2026-10-22 10:00+02', '2026-10-22 11:00+02', 'household',
       array[]::uuid[], null, null, 'none', null, null, repeat('n', 501)) $$,
  '23514', null,
  'notes of 501 characters are refused'
);
select lives_ok(
  $$ select set_config('test.long', public.create_event('Note giuste', '2026-10-22 10:00+02', '2026-10-22 11:00+02', 'household',
       array[]::uuid[], null, null, 'none', null, null, repeat('n', 500))::text, true) $$,
  'notes of 500 characters are accepted'
);
select lives_ok(
  $$ select set_config('test.blank', public.create_event('Note vuote', '2026-10-22 10:00+02', '2026-10-22 11:00+02', 'household',
       array[]::uuid[], null, null, 'none', null, null, E'  \n \t ')::text, true) $$,
  'notes with only whitespace are accepted'
);
select is(
  (select e.notes from public.events e where e.id = current_setting('test.blank')::uuid),
  null,
  'notes with only whitespace become null'
);
select throws_ok(
  $$ select public.create_event('Settimana lunga', '2026-10-20 10:00+02', '2026-10-28 10:00+01', 'household',
       array[]::uuid[], null, null, 'weekly', '{2}') $$,
  '23514',
  'new row for relation "events" violates check constraint "events_repeated_duration"',
  'a repeated event longer than 7 days is refused with the name of the constraint'
);
select throws_ok(
  $$ select public.create_event('Accompagna Sofia', '2026-10-22 10:00+02', '2026-10-22 11:00+02', 'household',
       array[]::uuid[], null, 'a1000000-0000-4000-8000-000000000003') $$,
  '23514', null,
  'a child cannot be the escort'
);

-- Only POST through the Data API.
set local request.method to 'GET';
select throws_ok(
  $$ select public.create_event('Con GET', '2026-10-22 10:00+02', '2026-10-22 11:00+02', 'household', array[]::uuid[]) $$,
  'P0001', 'use POST',
  'create_event refuses GET (the texts would end up in the URL)'
);
set local request.method to 'HEAD';
select throws_ok(
  $$ select public.create_event('Con GET', '2026-10-22 10:00+02', '2026-10-22 11:00+02', 'household', array[]::uuid[]) $$,
  'P0001', 'use POST',
  'create_event refuses HEAD'
);
set local request.method to 'POST';

-- ---------------------------------------------------------------------------
-- Paolo (B2): an «Occupato» with Giulia; the author is always the caller
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok(
  $$ select set_config('test.busy', public.create_event(
       'Riunione', '2026-10-20 09:00+02', '2026-10-20 10:00+02', 'busy',
       array['b1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000001']::uuid[]
     )::text, true) $$,
  'B2 creates an «Occupato» with B'
);
select results_eq(
  $$ select e.household_id, e.author_member_id, e.visibility::text from public.events e where e.id = current_setting('test.busy')::uuid $$,
  $$ values ('22222222-2222-4222-8222-222222222222'::uuid, 'b1000000-0000-4000-8000-000000000002'::uuid, 'busy') $$,
  'the event of B2 belongs to Casa Bianchi with B2 as author'
);

-- B (other household) cannot read the notes of A.
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select is_empty(
  $$ select e.notes from public.events e where e.id = current_setting('test.nuoto')::uuid $$,
  'B does not read the notes of an event of A'
);

-- ---------------------------------------------------------------------------
-- Users without household and anonymous users
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select public.create_event('Senza Nest', '2026-10-22 10:00+02', '2026-10-22 11:00+02', 'household', array[]::uuid[]) $$,
  '42501', null,
  'a user without household cannot create events'
);

reset role;
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok(
  $$ select public.create_event('Anonimo', '2026-10-22 10:00+02', '2026-10-22 11:00+02', 'household', array[]::uuid[]) $$,
  '42501', null,
  'anonymous users cannot call create_event'
);

reset role;
select is(
  (select count(*)::int from public.events e where e.title in ('Senza Nest', 'Anonimo', 'Con GET', 'Con nessuno', 'Con Anna')),
  0,
  'no refused call created anything'
);

select * from finish();
rollback;
