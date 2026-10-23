-- Issue #62 (for page #21): the shopping list of the household ("Spesa").
-- One list per household. An item is "to buy" while checked_at is null and "taken"
-- once checked_at is set. Who checked an item is not stored (data minimisation).
--
-- RLS is enabled here, in the same migration that creates the table. Policies and
-- grants are in the shopping_items_policies_and_grants migration: until then RLS
-- denies every row to the API roles.
-- Text normalisation, the author of an item and the "no duplicate among the items to
-- buy" rule are enforced by triggers in the shopping_items_functions_and_triggers
-- migration.

create table public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  -- The app may omit it: the household of the caller.
  household_id uuid not null default public.current_household_id()
    references public.households (id) on delete cascade,
  name text not null,
  quantity text,
  -- Member who added the item, set by the database (never chosen by the app).
  -- Null when that member has left the household.
  added_by_member_id uuid references public.household_members (id) on delete set null,
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Stored normalised: no leading/trailing whitespace, inner whitespace runs become one space.
  constraint shopping_items_name_normalized check (name = btrim(regexp_replace(name, '\s+', ' ', 'g'))),
  constraint shopping_items_name_length check (char_length(name) between 1 and 80),
  constraint shopping_items_quantity_normalized check (
    quantity is null or quantity = btrim(regexp_replace(quantity, '\s+', ' ', 'g'))
  ),
  constraint shopping_items_quantity_length check (quantity is null or char_length(quantity) between 1 and 20),
  constraint shopping_items_checked_after_created check (checked_at is null or checked_at >= created_at)
);

-- "Da prendere": oldest first. Leading column also indexes the household_id foreign key.
create index shopping_items_household_created_idx
  on public.shopping_items (household_id, created_at);
-- "Presi": last taken first.
create index shopping_items_household_checked_idx
  on public.shopping_items (household_id, checked_at);
create index shopping_items_added_by_member_id_idx
  on public.shopping_items (added_by_member_id);
-- Duplicate check among the items to buy (same name, ignoring case).
create index shopping_items_to_buy_name_idx
  on public.shopping_items (household_id, lower(name))
  where checked_at is null;

alter table public.shopping_items enable row level security;
