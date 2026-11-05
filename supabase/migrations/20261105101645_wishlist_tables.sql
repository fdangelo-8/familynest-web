-- Issue #259 (for pages #32 «Lista desideri» and #33 «Pagina pubblica della lista»): the
-- wish list of each child, its ideas, the photos copied from the shops, the shared links
-- and the ideas taken with «Lo regalo io».
-- - wishlists:             at most one list per child (only children: never an adult or a pet);
-- - wishlist_items:        the ideas of a list, at most 50 per list;
-- - wishlist_item_photos:  the reduced copy of the photo of an idea (at most 100 KB), stored
--                          in the database so that it goes with its idea, its list and its
--                          household through the foreign keys (Storage files do not follow
--                          `on delete cascade`);
-- - wishlist_share_links:  the links of the public page: a random code of 256 bits, the
--                          occasion (birthday), the expiry and the disabling;
-- - wishlist_reservations: who took an idea («Lo regalo io»): the name left by the giver and
--                          the fingerprint of their browser key, at most one per idea.
--
-- RLS is enabled here, in the same migration that creates each table. Policies and grants
-- are in the wishlist_policies_and_grants migration: until then RLS denies every row to
-- the API roles. The app never writes these tables directly: the page functions
-- (wishlist_functions_and_triggers) and the public functions (wishlist_public_functions)
-- are the only writers.
--
-- Same-household rule without triggers: every reference goes through a composite foreign
-- key that includes household_id, so no row can ever point to a child, a list, an idea or
-- a link of another household. `on delete cascade` everywhere: removing the child, or
-- deleting the household (for example when its last adult with an account leaves or
-- deletes the account), deletes list, ideas, photos, links, reservations and their
-- notifications. The author of an idea is `on delete set null`.
--
-- Stored personal data (privacy skill, decision D2, #32 §12): title, link, shop, price,
-- reduced photo and note of an idea; who of the household added it (only for «I tuoi
-- dati», #38); code, occasion, expiry and state of a link; the name left by the giver,
-- the fingerprint of their browser key and the time of the reservation. Never sizes,
-- school, health data, surname, email, phone or IP address of the giver, never the browser
-- key itself. Free texts and codes are never written to logs, errors, analytics or URLs.
-- How long they stay: until an adult deletes them; the reservations, the ideas taken and
-- the links of an occasion are deleted 30 days after it (job of the
-- schedule_wishlist_cleanup migration).

-- ---------------------------------------------------------------------------
-- wishlists: one per child.
-- ---------------------------------------------------------------------------
create table public.wishlists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.current_household_id()
    references public.households (id) on delete cascade,
  member_id uuid not null,
  -- Always 'child': part of the composite foreign key.
  member_kind public.member_kind not null default 'child',
  created_at timestamptz not null default now(),

  -- Target of the composite foreign keys of ideas and links.
  constraint wishlists_id_household_key unique (id, household_id),
  constraint wishlists_member_fkey foreign key (member_id, household_id, member_kind)
    references public.household_members (id, household_id, kind) on delete cascade,
  -- One list per child (also the index of the composite foreign key, leading column member_id).
  constraint wishlists_member_key unique (member_id),
  constraint wishlists_member_kind_child check (member_kind = 'child')
);

-- Foreign key towards households; also used by the RLS policies.
create index wishlists_household_id_idx on public.wishlists (household_id);

alter table public.wishlists enable row level security;

-- ---------------------------------------------------------------------------
-- wishlist_items: the ideas of a list.
-- ---------------------------------------------------------------------------
create table public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  wishlist_id uuid not null,
  -- Written by the user or read from the shop page (#32 §5).
  title text not null,
  -- Link of the shop: only http and https with a host, no spaces.
  url text,
  -- Name of the shop («Feltrinelli», «lafeltrinelli.it»).
  shop_name text,
  -- Euro cents, from 0,01 to 99.999,99 €.
  price_cents integer,
  -- «Nota per chi regala»: shown also on the public page.
  note text,
  -- Member who added the idea, set by the database (never chosen by the app). Null when
  -- that member has left the household. Read only by «I tuoi dati» (#38).
  added_by_member_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Target of the composite foreign keys of photos and reservations.
  constraint wishlist_items_id_household_key unique (id, household_id),
  constraint wishlist_items_wishlist_fkey foreign key (wishlist_id, household_id)
    references public.wishlists (id, household_id) on delete cascade,
  constraint wishlist_items_added_by_fkey foreign key (added_by_member_id, household_id)
    references public.household_members (id, household_id) on delete set null (added_by_member_id),

  -- Stored normalised: no leading/trailing whitespace, inner whitespace runs become one space.
  constraint wishlist_items_title_normalized check (title = btrim(regexp_replace(title, '\s+', ' ', 'g'))),
  constraint wishlist_items_title_length check (char_length(title) between 1 and 80),
  constraint wishlist_items_url_length check (char_length(url) between 1 and 2000),
  -- Never javascript:, data:, ftp:… (the public page makes it a link).
  constraint wishlist_items_url_http check (url ~* '^https?://[^/?#\s]+' and url !~ '\s'),
  constraint wishlist_items_shop_name_normalized check (shop_name = btrim(regexp_replace(shop_name, '\s+', ' ', 'g'))),
  constraint wishlist_items_shop_name_length check (char_length(shop_name) between 1 and 40),
  constraint wishlist_items_price_range check (price_cents between 1 and 9999999),
  constraint wishlist_items_note_normalized check (note = btrim(regexp_replace(note, '\s+', ' ', 'g'))),
  constraint wishlist_items_note_length check (char_length(note) between 1 and 80)
);

-- Ideas of a list, most recent first; leading column also indexes the composite foreign key.
create index wishlist_items_wishlist_created_idx on public.wishlist_items (wishlist_id, created_at desc, id);
-- Foreign key towards households; also used by the RLS policies.
create index wishlist_items_household_id_idx on public.wishlist_items (household_id);
-- Composite foreign key towards the author (set null when a member leaves) and «I tuoi dati».
create index wishlist_items_added_by_member_id_idx
  on public.wishlist_items (added_by_member_id) where added_by_member_id is not null;

alter table public.wishlist_items enable row level security;

-- ---------------------------------------------------------------------------
-- wishlist_item_photos: the reduced copy of the photo of an idea (#32 §5, Dati punto 6).
-- One photo per idea (primary key item_id): a photo can never be used by two ideas. Only
-- WebP and JPEG, at most 100 KB, and the first bytes must be those of the declared format.
-- Never the address of the image on the shop: neither page loads anything from third
-- parties.
-- ---------------------------------------------------------------------------
create table public.wishlist_item_photos (
  item_id uuid primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  content_type text not null,
  data bytea not null,
  created_at timestamptz not null default now(),

  constraint wishlist_item_photos_item_fkey foreign key (item_id, household_id)
    references public.wishlist_items (id, household_id) on delete cascade,
  constraint wishlist_item_photos_content_type check (content_type in ('image/webp', 'image/jpeg')),
  constraint wishlist_item_photos_size check (octet_length(data) between 12 and 102400),
  constraint wishlist_item_photos_format check (
    case content_type
      when 'image/jpeg' then substring(data from 1 for 3) = '\xffd8ff'::bytea
      when 'image/webp' then substring(data from 1 for 4) = '\x52494646'::bytea
                         and substring(data from 9 for 4) = '\x57454250'::bytea
      else false
    end
  )
);

-- Foreign key towards households; also used by the RLS policies.
create index wishlist_item_photos_household_id_idx on public.wishlist_item_photos (household_id);

alter table public.wishlist_item_photos enable row level security;

-- ---------------------------------------------------------------------------
-- wishlist_share_links: the links of the public page /desideri/<code> (#32 §6, D2).
-- A link is «active» while disabled_at is null and expires_at is in the future.
-- - code: 256 random bits written as 64 lower-case hexadecimal characters, generated by the
--   database (never derived from ids, never sent by the app);
-- - occasion_date: the birthday the link was created for (day of Rome);
-- - expires_at: 00:00 of Rome of the second day after the occasion;
-- - disabled_at: when the link was closed: disabled by an adult, or replaced by a new link
--   after it expired. A closed link never works again.
-- At most one open (not closed) link per list, so at most one active link, also with
-- requests close together (unique partial index below).
-- ---------------------------------------------------------------------------
create table public.wishlist_share_links (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  wishlist_id uuid not null,
  code text not null default encode(extensions.gen_random_bytes(32), 'hex'),
  occasion_date date not null,
  expires_at timestamptz not null,
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Target of the composite foreign key of the reservations.
  constraint wishlist_share_links_id_household_key unique (id, household_id),
  constraint wishlist_share_links_wishlist_fkey foreign key (wishlist_id, household_id)
    references public.wishlists (id, household_id) on delete cascade,
  -- Looked up by equality only (unique index): codes cannot be enumerated.
  constraint wishlist_share_links_code_key unique (code),
  constraint wishlist_share_links_code_format check (code ~ '^[0-9a-f]{64}$')
);

-- At most one open link per list (also the index of the composite foreign key for the open
-- links).
create unique index wishlist_share_links_one_open_per_list_idx
  on public.wishlist_share_links (wishlist_id)
  where disabled_at is null;
-- Links of a list, most recent first (page #32); leading column indexes the composite
-- foreign key.
create index wishlist_share_links_wishlist_created_idx
  on public.wishlist_share_links (wishlist_id, created_at desc);
-- Foreign key towards households; also used by the RLS policies.
create index wishlist_share_links_household_id_idx on public.wishlist_share_links (household_id);
-- Daily cleanup of the occasions older than 30 days, across households.
create index wishlist_share_links_occasion_date_idx on public.wishlist_share_links (occasion_date);

alter table public.wishlist_share_links enable row level security;

-- ---------------------------------------------------------------------------
-- wishlist_reservations: «Lo regalo io» (#33 §4). At most one per idea.
-- - share_link_id: the link used (occasion of the reservation, for the cleanup);
-- - giver_name: the name left by the giver, normalised, 1-40 characters. Seen only by the
--   adults with an account of the household (#32 §3.5), never by the public page;
-- - giver_key_hash: SHA-256 of the browser key of the giver and of the list (never the key
--   itself), so that the public page shows «Lo regali tu» to the same browser and the same
--   person cannot be linked across lists. Null when written without a key (seed, tests).
-- ---------------------------------------------------------------------------
create table public.wishlist_reservations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  item_id uuid not null,
  share_link_id uuid not null,
  giver_name text not null,
  giver_key_hash bytea,
  created_at timestamptz not null default now(),

  -- Target of the composite foreign key of the notifications.
  constraint wishlist_reservations_id_household_key unique (id, household_id),
  constraint wishlist_reservations_item_fkey foreign key (item_id, household_id)
    references public.wishlist_items (id, household_id) on delete cascade,
  constraint wishlist_reservations_share_link_fkey foreign key (share_link_id, household_id)
    references public.wishlist_share_links (id, household_id) on delete cascade,
  -- One reservation per idea (also the index of the composite foreign key, leading column item_id).
  constraint wishlist_reservations_item_key unique (item_id),
  constraint wishlist_reservations_giver_name_normalized check (
    giver_name = btrim(regexp_replace(giver_name, '\s+', ' ', 'g'))
  ),
  constraint wishlist_reservations_giver_name_length check (char_length(giver_name) between 1 and 40),
  constraint wishlist_reservations_giver_key_hash_length check (octet_length(giver_key_hash) = 32)
);

-- Composite foreign key towards the links (cascade when the cleanup deletes a link).
create index wishlist_reservations_share_link_id_idx on public.wishlist_reservations (share_link_id);
-- Foreign key towards households; also used by the RLS policies.
create index wishlist_reservations_household_id_idx on public.wishlist_reservations (household_id);

alter table public.wishlist_reservations enable row level security;
