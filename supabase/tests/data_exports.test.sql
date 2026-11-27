-- «Esporta i miei dati» (issue #513, DB-4 part 2: CA-22 – CA-26, CA-36, CA-33 for
-- data_export_ready, and the export part of CA-27 – CA-30): data_exports, the private bucket
-- data-exports and its policies, start_data_export(), finish_data_export(),
-- fail_data_export(), get_my_data_export(), list_expired_data_exports(),
-- forget_data_export(), the job exports.
-- Seed ids: Casa D'Angelo 1111…: Marco (admin, aaaaaaaa…01, member a1…01), Laura (a1…02).
-- Casa Bianchi 2222…: Giulia (bbbbbbbb…01). This test gives Laura an account
-- (aaaaaaaa…02) and the role of administrator (CA-25: also an administrator sees nothing).
-- Files are rows of storage.objects written as in Supabase Storage; no real file.
-- The instants are relative to now() (LEZIONI).
begin;
create extension if not exists pgtap with schema extensions;

select plan(66);

-- ---------------------------------------------------------------------------
-- Setup (as database owner)
-- ---------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-4000-8000-000000000002', 'authenticated',
        'authenticated', 'utente-laura@example.com', '{"full_name":"Laura Test"}', now(), now());
update public.household_members
set user_id = 'aaaaaaaa-0000-4000-8000-000000000002', joined_at = now(), is_admin = true
where id = 'a1000000-0000-4000-8000-000000000002';

-- A device of Marco (default «Subito quelle per me»).
insert into public.push_subscriptions (household_id, member_id, platform, endpoint, p256dh, auth)
values ('11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001', 'web',
        'https://fcm.googleapis.com/fcm/send/513-export-marco', repeat('B', 87), repeat('a', 22));

-- An export of Laura, preparing.
insert into public.data_exports (id, user_id, requested_at)
values ('d5130000-0000-4000-8000-0000000000f2', 'aaaaaaaa-0000-4000-8000-000000000002', now());

-- ---------------------------------------------------------------------------
-- Schema, bucket and privileges
-- ---------------------------------------------------------------------------
select columns_are(
  'public', 'data_exports',
  array['id', 'user_id', 'status', 'requested_at', 'ready_at', 'expires_at', 'size_bytes', 'created_at', 'updated_at'],
  'data_exports keeps only the state of the export'
);
select enum_has_labels('public', 'data_export_status', array['preparing', 'ready', 'failed'], 'data_export_status labels');
select ok(
  (select c.relrowsecurity from pg_class c where c.oid = 'public.data_exports'::regclass),
  'RLS is enabled on data_exports'
);
select results_eq(
  $$ select b.public, b.file_size_limit, b.allowed_mime_types from storage.buckets b where b.id = 'data-exports' $$,
  $$ values (false, 52428800::bigint, array['application/zip']) $$,
  'CA-36: the bucket data-exports exists, is private and has the limit of 50 MiB'
);
select ok(
  not has_table_privilege('anon', 'public.data_exports', 'select')
  and not has_table_privilege('authenticated', 'public.data_exports', 'insert')
  and not has_table_privilege('authenticated', 'public.data_exports', 'update')
  and not has_table_privilege('authenticated', 'public.data_exports', 'delete'),
  'the app only reads data_exports; anon nothing'
);
select ok(
  not has_function_privilege('authenticated', 'public.list_expired_data_exports(integer)', 'execute')
  and not has_function_privilege('authenticated', 'public.forget_data_export(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.list_expired_data_exports(integer)', 'execute')
  and has_function_privilege('service_role', 'public.forget_data_export(uuid)', 'execute'),
  'list_expired_data_exports() and forget_data_export() only for service_role'
);
select ok(
  not has_function_privilege('anon', 'public.start_data_export()', 'execute')
  and not has_function_privilege('anon', 'public.finish_data_export(uuid, bigint)', 'execute')
  and not has_function_privilege('anon', 'public.fail_data_export(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.get_my_data_export()', 'execute')
  and has_function_privilege('authenticated', 'public.start_data_export()', 'execute'),
  'CA-29: the export functions only with an account'
);

-- ---------------------------------------------------------------------------
-- CA-22: start
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select set_config('test.export_1', public.start_data_export()::text, true);
select is(public.start_data_export()::text, current_setting('test.export_1'), 'CA-22: the second call gives the same id');
select results_eq(
  $$ select e.status::text, e.ready_at, e.expires_at, e.size_bytes from public.get_my_data_export() e $$,
  $$ values ('preparing'::text, null::timestamptz, null::timestamptz, null::bigint) $$,
  'CA-22: it is preparing'
);
select throws_ok(
  $$ insert into public.data_exports (user_id) values ('aaaaaaaa-0000-4000-8000-000000000001') $$, '42501', null,
  'Marco cannot write data_exports directly'
);
select throws_ok(
  $$ update public.data_exports set status = 'ready' $$, '42501', null,
  'nor change it'
);
select throws_ok($$ delete from public.data_exports $$, '42501', null, 'nor delete it');

