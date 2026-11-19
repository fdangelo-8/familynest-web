-- pet_profiles, pet_photos and save_pet_profile() (issue #488, part C of #460 «Profilo
-- dell'animale»): schema and privileges, no health, microchip or address column, only pets
-- (never an adult or a child), saving by an adult of the household with everything or
-- nothing, the date in the right place and within 40 years, lengths and phone rules in the
-- database, photos only WebP or JPEG up to 100 KB without metadata blocks, the photo kept,
-- replaced or removed, only POST, the kind of a member that cannot change, isolation in both
-- directions also with the administrator of the other household (privileges and policies),
-- a signed-in user without household, anon, the administrative key, and the cascades when the
-- pet is removed and when the household is deleted.
-- Seed ids: A = Marco (Casa D'Angelo, admin), B = Giulia (Casa Bianchi, admin), B2 = Paolo
-- (Casa Bianchi, not admin), C = Chiara (no household).
-- Members: Casa D'Angelo Marco a1…01 (pomodoro), Sofia a1…03 (child), Biscotto a1…05 (pet,
-- zafferano). Casa Bianchi has no pet in the seed: Pallina b1…09 (pet, glicine) is added here,
-- and so is Micio a1…a5 (pet of Casa D'Angelo, lampone, birth date of 45 years ago).
-- The vet data are invented (the vet data of a pet are allowed in tests, answer 3 of #460);
-- no health data of any person.
begin;
create extension if not exists pgtap with schema extensions;

select plan(147);

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------
select has_table('public', 'pet_profiles', 'pet_profiles exists');
select has_table('public', 'pet_photos', 'pet_photos exists');
select ok(
  (select c.relrowsecurity from pg_class c where c.oid = 'public.pet_profiles'::regclass),
  'RLS enabled on pet_profiles'
);
select ok(
  (select c.relrowsecurity from pg_class c where c.oid = 'public.pet_photos'::regclass),
  'RLS enabled on pet_photos'
);
select columns_are(
  'public', 'pet_profiles',
  array[
    'id', 'household_id', 'member_id', 'member_kind', 'species', 'date_kind', 'date_precision', 'date_year',
    'adoption_date', 'food', 'vet_name', 'vet_clinic', 'vet_phone', 'note', 'created_at', 'updated_at'
  ],
  'pet_profiles has exactly the planned columns (CA-43)'
);
select columns_are(
  'public', 'pet_photos',
  array['member_id', 'household_id', 'member_kind', 'content_type', 'data', 'created_at'],
  'pet_photos has exactly the planned columns'
);
select is_empty(
  $$ select c.table_name || '.' || c.column_name
     from information_schema.columns c
     where c.table_schema = 'public'
       and c.table_name in ('pet_profiles', 'pet_photos')
       and c.column_name ~* '(address|indirizz|street|city|health|medic|allerg|vacc|farmac|drug|weight|peso|microchip|chip|email|mail|location|posiz|gps|assist)' $$,
  'no column about health, microchip, addresses, emails or places'
);
select fk_ok(
  'public', 'pet_profiles', 'household_id', 'public', 'households', 'id',
  'pet_profiles.household_id references households'
);
select fk_ok(
  'public', 'pet_profiles', array['member_id', 'household_id', 'member_kind'],
  'public', 'household_members', array['id', 'household_id', 'kind'],
  'a profile belongs to a pet of the same household'
);
select fk_ok(
  'public', 'pet_photos', 'household_id', 'public', 'households', 'id',
  'pet_photos.household_id references households'
);
select fk_ok(
  'public', 'pet_photos', array['member_id', 'household_id', 'member_kind'],
  'public', 'household_members', array['id', 'household_id', 'kind'],
  'a photo belongs to a pet of the same household'
);
select is(
  (select array_agg(k.confdeltype::text || k.confupdtype::text order by k.conname)
   from pg_constraint k
   where k.conrelid in ('public.pet_profiles'::regclass, 'public.pet_photos'::regclass)
     and k.contype = 'f'),
  array['ca', 'ca', 'ca', 'ca'],
  'every foreign key of the two tables is on delete cascade and refuses a change of the referenced key'
);
select col_is_unique('public', 'pet_profiles', array['member_id'], 'a pet has at most one profile');
select col_is_pk('public', 'pet_photos', array['member_id'], 'a pet has at most one photo');
select has_index('public', 'pet_profiles', 'pet_profiles_household_id_idx', 'index on pet_profiles.household_id');
select has_index('public', 'pet_photos', 'pet_photos_household_id_idx', 'index on pet_photos.household_id');
select ok(
  not exists (
    select 1 from pg_publication_tables p
    where p.schemaname = 'public' and p.tablename in ('pet_profiles', 'pet_photos')
  ),
  'profiles and photos of pets are not sent in real time'
);
select enum_has_labels('public', 'pet_species', array['dog', 'cat', 'other'], 'pet_species labels (answer 9)');
select enum_has_labels('public', 'pet_date_kind', array['birth', 'adoption'], 'pet_date_kind labels');
select enum_has_labels('public', 'pet_date_precision', array['day', 'year'], 'pet_date_precision labels');
select has_function(
  'public', 'save_pet_profile',
  array['uuid', 'text', 'member_color', 'pet_species', 'pet_date_kind', 'pet_date_precision', 'date', 'integer',
        'text', 'text', 'text', 'text', 'text', 'text', 'text', 'boolean'],
  'save_pet_profile exists'
);
select ok(
  (select p.prosecdef and coalesce(p.proconfig @> array['search_path=""'], false)
   from pg_proc p
   where p.oid = 'public.save_pet_profile(uuid, text, public.member_color, public.pet_species, public.pet_date_kind, public.pet_date_precision, date, integer, text, text, text, text, text, text, text, boolean)'::regprocedure),
  'save_pet_profile is security definer with an empty search_path'
);
select ok(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where (p.prosecdef or not coalesce(p.proconfig @> array['search_path=""'], false))
      and (n.nspname, p.proname) in (
        ('private', 'pet_profiles_before_write'), ('private', 'household_members_pet_birth_date_range'),
        ('private', 'pet_photo_without_metadata')
      )
  ),
  'the trigger and check functions run as the writer, with an empty search_path'
);
-- CA-L6: nothing else (public wish list, invitation preview, notifications, search) reads
-- the profile or the photo of a pet.
select is_empty(
  $$ select n.nspname || '.' || p.proname
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public', 'private')
       and p.prosrc ~ '(pet_profiles|pet_photos)'
       and (n.nspname, p.proname) not in (('public', 'save_pet_profile'), ('private', 'pet_profiles_before_write')) $$,
  'no other function reads the profile or the photo of a pet'
);
select is_empty(
  $$ select b.id from storage.buckets b where b.public $$,
  'no public Storage bucket (the photo is stored in the database)'
);

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
select ok(
  not has_table_privilege('anon', 'public.pet_profiles', 'select, insert, update, delete')
  and not has_table_privilege('anon', 'public.pet_photos', 'select, insert, update, delete')
  and not has_any_column_privilege('anon', 'public.pet_profiles', 'select, insert, update')
  and not has_any_column_privilege('anon', 'public.pet_photos', 'select, insert, update'),
  'anon has no privilege on profiles and photos of pets'
);
select ok(
  has_table_privilege('authenticated', 'public.pet_profiles', 'select')
  and has_table_privilege('authenticated', 'public.pet_photos', 'select')
  and not has_table_privilege('authenticated', 'public.pet_profiles', 'insert, update, delete, truncate, references, trigger')
  and not has_table_privilege('authenticated', 'public.pet_photos', 'insert, update, delete, truncate, references, trigger')
  and not has_any_column_privilege('authenticated', 'public.pet_profiles', 'insert, update')
  and not has_any_column_privilege('authenticated', 'public.pet_photos', 'insert, update'),
  'authenticated only reads profiles and photos of pets: every write goes through save_pet_profile'
);
select ok(
  has_function_privilege('authenticated', 'public.save_pet_profile(uuid, text, public.member_color, public.pet_species, public.pet_date_kind, public.pet_date_precision, date, integer, text, text, text, text, text, text, text, boolean)', 'execute')
  and not has_function_privilege('anon', 'public.save_pet_profile(uuid, text, public.member_color, public.pet_species, public.pet_date_kind, public.pet_date_precision, date, integer, text, text, text, text, text, text, text, boolean)', 'execute'),
  'save_pet_profile: authenticated only'
);
select ok(
  not has_function_privilege('authenticated', 'private.pet_profiles_before_write()', 'execute')
  and not has_function_privilege('anon', 'private.pet_profiles_before_write()', 'execute')
  and not has_function_privilege('authenticated', 'private.household_members_pet_birth_date_range()', 'execute')
  and not has_function_privilege('anon', 'private.household_members_pet_birth_date_range()', 'execute')
  and not has_function_privilege('authenticated', 'private.pet_photo_without_metadata(text, bytea)', 'execute')
  and not has_function_privilege('anon', 'private.pet_photo_without_metadata(text, bytea)', 'execute'),
  'the private functions of the pet profile are not callable by the API roles'
);
select ok(
  not has_column_privilege('authenticated', 'public.household_members', 'kind', 'update')
  and not has_column_privilege('authenticated', 'public.household_members', 'household_id', 'update'),
  'the API roles cannot change the kind or the household of a member'
);

-- ---------------------------------------------------------------------------
-- Fixtures (database owner): a pet in Casa Bianchi.
-- ---------------------------------------------------------------------------
insert into public.household_members (id, household_id, kind, name, color)
values ('b1000000-0000-4000-8000-000000000009', '22222222-2222-4222-8222-222222222222', 'pet', 'Pallina', 'glicine');

-- Micio a1…a5 (pet of Casa D'Angelo, lampone) with a birth date 45 years ago, as if it had
-- been saved before the limit of 40 years existed. Prepared as database owner with the
-- trigger of the limit switched off for this insert only (inside this transaction): no role
-- of the app can write such a date any more.
alter table public.household_members disable trigger household_members_pet_birth_date_range;
insert into public.household_members (id, household_id, kind, name, color, birth_date)
values ('a1000000-0000-4000-8000-0000000000a5', '11111111-1111-4111-8111-111111111111', 'pet', 'Micio', 'lampone',
        ((now() at time zone 'Europe/Rome')::date - interval '45 years')::date);
alter table public.household_members enable trigger household_members_pet_birth_date_range;

-- ---------------------------------------------------------------------------
-- Marco (A, administrator): saves the profile of Biscotto
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';

-- A date saved earlier never blocks the other changes: Micio keeps his old birth date and
-- changes name and colour.
select lives_ok(
  $$ select public.save_pet_profile(
       p_member_id => 'a1000000-0000-4000-8000-0000000000a5', p_name => 'Micione', p_color => 'ceruleo',
       p_date_kind => 'birth', p_date_precision => 'day',
       p_date => ((now() at time zone 'Europe/Rome')::date - interval '45 years')::date
     ) $$,
  'a pet with a birth date of more than 40 years ago (saved earlier) changes name and colour'
);
select results_eq(
  $$ select name, color::text, birth_date from public.household_members where id = 'a1000000-0000-4000-8000-0000000000a5' $$,
  $$ values ('Micione', 'ceruleo', ((now() at time zone 'Europe/Rome')::date - interval '45 years')::date) $$,
  'Micio has the new name and colour, and the same birth date'
);

select is_empty(
  $$ select 1 from public.pet_profiles where member_id = 'a1000000-0000-4000-8000-000000000005'
     union all
     select 1 from public.pet_photos where member_id = 'a1000000-0000-4000-8000-000000000005' $$,
  'CA-34: Biscotto starts without profile and photo'
);

-- CA-35: cat, adoption with only the year 2022, food, vet, note, and a JPEG photo.
select lives_ok(
  $$ select public.save_pet_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000005', p_name => ' Biscotto ', p_color => 'zafferano',
       p_species => 'cat', p_date_kind => 'adoption', p_date_precision => 'year', p_date_year => 2022,
       p_food => '  Crocchette   Monge 12 kg ', p_vet_name => 'Dott.ssa Elena Ferri', p_vet_clinic => 'Clinica Veterinaria San Rocco',
       p_vet_phone => '+39 02 1234-5678', p_note => 'Ha paura dei temporali.',
       p_photo_base64 => encode('\xffd8ffe000104a46494600010100000100010000ffdb00040000ffda0008010100003f00a1b2c3ffd9'::bytea, 'base64'),
       p_photo_content_type => 'image/jpeg'
     ) $$,
  'CA-35: Marco saves species, adoption year, food, vet, note and photo of Biscotto'
);
select results_eq(
  $$ select species::text, date_kind::text, date_precision::text, date_year::integer, adoption_date,
            food, vet_name, vet_clinic, vet_phone, note, household_id
     from public.pet_profiles where member_id = 'a1000000-0000-4000-8000-000000000005' $$,
  $$ values ('cat', 'adoption', 'year', 2022, null::date, 'Crocchette Monge 12 kg', 'Dott.ssa Elena Ferri',
             'Clinica Veterinaria San Rocco', '+39 02 1234-5678', 'Ha paura dei temporali.',
             '11111111-1111-4111-8111-111111111111'::uuid) $$,
  'CA-35: the profile is saved, normalised, in the household of Marco'
);
select results_eq(
  $$ select name, color::text, birth_date from public.household_members where id = 'a1000000-0000-4000-8000-000000000005' $$,
  $$ values ('Biscotto', 'zafferano', null::date) $$,
  'the member keeps name and colour, and no birth date with an adoption'
);
select results_eq(
  $$ select content_type, data, household_id from public.pet_photos where member_id = 'a1000000-0000-4000-8000-000000000005' $$,
  $$ values ('image/jpeg', '\xffd8ffe000104a46494600010100000100010000ffdb00040000ffda0008010100003f00a1b2c3ffd9'::bytea,
             '11111111-1111-4111-8111-111111111111'::uuid) $$,
  'the photo is stored with its bytes in the household of Marco'
);

-- The date: a day of birth goes to the member, every other date to the profile.
select lives_ok(
  $$ select public.save_pet_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000005', p_name => 'Biscotto', p_color => 'zafferano',
       p_species => 'dog', p_date_kind => 'birth', p_date_precision => 'day',
       p_date => ((now() at time zone 'Europe/Rome')::date - interval '3 years')::date,
       p_food => 'Crocchette Monge 12 kg'
     ) $$,
  'Marco saves a day of birth'
);
select results_eq(
  $$ select m.birth_date, p.date_kind::text, p.date_precision::text, p.date_year::integer, p.adoption_date
     from public.household_members m
     join public.pet_profiles p on p.member_id = m.id
     where m.id = 'a1000000-0000-4000-8000-000000000005' $$,
  $$ values (((now() at time zone 'Europe/Rome')::date - interval '3 years')::date, null::text, null::text, null::integer, null::date) $$,
  'a day of birth is household_members.birth_date, and the profile keeps no date'
);
select lives_ok(
  $$ select public.save_pet_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000005', p_name => 'Biscotto', p_color => 'zafferano',
       p_date_kind => 'adoption', p_date_precision => 'day',
       p_date => ((now() at time zone 'Europe/Rome')::date - interval '1 year')::date
     ) $$,
  'Marco saves a day of adoption'
);
select results_eq(
  $$ select m.birth_date, p.date_kind::text, p.date_precision::text, p.date_year::integer, p.adoption_date
     from public.household_members m
     join public.pet_profiles p on p.member_id = m.id
     where m.id = 'a1000000-0000-4000-8000-000000000005' $$,
  $$ values (null::date, 'adoption', 'day', null::integer, ((now() at time zone 'Europe/Rome')::date - interval '1 year')::date) $$,
  'a day of adoption is in the profile, and the birth date of the member is cleared'
);
select lives_ok(
  $$ select public.save_pet_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000005', p_name => 'Biscotto', p_color => 'zafferano',
       p_date_kind => 'birth', p_date_precision => 'year',
       p_date_year => extract(year from now() at time zone 'Europe/Rome')::integer - 40
     ) $$,
  'a year of birth 40 years ago is accepted'
);
select results_eq(
  $$ select m.birth_date, p.date_kind::text, p.date_precision::text, p.date_year::integer, p.adoption_date
     from public.household_members m
     join public.pet_profiles p on p.member_id = m.id
     where m.id = 'a1000000-0000-4000-8000-000000000005' $$,
  $$ values (null::date, 'birth', 'year', extract(year from now() at time zone 'Europe/Rome')::integer - 40, null::date) $$,
  'a year of birth is in the profile'
);
select lives_ok(
  $$ select public.save_pet_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000005', p_name => 'Biscotto', p_color => 'zafferano',
       p_date_kind => 'birth', p_date_precision => 'day',
       p_date => ((now() at time zone 'Europe/Rome')::date - interval '40 years')::date
     ) $$,
  'a day of birth exactly 40 years ago is accepted'
);

