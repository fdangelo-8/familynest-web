-- Issue #219: functions and triggers of the school, sizes and teachers of a child (page #31).
--
-- Conventions (same as deadlines, pinned_spaces and notification_preferences):
-- - every function has `set search_path = ''` and fully qualified names;
-- - trigger functions live in the "private" schema (not exposed by the Data API, not in the
--   generated types); their bodies call no other private function, so that the admin client
--   (service_role) writes through the same triggers;
-- - every function here is `security invoker`: RLS, column privileges and the triggers apply
--   to the caller also inside save_child_profile(). Rows of other households are never read;
-- - guard triggers check `current_user`: the Data API roles (authenticated, anon) get the
--   checks that depend on the caller, while statements run by the database owner or by
--   service_role (foreign key actions, seed, page tests with the admin client) are trusted.
--   The kind of the member (only children), the formats and the limit of five teachers
--   apply to every role.
-- Execute grants are set in the child_profiles_policies_and_grants migration.
--
-- Errors (the page recognises them by code):
-- - 23505: the colour is already taken by another member of the household;
-- - 23514: a value not allowed (birth date in the future, text too long, exit not after
--   entry, entry without exit, note without timetable, phone not valid, days not valid,
--   teacher list not valid…) or a member that is not a child;
-- - 42501: no signed-in user, no household, or a member that is not of the caller's
--   household (same answer whether it exists elsewhere or not);
-- - FN004 'teacher limit reached': more than five teachers for a child;
-- - 22004: a required argument is null (save_child_profile);
-- - P0001 'use POST': save_child_profile called through the Data API with a method other
--   than POST (lesson of #112).

-- ---------------------------------------------------------------------------
-- Before insert or update of child_profiles:
-- - API roles, insert: the household is always the caller's, and the member one of its
--   members (42501 otherwise); the row times are set here;
-- - API roles, update: household, child and creation time never change (also without
--   column privilege);
-- - every role: texts normalised (an empty text becomes null), days sorted (repetitions and
--   values not allowed are left for the check constraint to refuse);
-- - sizes_updated_at: null without sizes; otherwise the time of the statement when the row
--   is created with sizes or when at least one size changes, else unchanged. Trusted roles
--   may set it explicitly (page tests with a fixed date); the API roles never.
-- ---------------------------------------------------------------------------
create or replace function private.child_profiles_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_household_id uuid;
  v_api boolean := current_user in ('authenticated', 'anon');
begin
  if tg_op = 'INSERT' then
    if v_api then
      v_household_id := (select public.current_household_id());
      -- Checked before the row reaches the unique key: a member of another household gets
      -- the same answer whether it has a profile or not (nothing leaks).
      if v_household_id is null or not exists (
        select 1
        from public.household_members m
        where m.id = new.member_id
          and m.household_id = v_household_id
      ) then
        raise exception 'new row violates row-level security policy for table "child_profiles"'
          using errcode = '42501';
      end if;
      new.household_id := v_household_id;
      new.member_kind := 'child';
      new.sizes_updated_at := null;
      new.created_at := now();
      new.updated_at := now();
    end if;
  elsif v_api and (
    new.id is distinct from old.id
    or new.household_id is distinct from old.household_id
    or new.member_id is distinct from old.member_id
    or new.member_kind is distinct from old.member_kind
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'this field of a child profile cannot be changed' using errcode = '42501';
  end if;

  new.school_name := nullif(btrim(regexp_replace(new.school_name, '\s+', ' ', 'g')), '');
  new.school_class := nullif(btrim(regexp_replace(new.school_class, '\s+', ' ', 'g')), '');
  new.school_note := nullif(btrim(regexp_replace(new.school_note, '\s+', ' ', 'g')), '');
  new.shoe_size := nullif(btrim(regexp_replace(new.shoe_size, '\s+', ' ', 'g')), '');
  new.clothing_size := nullif(btrim(regexp_replace(new.clothing_size, '\s+', ' ', 'g')), '');
  new.pajama_size := nullif(btrim(regexp_replace(new.pajama_size, '\s+', ' ', 'g')), '');

  if new.school_days is null then
    new.school_days := '{}'::smallint[];
  elsif coalesce(array_ndims(new.school_days), 1) = 1 then
    new.school_days := coalesce(
      (select array_agg(d.day order by d.day nulls last) from unnest(new.school_days) as d (day)),
      '{}'::smallint[]
    );
  end if;

  if new.shoe_size is null and new.clothing_size is null and new.pajama_size is null then
    new.sizes_updated_at := null;
  elsif tg_op = 'INSERT' then
    if v_api or new.sizes_updated_at is null then
      new.sizes_updated_at := now();
    end if;
  elsif new.shoe_size is distinct from old.shoe_size
     or new.clothing_size is distinct from old.clothing_size
     or new.pajama_size is distinct from old.pajama_size then
    if v_api or new.sizes_updated_at is not distinct from old.sizes_updated_at then
      new.sizes_updated_at := now();
    end if;
  elsif v_api or new.sizes_updated_at is null then
    new.sizes_updated_at := old.sizes_updated_at;
  end if;

  return new;
end;
$$;

create trigger child_profiles_before_write
  before insert or update on public.child_profiles
  for each row execute function private.child_profiles_before_write();

create trigger child_profiles_set_updated_at
  before update on public.child_profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Before insert or update of child_teachers:
-- - API roles, insert: the household is always the caller's, and the member one of its
--   members (42501 otherwise); the row times are set here;
-- - API roles, update: household, child and creation time never change;
-- - every role: texts normalised (an empty subject or phone becomes null; an empty name stays
--   empty and is refused by the length check);
-- - insert, every role: at most five teachers per child (FN004).
--
-- Concurrency (lesson of #192): inserts for the same child are serialised by a transaction
-- advisory lock taken before counting, so two requests close together cannot reach six.
-- save_child_profile() takes the same lock before deleting the old teachers. The trigger
-- function is volatile, so in `read committed` (the isolation level of the Data API) the
-- count after the lock sees the rows committed by the transaction that held it.
-- ---------------------------------------------------------------------------
create or replace function private.child_teachers_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  -- Maximum number of teachers of a child (issue #31). Also in save_child_profile() and, as
  -- the range of sort_order, in the table; the app has its own constant.
  c_max_teachers constant integer := 5;
  v_household_id uuid;
  v_api boolean := current_user in ('authenticated', 'anon');
  v_count integer;
begin
  if tg_op = 'INSERT' then
    if v_api then
      v_household_id := (select public.current_household_id());
      -- Checked before counting and before the row reaches the unique key: a member of
      -- another household gets the same answer whatever its teachers (nothing leaks).
      if v_household_id is null or not exists (
        select 1
        from public.household_members m
        where m.id = new.member_id
          and m.household_id = v_household_id
      ) then
        raise exception 'new row violates row-level security policy for table "child_teachers"'
          using errcode = '42501';
      end if;
      new.household_id := v_household_id;
      new.member_kind := 'child';
      new.created_at := now();
      new.updated_at := now();
    end if;
  elsif v_api and (
    new.id is distinct from old.id
    or new.household_id is distinct from old.household_id
    or new.member_id is distinct from old.member_id
    or new.member_kind is distinct from old.member_kind
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'this field of a teacher cannot be changed' using errcode = '42501';
  end if;

  new.name := btrim(regexp_replace(new.name, '\s+', ' ', 'g'));
  new.subject := nullif(btrim(regexp_replace(new.subject, '\s+', ' ', 'g')), '');
  new.phone := nullif(btrim(regexp_replace(new.phone, '\s+', ' ', 'g')), '');

  if tg_op = 'INSERT' and new.member_id is not null then
    perform pg_advisory_xact_lock(hashtextextended('public.child_teachers:' || new.member_id::text, 0));

    select count(*) into v_count
    from public.child_teachers t
    where t.member_id = new.member_id;

    if v_count >= c_max_teachers then
      raise exception 'teacher limit reached' using errcode = 'FN004';
    end if;
  end if;

  return new;
end;
$$;

create trigger child_teachers_before_write
  before insert or update on public.child_teachers
  for each row execute function private.child_teachers_before_write();

create trigger child_teachers_set_updated_at
  before update on public.child_teachers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RPC (write): saves the whole profile of a child in one transaction (the «Salva le
-- modifiche» of the edit sheet of page #31): name, colour and birth date of the member,
-- school, sizes and the complete list of teachers. Everything is saved or nothing is: any
-- error, also half way (for example a phone not valid after the school is written), leaves
-- every row as it was.
--
-- Arguments: only the id of the child and the values. The household is the caller's
-- (session); ids of teachers, household or author are never received.
-- - p_member_id, p_name, p_color, p_teachers are required (22004 when null);
-- - p_birth_date and the school and size values are the full new state: null (or omitted)
--   means «empty», and what was saved before is cleared. Texts are normalised by the
--   triggers (an empty text is «empty»);
-- - p_school_days: ISO days 1 … 7. Ignored (saved empty) when there is no timetable (entry
--   and exit both empty); with a timetable at least one day is required;
-- - p_teachers: a JSON array, in the order of the page, of at most five objects with only
--   the keys "name" (text, required), "subject" and "phone" (text or null). Every other
--   key, an id included, is refused (23514). It replaces the teachers saved before.
-- When the school and the sizes are all empty the row of child_profiles is deleted.
--
-- Checks, in this order, before anything is written: the method (POST), the required
-- arguments, a household for the caller, a member of that household (42501 otherwise), a
-- child (23514), the shape of the teacher list (23514) and its length (FN004). The writes
-- then run as the caller, with RLS, column privileges and the triggers of every table:
-- every adult with an account of the household may do them, administrator or not.
-- Concurrency: two saves of the same child are serialised by the advisory lock of the
-- teachers of the child; the last one wins.
-- ---------------------------------------------------------------------------
create or replace function public.save_child_profile(
  p_member_id uuid,
  p_name text,
  p_color public.member_color,
  p_teachers jsonb,
  p_birth_date date default null,
  p_school_name text default null,
  p_school_class text default null,
  p_school_starts_at time default null,
  p_school_ends_at time default null,
  p_school_days smallint[] default null,
  p_school_note text default null,
  p_shoe_size text default null,
  p_clothing_size text default null,
  p_pajama_size text default null
)
returns void
language plpgsql
volatile
set search_path = ''
as $$
declare
  c_max_teachers constant integer := 5;
  v_household_id uuid;
  v_kind public.member_kind;
  v_teacher jsonb;
  v_rows integer;
  v_days smallint[];
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  if p_member_id is null or p_name is null or p_color is null or p_teachers is null then
    raise exception 'member, name, colour and teachers are required' using errcode = '22004';
  end if;

  v_household_id := (select public.current_household_id());
  if v_household_id is null then
    raise exception 'permission denied for function save_child_profile' using errcode = '42501';
  end if;

  select m.kind into v_kind
  from public.household_members m
  where m.id = p_member_id
    and m.household_id = v_household_id;

  if not found then
    raise exception 'permission denied for function save_child_profile' using errcode = '42501';
  end if;

  if v_kind <> 'child' then
    raise exception 'only children have a school, sizes and teachers' using errcode = '23514';
  end if;

  if jsonb_typeof(p_teachers) <> 'array' then
    raise exception 'the teachers must be a list' using errcode = '23514';
  end if;

  if jsonb_array_length(p_teachers) > c_max_teachers then
    raise exception 'teacher limit reached' using errcode = 'FN004';
  end if;

  for v_teacher in select t.value from jsonb_array_elements(p_teachers) as t (value) loop
    if jsonb_typeof(v_teacher) <> 'object'
       or exists (
         select 1
         from jsonb_object_keys(v_teacher) as k (key)
         where k.key not in ('name', 'subject', 'phone')
       )
       or jsonb_typeof(v_teacher -> 'name') is distinct from 'string'
       or coalesce(jsonb_typeof(v_teacher -> 'subject'), 'null') not in ('string', 'null')
       or coalesce(jsonb_typeof(v_teacher -> 'phone'), 'null') not in ('string', 'null') then
      raise exception 'a teacher is not valid' using errcode = '23514';
    end if;
  end loop;

  -- Same lock as child_teachers_before_write: taken before anything is read again or
  -- written, so that two saves of the same child never mix their teachers.
  perform pg_advisory_xact_lock(hashtextextended('public.child_teachers:' || p_member_id::text, 0));

  -- 1. The member (colour already taken: 23505; birth date in the future: 23514).
  update public.household_members m
  set name = p_name,
      color = p_color,
      birth_date = p_birth_date
  where m.id = p_member_id
    and m.household_id = v_household_id;

  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'permission denied for function save_child_profile' using errcode = '42501';
  end if;

  -- 2. School and sizes: one row, or none when everything is empty.
  if p_school_starts_at is null and p_school_ends_at is null then
    v_days := '{}'::smallint[];
  else
    v_days := coalesce(p_school_days, '{}'::smallint[]);
  end if;

  if nullif(btrim(regexp_replace(p_school_name, '\s+', ' ', 'g')), '') is null
     and nullif(btrim(regexp_replace(p_school_class, '\s+', ' ', 'g')), '') is null
     and p_school_starts_at is null
     and p_school_ends_at is null
     and nullif(btrim(regexp_replace(p_school_note, '\s+', ' ', 'g')), '') is null
     and nullif(btrim(regexp_replace(p_shoe_size, '\s+', ' ', 'g')), '') is null
     and nullif(btrim(regexp_replace(p_clothing_size, '\s+', ' ', 'g')), '') is null
     and nullif(btrim(regexp_replace(p_pajama_size, '\s+', ' ', 'g')), '') is null then
    delete from public.child_profiles p
    where p.member_id = p_member_id;
  else
    insert into public.child_profiles as p (
      member_id, school_name, school_class, school_starts_at, school_ends_at, school_days,
      school_note, shoe_size, clothing_size, pajama_size
    )
    values (
      p_member_id, p_school_name, p_school_class, p_school_starts_at, p_school_ends_at, v_days,
      p_school_note, p_shoe_size, p_clothing_size, p_pajama_size
    )
    on conflict (member_id) do update
    set school_name = excluded.school_name,
        school_class = excluded.school_class,
        school_starts_at = excluded.school_starts_at,
        school_ends_at = excluded.school_ends_at,
        school_days = excluded.school_days,
        school_note = excluded.school_note,
        shoe_size = excluded.shoe_size,
        clothing_size = excluded.clothing_size,
        pajama_size = excluded.pajama_size;
  end if;

  -- 3. Teachers: the new list replaces the old one, in the given order.
  delete from public.child_teachers t
  where t.member_id = p_member_id;

  insert into public.child_teachers (member_id, sort_order, name, subject, phone)
  select p_member_id, t.n::smallint, t.value ->> 'name', t.value ->> 'subject', t.value ->> 'phone'
  from jsonb_array_elements(p_teachers) with ordinality as t (value, n)
  order by t.n;
end;
$$;
