-- Issue #438 (database part of #417): the token of an invitation has exactly the format
-- the column default generates, encode(extensions.gen_random_bytes(32), 'hex'):
-- 64 lowercase hexadecimal characters. Until now only char_length(token) >= 32 was
-- checked (invitations_token_length, kept).
--
-- The rows on the remote database cannot be read from here. No API role can choose the
-- token (authenticated may insert only household_id, member_id and message; the guard
-- trigger refuses any change of the token), so every existing token should come from the
-- default. To be safe the check is added `not valid`: from now on every insert and
-- update must respect it, without reading the existing rows (short lock). The existing
-- rows are checked in the next migration, invitations_token_format_validate: if one did
-- not match, that migration alone fails, with the constraint name in the error.

alter table public.invitations
  add constraint invitations_token_format check (token ~ '^[0-9a-f]{64}$') not valid;
