-- child_profiles, child_teachers and save_child_profile() (issue #219, for page #31 «Profilo
-- di un figlio»): schema and privileges, no address and no health column, only children
-- (never an adult or a pet), reading and saving by an adult of the household, administrator
-- (A) or not (B2), isolation from another household (B) in reading and writing, a signed-in
-- user without household (C), anon, only POST, normalisation, time of the sizes set by the
-- database, limit of five teachers, nothing written by an error (also half way), no other
-- function reading these tables, cascades when a child is removed and when the accounts are
-- deleted (household kept, household deleted).
-- Seed ids: A = Marco (Casa D'Angelo, admin, only adult with an account), B = Giulia (Casa
-- Bianchi, admin), B2 = Paolo (Casa Bianchi, not admin), C = Chiara (no household).
-- Members: Casa D'Angelo Marco a1…01, Laura a1…02 (adult without account), Sofia a1…03 and
-- Tommaso a1…04 (children), Biscotto a1…05 (pet); Casa Bianchi Leo b1…03 (child).
-- Seed: Sofia has a profile (scuola Manzoni, 4ª B, 8:15–16:15 Monday–Friday, «mensa
-- compresa», sizes 33, 9–10, 140) and one teacher (Maestra Bianchi); nobody else has any.
begin;
create extension if not exists pgtap with schema extensions;

select plan(140);

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------
select has_table('public', 'child_profiles', 'child_profiles exists');
select has_table('public', 'child_teachers', 'child_teachers exists');
select ok(
  (select c.relrowsecurity from pg_class c where c.oid = 'public.child_profiles'::regclass),
  'RLS enabled on child_profiles'
);
select ok(
  (select c.relrowsecurity from pg_class c where c.oid = 'public.child_teachers'::regclass),
  'RLS enabled on child_teachers'
);
select columns_are(
  'public', 'child_profiles',
  array[
    'id', 'household_id', 'member_id', 'member_kind', 'school_name', 'school_class', 'school_starts_at',
    'school_ends_at', 'school_days', 'school_note', 'shoe_size', 'clothing_size', 'pajama_size',
    'sizes_updated_at', 'created_at', 'updated_at'
  ],
  'child_profiles has exactly the planned columns (no address of the school, no health data)'
);
select columns_are(
  'public', 'child_teachers',
  array['id', 'household_id', 'member_id', 'member_kind', 'sort_order', 'name', 'subject', 'phone', 'created_at', 'updated_at'],
  'child_teachers has exactly the planned columns'
);
select is_empty(
  $$ select c.table_name || '.' || c.column_name
     from information_schema.columns c
     where c.table_schema = 'public'
       and c.table_name in ('child_profiles', 'child_teachers')
       and c.column_name ~* '(address|indirizz|street|via|city|health|medic|pediatr|allerg|vacc|fiscal|photo)' $$,
  'no column about addresses, health, fiscal data or photos'
);
select fk_ok(
  'public', 'child_profiles', 'household_id', 'public', 'households', 'id',
  'child_profiles.household_id references households'
);
select fk_ok(
  'public', 'child_profiles', array['member_id', 'household_id', 'member_kind'],
  'public', 'household_members', array['id', 'household_id', 'kind'],
  'a profile belongs to a child of the same household'
);
select fk_ok(
  'public', 'child_teachers', 'household_id', 'public', 'households', 'id',
  'child_teachers.household_id references households'
);
select fk_ok(
  'public', 'child_teachers', array['member_id', 'household_id', 'member_kind'],
  'public', 'household_members', array['id', 'household_id', 'kind'],
  'a teacher belongs to a child of the same household'
);
select is(
  (select array_agg(k.confdeltype::text order by k.conname)
   from pg_constraint k
   where k.conrelid in ('public.child_profiles'::regclass, 'public.child_teachers'::regclass)
     and k.contype = 'f'),
  array['c', 'c', 'c', 'c'],
  'every foreign key of the two tables is on delete cascade'
);
select col_is_unique('public', 'child_profiles', array['member_id'], 'a child has at most one profile');
select col_is_unique('public', 'child_teachers', array['member_id', 'sort_order'], 'one teacher per place of a child');
select has_index('public', 'child_profiles', 'child_profiles_household_id_idx', 'index on child_profiles.household_id');
select has_index('public', 'child_teachers', 'child_teachers_household_id_idx', 'index on child_teachers.household_id');
select ok(
  not exists (
    select 1 from pg_publication_tables p
    where p.schemaname = 'public' and p.tablename in ('child_profiles', 'child_teachers')
  ),
  'school, sizes and teachers are not sent in real time'
);
select has_function(
  'public', 'save_child_profile',
  array['uuid', 'text', 'member_color', 'jsonb', 'date', 'text', 'text', 'time without time zone',
        'time without time zone', 'smallint[]', 'text', 'text', 'text', 'text'],
  'save_child_profile exists'
);
select ok(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.prosecdef
      and (n.nspname, p.proname) in (
        ('public', 'save_child_profile'), ('private', 'child_profiles_before_write'),
        ('private', 'child_teachers_before_write'), ('private', 'child_school_days_valid')
      )
  ),
  'the functions of the child profile run as the caller (no security definer)'
);
select ok(
  (select p.prosrc ~ 'pg_advisory_xact_lock' from pg_proc p where p.oid = 'private.child_teachers_before_write()'::regprocedure)
  and (select p.prosrc ~ 'pg_advisory_xact_lock' from pg_proc p where p.oid = 'public.save_child_profile(uuid, text, public.member_color, jsonb, date, text, text, time, time, smallint[], text, text, text, text)'::regprocedure),
  'the limit of five teachers is serialised with an advisory lock per child (LEZIONI #192)'
);
-- Issue #219 point 4: invitation_preview and every other function never read these data.
select is_empty(
  $$ select n.nspname || '.' || p.proname
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public', 'private')
       and p.prosrc ~ '(child_profiles|child_teachers)'
       and (n.nspname, p.proname) not in (
         ('public', 'save_child_profile'), ('private', 'child_profiles_before_write'),
         ('private', 'child_teachers_before_write')
       ) $$,
  'no other function (invitation_preview included) reads the school, the sizes or the teachers'
);

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
select ok(
  not has_table_privilege('anon', 'public.child_profiles', 'select, insert, update, delete')
  and not has_table_privilege('anon', 'public.child_teachers', 'select, insert, update, delete')
  and not has_any_column_privilege('anon', 'public.child_profiles', 'select, insert, update')
  and not has_any_column_privilege('anon', 'public.child_teachers', 'select, insert, update'),
  'anon has no privilege on the two tables'
);
select ok(
  has_column_privilege('authenticated', 'public.child_profiles', 'member_id', 'insert')
  and has_column_privilege('authenticated', 'public.child_profiles', 'school_name', 'insert')
  and not has_column_privilege('authenticated', 'public.child_profiles', 'id', 'insert')
  and not has_column_privilege('authenticated', 'public.child_profiles', 'household_id', 'insert')
  and not has_column_privilege('authenticated', 'public.child_profiles', 'member_kind', 'insert')
  and not has_column_privilege('authenticated', 'public.child_profiles', 'sizes_updated_at', 'insert')
  and not has_column_privilege('authenticated', 'public.child_profiles', 'created_at', 'insert'),
  'the app inserts only the content of a profile (never id, household, kind or times)'
);
select ok(
  has_column_privilege('authenticated', 'public.child_profiles', 'shoe_size', 'update')
  and not has_column_privilege('authenticated', 'public.child_profiles', 'member_id', 'update')
  and not has_column_privilege('authenticated', 'public.child_profiles', 'household_id', 'update')
  and not has_column_privilege('authenticated', 'public.child_profiles', 'sizes_updated_at', 'update')
  and not has_column_privilege('authenticated', 'public.child_profiles', 'created_at', 'update'),
  'the app changes only the content of a profile (never its child, household or times)'
);
select ok(
  has_column_privilege('authenticated', 'public.child_teachers', 'name', 'insert')
  and has_column_privilege('authenticated', 'public.child_teachers', 'sort_order', 'insert')
  and not has_column_privilege('authenticated', 'public.child_teachers', 'id', 'insert')
  and not has_column_privilege('authenticated', 'public.child_teachers', 'household_id', 'insert')
  and not has_column_privilege('authenticated', 'public.child_teachers', 'member_kind', 'insert')
  and not has_column_privilege('authenticated', 'public.child_teachers', 'member_id', 'update')
  and not has_column_privilege('authenticated', 'public.child_teachers', 'household_id', 'update'),
  'the app never writes the id, the household or the kind of a teacher (LEZIONI: no insert on id)'
);
select ok(
  not has_function_privilege('anon', 'public.save_child_profile(uuid, text, public.member_color, jsonb, date, text, text, time, time, smallint[], text, text, text, text)', 'execute')
  and has_function_privilege('authenticated', 'public.save_child_profile(uuid, text, public.member_color, jsonb, date, text, text, time, time, smallint[], text, text, text, text)', 'execute'),
  'only signed-in users save a child profile'
);
select ok(
  not has_function_privilege('authenticated', 'private.child_profiles_before_write()', 'execute')
  and not has_function_privilege('authenticated', 'private.child_teachers_before_write()', 'execute')
  and not has_function_privilege('anon', 'private.child_school_days_valid(smallint[])', 'execute'),
  'internal functions cannot be called by the app'
);

