-- Issue #512 (DB-3 of plan #501, for page A7 #540): «Svuota tutta la lista» keeps a copy
-- of every removed thing for «Annulla», also of the things still to buy. Their copy has no
-- check time, so private.removed_shopping_items.checked_at becomes optional (rule 7).
-- The copies of the strappo (clear_checked_shopping_items) keep writing it, as before.
-- No new personal data: same columns, kept for the same 10 minute window.
alter table private.removed_shopping_items
  alter column checked_at drop not null;

-- The taken things disappear 12 hours after they were taken (pg_cron job
-- purge-taken-shopping-items, every 10 minutes, for every household): this partial index
-- finds them without reading the things to buy. The job for one household uses
-- shopping_items_household_checked_idx.
create index shopping_items_taken_checked_at_idx
  on public.shopping_items (checked_at)
  where checked_at is not null;
