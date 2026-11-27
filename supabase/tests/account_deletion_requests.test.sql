-- «Elimina l'account» with 14 days to think it over (issue #513, DB-4 part 2: CA-12 – CA-16,
-- CA-21, CA-33 for household_handed_over, and the deletion part of CA-27 – CA-30):
-- request_account_deletion(), cancel_account_deletion(), get_my_account_deletion(), the
-- trigger on auth.sessions, the handover of the household, private.household_heir(),
-- private.has_consent() during a request, and the «in coppia» rules of #652 (they block
-- neither the handover nor the request).
-- Seed ids: Casa D'Angelo 1111…: Marco (admin, user aaaaaaaa…01, member a1…01), Laura
-- (a1…02), Sofia, Tommaso (children), Biscotto (pet). Casa Bianchi 2222…: Giulia (admin,
-- bbbbbbbb…01), Paolo (bbbbbbbb…02). Chiara (cccccccc…01, no household).
-- Created here: Laura's account (aaaaaaaa…02, joined 10 days ago), a third adult with an
-- account in Casa D'Angelo, Piero (aaaaaaaa…03, member a1…06, joined 5 days ago); two couples
-- (Casa Rossi: Dario organiser, Elena not; Casa Verdi: Fabio and Gina both organisers); an
-- adult without household (Ivo). Sessions 5e5d…, devices with made-up addresses.
-- The dates are relative to today (Europe/Rome): never a date in the past (LEZIONI).
begin;
create extension if not exists pgtap with schema extensions;

select plan(67);

-- ---------------------------------------------------------------------------
-- Setup (as database owner)
-- ---------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-4000-8000-000000000002', 'authenticated',
   'authenticated', 'utente-laura@example.com', '{"full_name":"Laura Test"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-4000-8000-000000000003', 'authenticated',
   'authenticated', 'utente-piero@example.com', '{"full_name":"Piero Test"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'dddddddd-0000-4000-8000-000000000001', 'authenticated',
   'authenticated', 'utente-dario@example.com', '{"full_name":"Dario Test"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'dddddddd-0000-4000-8000-000000000002', 'authenticated',
   'authenticated', 'utente-elena@example.com', '{"full_name":"Elena Test"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'dddddddd-0000-4000-8000-000000000003', 'authenticated',
   'authenticated', 'utente-fabio@example.com', '{"full_name":"Fabio Test"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'dddddddd-0000-4000-8000-000000000004', 'authenticated',
   'authenticated', 'utente-gina@example.com', '{"full_name":"Gina Test"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'dddddddd-0000-4000-8000-000000000005', 'authenticated',
   'authenticated', 'utente-ivo@example.com', '{"full_name":"Ivo Test"}', now(), now());

update public.household_members
set user_id = 'aaaaaaaa-0000-4000-8000-000000000002', joined_at = now() - interval '10 days'
where id = 'a1000000-0000-4000-8000-000000000002';
insert into public.household_members (id, household_id, kind, name, color, user_id, joined_at)
values ('a1000000-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111', 'adult', 'Piero',
        'lampone', 'aaaaaaaa-0000-4000-8000-000000000003', now() - interval '5 days');

-- Two couples: only two adults, both with an account.
insert into public.households (id, name, household_type)
values
  ('d5130000-0000-4000-8000-0000000000a1', 'Casa Rossi', 'couple'),
  ('d5130000-0000-4000-8000-0000000000a2', 'Casa Verdi', 'couple');
