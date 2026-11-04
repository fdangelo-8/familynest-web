-- Issue #218 (for page #38 «Il tuo profilo», section «Come usi l'app»): three personal
-- preferences of each account, stored in its profile.
--
-- Profiles are already personal: the policies profiles_select and profiles_update (base
-- schema) allow only the row of the caller, so the other adults of the same household
-- (administrators included) and every other household never read or change them. The
-- grants that let the app change the three new columns are in the
-- profile_preferences_grants migration.
--
-- Every column is mandatory with a default: the existing profiles get the defaults when
-- the columns are added, and every new account gets them from its first day.
--
-- Stored personal data (privacy skill): three choices of an adult, none sensitive. No free
-- text, nothing about children. They go with the profile when the account is deleted.

alter table public.profiles
  -- «All'apertura»: the lens of the first visit of a browser session (issue #38 §5).
  add column start_lens public.lens not null default 'io',
  -- «Sintesi del mattino»: time of the morning digest, a time of the day in Europe/Rome
  -- (no date, no time zone). Only every half hour from 6:00 to 10:00 (check below).
  -- Used by the notifications (#39); switching the digest on and off is
  -- notification_preferences.morning_digest (#217).
  add column morning_digest_time time not null default '07:30',
  -- «Visibilità predefinita»: visibility of the events created by Aggiungi with the lens
  -- «Io» (issue #38 §5): private «Solo io», busy «Occupato», household «Tutto il Nest».
  add column default_event_visibility public.event_visibility not null default 'busy';

-- The nine times of the page, exactly (no seconds, no other minutes).
alter table public.profiles
  add constraint profiles_morning_digest_time_allowed check (
    morning_digest_time = any (
      array['06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00']::time[]
    )
  );
