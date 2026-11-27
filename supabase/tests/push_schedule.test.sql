-- When the phone rings and what it says (issue #511, DB-2 of plan #501, part 2):
-- private.push_schedule() through the trigger on notifications (CA-27 – CA-31), the
-- summaries of private.push_digests() (CA-27, CA-32), the morning digest
-- get_morning_digest() (CA-33, the digest part of CA-40), get_push_content() for an
-- event_reminder and for the two summaries (CA-36 – CA-38).
-- Seed ids: Marco (Casa D'Angelo, admin, user aaaaaaaa…01, member a1…01), Laura a1…02,
-- Sofia a1…03; Giulia (Casa Bianchi, bbbbbbbb…01, b1…01). This test gives Laura an account
-- (user aaaaaaaa…02) and adds a third adult, Davide (a1…06, user aaaaaaaa…03). The things
-- to do and the deadlines of the seed of Casa D'Angelo are deleted first (their dates
-- follow the real day). Created here: thing to do f1…, events ca…, notifications d9…,
-- devices cb…. The notifications are written by the database owner with the instant of the
-- case (as the jobs do); the changes of time with the session of Marco.
-- Dates: December 2026 (future), Europe/Rome (+01): Tue 1, Wed 2, Thu 3, Fri 4, Sat 5,
-- Mon 7. The changes of time of CA-28 use the real time (within 24 hours or 3 days later).
begin;
create extension if not exists pgtap with schema extensions;

select plan(53);

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-4000-8000-000000000002', 'authenticated',
   'authenticated', 'utente-laura@example.com', '{"full_name":"Laura Test"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-4000-8000-000000000003', 'authenticated',
   'authenticated', 'utente-davide@example.com', '{"full_name":"Davide Test"}', now(), now());
update public.household_members
set user_id = 'aaaaaaaa-0000-4000-8000-000000000002', joined_at = now()
where id = 'a1000000-0000-4000-8000-000000000002';
insert into public.household_members (id, household_id, kind, name, color, user_id, joined_at)
values ('a1000000-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111', 'adult', 'Davide',
        'lampone', 'aaaaaaaa-0000-4000-8000-000000000003', now());
delete from public.todos where household_id = '11111111-1111-4111-8111-111111111111';
delete from public.deadlines where household_id = '11111111-1111-4111-8111-111111111111';
update public.profiles set morning_digest_time = '07:15', morning_digest_weekdays = '{1,2,3,4,5}'
where id in ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000002',
             'aaaaaaaa-0000-4000-8000-000000000003');

insert into public.todos (id, household_id, title, created_by_member_id)
values ('f1000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Comprare il pane',
        'a1000000-0000-4000-8000-000000000001');

-- Laura has a browser; Marco no device yet.
insert into public.push_subscriptions (id, household_id, member_id, platform, endpoint, p256dh, auth)
values ('cb000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
        'a1000000-0000-4000-8000-000000000002', 'web', 'https://fcm.googleapis.com/fcm/send/laura-511',
        repeat('L', 87), repeat('l', 22));

-- ---------------------------------------------------------------------------
-- CA-27: «Subito quelle per me» (the default): at 15:00 a thing to do and the shopping
-- ---------------------------------------------------------------------------
insert into public.notifications (id, household_id, recipient_member_id, kind, actor_member_id, todo_id, item_count,
                                  created_at)
values
  ('d9000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000002',
   'todo_assigned', 'a1000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000001', null,
   '2026-12-01 15:00+01'),
  ('d9000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000002',
   'shopping_added', 'a1000000-0000-4000-8000-000000000001', null, 2, '2026-12-01 15:00+01');
