-- Issue #510 (DB-1 «Impegni 2.0», review of PR #580): the days of the events «tutto il
-- giorno» already imported from a linked calendar get all_day = true, as the new version
-- of sync_external_calendar_events() (previous migration) writes them.
-- An imported row is a day of an event «tutto il giorno» exactly when the synchronisation
-- wrote it that way (20261105121818): occurrence key ending with '#' and its day
-- (YYYY-MM-DD), from 0:00 of that day to 0:00 of the next one (Europe/Rome), not busy at
-- the provider. Events with a time are never touched, nor events of FamilyNest (sent with
-- «Anche su»). Run by the database owner: no session, so nobody is notified.
update public.events e
set all_day = true
from public.event_external_links l
where l.event_id = e.id
  and l.household_id = e.household_id
  and l.origin = 'imported'
  and not l.is_busy_on_provider
  and not e.all_day
  and e.recurrence = 'none'
  and (e.starts_at at time zone 'Europe/Rome')::time = time '00:00'
  and e.ends_at = (((e.starts_at at time zone 'Europe/Rome')::date + 1)::timestamp at time zone 'Europe/Rome')
  and right(l.occurrence_key, 11) = '#' || to_char((e.starts_at at time zone 'Europe/Rome')::date, 'YYYY-MM-DD');