insert into public.household_members (id, household_id, kind, name, color, user_id, is_admin, joined_at, created_at)
values
  ('d5130000-0000-4000-8000-0000000000b1', 'd5130000-0000-4000-8000-0000000000a1', 'adult', 'Dario', 'pomodoro',
   'dddddddd-0000-4000-8000-000000000001', true, now() - interval '20 days', now() - interval '20 days'),
  ('d5130000-0000-4000-8000-0000000000b2', 'd5130000-0000-4000-8000-0000000000a1', 'adult', 'Elena', 'glicine',
   'dddddddd-0000-4000-8000-000000000002', false, now() - interval '10 days', now() - interval '19 days'),
  ('d5130000-0000-4000-8000-0000000000b3', 'd5130000-0000-4000-8000-0000000000a2', 'adult', 'Fabio', 'pomodoro',
   'dddddddd-0000-4000-8000-000000000003', true, now() - interval '20 days', now() - interval '20 days'),
  ('d5130000-0000-4000-8000-0000000000b4', 'd5130000-0000-4000-8000-0000000000a2', 'adult', 'Gina', 'glicine',
   'dddddddd-0000-4000-8000-000000000004', true, now() - interval '10 days', now() - interval '19 days');

-- Sessions and refresh tokens: Marco 01 (current) and 02, Laura 11, Dario 21.
insert into auth.sessions (id, user_id, created_at, updated_at)
values
  ('5e5d0000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', now() - interval '2 days', now()),
  ('5e5d0000-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', now() - interval '1 day', now()),
  ('5e5d0000-0000-4000-8000-000000000011', 'aaaaaaaa-0000-4000-8000-000000000002', now() - interval '1 day', now()),
  ('5e5d0000-0000-4000-8000-000000000021', 'dddddddd-0000-4000-8000-000000000001', now() - interval '1 day', now());
insert into auth.refresh_tokens (token, user_id, session_id, revoked, created_at, updated_at)
values
  ('tok-513-marco-1', 'aaaaaaaa-0000-4000-8000-000000000001', '5e5d0000-0000-4000-8000-000000000001', false, now(), now()),
  ('tok-513-marco-old', 'aaaaaaaa-0000-4000-8000-000000000001', null, false, now(), now()),
  ('tok-513-laura-1', 'aaaaaaaa-0000-4000-8000-000000000002', '5e5d0000-0000-4000-8000-000000000011', false, now(), now());

-- Devices: two of Marco, one of Laura, one of Elena. Laura gets «Solo il riepilogo»: the
-- handover rings at once anyway (CA-33).
insert into public.push_subscriptions (household_id, member_id, platform, endpoint, p256dh, auth, session_id)
values
  ('11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001', 'web',
   'https://fcm.googleapis.com/fcm/send/513-marco-1', repeat('B', 87), repeat('a', 22), '5e5d0000-0000-4000-8000-000000000001'),
  ('11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001', 'web',
   'https://fcm.googleapis.com/fcm/send/513-marco-2', repeat('B', 87), repeat('a', 22), '5e5d0000-0000-4000-8000-000000000002'),
  ('11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000002', 'web',
   'https://fcm.googleapis.com/fcm/send/513-laura', repeat('B', 87), repeat('a', 22), '5e5d0000-0000-4000-8000-000000000011'),
  ('d5130000-0000-4000-8000-0000000000a1', 'd5130000-0000-4000-8000-0000000000b2', 'web',
   'https://fcm.googleapis.com/fcm/send/513-elena', repeat('B', 87), repeat('a', 22), null);
insert into public.notification_preferences (household_id, member_id, delivery_mode, quiet_hours)
values ('11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000002', 'digest_only', false);

-- An optional consent of Marco (for has_consent()).
insert into public.consent_records (user_id, kind, granted, source)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'usage_analytics', true, 'settings');

