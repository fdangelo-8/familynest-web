-- Writes of the administrative key into events, deadlines and event_exceptions (issue #288):
-- service_role inserts and changes rows of the three tables, the rules of the triggers
-- (normalisation, escort, occurrence, assignee) still hold for it, and nothing changes for
-- the Data API roles.
-- The administrative key comes first: PL/pgSQL keeps the plan of an expression for the
-- whole session, so the defect shows only when service_role is the first role that runs
-- the triggers in the session (as in external_calendars_before_write.test). No row of the
-- three tables is written before it.
-- Seed ids: A = Marco (Casa D'Angelo, user aaaaaaaa…01, member a1…01), B = Giulia (Casa
-- Bianchi, user bbbbbbbb…01, member b1…01). Members of Casa D'Angelo: Marco a1…01 and Laura
-- a1…02 (adults), Sofia a1…03 (child), Biscotto a1…05 (pet). 10 and 17 November 2026 are
-- Tuesdays, 18 November is a Wednesday. No health data (D1).
begin;
create extension if not exists pgtap with schema extensions;

select plan(42);

-- ---------------------------------------------------------------------------
-- events, administrative key
-- ---------------------------------------------------------------------------
set local role service_role;
set local request.jwt.claims to '{"role":"service_role"}';

select lives_ok(
  $$ insert into public.events (
       id, household_id, author_member_id, title, location, starts_at, ends_at, visibility,
       recurrence, recurrence_weekdays
     )
     values (
       'c8000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
       'a1000000-0000-4000-8000-000000000001', '  Nuoto   Sofia ', ' Piscina  comunale ',
       '2026-11-10 17:00+01', '2026-11-10 18:00+01', 'household', 'weekly', '{4,2,2}'
     ) $$,
  '#288: the administrative key inserts an event'
);
select results_eq(
  $$ select e.title, e.location, e.recurrence_weekdays, e.author_member_id
     from public.events e where e.id = 'c8000000-0000-4000-8000-000000000001' $$,
  $$ values ('Nuoto Sofia'::text, 'Piscina comunale'::text, '{2,4}'::smallint[],
             'a1000000-0000-4000-8000-000000000001'::uuid) $$,
  'the event of the administrative key is normalised and keeps the author it was given'
);
select throws_ok(
  $$ insert into public.events (
       household_id, author_member_id, title, starts_at, ends_at, visibility, escort_member_id
     )
     values (
       '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001', 'Gita',
       '2026-11-11 09:00+01', '2026-11-11 10:00+01', 'household', 'a1000000-0000-4000-8000-000000000003'
     ) $$,
  '23514', 'the escort must be an adult of the household',
  'also for the administrative key the escort of an event is an adult'
);
select lives_ok(
  $$ update public.events set title = ' Nuoto   e  corsa '
     where id = 'c8000000-0000-4000-8000-000000000001' $$,
  '#288: the administrative key changes an event'
);
select is(
  (select e.title from public.events e where e.id = 'c8000000-0000-4000-8000-000000000001'),
  'Nuoto e corsa',
  'the changed event of the administrative key is normalised'
);
select throws_ok(
  $$ update public.events set escort_member_id = 'a1000000-0000-4000-8000-000000000005'
     where id = 'c8000000-0000-4000-8000-000000000001' $$,
  '23514', 'the escort must be an adult of the household',
  'also for the administrative key a pet never accompanies an event'
);

-- ---------------------------------------------------------------------------
-- event_exceptions, administrative key
-- ---------------------------------------------------------------------------
select lives_ok(
  $$ insert into public.event_exceptions (
       event_id, household_id, occurrence_date, title, location, notes, starts_at, ends_at
     )
     values (
       'c8000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', '2026-11-17',
       ' Nuoto   spostato ', null, '  Portare la cuffia  ', '2026-11-17 18:00+01', '2026-11-17 19:00+01'
     ) $$,
  '#288: the administrative key inserts the exception of one occurrence'
);
select results_eq(
  $$ select x.title, x.notes from public.event_exceptions x
     where x.event_id = 'c8000000-0000-4000-8000-000000000001' and x.occurrence_date = '2026-11-17' $$,
  $$ values ('Nuoto spostato'::text, 'Portare la cuffia'::text) $$,
  'the exception of the administrative key is normalised'
);
select throws_ok(
  $$ insert into public.event_exceptions (event_id, household_id, occurrence_date, is_cancelled)
     values ('c8000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', '2026-11-18', true) $$,
  '22023', 'the day is not an occurrence of the event',
  'also for the administrative key an exception is only on a day of the series'
);
select lives_ok(
  $$ update public.event_exceptions set title = ' Nuoto  alle  18 '
     where event_id = 'c8000000-0000-4000-8000-000000000001' and occurrence_date = '2026-11-17' $$,
  '#288: the administrative key changes the exception of one occurrence'
);
select is(
  (select x.title from public.event_exceptions x
   where x.event_id = 'c8000000-0000-4000-8000-000000000001' and x.occurrence_date = '2026-11-17'),
  'Nuoto alle 18',
  'the changed exception of the administrative key is normalised'
);
select throws_ok(
  $$ update public.event_exceptions set escort_member_id = 'a1000000-0000-4000-8000-000000000003'
     where event_id = 'c8000000-0000-4000-8000-000000000001' and occurrence_date = '2026-11-17' $$,
  '23514', 'the escort must be an adult of the household',
  'also for the administrative key the escort of one occurrence is an adult'
);

-- ---------------------------------------------------------------------------
-- deadlines, administrative key
-- ---------------------------------------------------------------------------
select lives_ok(
  $$ insert into public.deadlines (
       id, household_id, title, due_date, note, created_by_member_id, assignee_member_id, reminder_days
     )
     values (
       'c8000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', '  Bollo   moto ',
       '2026-12-01', ' Entro  fine mese ', 'a1000000-0000-4000-8000-000000000001',
       'a1000000-0000-4000-8000-000000000002', '{1,30,7}'
     ) $$,
  '#288: the administrative key inserts a deadline'
);
select results_eq(
  $$ select d.title, d.note, d.reminder_days, d.created_by_member_id
     from public.deadlines d where d.id = 'c8000000-0000-4000-8000-000000000002' $$,
  $$ values ('Bollo moto'::text, 'Entro fine mese'::text, '{30,7,1}'::smallint[],
             'a1000000-0000-4000-8000-000000000001'::uuid) $$,
  'the deadline of the administrative key is normalised and keeps the author it was given'
);
select throws_ok(
  $$ insert into public.deadlines (household_id, title, due_date, created_by_member_id, assignee_member_id)
     values ('11111111-1111-4111-8111-111111111111', 'Vaccino del cane', '2026-12-02',
             'a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000005') $$,
  '23514', 'the assignee must be an adult or a child of the household',
  'also for the administrative key a pet never takes care of a deadline'
);
select throws_ok(
  $$ insert into public.deadlines (household_id, title, due_date, created_by_member_id, reminder_days)
     values ('11111111-1111-4111-8111-111111111111', 'Promemoria', '2026-12-02',
             'a1000000-0000-4000-8000-000000000001', '{2}') $$,
  '23514', null,
  'also for the administrative key the reminders are checked by the constraint'
);
select lives_ok(
  $$ update public.deadlines set title = ' Bollo  della  moto ', reminder_days = '{1,7}'
     where id = 'c8000000-0000-4000-8000-000000000002' $$,
  '#288: the administrative key changes a deadline'
);
select results_eq(
  $$ select d.title, d.reminder_days from public.deadlines d where d.id = 'c8000000-0000-4000-8000-000000000002' $$,
  $$ values ('Bollo della moto'::text, '{7,1}'::smallint[]) $$,
  'the changed deadline of the administrative key is normalised'
);
select throws_ok(
  $$ update public.deadlines set assignee_member_id = 'a1000000-0000-4000-8000-000000000005'
     where id = 'c8000000-0000-4000-8000-000000000002' $$,
  '23514', 'the assignee must be an adult or a child of the household',
  'also for the administrative key a new assignee is never a pet'
);

reset role;

-- ---------------------------------------------------------------------------
-- How the fix is made
-- ---------------------------------------------------------------------------
select ok(
  not has_schema_privilege('service_role', 'private', 'usage'),
  'the fix gives service_role no usage on the schema private'
);
select ok(
  (select bool_and(p.prosecdef and coalesce(p.proconfig @> array['search_path=""'], false))
   from pg_proc p
   where p.oid in (
     'private.events_before_write_trusted()'::regprocedure,
     'private.deadlines_before_write_trusted()'::regprocedure,
     'private.event_exceptions_before_write_trusted()'::regprocedure
   )),
  'the trusted triggers are security definer with an empty search_path'
);
select ok(
  not has_function_privilege('authenticated', 'private.events_before_write_trusted()', 'execute')
  and not has_function_privilege('anon', 'private.deadlines_before_write_trusted()', 'execute')
  and not has_function_privilege('service_role', 'private.event_exceptions_before_write_trusted()', 'execute'),
  'nobody executes the trusted trigger functions directly'
);
select is(
  (select count(*)::integer
   from pg_trigger t
   where t.tgname in ('events_before_write_trusted', 'deadlines_before_write_trusted', 'event_exceptions_before_write_trusted')
     and t.tgrelid in ('public.events'::regclass, 'public.deadlines'::regclass, 'public.event_exceptions'::regclass)
     and pg_get_triggerdef(t.oid) ilike '%BEFORE INSERT OR UPDATE%'
     and pg_get_triggerdef(t.oid) ilike '%WHEN%CURRENT_USER%authenticated%anon%'),
  3,
  'the three trusted triggers fire before insert and update, only for roles other than authenticated and anon'
);
select results_eq(
  $$ select t.tgname::text collate "default"
     from pg_trigger t
     where t.tgrelid = 'public.events'::regclass and not t.tgisinternal
       and t.tgtype & 2 = 2 and t.tgtype & 4 = 4
     order by t.tgname collate "C" $$,
  $$ values ('events_before_insert'), ('events_before_write_trusted') $$,
  'on events the trusted trigger fires right after the guard of the insert'
);

-- ---------------------------------------------------------------------------
-- Data API roles: unchanged (A writes, B is isolated, anon has nothing)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';

select lives_ok(
  $$ insert into public.events (title, starts_at, ends_at, visibility)
     values ('  Cena   dai nonni ', '2026-11-12 20:00+01', '2026-11-12 22:00+01', 'household') $$,
  'A inserts an event'
);
select results_eq(
  $$ select e.title, e.author_member_id, e.household_id from public.events e where e.title like 'Cena%' $$,
  $$ values ('Cena dai nonni'::text, 'a1000000-0000-4000-8000-000000000001'::uuid,
             '11111111-1111-4111-8111-111111111111'::uuid) $$,
  'the event of A is normalised, with A as author, in the household of A'
);
select throws_ok(
  $$ insert into public.events (title, starts_at, ends_at, visibility, escort_member_id)
     values ('Gita', '2026-11-13 09:00+01', '2026-11-13 10:00+01', 'household', 'a1000000-0000-4000-8000-000000000003') $$,
  '23514', 'the escort must be an adult of the household',
  'for A the escort of an event is still an adult'
);
select lives_ok(
  $$ insert into public.deadlines (title, due_date, assignee_member_id)
     values ('  Iscrizione   piscina ', '2026-12-03', 'a1000000-0000-4000-8000-000000000003') $$,
  'A inserts a deadline'
);
select results_eq(
  $$ select d.title, d.created_by_member_id from public.deadlines d where d.title like 'Iscrizione%' $$,
  $$ values ('Iscrizione piscina'::text, 'a1000000-0000-4000-8000-000000000001'::uuid) $$,
  'the deadline of A is normalised, with A as author'
);
select is(
  (select count(*)::integer from public.events e where e.id = 'c8000000-0000-4000-8000-000000000001'),
  1,
  'A sees the event written by the administrative key in the household of A'
);

set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select is_empty(
  $$ select 1 from public.events e where e.household_id = '11111111-1111-4111-8111-111111111111' $$,
  'B does not see the events of A'
);
select is_empty(
  $$ select 1 from public.deadlines d where d.id = 'c8000000-0000-4000-8000-000000000002' $$,
  'B does not see the deadline of A'
);
select is_empty(
  $$ select 1 from public.event_exceptions x where x.event_id = 'c8000000-0000-4000-8000-000000000001' $$,
  'B does not see the exceptions of A'
);
select throws_ok(
  $$ insert into public.events (household_id, title, starts_at, ends_at, visibility)
     values ('11111111-1111-4111-8111-111111111111', 'Intrusione', '2026-11-12 20:00+01', '2026-11-12 21:00+01', 'household') $$,
  '42501', null,
  'B cannot insert an event into the household of A'
);
select throws_ok(
  $$ insert into public.event_exceptions (event_id, household_id, occurrence_date, is_cancelled)
     values ('c8000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', '2026-11-24', true) $$,
  '42501', null,
  'B cannot insert an exception into an event of A'
);
select throws_ok(
  $$ insert into public.deadlines (household_id, title, due_date)
     values ('11111111-1111-4111-8111-111111111111', 'Intrusione', '2026-12-04') $$,
  '42501', null,
  'B cannot insert a deadline into the household of A'
);
select is_empty(
  $$ update public.events set title = 'Cambiato da B'
     where id = 'c8000000-0000-4000-8000-000000000001' returning 1 $$,
  'B cannot change an event of A'
);
select is_empty(
  $$ update public.deadlines set title = 'Cambiato da B'
     where id = 'c8000000-0000-4000-8000-000000000002' returning 1 $$,
  'B cannot change a deadline of A'
);
select is_empty(
  $$ delete from public.event_exceptions
     where event_id = 'c8000000-0000-4000-8000-000000000001' returning 1 $$,
  'B cannot delete an exception of A'
);

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok(
  $$ select 1 from public.events $$,
  '42501', null,
  'anon cannot read the events'
);
select throws_ok(
  $$ insert into public.deadlines (household_id, title, due_date)
     values ('11111111-1111-4111-8111-111111111111', 'Anonima', '2026-12-04') $$,
  '42501', null,
  'anon cannot insert a deadline'
);

reset role;
select results_eq(
  $$ select e.title from public.events e where e.id = 'c8000000-0000-4000-8000-000000000001' $$,
  $$ values ('Nuoto e corsa'::text) $$,
  'the event of A survived every attempt of B'
);

select * from finish();
rollback;
