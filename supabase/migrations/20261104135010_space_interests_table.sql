-- Issue #216 (for page #29 «Esplora · Uno spazio in arrivo»): the «Avvisami quando è
-- pronto» of the spaces of Esplora. One row means «this member wants to be told when this
-- space is ready». In v1 it only records the interest: no mail, no channel, no
-- notification (issue #29, question 5). The numbers per space are read only by Francesco
-- with space_interest_counts() (functions migration).
--
-- Built like pinned_spaces (#187) and independent from it: registering an interest never
-- pins the space, pinning never registers an interest.
-- Interests are personal (issue #29, question 8): only the member who registered a row
-- reads it; the other adults of the same household never see it.
--
-- RLS is enabled here, in the same migration that creates the table. Policies and grants
-- are in the space_interests_policies_and_grants migration: until then RLS denies every
-- row to the API roles.
-- The member and the household of the caller, the registration time and the availability
-- of the space are enforced by the before insert trigger in the
-- space_interests_functions_and_triggers migration. Rows are never updated: an interest
-- is registered (insert) or removed (delete). No limit on the number (at most ten, one per
-- space).
--
-- Same-household rule without triggers: the member goes through the composite foreign key
-- household_members (id, household_id), as pinned_spaces, todos and events do.
-- `on delete cascade`: a member who leaves the household, is removed or deletes the
-- account loses their interests.
--
-- Stored personal data (privacy skill): which member registered which of the 10 spaces
-- and when. No free text, no email, nothing new about people or children.

create table public.space_interests (
  id uuid primary key default gen_random_uuid(),
  -- The app never sends it: the household of the caller.
  household_id uuid not null default public.current_household_id()
    references public.households (id) on delete cascade,
  -- The member of the caller (always an adult with an account), set by the database.
  member_id uuid not null,
  space public.space_key not null,
  -- Set by the database, never by the app. Rows are never changed: no updated_at.
  created_at timestamptz not null default clock_timestamp(),

  constraint space_interests_member_fkey foreign key (member_id, household_id)
    references public.household_members (id, household_id) on delete cascade,
  -- A member registers a space at most once (also the arbiter of add_space_interest()).
  constraint space_interests_member_space_key unique (member_id, space)
);

-- Composite foreign key towards household_members (cascade when a member leaves); also
-- used by the RLS policies.
create index space_interests_member_household_idx
  on public.space_interests (member_id, household_id);
-- Foreign key towards households (cascade when a household is deleted).
create index space_interests_household_id_idx on public.space_interests (household_id);

alter table public.space_interests enable row level security;