-- ---------------------------------------------------------------------------
-- Seed, and only children (as database owner)
-- ---------------------------------------------------------------------------
select results_eq(
  $$ select p.household_id, p.school_name, p.school_class, p.school_starts_at::text, p.school_ends_at::text,
            p.school_days::text, p.school_note, p.shoe_size, p.clothing_size, p.pajama_size,
            p.sizes_updated_at is not null
     from public.child_profiles p $$,
  $$ values ('11111111-1111-4111-8111-111111111111'::uuid, 'scuola Manzoni', '4ª B', '08:15:00', '16:15:00',
             '{1,2,3,4,5}', 'mensa compresa', '33', '9–10', '140', true) $$,
  'seed: only Sofia has a profile, the data of the mockup, with the time of the sizes'
);
select results_eq(
  $$ select t.member_id, t.sort_order::integer, t.name, t.subject from public.child_teachers t $$,
  $$ values ('a1000000-0000-4000-8000-000000000003'::uuid, 1, 'Maestra Bianchi', 'Italiano e storia') $$,
  'seed: only Sofia has a teacher'
);
do $$
begin
  perform set_config(
    'test.seed_sizes_at',
    (select p.sizes_updated_at::text from public.child_profiles p where p.member_id = 'a1000000-0000-4000-8000-000000000003'),
    true
  );
end;
$$;

