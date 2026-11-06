-- Issue #331 (review of PR #332): save_calendar_account() left the format of its values to
-- the constraints of calendar_accounts. When a CHECK constraint fails, Postgres adds the
-- whole row to the error (DETAIL «Failing row contains …»): the function is `security
-- definer`, so the row is not reduced, and email, provider_account_id and the credentials
-- (a refresh token in clear, in the case the constraint is there for) reached the service
-- and the log of Postgres.
--
-- Now the function checks the values itself, before writing, with the same rules as the
-- constraints (calendar_accounts_credentials_format through
-- private.calendar_credentials_format_ok(), calendar_accounts_email_format on the email
-- trimmed as the trigger calendar_accounts_before_write does,
-- calendar_accounts_provider_account_id_length), and raises 23514, the code of the
-- constraint, with a generic message and no DETAIL. The constraints stay as the last safety
-- net. Nothing else changes; `create or replace` keeps the privileges of the function
-- (service_role and the database owner only).
--
-- Errors (in addition to those of the linked_calendars_server_functions migration):
-- - 23514 'invalid credentials format': credentials that are not «v<version>:<ciphertext>»;
-- - 23514 'invalid email format': an email the constraint would refuse;
-- - 23514 'invalid provider account id': an id at the provider empty or too long.

create or replace function public.save_calendar_account(
  p_user_id uuid,
  p_provider public.calendar_provider,
  p_provider_account_id text,
  p_email text,
  p_credentials_ciphertext text,
  p_is_fake boolean default false
)
returns table (account_id uuid, is_new boolean)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_member public.household_members;
  v_email text;
  v_id uuid;
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  if p_user_id is null or p_provider is null or p_provider_account_id is null or p_email is null
     or p_credentials_ciphertext is null or p_is_fake is null then
    raise exception 'invalid account' using errcode = '22023';
  end if;

  -- Never a value in these errors: they may hold an email or a refresh token in clear.
  if not private.calendar_credentials_format_ok(p_credentials_ciphertext) then
    raise exception 'invalid credentials format' using errcode = '23514';
  end if;

  -- The trigger calendar_accounts_before_write trims the email before the constraint.
  v_email := btrim(p_email);
  if not (
    char_length(v_email) between 3 and 254
    and v_email !~ '\s'
    and position('@' in v_email) > 1
  ) then
    raise exception 'invalid email format' using errcode = '23514';
  end if;

  if char_length(p_provider_account_id) not between 1 and 255 then
    raise exception 'invalid provider account id' using errcode = '23514';
  end if;

  select m.* into v_member
  from public.household_members m
  where m.user_id = p_user_id
    and m.kind = 'adult';

  if not found then
    raise exception 'member not found' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('public.calendar_accounts:' || v_member.id::text, 0));

  update public.calendar_accounts a
  set email = p_email,
      credentials_ciphertext = p_credentials_ciphertext,
      is_fake = p_is_fake,
      status = 'active',
      failing_since = null
  where a.member_id = v_member.id
    and a.provider = p_provider
    and a.provider_account_id = p_provider_account_id
  returning a.id into v_id;

  if found then
    return query select v_id, false;
    return;
  end if;

  insert into public.calendar_accounts (
    household_id, member_id, provider, provider_account_id, email, credentials_ciphertext, is_fake
  )
  values (
    v_member.household_id, v_member.id, p_provider, p_provider_account_id, p_email,
    p_credentials_ciphertext, p_is_fake
  )
  returning id into v_id;

  return query select v_id, true;
end;
$$;
