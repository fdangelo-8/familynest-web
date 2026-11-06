-- search_household after #337 (spec 333 §6.9): the filter by person finds a thing to do or
-- a deadline when the person is any of its people; assignee_member_ids lists them.
-- Seed ids: B = Giulia (Casa Bianchi, user bbbbbbbb…01, member b1…01), B2 = Paolo (b1…02),
-- Leo b1…03 (child), Anna b1…04 (adult without account); A = Marco (Casa D'Angelo, a1…01).
begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
set local request.method to 'POST';

select lives_ok(
  $$ select set_config('test.todo', public.create_todo(
       p_title => 'Zaino nuovo',
       p_assignee_member_ids => array['b1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000003']::uuid[]
     )::text, true) $$,
  'Giulia creates a thing to do for herself and Leo'
);
select lives_ok(
  $$ select set_config('test.deadline', public.create_deadline(
       p_title => 'Zaino da pagare', p_due_date => (now() at time zone 'Europe/Rome')::date + 3,
       p_assignee_member_ids => array['b1000000-0000-4000-8000-000000000004', 'b1000000-0000-4000-8000-000000000003']::uuid[]
     )::text, true) $$,
  'and a deadline for Anna and Leo'
);
select results_eq(
  $$ select r.kind::text, r.id, r.assignee_member_id, r.assignee_member_ids
     from public.search_household(p_text => 'zaino', p_member_id => 'b1000000-0000-4000-8000-000000000003') r
     order by r.kind, r.sort_index $$,
  $$ values ('deadline'::text, current_setting('test.deadline')::uuid, 'b1000000-0000-4000-8000-000000000003'::uuid,
             array['b1000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000004']::uuid[]),
            ('todo', current_setting('test.todo')::uuid, 'b1000000-0000-4000-8000-000000000001'::uuid,
             array['b1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000003']::uuid[]) $$,
  'Leo, second person of both, finds both; the people in order of the members, the first in assignee_member_id'
);
select results_eq(
  $$ select r.kind::text from public.search_household(p_text => 'zaino', p_member_id => 'b1000000-0000-4000-8000-000000000004') r $$,
  $$ values ('deadline'::text) $$,
  'Anna finds only the deadline'
);
select is_empty(
  $$ select 1 from public.search_household(p_text => 'zaino', p_member_id => 'b1000000-0000-4000-8000-000000000002') $$,
  'Paolo, who takes care of neither, finds nothing'
);
select results_eq(
  $$ select r.assignee_member_ids from public.search_household(p_text => 'yogurt') r $$,
  $$ values (array[]::uuid[]) $$,
  'a thing to buy without people has an empty list'
);
select ok(
  (select bool_and(r.assignee_member_ids is null)
   from public.search_household(p_from => (now() at time zone 'Europe/Rome')::date, p_to => (now() at time zone 'Europe/Rome')::date + 30,
                                p_kinds => array['event']::public.search_result_kind[]) r)
  is not false,
  'events have no list of people'
);

set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select is_empty(
  $$ select 1 from public.search_household(p_text => 'zaino') $$,
  'Marco (Casa D''Angelo) finds nothing of Casa Bianchi'
);

select * from finish();
rollback;
