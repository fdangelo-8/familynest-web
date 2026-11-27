-- invite_adult() (issue #617, R1: CA-1…CA-8, CA-33, CA-34): the adult and the invitation in
-- one step, only who organises, the household of the session.
-- Seed: A = Marco (Casa D'Angelo, organises; Laura is invited with a valid invitation),
-- B = Giulia (Casa Bianchi, organises), B2 = Paolo (Casa Bianchi, does not organise, salvia),
-- C = Chiara (no household). Casa Bianchi has 4 members (Giulia, Paolo, Leo, Anna).
-- Every check runs inside one transaction, so now() is the same everywhere.
begin;
create extension if not exists pgtap with schema extensions;

select plan(44);

-- ---------------------------------------------------------------------------
-- The function and its privileges (CA-34).
-- ---------------------------------------------------------------------------
select has_function('public', 'invite_adult', array['text', 'member_color'], 'invite_adult(text, member_color) exists');
select is(
  pg_get_function_result('public.invite_adult(text, public.member_color)'::regprocedure),
  'uuid',
  'it returns only the id of the new member'
);
select ok(
  (select p.prosecdef and p.proconfig @> array['search_path=""']
   from pg_proc p where p.oid = 'public.invite_adult(text, public.member_color)'::regprocedure),
  'invite_adult is security definer with an empty search_path'
);
select ok(
  has_function_privilege('authenticated', 'public.invite_adult(text, public.member_color)', 'execute'),
  'CA-34: authenticated can execute invite_adult'
);
select ok(
  not has_function_privilege('anon', 'public.invite_adult(text, public.member_color)', 'execute')
    and not has_function_privilege('service_role', 'public.invite_adult(text, public.member_color)', 'execute')
    and not has_function_privilege('public', 'public.invite_adult(text, public.member_color)', 'execute'),
  'CA-4, CA-34: anon, service_role and public cannot execute invite_adult'
);

-- The rows of Casa Bianchi before any call.
do $$
begin
  perform set_config('test.b_members', (select count(*)::text from public.household_members m
                                        where m.household_id = '22222222-2222-4222-8222-222222222222'), true);
  perform set_config('test.b_invitations', (select count(*)::text from public.invitations i
                                            where i.household_id = '22222222-2222-4222-8222-222222222222'), true);
end;
$$;

-- ---------------------------------------------------------------------------
-- anon (CA-4).
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok(
  $$ select public.invite_adult('Nonna Rita', 'ceruleo') $$,
  '42501', null, 'CA-4: anon cannot invite'
);

-- ---------------------------------------------------------------------------
-- Only POST (CA-34): every other method is refused before anything is written.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
set local request.method to 'GET';
select throws_ok($$ select public.invite_adult('Nonna Rita', 'ceruleo') $$, 'P0001', 'use POST', 'CA-34: GET is refused');
set local request.method to 'HEAD';
select throws_ok($$ select public.invite_adult('Nonna Rita', 'ceruleo') $$, 'P0001', 'use POST', 'CA-34: HEAD is refused');
set local request.method to 'PATCH';
select throws_ok($$ select public.invite_adult('Nonna Rita', 'ceruleo') $$, 'P0001', 'use POST', 'CA-34: PATCH is refused');
set local request.method to 'POST';

-- ---------------------------------------------------------------------------
-- CA-3: invalid arguments, nothing written.
-- ---------------------------------------------------------------------------
select throws_ok($$ select public.invite_adult(null, 'ceruleo') $$, '22023', null, 'CA-3: a null name is refused');
select throws_ok($$ select public.invite_adult('', 'ceruleo') $$, '22023', null, 'CA-3: an empty name is refused');
select throws_ok($$ select public.invite_adult('   ', 'ceruleo') $$, '22023', null, 'CA-3: a name of spaces is refused');
select throws_ok(
  $$ select public.invite_adult(repeat('a', 41), 'ceruleo') $$,
  '22023', null, 'CA-3: a name of 41 characters is refused'
);
select throws_ok($$ select public.invite_adult('Nonna Rita', null) $$, '22023', null, 'CA-3: a null colour is refused');

-- ---------------------------------------------------------------------------
-- CA-4: who does not organise, or has no household.
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok(
  $$ select public.invite_adult('Nonna Rita', 'ceruleo') $$,
  '42501', 'permission denied for function invite_adult', 'CA-4: Paolo (does not organise) cannot invite'
);
set local request.jwt.claims to '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select public.invite_adult('Nonna Rita', 'ceruleo') $$,
  '42501', 'permission denied for function invite_adult', 'CA-4: Chiara (no household) cannot invite'
);

-- ---------------------------------------------------------------------------
-- CA-5: a colour already taken (Paolo's salvia).
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select public.invite_adult('Nonna Rita', 'salvia') $$,
  '23505', null, 'CA-5: a colour already taken in the household is refused'
);

reset role;
select is(
  (select count(*)::text from public.household_members m where m.household_id = '22222222-2222-4222-8222-222222222222'),
  current_setting('test.b_members'),
  'CA-3, CA-4, CA-5, CA-34: no member was written in Casa Bianchi'
);
select is(
  (select count(*)::text from public.invitations i where i.household_id = '22222222-2222-4222-8222-222222222222'),
  current_setting('test.b_invitations'),
  'CA-3, CA-4, CA-5, CA-34: no invitation was written in Casa Bianchi'
);
select is_empty(
  $$ select 1 from public.household_members m where m.name like 'Nonna%' $$,
  'CA-4: nothing was written in any household'
);

-- ---------------------------------------------------------------------------
-- CA-1: Giulia invites Nonna Rita.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok(
  $$ select set_config('test.rita', public.invite_adult('Nonna Rita', 'ceruleo')::text, true) $$,
  'CA-1: Giulia invites Nonna Rita'
);

reset role;
select results_eq(
  $$ select m.household_id, m.kind::text, m.name, m.color::text, m.user_id is null, m.is_admin, m.joined_at is null
     from public.household_members m where m.id = current_setting('test.rita')::uuid $$,
  $$ values ('22222222-2222-4222-8222-222222222222'::uuid, 'adult', 'Nonna Rita', 'ceruleo', true, false, true) $$,
  'CA-1: the returned id is a new adult of Casa Bianchi, without account and without role'
);
select results_eq(
  $$ select i.household_id, i.status::text, i.invited_by_member_id, i.message is null,
            i.expires_at = i.created_at + interval '7 days', i.created_at = now()
     from public.invitations i where i.member_id = current_setting('test.rita')::uuid $$,
  $$ values ('22222222-2222-4222-8222-222222222222'::uuid, 'pending', 'b1000000-0000-4000-8000-000000000001'::uuid,
             true, true, true) $$,
  'CA-1: one pending invitation of 7 days, by Giulia, without message'
);
select ok(
  (select i.token ~ '^[0-9a-f]{64}$' from public.invitations i where i.member_id = current_setting('test.rita')::uuid),
  'CA-1: the token has the usual format'
);

-- ---------------------------------------------------------------------------
-- CA-2: the spaces of the name.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok(
  $$ select set_config('test.rita2', public.invite_adult(E'  Nonna \t  Rita ', 'lampone')::text, true) $$,
  'CA-2: a name with spaces around and inside is accepted'
);
select is(
  (select m.name from public.household_members m where m.id = current_setting('test.rita2')::uuid),
  'Nonna Rita',
  'CA-2: spaces at the start and at the end removed, inner runs reduced to one'
);
select lives_ok(
  $$ select set_config('test.forty', public.invite_adult(repeat('b', 40), 'glicine')::text, true) $$,
  'CA-3: a name of 40 characters is accepted'
);

-- ---------------------------------------------------------------------------
-- CA-8: the token is read with a separate query, only by who organises.
-- ---------------------------------------------------------------------------
select isnt_empty(
  $$ select i.token from public.invitations i where i.member_id = current_setting('test.rita')::uuid $$,
  'CA-8: Giulia reads the token of the invitation of Nonna Rita'
);
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select is_empty(
  $$ select i.token from public.invitations i where i.member_id = current_setting('test.rita')::uuid $$,
  'CA-8: Paolo (does not organise) reads 0 rows'
);
select isnt_empty(
  $$ select 1 from public.household_members m where m.id = current_setting('test.rita')::uuid $$,
  'Paolo sees Nonna Rita among the members of his household'
);

-- ---------------------------------------------------------------------------
-- CA-33: Paolo and the other household.
-- ---------------------------------------------------------------------------
select is_empty(
  $$ delete from public.household_members m where m.id = 'a1000000-0000-4000-8000-000000000002' returning m.id $$,
  'CA-33: Paolo removes 0 rows when he deletes Laura (Casa D''Angelo)'
);
select is_empty(
  $$ select i.token from public.invitations i where i.household_id = '11111111-1111-4111-8111-111111111111' $$,
  'CA-33: Paolo reads no invitation of Casa D''Angelo'
);
select is_empty(
  $$ select i.token from public.invitations i $$,
  'CA-33: Paolo reads no invitation at all, not even of his household'
);

-- Isolation: Marco never sees Nonna Rita nor her invitation.
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select is_empty(
  $$ select 1 from public.household_members m where m.id = current_setting('test.rita')::uuid $$,
  'Marco (Casa D''Angelo) does not see Nonna Rita'
);
select is_empty(
  $$ select 1 from public.invitations i where i.member_id = current_setting('test.rita')::uuid $$,
  'Marco (Casa D''Angelo) does not see her invitation'
);
-- Marco's call creates in his own household, never in Casa Bianchi.
select lives_ok(
  $$ select set_config('test.marco_guest', public.invite_adult('Zio Piero', 'ceruleo')::text, true) $$,
  'Marco invites in his own household (the same colour as Nonna Rita is free there)'
);

reset role;
select is(
  (select m.household_id from public.household_members m where m.id = current_setting('test.marco_guest')::uuid),
  '11111111-1111-4111-8111-111111111111'::uuid,
  'the household is always the caller''s'
);
select is(
  (select laura.id from public.household_members laura where laura.id = 'a1000000-0000-4000-8000-000000000002'),
  'a1000000-0000-4000-8000-000000000002'::uuid,
  'CA-33: Laura is still in Casa D''Angelo'
);

-- ---------------------------------------------------------------------------
-- CA-7: an error on the insert of the invitation leaves no member (one transaction).
-- ---------------------------------------------------------------------------
create function pg_temp.test_fail_invitation() returns trigger language plpgsql as $$
begin
  raise exception 'forced failure' using errcode = 'P0002';
end;
$$;
create trigger zz_test_fail_invitation before insert on public.invitations
  for each row execute function pg_temp.test_fail_invitation();

set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select public.invite_adult('Ospite Fallito', 'peonia') $$,
  'P0002', 'forced failure', 'CA-7: the forced error reaches the caller'
);
reset role;
select is_empty(
  $$ select 1 from public.household_members m where m.name = 'Ospite Fallito' $$,
  'CA-7: the member does not exist'
);
drop trigger zz_test_fail_invitation on public.invitations;

