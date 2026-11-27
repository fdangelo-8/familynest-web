-- The monitoring of the jobs of the account (issue #662):
-- 1. private.account_job_runs: written at the end of every run of the hourly job, in its own
--    sub-block; rows older than 30 days deleted; no API role reads or writes it;
-- 2. public.get_account_jobs_health(): service_role only, three true/false;
-- 3. find_consent_evidence() also with the previous keys of the Vault
--    (consent_evidence_hmac_key_previous_YYYYMMDD); the writing only with the active key;
--    no key ever comes out of a function;
-- 4. the pg_cron job that deletes the history of pg_cron older than 30 days (idempotent);
-- 5. invite_adult() reads the row of the caller with `for key share` before the advisory
--    lock of the household.
-- Seed: B = Giulia (Casa Bianchi 2222…, organises), B2 = Paolo (Casa Bianchi, does not
-- organise), C = Chiara (no household, utente-c@example.com).
-- The keys of the Vault are made-up values valid only inside this test (rolled back), never
-- real keys. The times are relative to now(): never a fixed date (LEZIONI).
begin;
create extension if not exists pgtap with schema extensions;

select plan(70);

-- ---------------------------------------------------------------------------
-- 1. private.account_job_runs
-- ---------------------------------------------------------------------------
select has_table('private', 'account_job_runs', 'private.account_job_runs exists');
select columns_are(
  'private', 'account_job_runs', array['id', 'ran_at', 'errors', 'has_key', 'created_at'],
  'account_job_runs has only the time, the errors and the key: no personal data'
);
select ok(
  (select c.relrowsecurity from pg_class c where c.oid = 'private.account_job_runs'::regclass),
  'RLS is on'
);
select is_empty(
  $$ select 1 from pg_policies p where p.schemaname = 'private' and p.tablename = 'account_job_runs' $$,
  'no policy: nobody reads it through RLS'
);
select ok(
  not has_table_privilege('anon', 'private.account_job_runs', 'select, insert, update, delete, truncate')
  and not has_table_privilege('authenticated', 'private.account_job_runs', 'select, insert, update, delete, truncate')
  and not has_table_privilege('service_role', 'private.account_job_runs', 'select, insert, update, delete, truncate'),
  'no privilege for anon, authenticated and service_role'
);
select has_index('private', 'account_job_runs', 'account_job_runs_ran_at_idx', 'index on ran_at');

delete from vault.secrets s where s.name like 'consent_evidence_hmac_key%';
delete from private.account_job_runs;

-- A run without the key and without errors.
select is(private.run_scheduled_account_jobs(now()), 0, 'a run without errors counts 0');
select results_eq(
  $$ select r.ran_at, r.errors, r.has_key from private.account_job_runs r $$,
  $$ values (now(), 0, false) $$,
  'the run is recorded: now, 0 errors, no key'
);

-- A run with the key and an error in one step.
select vault.create_secret('pgtap-only-active-key-662', 'consent_evidence_hmac_key', 'pgTAP only');
create function pg_temp.fail_always()
returns trigger
language plpgsql
as $$
begin
  raise exception 'forced by the test' using errcode = 'P0001';
end;
$$;
create trigger fail_always
  before update on public.data_exports
  for each statement execute function pg_temp.fail_always();
delete from private.account_job_runs;
select is(private.run_scheduled_account_jobs(now()), 1, 'a run with the step exports failed counts 1');
select results_eq(
  $$ select r.errors, r.has_key from private.account_job_runs r $$,
  $$ values (1, true) $$,
  'the run is recorded with 1 error and the key present'
);
drop trigger fail_always on public.data_exports;

-- Older than 30 days: deleted by the next run; 29 days: kept.
delete from private.account_job_runs;
insert into private.account_job_runs (ran_at, errors, has_key)
values (now() - interval '30 days 1 minute', 0, true), (now() - interval '29 days', 0, true);
select is(private.run_scheduled_account_jobs(now()), 0, 'the next run');
select results_eq(
  $$ select r.ran_at from private.account_job_runs r order by r.ran_at $$,
  $$ values (now() - interval '29 days'), (now()) $$,
  'the row older than 30 days is gone, the one of 29 days stays, the new run is there'
);

-- An error while recording does not stop the run: the steps are done, the error counts.
insert into private.account_deletion_mails (email, deleted_on, created_at)
values ('vecchia-662@example.com', (now() at time zone 'Europe/Rome')::date - 3, now() - interval '73 hours');
create trigger fail_always
  before insert on private.account_job_runs
  for each statement execute function pg_temp.fail_always();
delete from private.account_job_runs;
select lives_ok($$ select private.run_scheduled_account_jobs(now()) $$, 'a failed record does not stop the run');
select is(private.run_scheduled_account_jobs(now()), 1, 'the failed record counts as 1 error');
select is_empty(
  $$ select 1 from private.account_deletion_mails m where m.email = 'vecchia-662@example.com' $$,
  'the steps still ran: the address of 73 hours ago is purged'
);
select is_empty($$ select 1 from private.account_job_runs $$, 'the failed record wrote nothing');
drop trigger fail_always on private.account_job_runs;

-- The API roles cannot read or write the table.
set local role service_role;
set local request.jwt.claims to '{"role":"service_role"}';
select throws_ok($$ select * from private.account_job_runs $$, '42501', null, 'service_role cannot read it');
select throws_ok(
  $$ insert into private.account_job_runs (ran_at, errors, has_key) values (now(), 0, true) $$,
  '42501', null, 'service_role cannot write it'
);
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($$ select * from private.account_job_runs $$, '42501', null, 'authenticated cannot read it');
select throws_ok(
  $$ insert into private.account_job_runs (ran_at, errors, has_key) values (now(), 0, true) $$,
  '42501', null, 'authenticated cannot write it'
);
select throws_ok($$ delete from private.account_job_runs $$, '42501', null, 'authenticated cannot delete it');
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok($$ select * from private.account_job_runs $$, '42501', null, 'anon cannot read it');
reset role;

-- ---------------------------------------------------------------------------
-- 2. public.get_account_jobs_health()
-- ---------------------------------------------------------------------------
select is(
  pg_get_function_result('public.get_account_jobs_health()'::regprocedure),
  'TABLE(key_present boolean, repeated_errors boolean, not_running boolean)',
  'it returns only three true/false'
);
select ok(
  (select p.prosecdef and p.proconfig @> array['search_path=""']
   from pg_proc p where p.oid = 'public.get_account_jobs_health()'::regprocedure)
  and has_function_privilege('service_role', 'public.get_account_jobs_health()', 'execute')
  and not has_function_privilege('authenticated', 'public.get_account_jobs_health()', 'execute')
  and not has_function_privilege('anon', 'public.get_account_jobs_health()', 'execute'),
  'security definer with an empty search_path, service_role only'
);

-- No run at all.
delete from private.account_job_runs;
set local role service_role;
set local request.jwt.claims to '{"role":"service_role"}';
select results_eq(
  $$ select * from public.get_account_jobs_health() $$,
  $$ values (true, false, true) $$,
  'no run recorded: key present, no repeated errors, not running'
);
reset role;

-- One run 10 minutes ago with an error: a single error is not an alarm.
insert into private.account_job_runs (ran_at, errors, has_key) values (now() - interval '10 minutes', 4, true);
set local role service_role;
select results_eq(
  $$ select * from public.get_account_jobs_health() $$,
  $$ values (true, false, false) $$,
  'one run with errors 10 minutes ago: running, no alarm for the errors'
);
reset role;

-- Two runs with errors in a row: still no alarm.
insert into private.account_job_runs (ran_at, errors, has_key) values (now() - interval '70 minutes', 1, true);
set local role service_role;
select is((select h.repeated_errors from public.get_account_jobs_health() h), false, '2 runs with errors: no alarm');
reset role;

-- Three runs with errors in a row: alarm.
insert into private.account_job_runs (ran_at, errors, has_key) values (now() - interval '130 minutes', 2, true);
set local role service_role;
select results_eq(
  $$ select * from public.get_account_jobs_health() $$,
  $$ values (true, true, false) $$,
  '3 runs with errors in a row: repeated errors'
);
reset role;

-- A newer run without errors breaks the series.
insert into private.account_job_runs (ran_at, errors, has_key) values (now() - interval '1 minute', 0, true);
set local role service_role;
select is((select h.repeated_errors from public.get_account_jobs_health() h), false, 'the last run without errors: no alarm');
reset role;

-- An old run without errors does not count: only the last 3.
delete from private.account_job_runs r where r.ran_at = now() - interval '1 minute';
insert into private.account_job_runs (ran_at, errors, has_key) values (now() - interval '5 hours', 0, true);
set local role service_role;
select is((select h.repeated_errors from public.get_account_jobs_health() h), true, 'only the last 3 runs count');
reset role;

-- The last run more than 2 hours ago: not running; less than 2 hours: running.
delete from private.account_job_runs;
insert into private.account_job_runs (ran_at, errors, has_key) values (now() - interval '2 hours 1 minute', 0, true);
set local role service_role;
select is((select h.not_running from public.get_account_jobs_health() h), true, 'last run 2 hours and 1 minute ago: not running');
reset role;
insert into private.account_job_runs (ran_at, errors, has_key) values (now() - interval '1 hour 59 minutes', 0, true);
set local role service_role;
select is((select h.not_running from public.get_account_jobs_health() h), false, 'last run 1 hour and 59 minutes ago: running');
reset role;

-- The key is checked now, not from the last run.
delete from vault.secrets s where s.name = 'consent_evidence_hmac_key';
set local role service_role;
select is((select h.key_present from public.get_account_jobs_health() h), false, 'without the key in the Vault: key not present');
reset role;
select vault.create_secret('pgtap-only-active-key-662', 'consent_evidence_hmac_key', 'pgTAP only');

set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($$ select * from public.get_account_jobs_health() $$, '42501', null, 'authenticated cannot ask');
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok($$ select * from public.get_account_jobs_health() $$, '42501', null, 'anon cannot ask');
reset role;

-- ---------------------------------------------------------------------------
-- 3. The proof of the consents with the previous keys
-- ---------------------------------------------------------------------------
select vault.create_secret('pgtap-only-previous-key-662', 'consent_evidence_hmac_key_previous_20261101', 'pgTAP only');
select vault.create_secret('pgtap-only-older-key-662', 'consent_evidence_hmac_key_previous_20250101', 'pgTAP only');
select vault.create_secret('pgtap-only-wrong-name-662', 'consent_evidence_hmac_key_old', 'pgTAP only');

-- One proof saved with each key (the pseudonyms computed here independently).
insert into private.consent_evidence (subject_hmac, kind, granted, source, decided_at, account_deleted_on, purge_after)
select extensions.hmac(convert_to('reclamo-662@example.com', 'UTF8'), convert_to(k.key, 'UTF8'), 'sha256'),
       k.kind::public.consent_kind, true, 'signup', now() - k.age, (now() at time zone 'Europe/Rome')::date,
       ((now() at time zone 'Europe/Rome')::date + interval '5 years')::date
from (values
  ('pgtap-only-active-key-662', 'terms_and_privacy', interval '1 day'),
  ('pgtap-only-previous-key-662', 'adult', interval '2 days'),
  ('pgtap-only-older-key-662', 'usage_analytics', interval '3 days'),
  ('pgtap-only-wrong-name-662', 'product_news_email', interval '4 days')
) as k(key, kind, age);

select results_eq(
  $$ select f.kind::text from private.find_consent_evidence('  Reclamo-662@EXAMPLE.com ') f $$,
  $$ values ('usage_analytics'::text), ('adult'), ('terms_and_privacy') $$,
  'the lookup finds the proofs of the active key and of every previous key, not of a secret with another name'
);
select is(
  (select count(*)::integer from private.find_consent_evidence('nessuno-662@example.com')), 0,
  'another address finds nothing'
);

-- The writing uses only the active key.
select is(
  private.consent_subject_hmac('reclamo-662@example.com'),
  extensions.hmac(convert_to('reclamo-662@example.com', 'UTF8'), convert_to('pgtap-only-active-key-662', 'UTF8'), 'sha256'),
  'the pseudonym for the writing is the one of the active key'
);
insert into public.legal_document_versions (id, document, effective_from)
values
  ('d6620000-0000-4000-8000-000000000c01', 'terms', (now() at time zone 'Europe/Rome')::date - 30),
  ('d6620000-0000-4000-8000-000000000c02', 'privacy', (now() at time zone 'Europe/Rome')::date - 30);
insert into public.consent_records (user_id, kind, granted, terms_version_id, privacy_version_id, source, created_at)
values ('cccccccc-0000-4000-8000-000000000001', 'terms_and_privacy', true, 'd6620000-0000-4000-8000-000000000c01',
        'd6620000-0000-4000-8000-000000000c02', 'signup', now() - interval '10 days');
select ok(private.delete_account('cccccccc-0000-4000-8000-000000000001', now()), 'the account of Chiara is deleted');
select results_eq(
  $$ select e.subject_hmac from private.consent_evidence e where e.terms_version_id = 'd6620000-0000-4000-8000-000000000c01' $$,
  $$ values (extensions.hmac(convert_to('utente-c@example.com', 'UTF8'), convert_to('pgtap-only-active-key-662', 'UTF8'), 'sha256')) $$,
  'the proof of Chiara is written with the active key only'
);
select is(
  (select count(*)::integer from private.find_consent_evidence('utente-c@example.com')), 1,
  'and it is found'
);

-- Without the active key the lookup refuses, even with previous keys.
delete from vault.secrets s where s.name = 'consent_evidence_hmac_key';
select throws_ok(
  $$ select * from private.find_consent_evidence('reclamo-662@example.com') $$, '22023', null,
  'without the active key: 22023 (the lookup would miss the newest proofs)'
);
select is(private.consent_subject_hmac('reclamo-662@example.com'), null, 'a previous key is never used to write');
select vault.create_secret('pgtap-only-active-key-662', 'consent_evidence_hmac_key', 'pgTAP only');

-- No key comes out of a function.
select is(
  pg_get_function_result('private.previous_consent_subject_hmacs(text)'::regprocedure), 'bytea[]',
  'the previous keys give only pseudonyms'
);
select ok(
  not exists (
    select 1
    from private.find_consent_evidence('reclamo-662@example.com') f
    where row(f.*)::text ~ 'pgtap-only'
  )
  and not exists (
    select 1 from public.get_account_jobs_health() h where row(h.*)::text ~ 'pgtap-only'
  )
  and not exists (
    select 1
    from unnest(private.previous_consent_subject_hmacs('reclamo-662@example.com')) h
    where position(convert_to('pgtap-only', 'UTF8') in h) > 0
  ),
  'no result contains the value of a key'
);
select is(
  cardinality(private.previous_consent_subject_hmacs('reclamo-662@example.com')), 2,
  'two previous keys (the secret with another name is ignored)'
);
select is(
  cardinality(private.previous_consent_subject_hmacs('   ')), 0,
  'no address: no pseudonym'
);
select ok(
  not has_function_privilege('service_role', 'private.find_consent_evidence(text)', 'execute')
  and not has_function_privilege('authenticated', 'private.find_consent_evidence(text)', 'execute')
  and not has_function_privilege('anon', 'private.find_consent_evidence(text)', 'execute')
  and not has_function_privilege('service_role', 'private.previous_consent_subject_hmacs(text)', 'execute')
  and not has_function_privilege('authenticated', 'private.previous_consent_subject_hmacs(text)', 'execute')
  and not has_function_privilege('anon', 'private.previous_consent_subject_hmacs(text)', 'execute')
  and not has_function_privilege('service_role', 'private.consent_hmac(text, text)', 'execute')
  and not has_function_privilege('authenticated', 'private.consent_hmac(text, text)', 'execute')
  and not has_function_privilege('anon', 'private.consent_hmac(text, text)', 'execute')
  and not has_function_privilege('service_role', 'private.consent_subject_hmac(text)', 'execute')
  and not has_function_privilege('authenticated', 'private.consent_subject_hmac(text)', 'execute'),
  'the functions of the keys are for the database owner only'
);
set local role service_role;
set local request.jwt.claims to '{"role":"service_role"}';
select throws_ok(
  $$ select private.previous_consent_subject_hmacs('reclamo-662@example.com') $$, '42501', null,
  'service_role cannot compute the pseudonyms of the previous keys'
);
select throws_ok(
  $$ select * from private.find_consent_evidence('reclamo-662@example.com') $$, '42501', null,
  'service_role cannot look up the proof'
);
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select private.consent_hmac('reclamo-662@example.com', 'x') $$, '42501', null,
  'authenticated cannot compute a pseudonym'
);
reset role;

