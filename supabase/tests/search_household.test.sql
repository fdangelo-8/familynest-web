-- search_household(): privacy, isolation, limits and arguments (issue #230, for page #40
-- Ricerca).
-- Seed ids: A = Marco (Casa D'Angelo), B = Giulia (Casa Bianchi), B2 = Paolo (Casa
-- Bianchi), C = Chiara (no household). Members: Giulia b1…01, Paolo b1…02, Leo b1…03
-- (child), Anna b1…04 (adult without account); Marco a1…01.
-- The caller is Giulia unless said otherwise; «the others» is Paolo. Every row is
-- inserted by the database owner with fixed ids and authors, with days counted from
-- today (Europe/Rome), so the default window (from now, 365 days) holds them. The words
-- «zumba», «ritmo» and «caffe» are not in the seed. No health data (D1).
begin;
create extension if not exists pgtap with schema extensions;

select plan(79);

-- ---------------------------------------------------------------------------
-- Data
-- ---------------------------------------------------------------------------

-- Casa Bianchi events.
insert into public.events (
  id, household_id, author_member_id, title, location, notes, starts_at, ends_at, visibility,
  escort_member_id, recurrence, recurrence_weekdays, recurrence_until
)
select
  v.id::uuid, '22222222-2222-4222-8222-222222222222', v.author::uuid, v.title, v.location, v.notes,
  (((now() at time zone 'Europe/Rome')::date + v.day) + v.starts::time) at time zone 'Europe/Rome',
  (((now() at time zone 'Europe/Rome')::date + v.day) + v.ends::time) at time zone 'Europe/Rome',
  v.visibility::public.event_visibility, v.escort::uuid, v.recurrence::public.event_recurrence,
  v.weekdays::smallint[], null
from (
  values
    -- Every day from tomorrow, «Tutto il Nest», with Leo, escorted by Anna.
    ('b9000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'Zumba Leo',
     'Palestra', 'Appunto della serie', 1, '17:00', '18:30', 'household', 'b1000000-0000-4000-8000-000000000004',
     'weekly', '{1,2,3,4,5,6,7}'),
    -- «Solo io» of Paolo, without Giulia.
    ('b9000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000002', 'Zumba privata',
     'Casa di Paolo', null, 2, '09:00', '10:00', 'private', null, 'none', null),
    -- «Occupato» of Paolo, with Leo and escorted by Anna.
    ('b9000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000002', 'Zumba occupato',
     'Luogo riservato', 'Appunto riservato', 6, '10:00', '11:00', 'busy', 'b1000000-0000-4000-8000-000000000004',
     'none', null),
    -- «Solo io» of Paolo with Giulia participant.
    ('b9000000-0000-4000-8000-000000000004', 'b1000000-0000-4000-8000-000000000002', 'Zumba insieme',
     null, null, 7, '12:00', '13:00', 'private', null, 'none', null),
    -- «Solo io» of Paolo escorted by Giulia.
    ('b9000000-0000-4000-8000-000000000005', 'b1000000-0000-4000-8000-000000000002', 'Zumba accompagnata',
     null, null, 8, '12:00', '13:00', 'private', 'b1000000-0000-4000-8000-000000000001', 'none', null),
    -- «Tutto il Nest», ended yesterday.
    ('b9000000-0000-4000-8000-000000000006', 'b1000000-0000-4000-8000-000000000001', 'Zumba passata',
     null, null, -1, '09:00', '10:00', 'household', null, 'none', null),
    -- «Occupato» of Giulia herself: she sees it in full.
    ('b9000000-0000-4000-8000-000000000007', 'b1000000-0000-4000-8000-000000000001', 'Zumba mia occupata',
     null, null, 9, '08:00', '09:00', 'busy', null, 'none', null)
) as v (id, author, title, location, notes, day, starts, ends, visibility, escort, recurrence, weekdays);

-- Paolo's «Occupato» event repeated every day for a month (period searches).
insert into public.events (
  id, household_id, author_member_id, title, starts_at, ends_at, visibility, recurrence, recurrence_weekdays
)
values (
  'b9000000-0000-4000-8000-000000000008', '22222222-2222-4222-8222-222222222222',
  'b1000000-0000-4000-8000-000000000002', 'Turno occupato',
  (((now() at time zone 'Europe/Rome')::date + 1) + time '06:00') at time zone 'Europe/Rome',
  (((now() at time zone 'Europe/Rome')::date + 1) + time '07:00') at time zone 'Europe/Rome',
  'busy', 'weekly', '{1,2,3,4,5,6,7}'
);

-- 25 «Tutto il Nest» events «Ritmo 01» … «Ritmo 25», one per day from tomorrow.
insert into public.events (household_id, author_member_id, title, starts_at, ends_at, visibility)
select
  '22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000001', 'Ritmo ' || lpad(n::text, 2, '0'),
  (((now() at time zone 'Europe/Rome')::date + n) + time '20:00') at time zone 'Europe/Rome',
  (((now() at time zone 'Europe/Rome')::date + n) + time '21:00') at time zone 'Europe/Rome',
  'household'
