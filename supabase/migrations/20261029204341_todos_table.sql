-- Issue #87 (for pages #23 Casa · Da fare and #22 Aggiungi): the things to do of the
-- household ("Da fare").
-- A thing is "to do" while done_at is null and "done" once done_at is set.
--
-- RLS is enabled here, in the same migration that creates the table. Policies and
-- grants are in the todos_policies_and_grants migration: until then RLS denies every
-- row to the API roles.
-- Text normalisation, the author, who marked it done, the time window of done_at, the
-- kind of the assignee, who may change «Solo io» and the cleanup when a member leaves
-- are enforced by triggers in the todos_functions_and_triggers migration.
--
-- Same-household rule without triggers: every reference to a member goes through a
-- composite foreign key that includes household_id (target: the unique key
-- household_members (id, household_id) added by the events_tables migration), so a
-- thing to do can never point to a member of another household.
--
-- Stored personal data (privacy skill): the title (free text of the user, never in logs,
-- errors or analytics), links to members that already exist and two dates. No health
-- data (D1).

create table public.todos (
  id uuid primary key default gen_random_uuid(),
  -- The app may omit it: the household of the caller.
  household_id uuid not null default public.current_household_id()
    references public.households (id) on delete cascade,
  title text not null,
  -- Member who created the thing, set by the database (never chosen by the app).
  -- Null only for «Tutto il Nest» things whose author has left the household: their
  -- «Solo io» things are deleted when they leave.
  created_by_member_id uuid,
  -- «Chi se ne occupa»: an adult or a child of the household (trigger), optional.
  assignee_member_id uuid,
  -- «Per chi è»: any member of the household (adult, child, pet), optional.
  for_member_id uuid,
  -- «Entro quando»: a day, without time.
  due_date date,
  -- «Solo io»: only the author sees it and touches it.
  is_private boolean not null default false,
  -- Null = to do. UTC instant of the tap, written by the app and accepted by the
  -- database only between now() - 30 days and now() + 5 minutes (trigger).
  done_at timestamptz,
  -- Member who marked it done, set by the database. Null while to do, or when that
  -- member has left the household.
  done_by_member_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint todos_created_by_fkey foreign key (created_by_member_id, household_id)
    references public.household_members (id, household_id) on delete set null (created_by_member_id),
  constraint todos_assignee_fkey foreign key (assignee_member_id, household_id)
    references public.household_members (id, household_id) on delete set null (assignee_member_id),
  constraint todos_for_member_fkey foreign key (for_member_id, household_id)
    references public.household_members (id, household_id) on delete set null (for_member_id),
  constraint todos_done_by_fkey foreign key (done_by_member_id, household_id)
    references public.household_members (id, household_id) on delete set null (done_by_member_id),

  -- Stored normalised: no leading/trailing whitespace, inner whitespace runs become one space.
  constraint todos_title_normalized check (title = btrim(regexp_replace(title, '\s+', ' ', 'g'))),
  constraint todos_title_length check (char_length(title) between 1 and 80),
  -- «Solo io» always belongs to someone.
  constraint todos_private_has_author check (not is_private or created_by_member_id is not null),
  -- «Solo io»: nobody else takes care of it (the others would never see it).
  constraint todos_private_assignee check (
    not is_private or assignee_member_id is null or assignee_member_id = created_by_member_id
  ),
  -- Nobody marked done a thing that is still to do.
  constraint todos_done_by_only_done check (done_at is not null or done_by_member_id is null)
);

-- Groups of page #23 ("Questa settimana", "Più avanti" by due date; "Fatti" by done time).
-- Leading column also indexes the household_id foreign key.
create index todos_household_done_idx on public.todos (household_id, done_at);
create index todos_household_due_idx on public.todos (household_id, due_date);
-- Foreign keys towards household_members (also used by the RLS policies and by the
-- cleanup when a member leaves).
create index todos_created_by_member_id_idx on public.todos (created_by_member_id);
create index todos_assignee_member_id_idx on public.todos (assignee_member_id);
create index todos_for_member_id_idx on public.todos (for_member_id);
create index todos_done_by_member_id_idx on public.todos (done_by_member_id);
-- Daily cleanup of the things done more than 90 days ago, across households.
create index todos_done_at_idx on public.todos (done_at) where done_at is not null;

alter table public.todos enable row level security;