-- ---------------------------------------------------------------------------
-- 4. The history of pg_cron
-- ---------------------------------------------------------------------------
select results_eq(
  $$ select j.schedule, j.command from cron.job j where j.jobname = 'purge-cron-history' $$,
  $$ values ('27 3 * * *'::text, 'select private.purge_cron_job_run_details(now());'::text) $$,
  'one pg_cron entry deletes the history every day'
);

-- Scheduling again (the block of the migration) leaves one entry.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'purge-cron-history') then
    perform cron.unschedule('purge-cron-history');
  end if;
end;
$$;
select cron.schedule('purge-cron-history', '27 3 * * *', 'select private.purge_cron_job_run_details(now());');
select is(
  (select count(*)::integer from cron.job j where j.jobname = 'purge-cron-history'), 1,
  'scheduling it again leaves one entry'
);

delete from cron.job_run_details;
insert into cron.job_run_details (jobid, runid, database, username, command, status, start_time, end_time)
select j.jobid, x.runid, 'postgres', 'postgres', 'select 1', 'succeeded', x.start_time, x.end_time
from cron.job j
cross join (values
  (966201::bigint, now() - interval '31 days', now() - interval '31 days'),
  (966202::bigint, now() - interval '40 days', null::timestamptz),
  (966203::bigint, now() - interval '30 days 1 minute', now() - interval '29 days 23 hours'),
  (966204::bigint, now() - interval '1 hour', now() - interval '1 hour'),
  (966205::bigint, now() - interval '1 minute', null::timestamptz)
) as x(runid, start_time, end_time)
where j.jobname = 'account-jobs';

