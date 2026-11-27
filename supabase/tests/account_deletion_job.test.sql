-- The real deletion of an account (issue #513, DB-4 part 2: CA-17 – CA-20, CA-31, and the
-- proof of the consents of decision B of 27/11: CA-17b, CA-17c, CA-26b, CA-29b):
-- run_account_job() with deletions, mail_purge and evidence_purge,
-- take_account_deletion_mails(), private.delete_account() shared with delete_own_account(),
-- private.consent_evidence and private.find_consent_evidence(), the pg_cron entry.
-- Seed ids: Casa D'Angelo 1111…: Marco (admin, aaaaaaaa…01, utente-a@example.com, member
-- a1…01), Laura (a1…02), Sofia, Tommaso, Biscotto; shopping items of Marco a3…01 – a3…04.
-- Casa Bianchi 2222…: Giulia (admin, bbbbbbbb…01), Paolo (bbbbbbbb…02), Leo, Anna (adult
-- without account). Chiara (cccccccc…01, no household).
-- Created here: Laura's account (aaaaaaaa…02), two published versions of the documents, Ugo
-- (dddddddd…11) and Vera (dddddddd…12), and the HMAC key of the Vault: a made-up value valid
-- only inside this test (rolled back), never a real key.
-- The dates are relative to today (Europe/Rome): never a date in the past (LEZIONI).
begin;
create extension if not exists pgtap with schema extensions;

select plan(67);

-- ---------------------------------------------------------------------------
-- Setup (as database owner)
-- ---------------------------------------------------------------------------
select vault.create_secret('pgtap-only-not-a-real-key-513', 'consent_evidence_hmac_key', 'pgTAP only');

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-4000-8000-000000000002', 'authenticated',
   'authenticated', 'utente-laura@example.com', '{"full_name":"Laura Test"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'dddddddd-0000-4000-8000-000000000011', 'authenticated',
   'authenticated', 'utente-ugo@example.com', '{"full_name":"Ugo Test"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'dddddddd-0000-4000-8000-000000000012', 'authenticated',
   'authenticated', 'utente-vera@example.com', '{"full_name":"Vera Test"}', now(), now());
update public.household_members
set user_id = 'aaaaaaaa-0000-4000-8000-000000000002', joined_at = now() - interval '10 days'
where id = 'a1000000-0000-4000-8000-000000000002';

insert into public.legal_document_versions (id, document, effective_from)
values
  ('d5130000-0000-4000-8000-000000000c01', 'terms', (now() at time zone 'Europe/Rome')::date - 30),
  ('d5130000-0000-4000-8000-000000000c02', 'privacy', (now() at time zone 'Europe/Rome')::date - 30);

-- Four consents of Marco, two of Paolo, one of Giulia.
insert into public.consent_records (user_id, kind, granted, terms_version_id, privacy_version_id, source, created_at)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'terms_and_privacy', true, 'd5130000-0000-4000-8000-000000000c01',
   'd5130000-0000-4000-8000-000000000c02', 'signup', now() - interval '20 days'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'adult', true, 'd5130000-0000-4000-8000-000000000c01',
   'd5130000-0000-4000-8000-000000000c02', 'signup', now() - interval '20 days'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'product_news_email', false, 'd5130000-0000-4000-8000-000000000c01',
   'd5130000-0000-4000-8000-000000000c02', 'signup', now() - interval '20 days'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'usage_analytics', true, 'd5130000-0000-4000-8000-000000000c01',
   'd5130000-0000-4000-8000-000000000c02', 'settings', now() - interval '3 days'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'terms_and_privacy', true, null, null, 'signup', now() - interval '9 days'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'adult', true, null, null, 'signup', now() - interval '9 days'),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'terms_and_privacy', true, null, null, 'signup', now() - interval '9 days');

