-- The claim of the rows of calendar_outbox (issue #373): two runs of the synchronisation
-- service never take the same row; a claim that expires (the run died) makes the row free
-- again; a failure frees it; the filters by provider (fake or real) and by adult; a change of
-- the event while its row is being sent is never lost; no access for authenticated and anon.
-- Seed ids: A = Marco (Casa D'Angelo, member a1…01), B = Giulia (Casa Bianchi, b1…01),
-- B2 = Paolo (Casa Bianchi, b1…02, fake account e1…01 with «Personale» e2…01), C = Chiara (no
-- household).
-- Added here: Marco's fake account 9a…01 with calendar 9b…01, Giulia's real account 9a…02
-- with calendar 9b…02, and five rows «delete» (no event needed):
--   9c…01 Paolo, due 8:00   9c…02 Paolo, due 8:01   9c…03 Paolo, due tomorrow (not due)
--   9c…04 Marco, due 8:02   9c…05 Giulia (real provider), due 7:00
-- The instant of the runs is fixed: Monday 9 November 2026, 9:00 in Rome. The claims expire
-- with the real time of the database (now()), never with that instant.
-- A single pgTAP session cannot hold two transactions: two runs «together» are two claims
-- one after the other inside the same transaction (the first one has not ended), and the
-- body of the function is checked for `for update … skip locked`.
begin;
create extension if not exists pgtap with schema extensions;

select plan(54);

-- ---------------------------------------------------------------------------
-- Schema and privileges
-- ---------------------------------------------------------------------------
select has_function(
  'public', 'claim_calendar_outbox_items', array['integer', 'boolean', 'uuid', 'timestamp with time zone'],
  'claim_calendar_outbox_items(limit, is_fake, user_id, at) exists'
);
select ok(
  (select p.prosecdef and p.provolatile = 'v' and p.proconfig @> array['search_path=""']
   from pg_proc p where p.oid = 'public.claim_calendar_outbox_items(integer, boolean, uuid, timestamptz)'::regprocedure),
  'security definer, volatile, empty search_path'
);
select ok(
  pg_get_functiondef('public.claim_calendar_outbox_items(integer, boolean, uuid, timestamptz)'::regprocedure)
    ~* 'for\s+update\s+of\s+o\s+skip\s+locked',
  'the rows are locked with «for update … skip locked»: a row held by another run is skipped, never waited for'
);
select ok(
  not has_function_privilege('anon', 'public.claim_calendar_outbox_items(integer, boolean, uuid, timestamptz)', 'execute')
  and not has_function_privilege('authenticated', 'public.claim_calendar_outbox_items(integer, boolean, uuid, timestamptz)', 'execute')
  and not has_function_privilege('anon', 'public.complete_calendar_outbox_item(uuid, text, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.complete_calendar_outbox_item(uuid, text, text)', 'execute')
  and not has_function_privilege('anon', 'public.fail_calendar_outbox_item(uuid, timestamptz)', 'execute')
  and not has_function_privilege('authenticated', 'public.fail_calendar_outbox_item(uuid, timestamptz)', 'execute')
  and not has_function_privilege('authenticated', 'private.queue_sent_event_update(uuid)', 'execute'),
  'neither the app nor anon can claim, complete or fail a row'
);
select ok(
  has_function_privilege('service_role', 'public.claim_calendar_outbox_items(integer, boolean, uuid, timestamptz)', 'execute')
  and has_function_privilege('service_role', 'public.complete_calendar_outbox_item(uuid, text, text)', 'execute')
  and has_function_privilege('service_role', 'public.fail_calendar_outbox_item(uuid, timestamptz)', 'execute'),
  'the synchronisation service (service_role) claims, completes and fails'
);
select ok(
  not has_table_privilege('anon', 'public.calendar_outbox', 'select, insert, update, delete')
  and not has_table_privilege('authenticated', 'public.calendar_outbox', 'select, insert, update, delete')
  and not has_any_column_privilege('authenticated', 'public.calendar_outbox', 'select, insert, update')
  and not has_any_column_privilege('anon', 'public.calendar_outbox', 'select, insert, update'),
  'still no privilege on the outbox for the app and anon (claim columns included)'
);
select col_default_is('public', 'calendar_outbox', 'changed_while_claimed', 'false', 'a new row is not marked');
select col_is_null('public', 'calendar_outbox', 'claimed_until', 'claimed_until is null for a free row');

-- ---------------------------------------------------------------------------
-- Rows of three adults
-- ---------------------------------------------------------------------------
delete from public.calendar_outbox;
insert into public.calendar_accounts (
  id, household_id, member_id, provider, provider_account_id, email, is_fake, credentials_ciphertext
)
values
  ('9a000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'a1000000-0000-4000-8000-000000000001', 'google', 'fake-claims-marco', 'marco.finto@example.test', true,
   'v1:test.placeholder.not.a.credential.000000'),
  ('9a000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222',
   'b1000000-0000-4000-8000-000000000001', 'outlook', 'real-claims-giulia', 'giulia.vera@example.test', false,
   'v1:test.placeholder.not.a.credential.000000');
insert into public.external_calendars (
  id, household_id, member_id, account_id, provider_calendar_id, name, is_primary, is_read_only, is_enabled
)
values
  ('9b000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'a1000000-0000-4000-8000-000000000001', '9a000000-0000-4000-8000-000000000001', 'fake-marco', 'Lavoro',
   true, false, true),
  ('9b000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222',
   'b1000000-0000-4000-8000-000000000001', '9a000000-0000-4000-8000-000000000002', 'real-giulia', 'Casa',
   true, false, true);
insert into public.calendar_outbox (id, household_id, calendar_id, action, provider_event_id, next_attempt_at)
values
  ('9c000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222',
   'e2000000-0000-4000-8000-000000000001', 'delete', 'g-paolo-1', '2026-11-09 08:00+01'),
  ('9c000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222',
   'e2000000-0000-4000-8000-000000000001', 'delete', 'g-paolo-2', '2026-11-09 08:01+01'),
  ('9c000000-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222222',
   'e2000000-0000-4000-8000-000000000001', 'delete', 'g-paolo-3', '2026-11-10 09:00+01'),
  ('9c000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111',
   '9b000000-0000-4000-8000-000000000001', 'delete', 'g-marco-1', '2026-11-09 08:02+01'),
  ('9c000000-0000-4000-8000-000000000005', '22222222-2222-4222-8222-222222222222',
   '9b000000-0000-4000-8000-000000000002', 'delete', 'o-giulia-1', '2026-11-09 07:00+01');

-- ---------------------------------------------------------------------------
-- No access for the app (both households) and anon
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.method to 'POST';
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok(
  $$ select * from public.claim_calendar_outbox_items(50, true, null, '2026-11-09 09:00+01') $$,
  '42501', null,
  'Paolo cannot claim his own rows'
);
select throws_ok(
  $$ select 1 from public.calendar_outbox $$,
  '42501', null,
  'Paolo cannot read the outbox'
);
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select * from public.claim_calendar_outbox_items(50, true, 'bbbbbbbb-0000-4000-8000-000000000002', '2026-11-09 09:00+01') $$,
  '42501', null,
  'Marco (other household) cannot claim the rows of Paolo'
);
select throws_ok(
  $$ update public.calendar_outbox set claimed_until = null $$,
  '42501', null,
  'Marco cannot free a row'
);
select throws_ok(
  $$ select public.fail_calendar_outbox_item('9c000000-0000-4000-8000-000000000001', '2026-11-09 08:00+01') $$,
  '42501', null,
  'Marco cannot fail a row of the other household'
);
select throws_ok(
  $$ select public.complete_calendar_outbox_item('9c000000-0000-4000-8000-000000000001') $$,
  '42501', null,
  'Marco cannot complete a row of the other household'
);
reset role;
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok(
  $$ select * from public.claim_calendar_outbox_items(50, true, null, '2026-11-09 09:00+01') $$,
  '42501', null,
  'anon cannot claim'
);
select throws_ok($$ select 1 from public.calendar_outbox $$, '42501', null, 'anon cannot read the outbox');
reset role;
select is(
  (select count(*)::integer from public.calendar_outbox o where o.claimed_until is not null),
  0,
  'nothing was claimed by the refused calls'
);

-- ---------------------------------------------------------------------------
-- Two runs together never take the same row
-- ---------------------------------------------------------------------------
set local role service_role;
set local request.jwt.claims to '{"role":"service_role"}';
select results_eq(
  $$ select c.id, c.action, c.calendar_id, c.event_id, c.provider_event_id, c.attempts
     from public.claim_calendar_outbox_items(1, true, null, '2026-11-09 09:00+01') c $$,
  $$ values ('9c000000-0000-4000-8000-000000000001'::uuid, 'delete'::public.calendar_outbox_action,
             'e2000000-0000-4000-8000-000000000001'::uuid, null::uuid, 'g-paolo-1'::text, 0) $$,
  'the first run takes the oldest due row, with what it needs to send it'
);
select results_eq(
  $$ select c.id from public.claim_calendar_outbox_items(1, true, null, '2026-11-09 09:00+01') c $$,
  $$ values ('9c000000-0000-4000-8000-000000000002'::uuid) $$,
  'a second run at the same time takes the next row, not the one held by the first'
);
select results_eq(
  $$ select c.id from public.claim_calendar_outbox_items(50, true, null, '2026-11-09 09:00+01') c order by c.id $$,
  $$ values ('9c000000-0000-4000-8000-000000000004'::uuid) $$,
  'a third run takes only what is left: not the held rows, not the row due tomorrow, not the real provider'
);
select is_empty(
  $$ select 1 from public.claim_calendar_outbox_items(50, true, null, '2026-11-09 09:00+01') $$,
  'a fourth run finds nothing to send'
);
select results_eq(
  $$ select c.id from public.claim_calendar_outbox_items(50, false, null, '2026-11-09 09:00+01') c $$,
  $$ values ('9c000000-0000-4000-8000-000000000005'::uuid) $$,
  'the run of production takes only the rows of the real providers'
);
reset role;
select ok(
  (select bool_and(o.claimed_until = now() + interval '5 minutes')
   from public.calendar_outbox o
   where o.id <> '9c000000-0000-4000-8000-000000000003')
  and (select o.claimed_until is null from public.calendar_outbox o where o.id = '9c000000-0000-4000-8000-000000000003'),
  'every claimed row is held for 5 minutes from now; the row not due is still free'
);

-- ---------------------------------------------------------------------------
-- A run that dies: the claim expires and the row is free again
-- ---------------------------------------------------------------------------
update public.calendar_outbox
set claimed_until = now() - interval '1 second'
where id = '9c000000-0000-4000-8000-000000000001';
set local role service_role;
select results_eq(
  $$ select c.id, c.attempts from public.claim_calendar_outbox_items(50, true, null, '2026-11-09 09:00+01') c $$,
  $$ values ('9c000000-0000-4000-8000-000000000001'::uuid, 0) $$,
  'the claim of the run that died has expired: the row is taken again'
);
select is_empty(
  $$ select 1 from public.claim_calendar_outbox_items(50, true, null, '2026-11-09 09:00+01') $$,
  'and held again by the new run'
);
select results_eq(
  $$ select c.id from public.claim_calendar_outbox_items(50, true, null, '2026-11-10 12:00+01') c $$,
  $$ values ('9c000000-0000-4000-8000-000000000003'::uuid) $$,
  'an instant in the future makes the row of tomorrow due, but never frees a held row'
);

-- ---------------------------------------------------------------------------
-- A failure frees the row for the next attempt
-- ---------------------------------------------------------------------------
select lives_ok(
  $$ select public.fail_calendar_outbox_item('9c000000-0000-4000-8000-000000000001', '2026-11-09 08:30+01') $$,
  'the provider did not answer: tried again from 8:30'
);
reset role;
select results_eq(
  $$ select o.attempts, o.next_attempt_at, o.claimed_until from public.calendar_outbox o
     where o.id = '9c000000-0000-4000-8000-000000000001' $$,
  $$ values (1, '2026-11-09 08:30+01'::timestamptz, null::timestamptz) $$,
  'one failed attempt, the next one at 8:30, the row free'
);
set local role service_role;
select results_eq(
  $$ select c.id, c.attempts from public.claim_calendar_outbox_items(50, true, null, '2026-11-09 09:00+01') c $$,
  $$ values ('9c000000-0000-4000-8000-000000000001'::uuid, 1) $$,
  'the next run takes it again'
);

-- ---------------------------------------------------------------------------
-- The fake service of the tests: only the rows of one adult (#364)
-- ---------------------------------------------------------------------------
reset role;
update public.calendar_outbox set claimed_until = null;
set local role service_role;
select results_eq(
  $$ select c.id from public.claim_calendar_outbox_items(50, true, 'aaaaaaaa-0000-4000-8000-000000000001', '2026-11-09 09:00+01') c $$,
  $$ values ('9c000000-0000-4000-8000-000000000004'::uuid) $$,
  'the run for Marco takes only the rows of Marco'
);
select results_eq(
  $$ select c.id from public.claim_calendar_outbox_items(50, true, 'bbbbbbbb-0000-4000-8000-000000000002', '2026-11-09 09:00+01') c order by c.id $$,
  $$ values ('9c000000-0000-4000-8000-000000000001'::uuid), ('9c000000-0000-4000-8000-000000000002'::uuid) $$,
  'the run for Paolo takes only the due rows of Paolo'
);
select is_empty(
  $$ select 1 from public.claim_calendar_outbox_items(50, false, 'cccccccc-0000-4000-8000-000000000001', '2026-11-09 09:00+01') $$,
  'Chiara has no household: nothing'
);

-- ---------------------------------------------------------------------------
-- Invalid calls
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ select * from public.claim_calendar_outbox_items(0, true) $$,
  '22023', null, 'a limit of 0 is refused'
);
select throws_ok(
  $$ select * from public.claim_calendar_outbox_items(51, true) $$,
  '22023', null, 'at most 50 rows per claim'
);
select throws_ok(
  $$ select * from public.claim_calendar_outbox_items(10, null) $$,
  '22023', null, 'the provider (fake or real) is required'
);
select throws_ok(
  $$ select * from public.claim_calendar_outbox_items(10, true, null, 'infinity') $$,
  '22023', null, 'the instant must be finite'
);
set local request.method to 'GET';
select throws_ok(
  $$ select * from public.claim_calendar_outbox_items(10, true) $$,
  'P0001', 'use POST', 'only POST through the Data API'
);
set local request.method to 'POST';

-- ---------------------------------------------------------------------------
-- A change of the event while its row is being sent is never lost
-- ---------------------------------------------------------------------------
-- The rows queued by the app are due from now(): these runs use now() as instant.
reset role;
delete from public.calendar_outbox;
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok(
  $$ select public.create_event('Corsa', '2027-03-17 07:00+01', '2027-03-17 08:00+01', 'busy', array[]::uuid[]) $$,
  'Paolo creates «Corsa»'
);
select lives_ok(
  $$ select public.set_event_also_on((select e.id from public.events e where e.title = 'Corsa'), true) $$,
  'and sends it «Anche su Google»'
);
reset role;
set local role service_role;
set local request.jwt.claims to '{"role":"service_role"}';
select results_eq(
  $$ select c.action, c.provider_event_id from public.claim_calendar_outbox_items(50, true, 'bbbbbbbb-0000-4000-8000-000000000002', now()) c $$,
  $$ values ('create'::public.calendar_outbox_action, null::text) $$,
  'a run takes the «create» of «Corsa»'
);
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok(
  $$ update public.events set title = 'Corsa al parco' where title = 'Corsa' $$,
  'meanwhile Paolo changes the title'
);
reset role;
select results_eq(
  $$ select o.action, o.changed_while_claimed from public.calendar_outbox o $$,
  $$ values ('create'::public.calendar_outbox_action, true) $$,
  'the row being sent is marked (no second row)'
);
set local role service_role;
select is(
  public.complete_calendar_outbox_item((select o.id from public.calendar_outbox o), 'g-corsa', 'etag-1'),
  true,
  'the copy is created at the provider (with the old title) and kept'
);
reset role;
select results_eq(
  $$ select o.action, o.provider_event_id, o.attempts, o.claimed_until, o.changed_while_claimed,
            o.next_attempt_at <= now()
     from public.calendar_outbox o $$,
  $$ values ('update'::public.calendar_outbox_action, 'g-corsa'::text, 0, null::timestamptz, false, true) $$,
  'an «update» of the copy waits, free and due now: the new title will be sent'
);
select results_eq(
  $$ select l.provider_event_id, l.provider_version from public.event_external_links l
     join public.events e on e.id = l.event_id where e.title = 'Corsa al parco' and l.origin = 'sent' $$,
  $$ values ('g-corsa'::text, 'etag-1'::text) $$,
  'the event is linked to its copy'
);
set local role service_role;
select results_eq(
  $$ select c.action, c.provider_event_id from public.claim_calendar_outbox_items(50, true, null, now()) c $$,
  $$ values ('update'::public.calendar_outbox_action, 'g-corsa'::text) $$,
  'a run takes the «update»'
);
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok(
  $$ update public.events set location = 'Parco Sempione' where title = 'Corsa al parco' $$,
  'meanwhile Paolo adds the place'
);
reset role;
set local role service_role;
set local request.jwt.claims to '{"role":"service_role"}';
select is(
  public.complete_calendar_outbox_item((select o.id from public.calendar_outbox o), null, 'etag-2'),
  true,
  'the update is done at the provider (maybe without the place)'
);
reset role;
select results_eq(
  $$ select o.action, o.provider_event_id, o.claimed_until, o.changed_while_claimed from public.calendar_outbox o $$,
  $$ values ('update'::public.calendar_outbox_action, 'g-corsa'::text, null::timestamptz, false) $$,
  'the «update» stays, free: the place will be sent too'
);
set local role service_role;
select lives_ok(
  $$ select public.complete_calendar_outbox_item(c.id, null, 'etag-3')
     from public.claim_calendar_outbox_items(50, true, null, now()) c $$,
  'a run takes the «update» again and sends it, with nothing changed meanwhile'
);
reset role;
select is_empty($$ select 1 from public.calendar_outbox $$, 'then the outbox is empty');
select is(
  (select l.provider_version from public.event_external_links l
   join public.events e on e.id = l.event_id where e.title = 'Corsa al parco' and l.origin = 'sent'),
  'etag-3',
  'the link keeps the last version'
);
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok(
  $$ update public.events set title = 'Corsa del mattino' where title = 'Corsa al parco' $$,
  'later Paolo changes the title again, while no run is sending'
);
reset role;
select results_eq(
  $$ select o.action, o.changed_while_claimed from public.calendar_outbox o $$,
  $$ values ('update'::public.calendar_outbox_action, false) $$,
  'one «update» waits, not marked (as before #373)'
);

select * from finish();
rollback;
