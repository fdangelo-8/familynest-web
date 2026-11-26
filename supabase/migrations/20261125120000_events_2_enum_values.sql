-- Issue #510 (DB-1 «Impegni 2.0», plan #501): the new values of the two enumerated types
-- of the events. Only these statements in this migration (convenzioni-supabase, CA-30): a
-- value added with ADD VALUE cannot be used in the transaction that adds it, so the
-- constraints, functions and policies that use them come in the next migrations.

-- «Si ripete» (ap1-38): «Ogni giorno», «Ogni due settimane», «Ogni anno». The order of the
-- labels follows the list of the sheet: none, daily, weekly, biweekly, monthly, yearly.
alter type public.event_recurrence add value if not exists 'daily' after 'none';
alter type public.event_recurrence add value if not exists 'biweekly' after 'weekly';
alter type public.event_recurrence add value if not exists 'yearly' after 'monthly';

-- «Chi lo vede» → «Solo alcune persone» (ap1-40): the chosen people (event_viewers), the
-- author and the people involved see the event in full; everybody else sees it exactly as
-- «Occupato» (busy).
alter type public.event_visibility add value if not exists 'selected' after 'busy';
