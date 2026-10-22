-- invitations: admins only, isolation, generated secrets
-- (issue #9: CA-10, CA-11, CA-12, CA-13, CA-23, CA-24).
-- A = Marco (admin of Casa D'Angelo), B = Giulia (admin of Casa Bianchi), C = Chiara (no household).
begin;
create extension if not exists pgtap with schema extensions;

select plan(28);

-- ---------------------------------------------------------------------------
-- A (admin) sees the invitation of Laura; secrets are never writable.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';

select results_eq(
  $$ select i.short_code, i.status::text from public.invitations i $$,
  $$ values ('4821', 'pending') $$,
  'A (admin) reads the pending invitation of Laura'
);

-- CA-24: one pending invitation per member, only adults without account.
select throws_ok(
  $$ insert into public.invitations (household_id, member_id)
     values ('11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000002') $$,
  '23505',
  null,
  'CA-24: a second invitation for Laura is refused'
);
select throws_ok(
  $$ insert into public.invitations (household_id, member_id)
     values ('11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000003') $$,
  '23514',
  null,
  'CA-24: Sofia (child) cannot be invited'
);
select throws_ok(
  $$ insert into public.invitations (household_id, member_id)
     values ('11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001') $$,
  '23514',
  null,
  'CA-24: Marco (adult with account) cannot be invited'
);
select throws_ok(
  $$ insert into public.invitations (household_id, member_id)
     values ('11111111-1111-4111-8111-111111111111', 'b1000000-0000-4000-8000-000000000004') $$,
  '23514',
  null,
  'a member of another household cannot be invited'
);
select throws_ok(
  $$ insert into public.invitations (household_id, member_id, token, short_code)
     values ('11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000002', 'weak', '0000') $$,
  '42501',
  null,
  'token and short code cannot be chosen by the app'
);
select throws_ok(
  $$ insert into public.invitations (household_id, member_id, message)
     values ('11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000002', repeat('x', 281)) $$,
  '23514',
  null,
  'a message longer than 280 characters is refused'
);
select throws_ok(
  $$ update public.invitations set expires_at = now() + interval '1 year' $$,
  '42501',
  null,
  'the expiry cannot be changed'
);

-- ---------------------------------------------------------------------------
-- B cannot see or touch the invitations of Casa D'Angelo (CA-10, CA-11).
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';

select is_empty(
  $$ select 1 from public.invitations i where i.household_id = '11111111-1111-4111-8111-111111111111' $$,
  'CA-10: B reads 0 invitations of Casa D''Angelo'
);
select throws_ok(
  $$ insert into public.invitations (household_id, member_id)
     values ('11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000002') $$,
  '42501',
  null,
  'CA-11: B cannot create an invitation in Casa D''Angelo'
);
select is_empty(
  $$ update public.invitations set status = 'revoked'
     where household_id = '11111111-1111-4111-8111-111111111111' returning id $$,
  'CA-11: B revokes 0 invitations of Casa D''Angelo'
);
select is_empty(
  $$ delete from public.invitations where household_id = '11111111-1111-4111-8111-111111111111' returning id $$,
  'CA-11: B deletes 0 invitations of Casa D''Angelo'
);

-- CA-23: B revokes the expired invitation of Anna and creates a new one.
select lives_ok(
  $$ update public.invitations set status = 'revoked'
     where member_id = 'b1000000-0000-4000-8000-000000000004' and status = 'pending' $$,
  'B revokes the expired invitation of Anna'
);
select lives_ok(
  $$ insert into public.invitations (household_id, member_id)
     values ('22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000004') $$,
  'CA-23: B creates an invitation for Anna without short_code, token or expiry'
);
select ok(
  (select i.token ~ '^[0-9a-f]{64}$' from public.invitations i
   where i.member_id = 'b1000000-0000-4000-8000-000000000004' and i.status = 'pending'),
  'CA-23: the link secret has 256 random bits (64 hex characters)'
);
select ok(
  (select i.short_code ~ '^[0-9]{4}$' and i.short_code <> '4821' from public.invitations i
   where i.member_id = 'b1000000-0000-4000-8000-000000000004' and i.status = 'pending'),
  'CA-23: the short code has 4 digits and differs from the valid code 4821'
);
select ok(
  (select i.expires_at = i.created_at + interval '7 days' from public.invitations i
   where i.member_id = 'b1000000-0000-4000-8000-000000000004' and i.status = 'pending'),
  'CA-23: the invitation expires exactly 7 days after creation'
);
select results_eq(
  $$ select i.status::text, i.accepted_at, i.message from public.invitations i
     where i.member_id = 'b1000000-0000-4000-8000-000000000004' and i.status = 'pending' $$,
  $$ values ('pending', null::timestamptz, null::text) $$,
  'CA-23: the new invitation is pending'
);

-- ---------------------------------------------------------------------------
-- C without household (CA-13) and anonymous users (CA-12).
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}';

select is_empty($$ select 1 from public.invitations $$, 'CA-13: C reads 0 invitations');

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';

select is_empty($$ select 1 from public.invitations $$, 'CA-12: anon reads 0 invitations');
select throws_ok(
  $$ insert into public.invitations (household_id, member_id)
     values ('11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000002') $$,
  '42501',
  null,
  'CA-12: anon cannot create an invitation'
);

-- ---------------------------------------------------------------------------
-- Checks as database owner.
-- ---------------------------------------------------------------------------
reset role;

select results_eq(
  $$ select i.short_code, i.status::text, i.expires_at > now() from public.invitations i
     where i.household_id = '11111111-1111-4111-8111-111111111111' $$,
  $$ values ('4821', 'pending', true) $$,
  'CA-11: the invitation of Laura is unchanged'
);
select is(
  (select count(distinct i.token)::integer from public.invitations i),
  3,
  'every invitation has its own token'
);
select is(
  (select count(*)::integer from public.invitations i
   where i.short_code = '7305' and i.status = 'revoked'),
  1,
  'the expired short code 7305 stays on the revoked invitation'
);
select ok(
  (select i.invited_by_member_id = 'b1000000-0000-4000-8000-000000000001' from public.invitations i
   where i.member_id = 'b1000000-0000-4000-8000-000000000004' and i.status = 'pending'),
  'the inviter is recorded automatically'
);

-- The short code has a server default, so the app never sends it (generated types:
-- optional in Insert). A code already used by a valid invitation is redrawn.
select col_has_default('public', 'invitations', 'short_code', 'short_code has a server default');
update public.invitations set status = 'revoked'
where member_id = 'b1000000-0000-4000-8000-000000000004' and status = 'pending';
select lives_ok(
  $$ insert into public.invitations (household_id, member_id, short_code)
     values ('22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000004', '4821') $$,
  'an invitation with a code already in use is still created'
);
select ok(
  (select i.short_code ~ '^[0-9]{4}$' and i.short_code <> '4821' from public.invitations i
   where i.member_id = 'b1000000-0000-4000-8000-000000000004' and i.status = 'pending'),
  'the code in use (4821, Laura) is replaced by another 4 digit code'
);

select * from finish();
rollback;