select is(private.purge_cron_job_run_details(now()), 2, 'the purge deletes the 2 rows older than 30 days');
select results_eq(
  $$ select d.runid from cron.job_run_details d order by d.runid $$,
  $$ values (966203::bigint), (966204::bigint), (966205::bigint) $$,
  'the rows of the last 30 days stay (also one still running)'
);
select is(private.purge_cron_job_run_details(now()), 0, 'running it again deletes nothing more');
select throws_ok(
  $$ select private.purge_cron_job_run_details(null) $$, '22023', null, 'a null instant gives 22023'
);
select ok(
  not has_function_privilege('service_role', 'private.purge_cron_job_run_details(timestamptz)', 'execute')
  and not has_function_privilege('authenticated', 'private.purge_cron_job_run_details(timestamptz)', 'execute')
  and not has_function_privilege('anon', 'private.purge_cron_job_run_details(timestamptz)', 'execute'),
  'the purge is for the database owner only'
);

-- ---------------------------------------------------------------------------
-- 5. invite_adult(): the row of the caller, then the household
-- ---------------------------------------------------------------------------
select ok(
  (select position('for key share' in p.prosrc)
          between 1 and position('pg_advisory_xact_lock(hashtextextended(v_household_id::text, 0))' in p.prosrc)
   from pg_proc p where p.oid = 'public.invite_adult(text, public.member_color)'::regprocedure),
  'invite_adult locks the row of the caller (for key share) before the lock of the household'
);
select ok(
  (select position('pg_advisory_xact_lock(hashtextextended(v_household_id::text, 0))' in p.prosrc)
          between 1 and position('and m.is_admin' in p.prosrc)
   from pg_proc p where p.oid = 'public.invite_adult(text, public.member_color)'::regprocedure),
  'the role is checked after the lock of the household'
);
select ok(
  (select p.prosecdef and p.proconfig @> array['search_path=""']
   from pg_proc p where p.oid = 'public.invite_adult(text, public.member_color)'::regprocedure)
  and has_function_privilege('authenticated', 'public.invite_adult(text, public.member_color)', 'execute')
  and not has_function_privilege('anon', 'public.invite_adult(text, public.member_color)', 'execute')
  and not has_function_privilege('service_role', 'public.invite_adult(text, public.member_color)', 'execute'),
  'invite_adult keeps security definer, the empty search_path and its grants'
);