select results_eq(
  $$ select d.notification_id, d.due_at from private.push_deliveries d where d.kind = 'single' $$,
  $$ values ('d9000000-0000-4000-8000-000000000001'::uuid, '2026-12-01 15:00+01'::timestamptz) $$,
  'CA-27: only the thing to do rings at once, at 15:00'
);
select results_eq(
  $$ select i.notification_id, i.delivery_id from private.push_digest_items i $$,
  $$ values ('d9000000-0000-4000-8000-000000000002'::uuid, null::uuid) $$,
  'CA-27: the shopping waits for the summary'
);
select is(
  public.run_notification_job('push_digests', '11111111-1111-4111-8111-111111111111', '2026-12-01 18:55+01'),
  0,
  'CA-27: before 19:00, no summary'
);
select is(
  public.run_notification_job('push_digests', '11111111-1111-4111-8111-111111111111', '2026-12-01 19:00+01'),
  1,
  'CA-27: at 19:00, one summary'
);
select results_eq(
  $$ select d.recipient_member_id, d.digest_day, d.due_at from private.push_deliveries d where d.kind = 'evening_digest' $$,
  $$ values ('a1000000-0000-4000-8000-000000000002'::uuid, '2026-12-01'::date, '2026-12-01 19:00+01'::timestamptz) $$,
  'CA-27: the evening summary of Laura, at 19:00'
);
select ok(
  (select i.delivery_id = d.id
   from private.push_digest_items i
   join private.push_deliveries d on d.kind = 'evening_digest'
   where i.notification_id = 'd9000000-0000-4000-8000-000000000002'),
  'CA-27: the summary carries the shopping'
);
select is(
  public.run_notification_job('push_digests', '11111111-1111-4111-8111-111111111111', '2026-12-01 19:05+01'),
  0,
  'run again, no second summary'
);
-- What the summary says.
update private.push_deliveries set claim_token = 'ee000000-0000-4000-8000-000000000001',
                                   claimed_until = now() + interval '5 minutes'
where kind = 'evening_digest';
select set_config('test.evening', (select d.id::text from private.push_deliveries d where d.kind = 'evening_digest'), true);
set local role service_role;
select results_eq(
  $$ select c.notification_id, c.kind::text, c.person_name, c.item_count, c.is_hidden
     from public.get_push_content(current_setting('test.evening')::uuid, 'ee000000-0000-4000-8000-000000000001') c $$,
  $$ values ('d9000000-0000-4000-8000-000000000002'::uuid, 'shopping_added', 'Marco', 2, false) $$,
  'CA-27: the summary says that Marco added two things'
);
reset role;

-- ---------------------------------------------------------------------------
-- CA-28: «Ogni avviso» and «Solo il riepilogo»
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok($$ select public.set_notification_options('each', null, null) $$, 'CA-28: Laura chooses «Ogni avviso»');
reset role;
insert into public.notifications (id, household_id, recipient_member_id, kind, actor_member_id, todo_id, item_count,
                                  created_at)
values
  ('d9000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000002',
   'todo_assigned', 'a1000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000001', null,
   '2026-12-02 15:00+01'),
  ('d9000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000002',
   'shopping_added', 'a1000000-0000-4000-8000-000000000006', null, 1, '2026-12-02 15:00+01');
select results_eq(
  $$ select d.notification_id from private.push_deliveries d
     where d.notification_id in ('d9000000-0000-4000-8000-000000000003', 'd9000000-0000-4000-8000-000000000004')
     order by d.notification_id $$,
  $$ values ('d9000000-0000-4000-8000-000000000003'::uuid), ('d9000000-0000-4000-8000-000000000004'::uuid) $$,
  'CA-28: with «Ogni avviso» both ring at once'
);

set local role authenticated;
select lives_ok($$ select public.set_notification_options('digest_only', null, null) $$, 'CA-28: Laura chooses «Solo il riepilogo»');
reset role;
insert into public.notifications (id, household_id, recipient_member_id, kind, actor_member_id, todo_id, item_count,
                                  created_at)