select throws_ok(
  $$ insert into public.child_profiles (household_id, member_id, school_class)
     values ('11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000002', '4ª B') $$,
  '23503', null,
  'an adult (Laura) cannot have a school'
);
select throws_ok(
  $$ insert into public.child_profiles (household_id, member_id, shoe_size)
     values ('11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000005', '33') $$,
  '23503', null,
  'a pet (Biscotto) cannot have sizes'
);
select throws_ok(
  $$ insert into public.child_teachers (household_id, member_id, sort_order, name)
     values ('11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000002', 1, 'Maestra Neri') $$,
  '23503', null,
  'an adult (Laura) cannot have teachers'
);
select throws_ok(
  $$ insert into public.child_teachers (household_id, member_id, sort_order, name)
     values ('11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000005', 1, 'Maestra Neri') $$,
  '23503', null,
  'a pet (Biscotto) cannot have teachers'
);
select throws_ok(
  $$ insert into public.child_profiles (household_id, member_id, member_kind, school_class)
     values ('11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000002', 'adult', '4ª B') $$,
  '23514', null,
  'a profile is always of a child, also when the kind is written explicitly'
);
select throws_ok(
  $$ insert into public.child_profiles (household_id, member_id, school_class)
     values ('22222222-2222-4222-8222-222222222222', 'a1000000-0000-4000-8000-000000000004', '4ª B') $$,
  '23503', null,
  'a profile cannot point to a child of another household'
);
select throws_ok(
  $$ update public.household_members set kind = 'adult', birth_date = null
     where id = 'a1000000-0000-4000-8000-000000000003' $$,
  '23503', null,
  'the kind of a child with a profile cannot change'
);

-- ---------------------------------------------------------------------------
-- Marco (A, administrator) reads and saves Sofia's profile
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
set local request.method to 'POST';

select results_eq(
  $$ select p.member_id, p.school_name, p.school_class from public.child_profiles p $$,
  $$ values ('a1000000-0000-4000-8000-000000000003'::uuid, 'scuola Manzoni', '4ª B') $$,
  'A reads the school of Sofia'
);
select results_eq(
  $$ select t.name, t.subject, t.phone from public.child_teachers t $$,
  $$ values ('Maestra Bianchi', 'Italiano e storia', '039 000 0000') $$,
  'A reads the teacher of Sofia'
);

-- Same sizes, one teacher more: the time of the sizes does not change.
select lives_ok(
  $$ select public.save_child_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000003', p_name => 'Sofia', p_color => 'salvia',
       p_birth_date => '2016-12-14', p_school_name => 'scuola Manzoni', p_school_class => '4ª B',
       p_school_starts_at => '08:15', p_school_ends_at => '16:15', p_school_days => '{1,2,3,4,5}',
       p_school_note => 'mensa compresa', p_shoe_size => '33', p_clothing_size => '9–10', p_pajama_size => '140',
       p_teachers => '[{"name":"Maestra Bianchi","subject":"Italiano e storia","phone":"039 000 0000"},
                       {"name":"Maestro Rossi"}]'
     ) $$,
  'A saves the profile of Sofia with a second teacher'
);
select results_eq(
  $$ select t.sort_order::integer, t.name, t.subject, t.phone, t.household_id
     from public.child_teachers t order by t.sort_order $$,
  $$ values (1, 'Maestra Bianchi', 'Italiano e storia', '039 000 0000', '11111111-1111-4111-8111-111111111111'::uuid),
            (2, 'Maestro Rossi', null, null, '11111111-1111-4111-8111-111111111111'::uuid) $$,
  'the teachers are those sent, in the given order, in the household of A'
);
select ok(
  (select p.sizes_updated_at = current_setting('test.seed_sizes_at')::timestamptz
   from public.child_profiles p where p.member_id = 'a1000000-0000-4000-8000-000000000003'),
  'sizes not changed: the time of the sizes stays the same'
);

-- One size changes: the time of the sizes is set by the database.
select lives_ok(
  $$ select public.save_child_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000003', p_name => 'Sofia', p_color => 'salvia',
       p_birth_date => '2016-12-14', p_school_name => 'scuola Manzoni', p_school_class => '4ª B',
       p_school_starts_at => '08:15', p_school_ends_at => '16:15', p_school_days => '{1,2,3,4,5}',
       p_school_note => 'mensa compresa', p_shoe_size => '34', p_clothing_size => '9–10', p_pajama_size => '140',
       p_teachers => '[{"name":"Maestra Bianchi","subject":"Italiano e storia","phone":"039 000 0000"},
                       {"name":"Maestro Rossi"}]'
     ) $$,
  'A changes the shoe size of Sofia'
);
select ok(
  (select p.shoe_size = '34' and p.sizes_updated_at = now()
     and p.sizes_updated_at <> current_setting('test.seed_sizes_at')::timestamptz
   from public.child_profiles p where p.member_id = 'a1000000-0000-4000-8000-000000000003'),
  'a size changed: the time of the sizes is now'
);
select throws_ok(
  $$ update public.child_profiles set sizes_updated_at = '2025-09-15 10:00+02'
     where member_id = 'a1000000-0000-4000-8000-000000000003' $$,
  '42501', null,
  'the app cannot choose the time of the sizes'
);

-- Name, colour and birth date are saved with the rest; texts are normalised, days sorted.
select lives_ok(
  $$ select public.save_child_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000003', p_name => 'Sofia Maria', p_color => 'lampone',
       p_birth_date => '2016-12-15', p_school_name => '  scuola   Manzoni ', p_school_class => ' 5ª  B ',
       p_school_starts_at => '08:00', p_school_ends_at => '13:30', p_school_days => '{6,1,3,2,5,4}',
       p_school_note => '', p_shoe_size => ' 35 ', p_clothing_size => '', p_pajama_size => null,
       p_teachers => '[{"name":"  Maestra   Neri ","subject":"  ","phone":" +39 333 000 1111 "}]'
     ) $$,
  'A saves a profile with untidy texts'
);
select results_eq(
  $$ select m.name, m.color::text, m.birth_date, p.school_name, p.school_class, p.school_starts_at::text,
            p.school_ends_at::text, p.school_days::text, p.school_note, p.shoe_size, p.clothing_size, p.pajama_size
     from public.household_members m
     join public.child_profiles p on p.member_id = m.id
     where m.id = 'a1000000-0000-4000-8000-000000000003' $$,
  $$ values ('Sofia Maria', 'lampone', '2016-12-15'::date, 'scuola Manzoni', '5ª B', '08:00:00', '13:30:00',
             '{1,2,3,4,5,6}', null::text, '35', null::text, null::text) $$,
  'member, school and sizes saved together: texts normalised, empty texts empty, days sorted'
);
select results_eq(
  $$ select t.sort_order::integer, t.name, t.subject, t.phone from public.child_teachers t $$,
  $$ values (1, 'Maestra Neri', null::text, '+39 333 000 1111') $$,
  'the new list replaces the teachers saved before'
);

