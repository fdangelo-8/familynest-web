-- Deadlines that repeat and «Fatta» (issue #481, part A of #460): type and columns, the
-- next due date (CA-4, CA-5), the values of «Ogni … giorni» (CA-3), «Fatta» with «Cambia
-- data» (CA-6), «Annulla» (CA-7), overdue deadlines (CA-8), «Mai» (CA-9), reminders on the
-- new date (CA-10), «Solo io» (CA-11), isolation between households in both directions,
-- administrators included (CA-12), anon, methods other than POST, and the single rule
-- «Solo io» shared by the policies and «Fatta».
-- Seed ids: A = Marco (Casa D'Angelo, admin, user aaaaaaaa…01, member a1…01), B = Giulia
-- (Casa Bianchi, admin, bbbbbbbb…01, b1…01), B2 = Paolo (Casa Bianchi, not admin,
-- bbbbbbbb…02, b1…02), C = Chiara (no household, cccccccc…01). This test gives Laura
-- (a1…02) an account (user aaaaaaaa…02). Biscotto a1…05 (pet).
-- Seed deadline b5…02: «Solo io» of Paolo, «Mai».
-- Dates are counted from today (Europe/Rome) or set far in the future, never in the past
-- of the real clock.
begin;
create extension if not exists pgtap with schema extensions;

select plan(124);

select set_config('test.today', ((now() at time zone 'Europe/Rome')::date)::text, true);

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-4000-8000-000000000002', 'authenticated',
        'authenticated', 'utente-laura@example.com', '{"full_name":"Laura Test"}', now(), now());
update public.household_members
set user_id = 'aaaaaaaa-0000-4000-8000-000000000002', joined_at = now()
where id = 'a1000000-0000-4000-8000-000000000002';

-- ---------------------------------------------------------------------------
-- Type, columns and constraints
-- ---------------------------------------------------------------------------
select enum_has_labels(
  'public', 'deadline_recurrence',
  array['none', 'monthly', 'every_3_months', 'every_6_months', 'yearly', 'every_n_days'],
  'deadline_recurrence: Mai, Ogni mese, Ogni 3 mesi, Ogni 6 mesi, Ogni anno, Ogni … giorni'
);
select results_eq(
  $$ select a.attname::text, a.atttypid::regtype::text from pg_attribute a
     where a.attrelid = 'public.deadlines'::regclass and a.attname in ('recurrence', 'recurrence_interval_days')
     order by a.attname $$,
  $$ values ('recurrence'::text, 'deadline_recurrence'::text), ('recurrence_interval_days', 'smallint') $$,
  'deadlines.recurrence has the new type, N is a whole number'
);
select col_not_null('public', 'deadlines', 'recurrence', 'the repetition is always set');
select col_is_null('public', 'deadlines', 'recurrence_interval_days', 'N is empty unless «Ogni … giorni»');
select is_empty(
  $$ select d.id from public.deadlines d where d.recurrence <> 'none' or d.recurrence_interval_days is not null $$,
  'every deadline of the seed is «Mai», without N'
);
select has_check('public', 'deadlines', 'deadlines has check constraints');
select ok(
  exists (
    select 1 from pg_constraint k
    where k.conrelid = 'public.deadlines'::regclass and k.conname = 'deadlines_recurrence_interval_days_valid'
  ),
  'the shape of the repetition is checked by the table'
);

-- ---------------------------------------------------------------------------
-- Privileges and properties of the functions
-- ---------------------------------------------------------------------------
select ok(
  has_column_privilege('authenticated', 'public.deadlines', 'recurrence', 'insert')
  and has_column_privilege('authenticated', 'public.deadlines', 'recurrence', 'update')
  and has_column_privilege('authenticated', 'public.deadlines', 'recurrence_interval_days', 'insert')
  and has_column_privilege('authenticated', 'public.deadlines', 'recurrence_interval_days', 'update')
  and not has_table_privilege('anon', 'public.deadlines', 'select, insert, update, delete'),
  'the app writes the repetition; anon has nothing'
);
select ok(
  (select p.prosecdef and p.proconfig @> array['search_path=""']
   from pg_proc p where p.oid = 'public.complete_deadline(uuid, date)'::regprocedure),
  'complete_deadline is security definer with an empty search_path'
);
select ok(
  (select not p.prosecdef and p.proconfig @> array['search_path=""']
   from pg_proc p where p.oid = 'public.undo_complete_deadline(uuid, date)'::regprocedure),
  'undo_complete_deadline is security invoker with an empty search_path'
);
select ok(
  (select not p.prosecdef and p.proconfig @> array['search_path=""']
   from pg_proc p where p.oid = 'public.create_deadline(text, date, uuid[], text, uuid, boolean, smallint[], public.deadline_recurrence, smallint)'::regprocedure)
  and (select not p.prosecdef and p.proconfig @> array['search_path=""']
   from pg_proc p where p.oid = 'public.update_deadline(uuid, text, date, uuid[], text, uuid, boolean, smallint[], public.deadline_recurrence, smallint)'::regprocedure),
  'create_deadline and update_deadline stay security invoker'
);
select is(
  (select count(*)::integer from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname in ('create_deadline', 'update_deadline')),
  2,
  'one create_deadline and one update_deadline (the old signatures are gone)'
);
select ok(
  not has_function_privilege('anon', 'public.complete_deadline(uuid, date)', 'execute')
  and not has_function_privilege('anon', 'public.undo_complete_deadline(uuid, date)', 'execute')
  and not has_function_privilege('anon', 'public.create_deadline(text, date, uuid[], text, uuid, boolean, smallint[], public.deadline_recurrence, smallint)', 'execute')
  and not has_function_privilege('anon', 'public.update_deadline(uuid, text, date, uuid[], text, uuid, boolean, smallint[], public.deadline_recurrence, smallint)', 'execute'),
  'anon executes none of the write functions'
);
select ok(
  has_function_privilege('authenticated', 'public.complete_deadline(uuid, date)', 'execute')
  and has_function_privilege('authenticated', 'public.undo_complete_deadline(uuid, date)', 'execute')
  and has_function_privilege('authenticated', 'public.create_deadline(text, date, uuid[], text, uuid, boolean, smallint[], public.deadline_recurrence, smallint)', 'execute')
  and has_function_privilege('authenticated', 'public.update_deadline(uuid, text, date, uuid[], text, uuid, boolean, smallint[], public.deadline_recurrence, smallint)', 'execute'),
  'signed-in users execute the write functions'
);
select ok(
  not exists (
    select 1
    from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where p.oid in (
      'public.complete_deadline(uuid, date)'::regprocedure,
      'public.undo_complete_deadline(uuid, date)'::regprocedure,
      'public.create_deadline(text, date, uuid[], text, uuid, boolean, smallint[], public.deadline_recurrence, smallint)'::regprocedure,
      'public.update_deadline(uuid, text, date, uuid[], text, uuid, boolean, smallint[], public.deadline_recurrence, smallint)'::regprocedure,
      'private.deadline_open_to_member(boolean, uuid, uuid)'::regprocedure,
      'private.deadline_next_due_date(public.deadline_recurrence, smallint, date)'::regprocedure
    )
      and a.grantee = 0
      and a.privilege_type = 'EXECUTE'
  ),
  'PUBLIC executes none of the new functions'
);
select ok(
  not has_function_privilege('authenticated', 'private.deadline_next_due_date(public.deadline_recurrence, smallint, date)', 'execute')
  and not has_function_privilege('anon', 'private.deadline_next_due_date(public.deadline_recurrence, smallint, date)', 'execute')
  and not has_function_privilege('anon', 'private.deadline_open_to_member(boolean, uuid, uuid)', 'execute'),
  'the helpers are not callable by the app'
);

-- ---------------------------------------------------------------------------
-- One rule «Solo io»: the policies and «Fatta» use private.deadline_open_to_member()
-- ---------------------------------------------------------------------------
select results_eq(
  $$ select p.policyname::text,
            coalesce(p.qual, '') ~ 'deadline_open_to_member',
            coalesce(p.with_check, '') ~ 'deadline_open_to_member'
     from pg_policies p
     where p.schemaname = 'public' and p.tablename = 'deadlines'
     order by p.policyname $$,
  $$ values ('deadlines_delete'::text, true, false),
            ('deadlines_insert', false, false),
            ('deadlines_select', true, false),
            ('deadlines_update', true, true) $$,
  'select, update and delete policies use the single rule'
);
select ok(
  not exists (
    select 1 from pg_policies p
    where p.schemaname = 'public' and p.tablename = 'deadlines'
      and (coalesce(p.qual, '') ~ 'is_private' and coalesce(p.qual, '') !~ 'deadline_open_to_member')
  ),
  'no policy writes the rule «Solo io» again'
);
select ok(
  (select p.prosrc ~ 'private\.deadline_open_to_member\(' and p.prosrc !~ 'is_private\s*(=|or|is)'
   from pg_proc p where p.oid = 'public.complete_deadline(uuid, date)'::regprocedure),
  'complete_deadline uses the same rule and does not write it again'
);
-- The rule gives the same answer as the policies of #108 for every combination.
select is_empty(
  $$ select v.is_private, v.author, v.member
     from (values (false, 'a'::text, 'a'::text), (false, 'a', 'b'), (false, null, 'a'), (false, 'a', null),
                  (true, 'a', 'a'), (true, 'a', 'b'), (true, 'a', null), (true, null, 'a')) as v (is_private, author, member)
     cross join lateral (
       select case v.author when 'a' then 'a1000000-0000-4000-8000-000000000001'::uuid
                            when 'b' then 'a1000000-0000-4000-8000-000000000002'::uuid end as author_id,
              case v.member when 'a' then 'a1000000-0000-4000-8000-000000000001'::uuid
                            when 'b' then 'a1000000-0000-4000-8000-000000000002'::uuid end as member_id
     ) ids
     where private.deadline_open_to_member(v.is_private, ids.author_id, ids.member_id)
           is distinct from coalesce(not v.is_private or ids.author_id = ids.member_id, false) $$,
  'deadline_open_to_member is equivalent to the rule «Solo io» of #108'
);

-- ---------------------------------------------------------------------------
-- Next due date (CA-4, CA-5): calendar months, last day of the month
-- ---------------------------------------------------------------------------
select is(private.deadline_next_due_date('monthly', null, '2026-11-18'), '2026-12-18'::date, 'CA-4: Ogni mese on 18/11/2026 -> 18/12/2026');
select is(private.deadline_next_due_date('monthly', null, '2027-01-31'), '2027-02-28'::date, 'CA-5: Ogni mese on 31/01/2027 -> 28/02/2027');
select is(private.deadline_next_due_date('every_3_months', null, '2026-11-30'), '2027-02-28'::date, 'CA-5: Ogni 3 mesi on 30/11/2026 -> 28/02/2027');
select is(private.deadline_next_due_date('every_6_months', null, '2026-11-18'), '2027-05-18'::date, 'CA-5: Ogni 6 mesi on 18/11/2026 -> 18/05/2027');
select is(private.deadline_next_due_date('yearly', null, '2028-02-29'), '2029-02-28'::date, 'CA-5: Ogni anno on 29/02/2028 -> 28/02/2029');
select is(private.deadline_next_due_date('every_n_days', 10::smallint, '2026-11-18'), '2026-11-28'::date, 'CA-5: Ogni 10 giorni on 18/11/2026 -> 28/11/2026');
select is(private.deadline_next_due_date('monthly', null, '2027-03-31'), '2027-04-30'::date, 'Ogni mese on 31/03 -> 30/04');
select is(private.deadline_next_due_date('every_n_days', 365::smallint, '2027-12-31'), '2028-12-30'::date, 'Ogni 365 giorni across a leap year');
select is(private.deadline_next_due_date('none', null, '2026-11-18'), null::date, '«Mai» has no next due date');

-- ---------------------------------------------------------------------------
-- Marco (A): the repetition is saved (CA-2, CA-3)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';

select lives_ok(
  $$ select set_config('test.d1', public.create_deadline(
       p_title => 'Antiparassitario di Biscotto',
       p_due_date => current_setting('test.today')::date + 7,
       p_assignee_member_ids => array['a1000000-0000-4000-8000-000000000001']::uuid[],
       p_note => 'Dal veterinario',
       p_for_member_id => 'a1000000-0000-4000-8000-000000000005',
       p_reminder_days => array[7, 1]::smallint[],
       p_recurrence => 'monthly'
     )::text, true) $$,
  'Marco saves a deadline «Ogni mese» for Biscotto'
);
select lives_ok(
  $$ select set_config('test.yearly', public.create_deadline(
       p_title => 'Bollo auto', p_due_date => current_setting('test.today')::date + 12, p_recurrence => 'yearly'
     )::text, true) $$,
  'CA-2: Marco saves «Bollo auto» «Ogni anno»'
);
select results_eq(
  $$ select d.recurrence::text, d.recurrence_interval_days from public.deadlines d
     where d.id = current_setting('test.yearly')::uuid $$,
  $$ values ('yearly'::text, null::smallint) $$,
  'CA-2: the repetition «Ogni anno» is stored'
);
select lives_ok(
  $$ select set_config('test.never', public.create_deadline(
       p_title => 'Rinnovo della patente', p_due_date => current_setting('test.today')::date + 30
     )::text, true) $$,
  'a deadline saved without repetition'
);
select is(
  (select d.recurrence::text from public.deadlines d where d.id = current_setting('test.never')::uuid),
  'none',
  'without repetition it is «Mai»'
);
select lives_ok(
  $$ select public.create_deadline(p_title => 'Prova N 1', p_due_date => current_setting('test.today')::date + 1,
       p_recurrence => 'every_n_days', p_recurrence_interval_days => 1::smallint) $$,
  'Ogni 1 giorno accepted'
);
select lives_ok(
  $$ select public.create_deadline(p_title => 'Prova N 365', p_due_date => current_setting('test.today')::date + 1,
       p_recurrence => 'every_n_days', p_recurrence_interval_days => 365::smallint) $$,
  'Ogni 365 giorni accepted'
);
select results_eq(
  $$ with d as (delete from public.deadlines where title like 'Prova N %' returning 1) select count(*)::integer from d $$,
  $$ values (2) $$,
  'Marco deletes the two accepted limits'
);
select throws_ok(
  $$ select public.create_deadline(p_title => 'Prova N vuoto', p_due_date => current_setting('test.today')::date + 1,
       p_recurrence => 'every_n_days') $$,
  '23514', null,
  'CA-3: «Ogni … giorni» without N is refused'
);
select throws_ok(
  $$ select public.create_deadline(p_title => 'Prova N zero', p_due_date => current_setting('test.today')::date + 1,
       p_recurrence => 'every_n_days', p_recurrence_interval_days => 0::smallint) $$,
  '23514', null,
  'CA-3: N = 0 is refused'
);
select throws_ok(
  $$ select public.create_deadline(p_title => 'Prova N troppo', p_due_date => current_setting('test.today')::date + 1,
       p_recurrence => 'every_n_days', p_recurrence_interval_days => 366::smallint) $$,
  '23514', null,
  'CA-3: N = 366 is refused'
);
select throws_ok(
  $$ select public.create_deadline(p_title => 'Prova N decimale', p_due_date => current_setting('test.today')::date + 1,
       p_recurrence => 'every_n_days', p_recurrence_interval_days => '2.5') $$,
  '22P02', null,
  'CA-3: N = 2,5 is refused'
);
select throws_ok(
  $$ select public.create_deadline(p_title => 'Prova N mensile', p_due_date => current_setting('test.today')::date + 1,
       p_recurrence => 'monthly', p_recurrence_interval_days => 10::smallint) $$,
  '23514', null,
  'N with a repetition other than «Ogni … giorni» is refused'
);
select throws_ok(
  $$ select public.create_deadline(p_title => 'Prova N nulla', p_due_date => current_setting('test.today')::date + 1,
       p_recurrence => null) $$,
  '22023', null,
  'a null repetition is refused'
);
select throws_ok(
  $$ insert into public.deadlines (title, due_date, recurrence) values ('Prova N diretta', current_setting('test.today')::date + 1, 'every_n_days') $$,
  '23514', null,
  'the table refuses «Ogni … giorni» without N on a direct write too'
);
select is_empty(
  $$ select d.id from public.deadlines d where d.title like 'Prova N %' $$,
  'CA-3: nothing was saved by the refused writes'
);

-- update_deadline: the repetition is kept when not sent, changed when sent.
select lives_ok(
  $$ select public.update_deadline(current_setting('test.yearly')::uuid, 'Bollo dell''auto',
       current_setting('test.today')::date + 12, array[]::uuid[], null, null, false, array[30, 7]::smallint[]) $$,
  'update_deadline without the repetition (the calls of today)'
);
select is(
  (select d.recurrence::text from public.deadlines d where d.id = current_setting('test.yearly')::uuid),
  'yearly',
  'the repetition already saved stays'
);
select lives_ok(
  $$ select public.update_deadline(current_setting('test.yearly')::uuid, 'Bollo dell''auto',
       current_setting('test.today')::date + 12, array[]::uuid[], null, null, false, array[30, 7]::smallint[],
       'every_n_days', 30::smallint) $$,
  'update_deadline with «Ogni 30 giorni»'
);
select results_eq(
  $$ select d.recurrence::text, d.recurrence_interval_days from public.deadlines d
     where d.id = current_setting('test.yearly')::uuid $$,
  $$ values ('every_n_days'::text, 30::smallint) $$,
  'the new repetition is stored'
);
select throws_ok(
  $$ select public.update_deadline(current_setting('test.yearly')::uuid, 'Bollo dell''auto',
       current_setting('test.today')::date + 12, array[]::uuid[], null, null, false, array[30, 7]::smallint[],
       null, 5::smallint) $$,
  '22023', null,
  'N without a repetition is refused'
);
select lives_ok(
  $$ select public.update_deadline(current_setting('test.yearly')::uuid, 'Bollo dell''auto',
       current_setting('test.today')::date + 12, array[]::uuid[], null, null, false, array[30, 7]::smallint[],
       'none', null) $$,
  'update_deadline back to «Mai»'
);
select results_eq(
  $$ select d.recurrence::text, d.recurrence_interval_days from public.deadlines d
     where d.id = current_setting('test.yearly')::uuid $$,
  $$ values ('none'::text, null::smallint) $$,
  '«Mai» without N'
);

-- ---------------------------------------------------------------------------
-- «Fatta» (CA-4, CA-6, CA-7, CA-8, CA-9)
-- ---------------------------------------------------------------------------
select set_config('test.d1_before', (
  select row(d.title, d.note, d.for_member_id, d.is_private, d.reminder_days, d.recurrence,
             d.recurrence_interval_days, d.created_by_member_id, d.household_id)::text
  from public.deadlines d where d.id = current_setting('test.d1')::uuid
), true);

select is(
  public.complete_deadline(current_setting('test.d1')::uuid),
  current_setting('test.today')::date + 7,
  'CA-4: «Fatta» returns only the previous due date'
);
select is(
  (select d.due_date from public.deadlines d where d.id = current_setting('test.d1')::uuid),
  (current_setting('test.today')::date + interval '1 month')::date,
  'CA-4: the deadline moves to one month from today'
);
select is(
  (select row(d.title, d.note, d.for_member_id, d.is_private, d.reminder_days, d.recurrence,
              d.recurrence_interval_days, d.created_by_member_id, d.household_id)::text
   from public.deadlines d where d.id = current_setting('test.d1')::uuid),
  current_setting('test.d1_before'),
  'CA-4: title, note, «Riguarda», «Chi lo vede», reminders and repetition unchanged'
);
select results_eq(
  $$ select a.member_id from public.deadline_assignees a where a.deadline_id = current_setting('test.d1')::uuid $$,
  $$ values ('a1000000-0000-4000-8000-000000000001'::uuid) $$,
  'CA-4: the people of the deadline unchanged'
);
select lives_ok(
  $$ select public.undo_complete_deadline(current_setting('test.d1')::uuid, current_setting('test.today')::date + 7) $$,
  'CA-7: «Annulla»'
);
select is(
  (select d.due_date from public.deadlines d where d.id = current_setting('test.d1')::uuid),
  current_setting('test.today')::date + 7,
  'CA-7: the previous due date is back'
);

-- «Cambia data» (CA-6)
select throws_ok(
  $$ select public.complete_deadline(current_setting('test.d1')::uuid, current_setting('test.today')::date) $$,
  '22023', null,
  'CA-6: today is refused'
);
select throws_ok(
  $$ select public.complete_deadline(current_setting('test.d1')::uuid, current_setting('test.today')::date - 1) $$,
  '22023', null,
  'CA-6: a day before today is refused'
);
select throws_ok(
  $$ select public.complete_deadline(current_setting('test.d1')::uuid, '2101-01-01') $$,
  '22023', null,
  'a day after 31/12/2100 is refused'
);
select throws_ok(
  $$ select public.complete_deadline(current_setting('test.d1')::uuid, 'infinity') $$,
  '22023', null,
  'an infinite day is refused'
);
select throws_ok(
  $$ select public.complete_deadline(current_setting('test.d1')::uuid, '-infinity') $$,
  '22023', null,
  'a day infinitely in the past is refused'
);
select is(
  (select d.due_date from public.deadlines d where d.id = current_setting('test.d1')::uuid),
  current_setting('test.today')::date + 7,
  'CA-6: after the refused dates the deadline did not change'
);
select is(
  public.complete_deadline(current_setting('test.d1')::uuid, current_setting('test.today')::date + 48),
  current_setting('test.today')::date + 7,
  'CA-6: a chosen day after today is accepted'
);
select is(
  (select d.due_date from public.deadlines d where d.id = current_setting('test.d1')::uuid),
  current_setting('test.today')::date + 48,
  'CA-6: the deadline moves to the chosen day'
);
select is(
  public.complete_deadline(current_setting('test.d1')::uuid, '2100-12-31'),
  current_setting('test.today')::date + 48,
  '31/12/2100 is accepted'
);
select lives_ok(
  $$ select public.undo_complete_deadline(current_setting('test.d1')::uuid, current_setting('test.today')::date + 7) $$,
  '«Annulla» back to the first date'
);
select throws_ok(
  $$ select public.undo_complete_deadline(current_setting('test.d1')::uuid, null) $$,
  '22023', null,
  '«Annulla» without a date is refused'
);

-- Overdue (CA-8), «Ogni 10 giorni», «Mai» (CA-9)
select lives_ok(
  $$ select set_config('test.overdue', public.create_deadline(
       p_title => 'Abbonamento del treno', p_due_date => current_setting('test.today')::date - 8,
       p_recurrence => 'monthly'
     )::text, true) $$,
  'an overdue deadline «Ogni mese»'
);
select is(
  public.complete_deadline(current_setting('test.overdue')::uuid),
  current_setting('test.today')::date - 8,
  'CA-8: «Fatta» on an overdue deadline'
);
select ok(
  (select d.due_date = (current_setting('test.today')::date + interval '1 month')::date
          and d.due_date > current_setting('test.today')::date
   from public.deadlines d where d.id = current_setting('test.overdue')::uuid),
  'CA-8: it moves to one month from today and is no longer overdue'
);
select lives_ok(
  $$ select set_config('test.days', public.create_deadline(
       p_title => 'Cambio del filtro', p_due_date => current_setting('test.today')::date + 3,
       p_recurrence => 'every_n_days', p_recurrence_interval_days => 10::smallint
     )::text, true) $$,
  'a deadline «Ogni 10 giorni»'
);
select is(
  public.complete_deadline(current_setting('test.days')::uuid),
  current_setting('test.today')::date + 3,
  '«Fatta» on «Ogni 10 giorni»'
);
select is(
  (select d.due_date from public.deadlines d where d.id = current_setting('test.days')::uuid),
  current_setting('test.today')::date + 10,
  'it moves to 10 days from today'
);
select throws_ok(
  $$ select public.complete_deadline(current_setting('test.never')::uuid) $$,
  '55000', null,
  'CA-9: a deadline «Mai» has no «Fatta»'
);
select is(
  (select d.due_date from public.deadlines d where d.id = current_setting('test.never')::uuid),
  current_setting('test.today')::date + 30,
  'CA-9: the deadline «Mai» did not change'
);

-- Methods other than POST through the Data API (lesson of #112), for each method.
set local request.method to 'GET';
select throws_ok($$ select public.complete_deadline(current_setting('test.d1')::uuid) $$, 'P0001', 'use POST', 'complete_deadline refuses GET');
select throws_ok($$ select public.undo_complete_deadline(current_setting('test.d1')::uuid, current_setting('test.today')::date + 1) $$, 'P0001', 'use POST', 'undo_complete_deadline refuses GET');
set local request.method to 'HEAD';
select throws_ok($$ select public.complete_deadline(current_setting('test.d1')::uuid) $$, 'P0001', 'use POST', 'complete_deadline refuses HEAD');
select throws_ok($$ select public.undo_complete_deadline(current_setting('test.d1')::uuid, current_setting('test.today')::date + 1) $$, 'P0001', 'use POST', 'undo_complete_deadline refuses HEAD');
set local request.method to 'PUT';
select throws_ok($$ select public.complete_deadline(current_setting('test.d1')::uuid) $$, 'P0001', 'use POST', 'complete_deadline refuses PUT');
select throws_ok($$ select public.undo_complete_deadline(current_setting('test.d1')::uuid, current_setting('test.today')::date + 1) $$, 'P0001', 'use POST', 'undo_complete_deadline refuses PUT');
set local request.method to 'PATCH';
select throws_ok($$ select public.complete_deadline(current_setting('test.d1')::uuid) $$, 'P0001', 'use POST', 'complete_deadline refuses PATCH');
select throws_ok($$ select public.undo_complete_deadline(current_setting('test.d1')::uuid, current_setting('test.today')::date + 1) $$, 'P0001', 'use POST', 'undo_complete_deadline refuses PATCH');
set local request.method to 'DELETE';
select throws_ok($$ select public.complete_deadline(current_setting('test.d1')::uuid) $$, 'P0001', 'use POST', 'complete_deadline refuses DELETE');
select throws_ok($$ select public.undo_complete_deadline(current_setting('test.d1')::uuid, current_setting('test.today')::date + 1) $$, 'P0001', 'use POST', 'undo_complete_deadline refuses DELETE');
set local request.method to 'POST';
select is(
  (select d.due_date from public.deadlines d where d.id = current_setting('test.d1')::uuid),
  current_setting('test.today')::date + 7,
  'nothing changed with the refused methods'
);
select is(
  public.complete_deadline(current_setting('test.d1')::uuid, current_setting('test.today')::date + 20),
  current_setting('test.today')::date + 7,
  'with POST «Fatta» works'
);
select lives_ok(
  $$ select public.undo_complete_deadline(current_setting('test.d1')::uuid, current_setting('test.today')::date + 7) $$,
  'with POST «Annulla» works'
);
set local request.method to '';

-- ---------------------------------------------------------------------------
-- «Solo io» (CA-11): only the author marks it «Fatta»
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok(
  $$ select set_config('test.laura', public.create_deadline(
       p_title => 'Abbonamento della palestra', p_due_date => current_setting('test.today')::date + 20,
       p_is_private => true, p_recurrence => 'yearly'
     )::text, true) $$,
  'Laura saves a «Solo io» deadline «Ogni anno»'
);

set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select public.complete_deadline(current_setting('test.laura')::uuid) $$,
  '42501', 'deadline not available',
  'CA-11: Marco (administrator) cannot mark «Fatta» the «Solo io» of Laura'
);
select throws_ok(
  $$ select public.complete_deadline(current_setting('test.laura')::uuid, current_setting('test.today')::date + 40) $$,
  '42501', 'deadline not available',
  'CA-11: not even with a chosen date'
);
select throws_ok(
  $$ select public.undo_complete_deadline(current_setting('test.laura')::uuid, current_setting('test.today')::date + 1) $$,
  '42501', 'deadline not available',
  'CA-11: Marco cannot «Annulla» on it either'
);
select throws_ok(
  $$ select public.complete_deadline('a5000000-0000-4000-8000-0000000000ff') $$,
  '42501', 'deadline not available',
  'the same error for a deadline that does not exist'
);
select throws_ok(
  $$ select public.complete_deadline(null) $$,
  '42501', 'deadline not available',
  'the same error without an id'
);
select is_empty(
  $$ select d.id from public.deadlines d where d.id = current_setting('test.laura')::uuid $$,
  'Marco does not see the «Solo io» of Laura'
);
select is_empty(
  $$ update public.deadlines set due_date = current_setting('test.today')::date + 2
     where id = current_setting('test.laura')::uuid returning id $$,
  'Marco changes 0 rows of the «Solo io» of Laura'
);

set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}';
select is(
  (select d.due_date from public.deadlines d where d.id = current_setting('test.laura')::uuid),
  current_setting('test.today')::date + 20,
  'CA-11: the «Solo io» of Laura did not change'
);
select is(
  public.complete_deadline(current_setting('test.laura')::uuid),
  current_setting('test.today')::date + 20,
  'Laura marks her «Solo io» «Fatta»'
);
select is(
  (select d.due_date from public.deadlines d where d.id = current_setting('test.laura')::uuid),
  (current_setting('test.today')::date + interval '1 year')::date,
  'and it moves to one year from today'
);
select lives_ok(
  $$ select public.undo_complete_deadline(current_setting('test.laura')::uuid, current_setting('test.today')::date + 20) $$,
  'Laura uses «Annulla»'
);

