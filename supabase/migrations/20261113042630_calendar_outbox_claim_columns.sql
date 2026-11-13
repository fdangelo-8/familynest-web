-- Issue #373: the rows of calendar_outbox are claimed before they are sent, so that two runs
-- of the synchronisation service started together never send the same change twice.
--
-- - claimed_until:         null when the row is free. A run that takes the row sets it to a
--                          few minutes from now (claim_calendar_outbox_items()); until then no
--                          other run takes it. When the run dies without telling the database,
--                          the row becomes free again by itself at that instant.
-- - claim_token:           a random value given to the run that holds the row (null when the
--                          row is free). The run passes it back to complete_calendar_outbox_item()
--                          and fail_calendar_outbox_item(): once its claim has expired and
--                          another run has taken the row, or once the row was completed or
--                          failed, the token no longer matches and the late call changes
--                          nothing. Never shown to the app (no privilege on the table).
-- - changed_while_claimed: the event changed (title, place, times, repetition) while the row
--                          was held by a run: the values read by that run may be old, so
--                          complete_calendar_outbox_item() keeps the row (as an «update») instead
--                          of removing it, and the latest values are sent too. Only a held row
--                          can be marked: the next run of a free row reads the latest values.
--
-- No text, no person: the outbox still holds no data of the events. RLS stays enabled and
-- the API roles still have no privilege on the table (linked_calendars_policies_and_grants).

alter table public.calendar_outbox
  add column claimed_until timestamptz,
  add column claim_token uuid,
  add column changed_while_claimed boolean not null default false;

alter table public.calendar_outbox
  add constraint calendar_outbox_claimed_until_finite check (
    claimed_until is null or isfinite(claimed_until)
  ),
  add constraint calendar_outbox_claim_token_with_claim check (
    (claim_token is null) = (claimed_until is null)
  ),
  add constraint calendar_outbox_changed_only_while_claimed check (
    not changed_while_claimed or claimed_until is not null
  );
