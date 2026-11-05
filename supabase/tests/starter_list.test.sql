-- Starter list and welcome of page #30 Oggi (issue #90):
-- households.first_shopping_item_at (trigger and backfill rule),
-- households.starter_list_completed_at with complete_starter_list(),
-- current_member_welcome().
-- Seed ids: A = Marco (Casa D'Angelo, admin; Laura has a valid pending invitation),
-- B = Giulia (Casa Bianchi, admin; Anna has an expired pending invitation),
-- B2 = Paolo (Casa Bianchi, not admin, joined without invitation), C = Chiara (no
-- household). Created here: D and E, two new users without household.
-- Every check runs inside one transaction, so now() is the same everywhere.
begin;
create extension if not exists pgtap with schema extensions;

select plan(67);

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'dddddddd-0000-4000-8000-000000000001', 'authenticated',
   'authenticated', 'utente-d@example.com', '{"full_name":"Davide Test"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'eeeeeeee-0000-4000-8000-000000000001', 'authenticated',
   'authenticated', 'utente-e@example.com', '{"full_name":"Elena Test"}', now(), now());

-- ---------------------------------------------------------------------------
-- Schema: columns, function signatures, security definer with empty search_path.
-- ---------------------------------------------------------------------------
select has_column('public', 'households', 'first_shopping_item_at', 'households.first_shopping_item_at exists');
select has_column('public', 'households', 'starter_list_completed_at', 'households.starter_list_completed_at exists');
select is(
  pg_get_function_result('public.current_member_welcome()'::regprocedure),
  'TABLE(inviter_name text)',
  'current_member_welcome() returns only the name of the inviter'
);
select is(
  pg_get_function_result('public.complete_starter_list()'::regprocedure),
  'boolean',
  'complete_starter_list() returns a boolean'
);
select results_eq(
  $$
    select p.proname::text collate "default", p.prosecdef, array_to_string(p.proconfig, ',') collate "default"
    from pg_proc p
    where p.oid in (
      'public.complete_starter_list()'::regprocedure,
      'public.current_member_welcome()'::regprocedure,
      'private.shopping_items_record_first_item()'::regprocedure
    )
    order by p.proname
  $$,
  $$
    values
      ('complete_starter_list', true, 'search_path=""'),
      ('current_member_welcome', true, 'search_path=""'),
      ('shopping_items_record_first_item', true, 'search_path=""')
  $$,
  'the three functions are security definer with an empty search_path'
);
select ok(
  not has_function_privilege('anon', 'public.complete_starter_list()', 'execute')
  and not has_function_privilege('anon', 'public.current_member_welcome()', 'execute')
  and has_function_privilege('authenticated', 'public.complete_starter_list()', 'execute')
  and has_function_privilege('authenticated', 'public.current_member_welcome()', 'execute')
  and not has_function_privilege('authenticated', 'private.shopping_items_record_first_item()', 'execute'),
  'only authenticated users run the RPCs; nobody calls the trigger function'
);
select ok(
  not has_column_privilege('authenticated', 'public.households', 'first_shopping_item_at', 'update')
  and not has_column_privilege('authenticated', 'public.households', 'starter_list_completed_at', 'update')
  and not has_column_privilege('anon', 'public.households', 'first_shopping_item_at', 'update')
  and not has_column_privilege('anon', 'public.households', 'starter_list_completed_at', 'update'),
  'the app has no update privilege on the two new columns'
);

-- ---------------------------------------------------------------------------
-- Seed: both households have the starter list completed and the time of their oldest
-- shopping item (set by the trigger while seeding).
-- ---------------------------------------------------------------------------
select results_eq(
  $$
    select h.name, h.starter_list_completed_at is not null,
           h.first_shopping_item_at = (select min(s.created_at) from public.shopping_items s where s.household_id = h.id)
    from public.households h
    order by h.name
  $$,
  $$ values ('Casa Bianchi', true, true), ('Casa D''Angelo', true, true) $$,
  'seed: starter list completed and first_shopping_item_at = oldest item, in both households'
);

-- The backfill rule (same statement as the backfill migration) gives the same values and
-- touches no row: it is idempotent.
select is_empty(
  $$
    update public.households h
    set first_shopping_item_at = f.first_at
    from (
      select x.household_id, min(x.created_at) as first_at
      from (
        select s.household_id, s.created_at from public.shopping_items s
        union all
        select r.household_id, r.created_at from private.removed_shopping_items r
      ) x
      group by x.household_id
    ) f
    where h.id = f.household_id
      and (h.first_shopping_item_at is null or h.first_shopping_item_at > f.first_at)
    returning h.id
  $$,
  'backfill rule: nothing to change after the trigger'
);
-- Backfill of a household whose value is missing (data from before the trigger).
update public.households set first_shopping_item_at = null where id = '22222222-2222-4222-8222-222222222222';
update public.households h
set first_shopping_item_at = f.first_at
from (
  select x.household_id, min(x.created_at) as first_at
  from (
    select s.household_id, s.created_at from public.shopping_items s
    union all
    select r.household_id, r.created_at from private.removed_shopping_items r
  ) x
  group by x.household_id
) f
where h.id = f.household_id
  and (h.first_shopping_item_at is null or h.first_shopping_item_at > f.first_at);
