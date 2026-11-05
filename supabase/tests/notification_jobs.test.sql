-- The jobs of the notifications (issue #229, for page #39), run with
-- public.run_notification_job() by service_role for one household and a given instant, as
-- the tests of the page do; the other household never changes (review of PR #237):
-- deadlines at 9:00 (CA-12, CA-13, CA-14, CA-45), shopping at 19:00 (CA-20),
-- «Liberi insieme» at 8:00 (CA-18, CA-19, «Occupato» of someone else, shortest window,
-- empty week), the cleanup (CA-24), idempotency, and the calendar of one member used by
-- «Liberi insieme» (same rows as list_household_events).
-- Seed ids: Marco a1…01 (Casa D'Angelo, with Laura, adult without account), Giulia b1…01,
-- Paolo b1…02, Leo b1…03 (child), Anna b1…04 (adult without account) in Casa Bianchi.
-- The deadlines of the seed are deleted first: their days depend on the day the tests run.
-- Ids created here: deadlines 9b…, events 9e….
begin;
create extension if not exists pgtap with schema extensions;

select plan(67);

delete from public.deadlines;

-- ---------------------------------------------------------------------------
-- run_notification_job: arguments and methods
-- ---------------------------------------------------------------------------
set local role service_role;
select throws_ok(
  $$ select public.run_notification_job(null, '22222222-2222-4222-8222-222222222222', now()) $$,
  '22023', null,
  'a job is required'
);
select throws_ok(
  $$ select public.run_notification_job('purge', null, now()) $$,
  '22023', null,
  'a household is required: the function for the tests never touches every household'
);
select throws_ok(
  $$ select public.run_notification_job('purge', '22222222-2222-4222-8222-222222222222', null) $$,
  '22023', null,
  'an instant is required'
);
select throws_ok(
  $$ select public.run_notification_job('purge', '22222222-2222-4222-8222-222222222222', 'infinity') $$,
  '22023', null,
  'the instant is finite'
);
set local request.method to 'GET';
select throws_ok(
  $$ select public.run_notification_job('purge', '22222222-2222-4222-8222-222222222222', now()) $$,
  'P0001', 'use POST',
  'run_notification_job refuses GET'
);
set local request.method to 'HEAD';
select throws_ok(
  $$ select public.run_notification_job('purge', '22222222-2222-4222-8222-222222222222', now()) $$,
  'P0001', 'use POST',
  'run_notification_job refuses HEAD'
);
set local request.method to 'POST';
reset role;

-- ---------------------------------------------------------------------------
-- Deadlines, job of 9:00 of Tuesday 20 October 2026
-- ---------------------------------------------------------------------------
insert into public.deadlines (
  id, household_id, title, due_date, note, created_by_member_id, assignee_member_id, is_private, reminder_days
)
values
  ('9b000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'Rinnovo carta d''identità di Leo',
   '2026-10-27', 'Serve per il viaggio.', 'b1000000-0000-4000-8000-000000000001', null, false, '{30,7,1}'),
  ('9b000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', 'Revisione dell''auto',
   '2026-10-27', null, 'b1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002', false, '{30,7,1}'),
  ('9b000000-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222222', 'Rinnovo segreto',
   '2026-10-27', null, 'b1000000-0000-4000-8000-000000000002', null, true, '{30,7,1}'),
  ('9b000000-0000-4000-8000-000000000004', '22222222-2222-4222-8222-222222222222', 'Iscrizione di Leo',
   '2026-10-27', null, 'b1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000003', false, '{30,7,1}'),
  ('9b000000-0000-4000-8000-000000000005', '22222222-2222-4222-8222-222222222222', 'Abbonamento di Anna',
   '2026-10-27', null, 'b1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000004', false, '{30,7,1}'),
  ('9b000000-0000-4000-8000-000000000006', '22222222-2222-4222-8222-222222222222', 'Passaporto di Leo',
   '2026-11-19', null, 'b1000000-0000-4000-8000-000000000001', null, false, '{30,7,1}'),
  ('9b000000-0000-4000-8000-000000000007', '22222222-2222-4222-8222-222222222222', 'Bollo della moto',
   '2026-10-20', null, 'b1000000-0000-4000-8000-000000000001', null, false, '{0}'),
  ('9b000000-0000-4000-8000-000000000008', '22222222-2222-4222-8222-222222222222', 'Tassa dei rifiuti',
   '2026-10-20', null, 'b1000000-0000-4000-8000-000000000001', null, false, '{30,7,1}'),
  ('9b000000-0000-4000-8000-000000000009', '11111111-1111-4111-8111-111111111111', 'Bollo dell''auto',
   '2026-10-27', null, 'a1000000-0000-4000-8000-000000000001', null, false, '{30,7,1}');

set local role service_role;
select is(
  public.run_notification_job('deadline_reminders', '22222222-2222-4222-8222-222222222222', '2026-10-20 09:00+02'),
  12,
  'the job of 9:00 for Casa Bianchi creates 12 notifications'
);
reset role;
select is_empty(
  $$ select 1 from public.notifications n where n.household_id = '11111111-1111-4111-8111-111111111111' $$,
  'the job for Casa Bianchi creates nothing in Casa D''Angelo (its deadline is due too)'
);
set local role service_role;
select is(
  public.run_notification_job('deadline_reminders', '11111111-1111-4111-8111-111111111111', '2026-10-20 09:00+02'),
  1,
  'the same job for Casa D''Angelo creates its one notification'
);
reset role;
select results_eq(
  $$ select n.deadline_id, n.recipient_member_id, n.days_before::integer
     from public.notifications n where n.kind = 'deadline_reminder'
     order by n.deadline_id, n.recipient_member_id $$,
  $$ values
       ('9b000000-0000-4000-8000-000000000001'::uuid, 'b1000000-0000-4000-8000-000000000001'::uuid, 7),
       ('9b000000-0000-4000-8000-000000000001'::uuid, 'b1000000-0000-4000-8000-000000000002'::uuid, 7),
       ('9b000000-0000-4000-8000-000000000002'::uuid, 'b1000000-0000-4000-8000-000000000002'::uuid, 7),
       ('9b000000-0000-4000-8000-000000000003'::uuid, 'b1000000-0000-4000-8000-000000000002'::uuid, 7),
       ('9b000000-0000-4000-8000-000000000004'::uuid, 'b1000000-0000-4000-8000-000000000001'::uuid, 7),
       ('9b000000-0000-4000-8000-000000000004'::uuid, 'b1000000-0000-4000-8000-000000000002'::uuid, 7),
       ('9b000000-0000-4000-8000-000000000005'::uuid, 'b1000000-0000-4000-8000-000000000001'::uuid, 7),
       ('9b000000-0000-4000-8000-000000000005'::uuid, 'b1000000-0000-4000-8000-000000000002'::uuid, 7),
       ('9b000000-0000-4000-8000-000000000006'::uuid, 'b1000000-0000-4000-8000-000000000001'::uuid, 30),
       ('9b000000-0000-4000-8000-000000000006'::uuid, 'b1000000-0000-4000-8000-000000000002'::uuid, 30),
       ('9b000000-0000-4000-8000-000000000007'::uuid, 'b1000000-0000-4000-8000-000000000001'::uuid, 0),
       ('9b000000-0000-4000-8000-000000000007'::uuid, 'b1000000-0000-4000-8000-000000000002'::uuid, 0),
       ('9b000000-0000-4000-8000-000000000009'::uuid, 'a1000000-0000-4000-8000-000000000001'::uuid, 7) $$,
  'CA-12, CA-13, CA-14, CA-45: shared deadline to every adult with an account; assignee with an account alone; «Solo io» to the author alone; assigned to a child or to an adult without account: to every adult with an account; 30 days and the day itself; nothing without that reminder'
);
select ok(
  (select bool_and(n.created_at = '2026-10-20 09:00+02' and n.created_on = '2026-10-20' and n.read_at is null
                   and n.actor_member_id is null)
   from public.notifications n where n.kind = 'deadline_reminder'),
  'created at the instant of the job (9:00), not read, without anybody who acted'
);
set local role service_role;
select is(
  public.run_notification_job('deadline_reminders', '22222222-2222-4222-8222-222222222222', '2026-10-20 09:05+02'),
  0,
  'CA-12: run again the same day, the job creates nothing'
);
select is(
  public.run_notification_job('deadline_reminders', '22222222-2222-4222-8222-222222222222', '2026-10-21 09:00+02'),
  0,
  'CA-13: on 21 October (6 days before) no reminder is due'
);
reset role;
select is(
  (select count(*)::integer from public.notifications n where n.kind = 'deadline_reminder'),
  13,
  'still 13 deadline notifications, one per person and reminder'
);

-- CA-14: the reminder of the «Solo io» deadline of Paolo is his only.
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select results_eq(
  $$ select n.deadline_id from public.notifications n where n.kind = 'deadline_reminder' order by n.deadline_id $$,
  $$ values ('9b000000-0000-4000-8000-000000000001'::uuid), ('9b000000-0000-4000-8000-000000000004'::uuid),
            ('9b000000-0000-4000-8000-000000000005'::uuid), ('9b000000-0000-4000-8000-000000000006'::uuid),
            ('9b000000-0000-4000-8000-000000000007'::uuid) $$,
  'CA-14: Giulia reads her five reminders, never the «Solo io» deadline of Paolo'
);
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select is(
  (select count(*)::integer from public.notifications n where n.kind = 'deadline_reminder'),
  7,
  'Paolo reads his seven reminders, his «Solo io» included'
);
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select results_eq(
  $$ select n.deadline_id from public.notifications n $$,
  $$ values ('9b000000-0000-4000-8000-000000000009'::uuid) $$,
  'Marco reads only the reminder of his household'
);
reset role;

-- A deadline deleted: its reminders go with it.
delete from public.deadlines where id = '9b000000-0000-4000-8000-000000000006';
select is(
  (select count(*)::integer from public.notifications n where n.deadline_id = '9b000000-0000-4000-8000-000000000006'),
  0,
  'the reminders of a deleted deadline are deleted with it'
);

-- ---------------------------------------------------------------------------
-- Shopping, job of 19:00 (CA-20)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok(
  $$ insert into public.shopping_items (name) values ('Pane fresco'), ('Uova'), ('Farina') $$,
  'CA-20: Paolo adds three things'
);
select lives_ok($$ delete from public.shopping_items where name = 'Farina' $$, 'CA-20: Paolo removes one of them');
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$ insert into public.shopping_items (name) values ('Olio') $$, 'Giulia adds one thing');
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$ insert into public.shopping_items (name) values ('Sale') $$, 'Marco adds one thing (Laura has no account)');
reset role;

set local role service_role;
select is(
  public.run_notification_job('shopping_digest', '22222222-2222-4222-8222-222222222222', now() + interval '1 minute'),
  0,
  'CA-20: with «Spesa» off (the default) nobody is notified'
);
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$ select public.set_notification_preference('shopping', true) $$, 'CA-20: Giulia switches «Spesa» on');
reset role;
set local role service_role;
select is(
  public.run_notification_job('shopping_digest', '22222222-2222-4222-8222-222222222222', now() + interval '1 minute'),
  1,
  'CA-20: the job of 19:00 creates one notification'
);
select is(
  public.run_notification_job('shopping_digest', '22222222-2222-4222-8222-222222222222', now() + interval '1 minute'),
  0,
  'run again, it creates nothing'
);
select is(
  public.run_notification_job('shopping_digest', '22222222-2222-4222-8222-222222222222', now() + interval '25 hours'),
  0,
  'additions older than 24 hours do not count'
);
reset role;
select results_eq(
  $$ select n.household_id, n.recipient_member_id, n.actor_member_id, n.item_count
     from public.notifications n where n.kind = 'shopping_added' $$,
  $$ values ('22222222-2222-4222-8222-222222222222'::uuid, 'b1000000-0000-4000-8000-000000000001'::uuid,
             'b1000000-0000-4000-8000-000000000002'::uuid, 3) $$,
  'CA-20: Giulia is told that Paolo added 3 things (the removed one included); Paolo gets nothing, nor anybody for his own additions'
);

