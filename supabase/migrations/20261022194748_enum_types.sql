-- Enumerated types for the base schema (issue #9).

-- Answer to "Chi vive con te?" (mockup 02).
create type public.household_type as enum ('single', 'couple', 'family_with_children', 'roommates');

-- Kind of household member (mockup 03). Children and pets never have an account.
create type public.member_kind as enum ('adult', 'child', 'pet');

-- Avatar colours: same names as the design system tokens --color-membro-*.
create type public.member_color as enum ('pomodoro', 'glicine', 'salvia', 'cobalto', 'zafferano');

-- Stored invitation states. "Expired" is never stored: it is a pending invitation past expires_at.
create type public.invitation_status as enum ('pending', 'accepted', 'revoked');