-- ---------------------------------------------------------------------------
-- Casa Bianchi on Casa D'Angelo (CA-12), administrator included
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select public.complete_deadline(current_setting('test.d1')::uuid) $$,
  '42501', 'deadline not available',
  'CA-12: Giulia (administrator of B) cannot mark «Fatta» a deadline of A'
);
select throws_ok(
  $$ select public.complete_deadline(current_setting('test.d1')::uuid, current_setting('test.today')::date + 40) $$,
  '42501', 'deadline not available',
  'CA-12: not even with a chosen date'
);
select throws_ok(
  $$ select public.undo_complete_deadline(current_setting('test.d1')::uuid, current_setting('test.today')::date + 1) $$,
  '42501', 'deadline not available',
  'CA-12: Giulia cannot «Annulla» on a deadline of A'
);
select throws_ok(
  $$ select public.complete_deadline(current_setting('test.never')::uuid) $$,
  '42501', 'deadline not available',
  'a deadline «Mai» of A gives the same error (nothing about it is revealed)'
);
select throws_ok(
  $$ select public.complete_deadline('b5000000-0000-4000-8000-000000000002') $$,
  '42501', 'deadline not available',
  'Giulia: the «Solo io» of Paolo gives the same error'
);
select throws_ok(
  $$ select public.update_deadline(current_setting('test.d1')::uuid, 'Intrusione', current_setting('test.today')::date + 1,
       array[]::uuid[], null, null, false, array[]::smallint[], 'yearly', null) $$,
  'P0002', null,
  'Giulia cannot change the repetition of a deadline of A'
);
select lives_ok(
  $$ select set_config('test.b', public.create_deadline(
       p_title => 'Assicurazione della casa', p_due_date => current_setting('test.today')::date + 15,
       p_recurrence => 'every_6_months'
     )::text, true) $$,
  'Giulia saves a deadline «Ogni 6 mesi» in B'
);

