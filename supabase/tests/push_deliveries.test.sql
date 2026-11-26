-- The sending service and the privacy of the push (issue #511, DB-2 of plan #501, part 1):
-- private.push_deliveries, claim_push_deliveries(), list_push_targets(),
-- get_push_content() with «Nascondi il contenuto», complete_push_delivery(),
-- fail_push_delivery(), remove_push_subscription(); the single source
-- private.notification_is_visible() of the page and the push, and
-- private.event_open_to_member() checked against the select policy of events
-- (CA-34 – CA-39 for single notifications, the service part of CA-40).
-- The deliveries are written here by the database owner: the rules that create them come
-- with part 2 of #511, and so do event_reminder and the digests (CA-36 and CA-38 are
-- checked here with event_time_changed, the event notification of today).
-- Seed ids: Marco (Casa D'Angelo, admin, user aaaaaaaa…01, member a1…01), Laura a1…02,
-- Sofia a1…03, Tommaso a1…04; Giulia (Casa Bianchi, bbbbbbbb…01, b1…01). This test gives
-- Laura an account (user aaaaaaaa…02) and adds a third adult, Davide (a1…06, user
-- aaaaaaaa…03). Created here: events a8…, notifications a9…, devices ac…, deliveries ad….
-- Dates of the events: December 2026 (future), Europe/Rome (+01).
begin;
create extension if not exists pgtap with schema extensions;

select plan(82);

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

-- Events of Casa D'Angelo:
--   E1 Calcio di Tommaso   household, Marco          Thu 3/12 18:00–19:00, Campo sportivo
--   E2 Commercialista      busy, Marco               Thu 3/12 17:00–18:30, Studio Rossi
--   E3 Dentista            busy, Laura (no Marco)    Fri 4/12 10:00–11:00
--   E4 Nuoto di Sofia      household, Laura, every Thursday 17:00–18:30, Piscina;
--                          the 10/12 moved to 17:30–19:00 at Piscina nuova
--   E5 Regalo per Marco    selected, Laura, chosen Davide
--   E6 Ritiro              busy, Laura, Marco picks up
--   E7 Riunione            busy, Laura, Marco participant
--   E8 Cena dai nonni      household, Laura          Sat 5/12 20:00–22:00
--   E9 Palestra            private, Laura
insert into public.events (id, household_id, author_member_id, title, location, starts_at, ends_at, visibility,
                           recurrence, recurrence_weekdays, pickup_member_id)
values
  ('a8000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001',
   'Calcio di Tommaso', 'Campo sportivo', '2026-12-03 18:00+01', '2026-12-03 19:00+01', 'household', 'none', null, null),
  ('a8000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001',
   'Commercialista', 'Studio Rossi', '2026-12-03 17:00+01', '2026-12-03 18:30+01', 'busy', 'none', null, null),
  ('a8000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000002',
   'Dentista', null, '2026-12-04 10:00+01', '2026-12-04 11:00+01', 'busy', 'none', null, null),
  ('a8000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000002',
   'Nuoto di Sofia', 'Piscina', '2026-12-03 17:00+01', '2026-12-03 18:30+01', 'household', 'weekly', '{4}', null),
  ('a8000000-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000002',
   'Regalo per Marco', null, '2026-12-06 10:00+01', '2026-12-06 11:00+01', 'selected', 'none', null, null),
  ('a8000000-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000002',
   'Ritiro', null, '2026-12-07 16:00+01', '2026-12-07 17:00+01', 'busy', 'none', null,
   'a1000000-0000-4000-8000-000000000001'),
  ('a8000000-0000-4000-8000-000000000007', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000002',
   'Riunione', null, '2026-12-08 09:00+01', '2026-12-08 10:00+01', 'busy', 'none', null, null),
  ('a8000000-0000-4000-8000-000000000008', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000002',
   'Cena dai nonni', null, '2026-12-05 20:00+01', '2026-12-05 22:00+01', 'household', 'none', null, null),
  ('a8000000-0000-4000-8000-000000000009', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000002',
   'Palestra', null, '2026-12-09 07:00+01', '2026-12-09 08:00+01', 'private', 'none', null, null);
insert into public.event_exceptions (event_id, household_id, occurrence_date, title, location, starts_at, ends_at)
values ('a8000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', '2026-12-10',
        'Nuoto di Sofia', 'Piscina nuova', '2026-12-10 17:30+01', '2026-12-10 19:00+01');
insert into public.event_viewers (event_id, member_id, household_id)
values ('a8000000-0000-4000-8000-000000000005', 'a1000000-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111');
insert into public.event_members (event_id, member_id, household_id)
values ('a8000000-0000-4000-8000-000000000007', 'a1000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111');

-- Notifications (N1–N6, N8 for Marco; N7 for Laura):
--   N1 event_time_changed E1 · N2 event_time_changed E2 · N3 event_time_changed E3 (not
--   visible to Marco) · N4 shopping_added by Laura, 3 things · N5 event_time_changed E4 on
--   10/12 · N6 deadline_reminder «Rinnovo carta d'identità di Sofia», 7 days before ·
--   N7 shopping_added for Laura by Marco · N8 event_time_changed E8
insert into public.notifications (id, household_id, recipient_member_id, kind, actor_member_id, event_id,
                                  occurrence_date, deadline_id, days_before, item_count)
values
  ('a9000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001',
   'event_time_changed', 'a1000000-0000-4000-8000-000000000002', 'a8000000-0000-4000-8000-000000000001', null, null, null, null),
  ('a9000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001',
   'event_time_changed', 'a1000000-0000-4000-8000-000000000002', 'a8000000-0000-4000-8000-000000000002', null, null, null, null),
  ('a9000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001',
   'event_time_changed', 'a1000000-0000-4000-8000-000000000002', 'a8000000-0000-4000-8000-000000000003', null, null, null, null),
  ('a9000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001',
   'shopping_added', 'a1000000-0000-4000-8000-000000000002', null, null, null, null, 3),
  ('a9000000-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001',
   'event_time_changed', 'a1000000-0000-4000-8000-000000000002', 'a8000000-0000-4000-8000-000000000004', '2026-12-10', null, null, null),
  ('a9000000-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001',
   'deadline_reminder', null, null, null, 'a5000000-0000-4000-8000-000000000001', 7, null),
  ('a9000000-0000-4000-8000-000000000007', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000002',
   'shopping_added', 'a1000000-0000-4000-8000-000000000001', null, null, null, null, 1),
  ('a9000000-0000-4000-8000-000000000008', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001',
   'event_time_changed', 'a1000000-0000-4000-8000-000000000002', 'a8000000-0000-4000-8000-000000000008', null, null, null, null);

-- Devices: Marco a web browser and an Android phone, Laura a web browser.
insert into public.push_subscriptions (id, household_id, member_id, platform, endpoint, p256dh, auth, token, created_at)
values
  ('ac000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001',
   'web', 'https://fcm.googleapis.com/fcm/send/marco', repeat('B', 87), repeat('a', 22), null, now() - interval '2 minutes'),
  ('ac000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001',
   'fcm', null, null, null, 'fcm:marco', now() - interval '1 minute'),
  ('ac000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000002',
   'web', 'https://web.push.apple.com/laura', repeat('C', 87), repeat('b', 22), null, now());

-- Deliveries: D1–D8 single for N1–N8, due a minute ago; D9 the evening summary of Marco,
-- due in an hour.
insert into private.push_deliveries (id, household_id, recipient_member_id, kind, notification_id, digest_day, due_at)
select ('ad000000-0000-4000-8000-00000000000' || n.i)::uuid, '11111111-1111-4111-8111-111111111111', n.recipient_member_id,
       'single', n.id, null, now() - interval '1 minute'
from (
  select substr(x.id::text, 36, 1) as i, x.id, x.recipient_member_id
  from public.notifications x
  where x.id::text like 'a9000000-%'
) n;
insert into private.push_deliveries (id, household_id, recipient_member_id, kind, notification_id, digest_day, due_at)
values ('ad000000-0000-4000-8000-000000000009', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001',
        'evening_digest', null, (now() at time zone 'Europe/Rome')::date, now() + interval '1 hour');

-- ---------------------------------------------------------------------------
-- Schema and privileges
-- ---------------------------------------------------------------------------
select has_table('private', 'push_deliveries', 'private.push_deliveries exists');
select ok(
  (select c.relrowsecurity from pg_class c where c.oid = 'private.push_deliveries'::regclass)
  and not exists (select 1 from pg_policy p where p.polrelid = 'private.push_deliveries'::regclass),
  'RLS enabled on private.push_deliveries, with no policy'
);
select ok(
  not has_table_privilege('anon', 'private.push_deliveries', 'select, insert, update, delete')
  and not has_table_privilege('authenticated', 'private.push_deliveries', 'select, insert, update, delete')
  and not has_table_privilege('service_role', 'private.push_deliveries', 'select, insert, update, delete'),
  'CA-40: no API role has a privilege on private.push_deliveries'
);
select fk_ok(
  'private', 'push_deliveries', array['recipient_member_id', 'household_id'],
  'public', 'household_members', array['id', 'household_id'],
  'the recipient is a member of the household'
);
select fk_ok(
  'private', 'push_deliveries', array['notification_id', 'recipient_member_id', 'household_id'],
  'public', 'notifications', array['id', 'recipient_member_id', 'household_id'],
  'the notification belongs to the same recipient and household'
);
select has_index('private', 'push_deliveries', 'push_deliveries_single_key', 'one delivery per notification');
select has_index('private', 'push_deliveries', 'push_deliveries_digest_key', 'one digest per recipient, kind and day');
select has_index('private', 'push_deliveries', 'push_deliveries_due_idx', 'index of the open deliveries by due time');
select throws_ok(
  $$ insert into private.push_deliveries (household_id, recipient_member_id, kind, notification_id, digest_day, due_at)
     values ('11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001', 'single', null,
             current_date, now()) $$,
  '23514', null,
  'a single delivery has a notification and no day'
);
-- N10: a notification of Davide, without delivery.
insert into public.notifications (id, household_id, recipient_member_id, kind, actor_member_id, item_count)
values ('a9000000-0000-4000-8000-000000000010', '11111111-1111-4111-8111-111111111111',
        'a1000000-0000-4000-8000-000000000006', 'shopping_added', 'a1000000-0000-4000-8000-000000000002', 2);
select throws_ok(
  $$ insert into private.push_deliveries (household_id, recipient_member_id, kind, notification_id, due_at)
     values ('11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001', 'single',
             'a9000000-0000-4000-8000-000000000010', now()) $$,
  '23503', null,
  'a delivery never carries the notification of somebody else'
);
select ok(
  (select bool_and(p.prosecdef and p.proconfig @> array['search_path=""']) from pg_proc p
   where p.oid in ('public.claim_push_deliveries(integer, timestamptz)'::regprocedure,
                   'public.list_push_targets(uuid, uuid)'::regprocedure,
                   'public.get_push_content(uuid, uuid)'::regprocedure,
                   'public.complete_push_delivery(uuid, uuid)'::regprocedure,
                   'public.fail_push_delivery(uuid, uuid, timestamptz)'::regprocedure,
                   'public.remove_push_subscription(uuid)'::regprocedure,
                   'private.notification_is_visible(uuid)'::regprocedure)),
  'the functions of the service and the visibility check: security definer, empty search_path'
);
select ok(
  (select bool_and(
     has_function_privilege('service_role', p.oid, 'execute')
     and not has_function_privilege('authenticated', p.oid, 'execute')
     and not has_function_privilege('anon', p.oid, 'execute'))
   from pg_proc p
   where p.oid in ('public.claim_push_deliveries(integer, timestamptz)'::regprocedure,
                   'public.list_push_targets(uuid, uuid)'::regprocedure,
                   'public.get_push_content(uuid, uuid)'::regprocedure,
                   'public.complete_push_delivery(uuid, uuid)'::regprocedure,
                   'public.fail_push_delivery(uuid, uuid, timestamptz)'::regprocedure,
                   'public.remove_push_subscription(uuid)'::regprocedure)),
  'CA-34, CA-40: the functions of the service only for service_role'
);
select ok(
  not has_function_privilege('anon', 'private.event_open_to_member(uuid, uuid)', 'execute')
  and not has_function_privilege('authenticated', 'private.event_open_to_member(uuid, uuid)', 'execute')
  and not has_function_privilege('anon', 'private.push_content(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'private.push_content(uuid)', 'execute')
  and not has_function_privilege('service_role', 'private.push_content(uuid)', 'execute')
  and not has_function_privilege('anon', 'private.notification_is_visible(uuid)', 'execute'),
  'the helpers: the database owner only (the visibility check also for the policy of the reader)'
);
select hasnt_function(
  'private', 'notification_is_visible',
  array['notification_kind', 'uuid', 'uuid', 'uuid', 'date', 'uuid'],
  'the previous visibility check is gone: one source only'
);

-- ---------------------------------------------------------------------------
-- One source for «sees the event in full»: private.event_open_to_member() gives the same
-- answer as the select policy of events (LEZIONI: no rule copied without a test)
-- ---------------------------------------------------------------------------
select set_config('test.open_marco', (
  select coalesce(string_agg(e.id::text, ',' order by e.id), '') from public.events e
  where private.event_open_to_member(e.id, 'a1000000-0000-4000-8000-000000000001')), true);
select set_config('test.open_laura', (
  select coalesce(string_agg(e.id::text, ',' order by e.id), '') from public.events e
  where private.event_open_to_member(e.id, 'a1000000-0000-4000-8000-000000000002')), true);
select set_config('test.open_davide', (
  select coalesce(string_agg(e.id::text, ',' order by e.id), '') from public.events e
  where private.event_open_to_member(e.id, 'a1000000-0000-4000-8000-000000000006')), true);
select set_config('test.open_giulia', (
  select coalesce(string_agg(e.id::text, ',' order by e.id), '') from public.events e
  where private.event_open_to_member(e.id, 'b1000000-0000-4000-8000-000000000001')), true);
select is(
  current_setting('test.open_marco'),
  'a8000000-0000-4000-8000-000000000001,a8000000-0000-4000-8000-000000000002,a8000000-0000-4000-8000-000000000004,'
  || 'a8000000-0000-4000-8000-000000000006,a8000000-0000-4000-8000-000000000007,a8000000-0000-4000-8000-000000000008',
  'Marco sees in full: household, his own, picked up by him, with him'
);
select is(
  current_setting('test.open_davide'),
  'a8000000-0000-4000-8000-000000000001,a8000000-0000-4000-8000-000000000004,a8000000-0000-4000-8000-000000000005,'
  || 'a8000000-0000-4000-8000-000000000008',
  'Davide sees in full: household and the one he was chosen for'
);

set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select is(
  (select coalesce(string_agg(e.id::text, ',' order by e.id), '') from public.events e),
  current_setting('test.open_marco'),
  'same answer as the policy for Marco'
);
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}';
select is(
  (select coalesce(string_agg(e.id::text, ',' order by e.id), '') from public.events e),
  current_setting('test.open_laura'),
  'same answer as the policy for Laura'
);
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000003","role":"authenticated"}';
select is(
  (select coalesce(string_agg(e.id::text, ',' order by e.id), '') from public.events e),
  current_setting('test.open_davide'),
  'same answer as the policy for Davide'
);
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select is(
  (select coalesce(string_agg(e.id::text, ',' order by e.id), '') from public.events e
   where e.household_id = '11111111-1111-4111-8111-111111111111'),
  current_setting('test.open_giulia'),
  'same answer as the policy for Giulia of Casa Bianchi: nothing of Casa D''Angelo'
);
select is(current_setting('test.open_giulia'), '', 'Giulia sees no event of Casa D''Angelo');

-- ---------------------------------------------------------------------------
-- The page reads its notifications with the same source
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select results_eq(
  $$ select n.id from public.notifications n order by n.id $$,
  $$ values ('a9000000-0000-4000-8000-000000000001'::uuid), ('a9000000-0000-4000-8000-000000000002'::uuid),
            ('a9000000-0000-4000-8000-000000000004'::uuid), ('a9000000-0000-4000-8000-000000000005'::uuid),
            ('a9000000-0000-4000-8000-000000000006'::uuid), ('a9000000-0000-4000-8000-000000000008'::uuid) $$,
  'Marco reads his notifications, not the one about the busy event of Laura'
);
select ok(
  private.notification_is_visible('a9000000-0000-4000-8000-000000000001')
  and not private.notification_is_visible('a9000000-0000-4000-8000-000000000003')
  and not private.notification_is_visible('a9000000-0000-4000-8000-000000000007'),
  'for a signed-in caller the check answers only about the caller''s notifications'
);
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}';
select results_eq(
  $$ select n.id from public.notifications n $$,
  $$ values ('a9000000-0000-4000-8000-000000000007'::uuid) $$,
  'Laura reads only her own notification'
);
select ok(
  not private.notification_is_visible('a9000000-0000-4000-8000-000000000001'),
  'Laura cannot ask about a notification of Marco'
);
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select is_empty($$ select n.id from public.notifications n $$, 'CA-40: Giulia reads no notification of Casa D''Angelo');

