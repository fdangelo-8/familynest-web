-- notifications (issue #229, for page #39): schema, privileges, RLS for every role
-- (recipient, other adult of the same household, other household, user without household,
-- anon), the triggers that write («Da fare assegnato», «Cambio d'orario», shopping
-- additions), the privacy of «Occupato» and «Solo io» (CA-14 in the jobs test, CA-16,
-- CA-21), the page functions (mark_notifications_read, count_unread_notifications) and the
-- cleanup when someone leaves the household (CA-48).
-- The jobs (8:00, 9:00, 19:00, cleanup) are in notification_jobs.test.sql.
-- Seed ids: A = Marco (Casa D'Angelo), B = Giulia (Casa Bianchi, admin), B2 = Paolo (Casa
-- Bianchi), C = Chiara (no household). Members of Casa Bianchi: Giulia b1…01, Paolo b1…02,
-- Leo b1…03 (child), Anna b1…04 (adult without account). The seed has no notifications.
-- Ids created here: events 9c…, notifications 9d….
begin;
create extension if not exists pgtap with schema extensions;

select plan(156);

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------
select has_table('public', 'notifications', 'notifications exists');
select ok(
  (select c.relrowsecurity from pg_class c where c.oid = 'public.notifications'::regclass),
  'RLS enabled on notifications'
);
select columns_are(
  'public', 'notifications',
  array['id', 'household_id', 'recipient_member_id', 'kind', 'actor_member_id', 'todo_id', 'deadline_id',
        'event_id', 'occurrence_date', 'days_before', 'evening_date', 'free_from', 'item_count', 'read_at',
        'created_at', 'created_on', 'updated_at'],
  'notifications has exactly the planned columns (references and numbers, no free text)'
);
select is_empty(
  $$ select a.attname
     from pg_attribute a
     where a.attrelid = 'public.notifications'::regclass
       and a.attnum > 0
       and not a.attisdropped
       and a.atttypid in ('text'::regtype, 'varchar'::regtype, 'jsonb'::regtype, 'json'::regtype) $$,
  'no text or json column in notifications (titles and names are never copied)'
);
select enum_has_labels(
  'public', 'notification_kind',
  array['todo_assigned', 'deadline_reminder', 'free_together', 'event_time_changed', 'shopping_added'],
  'the five kinds of notification of #39'
);
select enum_has_labels(
  'public', 'notification_job',
  array['free_together', 'deadline_reminders', 'shopping_digest', 'purge'],
  'the four jobs'
);
select fk_ok(
  'public', 'notifications', 'household_id', 'public', 'households', 'id',
  'notifications.household_id references households'
);
select fk_ok(
  'public', 'notifications', array['recipient_member_id', 'household_id'],
  'public', 'household_members', array['id', 'household_id'],
  'the recipient is a member of the same household'
);
select fk_ok(
  'public', 'notifications', array['actor_member_id', 'household_id'],
  'public', 'household_members', array['id', 'household_id'],
  'who acted is a member of the same household'
);
select fk_ok(
  'public', 'notifications', array['todo_id', 'household_id'],
  'public', 'todos', array['id', 'household_id'],
  'the thing to do belongs to the same household'
);
select fk_ok(
  'public', 'notifications', array['deadline_id', 'household_id'],
  'public', 'deadlines', array['id', 'household_id'],
  'the deadline belongs to the same household'
);
select fk_ok(
  'public', 'notifications', array['event_id', 'household_id'],
  'public', 'events', array['id', 'household_id'],
  'the event belongs to the same household'
);
select is(
  (select array_agg(k.confdeltype::text order by k.conname)
   from pg_constraint k
   where k.conrelid = 'public.notifications'::regclass and k.contype = 'f'),
  array['c', 'c', 'c', 'c', 'c', 'c'],
  'every foreign key of notifications is on delete cascade (household, recipient, who acted, element of origin)'
);
select has_index('public', 'notifications', 'notifications_recipient_created_idx', 'index on recipient and time');
select has_index('public', 'notifications', 'notifications_household_id_idx', 'index on household_id');
select has_index('public', 'notifications', 'notifications_actor_member_id_idx', 'index on actor_member_id');
select has_index('public', 'notifications', 'notifications_todo_id_idx', 'index on todo_id');
select has_index('public', 'notifications', 'notifications_deadline_id_idx', 'index on deadline_id');
select has_index('public', 'notifications', 'notifications_event_id_idx', 'index on event_id');
select has_index('public', 'notifications', 'notifications_created_at_idx', 'index for the cleanup');
select ok(
  not exists (
    select 1 from pg_publication_tables p
    where p.pubname = 'supabase_realtime' and p.schemaname = 'public' and p.tablename = 'notifications'
  ),
  'notifications are not sent in real time'
);
select has_table('private', 'shopping_additions', 'private.shopping_additions exists');
select columns_are(
  'private', 'shopping_additions',
  array['id', 'household_id', 'member_id', 'created_at'],
  'the shopping additions keep only who and when'
);
select ok(
  (select c.relrowsecurity from pg_class c where c.oid = 'private.shopping_additions'::regclass),
  'RLS enabled on private.shopping_additions'
);
select has_function('public', 'mark_notifications_read', array['uuid[]'], 'mark_notifications_read exists');
select has_function('public', 'count_unread_notifications', 'count_unread_notifications exists');
select has_function(
  'public', 'run_notification_job', array['notification_job', 'timestamp with time zone'],
  'run_notification_job exists'
);
select ok(
  (select p.prosecdef from pg_proc p where p.oid = 'public.mark_notifications_read(uuid[])'::regprocedure)
  and not (select p.prosecdef from pg_proc p where p.oid = 'public.count_unread_notifications()'::regprocedure)
  and (select p.provolatile = 's' from pg_proc p where p.oid = 'public.count_unread_notifications()'::regprocedure),
  'mark_notifications_read is security definer; the count runs as the caller (RLS) and never writes'
);
select ok(
  (select bool_and(p.prosecdef)
   from pg_proc p
   where p.oid in (
     'private.todos_notify_assignee()'::regprocedure,
     'private.events_notify_time_change()'::regprocedure,
     'private.event_exceptions_notify_time_change()'::regprocedure,
     'private.shopping_items_record_addition()'::regprocedure
   )),
  'the triggers that write notifications are security definer (search_path checked in 00_schema)'
);
select has_trigger('public', 'todos', 'todos_notify_assignee', 'trigger on todos');
select has_trigger('public', 'events', 'events_notify_time_change', 'trigger on events');
select has_trigger('public', 'event_exceptions', 'event_exceptions_notify_time_change', 'trigger on event_exceptions');
select has_trigger('public', 'shopping_items', 'shopping_items_record_addition', 'trigger on shopping_items');
select has_trigger('public', 'notifications', 'notifications_set_updated_at', 'updated_at is kept by the database');
select results_eq(
  $$ select j.schedule, j.command, j.active from cron.job j where j.jobname = 'notification-jobs' $$,
  $$ values ('0 * * * *'::text, 'select private.run_scheduled_notification_jobs();'::text, true) $$,
  'pg_cron runs the jobs at minute 0 of every hour (the hour of Rome decides)'
);

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
select ok(
  not has_table_privilege('anon', 'public.notifications', 'select, insert, update, delete'),
  'anon has no privilege on notifications'
);
select ok(
  has_table_privilege('authenticated', 'public.notifications', 'select')
  and not has_table_privilege('authenticated', 'public.notifications', 'insert')
  and not has_table_privilege('authenticated', 'public.notifications', 'update')
  and not has_table_privilege('authenticated', 'public.notifications', 'delete')
  and not has_any_column_privilege('authenticated', 'public.notifications', 'insert')
  and not has_any_column_privilege('authenticated', 'public.notifications', 'update'),
  'the app only reads notifications: no insert, update or delete, on any column'
);
select ok(
  not has_table_privilege('anon', 'private.shopping_additions', 'select, insert, update, delete')
  and not has_table_privilege('authenticated', 'private.shopping_additions', 'select, insert, update, delete')
  and not has_table_privilege('service_role', 'private.shopping_additions', 'select, insert, update, delete'),
  'no API role has a privilege on the shopping additions'
);
select ok(
  not has_function_privilege('anon', 'public.mark_notifications_read(uuid[])', 'execute')
  and not has_function_privilege('anon', 'public.count_unread_notifications()', 'execute')
  and has_function_privilege('authenticated', 'public.mark_notifications_read(uuid[])', 'execute')
  and has_function_privilege('authenticated', 'public.count_unread_notifications()', 'execute'),
  'only signed-in users mark and count their notifications'
);
select ok(
  not has_function_privilege('anon', 'public.run_notification_job(public.notification_job, timestamptz)', 'execute')
  and not has_function_privilege('authenticated', 'public.run_notification_job(public.notification_job, timestamptz)', 'execute')
  and has_function_privilege('service_role', 'public.run_notification_job(public.notification_job, timestamptz)', 'execute'),
  'the jobs for the tests: service_role only'
);
select ok(
  not has_function_privilege('authenticated', 'private.todos_notify_assignee()', 'execute')
  and not has_function_privilege('authenticated', 'private.events_notify_time_change()', 'execute')
  and not has_function_privilege('authenticated', 'private.event_exceptions_notify_time_change()', 'execute')
  and not has_function_privilege('authenticated', 'private.shopping_items_record_addition()', 'execute')
  and not has_function_privilege('authenticated', 'private.notification_recipient_wants(uuid, public.notification_preference)', 'execute')
  and not has_function_privilege('authenticated', 'private.notification_actor(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'private.household_events_for_member(uuid, timestamptz, timestamptz)', 'execute')
  and not has_function_privilege('authenticated', 'private.free_together_start(uuid, date)', 'execute')
  and not has_function_privilege('authenticated', 'private.notifications_free_together(timestamptz)', 'execute')
  and not has_function_privilege('authenticated', 'private.notifications_deadline_reminders(timestamptz)', 'execute')
  and not has_function_privilege('authenticated', 'private.notifications_shopping_digest(timestamptz)', 'execute')
  and not has_function_privilege('authenticated', 'private.purge_notifications(timestamptz)', 'execute')
  and not has_function_privilege('authenticated', 'private.run_scheduled_notification_jobs()', 'execute'),
  'triggers, helpers and jobs cannot be called by the app'
);
select ok(
  has_function_privilege('authenticated', 'private.notification_is_visible(public.notification_kind, uuid, uuid, uuid, date)', 'execute')
  and not has_function_privilege('anon', 'private.notification_is_visible(public.notification_kind, uuid, uuid, uuid, date)', 'execute'),
  'the visibility check of the select policy is evaluated as the reader'
);
select policies_are(
  'public', 'notifications', array['notifications_select'],
  'notifications has only a select policy (no direct write)'
);

-- ---------------------------------------------------------------------------
-- Seed: no notifications, no recorded additions (the seed has no session)
-- ---------------------------------------------------------------------------
select is_empty($$ select 1 from public.notifications $$, 'the seed has no notifications');
select is_empty($$ select 1 from private.shopping_additions $$, 'the seed records no shopping addition');

-- ---------------------------------------------------------------------------
-- Constraints (rows written by the database owner)
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.notifications (household_id, recipient_member_id, kind, todo_id)
     values ('22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000001', 'todo_assigned',
             'b4000000-0000-4000-8000-000000000002') $$,
  '23514', null,
  'a «Da fare assegnato» always has who assigned it'
);
select throws_ok(
  $$ insert into public.notifications (household_id, recipient_member_id, kind, actor_member_id, todo_id)
     values ('22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000001', 'todo_assigned',
             'b1000000-0000-4000-8000-000000000001', 'b4000000-0000-4000-8000-000000000002') $$,
  '23514', null,
  'nobody is notified of what they did themselves'
);
select throws_ok(
  $$ insert into public.notifications (household_id, recipient_member_id, kind, actor_member_id, item_count, todo_id)
     values ('22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000001', 'shopping_added',
             'b1000000-0000-4000-8000-000000000002', 2, 'b4000000-0000-4000-8000-000000000002') $$,
  '23514', null,
  'a notification has only the fields of its kind'
);
select throws_ok(
  $$ insert into public.notifications (household_id, recipient_member_id, kind, actor_member_id, todo_id)
     values ('22222222-2222-4222-8222-222222222222', 'a1000000-0000-4000-8000-000000000001', 'todo_assigned',
             'b1000000-0000-4000-8000-000000000002', 'b4000000-0000-4000-8000-000000000002') $$,
  '23503', null,
  'the recipient cannot be a member of another household'
);
select throws_ok(
  $$ insert into public.notifications (household_id, recipient_member_id, kind, actor_member_id, todo_id)
     values ('22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000001', 'todo_assigned',
             'b1000000-0000-4000-8000-000000000002', 'a4000000-0000-4000-8000-000000000001') $$,
  '23503', null,
  'the thing to do cannot belong to another household'
);
select throws_ok(
  $$ insert into public.notifications (household_id, recipient_member_id, kind, evening_date, free_from)
     values ('22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000001', 'free_together',
             '2026-10-23', '2026-10-24 18:00+02') $$,
  '23514', null,
  'the window of «Liberi insieme» starts on its evening'
);

-- ---------------------------------------------------------------------------
-- «Da fare assegnato» (CA-9, CA-10, CA-11)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';

select lives_ok(
  $$ insert into public.todos (title, assignee_member_id, due_date)
     values ('Firmare autorizzazione gita', 'b1000000-0000-4000-8000-000000000001', '2026-10-23') $$,
  'CA-9: Paolo creates a thing to do assigned to Giulia'
);
reset role;
select results_eq(
  $$ select n.household_id, n.recipient_member_id, n.kind::text, n.actor_member_id, t.title, n.read_at is null,
            n.created_at = now(), n.created_on = (now() at time zone 'Europe/Rome')::date
     from public.notifications n
     join public.todos t on t.id = n.todo_id $$,
  $$ values ('22222222-2222-4222-8222-222222222222'::uuid, 'b1000000-0000-4000-8000-000000000001'::uuid,
             'todo_assigned', 'b1000000-0000-4000-8000-000000000002'::uuid, 'Firmare autorizzazione gita',
             true, true, true) $$,
  'CA-9: one notification for Giulia, from Paolo, about that thing, not read, created now'
);
set local role authenticated;

select lives_ok(
  $$ insert into public.todos (title, assignee_member_id) values ('Per Leo', 'b1000000-0000-4000-8000-000000000003') $$,
  'CA-10: Paolo assigns a thing to Leo (a child)'
);
select lives_ok(
  $$ insert into public.todos (title) values ('Per nessuno') $$,
  'CA-10: Paolo creates a thing without assignee'
);
select lives_ok(
  $$ insert into public.todos (title, assignee_member_id) values ('Per Anna', 'b1000000-0000-4000-8000-000000000004') $$,
  'Paolo assigns a thing to Anna (adult without account)'
);
select lives_ok(
  $$ insert into public.todos (title, assignee_member_id, is_private)
     values ('Segreto di Paolo', 'b1000000-0000-4000-8000-000000000002', true) $$,
  'Paolo creates a «Solo io» thing for himself'
);
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok(
  $$ insert into public.todos (title, assignee_member_id) values ('Per me stessa', 'b1000000-0000-4000-8000-000000000001') $$,
  'CA-10: Giulia assigns a thing to herself'
);
reset role;
select is(
  (select count(*)::integer from public.notifications),
  1,
  'CA-10: children, nobody, adults without account, oneself and «Solo io» get no notification'
);
set local role authenticated;

-- Changing the assignee notifies the new one; changing anything else does not.
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok(
  $$ update public.todos set assignee_member_id = 'b1000000-0000-4000-8000-000000000001' where title = 'Per Leo' $$,
  'Paolo moves «Per Leo» from Leo to Giulia'
);
select lives_ok(
  $$ update public.todos set title = 'Per Leo, poi Giulia' where title = 'Per Leo' $$,
  'Paolo changes only the title'
);
select lives_ok(
  $$ update public.todos set assignee_member_id = 'b1000000-0000-4000-8000-000000000002' where title = 'Per me stessa' $$,
  'Paolo takes Giulia''s thing for himself'
);
reset role;
select results_eq(
  $$ select t.title, n.recipient_member_id
     from public.notifications n join public.todos t on t.id = n.todo_id
     order by t.title $$,
  $$ values ('Firmare autorizzazione gita', 'b1000000-0000-4000-8000-000000000001'::uuid),
            ('Per Leo, poi Giulia', 'b1000000-0000-4000-8000-000000000001'::uuid) $$,
  'a new assignee is notified once; other changes and taking a thing for oneself notify nobody'
);
set local role authenticated;

-- CA-11: «Da fare assegnati a me» off.
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$ select public.set_notification_preference('assigned_todos', false) $$, 'CA-11: Giulia switches «Da fare assegnati a me» off');
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok(
  $$ insert into public.todos (title, assignee_member_id) values ('Con interruttore spento', 'b1000000-0000-4000-8000-000000000001') $$,
  'CA-11: Paolo assigns a thing to Giulia'
);
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$ select public.set_notification_preference('assigned_todos', true) $$, 'CA-11: Giulia switches it on again');
reset role;
select is(
  (select count(*)::integer from public.notifications),
  2,
  'CA-11: no notification while the switch is off, and switching on does not bring it back'
);

