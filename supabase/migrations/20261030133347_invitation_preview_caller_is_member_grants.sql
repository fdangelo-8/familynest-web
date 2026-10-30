-- Issue #132: the preview was dropped and created again (previous migration), so its
-- privileges are set again, exactly as in 20261030015513: the welcome page is shown
-- before signing in, so anonymous and signed-in callers may run it; PUBLIC may not.
-- It stays the only function the anon role can execute in this project.
-- No change to table privileges or policies.
revoke execute on function public.invitation_preview(text) from public;
grant execute on function public.invitation_preview(text) to anon, authenticated;