-- ---------------------------------------------------------------------------
-- Schema and privileges
-- ---------------------------------------------------------------------------
select has_table('private', 'account_deletion_requests', 'private.account_deletion_requests exists');
select columns_are(
  'private', 'account_deletion_requests',
  array['user_id', 'household_id', 'requested_at', 'delete_on', 'deletes_household', 'created_at'],
  'the request keeps only the account, its household, when, the day and whether the household goes'
);
select ok(
  (select c.relrowsecurity from pg_class c where c.oid = 'private.account_deletion_requests'::regclass),
  'RLS is enabled on private.account_deletion_requests'
);
select ok(
  not has_table_privilege('authenticated', 'private.account_deletion_requests', 'select')
  and not has_table_privilege('anon', 'private.account_deletion_requests', 'select')
  and not has_table_privilege('service_role', 'private.account_deletion_requests', 'select'),
  'CA-29: no API role reads the requests'
);
select ok(
  has_function_privilege('authenticated', 'public.request_account_deletion(boolean)', 'execute')
  and has_function_privilege('authenticated', 'public.cancel_account_deletion()', 'execute')
  and has_function_privilege('authenticated', 'public.get_my_account_deletion()', 'execute'),
  'the page functions are executable with an account'
);
select ok(
  not has_function_privilege('anon', 'public.request_account_deletion(boolean)', 'execute')
  and not has_function_privilege('anon', 'public.cancel_account_deletion()', 'execute')
  and not has_function_privilege('anon', 'public.get_my_account_deletion()', 'execute'),
  'CA-29: anon executes none of them'
);
select ok(
  (select bool_and(p.prosecdef and p.proconfig @> array['search_path=""'])
   from pg_proc p
   where p.oid in (
     'public.request_account_deletion(boolean)'::regprocedure,
     'public.cancel_account_deletion()'::regprocedure,
     'public.get_my_account_deletion()'::regprocedure,
     'private.auth_sessions_cancel_account_deletion()'::regprocedure
   )),
  'security definer functions with an empty search_path'
);
select has_trigger('auth', 'sessions', 'on_auth_session_created_cancel_account_deletion', 'trigger on auth.sessions');

-- The heir: one rule for the request, get_account_deletion_outcome() and the base trigger.
select is(
  private.household_heir('11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001'),
  'a1000000-0000-4000-8000-000000000002'::uuid,
  'the heir of Marco is Laura (joined first among the other adults with an account)'
);

set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated","session_id":"5e5d0000-0000-4000-8000-000000000001"}';
select results_eq(
  $$ select o.deletes_household, o.next_admin_member_id from public.get_account_deletion_outcome() o $$,
  $$ values (false, 'a1000000-0000-4000-8000-000000000002'::uuid) $$,
  'get_account_deletion_outcome() names the same heir'
);

-- ---------------------------------------------------------------------------
-- CA-13, CA-30: refused requests change nothing
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ select public.request_account_deletion(true) $$, 'FN003', 'account deletion outcome changed',
  'CA-13: with true while other adults with an account are in the household, FN003'
);
select throws_ok($$ select public.request_account_deletion(null) $$, '22004', null, 'a null outcome gives 22004');
set local request.method to 'GET';
select throws_ok($$ select public.request_account_deletion(false) $$, 'P0001', 'use POST', 'CA-30: request refuses GET');
select throws_ok($$ select public.cancel_account_deletion() $$, 'P0001', 'use POST', 'CA-30: cancel refuses GET');
set local request.method to 'PATCH';
select throws_ok($$ select public.request_account_deletion(false) $$, 'P0001', 'use POST', 'CA-30: request refuses PATCH');
set local request.method to 'POST';

