-- invitation_preview() (issue #107, request R1 of page #16; decision of Francesco of
-- 30/10, option B): what the welcome page shows, given the token of the invitation.
-- Seed: A = Marco (Casa D'Angelo, admin; Laura has a valid invitation), B = Giulia
-- (Casa Bianchi, admin; Anna has an expired pending invitation), C = Chiara (no
-- household). Created here, as database owner: D (account linked to Ettore), Ettore and
-- Franca (adults of Casa Bianchi), Casa Sola (only the invitee Olga), and the revoked,
-- accepted and "member already linked" invitations.
-- Every check runs inside one transaction, so now() is the same everywhere.
begin;
create extension if not exists pgtap with schema extensions;

select plan(75);

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', 'dddddddd-0000-4000-8000-000000000001', 'authenticated',
        'authenticated', 'utente-d@example.com', '{"full_name":"Davide Test"}', now(), now());

-- Casa Bianchi: Ettore (pending invitation, then linked to D) and Franca (valid invitation).
insert into public.household_members (id, household_id, kind, name, color, created_at)
values
  ('b1000000-0000-4000-8000-000000000005', '22222222-2222-4222-8222-222222222222', 'adult', 'Ettore', 'glicine',
   now() - interval '10 days'),
  ('b1000000-0000-4000-8000-000000000006', '22222222-2222-4222-8222-222222222222', 'adult', 'Franca', 'lampone',
   now() - interval '9 days');

insert into public.invitations (id, household_id, member_id, invited_by_member_id, status, accepted_at, expires_at)
values
  -- Anna: revoked before expiring, and accepted (not expired). Not pending: no conflict
  -- with her expired pending invitation of the seed.
  ('b2000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222',
   'b1000000-0000-4000-8000-000000000004', 'b1000000-0000-4000-8000-000000000001', 'revoked', null,
   now() + interval '5 days'),
  ('b2000000-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222222',
   'b1000000-0000-4000-8000-000000000004', 'b1000000-0000-4000-8000-000000000001', 'accepted', now(),
   now() + interval '5 days'),
  ('b2000000-0000-4000-8000-000000000004', '22222222-2222-4222-8222-222222222222',
   'b1000000-0000-4000-8000-000000000005', 'b1000000-0000-4000-8000-000000000001', 'pending', null,
   now() + interval '5 days'),
  ('b2000000-0000-4000-8000-000000000005', '22222222-2222-4222-8222-222222222222',
   'b1000000-0000-4000-8000-000000000006', 'b1000000-0000-4000-8000-000000000001', 'pending', null,
   now() + interval '5 days');

-- Ettore gets an account while his invitation is still pending (not possible from the
-- app; the preview must still say 'invalid').
update public.household_members
set user_id = 'dddddddd-0000-4000-8000-000000000001', joined_at = now()
where id = 'b1000000-0000-4000-8000-000000000005';

-- Casa Sola: the invitee is the only member.
insert into public.households (id, name, household_type)
values ('33333333-3333-4333-8333-333333333333', 'Casa Sola', 'single');
insert into public.household_members (id, household_id, kind, name, color)
values ('c1000000-0000-4000-8000-000000000001', '33333333-3333-4333-8333-333333333333', 'adult', 'Olga', 'ceruleo');
insert into public.invitations (id, household_id, member_id)
values ('c2000000-0000-4000-8000-000000000001', '33333333-3333-4333-8333-333333333333',
        'c1000000-0000-4000-8000-000000000001');

