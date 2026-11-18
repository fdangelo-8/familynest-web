-- Issue #481 (part A of #460): the repetition of a deadline.
--
-- Two columns, the same for every deadline already saved («Mai», no interval):
-- - recurrence: «Si ripete» (type of the previous migration);
-- - recurrence_interval_days: N of «Ogni … giorni», a whole number from 1 to 365, present
--   only for that choice and null for every other one. A value with a fraction is refused
--   by the type itself (smallint), an empty one by the check below.
-- No history of the deadlines done (requirement of #460, open question 6): «Fatta» only
-- moves the due date of the same row.
-- RLS is already enabled on the table (deadlines_table migration); the privileges on the
-- new columns are in the deadlines_recurrence_policies_and_grants migration.

alter table public.deadlines
  add column recurrence public.deadline_recurrence not null default 'none',
  add column recurrence_interval_days smallint;

-- Exactly one shape per choice. Written without a CASE so that a null N with «Ogni …
-- giorni» is refused too (a check that evaluates to null would let the row pass).
alter table public.deadlines
  add constraint deadlines_recurrence_interval_days_valid check (
    (
      recurrence = 'every_n_days'
      and recurrence_interval_days is not null
      and recurrence_interval_days between 1 and 365
    )
    or (recurrence <> 'every_n_days' and recurrence_interval_days is null)
  );
