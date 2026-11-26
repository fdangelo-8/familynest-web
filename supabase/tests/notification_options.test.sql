-- How the phone rings (issue #511, DB-2 of plan #501, part 1): the new types, the new
-- columns of notification_preferences and profiles, set_notification_options() and the two
-- new switches of set_notification_preference() (CA-3, CA-4, CA-5, CA-7 and the
-- preferences part of CA-40), with the privileges.
-- Seed ids: Marco (Casa D'Angelo, admin, user aaaaaaaa…01, member a1…01), Laura a1…02;
-- Giulia (Casa Bianchi, bbbbbbbb…01, b1…01); Chiara (cccccccc…01, no household).
-- This test gives Laura an account (user aaaaaaaa…02). The seed has no notification
-- preferences. No date in this test.
begin;
create extension if not exists pgtap with schema extensions;

select plan(72);

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-4000-8000-000000000002', 'authenticated',
   'authenticated', 'utente-laura@example.com', '{"full_name":"Laura Test"}', now(), now());
update public.household_members
set user_id = 'aaaaaaaa-0000-4000-8000-000000000002', joined_at = now()
where id = 'a1000000-0000-4000-8000-000000000002';

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------
select enum_has_labels(
  'public', 'notification_delivery_mode', array['each', 'mine_now', 'digest_only'],
  '«Come vuoi riceverle»: the three ways, in order'
);
select enum_has_labels(
  'public', 'push_platform', array['web', 'apns', 'fcm'],
  'decision of 25/11: three kinds of push device from the first day'
);
select enum_has_labels(
  'public', 'push_delivery_kind', array['single', 'evening_digest', 'morning_digest'],
  'the three kinds of delivery'
);
select enum_has_labels(
  'public', 'morning_digest_line',
  array['events', 'ride', 'todos', 'deadlines_today', 'deadlines_tomorrow', 'shopping', 'free_together'],
  'the lines of the morning digest (rule 6)'
);
select col_default_is('public', 'notification_preferences', 'delivery_mode', 'mine_now', '«Subito quelle per me» by default');
select col_default_is('public', 'notification_preferences', 'evening_digest_time', '19:00', '«Il riepilogo» at 19:00 by default');
select col_default_is('public', 'notification_preferences', 'quiet_hours', 'true', '«Silenzio di notte» on by default');
select col_default_is('public', 'notification_preferences', 'hide_content', 'false', '«Nascondi il contenuto» off by default');
select ok(
  (select bool_and(a.attnotnull) from pg_attribute a
   where a.attrelid = 'public.notification_preferences'::regclass
     and a.attname in ('delivery_mode', 'evening_digest_time', 'quiet_hours', 'hide_content')),
  'the four new choices are never null'
);
select col_default_is('public', 'profiles', 'morning_digest_weekdays', '{1,2,3,4,5}', 'the digest from Monday to Friday by default');
select col_not_null('public', 'profiles', 'morning_digest_weekdays', 'the digest days are never null');
select results_eq(
  $$ select distinct p.morning_digest_weekdays::text from public.profiles p $$,
  $$ values ('{1,2,3,4,5}') $$,
  'the existing profiles got the default days'
);
select has_function(
  'public', 'set_notification_options', array['notification_delivery_mode', 'time without time zone', 'smallint[]'],
  'set_notification_options(p_delivery_mode, p_evening_digest_time, p_morning_digest_weekdays) exists'
);
select ok(
  not (select p.prosecdef from pg_proc p
       where p.oid = 'public.set_notification_options(public.notification_delivery_mode, time, smallint[])'::regprocedure)
  and (select p.proconfig @> array['search_path=""'] from pg_proc p
       where p.oid = 'public.set_notification_options(public.notification_delivery_mode, time, smallint[])'::regprocedure),
  'set_notification_options runs as the caller, with an empty search_path'
);
select ok(
  not has_function_privilege('anon', 'public.set_notification_options(public.notification_delivery_mode, time, smallint[])', 'execute')
  and has_function_privilege('authenticated', 'public.set_notification_options(public.notification_delivery_mode, time, smallint[])', 'execute'),
  'only signed-in users set their options'
);
select ok(
  has_column_privilege('authenticated', 'public.notification_preferences', 'delivery_mode', 'insert')
  and has_column_privilege('authenticated', 'public.notification_preferences', 'evening_digest_time', 'insert')
  and has_column_privilege('authenticated', 'public.notification_preferences', 'quiet_hours', 'insert')
  and has_column_privilege('authenticated', 'public.notification_preferences', 'hide_content', 'insert')
  and has_column_privilege('authenticated', 'public.notification_preferences', 'delivery_mode', 'update')
  and has_column_privilege('authenticated', 'public.notification_preferences', 'evening_digest_time', 'update')
  and has_column_privilege('authenticated', 'public.notification_preferences', 'quiet_hours', 'update')
  and has_column_privilege('authenticated', 'public.notification_preferences', 'hide_content', 'update'),
  'the app writes the four new choices'
);
select ok(
  has_column_privilege('authenticated', 'public.profiles', 'morning_digest_weekdays', 'update')
  and not has_column_privilege('anon', 'public.profiles', 'morning_digest_weekdays', 'update')
  and not has_table_privilege('anon', 'public.notification_preferences', 'select, insert, update, delete'),
  'the app updates the digest days of its profile; anon writes nothing'
);
select ok(
  not has_function_privilege('anon', 'private.is_quarter_hour_between(time, time, time)', 'execute')
  and not has_function_privilege('anon', 'private.digest_weekdays_valid(smallint[])', 'execute')
  and has_function_privilege('authenticated', 'private.is_quarter_hour_between(time, time, time)', 'execute')
  and has_function_privilege('authenticated', 'private.digest_weekdays_valid(smallint[])', 'execute'),
  'the helpers of the check constraints run as the writer, never for anon'
);

-- Rule 2: the limits, one source for the table and the function.
select ok(
  private.is_quarter_hour_between('07:00', '07:00', '21:45')
  and private.is_quarter_hour_between('21:45', '07:00', '21:45')
  and private.is_quarter_hour_between('12:15', '07:00', '21:45'),
  'rule 2: 07:00, 21:45 and 12:15 are allowed for the summary'
);
select ok(
  not private.is_quarter_hour_between('22:00', '07:00', '21:45')
  and not private.is_quarter_hour_between('06:45', '07:00', '21:45')
  and not private.is_quarter_hour_between('19:10', '07:00', '21:45')
  and not private.is_quarter_hour_between('19:00:30', '07:00', '21:45'),
  'rule 2: 22:00, 06:45, 19:10 and 19:00:30 are refused'
);
select ok(
  private.digest_weekdays_valid('{1}')
  and private.digest_weekdays_valid('{1,2,3,4,5,6,7}')
  and private.digest_weekdays_valid('{7,1}'),
  'rule 2: one day, every day, any order'
);
select ok(
  not private.digest_weekdays_valid('{}')
  and not private.digest_weekdays_valid('{0}')
  and not private.digest_weekdays_valid('{8}')
  and not private.digest_weekdays_valid('{1,1}')
  and not private.digest_weekdays_valid(array[null]::smallint[])
  and not private.digest_weekdays_valid('{{1,2}}'),
  'rule 2: no empty list, no day outside 1–7, no repetition, no null, one dimension'
);

-- ---------------------------------------------------------------------------
-- CA-3: Marco sets the summary at 20:30 and the days {1,3,5,7}; the mode does not change
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';

select is_empty($$ select 1 from public.notification_preferences $$, 'Marco has no preferences row yet');
select lives_ok(
  $$ select public.set_notification_options(null, '20:30', '{1,3,5,7}') $$,
  'CA-3: Marco saves 20:30 and {1,3,5,7}'
);
select results_eq(
  $$ select p.delivery_mode::text, p.evening_digest_time::text,
            (select pr.morning_digest_weekdays::text from public.profiles pr)
     from public.notification_preferences p $$,
  $$ values ('mine_now', '20:30:00', '{1,3,5,7}') $$,
  'CA-3: 20:30 and {1,3,5,7} saved, the mode is still «Subito quelle per me»'
);
select lives_ok($$ select public.set_notification_options() $$, 'CA-3: all null');
select results_eq(
  $$ select p.delivery_mode::text, p.evening_digest_time::text,
            (select pr.morning_digest_weekdays::text from public.profiles pr)
     from public.notification_preferences p $$,
  $$ values ('mine_now', '20:30:00', '{1,3,5,7}') $$,
  'CA-3: with all null nothing changes'
);
select lives_ok($$ select public.set_notification_options('each') $$, 'Marco chooses «Ogni avviso»');
select results_eq(
  $$ select p.delivery_mode::text, p.evening_digest_time::text,
            (select pr.morning_digest_weekdays::text from public.profiles pr)
     from public.notification_preferences p $$,
  $$ values ('each', '20:30:00', '{1,3,5,7}') $$,
  'only the mode changed'
);
select lives_ok(
  $$ select public.set_notification_options(p_morning_digest_weekdays => '{5,1}') $$,
  'Marco chooses Friday and Monday'
);
select is(
  (select pr.morning_digest_weekdays::text from public.profiles pr),
  '{1,5}',
  'the days are saved in order'
);
select lives_ok($$ select public.set_notification_options(null, '07:00') $$, 'rule 2: 07:00 is allowed');
select lives_ok($$ select public.set_notification_options(null, '21:45') $$, 'rule 2: 21:45 is allowed');

-- ---------------------------------------------------------------------------
-- CA-4: values outside the limits fail and nothing changes
-- ---------------------------------------------------------------------------
select throws_ok($$ select public.set_notification_options(null, '22:00') $$, '22023', null, 'CA-4: 22:00 refused');
select throws_ok($$ select public.set_notification_options(null, '06:45') $$, '22023', null, 'CA-4: 06:45 refused');
select throws_ok($$ select public.set_notification_options(null, '19:10') $$, '22023', null, 'CA-4: 19:10 refused');
select throws_ok($$ select public.set_notification_options(null, '19:00:30') $$, '22023', null, 'CA-4: seconds refused');
select throws_ok($$ select public.set_notification_options(null, null, '{}') $$, '22023', null, 'CA-4: no day refused');
select throws_ok($$ select public.set_notification_options(null, null, '{0}') $$, '22023', null, 'CA-4: day 0 refused');
select throws_ok($$ select public.set_notification_options(null, null, '{8}') $$, '22023', null, 'CA-4: day 8 refused');
select throws_ok($$ select public.set_notification_options(null, null, '{1,1}') $$, '22023', null, 'CA-4: a repeated day refused');
select throws_ok(
  $$ select public.set_notification_options(null, null, array[null]::smallint[]) $$,
  '22023', null, 'CA-4: a null day refused'
);
select throws_ok(
  $$ select public.set_notification_options('digest_only', null, '{}') $$,
  '22023', null, 'CA-4: a valid mode with invalid days is refused as a whole'
);
select results_eq(
  $$ select p.delivery_mode::text, p.evening_digest_time::text,
            (select pr.morning_digest_weekdays::text from public.profiles pr)
     from public.notification_preferences p $$,
  $$ values ('each', '21:45:00', '{1,5}') $$,
  'CA-4: after the refused calls nothing changed'
);
select throws_ok(
  $$ update public.notification_preferences set evening_digest_time = '22:00' $$,
  '23514', null, 'CA-4: the table refuses 22:00 too'
);
select throws_ok(
  $$ update public.profiles set morning_digest_weekdays = '{1,1}' where id = auth.uid() $$,
  '23514', null, 'CA-4: the table refuses a repeated day too'
);
select throws_ok(
  $$ update public.profiles set morning_digest_weekdays = '{}' where id = auth.uid() $$,
  '23514', null, 'CA-4: the table refuses an empty list too'
);

-- ---------------------------------------------------------------------------
-- CA-5: one new switch at a time
-- ---------------------------------------------------------------------------
select set_config(
  'test.before',
  (select (to_jsonb(p) - 'hide_content' - 'updated_at')::text from public.notification_preferences p),
  true
);
select lives_ok($$ select public.set_notification_preference('hide_content', true) $$, 'CA-5: Marco hides the content');
select is((select p.hide_content from public.notification_preferences p), true, 'CA-5: hide_content is on');
select is(
  (select (to_jsonb(p) - 'hide_content' - 'updated_at')::text from public.notification_preferences p),
  current_setting('test.before'),
  'CA-5: nothing else changed'
);
select set_config(
  'test.before',
  (select (to_jsonb(p) - 'quiet_hours' - 'updated_at')::text from public.notification_preferences p),
  true
);
select lives_ok($$ select public.set_notification_preference('quiet_hours', false) $$, 'CA-5: Marco switches the night silence off');
select is((select p.quiet_hours from public.notification_preferences p), false, 'CA-5: quiet_hours is off');
select is(
  (select (to_jsonb(p) - 'quiet_hours' - 'updated_at')::text from public.notification_preferences p),
  current_setting('test.before'),
  'CA-5: nothing else changed'
);

-- Only POST through the Data API.
set local request.method to 'GET';
select throws_ok($$ select public.set_notification_options('each') $$, 'P0001', 'use POST', 'GET is refused');
set local request.method to 'HEAD';
select throws_ok($$ select public.set_notification_options('each') $$, 'P0001', 'use POST', 'HEAD is refused');
set local request.method to 'POST';

-- ---------------------------------------------------------------------------
-- CA-7: Laura (same household) never reads or changes the row of Marco
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}';