-- CA-38: never in the future, never before 40 years ago; never an incomplete date.
select throws_ok(
  $$ select public.save_pet_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000005', p_name => 'Biscotto', p_color => 'zafferano',
       p_date_kind => 'birth', p_date_precision => 'day',
       p_date => (now() at time zone 'Europe/Rome')::date + 1
     ) $$,
  '23514', null,
  'CA-38: a day of birth after today is refused'
);
select throws_ok(
  $$ select public.save_pet_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000005', p_name => 'Biscotto', p_color => 'zafferano',
       p_date_kind => 'birth', p_date_precision => 'day',
       p_date => ((now() at time zone 'Europe/Rome')::date - interval '40 years')::date - 1
     ) $$,
  '23514', null,
  'a day of birth before 40 years ago is refused'
);
select throws_ok(
  $$ select public.save_pet_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000005', p_name => 'Biscotto', p_color => 'zafferano',
       p_date_kind => 'adoption', p_date_precision => 'day',
       p_date => (now() at time zone 'Europe/Rome')::date + 1
     ) $$,
  '23514', null,
  'a day of adoption after today is refused'
);
select throws_ok(
  $$ select public.save_pet_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000005', p_name => 'Biscotto', p_color => 'zafferano',
       p_date_kind => 'adoption', p_date_precision => 'day',
       p_date => ((now() at time zone 'Europe/Rome')::date - interval '40 years')::date - 1
     ) $$,
  '23514', null,
  'a day of adoption before 40 years ago is refused'
);
select throws_ok(
  $$ select public.save_pet_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000005', p_name => 'Biscotto', p_color => 'zafferano',
       p_date_kind => 'birth', p_date_precision => 'year',
       p_date_year => extract(year from now() at time zone 'Europe/Rome')::integer - 41
     ) $$,
  '23514', null,
  'CA-38: a year of birth 41 years ago (1985 in 2026) is refused'
);
select throws_ok(
  $$ select public.save_pet_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000005', p_name => 'Biscotto', p_color => 'zafferano',
       p_date_kind => 'adoption', p_date_precision => 'year',
       p_date_year => extract(year from now() at time zone 'Europe/Rome')::integer + 1
     ) $$,
  '23514', null,
  'a year of adoption after this year is refused'
);
select throws_ok(
  $$ select public.save_pet_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000005', p_name => 'Biscotto', p_color => 'zafferano',
       p_date_kind => 'adoption', p_date_precision => 'year', p_date_year => 100000
     ) $$,
  '23514', null,
  'a year outside any range is refused'
);
select throws_ok(
  $$ select public.save_pet_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000005', p_name => 'Biscotto', p_color => 'zafferano',
       p_date_kind => 'birth', p_date => (now() at time zone 'Europe/Rome')::date - 10
     ) $$,
  '23514', null,
  'a date without precision is refused'
);
select throws_ok(
  $$ select public.save_pet_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000005', p_name => 'Biscotto', p_color => 'zafferano',
       p_date_kind => 'birth', p_date_precision => 'day', p_date_year => 2022
     ) $$,
  '23514', null,
  'a precision «day» with a year and no day is refused'
);
select throws_ok(
  $$ select public.save_pet_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000005', p_name => 'Biscotto', p_color => 'zafferano',
       p_date => (now() at time zone 'Europe/Rome')::date - 10
     ) $$,
  '23514', null,
  'a day without kind and precision is refused'
);