-- ---------------------------------------------------------------------------
-- Reading: only the recipient (CA-37, CA-38)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select is(
  (select count(*)::integer from public.notifications),
  2,
  'Giulia reads her two notifications'
);
select is(public.count_unread_notifications(), 2, 'CA-28: the bell of Giulia counts 2 new');

set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select is_empty($$ select 1 from public.notifications $$, 'CA-37: Paolo, in the same household, reads none of Giulia''s notifications');
select is(public.count_unread_notifications(), 0, 'CA-37: the bell of Paolo counts 0');
select lives_ok(
  $$ select public.mark_notifications_read(array(select n.id from public.notifications n)
       || array['00000000-0000-4000-8000-000000000000'::uuid]) $$,
  'CA-37: Paolo marks read ids he does not see'
);

set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select is_empty($$ select 1 from public.notifications $$, 'CA-38: Marco (other household) reads none');
select is(public.count_unread_notifications(), 0, 'CA-38: the bell of Marco counts 0');

set local request.jwt.claims to '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}';
select is_empty($$ select 1 from public.notifications $$, 'a user without household reads none');
select is(public.count_unread_notifications(), 0, 'a user without household counts 0');
select throws_ok(
  $$ select public.mark_notifications_read(array['00000000-0000-4000-8000-000000000000'::uuid]) $$,
  '42501', null,
  'a user without household cannot mark anything'
);