-- ---------------------------------------------------------------------------
-- CA-24 (no file), CA-23: upload
-- ---------------------------------------------------------------------------
select throws_ok(
  format('select public.finish_data_export(%L, 1200000)', current_setting('test.export_1')), '22023', null,
  'CA-24: without the file finish gives 22023'
);
select is((select e.status::text from public.get_my_data_export() e), 'preparing', 'CA-24: and it stays preparing');

select lives_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('data-exports', %L) $$,
         'aaaaaaaa-0000-4000-8000-000000000001/' || current_setting('test.export_1') || '.zip'),
  'CA-23: Marco uploads data-exports/<his id>/<export id>.zip'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('data-exports', 'aaaaaaaa-0000-4000-8000-000000000002/d5130000-0000-4000-8000-0000000000f2.zip') $$,
  '42501', null,
  'CA-23: in the path of Laura (her export) it is refused'
);
select throws_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('data-exports', %L) $$,
         'aaaaaaaa-0000-4000-8000-000000000001/' || current_setting('test.export_1') || '.txt'),
  '42501', null,
  'any other name is refused'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('data-exports', 'aaaaaaaa-0000-4000-8000-000000000001/d5130000-0000-4000-8000-0000000000f9.zip') $$,
  '42501', null,
  'a file for an export that does not exist is refused'
);

select throws_ok(
  format('select public.finish_data_export(%L, 0)', current_setting('test.export_1')), '22023', null,
  'a size of 0 gives 22023'
);
select throws_ok(
  format('select public.finish_data_export(%L, 52428801)', current_setting('test.export_1')), '22023', null,
  'more than 50 MiB gives 22023'
);
select throws_ok(
  $$ select public.finish_data_export('d5130000-0000-4000-8000-0000000000f2', 1000) $$, '22023', null,
  'finish on the export of Laura gives 22023'
);
select throws_ok(
  $$ select public.fail_data_export('d5130000-0000-4000-8000-0000000000f2') $$, '22023', null,
  'fail on the export of Laura gives 22023'
);

-- ---------------------------------------------------------------------------
-- CA-24: finish
-- ---------------------------------------------------------------------------
select lives_ok(
  format('select public.finish_data_export(%L, 1200000)', current_setting('test.export_1')),
  'CA-24: Marco finishes the export'
);
select results_eq(
  $$ select e.status::text, e.ready_at, e.expires_at, e.size_bytes from public.get_my_data_export() e $$,
  $$ values ('ready'::text, now(), now() + interval '24 hours', 1200000::bigint) $$,
  'CA-24: ready, expires_at = ready_at + 24 hours, the size'
);
select throws_ok(
  format('select public.finish_data_export(%L, 1200000)', current_setting('test.export_1')), '22023', null,
  'a ready export cannot be finished again'
);
select is_empty(
  format($$ with u as (update storage.objects set metadata = '{}' where name = %L returning 1) select * from u $$,
         'aaaaaaaa-0000-4000-8000-000000000001/' || current_setting('test.export_1') || '.zip'),
  'CA-23: the file of a ready export cannot be uploaded again (0 rows)'
);
select isnt_empty(
  format($$ select 1 from storage.objects o where o.bucket_id = 'data-exports' and o.name = %L $$,
         'aaaaaaaa-0000-4000-8000-000000000001/' || current_setting('test.export_1') || '.zip'),
  'CA-25: Marco reads his file while it is valid'
);
select results_eq(
  $$ select n.kind::text, n.actor_member_id from public.notifications n where n.kind = 'data_export_ready' $$,
  $$ values ('data_export_ready'::text, null::uuid) $$,
  'CA-24: Marco has data_export_ready, without actor'
);

