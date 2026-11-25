-- «Chi lo vede» → «Solo alcune persone» (issue #510, DB-1 of plan #501): event_viewers,
-- who sees the event in full and who sees it as «Occupato» (CA-20 – CA-23), and the
-- isolation between households of the new tables and functions (CA-24).
-- Seed ids: A = Marco (Casa D'Angelo, user aaaaaaaa…01, member a1…01), B = Giulia (Casa
-- Bianchi, bbbbbbbb…01, b1…01). Casa D'Angelo: Laura a1…02, Sofia a1…03 (child), Tommaso
-- a1…04 (child), Biscotto a1…05 (pet).
-- This test gives Laura an account (user aaaaaaaa…02) and adds a third adult, Davide
-- (a1…06, user aaaaaaaa…03). Dates are fixed: no rule tested here depends on the real
-- clock. No health data (D1).
begin;
create extension if not exists pgtap with schema extensions;

select plan(57);

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
select has_table('public', 'event_viewers', 'event_viewers exists');
select ok(
  (select c.relrowsecurity from pg_class c where c.oid = 'public.event_viewers'::regclass),
  'RLS enabled on event_viewers'
);
select columns_are(
  'public', 'event_viewers', array['event_id', 'member_id', 'household_id', 'created_at'],
  'event_viewers has exactly the planned columns'
);
select col_is_pk('public', 'event_viewers', array['event_id', 'member_id'], 'one row per event and person');
select fk_ok(
  'public', 'event_viewers', array['event_id', 'household_id'],
  'public', 'events', array['id', 'household_id'],
  'a chosen person belongs to an event of the same household'
);
select fk_ok(
  'public', 'event_viewers', array['member_id', 'household_id'],
  'public', 'household_members', array['id', 'household_id'],
  'a chosen person is a member of the same household'
);
select has_index('public', 'event_viewers', 'event_viewers_member_id_idx', 'index on the person');
select has_index('public', 'event_viewers', 'event_viewers_household_id_idx', 'index on the household');
select policies_are(
  'public', 'event_viewers',
  array['event_viewers_select', 'event_viewers_insert', 'event_viewers_delete'],
  'event_viewers: select, insert and delete; no update'
);
select ok(
  not has_table_privilege('anon', 'public.event_viewers', 'select')
  and not has_table_privilege('anon', 'public.event_viewers', 'insert')
  and not has_table_privilege('anon', 'public.event_viewers', 'delete')
  and not has_table_privilege('authenticated', 'public.event_viewers', 'update')
  and not has_column_privilege('authenticated', 'public.event_viewers', 'created_at', 'insert'),
  'CA-24: anon has no privilege on event_viewers; nobody updates it'
);
select ok(
  (select bool_and(p.prosecdef and p.proconfig @> array['search_path=""']) from pg_proc p
   where p.oid in ('private.is_event_viewer(uuid)'::regprocedure, 'private.is_event_author(uuid)'::regprocedure))
  and not has_function_privilege('anon', 'private.is_event_viewer(uuid)', 'execute')
  and not has_function_privilege('anon', 'private.is_event_author(uuid)', 'execute'),
  'the helpers of the policies are security definer with an empty search_path, never for anon'
);

-- ---------------------------------------------------------------------------
-- CA-23: never the default visibility
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ update public.profiles set default_event_visibility = 'selected' where id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  '23514', null,
  'CA-23: «Solo alcune persone» cannot be the default visibility'
);

-- ---------------------------------------------------------------------------
-- CA-21: the chosen people
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ select public.create_event('Senza persone', '2026-12-10 20:00+01', '2026-12-10 22:00+01', 'selected', array[]::uuid[]) $$,
  '22023', null,
  'CA-21: «Solo alcune persone» without people is refused'
);
select throws_ok(
  $$ select public.create_event('Lista vuota', '2026-12-10 20:00+01', '2026-12-10 22:00+01', 'selected', array[]::uuid[],
       p_viewer_ids => array[]::uuid[]) $$,
  '22023', null,
  'CA-21: also with an empty list'
);
select throws_ok(
  $$ select public.create_event('Con Sofia', '2026-12-10 20:00+01', '2026-12-10 22:00+01', 'selected', array[]::uuid[],
       p_viewer_ids => array['a1000000-0000-4000-8000-000000000003']::uuid[]) $$,
  '23514', null,
  'CA-21: a child cannot be chosen'
);
select throws_ok(
  $$ select public.create_event('Con Biscotto', '2026-12-10 20:00+01', '2026-12-10 22:00+01', 'selected', array[]::uuid[],
       p_viewer_ids => array['a1000000-0000-4000-8000-000000000005']::uuid[]) $$,
  '23514', null,
  'CA-21: a pet cannot be chosen'
);
select throws_ok(
  $$ select public.create_event('Con Giulia', '2026-12-10 20:00+01', '2026-12-10 22:00+01', 'selected', array[]::uuid[],
       p_viewer_ids => array['b1000000-0000-4000-8000-000000000001']::uuid[]) $$,
  '23503', null,
  'CA-21: an adult of another household cannot be chosen'
);
select throws_ok(
  $$ select public.create_event('Persone per tutti', '2026-12-10 20:00+01', '2026-12-10 22:00+01', 'household', array[]::uuid[],
       p_viewer_ids => array['a1000000-0000-4000-8000-000000000002']::uuid[]) $$,
  '22023', null,
  'people are chosen only for «Solo alcune persone»'
);
select is_empty(
  $$ select 1 from public.events e
     where e.title in ('Senza persone', 'Lista vuota', 'Con Sofia', 'Con Biscotto', 'Con Giulia', 'Persone per tutti') $$,
  'CA-21: nothing is written'
);

