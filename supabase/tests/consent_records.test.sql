-- Versions of the legal documents and consents (issue #513, DB-4 part 1: CA-1 – CA-7, and the
-- consents part of CA-27 – CA-30): legal_document_versions, consent_records, the sign-up
-- trigger, accept_required_consents(), set_consent(), get_my_consents(),
-- get_privacy_update(), mark_privacy_version_read(), get_legal_versions(),
-- private.has_consent().
-- Seed ids: Marco (Casa D'Angelo, admin, user aaaaaaaa…01), Laura (member a1…02, no
-- account in the seed); Giulia (Casa Bianchi, admin, bbbbbbbb…01). This test gives Laura an
-- account (user aaaaaaaa…02). The table of the versions is empty at the start (it is born
-- empty): the versions are inserted here. Dates: 2 October and 2 November 2026 (always in
-- the past), today and today + 30 days in Europe/Rome.
-- Sign-ups of this test (users e5130000-…): 01 before any version, 02 valid (CA-1), 03 without
-- consents, 04 with an old version, 05 with an id that is a number, 06 with a future
-- version, 07 with adult false, 08 with a text that is not a uuid.
begin;
create extension if not exists pgtap with schema extensions;

select plan(90);

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-4000-8000-000000000002', 'authenticated',
        'authenticated', 'utente-laura@example.com', '{"full_name":"Laura Test"}', now(), now());
update public.household_members
set user_id = 'aaaaaaaa-0000-4000-8000-000000000002', joined_at = now()
where id = 'a1000000-0000-4000-8000-000000000002';

-- ---------------------------------------------------------------------------
-- Schema and privileges
-- ---------------------------------------------------------------------------
select has_table('public', 'legal_document_versions', 'legal_document_versions exists');
select has_table('public', 'consent_records', 'consent_records exists');
select ok(
  (select c.relrowsecurity from pg_class c where c.oid = 'public.legal_document_versions'::regclass),
  'RLS enabled on legal_document_versions'
);
select ok(
  (select c.relrowsecurity from pg_class c where c.oid = 'public.consent_records'::regclass),
  'RLS enabled on consent_records'
);
select columns_are(
  'public', 'legal_document_versions',
  array['id', 'document', 'effective_from', 'notify_users', 'created_at'],
  'legal_document_versions has exactly the planned columns'
);
select columns_are(
  'public', 'consent_records',
  array['id', 'user_id', 'kind', 'granted', 'terms_version_id', 'privacy_version_id', 'source', 'created_at'],
  'consent_records has exactly the planned columns (no household_id: personal to the account)'
);
select enum_has_labels('public', 'legal_document', array['terms', 'privacy'], 'legal_document labels');
select enum_has_labels(
  'public', 'consent_kind',
  array['terms_and_privacy', 'adult', 'product_news_email', 'usage_analytics', 'assistant_questions'],
  'consent_kind labels'
);
select enum_has_labels('public', 'consent_source', array['signup', 'settings', 'first_use', 'update'], 'consent_source labels');
select has_index('public', 'consent_records', 'consent_records_user_kind_created_idx', 'index on the user (foreign key, RLS)');
select has_index('public', 'consent_records', 'consent_records_terms_version_id_idx', 'index on the terms version (foreign key)');
select has_index('public', 'consent_records', 'consent_records_privacy_version_id_idx', 'index on the privacy version (foreign key)');
select is_empty($$ select 1 from public.legal_document_versions $$, 'rule 1: the table of the versions is born empty');

-- ---------------------------------------------------------------------------
-- No version published yet: the consents are taken with null versions
-- ---------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', 'e5130000-0000-4000-8000-000000000001', 'authenticated',
        'authenticated', 'firma-1@example.com',
        '{"consents":{"terms_version_id":null,"privacy_version_id":null,"adult":true,"product_news":true}}', now(), now());
select results_eq(
  $$ select c.kind::text, c.granted, c.terms_version_id is null and c.privacy_version_id is null, c.source::text
     from public.consent_records c where c.user_id = 'e5130000-0000-4000-8000-000000000001' order by c.kind $$,
  $$ values ('terms_and_privacy', true, true, 'signup'), ('adult', true, true, 'signup'),
            ('product_news_email', true, true, 'signup') $$,
  'rule 2: with no version published, the sign-up writes the three consents with null versions'
);

