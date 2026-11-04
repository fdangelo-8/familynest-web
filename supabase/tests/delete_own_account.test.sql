-- delete_own_account(p_expect_household_deletion) and get_account_deletion_outcome() (issue #218, for page #38
-- «Il tuo profilo», CA-35, CA-36, CA-38, CA-39, CA-40): schema and privileges, only POST,
-- anon, only the account of the caller, nothing changed by an error half way, administrator
-- succession (the adult with an account who joined first), household kept with other
-- adults with an account, household deleted with all its data when none is left, cascades
-- on the personal and shared data of the account, Supabase Auth log, sign-in flows,
-- identities and sessions of the account (review of PR #226), refusal when the outcome
-- changed after the dialog was opened.
-- Seed ids: A = Marco (Casa D'Angelo, only adult with an account, admin), B = Giulia (Casa
-- Bianchi, only admin), B2 = Paolo (Casa Bianchi, joined 20 days ago), C = Chiara (no
-- household). Members: Casa D'Angelo Marco a1…01, Laura a1…02 (adult without account,
-- pending invitation), Sofia a1…03, Tommaso a1…04 (children), Biscotto a1…05 (pet); Casa
-- Bianchi Giulia b1…01, Paolo b1…02, Leo b1…03 (child), Anna b1…04 (adult without account,
-- invited by Giulia).
-- E = Rita (eeeeeeee-…-01), created here: adult with an account of Casa Bianchi, added
-- last (member b1…05) but joined 25 days ago, before Paolo. She is the expected heir of
-- Giulia: the rule is «joined first», not «added first».
-- Order of the cases: Giulia (only admin, other adults stay) → Paolo (not admin) → Rita
-- (last adult with an account: Casa Bianchi is deleted although Leo and Anna are left) →
-- Chiara (no household) → Marco (only adult with an account: Casa D'Angelo is deleted).
begin;
create extension if not exists pgtap with schema extensions;

select plan(92);

-- ---------------------------------------------------------------------------
-- Setup (as database owner)
-- ---------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', 'eeeeeeee-0000-4000-8000-000000000001', 'authenticated',
        'authenticated', 'utente-e@example.com', '{"full_name":"Rita Test"}', now(), now());

insert into public.household_members (id, household_id, kind, name, color, user_id, joined_at, created_at)
values ('b1000000-0000-4000-8000-000000000005', '22222222-2222-4222-8222-222222222222', 'adult', 'Rita',
        'lampone', 'eeeeeeee-0000-4000-8000-000000000001', now() - interval '25 days', now());

-- Events of Casa Bianchi: three of Giulia (one per visibility), one of Paolo in which
-- Giulia takes part and accompanies; one of Marco in Casa D'Angelo.
insert into public.events (id, household_id, author_member_id, title, starts_at, ends_at, visibility, escort_member_id)
values
  ('f6000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222',
   'b1000000-0000-4000-8000-000000000001', 'Cena di classe', now() + interval '1 day',
   now() + interval '1 day 2 hours', 'household', null),
  ('f6000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222',
   'b1000000-0000-4000-8000-000000000001', 'Appuntamento privato', now() + interval '2 days',
   now() + interval '2 days 1 hour', 'private', null),
  ('f6000000-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222222',
   'b1000000-0000-4000-8000-000000000001', 'Riunione di lavoro', now() + interval '3 days',
   now() + interval '3 days 1 hour', 'busy', null),
  ('f6000000-0000-4000-8000-000000000004', '22222222-2222-4222-8222-222222222222',
   'b1000000-0000-4000-8000-000000000002', 'Partita di Leo', now() + interval '4 days',
   now() + interval '4 days 2 hours', 'household', 'b1000000-0000-4000-8000-000000000001'),
  ('f6000000-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111',
   'a1000000-0000-4000-8000-000000000001', 'Festa di Sofia', now() + interval '5 days',
   now() + interval '5 days 3 hours', 'household', null);

insert into public.event_members (event_id, member_id, household_id)
values
  ('f6000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222'),
  ('f6000000-0000-4000-8000-000000000004', 'b1000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222'),
  ('f6000000-0000-4000-8000-000000000004', 'b1000000-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222222'),
  ('f6000000-0000-4000-8000-000000000005', 'a1000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111');