-- ---------------------------------------------------------------------------
-- CA-20: who sees the event
-- ---------------------------------------------------------------------------
select lives_ok(
  $$ select set_config('test.sorpresa', public.create_event(
       'Sorpresa per Davide', '2026-12-10 20:00+01', '2026-12-10 22:00+01', 'selected', array[]::uuid[],
       p_location => 'Ristorante', p_viewer_ids => array['a1000000-0000-4000-8000-000000000002']::uuid[]
     )::text, true) $$,
  'CA-20: Marco creates an event «Solo alcune persone» for Laura'
);
select results_eq(
  $$ select c.viewer_ids from public.list_calendar_events('2026-12-10 00:00+01', '2026-12-11 00:00+01') c
     where c.id = current_setting('test.sorpresa')::uuid $$,
  $$ values (array['a1000000-0000-4000-8000-000000000002']::uuid[]) $$,
  'the author reads the chosen people in the calendar'
);
select results_eq(
  $$ select o.viewer_ids from public.get_event_occurrence(current_setting('test.sorpresa')::uuid) o $$,
  $$ values (array['a1000000-0000-4000-8000-000000000002']::uuid[]) $$,
  'and in the detail'
);

set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}';
select results_eq(
  $$ select e.title, e.location from public.events e where e.id = current_setting('test.sorpresa')::uuid $$,
  $$ values ('Sorpresa per Davide'::text, 'Ristorante'::text) $$,
  'CA-20: Laura, chosen, reads the row'
);
select results_eq(
  $$ select c.is_masked, c.title, c.visibility::text, c.viewer_ids from public.list_calendar_events('2026-12-10 00:00+01', '2026-12-11 00:00+01') c
     where c.id = current_setting('test.sorpresa')::uuid $$,
  $$ values (false, 'Sorpresa per Davide'::text, 'selected'::text, null::uuid[]) $$,
  'CA-20: Laura sees it in full in the calendar, but not who else was chosen'
);
select results_eq(
  $$ select o.title, o.viewer_ids from public.get_event_occurrence(current_setting('test.sorpresa')::uuid) o $$,
  $$ values ('Sorpresa per Davide'::text, null::uuid[]) $$,
  'CA-20: and in the detail'
);
select results_eq(
  $$ select v.member_id from public.event_viewers v where v.event_id = current_setting('test.sorpresa')::uuid $$,
  $$ values ('a1000000-0000-4000-8000-000000000002'::uuid) $$,
  'Laura, who sees the event in full, reads its rows of event_viewers'
);

