-- The choices of Notifiche 2.0, part 2 (issue #511, DB-2 of plan #501):
-- get_notification_preferences() with every column (CA-1), the morning digest at 07:15 on
-- quarters of an hour (CA-2), the switches of cb1-45 and of the content of the morning
-- digest (CA-5), mark_morning_digest_intro_seen() (CA-6), isolation inside the household
-- (CA-7) and between households, anon (CA-40), and the privileges.
-- Seed ids: Marco (Casa D'Angelo, admin, user aaaaaaaa…01, member a1…01), Laura a1…02;
-- Giulia (Casa Bianchi, bbbbbbbb…01, b1…01). This test gives Laura an account (user
-- aaaaaaaa…02). The seed has no notification preferences. No date in this test.
begin;
create extension if not exists pgtap with schema extensions;

select plan(51);

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-4000-8000-000000000002', 'authenticated',
   'authenticated', 'utente-laura@example.com', '{"full_name":"Laura Test"}', now(), now());
update public.household_members
set user_id = 'aaaaaaaa-0000-4000-8000-000000000002', joined_at = now()
where id = 'a1000000-0000-4000-8000-000000000002';

-- ---------------------------------------------------------------------------
-- Schema and privileges
-- ---------------------------------------------------------------------------
select enum_has_labels('public', 'ride_leg', array['escort', 'pickup'], 'the two ways of a ride');
select col_default_is('public', 'notification_preferences', 'rides', 'true', 'cb1-45: «Viaggi» on by default');
select col_default_is('public', 'notification_preferences', 'event_reminders', 'true', 'cb1-45: «Prima di un tuo impegno» on');
select col_default_is('public', 'notification_preferences', 'deadlines', 'true', 'cb1-45: «Scadenze» on');
select col_default_is('public', 'notification_preferences', 'gifts', 'true', 'cb1-45: «Regali» on');
select col_default_is('public', 'notification_preferences', 'digest_events', 'true', 'digest: events on');
select col_default_is('public', 'notification_preferences', 'digest_rides', 'true', 'digest: rides on');
select col_default_is('public', 'notification_preferences', 'digest_deadlines', 'true', 'digest: deadlines on');
select col_default_is('public', 'notification_preferences', 'digest_thanks', 'true', 'digest: thanks on');
select col_default_is('public', 'notification_preferences', 'digest_shopping', 'false', 'digest: shopping off');
select col_default_is('public', 'notification_preferences', 'shopping', 'true', 'CA-1: «Spesa» on by default (question 3)');
select col_default_is('public', 'profiles', 'morning_digest_time', '07:15', 'CA-2: the morning digest at 07:15 by default');
select col_is_null('public', 'profiles', 'morning_digest_intro_seen_at', 'the introduction is not seen until it is');
select ok(
  has_column_privilege('authenticated', 'public.notification_preferences', 'digest_shopping', 'update')
  and has_column_privilege('authenticated', 'public.notification_preferences', 'rides', 'insert')
  and not has_column_privilege('authenticated', 'public.profiles', 'morning_digest_intro_seen_at', 'update'),
  'the app writes the new switches, never the time the introduction was seen'
);
select ok(
  not has_function_privilege('anon', 'public.get_notification_preferences()', 'execute')
  and not has_function_privilege('anon', 'public.mark_morning_digest_intro_seen()', 'execute')
  and not has_function_privilege('anon', 'public.get_morning_digest(date)', 'execute')
  and not has_function_privilege('anon', 'public.request_ride(uuid, date, public.ride_leg, uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.get_notification_preferences()', 'execute')
  and has_function_privilege('authenticated', 'public.mark_morning_digest_intro_seen()', 'execute')
  and has_function_privilege('authenticated', 'public.get_morning_digest(date)', 'execute')
  and has_function_privilege('authenticated', 'public.request_ride(uuid, date, public.ride_leg, uuid)', 'execute'),
  'CA-40: the new functions of the page are for signed-in users only'
);
select ok(
  not has_table_privilege('anon', 'private.push_digest_items', 'select, insert, update, delete')
  and not has_table_privilege('authenticated', 'private.push_digest_items', 'select, insert, update, delete')
  and not has_table_privilege('service_role', 'private.push_digest_items', 'select, insert, update, delete')
  and (select c.relrowsecurity from pg_class c where c.oid = 'private.push_digest_items'::regclass)
  and not exists (select 1 from pg_policy p where p.polrelid = 'private.push_digest_items'::regclass),
  'CA-40: the notifications waiting for the summary are not reachable from the API (RLS, no policy, no privilege)'
);
select ok(
  not has_function_privilege('authenticated', 'private.morning_digest(uuid, date)', 'execute')
  and not has_function_privilege('authenticated', 'private.push_schedule(uuid, boolean)', 'execute')
  and not has_function_privilege('authenticated', 'private.event_occurrence_on(uuid, date)', 'execute')
  and not has_function_privilege('authenticated', 'private.push_digests(timestamptz, uuid)', 'execute')
  and not has_function_privilege('authenticated', 'private.notifications_overlaps(timestamptz, uuid)', 'execute'),
  'the helpers and the jobs are the database owner''s only'
);
select ok(
  not (select p.prosecdef from pg_proc p where p.oid = 'public.get_notification_preferences()'::regprocedure)
  and (select p.prosecdef and p.proconfig @> array['search_path=""'] from pg_proc p
       where p.oid = 'public.mark_morning_digest_intro_seen()'::regprocedure),
  'get_notification_preferences() runs as the caller; mark_morning_digest_intro_seen() is security definer with an empty search_path'
);

-- ---------------------------------------------------------------------------
-- CA-1: the defaults without a row, without writing; the same as the columns
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select results_eq(
  $$ select * from public.get_notification_preferences() $$,
  $$ values (true, true, true, true, true, true, false, true, true, true, true, true, true, true, true, false,
             'mine_now'::public.notification_delivery_mode, '19:00'::time) $$,
  'CA-1: Marco never chose: every default, «Spesa» on'
);
reset role;
select is_empty($$ select 1 from public.notification_preferences $$, 'CA-1: reading wrote nothing');
-- A row with the defaults of the columns (written by the database owner for Laura) reads
-- exactly as the defaults of the function.
insert into public.notification_preferences (household_id, member_id)
values ('11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000002');
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}';
select results_eq(
  $$ select * from public.get_notification_preferences() $$,
  $$ values (true, true, true, true, true, true, false, true, true, true, true, true, true, true, true, false,
             'mine_now'::public.notification_delivery_mode, '19:00'::time) $$,
  'CA-1: the defaults of the function are the defaults of the columns'
);
reset role;
delete from public.notification_preferences;