-- authenticated and anon cannot use the service.
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($$ select * from public.claim_push_deliveries(10, now()) $$, '42501', null, 'CA-34: authenticated cannot claim');
select throws_ok(
  $$ select * from public.get_push_content('ad000000-0000-4000-8000-000000000001', gen_random_uuid()) $$,
  '42501', null, 'authenticated cannot read a push content'
);
select throws_ok($$ select 1 from private.push_deliveries $$, '42501', null, 'CA-40: authenticated cannot read the deliveries');
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok($$ select * from public.claim_push_deliveries(10, now()) $$, '42501', null, 'CA-34: anon cannot claim');
select throws_ok(
  $$ select * from public.list_push_targets('ad000000-0000-4000-8000-000000000001', gen_random_uuid()) $$,
  '42501', null, 'anon cannot read the devices of a delivery'
);

-- ---------------------------------------------------------------------------
-- CA-34: two claims, the second gets nothing
-- ---------------------------------------------------------------------------
set local role service_role;
set local request.jwt.claims to '{"role":"service_role"}';

select throws_ok($$ select 1 from private.push_deliveries $$, '42501', null, 'CA-40: service_role reads the deliveries only through the functions');
select set_config('test.claim1', (
  select coalesce(jsonb_agg(to_jsonb(c) order by c.id), '[]'::jsonb)::text
  from public.claim_push_deliveries(10, now()) c), true);