-- CA-22: Laura cannot change the chosen people.
select throws_ok(
  $$ insert into public.event_viewers (event_id, member_id)
     values (current_setting('test.sorpresa')::uuid, 'a1000000-0000-4000-8000-000000000006') $$,
  '42501', null,
  'CA-22: Laura (chosen) cannot add a person'
);
select is_empty(
  $$ delete from public.event_viewers v where v.event_id = current_setting('test.sorpresa')::uuid returning v.member_id $$,
  'CA-22: Laura cannot remove a person (0 rows)'
);
select throws_ok(
  $$ update public.event_viewers set member_id = 'a1000000-0000-4000-8000-000000000006'
     where event_id = current_setting('test.sorpresa')::uuid $$,
  '42501', null,
  'CA-22: nobody updates the chosen people'
);
select throws_ok(
  $$ select * from public.update_event(
       current_setting('test.sorpresa')::uuid, null, 'Sorpresa per Davide', '2026-12-10 20:00+01', '2026-12-10 22:00+01',
       'selected', array[]::uuid[], 'Ristorante', null, 'none', null, null, null,
       p_viewer_ids => array['a1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000006']::uuid[]
     ) $$,
  '42501', null,
  'CA-22: nor with update_event'
);
select lives_ok(
  $$ select * from public.update_event(
       current_setting('test.sorpresa')::uuid, null, 'Sorpresa per Davide!', '2026-12-10 20:00+01', '2026-12-10 22:00+01',
       'selected', array[]::uuid[], 'Ristorante', null, 'none', null, null, null
     ) $$,
  'Laura changes the title without touching the chosen people (p_viewer_ids null keeps them)'
);
select throws_ok(
  $$ update public.events set visibility = 'household' where id = current_setting('test.sorpresa')::uuid $$,
  '42501', null,
  'Laura cannot change who sees the event'
);
select throws_ok(
  $$ update public.events set pickup_member_id = 'a1000000-0000-4000-8000-000000000006'
     where id = current_setting('test.sorpresa')::uuid $$,
  '42501', null,
  'Laura cannot add a person through «Lo riprende» either'
);

set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000003","role":"authenticated"}';
select is_empty(
  $$ select 1 from public.events e where e.id = current_setting('test.sorpresa')::uuid $$,
  'CA-20: Davide (not chosen) has 0 rows from the table'
);
select is_empty(
  $$ select 1 from public.event_viewers v where v.event_id = current_setting('test.sorpresa')::uuid $$,
  'Davide does not read who was chosen'
);
select results_eq(
  $$ select c.is_masked, c.id, c.title, c.location, c.member_ids, c.escort_member_id, c.visibility::text,
            c.pickup_member_id, c.unverified_fields, c.viewer_ids
     from public.list_calendar_events('2026-12-10 00:00+01', '2026-12-11 00:00+01') c
     where c.author_member_id = 'a1000000-0000-4000-8000-000000000001' $$,
  $$ values (true, null::uuid, null::text, null::text, null::uuid[], null::uuid, 'busy'::text,
             null::uuid, null::public.event_field[], null::uuid[]) $$,
  'CA-20: in list_calendar_events Davide gets one masked row, exactly as «Occupato»'
);
select results_eq(
  $$ select h.is_masked, h.id, h.visibility::text from public.list_household_events('2026-12-10 00:00+01', '2026-12-11 00:00+01') h
     where h.author_member_id = 'a1000000-0000-4000-8000-000000000001' $$,
  $$ values (true, null::uuid, 'busy'::text) $$,
  'the calendar of the pages already on main shows it as «Occupato» too'
);
select is_empty(
  $$ select 1 from public.get_event_occurrence(current_setting('test.sorpresa')::uuid) $$,
  'CA-20: get_event_occurrence gives Davide nothing'
);

-- The author changes the chosen people, and then the visibility.
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok(
  $$ select * from public.update_event(
       current_setting('test.sorpresa')::uuid, null, 'Sorpresa', '2026-12-10 20:00+01', '2026-12-10 22:00+01',
       'selected', array[]::uuid[], 'Ristorante', null, 'none', null, null, null,
       p_viewer_ids => array['a1000000-0000-4000-8000-000000000006']::uuid[]
     ) $$,
  'Marco chooses Davide instead of Laura'
);
select results_eq(
  $$ select v.member_id from public.event_viewers v where v.event_id = current_setting('test.sorpresa')::uuid $$,
  $$ values ('a1000000-0000-4000-8000-000000000006'::uuid) $$,
  'only Davide is chosen now'
);
select throws_ok(
  $$ select * from public.update_event(
       current_setting('test.sorpresa')::uuid, null, 'Sorpresa', '2026-12-10 20:00+01', '2026-12-10 22:00+01',
       'selected', array[]::uuid[], 'Ristorante', null, 'none', null, null, null, p_viewer_ids => array[]::uuid[]
     ) $$,
  '22023', null,
  'an event «Solo alcune persone» keeps at least one chosen person'
);
select lives_ok(
  $$ update public.events set visibility = 'busy' where id = current_setting('test.sorpresa')::uuid $$,
  'Marco turns it into «Occupato»'
);
select is_empty(
  $$ select 1 from public.event_viewers v where v.event_id = current_setting('test.sorpresa')::uuid $$,
  'leaving «Solo alcune persone» removes the chosen people'
);
select throws_ok(
  $$ insert into public.event_viewers (event_id, member_id)
     values (current_setting('test.sorpresa')::uuid, 'a1000000-0000-4000-8000-000000000002') $$,
  '22023', null,
  'nobody is chosen for an event that is not «Solo alcune persone»'
);