-- A known state for the checks of «nothing changed».
select lives_ok(
  $$ select public.save_pet_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000005', p_name => 'Biscotto', p_color => 'zafferano',
       p_species => 'dog', p_food => 'Crocchette Monge 12 kg', p_vet_name => 'Dott.ssa Elena Ferri',
       p_vet_phone => '+39 02 1234-5678'
     ) $$,
  'Marco saves Biscotto again'
);

-- CA-36: phone of the vet with 5 digits or a letter: nothing of the profile changes, also
-- the name of the member written before the error.
select throws_ok(
  $$ select public.save_pet_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000005', p_name => 'Fido', p_color => 'cannella',
       p_species => 'cat', p_food => 'Scatolette', p_vet_phone => '12345'
     ) $$,
  '23514', null,
  'CA-36: a phone with 5 digits is refused'
);
select throws_ok(
  $$ select public.save_pet_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000005', p_name => 'Fido', p_color => 'cannella',
       p_species => 'cat', p_food => 'Scatolette', p_vet_phone => '02 1234a678'
     ) $$,
  '23514', null,
  'CA-36: a phone with a letter is refused'
);
select throws_ok(
  $$ select public.save_pet_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000005', p_name => 'Fido', p_color => 'cannella',
       p_vet_phone => '+39 1234567890123456'
     ) $$,
  '23514', null,
  'a phone with 16 digits is refused'
);
select results_eq(
  $$ select m.name, m.color::text, p.species::text, p.food, p.vet_phone
     from public.household_members m
     join public.pet_profiles p on p.member_id = m.id
     where m.id = 'a1000000-0000-4000-8000-000000000005' $$,
  $$ values ('Biscotto', 'zafferano', 'dog', 'Crocchette Monge 12 kg', '+39 02 1234-5678') $$,
  'CA-36: after the errors no field of the member or of the profile changed'
);