from generate_series(1, 25) as n;

-- Leo first: the result follows the order of the members (Giulia, then Leo).
insert into public.event_members (event_id, member_id, household_id)
values
  ('b9000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222222'),
  ('b9000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222'),
  ('b9000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222222'),
  ('b9000000-0000-4000-8000-000000000004', 'b1000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222');

-- «Zumba Leo»: the occurrence of day 2 removed, day 3 renamed «Zumba gara» (own place),
-- day 4 renamed «Ballo» (no longer «zumba»).
insert into public.event_exceptions (
  event_id, household_id, occurrence_date, is_cancelled, title, location, notes, starts_at, ends_at
)
values
  ('b9000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222',
   (now() at time zone 'Europe/Rome')::date + 2, true, null, null, null, null, null),
  ('b9000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222',
   (now() at time zone 'Europe/Rome')::date + 3, false, 'Zumba gara', 'Palazzetto', 'Appunto della gara',
   (((now() at time zone 'Europe/Rome')::date + 3) + time '15:00') at time zone 'Europe/Rome',
   (((now() at time zone 'Europe/Rome')::date + 3) + time '16:00') at time zone 'Europe/Rome'),
  ('b9000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222',
   (now() at time zone 'Europe/Rome')::date + 4, false, 'Ballo', null, null,
   (((now() at time zone 'Europe/Rome')::date + 4) + time '17:00') at time zone 'Europe/Rome',
   (((now() at time zone 'Europe/Rome')::date + 4) + time '18:30') at time zone 'Europe/Rome');

-- «Occupato» of Paolo with Giulia participant: she sees it in full.
insert into public.events (id, household_id, author_member_id, title, starts_at, ends_at, visibility)
values (
  'b9000000-0000-4000-8000-000000000009', '22222222-2222-4222-8222-222222222222',
  'b1000000-0000-4000-8000-000000000002', 'Zumba occupato con Giulia',
  (((now() at time zone 'Europe/Rome')::date + 7) + time '15:00') at time zone 'Europe/Rome',
  (((now() at time zone 'Europe/Rome')::date + 7) + time '16:00') at time zone 'Europe/Rome',
  'busy'
);
insert into public.event_members (event_id, member_id, household_id)
values ('b9000000-0000-4000-8000-000000000009', 'b1000000-0000-4000-8000-000000000001',
        '22222222-2222-4222-8222-222222222222');

-- «Pilates»: weekly from day 20 for 3 weeks; the occurrence of day 27 moved to day 3
-- (an occurrence moved into a period from far away).
insert into public.events (
  id, household_id, author_member_id, title, starts_at, ends_at, visibility, recurrence, recurrence_weekdays,
  recurrence_until
)
values (
  'b9000000-0000-4000-8000-000000000010', '22222222-2222-4222-8222-222222222222',
  'b1000000-0000-4000-8000-000000000001', 'Pilates',
  (((now() at time zone 'Europe/Rome')::date + 20) + time '18:00') at time zone 'Europe/Rome',
  (((now() at time zone 'Europe/Rome')::date + 20) + time '19:00') at time zone 'Europe/Rome',
  'household', 'weekly', array[extract(isodow from (now() at time zone 'Europe/Rome')::date + 20)::smallint], (now() at time zone 'Europe/Rome')::date + 41
);
insert into public.event_exceptions (
  event_id, household_id, occurrence_date, is_cancelled, title, starts_at, ends_at
)
values (
  'b9000000-0000-4000-8000-000000000010', '22222222-2222-4222-8222-222222222222', (now() at time zone 'Europe/Rome')::date + 27, false,
  'Pilates spostato',
  (((now() at time zone 'Europe/Rome')::date + 3) + time '19:00') at time zone 'Europe/Rome',
  (((now() at time zone 'Europe/Rome')::date + 3) + time '20:00') at time zone 'Europe/Rome'
);

-- Casa D'Angelo: an event, a thing to do, a deadline and a shopping item with «zumba».
insert into public.events (id, household_id, author_member_id, title, starts_at, ends_at, visibility)
values (
  'a9000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
  'a1000000-0000-4000-8000-000000000001', 'Zumba Marco',
  (((now() at time zone 'Europe/Rome')::date + 2) + time '17:00') at time zone 'Europe/Rome',
  (((now() at time zone 'Europe/Rome')::date + 2) + time '18:00') at time zone 'Europe/Rome',
  'household'
);
insert into public.todos (id, household_id, title, created_by_member_id, created_at)
values ('a9100000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Zumba di Marco',
        'a1000000-0000-4000-8000-000000000001', now());
insert into public.deadlines (id, household_id, title, due_date, created_by_member_id, created_at)
values ('a9200000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Zumba scadenza Marco',
        (now() at time zone 'Europe/Rome')::date + 6, 'a1000000-0000-4000-8000-000000000001', now());
