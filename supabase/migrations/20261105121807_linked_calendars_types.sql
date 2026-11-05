-- Issue #266 (for #34 Calendari collegati, #35 Outlook, #37 Onboarding · Calendario):
-- enumerated types of the linked calendars.

-- The provider of an external account. iCloud (#36) waits for a decision of Francesco:
-- it is added with its own migration (`alter type ... add value`) when it is developed.
create type public.calendar_provider as enum ('google', 'outlook');

-- State of an external account (#34 §8):
--   active           the last synchronisation worked;
--   reconnect        the provider refused the credentials (access revoked, password
--                    changed): «Non riusciamo a sincronizzare … » with «Ricollega»;
--   temporary_error  the provider did not answer or asked to slow down: retried in
--                    silence, a notice only after 24 hours of errors only.
create type public.calendar_account_status as enum ('active', 'reconnect', 'temporary_error');

-- Outcome of one synchronisation of an account, sent by the synchronisation service.
create type public.calendar_sync_outcome as enum ('ok', 'auth_error', 'temporary_error');

-- Direction of a calendar (#34 §5, «Direzione»):
--   two_way   «Entrata e uscita»: events arrive here and «Anche su» can send events there;
--   incoming  «Solo in entrata»: events arrive here, FamilyNest never writes there.
create type public.calendar_direction as enum ('two_way', 'incoming');

-- Why an event of FamilyNest is linked to an event of a provider:
--   imported  it arrived from the provider (read only in FamilyNest);
--   sent      it was born in FamilyNest and sent there with «Anche su».
create type public.external_event_origin as enum ('imported', 'sent');

-- What the synchronisation service has to do on the provider for an event sent with
-- «Anche su» (#34 §16).
create type public.calendar_outbox_action as enum ('create', 'update', 'delete');
