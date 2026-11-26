-- Impegni 2.0 (issue #510, DB-1 of plan #501): «Tutto il giorno», the new repetitions,
-- «Lo riprende», «Da decidere», «Avviso» and «Da verificare» (CA-1 – CA-19), with the
-- privileges of the new columns and functions.
-- Seed ids: A = Marco (Casa D'Angelo, admin, user aaaaaaaa…01, member a1…01), B = Giulia
-- (Casa Bianchi, bbbbbbbb…01, b1…01), Paolo (Casa Bianchi, bbbbbbbb…02, b1…02, with the
-- fake calendar «Personale» e2…01). Casa D'Angelo: Laura a1…02, Sofia a1…03 (child),
-- Tommaso a1…04 (child), Biscotto a1…05 (pet).
-- This test gives Laura an account (user aaaaaaaa…02) and adds a third adult, Davide
-- (a1…06, user aaaaaaaa…03). The dates are fixed: no rule tested here depends on the
-- real clock. No health data (D1).
begin;
create extension if not exists pgtap with schema extensions;

select plan(85);

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-4000-8000-000000000002', 'authenticated',
   'authenticated', 'utente-laura@example.com', '{"full_name":"Laura Test"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-4000-8000-000000000003', 'authenticated',
   'authenticated', 'utente-davide@example.com', '{"full_name":"Davide Test"}', now(), now());
update public.household_members
set user_id = 'aaaaaaaa-0000-4000-8000-000000000002', joined_at = now()
where id = 'a1000000-0000-4000-8000-000000000002';
insert into public.household_members (id, household_id, kind, name, color, user_id, joined_at)
values ('a1000000-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111', 'adult', 'Davide',
        'lampone', 'aaaaaaaa-0000-4000-8000-000000000003', now());

-- ---------------------------------------------------------------------------
-- Schema and privileges
-- ---------------------------------------------------------------------------
select enum_has_labels(
  'public', 'event_field', array['title', 'day', 'time', 'members', 'location'],
  'event_field: the fields «Da verificare»'
);
select col_type_is('public', 'events', 'unverified_fields', 'event_field[]', 'unverified_fields is a list of event_field');
select col_not_null('public', 'events', 'all_day', 'all_day is mandatory');
select col_default_is('public', 'events', 'all_day', 'false', 'all_day is false by default');
select fk_ok(
  'public', 'events', array['pickup_member_id', 'household_id'],
  'public', 'household_members', array['id', 'household_id'],
  'the pickup is a member of the same household'
);
select fk_ok(
  'public', 'event_exceptions', array['pickup_member_id', 'household_id'],
  'public', 'household_members', array['id', 'household_id'],
  'the pickup of an occurrence is a member of the same household'
);
select has_index('public', 'events', 'events_pickup_member_id_idx', 'index on the pickup of events');
select has_index('public', 'event_exceptions', 'event_exceptions_pickup_member_id_idx', 'index on the pickup of event_exceptions');
select ok(
  has_column_privilege('authenticated', 'public.events', 'all_day', 'insert')
  and has_column_privilege('authenticated', 'public.events', 'pickup_member_id', 'update')
  and has_column_privilege('authenticated', 'public.events', 'unverified_fields', 'insert')
  and has_column_privilege('authenticated', 'public.event_exceptions', 'pickup_undecided', 'update')
  and not has_column_privilege('anon', 'public.events', 'pickup_member_id', 'select')
  and not has_column_privilege('anon', 'public.events', 'all_day', 'insert')
  and not has_column_privilege('anon', 'public.event_exceptions', 'pickup_member_id', 'select'),
  'the new columns are written by signed-in users only; anon has nothing'
);
select ok(
  not has_function_privilege('anon', 'public.list_calendar_events(timestamptz, timestamptz)', 'execute')
  and not has_function_privilege('anon', 'public.find_event_conflicts(timestamptz, timestamptz, uuid[], uuid, uuid, uuid)', 'execute')
  and not has_function_privilege('anon', 'public.list_event_overlaps(timestamptz, timestamptz)', 'execute')
  and not has_function_privilege('anon', 'public.confirm_event_fields(uuid, public.event_field[])', 'execute')
  and not has_function_privilege('anon', 'public.get_event_occurrence(uuid, date)', 'execute')
  and not has_function_privilege('anon', 'public.create_event(text, timestamptz, timestamptz, public.event_visibility, uuid[], text, uuid, public.event_recurrence, smallint[], date, text, boolean, uuid, boolean, boolean, integer, boolean, public.event_field[], uuid[])', 'execute')
  and not has_function_privilege('anon', 'public.update_event(uuid, date, text, timestamptz, timestamptz, public.event_visibility, uuid[], text, uuid, public.event_recurrence, smallint[], date, text, boolean, uuid, boolean, boolean, integer, boolean, uuid[])', 'execute')
  and not has_function_privilege('anon', 'public.update_event_occurrence(uuid, date, text, timestamptz, timestamptz, text, uuid, text, uuid, boolean, boolean)', 'execute'),
  'CA-24: anon cannot run any new or changed function'
);
select ok(
  has_function_privilege('authenticated', 'public.list_calendar_events(timestamptz, timestamptz)', 'execute')
  and has_function_privilege('authenticated', 'public.find_event_conflicts(timestamptz, timestamptz, uuid[], uuid, uuid, uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.list_event_overlaps(timestamptz, timestamptz)', 'execute')
  and has_function_privilege('authenticated', 'public.confirm_event_fields(uuid, public.event_field[])', 'execute')
  and has_function_privilege('authenticated', 'public.update_event_occurrence(uuid, date, text, timestamptz, timestamptz, text, uuid, text, uuid, boolean, boolean)', 'execute'),
  'signed-in users run the new functions'
);
select ok(
  (select bool_and(p.prosecdef and p.proconfig @> array['search_path=""']) from pg_proc p
   where p.oid in (
     'public.list_calendar_events(timestamptz, timestamptz)'::regprocedure,
     'public.find_event_conflicts(timestamptz, timestamptz, uuid[], uuid, uuid, uuid)'::regprocedure,
     'public.list_event_overlaps(timestamptz, timestamptz)'::regprocedure
   ))
  and (select bool_and(not p.prosecdef and p.proconfig @> array['search_path=""']) from pg_proc p
   where p.oid in (
     'public.confirm_event_fields(uuid, public.event_field[])'::regprocedure,
     'public.get_event_occurrence(uuid, date)'::regprocedure,
     'public.update_event_occurrence(uuid, date, text, timestamptz, timestamptz, text, uuid, text, uuid, boolean, boolean)'::regprocedure
   )),
  'the readers of the calendar are security definer, the others security invoker, all with an empty search_path'
);
select ok(
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname in ('create_event', 'update_event', 'update_event_occurrence', 'get_event_occurrence')) = 4,
  'one signature each for create_event, update_event, update_event_occurrence and get_event_occurrence (the old ones are gone)'
);
select ok(
  (select p.provolatile = 's' from pg_proc p where p.oid = 'public.find_event_conflicts(timestamptz, timestamptz, uuid[], uuid, uuid, uuid)'::regprocedure)
  and (select p.provolatile = 's' from pg_proc p where p.oid = 'public.list_event_overlaps(timestamptz, timestamptz)'::regprocedure),
  'the overlapping events are computed, never stored (stable functions)'
);

