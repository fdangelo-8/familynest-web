-- update_calendar_account_credentials() (issue #331, for #329): the synchronisation service
-- saves the credentials renewed by the provider with a compare and swap. The state of the
-- account and the revocation queue never change. Only the administrative key may call it.
-- The administrative key comes first (lesson of #276, #287: a defect of the role shows only
-- when service_role is the first role that runs the function in the session).
-- Seed ids: Paolo (Casa Bianchi, user bbbbbbbb…02, member b1…02) has the fake Google account
-- e1…01 with credentials 'v1:seed.placeholder.not.a.credential.00000000'. Giulia
-- (bbbbbbbb…01) is the other adult of Casa Bianchi; Marco (aaaaaaaa…01) is in Casa D'Angelo.
begin;
create extension if not exists pgtap with schema extensions;

select plan(22);

-- ---------------------------------------------------------------------------
-- Schema and privileges
-- ---------------------------------------------------------------------------
select has_function(
  'public', 'update_calendar_account_credentials', array['uuid', 'text', 'text'],
  'update_calendar_account_credentials exists'
);
select function_returns(
  'public', 'update_calendar_account_credentials', array['uuid', 'text', 'text'], 'boolean',
  'update_calendar_account_credentials returns boolean'
);
select ok(
  (select p.prosecdef and p.proconfig @> array['search_path=""']
   from pg_proc p
   where p.oid = 'public.update_calendar_account_credentials(uuid, text, text)'::regprocedure),
  'security definer with an empty search_path'
);
select ok(
  has_function_privilege('service_role', 'public.update_calendar_account_credentials(uuid, text, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.update_calendar_account_credentials(uuid, text, text)', 'execute')
  and not has_function_privilege('anon', 'public.update_calendar_account_credentials(uuid, text, text)', 'execute'),
  'only service_role executes it'
);

-- A row of the revocation queue and a failing state, to show they do not change.
update public.calendar_accounts
set status = 'temporary_error', failing_since = '2026-11-09 08:00:00+00'
where id = 'e1000000-0000-4000-8000-000000000001';
do $$
begin
  perform set_config(
    'test.revocations_before',
    (select count(*)::text from public.calendar_credential_revocations),
    true
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- The administrative key
-- ---------------------------------------------------------------------------
set local role service_role;
set local request.jwt.claims to '{"role":"service_role"}';

select is(
  public.update_calendar_account_credentials(
    'e1000000-0000-4000-8000-000000000001',
    'v1:seed.placeholder.not.a.credential.00000000',
    'v1:test.placeholder.not.a.credential.renewed01'),
  true,
  'the current value matches: the credentials are replaced (true)'
);
select is(
  (select a.credentials_ciphertext from public.calendar_accounts a
   where a.id = 'e1000000-0000-4000-8000-000000000001'),
  'v1:test.placeholder.not.a.credential.renewed01',
  'the account has the renewed credentials'
);
select results_eq(
  $$ select a.status::text, a.failing_since from public.calendar_accounts a
     where a.id = 'e1000000-0000-4000-8000-000000000001' $$,
  $$ values ('temporary_error'::text, '2026-11-09 08:00:00+00'::timestamptz) $$,
  'the state of the account does not change'
);
select is(
  (select count(*)::integer from public.calendar_credential_revocations),
  current_setting('test.revocations_before')::integer,
  'nothing is queued for revocation'
);

-- A «Ricollega» in the meantime: the old value is no longer there.
select is(
  public.update_calendar_account_credentials(
    'e1000000-0000-4000-8000-000000000001',
    'v1:seed.placeholder.not.a.credential.00000000',
    'v1:test.placeholder.not.a.credential.stale0001'),
  false,
  'the current value is different: false'
);
select is(
  (select a.credentials_ciphertext from public.calendar_accounts a
   where a.id = 'e1000000-0000-4000-8000-000000000001'),
  'v1:test.placeholder.not.a.credential.renewed01',
  'the newer credentials are kept'
);
select is(
  public.update_calendar_account_credentials(
    'e1000000-0000-4000-8000-0000000000ff',
    'v1:seed.placeholder.not.a.credential.00000000',
    'v1:test.placeholder.not.a.credential.renewed02'),
  false,
  'an account that no longer exists: false'
);
select throws_ok(
  $$ select public.update_calendar_account_credentials(
       'e1000000-0000-4000-8000-000000000001',
       'v1:test.placeholder.not.a.credential.renewed01',
       'a-plain-refresh-token-that-is-not-encrypted') $$,
  '23514', null,
  'new credentials with an invalid format are refused'
);
select throws_ok(
  $$ select public.update_calendar_account_credentials(
       'e1000000-0000-4000-8000-000000000001', null,
       'v1:test.placeholder.not.a.credential.renewed02') $$,
  '22023', 'invalid credentials',
  'a missing previous value is refused'
);
select throws_ok(
  $$ select public.update_calendar_account_credentials(
       'e1000000-0000-4000-8000-000000000001',
       'v1:test.placeholder.not.a.credential.renewed01', null) $$,
  '22023', 'invalid credentials',
  'missing new credentials are refused'
);
select throws_ok(
  $$ select public.update_calendar_account_credentials(
       null, 'v1:test.placeholder.not.a.credential.renewed01',
       'v1:test.placeholder.not.a.credential.renewed02') $$,
  '22023', 'invalid credentials',
  'a missing account is refused'
);

set local request.method to 'GET';
select throws_ok(
  $$ select public.update_calendar_account_credentials(
       'e1000000-0000-4000-8000-000000000001',
       'v1:test.placeholder.not.a.credential.renewed01',
       'v1:test.placeholder.not.a.credential.renewed02') $$,
  'P0001', 'use POST',
  'only POST through the Data API'
);
set local request.method to 'POST';

reset role;

-- ---------------------------------------------------------------------------
-- authenticated: the adult of the account and an adult of another household
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok(
  $$ select public.update_calendar_account_credentials(
       'e1000000-0000-4000-8000-000000000001',
       'v1:test.placeholder.not.a.credential.renewed01',
       'v1:test.placeholder.not.a.credential.byowner01') $$,
  '42501', null,
  'the adult of the account cannot call it'
);

set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select public.update_calendar_account_credentials(
       'e1000000-0000-4000-8000-000000000001',
       'v1:test.placeholder.not.a.credential.renewed01',
       'v1:test.placeholder.not.a.credential.byother01') $$,
  '42501', null,
  'an adult of another household cannot call it'
);
select throws_ok(
  $$ update public.calendar_accounts set credentials_ciphertext = 'v1:test.placeholder.not.a.credential.byother02'
     where id = 'e1000000-0000-4000-8000-000000000001' $$,
  '42501', null,
  'nor write the credentials directly'
);
reset role;

-- ---------------------------------------------------------------------------
-- anon
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok(
  $$ select public.update_calendar_account_credentials(
       'e1000000-0000-4000-8000-000000000001',
       'v1:test.placeholder.not.a.credential.renewed01',
       'v1:test.placeholder.not.a.credential.byanon001') $$,
  '42501', null,
  'anon cannot call it'
);
reset role;

-- ---------------------------------------------------------------------------
-- Nothing changed after the refused calls
-- ---------------------------------------------------------------------------
select is(
  (select a.credentials_ciphertext from public.calendar_accounts a
   where a.id = 'e1000000-0000-4000-8000-000000000001'),
  'v1:test.placeholder.not.a.credential.renewed01',
  'the refused calls changed nothing'
);
select is(
  (select count(*)::integer from public.calendar_credential_revocations),
  current_setting('test.revocations_before')::integer,
  'the revocation queue is still unchanged'
);

select * from finish();
rollback;
