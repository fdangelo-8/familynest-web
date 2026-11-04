-- Issue #218: the app changes the three preferences of its own profile.
--
-- Column grant only: the existing policies decide which row (profiles_update allows only
-- the profile of the caller; there is still no insert or delete policy, and anon has no
-- policy at all). id and the times stay out of reach of the app.
grant update (start_lens, morning_digest_time, default_event_visibility)
  on table public.profiles to authenticated;