-- ---------------------------------------------------------------------------
-- «Tutto il giorno» (CA-1, CA-2)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';

select lives_ok(
  $$ select set_config('test.gita', public.create_event(
       'Gita', '2026-12-01 00:00+01', '2026-12-02 00:00+01', 'household', array[]::uuid[],
       p_all_day => true
     )::text, true) $$,
  'CA-1: Marco creates an event «tutto il giorno»'
);
select results_eq(
  $$ select e.all_day from public.events e where e.id = current_setting('test.gita')::uuid $$,
  $$ values (true) $$,
  'CA-1: the row has all_day = true'
);
select results_eq(
  $$ select c.all_day, c.counts_for_free_time from public.list_calendar_events('2026-12-01 00:00+01', '2026-12-02 00:00+01') c
     where c.id = current_setting('test.gita')::uuid $$,
  $$ values (true, false) $$,
  'CA-1: in list_calendar_events it never counts for «Liberi insieme»'
);
select throws_ok(
  $$ select public.create_event(
       'Gita sbagliata', '2026-12-01 17:00+01', '2026-12-02 00:00+01', 'household', array[]::uuid[],
       p_all_day => true
     ) $$,
  '23514', null,
  'CA-2: an event «tutto il giorno» that starts at 17:00 is refused'
);
select is_empty(
  $$ select 1 from public.events e where e.title = 'Gita sbagliata' $$,
  'CA-2: no row is written'
);

