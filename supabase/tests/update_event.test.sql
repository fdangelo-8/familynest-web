-- update_event(): change a whole event or a repeated event from one occurrence on
-- («Salva tutti i prossimi», decision of Francesco of 30/10), in one transaction
-- (issue #109, for #19 Dettaglio impegno). Also get_event_occurrence() without a day.
-- Seed ids: A = Marco (Casa D'Angelo), B = Giulia (Casa Bianchi), B2 = Paolo (Casa
-- Bianchi). Members: Casa D'Angelo Marco a1…01, Laura a1…02 (adult without account),
-- Sofia a1…03 and Tommaso a1…04 (children); Casa Bianchi Giulia b1…01, Paolo b1…02,
-- Leo b1…03 (child), Anna b1…04 (adult without account).
-- Events are inserted by the database owner with fixed ids and authors. No health data (D1).
begin;
create extension if not exists pgtap with schema extensions;

select plan(42);

insert into public.events (
  id, household_id, author_member_id, title, location, notes, starts_at, ends_at, visibility,
  escort_member_id, recurrence, recurrence_weekdays, recurrence_until
)
values
  -- «Nuoto» every Tuesday and Thursday from 6 October, two copies.
  ('a6000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001',
   'Nuoto Sofia', 'Piscina comunale, Lissone', 'Portare la cuffia', '2026-10-06 17:00+02', '2026-10-06 18:30+02', 'household',
   'a1000000-0000-4000-8000-000000000002', 'weekly', '{2,4}', '2026-12-17'),
  ('a6000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001',
   'Nuoto Sofia', 'Piscina comunale, Lissone', 'Portare la cuffia', '2026-10-06 17:00+02', '2026-10-06 18:30+02', 'household',
   'a1000000-0000-4000-8000-000000000002', 'weekly', '{2,4}', null),
  -- «Cena» that does not repeat.
  ('a6000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001',
   'Cena', null, null, '2026-10-20 20:00+02', '2026-10-20 21:00+02', 'household',
   null, 'none', null, null),
  -- «Occupato» of Paolo with Giulia, every Monday from 5 October.
  ('b6000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000002',
   'Riunione segreta', 'Ufficio Nord', null, '2026-10-05 09:00+02', '2026-10-05 10:00+02', 'busy',
   null, 'weekly', '{1}', null),
  -- Every day at 23:00 – 23:30 from 1 January 2026 (the occurrence «now»).
  ('b6000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000001',
   'Ogni sera', null, null, '2026-01-01 23:00+01', '2026-01-01 23:30+01', 'household',
   null, 'weekly', '{1,2,3,4,5,6,7}', null);

insert into public.event_members (event_id, member_id, household_id)
values
  ('a6000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111'),
  ('a6000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111'),
  ('a6000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111'),
  ('b6000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222'),
  ('b6000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222');

-- Exceptions of the first «Nuoto»: 13 and 29 October removed, 27 October changed.
insert into public.event_exceptions (event_id, household_id, occurrence_date, is_cancelled, title, starts_at, ends_at)
values
  ('a6000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', '2026-10-13', true, null, null, null),
  ('a6000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', '2026-10-29', true, null, null, null),
  ('a6000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', '2026-10-27', false, 'Nuoto con papà',
   '2026-10-27 18:00+01', '2026-10-27 19:00+01');
-- Exceptions of the second «Nuoto»: 13 and 27 October removed, 22 October changed.
insert into public.event_exceptions (event_id, household_id, occurrence_date, is_cancelled, title, starts_at, ends_at)
values
  ('a6000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', '2026-10-13', true, null, null, null),
  ('a6000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', '2026-10-27', true, null, null, null),
  ('a6000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', '2026-10-22', false, 'Nuoto con papà',
   '2026-10-22 18:00+02', '2026-10-22 19:00+02');

select has_function(
  'public', 'update_event',
  array[
    'uuid', 'date', 'text', 'timestamp with time zone', 'timestamp with time zone', 'event_visibility', 'uuid[]',
    'text', 'uuid', 'event_recurrence', 'smallint[]', 'date', 'text'
  ],
  'update_event exists'
);
select ok(
  not (select p.prosecdef from pg_proc p where p.oid = 'public.update_event(uuid, date, text, timestamptz, timestamptz, public.event_visibility, uuid[], text, uuid, public.event_recurrence, smallint[], date, text)'::regprocedure)
  and not has_function_privilege('anon', 'public.update_event(uuid, date, text, timestamptz, timestamptz, public.event_visibility, uuid[], text, uuid, public.event_recurrence, smallint[], date, text)', 'execute')
  and has_function_privilege('authenticated', 'public.update_event(uuid, date, text, timestamptz, timestamptz, public.event_visibility, uuid[], text, uuid, public.event_recurrence, smallint[], date, text)', 'execute'),
  'update_event is security invoker and for signed-in users only'
);
select ok(
  (select p.prosecdef and p.proconfig @> array['search_path=""'] from pg_proc p where p.oid = 'private.split_event_series(uuid, date)'::regprocedure)
  and not has_function_privilege('anon', 'private.split_event_series(uuid, date)', 'execute'),
  'the split of a series is the only security definer step, with an empty search_path, not for anon'
);

-- ---------------------------------------------------------------------------
-- Marco (A): the whole series moved by one day (Tuesday and Thursday -> Wednesday and
-- Friday), from the first occurrence
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';

select is(
  public.update_event(
    'a6000000-0000-4000-8000-000000000001', '2026-10-06', 'Nuoto', '2026-10-07 17:30+02', '2026-10-07 19:00+02',
    'household', array['a1000000-0000-4000-8000-000000000003']::uuid[], 'Piscina comunale, Lissone',
    'a1000000-0000-4000-8000-000000000002', 'weekly', '{3,5}', '2026-12-18', E'Portare la cuffia\n'
  ),
  'a6000000-0000-4000-8000-000000000001'::uuid,
  'from the first occurrence the whole event changes and keeps its id'
);
select results_eq(
  $$ select e.title, e.starts_at, e.recurrence_weekdays, e.recurrence_until, e.notes from public.events e
     where e.id = 'a6000000-0000-4000-8000-000000000001' $$,
  $$ values ('Nuoto', '2026-10-07 17:30+02'::timestamptz, '{3,5}'::smallint[], '2026-12-18'::date, 'Portare la cuffia') $$,
  'the series has the new values'
);
select results_eq(
  $$ select x.occurrence_date, x.is_cancelled from public.event_exceptions x
     where x.event_id = 'a6000000-0000-4000-8000-000000000001' order by 1 $$,
  $$ values ('2026-10-14'::date, true), ('2026-10-30', true) $$,
  'removed occurrences move with the series (13 -> 14, 29 -> 30); the changed one takes the new values'
);
select is_empty(
  $$ select 1 from public.get_event_occurrence('a6000000-0000-4000-8000-000000000001', '2026-10-30')
     union all
     select 1 from public.get_event_occurrence('a6000000-0000-4000-8000-000000000001', '2026-10-20') $$,
  'Friday 30 stays removed; Tuesday 20 is not an occurrence any more'
);
select results_eq(
  $$ select g.title, g.starts_at, g.is_modified from public.get_event_occurrence('a6000000-0000-4000-8000-000000000001', '2026-10-28') g $$,
  $$ values ('Nuoto', '2026-10-28 17:30+01'::timestamptz, false) $$,
  'Wednesday 28 (where the changed Tuesday 27 went) has the values of the series'
);

-- ---------------------------------------------------------------------------
-- Marco (A): «Salva tutti i prossimi» from Tuesday 20 on the second «Nuoto»
-- ---------------------------------------------------------------------------
select ok(
  set_config('test.split', public.update_event(
    'a6000000-0000-4000-8000-000000000002', '2026-10-20', 'Nuoto nuovo', '2026-10-20 17:30+02', '2026-10-20 19:00+02',
    'household', array['a1000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000004']::uuid[],
    'Piscina Lissone', null, 'weekly', '{2,4}', null, null
  )::text, true)::uuid <> 'a6000000-0000-4000-8000-000000000002'::uuid,
  'from a later occurrence the series is split: a new id is returned'
);
select results_eq(
  $$ select e.title, e.recurrence_until, e.escort_member_id from public.events e
     where e.id = 'a6000000-0000-4000-8000-000000000002' $$,
  $$ values ('Nuoto Sofia', '2026-10-19'::date, 'a1000000-0000-4000-8000-000000000002'::uuid) $$,
  'the occurrences before Tuesday 20 keep the old values; the old series ends on Monday 19'
);
select results_eq(
  $$ select g.title from public.get_event_occurrence('a6000000-0000-4000-8000-000000000002', '2026-10-15') g $$,
  $$ values ('Nuoto Sofia') $$,
  'Thursday 15 is unchanged'
);
select is_empty(
  $$ select 1 from public.get_event_occurrence('a6000000-0000-4000-8000-000000000002', '2026-10-20') $$,
  'the old event has no occurrence from Tuesday 20 on'
);
select results_eq(
  $$ select e.household_id, e.author_member_id, e.title, e.location, e.notes, e.starts_at, e.ends_at, e.visibility::text,
            e.escort_member_id, e.recurrence_weekdays, e.recurrence_until
     from public.events e where e.id = current_setting('test.split')::uuid $$,
  $$ values ('11111111-1111-4111-8111-111111111111'::uuid, 'a1000000-0000-4000-8000-000000000001'::uuid, 'Nuoto nuovo',
             'Piscina Lissone', null::text, '2026-10-20 17:30+02'::timestamptz, '2026-10-20 19:00+02'::timestamptz, 'household',
             null::uuid, '{2,4}'::smallint[], null::date) $$,
  'the new event starts on Tuesday 20 with the new values'
);
select results_eq(
  $$ select em.member_id from public.event_members em where em.event_id = current_setting('test.split')::uuid order by 1 $$,
  $$ values ('a1000000-0000-4000-8000-000000000003'::uuid), ('a1000000-0000-4000-8000-000000000004'::uuid) $$,
  'the new event has the new participants'
);
select results_eq(
  $$ select em.member_id from public.event_members em where em.event_id = 'a6000000-0000-4000-8000-000000000002' $$,
  $$ values ('a1000000-0000-4000-8000-000000000003'::uuid) $$,
  'the old event keeps its participants'
);
select results_eq(
  $$ select x.event_id = current_setting('test.split')::uuid, x.occurrence_date, x.is_cancelled from public.event_exceptions x
     where x.event_id in ('a6000000-0000-4000-8000-000000000002', current_setting('test.split')::uuid) order by 2 $$,
  $$ values (false, '2026-10-13'::date, true), (true, '2026-10-27', true) $$,
  'removed occurrences before stay with the old event, those after move to the new one; the changed one (22) takes the new values'
);
select results_eq(
  $$ select g.title, g.starts_at, g.is_modified from public.get_event_occurrence(current_setting('test.split')::uuid, '2026-10-22') g $$,
  $$ values ('Nuoto nuovo', '2026-10-22 17:30+02'::timestamptz, false) $$,
  'Thursday 22 has the new values'
);
select is_empty(
  $$ select 1 from public.get_event_occurrence(current_setting('test.split')::uuid, '2026-10-27') $$,
  'Tuesday 27 stays removed'
);
select results_eq(
  $$ select e.id, e.title, e.starts_at from public.list_household_events('2026-10-12 00:00+02', '2026-10-26 00:00+01') e
     where e.title like 'Nuoto%' and e.id <> 'a6000000-0000-4000-8000-000000000001' $$,
  $$ values
       ('a6000000-0000-4000-8000-000000000002'::uuid, 'Nuoto Sofia', '2026-10-15 17:00+02'::timestamptz),
       (current_setting('test.split')::uuid, 'Nuoto nuovo', '2026-10-20 17:30+02'::timestamptz),
       (current_setting('test.split')::uuid, 'Nuoto nuovo', '2026-10-22 17:30+02'::timestamptz) $$,
  'the calendar shows the old values before Tuesday 20 and the new ones after'
);

-- A new rule from the first occurrence: the series starts again, its exceptions are dropped.
select is(
  public.update_event(
    current_setting('test.split')::uuid, '2026-10-20', 'Nuoto nuovo', '2026-10-20 17:30+02', '2026-10-20 19:00+02',
    'household', array['a1000000-0000-4000-8000-000000000003']::uuid[], 'Piscina Lissone', null, 'monthly', null, null, null
  ),
  current_setting('test.split')::uuid,
  'the new event becomes monthly'
);
select is(
  (select count(*)::int from public.event_exceptions x where x.event_id = current_setting('test.split')::uuid),
  0,
  'a new rule drops the exceptions'
);
select results_eq(
  $$ select em.member_id from public.event_members em where em.event_id = current_setting('test.split')::uuid $$,
  $$ values ('a1000000-0000-4000-8000-000000000003'::uuid) $$,
  'a participant left out of the list is removed'
);

-- An event that does not repeat.
select is(
  public.update_event(
    'a6000000-0000-4000-8000-000000000003', null, ' Cena  dai nonni ', '2026-10-20 22:00+02', '2026-10-21 01:00+02',
    'household', array['a1000000-0000-4000-8000-000000000001']::uuid[], null, null, 'none', null, null, '  Portare il dolce  '
  ),
  'a6000000-0000-4000-8000-000000000003'::uuid,
  'an event that does not repeat is changed with no day'
);
select results_eq(
  $$ select e.title, e.starts_at, e.ends_at, e.notes from public.events e where e.id = 'a6000000-0000-4000-8000-000000000003' $$,
  $$ values ('Cena dai nonni', '2026-10-20 22:00+02'::timestamptz, '2026-10-21 01:00+02'::timestamptz, 'Portare il dolce') $$,
  'its values are saved, normalised'
);

-- Errors and atomicity.
select throws_ok(
  $$ select public.update_event(
       'a6000000-0000-4000-8000-000000000003', null, 'Non salvato', '2026-10-20 22:00+02', '2026-10-21 01:00+02',
       'household', array['a1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000003']::uuid[],
       null, null, 'none', null, null, null) $$,
  '23503', null,
  'a participant of another household makes the whole change fail'
);
select throws_ok(
  $$ select public.update_event(
       'a6000000-0000-4000-8000-000000000002', '2026-10-15', 'Non salvato', '2026-10-15 17:00+02', '2026-10-15 18:30+02',
       'household', array['a1000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000003']::uuid[],
       null, null, 'weekly', '{2,4}', null, null) $$,
  '23503', null,
  'a failed change from a later occurrence leaves no split behind'
);
select results_eq(
  $$ select count(*)::int, min(e.recurrence_until) from public.events e
     where e.title in ('Nuoto Sofia', 'Non salvato') and e.household_id = '11111111-1111-4111-8111-111111111111' $$,
  $$ values (1, '2026-10-19'::date) $$,
  'nothing of the failed changes was saved (title, split, last day)'
);
select throws_ok(
  $$ select public.update_event(
       'a6000000-0000-4000-8000-000000000002', '2026-10-13', 'Nuoto', '2026-10-13 17:00+02', '2026-10-13 18:30+02',
       'household', array['a1000000-0000-4000-8000-000000000003']::uuid[], null, null, 'weekly', '{2,4}', null, null) $$,
  'P0002', 'event not found',
  'a removed occurrence cannot be the start of a change'
);
select throws_ok(
  $$ select public.update_event(
       'a6000000-0000-4000-8000-000000000002', '2026-10-14', 'Nuoto', '2026-10-14 17:00+02', '2026-10-14 18:30+02',
       'household', array['a1000000-0000-4000-8000-000000000003']::uuid[], null, null, 'weekly', '{3}', null, null) $$,
  'P0002', 'event not found',
  'a day that is not an occurrence cannot be the start of a change'
);
select throws_ok(
  $$ select public.update_event(
       'a6000000-0000-4000-8000-000000000003', null, 'Cena', '2026-10-20 10:00+02', '2026-10-28 10:00+01',
       'household', array['a1000000-0000-4000-8000-000000000001']::uuid[], null, null, 'weekly', '{2}', null, null) $$,
  '23514',
  'new row for relation "events" violates check constraint "events_repeated_duration"',
  'a repeated event longer than 7 days is refused with the name of the constraint (CA-31 of #19)'
);
select throws_ok(
  $$ select public.update_event(
       'a6000000-0000-4000-8000-000000000003', null, 'Cena', '2026-10-20 22:00+02', '2026-10-21 01:00+02',
       'household', null, null, null, 'none', null, null, null) $$,
  '22023', 'invalid participants',
  'the list of participants is always sent'
);
set local request.method to 'GET';
select throws_ok(
  $$ select public.update_event(
       'a6000000-0000-4000-8000-000000000003', null, 'Con GET', '2026-10-20 22:00+02', '2026-10-21 01:00+02',
       'household', array[]::uuid[], null, null, 'none', null, null, null) $$,
  'P0001', 'use POST',
  'update_event refuses GET'
);
set local request.method to 'POST';

-- ---------------------------------------------------------------------------
-- Giulia (B): other household, and a participant of an «Occupato» of Paolo
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';

select throws_ok(
  $$ select public.update_event(
       'a6000000-0000-4000-8000-000000000003', null, 'Preso', '2026-10-20 22:00+02', '2026-10-21 01:00+02',
       'household', array[]::uuid[], null, null, 'none', null, null, null) $$,
  'P0002', 'event not found',
  'B cannot change an event of A (same error as an unknown event)'
);
select throws_ok(
  $$ select public.update_event(
       'a6000000-0000-4000-8000-000000000002', '2026-10-15', 'Preso', '2026-10-15 17:00+02', '2026-10-15 18:30+02',
       'household', array[]::uuid[], null, null, 'weekly', '{2,4}', null, null) $$,
  'P0002', 'event not found',
  'B cannot split a series of A'
);
select throws_ok(
  $$ select private.split_event_series('a6000000-0000-4000-8000-000000000002', '2026-10-15') $$,
  'P0002', 'event not found',
  'the split refuses an event the caller does not see in full'
);
select is(
  public.update_event(
    'b6000000-0000-4000-8000-000000000001', '2026-10-19', 'Riunione spostata', '2026-10-19 11:00+02', '2026-10-19 12:00+02',
    'busy', array['b1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000001']::uuid[],
    'Ufficio Nord', null, 'weekly', '{1}', null, null
  ) <> 'b6000000-0000-4000-8000-000000000001'::uuid,
  true,
  'B, participant of an «Occupato» of B2, changes it from Monday 19 on'
);
select throws_ok(
  $$ select public.update_event(
       'b6000000-0000-4000-8000-000000000001', '2026-10-12', 'Riunione', '2026-10-12 09:00+02', '2026-10-12 10:00+02',
       'household', array['b1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000001']::uuid[],
       'Ufficio Nord', null, 'weekly', '{1}', null, null) $$,
  '42501', 'only the author can change who sees an event',
  'B cannot show the «Occupato» of B2 to everyone, not even through a split'
);
select throws_ok(
  $$ select public.update_event(
       'b6000000-0000-4000-8000-000000000001', '2026-10-12', 'Riunione', '2026-10-12 09:00+02', '2026-10-12 10:00+02',
       'busy', array['b1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000003']::uuid[],
       'Ufficio Nord', null, 'weekly', '{1}', null, null) $$,
  '42501', null,
  'B cannot add people to the «Occupato» of B2, not even through a split'
);

-- Without a day: the occurrence in progress or the next one (real clock).
select results_eq(
  $$ select g.starts_at from public.get_event_occurrence('b6000000-0000-4000-8000-000000000002') g $$,
  $$ select ((
       case
         when now() < (((now() at time zone 'Europe/Rome')::date + time '23:30') at time zone 'Europe/Rome')
           then (now() at time zone 'Europe/Rome')::date
         else (now() at time zone 'Europe/Rome')::date + 1
       end + time '23:00'
     ) at time zone 'Europe/Rome') $$,
  'without a day, the occurrence in progress or the next one'
);

-- ---------------------------------------------------------------------------
-- As the database owner: the split of Giulia kept Paolo as author
-- ---------------------------------------------------------------------------
reset role;
select results_eq(
  $$ select e.author_member_id, e.visibility::text, e.starts_at from public.events e
     where e.title in ('Riunione segreta', 'Riunione spostata') and e.household_id = '22222222-2222-4222-8222-222222222222'
     order by e.starts_at $$,
  $$ values
       ('b1000000-0000-4000-8000-000000000002'::uuid, 'busy', '2026-10-05 09:00+02'::timestamptz),
       ('b1000000-0000-4000-8000-000000000002', 'busy', '2026-10-19 11:00+02') $$,
  'both parts of the «Occupato» keep B2 as author and «Occupato» as visibility'
);
select results_eq(
  $$ select em.member_id from public.event_members em join public.events e on e.id = em.event_id
     where e.title = 'Riunione spostata' order by 1 $$,
  $$ values ('b1000000-0000-4000-8000-000000000001'::uuid), ('b1000000-0000-4000-8000-000000000002'::uuid) $$,
  'the new part has the same participants: nobody new sees it'
);
select is(
  (select e.recurrence_until from public.events e where e.title = 'Riunione segreta'),
  '2026-10-18'::date,
  'the old part ends the day before'
);

select * from finish();
rollback;
