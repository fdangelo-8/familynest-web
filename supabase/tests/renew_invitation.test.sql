-- renew_invitation() (issue #617, R2: CA-9…CA-14, CA-34): a new invitation of 7 days when
-- there is no valid one, only who organises, in one transaction.
-- Seed: A = Marco (Casa D'Angelo, organises; Laura has a valid invitation a2…01),
-- B = Giulia (Casa Bianchi, organises; Anna has an expired pending invitation b2…01),
-- B2 = Paolo (Casa Bianchi, does not organise, has an account), Leo (child of Casa Bianchi),
-- C = Chiara (no household).
-- Created here, as database owner: Zeno (adult of Casa Bianchi without account and without
-- invitation).
-- Every check runs inside one transaction, so now() is the same everywhere.
begin;
create extension if not exists pgtap with schema extensions;

select plan(36);

insert into public.household_members (id, household_id, kind, name, color)
values ('b1000000-0000-4000-8000-000000000617', '22222222-2222-4222-8222-222222222222', 'adult', 'Zeno', 'peonia');

do $$
begin
  perform set_config('test.anna_old_token',
    (select i.token from public.invitations i where i.id = 'b2000000-0000-4000-8000-000000000001'), true);
  perform set_config('test.laura_before',
    (select row(i.id, i.token, i.expires_at, i.updated_at, i.status)::text
     from public.invitations i where i.id = 'a2000000-0000-4000-8000-000000000001'), true);
  perform set_config('test.b_invitations_before',
    (select coalesce(jsonb_agg(to_jsonb(i) order by i.id), '[]')::text
     from public.invitations i where i.household_id = '22222222-2222-4222-8222-222222222222'), true);
end;
$$;

-- ---------------------------------------------------------------------------
-- The function and its privileges (CA-34).
-- ---------------------------------------------------------------------------
select has_function('public', 'renew_invitation', array['uuid'], 'renew_invitation(uuid) exists');
select is(
  pg_get_function_result('public.renew_invitation(uuid)'::regprocedure),
  'void',
  'it returns nothing'
);
select ok(
  (select p.prosecdef and p.proconfig @> array['search_path=""']
   from pg_proc p where p.oid = 'public.renew_invitation(uuid)'::regprocedure),
  'renew_invitation is security definer with an empty search_path'
);
select ok(
  has_function_privilege('authenticated', 'public.renew_invitation(uuid)', 'execute')
    and not has_function_privilege('anon', 'public.renew_invitation(uuid)', 'execute')
    and not has_function_privilege('service_role', 'public.renew_invitation(uuid)', 'execute')
    and not has_function_privilege('public', 'public.renew_invitation(uuid)', 'execute'),
  'CA-34: only authenticated can execute renew_invitation'
);

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok(
  $$ select public.renew_invitation('b1000000-0000-4000-8000-000000000004') $$,
  '42501', null, 'anon cannot renew'
);

-- ---------------------------------------------------------------------------
-- Only POST (CA-34).
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
set local request.method to 'GET';
select throws_ok($$ select public.renew_invitation('b1000000-0000-4000-8000-000000000004') $$, 'P0001', 'use POST', 'CA-34: GET is refused');
set local request.method to 'PUT';
select throws_ok($$ select public.renew_invitation('b1000000-0000-4000-8000-000000000004') $$, 'P0001', 'use POST', 'CA-34: PUT is refused');
set local request.method to 'POST';

-- ---------------------------------------------------------------------------
-- CA-12: who does not organise, another household, an unknown id.
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok(
  $$ select public.renew_invitation('b1000000-0000-4000-8000-000000000004') $$,
  '42501', 'permission denied for function renew_invitation', 'CA-12: Paolo (does not organise) cannot renew Anna'
);
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select public.renew_invitation('b1000000-0000-4000-8000-000000000004') $$,
  '42501', 'permission denied for function renew_invitation', 'CA-12: Marco cannot renew Anna (another household)'
);
select throws_ok(
  $$ select public.renew_invitation('b1000000-0000-4000-8000-0000000fffff') $$,
  '42501', 'permission denied for function renew_invitation', 'CA-12: an unknown id gives the same error'
);
select throws_ok(
  $$ select public.renew_invitation(null) $$,
  '42501', 'permission denied for function renew_invitation', 'a null id gives the same error'
);
set local request.jwt.claims to '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select public.renew_invitation('b1000000-0000-4000-8000-000000000004') $$,
  '42501', 'permission denied for function renew_invitation', 'Chiara (no household) cannot renew'
);

-- ---------------------------------------------------------------------------
-- CA-13: an adult with an account, a child.
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select public.renew_invitation('b1000000-0000-4000-8000-000000000002') $$,
  '22023', null, 'CA-13: Paolo has an account: refused'
);
select throws_ok(
  $$ select public.renew_invitation('b1000000-0000-4000-8000-000000000003') $$,
  '22023', null, 'CA-13: Leo is a child: refused'
);

reset role;
select is(
  (select coalesce(jsonb_agg(to_jsonb(i) order by i.id), '[]')::text
   from public.invitations i where i.household_id = '22222222-2222-4222-8222-222222222222'),
  current_setting('test.b_invitations_before'),
  'CA-12, CA-13, CA-34: the invitations of Casa Bianchi did not change'
);

-- ---------------------------------------------------------------------------
-- CA-10: Laura's invitation is still valid: nothing changes.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok(
  $$ select public.renew_invitation('a1000000-0000-4000-8000-000000000002') $$,
  'CA-10: Marco renews Laura'
);
reset role;
select is(
  (select row(i.id, i.token, i.expires_at, i.updated_at, i.status)::text
   from public.invitations i where i.id = 'a2000000-0000-4000-8000-000000000001'),
  current_setting('test.laura_before'),
  'CA-10: id, token, expiry and updated_at of the invitation of Laura did not change'
);
select is(
  (select count(*)::integer from public.invitations i where i.member_id = 'a1000000-0000-4000-8000-000000000002'),
  1,
  'CA-10: no new invitation for Laura'
);

