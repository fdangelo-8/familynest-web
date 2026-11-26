-- The push devices (issue #511, DB-2 of plan #501, part 1): public.push_subscriptions,
-- register_push_subscription(), unregister_push_subscription(), the cleanup
-- private.push_purge() and what goes when a member leaves or deletes the account
-- (CA-8 – CA-16, the devices part of CA-40), with the privileges.
-- Seed ids: Marco (Casa D'Angelo, admin, user aaaaaaaa…01, member a1…01), Laura a1…02;
-- Giulia (Casa Bianchi, bbbbbbbb…01, b1…01); Chiara (cccccccc…01, no household).
-- This test gives Laura an account (user aaaaaaaa…02) and adds a third adult, Davide
-- (a1…06, user aaaaaaaa…03). The seed has no devices. Every instant is relative to now().
-- The addresses are made up: no real device.
begin;
create extension if not exists pgtap with schema extensions;

select plan(101);

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-4000-8000-000000000002', 'authenticated',
   'authenticated', 'utente-laura@example.com', '{"full_name":"Laura Test"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-4000-8000-000000000003', 'authenticated',
   'authenticated', 'utente-davide@example.com', '{"full_name":"Davide Test"}', now(), now());
update public.household_members
set user_id = 'aaaaaaaa-0000-4000-8000-000000000002', joined_at = now()
where id = 'a1000000-0000-4000-8000-000000000002';
insert into public.household_members (id, household_id, kind, name, color, user_id, joined_at)
values ('a1000000-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111', 'adult', 'Davide',
        'lampone', 'aaaaaaaa-0000-4000-8000-000000000003', now());

-- ---------------------------------------------------------------------------
-- Schema and privileges
-- ---------------------------------------------------------------------------
select has_table('public', 'push_subscriptions', 'push_subscriptions exists');
select ok(
  (select c.relrowsecurity from pg_class c where c.oid = 'public.push_subscriptions'::regclass),
  'RLS enabled on push_subscriptions'
);
select columns_are(
  'public', 'push_subscriptions',
  array['id', 'household_id', 'member_id', 'platform', 'endpoint', 'p256dh', 'auth', 'token',
        'created_at', 'last_seen_at', 'updated_at'],
  'rule 3: push_subscriptions has exactly the planned columns'
);
select fk_ok(
  'public', 'push_subscriptions', array['member_id', 'household_id'],
  'public', 'household_members', array['id', 'household_id'],
  'rule 3: the member is a member of the same household (composite foreign key)'
);
select col_is_unique('public', 'push_subscriptions', 'endpoint', 'rule 3: one row per endpoint in the database');
select has_index('public', 'push_subscriptions', 'push_subscriptions_token_key', 'rule 3: one row per token in the database');
select has_index('public', 'push_subscriptions', 'push_subscriptions_member_id_idx', 'index on the member (foreign key, RLS)');
select has_index('public', 'push_subscriptions', 'push_subscriptions_household_id_idx', 'index on the household (foreign key)');
select has_index('public', 'push_subscriptions', 'push_subscriptions_last_seen_at_idx', 'index for the cleanup of 90 days');
select policies_are(
  'public', 'push_subscriptions',
  array['push_subscriptions_select', 'push_subscriptions_insert', 'push_subscriptions_update', 'push_subscriptions_delete'],
  'one policy per operation'
);
select ok(
  has_column_privilege('authenticated', 'public.push_subscriptions', 'id', 'select')
  and has_column_privilege('authenticated', 'public.push_subscriptions', 'platform', 'select')
  and has_column_privilege('authenticated', 'public.push_subscriptions', 'created_at', 'select')
  and has_column_privilege('authenticated', 'public.push_subscriptions', 'last_seen_at', 'select')
  and not has_column_privilege('authenticated', 'public.push_subscriptions', 'endpoint', 'select')
  and not has_column_privilege('authenticated', 'public.push_subscriptions', 'p256dh', 'select')
  and not has_column_privilege('authenticated', 'public.push_subscriptions', 'auth', 'select')
  and not has_column_privilege('authenticated', 'public.push_subscriptions', 'token', 'select')
  and not has_column_privilege('authenticated', 'public.push_subscriptions', 'member_id', 'select')
  and not has_column_privilege('authenticated', 'public.push_subscriptions', 'household_id', 'select'),
  'CA-13: the app reads only id, platform, created_at and last_seen_at'
);
select ok(
  not has_table_privilege('authenticated', 'public.push_subscriptions', 'insert')
  and not has_table_privilege('authenticated', 'public.push_subscriptions', 'update')
  and not has_table_privilege('authenticated', 'public.push_subscriptions', 'delete')
  and not has_any_column_privilege('authenticated', 'public.push_subscriptions', 'insert')
  and not has_any_column_privilege('authenticated', 'public.push_subscriptions', 'update'),
  'CA-13: no direct insert, update or delete'
);
select ok(
  not has_any_column_privilege('anon', 'public.push_subscriptions', 'select')
  and not has_table_privilege('anon', 'public.push_subscriptions', 'select, insert, update, delete'),
  'CA-40: anon has no privilege on push_subscriptions'
);
select ok(
  has_function_privilege('authenticated', 'public.register_push_subscription(public.push_platform, text, text, text, text)', 'execute')
  and has_function_privilege('authenticated', 'public.unregister_push_subscription(text, text)', 'execute')
  and not has_function_privilege('anon', 'public.register_push_subscription(public.push_platform, text, text, text, text)', 'execute')
  and not has_function_privilege('anon', 'public.unregister_push_subscription(text, text)', 'execute'),
  'CA-40: register and unregister for signed-in users only'
);
select ok(
  (select bool_and(p.prosecdef and p.proconfig @> array['search_path=""']) from pg_proc p
   where p.oid in ('public.register_push_subscription(public.push_platform, text, text, text, text)'::regprocedure,
                   'public.unregister_push_subscription(text, text)'::regprocedure)),
  'register and unregister are security definer with an empty search_path'
);
select ok(
  not has_function_privilege('anon', 'private.push_purge(timestamptz, uuid)', 'execute')
  and not has_function_privilege('authenticated', 'private.push_purge(timestamptz, uuid)', 'execute')
  and not has_function_privilege('service_role', 'private.push_purge(timestamptz, uuid)', 'execute')
  and not has_function_privilege('anon', 'private.push_subscription_is_valid(public.push_platform, text, text, text, text)', 'execute'),
  'the cleanup: the database owner only; the address check never for anon'
);
select ok(
  not exists (
    select 1 from pg_publication_tables p
    where p.pubname = 'supabase_realtime' and p.schemaname = 'public' and p.tablename = 'push_subscriptions'
  ),
  'push_subscriptions is not sent in real time'
);

-- ---------------------------------------------------------------------------
-- CA-8: Marco registers the same web device twice: one row, same id, last_seen_at updated
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';

select set_config(
  'test.web',
  public.register_push_subscription(
    'web', 'https://fcm.googleapis.com/fcm/send/marco-phone', repeat('B', 87), repeat('a', 22)
  )::text,
  true
);

reset role;
update public.push_subscriptions
set last_seen_at = now() - interval '3 days', created_at = now() - interval '3 days'
where id = current_setting('test.web')::uuid;
set local role authenticated;

select is(
  public.register_push_subscription(
    'web', 'https://fcm.googleapis.com/fcm/send/marco-phone', repeat('C', 87), repeat('b', 22)
  ),
  current_setting('test.web')::uuid,
  'CA-8: the second registration gives the same id'
);
select is((select count(*)::integer from public.push_subscriptions), 1, 'CA-8: one row only');
select is((select s.last_seen_at from public.push_subscriptions s), now(), 'CA-8: last_seen_at updated');

-- ---------------------------------------------------------------------------
-- CA-9: an APNs token (saved in lower case) and an FCM token
-- ---------------------------------------------------------------------------
select set_config(
  'test.apns',
  public.register_push_subscription('apns', p_token => upper(repeat('ab', 32)))::text,
  true
);
select set_config(
  'test.fcm',
  public.register_push_subscription('fcm', p_token => 'fcm:marco_token-1')::text,
  true
);
select results_eq(
  $$ select s.platform::text from public.push_subscriptions s order by s.platform $$,
  $$ values ('web'), ('apns'), ('fcm') $$,
  'CA-9: Marco has three devices'
);

reset role;
select results_eq(
  $$ select s.p256dh, s.auth, s.created_at < now(), s.last_seen_at = now()
     from public.push_subscriptions s where s.id = current_setting('test.web')::uuid $$,
  $$ values (repeat('C', 87), repeat('b', 22), true, true) $$,
  'CA-8: same row, with the keys sent last; created_at kept'
);
select results_eq(
  $$ select s.platform::text, s.endpoint is null, s.p256dh is null, s.auth is null, s.token
     from public.push_subscriptions s
     where s.id in (current_setting('test.apns')::uuid, current_setting('test.fcm')::uuid)
     order by s.platform $$,
  $$ values ('apns', true, true, true, repeat('ab', 32)),
            ('fcm', true, true, true, 'fcm:marco_token-1') $$,
  'CA-9: endpoint, p256dh and auth null; the APNs token in lower case'
);
select results_eq(
  $$ select s.member_id, s.household_id from public.push_subscriptions s
     where s.id = current_setting('test.fcm')::uuid $$,
  $$ values ('a1000000-0000-4000-8000-000000000001'::uuid, '11111111-1111-4111-8111-111111111111'::uuid) $$,
  'the member and the household are those of the session'
);
set local role authenticated;

-- ---------------------------------------------------------------------------
-- CA-10: invalid addresses give 22023 and nothing is written
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ select public.register_push_subscription('web', 'http://fcm.googleapis.com/fcm/send/x', repeat('B', 87), repeat('a', 22)) $$,
  '22023', null, 'CA-10: web over http'
);
select throws_ok(
  $$ select public.register_push_subscription('web', 'https://push.example.com/x', repeat('B', 87), repeat('a', 22)) $$,
  '22023', null, 'CA-10: web on a host outside the list'
);
select throws_ok(
  $$ select public.register_push_subscription('web', 'https://fcm.googleapis.com.example.com/x', repeat('B', 87), repeat('a', 22)) $$,
  '22023', null, 'CA-10: web on a host that only starts like one of the list'
);
select throws_ok(
  $$ select public.register_push_subscription('web', 'https://user@fcm.googleapis.com/x', repeat('B', 87), repeat('a', 22)) $$,
  '22023', null, 'CA-10: web with a user in the address'
);
select throws_ok(
  $$ select public.register_push_subscription('web', 'https://fcm.googleapis.com:8443/x', repeat('B', 87), repeat('a', 22)) $$,
  '22023', null, 'CA-10: web with a port'
);
select throws_ok(
  $$ select public.register_push_subscription('web', 'https://localhost/x', repeat('B', 87), repeat('a', 22)) $$,
  '22023', null, 'CA-10: web on an internal address'
);
select throws_ok(
  $$ select public.register_push_subscription('web', 'https://fcm.googleapis.com/fcm/send/x', null, repeat('a', 22)) $$,
  '22023', null, 'CA-10: web without p256dh'
);
select throws_ok(
  $$ select public.register_push_subscription('web', 'https://fcm.googleapis.com/fcm/send/x', repeat('B', 86), repeat('a', 22)) $$,
  '22023', null, 'CA-10: web with a p256dh of 86 characters'
);
select throws_ok(
  $$ select public.register_push_subscription('web', 'https://fcm.googleapis.com/fcm/send/x', repeat('B', 87), repeat('a', 22), 'fcm:x') $$,
  '22023', null, 'CA-10: web with a token too'
);
select throws_ok(
  $$ select public.register_push_subscription('web', 'https://fcm.googleapis.com/' || repeat('x', 2030), repeat('B', 87), repeat('a', 22)) $$,
  '22023', null, 'CA-10: web endpoint longer than 2048 characters'
);
select throws_ok(
  $$ select public.register_push_subscription('apns', 'https://web.push.apple.com/x', null, null, repeat('ab', 32)) $$,
  '22023', null, 'CA-10: apns with an endpoint'
);
select throws_ok(
  $$ select public.register_push_subscription('apns', p_token => repeat('zz', 32)) $$,
  '22023', null, 'CA-10: apns not hexadecimal'
);
select throws_ok(
  $$ select public.register_push_subscription('apns', p_token => repeat('a', 63)) $$,
  '22023', null, 'CA-10: apns of 63 characters'
);
select throws_ok(
  $$ select public.register_push_subscription('fcm', p_token => 'fcm token') $$,
  '22023', null, 'CA-10: fcm with a space'
);
select throws_ok(
  $$ select public.register_push_subscription('fcm', p_token => repeat('a', 4097)) $$,
  '22023', null, 'CA-10: fcm longer than 4096 characters'
);
select throws_ok(
  $$ select public.register_push_subscription(null, p_token => 'fcm:x') $$,
  '22023', null, 'CA-10: no platform'
);
select is((select count(*)::integer from public.push_subscriptions), 3, 'CA-10: nothing was written');

