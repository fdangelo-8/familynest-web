-- Issue #259 (for pages #32 «Lista desideri» and #33 «Pagina pubblica della lista»):
-- enumerated and composite types returned by the public functions of the wish list
-- (wishlist_public_functions migration). No table, no stored data.

-- State of a shared link as the public page sees it. Every unusable code (malformed,
-- unknown, disabled, expired, list or child deleted) is the same 'inactive', with every
-- other field null: whoever has a code cannot tell why it does not work, nor whether it
-- ever existed.
create type public.wishlist_link_status as enum ('active', 'inactive');

-- State of one idea for whoever looks at the public page (#33 §3 and §5):
-- - free  = nobody took it: button «Lo regalo io»;
-- - mine  = taken from this browser (the fingerprint of the browser key matches): «Lo regali tu»;
-- - taken = taken by somebody else: «Già preso». Never who, never when.
create type public.wishlist_item_state as enum ('free', 'mine', 'taken');

-- Outcome of «Lo regalo io» (#33 §4.5), so that the page can tell the cases apart without
-- any error message (nothing about the name or the key reaches the logs):
-- - reserved      the idea is now taken by this browser;
-- - taken         somebody else took it (also a few milliseconds before);
-- - not_found     no such idea in the list of this link (deleted, of another list, of
--                 another household, never existed: always the same);
-- - inactive      the code does not work (same rule as wishlist_link_status);
-- - rate_limited  too many ideas taken in this list in the last hour (30);
-- - invalid_name  the name is empty or longer than 40 characters after normalisation;
-- - invalid_key   the browser key is missing or not 32-128 characters of [A-Za-z0-9+/=_-].
create type public.wishlist_reservation_outcome as enum (
  'reserved',
  'taken',
  'not_found',
  'inactive',
  'rate_limited',
  'invalid_name',
  'invalid_key'
);

-- One idea of the public page: the closed list of fields allowed by decision D2 (#33 §7).
-- The id is the only id returned (needed by «Lo regalo io» and by the photo). Never the
-- household, the child, the list, who added it, who took it, when.
-- price_cents: euro cents. has_photo: the photo is read with get_public_wishlist_photo().
create type public.public_wishlist_item as (
  id uuid,
  title text,
  url text,
  shop_name text,
  note text,
  price_cents integer,
  has_photo boolean,
  state public.wishlist_item_state
);
