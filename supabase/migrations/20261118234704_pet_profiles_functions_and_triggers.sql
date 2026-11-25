-- Issue #488 (part C of #460): triggers of the profile of a pet and the function that saves
-- it (edit sheet of the page «Profilo dell'animale»).
--
-- Conventions (same as child_profiles and the wish list):
-- - every function has `set search_path = ''` and fully qualified names;
-- - trigger functions live in the "private" schema (not exposed by the Data API, not in the
--   generated types); their bodies call no other private function, so that the
--   administrative key (service_role, no usage on the schema private) writes through the
--   same triggers;
-- - the app has no write privilege on pet_profiles and pet_photos (grants migration): the
--   page writes only through save_pet_profile(). It is `security definer`, because the photo
--   is written only by it, and applies explicitly the rules of the page: the household is
--   always the caller's (session), the member must be a pet of that household, ids of
--   households, profiles or photos are never received (LEZIONI: the client sends ids and
--   values, the database decides). No jsonb: every value is a typed argument;
-- - it refuses every Data API method other than POST before reading anything (lesson of
--   #112);
-- - the triggers (normalisation, range of the dates) apply to every role.
-- Execute grants are in the pet_profiles_policies_and_grants migration.
--
-- Errors (the page recognises them by code; messages never contain names, texts or dates):
-- - P0001 'use POST': called through the Data API with a method other than POST;
-- - 22004: a required argument is null;
-- - 22023: the photo is not valid base64, only one of photo and content type is given, or a
--   new photo and «Togli la foto» together;
-- - 23505: the colour is already taken by another member of the household;
-- - 23514: a value not allowed: name empty or longer than 40, food longer than 80, vet name
--   longer than 40, practice longer than 60, phone not valid, note longer than 200, a date
--   in the future or before 40 years ago, a date incomplete (kind without precision, day
--   without date…), a photo larger than 100 KB, not WebP or JPEG, not of the declared format
--   or with a metadata block;
-- - 42501: no signed-in user, no household, or a member that is not a pet of the caller's
--   household (the same answer whether it does not exist, is of another household, or is an
--   adult or a child: nothing about other households leaks).

-- ---------------------------------------------------------------------------
-- Before insert or update of household_members, for pets: a birth date not before 40 years
-- ago (day of Rome), checked when the date is written or changed (a date saved earlier never
-- blocks the other changes of the member). The future is already refused for every member by
-- household_members_normalize. Every role.
-- ---------------------------------------------------------------------------
create or replace function private.household_members_pet_birth_date_range()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.birth_date is not distinct from old.birth_date then
    return new;
  end if;

  if new.birth_date < ((now() at time zone 'Europe/Rome')::date - interval '40 years')::date then
    raise exception 'the date of a pet cannot be before 40 years ago' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger household_members_pet_birth_date_range
  before insert or update of birth_date on public.household_members
  for each row
  when (new.kind = 'pet' and new.birth_date is not null)
  execute function private.household_members_pet_birth_date_range();

-- ---------------------------------------------------------------------------
-- Before insert or update of pet_profiles, every role:
-- - texts normalised (an empty text becomes null);
-- - the year and the day of adoption never in the future and not before 40 years ago (year
--   or day of Rome), checked when the value is written or changed.
-- ---------------------------------------------------------------------------
create or replace function private.pet_profiles_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Europe/Rome')::date;
begin
  new.food := nullif(btrim(regexp_replace(new.food, '\s+', ' ', 'g')), '');
  new.vet_name := nullif(btrim(regexp_replace(new.vet_name, '\s+', ' ', 'g')), '');
  new.vet_clinic := nullif(btrim(regexp_replace(new.vet_clinic, '\s+', ' ', 'g')), '');
  new.vet_phone := nullif(btrim(regexp_replace(new.vet_phone, '\s+', ' ', 'g')), '');
  new.note := nullif(btrim(regexp_replace(new.note, '\s+', ' ', 'g')), '');

  if new.adoption_date is not null
     and (tg_op = 'INSERT' or new.adoption_date is distinct from old.adoption_date)
     and (
       new.adoption_date > v_today
       or new.adoption_date < (v_today - interval '40 years')::date
     ) then
    raise exception 'the date of a pet must be in the last 40 years' using errcode = '23514';
  end if;

  if new.date_year is not null
     and (tg_op = 'INSERT' or new.date_year is distinct from old.date_year)
     and (
       new.date_year > extract(year from v_today)
       or new.date_year < extract(year from v_today) - 40
     ) then
    raise exception 'the date of a pet must be in the last 40 years' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger pet_profiles_before_write
  before insert or update on public.pet_profiles
  for each row execute function private.pet_profiles_before_write();

create trigger pet_profiles_set_updated_at
  before update on public.pet_profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RPC (write): saves the whole profile of a pet in one transaction (the «Salva» of the edit
-- sheet): name, colour and date of the member, species, date, food, vet, note and photo.
-- Everything is saved or nothing is: any error, also half way (for example a phone not
-- valid after the name is written), leaves every row as it was.
--
-- Arguments: only the id of the pet and the values. The household is the caller's
-- (session); ids of households, profiles or photos are never received.
-- - p_member_id, p_name, p_color are required (22004 when null), and so is
--   p_remove_photo when given;
-- - every other value is the full new state: null (or omitted) means «empty», and what was
--   saved before is cleared. Texts are normalised by the triggers (an empty text is
--   «empty»);
-- - the date: p_date_kind and p_date_precision both or neither; with 'day' the day in
--   p_date (and no year), with 'year' the year in p_date_year (and no day), without a date
--   none of the four. A day of birth goes to household_members.birth_date; every other date
--   to the profile, and the birth date of the member becomes null;
-- - the photo, unlike the other values, is kept when nothing is said about it:
--   p_photo_base64 + p_photo_content_type (both or neither) replace it with the reduced
--   copy made by the server of the app; p_remove_photo = true («Togli la foto») deletes it.
-- When species, date of the profile, food, vet and note are all empty the row of
-- pet_profiles is deleted.
--
-- Checks, in this order, before anything is written: the method (POST), the required
-- arguments, a signed-in user with a household, a pet of that household (42501 otherwise,
-- always the same), the shape of the date (23514) and of the photo (22023). Every adult with
-- an account of the household may save, administrator or not (same rule as the update
-- policy of household_members for children and pets). Concurrency: the row of the pet is
-- locked first, so two saves of the same pet are serialised; the last one wins.
-- ---------------------------------------------------------------------------
create or replace function public.save_pet_profile(
  p_member_id uuid,
  p_name text,
  p_color public.member_color,
  p_species public.pet_species default null,
  p_date_kind public.pet_date_kind default null,
  p_date_precision public.pet_date_precision default null,
  p_date date default null,
  p_date_year integer default null,
  p_food text default null,
  p_vet_name text default null,
  p_vet_clinic text default null,
  p_vet_phone text default null,
  p_note text default null,
  p_photo_base64 text default null,
  p_photo_content_type text default null,
  p_remove_photo boolean default false
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  -- 102400 bytes in base64 are 136534 characters; a little more for line breaks.
  c_max_photo_base64 constant integer := 140000;
  v_household_id uuid;
  v_member_id uuid;
  v_photo bytea;
  v_has_profile_date boolean;
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  if p_member_id is null or p_name is null or p_color is null or p_remove_photo is null then
    raise exception 'member, name and colour are required' using errcode = '22004';
  end if;

  v_household_id := (select public.current_household_id());
  if (select auth.uid()) is null or v_household_id is null then
    raise exception 'permission denied for function save_pet_profile' using errcode = '42501';
  end if;

  select m.id into v_member_id
  from public.household_members m
  where m.id = p_member_id
    and m.household_id = v_household_id
    and m.kind = 'pet'
  for update;

  if not found then
    raise exception 'permission denied for function save_pet_profile' using errcode = '42501';
  end if;

  -- The date: one shape per choice.
  if (p_date_kind is null) <> (p_date_precision is null)
     or (p_date_precision is not distinct from 'day') <> (p_date is not null)
     or (p_date_precision is not distinct from 'year') <> (p_date_year is not null) then
    raise exception 'the date is not complete' using errcode = '23514';
  end if;
  -- Any year outside the column type is refused like a year too far back (the trigger of
  -- pet_profiles checks the 40 years).
  if p_date_year not between 1 and 9999 then
    raise exception 'the date of a pet must be in the last 40 years' using errcode = '23514';
  end if;
  v_has_profile_date := p_date_kind is not null
    and not (p_date_kind = 'birth' and p_date_precision = 'day');

  -- The photo.
  if (p_photo_base64 is null) <> (p_photo_content_type is null) then
    raise exception 'photo and content type go together' using errcode = '22023';
  end if;
  if p_photo_base64 is not null and p_remove_photo then
    raise exception 'a new photo or no photo, not both' using errcode = '22023';
  end if;
  if p_photo_base64 is not null then
    if char_length(p_photo_base64) > c_max_photo_base64 then
      raise exception 'the photo is too large' using errcode = '23514';
    end if;
    begin
      v_photo := decode(p_photo_base64, 'base64');
    exception when others then
      raise exception 'the photo is not valid' using errcode = '22023';
    end;
  end if;

  -- 1. The member (colour already taken: 23505; name not valid, birth date in the future or
  --    before 40 years ago: 23514).
  update public.household_members m
  set name = p_name,
      color = p_color,
      birth_date = case when p_date_kind = 'birth' and p_date_precision = 'day' then p_date end
  where m.id = v_member_id
    and m.household_id = v_household_id;

  -- 2. The profile: written, then deleted when nothing is left in it.
  insert into public.pet_profiles as p (
    household_id, member_id, species, date_kind, date_precision, date_year, adoption_date,
    food, vet_name, vet_clinic, vet_phone, note
  )
  values (
    v_household_id, v_member_id, p_species,
    case when v_has_profile_date then p_date_kind end,
    case when v_has_profile_date then p_date_precision end,
    case when v_has_profile_date then p_date_year end,
    case when v_has_profile_date and p_date_kind = 'adoption' then p_date end,
    p_food, p_vet_name, p_vet_clinic, p_vet_phone, p_note
  )
  on conflict (member_id) do update
  set species = excluded.species,
      date_kind = excluded.date_kind,
      date_precision = excluded.date_precision,
      date_year = excluded.date_year,
      adoption_date = excluded.adoption_date,
      food = excluded.food,
      vet_name = excluded.vet_name,
      vet_clinic = excluded.vet_clinic,
      vet_phone = excluded.vet_phone,
      note = excluded.note;

  delete from public.pet_profiles p
  where p.member_id = v_member_id
    and p.household_id = v_household_id
    and p.species is null
    and p.date_kind is null
    and p.food is null
    and p.vet_name is null
    and p.vet_clinic is null
    and p.vet_phone is null
    and p.note is null;

  -- 3. The photo: replaced, removed, or kept.
  if p_remove_photo or v_photo is not null then
    delete from public.pet_photos ph
    where ph.member_id = v_member_id
      and ph.household_id = v_household_id;
  end if;

  if v_photo is not null then
    insert into public.pet_photos (member_id, household_id, content_type, data)
    values (v_member_id, v_household_id, p_photo_content_type, v_photo);
  end if;
end;
$$;
