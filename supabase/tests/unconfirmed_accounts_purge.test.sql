-- Issue #336 (for #327, decision D3): accounts whose mail is never confirmed are deleted
-- 7 days after the registration by the pg_cron job, with their profile and Auth rows.
-- Kept: confirmed accounts, accounts that signed in, accounts younger than 7 days and
-- accounts with a member row in a Nest (never expected, never deleted by the job).
-- Accounts of this test (ids e1…0n), all with a mail of the reserved example.com domain:
--   U1 e1…01 unconfirmed, registered 8 days ago, with identity, session, refresh token,
--            sign-in flow and Auth log entry                                   → deleted
--   U2 e1…02 unconfirmed, registered 6 days ago                                → kept
--            (deleted by a run 2 days later)
--   U3 e1…03 confirmed, registered 30 days ago                                 → kept
--   U4 e1…04 unconfirmed, registered 8 days ago, but signed in once            → kept
--   U5 e1…05 unconfirmed, registered 8 days ago, member of «Casa Prova»        → kept
-- Seed accounts A, B, B2, C (confirmed) are never touched.
begin;
create extension if not exists pgtap with schema extensions;

select plan(18);

-- ---------------------------------------------------------------------------
-- Schema, privileges, schedule
-- ---------------------------------------------------------------------------
select has_function('private', 'purge_unconfirmed_accounts', array['timestamp with time zone'],
  'purge_unconfirmed_accounts exists in private');
select ok(
  not has_function_privilege('anon', 'private.purge_unconfirmed_accounts(timestamptz)', 'execute')
  and not has_function_privilege('authenticated', 'private.purge_unconfirmed_accounts(timestamptz)', 'execute')
  and not has_function_privilege('service_role', 'private.purge_unconfirmed_accounts(timestamptz)', 'execute'),
  'no API role, not even the administrative key, can run the purge'
);
select ok(
  (select not p.prosecdef and p.proconfig @> array['search_path=""']
   from pg_proc p where p.oid = 'private.purge_unconfirmed_accounts(timestamptz)'::regprocedure),
  'the purge runs as its caller (postgres for pg_cron) with an empty search_path'
);
select results_eq(
  $$ select j.schedule, j.command from cron.job j where j.jobname = 'purge-unconfirmed-accounts' $$,
  $$ values ('17 * * * *'::text, 'select private.purge_unconfirmed_accounts(now());'::text) $$,
  'pg_cron runs the purge every hour'
);

set local role authenticated;
select throws_ok(
  $$ select private.purge_unconfirmed_accounts(now()) $$,
  '42501', null,
  'a signed-in user cannot run the purge'
);
reset role;

select throws_ok(
  $$ select private.purge_unconfirmed_accounts(null) $$,
  '22004', null,
  'the reference time is required'
);

-- Every table of the auth schema with a user_id loses its rows with the account: on delete
-- cascade, or deleted by the function (same check as delete_own_account.test.sql).
select is_empty(
  $$ select c.table_name
     from information_schema.columns c
     join pg_class r on r.relname = c.table_name and r.relnamespace = 'auth'::regnamespace and r.relkind in ('r', 'p')
     where c.table_schema = 'auth'
       and c.column_name = 'user_id'
       and c.table_name not in ('flow_state', 'refresh_tokens', 'scim_users')
       and not exists (
         select 1
         from pg_constraint k
         join pg_attribute a on a.attrelid = k.conrelid and a.attnum = any (k.conkey)
         where k.conrelid = r.oid
           and k.contype = 'f'
           and k.confrelid = 'auth.users'::regclass
           and k.confdeltype = 'c'
           and a.attname = 'user_id'
       ) $$,
  'every table of the auth schema with a user_id is cleaned: on delete cascade, or deleted by the function'
);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, email_confirmed_at, last_sign_in_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values
  ('00000000-0000-0000-0000-000000000000', 'e1000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'non-confermato-1@example.com', null, null, '{"provider":"email","providers":["email"]}', '{}',
   now() - interval '8 days', now() - interval '8 days', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'e1000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'non-confermato-2@example.com', null, null, '{"provider":"email","providers":["email"]}', '{}',
   now() - interval '6 days', now() - interval '6 days', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'e1000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated',
   'confermato-3@example.com', now() - interval '29 days', now() - interval '29 days',
   '{"provider":"email","providers":["email"]}', '{}',
   now() - interval '30 days', now() - interval '29 days', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'e1000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated',
   'entrato-4@example.com', null, now() - interval '8 days', '{"provider":"email","providers":["email"]}', '{}',
   now() - interval '8 days', now() - interval '8 days', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'e1000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated',
   'nel-nest-5@example.com', null, null, '{"provider":"email","providers":["email"]}', '{}',
   now() - interval '8 days', now() - interval '8 days', '', '', '', '');

insert into public.households (id, name, household_type)
values ('e2000000-0000-4000-8000-000000000001', 'Casa Prova', 'single');
insert into public.household_members (id, household_id, kind, name, color, user_id, is_admin, joined_at)
values ('e3000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000001', 'adult', 'Prova',
        'pomodoro', 'e1000000-0000-4000-8000-000000000005', true, now() - interval '8 days');

