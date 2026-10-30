-- invitation_preview().caller_is_member (issue #132, for page #16): true only when the
-- signed-in caller is already a member of the household of a valid invitation.
-- Seed: A = Marco (Casa D'Angelo; Laura has a valid invitation), B = Giulia and Paolo
-- (Casa Bianchi; Anna has an expired pending invitation), C = Chiara (no household).
-- Created here, as database owner: Franca (adult of Casa Bianchi) with a valid invitation.
-- Every check runs inside one transaction, so now() is the same everywhere.
begin;
create extension if not exists pgtap with schema extensions;

select plan(30);

insert into public.household_members (id, household_id, kind, name, color)
values ('b1000000-0000-4000-8000-000000000016', '22222222-2222-4222-8222-222222222222', 'adult', 'Franca', 'lampone');
insert into public.invitations (id, household_id, member_id, invited_by_member_id)
values ('b2000000-0000-4000-8000-000000000016', '22222222-2222-4222-8222-222222222222',
        'b1000000-0000-4000-8000-000000000016', 'b1000000-0000-4000-8000-000000000001');

do $$
begin
  perform set_config('test.laura', (select i.token from public.invitations i where i.id = 'a2000000-0000-4000-8000-000000000001'), true);
  perform set_config('test.anna_expired', (select i.token from public.invitations i where i.id = 'b2000000-0000-4000-8000-000000000001'), true);
  perform set_config('test.franca', (select i.token from public.invitations i where i.id = 'b2000000-0000-4000-8000-000000000016'), true);
end;
$$;

-- status and caller_is_member of the preview, as text ('null' when null), one row.
create function pg_temp.member_flag(p_token text) returns text
language sql volatile as $$
  select string_agg(p.status::text || ':' || coalesce(p.caller_is_member::text, 'null'), ',')
  from public.invitation_preview(p_token) p
$$;
grant execute on function pg_temp.member_flag(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Schema and privileges (unchanged from #107).
-- ---------------------------------------------------------------------------
select ok(
  pg_get_function_result('public.invitation_preview(text)'::regprocedure)
    like '%, members invitation_preview_member[], caller_is_member boolean)',
  'invitation_preview has the output column caller_is_member boolean, last'
);
select results_eq(
  $$ select p.prosecdef, array_to_string(p.proconfig, ',') collate "default", p.provolatile::text collate "default"
     from pg_proc p where p.oid = 'public.invitation_preview(text)'::regprocedure $$,
  $$ values (true, 'search_path=""', 'v') $$,
  'still security definer, empty search_path, volatile'
);
select ok(
  has_function_privilege('anon', 'public.invitation_preview(text)', 'execute')
  and has_function_privilege('authenticated', 'public.invitation_preview(text)', 'execute'),
  'anon and authenticated can still run the preview'
);
select is_empty(
  $$ select 1 from pg_proc p, aclexplode(p.proacl) a
     where p.oid = 'public.invitation_preview(text)'::regprocedure and a.grantee = 0 $$,
  'still no execute privilege for PUBLIC'
);
select is_empty(
  $$ select n.nspname || '.' || p.proname
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public', 'private')
       and has_function_privilege('anon', p.oid, 'execute')
       and p.oid <> 'public.invitation_preview(text)'::regprocedure $$,
  'the preview is still the only function anon can execute'
);

-- ---------------------------------------------------------------------------
-- Anonymous visitor: false on a valid invitation, null on an invalid one.
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';

select is(pg_temp.member_flag(current_setting('test.laura')), 'valid:false', 'anon: Laura''s invitation, not a member (false, not null)');
select is(pg_temp.member_flag(current_setting('test.franca')), 'valid:false', 'anon: Franca''s invitation, not a member');
select is(pg_temp.member_flag(current_setting('test.anna_expired')), 'invalid:null', 'anon: expired invitation, null');
select is(pg_temp.member_flag(repeat('0123456789abcdef', 4)), 'invalid:null', 'anon: unknown token, null');
select is_empty(
  $$ select 1 from public.invitations
     union all select 1 from public.household_members
     union all select 1 from public.households $$,
  'anon still reads 0 rows of invitations, household_members and households'
);

-- ---------------------------------------------------------------------------
-- A: member of Casa D'Angelo.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';

select is(pg_temp.member_flag(current_setting('test.laura')), 'valid:true', 'A: invitation of their own household, member');
select is(pg_temp.member_flag(current_setting('test.franca')), 'valid:false', 'A: invitation of Casa Bianchi (other household), not a member');
select is(pg_temp.member_flag(current_setting('test.anna_expired')), 'invalid:null', 'A: expired invitation of another household, null');
select is(
  (select count(m.name)::integer from public.invitation_preview(current_setting('test.laura')) p, unnest(p.members) m),
  0,
  'A: still no member names, even as a member'
);
select is(
  (select count(m.name)::integer from public.invitation_preview(current_setting('test.franca')) p, unnest(p.members) m),
  0,
  'A: no names of Casa Bianchi'
);
select is_empty(
  $$ select 1 from public.household_members m where m.household_id = '22222222-2222-4222-8222-222222222222'
     union all select 1 from public.invitations i where i.household_id = '22222222-2222-4222-8222-222222222222' $$,
  'A still reads 0 rows of Casa Bianchi after the previews'
);

-- ---------------------------------------------------------------------------
-- B (Giulia, admin) and Paolo: members of Casa Bianchi.
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';

select is(pg_temp.member_flag(current_setting('test.franca')), 'valid:true', 'B: invitation of their own household, member');
select is(pg_temp.member_flag(current_setting('test.laura')), 'valid:false', 'B: invitation of Casa D''Angelo (other household), not a member');
select is(pg_temp.member_flag(current_setting('test.anna_expired')), 'invalid:null', 'B: expired invitation of their own household, null (not true)');
select is_empty(
  $$ select 1 from public.household_members m where m.household_id = '11111111-1111-4111-8111-111111111111'
     union all select 1 from public.invitations i where i.household_id = '11111111-1111-4111-8111-111111111111' $$,
  'B still reads 0 rows of Casa D''Angelo after the previews'
);

set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select is(pg_temp.member_flag(current_setting('test.franca')), 'valid:true', 'Paolo (not admin): own household, member');

-- ---------------------------------------------------------------------------
-- C: signed in, no household. Session without user.
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}';

select is(pg_temp.member_flag(current_setting('test.laura')), 'valid:false', 'C (no household): not a member');
select is(pg_temp.member_flag(current_setting('test.anna_expired')), 'invalid:null', 'C: expired invitation, null');
select is(
  (select count(m.name)::integer from public.invitation_preview(current_setting('test.laura')) p, unnest(p.members) m),
  4,
  'C: the member names are still there for a caller without a household'
);

set local request.jwt.claims to '{"role":"authenticated"}';
select is(pg_temp.member_flag(current_setting('test.laura')), 'valid:false', 'session without user: not a member');

-- ---------------------------------------------------------------------------
-- Invitation of A's household once expired: null for A too, same as for everyone.
-- ---------------------------------------------------------------------------
reset role;
update public.invitations set expires_at = now() where id = 'a2000000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select is(pg_temp.member_flag(current_setting('test.laura')), 'invalid:null', 'A: own invitation expired, null (not true)');
select is(
  (select to_jsonb(p) from public.invitation_preview(current_setting('test.laura')) p),
  jsonb_build_object(
    'status', 'invalid', 'household_name', null, 'inviter_name', null, 'message', null,
    'invitee_name', null, 'invitee_color', null, 'expires_at', null, 'members', null,
    'caller_is_member', null
  ),
  'A: expired invitation of their household gives the same answer as any invalid one'
);
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select is(pg_temp.member_flag(current_setting('test.laura')), 'invalid:null', 'anon: Laura''s invitation once expired, null');

-- Only POST through the Data API, as before.
set local request.method to 'GET';
select throws_ok(
  $$ select * from public.invitation_preview(current_setting('test.franca')) $$,
  'P0001',
  'use POST',
  'anon: a GET call is still refused'
);
set local request.method to 'POST';

-- The preview writes nothing.
reset role;
select results_eq(
  $$ select i.status::text, i.accepted_at from public.invitations i where i.id = 'b2000000-0000-4000-8000-000000000016' $$,
  $$ values ('pending', null::timestamptz) $$,
  'Franca''s invitation is still pending after the previews'
);

select * from finish();
rollback;
