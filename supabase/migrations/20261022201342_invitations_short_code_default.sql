-- Issue #49: invitations.short_code gets a server default, so the app creates an
-- invitation without sending it (optional in the generated Insert types).
-- 4 random digits; the invitations_before_insert trigger (private_membership_functions
-- migration) draws another code while a valid invitation uses it.
alter table public.invitations
  alter column short_code set default lpad(
    ((('x' || encode(extensions.gen_random_bytes(2), 'hex'))::bit(16)::integer) % 10000)::text,
    4,
    '0'
  );