-- CA-18: a «Tutto il Nest» event and a «Occupato» event of Marco (the shopping items of the
-- seed are his too).
insert into public.events (id, household_id, author_member_id, title, starts_at, ends_at, visibility)
values
  ('d5130000-0000-4000-8000-000000000e01', '11111111-1111-4111-8111-111111111111',
   'a1000000-0000-4000-8000-000000000001', 'Festa di Sofia', now() + interval '20 days',
   now() + interval '20 days 3 hours', 'household'),
  ('d5130000-0000-4000-8000-000000000e02', '11111111-1111-4111-8111-111111111111',
   'a1000000-0000-4000-8000-000000000001', 'Visita', now() + interval '21 days',
   now() + interval '21 days 1 hour', 'busy');

-- An export of Marco, ready, with its file (path <user_id>/<export_id>.zip).
insert into public.data_exports (id, user_id, status, requested_at, ready_at, expires_at, size_bytes)
values ('d5130000-0000-4000-8000-000000000f01', 'aaaaaaaa-0000-4000-8000-000000000001', 'ready', now(), now(),
        now() + interval '24 hours', 1200000);
insert into storage.objects (bucket_id, name)
values ('data-exports', 'aaaaaaaa-0000-4000-8000-000000000001/d5130000-0000-4000-8000-000000000f01.zip');

-- Marco (only administrator, Laura has an account) asks to delete the account.
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select set_config('test.delete_on', public.request_account_deletion(false)::text, true);
reset role;
-- #658: run_account_job() refuses an instant in the future, so the request is moved 16 days
-- back (delete_on = the day before yesterday) and every run below is at an instant in the past.
update private.account_deletion_requests r
set delete_on = r.delete_on - 16
where r.user_id = 'aaaaaaaa-0000-4000-8000-000000000001';
select set_config('test.delete_on', (current_setting('test.delete_on')::date - 16)::text, true);

-- ---------------------------------------------------------------------------
-- Schema and privileges
-- ---------------------------------------------------------------------------
select columns_are(
  'private', 'consent_evidence',
  array['id', 'subject_hmac', 'kind', 'granted', 'terms_version_id', 'privacy_version_id', 'source', 'decided_at',
        'account_deleted_on', 'purge_after', 'created_at'],
  'CA-17b: the proof has no column with the address, the name or the user_id'
);
select columns_are(
  'private', 'account_deletion_mails', array['id', 'email', 'deleted_on', 'created_at'],
  'the last mail keeps only the address and the day'
);
select ok(
  (select bool_and(c.relrowsecurity) from pg_class c
   where c.oid in ('private.consent_evidence'::regclass, 'private.account_deletion_mails'::regclass,
                   'private.data_export_leftovers'::regclass)),
  'RLS is enabled on the private tables'
);
select ok(
  not has_function_privilege('anon', 'public.run_account_job(public.account_job, timestamptz)', 'execute')
  and not has_function_privilege('authenticated', 'public.run_account_job(public.account_job, timestamptz)', 'execute')
  and has_function_privilege('service_role', 'public.run_account_job(public.account_job, timestamptz)', 'execute'),
  'rule 13: run_account_job() only for service_role'
);
select ok(
  not has_function_privilege('anon', 'public.take_account_deletion_mails(integer)', 'execute')
  and not has_function_privilege('authenticated', 'public.take_account_deletion_mails(integer)', 'execute')
  and has_function_privilege('service_role', 'public.take_account_deletion_mails(integer)', 'execute'),
  'rule 11: take_account_deletion_mails() only for service_role'
);
select enum_has_labels(
  'public', 'account_job', array['deletions', 'exports', 'mail_purge', 'evidence_purge'], 'account_job labels'
);
select isnt_empty(
  $$ select 1 from cron.job j where j.jobname = 'account-jobs' and j.schedule = '7 * * * *'
     and j.command = 'select private.run_scheduled_account_jobs(now());' $$,
  'rule 10: the jobs run every hour'
);
select ok(
  (select p.prosrc ~ 'private\.delete_account\(' from pg_proc p where p.oid = 'public.delete_own_account(boolean)'::regprocedure)
  and (select p.prosrc ~ 'private\.delete_account\(' from pg_proc p where p.oid = 'private.account_deletions(timestamptz)'::regprocedure),
  'CA-31: delete_own_account() and the job use the same private function'
);

