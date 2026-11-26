-- Issue #511 (DB-2 «Notifiche 2.0», plan #501), part 1 of 2: columns, tables and
-- constraints.
--
-- 1. notification_preferences: how the phone rings («Come vuoi riceverle», «Il riepilogo»,
--    «Silenzio di notte», «Nascondi il contenuto»). Personal as today (#217).
-- 2. profiles.morning_digest_weekdays: the days of the morning digest (mn1-16). The time
--    of the digest (07:15, quarters of an hour) comes with part 2 of #511.
-- 3. notifications: a unique key (id, recipient_member_id, household_id), target of the
--    composite foreign key of private.push_deliveries.
-- 4. public.push_subscriptions: the devices of each adult with an account (web, APNs, FCM).
-- 5. private.push_deliveries: what the sending service (F8 #508) has to deliver, to whom
--    and when. Filled by the rules of part 2 of #511; the functions of the service are in
--    the next migration.
--
-- RLS is enabled here, in the same migration that creates each table. Policies and grants
-- are in the notifications_2_policies_and_grants migration: until then RLS denies every row
-- to the API roles.
--
-- Stored personal data (privacy skill): the only new personal datum is the push address of
-- a device (endpoint and keys, or token), needed to make the phone ring. The app never
-- reads it (column privileges); it goes when the member leaves the household or deletes the
-- account (composite foreign key, on delete cascade), with «Esci» (the page calls
-- unregister_push_subscription()), when the push service says it is gone
-- (remove_push_subscription()) and after 90 days without use (private.push_purge()).
-- Nothing about children. The deliveries hold only references and instants: titles and
-- names are read by get_push_content() when the push is sent, never stored.

-- ===========================================================================
-- Helpers of the check constraints (immutable, one source for the table and the functions
-- that write, which raise 22023 before writing).
-- ===========================================================================

-- A time of the day between p_from and p_to (included) on a quarter of an hour: no
-- seconds, minutes 00, 15, 30 or 45.
create or replace function private.is_quarter_hour_between(p_time time, p_from time, p_to time)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_time between p_from and p_to
    and extract(second from p_time) = 0
    and extract(minute from p_time)::integer % 15 = 0;
$$;

-- The days of the week of the morning digest: a one-dimensional list of ISO days
-- (1 = Monday … 7 = Sunday), not empty, without nulls and without repetitions.
create or replace function private.digest_weekdays_valid(p_days smallint[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_ndims(p_days), 0) = 1
    and array_position(p_days, null) is null
    and p_days <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]
    and cardinality(p_days) = (select count(distinct d.day) from unnest(p_days) as d (day));
$$;

-- The push address of a device, by platform (question 4 of #511 for the hosts of the web):
-- - web:  endpoint https on fcm.googleapis.com, *.push.services.mozilla.com,
--         *.notify.windows.com or *.push.apple.com (never an internal address: no port, no
--         user, no other host), at most 2048 characters; p256dh base64url of 87 characters
--         (a P-256 public key), auth base64url of 22 (16 bytes); no token;
-- - apns: token hexadecimal (lower case) of 64 to 200 characters; nothing else;
-- - fcm:  token of 1 to 4096 characters among A-Z a-z 0-9 _ : -; nothing else.
-- Hosts in lower case only. PostgreSQL limits a regex bound to 255: the length of the FCM
-- token is checked apart.
create or replace function private.push_subscription_is_valid(
  p_platform public.push_platform,
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_token text
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    case p_platform
      when 'web' then
        p_token is null
        and char_length(p_endpoint) <= 2048
        and p_endpoint ~ '^https://(fcm\.googleapis\.com|([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+(push\.services\.mozilla\.com|notify\.windows\.com|push\.apple\.com))(/[A-Za-z0-9._~:/?#@!$&''()*+,;=%-]*)?$'
        and p_p256dh ~ '^[A-Za-z0-9_-]{87}$'
        and p_auth ~ '^[A-Za-z0-9_-]{22}$'
      when 'apns' then
        num_nonnulls(p_endpoint, p_p256dh, p_auth) = 0
        and p_token ~ '^[0-9a-f]{64,200}$'
      when 'fcm' then
        num_nonnulls(p_endpoint, p_p256dh, p_auth) = 0
        and char_length(p_token) between 1 and 4096
        and p_token ~ '^[A-Za-z0-9_:-]+$'
    end,
    false
  );
$$;

-- Evaluated as the role that writes by the check constraints below (as
-- child_school_days_valid of 20261104164919): the app (authenticated) and the
-- administrative key (service_role). Never anon.
revoke execute on function private.is_quarter_hour_between(time, time, time) from public, anon;
revoke execute on function private.digest_weekdays_valid(smallint[]) from public, anon;
revoke execute on function private.push_subscription_is_valid(public.push_platform, text, text, text, text)
  from public, anon;
grant execute on function private.is_quarter_hour_between(time, time, time) to authenticated, service_role;
grant execute on function private.digest_weekdays_valid(smallint[]) to authenticated, service_role;
grant execute on function private.push_subscription_is_valid(public.push_platform, text, text, text, text)
  to authenticated, service_role;

-- ===========================================================================
-- 1. notification_preferences: how the phone rings
-- ===========================================================================
-- The existing rows get the defaults when the columns are added; get_notification_
-- preferences() gives the new columns with part 2 of #511 (with the switches of cb1-45),
-- so that its result changes once.
alter table public.notification_preferences
  -- «Come vuoi riceverle»: «Subito quelle per me» by default.
  add column delivery_mode public.notification_delivery_mode not null default 'mine_now',
  -- «Il riepilogo · Ogni sera alle 19:00»: a time of the day in Europe/Rome.
  add column evening_digest_time time not null default '19:00',
  -- «Silenzio di notte · 22:00–7:00» (fixed hours, question 6 of #511): on by default.
  add column quiet_hours boolean not null default true,
  -- «Nascondi il contenuto» (mn1-39): no title, place or name in the push. Off by default.
  add column hide_content boolean not null default false;

-- «Il riepilogo»: every quarter of an hour from 07:00 to 21:45 (rule 2 of #511).
alter table public.notification_preferences
  add constraint notification_preferences_evening_digest_time_allowed check (
    private.is_quarter_hour_between(evening_digest_time, '07:00', '21:45')
  );

-- ===========================================================================
-- 2. profiles: the days of the morning digest
-- ===========================================================================
alter table public.profiles
  -- «Sintesi del mattino» → days (mn1-16): Monday to Friday by default.
  add column morning_digest_weekdays smallint[] not null default '{1,2,3,4,5}';

alter table public.profiles
  add constraint profiles_morning_digest_weekdays_valid check (
    private.digest_weekdays_valid(morning_digest_weekdays)
  );

-- ===========================================================================
-- 3. notifications: target of the composite foreign key of the deliveries
-- ===========================================================================
-- id is already unique: this only lets a delivery check that its notification belongs to
-- the same recipient and household.
alter table public.notifications
  add constraint notifications_id_recipient_household_key
    unique (id, recipient_member_id, household_id);

-- ===========================================================================
-- 4. push_subscriptions: the devices of an adult with an account
-- ===========================================================================
-- Written only by the database: register_push_subscription(), unregister_push_
-- subscription(), remove_push_subscription(), private.push_purge() (next migration). The
-- app reads only id, platform, created_at and last_seen_at of its own rows (column
-- privileges and RLS, policies migration). Personal also inside the household: the other
-- adults (administrators included) never see them.
-- Same-household rule without triggers: the member goes through the composite foreign key
-- household_members (id, household_id), on delete cascade (leaves the household, deletes
-- the account, household deleted).
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  -- Always an adult with an account (checked by register_push_subscription()).
  member_id uuid not null,
  platform public.push_platform not null,
  -- web only: the address of the push service and the two keys of the browser.
  endpoint text,
  p256dh text,
  auth text,
  -- apns and fcm only: the device token.
  token text,
  created_at timestamptz not null default now(),
  -- Last registration of the device (the app registers it again when it opens). After 90
  -- days without use the device is removed (private.push_purge()).
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint push_subscriptions_member_fkey foreign key (member_id, household_id)
    references public.household_members (id, household_id) on delete cascade,
  -- The fields of each platform, nothing else (one source with register_push_subscription()).
  constraint push_subscriptions_platform_fields check (
    private.push_subscription_is_valid(platform, endpoint, p256dh, auth, token)
  ),
  constraint push_subscriptions_last_seen_at_finite check (isfinite(last_seen_at)),
  -- One row per address in the whole database: the same phone with another account takes
  -- the row over (register_push_subscription()).
  constraint push_subscriptions_endpoint_key unique (endpoint)
);

-- One row per token in the whole database. An FCM token may reach 4096 characters, too long
-- for a b-tree entry: the index is on its md5 (the functions compare the token itself too).
create unique index push_subscriptions_token_key
  on public.push_subscriptions (md5(token)) where token is not null;
-- The devices of a member (RLS, limit of 10, list_push_targets()); leading column also
-- indexes the composite foreign key (cascade when a member leaves).
create index push_subscriptions_member_id_idx on public.push_subscriptions (member_id);
-- Foreign key towards households (cascade when a household is deleted).
create index push_subscriptions_household_id_idx on public.push_subscriptions (household_id);
-- Removal of the devices not used for 90 days, across households.
create index push_subscriptions_last_seen_at_idx on public.push_subscriptions (last_seen_at);

alter table public.push_subscriptions enable row level security;

-- ===========================================================================
-- 5. private.push_deliveries: one push to send
-- ===========================================================================
-- - single: one notification (notification_id), for its recipient;
-- - evening_digest, morning_digest: one per recipient and day (digest_day, Europe/Rome).
-- due_at: when it rings. The sending service claims the due rows for 5 minutes with a claim
-- token (claimed_until, claim_token), as calendar_outbox (#373), then completes or fails
-- them. A closed delivery (closed_at, outcome) is never claimed again and is deleted 2 days
-- later (private.push_purge()).
--   outcome  sent     delivered to the push service
--            failed   5 failed attempts: never again
--            skipped  closed without sending (the notification is no longer visible)
-- The "private" schema is not exposed by the Data API and no API role has a privilege on
-- this table (policies migration); RLS is enabled with no policy.
-- On delete cascade: the delivery goes with its recipient (leaves the household, deletes
-- the account), with its notification, and with the household.
create table private.push_deliveries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  recipient_member_id uuid not null,
  kind public.push_delivery_kind not null,
  notification_id uuid,
  digest_day date,
  due_at timestamptz not null,
  attempts integer not null default 0,
  claimed_until timestamptz,
  claim_token uuid,
  closed_at timestamptz,
  outcome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint push_deliveries_recipient_fkey foreign key (recipient_member_id, household_id)
    references public.household_members (id, household_id) on delete cascade,
  -- The notification belongs to the same recipient and household.
  constraint push_deliveries_notification_fkey foreign key (notification_id, recipient_member_id, household_id)
    references public.notifications (id, recipient_member_id, household_id) on delete cascade,

  constraint push_deliveries_kind_fields check (
    case kind
      when 'single' then notification_id is not null and digest_day is null
      else notification_id is null and digest_day is not null
    end
  ),
  constraint push_deliveries_due_at_finite check (isfinite(due_at)),
  constraint push_deliveries_attempts_range check (attempts between 0 and 5),
  constraint push_deliveries_claim_together check (
    (claim_token is null) = (claimed_until is null)
    and (claimed_until is null or isfinite(claimed_until))
  ),
  constraint push_deliveries_closed_with_outcome check (
    (closed_at is null) = (outcome is null)
    and (outcome is null or outcome in ('sent', 'failed', 'skipped'))
    and (closed_at is null or claim_token is null)
  )
);

-- One delivery per notification; also indexes the composite foreign key towards
-- notifications (cascade when a notification is deleted).
create unique index push_deliveries_single_key
  on private.push_deliveries (notification_id) where kind = 'single';
-- One digest of each kind per recipient and day.
create unique index push_deliveries_digest_key
  on private.push_deliveries (recipient_member_id, kind, digest_day) where kind <> 'single';
-- Foreign keys (cascade when a member leaves, when a household is deleted).
create index push_deliveries_recipient_member_id_idx on private.push_deliveries (recipient_member_id);
create index push_deliveries_household_id_idx on private.push_deliveries (household_id);
-- The open deliveries by due time (claim_push_deliveries()).
create index push_deliveries_due_idx on private.push_deliveries (due_at, id) where closed_at is null;
-- Removal of the closed deliveries after 2 days.
create index push_deliveries_closed_at_idx on private.push_deliveries (closed_at) where closed_at is not null;

-- No policy: even with a privilege, an API role would read and write 0 rows.
alter table private.push_deliveries enable row level security;