-- The other hosts of question 4.
select lives_ok(
  $$ select public.register_push_subscription('web', 'https://updates.push.services.mozilla.com/wpush/v2/marco', repeat('B', 87), repeat('a', 22)) $$,
  'rule 3: *.push.services.mozilla.com is allowed'
);
select lives_ok(
  $$ select public.register_push_subscription('web', 'https://wns2-par02p.notify.windows.com/w/?token=marco', repeat('B', 87), repeat('a', 22)) $$,
  'rule 3: *.notify.windows.com is allowed'
);
select lives_ok(
  $$ select public.register_push_subscription('web', 'https://web.push.apple.com/QK-marco', repeat('B', 87), repeat('a', 22)) $$,
  'rule 3: *.push.apple.com is allowed'
);

-- ---------------------------------------------------------------------------
-- CA-11: at most 10 devices per member
-- ---------------------------------------------------------------------------
do $$
begin
  for i in 7..10 loop
    perform public.register_push_subscription('fcm', p_token => 'fcm:marco-extra-' || i);
  end loop;
end
$$;
select is((select count(*)::integer from public.push_subscriptions), 10, 'CA-11: Marco has 10 devices');
select throws_ok(
  $$ select public.register_push_subscription('fcm', p_token => 'fcm:marco-eleventh') $$,
  '23514', null, 'CA-11: the eleventh gives 23514'
);
select is((select count(*)::integer from public.push_subscriptions), 10, 'CA-11: still 10');
select is(
  public.register_push_subscription('apns', p_token => upper(repeat('ab', 32))),
  current_setting('test.apns')::uuid,
  'CA-11: at the limit a device already saved registers again (same row)'
);

