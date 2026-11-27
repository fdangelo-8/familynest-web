-- The date of the password and the appearance in profiles (issue #513, DB-4 part 1: CA-8, the
-- profiles part of CA-27 – CA-30; A17 #550 mark_password_changed(); A18 #551 appearance).
-- Seed ids: Marco (Casa D'Angelo, admin, user aaaaaaaa…01), Giulia (Casa Bianchi,
-- bbbbbbbb…01). The seed accounts have no password. Users of this test (f5130000-…): 01
-- with a password, 02 with Google only (empty password), 03 with a null password.
-- now() is the time of the test transaction: the triggers write it.
begin;
create extension if not exists pgtap with schema extensions;

select plan(32);

-- ---------------------------------------------------------------------------
-- Schema and privileges
-- ---------------------------------------------------------------------------
select col_type_is('public', 'profiles', 'password_changed_at', 'timestamp with time zone', 'password_changed_at is a timestamptz');
select col_is_null('public', 'profiles', 'password_changed_at', 'password_changed_at can be null');
select col_type_is('public', 'profiles', 'appearance', 'appearance_mode', 'appearance is an appearance_mode');
select col_not_null('public', 'profiles', 'appearance', 'appearance is required');
select col_default_is('public', 'profiles', 'appearance', 'system', 'appearance is «Come il telefono» by default');
select enum_has_labels('public', 'appearance_mode', array['light', 'dark', 'system'], 'appearance_mode labels');
select ok(
  has_column_privilege('authenticated', 'public.profiles', 'appearance', 'update')
  and not has_column_privilege('authenticated', 'public.profiles', 'password_changed_at', 'update')
  and not has_column_privilege('anon', 'public.profiles', 'appearance', 'update'),
  'the app updates the appearance, never the date of the password'
);
select is_empty(
  $$ select 1 from public.profiles p where p.appearance <> 'system' or p.password_changed_at is not null $$,
  'the existing profiles get «Come il telefono» and no password date'
);

-- ---------------------------------------------------------------------------
-- CA-8: the trigger on auth.users
-- ---------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'f5130000-0000-4000-8000-000000000001', 'authenticated',
   'authenticated', 'password-1@example.com', '$2a$10$abcdefghijklmnopqrstuvabcdefghijklmnopqrstuvwxyz01234', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'f5130000-0000-4000-8000-000000000002', 'authenticated',
   'authenticated', 'google-1@example.com', '', '{"full_name":"Solo Google"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'f5130000-0000-4000-8000-000000000003', 'authenticated',
   'authenticated', 'apple-1@example.com', null, '{}', now(), now());

select is(
  (select p.password_changed_at from public.profiles p where p.id = 'f5130000-0000-4000-8000-000000000001'),
  now(),
  'CA-8: an account created with a password has the time of its creation'
);
select is(
  (select p.password_changed_at from public.profiles p where p.id = 'f5130000-0000-4000-8000-000000000002'),
  null,
  'CA-8: an account with Google only (empty password) has null'
);
select is(
  (select p.password_changed_at from public.profiles p where p.id = 'f5130000-0000-4000-8000-000000000003'),
  null,
  'CA-8: an account without password (null) has null'
);

-- The change: an old date first, then a new password.
update public.profiles set password_changed_at = now() - interval '30 days'
where id = 'f5130000-0000-4000-8000-000000000001';
update auth.users set email_confirmed_at = now() where id = 'f5130000-0000-4000-8000-000000000001';
select is(
  (select p.password_changed_at from public.profiles p where p.id = 'f5130000-0000-4000-8000-000000000001'),
  now() - interval '30 days',
  'another change of the account leaves the date as it is'
);
update auth.users set encrypted_password = '$2a$10$zyxwvutsrqponmlkjihgfedcbazyxwvutsrqponmlkjihgfedcba98'
where id = 'f5130000-0000-4000-8000-000000000001';
select is(
  (select p.password_changed_at from public.profiles p where p.id = 'f5130000-0000-4000-8000-000000000001'),
  now(),
  'CA-8: when the password changes, password_changed_at is the time of the change'
);
update auth.users set encrypted_password = '$2a$10$abcdefghijklmnopqrstuvabcdefghijklmnopqrstuvwxyz01234'
where id = 'f5130000-0000-4000-8000-000000000002';
select is(
  (select p.password_changed_at from public.profiles p where p.id = 'f5130000-0000-4000-8000-000000000002'),
  now(),
  'an account of Google that sets a password gets the date'
);

