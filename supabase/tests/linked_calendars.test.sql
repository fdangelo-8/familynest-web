-- Linked calendars (issue #266, for #34 parts 1 and 2, #35, #37): schema, privileges, the
-- credentials never readable by the app, isolation between adults of the same household
-- (administrator included) and between households, anon, the functions of the
-- synchronisation service (limits, rules of the imported events, no duplicates), the
-- imported events read only, the choices of a calendar and their effects, «Dove vanno i
-- nuovi impegni», «Anche su», the rows of the calendar (source only for the author,
-- «conta per Liberi insieme»), the count of Onboarding · Pronto, the revocation queue in
-- every case of deletion and the job every 15 minutes.
-- Seed ids: A = Marco (Casa D'Angelo, admin, member a1…01), B = Giulia (Casa Bianchi, admin,
-- b1…01), B2 = Paolo (Casa Bianchi, not admin, b1…02), C = Chiara (no household).
-- Seed: Paolo has the fake Google account e1…01 with «Personale» e2…01 (main, switched on,
-- «Occupato», «Dove vanno i nuovi impegni») and «Festività in Italia» e2…02 (read only,
-- switched off). No imported event.
-- The instant of the synchronisations is fixed: Monday 9 November 2026, 9:00 in Rome.
begin;
create extension if not exists pgtap with schema extensions;

select plan(226);

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------
select has_table('public', 'calendar_accounts', 'calendar_accounts exists');
select has_table('public', 'external_calendars', 'external_calendars exists');
select has_table('public', 'event_external_links', 'event_external_links exists');
select has_table('public', 'calendar_credential_revocations', 'calendar_credential_revocations exists');
select has_table('public', 'calendar_outbox', 'calendar_outbox exists');
select ok(
  (select bool_and(c.relrowsecurity) from pg_class c
   where c.oid in ('public.calendar_accounts'::regclass, 'public.external_calendars'::regclass,
                   'public.event_external_links'::regclass, 'public.calendar_credential_revocations'::regclass,
                   'public.calendar_outbox'::regclass)),
  'RLS enabled on the five tables'
);
select columns_are(
  'public', 'calendar_accounts',
  array['id', 'household_id', 'member_id', 'member_kind', 'provider', 'provider_account_id', 'email', 'status',
        'failing_since', 'last_synced_at', 'connected_at', 'is_fake', 'credentials_ciphertext', 'created_at', 'updated_at'],
  'calendar_accounts has exactly the planned columns (email, state, encrypted credentials; no name, no token in clear)'
);
select columns_are(
  'public', 'external_calendars',
  array['id', 'household_id', 'member_id', 'account_id', 'provider_calendar_id', 'name', 'is_primary', 'is_read_only',
        'is_enabled', 'direction', 'visibility', 'counts_for_free_time', 'weekdays_only', 'is_new_events_target',
        'sync_cursor', 'last_synced_at', 'failing_since', 'created_at', 'updated_at'],
  'external_calendars has exactly the planned columns'
);
select columns_are(
  'public', 'event_external_links',
  array['id', 'household_id', 'event_id', 'calendar_id', 'origin', 'provider_event_id', 'occurrence_key',
        'provider_version', 'is_private_on_provider', 'is_busy_on_provider', 'visibility_overridden',
        'created_at', 'updated_at'],
  'event_external_links has exactly the planned columns (no description, participant or organiser)'
);
select columns_are(
  'public', 'calendar_credential_revocations',
  array['id', 'provider', 'is_fake', 'credentials_ciphertext', 'created_at'],
  'the revocation queue holds only provider and credentials (no person, no email, no household)'
);
select columns_are(
  'public', 'calendar_outbox',
  array['id', 'household_id', 'calendar_id', 'action', 'event_id', 'provider_event_id', 'attempts',
        'next_attempt_at', 'created_at', 'claimed_until', 'claim_token', 'changed_while_claimed'],
  'the outbox holds no text of the events (claim columns of #373 included)'
);
select enum_has_labels('public', 'calendar_provider', array['google', 'outlook'], 'providers: Google and Outlook (iCloud waits for #36)');
select enum_has_labels('public', 'calendar_account_status', array['active', 'reconnect', 'temporary_error'], 'calendar_account_status labels');
select enum_has_labels('public', 'calendar_direction', array['two_way', 'incoming'], 'calendar_direction labels');
select enum_has_labels('public', 'external_event_origin', array['imported', 'sent'], 'external_event_origin labels');
select enum_has_labels('public', 'calendar_outbox_action', array['create', 'update', 'delete'], 'calendar_outbox_action labels');
select col_default_is('public', 'external_calendars', 'visibility', 'busy'::public.event_visibility, 'F5: every new calendar starts «Occupato»');
select col_default_is('public', 'external_calendars', 'counts_for_free_time', 'true', 'a new calendar counts for «Liberi insieme»');
select col_default_is('public', 'external_calendars', 'weekdays_only', 'false', 'a new calendar keeps every day');
select col_default_is('public', 'external_calendars', 'is_enabled', 'false', 'a new calendar is switched off unless it is the main one');
select fk_ok(
  'public', 'calendar_accounts', array['member_id', 'household_id', 'member_kind'],
  'public', 'household_members', array['id', 'household_id', 'kind'],
  'an account belongs to an adult of the same household'
);
select fk_ok(
  'public', 'external_calendars', array['account_id', 'household_id', 'member_id'],
  'public', 'calendar_accounts', array['id', 'household_id', 'member_id'],
  'a calendar belongs to an account of the same adult and household'
);
select fk_ok(
  'public', 'event_external_links', array['event_id', 'household_id'],
  'public', 'events', array['id', 'household_id'],
  'a link points to an event of the same household'
);
select fk_ok(
  'public', 'event_external_links', array['calendar_id', 'household_id'],
  'public', 'external_calendars', array['id', 'household_id'],
  'a link points to a calendar of the same household'
);
select has_index('public', 'calendar_accounts', 'calendar_accounts_household_id_idx', 'index on calendar_accounts.household_id');
select has_index('public', 'external_calendars', 'external_calendars_member_id_idx', 'index on external_calendars.member_id');
select has_index('public', 'external_calendars', 'external_calendars_household_id_idx', 'index on external_calendars.household_id');
select has_index('public', 'event_external_links', 'event_external_links_household_id_idx', 'index on event_external_links.household_id');
select has_index('public', 'calendar_outbox', 'calendar_outbox_calendar_id_idx', 'index on calendar_outbox.calendar_id');
select has_index('public', 'calendar_outbox', 'calendar_outbox_household_id_idx', 'index on calendar_outbox.household_id');
select ok(
  not exists (
    select 1 from pg_publication_tables p
    where p.pubname = 'supabase_realtime'
      and p.tablename in ('calendar_accounts', 'external_calendars', 'event_external_links',
                          'calendar_credential_revocations', 'calendar_outbox')
  ),
  'no table of the linked calendars is sent in real time'
);
select ok(exists (select 1 from pg_extension e where e.extname = 'pg_net'), 'pg_net is installed');
select results_eq(
  $$ select j.schedule, j.command from cron.job j where j.jobname = 'calendar-jobs' $$,
  $$ values ('*/15 * * * *'::text, 'select private.run_scheduled_calendar_jobs();'::text) $$,
  'F1 = B: the job of the linked calendars runs every 15 minutes'
);

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
select ok(
  not has_table_privilege('anon', 'public.calendar_accounts', 'select, insert, update, delete')
  and not has_table_privilege('anon', 'public.external_calendars', 'select, insert, update, delete')
  and not has_table_privilege('anon', 'public.event_external_links', 'select, insert, update, delete')
  and not has_table_privilege('anon', 'public.calendar_credential_revocations', 'select, insert, update, delete')
  and not has_table_privilege('anon', 'public.calendar_outbox', 'select, insert, update, delete')
  and not has_any_column_privilege('anon', 'public.calendar_accounts', 'select')
  and not has_any_column_privilege('anon', 'public.external_calendars', 'select'),
  'anon has no privilege on the linked calendars'
);
select ok(
  not has_column_privilege('authenticated', 'public.calendar_accounts', 'credentials_ciphertext', 'select')
  and not has_column_privilege('authenticated', 'public.calendar_accounts', 'credentials_ciphertext', 'insert')
  and not has_column_privilege('authenticated', 'public.calendar_accounts', 'credentials_ciphertext', 'update')
  and not has_column_privilege('anon', 'public.calendar_accounts', 'credentials_ciphertext', 'select'),
  'CA-30: the credentials are never readable nor writable by the API roles'
);
select ok(
  has_column_privilege('authenticated', 'public.calendar_accounts', 'email', 'select')
  and has_column_privilege('authenticated', 'public.calendar_accounts', 'provider', 'select')
  and has_column_privilege('authenticated', 'public.calendar_accounts', 'status', 'select')
  and not has_column_privilege('authenticated', 'public.calendar_accounts', 'provider_account_id', 'select')
  and not has_any_column_privilege('authenticated', 'public.calendar_accounts', 'insert')
  and not has_any_column_privilege('authenticated', 'public.calendar_accounts', 'update')
  and has_table_privilege('authenticated', 'public.calendar_accounts', 'delete'),
  'the app reads its accounts (not the id at the provider), never writes them, and deletes them («Scollega»)'
);
select ok(
  has_column_privilege('authenticated', 'public.external_calendars', 'name', 'select')
  and not has_column_privilege('authenticated', 'public.external_calendars', 'sync_cursor', 'select')
  and not has_column_privilege('authenticated', 'public.external_calendars', 'provider_calendar_id', 'select')
  and not has_any_column_privilege('authenticated', 'public.external_calendars', 'insert')
  and not has_table_privilege('authenticated', 'public.external_calendars', 'delete'),
  'the app reads its calendars (not the position at the provider), never inserts nor deletes them'
);
select ok(
  has_column_privilege('authenticated', 'public.external_calendars', 'is_enabled', 'update')
  and has_column_privilege('authenticated', 'public.external_calendars', 'direction', 'update')
  and has_column_privilege('authenticated', 'public.external_calendars', 'visibility', 'update')
  and has_column_privilege('authenticated', 'public.external_calendars', 'counts_for_free_time', 'update')
  and has_column_privilege('authenticated', 'public.external_calendars', 'weekdays_only', 'update')
  and not has_column_privilege('authenticated', 'public.external_calendars', 'name', 'update')
  and not has_column_privilege('authenticated', 'public.external_calendars', 'is_read_only', 'update')
  and not has_column_privilege('authenticated', 'public.external_calendars', 'is_primary', 'update')
  and not has_column_privilege('authenticated', 'public.external_calendars', 'is_new_events_target', 'update')
  and not has_column_privilege('authenticated', 'public.external_calendars', 'sync_cursor', 'update')
  and not has_column_privilege('authenticated', 'public.external_calendars', 'account_id', 'update')
  and not has_column_privilege('authenticated', 'public.external_calendars', 'member_id', 'update'),
  'the app changes only the five choices of a calendar'
);
select ok(
  not has_table_privilege('authenticated', 'public.event_external_links', 'select, insert, update, delete')
  and not has_any_column_privilege('authenticated', 'public.event_external_links', 'select')
  and not has_table_privilege('authenticated', 'public.calendar_outbox', 'select, insert, update, delete')
  and not has_any_column_privilege('authenticated', 'public.calendar_outbox', 'select')
  and not has_table_privilege('authenticated', 'public.calendar_credential_revocations', 'select, insert, update, delete')
  and not has_any_column_privilege('authenticated', 'public.calendar_credential_revocations', 'select'),
  'links, outbox and revocation queue: no privilege for the app'
);
select ok(
  has_table_privilege('service_role', 'public.calendar_credential_revocations', 'select')
  and has_table_privilege('service_role', 'public.calendar_credential_revocations', 'delete')
  and has_table_privilege('service_role', 'public.calendar_outbox', 'select')
  and has_table_privilege('service_role', 'public.calendar_accounts', 'select'),
  'the synchronisation service (service_role) reads the queues and the credentials'
);
select ok(
  not has_function_privilege('authenticated', 'public.save_calendar_account(uuid, public.calendar_provider, text, text, text, boolean)', 'execute')
  and not has_function_privilege('authenticated', 'public.save_external_calendars(uuid, jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'public.sync_external_calendar_events(uuid, jsonb, boolean, text, timestamptz)', 'execute')
  and not has_function_privilege('authenticated', 'public.record_calendar_sync_result(uuid, public.calendar_sync_outcome, timestamptz)', 'execute')
  and not has_function_privilege('authenticated', 'public.mark_external_calendar_failing(uuid, timestamptz)', 'execute')
  and not has_function_privilege('authenticated', 'public.complete_calendar_outbox_item(uuid, text, text, uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.fail_calendar_outbox_item(uuid, timestamptz, uuid)', 'execute')
  and not has_function_privilege('anon', 'public.save_calendar_account(uuid, public.calendar_provider, text, text, text, boolean)', 'execute')
  and not has_function_privilege('anon', 'public.sync_external_calendar_events(uuid, jsonb, boolean, text, timestamptz)', 'execute'),
  'the functions of the synchronisation service are not executable by the app nor by anon'
);
select ok(
  has_function_privilege('service_role', 'public.save_calendar_account(uuid, public.calendar_provider, text, text, text, boolean)', 'execute')
  and has_function_privilege('service_role', 'public.save_external_calendars(uuid, jsonb)', 'execute')
  and has_function_privilege('service_role', 'public.sync_external_calendar_events(uuid, jsonb, boolean, text, timestamptz)', 'execute')
  and has_function_privilege('service_role', 'public.record_calendar_sync_result(uuid, public.calendar_sync_outcome, timestamptz)', 'execute')
  and has_function_privilege('service_role', 'public.complete_calendar_outbox_item(uuid, text, text, uuid)', 'execute'),
  'the synchronisation service executes them'
);
select ok(
  has_function_privilege('authenticated', 'public.set_new_events_calendar(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.set_event_also_on(uuid, boolean)', 'execute')
  and has_function_privilege('authenticated', 'public.get_event_calendar_link(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.count_imported_events(timestamptz)', 'execute')
  and not has_function_privilege('anon', 'public.set_new_events_calendar(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.set_event_also_on(uuid, boolean)', 'execute')
  and not has_function_privilege('anon', 'public.get_event_calendar_link(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.count_imported_events(timestamptz)', 'execute')
  and not has_function_privilege('anon', 'public.list_household_events_with_source(timestamptz, timestamptz)', 'execute')
  and has_function_privilege('authenticated', 'public.list_household_events_with_source(timestamptz, timestamptz)', 'execute')
  and not has_function_privilege('anon', 'public.search_household(text, uuid, date, date, public.search_result_kind[])', 'execute')
  and has_function_privilege('authenticated', 'public.search_household(text, uuid, date, date, public.search_result_kind[])', 'execute'),
  'the page functions: signed-in users only (also the calendar and the search, created again)'
);
select ok(
  not has_function_privilege('authenticated', 'private.run_scheduled_calendar_jobs(timestamptz)', 'execute')
  and not has_function_privilege('authenticated', 'private.external_text(text, text)', 'execute')
  and not has_function_privilege('authenticated', 'private.queue_sent_event_update(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'private.calendar_accounts_after_delete()', 'execute')
  and not has_function_privilege('authenticated', 'private.household_event_rows_for_member(uuid, timestamptz, timestamptz)', 'execute'),
  'the job, the helpers and the trigger functions are not executable by the app'
);

-- ---------------------------------------------------------------------------
-- Seed: Paolo reads his own account and calendars, nobody else does (CA-28, CA-29)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.method to 'POST';
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';

select results_eq(
  $$ select a.id, a.provider, a.email, a.status, a.is_fake from public.calendar_accounts a $$,
  $$ values ('e1000000-0000-4000-8000-000000000001'::uuid, 'google'::public.calendar_provider,
             'paolo.finto@example.test'::text, 'active'::public.calendar_account_status, true) $$,
  'Paolo reads his account (provider, email, state)'
);
select results_eq(
  $$ select c.name, c.is_primary, c.is_read_only, c.is_enabled, c.direction, c.visibility, c.is_new_events_target
     from public.external_calendars c order by c.name $$,
  $$ values ('Festività in Italia'::text, false, true, false, 'incoming'::public.calendar_direction, 'busy'::public.event_visibility, false),
            ('Personale'::text, true, false, true, 'two_way'::public.calendar_direction, 'busy'::public.event_visibility, true) $$,
  'Paolo reads his calendars and their choices'
);
select throws_ok(
  $$ select a.credentials_ciphertext from public.calendar_accounts a $$,
  '42501', null,
  'CA-30: with his own session Paolo cannot read the column of the credentials'
);
select throws_ok(
  $$ select * from public.calendar_accounts $$,
  '42501', null,
  'CA-30: «select *» on the accounts is refused too'
);
select throws_ok($$ select c.sync_cursor from public.external_calendars c $$, '42501', null, 'the app cannot read the position at the provider');
select throws_ok($$ select 1 from public.event_external_links $$, '42501', null, 'the app cannot read the links');
select throws_ok($$ select 1 from public.calendar_outbox $$, '42501', null, 'the app cannot read the outbox');
select throws_ok($$ select 1 from public.calendar_credential_revocations $$, '42501', null, 'the app cannot read the revocation queue');
select throws_ok(
  $$ insert into public.calendar_accounts (household_id, member_id, provider, provider_account_id, email, credentials_ciphertext)
     values ('22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000002', 'google', 'x',
             'x@example.test', 'v1:test.placeholder.not.a.credential.000000') $$,
  '42501', null,
  'the app cannot insert an account'
);
select throws_ok(
  $$ update public.calendar_accounts set status = 'active' $$,
  '42501', null,
  'the app cannot change the state of an account'
);
select throws_ok(
  $$ update public.external_calendars set name = 'Altro' $$,
  '42501', null,
  'the app cannot rename a calendar'
);
select throws_ok(
  $$ update public.external_calendars set is_new_events_target = false $$,
  '42501', null,
  'the app cannot set «Dove vanno i nuovi impegni» directly'
);
select throws_ok(
  $$ update public.external_calendars set direction = 'two_way' where id = 'e2000000-0000-4000-8000-000000000002' $$,
  '23514', null,
  'CA-15: a read-only calendar cannot be «Entrata e uscita»'
);

-- Only POST through the Data API (LEZIONI #112): every other method is refused before
-- anything is read or written.
set local request.method to 'GET';
select throws_ok($$ select public.set_new_events_calendar(null) $$, 'P0001', 'use POST', 'set_new_events_calendar: GET refused');
select throws_ok($$ select public.set_event_also_on(gen_random_uuid(), true) $$, 'P0001', 'use POST', 'set_event_also_on: GET refused');
set local request.method to 'HEAD';
select throws_ok($$ select public.set_new_events_calendar(null) $$, 'P0001', 'use POST', 'set_new_events_calendar: HEAD refused');
select throws_ok($$ select public.set_event_also_on(gen_random_uuid(), true) $$, 'P0001', 'use POST', 'set_event_also_on: HEAD refused');
set local request.method to 'PUT';
select throws_ok($$ select public.set_new_events_calendar(null) $$, 'P0001', 'use POST', 'set_new_events_calendar: PUT refused');
select throws_ok($$ select public.set_event_also_on(gen_random_uuid(), true) $$, 'P0001', 'use POST', 'set_event_also_on: PUT refused');
set local request.method to 'POST';
select results_eq(
  $$ select c.name from public.external_calendars c where c.is_new_events_target $$,
  $$ values ('Personale'::text) $$,
  'the refused calls changed nothing («Personale» is still «Dove vanno i nuovi impegni»)'
);

-- Giulia: same household, administrator.
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select is_empty($$ select 1 from public.calendar_accounts $$, 'CA-28: Giulia (administrator) reads no account of Paolo');
select is_empty($$ select 1 from public.external_calendars $$, 'CA-28: Giulia reads no calendar of Paolo');
select is_empty(
  $$ update public.external_calendars set visibility = 'household' returning id $$,
  'Giulia changes no calendar of Paolo (0 rows)'
);
select is_empty(
  $$ delete from public.calendar_accounts returning id $$,
  'Giulia deletes no account of Paolo (0 rows)'
);
select throws_ok(
  $$ select public.set_new_events_calendar('e2000000-0000-4000-8000-000000000001') $$,
  'P0002', 'calendar not found',
  'Giulia cannot choose a calendar of Paolo for her new events'
);

-- Marco: another household.
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select is_empty($$ select 1 from public.calendar_accounts $$, 'CA-29: Marco reads no account of Casa Bianchi');
select is_empty($$ select 1 from public.external_calendars $$, 'CA-29: Marco reads no calendar of Casa Bianchi');
select is_empty(
  $$ update public.external_calendars set is_enabled = false returning id $$,
  'Marco changes no calendar of Casa Bianchi'
);
select is_empty($$ delete from public.calendar_accounts returning id $$, 'Marco deletes no account of Casa Bianchi');

-- Chiara: no household.
set local request.jwt.claims to '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}';
select is_empty($$ select 1 from public.calendar_accounts $$, 'Chiara (no household) reads no account');
select is_empty($$ select * from public.count_imported_events(now()) $$, 'Chiara has nothing to count');

-- anon.
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok($$ select 1 from public.calendar_accounts $$, '42501', null, 'anon cannot read the accounts');
select throws_ok($$ select 1 from public.external_calendars $$, '42501', null, 'anon cannot read the calendars');
select throws_ok($$ select public.count_imported_events(now()) $$, '42501', null, 'anon cannot count imported events');

-- ---------------------------------------------------------------------------
-- The synchronisation service: accounts (save_calendar_account)
-- ---------------------------------------------------------------------------
set local role service_role;
set local request.jwt.claims to '{"role":"service_role"}';

select results_eq(
  $$ select s.is_new from public.save_calendar_account(
       'aaaaaaaa-0000-4000-8000-000000000001', 'google', 'fake-marco-1', ' marco.finto@example.test ',
       'v1:test.placeholder.not.a.credential.000001', true) s $$,
  $$ values (true) $$,
  'Marco links a fake Google account: a new account'
);
select results_eq(
  $$ select s.is_new from public.save_calendar_account(
       'aaaaaaaa-0000-4000-8000-000000000001', 'google', 'fake-marco-1', 'marco.altro@example.test',
       'v1:test.placeholder.not.a.credential.000002', true) s $$,
  $$ values (false) $$,
  'CA-9, CA-41: the same account linked again is not a new account'
);
select results_eq(
  $$ select count(*)::integer, min(a.email), min(a.credentials_ciphertext), min(a.member_id::text)
     from public.calendar_accounts a where a.household_id = '11111111-1111-4111-8111-111111111111' $$,
  $$ values (1, 'marco.altro@example.test'::text, 'v1:test.placeholder.not.a.credential.000002'::text,
             'a1000000-0000-4000-8000-000000000001'::text) $$,
  'still one account of Marco, with the new email and credentials; the adult is set from the Auth id'
);
select throws_ok(
  $$ select * from public.save_calendar_account(
       'aaaaaaaa-0000-4000-8000-000000000001', 'google', 'fake-marco-plain', 'marco@example.test',
       '1//0gPlainRefreshTokenThatMustNeverBeStored0000', true) $$,
  '23514', null,
  'CA-30: credentials not in the encrypted format (a plain refresh token) are refused'
);
select throws_ok(
  $$ select * from public.save_calendar_account(
       'cccccccc-0000-4000-8000-000000000001', 'google', 'fake-chiara', 'chiara@example.test',
       'v1:test.placeholder.not.a.credential.000003', true) $$,
  'P0002', 'member not found',
  'an account without household links nothing'
);
select throws_ok(
  $$ select * from public.save_calendar_account(
       null, 'google', 'x', 'x@example.test', 'v1:test.placeholder.not.a.credential.000003', true) $$,
  '22023', null,
  'every argument is required'
);
set local request.method to 'GET';
select throws_ok(
  $$ select * from public.save_calendar_account(
       'aaaaaaaa-0000-4000-8000-000000000001', 'google', 'x', 'x@example.test',
       'v1:test.placeholder.not.a.credential.000003', true) $$,
  'P0001', 'use POST',
  'only POST through the Data API (GET)'
);
set local request.method to 'HEAD';
select throws_ok(
  $$ select * from public.save_calendar_account(
       'aaaaaaaa-0000-4000-8000-000000000001', 'google', 'x', 'x@example.test',
       'v1:test.placeholder.not.a.credential.000003', true) $$,
  'P0001', 'use POST',
  'only POST through the Data API (HEAD)'
);
set local request.method to 'PUT';
select throws_ok(
  $$ select * from public.save_calendar_account(
       'aaaaaaaa-0000-4000-8000-000000000001', 'google', 'x', 'x@example.test',
       'v1:test.placeholder.not.a.credential.000003', true) $$,
  'P0001', 'use POST',
  'only POST through the Data API (PUT)'
);
set local request.method to 'POST';
select results_eq(
  $$ select count(*)::integer from public.calendar_accounts a where a.provider_account_id = 'x' $$,
  $$ values (0) $$,
  'a call refused for its method writes nothing'
);

-- CA-10: at most 5 accounts per adult (4 more, then the sixth is refused).
select lives_ok(
  $$ select * from public.save_calendar_account('aaaaaaaa-0000-4000-8000-000000000001', 'outlook', 'fake-marco-2',
       'm2@example.test', 'v1:test.placeholder.not.a.credential.000004', true);
     select * from public.save_calendar_account('aaaaaaaa-0000-4000-8000-000000000001', 'outlook', 'fake-marco-3',
       'm3@example.test', 'v1:test.placeholder.not.a.credential.000005', true);
     select * from public.save_calendar_account('aaaaaaaa-0000-4000-8000-000000000001', 'google', 'fake-marco-4',
       'm4@example.test', 'v1:test.placeholder.not.a.credential.000006', true);
     select * from public.save_calendar_account('aaaaaaaa-0000-4000-8000-000000000001', 'google', 'fake-marco-5',
       'm5@example.test', 'v1:test.placeholder.not.a.credential.000007', true) $$,
  'Marco links four more accounts (five in all)'
);
select throws_ok(
  $$ select * from public.save_calendar_account('aaaaaaaa-0000-4000-8000-000000000001', 'google', 'fake-marco-6',
       'm6@example.test', 'v1:test.placeholder.not.a.credential.000008', true) $$,
  'FN008', 'calendar account limit reached',
  'CA-10: the sixth account is refused'
);
select results_eq(
  $$ select s.is_new from public.save_calendar_account('aaaaaaaa-0000-4000-8000-000000000001', 'google', 'fake-marco-5',
       'm5@example.test', 'v1:test.placeholder.not.a.credential.000009', true) s $$,
  $$ values (false) $$,
  'with five accounts, linking one of them again still works («Ricollega»)'
);
reset role;
select throws_ok(
  $$ insert into public.calendar_accounts (household_id, member_id, provider, provider_account_id, email, credentials_ciphertext)
     values ('11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001', 'google', 'fake-marco-7',
             'm7@example.test', 'v1:test.placeholder.not.a.credential.000010') $$,
  'FN008', 'calendar account limit reached',
  'the limit holds for every role (direct insert of the database owner)'
);
select ok(
  exists (
    select 1
    from pg_locks l
    where l.locktype = 'advisory'
      and l.pid = pg_backend_pid()
      and l.granted
      and ((l.classid::bigint << 32) | l.objid::bigint)
          = hashtextextended('public.calendar_accounts:a1000000-0000-4000-8000-000000000001', 0)
  ),
  'the limit takes the lock of the adult before counting: concurrent requests are serialised (LEZIONI #192)'
);
select throws_ok(
  $$ insert into public.calendar_accounts (household_id, member_id, provider, provider_account_id, email, credentials_ciphertext)
     values ('11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000002', 'google', 'fake-laura',
             'laura@example.test', 'v1:test.placeholder.not.a.credential.000011') $$,
  '23514', 'only adults with an account link calendars',
  'an adult without account (Laura) links nothing'
);
select throws_ok(
  $$ insert into public.calendar_accounts (household_id, member_id, member_kind, provider, provider_account_id, email, credentials_ciphertext)
     values ('11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000003', 'child', 'google', 'fake-sofia',
             'sofia@example.test', 'v1:test.placeholder.not.a.credential.000012') $$,
  '23514', null,
  'a child never has an account'
);
select throws_ok(
  $$ insert into public.calendar_accounts (household_id, member_id, provider, provider_account_id, email, credentials_ciphertext)
     values ('22222222-2222-4222-8222-222222222222', 'a1000000-0000-4000-8000-000000000001', 'google', 'fake-cross',
             'cross@example.test', 'v1:test.placeholder.not.a.credential.000013') $$,
  '23514', 'only adults with an account link calendars',
  'an account never points to a member of another household (refused before the foreign key)'
);

-- Four of Marco's accounts go (for the next tests: one fake Google account left).
delete from public.calendar_accounts a
where a.member_id = 'a1000000-0000-4000-8000-000000000001'
  and a.provider_account_id <> 'fake-marco-1';
delete from public.calendar_credential_revocations;

-- ---------------------------------------------------------------------------
-- Calendars of an account (save_external_calendars), the 50 limit
-- ---------------------------------------------------------------------------
do $$
begin
  perform set_config(
    'test.marco_account',
    (select a.id::text from public.calendar_accounts a where a.provider_account_id = 'fake-marco-1'),
    true
  );
end;
$$;
set local role service_role;
set local request.jwt.claims to '{"role":"service_role"}';

select is(
  public.save_external_calendars(
    current_setting('test.marco_account')::uuid,
    '[{"id":"cal-tennis","name":"Tennis","is_primary":false,"is_read_only":false},
      {"id":"cal-feste","name":"Festività  in   Italia","is_primary":false,"is_read_only":true},
      {"id":"cal-pers","name":"Personale","is_primary":true,"is_read_only":false}]'::jsonb
  ),
  3,
  'CA-5: the fake standard account has three calendars'
);
reset role;
select results_eq(
  $$ select c.name, c.is_enabled, c.direction, c.visibility, c.counts_for_free_time, c.weekdays_only, c.is_new_events_target
     from public.external_calendars c where c.account_id = current_setting('test.marco_account')::uuid
     order by c.is_primary desc, lower(c.name) $$,
  $$ values
       ('Personale'::text, true, 'two_way'::public.calendar_direction, 'busy'::public.event_visibility, true, false, true),
       ('Festività in Italia'::text, false, 'incoming'::public.calendar_direction, 'busy'::public.event_visibility, true, false, false),
       ('Tennis'::text, false, 'two_way'::public.calendar_direction, 'busy'::public.event_visibility, true, false, false) $$,
  'CA-5, CA-16, §6: only the main calendar on, «Entrata e uscita» when writable, «Occupato» (F5), counts for «Liberi insieme»; the main one is «Dove vanno i nuovi impegni»'
);
-- Marco never called set_new_events_calendar(): the lock below was taken by the trigger.
select ok(
  exists (
    select 1
    from pg_locks l
    where l.locktype = 'advisory'
      and l.pid = pg_backend_pid()
      and l.granted
      and ((l.classid::bigint << 32) | l.objid::bigint)
          = hashtextextended('public.external_calendars.target:a1000000-0000-4000-8000-000000000001', 0)
  ),
  'the automatic choice of «Dove vanno i nuovi impegni» takes the same lock per adult as set_new_events_calendar()'
);
select ok(
  exists (
    select 1
    from pg_locks l
    where l.locktype = 'advisory'
      and l.pid = pg_backend_pid()
      and l.granted
      and ((l.classid::bigint << 32) | l.objid::bigint)
          = hashtextextended('public.external_calendars:' || current_setting('test.marco_account'), 0)
  ),
  'the 50 calendars limit takes the lock of the account before counting'
);
set local role service_role;
select is(
  public.save_external_calendars(
    current_setting('test.marco_account')::uuid,
    (select jsonb_agg(jsonb_build_object('id', 'cal-' || g, 'name', 'Calendario ' || lpad(g::text, 2, '0')))
     from generate_series(1, 60) g)
    || '[{"id":"cal-pers","name":"Personale","is_primary":true}]'::jsonb
  ),
  50,
  '§7: at most 50 calendars per account'
);
reset role;
select results_eq(
  $$ select count(*)::integer, count(*) filter (where c.name = 'Personale')::integer,
            count(*) filter (where c.name = 'Tennis')::integer, max(c.name)
     from public.external_calendars c where c.account_id = current_setting('test.marco_account')::uuid $$,
  $$ values (50, 1, 0, 'Personale'::text) $$,
  'the main one stays, then the first in alphabetical order; Tennis, no longer listed, is gone'
);
select throws_ok(
  $$ insert into public.external_calendars (household_id, member_id, account_id, provider_calendar_id, name)
     values ('11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001',
             current_setting('test.marco_account')::uuid, 'cal-extra', 'Extra') $$,
  'FN009', 'external calendar limit reached',
  'the 51st calendar is refused for every role'
);
set local role service_role;
select is(
  public.save_external_calendars(
    current_setting('test.marco_account')::uuid,
    '[{"id":"cal-pers","name":"Personale","is_primary":true}]'::jsonb
  ),
  1,
  'Marco keeps only «Personale»'
);
select throws_ok(
  $$ select public.save_external_calendars(current_setting('test.marco_account')::uuid, '[{"name":"no id"}]'::jsonb) $$,
  '22023', null,
  'a calendar without id is refused'
);
select throws_ok(
  $$ select public.save_external_calendars(gen_random_uuid(), '[]'::jsonb) $$,
  'P0002', 'account not found',
  'an unknown account'
);

-- ---------------------------------------------------------------------------
-- Events of a calendar (sync_external_calendar_events), Personale of Paolo (e2…01)
-- Monday 9 November 2026, 9:00 in Rome.
-- ---------------------------------------------------------------------------
select results_eq(
  $$ select * from public.sync_external_calendar_events(
       'e2000000-0000-4000-8000-000000000001',
       jsonb_build_array(
         jsonb_build_object('id', 'ev-banca', 'version', 'v1', 'title', 'Visita  in banca ', 'location', 'Via Roma 1',
           'starts_at', '2026-11-11 10:00+01', 'ends_at', '2026-11-11 11:00+01', 'status', 'confirmed',
           'description', 'Ordine del giorno riservato', 'attendees', '["capo@example.test"]'),
         jsonb_build_object('id', 'ev-long', 'title', repeat('x', 150), 'starts_at', '2026-11-12 09:00+01', 'ends_at', '2026-11-12 10:00+01'),
         jsonb_build_object('id', 'ev-empty', 'title', '   ', 'starts_at', '2026-11-12 11:00+01', 'ends_at', '2026-11-12 11:00+01'),
         jsonb_build_object('id', 'ev-declined', 'title', 'Cena aziendale', 'starts_at', '2026-11-12 20:00+01',
           'ends_at', '2026-11-12 22:00+01', 'declined', true),
         jsonb_build_object('id', 'ev-cancelled', 'title', 'Annullato', 'starts_at', '2026-11-12 14:00+01',
           'ends_at', '2026-11-12 15:00+01', 'status', 'cancelled'),
         jsonb_build_object('id', 'ev-private', 'title', 'Colloquio', 'starts_at', '2026-11-13 15:00+01',
           'ends_at', '2026-11-13 16:00+01', 'is_private', true),
         jsonb_build_object('id', 'ev-free', 'title', 'Pausa', 'starts_at', '2026-11-13 19:00+01',
           'ends_at', '2026-11-13 20:00+01', 'is_free', true),
         jsonb_build_object('id', 'ev-allday', 'title', 'Ponte', 'all_day', true, 'start_date', '2026-11-19', 'end_date', '2026-11-21'),
         jsonb_build_object('id', 'ev-saturday', 'title', 'Pranzo dai nonni', 'starts_at', '2026-11-14 13:00+01', 'ends_at', '2026-11-14 15:00+01'),
         jsonb_build_object('id', 'ev-corso', 'occurrence_key', '20261116', 'title', 'Corso di inglese',
           'starts_at', '2026-11-16 19:00+01', 'ends_at', '2026-11-16 20:00+01'),
         jsonb_build_object('id', 'ev-corso', 'occurrence_key', '20261123', 'title', 'Corso di inglese',
           'starts_at', '2026-11-23 20:00+01', 'ends_at', '2026-11-23 21:00+01'),
         jsonb_build_object('id', 'ev-old', 'title', 'Vecchio', 'starts_at', '2026-09-01 10:00+02', 'ends_at', '2026-09-01 11:00+02'),
         jsonb_build_object('id', 'ev-far', 'title', 'Lontano', 'starts_at', '2027-12-01 10:00+01', 'ends_at', '2027-12-01 11:00+01')
       ),
       true, 'cursor-1', '2026-11-09 09:00+01') $$,
  $$ values (10, 0) $$,
  'ten events imported (not the declined, the cancelled, the too old and the too far ones)'
);
select results_eq(
  $$ select e.title, e.location, e.starts_at, e.ends_at, e.visibility, e.author_member_id, e.notes, e.escort_member_id,
            e.recurrence, l.is_busy_on_provider, l.is_private_on_provider
     from public.events e join public.event_external_links l on l.event_id = e.id
     where l.calendar_id = 'e2000000-0000-4000-8000-000000000001'
     order by e.starts_at, e.title $$,
  $$ values
       ('Visita in banca'::text, 'Via Roma 1'::text, '2026-11-11 10:00+01'::timestamptz, '2026-11-11 11:00+01'::timestamptz,
        'busy'::public.event_visibility, 'b1000000-0000-4000-8000-000000000002'::uuid, null::text, null::uuid, 'none'::public.event_recurrence, true, false),
       (repeat('x', 99) || '…', null, '2026-11-12 09:00+01', '2026-11-12 10:00+01', 'busy', 'b1000000-0000-4000-8000-000000000002', null, null, 'none', true, false),
       ('Senza titolo', null, '2026-11-12 11:00+01', '2026-11-12 11:15+01', 'busy', 'b1000000-0000-4000-8000-000000000002', null, null, 'none', true, false),
       ('Colloquio', null, '2026-11-13 15:00+01', '2026-11-13 16:00+01', 'busy', 'b1000000-0000-4000-8000-000000000002', null, null, 'none', true, true),
       ('Pausa', null, '2026-11-13 19:00+01', '2026-11-13 20:00+01', 'busy', 'b1000000-0000-4000-8000-000000000002', null, null, 'none', false, false),
       ('Pranzo dai nonni', null, '2026-11-14 13:00+01', '2026-11-14 15:00+01', 'busy', 'b1000000-0000-4000-8000-000000000002', null, null, 'none', true, false),
       ('Corso di inglese', null, '2026-11-16 19:00+01', '2026-11-16 20:00+01', 'busy', 'b1000000-0000-4000-8000-000000000002', null, null, 'none', true, false),
       ('Ponte', null, '2026-11-19 00:00+01', '2026-11-20 00:00+01', 'busy', 'b1000000-0000-4000-8000-000000000002', null, null, 'none', false, false),
       ('Ponte', null, '2026-11-20 00:00+01', '2026-11-21 00:00+01', 'busy', 'b1000000-0000-4000-8000-000000000002', null, null, 'none', false, false),
       ('Corso di inglese', null, '2026-11-23 20:00+01', '2026-11-23 21:00+01', 'busy', 'b1000000-0000-4000-8000-000000000002', null, null, 'none', true, false) $$,
  'CA-34, CA-35, CA-36, CA-38, §7: titles cut to 100 with «…», «Senza titolo», 15 minutes, each occurrence its own event, «tutto il giorno» 0:00–24:00 of each day, author Paolo, no notes nor people, «Occupato» of the calendar'
);
select ok(
  not exists (
    select 1
    from public.events e
    where e.household_id = '22222222-2222-4222-8222-222222222222'
      and (row(e.*))::text ~ '(Ordine del giorno riservato|capo@example\.test|Cena aziendale|Annullato)'
  )
  and not exists (
    select 1
    from public.event_external_links l
    where (row(l.*))::text ~ '(Ordine del giorno riservato|capo@example\.test)'
  ),
  'CA-6 (#35), CA-36: no description, no participant, no declined nor cancelled event stored anywhere'
);
select results_eq(
  $$ select c.sync_cursor, c.last_synced_at from public.external_calendars c where c.id = 'e2000000-0000-4000-8000-000000000001' $$,
  $$ values ('cursor-1'::text, '2026-11-09 09:00+01'::timestamptz) $$,
  'the calendar keeps the position at the provider and the time of the synchronisation'
);
select is_empty(
  $$ select 1 from public.notifications n where n.household_id = '22222222-2222-4222-8222-222222222222' $$,
  '§7: the synchronisation notifies nobody'
);

-- Paolo sees them in full, with the source; Giulia only «Occupato», without any source.
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select results_eq(
  $$ select r.title, r.is_masked, r.source_provider, r.is_imported, r.counts_for_free_time
     from public.list_household_events_with_source('2026-11-11 00:00+01', '2026-11-14 00:00+01') r order by r.starts_at $$,
  $$ values ('Visita in banca'::text, false, 'google'::public.calendar_provider, true, true),
            (repeat('x', 99) || '…', false, 'google', true, true),
            ('Senza titolo', false, 'google', true, true),
            ('Colloquio', false, 'google', true, true),
            ('Pausa', false, 'google', true, false) $$,
  'CA-45 (author): Paolo reads his imported events with the label «Google»; a free event does not count for «Liberi insieme»'
);
select results_eq(
  $$ select l.is_imported, l.is_sent, l.provider, l.calendar_name, l.visibility_overridden
     from public.events e cross join lateral public.get_event_calendar_link(e.id) l
     where e.title = 'Visita in banca' $$,
  $$ values (true, false, 'google'::public.calendar_provider, 'Personale'::text, false) $$,
  'Dettaglio impegno (author): imported, from «Personale» of Google'
);
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select results_eq(
  $$ select r.id, r.title, r.location, r.is_masked, r.author_member_id, r.source_provider, r.is_imported, r.counts_for_free_time
     from public.list_household_events_with_source('2026-11-11 00:00+01', '2026-11-14 00:00+01') r order by r.starts_at $$,
  $$ values (null::uuid, null::text, null::text, true, 'b1000000-0000-4000-8000-000000000002'::uuid, null::public.calendar_provider, null::boolean, true),
            (null, null, null, true, 'b1000000-0000-4000-8000-000000000002', null, null, true),
            (null, null, null, true, 'b1000000-0000-4000-8000-000000000002', null, null, true),
            (null, null, null, true, 'b1000000-0000-4000-8000-000000000002', null, null, true),
            (null, null, null, true, 'b1000000-0000-4000-8000-000000000002', null, null, false) $$,
  'CA-24: Giulia sees only «Occupato» of Paolo, without title, place, source or id'
);
select results_eq(
  $$ select * from public.list_household_events('2026-11-09 00:00+01', '2026-11-30 00:00+01') $$,
  $$ select r.id, r.starts_at, r.ends_at, r.visibility, r.author_member_id, r.is_masked, r.title, r.location,
            r.escort_member_id, r.member_ids
     from public.list_household_events_with_source('2026-11-09 00:00+01', '2026-11-30 00:00+01') r $$,
  'list_household_events and list_household_events_with_source give the same rows (one source of the rules)'
);
select is_empty(
  $$ select 1 from public.events e where e.title in ('Visita in banca', 'Colloquio') $$,
  'CA-24: Giulia cannot read the imported «Occupato» of Paolo from the table'
);
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select is_empty(
  $$ select 1 from public.list_household_events('2026-11-09 00:00+01', '2026-11-30 00:00+01') r
     where r.author_member_id = 'b1000000-0000-4000-8000-000000000002' $$,
  'CA-29: Marco (other household) sees nothing of Paolo'
);
select is_empty(
  $$ select 1 from public.search_household('Visita', null, '2026-11-09', '2026-11-30', null) $$,
  'CA-29: the search of Marco finds nothing of Paolo'
);

-- ---------------------------------------------------------------------------
-- Choices of a calendar (#34 §5): visibility «Tutti»
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok(
  $$ update public.external_calendars set visibility = 'household' where id = 'e2000000-0000-4000-8000-000000000001' $$,
  'CA-26: Paolo sets «Personale» to «Tutti»'
);
select results_eq(
  $$ select e.title, e.visibility from public.events e
     where e.title in ('Visita in banca', 'Colloquio') order by e.title $$,
  $$ values ('Colloquio'::text, 'busy'::public.event_visibility), ('Visita in banca'::text, 'household'::public.event_visibility) $$,
  'CA-26, CA-27: every imported event takes «Tutti», except the one private at the provider («Occupato»)'
);
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select results_eq(
  $$ select r.title, r.location, r.is_masked, r.source_provider, r.is_imported
     from public.list_household_events_with_source('2026-11-11 00:00+01', '2026-11-14 00:00+01') r
     where r.starts_at in ('2026-11-11 10:00+01', '2026-11-13 15:00+01') order by r.starts_at $$,
  $$ values ('Visita in banca'::text, 'Via Roma 1'::text, false, null::public.calendar_provider, true),
            (null, null, true, null, null) $$,
  'CA-26, CA-27: Giulia sees «Visita in banca» with its place but never the label «Google»; «Colloquio» only as «Occupato»'
);
select results_eq(
  -- Fixed period, as the events of the synchronisation above: without it the search looks
  -- from now() on, and the test failed once 11 November 2026 was past (PR #360).
  $$ select r.title, r.source_provider
     from public.search_household('Visita', null, '2026-11-09', '2026-11-30', array['event']::public.search_result_kind[]) r $$,
  $$ values ('Visita in banca'::text, null::public.calendar_provider) $$,
  'the search of Giulia finds it, without the label'
);
select results_eq(
  $$ select l.is_imported, l.is_sent, l.provider, l.calendar_id, l.calendar_name, l.visibility_overridden
     from public.events e cross join lateral public.get_event_calendar_link(e.id) l
     where e.title = 'Visita in banca' $$,
  $$ values (true, null::boolean, null::public.calendar_provider, null::uuid, null::text, null::boolean) $$,
  'CA-48: Giulia learns only that it is read only, never the provider nor the calendar'
);
-- CA-48: nobody but the provider changes or deletes an imported event.
select throws_ok(
  $$ update public.events set title = 'Altro' where title = 'Visita in banca' $$,
  '42501', 'imported events change only on their calendar',
  'CA-48: Giulia cannot change an imported «Tutti» event'
);
select throws_ok(
  $$ delete from public.events where title = 'Visita in banca' $$,
  '42501', 'imported events are deleted on their calendar',
  'CA-48: Giulia cannot delete it'
);
select throws_ok(
  $$ insert into public.event_members (event_id, member_id)
     select e.id, 'b1000000-0000-4000-8000-000000000003' from public.events e where e.title = 'Visita in banca' $$,
  '42501', 'nobody can be added to an imported event',
  'nobody adds people to an imported event'
);
select throws_ok(
  $$ update public.events set visibility = 'private' where title = 'Visita in banca' $$,
  '42501', 'only the author can change who sees an event',
  'only the author changes its visibility'
);
select throws_ok(
  $$ select public.set_event_also_on((select e.id from public.events e where e.title = 'Visita in banca'), true) $$,
  'P0002', 'event not found',
  'CA-51: «Anche su» is not for an event of someone else'
);

-- Paolo: content read only, visibility only, never «Tutti» for a private one.
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok(
  $$ update public.events set location = 'Via Verdi 2' where title = 'Visita in banca' $$,
  '42501', 'imported events change only on their calendar',
  'CA-46: the author cannot change the place of an imported event'
);
select throws_ok(
  $$ update public.events set starts_at = starts_at + interval '1 hour', ends_at = ends_at + interval '1 hour'
     where title = 'Visita in banca' $$,
  '42501', 'imported events change only on their calendar',
  'CA-46: nor its times'
);
select throws_ok(
  $$ select public.delete_event_occurrence((select e.id from public.events e where e.title = 'Visita in banca'), '2026-11-11', 'this') $$,
  '42501', 'imported events are deleted on their calendar',
  'CA-46: «Elimina impegno» is refused for the author too'
);
select throws_ok(
  $$ update public.events set visibility = 'household' where title = 'Colloquio' $$,
  '42501', 'an event private on its calendar is never shown to everyone',
  'CA-27: an event private at the provider never becomes «Tutti»'
);
select throws_ok(
  $$ select public.set_event_also_on((select e.id from public.events e where e.title = 'Visita in banca'), true) $$,
  '42501', null,
  'CA-51: an imported event is never sent with «Anche su»'
);
select lives_ok(
  $$ update public.events set visibility = 'private' where title = 'Visita in banca' $$,
  'CA-47: Paolo sets «Solo io» for «Visita in banca» alone'
);
select results_eq(
  $$ select l.visibility_overridden from public.events e cross join lateral public.get_event_calendar_link(e.id) l
     where e.title = 'Visita in banca' $$,
  $$ values (true) $$,
  'the change of this event alone is remembered'
);
select lives_ok(
  $$ update public.external_calendars set visibility = 'busy' where id = 'e2000000-0000-4000-8000-000000000001' $$,
  'Paolo sets «Personale» back to «Occupato»'
);
select results_eq(
  $$ select e.title, e.visibility from public.events e where e.title in ('Visita in banca', 'Pausa') order by e.title $$,
  $$ values ('Pausa'::text, 'busy'::public.event_visibility), ('Visita in banca'::text, 'private'::public.event_visibility) $$,
  'CA-47: the calendar changes every event except the one changed alone'
);

-- ---------------------------------------------------------------------------
-- Next synchronisations: changes, deletions, no duplicates (CA-32, CA-33, CA-47)
-- ---------------------------------------------------------------------------
set local role service_role;
set local request.jwt.claims to '{"role":"service_role"}';
select results_eq(
  $$ select * from public.sync_external_calendar_events(
       'e2000000-0000-4000-8000-000000000001',
       jsonb_build_array(
         jsonb_build_object('id', 'ev-banca', 'version', 'v2', 'title', 'Visita in banca', 'location', 'Via Roma 1',
           'starts_at', '2026-11-11 12:00+01', 'ends_at', '2026-11-11 13:00+01'),
         jsonb_build_object('id', 'ev-allday', 'title', 'Ponte', 'all_day', true, 'start_date', '2026-11-19', 'end_date', '2026-11-20'),
         jsonb_build_object('id', 'ev-free', 'deleted', true)
       ),
       false, 'cursor-2', '2026-11-09 09:15+01') $$,
  $$ values (0, 2) $$,
  'incremental: one event moved, one day less of «Ponte», one event deleted'
);
reset role;
select results_eq(
  $$ select e.starts_at, e.visibility, (select count(*)::integer from public.events x where x.title = 'Visita in banca')
     from public.events e where e.title = 'Visita in banca' $$,
  $$ values ('2026-11-11 12:00+01'::timestamptz, 'private'::public.event_visibility, 1) $$,
  'CA-32, CA-47: still one «Visita in banca», at 12:00, still «Solo io»'
);
select results_eq(
  $$ select count(*) filter (where e.title = 'Ponte')::integer, count(*) filter (where e.title = 'Pausa')::integer
     from public.events e where e.household_id = '22222222-2222-4222-8222-222222222222' $$,
  $$ values (1, 0) $$,
  'CA-33: the deleted event is gone; «Ponte» has one day left'
);
set local role service_role;
select results_eq(
  $$ select * from public.sync_external_calendar_events(
       'e2000000-0000-4000-8000-000000000001',
       jsonb_build_array(
         jsonb_build_object('id', 'ev-banca', 'version', 'v2', 'title', 'Visita in banca', 'location', 'Via Roma 1',
           'starts_at', '2026-11-11 12:00+01', 'ends_at', '2026-11-11 13:00+01'),
         jsonb_build_object('id', 'ev-private', 'title', 'Colloquio', 'starts_at', '2026-11-13 15:00+01',
           'ends_at', '2026-11-13 16:00+01', 'is_private', true),
         jsonb_build_object('id', 'ev-saturday', 'title', 'Pranzo dai nonni', 'starts_at', '2026-11-14 13:00+01', 'ends_at', '2026-11-14 15:00+01'),
         jsonb_build_object('id', 'ev-corso', 'occurrence_key', '20261116', 'title', 'Corso di inglese',
           'starts_at', '2026-11-16 19:00+01', 'ends_at', '2026-11-16 20:00+01'),
         jsonb_build_object('id', 'ev-corso', 'occurrence_key', '20261123', 'title', 'Corso di inglese',
           'starts_at', '2026-11-23 20:00+01', 'ends_at', '2026-11-23 21:00+01')
       ),
       true, 'cursor-3', '2026-11-09 09:30+01') $$,
  $$ values (0, 3) $$,
  'complete list: what the provider no longer has is deleted (the long one, «Senza titolo», «Ponte»)'
);
reset role;
select results_eq(
  $$ select e.title from public.events e join public.event_external_links l on l.event_id = e.id
     where l.calendar_id = 'e2000000-0000-4000-8000-000000000001' order by e.starts_at $$,
  $$ values ('Visita in banca'::text), ('Colloquio'), ('Pranzo dai nonni'), ('Corso di inglese'), ('Corso di inglese') $$,
  'five imported events left, each once'
);

-- ---------------------------------------------------------------------------
-- «Solo giorni feriali» and «Conta per «Liberi insieme»» (CA-21, CA-37)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok(
  $$ update public.external_calendars set weekdays_only = true where id = 'e2000000-0000-4000-8000-000000000001' $$,
  'CA-21: Paolo switches «Solo giorni feriali» on'
);
select is_empty(
  $$ select 1 from public.events e where e.title = 'Pranzo dai nonni' $$,
  'CA-21: the Saturday event is gone at once'
);
set local role service_role;
set local request.jwt.claims to '{"role":"service_role"}';
select results_eq(
  $$ select * from public.sync_external_calendar_events(
       'e2000000-0000-4000-8000-000000000001',
       jsonb_build_array(jsonb_build_object('id', 'ev-saturday', 'title', 'Pranzo dai nonni',
         'starts_at', '2026-11-14 13:00+01', 'ends_at', '2026-11-14 15:00+01')),
       false, 'cursor-4', '2026-11-09 09:45+01') $$,
  $$ values (0, 0) $$,
  'with «Solo giorni feriali» the Saturday event does not come back'
);
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok(
  $$ update public.external_calendars set weekdays_only = false, counts_for_free_time = false
     where id = 'e2000000-0000-4000-8000-000000000001' $$,
  'Paolo switches «Solo giorni feriali» off and «Conta per Liberi insieme» off'
);
set local role service_role;
set local request.jwt.claims to '{"role":"service_role"}';
select results_eq(
  $$ select * from public.sync_external_calendar_events(
       'e2000000-0000-4000-8000-000000000001',
       jsonb_build_array(jsonb_build_object('id', 'ev-saturday', 'title', 'Pranzo dai nonni',
         'starts_at', '2026-11-14 13:00+01', 'ends_at', '2026-11-14 15:00+01')),
       false, 'cursor-5', '2026-11-09 10:00+01') $$,
  $$ values (1, 0) $$,
  'CA-21: switched off, the Saturday event comes back with the next synchronisation'
);
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select results_eq(
  $$ select bool_or(r.counts_for_free_time) from public.list_household_events_with_source('2026-11-09 00:00+01', '2026-11-30 00:00+01') r
     where r.author_member_id = 'b1000000-0000-4000-8000-000000000002' $$,
  $$ values (false) $$,
  'CA-37: a calendar that does not count for «Liberi insieme» makes Paolo busy for nobody'
);
-- The job «Liberi insieme» (#229): an evening «Corso di inglese» of Paolo, 19:00–20:00 of
-- Monday 16 November, counts again after the switch is back on.
reset role;
select is(
  private.free_together_start('b1000000-0000-4000-8000-000000000001', '2026-11-16'),
  '2026-11-16 18:00+01'::timestamptz,
  'CA-37: for Giulia the evening is free from 18:00 (the course does not count)'
);
update public.external_calendars set counts_for_free_time = true where id = 'e2000000-0000-4000-8000-000000000001';
select is(
  private.free_together_start('b1000000-0000-4000-8000-000000000001', '2026-11-16'),
  '2026-11-16 20:00+01'::timestamptz,
  'CA-37: counted again, the evening of Giulia starts at 20:00'
);

-- ---------------------------------------------------------------------------
-- «Anche su» (#34 §16): outbox, no duplicates, deletion
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok(
  $$ select public.create_event('Nuoto Sofia', '2026-11-17 17:00+01', '2026-11-17 18:00+01', 'busy',
       array[]::uuid[], 'Piscina', null, 'none', null, null, 'Portare la cuffia') $$,
  'Paolo creates «Nuoto Sofia» in FamilyNest, with notes'
);
select results_eq(
  $$ select l.is_imported, l.is_sent from public.events e cross join lateral public.get_event_calendar_link(e.id) l
     where e.title = 'Nuoto Sofia' $$,
  $$ values (false, false) $$,
  'born in FamilyNest, not sent yet'
);
select lives_ok(
  $$ select public.set_event_also_on((select e.id from public.events e where e.title = 'Nuoto Sofia'), true) $$,
  'CA-49: Paolo switches «Anche su Google» on'
);
select lives_ok(
  $$ select public.set_event_also_on((select e.id from public.events e where e.title = 'Nuoto Sofia'), true) $$,
  'switching it on twice changes nothing'
);
select results_eq(
  $$ select l.is_sent, l.provider, l.calendar_name from public.events e cross join lateral public.get_event_calendar_link(e.id) l
     where e.title = 'Nuoto Sofia' $$,
  $$ values (true, 'google'::public.calendar_provider, 'Personale'::text) $$,
  'waiting for the provider, already «Anche su Google» in «Personale»'
);
reset role;
select results_eq(
  $$ select o.action, o.calendar_id, o.provider_event_id is null from public.calendar_outbox o $$,
  $$ values ('create'::public.calendar_outbox_action, 'e2000000-0000-4000-8000-000000000001'::uuid, true) $$,
  'CA-49: one «create» for «Personale», without any text (the service reads title, times, place and repetition from the event)'
);
set local role service_role;
set local request.jwt.claims to '{"role":"service_role"}';
select is(
  public.complete_calendar_outbox_item((select o.id from public.calendar_outbox o), 'g-nuoto', 'etag-1'),
  true,
  'the service has created it at the provider'
);
select results_eq(
  $$ select * from public.sync_external_calendar_events(
       'e2000000-0000-4000-8000-000000000001',
       jsonb_build_array(jsonb_build_object('id', 'g-nuoto', 'version', 'etag-1', 'title', 'Nuoto Sofia',
         'starts_at', '2026-11-17 17:00+01', 'ends_at', '2026-11-17 18:00+01', 'is_private', true)),
       false, 'cursor-6', '2026-11-09 10:15+01') $$,
  $$ values (0, 0) $$,
  'CA-49: found again at the next synchronisation, nothing is imported'
);
reset role;
select results_eq(
  $$ select count(*)::integer from public.events e where e.title = 'Nuoto Sofia' $$,
  $$ values (1) $$,
  'CA-49: one «Nuoto Sofia» only'
);
select is_empty($$ select 1 from public.calendar_outbox $$, 'the outbox is empty after the creation');
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok(
  $$ update public.events set starts_at = '2026-11-17 18:00+01', ends_at = '2026-11-17 19:00+01' where title = 'Nuoto Sofia' $$,
  'CA-50: Paolo changes the time'
);
select lives_ok(
  $$ update public.events set location = 'Piscina comunale' where title = 'Nuoto Sofia' $$,
  'and the place'
);
reset role;
select results_eq(
  $$ select o.action, o.provider_event_id from public.calendar_outbox o $$,
  $$ values ('update'::public.calendar_outbox_action, 'g-nuoto'::text) $$,
  'CA-50: one «update» waits (not one per change)'
);
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok(
  $$ select public.set_event_also_on((select e.id from public.events e where e.title = 'Nuoto Sofia'), false) $$,
  'CA-50: Paolo switches «Anche su Google» off'
);
reset role;
select results_eq(
  $$ select o.action, o.provider_event_id, o.event_id from public.calendar_outbox o $$,
  $$ values ('delete'::public.calendar_outbox_action, 'g-nuoto'::text, null::uuid) $$,
  'CA-50: the copy is deleted at the provider (only its id is kept); the update is gone'
);
select is_empty(
  $$ select 1 from public.event_external_links l join public.events e on e.id = l.event_id where e.title = 'Nuoto Sofia' $$,
  'the event is no longer linked, and stays in FamilyNest'
);
delete from public.calendar_outbox;
-- Sent again, then deleted in FamilyNest.
set local role authenticated;
select lives_ok(
  $$ select public.set_event_also_on((select e.id from public.events e where e.title = 'Nuoto Sofia'), true) $$,
  'Paolo sends «Nuoto Sofia» again'
);
reset role;
set local role service_role;
select is(
  public.complete_calendar_outbox_item((select o.id from public.calendar_outbox o), 'g-nuoto-2', null),
  true,
  'created again at the provider'
);
select is(
  public.complete_calendar_outbox_item(gen_random_uuid(), 'g-other', null),
  false,
  'a row that is gone (switched off meanwhile): the service deletes the copy it created'
);
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok(
  $$ select public.delete_event_occurrence((select e.id from public.events e where e.title = 'Nuoto Sofia'), '2026-11-17', 'this') $$,
  'CA-50: Paolo deletes «Nuoto Sofia» in FamilyNest'
);
reset role;
select results_eq(
  $$ select o.action, o.provider_event_id from public.calendar_outbox o $$,
  $$ values ('delete'::public.calendar_outbox_action, 'g-nuoto-2'::text) $$,
  'CA-50: its copy is deleted at the provider'
);
delete from public.calendar_outbox;

-- ---------------------------------------------------------------------------
-- «Dove vanno i nuovi impegni» (CA-16, CA-22, CA-23)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok(
  $$ select public.set_new_events_calendar('e2000000-0000-4000-8000-000000000002') $$,
  'P0002', 'calendar not found',
  'CA-23: a read-only calendar cannot receive new events'
);
select lives_ok($$ select public.set_new_events_calendar(null) $$, 'Paolo chooses «Nessuno»');
select is_empty($$ select 1 from public.external_calendars c where c.is_new_events_target $$, '«Nessuno»');
select throws_ok(
  $$ select public.set_event_also_on((select e.id from public.events e where e.title = 'Corso di inglese' limit 1), true) $$,
  '42501', null,
  'an imported event is never sent'
);
select lives_ok(
  $$ select public.set_new_events_calendar('e2000000-0000-4000-8000-000000000001') $$,
  'CA-23: Paolo chooses «Personale»'
);
select results_eq(
  $$ select c.name from public.external_calendars c where c.is_new_events_target $$,
  $$ values ('Personale'::text) $$,
  'CA-23: «Personale» receives the new events'
);
select lives_ok(
  $$ update public.external_calendars set direction = 'incoming' where id = 'e2000000-0000-4000-8000-000000000001' $$,
  'CA-22: Paolo sets «Personale» to «Solo in entrata»'
);
select is_empty(
  $$ select 1 from public.external_calendars c where c.is_new_events_target $$,
  'CA-22: «Dove vanno i nuovi impegni» becomes «Nessuno»'
);
select lives_ok(
  $$ update public.external_calendars set direction = 'two_way' where id = 'e2000000-0000-4000-8000-000000000001' $$,
  'Paolo sets «Personale» back to «Entrata e uscita»'
);
select results_eq(
  $$ select c.name from public.external_calendars c where c.is_new_events_target $$,
  $$ values ('Personale'::text) $$,
  '§3: the first calendar that becomes eligible becomes the choice when it was «Nessuno»'
);

-- ---------------------------------------------------------------------------
-- Count for Onboarding · Pronto (#37 §6)
-- ---------------------------------------------------------------------------
select results_eq(
  $$ select * from public.count_imported_events('2026-11-12 00:00+01') $$,
  $$ values ('google'::public.calendar_provider, 4) $$,
  'Paolo: 4 imported events from 12 November on, only numbers per provider'
);
select throws_ok($$ select * from public.count_imported_events(null) $$, '22023', null, 'the instant is required');
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select is_empty(
  $$ select * from public.count_imported_events('2026-01-01 00:00+01') $$,
  'Giulia (no account) counts nothing of Paolo'
);
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select results_eq(
  $$ select * from public.count_imported_events('2026-01-01 00:00+01') $$,
  $$ values ('google'::public.calendar_provider, 0) $$,
  'Marco: his Google account, no event'
);

-- ---------------------------------------------------------------------------
-- State of an account (CA-40, CA-41, CA-42)
-- ---------------------------------------------------------------------------
set local role service_role;
set local request.jwt.claims to '{"role":"service_role"}';
select lives_ok(
  $$ select public.record_calendar_sync_result('e1000000-0000-4000-8000-000000000001', 'temporary_error', '2026-11-09 12:00+01') $$,
  'CA-42: the provider does not answer once'
);
select lives_ok(
  $$ select public.record_calendar_sync_result('e1000000-0000-4000-8000-000000000001', 'auth_error', '2026-11-09 13:10+01') $$,
  'CA-40: then it refuses the credentials'
);
reset role;
select results_eq(
  $$ select a.status, a.failing_since from public.calendar_accounts a where a.id = 'e1000000-0000-4000-8000-000000000001' $$,
  $$ values ('reconnect'::public.calendar_account_status, '2026-11-09 12:00+01'::timestamptz) $$,
  'CA-40: «Ricollega», failing since the first failed attempt'
);
select ok(
  exists (select 1 from public.events e where e.title = 'Colloquio'),
  'CA-40: the events already imported stay'
);
set local role service_role;
select lives_ok(
  $$ select public.record_calendar_sync_result('e1000000-0000-4000-8000-000000000001', 'temporary_error', '2026-11-09 14:00+01') $$,
  'a temporary error does not hide «Ricollega»'
);
select results_eq(
  $$ select a.status from public.calendar_accounts a where a.id = 'e1000000-0000-4000-8000-000000000001' $$,
  $$ values ('reconnect'::public.calendar_account_status) $$,
  'still «reconnect»'
);
select results_eq(
  $$ select s.is_new from public.save_calendar_account('bbbbbbbb-0000-4000-8000-000000000002', 'google', 'fake-seed-paolo',
       'paolo.finto@example.test', 'v1:test.placeholder.not.a.credential.000020', true) s $$,
  $$ values (false) $$,
  'CA-41: «Ricollega» with the same account'
);
reset role;
select results_eq(
  $$ select a.status, a.failing_since, (select count(*)::integer from public.calendar_accounts x
       where x.member_id = 'b1000000-0000-4000-8000-000000000002') from public.calendar_accounts a
     where a.id = 'e1000000-0000-4000-8000-000000000001' $$,
  $$ values ('active'::public.calendar_account_status, null::timestamptz, 1) $$,
  'CA-41: active again, one account only'
);
select is_empty(
  $$ select 1 from public.calendar_credential_revocations $$,
  'linking the same account again queues nothing for revocation'
);

-- ---------------------------------------------------------------------------
-- Switching a calendar off (CA-13)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok($$ update public.external_calendars set visibility = 'household' where id = 'e2000000-0000-4000-8000-000000000001' $$, 'Personale «Tutti»');
select lives_ok(
  $$ update public.external_calendars set is_enabled = false where id = 'e2000000-0000-4000-8000-000000000001' $$,
  'CA-13: Paolo switches «Personale» off'
);
reset role;
select is_empty(
  $$ select 1 from public.events e join public.event_external_links l on l.event_id = e.id
     where l.calendar_id = 'e2000000-0000-4000-8000-000000000001' $$,
  'CA-13: every event imported from it is gone at once, «Tutti» included'
);
select is_empty(
  $$ select 1 from public.events e where e.title in ('Colloquio', 'Corso di inglese', 'Visita in banca') $$,
  'CA-13: no event with those titles left in the database'
);
select results_eq(
  $$ select c.sync_cursor, c.is_new_events_target from public.external_calendars c where c.id = 'e2000000-0000-4000-8000-000000000001' $$,
  $$ values (null::text, false) $$,
  'switched off: the next synchronisation reads everything again; no longer «Dove vanno i nuovi impegni»'
);
set local role service_role;
set local request.jwt.claims to '{"role":"service_role"}';
select results_eq(
  $$ select * from public.sync_external_calendar_events(
       'e2000000-0000-4000-8000-000000000001',
       jsonb_build_array(jsonb_build_object('id', 'ev-late', 'title', 'Tardi', 'starts_at', '2026-11-11 10:00+01', 'ends_at', '2026-11-11 11:00+01')),
       true, 'cursor-7', '2026-11-09 15:00+01') $$,
  $$ values (0, 0) $$,
  'a synchronisation that arrives after the switch-off writes nothing'
);
update public.external_calendars set is_enabled = true where id = 'e2000000-0000-4000-8000-000000000001';
select results_eq(
  $$ select * from public.sync_external_calendar_events(
       'e2000000-0000-4000-8000-000000000001',
       jsonb_build_array(
         jsonb_build_object('id', 'ev-banca', 'title', 'Visita in banca', 'starts_at', '2026-11-11 10:00+01', 'ends_at', '2026-11-11 11:00+01'),
         jsonb_build_object('id', 'ev-pranzo', 'title', 'Pranzo', 'starts_at', '2026-11-11 13:00+01', 'ends_at', '2026-11-11 14:00+01')
       ),
       true, 'cursor-8', '2026-11-09 15:00+01') $$,
  $$ values (2, 0) $$,
  'switched on again (CA-12): the events arrive with the next synchronisation'
);

-- ---------------------------------------------------------------------------
-- Revocation queue: every way an account goes (CA-43, CA-44, #35 CA-11, CA-12)
-- ---------------------------------------------------------------------------
reset role;
-- Paolo also links an Outlook account (Microsoft has no revocation service).
select ok(
  (select s.is_new from public.save_calendar_account('bbbbbbbb-0000-4000-8000-000000000002', 'outlook', 'fake-paolo-outlook',
     'paolo.studio@example.test', 'v1:test.placeholder.not.a.credential.000021', true) s),
  'Paolo links a fake Outlook account'
);
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select results_eq(
  $$ delete from public.calendar_accounts where provider = 'outlook' returning provider $$,
  $$ values ('outlook'::public.calendar_provider) $$,
  '#35 CA-11: Paolo unlinks Outlook'
);
reset role;
select is_empty($$ select 1 from public.calendar_credential_revocations $$, '#35 CA-11: nothing queued for Outlook (no revocation service)');

-- CA-43: «Scollega» of Google.
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select results_eq(
  $$ delete from public.calendar_accounts where provider = 'google' returning id $$,
  $$ values ('e1000000-0000-4000-8000-000000000001'::uuid) $$,
  'CA-43: Paolo unlinks his Google account'
);
reset role;
select results_eq(
  $$ select r.provider, r.is_fake, r.credentials_ciphertext from public.calendar_credential_revocations r $$,
  $$ values ('google'::public.calendar_provider, true, 'v1:test.placeholder.not.a.credential.000020'::text) $$,
  'CA-43: its credentials wait for the revocation, with the provider only'
);
select is_empty(
  $$ select 1 from public.external_calendars c where c.account_id = 'e1000000-0000-4000-8000-000000000001'
     union all select 1 from public.events e where e.title in ('Visita in banca', 'Pranzo') $$,
  'CA-43: its calendars and imported events are gone'
);
delete from public.calendar_credential_revocations;

-- CA-44: an administrator removes an adult; the «Tutti» imported events of the adult go too.
select lives_ok(
  $$ select * from public.save_calendar_account('bbbbbbbb-0000-4000-8000-000000000002', 'google', 'fake-paolo-2',
       'paolo.due@example.test', 'v1:test.placeholder.not.a.credential.000022', true) $$,
  'Paolo links Google again'
);
select lives_ok(
  $$ select public.save_external_calendars(
       (select a.id from public.calendar_accounts a where a.provider_account_id = 'fake-paolo-2'),
       '[{"id":"p2-pers","name":"Personale","is_primary":true}]'::jsonb) $$,
  'with «Personale»'
);
update public.external_calendars set visibility = 'household' where member_id = 'b1000000-0000-4000-8000-000000000002';
select results_eq(
  $$ select * from public.sync_external_calendar_events(
       (select c.id from public.external_calendars c where c.provider_calendar_id = 'p2-pers'),
       jsonb_build_array(jsonb_build_object('id', 'p2-ev', 'title', 'Riunione di condominio',
         'starts_at', '2026-11-11 21:00+01', 'ends_at', '2026-11-11 22:00+01')),
       true, null, '2026-11-09 16:00+01') $$,
  $$ values (1, 0) $$,
  'one «Tutti» event imported'
);
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select results_eq(
  $$ delete from public.household_members where id = 'b1000000-0000-4000-8000-000000000002' returning name $$,
  $$ values ('Paolo'::text) $$,
  'CA-44: Giulia (administrator) removes Paolo from Casa Bianchi'
);
reset role;
select results_eq(
  $$ select r.provider, r.credentials_ciphertext from public.calendar_credential_revocations r $$,
  $$ values ('google'::public.calendar_provider, 'v1:test.placeholder.not.a.credential.000022'::text) $$,
  'CA-44: his credentials wait for the revocation'
);
select is_empty(
  $$ select 1 from public.calendar_accounts a where a.member_id = 'b1000000-0000-4000-8000-000000000002'
     union all select 1 from public.external_calendars c where c.member_id = 'b1000000-0000-4000-8000-000000000002'
     union all select 1 from public.events e where e.title = 'Riunione di condominio'
     union all select 1 from public.event_external_links l where l.household_id = '22222222-2222-4222-8222-222222222222' $$,
  'CA-44: no account, calendar, link nor imported event of Paolo is left, «Tutti» included'
);
delete from public.calendar_credential_revocations;

-- CA-44: the account is deleted (delete_own_account); Marco is the last adult with an
-- account of Casa D'Angelo, so the household goes too. A sent event and a pending change
-- do not stop the deletion.
select lives_ok(
  $$ select public.save_external_calendars(current_setting('test.marco_account')::uuid,
       '[{"id":"cal-pers","name":"Personale","is_primary":true}]'::jsonb) $$,
  'Marco keeps «Personale»'
);
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok(
  $$ select public.create_event('Spesa grande', '2026-11-18 18:00+01', '2026-11-18 19:00+01', 'household', array[]::uuid[]) $$,
  'Marco creates an event'
);
select lives_ok(
  $$ select public.set_event_also_on((select e.id from public.events e where e.title = 'Spesa grande'), true) $$,
  'and sends it with «Anche su»'
);
reset role;
select is(
  public.complete_calendar_outbox_item((select o.id from public.calendar_outbox o), 'g-spesa', null),
  true,
  'created at the provider'
);
update public.events set title = 'Spesa grandissima' where title = 'Spesa grande';
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok(
  $$ select public.delete_own_account(true) $$,
  'CA-44: Marco deletes his account (and Casa D''Angelo with it)'
);
reset role;
select results_eq(
  $$ select r.provider, r.credentials_ciphertext from public.calendar_credential_revocations r $$,
  $$ values ('google'::public.calendar_provider, 'v1:test.placeholder.not.a.credential.000002'::text) $$,
  'CA-44: his credentials wait for the revocation, also inside delete_own_account()'
);
select is_empty(
  $$ select 1 from public.calendar_accounts a where a.household_id = '11111111-1111-4111-8111-111111111111'
     union all select 1 from public.external_calendars c where c.household_id = '11111111-1111-4111-8111-111111111111'
     union all select 1 from public.calendar_outbox o where o.household_id = '11111111-1111-4111-8111-111111111111'
     union all select 1 from public.event_external_links l where l.household_id = '11111111-1111-4111-8111-111111111111' $$,
  'nothing of the linked calendars of Casa D''Angelo is left'
);

-- ---------------------------------------------------------------------------
-- The job every 15 minutes: the queue is emptied within 24 hours, the service is called
-- ---------------------------------------------------------------------------
insert into public.calendar_credential_revocations (provider, is_fake, credentials_ciphertext, created_at)
values
  ('google', true, 'v1:test.placeholder.not.a.credential.000030', now() - interval '23 hours 1 minute'),
  ('google', true, 'v1:test.placeholder.not.a.credential.000031', now() - interval '22 hours 59 minutes');
select is(private.run_scheduled_calendar_jobs(now()), 1, 'the row older than 23 hours goes, revoked or not');
select results_eq(
  $$ select r.credentials_ciphertext from public.calendar_credential_revocations r order by r.credentials_ciphertext $$,
  $$ values ('v1:test.placeholder.not.a.credential.000002'::text), ('v1:test.placeholder.not.a.credential.000031') $$,
  'the recent rows (Marco''s and the one of 22 hours 59 minutes ago) wait for the service'
);
select is(
  (select count(*)::integer from net.http_request_queue),
  0,
  'without the address and the secret in the Vault nothing is called'
);
select lives_ok(
  $$ select vault.create_secret('http://127.0.0.1:9/calendar-sync-test', 'calendar_sync_url');
     select vault.create_secret('test-value-not-a-secret', 'calendar_sync_secret') $$,
  'the address and the secret of the service are in the Vault'
);
select is(private.run_scheduled_calendar_jobs(now()), 0, 'nothing old to delete');
select results_eq(
  $$ select q.method::text, q.url, q.headers ->> 'Authorization' from net.http_request_queue q $$,
  $$ values ('POST'::text, 'http://127.0.0.1:9/calendar-sync-test'::text, 'Bearer test-value-not-a-secret'::text) $$,
  'the job asks the service to work, with the secret of the Vault'
);

select * from finish();
rollback;
