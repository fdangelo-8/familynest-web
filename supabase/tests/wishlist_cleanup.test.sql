-- Wish list (issue #259): how long the data stay (#32 §11, CA-49 … CA-51).
-- - the cleanup 30 days after the occasion: public.run_wishlist_cleanup() by service_role
--   for one household and a given day (CA-50), the pg_cron job for every household;
-- - deleting an idea deletes its photo, its reservation and its «Regalo preso» notification
--   (CA-33, CA-49);
-- - a member who leaves keeps the ideas they added, without author;
-- - removing a child, or deleting the household, deletes list, ideas, photos, links,
--   reservations and notifications (CA-51).
-- Seed ids: as in wishlists.test.sql. Marco a1…01 (user A) is the only adult with an account
-- of Casa D'Angelo; Casa Bianchi has Giulia b1…01 (B) and Paolo b1…02 (B2), Leo b1…03 (child).
-- Seed list of Sofia d1…01: free Diario d2…06, Acquerelli d2…05, Cuffie d2…04, Biglietti
-- d2…03; Casco d2…01 and Puzzle d2…02 taken with the disabled link d3…01.
begin;
create extension if not exists pgtap with schema extensions;

select plan(35);

-- ---------------------------------------------------------------------------
-- Schema, privileges, schedule
-- ---------------------------------------------------------------------------
select has_function('public', 'run_wishlist_cleanup', array['uuid', 'date'], 'run_wishlist_cleanup exists');
select ok(
  has_function_privilege('service_role', 'public.run_wishlist_cleanup(uuid, date)', 'execute')
  and not has_function_privilege('authenticated', 'public.run_wishlist_cleanup(uuid, date)', 'execute')
  and not has_function_privilege('anon', 'public.run_wishlist_cleanup(uuid, date)', 'execute'),
  'only the administrative key runs the cleanup for the tests'
);
select ok(
  not has_function_privilege('authenticated', 'private.purge_past_wishlist_occasions(date, uuid)', 'execute')
  and not has_function_privilege('service_role', 'private.run_scheduled_wishlist_cleanup()', 'execute'),
  'the cleanup of every household is not callable by the app nor by the administrative key'
);
select results_eq(
  $$ select j.schedule, j.command from cron.job j where j.jobname = 'purge-past-wishlist-occasions' $$,
  $$ values ('40 2 * * *'::text, 'select private.run_scheduled_wishlist_cleanup();'::text) $$,
  'pg_cron runs the cleanup every day'
);

set local role service_role;
set local request.method to 'GET';
select throws_ok(
  $$ select public.run_wishlist_cleanup('11111111-1111-4111-8111-111111111111', current_date) $$,
  'P0001', 'use POST',
  'the cleanup refuses GET'
);
set local request.method to 'POST';
select throws_ok(
  $$ select public.run_wishlist_cleanup(null, current_date) $$,
  '22023', null,
  'the household is required (never every household from the API)'
);
reset role;

-- ---------------------------------------------------------------------------
-- CA-50: the occasion of the seed link is X = 10/01/2026; one more link of the same list
-- for the next year (X2 = 10/01/2027), with a reservation of the Diario. Casa Bianchi: the
-- list of Leo with an idea taken for X too.
-- ---------------------------------------------------------------------------
update public.wishlist_share_links set occasion_date = '2026-01-10', expires_at = '2026-01-12 00:00+01'
where id = 'd3000000-0000-4000-8000-000000000001';
insert into public.wishlist_share_links (id, household_id, wishlist_id, occasion_date, expires_at)
values ('d3000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111',
        'd1000000-0000-4000-8000-000000000001', '2027-01-10', '2027-01-12 00:00+01');
insert into public.wishlist_item_photos (item_id, household_id, content_type, data)
values ('d2000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'image/webp',
        '\x524946460000000057454250'::bytea);
insert into public.wishlist_reservations (id, household_id, item_id, share_link_id, giver_name)
values ('d4000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111',
        'd2000000-0000-4000-8000-000000000006', 'd3000000-0000-4000-8000-000000000002', 'Nonna Rosa');
insert into public.wishlists (id, household_id, member_id)
values ('d1000000-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000003');
insert into public.wishlist_items (id, household_id, wishlist_id, title, added_by_member_id)
values ('d2000000-0000-4000-8000-000000000201', '22222222-2222-4222-8222-222222222222', 'd1000000-0000-4000-8000-000000000003',
        'Trottola', 'b1000000-0000-4000-8000-000000000002'),
       ('d2000000-0000-4000-8000-000000000202', '22222222-2222-4222-8222-222222222222', 'd1000000-0000-4000-8000-000000000003',
        'Aquilone', 'b1000000-0000-4000-8000-000000000002');
insert into public.wishlist_share_links (id, household_id, wishlist_id, occasion_date, expires_at, disabled_at)
values ('d3000000-0000-4000-8000-000000000004', '22222222-2222-4222-8222-222222222222', 'd1000000-0000-4000-8000-000000000003',
        '2026-01-10', '2026-01-12 00:00+01', '2026-01-05 10:00+01');
insert into public.wishlist_reservations (id, household_id, item_id, share_link_id, giver_name)
values ('d4000000-0000-4000-8000-000000000004', '22222222-2222-4222-8222-222222222222',
        'd2000000-0000-4000-8000-000000000201', 'd3000000-0000-4000-8000-000000000004', 'Zio Luca');

select is(
  (select count(*)::integer from public.notifications n where n.kind = 'gift_taken'),
  3,
  'the reservations written here notified Marco (1) and Giulia and Paolo (2)'
);

set local role service_role;
set local request.method to 'POST';
select is(public.run_wishlist_cleanup('11111111-1111-4111-8111-111111111111', '2026-02-08'), 0, 'X+29: nothing is deleted');
select is(public.run_wishlist_cleanup('11111111-1111-4111-8111-111111111111', '2026-02-09'), 0, 'X+30: nothing is deleted');
reset role;
select is((select count(*)::integer from public.wishlist_reservations), 4, 'the four reservations are still there');

set local role service_role;
set local request.method to 'POST';
select is(public.run_wishlist_cleanup('11111111-1111-4111-8111-111111111111', '2026-02-10'), 1, 'X+31: the link of X is deleted');
reset role;
select ok(
  not exists (select 1 from public.wishlist_reservations r where r.giver_name in ('Nonna Anna', 'Zia Carla')),
  'the reservations of «Nonna Anna» and «Zia Carla» are gone'
);
select ok(
  not exists (select 1 from public.wishlist_items i
              where i.id in ('d2000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000002')),
  'the ideas taken for X (Casco, Puzzle) are gone'
);
select ok(
  not exists (select 1 from public.wishlist_item_photos p where p.item_id = 'd2000000-0000-4000-8000-000000000001'),
  'with their photos'
);
select ok(
  not exists (select 1 from public.wishlist_share_links l where l.id = 'd3000000-0000-4000-8000-000000000001'),
  'the link of X is gone'
);
select results_eq(
  $$ select i.title from public.wishlist_items i
     where i.wishlist_id = 'd1000000-0000-4000-8000-000000000001' order by i.created_at desc $$,
  $$ values ('Diario segreto con lucchetto'), ('Set di acquerelli con pennelli'), ('Cuffie senza fili per bambini'),
            ('Biglietti per il musical') $$,
  'the other ideas stay (also the Diario, taken for the next occasion)'
);
select results_eq(
  $$ select r.giver_name from public.wishlist_reservations r order by 1 $$,
  $$ values ('Nonna Rosa'), ('Zio Luca') $$,
  'the reservation for the next occasion and those of Casa Bianchi stay'
);
select is(
  (select count(*)::integer from public.notifications n where n.household_id = '22222222-2222-4222-8222-222222222222'),
  2,
  'the cleanup of one household never touches another one'
);
-- The scheduled job works on every household.
select is(private.run_scheduled_wishlist_cleanup(), 1, 'the pg_cron job deletes the old link of Casa Bianchi');
select ok(
  not exists (select 1 from public.wishlist_reservations r where r.giver_name = 'Zio Luca')
  and not exists (select 1 from public.wishlist_items i where i.id = 'd2000000-0000-4000-8000-000000000201')
  and exists (select 1 from public.wishlist_items i where i.id = 'd2000000-0000-4000-8000-000000000202'),
  'Casa Bianchi: the reservation and the idea taken are gone, the idea not taken stays'
);
select is(
  (select count(*)::integer from public.notifications n where n.household_id = '22222222-2222-4222-8222-222222222222'),
  0,
  'and the «Regalo preso» notifications of that reservation are gone'
);

-- ---------------------------------------------------------------------------
-- CA-33, CA-49: Marco deletes the Diario, taken by «Nonna Rosa»: reservation and
-- notification go with it.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
set local request.method to 'POST';
select is(
  (select count(*)::integer from public.notifications n where n.kind = 'gift_taken'),
  1,
  'Marco sees the notification of «Nonna Rosa»'
);
select lives_ok(
  $$ select public.delete_wishlist_item('d2000000-0000-4000-8000-000000000006') $$,
  'Marco deletes the Diario'
);
select is(
  (select count(*)::integer from public.notifications n where n.kind = 'gift_taken'),
  0,
  'the notification is gone'
);
select is(public.count_unread_notifications(), 0, 'and it does not count in the bell');
reset role;
select ok(
  not exists (select 1 from public.wishlist_reservations r where r.giver_name = 'Nonna Rosa')
  and not exists (select 1 from public.notifications n where n.kind = 'gift_taken'),
  'no reservation and no notification of «Nonna Rosa» are left'
);

-- ---------------------------------------------------------------------------
-- A member who leaves: the ideas they added stay, without author.
-- ---------------------------------------------------------------------------
delete from public.household_members m where m.id = 'b1000000-0000-4000-8000-000000000002';
select results_eq(
  $$ select i.title, i.added_by_member_id from public.wishlist_items i
     where i.household_id = '22222222-2222-4222-8222-222222222222' $$,
  $$ values ('Aquilone', null::uuid) $$,
  'the idea added by Paolo stays in the list of Leo, without author'
);

-- ---------------------------------------------------------------------------
-- CA-51: removing Sofia deletes everything of her list.
-- ---------------------------------------------------------------------------
insert into public.wishlist_item_photos (item_id, household_id, content_type, data)
values ('d2000000-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111', 'image/jpeg',
        '\xffd8ffe000104a46494600010100'::bytea);
insert into public.wishlist_reservations (id, household_id, item_id, share_link_id, giver_name)
values ('d4000000-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111',
        'd2000000-0000-4000-8000-000000000005', 'd3000000-0000-4000-8000-000000000002', 'Nonna Rosa');
select is(
  (select count(*)::integer from public.notifications n where n.household_id = '11111111-1111-4111-8111-111111111111'),
  1,
  'a new reservation of the list of Sofia, with its notification'
);
delete from public.household_members m where m.id = 'a1000000-0000-4000-8000-000000000003';
select is((select count(*)::integer from public.wishlists w where w.household_id = '11111111-1111-4111-8111-111111111111'), 0, 'no list of Sofia');
select is((select count(*)::integer from public.wishlist_items i where i.household_id = '11111111-1111-4111-8111-111111111111'), 0, 'no idea of Sofia');
select is((select count(*)::integer from public.wishlist_item_photos p where p.household_id = '11111111-1111-4111-8111-111111111111'), 0, 'no photo of Sofia');
select is((select count(*)::integer from public.wishlist_share_links l where l.household_id = '11111111-1111-4111-8111-111111111111'), 0, 'no link of Sofia');
select is((select count(*)::integer from public.wishlist_reservations r where r.household_id = '11111111-1111-4111-8111-111111111111'), 0, 'no reservation of Sofia');
select is((select count(*)::integer from public.notifications n where n.household_id = '11111111-1111-4111-8111-111111111111'), 0, 'no notification of the list of Sofia');

-- ---------------------------------------------------------------------------
-- Deleting the household (its last adult with an account deletes the account).
-- ---------------------------------------------------------------------------
delete from public.households h where h.id = '22222222-2222-4222-8222-222222222222';
select is(
  (select count(*)::integer from public.wishlists) + (select count(*)::integer from public.wishlist_items)
  + (select count(*)::integer from public.wishlist_share_links) + (select count(*)::integer from public.wishlist_reservations)
  + (select count(*)::integer from public.wishlist_item_photos),
  0,
  'with Casa Bianchi deleted, nothing of any wish list is left'
);

select * from finish();
rollback;
