-- Issue #90 (data): first_shopping_item_at for the households that already added items
-- before the trigger existed: the creation time of their oldest item. Items removed by a
-- strappo and still kept for «Annulla» (private.removed_shopping_items) count too: they
-- were added to the list. Households without any item stay null.
-- Same rule as the trigger (the oldest wins), so it is idempotent and safe if items are
-- added while it runs.

update public.households h
set first_shopping_item_at = f.first_at
from (
  select x.household_id, min(x.created_at) as first_at
  from (
    select s.household_id, s.created_at from public.shopping_items s
    union all
    select r.household_id, r.created_at from private.removed_shopping_items r
  ) x
  group by x.household_id
) f
where h.id = f.household_id
  and (h.first_shopping_item_at is null or h.first_shopping_item_at > f.first_at);