-- ---------------------------------------------------------------------------
-- CA-12: Laura registers the endpoint of Marco: the row is hers
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}';
select set_config(
  'test.laura_web',
  public.register_push_subscription(
    'web', 'https://fcm.googleapis.com/fcm/send/marco-phone', repeat('D', 87), repeat('c', 22)
  )::text,
  true
);
select isnt(current_setting('test.laura_web'), current_setting('test.web'), 'CA-12: a new row, nothing of Marco passes on');
select results_eq(
  $$ select s.id from public.push_subscriptions s $$,
  $$ values (current_setting('test.laura_web')::uuid) $$,
  'CA-12: Laura reads only her own device'
);

reset role;
select results_eq(
  $$ select s.member_id, s.household_id, s.p256dh from public.push_subscriptions s
     where s.endpoint = 'https://fcm.googleapis.com/fcm/send/marco-phone' $$,
  $$ values ('a1000000-0000-4000-8000-000000000002'::uuid, '11111111-1111-4111-8111-111111111111'::uuid, repeat('D', 87)) $$,
  'CA-12: the endpoint belongs to Laura'
);
select is(
  (select count(*)::integer from public.push_subscriptions s where s.member_id = 'a1000000-0000-4000-8000-000000000001'),
  9,
  'CA-12: Marco no longer has it'
);

