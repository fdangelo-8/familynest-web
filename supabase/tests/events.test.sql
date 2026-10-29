-- events and event_members: schema, privileges, isolation, visibility, constraints and
-- cleanup when a member leaves (issue #86, for #20, #25, #30).
-- Seed ids: A = Marco (Casa D'Angelo), B = Giulia (Casa Bianchi, admin),
-- B2 = Paolo (Casa Bianchi, not admin), C = Chiara (no household).
-- Members: Casa Bianchi Giulia b1…01, Paolo b1…02, Leo b1…03 (child), Anna b1…04 (adult
-- without account); Casa D'Angelo Marco a1…01, Laura a1…02, Sofia a1…03 (child).
-- The seed has no events: every event below is created by the test. No health data (D1).
begin;
create extension if not exists pgtap with schema extensions;

select plan(120);

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------
select has_table('public', 'events', 'events exists');
select has_table('public', 'event_members', 'event_members exists');
select ok(
  (select c.relrowsecurity from pg_class c where c.oid = 'public.events'::regclass),
  'RLS enabled on events'
);
select ok(
  (select c.relrowsecurity from pg_class c where c.oid = 'public.event_members'::regclass),
  'RLS enabled on event_members'
);
select columns_are(
  'public', 'events',
  array[
    'id', 'household_id', 'author_member_id', 'title', 'location', 'starts_at', 'ends_at',
    'visibility', 'escort_member_id', 'recurrence', 'recurrence_weekdays', 'recurrence_until',
    'created_at', 'updated_at'
  ],
  'events has exactly the planned columns (no notes, no health data)'
);
select columns_are(
  'public', 'event_members',
  array['event_id', 'member_id', 'household_id', 'created_at'],
  'event_members has exactly the planned columns'
);
select enum_has_labels('public', 'event_visibility', array['private', 'busy', 'household'], 'event_visibility labels');
select enum_has_labels('public', 'event_recurrence', array['none', 'weekly', 'monthly'], 'event_recurrence labels');
select fk_ok(
  'public', 'events', 'household_id', 'public', 'households', 'id',
  'events.household_id references households'
);
select fk_ok(
  'public', 'events', array['author_member_id', 'household_id'],
  'public', 'household_members', array['id', 'household_id'],
  'events author is a member of the same household'
);
select fk_ok(
  'public', 'events', array['escort_member_id', 'household_id'],
  'public', 'household_members', array['id', 'household_id'],
  'events escort is a member of the same household'
);
select fk_ok(
  'public', 'event_members', array['event_id', 'household_id'],
  'public', 'events', array['id', 'household_id'],
  'event_members event is in the same household'
);
select fk_ok(
  'public', 'event_members', array['member_id', 'household_id'],
  'public', 'household_members', array['id', 'household_id'],
  'event_members member is in the same household'
);
select has_index('public', 'events', 'events_household_starts_idx', 'index on events (household_id, starts_at)');
select has_index('public', 'events', 'events_author_member_id_idx', 'index on events.author_member_id');
select has_index('public', 'events', 'events_escort_member_id_idx', 'index on events.escort_member_id');
select has_index('public', 'event_members', 'event_members_member_id_idx', 'index on event_members.member_id');
select has_index('public', 'event_members', 'event_members_household_id_idx', 'index on event_members.household_id');

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
select ok(
  not has_table_privilege('anon', 'public.events', 'select, insert, update, delete')
  and not has_table_privilege('anon', 'public.event_members', 'select, insert, update, delete'),
  'anon has no privilege on events and event_members'
);
select ok(
  not has_column_privilege('authenticated', 'public.events', 'id', 'insert')
  and not has_column_privilege('authenticated', 'public.events', 'author_member_id', 'insert')
  and not has_column_privilege('authenticated', 'public.events', 'created_at', 'insert')
  and not has_column_privilege('authenticated', 'public.events', 'updated_at', 'insert'),
  'the app cannot choose id, author or row times of an event'
);
select ok(
  not has_column_privilege('authenticated', 'public.events', 'id', 'update')
  and not has_column_privilege('authenticated', 'public.events', 'household_id', 'update')
  and not has_column_privilege('authenticated', 'public.events', 'author_member_id', 'update')
  and not has_column_privilege('authenticated', 'public.events', 'created_at', 'update'),
  'the app cannot change id, household, author or creation time of an event'
);
select ok(
  not has_table_privilege('authenticated', 'public.event_members', 'update'),
  'participants are never updated (removed and added again)'
);
select ok(
  not has_function_privilege('anon', 'public.list_household_events(timestamptz, timestamptz)', 'execute')
  and has_function_privilege('authenticated', 'public.list_household_events(timestamptz, timestamptz)', 'execute'),
  'list_household_events is for signed-in users only'
);
select ok(
  not has_function_privilege('authenticated', 'private.household_members_delete_private_events()', 'execute')
  and not has_function_privilege('authenticated', 'private.event_occurrence_starts(timestamptz, public.event_recurrence, smallint[], date, timestamptz, timestamptz)', 'execute'),
  'internal event functions cannot be called by the app'
);

-- ---------------------------------------------------------------------------
-- Paolo (B2) creates his events
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';

select lives_ok(
  $$ insert into public.events (title, location, starts_at, ends_at, visibility)
     values (E'  Riunione \t segreta ', 'Ufficio Nord', '2026-10-20 09:00+02', '2026-10-20 15:00+02', 'busy') $$,
  'B2 adds an «Occupato» event (household omitted)'
);
select lives_ok(
  $$ insert into public.events (household_id, title, location, starts_at, ends_at, visibility)
     values ('22222222-2222-4222-8222-222222222222', 'Prova privata', '   ', '2026-10-20 10:00+02', '2026-10-20 11:00+02', 'private') $$,
  'B2 adds a «Solo io» event'
);
select lives_ok(
  $$ insert into public.events (title, starts_at, ends_at, visibility, recurrence, recurrence_weekdays, recurrence_until)
     values ('Piscina', '2026-10-20 17:00+02', '2026-10-20 18:00+02', 'household', 'weekly', '{4,2,2}', '2026-12-17') $$,
  'B2 adds a weekly «Tutto il Nest» event'
);
select lives_ok(
  $$ insert into public.events (title, starts_at, ends_at, visibility)
     values ('Sorpresa', '2026-10-21 12:00+02', '2026-10-21 13:00+02', 'private') $$,
  'B2 adds a «Solo io» event that will involve Giulia'
);
select lives_ok(
  $$ insert into public.events (title, starts_at, ends_at, visibility, escort_member_id)
     values ('Corsa', '2026-10-22 07:00+02', '2026-10-22 08:00+02', 'busy', 'b1000000-0000-4000-8000-000000000001') $$,
  'B2 adds an «Occupato» event accompanied by Giulia'
);
select lives_ok(
  $$ insert into public.events (title, starts_at, ends_at, visibility, escort_member_id)
     values ('Inglese', '2026-10-23 16:00+02', '2026-10-23 17:00+02', 'household', 'b1000000-0000-4000-8000-000000000004') $$,
  'B2 adds an event accompanied by Anna (adult without account)'
);
select lives_ok(
  $$ insert into public.events (title, starts_at, ends_at, visibility, escort_member_id)
     values ('Regalo', '2026-10-24 15:00+02', '2026-10-24 16:00+02', 'private', 'b1000000-0000-4000-8000-000000000001') $$,
  'B2 adds a «Solo io» event accompanied by Giulia'
);
select set_config('test.gift', (select e.id::text from public.events e where e.title = 'Regalo'), true);

select set_config('test.busy', (select e.id::text from public.events e where e.title = 'Riunione segreta'), true);
select set_config('test.private', (select e.id::text from public.events e where e.title = 'Prova privata'), true);
select set_config('test.pool', (select e.id::text from public.events e where e.title = 'Piscina'), true);
select set_config('test.surprise', (select e.id::text from public.events e where e.title = 'Sorpresa'), true);
select set_config('test.run', (select e.id::text from public.events e where e.title = 'Corsa'), true);
select set_config('test.english', (select e.id::text from public.events e where e.title = 'Inglese'), true);

select results_eq(
  $$ select e.title, e.location, e.household_id, e.author_member_id
     from public.events e where e.id in (current_setting('test.busy')::uuid, current_setting('test.private')::uuid)
     order by e.starts_at $$,
  $$ values
       ('Riunione segreta', 'Ufficio Nord', '22222222-2222-4222-8222-222222222222'::uuid, 'b1000000-0000-4000-8000-000000000002'::uuid),
       ('Prova privata', null::text, '22222222-2222-4222-8222-222222222222'::uuid, 'b1000000-0000-4000-8000-000000000002'::uuid) $$,
  'title cleaned of spaces, blank location stored as null, household and author = B2'
);
select is(
  (select e.recurrence_weekdays from public.events e where e.id = current_setting('test.pool')::uuid),
  '{2,4}'::smallint[],
  'days of the week stored sorted and without duplicates'
);

select lives_ok(
  $$ insert into public.event_members (event_id, member_id)
     values (current_setting('test.busy')::uuid, 'b1000000-0000-4000-8000-000000000002'),
            (current_setting('test.pool')::uuid, 'b1000000-0000-4000-8000-000000000002'),
            (current_setting('test.pool')::uuid, 'b1000000-0000-4000-8000-000000000003'),
            (current_setting('test.surprise')::uuid, 'b1000000-0000-4000-8000-000000000001'),
            (current_setting('test.english')::uuid, 'b1000000-0000-4000-8000-000000000003') $$,
  'B2 adds the participants (household omitted)'
);

-- Writes the app cannot do.
select throws_ok(
  $$ insert into public.events (title, starts_at, ends_at, visibility, author_member_id)
     values ('Falso autore', '2026-10-20 09:00+02', '2026-10-20 10:00+02', 'household', 'b1000000-0000-4000-8000-000000000001') $$,
  '42501', null,
  'B2 cannot choose the author'
);
select throws_ok(
  $$ insert into public.events (id, title, starts_at, ends_at, visibility)
     values (gen_random_uuid(), 'Con id', '2026-10-20 09:00+02', '2026-10-20 10:00+02', 'household') $$,
  '42501', null,
  'B2 cannot choose the id'
);
select throws_ok(
  $$ insert into public.events (household_id, title, starts_at, ends_at, visibility)
     values ('11111111-1111-4111-8111-111111111111', 'Intrusione', '2026-10-20 09:00+02', '2026-10-20 10:00+02', 'household') $$,
  '42501', null,
  'B2 cannot add an event to Casa D''Angelo'
);

-- ---------------------------------------------------------------------------
-- Constraints
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.events (title, starts_at, ends_at, visibility)
     values ('Al contrario', '2026-10-20 10:00+02', '2026-10-20 10:00+02', 'household') $$,
  '23514', null,
  'an event must end after it starts'
);
select throws_ok(
  $$ insert into public.events (title, starts_at, ends_at, visibility)
     values ('   ', '2026-10-20 10:00+02', '2026-10-20 11:00+02', 'household') $$,
  '23514', null,
  'blank title refused'
);
select throws_ok(
  $$ insert into public.events (title, starts_at, ends_at, visibility)
     values (repeat('x', 101), '2026-10-20 10:00+02', '2026-10-20 11:00+02', 'household') $$,
  '23514', null,
  'title longer than 100 characters refused'
);
select lives_ok(
  $$ insert into public.events (title, location, starts_at, ends_at, visibility)
     values (repeat('x', 100), repeat('y', 100), '2026-10-20 10:00+02', '2026-10-20 11:00+02', 'household') $$,
  'title and location of 100 characters accepted'
);
select throws_ok(
  $$ insert into public.events (title, location, starts_at, ends_at, visibility)
     values ('Lungo', repeat('y', 101), '2026-10-20 10:00+02', '2026-10-20 11:00+02', 'household') $$,
  '23514', null,
  'location longer than 100 characters refused'
);
select throws_ok(
  $$ insert into public.events (title, starts_at, ends_at, visibility, recurrence)
     values ('Senza giorni', '2026-10-20 10:00+02', '2026-10-20 11:00+02', 'household', 'weekly') $$,
  '23514', null,
  'a weekly event needs its days of the week'
);
select throws_ok(
  $$ insert into public.events (title, starts_at, ends_at, visibility, recurrence, recurrence_weekdays)
     values ('Mese con giorni', '2026-10-20 10:00+02', '2026-10-20 11:00+02', 'household', 'monthly', '{2}') $$,
  '23514', null,
  'only weekly events have days of the week'
);
select throws_ok(
  $$ insert into public.events (title, starts_at, ends_at, visibility, recurrence, recurrence_weekdays)
     values ('Giorno 8', '2026-10-20 10:00+02', '2026-10-20 11:00+02', 'household', 'weekly', '{2,8}') $$,
  '23514', null,
  'days of the week are 1 to 7'
);
select throws_ok(
  $$ insert into public.events (title, starts_at, ends_at, visibility, recurrence, recurrence_weekdays)
     values ('Vuoto', '2026-10-20 10:00+02', '2026-10-20 11:00+02', 'household', 'weekly', '{}') $$,
  '23514', null,
  'at least one day of the week'
);
select throws_ok(
  $$ insert into public.events (title, starts_at, ends_at, visibility, recurrence, recurrence_weekdays)
     values ('Non martedì', '2026-10-20 10:00+02', '2026-10-20 11:00+02', 'household', 'weekly', '{1,3}') $$,
  '23514', null,
  'the first occurrence falls on one of the days (20 October 2026 is a Tuesday)'
);
select throws_ok(
  $$ insert into public.events (title, starts_at, ends_at, visibility, recurrence, recurrence_weekdays)
     values ('Mezzanotte UTC', '2026-10-20 23:30+00', '2026-10-21 00:30+00', 'household', 'weekly', '{2}') $$,
  '23514', null,
  'the day of the week is the Rome day (Tuesday 23:30 UTC is Wednesday in Rome)'
);
select throws_ok(
  $$ insert into public.events (title, starts_at, ends_at, visibility, recurrence_until)
     values ('Fine senza ripetere', '2026-10-20 10:00+02', '2026-10-20 11:00+02', 'household', '2026-12-01') $$,
  '23514', null,
  'an end of the repetitions only for repeated events'
);
select throws_ok(
  $$ insert into public.events (title, starts_at, ends_at, visibility, recurrence, recurrence_until)
     values ('Fine prima', '2026-10-20 10:00+02', '2026-10-20 11:00+02', 'household', 'monthly', '2026-10-19') $$,
  '23514', null,
  'the repetitions cannot end before the first occurrence'
);
select throws_ok(
  $$ insert into public.events (title, starts_at, ends_at, visibility, recurrence)
     values ('Troppo lungo', '2026-10-20 10:00+02', '2026-10-27 10:01+01', 'household', 'monthly') $$,
  '23514', null,
  'a repeated event lasts at most 7 days'
);
select lives_ok(
  $$ insert into public.events (title, starts_at, ends_at, visibility)
     values ('Vacanza', '2026-08-01 10:00+02', '2026-08-21 10:00+02', 'household') $$,
  'an event that does not repeat may last more than 7 days'
);
select throws_ok(
  $$ insert into public.events (title, starts_at, ends_at, visibility, escort_member_id)
     values ('Accompagna Leo', '2026-10-20 10:00+02', '2026-10-20 11:00+02', 'household', 'b1000000-0000-4000-8000-000000000003') $$,
  '23514', null,
  'a child cannot accompany'
);
select throws_ok(
  $$ insert into public.events (title, starts_at, ends_at, visibility, escort_member_id)
     values ('Accompagna Marco', '2026-10-20 10:00+02', '2026-10-20 11:00+02', 'household', 'a1000000-0000-4000-8000-000000000001') $$,
  '23514', null,
  'a member of another household cannot accompany'
);
select throws_ok(
  $$ insert into public.event_members (event_id, member_id)
     values (current_setting('test.pool')::uuid, 'a1000000-0000-4000-8000-000000000003') $$,
  '23503', null,
  'a member of another household cannot be a participant'
);
select throws_ok(
  $$ insert into public.event_members (event_id, member_id)
     values (current_setting('test.pool')::uuid, 'b1000000-0000-4000-8000-000000000003') $$,
  '23505', null,
  'a participant appears once per event'
);
select throws_ok(
  $$ update public.events set recurrence_weekdays = '{3}' where id = current_setting('test.pool')::uuid $$,
  '23514', null,
  'constraints also hold on update'
);

-- ---------------------------------------------------------------------------
-- Giulia (B) reads from the tables only what she may see in full
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';

select results_eq(
  $$ select e.title from public.events e
     where e.title in ('Riunione segreta', 'Prova privata', 'Piscina', 'Sorpresa', 'Corsa', 'Inglese', 'Regalo')
     order by e.starts_at $$,
  $$ values ('Piscina'), ('Sorpresa'), ('Corsa'), ('Inglese'), ('Regalo') $$,
  'B reads «Tutto il Nest» events, a «Solo io» where she participates, an «Occupato» and a «Solo io» she accompanies'
);
select is_empty(
  $$ select 1 from public.events e
     where e.id in (current_setting('test.busy')::uuid, current_setting('test.private')::uuid) $$,
  'B cannot read the «Occupato» and «Solo io» events of B2 from the table'
);
select is_empty(
  $$ select 1 from public.event_members em
     where em.event_id in (current_setting('test.busy')::uuid, current_setting('test.private')::uuid) $$,
  'B cannot read the participants of the «Occupato» event of B2'
);
select results_eq(
  $$ select em.member_id from public.event_members em
     where em.event_id = current_setting('test.pool')::uuid order by em.member_id $$,
  $$ values ('b1000000-0000-4000-8000-000000000002'::uuid), ('b1000000-0000-4000-8000-000000000003'::uuid) $$,
  'B reads the participants of a «Tutto il Nest» event'
);

-- Giulia cannot change, delete or extend what she cannot see.
select results_eq(
  $$ with u as (update public.events set title = 'Cambiato' where id = current_setting('test.busy')::uuid returning 1)
     select count(*)::integer from u $$,
  $$ values (0) $$,
  'B updates 0 «Occupato» events of B2'
);
select results_eq(
  $$ with d as (delete from public.events where id in (current_setting('test.busy')::uuid, current_setting('test.private')::uuid) returning 1)
     select count(*)::integer from d $$,
  $$ values (0) $$,
  'B deletes 0 «Occupato» or «Solo io» events of B2'
);
select results_eq(
  $$ with d as (delete from public.event_members where event_id = current_setting('test.busy')::uuid returning 1)
     select count(*)::integer from d $$,
  $$ values (0) $$,
  'B removes 0 participants of the «Occupato» event of B2'
);
select throws_ok(
  $$ insert into public.event_members (event_id, member_id)
     values (current_setting('test.busy')::uuid, 'b1000000-0000-4000-8000-000000000001') $$,
  '42501', null,
  'B cannot add herself to the «Occupato» event of B2'
);

-- Giulia changes what she sees in full, but only the author changes who sees it.
select results_eq(
  $$ with u as (update public.events set title = 'Piscina comunale', location = 'Lissone'
                where id = current_setting('test.pool')::uuid returning 1)
     select count(*)::integer from u $$,
  $$ values (1) $$,
  'B changes a «Tutto il Nest» event of B2'
);
select throws_ok(
  $$ update public.events set visibility = 'private' where id = current_setting('test.pool')::uuid $$,
  '42501', null,
  'B cannot change who sees an event of B2'
);
select throws_ok(
  $$ update public.events set household_id = '11111111-1111-4111-8111-111111111111' where id = current_setting('test.pool')::uuid $$,
  '42501', null,
  'B cannot move an event to another household'
);
select lives_ok(
  $$ insert into public.event_members (event_id, member_id)
     values (current_setting('test.pool')::uuid, 'b1000000-0000-4000-8000-000000000004') $$,
  'B adds Anna to a «Tutto il Nest» event'
);
select results_eq(
  $$ with d as (delete from public.event_members
                where event_id = current_setting('test.pool')::uuid
                  and member_id = 'b1000000-0000-4000-8000-000000000004' returning 1)
     select count(*)::integer from d $$,
  $$ values (1) $$,
  'B removes Anna from it'
);
select lives_ok(
  $$ update public.events set escort_member_id = 'b1000000-0000-4000-8000-000000000001'
     where id = current_setting('test.pool')::uuid $$,
  'B sets herself as escort of a «Tutto il Nest» event of B2'
);
select lives_ok(
  $$ update public.events set escort_member_id = null where id = current_setting('test.pool')::uuid $$,
  'B removes the escort of a «Tutto il Nest» event of B2'
);

-- Adding people widens who sees a «Solo io» or «Occupato» event: only its author does it.
select throws_ok(
  $$ insert into public.event_members (event_id, member_id)
     values (current_setting('test.surprise')::uuid, 'b1000000-0000-4000-8000-000000000004') $$,
  '42501', null,
  'B, participant of a «Solo io» of B2, cannot add a participant'
);
select throws_ok(
  $$ update public.events set escort_member_id = 'b1000000-0000-4000-8000-000000000004'
     where id = current_setting('test.surprise')::uuid $$,
  '42501', null,
  'B, participant of a «Solo io» of B2, cannot set an escort'
);
select throws_ok(
  $$ insert into public.event_members (event_id, member_id)
     values (current_setting('test.run')::uuid, 'b1000000-0000-4000-8000-000000000004') $$,
  '42501', null,
  'B, escort of an «Occupato» of B2, cannot add a participant'
);
select throws_ok(
  $$ update public.events set escort_member_id = 'b1000000-0000-4000-8000-000000000004'
     where id = current_setting('test.gift')::uuid $$,
  '42501', null,
  'B, escort of a «Solo io» of B2, cannot hand the escort to another adult'
);

-- The author of a «Solo io» adds people.
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok(
  $$ insert into public.event_members (event_id, member_id)
     values (current_setting('test.surprise')::uuid, 'b1000000-0000-4000-8000-000000000003') $$,
  'B2, author of the «Solo io», adds a participant'
);
select lives_ok(
  $$ update public.events set escort_member_id = 'b1000000-0000-4000-8000-000000000004'
     where id = current_setting('test.surprise')::uuid $$,
  'B2, author of the «Solo io», sets an escort'
);

-- Removing people narrows who sees the event: still allowed to who sees it in full.
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select results_eq(
  $$ with u as (update public.events set escort_member_id = null
                where id = current_setting('test.surprise')::uuid returning 1)
     select count(*)::integer from u $$,
  $$ values (1) $$,
  'B, participant of the «Solo io», removes its escort'
);
select results_eq(
  $$ with d as (delete from public.event_members
                where event_id = current_setting('test.surprise')::uuid
                  and member_id = 'b1000000-0000-4000-8000-000000000003' returning 1)
     select count(*)::integer from d $$,
  $$ values (1) $$,
  'B, participant of the «Solo io», removes a participant'
);
-- Default of issue #19: who sees an event in full may delete it.
select results_eq(
  $$ with d as (delete from public.events where id = current_setting('test.surprise')::uuid returning 1)
     select count(*)::integer from d $$,
  $$ values (1) $$,
  'B, participant of a «Solo io» of B2, deletes it'
);

-- B2 changes the visibility of his own event; then B no longer reads it.
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok(
  $$ update public.events set visibility = 'busy' where id = current_setting('test.english')::uuid $$,
  'B2 changes who sees his event'
);
select is(
  (select e.updated_at >= e.created_at from public.events e where e.id = current_setting('test.english')::uuid),
  true,
  'updated_at is maintained'
);
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select is_empty(
  $$ select 1 from public.events e where e.id = current_setting('test.english')::uuid $$,
  'B no longer reads it (now «Occupato», she is not involved)'
);

-- ---------------------------------------------------------------------------
-- Marco (A, Casa D'Angelo) sees and touches nothing of Casa Bianchi
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';

select lives_ok(
  $$ insert into public.events (title, starts_at, ends_at, visibility)
     values ('Cena dai nonni', '2026-10-20 19:30+02', '2026-10-20 21:30+02', 'household') $$,
  'A adds an event to Casa D''Angelo'
);
select lives_ok(
  $$ insert into public.event_members (event_id, member_id)
     select e.id, 'a1000000-0000-4000-8000-000000000003' from public.events e where e.title = 'Cena dai nonni' $$,
  'A adds Sofia to it'
);
select set_config('test.dinner', (select e.id::text from public.events e where e.title = 'Cena dai nonni'), true);

select is_empty(
  $$ select 1 from public.events e where e.household_id = '22222222-2222-4222-8222-222222222222' $$,
  'A reads 0 events of Casa Bianchi'
);
select is_empty(
  $$ select 1 from public.event_members em where em.household_id = '22222222-2222-4222-8222-222222222222' $$,
  'A reads 0 participants of Casa Bianchi'
);
select results_eq(
  $$ with u as (update public.events set title = 'Preso' where id = current_setting('test.pool')::uuid returning 1)
     select count(*)::integer from u $$,
  $$ values (0) $$,
  'A updates 0 events of Casa Bianchi'
);
select results_eq(
  $$ with d as (delete from public.events where household_id = '22222222-2222-4222-8222-222222222222' returning 1)
     select count(*)::integer from d $$,
  $$ values (0) $$,
  'A deletes 0 events of Casa Bianchi'
);
select results_eq(
  $$ with d as (delete from public.event_members where household_id = '22222222-2222-4222-8222-222222222222' returning 1)
     select count(*)::integer from d $$,
  $$ values (0) $$,
  'A removes 0 participants of Casa Bianchi'
);
select throws_ok(
  $$ insert into public.event_members (event_id, member_id)
     values (current_setting('test.pool')::uuid, 'a1000000-0000-4000-8000-000000000001') $$,
  '42501', null,
  'A cannot add a participant to an event of Casa Bianchi'
);
select throws_ok(
  $$ insert into public.event_members (event_id, member_id, household_id)
     values (current_setting('test.pool')::uuid, 'b1000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222') $$,
  '42501', null,
  'A cannot add a participant to Casa Bianchi even naming the household'
);
select throws_ok(
  $$ insert into public.events (household_id, title, starts_at, ends_at, visibility)
     values ('22222222-2222-4222-8222-222222222222', 'Intrusione', '2026-10-20 09:00+02', '2026-10-20 10:00+02', 'household') $$,
  '42501', null,
  'A cannot add an event to Casa Bianchi'
);

-- B sees nothing of Casa D'Angelo.
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select is_empty(
  $$ select 1 from public.events e where e.household_id = '11111111-1111-4111-8111-111111111111'
     union all
     select 1 from public.event_members em where em.household_id = '11111111-1111-4111-8111-111111111111' $$,
  'B reads 0 events and participants of Casa D''Angelo'
);
select results_eq(
  $$ with u as (update public.events set title = 'Preso' where id = current_setting('test.dinner')::uuid returning 1)
     select count(*)::integer from u $$,
  $$ values (0) $$,
  'B updates 0 events of Casa D''Angelo'
);
select results_eq(
  $$ with d as (delete from public.events where id = current_setting('test.dinner')::uuid returning 1)
     select count(*)::integer from d $$,
  $$ values (0) $$,
  'B deletes 0 events of Casa D''Angelo'
);

-- ---------------------------------------------------------------------------
-- Chiara (C, no household) and anonymous users
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}';
select is_empty(
  $$ select 1 from public.events union all select 1 from public.event_members $$,
  'C reads 0 events and 0 participants'
);
select throws_ok(
  $$ insert into public.events (title, starts_at, ends_at, visibility)
     values ('Senza Nest', '2026-10-20 09:00+02', '2026-10-20 10:00+02', 'household') $$,
  '42501', null,
  'C cannot add events'
);
select throws_ok(
  $$ insert into public.events (household_id, title, starts_at, ends_at, visibility)
     values ('22222222-2222-4222-8222-222222222222', 'Senza Nest', '2026-10-20 09:00+02', '2026-10-20 10:00+02', 'household') $$,
  '42501', null,
  'C cannot add events to Casa Bianchi'
);

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok($$ select 1 from public.events $$, '42501', null, 'anon cannot read events');
select throws_ok($$ select 1 from public.event_members $$, '42501', null, 'anon cannot read event_members');
select throws_ok(
  $$ insert into public.events (household_id, title, starts_at, ends_at, visibility)
     values ('22222222-2222-4222-8222-222222222222', 'Anonimo', '2026-10-20 09:00+02', '2026-10-20 10:00+02', 'household') $$,
  '42501', null,
  'anon cannot add events'
);
select throws_ok($$ delete from public.events $$, '42501', null, 'anon cannot delete events');

-- ---------------------------------------------------------------------------
-- Checks as the database owner
-- ---------------------------------------------------------------------------
reset role;

select results_eq(
  $$ select e.title from public.events e where e.id = current_setting('test.busy')::uuid
     union all
     select e.title from public.events e where e.id = current_setting('test.dinner')::uuid $$,
  $$ values ('Riunione segreta'), ('Cena dai nonni') $$,
  'the refused updates changed nothing'
);
select is(
  (select e.title from public.events e where e.id = current_setting('test.pool')::uuid),
  'Piscina comunale',
  'the update by B is stored'
);

-- A member who leaves: their «Solo io» and «Occupato» events go, «Tutto il Nest» stay.
select lives_ok(
  $$ delete from auth.users where id = 'bbbbbbbb-0000-4000-8000-000000000002' $$,
  'the account of B2 is deleted'
);
select is_empty(
  $$ select 1 from public.events e
     where e.id in (current_setting('test.busy')::uuid, current_setting('test.private')::uuid,
                    current_setting('test.surprise')::uuid, current_setting('test.run')::uuid,
                    current_setting('test.english')::uuid, current_setting('test.gift')::uuid) $$,
  'the «Solo io» and «Occupato» events of B2 are deleted with him'
);
select is_empty(
  $$ select 1 from public.event_members em
     where em.event_id in (current_setting('test.busy')::uuid, current_setting('test.surprise')::uuid)
        or em.member_id = 'b1000000-0000-4000-8000-000000000002' $$,
  'their participants and the participations of B2 are deleted'
);
select results_eq(
  $$ select e.title, e.author_member_id from public.events e where e.id = current_setting('test.pool')::uuid $$,
  $$ values ('Piscina comunale', null::uuid) $$,
  'a «Tutto il Nest» event of B2 stays for the household, without author'
);
select results_eq(
  $$ select em.member_id from public.event_members em where em.event_id = current_setting('test.pool')::uuid $$,
  $$ values ('b1000000-0000-4000-8000-000000000003'::uuid) $$,
  'Leo is still a participant'
);

set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select is(
  (select e.title from public.events e where e.id = current_setting('test.pool')::uuid),
  'Piscina comunale',
  'B still reads the event without author'
);
select throws_ok(
  $$ update public.events set visibility = 'private' where id = current_setting('test.pool')::uuid $$,
  '42501', null,
  'nobody changes who sees an event without author'
);
select lives_ok(
  $$ insert into public.events (title, starts_at, ends_at, visibility, escort_member_id)
     values ('Con Anna', '2026-10-24 10:00+02', '2026-10-24 11:00+02', 'household', 'b1000000-0000-4000-8000-000000000004') $$,
  'B adds an event accompanied by Anna'
);
select lives_ok(
  $$ delete from public.household_members where id = 'b1000000-0000-4000-8000-000000000004' $$,
  'B (admin) removes Anna from the household'
);
select results_eq(
  $$ select e.escort_member_id from public.events e where e.title = 'Con Anna' $$,
  $$ values (null::uuid) $$,
  'the event stays without escort'
);
select results_eq(
  $$ with d as (delete from public.events where id = current_setting('test.pool')::uuid returning 1)
     select count(*)::integer from d $$,
  $$ values (1) $$,
  'B deletes a «Tutto il Nest» event'
);
reset role;
select is_empty(
  $$ select 1 from public.event_members em where em.event_id = current_setting('test.pool')::uuid $$,
  'its participants are deleted with it'
);

-- A household deleted with its last account: every event and participant goes.
select lives_ok(
  $$ delete from auth.users where id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  'the account of A (last account of Casa D''Angelo) is deleted'
);
select is_empty(
  $$ select 1 from public.events e where e.household_id = '11111111-1111-4111-8111-111111111111'
     union all
     select 1 from public.event_members em where em.household_id = '11111111-1111-4111-8111-111111111111' $$,
  'Casa D''Angelo is deleted with all its events and participants'
);

select * from finish();
rollback;