-- ---------------------------------------------------------------------------
-- New repetitions (CA-3 – CA-8)
-- ---------------------------------------------------------------------------
select lives_ok(
  $$ select set_config('test.daily', public.create_event(
       'Compiti', '2026-12-07 17:00+01', '2026-12-07 18:00+01', 'household', array[]::uuid[],
       p_recurrence => 'daily', p_recurrence_until => '2026-12-13'
     )::text, true) $$,
  'CA-3: Marco creates a daily event from Monday 7 to Sunday 13 December'
);
select results_eq(
  $$ select count(*)::integer, bool_and((c.starts_at at time zone 'Europe/Rome')::time = time '17:00')
     from public.list_calendar_events('2026-12-07 00:00+01', '2026-12-14 00:00+01') c
     where c.id = current_setting('test.daily')::uuid $$,
  $$ values (7, true) $$,
  'CA-3: seven occurrences in the week, all at 17:00 in Rome'
);
select throws_ok(
  $$ select public.create_event(
       'Turno lungo', '2026-12-07 17:00+01', '2026-12-08 18:00+01', 'household', array[]::uuid[],
       p_recurrence => 'daily'
     ) $$,
  '23514', null,
  'CA-4: a daily event of 25 hours is refused'
);
select lives_ok(
  $$ select set_config('test.biweekly', public.create_event(
       'Inglese', '2026-12-01 17:00+01', '2026-12-01 18:00+01', 'household', array[]::uuid[],
       p_recurrence => 'biweekly', p_recurrence_weekdays => array[2]::smallint[]
     )::text, true) $$,
  'CA-5: Marco creates an event every two weeks on Tuesday 1 December'
);
select results_eq(
  $$ select (c.starts_at at time zone 'Europe/Rome')::date
     from public.list_calendar_events('2026-12-01 00:00+01', '2026-12-30 00:00+01') c
     where c.id = current_setting('test.biweekly')::uuid
     order by c.starts_at $$,
  $$ values ('2026-12-01'::date), ('2026-12-15'), ('2026-12-29') $$,
  'CA-5: occurrences on the 1st, 15th and 29th, none on the 8th and 22nd'
);
select throws_ok(
  $$ select public.create_event(
       'Senza giorni', '2026-12-01 17:00+01', '2026-12-01 18:00+01', 'household', array[]::uuid[],
       p_recurrence => 'biweekly'
     ) $$,
  '23514', null,
  'CA-6: every two weeks without days of the week is refused'
);
select throws_ok(
  $$ select public.create_event(
       'Con giorni', '2026-12-01 17:00+01', '2026-12-01 18:00+01', 'household', array[]::uuid[],
       p_recurrence => 'daily', p_recurrence_weekdays => array[2]::smallint[]
     ) $$,
  '23514', null,
  'CA-6: every day with days of the week is refused'
);
select lives_ok(
  $$ select set_config('test.yearly', public.create_event(
       'Anniversario', '2028-02-29 10:00+01', '2028-02-29 11:00+01', 'household', array[]::uuid[],
       p_recurrence => 'yearly'
     )::text, true) $$,
  'CA-7: Marco creates a yearly event on 29 February 2028'
);
select is_empty(
  $$ select 1 from public.list_calendar_events('2029-02-01 00:00+01', '2029-03-01 00:00+01') c
     where c.id = current_setting('test.yearly')::uuid $$,
  'CA-7: no occurrence in February 2029'
);
select results_eq(
  $$ select (c.starts_at at time zone 'Europe/Rome')::date
     from public.list_calendar_events('2032-02-01 00:00+01', '2032-03-01 00:00+01') c
     where c.id = current_setting('test.yearly')::uuid $$,
  $$ values ('2032-02-29'::date) $$,
  'CA-7: the 29th in February 2032'
);
select lives_ok(
  $$ select set_config('test.weekly', public.create_event(
       'Calcio', '2026-10-20 17:00+02', '2026-10-20 18:00+02', 'household', array[]::uuid[],
       p_recurrence => 'weekly', p_recurrence_weekdays => array[2]::smallint[]
     )::text, true) $$,
  'CA-8: Marco creates a weekly event at 17:00 on Tuesday 20 October 2026'
);
select results_eq(
  $$ select (c.starts_at at time zone 'Europe/Rome')::time
     from public.list_calendar_events('2026-11-03 00:00+01', '2026-11-04 00:00+01') c
     where c.id = current_setting('test.weekly')::uuid $$,
  $$ values (time '17:00') $$,
  'CA-8: on Tuesday 3 November (after the change of the clock) it still starts at 17:00 in Rome'
);
select results_eq(
  $$ select (o.starts_at at time zone 'Europe/Rome')::time, (o.ends_at at time zone 'Europe/Rome')::time
     from public.get_event_occurrence(current_setting('test.weekly')::uuid, '2026-11-03') o $$,
  $$ values (time '17:00', time '18:00') $$,
  'CA-8: get_event_occurrence gives the same local times'
);