insert into public.shopping_items (id, household_id, name, added_by_member_id, created_at)
values ('a9300000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Zumba spesa Marco',
        'a1000000-0000-4000-8000-000000000001', now());

-- Casa Bianchi things to do.
insert into public.todos (
  id, household_id, title, created_by_member_id, assignee_member_id, for_member_id, due_date, is_private,
  done_at, done_by_member_id, created_at
)
values
  ('b9100000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'Zumba da fare',
   'b1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002', null,
   (now() at time zone 'Europe/Rome')::date + 6, false, null, null, now() - interval '5 minutes'),
  ('b9100000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', 'Zumba regalo',
   'b1000000-0000-4000-8000-000000000002', null, null,
   (now() at time zone 'Europe/Rome')::date + 6, true, null, null, now() - interval '4 minutes'),
  ('b9100000-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222222', 'Zumba mia',
   'b1000000-0000-4000-8000-000000000001', null, null,
   null, true, null, null, now() - interval '3 minutes'),
  ('b9100000-0000-4000-8000-000000000004', '22222222-2222-4222-8222-222222222222', 'Zumba fatta',
   'b1000000-0000-4000-8000-000000000001', null, null,
   null, false, now() - interval '1 hour', 'b1000000-0000-4000-8000-000000000001', now() - interval '2 minutes'),
  ('b9100000-0000-4000-8000-000000000005', '22222222-2222-4222-8222-222222222222', 'Scarpe per zumba',
   'b1000000-0000-4000-8000-000000000001', null, 'b1000000-0000-4000-8000-000000000003',
   null, false, null, null, now() - interval '1 minute'),
  ('b9100000-0000-4000-8000-000000000006', '22222222-2222-4222-8222-222222222222', 'Caffè per la riunione',
   'b1000000-0000-4000-8000-000000000001', null, null,
   null, false, null, null, now());

-- Casa Bianchi deadlines.
insert into public.deadlines (
  id, household_id, title, due_date, note, created_by_member_id, assignee_member_id, for_member_id,
  is_private, created_at
)
values
  ('b9200000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'Zumba abbonamento',
   (now() at time zone 'Europe/Rome')::date + 6, null, 'b1000000-0000-4000-8000-000000000002', null, null,
   true, now() - interval '3 minutes'),
  ('b9200000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', 'Zumba iscrizione',
   (now() at time zone 'Europe/Rome')::date + 6, 'Appunto della scadenza', 'b1000000-0000-4000-8000-000000000001',
   null, 'b1000000-0000-4000-8000-000000000003', false, now() - interval '2 minutes'),
  ('b9200000-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222222', 'Zumba vecchia',
   (now() at time zone 'Europe/Rome')::date - 30, null, 'b1000000-0000-4000-8000-000000000001', null, null,
   false, now() - interval '1 minute');

-- Casa Bianchi shopping: 25 to buy «Zumba 01» … «Zumba 25» (oldest first), one taken.
insert into public.shopping_items (household_id, name, quantity, added_by_member_id, checked_at, created_at)
select
  '22222222-2222-4222-8222-222222222222', 'Zumba ' || lpad(n::text, 2, '0'), case when n = 1 then '2 litri' end,
  'b1000000-0000-4000-8000-000000000001', null, now() - interval '1 hour' + n * interval '1 minute'
from generate_series(1, 25) as n;
insert into public.shopping_items (household_id, name, added_by_member_id, checked_at, created_at)
values ('22222222-2222-4222-8222-222222222222', 'Zumba presa', 'b1000000-0000-4000-8000-000000000001',
        now(), now() - interval '2 hours');

-- ---------------------------------------------------------------------------
-- The function
-- ---------------------------------------------------------------------------
select has_function(
  'public', 'search_household',
  array['text', 'uuid', 'date', 'date', 'search_result_kind[]'],
  'search_household exists'
);
select ok(
  (select p.prosecdef from pg_proc p
   where p.oid = 'public.search_household(text, uuid, date, date, public.search_result_kind[])'::regprocedure),
  'search_household is security definer (search_path checked in 00_schema)'
);
select ok(
  not has_function_privilege('anon', 'public.search_household(text, uuid, date, date, public.search_result_kind[])', 'execute'),
  'anon cannot execute search_household'
);
select ok(
  has_function_privilege('authenticated', 'public.search_household(text, uuid, date, date, public.search_result_kind[])', 'execute'),
  'authenticated can execute search_household'
);
select ok(
  not has_function_privilege('authenticated', 'private.search_matches(text, text[])', 'execute')
  and not has_function_privilege('authenticated', 'private.search_normalize(text)', 'execute')
  and not has_function_privilege('authenticated', 'private.household_event_rows_for_member(uuid, timestamptz, timestamptz)', 'execute')
  and not has_function_privilege('anon', 'private.household_event_rows_for_member(uuid, timestamptz, timestamptz)', 'execute')
  and not has_function_privilege('authenticated', 'private.household_events_for_member(uuid, timestamptz, timestamptz)', 'execute'),
  'the helpers and the rows of the calendar are not executable by the API roles'
);
select is_empty(
  $$
    select a.name
    from pg_proc p
    cross join lateral unnest(p.proargnames) as a (name)
    where p.oid = 'public.search_household(text, uuid, date, date, public.search_result_kind[])'::regprocedure
      and a.name ~ '(note|reminder|done)'
  $$,
  'no column for notes, reminders or who marked done'
);