-- ---------------------------------------------------------------------------
-- CA-13: what Marco reads, what he cannot read or write
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';

select is(
  (select count(*)::integer from (select s.id, s.platform, s.created_at, s.last_seen_at from public.push_subscriptions s) x),
  9,
  'CA-13: Marco reads id, platform, created_at, last_seen_at of his 9 devices'
);
select throws_ok($$ select s.endpoint from public.push_subscriptions s $$, '42501', null, 'CA-13: endpoint is not readable');
select throws_ok($$ select s.p256dh from public.push_subscriptions s $$, '42501', null, 'CA-13: p256dh is not readable');
select throws_ok($$ select s.auth from public.push_subscriptions s $$, '42501', null, 'CA-13: auth is not readable');
select throws_ok($$ select s.token from public.push_subscriptions s $$, '42501', null, 'CA-13: token is not readable');
select throws_ok($$ select * from public.push_subscriptions $$, '42501', null, 'CA-13: select * is refused');
select throws_ok(
  $$ insert into public.push_subscriptions (household_id, member_id, platform, token)
     values ('11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001', 'fcm', 'fcm:direct') $$,
  '42501', null, 'CA-13: no direct insert'
);
select throws_ok(
  $$ update public.push_subscriptions set last_seen_at = now() $$,
  '42501', null, 'CA-13: no direct update'
);
select throws_ok(
  $$ delete from public.push_subscriptions $$,
  '42501', null, 'no direct delete'
);

