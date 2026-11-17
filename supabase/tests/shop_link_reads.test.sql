-- Usage limit of the reading of shop links (issue #418): private.shop_link_reads,
-- public.claim_shop_link_read(), private.purge_shop_link_reads() and its pg_cron job.
-- Limits per account: 20 readings in the last 10 minutes, 100 in the last 24 hours.
-- A = Marco (Casa D'Angelo), B = Giulia (Casa Bianchi), seed accounts.
-- C = f4180000…01, an account created by this test to check the cascade.
begin;
create extension if not exists pgtap with schema extensions;

select plan(50);

-- ---------------------------------------------------------------------------
-- Schema, privileges, schedule
-- ---------------------------------------------------------------------------
select has_table('private', 'shop_link_reads', 'shop_link_reads exists in private');
select ok(
  (select c.relrowsecurity from pg_class c where c.oid = 'private.shop_link_reads'::regclass)
  and not exists (select 1 from pg_policy p where p.polrelid = 'private.shop_link_reads'::regclass),
  'RLS is enabled on shop_link_reads, with no policy'
);
select has_index(
  'private', 'shop_link_reads', 'shop_link_reads_user_id_created_at_idx', array['user_id', 'created_at'],
  'the readings are indexed by account and instant'
);
select ok(
  exists (
    select 1
    from pg_constraint k
    join pg_attribute a on a.attrelid = k.conrelid and a.attnum = any (k.conkey)
    where k.conrelid = 'private.shop_link_reads'::regclass
      and k.contype = 'f'
      and k.confrelid = 'auth.users'::regclass
      and k.confdeltype = 'c'
      and a.attname = 'user_id'
  ),
  'user_id references auth.users on delete cascade'
);
select is_empty(
  $$ select r.role || ' ' || p.privilege
     from (values ('anon'), ('authenticated'), ('service_role')) r (role),
          (values ('select'), ('insert'), ('update'), ('delete'), ('truncate'), ('references'), ('trigger')) p (privilege)
     where has_table_privilege(r.role, 'private.shop_link_reads', p.privilege) $$,
  'no API role has any privilege on shop_link_reads'
);
select is_empty(
  $$ select r.role || ' ' || p.privilege
     from (values ('anon'), ('authenticated'), ('service_role')) r (role),
          (values ('select'), ('insert'), ('update'), ('references')) p (privilege)
     where has_any_column_privilege(r.role, 'private.shop_link_reads', p.privilege) $$,
  'no API role has any column privilege on shop_link_reads'
);
select ok(
  (select p.prosecdef and p.proconfig @> array['search_path=""']
   from pg_proc p where p.oid = 'public.claim_shop_link_read()'::regprocedure),
  'claim_shop_link_read is security definer with an empty search_path'
);
select ok(
  has_function_privilege('authenticated', 'public.claim_shop_link_read()', 'execute')
  and not has_function_privilege('anon', 'public.claim_shop_link_read()', 'execute')
  and not has_function_privilege('service_role', 'public.claim_shop_link_read()', 'execute'),
  'only authenticated can execute claim_shop_link_read'
);
select ok(
  not has_function_privilege('anon', 'private.purge_shop_link_reads(timestamptz)', 'execute')
  and not has_function_privilege('authenticated', 'private.purge_shop_link_reads(timestamptz)', 'execute')
  and not has_function_privilege('service_role', 'private.purge_shop_link_reads(timestamptz)', 'execute'),
  'no API role, not even the administrative key, can run the purge'
);
select ok(
  (select not p.prosecdef and p.proconfig @> array['search_path=""']
   from pg_proc p where p.oid = 'private.purge_shop_link_reads(timestamptz)'::regprocedure),
  'the purge runs as its caller (postgres for pg_cron) with an empty search_path'
);
select results_eq(
  $$ select j.schedule, j.command, j.active from cron.job j where j.jobname = 'purge-shop-link-reads' $$,
  $$ values ('47 * * * *'::text, 'select private.purge_shop_link_reads(now());'::text, true) $$,
  'pg_cron runs the purge every hour'
);

-- ---------------------------------------------------------------------------
-- No access to the table for the API roles
-- ---------------------------------------------------------------------------
set local request.method to 'POST';

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok(
  $$ select public.claim_shop_link_read() $$,
  '42501', null,
  'anon cannot claim a reading'
);
select throws_ok(
  $$ select 1 from private.shop_link_reads $$,
  '42501', null,
  'anon cannot read shop_link_reads'
);
select throws_ok(
  $$ insert into private.shop_link_reads (user_id) values ('aaaaaaaa-0000-4000-8000-000000000001') $$,
  '42501', null,
  'anon cannot write shop_link_reads'
);

set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select 1 from private.shop_link_reads $$,
  '42501', null,
  'A cannot read shop_link_reads'
);
select throws_ok(
  $$ insert into private.shop_link_reads (user_id) values ('aaaaaaaa-0000-4000-8000-000000000001') $$,
  '42501', null,
  'A cannot add readings directly'
);
select throws_ok(
  $$ update private.shop_link_reads set created_at = now() - interval '2 days' $$,
  '42501', null,
  'A cannot move readings out of the windows'
);
select throws_ok(
  $$ delete from private.shop_link_reads $$,
  '42501', null,
  'A cannot delete readings'
);

set local role service_role;
set local request.jwt.claims to '{"role":"service_role"}';
select throws_ok(
  $$ select 1 from private.shop_link_reads $$,
  '42501', null,
  'the administrative key cannot read shop_link_reads'
);
select throws_ok(
  $$ insert into private.shop_link_reads (user_id) values ('aaaaaaaa-0000-4000-8000-000000000001') $$,
  '42501', null,
  'the administrative key cannot write shop_link_reads'
);
select throws_ok(
  $$ select public.claim_shop_link_read() $$,
  '42501', null,
  'the administrative key cannot claim a reading'
);

set local role authenticated;
set local request.jwt.claims to '{"role":"authenticated"}';
select throws_ok(
  $$ select public.claim_shop_link_read() $$,
  '42501', 'not signed in',
  'a reading needs a signed-in account'
);

-- ---------------------------------------------------------------------------
-- Only POST through the Data API, refused before reading or writing
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
set local request.method to 'GET';
select throws_ok($$ select public.claim_shop_link_read() $$, 'P0001', 'use POST', 'GET is refused');
set local request.method to 'HEAD';
select throws_ok($$ select public.claim_shop_link_read() $$, 'P0001', 'use POST', 'HEAD is refused');
set local request.method to 'PUT';
select throws_ok($$ select public.claim_shop_link_read() $$, 'P0001', 'use POST', 'PUT is refused');
set local request.method to 'PATCH';
select throws_ok($$ select public.claim_shop_link_read() $$, 'P0001', 'use POST', 'PATCH is refused');
set local request.method to 'DELETE';
select throws_ok($$ select public.claim_shop_link_read() $$, 'P0001', 'use POST', 'DELETE is refused');
set local request.method to 'POST';

reset role;
select is(
  (select count(*)::integer from private.shop_link_reads),
  0,
  'the refused calls recorded nothing'
);

-- ---------------------------------------------------------------------------
-- Count: 20 readings in 10 minutes, then refused; other accounts are not affected
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select is(
  (select count(*)::integer from (select public.claim_shop_link_read() as allowed from generate_series(1, 20)) s
   where s.allowed),
  20,
  'A: the first 20 readings in 10 minutes are allowed'
);
select is(public.claim_shop_link_read(), false, 'A: the 21st reading in 10 minutes is refused');

reset role;
select is(
  (select count(*)::integer from private.shop_link_reads r where r.user_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  20,
  'A: a refused reading is not recorded'
);

set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select is(public.claim_shop_link_read(), true, 'B: the readings of A do not count for B');

reset role;
select results_eq(
  $$ select r.user_id, count(*)::integer from private.shop_link_reads r group by r.user_id order by r.user_id $$,
  $$ values ('aaaaaaaa-0000-4000-8000-000000000001'::uuid, 20), ('bbbbbbbb-0000-4000-8000-000000000001'::uuid, 1) $$,
  'every reading is recorded for its own account'
);

-- ---------------------------------------------------------------------------
-- Windows (rows moved as the database owner)
-- ---------------------------------------------------------------------------
update private.shop_link_reads
set created_at = now() - interval '10 minutes'
where user_id = 'aaaaaaaa-0000-4000-8000-000000000001';

set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select is(public.claim_shop_link_read(), true,
  'A: readings of exactly 10 minutes ago no longer count in the short window');

reset role;
delete from private.shop_link_reads where user_id = 'aaaaaaaa-0000-4000-8000-000000000001';
insert into private.shop_link_reads (user_id, created_at)
select 'aaaaaaaa-0000-4000-8000-000000000001', now() - interval '10 minutes' + interval '1 second'
from generate_series(1, 20);

set local role authenticated;
select is(public.claim_shop_link_read(), false,
  'A: 20 readings younger than 10 minutes refuse the next one');

reset role;
delete from private.shop_link_reads where user_id = 'aaaaaaaa-0000-4000-8000-000000000001';
insert into private.shop_link_reads (user_id, created_at)
select 'aaaaaaaa-0000-4000-8000-000000000001', now() - interval '1 hour'
from generate_series(1, 99);

set local role authenticated;
select is(public.claim_shop_link_read(), true, 'A: the 100th reading in 24 hours is allowed');
select is(public.claim_shop_link_read(), false, 'A: the 101st reading in 24 hours is refused');

reset role;
select is(
  (select count(*)::integer from private.shop_link_reads r where r.user_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  100,
  'A: 100 readings recorded in 24 hours'
);
update private.shop_link_reads
set created_at = now() - interval '24 hours'
where id = (
  select r.id from private.shop_link_reads r
  where r.user_id = 'aaaaaaaa-0000-4000-8000-000000000001' and r.created_at < now()
  limit 1
);

set local role authenticated;
select is(public.claim_shop_link_read(), true,
  'A: a reading of exactly 24 hours ago no longer counts in the daily window');
select is(public.claim_shop_link_read(), false, 'A: again 100 readings in 24 hours, the next is refused');

set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select is(public.claim_shop_link_read(), true, 'B: still allowed while A is at the daily limit');

-- ---------------------------------------------------------------------------
-- Purge of the readings older than 24 hours
-- ---------------------------------------------------------------------------
reset role;
delete from private.shop_link_reads;
insert into private.shop_link_reads (user_id, created_at)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', now() - interval '25 hours'),
  ('aaaaaaaa-0000-4000-8000-000000000001', now() - interval '24 hours'),
  ('aaaaaaaa-0000-4000-8000-000000000001', now() - interval '23 hours'),
  ('bbbbbbbb-0000-4000-8000-000000000001', now() - interval '30 hours'),
  ('bbbbbbbb-0000-4000-8000-000000000001', now());

select is(private.purge_shop_link_reads(now()), 3, 'the purge deletes the 3 readings of 24 hours ago or older');
select results_eq(
  $$ select r.user_id, r.created_at from private.shop_link_reads r order by r.user_id $$,
  $$ values ('aaaaaaaa-0000-4000-8000-000000000001'::uuid, now() - interval '23 hours'),
            ('bbbbbbbb-0000-4000-8000-000000000001'::uuid, now()) $$,
  'the purge keeps the readings younger than 24 hours, of every account'
);

insert into private.shop_link_reads (user_id, created_at)
values ('aaaaaaaa-0000-4000-8000-000000000001', now() - interval '48 hours');
-- The command of the pg_cron job, run as the database owner like the job.
select lives_ok(
  (select j.command from cron.job j where j.jobname = 'purge-shop-link-reads'),
  'the scheduled purge runs'
);
select results_eq(
  $$ select count(*)::integer, count(*) filter (where r.created_at <= now() - interval '24 hours')::integer
     from private.shop_link_reads r $$,
  $$ values (2, 0) $$,
  'the scheduled purge deletes the old readings and keeps the recent ones'
);
select throws_ok(
  $$ select private.purge_shop_link_reads(null) $$,
  '22004', null,
  'the reference time is required'
);

set local role authenticated;
select throws_ok(
  $$ select private.purge_shop_link_reads(now()) $$,
  '42501', null,
  'a signed-in user cannot run the purge'
);
reset role;

-- ---------------------------------------------------------------------------
-- The readings go with the account
-- ---------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, email_confirmed_at, last_sign_in_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values (
  '00000000-0000-0000-0000-000000000000', 'f4180000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
  'limite-418@example.com', now(), now(), '{"provider":"email","providers":["email"]}', '{}',
  now(), now(), '', '', '', ''
);

set local role authenticated;
set local request.jwt.claims to '{"sub":"f4180000-0000-4000-8000-000000000001","role":"authenticated"}';
select is(
  (select count(*)::integer from (select public.claim_shop_link_read() as allowed from generate_series(1, 2)) s
   where s.allowed),
  2,
  'C: two readings allowed'
);

reset role;
delete from auth.users where id = 'f4180000-0000-4000-8000-000000000001';
select is(
  (select count(*)::integer from private.shop_link_reads r where r.user_id = 'f4180000-0000-4000-8000-000000000001'),
  0,
  'the readings of a deleted account are deleted with it'
);
select is(
  (select count(*)::integer from private.shop_link_reads r where r.user_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  1,
  'the readings of the other accounts stay'
);

select * from finish();
rollback;