-- ---------------------------------------------------------------------------
-- Anonymous: no privilege at all
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
set local request.method to 'POST';
select throws_ok(
  $$ select * from public.search_household('zumba') $$,
  '42501', null,
  'anonymous callers cannot search'
);
reset role;

-- ---------------------------------------------------------------------------
-- Only POST, before reading anything
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';

set local request.method to 'GET';
select throws_ok($$ select * from public.search_household('zumba') $$, 'P0001', 'use POST', 'GET is refused');
set local request.method to 'HEAD';
select throws_ok($$ select * from public.search_household('zumba') $$, 'P0001', 'use POST', 'HEAD is refused');
set local request.method to 'PUT';
select throws_ok($$ select * from public.search_household('zumba') $$, 'P0001', 'use POST', 'PUT is refused');
set local request.method to 'PATCH';
select throws_ok($$ select * from public.search_household('zumba') $$, 'P0001', 'use POST', 'PATCH is refused');
set local request.method to 'DELETE';
select throws_ok($$ select * from public.search_household('zumba') $$, 'P0001', 'use POST', 'DELETE is refused');
set local request.method to 'post';
select throws_ok($$ select * from public.search_household('zumba') $$, 'P0001', 'use POST', 'lower case post is refused');
set local request.method to 'GET';
select throws_ok(
  $$ select * from public.search_household(repeat('x', 500)) $$,
  'P0001', 'use POST',
  'GET is refused before the arguments are checked'
);
set local request.method to 'POST';

-- ---------------------------------------------------------------------------
-- Arguments
-- ---------------------------------------------------------------------------
select throws_ok($$ select * from public.search_household(repeat('a', 101)) $$, '22023', null, '101 characters are refused');
select lives_ok($$ select * from public.search_household(repeat('a', 100)) $$, '100 characters are accepted');
select throws_ok($$ select * from public.search_household('z') $$, '22023', null, 'one character is refused');
select throws_ok($$ select * from public.search_household('  z  ') $$, '22023', null, 'one character between spaces is refused');
select throws_ok($$ select * from public.search_household() $$, '22023', 'nothing to search', 'nothing to search is refused');
select throws_ok($$ select * from public.search_household('   ') $$, '22023', 'nothing to search', 'only spaces is nothing to search');
select throws_ok(
  $$ select * from public.search_household(p_from => current_date) $$,
  '22023', null, 'half a period is refused'
);
select throws_ok(
  $$ select * from public.search_household(p_from => current_date, p_to => current_date - 1) $$,
  '22023', null, 'a reversed period is refused'
);
select throws_ok(
  $$ select * from public.search_household(p_from => current_date, p_to => current_date + 400) $$,
  '22023', null, 'a period of 401 days is refused'
);
select lives_ok(
  $$ select * from public.search_household(p_from => current_date, p_to => current_date + 399) $$,
  'a period of 400 days is accepted'
);
select throws_ok(
  $$ select * from public.search_household('zumba', p_kinds => array['event', null]::public.search_result_kind[]) $$,
  '22023', null, 'a null kind is refused'
);

