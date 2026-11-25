-- Issue #510 (DB-1 «Impegni 2.0»): the fields of an event that can be marked «Da
-- verificare» (mn1-25, mn1-26): somebody still has to confirm them.
--   title     the title;
--   day       the day;
--   time      the times (start and end);
--   members   the people (participants, «Lo porta», «Lo riprende»);
--   location  the place.
create type public.event_field as enum ('title', 'day', 'time', 'members', 'location');