-- The versions (as the database owner, as a migration would).
insert into public.legal_document_versions (id, document, effective_from, notify_users)
values
  ('d5130000-0000-4000-8000-000000000001', 'terms', '2026-10-02', false),
  ('d5130000-0000-4000-8000-000000000002', 'terms', '2026-11-02', false),
  ('d5130000-0000-4000-8000-000000000003', 'privacy', '2026-11-02', false),
  ('d5130000-0000-4000-8000-000000000004', 'privacy', (now() at time zone 'Europe/Rome')::date + 30, true);

select results_eq(
  $$ select g.document::text, g.version_id, g.effective_from from public.get_legal_versions() g $$,
  $$ values ('terms', 'd5130000-0000-4000-8000-000000000002'::uuid, '2026-11-02'::date),
            ('privacy', 'd5130000-0000-4000-8000-000000000003'::uuid, '2026-11-02'::date) $$,
  'rule 1: get_legal_versions() gives the most recent version not after today, per document'
);

-- ---------------------------------------------------------------------------
-- CA-1, CA-2: the consents of «Crea account»
-- ---------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'e5130000-0000-4000-8000-000000000002', 'authenticated',
   'authenticated', 'firma-2@example.com',
   '{"full_name":"Firma Due","consents":{"terms_version_id":"d5130000-0000-4000-8000-000000000002","privacy_version_id":"d5130000-0000-4000-8000-000000000003","adult":true,"product_news":false}}',
   now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'e5130000-0000-4000-8000-000000000003', 'authenticated',
   'authenticated', 'firma-3@example.com', '{"full_name":"Firma Tre"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'e5130000-0000-4000-8000-000000000004', 'authenticated',
   'authenticated', 'firma-4@example.com',
   '{"consents":{"terms_version_id":"d5130000-0000-4000-8000-000000000001","privacy_version_id":"d5130000-0000-4000-8000-000000000003","adult":true,"product_news":false}}',
   now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'e5130000-0000-4000-8000-000000000005', 'authenticated',
   'authenticated', 'firma-5@example.com',
   '{"consents":{"terms_version_id":5,"privacy_version_id":"d5130000-0000-4000-8000-000000000003","adult":true,"product_news":false}}',
   now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'e5130000-0000-4000-8000-000000000006', 'authenticated',
   'authenticated', 'firma-6@example.com',
   '{"consents":{"terms_version_id":"d5130000-0000-4000-8000-000000000002","privacy_version_id":"d5130000-0000-4000-8000-000000000004","adult":true,"product_news":true}}',
   now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'e5130000-0000-4000-8000-000000000007', 'authenticated',
   'authenticated', 'firma-7@example.com',
   '{"consents":{"terms_version_id":"d5130000-0000-4000-8000-000000000002","privacy_version_id":"d5130000-0000-4000-8000-000000000003","adult":false,"product_news":true}}',
   now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'e5130000-0000-4000-8000-000000000008', 'authenticated',
   'authenticated', 'firma-8@example.com',
   '{"consents":{"terms_version_id":"not-a-uuid","privacy_version_id":"d5130000-0000-4000-8000-000000000003","adult":true,"product_news":false}}',
   now(), now());

select results_eq(
  $$ select c.kind::text, c.granted, c.terms_version_id, c.privacy_version_id, c.source::text
     from public.consent_records c where c.user_id = 'e5130000-0000-4000-8000-000000000002' order by c.kind $$,
  $$ values
       ('terms_and_privacy', true, 'd5130000-0000-4000-8000-000000000002'::uuid, 'd5130000-0000-4000-8000-000000000003'::uuid, 'signup'),
       ('adult', true, 'd5130000-0000-4000-8000-000000000002'::uuid, 'd5130000-0000-4000-8000-000000000003'::uuid, 'signup'),
       ('product_news_email', false, 'd5130000-0000-4000-8000-000000000002'::uuid, 'd5130000-0000-4000-8000-000000000003'::uuid, 'signup') $$,
  'CA-1: terms_and_privacy and adult accepted with the current versions, product_news_email false, all source signup'
);
select is(
  (select count(*)::integer from auth.users u where u.id::text like 'e5130000-%'),
  8,
  'CA-2: every sign-up created its account, whatever its consents'
);
select is(
  (select count(*)::integer from public.profiles p where p.id::text like 'e5130000-%'),
  8,
  'CA-2: every sign-up created its profile'
);
select is_empty(
  $$ select 1 from public.consent_records c
     where c.user_id in ('e5130000-0000-4000-8000-000000000003', 'e5130000-0000-4000-8000-000000000004',
                         'e5130000-0000-4000-8000-000000000005', 'e5130000-0000-4000-8000-000000000006',
                         'e5130000-0000-4000-8000-000000000007', 'e5130000-0000-4000-8000-000000000008') $$,
  'CA-2: no consent without consents, with an old or future version, with adult false, with an id that is not a uuid'
);

