-- accept_invitation_with_color() (issue #107, request R2 of page #16): join the household
-- with the invitation and the chosen colour, in one transaction.
-- Seed: A = Marco (Casa D'Angelo, admin; Laura glicine has a valid invitation),
-- B = Giulia (Casa Bianchi, admin; Anna pomodoro has an expired pending invitation),
-- B2 = Paolo (Casa Bianchi), C = Chiara (no household).
-- Created here, as database owner: D and E (no household), F, a revoked and an accepted
-- invitation of Anna, and Ettore (Casa Bianchi), whose invitation is still pending
-- while he is already linked to the account F.
-- Every check runs inside one transaction, so now() is the same everywhere.
begin;
create extension if not exists pgtap with schema extensions;

select plan(52);

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'dddddddd-0000-4000-8000-000000000001', 'authenticated',
   'authenticated', 'utente-d@example.com', '{"full_name":"Davide Test"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'eeeeeeee-0000-4000-8000-000000000001', 'authenticated',
   'authenticated', 'utente-e@example.com', '{"full_name":"Elena Test"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'ffffffff-0000-4000-8000-000000000001', 'authenticated',
   'authenticated', 'utente-f@example.com', '{"full_name":"Fabio Test"}', now(), now());

insert into public.household_members (id, household_id, kind, name, color, created_at)
values ('b1000000-0000-4000-8000-000000000005', '22222222-2222-4222-8222-222222222222', 'adult', 'Ettore', 'glicine',
        now() - interval '10 days');

insert into public.invitations (id, household_id, member_id, invited_by_member_id, status, accepted_at, expires_at)
values
  ('b2000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222',
   'b1000000-0000-4000-8000-000000000004', 'b1000000-0000-4000-8000-000000000001', 'revoked', null,
   now() + interval '5 days'),
  ('b2000000-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222222',
   'b1000000-0000-4000-8000-000000000004', 'b1000000-0000-4000-8000-000000000001', 'accepted', now(),
   now() + interval '5 days'),
  ('b2000000-0000-4000-8000-000000000004', '22222222-2222-4222-8222-222222222222',
   'b1000000-0000-4000-8000-000000000005', 'b1000000-0000-4000-8000-000000000001', 'pending', null,
   now() + interval '5 days');

-- Ettore gets the account F while his invitation is still pending (not possible from the app).
update public.household_members
set user_id = 'ffffffff-0000-4000-8000-000000000001', joined_at = now()
where id = 'b1000000-0000-4000-8000-000000000005';

do $$
begin
  perform set_config('test.laura', (select i.token from public.invitations i where i.id = 'a2000000-0000-4000-8000-000000000001'), true);
  perform set_config('test.anna_expired', (select i.token from public.invitations i where i.id = 'b2000000-0000-4000-8000-000000000001'), true);
  perform set_config('test.anna_revoked', (select i.token from public.invitations i where i.id = 'b2000000-0000-4000-8000-000000000002'), true);
  perform set_config('test.anna_accepted', (select i.token from public.invitations i where i.id = 'b2000000-0000-4000-8000-000000000003'), true);
  perform set_config('test.ettore_linked', (select i.token from public.invitations i where i.id = 'b2000000-0000-4000-8000-000000000004'), true);
end;
$$;

select has_function(
  'public', 'accept_invitation_with_color', array['text', 'member_color'],
  'accept_invitation_with_color(text, member_color) exists'
);
select is(
  pg_get_function_result('public.accept_invitation_with_color(text, public.member_color)'::regprocedure),
  'uuid',
  'it returns only the id of the household'
);

-- ---------------------------------------------------------------------------
-- No session.
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';

select throws_ok(
  $$ select public.accept_invitation_with_color(current_setting('test.laura'), 'peonia') $$,
  '42501',
  null,
  'anon cannot join with an invitation'
);

set local role authenticated;
set local request.jwt.claims to '{"role":"authenticated"}';

select throws_ok(
  $$ select public.accept_invitation_with_color(current_setting('test.laura'), 'peonia') $$,
  '42501',
  'not authenticated',
  'a session without user cannot join'
);

-- ---------------------------------------------------------------------------
-- B2 already has a household.
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';

select throws_ok(
  $$ select public.accept_invitation_with_color(current_setting('test.laura'), 'peonia') $$,
  'P0001',
  'user already belongs to a household',
  'B2 (in Casa Bianchi) cannot join Casa D''Angelo'
);
select throws_ok(
  $$ select public.accept_invitation_with_color(current_setting('test.laura'), 'glicine') $$,
  'P0001',
  'user already belongs to a household',
  'B2 cannot join Casa D''Angelo, not even with the colour of Laura'
);

-- ---------------------------------------------------------------------------
-- C (no household): missing colour, unusable invitations, taken colours.
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}';

