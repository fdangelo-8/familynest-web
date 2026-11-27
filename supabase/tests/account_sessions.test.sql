-- The devices of an account (issue #513, DB-4 part 1: CA-9 – CA-11, CA-32, and the sessions
-- part of CA-27 – CA-30): list_my_sessions(), end_my_session(), end_my_other_sessions(),
-- private.session_device_kind(), and push_subscriptions.session_id saved by
-- register_push_subscription().
-- Seed ids: Marco (Casa D'Angelo, admin, user aaaaaaaa…01, member a1…01), Laura (member
-- a1…02); Giulia (Casa Bianchi, bbbbbbbb…01, b1…01). This test gives Laura an account (user
-- aaaaaaaa…02). The seed has no sessions and no devices.
-- Sessions (5e550000-…): Marco 01 iPhone (the current one), 02 iPad, 03 Mac, 04 expired,
-- 05 Android phone; Laura 11; Giulia 21. Every instant is relative to now(). The push
-- addresses are made up: no real device.
begin;
create extension if not exists pgtap with schema extensions;

select plan(50);

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-4000-8000-000000000002', 'authenticated',
        'authenticated', 'utente-laura@example.com', '{"full_name":"Laura Test"}', now(), now());
update public.household_members
set user_id = 'aaaaaaaa-0000-4000-8000-000000000002', joined_at = now()
where id = 'a1000000-0000-4000-8000-000000000002';

-- refreshed_at is a UTC timestamp without time zone in auth.sessions.
insert into auth.sessions (id, user_id, created_at, updated_at, refreshed_at, user_agent, ip)
values
  ('5e550000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', now() - interval '10 days',
   now() - interval '10 minutes', (now() - interval '10 minutes') at time zone 'UTC',
   'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
   '203.0.113.10'),
  ('5e550000-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', now() - interval '9 days',
   now() - interval '2 hours', (now() - interval '1 hour') at time zone 'UTC',
   'Mozilla/5.0 (iPad; CPU OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
   '203.0.113.11'),
  ('5e550000-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001', now() - interval '8 days',
   now() - interval '3 days', null,
   'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
   '203.0.113.12'),
  ('5e550000-0000-4000-8000-000000000011', 'aaaaaaaa-0000-4000-8000-000000000002', now() - interval '1 day',
   now() - interval '1 day', null, 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Mobile Safari/537.36',
   '203.0.113.20'),
  ('5e550000-0000-4000-8000-000000000021', 'bbbbbbbb-0000-4000-8000-000000000001', now() - interval '1 day',
   now() - interval '1 day', null, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36',
   '203.0.113.30');

insert into auth.refresh_tokens (token, user_id, session_id, revoked, created_at, updated_at)
values
  ('tok-marco-1', 'aaaaaaaa-0000-4000-8000-000000000001', '5e550000-0000-4000-8000-000000000001', false, now(), now()),
  ('tok-marco-2', 'aaaaaaaa-0000-4000-8000-000000000001', '5e550000-0000-4000-8000-000000000002', false, now(), now()),
  ('tok-marco-3', 'aaaaaaaa-0000-4000-8000-000000000001', '5e550000-0000-4000-8000-000000000003', false, now(), now()),
  ('tok-marco-old', 'aaaaaaaa-0000-4000-8000-000000000001', null, false, now(), now()),
  ('tok-laura-1', 'aaaaaaaa-0000-4000-8000-000000000002', '5e550000-0000-4000-8000-000000000011', false, now(), now());