reset role;
select results_eq(
  $$ select d.kind::text from private.push_deliveries d join public.notifications n on n.id = d.notification_id
     where n.kind = 'data_export_ready' $$,
  $$ values ('single') $$,
  'CA-33: data_export_ready rings at once with «Subito quelle per me», as «Tocca a te»'
);
update public.notification_preferences set delivery_mode = 'digest_only'
where member_id = 'a1000000-0000-4000-8000-000000000001';
insert into public.notification_preferences (household_id, member_id, delivery_mode)
select '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001', 'digest_only'
where not exists (select 1 from public.notification_preferences p where p.member_id = 'a1000000-0000-4000-8000-000000000001');
insert into public.notifications (household_id, recipient_member_id, kind)
values ('11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001', 'data_export_ready');
select is(
  (select count(*)::integer from private.push_digest_items i join public.notifications n on n.id = i.notification_id
   where n.kind = 'data_export_ready'),
  1,
  'CA-33: with «Solo il riepilogo» it waits for the summary, as «Tocca a te»'
);
select throws_ok(
  $$ insert into public.notifications (household_id, recipient_member_id, kind, actor_member_id)
     values ('11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001', 'data_export_ready',
             'a1000000-0000-4000-8000-000000000002') $$,
  '23514', null,
  'CA-33: data_export_ready with an actor breaks notifications_kind_fields'
);
select throws_ok(
  $$ insert into public.notifications (household_id, recipient_member_id, kind)
     values ('11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000002', 'household_handed_over') $$,
  '23514', null,
  'CA-33: household_handed_over without an actor breaks notifications_kind_fields'
);

-- ---------------------------------------------------------------------------
-- CA-25, CA-27, CA-28: nobody else reads the row or the file
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}';
select is_empty(
  $$ select 1 from public.data_exports e where e.user_id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  'CA-25, CA-28: Laura (administrator) reads no row of Marco'
);
select is_empty(
  $$ select 1 from storage.objects o where o.bucket_id = 'data-exports'
     and o.name like 'aaaaaaaa-0000-4000-8000-000000000001/%' $$,
  'CA-25, CA-28: nor his file'
);
select results_eq(
  $$ select e.id from public.get_my_data_export() e $$,
  $$ values ('d5130000-0000-4000-8000-0000000000f2'::uuid) $$,
  'Laura gets only her own export'
);
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select is_empty($$ select 1 from public.data_exports $$, 'CA-27: Giulia (Casa Bianchi) reads no export');
select is_empty($$ select * from public.get_my_data_export() $$, 'CA-27: get_my_data_export() gives her nothing');
select is_empty(
  $$ select 1 from storage.objects o where o.bucket_id = 'data-exports' $$,
  'CA-27: and no file'
);
select throws_ok(
  format('select public.finish_data_export(%L, 1000)', current_setting('test.export_1')), '22023', null,
  'CA-27: Giulia cannot finish the export of Marco'
);
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok($$ select 1 from public.data_exports $$, '42501', null, 'CA-29: anon cannot read data_exports');
select throws_ok($$ select public.start_data_export() $$, '42501', null, 'CA-29: anon cannot start an export');
select is_empty(
  $$ select 1 from storage.objects o where o.bucket_id = 'data-exports' $$,
  'CA-29: anon sees no file'
);

-- After expires_at: no file and no row from get_my_data_export().
reset role;
update public.data_exports
set requested_at = now() - interval '26 hours', ready_at = now() - interval '25 hours', expires_at = now() - interval '1 hour'
where id = current_setting('test.export_1')::uuid;
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select is_empty(
  $$ select 1 from storage.objects o where o.bucket_id = 'data-exports' $$,
  'CA-25: after expires_at Marco cannot read the file'
);
select is_empty($$ select * from public.get_my_data_export() $$, 'CA-25: get_my_data_export() gives 0 rows');

-- ---------------------------------------------------------------------------
-- CA-22: at most 5 a day
-- ---------------------------------------------------------------------------
reset role;
insert into public.data_exports (user_id, status, requested_at)
select 'aaaaaaaa-0000-4000-8000-000000000001', 'failed', now()
from generate_series(1, 5) g;
set local role authenticated;
select throws_ok($$ select public.start_data_export() $$, '54000', null, 'CA-22: the sixth of the day after five finished gives 54000');

-- fail_data_export() and CA-30.
reset role;
delete from public.data_exports where user_id = 'aaaaaaaa-0000-4000-8000-000000000001' and status = 'failed';
set local role authenticated;
select set_config('test.export_2', public.start_data_export()::text, true);
select lives_ok(format('select public.fail_data_export(%L)', current_setting('test.export_2')), 'Marco marks an export failed');
select is((select e.status::text from public.get_my_data_export() e), 'failed', 'it is failed');
select throws_ok(
  format('select public.fail_data_export(%L)', current_setting('test.export_2')), '22023', null,
  'a failed export cannot fail again'
);
set local request.method to 'GET';
select throws_ok($$ select public.start_data_export() $$, 'P0001', 'use POST', 'CA-30: start refuses GET');
select throws_ok(
  format('select public.finish_data_export(%L, 1)', current_setting('test.export_2')), 'P0001', 'use POST',
  'CA-30: finish refuses GET'
);
select throws_ok(
  format('select public.fail_data_export(%L)', current_setting('test.export_2')), 'P0001', 'use POST',
  'CA-30: fail refuses GET'
);
set local request.method to 'POST';