-- Tokens read as database owner and kept in transaction settings.
do $$
begin
  perform set_config('test.laura', (select i.token from public.invitations i where i.id = 'a2000000-0000-4000-8000-000000000001'), true);
  perform set_config('test.laura_expires', (select i.expires_at::text from public.invitations i where i.id = 'a2000000-0000-4000-8000-000000000001'), true);
  perform set_config('test.anna_expired', (select i.token from public.invitations i where i.id = 'b2000000-0000-4000-8000-000000000001'), true);
  perform set_config('test.anna_revoked', (select i.token from public.invitations i where i.id = 'b2000000-0000-4000-8000-000000000002'), true);
  perform set_config('test.anna_accepted', (select i.token from public.invitations i where i.id = 'b2000000-0000-4000-8000-000000000003'), true);
  perform set_config('test.ettore_linked', (select i.token from public.invitations i where i.id = 'b2000000-0000-4000-8000-000000000004'), true);
  perform set_config('test.franca', (select i.token from public.invitations i where i.id = 'b2000000-0000-4000-8000-000000000005'), true);
  perform set_config('test.olga', (select i.token from public.invitations i where i.id = 'c2000000-0000-4000-8000-000000000001'), true);
  -- The only answer for an unusable invitation: one row, every field but status null.
  perform set_config('test.invalid', jsonb_build_array(jsonb_build_object(
    'status', 'invalid', 'household_name', null, 'inviter_name', null, 'message', null,
    'invitee_name', null, 'invitee_color', null, 'expires_at', null, 'members', null
  ))::text, true);
end;
$$;

-- Whole answer of the preview for a token, as one json array (one element per row).
create function pg_temp.preview(p_token text) returns jsonb
language sql volatile as $$
  select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) from public.invitation_preview(p_token) p
