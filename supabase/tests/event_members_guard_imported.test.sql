-- Participants of normal events after the linked calendars (issue #275): the guard that
-- keeps imported events without people must not block the other writes.
-- - the administrative key (service_role, used by the fixtures of the e2e tests) adds
--   people to a normal event, naming the household as the fixtures do;
-- - the functions of the app (create_event, update_event, also when it splits a series)
--   add people as before;
-- - unchanged: nobody adds people to an imported event through the Data API, another
--   household cannot add people, anon cannot read nor write.
-- Seed ids: A = Marco (Casa D'Angelo, member a1…01), B = Giulia (Casa Bianchi, b1…01),
-- B2 = Paolo (Casa Bianchi, b1…02). Members of Casa D'Angelo: Marco a1…01, Laura a1…02,
-- Sofia a1…03, Tommaso a1…04, Biscotto a1…05. Paolo has the fake calendar «Personale»
-- e2…01, switched on.
begin;
create extension if not exists pgtap with schema extensions;

select plan(21);

-- ---------------------------------------------------------------------------
-- The guard
-- ---------------------------------------------------------------------------
select ok(
  (select not p.prosecdef and p.proconfig @> array['search_path=""']
   from pg_proc p where p.oid = 'private.event_members_guard_imported()'::regprocedure),
  'the guard is security invoker with an empty search_path'
);
select ok(
  not has_schema_privilege('service_role', 'private', 'usage')
  and not has_function_privilege('service_role', 'private.is_imported_event(uuid)', 'execute'),
  'the fix adds no privilege to service_role on the schema private'
);

-- ---------------------------------------------------------------------------
-- Functions of the app (Marco, A)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';

select lives_ok(
  $$ select set_config('test.normal', public.create_event(
       'Piscina', '2026-11-10 17:00+01', '2026-11-10 18:00+01', 'household',
       array['a1000000-0000-4000-8000-000000000003']::uuid[]
     )::text, true) $$,
  'create_event adds the participants of a normal event'
);
select results_eq(
  $$ select em.member_id from public.event_members em
     where em.event_id = current_setting('test.normal')::uuid order by em.member_id $$,
  $$ values ('a1000000-0000-4000-8000-000000000003'::uuid) $$,
  'the participant of create_event is saved'
);

-- ---------------------------------------------------------------------------
-- Administrative key (fixtures of the e2e tests)
-- ---------------------------------------------------------------------------
set local role service_role;
set local request.jwt.claims to '{"role":"service_role"}';

select lives_ok(
  $$ insert into public.event_members (event_id, member_id, household_id)
     values (current_setting('test.normal')::uuid, 'a1000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111'),
            (current_setting('test.normal')::uuid, 'a1000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111') $$,
  '#275: the administrative key adds people to a normal event, with household_id (as the fixtures do)'
);
select results_eq(
  $$ select em.member_id, em.household_id from public.event_members em
     where em.event_id = current_setting('test.normal')::uuid order by em.member_id $$,
  $$ values ('a1000000-0000-4000-8000-000000000001'::uuid, '11111111-1111-4111-8111-111111111111'::uuid),
            ('a1000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111'),
            ('a1000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111') $$,
  'the three participants belong to the event, in the household of A'
);

-- ---------------------------------------------------------------------------
-- update_event, whole event and split of a series (Marco, A)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';

select lives_ok(
  $$ select * from public.update_event(
       current_setting('test.normal')::uuid, null, 'Piscina', '2026-11-10 17:00+01', '2026-11-10 18:00+01',
       'household', array['a1000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000005']::uuid[],
       null, null, 'none', null, null, null
     ) $$,
  'update_event changes the participants of a normal event'
);
select results_eq(
  $$ select em.member_id from public.event_members em
     where em.event_id = current_setting('test.normal')::uuid order by em.member_id $$,
  $$ values ('a1000000-0000-4000-8000-000000000003'::uuid), ('a1000000-0000-4000-8000-000000000005'::uuid) $$,
  'after update_event the participants are the new ones'
);
select lives_ok(
  $$ select set_config('test.series', public.create_event(
       'Corso', '2026-11-10 19:00+01', '2026-11-10 20:00+01', 'household',
       array['a1000000-0000-4000-8000-000000000001']::uuid[], null, null, 'weekly', '{2}'
     )::text, true) $$,
  'create_event creates a weekly series with a participant'
);
select lives_ok(
  $$ select set_config('test.split', u.id::text, true)
     from public.update_event(
       current_setting('test.series')::uuid, '2026-11-17', 'Corso', '2026-11-17 19:00+01', '2026-11-17 20:00+01',
       'household', array['a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000003']::uuid[],
       null, null, 'weekly', '{2}', null, null
     ) u $$,
  'update_event from a later occurrence splits the series'
);
select ok(
  current_setting('test.split')::uuid <> current_setting('test.series')::uuid,
  'the split gives a new event'
);
select results_eq(
  $$ select em.member_id from public.event_members em
     where em.event_id = current_setting('test.split')::uuid order by em.member_id $$,
  $$ values ('a1000000-0000-4000-8000-000000000001'::uuid), ('a1000000-0000-4000-8000-000000000003'::uuid) $$,
  'the new part of the series has the new participants'
);
select results_eq(
  $$ select em.member_id from public.event_members em
     where em.event_id = current_setting('test.series')::uuid order by em.member_id $$,
  $$ values ('a1000000-0000-4000-8000-000000000001'::uuid) $$,
  'the old part keeps its participant'
);

-- ---------------------------------------------------------------------------
-- Isolation: B and anon
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ insert into public.event_members (event_id, member_id)
     values (current_setting('test.normal')::uuid, 'b1000000-0000-4000-8000-000000000003') $$,
  '42501', null,
  'B cannot add people to an event of A'
);
select throws_ok(
  $$ insert into public.event_members (event_id, member_id, household_id)
     values (current_setting('test.normal')::uuid, 'a1000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111') $$,
  '42501', null,
  'B cannot add people to an event of A naming the household of A'
);
select is_empty(
  $$ select 1 from public.event_members em where em.event_id = current_setting('test.normal')::uuid $$,
  'B does not see the participants of A'
);

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok(
  $$ insert into public.event_members (event_id, member_id)
     values (current_setting('test.normal')::uuid, 'a1000000-0000-4000-8000-000000000002') $$,
  '42501', null,
  'anon cannot add people'
);
select throws_ok(
  $$ select 1 from public.event_members $$,
  '42501', null,
  'anon cannot read the participants'
);

-- ---------------------------------------------------------------------------
-- Imported events stay without people added through the Data API
-- ---------------------------------------------------------------------------
set local role service_role;
set local request.jwt.claims to '{"role":"service_role"}';
select lives_ok(
  $$ select * from public.sync_external_calendar_events(
       'e2000000-0000-4000-8000-000000000001',
       jsonb_build_array(jsonb_build_object('id', 'ev-275', 'title', 'Riunione',
         'starts_at', '2026-11-11 10:00+01', 'ends_at', '2026-11-11 11:00+01')),
       true, 'cursor-275', '2026-11-09 09:00+01') $$,
  'the synchronisation imports an event of Paolo'
);

set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok(
  $$ insert into public.event_members (event_id, member_id)
     select e.id, 'b1000000-0000-4000-8000-000000000003'
     from public.events e
     where e.title = 'Riunione' $$,
  '42501', 'nobody can be added to an imported event',
  'the author cannot add people to his imported event'
);

reset role;
select is_empty(
  $$ select 1 from public.event_members em join public.events e on e.id = em.event_id
     where e.title = 'Riunione' and e.household_id = '22222222-2222-4222-8222-222222222222' $$,
  'the imported event is still without people'
);

select * from finish();
rollback;
