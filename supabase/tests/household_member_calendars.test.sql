-- household_member_calendars() (issue #617, R3: CA-15…CA-20, CA-34): the calendars switched
-- on of the adults of the household, only member, service, name and visibility.
-- Seed: A = Marco (Casa D'Angelo), B = Giulia (Casa Bianchi), B2 = Paolo (Casa Bianchi) with
-- the fake Google account and the calendars «Personale» (on, busy) and «Festività in Italia»
-- (off), C = Chiara (no household).
-- Created here, as database owner: a fake account of Marco with «Casa» (on, household), to
-- prove that Casa Bianchi never sees it.
-- Every check runs inside one transaction, so now() is the same everywhere.
begin;
create extension if not exists pgtap with schema extensions;

select plan(20);

insert into public.calendar_accounts (
  id, household_id, member_id, provider, provider_account_id, email, is_fake, credentials_ciphertext
)
values ('e1000000-0000-4000-8000-000000000617', '11111111-1111-4111-8111-111111111111',
        'a1000000-0000-4000-8000-000000000001', 'outlook', 'fake-marco-617', 'marco.finto@example.test', true,
        'v1:test.placeholder.not.a.credential.000617');
insert into public.external_calendars (
  id, household_id, member_id, account_id, provider_calendar_id, name, is_enabled, visibility
)
values ('e2000000-0000-4000-8000-000000000617', '11111111-1111-4111-8111-111111111111',
        'a1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000617', 'fake-casa-617',
        'Casa', true, 'household');

-- ---------------------------------------------------------------------------
-- The function, its result columns (CA-16) and its privileges (CA-19, CA-34).
-- ---------------------------------------------------------------------------
select has_function('public', 'household_member_calendars', 'household_member_calendars() exists');
select results_eq(
  $$ select p.proargnames::text[] collate "default", p.proallargtypes::regtype[]::text[] collate "default",
            p.proargmodes::text[] collate "default", p.proretset
     from pg_proc p where p.oid = 'public.household_member_calendars()'::regprocedure $$,
  $$ values (array['member_id', 'provider', 'calendar_name', 'visibility']::text[],
             array['uuid', 'calendar_provider', 'text', 'event_visibility']::text[],
             array['t', 't', 't', 't']::text[], true) $$,
  'CA-16: exactly four result columns: member, service, name of the calendar, visibility'
);
select ok(
  (select p.prosecdef and p.provolatile = 's' and p.proconfig @> array['search_path=""']
   from pg_proc p where p.oid = 'public.household_member_calendars()'::regprocedure),
  'household_member_calendars is stable, security definer, with an empty search_path'
);
select ok(
  has_function_privilege('authenticated', 'public.household_member_calendars()', 'execute')
    and not has_function_privilege('anon', 'public.household_member_calendars()', 'execute')
    and not has_function_privilege('service_role', 'public.household_member_calendars()', 'execute')
    and not has_function_privilege('public', 'public.household_member_calendars()', 'execute'),
  'CA-19, CA-34: only authenticated can execute household_member_calendars'
);

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok(
  $$ select * from public.household_member_calendars() $$,
  '42501', null, 'CA-19: anon cannot call it'
);

-- ---------------------------------------------------------------------------
-- CA-15: Giulia sees «Personale» of Paolo, not «Festività in Italia» (off).
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select results_eq(
  $$ select c.member_id, c.provider::text, c.calendar_name, c.visibility::text from public.household_member_calendars() c $$,
  $$ values ('b1000000-0000-4000-8000-000000000002'::uuid, 'google', 'Personale', 'busy') $$,
  'CA-15: Giulia gets one row: Paolo, google, Personale, busy'
);

-- ---------------------------------------------------------------------------
-- CA-20: the direct reads do not change.
-- ---------------------------------------------------------------------------
select is_empty(
  $$ select 1 from public.calendar_accounts a where a.member_id = 'b1000000-0000-4000-8000-000000000002' $$,
  'CA-20: Giulia reads no account of Paolo directly'
);
select is_empty(
  $$ select 1 from public.external_calendars c where c.member_id = 'b1000000-0000-4000-8000-000000000002' $$,
  'CA-20: Giulia reads no calendar of Paolo directly'
);

-- ---------------------------------------------------------------------------
-- CA-19: Marco and Chiara.
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select results_eq(
  $$ select c.member_id, c.provider::text, c.calendar_name, c.visibility::text from public.household_member_calendars() c $$,
  $$ values ('a1000000-0000-4000-8000-000000000001'::uuid, 'outlook', 'Casa', 'household') $$,
  'CA-19: Marco gets only his own calendar, no row of Casa Bianchi'
);
set local request.jwt.claims to '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}';
select is_empty(
  $$ select * from public.household_member_calendars() $$,
  'CA-19: Chiara (no household) gets 0 rows'
);
set local request.jwt.claims to '{"role":"authenticated"}';
select is_empty(
  $$ select * from public.household_member_calendars() $$,
  'without a user in the session: 0 rows'
);

-- Giulia never sees Marco's calendar.
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select is_empty(
  $$ select 1 from public.household_member_calendars() c where c.member_id = 'a1000000-0000-4000-8000-000000000001' $$,
  'CA-19: Giulia gets no row of Casa D''Angelo'
);

-- ---------------------------------------------------------------------------
-- CA-17: «Personale» private: invisible to the others, visible to Paolo.
-- ---------------------------------------------------------------------------
reset role;
update public.external_calendars set visibility = 'private' where id = 'e2000000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select is_empty(
  $$ select * from public.household_member_calendars() $$,
  'CA-17: a private calendar of Paolo does not appear to Giulia, not even its name'
);
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select results_eq(
  $$ select c.member_id, c.provider::text, c.calendar_name, c.visibility::text from public.household_member_calendars() c $$,
  $$ values ('b1000000-0000-4000-8000-000000000002'::uuid, 'google', 'Personale', 'private') $$,
  'CA-17: Paolo gets his own private calendar'
);

-- ---------------------------------------------------------------------------
-- CA-18: «Personale» shared with the household.
-- ---------------------------------------------------------------------------
reset role;
update public.external_calendars set visibility = 'household' where id = 'e2000000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select results_eq(
  $$ select c.calendar_name, c.visibility::text from public.household_member_calendars() c $$,
  $$ values ('Personale', 'household') $$,
  'CA-18: Giulia gets Personale with household'
);