select results_eq(
  $$ select (e ->> 'id')::uuid, e ->> 'kind', (e ->> 'attempts')::integer
     from jsonb_array_elements(current_setting('test.claim1')::jsonb) e order by 1 $$,
  $$ values ('ad000000-0000-4000-8000-000000000001'::uuid, 'single', 0),
            ('ad000000-0000-4000-8000-000000000002'::uuid, 'single', 0),
            ('ad000000-0000-4000-8000-000000000003'::uuid, 'single', 0),
            ('ad000000-0000-4000-8000-000000000004'::uuid, 'single', 0),
            ('ad000000-0000-4000-8000-000000000005'::uuid, 'single', 0),
            ('ad000000-0000-4000-8000-000000000006'::uuid, 'single', 0),
            ('ad000000-0000-4000-8000-000000000007'::uuid, 'single', 0),
            ('ad000000-0000-4000-8000-000000000008'::uuid, 'single', 0) $$,
  'CA-34: the first claim takes the eight due deliveries (not the summary of tonight)'
);
select is(
  (select count(distinct e ->> 'claim_token')::integer
   from jsonb_array_elements(current_setting('test.claim1')::jsonb) e
   where e ->> 'claim_token' is not null),
  1,
  'CA-34: with one claim token'
);
select set_config('test.token', current_setting('test.claim1')::jsonb -> 0 ->> 'claim_token', true);
select is_empty($$ select c.id from public.claim_push_deliveries(10, now()) c $$, 'CA-34: the second claim gets nothing');
select throws_ok($$ select * from public.claim_push_deliveries(0, now()) $$, '22023', null, 'a limit of 0 is refused');
select throws_ok($$ select * from public.claim_push_deliveries(51, now()) $$, '22023', null, 'a limit of 51 is refused');
select throws_ok($$ select * from public.claim_push_deliveries(10, null) $$, '22023', null, 'an instant is required');
set local request.method to 'GET';
select throws_ok($$ select * from public.claim_push_deliveries(10, now()) $$, 'P0001', 'use POST', 'claim: GET is refused');
select throws_ok(
  $$ select * from public.get_push_content('ad000000-0000-4000-8000-000000000001', current_setting('test.token')::uuid) $$,
  'P0001', 'use POST', 'content: GET is refused'
);
set local request.method to 'POST';

