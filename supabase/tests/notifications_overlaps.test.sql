-- The overlapping events of tomorrow (issue #511, DB-2 of plan #501, part 2):
-- overlap_tomorrow at the time of the evening summary of each recipient (CA-23, CA-24),
-- only to who sees both occurrences in full, without duplicates.
-- Seed ids: Marco (Casa D'Angelo, admin, user aaaaaaaa…01, member a1…01), Laura a1…02,
-- Sofia a1…03, Tommaso a1…04. This test gives Laura an account (user aaaaaaaa…02) and adds
-- a third adult, Davide (a1…06, user aaaaaaaa…03). Created here: events c9….
-- Dates: Thursday 3 December 2026 (future), Europe/Rome (+01). The job runs with an
-- explicit instant: Wednesday 2 December at 19:00, the default time of the summary.
begin;
create extension if not exists pgtap with schema extensions;

select plan(10);

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

-- Thursday 3 December:
--   O1 Commercialista     busy, Marco, participant Marco          17:00–18:30
--   O2 Calcio di Tommaso  household, Marco, Tommaso, Marco takes  18:00–19:00
--   O3 Nuoto di Sofia     household, Laura, Sofia                 17:00–18:00
--   O4 Danza di Sofia     busy, Laura, Sofia                      17:30–18:30
-- Marco and Davide see O4 only as «Occupato»; Laura and Davide see O1 only as «Occupato».
insert into public.events (id, household_id, author_member_id, title, starts_at, ends_at, visibility, recurrence,
                           escort_member_id)
values
  ('c9000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001',
   'Commercialista', '2026-12-03 17:00+01', '2026-12-03 18:30+01', 'busy', 'none', null),
  ('c9000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001',
   'Calcio di Tommaso', '2026-12-03 18:00+01', '2026-12-03 19:00+01', 'household', 'none',
   'a1000000-0000-4000-8000-000000000001'),
  ('c9000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000002',
   'Nuoto di Sofia', '2026-12-03 17:00+01', '2026-12-03 18:00+01', 'household', 'none', null),
  ('c9000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000002',
   'Danza di Sofia', '2026-12-03 17:30+01', '2026-12-03 18:30+01', 'busy', 'none', null);
insert into public.event_members (event_id, member_id, household_id)
values
  ('c9000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111'),
  ('c9000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111'),
  ('c9000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111'),
  ('c9000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111');

select is(
  public.run_notification_job('overlaps', '11111111-1111-4111-8111-111111111111', '2026-12-02 18:55+01'),
  0,
  'before the time of the summary, nothing'
);
select is(
  public.run_notification_job('overlaps', '11111111-1111-4111-8111-111111111111', '2026-12-02 19:00+01'),
  2,
  'at 19:00, two overlaps'
);

-- CA-23
select results_eq(
  $$ select n.subject_member_id, n.event_id, n.occurrence_date, n.other_event_id, n.other_occurrence_date
     from public.notifications n
     where n.kind = 'overlap_tomorrow' and n.recipient_member_id = 'a1000000-0000-4000-8000-000000000001' $$,
  $$ values ('a1000000-0000-4000-8000-000000000001'::uuid, 'c9000000-0000-4000-8000-000000000001'::uuid,
             '2026-12-03'::date, 'c9000000-0000-4000-8000-000000000002'::uuid, '2026-12-03'::date) $$,
  'CA-23: Marco is told that the Commercialista and the Calcio overlap for him'
);
select is(
  public.run_notification_job('overlaps', '11111111-1111-4111-8111-111111111111', '2026-12-02 19:05+01'),
  0,
  'CA-23: run again, nothing more'
);

-- CA-24
select results_eq(
  $$ select n.subject_member_id, n.event_id, n.other_event_id
     from public.notifications n
     where n.kind = 'overlap_tomorrow' and n.recipient_member_id = 'a1000000-0000-4000-8000-000000000002' $$,
  $$ values ('a1000000-0000-4000-8000-000000000003'::uuid, 'c9000000-0000-4000-8000-000000000003'::uuid,
             'c9000000-0000-4000-8000-000000000004'::uuid) $$,
  'CA-24: Laura, author of both, is told that Nuoto and Danza overlap for Sofia'
);
select is_empty(
  $$ select 1 from public.notifications n
     where n.kind = 'overlap_tomorrow' and n.recipient_member_id = 'a1000000-0000-4000-8000-000000000006' $$,
  'CA-24: Davide, who sees the Danza only as «Occupato», gets nothing'
);
select is_empty(
  $$ select 1 from public.notifications n
     where n.kind = 'overlap_tomorrow' and n.subject_member_id = 'a1000000-0000-4000-8000-000000000003'
       and n.recipient_member_id <> 'a1000000-0000-4000-8000-000000000002' $$,
  'CA-24: nobody else is told about Sofia (Marco does not see the Danza in full)'
);

-- Each one reads only their own, and only while both events are seen in full.
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select results_eq(
  $$ select n.subject_member_id from public.notifications n where n.kind = 'overlap_tomorrow' $$,
  $$ values ('a1000000-0000-4000-8000-000000000001'::uuid) $$,
  'Marco reads only his overlap'
);
reset role;
update public.events set visibility = 'busy' where id = 'c9000000-0000-4000-8000-000000000003';
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}';
select isnt_empty(
  $$ select 1 from public.notifications n where n.kind = 'overlap_tomorrow' $$,
  'Laura, the author, still sees both events in full: her overlap stays'
);
reset role;
delete from public.events where id = 'c9000000-0000-4000-8000-000000000004';
select is_empty(
  $$ select 1 from public.notifications n where n.recipient_member_id = 'a1000000-0000-4000-8000-000000000002' $$,
  'the other event deleted: the overlap goes with it'
);

select * from finish();
rollback;