-- ---------------------------------------------------------------------------
-- Schema, privileges, kind of device
-- ---------------------------------------------------------------------------
select col_type_is('public', 'push_subscriptions', 'session_id', 'uuid', 'push_subscriptions.session_id is a uuid');
select has_index('public', 'push_subscriptions', 'push_subscriptions_session_id_idx', 'index on the session of a device');
select ok(
  not has_column_privilege('authenticated', 'public.push_subscriptions', 'session_id', 'select'),
  'the app does not read the session of a device'
);
select enum_has_labels('public', 'session_device', array['phone', 'tablet', 'computer', 'unknown'], 'session_device labels');
select is(
  (select p.proargnames from pg_proc p where p.oid = 'public.list_my_sessions()'::regprocedure),
  array['session_id', 'device_kind', 'last_active_at', 'is_current'],
  'CA-9: list_my_sessions() gives only session, kind of device, last activity, current (no IP, no user agent)'
);
select ok(
  not has_table_privilege('authenticated', 'auth.sessions', 'select')
  and not has_table_privilege('anon', 'auth.sessions', 'select'),
  'the API roles cannot read auth.sessions'
);
select results_eq(
  $$ select private.session_device_kind(u) from unnest(array[
       'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) Mobile/15E148',
       'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Mobile Safari/537.36',
       'Mozilla/5.0 (iPad; CPU OS 18_1 like Mac OS X) Mobile/15E148',
       'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 Safari/537.36',
       'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0',
       'Mozilla/5.0 (X11; Linux x86_64) Firefox/133.0',
       'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15',
       'curl/8.5.0',
       '',
       null
     ]) with ordinality as t (u, o) order by t.o $$,
  $$ values ('phone'::public.session_device), ('phone'), ('tablet'), ('tablet'), ('computer'), ('computer'), ('computer'),
            ('unknown'), ('unknown'), ('unknown') $$,
  'rule 7: the kind of device from the user agent'
);

-- ---------------------------------------------------------------------------
-- CA-32: the device saves the session that registers it
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated","session_id":"5e550000-0000-4000-8000-000000000001"}';
select set_config(
  'test.push_phone',
  public.register_push_subscription('web', 'https://fcm.googleapis.com/fcm/send/marco-phone', repeat('B', 87), repeat('a', 22))::text,
  true
);
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated","session_id":"5e550000-0000-4000-8000-000000000002"}';
select set_config(
  'test.push_ipad',
  public.register_push_subscription('web', 'https://fcm.googleapis.com/fcm/send/marco-ipad', repeat('B', 87), repeat('a', 22))::text,
  true
);
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated","session_id":"5e550000-0000-4000-8000-000000000003"}';
select set_config(
  'test.push_mac',
  public.register_push_subscription('web', 'https://fcm.googleapis.com/fcm/send/marco-mac', repeat('B', 87), repeat('a', 22))::text,
  true
);
-- A token without session_id (as the devices registered before #513).
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select set_config(
  'test.push_old',
  public.register_push_subscription('apns', p_token => repeat('ab', 32))::text,
  true
);
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated","session_id":"5e550000-0000-4000-8000-000000000011"}';
select set_config(
  'test.push_laura',
  public.register_push_subscription('fcm', p_token => 'laura-token:abc')::text,
  true
);
-- The same device of the Mac registered again from the iPad session: the same row, with the
-- new session.
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated","session_id":"5e550000-0000-4000-8000-000000000002"}';
select is(
  public.register_push_subscription('web', 'https://fcm.googleapis.com/fcm/send/marco-mac', repeat('B', 87), repeat('a', 22))::text,
  current_setting('test.push_mac'),
  'the same device registered again keeps its row'
);
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated","session_id":"5e550000-0000-4000-8000-000000000003"}';
select is(
  public.register_push_subscription('web', 'https://fcm.googleapis.com/fcm/send/marco-mac', repeat('B', 87), repeat('a', 22))::text,
  current_setting('test.push_mac'),
  'and registered again from its own session'
);

reset role;
select results_eq(
  $$ select s.id::text, s.session_id from public.push_subscriptions s order by s.session_id nulls first, s.id $$,
  $$ values
       (current_setting('test.push_old'), null::uuid),
       (current_setting('test.push_phone'), '5e550000-0000-4000-8000-000000000001'::uuid),
       (current_setting('test.push_ipad'), '5e550000-0000-4000-8000-000000000002'::uuid),
       (current_setting('test.push_mac'), '5e550000-0000-4000-8000-000000000003'::uuid),
       (current_setting('test.push_laura'), '5e550000-0000-4000-8000-000000000011'::uuid) $$,
  'CA-32: every device has the session that registered it (null without a session in the token)'
);

-- ---------------------------------------------------------------------------
-- CA-9: «Dove sei entrato»
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated","session_id":"5e550000-0000-4000-8000-000000000001"}';
select results_eq(
  $$ select s.session_id, s.device_kind::text, s.is_current from public.list_my_sessions() s $$,
  $$ values ('5e550000-0000-4000-8000-000000000001'::uuid, 'phone', true),
            ('5e550000-0000-4000-8000-000000000002'::uuid, 'tablet', false),
            ('5e550000-0000-4000-8000-000000000003'::uuid, 'computer', false) $$,
  'CA-9: from the iPhone, 3 rows: phone (current, first), tablet, computer'
);
select results_eq(
  $$ select s.last_active_at from public.list_my_sessions() s $$,
  $$ values (now() - interval '10 minutes'), (now() - interval '1 hour'), (now() - interval '3 days') $$,
  'rule 7: last_active_at is refreshed_at, else updated_at'
);
select throws_ok($$ select 1 from auth.sessions $$, '42501', null, 'Marco cannot read auth.sessions directly');
set local request.method to 'GET';
select is((select count(*)::integer from public.list_my_sessions()), 3, 'list_my_sessions() answers with GET');
set local request.method to 'POST';

-- ---------------------------------------------------------------------------
-- CA-11: one session
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ select public.end_my_session('5e550000-0000-4000-8000-000000000001') $$,
  '22023', null, 'CA-11: the current session gives 22023'
);
select throws_ok($$ select public.end_my_session(null) $$, '22023', null, 'a null session gives 22023');
select lives_ok(
  $$ select public.end_my_session('5e550000-0000-4000-8000-000000000011') $$,
  'CA-11: a session of Laura gives no error'
);
select lives_ok(
  $$ select public.end_my_session('5e550000-0000-4000-8000-0000000000ff') $$,
  'an unknown session gives no error'
);

