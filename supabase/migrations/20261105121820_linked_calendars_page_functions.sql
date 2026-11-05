-- Issue #266 (for #34 Calendari collegati parts 1 and 2, #37 Onboarding · Pronto): what the
-- pages do with the session of the adult, beyond reading and changing their own accounts
-- and calendars directly (policies migration):
-- - set_new_events_calendar(): «Dove vanno i nuovi impegni»;
-- - set_event_also_on():       «Anche su …» of an event of FamilyNest (#34 §16);
-- - get_event_calendar_link(): what Dettaglio impegno needs to know about the external
--                              calendar of an event (read only, «Anche su», source);
-- - count_imported_events():   «<n> impegni arrivati da <fornitori>» of Onboarding · Pronto
--                              (#37 §6, richiesta-db point 13);
-- - complete_starter_list():   new version with the step «Collega il tuo calendario»
--                              (richiesta-db point 10).
--
-- Conventions: `set search_path = ''`, fully qualified names; nothing sent by the app is
-- trusted beyond ids: the adult is always the member of the verified session; an id of
-- someone else, of another household or unknown gives the same answer (P0002, or no row),
-- never telling the cases apart. The functions that write refuse every Data API method
-- other than POST (lesson of #112). `security definer` (owner: postgres) because they read
-- or write the links and the outbox, which the app cannot. Execute grants are in the
-- linked_calendars_policies_and_grants migration.

-- ---------------------------------------------------------------------------
-- RPC (write): «Dove vanno i nuovi impegni». p_calendar_id is one of the calendars of the
-- caller that is switched on, «Entrata e uscita» and writable; null = «Nessuno».
-- Errors: P0001 'use POST'; 42501 without a household; P0002 'calendar not found' for any
-- other calendar (of someone else, switched off, «Solo in entrata», unknown).
-- ---------------------------------------------------------------------------
create or replace function public.set_new_events_calendar(p_calendar_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_member_id uuid;
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  v_member_id := private.current_member_id();
  if v_member_id is null then
    raise exception 'permission denied for function set_new_events_calendar' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('public.external_calendars.target:' || v_member_id::text, 0));

  if p_calendar_id is not null and not exists (
    select 1
    from public.external_calendars c
    where c.id = p_calendar_id
      and c.member_id = v_member_id
      and c.is_enabled
      and c.direction = 'two_way'
      and not c.is_read_only
  ) then
    raise exception 'calendar not found' using errcode = 'P0002';
  end if;

  update public.external_calendars c
  set is_new_events_target = false
  where c.member_id = v_member_id
    and c.is_new_events_target
    and c.id is distinct from p_calendar_id;

  if p_calendar_id is not null then
    update public.external_calendars c
    set is_new_events_target = true
    where c.id = p_calendar_id
      and not c.is_new_events_target;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC (write): «Anche su …» of one event (#34 §16). Only the author, only an event born in
-- FamilyNest (never an imported one):
-- - p_enabled true: the event is created in the calendar of «Dove vanno i nuovi impegni»
--   by the synchronisation service (outbox «create»), with only title, start, end, place
--   and repetition, marked private there. Already sent or waiting: nothing changes;
-- - p_enabled false: the copy is deleted at the provider (outbox «delete»), the link goes;
--   a creation still waiting is cancelled.
-- The save in FamilyNest never waits for the provider. Errors: P0001 'use POST'; 42501
-- without a household or for an imported event; 22004 without p_enabled; P0002 'event not
-- found' (not the author, not visible, unknown) and 'calendar not found' («Dove vanno i
-- nuovi impegni» is «Nessuno»).
-- ---------------------------------------------------------------------------
create or replace function public.set_event_also_on(p_event_id uuid, p_enabled boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_member_id uuid;
  v_event public.events;
  v_calendar_id uuid;
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  v_member_id := private.current_member_id();
  if v_member_id is null then
    raise exception 'permission denied for function set_event_also_on' using errcode = '42501';
  end if;

  if p_enabled is null then
    raise exception 'the choice is required' using errcode = '22004';
  end if;

  select e.* into v_event
  from public.events e
  where e.id = p_event_id
    and e.household_id = (select public.current_household_id())
    and e.author_member_id = v_member_id
  for update;

  if not found then
    raise exception 'event not found' using errcode = 'P0002';
  end if;

  if private.is_imported_event(v_event.id) then
    raise exception 'imported events are not sent to another calendar' using errcode = '42501';
  end if;

  if p_enabled then
    if exists (
      select 1
      from public.event_external_links l
      where l.event_id = v_event.id
        and l.origin = 'sent'
    ) or exists (
      select 1
      from public.calendar_outbox o
      where o.event_id = v_event.id
        and o.action = 'create'
    ) then
      return;
    end if;

    select c.id into v_calendar_id
    from public.external_calendars c
    where c.member_id = v_member_id
      and c.is_new_events_target;

    if v_calendar_id is null then
      raise exception 'calendar not found' using errcode = 'P0002';
    end if;

    insert into public.calendar_outbox (household_id, calendar_id, action, event_id)
    values (v_event.household_id, v_calendar_id, 'create', v_event.id);
  else
    delete from public.calendar_outbox o
    where o.event_id = v_event.id;

    insert into public.calendar_outbox (household_id, calendar_id, action, provider_event_id)
    select l.household_id, l.calendar_id, 'delete', l.provider_event_id
    from public.event_external_links l
    where l.event_id = v_event.id
      and l.origin = 'sent';

    delete from public.event_external_links l
    where l.event_id = v_event.id
      and l.origin = 'sent';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC (read): the external calendar of one event, for Dettaglio impegno (#34 §15, §16).
-- One row when the caller sees the event in full (the rule of private.can_read_event:
-- «Tutto il Nest», or author, escort, participant), no row otherwise (unknown id, other
-- household, «Occupato» or «Solo io» of the others):
-- - is_imported: the event arrived from an external calendar: read only for everybody
--   (no «Modifica» of the content, no «Elimina impegno»), for every reader;
-- - only for the author (null for everybody else, so that the other adults never learn the
--   provider nor the name of a calendar, #34 §1, §13):
--   - is_sent: sent with «Anche su» (also while the provider has not created it yet);
--   - provider, calendar_id, calendar_name: where it comes from or where it was sent;
--   - visibility_overridden: the author changed «Chi lo vede» of this imported event.
-- The generated types say `boolean` and `string` for these columns, but they can be null
-- (lesson of #96).
-- ---------------------------------------------------------------------------
create or replace function public.get_event_calendar_link(p_event_id uuid)
returns table (
  is_imported boolean,
  is_sent boolean,
  provider public.calendar_provider,
  calendar_id uuid,
  calendar_name text,
  visibility_overridden boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_member_id uuid;
  v_event public.events;
  v_is_author boolean;
begin
  v_member_id := private.current_member_id();
  if v_member_id is null or p_event_id is null then
    return;
  end if;

  select e.* into v_event
  from public.events e
  where e.id = p_event_id
    and e.household_id = (select public.current_household_id());

  if not found or not private.can_read_event(v_event.id) then
    return;
  end if;

  v_is_author := v_event.author_member_id is not distinct from v_member_id;

  return query
    with source as (
      select
        (l.origin = 'imported') as is_imported,
        (l.origin = 'sent') as is_sent,
        a.provider,
        c.id as calendar_id,
        c.name as calendar_name,
        l.visibility_overridden
      from public.event_external_links l
      join public.external_calendars c on c.id = l.calendar_id
      join public.calendar_accounts a on a.id = c.account_id
      where l.event_id = v_event.id
      union all
      select false, true, a.provider, c.id, c.name, false
      from public.calendar_outbox o
      join public.external_calendars c on c.id = o.calendar_id
      join public.calendar_accounts a on a.id = c.account_id
      where o.event_id = v_event.id
        and o.action = 'create'
    ),
    first_source as (
      select s.*
      from source s
      limit 1
    )
    select
      coalesce((select f.is_imported from first_source f), false),
      case when v_is_author then coalesce((select f.is_sent from first_source f), false) end,
      case when v_is_author then (select f.provider from first_source f) end,
      case when v_is_author then (select f.calendar_id from first_source f) end,
      case when v_is_author then (select f.calendar_name from first_source f) end,
      case when v_is_author then coalesce((select f.visibility_overridden from first_source f), false) end;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC (read): for Onboarding · Pronto (#37 §6), how many of the caller's own imported
-- events start from p_from on (the page sends the start of today in Europe/Rome), per
-- provider of the caller's accounts, in the order in which the providers were first
-- linked. Only numbers: no title, time, calendar or email. A provider with accounts but no
-- event gives 0. No row for a caller without accounts or without household; 42501 without
-- a session; 22023 without a finite p_from.
-- ---------------------------------------------------------------------------
create or replace function public.count_imported_events(p_from timestamptz)
returns table (provider public.calendar_provider, event_count integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_member_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'permission denied for function count_imported_events' using errcode = '42501';
  end if;
  if p_from is null or not isfinite(p_from) then
    raise exception 'invalid instant' using errcode = '22023';
  end if;

  v_member_id := private.current_member_id();
  if v_member_id is null then
    return;
  end if;

  return query
    select
      a.provider,
      count(e.id)::integer
    from public.calendar_accounts a
    left join public.external_calendars c on c.account_id = a.id
    left join public.event_external_links l on l.calendar_id = c.id and l.origin = 'imported'
    left join public.events e on e.id = l.event_id and e.starts_at >= p_from
    where a.member_id = v_member_id
    group by a.provider
    order by min(a.connected_at), a.provider;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: the administrator marks the starter list of their household as completed (new
-- version of the starter_list_functions_and_triggers migration, #90, same arguments and
-- result). One more condition, the step «Collega il tuo calendario» (#34 §17): the
-- administrator who calls has at least one linked account. The others are unchanged:
-- - the caller is an administrator of a household (otherwise 42501);
-- - at least one item was ever added to the shopping list;
-- - no invitation of the household is still pending and not expired.
-- If a condition is false nothing changes and the result is false. Once completed the time
-- is never changed again (unlinking later does not reopen the list) and the result is
-- true. `create or replace` keeps the owner and the execute grants (signed-in users only).
-- ---------------------------------------------------------------------------
create or replace function public.complete_starter_list()
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_member_id uuid;
  v_household_id uuid;
  v_first_item_at timestamptz;
  v_completed_at timestamptz;
begin
  select m.id, m.household_id into v_member_id, v_household_id
  from public.household_members m
  where m.user_id = (select auth.uid())
    and m.is_admin;

  if v_household_id is null then
    raise exception 'permission denied for function complete_starter_list' using errcode = '42501';
  end if;

  -- Serialises concurrent calls for the same household (same lock as the member limit
  -- trigger: it does not block the foreign key checks of the other tables).
  select h.first_shopping_item_at, h.starter_list_completed_at
  into v_first_item_at, v_completed_at
  from public.households h
  where h.id = v_household_id
  for no key update;

  if v_completed_at is not null then
    return true;
  end if;

  if v_first_item_at is null then
    return false;
  end if;

  if exists (
    select 1
    from public.invitations i
    where i.household_id = v_household_id
      and i.status = 'pending'
      and i.expires_at > now()
  ) then
    return false;
  end if;

  if not exists (
    select 1
    from public.calendar_accounts a
    where a.member_id = v_member_id
  ) then
    return false;
  end if;

  update public.households h
  set starter_list_completed_at = now()
  where h.id = v_household_id;

  return true;
end;
$$;
