-- Issue #617 (database of A13 «Il tuo Nest», #546), R4: the counter of the invitation
-- mails. One row per mail of invitation that the server of the app is about to send,
-- recorded by public.record_invitation_mail() (il_tuo_nest_functions_and_triggers
-- migration), which refuses beyond the limits: 3 mails per invitation and 20 per household
-- in the last 24 hours. The rows are deleted 48 hours after the mail by the pg_cron job
-- (schedule_invitation_mails_purge migration), and with their invitation or their
-- household (on delete cascade).
--
-- The table is in the private schema, which the Data API does not expose. No API role
-- (anon, authenticated, service_role) has any privilege on it, and RLS is enabled with no
-- policy: only the owner (postgres) reads and writes it, through the functions.
--
-- Privacy (#546 §3 «Mail», privacy skill): the address the mail goes to is never stored,
-- in no column; nor is the text of the mail. Only which invitation, which household and
-- when.

create table private.invitation_mails (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  invitation_id uuid not null references public.invitations (id) on delete cascade,
  sent_at timestamptz not null default now()
);

-- The limit per invitation counts the rows of one invitation in the last 24 hours; also
-- the index of the invitation foreign key (leading column).
create index invitation_mails_invitation_id_sent_at_idx
  on private.invitation_mails (invitation_id, sent_at);

-- The limit per household counts the rows of one household in the last 24 hours; also the
-- index of the household foreign key (leading column).
create index invitation_mails_household_id_sent_at_idx
  on private.invitation_mails (household_id, sent_at);

-- The purge deletes the rows older than 48 hours, for every household.
create index invitation_mails_sent_at_idx
  on private.invitation_mails (sent_at);

alter table private.invitation_mails enable row level security;

revoke all on table private.invitation_mails from public, anon, authenticated, service_role;