-- CA-30: the functions that write accept only POST.
set local request.method to 'GET';
select throws_ok(
  $$ select public.end_my_session('5e550000-0000-4000-8000-000000000002') $$, 'P0001', 'use POST', 'CA-30: end_my_session refuses GET'
);
select throws_ok($$ select public.end_my_other_sessions() $$, 'P0001', 'use POST', 'CA-30: end_my_other_sessions refuses GET');
set local request.method to 'PUT';
select throws_ok($$ select public.end_my_other_sessions() $$, 'P0001', 'use POST', 'CA-30: end_my_other_sessions refuses PUT');
set local request.method to 'POST';

reset role;
select results_eq(
  $$ select s.id from auth.sessions s order by s.id $$,
  $$ values ('5e550000-0000-4000-8000-000000000001'::uuid), ('5e550000-0000-4000-8000-000000000002'::uuid),
            ('5e550000-0000-4000-8000-000000000003'::uuid), ('5e550000-0000-4000-8000-000000000011'::uuid),
            ('5e550000-0000-4000-8000-000000000021'::uuid) $$,
  'CA-11, CA-30: nothing changed (current session, session of Laura, refused methods)'
);
select is(
  (select count(*)::integer from public.push_subscriptions),
  5,
  'CA-11: no device changed'
);

-- ---------------------------------------------------------------------------
-- CA-27: Giulia (Casa Bianchi) and the sessions of Marco
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated","session_id":"5e550000-0000-4000-8000-000000000021"}';
select results_eq(
  $$ select s.session_id, s.device_kind::text, s.is_current from public.list_my_sessions() s $$,
  $$ values ('5e550000-0000-4000-8000-000000000021'::uuid, 'computer', true) $$,
  'CA-27: Giulia sees only her session'
);
select lives_ok(
  $$ select public.end_my_session('5e550000-0000-4000-8000-000000000002') $$,
  'CA-27: Giulia closing a session of Marco gives no error'
);
select is(public.end_my_other_sessions(), 0, 'CA-27: Giulia has no other session: 0');