set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok(
  $$ select public.complete_deadline(current_setting('test.d1')::uuid) $$,
  '42501', 'deadline not available',
  'CA-12: Paolo (B) cannot mark «Fatta» a deadline of A'
);
select is(
  public.complete_deadline(current_setting('test.b')::uuid),
  current_setting('test.today')::date + 15,
  'Paolo marks «Fatta» a shared deadline of his household created by Giulia'
);
select lives_ok(
  $$ select public.undo_complete_deadline(current_setting('test.b')::uuid, current_setting('test.today')::date + 15) $$,
  'and uses «Annulla»'
);

set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select public.complete_deadline(current_setting('test.b')::uuid) $$,
  '42501', 'deadline not available',
  'Marco (administrator of A) cannot mark «Fatta» a deadline of B'
);
select throws_ok(
  $$ select public.undo_complete_deadline(current_setting('test.b')::uuid, current_setting('test.today')::date + 1) $$,
  '42501', 'deadline not available',
  'Marco cannot «Annulla» on a deadline of B'
);

-- No household, anon
set local request.jwt.claims to '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select public.complete_deadline(current_setting('test.d1')::uuid) $$,
  '42501', 'deadline not available',
  'a user without household cannot mark «Fatta»'
);
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok(
  $$ select public.complete_deadline(current_setting('test.d1')::uuid) $$,
  '42501', null,
  'anon cannot call complete_deadline'
);
select throws_ok(
  $$ select public.undo_complete_deadline(current_setting('test.d1')::uuid, current_setting('test.today')::date + 1) $$,
  '42501', null,
  'anon cannot call undo_complete_deadline'
);

