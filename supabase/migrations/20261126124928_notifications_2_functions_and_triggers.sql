-- Issue #511 (DB-2 «Notifiche 2.0», plan #501), part 1 of 2: functions and triggers of the
-- ways of receiving, of the devices and of the sending service (F8 #508).
--
-- Conventions (same as the notifications migrations of #229 and the outbox of #373):
-- - every function has `set search_path = ''` and fully qualified names;
-- - helpers and jobs live in the "private" schema (not exposed by the Data API, not in the
--   generated types);
-- - the functions of the page that write refuse every Data API method other than POST
--   (lesson of #112); so do all the functions of the sending service;
-- - one single place for what a notification lets its recipient see:
--   private.notification_is_visible(p_notification_id), used by the select policy of
--   notifications (policies migration) and by private.push_content() (LEZIONI: no rule
--   copied in two functions);
-- - one single place for what a push may say: private.push_content(), read only through
--   get_push_content().
-- Execute grants are in the notifications_2_policies_and_grants migration.
--
-- Error codes:
-- - 42501: no signed-in user, or a caller without household (or no privilege);
-- - 22023: invalid arguments (a time or days outside the allowed values, a device address
--   that is not valid for its platform, a limit outside 1–50, an instant missing or not
--   finite);
-- - 23514: an eleventh device of the same member;
-- - P0001 'use POST': called through the Data API with a method other than POST.

create trigger push_subscriptions_set_updated_at
  before update on public.push_subscriptions
  for each row execute function public.set_updated_at();

create trigger push_deliveries_set_updated_at
  before update on private.push_deliveries
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- What a member may see
-- ===========================================================================

-- True when the member sees the event in full: the same rule as the select policy of
-- events (events_2_policies_and_grants), for a member given by id instead of the session:
-- an event of the member's household that is «Tutto il Nest», or in which the member is
-- the author, the escort, the person who picks up, a participant or, for «Solo alcune
-- persone», a chosen person. pgTAP checks that it gives the same answer as the policy.
-- Owner only, security invoker, trusts its arguments (called by the security definer
-- functions below).
create or replace function private.event_open_to_member(p_event_id uuid, p_member_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.events e
    join public.household_members m
      on m.id = p_member_id
     and m.household_id = e.household_id
    where e.id = p_event_id
      and (
        e.visibility = 'household'
        or e.author_member_id = m.id
        or e.escort_member_id = m.id
        or e.pickup_member_id = m.id
        or exists (
          select 1
          from public.event_members em
          where em.event_id = e.id
            and em.member_id = m.id
        )
        or (
          e.visibility = 'selected'
          and exists (
            select 1
            from public.event_viewers v
            where v.event_id = e.id
              and v.member_id = m.id
          )
        )
      )
  );
$$;

-- True while the notification may be shown to its recipient (same rules as #229 and #259,
-- now in one place for the page and the push):
-- - the recipient is an adult with an account of the household of the notification;
-- - todo_assigned: the thing to do exists and the recipient sees it (not «Solo io» of
--   someone else: select policy of todos);
-- - deadline_reminder: the deadline exists and the recipient sees it
--   (private.deadline_open_to_member(), select policy of deadlines);
-- - event_time_changed: the recipient sees the event in full
--   (private.event_open_to_member()) and, for one occurrence, that day is still an
--   occurrence of the series and was not removed;
-- - gift_taken: the reservation still exists in the household;
-- - free_together, shopping_added: no element of origin;
-- - any other kind: false (fail closed: part 2 of #511 gives each new kind its rule).
-- Called by the select policy of notifications as the reader: for a signed-in caller it is
-- true only for the notifications of the caller (an extra guard: the policy already asks
-- for the recipient). Without a session (the sending service, the jobs) it answers for the
-- recipient of the notification.
-- Security definer (owner: postgres): the reads do not depend on the RLS of the caller, so
-- the page and the push give the same answer.
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
        else false
      end
  );
$$;

-- ===========================================================================
-- What a push may say (rule 8 of #511): the only source, read by get_push_content()
-- ===========================================================================
-- One row per notification of the delivery, only while it is visible to the recipient
-- (private.notification_is_visible()); no row when it is not (the caller closes the
-- delivery without sending).
-- - notification_id, kind: the notification; line: null for a single notification;
-- - at: when it happens (Europe/Rome for a day without time, at 0:00):
--   todo_assigned → the day «Entro quando»; deadline_reminder → the due day;
--   event_time_changed → the start of the occurrence (or of the event, when it does not
--   repeat; null for a change of a whole series); free_together → the start of the window;
-- - title: of the thing to do, of the deadline, of the event (of the occurrence when it was
--   modified). Never for an event that is not «Tutto il Nest» (mn1-39): «Solo io»,
--   «Occupato» and «Solo alcune persone» give no title and no place, also to the people
--   involved;
-- - place: of a «Tutto il Nest» event only;
-- - person_name: who acted (assigned, changed the time, added to the shopping list);
-- - item_count: how many things were added to the shopping list;
-- - is_hidden: «Nascondi il contenuto» of the recipient: then title, place and person_name
--   are always null.
-- gift_taken gives only its kind (part 2 of #511 decides whether the push shows more).
-- The texts are composed by F8. The digests (evening_digest, morning_digest) come with
-- part 2 of #511: until then they give no row.
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
      pd.notification_id,
      pd.recipient_member_id,
      coalesce(p.hide_content, false) as hide
    from private.push_deliveries pd
    left join public.notification_preferences p on p.member_id = pd.recipient_member_id
    where pd.id = p_delivery_id
      and pd.kind = 'single'
  ),
  single_rows as (
    select
      n.id as notification_id,
      n.kind,
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
      end as happens_at,
      case n.kind
        when 'todo_assigned' then t.title
        when 'deadline_reminder' then dl.title
        when 'event_time_changed' then
          case when e.visibility = 'household' then coalesce(x.title, e.title) end
      end as title,
      case
        when n.kind = 'event_time_changed' and e.visibility = 'household' then
          case when x.event_id is not null then x.location else e.location end
      end as place,
      case
        when n.kind in ('todo_assigned', 'event_time_changed', 'shopping_added') then a.name
      end as person_name,
      n.item_count,
      d.hide
    from delivery d
    join public.notifications n
      on n.id = d.notification_id
     and n.recipient_member_id = d.recipient_member_id
    left join public.todos t on t.id = n.todo_id
    left join public.deadlines dl on dl.id = n.deadline_id
    left join public.events e on e.id = n.event_id
    left join public.event_exceptions x
      on x.event_id = n.event_id
     and x.occurrence_date = n.occurrence_date
     and not x.is_cancelled
    left join public.household_members a on a.id = n.actor_member_id
    where private.notification_is_visible(n.id)
  )
  select
    s.notification_id,
    s.kind,
    null::public.morning_digest_line,
    s.happens_at,
    case when s.hide then null else s.title end,
    case when s.hide then null else s.place end,
    case when s.hide then null else s.person_name end,
    s.item_count,
    s.hide
  from single_rows s;
$$;

-- ===========================================================================
-- Preferences of the page (A18 #551)
-- ===========================================================================

-- RPC (write): one switch of the caller (same function as #217, with «Silenzio di notte»
-- and «Nascondi il contenuto»). Only the column of the touched switch changes.
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
    hide_content = case when p_preference = 'hide_content' then p_enabled else p.hide_content end
  where p.member_id = (select private.current_member_id());
end;
$$;

-- RPC (write): «Come vuoi riceverle», the time of «Il riepilogo» and the days of the
-- morning digest of the caller. A null argument leaves its value as it is; all null:
-- nothing changes and nothing is written.
-- Every value is checked before anything is written (22023: a time that is not a quarter
-- of an hour from 07:00 to 21:45; days empty, outside 1–7, repeated or null), so a refused
-- call changes nothing. The days are saved in order.
-- Security invoker: the caller writes only its own preferences and its own profile (RLS).
create or replace function public.set_notification_options(
  p_delivery_mode public.notification_delivery_mode default null,
  p_evening_digest_time time default null,
  p_morning_digest_weekdays smallint[] default null
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

  if (select auth.uid()) is null or (select private.current_member_id()) is null then
    raise exception 'not a member of a household' using errcode = '42501';
  end if;

  if p_evening_digest_time is not null
     and not private.is_quarter_hour_between(p_evening_digest_time, '07:00', '21:45') then
    raise exception 'invalid evening digest time' using errcode = '22023';
  end if;

  if p_morning_digest_weekdays is not null
     and not private.digest_weekdays_valid(p_morning_digest_weekdays) then
    raise exception 'invalid morning digest days' using errcode = '22023';
  end if;

  if p_delivery_mode is not null or p_evening_digest_time is not null then
    insert into public.notification_preferences default values
    on conflict (member_id) do nothing;

    update public.notification_preferences p
    set
      delivery_mode = coalesce(p_delivery_mode, p.delivery_mode),
      evening_digest_time = coalesce(p_evening_digest_time, p.evening_digest_time)
    where p.member_id = (select private.current_member_id());
  end if;

  if p_morning_digest_weekdays is not null then
    update public.profiles p
    set morning_digest_weekdays = (
      select array_agg(d.day order by d.day) from unnest(p_morning_digest_weekdays) as d (day)
    )
    where p.id = (select auth.uid());
  end if;
end;
$$;

-- ===========================================================================
-- Devices of the page (F8 #508, mn1-36, mn1-37, «Esci»)
-- ===========================================================================

-- RPC (write): the caller's device. Returns its id.
-- - The address must be valid for its platform (private.push_subscription_is_valid(),
--   22023): web with endpoint, p256dh and auth; apns and fcm with the token only. An APNs
--   token is saved in lower case.
-- - Same address already saved for the caller: the same row, with the keys sent now and
--   last_seen_at = now().
-- - Same address saved for another adult (the same phone with another account, also of
--   another household): the old row is deleted and a new one is created for the caller,
--   so nothing of the previous owner passes on.
-- - At most 10 devices per member (23514). The count runs under a lock of the member
--   (LEZIONI), then a lock of the address, so two registrations of the same address never
--   both create a row; the locks are always taken in this order.
-- Security definer (owner: postgres): the app has no insert or update privilege on
-- push_subscriptions. The member is always the one of the verified session.
create or replace function public.register_push_subscription(
  p_platform public.push_platform,
  p_endpoint text default null,
  p_p256dh text default null,
  p_auth text default null,
  p_token text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c_max_devices constant integer := 10;
  v_member_id uuid;
  v_household_id uuid;
  v_token text := case when p_platform = 'apns' then lower(p_token) else p_token end;
  v_existing_id uuid;
  v_existing_member_id uuid;
  v_id uuid;
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  select m.id, m.household_id into v_member_id, v_household_id
  from public.household_members m
  where m.user_id = (select auth.uid())
    and m.kind = 'adult';

  if v_member_id is null then
    raise exception 'not a member of a household' using errcode = '42501';
  end if;

  if p_platform is null
     or not private.push_subscription_is_valid(p_platform, p_endpoint, p_p256dh, p_auth, v_token) then
    raise exception 'invalid push subscription' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('public.push_subscriptions:member:' || v_member_id::text, 0));
  perform pg_advisory_xact_lock(
    hashtextextended('public.push_subscriptions:address:' || coalesce(p_endpoint, v_token), 0)
  );

  if p_platform = 'web' then
    select s.id, s.member_id into v_existing_id, v_existing_member_id
    from public.push_subscriptions s
    where s.endpoint = p_endpoint
    for update;
  else
    select s.id, s.member_id into v_existing_id, v_existing_member_id
    from public.push_subscriptions s
    where md5(s.token) = md5(v_token)
      and s.token = v_token
    for update;
  end if;

  if v_existing_id is not null and v_existing_member_id = v_member_id then
    update public.push_subscriptions s
    set platform = p_platform,
        p256dh = p_p256dh,
        auth = p_auth,
        last_seen_at = now()
    where s.id = v_existing_id;
    return v_existing_id;
  end if;

  if (select count(*) from public.push_subscriptions s where s.member_id = v_member_id) >= c_max_devices then
    raise exception 'at most 10 devices per member' using errcode = '23514';
  end if;

  if v_existing_id is not null then
    delete from public.push_subscriptions s where s.id = v_existing_id;
  end if;

  insert into public.push_subscriptions (household_id, member_id, platform, endpoint, p256dh, auth, token)
  values (v_household_id, v_member_id, p_platform, p_endpoint, p_p256dh, p_auth, v_token)
  returning id into v_id;

  return v_id;
end;
$$;

-- RPC (write): forgets one device of the caller («Esci», permission taken back), given by
-- its endpoint (web) or its token (apns, fcm): exactly one of the two (22023). Deletes only
-- a row of the caller; an address of somebody else, or unknown, changes nothing and gives
-- no error.
-- Security definer (owner: postgres): the app has no delete privilege on
-- push_subscriptions.
create or replace function public.unregister_push_subscription(
  p_endpoint text default null,
  p_token text default null
)
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

  select m.id into v_member_id
  from public.household_members m
  where m.user_id = (select auth.uid());

  if v_member_id is null then
    raise exception 'not a member of a household' using errcode = '42501';
  end if;

  if num_nonnulls(p_endpoint, p_token) <> 1 then
    raise exception 'one endpoint or one token is required' using errcode = '22023';
  end if;

  if p_endpoint is not null then
    delete from public.push_subscriptions s
    where s.member_id = v_member_id
      and s.endpoint = p_endpoint;
  else
    delete from public.push_subscriptions s
    where s.member_id = v_member_id
      and md5(s.token) in (md5(p_token), md5(lower(p_token)))
      and s.token in (p_token, lower(p_token));
  end if;
end;
$$;

-- ===========================================================================
-- Sending service (F8 #508): service_role only, POST only (as calendar_outbox, #373)
-- ===========================================================================
-- How the service uses it: claim the due deliveries, then for each one read the devices
-- (list_push_targets) and the content (get_push_content), send, then complete or fail it
-- with its claim token; a device the push service no longer knows is removed with
-- remove_push_subscription(). Security definer (owner: postgres): no API role has a
-- privilege on private.push_deliveries; execution is granted to service_role only.

-- The deliveries to send now, held by the caller for 5 minutes:
-- - open (not closed), due (due_at not after p_at), with fewer than 5 attempts;
-- - free: never claimed, or the claim has expired (claimed_until not after now(), the real
--   time of the database, never p_at);
-- - the oldest due first; rows locked by another run are skipped, never waited for.
-- Returns the claimed rows with the claim token (the same for every row of this call).
create or replace function public.claim_push_deliveries(
  p_limit integer,
  p_at timestamptz default now()
)
returns table (
  id uuid,
  kind public.push_delivery_kind,
  attempts integer,
  claim_token uuid
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  c_max_items constant integer := 50;
  c_max_attempts constant integer := 5;
  c_claim constant interval := interval '5 minutes';
  v_token uuid := gen_random_uuid();
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  if p_limit is null or p_limit not between 1 and c_max_items
     or p_at is null or not isfinite(p_at) then
    raise exception 'invalid claim' using errcode = '22023';
  end if;

  return query
    with due as (
      select d.id
      from private.push_deliveries d
      where d.closed_at is null
        and d.due_at <= p_at
        and d.attempts < c_max_attempts
        and (d.claimed_until is null or d.claimed_until <= now())
      order by d.due_at, d.id
      limit p_limit
      for update of d skip locked
    )
    update private.push_deliveries d
    set claimed_until = now() + c_claim,
        claim_token = v_token
    from due
    where d.id = due.id
    returning d.id, d.kind, d.attempts, d.claim_token;
end;
$$;

-- The devices of the recipient of a delivery held with p_claim_token, with their addresses
-- and keys, to send the push. Wrong token, closed or unknown delivery: no row.
create or replace function public.list_push_targets(
  p_delivery_id uuid,
  p_claim_token uuid
)
returns table (
  id uuid,
  platform public.push_platform,
  endpoint text,
  p256dh text,
  auth text,
  token text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  if p_delivery_id is null or p_claim_token is null then
    raise exception 'invalid delivery' using errcode = '22023';
  end if;

  return query
    select s.id, s.platform, s.endpoint, s.p256dh, s.auth, s.token
    from private.push_deliveries d
    join public.push_subscriptions s
      on s.member_id = d.recipient_member_id
     and s.household_id = d.household_id
    where d.id = p_delivery_id
      and d.claim_token = p_claim_token
      and d.closed_at is null
    order by s.created_at, s.id;
end;
$$;

-- The content of a delivery held with p_claim_token (private.push_content(), rule 8 of
-- #511). Wrong token, closed or unknown delivery: no row. A single notification that is no
-- longer visible to its recipient: no row, and the delivery is closed without sending
-- (outcome 'skipped'): it is never claimed again.
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
  v_kind public.push_delivery_kind;
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  if p_delivery_id is null or p_claim_token is null then
    raise exception 'invalid delivery' using errcode = '22023';
  end if;

  select d.id, d.kind into v_delivery_id, v_kind
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

  if not found and v_kind = 'single' then
    update private.push_deliveries d
    set closed_at = now(),
        outcome = 'skipped',
        claimed_until = null,
        claim_token = null
    where d.id = v_delivery_id;
  end if;
end;
$$;

-- The delivery was handed to the push service: closed (outcome 'sent'), never claimed
-- again. Returns false, changing nothing, when the delivery is not held with p_claim_token
-- (another run took it after the claim expired, or it is already closed or gone).
create or replace function public.complete_push_delivery(
  p_delivery_id uuid,
  p_claim_token uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  if p_delivery_id is null or p_claim_token is null then
    raise exception 'invalid delivery' using errcode = '22023';
  end if;

  update private.push_deliveries d
  set closed_at = now(),
      outcome = 'sent',
      claimed_until = null,
      claim_token = null
  where d.id = p_delivery_id
    and d.claim_token = p_claim_token
    and d.closed_at is null;

  return found;
end;
$$;

-- The delivery could not be sent: one more attempt, due again at p_retry_at and free for
-- any run. At the fifth failed attempt it is closed (outcome 'failed'): never again.
-- Returns false, changing nothing, when the delivery is not held with p_claim_token.
create or replace function public.fail_push_delivery(
  p_delivery_id uuid,
  p_claim_token uuid,
  p_retry_at timestamptz
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c_max_attempts constant integer := 5;
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  if p_delivery_id is null or p_claim_token is null
     or p_retry_at is null or not isfinite(p_retry_at) then
    raise exception 'invalid delivery' using errcode = '22023';
  end if;

  update private.push_deliveries d
  set attempts = d.attempts + 1,
      due_at = case when d.attempts + 1 >= c_max_attempts then d.due_at else p_retry_at end,
      closed_at = case when d.attempts + 1 >= c_max_attempts then now() end,
      outcome = case when d.attempts + 1 >= c_max_attempts then 'failed' end,
      claimed_until = null,
      claim_token = null
  where d.id = p_delivery_id
    and d.claim_token = p_claim_token
    and d.closed_at is null;

  return found;
end;
$$;

-- A device the push service no longer knows (gone, unsubscribed): deleted. Returns false
-- when it was already gone.
create or replace function public.remove_push_subscription(p_subscription_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  if p_subscription_id is null then
    raise exception 'invalid device' using errcode = '22023';
  end if;

  delete from public.push_subscriptions s
  where s.id = p_subscription_id;

  return found;
end;
$$;

-- ===========================================================================
-- Cleanup (job push_purge: scheduled with the notification jobs in part 2 of #511)
-- ===========================================================================
-- - devices not registered again for more than 90 days before p_at;
-- - closed deliveries closed more than 2 days before p_at.
-- p_household_id: only that household (tests); null: every household (the scheduled job).
-- Owner only, security invoker (runs as pg_cron, the owner).
create or replace function private.push_purge(p_at timestamptz, p_household_id uuid)
returns void
language plpgsql
volatile
set search_path = ''
as $$
begin
  if p_at is null or not isfinite(p_at) then
    raise exception 'invalid instant' using errcode = '22023';
  end if;

  delete from public.push_subscriptions s
  where s.last_seen_at < p_at - interval '90 days'
    and (p_household_id is null or s.household_id = p_household_id);

  delete from private.push_deliveries d
  where d.closed_at is not null
    and d.closed_at < p_at - interval '2 days'
    and (p_household_id is null or d.household_id = p_household_id);
end;
$$;