-- ---------------------------------------------------------------------------
-- CA-14: unregister only a device of the caller, without error
-- ---------------------------------------------------------------------------
select lives_ok(
  $$ select public.unregister_push_subscription('https://updates.push.services.mozilla.com/wpush/v2/marco') $$,
  'CA-14: Marco forgets his Firefox'
);
select is((select count(*)::integer from public.push_subscriptions), 8, 'CA-14: the row is gone');
select lives_ok(
  $$ select public.unregister_push_subscription('https://fcm.googleapis.com/fcm/send/marco-phone') $$,
  'CA-14: the endpoint of Laura: no error'
);
select lives_ok(
  $$ select public.unregister_push_subscription(p_token => upper(repeat('ab', 32))) $$,
  'CA-14: an APNs token in upper case finds the saved one'
);
select is((select count(*)::integer from public.push_subscriptions), 7, 'CA-14: the APNs device is gone');
select throws_ok($$ select public.unregister_push_subscription() $$, '22023', null, 'neither endpoint nor token: 22023');
select throws_ok(
  $$ select public.unregister_push_subscription('https://web.push.apple.com/QK-marco', 'fcm:marco_token-1') $$,
  '22023', null, 'both endpoint and token: 22023'
);

reset role;
select ok(
  exists (select 1 from public.push_subscriptions s where s.id = current_setting('test.laura_web')::uuid),
  'CA-14: the device of Laura is still there'
);

-- ---------------------------------------------------------------------------
-- CA-40 (devices): Giulia (Casa Bianchi) reads and changes nothing of Casa D'Angelo
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';