-- Auth rows of U1, and a log entry of the seed account A.
insert into auth.identities (id, provider_id, user_id, identity_data, provider, created_at, updated_at)
values ('e4000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001',
        'e1000000-0000-4000-8000-000000000001',
        '{"sub":"e1000000-0000-4000-8000-000000000001","email":"non-confermato-1@example.com"}', 'email',
        now() - interval '8 days', now() - interval '8 days');
insert into auth.sessions (id, user_id, created_at, updated_at)
values ('e5000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001',
        now() - interval '8 days', now() - interval '8 days');
insert into auth.refresh_tokens (instance_id, token, user_id, revoked, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', 'test-token-336', 'e1000000-0000-4000-8000-000000000001',
        false, now() - interval '8 days', now() - interval '8 days');
insert into auth.flow_state (id, user_id, auth_code, code_challenge_method, code_challenge, provider_type,
                             authentication_method, created_at, updated_at)
values ('e6000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 'code-336', 's256',
        'challenge-336', 'email', 'magiclink', now() - interval '8 days', now() - interval '8 days');
insert into auth.audit_log_entries (instance_id, id, payload, created_at, ip_address)
values
  ('00000000-0000-0000-0000-000000000000', 'e7000000-0000-4000-8000-000000000001',
   '{"action":"user_confirmation_requested","actor_id":"e1000000-0000-4000-8000-000000000001","actor_username":"non-confermato-1@example.com"}',
   now() - interval '8 days', '192.0.2.36'),
  ('00000000-0000-0000-0000-000000000000', 'e7000000-0000-4000-8000-000000000002',
   '{"action":"login","actor_id":"aaaaaaaa-0000-4000-8000-000000000001","actor_username":"utente-a@example.com"}',
   now(), '192.0.2.20');

select is(
  (select count(*)::integer from public.profiles p where p.id::text like 'e1000000-%'),
  5,
  'every test account has its profile (trigger on_auth_user_created)'
);

-- ---------------------------------------------------------------------------
-- The job, now
-- ---------------------------------------------------------------------------
select is(private.purge_unconfirmed_accounts(now()), 1, 'the purge deletes one account');

select is_empty(
  $$ select 'user' from auth.users u where u.id = 'e1000000-0000-4000-8000-000000000001'
     union all select 'profile' from public.profiles p where p.id = 'e1000000-0000-4000-8000-000000000001'
     union all select 'identity' from auth.identities i where i.user_id = 'e1000000-0000-4000-8000-000000000001'
     union all select 'session' from auth.sessions x where x.user_id = 'e1000000-0000-4000-8000-000000000001'
     union all select 'refresh' from auth.refresh_tokens r where r.user_id = 'e1000000-0000-4000-8000-000000000001'
     union all select 'flow' from auth.flow_state f where f.user_id = 'e1000000-0000-4000-8000-000000000001'
     union all select 'log' from auth.audit_log_entries a
               where a.payload ->> 'actor_id' = 'e1000000-0000-4000-8000-000000000001' $$,
  'the account unconfirmed for 8 days is deleted with its mail, profile, identity, session, token, flow and log'
);

select results_eq(
  $$ select u.id from auth.users u where u.id::text like 'e1000000-%' order by u.id $$,
  $$ values ('e1000000-0000-4000-8000-000000000002'::uuid), ('e1000000-0000-4000-8000-000000000003'::uuid),
            ('e1000000-0000-4000-8000-000000000004'::uuid), ('e1000000-0000-4000-8000-000000000005'::uuid) $$,
  'kept: unconfirmed for 6 days, confirmed, signed in once, member of a Nest'
);
select is(
  (select count(*)::integer from public.profiles p where p.id::text like 'e1000000-%'),
  4,
  'the profiles of the kept accounts are still there'
);
select ok(
  exists (select 1 from public.households h where h.id = 'e2000000-0000-4000-8000-000000000001')
  and exists (select 1 from public.household_members m
              where m.id = 'e3000000-0000-4000-8000-000000000001'
                and m.user_id = 'e1000000-0000-4000-8000-000000000005'),
  'the Nest of the unconfirmed member and its member row are untouched'
);
select is(
  (select count(*)::integer from auth.users u
   where u.id in ('aaaaaaaa-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001',
                  'bbbbbbbb-0000-4000-8000-000000000002', 'cccccccc-0000-4000-8000-000000000001')),
  4,
  'the seed accounts are untouched'
);
select ok(
  exists (select 1 from auth.audit_log_entries a where a.id = 'e7000000-0000-4000-8000-000000000002'),
  'the Auth log entries of other accounts are kept'
);

select is(private.purge_unconfirmed_accounts(now()), 0, 'a second run deletes nothing');

-- ---------------------------------------------------------------------------
-- Two days later: U2 is now unconfirmed for 8 days
-- ---------------------------------------------------------------------------
select is(private.purge_unconfirmed_accounts(now() + interval '2 days'), 1,
  'two days later the purge deletes the account registered 6 days ago');
select results_eq(
  $$ select u.id from auth.users u where u.id::text like 'e1000000-%' order by u.id $$,
  $$ values ('e1000000-0000-4000-8000-000000000003'::uuid), ('e1000000-0000-4000-8000-000000000004'::uuid),
            ('e1000000-0000-4000-8000-000000000005'::uuid) $$,
  'confirmed, signed-in and member accounts are never deleted'
);

select * from finish();
rollback;