-- ---------------------------------------------------------------------------
-- CA-17: not before 00:00 of the day after delete_on
-- ---------------------------------------------------------------------------
select is(
  public.run_account_job('deletions', (current_setting('test.delete_on')::date + time '23:00') at time zone 'Europe/Rome'),
  0,
  'CA-17: at 23:00 of delete_on the job deletes nobody'
);
select isnt_empty(
  $$ select 1 from auth.users u where u.id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  'CA-17: the account of Marco still exists'
);
select is(
  public.run_account_job('deletions', (current_setting('test.delete_on')::date + 1 + time '00:30') at time zone 'Europe/Rome'),
  1,
  'CA-17: at 00:30 of the day after the job deletes Marco'
);
select is(
  public.run_account_job('deletions', (current_setting('test.delete_on')::date + 1 + time '01:30') at time zone 'Europe/Rome'),
  0,
  'the job runs again without doing anything twice'
);
select is_empty($$ select 1 from auth.users u where u.id = 'aaaaaaaa-0000-4000-8000-000000000001' $$, 'CA-17: no auth.users row');
select is_empty($$ select 1 from auth.sessions s where s.user_id = 'aaaaaaaa-0000-4000-8000-000000000001' $$, 'CA-17: no session');
select is_empty($$ select 1 from public.profiles p where p.id = 'aaaaaaaa-0000-4000-8000-000000000001' $$, 'CA-17: no profile');
select is_empty(
  $$ select 1 from public.household_members m where m.user_id = 'aaaaaaaa-0000-4000-8000-000000000001'
     or m.id = 'a1000000-0000-4000-8000-000000000001' $$,
  'CA-17: no member row'
);
select is_empty(
  $$ select 1 from public.consent_records c where c.user_id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  'CA-17b: no row in consent_records'
);
select is_empty($$ select 1 from public.data_exports e where e.user_id = 'aaaaaaaa-0000-4000-8000-000000000001' $$, 'CA-17: no export');
select is_empty(
  $$ select 1 from private.account_deletion_requests r where r.user_id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  'the request is gone with the account'
);
select results_eq(
  $$ select h.id, m.name, m.is_admin from public.households h
     join public.household_members m on m.household_id = h.id and m.user_id is not null
     where h.id = '11111111-1111-4111-8111-111111111111' $$,
  $$ values ('11111111-1111-4111-8111-111111111111'::uuid, 'Laura'::text, true) $$,
  'CA-17: the household stays, Laura organises it'
);
select results_eq(
  $$ select m.email, m.deleted_on from private.account_deletion_mails m $$,
  $$ values ('utente-a@example.com'::text, current_setting('test.delete_on')::date + 1) $$,
  'CA-17: the address of Marco waits for the last mail'
);

-- CA-18: shared things stay without author; «Occupato» goes.
select results_eq(
  $$ select e.id, e.author_member_id from public.events e where e.id in ('d5130000-0000-4000-8000-000000000e01',
     'd5130000-0000-4000-8000-000000000e02') $$,
  $$ values ('d5130000-0000-4000-8000-000000000e01'::uuid, null::uuid) $$,
  'CA-18: the «Tutto il Nest» event stays with author null, the «Occupato» one is gone'
);
select results_eq(
  $$ select s.added_by_member_id from public.shopping_items s where s.id = 'a3000000-0000-4000-8000-000000000001' $$,
  $$ values (null::uuid) $$,
  'CA-18: the thing of the shopping list stays with author null'
);

