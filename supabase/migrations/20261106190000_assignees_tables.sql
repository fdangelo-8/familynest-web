-- Issue #337 (for #333 Aggiungi and #335 modifica della Spesa, spec 333 §6): «Chi se ne
-- occupa» becomes a choice of several people for the things to do, the deadlines and the
-- shopping items (decision 5 of Francesco, 06/11).
--
-- Three link tables, one row per thing and person, same shape as event_members:
-- - todo_assignees (todo_id, member_id);
-- - deadline_assignees (deadline_id, member_id);
-- - shopping_item_assignees (shopping_item_id, member_id).
--
-- Same-household rule without triggers: both references go through a composite foreign
-- key that includes household_id, so a row can never link a thing of one household to a
-- member of another. `on delete cascade` on both: a member who leaves (or is removed, or
-- deletes the account) and a thing that is deleted take their rows with them; the
-- household takes everything.
-- The kind of the member (adult or child, never a pet) and «Solo io ⇒ only the author»
-- are enforced by triggers (assignees_functions_and_triggers migration).
--
-- Compatibility (spec 333 §6.6): todos.assignee_member_id and deadlines.assignee_member_id
-- stay for a while, kept by the database equal to the first person of the new tables (or
-- null), so that the pages already on main keep working until they read the new tables.
-- The shopping list never had one and gets none.
--
-- RLS is enabled here, in the same migration that creates each table. Policies and grants
-- are in the assignees_policies_and_grants migration: until then RLS denies every row to
-- the API roles.
--
-- Stored personal data (privacy skill): only links between things and members that
-- already exist in the same household, and the time of the link. No free text, no health
-- data (D1).

-- ---------------------------------------------------------------------------
-- Target of the composite foreign key (shopping item, household). id is already unique:
-- this only lets the link rows check that the item belongs to their household (todos and
-- deadlines already have todos_id_household_key and deadlines_id_household_key).
-- ---------------------------------------------------------------------------
alter table public.shopping_items
  add constraint shopping_items_id_household_key unique (id, household_id);

-- ---------------------------------------------------------------------------
-- todo_assignees
-- ---------------------------------------------------------------------------
create table public.todo_assignees (
  todo_id uuid not null,
  member_id uuid not null,
  -- The app may omit it: the household of the caller.
  household_id uuid not null default public.current_household_id()
    references public.households (id) on delete cascade,
  -- Set by the database. The first person of a thing (compatibility column) is the
  -- earliest link; at equal time, the order of the members of the household.
  created_at timestamptz not null default now(),
  constraint todo_assignees_pkey primary key (todo_id, member_id),
  constraint todo_assignees_todo_fkey foreign key (todo_id, household_id)
    references public.todos (id, household_id) on delete cascade,
  constraint todo_assignees_member_fkey foreign key (member_id, household_id)
    references public.household_members (id, household_id) on delete cascade
);

-- The primary key (todo_id, member_id) indexes the thing side; these index the other
-- foreign keys (cascade when a member leaves or the household is deleted) and the search
-- by person.
create index todo_assignees_member_id_idx on public.todo_assignees (member_id, todo_id);
create index todo_assignees_household_id_idx on public.todo_assignees (household_id);

alter table public.todo_assignees enable row level security;

-- ---------------------------------------------------------------------------
-- deadline_assignees
-- ---------------------------------------------------------------------------
create table public.deadline_assignees (
  deadline_id uuid not null,
  member_id uuid not null,
  -- The app may omit it: the household of the caller.
  household_id uuid not null default public.current_household_id()
    references public.households (id) on delete cascade,
  -- Set by the database (same rule as todo_assignees).
  created_at timestamptz not null default now(),
  constraint deadline_assignees_pkey primary key (deadline_id, member_id),
  constraint deadline_assignees_deadline_fkey foreign key (deadline_id, household_id)
    references public.deadlines (id, household_id) on delete cascade,
  constraint deadline_assignees_member_fkey foreign key (member_id, household_id)
    references public.household_members (id, household_id) on delete cascade
);

create index deadline_assignees_member_id_idx on public.deadline_assignees (member_id, deadline_id);
create index deadline_assignees_household_id_idx on public.deadline_assignees (household_id);

alter table public.deadline_assignees enable row level security;

-- ---------------------------------------------------------------------------
-- shopping_item_assignees
-- ---------------------------------------------------------------------------
create table public.shopping_item_assignees (
  shopping_item_id uuid not null,
  member_id uuid not null,
  -- The app may omit it: the household of the caller.
  household_id uuid not null default public.current_household_id()
    references public.households (id) on delete cascade,
  -- Set by the database.
  created_at timestamptz not null default now(),
  constraint shopping_item_assignees_pkey primary key (shopping_item_id, member_id),
  constraint shopping_item_assignees_item_fkey foreign key (shopping_item_id, household_id)
    references public.shopping_items (id, household_id) on delete cascade,
  constraint shopping_item_assignees_member_fkey foreign key (member_id, household_id)
    references public.household_members (id, household_id) on delete cascade
);

create index shopping_item_assignees_member_id_idx
  on public.shopping_item_assignees (member_id, shopping_item_id);
create index shopping_item_assignees_household_id_idx
  on public.shopping_item_assignees (household_id);

alter table public.shopping_item_assignees enable row level security;

-- ---------------------------------------------------------------------------
-- The items removed by a strappo keep their people for «Annulla» (#335 CA-31): the ids
-- of the members, in their order. Only references to members that already exist; the
-- rows go with the 10 minute window as before (pg_cron job purge-removed-shopping-items).
-- restore_shopping_items() puts back only those still adults or children of the household.
-- ---------------------------------------------------------------------------
alter table private.removed_shopping_items
  add column assignee_member_ids uuid[] not null default '{}';