-- Without timetable the days are not saved.
select lives_ok(
  $$ select public.save_child_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000003', p_name => 'Sofia', p_color => 'salvia',
       p_birth_date => '2016-12-14', p_school_class => '4ª B', p_school_days => '{1,2,3,4,5}',
       p_teachers => '[]'
     ) $$,
  'A saves only the class, with the days but without timetable'
);
select results_eq(
  $$ select p.school_name, p.school_class, p.school_starts_at, p.school_days::text, p.shoe_size, p.sizes_updated_at
     from public.child_profiles p where p.member_id = 'a1000000-0000-4000-8000-000000000003' $$,
  $$ values (null::text, '4ª B', null::time, '{}', null::text, null::timestamptz) $$,
  'without timetable the days are empty; without sizes their time is empty'
);
select is_empty($$ select 1 from public.child_teachers $$, 'an empty list removes every teacher');

-- Everything empty: the row goes.
select lives_ok(
  $$ select public.save_child_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000003', p_name => 'Sofia', p_color => 'salvia',
       p_birth_date => '2016-12-14', p_school_class => '  ', p_teachers => '[]'
     ) $$,
  'A empties the whole profile of Sofia'
);
select is_empty(
  $$ select 1 from public.child_profiles p where p.member_id = 'a1000000-0000-4000-8000-000000000003' $$,
  'an empty profile leaves no row'
);

-- Back to the full profile, used by the cases below.
select lives_ok(
  $$ select public.save_child_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000003', p_name => 'Sofia', p_color => 'salvia',
       p_birth_date => '2016-12-14', p_school_name => 'scuola Manzoni', p_school_class => '4ª B',
       p_school_starts_at => '08:15', p_school_ends_at => '16:15', p_school_days => '{1,2,3,4,5}',
       p_school_note => 'mensa compresa', p_shoe_size => '33', p_clothing_size => '9–10', p_pajama_size => '140',
       p_teachers => '[{"name":"Maestra Bianchi","subject":"Italiano e storia","phone":"039 000 0000"},
                       {"name":"Maestro Rossi"}]'
     ) $$,
  'A saves the full profile of Sofia again'
);
select ok(
  (select p.sizes_updated_at = now() from public.child_profiles p where p.member_id = 'a1000000-0000-4000-8000-000000000003'),
  'sizes written again: their time is set by the database'
);

-- ---------------------------------------------------------------------------
-- Errors: nothing is written, also when the error comes half way
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ select public.save_child_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000003', p_name => 'Sofia', p_color => 'pomodoro',
       p_school_class => '5ª A', p_shoe_size => '36', p_teachers => '[{"name":"Maestra Neri"}]'
     ) $$,
  '23505', null,
  'colour already taken (Marco): 23505'
);
select throws_ok(
  $$ select public.save_child_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000003', p_name => 'Sofia', p_color => 'salvia',
       p_birth_date => (now() at time zone 'Europe/Rome')::date + 1, p_school_class => '5ª A',
       p_teachers => '[{"name":"Maestra Neri"}]'
     ) $$,
  '23514', null,
  'birth date in the future: 23514'
);
-- Half way: the member and the school are written, then the second teacher is refused.
select throws_ok(
  $$ select public.save_child_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000003', p_name => 'Sofia Maria', p_color => 'lampone',
       p_birth_date => '2016-12-15', p_school_name => 'scuola Verdi', p_school_class => '5ª A',
       p_shoe_size => '36', p_teachers => '[{"name":"Maestra Neri"},{"name":"Maestra Verdi","phone":"abc"}]'
     ) $$,
  '23514', null,
  'a phone not valid after the school is written: 23514'
);
select throws_ok(
  $$ select public.save_child_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000003', p_name => 'Sofia Maria', p_color => 'lampone',
       p_school_class => repeat('x', 21), p_teachers => '[{"name":"Maestra Neri"}]'
     ) $$,
  '23514', null,
  'a class of 21 characters after the member is written: 23514'
);
select results_eq(
  $$ select m.name, m.color::text, m.birth_date, p.school_name, p.school_class, p.shoe_size,
            (select string_agg(t.name, ',' order by t.sort_order) from public.child_teachers t where t.member_id = m.id)
     from public.household_members m
     join public.child_profiles p on p.member_id = m.id
     where m.id = 'a1000000-0000-4000-8000-000000000003' $$,
  $$ values ('Sofia', 'salvia', '2016-12-14'::date, 'scuola Manzoni', '4ª B', '33', 'Maestra Bianchi,Maestro Rossi') $$,
  'after the errors (also half way) nothing changed: member, school, sizes and teachers as before'
);