select is_empty($$ select s.id from public.push_subscriptions s $$, 'CA-40: Giulia reads no device');
select lives_ok(
  $$ select public.unregister_push_subscription(p_token => 'fcm:marco_token-1') $$,
  'CA-40: the token of Marco: no error'
);
select lives_ok(
  $$ select public.unregister_push_subscription('https://web.push.apple.com/QK-marco') $$,
  'CA-40: the endpoint of Marco: no error'
);
select set_config(
  'test.giulia',
  public.register_push_subscription('web', 'https://web.push.apple.com/giulia', repeat('E', 87), repeat('d', 22))::text,
  true
);
select results_eq(
  $$ select s.id from public.push_subscriptions s $$,
  $$ values (current_setting('test.giulia')::uuid) $$,
  'CA-40: Giulia reads only her own device'
);

reset role;
select is(
  (select count(*)::integer from public.push_subscriptions s where s.member_id = 'a1000000-0000-4000-8000-000000000001'),
  7,
  'CA-40: the devices of Marco are untouched'
);
select results_eq(
  $$ select s.member_id, s.household_id from public.push_subscriptions s where s.id = current_setting('test.giulia')::uuid $$,
  $$ values ('b1000000-0000-4000-8000-000000000001'::uuid, '22222222-2222-4222-8222-222222222222'::uuid) $$,
  'the device of Giulia belongs to Casa Bianchi'
);

-- Without household, anon, only POST.
set local role authenticated;
set local request.jwt.claims to '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select public.register_push_subscription('fcm', p_token => 'fcm:chiara') $$,
  '42501', null, 'without household: 42501'
);
select throws_ok(
  $$ select public.unregister_push_subscription(p_token => 'fcm:chiara') $$,
  '42501', null, 'without household: unregister 42501'
);

set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
set local request.method to 'GET';
select throws_ok(
  $$ select public.register_push_subscription('fcm', p_token => 'fcm:marco-get') $$,
  'P0001', 'use POST', 'register: GET is refused'
);
set local request.method to 'PATCH';
select throws_ok(
  $$ select public.unregister_push_subscription(p_token => 'fcm:marco_token-1') $$,
  'P0001', 'use POST', 'unregister: PATCH is refused'
);
set local request.method to 'POST';

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok(
  $$ select public.register_push_subscription('fcm', p_token => 'fcm:anon') $$,
  '42501', null, 'CA-40: anon cannot register'
);
select throws_ok(
  $$ select public.unregister_push_subscription(p_token => 'fcm:marco_token-1') $$,
  '42501', null, 'CA-40: anon cannot unregister'
);
select throws_ok($$ select s.id from public.push_subscriptions s $$, '42501', null, 'CA-40: anon cannot read devices');

reset role;
select is(
  (select count(*)::integer from public.push_subscriptions),
  9,
  'nothing changed: 7 devices of Marco, 1 of Laura, 1 of Giulia'
);

-- ---------------------------------------------------------------------------
-- CA-15: devices not used for more than 90 days are removed
-- ---------------------------------------------------------------------------
update public.push_subscriptions set last_seen_at = now() - interval '91 days'
where endpoint = 'https://wns2-par02p.notify.windows.com/w/?token=marco';
update public.push_subscriptions set last_seen_at = now() - interval '89 days'
where endpoint = 'https://web.push.apple.com/QK-marco';
update public.push_subscriptions set last_seen_at = now() - interval '91 days'
where id = current_setting('test.giulia')::uuid;

