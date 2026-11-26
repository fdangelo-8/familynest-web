-- Issue #511 (DB-2 «Notifiche 2.0», plan #501), part 2 of 2: the new notifications, when
-- the phone rings, the morning digest, «Chiedi a … di portare …» and the jobs.
--
-- Conventions (same as part 1 and the notifications migrations of #229):
-- - every function has `set search_path = ''` and fully qualified names;
-- - helpers, trigger functions and jobs live in the "private" schema (not exposed by the
--   Data API, not in the generated types);
-- - the functions that write notifications or deliveries are security definer (owner:
--   postgres) or run as the owner (jobs): the recipients are other members, and no API role
--   has a privilege on the private tables. The person who acts is always the member of the
--   verified session;
-- - nobody is notified of what they did themselves, only adults with an account receive,
--   a switch that is off means no notification at all (question 2 of #511);
-- - the functions of the page that write refuse every Data API method other than POST
--   (lesson of #112);
-- - one single place for each rule: private.notification_is_visible() (what a recipient may
--   see), private.push_content() (what a push may say), private.morning_digest() (what the
--   morning digest holds), private.push_schedule() (when a notification rings),
--   private.event_occurrence_on() (one occurrence of an event).
-- Execute grants are in the notifications_2_part_2_policies_and_grants migration.
--
-- Error codes:
-- - 42501: no signed-in user, a caller without household, an event the caller cannot ask
--   about (another household, not «Tutto il Nest»);
-- - 22023: invalid arguments (null, a day without occurrence, a person of another
--   household, a job without instant);
-- - 23514: a ride asked to oneself, to a child, a pet or an adult without account;
-- - P0001 'use POST': called through the Data API with a method other than POST.

-- ===========================================================================
-- Occurrences
-- ===========================================================================

-- The occurrence of an event that starts on p_day in its series (the day of
-- event_exceptions.occurrence_date; for an event that does not repeat, the day it starts),
-- with the values of that occurrence: start, end, title, place, «Lo porta», «Lo riprende».
-- No row when that day is not an occurrence, or the occurrence was removed. A modified
-- occurrence keeps its own values, wherever it was moved.
-- Owner only, security invoker, trusts its arguments.
create or replace function private.event_occurrence_on(p_event_id uuid, p_day date)
returns table (
  starts_at timestamptz,
  ends_at timestamptz,
  title text,
  location text,
  escort_member_id uuid,
  pickup_member_id uuid
)
language sql
stable
set search_path = ''
as $$
  select x.starts_at, x.ends_at, coalesce(x.title, e.title), x.location, x.escort_member_id, x.pickup_member_id
  from public.events e
  join public.event_exceptions x
    on x.event_id = e.id
   and x.occurrence_date = p_day
  where e.id = p_event_id
    and e.recurrence <> 'none'
    and not x.is_cancelled
    and x.starts_at is not null
    and private.event_has_occurrence_on(e.starts_at, e.recurrence, e.recurrence_weekdays, e.recurrence_until, p_day)
  union all
  select o.starts_at, o.ends_at, e.title, e.location, e.escort_member_id, e.pickup_member_id
  from public.events e
  cross join lateral private.event_occurrences(
    e.id,
    e.starts_at,
    e.ends_at,
    e.recurrence,
    e.recurrence_weekdays,
    e.recurrence_until,
    (p_day::timestamp at time zone 'Europe/Rome'),
    ((p_day + 1)::timestamp at time zone 'Europe/Rome'),
    e.all_day
  ) o
  where e.id = p_event_id
    and p_day is not null
    and not o.is_modified
    and o.occurrence_date = p_day;
$$;

-- ===========================================================================
-- Switches
-- ===========================================================================

-- True when the member is an adult with an account and their switch is on (same function
-- as #229, with the switches of #511). No row = the defaults of the columns, the same as
-- get_notification_preferences() (pgTAP checks both). p_preference null = a notification
-- without switch (member_joined): always on.
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
            when 'shopping' then coalesce(p.shopping, true)
            when 'free_together' then coalesce(p.free_together, true)
            when 'morning_digest' then coalesce(p.morning_digest, true)
            when 'quiet_hours' then coalesce(p.quiet_hours, true)
            when 'hide_content' then coalesce(p.hide_content, false)
            when 'rides' then coalesce(p.rides, true)
            when 'event_reminders' then coalesce(p.event_reminders, true)
            when 'deadlines' then coalesce(p.deadlines, true)
            when 'gifts' then coalesce(p.gifts, true)
            when 'digest_events' then coalesce(p.digest_events, true)
            when 'digest_rides' then coalesce(p.digest_rides, true)
            when 'digest_deadlines' then coalesce(p.digest_deadlines, true)
            when 'digest_thanks' then coalesce(p.digest_thanks, true)
            when 'digest_shopping' then coalesce(p.digest_shopping, false)
          end,
          false
        )
      )
  );
$$;

-- ===========================================================================
-- What a recipient may see (same function as part 1, with the five new kinds)
-- ===========================================================================
-- - member_joined: the person who entered is still in the household (otherwise the
--   notification is gone with them);
-- - event_reminder, ride_reminder, ride_request: the recipient sees the event in full and
--   that day is still an occurrence (not removed);
-- - overlap_tomorrow: the recipient sees both events in full and both occurrences are
--   still there.
-- Everything else as part 1. Security definer (owner: postgres).
create or replace function private.notification_is_visible(p_notification_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.notifications n
    join public.household_members r
      on r.id = n.recipient_member_id
     and r.household_id = n.household_id
    where n.id = p_notification_id
      and r.kind = 'adult'
      and r.user_id is not null
      and ((select auth.uid()) is null or r.user_id = (select auth.uid()))
      and case n.kind
        when 'todo_assigned' then exists (
          select 1
          from public.todos t
          where t.id = n.todo_id
            and t.household_id = n.household_id
            and (not t.is_private or t.created_by_member_id = r.id)
        )
        when 'deadline_reminder' then exists (
          select 1
          from public.deadlines d
          where d.id = n.deadline_id
            and d.household_id = n.household_id
            and private.deadline_open_to_member(d.is_private, d.created_by_member_id, r.id)
        )
        when 'event_time_changed' then
          private.event_open_to_member(n.event_id, r.id)
          and (
            n.occurrence_date is null
            or exists (
              select 1
              from public.events e
              where e.id = n.event_id
                and e.recurrence <> 'none'
                and private.event_has_occurrence_on(
                  e.starts_at, e.recurrence, e.recurrence_weekdays, e.recurrence_until, n.occurrence_date
                )
                and not exists (
                  select 1
                  from public.event_exceptions x
                  where x.event_id = e.id
                    and x.occurrence_date = n.occurrence_date
                    and x.is_cancelled
                )
            )
          )
        when 'gift_taken' then exists (
          select 1
          from public.wishlist_reservations w
          where w.id = n.wishlist_reservation_id
            and w.household_id = n.household_id
        )
        when 'free_together' then true
        when 'shopping_added' then true
        when 'member_joined' then true
        when 'event_reminder' then
          private.event_open_to_member(n.event_id, r.id)
          and exists (select 1 from private.event_occurrence_on(n.event_id, n.occurrence_date))
        when 'ride_reminder' then
          private.event_open_to_member(n.event_id, r.id)
          and exists (select 1 from private.event_occurrence_on(n.event_id, n.occurrence_date))
        when 'ride_request' then
          private.event_open_to_member(n.event_id, r.id)
          and exists (select 1 from private.event_occurrence_on(n.event_id, n.occurrence_date))
        when 'overlap_tomorrow' then
          private.event_open_to_member(n.event_id, r.id)
          and private.event_open_to_member(n.other_event_id, r.id)
          and exists (select 1 from private.event_occurrence_on(n.event_id, n.occurrence_date))
          and exists (select 1 from private.event_occurrence_on(n.other_event_id, n.other_occurrence_date))
        else false
      end
  );
$$;

-- ===========================================================================
-- When the phone rings (rule 5 of #511)
-- ===========================================================================

-- The instant a push created at p_at rings: p_at, or 7:00 (Europe/Rome) when p_at falls in
-- the silence of the night (22:00 – 7:00) and p_silent is true.
create or replace function private.push_ring_at(p_at timestamptz, p_silent boolean)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select case
    when p_silent and (p_at at time zone 'Europe/Rome')::time >= time '22:00' then
      (((p_at at time zone 'Europe/Rome')::date + 1) + time '07:00') at time zone 'Europe/Rome'
    when p_silent and (p_at at time zone 'Europe/Rome')::time < time '07:00' then
      (((p_at at time zone 'Europe/Rome')::date) + time '07:00') at time zone 'Europe/Rome'
    else p_at
  end;
$$;

-- What happens to a new notification on the phone of its recipient (one place for the page
-- triggers, the jobs and the tests):
-- - nothing, when the recipient has no device (CA-31);
-- - a single delivery when it rings at once: «Ogni avviso» (each) for every kind;
--   «Subito quelle per me» (mine_now) for the «Tocca a te» kinds (todo_assigned,
--   deadline_reminder, event_reminder, ride_reminder, ride_request, member_joined); and, in
--   every way, a change of time of an occurrence that starts within 24 hours (p_urgent,
--   decided by the triggers of the events, which know the time before the change);
-- - otherwise a row waiting for the evening summary (private.push_digest_items);
-- - a single delivery rings at the creation of the notification, or at 7:00 when that falls
--   in the silence of the night («Silenzio di notte» on; member_joined always, ap1-34); a
--   reminder of an event or a ride whose moment is not after 7:00 does not ring at all.
-- Runs once per notification (unique indexes). Owner only, security invoker (called by
-- security definer triggers).
create or replace function private.push_schedule(p_notification_id uuid, p_urgent boolean)
returns void
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_note record;
  v_mode public.notification_delivery_mode;
  v_quiet boolean;
  v_now boolean;
  v_due timestamptz;
  v_moment timestamptz;
begin
  select n.id, n.kind, n.household_id, n.recipient_member_id, n.created_at, n.event_id, n.occurrence_date,
         n.ride_leg
  into v_note
  from public.notifications n
  where n.id = p_notification_id;
  if not found then
    return;
  end if;

  if not exists (
    select 1 from public.push_subscriptions s where s.member_id = v_note.recipient_member_id
  ) then
    return;
  end if;

  select coalesce(p.delivery_mode, 'mine_now'), coalesce(p.quiet_hours, true)
  into v_mode, v_quiet
  from (select 1) one
  left join public.notification_preferences p on p.member_id = v_note.recipient_member_id;

  v_now := v_mode = 'each'
    or (
      v_mode = 'mine_now'
      and v_note.kind in (
        'todo_assigned', 'deadline_reminder', 'event_reminder', 'ride_reminder', 'ride_request', 'member_joined'
      )
    )
    or (v_note.kind = 'event_time_changed' and coalesce(p_urgent, false));

  if not v_now then
    insert into private.push_digest_items (notification_id, household_id, recipient_member_id, created_at)
    values (v_note.id, v_note.household_id, v_note.recipient_member_id, v_note.created_at)
    on conflict do nothing;
    return;
  end if;

  v_due := private.push_ring_at(v_note.created_at, v_quiet or v_note.kind = 'member_joined');

  if v_due > v_note.created_at and v_note.kind in ('event_reminder', 'ride_reminder') then
    select case when v_note.ride_leg = 'pickup' then o.ends_at else o.starts_at end
    into v_moment
    from private.event_occurrence_on(v_note.event_id, v_note.occurrence_date) o
    limit 1;
    if v_moment is null or v_moment <= v_due then
      return;
    end if;
  end if;

  insert into private.push_deliveries (household_id, recipient_member_id, kind, notification_id, due_at)
  values (v_note.household_id, v_note.recipient_member_id, 'single', v_note.id, v_due)
  on conflict do nothing;
end;
$$;

-- Every new notification goes through private.push_schedule(), except event_time_changed:
-- the triggers of the events schedule it themselves, with the time before the change.
-- Security definer (owner: postgres): the notifications are written by the database (and
-- by the administrative key of the page tests), the deliveries are private.
create or replace function private.notifications_schedule_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind <> 'event_time_changed' then
    perform private.push_schedule(new.id, false);
  end if;
  return null;
end;
$$;

create trigger notifications_schedule_push
  after insert on public.notifications
  for each row execute function private.notifications_schedule_push();

-- «Cambio d'orario» of a whole event or series (same recipients and rules as events_2): one
-- more step, the push. It is urgent when an occurrence starts within 24 hours of now, with
-- the times before or after the change (the removed and modified occurrences of the series
-- are not looked at for the times before: at worst a change rings at once).
create or replace function private.events_notify_time_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_ids uuid[];
  v_urgent boolean;
begin
  v_actor := private.notification_actor(new.household_id);
  if v_actor is null then
    return null;
  end if;

  with created as (
    insert into public.notifications (household_id, recipient_member_id, kind, actor_member_id, event_id)
    select new.household_id, r.member_id, 'event_time_changed', v_actor, new.id
    from (
      select new.author_member_id as member_id
      union
      select new.escort_member_id
      union
      select new.pickup_member_id
      union
      select em.member_id
      from public.event_members em
      where em.event_id = new.id
    ) r
    where r.member_id is not null
      and r.member_id <> v_actor
      and private.notification_recipient_wants(r.member_id, 'events')
    returning id
  )
  select array_agg(c.id) into v_ids from created c;

  if v_ids is null then
    return null;
  end if;

  v_urgent := exists (
      select 1
      from private.event_occurrence_starts(
        old.starts_at, old.recurrence, old.recurrence_weekdays, old.recurrence_until, now(), now() + interval '24 hours'
      ) s (starts_at)
      where s.starts_at >= now()
        and s.starts_at <= now() + interval '24 hours'
    )
    or exists (
      select 1
      from private.event_occurrences(
        new.id, new.starts_at, new.ends_at, new.recurrence, new.recurrence_weekdays, new.recurrence_until,
        now(), now() + interval '24 hours', new.all_day
      ) o
      where o.starts_at >= now()
        and o.starts_at <= now() + interval '24 hours'
    );

  perform private.push_schedule(i.id, v_urgent) from unnest(v_ids) as i (id);

  return null;
end;
$$;

-- «Cambio d'orario» of one occurrence (same recipients and rules as events_2): one more
-- step, the push, urgent when the occurrence starts within 24 hours of now, before or after
-- the change.
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
  v_ids uuid[];
  v_urgent boolean;
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
    if v_event.all_day then
      v_before_end := (
        new.occurrence_date
        + ((v_event.ends_at at time zone 'Europe/Rome')::date - (v_event.starts_at at time zone 'Europe/Rome')::date)
      )::timestamp at time zone 'Europe/Rome';
    else
      v_before_end := v_before_start + (v_event.ends_at - v_event.starts_at);
    end if;
  end if;

  if new.starts_at = v_before_start and new.ends_at = v_before_end then
    return null;
  end if;

  with created as (
    insert into public.notifications (
      household_id, recipient_member_id, kind, actor_member_id, event_id, occurrence_date
    )
    select new.household_id, r.member_id, 'event_time_changed', v_actor, new.event_id, new.occurrence_date
    from (
      select v_event.author_member_id as member_id
      union
      select v_event.escort_member_id
      union
      select v_event.pickup_member_id
      union
      select new.escort_member_id
      union
      select new.pickup_member_id
      union
      select em.member_id
      from public.event_members em
      where em.event_id = new.event_id
    ) r
    where r.member_id is not null
      and r.member_id <> v_actor
      and private.notification_recipient_wants(r.member_id, 'events')
    returning id
  )
  select array_agg(c.id) into v_ids from created c;

  if v_ids is null then
    return null;
  end if;

  v_urgent := (v_before_start >= now() and v_before_start <= now() + interval '24 hours')
    or (new.starts_at >= now() and new.starts_at <= now() + interval '24 hours');

  perform private.push_schedule(i.id, v_urgent) from unnest(v_ids) as i (id);

  return null;
end;
$$;

-- ===========================================================================
-- Preferences of the page (A18 #551)
-- ===========================================================================

-- RPC (read): every choice of the caller, in one row. When the caller never chose anything
-- (no row), the defaults of the columns (pgTAP checks both). Never writes (CA-1). No row
-- when the caller has no household. The first five columns are those of #217, in the same
-- order. The return type changes: dropped and created again (grants in the policies
-- migration). Security invoker: RLS allows only the row of the caller.
drop function public.get_notification_preferences();

create function public.get_notification_preferences()
returns table (
  events boolean,
  assigned_todos boolean,
  shopping boolean,
  free_together boolean,
  morning_digest boolean,
  quiet_hours boolean,
  hide_content boolean,
  rides boolean,
  event_reminders boolean,
  deadlines boolean,
  gifts boolean,
  digest_events boolean,
  digest_rides boolean,
  digest_deadlines boolean,
  digest_thanks boolean,
  digest_shopping boolean,
  delivery_mode public.notification_delivery_mode,
  evening_digest_time time
)
language sql
stable
set search_path = ''
as $$
  select
    coalesce(p.events, true),
    coalesce(p.assigned_todos, true),
    coalesce(p.shopping, true),
    coalesce(p.free_together, true),
    coalesce(p.morning_digest, true),
    coalesce(p.quiet_hours, true),
    coalesce(p.hide_content, false),
    coalesce(p.rides, true),
    coalesce(p.event_reminders, true),
    coalesce(p.deadlines, true),
    coalesce(p.gifts, true),
    coalesce(p.digest_events, true),
    coalesce(p.digest_rides, true),
    coalesce(p.digest_deadlines, true),
    coalesce(p.digest_thanks, true),
    coalesce(p.digest_shopping, false),
    coalesce(p.delivery_mode, 'mine_now'::public.notification_delivery_mode),
    coalesce(p.evening_digest_time, time '19:00')
  from (select private.current_member_id() as member_id) c
  left join public.notification_preferences p on p.member_id = c.member_id
  where c.member_id is not null;
$$;

-- RPC (write): one switch of the caller (same function as part 1, with the switches of
-- cb1-45 and of the content of the morning digest). Only the column of the touched switch
-- changes.
create or replace function public.set_notification_preference(
  p_preference public.notification_preference,
  p_enabled boolean
)
returns void
language plpgsql
volatile
set search_path = ''
as $$
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  if p_preference is null or p_enabled is null then
    raise exception 'preference and value are required' using errcode = '22004';
  end if;

  -- Raises 42501 (before insert trigger) when the caller has no household.
  insert into public.notification_preferences default values
  on conflict (member_id) do nothing;

  update public.notification_preferences p
  set
    events = case when p_preference = 'events' then p_enabled else p.events end,
    assigned_todos = case when p_preference = 'assigned_todos' then p_enabled else p.assigned_todos end,
    shopping = case when p_preference = 'shopping' then p_enabled else p.shopping end,
    free_together = case when p_preference = 'free_together' then p_enabled else p.free_together end,
    morning_digest = case when p_preference = 'morning_digest' then p_enabled else p.morning_digest end,
    quiet_hours = case when p_preference = 'quiet_hours' then p_enabled else p.quiet_hours end,
    hide_content = case when p_preference = 'hide_content' then p_enabled else p.hide_content end,
    rides = case when p_preference = 'rides' then p_enabled else p.rides end,
    event_reminders = case when p_preference = 'event_reminders' then p_enabled else p.event_reminders end,
    deadlines = case when p_preference = 'deadlines' then p_enabled else p.deadlines end,
    gifts = case when p_preference = 'gifts' then p_enabled else p.gifts end,
    digest_events = case when p_preference = 'digest_events' then p_enabled else p.digest_events end,
    digest_rides = case when p_preference = 'digest_rides' then p_enabled else p.digest_rides end,
    digest_deadlines = case when p_preference = 'digest_deadlines' then p_enabled else p.digest_deadlines end,
    digest_thanks = case when p_preference = 'digest_thanks' then p_enabled else p.digest_thanks end,
    digest_shopping = case when p_preference = 'digest_shopping' then p_enabled else p.digest_shopping end
  where p.member_id = (select private.current_member_id());
end;
$$;

-- RPC (write): the caller saw the introduction of the morning digest (mn1-17). Writes the
-- instant only the first time: called again, it changes nothing and gives no error.
-- Security definer (owner: postgres): the app has no update privilege on this column; the
-- row is always the profile of the verified session.
create or replace function public.mark_morning_digest_intro_seen()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  if (select auth.uid()) is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  update public.profiles p
  set morning_digest_intro_seen_at = now()
  where p.id = (select auth.uid())
    and p.morning_digest_intro_seen_at is null;
end;
$$;

-- ===========================================================================
-- The morning digest (rule 6 of #511): one source for get_morning_digest() (B1) and the
-- push (private.push_content())
-- ===========================================================================
-- The lines of the morning digest of a member for the day p_day (Europe/Rome), in order:
-- - events (with «Impegni» of «Che cosa c'è dentro»): one line, the occurrences that start
--   that day and that the member sees in full (the «Occupato», «Solo alcune persone» and
--   «Solo io» of the others are neither shown nor counted); count, and start, event,
--   title and people of the first one;
-- - ride (with «Viaggi»): one line per way of the day with a person («Da decidere» has
--   none): «Lo porta» at the start, «Lo riprende» at the end; who drives, the event, the
--   title, the people;
-- - todos (always): the things to do of the member, not done, for that day; count and
--   title of the first one;
-- - deadlines_today, deadlines_tomorrow (with «Scadenze»): the deadlines the member sees,
--   due that day or the day after; count and title of the first one;
-- - shopping (with «Spesa», off by default): how many things are to buy (no names);
-- - free_together (with «Impegni»): the start of the window «Liberi insieme» of that
--   evening, as the member sees it. Alone it is not enough (mn1-20).
-- The «grazie» come with DB-22 (#532).
-- No line at all when the digest is off, the day is not one of the chosen days, the member
-- is not an adult with an account, or there is nothing but free_together.
-- Owner only, security invoker, trusts its arguments.
create or replace function private.morning_digest(p_member_id uuid, p_day date)
returns table (
  line public.morning_digest_line,
  at timestamptz,
  count integer,
  event_id uuid,
  title text,
  leg public.ride_leg,
  driver_member_id uuid,
  member_ids uuid[]
)
language sql
stable
set search_path = ''
as $$
  with me as (
    select
      m.id,
      m.household_id,
      coalesce(p.digest_events, true) as with_events,
      coalesce(p.digest_rides, true) as with_rides,
      coalesce(p.digest_deadlines, true) as with_deadlines,
      coalesce(p.digest_shopping, false) as with_shopping,
      (p_day::timestamp at time zone 'Europe/Rome') as day_from,
      ((p_day + 1)::timestamp at time zone 'Europe/Rome') as day_to
    from public.household_members m
    join public.profiles pr on pr.id = m.user_id
    left join public.notification_preferences p on p.member_id = m.id
    where m.id = p_member_id
      and m.kind = 'adult'
      and p_day is not null
      and coalesce(p.morning_digest, true)
      and extract(isodow from p_day)::smallint = any (pr.morning_digest_weekdays)
  ),
  seen as (
    select r.event_id, r.starts_at, r.ends_at, r.title, r.escort_member_id, r.pickup_member_id, r.member_ids
    from me
    cross join lateral private.household_event_rows_for_member(me.id, me.day_from, me.day_to) r
    where not r.is_masked
      and r.starts_at >= me.day_from
      and r.starts_at < me.day_to
  ),
  lines as (
    select
      'events'::public.morning_digest_line as line,
      f.starts_at as at,
      (select count(*)::integer from seen) as count,
      f.event_id as event_id,
      f.title as title,
      null::public.ride_leg as leg,
      null::uuid as driver_member_id,
      f.member_ids as member_ids,
      1 as sort_group,
      f.starts_at as sort_at
    from me
    cross join lateral (
      select s.* from seen s order by s.starts_at, s.ends_at, s.event_id limit 1
    ) f
    where me.with_events
    union all
    select
      'ride'::public.morning_digest_line, s.starts_at, 1, s.event_id, s.title, 'escort'::public.ride_leg,
      s.escort_member_id, s.member_ids, 2, s.starts_at
    from me
    cross join seen s
    where me.with_rides
      and s.escort_member_id is not null
    union all
    select
      'ride'::public.morning_digest_line, s.ends_at, 1, s.event_id, s.title, 'pickup'::public.ride_leg,
      s.pickup_member_id, s.member_ids, 2, s.ends_at
    from me
    cross join seen s
    where me.with_rides
      and s.pickup_member_id is not null
    union all
    select
      'todos'::public.morning_digest_line, me.day_from, count(*)::integer, null::uuid,
      (array_agg(t.title order by t.created_at, t.id))[1], null::public.ride_leg, null::uuid, null::uuid[],
      3, me.day_from
    from me
    join public.todo_assignees a on a.member_id = me.id
    join public.todos t
      on t.id = a.todo_id
     and t.household_id = me.household_id
    where t.done_at is null
      and t.due_date = p_day
      and (not t.is_private or t.created_by_member_id = me.id)
    group by me.day_from
    union all
    select
      'deadlines_today'::public.morning_digest_line, me.day_from, count(*)::integer, null::uuid,
      (array_agg(d.title order by d.created_at, d.id))[1], null::public.ride_leg, null::uuid, null::uuid[],
      4, me.day_from
    from me
    join public.deadlines d on d.household_id = me.household_id
    where me.with_deadlines
      and d.due_date = p_day
      and private.deadline_open_to_member(d.is_private, d.created_by_member_id, me.id)
    group by me.day_from
    union all
    select
      'deadlines_tomorrow'::public.morning_digest_line, me.day_to, count(*)::integer, null::uuid,
      (array_agg(d.title order by d.created_at, d.id))[1], null::public.ride_leg, null::uuid, null::uuid[],
      5, me.day_to
    from me
    join public.deadlines d on d.household_id = me.household_id
    where me.with_deadlines
      and d.due_date = p_day + 1
      and private.deadline_open_to_member(d.is_private, d.created_by_member_id, me.id)
    group by me.day_to
    union all
    select
      'shopping'::public.morning_digest_line, me.day_from, count(*)::integer, null::uuid, null::text,
      null::public.ride_leg, null::uuid, null::uuid[], 6, me.day_from
    from me
    join public.shopping_items s on s.household_id = me.household_id
    where me.with_shopping
      and s.checked_at is null
    group by me.day_from
    union all
    select
      'free_together'::public.morning_digest_line, w.free_from, null::integer, null::uuid, null::text,
      null::public.ride_leg, null::uuid, null::uuid[], 7, w.free_from
    from me
    cross join lateral (select private.free_together_start(me.id, p_day) as free_from) w
    where me.with_events
      and w.free_from is not null
  )
  select l.line, l.at, l.count, l.event_id, l.title, l.leg, l.driver_member_id, l.member_ids
  from lines l
  where exists (select 1 from lines x where x.line <> 'free_together')
  order by l.sort_group, l.sort_at, l.event_id, l.leg;
$$;

-- RPC (read): the morning digest of the caller for the day p_day (also for B1). Only the
-- caller's own digest: the member is always the one of the verified session. 0 rows when
-- the digest is off or the day is not chosen. Security definer (owner: postgres): the
-- calendar rows of a member are read by private functions; the rules of what the caller
-- sees are those of the calendar (private.household_event_rows_for_member()).
create or replace function public.get_morning_digest(p_day date)
returns table (
  line public.morning_digest_line,
  at timestamptz,
  count integer,
  event_id uuid,
  title text,
  leg public.ride_leg,
  driver_member_id uuid,
  member_ids uuid[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_member_id uuid;
begin
  select m.id into v_member_id
  from public.household_members m
  where m.user_id = (select auth.uid())
    and m.kind = 'adult';

  if v_member_id is null then
    raise exception 'permission denied for function get_morning_digest' using errcode = '42501';
  end if;

  if p_day is null then
    raise exception 'invalid day' using errcode = '22023';
  end if;

  return query
    select d.line, d.at, d.count, d.event_id, d.title, d.leg, d.driver_member_id, d.member_ids
    from private.morning_digest(v_member_id, p_day) d;
end;
$$;

-- ===========================================================================
-- What a push may say (rule 8 of #511): the only source, read by get_push_content()
-- (same function as part 1, with the new kinds and the two summaries)
-- ===========================================================================
-- - single: one row for its notification, while it is visible to the recipient
--   (private.notification_is_visible());
-- - evening_digest: one row per notification it carried that is still visible, in the
--   order they were created;
-- - morning_digest: the lines of private.morning_digest() of that day, as they are when the
--   push is sent (kind and notification_id null, item_count = count).
-- Columns of a notification:
-- - at: todo_assigned → the day «Entro quando»; deadline_reminder → the due day;
--   event_time_changed → as part 1; free_together → the start of the window;
--   event_reminder, ride_request → the start of the occurrence; ride_reminder → the start
--   («Lo porta») or the end («Lo riprende»); overlap_tomorrow → when the two start to
--   overlap; member_joined, shopping_added, gift_taken → null;
-- - title and place: of a «Tutto il Nest» event only, for every kind about an event
--   (mn1-39); of the thing to do and of the deadline;
-- - person_name: who acted (assigned, changed the time, added to the shopping list, entered
--   the household, asks for the ride); the person of an overlap; the person who drives in a
--   ride line of the morning digest;
-- - is_hidden: «Nascondi il contenuto»: then title, place and person_name are always null.
-- In the morning digest the events the recipient sees in full keep their title, «Solo io»
-- of the recipient included (mn1-18), unless «Nascondi il contenuto».
-- gift_taken gives only its kind (decision of part 1, unchanged).
-- Owner only, security invoker (called by get_push_content(), security definer).
create or replace function private.push_content(p_delivery_id uuid)
returns table (
  notification_id uuid,
  kind public.notification_kind,
  line public.morning_digest_line,
  at timestamptz,
  title text,
  place text,
  person_name text,
  item_count integer,
  is_hidden boolean
)
language sql
stable
set search_path = ''
as $$
  with delivery as (
    select
      pd.id,
      pd.kind,
      pd.notification_id,
      pd.recipient_member_id,
      pd.digest_day,
      coalesce(p.hide_content, false) as hide
    from private.push_deliveries pd
    left join public.notification_preferences p on p.member_id = pd.recipient_member_id
    where pd.id = p_delivery_id
  ),
  carried as (
    select d.recipient_member_id, d.hide, d.notification_id
    from delivery d
    where d.kind = 'single'
    union all
    select d.recipient_member_id, d.hide, i.notification_id
    from delivery d
    join private.push_digest_items i
      on i.delivery_id = d.id
     and i.recipient_member_id = d.recipient_member_id
    where d.kind = 'evening_digest'
  ),
  notification_rows as (
    select
      n.id as notification_id,
      n.kind,
      n.created_at,
      case n.kind
        when 'todo_assigned' then t.due_date::timestamp at time zone 'Europe/Rome'
        when 'deadline_reminder' then dl.due_date::timestamp at time zone 'Europe/Rome'
        when 'event_time_changed' then
          case
            when n.occurrence_date is not null then coalesce(
              x.starts_at,
              (n.occurrence_date + (e.starts_at at time zone 'Europe/Rome')::time) at time zone 'Europe/Rome'
            )
            when e.recurrence = 'none' then e.starts_at
          end
        when 'free_together' then n.free_from
        when 'event_reminder' then o.starts_at
        when 'ride_request' then o.starts_at
        when 'ride_reminder' then case when n.ride_leg = 'pickup' then o.ends_at else o.starts_at end
        when 'overlap_tomorrow' then greatest(o.starts_at, o2.starts_at)
      end as happens_at,
      case
        when n.kind = 'todo_assigned' then t.title
        when n.kind = 'deadline_reminder' then dl.title
        when n.kind = 'event_time_changed' and e.visibility = 'household' then coalesce(x.title, e.title)
        when n.kind in ('event_reminder', 'ride_reminder', 'ride_request', 'overlap_tomorrow')
             and e.visibility = 'household' then o.title
      end as title,
      case
        when n.kind = 'event_time_changed' and e.visibility = 'household' then
          case when x.event_id is not null then x.location else e.location end
        when n.kind in ('event_reminder', 'ride_reminder', 'ride_request', 'overlap_tomorrow')
             and e.visibility = 'household' then o.location
      end as place,
      case
        when n.kind in ('todo_assigned', 'event_time_changed', 'shopping_added', 'member_joined', 'ride_request')
          then a.name
        when n.kind = 'overlap_tomorrow' then s.name
      end as person_name,
      n.item_count,
      c.hide
    from carried c
    join public.notifications n
      on n.id = c.notification_id
     and n.recipient_member_id = c.recipient_member_id
    left join public.todos t on t.id = n.todo_id
    left join public.deadlines dl on dl.id = n.deadline_id
    left join public.events e on e.id = n.event_id
    left join public.event_exceptions x
      on n.kind = 'event_time_changed'
     and x.event_id = n.event_id
     and x.occurrence_date = n.occurrence_date
     and not x.is_cancelled
    left join lateral (
      select oc.starts_at, oc.ends_at, oc.title, oc.location
      from private.event_occurrence_on(n.event_id, n.occurrence_date) oc
      limit 1
    ) o on n.kind in ('event_reminder', 'ride_reminder', 'ride_request', 'overlap_tomorrow')
    left join lateral (
      select oc.starts_at
      from private.event_occurrence_on(n.other_event_id, n.other_occurrence_date) oc
      limit 1
    ) o2 on n.kind = 'overlap_tomorrow'
    left join public.household_members a on a.id = n.actor_member_id
    left join public.household_members s on s.id = n.subject_member_id
    where private.notification_is_visible(n.id)
  ),
  digest_rows as (
    select m.line, m.at, m.title, dm.name as person_name, m.count, d.hide, m.ord
    from delivery d
    cross join lateral private.morning_digest(d.recipient_member_id, d.digest_day)
      with ordinality as m (line, at, count, event_id, title, leg, driver_member_id, member_ids, ord)
    left join public.household_members dm on dm.id = m.driver_member_id
    where d.kind = 'morning_digest'
  ),
  all_rows as (
    select
      r.notification_id, r.kind, null::public.morning_digest_line as line, r.happens_at as at, r.title,
      r.place, r.person_name, r.item_count, r.hide,
      1 as sort_group, r.created_at as sort_at, r.notification_id as sort_id, 0::bigint as sort_ord
    from notification_rows r
    union all
    select
      null::uuid, null::public.notification_kind, g.line, g.at, g.title, null::text, g.person_name, g.count,
      g.hide, 2, null::timestamptz, null::uuid, g.ord
    from digest_rows g
  )
  select
    w.notification_id,
    w.kind,
    w.line,
    w.at,
    case when w.hide then null else w.title end,
    case when w.hide then null else w.place end,
    case when w.hide then null else w.person_name end,
    w.item_count,
    w.hide
  from all_rows w
  order by w.sort_group, w.sort_at, w.sort_id, w.sort_ord;
$$;

-- The content of a delivery held with p_claim_token (same function as part 1). Wrong token,
-- closed or unknown delivery: no row. A delivery with nothing left to say (a notification
-- no longer visible, a summary whose notifications are all gone, a morning digest that is
-- now empty or off): no row, and the delivery is closed without sending (outcome
-- 'skipped'): it is never claimed again.
create or replace function public.get_push_content(
  p_delivery_id uuid,
  p_claim_token uuid
)
returns table (
  notification_id uuid,
  kind public.notification_kind,
  line public.morning_digest_line,
  at timestamptz,
  title text,
  place text,
  person_name text,
  item_count integer,
  is_hidden boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_delivery_id uuid;
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  if p_delivery_id is null or p_claim_token is null then
    raise exception 'invalid delivery' using errcode = '22023';
  end if;

  select d.id into v_delivery_id
  from private.push_deliveries d
  where d.id = p_delivery_id
    and d.claim_token = p_claim_token
    and d.closed_at is null
  for update;

  if v_delivery_id is null then
    return;
  end if;

  return query
    select c.notification_id, c.kind, c.line, c.at, c.title, c.place, c.person_name, c.item_count, c.is_hidden
    from private.push_content(v_delivery_id) c;

  if not found then
    update private.push_deliveries d
    set closed_at = now(),
        outcome = 'skipped',
        claimed_until = null,
        claim_token = null
    where d.id = v_delivery_id;
  end if;
end;
$$;

-- ===========================================================================
-- «Chiedi a Laura di portare Tommaso» (mn1-21): ride_request
-- ===========================================================================
-- RPC (write): the caller asks another adult with an account of the household to take
-- («escort») or pick up («pickup») the people of one occurrence of a «Tutto il Nest» event.
-- - The event is of the caller's household and «Tutto il Nest» (42501 otherwise: «Solo
--   io», «Occupato» and «Solo alcune persone» are never asked about, mn1-39);
-- - p_occurrence_date is a day on which the event has an occurrence (22023 otherwise);
-- - the person asked is a member of the caller's household (22023 otherwise) and an adult
--   with an account other than the caller (23514 otherwise);
-- - one request a day per person asked, occurrence and way, whoever asks: asked again, it
--   writes nothing and gives no error; with «Viaggi» off the person asked gets nothing
--   (question 2 of #511).
-- Accepting goes through the functions of DB-1 (update_event, update_event_occurrence).
-- Security definer (owner: postgres): the recipient is another member, whose
-- notifications the caller cannot write. The person who asks is always the member of the
-- verified session.
create or replace function public.request_ride(
  p_event_id uuid,
  p_occurrence_date date,
  p_leg public.ride_leg,
  p_member_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_member_id uuid;
  v_household_id uuid;
  v_visibility public.event_visibility;
  v_target public.household_members;
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  select m.id, m.household_id into v_member_id, v_household_id
  from public.household_members m
  where m.user_id = (select auth.uid())
    and m.kind = 'adult';

  if v_member_id is null then
    raise exception 'permission denied for function request_ride' using errcode = '42501';
  end if;

  if p_event_id is null or p_occurrence_date is null or p_leg is null or p_member_id is null then
    raise exception 'event, day, way and person are required' using errcode = '22023';
  end if;

  select e.visibility into v_visibility
  from public.events e
  where e.id = p_event_id
    and e.household_id = v_household_id;

  if v_visibility is null or v_visibility <> 'household' then
    raise exception 'permission denied for function request_ride' using errcode = '42501';
  end if;

  select m.* into v_target
  from public.household_members m
  where m.id = p_member_id
    and m.household_id = v_household_id;

  if v_target.id is null then
    raise exception 'invalid person' using errcode = '22023';
  end if;

  if v_target.id = v_member_id or v_target.kind <> 'adult' or v_target.user_id is null then
    raise exception 'only another adult with an account can be asked' using errcode = '23514';
  end if;

  if not exists (select 1 from private.event_occurrence_on(p_event_id, p_occurrence_date)) then
    raise exception 'no occurrence on that day' using errcode = '22023';
  end if;

  if private.notification_recipient_wants(v_target.id, 'rides') then
    insert into public.notifications (
      household_id, recipient_member_id, kind, actor_member_id, event_id, occurrence_date, ride_leg
    )
    values (v_household_id, v_target.id, 'ride_request', v_member_id, p_event_id, p_occurrence_date, p_leg)
    on conflict do nothing;
  end if;
end;
$$;

-- ===========================================================================
-- member_joined: an adult enters the household with an invitation (answer 162)
-- ===========================================================================
-- Same function as 20261118002243 (signature, return type, checks, errors and locks
-- unchanged, so `create or replace` keeps the execute privileges), with one more step: once
-- the invitation is accepted, every other adult with an account of the household receives
-- member_joined, with the person who entered as actor. No switch: always on.
create or replace function public.accept_invitation_with_color(
  p_token text,
  p_color public.member_color
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_invitation public.invitations%rowtype;
  v_current_color public.member_color;
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if p_color is null then
    raise exception 'color is required' using errcode = '22023';
  end if;

  if exists (select 1 from public.household_members m where m.user_id = v_uid) then
    raise exception 'user already belongs to a household' using errcode = 'P0001';
  end if;

  select i.* into v_invitation
  from public.invitations i
  join public.household_members m
    on m.id = i.member_id
   and m.household_id = i.household_id
  where p_token ~ '^[0-9a-f]{64}$'
    and i.token = p_token
    and i.status = 'pending'
    and i.expires_at > now()
    and m.kind = 'adult'
    and m.user_id is null
  for update of i, m;

  if not found then
    raise exception 'invalid invitation' using errcode = 'P0001';
  end if;

  select m.color into v_current_color
  from public.household_members m
  where m.id = v_invitation.member_id;

  if p_color <> v_current_color and exists (
    select 1
    from public.household_members o
    where o.household_id = v_invitation.household_id
      and o.id <> v_invitation.member_id
      and o.color = p_color
  ) then
    raise exception 'color already taken' using errcode = '23505';
  end if;

  update public.household_members m
  set user_id = v_uid,
      joined_at = now(),
      is_admin = false,
      color = p_color
  where m.id = v_invitation.member_id;

  update public.invitations i
  set status = 'accepted',
      accepted_at = now()
  where i.id = v_invitation.id;

  insert into public.notifications (household_id, recipient_member_id, kind, actor_member_id)
  select v_invitation.household_id, m.id, 'member_joined', v_invitation.member_id
  from public.household_members m
  where m.household_id = v_invitation.household_id
    and m.id <> v_invitation.member_id
    and m.kind = 'adult'
    and m.user_id is not null
  order by m.id
  on conflict do nothing;

  return v_invitation.household_id;
end;
$$;

-- ===========================================================================
-- The switches of cb1-45 on the notifications of today
-- ===========================================================================

-- «Regalo preso» (same function as #259), only for the adults with «Regali» on.
create or replace function private.wishlist_reservations_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (household_id, recipient_member_id, kind, wishlist_reservation_id)
  select new.household_id, m.id, 'gift_taken', new.id
  from public.household_members m
  where m.household_id = new.household_id
    and m.kind = 'adult'
    and m.user_id is not null
    and private.notification_recipient_wants(m.id, 'gifts')
  order by m.id
  on conflict do nothing;

  return null;
end;
$$;

-- Job of 9:00 «Scadenza vicina» (same function as #337), only for the adults with
-- «Scadenze» on.
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
        from public.deadline_assignees da
        join public.household_members a on a.id = da.member_id
        where da.deadline_id = d.id
          and a.kind = 'adult'
          and a.user_id is not null
      ) then exists (
        select 1
        from public.deadline_assignees da
        where da.deadline_id = d.id
          and da.member_id = m.id
      )
      when d.is_private then m.id = d.created_by_member_id
      else true
    end
    and private.notification_recipient_wants(m.id, 'deadlines')
  order by d.household_id, d.id, m.id
  on conflict do nothing;

  get diagnostics v_created = row_count;
  return v_created;
end;
$$;

-- ===========================================================================
-- Jobs (every 5 minutes, private.run_scheduled_notification_jobs()). Each one takes
-- p_household_id: only that household; null = every household, used only by the scheduled
-- entry point (review of PR #237). Each one is idempotent (unique indexes): run again, or
-- late within its window, it creates nothing twice. The notifications are created at p_at.
-- Return how many notifications (or deliveries) they created.
-- ===========================================================================

-- «Avviso» of the events (event_reminder): reminder_minutes_before the start of each
-- occurrence (modified occurrences at their own time, removed ones never), when that moment
-- is in the 15 minutes up to p_at and the occurrence has not started. Recipients: the adults
-- with an account among the participants; when there is none, the author (if an adult with
-- an account). Only with «Prima di un tuo impegno» on.
create or replace function private.notifications_event_reminders(p_at timestamptz, p_household_id uuid)
returns integer
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_created integer;
begin
  if p_at is null or not isfinite(p_at) then
    raise exception 'invalid instant' using errcode = '22023';
  end if;

  insert into public.notifications (household_id, recipient_member_id, kind, event_id, occurrence_date, created_at)
  select distinct e.household_id, r.member_id, 'event_reminder'::public.notification_kind, e.id, o.occurrence_date, p_at
  from public.events e
  cross join lateral private.event_occurrences(
    e.id,
    e.starts_at,
    e.ends_at,
    e.recurrence,
    e.recurrence_weekdays,
    e.recurrence_until,
    p_at,
    p_at + make_interval(mins => e.reminder_minutes_before) + interval '1 minute',
    e.all_day
  ) o
  cross join lateral (
    select em.member_id
    from public.event_members em
    join public.household_members m
      on m.id = em.member_id
     and m.kind = 'adult'
     and m.user_id is not null
    where em.event_id = e.id
    union
    select a.id
    from public.household_members a
    where a.id = e.author_member_id
      and a.kind = 'adult'
      and a.user_id is not null
      and not exists (
        select 1
        from public.event_members em
        join public.household_members m
          on m.id = em.member_id
         and m.kind = 'adult'
         and m.user_id is not null
        where em.event_id = e.id
      )
  ) r
  where e.reminder_minutes_before is not null
    and (p_household_id is null or e.household_id = p_household_id)
    and (
      (e.recurrence = 'none' and e.starts_at > p_at)
      or (e.recurrence <> 'none' and (e.recurrence_until is null or e.recurrence_until >= (p_at at time zone 'Europe/Rome')::date - 8))
      or exists (
        select 1 from public.event_exceptions x
        where x.event_id = e.id and not x.is_cancelled and x.starts_at > p_at
      )
    )
    and o.starts_at > p_at
    and o.starts_at - make_interval(mins => e.reminder_minutes_before) <= p_at
    and o.starts_at - make_interval(mins => e.reminder_minutes_before) > p_at - interval '15 minutes'
    and private.notification_recipient_wants(r.member_id, 'event_reminders')
    and private.event_open_to_member(e.id, r.member_id)
  on conflict do nothing;

  get diagnostics v_created = row_count;
  return v_created;
end;
$$;

-- «Avvisa chi porta e chi riprende» (ride_reminder), for events with remind_rides:
-- - the evening before (days_before 1), at 20:00 (Europe/Rome) of the day before the start
--   of the occurrence (question 5 of #511): to who takes («escort») and to who picks up
--   («pickup»); one only when it is the same person;
-- - an hour before (days_before 0): to who takes, an hour before the start; to who picks
--   up, an hour before the end.
-- The people of the occurrence (a modified occurrence has its own); «Da decidere» has
-- nobody: no reminder. When the moment of the reminder is in the 15 minutes up to p_at and
-- the way has not happened yet. Only adults with an account with «Viaggi» on.
create or replace function private.notifications_ride_reminders(p_at timestamptz, p_household_id uuid)
returns integer
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_created integer;
begin
  if p_at is null or not isfinite(p_at) then
    raise exception 'invalid instant' using errcode = '22023';
  end if;

  with occ as (
    select
      e.id as event_id,
      e.household_id,
      o.occurrence_date,
      o.starts_at,
      o.ends_at,
      case when o.is_modified then o.escort_member_id else e.escort_member_id end as escort_member_id,
      case when o.is_modified then o.pickup_member_id else e.pickup_member_id end as pickup_member_id
    from public.events e
    cross join lateral private.event_occurrences(
      e.id,
      e.starts_at,
      e.ends_at,
      e.recurrence,
      e.recurrence_weekdays,
      e.recurrence_until,
      p_at - interval '1 hour',
      p_at + interval '2 days',
      e.all_day
    ) o
    where e.remind_rides
      and (p_household_id is null or e.household_id = p_household_id)
  ),
  legs as (
    select c.event_id, c.household_id, c.occurrence_date, c.starts_at, 'escort'::public.ride_leg as leg,
           c.escort_member_id as member_id, c.starts_at as moment, false as same_person
    from occ c
    where c.escort_member_id is not null
    union all
    select c.event_id, c.household_id, c.occurrence_date, c.starts_at, 'pickup'::public.ride_leg,
           c.pickup_member_id, c.ends_at, c.pickup_member_id is not distinct from c.escort_member_id
    from occ c
    where c.pickup_member_id is not null
  ),
  due as (
    select l.*, 1::smallint as days_before,
           ((((l.starts_at at time zone 'Europe/Rome')::date - 1) + time '20:00') at time zone 'Europe/Rome') as fire_at
    from legs l
    where not l.same_person
    union all
    select l.*, 0::smallint, l.moment - interval '1 hour'
    from legs l
  )
  insert into public.notifications (
    household_id, recipient_member_id, kind, event_id, occurrence_date, ride_leg, days_before, created_at
  )
  select d.household_id, d.member_id, 'ride_reminder', d.event_id, d.occurrence_date, d.leg, d.days_before, p_at
  from due d
  where d.fire_at <= p_at
    and d.fire_at > p_at - interval '15 minutes'
    and d.moment > p_at
    and private.notification_recipient_wants(d.member_id, 'rides')
    and private.event_open_to_member(d.event_id, d.member_id)
  order by d.household_id, d.event_id, d.occurrence_date, d.member_id, d.leg, d.days_before
  on conflict do nothing;

  get diagnostics v_created = row_count;
  return v_created;
end;
$$;

-- Overlapping events of tomorrow (overlap_tomorrow), at the time of the evening summary of
-- each recipient (from that time, for 2 hours): every pair of occurrences that overlap
-- tomorrow (Europe/Rome day after p_at; the overlap starts tomorrow) for the same person,
-- with the same rules as list_event_overlaps() (people: participants, «Lo porta», «Lo
-- riprende»; never «tutto il giorno»; the rows of the calendar of the recipient, one place
-- of the visibility rules). Recipient:
-- - the person, when it is an adult with an account;
-- - otherwise (a child, a pet, an adult without account) the adults with an account who are
--   the author, who takes or who picks up of one of the two;
-- and only when the recipient sees both occurrences in full. Only with «Impegni» on.
create or replace function private.notifications_overlaps(p_at timestamptz, p_household_id uuid)
returns integer
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_today date;
  v_from timestamptz;
  v_to timestamptz;
  v_created integer;
begin
  if p_at is null or not isfinite(p_at) then
    raise exception 'invalid instant' using errcode = '22023';
  end if;

  v_today := (p_at at time zone 'Europe/Rome')::date;
  v_from := ((v_today + 1)::timestamp at time zone 'Europe/Rome');
  v_to := ((v_today + 2)::timestamp at time zone 'Europe/Rome');

  with recipients as (
    select m.id, m.household_id
    from public.household_members m
    left join public.notification_preferences p on p.member_id = m.id
    where m.kind = 'adult'
      and m.user_id is not null
      and (p_household_id is null or m.household_id = p_household_id)
      and ((v_today + coalesce(p.evening_digest_time, time '19:00')) at time zone 'Europe/Rome') <= p_at
      and p_at < ((v_today + coalesce(p.evening_digest_time, time '19:00')) at time zone 'Europe/Rome')
                 + interval '2 hours'
      and private.notification_recipient_wants(m.id, 'events')
  ),
  seen as (
    select
      rc.id as recipient_member_id,
      rc.household_id,
      r.event_id,
      r.occurrence_date,
      r.starts_at,
      r.ends_at,
      r.author_member_id,
      r.escort_member_id,
      r.pickup_member_id,
      p.member_id as person_id
    from recipients rc
    cross join lateral private.household_event_rows_for_member(rc.id, v_from, v_to) r
    cross join lateral unnest(
      private.event_row_people(false, r.author_member_id, r.member_ids, r.escort_member_id, r.pickup_member_id)
    ) as p (member_id)
    where not r.is_masked
      and not r.all_day
  ),
  pairs as (
    select distinct
      a.recipient_member_id,
      a.household_id,
      a.person_id,
      a.event_id,
      a.occurrence_date,
      b.event_id as other_event_id,
      b.occurrence_date as other_occurrence_date,
      array[a.author_member_id, a.escort_member_id, a.pickup_member_id,
            b.author_member_id, b.escort_member_id, b.pickup_member_id] as responsible
    from seen a
    join seen b
      on b.recipient_member_id = a.recipient_member_id
     and b.person_id = a.person_id
     and (a.event_id, a.occurrence_date) < (b.event_id, b.occurrence_date)
     and a.starts_at < b.ends_at
     and b.starts_at < a.ends_at
    where greatest(a.starts_at, b.starts_at) >= v_from
      and greatest(a.starts_at, b.starts_at) < v_to
  )
  insert into public.notifications (
    household_id, recipient_member_id, kind, event_id, occurrence_date, other_event_id, other_occurrence_date,
    subject_member_id, created_at
  )
  select pr.household_id, pr.recipient_member_id, 'overlap_tomorrow', pr.event_id, pr.occurrence_date,
         pr.other_event_id, pr.other_occurrence_date, pr.person_id, p_at
  from pairs pr
  join public.household_members s on s.id = pr.person_id
  where case
    when s.kind = 'adult' and s.user_id is not null then pr.recipient_member_id = pr.person_id
    else pr.recipient_member_id = any (pr.responsible)
  end
  order by pr.household_id, pr.recipient_member_id, pr.person_id, pr.event_id, pr.occurrence_date
  on conflict do nothing;

  get diagnostics v_created = row_count;
  return v_created;
end;
$$;

-- The two summaries to send (rule 5 of #511), for the Europe/Rome day of p_at, from their
-- time for 2 hours, to recipients with at least one device:
-- - «Il riepilogo» (evening_digest) at evening_digest_time: one delivery that carries every
--   notification waiting for it (private.push_digest_items), created up to p_at; none when
--   nothing waits;
-- - «Sintesi del mattino» (morning_digest) at morning_digest_time, on the chosen days, when
--   it is on and not empty (mn1-20); also in the silence of the night.
-- One of each per recipient and day (unique index). Returns how many deliveries it created.
create or replace function private.push_digests(p_at timestamptz, p_household_id uuid)
returns integer
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_today date;
  v_evening integer;
  v_morning integer;
begin
  if p_at is null or not isfinite(p_at) then
    raise exception 'invalid instant' using errcode = '22023';
  end if;

  v_today := (p_at at time zone 'Europe/Rome')::date;

  with due as (
    select
      m.id,
      m.household_id,
      ((v_today + coalesce(p.evening_digest_time, time '19:00')) at time zone 'Europe/Rome') as ring_at
    from public.household_members m
    left join public.notification_preferences p on p.member_id = m.id
    where m.kind = 'adult'
      and m.user_id is not null
      and (p_household_id is null or m.household_id = p_household_id)
  ),
  ready as (
    select d.*
    from due d
    where d.ring_at <= p_at
      and p_at < d.ring_at + interval '2 hours'
      and exists (select 1 from public.push_subscriptions s where s.member_id = d.id)
      and exists (
        select 1
        from private.push_digest_items i
        where i.recipient_member_id = d.id
          and i.delivery_id is null
          and i.created_at <= p_at
      )
  ),
  created as (
    insert into private.push_deliveries (household_id, recipient_member_id, kind, digest_day, due_at)
    select r.household_id, r.id, 'evening_digest', v_today, r.ring_at
    from ready r
    order by r.household_id, r.id
    on conflict do nothing
    returning id, recipient_member_id
  ),
  carried as (
    update private.push_digest_items i
    set delivery_id = c.id
    from created c
    where i.recipient_member_id = c.recipient_member_id
      and i.delivery_id is null
      and i.created_at <= p_at
    returning i.notification_id
  )
  select count(*)::integer into v_evening from created;

  insert into private.push_deliveries (household_id, recipient_member_id, kind, digest_day, due_at)
  select d.household_id, d.id, 'morning_digest', v_today, d.ring_at
  from (
    select
      m.id,
      m.household_id,
      ((v_today + pr.morning_digest_time) at time zone 'Europe/Rome') as ring_at
    from public.household_members m
    join public.profiles pr on pr.id = m.user_id
    left join public.notification_preferences p on p.member_id = m.id
    where m.kind = 'adult'
      and (p_household_id is null or m.household_id = p_household_id)
      and coalesce(p.morning_digest, true)
      and extract(isodow from v_today)::smallint = any (pr.morning_digest_weekdays)
  ) d
  where d.ring_at <= p_at
    and p_at < d.ring_at + interval '2 hours'
    and exists (select 1 from public.push_subscriptions s where s.member_id = d.id)
    and not exists (
      select 1
      from private.push_deliveries x
      where x.recipient_member_id = d.id
        and x.kind = 'morning_digest'
        and x.digest_day = v_today
    )
    and exists (select 1 from private.morning_digest(d.id, v_today))
  order by d.household_id, d.id
  on conflict do nothing;

  get diagnostics v_morning = row_count;
  return v_evening + v_morning;
end;
$$;

-- ---------------------------------------------------------------------------
-- Run by pg_cron every 5 minutes (schedule migration), for every household (same function
-- and return value as #229):
-- - in the first 5 minutes of the hours of Rome of today's jobs, those jobs: 8:00 «Liberi
--   insieme», 9:00 deadlines, 19:00 shopping, 3:00 cleanup (with the cleanup of the push
--   devices and deliveries, push_purge). Returns that job, or null (pgTAP checks a winter
--   and a summer hour);
-- - at every run, after them: the reminders of the events and of the rides, the
--   overlapping events of tomorrow, then the summaries to send (which carry what the jobs
--   before them created).
-- Every job is idempotent: a late or repeated run creates nothing twice.
-- ---------------------------------------------------------------------------
create or replace function private.run_scheduled_notification_jobs(p_at timestamptz default now())
returns public.notification_job
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_local timestamp := p_at at time zone 'Europe/Rome';
  v_hour integer := extract(hour from v_local)::integer;
  v_first_minutes boolean := extract(minute from v_local) < 5;
  v_job public.notification_job;
begin
  if v_first_minutes then
    if v_hour = 8 then
      perform private.notifications_free_together(p_at, null);
      v_job := 'free_together';
    elsif v_hour = 9 then
      perform private.notifications_deadline_reminders(p_at, null);
      v_job := 'deadline_reminders';
    elsif v_hour = 19 then
      perform private.notifications_shopping_digest(p_at, null);
      v_job := 'shopping_digest';
    elsif v_hour = 3 then
      perform private.purge_notifications(p_at, null);
      perform private.push_purge(p_at, null);
      v_job := 'purge';
    end if;
  end if;

  perform private.notifications_event_reminders(p_at, null);
  perform private.notifications_ride_reminders(p_at, null);
  perform private.notifications_overlaps(p_at, null);
  perform private.push_digests(p_at, null);

  return v_job;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC for the tests (same function as #229, with the five jobs of #511): runs one job for
-- ONE household (p_household_id, required) as if it ran at the instant p_at. Returns how
-- many notifications it created (deleted for the cleanup; deliveries for push_digests; 0
-- for push_purge). service_role and the database owner only (grants of #229, kept by
-- `create or replace`). Only POST through the Data API.
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

  if p_job = 'push_purge' then
    perform private.push_purge(p_at, p_household_id);
    return 0;
  end if;

  return case p_job
    when 'free_together' then private.notifications_free_together(p_at, p_household_id)
    when 'deadline_reminders' then private.notifications_deadline_reminders(p_at, p_household_id)
    when 'shopping_digest' then private.notifications_shopping_digest(p_at, p_household_id)
    when 'purge' then private.purge_notifications(p_at, p_household_id)
    when 'event_reminders' then private.notifications_event_reminders(p_at, p_household_id)
    when 'ride_reminders' then private.notifications_ride_reminders(p_at, p_household_id)
    when 'overlaps' then private.notifications_overlaps(p_at, p_household_id)
    when 'push_digests' then private.push_digests(p_at, p_household_id)
  end;
end;
$$;