-- ---------------------------------------------------------------------------
-- CA-26: the job exports, list_expired_data_exports(), forget_data_export()
-- ---------------------------------------------------------------------------
reset role;
insert into public.data_exports (id, user_id, status, requested_at, updated_at)
values
  ('d5130000-0000-4000-8000-0000000000f3', 'aaaaaaaa-0000-4000-8000-000000000002', 'preparing',
   now() - interval '31 minutes', now() - interval '31 minutes'),
  ('d5130000-0000-4000-8000-0000000000f4', 'aaaaaaaa-0000-4000-8000-000000000002', 'failed',
   now() - interval '8 days', now() - interval '8 days');
update public.data_exports set requested_at = now() - interval '29 minutes'
where id = 'd5130000-0000-4000-8000-0000000000f2';

select is(public.run_account_job('exports', now()), 2, 'CA-26: the job changes one row and deletes one');
select results_eq(
  $$ select e.id, e.status::text from public.data_exports e where e.user_id = 'aaaaaaaa-0000-4000-8000-000000000002'
     order by e.id $$,
  $$ values ('d5130000-0000-4000-8000-0000000000f2'::uuid, 'preparing'::text),
            ('d5130000-0000-4000-8000-0000000000f3'::uuid, 'failed') $$,
  'CA-26: preparing for 31 minutes is failed, for 29 minutes stays; the failed of 8 days is gone'
);
select isnt_empty(
  format('select 1 from public.data_exports e where e.id = %L', current_setting('test.export_1')),
  'CA-26: the expired export stays while its file is there'
);

set local role service_role;
set local request.jwt.claims to '{"role":"service_role"}';
select results_eq(
  $$ select l.export_id::text, l.object_path from public.list_expired_data_exports(10) l $$,
  format($$ values (%L, %L) $$, current_setting('test.export_1'),
         'aaaaaaaa-0000-4000-8000-000000000001/' || current_setting('test.export_1') || '.zip'),
  'CA-26: the expired export is in list_expired_data_exports()'
);
select throws_ok(
  format('select public.forget_data_export(%L)', current_setting('test.export_1')), '22023', null,
  'forget while the file is still there gives 22023'
);
select throws_ok($$ select * from public.list_expired_data_exports(0) $$, '22023', null, 'a limit of 0 gives 22023');
set local request.method to 'GET';
select throws_ok($$ select * from public.list_expired_data_exports(10) $$, 'P0001', 'use POST', 'CA-30: list refuses GET');
select throws_ok(
  format('select public.forget_data_export(%L)', current_setting('test.export_1')), 'P0001', 'use POST',
  'CA-30: forget refuses GET'
);
set local request.method to 'POST';
reset role;

-- The server removes the file through the Storage API.
set local storage.allow_delete_query to 'true';
delete from storage.objects o
where o.bucket_id = 'data-exports'
  and o.name = 'aaaaaaaa-0000-4000-8000-000000000001/' || current_setting('test.export_1') || '.zip';

set local role service_role;
select is(
  (select count(*)::integer from public.list_expired_data_exports(10)), 1,
  'CA-26: without the file it is still listed until forget'
);
select lives_ok(format('select public.forget_data_export(%L)', current_setting('test.export_1')), 'forget_data_export()');
select is_empty($$ select * from public.list_expired_data_exports(10) $$, 'CA-26: then it is no longer listed');
select lives_ok(
  $$ select public.forget_data_export('d5130000-0000-4000-8000-0000000000ff') $$,
  'an unknown id gives no error'
);
reset role;
select is_empty(
  format('select 1 from public.data_exports e where e.id = %L', current_setting('test.export_1')),
  'CA-26: the row of the expired export is gone'
);
select is_empty($$ select 1 from private.data_export_leftovers $$, 'forget and the job leave no leftover');

-- An account deleted outside private.delete_account() (administrative key, Supabase Auth):
-- its file is still left to the server.
insert into storage.objects (bucket_id, name)
values ('data-exports', 'aaaaaaaa-0000-4000-8000-000000000002/d5130000-0000-4000-8000-0000000000f2.zip');
delete from auth.users where id = 'aaaaaaaa-0000-4000-8000-000000000002';
select results_eq(
  $$ select l.object_path from private.data_export_leftovers l $$,
  $$ values ('aaaaaaaa-0000-4000-8000-000000000002/d5130000-0000-4000-8000-0000000000f2.zip'::text) $$,
  'the file of an account deleted by the administrative key waits for the Storage API'
);

select * from finish();
rollback;
