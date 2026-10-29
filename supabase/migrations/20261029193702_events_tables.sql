-- Issue #86 (for pages #20 Aggiungi · Impegni, #25 Calendario · Settimana, #30 Oggi):
-- the events of the household ("impegni") and the people involved in each of them.
--
-- RLS is enabled here, in the same migration that creates each table. Policies and
-- grants are in the events_policies_and_grants migration: until then RLS denies every
-- row to the API roles.
-- Text normalisation, the author of an event, the escort rule and the cleanup when a
-- member leaves are enforced by triggers in the events_functions_and_triggers migration.
--
-- Same-household rule without triggers: every reference to a member or an event goes
-- through a composite foreign key that includes household_id, so a row can never point
-- to a member or an event of another household.
--
-- Not stored (data minimisation): notes, reminders, exceptions of the repetitions and the
-- linked calendar of origin. They arrive with their own pages (#19, #34) and migrations.

-- Target of the composite foreign keys (member, household). id is already unique: this
-- only lets other tables check that a member belongs to their household.
alter table public.household_members
  add constraint household_members_id_household_key unique (id, household_id);

-- ---------------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  -- The app may omit it: the household of the caller.
  household_id uuid not null default public.current_household_id()
    references public.households (id) on delete cascade,
  -- Member who created the event, set by the database (never chosen by the app).
  -- Null only for «Tutto il Nest» events whose author has left the household: their
  -- «Solo io» and «Occupato» events are deleted when they leave.
  author_member_id uuid,
  title text not null,
  location text,
  -- UTC instants. A repeated event stores its first occurrence; the others keep the
  -- same local time in Europe/Rome and the same duration.
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  visibility public.event_visibility not null,
  -- Who accompanies («La porta»): an adult of the same household (trigger), optional.
  escort_member_id uuid,
  recurrence public.event_recurrence not null default 'none',
  -- Weekly only: ISO days of the week (1 = Monday … 7 = Sunday), sorted, no duplicates.
  recurrence_weekdays smallint[],
  -- Last day (Europe/Rome, included) on which the event may repeat; null = no end.
  recurrence_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Target of the composite foreign key of event_members.
  constraint events_id_household_key unique (id, household_id),
  constraint events_author_fkey foreign key (author_member_id, household_id)
    references public.household_members (id, household_id) on delete set null (author_member_id),
  constraint events_escort_fkey foreign key (escort_member_id, household_id)
    references public.household_members (id, household_id) on delete set null (escort_member_id),

  -- Stored normalised: no leading/trailing whitespace, inner whitespace runs become one space.
  constraint events_title_normalized check (title = btrim(regexp_replace(title, '\s+', ' ', 'g'))),
  constraint events_title_length check (char_length(title) between 1 and 100),
  constraint events_location_normalized check (
    location is null or location = btrim(regexp_replace(location, '\s+', ' ', 'g'))
  ),
  constraint events_location_length check (location is null or char_length(location) between 1 and 100),
  constraint events_ends_after_starts check (ends_at > starts_at),
  -- «Solo io» and «Occupato» always belong to someone.
  constraint events_author_required check (author_member_id is not null or visibility = 'household'),

  -- Repetition rules.
  constraint events_weekdays_only_weekly check ((recurrence = 'weekly') = (recurrence_weekdays is not null)),
  constraint events_weekdays_valid check (
    recurrence_weekdays is null
    or (
      cardinality(recurrence_weekdays) between 1 and 7
      and array_position(recurrence_weekdays, null) is null
      and recurrence_weekdays <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]
    )
  ),
  -- The first occurrence is a real occurrence: its day of the week is one of the days.
  constraint events_weekdays_include_start check (
    recurrence_weekdays is null
    or extract(isodow from starts_at at time zone 'Europe/Rome')::smallint = any (recurrence_weekdays)
  ),
  constraint events_until_only_repeated check (recurrence <> 'none' or recurrence_until is null),
  constraint events_until_after_start check (
    recurrence_until is null or recurrence_until >= (starts_at at time zone 'Europe/Rome')::date
  ),
  -- A repeated event lasts at most 7 days (keeps the expansion of the repetitions bounded).
  constraint events_repeated_duration check (recurrence = 'none' or ends_at - starts_at <= interval '7 days')
);

-- Reading a period of the household (list_household_events). Leading column also
-- indexes the household_id foreign key.
create index events_household_starts_idx on public.events (household_id, starts_at);
-- Foreign keys towards household_members (also used by the RLS policies).
create index events_author_member_id_idx on public.events (author_member_id);
create index events_escort_member_id_idx on public.events (escort_member_id);

alter table public.events enable row level security;

-- ---------------------------------------------------------------------------
-- event_members: the people of the household involved in an event (adults, children,
-- pets). Who accompanies is not a participant: it is events.escort_member_id.
-- ---------------------------------------------------------------------------
create table public.event_members (
  event_id uuid not null,
  member_id uuid not null,
  -- The app may omit it: the household of the caller.
  household_id uuid not null default public.current_household_id()
    references public.households (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint event_members_pkey primary key (event_id, member_id),
  constraint event_members_event_fkey foreign key (event_id, household_id)
    references public.events (id, household_id) on delete cascade,
  constraint event_members_member_fkey foreign key (member_id, household_id)
    references public.household_members (id, household_id) on delete cascade
);

-- The primary key (event_id, member_id) indexes the event side; these index the other
-- foreign keys and the "am I a participant" check of the policies.
create index event_members_member_id_idx on public.event_members (member_id, event_id);
create index event_members_household_id_idx on public.event_members (household_id);

alter table public.event_members enable row level security;
