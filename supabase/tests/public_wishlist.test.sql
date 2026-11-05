-- The public page of the wish list (issue #259, for page #33, decision D2):
-- get_public_wishlist(), get_public_wishlist_photo() and reserve_public_wishlist_item().
-- Only POST; the same answer for every code that does not work (malformed, unknown, upper
-- case, cut, disabled, expired); only the fields allowed by D2 (never who took what, the
-- year of birth, sizes, school, other members, other lists, ids of household, child or
-- list); «Lo regali tu» only for the same browser key; every outcome of «Lo regalo io»
-- (CA-30…34 of #33); the limit of 30 per hour; the «Regalo preso» notification for the
-- adults with an account of the household only; anon has no access to the tables.
-- Seed ids: as in wishlists.test.sql. Sofia a1…03 (salvia, born 14/12/2016) with the list
-- d1…01: free Diario d2…06 (Feltrinelli, 18 €, «Lo vuole tanto»), Acquerelli d2…05, Cuffie
-- d2…04, Biglietti d2…03; taken Casco d2…01 («Nonna Anna», 7 days ago) and Puzzle d2…02
-- («Zia Carla», 8 days ago); disabled link d3…01. Sofia has a school (Manzoni) and sizes.
-- Created here (as the owner, like the administrative key of the page tests): an active
-- link K of Sofia, a photo of the Diario, the list of Tommaso a1…04 with «Monopattino» and
-- an expired link, the list of Leo b1…03 (Casa Bianchi) with «Trottola» and an active link.
begin;
create extension if not exists pgtap with schema extensions;

select plan(66);

insert into public.wishlist_share_links (id, household_id, wishlist_id, occasion_date, expires_at)
select 'd3000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111',
       'd1000000-0000-4000-8000-000000000001', o.day, private.wishlist_link_expires_at(o.day)
from (select private.wishlist_next_birthday('2016-12-14', (now() at time zone 'Europe/Rome')::date) as day) o;
select set_config('test.k', (select l.code from public.wishlist_share_links l where l.id = 'd3000000-0000-4000-8000-000000000002'), true);
select set_config('test.k_disabled', (select l.code from public.wishlist_share_links l where l.id = 'd3000000-0000-4000-8000-000000000001'), true);

insert into public.wishlist_item_photos (item_id, household_id, content_type, data)
values ('d2000000-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111', 'image/jpeg',
        '\xffd8ffe000104a46494600010100'::bytea);

insert into public.wishlists (id, household_id, member_id)
values ('d1000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000004'),
       ('d1000000-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000003');
insert into public.wishlist_items (id, household_id, wishlist_id, title)
values ('d2000000-0000-4000-8000-000000000101', '11111111-1111-4111-8111-111111111111', 'd1000000-0000-4000-8000-000000000002', 'Monopattino'),
       ('d2000000-0000-4000-8000-000000000201', '22222222-2222-4222-8222-222222222222', 'd1000000-0000-4000-8000-000000000003', 'Trottola');
insert into public.wishlist_share_links (id, household_id, wishlist_id, occasion_date, expires_at, created_at)
values ('d3000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'd1000000-0000-4000-8000-000000000002',
        current_date - 3, now() - interval '1 minute', now() - interval '10 days'),
       ('d3000000-0000-4000-8000-000000000004', '22222222-2222-4222-8222-222222222222', 'd1000000-0000-4000-8000-000000000003',
        current_date + 30, now() + interval '32 days', now());
select set_config('test.k_expired', (select l.code from public.wishlist_share_links l where l.id = 'd3000000-0000-4000-8000-000000000003'), true);
select set_config('test.k_leo', (select l.code from public.wishlist_share_links l where l.id = 'd3000000-0000-4000-8000-000000000004'), true);

-- ---------------------------------------------------------------------------
-- Schema and privileges
-- ---------------------------------------------------------------------------
select is(
  (select array_agg(a.attname::text order by a.attnum)
   from pg_attribute a
   where a.attrelid = (select t.typrelid from pg_type t where t.oid = 'public.public_wishlist_item'::regtype)
     and a.attnum > 0 and not a.attisdropped),
  array['id', 'title', 'url', 'shop_name', 'note', 'price_cents', 'has_photo', 'state'],
  'an idea of the public page has only the fields allowed by D2 (no giver, no time, no other id)'
);
select results_eq(
  $$ select p.proname::text collate "default", p.prosecdef, array_to_string(p.proconfig, ',') collate "default",
            p.provolatile::text collate "default"
     from pg_proc p
     where p.oid in ('public.get_public_wishlist(text, text)'::regprocedure,
                     'public.get_public_wishlist_photo(text, uuid)'::regprocedure,
                     'public.reserve_public_wishlist_item(text, uuid, text, text)'::regprocedure)
     order by 1 $$,
  $$ values ('get_public_wishlist', true, 'search_path=""', 'v'),
            ('get_public_wishlist_photo', true, 'search_path=""', 'v'),
            ('reserve_public_wishlist_item', true, 'search_path=""', 'v') $$,
  'the three public functions are security definer, volatile (never GET through PostgREST), with an empty search_path'
);
select ok(
  has_function_privilege('anon', 'public.get_public_wishlist(text, text)', 'execute')
  and has_function_privilege('anon', 'public.get_public_wishlist_photo(text, uuid)', 'execute')
  and has_function_privilege('anon', 'public.reserve_public_wishlist_item(text, uuid, text, text)', 'execute')
  and has_function_privilege('authenticated', 'public.get_public_wishlist(text, text)', 'execute')
  and has_function_privilege('authenticated', 'public.reserve_public_wishlist_item(text, uuid, text, text)', 'execute'),
  'anon and signed-in users run the public functions'
);
select is_empty(
  $$ select p.proname from pg_proc p, aclexplode(p.proacl) a
     where p.oid in ('public.get_public_wishlist(text, text)'::regprocedure,
                     'public.get_public_wishlist_photo(text, uuid)'::regprocedure,
                     'public.reserve_public_wishlist_item(text, uuid, text, text)'::regprocedure)
       and a.grantee = 0 $$,
  'no execute privilege for PUBLIC on the public functions'
);

-- ---------------------------------------------------------------------------
-- The visitor (anon)
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';

-- CA-31: only POST.
set local request.method to 'GET';
select throws_ok($$ select * from public.get_public_wishlist(current_setting('test.k')) $$, 'P0001', 'use POST', 'reading with GET is refused');
set local request.method to 'HEAD';
select throws_ok($$ select * from public.get_public_wishlist(current_setting('test.k')) $$, 'P0001', 'use POST', 'reading with HEAD is refused');
set local request.method to 'PUT';
select throws_ok($$ select * from public.get_public_wishlist(current_setting('test.k')) $$, 'P0001', 'use POST', 'reading with PUT is refused');
set local request.method to 'GET';
select throws_ok(
  $$ select * from public.get_public_wishlist_photo(current_setting('test.k'), 'd2000000-0000-4000-8000-000000000006') $$,
  'P0001', 'use POST', 'the photo with GET is refused'
);
select throws_ok(
  $$ select public.reserve_public_wishlist_item(current_setting('test.k'), 'd2000000-0000-4000-8000-000000000006', 'Nonna Rosa',
       'abcdefghijklmnopqrstuvwxyzABCDEFGHIJ0123456789_-') $$,
  'P0001', 'use POST', 'taking with GET is refused'
);
set local request.method to 'POST';

-- CA-1, CA-2, CA-6: the list of K, only the allowed fields, in the order of the page.
select results_eq(
  $$ select w.status::text, w.child_name, w.child_color::text, w.occasion_month::integer, w.occasion_day::integer,
            cardinality(w.items)
     from public.get_public_wishlist(current_setting('test.k')) w $$,
  $$ values ('active', 'Sofia', 'salvia', 12, 14, 6) $$,
  'K: active, name and colour of Sofia, 14 December (no year), six ideas'
);
select results_eq(
  $$ select i.title, i.url, i.shop_name, i.note, i.price_cents, i.has_photo, i.state::text
     from public.get_public_wishlist(current_setting('test.k')) w, unnest(w.items) with ordinality as i
     order by i.ordinality $$,
  $$ values ('Diario segreto con lucchetto', null::text, 'Feltrinelli', 'Lo vuole tanto', 1800, true, 'free'),
            ('Set di acquerelli con pennelli', null, 'Amazon', null, 2400, false, 'free'),
            ('Cuffie senza fili per bambini', null, 'MediaWorld', null, 3900, false, 'free'),
            ('Biglietti per il musical', null, null, 'Un''esperienza da fare con la nonna', 6000, false, 'free'),
            ('Casco per la bici', null, null, null, 3500, false, 'taken'),
            ('Puzzle da 1000 pezzi', null, null, null, 2200, false, 'taken') $$,
  'free ideas first (most recent first), then the taken ones (most recently taken first)'
);
select ok(
  (select row_to_json(w)::text !~ '(Nonna Anna|Zia|Carla|Anna|Marco|Laura|Tommaso|Biscotto|Casa|D''Angelo|2016|Manzoni|Bianchi|Monopattino|Trottola|Leo|11111111-1111|a1000000-0000-4000-8000-000000000003|d1000000-0000-4000-8000-000000000001|d3000000)'
   from public.get_public_wishlist(current_setting('test.k')) w),
  'CA-5, CA-6: no giver, no other member, no household, no year of birth, no school, no other list, no id of household, child, list or link'
);
select is(
  (select array_agg(i.id::text order by i.id)
   from public.get_public_wishlist(current_setting('test.k')) w, unnest(w.items) i),
  array['d2000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000002', 'd2000000-0000-4000-8000-000000000003',
        'd2000000-0000-4000-8000-000000000004', 'd2000000-0000-4000-8000-000000000005', 'd2000000-0000-4000-8000-000000000006'],
  'the only ids returned are those of the ideas of the list'
);
-- CA-33: the code of another list gives only that list.
select results_eq(
  $$ select w.child_name, (select array_agg(i.title) from unnest(w.items) i)
     from public.get_public_wishlist(current_setting('test.k_leo')) w $$,
  $$ values ('Leo', array['Trottola']) $$,
  'the code of the list of Leo gives only Leo and «Trottola»'
);
-- CA-24 … CA-26: every code that does not work gives the same answer.
select results_eq(
  $$ select row_to_json(w)::text
     from (values ('abc'), (encode(extensions.gen_random_bytes(32), 'hex')), (upper(current_setting('test.k'))),
                  (left(current_setting('test.k'), 63)), (current_setting('test.k') || '0'),
                  (current_setting('test.k_disabled')), (current_setting('test.k_expired')), (''), (null)) as x (code),
          lateral public.get_public_wishlist(x.code) w $$,
  $$ select '{"status":"inactive","child_name":null,"child_color":null,"occasion_month":null,"occasion_day":null,"items":null}'
     from generate_series(1, 9) $$,
  'malformed, unknown, upper case, cut, longer, disabled, expired, empty and null codes: the same «inactive», nothing else'
);

-- The photo.
select results_eq(
  $$ select p.content_type, decode(p.data_base64, 'base64'), p.data_base64 !~ E'\n'
     from public.get_public_wishlist_photo(current_setting('test.k'), 'd2000000-0000-4000-8000-000000000006') p $$,
  $$ values ('image/jpeg', '\xffd8ffe000104a46494600010100'::bytea, true) $$,
  'the photo of the Diario through K (base64 without line breaks)'
);
select is_empty(
  $$ select 1 from public.get_public_wishlist_photo(current_setting('test.k_disabled'), 'd2000000-0000-4000-8000-000000000006') $$,
  'no photo through a disabled code'
);
select is_empty(
  $$ select 1 from public.get_public_wishlist_photo(current_setting('test.k_leo'), 'd2000000-0000-4000-8000-000000000006') $$,
  'no photo of another list'
);
select is_empty(
  $$ select 1 from public.get_public_wishlist_photo(current_setting('test.k'), 'd2000000-0000-4000-8000-000000000005') $$,
  'no row for an idea without photo'
);

-- CA-30: no direct access to the tables.
select throws_ok($$ select count(*) from public.wishlist_items $$, '42501', null, 'anon cannot read the ideas');
select throws_ok($$ select count(*) from public.wishlist_item_photos $$, '42501', null, 'anon cannot read the photos');
select throws_ok(
  $$ insert into public.wishlist_reservations (household_id, item_id, share_link_id, giver_name)
     values ('11111111-1111-4111-8111-111111111111', 'd2000000-0000-4000-8000-000000000006',
             'd3000000-0000-4000-8000-000000000002', 'Nonna Rosa') $$,
  '42501', null,
  'anon cannot insert a reservation directly'
);

-- «Lo regalo io»: every refusal, nothing saved.
select is(
  public.reserve_public_wishlist_item(current_setting('test.k'), 'd2000000-0000-4000-8000-000000000006', '   ',
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJ0123456789_-')::text,
  'invalid_name', 'CA-34: a name of only spaces is refused'
);
select is(
  public.reserve_public_wishlist_item(current_setting('test.k'), 'd2000000-0000-4000-8000-000000000006', repeat('a', 41),
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJ0123456789_-')::text,
  'invalid_name', 'CA-34: a name of 41 characters is refused'
);
select is(
  public.reserve_public_wishlist_item(current_setting('test.k'), 'd2000000-0000-4000-8000-000000000006', null,
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJ0123456789_-')::text,
  'invalid_name', 'a missing name is refused'
);
select is(
  public.reserve_public_wishlist_item(current_setting('test.k'), 'd2000000-0000-4000-8000-000000000006', 'Nonna Rosa', 'corta')::text,
  'invalid_key', 'a browser key shorter than 32 characters is refused'
);
select is(
  public.reserve_public_wishlist_item(current_setting('test.k'), 'd2000000-0000-4000-8000-000000000006', 'Nonna Rosa',
    repeat('k', 129))::text,
  'invalid_key', 'a browser key longer than 128 characters is refused'
);
select is(
  public.reserve_public_wishlist_item(current_setting('test.k_disabled'), 'd2000000-0000-4000-8000-000000000006', 'Nonna Rosa',
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJ0123456789_-')::text,
  'inactive', 'CA-18: a disabled code is refused as inactive'
);
select is(
  public.reserve_public_wishlist_item(current_setting('test.k_expired'), 'd2000000-0000-4000-8000-000000000101', 'Nonna Rosa',
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJ0123456789_-')::text,
  'inactive', 'an expired code is refused as inactive'
);
select is(
  public.reserve_public_wishlist_item('abc', 'd2000000-0000-4000-8000-000000000006', 'Nonna Rosa',
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJ0123456789_-')::text,
  'inactive', 'a malformed code is refused as inactive'
);
select is(
  public.reserve_public_wishlist_item(current_setting('test.k'), 'd2000000-0000-4000-8000-000000000101', 'Nonna Rosa',
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJ0123456789_-')::text,
  'not_found', 'CA-32: an idea of another list of the same household («Monopattino») is an idea that is not there'
);
select is(
  public.reserve_public_wishlist_item(current_setting('test.k'), 'd2000000-0000-4000-8000-000000000201', 'Nonna Rosa',
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJ0123456789_-')::text,
  'not_found', 'CA-32: an idea of another household («Trottola») is an idea that is not there'
);
select is(
  public.reserve_public_wishlist_item(current_setting('test.k'), gen_random_uuid(), 'Nonna Rosa',
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJ0123456789_-')::text,
  'not_found', 'an unknown idea is an idea that is not there'
);
select is(
  public.reserve_public_wishlist_item(current_setting('test.k'), 'd2000000-0000-4000-8000-000000000001', 'Nonna Rosa',
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJ0123456789_-')::text,
  'taken', 'CA-17: an idea already taken (Casco) gives «taken»'
);
reset role;
select is(
  (select count(*)::integer from public.wishlist_reservations),
  2,
  'the refusals saved nothing (only the two reservations of the seed)'
);
select is((select count(*)::integer from public.notifications), 0, 'the refusals wrote no notification');

-- CA-12: the visitor takes the Diario.
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
set local request.method to 'POST';
select is(
  public.reserve_public_wishlist_item(current_setting('test.k'), 'd2000000-0000-4000-8000-000000000006', '  Nonna   Rosa  ',
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJ0123456789_-')::text,
  'reserved', 'the visitor takes the Diario'
);
select is(
  public.reserve_public_wishlist_item(current_setting('test.k'), 'd2000000-0000-4000-8000-000000000006', 'Nonna Rosa',
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJ0123456789_-')::text,
  'taken', 'CA-20: a second tap gives «taken», never a second reservation'
);
-- CA-12, CA-13: «Lo regali tu» at its place for the same key; «Già preso» for the others.
select results_eq(
  $$ select i.title, i.state::text
     from public.get_public_wishlist(current_setting('test.k'), 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJ0123456789_-') w,
          unnest(w.items) with ordinality as i
     order by i.ordinality limit 3 $$,
  $$ values ('Diario segreto con lucchetto', 'mine'), ('Set di acquerelli con pennelli', 'free'),
            ('Cuffie senza fili per bambini', 'free') $$,
  'with the same browser key the Diario is «mine», at its place among the ideas not taken by others'
);
select results_eq(
  $$ select i.title, i.state::text
     from public.get_public_wishlist(current_setting('test.k'), repeat('Z', 40)) w,
          unnest(w.items) with ordinality as i
     order by i.ordinality $$,
  $$ values ('Set di acquerelli con pennelli', 'free'), ('Cuffie senza fili per bambini', 'free'),
            ('Biglietti per il musical', 'free'), ('Diario segreto con lucchetto', 'taken'),
            ('Casco per la bici', 'taken'), ('Puzzle da 1000 pezzi', 'taken') $$,
  'with another key the Diario is «taken», first among the taken ones'
);
select is(
  (select i.state::text from public.get_public_wishlist(current_setting('test.k')) w, unnest(w.items) i
   where i.title = 'Diario segreto con lucchetto'),
  'taken',
  'without a key the Diario is «taken»'
);
select ok(
  (select row_to_json(w)::text !~ 'Rosa'
   from public.get_public_wishlist(current_setting('test.k'), 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJ0123456789_-') w),
  'the name of the giver is never returned, not even to the giver'
);
-- The same key in another list gives another fingerprint (cannot be linked across lists).
select is(
  public.reserve_public_wishlist_item(current_setting('test.k_leo'), 'd2000000-0000-4000-8000-000000000201', 'Nonna Rosa',
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJ0123456789_-')::text,
  'reserved', 'the same browser takes «Trottola» in the list of Leo'
);
reset role;
select results_eq(
  $$ select r.giver_name, r.share_link_id, r.household_id,
            r.giver_key_hash = extensions.digest(convert_to('abcdefghijklmnopqrstuvwxyzABCDEFGHIJ0123456789_-:d1000000-0000-4000-8000-000000000001', 'UTF8'), 'sha256'),
            r.created_at = now()
     from public.wishlist_reservations r where r.item_id = 'd2000000-0000-4000-8000-000000000006' $$,
  $$ values ('Nonna Rosa', 'd3000000-0000-4000-8000-000000000002'::uuid, '11111111-1111-4111-8111-111111111111'::uuid, true, true) $$,
  'one reservation of the Diario: normalised name, link K, household of Sofia, fingerprint of key and list, now'
);
select isnt(
  (select r.giver_key_hash from public.wishlist_reservations r where r.item_id = 'd2000000-0000-4000-8000-000000000201'),
  (select r.giver_key_hash from public.wishlist_reservations r where r.item_id = 'd2000000-0000-4000-8000-000000000006'),
  'the same key gives different fingerprints in different lists'
);
select ok(
  not exists (
    select 1 from public.wishlist_reservations r
    where encode(r.giver_key_hash, 'escape') ~ 'abcdefghijklmnop'
       or r.giver_name ~ 'abcdefghijklmnop'
  ),
  'the browser key itself is never stored'
);
-- #32 §10, CA-46 … CA-48: «Regalo preso» for every adult with an account of the household.
select results_eq(
  $$ select n.household_id, n.recipient_member_id, n.kind::text, n.actor_member_id, n.wishlist_reservation_id
     from public.notifications n where n.household_id = '11111111-1111-4111-8111-111111111111' $$,
  $$ select '11111111-1111-4111-8111-111111111111'::uuid, 'a1000000-0000-4000-8000-000000000001'::uuid, 'gift_taken',
            null::uuid, r.id
     from public.wishlist_reservations r where r.item_id = 'd2000000-0000-4000-8000-000000000006' $$,
  'Casa D''Angelo: one notification for Marco (the only adult with an account), no actor, only the reservation'
);
select results_eq(
  $$ select n.recipient_member_id from public.notifications n
     where n.household_id = '22222222-2222-4222-8222-222222222222' order by 1 $$,
  $$ values ('b1000000-0000-4000-8000-000000000001'::uuid), ('b1000000-0000-4000-8000-000000000002'::uuid) $$,
  'Casa Bianchi: one notification for Giulia and one for Paolo (not for Anna, without account)'
);
select throws_ok(
  $$ insert into public.notifications (household_id, recipient_member_id, kind, wishlist_reservation_id)
     select '22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000001', 'gift_taken', r.id
     from public.wishlist_reservations r where r.item_id = 'd2000000-0000-4000-8000-000000000006' $$,
  '23503', null,
  'a notification cannot point to a reservation of another household'
);
select throws_ok(
  $$ insert into public.notifications (household_id, recipient_member_id, kind, actor_member_id, wishlist_reservation_id)
     select '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001', 'todo_assigned',
            'a1000000-0000-4000-8000-000000000002', r.id
     from public.wishlist_reservations r where r.item_id = 'd2000000-0000-4000-8000-000000000006' $$,
  '23514', null,
  'only gift_taken has a reservation'
);
select throws_ok(
  $$ insert into public.notifications (household_id, recipient_member_id, kind)
     values ('11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001', 'gift_taken') $$,
  '23514', null,
  'gift_taken always has its reservation'
);

-- A signed-in member of another household sees the same as anon: the session changes nothing.
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';
set local request.method to 'POST';
select results_eq(
  $$ select w.child_name, cardinality(w.items) from public.get_public_wishlist(current_setting('test.k')) w $$,
  $$ values ('Sofia', 6) $$,
  'CA-10: B with a session reads K like anybody else'
);
select is((select count(*)::integer from public.wishlist_items), 1, 'and still reads only the ideas of Casa Bianchi from the tables');
-- Marco (A) with a session: the public function ignores his household too.
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select results_eq(
  $$ select w.status::text, w.child_name from public.get_public_wishlist(current_setting('test.k_leo')) w $$,
  $$ values ('active', 'Leo') $$,
  'A reads the code of Leo as anybody else'
);
-- What the reader of Casa D'Angelo sees of the notifications.
select is(
  (select count(*)::integer from public.notifications n where n.kind = 'gift_taken'),
  1,
  'Marco sees his «Regalo preso» notification'
);
select is(public.count_unread_notifications(), 1, 'and it counts in the bell');
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
select is(
  (select count(*)::integer from public.notifications n where n.wishlist_reservation_id in (
     select r.id from public.wishlist_reservations r)),
  1,
  'Paolo sees only the notification of his household'
);
select is(
  (select count(*)::integer from public.wishlist_reservations r where r.giver_name = 'Nonna Rosa'),
  1,
  'Paolo sees only the reservation of his household'
);

-- CA-22: at most 30 ideas of one list taken in the last hour.
reset role;
insert into public.wishlist_items (household_id, wishlist_id, title)
select '11111111-1111-4111-8111-111111111111', 'd1000000-0000-4000-8000-000000000001', 'Idea ' || g
from generate_series(1, 30) as g;
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
set local request.method to 'POST';
select is(
  (select count(*)::integer
   from (select public.reserve_public_wishlist_item(current_setting('test.k'), i.id, 'Zio Luca', repeat('Z', 40)) as outcome
         from public.get_public_wishlist(current_setting('test.k')) w, unnest(w.items) i
         where i.title ~ '^Idea ([1-9]|1[0-9]|2[0-9])$') o
   where o.outcome = 'reserved'),
  29,
  '29 more ideas taken in the hour (30 with the Diario)'
);
select is(
  public.reserve_public_wishlist_item(current_setting('test.k'), 'd2000000-0000-4000-8000-000000000005', 'Zio Luca',
    repeat('Z', 40))::text,
  'rate_limited', 'CA-22: the 31st in the hour is refused as «troppe richieste»'
);
select is(
  (select i.state::text from public.get_public_wishlist(current_setting('test.k')) w, unnest(w.items) i
   where i.id = 'd2000000-0000-4000-8000-000000000005'),
  'free',
  'and the Acquerelli stay free'
);
select is(
  public.reserve_public_wishlist_item(current_setting('test.k'), 'd2000000-0000-4000-8000-000000000001', 'Zio Luca',
    repeat('Z', 40))::text,
  'taken', 'an idea already taken still gives «taken»'
);
reset role;
insert into public.wishlist_items (id, household_id, wishlist_id, title)
values ('d2000000-0000-4000-8000-000000000202', '22222222-2222-4222-8222-222222222222', 'd1000000-0000-4000-8000-000000000003', 'Aquilone');
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
set local request.method to 'POST';
select is(
  public.reserve_public_wishlist_item(current_setting('test.k_leo'), 'd2000000-0000-4000-8000-000000000202', 'Zio Luca',
    repeat('Z', 40))::text,
  'reserved', 'the limit is per list: the list of Leo is not touched'
);
reset role;
-- Reservations made more than an hour ago do not count.
update public.wishlist_reservations r set created_at = now() - interval '61 minutes'
where r.item_id = 'd2000000-0000-4000-8000-000000000006';
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
set local request.method to 'POST';
select is(
  public.reserve_public_wishlist_item(current_setting('test.k'), 'd2000000-0000-4000-8000-000000000005', 'Zio Luca',
    repeat('Z', 40))::text,
  'reserved', 'once a reservation is older than an hour, one more is allowed'
);
reset role;

-- The deleted list: a code of a deleted child gives «inactive».
delete from public.household_members m where m.id = 'b1000000-0000-4000-8000-000000000003';
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
set local request.method to 'POST';
select is(
  (select w.status::text from public.get_public_wishlist(current_setting('test.k_leo')) w),
  'inactive',
  'the code of a child who was removed gives «inactive»'
);
reset role;
select is(
  (select count(*)::integer from public.notifications n where n.household_id = '22222222-2222-4222-8222-222222222222'),
  0,
  'and its «Regalo preso» notifications are gone'
);

select * from finish();
rollback;
