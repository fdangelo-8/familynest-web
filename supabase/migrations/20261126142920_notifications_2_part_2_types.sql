-- Issue #511 (DB-2 «Notifiche 2.0», plan #501), part 2 of 2: the new enumerated type of the
-- reminders and requests about a ride. Only this type in this migration
-- (convenzioni-supabase); the columns and functions that use it come in the next
-- migrations.

-- Which way of a ride («Lo porta» or «Lo riprende» of an event):
--   escort  «Lo porta»: the way there, at the start of the occurrence
--   pickup  «Lo riprende»: the way back, at the end of the occurrence
create type public.ride_leg as enum ('escort', 'pickup');