values
  ('d9000000-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000002',
   'todo_assigned', 'a1000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000001', null,
   '2026-12-03 15:00+01'),
  ('d9000000-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000002',
   'shopping_added', 'a1000000-0000-4000-8000-000000000006', null, 1, '2026-12-03 15:00+01');
select is_empty(
  $$ select 1 from private.push_deliveries d
     where d.notification_id in ('d9000000-0000-4000-8000-000000000005', 'd9000000-0000-4000-8000-000000000006') $$,
  'CA-28: with «Solo il riepilogo» none rings at once'
);
select is(
  (select count(*)::integer from private.push_digest_items i
   where i.notification_id in ('d9000000-0000-4000-8000-000000000005', 'd9000000-0000-4000-8000-000000000006')
     and i.delivery_id is null),
  2,
  'CA-28: both wait for the summary'
);

-- A change of time of an occurrence within 24 hours rings at once in every way; three days
-- later it waits. U1 and U2: «Tutto il Nest» of Marco with Laura, at the real time.
insert into public.events (id, household_id, author_member_id, title, starts_at, ends_at, visibility, recurrence)
values
  ('ca000000-0000-4000-8000-000000000091', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001',
   'Prova vicina', date_trunc('hour', now()) + interval '6 hours', date_trunc('hour', now()) + interval '7 hours',
   'household', 'none'),
  ('ca000000-0000-4000-8000-000000000092', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001',
   'Prova lontana', date_trunc('hour', now()) + interval '3 days', date_trunc('hour', now()) + interval '3 days 1 hour',
   'household', 'none');
insert into public.event_members (event_id, member_id, household_id)
values
  ('ca000000-0000-4000-8000-000000000091', 'a1000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111'),
  ('ca000000-0000-4000-8000-000000000092', 'a1000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111');
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok(
  $$ update public.events set starts_at = starts_at + interval '30 minutes', ends_at = ends_at + interval '30 minutes'
     where id in ('ca000000-0000-4000-8000-000000000091', 'ca000000-0000-4000-8000-000000000092') $$,
  'CA-28: Marco moves both by half an hour'
);
reset role;
select ok(
  exists (
    select 1
    from public.notifications n
    join private.push_deliveries d on d.notification_id = n.id and d.kind = 'single'
    where n.kind = 'event_time_changed'
      and n.recipient_member_id = 'a1000000-0000-4000-8000-000000000002'
      and n.event_id = 'ca000000-0000-4000-8000-000000000091'
  ),
  'CA-28: with «Solo il riepilogo», the change of an occurrence within 24 hours rings at once'
);
select ok(
  exists (
    select 1
    from public.notifications n
    join private.push_digest_items i on i.notification_id = n.id
    where n.kind = 'event_time_changed'
      and n.event_id = 'ca000000-0000-4000-8000-000000000092'
  )
  and not exists (
    select 1
    from public.notifications n
    join private.push_deliveries d on d.notification_id = n.id
    where n.event_id = 'ca000000-0000-4000-8000-000000000092'
  ),
  'the change of an occurrence three days later waits for the summary'
);
delete from public.events
where id in ('ca000000-0000-4000-8000-000000000091', 'ca000000-0000-4000-8000-000000000092');

-- ---------------------------------------------------------------------------
-- CA-29: the silence of the night (Laura back to «Subito quelle per me»)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok($$ select public.set_notification_options('mine_now', null, null) $$, 'Laura chooses «Subito quelle per me»');
reset role;
insert into public.notifications (id, household_id, recipient_member_id, kind, actor_member_id, todo_id, created_at)
values ('d9000000-0000-4000-8000-000000000007', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000002',
        'todo_assigned', 'a1000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000001',
        '2026-12-01 23:10+01');
