-- private.invitation_mails and record_invitation_mail() (issue #617, R4: CA-21…CA-25,
-- CA-34; review of #652): the counter of the invitation mails, 3 per invitation, 20 per
-- household and 20 per account in the last 24 hours, rows kept 48 hours whatever happens to
-- the invitation, the household or the account, never the address.
-- Seed: A = Marco (Casa D'Angelo, organises; Laura has the valid invitation a2…01),
-- B = Giulia (Casa Bianchi, organises; Anna has the expired pending invitation b2…01),
-- B2 = Paolo (Casa Bianchi, does not organise).
-- Created here, as database owner, before any session: Zeno and Ivo (adults of Casa Bianchi
-- without account) with a valid invitation each, a revoked and an accepted invitation of
-- Anna, and the mails already sent by Casa Bianchi: 10 on the invitation of Anna and 9 on
-- the one of Zeno in the last hour, and 1 on the one of Zeno 25 hours ago.
-- Every check runs inside one transaction, so now() is the same everywhere.
begin;
create extension if not exists pgtap with schema extensions;

select plan(56);

insert into public.household_members (id, household_id, kind, name, color)
values
  ('b1000000-0000-4000-8000-000000000617', '22222222-2222-4222-8222-222222222222', 'adult', 'Zeno', 'peonia'),
  ('b1000000-0000-4000-8000-000000000618', '22222222-2222-4222-8222-222222222222', 'adult', 'Ivo', 'basilico');

insert into public.invitations (id, household_id, member_id, invited_by_member_id, status, accepted_at)
values
  ('b2000000-0000-4000-8000-000000000617', '22222222-2222-4222-8222-222222222222',
   'b1000000-0000-4000-8000-000000000617', 'b1000000-0000-4000-8000-000000000001', 'pending', null),
  ('b2000000-0000-4000-8000-000000000618', '22222222-2222-4222-8222-222222222222',
   'b1000000-0000-4000-8000-000000000618', 'b1000000-0000-4000-8000-000000000001', 'pending', null),
  ('b2000000-0000-4000-8000-000000000619', '22222222-2222-4222-8222-222222222222',
   'b1000000-0000-4000-8000-000000000004', 'b1000000-0000-4000-8000-000000000001', 'revoked', null),
  ('b2000000-0000-4000-8000-000000000620', '22222222-2222-4222-8222-222222222222',
   'b1000000-0000-4000-8000-000000000004', 'b1000000-0000-4000-8000-000000000001', 'accepted', now());

-- The mails already in the window were sent by an account that is not in the seed (an adult
-- who organised before), so the limit per account of Giulia does not come into play.
insert into private.invitation_mails (household_id, invitation_id, sender_user_id, sent_at)
select '22222222-2222-4222-8222-222222222222', 'b2000000-0000-4000-8000-000000000001',
       '61700000-0000-4000-8000-00000000ffff', now() - interval '1 hour'
from generate_series(1, 10);
insert into private.invitation_mails (household_id, invitation_id, sender_user_id, sent_at)
select '22222222-2222-4222-8222-222222222222', 'b2000000-0000-4000-8000-000000000617',
       '61700000-0000-4000-8000-00000000ffff', now() - interval '1 hour'
from generate_series(1, 9);
insert into private.invitation_mails (household_id, invitation_id, sender_user_id, sent_at)
values ('22222222-2222-4222-8222-222222222222', 'b2000000-0000-4000-8000-000000000617',
        '61700000-0000-4000-8000-00000000ffff', now() - interval '25 hours');

-- ---------------------------------------------------------------------------
-- CA-23: the table holds no address and no API role reads it.
-- ---------------------------------------------------------------------------
select results_eq(
  $$ select array_agg(a.attname::text collate "default" order by a.attnum)
     from pg_attribute a
     where a.attrelid = 'private.invitation_mails'::regclass and a.attnum > 0 and not a.attisdropped $$,
  $$ values (array['id', 'household_id', 'invitation_id', 'sender_user_id', 'sent_at']::text[]) $$,
  'CA-23: exactly the columns id, household_id, invitation_id, sender_user_id, sent_at: no address in any column'
);
select is_empty(
  $$ select c.conname from pg_constraint c where c.conrelid = 'private.invitation_mails'::regclass and c.contype = 'f' $$,
  'no foreign key: the rows are deleted only by the purge after 48 hours'
);
select ok(
  (select c.relrowsecurity from pg_class c where c.oid = 'private.invitation_mails'::regclass),
  'RLS is enabled on private.invitation_mails'
);
select is_empty(
  $$ select p.polname from pg_policy p where p.polrelid = 'private.invitation_mails'::regclass $$,
  'no policy on private.invitation_mails'
);
select ok(
  not has_table_privilege('anon', 'private.invitation_mails', 'select, insert, update, delete')
    and not has_table_privilege('authenticated', 'private.invitation_mails', 'select, insert, update, delete')
    and not has_table_privilege('service_role', 'private.invitation_mails', 'select, insert, update, delete'),
  'CA-23: anon, authenticated and service_role have no privilege on the table'
);
select is(
  (select count(*)::integer from information_schema.columns c
   where c.table_schema = 'private' and c.table_name = 'invitation_mails' and c.column_name ~ '(mail|address|email)'),
  0,
  'CA-23: no column is about an address'
);

-- ---------------------------------------------------------------------------
-- The functions and their privileges (CA-34).
-- ---------------------------------------------------------------------------
select ok(
  (select p.prosecdef and p.proconfig @> array['search_path=""']
   from pg_proc p where p.oid = 'public.record_invitation_mail(uuid)'::regprocedure),
  'record_invitation_mail is security definer with an empty search_path'
);
select is(
  pg_get_function_result('public.record_invitation_mail(uuid)'::regprocedure),
  'void',
  'record_invitation_mail returns nothing'
);
select ok(
  has_function_privilege('authenticated', 'public.record_invitation_mail(uuid)', 'execute')
    and not has_function_privilege('anon', 'public.record_invitation_mail(uuid)', 'execute')
    and not has_function_privilege('service_role', 'public.record_invitation_mail(uuid)', 'execute')
    and not has_function_privilege('public', 'public.record_invitation_mail(uuid)', 'execute'),
  'CA-34: only authenticated can execute record_invitation_mail'
);
select ok(
  not has_function_privilege('anon', 'private.purge_invitation_mails(timestamptz)', 'execute')
    and not has_function_privilege('authenticated', 'private.purge_invitation_mails(timestamptz)', 'execute')
    and not has_function_privilege('service_role', 'private.purge_invitation_mails(timestamptz)', 'execute')
    and not has_function_privilege('public', 'private.purge_invitation_mails(timestamptz)', 'execute'),
  'CA-34: no API role can execute the purge'
);

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok(
  $$ select public.record_invitation_mail('a2000000-0000-4000-8000-000000000001') $$,
  '42501', null, 'anon cannot record a mail'
);

set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select 1 from private.invitation_mails $$,
  '42501', null, 'CA-23: authenticated cannot read the table'
);
select throws_ok(
  $$ select private.purge_invitation_mails(now()) $$,
  '42501', null, 'CA-34: authenticated cannot run the purge'
);

-- ---------------------------------------------------------------------------
-- Only POST (CA-34).
-- ---------------------------------------------------------------------------
set local request.method to 'GET';
select throws_ok(
  $$ select public.record_invitation_mail('a2000000-0000-4000-8000-000000000001') $$,
  'P0001', 'use POST', 'CA-34: GET is refused'
);
set local request.method to 'DELETE';
select throws_ok(
  $$ select public.record_invitation_mail('a2000000-0000-4000-8000-000000000001') $$,
  'P0001', 'use POST', 'CA-34: DELETE is refused'
);
set local request.method to 'POST';
reset role;
select is_empty(
  $$ select 1 from private.invitation_mails x where x.invitation_id = 'a2000000-0000-4000-8000-000000000001' $$,
  'CA-34: a refused method writes nothing'
);

-- ---------------------------------------------------------------------------
-- CA-21: 3 mails for the invitation of Laura, then FN010.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$ select public.record_invitation_mail('a2000000-0000-4000-8000-000000000001') $$, 'CA-21: first mail');
select lives_ok($$ select public.record_invitation_mail('a2000000-0000-4000-8000-000000000001') $$, 'CA-21: second mail');
select lives_ok($$ select public.record_invitation_mail('a2000000-0000-4000-8000-000000000001') $$, 'CA-21: third mail');
select throws_ok(
  $$ select public.record_invitation_mail('a2000000-0000-4000-8000-000000000001') $$,
  'FN010', 'invitation mail limit reached', 'CA-21: the fourth mail is refused with FN010'
);
reset role;
select results_eq(
  $$ select count(*)::integer, bool_and(x.household_id = '11111111-1111-4111-8111-111111111111'), bool_and(x.sent_at = now()),
            bool_and(x.sender_user_id = 'aaaaaaaa-0000-4000-8000-000000000001')
     from private.invitation_mails x where x.invitation_id = 'a2000000-0000-4000-8000-000000000001' $$,
  $$ values (3, true, true, true) $$,
  'CA-21: 3 rows, of Casa D''Angelo, sent by Marco, now; the refused call added none'
);