-- ---------------------------------------------------------------------------
-- Switched on and order: «Festività in Italia» on; a calendar of Giulia.
-- Order: members by created_at (Giulia before Paolo), then service, then name.
-- ---------------------------------------------------------------------------
reset role;
update public.external_calendars set is_enabled = true where id = 'e2000000-0000-4000-8000-000000000002';
insert into public.calendar_accounts (
  id, household_id, member_id, provider, provider_account_id, email, is_fake, credentials_ciphertext
)
values ('e1000000-0000-4000-8000-000000000618', '22222222-2222-4222-8222-222222222222',
        'b1000000-0000-4000-8000-000000000001', 'google', 'fake-giulia-617', 'giulia.finta@example.test', true,
        'v1:test.placeholder.not.a.credential.000618');
insert into public.external_calendars (
  id, household_id, member_id, account_id, provider_calendar_id, name, is_enabled, visibility
)
values
  ('e2000000-0000-4000-8000-000000000618', '22222222-2222-4222-8222-222222222222',
   'b1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000618', 'fake-lavoro-617',
   'Lavoro', true, 'busy'),
  ('e2000000-0000-4000-8000-000000000619', '22222222-2222-4222-8222-222222222222',
   'b1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000618', 'fake-diario-617',
   'Diario', true, 'private'),
  ('e2000000-0000-4000-8000-000000000620', '22222222-2222-4222-8222-222222222222',
   'b1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000618', 'fake-spento-617',
   'Spento', false, 'household');

set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select results_eq(
  $$ select c.member_id, c.calendar_name, c.visibility::text from public.household_member_calendars() c $$,
  $$ values ('b1000000-0000-4000-8000-000000000001'::uuid, 'Diario', 'private'),
            ('b1000000-0000-4000-8000-000000000001'::uuid, 'Lavoro', 'busy'),
            ('b1000000-0000-4000-8000-000000000002'::uuid, 'Festività in Italia', 'busy'),
            ('b1000000-0000-4000-8000-000000000002'::uuid, 'Personale', 'household') $$,
  'Giulia: her own calendars (also the private one), then Paolo''s; never a calendar switched off'
);
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select results_eq(
  $$ select c.member_id, c.calendar_name, c.visibility::text from public.household_member_calendars() c $$,
  $$ values ('b1000000-0000-4000-8000-000000000001'::uuid, 'Lavoro', 'busy'),
            ('b1000000-0000-4000-8000-000000000002'::uuid, 'Festività in Italia', 'busy'),
            ('b1000000-0000-4000-8000-000000000002'::uuid, 'Personale', 'household') $$,
  'Paolo: «Diario» of Giulia is private and does not appear'
);
select is_empty(
  $$ select 1 from public.calendar_accounts a where a.member_id = 'b1000000-0000-4000-8000-000000000001'
     union all
     select 1 from public.external_calendars c where c.member_id = 'b1000000-0000-4000-8000-000000000001' $$,
  'CA-20: Paolo still reads no account or calendar of Giulia directly'
);

-- An adult who left: their calendars go with them (cascade), so they never appear.
reset role;
delete from public.household_members where id = 'b1000000-0000-4000-8000-000000000002';
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select is_empty(
  $$ select 1 from public.household_member_calendars() c where c.member_id = 'b1000000-0000-4000-8000-000000000002' $$,
  'the calendars of an adult who left do not appear'
);
select is(
  (select count(*)::integer from public.household_member_calendars()),
  2,
  'Giulia keeps her own two calendars switched on'
);

select * from finish();
rollback;