-- CA-28: Laura and Marco (administrator) of the same household.
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated","session_id":"5e550000-0000-4000-8000-000000000011"}';
select results_eq(
  $$ select s.session_id from public.list_my_sessions() s $$,
  $$ values ('5e550000-0000-4000-8000-000000000011'::uuid) $$,
  'Laura sees only her session, none of Marco'
);
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated","session_id":"5e550000-0000-4000-8000-000000000001"}';
select is_empty(
  $$ select 1 from public.list_my_sessions() s where s.session_id = '5e550000-0000-4000-8000-000000000011' $$,
  'CA-28: Marco, administrator, does not see the session of Laura'
);

reset role;
select results_eq(
  $$ select count(*)::integer from auth.sessions s where s.user_id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  $$ values (3) $$,
  'CA-27: the sessions of Marco are all still there'
);

-- ---------------------------------------------------------------------------
-- CA-10: «Esci da tutti gli altri apparecchi»
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated","session_id":"5e550000-0000-4000-8000-000000000001"}';
select is(public.end_my_other_sessions(), 2, 'CA-10: Marco closes the 2 other sessions');
select results_eq(
  $$ select s.session_id, s.is_current from public.list_my_sessions() s $$,
  $$ values ('5e550000-0000-4000-8000-000000000001'::uuid, true) $$,
  'CA-10: only the current session is left'
);

reset role;
select results_eq(
  $$ select s.id from auth.sessions s where s.user_id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  $$ values ('5e550000-0000-4000-8000-000000000001'::uuid) $$,
  'CA-10: in auth.sessions only the current session of Marco is left'
);
select results_eq(
  $$ select r.token::text from auth.refresh_tokens r where r.user_id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  $$ values ('tok-marco-1') $$,
  'CA-10: only the refresh tokens of the current session are left (also the old token without session is gone)'
);
select results_eq(
  $$ select s.id::text from public.push_subscriptions s
     where s.member_id = 'a1000000-0000-4000-8000-000000000001' $$,
  $$ values (current_setting('test.push_phone')) $$,
  'CA-10: only the devices of the current session are left (also the one without session is gone)'
);
select results_eq(
  $$ select (select count(*)::integer from auth.sessions s where s.user_id <> 'aaaaaaaa-0000-4000-8000-000000000001'),
            (select count(*)::integer from auth.refresh_tokens r where r.user_id = 'aaaaaaaa-0000-4000-8000-000000000002'),
            (select count(*)::integer from public.push_subscriptions s where s.member_id <> 'a1000000-0000-4000-8000-000000000001') $$,
  $$ values (2, 1, 1) $$,
  'CA-10, CA-28: the sessions, tokens and devices of Laura and Giulia are untouched'
);