reset role;
-- Paolo tried with the real ids of Giulia: still unread.
select ok(
  (select bool_and(n.read_at is null) from public.notifications n),
  'CA-37: the notifications of Giulia are still not read after the attempt of Paolo'
);
-- Same for the ids of Giulia passed explicitly by another user (kept in a setting of the
-- test transaction, readable by every role).
do $$
begin
  perform set_config(
    'test.giulia_ids',
    (select string_agg(n.id::text, ',') from public.notifications n
     where n.recipient_member_id = 'b1000000-0000-4000-8000-000000000001'),
    true
  );
end;
$$;
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok(
  $$ select public.mark_notifications_read(string_to_array(current_setting('test.giulia_ids'), ',')::uuid[]) $$,
  'CA-37: Paolo sends the ids of Giulia'
);
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok(
  $$ select public.mark_notifications_read(string_to_array(current_setting('test.giulia_ids'), ',')::uuid[]) $$,
  'CA-38: Marco sends the ids of Giulia'
);
reset role;
select ok(
  (select bool_and(n.read_at is null) from public.notifications n),
  'CA-37, CA-38: nobody else can mark the notifications of Giulia as read'
);

-- anon
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok($$ select count(*) from public.notifications $$, '42501', null, 'anon cannot read notifications');
select throws_ok($$ select public.count_unread_notifications() $$, '42501', null, 'anon cannot count notifications');
select throws_ok(
  $$ select public.mark_notifications_read(string_to_array(current_setting('test.giulia_ids'), ',')::uuid[]) $$,
  '42501', null,
  'anon cannot mark notifications'
);
select throws_ok(
  $$ select public.run_notification_job('purge', now()) $$,
  '42501', null,
  'anon cannot run a job'
);
reset role;