insert into public.todos (id, household_id, title, created_by_member_id, assignee_member_id, for_member_id, is_private)
values
  ('f4000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'Chiamare il commercialista',
   'b1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', null, true),
  ('f4000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', 'Comprare il regalo',
   'b1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000003', false),
  ('f4000000-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222222', 'Ritirare il pacco',
   'b1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', false);

insert into public.deadlines (id, household_id, title, due_date, created_by_member_id, assignee_member_id, is_private)
values
  ('f5000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'Abbonamento personale',
   (now() at time zone 'Europe/Rome')::date + 10, 'b1000000-0000-4000-8000-000000000001',
   'b1000000-0000-4000-8000-000000000001', true),
  ('f5000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', 'Assicurazione auto',
   (now() at time zone 'Europe/Rome')::date + 30, 'b1000000-0000-4000-8000-000000000001',
   'b1000000-0000-4000-8000-000000000001', false);

insert into public.shopping_items (id, household_id, name, added_by_member_id)
values ('f3000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'Latte',
        'b1000000-0000-4000-8000-000000000001');

insert into public.pinned_spaces (household_id, member_id, space)
values
  ('22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000001', 'meals'),
  ('22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000002', 'meals'),
  ('11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001', 'meals');
insert into public.space_interests (household_id, member_id, space)
values ('22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000001', 'meals');
insert into public.notification_preferences (household_id, member_id)
values ('22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000001');

update public.profiles
set start_lens = 'nest', morning_digest_time = '06:30', default_event_visibility = 'private'
where id = 'bbbbbbbb-0000-4000-8000-000000000001';

-- Supabase Auth rows of the accounts: log entries (Giulia, Marco), sign-in flows (Giulia,
-- Marco), an identity and a session of Giulia.
insert into auth.audit_log_entries (instance_id, id, payload, created_at, ip_address)
values
  ('00000000-0000-0000-0000-000000000000', 'f7000000-0000-4000-8000-000000000001',
   '{"action":"login","actor_id":"bbbbbbbb-0000-4000-8000-000000000001","actor_username":"utente-b@example.com"}',
   now(), '192.0.2.10'),
  ('00000000-0000-0000-0000-000000000000', 'f7000000-0000-4000-8000-000000000002',
   '{"action":"login","actor_id":"aaaaaaaa-0000-4000-8000-000000000001","actor_username":"utente-a@example.com"}',
   now(), '192.0.2.20');
insert into auth.flow_state (id, user_id, auth_code, code_challenge_method, code_challenge, provider_type,
                             authentication_method, created_at, updated_at)
values
  ('f8000000-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001', 'code-b', 's256',
   'challenge-b', 'email', 'magiclink', now(), now()),
  ('f8000000-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 'code-a', 's256',
   'challenge-a', 'email', 'magiclink', now(), now());
insert into auth.identities (id, provider_id, user_id, identity_data, provider, created_at, updated_at)
values ('f9000000-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001',
        'bbbbbbbb-0000-4000-8000-000000000001',
        '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","email":"utente-b@example.com"}', 'email', now(), now());
insert into auth.sessions (id, user_id, created_at, updated_at)
values ('fa000000-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001', now(), now());

-- Raises in a before delete trigger: an error half way through a deletion.
create function public.test_forced_failure()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'forced failure' using errcode = 'P0001';
end;
$$;

