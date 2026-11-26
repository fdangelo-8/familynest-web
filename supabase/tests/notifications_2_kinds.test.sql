-- The new notifications of Notifiche 2.0 (issue #511, DB-2 of plan #501, part 2):
-- member_joined (CA-17), event_reminder (CA-18, CA-19, CA-21, CA-22), ride_reminder
-- (CA-20, CA-21), ride_request with request_ride() (CA-25, CA-26, the request part of
-- CA-40), the fields of each kind, the jobs every 5 minutes.
-- The overlapping events of tomorrow are in notifications_overlaps.test.sql, when the phone
-- rings in push_schedule.test.sql.
-- Seed ids: Marco (Casa D'Angelo, admin, user aaaaaaaa…01, member a1…01), Laura a1…02
-- (adult without account, with a pending invitation a2…01), Sofia a1…03, Tommaso a1…04;
-- Giulia (Casa Bianchi, bbbbbbbb…01, b1…01). This test adds a third adult with an account,
-- Davide (a1…06, user aaaaaaaa…03), and Laura accepts her invitation (user aaaaaaaa…02).
-- Created here: events c8…. Dates: December 2026 (future), Europe/Rome (+01). The jobs run
-- with an explicit instant, never with the real time.
begin;
create extension if not exists pgtap with schema extensions;

select plan(48);

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-4000-8000-000000000002', 'authenticated',
   'authenticated', 'utente-laura@example.com', '{"full_name":"Laura Test"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-4000-8000-000000000003', 'authenticated',
   'authenticated', 'utente-davide@example.com', '{"full_name":"Davide Test"}', now(), now());
insert into public.household_members (id, household_id, kind, name, color, user_id, joined_at)
values ('a1000000-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111', 'adult', 'Davide',
        'lampone', 'aaaaaaaa-0000-4000-8000-000000000003', now());

-- ---------------------------------------------------------------------------
-- The fields of each kind
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.notifications (household_id, recipient_member_id, kind)
     values ('11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001', 'member_joined') $$,
  '23514', null,
  'member_joined says who entered'
);
select is_empty(
  $$ select 1 from public.notifications $$,
  'no notification before the tests'
);

-- ---------------------------------------------------------------------------
-- CA-17: Laura accepts her invitation
-- ---------------------------------------------------------------------------
select set_config('test.token', (select i.token from public.invitations i where i.id = 'a2000000-0000-4000-8000-000000000001'), true);
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}';
select is(
  public.accept_invitation_with_color(current_setting('test.token'), 'glicine'),
  '11111111-1111-4111-8111-111111111111'::uuid,
  'CA-17: Laura accepts the invitation of Casa D''Angelo'
);
reset role;
select results_eq(
  $$ select n.recipient_member_id, n.actor_member_id from public.notifications n
     where n.kind = 'member_joined' order by n.recipient_member_id $$,
  $$ values ('a1000000-0000-4000-8000-000000000001'::uuid, 'a1000000-0000-4000-8000-000000000002'::uuid),
            ('a1000000-0000-4000-8000-000000000006'::uuid, 'a1000000-0000-4000-8000-000000000002'::uuid) $$,
  'CA-17: Marco and Davide receive member_joined with Laura as the person who entered; Laura nothing'
);
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select results_eq(
  $$ select n.kind::text, n.actor_member_id from public.notifications n $$,
  $$ values ('member_joined', 'a1000000-0000-4000-8000-000000000002'::uuid) $$,
  'CA-17: Marco reads his member_joined'
);
reset role;

-- ---------------------------------------------------------------------------
-- Events of Casa D'Angelo:
--   E1 Riunione           busy, Marco, participant Marco, Wed 2/12 17:00–18:00, avviso 60
--   E4 Dentista           busy, Marco, participant Marco, Fri 4/12 10:00–11:00, avviso 30
--   E5 Visita             busy, Laura, nobody else, Sat 5/12 10:00–11:00, avviso 60
--   E6 Nuoto di Sofia     household, Laura, Sofia, Thu 3/12 17:00–18:30, Marco takes, Laura
--                         picks up, remind_rides
--   E7 Nuoto (no avviso)  same, without remind_rides
--   E8 Nuoto (da decidere) same, with remind_rides, both ways «Da decidere»
--   E9 Danza di Sofia     household, Laura, Sofia, Fri 4/12 17:00–18:00, Marco takes, Laura
--                         picks up, remind_rides
--   E10 Calcio di Tommaso household, Marco, Tommaso, Thu 3/12 18:00–19:00
--   E11 Spesa grande      household, Davide, nobody else, Fri 4/12 11:35–12:00, avviso 60
-- ---------------------------------------------------------------------------
insert into public.events (id, household_id, author_member_id, title, starts_at, ends_at, visibility, recurrence,
                           escort_member_id, pickup_member_id, escort_undecided, pickup_undecided,
                           reminder_minutes_before, remind_rides)
