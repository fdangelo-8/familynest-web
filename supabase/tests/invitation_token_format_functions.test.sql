-- Issue #458: invitation_preview(text) and accept_invitation_with_color(text, member_color)
-- accept only tokens of 64 lowercase hexadecimal characters, the rule of the app and of
-- the invitations_token_format constraint (#438). Any other token behaves exactly like an
-- unknown token: preview 'invalid' with every other field null, join P0001
-- 'invalid invitation'.
--
-- Two kinds of bad tokens:
-- 1. variants of the valid token of Laura (Casa D'Angelo): first 32 or 63 characters,
--    65 or 128 characters, uppercase;
-- 2. tokens that are really stored in a row. The constraint forbids them, so, inside this
--    transaction only, the database owner drops invitations_token_format and creates
--    Casa Formati with one pending invitation for each bad format (32, 63, 65, 128
--    characters, 64 uppercase). Only the filter of the functions can refuse them.
-- Callers: anonymous, and C = Chiara (signed in, no household).
-- Everything is rolled back at the end (the constraint too).
begin;
create extension if not exists pgtap with schema extensions;

select plan(42);

-- ---------------------------------------------------------------------------
-- Same kind of functions as before.
-- ---------------------------------------------------------------------------
select ok(
  (select p.prosecdef and p.proconfig @> array['search_path=""']
   from pg_proc p where p.oid = 'public.invitation_preview(text)'::regprocedure)
  and (select p.prosecdef and p.proconfig @> array['search_path=""']
       from pg_proc p where p.oid = 'public.accept_invitation_with_color(text, public.member_color)'::regprocedure),
  'both functions are still security definer with an empty search_path'
);
select ok(
  (select p.prosrc ~ '\^\[0-9a-f\]\{64\}\$' and p.prosrc !~ 'char_length'
   from pg_proc p where p.oid = 'public.invitation_preview(text)'::regprocedure)
  and (select p.prosrc ~ '\^\[0-9a-f\]\{64\}\$' and p.prosrc !~ 'char_length'
       from pg_proc p where p.oid = 'public.accept_invitation_with_color(text, public.member_color)'::regprocedure),
  'both functions filter the token with the format of the constraint, not with its length'
);

-- ---------------------------------------------------------------------------
-- Fixtures, as database owner.
-- ---------------------------------------------------------------------------
do $$
declare
  v_laura text;
begin
  select i.token into v_laura
  from public.invitations i
  where i.member_id = 'a1000000-0000-4000-8000-000000000002' and i.status = 'pending';

  perform set_config('test.laura_token', v_laura, true);
  perform set_config('test.laura_32', left(v_laura, 32), true);
  perform set_config('test.laura_63', left(v_laura, 63), true);
  perform set_config('test.laura_65', v_laura || 'a', true);
  perform set_config('test.laura_128', v_laura || v_laura, true);
  perform set_config('test.laura_upper', upper(v_laura), true);

  perform set_config('test.stored_32', left(encode(extensions.digest('f32', 'sha256'), 'hex'), 32), true);
  perform set_config('test.stored_63', left(encode(extensions.digest('f63', 'sha256'), 'hex'), 63), true);
  perform set_config('test.stored_65', encode(extensions.digest('f65', 'sha256'), 'hex') || 'b', true);
  perform set_config('test.stored_128',
    encode(extensions.digest('f128a', 'sha256'), 'hex') || encode(extensions.digest('f128b', 'sha256'), 'hex'), true);
  perform set_config('test.stored_upper', upper(encode(extensions.digest('fup', 'sha256'), 'hex')), true);
end;
$$;

select ok(
  current_setting('test.laura_token') ~ '^[0-9a-f]{64}$'
  and current_setting('test.laura_upper') <> current_setting('test.laura_token')
  and current_setting('test.stored_upper') ~ '[A-F]',
  'fixture: Laura has a valid token, and the uppercase tokens really differ from lowercase'
);

alter table public.invitations drop constraint invitations_token_format;

insert into public.households (id, name, household_type)
values ('44444444-4444-4444-8444-444444444444', 'Casa Formati', 'roommates');
insert into public.household_members (id, household_id, kind, name, color)
values
  ('f1000000-0000-4000-8000-000000000001', '44444444-4444-4444-8444-444444444444', 'adult', 'Primo', 'pomodoro'),
  ('f1000000-0000-4000-8000-000000000002', '44444444-4444-4444-8444-444444444444', 'adult', 'Secondo', 'glicine'),
  ('f1000000-0000-4000-8000-000000000003', '44444444-4444-4444-8444-444444444444', 'adult', 'Terzo', 'salvia'),
  ('f1000000-0000-4000-8000-000000000004', '44444444-4444-4444-8444-444444444444', 'adult', 'Quarto', 'cobalto'),
  ('f1000000-0000-4000-8000-000000000005', '44444444-4444-4444-8444-444444444444', 'adult', 'Quinto', 'zafferano');
insert into public.invitations (household_id, member_id, token)
values
  ('44444444-4444-4444-8444-444444444444', 'f1000000-0000-4000-8000-000000000001', current_setting('test.stored_32')),
  ('44444444-4444-4444-8444-444444444444', 'f1000000-0000-4000-8000-000000000002', current_setting('test.stored_63')),
  ('44444444-4444-4444-8444-444444444444', 'f1000000-0000-4000-8000-000000000003', current_setting('test.stored_65')),
  ('44444444-4444-4444-8444-444444444444', 'f1000000-0000-4000-8000-000000000004', current_setting('test.stored_128')),
  ('44444444-4444-4444-8444-444444444444', 'f1000000-0000-4000-8000-000000000005', current_setting('test.stored_upper'));

select results_eq(
  $$ select char_length(i.token), i.status::text collate "default", i.expires_at > now()
     from public.invitations i
     where i.household_id = '44444444-4444-4444-8444-444444444444'
     order by i.member_id $$,
  $$ values (32, 'pending', true), (63, 'pending', true), (65, 'pending', true),
            (128, 'pending', true), (64, 'pending', true) $$,
  'fixture: Casa Formati has a pending, unexpired invitation for each bad format'
);

-- The answer for an unknown token, the reference for every bad token.
select set_config('test.unknown', repeat('0', 64), true);

-- ---------------------------------------------------------------------------
-- invitation_preview, anonymous caller.
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';

select results_eq(
  $$ select p.status::text collate "default", p.household_name, p.members, p.caller_is_member
     from public.invitation_preview(current_setting('test.unknown')) p $$,
  $$ values ('invalid', null::text, null::public.invitation_preview_member[], null::boolean) $$,
  'anon: an unknown token is invalid with every other field null'
);
select results_eq(
  $$ select * from public.invitation_preview(current_setting('test.stored_32')) $$,
  $$ select * from public.invitation_preview(current_setting('test.unknown')) $$,
  'anon: a stored token of 32 characters is like an unknown token'
);
select results_eq(
  $$ select * from public.invitation_preview(current_setting('test.stored_63')) $$,
  $$ select * from public.invitation_preview(current_setting('test.unknown')) $$,
  'anon: a stored token of 63 characters is like an unknown token'
);
select results_eq(
  $$ select * from public.invitation_preview(current_setting('test.stored_65')) $$,
  $$ select * from public.invitation_preview(current_setting('test.unknown')) $$,
  'anon: a stored token of 65 characters is like an unknown token'
);
select results_eq(
  $$ select * from public.invitation_preview(current_setting('test.stored_128')) $$,
  $$ select * from public.invitation_preview(current_setting('test.unknown')) $$,
  'anon: a stored token of 128 characters is like an unknown token'
);
select results_eq(
  $$ select * from public.invitation_preview(current_setting('test.stored_upper')) $$,
  $$ select * from public.invitation_preview(current_setting('test.unknown')) $$,
  'anon: a stored uppercase token is like an unknown token'
);
select results_eq(
  $$ select t, p.status::text collate "default"
     from unnest(array['laura_32', 'laura_63', 'laura_65', 'laura_128', 'laura_upper']) t
     cross join lateral public.invitation_preview(current_setting('test.' || t)) p
     order by t $$,
  $$ values ('laura_128', 'invalid'), ('laura_32', 'invalid'), ('laura_63', 'invalid'),
            ('laura_65', 'invalid'), ('laura_upper', 'invalid') $$,
  'anon: the variants of the token of Laura are invalid'
);
select results_eq(
  $$ select p.status::text collate "default", p.household_name
     from public.invitation_preview(current_setting('test.laura_token')) p $$,
  $$ values ('valid', 'Casa D''Angelo') $$,
  'anon: the token of Laura (64 lowercase hexadecimal characters) is still valid'
);

-- ---------------------------------------------------------------------------
-- invitation_preview, C (signed in, no household).
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}';

select results_eq(
  $$ select * from public.invitation_preview(current_setting('test.stored_32')) $$,
  $$ select * from public.invitation_preview(current_setting('test.unknown')) $$,
  'C: a stored token of 32 characters is like an unknown token'
);
select results_eq(
  $$ select * from public.invitation_preview(current_setting('test.stored_63')) $$,
  $$ select * from public.invitation_preview(current_setting('test.unknown')) $$,
  'C: a stored token of 63 characters is like an unknown token'
);
select results_eq(
  $$ select * from public.invitation_preview(current_setting('test.stored_65')) $$,
  $$ select * from public.invitation_preview(current_setting('test.unknown')) $$,
  'C: a stored token of 65 characters is like an unknown token'
);
select results_eq(
  $$ select * from public.invitation_preview(current_setting('test.stored_128')) $$,
  $$ select * from public.invitation_preview(current_setting('test.unknown')) $$,
  'C: a stored token of 128 characters is like an unknown token'
);
select results_eq(
  $$ select * from public.invitation_preview(current_setting('test.stored_upper')) $$,
  $$ select * from public.invitation_preview(current_setting('test.unknown')) $$,
  'C: a stored uppercase token is like an unknown token'
);
select results_eq(
  $$ select t, p.status::text collate "default"
     from unnest(array['laura_32', 'laura_63', 'laura_65', 'laura_128', 'laura_upper']) t
     cross join lateral public.invitation_preview(current_setting('test.' || t)) p
     order by t $$,
  $$ values ('laura_128', 'invalid'), ('laura_32', 'invalid'), ('laura_63', 'invalid'),
            ('laura_65', 'invalid'), ('laura_upper', 'invalid') $$,
  'C: the variants of the token of Laura are invalid'
);
select results_eq(
  $$ select p.status::text collate "default", p.household_name, p.caller_is_member
     from public.invitation_preview(current_setting('test.laura_token')) p $$,
  $$ values ('valid', 'Casa D''Angelo', false) $$,
  'C: the token of Laura is still valid'
);

-- ---------------------------------------------------------------------------
-- accept_invitation_with_color, C: same error as an unknown token.
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ select public.accept_invitation_with_color(current_setting('test.unknown'), 'peonia') $$,
  'P0001',
  'invalid invitation',
  'C: an unknown token gives invalid invitation'
);
select throws_ok(
  $$ select public.accept_invitation_with_color(current_setting('test.stored_32'), 'peonia') $$,
  'P0001',
  'invalid invitation',
  'C: a stored token of 32 characters gives invalid invitation'
);
select throws_ok(
  $$ select public.accept_invitation_with_color(current_setting('test.stored_63'), 'peonia') $$,
  'P0001',
  'invalid invitation',
  'C: a stored token of 63 characters gives invalid invitation'
);
select throws_ok(
  $$ select public.accept_invitation_with_color(current_setting('test.stored_65'), 'peonia') $$,
  'P0001',
  'invalid invitation',
  'C: a stored token of 65 characters gives invalid invitation'
);
select throws_ok(
  $$ select public.accept_invitation_with_color(current_setting('test.stored_128'), 'peonia') $$,
  'P0001',
  'invalid invitation',
  'C: a stored token of 128 characters gives invalid invitation'
);
select throws_ok(
  $$ select public.accept_invitation_with_color(current_setting('test.stored_upper'), 'peonia') $$,
  'P0001',
  'invalid invitation',
  'C: a stored uppercase token gives invalid invitation'
);
-- A colour taken in Casa Formati: still invalid invitation, nothing about the colours.
select throws_ok(
  $$ select public.accept_invitation_with_color(current_setting('test.stored_32'), 'glicine') $$,
  'P0001',
  'invalid invitation',
  'C: a stored bad token with a taken colour still gives invalid invitation'
);
select throws_ok(
  $$ select public.accept_invitation_with_color(current_setting('test.laura_32'), 'peonia') $$,
  'P0001',
  'invalid invitation',
  'C: the first 32 characters of the token of Laura give invalid invitation'
);
select throws_ok(
  $$ select public.accept_invitation_with_color(current_setting('test.laura_63'), 'peonia') $$,
  'P0001',
  'invalid invitation',
  'C: the first 63 characters of the token of Laura give invalid invitation'
);
select throws_ok(
  $$ select public.accept_invitation_with_color(current_setting('test.laura_65'), 'peonia') $$,
  'P0001',
  'invalid invitation',
  'C: the token of Laura with one more character gives invalid invitation'
);
select throws_ok(
  $$ select public.accept_invitation_with_color(current_setting('test.laura_128'), 'peonia') $$,
  'P0001',
  'invalid invitation',
  'C: the token of Laura twice (128 characters) gives invalid invitation'
);
select throws_ok(
  $$ select public.accept_invitation_with_color(current_setting('test.laura_upper'), 'peonia') $$,
  'P0001',
  'invalid invitation',
  'C: the token of Laura in uppercase gives invalid invitation'
);
-- The other checks keep their order: no colour before the invitation.
select throws_ok(
  $$ select public.accept_invitation_with_color(current_setting('test.stored_upper'), null) $$,
  '22023',
  'color is required',
  'C: no colour is still refused before the invitation is read'
);

