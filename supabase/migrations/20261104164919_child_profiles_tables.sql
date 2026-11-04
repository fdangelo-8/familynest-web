-- Issue #219 (for page #31 «Profilo di un figlio»): the school, the sizes and the teachers
-- of each child of the household.
-- - child_profiles: at most one row per child, with the school (name, class, timetable,
--   days, note) and the sizes (shoes, clothes, pyjamas) with the time of their last change;
-- - child_teachers: up to five teachers per child (name, subject, phone), in the order given
--   by the page.
--
-- RLS is enabled here, in the same migration that creates each table. Policies and grants
-- are in the child_profiles_policies_and_grants migration: until then RLS denies every row
-- to the API roles.
-- Text normalisation, the household of the caller, the time of the last change of the sizes
-- and the limit of five teachers are enforced by the triggers of the
-- child_profiles_functions_and_triggers migration. The page saves everything with one call
-- of save_child_profile() (same migration).
--
-- Only children: every row points to its child through the composite foreign key
-- (member_id, household_id, member_kind) towards household_members (id, household_id, kind),
-- with member_kind always 'child'. So a row can never point to a member of another
-- household, nor to an adult or a pet, and the kind of a member that has a profile cannot
-- change (the foreign key refuses it, for every role).
-- `on delete cascade`: removing the child, or deleting the household (for example when its
-- last adult with an account leaves or deletes the account), deletes the school, the sizes
-- and the teachers.
--
-- Stored personal data of children (privacy skill, decision D1, issue #31): name of the
-- school, class, timetable and days, a short note of the timetable; name, subject and phone
-- of the teachers; sizes. Never the address of the school, never health data of any kind.
-- Free texts are never written to logs, errors, analytics or URLs.

-- Target of the composite foreign keys (member, household, kind). id is already unique: this
-- only lets the tables below check that the member is a child of their household.
alter table public.household_members
  add constraint household_members_id_household_kind_key unique (id, household_id, kind);

-- ---------------------------------------------------------------------------
-- Used by the school_days check constraint (so it must exist before the table): a
-- one-dimensional list of ISO days (1 = Monday … 7 = Sunday), without nulls, sorted and
-- without repetitions. The empty list (no timetable) is valid.
-- ---------------------------------------------------------------------------
create or replace function private.child_school_days_valid(p_days smallint[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_ndims(p_days), 1) = 1
    and p_days <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]
    and array_position(p_days, null) is null
    and p_days = coalesce(
      (select array_agg(distinct d.day order by d.day) from unnest(p_days) as d (day)),
      '{}'::smallint[]
    );
$$;

-- Evaluated as the caller by the check constraint (the admin client of the page tests
-- writes too).
revoke execute on function private.child_school_days_valid(smallint[]) from public, anon;
grant execute on function private.child_school_days_valid(smallint[]) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- child_profiles: school and sizes of a child, at most one row per child. A child without
-- any of these data has no row (save_child_profile() deletes the row that becomes empty).
-- ---------------------------------------------------------------------------
create table public.child_profiles (
  id uuid primary key default gen_random_uuid(),
  -- Set by the database: the household of the caller.
  household_id uuid not null default public.current_household_id()
    references public.households (id) on delete cascade,
  member_id uuid not null,
  -- Always 'child': part of the composite foreign key, never sent by the app.
  member_kind public.member_kind not null default 'child',

  -- School («Scuola»). No address (privacy skill).
  school_name text,
  school_class text,
  -- Entry and exit time, a time of the day in Europe/Rome (no date, no time zone).
  school_starts_at time,
  school_ends_at time,
  -- ISO days of the timetable (1 = Monday … 7 = Sunday), sorted; empty without timetable.
  school_days smallint[] not null default '{}',
  -- Short note shown in the row of the timetable (for example «mensa compresa»).
  school_note text,

  -- Sizes («Taglie»), free short texts.
  shoe_size text,
  clothing_size text,
  pajama_size text,
  -- Set by the database, never by the app: when at least one size last changed («aggiornate
  -- a …»). Null when there are no sizes.
  sizes_updated_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint child_profiles_member_fkey foreign key (member_id, household_id, member_kind)
    references public.household_members (id, household_id, kind) on delete cascade,
  -- One row per child (also the arbiter of save_child_profile() and the index of the
  -- composite foreign key, leading column member_id).
  constraint child_profiles_member_key unique (member_id),
  constraint child_profiles_member_kind_child check (member_kind = 'child'),

  -- Stored normalised: no leading/trailing whitespace, inner whitespace runs become one space.
  constraint child_profiles_school_name_normalized check (school_name = btrim(regexp_replace(school_name, '\s+', ' ', 'g'))),
  constraint child_profiles_school_name_length check (char_length(school_name) between 1 and 60),
  constraint child_profiles_school_class_normalized check (school_class = btrim(regexp_replace(school_class, '\s+', ' ', 'g'))),
  constraint child_profiles_school_class_length check (char_length(school_class) between 1 and 20),
  -- Entry and exit go together, and the exit comes after the entry.
  constraint child_profiles_school_times_together check ((school_starts_at is null) = (school_ends_at is null)),
  constraint child_profiles_school_times_order check (school_ends_at > school_starts_at),
  constraint child_profiles_school_days_valid check (private.child_school_days_valid(school_days)),
  -- At least one day with the timetable, no day without it.
  constraint child_profiles_school_days_iff_times check ((school_starts_at is null) = (cardinality(school_days) = 0)),
  constraint child_profiles_school_note_normalized check (school_note = btrim(regexp_replace(school_note, '\s+', ' ', 'g'))),
  constraint child_profiles_school_note_length check (char_length(school_note) between 1 and 60),
  -- The note is shown only in the row of the timetable.
  constraint child_profiles_school_note_needs_times check (school_note is null or school_starts_at is not null),
  constraint child_profiles_shoe_size_normalized check (shoe_size = btrim(regexp_replace(shoe_size, '\s+', ' ', 'g'))),
  constraint child_profiles_shoe_size_length check (char_length(shoe_size) between 1 and 10),
  constraint child_profiles_clothing_size_normalized check (clothing_size = btrim(regexp_replace(clothing_size, '\s+', ' ', 'g'))),
  constraint child_profiles_clothing_size_length check (char_length(clothing_size) between 1 and 10),
  constraint child_profiles_pajama_size_normalized check (pajama_size = btrim(regexp_replace(pajama_size, '\s+', ' ', 'g'))),
  constraint child_profiles_pajama_size_length check (char_length(pajama_size) between 1 and 10),
  -- A time of the last change of the sizes exactly when there is at least one size.
  constraint child_profiles_sizes_updated_at_iff_sizes check (
    (sizes_updated_at is null) = (shoe_size is null and clothing_size is null and pajama_size is null)
  )
);

-- Foreign key towards households (cascade when a household is deleted); also used by the
-- RLS policies.
create index child_profiles_household_id_idx on public.child_profiles (household_id);

alter table public.child_profiles enable row level security;

-- ---------------------------------------------------------------------------
-- child_teachers: the teachers of a child («Maestre»), at most five, in the order of the
-- page (sort_order 1 … 5).
-- ---------------------------------------------------------------------------
create table public.child_teachers (
  id uuid primary key default gen_random_uuid(),
  -- Set by the database: the household of the caller.
  household_id uuid not null default public.current_household_id()
    references public.households (id) on delete cascade,
  member_id uuid not null,
  -- Always 'child': part of the composite foreign key, never sent by the app.
  member_kind public.member_kind not null default 'child',
  -- Order of the teachers of the child, as given by the page (1 = first).
  sort_order smallint not null,
  -- Written in full by the user («Maestra Bianchi»): the app adds no title.
  name text not null,
  subject text,
  -- As written by the user; the page builds the tel: link from it.
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint child_teachers_member_fkey foreign key (member_id, household_id, member_kind)
    references public.household_members (id, household_id, kind) on delete cascade,
  -- One teacher per place in the order of a child (also the index of the composite foreign key and
  -- the order of the page, leading column member_id). With places 1 … 5 a child never
  -- has more than five teachers.
  constraint child_teachers_member_sort_order_key unique (member_id, sort_order),
  constraint child_teachers_member_kind_child check (member_kind = 'child'),
  constraint child_teachers_sort_order_range check (sort_order between 1 and 5),

  constraint child_teachers_name_normalized check (name = btrim(regexp_replace(name, '\s+', ' ', 'g'))),
  constraint child_teachers_name_length check (char_length(name) between 1 and 40),
  constraint child_teachers_subject_normalized check (subject = btrim(regexp_replace(subject, '\s+', ' ', 'g'))),
  constraint child_teachers_subject_length check (char_length(subject) between 1 and 40),
  constraint child_teachers_phone_normalized check (phone = btrim(regexp_replace(phone, '\s+', ' ', 'g'))),
  constraint child_teachers_phone_length check (char_length(phone) between 1 and 20),
  -- Only digits, spaces, «.», «-», «/», «(», «)» and a leading «+».
  constraint child_teachers_phone_characters check (phone ~ '^\+?[0-9 ./()-]+$'),
  -- From 6 to 15 digits in all.
  constraint child_teachers_phone_digits check (
    char_length(regexp_replace(phone, '[^0-9]', '', 'g')) between 6 and 15
  )
);

-- Foreign key towards households (cascade when a household is deleted); also used by the
-- RLS policies.
create index child_teachers_household_id_idx on public.child_teachers (household_id);

alter table public.child_teachers enable row level security;