-- CA-37: the database refuses the longer texts and keeps the longest allowed.
select throws_ok(
  $$ select public.save_pet_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000005', p_name => 'Biscotto', p_color => 'zafferano',
       p_food => repeat('c', 81)
     ) $$,
  '23514', null,
  'CA-37: food of 81 characters is refused'
);
select throws_ok(
  $$ select public.save_pet_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000005', p_name => 'Biscotto', p_color => 'zafferano',
       p_note => repeat('n', 201)
     ) $$,
  '23514', null,
  'CA-37: a note of 201 characters is refused'
);
select throws_ok(
  $$ select public.save_pet_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000005', p_name => 'Biscotto', p_color => 'zafferano',
       p_vet_name => repeat('v', 41)
     ) $$,
  '23514', null,
  'CA-37: a vet name of 41 characters is refused'
);
select throws_ok(
  $$ select public.save_pet_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000005', p_name => 'Biscotto', p_color => 'zafferano',
       p_vet_clinic => repeat('s', 61)
     ) $$,
  '23514', null,
  'CA-37: a practice of 61 characters is refused'
);
select throws_ok(
  $$ select public.save_pet_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000005', p_name => repeat('b', 41), p_color => 'zafferano'
     ) $$,
  '23514', null,
  'a name of 41 characters is refused'
);
select throws_ok(
  $$ select public.save_pet_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000005', p_name => '   ', p_color => 'zafferano'
     ) $$,
  '23514', null,
  'an empty name is refused'
);
select lives_ok(
  $$ select public.save_pet_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000005', p_name => 'Biscotto', p_color => 'zafferano',
       p_species => 'dog', p_food => repeat('c', 80), p_note => repeat('n', 200), p_vet_name => repeat('v', 40),
       p_vet_clinic => repeat('s', 60), p_vet_phone => '+39 02 1234-5678'
     ) $$,
  'CA-37: 80, 200, 40 and 60 characters are accepted'
);
select results_eq(
  $$ select char_length(food), char_length(note), char_length(vet_name), char_length(vet_clinic)
     from public.pet_profiles where member_id = 'a1000000-0000-4000-8000-000000000005' $$,
  $$ values (80, 200, 40, 60) $$,
  'CA-37: the longest texts are stored whole'
);
select throws_ok(
  $$ select public.save_pet_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000005', p_name => 'Biscotto', p_color => 'pomodoro'
     ) $$,
  '23505', null,
  'CA-40: the colour of another member (Marco) is refused'
);
select throws_ok(
  $$ select public.save_pet_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000005', p_name => null, p_color => 'zafferano'
     ) $$,
  '22004', null,
  'the name is required'
);
select throws_ok(
  $$ select public.save_pet_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000005', p_name => 'Biscotto', p_color => 'zafferano',
       p_remove_photo => null
     ) $$,
  '22004', null,
  '«Togli la foto» cannot be null'
);

