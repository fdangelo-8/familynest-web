-- A change of the filter of the incoming events clears the position at the provider
-- (issue #295, CA-21 of #34): after «Solo giorni feriali» is switched off, the next
-- synchronisation reads everything again and the weekend events discarded before come
-- back. Changes that do not filter the incoming events keep the position.
-- Seed ids: Paolo (Casa Bianchi, user bbbbbbbb…02, member b1…02) has the fake account
-- e1…01 with «Personale» e2…01 (switched on, «Entrata e uscita»). Giulia (bbbbbbbb…01) is
-- the other adult of Casa Bianchi; Marco (aaaaaaaa…01) is in Casa D'Angelo.
-- sync_cursor is not readable by the app: it is read without role (owner).
begin;
create extension if not exists pgtap with schema extensions;

select plan(35);

-- ---------------------------------------------------------------------------
-- The trigger keeps the security shape of #276 and #287
-- ---------------------------------------------------------------------------
select ok(
  (select not p.prosecdef and p.proconfig @> array['search_path=""']
   from pg_proc p where p.oid = 'private.external_calendars_before_write()'::regprocedure),
  'the trigger is security invoker with an empty search_path'
);
select ok(
  (select p.prosrc !~ 'private\.'
   from pg_proc p where p.oid = 'private.external_calendars_before_write()'::regprocedure),
  'the trigger calls nothing in the private schema'
);
select ok(
  not has_schema_privilege('service_role', 'private', 'usage')
  and not has_function_privilege('authenticated', 'private.external_calendars_before_write()', 'execute')
  and not has_function_privilege('anon', 'private.external_calendars_before_write()', 'execute')
  and not has_column_privilege('authenticated', 'public.external_calendars', 'sync_cursor', 'select')
  and not has_column_privilege('authenticated', 'public.external_calendars', 'sync_cursor', 'update'),
  'no new privilege: the app still neither reads nor writes the position at the provider'
);

-- ---------------------------------------------------------------------------
-- «Solo giorni feriali» from true to false (the app, Paolo)
-- ---------------------------------------------------------------------------
update public.external_calendars set weekdays_only = true
where id = 'e2000000-0000-4000-8000-000000000001';
update public.external_calendars set sync_cursor = 'cursor-295-a'
where id = 'e2000000-0000-4000-8000-000000000001';
select is(
  (select c.sync_cursor from public.external_calendars c where c.id = 'e2000000-0000-4000-8000-000000000001'),
  'cursor-295-a',
  'start: «Solo giorni feriali» on, with a position at the provider'
);

set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok(
  $$ update public.external_calendars set weekdays_only = false
     where id = 'e2000000-0000-4000-8000-000000000001' $$,
  'CA-21: Paolo switches «Solo giorni feriali» off'
);
reset role;
select is(
  (select c.sync_cursor from public.external_calendars c where c.id = 'e2000000-0000-4000-8000-000000000001'),
  null,
  '#295: weekdays_only from true to false clears the position at the provider'
);

-- ---------------------------------------------------------------------------
-- Changes that do not filter the incoming events keep the position
-- ---------------------------------------------------------------------------
update public.external_calendars set sync_cursor = 'cursor-295-b'
where id = 'e2000000-0000-4000-8000-000000000001';

set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok(
  $$ update public.external_calendars set visibility = 'household'
     where id = 'e2000000-0000-4000-8000-000000000001' $$,
  'Paolo changes «Chi vede questi impegni nel Nest»'
);
select lives_ok(
  $$ update public.external_calendars set counts_for_free_time = false
     where id = 'e2000000-0000-4000-8000-000000000001' $$,
  'Paolo switches «Conta per Liberi insieme» off'
);
select lives_ok(
  $$ update public.external_calendars set direction = 'incoming'
     where id = 'e2000000-0000-4000-8000-000000000001' $$,
  'Paolo sets «Solo in entrata»'
);
select lives_ok(
  $$ update public.external_calendars set direction = 'two_way'
     where id = 'e2000000-0000-4000-8000-000000000001' $$,
  'Paolo sets «Entrata e uscita» again'
);
select lives_ok(
  $$ update public.external_calendars set weekdays_only = false, is_enabled = true
     where id = 'e2000000-0000-4000-8000-000000000001' $$,
  'Paolo saves «Solo giorni feriali» and «Sincronizza» with the same values'
);
reset role;
select is(
  (select c.sync_cursor from public.external_calendars c where c.id = 'e2000000-0000-4000-8000-000000000001'),
  'cursor-295-b',
  'visibility, «Liberi insieme», direction and unchanged values keep the position'
);

-- ---------------------------------------------------------------------------
-- «Solo giorni feriali» from false to true also reads everything again
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok(
  $$ update public.external_calendars set weekdays_only = true
     where id = 'e2000000-0000-4000-8000-000000000001' $$,
  'Paolo switches «Solo giorni feriali» on'
);
reset role;
select is(
  (select c.sync_cursor from public.external_calendars c where c.id = 'e2000000-0000-4000-8000-000000000001'),
  null,
  'weekdays_only from false to true clears the position too'
);

-- ---------------------------------------------------------------------------
-- The administrative key (service_role): the same rule, no 42501 (#277)
-- ---------------------------------------------------------------------------
set local role service_role;
set local request.jwt.claims to '{"role":"service_role"}';
select lives_ok(
  $$ update public.external_calendars set sync_cursor = 'cursor-295-c', last_synced_at = '2026-11-09 08:00+01'
     where id = 'e2000000-0000-4000-8000-000000000001' $$,
  'the administrative key writes the position at the provider'
);
reset role;
select is(
  (select c.sync_cursor from public.external_calendars c where c.id = 'e2000000-0000-4000-8000-000000000001'),
  'cursor-295-c',
  'a new position without a change of the filter is kept'
);
set local role service_role;
set local request.jwt.claims to '{"role":"service_role"}';
select lives_ok(
  $$ update public.external_calendars set weekdays_only = false
     where id = 'e2000000-0000-4000-8000-000000000001' $$,
  'the administrative key switches «Solo giorni feriali» off'
);
reset role;
select is(
  (select c.sync_cursor from public.external_calendars c where c.id = 'e2000000-0000-4000-8000-000000000001'),
  null,
  'also for the administrative key the change clears the position'
);

-- ---------------------------------------------------------------------------
-- The whole path: the Saturday event discarded comes back (CA-21)
-- Monday 9 November 2026, 9:00 in Rome; Saturday 14 November.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok(
  $$ update public.external_calendars set weekdays_only = true
     where id = 'e2000000-0000-4000-8000-000000000001' $$,
  'Paolo switches «Solo giorni feriali» on again'
);
set local role service_role;
set local request.jwt.claims to '{"role":"service_role"}';
select results_eq(
  $$ select * from public.sync_external_calendar_events(
       'e2000000-0000-4000-8000-000000000001',
       jsonb_build_array(
         jsonb_build_object('id', 'ev-295-weekday', 'title', 'Riunione 295',
           'starts_at', '2026-11-11 10:00+01', 'ends_at', '2026-11-11 11:00+01'),
         jsonb_build_object('id', 'ev-295-saturday', 'title', 'Pranzo 295',
           'starts_at', '2026-11-14 13:00+01', 'ends_at', '2026-11-14 15:00+01')),
       true, 'cursor-295-d', '2026-11-09 09:00+01') $$,
  $$ values (1, 0) $$,
  'with «Solo giorni feriali» only the weekday event is imported'
);
reset role;
select is(
  (select c.sync_cursor from public.external_calendars c where c.id = 'e2000000-0000-4000-8000-000000000001'),
  'cursor-295-d',
  'the synchronisation keeps its new position'
);

set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok(
  $$ update public.external_calendars set weekdays_only = false
     where id = 'e2000000-0000-4000-8000-000000000001' $$,
  'Paolo switches «Solo giorni feriali» off'
);
reset role;
select is(
  (select c.sync_cursor from public.external_calendars c where c.id = 'e2000000-0000-4000-8000-000000000001'),
  null,
  'the next synchronisation has no position: it reads the whole window'
);

-- The service, without a position, reads everything from the provider (complete list).
set local role service_role;
set local request.jwt.claims to '{"role":"service_role"}';
select results_eq(
  $$ select * from public.sync_external_calendar_events(
       'e2000000-0000-4000-8000-000000000001',
       jsonb_build_array(
         jsonb_build_object('id', 'ev-295-weekday', 'title', 'Riunione 295',
           'starts_at', '2026-11-11 10:00+01', 'ends_at', '2026-11-11 11:00+01'),
         jsonb_build_object('id', 'ev-295-saturday', 'title', 'Pranzo 295',
           'starts_at', '2026-11-14 13:00+01', 'ends_at', '2026-11-14 15:00+01')),
       true, 'cursor-295-e', '2026-11-09 09:30+01') $$,
  $$ values (1, 0) $$,
  'CA-21: the Saturday event comes back, the weekday one stays one'
);
reset role;
select results_eq(
  $$ select e.title from public.events e join public.event_external_links l on l.event_id = e.id
     where l.calendar_id = 'e2000000-0000-4000-8000-000000000001' and e.title like '% 295'
     order by e.starts_at $$,
  $$ values ('Riunione 295'::text), ('Pranzo 295') $$,
  'both events of the provider are in FamilyNest, each once'
);

-- ---------------------------------------------------------------------------
-- Isolation: the other adult of the household, another household, anon
-- ---------------------------------------------------------------------------
update public.external_calendars set sync_cursor = 'cursor-295-f'
where id = 'e2000000-0000-4000-8000-000000000001';

set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select is_empty(
  $$ with u as (
       update public.external_calendars set weekdays_only = true
       where id = 'e2000000-0000-4000-8000-000000000001' returning id
     ) select * from u $$,
  'Giulia (same household) changes no calendar of Paolo'
);
select throws_ok(
  $$ select c.sync_cursor from public.external_calendars c $$,
  '42501', null,
  'Giulia cannot read the position at the provider'
);

set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select is_empty(
  $$ with u as (
       update public.external_calendars set weekdays_only = true
       where id = 'e2000000-0000-4000-8000-000000000001' returning id
     ) select * from u $$,
  'Marco (Casa D''Angelo) changes no calendar of Paolo'
);
select is_empty(
  $$ select 1 from public.external_calendars $$,
  'Marco reads no calendar of Paolo'
);
select throws_ok(
  $$ update public.external_calendars set sync_cursor = null $$,
  '42501', null,
  'Marco cannot clear a position at the provider directly'
);

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok(
  $$ update public.external_calendars set weekdays_only = true $$,
  '42501', null,
  'anon cannot change the calendars'
);
select throws_ok(
  $$ select 1 from public.external_calendars $$,
  '42501', null,
  'anon reads no calendar'
);

reset role;
select results_eq(
  $$ select c.weekdays_only, c.sync_cursor from public.external_calendars c
     where c.id = 'e2000000-0000-4000-8000-000000000001' $$,
  $$ values (false, 'cursor-295-f'::text) $$,
  'after the refused changes «Solo giorni feriali» and the position of Paolo are unchanged'
);

-- Paolo, the adult of the calendar, reads it but not its position.
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select results_eq(
  $$ select c.weekdays_only from public.external_calendars c
     where c.id = 'e2000000-0000-4000-8000-000000000001' $$,
  $$ values (false) $$,
  'Paolo reads «Solo giorni feriali» of his calendar'
);
select throws_ok(
  $$ select c.sync_cursor from public.external_calendars c $$,
  '42501', null,
  'Paolo cannot read the position at the provider'
);

select * from finish();
rollback;