-- ---------------------------------------------------------------------------
-- Schema and privileges
-- ---------------------------------------------------------------------------
select has_function('public', 'delete_own_account', array['boolean'], 'delete_own_account(boolean) exists');
select is(
  (select count(*)::integer from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname = 'delete_own_account'),
  1,
  'delete_own_account has a single version'
);
select ok(
  (select p.prosecdef and p.proconfig @> array['search_path=""']
   from pg_proc p where p.oid = 'public.delete_own_account(boolean)'::regprocedure),
  'delete_own_account is security definer with an empty search_path'
);
select is(
  (select p.proargtypes::regtype[]::text from pg_proc p where p.oid = 'public.delete_own_account(boolean)'::regprocedure),
  '{boolean}',
  'its only parameter is the expected outcome: no way to name another account'
);
select ok(
  (select has_table_privilege(pg_get_userbyid(p.proowner), 'auth.users', 'delete')
   from pg_proc p where p.oid = 'public.delete_own_account(boolean)'::regprocedure),
  'the owner of delete_own_account can delete accounts'
);
select ok(
  (select has_table_privilege(pg_get_userbyid(p.proowner), 'auth.audit_log_entries', 'delete')
      and has_table_privilege(pg_get_userbyid(p.proowner), 'auth.flow_state', 'delete')
   from pg_proc p where p.oid = 'public.delete_own_account(boolean)'::regprocedure),
  'the owner of delete_own_account can delete from the Auth log and the sign-in flows'
);
-- Every other table of the auth schema with a user_id loses its rows with the account.
select is_empty(
  $$ select c.table_name
     from information_schema.columns c
     join pg_class r on r.relname = c.table_name and r.relnamespace = 'auth'::regnamespace and r.relkind in ('r', 'p')
     where c.table_schema = 'auth'
       and c.column_name = 'user_id'
       and c.table_name <> 'flow_state'
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
  'every table of the auth schema with a user_id is cleaned: on delete cascade, or flow_state (deleted by the function)'
);
select has_function('public', 'get_account_deletion_outcome', array[]::name[], 'get_account_deletion_outcome() exists');
select is(
  (select p.proargnames from pg_proc p where p.oid = 'public.get_account_deletion_outcome()'::regprocedure),
  array['deletes_household', 'next_admin_member_id']::text[],
  'get_account_deletion_outcome returns only whether the household goes and who becomes administrator'
);
select ok(
  (select not p.prosecdef and p.provolatile = 's'
   from pg_proc p where p.oid = 'public.get_account_deletion_outcome()'::regprocedure),
  'get_account_deletion_outcome runs as the caller and never writes (stable)'
);
select ok(
  not has_function_privilege('anon', 'public.delete_own_account(boolean)', 'execute')
  and not has_function_privilege('anon', 'public.get_account_deletion_outcome()', 'execute'),
  'anon cannot call the account deletion functions'
);
select ok(
  has_function_privilege('authenticated', 'public.delete_own_account(boolean)', 'execute')
  and has_function_privilege('authenticated', 'public.get_account_deletion_outcome()', 'execute'),
  'signed-in users can call the account deletion functions'
);
select ok(
  not has_table_privilege('authenticated', 'auth.users', 'delete')
  and not has_table_privilege('anon', 'auth.users', 'delete'),
  'the API roles cannot delete accounts directly'
);

-- ---------------------------------------------------------------------------
-- CA-39: refused calls change nothing
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok(
  $$ select public.delete_own_account(false) $$,
  '42501', null, 'CA-39: anon cannot delete an account'
);

set local role authenticated;
set local request.jwt.claims to '{"role":"authenticated"}';
select throws_ok(
  $$ select public.delete_own_account(false) $$,
  '42501', 'not authenticated', 'a token without a user deletes nothing'
);

set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
set local request.method to 'GET';
select throws_ok($$ select public.delete_own_account(false) $$, 'P0001', 'use POST', 'CA-39: GET is refused');
set local request.method to 'HEAD';
select throws_ok($$ select public.delete_own_account(false) $$, 'P0001', 'use POST', 'CA-39: HEAD is refused');
set local request.method to 'PUT';
select throws_ok($$ select public.delete_own_account(false) $$, 'P0001', 'use POST', 'CA-39: PUT is refused');
set local request.method to 'PATCH';
select throws_ok($$ select public.delete_own_account(false) $$, 'P0001', 'use POST', 'PATCH is refused');
set local request.method to 'DELETE';
select throws_ok($$ select public.delete_own_account(false) $$, 'P0001', 'use POST', 'DELETE is refused');
set local request.method to 'POST';

reset role;
select is(
  (select count(*)::integer from auth.users u
   where u.id in ('aaaaaaaa-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001',
                  'bbbbbbbb-0000-4000-8000-000000000002', 'cccccccc-0000-4000-8000-000000000001',
                  'eeeeeeee-0000-4000-8000-000000000001')),
  5,
  'CA-39: after the refused calls every account still exists'
);