-- ---------------------------------------------------------------------------
-- The photo
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ select public.save_pet_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000005', p_name => 'Biscotto', p_color => 'zafferano',
       p_photo_base64 => encode('\xffd8ffe1001045786966000049492a0008000000ffda0008010100003f00a1b2c3ffd9'::bytea, 'base64'),
       p_photo_content_type => 'image/jpeg'
     ) $$,
  '23514', null,
  'CA-41: a JPEG with an Exif block (APP1) is refused'
);
select throws_ok(
  $$ select public.save_pet_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000005', p_name => 'Biscotto', p_color => 'zafferano',
       p_photo_base64 => encode(
         '\xffd8ffe000104a46494600010100000100010000ffe1001f687474703a2f2f6e732e61646f62652e636f6d2f7861702f312e302f00ffda0008010100003f00a1b2c3ffd9'::bytea,
         'base64'),
       p_photo_content_type => 'image/jpeg'
     ) $$,
  '23514', null,
  'a JPEG with an XMP block (APP1, after the JFIF block) is refused'
);
select throws_ok(
  $$ select public.save_pet_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000005', p_name => 'Biscotto', p_color => 'zafferano',
       p_photo_base64 => encode('\xffd8ffe000104a46494600010100000100010000ffd9'::bytea, 'base64'),
       p_photo_content_type => 'image/jpeg'
     ) $$,
  '23514', null,
  'a JPEG without image data is refused'
);
select throws_ok(
  $$ select public.save_pet_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000005', p_name => 'Biscotto', p_color => 'zafferano',
       p_photo_base64 => encode('\x52494646220000005745425056503858' || '\x0a0000000800000000000000000045584946040000004d4d002a'::bytea, 'base64'),
       p_photo_content_type => 'image/webp'
     ) $$,
  '23514', null,
  'a WebP with an EXIF chunk is refused'
);
select throws_ok(
  $$ select public.save_pet_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000005', p_name => 'Biscotto', p_color => 'zafferano',
       p_photo_base64 => encode('\x52494646220000005745425056503858' || '\x0a00000008000000000000000000584d5020040000003c783a78'::bytea, 'base64'),
       p_photo_content_type => 'image/webp'
     ) $$,
  '23514', null,
  'a WebP with an XMP chunk is refused'
);
select throws_ok(
  $$ select public.save_pet_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000005', p_name => 'Biscotto', p_color => 'zafferano',
       p_photo_base64 => encode('\x524946461200000057454250' || '\x5650384c050000002f000000000000000000'::bytea, 'base64'),
       p_photo_content_type => 'image/webp'
     ) $$,
  '23514', null,
  'a WebP with bytes after its declared size is refused'
);
select throws_ok(
  $$ select public.save_pet_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000005', p_name => 'Biscotto', p_color => 'zafferano',
       p_photo_base64 => encode('\x89504e470d0a1a0a0000000d49484452'::bytea, 'base64'),
       p_photo_content_type => 'image/png'
     ) $$,
  '23514', null,
  'a PNG is never stored (only WebP or JPEG)'
);
select throws_ok(
  $$ select public.save_pet_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000005', p_name => 'Biscotto', p_color => 'zafferano',
       p_photo_base64 => encode('\x255044462d312e340a25e2e3cfd30a0a'::bytea, 'base64'),
       p_photo_content_type => 'image/jpeg'
     ) $$,
  '23514', null,
  'CA-42: a PDF declared as JPEG is refused (first bytes)'
);
select throws_ok(
  $$ select public.save_pet_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000005', p_name => 'Biscotto', p_color => 'zafferano',
       p_photo_base64 => encode('\xffd8ffe000104a46494600010100000100010000ffda0008010100003f00'::bytea || decode(repeat('00', 102380), 'hex'), 'base64'),
       p_photo_content_type => 'image/jpeg'
     ) $$,
  '23514', null,
  'a photo larger than 102400 bytes is refused'
);
select throws_ok(
  $$ select public.save_pet_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000005', p_name => 'Biscotto', p_color => 'zafferano',
       p_photo_base64 => '***', p_photo_content_type => 'image/jpeg'
     ) $$,
  '22023', null,
  'a photo that is not base64 is refused'
);
select throws_ok(
  $$ select public.save_pet_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000005', p_name => 'Biscotto', p_color => 'zafferano',
       p_photo_base64 => encode('\xffd8ffe000104a46494600010100000100010000ffda0008010100003f00a1b2c3ffd9'::bytea, 'base64')
     ) $$,
  '22023', null,
  'a photo without content type is refused'
);
select throws_ok(
  $$ select public.save_pet_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000005', p_name => 'Biscotto', p_color => 'zafferano',
       p_photo_base64 => encode('\xffd8ffe000104a46494600010100000100010000ffda0008010100003f00a1b2c3ffd9'::bytea, 'base64'),
       p_photo_content_type => 'image/jpeg', p_remove_photo => true
     ) $$,
  '22023', null,
  'a new photo and «Togli la foto» together are refused'
);
select results_eq(
  $$ select content_type, data from public.pet_photos where member_id = 'a1000000-0000-4000-8000-000000000005' $$,
  $$ values ('image/jpeg', '\xffd8ffe000104a46494600010100000100010000ffdb00040000ffda0008010100003f00a1b2c3ffd9'::bytea) $$,
  'after the refused photos (and the saves without photo) the first photo is still there'
);
select lives_ok(
  $$ select public.save_pet_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000005', p_name => 'Biscotto', p_color => 'zafferano',
       p_species => 'dog', p_food => 'Crocchette Monge 12 kg',
       p_photo_base64 => encode('\x524946461200000057454250' || '\x5650384c050000002f0000000000'::bytea, 'base64'),
       p_photo_content_type => 'image/webp'
     ) $$,
  'a WebP without metadata replaces the photo'
);
select results_eq(
  $$ select content_type, octet_length(data) from public.pet_photos where member_id = 'a1000000-0000-4000-8000-000000000005' $$,
  $$ values ('image/webp', 26) $$,
  'the photo of Biscotto is the WebP, one row only'
);
select lives_ok(
  $$ select public.save_pet_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000005', p_name => 'Biscotto', p_color => 'zafferano',
       p_species => 'dog', p_food => 'Crocchette Monge 12 kg', p_remove_photo => true
     ) $$,
  'CA-42: «Togli la foto» and save'
);
select is_empty(
  $$ select 1 from public.pet_photos where member_id = 'a1000000-0000-4000-8000-000000000005' $$,
  'CA-42 / CA-L5: the photo is no longer in the database'
);

-- CA-L7 and CA-34: emptying every field deletes the row of the profile.
select lives_ok(
  $$ select public.save_pet_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000005', p_name => 'Biscotto', p_color => 'zafferano',
       p_food => '  ', p_vet_name => '', p_vet_clinic => ' ', p_vet_phone => '', p_note => ''
     ) $$,
  'Marco empties the profile of Biscotto'
);
select ok(
  not exists (select 1 from public.pet_profiles where member_id = 'a1000000-0000-4000-8000-000000000005')
  and (select birth_date is null from public.household_members where id = 'a1000000-0000-4000-8000-000000000005'),
  'CA-L7: no row of the profile is left (vet included), and no date'
);