values
  ('c8000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001',
   'Riunione', '2026-12-02 17:00+01', '2026-12-02 18:00+01', 'busy', 'none', null, null, false, false, 60, false),
  ('c8000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001',
   'Dentista', '2026-12-04 10:00+01', '2026-12-04 11:00+01', 'busy', 'none', null, null, false, false, 30, false),
  ('c8000000-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000002',
   'Visita', '2026-12-05 10:00+01', '2026-12-05 11:00+01', 'busy', 'none', null, null, false, false, 60, false),
  ('c8000000-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000002',
   'Nuoto di Sofia', '2026-12-03 17:00+01', '2026-12-03 18:30+01', 'household', 'none',
   'a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002', false, false, null, true),
  ('c8000000-0000-4000-8000-000000000007', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000002',
   'Nuoto senza avviso', '2026-12-03 17:00+01', '2026-12-03 18:30+01', 'household', 'none',
   'a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002', false, false, null, false),
  ('c8000000-0000-4000-8000-000000000008', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000002',
   'Nuoto da decidere', '2026-12-03 17:00+01', '2026-12-03 18:30+01', 'household', 'none',
   null, null, true, true, null, true),
  ('c8000000-0000-4000-8000-000000000009', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000002',
   'Danza di Sofia', '2026-12-04 17:00+01', '2026-12-04 18:00+01', 'household', 'none',
   'a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002', false, false, null, true),
  ('c8000000-0000-4000-8000-000000000010', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001',
   'Calcio di Tommaso', '2026-12-03 18:00+01', '2026-12-03 19:00+01', 'household', 'none',
   null, null, false, false, null, false),
  ('c8000000-0000-4000-8000-000000000011', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000006',
   'Spesa grande', '2026-12-04 11:35+01', '2026-12-04 12:00+01', 'household', 'none',
   null, null, false, false, 60, false);
insert into public.event_members (event_id, member_id, household_id)
values
  ('c8000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111'),
  ('c8000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111'),
  ('c8000000-0000-4000-8000-000000000006', 'a1000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111'),
  ('c8000000-0000-4000-8000-000000000007', 'a1000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111'),
  ('c8000000-0000-4000-8000-000000000008', 'a1000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111'),
  ('c8000000-0000-4000-8000-000000000009', 'a1000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111'),
  ('c8000000-0000-4000-8000-000000000010', 'a1000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111');

-- ---------------------------------------------------------------------------
-- CA-18: the reminder of an event, 60 minutes before
-- ---------------------------------------------------------------------------
select is(
  public.run_notification_job('event_reminders', '11111111-1111-4111-8111-111111111111', '2026-12-02 15:50+01'),
  0,
  'CA-18: at 15:50 no reminder yet'
);
select is(
  public.run_notification_job('event_reminders', '11111111-1111-4111-8111-111111111111', '2026-12-02 16:00+01'),
  1,
  'CA-18: at 16:00 one reminder'
);
select results_eq(
  $$ select n.recipient_member_id, n.event_id, n.occurrence_date, n.created_at from public.notifications n
     where n.kind = 'event_reminder' $$,
  $$ values ('a1000000-0000-4000-8000-000000000001'::uuid, 'c8000000-0000-4000-8000-000000000001'::uuid,
             '2026-12-02'::date, '2026-12-02 16:00+01'::timestamptz) $$,
  'CA-18: Marco has the event_reminder of the 2nd of December'
);
select is(
  public.run_notification_job('event_reminders', '11111111-1111-4111-8111-111111111111', '2026-12-02 16:05+01'),
  0,
  'CA-18: run again at 16:05, nothing more'
);
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select results_eq(
  $$ select n.event_id from public.notifications n where n.kind = 'event_reminder' $$,
  $$ values ('c8000000-0000-4000-8000-000000000001'::uuid) $$,
  'CA-18: Marco reads his reminder in Notifiche'
);
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}';
select is_empty(
  $$ select 1 from public.notifications n where n.kind = 'event_reminder' $$,
  'the reminder of Marco is never read by Laura'
);
reset role;