-- ---------------------------------------------------------------------------
-- What the deletion would do, for each caller (the dialog of page #38)
-- ---------------------------------------------------------------------------
set local role authenticated;

set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select results_eq(
  $$ select * from public.get_account_deletion_outcome() $$,
  $$ values (true, null::uuid) $$,
  'Marco is the only adult with an account: Casa D''Angelo would be deleted («Esci e cancella la casa»)'
);

set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select results_eq(
  $$ select * from public.get_account_deletion_outcome() $$,
  $$ values (false, 'b1000000-0000-4000-8000-000000000005'::uuid) $$,
  'Giulia is the only admin: Casa Bianchi stays and Rita (joined first) would manage it, not Paolo (added first)'
);

set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select results_eq(
  $$ select * from public.get_account_deletion_outcome() $$,
  $$ values (false, null::uuid) $$,
  'Paolo is not admin: Casa Bianchi stays and nobody changes role'
);

set local request.jwt.claims to '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}';
select is_empty(
  $$ select * from public.get_account_deletion_outcome() $$,
  'Chiara has no household: no row'
);

-- ---------------------------------------------------------------------------
-- The outcome changed after the dialog was opened: nothing is deleted
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select public.delete_own_account(true) $$,
  'FN003', 'account deletion outcome changed',
  'Giulia expected Casa Bianchi to be deleted, but other adults with an account are left: refused'
);
select throws_ok(
  $$ select public.delete_own_account(null) $$,
  '22004', null, 'the expected outcome is required'
);
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select public.delete_own_account(false) $$,
  'FN003', 'account deletion outcome changed',
  'Marco expected Casa D''Angelo to stay, but it would be deleted: refused'
);
set local request.jwt.claims to '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select public.delete_own_account(true) $$,
  'FN003', 'account deletion outcome changed',
  'Chiara has no household to delete: true is refused'
);

reset role;
select is(
  (select count(*)::integer from auth.users u
   where u.id in ('aaaaaaaa-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001',
                  'cccccccc-0000-4000-8000-000000000001')),
  3,
  'the refused calls deleted no account'
);

-- ---------------------------------------------------------------------------
-- CA-38: an error half way (Giulia: succession path) changes nothing
-- ---------------------------------------------------------------------------
reset role;
create trigger test_forced_failure
  before delete on public.notification_preferences
  for each row execute function public.test_forced_failure();

set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select public.delete_own_account(false) $$,
  'P0001', 'forced failure', 'CA-38: the deletion of Giulia fails half way'
);

reset role;
drop trigger test_forced_failure on public.notification_preferences;

select ok(
  exists (select 1 from auth.users u where u.id = 'bbbbbbbb-0000-4000-8000-000000000001')
  and exists (select 1 from public.profiles p
              where p.id = 'bbbbbbbb-0000-4000-8000-000000000001' and p.start_lens = 'nest'),
  'CA-38: the account and the profile of Giulia still exist'
);
select ok(
  exists (select 1 from auth.audit_log_entries a where a.id = 'f7000000-0000-4000-8000-000000000001')
  and exists (select 1 from auth.flow_state f where f.id = 'f8000000-0000-4000-8000-000000000001')
  and exists (select 1 from auth.identities i where i.user_id = 'bbbbbbbb-0000-4000-8000-000000000001')
  and exists (select 1 from auth.sessions x where x.user_id = 'bbbbbbbb-0000-4000-8000-000000000001'),
  'CA-38: her Auth log entry, sign-in flow, identity and session still exist'
);
select results_eq(
  $$ select m.name, m.is_admin from public.household_members m
     where m.household_id = '22222222-2222-4222-8222-222222222222' order by m.created_at $$,
  $$ values ('Giulia', true), ('Paolo', false), ('Leo', false), ('Anna', false), ('Rita', false) $$,
  'CA-38: every member is still there and Giulia is still the only admin'
);
select is(
  (select count(*)::integer from public.events e
   where e.id in ('f6000000-0000-4000-8000-000000000002', 'f6000000-0000-4000-8000-000000000003')
     and e.author_member_id = 'b1000000-0000-4000-8000-000000000001'),
  2,
  'CA-38: the «Solo io» and «Occupato» events of Giulia still exist'
);
select ok(
  exists (select 1 from public.todos t where t.id = 'f4000000-0000-4000-8000-000000000001')
  and exists (select 1 from public.deadlines d where d.id = 'f5000000-0000-4000-8000-000000000001')
  and exists (select 1 from public.pinned_spaces s where s.member_id = 'b1000000-0000-4000-8000-000000000001')
  and exists (select 1 from public.event_members em where em.member_id = 'b1000000-0000-4000-8000-000000000001')
  and (select e.author_member_id from public.events e where e.id = 'f6000000-0000-4000-8000-000000000001')
      = 'b1000000-0000-4000-8000-000000000001',
  'CA-38: her «Solo io» things, spaces, participations and authorships are untouched'
);