-- ---------------------------------------------------------------------------
-- Only pets of the caller's household, the same answer in every case
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ select public.save_pet_profile(p_member_id => 'a1000000-0000-4000-8000-000000000003', p_name => 'Sofia', p_color => 'salvia') $$,
  '42501', 'permission denied for function save_pet_profile',
  'CA-49: the id of Sofia (a child) is refused'
);
select throws_ok(
  $$ select public.save_pet_profile(p_member_id => 'a1000000-0000-4000-8000-000000000001', p_name => 'Marco', p_color => 'pomodoro') $$,
  '42501', 'permission denied for function save_pet_profile',
  'the id of Marco (an adult) is refused'
);
select throws_ok(
  $$ select public.save_pet_profile(p_member_id => 'a1000000-0000-4000-8000-000000000099', p_name => 'Nessuno', p_color => 'cannella') $$,
  '42501', 'permission denied for function save_pet_profile',
  'a member that does not exist is refused'
);
select throws_ok(
  $$ select public.save_pet_profile(p_member_id => 'b1000000-0000-4000-8000-000000000009', p_name => 'Pallina', p_color => 'glicine') $$,
  '42501', 'permission denied for function save_pet_profile',
  'A (administrator) cannot save Pallina of Casa Bianchi: same answer as a member that does not exist'
);
select ok(
  (select name = 'Sofia' and kind = 'child' from public.household_members where id = 'a1000000-0000-4000-8000-000000000003'),
  'Sofia is unchanged'
);

-- Only POST (lesson of #112): every other method is refused before anything is read.
set local request.method to 'GET';
select throws_ok(
  $$ select public.save_pet_profile(p_member_id => 'a1000000-0000-4000-8000-000000000005', p_name => 'Biscotto', p_color => 'zafferano') $$,
  'P0001', 'use POST', 'save_pet_profile refuses GET'
);
set local request.method to 'HEAD';
select throws_ok(
  $$ select public.save_pet_profile(p_member_id => 'a1000000-0000-4000-8000-000000000005', p_name => 'Biscotto', p_color => 'zafferano') $$,
  'P0001', 'use POST', 'save_pet_profile refuses HEAD'
);
set local request.method to 'PUT';
select throws_ok(
  $$ select public.save_pet_profile(p_member_id => 'a1000000-0000-4000-8000-000000000005', p_name => 'Biscotto', p_color => 'zafferano') $$,
  'P0001', 'use POST', 'save_pet_profile refuses PUT'
);
set local request.method to 'PATCH';
select throws_ok(
  $$ select public.save_pet_profile(p_member_id => 'a1000000-0000-4000-8000-000000000005', p_name => 'Biscotto', p_color => 'zafferano') $$,
  'P0001', 'use POST', 'save_pet_profile refuses PATCH'
);
set local request.method to 'DELETE';
select throws_ok(
  $$ select public.save_pet_profile(p_member_id => 'a1000000-0000-4000-8000-000000000005', p_name => 'Biscotto', p_color => 'zafferano') $$,
  'P0001', 'use POST', 'save_pet_profile refuses DELETE'
);
set local request.method to 'POST';

-- The data of Biscotto for the isolation tests below.
select lives_ok(
  $$ select public.save_pet_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000005', p_name => 'Biscotto', p_color => 'zafferano',
       p_species => 'dog', p_food => 'Crocchette Monge 12 kg', p_vet_name => 'Dott.ssa Elena Ferri',
       p_vet_clinic => 'Clinica Veterinaria San Rocco', p_vet_phone => '+39 02 1234-5678', p_note => 'Ama la palla.',
       p_photo_base64 => encode('\xffd8ffe000104a46494600010100000100010000ffdb00040000ffda0008010100003f00a1b2c3ffd9'::bytea, 'base64'),
       p_photo_content_type => 'image/jpeg'
     ) $$,
  'Marco saves the whole profile of Biscotto with POST'
);

-- Direct writes: no privilege, also on the own household.
select throws_ok(
  $$ insert into public.pet_profiles (member_id, food) values ('a1000000-0000-4000-8000-000000000005', 'Pappa') $$,
  '42501', null,
  'Marco cannot insert a profile directly'
);
select throws_ok(
  $$ update public.pet_profiles set food = 'Pappa' where member_id = 'a1000000-0000-4000-8000-000000000005' $$,
  '42501', null,
  'Marco cannot update a profile directly'
);
select throws_ok(
  $$ delete from public.pet_profiles where member_id = 'a1000000-0000-4000-8000-000000000005' $$,
  '42501', null,
  'Marco cannot delete a profile directly'
);
select throws_ok(
  $$ insert into public.pet_photos (member_id, household_id, content_type, data)
     values ('a1000000-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111', 'image/jpeg',
             '\xffd8ffe000104a46494600010100000100010000ffda0008010100003f00a1b2c3ffd9') $$,
  '42501', null,
  'Marco cannot insert a photo directly (only save_pet_profile writes it)'
);
select throws_ok(
  $$ update public.pet_photos set content_type = 'image/webp' where member_id = 'a1000000-0000-4000-8000-000000000005' $$,
  '42501', null,
  'Marco cannot update a photo directly'
);
select throws_ok(
  $$ delete from public.pet_photos where member_id = 'a1000000-0000-4000-8000-000000000005' $$,
  '42501', null,
  'Marco cannot delete a photo directly'
);

-- The kind of a member never changes through the API.
select throws_ok(
  $$ update public.household_members set kind = 'child' where id = 'a1000000-0000-4000-8000-000000000005' $$,
  '42501', null,
  'Marco cannot turn Biscotto into a child'
);

-- ---------------------------------------------------------------------------
-- Giulia (B, administrator of Casa Bianchi): her own pet, nothing of Biscotto
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';

select lives_ok(
  $$ select public.save_pet_profile(
       p_member_id => 'b1000000-0000-4000-8000-000000000009', p_name => 'Pallina', p_color => 'glicine',
       p_species => 'cat', p_food => 'Scatolette al tonno', p_vet_name => 'Dott. Luca Neri', p_vet_phone => '011 765 4321',
       p_photo_base64 => encode('\x524946461200000057454250' || '\x5650384c050000002f0000000000'::bytea, 'base64'),
       p_photo_content_type => 'image/webp'
     ) $$,
  'Giulia saves the profile and the photo of Pallina'
);
select results_eq(
  $$ select member_id from public.pet_profiles
     union all
     select member_id from public.pet_photos $$,
  $$ values ('b1000000-0000-4000-8000-000000000009'::uuid), ('b1000000-0000-4000-8000-000000000009'::uuid) $$,
  'Giulia reads only the profile and the photo of Pallina'
);
select is_empty(
  $$ select 1 from public.pet_profiles where member_id = 'a1000000-0000-4000-8000-000000000005' $$,
  'CA-49: B reads no profile of Biscotto (food, vet, note)'
);
select is_empty(
  $$ select 1 from public.pet_photos where member_id = 'a1000000-0000-4000-8000-000000000005' $$,
  'CA-49 / CA-L4: B reads no byte of the photo of Biscotto'
);
select throws_ok(
  $$ select public.save_pet_profile(p_member_id => 'a1000000-0000-4000-8000-000000000005', p_name => 'Rubato', p_color => 'cannella') $$,
  '42501', 'permission denied for function save_pet_profile',
  'B (administrator) cannot save Biscotto: same answer as a member that does not exist'
);
select throws_ok(
  $$ select public.save_pet_profile(
       p_member_id => 'a1000000-0000-4000-8000-000000000005', p_name => 'Biscotto', p_color => 'zafferano',
       p_remove_photo => true
     ) $$,
  '42501', 'permission denied for function save_pet_profile',
  'B cannot remove the photo of Biscotto'
);

