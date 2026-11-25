-- Issue #510 (DB-1 «Impegni 2.0», plan #501): what the sheet «Nuovo impegno» (A2 #535),
-- the detail (A3 #536) and the calendar (A4–A6) show and ask, stored with the events.
--
-- 1. events: «Tutto il giorno», «Lo riprende», «Da decidere» for the way there and back,
--    «Avviso», «Avvisa chi porta e chi riprende», «Da verificare»; the repetition rules of
--    the new values of event_recurrence (daily, biweekly, yearly).
-- 2. event_exceptions: «Lo riprende» and «Da decidere» of one occurrence («Una volta sola
--    si cambia dall'impegno di quel giorno»).
-- 3. event_viewers: the people chosen with «Chi lo vede» → «Solo alcune persone».
-- 4. profiles.default_event_visibility and external_calendars.visibility are never
--    «Solo alcune persone» (it needs people chosen for each event).
--
-- RLS is enabled on event_viewers here, in the same migration that creates it. Policies
-- and grants are in the events_2_policies_and_grants migration: until then RLS denies
-- every row to the API roles. Rules that depend on other rows (who may set «Lo riprende»,
-- only adults chosen, «Da verificare» that only gets shorter) are triggers in the
-- events_2_functions_and_triggers migration.
--
-- Same-household rule without triggers: every new reference to a member or an event goes
-- through a composite foreign key that includes household_id.
--
-- Stored personal data (privacy skill): only references to members already in the
-- household (who picks up, who is chosen) and settings. No free text, no health data, no
-- new data about children.

-- ---------------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------------
alter table public.events
  -- «Tutto il giorno» (ap1-36): from 0:00 (Europe/Rome) of the first day to 0:00 of the
  -- day after the last one, like the imported events «tutto il giorno». Never counts for
  -- «Liberi insieme» nor for the overlapping events.
  add column all_day boolean not null default false,
  -- «Lo riprende» (ap1-39, cb1-01): an adult of the same household (trigger), optional;
  -- may be the same person as escort_member_id («Lo porta»).
  add column pickup_member_id uuid,
  -- «Da decidere» on the way there («Lo porta») and back («Lo riprende»): nobody chosen
  -- yet, on purpose. Never together with a person (checks below).
  add column escort_undecided boolean not null default false,
  add column pickup_undecided boolean not null default false,
  -- «Avviso»: minutes before the start; null = no reminder. Who receives it and the
  -- sending are DB-2 (#511).
  add column reminder_minutes_before integer,
  -- «Avvisa chi porta e chi riprende · la sera prima e un'ora prima».
  add column remind_rides boolean not null default false,
  -- «Da verificare» (mn1-25, mn1-26): written only when the event is created; afterwards
  -- the list only gets shorter (trigger, confirm_event_fields()). Sorted, no duplicates.
  add column unverified_fields public.event_field[] not null default '{}';

alter table public.events
  add constraint events_pickup_fkey foreign key (pickup_member_id, household_id)
    references public.household_members (id, household_id) on delete set null (pickup_member_id),
  add constraint events_escort_or_undecided check (not (escort_undecided and escort_member_id is not null)),
  add constraint events_pickup_or_undecided check (not (pickup_undecided and pickup_member_id is not null)),
  add constraint events_reminder_minutes_range check (
    reminder_minutes_before is null or reminder_minutes_before between 1 and 10080
  ),
  add constraint events_unverified_fields_valid check (
    array_position(unverified_fields, null) is null
    and cardinality(unverified_fields) <= 5
  ),
  -- «Tutto il giorno»: starts and ends at 0:00 of Europe/Rome (the end is after the start:
  -- events_ends_after_starts).
  add constraint events_all_day_bounds check (
    not all_day
    or (
      (starts_at at time zone 'Europe/Rome')::time = time '00:00'
      and (ends_at at time zone 'Europe/Rome')::time = time '00:00'
    )
  ),
  -- «Ogni giorno»: one occurrence lasts at most one day (24 hours; an event «tutto il
  -- giorno» of one day, also on the days of the change of the clock).
  add constraint events_daily_duration check (
    recurrence <> 'daily'
    or case
      when all_day then (ends_at at time zone 'Europe/Rome')::date - (starts_at at time zone 'Europe/Rome')::date <= 1
      else ends_at - starts_at <= interval '24 hours'
    end
  );

-- The days of the week belong to «Ogni settimana» and «Ogni due settimane» (it was weekly
-- only). Same name, same error for the existing pages.
alter table public.events
  drop constraint events_weekdays_only_weekly;
alter table public.events
  add constraint events_weekdays_only_weekly check (
    (recurrence in ('weekly', 'biweekly')) = (recurrence_weekdays is not null)
  );

-- A repeated event lasts at most 7 days (unchanged); an event «tutto il giorno» at most 7
-- days of the calendar, also when the clock changes in between. Same name.
alter table public.events
  drop constraint events_repeated_duration;
alter table public.events
  add constraint events_repeated_duration check (
    recurrence = 'none'
    or ends_at - starts_at <= interval '7 days'
    or (
      all_day
      and (ends_at at time zone 'Europe/Rome')::date - (starts_at at time zone 'Europe/Rome')::date <= 7
    )
  );

-- Foreign key towards household_members (also used by the RLS policies).
create index events_pickup_member_id_idx on public.events (pickup_member_id);

-- ---------------------------------------------------------------------------
-- event_exceptions: the same three values for one occurrence. A removed occurrence has
-- none of them (normalised by the trigger, checked here).
-- ---------------------------------------------------------------------------
alter table public.event_exceptions
  -- «Lo riprende» of this occurrence: an adult of the household who already sees the
  -- event in full (trigger), or null.
  add column pickup_member_id uuid,
  add column escort_undecided boolean not null default false,
  add column pickup_undecided boolean not null default false;

alter table public.event_exceptions
  add constraint event_exceptions_pickup_fkey foreign key (pickup_member_id, household_id)
    references public.household_members (id, household_id) on delete set null (pickup_member_id),
  add constraint event_exceptions_escort_or_undecided check (not (escort_undecided and escort_member_id is not null)),
  add constraint event_exceptions_pickup_or_undecided check (not (pickup_undecided and pickup_member_id is not null)),
  add constraint event_exceptions_cancelled_rides check (
    not is_cancelled or (pickup_member_id is null and not escort_undecided and not pickup_undecided)
  );

create index event_exceptions_pickup_member_id_idx on public.event_exceptions (pickup_member_id);

-- ---------------------------------------------------------------------------
-- event_viewers: «Solo alcune persone» (ap1-40). The chosen adults of the household see
-- the event in full, like its author and the people involved; everybody else sees it as
-- «Occupato». Only events «Solo alcune persone» have rows (trigger); only adults are
-- chosen (trigger); only the author chooses (policies). No update: a person is removed
-- and added again. Leaving the household removes the person (foreign key); when the
-- author leaves, the event is deleted with its rows (as every «Occupato» of theirs).
-- ---------------------------------------------------------------------------
create table public.event_viewers (
  event_id uuid not null,
  member_id uuid not null,
  -- The app may omit it: the household of the caller.
  household_id uuid not null default public.current_household_id()
    references public.households (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint event_viewers_pkey primary key (event_id, member_id),
  constraint event_viewers_event_fkey foreign key (event_id, household_id)
    references public.events (id, household_id) on delete cascade,
  constraint event_viewers_member_fkey foreign key (member_id, household_id)
    references public.household_members (id, household_id) on delete cascade
);

-- The primary key (event_id, member_id) indexes the event side; these index the other
-- foreign keys and the "am I chosen" check of the policies.
create index event_viewers_member_id_idx on public.event_viewers (member_id, event_id);
create index event_viewers_household_id_idx on public.event_viewers (household_id);

alter table public.event_viewers enable row level security;

-- ---------------------------------------------------------------------------
-- «Solo alcune persone» needs people chosen for each event: never a default.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add constraint profiles_default_event_visibility_not_selected check (default_event_visibility <> 'selected');

alter table public.external_calendars
  add constraint external_calendars_visibility_not_selected check (visibility <> 'selected');