select is(
  (select d.due_at from private.push_deliveries d where d.notification_id = 'd9000000-0000-4000-8000-000000000007'),
  '2026-12-02 07:00+01'::timestamptz,
  'CA-29: with the silence on, the thing to do of 23:10 rings at 7:00 of the day after'
);
set local role authenticated;
select lives_ok($$ select public.set_notification_preference('quiet_hours', false) $$, 'CA-29: Laura switches the silence off');
reset role;
insert into public.notifications (id, household_id, recipient_member_id, kind, actor_member_id, todo_id, created_at)
values ('d9000000-0000-4000-8000-000000000008', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000002',
        'todo_assigned', 'a1000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000001',
        '2026-12-01 23:10+01');
insert into public.notifications (id, household_id, recipient_member_id, kind, actor_member_id, created_at)
values ('d9000000-0000-4000-8000-000000000009', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000002',
        'member_joined', 'a1000000-0000-4000-8000-000000000006', '2026-12-01 23:10+01');
select is(
  (select d.due_at from private.push_deliveries d where d.notification_id = 'd9000000-0000-4000-8000-000000000008'),
  '2026-12-01 23:10+01'::timestamptz,
  'CA-29: with the silence off, it rings at 23:10'
);
select is(
  (select d.due_at from private.push_deliveries d where d.notification_id = 'd9000000-0000-4000-8000-000000000009'),
  '2026-12-02 07:00+01'::timestamptz,
  'CA-29: a member_joined of 23:10 rings at 7:00 also with the silence off (ap1-34)'
);
set local role authenticated;
select lives_ok($$ select public.set_notification_preference('quiet_hours', true) $$, 'Laura switches the silence on again');
reset role;

-- ---------------------------------------------------------------------------
-- CA-30: a reminder already past at 7:00 does not ring
--   R1 Ritiro   busy, Laura, Sofia, Laura picks up, Wed 2/12 22:00–23:30
--   R2 Visita   busy, Laura, Laura, Wed 2/12 8:00–9:00
-- ---------------------------------------------------------------------------
insert into public.events (id, household_id, author_member_id, title, starts_at, ends_at, visibility, recurrence,
                           pickup_member_id)
values
  ('ca000000-0000-4000-8000-000000000011', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000002',
   'Ritiro', '2026-12-02 22:00+01', '2026-12-02 23:30+01', 'busy', 'none', 'a1000000-0000-4000-8000-000000000002'),
  ('ca000000-0000-4000-8000-000000000012', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000002',
   'Visita', '2026-12-02 08:00+01', '2026-12-02 09:00+01', 'busy', 'none', null);
insert into public.event_members (event_id, member_id, household_id)
values
  ('ca000000-0000-4000-8000-000000000011', 'a1000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111'),
  ('ca000000-0000-4000-8000-000000000012', 'a1000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111');
insert into public.notifications (id, household_id, recipient_member_id, kind, event_id, occurrence_date, ride_leg,
                                  days_before, created_at)
values ('d9000000-0000-4000-8000-000000000010', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000002',
        'ride_reminder', 'ca000000-0000-4000-8000-000000000011', '2026-12-02', 'pickup', 0, '2026-12-02 22:30+01');
insert into public.notifications (id, household_id, recipient_member_id, kind, event_id, occurrence_date, created_at)
values ('d9000000-0000-4000-8000-000000000011', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000002',
        'event_reminder', 'ca000000-0000-4000-8000-000000000012', '2026-12-02', '2026-12-02 06:30+01');
select ok(
  not exists (select 1 from private.push_deliveries d where d.notification_id = 'd9000000-0000-4000-8000-000000000010')
  and not exists (select 1 from private.push_digest_items i where i.notification_id = 'd9000000-0000-4000-8000-000000000010'),
  'CA-30: the reminder of 22:30 for a pick up at 23:30, with the silence on, never rings'
);
select is(
  (select d.due_at from private.push_deliveries d where d.notification_id = 'd9000000-0000-4000-8000-000000000011'),
  '2026-12-02 07:00+01'::timestamptz,
  'a reminder of 6:30 for 8:00 rings at 7:00'
);