-- ---------------------------------------------------------------------------
-- CA-2: the time of the morning digest
-- ---------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', 'eeeeeeee-0000-4000-8000-000000000002', 'authenticated',
        'authenticated', 'nuovo-511@example.com', '{"full_name":"Nuovo Test"}', now(), now());
select is(
  (select p.morning_digest_time from public.profiles p where p.id = 'eeeeeeee-0000-4000-8000-000000000002'),
  '07:15'::time,
  'CA-2: a new profile has its morning digest at 7:15'
);

set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select results_eq(
  $$ update public.profiles set morning_digest_time = '07:45' where id = 'aaaaaaaa-0000-4000-8000-000000000001' returning id $$,
  $$ values ('aaaaaaaa-0000-4000-8000-000000000001'::uuid) $$,
  'CA-2: Marco saves 7:45'
);
select lives_ok(
  $$ do $d$
     declare
       t time;
     begin
       foreach t in array array['06:00', '06:15', '07:30', '08:45', '09:45', '10:00']::time[]
       loop
         update public.profiles set morning_digest_time = t where id = (select auth.uid());
       end loop;
     end
     $d$ $$,
  'every quarter of an hour from 6:00 to 10:00 is accepted'
);
select throws_ok(
  $$ update public.profiles set morning_digest_time = '07:10' where id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  '23514', null, 'CA-2: 7:10 is refused'
);
select throws_ok(
  $$ update public.profiles set morning_digest_time = '05:45' where id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  '23514', null, 'CA-2: 5:45 is refused'
);
select throws_ok(
  $$ update public.profiles set morning_digest_time = '10:15' where id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  '23514', null, 'CA-2: 10:15 is refused'
);
select lives_ok(
  $$ update public.profiles set morning_digest_time = '07:45' where id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  'Marco saves 7:45 again'
);
select is(
  (select p.morning_digest_time from public.profiles p where p.id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  '07:45'::time,
  'CA-2: the refused times changed nothing'
);

-- ---------------------------------------------------------------------------
-- CA-5: each new switch changes only itself
-- ---------------------------------------------------------------------------
select lives_ok(
  $$ do $d$
     declare
       v_pref public.notification_preference;
       v_before jsonb;
       v_after jsonb;
     begin
       foreach v_pref in array array['rides', 'event_reminders', 'deadlines', 'gifts', 'digest_events',
                                     'digest_rides', 'digest_deadlines', 'digest_thanks', 'digest_shopping',
                                     'quiet_hours', 'hide_content']::public.notification_preference[]
       loop
         select to_jsonb(g) into v_before from public.get_notification_preferences() g;
         perform public.set_notification_preference(v_pref, not (v_before ->> v_pref::text)::boolean);
         select to_jsonb(g) into v_after from public.get_notification_preferences() g;
         if (v_after - v_pref::text) <> (v_before - v_pref::text)
            or (v_after -> v_pref::text) = (v_before -> v_pref::text) then
           raise exception 'the switch % changed something else, or nothing', v_pref;
         end if;
       end loop;
     end
     $d$ $$,
  'CA-5: every new switch (and quiet_hours, hide_content) changes only its own column'
);
select results_eq(
  $$ select * from public.get_notification_preferences() $$,
  $$ values (true, true, true, true, true, false, true, false, false, false, false, false, false, false, false, true,
             'mine_now'::public.notification_delivery_mode, '19:00'::time) $$,
  'CA-5: Marco reads every new switch the other way round, the rest as before'
);
select results_eq(
  $$ select p.rides, p.event_reminders, p.deadlines, p.gifts, p.digest_events, p.digest_rides, p.digest_deadlines,
            p.digest_thanks, p.digest_shopping, p.hide_content
     from public.notification_preferences p $$,
  $$ values (false, false, false, false, false, false, false, false, true, true) $$,
  'CA-5: the row of Marco holds them'
);
select lives_ok(
  $$ select public.set_notification_preference('hide_content', true) $$,
  'CA-5: setting the value it already has gives no error'
);

-- ---------------------------------------------------------------------------
-- CA-6: the introduction of the morning digest, once
-- ---------------------------------------------------------------------------
select is(
  (select p.morning_digest_intro_seen_at from public.profiles p where p.id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  null,
  'CA-6: Marco never saw the introduction'
);
select throws_ok(
  $$ update public.profiles set morning_digest_intro_seen_at = now() where id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  '42501', null,
  'the app cannot write the time directly'
);
select lives_ok($$ select public.mark_morning_digest_intro_seen() $$, 'CA-6: Marco sees the introduction');
select is(
  (select p.morning_digest_intro_seen_at from public.profiles p where p.id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  now(),
  'CA-6: the time is saved'
);
-- The first time was yesterday (set by the database owner), then he sees it again.
reset role;
update public.profiles set morning_digest_intro_seen_at = now() - interval '1 day'
where id = 'aaaaaaaa-0000-4000-8000-000000000001';
set local role authenticated;
select lives_ok($$ select public.mark_morning_digest_intro_seen() $$, 'CA-6: Marco calls it a second time');
select is(
  (select p.morning_digest_intro_seen_at from public.profiles p where p.id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  now() - interval '1 day',
  'CA-6: the time of the first one stays'
);
set local request.method to 'GET';
select throws_ok($$ select public.mark_morning_digest_intro_seen() $$, 'P0001', 'use POST', 'only POST');
set local request.method to 'POST';

-- ---------------------------------------------------------------------------
-- CA-7: Laura (same household) neither reads nor changes the choices of Marco
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}';
select is_empty(
  $$ select 1 from public.notification_preferences p where p.member_id = 'a1000000-0000-4000-8000-000000000001' $$,
  'CA-7: Laura reads 0 rows of Marco'
);
select is_empty(
  $$ update public.notification_preferences p set rides = true, digest_shopping = false
     where p.member_id = 'a1000000-0000-4000-8000-000000000001' returning 1 $$,
  'CA-7: Laura changes 0 rows of Marco'
);
select results_eq(
  $$ select rides, digest_shopping from public.get_notification_preferences() $$,
  $$ values (true, false) $$,
  'CA-7: Laura reads her own defaults, never the choices of Marco'
);
select lives_ok($$ select public.mark_morning_digest_intro_seen() $$, 'Laura sees her introduction');
select is_empty(
  $$ select 1 from public.profiles p where p.id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  'Laura never reads the profile of Marco'
);

-- ---------------------------------------------------------------------------
-- CA-40: Giulia (another household)
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select is_empty(
  $$ select 1 from public.notification_preferences p where p.household_id = '11111111-1111-4111-8111-111111111111' $$,
  'CA-40: Giulia reads 0 choices of Casa D''Angelo'
);
select is_empty(
  $$ update public.notification_preferences p set gifts = true
     where p.member_id = 'a1000000-0000-4000-8000-000000000001' returning 1 $$,
  'CA-40: Giulia changes 0 choices of Casa D''Angelo'
);
reset role;
select results_eq(
  $$ select p.member_id, p.rides, p.gifts, p.digest_shopping from public.notification_preferences p
     order by p.member_id $$,
  $$ values ('a1000000-0000-4000-8000-000000000001'::uuid, false, false, true) $$,
  'CA-7, CA-40: the row of Marco is as he left it, and nobody else has one'
);
select results_eq(
  $$ select p.id, p.morning_digest_intro_seen_at is not null from public.profiles p
     where p.id in ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000002',
                    'bbbbbbbb-0000-4000-8000-000000000001')
     order by p.id $$,
  $$ values ('aaaaaaaa-0000-4000-8000-000000000001'::uuid, true),
            ('aaaaaaaa-0000-4000-8000-000000000002'::uuid, true),
            ('bbbbbbbb-0000-4000-8000-000000000001'::uuid, false) $$,
  'each one marks only their own introduction'
);

-- ---------------------------------------------------------------------------
-- anon
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok($$ select public.mark_morning_digest_intro_seen() $$, '42501', null, 'CA-40: anon cannot mark the introduction');
select throws_ok($$ select * from public.get_morning_digest('2026-12-01') $$, '42501', null, 'CA-40: anon cannot read a morning digest');
reset role;

select * from finish();
rollback;