-- ---------------------------------------------------------------------------
-- CA-35: Giulia (only admin, other adults with an account) deletes her account
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$ select public.delete_own_account(false) $$, 'CA-35: Giulia deletes her account');
select lives_ok(
  $$ select public.delete_own_account(false) $$,
  'a second call with the same token deletes nothing and gives no error'
);
select is_empty(
  $$ select * from public.get_account_deletion_outcome() $$,
  'after the deletion the old token sees no household'
);

reset role;

select is_empty(
  $$ select 1 from auth.users u where u.id = 'bbbbbbbb-0000-4000-8000-000000000001' $$,
  'CA-35: the account of Giulia does not exist any more'
);
select is_empty(
  $$ select 1 from public.profiles p where p.id = 'bbbbbbbb-0000-4000-8000-000000000001' $$,
  'CA-35: her profile with the preferences is deleted'
);
select is_empty(
  $$ select 'log' from auth.audit_log_entries a where a.payload ->> 'actor_id' = 'bbbbbbbb-0000-4000-8000-000000000001'
     union all select 'flow' from auth.flow_state f where f.user_id = 'bbbbbbbb-0000-4000-8000-000000000001'
     union all select 'identity' from auth.identities i where i.user_id = 'bbbbbbbb-0000-4000-8000-000000000001'
     union all select 'session' from auth.sessions x where x.user_id = 'bbbbbbbb-0000-4000-8000-000000000001' $$,
  'her Auth log entries (email, IP), sign-in flows, identities and sessions are deleted'
);
select ok(
  exists (select 1 from auth.audit_log_entries a where a.id = 'f7000000-0000-4000-8000-000000000002')
  and exists (select 1 from auth.flow_state f where f.id = 'f8000000-0000-4000-8000-000000000002'),
  'the Auth log entry and the sign-in flow of Marco are kept'
);
select is_empty(
  $$ select 1 from public.household_members m
     where m.id = 'b1000000-0000-4000-8000-000000000001' or m.user_id = 'bbbbbbbb-0000-4000-8000-000000000001' $$,
  'CA-35: her member row is deleted'
);
select ok(
  exists (select 1 from public.households h where h.id = '22222222-2222-4222-8222-222222222222'),
  'CA-35: Casa Bianchi still exists'
);
select results_eq(
  $$ select m.name, m.is_admin from public.household_members m
     where m.household_id = '22222222-2222-4222-8222-222222222222' order by m.created_at $$,
  $$ values ('Paolo', false), ('Leo', false), ('Anna', false), ('Rita', true) $$,
  'CA-35: Rita (adult with an account who joined first) is now the only admin, as announced by the outcome'
);
select is_empty(
  $$ select 1 from public.events e
     where e.id in ('f6000000-0000-4000-8000-000000000002', 'f6000000-0000-4000-8000-000000000003') $$,
  'CA-35: her «Solo io» and «Occupato» events are deleted'
);
select results_eq(
  $$ select e.title, e.author_member_id from public.events e where e.id = 'f6000000-0000-4000-8000-000000000001' $$,
  $$ values ('Cena di classe', null::uuid) $$,
  'CA-35: her «Tutto il Nest» event stays in the household without author'
);
select results_eq(
  $$ select em.member_id from public.event_members em where em.event_id = 'f6000000-0000-4000-8000-000000000001' $$,
  $$ values ('b1000000-0000-4000-8000-000000000002'::uuid) $$,
  'the participants of her shared event are kept'
);
select results_eq(
  $$ select e.author_member_id, e.escort_member_id from public.events e where e.id = 'f6000000-0000-4000-8000-000000000004' $$,
  $$ values ('b1000000-0000-4000-8000-000000000002'::uuid, null::uuid) $$,
  'she no longer accompanies the event of Paolo'
);
select results_eq(
  $$ select em.member_id from public.event_members em where em.event_id = 'f6000000-0000-4000-8000-000000000004' $$,
  $$ values ('b1000000-0000-4000-8000-000000000003'::uuid) $$,
  'she no longer takes part in the event of Paolo (Leo still does)'
);
select is_empty(
  $$ select 1 from public.todos t where t.id = 'f4000000-0000-4000-8000-000000000001' $$,
  'CA-35: her «Solo io» thing to do is deleted'
);
select results_eq(
  $$ select t.id, t.created_by_member_id, t.assignee_member_id, t.for_member_id from public.todos t
     where t.id in ('f4000000-0000-4000-8000-000000000002', 'f4000000-0000-4000-8000-000000000003')
     order by t.id $$,
  $$ values
       ('f4000000-0000-4000-8000-000000000002'::uuid, null::uuid, null::uuid, 'b1000000-0000-4000-8000-000000000003'::uuid),
       ('f4000000-0000-4000-8000-000000000003'::uuid, 'b1000000-0000-4000-8000-000000000002'::uuid, null::uuid, null::uuid) $$,
  'shared things to do stay without her as author, assignee or «per chi»'
);
select is_empty(
  $$ select 1 from public.deadlines d where d.id = 'f5000000-0000-4000-8000-000000000001' $$,
  'her «Solo io» deadline is deleted'
);
select results_eq(
  $$ select d.created_by_member_id, d.assignee_member_id from public.deadlines d
     where d.id = 'f5000000-0000-4000-8000-000000000002' $$,
  $$ values (null::uuid, null::uuid) $$,
  'her shared deadline stays without author and assignee'
);
select results_eq(
  $$ select s.name, s.added_by_member_id from public.shopping_items s
     where s.household_id = '22222222-2222-4222-8222-222222222222' order by s.created_at $$,
  $$ values ('Yogurt', 'b1000000-0000-4000-8000-000000000002'::uuid), ('Biscotti', null::uuid),
            ('Caffè', null::uuid), ('Latte', null::uuid) $$,
  'the shopping list stays, without her as author'
);
select is_empty(
  $$ select 1 from public.pinned_spaces s where s.member_id = 'b1000000-0000-4000-8000-000000000001'
     union all
     select 1 from public.space_interests i where i.member_id = 'b1000000-0000-4000-8000-000000000001'
     union all
     select 1 from public.notification_preferences n where n.member_id = 'b1000000-0000-4000-8000-000000000001' $$,
  'CA-35: her pinned spaces, space interests and notification preferences are deleted'
);
select ok(
  exists (select 1 from public.pinned_spaces s where s.member_id = 'b1000000-0000-4000-8000-000000000002'),
  'the pinned spaces of Paolo are kept'
);
select results_eq(
  $$ select i.member_id, i.invited_by_member_id from public.invitations i
     where i.id = 'b2000000-0000-4000-8000-000000000001' $$,
  $$ values ('b1000000-0000-4000-8000-000000000004'::uuid, null::uuid) $$,
  'the invitation she sent to Anna stays, without inviter'
);
select is(
  (select count(*)::integer from auth.users u
   where u.id in ('aaaaaaaa-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000002',
                  'cccccccc-0000-4000-8000-000000000001', 'eeeeeeee-0000-4000-8000-000000000001')),
  4,
  'CA-40: every other account still exists'
);
select results_eq(
  $$ select m.name, m.is_admin from public.household_members m
     where m.household_id = '11111111-1111-4111-8111-111111111111' order by m.created_at $$,
  $$ values ('Marco', true), ('Laura', false), ('Sofia', false), ('Tommaso', false), ('Biscotto', false) $$,
  'CA-40: Casa D''Angelo is untouched'
);