-- ---------------------------------------------------------------------------
-- «Liberi insieme», job of 8:00 (CA-18, CA-19)
-- Events of Casa Bianchi (adults: Giulia, Paolo, Anna without account):
--   9e…01 «Cena»      Tutto il Nest, Wednesday 21 October 18:00 – 23:00, Giulia and Paolo
--   9e…02 «Cinema»    Tutto il Nest, Thursday 22 October 18:00 – 23:00, Giulia and Paolo
--   9e…03 «Sorpresa»  Solo io of Paolo, Friday 23 October 18:00 – 23:00, nobody else
-- ---------------------------------------------------------------------------
insert into public.events (id, household_id, author_member_id, title, starts_at, ends_at, visibility)
values
  ('9e000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000001',
   'Cena', '2026-10-21 18:00+02', '2026-10-21 23:00+02', 'household'),
  ('9e000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000001',
   'Cinema', '2026-10-22 18:00+02', '2026-10-22 23:00+02', 'household'),
  ('9e000000-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000002',
   'Sorpresa', '2026-10-23 18:00+02', '2026-10-23 23:00+02', 'private');
insert into public.event_members (event_id, member_id, household_id)
values
  ('9e000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222'),
  ('9e000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222'),
  ('9e000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222'),
  ('9e000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222');