-- CA-17b: the proof of the consents.
select results_eq(
  $$ select e.kind::text, e.granted, e.terms_version_id, e.privacy_version_id, e.source::text, e.decided_at,
            e.account_deleted_on, e.purge_after
     from private.consent_evidence e
     where e.subject_hmac = extensions.hmac(convert_to('utente-a@example.com', 'UTF8'),
                                            convert_to('pgtap-only-not-a-real-key-513', 'UTF8'), 'sha256')
     order by e.decided_at, e.kind $$,
  $$ values
       ('terms_and_privacy', true, 'd5130000-0000-4000-8000-000000000c01'::uuid, 'd5130000-0000-4000-8000-000000000c02'::uuid,
        'signup', now() - interval '20 days', current_setting('test.delete_on')::date + 1,
        (current_setting('test.delete_on')::date + 1 + interval '5 years')::date),
       ('adult', true, 'd5130000-0000-4000-8000-000000000c01'::uuid, 'd5130000-0000-4000-8000-000000000c02'::uuid,
        'signup', now() - interval '20 days', current_setting('test.delete_on')::date + 1,
        (current_setting('test.delete_on')::date + 1 + interval '5 years')::date),
       ('product_news_email', false, 'd5130000-0000-4000-8000-000000000c01'::uuid, 'd5130000-0000-4000-8000-000000000c02'::uuid,
        'signup', now() - interval '20 days', current_setting('test.delete_on')::date + 1,
        (current_setting('test.delete_on')::date + 1 + interval '5 years')::date),
       ('usage_analytics', true, 'd5130000-0000-4000-8000-000000000c01'::uuid, 'd5130000-0000-4000-8000-000000000c02'::uuid,
        'settings', now() - interval '3 days', current_setting('test.delete_on')::date + 1,
        (current_setting('test.delete_on')::date + 1 + interval '5 years')::date) $$,
  'CA-17b: 4 rows with the HMAC of the address, the versions, the source, the date and purge_after 5 years later'
);
select is(
  (select count(*)::integer from private.find_consent_evidence('  UTENTE-A@example.com ')),
  4,
  'the administrator of the database finds them from the address (lower case, without spaces)'
);
select is(
  (select count(*)::integer from private.find_consent_evidence('nessuno@example.com')), 0,
  'another address finds nothing'
);

-- The file of the deleted account is left to the server.
select results_eq(
  $$ select l.object_path from private.data_export_leftovers l $$,
  $$ values ('aaaaaaaa-0000-4000-8000-000000000001/d5130000-0000-4000-8000-000000000f01.zip'::text) $$,
  'the file of the export of Marco waits for the Storage API'
);
set local role service_role;
select results_eq(
  $$ select l.object_path from public.list_expired_data_exports(10) l $$,
  $$ values ('aaaaaaaa-0000-4000-8000-000000000001/d5130000-0000-4000-8000-000000000f01.zip'::text) $$,
  'list_expired_data_exports() gives it to the server'
);
reset role;

-- ---------------------------------------------------------------------------
-- CA-19: the only adult with deletes_household = true
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}';
select set_config('test.casa_neri', public.create_household('Casa Neri', 'single', 'Chiara', 'salvia')::text, true);
select lives_ok(
  $$ insert into public.household_members (household_id, kind, name, color)
     values (current_setting('test.casa_neri')::uuid, 'child', 'Nina', 'glicine') $$,
  'Chiara adds a child'
);
select lives_ok($$ select public.request_account_deletion(true) $$, 'Chiara asks to delete the account and the household');

set local request.jwt.claims to '{"sub":"dddddddd-0000-4000-8000-000000000011","role":"authenticated"}';
select set_config('test.casa_ugo', public.create_household('Casa Ugo', 'single', 'Ugo', 'salvia')::text, true);
select lives_ok($$ select public.request_account_deletion(true) $$, 'Ugo asks to delete the account and the household');
reset role;
-- Meanwhile Vera enters Casa Ugo with an account.
insert into public.household_members (household_id, kind, name, color, user_id, joined_at)
values (current_setting('test.casa_ugo')::uuid, 'adult', 'Vera', 'cobalto', 'dddddddd-0000-4000-8000-000000000012', now());

-- #658: their 14 days are moved back (delete_on = the day before yesterday), the job runs now.
update private.account_deletion_requests r
set delete_on = r.delete_on - 16
where r.user_id in ('cccccccc-0000-4000-8000-000000000001', 'dddddddd-0000-4000-8000-000000000011');

