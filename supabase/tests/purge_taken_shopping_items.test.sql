-- The taken things of the shopping list disappear 12 hours after they were taken (issue
-- #512, DB-3 of plan #501): private.shopping_taken_lifetime(), the job
-- private.purge_taken_shopping_items() and its pg_cron job, the RPC for the tests
-- public.run_shopping_purge() (CA-1 – CA-7), with the privileges.
-- Seed ids: Marco (Casa D'Angelo, admin, user aaaaaaaa…01, member a1…01), Laura a1…02,
-- Sofia a1…03 (child), Tommaso a1…04 (child); Giulia (Casa Bianchi, bbbbbbbb…01, b1…01).
-- This test gives Laura an account (user aaaaaaaa…02). The seed list is deleted first;
-- things created here: d3… (Casa D'Angelo), e3… (Casa Bianchi).
-- Every instant is relative to now() (the time of the transaction), never a past date.
begin;
create extension if not exists pgtap with schema extensions;

select plan(43);

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-4000-8000-000000000002', 'authenticated',
   'authenticated', 'utente-laura@example.com', '{"full_name":"Laura Test"}', now(), now());
update public.household_members
set user_id = 'aaaaaaaa-0000-4000-8000-000000000002', joined_at = now()
where id = 'a1000000-0000-4000-8000-000000000002';

delete from public.shopping_items;
delete from private.removed_shopping_items;

-- ---------------------------------------------------------------------------
-- Schema and privileges
-- ---------------------------------------------------------------------------
select has_function('private', 'shopping_taken_lifetime', array[]::name[], 'shopping_taken_lifetime exists');
select is(private.shopping_taken_lifetime(), interval '12 hours', 'rule 1: one source for the lifetime of a taken thing, 12 hours');
select has_function(
  'private', 'purge_taken_shopping_items', array['timestamp with time zone', 'uuid'],
  'purge_taken_shopping_items(p_at, p_household_id) exists'
);
select has_function(
  'public', 'run_shopping_purge', array['uuid', 'timestamp with time zone'],
  'run_shopping_purge(p_household_id, p_at) exists'
);
select has_index('public', 'shopping_items', 'shopping_items_taken_checked_at_idx', 'index for the job on the taken things');
select ok(
  (select p.prosecdef from pg_proc p where p.oid = 'public.run_shopping_purge(uuid, timestamptz)'::regprocedure)
  and not (select p.prosecdef from pg_proc p where p.oid = 'private.purge_taken_shopping_items(timestamptz, uuid)'::regprocedure),
  'run_shopping_purge is security definer; the job runs as its caller (pg_cron: the owner)'
);
select ok(
  not has_function_privilege('anon', 'private.purge_taken_shopping_items(timestamptz, uuid)', 'execute')
  and not has_function_privilege('authenticated', 'private.purge_taken_shopping_items(timestamptz, uuid)', 'execute')
  and not has_function_privilege('service_role', 'private.purge_taken_shopping_items(timestamptz, uuid)', 'execute')
  and not has_function_privilege('anon', 'private.shopping_taken_lifetime()', 'execute')
  and not has_function_privilege('authenticated', 'private.shopping_taken_lifetime()', 'execute'),
  'the job and the lifetime: the database owner only'
);
select ok(
  not has_function_privilege('anon', 'public.run_shopping_purge(uuid, timestamptz)', 'execute')
  and not has_function_privilege('authenticated', 'public.run_shopping_purge(uuid, timestamptz)', 'execute')
  and has_function_privilege('service_role', 'public.run_shopping_purge(uuid, timestamptz)', 'execute'),
  'CA-7: run_shopping_purge only for service_role'
);

-- CA-6
select results_eq(
  $$ select j.schedule, j.command, j.active from cron.job j where j.jobname = 'purge-taken-shopping-items' $$,
  $$ values ('*/10 * * * *'::text, 'select private.purge_taken_shopping_items(now(), null);'::text, true) $$,
  'CA-6: pg_cron job purge-taken-shopping-items every 10 minutes, calling private.purge_taken_shopping_items'
);

-- ---------------------------------------------------------------------------
-- CA-1, CA-2: 12 hours, to the minute; the things to buy never expire
-- ---------------------------------------------------------------------------
insert into public.shopping_items (id, household_id, name, quantity, added_by_member_id, checked_at, created_at)
values
  ('d3000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Pile', null,
   'a1000000-0000-4000-8000-000000000001', now() - interval '12 hours 1 minute', now() - interval '2 days'),
  ('d3000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'Carta', '2',
   'a1000000-0000-4000-8000-000000000001', now() - interval '11 hours 59 minutes', now() - interval '2 days'),
  ('d3000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'Riso', null,
   'a1000000-0000-4000-8000-000000000001', null, now() - interval '3 days'),
  ('e3000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'Tè', null,
   'b1000000-0000-4000-8000-000000000001', now() - interval '13 hours', now() - interval '2 days');

select is(
  private.purge_taken_shopping_items(now(), '11111111-1111-4111-8111-111111111111'),
  1,
  'CA-1: the job for Casa D''Angelo deletes one thing'
);
select ok(
  not exists (select 1 from public.shopping_items i where i.id = 'd3000000-0000-4000-8000-000000000001'),
  'CA-1: taken 12 hours and 1 minute ago: deleted'
);
select ok(
  exists (select 1 from public.shopping_items i where i.id = 'd3000000-0000-4000-8000-000000000002'),
  'CA-1: taken 11 hours and 59 minutes ago: kept'
);
select results_eq(
  $$ select i.name, i.checked_at is null from public.shopping_items i where i.id = 'd3000000-0000-4000-8000-000000000003' $$,
  $$ values ('Riso'::text, true) $$,
  'CA-2: a thing to buy created 3 days ago stays, still to buy'
);
select is(
  private.purge_taken_shopping_items(now() + interval '1 minute', '11111111-1111-4111-8111-111111111111'),
  1,
  'rule 1: a thing taken exactly 12 hours before p_at is deleted (checked_at <= p_at - 12 hours)'
);
select ok(
  not exists (select 1 from public.shopping_items i where i.id = 'd3000000-0000-4000-8000-000000000002'),
  'rule 1: Carta is gone 12 hours after it was taken'
);
select is(
  private.purge_taken_shopping_items(now() + interval '30 days', '11111111-1111-4111-8111-111111111111'),
  0,
  'CA-2: the things to buy never expire, however late the job runs'
);
select throws_ok(
  $$ select private.purge_taken_shopping_items(null, '11111111-1111-4111-8111-111111111111') $$,
  '22023', null,
  'the job needs an instant'
);
select throws_ok(
  $$ select private.purge_taken_shopping_items('infinity', null) $$,
  '22023', null,
  'the instant is finite'
);

-- ---------------------------------------------------------------------------
-- CA-3: the people go with the thing, no copy for «Annulla»
-- ---------------------------------------------------------------------------
insert into public.shopping_items (id, household_id, name, quantity, added_by_member_id, checked_at, created_at)
values ('d3000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 'Zucchine', '1 kg',
        'a1000000-0000-4000-8000-000000000001', now() - interval '13 hours', now() - interval '2 days');
insert into public.shopping_item_assignees (shopping_item_id, member_id, household_id)
values ('d3000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111');

select is(
  private.purge_taken_shopping_items(now(), '11111111-1111-4111-8111-111111111111'),
  1,
  'CA-3: the job deletes Zucchine, taken 13 hours ago'
);
select is_empty(
  $$ select 1 from public.shopping_items i where i.id = 'd3000000-0000-4000-8000-000000000004' $$,
  'CA-3: no row in shopping_items'
);
select is_empty(
  $$ select 1 from public.shopping_item_assignees a where a.shopping_item_id = 'd3000000-0000-4000-8000-000000000004' $$,
  'CA-3: no row in shopping_item_assignees (Sofia goes with the thing)'
);
select is_empty(
  $$ select 1 from private.removed_shopping_items r where r.id = 'd3000000-0000-4000-8000-000000000004' $$,
  'CA-3: no copy in private.removed_shopping_items'
);

-- ---------------------------------------------------------------------------
-- CA-4: «Rimetti in lista» stops the count, taken again it starts again
-- ---------------------------------------------------------------------------
insert into public.shopping_items (id, household_id, name, quantity, added_by_member_id, checked_at, created_at)
values ('d3000000-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111', 'Uova', '6',
        'a1000000-0000-4000-8000-000000000001', now() - interval '13 hours', now() - interval '2 days');

set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok(
  $$ update public.shopping_items set checked_at = null where id = 'd3000000-0000-4000-8000-000000000005' $$,
  'CA-4: Laura puts Uova back in the list'
);
select lives_ok(
  $$ update public.shopping_items set checked_at = now() - interval '1 day' where id = 'd3000000-0000-4000-8000-000000000005' $$,
  'CA-4: Laura takes Uova again (the time sent is ignored)'
);
reset role;

select is(
  private.purge_taken_shopping_items(now(), '11111111-1111-4111-8111-111111111111'),
  0,
  'CA-4: the job deletes nothing'
);
select results_eq(
  $$ select i.checked_at from public.shopping_items i where i.id = 'd3000000-0000-4000-8000-000000000005' $$,
  $$ values (now()) $$,
  'CA-4: Uova stays, with checked_at = the time it was taken again'
);

-- ---------------------------------------------------------------------------
-- CA-5: one household, or every household only with null
-- ---------------------------------------------------------------------------
insert into public.shopping_items (id, household_id, name, quantity, added_by_member_id, checked_at, created_at)
values
  ('d3000000-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111', 'Sale', null,
   'a1000000-0000-4000-8000-000000000001', now() - interval '13 hours', now() - interval '2 days');

select is(
  private.purge_taken_shopping_items(now(), '11111111-1111-4111-8111-111111111111'),
  1,
  'CA-5: with Casa D''Angelo the job deletes only Sale'
);
select ok(
  exists (select 1 from public.shopping_items i where i.id = 'e3000000-0000-4000-8000-000000000001'),
  'CA-5: Tè of Casa Bianchi, taken 13 hours ago, stays'
);

insert into public.shopping_items (id, household_id, name, quantity, added_by_member_id, checked_at, created_at)
values
  ('d3000000-0000-4000-8000-000000000007', '11111111-1111-4111-8111-111111111111', 'Olio', null,
   'a1000000-0000-4000-8000-000000000001', now() - interval '13 hours', now() - interval '2 days');

select is(
  private.purge_taken_shopping_items(now(), null),
  2,
  'CA-5: with null the job deletes the taken things of both households'
);
select is_empty(
  $$ select 1 from public.shopping_items i
     where i.id in ('d3000000-0000-4000-8000-000000000007', 'e3000000-0000-4000-8000-000000000001') $$,
  'CA-5: Olio (Casa D''Angelo) and Tè (Casa Bianchi) are gone'
);
select results_eq(
  $$ select i.name from public.shopping_items i order by i.name $$,
  $$ values ('Riso'::text), ('Uova') $$,
  'CA-5: the thing to buy and the thing taken again stay'
);

-- ---------------------------------------------------------------------------
-- CA-7: run_shopping_purge, one household, service_role only
-- ---------------------------------------------------------------------------
insert into public.shopping_items (id, household_id, name, quantity, added_by_member_id, checked_at, created_at)
values
  ('d3000000-0000-4000-8000-000000000008', '11111111-1111-4111-8111-111111111111', 'Burro', null,
   'a1000000-0000-4000-8000-000000000001', now() - interval '13 hours', now() - interval '2 days'),
  ('e3000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', 'Miele', null,
   'b1000000-0000-4000-8000-000000000001', now() - interval '13 hours', now() - interval '2 days');

set local role service_role;
select throws_ok(
  $$ select public.run_shopping_purge(null, now()) $$,
  '22023', null,
  'CA-7: a household is required: the function for the tests never touches every household'
);
select throws_ok(
  $$ select public.run_shopping_purge('11111111-1111-4111-8111-111111111111', null) $$,
  '22023', null,
  'an instant is required'
);
select throws_ok(
  $$ select public.run_shopping_purge('11111111-1111-4111-8111-111111111111', 'infinity') $$,
  '22023', null,
  'the instant is finite'
);
set local request.method to 'GET';
select throws_ok(
  $$ select public.run_shopping_purge('11111111-1111-4111-8111-111111111111', now()) $$,
  'P0001', 'use POST',
  'run_shopping_purge refuses GET'
);
set local request.method to 'HEAD';
select throws_ok(
  $$ select public.run_shopping_purge('11111111-1111-4111-8111-111111111111', now()) $$,
  'P0001', 'use POST',
  'run_shopping_purge refuses HEAD'
);
set local request.method to 'PATCH';
select throws_ok(
  $$ select public.run_shopping_purge('11111111-1111-4111-8111-111111111111', now()) $$,
  'P0001', 'use POST',
  'run_shopping_purge refuses PATCH'
);
set local request.method to 'POST';
select is(
  public.run_shopping_purge('11111111-1111-4111-8111-111111111111', now()),
  1,
  'CA-7: service_role runs the job for Casa D''Angelo: one thing deleted'
);
select is(
  public.run_shopping_purge('11111111-1111-4111-8111-111111111111'),
  0,
  'CA-7: p_at defaults to now; nothing else to delete'
);
reset role;
select results_eq(
  $$ select i.id from public.shopping_items i where i.id in ('d3000000-0000-4000-8000-000000000008', 'e3000000-0000-4000-8000-000000000002') $$,
  $$ values ('e3000000-0000-4000-8000-000000000002'::uuid) $$,
  'CA-7: Burro is gone, Miele of Casa Bianchi stays'
);

set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select public.run_shopping_purge('11111111-1111-4111-8111-111111111111', now()) $$,
  '42501', null,
  'CA-7: authenticated (Marco, administrator) cannot run the job'
);
reset role;
set local role anon;
select throws_ok(
  $$ select public.run_shopping_purge('11111111-1111-4111-8111-111111111111', now()) $$,
  '42501', null,
  'CA-7: anon cannot run the job'
);
reset role;
select ok(
  exists (select 1 from public.shopping_items i where i.id = 'e3000000-0000-4000-8000-000000000002'),
  'Miele of Casa Bianchi is still there'
);

select * from finish();
rollback;