select lives_ok(
  $$ select private.push_purge(now(), '11111111-1111-4111-8111-111111111111') $$,
  'CA-15: the cleanup of Casa D''Angelo'
);
select ok(
  not exists (select 1 from public.push_subscriptions s where s.endpoint = 'https://wns2-par02p.notify.windows.com/w/?token=marco'),
  'CA-15: 91 days without use: removed'
);
select ok(
  exists (select 1 from public.push_subscriptions s where s.endpoint = 'https://web.push.apple.com/QK-marco'),
  'CA-15: 89 days without use: kept'
);
select ok(
  exists (select 1 from public.push_subscriptions s where s.id = current_setting('test.giulia')::uuid),
  'the cleanup of one household never touches another'
);
select lives_ok($$ select private.push_purge(now(), null) $$, 'CA-15: the cleanup of every household (the job)');
select ok(
  not exists (select 1 from public.push_subscriptions s where s.id = current_setting('test.giulia')::uuid),
  'CA-15: the old device of Giulia is removed by the job'
);
select throws_ok($$ select private.push_purge(null, null) $$, '22023', null, 'the cleanup needs an instant');
select throws_ok($$ select private.push_purge('infinity', null) $$, '22023', null, 'the cleanup needs a finite instant');

-- ---------------------------------------------------------------------------
-- CA-16: leaving the household and deleting the account leave nothing behind
-- ---------------------------------------------------------------------------
-- Prepared by the database owner: preferences, one notification and two deliveries for
-- Marco and for Laura (the deliveries are written only by the database).
insert into public.notification_preferences (household_id, member_id, hide_content)
values ('11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001', true),
       ('11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000002', true);
insert into public.notifications (id, household_id, recipient_member_id, kind, actor_member_id, item_count)
values ('a7000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
        'a1000000-0000-4000-8000-000000000001', 'shopping_added', 'a1000000-0000-4000-8000-000000000006', 2),
       ('a7000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111',
        'a1000000-0000-4000-8000-000000000002', 'shopping_added', 'a1000000-0000-4000-8000-000000000006', 1);
insert into private.push_deliveries (household_id, recipient_member_id, kind, notification_id, digest_day, due_at)
values ('11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001', 'single',
        'a7000000-0000-4000-8000-000000000001', null, now()),
       ('11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001', 'evening_digest',
        null, (now() at time zone 'Europe/Rome')::date, now() + interval '1 hour'),
       ('11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000002', 'single',
        'a7000000-0000-4000-8000-000000000002', null, now()),
       ('11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000002', 'morning_digest',
        null, (now() at time zone 'Europe/Rome')::date + 1, now() + interval '1 day');
select is(
  (select count(*)::integer from private.push_deliveries),
  4,
  'CA-16: four deliveries prepared'
);

set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select results_eq(
  $$ delete from public.household_members where user_id = 'aaaaaaaa-0000-4000-8000-000000000001' returning name $$,
  $$ values ('Marco') $$,
  'CA-16: Marco leaves Casa D''Angelo'
);
reset role;
select is_empty(
  $$ select 1 from public.push_subscriptions s where s.member_id = 'a1000000-0000-4000-8000-000000000001' $$,
  'CA-16: no device of Marco left'
);
select is_empty(
  $$ select 1 from public.notification_preferences p where p.member_id = 'a1000000-0000-4000-8000-000000000001' $$,
  'CA-16: no preferences of Marco left'
);
select is_empty(
  $$ select 1 from private.push_deliveries d where d.recipient_member_id = 'a1000000-0000-4000-8000-000000000001' $$,
  'CA-16: no delivery of Marco left'
);

set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok($$ select public.delete_own_account(false) $$, 'CA-16: Laura deletes her account (Davide stays)');
reset role;
select is_empty(
  $$ select 1 from public.push_subscriptions s where s.member_id = 'a1000000-0000-4000-8000-000000000002' $$,
  'CA-16: no device of Laura left'
);
select is_empty(
  $$ select 1 from public.notification_preferences p where p.member_id = 'a1000000-0000-4000-8000-000000000002' $$,
  'CA-16: no preferences of Laura left'
);
select is_empty(
  $$ select 1 from private.push_deliveries d where d.recipient_member_id = 'a1000000-0000-4000-8000-000000000002' $$,
  'CA-16: no delivery of Laura left'
);
select ok(
  exists (select 1 from public.households h where h.id = '11111111-1111-4111-8111-111111111111'),
  'Casa D''Angelo still exists, with Davide'
);

select * from finish();
rollback;