-- ---------------------------------------------------------------------------
-- Events with a text
-- ---------------------------------------------------------------------------
select results_eq(
  $$
    select title, occurrence_day - (now() at time zone 'Europe/Rome')::date
    from public.search_household('zumba', p_kinds => array['event']::public.search_result_kind[])
    order by sort_index
  $$,
  $$
    values
      ('Zumba Leo'::text, 1),
      ('Zumba gara', 3),
      ('Zumba Leo', 5),
      ('Zumba insieme', 7),
      ('Zumba occupato con Giulia', 7),
      ('Zumba accompagnata', 8),
      ('Zumba mia occupata', 9)
  $$,
  'zumba: 3 occurrences of the series (removed day 2 and renamed day 4 skipped), the «Solo io» with Giulia, her own «Occupato»; never the «Solo io» or «Occupato» of Paolo, nor the past event'
);
select is(
  (select count(*)::integer from public.search_household('zumba') where is_masked),
  0,
  'zumba: no masked row (the «Occupato» of Paolo matches the title, but is never compared)'
);
select is(
  (select count(*)::integer from public.search_household('occupat', p_kinds => array['event']::public.search_result_kind[])),
  2,
  'occupat: Giulia''s own «Occupato» and the one she takes part in («Zumba occupato» and «Turno occupato» of Paolo never)'
);
select is(
  (select count(*)::integer
   from public.search_household(
     'zumba',
     p_from => (now() at time zone 'Europe/Rome')::date,
     p_to => (now() at time zone 'Europe/Rome')::date + 10,
     p_kinds => array['event']::public.search_result_kind[])
   where is_masked or title is null),
  0,
  'zumba with a period: still no «Occupato» of the others'
);
select is(
  (select count(*)::integer
   from public.search_household(
     'zumba',
     p_member_id => 'b1000000-0000-4000-8000-000000000002',
     p_kinds => array['event']::public.search_result_kind[])),
  3,
  'zumba with Paolo: only his events Giulia is part of, never his other «Occupato»'
);
select results_eq(
  $$
    select id, title, location, visibility, is_masked, author_member_id, member_ids, escort_member_id,
           recurrence, recurrence_weekdays, series_starts_on - (now() at time zone 'Europe/Rome')::date,
           ends_at - starts_at
    from public.search_household('zumba', p_kinds => array['event']::public.search_result_kind[])
    where sort_index = 1
  $$,
  $$
    values (
      'b9000000-0000-4000-8000-000000000001'::uuid, 'Zumba Leo'::text, 'Palestra'::text,
      'household'::public.event_visibility, false, 'b1000000-0000-4000-8000-000000000001'::uuid,
      array['b1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000003']::uuid[],
      'b1000000-0000-4000-8000-000000000004'::uuid, 'weekly'::public.event_recurrence,
      '{1,2,3,4,5,6,7}'::smallint[], 1, interval '1 hour 30 minutes'
    )
  $$,
  'a full row: id, title, place, author, participants in the order of the household, escort, repetition and first day of the series'
);
select results_eq(
  $$
    select title, location, ends_at - starts_at
    from public.search_household('gara', p_kinds => array['event']::public.search_result_kind[])
  $$,
  $$ values ('Zumba gara'::text, 'Palazzetto'::text, interval '1 hour') $$,
  'a modified occurrence has its own title, place and times'
);
select is_empty(
  $$ select 1 from public.search_household('ballo zumba', p_kinds => array['event']::public.search_result_kind[]) $$,
  'every word must be in the title of the occurrence («Ballo» no longer has «zumba»)'
);
select is(
  (select count(*)::integer from public.search_household('LEO zUmB', p_kinds => array['event']::public.search_result_kind[])),
  3,
  'words in any order, any case, also inside a word: the 3 first occurrences that still have «Leo» (days 1, 5, 6)'
);
select is_empty(
  $$ select 1 from public.search_household('palestra', p_kinds => array['event']::public.search_result_kind[]) $$,
  'places are not searched'
);
select is_empty(
  $$ select 1 from public.search_household('appunto') $$,
  'notes are not searched'
);
select is_empty(
  $$ select 1 from public.search_household('%%') $$,
  '«%» is a plain character, not a wildcard'
);
select is_empty(
  $$ select 1 from public.search_household('__') $$,
  '«_» is a plain character, not a wildcard'
);
select is(
  (select count(*)::integer from public.search_household('ritmo', p_kinds => array['event']::public.search_result_kind[])),
  20,
  'at most 20 events'
);
select results_eq(
  $$
    select sort_index, title
    from public.search_household('ritmo', p_kinds => array['event']::public.search_result_kind[])
    where sort_index in (1, 20)
    order by sort_index
  $$,
  $$ values (1, 'Ritmo 01'::text), (20, 'Ritmo 20'::text) $$,
  'the first 20 by start'
);