select throws_ok(
  $$ select public.accept_invitation_with_color(current_setting('test.laura'), null) $$,
  '22023',
  'color is required',
  'C: a colour is required'
);

select throws_ok($$ select public.accept_invitation_with_color(repeat('0123456789abcdef', 4), 'peonia') $$,
  'P0001', 'invalid invitation', 'C: unknown token');
select throws_ok($$ select public.accept_invitation_with_color('abc', 'peonia') $$,
  'P0001', 'invalid invitation', 'C: malformed token');
select throws_ok($$ select public.accept_invitation_with_color(null, 'peonia') $$,
  'P0001', 'invalid invitation', 'C: null token');
select throws_ok($$ select public.accept_invitation_with_color('4821', 'peonia') $$,
  'P0001', 'invalid invitation', 'C: the short code is not a token');
select throws_ok($$ select public.accept_invitation_with_color(upper(current_setting('test.laura')), 'peonia') $$,
  'P0001', 'invalid invitation', 'C: token in upper case');
select throws_ok($$ select public.accept_invitation_with_color(left(current_setting('test.laura'), 32), 'peonia') $$,
  'P0001', 'invalid invitation', 'C: first half of the token');
select throws_ok($$ select public.accept_invitation_with_color(repeat('%', 64), 'peonia') $$,
  'P0001', 'invalid invitation', 'C: wildcards are not patterns');
select throws_ok($$ select public.accept_invitation_with_color(current_setting('test.anna_expired'), 'peonia') $$,
  'P0001', 'invalid invitation', 'C: expired invitation');
select throws_ok($$ select public.accept_invitation_with_color(current_setting('test.anna_revoked'), 'peonia') $$,
  'P0001', 'invalid invitation', 'C: revoked invitation');
select throws_ok($$ select public.accept_invitation_with_color(current_setting('test.anna_accepted'), 'peonia') $$,
  'P0001', 'invalid invitation', 'C: accepted invitation');
select throws_ok($$ select public.accept_invitation_with_color(current_setting('test.ettore_linked'), 'peonia') $$,
  'P0001', 'invalid invitation', 'C: member already linked to an account');
-- A colour taken in that household is never revealed by an invalid invitation.
select throws_ok($$ select public.accept_invitation_with_color(current_setting('test.anna_expired'), 'cobalto') $$,
  'P0001', 'invalid invitation', 'C: expired invitation with a colour taken there: still only «invalid invitation»');

select throws_ok($$ select public.accept_invitation_with_color(current_setting('test.laura'), 'salvia') $$,
  '23505', 'color already taken', 'C: the colour of Sofia is taken');
select throws_ok($$ select public.accept_invitation_with_color(current_setting('test.laura'), 'pomodoro') $$,
  '23505', 'color already taken', 'C: the colour of Marco (the inviter) is taken');

-- Through the Data API only POST is accepted: a GET would put the token in the URL.
set local request.method to 'GET';
select throws_ok($$ select public.accept_invitation_with_color(current_setting('test.laura'), 'peonia') $$,
  'P0001', 'use POST', 'C: a GET call of the Data API is refused before anything else');
set local request.method to 'POST';

-- Nothing changed.
select is(public.current_household_id(), null, 'C still has no household after the errors');

reset role;