-- ---------------------------------------------------------------------------
-- CA-24: who does not organise, another household, an invitation not valid.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok(
  $$ select public.record_invitation_mail('b2000000-0000-4000-8000-000000000618') $$,
  '42501', 'permission denied for function record_invitation_mail', 'CA-24: Paolo (does not organise) is refused'
);
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select public.record_invitation_mail('b2000000-0000-4000-8000-000000000618') $$,
  '42501', 'permission denied for function record_invitation_mail', 'CA-24: Marco (another household) is refused'
);
select throws_ok(
  $$ select public.record_invitation_mail('b2000000-0000-4000-8000-0000000fffff') $$,
  '42501', 'permission denied for function record_invitation_mail', 'an unknown invitation gives the same error'
);
set local request.jwt.claims to '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select public.record_invitation_mail('b2000000-0000-4000-8000-000000000618') $$,
  '42501', 'permission denied for function record_invitation_mail', 'Chiara (no household) is refused'
);
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select public.record_invitation_mail('b2000000-0000-4000-8000-000000000001') $$,
  '22023', null, 'CA-24: an expired invitation gives 22023'
);
select throws_ok(
  $$ select public.record_invitation_mail('b2000000-0000-4000-8000-000000000619') $$,
  '22023', null, 'CA-24: a revoked invitation gives 22023'
);
select throws_ok(
  $$ select public.record_invitation_mail('b2000000-0000-4000-8000-000000000620') $$,
  '22023', null, 'CA-24: an accepted invitation gives 22023'
);
reset role;
select is(
  (select count(*)::integer from private.invitation_mails x where x.household_id = '22222222-2222-4222-8222-222222222222'),
  20,
  'CA-24: the refused calls added no row to Casa Bianchi'
);

