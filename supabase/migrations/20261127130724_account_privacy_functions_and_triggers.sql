-- Issue #513 (DB-4 «Account e privacy», plan #501), part 1 of 2: functions and triggers.
--
-- 1. Versions of the legal documents: private.current_legal_version() (one source for
--    «current»), get_legal_versions().
-- 2. Consents: the sign-up trigger on auth.users, accept_required_consents(),
--    set_consent(), get_my_consents(), private.has_consent().
-- 3. Privacy notice changed (mn1-15): get_privacy_update(), mark_privacy_version_read().
-- 4. Password (mn1-09): the triggers on auth.users that write profiles.password_changed_at,
--    mark_password_changed() (A17 #550).
-- 5. Devices (mn1-09): list_my_sessions(), end_my_session(), end_my_other_sessions(), and
--    register_push_subscription() (DB-2) that now saves the session of the caller.
--
-- Conventions: `set search_path = ''`, fully qualified names. Every function that writes
-- refuses any Data API method other than POST before reading anything (P0001, lesson of
-- #112). The account is always the one of the verified session (auth.uid()): no parameter
-- names an account. Execute grants are in the account_privacy_policies_and_grants
-- migration.

-- ===========================================================================
-- Helpers
-- ===========================================================================

-- The current version of a legal document: the most recent with effective_from not after
-- today in Europe/Rome; null while none is published. One source for every function below.
create or replace function private.current_legal_version(p_document public.legal_document)
returns uuid
language sql
stable
set search_path = ''
as $$
  select v.id
  from public.legal_document_versions v
  where v.document = p_document
    and v.effective_from <= (now() at time zone 'Europe/Rome')::date
  order by v.effective_from desc
  limit 1;
$$;

-- True when the two ids are the current versions of the terms and of the privacy notice.
-- A null id is accepted only while no version of that document is published (rule 3).
create or replace function private.legal_versions_are_current(p_terms_version_id uuid, p_privacy_version_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_terms_version_id is not distinct from private.current_legal_version('terms')
    and p_privacy_version_id is not distinct from private.current_legal_version('privacy');
$$;

-- The session of the caller (claim session_id of the access token), or null when the token
-- has none or it is not a uuid. Never raises.
create or replace function private.current_session_id()
returns uuid
language sql
stable
set search_path = ''
as $$
  select case
    when (select auth.jwt()) ->> 'session_id'
      ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    then ((select auth.jwt()) ->> 'session_id')::uuid
  end;
$$;

-- The kind of device of a session, from its user agent (only the first 1024 characters are
-- read). Rules, in this order:
-- 1. no user agent                                              → unknown
-- 2. iPad, Tablet, Kindle, Silk, PlayBook                       → tablet
-- 3. Android without «Mobile» (Android tablets)                 → tablet
-- 4. iPhone, iPod, Android, Mobile, Windows Phone               → phone
-- 5. Windows NT, Macintosh, Mac OS X, X11, Linux, CrOS          → computer
-- 6. anything else                                              → unknown
-- Case insensitive. Limit: an iPad with iPadOS 13 or later sends the user agent of a Mac by
-- default, so it is a computer.
create or replace function private.session_device_kind(p_user_agent text)
returns public.session_device
language sql
immutable
set search_path = ''
as $$
  select (
    case
      when p_user_agent is null or btrim(p_user_agent) = '' then 'unknown'
      when left(p_user_agent, 1024) ~* '(ipad|tablet|kindle|silk|playbook)' then 'tablet'
      when left(p_user_agent, 1024) ~* 'android' and left(p_user_agent, 1024) !~* 'mobile' then 'tablet'
      when left(p_user_agent, 1024) ~* '(iphone|ipod|android|mobile|windows phone)' then 'phone'
      when left(p_user_agent, 1024) ~* '(windows nt|macintosh|mac os x|x11|linux|cros)' then 'computer'
      else 'unknown'
    end
  )::public.session_device;
$$;

-- ===========================================================================
-- 1. Versions of the legal documents
-- ===========================================================================

-- RPC (read, also without a session): the current version of each published document, one
-- row per document (none while nothing is published). «Crea account» sends these ids in
-- options.data.consents.
-- Security definer (owner: postgres): anon has no access to the private schema, where the
-- single rule of «current» lives. Reads only legal_document_versions, which is public.
create or replace function public.get_legal_versions()
returns table (
  document public.legal_document,
  version_id uuid,
  effective_from date
)
language sql
stable
security definer
set search_path = ''
as $$
  select v.document, v.id, v.effective_from
  from public.legal_document_versions v
  where v.id in (private.current_legal_version('terms'), private.current_legal_version('privacy'))
  order by v.document;
$$;

-- ===========================================================================
-- 2. Consents
-- ===========================================================================

-- Trigger (after insert on auth.users): the consents of «Crea account» (mn1-12). The page
-- passes in options.data (raw_user_meta_data) the object
--   "consents": {
--     "terms_version_id":   "<id of the current terms>",  (json null only if none published)
--     "privacy_version_id": "<id of the current notice>", (json null only if none published)
--     "adult":              true,
--     "product_news":       true | false
--   }
-- When everything is valid it writes terms_and_privacy, adult and product_news_email with
-- source signup and the two versions. Missing or invalid data, or versions that are not the
-- current ones: it writes nothing and the page asks again (accept_required_consents()).
-- It never fails the sign-up (as handle_new_user): every value is checked before it is
-- cast, and any unexpected error is swallowed.
-- Security definer (owner: postgres): the auth service has no privilege on consent_records.
create or replace function private.record_signup_consents()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_uuid constant text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
  v_consents jsonb;
  v_terms_text text;
  v_privacy_text text;
  v_terms uuid;
  v_privacy uuid;
begin
  v_consents := new.raw_user_meta_data -> 'consents';

  if v_consents is null
     or jsonb_typeof(v_consents) <> 'object'
     or not (v_consents ? 'terms_version_id' and v_consents ? 'privacy_version_id')
     or (v_consents -> 'adult') is distinct from 'true'::jsonb
     or coalesce(jsonb_typeof(v_consents -> 'product_news'), '') <> 'boolean'
     or jsonb_typeof(v_consents -> 'terms_version_id') not in ('string', 'null')
     or jsonb_typeof(v_consents -> 'privacy_version_id') not in ('string', 'null') then
    return null;
  end if;

  v_terms_text := v_consents ->> 'terms_version_id';
  v_privacy_text := v_consents ->> 'privacy_version_id';

  if (v_terms_text is not null and v_terms_text !~ c_uuid)
     or (v_privacy_text is not null and v_privacy_text !~ c_uuid) then
    return null;
  end if;

  v_terms := v_terms_text::uuid;
  v_privacy := v_privacy_text::uuid;

  if not private.legal_versions_are_current(v_terms, v_privacy) then
    return null;
  end if;

  insert into public.consent_records (user_id, kind, granted, terms_version_id, privacy_version_id, source)
  values
    (new.id, 'terms_and_privacy', true, v_terms, v_privacy, 'signup'),
    (new.id, 'adult', true, v_terms, v_privacy, 'signup'),
    (new.id, 'product_news_email', (v_consents -> 'product_news')::boolean, v_terms, v_privacy, 'signup');

  return null;
exception
  when others then
    -- Never fail the sign-up: the page asks for the consents again.
    return null;
end;
$$;

create trigger on_auth_user_created_consents
  after insert on auth.users
  for each row execute function private.record_signup_consents();

-- RPC (write): the two required consents, for an adult who signed in with Apple or Google
-- and for the accounts created before the consents existed (question 4 of #513).
-- p_adult must be true and the versions the current ones; null versions only while no
-- version of that document is published (22023 otherwise, nothing written). Writes
-- terms_and_privacy and adult, granted, source signup.
-- Security definer (owner: postgres): the app has no insert privilege on consent_records.
create or replace function public.accept_required_consents(
  p_terms_version_id uuid,
  p_privacy_version_id uuid,
  p_adult boolean
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if p_adult is not true then
    raise exception 'the adult consent is required' using errcode = '22023';
  end if;

  if not private.legal_versions_are_current(p_terms_version_id, p_privacy_version_id) then
    raise exception 'the versions are not the current ones' using errcode = '22023';
  end if;

  insert into public.consent_records (user_id, kind, granted, terms_version_id, privacy_version_id, source)
  values
    (v_uid, 'terms_and_privacy', true, p_terms_version_id, p_privacy_version_id, 'signup'),
    (v_uid, 'adult', true, p_terms_version_id, p_privacy_version_id, 'signup');
end;
$$;

-- RPC (write): one optional consent switched on or off, valid at once («Consensi» mn1-10,
-- «Prima di fare domande» mn1-11, «Novità dell'app per mail» after Apple or Google).
-- - p_kind: product_news_email, usage_analytics or assistant_questions only; the two
--   required ones are taken back only by deleting the account (22023);
-- - p_granted: not null (22023);
-- - p_source: settings (default), first_use or signup; never update (22023).
-- Writes a new row with the versions in force; the old rows stay (append only).
-- Security definer (owner: postgres): the app has no insert privilege on consent_records.
create or replace function public.set_consent(
  p_kind public.consent_kind,
  p_granted boolean,
  p_source public.consent_source default 'settings'
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if p_kind is null or p_kind not in ('product_news_email', 'usage_analytics', 'assistant_questions') then
    raise exception 'only an optional consent can be changed' using errcode = '22023';
  end if;

  if p_granted is null then
    raise exception 'the choice is required' using errcode = '22023';
  end if;

  if p_source is null or p_source not in ('settings', 'first_use', 'signup') then
    raise exception 'invalid source' using errcode = '22023';
  end if;

  insert into public.consent_records (user_id, kind, granted, terms_version_id, privacy_version_id, source)
  values (
    v_uid, p_kind, p_granted,
    private.current_legal_version('terms'), private.current_legal_version('privacy'),
    p_source
  );
end;
$$;

-- RPC (read): the state of the consents of the caller, always 5 rows in the order of the
-- type (terms_and_privacy, adult, product_news_email, usage_analytics,
-- assistant_questions), from the most recent row of each kind:
-- - granted: false for a kind never decided; decided_at: null for a kind never decided;
-- - terms_effective_from, privacy_effective_from: the dates of the versions in force at
--   that decision (null when none was published);
-- - required_ok: the same on every row, true when terms_and_privacy and adult are
--   accepted (the page asks for them otherwise).
-- Security invoker: it reads only the caller's own rows (RLS of consent_records) and the
-- versions, which are public. Children have no consents (mn1-10).
create or replace function public.get_my_consents()
returns table (
  kind public.consent_kind,
  granted boolean,
  decided_at timestamptz,
  terms_effective_from date,
  privacy_effective_from date,
  required_ok boolean
)
language sql
stable
set search_path = ''
as $$
  select
    k.kind,
    coalesce(r.granted, false),
    r.created_at,
    tv.effective_from,
    pv.effective_from,
    coalesce(
      bool_and(coalesce(r.granted, false)) filter (where k.kind in ('terms_and_privacy', 'adult')) over (),
      false
    )
  from unnest(enum_range(null::public.consent_kind)) with ordinality as k (kind, ord)
  left join lateral (
    select c.granted, c.created_at, c.terms_version_id, c.privacy_version_id
    from public.consent_records c
    where c.user_id = (select auth.uid())
      and c.kind = k.kind
    order by c.created_at desc, c.id desc
    limit 1
  ) r on true
  left join public.legal_document_versions tv on tv.id = r.terms_version_id
  left join public.legal_document_versions pv on pv.id = r.privacy_version_id
  where (select auth.uid()) is not null
  order by k.ord;
$$;

-- For the code of the database (the assistant, the usage numbers): true when the most
-- recent decision of the account about that kind is granted; false when never decided.
-- Owner only (no API role executes it).
create or replace function private.has_consent(p_user_id uuid, p_kind public.consent_kind)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (
      select c.granted
      from public.consent_records c
      where c.user_id = p_user_id
        and c.kind = p_kind
      order by c.created_at desc, c.id desc
      limit 1
    ),
    false
  );
$$;

-- ===========================================================================
-- 3. Privacy notice changed (mn1-15)
-- ===========================================================================

-- RPC (read): 0 or 1 row. The current version of the privacy notice when it has
-- notify_users = true and it is newer than the last one the caller accepted or read. An
-- adult who never accepted the terms gets no row: the page asks for the required consents
-- first (accept_required_consents() with the current versions).
-- Security definer (owner: postgres): the rule of «current» lives in private. It reads only
-- the caller's own consents.
create or replace function public.get_privacy_update()
returns table (
  privacy_version_id uuid,
  effective_from date
)
language sql
stable
security definer
set search_path = ''
as $$
  with current_version as (
    select v.id, v.effective_from, v.notify_users
    from public.legal_document_versions v
    where v.id = private.current_legal_version('privacy')
  ),
  accepted as (
    select c.privacy_version_id
    from public.consent_records c
    where c.user_id = (select auth.uid())
      and c.kind = 'terms_and_privacy'
      and c.granted
  )
  select cv.id, cv.effective_from
  from current_version cv
  where cv.notify_users
    and exists (select 1 from accepted)
    and not exists (
      select 1
      from accepted a
      join public.legal_document_versions v on v.id = a.privacy_version_id
      where v.effective_from >= cv.effective_from
    );
$$;

-- RPC (write): «Ho letto» of a new privacy notice (mn1-15). p_privacy_version_id must be the
-- current version (22023) and the caller must have accepted the terms before (22023: the
-- page asks for the required consents instead). Adds a terms_and_privacy row, source update,
-- with the terms of the last acceptance and the new notice. It does not block the app.
-- Security definer (owner: postgres): the app has no insert privilege on consent_records.
create or replace function public.mark_privacy_version_read(p_privacy_version_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_found boolean;
  v_terms uuid;
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if p_privacy_version_id is null
     or p_privacy_version_id is distinct from private.current_legal_version('privacy') then
    raise exception 'not the current privacy notice' using errcode = '22023';
  end if;

  select true, c.terms_version_id into v_found, v_terms
  from public.consent_records c
  where c.user_id = v_uid
    and c.kind = 'terms_and_privacy'
    and c.granted
  order by c.created_at desc, c.id desc
  limit 1;

  if v_found is not true then
    raise exception 'the terms were never accepted' using errcode = '22023';
  end if;

  insert into public.consent_records (user_id, kind, granted, terms_version_id, privacy_version_id, source)
  values (v_uid, 'terms_and_privacy', true, v_terms, p_privacy_version_id, 'update');
end;
$$;

-- ===========================================================================
-- 4. Password (mn1-09)
-- ===========================================================================

-- Trigger (after insert or after a change of the password on auth.users): the date of the
-- password in the profile. now() when the account has a password, null when it has none
-- (an account of Apple or Google only has an empty encrypted_password).
-- On insert it runs after on_auth_user_created (triggers of the same event run in name
-- order), so the profile already exists.
-- Security definer (owner: postgres): the auth service has no privilege on profiles.
create or replace function private.profiles_set_password_changed_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles p
  set password_changed_at = case when coalesce(new.encrypted_password, '') = '' then null else now() end
  where p.id = new.id;
  return null;
end;
$$;

create trigger on_auth_user_password_set
  after insert on auth.users
  for each row
  when (coalesce(new.encrypted_password, '') <> '')
  execute function private.profiles_set_password_changed_at();

create trigger on_auth_user_password_changed
  after update of encrypted_password on auth.users
  for each row
  when (new.encrypted_password is distinct from old.encrypted_password)
  execute function private.profiles_set_password_changed_at();

-- RPC (write): «the password has just changed» (A17 #550, called by A19 and A20 after a
-- successful change). The trigger above already writes the date when Supabase Auth saves
-- the new password; this only writes now() again on the caller's own profile, and only
-- when the account has a password (an account of Apple or Google only stays null).
-- Security definer (owner: postgres): the app has no update privilege on the column.
create or replace function public.mark_password_changed()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  update public.profiles p
  set password_changed_at = now()
  where p.id = v_uid
    and exists (
      select 1
      from auth.users u
      where u.id = v_uid
        and coalesce(u.encrypted_password, '') <> ''
    );
end;
$$;

-- ===========================================================================
-- 5. Devices (mn1-09): the sessions of Supabase Auth
-- ===========================================================================
-- Limit (verified in #513): a session that is closed keeps working until its access token
-- expires (about 1 hour), then it cannot be refreshed any more.

-- RPC (read): the open sessions of the caller («Dove sei entrato»): the current one first,
-- then by last activity, most recent first. Never the IP address nor the whole user agent:
-- only the kind of device. Sessions past their not_after are left out.
-- last_active_at = refreshed_at (UTC, without time zone in auth.sessions), else
-- updated_at, else created_at.
-- Security definer (owner: postgres): the API roles have no privilege on the auth schema.
-- Only the rows of the verified session's account.
create or replace function public.list_my_sessions()
returns table (
  session_id uuid,
  device_kind public.session_device,
  last_active_at timestamptz,
  is_current boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id,
    private.session_device_kind(s.user_agent),
    coalesce(s.refreshed_at at time zone 'UTC', s.updated_at, s.created_at),
    s.id is not distinct from private.current_session_id()
  from auth.sessions s
  where s.user_id = (select auth.uid())
    and (s.not_after is null or s.not_after > now())
  order by
    s.id is not distinct from private.current_session_id() desc,
    coalesce(s.refreshed_at at time zone 'UTC', s.updated_at, s.created_at) desc nulls last,
    s.id;
$$;

-- RPC (write): closes one session of the caller that is not the current one, with its
-- refresh tokens (on delete cascade) and the devices registered by it.
-- - p_session_id null or the current session: 22023 (to leave this device the page uses
--   «Esci»);
-- - a session of somebody else, or unknown: nothing changes and no error.
-- Security definer (owner: postgres): the API roles have no privilege on the auth schema
-- and no delete privilege on push_subscriptions.
create or replace function public.end_my_session(p_session_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_deleted uuid;
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if p_session_id is null or p_session_id is not distinct from private.current_session_id() then
    raise exception 'the current session cannot be closed here' using errcode = '22023';
  end if;

  delete from auth.sessions s
  where s.id = p_session_id
    and s.user_id = v_uid
  returning s.id into v_deleted;

  if v_deleted is not null then
    delete from public.push_subscriptions ps
    where ps.session_id = v_deleted
      and ps.member_id in (select m.id from public.household_members m where m.user_id = v_uid);
  end if;
end;
$$;

-- RPC (write): «Esci da tutti gli altri apparecchi». Closes every session of the caller but
-- the current one (with their refresh tokens), the old refresh tokens without a session,
-- and every device of the caller not registered by the current session (also the devices
-- registered before the session was saved). Returns how many sessions were closed.
-- A token without a session (22023): there would be no «other» to tell apart.
-- Security definer (owner: postgres): as end_my_session().
create or replace function public.end_my_other_sessions()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_current uuid;
  v_count integer;
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  v_current := private.current_session_id();
  if v_current is null then
    raise exception 'no current session' using errcode = '22023';
  end if;

  delete from public.push_subscriptions ps
  where ps.member_id in (select m.id from public.household_members m where m.user_id = v_uid)
    and ps.session_id is distinct from v_current;

  delete from auth.refresh_tokens r
  where r.user_id = v_uid::text
    and r.session_id is null;

  delete from auth.sessions s
  where s.user_id = v_uid
    and s.id <> v_current;
  get diagnostics v_count = row_count;

  return v_count;
end;
$$;

-- register_push_subscription() of DB-2 (#511), same signature and grants, same rules; it now
-- also saves the session of the caller (session_id claim, null when the token has none), on
-- a new row and when the same device registers again.
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
  v_session_id uuid := private.current_session_id();
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
        session_id = v_session_id,
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

  insert into public.push_subscriptions (household_id, member_id, platform, endpoint, p256dh, auth, token, session_id)
  values (v_household_id, v_member_id, p_platform, p_endpoint, p_p256dh, p_auth, v_token, v_session_id)
  returning id into v_id;

  return v_id;
end;
$$;
