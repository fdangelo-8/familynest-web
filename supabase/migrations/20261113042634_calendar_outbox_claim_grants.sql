-- Issue #373: claim_calendar_outbox_items() is for the synchronisation service only
-- (administrative key, service_role) and the database owner, never for authenticated or
-- anon. complete_calendar_outbox_item(), fail_calendar_outbox_item() and
-- private.queue_sent_event_update() were replaced with the same signature and keep their
-- grants (linked_calendars_policies_and_grants).
revoke execute on function public.claim_calendar_outbox_items(integer, boolean, uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.claim_calendar_outbox_items(integer, boolean, uuid, timestamptz)
  to service_role;