-- ---------------------------------------------------------------------------
-- CA-35: the devices of the recipient only, with the right token only
-- ---------------------------------------------------------------------------
select results_eq(
  $$ select t.id, t.platform::text, t.endpoint, t.p256dh, t.auth, t.token
     from public.list_push_targets('ad000000-0000-4000-8000-000000000001', current_setting('test.token')::uuid) t $$,
  $$ values ('ac000000-0000-4000-8000-000000000001'::uuid, 'web', 'https://fcm.googleapis.com/fcm/send/marco',
             repeat('B', 87), repeat('a', 22), null::text),
            ('ac000000-0000-4000-8000-000000000002'::uuid, 'fcm', null::text, null::text, null::text, 'fcm:marco') $$,
  'CA-35: the two devices of Marco, with their keys'
);
select is_empty(
  $$ select t.id from public.list_push_targets('ad000000-0000-4000-8000-000000000001', gen_random_uuid()) t $$,
  'CA-35: a wrong token gives no device'
);
select results_eq(
  $$ select t.id from public.list_push_targets('ad000000-0000-4000-8000-000000000007', current_setting('test.token')::uuid) t $$,
  $$ values ('ac000000-0000-4000-8000-000000000003'::uuid) $$,
  'CA-35: the delivery of Laura goes only to the device of Laura'
);