reset role;
select is_empty($$ select 1 from private.account_deletion_requests $$, 'CA-13: no request was written');
select results_eq(
  $$ select m.is_admin from public.household_members m
     where m.id in ('a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002') order by m.id $$,
  $$ values (true), (false) $$,
  'CA-13: Marco is still the administrator, Laura is not'
);
select is(
  (select count(*)::integer from auth.sessions s where s.user_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  2,
  'CA-13: the sessions of Marco are still there'
);

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok($$ select public.request_account_deletion(false) $$, '42501', null, 'CA-29: anon cannot request');
select throws_ok($$ select * from public.get_my_account_deletion() $$, '42501', null, 'CA-29: anon cannot read');
select throws_ok($$ select 1 from private.account_deletion_requests $$, '42501', null, 'CA-29: anon cannot reach the table');

-- ---------------------------------------------------------------------------
-- CA-12: Marco, only administrator, asks to delete the account
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated","session_id":"5e5d0000-0000-4000-8000-000000000001"}';
select is(
  public.request_account_deletion(false),
  (now() at time zone 'Europe/Rome')::date + 14,
  'CA-12: delete_on is the day of the request (Rome) + 14'
);
select results_eq(
  $$ select d.delete_on, d.deletes_household from public.get_my_account_deletion() d $$,
  $$ values ((now() at time zone 'Europe/Rome')::date + 14, false) $$,
  'CA-12: get_my_account_deletion() gives the day and deletes_household false'
);
select is(
  public.request_account_deletion(false),
  (now() at time zone 'Europe/Rome')::date + 14,
  'a second request keeps the same delete_on'
);
select throws_ok($$ select 1 from private.account_deletion_requests $$, '42501', null, 'CA-29: Marco cannot reach the table');

reset role;
select is((select count(*)::integer from private.account_deletion_requests), 1, 'one request only');
select results_eq(
  $$ select m.id, m.is_admin from public.household_members m
     where m.household_id = '11111111-1111-4111-8111-111111111111' and m.kind = 'adult' order by m.id $$,
  $$ values ('a1000000-0000-4000-8000-000000000001'::uuid, false), ('a1000000-0000-4000-8000-000000000002'::uuid, true),
            ('a1000000-0000-4000-8000-000000000006'::uuid, false) $$,
  'CA-12: Laura is administrator, Marco is not (Piero unchanged)'
);
select results_eq(
  $$ select n.recipient_member_id, n.actor_member_id from public.notifications n where n.kind = 'household_handed_over' $$,
  $$ values ('a1000000-0000-4000-8000-000000000002'::uuid, 'a1000000-0000-4000-8000-000000000001'::uuid) $$,
  'CA-12: Laura has household_handed_over with Marco as actor (once, also after the second request)'
);
select is_empty(
  $$ select 1 from auth.sessions s where s.user_id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  'CA-12: Marco has no session left'
);
select is_empty(
  $$ select 1 from auth.refresh_tokens r where r.user_id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  'CA-12: Marco has no refresh token left'
);
select is_empty(
  $$ select 1 from public.push_subscriptions s where s.member_id = 'a1000000-0000-4000-8000-000000000001' $$,
  'CA-12: Marco has no push device left'
);
select is(
  (select count(*)::integer from auth.sessions s where s.user_id = 'aaaaaaaa-0000-4000-8000-000000000002'),
  1,
  'the session of Laura is untouched'
);
select results_eq(
  $$ select d.kind::text, d.due_at = n.created_at
     from private.push_deliveries d join public.notifications n on n.id = d.notification_id
     where n.kind = 'household_handed_over' $$,
  $$ values ('single', true) $$,
  'CA-33: the handover rings at once also with «Solo il riepilogo»'
);
select is_empty(
  $$ select 1 from private.push_digest_items i join public.notifications n on n.id = i.notification_id
     where n.kind = 'household_handed_over' $$,
  'CA-33: and it does not wait for the summary'
);

-- Legale-privacy advice: no optional consent while the deletion is pending.
select is(
  private.has_consent('aaaaaaaa-0000-4000-8000-000000000001', 'usage_analytics'), false,
  'has_consent() is false during the request'
);

-- Laura (now administrator) reads the notification; its push says who asked.
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated","session_id":"5e5d0000-0000-4000-8000-000000000011"}';
select results_eq(
  $$ select n.kind::text, n.actor_member_id from public.notifications n where n.kind = 'household_handed_over' $$,
  $$ values ('household_handed_over', 'a1000000-0000-4000-8000-000000000001'::uuid) $$,
  'Laura sees household_handed_over in Notifiche'
);

-- ---------------------------------------------------------------------------
-- CA-21, CA-27, CA-28: nobody else sees or cancels the request
-- ---------------------------------------------------------------------------
select is_empty($$ select * from public.get_my_account_deletion() $$, 'CA-21: Laura does not see the request of Marco');
select lives_ok($$ select public.cancel_account_deletion() $$, 'CA-21: Laura cancels without error');
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select is_empty($$ select * from public.get_my_account_deletion() $$, 'CA-27: Giulia (Casa Bianchi) sees nothing');
select lives_ok($$ select public.cancel_account_deletion() $$, 'CA-27: Giulia cancels without error');
reset role;
select is(
  (select count(*)::integer from private.account_deletion_requests r where r.user_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  1,
  'CA-21, CA-27: the request of Marco is still there'
);

-- ---------------------------------------------------------------------------
-- CA-15: Marco thinks it over
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated","session_id":"5e5d0000-0000-4000-8000-000000000001"}';
select lives_ok($$ select public.cancel_account_deletion() $$, 'CA-15: Marco cancels');
select is_empty($$ select * from public.get_my_account_deletion() $$, 'CA-15: get_my_account_deletion() gives 0 rows');
reset role;
select results_eq(
  $$ select m.is_admin from public.household_members m
     where m.id in ('a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002') order by m.id $$,
  $$ values (false), (true) $$,
  'CA-15: Laura stays administrator (question 6)'
);
select is(
  private.has_consent('aaaaaaaa-0000-4000-8000-000000000001', 'usage_analytics'), true,
  'has_consent() is true again after the cancellation'
);

-- ---------------------------------------------------------------------------
-- CA-16: a new sign-in cancels the request
-- ---------------------------------------------------------------------------
set local role authenticated;
select is(
  public.request_account_deletion(false),
  (now() at time zone 'Europe/Rome')::date + 14,
  'Marco asks again (no longer administrator: no handover)'
);
reset role;
select is(
  (select count(*)::integer from public.notifications n where n.kind = 'household_handed_over'),
  1,
  'no new handover for who is not administrator'
);
insert into auth.sessions (id, user_id, created_at, updated_at)
values ('5e5d0000-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001', now(), now());
select is_empty(
  $$ select 1 from private.account_deletion_requests r where r.user_id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  'CA-16: after a new session of Marco the request is gone'
);
select isnt_empty(
  $$ select 1 from auth.sessions s where s.id = '5e5d0000-0000-4000-8000-000000000003' $$,
  'CA-16: and the session exists'
);

-- After delete_on, neither a sign-in nor «Annulla» takes the request away (the job deletes).
set local role authenticated;
select lives_ok($$ select public.request_account_deletion(false) $$, 'Marco asks once more');
reset role;
update private.account_deletion_requests
set delete_on = (now() at time zone 'Europe/Rome')::date - 1
where user_id = 'aaaaaaaa-0000-4000-8000-000000000001';
insert into auth.sessions (id, user_id, created_at, updated_at)
values ('5e5d0000-0000-4000-8000-000000000004', 'aaaaaaaa-0000-4000-8000-000000000001', now(), now());
set local role authenticated;
select lives_ok($$ select public.cancel_account_deletion() $$, 'cancel after delete_on gives no error');
reset role;
select is(
  (select count(*)::integer from private.account_deletion_requests r where r.user_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  1,
  'rule 9: after delete_on the request stays (sign-in and cancel)'
);
delete from private.account_deletion_requests where user_id = 'aaaaaaaa-0000-4000-8000-000000000001';

-- ---------------------------------------------------------------------------
-- CA-14: the only adult with an account; an adult without household
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok(
  $$ select set_config('test.casa_neri', public.create_household('Casa Neri', 'single', 'Chiara', 'salvia')::text, true) $$,
  'Chiara creates Casa Neri'
);
select throws_ok(
  $$ select public.request_account_deletion(false) $$, 'FN003', 'account deletion outcome changed',
  'the only adult with false gives FN003'
);
select is(
  public.request_account_deletion(true), (now() at time zone 'Europe/Rome')::date + 14,
  'CA-14: the only adult asks with true'
);
select results_eq(
  $$ select d.deletes_household from public.get_my_account_deletion() d $$,
  $$ values (true) $$,
  'CA-14: the request has deletes_household = true'
);
reset role;
select isnt_empty(
  $$ select 1 from public.households h where h.id = current_setting('test.casa_neri')::uuid $$,
  'CA-14: Casa Neri still exists'
);
select results_eq(
  $$ select r.household_id from private.account_deletion_requests r where r.user_id = 'cccccccc-0000-4000-8000-000000000001' $$,
  $$ values (current_setting('test.casa_neri')::uuid) $$,
  'the request keeps the household of that moment'
);

set local role authenticated;
set local request.jwt.claims to '{"sub":"dddddddd-0000-4000-8000-000000000005","role":"authenticated"}';
select results_eq(
  $$ select public.request_account_deletion(false) $$,
  $$ values ((now() at time zone 'Europe/Rome')::date + 14) $$,
  'an adult without household asks with false'
);
reset role;
select results_eq(
  $$ select r.household_id, r.deletes_household from private.account_deletion_requests r
     where r.user_id = 'dddddddd-0000-4000-8000-000000000005' $$,
  $$ values (null::uuid, false) $$,
  'without household: no household and deletes_household false'
);

-- ---------------------------------------------------------------------------
-- «In coppia» (#652): neither the handover nor the request is blocked
-- ---------------------------------------------------------------------------
select ok(
  private.household_is_couple('d5130000-0000-4000-8000-0000000000a1')
  and private.household_is_couple('d5130000-0000-4000-8000-0000000000a2'),
  'Casa Rossi and Casa Verdi are couples'
);

set local role authenticated;
set local request.jwt.claims to '{"sub":"dddddddd-0000-4000-8000-000000000001","role":"authenticated","session_id":"5e5d0000-0000-4000-8000-000000000021"}';
select lives_ok(
  $$ select public.request_account_deletion(false) $$,
  'couple with one organiser: Dario asks to delete the account'
);
reset role;
select results_eq(
  $$ select m.name, m.is_admin from public.household_members m
     where m.household_id = 'd5130000-0000-4000-8000-0000000000a1' order by m.name $$,
  $$ values ('Dario'::text, false), ('Elena', true) $$,
  'couple: Elena organises, Dario no longer (the «in coppia» guard does not block the handover)'
);
select results_eq(
  $$ select d.kind::text from private.push_deliveries d join public.notifications n on n.id = d.notification_id
     where n.kind = 'household_handed_over' and n.recipient_member_id = 'd5130000-0000-4000-8000-0000000000b2' $$,
  $$ values ('single') $$,
  'CA-33: Elena (default «Subito quelle per me») gets the push at once'
);

set local role authenticated;
set local request.jwt.claims to '{"sub":"dddddddd-0000-4000-8000-000000000003","role":"authenticated"}';
select lives_ok(
  $$ select public.request_account_deletion(false) $$,
  'couple of two organisers: Fabio asks to delete the account'
);
reset role;
select results_eq(
  $$ select m.name, m.is_admin from public.household_members m
     where m.household_id = 'd5130000-0000-4000-8000-0000000000a2' order by m.name $$,
  $$ values ('Fabio'::text, true), ('Gina', true) $$,
  'couple of two organisers: nothing to hand over, both keep the role'
);
select is_empty(
  $$ select 1 from public.notifications n
     where n.kind = 'household_handed_over' and n.household_id = 'd5130000-0000-4000-8000-0000000000a2' $$,
  'and nobody gets household_handed_over'
);

select * from finish();
rollback;