set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok(
  $$ select public.invite_adult('Nonna Rita', 'ceruleo') $$, '42501', null, 'who does not organise gets 42501'
);
set local request.jwt.claims to '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select public.invite_adult('Nonna Rita', 'ceruleo') $$, '42501', null, 'who has no account or household gets 42501'
);
set local request.jwt.claims to '{"role":"anon"}';
set local role anon;
select throws_ok(
  $$ select public.invite_adult('Nonna Rita', 'ceruleo') $$, '42501', null, 'anon cannot invite'
);
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select public.invite_adult('   ', 'ceruleo') $$, '22023', null, 'an empty name still gives 22023'
);
select lives_ok($$ select public.invite_adult('Nonna  Rita', 'ceruleo') $$, 'Giulia invites an adult');
reset role;

select results_eq(
  $$ select m.kind::text, m.user_id, i.status::text, i.invited_by_member_id from public.household_members m
     join public.invitations i on i.member_id = m.id
     where m.household_id = '22222222-2222-4222-8222-222222222222' and m.name = 'Nonna Rita' $$,
  $$ values ('adult'::text, null::uuid, 'pending'::text, 'b1000000-0000-4000-8000-000000000001'::uuid) $$,
  'the adult without account and the pending invitation of Giulia are there'
);
select isnt_empty(
  $$ select 1 from pg_locks l
     where l.pid = pg_backend_pid() and l.locktype = 'advisory' and l.granted
       and ((l.classid::bigint << 32) | l.objid::bigint)
           = hashtextextended('22222222-2222-4222-8222-222222222222', 0) $$,
  'the transaction holds the lock of Casa Bianchi'
);

-- The role taken away (by the owner) counts: it is read after the lock.
update public.household_members set is_admin = true where id = 'b1000000-0000-4000-8000-000000000002';
update public.household_members set is_admin = false where id = 'b1000000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select public.invite_adult('Zio Carlo', 'glicine') $$, '42501', null, 'without the role any more: 42501'
);
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok($$ select public.invite_adult('Zio Carlo', 'glicine') $$, 'Paolo, who now organises, invites');
reset role;

select * from finish();
rollback;