-- ---------------------------------------------------------------------------
-- CA-8, CA-27, CA-28: what the app reads and writes
-- ---------------------------------------------------------------------------
update auth.users set encrypted_password = '$2a$10$abcdefghijklmnopqrstuvabcdefghijklmnopqrstuvwxyz01234'
where id = 'aaaaaaaa-0000-4000-8000-000000000001';

set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';

select results_eq(
  $$ select p.password_changed_at = now(), p.appearance::text from public.profiles p $$,
  $$ values (true, 'system') $$,
  'Marco reads the date of his password and his appearance'
);
select throws_ok(
  $$ update public.profiles set password_changed_at = now() - interval '1 day' where id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  '42501', null, 'CA-8: a direct update of password_changed_at by Marco gives 42501'
);
select lives_ok(
  $$ update public.profiles set appearance = 'dark' where id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  'A18: Marco chooses «Scuro»'
);
select throws_ok(
  $$ update public.profiles set appearance = 'sepia' where id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  '22P02', null, 'an appearance outside the three choices is refused'
);
select is_empty(
  $$ update public.profiles set appearance = 'light' where id = 'bbbbbbbb-0000-4000-8000-000000000001' returning id $$,
  'CA-28: Marco cannot change the appearance of another account (0 rows)'
);

-- mark_password_changed() (A17 #550).
set local request.method to 'GET';
select throws_ok(
  $$ select public.mark_password_changed() $$, 'P0001', 'use POST', 'CA-30: mark_password_changed refuses GET'
);
set local request.method to 'POST';
reset role;
update public.profiles set password_changed_at = now() - interval '2 days' where id = 'aaaaaaaa-0000-4000-8000-000000000001';
set local role authenticated;
select lives_ok($$ select public.mark_password_changed() $$, 'Marco marks his password as changed');
select is(
  (select p.password_changed_at from public.profiles p),
  now(),
  'mark_password_changed() writes now() on the caller''s profile'
);

-- Giulia: no password, and nothing of Marco.
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$ select public.mark_password_changed() $$, 'Giulia (no password) calls mark_password_changed');
select results_eq(
  $$ select p.id, p.password_changed_at, p.appearance::text from public.profiles p $$,
  $$ values ('bbbbbbbb-0000-4000-8000-000000000001'::uuid, null::timestamptz, 'system') $$,
  'an account without password stays null; Giulia reads only her profile, with her own appearance'
);
select is_empty(
  $$ select p.password_changed_at from public.profiles p where p.id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  'CA-27: Giulia reads 0 rows of the profile of Marco (password date, appearance)'
);
select is_empty(
  $$ update public.profiles set appearance = 'light' where id = 'aaaaaaaa-0000-4000-8000-000000000001' returning id $$,
  'CA-27: Giulia cannot change the appearance of Marco (0 rows)'
);

-- ---------------------------------------------------------------------------
-- CA-29: anon
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select is_empty($$ select 1 from public.profiles $$, 'CA-29: anon reads 0 profiles');
select throws_ok(
  $$ update public.profiles set appearance = 'dark' $$, '42501', null, 'CA-29: anon cannot change an appearance'
);
select throws_ok($$ select public.mark_password_changed() $$, '42501', null, 'CA-29: anon cannot call mark_password_changed');

reset role;
select results_eq(
  $$ select p.id, p.appearance::text from public.profiles p
     where p.id in ('aaaaaaaa-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001') order by p.id $$,
  $$ values ('aaaaaaaa-0000-4000-8000-000000000001'::uuid, 'dark'), ('bbbbbbbb-0000-4000-8000-000000000001'::uuid, 'system') $$,
  'A18 CA-11: Marco has «Scuro», the others keep «Come il telefono»'
);
select is(
  (select p.password_changed_at from public.profiles p where p.id = 'bbbbbbbb-0000-4000-8000-000000000001'),
  null,
  'Giulia still has no password date'
);
select ok(
  (select count(*) = 3 from pg_trigger t
   where t.tgrelid = 'auth.users'::regclass
     and t.tgname in ('on_auth_user_created_consents', 'on_auth_user_password_set', 'on_auth_user_password_changed')),
  'the three triggers of #513 are on auth.users'
);

select * from finish();
rollback;