-- ---------------------------------------------------------------------------
-- CA-31: no device, no delivery
-- ---------------------------------------------------------------------------
insert into public.notifications (id, household_id, recipient_member_id, kind, actor_member_id, todo_id, created_at)
values ('d9000000-0000-4000-8000-000000000012', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001',
        'todo_assigned', 'a1000000-0000-4000-8000-000000000002', 'f1000000-0000-4000-8000-000000000001',
        '2026-12-01 15:00+01');
select ok(
  not exists (select 1 from private.push_deliveries d where d.recipient_member_id = 'a1000000-0000-4000-8000-000000000001')
  and not exists (select 1 from private.push_digest_items i where i.recipient_member_id = 'a1000000-0000-4000-8000-000000000001'),
  'CA-31: Marco has no device: nothing to deliver'
);

-- ---------------------------------------------------------------------------
-- CA-33: the morning digest of Marco on Tuesday 1 December
--   M1 Colloquio       household, Marco, participant Marco, 9:00–10:00, Scuola
--   M2 Commercialista  busy, Marco, participant Marco, 12:00–13:00
--   M3 Dentista        busy, Laura, participant Laura (no Marco), 14:00–15:00
--   M4 Nuoto di Sofia  household, Laura, Sofia, Marco picks up, 17:00–18:00
-- ---------------------------------------------------------------------------
insert into public.events (id, household_id, author_member_id, title, location, starts_at, ends_at, visibility,
                           recurrence, pickup_member_id)
values
  ('ca000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001',
   'Colloquio', 'Scuola', '2026-12-01 09:00+01', '2026-12-01 10:00+01', 'household', 'none', null),
  ('ca000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001',
   'Commercialista', 'Studio', '2026-12-01 12:00+01', '2026-12-01 13:00+01', 'busy', 'none', null),
  ('ca000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000002',
   'Dentista', null, '2026-12-01 14:00+01', '2026-12-01 15:00+01', 'busy', 'none', null),
  ('ca000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000002',
   'Nuoto di Sofia', 'Piscina', '2026-12-01 17:00+01', '2026-12-01 18:00+01', 'household', 'none',
   'a1000000-0000-4000-8000-000000000001');
insert into public.event_members (event_id, member_id, household_id)
values
  ('ca000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111'),
  ('ca000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111'),
  ('ca000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111'),
  ('ca000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111');

set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select results_eq(
  $$ select d.count, d.at, d.event_id, d.title from public.get_morning_digest('2026-12-01') d where d.line = 'events' $$,
  $$ values (3, '2026-12-01 09:00+01'::timestamptz, 'ca000000-0000-4000-8000-000000000001'::uuid, 'Colloquio'::text) $$,
  'CA-33: «events» counts 3 (his event, his «Occupato», the Nuoto), from the Colloquio at 9:00'
);
select results_eq(
  $$ select d.leg::text, d.at, d.driver_member_id, d.event_id from public.get_morning_digest('2026-12-01') d
     where d.line = 'ride' $$,
  $$ values ('pickup', '2026-12-01 18:00+01'::timestamptz, 'a1000000-0000-4000-8000-000000000001'::uuid,
             'ca000000-0000-4000-8000-000000000004'::uuid) $$,
  'CA-33: one ride line: Marco picks up Sofia at 18:00'
);
select is_empty(
  $$ select 1 from public.get_morning_digest('2026-12-01') d
     where d.event_id = 'ca000000-0000-4000-8000-000000000003' or d.title = 'Dentista' $$,
  'CA-33: no line speaks of the «Occupato» of Laura'
);
select lives_ok($$ select public.set_notification_preference('digest_rides', false) $$, 'CA-33: Marco switches the rides of the digest off');
select is_empty(
  $$ select 1 from public.get_morning_digest('2026-12-01') d where d.line = 'ride' $$,
  'CA-33: without «Viaggi» in the digest, no ride line'
);
select lives_ok($$ select public.set_notification_preference('digest_rides', true) $$, 'Marco switches them on again');
select is_empty(
  $$ select 1 from public.get_morning_digest('2026-12-05') $$,
  'Saturday is not one of the chosen days: 0 rows'
);
select throws_ok($$ select * from public.get_morning_digest(null) $$, '22023', null, 'the day is required');
-- Davide sees the two «Tutto il Nest» only: the «Occupato» of the others are not counted.
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000003","role":"authenticated"}';
select results_eq(
  $$ select d.count from public.get_morning_digest('2026-12-01') d where d.line = 'events' $$,
  $$ values (2) $$,
  'the «Occupato» of the others are neither shown nor counted (Davide: 2)'
);
-- CA-40: Giulia reads only her own digest.
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select is_empty(
  $$ select 1 from public.get_morning_digest('2026-12-01') d
     where d.event_id in ('ca000000-0000-4000-8000-000000000001', 'ca000000-0000-4000-8000-000000000002',
                          'ca000000-0000-4000-8000-000000000003', 'ca000000-0000-4000-8000-000000000004')
        or d.title in ('Colloquio', 'Commercialista', 'Dentista', 'Nuoto di Sofia') $$,
  'CA-40: Giulia never reads the digest of Casa D''Angelo'
);
-- Chiara has no household.
set local request.jwt.claims to '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($$ select * from public.get_morning_digest('2026-12-01') $$, '42501', null, 'without household, no digest');
reset role;

