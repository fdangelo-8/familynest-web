-- Issue #229 (for page #39 «Notifiche»): the notifications, one row per recipient, and the
-- private record of the additions to the shopping list used by the job of 19:00.
--
-- RLS is enabled here, in the same migration that creates each table. Policies and grants
-- are in the notifications_policies_and_grants migration: until then RLS denies every row
-- to the API roles.
--
-- Who writes: only the database (triggers on todos, events, event_exceptions and
-- shopping_items, and the scheduled jobs), never the app (no insert, update or delete
-- privilege for the API roles). The page reads its own rows and marks them read with
-- mark_notifications_read() (functions migration).
--
-- Stored personal data (privacy skill, requirement of #39 §9): only references and numbers.
-- Who receives it, the kind, who acted, which thing to do / deadline / event, the day of
-- one occurrence, the evening and the start of the window «Liberi insieme», how many days
-- before a deadline, how many things were added to the shopping list, when it was created
-- and when it was read. No free text of any kind: titles, notes and names are read from
-- the tables of origin when the page opens, with the permissions of the reader. Nothing
-- about children beyond what the adults already wrote in their titles.
--
-- Same-household rule without triggers: every reference goes through a composite foreign
-- key that includes household_id, so a notification never points to a member, a thing to
-- do, a deadline or an event of another household.
-- `on delete cascade` everywhere (requirement of #39 §9, comment of the coordinator on
-- #229, CA-48): a notification goes when its recipient leaves the household, is removed or
-- deletes the account, when the person who acted leaves the household (its notifications
-- are never shown again), when the thing to do, the deadline or the event is deleted, and
-- when the household is deleted. The daily job deletes those older than 30 days.

-- ---------------------------------------------------------------------------
-- Targets of the composite foreign keys (thing to do, household) and (deadline,
-- household). id is already unique: this only lets the notifications check that the
-- thing to do or the deadline belongs to their household (events already have
-- events_id_household_key).
-- ---------------------------------------------------------------------------
alter table public.todos
  add constraint todos_id_household_key unique (id, household_id);

alter table public.deadlines
  add constraint deadlines_id_household_key unique (id, household_id);

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  -- Who receives it: always an adult with an account of the household (checked by the
  -- functions that write, the only writers).
  recipient_member_id uuid not null,
  kind public.notification_kind not null,
  -- Who acted (assigned, changed the time, added to the shopping list). Null for the
  -- notifications of the app (deadlines, «Liberi insieme»).
  actor_member_id uuid,
  -- The element of origin, by kind.
  todo_id uuid,
  deadline_id uuid,
  event_id uuid,
  -- event_time_changed of one occurrence only: the day of that occurrence in the series
  -- (occurrence_date of event_exceptions). Null when the whole series changed.
  occurrence_date date,
  -- deadline_reminder: which reminder (30, 7, 1 days before, or 0 = the day itself).
  days_before smallint,
  -- free_together: the evening (Europe/Rome) and the start of its window when the
  -- notification was created (the text keeps that time, requirement §4).
  evening_date date,
  free_from timestamptz,
  -- shopping_added: how many things the person added in the 24 hours before the job.
  item_count integer,
  -- Null = not read.
  read_at timestamptz,
  created_at timestamptz not null default now(),
  -- Day of creation in Europe/Rome: the unit of the idempotency of the jobs (unique
  -- indexes below).
  created_on date generated always as ((created_at at time zone 'Europe/Rome')::date) stored,
  updated_at timestamptz not null default now(),

  constraint notifications_recipient_fkey foreign key (recipient_member_id, household_id)
    references public.household_members (id, household_id) on delete cascade,
  constraint notifications_actor_fkey foreign key (actor_member_id, household_id)
    references public.household_members (id, household_id) on delete cascade,
  constraint notifications_todo_fkey foreign key (todo_id, household_id)
    references public.todos (id, household_id) on delete cascade,
  constraint notifications_deadline_fkey foreign key (deadline_id, household_id)
    references public.deadlines (id, household_id) on delete cascade,
  constraint notifications_event_fkey foreign key (event_id, household_id)
    references public.events (id, household_id) on delete cascade,

  -- Nobody is notified of what they did themselves.
  constraint notifications_not_own_action check (actor_member_id is distinct from recipient_member_id),
  -- Exactly the fields of each kind, nothing else.
  constraint notifications_kind_fields check (
    case kind
      when 'todo_assigned' then
        actor_member_id is not null and todo_id is not null
        and num_nonnulls(deadline_id, event_id, occurrence_date, days_before, evening_date, free_from, item_count) = 0
      when 'deadline_reminder' then
        deadline_id is not null and days_before is not null
        and num_nonnulls(actor_member_id, todo_id, event_id, occurrence_date, evening_date, free_from, item_count) = 0
      when 'free_together' then
        evening_date is not null and free_from is not null
        and num_nonnulls(actor_member_id, todo_id, deadline_id, event_id, occurrence_date, days_before, item_count) = 0
      when 'event_time_changed' then
        actor_member_id is not null and event_id is not null
        and num_nonnulls(todo_id, deadline_id, days_before, evening_date, free_from, item_count) = 0
      when 'shopping_added' then
        actor_member_id is not null and item_count is not null
        and num_nonnulls(todo_id, deadline_id, event_id, occurrence_date, days_before, evening_date, free_from) = 0
      else false
    end
  ),
  constraint notifications_days_before_valid check (days_before is null or days_before in (30, 7, 1, 0)),
  -- The window of «Liberi insieme» starts on its evening (18:00 – 23:00, Europe/Rome).
  constraint notifications_free_from_on_evening check (
    free_from is null or (free_from at time zone 'Europe/Rome')::date = evening_date
  ),
  constraint notifications_item_count_positive check (item_count is null or item_count >= 1)
);

-- The page reads the notifications of the caller from the most recent (at equal time, by
-- id); the count of the bell reads the same rows. Leading column also indexes the
-- recipient foreign key (cascade when a member leaves) and the RLS policy.
create index notifications_recipient_created_idx
  on public.notifications (recipient_member_id, created_at desc, id desc);
-- Foreign keys (cascade when the household, the person who acted or the element of origin
-- is deleted).
create index notifications_household_id_idx on public.notifications (household_id);
create index notifications_actor_member_id_idx
  on public.notifications (actor_member_id) where actor_member_id is not null;
create index notifications_todo_id_idx on public.notifications (todo_id) where todo_id is not null;
create index notifications_deadline_id_idx on public.notifications (deadline_id) where deadline_id is not null;
create index notifications_event_id_idx on public.notifications (event_id) where event_id is not null;
-- Daily cleanup of the notifications older than 30 days, across households.
create index notifications_created_at_idx on public.notifications (created_at);

-- Idempotency of the jobs (requirement §4: a job run again the same day never duplicates):
-- - one reminder per deadline, reminder, recipient and day;
-- - «Liberi insieme»: one per evening and recipient (never twice for the same evening),
--   and at most one per day and recipient;
-- - shopping: one per person who added, recipient and day.
create unique index notifications_deadline_reminder_key
  on public.notifications (recipient_member_id, deadline_id, days_before, created_on)
  where kind = 'deadline_reminder';
create unique index notifications_free_together_evening_key
  on public.notifications (recipient_member_id, evening_date)
  where kind = 'free_together';
create unique index notifications_free_together_day_key
  on public.notifications (recipient_member_id, created_on)
  where kind = 'free_together';
create unique index notifications_shopping_added_key
  on public.notifications (recipient_member_id, actor_member_id, created_on)
  where kind = 'shopping_added';

alter table public.notifications enable row level security;

-- ---------------------------------------------------------------------------
-- private.shopping_additions: when each member added something to the shopping list,
-- so that the job of 19:00 counts the additions of the last 24 hours also when the items
-- were taken, removed or cancelled in the meantime (requirement §4, CA-20). Only who and
-- when: no name, no quantity, no item. Written by a trigger on shopping_items (functions
-- migration), deleted after 2 days by the daily cleanup job. The "private" schema is not
-- exposed by the Data API and the app has no privilege on this table.
-- ---------------------------------------------------------------------------
create table private.shopping_additions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  member_id uuid not null,
  created_at timestamptz not null default now(),
  constraint shopping_additions_member_fkey foreign key (member_id, household_id)
    references public.household_members (id, household_id) on delete cascade
);

-- Additions of a household in a period (job of 19:00); leading column also indexes the
-- household_id foreign key.
create index shopping_additions_household_created_idx
  on private.shopping_additions (household_id, created_at);
-- Composite foreign key towards household_members (cascade when a member leaves).
create index shopping_additions_member_id_idx on private.shopping_additions (member_id);
-- Cleanup of the old rows.
create index shopping_additions_created_at_idx on private.shopping_additions (created_at);

-- No policy: even with a privilege, an API role would read and write 0 rows.
alter table private.shopping_additions enable row level security;