reset role;

select is(
  (select count(*)::integer from public.household_members m where m.user_id = 'cccccccc-0000-4000-8000-000000000001'),
  0,
  'C still has no household after the bad tokens'
);
select results_eq(
  $$ select count(*)::integer from public.invitations i
     where i.household_id = '44444444-4444-4444-8444-444444444444' and i.status = 'pending' $$,
  $$ values (5) $$,
  'the invitations of Casa Formati are all still pending'
);
select is_empty(
  $$ select m.id from public.household_members m
     where m.household_id = '44444444-4444-4444-8444-444444444444' and m.user_id is not null $$,
  'no member of Casa Formati got an account'
);
select results_eq(
  $$ select i.status::text collate "default" from public.invitations i
     where i.member_id = 'a1000000-0000-4000-8000-000000000002' $$,
  $$ values ('pending') $$,
  'the invitation of Laura is still pending after the variants of her token'
);

-- B2 (already in a household) with a bad token: the household check comes first, as before.
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';

select throws_ok(
  $$ select public.accept_invitation_with_color(current_setting('test.stored_32'), 'peonia') $$,
  'P0001',
  'user already belongs to a household',
  'B2: already in a household is still checked before the invitation'
);

-- Anonymous callers still cannot run the join.
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';

select throws_ok(
  $$ select public.accept_invitation_with_color(current_setting('test.stored_32'), 'peonia') $$,
  '42501',
  null,
  'anon cannot call accept_invitation_with_color'
);

-- Only POST through the Data API, unchanged, also with a bad token.
set local role authenticated;
set local request.jwt.claims to '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}';
set local request.method to 'GET';

select throws_ok(
  $$ select * from public.invitation_preview(current_setting('test.stored_32')) $$,
  'P0001',
  'use POST',
  'GET is still refused by the preview'
);
select throws_ok(
  $$ select public.accept_invitation_with_color(current_setting('test.stored_32'), 'peonia') $$,
  'P0001',
  'use POST',
  'GET is still refused by the join'
);

set local request.method to 'POST';

-- The valid token of Laura still works: C joins Casa D'Angelo.
select is(
  public.accept_invitation_with_color(current_setting('test.laura_token'), 'peonia'),
  '11111111-1111-4111-8111-111111111111'::uuid,
  'C joins Casa D''Angelo with the token of Laura (64 lowercase hexadecimal characters)'
);

reset role;

select results_eq(
  $$ select m.user_id, m.color::text collate "default" from public.household_members m
     where m.id = 'a1000000-0000-4000-8000-000000000002' $$,
  $$ values ('cccccccc-0000-4000-8000-000000000001'::uuid, 'peonia') $$,
  'Laura is linked to C with the chosen colour'
);

select * from finish();
rollback;