-- ---------------------------------------------------------------------------
-- Events without a text: «Occupato» of the others masked
-- ---------------------------------------------------------------------------
select results_eq(
  $$
    select id, title, location, member_ids, escort_member_id, recurrence, recurrence_weekdays, series_starts_on,
           visibility, is_masked, author_member_id, occurrence_day - (now() at time zone 'Europe/Rome')::date,
           ends_at - starts_at
    from public.search_household(
      p_from => (now() at time zone 'Europe/Rome')::date + 6,
      p_to => (now() at time zone 'Europe/Rome')::date + 6,
      p_kinds => array['event']::public.search_result_kind[])
    where is_masked and starts_at = (((now() at time zone 'Europe/Rome')::date + 6) + time '10:00') at time zone 'Europe/Rome'
  $$,
  $$
    values (
      null::uuid, null::text, null::text, null::uuid[], null::uuid, null::public.event_recurrence, null::smallint[],
      null::date, null::public.event_visibility, true, 'b1000000-0000-4000-8000-000000000002'::uuid, 6,
      interval '1 hour'
    )
  $$,
  'a period: the «Occupato» of Paolo is a masked row with only start, end, day and author (no visibility)'
);
select is(
  (select count(*)::integer
   from public.search_household(
     p_from => (now() at time zone 'Europe/Rome')::date,
     p_to => (now() at time zone 'Europe/Rome')::date + 30,
     p_kinds => array['event']::public.search_result_kind[])
   where is_masked),
  4,
  'a period: masked rows, at most 3 occurrences also for a masked series (one + three)'
);
select is(
  (select count(*)::integer
   from public.search_household(
     p_from => (now() at time zone 'Europe/Rome')::date + 2,
     p_to => (now() at time zone 'Europe/Rome')::date + 2,
     p_kinds => array['event']::public.search_result_kind[])
   where title in ('Zumba privata')),
  0,
  'a period: the «Solo io» of Paolo never'
);
select is(
  (select count(*)::integer
   from public.search_household(
     p_from => (now() at time zone 'Europe/Rome')::date + 2,
     p_to => (now() at time zone 'Europe/Rome')::date + 2,
     p_kinds => array['event']::public.search_result_kind[])),
  2,
  'a period of one day: the occurrence of the series is removed on that day; Ritmo 02 and the masked Turno, nothing private'
);
select is(
  (select count(*)::integer
   from public.search_household(
     p_member_id => 'b1000000-0000-4000-8000-000000000002',
     p_kinds => array['event']::public.search_result_kind[])
   where is_masked),
  4,
  'Paolo as the person: his «Occupato» events as masked rows (one + three of the series)'
);
select is(
  (select count(*)::integer
   from public.search_household(
     p_member_id => 'b1000000-0000-4000-8000-000000000002',
     p_kinds => array['event']::public.search_result_kind[])
   where is_masked and (id is not null or title is not null or location is not null or member_ids is not null
                        or escort_member_id is not null)),
  0,
  'Paolo as the person: masked rows without id, title, place, participants or escort'
);
select is(
  (select count(*)::integer
   from public.search_household(
     p_member_id => 'b1000000-0000-4000-8000-000000000003',
     p_kinds => array['event']::public.search_result_kind[])
   where is_masked),
  0,
  'Leo as the person: masked rows only for their author (Leo takes part in the «Occupato» of Paolo)'
);
select results_eq(
  $$
    select title
    from public.search_household(
      p_member_id => 'b1000000-0000-4000-8000-000000000003',
      p_kinds => array['event']::public.search_result_kind[])
    order by sort_index
  $$,
  $$ values ('Zumba Leo'::text), ('Zumba gara'), ('Ballo') $$,
  'Leo as the person: the first 3 occurrences of the series he takes part in, removed one skipped'
);
select is(
  (select count(*)::integer
   from public.search_household(
     p_member_id => 'b1000000-0000-4000-8000-000000000004',
     p_kinds => array['event']::public.search_result_kind[])),
  3,
  'Anna as the person: the escort of the series (the «Occupato» she escorts stays hidden)'
);
select is(
  (select count(*)::integer
   from public.search_household(
     'zumba',
     p_from => (now() at time zone 'Europe/Rome')::date - 1,
     p_to => (now() at time zone 'Europe/Rome')::date - 1,
     p_kinds => array['event']::public.search_result_kind[])),
  1,
  'a period includes its past part (the event of yesterday)'
);

