-- update_event() with a new rule of the repetition («Salva tutti i prossimi» that changes
-- «Si ripete»): removed occurrences stay removed when their day is still a day of the new
-- rule; changed occurrences take the new values (issue #122, decision of Francesco of
-- 30/10, for #19 Dettaglio impegno).
-- Seed ids: A = Marco (Casa D'Angelo), B = Giulia (Casa Bianchi). Members: Casa D'Angelo
-- Marco a1…01, Laura a1…02 (adult without account), Sofia a1…03 (child).
-- Events are inserted by the database owner with fixed ids and authors. No health data (D1).
-- October 2026: Tuesdays 6, 13, 20, 27; Thursdays 8, 15, 22, 29 (summer time ends on 25).
begin;
create extension if not exists pgtap with schema extensions;

select plan(31);

-- Four copies of «Nuoto» every Tuesday and Thursday from 6 October at 17:00.
insert into public.events (
  id, household_id, author_member_id, title, location, notes, starts_at, ends_at, visibility,
  escort_member_id, recurrence, recurrence_weekdays, recurrence_until
)
select
  ('a7000000-0000-4000-8000-00000000000' || n)::uuid, '11111111-1111-4111-8111-111111111111',
  'a1000000-0000-4000-8000-000000000001', 'Nuoto Sofia', 'Piscina comunale', null,
  '2026-10-06 17:00+02', '2026-10-06 18:30+02', 'household', null, 'weekly', '{2,4}', null
from generate_series(1, 4) as n;

insert into public.event_members (event_id, member_id, household_id)
select ('a7000000-0000-4000-8000-00000000000' || n)::uuid, 'a1000000-0000-4000-8000-000000000003',
  '11111111-1111-4111-8111-111111111111'
from generate_series(1, 4) as n;

-- Every copy: Tuesday 13 and Thursday 15 removed, Tuesday 20 changed, Tuesday 27 and
-- Thursday 29 removed.
insert into public.event_exceptions (event_id, household_id, occurrence_date, is_cancelled, title, starts_at, ends_at)
select ('a7000000-0000-4000-8000-00000000000' || n)::uuid, '11111111-1111-4111-8111-111111111111', x.d, x.c, x.t, x.s, x.e
from generate_series(1, 4) as n
cross join (
  values
    ('2026-10-13'::date, true, null::text, null::timestamptz, null::timestamptz),
    ('2026-10-15', true, null, null, null),
    ('2026-10-20', false, 'Nuoto con papà', '2026-10-20 18:00+02', '2026-10-20 19:00+02'),
    ('2026-10-27', true, null, null, null),
    ('2026-10-29', true, null, null, null)
) as x (d, c, t, s, e);

set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
set local request.method to 'POST';

-- ---------------------------------------------------------------------------
-- 1. «Ogni martedì e giovedì» becomes «Ogni martedì», from the first occurrence
-- ---------------------------------------------------------------------------
select results_eq(
  $$ select u.id, u.day from public.update_event(
       'a7000000-0000-4000-8000-000000000001', '2026-10-06', 'Nuoto', '2026-10-06 17:00+02', '2026-10-06 18:30+02',
       'household', array['a1000000-0000-4000-8000-000000000003']::uuid[], 'Piscina comunale', null,
       'weekly', '{2}', null, null
     ) u $$,
  $$ values ('a7000000-0000-4000-8000-000000000001'::uuid, '2026-10-06'::date) $$,
  'Marco changes «Ogni martedì e giovedì» into «Ogni martedì» from the first occurrence'
);
select results_eq(
  $$ select x.occurrence_date, x.is_cancelled from public.event_exceptions x
     where x.event_id = 'a7000000-0000-4000-8000-000000000001' order by 1 $$,
  $$ values ('2026-10-13'::date, true), ('2026-10-27', true) $$,
  'the removed Tuesdays 13 and 27 stay removed; the removed Thursdays and the changed Tuesday 20 are dropped'
);
select is_empty(
  $$ select 1 from public.get_event_occurrence('a7000000-0000-4000-8000-000000000001', '2026-10-13')
     union all
     select 1 from public.get_event_occurrence('a7000000-0000-4000-8000-000000000001', '2026-10-27') $$,
  'Tuesdays 13 and 27 do not come back'
);
select results_eq(
  $$ select g.title, g.starts_at, g.is_modified from public.get_event_occurrence('a7000000-0000-4000-8000-000000000001', '2026-10-20') g $$,
  $$ values ('Nuoto', '2026-10-20 17:00+02'::timestamptz, false) $$,
  'the changed Tuesday 20 takes the new values'
);
select results_eq(
  $$ select e.starts_at from public.list_household_events('2026-10-05 00:00+02', '2026-11-05 00:00+01') e
     where e.id = 'a7000000-0000-4000-8000-000000000001' order by 1 $$,
  $$ values
       ('2026-10-06 17:00+02'::timestamptz), ('2026-10-20 17:00+02'::timestamptz), ('2026-11-03 17:00+01'::timestamptz) $$,
  'the calendar shows Tuesdays 6, 20 and 3 November: no Thursday, no removed Tuesday'
);

-- ---------------------------------------------------------------------------
-- 2. The example of the issue: the same change from Tuesday 20 on (the series is split)
-- ---------------------------------------------------------------------------
select ok(
  set_config('test.split', (select u.id from public.update_event(
    'a7000000-0000-4000-8000-000000000002', '2026-10-20', 'Nuoto', '2026-10-20 17:00+02', '2026-10-20 18:30+02',
    'household', array['a1000000-0000-4000-8000-000000000003']::uuid[], 'Piscina comunale', null,
    'weekly', '{2}', null, null
  ) u)::text, true)::uuid <> 'a7000000-0000-4000-8000-000000000002'::uuid,
  'Marco changes «Ogni martedì e giovedì» into «Ogni martedì» from Tuesday 20: a new part starts there'
);
select results_eq(
  $$ select x.occurrence_date, x.is_cancelled from public.event_exceptions x
     where x.event_id = current_setting('test.split')::uuid order by 1 $$,
  $$ values ('2026-10-27'::date, true) $$,
  'in the new part the removed Tuesday 27 stays removed; Thursday 29 and the changed Tuesday 20 are dropped'
);
select is_empty(
  $$ select 1 from public.get_event_occurrence(current_setting('test.split')::uuid, '2026-10-27') $$,
  'Tuesday 27 does not come back'
);
select results_eq(
  $$ select g.title, g.is_modified from public.get_event_occurrence(current_setting('test.split')::uuid, '2026-10-20') g $$,
  $$ values ('Nuoto', false) $$,
  'the opened Tuesday 20 has the new values'
);
select results_eq(
  $$ select x.occurrence_date, x.is_cancelled from public.event_exceptions x
     where x.event_id = 'a7000000-0000-4000-8000-000000000002' order by 1 $$,
  $$ values ('2026-10-13'::date, true), ('2026-10-15', true) $$,
  'the old part keeps its removed occurrences before Tuesday 20'
);
select results_eq(
  $$ select e.starts_at from public.list_household_events('2026-10-19 00:00+02', '2026-11-05 00:00+01') e
     where e.id = current_setting('test.split')::uuid order by 1 $$,
  $$ values ('2026-10-20 17:00+02'::timestamptz), ('2026-11-03 17:00+01'::timestamptz) $$,
  'the calendar shows Tuesday 20 and Tuesday 3 November, without Tuesday 27'
);

-- ---------------------------------------------------------------------------
-- 3. Removed occurrences that are not days of the new rule: «Ogni mercoledì» from
--    Tuesday 20 moved to Wednesday 21 (a new rule: the old days moved by one would be
--    Wednesday and Friday)
-- ---------------------------------------------------------------------------
select ok(
  set_config('test.wednesday', (select u.id from public.update_event(
    'a7000000-0000-4000-8000-000000000003', '2026-10-20', 'Nuoto', '2026-10-21 17:00+02', '2026-10-21 18:30+02',
    'household', array['a1000000-0000-4000-8000-000000000003']::uuid[], 'Piscina comunale', null,
    'weekly', '{3}', null, null
  ) u)::text, true) is not null,
  'Marco changes the series into «Ogni mercoledì» from Tuesday 20'
);
select is(
  (select count(*)::int from public.event_exceptions x where x.event_id = current_setting('test.wednesday')::uuid),
  0,
  'Tuesday 27 and Thursday 29 are not Wednesdays: their removals are dropped, nothing is hidden by mistake'
);
select results_eq(
  $$ select e.starts_at from public.list_household_events('2026-10-19 00:00+02', '2026-11-02 00:00+01') e
     where e.id = current_setting('test.wednesday')::uuid order by 1 $$,
  $$ values ('2026-10-21 17:00+02'::timestamptz), ('2026-10-28 17:00+01'::timestamptz) $$,
  'every Wednesday of the new part is shown'
);

-- A removed day that would be the start of the opened occurrence is never kept removed:
-- from Thursday 22, «Ogni martedì» starting on the removed Tuesday 27.
select results_eq(
  $$ select u.day from public.update_event(
       'a7000000-0000-4000-8000-000000000004', '2026-10-22', 'Nuoto', '2026-10-27 17:00+01', '2026-10-27 18:30+01',
       'household', array['a1000000-0000-4000-8000-000000000003']::uuid[], 'Piscina comunale', null,
       'weekly', '{2}', null, null
     ) u $$,
  $$ values ('2026-10-27'::date) $$,
  'Marco saves Thursday 22 as «Ogni martedì» from Tuesday 27'
);
select ok(
  set_config('test.from27', (select e.id::text from public.events e
    where e.title = 'Nuoto' and e.starts_at = '2026-10-27 17:00+01'), true) is not null,
  'the new part starts on Tuesday 27'
);
select results_eq(
  $$ select g.occurrence_date, g.is_modified from public.get_event_occurrence(current_setting('test.from27')::uuid, '2026-10-27') g $$,
  $$ values ('2026-10-27'::date, false) $$,
  'the occurrence just saved is shown (the removal of Tuesday 27 does not hide it)'
);
select is(
  (select count(*)::int from public.event_exceptions x where x.event_id = current_setting('test.from27')::uuid),
  0,
  'the new part has no removed occurrence (Thursday 29 is not a Tuesday)'
);

-- No repetition any more: no exception is kept, and the change does not fail.
select lives_ok(
  $$ select public.update_event(
       current_setting('test.split')::uuid, '2026-10-20', 'Nuoto', '2026-10-20 17:00+02', '2026-10-20 18:30+02',
       'household', array['a1000000-0000-4000-8000-000000000003']::uuid[], 'Piscina comunale', null,
       'none', null, null, null) $$,
  'Marco changes the new part into «Mai» (it does not repeat any more)'
);
select is(
  (select count(*)::int from public.event_exceptions x where x.event_id = current_setting('test.split')::uuid),
  0,
  'an event that does not repeat keeps no removed occurrence'
);

-- Only POST (lesson of #112): every other method is refused before reading anything.
set local request.method to 'GET';
select throws_ok(
  $$ select public.update_event(
       'a7000000-0000-4000-8000-000000000001', '2026-10-06', 'Con GET', '2026-10-06 17:00+02', '2026-10-06 18:30+02',
       'household', array[]::uuid[], null, null, 'weekly', '{4}', null, null) $$,
  'P0001', 'use POST',
  'update_event refuses GET'
);
set local request.method to 'HEAD';
select throws_ok(
  $$ select public.update_event(
       'a7000000-0000-4000-8000-000000000001', '2026-10-06', 'Con HEAD', '2026-10-06 17:00+02', '2026-10-06 18:30+02',
       'household', array[]::uuid[], null, null, 'weekly', '{4}', null, null) $$,
  'P0001', 'use POST',
  'update_event refuses HEAD'
);
set local request.method to 'PUT';
select throws_ok(
  $$ select public.update_event(
       'a7000000-0000-4000-8000-000000000001', '2026-10-06', 'Con PUT', '2026-10-06 17:00+02', '2026-10-06 18:30+02',
       'household', array[]::uuid[], null, null, 'weekly', '{4}', null, null) $$,
  'P0001', 'use POST',
  'update_event refuses PUT'
);
set local request.method to 'POST';

-- ---------------------------------------------------------------------------
-- Giulia (B): another household
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';

select throws_ok(
  $$ select public.update_event(
       'a7000000-0000-4000-8000-000000000001', '2026-10-06', 'Preso', '2026-10-06 17:00+02', '2026-10-06 18:30+02',
       'household', array[]::uuid[], null, null, 'weekly', '{4}', null, null) $$,
  'P0002', 'event not found',
  'B cannot change the rule of an event of A (same error as an unknown event)'
);
select is_empty(
  $$ select 1 from public.event_exceptions x where x.event_id::text like 'a7000000-%' $$,
  'B does not see the removed occurrences of A'
);
select is_empty(
  $$ select 1 from public.list_household_events('2026-10-05 00:00+02', '2026-11-05 00:00+01') e where e.title like 'Nuoto%' $$,
  'B does not see the events of A in the calendar'
);

-- ---------------------------------------------------------------------------
-- Anonymous visitor
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';

select throws_ok(
  $$ select public.update_event(
       'a7000000-0000-4000-8000-000000000001', '2026-10-06', 'Anonimo', '2026-10-06 17:00+02', '2026-10-06 18:30+02',
       'household', array[]::uuid[], null, null, 'weekly', '{4}', null, null) $$,
  '42501', null,
  'an anonymous visitor cannot call update_event'
);
select throws_ok(
  $$ select 1 from public.event_exceptions x $$,
  '42501', null,
  'an anonymous visitor cannot read the removed occurrences'
);

-- ---------------------------------------------------------------------------
-- As the database owner: what B tried changed nothing, and the function kept its rules
-- ---------------------------------------------------------------------------
reset role;
select results_eq(
  $$ select e.title, e.recurrence_weekdays from public.events e where e.id = 'a7000000-0000-4000-8000-000000000001' $$,
  $$ values ('Nuoto', '{2}'::smallint[]) $$,
  'the event of A has the values Marco saved, not those B or the refused methods sent'
);
select ok(
  (select not p.prosecdef and p.proconfig @> array['search_path=""'] from pg_proc p
   where p.oid = 'public.update_event(uuid, date, text, timestamptz, timestamptz, public.event_visibility, uuid[], text, uuid, public.event_recurrence, smallint[], date, text)'::regprocedure),
  'update_event stays security invoker with an empty search_path'
);
select ok(
  not has_function_privilege('anon', 'public.update_event(uuid, date, text, timestamptz, timestamptz, public.event_visibility, uuid[], text, uuid, public.event_recurrence, smallint[], date, text)', 'execute')
  and has_function_privilege('authenticated', 'public.update_event(uuid, date, text, timestamptz, timestamptz, public.event_visibility, uuid[], text, uuid, public.event_recurrence, smallint[], date, text)', 'execute'),
  'update_event stays for signed-in users only'
);

select * from finish();
rollback;
