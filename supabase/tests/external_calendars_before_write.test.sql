-- external_calendars_before_write for every role (issue #277): the administrative key
-- (service_role, used by the fixtures of the e2e tests) writes into external_calendars,
-- also with «Dove vanno i nuovi impegni», and the rules of the trigger and of the app do
-- not change.
-- The administrative key comes first: PL/pgSQL keeps the plan of an expression for the
-- whole session, so the defect shows only when service_role is the first role that runs
-- the trigger in the session.
-- Seed ids: Paolo (Casa Bianchi, user bbbbbbbb…02, member b1…02) has the fake account
-- e1…01 with «Personale» e2…01 (switched on, «Entrata e uscita», «Dove vanno i nuovi
-- impegni») and «Festività in Italia» e2…02 (switched off, read only). Giulia (bbbbbbbb…01)
-- is the other adult of Casa Bianchi; Marco (aaaaaaaa…01) is in Casa D'Angelo.
begin;
create extension if not exists pgtap with schema extensions;

select plan(30);

-- ---------------------------------------------------------------------------
-- The administrative key (#277)
-- ---------------------------------------------------------------------------
set local role service_role;
set local request.jwt.claims to '{"role":"service_role"}';

select lives_ok(
  $$ update public.external_calendars set weekdays_only = true
     where id = 'e2000000-0000-4000-8000-000000000001' $$,
  '#277: the administrative key changes the calendar of «Dove vanno i nuovi impegni»'
);
select lives_ok(
  $$ update public.external_calendars set is_new_events_target = true
     where id = 'e2000000-0000-4000-8000-000000000002' $$,
  '#277: the administrative key writes is_new_events_target = true on an ineligible calendar'
);
select results_eq(
  $$ select c.id, c.is_new_events_target from public.external_calendars c
     where c.account_id = 'e1000000-0000-4000-8000-000000000001' order by c.id $$,
  $$ values ('e2000000-0000-4000-8000-000000000001'::uuid, true),
            ('e2000000-0000-4000-8000-000000000002'::uuid, false) $$,
  'the ineligible calendar is not the choice (cleared by the trigger, not refused)'
);
select throws_ok(
  $$ update public.external_calendars set member_id = 'b1000000-0000-4000-8000-000000000001'
     where id = 'e2000000-0000-4000-8000-000000000001' $$,
  '42501', 'this calendar field cannot be changed',
  'also for the administrative key the adult of a calendar never changes'
);
select lives_ok(
  $$ update public.external_calendars set is_new_events_target = false
     where id = 'e2000000-0000-4000-8000-000000000001' $$,
  'the administrative key clears the choice'
);

-- Every combination of switched on, direction and read only, inserted with
-- is_new_events_target = true: the choice stays exactly where
-- private.external_calendar_is_target_eligible() says so.
select lives_ok(
  $$ insert into public.external_calendars (
       household_id, member_id, account_id, provider_calendar_id, name,
       is_enabled, direction, is_read_only, is_new_events_target)
     select '22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000002',
            'e1000000-0000-4000-8000-000000000001',
            'fake-277-' || e::text || '-' || d::text || '-' || r::text, '  Prova   277 ',
            e, d, r, true
     from unnest(array[false, true]) as e
     cross join unnest(enum_range(null::public.calendar_direction)) as d
     cross join unnest(array[false, true]) as r $$,
  '#277: the administrative key inserts calendars with is_new_events_target = true'
);

reset role;
select results_eq(
  $$ select count(*)::integer, count(*) filter (where c.is_new_events_target)::integer,
            count(*) filter (where c.name = 'Prova 277')::integer,
            count(*) filter (where c.is_read_only and c.direction <> 'incoming')::integer
     from public.external_calendars c where c.provider_calendar_id like 'fake-277-%' $$,
  $$ values (8, 1, 8, 0) $$,
  'eight calendars, one choice, names normalised, read only always «Solo in entrata»'
);
select ok(
  (select bool_and(c.is_new_events_target = private.external_calendar_is_target_eligible(c))
   from public.external_calendars c where c.provider_calendar_id like 'fake-277-%'),
  'the trigger and private.external_calendar_is_target_eligible() agree on every combination'
);
select ok(
  (select bool_and(
     private.external_calendar_is_target_eligible(
       jsonb_populate_record(c, jsonb_build_object('is_enabled', e, 'direction', d, 'is_read_only', r)))
     = coalesce(e and d = 'two_way' and not r, false))
   from public.external_calendars c
   cross join unnest(array[false, true, null]) as e
   cross join unnest(enum_range(null::public.calendar_direction)) as d
   cross join unnest(array[false, true, null]) as r
   where c.id = 'e2000000-0000-4000-8000-000000000001'),
  'the condition written in the trigger is the one of the helper, also with null values'
);

-- ---------------------------------------------------------------------------
-- The trigger
-- ---------------------------------------------------------------------------
select ok(
  (select not p.prosecdef and p.proconfig @> array['search_path=""']
   from pg_proc p where p.oid = 'private.external_calendars_before_write()'::regprocedure),
  'the trigger is security invoker with an empty search_path'
);
select ok(
  (select p.prosrc !~ 'private\.'
   from pg_proc p where p.oid = 'private.external_calendars_before_write()'::regprocedure),
  '#277: the trigger no longer calls the private schema'
);
select ok(
  not has_schema_privilege('service_role', 'private', 'usage')
  and not has_function_privilege('service_role', 'private.external_calendar_is_target_eligible(public.external_calendars)', 'execute'),
  'the fix adds no privilege to service_role on the schema private'
);
select ok(
  not has_function_privilege('authenticated', 'private.external_calendars_before_write()', 'execute')
  and not has_function_privilege('anon', 'private.external_calendars_before_write()', 'execute'),
  'the trigger function is still not callable by the Data API roles'
);

-- Back to the seed for the app: only «Personale» and «Festività in Italia», «Personale» is
-- the choice of Paolo.
delete from public.external_calendars c where c.provider_calendar_id like 'fake-277-%';
update public.external_calendars c
set weekdays_only = false, is_new_events_target = true
where c.id = 'e2000000-0000-4000-8000-000000000001';

-- ---------------------------------------------------------------------------
-- The app (Paolo, the adult of the calendars): unchanged rules
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';

select throws_ok(
  $$ update public.external_calendars set is_new_events_target = false
     where id = 'e2000000-0000-4000-8000-000000000001' $$,
  '42501', null,
  'the app never sets «Dove vanno i nuovi impegni» directly'
);
select throws_ok(
  $$ update public.external_calendars set account_id = 'e1000000-0000-4000-8000-000000000001'
     where id = 'e2000000-0000-4000-8000-000000000001' $$,
  '42501', null,
  'the app never changes the account of a calendar'
);
select lives_ok(
  $$ update public.external_calendars set direction = 'incoming'
     where id = 'e2000000-0000-4000-8000-000000000001' $$,
  'Paolo sets «Personale» to «Solo in entrata»'
);
select results_eq(
  $$ select c.direction::text, c.is_new_events_target from public.external_calendars c
     where c.id = 'e2000000-0000-4000-8000-000000000001' $$,
  $$ values ('incoming', false) $$,
  '«Solo in entrata» clears «Dove vanno i nuovi impegni»'
);
select lives_ok(
  $$ update public.external_calendars set direction = 'two_way'
     where id = 'e2000000-0000-4000-8000-000000000001' $$,
  'Paolo sets «Personale» back to «Entrata e uscita»'
);
select results_eq(
  $$ select c.is_new_events_target from public.external_calendars c
     where c.id = 'e2000000-0000-4000-8000-000000000001' $$,
  $$ values (true) $$,
  'eligible again and Paolo has no choice: it is «Dove vanno i nuovi impegni» again'
);
select lives_ok(
  $$ update public.external_calendars set is_enabled = false
     where id = 'e2000000-0000-4000-8000-000000000001' $$,
  'Paolo switches «Personale» off'
);
select results_eq(
  $$ select c.is_enabled, c.is_new_events_target from public.external_calendars c
     where c.id = 'e2000000-0000-4000-8000-000000000001' $$,
  $$ values (false, false) $$,
  'switched off: «Dove vanno i nuovi impegni» is cleared'
);
select lives_ok(
  $$ update public.external_calendars set is_enabled = true
     where id = 'e2000000-0000-4000-8000-000000000001' $$,
  'Paolo switches «Personale» on again'
);
select lives_ok(
  $$ select public.set_new_events_calendar('e2000000-0000-4000-8000-000000000001') $$,
  'Paolo chooses «Personale» with set_new_events_calendar()'
);
select results_eq(
  $$ select c.id from public.external_calendars c where c.is_new_events_target $$,
  $$ values ('e2000000-0000-4000-8000-000000000001'::uuid) $$,
  '«Personale» is «Dove vanno i nuovi impegni»'
);
select throws_ok(
  $$ select public.set_new_events_calendar('e2000000-0000-4000-8000-000000000002') $$,
  'P0002', 'calendar not found',
  'a read-only calendar switched off is never «Dove vanno i nuovi impegni»'
);

-- ---------------------------------------------------------------------------
-- Isolation: the other adult of the household, another household, anon
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select is_empty(
  $$ with u as (
       update public.external_calendars set is_enabled = false
       where id = 'e2000000-0000-4000-8000-000000000001' returning id
     ) select * from u $$,
  'Giulia (same household) changes no calendar of Paolo'
);

set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select is_empty(
  $$ with u as (
       update public.external_calendars set direction = 'incoming'
       where id = 'e2000000-0000-4000-8000-000000000001' returning id
     ) select * from u $$,
  'Marco (Casa D''Angelo) changes no calendar of Paolo'
);
select is_empty(
  $$ select 1 from public.external_calendars $$,
  'Marco reads no calendar of Paolo'
);

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok(
  $$ update public.external_calendars set is_enabled = false $$,
  '42501', null,
  'anon cannot change the calendars'
);

reset role;
select results_eq(
  $$ select c.is_enabled, c.direction::text, c.is_new_events_target from public.external_calendars c
     where c.id = 'e2000000-0000-4000-8000-000000000001' $$,
  $$ values (true, 'two_way', true) $$,
  'after the refused changes «Personale» is unchanged'
);

select * from finish();
rollback;