-- Paolo (B2, not administrator): the same.
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';

select results_eq(
  $$ select member_id from public.pet_profiles
     union all
     select member_id from public.pet_photos $$,
  $$ values ('b1000000-0000-4000-8000-000000000009'::uuid), ('b1000000-0000-4000-8000-000000000009'::uuid) $$,
  'Paolo (not administrator) reads the data of Pallina and nothing of Biscotto'
);
-- Same food and vet as Giulia's save, a new note: the checks of the database owner below
-- still find the data of Pallina as Casa Bianchi saved them.
select lives_ok(
  $$ select public.save_pet_profile(
       p_member_id => 'b1000000-0000-4000-8000-000000000009', p_name => 'Pallina', p_color => 'glicine',
       p_species => 'cat', p_food => 'Scatolette al tonno', p_vet_name => 'Dott. Luca Neri', p_vet_phone => '011 765 4321',
       p_note => 'Dorme sul divano.'
     ) $$,
  'Paolo (not administrator) saves the profile of Pallina, a pet of his household'
);
select results_eq(
  $$ select p.note, p.food, ph.content_type
     from public.pet_profiles p
     join public.pet_photos ph on ph.member_id = p.member_id
     where p.member_id = 'b1000000-0000-4000-8000-000000000009' $$,
  $$ values ('Dorme sul divano.', 'Scatolette al tonno', 'image/webp') $$,
  'the save of Paolo is stored, and the photo is kept'
);
select throws_ok(
  $$ select public.save_pet_profile(p_member_id => 'a1000000-0000-4000-8000-000000000005', p_name => 'Rubato', p_color => 'cannella') $$,
  '42501', 'permission denied for function save_pet_profile',
  'Paolo cannot save Biscotto'
);

-- Marco (A, administrator) towards Pallina.
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';

select is_empty(
  $$ select 1 from public.pet_profiles where member_id = 'b1000000-0000-4000-8000-000000000009'
     union all
     select 1 from public.pet_photos where member_id = 'b1000000-0000-4000-8000-000000000009' $$,
  'A (administrator) reads no profile and no photo of Pallina'
);

-- ---------------------------------------------------------------------------
-- The policies alone: with write privileges granted for this test only, the other household
-- still changes and deletes 0 rows and cannot insert.
-- ---------------------------------------------------------------------------
reset role;
grant insert (member_id, household_id, food), update (food), delete on table public.pet_profiles to authenticated;
grant insert (member_id, household_id, content_type, data), update (content_type), delete on table public.pet_photos to authenticated;
grant execute on function private.pet_photo_without_metadata(text, bytea) to authenticated;
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';

select results_eq(
  $$ with u as (
       update public.pet_profiles set food = 'Rubato' where member_id = 'a1000000-0000-4000-8000-000000000005' returning 1
     ) select count(*)::integer from u $$,
  $$ values (0) $$,
  'policy: B (administrator) updates 0 profiles of Biscotto'
);
select results_eq(
  $$ with d as (
       delete from public.pet_profiles where member_id = 'a1000000-0000-4000-8000-000000000005' returning 1
     ) select count(*)::integer from d $$,
  $$ values (0) $$,
  'policy: B deletes 0 profiles of Biscotto'
);
select results_eq(
  $$ with u as (
       update public.pet_photos set content_type = 'image/webp' where member_id = 'a1000000-0000-4000-8000-000000000005' returning 1
     ) select count(*)::integer from u $$,
  $$ values (0) $$,
  'policy: B updates 0 photos of Biscotto'
);
select results_eq(
  $$ with d as (
       delete from public.pet_photos where member_id = 'a1000000-0000-4000-8000-000000000005' returning 1
     ) select count(*)::integer from d $$,
  $$ values (0) $$,
  'policy: B deletes 0 photos of Biscotto'
);
select throws_ok(
  $$ insert into public.pet_profiles (member_id, household_id, food)
     values ('a1000000-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111', 'Rubato') $$,
  '42501', 'new row violates row-level security policy for table "pet_profiles"',
  'policy: B cannot insert a profile in Casa D''Angelo'
);
select throws_ok(
  $$ insert into public.pet_photos (member_id, household_id, content_type, data)
     values ('a1000000-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111', 'image/jpeg',
             '\xffd8ffe000104a46494600010100000100010000ffda0008010100003f00a1b2c3ffd9') $$,
  '42501', 'new row violates row-level security policy for table "pet_photos"',
  'policy: B cannot insert a photo in Casa D''Angelo'
);
select throws_ok(
  $$ insert into public.pet_profiles (member_id, household_id, food)
     values ('a1000000-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222222', 'Rubato') $$,
  '23503', null,
  'composite key: a profile in Casa Bianchi cannot point to a member of Casa D''Angelo'
);

set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';

select results_eq(
  $$ with u as (
       update public.pet_profiles set food = 'Rubato' where member_id = 'b1000000-0000-4000-8000-000000000009' returning 1
     ) select count(*)::integer from u $$,
  $$ values (0) $$,
  'policy: A (administrator) updates 0 profiles of Pallina'
);
select results_eq(
  $$ with d as (
       delete from public.pet_profiles where member_id = 'b1000000-0000-4000-8000-000000000009' returning 1
     ) select count(*)::integer from d $$,
  $$ values (0) $$,
  'policy: A deletes 0 profiles of Pallina'
);
select results_eq(
  $$ with d as (
       delete from public.pet_photos where member_id = 'b1000000-0000-4000-8000-000000000009' returning 1
     ) select count(*)::integer from d $$,
  $$ values (0) $$,
  'policy: A deletes 0 photos of Pallina'
);
select throws_ok(
  $$ insert into public.pet_photos (member_id, household_id, content_type, data)
     values ('b1000000-0000-4000-8000-000000000009', '22222222-2222-4222-8222-222222222222', 'image/jpeg',
             '\xffd8ffe000104a46494600010100000100010000ffda0008010100003f00a1b2c3ffd9') $$,
  '42501', 'new row violates row-level security policy for table "pet_photos"',
  'policy: A cannot insert a photo in Casa Bianchi'
);

