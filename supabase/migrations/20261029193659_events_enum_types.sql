-- Issue #86 (for pages #20, #25, #30): enumerated types of the events ("impegni").

-- Who sees an event (mockup 10 and 11, «Chi lo vede»):
-- - private   = «Solo io»: only the author and the adults involved in it (participants,
--               escort); never shown to the others, in any form;
-- - busy      = «Occupato»: the others only see that the author is busy (start, end,
--               author), never title, place, participants or escort;
-- - household = «Tutto il Nest» / «Tutti»: every member of the household sees it.
create type public.event_visibility as enum ('private', 'busy', 'household');

-- Repetition of an event (mockup 11, «Si ripete»): «Mai», «Ogni settimana» (on one or
-- more days of the week), «Ogni mese» (same day of the month).
create type public.event_recurrence as enum ('none', 'weekly', 'monthly');
