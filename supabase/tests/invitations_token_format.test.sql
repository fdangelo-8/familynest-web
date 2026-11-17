-- Issue #438 (database part of #417): invitations_token_format, the token of an
-- invitation is exactly 64 lowercase hexadecimal characters (the format of the column
-- default), for every role, on insert and on update. Error 23514.
-- A = Marco (admin of Casa D'Angelo). Anna (Casa Bianchi) is used for the inserts: her
-- seed invitation is revoked first, so the only error left is the token format.
begin;
create extension if not exists pgtap with schema extensions;

select plan(13);

select results_eq(
  $$ select c.contype::text collate "default", c.convalidated
     from pg_constraint c
     where c.conrelid = 'public.invitations'::regclass and c.conname = 'invitations_token_format' $$,
  $$ values ('c', true) $$,
  'invitations_token_format is a check constraint, validated on the existing rows'
);
select is_empty(
  $$ select i.id from public.invitations i where i.token !~ '^[0-9a-f]{64}$' $$,
  'every existing token has 64 lowercase hexadecimal characters'
);

update public.invitations set status = 'revoked'
where member_id = 'b1000000-0000-4000-8000-000000000004' and status = 'pending';

-- Inserts by the database owner, one bad token each.
create function pg_temp.insert_with_token(p_token text) returns void
language sql as $$
  insert into public.invitations (household_id, member_id, token)
  values ('22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000004', p_token);
$$;

select throws_ok(
  $$ select pg_temp.insert_with_token(upper(encode(extensions.digest('a', 'sha256'), 'hex'))) $$,
  '23514',
  'new row for relation "invitations" violates check constraint "invitations_token_format"',
  'uppercase hexadecimal is refused'
);
select throws_ok(
  $$ select pg_temp.insert_with_token(left(encode(extensions.digest('b', 'sha256'), 'hex'), 63)) $$,
  '23514',
  'new row for relation "invitations" violates check constraint "invitations_token_format"',
  '63 characters are refused'
);
select throws_ok(
  $$ select pg_temp.insert_with_token(encode(extensions.digest('c', 'sha256'), 'hex') || 'a') $$,
  '23514',
  'new row for relation "invitations" violates check constraint "invitations_token_format"',
  '65 characters are refused'
);
select throws_ok(
  $$ select pg_temp.insert_with_token(repeat('g', 64)) $$,
  '23514',
  'new row for relation "invitations" violates check constraint "invitations_token_format"',
  'letters outside 0-9 a-f are refused'
);
select throws_ok(
  $$ select pg_temp.insert_with_token(left(encode(extensions.digest('d', 'sha256'), 'hex'), 63) || E'\n') $$,
  '23514',
  'new row for relation "invitations" violates check constraint "invitations_token_format"',
  'a trailing newline is refused'
);
select throws_ok(
  $$ select pg_temp.insert_with_token(repeat('a', 4)) $$,
  '23514',
  null,
  'a short weak token is refused'
);

-- The server key (service_role) is held to the same format.
set local role service_role;
set local request.jwt.claims to '{"role":"service_role"}';

select throws_ok(
  $$ insert into public.invitations (household_id, member_id, token)
     values ('22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000004', repeat('Z', 64)) $$,
  '23514',
  'new row for relation "invitations" violates check constraint "invitations_token_format"',
  'service_role cannot insert a token in another format'
);
select lives_ok(
  $$ insert into public.invitations (household_id, member_id)
     values ('22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000004') $$,
  'service_role creates an invitation with the default token'
);
select throws_ok(
  $$ update public.invitations set token = repeat('Z', 64)
     where member_id = 'b1000000-0000-4000-8000-000000000004' and status = 'pending' $$,
  '23514',
  'new row for relation "invitations" violates check constraint "invitations_token_format"',
  'service_role cannot change a token to another format'
);

reset role;

select throws_ok(
  $$ update public.invitations set token = 'weak-token-weak-token-weak-token-0'
     where id = 'a2000000-0000-4000-8000-000000000001' $$,
  '23514',
  null,
  'the database owner cannot change a token to another format'
);

-- The API roles still cannot write the token at all.
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';

select throws_ok(
  $$ update public.invitations set token = encode(extensions.digest('e', 'sha256'), 'hex')
     where id = 'a2000000-0000-4000-8000-000000000001' $$,
  '42501',
  null,
  'A (admin) cannot change the token of an invitation'
);

select * from finish();
rollback;
