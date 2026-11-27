-- Issue #511 (DB-2 «Notifiche 2.0», plan #501), part 2 of 2: columns, tables, constraints
-- and indexes.
--
-- 1. notification_preferences: the switches of cb1-45 (rides, event_reminders, deadlines,
--    gifts) and of the content of the morning digest (mn1-16); «Spesa» on by default
--    (question 3 of #511). Personal as today (#217).
-- 2. profiles: the morning digest at 07:15 by default, on a quarter of an hour from 06:00 to
--    10:00 (rule 2; the profiles with 07:30 already saved keep it, question 7), and when the
--    adult saw its introduction (mn1-17).
-- 3. notifications: the fields of the new kinds (member_joined, event_reminder,
--    ride_reminder, overlap_tomorrow, ride_request) and one unique index per kind for the
--    jobs that run again.
-- 4. private.push_digest_items: the notifications waiting for the evening summary of their
--    recipient («Il riepilogo»), then the summary that carried them.
-- 5. Indexes of the jobs on events (reminders, rides).
--
-- RLS is enabled on the new table here, in the same migration that creates it. Grants are
-- in the notifications_2_part_2_policies_and_grants migration.
--
-- Stored personal data (privacy skill): only switches, a time and references. No free
-- text, nothing new about children (the person of an overlapping event is a reference to a
-- member already in the household, as the other references of the notifications).

-- ===========================================================================
-- 1. notification_preferences
-- ===========================================================================
-- The existing rows get the defaults when the columns are added.
alter table public.notification_preferences
  -- cb1-45: «Viaggi» (ride_reminder, ride_request).
  add column rides boolean not null default true,
  -- cb1-45: «Prima di un tuo impegno» (event_reminder).
  add column event_reminders boolean not null default true,
  -- cb1-45: «Scadenze» (deadline_reminder, until now without switch).
  add column deadlines boolean not null default true,
  -- cb1-45: «Regali» (gift_taken, until now without switch).
  add column gifts boolean not null default true,
  -- «Sintesi del mattino» → «Che cosa c'è dentro» (mn1-16).
  add column digest_events boolean not null default true,
  add column digest_rides boolean not null default true,
  add column digest_deadlines boolean not null default true,
  -- The «grazie» come with DB-22 (#532): the switch is saved already.
  add column digest_thanks boolean not null default true,
  add column digest_shopping boolean not null default false;

-- «Cose aggiunte alla spesa»: on in cb1-45 (question 3 of #511). Only the default changes:
-- an adult who already saved a choice keeps it.
alter table public.notification_preferences
  alter column shopping set default true;

-- ===========================================================================
-- 2. profiles
-- ===========================================================================
-- «Sintesi del mattino»: 07:15 for the new profiles (mn1-16). The existing profiles keep
-- the time they have (question 7 of #511).
alter table public.profiles
  alter column morning_digest_time set default '07:15';

-- Every quarter of an hour from 06:00 to 10:00 (rule 2 of #511), instead of every half
-- hour. Same name: same error (23514) for the pages. Every saved value (half hours) is
-- still allowed.
alter table public.profiles
  drop constraint profiles_morning_digest_time_allowed;
alter table public.profiles
  add constraint profiles_morning_digest_time_allowed check (
    private.is_quarter_hour_between(morning_digest_time, '06:00', '10:00')
  );

alter table public.profiles
  -- When the adult saw the introduction of the morning digest (mn1-17): written once, by
  -- mark_morning_digest_intro_seen() only.
  add column morning_digest_intro_seen_at timestamptz;

-- ===========================================================================
-- 3. notifications
-- ===========================================================================
alter table public.notifications
  -- ride_reminder, ride_request: which way of the ride.
  add column ride_leg public.ride_leg,
  -- overlap_tomorrow: the other occurrence (event_id and occurrence_date are the first).
  add column other_event_id uuid,
  add column other_occurrence_date date,
  -- overlap_tomorrow: the person who is in both occurrences.
  add column subject_member_id uuid;

-- Same-household rule without triggers, on delete cascade as every other reference: the
-- notification goes with the other event and with the person.
alter table public.notifications
  add constraint notifications_other_event_fkey foreign key (other_event_id, household_id)
    references public.events (id, household_id) on delete cascade,
  add constraint notifications_subject_fkey foreign key (subject_member_id, household_id)
    references public.household_members (id, household_id) on delete cascade;

create index notifications_other_event_id_idx
  on public.notifications (other_event_id) where other_event_id is not null;
create index notifications_subject_member_id_idx
  on public.notifications (subject_member_id) where subject_member_id is not null;

-- Exactly the fields of each kind, nothing else (same rules as before for the six kinds of
-- #229 and #259, plus the five of #511). The occurrences are given by the event and the day
-- on which the occurrence starts in the series (as event_exceptions.occurrence_date).
alter table public.notifications
  drop constraint notifications_kind_fields;

alter table public.notifications
  add constraint notifications_kind_fields check (
    case kind
      when 'todo_assigned' then
        actor_member_id is not null and todo_id is not null
        and num_nonnulls(deadline_id, event_id, occurrence_date, days_before, evening_date, free_from, item_count,
                         wishlist_reservation_id, ride_leg, other_event_id, other_occurrence_date,
                         subject_member_id) = 0
      when 'deadline_reminder' then
        deadline_id is not null and days_before is not null
        and num_nonnulls(actor_member_id, todo_id, event_id, occurrence_date, evening_date, free_from, item_count,
                         wishlist_reservation_id, ride_leg, other_event_id, other_occurrence_date,
                         subject_member_id) = 0
      when 'free_together' then
        evening_date is not null and free_from is not null
        and num_nonnulls(actor_member_id, todo_id, deadline_id, event_id, occurrence_date, days_before, item_count,
                         wishlist_reservation_id, ride_leg, other_event_id, other_occurrence_date,
                         subject_member_id) = 0
      when 'event_time_changed' then
        actor_member_id is not null and event_id is not null
        and num_nonnulls(todo_id, deadline_id, days_before, evening_date, free_from, item_count,
                         wishlist_reservation_id, ride_leg, other_event_id, other_occurrence_date,
                         subject_member_id) = 0
      when 'shopping_added' then
        actor_member_id is not null and item_count is not null
        and num_nonnulls(todo_id, deadline_id, event_id, occurrence_date, days_before, evening_date, free_from,
                         wishlist_reservation_id, ride_leg, other_event_id, other_occurrence_date,
                         subject_member_id) = 0
      when 'gift_taken' then
        wishlist_reservation_id is not null
        and num_nonnulls(actor_member_id, todo_id, deadline_id, event_id, occurrence_date, days_before,
                         evening_date, free_from, item_count, ride_leg, other_event_id, other_occurrence_date,
                         subject_member_id) = 0
      -- Who entered the household.
      when 'member_joined' then
        actor_member_id is not null
        and num_nonnulls(todo_id, deadline_id, event_id, occurrence_date, days_before, evening_date, free_from,
                         item_count, wishlist_reservation_id, ride_leg, other_event_id, other_occurrence_date,
                         subject_member_id) = 0
      -- The occurrence of the event.
      when 'event_reminder' then
        event_id is not null and occurrence_date is not null
        and num_nonnulls(actor_member_id, todo_id, deadline_id, days_before, evening_date, free_from, item_count,
                         wishlist_reservation_id, ride_leg, other_event_id, other_occurrence_date,
                         subject_member_id) = 0
      -- The occurrence, the way, the evening before (1) or an hour before (0).
      when 'ride_reminder' then
        event_id is not null and occurrence_date is not null and ride_leg is not null
        and days_before in (0, 1)
        and num_nonnulls(actor_member_id, todo_id, deadline_id, evening_date, free_from, item_count,
                         wishlist_reservation_id, other_event_id, other_occurrence_date, subject_member_id) = 0
      -- The two occurrences (always in the same order: the pair is written once) and the
      -- person in both.
      when 'overlap_tomorrow' then
        event_id is not null and occurrence_date is not null
        and other_event_id is not null and other_occurrence_date is not null
        and subject_member_id is not null
        and (event_id, occurrence_date) < (other_event_id, other_occurrence_date)
        and num_nonnulls(actor_member_id, todo_id, deadline_id, days_before, evening_date, free_from, item_count,
                         wishlist_reservation_id, ride_leg) = 0
      -- Who asks, the occurrence and the way.
      when 'ride_request' then
        actor_member_id is not null and event_id is not null and occurrence_date is not null
        and ride_leg is not null
        and num_nonnulls(todo_id, deadline_id, days_before, evening_date, free_from, item_count,
                         wishlist_reservation_id, other_event_id, other_occurrence_date, subject_member_id) = 0
      else false
    end
  );

-- Idempotency (rule 4 of #511: the jobs run again without duplicates):
-- - one member_joined per recipient and person who entered;
-- - one reminder per recipient and occurrence;
-- - one ride reminder per recipient, occurrence, way and moment (evening before, hour
--   before);
-- - one overlap per recipient, person and pair of occurrences;
-- - one ride request a day per recipient, occurrence and way, whoever asks.
create unique index notifications_member_joined_key
  on public.notifications (recipient_member_id, actor_member_id)
  where kind = 'member_joined';
create unique index notifications_event_reminder_key
  on public.notifications (recipient_member_id, event_id, occurrence_date)
  where kind = 'event_reminder';
create unique index notifications_ride_reminder_key
  on public.notifications (recipient_member_id, event_id, occurrence_date, ride_leg, days_before)
  where kind = 'ride_reminder';
create unique index notifications_overlap_tomorrow_key
  on public.notifications (recipient_member_id, subject_member_id, event_id, occurrence_date, other_event_id,
                           other_occurrence_date)
  where kind = 'overlap_tomorrow';
create unique index notifications_ride_request_key
  on public.notifications (recipient_member_id, event_id, occurrence_date, ride_leg, created_on)
  where kind = 'ride_request';

-- ===========================================================================
-- 4. private.push_digest_items: what waits for «Il riepilogo»
-- ===========================================================================
-- One row per notification that does not ring at once (rule 5 of #511: «Solo il
-- riepilogo», or not «Tocca a te» with «Subito quelle per me»), for a recipient with at
-- least one device. delivery_id is null while it waits; the evening summary of the
-- recipient takes every waiting row (private.push_digests()). Only references and an
-- instant: no text.
-- On delete cascade: the row goes with its notification, its recipient, its household and
-- the summary that carried it (deleted 2 days after it was closed).
-- The "private" schema is not exposed by the Data API and no API role has a privilege on
-- this table (policies migration); RLS is enabled with no policy.
alter table private.push_deliveries
  add constraint push_deliveries_id_recipient_household_key unique (id, recipient_member_id, household_id);

create table private.push_digest_items (
  notification_id uuid primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  recipient_member_id uuid not null,
  -- The evening summary that carried the notification; null while it waits.
  delivery_id uuid,
  -- When the notification was created (it waits for the first summary after it).
  created_at timestamptz not null,

  constraint push_digest_items_notification_fkey foreign key (notification_id, recipient_member_id, household_id)
    references public.notifications (id, recipient_member_id, household_id) on delete cascade,
  constraint push_digest_items_recipient_fkey foreign key (recipient_member_id, household_id)
    references public.household_members (id, household_id) on delete cascade,
  -- The summary belongs to the same recipient and household.
  constraint push_digest_items_delivery_fkey foreign key (delivery_id, recipient_member_id, household_id)
    references private.push_deliveries (id, recipient_member_id, household_id) on delete cascade
);

-- The waiting rows of a recipient (the evening summary); leading column also indexes the
-- recipient foreign key (cascade when a member leaves).
create index push_digest_items_recipient_idx
  on private.push_digest_items (recipient_member_id, created_at);
create index push_digest_items_delivery_id_idx
  on private.push_digest_items (delivery_id) where delivery_id is not null;
create index push_digest_items_household_id_idx on private.push_digest_items (household_id);

alter table private.push_digest_items enable row level security;

-- ===========================================================================
-- 5. events: the reminders and the rides read by the jobs every 5 minutes
-- ===========================================================================
create index events_reminder_idx
  on public.events (household_id) where reminder_minutes_before is not null;
create index events_remind_rides_idx
  on public.events (household_id) where remind_rides;