set local role authenticated;
set local request.jwt.claims to '{"sub":"e5130000-0000-4000-8000-000000000003","role":"authenticated"}';
select results_eq(
  $$ select bool_and(not g.required_ok), count(*)::integer from public.get_my_consents() g $$,
  $$ values (true, 5) $$,
  'CA-2: without consents, get_my_consents() gives required_ok = false'
);
set local request.jwt.claims to '{"sub":"e5130000-0000-4000-8000-000000000004","role":"authenticated"}';
select is(
  (select bool_and(g.required_ok) from public.get_my_consents() g),
  false,
  'CA-2: with an old version at sign-up, required_ok = false'
);
set local request.jwt.claims to '{"sub":"e5130000-0000-4000-8000-000000000002","role":"authenticated"}';
select is(
  (select bool_and(g.required_ok) from public.get_my_consents() g),
  true,
  'CA-1: with valid consents at sign-up, required_ok = true'
);

-- ---------------------------------------------------------------------------
-- CA-5: Giulia never decided anything
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select results_eq(
  $$ select g.kind::text, g.granted, g.decided_at is null, g.terms_effective_from, g.privacy_effective_from, g.required_ok
     from public.get_my_consents() g $$,
  $$ values
       ('terms_and_privacy', false, true, null::date, null::date, false),
       ('adult', false, true, null::date, null::date, false),
       ('product_news_email', false, true, null::date, null::date, false),
       ('usage_analytics', false, true, null::date, null::date, false),
       ('assistant_questions', false, true, null::date, null::date, false) $$,
  'CA-5: 5 rows in order, never decided: false with decided_at null'
);

-- ---------------------------------------------------------------------------
-- CA-3: Marco accepts the required consents
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select public.accept_required_consents('d5130000-0000-4000-8000-000000000002', 'd5130000-0000-4000-8000-000000000003', false) $$,
  '22023', null, 'CA-3: p_adult false gives 22023'
);
select throws_ok(
  $$ select public.accept_required_consents('d5130000-0000-4000-8000-000000000002', 'd5130000-0000-4000-8000-000000000003', null) $$,
  '22023', null, 'CA-3: p_adult null gives 22023'
);
select throws_ok(
  $$ select public.accept_required_consents('d5130000-0000-4000-8000-000000000001', 'd5130000-0000-4000-8000-000000000003', true) $$,
  '22023', null, 'CA-3: an old terms version gives 22023'
);
select throws_ok(
  $$ select public.accept_required_consents('d5130000-0000-4000-8000-000000000002', 'd5130000-0000-4000-8000-000000000004', true) $$,
  '22023', null, 'CA-3: a future privacy version gives 22023'
);
select throws_ok(
  $$ select public.accept_required_consents(null, null, true) $$,
  '22023', null, 'CA-3: null versions while versions are published give 22023'
);
select throws_ok(
  $$ select public.accept_required_consents('d5130000-0000-4000-8000-000000000003', 'd5130000-0000-4000-8000-000000000002', true) $$,
  '22023', null, 'CA-3: terms and privacy swapped give 22023'
);
select is_empty(
  $$ select 1 from public.consent_records c where c.user_id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  'CA-3: nothing written by the refused calls'
);
select lives_ok(
  $$ select public.accept_required_consents('d5130000-0000-4000-8000-000000000002', 'd5130000-0000-4000-8000-000000000003', true) $$,
  'CA-3: Marco accepts with the current versions'
);
select results_eq(
  $$ select g.kind::text, g.granted, g.terms_effective_from, g.privacy_effective_from, g.required_ok
     from public.get_my_consents() g where g.kind in ('terms_and_privacy', 'adult') $$,
  $$ values ('terms_and_privacy', true, '2026-11-02'::date, '2026-11-02'::date, true),
            ('adult', true, '2026-11-02'::date, '2026-11-02'::date, true) $$,
  'CA-3: required_ok becomes true, with the dates of the versions'
);

