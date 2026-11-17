-- Issue #438 (database part of #417): public.accept_invitation(text) is no longer used.
-- The app and the test fixtures join a household only with
-- public.accept_invitation_with_color(text, public.member_color) (#107, PR #436), which
-- makes the same checks and also saves the colour. Nothing in the database calls the
-- old function. Its execute privileges go away with it.

drop function public.accept_invitation(text);