select is_empty(
  $$ select 1 from public.notification_preferences p where p.member_id = 'a1000000-0000-4000-8000-000000000001' $$,
  'CA-7: Laura reads 0 rows of Marco'
);
select results_eq(
  $$ with u as (update public.notification_preferences p
               set hide_content = false, quiet_hours = true, delivery_mode = 'digest_only', evening_digest_time = '19:00'
               where p.member_id = 'a1000000-0000-4000-8000-000000000001' returning 1)
     select count(*)::integer from u $$,
  $$ values (0) $$,
  'CA-7: Laura changes 0 rows of Marco'
);
select results_eq(
  $$ with d as (delete from public.notification_preferences p
               where p.member_id = 'a1000000-0000-4000-8000-000000000001' returning 1)
     select count(*)::integer from d $$,
  $$ values (0) $$,
  'CA-7: Laura deletes 0 rows of Marco'
);
select results_eq(
  $$ with u as (update public.profiles p set morning_digest_weekdays = '{6,7}'
               where p.id = 'aaaaaaaa-0000-4000-8000-000000000001' returning 1)
     select count(*)::integer from u $$,
  $$ values (0) $$,
  'CA-7: Laura cannot change the digest days of Marco'
);
select lives_ok(
  $$ select public.set_notification_options('digest_only', '19:15', '{6,7}') $$,
  'Laura sets her own options'
);
select results_eq(
  $$ select p.member_id, p.delivery_mode::text, p.evening_digest_time::text from public.notification_preferences p $$,
  $$ values ('a1000000-0000-4000-8000-000000000002'::uuid, 'digest_only', '19:15:00') $$,
  'Laura reads only her own row'
);

