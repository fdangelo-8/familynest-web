-- Issue #481 (part A of #460): functions of the deadlines that repeat.
--
-- - private.deadline_open_to_member(): the rule «Solo io» of the deadlines, in one place.
--   The select, update and delete policies (next migration) and complete_deadline() use it;
--   nothing else writes the rule again;
-- - private.deadline_next_due_date(): the next due date counted from a day, by repetition.
--   Calendar months; a day that does not exist in the target month becomes the last day
--   of that month (31/01 + 1 month = 28/02, 29/02 + 1 year = 28/02);
-- - public.complete_deadline(): «Fatta». The same deadline moves to its next due date; every
--   other field stays as it is. Returns the previous due date, for «Annulla»;
-- - public.undo_complete_deadline(): «Annulla» after «Fatta». A plain write of the due date
--   with the policies and the triggers of the table;
-- - public.create_deadline() and public.update_deadline(): the same functions as #337 with
--   the repetition. The new arguments come last and have a default, so the calls that do
--   not send them keep working: create_deadline saves «Mai», update_deadline keeps the
--   repetition already saved.
--
-- Reminders: the job of 9:00 (private.notifications_deadline_reminders) always reads the
-- current due date, so after «Fatta» the reminders count from the new date and none is
-- created for the previous one. Notifications already delivered stay as they are, as after
-- any other change of the date.
--
-- Only POST through the Data API (lesson of #112). Execute grants: next migration.
--
-- Errors:
-- - P0001 'use POST': called through the Data API with a method other than POST;
-- - 42501: no signed-in member, or the deadline is not one the caller may change (the same
--   error and message whatever the reason);
-- - 55000: «Fatta» on a deadline that does not repeat («Mai»);
-- - 22023: «Fatta» with a new due date that is not after today (Europe/Rome) or is after
--   31/12/2100; invalid arguments of the write functions (as #337);
-- - 23514: a value refused by the constraints of the table (for example N outside 1-365,
--   or N with a repetition other than «Ogni … giorni»).

-- ---------------------------------------------------------------------------
-- «Solo io»: a deadline is open to a member of its household when it is «Tutto il Nest» or
-- when the member is its author. Always true or false, never null (no member = false).
-- The household is checked apart, by the caller of this function.
-- ---------------------------------------------------------------------------
create or replace function private.deadline_open_to_member(
  p_is_private boolean,
  p_created_by_member_id uuid,
  p_member_id uuid
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    p_is_private = false
      or (p_member_id is not null and p_created_by_member_id = p_member_id),
    false
  );
$$;

-- ---------------------------------------------------------------------------
-- The next due date counted from p_from. Null for «Mai» (and for «Ogni … giorni» without
-- N, which the table never holds). date + interval of months keeps the day when it exists
-- and otherwise gives the last day of the month.
-- ---------------------------------------------------------------------------
create or replace function private.deadline_next_due_date(
  p_recurrence public.deadline_recurrence,
  p_interval_days smallint,
  p_from date
)
returns date
language sql
immutable
set search_path = ''
as $$
  select case p_recurrence
    when 'monthly' then (p_from + interval '1 month')::date
    when 'every_3_months' then (p_from + interval '3 months')::date
    when 'every_6_months' then (p_from + interval '6 months')::date
    when 'yearly' then (p_from + interval '1 year')::date
    when 'every_n_days' then p_from + p_interval_days
    else null
  end;
$$;

-- ---------------------------------------------------------------------------
-- «Fatta». Arguments: the id of the deadline and, optionally, the new due date chosen with
-- «Cambia data»; without it, the next due date counted from today (Europe/Rome). Nothing
-- else is read from the caller.
-- Checks, in this order, before anything is written: the method; the household and the
-- member of the verified session; the deadline among those of that household that the
-- member may change («Solo io»: only its author); the repetition; the new date, after
-- today and not after 31/12/2100.
-- Security definer: the row is read and written as the owner, with the checks above in
-- place of the policies. The trusted trigger of the table normalises the row and
-- set_updated_at sets the time, as for every other write.
-- Returns only the previous due date.
-- ---------------------------------------------------------------------------
create or replace function public.complete_deadline(p_deadline_id uuid, p_due_date date default null)
returns date
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_household_id uuid;
  v_member_id uuid;
  v_previous_due_date date;
  v_recurrence public.deadline_recurrence;
  v_interval_days smallint;
  v_today date;
  v_due_date date;
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  v_household_id := (select public.current_household_id());
  v_member_id := (select private.current_member_id());
  if v_household_id is null or v_member_id is null or p_deadline_id is null then
    raise exception 'deadline not available' using errcode = '42501';
  end if;

  select d.due_date, d.recurrence, d.recurrence_interval_days
    into v_previous_due_date, v_recurrence, v_interval_days
  from public.deadlines d
  where d.id = p_deadline_id
    and d.household_id = v_household_id
    and private.deadline_open_to_member(d.is_private, d.created_by_member_id, v_member_id)
  for update;
  if not found then
    raise exception 'deadline not available' using errcode = '42501';
  end if;

  if v_recurrence = 'none' then
    raise exception 'the deadline does not repeat' using errcode = '55000';
  end if;

  v_today := (now() at time zone 'Europe/Rome')::date;
  v_due_date := coalesce(p_due_date, private.deadline_next_due_date(v_recurrence, v_interval_days, v_today));
  if v_due_date is null or v_due_date <= v_today then
    raise exception 'the new due date must be after today' using errcode = '22023';
  end if;
  if v_due_date > date '2100-12-31' then
    raise exception 'the new due date must not be after 2100-12-31' using errcode = '22023';
  end if;

  update public.deadlines d
  set due_date = v_due_date
  where d.id = p_deadline_id;

  return v_previous_due_date;
end;
$$;

-- ---------------------------------------------------------------------------
-- «Annulla» after «Fatta»: the due date goes back to the one returned by complete_deadline.
-- Security invoker: a write of the due date like the edit sheet, with every rule of the
-- table (policies, guard triggers, constraints). A deadline the caller may not change is
-- never found and gives 42501, the same as one that does not exist.
-- ---------------------------------------------------------------------------
create or replace function public.undo_complete_deadline(p_deadline_id uuid, p_due_date date)
returns void
language plpgsql
volatile
set search_path = ''
as $$
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;
  if p_due_date is null then
    raise exception 'invalid due date' using errcode = '22023';
  end if;

  update public.deadlines d
  set due_date = p_due_date
  where d.id = p_deadline_id;
  if not found then
    raise exception 'deadline not available' using errcode = '42501';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Write functions of #337 with the repetition (security invoker, unchanged otherwise).
-- The old signatures are dropped: two functions with the same name and compatible
-- arguments could not be told apart by the Data API.
-- ---------------------------------------------------------------------------
drop function public.create_deadline(text, date, uuid[], text, uuid, boolean, smallint[]);
drop function public.update_deadline(uuid, text, date, uuid[], text, uuid, boolean, smallint[]);

create or replace function public.create_deadline(
  p_title text,
  p_due_date date,
  p_assignee_member_ids uuid[] default '{}',
  p_note text default null,
  p_for_member_id uuid default null,
  p_is_private boolean default false,
  p_reminder_days smallint[] default '{30,7,1}',
  p_recurrence public.deadline_recurrence default 'none',
  p_recurrence_interval_days smallint default null
)
returns uuid
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;
  if p_assignee_member_ids is null
     or array_position(p_assignee_member_ids, null) is not null
     or cardinality(p_assignee_member_ids) > 20 then
    raise exception 'invalid assignees' using errcode = '22023';
  end if;
  if p_recurrence is null then
    raise exception 'invalid repetition' using errcode = '22023';
  end if;

  insert into public.deadlines (
    title, due_date, note, for_member_id, is_private, reminder_days, recurrence, recurrence_interval_days
  )
  values (
    p_title, p_due_date, p_note, p_for_member_id, coalesce(p_is_private, false), p_reminder_days,
    p_recurrence, p_recurrence_interval_days
  )
  returning id into v_id;

  insert into public.deadline_assignees (deadline_id, member_id)
  select distinct v_id, a.member_id
  from unnest(p_assignee_member_ids) as a (member_id);

  return v_id;
end;
$$;

-- p_recurrence null (default) keeps the repetition already saved, with its N; then
-- p_recurrence_interval_days must be null too.
create or replace function public.update_deadline(
  p_deadline_id uuid,
  p_title text,
  p_due_date date,
  p_assignee_member_ids uuid[],
  p_note text,
  p_for_member_id uuid,
  p_is_private boolean,
  p_reminder_days smallint[],
  p_recurrence public.deadline_recurrence default null,
  p_recurrence_interval_days smallint default null
)
returns void
language plpgsql
volatile
set search_path = ''
as $$
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;
  if p_assignee_member_ids is null
     or array_position(p_assignee_member_ids, null) is not null
     or cardinality(p_assignee_member_ids) > 20 then
    raise exception 'invalid assignees' using errcode = '22023';
  end if;
  -- No silent «Tutto il Nest»: the app always sends the visibility it shows.
  if p_is_private is null then
    raise exception 'invalid visibility' using errcode = '22023';
  end if;
  if p_recurrence is null and p_recurrence_interval_days is not null then
    raise exception 'invalid repetition' using errcode = '22023';
  end if;

  perform 1 from public.deadlines d where d.id = p_deadline_id for update;
  if not found then
    raise exception 'deadline not found' using errcode = 'P0002';
  end if;

  delete from public.deadline_assignees a
  where a.deadline_id = p_deadline_id
    and a.member_id <> all (p_assignee_member_ids);

  update public.deadlines d
  set title = p_title,
      due_date = p_due_date,
      note = p_note,
      for_member_id = p_for_member_id,
      is_private = p_is_private,
      reminder_days = p_reminder_days,
      recurrence = coalesce(p_recurrence, d.recurrence),
      recurrence_interval_days = case
        when p_recurrence is null then d.recurrence_interval_days
        else p_recurrence_interval_days
      end
  where d.id = p_deadline_id;

  insert into public.deadline_assignees (deadline_id, member_id)
  select distinct p_deadline_id, a.member_id
  from unnest(p_assignee_member_ids) as a (member_id)
  where not exists (
    select 1
    from public.deadline_assignees x
    where x.deadline_id = p_deadline_id
      and x.member_id = a.member_id
  );
end;
$$;