-- ---------------------------------------------------------------------------
-- Deadlines, things to do, shopping
-- ---------------------------------------------------------------------------
select results_eq(
  $$
    select title, due_date - (now() at time zone 'Europe/Rome')::date, is_private, for_member_id
    from public.search_household('zumba', p_kinds => array['deadline']::public.search_result_kind[])
    order by sort_index
  $$,
  $$
    values
      ('Zumba vecchia'::text, -30, false, null::uuid),
      ('Zumba iscrizione', 6, false, 'b1000000-0000-4000-8000-000000000003'::uuid)
  $$,
  'deadlines: also past ones, by due date; never the «Solo io» of Paolo'
);
select results_eq(
  $$
    select title, is_private
    from public.search_household('zumba', p_kinds => array['todo']::public.search_result_kind[])
    order by sort_index
  $$,
  $$ values ('Zumba da fare'::text, false), ('Zumba mia', true), ('Scarpe per zumba', false) $$,
  'things to do: only to do, her own «Solo io», without date last; never the «Solo io» of Paolo nor the done one'
);
select results_eq(
  $$
    select sort_index, title, quantity
    from public.search_household('zumba', p_kinds => array['shopping_item']::public.search_result_kind[])
    where sort_index in (1, 20)
    order by sort_index
  $$,
  $$ values (1, 'Zumba 01'::text, '2 litri'::text), (20, 'Zumba 20', null) $$,
  'shopping: at most 20, oldest first, with the quantity; the taken one never'
);
select is(
  (select count(*)::integer from public.search_household('zumba', p_kinds => array['shopping_item']::public.search_result_kind[])),
  20,
  'shopping: 20 rows out of 25'
);
select results_eq(
  $$ select distinct kind from public.search_household('zumba') order by kind $$,
  $$ values ('event'::public.search_result_kind), ('deadline'), ('todo'), ('shopping_item') $$,
  'all kinds by default'
);
select results_eq(
  $$ select kind, count(*)::integer from public.search_household('zumba') group by kind order by kind $$,
  $$
    values ('event'::public.search_result_kind, 7), ('deadline', 2), ('todo', 3), ('shopping_item', 20)
  $$,
  'zumba: counts per kind without the things of the others'
);
select is(
  (select count(*)::integer from public.search_household('zumba', p_kinds => '{}'::public.search_result_kind[])),
  0,
  'no kind: no rows'
);
select results_eq(
  $$
    select kind, title
    from public.search_household(
      p_member_id => 'b1000000-0000-4000-8000-000000000003',
      p_kinds => array['deadline', 'todo', 'shopping_item']::public.search_result_kind[])
    order by kind, sort_index
  $$,
  $$ values ('deadline'::public.search_result_kind, 'Zumba iscrizione'::text), ('todo', 'Scarpe per zumba') $$,
  'Leo as the person: «riguarda» and «per chi»; no shopping'
);
select results_eq(
  $$
    select kind, title
    from public.search_household(
      p_member_id => 'b1000000-0000-4000-8000-000000000002',
      p_kinds => array['deadline', 'todo']::public.search_result_kind[])
    order by kind, sort_index
  $$,
  $$
    values ('deadline'::public.search_result_kind, 'Revisione della caldaia'::text), ('todo', 'Zumba da fare'),
           ('todo', 'Prenotare la palestra')
  $$,
  'Paolo as the person: what he takes care of; never his «Solo io» things'
);
select results_eq(
  $$
    select kind, title
    from public.search_household(
      'zumba',
      p_from => (now() at time zone 'Europe/Rome')::date + 6,
      p_to => (now() at time zone 'Europe/Rome')::date + 6,
      p_kinds => array['deadline', 'todo', 'shopping_item']::public.search_result_kind[])
    order by kind, sort_index
  $$,
  $$ values ('deadline'::public.search_result_kind, 'Zumba iscrizione'::text), ('todo', 'Zumba da fare') $$,
  'a period: deadlines and things to do with the date in it; without date no; no shopping'
);
select results_eq(
  $$ select title from public.search_household('caffe') $$,
  $$ values ('Caffè per la riunione'::text) $$,
  'accents ignored: caffe finds Caffè (the taken Caffè of the shopping list never)'
);
select is(
  (select count(*)::integer from public.search_household('RIUNIONE caffè')),
  1,
  'riunione caffè finds it'
);
select is_empty($$ select 1 from public.search_household('caffe zumba') $$, 'caffe zumba does not find it');