-- ---------------------------------------------------------------------------
-- CA-6: a household with 10 members.
-- Casa Bianchi has 7 now (4 of the seed, Nonna Rita twice, the 40 characters guest).
-- ---------------------------------------------------------------------------
insert into public.household_members (household_id, kind, name, color)
values
  ('22222222-2222-4222-8222-222222222222', 'child', 'Uno', 'peonia'),
  ('22222222-2222-4222-8222-222222222222', 'child', 'Due', 'basilico'),
  ('22222222-2222-4222-8222-222222222222', 'pet', 'Tre', 'cannella');
select is(
  (select count(*)::integer from public.household_members m where m.household_id = '22222222-2222-4222-8222-222222222222'),
  10,
  'CA-6: Casa Bianchi has 10 members'
);
do $$
begin
  perform set_config('test.b_invitations_full', (select count(*)::text from public.invitations i
                                                 where i.household_id = '22222222-2222-4222-8222-222222222222'), true);
end;
$$;

set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
-- No colour is free any more: the limit is checked before the colour.
select throws_ok(
  $$ select public.invite_adult('Undicesima', 'salvia') $$,
  'P0001', 'household member limit reached', 'CA-6: the eleventh member is refused with P0001'
);
reset role;
select is(
  (select count(*)::integer from public.household_members m where m.household_id = '22222222-2222-4222-8222-222222222222'),
  10,
  'CA-6: no member was written'
);
select is(
  (select count(*)::text from public.invitations i where i.household_id = '22222222-2222-4222-8222-222222222222'),
  current_setting('test.b_invitations_full'),
  'CA-6: no invitation was written'
);

select * from finish();
rollback;