reset role;
revoke insert, update, delete on table public.pet_profiles from authenticated;
revoke insert, update, delete on table public.pet_photos from authenticated;
revoke execute on function private.pet_photo_without_metadata(text, bytea) from authenticated;

-- Database owner: the data of both pets are as their household saved them.
select results_eq(
  $$ select member_id, food, vet_name, household_id from public.pet_profiles order by member_id $$,
  $$ values ('a1000000-0000-4000-8000-000000000005'::uuid, 'Crocchette Monge 12 kg', 'Dott.ssa Elena Ferri',
             '11111111-1111-4111-8111-111111111111'::uuid),
            ('b1000000-0000-4000-8000-000000000009'::uuid, 'Scatolette al tonno', 'Dott. Luca Neri',
             '22222222-2222-4222-8222-222222222222'::uuid) $$,
  'after every attempt the profiles of Biscotto and Pallina are unchanged'
);
select results_eq(
  $$ select member_id, content_type, household_id from public.pet_photos order by member_id $$,
  $$ values ('a1000000-0000-4000-8000-000000000005'::uuid, 'image/jpeg', '11111111-1111-4111-8111-111111111111'::uuid),
            ('b1000000-0000-4000-8000-000000000009'::uuid, 'image/webp', '22222222-2222-4222-8222-222222222222'::uuid) $$,
  'after every attempt the photos of Biscotto and Pallina are unchanged'
);

-- ---------------------------------------------------------------------------
-- Chiara (C, signed in, no household) and anon
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}';

select is_empty(
  $$ select 1 from public.pet_profiles union all select 1 from public.pet_photos $$,
  'a user without household reads no profile and no photo'
);
select throws_ok(
  $$ select public.save_pet_profile(p_member_id => 'a1000000-0000-4000-8000-000000000005', p_name => 'Biscotto', p_color => 'zafferano') $$,
  '42501', 'permission denied for function save_pet_profile',
  'a user without household cannot save a pet'
);

reset role;
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';

select throws_ok(
  $$ select 1 from public.pet_profiles $$,
  '42501', null,
  'anon cannot read the profiles of pets'
);
select throws_ok(
  $$ select 1 from public.pet_photos $$,
  '42501', null,
  'CA-L4: anon cannot read the photos of pets'
);
select throws_ok(
  $$ select public.save_pet_profile(p_member_id => 'a1000000-0000-4000-8000-000000000005', p_name => 'Biscotto', p_color => 'zafferano') $$,
  '42501', null,
  'anon cannot call save_pet_profile'
);

-- ---------------------------------------------------------------------------
-- Administrative key (service_role): the same rules on the data
-- ---------------------------------------------------------------------------
reset role;
set local role service_role;

select throws_ok(
  $$ insert into public.pet_photos (member_id, household_id, content_type, data)
     values ('b1000000-0000-4000-8000-000000000009', '22222222-2222-4222-8222-222222222222', 'image/jpeg',
             '\xffd8ffe1001045786966000049492a0008000000ffda0008010100003f00a1b2c3ffd9') $$,
  '23514', null,
  'the administrative key cannot store a JPEG with Exif either'
);
select lives_ok(
  $$ update public.pet_photos
     set content_type = 'image/jpeg', data = '\xffd8ffe000104a46494600010100000100010000ffda0008010100003f00a1b2c3ffd9'
     where member_id = 'b1000000-0000-4000-8000-000000000009' $$,
  'the administrative key may store a JPEG without metadata (page tests)'
);
select throws_ok(
  $$ update public.pet_profiles set vet_phone = '12345' where member_id = 'b1000000-0000-4000-8000-000000000009' $$,
  '23514', null,
  'the administrative key cannot store a phone not valid'
);
select throws_ok(
  $$ update public.pet_profiles set date_kind = 'adoption', date_precision = 'year', date_year = 1900
     where member_id = 'b1000000-0000-4000-8000-000000000009' $$,
  '23514', null,
  'the administrative key cannot store a year before 40 years ago'
);
select throws_ok(
  $$ update public.household_members
     set birth_date = ((now() at time zone 'Europe/Rome')::date - interval '41 years')::date
     where id = 'b1000000-0000-4000-8000-000000000009' $$,
  '23514', null,
  'the administrative key cannot give a pet a birth date before 40 years ago'
);
select lives_ok(
  $$ update public.household_members
     set birth_date = '1980-01-01'
     where id = 'a1000000-0000-4000-8000-000000000003' $$,
  'the limit of 40 years is only for pets (Sofia, a child, is not concerned)'
);

-- ---------------------------------------------------------------------------
-- The kind and the household of a pet with a profile or a photo never change, for any role
-- ---------------------------------------------------------------------------
reset role;

select throws_ok(
  $$ update public.household_members set kind = 'child' where id = 'a1000000-0000-4000-8000-000000000005' $$,
  '23503', null,
  'the database owner cannot turn Biscotto (with profile and photo) into a child'
);
select throws_ok(
  $$ update public.household_members set household_id = '22222222-2222-4222-8222-222222222222', color = 'peonia'
     where id = 'a1000000-0000-4000-8000-000000000005' $$,
  '23503', null,
  'the database owner cannot move Biscotto (with profile and photo) to another household'
);

-- ---------------------------------------------------------------------------
-- Cascades
-- ---------------------------------------------------------------------------

-- CA-48: Marco (administrator) removes Biscotto from the household.
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok(
  $$ delete from public.household_members where id = 'a1000000-0000-4000-8000-000000000005' $$,
  'CA-48: Marco removes Biscotto from the household'
);
reset role;
select is_empty(
  $$ select 1 from public.pet_profiles where member_id = 'a1000000-0000-4000-8000-000000000005'
     union all
     select 1 from public.pet_photos where member_id = 'a1000000-0000-4000-8000-000000000005' $$,
  'CA-48 / CA-L5: profile, vet and photo of Biscotto are deleted with him'
);

-- CA-L10: deleting the household deletes profile and photo of its pets.
delete from public.households where id = '22222222-2222-4222-8222-222222222222';
select is_empty(
  $$ select 1 from public.pet_profiles union all select 1 from public.pet_photos $$,
  'CA-L10 / CA-L5: deleting Casa Bianchi deletes profile, vet and photo of Pallina'
);

select * from finish();
rollback;
