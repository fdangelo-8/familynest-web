-- Issue #229 (for page #39 «Notifiche»): who writes the notifications, what the page reads
-- and the jobs.
--
-- Conventions (same as the other migrations):
-- - every function has `set search_path = ''` and fully qualified names;
-- - helpers, trigger functions and jobs live in the "private" schema (not exposed by the
--   Data API, not in the generated types);
-- - the triggers that write notifications are `security definer` (owner: postgres): the
--   recipients are other members, whose rows the caller cannot write. They trust nothing
--   the app sends: the person who acted is always the member of the verified session
--   (private.current_member_id()); a change made without a session (seed, foreign key
--   actions, jobs, the administrative key) notifies nobody. They write only for adults
--   with an account of the same household, never for the person who acted, and only
--   when the choice of the recipient in notification_preferences is on (defaults of
--   #217 when the recipient never chose);
-- - the page functions refuse every Data API method other than POST when they write
--   (lesson of #112).
-- Execute grants are in the notifications_policies_and_grants migration.
--
-- Errors:
-- - 42501: no signed-in user, or a caller without household (mark_notifications_read);
-- - 22023: invalid arguments (a list of ids with null or with more than 200 ids, a job
--   without instant or with an infinite instant);
-- - P0001 'use POST': called through the Data API with a method other than POST.

create trigger notifications_set_updated_at
  before update on public.notifications
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- True when the member is an adult with an account and their choice for this kind of
-- notification is on. No row in notification_preferences = the defaults of #217 (all on,
-- «Spesa» off), the same as the column defaults and get_notification_preferences() (pgTAP
-- checks the three). p_preference null = a notification without switch (deadlines,
-- decision of the coordinator of 04/11): always on.
create or replace function private.notification_recipient_wants(
  p_member_id uuid,
  p_preference public.notification_preference
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members m
    left join public.notification_preferences p on p.member_id = m.id
    where m.id = p_member_id
      and m.kind = 'adult'
      and m.user_id is not null
      and (
        p_preference is null
        or coalesce(
          case p_preference
            when 'events' then coalesce(p.events, true)
            when 'assigned_todos' then coalesce(p.assigned_todos, true)
            when 'shopping' then coalesce(p.shopping, false)
            when 'free_together' then coalesce(p.free_together, true)
            when 'morning_digest' then coalesce(p.morning_digest, true)
          end,
          false
        )
      )
  );
$$;

-- The member of the verified session, when it belongs to the household (the person who
-- acted), otherwise null. Null without a session. Called only by the security definer
-- triggers below (as the owner).
create or replace function private.notification_actor(p_household_id uuid)
returns uuid
language sql
stable
set search_path = ''
as $$
  select m.id
  from public.household_members m
  where m.user_id = (select auth.uid())
    and m.household_id = p_household_id;
$$;

-- ---------------------------------------------------------------------------
-- What the reader may see (used by the select policy of notifications, evaluated as the
-- reader): a notification is shown and counted only while its element of origin is still
-- readable by the reader with the RLS policies of its table (requirement §4, CA-21, CA-48,
-- comment of the coordinator on #229):
-- - todo_assigned: the thing to do exists and the reader sees it (not deleted, not become
--   «Solo io» of someone else);
-- - deadline_reminder: the deadline exists and the reader sees it;
-- - event_time_changed: the reader sees the event in full (author, escort, participant or
--   «Tutto il Nest»: the select policy of events) and, for one occurrence, that day is
--   still an occurrence of the series and was not removed;
-- - free_together and shopping_added: no element of origin.
-- The notifications of a person who left the household are deleted with them (foreign key
-- on delete cascade). Security invoker: the reads below go through the RLS of the reader.
-- ---------------------------------------------------------------------------
create or replace function private.notification_is_visible(
  p_kind public.notification_kind,
  p_todo_id uuid,
  p_deadline_id uuid,
  p_event_id uuid,
  p_occurrence_date date
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select case p_kind
    when 'todo_assigned' then exists (
      select 1 from public.todos t where t.id = p_todo_id
    )
    when 'deadline_reminder' then exists (
      select 1 from public.deadlines d where d.id = p_deadline_id
    )
    when 'event_time_changed' then exists (
      select 1
      from public.events e
      where e.id = p_event_id
        and (
          p_occurrence_date is null
          or (
            e.recurrence <> 'none'
            and private.event_has_occurrence_on(
              e.starts_at, e.recurrence, e.recurrence_weekdays, e.recurrence_until, p_occurrence_date
            )
            and not exists (
              select 1
              from public.event_exceptions x
              where x.event_id = e.id
                and x.occurrence_date = p_occurrence_date
                and x.is_cancelled
            )
          )
        )
    )
    else true
  end;
$$;

-- ---------------------------------------------------------------------------
-- «Da fare assegnato»: an adult creates a thing to do with an assignee, or changes the
-- assignee. The recipient is the new assignee when it is an adult with an account other
-- than the person who acted, with «Da fare assegnati a me» on (CA-9, CA-10, CA-11).
-- «Solo io» things never notify anybody (their only possible assignee is the author).
-- ---------------------------------------------------------------------------
create or replace function private.todos_notify_assignee()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
begin
  if new.assignee_member_id is null or new.is_private then
    return null;
  end if;
  if tg_op = 'UPDATE' then
    if new.assignee_member_id is not distinct from old.assignee_member_id then
      return null;
    end if;
  end if;

  v_actor := private.notification_actor(new.household_id);
  if v_actor is null or v_actor = new.assignee_member_id then
    return null;
  end if;

  if private.notification_recipient_wants(new.assignee_member_id, 'assigned_todos') then
    insert into public.notifications (household_id, recipient_member_id, kind, actor_member_id, todo_id)
    values (new.household_id, new.assignee_member_id, 'todo_assigned', v_actor, new.id);
  end if;

  return null;
end;
$$;

create trigger todos_notify_assignee
  after insert or update of assignee_member_id on public.todos
  for each row execute function private.todos_notify_assignee();

-- ---------------------------------------------------------------------------
-- «Cambio d'orario» of a whole event or series: start or end changed. The recipients are
-- the adults with an account who see the event in full because they are its author, its
-- escort or one of its participants (requirement §4), except the person who acted, with
-- «Impegni e cambi d'orario» on. Everyone else, in particular whoever sees an «Occupato»
-- of someone else only as busy, is never notified (CA-16). New and deleted events are
-- never notified (CA-47).
-- ---------------------------------------------------------------------------
create or replace function private.events_notify_time_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
begin
  v_actor := private.notification_actor(new.household_id);
  if v_actor is null then
    return null;
  end if;

  insert into public.notifications (household_id, recipient_member_id, kind, actor_member_id, event_id)
  select new.household_id, r.member_id, 'event_time_changed', v_actor, new.id
  from (
    select new.author_member_id as member_id
    union
    select new.escort_member_id
    union
    select em.member_id
    from public.event_members em
    where em.event_id = new.id
  ) r
  where r.member_id is not null
    and r.member_id <> v_actor
    and private.notification_recipient_wants(r.member_id, 'events');

  return null;
end;
$$;

create trigger events_notify_time_change
  after update of starts_at, ends_at on public.events
  for each row
  when (old.starts_at is distinct from new.starts_at or old.ends_at is distinct from new.ends_at)
  execute function private.events_notify_time_change();

-- ---------------------------------------------------------------------------
-- «Cambio d'orario» of one occurrence («Salva solo questo»): a changed occurrence whose
-- start or end differs from what it was before (its own values when it was already
-- changed, otherwise those of the series on that day). Removed occurrences, and changes
-- of title, place, notes or escort only, notify nobody. Same recipients as the whole
-- event, plus the escort of that occurrence (who already sees the event in full: rule of
-- the event_exceptions triggers).
-- ---------------------------------------------------------------------------
create or replace function private.event_exceptions_notify_time_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_event public.events;
  v_before_start timestamptz;
  v_before_end timestamptz;
begin
  if new.is_cancelled or new.starts_at is null or new.ends_at is null then
    return null;
  end if;

  v_actor := private.notification_actor(new.household_id);
  if v_actor is null then
    return null;
  end if;

  select e.* into v_event
  from public.events e
  where e.id = new.event_id;
  if not found then
    return null;
  end if;

  if tg_op = 'UPDATE' then
    if not old.is_cancelled and old.starts_at is not null then
      v_before_start := old.starts_at;
      v_before_end := old.ends_at;
    end if;
  end if;
  if v_before_start is null then
    -- Same local time as every occurrence of the series (event_occurrence_starts).
    v_before_start := (new.occurrence_date + (v_event.starts_at at time zone 'Europe/Rome')::time)
      at time zone 'Europe/Rome';
    v_before_end := v_before_start + (v_event.ends_at - v_event.starts_at);
  end if;

  if new.starts_at = v_before_start and new.ends_at = v_before_end then
    return null;
  end if;

  insert into public.notifications (
    household_id, recipient_member_id, kind, actor_member_id, event_id, occurrence_date
  )
  select new.household_id, r.member_id, 'event_time_changed', v_actor, new.event_id, new.occurrence_date
  from (
    select v_event.author_member_id as member_id
    union
    select v_event.escort_member_id
    union
    select new.escort_member_id
    union
    select em.member_id
    from public.event_members em
    where em.event_id = new.event_id
  ) r
  where r.member_id is not null
    and r.member_id <> v_actor
    and private.notification_recipient_wants(r.member_id, 'events');

  return null;
end;
$$;

create trigger event_exceptions_notify_time_change
  after insert or update on public.event_exceptions
  for each row execute function private.event_exceptions_notify_time_change();

-- ---------------------------------------------------------------------------
-- Shopping list: every item added by a member through the app is recorded (who and
-- when, nothing else) for the job of 19:00, so that items taken, removed or cancelled in
-- the meantime still count (CA-20). Items put back by «Annulla» after a «strappo» keep
-- their old created_at and are not new additions; inserts without a session (seed,
-- administrative key) are not recorded.
-- ---------------------------------------------------------------------------
create or replace function private.shopping_items_record_addition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
begin
  v_actor := private.notification_actor(new.household_id);
  if v_actor is null
     or new.added_by_member_id is distinct from v_actor
     or new.created_at is distinct from now() then
    return null;
  end if;

  insert into private.shopping_additions (household_id, member_id)
  values (new.household_id, v_actor);

  return null;
end;
$$;

create trigger shopping_items_record_addition
  after insert on public.shopping_items
  for each row execute function private.shopping_items_record_addition();

-- ---------------------------------------------------------------------------
-- «Liberi insieme» of one evening as one member sees it: the start of the window, or
-- null. Same rules as computeFreeEvenings() of src/lib/calendar.ts (issue #25 §8), with
-- the events the member sees in the calendar week (Monday to Sunday, Europe/Rome) of that
-- evening (private.household_events_for_member, the rows of list_household_events):
-- - the household needs at least two adults (with or without an account);
-- - nothing visible to the member in that week: no window;
-- - an adult is busy during an event the member sees when: it is an «Occupato» of someone
--   else shown as busy and the adult is its author; or it is not «Solo io» and the adult
--   is a participant or the escort, or the author of an «Occupato». A «Solo io» never
--   makes anybody busy (CA-19); events of children alone, without escort, busy nobody;
-- - the window is the longest stretch of 18:00 – 23:00 (Europe/Rome) in which no adult is
--   busy, at least 60 minutes long; at equal length the earliest.
-- ---------------------------------------------------------------------------
create or replace function private.free_together_start(p_member_id uuid, p_day date)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  with bounds as (
    select
      ((p_day - (extract(isodow from p_day)::integer - 1))::timestamp at time zone 'Europe/Rome') as week_from,
      ((p_day - (extract(isodow from p_day)::integer - 1) + 7)::timestamp at time zone 'Europe/Rome') as week_to,
      ((p_day + time '18:00') at time zone 'Europe/Rome') as evening_from,
      ((p_day + time '23:00') at time zone 'Europe/Rome') as evening_to
  ),
  adults as (
    select a.id
    from public.household_members me
    join public.household_members a on a.household_id = me.household_id and a.kind = 'adult'
    where me.id = p_member_id
  ),
  seen as (
    select s.*
    from bounds b
    cross join lateral private.household_events_for_member(p_member_id, b.week_from, b.week_to) s
  ),
  busy as (
    select tstzrange(greatest(s.starts_at, b.evening_from), least(s.ends_at, b.evening_to)) as span
    from seen s
    cross join bounds b
    where s.starts_at < b.evening_to
      and s.ends_at > b.evening_from
      and exists (
        select 1
        from adults a
        where case
          when s.is_masked then s.author_member_id = a.id
          when s.visibility = 'private' then false
          else a.id = any (s.member_ids)
            or s.escort_member_id is not distinct from a.id
            or (s.visibility = 'busy' and s.author_member_id is not distinct from a.id)
        end
      )
  ),
  free as (
    select f.span
    from bounds b
    cross join lateral unnest(
      tstzmultirange(tstzrange(b.evening_from, b.evening_to))
      - coalesce((select range_agg(x.span) from busy x), '{}'::tstzmultirange)
    ) as f (span)
  )
  select lower(f.span)
  from free f
  where (select count(*) from adults) >= 2
    and exists (select 1 from seen)
    and upper(f.span) - lower(f.span) >= interval '60 minutes'
  order by upper(f.span) - lower(f.span) desc, lower(f.span)
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Job of 8:00 «Liberi insieme» for the instant p_at (requirement §4, CA-18, CA-19): for
-- each adult with an account with «Liberi insieme» on, the first evening from tomorrow to
-- 7 days later (Europe/Rome days of p_at) with a window as that adult sees it, for which
-- they have no notification yet. At most one per adult and day: run again the same day,
-- it creates nothing (unique indexes). Created at p_at. Returns how many it created.
-- Every job and the cleanup take p_household_id: only that household is touched; null =
-- every household, used only by private.run_scheduled_notification_jobs() (pg_cron),
-- never by the public function for the tests (review of PR #237).
-- ---------------------------------------------------------------------------
create or replace function private.notifications_free_together(p_at timestamptz, p_household_id uuid)
returns integer
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_today date := (p_at at time zone 'Europe/Rome')::date;
  v_member record;
  v_day date;
  v_start timestamptz;
  v_created integer := 0;
  v_rows integer;
begin
  for v_member in
    select m.id, m.household_id
    from public.household_members m
    where m.kind = 'adult'
      and m.user_id is not null
      and (p_household_id is null or m.household_id = p_household_id)
      and private.notification_recipient_wants(m.id, 'free_together')
      and not exists (
        select 1
        from public.notifications n
        where n.recipient_member_id = m.id
          and n.kind = 'free_together'
          and n.created_on = v_today
      )
    order by m.household_id, m.id
  loop
    for i in 1..7 loop
      v_day := v_today + i;
      continue when exists (
        select 1
        from public.notifications n
        where n.recipient_member_id = v_member.id
          and n.kind = 'free_together'
          and n.evening_date = v_day
      );

      v_start := private.free_together_start(v_member.id, v_day);
      if v_start is not null then
        insert into public.notifications (
          household_id, recipient_member_id, kind, evening_date, free_from, created_at
        )
        values (v_member.household_id, v_member.id, 'free_together', v_day, v_start, p_at)
        on conflict do nothing;
        get diagnostics v_rows = row_count;
        v_created := v_created + v_rows;
        exit;
      end if;
    end loop;
  end loop;

  return v_created;
end;
$$;

-- ---------------------------------------------------------------------------
-- Job of 9:00 «Scadenza vicina» for the instant p_at (requirement §4, CA-12 – CA-14,
-- CA-45): every deadline whose due date minus today (Europe/Rome day of p_at) is one of
-- its reminders (30, 7, 1, 0). Recipients:
-- - the assignee, when it is an adult with an account;
-- - otherwise (nobody, a child, an adult without account) every adult with an account who
--   sees the deadline: only the author for «Solo io» (CA-14), everyone for «Tutto il Nest».
-- Always on (no switch, decision of the coordinator of 04/11). Run again the same day it
-- creates nothing (unique index). Created at p_at. Returns how many it created.
-- ---------------------------------------------------------------------------
create or replace function private.notifications_deadline_reminders(p_at timestamptz, p_household_id uuid)
returns integer
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_today date := (p_at at time zone 'Europe/Rome')::date;
  v_created integer;
begin
  insert into public.notifications (household_id, recipient_member_id, kind, deadline_id, days_before, created_at)
  select d.household_id, m.id, 'deadline_reminder', d.id, (d.due_date - v_today)::smallint, p_at
  from public.deadlines d
  join public.household_members m
    on m.household_id = d.household_id
   and m.kind = 'adult'
   and m.user_id is not null
  where (p_household_id is null or d.household_id = p_household_id)
    and d.due_date in (v_today, v_today + 1, v_today + 7, v_today + 30)
    and (d.due_date - v_today) = any (d.reminder_days)
    and case
      when exists (
        select 1
        from public.household_members a
        where a.id = d.assignee_member_id
          and a.kind = 'adult'
          and a.user_id is not null
      ) then m.id = d.assignee_member_id
      when d.is_private then m.id = d.created_by_member_id
      else true
    end
  order by d.household_id, d.id, m.id
  on conflict do nothing;

  get diagnostics v_created = row_count;
  return v_created;
end;
$$;

-- ---------------------------------------------------------------------------
-- Job of 19:00 «Spesa raggruppata» for the instant p_at (requirement §4, CA-20): for every
-- member who added at least one thing to the shopping list in the 24 hours before p_at
-- (also if taken or removed since), one notification for every other adult with an
-- account of the household with «Spesa» on (off by default), with how many things. One
-- person per notification. Run again the same day it creates nothing (unique index).
-- Created at p_at. Returns how many it created.
-- ---------------------------------------------------------------------------
create or replace function private.notifications_shopping_digest(p_at timestamptz, p_household_id uuid)
returns integer
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_created integer;
begin
  insert into public.notifications (household_id, recipient_member_id, kind, actor_member_id, item_count, created_at)
  select a.household_id, m.id, 'shopping_added', a.member_id, a.item_count, p_at
  from (
    select s.household_id, s.member_id, count(*)::integer as item_count
    from private.shopping_additions s
    where s.created_at > p_at - interval '24 hours'
      and s.created_at <= p_at
      and (p_household_id is null or s.household_id = p_household_id)
    group by s.household_id, s.member_id
  ) a
  join public.household_members m
    on m.household_id = a.household_id
   and m.id <> a.member_id
  where private.notification_recipient_wants(m.id, 'shopping')
  order by a.household_id, a.member_id, m.id
  on conflict do nothing;

  get diagnostics v_created = row_count;
  return v_created;
end;
$$;

-- ---------------------------------------------------------------------------
-- Daily cleanup for the instant p_at (requirement §5, decision of the coordinator of
-- 04/11, CA-24): notifications created more than 30 days before p_at, read or not, and the
-- records of the shopping additions older than 2 days (the job of 19:00 needs 24 hours).
-- Returns how many notifications it deleted.
-- ---------------------------------------------------------------------------
create or replace function private.purge_notifications(p_at timestamptz, p_household_id uuid)
returns integer
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  delete from public.notifications n
  where n.created_at < p_at - interval '30 days'
    and (p_household_id is null or n.household_id = p_household_id);
  get diagnostics v_deleted = row_count;

  delete from private.shopping_additions s
  where s.created_at < p_at - interval '2 days'
    and (p_household_id is null or s.household_id = p_household_id);

  return v_deleted;
end;
$$;

-- ---------------------------------------------------------------------------
-- Run by pg_cron at minute 0 of every hour (schedule migration), for every household.
-- pg_cron counts in UTC; the hour of Rome of p_at decides, so the jobs keep their time of
-- Rome also with daylight saving time: 8:00 «Liberi insieme», 9:00 deadlines, 19:00
-- shopping, 3:00 cleanup. Every job is idempotent: a late or repeated run within the same
-- hour creates nothing twice. Returns the job it ran, or null when that hour has none
-- (pgTAP checks a winter and a summer hour).
-- ---------------------------------------------------------------------------
create or replace function private.run_scheduled_notification_jobs(p_at timestamptz default now())
returns public.notification_job
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_hour integer := extract(hour from (p_at at time zone 'Europe/Rome'))::integer;
begin
  if v_hour = 8 then
    perform private.notifications_free_together(p_at, null);
    return 'free_together';
  elsif v_hour = 9 then
    perform private.notifications_deadline_reminders(p_at, null);
    return 'deadline_reminders';
  elsif v_hour = 19 then
    perform private.notifications_shopping_digest(p_at, null);
    return 'shopping_digest';
  elsif v_hour = 3 then
    perform private.purge_notifications(p_at, null);
    return 'purge';
  end if;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC for the tests of page #39 (requirement of #229 point 5): runs one job for ONE
-- household (p_household_id, required) as if it ran at the instant p_at (default now).
-- Nothing of the other households is created or deleted (review of PR #237: the page
-- tests run in parallel with their own throwaway households, and the administrative key
-- of the project must never write notifications for every family). Returns how many
-- notifications it created (deleted for the cleanup). Executable only by service_role
-- (administrative key) and the database owner, never by authenticated or anon (grants).
-- Security definer: the jobs read and write the private schema. Only POST through the
-- Data API.
-- ---------------------------------------------------------------------------
create or replace function public.run_notification_job(
  p_job public.notification_job,
  p_household_id uuid,
  p_at timestamptz default now()
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;
  if p_job is null or p_household_id is null or p_at is null or not isfinite(p_at) then
    raise exception 'invalid job, household or instant' using errcode = '22023';
  end if;

  return case p_job
    when 'free_together' then private.notifications_free_together(p_at, p_household_id)
    when 'deadline_reminders' then private.notifications_deadline_reminders(p_at, p_household_id)
    when 'shopping_digest' then private.notifications_shopping_digest(p_at, p_household_id)
    when 'purge' then private.purge_notifications(p_at, p_household_id)
  end;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC (write) for the page: marks as read the notifications of the caller among p_ids
-- (the rows shown when the page opens, «Segna tutte come lette», «Fatto» and «Apri»).
-- Receives only ids (lesson: the client sends ids, the database decides): ids of other
-- members or households, unknown ids and notifications already read are ignored, without
-- saying which. Read time = now(). At most 200 ids per call. Only POST through the Data API.
-- Security definer: the app has no update privilege on notifications (requirement of
-- #229 point 3); the function writes only read_at of rows whose recipient is the member
-- of the verified session.
-- ---------------------------------------------------------------------------
create or replace function public.mark_notifications_read(p_ids uuid[])
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_member_id uuid;
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  v_member_id := private.current_member_id();
  if v_member_id is null then
    raise exception 'permission denied for function mark_notifications_read' using errcode = '42501';
  end if;

  if p_ids is null or array_position(p_ids, null) is not null or cardinality(p_ids) > 200 then
    raise exception 'invalid ids' using errcode = '22023';
  end if;

  update public.notifications n
  set read_at = now()
  where n.id = any (p_ids)
    and n.recipient_member_id = v_member_id
    and n.read_at is null;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC (read) for the bell (requirement §6, CA-28, CA-48): how many of the notifications
-- the page would show are not read: those of the caller of the last 30 days that are
-- still visible (select policy), at most the 100 most recent. 0 for a caller without
-- household. Security invoker: RLS decides which rows count.
-- ---------------------------------------------------------------------------
create or replace function public.count_unread_notifications()
returns integer
language sql
stable
set search_path = ''
as $$
  select count(*)::integer
  from (
    select n.read_at
    from public.notifications n
    where n.created_at >= now() - interval '30 days'
    order by n.created_at desc, n.id desc
    limit 100
  ) shown
  where shown.read_at is null;
$$;