-- ---------------------------------------------------------------------------
-- CA-19: a weekly event, one occurrence removed and one moved
--   E3 Corso  busy, Marco, participant Marco, every Wednesday 17:00–18:00 from 2/12,
--             avviso 60; 9/12 removed, 16/12 moved to 18:00–19:00
-- ---------------------------------------------------------------------------
insert into public.events (id, household_id, author_member_id, title, starts_at, ends_at, visibility, recurrence,
                           recurrence_weekdays, reminder_minutes_before)
values ('c8000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001',
        'Corso', '2026-12-02 17:00+01', '2026-12-02 18:00+01', 'busy', 'weekly', '{3}', 60);
insert into public.event_members (event_id, member_id, household_id)
values ('c8000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111');
insert into public.event_exceptions (event_id, household_id, occurrence_date, is_cancelled)
values ('c8000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', '2026-12-09', true);
insert into public.event_exceptions (event_id, household_id, occurrence_date, title, starts_at, ends_at)
values ('c8000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', '2026-12-16',
        'Corso', '2026-12-16 18:00+01', '2026-12-16 19:00+01');

select is(
  public.run_notification_job('event_reminders', '11111111-1111-4111-8111-111111111111', '2026-12-09 16:00+01'),
  0,
  'CA-19: the 9th was removed: no reminder'
);
select is(
  public.run_notification_job('event_reminders', '11111111-1111-4111-8111-111111111111', '2026-12-16 16:00+01'),
  0,
  'CA-19: the 16th no longer starts at 17:00: nothing at 16:00'
);
select is(
  public.run_notification_job('event_reminders', '11111111-1111-4111-8111-111111111111', '2026-12-16 17:00+01'),
  1,
  'CA-19: the 16th starts at 18:00: the reminder at 17:00'
);
select is(
  public.run_notification_job('event_reminders', '11111111-1111-4111-8111-111111111111', '2026-12-23 16:00+01'),
  1,
  'the 23rd, a regular occurrence: the reminder at 16:00'
);
select results_eq(
  $$ select n.occurrence_date from public.notifications n
     where n.kind = 'event_reminder' and n.event_id = 'c8000000-0000-4000-8000-000000000003'
     order by n.occurrence_date $$,
  $$ values ('2026-12-16'::date), ('2026-12-23'::date) $$,
  'CA-19: the reminders of the series: the 16th and the 23rd, never the 9th'
);

-- ---------------------------------------------------------------------------
-- CA-22: a «Occupato» of Laura with a reminder: Marco, not involved, gets nothing
-- ---------------------------------------------------------------------------
select is(
  public.run_notification_job('event_reminders', '11111111-1111-4111-8111-111111111111', '2026-12-05 09:00+01'),
  1,
  'CA-22: one reminder for the «Occupato» of Laura'
);
select results_eq(
  $$ select n.recipient_member_id from public.notifications n
     where n.kind = 'event_reminder' and n.event_id = 'c8000000-0000-4000-8000-000000000005' $$,
  $$ values ('a1000000-0000-4000-8000-000000000002'::uuid) $$,
  'CA-22: only Laura, its author, receives it; Marco and Davide nothing'
);