-- ---------------------------------------------------------------------------
-- Direct writes are refused (CA-39)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ insert into public.notifications (household_id, recipient_member_id, kind, actor_member_id, item_count)
     values ('22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000001', 'shopping_added',
             'b1000000-0000-4000-8000-000000000002', 1) $$,
  '42501', null,
  'CA-39: the app cannot insert a notification'
);
select throws_ok(
  $$ update public.notifications set recipient_member_id = 'b1000000-0000-4000-8000-000000000002' $$,
  '42501', null,
  'CA-39: the app cannot change the recipient'
);
select throws_ok(
  $$ update public.notifications set kind = 'shopping_added' $$,
  '42501', null,
  'CA-39: the app cannot change the kind'
);
select throws_ok(
  $$ update public.notifications set todo_id = null $$,
  '42501', null,
  'CA-39: the app cannot change the element of origin'
);
select throws_ok(
  $$ update public.notifications set read_at = now() $$,
  '42501', null,
  'the app cannot set read_at directly (only mark_notifications_read)'
);
select throws_ok($$ delete from public.notifications $$, '42501', null, 'the app cannot delete notifications');
select throws_ok(
  $$ select public.run_notification_job('purge', now()) $$,
  '42501', null,
  'a signed-in user cannot run a job'
);

-- ---------------------------------------------------------------------------
-- mark_notifications_read: arguments and methods (lesson of #112)
-- ---------------------------------------------------------------------------
select throws_ok($$ select public.mark_notifications_read(null) $$, '22023', null, 'the list of ids is required');
select throws_ok(
  $$ select public.mark_notifications_read(array[null]::uuid[]) $$,
  '22023', null,
  'a list with null is refused'
);
select throws_ok(
  $$ select public.mark_notifications_read(array(select gen_random_uuid() from generate_series(1, 201))) $$,
  '22023', null,
  'at most 200 ids per call'
);
set local request.method to 'GET';
select throws_ok(
  $$ select public.mark_notifications_read(string_to_array(current_setting('test.giulia_ids'), ',')::uuid[]) $$,
  'P0001', 'use POST',
  'mark_notifications_read refuses GET'
);
set local request.method to 'HEAD';
select throws_ok(
  $$ select public.mark_notifications_read(string_to_array(current_setting('test.giulia_ids'), ',')::uuid[]) $$,
  'P0001', 'use POST',
  'mark_notifications_read refuses HEAD'
);
set local request.method to 'PUT';
select throws_ok(
  $$ select public.mark_notifications_read(string_to_array(current_setting('test.giulia_ids'), ',')::uuid[]) $$,
  'P0001', 'use POST',
  'mark_notifications_read refuses PUT'
);
reset role;
select ok(
  (select bool_and(n.read_at is null) from public.notifications n),
  'nothing was marked by the refused calls'
);
set local role authenticated;
set local request.method to 'POST';

select lives_ok(
  $$ select public.mark_notifications_read(array(
       select n.id from public.notifications n join public.todos t on t.id = n.todo_id
       where t.title = 'Firmare autorizzazione gita')) $$,
  'CA-30: Giulia marks one notification read'
);
select is(public.count_unread_notifications(), 1, 'the bell counts 1 new');
select results_eq(
  $$ select t.title, n.read_at is not null from public.notifications n join public.todos t on t.id = n.todo_id order by t.title $$,
  $$ values ('Firmare autorizzazione gita', true), ('Per Leo, poi Giulia', false) $$,
  'only the marked notification is read'
);
reset role;
select ok(
  (select n.read_at = now() and n.updated_at = now()
   from public.notifications n join public.todos t on t.id = n.todo_id
   where t.title = 'Firmare autorizzazione gita'),
  'read now, updated_at kept by the database'
);
set local role authenticated;
select lives_ok(
  $$ select public.mark_notifications_read(string_to_array(current_setting('test.giulia_ids'), ',')::uuid[]) $$,
  'marking again, with one already read, gives no error'
);
select is(public.count_unread_notifications(), 0, 'CA-30: all read, the bell counts 0');
select lives_ok($$ select public.mark_notifications_read(array[]::uuid[]) $$, 'an empty list changes nothing');

-- ---------------------------------------------------------------------------
-- CA-21: deleted or become «Solo io»: not shown and not counted
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok(
  $$ insert into public.todos (title, assignee_member_id) values ('Da cancellare', 'b1000000-0000-4000-8000-000000000001'),
                                                                ('Da nascondere', 'b1000000-0000-4000-8000-000000000001') $$,
  'Paolo assigns two more things to Giulia'
);
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select is(public.count_unread_notifications(), 2, 'the bell of Giulia counts the 2 new');
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok($$ delete from public.todos where title = 'Da cancellare' $$, 'CA-21: Paolo deletes one thing');
select lives_ok(
  $$ update public.todos set is_private = true, assignee_member_id = null where title = 'Da nascondere' $$,
  'CA-21: Paolo makes the other «Solo io», without assignee'
);
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select is(public.count_unread_notifications(), 0, 'CA-21: the bell does not count them');
select is(
  (select count(*)::integer from public.notifications),
  2,
  'CA-21: Giulia reads only the two notifications whose thing she still sees'
);
reset role;
select is(
  (select count(*)::integer from public.notifications n where n.kind = 'todo_assigned'),
  3,
  'the notification of the deleted thing is deleted with it'
);
select is(
  (select count(*)::integer from public.notifications n join public.todos t on t.id = n.todo_id where t.title = 'Da nascondere'),
  1,
  'the notification of the thing become «Solo io» stays in the database, hidden'
);

-- ---------------------------------------------------------------------------
-- «Cambio d'orario» (CA-15, CA-16, CA-17, CA-46, CA-47)
-- Events created by the owner, with Paolo as author (Casa Bianchi):
--   9c…01 «Nuoto»        Tutto il Nest, participants Giulia and Paolo
--   9c…02 «Visita»       Occupato, no participant
--   9c…03 «Regalo»       Solo io, no participant
--   9c…04 «Riunione»     Occupato, participant Giulia
--   9c…05 «Piscina Leo»  Tutto il Nest, participant Leo only
--   9c…06 «Calcio Leo»   Tutto il Nest, participant Leo, escort Giulia
--   9c…07 «Inglese»      Tutto il Nest, every Monday 17:00, participants Giulia and Paolo
-- ---------------------------------------------------------------------------
insert into public.events (
  id, household_id, author_member_id, title, starts_at, ends_at, visibility, escort_member_id,
  recurrence, recurrence_weekdays
)
values
  ('9c000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000002',
   'Nuoto', '2026-10-21 17:00+02', '2026-10-21 18:00+02', 'household', null, 'none', null),
  ('9c000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000002',
   'Visita', '2026-10-21 10:00+02', '2026-10-21 11:00+02', 'busy', null, 'none', null),
  ('9c000000-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000002',
   'Regalo', '2026-10-21 11:00+02', '2026-10-21 12:00+02', 'private', null, 'none', null),
  ('9c000000-0000-4000-8000-000000000004', '22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000002',
   'Riunione', '2026-10-21 14:00+02', '2026-10-21 15:00+02', 'busy', null, 'none', null),
  ('9c000000-0000-4000-8000-000000000005', '22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000002',
   'Piscina Leo', '2026-10-22 17:00+02', '2026-10-22 18:00+02', 'household', null, 'none', null),
  ('9c000000-0000-4000-8000-000000000006', '22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000002',
   'Calcio Leo', '2026-10-22 15:00+02', '2026-10-22 16:00+02', 'household', 'b1000000-0000-4000-8000-000000000001',
   'none', null),
  ('9c000000-0000-4000-8000-000000000007', '22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000002',
   'Inglese', '2026-10-19 17:00+02', '2026-10-19 18:00+02', 'household', null, 'weekly', '{1}');
insert into public.event_members (event_id, member_id, household_id)
values
  ('9c000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222'),
  ('9c000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222'),
  ('9c000000-0000-4000-8000-000000000004', 'b1000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222'),
  ('9c000000-0000-4000-8000-000000000005', 'b1000000-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222222'),
  ('9c000000-0000-4000-8000-000000000006', 'b1000000-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222222'),
  ('9c000000-0000-4000-8000-000000000007', 'b1000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222'),
  ('9c000000-0000-4000-8000-000000000007', 'b1000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222');
select is_empty(
  $$ select 1 from public.notifications where kind = 'event_time_changed' $$,
  'events created without a session notify nobody'
);

set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok(
  $$ update public.events set starts_at = '2026-10-22 17:30+02', ends_at = '2026-10-22 18:30+02'
     where id = '9c000000-0000-4000-8000-000000000001' $$,
  'CA-15: Paolo moves «Nuoto» to Thursday 17:30'
);
select lives_ok(
  $$ update public.events set starts_at = '2026-10-21 10:30+02', ends_at = '2026-10-21 11:30+02'
     where id in ('9c000000-0000-4000-8000-000000000002', '9c000000-0000-4000-8000-000000000003') $$,
  'CA-16: Paolo moves his «Occupato» and his «Solo io» without Giulia'
);
select lives_ok(
  $$ update public.events set ends_at = '2026-10-21 16:00+02' where id = '9c000000-0000-4000-8000-000000000004' $$,
  'CA-16: Paolo changes the end of his «Occupato» with Giulia as participant'
);
select lives_ok(
  $$ update public.events set starts_at = '2026-10-22 17:15+02', ends_at = '2026-10-22 18:15+02'
     where id = '9c000000-0000-4000-8000-000000000005' $$,
  'Paolo moves «Piscina Leo», in which Giulia is not involved'
);
select lives_ok(
  $$ update public.events set starts_at = '2026-10-22 15:30+02', ends_at = '2026-10-22 16:30+02'
     where id = '9c000000-0000-4000-8000-000000000006' $$,
  'Paolo moves «Calcio Leo», where Giulia is the escort'
);
select lives_ok(
  $$ update public.events set title = 'Nuoto libero', location = 'Piscina' where id = '9c000000-0000-4000-8000-000000000001' $$,
  'Paolo changes title and place of «Nuoto libero», not the time'
);
reset role;
select results_eq(
  $$ select n.event_id, n.recipient_member_id, n.actor_member_id, n.occurrence_date
     from public.notifications n where n.kind = 'event_time_changed' order by n.event_id $$,
  $$ values
       ('9c000000-0000-4000-8000-000000000001'::uuid, 'b1000000-0000-4000-8000-000000000001'::uuid,
        'b1000000-0000-4000-8000-000000000002'::uuid, null::date),
       ('9c000000-0000-4000-8000-000000000004'::uuid, 'b1000000-0000-4000-8000-000000000001'::uuid,
        'b1000000-0000-4000-8000-000000000002'::uuid, null::date),
       ('9c000000-0000-4000-8000-000000000006'::uuid, 'b1000000-0000-4000-8000-000000000001'::uuid,
        'b1000000-0000-4000-8000-000000000002'::uuid, null::date) $$,
  'CA-15, CA-16: Giulia is notified for the events she sees in full as participant or escort; never Paolo, never for the «Occupato» and «Solo io» she is not in, nor for an event she is not involved in, nor for a title change'
);
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select results_eq(
  $$ select n.event_id from public.notifications n where n.kind = 'event_time_changed' order by n.event_id $$,
  $$ values ('9c000000-0000-4000-8000-000000000001'::uuid), ('9c000000-0000-4000-8000-000000000004'::uuid),
            ('9c000000-0000-4000-8000-000000000006'::uuid) $$,
  'CA-16: Giulia reads the three, the «Occupato» she takes part in included'
);
select is(public.count_unread_notifications(), 3, 'the bell counts the three');

-- Giulia moves an event herself: Paolo (participant) is notified, not Giulia.
select lives_ok(
  $$ update public.events set starts_at = '2026-10-22 17:45+02', ends_at = '2026-10-22 18:45+02'
     where id = '9c000000-0000-4000-8000-000000000001' $$,
  'Giulia moves «Nuoto libero» again'
);
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select results_eq(
  $$ select n.event_id, n.actor_member_id from public.notifications n $$,
  $$ values ('9c000000-0000-4000-8000-000000000001'::uuid, 'b1000000-0000-4000-8000-000000000001'::uuid) $$,
  'Paolo, author and participant, reads the notification of the change made by Giulia'
);

-- CA-17: «Impegni e cambi d'orario» off.
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$ select public.set_notification_preference('events', false) $$, 'CA-17: Giulia switches «Impegni» off');
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok(
  $$ update public.events set starts_at = '2026-10-22 18:00+02', ends_at = '2026-10-22 19:00+02'
     where id = '9c000000-0000-4000-8000-000000000001' $$,
  'CA-17: Paolo moves «Nuoto libero»'
);
reset role;
select is(
  (select count(*)::integer from public.notifications n
   where n.kind = 'event_time_changed' and n.recipient_member_id = 'b1000000-0000-4000-8000-000000000001'),
  3,
  'CA-17: no new notification for Giulia while the switch is off'
);
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$ select public.set_notification_preference('events', true) $$, 'Giulia switches «Impegni» on again');