-- ---------------------------------------------------------------------------
-- CA-36: what a push may say, contents visible
-- ---------------------------------------------------------------------------
select results_eq(
  $$ select c.notification_id, c.kind::text, c.line is null, c.at, c.title, c.place, c.person_name, c.item_count, c.is_hidden
     from public.get_push_content('ad000000-0000-4000-8000-000000000001', current_setting('test.token')::uuid) c $$,
  $$ values ('a9000000-0000-4000-8000-000000000001'::uuid, 'event_time_changed', true, '2026-12-03 18:00+01'::timestamptz,
             'Calcio di Tommaso', 'Campo sportivo', 'Laura', null::integer, false) $$,
  'CA-36: a «Tutto il Nest» event: title, place, who changed it'
);
select results_eq(
  $$ select c.at, c.title, c.place, c.person_name, c.is_hidden
     from public.get_push_content('ad000000-0000-4000-8000-000000000002', current_setting('test.token')::uuid) c $$,
  $$ values ('2026-12-03 17:00+01'::timestamptz, null::text, null::text, 'Laura', false) $$,
  'CA-36: a «Occupato» event of Marco: no title and no place, also with contents visible (mn1-39)'
);
select results_eq(
  $$ select c.at, c.title, c.place
     from public.get_push_content('ad000000-0000-4000-8000-000000000005', current_setting('test.token')::uuid) c $$,
  $$ values ('2026-12-10 17:30+01'::timestamptz, 'Nuoto di Sofia', 'Piscina nuova') $$,
  'a moved occurrence: its own start and place'
);
select results_eq(
  $$ select c.kind::text, c.at, c.title, c.place, c.person_name, c.item_count, c.is_hidden
     from public.get_push_content('ad000000-0000-4000-8000-000000000004', current_setting('test.token')::uuid) c $$,
  $$ values ('shopping_added', null::timestamptz, null::text, null::text, 'Laura', 3, false) $$,
  'the shopping list: who added and how many things'
);
select results_eq(
  $$ select c.kind::text, c.at, c.title, c.person_name
     from public.get_push_content('ad000000-0000-4000-8000-000000000006', current_setting('test.token')::uuid) c $$,
  $$ select 'deadline_reminder',
            (select d.due_date from public.deadlines d where d.id = 'a5000000-0000-4000-8000-000000000001')::timestamp
              at time zone 'Europe/Rome',
            'Rinnovo carta d''identità di Sofia', null::text $$,
  'a deadline: its title and its day'
);