-- ---------------------------------------------------------------------------
-- Paolo (not admin) deletes his account: the household and its admin do not change
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select results_eq(
  $$ select * from public.get_account_deletion_outcome() $$,
  $$ values (false, null::uuid) $$,
  'Paolo: Casa Bianchi would stay (Rita), nobody changes role'
);
select lives_ok($$ select public.delete_own_account(false) $$, 'Paolo deletes his account');

reset role;

select results_eq(
  $$ select m.name, m.is_admin from public.household_members m
     where m.household_id = '22222222-2222-4222-8222-222222222222' order by m.created_at $$,
  $$ values ('Leo', false), ('Anna', false), ('Rita', true) $$,
  'Casa Bianchi stays with Leo, Anna and Rita, still the only admin'
);
select is_empty(
  $$ select 1 from public.todos t where t.id = 'b4000000-0000-4000-8000-000000000001'
     union all
     select 1 from public.deadlines d where d.id = 'b5000000-0000-4000-8000-000000000002' $$,
  'the «Solo io» thing to do and deadline of Paolo are deleted'
);
select ok(
  not exists (select 1 from auth.users u where u.id = 'bbbbbbbb-0000-4000-8000-000000000002')
  and not exists (select 1 from public.profiles p where p.id = 'bbbbbbbb-0000-4000-8000-000000000002'),
  'the account and the profile of Paolo are deleted'
);