-- ---------------------------------------------------------------------------
-- CA-40 (preferences): Giulia (Casa Bianchi) reads and changes nothing of Casa D'Angelo
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';

select is_empty(
  $$ select 1 from public.notification_preferences p
     where p.household_id = '11111111-1111-4111-8111-111111111111' $$,
  'CA-40: Giulia reads 0 preferences of Casa D''Angelo'
);
select results_eq(
  $$ with u as (update public.notification_preferences p set hide_content = false, delivery_mode = 'each'
               where p.household_id = '11111111-1111-4111-8111-111111111111' returning 1)
     select count(*)::integer from u $$,
  $$ values (0) $$,
  'CA-40: Giulia changes 0 preferences of Casa D''Angelo'
);
select throws_ok(
  $$ insert into public.notification_preferences (member_id, hide_content)
     values ('a1000000-0000-4000-8000-000000000001', false) $$,
  '42501', null,
  'CA-40: Giulia cannot write a row for Marco'
);
select lives_ok($$ select public.set_notification_options('each', '08:00', '{1}') $$, 'Giulia sets her own options');

-- Chiara has no household.
set local request.jwt.claims to '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($$ select public.set_notification_options('each') $$, '42501', null, 'without household: 42501');

-- anon
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok($$ select public.set_notification_options('each') $$, '42501', null, 'anon cannot set options');
select throws_ok(
  $$ select public.set_notification_preference('hide_content', true) $$,
  '42501', null, 'anon cannot touch a switch'
);