-- ---------------------------------------------------------------------------
-- CA-32: the morning digest rings at 7:15 (Marco now has a browser)
--   M5 Avvocato  busy, Marco, participant Marco, Thu 3/12 11:00–12:00
-- ---------------------------------------------------------------------------
insert into public.push_subscriptions (id, household_id, member_id, platform, endpoint, p256dh, auth)
values ('cb000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111',
        'a1000000-0000-4000-8000-000000000001', 'web', 'https://fcm.googleapis.com/fcm/send/marco-511',
        repeat('M', 87), repeat('m', 22));
insert into public.events (id, household_id, author_member_id, title, location, starts_at, ends_at, visibility, recurrence)
values ('ca000000-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001',
        'Avvocato', 'Studio legale', '2026-12-03 11:00+01', '2026-12-03 12:00+01', 'busy', 'none');
insert into public.event_members (event_id, member_id, household_id)
values ('ca000000-0000-4000-8000-000000000005', 'a1000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111');

select lives_ok(
  $$ select public.run_notification_job('push_digests', '11111111-1111-4111-8111-111111111111', '2026-12-01 07:15+01') $$,
  'CA-32: the job runs at 7:15 of Tuesday'
);
select results_eq(
  $$ select d.digest_day, d.due_at from private.push_deliveries d
     where d.kind = 'morning_digest' and d.recipient_member_id = 'a1000000-0000-4000-8000-000000000001' $$,
  $$ values ('2026-12-01'::date, '2026-12-01 07:15+01'::timestamptz) $$,
  'CA-32: Marco has his morning digest of Tuesday at 7:15'
);
select lives_ok(
  $$ select public.run_notification_job('push_digests', '11111111-1111-4111-8111-111111111111', '2026-12-05 07:15+01') $$,
  'CA-32: the job runs at 7:15 of Saturday'
);
select lives_ok(
  $$ select public.run_notification_job('push_digests', '11111111-1111-4111-8111-111111111111', '2026-12-04 07:15+01') $$,
  'CA-32: the job runs at 7:15 of Friday, a day with nothing for Marco'
);
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$ select public.set_notification_preference('morning_digest', false) $$, 'CA-32: Marco switches the digest off');
reset role;
select lives_ok(
  $$ select public.run_notification_job('push_digests', '11111111-1111-4111-8111-111111111111', '2026-12-03 07:15+01') $$,
  'CA-32: the job runs at 7:15 of Thursday, with the digest off'
);
select results_eq(
  $$ select d.digest_day from private.push_deliveries d
     where d.kind = 'morning_digest' and d.recipient_member_id = 'a1000000-0000-4000-8000-000000000001' $$,
  $$ values ('2026-12-01'::date) $$,
  'CA-32: no digest on Saturday, on an empty day or with the digest off'
);
set local role authenticated;
select lives_ok($$ select public.set_notification_preference('morning_digest', true) $$, 'Marco switches the digest on again');
reset role;
select lives_ok(
  $$ select public.run_notification_job('push_digests', '11111111-1111-4111-8111-111111111111', '2026-12-03 07:20+01') $$,
  'the job runs again at 7:20 of Thursday'
);

