-- profiles: the three preferences of page #38 «Il tuo profilo» (issue #218): schema,
-- defaults for existing and new accounts, privileges, allowed values only, isolation
-- between households and between adults of the same household (CA-23), anon.
-- Seed ids: A = Marco (Casa D'Angelo), B = Giulia (Casa Bianchi, admin), B2 = Paolo (Casa
-- Bianchi, not admin), C = Chiara (no household).
begin;
create extension if not exists pgtap with schema extensions;

select plan(47);

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------
select enum_has_labels('public', 'lens', array['io', 'nest'], 'lens has the two lenses of the app, «Io» first');
select col_type_is('public', 'profiles', 'start_lens', 'public', 'lens', 'start_lens is a lens');
select col_type_is(
  'public', 'profiles', 'morning_digest_time', 'time without time zone',
  'morning_digest_time is a time of the day (no date, no time zone)'
);
select col_type_is(
  'public', 'profiles', 'default_event_visibility', 'public', 'event_visibility',
  'default_event_visibility has the values of the events'
);
select col_not_null('public', 'profiles', 'start_lens', 'start_lens is mandatory');
select col_not_null('public', 'profiles', 'morning_digest_time', 'morning_digest_time is mandatory');
select col_not_null('public', 'profiles', 'default_event_visibility', 'default_event_visibility is mandatory');
select col_has_default('public', 'profiles', 'start_lens', 'start_lens has a default');
select col_has_default('public', 'profiles', 'morning_digest_time', 'morning_digest_time has a default');
select col_has_default('public', 'profiles', 'default_event_visibility', 'default_event_visibility has a default');

-- Existing accounts (seed) and new accounts get «Io», «7:30», «Occupato».
select results_eq(
  $$ select distinct p.start_lens::text, p.morning_digest_time::text, p.default_event_visibility::text
     from public.profiles p $$,
  $$ values ('io', '07:30:00', 'busy') $$,
  'every existing profile has the defaults: Io, 7:30, Occupato'
);

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', 'eeeeeeee-0000-4000-8000-000000000001', 'authenticated',
        'authenticated', 'nuovo@example.com', '{"full_name":"Nuovo Test"}', now(), now());

select results_eq(
  $$ select p.start_lens::text, p.morning_digest_time::text, p.default_event_visibility::text
     from public.profiles p where p.id = 'eeeeeeee-0000-4000-8000-000000000001' $$,
  $$ values ('io', '07:30:00', 'busy') $$,
  'a new account gets the defaults: Io, 7:30, Occupato'
);

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
select ok(
  has_column_privilege('authenticated', 'public.profiles', 'start_lens', 'update')
  and has_column_privilege('authenticated', 'public.profiles', 'morning_digest_time', 'update')
  and has_column_privilege('authenticated', 'public.profiles', 'default_event_visibility', 'update'),
  'the app updates the three preferences'
);
select ok(
  not has_column_privilege('authenticated', 'public.profiles', 'id', 'update')
  and not has_column_privilege('authenticated', 'public.profiles', 'created_at', 'update')
  and not has_column_privilege('authenticated', 'public.profiles', 'updated_at', 'update'),
  'the app never updates id or times of a profile'
);
select ok(
  not has_table_privilege('authenticated', 'public.profiles', 'insert')
  and not has_table_privilege('authenticated', 'public.profiles', 'delete'),
  'the app never inserts or deletes a profile (it comes and goes with the account)'
);
select ok(
  not has_column_privilege('anon', 'public.profiles', 'start_lens', 'update')
  and not has_column_privilege('anon', 'public.profiles', 'morning_digest_time', 'update')
  and not has_column_privilege('anon', 'public.profiles', 'default_event_visibility', 'update'),
  'anon cannot update the preferences'
);

-- ---------------------------------------------------------------------------
-- A (Marco) reads and changes their own preferences
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';

select results_eq(
  $$ select p.start_lens::text, p.morning_digest_time::text, p.default_event_visibility::text
     from public.profiles p where p.id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  $$ values ('io', '07:30:00', 'busy') $$,
  'CA-14: A reads their own preferences (never changed: Io, 7:30, Occupato)'
);
select results_eq(
  $$ update public.profiles set start_lens = 'nest'
     where id = 'aaaaaaaa-0000-4000-8000-000000000001' returning id $$,
  $$ values ('aaaaaaaa-0000-4000-8000-000000000001'::uuid) $$,
  'CA-15: A chooses «Nest» for «All''apertura»'
);
select results_eq(
  $$ update public.profiles set morning_digest_time = '08:30'
     where id = 'aaaaaaaa-0000-4000-8000-000000000001' returning id $$,
  $$ values ('aaaaaaaa-0000-4000-8000-000000000001'::uuid) $$,
  'CA-16: A chooses «8:30» for «Sintesi del mattino» (written as text 08:30)'
);
select results_eq(
  $$ update public.profiles set default_event_visibility = 'private'
     where id = 'aaaaaaaa-0000-4000-8000-000000000001' returning id $$,
  $$ values ('aaaaaaaa-0000-4000-8000-000000000001'::uuid) $$,
  'CA-17: A chooses «Solo io» for «Visibilità predefinita»'
);
select results_eq(
  $$ select p.start_lens::text, p.morning_digest_time::text, p.default_event_visibility::text
     from public.profiles p where p.id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  $$ values ('nest', '08:30:00', 'private') $$,
  'A reads back Nest, 8:30, Solo io'
);
select lives_ok(
  $$ do $d$
     declare
       t time;
     begin
       foreach t in array array['06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00']::time[]
       loop
         update public.profiles set morning_digest_time = t where id = (select auth.uid());
       end loop;
     end
     $d$ $$,
  'the nine times from 6:00 to 10:00 every half hour are accepted'
);
select lives_ok(
  $$ update public.profiles set morning_digest_time = '08:30', default_event_visibility = 'household'
     where id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  'A chooses 8:30 and «Tutto il Nest» together'
);
select lives_ok(
  $$ update public.profiles set default_event_visibility = 'busy', start_lens = 'io'
     where id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  'A chooses «Occupato» and «Io» again'
);
select lives_ok(
  $$ update public.profiles set default_event_visibility = 'private', start_lens = 'nest'
     where id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  'A chooses «Solo io» and «Nest» again'
);