-- ---------------------------------------------------------------------------
-- CA-11: closing one other session
-- ---------------------------------------------------------------------------
insert into auth.sessions (id, user_id, created_at, updated_at, user_agent)
values ('5e550000-0000-4000-8000-000000000005', 'aaaaaaaa-0000-4000-8000-000000000001', now() - interval '1 day',
        now() - interval '1 day', 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Mobile Safari/537.36');
insert into auth.refresh_tokens (token, user_id, session_id, revoked, created_at, updated_at)
values ('tok-marco-5', 'aaaaaaaa-0000-4000-8000-000000000001', '5e550000-0000-4000-8000-000000000005', false, now(), now());

set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated","session_id":"5e550000-0000-4000-8000-000000000005"}';
select set_config(
  'test.push_android',
  public.register_push_subscription('fcm', p_token => 'marco-android:xyz')::text,
  true
);
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated","session_id":"5e550000-0000-4000-8000-000000000001"}';
select results_eq(
  $$ select s.session_id, s.device_kind::text, s.is_current from public.list_my_sessions() s $$,
  $$ values ('5e550000-0000-4000-8000-000000000001'::uuid, 'phone', true),
            ('5e550000-0000-4000-8000-000000000005'::uuid, 'phone', false) $$,
  'the new Android session is listed after the current one'
);
select lives_ok(
  $$ select public.end_my_session('5e550000-0000-4000-8000-000000000005') $$,
  'Marco closes the Android session'
);

reset role;
select is_empty(
  $$ select 1 from auth.sessions s where s.id = '5e550000-0000-4000-8000-000000000005'
     union all select 1 from auth.refresh_tokens r where r.token = 'tok-marco-5'
     union all select 1 from public.push_subscriptions s where s.id::text = current_setting('test.push_android') $$,
  'rule 7: the closed session goes with its refresh tokens and its devices'
);
select results_eq(
  $$ select (select count(*)::integer from auth.sessions s where s.id = '5e550000-0000-4000-8000-000000000001'),
            (select count(*)::integer from public.push_subscriptions s where s.id::text = current_setting('test.push_phone')) $$,
  $$ values (1, 1) $$,
  'the current session and its device stay'
);

-- An expired session is not listed.
insert into auth.sessions (id, user_id, created_at, updated_at, not_after, user_agent)
values ('5e550000-0000-4000-8000-000000000004', 'aaaaaaaa-0000-4000-8000-000000000001', now() - interval '40 days',
        now() - interval '40 days', now() - interval '10 days', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)');

set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated","session_id":"5e550000-0000-4000-8000-000000000001"}';
select results_eq(
  $$ select s.session_id from public.list_my_sessions() s $$,
  $$ values ('5e550000-0000-4000-8000-000000000001'::uuid) $$,
  'a session past its not_after is not listed'
);

-- A token without session_id: nothing is current, and «all the others» is refused.
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select is(
  (select bool_or(s.is_current) from public.list_my_sessions() s),
  false,
  'without session_id in the token no session is current'
);
select throws_ok($$ select public.end_my_other_sessions() $$, '22023', null, 'without session_id, end_my_other_sessions gives 22023');
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated","session_id":"not-a-uuid"}';
select throws_ok(
  $$ select public.end_my_other_sessions() $$, '22023', null, 'a session_id that is not a uuid counts as none'
);

-- ---------------------------------------------------------------------------
-- CA-29: anon
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok($$ select * from public.list_my_sessions() $$, '42501', null, 'CA-29: anon cannot call list_my_sessions');
select throws_ok(
  $$ select public.end_my_session('5e550000-0000-4000-8000-000000000001') $$, '42501', null, 'CA-29: anon cannot call end_my_session'
);
select throws_ok($$ select public.end_my_other_sessions() $$, '42501', null, 'CA-29: anon cannot call end_my_other_sessions');
select throws_ok($$ select 1 from auth.sessions $$, '42501', null, 'CA-29: anon cannot read auth.sessions');

-- A signed-in user without a household has sessions too (no device).
reset role;
insert into auth.sessions (id, user_id, created_at, updated_at, user_agent)
values
  ('5e550000-0000-4000-8000-000000000031', 'cccccccc-0000-4000-8000-000000000001', now() - interval '1 day', now() - interval '1 day', null),
  ('5e550000-0000-4000-8000-000000000032', 'cccccccc-0000-4000-8000-000000000001', now() - interval '2 days', now() - interval '2 days', null);
set local role authenticated;
set local request.jwt.claims to '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated","session_id":"5e550000-0000-4000-8000-000000000031"}';
select results_eq(
  $$ select s.session_id, s.device_kind::text, s.is_current from public.list_my_sessions() s $$,
  $$ values ('5e550000-0000-4000-8000-000000000031'::uuid, 'unknown', true),
            ('5e550000-0000-4000-8000-000000000032'::uuid, 'unknown', false) $$,
  'Chiara (no household) sees her sessions; no user agent is unknown'
);
select is(public.end_my_other_sessions(), 1, 'Chiara closes her other session');

reset role;
select results_eq(
  $$ select s.id from auth.sessions s where s.user_id = 'cccccccc-0000-4000-8000-000000000001' $$,
  $$ values ('5e550000-0000-4000-8000-000000000031'::uuid) $$,
  'only the current session of Chiara is left'
);

select * from finish();
rollback;
