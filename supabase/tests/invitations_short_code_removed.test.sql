-- Issue #438 (database part of #417): invitations without short code.
-- - no short_code column, default, check constraint or index, and no function that
--   still mentions it;
-- - the insert trigger takes no advisory lock any more (it serialised every invitation
--   of every household), and the guard trigger still refuses every change but revoking;
-- - with 4 digit codes at most 10,000 valid invitations could exist at the same time
--   (the 10,001st failed with 'no short code available'): now 10,010 pending
--   invitations live together.
-- Rows are created as database owner (auth.uid() is null: the administrator check of
-- the trigger is skipped, as for the seed). Everything is rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

-- ---------------------------------------------------------------------------
-- Schema.
-- ---------------------------------------------------------------------------
select hasnt_column('public', 'invitations', 'short_code', 'invitations has no short_code column');
select hasnt_index('public', 'invitations', 'invitations_pending_short_code_idx', 'the short code index is gone');
select is_empty(
  $$ select c.conname from pg_constraint c
     where c.conrelid = 'public.invitations'::regclass and c.conname = 'invitations_short_code_format' $$,
  'the short code format constraint is gone'
);
select is_empty(
  $$ select n.nspname || '.' || p.proname
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public', 'private') and p.prosrc ~ 'short_code' $$,
  'no function of public or private mentions short_code'
);
select ok(
  (select p.prosrc !~ 'pg_advisory' and p.prosrc !~ 'short' and p.prosecdef
          and p.proconfig @> array['search_path=""']
   from pg_proc p where p.oid = 'public.invitations_before_insert()'::regprocedure),
  'invitations_before_insert takes no advisory lock, has no short code logic, keeps security definer and an empty search_path'
);
select ok(
  (select p.prosrc !~ 'short' from pg_proc p where p.oid = 'public.invitations_guard_update()'::regprocedure),
  'invitations_guard_update no longer compares a short code'
);
select ok(
  not has_function_privilege('authenticated', 'public.invitations_before_insert()', 'execute')
  and not has_function_privilege('anon', 'public.invitations_before_insert()', 'execute')
  and not has_function_privilege('authenticated', 'public.invitations_guard_update()', 'execute')
  and not has_function_privilege('anon', 'public.invitations_guard_update()', 'execute'),
  'the API roles still cannot execute the two trigger functions'
);
select is_empty(
  $$ select i.indexrelid::regclass::text from pg_index i
     where i.indrelid = 'public.invitations'::regclass and i.indisunique
       and i.indexrelid not in ('public.invitations_pkey'::regclass,
                                'public.invitations_token_key'::regclass,
                                'public.invitations_one_pending_per_member_idx'::regclass) $$,
  'no other unique index on invitations: nothing global limits the pending invitations'
);

-- ---------------------------------------------------------------------------
-- Guard trigger: an administrator still can only revoke (A = Marco, Laura's invitation).
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';

select lives_ok(
  $$ update public.invitations set status = 'revoked' where id = 'a2000000-0000-4000-8000-000000000001' $$,
  'A revokes the invitation of Laura'
);
select throws_ok(
  $$ update public.invitations set status = 'pending' where id = 'a2000000-0000-4000-8000-000000000001' $$,
  '42501',
  'only a pending invitation can be revoked',
  'A cannot bring a revoked invitation back to pending'
);

reset role;
-- No user any more: auth.uid() is null again, as for the seed.
set local request.jwt.claims to '';

-- ---------------------------------------------------------------------------
-- More than 10,000 pending invitations at the same time.
-- 1,001 throwaway households, each with 10 adults without account (the member limit is
-- 10, one per colour), each adult with a pending invitation.
-- ---------------------------------------------------------------------------
insert into public.households (id, name, household_type)
select ('f4380000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid, 'Casa ' || g, 'roommates'
from generate_series(1, 1001) g;

insert into public.household_members (household_id, kind, name, color)
select h.id, 'adult', 'Adulto ' || c.n, c.color
from public.households h
cross join unnest(enum_range(null::public.member_color)) with ordinality as c (color, n)
where h.id::text like 'f4380000-%';

select is(
  (select count(*)::integer from public.household_members m where m.household_id::text like 'f4380000-%'),
  10010,
  '10,010 adults without account are ready to be invited'
);

select lives_ok(
  $$ insert into public.invitations (household_id, member_id)
     select m.household_id, m.id from public.household_members m
     where m.household_id::text like 'f4380000-%' $$,
  '10,010 invitations are created in one go'
);
select is(
  (select count(*)::integer from public.invitations i
   where i.household_id::text like 'f4380000-%' and i.status = 'pending' and i.expires_at > now()),
  10010,
  'all 10,010 invitations are pending and valid at the same time'
);
select is(
  (select count(distinct i.token)::integer from public.invitations i
   where i.household_id::text like 'f4380000-%' and i.token ~ '^[0-9a-f]{64}$'),
  10010,
  'each of them has its own 64 character token'
);

select * from finish();
rollback;
