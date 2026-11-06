-- Issue #331 (for #329, the real adapters of Google and Outlook): the synchronisation service
-- saves the credentials renewed by the provider. Microsoft changes the refresh token at every
-- renewal, so the new one has to replace the old one.
--
-- update_calendar_account_credentials() is a compare and swap: the credentials of the account
-- change only if they are still p_previous_ciphertext, the value the service read before
-- talking to the provider. If the adult has used «Ricollega» in the meantime
-- (save_calendar_account() wrote new credentials), the newer credentials are kept and the
-- function returns false. It also returns false when the account no longer exists
-- («Scollega» in the meantime): nothing to save.
--
-- What it does not do:
-- - it does not change status, failing_since or last_synced_at (record_calendar_sync_result()
--   does that);
-- - it does not write into calendar_credential_revocations: the old refresh token is replaced
--   by the provider itself, revoking it could revoke the new one.
--
-- Same rules as the functions of the linked_calendars_server_functions migration:
-- `security definer` (owner postgres, `set search_path = ''`), executable only by
-- service_role and the database owner (grants migration), only POST through the Data API.
-- The credentials are checked by the constraint calendar_accounts_credentials_format
-- (23514 for a value that is not «v<version>:<ciphertext>»).
--
-- Errors:
-- - P0001 'use POST': called through the Data API with a method other than POST;
-- - 22023: a missing argument;
-- - 23514: new credentials with an invalid format.

create or replace function public.update_calendar_account_credentials(
  p_account_id uuid,
  p_previous_ciphertext text,
  p_credentials_ciphertext text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  if p_account_id is null or p_previous_ciphertext is null or p_credentials_ciphertext is null then
    raise exception 'invalid credentials' using errcode = '22023';
  end if;

  -- One statement: the row lock and the re-check of the condition under READ COMMITTED make
  -- the compare and swap atomic against a concurrent «Ricollega».
  update public.calendar_accounts a
  set credentials_ciphertext = p_credentials_ciphertext
  where a.id = p_account_id
    and a.credentials_ciphertext = p_previous_ciphertext;

  return found;
end;
$$;