-- ---------------------------------------------------------------------------
-- Rita, last adult with an account of Casa Bianchi (Anna has no account, Leo is a child):
-- the household is deleted with all its data
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"eeeeeeee-0000-4000-8000-000000000001","role":"authenticated"}';
select results_eq(
  $$ select * from public.get_account_deletion_outcome() $$,
  $$ values (true, null::uuid) $$,
  'Rita is the last adult with an account: Casa Bianchi would be deleted'
);
select lives_ok($$ select public.delete_own_account(true) $$, 'Rita deletes her account');

reset role;

select is_empty(
  $$ select 1 from public.households h where h.id = '22222222-2222-4222-8222-222222222222' $$,
  'Casa Bianchi is deleted although Leo and Anna were left'
);
select is_empty(
  $$ select 'members' from public.household_members x where x.household_id = '22222222-2222-4222-8222-222222222222'
     union all select 'invitations' from public.invitations x where x.household_id = '22222222-2222-4222-8222-222222222222'
     union all select 'events' from public.events x where x.household_id = '22222222-2222-4222-8222-222222222222'
     union all select 'event_members' from public.event_members x where x.household_id = '22222222-2222-4222-8222-222222222222'
     union all select 'event_exceptions' from public.event_exceptions x where x.household_id = '22222222-2222-4222-8222-222222222222'
     union all select 'shopping' from public.shopping_items x where x.household_id = '22222222-2222-4222-8222-222222222222'
     union all select 'todos' from public.todos x where x.household_id = '22222222-2222-4222-8222-222222222222'
     union all select 'deadlines' from public.deadlines x where x.household_id = '22222222-2222-4222-8222-222222222222'
     union all select 'pinned' from public.pinned_spaces x where x.household_id = '22222222-2222-4222-8222-222222222222'
     union all select 'interests' from public.space_interests x where x.household_id = '22222222-2222-4222-8222-222222222222'
     union all select 'notifications' from public.notification_preferences x where x.household_id = '22222222-2222-4222-8222-222222222222' $$,
  'nothing of Casa Bianchi is left: members (child and adult without account), invitations, events, shopping, things to do, deadlines, spaces'
);
select ok(
  not exists (select 1 from auth.users u where u.id = 'eeeeeeee-0000-4000-8000-000000000001')
  and not exists (select 1 from public.profiles p where p.id = 'eeeeeeee-0000-4000-8000-000000000001'),
  'the account and the profile of Rita are deleted'
);
select results_eq(
  $$ select h.name from public.households h $$,
  $$ values ('Casa D''Angelo') $$,
  'CA-40: Casa D''Angelo is still there'
);

-- ---------------------------------------------------------------------------
-- Chiara (no household) deletes her account
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$ select public.delete_own_account(false) $$, 'Chiara (no household) deletes her account');

reset role;

select ok(
  not exists (select 1 from auth.users u where u.id = 'cccccccc-0000-4000-8000-000000000001')
  and not exists (select 1 from public.profiles p where p.id = 'cccccccc-0000-4000-8000-000000000001'),
  'the account and the profile of Chiara are deleted'
);
select ok(
  exists (select 1 from auth.users u where u.id = 'aaaaaaaa-0000-4000-8000-000000000001')
  and (select count(*) from public.household_members m where m.household_id = '11111111-1111-4111-8111-111111111111') = 5,
  'Marco and Casa D''Angelo are untouched'
);

-- ---------------------------------------------------------------------------
-- CA-38 again: an error half way (Marco: household deletion path) changes nothing
-- ---------------------------------------------------------------------------
create trigger test_forced_failure
  before delete on public.households
  for each row execute function public.test_forced_failure();

set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select public.delete_own_account(true) $$,
  'P0001', 'forced failure', 'CA-38: the deletion of Marco fails while deleting Casa D''Angelo'
);

reset role;
drop trigger test_forced_failure on public.households;