select is(
  (select h.first_shopping_item_at from public.households h where h.id = '22222222-2222-4222-8222-222222222222'),
  (select min(s.created_at) from public.shopping_items s where s.household_id = '22222222-2222-4222-8222-222222222222'),
  'backfill rule: a missing value becomes the creation time of the oldest item'
);

-- For the tests of complete_starter_list(): Casa D'Angelo and Casa Bianchi start with the
-- list not completed.
update public.households set starter_list_completed_at = null;

-- ---------------------------------------------------------------------------
-- Reading the columns: members only (households_select), A and B isolated.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';

select results_eq(
  $$ select h.id, h.first_shopping_item_at is not null from public.households h $$,
  $$ values ('22222222-2222-4222-8222-222222222222'::uuid, true) $$,
  'B2 (not admin) reads first_shopping_item_at of their own household only'
);

set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';

select is_empty(
  $$ select h.first_shopping_item_at, h.starter_list_completed_at from public.households h
     where h.id = '11111111-1111-4111-8111-111111111111' $$,
  'B reads nothing of Casa D''Angelo'
);
select throws_ok(
  $$ update public.households set starter_list_completed_at = now() where id = '22222222-2222-4222-8222-222222222222' $$,
  '42501',
  null,
  'B (admin) cannot set starter_list_completed_at directly'
);
select throws_ok(
  $$ update public.households set first_shopping_item_at = null where id = '22222222-2222-4222-8222-222222222222' $$,
  '42501',
  null,
  'B (admin) cannot clear first_shopping_item_at directly'
);
select throws_ok(
  $$ update public.households set starter_list_completed_at = now() where id = '11111111-1111-4111-8111-111111111111' $$,
  '42501',
  null,
  'B cannot set starter_list_completed_at of Casa D''Angelo'
);

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';

select is_empty(
  $$ select h.first_shopping_item_at, h.starter_list_completed_at from public.households h $$,
  'anon reads no household'
);
select throws_ok(
  $$ select public.complete_starter_list() $$,
  '42501',
  null,
  'anon cannot call complete_starter_list()'
);
select throws_ok(
  $$ select * from public.current_member_welcome() $$,
  '42501',
  null,
  'anon cannot call current_member_welcome()'
);

-- ---------------------------------------------------------------------------
-- first_shopping_item_at: set on the first item, never cleared, only in its household.
-- C creates Casa Neri (admin, alone).
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}';

select throws_ok(
  $$ select public.complete_starter_list() $$,
  '42501',
  'permission denied for function complete_starter_list',
  'C without household cannot complete a starter list'
);
select is_empty($$ select * from public.current_member_welcome() $$, 'C without household gets no welcome');

select lives_ok(
  $$ select public.create_household('Casa Neri', 'single', 'Chiara', 'peonia') $$,
  'C creates Casa Neri'
);
select results_eq(
  $$ select h.first_shopping_item_at, h.starter_list_completed_at from public.households h $$,
  $$ values (null::timestamptz, null::timestamptz) $$,
  'a new household has neither value'
);
select is(public.complete_starter_list(), false, 'Casa Neri without shopping items: not completed');
select is_empty($$ select * from public.current_member_welcome() $$, 'C created the household: no welcome');

select lives_ok(
  $$ insert into public.shopping_items (name) values ('Pane') $$,
  'C adds the first item'
);
select is(
  (select h.first_shopping_item_at from public.households h),
  now(),
  'first_shopping_item_at = time of the first item'
);

reset role;
-- The first item was added one hour ago: the next items do not change it.
update public.households set first_shopping_item_at = now() - interval '1 hour'
where id = (select m.household_id from public.household_members m where m.user_id = 'cccccccc-0000-4000-8000-000000000001');
do $$
begin
  perform set_config(
    'test.neri_id',
    (select m.household_id::text from public.household_members m where m.user_id = 'cccccccc-0000-4000-8000-000000000001'),
    true
  );
end;
$$;
set local role authenticated;
set local request.jwt.claims to '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}';