-- Values outside the lists are refused, and nothing changes.
select throws_ok(
  $$ update public.profiles set morning_digest_time = '07:15' where id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  '23514', null, '7:15 is refused (not a half hour)'
);
select throws_ok(
  $$ update public.profiles set morning_digest_time = '05:30' where id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  '23514', null, '5:30 is refused (before 6:00)'
);
select throws_ok(
  $$ update public.profiles set morning_digest_time = '10:30' where id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  '23514', null, '10:30 is refused (after 10:00)'
);
select throws_ok(
  $$ update public.profiles set morning_digest_time = '07:30:01' where id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  '23514', null, '7:30:01 is refused (seconds)'
);
select throws_ok(
  $$ update public.profiles set morning_digest_time = '19:30' where id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  '23514', null, '19:30 is refused (evening)'
);
select throws_ok(
  $$ update public.profiles set morning_digest_time = null where id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  '23502', null, 'the time cannot be emptied'
);
select throws_ok(
  $$ update public.profiles set start_lens = 'tutti' where id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  '22P02', null, 'a lens other than io and nest is refused'
);
select throws_ok(
  $$ update public.profiles set start_lens = null where id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  '23502', null, 'the lens cannot be emptied'
);
select throws_ok(
  $$ update public.profiles set default_event_visibility = 'public' where id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  '22P02', null, 'a visibility other than private, busy and household is refused'
);
select throws_ok(
  $$ update public.profiles set default_event_visibility = null where id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  '23502', null, 'the visibility cannot be emptied'
);
select throws_ok(
  $$ update public.profiles set created_at = now() where id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  '42501', null, 'A cannot change the times of the profile'
);
select results_eq(
  $$ select p.start_lens::text, p.morning_digest_time::text, p.default_event_visibility::text
     from public.profiles p where p.id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  $$ values ('nest', '08:30:00', 'private') $$,
  'the refused values changed nothing'
);

-- ---------------------------------------------------------------------------
-- CA-23: B (Giulia, another household) neither reads nor changes the preferences of A
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';

select is_empty(
  $$ select 1 from public.profiles p where p.id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  'CA-23: B reads 0 rows of the preferences of A'
);
select is_empty(
  $$ update public.profiles set start_lens = 'io', morning_digest_time = '06:00', default_event_visibility = 'household'
     where id = 'aaaaaaaa-0000-4000-8000-000000000001' returning id $$,
  'CA-23: B cannot change the preferences of A (0 rows)'
);
select results_eq(
  $$ select p.id from public.profiles p $$,
  $$ values ('bbbbbbbb-0000-4000-8000-000000000001'::uuid) $$,
  'B reads only their own profile'
);

-- ---------------------------------------------------------------------------
-- B2 (Paolo, same household as Giulia) neither reads nor changes the preferences of B
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';

select is_empty(
  $$ select 1 from public.profiles p where p.id = 'bbbbbbbb-0000-4000-8000-000000000001' $$,
  'B2 reads 0 rows of the preferences of B (same household)'
);
select is_empty(
  $$ update public.profiles set start_lens = 'nest' where id = 'bbbbbbbb-0000-4000-8000-000000000001' returning id $$,
  'B2 cannot change the preferences of B (0 rows)'
);
select is_empty(
  $$ update public.profiles set start_lens = 'nest' where id <> 'bbbbbbbb-0000-4000-8000-000000000002' returning id $$,
  'B2 cannot change any other profile (0 rows)'
);

-- ---------------------------------------------------------------------------
-- anon
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';

select is_empty($$ select 1 from public.profiles $$, 'anon reads 0 preferences');
select throws_ok(
  $$ update public.profiles set start_lens = 'nest' $$,
  '42501', null, 'anon cannot change any preference'
);

reset role;

select results_eq(
  $$ select p.id, p.start_lens::text, p.morning_digest_time::text, p.default_event_visibility::text
     from public.profiles p
     where p.id in ('aaaaaaaa-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001',
                    'bbbbbbbb-0000-4000-8000-000000000002', 'cccccccc-0000-4000-8000-000000000001')
     order by p.id $$,
  $$ values
       ('aaaaaaaa-0000-4000-8000-000000000001'::uuid, 'nest', '08:30:00', 'private'),
       ('bbbbbbbb-0000-4000-8000-000000000001'::uuid, 'io', '07:30:00', 'busy'),
       ('bbbbbbbb-0000-4000-8000-000000000002'::uuid, 'io', '07:30:00', 'busy'),
       ('cccccccc-0000-4000-8000-000000000001'::uuid, 'io', '07:30:00', 'busy') $$,
  'only the preferences of A changed'
);

-- The preferences go with the profile when the account is deleted.
delete from auth.users where id = 'aaaaaaaa-0000-4000-8000-000000000001';
select is_empty(
  $$ select 1 from public.profiles p where p.id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  'the preferences of A are deleted with the account'
);

select * from finish();
rollback;