select is(
  public.run_account_job('deletions', now()),
  2,
  'the job deletes Chiara and Ugo'
);
select is_empty(
  $$ select 1 from public.households h where h.id = current_setting('test.casa_neri')::uuid $$,
  'CA-19: Casa Neri is gone'
);
select is_empty(
  $$ select 1 from public.household_members m where m.household_id = current_setting('test.casa_neri')::uuid $$,
  'CA-19: with all its members (Nina too)'
);
select results_eq(
  $$ select m.name, m.is_admin from public.household_members m where m.household_id = current_setting('test.casa_ugo')::uuid $$,
  $$ values ('Vera'::text, true) $$,
  'CA-19: Casa Ugo stays because Vera entered with an account, and she organises it'
);

-- ---------------------------------------------------------------------------
-- CA-20: the last mail
-- ---------------------------------------------------------------------------
delete from private.account_deletion_mails;
insert into private.account_deletion_mails (email, deleted_on, created_at)
values
  ('uno@example.com', (now() at time zone 'Europe/Rome')::date, now() - interval '2 hours'),
  ('due@example.com', (now() at time zone 'Europe/Rome')::date, now() - interval '1 hour');

set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($$ select * from public.take_account_deletion_mails(10) $$, '42501', null, 'CA-20: authenticated gets 42501');
select throws_ok($$ select public.run_account_job('deletions') $$, '42501', null, 'rule 13: authenticated cannot run a job');
select throws_ok($$ select 1 from private.account_deletion_mails $$, '42501', null, 'CA-29: authenticated cannot reach the mails');
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok($$ select * from public.take_account_deletion_mails(10) $$, '42501', null, 'CA-20: anon gets 42501');
select throws_ok($$ select public.run_account_job('deletions') $$, '42501', null, 'rule 13: anon cannot run a job');

set local role service_role;
set local request.jwt.claims to '{"role":"service_role"}';
set local request.method to 'GET';
select throws_ok($$ select * from public.take_account_deletion_mails(10) $$, 'P0001', 'use POST', 'CA-30: take refuses GET');
select throws_ok($$ select public.run_account_job('mail_purge') $$, 'P0001', 'use POST', 'CA-30: run_account_job refuses GET');
set local request.method to 'POST';
select throws_ok($$ select * from public.take_account_deletion_mails(0) $$, '22023', null, 'a limit of 0 gives 22023');
select throws_ok($$ select * from public.take_account_deletion_mails(51) $$, '22023', null, 'a limit of 51 gives 22023');
select throws_ok($$ select public.run_account_job(null) $$, '22023', null, 'a null job gives 22023');
select results_eq(
  $$ select m.email from public.take_account_deletion_mails(10) m $$,
  $$ values ('uno@example.com'::text), ('due@example.com') $$,
  'CA-20: the first call gets both, the oldest first'
);
select is_empty($$ select * from public.take_account_deletion_mails(10) $$, 'CA-20: the second call gets nothing');
select throws_ok($$ select 1 from private.consent_evidence $$, '42501', null, 'CA-29b: service_role cannot read the proof');
select throws_ok(
  $$ select * from private.find_consent_evidence('utente-a@example.com') $$, '42501', null,
  'CA-29b: service_role cannot look the proof up'
);
reset role;

insert into private.account_deletion_mails (email, deleted_on, created_at)
values
  ('vecchia@example.com', (now() at time zone 'Europe/Rome')::date - 3, now() - interval '73 hours'),
  ('recente@example.com', (now() at time zone 'Europe/Rome')::date - 2, now() - interval '71 hours');
select is(public.run_account_job('mail_purge', now()), 1, 'CA-20: mail_purge deletes one row');
select results_eq(
  $$ select m.email from private.account_deletion_mails m $$,
  $$ values ('recente@example.com'::text) $$,
  'CA-20: the row of 73 hours ago is gone, the one of 71 hours stays'
);