select throws_ok(
  $$ select public.save_child_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000003', p_name => 'Sofia', p_color => 'salvia',
       p_school_starts_at => '08:15', p_school_days => '{1,2,3,4,5}', p_teachers => '[]'
     ) $$,
  '23514', null,
  'entry without exit: 23514'
);
select throws_ok(
  $$ select public.save_child_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000003', p_name => 'Sofia', p_color => 'salvia',
       p_school_ends_at => '16:15', p_school_days => '{1,2,3,4,5}', p_teachers => '[]'
     ) $$,
  '23514', null,
  'exit without entry: 23514'
);
select throws_ok(
  $$ select public.save_child_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000003', p_name => 'Sofia', p_color => 'salvia',
       p_school_starts_at => '08:15', p_school_ends_at => '08:00', p_school_days => '{1,2,3,4,5}', p_teachers => '[]'
     ) $$,
  '23514', null,
  'exit before entry: 23514'
);
select throws_ok(
  $$ select public.save_child_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000003', p_name => 'Sofia', p_color => 'salvia',
       p_school_starts_at => '08:15', p_school_ends_at => '08:15', p_school_days => '{1,2,3,4,5}', p_teachers => '[]'
     ) $$,
  '23514', null,
  'exit equal to entry: 23514'
);
select throws_ok(
  $$ select public.save_child_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000003', p_name => 'Sofia', p_color => 'salvia',
       p_school_starts_at => '08:15', p_school_ends_at => '16:15', p_school_days => '{}', p_teachers => '[]'
     ) $$,
  '23514', null,
  'timetable without days: 23514'
);
select throws_ok(
  $$ select public.save_child_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000003', p_name => 'Sofia', p_color => 'salvia',
       p_school_starts_at => '08:15', p_school_ends_at => '16:15', p_school_days => '{1,1,2}', p_teachers => '[]'
     ) $$,
  '23514', null,
  'repeated day: 23514'
);
select throws_ok(
  $$ select public.save_child_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000003', p_name => 'Sofia', p_color => 'salvia',
       p_school_starts_at => '08:15', p_school_ends_at => '16:15', p_school_days => '{0,1}', p_teachers => '[]'
     ) $$,
  '23514', null,
  'day 0: 23514'
);
select throws_ok(
  $$ select public.save_child_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000003', p_name => 'Sofia', p_color => 'salvia',
       p_school_starts_at => '08:15', p_school_ends_at => '16:15', p_school_days => '{7,8}', p_teachers => '[]'
     ) $$,
  '23514', null,
  'day 8: 23514'
);
select throws_ok(
  $$ select public.save_child_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000003', p_name => 'Sofia', p_color => 'salvia',
       p_school_note => 'mensa compresa', p_teachers => '[]'
     ) $$,
  '23514', null,
  'note without timetable: 23514'
);
select throws_ok(
  $$ select public.save_child_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000003', p_name => 'Sofia', p_color => 'salvia',
       p_school_name => repeat('x', 61), p_teachers => '[]'
     ) $$,
  '23514', null,
  'school name of 61 characters: 23514'
);
select throws_ok(
  $$ select public.save_child_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000003', p_name => 'Sofia', p_color => 'salvia',
       p_school_starts_at => '08:15', p_school_ends_at => '16:15', p_school_days => '{1}',
       p_school_note => repeat('x', 61), p_teachers => '[]'
     ) $$,
  '23514', null,
  'note of 61 characters: 23514'
);
select throws_ok(
  $$ select public.save_child_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000003', p_name => 'Sofia', p_color => 'salvia',
       p_pajama_size => repeat('x', 11), p_teachers => '[]'
     ) $$,
  '23514', null,
  'size of 11 characters: 23514'
);
select throws_ok(
  $$ select public.save_child_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000003', p_name => 'Sofia', p_color => 'salvia',
       p_teachers => '[{"name":"Maestra Neri","phone":"12345"}]'
     ) $$,
  '23514', null,
  'phone with 5 digits: 23514'
);
select throws_ok(
  $$ select public.save_child_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000003', p_name => 'Sofia', p_color => 'salvia',
       p_teachers => '[{"name":"Maestra Neri","phone":"1234567890123456"}]'
     ) $$,
  '23514', null,
  'phone with 16 digits: 23514'
);
select throws_ok(
  $$ select public.save_child_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000003', p_name => 'Sofia', p_color => 'salvia',
       p_teachers => '[{"name":"Maestra Neri","phone":"39+3330001111"}]'
     ) $$,
  '23514', null,
  'phone with a + not at the start: 23514'
);
select throws_ok(
  $$ select public.save_child_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000003', p_name => 'Sofia', p_color => 'salvia',
       p_teachers => '[{"name":"Maestra Neri","phone":"+39 (039) 234-56.78/9 0"}]'
     ) $$,
  '23514', null,
  'phone longer than 20 characters: 23514'
);
select throws_ok(
  $$ select public.save_child_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000003', p_name => 'Sofia', p_color => 'salvia',
       p_teachers => '[{"name":"   ","subject":"Inglese"}]'
     ) $$,
  '23514', null,
  'teacher without name: 23514'
);
select throws_ok(
  $$ select public.save_child_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000003', p_name => 'Sofia', p_color => 'salvia',
       p_teachers => '[{"subject":"Inglese"}]'
     ) $$,
  '23514', null,
  'teacher without the name key: 23514'
);
select throws_ok(
  $$ select public.save_child_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000003', p_name => 'Sofia', p_color => 'salvia',
       p_teachers => '[{"name":"Maestra Neri","subject":"Inglese e francese per la scuola primaria, due ore"}]'
     ) $$,
  '23514', null,
  'subject longer than 40 characters: 23514'
);
select throws_ok(
  $$ select public.save_child_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000003', p_name => 'Sofia', p_color => 'salvia',
       p_teachers => '[{"id":"a7000000-0000-4000-8000-000000000001","name":"Maestra Bianchi"}]'
     ) $$,
  '23514', null,
  'an id sent with a teacher is refused (the database never trusts ids from the app)'
);
select throws_ok(
  $$ select public.save_child_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000003', p_name => 'Sofia', p_color => 'salvia',
       p_teachers => '[{"name":"Maestra Neri","household_id":"22222222-2222-4222-8222-222222222222"}]'
     ) $$,
  '23514', null,
  'a household sent with a teacher is refused'
);
select throws_ok(
  $$ select public.save_child_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000003', p_name => 'Sofia', p_color => 'salvia',
       p_teachers => '{"name":"Maestra Neri"}'
     ) $$,
  '23514', null,
  'teachers not in a list: 23514'
);
select throws_ok(
  $$ select public.save_child_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000003', p_name => 'Sofia', p_color => 'salvia',
       p_teachers => '["Maestra Neri"]'
     ) $$,
  '23514', null,
  'a teacher that is not an object: 23514'
);
select throws_ok(
  $$ select public.save_child_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000003', p_name => 'Sofia', p_color => 'salvia',
       p_teachers => '[{"name":"Maestra Neri","phone":3330001111}]'
     ) $$,
  '23514', null,
  'a phone that is not a text: 23514'
);
select throws_ok(
  $$ select public.save_child_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000003', p_name => 'Sofia', p_color => 'salvia',
       p_teachers => '[{"name":"M1"},{"name":"M2"},{"name":"M3"},{"name":"M4"},{"name":"M5"},{"name":"M6"}]'
     ) $$,
  'FN004', 'teacher limit reached',
  'six teachers: FN004'
);
select throws_ok(
  $$ select public.save_child_profile(null, 'Sofia', 'salvia', '[]') $$,
  '22004', null,
  'the child is required'
);
select throws_ok(
  $$ select public.save_child_profile('a1000000-0000-4000-8000-000000000003', null, 'salvia', '[]') $$,
  '22004', null,
  'the name is required'
);
select throws_ok(
  $$ select public.save_child_profile('a1000000-0000-4000-8000-000000000003', 'Sofia', null, '[]') $$,
  '22004', null,
  'the colour is required'
);
select throws_ok(
  $$ select public.save_child_profile('a1000000-0000-4000-8000-000000000003', 'Sofia', 'salvia', null) $$,
  '22004', null,
  'the list of teachers is required'
);
select results_eq(
  $$ select m.name, m.color::text, m.birth_date, p.school_name, p.school_class, p.school_starts_at::text,
            p.school_days::text, p.school_note, p.shoe_size, p.clothing_size, p.pajama_size,
            (select string_agg(t.name, ',' order by t.sort_order) from public.child_teachers t where t.member_id = m.id)
     from public.household_members m
     join public.child_profiles p on p.member_id = m.id
     where m.id = 'a1000000-0000-4000-8000-000000000003' $$,
  $$ values ('Sofia', 'salvia', '2016-12-14'::date, 'scuola Manzoni', '4ª B', '08:15:00', '{1,2,3,4,5}',
             'mensa compresa', '33', '9–10', '140', 'Maestra Bianchi,Maestro Rossi') $$,
  'after every refused save the profile of Sofia is unchanged'
);