-- One occurrence of «Inglese» («Salva solo questo»).
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok(
  $$ select public.update_event_occurrence('9c000000-0000-4000-8000-000000000007', '2026-10-26', 'Inglese',
       '2026-10-26 18:30+01', '2026-10-26 19:30+01', null, null, null) $$,
  'Paolo moves only the occurrence of Monday 26 to 18:30'
);
select lives_ok(
  $$ select public.update_event_occurrence('9c000000-0000-4000-8000-000000000007', '2026-10-26', 'Inglese avanzato',
       '2026-10-26 18:30+01', '2026-10-26 19:30+01', 'Aula 2', null, null) $$,
  'Paolo changes only title and place of that occurrence'
);
select lives_ok(
  $$ select public.update_event_occurrence('9c000000-0000-4000-8000-000000000007', '2026-11-02', 'Inglese con test',
       '2026-11-02 17:00+01', '2026-11-02 18:00+01', null, null, null) $$,
  'Paolo changes the title of the occurrence of Monday 2 November, at the time of the series'
);
reset role;
select results_eq(
  $$ select n.recipient_member_id, n.occurrence_date
     from public.notifications n
     where n.kind = 'event_time_changed' and n.event_id = '9c000000-0000-4000-8000-000000000007' $$,
  $$ values ('b1000000-0000-4000-8000-000000000001'::uuid, '2026-10-26'::date) $$,
  'one notification for Giulia with the day of the moved occurrence; title, place and unchanged times notify nobody'
);
set local role authenticated;
select lives_ok(
  $$ select public.delete_event_occurrence('9c000000-0000-4000-8000-000000000007', '2026-10-26', 'this') $$,
  'Paolo removes that occurrence'
);
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select is_empty(
  $$ select 1 from public.notifications n where n.event_id = '9c000000-0000-4000-8000-000000000007' $$,
  'the notification of a removed occurrence is not shown'
);
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok(
  $$ select * from public.update_event('9c000000-0000-4000-8000-000000000007', null, 'Inglese',
       '2026-10-19 18:00+02', '2026-10-19 19:00+02', 'household',
       array['b1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002']::uuid[],
       null, null, 'weekly', '{1}', null, null) $$,
  'CA-46: Paolo moves the whole series of «Inglese» to 18:00'
);
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select results_eq(
  $$ select n.actor_member_id, n.occurrence_date from public.notifications n
     where n.event_id = '9c000000-0000-4000-8000-000000000007' $$,
  $$ values ('b1000000-0000-4000-8000-000000000002'::uuid, null::date) $$,
  'CA-46: Giulia reads one notification for the whole series'
);