-- ---------------------------------------------------------------------------
-- CA-17c, CA-31: delete_own_account() deletes at once, with the same proof
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok($$ select public.delete_own_account(false) $$, 'CA-31: Paolo deletes the account at once');
reset role;
select is_empty($$ select 1 from auth.users u where u.id = 'bbbbbbbb-0000-4000-8000-000000000002' $$, 'CA-31: Paolo is gone');
select results_eq(
  $$ select e.kind::text, e.account_deleted_on, e.purge_after from private.consent_evidence e
     where e.subject_hmac = extensions.hmac(convert_to('utente-b2@example.com', 'UTF8'),
                                            convert_to('pgtap-only-not-a-real-key-513', 'UTF8'), 'sha256')
     order by e.kind $$,
  $$ values ('terms_and_privacy'::text, (now() at time zone 'Europe/Rome')::date,
             ((now() at time zone 'Europe/Rome')::date + interval '5 years')::date),
            ('adult', (now() at time zone 'Europe/Rome')::date,
             ((now() at time zone 'Europe/Rome')::date + interval '5 years')::date) $$,
  'CA-17c: delete_own_account() keeps the same proof'
);
select is_empty(
  $$ select 1 from private.account_deletion_mails m where m.email = 'utente-b2@example.com' $$,
  'delete_own_account() writes no last mail (the page is still open)'
);

-- Without the key in the Vault the account is deleted anyway and no proof is written.
delete from vault.secrets s where s.name = 'consent_evidence_hmac_key';
select is(private.consent_subject_hmac('utente-b@example.com'), null, 'without the key there is no HMAC');
select throws_ok(
  $$ select * from private.find_consent_evidence('utente-b@example.com') $$, '22023', null,
  'without the key the lookup gives 22023'
);
select set_config('test.evidence_before', (select count(*) from private.consent_evidence)::text, true);
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$ select public.delete_own_account(true) $$, 'CA-17c: Giulia deletes the account without the key');
reset role;
select is_empty($$ select 1 from auth.users u where u.id = 'bbbbbbbb-0000-4000-8000-000000000001' $$, 'CA-17c: Giulia is gone');
select is(
  (select count(*) from private.consent_evidence)::text, current_setting('test.evidence_before'),
  'CA-17c: no proof is written without the key'
);

-- ---------------------------------------------------------------------------
-- CA-26b: 5 years later the proof goes
-- ---------------------------------------------------------------------------
delete from private.consent_evidence;
insert into private.consent_evidence (subject_hmac, kind, granted, source, decided_at, account_deleted_on, purge_after)
values
  (decode(repeat('ab', 32), 'hex'), 'adult', true, 'signup', now() - interval '6 years',
   ((now() at time zone 'Europe/Rome')::date - 1 - interval '5 years')::date, (now() at time zone 'Europe/Rome')::date - 1),
  (decode(repeat('cd', 32), 'hex'), 'adult', true, 'signup', now() - interval '6 years',
   ((now() at time zone 'Europe/Rome')::date + 1 - interval '5 years')::date, (now() at time zone 'Europe/Rome')::date + 1);
select is(public.run_account_job('evidence_purge', now()), 1, 'CA-26b: evidence_purge deletes one row');
select results_eq(
  $$ select e.purge_after from private.consent_evidence e $$,
  $$ values ((now() at time zone 'Europe/Rome')::date + 1) $$,
  'CA-26b: purge_after of yesterday is gone, of tomorrow stays'
);
select throws_ok(
  $$ insert into private.consent_evidence (subject_hmac, kind, granted, source, decided_at, account_deleted_on, purge_after)
     values (decode(repeat('ef', 32), 'hex'), 'adult', true, 'signup', now(), current_date, current_date + 1) $$,
  '23514', null,
  'purge_after is always 5 years after the deletion'
);

-- ---------------------------------------------------------------------------
-- CA-29b: no API role reaches the proof
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok($$ select 1 from private.consent_evidence $$, '42501', null, 'CA-29b: authenticated cannot read the proof');
select throws_ok(
  $$ select * from private.find_consent_evidence('utente-a@example.com') $$, '42501', null,
  'CA-29b: authenticated cannot look the proof up'
);
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok($$ select 1 from private.consent_evidence $$, '42501', null, 'CA-29b: anon cannot read the proof');
select throws_ok(
  $$ select * from private.find_consent_evidence('utente-a@example.com') $$, '42501', null,
  'CA-29b: anon cannot look the proof up'
);
reset role;

select * from finish();
rollback;