-- Casa D'Angelo (Marco and Laura, adults): one morning event of Marco in the same week,
-- so that Marco has a free evening on Wednesday 21 when the job runs for his household.
insert into public.events (id, household_id, author_member_id, title, starts_at, ends_at, visibility)
values
  ('9e000000-0000-4000-8000-000000000010', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001',
   'Colazione', '2026-10-22 08:00+02', '2026-10-22 09:00+02', 'household');

set local role service_role;
select is(
  public.run_notification_job('free_together', '22222222-2222-4222-8222-222222222222', '2026-10-20 08:00+02'),
  2,
  'CA-18: the job of 8:00 creates one notification for Giulia and one for Paolo'
);
reset role;
select results_eq(
  $$ select n.recipient_member_id, n.evening_date, n.free_from, n.created_at, n.actor_member_id is null
     from public.notifications n where n.kind = 'free_together' order by n.recipient_member_id $$,
  $$ values
       ('b1000000-0000-4000-8000-000000000001'::uuid, '2026-10-23'::date, '2026-10-23 18:00+02'::timestamptz,
        '2026-10-20 08:00+02'::timestamptz, true),
       ('b1000000-0000-4000-8000-000000000002'::uuid, '2026-10-23'::date, '2026-10-23 18:00+02'::timestamptz,
        '2026-10-20 08:00+02'::timestamptz, true) $$,
  'CA-18, CA-19: Friday 23 from 18:00 for both (busy Wednesday and Thursday; the «Solo io» of Paolo makes nobody busy); nothing for Marco, of another household'
);
set local role service_role;
select is(
  public.run_notification_job('free_together', '11111111-1111-4111-8111-111111111111', '2026-10-20 08:00+02'),
  1,
  'the same job for Casa D''Angelo creates the notification of Marco'
);
reset role;
select results_eq(
  $$ select n.household_id, n.recipient_member_id, n.evening_date, n.free_from
     from public.notifications n
     where n.kind = 'free_together' and n.household_id = '11111111-1111-4111-8111-111111111111' $$,
  $$ values ('11111111-1111-4111-8111-111111111111'::uuid, 'a1000000-0000-4000-8000-000000000001'::uuid,
             '2026-10-21'::date, '2026-10-21 18:00+02'::timestamptz) $$,
  'Marco: Wednesday 21 from 18:00, only in his household'
);
set local role service_role;
select is(
  public.run_notification_job('free_together', '22222222-2222-4222-8222-222222222222', '2026-10-20 08:10+02'),
  0,
  'CA-18: run again the same day, it creates nothing'
);
select is(
  public.run_notification_job('free_together', '22222222-2222-4222-8222-222222222222', '2026-10-21 08:00+02'),
  2,
  'the job of Wednesday 21 announces the next evening not yet announced'
);
reset role;
select results_eq(
  $$ select n.recipient_member_id, n.evening_date, count(*)::integer
     from public.notifications n
     where n.kind = 'free_together' and n.household_id = '22222222-2222-4222-8222-222222222222'
     group by n.recipient_member_id, n.evening_date
     order by n.recipient_member_id, n.evening_date $$,
  $$ values
       ('b1000000-0000-4000-8000-000000000001'::uuid, '2026-10-23'::date, 1),
       ('b1000000-0000-4000-8000-000000000001'::uuid, '2026-10-24'::date, 1),
       ('b1000000-0000-4000-8000-000000000002'::uuid, '2026-10-23'::date, 1),
       ('b1000000-0000-4000-8000-000000000002'::uuid, '2026-10-24'::date, 1) $$,
  'CA-18: no second notification for Friday 23; Saturday 24 is the next one'
);
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select is(
  (select count(*)::integer from public.notifications n where n.kind = 'free_together'),
  2,
  'Giulia reads her two «Liberi insieme»'
);
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select results_eq(
  $$ select n.recipient_member_id from public.notifications n where n.kind = 'free_together' $$,
  $$ values ('a1000000-0000-4000-8000-000000000001'::uuid) $$,
  'Marco reads only his own «Liberi insieme», none of Casa Bianchi'
);
reset role;