-- ---------------------------------------------------------------------------
-- CA-9: Anna's invitation has expired: revoked, and a new one of 7 days.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok(
  $$ select public.renew_invitation('b1000000-0000-4000-8000-000000000004') $$,
  'CA-9: Giulia renews Anna'
);
reset role;
select is(
  (select i.status::text from public.invitations i where i.id = 'b2000000-0000-4000-8000-000000000001'),
  'revoked',
  'CA-9: the old invitation is revoked'
);
select results_eq(
  $$ select count(*)::integer, bool_and(i.token <> current_setting('test.anna_old_token')),
            bool_and(i.expires_at = now() + interval '7 days'),
            bool_and(i.invited_by_member_id = 'b1000000-0000-4000-8000-000000000001'),
            bool_and(i.household_id = '22222222-2222-4222-8222-222222222222')
     from public.invitations i
     where i.member_id = 'b1000000-0000-4000-8000-000000000004' and i.status = 'pending' $$,
  $$ values (1, true, true, true, true) $$,
  'CA-9: one pending invitation for Anna, with a new token, 7 days, by Giulia'
);
do $$
begin
  perform set_config('test.anna_new_token',
    (select i.token from public.invitations i
     where i.member_id = 'b1000000-0000-4000-8000-000000000004' and i.status = 'pending'), true);
end;
$$;

-- A second call while the new invitation is valid changes nothing.
set local role authenticated;
select lives_ok(
  $$ select public.renew_invitation('b1000000-0000-4000-8000-000000000004') $$,
  'Giulia renews Anna again'
);
reset role;
select is(
  (select i.token from public.invitations i
   where i.member_id = 'b1000000-0000-4000-8000-000000000004' and i.status = 'pending'),
  current_setting('test.anna_new_token'),
  'the second call keeps the same link'
);
select is(
  (select count(*)::integer from public.invitations i where i.member_id = 'b1000000-0000-4000-8000-000000000004'),
  2,
  'the second call creates nothing'
);

-- ---------------------------------------------------------------------------
-- CA-11: Zeno has no invitation: one is created.
-- ---------------------------------------------------------------------------
set local role authenticated;
select lives_ok(
  $$ select public.renew_invitation('b1000000-0000-4000-8000-000000000617') $$,
  'CA-11: Giulia sends the invitation to Zeno'
);
reset role;
select results_eq(
  $$ select count(*)::integer, bool_and(i.status = 'pending'), bool_and(i.expires_at = now() + interval '7 days'),
            bool_and(i.invited_by_member_id = 'b1000000-0000-4000-8000-000000000001')
     from public.invitations i where i.member_id = 'b1000000-0000-4000-8000-000000000617' $$,
  $$ values (1, true, true, true) $$,
  'CA-11: Zeno has one pending invitation of 7 days'
);

-- Isolation: Paolo and Marco do not read the new invitations.
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select is_empty(
  $$ select i.token from public.invitations i where i.member_id in ('b1000000-0000-4000-8000-000000000004',
                                                                   'b1000000-0000-4000-8000-000000000617') $$,
  'Paolo reads no token of Anna or Zeno'
);
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select is_empty(
  $$ select i.token from public.invitations i where i.household_id = '22222222-2222-4222-8222-222222222222' $$,
  'Marco reads no invitation of Casa Bianchi'
);

-- ---------------------------------------------------------------------------
-- CA-14: the old link no longer works, the new one does.
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select public.accept_invitation_with_color(current_setting('test.anna_old_token'), 'pomodoro') $$,
  'P0001', 'invalid invitation', 'CA-14: the old token of Anna is not valid'
);
select results_eq(
  $$ select public.accept_invitation_with_color(current_setting('test.anna_new_token'), 'pomodoro') $$,
  $$ values ('22222222-2222-4222-8222-222222222222'::uuid) $$,
  'CA-14: with the new token Chiara enters Casa Bianchi'
);
reset role;
select results_eq(
  $$ select m.user_id, m.is_admin from public.household_members m where m.id = 'b1000000-0000-4000-8000-000000000004' $$,
  $$ values ('cccccccc-0000-4000-8000-000000000001'::uuid, false) $$,
  'CA-14: Chiara is Anna now, without role (Casa Bianchi is not a couple)'
);
select is(
  (select i.status::text from public.invitations i
   where i.member_id = 'b1000000-0000-4000-8000-000000000004' and i.token = current_setting('test.anna_new_token')),
  'accepted',
  'CA-14: the new invitation is accepted'
);

-- Now Anna has an account: renewing her is refused, nothing is written.
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select public.renew_invitation('b1000000-0000-4000-8000-000000000004') $$,
  '22023', null, 'CA-13: an adult who entered cannot be invited again'
);
reset role;
select is(
  (select count(*)::integer from public.invitations i where i.member_id = 'b1000000-0000-4000-8000-000000000004'),
  2,
  'CA-13: no invitation was written'
);

-- An accepted or revoked invitation is never touched: a pending one alone is replaced.
select is(
  (select count(*)::integer from public.invitations i
   where i.member_id = 'b1000000-0000-4000-8000-000000000004' and i.status = 'revoked'),
  1,
  'the revoked invitation of Anna is still there, unchanged'
);
select ok(
  (select i.updated_at = now() from public.invitations i where i.id = 'b2000000-0000-4000-8000-000000000001'),
  'the old invitation was revoked in this transaction'
);

select * from finish();
rollback;
