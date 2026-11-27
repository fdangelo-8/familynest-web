-- Issue #617, R5 (CA-29, decision 4 of Francesco of 27/11): the households already «in
-- coppia» (private.household_is_couple: exactly two members, both adults with an account)
-- where only one of the two organises become equal: both organise. The households that are
-- not in a couple do not change. Data only, separate from the functions (one step per
-- migration).
--
-- Runs as the owner (postgres): the guard triggers of household_members trust it, and
-- private.household_is_couple() sees every member. Idempotent: a second run finds nothing
-- to change.

update public.household_members m
set is_admin = true
where not m.is_admin
  and m.kind = 'adult'
  and m.user_id is not null
  and private.household_is_couple(m.household_id);