-- An event «tutto il giorno» that repeats ends at 0:00 also across the change of the clock.
select lives_ok(
  $$ select set_config('test.allday_weekly', public.create_event(
       'Mercato', '2026-10-18 00:00+02', '2026-10-19 00:00+02', 'household', array[]::uuid[],
       p_all_day => true, p_recurrence => 'weekly', p_recurrence_weekdays => array[7]::smallint[]
     )::text, true) $$,
  'an event «tutto il giorno» every Sunday'
);
select results_eq(
  $$ select (c.starts_at at time zone 'Europe/Rome')::time, (c.ends_at at time zone 'Europe/Rome')::time,
            (c.ends_at at time zone 'Europe/Rome')::date
     from public.list_calendar_events('2026-10-25 00:00+02', '2026-10-26 00:00+01') c
     where c.id = current_setting('test.allday_weekly')::uuid $$,
  $$ values (time '00:00', time '00:00', '2026-10-26'::date) $$,
  'the occurrence of Sunday 25 October (25 hours long) goes from 0:00 to 0:00 of Monday'
);

-- ---------------------------------------------------------------------------
-- «Lo porta», «Lo riprende», «Da decidere» (CA-9 – CA-13)
-- ---------------------------------------------------------------------------
select lives_ok(
  $$ select set_config('test.sofia', public.create_event(
       'Danza Sofia', '2026-12-02 17:00+01', '2026-12-02 18:00+01', 'busy',
       array['a1000000-0000-4000-8000-000000000003']::uuid[],
       p_escort_member_id => 'a1000000-0000-4000-8000-000000000001',
       p_pickup_member_id => 'a1000000-0000-4000-8000-000000000002'
     )::text, true) $$,
  'CA-9: Marco creates a «Occupato» event of Sofia, taken by Marco and picked up by Laura'
);
select results_eq(
  $$ select e.escort_member_id, e.pickup_member_id from public.events e where e.id = current_setting('test.sofia')::uuid $$,
  $$ values ('a1000000-0000-4000-8000-000000000001'::uuid, 'a1000000-0000-4000-8000-000000000002'::uuid) $$,
  'CA-9: the row has who takes and who picks up'
);

set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}';
select results_eq(
  $$ select e.title from public.events e where e.id = current_setting('test.sofia')::uuid $$,
  $$ values ('Danza Sofia'::text) $$,
  'CA-9: Laura, who picks up, reads the «Occupato» event from the table'
);
select results_eq(
  $$ select c.is_masked, c.title, c.pickup_member_id from public.list_calendar_events('2026-12-02 00:00+01', '2026-12-03 00:00+01') c
     where c.id = current_setting('test.sofia')::uuid $$,
  $$ values (false, 'Danza Sofia'::text, 'a1000000-0000-4000-8000-000000000002'::uuid) $$,
  'CA-9: and sees it in full in the calendar'
);