select results_eq(
  $$ select m.user_id, m.joined_at, m.is_admin, m.color::text from public.household_members m
     where m.id = 'a1000000-0000-4000-8000-000000000002' $$,
  $$ values (null::uuid, null::timestamptz, false, 'glicine') $$,
  'after the errors Laura is still without account and glicine'
);
select results_eq(
  $$ select i.status::text, i.accepted_at from public.invitations i where i.id = 'a2000000-0000-4000-8000-000000000001' $$,
  $$ values ('pending', null::timestamptz) $$,
  'after the errors the invitation of Laura is still pending'
);
select results_eq(
  $$ select m.user_id, m.color::text from public.household_members m where m.id = 'b1000000-0000-4000-8000-000000000004' $$,
  $$ values (null::uuid, 'pomodoro') $$,
  'after the errors Anna is still without account and pomodoro'
);

-- ---------------------------------------------------------------------------
-- C joins Casa D'Angelo as Laura with peonia.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}';

select is(
  public.accept_invitation_with_color(current_setting('test.laura'), 'peonia'),
  '11111111-1111-4111-8111-111111111111'::uuid,
  'C joins and gets the id of Casa D''Angelo'
);
select is(public.current_household_id(), '11111111-1111-4111-8111-111111111111'::uuid, 'current household of C');
select results_eq(
  $$ select m.name, m.color::text from public.household_members m order by m.created_at $$,
  $$ values ('Marco', 'pomodoro'), ('Laura', 'peonia'), ('Sofia', 'salvia'), ('Tommaso', 'cobalto'),
            ('Biscotto', 'zafferano') $$,
  'C reads the 5 members of Casa D''Angelo, Laura now peonia, no member of other households'
);
select results_eq(
  $$ select h.name from public.households h $$,
  $$ values ('Casa D''Angelo') $$,
  'C reads only Casa D''Angelo'
);
select results_eq(
  $$ select w.inviter_name from public.current_member_welcome() w $$,
  $$ values ('Marco') $$,
  'the welcome of Oggi greets C on behalf of Marco'
);
select is_empty($$ select 1 from public.invitations $$, 'C (not admin) does not read the invitations');
select throws_ok(
  $$ select public.accept_invitation_with_color(current_setting('test.laura'), 'peonia') $$,
  'P0001',
  'user already belongs to a household',
  'C cannot join a second time'
);

reset role;

select results_eq(
  $$ select m.user_id, m.joined_at = now(), m.is_admin, m.color::text from public.household_members m
     where m.id = 'a1000000-0000-4000-8000-000000000002' $$,
  $$ values ('cccccccc-0000-4000-8000-000000000001'::uuid, true, false, 'peonia') $$,
  'Laura is linked to C, joined now, not administrator, peonia'
);
select results_eq(
  $$ select i.status::text, i.accepted_at = now() from public.invitations i
     where i.id = 'a2000000-0000-4000-8000-000000000001' $$,
  $$ values ('accepted', true) $$,
  'the invitation of Laura is accepted now'
);
select is(
  (select count(*)::integer from public.household_members m where m.household_id = '11111111-1111-4111-8111-111111111111'),
  5,
  'Casa D''Angelo still has 5 members: no member added'
);
select results_eq(
  $$ select m.name, m.color::text, m.user_id is not null from public.household_members m
     where m.household_id = '11111111-1111-4111-8111-111111111111' and m.id <> 'a1000000-0000-4000-8000-000000000002'
     order by m.created_at $$,
  $$ values ('Marco', 'pomodoro', true), ('Sofia', 'salvia', false), ('Tommaso', 'cobalto', false),
            ('Biscotto', 'zafferano', false) $$,
  'the other members of Casa D''Angelo are unchanged'
);

-- D cannot reuse the accepted invitation.
set local role authenticated;
set local request.jwt.claims to '{"sub":"dddddddd-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select public.accept_invitation_with_color(current_setting('test.laura'), 'lampone') $$,
  'P0001',
  'invalid invitation',
  'D: the accepted invitation of Laura cannot be used again'
);
select is(
  (select p.status::text from public.invitation_preview(current_setting('test.laura')) p),
  'invalid',
  'D: the preview of the accepted invitation is invalid'
);

-- ---------------------------------------------------------------------------
-- Casa Bianchi full (10 members, all 10 colours used): joining adds nobody, so the member
-- limit never applies; only the colour already given to Anna is free for her.
-- ---------------------------------------------------------------------------
reset role;
set local request.jwt.claims to '';