-- CA-47: new and deleted events notify nobody.
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok(
  $$ select public.create_event('Corsa', '2026-10-24 09:00+02', '2026-10-24 10:00+02', 'household',
       array['b1000000-0000-4000-8000-000000000001']::uuid[]) $$,
  'CA-47: Paolo creates an event with Giulia'
);
select lives_ok(
  $$ delete from public.events where id = '9c000000-0000-4000-8000-000000000005' $$,
  'CA-47: Paolo deletes an event'
);
reset role;
select is(
  (select count(*)::integer from public.notifications n where n.kind = 'event_time_changed'),
  6,
  'CA-47: no notification for a new or a deleted event'
);

-- Privacy: Giulia is removed from the «Occupato» of Paolo: she no longer sees it in full,
-- and its notification is no longer shown.
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok(
  $$ delete from public.event_members
     where event_id = '9c000000-0000-4000-8000-000000000004' and member_id = 'b1000000-0000-4000-8000-000000000001' $$,
  'Paolo removes Giulia from his «Occupato»'
);
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select is_empty(
  $$ select 1 from public.notifications n where n.event_id = '9c000000-0000-4000-8000-000000000004' $$,
  'CA-16: the «Occupato» of someone else, no longer seen in full, has no visible notification'
);
select is(public.count_unread_notifications(), 3, 'the bell counts only the visible ones');

