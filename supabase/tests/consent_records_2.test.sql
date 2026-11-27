-- Consents and password after the security review of #650 (issue #513, DB-4 part 2):
-- - set_consent() with source signup only at sign-up, never afterwards;
-- - consent_records never changed, also by the database owner and the administrative key;
-- - profiles.password_changed_at for display only: no function decides on it, no policy
--   reads it, and its trigger never fails a change of password.
-- Seed ids: Marco (aaaaaaaa…01), Giulia (bbbbbbbb…01). Created here: Ivo (dddddddd…21), a new
-- account. The instants are relative to now() (LEZIONI).
begin;
create extension if not exists pgtap with schema extensions;

select plan(20);

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', 'dddddddd-0000-4000-8000-000000000021', 'authenticated',
        'authenticated', 'utente-ivo@example.com', '{"full_name":"Ivo Test"}', now(), now());

-- Giulia accepted the terms two hours ago (sign-up long over).
insert into public.consent_records (user_id, kind, granted, source, created_at)
values
  ('bbbbbbbb-0000-4000-8000-000000000001', 'terms_and_privacy', true, 'signup', now() - interval '2 hours'),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'adult', true, 'signup', now() - interval '2 hours');

-- ---------------------------------------------------------------------------
-- set_consent(): source signup only at sign-up
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select public.set_consent('product_news_email', true, 'signup') $$, '22023', 'source signup only at sign-up',
  'signup without any acceptance of the terms gives 22023'
);

set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select public.set_consent('product_news_email', true, 'signup') $$, '22023', 'source signup only at sign-up',
  'signup two hours after the sign-up gives 22023'
);
select lives_ok(
  $$ select public.set_consent('product_news_email', true, 'settings') $$,
  'the same choice from the settings works'
);

-- Ivo signs in with Apple: the two required consents, then «Novità dell'app per mail».
set local request.jwt.claims to '{"sub":"dddddddd-0000-4000-8000-000000000021","role":"authenticated"}';
select lives_ok($$ select public.accept_required_consents(null, null, true) $$, 'Ivo accepts the required consents');
select lives_ok(
  $$ select public.set_consent('product_news_email', false, 'signup') $$,
  'at sign-up the choice is saved with source signup'
);
select throws_ok(
  $$ select public.set_consent('product_news_email', true, 'signup') $$, '22023', 'source signup only at sign-up',
  'a second signup choice of the same kind gives 22023'
);
select lives_ok(
  $$ select public.set_consent('product_news_email', true, 'settings') $$,
  'later changes come from the settings'
);
select results_eq(
  $$ select c.kind::text, c.granted, c.source::text from public.consent_records c
     where c.kind = 'product_news_email' order by c.created_at $$,
  $$ values ('product_news_email'::text, false, 'signup'::text), ('product_news_email', true, 'settings') $$,
  'Ivo has the signup choice and the later one'
);
reset role;
select is(
  (select count(*)::integer from public.consent_records c
   where c.user_id = 'bbbbbbbb-0000-4000-8000-000000000001' and c.kind = 'product_news_email' and c.source = 'signup'),
  0,
  'nothing with source signup was written for Giulia'
);

-- ---------------------------------------------------------------------------
-- consent_records: append only for every role
-- ---------------------------------------------------------------------------
select has_trigger('public', 'consent_records', 'consent_records_refuse_update', 'consent_records has the update guard');
select throws_ok(
  $$ update public.consent_records set granted = true where user_id = 'dddddddd-0000-4000-8000-000000000021' $$,
  '42501', 'a consent record is never changed',
  'the database owner cannot change a consent'
);
set local role service_role;
select throws_ok(
  $$ update public.consent_records set source = 'settings' where user_id = 'dddddddd-0000-4000-8000-000000000021' $$,
  '42501', 'a consent record is never changed',
  'the administrative key cannot change a consent'
);
reset role;
select lives_ok(
  $$ delete from auth.users where id = 'dddddddd-0000-4000-8000-000000000021' $$,
  'the consents still go with the account'
);
select is_empty(
  $$ select 1 from public.consent_records c where c.user_id = 'dddddddd-0000-4000-8000-000000000021' $$,
  'no consent left of the deleted account'
);

-- ---------------------------------------------------------------------------
-- password_changed_at: display only
-- ---------------------------------------------------------------------------
select is(
  col_description('public.profiles'::regclass,
                  (select a.attnum from pg_attribute a where a.attrelid = 'public.profiles'::regclass
                   and a.attname = 'password_changed_at')::integer) ~ '^Display only',
  true,
  'the column says it is for display only'
);
select results_eq(
  $$ select (p.pronamespace::regnamespace::text || '.' || p.proname::text || '()') collate "default" from pg_proc p
     where p.pronamespace in ('public'::regnamespace, 'private'::regnamespace)
       and p.prosrc ~ 'password_changed_at'
     order by 1 $$,
  $$ values ('private.profiles_set_password_changed_at()'::text), ('public.mark_password_changed()') $$,
  'only the two writers mention password_changed_at: no function decides on it'
);
select is_empty(
  $$ select 1 from pg_policies p
     where coalesce(p.qual, '') ~ 'password_changed_at' or coalesce(p.with_check, '') ~ 'password_changed_at' $$,
  'no policy reads password_changed_at'
);

-- The trigger never fails a change of password, even if a later write on profiles fails.
create function public.test_forced_failure_513()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'forced failure' using errcode = 'P0001';
end;
$$;
create trigger test_forced_failure_513
  before update on public.profiles
  for each row execute function public.test_forced_failure_513();

select lives_ok(
  $$ update auth.users set encrypted_password = 'not-a-real-hash-513' where id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  'the password changes although the profile cannot be written'
);
select is(
  (select u.encrypted_password from auth.users u where u.id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  'not-a-real-hash-513',
  'and the new password is saved'
);
drop trigger test_forced_failure_513 on public.profiles;
select lives_ok(
  $$ update auth.users set encrypted_password = 'not-a-real-hash-513-b' where id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  'without the failure the date is written again'
);

select * from finish();
rollback;