-- ---------------------------------------------------------------------------
-- CA-37: what the morning digest says
-- ---------------------------------------------------------------------------
update private.push_deliveries set claim_token = 'ee000000-0000-4000-8000-000000000002',
                                   claimed_until = now() + interval '5 minutes'
where kind = 'morning_digest' and recipient_member_id = 'a1000000-0000-4000-8000-000000000001'
  and digest_day = '2026-12-03';
select set_config('test.morning', (
  select d.id::text from private.push_deliveries d
  where d.kind = 'morning_digest' and d.recipient_member_id = 'a1000000-0000-4000-8000-000000000001'
    and d.digest_day = '2026-12-03'), true);
set local role service_role;
select results_eq(
  $$ select c.notification_id, c.kind, c.at, c.title, c.item_count, c.is_hidden
     from public.get_push_content(current_setting('test.morning')::uuid, 'ee000000-0000-4000-8000-000000000002') c
     where c.line = 'events' $$,
  $$ values (null::uuid, null::public.notification_kind, '2026-12-03 11:00+01'::timestamptz, 'Avvocato'::text, 1, false) $$,
  'CA-37: the digest of Marco says the title of his «Occupato»'
);
reset role;
update public.notification_preferences set hide_content = true where member_id = 'a1000000-0000-4000-8000-000000000001';
set local role service_role;
select results_eq(
  $$ select c.title, c.place, c.person_name, c.item_count, c.is_hidden
     from public.get_push_content(current_setting('test.morning')::uuid, 'ee000000-0000-4000-8000-000000000002') c
     where c.line = 'events' $$,
  $$ values (null::text, null::text, null::text, 1, true) $$,
  'CA-37: with «Nascondi il contenuto», no title'
);
reset role;
update public.notification_preferences set hide_content = false where member_id = 'a1000000-0000-4000-8000-000000000001';

-- ---------------------------------------------------------------------------
-- CA-36: what an event_reminder says
-- ---------------------------------------------------------------------------
insert into public.notifications (id, household_id, recipient_member_id, kind, event_id, occurrence_date, created_at)
values
  ('d9000000-0000-4000-8000-000000000013', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001',
   'event_reminder', 'ca000000-0000-4000-8000-000000000001', '2026-12-01', '2026-12-01 08:00+01'),
  ('d9000000-0000-4000-8000-000000000014', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001',
   'event_reminder', 'ca000000-0000-4000-8000-000000000002', '2026-12-01', '2026-12-01 11:00+01');
update private.push_deliveries set claim_token = 'ee000000-0000-4000-8000-000000000003',
                                   claimed_until = now() + interval '5 minutes'
where notification_id in ('d9000000-0000-4000-8000-000000000013', 'd9000000-0000-4000-8000-000000000014');
select set_config('test.d13', (select d.id::text from private.push_deliveries d
                               where d.notification_id = 'd9000000-0000-4000-8000-000000000013'), true);
select set_config('test.d14', (select d.id::text from private.push_deliveries d
                               where d.notification_id = 'd9000000-0000-4000-8000-000000000014'), true);