-- Only children.
select throws_ok(
  $$ select public.save_child_profile('a1000000-0000-4000-8000-000000000002', 'Laura', 'glicine', '[]') $$,
  '23514', 'only children have a school, sizes and teachers',
  'an adult of the household (Laura) has no school, sizes or teachers'
);
select throws_ok(
  $$ select public.save_child_profile('a1000000-0000-4000-8000-000000000005', 'Biscotto', 'zafferano', '[]') $$,
  '23514', 'only children have a school, sizes and teachers',
  'a pet (Biscotto) has no school, sizes or teachers'
);
select throws_ok(
  $$ select public.save_child_profile('a1000000-0000-4000-8000-000000000001', 'Marco', 'pomodoro', '[]') $$,
  '23514', 'only children have a school, sizes and teachers',
  'the caller himself has no school, sizes or teachers'
);
select throws_ok(
  $$ insert into public.child_profiles (member_id, shoe_size) values ('a1000000-0000-4000-8000-000000000005', '33') $$,
  '23503', null,
  'A cannot give sizes to the pet with a direct insert'
);
select throws_ok(
  $$ insert into public.child_teachers (member_id, sort_order, name)
     values ('a1000000-0000-4000-8000-000000000002', 1, 'Maestra Neri') $$,
  '23503', null,
  'A cannot give a teacher to an adult with a direct insert'
);
select throws_ok(
  $$ insert into public.child_profiles (household_id, member_id, shoe_size)
     values ('11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000004', '28') $$,
  '42501', null,
  'the app cannot choose the household of a profile'
);

-- Limit of five teachers, also with direct inserts (Tommaso).
select lives_ok(
  $$ select public.save_child_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000004', p_name => 'Tommaso', p_color => 'cobalto',
       p_birth_date => '2020-04-02',
       p_teachers => '[{"name":"M1"},{"name":"M2"},{"name":"M3"},{"name":"M4"},{"name":"M5"}]'
     ) $$,
  'five teachers are allowed'
);
select results_eq(
  $$ select string_agg(t.name, ',' order by t.sort_order) from public.child_teachers t
     where t.member_id = 'a1000000-0000-4000-8000-000000000004' $$,
  $$ values ('M1,M2,M3,M4,M5') $$,
  'Tommaso has five teachers in order, and no profile row is needed for them'
);
select is_empty(
  $$ select 1 from public.child_profiles p where p.member_id = 'a1000000-0000-4000-8000-000000000004' $$,
  'only teachers: no row of school and sizes for Tommaso'
);
select throws_ok(
  $$ insert into public.child_teachers (member_id, sort_order, name)
     values ('a1000000-0000-4000-8000-000000000004', 5, 'M6') $$,
  'FN004', 'teacher limit reached',
  'a sixth teacher with a direct insert: FN004'
);

