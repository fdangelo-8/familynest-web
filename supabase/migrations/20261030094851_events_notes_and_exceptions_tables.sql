-- Issue #109 (for pages #19 Dettaglio impegno and #20 Aggiungi · Impegni):
-- 1. events.notes: the free notes of an event («Note», mockup 11);
-- 2. event_exceptions: the occurrences of a repeated event that differ from the series,
--    either removed («Elimina solo questo») or changed with their own values («Salva solo
--    questo»), decision of Francesco of 30/10.
--
-- RLS is enabled here, in the same migration that creates the table. Policies and grants
-- are in the events_exceptions_policies_and_grants migration: until then RLS denies every
-- row to the API roles. Normalisation and the guards are triggers in the
-- events_exceptions_functions_and_triggers migration.
--
-- Data minimisation: notes are the only new personal data (requirement of #19 §11). An
-- exception stores only what an occurrence shows differently from its series: it never
-- changes who sees the event (visibility and participants belong to the series, see the
-- functions migration). No health data (D1).

-- ---------------------------------------------------------------------------
-- events.notes
-- ---------------------------------------------------------------------------
alter table public.events
  add column notes text;

-- Stored without leading and trailing whitespace; line breaks and inner spaces stay as
-- written. Null when empty (the normalisation turns an empty text into null).
alter table public.events
  add constraint events_notes_normalized check (
    notes is null or notes = regexp_replace(notes, '^\s+|\s+$', '', 'g')
  ),
  add constraint events_notes_length check (notes is null or char_length(notes) between 1 and 500);

-- ---------------------------------------------------------------------------
-- event_exceptions: at most one row per occurrence of a repeated event.
--
-- An occurrence is identified by occurrence_date, the day (Europe/Rome) on which it starts
-- according to the series. The row is either:
-- - removed:  is_cancelled = true, every value null (the occurrence is not shown);
-- - modified: is_cancelled = false, with the complete values of that occurrence (title,
--             start, end, and place, notes, escort or null). They replace the values of
--             the series for that occurrence only; a later change of the series «Tutti i
--             prossimi» from an earlier day drops them (the occurrence takes the new
--             values of the series).
-- Same-household rule without triggers: composite foreign keys that include household_id.
-- ---------------------------------------------------------------------------
create table public.event_exceptions (
  event_id uuid not null,
  -- The app may omit it: the household of the caller.
  household_id uuid not null default public.current_household_id()
    references public.households (id) on delete cascade,
  occurrence_date date not null,
  is_cancelled boolean not null default false,
  title text,
  location text,
  notes text,
  starts_at timestamptz,
  ends_at timestamptz,
  -- Who accompanies this occurrence («La porta»): an adult of the household who already
  -- sees the event in full (trigger), or null.
  escort_member_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint event_exceptions_pkey primary key (event_id, occurrence_date),
  constraint event_exceptions_event_fkey foreign key (event_id, household_id)
    references public.events (id, household_id) on delete cascade,
  constraint event_exceptions_escort_fkey foreign key (escort_member_id, household_id)
    references public.household_members (id, household_id) on delete set null (escort_member_id),

  constraint event_exceptions_values check (
    (
      is_cancelled
      and title is null and location is null and notes is null
      and starts_at is null and ends_at is null and escort_member_id is null
    )
    or (not is_cancelled and title is not null and starts_at is not null and ends_at is not null)
  ),
  -- Same text rules as events.
  constraint event_exceptions_title_normalized check (
    title is null or title = btrim(regexp_replace(title, '\s+', ' ', 'g'))
  ),
  constraint event_exceptions_title_length check (title is null or char_length(title) between 1 and 100),
  constraint event_exceptions_location_normalized check (
    location is null or location = btrim(regexp_replace(location, '\s+', ' ', 'g'))
  ),
  constraint event_exceptions_location_length check (location is null or char_length(location) between 1 and 100),
  constraint event_exceptions_notes_normalized check (
    notes is null or notes = regexp_replace(notes, '^\s+|\s+$', '', 'g')
  ),
  constraint event_exceptions_notes_length check (notes is null or char_length(notes) between 1 and 500),
  constraint event_exceptions_ends_after_starts check (ends_at > starts_at),
  -- Same limit as a repeated event (events_repeated_duration).
  constraint event_exceptions_duration check (ends_at - starts_at <= interval '7 days')
);

-- The primary key (event_id, occurrence_date) indexes the event side. Reading a period
-- of the household (list_household_events): modified occurrences by start; the leading
-- column also indexes the household_id foreign key.
create index event_exceptions_household_starts_idx
  on public.event_exceptions (household_id, starts_at);
create index event_exceptions_escort_member_id_idx
  on public.event_exceptions (escort_member_id);

alter table public.event_exceptions enable row level security;
