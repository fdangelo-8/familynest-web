-- The jobs of the account more robust (issue #658):
-- 1. run_account_job() refuses an instant in the future (22023) and does nothing;
-- 2. the hourly job: an error on one account does not stop the other accounts, an error in
--    one step does not stop the other steps, and the errors are counted;
-- 3. invite_adult() takes the advisory lock of the household of the «in coppia» rules;
-- 4. has_consent_evidence_key(): service_role only, true or false, never the key.
-- Seed: B = Giulia (Casa Bianchi 2222…, organises), B2 = Paolo (Casa Bianchi, does not
-- organise, utente-b2@example.com), C = Chiara (no household), A = Marco.
-- The errors are forced with triggers created inside this test (rolled back). The HMAC key
-- of the Vault is a made-up value valid only inside this test, never a real key.
-- The dates are relative to today (Europe/Rome): never a fixed date (LEZIONI).
begin;
create extension if not exists pgtap with schema extensions;

select plan(40);

-- ---------------------------------------------------------------------------
-- 3. invite_adult() and the lock of the household
-- ---------------------------------------------------------------------------
select ok(
  (select position('pg_advisory_xact_lock(hashtextextended(v_household_id::text, 0))' in p.prosrc)
          between 1 and position('insert into public.household_members' in p.prosrc)
   from pg_proc p where p.oid = 'public.invite_adult(text, public.member_color)'::regprocedure),
  'invite_adult takes the lock of the household before adding the adult'
);
select ok(
  (select p.prosecdef and p.proconfig @> array['search_path=""']
   from pg_proc p where p.oid = 'public.invite_adult(text, public.member_color)'::regprocedure),
  'invite_adult is still security definer with an empty search_path'
);
select ok(
  has_function_privilege('authenticated', 'public.invite_adult(text, public.member_color)', 'execute')
  and not has_function_privilege('anon', 'public.invite_adult(text, public.member_color)', 'execute'),
  'invite_adult keeps its grants'
);
select is_empty(
  $$ select 1 from pg_locks l
     where l.pid = pg_backend_pid() and l.locktype = 'advisory' and l.granted
       and ((l.classid::bigint << 32) | l.objid::bigint)
           = hashtextextended('22222222-2222-4222-8222-222222222222', 0) $$,
  'before the invitation the lock of Casa Bianchi is not held'
);

set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok(
  $$ select public.invite_adult('Nonna Rita', 'ceruleo') $$,
  '42501', null, 'who does not organise still gets 42501'
);
set local request.jwt.claims to '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select public.invite_adult('Nonna Rita', 'ceruleo') $$,
  '42501', null, 'who has no household still gets 42501'
);
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$ select public.invite_adult('Nonna Rita', 'ceruleo') $$, 'Giulia invites an adult');
reset role;

select isnt_empty(
  $$ select 1 from pg_locks l
     where l.pid = pg_backend_pid() and l.locktype = 'advisory' and l.granted
       and ((l.classid::bigint << 32) | l.objid::bigint)
           = hashtextextended('22222222-2222-4222-8222-222222222222', 0) $$,
  'after the invitation the transaction holds the lock of Casa Bianchi'
);
select results_eq(
  $$ select m.kind::text, m.user_id, i.status::text from public.household_members m
     join public.invitations i on i.member_id = m.id
     where m.household_id = '22222222-2222-4222-8222-222222222222' and m.name = 'Nonna Rita' $$,
  $$ values ('adult'::text, null::uuid, 'pending'::text) $$,
  'the adult without account and the pending invitation are there'
);

-- ---------------------------------------------------------------------------
-- 1. run_account_job() refuses an instant in the future
-- ---------------------------------------------------------------------------
insert into private.account_deletion_mails (email, deleted_on, created_at)
values ('recente@example.com', (now() at time zone 'Europe/Rome')::date, now() - interval '1 hour');

