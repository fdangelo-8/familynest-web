-- The format of the values of calendar_accounts checked by the functions of the
-- synchronisation service before writing (issue #331, review of PR #332): when a CHECK
-- constraint fails, Postgres adds the whole row to the error (DETAIL «Failing row contains
-- …», with email, provider_account_id and credentials). save_calendar_account() refuses
-- those values itself, with 23514, a generic message and no DETAIL; the rules accept and
-- refuse the same values as the constraints.
-- update_calendar_account_credentials() is tested in update_calendar_account_credentials.test.sql.
-- The administrative key comes first (lesson of #276, #287).
-- Seed ids: Paolo (Casa Bianchi, user bbbbbbbb…02) has the fake Google account e1…01
-- ('fake-seed-paolo', 'paolo.finto@example.test', 'v1:seed.placeholder.not.a.credential.00000000').
begin;
create extension if not exists pgtap with schema extensions;

select plan(15);

-- The error of a statement as the caller receives it: code, message, detail and hint.
-- '{}' when the statement works. Created in pg_temp: gone with the session.
create function pg_temp.error_of(p_sql text)
returns jsonb
language plpgsql
as $$
declare
  v_state text;
  v_message text;
  v_detail text;
  v_hint text;
begin
  execute p_sql;
  return '{}'::jsonb;
exception when others then
  get stacked diagnostics
    v_state = returned_sqlstate,
    v_message = message_text,
    v_detail = pg_exception_detail,
    v_hint = pg_exception_hint;
  return jsonb_build_object(
    'state', v_state, 'message', v_message,
    'detail', coalesce(v_detail, ''), 'hint', coalesce(v_hint, '')
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- The rule of the format of the credentials
-- ---------------------------------------------------------------------------
select has_function(
  'private', 'calendar_credentials_format_ok', array['text'],
  'private.calendar_credentials_format_ok exists'
);
select ok(
  not has_function_privilege('anon', 'private.calendar_credentials_format_ok(text)', 'execute')
  and not has_function_privilege('authenticated', 'private.calendar_credentials_format_ok(text)', 'execute'),
  'the API roles cannot execute the rule'
);
select is(
  private.calendar_credentials_format_ok(null),
  false,
  'no credentials: refused'
);

-- ---------------------------------------------------------------------------
-- save_calendar_account() with the administrative key: generic errors, no DETAIL
-- ---------------------------------------------------------------------------
set local role service_role;
set local request.jwt.claims to '{"role":"service_role"}';
set local request.method to 'POST';

select is(
  pg_temp.error_of($$ select * from public.save_calendar_account(
    'bbbbbbbb-0000-4000-8000-000000000002', 'google', 'fake-seed-paolo', 'paolo.nuovo@example.test',
    '1//0gPlainRefreshTokenThatMustNeverBeStored0000', true) $$),
  '{"state": "23514", "message": "invalid credentials format", "detail": "", "hint": ""}'::jsonb,
  'credentials not in the encrypted format: 23514, a generic message, no detail'
);
select ok(
  strpos(
    pg_temp.error_of($$ select * from public.save_calendar_account(
      'bbbbbbbb-0000-4000-8000-000000000002', 'google', 'fake-seed-paolo', 'paolo.nuovo@example.test',
      '1//0gPlainRefreshTokenThatMustNeverBeStored0000', true) $$)::text,
    'PlainRefreshToken') = 0
  and strpos(
    pg_temp.error_of($$ select * from public.save_calendar_account(
      'bbbbbbbb-0000-4000-8000-000000000002', 'google', 'fake-seed-paolo', 'paolo.nuovo@example.test',
      '1//0gPlainRefreshTokenThatMustNeverBeStored0000', true) $$)::text,
    'paolo') = 0,
  'the error holds neither the token, nor the email, nor the account at the provider'
);
select is(
  pg_temp.error_of($$ select * from public.save_calendar_account(
    'bbbbbbbb-0000-4000-8000-000000000002', 'google', 'fake-seed-paolo', 'paolo nuovo@example.test',
    'v1:test.placeholder.not.a.credential.000030', true) $$),
  '{"state": "23514", "message": "invalid email format", "detail": "", "hint": ""}'::jsonb,
  'an invalid email: 23514, a generic message, no detail'
);
select is(
  pg_temp.error_of($$ select * from public.save_calendar_account(
    'bbbbbbbb-0000-4000-8000-000000000002', 'google', '', 'paolo.finto@example.test',
    'v1:test.placeholder.not.a.credential.000031', true) $$),
  '{"state": "23514", "message": "invalid provider account id", "detail": "", "hint": ""}'::jsonb,
  'an empty id at the provider: 23514, a generic message, no detail'
);
select is(
  pg_temp.error_of(format(
    'select * from public.save_calendar_account(%L, %L, %L, %L, %L, true)',
    'bbbbbbbb-0000-4000-8000-000000000002', 'google', repeat('p', 256), 'paolo.finto@example.test',
    'v1:test.placeholder.not.a.credential.000032')),
  '{"state": "23514", "message": "invalid provider account id", "detail": "", "hint": ""}'::jsonb,
  'an id at the provider longer than 255 characters: 23514, a generic message, no detail'
);
select results_eq(
  $$ select a.email, a.credentials_ciphertext from public.calendar_accounts a
     where a.id = 'e1000000-0000-4000-8000-000000000001' $$,
  $$ values ('paolo.finto@example.test'::text, 'v1:seed.placeholder.not.a.credential.00000000'::text) $$,
  'the refused calls changed nothing'
);
select results_eq(
  format(
    'select s.is_new from public.save_calendar_account(%L, %L, %L, %L, %L, true) s',
    'bbbbbbbb-0000-4000-8000-000000000002', 'google', repeat('p', 255), 'paolo.finto@example.test',
    'v1:test.placeholder.not.a.credential.000033'),
  $$ values (true) $$,
  'an id at the provider of 255 characters is still accepted'
);
reset role;

-- ---------------------------------------------------------------------------
-- Same values accepted and refused as the constraints (owner of the database, writing the
-- table directly to reach the constraint)
-- ---------------------------------------------------------------------------
create temporary table credential_cases (value text) on commit drop;
insert into credential_cases (value) values
  ('v1:' || repeat('a', 32)),                      -- 35 characters
  ('v1:' || repeat('a', 31)),                      -- 34 characters
  ('v1:' || repeat('a', 8189)),                    -- 8,192 characters
  ('v1:' || repeat('a', 8190)),                    -- 8,193 characters
  ('v999:' || repeat('A', 40)),
  ('v1000:' || repeat('A', 40)),
  ('v1:abc+/=_.:-' || repeat('9', 30)),
  ('v:' || repeat('a', 40)),
  ('V1:' || repeat('a', 40)),
  ('x1:' || repeat('a', 40)),
  ('v1:' || repeat('a', 39) || ' '),
  ('v1:' || repeat('a', 39) || E'\n'),
  ('v1:' || repeat('é', 40)),
  ('1//0gPlainRefreshTokenThatMustNeverBeStored0000');

select is(
  (select count(*)::integer from credential_cases c
   where private.calendar_credentials_format_ok(c.value)),
  4,
  'the cases of the credentials hold 4 accepted values and 10 refused ones'
);
select is_empty(
  $q$ select left(c.value, 40) from credential_cases c
      where private.calendar_credentials_format_ok(c.value)
            is distinct from (pg_temp.error_of(format(
              'update public.calendar_accounts set credentials_ciphertext = %L where id = %L',
              c.value, 'e1000000-0000-4000-8000-000000000001')) = '{}'::jsonb) $q$,
  'the rule of the credentials accepts exactly what the constraint accepts'
);

create temporary table email_cases (value text) on commit drop;
insert into email_cases (value) values
  ('a@b'),
  (' a@b '),
  (repeat('a', 250) || '@b.c'),                    -- 254 characters
  (repeat('a', 251) || '@b.c'),                    -- 255 characters
  ('paolo.finto@example.test'),
  ('ab'),
  ('@ab'),
  ('a b@c.d'),
  (E'a@b\t'),
  ('   ');

-- Through save_calendar_account(): only its own refusal counts as «refused», so a rule
-- looser than the constraint would show up as a difference.
select is(
  (select count(*)::integer from email_cases c
   where pg_temp.error_of(format(
     'select * from public.save_calendar_account(%L, %L, %L, %L, %L, true)',
     'bbbbbbbb-0000-4000-8000-000000000002', 'google', 'fake-seed-paolo', c.value,
     'v1:test.placeholder.not.a.credential.000034'))->>'message'
     is distinct from 'invalid email format'),
  4,
  'the cases of the email hold 4 values accepted by save_calendar_account() and 6 refused ones'
);
select is_empty(
  $q$ select c.value from email_cases c
      where (pg_temp.error_of(format(
               'select * from public.save_calendar_account(%L, %L, %L, %L, %L, true)',
               'bbbbbbbb-0000-4000-8000-000000000002', 'google', 'fake-seed-paolo', c.value,
               'v1:test.placeholder.not.a.credential.000035'))->>'message'
             is distinct from 'invalid email format')
            is distinct from (pg_temp.error_of(format(
              'update public.calendar_accounts set email = %L where id = %L',
              c.value, 'e1000000-0000-4000-8000-000000000001')) = '{}'::jsonb) $q$,
  'the rule of the email accepts exactly what the constraint accepts'
);
select is_empty(
  $q$ select c.value from email_cases c
      cross join lateral (select pg_temp.error_of(format(
        'select * from public.save_calendar_account(%L, %L, %L, %L, %L, true)',
        'bbbbbbbb-0000-4000-8000-000000000002', 'google', 'fake-seed-paolo', c.value,
        'v1:test.placeholder.not.a.credential.000036')) as error) e
      where coalesce(e.error->>'detail', '') <> '' or coalesce(e.error->>'hint', '') <> '' $q$,
  'no refusal of save_calendar_account() carries a detail or a hint'
);

select * from finish();
rollback;
