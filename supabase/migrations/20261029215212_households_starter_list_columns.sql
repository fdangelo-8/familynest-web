-- Issue #90 (for page #30 Oggi): what the starter list ("Per cominciare") and its end
-- need to know about a household. Two UTC instants, no personal data.
--
-- - first_shopping_item_at: when the first item was ever added to the shopping list of
--   the household (step «Scrivi la prima cosa da comprare»). Set by the database only
--   (trigger on shopping_items, functions_and_triggers migration; existing households in
--   the backfill migration), never cleared: the step stays done even after the item is
--   removed.
-- - starter_list_completed_at: when the starter list was completed. Set only by
--   complete_starter_list(), which checks the conditions on the server, never cleared:
--   the list never comes back for that household, even after a new invitation.
--
-- Both are read by the members with the existing households_select policy (the select
-- grant on households covers every column). The app cannot write them: the update
-- grant of households is limited to name and household_type.

alter table public.households
  add column first_shopping_item_at timestamptz,
  add column starter_list_completed_at timestamptz;