-- ---------------------------------------------------------------------------
-- Equivalence with the calendar (review of PR #239): without a text and without any
-- limit reached, the events of the search are the rows of the calendar. The periods
-- cover own events, «Tutto il Nest», «Solo io» of the others, «Solo io» with the caller
-- participant and escort, «Occupato» of the others, «Occupato» with the caller
-- participant, a removed, a modified and a moved occurrence. Run as the owner (the
-- private function is not executable by the API roles), with the session of the user.
-- ---------------------------------------------------------------------------
reset role;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select bag_eq(
  $$
    select starts_at, ends_at, visibility, author_member_id, is_masked, id, title, location, escort_member_id, member_ids
    from public.search_household(
      p_from => (now() at time zone 'Europe/Rome')::date + 2, p_to => (now() at time zone 'Europe/Rome')::date + 4, p_kinds => array['event']::public.search_result_kind[])
  $$,
  $$
    select starts_at, ends_at, case when is_masked then null else visibility end, author_member_id, is_masked, id,
           title, location, escort_member_id, member_ids
    from private.household_events_for_member(
      'b1000000-0000-4000-8000-000000000001',
      ((now() at time zone 'Europe/Rome')::date + 2)::timestamp at time zone 'Europe/Rome',
      ((now() at time zone 'Europe/Rome')::date + 5)::timestamp at time zone 'Europe/Rome')
  $$,
  'equivalence with the calendar: Giulia, days 2 to 4'
);
select is(
  (select count(*)::integer
   from public.search_household(
     p_from => (now() at time zone 'Europe/Rome')::date + 2, p_to => (now() at time zone 'Europe/Rome')::date + 4, p_kinds => array['event']::public.search_result_kind[])),
  9,
  'equivalence with the calendar: Giulia, days 2 to 4 has rows (no limit reached)'
);
select bag_eq(
  $$
    select starts_at, ends_at, visibility, author_member_id, is_masked, id, title, location, escort_member_id, member_ids
    from public.search_household(
      p_from => (now() at time zone 'Europe/Rome')::date + 6, p_to => (now() at time zone 'Europe/Rome')::date + 8, p_kinds => array['event']::public.search_result_kind[])
  $$,
  $$
    select starts_at, ends_at, case when is_masked then null else visibility end, author_member_id, is_masked, id,
           title, location, escort_member_id, member_ids
    from private.household_events_for_member(
      'b1000000-0000-4000-8000-000000000001',
      ((now() at time zone 'Europe/Rome')::date + 6)::timestamp at time zone 'Europe/Rome',
      ((now() at time zone 'Europe/Rome')::date + 9)::timestamp at time zone 'Europe/Rome')
  $$,
  'equivalence with the calendar: Giulia, days 6 to 8'
);
select is(
  (select count(*)::integer
   from public.search_household(
     p_from => (now() at time zone 'Europe/Rome')::date + 6, p_to => (now() at time zone 'Europe/Rome')::date + 8, p_kinds => array['event']::public.search_result_kind[])),
  13,
  'equivalence with the calendar: Giulia, days 6 to 8 has rows (no limit reached)'
);
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select bag_eq(
  $$
    select starts_at, ends_at, visibility, author_member_id, is_masked, id, title, location, escort_member_id, member_ids
    from public.search_household(
      p_from => (now() at time zone 'Europe/Rome')::date + 2, p_to => (now() at time zone 'Europe/Rome')::date + 4, p_kinds => array['event']::public.search_result_kind[])
  $$,
  $$
    select starts_at, ends_at, case when is_masked then null else visibility end, author_member_id, is_masked, id,
           title, location, escort_member_id, member_ids
    from private.household_events_for_member(
      'b1000000-0000-4000-8000-000000000002',
      ((now() at time zone 'Europe/Rome')::date + 2)::timestamp at time zone 'Europe/Rome',
      ((now() at time zone 'Europe/Rome')::date + 5)::timestamp at time zone 'Europe/Rome')
  $$,
  'equivalence with the calendar: Paolo, days 2 to 4'
);
select bag_eq(
  $$
    select starts_at, ends_at, visibility, author_member_id, is_masked, id, title, location, escort_member_id, member_ids
    from public.search_household(
      p_from => (now() at time zone 'Europe/Rome')::date + 6, p_to => (now() at time zone 'Europe/Rome')::date + 8, p_kinds => array['event']::public.search_result_kind[])
  $$,
  $$
    select starts_at, ends_at, case when is_masked then null else visibility end, author_member_id, is_masked, id,
           title, location, escort_member_id, member_ids
    from private.household_events_for_member(
      'b1000000-0000-4000-8000-000000000002',
      ((now() at time zone 'Europe/Rome')::date + 6)::timestamp at time zone 'Europe/Rome',
      ((now() at time zone 'Europe/Rome')::date + 9)::timestamp at time zone 'Europe/Rome')
  $$,
  'equivalence with the calendar: Paolo, days 6 to 8'
);
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';

-- ---------------------------------------------------------------------------
-- Isolation
-- ---------------------------------------------------------------------------
select is_empty(
  $$ select 1 from public.search_household('marco') $$,
  'Giulia never finds anything of Casa D''Angelo'
);
select is_empty(
  $$ select 1 from public.search_household(p_member_id => 'a1000000-0000-4000-8000-000000000001') $$,
  'a person of another household: 0 rows, no error'
);
select is_empty(
  $$ select 1 from public.search_household('zumba', p_member_id => '00000000-0000-4000-8000-000000000000') $$,
  'an unknown person: 0 rows, no error'
);

-- Paolo: Giulia's «Solo io» thing to do is never his.
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select results_eq(
  $$
    select title
    from public.search_household('zumba', p_kinds => array['todo']::public.search_result_kind[])
    order by sort_index
  $$,
  $$ values ('Zumba da fare'::text), ('Zumba regalo'), ('Scarpe per zumba') $$,
  'Paolo: his own «Solo io» thing to do, never Giulia''s'
);
select is(
  (select count(*)::integer from public.search_household('zumba occupato', p_kinds => array['event']::public.search_result_kind[])),
  2,
  'Paolo: his own «Occupato» events in full'
);

-- Marco (Casa D'Angelo).
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select results_eq(
  $$ select kind, title from public.search_household('zumba') order by kind, sort_index $$,
  $$
    values ('event'::public.search_result_kind, 'Zumba Marco'::text), ('deadline', 'Zumba scadenza Marco'),
           ('todo', 'Zumba di Marco'), ('shopping_item', 'Zumba spesa Marco')
  $$,
  'Marco: only the things of his household'
);
select is_empty(
  $$ select 1 from public.search_household(p_member_id => 'b1000000-0000-4000-8000-000000000002') $$,
  'Marco with a person of Casa Bianchi: 0 rows'
);
select is(
  (select count(*)::integer
   from public.search_household(
     p_from => (now() at time zone 'Europe/Rome')::date,
     p_to => (now() at time zone 'Europe/Rome')::date + 30)
   where author_member_id::text like 'b1%'),
  0,
  'Marco with a period: no masked or other row of Casa Bianchi'
);

-- Chiara: no household.
set local request.jwt.claims to '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}';
select is_empty($$ select 1 from public.search_household('zumba') $$, 'a user without household gets no rows');

-- A session without user.
set local request.jwt.claims to '{"role":"authenticated"}';
select throws_ok($$ select * from public.search_household('zumba') $$, '42501', null, 'no user: refused');

reset role;

select * from finish();
rollback;
