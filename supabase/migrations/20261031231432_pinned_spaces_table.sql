-- Issue #187 (for pages #28 Esplora, #29 «In arrivo», #30 Oggi): the spaces pinned by
-- each adult with an account («I tuoi spazi» at the bottom of Oggi). One row means
-- «this member has pinned this space».
--
-- Pinned spaces are personal (issue #28, question 1): only the member who pinned a space
-- reads its row; the other adults of the same household never see it.
--
-- RLS is enabled here, in the same migration that creates the table. Policies and grants
-- are in the pinned_spaces_policies_and_grants migration: until then RLS denies every row
-- to the API roles.
-- The member and the household of the caller, the pin time, the availability of the
-- space and the limit of six are enforced by the before insert trigger in the
-- pinned_spaces_functions_and_triggers migration. Rows are never updated: a space is
-- pinned (insert) or unpinned (delete).
--
-- Same-household rule without triggers: the member goes through the composite foreign
-- key household_members (id, household_id), as todos and events do, so a row can never
-- point to a member of another household. `on delete cascade`: a member who leaves the
-- household, is removed or deletes the account loses their pinned spaces.
--
-- Stored personal data (privacy skill): which member pinned which of the 10 spaces and
-- when. No free text, nothing new about people or children.

create table public.pinned_spaces (
  id uuid primary key default gen_random_uuid(),
  -- The app never sends it: the household of the caller.
  household_id uuid not null default public.current_household_id()
    references public.households (id) on delete cascade,
  -- The member of the caller (always an adult with an account), set by the database.
  member_id uuid not null,
  space public.space_key not null,
  -- Set by the database, never by the app: the order of «I tuoi spazi» (oldest first).
  -- clock_timestamp(): two spaces pinned in the same transaction keep their order.
  -- Rows are never changed, so this is also the creation time of the row.
  pinned_at timestamptz not null default clock_timestamp(),

  constraint pinned_spaces_member_fkey foreign key (member_id, household_id)
    references public.household_members (id, household_id) on delete cascade,
  -- A member pins a space at most once (also the arbiter of pin_space()).
  constraint pinned_spaces_member_space_key unique (member_id, space)
);

-- Composite foreign key towards household_members (cascade when a member leaves) and the
-- read of «I tuoi spazi» in pin order; also used by the RLS policies.
create index pinned_spaces_member_household_idx
  on public.pinned_spaces (member_id, household_id, pinned_at);
-- Foreign key towards households (cascade when a household is deleted).
create index pinned_spaces_household_id_idx on public.pinned_spaces (household_id);

alter table public.pinned_spaces enable row level security;
