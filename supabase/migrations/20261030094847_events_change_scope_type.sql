-- Issue #109 (for pages #19 Dettaglio impegno and #20 Aggiungi · Impegni): which
-- occurrences of a repeated event a deletion affects (decision of Francesco of 30/10:
-- the app asks every time «Solo questo» or «Tutti i prossimi»):
-- - this      = «Solo questo»: only the occurrence that was opened;
-- - following = «Tutti i prossimi»: the occurrence that was opened and every later one.
create type public.event_change_scope as enum ('this', 'following');