set local role service_role;
select results_eq(
  $$ select c.kind::text, c.at, c.title, c.place, c.is_hidden
     from public.get_push_content(current_setting('test.d13')::uuid, 'ee000000-0000-4000-8000-000000000003') c $$,
  $$ values ('event_reminder', '2026-12-01 09:00+01'::timestamptz, 'Colloquio'::text, 'Scuola'::text, false) $$,
  'CA-36: the reminder of a «Tutto il Nest» event says title and place'
);
select results_eq(
  $$ select c.kind::text, c.title, c.place, c.is_hidden
     from public.get_push_content(current_setting('test.d14')::uuid, 'ee000000-0000-4000-8000-000000000003') c $$,
  $$ values ('event_reminder', null::text, null::text, false) $$,
  'CA-36: the reminder of an «Occupato» of Marco has no title nor place, also with the content visible'
);
reset role;
update public.notification_preferences set hide_content = true where member_id = 'a1000000-0000-4000-8000-000000000001';
set local role service_role;
select results_eq(
  $$ select c.title, c.place, c.person_name, c.is_hidden
     from public.get_push_content(current_setting('test.d13')::uuid, 'ee000000-0000-4000-8000-000000000003') c $$,
  $$ values (null::text, null::text, null::text, true) $$,
  'CA-36: with «Nascondi il contenuto», title, place and name are null'
);
reset role;
update public.notification_preferences set hide_content = false where member_id = 'a1000000-0000-4000-8000-000000000001';

-- ---------------------------------------------------------------------------
-- CA-38: a reminder whose event becomes «Occupato» of Laura, or is deleted
--   M6 Recita  household, Laura, Mon 7/12 10:00–11:00
--   M7 Gita    household, Laura, Mon 7/12 12:00–13:00
-- ---------------------------------------------------------------------------
insert into public.events (id, household_id, author_member_id, title, starts_at, ends_at, visibility, recurrence)
values
  ('ca000000-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000002',
   'Recita', '2026-12-07 10:00+01', '2026-12-07 11:00+01', 'household', 'none'),
  ('ca000000-0000-4000-8000-000000000007', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000002',
   'Gita', '2026-12-07 12:00+01', '2026-12-07 13:00+01', 'household', 'none');
insert into public.notifications (id, household_id, recipient_member_id, kind, event_id, occurrence_date, created_at)
values
  ('d9000000-0000-4000-8000-000000000015', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001',
   'event_reminder', 'ca000000-0000-4000-8000-000000000006', '2026-12-07', '2026-12-07 09:00+01'),
  ('d9000000-0000-4000-8000-000000000016', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001',
   'event_reminder', 'ca000000-0000-4000-8000-000000000007', '2026-12-07', '2026-12-07 11:00+01');
update private.push_deliveries set claim_token = 'ee000000-0000-4000-8000-000000000004',
                                   claimed_until = now() + interval '5 minutes'
where notification_id = 'd9000000-0000-4000-8000-000000000015';
select set_config('test.d15', (select d.id::text from private.push_deliveries d
                               where d.notification_id = 'd9000000-0000-4000-8000-000000000015'), true);
update public.events set visibility = 'busy' where id = 'ca000000-0000-4000-8000-000000000006';
set local role service_role;
select is_empty(
  $$ select 1 from public.get_push_content(current_setting('test.d15')::uuid, 'ee000000-0000-4000-8000-000000000004') $$,
  'CA-38: the event became an «Occupato» of Laura without Marco: no content'
);
reset role;
select results_eq(
  $$ select d.outcome from private.push_deliveries d where d.id = current_setting('test.d15')::uuid $$,
  $$ values ('skipped'::text) $$,
  'CA-38: the delivery is closed without sending'
);
delete from public.events where id = 'ca000000-0000-4000-8000-000000000007';
select is_empty(
  $$ select 1 from private.push_deliveries d where d.notification_id = 'd9000000-0000-4000-8000-000000000016' $$,
  'CA-38: the event deleted: the notification and its delivery are gone'
);

select * from finish();
rollback;