set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000003","role":"authenticated"}';
select results_eq(
  $$ select c.is_masked, c.id, c.title, c.pickup_member_id, c.all_day, c.escort_undecided
     from public.list_calendar_events('2026-12-02 00:00+01', '2026-12-03 00:00+01') c
     where c.author_member_id = 'a1000000-0000-4000-8000-000000000001' and c.visibility = 'busy' $$,
  $$ values (true, null::uuid, null::text, null::uuid, null::boolean, null::boolean) $$,
  'Davide, not involved, sees it only as «Occupato», without the new columns'
);

set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ update public.events set pickup_member_id = 'a1000000-0000-4000-8000-000000000003'
     where id = current_setting('test.gita')::uuid $$,
  '23514', null,
  'CA-10: Sofia (a child) cannot pick up'
);
select throws_ok(
  $$ update public.events set pickup_member_id = 'a1000000-0000-4000-8000-000000000005'
     where id = current_setting('test.gita')::uuid $$,
  '23514', null,
  'CA-10: Biscotto (a pet) cannot pick up'
);
select throws_ok(
  $$ update public.events set pickup_member_id = 'b1000000-0000-4000-8000-000000000001'
     where id = current_setting('test.gita')::uuid $$,
  '23503', null,
  'CA-10: the adult of household B cannot pick up'
);
select throws_ok(
  $$ select public.create_event(
       'Sbagliato', '2026-12-02 17:00+01', '2026-12-02 18:00+01', 'household', array[]::uuid[],
       p_pickup_member_id => 'b1000000-0000-4000-8000-000000000001'
     ) $$,
  '23503', null,
  'CA-10: also through create_event'
);
select throws_ok(
  $$ select public.create_event(
       'Doppio ritorno', '2026-12-02 17:00+01', '2026-12-02 18:00+01', 'household', array[]::uuid[],
       p_pickup_member_id => 'a1000000-0000-4000-8000-000000000002', p_pickup_undecided => true
     ) $$,
  '23514', null,
  'CA-11: a pickup and «Da decidere» together are refused'
);
select throws_ok(
  $$ update public.events set escort_undecided = true where id = current_setting('test.sofia')::uuid $$,
  '23514', null,
  'CA-11: the same for the way there'
);
select lives_ok(
  $$ select set_config('test.series', public.create_event(
       'Nuoto', '2026-12-01 17:00+01', '2026-12-01 18:00+01', 'household',
       array['a1000000-0000-4000-8000-000000000004']::uuid[],
       p_recurrence => 'weekly', p_recurrence_weekdays => array[2]::smallint[], p_escort_undecided => true
     )::text, true) $$,
  'CA-12: a weekly event with «Lo porta: da decidere»'
);

set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok(
  $$ select public.update_event_occurrence(
       current_setting('test.series')::uuid, '2026-12-08', 'Nuoto', '2026-12-08 17:00+01', '2026-12-08 18:00+01',
       null, 'a1000000-0000-4000-8000-000000000002', null
     ) $$,
  'CA-12: Laura takes Tommaso on Tuesday 8 December only'
);
select results_eq(
  $$ select o.escort_member_id, o.escort_undecided from public.get_event_occurrence(current_setting('test.series')::uuid, '2026-12-08') o $$,
  $$ values ('a1000000-0000-4000-8000-000000000002'::uuid, false) $$,
  'CA-12: that occurrence has Laura and is no longer «Da decidere»'
);
select results_eq(
  $$ select o.escort_member_id, o.escort_undecided from public.get_event_occurrence(current_setting('test.series')::uuid, '2026-12-15') o $$,
  $$ values (null::uuid, true) $$,
  'CA-12: the other occurrences stay «Da decidere»'
);
select results_eq(
  $$ select (c.starts_at at time zone 'Europe/Rome')::date, c.escort_member_id, c.escort_undecided
     from public.list_calendar_events('2026-12-07 00:00+01', '2026-12-16 00:00+01') c
     where c.id = current_setting('test.series')::uuid order by c.starts_at $$,
  $$ values ('2026-12-08'::date, 'a1000000-0000-4000-8000-000000000002'::uuid, false),
            ('2026-12-15', null, true) $$,
  'CA-12: the calendar shows the same'
);

