-- Privileges revoked in revoke_unneeded_privileges (issue #414).
-- A = Marco (admin of Casa D'Angelo), B = Giulia (admin of Casa Bianchi).
begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

-- ---------------------------------------------------------------------------
-- invitations: no select privilege for anon, unchanged for authenticated.
-- ---------------------------------------------------------------------------
select ok(
  not has_table_privilege('anon', 'public.invitations', 'select'),
  'anon has no select privilege on invitations'
);
select ok(
  not has_table_privilege('anon', 'public.invitations', 'insert')
    and not has_table_privilege('anon', 'public.invitations', 'update')
    and not has_table_privilege('anon', 'public.invitations', 'delete'),
  'anon has no write privilege on invitations'
);
select ok(
  has_table_privilege('authenticated', 'public.invitations', 'select'),
  'authenticated keeps the select privilege on invitations'
);

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';

select throws_ok(
  $$ select 1 from public.invitations $$,
  '42501',
  null,
  'anon cannot read invitations'
);

set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';

select isnt_empty(
  $$ select 1 from public.invitations i where i.household_id = '11111111-1111-4111-8111-111111111111' $$,
  'A (admin) still reads the invitations of their household'
);

set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';

select is_empty(
  $$ select 1 from public.invitations i where i.household_id = '11111111-1111-4111-8111-111111111111' $$,
  'B (admin of another household) still reads 0 invitations of household A'
);

reset role;

-- ---------------------------------------------------------------------------
-- rls_auto_enable(): exists only on the hosted project (see the migration). Where it
-- exists, no API role and not PUBLIC may execute it; where it does not, nothing to check.
-- ---------------------------------------------------------------------------
select ok(
  coalesce(
    (select not has_function_privilege('anon', p.oid, 'execute')
       from pg_catalog.pg_proc p
      where p.oid = to_regprocedure('public.rls_auto_enable()')),
    true
  ),
  'anon cannot execute rls_auto_enable() (when it exists)'
);
select ok(
  coalesce(
    (select not has_function_privilege('authenticated', p.oid, 'execute')
       from pg_catalog.pg_proc p
      where p.oid = to_regprocedure('public.rls_auto_enable()')),
    true
  ),
  'authenticated cannot execute rls_auto_enable() (when it exists)'
);
select ok(
  not exists (
    select 1
      from pg_catalog.pg_proc p,
           aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
     where p.oid = to_regprocedure('public.rls_auto_enable()')
       and a.grantee = 0
       and a.privilege_type = 'EXECUTE'
  ),
  'PUBLIC cannot execute rls_auto_enable() (when it exists)'
);

select * from finish();
rollback;
