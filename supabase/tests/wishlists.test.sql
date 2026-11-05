-- Wish list (issue #259, for page #32 «Lista desideri»): schema and privileges, seed, only
-- children, reading by every adult with an account of the household, isolation from another
-- household (B) in reading and writing, a signed-in user without household (C), anon, no
-- direct write by the app, the page functions (add, change, delete an idea, «Condividi»,
-- «Disattiva il link»), only POST, normalisation, limit of 50 ideas, photos, the rules of the
-- link (code, occasion, expiry, one active link), «I tuoi dati» (who added an idea), no other
-- function reading these tables.
-- The public page (#33) is in public_wishlist.test.sql; the cleanup, the cascades and the
-- «Regalo preso» notification in wishlist_cleanup.test.sql.
-- Seed ids: A = Marco (Casa D'Angelo, admin), B = Giulia (Casa Bianchi, admin), B2 = Paolo
-- (Casa Bianchi, not admin), C = Chiara (no household). Members: Casa D'Angelo Marco a1…01,
-- Laura a1…02 (adult without account), Sofia a1…03 (child, born 14/12/2016), Tommaso a1…04
-- (child), Biscotto a1…05 (pet); Casa Bianchi Giulia b1…01, Paolo b1…02, Leo b1…03 (child).
-- Seed list of Sofia d1…01 with six ideas d2…01 … d2…06 (Casco d2…01 taken by «Nonna Anna»,
-- Puzzle d2…02 taken by «Zia Carla»), one disabled link d3…01.
begin;
create extension if not exists pgtap with schema extensions;

select plan(145);

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------
select has_table('public', 'wishlists', 'wishlists exists');
select has_table('public', 'wishlist_items', 'wishlist_items exists');
select has_table('public', 'wishlist_item_photos', 'wishlist_item_photos exists');
select has_table('public', 'wishlist_share_links', 'wishlist_share_links exists');
select has_table('public', 'wishlist_reservations', 'wishlist_reservations exists');
select ok(
  (select bool_and(c.relrowsecurity)
   from pg_class c
   where c.oid in ('public.wishlists'::regclass, 'public.wishlist_items'::regclass,
                   'public.wishlist_item_photos'::regclass, 'public.wishlist_share_links'::regclass,
                   'public.wishlist_reservations'::regclass)),
  'RLS enabled on the five tables'
);
select columns_are(
  'public', 'wishlists',
  array['id', 'household_id', 'member_id', 'member_kind', 'created_at'],
  'wishlists has exactly the planned columns (no date: the occasion is on the link)'
);
select columns_are(
  'public', 'wishlist_items',
  array['id', 'household_id', 'wishlist_id', 'title', 'url', 'shop_name', 'price_cents', 'note',
        'added_by_member_id', 'created_at', 'updated_at'],
  'wishlist_items has exactly the planned columns'
);
select columns_are(
  'public', 'wishlist_item_photos',
  array['item_id', 'household_id', 'content_type', 'data', 'created_at'],
  'wishlist_item_photos has exactly the planned columns (the copy, never the address on the shop)'
);
select columns_are(
  'public', 'wishlist_share_links',
  array['id', 'household_id', 'wishlist_id', 'code', 'occasion_date', 'expires_at', 'disabled_at',
        'created_at', 'updated_at'],
  'wishlist_share_links has exactly the planned columns'
);
select columns_are(
  'public', 'wishlist_reservations',
  array['id', 'household_id', 'item_id', 'share_link_id', 'giver_name', 'giver_key_hash', 'created_at'],
  'wishlist_reservations has exactly the planned columns (only a name and a fingerprint of the giver)'
);
select is_empty(
  $$ select c.table_name || '.' || c.column_name
     from information_schema.columns c
     where c.table_schema = 'public'
       and c.table_name like 'wishlist%'
       and c.column_name ~* '(size|taglia|school|scuol|birth|nascita|age|eta|address|indirizz|email|mail|phone|telefon|ip|surname|cognome|health|medic|allerg|giver_key$)' $$,
  'no column about sizes, school, birth, age, addresses, contacts, IP, health, or the browser key itself'
);
select fk_ok(
  'public', 'wishlists', array['member_id', 'household_id', 'member_kind'],
  'public', 'household_members', array['id', 'household_id', 'kind'],
  'a list belongs to a child of the same household'
);
select fk_ok(
  'public', 'wishlist_items', array['wishlist_id', 'household_id'],
  'public', 'wishlists', array['id', 'household_id'],
  'an idea belongs to a list of the same household'
);
select fk_ok(
  'public', 'wishlist_items', array['added_by_member_id', 'household_id'],
  'public', 'household_members', array['id', 'household_id'],
  'the author of an idea is a member of the same household'
);
select fk_ok(
  'public', 'wishlist_item_photos', array['item_id', 'household_id'],
  'public', 'wishlist_items', array['id', 'household_id'],
  'a photo belongs to an idea of the same household'
);
select fk_ok(
  'public', 'wishlist_share_links', array['wishlist_id', 'household_id'],
  'public', 'wishlists', array['id', 'household_id'],
  'a link belongs to a list of the same household'
);
select fk_ok(
  'public', 'wishlist_reservations', array['item_id', 'household_id'],
  'public', 'wishlist_items', array['id', 'household_id'],
  'a reservation belongs to an idea of the same household'
);
select fk_ok(
  'public', 'wishlist_reservations', array['share_link_id', 'household_id'],
  'public', 'wishlist_share_links', array['id', 'household_id'],
  'a reservation was made with a link of the same household'
);
select is(
  (select array_agg(k.conname || ':' || k.confdeltype::text order by k.conname)
   from pg_constraint k
   where k.conrelid in ('public.wishlists'::regclass, 'public.wishlist_items'::regclass,
                        'public.wishlist_item_photos'::regclass, 'public.wishlist_share_links'::regclass,
                        'public.wishlist_reservations'::regclass)
     and k.contype = 'f'),
  array[
    'wishlist_item_photos_household_id_fkey:c', 'wishlist_item_photos_item_fkey:c',
    'wishlist_items_added_by_fkey:n', 'wishlist_items_household_id_fkey:c', 'wishlist_items_wishlist_fkey:c',
    'wishlist_reservations_household_id_fkey:c', 'wishlist_reservations_item_fkey:c',
    'wishlist_reservations_share_link_fkey:c',
    'wishlist_share_links_household_id_fkey:c', 'wishlist_share_links_wishlist_fkey:c',
    'wishlists_household_id_fkey:c', 'wishlists_member_fkey:c'
  ],
  'every foreign key is on delete cascade, except the author of an idea (set null)'
);
select col_is_unique('public', 'wishlists', array['member_id'], 'one list per child');
select col_is_unique('public', 'wishlist_reservations', array['item_id'], 'one reservation per idea');
select col_is_unique('public', 'wishlist_share_links', array['code'], 'codes are unique');
select ok(
  (select i.indisunique and pg_get_expr(i.indpred, i.indrelid) = '(disabled_at IS NULL)'
   from pg_index i
   where i.indexrelid = 'public.wishlist_share_links_one_open_per_list_idx'::regclass),
  'at most one open link per list (unique partial index)'
);
select has_index('public', 'wishlists', 'wishlists_household_id_idx', 'index on wishlists.household_id');
select has_index('public', 'wishlist_items', 'wishlist_items_household_id_idx', 'index on wishlist_items.household_id');
select has_index('public', 'wishlist_items', 'wishlist_items_wishlist_created_idx', 'index on the ideas of a list');
select has_index('public', 'wishlist_items', 'wishlist_items_added_by_member_id_idx', 'index on the author of an idea');
select has_index('public', 'wishlist_item_photos', 'wishlist_item_photos_household_id_idx', 'index on wishlist_item_photos.household_id');
select has_index('public', 'wishlist_share_links', 'wishlist_share_links_household_id_idx', 'index on wishlist_share_links.household_id');
select has_index('public', 'wishlist_share_links', 'wishlist_share_links_wishlist_created_idx', 'index on the links of a list');
select has_index('public', 'wishlist_share_links', 'wishlist_share_links_occasion_date_idx', 'index for the cleanup');
select has_index('public', 'wishlist_reservations', 'wishlist_reservations_household_id_idx', 'index on wishlist_reservations.household_id');
select has_index('public', 'wishlist_reservations', 'wishlist_reservations_share_link_id_idx', 'index on the link of a reservation');
select ok(
  not exists (
    select 1 from pg_publication_tables p
    where p.schemaname = 'public' and p.tablename like 'wishlist%'
  ),
  'the wish list is not sent in real time'
);
select ok(
  (select bool_and(p.prosecdef and p.proconfig @> array['search_path=""'])
   from pg_proc p
   where p.oid in (
     'public.add_wishlist_item(uuid, text, text, text, integer, text, text, text)'::regprocedure,
     'public.update_wishlist_item(uuid, text, text)'::regprocedure,
     'public.delete_wishlist_item(uuid)'::regprocedure,
     'public.share_wishlist(uuid)'::regprocedure,
     'public.disable_wishlist_share_link(uuid)'::regprocedure
   )),
  'the page functions are security definer with an empty search_path'
);
select ok(
  (select p.prosrc ~ 'pg_advisory_xact_lock' from pg_proc p where p.oid = 'private.wishlist_items_before_write()'::regprocedure)
  and (select p.prosrc ~ 'pg_advisory_xact_lock' from pg_proc p where p.oid = 'public.share_wishlist(uuid)'::regprocedure),
  'the limit of 50 ideas and the single active link are serialised with advisory locks (LEZIONI #192)'
);
-- #32 Dati punto 9: invitation_preview and every other function never read the wish list.
select is_empty(
  $$ select n.nspname || '.' || p.proname
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public', 'private')
       and p.prosrc ~ 'wishlist'
       and p.proname !~ 'wishlist'
       and (n.nspname, p.proname) not in (
         ('private', 'notification_is_visible'), ('private', 'purge_past_wishlist_occasions')
       ) $$,
  'no other function (invitation_preview, search, calendar included) reads the wish list'
);

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
select ok(
  not exists (
    select 1
    from unnest(array['public.wishlists', 'public.wishlist_items', 'public.wishlist_item_photos',
                      'public.wishlist_share_links', 'public.wishlist_reservations']) as t (name)
    where has_table_privilege('anon', t.name, 'select, insert, update, delete, truncate, references, trigger')
       or has_any_column_privilege('anon', t.name, 'select, insert, update, references')
  ),
  'anon has no privilege on any table of the wish list'
);
select ok(
  not exists (
    select 1
    from unnest(array['public.wishlists', 'public.wishlist_items', 'public.wishlist_item_photos',
                      'public.wishlist_share_links', 'public.wishlist_reservations']) as t (name)
    where has_table_privilege('authenticated', t.name, 'insert, update, delete, truncate')
       or has_any_column_privilege('authenticated', t.name, 'insert, update')
  ),
  'the app never writes the wish list directly (no insert, update or delete privilege)'
);
select ok(
  has_table_privilege('authenticated', 'public.wishlists', 'select')
  and has_table_privilege('authenticated', 'public.wishlist_items', 'select')
  and has_table_privilege('authenticated', 'public.wishlist_item_photos', 'select')
  and has_table_privilege('authenticated', 'public.wishlist_share_links', 'select')
  and has_column_privilege('authenticated', 'public.wishlist_reservations', 'giver_name', 'select'),
  'the app reads the wish list'
);
select ok(
  not has_column_privilege('authenticated', 'public.wishlist_reservations', 'giver_key_hash', 'select'),
  'the app never reads the fingerprint of the browser key of a giver'
);
select policies_are('public', 'wishlists', array['wishlists_select'], 'wishlists: only a select policy');
select policies_are('public', 'wishlist_items', array['wishlist_items_select'], 'wishlist_items: only a select policy');
select policies_are('public', 'wishlist_item_photos', array['wishlist_item_photos_select'], 'wishlist_item_photos: only a select policy');
select policies_are('public', 'wishlist_share_links', array['wishlist_share_links_select'], 'wishlist_share_links: only a select policy');
select policies_are('public', 'wishlist_reservations', array['wishlist_reservations_select'], 'wishlist_reservations: only a select policy');
select ok(
  not has_function_privilege('anon', 'public.add_wishlist_item(uuid, text, text, text, integer, text, text, text)', 'execute')
  and not has_function_privilege('anon', 'public.update_wishlist_item(uuid, text, text)', 'execute')
  and not has_function_privilege('anon', 'public.delete_wishlist_item(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.share_wishlist(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.disable_wishlist_share_link(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.add_wishlist_item(uuid, text, text, text, integer, text, text, text)', 'execute')
  and has_function_privilege('authenticated', 'public.update_wishlist_item(uuid, text, text)', 'execute')
  and has_function_privilege('authenticated', 'public.delete_wishlist_item(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.share_wishlist(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.disable_wishlist_share_link(uuid)', 'execute'),
  'only signed-in users run the page functions'
);
select ok(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname ~ 'wishlist'
      and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute'))
  ),
  'internal functions of the wish list cannot be called by the app'
);

-- ---------------------------------------------------------------------------
-- Seed, and only children (as database owner)
-- ---------------------------------------------------------------------------
select results_eq(
  $$ select i.title, i.shop_name, i.price_cents, i.note, r.giver_name
     from public.wishlist_items i
     left join public.wishlist_reservations r on r.item_id = i.id
     order by i.created_at desc $$,
  $$ values ('Diario segreto con lucchetto', 'Feltrinelli', 1800, 'Lo vuole tanto', null::text),
            ('Set di acquerelli con pennelli', 'Amazon', 2400, null, null),
            ('Cuffie senza fili per bambini', 'MediaWorld', 3900, null, null),
            ('Biglietti per il musical', null, 6000, 'Un''esperienza da fare con la nonna', null),
            ('Puzzle da 1000 pezzi', null, 2200, null, 'Zia Carla'),
            ('Casco per la bici', null, 3500, null, 'Nonna Anna') $$,
  'seed: the six ideas of the mockup for Sofia, two taken'
);
select is(
  (select count(*)::integer from public.wishlist_share_links l where l.disabled_at is null),
  0,
  'seed: no open link (no working code in the repository)'
);
select is(
  (select count(*)::integer from public.notifications n where n.kind = 'gift_taken'),
  0,
  'seed: no «Regalo preso» notification'
);
select throws_ok(
  $$ insert into public.wishlists (household_id, member_id)
     values ('11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000002') $$,
  '23503', null,
  'an adult (Laura) cannot have a wish list'
);
select throws_ok(
  $$ insert into public.wishlists (household_id, member_id)
     values ('11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000005') $$,
  '23503', null,
  'a pet (Biscotto) cannot have a wish list'
);
select throws_ok(
  $$ insert into public.wishlists (household_id, member_id)
     values ('22222222-2222-4222-8222-222222222222', 'a1000000-0000-4000-8000-000000000004') $$,
  '23503', null,
  'a list cannot point to a child of another household'
);
select throws_ok(
  $$ insert into public.wishlist_items (household_id, wishlist_id, title)
     values ('22222222-2222-4222-8222-222222222222', 'd1000000-0000-4000-8000-000000000001', 'Trottola') $$,
  '23503', null,
  'an idea cannot be put in the list of another household'
);
select throws_ok(
  $$ insert into public.wishlist_items (household_id, wishlist_id, title, url)
     values ('11111111-1111-4111-8111-111111111111', 'd1000000-0000-4000-8000-000000000001', 'Trottola',
             'javascript:alert(1)') $$,
  '23514', null,
  'a link is only http or https (never javascript:)'
);
select throws_ok(
  $$ insert into public.wishlist_items (household_id, wishlist_id, title, url)
     values ('11111111-1111-4111-8111-111111111111', 'd1000000-0000-4000-8000-000000000001', 'Trottola',
             'https://') $$,
  '23514', null,
  'a link needs a host'
);
select throws_ok(
  $$ insert into public.wishlist_item_photos (item_id, household_id, content_type, data)
     values ('d2000000-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111', 'image/png',
             '\x89504e470d0a1a0a0000000d'::bytea) $$,
  '23514', null,
  'a photo is only WebP or JPEG'
);
select throws_ok(
  $$ insert into public.wishlist_item_photos (item_id, household_id, content_type, data)
     values ('d2000000-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111', 'image/jpeg',
             '\x3c7376673e3c2f7376673e3c'::bytea) $$,
  '23514', null,
  'a photo must start with the bytes of its format (no SVG passed as JPEG)'
);
select throws_ok(
  $$ insert into public.wishlist_item_photos (item_id, household_id, content_type, data)
     values ('d2000000-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111', 'image/jpeg',
             '\xffd8ff'::bytea || extensions.gen_random_bytes(1024) || convert_to(repeat('x', 102400), 'UTF8')) $$,
  '23514', null,
  'a photo is at most 100 KB'
);
select throws_ok(
  $$ insert into public.wishlist_share_links (household_id, wishlist_id, occasion_date, expires_at)
     values ('11111111-1111-4111-8111-111111111111', 'd1000000-0000-4000-8000-000000000001', current_date, now() + interval '1 day'),
            ('11111111-1111-4111-8111-111111111111', 'd1000000-0000-4000-8000-000000000001', current_date, now() + interval '1 day') $$,
  '23505', null,
  'two open links for the same list are refused'
);
select throws_ok(
  $$ insert into public.wishlist_reservations (household_id, item_id, share_link_id, giver_name)
     values ('22222222-2222-4222-8222-222222222222', 'd2000000-0000-4000-8000-000000000006',
             'd3000000-0000-4000-8000-000000000001', 'Zio Luca') $$,
  '23503', null,
  'a reservation cannot point to an idea of another household'
);

-- ---------------------------------------------------------------------------
-- Marco (A) reads the list of his household
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
set local request.method to 'POST';

select is((select count(*)::integer from public.wishlists), 1, 'A reads the list of Sofia');
select is((select count(*)::integer from public.wishlist_items), 6, 'A reads the six ideas');
select is((select count(*)::integer from public.wishlist_share_links), 1, 'A reads the links of the list');
select results_eq(
  $$ select r.giver_name from public.wishlist_reservations r order by r.created_at desc $$,
  $$ values ('Nonna Anna'), ('Zia Carla') $$,
  'A reads who took what (names of the givers)'
);
select throws_ok(
  $$ select r.giver_key_hash from public.wishlist_reservations r $$,
  '42501', null,
  'A cannot read the fingerprints of the browser keys'
);
select throws_ok(
  $$ insert into public.wishlist_items (household_id, wishlist_id, title)
     values ('11111111-1111-4111-8111-111111111111', 'd1000000-0000-4000-8000-000000000001', 'Trottola') $$,
  '42501', null,
  'A cannot insert an idea directly'
);
select throws_ok(
  $$ update public.wishlist_items set title = 'Altro' where id = 'd2000000-0000-4000-8000-000000000006' $$,
  '42501', null,
  'A cannot change an idea directly'
);
select throws_ok(
  $$ delete from public.wishlist_reservations where item_id = 'd2000000-0000-4000-8000-000000000001' $$,
  '42501', null,
  'A cannot delete a reservation directly'
);
select throws_ok(
  $$ update public.wishlist_share_links set disabled_at = null where id = 'd3000000-0000-4000-8000-000000000001' $$,
  '42501', null,
  'A cannot open again a disabled link directly'
);

-- Only POST through the Data API.
set local request.method to 'GET';
select throws_ok(
  $$ select public.add_wishlist_item('a1000000-0000-4000-8000-000000000003', 'Trottola') $$,
  'P0001', 'use POST',
  'add_wishlist_item refuses GET'
);
set local request.method to 'HEAD';
select throws_ok(
  $$ select * from public.share_wishlist('a1000000-0000-4000-8000-000000000003') $$,
  'P0001', 'use POST',
  'share_wishlist refuses HEAD'
);
set local request.method to 'PUT';
select throws_ok(
  $$ select public.delete_wishlist_item('d2000000-0000-4000-8000-000000000006') $$,
  'P0001', 'use POST',
  'delete_wishlist_item refuses PUT'
);
set local request.method to 'POST';

-- Adding: the list of Tommaso is created with his first idea; texts normalised.
select lives_ok(
  $$ select set_config('test.item_t1', public.add_wishlist_item(
       p_member_id => 'a1000000-0000-4000-8000-000000000004', p_title => '  Monopattino   rosso ',
       p_url => ' https://negozio.example/monopattino ', p_shop_name => ' Decathlon ',
       p_price_cents => 4999, p_note => '  quello   con le luci '
     )::text, true) $$,
  'A adds the first idea of Tommaso'
);
select results_eq(
  $$ select i.title, i.url, i.shop_name, i.price_cents, i.note, i.household_id,
            i.added_by_member_id, w.member_id
     from public.wishlist_items i join public.wishlists w on w.id = i.wishlist_id
     where i.id = current_setting('test.item_t1')::uuid $$,
  $$ values ('Monopattino rosso', 'https://negozio.example/monopattino', 'Decathlon', 4999, 'quello con le luci',
             '11111111-1111-4111-8111-111111111111'::uuid, 'a1000000-0000-4000-8000-000000000001'::uuid,
             'a1000000-0000-4000-8000-000000000004'::uuid) $$,
  'the idea is normalised, in the household of A, added by Marco («I tuoi dati»), in a new list of Tommaso'
);
select lives_ok(
  $$ select public.add_wishlist_item('a1000000-0000-4000-8000-000000000004', 'Corso di pattinaggio', null, null, null, '   ') $$,
  'A adds a written idea with an empty note'
);
select results_eq(
  $$ select i.url, i.shop_name, i.price_cents, i.note from public.wishlist_items i where i.title = 'Corso di pattinaggio' $$,
  $$ values (null::text, null::text, null::integer, null::text) $$,
  'a written idea has no link, shop, price or note (an empty note is none)'
);
select is(
  (select count(*)::integer from public.wishlists w where w.member_id = 'a1000000-0000-4000-8000-000000000004'),
  1,
  'Tommaso has still one list'
);
-- A photo goes with its idea.
select lives_ok(
  $$ select set_config('test.item_photo', public.add_wishlist_item(
       p_member_id => 'a1000000-0000-4000-8000-000000000004', p_title => 'Zaino',
       p_photo_base64 => encode('\xffd8ffe000104a464946000101'::bytea, 'base64'), p_photo_content_type => 'image/jpeg'
     )::text, true) $$,
  'A adds an idea with a photo'
);
select results_eq(
  $$ select p.content_type, p.data, p.household_id from public.wishlist_item_photos p
     where p.item_id = current_setting('test.item_photo')::uuid $$,
  $$ values ('image/jpeg', '\xffd8ffe000104a464946000101'::bytea, '11111111-1111-4111-8111-111111111111'::uuid) $$,
  'the photo is stored with the idea, in the household of A'
);
select throws_ok(
  $$ select public.add_wishlist_item(p_member_id => 'a1000000-0000-4000-8000-000000000004', p_title => 'Zaino',
       p_photo_base64 => '***', p_photo_content_type => 'image/jpeg') $$,
  '22023', null,
  'a photo that is not base64 is refused'
);
select throws_ok(
  $$ select public.add_wishlist_item(p_member_id => 'a1000000-0000-4000-8000-000000000004', p_title => 'Zaino',
       p_photo_base64 => encode('\xffd8ffe000104a464946000101'::bytea, 'base64')) $$,
  '22023', null,
  'a photo without content type is refused'
);
select throws_ok(
  $$ select public.add_wishlist_item(p_member_id => 'a1000000-0000-4000-8000-000000000004', p_title => 'Zaino',
       p_photo_base64 => encode('<svg onload=alert(1)>'::bytea, 'base64'), p_photo_content_type => 'image/jpeg') $$,
  '23514', null,
  'a photo that is not a JPEG is refused, and nothing is saved'
);
select is(
  (select count(*)::integer from public.wishlist_items i where i.title = 'Zaino'),
  1,
  'refused additions saved nothing'
);
select throws_ok(
  $$ select public.add_wishlist_item('a1000000-0000-4000-8000-000000000004', '   ') $$,
  '23514', null,
  'an empty title is refused'
);
select throws_ok(
  $$ select public.add_wishlist_item('a1000000-0000-4000-8000-000000000004', repeat('a', 81)) $$,
  '23514', null,
  'a title longer than 80 characters is refused'
);
select throws_ok(
  $$ select public.add_wishlist_item('a1000000-0000-4000-8000-000000000004', 'Trottola', 'ftp://negozio.example/x') $$,
  '23514', null,
  'a link that is not http or https is refused'
);
select throws_ok(
  $$ select public.add_wishlist_item('a1000000-0000-4000-8000-000000000004', 'Trottola', null, null, 10000000) $$,
  '23514', null,
  'a price over 99.999,99 € is refused'
);
select throws_ok(
  $$ select public.add_wishlist_item('a1000000-0000-4000-8000-000000000004', 'Trottola', null, null, null, repeat('n', 81)) $$,
  '23514', null,
  'a note longer than 80 characters is refused'
);
select throws_ok(
  $$ select public.add_wishlist_item('a1000000-0000-4000-8000-000000000004', 'Trottola', null, repeat('s', 41)) $$,
  '23514', null,
  'a shop name longer than 40 characters is refused'
);
select throws_ok(
  $$ select public.add_wishlist_item('a1000000-0000-4000-8000-000000000002', 'Trottola') $$,
  '42501', null,
  'an adult (Laura) has no list: refused like a member of another household'
);
select throws_ok(
  $$ select public.add_wishlist_item('a1000000-0000-4000-8000-000000000005', 'Trottola') $$,
  '42501', null,
  'a pet (Biscotto) has no list'
);
select throws_ok(
  $$ select public.add_wishlist_item('a1000000-0000-4000-8000-000000000001', 'Trottola') $$,
  '42501', null,
  'Marco himself has no list'
);

-- Limit of 50 ideas per list (taken and not taken).
select lives_ok(
  $$ select public.add_wishlist_item('a1000000-0000-4000-8000-000000000003', 'Idea ' || g)
     from generate_series(1, 44) as g $$,
  'A fills the list of Sofia up to 50 ideas'
);
select is((select count(*)::integer from public.wishlist_items i where i.wishlist_id = 'd1000000-0000-4000-8000-000000000001'), 50, 'Sofia has 50 ideas');
select throws_ok(
  $$ select public.add_wishlist_item('a1000000-0000-4000-8000-000000000003', 'Corso di pattinaggio') $$,
  'FN005', 'wishlist item limit reached',
  'the 51st idea is refused (FN005)'
);
select is((select count(*)::integer from public.wishlist_items i where i.wishlist_id = 'd1000000-0000-4000-8000-000000000001'), 50, 'still 50 ideas');
reset role;
select throws_ok(
  $$ insert into public.wishlist_items (household_id, wishlist_id, title)
     values ('11111111-1111-4111-8111-111111111111', 'd1000000-0000-4000-8000-000000000001', 'Trottola') $$,
  'FN005', 'wishlist item limit reached',
  'the limit applies to every role (also the administrative key)'
);
delete from public.wishlist_items i where i.title ~ '^Idea [0-9]+$';
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
set local request.method to 'POST';

-- Changing an idea: only title and note.
select lives_ok(
  $$ select public.update_wishlist_item('d2000000-0000-4000-8000-000000000006', '  Diario  segreto ', ' quello   blu ') $$,
  'A changes title and note of the Diario'
);
select results_eq(
  $$ select i.title, i.note, i.shop_name, i.price_cents from public.wishlist_items i
     where i.id = 'd2000000-0000-4000-8000-000000000006' $$,
  $$ values ('Diario segreto', 'quello blu', 'Feltrinelli', 1800) $$,
  'title and note normalised, shop and price unchanged'
);
select lives_ok(
  $$ select public.update_wishlist_item('d2000000-0000-4000-8000-000000000006', 'Diario segreto con lucchetto', '') $$,
  'A removes the note'
);
select is(
  (select i.note from public.wishlist_items i where i.id = 'd2000000-0000-4000-8000-000000000006'),
  null,
  'an empty note is none'
);
select throws_ok(
  $$ select public.update_wishlist_item('d2000000-0000-4000-8000-000000000006', '  ') $$,
  '23514', null,
  'an empty title is refused'
);
select throws_ok(
  $$ select public.update_wishlist_item(gen_random_uuid(), 'Altro') $$,
  '42501', null,
  'an unknown idea is refused'
);

-- Sharing: the list of Tommaso (born 02/04/2020) has ideas.
select lives_ok(
  $$ select set_config('test.code_t', s.code, true) from public.share_wishlist('a1000000-0000-4000-8000-000000000004') s $$,
  'A shares the list of Tommaso'
);
select results_eq(
  $$ select l.code ~ '^[0-9a-f]{64}$', l.occasion_date, l.expires_at, l.disabled_at is null
     from public.wishlist_share_links l
     where l.code = current_setting('test.code_t') $$,
  $$ select true,
            private_day,
            ((private_day + 2)::timestamp at time zone 'Europe/Rome'),
            true
     from (select case
                    when make_date(extract(year from (now() at time zone 'Europe/Rome'))::integer, 4, 2)
                         >= (now() at time zone 'Europe/Rome')::date
                    then make_date(extract(year from (now() at time zone 'Europe/Rome'))::integer, 4, 2)
                    else make_date(extract(year from (now() at time zone 'Europe/Rome'))::integer + 1, 4, 2)
                  end as private_day) d $$,
  'the link has a code of 64 hex characters, the next birthday of Tommaso and expires at 00:00 of Rome two days after'
);
select ok(
  not exists (
    select 1
    from public.wishlists w
    where w.member_id = 'a1000000-0000-4000-8000-000000000004'
      and (current_setting('test.code_t') like '%' || replace(w.id::text, '-', '') || '%'
           or current_setting('test.code_t') like '%' || replace(w.member_id::text, '-', '') || '%'
           or current_setting('test.code_t') like '%' || replace(w.household_id::text, '-', '') || '%')
  ),
  'the code contains no id of the list, the child or the household'
);
select is(
  (select s.code from public.share_wishlist('a1000000-0000-4000-8000-000000000004') s),
  current_setting('test.code_t'),
  'sharing again returns the same active link'
);
select is(
  (select count(*)::integer from public.wishlist_share_links l
   join public.wishlists w on w.id = l.wishlist_id
   where w.member_id = 'a1000000-0000-4000-8000-000000000004' and l.disabled_at is null),
  1,
  'one active link for the list of Tommaso'
);
-- Disabling, then sharing again: a new code; the old one stays closed.
select lives_ok(
  $$ select public.disable_wishlist_share_link('a1000000-0000-4000-8000-000000000004') $$,
  'A disables the link of Tommaso'
);
select ok(
  (select l.disabled_at = now() from public.wishlist_share_links l where l.code = current_setting('test.code_t')),
  'the link is disabled now'
);
select lives_ok(
  $$ select public.disable_wishlist_share_link('a1000000-0000-4000-8000-000000000004') $$,
  'disabling without an open link changes nothing and gives no error'
);
select isnt(
  (select s.code from public.share_wishlist('a1000000-0000-4000-8000-000000000004') s),
  current_setting('test.code_t'),
  'sharing after disabling gives a new code'
);
select ok(
  (select l.disabled_at is not null from public.wishlist_share_links l where l.code = current_setting('test.code_t')),
  'the old link is still disabled (never reactivated)'
);
-- Expired: the old open link is closed and a new one is created.
reset role;
update public.wishlist_share_links l set expires_at = now() - interval '1 minute'
where l.disabled_at is null
  and l.wishlist_id = (select w.id from public.wishlists w where w.member_id = 'a1000000-0000-4000-8000-000000000004');
select set_config('test.code_expired', (
  select l.code from public.wishlist_share_links l
  where l.disabled_at is null
    and l.wishlist_id = (select w.id from public.wishlists w where w.member_id = 'a1000000-0000-4000-8000-000000000004')
), true);
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
set local request.method to 'POST';
select isnt(
  (select s.code from public.share_wishlist('a1000000-0000-4000-8000-000000000004') s),
  current_setting('test.code_expired'),
  'sharing after the expiry gives a new code'
);
select is(
  (select count(*)::integer from public.wishlist_share_links l
   join public.wishlists w on w.id = l.wishlist_id
   where w.member_id = 'a1000000-0000-4000-8000-000000000004' and l.disabled_at is null and l.expires_at > now()),
  1,
  'still one active link for the list of Tommaso'
);
-- Refusals: no birth date, no ideas.
reset role;
update public.household_members set birth_date = null where id = 'a1000000-0000-4000-8000-000000000003';
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
set local request.method to 'POST';
select throws_ok(
  $$ select * from public.share_wishlist('a1000000-0000-4000-8000-000000000003') $$,
  'FN006', 'birth date required',
  'a child without birth date cannot be shared (FN006)'
);
reset role;
update public.household_members set birth_date = '2016-12-14' where id = 'a1000000-0000-4000-8000-000000000003';
delete from public.wishlist_items i where i.wishlist_id = 'd1000000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
set local request.method to 'POST';
select throws_ok(
  $$ select * from public.share_wishlist('a1000000-0000-4000-8000-000000000003') $$,
  'FN007', 'wishlist has no items',
  'a list without ideas cannot be shared (FN007)'
);
select is(
  (select count(*)::integer from public.wishlist_share_links l where l.wishlist_id = 'd1000000-0000-4000-8000-000000000001' and l.disabled_at is null),
  0,
  'no link was created for Sofia'
);
-- Deleting an idea.
select lives_ok(
  $$ select public.delete_wishlist_item(current_setting('test.item_photo')::uuid) $$,
  'A deletes the idea with the photo'
);
select ok(
  not exists (select 1 from public.wishlist_items i where i.id = current_setting('test.item_photo')::uuid)
  and not exists (select 1 from public.wishlist_item_photos p where p.item_id = current_setting('test.item_photo')::uuid),
  'the idea and its photo are gone'
);
select throws_ok(
  $$ select public.delete_wishlist_item(current_setting('test.item_photo')::uuid) $$,
  '42501', null,
  'deleting it again is refused'
);

-- ---------------------------------------------------------------------------
-- Giulia (B, administrator of another household) sees and changes nothing of A
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';

select is((select count(*)::integer from public.wishlists), 0, 'B reads no list of A');
select is((select count(*)::integer from public.wishlist_items), 0, 'B reads no idea of A');
select is((select count(*)::integer from public.wishlist_item_photos), 0, 'B reads no photo of A');
select is((select count(*)::integer from public.wishlist_share_links), 0, 'B reads no link (and no code) of A');
select is((select count(*)::integer from public.wishlist_reservations), 0, 'B reads no reservation of A');
select throws_ok(
  $$ select public.add_wishlist_item('a1000000-0000-4000-8000-000000000004', 'Trottola') $$,
  '42501', null,
  'B cannot add an idea to Tommaso'
);
select throws_ok(
  $$ select public.update_wishlist_item(current_setting('test.item_t1')::uuid, 'Trottola') $$,
  '42501', null,
  'B cannot change an idea of A'
);
select throws_ok(
  $$ select public.delete_wishlist_item(current_setting('test.item_t1')::uuid) $$,
  '42501', null,
  'B cannot delete an idea of A'
);
select throws_ok(
  $$ select * from public.share_wishlist('a1000000-0000-4000-8000-000000000004') $$,
  '42501', null,
  'B cannot get or create the link of Tommaso'
);
select throws_ok(
  $$ select public.disable_wishlist_share_link('a1000000-0000-4000-8000-000000000004') $$,
  '42501', null,
  'B cannot disable the link of Tommaso'
);
select throws_ok(
  $$ delete from public.wishlist_items where id = current_setting('test.item_t1')::uuid $$,
  '42501', null,
  'B cannot delete an idea of A directly'
);
-- Paolo (B2, not administrator) works on the list of Leo, his own household.
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok(
  $$ select public.add_wishlist_item('b1000000-0000-4000-8000-000000000003', 'Trottola') $$,
  'B2 (not administrator) adds an idea to Leo'
);
select is(
  (select array_agg(i.title order by i.title) from public.wishlist_items i),
  array['Trottola'],
  'B2 reads only the list of his household'
);

-- C (no household) and anon.
set local request.jwt.claims to '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}';
select is(
  (select count(*)::integer from public.wishlists) + (select count(*)::integer from public.wishlist_items)
  + (select count(*)::integer from public.wishlist_share_links) + (select count(*)::integer from public.wishlist_reservations),
  0,
  'C (no household) reads nothing'
);
select throws_ok(
  $$ select public.add_wishlist_item('a1000000-0000-4000-8000-000000000004', 'Trottola') $$,
  '42501', null,
  'C cannot add an idea'
);
reset role;
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok($$ select count(*) from public.wishlists $$, '42501', null, 'anon cannot read wishlists');
select throws_ok($$ select count(*) from public.wishlist_items $$, '42501', null, 'anon cannot read wishlist_items');
select throws_ok($$ select count(*) from public.wishlist_share_links $$, '42501', null, 'anon cannot read the codes');
select throws_ok($$ select count(*) from public.wishlist_reservations $$, '42501', null, 'anon cannot read the reservations');
select throws_ok(
  $$ select public.add_wishlist_item('a1000000-0000-4000-8000-000000000004', 'Trottola') $$,
  '42501', null,
  'anon cannot run the page functions'
);
reset role;

-- As the owner: everything A did and nothing B did on A.
select results_eq(
  $$ select i.title from public.wishlist_items i
     join public.wishlists w on w.id = i.wishlist_id
     where w.member_id = 'a1000000-0000-4000-8000-000000000004' order by i.created_at, i.title $$,
  $$ values ('Corso di pattinaggio'), ('Monopattino rosso') $$,
  'the list of Tommaso has only what A did'
);

select * from finish();
rollback;