-- ---------------------------------------------------------------------------
-- Shopping additions are recorded for the job of 19:00 (only who and when)
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok(
  $$ insert into public.shopping_items (name) values ('Pasta'), ('Riso') $$,
  'Paolo adds two things to the shopping list'
);
reset role;
select results_eq(
  $$ select s.household_id, s.member_id, s.created_at = now() from private.shopping_additions s $$,
  $$ values ('22222222-2222-4222-8222-222222222222'::uuid, 'b1000000-0000-4000-8000-000000000002'::uuid, true),
            ('22222222-2222-4222-8222-222222222222'::uuid, 'b1000000-0000-4000-8000-000000000002'::uuid, true) $$,
  'each addition through the app is recorded with who and when'
);
set local request.jwt.claims to '{}';
insert into public.shopping_items (household_id, name, added_by_member_id)
values ('22222222-2222-4222-8222-222222222222', 'Zucchero', 'b1000000-0000-4000-8000-000000000001');
select is(
  (select count(*)::integer from private.shopping_additions),
  2,
  'an item inserted without a session is not an addition'
);

-- ---------------------------------------------------------------------------
-- count_unread_notifications: last 30 days, at most the 100 most recent
-- ---------------------------------------------------------------------------
insert into public.notifications (household_id, recipient_member_id, kind, actor_member_id, item_count, created_at)
values
  ('22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000001', 'shopping_added',
   'b1000000-0000-4000-8000-000000000002', 1, now() - interval '31 days'),
  ('22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000001', 'shopping_added',
   'b1000000-0000-4000-8000-000000000002', 1, now() - interval '29 days');
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select is(public.count_unread_notifications(), 4, 'CA-24: the bell counts the one of 29 days ago, not the one of 31 days ago');
reset role;
insert into public.notifications (household_id, recipient_member_id, kind, actor_member_id, todo_id, created_at)
select '22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000001', 'todo_assigned',
       'b1000000-0000-4000-8000-000000000002', t.id, now() - make_interval(mins => g)
