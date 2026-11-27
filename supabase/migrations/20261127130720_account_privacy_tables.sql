-- Issue #513 (DB-4 «Account e privacy», plan #501), part 1 of 2: tables, columns,
-- constraints and indexes.
--
-- 1. legal_document_versions: the versions of the terms and of the privacy notice. Written
--    only by migrations; the table is created EMPTY: the first rows come with the texts
--    approved in A24 #147 (LEZIONI: no value that is not approved).
-- 2. consent_records: what each adult accepted and when, append only (GDPR evidence).
-- 3. profiles: when the password was set or changed (mn1-09, A17 #550) and the appearance
--    (A18 #551).
-- 4. push_subscriptions: the session that registered the device, so that closing a session
--    also forgets its devices (rule 7).
--
-- RLS is enabled here, in the same migration that creates each table. Policies and grants
-- are in the account_privacy_policies_and_grants migration: until then RLS denies every
-- row to the API roles.
--
-- Everything here belongs to the account, not to the household (at sign-up there is no
-- household yet): no household_id; only the own rows, as profiles. The other adults of the
-- household, administrators included, never read them.
--
-- Stored personal data (privacy skill), all justified by the requirement: the consents
-- with their date and version (proof for the GDPR); the date of the last password change
-- (mn1-09); the appearance chosen. No IP address and no user agent are copied out of
-- auth.sessions. Nothing about children: children have no consents and no account.
-- Everything goes with the account (on delete cascade).

-- ===========================================================================
-- 1. legal_document_versions
-- ===========================================================================
-- «Current» version of a document: the most recent with effective_from not after today
-- (Europe/Rome), private.current_legal_version().
-- notify_users: the change is shown to the adults who accepted an older version
-- («L'informativa è cambiata», mn1-15).
create table public.legal_document_versions (
  id uuid primary key default gen_random_uuid(),
  document public.legal_document not null,
  effective_from date not null,
  notify_users boolean not null default false,
  created_at timestamptz not null default now(),
  -- One version per document and day; also the index of the current version lookup.
  constraint legal_document_versions_document_effective_from_key unique (document, effective_from)
);

alter table public.legal_document_versions enable row level security;

-- ===========================================================================
-- 2. consent_records
-- ===========================================================================
-- One row per decision, never changed nor deleted by the app (no update or delete privilege
-- for any API role): the state of a kind is its most recent row (get_my_consents()).
-- Written only by the database: the sign-up trigger, accept_required_consents(),
-- set_consent(), mark_privacy_version_read() (next migration).
-- terms_version_id, privacy_version_id: the versions in force when the decision was taken
-- (null only while no version of that document is published). Versions are never deleted
-- (on delete restrict).
create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind public.consent_kind not null,
  granted boolean not null,
  terms_version_id uuid references public.legal_document_versions (id) on delete restrict,
  privacy_version_id uuid references public.legal_document_versions (id) on delete restrict,
  source public.consent_source not null,
  -- clock_timestamp(), not now(): two decisions taken in the same transaction (for example
  -- «Aiutaci a migliorare» switched on and off) keep their order.
  created_at timestamptz not null default clock_timestamp(),
  -- The two required consents are only ever given: they are taken back only by deleting
  -- the account.
  constraint consent_records_required_granted check (
    kind not in ('terms_and_privacy', 'adult') or granted
  ),
  -- «Ho letto» of a new privacy notice is an acceptance of terms and privacy.
  constraint consent_records_update_source check (
    source <> 'update' or kind = 'terms_and_privacy'
  )
);

-- The most recent row of each kind of a user (get_my_consents(), private.has_consent());
-- leading column also indexes the foreign key towards auth.users (cascade).
create index consent_records_user_kind_created_idx
  on public.consent_records (user_id, kind, created_at desc, id desc);
-- Foreign keys towards the versions.
create index consent_records_terms_version_id_idx
  on public.consent_records (terms_version_id) where terms_version_id is not null;
create index consent_records_privacy_version_id_idx
  on public.consent_records (privacy_version_id) where privacy_version_id is not null;

alter table public.consent_records enable row level security;

-- ===========================================================================
-- 3. profiles
-- ===========================================================================
alter table public.profiles
  -- «Password · Cambiata il 16 novembre» (mn1-09): when the password of the account was
  -- set or changed, written by the trigger on auth.users. Null for an account that signs
  -- in only with Apple or Google, and for the accounts created before this migration
  -- (Supabase Auth does not keep the date of the last change).
  add column password_changed_at timestamptz,
  -- «Aspetto» (A18 #551): «Come il telefono» by default.
  add column appearance public.appearance_mode not null default 'system';

-- ===========================================================================
-- 4. push_subscriptions
-- ===========================================================================
alter table public.push_subscriptions
  -- The session (auth.sessions.id) that registered the device, from the session_id claim
  -- of the caller (register_push_subscription()). Null for the devices registered before
  -- this migration. No foreign key towards the auth schema: end_my_session() and
  -- end_my_other_sessions() delete the devices of the sessions they close.
  add column session_id uuid;

-- The devices of a session (closing one or all other sessions).
create index push_subscriptions_session_id_idx
  on public.push_subscriptions (session_id) where session_id is not null;
