-- update_event() with a new rule of the repetition, more cases (issue #122, functional
-- test of PR #129): a new rule with a last day, weekly to monthly, isolation of the parts
-- born from a split, and the whole event changed without a day (p_day null).
-- Seed ids: A = Marco (Casa D'Angelo), B = Giulia (Casa Bianchi). Members: Casa D'Angelo
-- Marco a1…01, Sofia a1…03 (child).
-- Events are inserted by the database owner with fixed ids and authors. No health data (D1).
-- 2026: Tuesdays 6, 13, 20, 27 October, 3, 10 November, 1 December; Thursdays 15, 29
-- October, 5 November, 3 December (summer time ends on 25 October).
begin;
create extension if not exists pgtap with schema extensions;

select plan(29);

-- Five copies of «Nuoto» every Tuesday and Thursday from 6 October at 17:00.
insert into public.events (
  id, household_id, author_member_id, title, location, notes, starts_at, ends_at, visibility,
  escort_member_id, recurrence, recurrence_weekdays, recurrence_until
)
select
  ('a8000000-0000-4000-8000-00000000000' || n)::uuid, '11111111-1111-4111-8111-111111111111',
  'a1000000-0000-4000-8000-000000000001', 'Nuoto Sofia', 'Piscina comunale', null,
  '2026-10-06 17:00+02', '2026-10-06 18:30+02', 'household', null, 'weekly', '{2,4}', null
from generate_series(1, 5) as n;

insert into public.event_members (event_id, member_id, household_id)
select ('a8000000-0000-4000-8000-00000000000' || n)::uuid, 'a1000000-0000-4000-8000-000000000003',
  '11111111-1111-4111-8111-111111111111'
from generate_series(1, 5) as n;

insert into public.event_exceptions (event_id, household_id, occurrence_date, is_cancelled, title, starts_at, ends_at)
select x.event_id::uuid, '11111111-1111-4111-8111-111111111111', x.d, x.c, x.t, x.s, x.e
from (
  values
    -- Copies 1 and 2 (a new rule with a last day): removed 13, 15, 27 October, 3 and
    -- 10 November.
    ('a8000000-0000-4000-8000-000000000001', '2026-10-13'::date, true, null::text, null::timestamptz, null::timestamptz),
    ('a8000000-0000-4000-8000-000000000001', '2026-10-15', true, null, null, null),
    ('a8000000-0000-4000-8000-000000000001', '2026-10-27', true, null, null, null),
    ('a8000000-0000-4000-8000-000000000001', '2026-11-03', true, null, null, null),
    ('a8000000-0000-4000-8000-000000000001', '2026-11-10', true, null, null, null),
    ('a8000000-0000-4000-8000-000000000002', '2026-10-13', true, null, null, null),
    ('a8000000-0000-4000-8000-000000000002', '2026-10-27', true, null, null, null),
    ('a8000000-0000-4000-8000-000000000002', '2026-11-03', true, null, null, null),
    ('a8000000-0000-4000-8000-000000000002', '2026-11-10', true, null, null, null),
    -- Copy 3 (weekly to monthly from Tuesday 3 November): removed Thursday 5, Tuesday
    -- 10 November, Tuesday 1 and Thursday 3 December; Thursday 12 November changed.
    ('a8000000-0000-4000-8000-000000000003', '2026-11-05', true, null, null, null),
    ('a8000000-0000-4000-8000-000000000003', '2026-11-10', true, null, null, null),
    ('a8000000-0000-4000-8000-000000000003', '2026-12-01', true, null, null, null),
    ('a8000000-0000-4000-8000-000000000003', '2026-12-03', true, null, null, null),
    ('a8000000-0000-4000-8000-000000000003', '2026-11-12', false, 'Nuoto con papà', '2026-11-12 18:00+01', '2026-11-12 19:00+01'),
    -- Copy 4 (no day, the first occurrence removed): removed 6, 13 and 15 October.
    ('a8000000-0000-4000-8000-000000000004', '2026-10-06', true, null, null, null),
    ('a8000000-0000-4000-8000-000000000004', '2026-10-13', true, null, null, null),
    ('a8000000-0000-4000-8000-000000000004', '2026-10-15', true, null, null, null),
    -- Copy 5 (no day, start moved to a removed day): removed 13 and 15 October.
    ('a8000000-0000-4000-8000-000000000005', '2026-10-13', true, null, null, null),
    ('a8000000-0000-4000-8000-000000000005', '2026-10-15', true, null, null, null)
) as x (event_id, d, c, t, s, e);

set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
set local request.method to 'POST';

-- ---------------------------------------------------------------------------
-- 1. A new rule with a last day: removed occurrences after it are dropped
-- ---------------------------------------------------------------------------
select lives_ok(
  $$ select public.update_event(
       'a8000000-0000-4000-8000-000000000001', '2026-10-06', 'Nuoto', '2026-10-06 17:00+02', '2026-10-06 18:30+02',
       'household', array['a1000000-0000-4000-8000-000000000003']::uuid[], 'Piscina comunale', null,
       'weekly', '{2}', '2026-10-31', null) $$,
  'Marco changes the whole series into «Ogni martedì» until Saturday 31 October'
);
select results_eq(
  $$ select x.occurrence_date, x.is_cancelled from public.event_exceptions x
     where x.event_id = 'a8000000-0000-4000-8000-000000000001' order by 1 $$,
  $$ values ('2026-10-13'::date, true), ('2026-10-27', true) $$,
  'Tuesdays 13 and 27 stay removed; Thursday 15 and the Tuesdays after the last day (3 and 10 November) are dropped'
);
select results_eq(
  $$ select e.starts_at from public.list_household_events('2026-10-05 00:00+02', '2026-11-15 00:00+01') e
     where e.id = 'a8000000-0000-4000-8000-000000000001' order by 1 $$,
  $$ values ('2026-10-06 17:00+02'::timestamptz), ('2026-10-20 17:00+02'::timestamptz) $$,
  'the calendar shows only Tuesdays 6 and 20 (13 and 27 removed, nothing after the last day)'
);

-- The same from Tuesday 20 (the series is split: the new part has a random id).
select ok(
  set_config('test.part_until', (select u.id from public.update_event(
    'a8000000-0000-4000-8000-000000000002', '2026-10-20', 'Nuoto', '2026-10-20 17:00+02', '2026-10-20 18:30+02',
    'household', array['a1000000-0000-4000-8000-000000000003']::uuid[], 'Piscina comunale', null,
    'weekly', '{2}', '2026-10-31', null
  ) u)::text, true)::uuid <> 'a8000000-0000-4000-8000-000000000002'::uuid,
  'Marco changes the series into «Ogni martedì» until 31 October from Tuesday 20: a new part starts there'
);
select results_eq(
  $$ select x.occurrence_date, x.is_cancelled from public.event_exceptions x
     where x.event_id = current_setting('test.part_until')::uuid order by 1 $$,
  $$ values ('2026-10-27'::date, true) $$,
  'in the new part only Tuesday 27 stays removed; 3 and 10 November, after the last day, are dropped'
);
select results_eq(
  $$ select x.occurrence_date from public.event_exceptions x
     where x.event_id = 'a8000000-0000-4000-8000-000000000002' order by 1 $$,
  $$ values ('2026-10-13'::date) $$,
  'the old part keeps its removed Tuesday 13'
);
select results_eq(
  $$ select g.recurrence_until from public.get_event_occurrence(current_setting('test.part_until')::uuid, '2026-10-20') g $$,
  $$ values ('2026-10-31'::date) $$,
  'the new part ends on 31 October'
);

-- ---------------------------------------------------------------------------
-- 2. Weekly to monthly from Tuesday 3 November (monthly on the 3rd: Thursday 3
--    December falls on the new rule)
-- ---------------------------------------------------------------------------
select ok(
  set_config('test.part_monthly', (select u.id from public.update_event(
    'a8000000-0000-4000-8000-000000000003', '2026-11-03', 'Nuoto mensile', '2026-11-03 17:00+01', '2026-11-03 18:30+01',
    'household', array['a1000000-0000-4000-8000-000000000003']::uuid[], 'Piscina comunale', null,
    'monthly', null, null, null
  ) u)::text, true)::uuid <> 'a8000000-0000-4000-8000-000000000003'::uuid,
  'Marco changes «Ogni martedì e giovedì» into «Ogni mese» from Tuesday 3 November'
);
select results_eq(
  $$ select x.occurrence_date, x.is_cancelled from public.event_exceptions x
     where x.event_id = current_setting('test.part_monthly')::uuid order by 1 $$,
  $$ values ('2026-12-03'::date, true) $$,
  'only Thursday 3 December (the 3rd of a month) stays removed; 5 and 10 November, 1 December and the changed 12 November are dropped'
);
select is_empty(
  $$ select 1 from public.get_event_occurrence(current_setting('test.part_monthly')::uuid, '2026-12-03') $$,
  '3 December does not come back'
);
select results_eq(
  $$ select g.title, g.is_modified from public.get_event_occurrence(current_setting('test.part_monthly')::uuid, '2027-01-03') g $$,
  $$ values ('Nuoto mensile', false) $$,
  '3 January 2027 is an occurrence with the new values'
);
select results_eq(
  $$ select e.starts_at from public.list_household_events('2026-11-01 00:00+01', '2026-12-10 00:00+01') e
     where e.id = current_setting('test.part_monthly')::uuid order by 1 $$,
  $$ values ('2026-11-03 17:00+01'::timestamptz) $$,
  'between 1 November and 9 December the calendar shows only 3 November'
);

-- ---------------------------------------------------------------------------
-- 4. The whole event changed without a day (p_day null)
-- ---------------------------------------------------------------------------
select results_eq(
  $$ select u.id, u.day from public.update_event(
       'a8000000-0000-4000-8000-000000000004', null, 'Nuoto', '2026-10-06 17:00+02', '2026-10-06 18:30+02',
       'household', array['a1000000-0000-4000-8000-000000000003']::uuid[], 'Piscina comunale', null,
       'weekly', '{2}', null, null
     ) u $$,
  $$ values ('a8000000-0000-4000-8000-000000000004'::uuid, '2026-10-06'::date) $$,
  'without a day the whole event changes into «Ogni martedì», from its first occurrence'
);
select results_eq(
  $$ select x.occurrence_date from public.event_exceptions x
     where x.event_id = 'a8000000-0000-4000-8000-000000000004' and x.is_cancelled order by 1 $$,
  $$ values ('2026-10-06'::date), ('2026-10-13') $$,
  'the removed first occurrence (Tuesday 6) stays removed, with Tuesday 13; Thursday 15 is dropped'
);
select results_eq(
  $$ select u.id, u.day from public.update_event(
       'a8000000-0000-4000-8000-000000000005', null, 'Nuoto', '2026-10-13 17:00+02', '2026-10-13 18:30+02',
       'household', array['a1000000-0000-4000-8000-000000000003']::uuid[], 'Piscina comunale', null,
       'weekly', '{2}', null, null
     ) u $$,
  $$ values ('a8000000-0000-4000-8000-000000000005'::uuid, '2026-10-13'::date) $$,
  'without a day, «Ogni martedì» starting on the removed Tuesday 13'
);
select is(
  (select count(*)::int from public.event_exceptions x where x.event_id = 'a8000000-0000-4000-8000-000000000005'),
  0,
  'the first occurrence was not removed: the new start (Tuesday 13) is shown, Thursday 15 is dropped'
);
select results_eq(
  $$ select g.occurrence_date from public.get_event_occurrence('a8000000-0000-4000-8000-000000000005', '2026-10-13') g $$,
  $$ values ('2026-10-13'::date) $$,
  'Tuesday 13 can be opened'
);

-- ---------------------------------------------------------------------------
-- 3. Giulia (B): another household, also for the parts born from a split
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';

select is_empty(
  $$ select 1 from public.events e
     where e.id::text like 'a8000000-%'
        or e.id in (current_setting('test.part_until')::uuid, current_setting('test.part_monthly')::uuid) $$,
  'B does not see the events of A, nor the new parts of the split'
);
select is_empty(
  $$ select 1 from public.event_exceptions x
     where x.event_id::text like 'a8000000-%'
        or x.event_id in (current_setting('test.part_until')::uuid, current_setting('test.part_monthly')::uuid) $$,
  'B does not see the removed occurrences of A, nor those of the new parts'
);
select is_empty(
  $$ select 1 from public.event_members em
     where em.event_id in (current_setting('test.part_until')::uuid, current_setting('test.part_monthly')::uuid) $$,
  'B does not see who takes part in the new parts'
);
select is_empty(
  $$ select 1 from public.list_household_events('2026-10-05 00:00+02', '2026-11-15 00:00+01') e where e.title like 'Nuoto%' $$,
  'B does not see the events of A in the calendar'
);
select is_empty(
  $$ select 1 from public.get_event_occurrence(current_setting('test.part_until')::uuid, '2026-10-20')
     union all
     select 1 from public.get_event_occurrence(current_setting('test.part_monthly')::uuid, '2026-11-03') $$,
  'B cannot open an occurrence of the new parts'
);
select throws_ok(
  $$ select public.update_event(
       current_setting('test.part_until')::uuid, '2026-10-20', 'Preso', '2026-10-20 17:00+02', '2026-10-20 18:30+02',
       'household', array[]::uuid[], null, null, 'weekly', '{4}', null, null) $$,
  'P0002', 'event not found',
  'B cannot change the new part of A (same error as an unknown event)'
);
select throws_ok(
  $$ select public.update_event(
       current_setting('test.part_monthly')::uuid, null, 'Preso', '2026-11-03 17:00+01', '2026-11-03 18:30+01',
       'household', array[]::uuid[], null, null, 'weekly', '{2}', null, null) $$,
  'P0002', 'event not found',
  'B cannot change the new part of A without a day either'
);
select throws_ok(
  $$ select public.delete_event_occurrence(current_setting('test.part_monthly')::uuid, '2026-11-03', 'this') $$,
  'P0002', 'event not found',
  'B cannot remove an occurrence of the new part of A'
);
select throws_ok(
  $$ select public.update_event_occurrence(current_setting('test.part_until')::uuid, '2026-10-20', 'Preso',
       '2026-10-20 17:00+02', '2026-10-20 18:30+02', null, null, null) $$,
  'P0002', 'event not found',
  'B cannot change one occurrence of the new part of A'
);

-- ---------------------------------------------------------------------------
-- As the database owner: what B tried changed nothing
-- ---------------------------------------------------------------------------
reset role;
select results_eq(
  $$ select e.title, e.recurrence::text, e.recurrence_weekdays, e.recurrence_until from public.events e
     where e.id in (current_setting('test.part_until')::uuid, current_setting('test.part_monthly')::uuid)
     order by e.starts_at $$,
  $$ values ('Nuoto', 'weekly', '{2}'::smallint[], '2026-10-31'::date),
            ('Nuoto mensile', 'monthly', null::smallint[], null::date) $$,
  'the new parts have the values Marco saved'
);
select results_eq(
  $$ select x.event_id = current_setting('test.part_monthly')::uuid, x.occurrence_date from public.event_exceptions x
     where x.event_id in (current_setting('test.part_until')::uuid, current_setting('test.part_monthly')::uuid)
     order by 2 $$,
  $$ values (false, '2026-10-27'::date), (true, '2026-12-03'::date) $$,
  'their removed occurrences are those Marco left'
);
select is(
  (select count(*)::int from public.event_members em
   where em.event_id in (current_setting('test.part_until')::uuid, current_setting('test.part_monthly')::uuid)),
  2,
  'their participants are unchanged (Sofia in each)'
);

select * from finish();
rollback;
