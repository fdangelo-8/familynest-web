-- Issue #108 (for pages #24 Casa · Scadenze and #22 Aggiungi): the deadlines of the
-- household ("Scadenze"): documents, car tax, insurances, subscriptions. Free title, no
-- type or category (D1: no health field of any kind).
--
-- RLS is enabled here, in the same migration that creates the table. Policies and
-- grants are in the deadlines_policies_and_grants migration: until then RLS denies
-- every row to the API roles.
-- Text normalisation, the author, the kind of the assignee, who may change «Solo io»
-- and the cleanup when a member leaves are enforced by triggers in the
-- deadlines_functions_and_triggers migration.
--
-- «Solo io» (decision of Francesco, 30/10): a «Solo io» deadline is seen and touched
-- only by its author, nobody else takes care of it, and only the author changes it.
--
-- Same-household rule without triggers: every reference to a member goes through a
-- composite foreign key that includes household_id (target: the unique key
-- household_members (id, household_id) added by the events_tables migration), so a
-- deadline can never point to a member of another household.
--
-- Stored personal data (privacy skill): the title and the note (free text of the user,
-- never in logs, errors, analytics or URLs), a day, links to members that already exist
-- and the chosen reminders. No health data (D1).

-- ---------------------------------------------------------------------------
-- Used by the reminder_days check constraint (so it must exist before the table):
-- a one-dimensional list of reminders chosen among 30, 7 and 1 days before and the day
-- itself (0), without nulls and without repetitions. The empty list (no reminder) is
-- valid.
-- ---------------------------------------------------------------------------
create or replace function private.deadlines_reminder_days_valid(p_days smallint[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_ndims(p_days), 1) = 1
    and p_days <@ array[30, 7, 1, 0]::smallint[]
    and array_position(p_days, null) is null
    and cardinality(p_days) = (select count(distinct d.day) from unnest(p_days) as d (day));
$$;

-- Evaluated as the caller by the check constraint.
revoke execute on function private.deadlines_reminder_days_valid(smallint[]) from public, anon;
grant execute on function private.deadlines_reminder_days_valid(smallint[]) to authenticated;

create table public.deadlines (
  id uuid primary key default gen_random_uuid(),
  -- The app may omit it: the household of the caller.
  household_id uuid not null default public.current_household_id()
    references public.households (id) on delete cascade,
  title text not null,
  -- The day of the deadline, without time. Past days are accepted (page tests use a
  -- fixed clock; the "already past" warning belongs to the app).
  due_date date not null,
  -- Optional short note shown in the row of page #24 (e.g. «Serve per la gita»).
  note text,
  -- Member who created the deadline, set by the database (never chosen by the app).
  -- Null only for «Tutto il Nest» deadlines whose author has left the household: their
  -- «Solo io» deadlines are deleted when they leave.
  created_by_member_id uuid,
  -- «Chi se ne occupa»: an adult or a child of the household (trigger), optional.
  assignee_member_id uuid,
  -- «Riguarda»: any member of the household (adult, child, pet), optional.
  for_member_id uuid,
  -- «Solo io»: only the author sees it and touches it.
  is_private boolean not null default false,
  -- «Avvisami»: days before the deadline (0 = the day itself). Saved by page #22, used
  -- by the notifications (#39). Stored sorted from the farthest (trigger).
  reminder_days smallint[] not null default '{30,7,1}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint deadlines_created_by_fkey foreign key (created_by_member_id, household_id)
    references public.household_members (id, household_id) on delete set null (created_by_member_id),
  constraint deadlines_assignee_fkey foreign key (assignee_member_id, household_id)
    references public.household_members (id, household_id) on delete set null (assignee_member_id),
  constraint deadlines_for_member_fkey foreign key (for_member_id, household_id)
    references public.household_members (id, household_id) on delete set null (for_member_id),

  -- Stored normalised: no leading/trailing whitespace, inner whitespace runs become one space.
  constraint deadlines_title_normalized check (title = btrim(regexp_replace(title, '\s+', ' ', 'g'))),
  constraint deadlines_title_length check (char_length(title) between 1 and 80),
  constraint deadlines_note_normalized check (note = btrim(regexp_replace(note, '\s+', ' ', 'g'))),
  constraint deadlines_note_length check (char_length(note) between 1 and 80),
  -- Sanity range: no year 0001 or 9999 typed by mistake, no infinity.
  constraint deadlines_due_date_range check (due_date between date '2000-01-01' and date '2100-12-31'),
  constraint deadlines_reminder_days_valid check (private.deadlines_reminder_days_valid(reminder_days)),
  -- «Solo io» always belongs to someone.
  constraint deadlines_private_has_author check (not is_private or created_by_member_id is not null),
  -- «Solo io»: nobody else takes care of it (the others would never see it).
  constraint deadlines_private_assignee check (
    not is_private or assignee_member_id is null or assignee_member_id = created_by_member_id
  )
);

-- Order of page #24 (due date, then creation). Leading column also indexes the
-- household_id foreign key.
create index deadlines_household_due_idx on public.deadlines (household_id, due_date, created_at);
-- Foreign keys towards household_members (also used by the RLS policies and by the
-- cleanup when a member leaves).
create index deadlines_created_by_member_id_idx on public.deadlines (created_by_member_id);
create index deadlines_assignee_member_id_idx on public.deadlines (assignee_member_id);
create index deadlines_for_member_id_idx on public.deadlines (for_member_id);

alter table public.deadlines enable row level security;
