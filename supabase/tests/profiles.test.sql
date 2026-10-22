-- profiles: created by trigger, visible only to their owner (issue #9: CA-8, CA-12).
-- A = Marco, B = Giulia.
begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

-- CA-8: a new account gets its profile with the provider name.
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', 'eeeeeeee-0000-4000-8000-000000000001', 'authenticated',
        'authenticated', 'mario@example.com', '{"full_name":"  Mario Test  "}', now(), now());

select is(
  (select p.display_name from public.profiles p where p.id = 'eeeeeeee-0000-4000-8000-000000000001'),
  'Mario Test',
  'CA-8: the profile of the new user has the name from the metadata'
);

-- Sign-up never fails because of the name: long names are cut, missing names are null.
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'eeeeeeee-0000-4000-8000-000000000002', 'authenticated',
   'authenticated', 'lungo@example.com', jsonb_build_object('name', repeat('x', 99) || ' y' || repeat('z', 50)), now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'eeeeeeee-0000-4000-8000-000000000003', 'authenticated',
   'authenticated', 'senza-nome@example.com', '{}', now(), now());

select is(
  (select p.display_name from public.profiles p where p.id = 'eeeeeeee-0000-4000-8000-000000000002'),
  repeat('x', 99),
  'a name longer than 100 characters is cut and trimmed'
);
select is(
  (select p.display_name from public.profiles p where p.id = 'eeeeeeee-0000-4000-8000-000000000003'),
  null,
  'a user without name gets an empty profile name'
);
select is_empty(
  $$ select 1 from information_schema.columns c
     where c.table_schema = 'public' and c.table_name = 'profiles' and c.column_name ilike '%mail%' $$,
  'the email is not copied in profiles'
);

-- ---------------------------------------------------------------------------
-- CA-8: B reads only their own profile.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';

select results_eq(
  $$ select p.id, p.display_name from public.profiles p $$,
  $$ values ('bbbbbbbb-0000-4000-8000-000000000001'::uuid, 'Giulia Bianchi') $$,
  'CA-8: B reads only their own profile'
);
select is_empty(
  $$ select 1 from public.profiles p where p.id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  'CA-8: B reads 0 rows of the profile of A'
);
select is_empty(
  $$ update public.profiles set display_name = 'Hacked' where id = 'aaaaaaaa-0000-4000-8000-000000000001' returning id $$,
  'B cannot change the profile of A (0 rows)'
);
select lives_ok(
  $$ update public.profiles set display_name = 'Giulia B.' where id = 'bbbbbbbb-0000-4000-8000-000000000001' $$,
  'B changes their own profile name'
);
select throws_ok(
  $$ insert into public.profiles (id, display_name) values ('cccccccc-0000-4000-8000-000000000002', 'Finto') $$,
  '42501',
  null,
  'a profile cannot be inserted directly'
);
select throws_ok(
  $$ delete from public.profiles where id = 'bbbbbbbb-0000-4000-8000-000000000001' $$,
  '42501',
  null,
  'a profile cannot be deleted directly (it goes with the account)'
);

-- ---------------------------------------------------------------------------
-- CA-12: anonymous users.
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';

select is_empty($$ select 1 from public.profiles $$, 'CA-12: anon reads 0 profiles');
select throws_ok(
  $$ insert into public.profiles (id, display_name) values ('cccccccc-0000-4000-8000-000000000002', 'Finto') $$,
  '42501',
  null,
  'CA-12: anon cannot insert a profile'
);

reset role;

select results_eq(
  $$ select p.display_name from public.profiles p
     where p.id in ('aaaaaaaa-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001')
     order by p.id $$,
  $$ values ('Marco D''Angelo'), ('Giulia B.') $$,
  'only the own profile of B changed'
);

-- Deleting the account deletes the profile.
delete from auth.users where id = 'eeeeeeee-0000-4000-8000-000000000001';
select is_empty(
  $$ select 1 from public.profiles p where p.id = 'eeeeeeee-0000-4000-8000-000000000001' $$,
  'the profile is deleted with the account'
);

select * from finish();
rollback;