-- An «Occupato» of Paolo without Giulia: Giulia sees only that Paolo is busy, which still
-- shortens the window. Paolo has «Liberi insieme» off. Week of Monday 2 November (CET).
--   9e…04 «Visita»  Occupato of Paolo, Tuesday 3 November 18:00 – 20:00, nobody else
insert into public.events (id, household_id, author_member_id, title, starts_at, ends_at, visibility)
values
  ('9e000000-0000-4000-8000-000000000004', '22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000002',
   'Visita', '2026-11-03 18:00+01', '2026-11-03 20:00+01', 'busy');
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok($$ select public.set_notification_preference('free_together', false) $$, 'Paolo switches «Liberi insieme» off');

-- The calendar of one member is exactly what that member reads with list_household_events.
reset role;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
-- Since #266 the job reads private.household_event_rows_for_member() (the rows behind
-- list_household_events_with_source, with «conta per Liberi insieme»).
select results_eq(
  $$ select * from public.list_household_events_with_source('2026-10-19 00:00+02', '2026-11-09 00:00+01') $$,
  $$ select r.id, r.starts_at, r.ends_at, r.visibility, r.author_member_id, r.is_masked, r.title, r.location,
            r.escort_member_id, r.member_ids, r.source_provider, r.is_imported, r.counts_for_free_time
     from private.household_event_rows_for_member('b1000000-0000-4000-8000-000000000001',
       '2026-10-19 00:00+02', '2026-11-09 00:00+01') r
     order by r.starts_at, r.ends_at, r.event_id $$,
  'the calendar used by the job for Giulia is the one she reads (the «Occupato» of Paolo masked, his «Solo io» absent)'
);
select results_eq(
  $$ select * from public.list_household_events('2026-10-19 00:00+02', '2026-11-09 00:00+01') $$,
  $$ select * from private.household_events_for_member('b1000000-0000-4000-8000-000000000001',
       '2026-10-19 00:00+02', '2026-11-09 00:00+01') $$,
  'list_household_events gives the same rows to Giulia'
);
select ok(
  exists (
    select 1 from private.household_events_for_member('b1000000-0000-4000-8000-000000000001',
      '2026-11-02 00:00+01', '2026-11-09 00:00+01') e
    where e.is_masked and e.id is null and e.title is null and e.author_member_id = 'b1000000-0000-4000-8000-000000000002'
  )
  and not exists (
    select 1 from private.household_events_for_member('b1000000-0000-4000-8000-000000000001',
      '2026-10-19 00:00+02', '2026-10-26 00:00+01') e
    where e.starts_at = '2026-10-23 18:00+02'
  ),
  'Giulia: the «Occupato» of Paolo without any detail, his «Solo io» not at all'
);
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select results_eq(
  $$ select * from public.list_household_events_with_source('2026-10-19 00:00+02', '2026-11-09 00:00+01') $$,
  $$ select r.id, r.starts_at, r.ends_at, r.visibility, r.author_member_id, r.is_masked, r.title, r.location,
            r.escort_member_id, r.member_ids, r.source_provider, r.is_imported, r.counts_for_free_time
     from private.household_event_rows_for_member('b1000000-0000-4000-8000-000000000002',
       '2026-10-19 00:00+02', '2026-11-09 00:00+01') r
     order by r.starts_at, r.ends_at, r.event_id $$,
  'the calendar used by the job for Paolo is the one he reads (his «Solo io» and «Occupato» in full)'
);
select results_eq(
  $$ select * from public.list_household_events('2026-10-19 00:00+02', '2026-11-09 00:00+01') $$,
  $$ select * from private.household_events_for_member('b1000000-0000-4000-8000-000000000002',
       '2026-10-19 00:00+02', '2026-11-09 00:00+01') $$,
  'list_household_events gives the same rows to Paolo'
);
set local request.jwt.claims to '{}';

