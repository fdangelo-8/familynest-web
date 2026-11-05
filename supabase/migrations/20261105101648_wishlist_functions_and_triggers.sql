-- Issue #259 (for page #32 «Lista desideri»): triggers of the wish list, the functions of
-- the page and the cleanup 30 days after an occasion.
--
-- Conventions (same as the other migrations):
-- - every function has `set search_path = ''` and fully qualified names;
-- - helpers, trigger functions and jobs live in the "private" schema (not exposed by the
--   Data API, not in the generated types);
-- - the app has no write privilege on the tables of the wish list (grants migration): the
--   page writes only through the functions below. They are `security definer` and apply
--   explicitly the rules of the page: the household is always the caller's (session), the
--   child must be a child of that household, ids of households, lists, authors, links or
--   codes are never received (LEZIONI: the client sends ids and values, the database
--   decides);
-- - they refuse every Data API method other than POST (lesson of #112);
-- - the triggers (normalisation, limit of 50 ideas, link and idea of the same list) apply
--   to every role, the administrative key of the page tests included.
-- Execute grants are in the wishlist_policies_and_grants migration.
--
-- Errors (the page recognises them by code; messages never contain titles, names or codes):
-- - P0001 'use POST': called through the Data API with a method other than POST;
-- - 22004: a required argument is null;
-- - 22023: the photo is not valid base64, or only one of photo and content type is given;
-- - 23514: a value not allowed (title empty or longer than 80 characters, note longer than
--   80, link not http/https or longer than 2000, shop longer than 40, price out of range,
--   photo larger than 100 KB or not the declared format);
-- - 42501: no signed-in user, no household, or a member or an idea that is not of the
--   caller's household, or a member that is not a child (same answer in every case:
--   nothing about other households leaks);
-- - FN005 'wishlist item limit reached': the list already has 50 ideas;
-- - FN006 'birth date required': «Condividi» for a child without birth date;
-- - FN007 'wishlist has no items': «Condividi» for a list without ideas.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- The next birthday from p_today (included): the same day and month as the birth date, this
-- year or the next one. 29 February becomes 28 February in the years that are not leap
-- years (#32 §6).
create or replace function private.wishlist_next_birthday(p_birth_date date, p_today date)
returns date
language sql
immutable
set search_path = ''
as $$
  with years as (
    select y
    from (values (extract(year from p_today)::integer), (extract(year from p_today)::integer + 1)) as t (y)
  ),
  candidates as (
    select case
      when extract(month from p_birth_date) = 2
       and extract(day from p_birth_date) = 29
       and not (y % 4 = 0 and (y % 100 <> 0 or y % 400 = 0))
      then make_date(y, 2, 28)
      else make_date(y, extract(month from p_birth_date)::integer, extract(day from p_birth_date)::integer)
    end as day
    from years
  )
  select min(c.day)
  from candidates c
  where c.day >= p_today;
$$;

-- Expiry of a link created for an occasion: 00:00 of Rome of the second day after it, so
-- the link works for the whole day after the party (D2: «scade il giorno dopo»).
create or replace function private.wishlist_link_expires_at(p_occasion_date date)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select ((p_occasion_date + 2)::timestamp at time zone 'Europe/Rome');
$$;

-- ---------------------------------------------------------------------------
-- wishlist_items: normalisation and the limit of 50 ideas per list (every role).
--
-- Concurrency (lesson of #192): inserts in the same list are serialised by a transaction
-- advisory lock taken before counting, so two requests close together cannot reach 51.
-- The trigger function is volatile, so in `read committed` (the isolation level of the
-- Data API) the count after the lock sees the rows committed by the transaction that held it.
-- ---------------------------------------------------------------------------
create or replace function private.wishlist_items_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  -- Maximum number of ideas of a list, taken or not (#32 §5 rule 6). The only place of
  -- this number in the database; the app has its own constant.
  c_max_items constant integer := 50;
  v_count integer;
begin
  new.title := btrim(regexp_replace(new.title, '\s+', ' ', 'g'));
  new.url := nullif(btrim(new.url), '');
  new.shop_name := nullif(btrim(regexp_replace(new.shop_name, '\s+', ' ', 'g')), '');
  new.note := nullif(btrim(regexp_replace(new.note, '\s+', ' ', 'g')), '');

  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id
       or new.household_id is distinct from old.household_id
       or new.wishlist_id is distinct from old.wishlist_id
       or new.created_at is distinct from old.created_at then
      raise exception 'this field of an idea cannot be changed' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.wishlist_id is not null then
    perform pg_advisory_xact_lock(hashtextextended('public.wishlist_items:' || new.wishlist_id::text, 0));

    select count(*) into v_count
    from public.wishlist_items i
    where i.wishlist_id = new.wishlist_id;

    if v_count >= c_max_items then
      raise exception 'wishlist item limit reached' using errcode = 'FN005';
    end if;
  end if;

  return new;
end;
$$;

create trigger wishlist_items_before_write
  before insert or update on public.wishlist_items
  for each row execute function private.wishlist_items_before_write();

create trigger wishlist_items_set_updated_at
  before update on public.wishlist_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- wishlist_share_links: household, list and code never change (every role).
-- ---------------------------------------------------------------------------
create or replace function private.wishlist_share_links_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.household_id is distinct from old.household_id
     or new.wishlist_id is distinct from old.wishlist_id
     or new.code is distinct from old.code
     or new.created_at is distinct from old.created_at then
    raise exception 'this field of a link cannot be changed' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger wishlist_share_links_before_update
  before update on public.wishlist_share_links
  for each row execute function private.wishlist_share_links_before_update();

create trigger wishlist_share_links_set_updated_at
  before update on public.wishlist_share_links
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- wishlist_reservations: the name is normalised and the link must be one of the list of the
-- idea (every role). A reservation never changes (no update by anybody but the owner).
-- ---------------------------------------------------------------------------
create or replace function private.wishlist_reservations_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.giver_name := btrim(regexp_replace(new.giver_name, '\s+', ' ', 'g'));

  if not exists (
    select 1
    from public.wishlist_items i
    join public.wishlist_share_links l
      on l.wishlist_id = i.wishlist_id
     and l.household_id = i.household_id
    where i.id = new.item_id
      and l.id = new.share_link_id
  ) then
    raise exception 'the link and the idea must belong to the same list' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger wishlist_reservations_before_insert
  before insert on public.wishlist_reservations
  for each row execute function private.wishlist_reservations_before_insert();

-- ---------------------------------------------------------------------------
-- The child of the caller's household for the page functions, or 42501.
-- Same error for: no session, no household, unknown member, member of another household,
-- adult or pet of the caller's household.
-- ---------------------------------------------------------------------------
create or replace function private.wishlist_caller_child(p_member_id uuid)
returns public.household_members
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_household_id uuid := (select public.current_household_id());
  v_child public.household_members;
begin
  if (select auth.uid()) is null or v_household_id is null or p_member_id is null then
    raise exception 'permission denied for the wish list' using errcode = '42501';
  end if;

  select m.* into v_child
  from public.household_members m
  where m.id = p_member_id
    and m.household_id = v_household_id
    and m.kind = 'child';

  if not found then
    raise exception 'permission denied for the wish list' using errcode = '42501';
  end if;

  return v_child;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC (write): «Aggiungi alla lista» (#32 §5). Adds an idea to the list of the child, and
-- creates the list with the first idea. Returns the id of the new idea.
-- - p_title: the title (written by the user, or read from the shop by the server of the
--   app), 1-80 after normalisation;
-- - p_url, p_shop_name, p_price_cents: read from the shop by the server of the app;
--   optional. That an adult of the household writes them by hand is accepted (#32 Dati
--   punto 4: data of their own household);
-- - p_note: «Nota per chi regala», optional (empty = none);
-- - p_photo_base64 + p_photo_content_type: the reduced copy of the photo made by the server
--   of the app (WebP or JPEG, at most 100 KB once decoded), both or neither. The photo is
--   stored with the idea, in the same transaction: it belongs to that idea only.
-- The author is the member of the session. Everything is saved or nothing is.
-- ---------------------------------------------------------------------------
create or replace function public.add_wishlist_item(
  p_member_id uuid,
  p_title text,
  p_url text default null,
  p_shop_name text default null,
  p_price_cents integer default null,
  p_note text default null,
  p_photo_base64 text default null,
  p_photo_content_type text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_child public.household_members;
  v_wishlist_id uuid;
  v_item_id uuid;
  v_photo bytea;
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  v_child := private.wishlist_caller_child(p_member_id);

  if p_title is null then
    raise exception 'the title is required' using errcode = '22004';
  end if;

  if (p_photo_base64 is null) <> (p_photo_content_type is null) then
    raise exception 'photo and content type go together' using errcode = '22023';
  end if;

  if p_photo_base64 is not null then
    begin
      v_photo := decode(p_photo_base64, 'base64');
    exception when others then
      raise exception 'the photo is not valid' using errcode = '22023';
    end;
  end if;

  -- The list is created with the first idea; two first ideas at the same time both find it.
  insert into public.wishlists (household_id, member_id)
  values (v_child.household_id, v_child.id)
  on conflict (member_id) do nothing;

  select w.id into v_wishlist_id
  from public.wishlists w
  where w.member_id = v_child.id
    and w.household_id = v_child.household_id;

  -- The limit of 50 is checked by the before insert trigger, under the lock of the list.
  insert into public.wishlist_items (
    household_id, wishlist_id, title, url, shop_name, price_cents, note, added_by_member_id
  )
  values (
    v_child.household_id, v_wishlist_id, p_title, p_url, p_shop_name, p_price_cents, p_note,
    (select private.current_member_id())
  )
  returning id into v_item_id;

  if v_photo is not null then
    insert into public.wishlist_item_photos (item_id, household_id, content_type, data)
    values (v_item_id, v_child.household_id, p_photo_content_type, v_photo);
  end if;

  return v_item_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC (write): «Salva le modifiche» of an idea (#32 §7): only the title (required, 1-80)
-- and the note (empty = none). Link, shop, price and photo never change: to change the link
-- the idea is deleted and added again. An idea already taken can be changed too.
-- ---------------------------------------------------------------------------
create or replace function public.update_wishlist_item(
  p_item_id uuid,
  p_title text,
  p_note text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_household_id uuid := (select public.current_household_id());
  v_rows integer;
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  if (select auth.uid()) is null or v_household_id is null then
    raise exception 'permission denied for the wish list' using errcode = '42501';
  end if;

  if p_item_id is null or p_title is null then
    raise exception 'idea and title are required' using errcode = '22004';
  end if;

  update public.wishlist_items i
  set title = p_title,
      note = p_note
  where i.id = p_item_id
    and i.household_id = v_household_id;

  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'permission denied for the wish list' using errcode = '42501';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC (write): «Elimina l'idea» (#32 §7). Deletes the idea for real, and with it (foreign
-- keys on delete cascade) its photo, its reservation with the name of the giver and the
-- «Regalo preso» notifications of that reservation.
-- ---------------------------------------------------------------------------
create or replace function public.delete_wishlist_item(p_item_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_household_id uuid := (select public.current_household_id());
  v_rows integer;
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  if (select auth.uid()) is null or v_household_id is null then
    raise exception 'permission denied for the wish list' using errcode = '42501';
  end if;

  if p_item_id is null then
    raise exception 'the idea is required' using errcode = '22004';
  end if;

  delete from public.wishlist_items i
  where i.id = p_item_id
    and i.household_id = v_household_id;

  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'permission denied for the wish list' using errcode = '42501';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC (write): «Condividi» (#32 §6). Returns the active link of the list of the child, or
-- creates one:
-- - occasion: the next birthday of the child from today (day of Rome of the database);
-- - expires_at: 00:00 of Rome of the second day after the occasion;
-- - code: 256 random bits by the column default.
-- An active link is returned as it is (also when the list has no ideas any more, or the
-- birth date was removed after it was created). To create a new link the child needs a
-- birth date (FN006) and the list at least one idea (FN007). An open link already expired
-- is closed (disabled_at = now()) before the new one is created: at most one open link per
-- list (unique index), so at most one active link, also when adults of the household press
-- «Condividi» together (lock per child).
-- Returns one row: code, occasion_date, expires_at.
-- ---------------------------------------------------------------------------
create or replace function public.share_wishlist(p_member_id uuid)
returns table (
  code text,
  occasion_date date,
  expires_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_child public.household_members;
  v_wishlist_id uuid;
  v_open public.wishlist_share_links;
  v_occasion date;
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  v_child := private.wishlist_caller_child(p_member_id);

  perform pg_advisory_xact_lock(hashtextextended('public.wishlist_share_links:' || v_child.id::text, 0));

  select w.id into v_wishlist_id
  from public.wishlists w
  where w.member_id = v_child.id
    and w.household_id = v_child.household_id;

  if v_wishlist_id is not null then
    select l.* into v_open
    from public.wishlist_share_links l
    where l.wishlist_id = v_wishlist_id
      and l.disabled_at is null
    for update;

    if v_open.id is not null and v_open.expires_at > now() then
      return query select v_open.code, v_open.occasion_date, v_open.expires_at;
      return;
    end if;
  end if;

  if v_child.birth_date is null then
    raise exception 'birth date required' using errcode = 'FN006';
  end if;

  if v_wishlist_id is null or not exists (
    select 1 from public.wishlist_items i where i.wishlist_id = v_wishlist_id
  ) then
    raise exception 'wishlist has no items' using errcode = 'FN007';
  end if;

  if v_open.id is not null then
    update public.wishlist_share_links l
    set disabled_at = now()
    where l.id = v_open.id;
  end if;

  v_occasion := private.wishlist_next_birthday(v_child.birth_date, (now() at time zone 'Europe/Rome')::date);

  insert into public.wishlist_share_links as l (household_id, wishlist_id, occasion_date, expires_at)
  values (v_child.household_id, v_wishlist_id, v_occasion, private.wishlist_link_expires_at(v_occasion))
  returning l.* into v_open;

  return query select v_open.code, v_open.occasion_date, v_open.expires_at;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC (write): «Disattiva il link» (#32 §6). Closes the open link of the list of the child
-- (disabled_at = now()): the public page shows only «Questa lista non è più attiva». A
-- closed link never works again; «Condividi» then creates a new link with a new code.
-- The ideas already taken stay taken. Without an open link nothing changes (no error).
-- ---------------------------------------------------------------------------
create or replace function public.disable_wishlist_share_link(p_member_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_child public.household_members;
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  v_child := private.wishlist_caller_child(p_member_id);

  perform pg_advisory_xact_lock(hashtextextended('public.wishlist_share_links:' || v_child.id::text, 0));

  update public.wishlist_share_links l
  set disabled_at = now()
  where l.household_id = v_child.household_id
    and l.disabled_at is null
    and l.wishlist_id in (
      select w.id
      from public.wishlists w
      where w.member_id = v_child.id
        and w.household_id = v_child.household_id
    );
end;
$$;

-- ---------------------------------------------------------------------------
-- Cleanup 30 days after an occasion (#32 §11, question 11, CA-50), for the day p_today of
-- Rome. For every link whose occasion is more than 30 days before p_today (occasion X: kept
-- on X+30, deleted from X+31), active or not:
-- - the ideas taken with that link (the gift was made), with their photos;
-- - the link, and with it (on delete cascade) every reservation made with it, with the name
--   of the giver and its «Regalo preso» notifications.
-- The ideas not taken stay, for the next birthday. p_household_id: only that household;
-- null = every household, used only by the pg_cron job (lesson of #237).
-- Returns how many links it deleted.
-- ---------------------------------------------------------------------------
create or replace function private.purge_past_wishlist_occasions(p_today date, p_household_id uuid)
returns integer
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_links uuid[];
  v_deleted integer;
begin
  select coalesce(array_agg(l.id), '{}'::uuid[]) into v_links
  from public.wishlist_share_links l
  where l.occasion_date < p_today - 30
    and (p_household_id is null or l.household_id = p_household_id);

  if cardinality(v_links) = 0 then
    return 0;
  end if;

  delete from public.wishlist_items i
  where i.id in (
    select r.item_id
    from public.wishlist_reservations r
    where r.share_link_id = any (v_links)
  );

  delete from public.wishlist_share_links l
  where l.id = any (v_links);

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

-- Run every day by pg_cron (schedule_wishlist_cleanup migration), for every household, with
-- the day of Rome of the moment it runs.
create or replace function private.run_scheduled_wishlist_cleanup()
returns integer
language sql
volatile
set search_path = ''
as $$
  select private.purge_past_wishlist_occasions((now() at time zone 'Europe/Rome')::date, null);
$$;

-- ---------------------------------------------------------------------------
-- RPC for the tests of page #32 (CA-50): runs the cleanup for ONE household (required,
-- 22023 without it: lesson of #237) as if it ran on the day p_today of Rome (default:
-- today). Returns how many links it deleted. Executable only by service_role (administrative
-- key) and the database owner, never by authenticated or anon (grants). Security definer:
-- the cleanup deletes rows the caller of the Data API could not. Only POST.
-- ---------------------------------------------------------------------------
create or replace function public.run_wishlist_cleanup(p_household_id uuid, p_today date default null)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;
  if p_household_id is null then
    raise exception 'the household is required' using errcode = '22023';
  end if;

  return private.purge_past_wishlist_occasions(
    coalesce(p_today, (now() at time zone 'Europe/Rome')::date),
    p_household_id
  );
end;
$$;