reset role;
select results_eq(
  $$ select d.id, d.due_date from public.deadlines d
     where d.id in (current_setting('test.d1')::uuid, current_setting('test.laura')::uuid, current_setting('test.b')::uuid)
     order by d.due_date $$,
  $$ values (current_setting('test.d1')::uuid, current_setting('test.today')::date + 7),
            (current_setting('test.b')::uuid, current_setting('test.today')::date + 15),
            (current_setting('test.laura')::uuid, current_setting('test.today')::date + 20) $$,
  'CA-11, CA-12: every refused attempt left the deadlines as they were'
);

-- ---------------------------------------------------------------------------
-- Reminders on the new date (CA-10), with days far in the future
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok(
  $$ select set_config('test.far', public.create_deadline(
       p_title => 'Revisione della moto', p_due_date => '2098-11-25',
       p_reminder_days => array[7]::smallint[], p_recurrence => 'monthly'
     )::text, true) $$,
  'a deadline «Ogni mese» on 25/11 with a reminder 7 days before'
);
select is(
  public.complete_deadline(current_setting('test.far')::uuid, '2098-12-18'),
  '2098-11-25'::date,
  'CA-10: moved from 25/11 to 18/12'
);
reset role;
select is(
  public.run_notification_job('deadline_reminders', '11111111-1111-4111-8111-111111111111', '2098-11-18 09:00:00+01'),
  0,
  'the job of 18/11 (7 days before the previous date) creates nothing'
);
select is_empty(
  $$ select n.id from public.notifications n where n.deadline_id = current_setting('test.far')::uuid $$,
  'CA-10: no reminder for the previous date 25/11'
);
select is(
  public.run_notification_job('deadline_reminders', '11111111-1111-4111-8111-111111111111', '2098-12-11 09:00:00+01'),
  2,
  'the job of 11/12 creates two reminders'
);
select results_eq(
  $$ select n.recipient_member_id, n.days_before from public.notifications n
     where n.deadline_id = current_setting('test.far')::uuid
     order by n.recipient_member_id $$,
  $$ values ('a1000000-0000-4000-8000-000000000001'::uuid, 7::smallint),
            ('a1000000-0000-4000-8000-000000000002', 7::smallint) $$,
  'CA-10: on 11/12 the reminder for 18/12 reaches the adults with an account'
);

select * from finish();
rollback;