set local role service_role;
select is(
  public.run_notification_job('free_together', '22222222-2222-4222-8222-222222222222', '2026-11-02 08:00+01'),
  1,
  'the job of Monday 2 November creates one notification (Paolo has it off)'
);
reset role;
select results_eq(
  $$ select n.recipient_member_id, n.evening_date, n.free_from
     from public.notifications n where n.kind = 'free_together' and n.created_on = '2026-11-02' $$,
  $$ values ('b1000000-0000-4000-8000-000000000001'::uuid, '2026-11-03'::date, '2026-11-03 20:00+01'::timestamptz) $$,
  'Giulia: Tuesday 3 from 20:00, after the «Occupato» of Paolo (daylight saving time over)'
);

-- Shortest window and ties. Week of Monday 9 November.
--   Tuesday 10: Giulia 18:00 – 22:30 (only 30 minutes left: no window)
--   Wednesday 11: Giulia 18:00 – 19:00, 20:00 – 21:00, 22:00 – 23:00 (two windows of one
--   hour: the earliest)
insert into public.events (id, household_id, author_member_id, title, starts_at, ends_at, visibility)
values
  ('9e000000-0000-4000-8000-000000000005', '22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000001',
   'Lungo', '2026-11-10 18:00+01', '2026-11-10 22:30+01', 'household'),
  ('9e000000-0000-4000-8000-000000000006', '22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000001',
   'Primo', '2026-11-11 18:00+01', '2026-11-11 19:00+01', 'household'),
  ('9e000000-0000-4000-8000-000000000007', '22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000001',
   'Secondo', '2026-11-11 20:00+01', '2026-11-11 21:00+01', 'household'),
  ('9e000000-0000-4000-8000-000000000008', '22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000001',
   'Terzo', '2026-11-11 22:00+01', '2026-11-11 23:00+01', 'household');
