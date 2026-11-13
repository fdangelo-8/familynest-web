-- Issue #373: the rows of calendar_outbox are claimed before they are sent, so that two runs
-- of the synchronisation service started together never send the same change twice.
--
-- - claimed_until:         null when the row is free. A run that takes the row sets it to a
--                          few minutes from now (claim_calendar_outbox_items()); until then no
--                          other run takes it. When the run dies without telling the database,
--                          the row becomes free again by itself at that instant.
-- - changed_while_claimed: the event changed (title, place, times, repetition) while the row
--                          was being sent: the values read by the run may be old, so
--                          complete_calendar_outbox_item() keeps the row (as an «update») instead
--                          of removing it, and the latest values are sent too.
--
-- No text, no person: the outbox still holds no data of the events. RLS stays enabled and
-- the API roles still have no privilege on the table (linked_calendars_policies_and_grants).

alter table public.calendar_outbox
  add column claimed_until timestamptz,
  add column changed_while_claimed boolean not null default false;

alter table public.calendar_outbox
  add constraint calendar_outbox_claimed_until_finite check (
    claimed_until is null or isfinite(claimed_until)
  );