-- «Nascondi il contenuto» of Marco.
reset role;
insert into public.notification_preferences (household_id, member_id, hide_content)
values ('11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001', true);
set local role service_role;

select results_eq(
  $$ select c.notification_id, c.kind::text, c.at, c.title, c.place, c.person_name, c.is_hidden
     from public.get_push_content('ad000000-0000-4000-8000-000000000001', current_setting('test.token')::uuid) c $$,
  $$ values ('a9000000-0000-4000-8000-000000000001'::uuid, 'event_time_changed', '2026-12-03 18:00+01'::timestamptz,
             null::text, null::text, null::text, true) $$,
  'CA-36: with «Nascondi il contenuto» no title, place or name, and is_hidden'
);
select results_eq(
  $$ select c.person_name, c.item_count, c.is_hidden
     from public.get_push_content('ad000000-0000-4000-8000-000000000004', current_setting('test.token')::uuid) c $$,
  $$ values (null::text, 3, true) $$,
  'with «Nascondi il contenuto» the shopping list keeps only the number'
);
select results_eq(
  $$ select c.title, c.is_hidden
     from public.get_push_content('ad000000-0000-4000-8000-000000000006', current_setting('test.token')::uuid) c $$,
  $$ values (null::text, true) $$,
  'with «Nascondi il contenuto» the deadline has no title'
);
select results_eq(
  $$ select c.person_name, c.is_hidden
     from public.get_push_content('ad000000-0000-4000-8000-000000000007', current_setting('test.token')::uuid) c $$,
  $$ values ('Marco', false) $$,
  'the choice is personal: the push of Laura still names Marco'
);
select is_empty(
  $$ select c.notification_id from public.get_push_content('ad000000-0000-4000-8000-000000000001', gen_random_uuid()) c $$,
  'a wrong token gives no content'
);

