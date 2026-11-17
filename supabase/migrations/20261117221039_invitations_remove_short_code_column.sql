-- Issue #438 (database part of #417): invitations.short_code is removed. No page reads
-- or shows it, and since 20261117221015 no trigger fills or checks it.
-- Order: default, check constraint and index first, then the column.

alter table public.invitations alter column short_code drop default;

alter table public.invitations drop constraint invitations_short_code_format;

drop index public.invitations_pending_short_code_idx;

alter table public.invitations drop column short_code;