-- ---------------------------------------------------------------------------
-- CA-4: optional consents
-- ---------------------------------------------------------------------------
select lives_ok($$ select public.set_consent('usage_analytics', true) $$, 'CA-4: usage_analytics switched on');
select lives_ok($$ select public.set_consent('usage_analytics', false) $$, 'CA-4: usage_analytics switched off');
select results_eq(
  $$ select g.granted, g.decided_at = (select max(c.created_at) from public.consent_records c where c.kind = 'usage_analytics')
     from public.get_my_consents() g where g.kind = 'usage_analytics' $$,
  $$ values (false, true) $$,
  'CA-4: get_my_consents() gives false with the time of the second decision'
);
select results_eq(
  $$ select c.granted, c.source::text from public.consent_records c where c.kind = 'usage_analytics' order by c.created_at $$,
  $$ values (true, 'settings'), (false, 'settings') $$,
  'CA-4: the table has the two rows, in order, source settings by default'
);
select throws_ok($$ select public.set_consent('adult', false) $$, '22023', null, 'CA-4: set_consent(adult) gives 22023');
select throws_ok(
  $$ select public.set_consent('terms_and_privacy', false) $$, '22023', null, 'CA-4: set_consent(terms_and_privacy) gives 22023'
);
select throws_ok(
  $$ select public.set_consent('usage_analytics', null) $$, '22023', null, 'set_consent with a null choice gives 22023'
);
select throws_ok(
  $$ select public.set_consent('usage_analytics', true, 'update') $$, '22023', null, 'set_consent with source update gives 22023'
);
select lives_ok(
  $$ select public.set_consent('assistant_questions', true, 'first_use') $$, '«Prima di fare domande»: assistant_questions with first_use'
);
select results_eq(
  $$ select c.source::text, c.terms_version_id, c.privacy_version_id from public.consent_records c where c.kind = 'assistant_questions' $$,
  $$ values ('first_use', 'd5130000-0000-4000-8000-000000000002'::uuid, 'd5130000-0000-4000-8000-000000000003'::uuid) $$,
  'an optional consent keeps the versions in force'
);

-- ---------------------------------------------------------------------------
-- CA-7: rows and versions are not writable from the app
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ update public.consent_records set granted = true where user_id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  '42501', null, 'CA-7: Marco cannot change his consents'
);
select throws_ok(
  $$ delete from public.consent_records where user_id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  '42501', null, 'CA-7: Marco cannot delete his consents'
);
select throws_ok(
  $$ insert into public.consent_records (user_id, kind, granted, source)
     values ('aaaaaaaa-0000-4000-8000-000000000001', 'usage_analytics', true, 'settings') $$,
  '42501', null, 'CA-7: Marco cannot insert a consent directly'
);
select throws_ok(
  $$ insert into public.legal_document_versions (document, effective_from) values ('terms', '2026-12-01') $$,
  '42501', null, 'CA-7: Marco cannot insert a version'
);
select throws_ok(
  $$ update public.legal_document_versions set notify_users = true $$,
  '42501', null, 'CA-7: Marco cannot change a version'
);
select throws_ok(
  $$ delete from public.legal_document_versions $$,
  '42501', null, 'CA-7: Marco cannot delete a version'
);