-- ---------------------------------------------------------------------------
-- CA-20: the reminders of the rides
-- ---------------------------------------------------------------------------
select is(
  public.run_notification_job('ride_reminders', '11111111-1111-4111-8111-111111111111', '2026-12-02 20:00+01'),
  2,
  'CA-20: at 20:00 of the evening before, two reminders'
);
select results_eq(
  $$ select n.recipient_member_id, n.ride_leg::text, n.days_before from public.notifications n
     where n.kind = 'ride_reminder' order by n.recipient_member_id $$,
  $$ values ('a1000000-0000-4000-8000-000000000001'::uuid, 'escort', 1::smallint),
            ('a1000000-0000-4000-8000-000000000002'::uuid, 'pickup', 1::smallint) $$,
  'CA-20: Marco (takes) and Laura (picks up), the evening before'
);
select is(
  public.run_notification_job('ride_reminders', '11111111-1111-4111-8111-111111111111', '2026-12-02 20:05+01'),
  0,
  'run again at 20:05, nothing more'
);
select is(
  public.run_notification_job('ride_reminders', '11111111-1111-4111-8111-111111111111', '2026-12-03 16:00+01'),
  1,
  'CA-20: at 16:00, an hour before the start'
);
select is(
  public.run_notification_job('ride_reminders', '11111111-1111-4111-8111-111111111111', '2026-12-03 17:30+01'),
  1,
  'CA-20: at 17:30, an hour before the end'
);
select results_eq(
  $$ select n.recipient_member_id, n.ride_leg::text, n.days_before, n.created_at from public.notifications n
     where n.kind = 'ride_reminder' and n.days_before = 0 order by n.created_at $$,
  $$ values ('a1000000-0000-4000-8000-000000000001'::uuid, 'escort', 0::smallint, '2026-12-03 16:00+01'::timestamptz),
            ('a1000000-0000-4000-8000-000000000002'::uuid, 'pickup', 0::smallint, '2026-12-03 17:30+01'::timestamptz) $$,
  'CA-20: Marco an hour before he takes, Laura an hour before she picks up'
);
select is_empty(
  $$ select 1 from public.notifications n
     where n.kind = 'ride_reminder'
       and n.event_id in ('c8000000-0000-4000-8000-000000000007', 'c8000000-0000-4000-8000-000000000008') $$,
  'CA-20: without remind_rides, or with «Da decidere», nobody'
);

-- ---------------------------------------------------------------------------
-- CA-21: the switches «Prima di un tuo impegno» and «Viaggi»
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$ select public.set_notification_preference('event_reminders', false) $$, 'CA-21: Marco switches the reminders off');
select lives_ok($$ select public.set_notification_preference('rides', false) $$, 'CA-21: Marco switches the rides off');
reset role;
select is(
  public.run_notification_job('event_reminders', '11111111-1111-4111-8111-111111111111', '2026-12-04 09:30+01'),
  0,
  'CA-21: the reminder of the Dentista of Marco is not created'
);
select is(
  public.run_notification_job('ride_reminders', '11111111-1111-4111-8111-111111111111', '2026-12-03 20:00+01'),
  1,
  'CA-21: the evening before the Danza, one reminder only'
);
select results_eq(
  $$ select n.recipient_member_id, n.ride_leg::text from public.notifications n
     where n.kind = 'ride_reminder' and n.event_id = 'c8000000-0000-4000-8000-000000000009' $$,
  $$ values ('a1000000-0000-4000-8000-000000000002'::uuid, 'pickup') $$,
  'CA-21: Laura picks up and is told; Marco, with «Viaggi» off, is not'
);

-- ---------------------------------------------------------------------------
-- The scheduled entry point runs the reminders at every run of 5 minutes
-- ---------------------------------------------------------------------------
select is(
  private.run_scheduled_notification_jobs('2026-12-04 10:35+01'),
  null::public.notification_job,
  'at 10:35 there is no job of the hour (the jobs of 5 minutes run anyway)'
);
select results_eq(
  $$ select n.recipient_member_id from public.notifications n
     where n.kind = 'event_reminder' and n.event_id = 'c8000000-0000-4000-8000-000000000011' $$,
  $$ values ('a1000000-0000-4000-8000-000000000006'::uuid) $$,
  'the run of 10:35 created the reminder of Davide for 11:35'
);