insert into public.event_members (event_id, member_id, household_id)
select e.id, 'b1000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222'
from public.events e
where e.id in ('9e000000-0000-4000-8000-000000000005', '9e000000-0000-4000-8000-000000000006',
               '9e000000-0000-4000-8000-000000000007', '9e000000-0000-4000-8000-000000000008');

set local role service_role;
select is(
  public.run_notification_job('free_together', '22222222-2222-4222-8222-222222222222', '2026-11-09 08:00+01'),
  1,
  'the job of Monday 9 November creates one notification'
);
reset role;
select results_eq(
  $$ select n.evening_date, n.free_from
     from public.notifications n where n.kind = 'free_together' and n.created_on = '2026-11-09' $$,
  $$ values ('2026-11-11'::date, '2026-11-11 19:00+01'::timestamptz) $$,
  'less than 60 minutes is not a window; with two windows of the same length, the earliest'
);

-- A week with nothing visible: no window (rule of the calendar).
set local role service_role;
select is(
  public.run_notification_job('free_together', '22222222-2222-4222-8222-222222222222', '2026-11-16 08:00+01'),
  0,
  'nothing visible in the week of the evening: no «Liberi insieme»'
);
reset role;

-- One adult only: Casa D'Angelo without Laura, with an event of Marco in the week.
delete from public.invitations where member_id = 'a1000000-0000-4000-8000-000000000002';
delete from public.household_members where id = 'a1000000-0000-4000-8000-000000000002';
insert into public.events (id, household_id, author_member_id, title, starts_at, ends_at, visibility)
values
  ('9e000000-0000-4000-8000-000000000009', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001',
   'Palestra', '2026-11-17 10:00+01', '2026-11-17 11:00+01', 'household');
set local role service_role;
select is(
  public.run_notification_job('free_together', '11111111-1111-4111-8111-111111111111', '2026-11-16 08:00+01'),
  0,
  'a household with one adult has no «Liberi insieme»'
);
reset role;
select is(
  (select count(*)::integer from public.notifications n where n.recipient_member_id = 'a1000000-0000-4000-8000-000000000001'
     and n.kind = 'free_together' and n.created_on = '2026-11-16'),
  0,
  'Marco, the only adult left, gets none'
);

-- ---------------------------------------------------------------------------
-- Cleanup (CA-24)
-- ---------------------------------------------------------------------------
insert into public.notifications (household_id, recipient_member_id, kind, actor_member_id, item_count, created_at)
values
  ('22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000001', 'shopping_added',
   'b1000000-0000-4000-8000-000000000002', 2, now() - interval '31 days'),
  ('22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000001', 'shopping_added',
   'b1000000-0000-4000-8000-000000000002', 5, now() - interval '29 days');
