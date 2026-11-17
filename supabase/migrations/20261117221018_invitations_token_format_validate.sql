-- Issue #438: checks the existing invitations against invitations_token_format (added
-- `not valid` in the previous migration). Validation reads the rows with a lock that
-- does not block reads or writes of the table.

alter table public.invitations validate constraint invitations_token_format;