select lives_ok(
  $$ insert into public.shopping_items (name) values ('Latte') $$,
  'C adds a second item'
);
select is(
  (select h.first_shopping_item_at from public.households h),
  now() - interval '1 hour',
  'a later item does not change first_shopping_item_at'
);
select lives_ok(
  $$ update public.shopping_items set checked_at = now() $$,
  'C takes every item'
);
select lives_ok(
  $$ select public.clear_checked_shopping_items(array(select s.id from public.shopping_items s)) $$,
  'C removes every item (strappo)'
);
select is_empty($$ select 1 from public.shopping_items $$, 'the shopping list of Casa Neri is empty');
select is(
  (select h.first_shopping_item_at from public.households h),
  now() - interval '1 hour',
  'removing the items does not clear first_shopping_item_at'
);

reset role;
select results_eq(
  $$ select h.name, h.first_shopping_item_at is not null from public.households h order by h.name $$,
  $$ values ('Casa Bianchi', true), ('Casa D''Angelo', true), ('Casa Neri', true) $$,
  'every household keeps its own value'
);
-- An item inserted by the database with an older creation time (seed) moves it back.
insert into public.shopping_items (household_id, name, created_at)
values (current_setting('test.neri_id')::uuid, 'Uova', now() - interval '3 hours');
select is(
  (select h.first_shopping_item_at from public.households h where h.id = current_setting('test.neri_id')::uuid),
  now() - interval '3 hours',
  'an older item inserted by the database moves first_shopping_item_at back'
);

-- Isolation: B adds an item in Casa Bianchi; the other households are unchanged.
do $$
begin
  perform set_config(
    'test.before',
    (select jsonb_object_agg(h.id, h.first_shopping_item_at)::text from public.households h),
    true
  );
end;
$$;
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok(
  $$ insert into public.shopping_items (name) values ('Arance') $$,
  'B adds an item in Casa Bianchi'
);
reset role;
select is(
  (select jsonb_object_agg(h.id, h.first_shopping_item_at) from public.households h),
  current_setting('test.before')::jsonb,
  'an item of Casa Bianchi changes no first_shopping_item_at (Casa Bianchi already had one)'
);

-- ---------------------------------------------------------------------------
-- complete_starter_list(): pending invitations block, non administrators are refused.
-- Casa Neri: C adds Ugo and invites him.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}';

select lives_ok(
  $$ insert into public.household_members (household_id, kind, name, color)
     values (public.current_household_id(), 'adult', 'Ugo', 'basilico') $$,
  'C adds Ugo'
);
select lives_ok(
  $$ insert into public.invitations (household_id, member_id)
     select m.household_id, m.id from public.household_members m where m.name = 'Ugo' $$,
  'C invites Ugo'
);
select is(public.complete_starter_list(), false, 'a pending invitation: not completed');
select is(
  (select h.starter_list_completed_at from public.households h),
  null,
  'a refused completion changes nothing'
);

reset role;
do $$
begin
  perform set_config(
    'test.ugo_token',
    (select i.token from public.invitations i join public.household_members m on m.id = i.member_id where m.name = 'Ugo'),
    true
  );
end;
$$;

-- E accepts the invitation of Ugo: E is a member of Casa Neri, not an administrator.
set local role authenticated;
set local request.jwt.claims to '{"sub":"eeeeeeee-0000-4000-8000-000000000001","role":"authenticated"}';

select lives_ok(
  $$ select public.accept_invitation(current_setting('test.ugo_token')) $$,
  'E accepts the invitation of Ugo'
);
select throws_ok(
  $$ select public.complete_starter_list() $$,
  '42501',
  'permission denied for function complete_starter_list',
  'E (not administrator) cannot complete the starter list'
);
select results_eq(
  $$ select * from public.current_member_welcome() $$,
  $$ values ('Chiara'::text) $$,
  'E joined with the invitation of Chiara less than 24 hours ago: welcome from Chiara'
);
select is_empty($$ select 1 from public.invitations $$, 'E (not administrator) reads no invitation directly');

set local request.jwt.claims to '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}';

select is_empty($$ select * from public.current_member_welcome() $$, 'C (the inviter) gets no welcome');
select is(public.complete_starter_list(), true, 'item added and invitation accepted: completed');
select is(
  (select h.starter_list_completed_at from public.households h),
  now(),
  'starter_list_completed_at = time of the completion'
);

reset role;
update public.households set starter_list_completed_at = now() - interval '2 hours'
where id = current_setting('test.neri_id')::uuid;
set local role authenticated;
set local request.jwt.claims to '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}';

