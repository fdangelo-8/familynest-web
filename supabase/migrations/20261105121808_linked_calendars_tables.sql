-- Issue #266 (for #34 Calendari collegati, #35 Outlook, #37 Onboarding · Calendario): the
-- external accounts of the adults, their calendars, the link between an event of FamilyNest
-- and an event of a provider, and the two queues of the synchronisation service.
-- - calendar_accounts:               one row per external account (Google, Outlook) of an
--                                    adult with an account, with its credentials encrypted;
-- - external_calendars:              the calendars of an account and their choices;
-- - event_external_links:            which event of FamilyNest is which event of the
--                                    provider (no duplicates, updates, read-only imports);
-- - calendar_credential_revocations: credentials of the removed accounts, waiting to be
--                                    revoked at the provider (at most 24 hours);
-- - calendar_outbox:                 what has to be created, changed or deleted on the
--                                    provider for the events sent with «Anche su».
--
-- RLS is enabled here, in the same migration that creates each table. Policies and grants
-- are in the linked_calendars_policies_and_grants migration: until then RLS denies every
-- row to the API roles. Rules that depend on other rows (limits, defaults, effects of a
-- change) are triggers in the linked_calendars_functions_and_triggers migration.
--
-- Who writes: the synchronisation service inside Supabase (decision F1 = B) with the
-- administrative key, through the functions of the linked_calendars_server_functions
-- migration. The app, with the session of the adult, only reads its own accounts and
-- calendars (never the credentials), changes the choices of its own calendars, and removes
-- its own accounts («Scollega»).
--
-- Accounts are personal (#34 §1): only the adult who linked them sees them; the other
-- adults of the same household (administrators included) and every other household never
-- read them. They belong to the place of the adult in the household: leaving the household
-- (or being removed, or deleting the account, or the household being deleted) deletes them
-- with their calendars, their links and the events imported from them, whatever their
-- visibility (#34 §9), and queues the credentials for the revocation.
--
-- Same-household rule without triggers: every reference goes through a composite foreign
-- key that includes household_id (and the member for the calendars), so no row can ever
-- point to a member, an account, a calendar or an event of another household.
--
-- Stored personal data (privacy skill, #34 §18): the email of the external account, the
-- names and choices of the calendars, the credentials encrypted outside the database (only
-- the ciphertext is stored, the key never is), the link between events and their ids at the
-- provider. Never read nor stored from the provider: descriptions, participants and their
-- emails, organiser, attachments, video call links, reminders, colours (#34 §7). Nothing
-- about children. Short-lived access tokens are never stored.

-- ---------------------------------------------------------------------------
-- calendar_accounts
-- ---------------------------------------------------------------------------
create table public.calendar_accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  -- The adult who linked the account (only adults with an account: trigger).
  member_id uuid not null,
  -- Always 'adult': part of the composite foreign key.
  member_kind public.member_kind not null default 'adult',
  provider public.calendar_provider not null,
  -- Stable id of the account at the provider (never shown): the same account linked again
  -- updates its row instead of adding a second one.
  provider_account_id text not null,
  -- Email of the external account, shown only to its adult (#34 §3).
  email text not null,
  status public.calendar_account_status not null default 'active',
  -- First failed attempt since the last synchronisation that worked («dalle 13:10»).
  failing_since timestamptz,
  last_synced_at timestamptz,
  -- Order of the sections of the page (the oldest first).
  connected_at timestamptz not null default now(),
  -- Accounts of the fake provider used by development and tests (#34 §11): the
  -- synchronisation of production ignores them.
  is_fake boolean not null default false,
  -- The refresh token (Google, Outlook), encrypted by the synchronisation service with a
  -- key that exists only outside the database. Format «v<key version>:<ciphertext>»: a
  -- plain token never matches it. Never readable nor writable by the API roles.
  credentials_ciphertext text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Target of the composite foreign key of the calendars.
  constraint calendar_accounts_id_household_member_key unique (id, household_id, member_id),
  constraint calendar_accounts_member_fkey foreign key (member_id, household_id, member_kind)
    references public.household_members (id, household_id, kind) on delete cascade,
  constraint calendar_accounts_member_kind_adult check (member_kind = 'adult'),
  -- Also the index of the composite foreign key (leading column member_id) and of the
  -- RLS policies.
  constraint calendar_accounts_member_provider_account_key unique (member_id, provider, provider_account_id),
  constraint calendar_accounts_provider_account_id_length check (char_length(provider_account_id) between 1 and 255),
  constraint calendar_accounts_email_format check (
    char_length(email) between 3 and 254
    and email = btrim(email)
    and email !~ '\s'
    and position('@' in email) > 1
  ),
  constraint calendar_accounts_credentials_format check (
    credentials_ciphertext ~ '^v[0-9]{1,3}:[A-Za-z0-9+/=_.:-]+$'
    and char_length(credentials_ciphertext) between 35 and 8192
  ),
  constraint calendar_accounts_failing_since_iff_failing check ((status = 'active') = (failing_since is null))
);

-- Foreign key towards households (cascade when the household is deleted).
create index calendar_accounts_household_id_idx on public.calendar_accounts (household_id);

alter table public.calendar_accounts enable row level security;

-- ---------------------------------------------------------------------------
-- external_calendars
-- ---------------------------------------------------------------------------
create table public.external_calendars (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  -- The adult of the account (copied from the account by the foreign key): used by the
  -- RLS policies without reading the accounts.
  member_id uuid not null,
  account_id uuid not null,
  -- Id of the calendar at the provider (never shown).
  provider_calendar_id text not null,
  -- Name of the calendar at the provider, normalised like the titles of the events.
  name text not null,
  -- The main calendar of the account (the only one switched on when it is linked).
  is_primary boolean not null default false,
  -- The provider does not allow writing (holidays, shared calendars): always «Solo in
  -- entrata».
  is_read_only boolean not null default false,
  -- «Sincronizza <nome>».
  is_enabled boolean not null default false,
  -- «Direzione»; a read-only calendar is always «Solo in entrata» (trigger and check).
  direction public.calendar_direction not null default 'two_way',
  -- «Chi vede questi impegni nel Nest» for the events imported from it: «Occupato» for
  -- every new calendar (decision F5 of 05/11). An event that is private at the provider is
  -- never more than «Occupato».
  visibility public.event_visibility not null default 'busy',
  -- «Conta per «Liberi insieme»».
  counts_for_free_time boolean not null default true,
  -- «Solo giorni feriali»: events starting on Saturday or Sunday (Europe/Rome) are not
  -- imported.
  weekdays_only boolean not null default false,
  -- «Dove vanno i nuovi impegni»: at most one calendar per adult, switched on, «Entrata e
  -- uscita» and writable (check below and partial unique index). Set only by the database.
  is_new_events_target boolean not null default false,
  -- Position of the synchronisation at the provider (sync token, delta link): only for the
  -- synchronisation service, never readable by the app.
  sync_cursor text,
  last_synced_at timestamptz,
  -- First failed attempt of this calendar alone («Non si sincronizza dalle 13:10»).
  failing_since timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Target of the composite foreign keys of the links and of the outbox.
  constraint external_calendars_id_household_key unique (id, household_id),
  constraint external_calendars_account_fkey foreign key (account_id, household_id, member_id)
    references public.calendar_accounts (id, household_id, member_id) on delete cascade,
  -- Also the index of the composite foreign key (leading column account_id).
  constraint external_calendars_account_calendar_key unique (account_id, provider_calendar_id),
  constraint external_calendars_provider_calendar_id_length check (char_length(provider_calendar_id) between 1 and 1024),
  constraint external_calendars_name_normalized check (name = btrim(regexp_replace(name, '\s+', ' ', 'g'))),
  constraint external_calendars_name_length check (char_length(name) between 1 and 100),
  constraint external_calendars_read_only_incoming check (not is_read_only or direction = 'incoming'),
  constraint external_calendars_target_eligible check (
    not is_new_events_target or (is_enabled and direction = 'two_way' and not is_read_only)
  ),
  constraint external_calendars_sync_cursor_length check (sync_cursor is null or char_length(sync_cursor) <= 8192)
);

-- RLS policies (the adult of the calendar).
create index external_calendars_member_id_idx on public.external_calendars (member_id);
-- Foreign key towards households (cascade when the household is deleted).
create index external_calendars_household_id_idx on public.external_calendars (household_id);
-- «Dove vanno i nuovi impegni»: one calendar per adult at most.
create unique index external_calendars_one_target_per_member_idx
  on public.external_calendars (member_id)
  where is_new_events_target;

alter table public.external_calendars enable row level security;

-- ---------------------------------------------------------------------------
-- event_external_links: one per event at most. Imported events get one row per event of
-- FamilyNest: every occurrence of a repeated event of the provider, and every day of an
-- event «tutto il giorno», is its own event here, with its own occurrence_key. An event
-- sent with «Anche su» gets one row (occurrence_key '') when the provider has created it.
-- Deleting the link of an imported event deletes the event (trigger), whatever its
-- visibility.
-- ---------------------------------------------------------------------------
create table public.event_external_links (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  event_id uuid not null,
  calendar_id uuid not null,
  origin public.external_event_origin not null,
  -- Id of the event at the provider (for a repeated event: the id of the series).
  provider_event_id text not null,
  -- Which occurrence or which day of the event of the provider ('' for a single event).
  occurrence_key text not null default '',
  -- Version of the event at the provider (etag, change key): nothing to do when unchanged.
  provider_version text,
  -- The event is marked private at the provider: never more than «Occupato» here.
  is_private_on_provider boolean not null default false,
  -- False when the provider marks the event as free, or for an event «tutto il giorno»:
  -- it never counts for «Liberi insieme».
  is_busy_on_provider boolean not null default true,
  -- The author changed «Chi lo vede» of this event alone: the synchronisation and the
  -- choices of the calendar never bring it back (#34 §15).
  visibility_overridden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint event_external_links_event_key unique (event_id),
  constraint event_external_links_event_fkey foreign key (event_id, household_id)
    references public.events (id, household_id) on delete cascade,
  constraint event_external_links_calendar_fkey foreign key (calendar_id, household_id)
    references public.external_calendars (id, household_id) on delete cascade,
  -- No duplicates (#34 §7). Also the index of the calendar foreign key (leading column).
  constraint event_external_links_provider_event_key unique (calendar_id, provider_event_id, occurrence_key),
  constraint event_external_links_provider_event_id_length check (char_length(provider_event_id) between 1 and 1024),
  constraint event_external_links_occurrence_key_length check (char_length(occurrence_key) <= 255),
  constraint event_external_links_provider_version_length check (
    provider_version is null or char_length(provider_version) <= 1024
  ),
  -- What only an imported event has.
  constraint event_external_links_sent_fields check (
    origin = 'imported'
    or (occurrence_key = '' and not is_private_on_provider and is_busy_on_provider and not visibility_overridden)
  )
);

-- Foreign key towards households (cascade when the household is deleted).
create index event_external_links_household_id_idx on public.event_external_links (household_id);

alter table public.event_external_links enable row level security;

-- ---------------------------------------------------------------------------
-- calendar_credential_revocations: filled by a trigger when an account is deleted for any
-- reason, only for the providers that offer a revocation service (Google; Microsoft has
-- none, #35 §5). Only the provider and the ciphertext: no id of a person, no email, no
-- household (the row must survive the household). The synchronisation service revokes and
-- deletes the row; the job of the schedule_calendar_jobs migration deletes every row older
-- than 23 hours, revoked or not, so no row is kept for 24 hours.
-- ---------------------------------------------------------------------------
create table public.calendar_credential_revocations (
  id uuid primary key default gen_random_uuid(),
  provider public.calendar_provider not null,
  -- Credentials of the fake provider: revoked by the fake provider only.
  is_fake boolean not null,
  credentials_ciphertext text not null,
  created_at timestamptz not null default now()
);

-- Cleanup of the old rows.
create index calendar_credential_revocations_created_at_idx
  on public.calendar_credential_revocations (created_at);

-- No policy, no privilege for the API roles (policies migration).
alter table public.calendar_credential_revocations enable row level security;

-- ---------------------------------------------------------------------------
-- calendar_outbox: the changes to send to the provider for the events sent with «Anche
-- su». No text of the event: the service reads the event when it works (#34 richiesta-db
-- point 8). A deletion keeps only the id of the event at the provider (the event of
-- FamilyNest may be gone).
-- ---------------------------------------------------------------------------
create table public.calendar_outbox (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  calendar_id uuid not null,
  action public.calendar_outbox_action not null,
  -- create and update: the event to send (its pending rows go with it).
  event_id uuid,
  -- update and delete: the event at the provider.
  provider_event_id text,
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  -- The calendar was switched off, set to «Solo in entrata» or unlinked: nothing more is
  -- sent there.
  constraint calendar_outbox_calendar_fkey foreign key (calendar_id, household_id)
    references public.external_calendars (id, household_id) on delete cascade,
  constraint calendar_outbox_event_fkey foreign key (event_id, household_id)
    references public.events (id, household_id) on delete cascade,
  constraint calendar_outbox_fields check (
    case action
      when 'create' then event_id is not null and provider_event_id is null
      when 'update' then event_id is not null and provider_event_id is not null
      when 'delete' then event_id is null and provider_event_id is not null
      else false
    end
  ),
  constraint calendar_outbox_provider_event_id_length check (
    provider_event_id is null or char_length(provider_event_id) between 1 and 1024
  ),
  constraint calendar_outbox_attempts_positive check (attempts >= 0)
);

-- At most one pending create or update per event (the service reads the latest values).
-- Also the index of the event foreign key.
create unique index calendar_outbox_one_per_event_idx
  on public.calendar_outbox (event_id)
  where event_id is not null;
-- Foreign keys towards the calendars and households.
create index calendar_outbox_calendar_id_idx on public.calendar_outbox (calendar_id);
create index calendar_outbox_household_id_idx on public.calendar_outbox (household_id);
-- The service takes the rows that are due.
create index calendar_outbox_next_attempt_at_idx on public.calendar_outbox (next_attempt_at);

-- No policy, no privilege for the API roles (policies migration).
alter table public.calendar_outbox enable row level security;
