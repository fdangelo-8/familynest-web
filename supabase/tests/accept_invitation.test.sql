-- accept_invitation() (issue #9: CA-6, CA-25, CA-26, CA-27).
-- Laura (Casa D'Angelo) has a valid invitation; Anna (Casa Bianchi) an expired one.
-- B2 = Paolo (has a household), C = Chiara (no household), D = new user created here.
begin;
create extension if not exists pgtap with schema extensions;

select plan(22);

-- Tokens read as database owner and kept in transaction settings for the tests.
do $$
begin
  perform set_config('test.laura_token', i.token, true)
  from public.invitations i
  where i.member_id = 'a1000000-0000-4000-8000-000000000002';
  perform set_config('test.anna_expired_token', i.token, true)
  from public.invitations i
  where i.member_id = 'b1000000-0000-4000-8000-000000000004';
end;
$$;

-- User D, without household, for the "invalid invitation" cases.
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', 'dddddddd-0000-4000-8000-000000000001', 'authenticated',
        'authenticated', 'utente-d@example.com', '{"full_name":"Davide Test"}', now(), now());

-- ---------------------------------------------------------------------------
-- CA-6: anonymous callers.
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';

select throws_ok(
  $$ select public.accept_invitation(current_setting('test.laura_token')) $$,
  '42501',
  null,
  'CA-6: anon cannot call accept_invitation'
);

set local role authenticated;
set local request.jwt.claims to '{"role":"authenticated"}';

select throws_ok(
  $$ select public.accept_invitation(current_setting('test.laura_token')) $$,
  '42501',
  'not authenticated',
  'CA-6: a session without user cannot accept an invitation'
);

-- ---------------------------------------------------------------------------
-- CA-27: B2 already has a household.
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';

select throws_ok(
  $$ select public.accept_invitation(current_setting('test.laura_token')) $$,
  'P0001',
  'user already belongs to a household',
  'CA-27: B2 cannot accept the invitation of Laura'
);

reset role;

select results_eq(
  $$ select m.user_id, m.joined_at from public.household_members m where m.id = 'a1000000-0000-4000-8000-000000000002' $$,
  $$ values (null::uuid, null::timestamptz) $$,
  'CA-27: Laura still has no account'
);
select is(
  (select i.status::text from public.invitations i where i.member_id = 'a1000000-0000-4000-8000-000000000002'),
  'pending',
  'CA-27: the invitation of Laura is still pending'
);

-- ---------------------------------------------------------------------------
-- CA-25: C accepts the invitation of Laura.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}';

select is(
  public.accept_invitation(current_setting('test.laura_token')),
  '11111111-1111-4111-8111-111111111111'::uuid,
  'CA-25: C accepts and gets the id of Casa D''Angelo'
);
select results_eq(
  $$ select m.user_id, m.joined_at is not null, m.is_admin from public.household_members m
     where m.id = 'a1000000-0000-4000-8000-000000000002' $$,
  $$ values ('cccccccc-0000-4000-8000-000000000001'::uuid, true, false) $$,
  'CA-25: Laura is linked to C, joined, not admin'
);
select results_eq(
  $$ select h.name from public.households h $$,
  $$ values ('Casa D''Angelo') $$,
  'CA-25: C reads Casa D''Angelo'
);
select results_eq(
  $$ select m.name from public.household_members m order by m.created_at $$,
  $$ values ('Marco'), ('Laura'), ('Sofia'), ('Tommaso'), ('Biscotto') $$,
  'CA-25: C reads the 5 members'
);
select is_empty(
  $$ select 1 from public.invitations $$,
  'C (not admin) does not read the invitations'
);
select is(public.current_household_id(), '11111111-1111-4111-8111-111111111111'::uuid, 'CA-25: current household of C');

reset role;

select results_eq(
  $$ select i.status::text, i.accepted_at is not null from public.invitations i
     where i.member_id = 'a1000000-0000-4000-8000-000000000002' $$,
  $$ values ('accepted', true) $$,
  'CA-25: the invitation is accepted'
);

-- A revoked invitation that is not expired: B revokes the expired one, creates a new one, revokes it.
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';

select lives_ok(
  $$ update public.invitations set status = 'revoked' where member_id = 'b1000000-0000-4000-8000-000000000004' $$,
  'B revokes the expired invitation of Anna'
);
select lives_ok(
  $$ insert into public.invitations (household_id, member_id)
     values ('22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000004') $$,
  'B creates a new invitation for Anna'
);
select lives_ok(
  $$ select set_config('test.anna_revoked_token', i.token, true) from public.invitations i
     where i.member_id = 'b1000000-0000-4000-8000-000000000004' and i.status = 'pending' $$,
  'B (admin) reads the new token'
);
select lives_ok(
  $$ update public.invitations set status = 'revoked'
     where member_id = 'b1000000-0000-4000-8000-000000000004' and status = 'pending' $$,
  'B revokes the new invitation before it expires'
);

-- ---------------------------------------------------------------------------
-- CA-26: D (no household) always gets the same generic error.
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"dddddddd-0000-4000-8000-000000000001","role":"authenticated"}';

select throws_ok(
  $$ select public.accept_invitation('0000000000000000000000000000000000000000000000000000000000000000') $$,
  'P0001',
  'invalid invitation',
  'CA-26: unknown code'
);
select throws_ok(
  $$ select public.accept_invitation(current_setting('test.anna_expired_token')) $$,
  'P0001',
  'invalid invitation',
  'CA-26: expired invitation'
);
select throws_ok(
  $$ select public.accept_invitation(current_setting('test.anna_revoked_token')) $$,
  'P0001',
  'invalid invitation',
  'CA-26: revoked invitation'
);
select throws_ok(
  $$ select public.accept_invitation(current_setting('test.laura_token')) $$,
  'P0001',
  'invalid invitation',
  'CA-26: invitation already accepted'
);

reset role;

select is(
  (select count(*)::integer from public.household_members m where m.user_id = 'dddddddd-0000-4000-8000-000000000001'),
  0,
  'CA-26: D is still without household'
);
select results_eq(
  $$ select m.user_id, m.is_admin from public.household_members m
     where m.id in ('a1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000004')
     order by m.name $$,
  $$ values (null::uuid, false), ('cccccccc-0000-4000-8000-000000000001'::uuid, false) $$,
  'CA-26: Anna still without account, Laura still linked to C'
);

select * from finish();
rollback;