$$;
-- The same as text, without expires_at (its digits could contain any short string), for
-- the "must not contain" checks.
create function pg_temp.preview_text(p_token text) returns text
language sql volatile as $$
  select (pg_temp.preview(p_token) #- '{0,expires_at}')::text
$$;
grant execute on function pg_temp.preview(text) to anon, authenticated;
grant execute on function pg_temp.preview_text(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Schema and privileges.
-- ---------------------------------------------------------------------------
select has_function('public', 'invitation_preview', array['text'], 'invitation_preview(text) exists');
select is(
  pg_get_function_result('public.invitation_preview(text)'::regprocedure),
  'TABLE(status invitation_preview_status, household_name text, inviter_name text, message text, '
  'invitee_name text, invitee_color member_color, expires_at timestamp with time zone, '
  'members invitation_preview_member[])',
  'invitation_preview returns only the planned columns (no id, token, code, kind or birth date)'
);
select results_eq(
  $$ select a.attname::text collate "default", format_type(a.atttypid, a.atttypmod) collate "default"
     from pg_attribute a
     where a.attrelid = 'public.invitation_preview_member'::regclass and a.attnum > 0 and not a.attisdropped
     order by a.attnum $$,
  $$ values ('initial', 'text'), ('color', 'member_color'), ('name', 'text') $$,
  'a member of the preview has only initial, color and name'
);
select enum_has_labels('public', 'invitation_preview_status', array['valid', 'invalid'], 'preview status labels');
select results_eq(
  $$ select p.proname::text collate "default", p.prosecdef, array_to_string(p.proconfig, ',') collate "default",
            p.provolatile::text collate "default"
     from pg_proc p
     where p.oid in ('public.invitation_preview(text)'::regprocedure,
                     'public.accept_invitation_with_color(text, public.member_color)'::regprocedure)
     order by p.proname $$,
  $$ values ('accept_invitation_with_color', true, 'search_path=""', 'v'),
            ('invitation_preview', true, 'search_path=""', 'v') $$,
  'both functions: security definer, empty search_path, volatile'
);
select ok(
  has_function_privilege('anon', 'public.invitation_preview(text)', 'execute')
  and has_function_privilege('authenticated', 'public.invitation_preview(text)', 'execute')
  and not has_function_privilege('anon', 'public.accept_invitation_with_color(text, public.member_color)', 'execute')
  and has_function_privilege('authenticated', 'public.accept_invitation_with_color(text, public.member_color)', 'execute'),
  'anon runs only the preview; signed-in users run both'
);
select is_empty(
  $$ select p.proname from pg_proc p, aclexplode(p.proacl) a
     where p.oid in ('public.invitation_preview(text)'::regprocedure,
                     'public.accept_invitation_with_color(text, public.member_color)'::regprocedure)
       and a.grantee = 0 $$,
  'no execute privilege for PUBLIC on the two functions'
);
select is_empty(
  $$ select n.nspname || '.' || p.proname
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public', 'private')
       and has_function_privilege('anon', p.oid, 'execute')
       and p.oid <> 'public.invitation_preview(text)'::regprocedure $$,
  'the preview is the only function anon can execute'
);
select is_empty(
  $$ select i.id from public.invitations i where i.token !~ '^[0-9a-f]{64}$' $$,
  'every token is 64 hex characters (256 random bits): it cannot be guessed'
);

-- ---------------------------------------------------------------------------
-- Anonymous visitor (the link opened before signing in).
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';

select results_eq(
  $$ select p.status::text, p.household_name, p.inviter_name, p.message, p.invitee_name, p.invitee_color::text,
            p.expires_at = current_setting('test.laura_expires')::timestamptz, cardinality(p.members)
     from public.invitation_preview(current_setting('test.laura')) p $$,
  $$ values ('valid', 'Casa D''Angelo', 'Marco', null::text, 'Laura', 'glicine', true, 4) $$,
  'anon: Laura''s invitation is valid with household, inviter, invitee, colour and expiry'
);
select results_eq(
  $$ select m.initial, m.color::text, m.name, m.ord::integer
     from public.invitation_preview(current_setting('test.laura')) p,
          unnest(p.members) with ordinality as m(initial, color, name, ord)
     order by m.ord $$,
  $$ values ('M', 'pomodoro', null::text, 1), ('S', 'salvia', null, 2), ('T', 'cobalto', null, 3),
            ('B', 'zafferano', null, 4) $$,
  'anon: the other members in insertion order, only initial and colour, no name'
);
select is(
  jsonb_array_length(pg_temp.preview(current_setting('test.laura'))),
  1,
  'anon: exactly one row'
);
select is_empty(
  format(
    $$ select x from unnest(%L::text[]) x where strpos(%L, x) > 0 $$,
    array['Sofia', 'Tommaso', 'Biscotto', '4821', current_setting('test.laura'),
          '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-00000000000',
          'a2000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
          '2016-12-14', '2020-04-02', 'child', 'pet', 'adult', 'pending', 'family_with_children'],
    pg_temp.preview_text(current_setting('test.laura'))
  ),
  'anon: no child or pet name, short code, token, id, birth date, kind or invitation status'
);
select is_empty(
  $$ select 1 from public.invitations
     union all select 1 from public.household_members
     union all select 1 from public.households $$,
  'anon still reads 0 rows of invitations, household_members and households'
);

-- Every unusable invitation gives the same answer.
select is(pg_temp.preview(repeat('0123456789abcdef', 4)), current_setting('test.invalid')::jsonb, 'anon: unknown token of 64 hex characters');
select is(pg_temp.preview('abc'), current_setting('test.invalid')::jsonb, 'anon: malformed token (too short)');
select is(pg_temp.preview(''), current_setting('test.invalid')::jsonb, 'anon: empty token');
select is(pg_temp.preview(null), current_setting('test.invalid')::jsonb, 'anon: null token');
select is(pg_temp.preview(repeat('a', 10000)), current_setting('test.invalid')::jsonb, 'anon: very long token');
select is(pg_temp.preview(current_setting('test.anna_expired')), current_setting('test.invalid')::jsonb, 'anon: expired invitation');
select is(pg_temp.preview(current_setting('test.anna_revoked')), current_setting('test.invalid')::jsonb, 'anon: revoked invitation');
select is(pg_temp.preview(current_setting('test.anna_accepted')), current_setting('test.invalid')::jsonb, 'anon: accepted invitation');
select is(pg_temp.preview(current_setting('test.ettore_linked')), current_setting('test.invalid')::jsonb, 'anon: pending invitation of a member that already has an account');
select is(pg_temp.preview('4821'), current_setting('test.invalid')::jsonb, 'anon: the short code is not a token');
select is(pg_temp.preview('a2000000-0000-4000-8000-000000000001'), current_setting('test.invalid')::jsonb, 'anon: the id of the invitation is not a token');
select is(pg_temp.preview('11111111-1111-4111-8111-111111111111'), current_setting('test.invalid')::jsonb, 'anon: the id of the household is not a token');
select is(pg_temp.preview(upper(current_setting('test.laura'))), current_setting('test.invalid')::jsonb, 'anon: the token in upper case');
select is(pg_temp.preview(left(current_setting('test.laura'), 32)), current_setting('test.invalid')::jsonb, 'anon: first half of the token (no prefix match)');
select is(pg_temp.preview(left(current_setting('test.laura'), 63)), current_setting('test.invalid')::jsonb, 'anon: token without its last character');
select is(pg_temp.preview(current_setting('test.laura') || '0'), current_setting('test.invalid')::jsonb, 'anon: token with one more character');
select is(pg_temp.preview(' ' || current_setting('test.laura')), current_setting('test.invalid')::jsonb, 'anon: token with a leading space');
select is(pg_temp.preview(repeat('%', 64)), current_setting('test.invalid')::jsonb, 'anon: % wildcards are not patterns');
select is(pg_temp.preview(repeat('_', 64)), current_setting('test.invalid')::jsonb, 'anon: _ wildcards are not patterns');
select is(pg_temp.preview($t$' or '1'='1' or token like '%$t$), current_setting('test.invalid')::jsonb, 'anon: SQL text is only a value');

-- Through the Data API only POST is accepted: GET and HEAD would put the token in the URL.
set local request.method to 'GET';
select throws_ok(
  $$ select * from public.invitation_preview(current_setting('test.laura')) $$,
  'P0001',
  'use POST',
  'anon: a GET call of the Data API is refused (token never in a URL)'
);
select throws_ok(
  $$ select * from public.invitation_preview('abc') $$,
  'P0001',
  'use POST',
  'anon: a GET call is refused for an invalid token too'
);
set local request.method to 'HEAD';
select throws_ok(
  $$ select * from public.invitation_preview(current_setting('test.laura')) $$,
  'P0001',
  'use POST',
  'anon: a HEAD call of the Data API is refused (arguments would be in the URL)'
);
set local request.method to 'PUT';
select throws_ok(
  $$ select * from public.invitation_preview(current_setting('test.laura')) $$,
  'P0001',
  'use POST',
  'anon: any method other than POST is refused'
);
set local request.method to '';
select is(
  (select p.status::text from public.invitation_preview(current_setting('test.laura')) p),
  'valid',
  'anon: a direct SQL call (no request method) works'
);
set local request.method to 'POST';
select is(
  (select p.status::text from public.invitation_preview(current_setting('test.laura')) p),
  'valid',
  'anon: the same call with POST works'
);

-- ---------------------------------------------------------------------------
-- C: signed in, no household yet (the colour page). Names of the members are added.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}';

select results_eq(
  $$ select p.status::text, p.household_name, p.inviter_name, p.invitee_name, p.invitee_color::text
     from public.invitation_preview(current_setting('test.laura')) p $$,
  $$ values ('valid', 'Casa D''Angelo', 'Marco', 'Laura', 'glicine') $$,
  'C: Laura''s invitation is valid'
);
select results_eq(
  $$ select m.initial, m.color::text, m.name
     from public.invitation_preview(current_setting('test.laura')) p,
          unnest(p.members) with ordinality as m(initial, color, name, ord)
     order by m.ord $$,
  $$ values ('M', 'pomodoro', 'Marco'), ('S', 'salvia', 'Sofia'), ('T', 'cobalto', 'Tommaso'),
            ('B', 'zafferano', 'Biscotto') $$,
  'C: the other members with initial, colour and name (for «già di …»), Laura excluded'
);
select is_empty(
  format(
    $$ select x from unnest(%L::text[]) x where strpos(%L, x) > 0 $$,
    array['Casa Bianchi', 'Giulia', 'Paolo', 'Leo', 'Anna', 'Ettore', 'Franca', 'Casa Sola', 'Olga',
          '4821', current_setting('test.laura'), '11111111-1111-4111-8111-111111111111',
          'a1000000-0000-4000-8000-00000000000', '2016-12-14', '2020-04-02', 'child', 'pet'],
    pg_temp.preview_text(current_setting('test.laura'))
  ),
  'C: Laura''s preview has nothing of other households, no id, code, token, kind or birth date'
);
select results_eq(
  $$ select p.household_name, p.inviter_name, p.invitee_name, p.invitee_color::text
     from public.invitation_preview(current_setting('test.franca')) p $$,
  $$ values ('Casa Bianchi', 'Giulia', 'Franca', 'lampone') $$,
  'C: Franca''s invitation shows Casa Bianchi'
);
select results_eq(
  $$ select m.name
     from public.invitation_preview(current_setting('test.franca')) p,
          unnest(p.members) with ordinality as m(initial, color, name, ord)
     order by m.ord $$,
  $$ values ('Giulia'), ('Paolo'), ('Leo'), ('Anna'), ('Ettore') $$,
  'C: Franca''s preview lists only members of Casa Bianchi'
);
select is_empty(
  format(
    $$ select x from unnest(%L::text[]) x where strpos(%L, x) > 0 $$,
    array['Casa D''Angelo', 'Marco', 'Laura', 'Sofia', 'Tommaso', 'Biscotto', '22222222-2222-4222-8222-222222222222',
          current_setting('test.franca'), '2019-09-05'],
    pg_temp.preview_text(current_setting('test.franca'))
  ),
  'C: Franca''s preview has nothing of Casa D''Angelo, no id, token or birth date'
);
select is(pg_temp.preview(repeat('0123456789abcdef', 4)), current_setting('test.invalid')::jsonb, 'C: unknown token');
select is(pg_temp.preview('abc'), current_setting('test.invalid')::jsonb, 'C: malformed token');
select is(pg_temp.preview(current_setting('test.anna_expired')), current_setting('test.invalid')::jsonb, 'C: expired invitation');
select is(pg_temp.preview(current_setting('test.anna_revoked')), current_setting('test.invalid')::jsonb, 'C: revoked invitation');
select is(pg_temp.preview(current_setting('test.anna_accepted')), current_setting('test.invalid')::jsonb, 'C: accepted invitation');
select is(pg_temp.preview(current_setting('test.ettore_linked')), current_setting('test.invalid')::jsonb, 'C: member already linked');
select is(pg_temp.preview('4821'), current_setting('test.invalid')::jsonb, 'C: short code');
select is_empty(
  $$ select 1 from public.invitations
     union all select 1 from public.household_members
     union all select 1 from public.households $$,
  'C (no household) still reads 0 rows of invitations, household_members and households'
);
select is(public.current_household_id(), null, 'C: the preview does not join any household');

-- ---------------------------------------------------------------------------
-- A: already in this household. B: in another household. Only initials and colours.
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';

select results_eq(
  $$ select m.initial, m.color::text, m.name
     from public.invitation_preview(current_setting('test.laura')) p,
          unnest(p.members) with ordinality as m(initial, color, name, ord)
     order by m.ord $$,
  $$ values ('M', 'pomodoro', null::text), ('S', 'salvia', null), ('T', 'cobalto', null), ('B', 'zafferano', null) $$,
  'A (already in a household): initials and colours, no names'
);
select is(pg_temp.preview(current_setting('test.anna_expired')), current_setting('test.invalid')::jsonb, 'A: expired invitation of another household');

set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';

select results_eq(
  $$ select m.initial, m.color::text, m.name
     from public.invitation_preview(current_setting('test.laura')) p,
          unnest(p.members) with ordinality as m(initial, color, name, ord)
     order by m.ord $$,
  $$ values ('M', 'pomodoro', null::text), ('S', 'salvia', null), ('T', 'cobalto', null), ('B', 'zafferano', null) $$,
  'B (in another household): initials and colours of Casa D''Angelo, no names'
);
select is_empty(
  format(
    $$ select x from unnest(%L::text[]) x where strpos(%L, x) > 0 $$,
    array['Sofia', 'Tommaso', 'Biscotto', '4821', current_setting('test.laura'), '11111111-1111-4111-8111-111111111111'],
    pg_temp.preview_text(current_setting('test.laura'))
  ),
  'B: no child or pet name, code, token or id of Casa D''Angelo'
);
select is(pg_temp.preview(current_setting('test.anna_expired')), current_setting('test.invalid')::jsonb, 'B (admin): expired invitation of their own household is invalid too');
select is(pg_temp.preview(current_setting('test.anna_accepted')), current_setting('test.invalid')::jsonb, 'B (admin): accepted invitation of their own household');
select is(pg_temp.preview(current_setting('test.ettore_linked')), current_setting('test.invalid')::jsonb, 'B (admin): member already linked');
select is(pg_temp.preview(repeat('0123456789abcdef', 4)), current_setting('test.invalid')::jsonb, 'B: unknown token');
select is(
  (select p.status::text from public.invitation_preview(current_setting('test.franca')) p),
  'valid',
  'B (admin) sees the same preview of a valid invitation of their own household'
);
select is(
  (select m.name from public.invitation_preview(current_setting('test.franca')) p, unnest(p.members) m limit 1),
  null,
  'B: no names, even for their own household'
);

-- D: an account already linked (to Ettore, Casa Bianchi): no names either.
set local request.jwt.claims to '{"sub":"dddddddd-0000-4000-8000-000000000001","role":"authenticated"}';
select is(
  (select count(m.name)::integer from public.invitation_preview(current_setting('test.laura')) p, unnest(p.members) m),
  0,
  'D (linked to a member): no names'
);

-- No sub in the token (session without user): like anon.
set local request.jwt.claims to '{"role":"authenticated"}';
select is(
  (select count(m.name)::integer from public.invitation_preview(current_setting('test.laura')) p, unnest(p.members) m),
  0,
  'session without user: no names'
);

-- ---------------------------------------------------------------------------
-- Message, inviter who left, expiry, household with only the invitee.
-- Changes made as database owner, checked as anon.
-- ---------------------------------------------------------------------------
reset role;
update public.invitations set message = 'Entra anche tu!' where id = 'a2000000-0000-4000-8000-000000000001';
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select is(
  (select p.message from public.invitation_preview(current_setting('test.laura')) p),
  'Entra anche tu!',
  'anon: the message of the inviter'
);

reset role;
update public.invitations set invited_by_member_id = null where id = 'a2000000-0000-4000-8000-000000000001';
set local role anon;
select results_eq(
  $$ select p.status::text, p.inviter_name, p.household_name, p.message, cardinality(p.members)
     from public.invitation_preview(current_setting('test.laura')) p $$,
  $$ values ('valid', null::text, 'Casa D''Angelo', 'Entra anche tu!', 4) $$,
  'anon: inviter no longer known: still valid, inviter_name null'
);

reset role;
update public.invitations set expires_at = now() where id = 'a2000000-0000-4000-8000-000000000001';
set local role anon;
select is(pg_temp.preview(current_setting('test.laura')), current_setting('test.invalid')::jsonb, 'anon: invitation expiring right now is invalid');

reset role;
update public.invitations set expires_at = now() + interval '1 second' where id = 'a2000000-0000-4000-8000-000000000001';
set local role anon;
select results_eq(
  $$ select p.status::text, p.expires_at = now() + interval '1 second'
     from public.invitation_preview(current_setting('test.laura')) p $$,
  $$ values ('valid', true) $$,
  'anon: invitation expiring in one second is still valid'
);

reset role;
update public.invitations set status = 'revoked' where id = 'a2000000-0000-4000-8000-000000000001';
set local role anon;
select is(pg_temp.preview(current_setting('test.laura')), current_setting('test.invalid')::jsonb, 'anon: Laura''s invitation once revoked');

select results_eq(
  $$ select p.status::text, p.household_name, p.inviter_name, p.invitee_name, p.members
     from public.invitation_preview(current_setting('test.olga')) p $$,
  $$ values ('valid', 'Casa Sola', null::text, 'Olga', '{}'::public.invitation_preview_member[]) $$,
  'anon: household with only the invitee: empty member list, no inviter'
);

-- ---------------------------------------------------------------------------
-- The preview writes nothing.
-- ---------------------------------------------------------------------------
reset role;
select results_eq(
  $$ select i.status::text, i.accepted_at from public.invitations i where i.id = 'b2000000-0000-4000-8000-000000000005' $$,
  $$ values ('pending', null::timestamptz) $$,
  'Franca''s invitation is still pending after the previews'
);
select is(
  (select m.user_id from public.household_members m where m.id = 'b1000000-0000-4000-8000-000000000006'),
  null,
  'Franca is still without account after the previews'
);

select * from finish();
rollback;
