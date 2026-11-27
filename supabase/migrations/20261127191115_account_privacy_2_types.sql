-- Issue #513 (DB-4 «Account e privacy», plan #501), part 2 of 2: the new enumerated
-- types. Only types in this migration (convenzioni-supabase).

-- «Esporta i miei dati» (cb1-47, cb1-48), the three moments of an export:
--   preparing  the server is preparing the file (at most 30 minutes)
--   ready      the file can be downloaded for 24 hours
--   failed     something went wrong: the page offers to try again
create type public.data_export_status as enum ('preparing', 'ready', 'failed');

-- The jobs of the account (rule 13 of #513, decision B of Francesco of 27/11), for
-- public.run_account_job() and the pg_cron schedule:
--   deletions       the accounts whose 14 days to think it over are over
--   exports         exports stuck in preparing, expired or failed ones
--   mail_purge      the addresses for the last mail, after 72 hours
--   evidence_purge  the proof of the consents, 5 years after the deletion of the account
create type public.account_job as enum ('deletions', 'exports', 'mail_purge', 'evidence_purge');
