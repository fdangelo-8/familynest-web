-- Issue #488 (part C of #460, page «Profilo dell'animale» /animali/<id>): the profile and
-- the photo of each pet of the household.
-- - pet_profiles: at most one row per pet, with the species, the date when it is not a day
--   of birth, what it eats («Cosa mangia»), the vet (name, practice, phone) and a note;
-- - pet_photos:   at most one photo per pet, the reduced copy made by the server of the app
--                 (WebP or JPEG, at most 100 KB, without metadata blocks), stored in the
--                 database so that it goes with its pet and its household through the
--                 foreign keys (Storage files do not follow `on delete cascade`).
--
-- RLS is enabled here, in the same migration that creates each table. Policies and grants
-- are in the pet_profiles_policies_and_grants migration: until then RLS denies every row to
-- the API roles. The app never writes these tables directly: save_pet_profile()
-- (pet_profiles_functions_and_triggers migration) is the only writer.
--
-- Where the date of a pet is stored:
-- - birth, with the day: household_members.birth_date, like every other member (the list
--   «Il tuo Nest» shows the age from it); the profile keeps no date;
-- - birth with only the year, adoption with the day, adoption with only the year: the
--   columns date_kind, date_precision, date_year and adoption_date of pet_profiles, and
--   household_members.birth_date is null. save_pet_profile() never writes both.
-- Every date: never in the future and not before 40 years ago (day or year of Rome), checked
-- by the triggers when the value is written or changed.
--
-- Only pets: every row points to its pet through the composite foreign key
-- (member_id, household_id, member_kind) towards household_members (id, household_id, kind),
-- with member_kind always 'pet'. So a row can never point to a member of another household,
-- nor to an adult or a child, and the kind and the household of a member that has a profile
-- or a photo cannot change (the foreign key refuses it, for every role; the API roles cannot
-- change them anyway: no column privilege and the household_members_guard_update trigger).
-- `on delete cascade`: removing the pet («Togli dal Nest»), or deleting the household (for
-- example when its last adult with an account leaves or deletes the account), deletes the
-- profile, the vet and the photo.
--
-- Stored personal data (requirement of #460 and legal opinion CA-L1…CA-L12): species, date,
-- food, note and photo of the pet (data of the adults of the household); name, practice and
-- phone of the vet (a third person, only for «Chiama»). Never health data of a person, never
-- a microchip, an address, an email or a note about the vet. Free texts and photos are never
-- written to logs, errors, analytics, notifications or URLs, and no other function reads
-- these tables (the public wish list and the invitation preview included).

-- ---------------------------------------------------------------------------
-- Used by the pet_photos_without_metadata check constraint (so it must exist before the
-- table). True when the photo has none of the blocks where cameras and editors keep the
-- place, the time and the device of the shot:
-- - JPEG: the segments before the image data (start of scan) are read one by one; APP1
--   (Exif and XMP) and APP13 (IPTC) are refused. A file whose segments cannot be read up to
--   the start of scan is refused too;
-- - WebP: the chunks of the RIFF container are read one by one; EXIF and XMP are refused.
--   The first chunk must be an image (VP8, VP8L or VP8X), the declared size of the
--   container must be the size of the file and the chunks must fill it exactly, so that
--   nothing can be hidden after them.
-- Any other content type: false. Every loop moves forward by at least one byte, and the
-- size of a photo is at most 102400 bytes (check of the table).
-- ---------------------------------------------------------------------------
create or replace function private.pet_photo_without_metadata(p_content_type text, p_data bytea)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_len integer := octet_length(p_data);
  v_pos bigint;
  v_marker integer;
  v_size bigint;
  v_fourcc bytea;
begin
  if p_content_type is null or p_data is null then
    return false;
  end if;

  if p_content_type = 'image/jpeg' then
    if v_len < 4 or substring(p_data from 1 for 2) <> '\xffd8'::bytea then
      return false;
    end if;

    v_pos := 2;
    loop
      if v_pos >= v_len or get_byte(p_data, v_pos::integer) <> 255 then
        return false;
      end if;
      -- A marker may be preceded by fill bytes 0xFF.
      while v_pos < v_len and get_byte(p_data, v_pos::integer) = 255 loop
        v_pos := v_pos + 1;
      end loop;
      if v_pos >= v_len then
        return false;
      end if;

      v_marker := get_byte(p_data, v_pos::integer);
      v_pos := v_pos + 1;

      -- Start of scan: the image data follow, no more header segments to read.
      if v_marker = 218 then
        return true;
      end if;
      -- 0x00, a second start of image or an end of image before any scan: not a photo.
      if v_marker in (0, 216, 217) then
        return false;
      end if;
      -- Markers without a length (TEM, RST0…RST7).
      if v_marker = 1 or v_marker between 208 and 215 then
        continue;
      end if;
      -- APP1 (Exif, XMP) and APP13 (IPTC).
      if v_marker in (225, 237) then
        return false;
      end if;

      if v_pos + 2 > v_len then
        return false;
      end if;
      v_size := get_byte(p_data, v_pos::integer) * 256 + get_byte(p_data, v_pos::integer + 1);
      if v_size < 2 then
        return false;
      end if;
      v_pos := v_pos + v_size;
    end loop;
  end if;

  if p_content_type = 'image/webp' then
    if v_len < 20
       or substring(p_data from 1 for 4) <> '\x52494646'::bytea
       or substring(p_data from 9 for 4) <> '\x57454250'::bytea then
      return false;
    end if;

    -- Declared size of the container (little endian), without the first 8 bytes.
    v_size := get_byte(p_data, 4)::bigint
      + get_byte(p_data, 5)::bigint * 256
      + get_byte(p_data, 6)::bigint * 65536
      + get_byte(p_data, 7)::bigint * 16777216;
    if v_size + 8 <> v_len then
      return false;
    end if;

    -- The first chunk is the image: 'VP8 ', 'VP8L' or 'VP8X'.
    if substring(p_data from 13 for 4) not in ('\x56503820'::bytea, '\x5650384c'::bytea, '\x56503858'::bytea) then
      return false;
    end if;

    v_pos := 12;
    while v_pos < v_len loop
      if v_pos + 8 > v_len then
        return false;
      end if;
      v_fourcc := substring(p_data from (v_pos + 1)::integer for 4);
      -- 'EXIF' and 'XMP '.
      if v_fourcc in ('\x45584946'::bytea, '\x584d5020'::bytea) then
        return false;
      end if;
      v_size := get_byte(p_data, (v_pos + 4)::integer)::bigint
        + get_byte(p_data, (v_pos + 5)::integer)::bigint * 256
        + get_byte(p_data, (v_pos + 6)::integer)::bigint * 65536
        + get_byte(p_data, (v_pos + 7)::integer)::bigint * 16777216;
      -- Chunk header, data, and one padding byte when the size is odd.
      v_pos := v_pos + 8 + v_size + (v_size % 2);
    end loop;

    return v_pos = v_len;
  end if;

  return false;
end;
$$;

-- Evaluated as the writer by the check constraint: save_pet_profile() (its owner) and the
-- administrative key of the page tests. The app never writes the photos directly.
revoke execute on function private.pet_photo_without_metadata(text, bytea) from public, anon, authenticated;
grant execute on function private.pet_photo_without_metadata(text, bytea) to service_role;

-- ---------------------------------------------------------------------------
-- pet_profiles: species, date, food, vet and note of a pet, at most one row per pet. A pet
-- without any of these data has no row (save_pet_profile() deletes the row that becomes
-- empty).
-- ---------------------------------------------------------------------------
create table public.pet_profiles (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  member_id uuid not null,
  -- Always 'pet': part of the composite foreign key, never sent by the app.
  member_kind public.member_kind not null default 'pet',

  -- «Specie»: null = «Non indicata».
  species public.pet_species,

  -- «Data», when it is not a day of birth (that one is household_members.birth_date).
  date_kind public.pet_date_kind,
  date_precision public.pet_date_precision,
  -- The year, when only the year is known (birth or adoption).
  date_year smallint,
  -- The day of the adoption.
  adoption_date date,

  -- «Cosa mangia» (also the text of «Metti in spesa»).
  food text,
  -- «Veterinario»: only name, practice and phone (legal opinion of #460, section 4).
  vet_name text,
  vet_clinic text,
  -- As written by the user; the page builds the tel: link from it.
  vet_phone text,
  -- «Nota»: never health data of a person (fixed warning under the field).
  note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint pet_profiles_member_fkey foreign key (member_id, household_id, member_kind)
    references public.household_members (id, household_id, kind) on delete cascade,
  -- One row per pet (also the arbiter of save_pet_profile() and the index of the composite
  -- foreign key, leading column member_id).
  constraint pet_profiles_member_key unique (member_id),
  constraint pet_profiles_member_kind_pet check (member_kind = 'pet'),

  -- Kind and precision of the date go together.
  constraint pet_profiles_date_kind_precision_together check ((date_kind is null) = (date_precision is null)),
  -- The day of birth is household_members.birth_date, never here.
  constraint pet_profiles_no_birth_day check (not (date_kind = 'birth' and date_precision = 'day')),
  -- A year exactly when only the year is known.
  constraint pet_profiles_date_year_iff_year check ((date_year is not null) = (date_precision is not distinct from 'year')),
  -- A day of adoption exactly for an adoption with the day.
  constraint pet_profiles_adoption_date_iff_adoption_day check (
    (adoption_date is not null) = (date_kind is not distinct from 'adoption' and date_precision is not distinct from 'day')
  ),

  -- Stored normalised: no leading/trailing whitespace, inner whitespace runs become one space.
  constraint pet_profiles_food_normalized check (food = btrim(regexp_replace(food, '\s+', ' ', 'g'))),
  constraint pet_profiles_food_length check (char_length(food) between 1 and 80),
  constraint pet_profiles_vet_name_normalized check (vet_name = btrim(regexp_replace(vet_name, '\s+', ' ', 'g'))),
  constraint pet_profiles_vet_name_length check (char_length(vet_name) between 1 and 40),
  constraint pet_profiles_vet_clinic_normalized check (vet_clinic = btrim(regexp_replace(vet_clinic, '\s+', ' ', 'g'))),
  constraint pet_profiles_vet_clinic_length check (char_length(vet_clinic) between 1 and 60),
  -- Same rules as child_teachers.phone (rules of the teachers, requirement of #460).
  constraint pet_profiles_vet_phone_normalized check (vet_phone = btrim(regexp_replace(vet_phone, '\s+', ' ', 'g'))),
  constraint pet_profiles_vet_phone_length check (char_length(vet_phone) between 1 and 20),
  -- Only digits, spaces, «.», «-», «/», «(», «)» and a leading «+».
  constraint pet_profiles_vet_phone_characters check (vet_phone ~ '^\+?[0-9 ./()-]+$'),
  -- From 6 to 15 digits in all.
  constraint pet_profiles_vet_phone_digits check (
    char_length(regexp_replace(vet_phone, '[^0-9]', '', 'g')) between 6 and 15
  ),
  constraint pet_profiles_note_normalized check (note = btrim(regexp_replace(note, '\s+', ' ', 'g'))),
  constraint pet_profiles_note_length check (char_length(note) between 1 and 200)
);

-- Foreign key towards households (cascade when a household is deleted); also used by the
-- RLS policies.
create index pet_profiles_household_id_idx on public.pet_profiles (household_id);

alter table public.pet_profiles enable row level security;

-- ---------------------------------------------------------------------------
-- pet_photos: the photo of a pet («Foto», answer 5 of #460). One photo per pet (primary key
-- member_id). Only WebP and JPEG, at most 100 KB, the first bytes must be those of the
-- declared format and no metadata block (EXIF, XMP, IPTC). Never sent to other services,
-- never in notifications or public pages (CA-L3, CA-L6).
-- ---------------------------------------------------------------------------
create table public.pet_photos (
  member_id uuid primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  -- Always 'pet': part of the composite foreign key, never sent by the app.
  member_kind public.member_kind not null default 'pet',
  content_type text not null,
  data bytea not null,
  created_at timestamptz not null default now(),

  -- The primary key (leading column member_id) also indexes the composite foreign key.
  constraint pet_photos_member_fkey foreign key (member_id, household_id, member_kind)
    references public.household_members (id, household_id, kind) on delete cascade,
  constraint pet_photos_member_kind_pet check (member_kind = 'pet'),
  constraint pet_photos_content_type check (content_type in ('image/webp', 'image/jpeg')),
  constraint pet_photos_size check (octet_length(data) between 12 and 102400),
  constraint pet_photos_format check (
    case content_type
      when 'image/jpeg' then substring(data from 1 for 3) = '\xffd8ff'::bytea
      when 'image/webp' then substring(data from 1 for 4) = '\x52494646'::bytea
                         and substring(data from 9 for 4) = '\x57454250'::bytea
      else false
    end
  ),
  constraint pet_photos_without_metadata check (private.pet_photo_without_metadata(content_type, data))
);

-- Foreign key towards households; also used by the RLS policies.
create index pet_photos_household_id_idx on public.pet_photos (household_id);

alter table public.pet_photos enable row level security;
