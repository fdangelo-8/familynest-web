-- Issue #481 (part A of #460): repetition of a deadline («Si ripete» of the sheet Aggiungi
-- and of the edit sheet). A type of its own, separate from public.event_recurrence: the
-- choices are different and the two must be able to change independently.
--   none            «Mai» (default): the deadline does not repeat, no «Fatta»
--   monthly         «Ogni mese»
--   every_3_months  «Ogni 3 mesi»
--   every_6_months  «Ogni 6 mesi»
--   yearly          «Ogni anno»
--   every_n_days    «Ogni … giorni»: N whole days, 1-365 (deadlines.recurrence_interval_days)
-- Months are calendar months; a day that does not exist in the target month becomes the
-- last day of that month (private.deadline_next_due_date, functions migration).
create type public.deadline_recurrence as enum (
  'none',
  'monthly',
  'every_3_months',
  'every_6_months',
  'yearly',
  'every_n_days'
);