set local role service_role;
set local request.jwt.claims to '{"role":"service_role"}';
set local request.method to 'POST';
select throws_ok(
  $$ select public.run_account_job('mail_purge', now() + interval '73 hours') $$,
  '22023', 'the instant cannot be in the future', 'an instant 73 hours ahead gives 22023'
);
select throws_ok(
  $$ select public.run_account_job('deletions', now() + interval '1 second') $$,
  '22023', 'the instant cannot be in the future', 'one second ahead gives 22023'
);
select throws_ok(
  $$ select public.run_account_job('evidence_purge', 'infinity') $$,
  '22023', null, 'infinity still gives 22023'
);
select throws_ok(
  $$ select public.run_account_job('exports', null) $$,
  '22023', null, 'a null instant still gives 22023'
);
select is(public.run_account_job('mail_purge', now()), 0, 'now is accepted');
select is(public.run_account_job('mail_purge', now() - interval '1 day'), 0, 'an instant in the past is accepted');
select is(public.run_account_job('mail_purge'), 0, 'without an instant the job runs now');
reset role;
select results_eq(
  $$ select m.email from private.account_deletion_mails m $$,
  $$ values ('recente@example.com'::text) $$,
  'the refused calls did nothing: the address of one hour ago is still there'
);

-- ---------------------------------------------------------------------------
-- 2. The hourly job, one account and one step at a time
-- ---------------------------------------------------------------------------
select is(
  pg_get_function_result('private.run_scheduled_account_jobs(timestamptz)'::regprocedure), 'integer',
  'run_scheduled_account_jobs() returns the number of errors'
);
select is(
  pg_get_function_result('private.account_deletions(timestamptz)'::regprocedure),
  'record',
  'account_deletions() returns the deleted and the failed accounts'
);
select ok(
  not has_function_privilege('anon', 'private.run_scheduled_account_jobs(timestamptz)', 'execute')
  and not has_function_privilege('authenticated', 'private.run_scheduled_account_jobs(timestamptz)', 'execute')
  and not has_function_privilege('service_role', 'private.run_scheduled_account_jobs(timestamptz)', 'execute')
  and not has_function_privilege('anon', 'private.account_deletions(timestamptz)', 'execute')
  and not has_function_privilege('authenticated', 'private.account_deletions(timestamptz)', 'execute')
  and not has_function_privilege('service_role', 'private.account_deletions(timestamptz)', 'execute'),
  'the two functions created again are still for the database owner only'
);
select isnt_empty(
  $$ select 1 from cron.job j where j.jobname = 'account-jobs' and j.schedule = '7 * * * *'
     and j.command = 'select private.run_scheduled_account_jobs(now());' $$,
  'the pg_cron entry still calls the job every hour'
);

-- Paolo and Chiara asked to be deleted, their 14 days are over (delete_on = the day before
-- yesterday). Paolo comes first (order of user_id).
insert into private.account_deletion_requests (user_id, household_id, delete_on, deletes_household)
values
  ('bbbbbbbb-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222',
   (now() at time zone 'Europe/Rome')::date - 2, false),
  ('cccccccc-0000-4000-8000-000000000001', null, (now() at time zone 'Europe/Rome')::date - 2, false);

-- The proof of an account deleted more than 5 years ago, and an address of 73 hours ago.
insert into private.consent_evidence (subject_hmac, kind, granted, source, decided_at, account_deleted_on, purge_after)
values (decode(repeat('ab', 32), 'hex'), 'adult', true, 'signup', now() - interval '6 years',
        ((now() at time zone 'Europe/Rome')::date - 1 - interval '5 years')::date,
        (now() at time zone 'Europe/Rome')::date - 1);
insert into private.account_deletion_mails (email, deleted_on, created_at)
values ('vecchia@example.com', (now() at time zone 'Europe/Rome')::date - 3, now() - interval '73 hours');

-- Forced errors: the deletion of Paolo fails (his last-mail address cannot be written), and
-- the step exports fails as a whole.
create function pg_temp.fail_for_paolo()
returns trigger
language plpgsql
as $$
begin
  if new.email = 'utente-b2@example.com' then
    raise exception 'forced by the test' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger fail_for_paolo
  before insert on private.account_deletion_mails
  for each row execute function pg_temp.fail_for_paolo();

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

