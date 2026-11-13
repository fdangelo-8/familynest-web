-- Issue #373: claim_calendar_outbox_items(), complete_calendar_outbox_item() and
-- fail_calendar_outbox_item() are for the synchronisation service only (administrative key,
-- service_role) and the database owner, never for authenticated or anon. complete and fail
-- were created again with the new argument p_claim_token, so their grants of
-- linked_calendars_policies_and_grants are given again here. private.queue_sent_event_update()
-- was replaced with the same signature and keeps its grants.
revoke execute on function public.claim_calendar_outbox_items(integer, boolean, uuid, timestamptz)
  from public, anon, authenticated;
revoke execute on function public.complete_calendar_outbox_item(uuid, text, text, uuid)
  from public, anon, authenticated;
revoke execute on function public.fail_calendar_outbox_item(uuid, timestamptz, uuid)
  from public, anon, authenticated;
grant execute on function public.claim_calendar_outbox_items(integer, boolean, uuid, timestamptz)
  to service_role;
grant execute on function public.complete_calendar_outbox_item(uuid, text, text, uuid)
  to service_role;
grant execute on function public.fail_calendar_outbox_item(uuid, timestamptz, uuid)
  to service_role;
