-- Issue #513 (DB-4 «Account e privacy», plan #501), part 2 of 2: tables, columns,
-- constraints and indexes.
--
-- 1. private.account_deletion_requests: «Elimina l'account» with 14 days to think it over
--    (cb1-50 – cb1-52).
-- 2. private.account_deletion_mails: the address for the last mail, once the account is
--    deleted (answer 159), for 72 hours at most.
-- 3. private.consent_evidence: the minimal pseudonymous proof of the consents of a deleted
--    account, for 5 years (decision B of Francesco of 27/11, proposal of legale-privacy in
--    #513).
-- 4. public.data_exports: «Esporta i miei dati» and its three moments (cb1-47, cb1-48).
-- 5. private.data_export_leftovers: the files of the exports of a deleted account, that
--    the server still has to remove through the Storage API.
-- 6. notifications_kind_fields: the fields of household_handed_over and data_export_ready.
-- 7. profiles.password_changed_at: only for display (recommendation of the security review
--    of #650).
--
-- RLS is enabled here, in the same migration that creates each table. The four private
-- tables have no policy and no privilege for any API role (the "private" schema is not
-- exposed by the Data API): only the functions of the database read and write them.
-- data_exports gets its policies and grants in the account_privacy_2_policies_and_grants
-- migration: until then RLS denies every row to the API roles.
--
-- Everything is personal to the account, not to the household (as consent_records): no
-- household_id on the export and on the request (the household of the request is only the
-- one of that moment, for the job). The other adults of the household, administrators
-- included, never read them.
--
-- Stored personal data (privacy skill), all justified by the requirement:
-- - the date chosen for the deletion and whether the household goes with it;
-- - the address of a deleted account, 72 hours at most, only for the last mail;
-- - for 5 years after the deletion: an HMAC of the address (key only in the Vault), the
--   kind, the choice, the versions, the source and the date of each consent, the day of the
--   deletion. No address in clear, no name, no user_id, no IP, no user agent, no household,
--   nothing about children;
-- - the state and the size of an export; its file lives 24 hours in the private bucket
--   data-exports.
-- Nothing new about children: they have no account and no consent.

-- ===========================================================================
-- 1. private.account_deletion_requests
-- ===========================================================================
-- One row per account at most. delete_on: the last day (Europe/Rome) to think it over; the
-- job deletes the account from 00:00 of the day after. deletes_household: the account was
-- the only adult with an account when it asked («Elimina anche la casa», cb1-52); the job
-- checks the household again when it runs (an adult who joined in the meantime keeps it).
-- household_id: the household of the caller at the request (null without one, or when the
-- household is gone).
-- Goes with the account (on delete cascade); taken away by cancel_account_deletion() and by
-- every new sign-in (trigger on auth.sessions).
create table private.account_deletion_requests (
  user_id uuid primary key references auth.users (id) on delete cascade,
  household_id uuid references public.households (id) on delete set null,
  requested_at timestamptz not null default now(),
  delete_on date not null,
  deletes_household boolean not null,
  created_at timestamptz not null default now()
);

-- The job: the requests whose delete_on is over.
create index account_deletion_requests_delete_on_idx on private.account_deletion_requests (delete_on);
-- Foreign key towards the household (set null).
create index account_deletion_requests_household_id_idx
  on private.account_deletion_requests (household_id) where household_id is not null;

alter table private.account_deletion_requests enable row level security;

-- ===========================================================================
-- 2. private.account_deletion_mails
-- ===========================================================================
-- Written by the job just before it deletes the account; taken (and deleted) once by
-- take_account_deletion_mails(); deleted anyway after 72 hours (job mail_purge). No
-- foreign key: the account no longer exists. Only the address and the day.
create table private.account_deletion_mails (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  deleted_on date not null,
  created_at timestamptz not null default now()
);

-- The oldest first (take_account_deletion_mails) and the purge after 72 hours.
create index account_deletion_mails_created_at_idx on private.account_deletion_mails (created_at, id);

alter table private.account_deletion_mails enable row level security;

-- ===========================================================================
-- 3. private.consent_evidence
-- ===========================================================================
-- One row per row of consent_records of a deleted account, copied in the same transaction
-- and before the deletion (private.delete_account()). Never readable by an API role
-- (service_role included): looked up by hand by the administrator of the database with
-- private.find_consent_evidence(), when a complaint arrives with an address.
-- subject_hmac: HMAC-SHA256 of the address of the account on the day of the deletion
-- (lower case, without spaces), with the key «consent_evidence_hmac_key» of the Vault of
-- Supabase, never in the repository. Without the key the row is not written and the
-- account is deleted anyway (the right to be forgotten comes first).
-- decided_at: created_at of the original row. purge_after: account_deleted_on + 5 years;
-- the job evidence_purge deletes the rows the day after.
-- The versions are never deleted (on delete restrict), as in consent_records.
create table private.consent_evidence (
  id uuid primary key default gen_random_uuid(),
  subject_hmac bytea not null,
  kind public.consent_kind not null,
  granted boolean not null,
  terms_version_id uuid references public.legal_document_versions (id) on delete restrict,
  privacy_version_id uuid references public.legal_document_versions (id) on delete restrict,
  source public.consent_source not null,
  decided_at timestamptz not null,
  account_deleted_on date not null,
  purge_after date not null,
  created_at timestamptz not null default now(),

  -- HMAC-SHA256: 32 bytes.
  constraint consent_evidence_subject_hmac_length check (octet_length(subject_hmac) = 32),
  constraint consent_evidence_purge_after_five_years check (
    purge_after = (account_deleted_on + interval '5 years')::date
  )
);

-- The lookup of a complaint.
create index consent_evidence_subject_hmac_idx on private.consent_evidence (subject_hmac);
-- The job evidence_purge.
create index consent_evidence_purge_after_idx on private.consent_evidence (purge_after);
-- Foreign keys towards the versions.
create index consent_evidence_terms_version_id_idx
  on private.consent_evidence (terms_version_id) where terms_version_id is not null;
create index consent_evidence_privacy_version_id_idx
  on private.consent_evidence (privacy_version_id) where privacy_version_id is not null;

alter table private.consent_evidence enable row level security;

-- ===========================================================================
-- 4. public.data_exports
-- ===========================================================================
-- One row per «Esporta i miei dati». The file is prepared by the server with the session
-- of the account (so the usual visibility rules apply) and uploaded to
-- data-exports/<user_id>/<id>.zip; the database keeps only the state.
-- - preparing: no ready_at, expires_at, size_bytes;
-- - ready: ready_at, expires_at = ready_at + 24 hours, size_bytes up to 50 MiB;
-- - failed: as preparing; updated_at says when it failed (deleted 7 days later).
-- Written only by the functions of the database (start_data_export(), finish_data_export(),
-- fail_data_export(), the job). Goes with the account (on delete cascade); the file of a
-- deleted account is left to the server (private.data_export_leftovers).
create table public.data_exports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status public.data_export_status not null default 'preparing',
  requested_at timestamptz not null default now(),
  ready_at timestamptz,
  expires_at timestamptz,
  size_bytes bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint data_exports_ready_fields check (
    case status
      when 'ready' then
        ready_at is not null and size_bytes is not null and expires_at = ready_at + interval '24 hours'
      else num_nonnulls(ready_at, expires_at, size_bytes) = 0
    end
  ),
  -- 50 MiB: the limit of the bucket.
  constraint data_exports_size_bytes_range check (size_bytes is null or size_bytes between 1 and 52428800)
);

-- The exports of an account, the most recent first (get_my_data_export(), the 5 a day);
-- leading column also indexes the foreign key towards auth.users (cascade).
create index data_exports_user_requested_idx on public.data_exports (user_id, requested_at desc, id desc);
-- The job exports and list_expired_data_exports().
create index data_exports_status_idx on public.data_exports (status, requested_at);
create index data_exports_expires_at_idx on public.data_exports (expires_at) where status = 'ready';

alter table public.data_exports enable row level security;

-- ===========================================================================
-- 5. private.data_export_leftovers
-- ===========================================================================
-- The files of the bucket data-exports whose export row is gone while the file was still
-- there (an account deleted in any way: private.delete_account() and the trigger
-- data_exports_keep_leftover_file). Storage does not remove a file when its row is deleted
-- with SQL, so the server removes them through the Storage API (list_expired_data_exports(),
-- forget_data_export()). Nobody can download them in the meantime: the select policy of the
-- bucket asks for a ready export of the account. Only the path of the file (it starts with
-- the id of the deleted account).
create table private.data_export_leftovers (
  id uuid primary key default gen_random_uuid(),
  object_path text not null,
  created_at timestamptz not null default now(),

  constraint data_export_leftovers_object_path_key unique (object_path)
);

alter table private.data_export_leftovers enable row level security;

-- ===========================================================================
-- 6. notifications: the fields of the two new kinds
-- ===========================================================================
-- Same rules as before for the eleven kinds of #229, #259 and #511, plus:
-- - household_handed_over: who asked to delete the account (actor), nothing else;
-- - data_export_ready: nothing (the export is the recipient's own; no actor).
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
      when 'member_joined' then
        actor_member_id is not null
        and num_nonnulls(todo_id, deadline_id, event_id, occurrence_date, days_before, evening_date, free_from,
                         item_count, wishlist_reservation_id, ride_leg, other_event_id, other_occurrence_date,
                         subject_member_id) = 0
      when 'event_reminder' then
        event_id is not null and occurrence_date is not null
        and num_nonnulls(actor_member_id, todo_id, deadline_id, days_before, evening_date, free_from, item_count,
                         wishlist_reservation_id, ride_leg, other_event_id, other_occurrence_date,
                         subject_member_id) = 0
      when 'ride_reminder' then
        event_id is not null and occurrence_date is not null and ride_leg is not null
        and days_before in (0, 1)
        and num_nonnulls(actor_member_id, todo_id, deadline_id, evening_date, free_from, item_count,
                         wishlist_reservation_id, other_event_id, other_occurrence_date, subject_member_id) = 0
      when 'overlap_tomorrow' then
        event_id is not null and occurrence_date is not null
        and other_event_id is not null and other_occurrence_date is not null
        and subject_member_id is not null
        and (event_id, occurrence_date) < (other_event_id, other_occurrence_date)
        and num_nonnulls(actor_member_id, todo_id, deadline_id, days_before, evening_date, free_from, item_count,
                         wishlist_reservation_id, ride_leg) = 0
      when 'ride_request' then
        actor_member_id is not null and event_id is not null and occurrence_date is not null
        and ride_leg is not null
        and num_nonnulls(todo_id, deadline_id, days_before, evening_date, free_from, item_count,
                         wishlist_reservation_id, other_event_id, other_occurrence_date, subject_member_id) = 0
      -- Who asked to delete the account (the previous organiser).
      when 'household_handed_over' then
        actor_member_id is not null
        and num_nonnulls(todo_id, deadline_id, event_id, occurrence_date, days_before, evening_date, free_from,
                         item_count, wishlist_reservation_id, ride_leg, other_event_id, other_occurrence_date,
                         subject_member_id) = 0
      -- Nothing: the export is the recipient's own.
      when 'data_export_ready' then
        num_nonnulls(actor_member_id, todo_id, deadline_id, event_id, occurrence_date, days_before, evening_date,
                     free_from, item_count, wishlist_reservation_id, ride_leg, other_event_id,
                     other_occurrence_date, subject_member_id) = 0
      else false
    end
  );

-- ===========================================================================
-- 7. profiles.password_changed_at: display only
-- ===========================================================================
comment on column public.profiles.password_changed_at is
  'Display only («Password · Cambiata il …», mn1-09). Never used for a security decision '
  '(sessions, deletion, recovery, access): the app can rewrite it with mark_password_changed().';