select is(
  private.run_scheduled_account_jobs(now()),
  2,
  'the hourly job counts 2 errors: the account of Paolo and the step exports'
);
select isnt_empty(
  $$ select 1 from auth.users u where u.id = 'bbbbbbbb-0000-4000-8000-000000000002' $$,
  'the account of Paolo is still there (its deletion was undone alone)'
);
select isnt_empty(
  $$ select 1 from private.account_deletion_requests r where r.user_id = 'bbbbbbbb-0000-4000-8000-000000000002' $$,
  'the request of Paolo stays for the next run'
);
select isnt_empty(
  $$ select 1 from public.household_members m where m.user_id = 'bbbbbbbb-0000-4000-8000-000000000002' $$,
  'Paolo is still a member of Casa Bianchi'
);
select is_empty(
  $$ select 1 from auth.users u where u.id = 'cccccccc-0000-4000-8000-000000000001' $$,
  'the error on Paolo does not stop the next account: Chiara is deleted'
);
select results_eq(
  $$ select m.email from private.account_deletion_mails m order by m.email $$,
  $$ values ('recente@example.com'::text), ('utente-c@example.com') $$,
  'the address of Chiara waits for the last mail; the one of 73 hours ago is purged after the failed step'
);
select is_empty(
  $$ select 1 from private.consent_evidence e where e.subject_hmac = decode(repeat('ab', 32), 'hex') $$,
  'the proof older than 5 years is purged after the failed step'
);

-- A second run tries Paolo again and fails again alone; through the RPC it deletes nobody.
select is(private.run_scheduled_account_jobs(now()), 2, 'a second run counts the same 2 errors');
set local role service_role;
set local request.jwt.claims to '{"role":"service_role"}';
select is(public.run_account_job('deletions', now()), 0, 'run_account_job deletions does not fail: it deletes 0 accounts');
reset role;
select results_eq(
  $$ select d.deleted, d.failed from private.account_deletions(now()) d $$,
  $$ values (0, 1) $$,
  'account_deletions() says 0 deleted and 1 failed'
);

-- Without the forced errors everything goes through.
drop trigger fail_for_paolo on private.account_deletion_mails;
drop trigger fail_always on public.data_exports;
select is(private.run_scheduled_account_jobs(now()), 0, 'without errors the job counts 0');
select is_empty(
  $$ select 1 from auth.users u where u.id = 'bbbbbbbb-0000-4000-8000-000000000002' $$,
  'the next run deletes Paolo'
);
select throws_ok(
  $$ select private.run_scheduled_account_jobs(null) $$, '22023', null, 'a null instant gives 22023'
);

-- ---------------------------------------------------------------------------
-- 4. has_consent_evidence_key(): true or false, never the key
-- ---------------------------------------------------------------------------
select is(
  pg_get_function_result('public.has_consent_evidence_key()'::regprocedure), 'boolean',
  'it returns only true or false'
);
select ok(
  (select p.prosecdef and p.proconfig @> array['search_path=""']
   from pg_proc p where p.oid = 'public.has_consent_evidence_key()'::regprocedure)
  and has_function_privilege('service_role', 'public.has_consent_evidence_key()', 'execute')
  and not has_function_privilege('authenticated', 'public.has_consent_evidence_key()', 'execute')
  and not has_function_privilege('anon', 'public.has_consent_evidence_key()', 'execute'),
  'security definer with an empty search_path, service_role only'
);

delete from vault.secrets s where s.name = 'consent_evidence_hmac_key';
set local role service_role;
set local request.jwt.claims to '{"role":"service_role"}';
select is(public.has_consent_evidence_key(), false, 'without the key in the Vault: false');
reset role;

select vault.create_secret('pgtap-only-not-a-real-key-658', 'consent_evidence_hmac_key', 'pgTAP only');
set local role service_role;
set local request.jwt.claims to '{"role":"service_role"}';
select is(public.has_consent_evidence_key(), true, 'with the key in the Vault: true');

set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($$ select public.has_consent_evidence_key() $$, '42501', null, 'authenticated cannot ask');
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok($$ select public.has_consent_evidence_key() $$, '42501', null, 'anon cannot ask');
reset role;

select * from finish();
rollback;