-- ---------------------------------------------------------------------------
-- CA-22: 20 mails of the household in 24 hours, on different invitations.
-- 19 rows of the last hour count; the one of 25 hours ago does not.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select public.record_invitation_mail('b2000000-0000-4000-8000-000000000617') $$,
  'FN010', 'invitation mail limit reached', 'the invitation of Zeno already had its 3 mails (9 in the last hour)'
);
select lives_ok(
  $$ select public.record_invitation_mail('b2000000-0000-4000-8000-000000000618') $$,
  'CA-22: the 20th mail of the household (first of Ivo) is recorded: the row of 25 hours ago does not count'
);
select throws_ok(
  $$ select public.record_invitation_mail('b2000000-0000-4000-8000-000000000618') $$,
  'FN010', 'invitation mail limit reached', 'CA-22: the 21st mail of the household is refused with the same code'
);
reset role;
select results_eq(
  $$ select count(*)::integer, count(*) filter (where x.sent_at > now() - interval '24 hours')::integer
     from private.invitation_mails x where x.household_id = '22222222-2222-4222-8222-222222222222' $$,
  $$ values (21, 20) $$,
  'CA-22: 21 rows in Casa Bianchi, 20 of them in the last 24 hours'
);
select is(
  (select count(*)::integer from private.invitation_mails x where x.household_id = '11111111-1111-4111-8111-111111111111'),
  3,
  'the mails of Casa Bianchi never count for Casa D''Angelo'
);

-- ---------------------------------------------------------------------------
-- Review of #652 (a): the adult is removed («Annulla l'invito») and invited again: the
-- mails of the window still count for the household.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select isnt_empty(
  $$ delete from public.household_members m where m.id = 'b1000000-0000-4000-8000-000000000618' returning m.id $$,
  '(a) Giulia removes Ivo, with his invitation'
);
reset role;
select is(
  (select count(*)::integer from private.invitation_mails x where x.invitation_id = 'b2000000-0000-4000-8000-000000000618'),
  1,
  '(a) the mail of the removed invitation stays'
);
set local role authenticated;
select lives_ok(
  $$ select set_config('test.ivo_again', public.invite_adult('Ivo', 'basilico')::text, true) $$,
  '(a) Giulia invites Ivo again, with the same name'
);
reset role;
do $$
begin
  perform set_config('test.ivo_again_invitation',
    (select i.id::text from public.invitations i where i.member_id = current_setting('test.ivo_again')::uuid), true);
end;
$$;
set local role authenticated;
select throws_ok(
  $$ select public.record_invitation_mail(current_setting('test.ivo_again_invitation')::uuid) $$,
  'FN010', 'invitation mail limit reached', '(a) the new invitation gets FN010: the household already sent 20 mails'
);
reset role;
select is(
  (select count(*)::integer from private.invitation_mails x where x.household_id = '22222222-2222-4222-8222-222222222222'),
  21,
  '(a) no row was added, none was deleted'
);

