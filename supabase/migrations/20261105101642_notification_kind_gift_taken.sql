-- Issue #259 (for page #32 §10 and #39): sixth kind of notification, «Regalo preso»
-- (gift_taken): somebody took an idea of a wish list with «Lo regalo io» on the public
-- page (#33). Written only by the database (trigger on wishlist_reservations, migration
-- gift_taken_notifications).
-- Only this statement in this migration: a value added with ADD VALUE cannot be used in
-- the same transaction (LEZIONI).
alter type public.notification_kind add value 'gift_taken';
