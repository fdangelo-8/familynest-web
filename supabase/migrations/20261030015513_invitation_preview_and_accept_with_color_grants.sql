-- Issue #107: privileges of the invitation preview and of the join with colour.
-- No change to table privileges or policies: anonymous callers and callers without a
-- household still read 0 rows of households, household_members and invitations.

-- R1: the welcome page is shown before signing in, so anonymous callers may run the
-- preview. It is the only function the anon role can execute in this project.
revoke execute on function public.invitation_preview(text) from public;
grant execute on function public.invitation_preview(text) to anon, authenticated;

-- R2: joining a household needs a session.
revoke execute on function public.accept_invitation_with_color(text, public.member_color) from public, anon;
grant execute on function public.accept_invitation_with_color(text, public.member_color) to authenticated;
