-- Issue #230 (for page #40 Ricerca): the kinds of thing the search returns, used both
-- to choose what to search (argument p_kinds) and to tell the rows apart (column kind)
-- of public.search_household() (next migrations). No table, no stored data.
-- - event         = «Impegni» (one row per occurrence);
-- - deadline      = «Scadenze»;
-- - todo          = «Da fare»;
-- - shopping_item = «Spesa».
-- The order of the values is the order of the groups on the page (Impegni, Scadenze,
-- Da fare, Spesa) and the order of the rows returned by the search.
create type public.search_result_kind as enum ('event', 'deadline', 'todo', 'shopping_item');