from public.todos t, generate_series(1, 120) as g
where t.title = 'Firmare autorizzazione gita'
  and t.household_id = '22222222-2222-4222-8222-222222222222';
set local role authenticated;
-- The 100 most recent: the 3 unread of the events, the 2 read of the things to do (created
-- now) and 95 of the 120: 98 not read.
select is(public.count_unread_notifications(), 98, 'the bell counts only among the 100 most recent, as the page shows');
reset role;
delete from public.notifications n where n.created_at < now() and n.kind = 'todo_assigned' and n.created_at > now() - interval '3 hours';

-- ---------------------------------------------------------------------------
-- CA-48: who acted leaves the household; the recipient leaves the household
-- ---------------------------------------------------------------------------
select ok(
  (select count(*) from public.notifications n where n.actor_member_id = 'b1000000-0000-4000-8000-000000000002') > 0
  and (select count(*) from public.notifications n where n.recipient_member_id = 'b1000000-0000-4000-8000-000000000002') > 0,
  'before: notifications from Paolo and for Paolo'
);
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok(
  $$ delete from public.household_members where id = 'b1000000-0000-4000-8000-000000000002' $$,
  'CA-48: Giulia (administrator) removes Paolo from the household'
);
select is(public.count_unread_notifications(), 0, 'CA-48: the bell of Giulia no longer counts what Paolo did');
select is_empty($$ select 1 from public.notifications $$, 'CA-48: Giulia no longer reads them');
reset role;
select is_empty(
  $$ select 1 from public.notifications n
     where n.actor_member_id = 'b1000000-0000-4000-8000-000000000002'
        or n.recipient_member_id = 'b1000000-0000-4000-8000-000000000002' $$,
  'CA-48: the notifications of what Paolo did and those for Paolo are deleted with him'
);
select is_empty(
  $$ select 1 from private.shopping_additions s where s.member_id = 'b1000000-0000-4000-8000-000000000002' $$,
  'the shopping additions of Paolo are deleted with him'
);

-- The household is deleted: nothing is left.
insert into public.notifications (household_id, recipient_member_id, kind, evening_date, free_from)
values ('22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000001', 'free_together',
        '2026-10-23', '2026-10-23 18:00+02');
delete from public.households where id = '22222222-2222-4222-8222-222222222222';
select is_empty($$ select 1 from public.notifications $$, 'the notifications go with the household');

select * from finish();
rollback;
