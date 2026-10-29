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

insert into public.households (id, name, household_type, created_at)
values
  ('11111111-1111-4111-8111-111111111111', 'Casa D''Angelo', 'family_with_children', now() - interval '30 days'),
  ('22222222-2222-4222-8222-222222222222', 'Casa Bianchi', 'family_with_children', now() - interval '30 days');

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