-- ---------------------------------------------------------------------------
-- CA-38: a notification no longer visible gives 0 rows and its delivery is closed
-- ---------------------------------------------------------------------------
select is_empty(
  $$ select c.notification_id from public.get_push_content('ad000000-0000-4000-8000-000000000003', current_setting('test.token')::uuid) c $$,
  'CA-38: the busy event of Laura without Marco: no content'
);
reset role;
update public.events set visibility = 'busy' where id = 'a8000000-0000-4000-8000-000000000008';
set local role service_role;
select is_empty(
  $$ select c.notification_id from public.get_push_content('ad000000-0000-4000-8000-000000000008', current_setting('test.token')::uuid) c $$,
  'CA-38: an event become «Occupato» of Laura without Marco: no content'
);
reset role;
select results_eq(
  $$ select d.id, d.outcome, d.closed_at is not null, d.claim_token is null
     from private.push_deliveries d
     where d.id in ('ad000000-0000-4000-8000-000000000003', 'ad000000-0000-4000-8000-000000000008')
     order by d.id $$,
  $$ values ('ad000000-0000-4000-8000-000000000003'::uuid, 'skipped', true, true),
            ('ad000000-0000-4000-8000-000000000008'::uuid, 'skipped', true, true) $$,
  'CA-38: both deliveries are closed without sending'
);
select results_eq(
  $$ select d.id, d.closed_at is null
     from private.push_deliveries d
     where d.id in ('ad000000-0000-4000-8000-000000000001', 'ad000000-0000-4000-8000-000000000002')
     order by d.id $$,
  $$ values ('ad000000-0000-4000-8000-000000000001'::uuid, true),
            ('ad000000-0000-4000-8000-000000000002'::uuid, true) $$,
  'reading a visible content closes nothing'
);

-- ---------------------------------------------------------------------------
-- CA-39: complete, fail, five attempts, remove a device
-- ---------------------------------------------------------------------------
set local role service_role;
select is(
  public.complete_push_delivery('ad000000-0000-4000-8000-000000000002', current_setting('test.token')::uuid),
  true,
  'CA-39: the delivery is completed'
);
select is(
  public.complete_push_delivery('ad000000-0000-4000-8000-000000000002', current_setting('test.token')::uuid),
  false,
  'CA-39: completed twice: false'
);
select is(
  public.complete_push_delivery('ad000000-0000-4000-8000-000000000004', gen_random_uuid()),
  false,
  'a wrong token completes nothing'
);
select is_empty(
  $$ select t.id from public.list_push_targets('ad000000-0000-4000-8000-000000000002', current_setting('test.token')::uuid) t $$,
  'a closed delivery has no device to send to'
);

-- Every claim expires (as if the service had died): the open deliveries are due again.
reset role;
update private.push_deliveries set claimed_until = now() - interval '1 second' where claim_token is not null;
set local role service_role;
select set_config('test.claim2', (
  select coalesce(jsonb_agg(to_jsonb(c) order by c.id), '[]'::jsonb)::text
  from public.claim_push_deliveries(50, now()) c), true);
select results_eq(
  $$ select (e ->> 'id')::uuid from jsonb_array_elements(current_setting('test.claim2')::jsonb) e order by 1 $$,
  $$ values ('ad000000-0000-4000-8000-000000000001'::uuid), ('ad000000-0000-4000-8000-000000000004'::uuid),
            ('ad000000-0000-4000-8000-000000000005'::uuid), ('ad000000-0000-4000-8000-000000000006'::uuid),
            ('ad000000-0000-4000-8000-000000000007'::uuid) $$,
  'CA-39: completed and closed deliveries are never claimed again'
);
select set_config('test.token2', current_setting('test.claim2')::jsonb -> 0 ->> 'claim_token', true);
select is(
  public.complete_push_delivery('ad000000-0000-4000-8000-000000000001', current_setting('test.token')::uuid),
  false,
  'the old token of an expired claim completes nothing'
);

select is(
  public.fail_push_delivery('ad000000-0000-4000-8000-000000000004', current_setting('test.token2')::uuid, now() + interval '10 minutes'),
  true,
  'CA-39: the delivery failed'
);
reset role;
select results_eq(
  $$ select d.attempts, d.due_at, d.claim_token is null, d.closed_at is null
     from private.push_deliveries d where d.id = 'ad000000-0000-4000-8000-000000000004' $$,
  $$ values (1, now() + interval '10 minutes', true, true) $$,
  'CA-39: one attempt, due again at the given time, free'
);
set local role service_role;
select is_empty(
  $$ select c.id from public.claim_push_deliveries(50, now()) c $$,
  'CA-39: not due before that time'
);
select set_config('test.claim3', (
  select coalesce(jsonb_agg(to_jsonb(c) order by c.id), '[]'::jsonb)::text
  from public.claim_push_deliveries(50, now() + interval '11 minutes') c), true);
select results_eq(
  $$ select (e ->> 'id')::uuid, (e ->> 'attempts')::integer
     from jsonb_array_elements(current_setting('test.claim3')::jsonb) e $$,
  $$ values ('ad000000-0000-4000-8000-000000000004'::uuid, 1) $$,
  'CA-39: due again at the given time'
);
select set_config('test.token3', current_setting('test.claim3')::jsonb -> 0 ->> 'claim_token', true);