-- CA-13: a «Occupato» of Marco where Laura is not involved.
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok(
  $$ select set_config('test.marco_busy', public.create_event(
       'Dentista Marco', '2026-12-03 09:00+01', '2026-12-03 10:00+01', 'busy', array[]::uuid[]
     )::text, true) $$,
  'CA-13: Marco creates a «Occupato» event of his'
);
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}';
select is_empty(
  $$ update public.events set pickup_member_id = 'a1000000-0000-4000-8000-000000000002'
     where id = current_setting('test.marco_busy')::uuid returning id $$,
  'CA-13: Laura cannot set herself as pickup from the table (0 rows)'
);
select throws_ok(
  $$ select * from public.update_event(
       current_setting('test.marco_busy')::uuid, null, 'Dentista Marco', '2026-12-03 09:00+01', '2026-12-03 10:00+01',
       'busy', array[]::uuid[], null, null, 'none', null, null, null,
       p_pickup_member_id => 'a1000000-0000-4000-8000-000000000002'
     ) $$,
  'P0002', null,
  'CA-13: nor with update_event (the event is not found, nothing said about it)'
);
-- Laura as a participant of a «Occupato» of Marco: she sees it, but only the author adds people.
reset role;
insert into public.event_members (event_id, member_id, household_id)
values (current_setting('test.marco_busy')::uuid, 'a1000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111');
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok(
  $$ update public.events set pickup_member_id = 'a1000000-0000-4000-8000-000000000002'
     where id = current_setting('test.marco_busy')::uuid $$,
  '42501', null,
  'CA-13: a participant who sees the event still cannot set the pickup (only the author)'
);
reset role;
select results_eq(
  $$ select e.pickup_member_id from public.events e where e.id = current_setting('test.marco_busy')::uuid $$,
  $$ values (null::uuid) $$,
  'CA-13: the value does not change'
);

-- ---------------------------------------------------------------------------
-- Imported events (CA-14)
-- ---------------------------------------------------------------------------
insert into public.events (id, household_id, author_member_id, title, starts_at, ends_at, visibility)
values ('b5100000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222',
        'b1000000-0000-4000-8000-000000000002', 'Dal calendario', '2026-12-04 10:00+01', '2026-12-04 11:00+01', 'busy');
insert into public.event_external_links (household_id, event_id, calendar_id, origin, provider_event_id)
values ('22222222-2222-4222-8222-222222222222', 'b5100000-0000-4000-8000-000000000001',
        'e2000000-0000-4000-8000-000000000001', 'imported', 'fake-510-1');
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok(
  $$ update public.events set pickup_member_id = 'b1000000-0000-4000-8000-000000000001'
     where id = 'b5100000-0000-4000-8000-000000000001' $$,
  '42501', null,
  'CA-14: the author of an imported event cannot set the pickup'
);
select throws_ok(
  $$ update public.events set reminder_minutes_before = 60 where id = 'b5100000-0000-4000-8000-000000000001' $$,
  '42501', null,
  'imported events have no reminder'
);
select throws_ok(
  $$ update public.events set visibility = 'selected' where id = 'b5100000-0000-4000-8000-000000000001' $$,
  '42501', null,
  'an imported event is never «Solo alcune persone»'
);
reset role;
select throws_ok(
  $$ update public.external_calendars set visibility = 'selected' where id = 'e2000000-0000-4000-8000-000000000001' $$,
  '23514', null,
  'nor are the events of a linked calendar'
);

