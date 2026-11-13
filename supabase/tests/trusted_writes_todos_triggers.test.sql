-- Writes of the administrative key into todos (issue #362, same defect as #288): service_role
-- inserts and changes things to do with a person who takes care of them, the rules of the
-- triggers (normalised title, assignee an adult or a child) still hold for it, and nothing
-- changes for the Data API roles.
-- The administrative key comes first: PL/pgSQL keeps the plan of an expression for the
-- whole session, so the defect shows only when service_role is the first role that runs
-- the triggers in the session (as in trusted_writes_triggers.test). No thing to do is
-- written before it.
-- Seed ids: A = Marco (Casa D'Angelo, user aaaaaaaa…01, member a1…01), B = Giulia (Casa
-- Bianchi, user bbbbbbbb…01, member b1…01). Members of Casa D'Angelo: Marco a1…01 and Laura
-- a1…02 (adults), Sofia a1…03 (child), Biscotto a1…05 (pet). No health data (D1).
begin;
create extension if not exists pgtap with schema extensions;

select plan(28);

-- ---------------------------------------------------------------------------
-- todos, administrative key
-- ---------------------------------------------------------------------------
set local role service_role;
set local request.jwt.claims to '{"role":"service_role"}';

select lives_ok(
  $$ insert into public.todos (id, household_id, title, created_by_member_id, assignee_member_id)
     values (
       'c9000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
       '  Comprare   il  pane ', 'a1000000-0000-4000-8000-000000000001',
       'a1000000-0000-4000-8000-000000000002'
     ) $$,
  '#362: the administrative key inserts a thing to do with a person who takes care of it'
);
select results_eq(
  $$ select t.title, t.created_by_member_id, t.assignee_member_id
     from public.todos t where t.id = 'c9000000-0000-4000-8000-000000000001' $$,
  $$ values ('Comprare il pane'::text, 'a1000000-0000-4000-8000-000000000001'::uuid,
             'a1000000-0000-4000-8000-000000000002'::uuid) $$,
  'the thing of the administrative key is normalised and keeps the author and the assignee it was given'
);
select throws_ok(
  $$ insert into public.todos (household_id, title, created_by_member_id, assignee_member_id)
     values ('11111111-1111-4111-8111-111111111111', 'Passeggiata', 'a1000000-0000-4000-8000-000000000001',
             'a1000000-0000-4000-8000-000000000005') $$,
  '23514', 'the assignee must be an adult or a child of the household',
  'also for the administrative key a pet never takes care of a thing to do'
);
select lives_ok(
  $$ update public.todos
     set title = ' Comprare   pane  e latte ', assignee_member_id = 'a1000000-0000-4000-8000-000000000003'
     where id = 'c9000000-0000-4000-8000-000000000001' $$,
  '#362: the administrative key changes the title and the assignee of a thing to do'
);
select results_eq(
  $$ select t.title, t.assignee_member_id from public.todos t where t.id = 'c9000000-0000-4000-8000-000000000001' $$,
  $$ values ('Comprare pane e latte'::text, 'a1000000-0000-4000-8000-000000000003'::uuid) $$,
  'the changed thing of the administrative key is normalised, with the new assignee'
);
select throws_ok(
  $$ update public.todos set assignee_member_id = 'a1000000-0000-4000-8000-000000000005'
     where id = 'c9000000-0000-4000-8000-000000000001' $$,
  '23514', 'the assignee must be an adult or a child of the household',
  'also for the administrative key a new assignee is never a pet'
);

reset role;

select results_eq(
  $$ select a.member_id from public.todo_assignees a where a.todo_id = 'c9000000-0000-4000-8000-000000000001' $$,
  $$ values ('a1000000-0000-4000-8000-000000000003'::uuid) $$,
  'the person of the thing written by the administrative key is the new assignee only'
);

-- ---------------------------------------------------------------------------
-- How the fix is made
-- ---------------------------------------------------------------------------
select ok(
  not has_schema_privilege('service_role', 'private', 'usage'),
  'the fix gives service_role no usage on the schema private'
);
select ok(
  coalesce((select p.prosecdef and coalesce(p.proconfig @> array['search_path=""'], false)
            from pg_proc p
            where p.pronamespace = 'private'::regnamespace and p.proname = 'todos_before_write_trusted'), false),
  'the trusted trigger of todos is security definer with an empty search_path'
);
select ok(
  coalesce((select not has_function_privilege('authenticated', p.oid, 'execute')
              and not has_function_privilege('anon', p.oid, 'execute')
              and not has_function_privilege('service_role', p.oid, 'execute')
            from pg_proc p
            where p.pronamespace = 'private'::regnamespace and p.proname = 'todos_before_write_trusted'), false),
  'nobody executes the trusted trigger function of todos directly'
);
select is(
  (select count(*)::integer
   from pg_trigger t
   where t.tgname = 'todos_before_write_trusted'
     and t.tgrelid = 'public.todos'::regclass
     and pg_get_triggerdef(t.oid) ilike '%BEFORE INSERT OR UPDATE%'
     and pg_get_triggerdef(t.oid) ilike '%WHEN%CURRENT_USER%authenticated%anon%'),
  1,
  'the trusted trigger of todos fires before insert and update, only for roles other than authenticated and anon'
);
select results_eq(
  $$ select t.tgname::text collate "default"
     from pg_trigger t
     where t.tgrelid = 'public.todos'::regclass and not t.tgisinternal
       and t.tgtype & 2 = 2 and t.tgtype & 4 = 4
     order by t.tgname collate "C" $$,
  $$ values ('todos_before_insert'), ('todos_before_write_trusted') $$,
  'on todos the trusted trigger fires right after the guard of the insert'
);
select results_eq(
  $$ select t.tgname::text collate "default"
     from pg_trigger t
     where t.tgrelid = 'public.todos'::regclass and not t.tgisinternal
       and t.tgtype & 2 = 2 and t.tgtype & 16 = 16
     order by t.tgname collate "C" $$,
  $$ values ('todos_before_update'), ('todos_before_write_trusted'), ('todos_set_updated_at') $$,
  'on todos the trusted trigger fires after the guard of the update and before updated_at'
);

-- ---------------------------------------------------------------------------
-- Data API roles: unchanged (A writes, B is isolated, anon has nothing)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';

select lives_ok(
  $$ insert into public.todos (id, title, assignee_member_id)
     values ('c9000000-0000-4000-8000-000000000002', '  Ritirare   le  foto ', 'a1000000-0000-4000-8000-000000000003') $$,
  'A inserts a thing to do with a person who takes care of it'
);
select results_eq(
  $$ select t.title, t.created_by_member_id, t.household_id, t.assignee_member_id
     from public.todos t where t.id = 'c9000000-0000-4000-8000-000000000002' $$,
  $$ values ('Ritirare le foto'::text, 'a1000000-0000-4000-8000-000000000001'::uuid,
             '11111111-1111-4111-8111-111111111111'::uuid, 'a1000000-0000-4000-8000-000000000003'::uuid) $$,
  'the thing of A is normalised, with A as author, in the household of A'
);
select throws_ok(
  $$ insert into public.todos (title, assignee_member_id)
     values ('Passeggiata', 'a1000000-0000-4000-8000-000000000005') $$,
  '23514', 'the assignee must be an adult or a child of the household',
  'for A a pet never takes care of a thing to do'
);
select lives_ok(
  $$ update public.todos set assignee_member_id = 'a1000000-0000-4000-8000-000000000002'
     where id = 'c9000000-0000-4000-8000-000000000001' $$,
  'A changes the assignee of the thing written by the administrative key'
);
select throws_ok(
  $$ update public.todos set assignee_member_id = 'a1000000-0000-4000-8000-000000000005'
     where id = 'c9000000-0000-4000-8000-000000000001' $$,
  '23514', 'the assignee must be an adult or a child of the household',
  'for A a new assignee is never a pet'
);
select throws_ok(
  $$ update public.todos set created_by_member_id = 'a1000000-0000-4000-8000-000000000002'
     where id = 'c9000000-0000-4000-8000-000000000001' $$,
  '42501', null,
  'A cannot change the author of a thing to do'
);

set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select is_empty(
  $$ select 1 from public.todos t where t.id in ('c9000000-0000-4000-8000-000000000001', 'c9000000-0000-4000-8000-000000000002') $$,
  'B does not see the things to do of A'
);
select throws_ok(
  $$ insert into public.todos (household_id, title)
     values ('11111111-1111-4111-8111-111111111111', 'Intrusione') $$,
  '42501', null,
  'B cannot insert a thing to do into the household of A'
);
select throws_ok(
  $$ insert into public.todos (household_id, title, assignee_member_id)
     values ('11111111-1111-4111-8111-111111111111', 'Intrusione', 'a1000000-0000-4000-8000-000000000002') $$,
  '42501', null,
  'B cannot insert a thing to do with a member of A as assignee'
);
select is_empty(
  $$ update public.todos set title = 'Cambiato da B'
     where id = 'c9000000-0000-4000-8000-000000000001' returning 1 $$,
  'B cannot change a thing to do of A'
);
select is_empty(
  $$ delete from public.todos
     where id = 'c9000000-0000-4000-8000-000000000001' returning 1 $$,
  'B cannot delete a thing to do of A'
);

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok(
  $$ select 1 from public.todos $$,
  '42501', null,
  'anon cannot read the things to do'
);
select throws_ok(
  $$ insert into public.todos (household_id, title)
     values ('11111111-1111-4111-8111-111111111111', 'Anonima') $$,
  '42501', null,
  'anon cannot insert a thing to do'
);

reset role;
select results_eq(
  $$ select t.title, t.assignee_member_id from public.todos t where t.id = 'c9000000-0000-4000-8000-000000000001' $$,
  $$ values ('Comprare pane e latte'::text, 'a1000000-0000-4000-8000-000000000002'::uuid) $$,
  'the thing of A survived every attempt of B'
);
select is(
  (select count(*)::integer from public.todos t where t.id = 'c9000000-0000-4000-8000-000000000002'),
  1,
  'the thing inserted by A is there'
);

select * from finish();
rollback;
