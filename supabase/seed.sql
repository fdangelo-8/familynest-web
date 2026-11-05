-- Local seed (issue #9): two test households and one user without a household.
-- Local database and CI only. Users have NO password: they are identities used by
-- the pgTAP tests, which impersonate them. Names are invented, emails use the
-- reserved example.com domain. No health data of any kind.
--
-- Fixed ids (used by the pgTAP tests):
--   users       A  aaaaaaaa-0000-4000-8000-000000000001  Marco (Casa D'Angelo, admin)
--               B  bbbbbbbb-0000-4000-8000-000000000001  Giulia (Casa Bianchi, admin)
--               B2 bbbbbbbb-0000-4000-8000-000000000002  Paolo (Casa Bianchi, not admin)
--               C  cccccccc-0000-4000-8000-000000000001  Chiara (no household)
--   households  Casa D'Angelo 11111111-1111-4111-8111-111111111111
--               Casa Bianchi  22222222-2222-4222-8222-222222222222

-- Accounts (the on_auth_user_created trigger creates the profiles).
insert into auth.users (
  instance_id, id, aud, role, email, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'utente-a@example.com', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Marco D''Angelo"}',
   now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'utente-b@example.com', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Giulia Bianchi"}',
   now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'utente-b2@example.com', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Paolo Bianchi"}',
   now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'cccccccc-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'utente-c@example.com', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Chiara Neri"}',
   now(), now(), '', '', '', '');

-- Both households have the starter list of page #30 already completed (issue #90), so the
-- page tests of the normal state never see it. Page tests of the starter list create a
-- new household (user C). first_shopping_item_at is set by the trigger when the shopping
-- items below are inserted.
insert into public.households (id, name, household_type, created_at, starter_list_completed_at)
values
  ('11111111-1111-4111-8111-111111111111', 'Casa D''Angelo', 'family_with_children', now() - interval '30 days',
   now() - interval '29 days'),
  ('22222222-2222-4222-8222-222222222222', 'Casa Bianchi', 'family_with_children', now() - interval '30 days',
   now() - interval '29 days');

-- Members, in insertion order (created_at one minute apart).
insert into public.household_members (
  id, household_id, kind, name, color, birth_date, user_id, is_admin, joined_at, created_at
)
values
  -- Casa D'Angelo
  ('a1000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'adult', 'Marco', 'pomodoro',
   null, 'aaaaaaaa-0000-4000-8000-000000000001', true, now() - interval '30 days', now() - interval '30 days'),
  ('a1000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'adult', 'Laura', 'glicine',
   null, null, false, null, now() - interval '30 days' + interval '1 minute'),
  ('a1000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'child', 'Sofia', 'salvia',
   '2016-12-14', null, false, null, now() - interval '30 days' + interval '2 minutes'),
  ('a1000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 'child', 'Tommaso', 'cobalto',
   '2020-04-02', null, false, null, now() - interval '30 days' + interval '3 minutes'),
  ('a1000000-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111', 'pet', 'Biscotto', 'zafferano',
   null, null, false, null, now() - interval '30 days' + interval '4 minutes'),
  -- Casa Bianchi
  ('b1000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'adult', 'Giulia', 'cobalto',
   null, 'bbbbbbbb-0000-4000-8000-000000000001', true, now() - interval '30 days', now() - interval '30 days'),
  ('b1000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', 'adult', 'Paolo', 'salvia',
   null, 'bbbbbbbb-0000-4000-8000-000000000002', false, now() - interval '20 days', now() - interval '30 days' + interval '1 minute'),
  ('b1000000-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222222', 'child', 'Leo', 'zafferano',
   '2019-09-05', null, false, null, now() - interval '30 days' + interval '2 minutes'),
  ('b1000000-0000-4000-8000-000000000004', '22222222-2222-4222-8222-222222222222', 'adult', 'Anna', 'pomodoro',
   null, null, false, null, now() - interval '30 days' + interval '3 minutes');

-- Invitations: Laura's is valid (created yesterday, expires in 6 days),
-- Anna's is pending but expired (created 10 days ago, expired 3 days ago).
-- Tokens are generated randomly by the column default.
insert into public.invitations (
  id, household_id, member_id, invited_by_member_id, short_code, status, created_at, expires_at
)
values
  ('a2000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'a1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', '4821', 'pending',
   now() - interval '1 day', now() - interval '1 day' + interval '7 days'),
  ('b2000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222',
   'b1000000-0000-4000-8000-000000000004', 'b1000000-0000-4000-8000-000000000001', '7305', 'pending',
   now() - interval '10 days', now() - interval '10 days' + interval '7 days');

-- Shopping list (issue #62): a few example items per household. Invented items, no
-- personal data. Page tests start from an empty list and must clear these first.
--   Casa D'Angelo: to buy Latte (2 l), Pane, Mele (1 kg); taken Detersivo piatti.
--   Casa Bianchi:  to buy Yogurt (added by Paolo), Biscotti; taken Caffè.
insert into public.shopping_items (
  id, household_id, name, quantity, added_by_member_id, checked_at, created_at
)
values
  ('a3000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Latte', '2 l',
   'a1000000-0000-4000-8000-000000000001', null, now() - interval '2 days'),
  ('a3000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'Pane', null,
   'a1000000-0000-4000-8000-000000000001', null, now() - interval '2 days' + interval '1 minute'),
  ('a3000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'Mele', '1 kg',
   'a1000000-0000-4000-8000-000000000001', null, now() - interval '2 days' + interval '2 minutes'),
  ('a3000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 'Detersivo piatti', null,
   'a1000000-0000-4000-8000-000000000001', now() - interval '1 day', now() - interval '2 days' + interval '3 minutes'),
  ('b3000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'Yogurt', '4',
   'b1000000-0000-4000-8000-000000000002', null, now() - interval '2 days'),
  ('b3000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', 'Biscotti', null,
   'b1000000-0000-4000-8000-000000000001', null, now() - interval '2 days' + interval '1 minute'),
  ('b3000000-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222222', 'Caffè', null,
   'b1000000-0000-4000-8000-000000000001', now() - interval '1 day', now() - interval '2 days' + interval '2 minutes');

-- Things to do (issue #87): a few examples per household. Invented texts, no health
-- data (D1). Due dates are days in Europe/Rome counted from today. Page tests start
-- from an empty list and must clear these first (each household with its own session;
-- the «Solo io» thing of Paolo only with Paolo's session).
--   Casa D'Angelo (created by Marco): Firmare autorizzazione gita (per Sofia, Marco,
--     in 3 days); Comprare la cuffia da nuoto (per Sofia, Laura, in 2 days); Sistemare
--     la cantina (nothing else); Portare le scarpe dal calzolaio (Marco, done yesterday
--     by Marco).
--   Casa Bianchi: Prenotare il ristorante («Solo io» of Paolo, Paolo, tomorrow);
--     Prenotare la palestra (created by Giulia, Paolo, no date).
insert into public.todos (
  id, household_id, title, created_by_member_id, assignee_member_id, for_member_id,
  due_date, is_private, done_at, done_by_member_id, created_at
)
values
  ('a4000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Firmare autorizzazione gita',
   'a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000003',
   (now() at time zone 'Europe/Rome')::date + 3, false, null, null, now() - interval '3 days'),
  ('a4000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'Comprare la cuffia da nuoto',
   'a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000003',
   (now() at time zone 'Europe/Rome')::date + 2, false, null, null, now() - interval '3 days' + interval '1 minute'),
  ('a4000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'Sistemare la cantina',
   'a1000000-0000-4000-8000-000000000001', null, null,
   null, false, null, null, now() - interval '3 days' + interval '2 minutes'),
  ('a4000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 'Portare le scarpe dal calzolaio',
   'a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', null,
   null, false, now() - interval '1 day', 'a1000000-0000-4000-8000-000000000001', now() - interval '3 days' + interval '3 minutes'),
  ('b4000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'Prenotare il ristorante',
   'b1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000002', null,
   (now() at time zone 'Europe/Rome')::date + 1, true, null, null, now() - interval '2 days'),
  ('b4000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', 'Prenotare la palestra',
   'b1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002', null,
   null, false, null, null, now() - interval '2 days' + interval '1 minute');

-- Deadlines (issue #108): a few examples per household. Invented texts, no health data
-- (D1). Due dates are days in Europe/Rome counted from today; reminders are the default
-- 30, 7 and 1 days. Page tests start from an empty list and must clear these first (each
-- household with its own session; the «Solo io» deadline of Paolo only with Paolo's
-- session).
--   Casa D'Angelo (created by Marco): Rinnovo carta d'identità di Sofia (note «Serve per
--     la gita», riguarda Sofia, nobody takes care of it, in 14 days); Bollo dell'auto
--     (Marco, in 48 days).
--   Casa Bianchi: Revisione della caldaia (created by Giulia, Paolo, in 20 days); Rinnovo
--     del passaporto («Solo io» of Paolo, Paolo, in 60 days).
insert into public.deadlines (
  id, household_id, title, due_date, note, created_by_member_id, assignee_member_id, for_member_id,
  is_private, created_at
)
values
  ('a5000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Rinnovo carta d''identità di Sofia',
   (now() at time zone 'Europe/Rome')::date + 14, 'Serve per la gita', 'a1000000-0000-4000-8000-000000000001',
   null, 'a1000000-0000-4000-8000-000000000003', false, now() - interval '3 days'),
  ('a5000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'Bollo dell''auto',
   (now() at time zone 'Europe/Rome')::date + 48, null, 'a1000000-0000-4000-8000-000000000001',
   'a1000000-0000-4000-8000-000000000001', null, false, now() - interval '3 days' + interval '1 minute'),
  ('b5000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'Revisione della caldaia',
   (now() at time zone 'Europe/Rome')::date + 20, null, 'b1000000-0000-4000-8000-000000000001',
   'b1000000-0000-4000-8000-000000000002', null, false, now() - interval '2 days'),
  ('b5000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', 'Rinnovo del passaporto',
   (now() at time zone 'Europe/Rome')::date + 60, null, 'b1000000-0000-4000-8000-000000000002',
   'b1000000-0000-4000-8000-000000000002', null, true, now() - interval '2 days' + interval '1 minute');

-- School, sizes and teachers of a child (issue #219, for page #31): the data of the mockup
-- for Sofia; Tommaso and Leo have none (empty profile). Invented phone number, no address of
-- the school, no health data (D1). The time of the sizes is set by the database. Page tests
-- use their own throwaway households and never change these rows.
insert into public.child_profiles (
  id, household_id, member_id, school_name, school_class, school_starts_at, school_ends_at, school_days,
  school_note, shoe_size, clothing_size, pajama_size
)
values
  ('a6000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'a1000000-0000-4000-8000-000000000003', 'scuola Manzoni', '4ª B', '08:15', '16:15', '{1,2,3,4,5}',
   'mensa compresa', '33', '9–10', '140');

insert into public.child_teachers (id, household_id, member_id, sort_order, name, subject, phone)
values
  ('a7000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'a1000000-0000-4000-8000-000000000003', 1, 'Maestra Bianchi', 'Italiano e storia', '039 000 0000');

-- Wish list (issue #259, for pages #32 and #33): the six ideas of the mockup for Sofia, four
-- to give and two already taken (by «Nonna Anna» and «Zia Carla»). Invented texts, no link
-- of a real shop, no photo, no health data (D1). Nobody else has a list.
-- No active link: the code of a working link must never be in the repository. The two
-- reservations need the link they were made with, so the seed has one link of Sofia, for
-- her next birthday, already disabled; its code is drawn by the column default when the
-- seed runs. The seed keeps no «Regalo preso» notification (the trigger writes them; they
-- are deleted below), so the bell of Marco does not change in the page tests.
insert into public.wishlists (id, household_id, member_id, created_at)
values
  ('d1000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'a1000000-0000-4000-8000-000000000003', now() - interval '10 days');

-- Created one minute apart: «Da regalare» shows the most recent first (Diario … Biglietti).
insert into public.wishlist_items (
  id, household_id, wishlist_id, title, shop_name, price_cents, note, added_by_member_id, created_at
)
values
  ('d2000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'd1000000-0000-4000-8000-000000000001', 'Casco per la bici', null, 3500, null,
   'a1000000-0000-4000-8000-000000000001', now() - interval '10 days'),
  ('d2000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111',
   'd1000000-0000-4000-8000-000000000001', 'Puzzle da 1000 pezzi', null, 2200, null,
   'a1000000-0000-4000-8000-000000000001', now() - interval '10 days' + interval '1 minute'),
  ('d2000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111',
   'd1000000-0000-4000-8000-000000000001', 'Biglietti per il musical', null, 6000,
   'Un''esperienza da fare con la nonna', 'a1000000-0000-4000-8000-000000000001',
   now() - interval '10 days' + interval '2 minutes'),
  ('d2000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111',
   'd1000000-0000-4000-8000-000000000001', 'Cuffie senza fili per bambini', 'MediaWorld', 3900, null,
   'a1000000-0000-4000-8000-000000000001', now() - interval '10 days' + interval '3 minutes'),
  ('d2000000-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111',
   'd1000000-0000-4000-8000-000000000001', 'Set di acquerelli con pennelli', 'Amazon', 2400, null,
   'a1000000-0000-4000-8000-000000000001', now() - interval '10 days' + interval '4 minutes'),
  ('d2000000-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111',
   'd1000000-0000-4000-8000-000000000001', 'Diario segreto con lucchetto', 'Feltrinelli', 1800, 'Lo vuole tanto',
   'a1000000-0000-4000-8000-000000000001', now() - interval '10 days' + interval '5 minutes');

insert into public.wishlist_share_links (
  id, household_id, wishlist_id, occasion_date, expires_at, disabled_at, created_at
)
select
  'd3000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
  'd1000000-0000-4000-8000-000000000001', o.day, private.wishlist_link_expires_at(o.day),
  now() - interval '1 day', now() - interval '9 days'
from (
  select private.wishlist_next_birthday('2016-12-14', (now() at time zone 'Europe/Rome')::date) as day
) o;

-- «Già presi» shows the most recently taken first: Casco (Nonna Anna), then Puzzle (Zia Carla).
insert into public.wishlist_reservations (id, household_id, item_id, share_link_id, giver_name, created_at)
values
  ('d4000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'd2000000-0000-4000-8000-000000000002', 'd3000000-0000-4000-8000-000000000001', 'Zia Carla',
   now() - interval '8 days'),
  ('d4000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111',
   'd2000000-0000-4000-8000-000000000001', 'd3000000-0000-4000-8000-000000000001', 'Nonna Anna',
   now() - interval '7 days');

delete from public.notifications n
where n.kind = 'gift_taken';

-- Linked calendars (issue #266, for pages #34, #35, #37): one account of the fake provider
-- (is_fake: the synchronisation of production ignores it) for Paolo (B2, Casa Bianchi, not
-- an administrator), with the calendars «Personale» (main, writable, switched on, so also
-- «Dove vanno i nuovi impegni») and «Festività in Italia» (read only, switched off). No
-- imported event: the calendar pages of the seed households do not change. Marco, Giulia
-- and Chiara have no account (Oggi, Il tuo profilo and Il tuo Nest show them unlinked).
-- The credentials are a placeholder in the stored format, not a token and not encrypted
-- with any key: nothing can be revoked or read with it. Page tests that link calendars use
-- their own throwaway users.
insert into public.calendar_accounts (
  id, household_id, member_id, provider, provider_account_id, email, is_fake, credentials_ciphertext,
  connected_at, last_synced_at
)
values
  ('e1000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222',
   'b1000000-0000-4000-8000-000000000002', 'google', 'fake-seed-paolo', 'paolo.finto@example.test', true,
   'v1:seed.placeholder.not.a.credential.00000000', now() - interval '10 days', now() - interval '1 hour');

insert into public.external_calendars (
  id, household_id, member_id, account_id, provider_calendar_id, name, is_primary, is_read_only,
  is_enabled, last_synced_at
)
values
  ('e2000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222',
   'b1000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000001', 'fake-personale',
   'Personale', true, false, true, now() - interval '1 hour'),
  ('e2000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222',
   'b1000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000001', 'fake-festivita',
   'Festività in Italia', false, true, false, null);