-- ---------------------------------------------------------------------------
-- Notifications (CA-15)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok(
  $$ select set_config('test.ritorno', public.create_event(
       'Festa di Tommaso', '2026-12-05 16:00+01', '2026-12-05 18:00+01', 'household',
       array['a1000000-0000-4000-8000-000000000004']::uuid[],
       p_pickup_member_id => 'a1000000-0000-4000-8000-000000000002'
     )::text, true) $$,
  'CA-15: an event of Tommaso picked up by Laura'
);
select lives_ok(
  $$ update public.events set starts_at = '2026-12-05 16:30+01', ends_at = '2026-12-05 18:30+01'
     where id = current_setting('test.ritorno')::uuid $$,
  'CA-15: Marco changes its times'
);
reset role;
select results_eq(
  $$ select n.recipient_member_id, n.kind::text from public.notifications n
     where n.event_id = current_setting('test.ritorno')::uuid $$,
  $$ values ('a1000000-0000-4000-8000-000000000002'::uuid, 'event_time_changed'::text) $$,
  'CA-15: Laura, who picks up, gets «event_time_changed»'
);
-- One occurrence: the pickup of that occurrence is notified too.
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok(
  $$ select public.update_event_occurrence(
       current_setting('test.series')::uuid, '2026-12-22', 'Nuoto', '2026-12-22 17:30+01', '2026-12-22 18:30+01',
       null, null, null, 'a1000000-0000-4000-8000-000000000006'
     ) $$,
  'Marco moves the occurrence of 22 December, picked up by Davide'
);
reset role;
select results_eq(
  $$ select n.recipient_member_id from public.notifications n
     where n.event_id = current_setting('test.series')::uuid and n.occurrence_date = '2026-12-22'
     order by n.recipient_member_id $$,
  $$ values ('a1000000-0000-4000-8000-000000000006'::uuid) $$,
  'the pickup of that occurrence is notified of the new time'
);

-- ---------------------------------------------------------------------------
-- «Avviso» (CA-17) and «Da verificare» (CA-18, CA-19)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select public.create_event('Avviso zero', '2026-12-06 10:00+01', '2026-12-06 11:00+01', 'household', array[]::uuid[],
       p_reminder_minutes_before => 0) $$,
  '23514', null,
  'CA-17: a reminder of 0 minutes is refused'
);
select throws_ok(
  $$ select public.create_event('Avviso lungo', '2026-12-06 10:00+01', '2026-12-06 11:00+01', 'household', array[]::uuid[],
       p_reminder_minutes_before => 10081) $$,
  '23514', null,
  'CA-17: a reminder of 10081 minutes is refused'
);
select lives_ok(
  $$ select set_config('test.avviso', public.create_event('Avviso giusto', '2026-12-06 10:00+01', '2026-12-06 11:00+01',
       'household', array[]::uuid[], p_reminder_minutes_before => 60, p_remind_rides => true)::text, true) $$,
  'CA-17: a reminder of 60 minutes is saved'
);
select results_eq(
  $$ select e.reminder_minutes_before, e.remind_rides from public.events e where e.id = current_setting('test.avviso')::uuid $$,
  $$ values (60, true) $$,
  'CA-17: the row has 60'
);
select lives_ok(
  $$ select set_config('test.verify', public.create_event('Da una foto', '2026-12-06 15:00+01', '2026-12-06 16:00+01',
       'household', array[]::uuid[], p_unverified_fields => array['time', 'members']::public.event_field[])::text, true) $$,
  'CA-18: an event with «Da verificare» on the time and the people'
);

set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}';
select results_eq(
  $$ select c.unverified_fields from public.list_calendar_events('2026-12-06 00:00+01', '2026-12-07 00:00+01') c
     where c.id = current_setting('test.verify')::uuid $$,
  $$ values (array['time', 'members']::public.event_field[]) $$,
  'CA-18: Laura, who sees it in full, sees the mark'
);
select lives_ok(
  $$ select public.confirm_event_fields(current_setting('test.verify')::uuid, array['time']::public.event_field[]) $$,
  'CA-18: Laura confirms the time'
);
select results_eq(
  $$ select e.unverified_fields from public.events e where e.id = current_setting('test.verify')::uuid $$,
  $$ values (array['members']::public.event_field[]) $$,
  'CA-18: the people are still to verify'
);
select throws_ok(
  $$ update public.events set unverified_fields = array['members', 'day']::public.event_field[]
     where id = current_setting('test.verify')::uuid $$,
  '42501', null,
  'CA-19: Laura cannot add «day» to the list'
);
select throws_ok(
  $$ select public.confirm_event_fields(current_setting('test.verify')::uuid, array[null]::public.event_field[]) $$,
  '22023', null,
  'confirm_event_fields refuses a list with null'
);
select results_eq(
  $$ select e.unverified_fields from public.events e where e.id = current_setting('test.verify')::uuid $$,
  $$ values (array['members']::public.event_field[]) $$,
  'CA-19: the list did not get longer'
);
select lives_ok(
  $$ select public.confirm_event_fields(current_setting('test.verify')::uuid, null) $$,
  'CA-18: «Sì, confermo» (null) confirms everything'
);
select results_eq(
  $$ select e.unverified_fields from public.events e where e.id = current_setting('test.verify')::uuid $$,
  $$ values (array[]::public.event_field[]) $$,
  'CA-18: the list is empty'
);
-- Household B never confirms anything of A.
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select public.confirm_event_fields(current_setting('test.sofia')::uuid, null) $$,
  'P0002', null,
  'CA-24: household B cannot confirm the fields of an event of A'
);

