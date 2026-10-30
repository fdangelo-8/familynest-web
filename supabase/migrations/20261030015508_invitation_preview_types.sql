-- Issue #107 (for page #16 Ingresso con invito): types returned by
-- public.invitation_preview() (next migration). No table, no stored data.

-- Answer of the preview. Every unusable invitation (unknown, malformed, expired, revoked,
-- accepted, member already linked to an account) is the same 'invalid', with every other
-- field null: the caller cannot tell why an invitation does not work.
create type public.invitation_preview_status as enum ('valid', 'invalid');

-- One of the other members of the household shown by the preview (decision of Francesco
-- of 30/10 on #16, option B):
-- - initial: first letter of the name, upper case;
-- - color: avatar colour;
-- - name: only for a signed-in caller without a household (the colour page needs it for
--   «già di …»); null for anonymous callers and for callers already in a household.
-- Never the id, kind, birth date or creation time of the member.
create type public.invitation_preview_member as (
  initial text,
  color public.member_color,
  name text
);