insert into private.shopping_additions (household_id, member_id, created_at)
values ('22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000001', now() - interval '3 days');
-- The same in Casa D'Angelo: the cleanup of Casa Bianchi must not touch them.
insert into public.notifications (household_id, recipient_member_id, kind, deadline_id, days_before, created_at)
values ('11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001', 'deadline_reminder',
        '9b000000-0000-4000-8000-000000000009', 30, now() - interval '31 days');
insert into private.shopping_additions (household_id, member_id, created_at)
values ('11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001', now() - interval '3 days');

set local role service_role;
select ok(
  public.run_notification_job('purge', '22222222-2222-4222-8222-222222222222', now()) >= 1,
  'CA-24: the cleanup of Casa Bianchi deletes its old notifications'
);
reset role;
select ok(
  exists (select 1 from public.notifications n
          where n.household_id = '11111111-1111-4111-8111-111111111111' and n.created_at < now() - interval '30 days')
  and exists (select 1 from private.shopping_additions s
              where s.household_id = '11111111-1111-4111-8111-111111111111' and s.created_at < now() - interval '2 days'),
  'the cleanup of Casa Bianchi deletes nothing of Casa D''Angelo'
);
set local role service_role;
select ok(
  public.run_notification_job('purge', '11111111-1111-4111-8111-111111111111', now()) >= 1,
  'the cleanup of Casa D''Angelo deletes its old notifications'
);
reset role;
select is_empty(
  $$ select 1 from public.notifications n where n.created_at < now() - interval '30 days' $$,
  'after both cleanups no notification older than 30 days is left'
);
select results_eq(
  $$ select n.item_count from public.notifications n
     where n.kind = 'shopping_added' and n.created_at < now() - interval '1 day' $$,
  $$ values (5) $$,
  'CA-24: the notification of 31 days ago is deleted, the one of 29 days ago stays'
);
select is(
  (select count(*)::integer from public.notifications n where n.created_at >= now() - interval '30 days'
     and n.kind = 'shopping_added'),
  2,
  'the recent notifications stay'
);
select is(
  (select count(*)::integer from private.shopping_additions s where s.created_at < now() - interval '2 days'),
  0,
  'the shopping additions older than 2 days are deleted'
);
select is(
  (select count(*)::integer from private.shopping_additions s where s.created_at = now()),
  5,
  'the recent shopping additions stay'
);

-- ---------------------------------------------------------------------------
-- The hourly job of pg_cron: the hour of Rome decides, in winter (CET, UTC+1) and in
-- summer (CEST, UTC+2). Last section: these runs touch every household.
-- ---------------------------------------------------------------------------
select has_function('private', 'run_scheduled_notification_jobs', array['timestamp with time zone'],
  'the scheduled entry point exists');
select is(
  private.run_scheduled_notification_jobs('2026-11-03 07:00Z'),
  'free_together'::public.notification_job,
  'winter: 07:00 UTC is 8:00 in Rome, «Liberi insieme»'
);
select is(
  private.run_scheduled_notification_jobs('2026-07-15 06:00Z'),
  'free_together'::public.notification_job,
  'summer: 06:00 UTC is 8:00 in Rome, «Liberi insieme»'
);
select is(
  private.run_scheduled_notification_jobs('2026-07-15 07:00Z'),
  'deadline_reminders'::public.notification_job,
  'summer: 07:00 UTC is 9:00 in Rome, the deadlines'
);
select is(
  private.run_scheduled_notification_jobs('2026-01-15 18:00Z'),
  'shopping_digest'::public.notification_job,
  'winter: 18:00 UTC is 19:00 in Rome, the shopping'
);
select is(
  private.run_scheduled_notification_jobs('2026-07-15 01:00Z'),
  'purge'::public.notification_job,
  'summer: 01:00 UTC is 3:00 in Rome, the cleanup'
);
select is(
  private.run_scheduled_notification_jobs('2026-11-03 06:00Z'),
  null::public.notification_job,
  'winter: 06:00 UTC is 7:00 in Rome, no job'
);
select lives_ok(
  $$ select private.run_scheduled_notification_jobs() $$,
  'the scheduled entry point runs now as the database owner, like pg_cron'
);
select ok(
  (select p.prosecdef = false from pg_proc p where p.oid = 'private.run_scheduled_notification_jobs(timestamptz)'::regprocedure),
  'the scheduled entry point is not security definer (pg_cron runs it as the owner)'
);

select * from finish();
rollback;