-- A series «Solo alcune persone» split from one occurrence keeps the chosen people.
select lives_ok(
  $$ select set_config('test.serie', public.create_event(
       'Corso', '2026-12-01 20:00+01', '2026-12-01 21:00+01', 'selected', array[]::uuid[],
       p_recurrence => 'weekly', p_recurrence_weekdays => array[2]::smallint[],
       p_viewer_ids => array['a1000000-0000-4000-8000-000000000002']::uuid[]
     )::text, true) $$,
  'Marco creates a weekly event «Solo alcune persone» for Laura'
);
select lives_ok(
  $$ select set_config('test.serie_new', (select u.id from public.update_event(
       current_setting('test.serie')::uuid, '2026-12-15', 'Corso avanzato', '2026-12-15 20:00+01', '2026-12-15 21:00+01',
       'selected', array[]::uuid[], null, null, 'weekly', array[2]::smallint[], null, null
     ) u)::text, true) $$,
  'and changes it from 15 December on'
);
select results_eq(
  $$ select v.member_id from public.event_viewers v where v.event_id = current_setting('test.serie_new')::uuid $$,
  $$ values ('a1000000-0000-4000-8000-000000000002'::uuid) $$,
  'the new part has the same chosen people'
);

-- When the author leaves, the event goes (as every «Occupato» of theirs).
reset role;
insert into public.events (id, household_id, author_member_id, title, starts_at, ends_at, visibility)
values ('a5200000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
        'a1000000-0000-4000-8000-000000000006', 'Di Davide', '2026-12-11 20:00+01', '2026-12-11 21:00+01', 'selected');
insert into public.event_viewers (event_id, member_id, household_id)
values ('a5200000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111');
delete from public.household_members where id = 'a1000000-0000-4000-8000-000000000006';
select is_empty(
  $$ select 1 from public.events e where e.id = 'a5200000-0000-4000-8000-000000000001' $$,
  'the event «Solo alcune persone» of an adult who leaves is deleted'
);

-- ---------------------------------------------------------------------------
-- CA-24: household B never reads nor writes anything of A
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select is_empty(
  $$ select 1 from public.events e where e.household_id = '11111111-1111-4111-8111-111111111111'
     union all select 1 from public.event_exceptions x where x.household_id = '11111111-1111-4111-8111-111111111111'
     union all select 1 from public.event_viewers v where v.household_id = '11111111-1111-4111-8111-111111111111' $$,
  'CA-24: Giulia reads no row of A from events, event_exceptions and event_viewers'
);
select is_empty(
  $$ select 1 from public.list_calendar_events('2026-12-01 00:00+01', '2026-12-31 00:00+01') c
     where c.author_member_id in (select m.id from public.household_members m where m.household_id = '11111111-1111-4111-8111-111111111111')
        or c.author_member_id::text like 'a1000000-%' $$,
  'CA-24: list_calendar_events gives Giulia no row of A'
);
select is_empty(
  $$ select 1 from public.get_event_occurrence(current_setting('test.serie')::uuid) $$,
  'CA-24: get_event_occurrence gives Giulia nothing of A'
);
select throws_ok(
  $$ insert into public.event_viewers (event_id, member_id, household_id)
     values (current_setting('test.serie')::uuid, 'b1000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111') $$,
  '42501', null,
  'CA-24: Giulia cannot choose people for an event of A'
);
select throws_ok(
  $$ insert into public.event_viewers (event_id, member_id)
     values (current_setting('test.serie')::uuid, 'b1000000-0000-4000-8000-000000000002') $$,
  '42501', null,
  'CA-24: not even naming her own household'
);
select is_empty(
  $$ delete from public.event_viewers v where v.event_id = current_setting('test.serie')::uuid returning 1 $$,
  'CA-24: Giulia cannot remove the chosen people of A (0 rows)'
);
select is_empty(
  $$ update public.events set pickup_member_id = null, all_day = false
     where household_id = '11111111-1111-4111-8111-111111111111' returning 1 $$,
  'CA-24: Giulia cannot change the events of A (0 rows)'
);

-- ---------------------------------------------------------------------------
-- anon
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok(
  $$ select 1 from public.event_viewers $$,
  '42501', null,
  'CA-24: anon cannot read event_viewers'
);
select throws_ok(
  $$ select 1 from public.list_calendar_events('2026-12-01 00:00+01', '2026-12-31 00:00+01') $$,
  '42501', null,
  'CA-24: anon cannot call list_calendar_events'
);

select * from finish();
rollback;
