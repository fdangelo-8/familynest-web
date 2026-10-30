-- event_exceptions, get_event_occurrence(), update_event_occurrence() («Solo questo»),
-- delete_event_occurrence() («Solo questo» / «Tutti i prossimi») and the exceptions in
-- list_household_events() (issue #109, for #19 Dettaglio impegno).
-- Seed ids: A = Marco (Casa D'Angelo), B = Giulia (Casa Bianchi), B2 = Paolo (Casa
-- Bianchi), C = Chiara (no household). Members: Casa D'Angelo Marco a1…01, Laura a1…02
-- (adult without account), Sofia a1…03 (child), Tommaso a1…04 (child); Casa Bianchi
-- Giulia b1…01, Paolo b1…02, Leo b1…03 (child), Anna b1…04 (adult without account).
-- Events are inserted by the database owner with fixed ids and authors. No health data (D1).
begin;
create extension if not exists pgtap with schema extensions;

select plan(87);

insert into public.events (
  id, household_id, author_member_id, title, location, notes, starts_at, ends_at, visibility,
  escort_member_id, recurrence, recurrence_weekdays, recurrence_until
)
values
  -- Casa D'Angelo: the «Nuoto» of the requirement of #19.
  ('a5000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001',
   'Nuoto Sofia', 'Piscina comunale, Lissone', 'Portare la cuffia', '2026-10-06 17:00+02', '2026-10-06 18:30+02', 'household',
   'a1000000-0000-4000-8000-000000000002', 'weekly', '{2,4}', null),
  -- Casa Bianchi
  ('b5000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000002',
   'Riunione segreta', 'Ufficio Nord', 'Portare il badge', '2026-10-06 09:00+02', '2026-10-06 10:00+02', 'busy',
   null, 'weekly', '{2,4}', null),
  ('b5000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000002',
   'Sorpresa', null, null, '2026-10-05 08:00+02', '2026-10-05 09:00+02', 'private',
   null, 'weekly', '{1}', null),
  ('b5000000-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000001',
   'Affitto', null, null, '2026-10-20 10:00+02', '2026-10-20 11:00+02', 'household',
   null, 'monthly', null, '2026-12-15'),
  ('b5000000-0000-4000-8000-000000000004', '22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000001',
   'Cena da Marta', null, null, '2026-10-23 20:00+02', '2026-10-23 23:00+02', 'household',
   null, 'none', null, null),
  ('b5000000-0000-4000-8000-000000000005', '22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000001',
   'Coro', null, null, '2026-10-07 18:00+02', '2026-10-07 19:00+02', 'household',
   null, 'weekly', '{3}', null),
  ('b5000000-0000-4000-8000-000000000006', '22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000001',
   'Fine serie', null, null, '2026-10-01 18:00+02', '2026-10-01 19:00+02', 'household',
   null, 'weekly', '{4}', '2026-10-15');

insert into public.event_members (event_id, member_id, household_id)
values
  ('a5000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111'),
  ('b5000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222'),
  ('b5000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222'),
  ('b5000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222');

-- ---------------------------------------------------------------------------
-- Schema and privileges
-- ---------------------------------------------------------------------------
select has_table('public', 'event_exceptions', 'event_exceptions exists');
select ok(
  (select c.relrowsecurity from pg_class c where c.oid = 'public.event_exceptions'::regclass),
  'RLS enabled on event_exceptions'
);
select columns_are(
  'public', 'event_exceptions',
  array[
    'event_id', 'household_id', 'occurrence_date', 'is_cancelled', 'title', 'location', 'notes',
    'starts_at', 'ends_at', 'escort_member_id', 'created_at', 'updated_at'
  ],
  'event_exceptions has exactly the planned columns (no visibility, no participants, no health data)'
);
select col_is_pk('public', 'event_exceptions', array['event_id', 'occurrence_date'], 'one exception per occurrence');
select fk_ok(
  'public', 'event_exceptions', array['event_id', 'household_id'],
  'public', 'events', array['id', 'household_id'],
  'an exception belongs to an event of the same household'
);
select fk_ok(
  'public', 'event_exceptions', array['escort_member_id', 'household_id'],
  'public', 'household_members', array['id', 'household_id'],
  'the escort of an occurrence is a member of the same household'
);
select has_index('public', 'event_exceptions', 'event_exceptions_household_starts_idx', 'index on household and start');
select has_index('public', 'event_exceptions', 'event_exceptions_escort_member_id_idx', 'index on the escort');
select policies_are(
  'public', 'event_exceptions',
  array['event_exceptions_select', 'event_exceptions_insert', 'event_exceptions_update', 'event_exceptions_delete'],
  'event_exceptions has one policy per command'
);
select ok(
  not has_table_privilege('anon', 'public.event_exceptions', 'select')
  and not has_table_privilege('anon', 'public.event_exceptions', 'insert')
  and not has_table_privilege('anon', 'public.event_exceptions', 'update')
  and not has_table_privilege('anon', 'public.event_exceptions', 'delete'),
  'anon has no privilege on event_exceptions'
);
select ok(
  not has_column_privilege('authenticated', 'public.event_exceptions', 'event_id', 'update')
  and not has_column_privilege('authenticated', 'public.event_exceptions', 'household_id', 'update')
  and not has_column_privilege('authenticated', 'public.event_exceptions', 'occurrence_date', 'update')
  and not has_column_privilege('authenticated', 'public.event_exceptions', 'created_at', 'insert'),
  'event, household and day of an exception never change; the creation time is set by the database'
);
select ok(
  not (select p.prosecdef from pg_proc p where p.oid = 'public.get_event_occurrence(uuid, date)'::regprocedure)
  and not (select p.prosecdef from pg_proc p where p.oid = 'public.update_event_occurrence(uuid, date, text, timestamptz, timestamptz, text, uuid, text)'::regprocedure)
  and not (select p.prosecdef from pg_proc p where p.oid = 'public.delete_event_occurrence(uuid, date, public.event_change_scope)'::regprocedure),
  'the occurrence functions are security invoker (RLS applies)'
);
select ok(
  not has_function_privilege('anon', 'public.get_event_occurrence(uuid, date)', 'execute')
  and not has_function_privilege('anon', 'public.update_event_occurrence(uuid, date, text, timestamptz, timestamptz, text, uuid, text)', 'execute')
  and not has_function_privilege('anon', 'public.delete_event_occurrence(uuid, date, public.event_change_scope)', 'execute')
  and has_function_privilege('authenticated', 'public.get_event_occurrence(uuid, date)', 'execute'),
  'the occurrence functions are for signed-in users only'
);
select ok(
  array_position(
    (select p.proargnames from pg_proc p where p.oid = 'public.list_household_events(timestamptz, timestamptz)'::regprocedure),
    'notes'
  ) is null,
  'list_household_events never returns the notes'
);
select enum_has_labels('public', 'event_change_scope', array['this', 'following'], 'event_change_scope labels');

-- ---------------------------------------------------------------------------
-- Marco (A): reading one occurrence
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';

select results_eq(
  $$ select g.id, g.occurrence_date, g.starts_at, g.ends_at, g.title, g.location, g.notes, g.visibility::text,
            g.author_member_id, g.escort_member_id, g.member_ids, g.recurrence::text, g.recurrence_weekdays,
            g.recurrence_until, g.series_starts_at, g.is_modified
     from public.get_event_occurrence('a5000000-0000-4000-8000-000000000001', '2026-10-20') g $$,
  $$ values (
       'a5000000-0000-4000-8000-000000000001'::uuid, '2026-10-20'::date, '2026-10-20 17:00+02'::timestamptz,
       '2026-10-20 18:30+02'::timestamptz, 'Nuoto Sofia', 'Piscina comunale, Lissone', 'Portare la cuffia', 'household',
       'a1000000-0000-4000-8000-000000000001'::uuid, 'a1000000-0000-4000-8000-000000000002'::uuid,
       array['a1000000-0000-4000-8000-000000000003']::uuid[], 'weekly', '{2,4}'::smallint[], null::date,
       '2026-10-06 17:00+02'::timestamptz, false
     ) $$,
  'A reads the occurrence of Tuesday 20 October with every field and the notes'
);
select results_eq(
  $$ select g.starts_at from public.get_event_occurrence('a5000000-0000-4000-8000-000000000001', '2026-10-22') g $$,
  $$ values ('2026-10-22 17:00+02'::timestamptz) $$,
  'Thursday 22 is an occurrence too'
);
select is_empty(
  $$ select 1 from public.get_event_occurrence('a5000000-0000-4000-8000-000000000001', '2026-10-21') $$,
  'a Wednesday is not an occurrence: zero rows'
);
select is_empty(
  $$ select 1 from public.get_event_occurrence('a5000000-0000-4000-8000-000000000001', '2026-09-29') $$,
  'a Tuesday before the first occurrence: zero rows'
);
select is_empty(
  $$ select 1 from public.get_event_occurrence('00000000-0000-4000-8000-000000000000', '2026-10-20') $$,
  'an unknown id: zero rows'
);

-- ---------------------------------------------------------------------------
-- Marco (A): «Elimina solo questo»
-- ---------------------------------------------------------------------------
select lives_ok(
  $$ select public.delete_event_occurrence('a5000000-0000-4000-8000-000000000001', '2026-10-20', 'this') $$,
  'A removes only the occurrence of Tuesday 20'
);
select is_empty(
  $$ select 1 from public.get_event_occurrence('a5000000-0000-4000-8000-000000000001', '2026-10-20') $$,
  'the removed occurrence is not there any more'
);
select results_eq(
  $$ select e.id, e.starts_at from public.list_household_events('2026-10-19 00:00+02', '2026-10-26 00:00+01') e
     where e.title = 'Nuoto Sofia' $$,
  $$ values ('a5000000-0000-4000-8000-000000000001'::uuid, '2026-10-22 17:00+02'::timestamptz) $$,
  'the week of 19 – 25 October has the «Nuoto» only on Thursday 22 (CA-38 of #19)'
);
select results_eq(
  $$ select x.occurrence_date, x.is_cancelled, x.title from public.event_exceptions x
     where x.event_id = 'a5000000-0000-4000-8000-000000000001' $$,
  $$ values ('2026-10-20'::date, true, null::text) $$,
  'A reads the exception: a removed occurrence without values'
);
select throws_ok(
  $$ select public.delete_event_occurrence('a5000000-0000-4000-8000-000000000001', '2026-10-20', 'this') $$,
  'P0002', 'event not found',
  'an occurrence already removed cannot be removed again'
);
select throws_ok(
  $$ select public.update_event_occurrence('a5000000-0000-4000-8000-000000000001', '2026-10-20', 'Nuoto',
       '2026-10-20 17:00+02', '2026-10-20 18:30+02', null, null, null) $$,
  'P0002', 'event not found',
  'a removed occurrence cannot be changed'
);
select throws_ok(
  $$ select public.delete_event_occurrence('a5000000-0000-4000-8000-000000000001', '2026-10-21', 'this') $$,
  'P0002', 'event not found',
  'a day that is not an occurrence cannot be removed'
);

-- ---------------------------------------------------------------------------
-- Marco (A): «Salva solo questo»
-- ---------------------------------------------------------------------------
select lives_ok(
  $$ select public.update_event_occurrence('a5000000-0000-4000-8000-000000000001', '2026-10-27', '  Nuoto  con papà ',
       '2026-10-27 18:00+01', '2026-10-27 19:00+01', 'Piscina Lissone', 'a1000000-0000-4000-8000-000000000001',
       E' Portare la cuffia rossa\n') $$,
  'A changes only the occurrence of Tuesday 27'
);
select results_eq(
  $$ select g.occurrence_date, g.starts_at, g.ends_at, g.title, g.location, g.notes, g.escort_member_id, g.member_ids, g.is_modified
     from public.get_event_occurrence('a5000000-0000-4000-8000-000000000001', '2026-10-27') g $$,
  $$ values (
       '2026-10-27'::date, '2026-10-27 18:00+01'::timestamptz, '2026-10-27 19:00+01'::timestamptz, 'Nuoto con papà',
       'Piscina Lissone', 'Portare la cuffia rossa', 'a1000000-0000-4000-8000-000000000001'::uuid,
       array['a1000000-0000-4000-8000-000000000003']::uuid[], true
     ) $$,
  'the occurrence of Tuesday 27 has its own values (normalised), the participants of the series'
);
select results_eq(
  $$ select g.title, g.starts_at from public.get_event_occurrence('a5000000-0000-4000-8000-000000000001', '2026-10-29') g $$,
  $$ values ('Nuoto Sofia', '2026-10-29 17:00+01'::timestamptz) $$,
  'Thursday 29 keeps the values of the series'
);
select results_eq(
  $$ select e.starts_at, e.title, e.location, e.escort_member_id
     from public.list_household_events('2026-10-26 00:00+01', '2026-11-02 00:00+01') e
     where e.id = 'a5000000-0000-4000-8000-000000000001' $$,
  $$ values
       ('2026-10-27 18:00+01'::timestamptz, 'Nuoto con papà', 'Piscina Lissone', 'a1000000-0000-4000-8000-000000000001'::uuid),
       ('2026-10-29 17:00+01'::timestamptz, 'Nuoto Sofia', 'Piscina comunale, Lissone', 'a1000000-0000-4000-8000-000000000002'::uuid) $$,
  'the calendar shows the changed occurrence with its own values and the next one with those of the series'
);
select lives_ok(
  $$ select public.update_event_occurrence('a5000000-0000-4000-8000-000000000001', '2026-11-05', 'Nuoto Sofia',
       '2026-11-07 10:00+01', '2026-11-07 11:30+01', null, null, null) $$,
  'A moves only the occurrence of Thursday 5 November to Saturday 7'
);
select is_empty(
  $$ select 1 from public.get_event_occurrence('a5000000-0000-4000-8000-000000000001', '2026-11-05') $$,
  'Thursday 5 November has no occurrence any more'
);
select results_eq(
  $$ select g.occurrence_date, g.starts_at, g.location, g.notes
     from public.get_event_occurrence('a5000000-0000-4000-8000-000000000001', '2026-11-07') g $$,
  $$ values ('2026-11-05'::date, '2026-11-07 10:00+01'::timestamptz, null::text, null::text) $$,
  'Saturday 7 shows the moved occurrence, still identified by its day in the series'
);
select results_eq(
  $$ select e.starts_at from public.list_household_events('2026-11-02 00:00+01', '2026-11-09 00:00+01') e
     where e.id = 'a5000000-0000-4000-8000-000000000001' $$,
  $$ values ('2026-11-03 17:00+01'::timestamptz), ('2026-11-07 10:00+01'::timestamptz) $$,
  'the calendar of that week has Tuesday 3 and the moved occurrence on Saturday 7'
);
select throws_ok(
  $$ select public.update_event_occurrence('a5000000-0000-4000-8000-000000000001', '2026-11-10', 'Nuoto Sofia',
       '2026-11-10 10:00+01', '2026-11-18 10:00+01', null, null, null) $$,
  '23514',
  'new row for relation "event_exceptions" violates check constraint "event_exceptions_duration"',
  'one occurrence cannot last more than 7 days'
);
select throws_ok(
  $$ select public.update_event_occurrence('a5000000-0000-4000-8000-000000000001', '2026-11-10', 'Nuoto Sofia',
       '2026-11-10 17:00+01', '2026-11-10 18:00+01', null, 'a1000000-0000-4000-8000-000000000004', null) $$,
  '23514', 'the escort must be an adult of the household',
  'a child cannot accompany an occurrence'
);

-- Only POST through the Data API.
set local request.method to 'GET';
select throws_ok(
  $$ select public.update_event_occurrence('a5000000-0000-4000-8000-000000000001', '2026-11-10', 'Con GET',
       '2026-11-10 17:00+01', '2026-11-10 18:00+01', null, null, null) $$,
  'P0001', 'use POST',
  'update_event_occurrence refuses GET'
);
select throws_ok(
  $$ select public.delete_event_occurrence('a5000000-0000-4000-8000-000000000001', '2026-11-10', 'this') $$,
  'P0001', 'use POST',
  'delete_event_occurrence refuses GET'
);
set local request.method to 'POST';

-- ---------------------------------------------------------------------------
-- Giulia (B, other household): nothing of the «Nuoto» of A
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';

select is_empty(
  $$ select 1 from public.event_exceptions x where x.event_id = 'a5000000-0000-4000-8000-000000000001' $$,
  'B reads no exception of A'
);
select is_empty(
  $$ select 1 from public.get_event_occurrence('a5000000-0000-4000-8000-000000000001', '2026-10-22') $$,
  'B reads no occurrence of an event of A'
);
select is_empty(
  $$ select 1 from public.get_event_occurrence('a5000000-0000-4000-8000-000000000001') $$,
  'B reads no occurrence of an event of A, also without a day'
);
select throws_ok(
  $$ select public.delete_event_occurrence('a5000000-0000-4000-8000-000000000001', '2026-10-22', 'this') $$,
  'P0002', 'event not found',
  'B cannot remove an occurrence of A (same error as an unknown event)'
);
select throws_ok(
  $$ select public.delete_event_occurrence('a5000000-0000-4000-8000-000000000001', '2026-10-22', 'following') $$,
  'P0002', 'event not found',
  'B cannot end a series of A'
);
select throws_ok(
  $$ select public.update_event_occurrence('a5000000-0000-4000-8000-000000000001', '2026-10-22', 'Preso',
       '2026-10-22 17:00+02', '2026-10-22 18:30+02', null, null, null) $$,
  'P0002', 'event not found',
  'B cannot change an occurrence of A'
);
select throws_ok(
  $$ insert into public.event_exceptions (event_id, household_id, occurrence_date, is_cancelled)
     values ('a5000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', '2026-10-22', true) $$,
  '42501', null,
  'B cannot insert an exception into the household of A'
);
select throws_ok(
  $$ insert into public.event_exceptions (event_id, occurrence_date, is_cancelled)
     values ('a5000000-0000-4000-8000-000000000001', '2026-10-22', true) $$,
  '42501', null,
  'B cannot attach an exception of her household to an event of A'
);
select lives_ok(
  $$ update public.event_exceptions set title = 'Preso' where event_id = 'a5000000-0000-4000-8000-000000000001' $$,
  'an update of B on the exceptions of A touches nothing (checked below)'
);
select lives_ok(
  $$ delete from public.event_exceptions where event_id = 'a5000000-0000-4000-8000-000000000001' $$,
  'a delete of B on the exceptions of A touches nothing (checked below)'
);

-- ---------------------------------------------------------------------------
-- Paolo (B2): his «Occupato» repeated every Tuesday and Thursday
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';

select lives_ok(
  $$ select public.delete_event_occurrence('b5000000-0000-4000-8000-000000000001', '2026-10-20', 'this') $$,
  'B2 removes only Tuesday 20 of his «Occupato»'
);
select lives_ok(
  $$ select public.update_event_occurrence('b5000000-0000-4000-8000-000000000001', '2026-10-22', 'Riunione spostata',
       '2026-10-22 11:00+02', '2026-10-22 12:00+02', 'Ufficio Sud', null, 'Portare il pass') $$,
  'B2 moves Thursday 22 of his «Occupato» to 11:00'
);

-- Giulia sees the «Occupato» of Paolo only as masked rows.
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select results_eq(
  $$ select e.id, e.starts_at, e.ends_at, e.is_masked, e.title, e.location, e.author_member_id
     from public.list_household_events('2026-10-19 00:00+02', '2026-10-26 00:00+01') e
     where e.visibility = 'busy' $$,
  $$ values (null::uuid, '2026-10-22 11:00+02'::timestamptz, '2026-10-22 12:00+02'::timestamptz, true, null::text, null::text,
             'b1000000-0000-4000-8000-000000000002'::uuid) $$,
  'B gets the «Occupato» of B2 masked only on Thursday 22, at its new time, and nothing on Tuesday 20 (CA-40 of #19)'
);
select is_empty(
  $$ select 1 from public.list_household_events('2026-10-19 00:00+02', '2026-10-26 00:00+01') e
     where e.title in ('Riunione segreta', 'Riunione spostata') or e.location in ('Ufficio Nord', 'Ufficio Sud') $$,
  'no title or place of the «Occupato» of B2 reaches B, changed occurrences included'
);
select is_empty(
  $$ select 1 from public.get_event_occurrence('b5000000-0000-4000-8000-000000000001', '2026-10-22') $$,
  'B cannot read an occurrence of an «Occupato» of B2 (zero rows)'
);
select is_empty(
  $$ select 1 from public.get_event_occurrence('b5000000-0000-4000-8000-000000000001') $$,
  'B cannot read an «Occupato» of B2 without a day either'
);
select is_empty(
  $$ select 1 from public.event_exceptions x where x.event_id = 'b5000000-0000-4000-8000-000000000001' $$,
  'B reads no exception of an «Occupato» of B2 (title, place and notes stay hidden)'
);
select throws_ok(
  $$ select public.delete_event_occurrence('b5000000-0000-4000-8000-000000000001', '2026-10-27', 'this') $$,
  'P0002', 'event not found',
  'B cannot remove an occurrence of an «Occupato» of B2'
);
select throws_ok(
  $$ insert into public.event_exceptions (event_id, occurrence_date, is_cancelled)
     values ('b5000000-0000-4000-8000-000000000001', '2026-10-27', true) $$,
  '42501', null,
  'B cannot insert an exception for an «Occupato» of B2'
);

-- Giulia, participant of the «Solo io» of Paolo: the escort of one occurrence must already
-- see the event.
select throws_ok(
  $$ select public.update_event_occurrence('b5000000-0000-4000-8000-000000000002', '2026-10-26', 'Sorpresa',
       '2026-10-26 08:00+01', '2026-10-26 09:00+01', null, 'b1000000-0000-4000-8000-000000000004', null) $$,
  '42501', 'the escort of one occurrence must already see the event',
  'an occurrence of a «Solo io» cannot be shown to someone new through its escort'
);
select lives_ok(
  $$ select public.update_event_occurrence('b5000000-0000-4000-8000-000000000002', '2026-10-26', 'Sorpresa',
       '2026-10-26 08:00+01', '2026-10-26 09:00+01', null, 'b1000000-0000-4000-8000-000000000001', null) $$,
  'a participant of the «Solo io» may accompany one occurrence'
);
select lives_ok(
  $$ select public.update_event_occurrence('b5000000-0000-4000-8000-000000000003', '2026-11-20', 'Affitto',
       '2026-11-20 10:00+01', '2026-11-20 11:00+01', null, 'b1000000-0000-4000-8000-000000000004', null) $$,
  'on a «Tutto il Nest» event any adult may accompany one occurrence'
);

-- Exceptions only for repeated events, only on their days.
select throws_ok(
  $$ select public.update_event_occurrence('b5000000-0000-4000-8000-000000000004', '2026-10-23', 'Cena',
       '2026-10-23 20:00+02', '2026-10-23 23:00+02', null, null, null) $$,
  '22023', 'the event does not repeat',
  'an event that does not repeat has no «Solo questo»'
);
select throws_ok(
  $$ insert into public.event_exceptions (event_id, occurrence_date, is_cancelled)
     values ('b5000000-0000-4000-8000-000000000004', '2026-10-23', true) $$,
  '22023', 'only repeated events have exceptions',
  'no exception for an event that does not repeat'
);
select throws_ok(
  $$ insert into public.event_exceptions (event_id, occurrence_date, is_cancelled)
     values ('b5000000-0000-4000-8000-000000000003', '2026-10-21', true) $$,
  '22023', 'the day is not an occurrence of the event',
  'no exception for a day that is not an occurrence'
);
select throws_ok(
  $$ insert into public.event_exceptions (event_id, occurrence_date, is_cancelled, title)
     values ('b5000000-0000-4000-8000-000000000003', '2026-10-20', true, 'Affitto') $$,
  '23514', null,
  'a removed occurrence has no values'
);
select throws_ok(
  $$ update public.event_exceptions set occurrence_date = '2026-12-20'
     where event_id = 'b5000000-0000-4000-8000-000000000003' $$,
  '42501', null,
  'the day of an exception never changes'
);

-- An event that does not repeat: deleted by any scope.
select lives_ok(
  $$ select public.delete_event_occurrence('b5000000-0000-4000-8000-000000000004', '2026-10-23', 'this') $$,
  'B deletes an event that does not repeat'
);

-- «Elimina tutti i prossimi» from the first occurrence: the whole event.
select lives_ok(
  $$ select public.delete_event_occurrence('b5000000-0000-4000-8000-000000000005', '2026-10-07', 'following') $$,
  'B removes «tutti i prossimi» from the first occurrence of «Coro»'
);

-- The last occurrence of a series with an end: nothing left, the event goes.
select lives_ok(
  $$ select public.delete_event_occurrence('b5000000-0000-4000-8000-000000000003', '2026-10-20', 'this') $$,
  'B removes the first occurrence of «Affitto» (20 October)'
);
select results_eq(
  $$ select g.occurrence_date, g.escort_member_id from public.get_event_occurrence('b5000000-0000-4000-8000-000000000003') g $$,
  $$ values ('2026-11-20'::date, 'b1000000-0000-4000-8000-000000000004'::uuid) $$,
  'without a day, the next occurrence left is shown (20 November, with its own escort)'
);
select lives_ok(
  $$ select public.delete_event_occurrence('b5000000-0000-4000-8000-000000000003', '2026-11-20', 'this') $$,
  'B removes the occurrence of 20 November too'
);

-- A series that has ended: without a day, the last occurrence.
select results_eq(
  $$ select g.occurrence_date, g.starts_at from public.get_event_occurrence('b5000000-0000-4000-8000-000000000006') g $$,
  $$ values ('2026-10-15'::date, '2026-10-15 18:00+02'::timestamptz) $$,
  'a series that has ended shows its last occurrence when no day is given'
);

-- ---------------------------------------------------------------------------
-- As the database owner: what happened
-- ---------------------------------------------------------------------------
reset role;
select results_eq(
  $$ select x.occurrence_date, x.is_cancelled, x.title from public.event_exceptions x
     where x.event_id = 'a5000000-0000-4000-8000-000000000001' order by x.occurrence_date $$,
  $$ values ('2026-10-20'::date, true, null::text), ('2026-10-27', false, 'Nuoto con papà'), ('2026-11-05', false, 'Nuoto Sofia') $$,
  'the exceptions of A are intact after the attempts of B'
);
select is_empty(
  $$ select 1 from public.event_exceptions x where x.title in ('Preso', 'Con GET') $$,
  'no refused change was saved'
);
select is_empty(
  $$ select 1 from public.events e where e.id in (
       'b5000000-0000-4000-8000-000000000003', 'b5000000-0000-4000-8000-000000000004', 'b5000000-0000-4000-8000-000000000005'
     ) $$,
  'deleted events, «tutti i prossimi» from the first occurrence and series without occurrences left are gone'
);
select is(
  (select count(*)::int from public.event_exceptions x where x.event_id = 'b5000000-0000-4000-8000-000000000003'),
  0,
  'the exceptions are deleted with their event'
);
select results_eq(
  $$ select x.escort_member_id from public.event_exceptions x
     where x.event_id = 'b5000000-0000-4000-8000-000000000002' $$,
  $$ values ('b1000000-0000-4000-8000-000000000001'::uuid) $$,
  'only the allowed escort of the «Solo io» occurrence was saved'
);

-- ---------------------------------------------------------------------------
-- Marco (A): «Elimina tutti i prossimi» from a later occurrence
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';

select lives_ok(
  $$ select public.delete_event_occurrence('a5000000-0000-4000-8000-000000000001', '2026-11-03', 'following') $$,
  'A removes «tutti i prossimi» from Tuesday 3 November'
);
select results_eq(
  $$ select g.recurrence_until from public.get_event_occurrence('a5000000-0000-4000-8000-000000000001', '2026-10-22') g $$,
  $$ values ('2026-11-02'::date) $$,
  'the series now ends the day before (CA-39 of #19)'
);
select is_empty(
  $$ select 1 from public.get_event_occurrence('a5000000-0000-4000-8000-000000000001', '2026-11-03')
     union all
     select 1 from public.get_event_occurrence('a5000000-0000-4000-8000-000000000001', '2026-11-07') $$,
  'the occurrences from Tuesday 3 on are gone, the moved one included'
);
select results_eq(
  $$ select g.title from public.get_event_occurrence('a5000000-0000-4000-8000-000000000001', '2026-10-27') g $$,
  $$ values ('Nuoto con papà') $$,
  'the changed occurrence before that day stays'
);
select results_eq(
  $$ select x.occurrence_date from public.event_exceptions x
     where x.event_id = 'a5000000-0000-4000-8000-000000000001' order by 1 $$,
  $$ values ('2026-10-20'::date), ('2026-10-27') $$,
  'the exceptions from that day on are deleted'
);

-- ---------------------------------------------------------------------------
-- Chiara (C, no household) and anonymous users
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}';
select is_empty(
  $$ select 1 from public.event_exceptions $$,
  'a user without household reads no exception'
);
select is_empty(
  $$ select 1 from public.get_event_occurrence('a5000000-0000-4000-8000-000000000001', '2026-10-22') $$,
  'a user without household reads no occurrence'
);

reset role;
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok(
  $$ select 1 from public.event_exceptions $$,
  '42501', null,
  'anonymous users cannot read exceptions'
);
select throws_ok(
  $$ select 1 from public.get_event_occurrence('a5000000-0000-4000-8000-000000000001', '2026-10-22') $$,
  '42501', null,
  'anonymous users cannot call get_event_occurrence'
);
select throws_ok(
  $$ select public.delete_event_occurrence('a5000000-0000-4000-8000-000000000001', '2026-10-22', 'this') $$,
  '42501', null,
  'anonymous users cannot call delete_event_occurrence'
);

reset role;
select * from finish();
rollback;
