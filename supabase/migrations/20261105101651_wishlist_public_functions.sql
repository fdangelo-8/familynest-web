-- Issue #259 (for page #33 «Pagina pubblica della lista», decision D2): the only functions
-- that show data of a household to somebody who is not a member. They are the only way in
-- for the public page: anon has no privilege on any table of the wish list.
--
-- 1. get_public_wishlist(p_code, p_giver_key): what the page /desideri/<code> shows;
-- 2. get_public_wishlist_photo(p_code, p_item_id): the photo of one idea of that list;
-- 3. reserve_public_wishlist_item(p_code, p_item_id, p_name, p_giver_key): «Lo regalo io».
--
-- Rules shared by the three (D2, #33 §6 and §7):
-- - executable by anon and authenticated (grants migration). A session of the app changes
--   nothing: the functions never read the household of the caller;
-- - only POST through the Data API (lesson of #112): any other method (GET, HEAD, PUT…)
--   is refused with P0001 'use POST' before anything is read. Code, key and name travel
--   only in the body of the request, never in a URL;
-- - a code works only when it is exactly 64 lower-case hexadecimal characters, belongs to
--   a link that is not disabled and whose expires_at is after now() (time of the
--   database), and its list and child still exist. Every other code (malformed, unknown,
--   disabled, expired, deleted) gives the same answer, with no other data, so nobody can
--   tell whether a code exists or ever existed. Codes are 256 random bits compared for
--   equality through the unique index: they cannot be enumerated or guessed;
-- - only the list of that link: never another list of the same household, never another
--   household;
-- - only the fields allowed by D2: name and colour of the child, day and month of the
--   occasion (never the year, the age or the birth date), the ideas (title, link, shop,
--   note, price, photo) and their state free / mine / taken. Never the name of the giver,
--   when something was taken, the household, the other members, sizes, school, ids of the
--   household, the child or the list;
-- - no error is raised for the expected cases (the outcome is in the result), so the name
--   of the giver, the key and the code never end up in an error message or in the logs of
--   the database.
-- `security definer` (owner: postgres): the caller cannot read any of these rows; these
-- functions decide what comes out. `set search_path = ''`, fully qualified names.
-- Execute grants are in the wishlist_policies_and_grants migration.

-- ---------------------------------------------------------------------------
-- The active link of a code, or no row.
-- ---------------------------------------------------------------------------
create or replace function private.wishlist_active_link(p_code text)
returns table (
  link_id uuid,
  household_id uuid,
  wishlist_id uuid,
  occasion_date date,
  child_name text,
  child_color public.member_color
)
language sql
stable
security definer
set search_path = ''
as $$
  select l.id, l.household_id, l.wishlist_id, l.occasion_date, m.name, m.color
  from public.wishlist_share_links l
  join public.wishlists w
    on w.id = l.wishlist_id
   and w.household_id = l.household_id
  join public.household_members m
    on m.id = w.member_id
   and m.household_id = w.household_id
   and m.kind = 'child'
  where p_code ~ '^[0-9a-f]{64}$'
    and l.code = p_code
    and l.disabled_at is null
    and l.expires_at > now();
$$;

-- Fingerprint of a browser key for a list: SHA-256 of the key and the id of the list, so the
-- same key gives different fingerprints in different lists. Null for a missing or malformed
-- key (32-128 characters of [A-Za-z0-9+/=_-]).
create or replace function private.wishlist_giver_key_hash(p_giver_key text, p_wishlist_id uuid)
returns bytea
language sql
immutable
set search_path = ''
as $$
  select case
    when p_giver_key ~ '^[A-Za-z0-9+/=_-]{32,128}$' and p_wishlist_id is not null
    then extensions.digest(convert_to(p_giver_key || ':' || p_wishlist_id::text, 'UTF8'), 'sha256')
  end;
$$;

-- ---------------------------------------------------------------------------
-- 1. Reading the public list (#33 §2, §3, Dati punto 1).
--
-- Always exactly one row.
-- - 'inactive' (see the header) with every other field null;
-- - 'active' with: child_name and child_color; occasion_month and occasion_day (1-12, 1-31)
--   of the occasion of the link, never its year; items: the ideas of the list of the link,
--   already in the order of the page: first those not taken by others (free and mine), most
--   recent first; then those taken by others, most recently taken first. Every idea with
--   only the fields of public.public_wishlist_item. state 'mine' when the fingerprint of
--   p_giver_key (optional) is the one saved with the reservation.
-- Writes nothing.
-- ---------------------------------------------------------------------------
create or replace function public.get_public_wishlist(p_code text, p_giver_key text default null)
returns table (
  status public.wishlist_link_status,
  child_name text,
  child_color public.member_color,
  occasion_month smallint,
  occasion_day smallint,
  items public.public_wishlist_item[]
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_link record;
  v_found boolean := false;
  v_hash bytea;
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  select a.* into v_link from private.wishlist_active_link(p_code) a;
  v_found := found;

  if not v_found then
    return query
      select 'inactive'::public.wishlist_link_status, null::text, null::public.member_color,
             null::smallint, null::smallint, null::public.public_wishlist_item[];
    return;
  end if;

  v_hash := private.wishlist_giver_key_hash(p_giver_key, v_link.wishlist_id);

  return query
    with ideas as (
      select
        i.id,
        i.title,
        i.url,
        i.shop_name,
        i.note,
        i.price_cents,
        exists (select 1 from public.wishlist_item_photos p where p.item_id = i.id) as has_photo,
        case
          when r.id is null then 'free'
          when v_hash is not null and r.giver_key_hash = v_hash then 'mine'
          else 'taken'
        end::public.wishlist_item_state as state,
        i.created_at,
        r.created_at as taken_at
      from public.wishlist_items i
      left join public.wishlist_reservations r on r.item_id = i.id
      where i.wishlist_id = v_link.wishlist_id
        and i.household_id = v_link.household_id
    )
    select
      'active'::public.wishlist_link_status,
      v_link.child_name,
      v_link.child_color,
      extract(month from v_link.occasion_date)::smallint,
      extract(day from v_link.occasion_date)::smallint,
      coalesce(
        (
          select array_agg(
            row(d.id, d.title, d.url, d.shop_name, d.note, d.price_cents, d.has_photo, d.state)::public.public_wishlist_item
            order by
              d.state = 'taken',
              case when d.state = 'taken' then d.taken_at end desc,
              d.created_at desc,
              d.id
          )
          from ideas d
        ),
        '{}'::public.public_wishlist_item[]
      );
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. The photo of one idea of the list of an active code (#32 Dati punto 6): one row with
-- content_type ('image/webp' or 'image/jpeg') and the bytes in base64 (without line
-- breaks), or no row at all when the code does not work, the idea is not of that list or
-- has no photo (same answer in every case). The page shows it with a `data:` or `blob:`
-- address: the code never goes into the address of an image. Writes nothing.
-- ---------------------------------------------------------------------------
create or replace function public.get_public_wishlist_photo(p_code text, p_item_id uuid)
returns table (
  content_type text,
  data_base64 text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  return query
    select p.content_type, translate(encode(p.data, 'base64'), E'\n', '')
    from private.wishlist_active_link(p_code) a
    join public.wishlist_items i
      on i.wishlist_id = a.wishlist_id
     and i.household_id = a.household_id
    join public.wishlist_item_photos p
      on p.item_id = i.id
     and p.household_id = i.household_id
    where i.id = p_item_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. «Lo regalo io» (#33 §4, Dati punto 2). Checks, in this order, and the outcome of the
-- first that fails (public.wishlist_reservation_outcome):
-- 1. the name, normalised (spaces at the ends removed, runs of spaces become one), has
--    1-40 characters                                                  -> invalid_name
-- 2. the browser key has 32-128 characters of [A-Za-z0-9+/=_-]       -> invalid_key
-- 3. the code works (see the header)                                  -> inactive
-- 4. the idea belongs to the list of that link                        -> not_found
-- 5. nobody took the idea yet                                         -> taken
-- 6. fewer than 30 ideas of this list were taken in the last hour     -> rate_limited
-- Then the reservation is saved (name, fingerprint of key and list, link, now()) ->
-- reserved, and the «Regalo preso» notification is written for every adult with an account
-- of the household (trigger of the gift_taken_notifications migration).
-- Concurrency: the link row is locked (for share: it cannot be disabled meanwhile), then
-- the list with a transaction advisory lock before counting (lesson of #192), then the idea
-- (for share: it cannot be deleted meanwhile). Two requests for the same idea: one gets
-- reserved, the other taken (also the unique key of the table, on conflict do nothing).
-- ---------------------------------------------------------------------------
create or replace function public.reserve_public_wishlist_item(
  p_code text,
  p_item_id uuid,
  p_name text,
  p_giver_key text
)
returns public.wishlist_reservation_outcome
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  -- Maximum number of ideas of one list taken in the last hour (#33 Dati punto 2).
  c_max_per_hour constant integer := 30;
  v_name text;
  v_link record;
  v_count integer;
  v_rows integer;
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  v_name := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  if char_length(v_name) not between 1 and 40 then
    return 'invalid_name';
  end if;

  if p_giver_key is null or p_giver_key !~ '^[A-Za-z0-9+/=_-]{32,128}$' then
    return 'invalid_key';
  end if;

  if p_code is null or p_code !~ '^[0-9a-f]{64}$' then
    return 'inactive';
  end if;

  select l.id, l.household_id, l.wishlist_id into v_link
  from public.wishlist_share_links l
  join public.wishlists w
    on w.id = l.wishlist_id
   and w.household_id = l.household_id
  where l.code = p_code
    and l.disabled_at is null
    and l.expires_at > now()
  for share of l;

  if not found then
    return 'inactive';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('public.wishlist_reservations:' || v_link.wishlist_id::text, 0));

  perform 1
  from public.wishlist_items i
  where i.id = p_item_id
    and i.wishlist_id = v_link.wishlist_id
    and i.household_id = v_link.household_id
  for share;

  if not found then
    return 'not_found';
  end if;

  if exists (select 1 from public.wishlist_reservations r where r.item_id = p_item_id) then
    return 'taken';
  end if;

  select count(*) into v_count
  from public.wishlist_reservations r
  join public.wishlist_items i on i.id = r.item_id
  where i.wishlist_id = v_link.wishlist_id
    and r.created_at > now() - interval '1 hour';

  if v_count >= c_max_per_hour then
    return 'rate_limited';
  end if;

  insert into public.wishlist_reservations (household_id, item_id, share_link_id, giver_name, giver_key_hash)
  values (
    v_link.household_id, p_item_id, v_link.id, v_name,
    private.wishlist_giver_key_hash(p_giver_key, v_link.wishlist_id)
  )
  on conflict (item_id) do nothing;

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    return 'taken';
  end if;

  return 'reserved';
end;
$$;