select ok(
  exists (select 1 from auth.users u where u.id = 'aaaaaaaa-0000-4000-8000-000000000001')
  and exists (select 1 from public.profiles p where p.id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  'CA-38: the account and the profile of Marco still exist'
);
select results_eq(
  $$ select m.name, m.is_admin from public.household_members m
     where m.household_id = '11111111-1111-4111-8111-111111111111' order by m.created_at $$,
  $$ values ('Marco', true), ('Laura', false), ('Sofia', false), ('Tommaso', false), ('Biscotto', false) $$,
  'CA-38: Casa D''Angelo keeps all its members'
);
select ok(
  (select count(*) from public.shopping_items x where x.household_id = '11111111-1111-4111-8111-111111111111') = 4
  and (select count(*) from public.todos x where x.household_id = '11111111-1111-4111-8111-111111111111') = 4
  and (select count(*) from public.deadlines x where x.household_id = '11111111-1111-4111-8111-111111111111') = 2
  and (select count(*) from public.invitations x where x.household_id = '11111111-1111-4111-8111-111111111111') = 1
  and (select count(*) from public.events x where x.household_id = '11111111-1111-4111-8111-111111111111') = 1
  and (select count(*) from public.pinned_spaces x where x.household_id = '11111111-1111-4111-8111-111111111111') = 1,
  'CA-38: shopping, things to do, deadlines, invitation, event and pinned space of Casa D''Angelo are untouched'
);

-- ---------------------------------------------------------------------------
-- CA-36: Marco, only adult with an account, deletes his account: Casa D'Angelo is deleted
-- with everything it contains
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$ select public.delete_own_account(true) $$, 'CA-36: Marco deletes his account');

reset role;

select ok(
  not exists (select 1 from auth.users u where u.id = 'aaaaaaaa-0000-4000-8000-000000000001')
  and not exists (select 1 from public.profiles p where p.id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  'CA-36: the account and the profile of Marco are deleted'
);
select is_empty(
  $$ select 1 from auth.audit_log_entries a where a.payload ->> 'actor_id' = 'aaaaaaaa-0000-4000-8000-000000000001'
     union all select 1 from auth.flow_state f where f.user_id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  'CA-36: his Auth log entry and sign-in flow are deleted'
);
select is_empty(
  $$ select 1 from public.households h where h.id = '11111111-1111-4111-8111-111111111111' $$,
  'CA-36: Casa D''Angelo is deleted'
);
select is_empty(
  $$ select 1 from public.household_members x where x.household_id = '11111111-1111-4111-8111-111111111111'
     union all select 1 from public.household_members x
       where x.id in ('a1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000003',
                      'a1000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000005') $$,
  'CA-36: its members are deleted: Laura (adult without account), Sofia and Tommaso (children), Biscotto (pet)'
);
select is_empty(
  $$ select 1 from public.invitations x where x.household_id = '11111111-1111-4111-8111-111111111111' $$,
  'CA-36: the invitation of Laura is deleted'
);
select is_empty(
  $$ select 1 from public.shopping_items x where x.household_id = '11111111-1111-4111-8111-111111111111' $$,
  'CA-36: the shopping list is deleted'
);
select is_empty(
  $$ select 1 from public.events x where x.household_id = '11111111-1111-4111-8111-111111111111'
     union all select 1 from public.event_members x where x.household_id = '11111111-1111-4111-8111-111111111111' $$,
  'CA-36: the events and their participants are deleted'
);
select is_empty(
  $$ select 1 from public.todos x where x.household_id = '11111111-1111-4111-8111-111111111111'
     union all select 1 from public.deadlines x where x.household_id = '11111111-1111-4111-8111-111111111111' $$,
  'CA-36: the things to do and the deadlines are deleted'
);
select is_empty(
  $$ select 1 from public.pinned_spaces x where x.household_id = '11111111-1111-4111-8111-111111111111' $$,
  'CA-36: the pinned spaces are deleted'
);
select is_empty(
  $$ select 1 from public.households $$,
  'no household is left'
);
select is_empty(
  $$ select 1 from public.household_members
     union all select 1 from public.events
     union all select 1 from public.event_members
     union all select 1 from public.event_exceptions
     union all select 1 from public.todos
     union all select 1 from public.deadlines
     union all select 1 from public.shopping_items
     union all select 1 from public.invitations
     union all select 1 from private.removed_shopping_items $$,
  'no household data is left anywhere (no hidden copy)'
);
select is_empty(
  $$ select 1 from public.profiles p
     where p.id in ('aaaaaaaa-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001',
                    'bbbbbbbb-0000-4000-8000-000000000002', 'cccccccc-0000-4000-8000-000000000001',
                    'eeeeeeee-0000-4000-8000-000000000001') $$,
  'no profile of the deleted accounts is left'
);

select * from finish();
rollback;