update public.invitations set expires_at = now() + interval '1 day' where id = 'b2000000-0000-4000-8000-000000000001';
insert into public.household_members (household_id, kind, name, color)
values
  ('22222222-2222-4222-8222-222222222222', 'child', 'Bambino Uno', 'lampone'),
  ('22222222-2222-4222-8222-222222222222', 'child', 'Bambino Due', 'ceruleo'),
  ('22222222-2222-4222-8222-222222222222', 'pet', 'Animale Uno', 'peonia'),
  ('22222222-2222-4222-8222-222222222222', 'pet', 'Animale Due', 'basilico');
-- Ettore (glicine) is the ninth member; the tenth:
insert into public.household_members (household_id, kind, name, color)
values ('22222222-2222-4222-8222-222222222222', 'pet', 'Animale Tre', 'cannella');

select is(
  (select count(*)::integer from public.household_members m where m.household_id = '22222222-2222-4222-8222-222222222222'),
  10,
  'Casa Bianchi has 10 members'
);

set local role authenticated;
set local request.jwt.claims to '{"sub":"dddddddd-0000-4000-8000-000000000001","role":"authenticated"}';

select throws_ok(
  $$ select public.accept_invitation_with_color(current_setting('test.anna_expired'), 'glicine') $$,
  '23505',
  'color already taken',
  'D: glicine is taken by Ettore'
);
select throws_ok(
  $$ select public.accept_invitation_with_color(current_setting('test.anna_expired'), 'cannella') $$,
  '23505',
  'color already taken',
  'D: cannella is taken by a pet'
);
select is(
  public.accept_invitation_with_color(current_setting('test.anna_expired'), 'pomodoro'),
  '22222222-2222-4222-8222-222222222222'::uuid,
  'D joins the full Casa Bianchi as Anna, keeping pomodoro'
);
select results_eq(
  $$ select h.name from public.households h $$,
  $$ values ('Casa Bianchi') $$,
  'D reads only Casa Bianchi'
);
select is_empty(
  $$ select m.name from public.household_members m where m.household_id <> '22222222-2222-4222-8222-222222222222' $$,
  'D reads no member of other households'
);
select results_eq(
  $$ select w.inviter_name from public.current_member_welcome() w $$,
  $$ values ('Giulia') $$,
  'the welcome greets D on behalf of Giulia'
);

reset role;

select results_eq(
  $$ select m.user_id, m.is_admin, m.color::text from public.household_members m
     where m.id = 'b1000000-0000-4000-8000-000000000004' $$,
  $$ values ('dddddddd-0000-4000-8000-000000000001'::uuid, false, 'pomodoro') $$,
  'Anna is linked to D, not administrator, pomodoro'
);
select is(
  (select count(*)::integer from public.household_members m where m.household_id = '22222222-2222-4222-8222-222222222222'),
  10,
  'Casa Bianchi still has 10 members'
);
select results_eq(
  $$ select i.id::text, i.status::text from public.invitations i
     where i.member_id = 'b1000000-0000-4000-8000-000000000004' order by i.id $$,
  $$ values ('b2000000-0000-4000-8000-000000000001', 'accepted'), ('b2000000-0000-4000-8000-000000000002', 'revoked'),
            ('b2000000-0000-4000-8000-000000000003', 'accepted') $$,
  'only the used invitation of Anna changed'
);

-- The household of C is untouched by D.
select results_eq(
  $$ select m.user_id from public.household_members m where m.id = 'a1000000-0000-4000-8000-000000000002' $$,
  $$ values ('cccccccc-0000-4000-8000-000000000001'::uuid) $$,
  'Laura is still linked to C'
);

-- E (no household) has no valid invitation left to use.
set local role authenticated;
set local request.jwt.claims to '{"sub":"eeeeeeee-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select public.accept_invitation_with_color(current_setting('test.anna_expired'), 'pomodoro') $$,
  'P0001',
  'invalid invitation',
  'E: the invitation used by D cannot be used again'
);
select is(public.current_household_id(), null, 'E still has no household');

select * from finish();
rollback;