-- ---------------------------------------------------------------------------
-- CA-30: the functions that write accept only POST
-- ---------------------------------------------------------------------------
set local request.method to 'GET';
select throws_ok(
  $$ select public.accept_required_consents('d5130000-0000-4000-8000-000000000002', 'd5130000-0000-4000-8000-000000000003', true) $$,
  'P0001', 'use POST', 'CA-30: accept_required_consents refuses GET'
);
select throws_ok($$ select public.set_consent('usage_analytics', true) $$, 'P0001', 'use POST', 'CA-30: set_consent refuses GET');
select throws_ok(
  $$ select public.mark_privacy_version_read('d5130000-0000-4000-8000-000000000003') $$,
  'P0001', 'use POST', 'CA-30: mark_privacy_version_read refuses GET'
);
set local request.method to 'PATCH';
select throws_ok($$ select public.set_consent('usage_analytics', true) $$, 'P0001', 'use POST', 'CA-30: set_consent refuses PATCH');
set local request.method to 'HEAD';
select throws_ok(
  $$ select public.accept_required_consents(null, null, true) $$, 'P0001', 'use POST', 'CA-30: accept_required_consents refuses HEAD'
);
set local request.method to 'DELETE';
select throws_ok(
  $$ select public.mark_privacy_version_read(null) $$, 'P0001', 'use POST', 'CA-30: mark_privacy_version_read refuses DELETE'
);
set local request.method to 'GET';
select is(
  (select count(*)::integer from public.get_my_consents()),
  5,
  'the reads still answer with GET'
);
set local request.method to 'POST';
select is(
  (select count(*)::integer from public.consent_records c where c.user_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  5,
  'CA-30: nothing written by the refused methods'
);

-- ---------------------------------------------------------------------------
-- CA-6: the privacy notice changes
-- ---------------------------------------------------------------------------
select is_empty($$ select * from public.get_privacy_update() $$, 'CA-6: a version with a future date gives 0 rows');

reset role;
insert into public.legal_document_versions (id, document, effective_from, notify_users)
values ('d5130000-0000-4000-8000-000000000005', 'privacy', (now() at time zone 'Europe/Rome')::date, false);
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';

select is_empty($$ select * from public.get_privacy_update() $$, 'CA-6: a version of today with notify_users = false gives 0 rows');

reset role;
update public.legal_document_versions set notify_users = true where id = 'd5130000-0000-4000-8000-000000000005';
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';

select results_eq(
  $$ select u.privacy_version_id, u.effective_from from public.get_privacy_update() u $$,
  $$ values ('d5130000-0000-4000-8000-000000000005'::uuid, (now() at time zone 'Europe/Rome')::date) $$,
  'CA-6: with the notice of 2 November accepted, the version of today with notify_users gives one row'
);
select throws_ok(
  $$ select public.mark_privacy_version_read('d5130000-0000-4000-8000-000000000003') $$,
  '22023', null, 'mark_privacy_version_read with the old version gives 22023'
);
select throws_ok(
  $$ select public.mark_privacy_version_read('d5130000-0000-4000-8000-000000000004') $$,
  '22023', null, 'mark_privacy_version_read with the future version gives 22023'
);
select throws_ok(
  $$ select public.accept_required_consents('d5130000-0000-4000-8000-000000000002', 'd5130000-0000-4000-8000-000000000003', true) $$,
  '22023', null, 'CA-3: the version of 2 November is now old: 22023'
);
select lives_ok(
  $$ select public.mark_privacy_version_read('d5130000-0000-4000-8000-000000000005') $$,
  'CA-6: Marco reads the new notice'
);
select is_empty($$ select * from public.get_privacy_update() $$, 'CA-6: after mark_privacy_version_read, 0 rows');
select results_eq(
  $$ select c.kind::text, c.granted, c.terms_version_id, c.privacy_version_id, c.source::text
     from public.consent_records c where c.source = 'update' $$,
  $$ values ('terms_and_privacy', true, 'd5130000-0000-4000-8000-000000000002'::uuid,
             'd5130000-0000-4000-8000-000000000005'::uuid, 'update') $$,
  'rule 5: one terms_and_privacy row, source update, with the terms accepted before'
);
select results_eq(
  $$ select g.privacy_effective_from, g.required_ok from public.get_my_consents() g where g.kind = 'terms_and_privacy' $$,
  $$ values ((now() at time zone 'Europe/Rome')::date, true) $$,
  'get_my_consents() shows the new notice'
);

-- An adult who never accepted the terms: no update sheet (the page asks for the required
-- consents) and «Ho letto» is refused.
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select is_empty($$ select * from public.get_privacy_update() $$, 'rule 5: Giulia never accepted: no update row');
select throws_ok(
  $$ select public.mark_privacy_version_read('d5130000-0000-4000-8000-000000000005') $$,
  '22023', null, 'rule 5: Giulia never accepted: «Ho letto» gives 22023'
);

-- ---------------------------------------------------------------------------
-- CA-27, CA-28: isolation
-- ---------------------------------------------------------------------------
select is_empty($$ select 1 from public.consent_records $$, 'CA-27: Giulia (Casa Bianchi) reads 0 consents, none of Marco');
select is_empty(
  $$ select 1 from public.consent_records c where c.user_id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  'CA-27: Giulia reads 0 rows of Marco by id'
);
select results_eq(
  $$ select bool_or(g.granted), bool_or(g.decided_at is not null) from public.get_my_consents() g $$,
  $$ values (false, false) $$,
  'CA-27: get_my_consents() of Giulia shows nothing of Marco'
);
select lives_ok(
  $$ select public.set_consent('usage_analytics', true) $$, 'Giulia switches on her own usage_analytics'
);

-- Laura: same household as Marco.
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}';
select is_empty($$ select 1 from public.consent_records $$, 'Laura (same household) reads 0 consents of Marco');
select is_empty($$ select * from public.get_privacy_update() $$, 'Laura gets no update row from the consents of Marco');
select lives_ok(
  $$ select public.accept_required_consents('d5130000-0000-4000-8000-000000000002', 'd5130000-0000-4000-8000-000000000005', true) $$,
  'Laura accepts the current versions'
);