-- ---------------------------------------------------------------------------
-- update_event and the split of a series keep the new values
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok(
  $$ select set_config('test.split', (select u.id from public.update_event(
       current_setting('test.series')::uuid, '2026-12-15', 'Nuoto', '2026-12-15 17:00+01', '2026-12-15 18:00+01',
       'household', array['a1000000-0000-4000-8000-000000000004']::uuid[], null, null,
       'weekly', array[2]::smallint[], null, null,
       p_pickup_member_id => 'a1000000-0000-4000-8000-000000000002', p_reminder_minutes_before => 30
     ) u)::text, true) $$,
  'update_event «tutti i prossimi» from 15 December with a pickup and a reminder'
);
select results_eq(
  $$ select e.pickup_member_id, e.reminder_minutes_before, e.escort_undecided from public.events e
     where e.id = current_setting('test.split')::uuid $$,
  $$ values ('a1000000-0000-4000-8000-000000000002'::uuid, 30, false) $$,
  'the new part has the new values'
);
select results_eq(
  $$ select e.pickup_member_id, e.reminder_minutes_before, e.escort_undecided from public.events e
     where e.id = current_setting('test.series')::uuid $$,
  $$ values (null::uuid, null::integer, true) $$,
  'the part before keeps its own'
);

-- The search finds the events of the person who picks up (risposta 81).
select results_eq(
  $$ select s.id from public.search_household(p_member_id => 'a1000000-0000-4000-8000-000000000002',
       p_from => '2026-12-05', p_to => '2026-12-05', p_kinds => array['event']::public.search_result_kind[]) s $$,
  $$ values (current_setting('test.ritorno')::uuid) $$,
  'the filter by person of the search finds the events Laura picks up'
);

-- «Liberi insieme»: the person who picks up is busy.
reset role;
insert into public.events (id, household_id, author_member_id, title, starts_at, ends_at, visibility, pickup_member_id)
values ('a5100000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
        'a1000000-0000-4000-8000-000000000001', 'Ritiro sera', '2027-01-13 18:00+01', '2027-01-13 22:30+01',
        'household', 'a1000000-0000-4000-8000-000000000002');
select is(
  private.free_together_start('a1000000-0000-4000-8000-000000000001', '2027-01-13'),
  null,
  'an evening in which Laura picks up from 18:00 to 22:30 has no window «Liberi insieme»'
);
update public.events set pickup_member_id = null where id = 'a5100000-0000-4000-8000-000000000001';
select is(
  private.free_together_start('a1000000-0000-4000-8000-000000000001', '2027-01-13'),
  '2027-01-13 18:00+01'::timestamptz,
  'without the pickup the evening is free'
);

-- ---------------------------------------------------------------------------
-- Leaving the household (CA-16)
-- ---------------------------------------------------------------------------
delete from public.household_members where id = 'a1000000-0000-4000-8000-000000000002';
select results_eq(
  $$ select e.title, e.pickup_member_id from public.events e
     where e.id in (current_setting('test.sofia')::uuid, current_setting('test.ritorno')::uuid)
     order by e.title $$,
  $$ values ('Danza Sofia'::text, null::uuid), ('Festa di Tommaso', null) $$,
  'CA-16: the events Laura picked up stay, without pickup'
);

select * from finish();
rollback;