-- The fifth attempt.
reset role;
update private.push_deliveries set attempts = 4 where id = 'ad000000-0000-4000-8000-000000000004';
set local role service_role;
select is(
  public.fail_push_delivery('ad000000-0000-4000-8000-000000000004', current_setting('test.token3')::uuid, now() + interval '1 minute'),
  true,
  'CA-39: the fifth attempt failed'
);
reset role;
select results_eq(
  $$ select d.attempts, d.outcome, d.closed_at is not null, d.claim_token is null
     from private.push_deliveries d where d.id = 'ad000000-0000-4000-8000-000000000004' $$,
  $$ values (5, 'failed', true, true) $$,
  'CA-39: after 5 attempts the delivery is closed'
);
set local role service_role;
select set_config('test.claim4', (
  select coalesce(jsonb_agg(to_jsonb(c) order by c.id), '[]'::jsonb)::text
  from public.claim_push_deliveries(50, now() + interval '1 day') c), true);
select results_eq(
  $$ select (e ->> 'id')::uuid, e ->> 'kind' from jsonb_array_elements(current_setting('test.claim4')::jsonb) e $$,
  $$ values ('ad000000-0000-4000-8000-000000000009'::uuid, 'evening_digest') $$,
  'CA-39: after 5 attempts never again (only the summary of tonight is due tomorrow)'
);
select is_empty(
  $$ select c.notification_id from public.get_push_content(
       'ad000000-0000-4000-8000-000000000009', (current_setting('test.claim4')::jsonb -> 0 ->> 'claim_token')::uuid) c $$,
  'part 1: a summary has no content yet (part 2 of #511)'
);
select throws_ok(
  $$ select public.fail_push_delivery('ad000000-0000-4000-8000-000000000005', current_setting('test.token2')::uuid, null) $$,
  '22023', null, 'a retry time is required'
);
select throws_ok(
  $$ select public.fail_push_delivery('ad000000-0000-4000-8000-000000000005', current_setting('test.token2')::uuid, 'infinity') $$,
  '22023', null, 'a finite retry time is required'
);
select is(
  public.remove_push_subscription('ac000000-0000-4000-8000-000000000002'),
  true,
  'CA-39: the push service no longer knows the phone of Marco: removed'
);
select is(public.remove_push_subscription('ac000000-0000-4000-8000-000000000002'), false, 'removed twice: false');
select results_eq(
  $$ select t.id from public.list_push_targets('ad000000-0000-4000-8000-000000000001', current_setting('test.token2')::uuid) t $$,
  $$ values ('ac000000-0000-4000-8000-000000000001'::uuid) $$,
  'CA-39: Marco has only his browser left'
);

-- ---------------------------------------------------------------------------
-- A deleted event: its notification and its delivery go with it
-- ---------------------------------------------------------------------------
reset role;
delete from public.events where id = 'a8000000-0000-4000-8000-000000000001';
select ok(
  not exists (select 1 from private.push_deliveries d where d.id = 'ad000000-0000-4000-8000-000000000001'),
  'CA-38: the event is deleted: the delivery goes with its notification'
);
set local role service_role;
select is_empty(
  $$ select c.notification_id from public.get_push_content('ad000000-0000-4000-8000-000000000001', current_setting('test.token2')::uuid) c $$,
  'CA-38: no content for a deleted event'
);

-- ---------------------------------------------------------------------------
-- Cleanup of the closed deliveries after 2 days
-- ---------------------------------------------------------------------------
reset role;
update private.push_deliveries set closed_at = now() - interval '3 days' where id = 'ad000000-0000-4000-8000-000000000002';
update private.push_deliveries set closed_at = now() - interval '1 day' where id = 'ad000000-0000-4000-8000-000000000003';
select lives_ok($$ select private.push_purge(now(), null) $$, 'the cleanup runs');
select ok(
  not exists (select 1 from private.push_deliveries d where d.id = 'ad000000-0000-4000-8000-000000000002'),
  'rule 7: closed 3 days ago: deleted'
);
select ok(
  exists (select 1 from private.push_deliveries d where d.id = 'ad000000-0000-4000-8000-000000000003'),
  'rule 7: closed 1 day ago: kept'
);
select ok(
  exists (select 1 from private.push_deliveries d where d.id = 'ad000000-0000-4000-8000-000000000005'),
  'an open delivery is never cleaned up'
);

select * from finish();
rollback;