-- Marco, administrator, and the consents of Laura and Giulia.
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select is_empty(
  $$ select 1 from public.consent_records c where c.user_id <> 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  'CA-28: Marco, administrator, reads 0 consents of Laura and of other households'
);
select is(
  (select count(*)::integer from public.consent_records),
  6,
  'Marco reads exactly his 6 rows'
);

-- ---------------------------------------------------------------------------
-- CA-29: anon
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok($$ select 1 from public.consent_records $$, '42501', null, 'CA-29: anon cannot read consent_records');
select throws_ok(
  $$ insert into public.consent_records (user_id, kind, granted, source)
     values ('aaaaaaaa-0000-4000-8000-000000000001', 'usage_analytics', true, 'settings') $$,
  '42501', null, 'CA-29: anon cannot write consent_records'
);
select is(
  (select count(*)::integer from public.legal_document_versions),
  5,
  'CA-29: anon reads the versions'
);
select is(
  (select count(*)::integer from public.get_legal_versions()),
  2,
  'CA-29: anon calls get_legal_versions()'
);
select throws_ok(
  $$ insert into public.legal_document_versions (document, effective_from) values ('terms', '2026-12-01') $$,
  '42501', null, 'CA-29: anon cannot write a version'
);
select throws_ok($$ select * from public.get_my_consents() $$, '42501', null, 'CA-29: anon cannot call get_my_consents');
select throws_ok($$ select * from public.get_privacy_update() $$, '42501', null, 'CA-29: anon cannot call get_privacy_update');
select throws_ok(
  $$ select public.accept_required_consents(null, null, true) $$, '42501', null, 'CA-29: anon cannot call accept_required_consents'
);
select throws_ok(
  $$ select public.set_consent('usage_analytics', true) $$, '42501', null, 'CA-29: anon cannot call set_consent'
);
select throws_ok(
  $$ select public.mark_privacy_version_read(null) $$, '42501', null, 'CA-29: anon cannot call mark_privacy_version_read'
);

-- ---------------------------------------------------------------------------
-- private.has_consent() (database owner)
-- ---------------------------------------------------------------------------
reset role;
select results_eq(
  $$ select private.has_consent('aaaaaaaa-0000-4000-8000-000000000001', 'usage_analytics'),
            private.has_consent('aaaaaaaa-0000-4000-8000-000000000001', 'assistant_questions'),
            private.has_consent('aaaaaaaa-0000-4000-8000-000000000001', 'product_news_email'),
            private.has_consent('bbbbbbbb-0000-4000-8000-000000000001', 'usage_analytics') $$,
  $$ values (false, true, false, true) $$,
  'rule 4: has_consent() follows the most recent decision; never decided is false'
);
select ok(
  not has_function_privilege('authenticated', 'private.has_consent(uuid, public.consent_kind)', 'execute')
  and not has_function_privilege('anon', 'private.has_consent(uuid, public.consent_kind)', 'execute'),
  'private.has_consent() is not executable by the API roles'
);

-- The rows go with the account.
delete from auth.users where id = 'e5130000-0000-4000-8000-000000000002';
select is_empty(
  $$ select 1 from public.consent_records c where c.user_id = 'e5130000-0000-4000-8000-000000000002' $$,
  'the consents are deleted with the account'
);

select * from finish();
rollback;
