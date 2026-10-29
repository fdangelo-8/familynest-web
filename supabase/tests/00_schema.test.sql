-- Schema, privacy and seed checks (issue #9: CA-1, CA-2 functions, CA-3, CA-32;
-- issue #74: CA-17).
begin;
create extension if not exists pgtap with schema extensions;

select plan(37);

-- CA-1: the four tables exist with RLS enabled.
select has_table('public', 'households', 'CA-1: households exists');
select has_table('public', 'household_members', 'CA-1: household_members exists');
select has_table('public', 'invitations', 'CA-1: invitations exists');
select has_table('public', 'profiles', 'CA-1: profiles exists');

select ok(
  (select c.relrowsecurity from pg_class c where c.oid = 'public.households'::regclass),
  'CA-1: RLS enabled on households'
);
select ok(
  (select c.relrowsecurity from pg_class c where c.oid = 'public.household_members'::regclass),
  'CA-1: RLS enabled on household_members'
);
select ok(
  (select c.relrowsecurity from pg_class c where c.oid = 'public.invitations'::regclass),
  'CA-1: RLS enabled on invitations'
);
select ok(
  (select c.relrowsecurity from pg_class c where c.oid = 'public.profiles'::regclass),
  'CA-1: RLS enabled on profiles'
);
select is_empty(
  $$
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity
  $$,
  'CA-1: no table in public without RLS'
);

-- CA-3: exact columns of household_members, no health or fiscal columns anywhere.
select columns_are(
  'public', 'household_members',
  array['id', 'household_id', 'kind', 'name', 'color', 'birth_date', 'user_id', 'is_admin', 'joined_at', 'created_at', 'updated_at'],
  'CA-3: household_members has exactly the planned columns'
);
select columns_are(
  'public', 'households',
  array['id', 'name', 'household_type', 'created_at', 'updated_at'],
  'households has exactly the planned columns'
);
select columns_are(
  'public', 'invitations',
  array['id', 'household_id', 'member_id', 'invited_by_member_id', 'token', 'short_code', 'message', 'status', 'expires_at', 'accepted_at', 'created_at', 'updated_at'],
  'invitations has exactly the planned columns'
);
select columns_are(
  'public', 'profiles',
  array['id', 'display_name', 'created_at', 'updated_at'],
  'profiles has exactly the planned columns (no email)'
);
select is_empty(
  $$
    select c.table_name || '.' || c.column_name
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.column_name ~* '(health|medical|pediatric|allerg|vet|fiscal)'
  $$,
  'CA-3: no column about health, medical, pediatric, allergies, vet or fiscal data'
);

-- Enumerated types.
select enum_has_labels('public', 'household_type', array['single', 'couple', 'family_with_children', 'roommates'], 'household_type labels');
select enum_has_labels('public', 'member_kind', array['adult', 'child', 'pet'], 'member_kind labels');
-- Issue #74 CA-17: the 10 colours, the 5 of issue #9 first, in order.
select enum_has_labels(
  'public', 'member_color',
  array['pomodoro', 'glicine', 'salvia', 'cobalto', 'zafferano', 'lampone', 'ceruleo', 'peonia', 'basilico', 'cannella'],
  'CA-17 (#74): member_color has the 10 colours in order'
);
select enum_has_labels('public', 'invitation_status', array['pending', 'accepted', 'revoked'], 'invitation_status labels');

-- CA-2: functions offered to the pages.
select has_function('public', 'create_household', array['text', 'household_type', 'text', 'member_color'], 'CA-2: create_household exists');
select has_function('public', 'accept_invitation', array['text'], 'CA-2: accept_invitation exists');
select has_function('public', 'current_household_id', 'CA-2: current_household_id exists');

-- Every security definer function has an empty search_path.
select is_empty(
  $$
    select p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and p.prosecdef
      and not coalesce(p.proconfig @> array['search_path=""'], false)
  $$,
  'every security definer function sets search_path to empty'
);

-- Issue #49 CA-3: membership checks are in the private schema, not exposed by the API.
select has_function('private', 'is_household_member', array['uuid'], 'is_household_member exists in private');
select has_function('private', 'is_household_admin', array['uuid'], 'is_household_admin exists in private');
select hasnt_function('public', 'is_household_member', array['uuid'], 'no public is_household_member (not callable as RPC)');
select hasnt_function('public', 'is_household_admin', array['uuid'], 'no public is_household_admin (not callable as RPC)');
select ok(
  not has_schema_privilege('anon', 'private', 'usage'),
  'anon has no access to the private schema'
);

-- Issue #49 CA-4: every account has a profile.
select is_empty(
  $$ select u.id from auth.users u where not exists (select 1 from public.profiles p where p.id = u.id) $$,
  'every account in auth.users has a profile'
);

-- Anonymous users cannot call the operations.
select ok(
  not has_function_privilege('anon', 'public.create_household(text, public.household_type, text, public.member_color)', 'execute'),
  'anon cannot execute create_household'
);
select ok(
  not has_function_privilege('anon', 'public.accept_invitation(text)', 'execute'),
  'anon cannot execute accept_invitation'
);

-- CA-32: seed state.
select results_eq(
  $$
    select m.name, m.kind::text, m.color::text, m.is_admin, m.user_id is not null
    from public.household_members m
    where m.household_id = '11111111-1111-4111-8111-111111111111'
    order by m.created_at
  $$,
  $$
    values
      ('Marco', 'adult', 'pomodoro', true, true),
      ('Laura', 'adult', 'glicine', false, false),
      ('Sofia', 'child', 'salvia', false, false),
      ('Tommaso', 'child', 'cobalto', false, false),
      ('Biscotto', 'pet', 'zafferano', false, false)
  $$,
  'CA-32: Casa D''Angelo has its 5 members'
);
select results_eq(
  $$
    select m.name, m.kind::text, m.color::text, m.is_admin, m.user_id is not null
    from public.household_members m
    where m.household_id = '22222222-2222-4222-8222-222222222222'
    order by m.created_at
  $$,
  $$
    values
      ('Giulia', 'adult', 'cobalto', true, true),
      ('Paolo', 'adult', 'salvia', false, true),
      ('Leo', 'child', 'zafferano', false, false),
      ('Anna', 'adult', 'pomodoro', false, false)
  $$,
  'CA-32: Casa Bianchi has its 4 members'
);
select results_eq(
  $$ select h.name from public.households h order by h.name $$,
  $$ values ('Casa Bianchi'), ('Casa D''Angelo') $$,
  'CA-32: exactly the two test households'
);
select ok(
  (select i.status = 'pending' and i.expires_at > now() and i.short_code = '4821'
   from public.invitations i where i.member_id = 'a1000000-0000-4000-8000-000000000002'),
  'CA-32: Laura has a valid pending invitation'
);
select ok(
  (select i.status = 'pending' and i.expires_at < now() and i.short_code = '7305'
   from public.invitations i where i.member_id = 'b1000000-0000-4000-8000-000000000004'),
  'CA-32: Anna has a pending invitation already expired'
);
select ok(
  not exists (select 1 from public.household_members m where m.user_id = 'cccccccc-0000-4000-8000-000000000001')
  and exists (select 1 from public.profiles p where p.id = 'cccccccc-0000-4000-8000-000000000001' and p.display_name = 'Chiara Neri'),
  'CA-32: user C has a profile and no household'
);
select is(
  (select p.display_name from public.profiles p where p.id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  'Marco D''Angelo',
  'CA-32: profile of A is "Marco D''Angelo"'
);

select * from finish();
rollback;