-- ---------------------------------------------------------------------------
-- Review of #652 (b): the account limit. Marco already sent 3 mails; 17 more of the last
-- hour (from an earlier invitation) make 20. He leaves (his household goes with him),
-- creates a new one and invites: FN010 on the account limit.
-- ---------------------------------------------------------------------------
insert into private.invitation_mails (household_id, invitation_id, sender_user_id, sent_at)
select '11111111-1111-4111-8111-111111111111', 'a2000000-0000-4000-8000-0000000000ee',
       'aaaaaaaa-0000-4000-8000-000000000001', now() - interval '1 hour'
from generate_series(1, 17);
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select isnt_empty(
  $$ delete from public.household_members m where m.user_id = 'aaaaaaaa-0000-4000-8000-000000000001' returning m.id $$,
  '(b) Marco leaves Casa D''Angelo'
);
reset role;
select is_empty(
  $$ select 1 from public.households h where h.id = '11111111-1111-4111-8111-111111111111' $$,
  '(b) Casa D''Angelo is deleted (no adult with an account left)'
);
select is(
  (select count(*)::integer from private.invitation_mails x where x.household_id = '11111111-1111-4111-8111-111111111111'),
  20,
  '(b) the 20 mails of Marco stay after his household is deleted'
);
set local role authenticated;
select lives_ok(
  $$ select set_config('test.new_home', public.create_household('Casa Nuova', 'family_with_children', 'Marco', 'pomodoro')::text, true) $$,
  '(b) Marco creates a new household'
);
select lives_ok(
  $$ select set_config('test.new_guest', public.invite_adult('Laura', 'glicine')::text, true) $$,
  '(b) Marco invites in the new household'
);
select lives_ok(
  $$ select set_config('test.new_guest_invitation',
       (select i.id::text from public.invitations i where i.member_id = current_setting('test.new_guest')::uuid), true) $$,
  '(b) Marco reads the id of the new invitation'
);
select throws_ok(
  $$ select public.record_invitation_mail(current_setting('test.new_guest_invitation')::uuid) $$,
  'FN010', 'invitation mail limit reached', '(b) FN010: the account already sent 20 mails in 24 hours'
);
reset role;
select is_empty(
  $$ select 1 from private.invitation_mails x where x.household_id = current_setting('test.new_home')::uuid $$,
  '(b) the new household has no mail: the refusal came from the account limit'
);

-- ---------------------------------------------------------------------------
-- CA-25: the purge after 48 hours is the only deletion.
-- ---------------------------------------------------------------------------
insert into private.invitation_mails (household_id, invitation_id, sender_user_id, sent_at)
values ('11111111-1111-4111-8111-111111111111', 'a2000000-0000-4000-8000-000000000001',
        'aaaaaaaa-0000-4000-8000-000000000001', now() - interval '49 hours');
select is(
  private.purge_invitation_mails(now()),
  1,
  'CA-25: the purge deletes one row, the one older than 48 hours'
);
select is_empty(
  $$ select 1 from private.invitation_mails x where x.sent_at < now() - interval '48 hours' $$,
  'CA-25: no row older than 48 hours is left'
);
select is(
  (select count(*)::integer from private.invitation_mails x where x.sent_at = now() - interval '25 hours'),
  1,
  'CA-25: the row of 25 hours ago stays until it is 48 hours old'
);
select results_eq(
  $$ select j.schedule, j.command, j.active from cron.job j where j.jobname = 'purge-invitation-mails' $$,
  $$ values ('53 * * * *'::text, 'select private.purge_invitation_mails(now());'::text, true) $$,
  'CA-25: the pg_cron job runs the purge every hour'
);

delete from public.invitations where id = 'b2000000-0000-4000-8000-000000000617';
select is(
  (select count(*)::integer from private.invitation_mails x where x.invitation_id = 'b2000000-0000-4000-8000-000000000617'),
  10,
  'CA-25: deleting the invitation keeps its rows (9 of the last hour, 1 of 25 hours ago)'
);
delete from public.households where id = '22222222-2222-4222-8222-222222222222';
select is(
  (select count(*)::integer from private.invitation_mails x where x.household_id = '22222222-2222-4222-8222-222222222222'),
  21,
  'CA-25: deleting the household keeps its rows'
);
delete from auth.users where id = 'bbbbbbbb-0000-4000-8000-000000000001';
select is(
  (select count(*)::integer from private.invitation_mails x where x.sender_user_id = 'bbbbbbbb-0000-4000-8000-000000000001'),
  1,
  'CA-25: deleting the account keeps its row'
);
select is(
  private.purge_invitation_mails(now() + interval '49 hours'),
  41,
  'CA-25: 49 hours later the purge deletes every row of the window'
);
select is_empty($$ select 1 from private.invitation_mails $$, 'CA-25: nothing is left after the purge');

select * from finish();
rollback;