-- ---------------------------------------------------------------------------
-- After the attempts of the others (database owner)
-- ---------------------------------------------------------------------------
reset role;

select results_eq(
  $$ select p.member_id, p.delivery_mode::text, p.evening_digest_time::text, p.quiet_hours, p.hide_content
     from public.notification_preferences p order by p.member_id $$,
  $$ values ('a1000000-0000-4000-8000-000000000001'::uuid, 'each', '21:45:00', false, true),
            ('a1000000-0000-4000-8000-000000000002'::uuid, 'digest_only', '19:15:00', true, false),
            ('b1000000-0000-4000-8000-000000000001'::uuid, 'each', '08:00:00', true, false) $$,
  'CA-7, CA-40: every row is as its owner left it'
);
select results_eq(
  $$ select p.id, p.morning_digest_weekdays::text from public.profiles p
     where p.id in ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000002',
                    'bbbbbbbb-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001')
     order by p.id $$,
  $$ values ('aaaaaaaa-0000-4000-8000-000000000001'::uuid, '{1,5}'),
            ('aaaaaaaa-0000-4000-8000-000000000002'::uuid, '{6,7}'),
            ('bbbbbbbb-0000-4000-8000-000000000001'::uuid, '{1}'),
            ('cccccccc-0000-4000-8000-000000000001'::uuid, '{1,2,3,4,5}') $$,
  'the digest days: each profile as its owner left it'
);
-- get_notification_preferences() is unchanged in part 1 (the new columns come with part 2).
select is(
  (select p.proargnames from pg_proc p where p.oid = 'public.get_notification_preferences()'::regprocedure),
  array['events', 'assigned_todos', 'shopping', 'free_together', 'morning_digest']::text[],
  'get_notification_preferences() still returns the five choices of #217'
);
select throws_ok(
  $$ insert into public.notification_preferences (household_id, member_id, evening_digest_time)
     values ('22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000002', '06:30') $$,
  '23514', null,
  'the trusted roles too: the summary only from 07:00 to 21:45'
);

select * from finish();
rollback;