-- ---------------------------------------------------------------------------
-- CA-25: «Chiedi a Laura di portare Tommaso»
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok(
  $$ select public.request_ride('c8000000-0000-4000-8000-000000000010', '2026-12-03', 'escort',
                                'a1000000-0000-4000-8000-000000000002') $$,
  'CA-25: Marco asks Laura to take Tommaso to the Calcio'
);
select lives_ok(
  $$ select public.request_ride('c8000000-0000-4000-8000-000000000010', '2026-12-03', 'escort',
                                'a1000000-0000-4000-8000-000000000002') $$,
  'CA-25: Marco asks again the same day, without error'
);
reset role;
select results_eq(
  $$ select n.recipient_member_id, n.actor_member_id, n.event_id, n.occurrence_date, n.ride_leg::text
     from public.notifications n where n.kind = 'ride_request' $$,
  $$ values ('a1000000-0000-4000-8000-000000000002'::uuid, 'a1000000-0000-4000-8000-000000000001'::uuid,
             'c8000000-0000-4000-8000-000000000010'::uuid, '2026-12-03'::date, 'escort') $$,
  'CA-25: Laura has one ride_request from Marco'
);
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}';
select results_eq(
  $$ select n.actor_member_id from public.notifications n where n.kind = 'ride_request' $$,
  $$ values ('a1000000-0000-4000-8000-000000000001'::uuid) $$,
  'CA-25: Laura reads it in Notifiche'
);

-- ---------------------------------------------------------------------------
-- CA-26: what cannot be asked
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select public.request_ride('c8000000-0000-4000-8000-000000000010', '2026-12-03', 'escort',
                                'a1000000-0000-4000-8000-000000000001') $$,
  '23514', null, 'CA-26: Marco cannot ask himself'
);
select throws_ok(
  $$ select public.request_ride('c8000000-0000-4000-8000-000000000010', '2026-12-03', 'pickup',
                                'a1000000-0000-4000-8000-000000000003') $$,
  '23514', null, 'CA-26: nor Sofia, a child'
);
select throws_ok(
  $$ select public.request_ride('c8000000-0000-4000-8000-000000000001', '2026-12-02', 'escort',
                                'a1000000-0000-4000-8000-000000000002') $$,
  '42501', null, 'CA-26: nor about an «Occupato»'
);
select throws_ok(
  $$ select public.request_ride('c8000000-0000-4000-8000-000000000010', '2026-12-04', 'escort',
                                'a1000000-0000-4000-8000-000000000002') $$,
  '22023', null, 'CA-26: nor on a day without occurrence'
);
select throws_ok(
  $$ select public.request_ride('c8000000-0000-4000-8000-000000000010', '2026-12-03', 'escort',
                                'b1000000-0000-4000-8000-000000000001') $$,
  '22023', null, 'CA-26: nor the adult of another household'
);
select throws_ok(
  $$ select public.request_ride('c8000000-0000-4000-8000-000000000010', null, 'escort',
                                'a1000000-0000-4000-8000-000000000002') $$,
  '22023', null, 'the day is required'
);
set local request.method to 'GET';
select throws_ok(
  $$ select public.request_ride('c8000000-0000-4000-8000-000000000010', '2026-12-03', 'pickup',
                                'a1000000-0000-4000-8000-000000000002') $$,
  'P0001', 'use POST', 'request_ride accepts only POST'
);
set local request.method to 'POST';

-- CA-40: Giulia, of another household, cannot ask about an event of Casa D'Angelo.
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select public.request_ride('c8000000-0000-4000-8000-000000000010', '2026-12-03', 'escort',
                                'a1000000-0000-4000-8000-000000000002') $$,
  '42501', null, 'CA-40: Giulia cannot ask about an event of Casa D''Angelo'
);
select is_empty(
  $$ select 1 from public.notifications n where n.household_id = '11111111-1111-4111-8111-111111111111' $$,
  'CA-40: Giulia reads no notification of Casa D''Angelo'
);

-- anon
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok(
  $$ select public.request_ride('c8000000-0000-4000-8000-000000000010', '2026-12-03', 'escort',
                                'a1000000-0000-4000-8000-000000000002') $$,
  '42501', null, 'CA-40: anon cannot ask a ride'
);
reset role;
select is(
  (select count(*)::integer from public.notifications n where n.kind = 'ride_request'),
  1,
  'CA-26, CA-40: the refused requests wrote nothing'
);

-- ---------------------------------------------------------------------------
-- A ride_request no longer visible: the event becomes «Occupato» of Marco
-- ---------------------------------------------------------------------------
update public.events set visibility = 'busy' where id = 'c8000000-0000-4000-8000-000000000010';
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}';
select is_empty(
  $$ select 1 from public.notifications n where n.kind = 'ride_request' $$,
  'the request is hidden from Laura when she no longer sees the event in full'
);
reset role;

select * from finish();
rollback;