-- Only POST through the Data API (lesson of #112).
set local request.method to 'GET';
select throws_ok(
  $$ select public.save_child_profile('a1000000-0000-4000-8000-000000000003', 'Sofia', 'salvia', '[]') $$,
  'P0001', 'use POST', 'save_child_profile refuses GET'
);
set local request.method to 'HEAD';
select throws_ok(
  $$ select public.save_child_profile('a1000000-0000-4000-8000-000000000003', 'Sofia', 'salvia', '[]') $$,
  'P0001', 'use POST', 'save_child_profile refuses HEAD'
);
set local request.method to 'PUT';
select throws_ok(
  $$ select public.save_child_profile('a1000000-0000-4000-8000-000000000003', 'Sofia', 'salvia', '[]') $$,
  'P0001', 'use POST', 'save_child_profile refuses PUT'
);
set local request.method to 'POST';

-- ---------------------------------------------------------------------------
-- Giulia (B, another household): reads nothing, writes nothing
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';

select is_empty($$ select 1 from public.child_profiles $$, 'B reads no school or sizes of Casa D''Angelo');
select is_empty($$ select 1 from public.child_teachers $$, 'B reads no teacher of Casa D''Angelo');
select throws_ok(
  $$ select public.save_child_profile('a1000000-0000-4000-8000-000000000003', 'Sofia', 'salvia', '[]') $$,
  '42501', null,
  'B cannot save the profile of Sofia'
);
select throws_ok(
  $$ select public.save_child_profile('a1000000-0000-4000-8000-000000000004', 'Tommaso', 'cobalto', '[]') $$,
  '42501', null,
  'B cannot save the profile of Tommaso'
);
select throws_ok(
  $$ select public.save_child_profile('a1000000-0000-4000-8000-000000000099', 'Nessuno', 'salvia', '[]') $$,
  '42501', null,
  'B gets the same answer for a member that does not exist'
);
select results_eq(
  $$ with u as (
       update public.child_profiles set school_class = '1ª A', shoe_size = '20'
       where member_id = 'a1000000-0000-4000-8000-000000000003'
       returning 1
     ) select count(*)::integer from u $$,
  $$ values (0) $$,
  'B changes no school or sizes of Sofia'
);
select results_eq(
  $$ with u as (
       update public.child_teachers set name = 'Maestra Rubata', phone = '000 000 000'
       where member_id = 'a1000000-0000-4000-8000-000000000003'
       returning 1
     ) select count(*)::integer from u $$,
  $$ values (0) $$,
  'B changes no teacher of Sofia'
);
select results_eq(
  $$ with d as (
       delete from public.child_profiles where member_id = 'a1000000-0000-4000-8000-000000000003' returning 1
     ) select count(*)::integer from d $$,
  $$ values (0) $$,
  'B deletes no school or sizes of Sofia'
);
select results_eq(
  $$ with d as (
       delete from public.child_teachers where member_id in ('a1000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000004')
       returning 1
     ) select count(*)::integer from d $$,
  $$ values (0) $$,
  'B deletes no teacher of Casa D''Angelo'
);
select throws_ok(
  $$ insert into public.child_teachers (member_id, sort_order, name)
     values ('a1000000-0000-4000-8000-000000000003', 1, 'Maestra Intrusa') $$,
  '42501', null,
  'B cannot add a teacher to Sofia (same answer whatever her teachers)'
);
select throws_ok(
  $$ insert into public.child_profiles (member_id, shoe_size) values ('a1000000-0000-4000-8000-000000000003', '20') $$,
  '42501', null,
  'B cannot add a profile to Sofia (same answer although she has one)'
);
select throws_ok(
  $$ insert into public.child_profiles (member_id, shoe_size) values ('a1000000-0000-4000-8000-000000000004', '20') $$,
  '42501', null,
  'B cannot add a profile to Tommaso'
);

-- ---------------------------------------------------------------------------
-- Paolo (B2, not administrator) saves Leo's profile; Giulia reads it; A does not
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';

select lives_ok(
  $$ select public.save_child_profile(
       p_member_id => 'b1000000-0000-4000-8000-000000000003', p_name => 'Leo', p_color => 'zafferano',
       p_birth_date => '2019-09-05', p_school_name => 'scuola dell''infanzia Rodari', p_school_class => 'Sezione blu',
       p_school_starts_at => '08:30', p_school_ends_at => '16:00', p_school_days => '{1,2,3,4,5,6}',
       p_school_note => 'mensa e doposcuola', p_clothing_size => '5–6',
       p_teachers => '[{"name":"Maestra Gialli","phone":"+39 02 000 0000"}]'
     ) $$,
  'B2 (not administrator) saves the profile of Leo'
);
select results_eq(
  $$ select p.household_id, p.school_name, p.school_days::text, p.school_note, p.clothing_size, p.sizes_updated_at = now()
     from public.child_profiles p $$,
  $$ values ('22222222-2222-4222-8222-222222222222'::uuid, 'scuola dell''infanzia Rodari', '{1,2,3,4,5,6}',
             'mensa e doposcuola', '5–6', true) $$,
  'B2 reads the profile of Leo, in Casa Bianchi'
);

set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select results_eq(
  $$ select t.name, t.phone from public.child_teachers t $$,
  $$ values ('Maestra Gialli', '+39 02 000 0000') $$,
  'B reads the teacher of Leo saved by B2'
);

set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select is_empty(
  $$ select 1 from public.child_profiles p where p.member_id = 'b1000000-0000-4000-8000-000000000003'
     union all
     select 1 from public.child_teachers t where t.member_id = 'b1000000-0000-4000-8000-000000000003' $$,
  'A reads nothing of Leo'
);
select throws_ok(
  $$ select public.save_child_profile('b1000000-0000-4000-8000-000000000003', 'Leo', 'zafferano', '[]') $$,
  '42501', null,
  'A cannot save the profile of Leo'
);

-- ---------------------------------------------------------------------------
-- Chiara (C, signed in without household) and anon
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}';