-- A new pending invitation does not reopen the list.
select lives_ok(
  $$ insert into public.household_members (household_id, kind, name, color)
     values (public.current_household_id(), 'adult', 'Vera', 'cannella') $$,
  'C adds Vera'
);
select lives_ok(
  $$ insert into public.invitations (household_id, member_id)
     select m.household_id, m.id from public.household_members m where m.name = 'Vera' $$,
  'C invites Vera'
);
select is(public.complete_starter_list(), true, 'already completed: still completed');
select is(
  (select h.starter_list_completed_at from public.households h),
  now() - interval '2 hours',
  'the time of the completion never changes'
);

-- ---------------------------------------------------------------------------
-- complete_starter_list() in the seed households: isolation and expired invitations.
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';

select throws_ok(
  $$ select public.complete_starter_list() $$,
  '42501',
  'permission denied for function complete_starter_list',
  'B2 (not administrator) cannot complete the starter list of Casa Bianchi'
);

set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';

select is(public.complete_starter_list(), false, 'A: the invitation of Laura is pending, not completed');

set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';

select is(
  public.complete_starter_list(),
  true,
  'B: items added and the only pending invitation (Anna) is expired: completed'
);

reset role;
select results_eq(
  $$ select h.name, h.starter_list_completed_at from public.households h order by h.name $$,
  $$
    values
      ('Casa Bianchi', now()),
      ('Casa D''Angelo', null::timestamptz),
      ('Casa Neri', now() - interval '2 hours')
  $$,
  'each call changed only the household of its caller (B2 nothing, A nothing, B Casa Bianchi)'
);

-- A revoked invitation does not block either: A revokes Laura's, then completes.
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok(
  $$ update public.invitations set status = 'revoked' where member_id = 'a1000000-0000-4000-8000-000000000002' $$,
  'A revokes the invitation of Laura'
);
select is(public.complete_starter_list(), true, 'A: no pending invitation left, completed');

-- ---------------------------------------------------------------------------
-- current_member_welcome(): only who joined with an invitation, only for 24 hours,
-- only their own invitation.
-- ---------------------------------------------------------------------------
-- A invites Laura again; D accepts.
select lives_ok(
  $$ insert into public.invitations (household_id, member_id)
     values ('11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000002') $$,
  'A invites Laura again'
);
reset role;
do $$
begin
  perform set_config(
    'test.laura_token',
    (select i.token from public.invitations i
     where i.member_id = 'a1000000-0000-4000-8000-000000000002' and i.status = 'pending'),
    true
  );
end;
$$;
set local role authenticated;
set local request.jwt.claims to '{"sub":"dddddddd-0000-4000-8000-000000000001","role":"authenticated"}';

select lives_ok(
  $$ select public.accept_invitation(current_setting('test.laura_token')) $$,
  'D accepts the invitation of Laura'
);
select results_eq(
  $$ select * from public.current_member_welcome() $$,
  $$ values ('Marco'::text) $$,
  'D (Laura) gets one row: the welcome from Marco, nothing about Casa Neri'
);

set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select is_empty($$ select * from public.current_member_welcome() $$, 'A (creator of the household) gets no welcome');

set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select is_empty($$ select * from public.current_member_welcome() $$, 'B gets no welcome (no invitation of theirs)');

set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select is_empty(
  $$ select * from public.current_member_welcome() $$,
  'B2 (joined without an invitation) gets no welcome'
);

-- 23 hours after joining the welcome is still there; after 24 hours it is gone.
reset role;
update public.invitations set accepted_at = now() - interval '23 hours'
where member_id = 'a1000000-0000-4000-8000-000000000002' and status = 'accepted';
set local role authenticated;
set local request.jwt.claims to '{"sub":"dddddddd-0000-4000-8000-000000000001","role":"authenticated"}';
select results_eq(
  $$ select * from public.current_member_welcome() $$,
  $$ values ('Marco'::text) $$,
  'D 23 hours after joining: still the welcome'
);
reset role;
update public.invitations set accepted_at = now() - interval '24 hours'
where member_id = 'a1000000-0000-4000-8000-000000000002' and status = 'accepted';
set local role authenticated;
set local request.jwt.claims to '{"sub":"dddddddd-0000-4000-8000-000000000001","role":"authenticated"}';
select is_empty($$ select * from public.current_member_welcome() $$, 'D 24 hours after joining: no welcome');

-- The inviter leaves the household: the welcome stays, without a name.
set local request.jwt.claims to '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok(
  $$ delete from public.household_members where user_id = 'cccccccc-0000-4000-8000-000000000001' $$,
  'C leaves Casa Neri'
);
set local request.jwt.claims to '{"sub":"eeeeeeee-0000-4000-8000-000000000001","role":"authenticated"}';
select results_eq(
  $$ select * from public.current_member_welcome() $$,
  $$ values (null::text) $$,
  'E: the inviter has left, the welcome has no name'
);

select * from finish();
rollback;
