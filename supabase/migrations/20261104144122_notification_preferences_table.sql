-- Issue #217 (for page #41 «Impostazioni della casa»): the notification choices of an
-- adult with an account. At most one row per member, with five on/off choices.
--
-- No row means «never chosen»: the defaults of the columns apply (all on, «Spesa» off),
-- and get_notification_preferences() returns them without writing anything (CA-15: the
-- page only reads). The row is created by the first switch the adult touches, through
-- set_notification_preference() (functions migration).
-- The notifications themselves are not sent yet (#39 will read these choices).
--
-- Choices are personal (issue #41, question 1): only the member who owns the row reads
-- and changes it; the other adults of the same household (administrators included) never
-- see it.
--
-- RLS is enabled here, in the same migration that creates the table. Policies and grants
-- are in the notification_preferences_policies_and_grants migration: until then RLS
-- denies every row to the API roles.
-- The member and the household of the caller are set by the before insert trigger in the
-- notification_preferences_functions_and_triggers migration: the app never sends them.
--
-- Same-household rule without triggers: the member goes through the composite foreign key
-- household_members (id, household_id), as space_interests, pinned_spaces and todos do.
-- `on delete cascade`: the row goes when the member leaves the household, is removed or
-- deletes the account, and when the household is deleted.
--
-- Stored personal data (privacy skill): five on/off choices of an adult. No free text, no
-- email, no channel, nothing about children.

create table public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  -- The app never sends it: the household of the caller.
  household_id uuid not null default public.current_household_id()
    references public.households (id) on delete cascade,
  -- The member of the caller (always an adult with an account), set by the database.
  member_id uuid not null,
  -- «Impegni e cambi d'orario»
  events boolean not null default true,
  -- «Da fare assegnati a me»
  assigned_todos boolean not null default true,
  -- «Spesa» (grouped, once a day): off by default (mockup 28).
  shopping boolean not null default false,
  -- «Liberi insieme»
  free_together boolean not null default true,
  -- «Sintesi del mattino»
  morning_digest boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint notification_preferences_member_fkey foreign key (member_id, household_id)
    references public.household_members (id, household_id) on delete cascade,
  -- One row per member (also the arbiter of set_notification_preference()). Its index
  -- has member_id as leading column: it serves the composite foreign key (cascade when a
  -- member leaves) and the RLS policies.
  constraint notification_preferences_member_id_key unique (member_id)
);

-- Foreign key towards households (cascade when a household is deleted).
create index notification_preferences_household_id_idx
  on public.notification_preferences (household_id);

alter table public.notification_preferences enable row level security;