select is_empty(
  $$ select 1 from public.child_profiles union all select 1 from public.child_teachers $$,
  'C reads no school, sizes or teachers'
);
select throws_ok(
  $$ select public.save_child_profile('a1000000-0000-4000-8000-000000000003', 'Sofia', 'salvia', '[]') $$,
  '42501', null,
  'C cannot save any profile'
);
select throws_ok(
  $$ insert into public.child_profiles (member_id, shoe_size) values ('a1000000-0000-4000-8000-000000000003', '20') $$,
  '42501', null,
  'C cannot insert a profile'
);
select throws_ok(
  $$ insert into public.child_teachers (member_id, sort_order, name)
     values ('a1000000-0000-4000-8000-000000000003', 3, 'Maestra Intrusa') $$,
  '42501', null,
  'C cannot insert a teacher'
);

reset role;
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';

select throws_ok($$ select 1 from public.child_profiles $$, '42501', null, 'anon cannot read child_profiles');
select throws_ok($$ select 1 from public.child_teachers $$, '42501', null, 'anon cannot read child_teachers');
select throws_ok(
  $$ insert into public.child_teachers (member_id, sort_order, name)
     values ('a1000000-0000-4000-8000-000000000003', 3, 'Maestra Intrusa') $$,
  '42501', null,
  'anon cannot insert a teacher'
);
select throws_ok(
  $$ select public.save_child_profile('a1000000-0000-4000-8000-000000000003', 'Sofia', 'salvia', '[]') $$,
  '42501', null,
  'anon cannot save a profile'
);

-- ---------------------------------------------------------------------------
-- What the others tried changed nothing (as database owner)
-- ---------------------------------------------------------------------------
reset role;

select results_eq(
  $$ select m.name, p.school_class, p.shoe_size,
            (select string_agg(t.name || ':' || coalesce(t.phone, '-'), ',' order by t.sort_order)
             from public.child_teachers t where t.member_id = m.id)
     from public.household_members m
     join public.child_profiles p on p.member_id = m.id
     where m.id = 'a1000000-0000-4000-8000-000000000003' $$,
  $$ values ('Sofia', '4ª B', '33', 'Maestra Bianchi:039 000 0000,Maestro Rossi:-') $$,
  'the profile of Sofia is exactly what A saved'
);
select results_eq(
  $$ select p.household_id, count(*)::integer from public.child_profiles p group by p.household_id order by 1 $$,
  $$ values ('11111111-1111-4111-8111-111111111111'::uuid, 1), ('22222222-2222-4222-8222-222222222222'::uuid, 1) $$,
  'one profile per household: Sofia and Leo (nothing written by B, C or anon)'
);
select results_eq(
  $$ select t.member_id, count(*)::integer from public.child_teachers t group by t.member_id order by 1 $$,
  $$ values ('a1000000-0000-4000-8000-000000000003'::uuid, 2), ('a1000000-0000-4000-8000-000000000004'::uuid, 5),
            ('b1000000-0000-4000-8000-000000000003'::uuid, 1) $$,
  'teachers: two for Sofia, five for Tommaso, one for Leo'
);

-- Trusted roles (the admin client of the page tests) may set the time of the sizes.
select lives_ok(
  $$ update public.child_profiles set sizes_updated_at = '2025-09-15 10:00+02'
     where member_id = 'a1000000-0000-4000-8000-000000000003' $$,
  'the database owner sets a fixed time of the sizes'
);
select is(
  (select p.sizes_updated_at from public.child_profiles p where p.member_id = 'a1000000-0000-4000-8000-000000000003'),
  '2025-09-15 10:00+02'::timestamptz,
  'the fixed time of the sizes is kept'
);

-- ---------------------------------------------------------------------------
-- Cascades
-- ---------------------------------------------------------------------------
-- A removes Tommaso from the household: his teachers go with him.
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
set local request.method to 'POST';
select lives_ok(
  $$ delete from public.household_members where id = 'a1000000-0000-4000-8000-000000000004' $$,
  'A removes Tommaso'
);
reset role;
select is_empty(
  $$ select 1 from public.child_teachers t where t.member_id = 'a1000000-0000-4000-8000-000000000004' $$,
  'removing a child deletes his teachers'
);

-- Giulia deletes her account: Casa Bianchi stays with Paolo, and so does Leo's profile.
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$ select public.delete_own_account(false) $$, 'B deletes her account (Casa Bianchi stays)');
reset role;
select results_eq(
  $$ select (select count(*)::integer from public.child_profiles p where p.member_id = 'b1000000-0000-4000-8000-000000000003'),
            (select count(*)::integer from public.child_teachers t where t.member_id = 'b1000000-0000-4000-8000-000000000003') $$,
  $$ values (1, 1) $$,
  'the household stays: the profile of Leo stays for the other adults'
);

-- Paolo, last adult with an account of Casa Bianchi, deletes his account: the household goes.
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok($$ select public.delete_own_account(true) $$, 'B2 deletes his account (Casa Bianchi goes)');
reset role;
select is_empty(
  $$ select 1 from public.child_profiles p where p.household_id = '22222222-2222-4222-8222-222222222222'
     union all
     select 1 from public.child_teachers t where t.household_id = '22222222-2222-4222-8222-222222222222' $$,
  'the household is deleted: the school, sizes and teachers of Leo are deleted'
);

-- Marco, only adult with an account of Casa D'Angelo, deletes his account.
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$ select public.delete_own_account(true) $$, 'A deletes his account (Casa D''Angelo goes)');
reset role;
select is_empty(
  $$ select 1 from public.child_profiles union all select 1 from public.child_teachers $$,
  'no school, sizes or teachers are left in the database'
);

select * from finish();
rollback;
