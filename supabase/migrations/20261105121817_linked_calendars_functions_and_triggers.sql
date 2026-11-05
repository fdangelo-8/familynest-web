-- Issue #266 (for #34 Calendari collegati): the rules of the linked calendars that depend on
-- other rows, enforced by triggers.
--
-- Conventions (same as the other migrations):
-- - every function has `set search_path = ''` and fully qualified names;
-- - helpers and trigger functions live in the "private" schema (not exposed by the Data
--   API, not in the generated types);
-- - guard triggers are `security invoker`: `current_user` is then the role that runs the
--   statement. The Data API roles (authenticated, anon) get the checks, while statements
--   run by security definer functions (owner: postgres), the synchronisation service
--   (service_role), foreign key actions and the seed are trusted;
-- - the triggers that write rows the caller cannot write (events imported by someone, the
--   queues, the links) are `security definer`.
-- Execute grants are set in the linked_calendars_policies_and_grants migration.
--
-- Error codes the app can tell apart:
-- - FN008 'calendar account limit reached': an adult has at most 5 external accounts;
-- - FN009 'external calendar limit reached': an account has at most 50 calendars;
-- - 42501: not allowed (an imported event changes only on its calendar, only its visibility
--   changes here, and never to «Tutto il Nest» when it is private at the provider; nobody
--   deletes an imported event or adds people to it);
-- - 23514: a rule of the data (a read-only calendar in «Entrata e uscita»).

create trigger calendar_accounts_set_updated_at
  before update on public.calendar_accounts
  for each row execute function public.set_updated_at();

create trigger external_calendars_set_updated_at
  before update on public.external_calendars
  for each row execute function public.set_updated_at();

create trigger event_external_links_set_updated_at
  before update on public.event_external_links
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- True when the event arrived from an external calendar (read only in FamilyNest).
-- Security definer: the links are not readable by the API roles; used by the guard
-- triggers of events and event_members, evaluated as the caller.
create or replace function private.is_imported_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.event_external_links l
    where l.event_id = p_event_id
      and l.origin = 'imported'
  );
$$;

-- True when the imported event is marked private at the provider.
create or replace function private.is_private_imported_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.event_external_links l
    where l.event_id = p_event_id
      and l.origin = 'imported'
      and l.is_private_on_provider
  );
$$;

-- Who sees an imported event: the choice of its calendar, never more than «Occupato» for
-- an event private at the provider (#34 §7).
create or replace function private.imported_event_visibility(
  p_calendar_visibility public.event_visibility,
  p_is_private_on_provider boolean
)
returns public.event_visibility
language sql
immutable
set search_path = ''
as $$
  select case
    when p_is_private_on_provider and p_calendar_visibility = 'household' then 'busy'::public.event_visibility
    else p_calendar_visibility
  end;
$$;

-- The author changed «Chi lo vede» of one imported event: the synchronisation and the
-- choices of the calendar never bring it back. Called by the guard trigger of events for
-- the Data API roles only, after the author check of events_before_update; checks again
-- that the caller is the author. Security definer: the links are not writable by the app.
create or replace function private.mark_imported_visibility_overridden(p_event_id uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.event_external_links l
  set visibility_overridden = true
  from public.events e
  where l.event_id = p_event_id
    and l.origin = 'imported'
    and not l.visibility_overridden
    and e.id = l.event_id
    and e.author_member_id = (select private.current_member_id());
$$;

-- ---------------------------------------------------------------------------
-- calendar_accounts
-- ---------------------------------------------------------------------------

-- Insert: only adults with an account, at most 5 accounts per adult (#34 §7), serialised
-- per adult (LEZIONI: a count before the insert alone lets two requests pass). Linking the
-- same account again is refused by the unique constraint, never by the limit.
-- Update: the adult, the household, the provider and the account at the provider never
-- change (any role).
create or replace function private.calendar_accounts_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  -- Maximum number of external accounts of an adult (#34 §7): the only place of this
  -- number in the database.
  c_max_accounts constant integer := 5;
  v_count integer;
begin
  new.email := btrim(new.email);

  if tg_op = 'UPDATE' then
    if new.household_id is distinct from old.household_id
       or new.member_id is distinct from old.member_id
       or new.provider is distinct from old.provider
       or new.provider_account_id is distinct from old.provider_account_id then
      raise exception 'this account field cannot be changed' using errcode = '42501';
    end if;
    return new;
  end if;

  if not exists (
    select 1
    from public.household_members m
    where m.id = new.member_id
      and m.household_id = new.household_id
      and m.kind = 'adult'
      and m.user_id is not null
  ) then
    raise exception 'only adults with an account link calendars' using errcode = '23514';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('public.calendar_accounts:' || new.member_id::text, 0));

  if exists (
    select 1
    from public.calendar_accounts a
    where a.member_id = new.member_id
      and a.provider = new.provider
      and a.provider_account_id = new.provider_account_id
  ) then
    return new;
  end if;

  select count(*) into v_count
  from public.calendar_accounts a
  where a.member_id = new.member_id;

  if v_count >= c_max_accounts then
    raise exception 'calendar account limit reached' using errcode = 'FN008';
  end if;

  return new;
end;
$$;

create trigger calendar_accounts_before_write
  before insert or update on public.calendar_accounts
  for each row execute function private.calendar_accounts_before_write();

-- An account is deleted for any reason (Scollega, the adult leaves or is removed, deletes
-- the account, the household is deleted): its credentials go to the revocation queue, with
-- the provider only (#34 §9). Only Google offers a revocation service; for Outlook the
-- credentials are simply gone (#35 §5). Its calendars, links and imported events go with
-- the foreign keys and the trigger of event_external_links.
-- Security definer: the queue is not writable by the app.
create or replace function private.calendar_accounts_after_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.provider = 'google' then
    insert into public.calendar_credential_revocations (provider, is_fake, credentials_ciphertext)
    values (old.provider, old.is_fake, old.credentials_ciphertext);
  end if;
  return null;
end;
$$;

create trigger calendar_accounts_after_delete
  after delete on public.calendar_accounts
  for each row execute function private.calendar_accounts_after_delete();

-- ---------------------------------------------------------------------------
-- external_calendars
-- ---------------------------------------------------------------------------

-- True when the calendar may receive the new events of «Anche su».
create or replace function private.external_calendar_is_target_eligible(p_calendar public.external_calendars)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_calendar.is_enabled and p_calendar.direction = 'two_way' and not p_calendar.is_read_only, false);
$$;

-- Insert and update:
-- - the name is normalised like the titles of the events;
-- - a calendar that is (or becomes) read only at the provider is «Solo in entrata»; a
--   read-only calendar set to «Entrata e uscita» by the app is refused by the check
--   external_calendars_read_only_incoming (23514);
-- - «Dove vanno i nuovi impegni» is cleared when the calendar is switched off, set to
--   «Solo in entrata» or becomes read only (#34 §3);
-- - insert: at most 50 calendars per account (#34 §7), serialised per account;
-- - update: account, adult, household and id at the provider never change (any role);
--   a calendar switched off forgets its position at the provider, so that switching it on
--   again reads everything (the imported events were deleted).
create or replace function private.external_calendars_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  -- Maximum number of calendars of an account (#34 §7): the only place of this number in
  -- the database.
  c_max_calendars constant integer := 50;
  v_count integer;
begin
  new.name := btrim(regexp_replace(new.name, '\s+', ' ', 'g'));

  if new.is_read_only and (tg_op = 'INSERT' or not old.is_read_only) then
    new.direction := 'incoming';
  end if;

  if new.is_new_events_target and not private.external_calendar_is_target_eligible(new) then
    new.is_new_events_target := false;
  end if;

  if tg_op = 'UPDATE' then
    if new.household_id is distinct from old.household_id
       or new.member_id is distinct from old.member_id
       or new.account_id is distinct from old.account_id
       or new.provider_calendar_id is distinct from old.provider_calendar_id then
      raise exception 'this calendar field cannot be changed' using errcode = '42501';
    end if;

    if old.is_enabled and not new.is_enabled then
      new.sync_cursor := null;
    end if;
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('public.external_calendars:' || new.account_id::text, 0));

  if exists (
    select 1
    from public.external_calendars c
    where c.account_id = new.account_id
      and c.provider_calendar_id = new.provider_calendar_id
  ) then
    return new;
  end if;

  select count(*) into v_count
  from public.external_calendars c
  where c.account_id = new.account_id;

  if v_count >= c_max_calendars then
    raise exception 'external calendar limit reached' using errcode = 'FN009';
  end if;

  return new;
end;
$$;

create trigger external_calendars_before_write
  before insert or update on public.external_calendars
  for each row execute function private.external_calendars_before_write();

-- After insert and update, in the same operation as the change (#34 §3, §5):
-- - switched off: the events imported from it are deleted (whatever their visibility); the
--   copies sent there with «Anche su» stay at the provider, but FamilyNest no longer
--   follows them (links and pending changes deleted);
-- - set to «Solo in entrata»: the same for the copies sent there;
-- - new visibility: every event already imported from it takes it, except those whose
--   visibility the author changed one by one; an event private at the provider stays at
--   most «Occupato»;
-- - «Solo giorni feriali» switched on: the imported events starting on Saturday or Sunday
--   (Europe/Rome) are deleted (switched off: they come back with the next
--   synchronisation);
-- - a calendar that becomes eligible for «Dove vanno i nuovi impegni» (switched on, «Entrata
--   e uscita», writable) becomes the choice of its adult when the adult has none.
-- Security definer: the imported events are those of the adult, but the links and the
-- outbox are not writable by the app.
create or replace function private.external_calendars_after_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if old.is_enabled and not new.is_enabled then
      -- Imported events go with their links (trigger of event_external_links).
      delete from public.event_external_links l
      where l.calendar_id = new.id;
      delete from public.calendar_outbox o
      where o.calendar_id = new.id;
    elsif old.direction = 'two_way' and new.direction = 'incoming' then
      delete from public.event_external_links l
      where l.calendar_id = new.id
        and l.origin = 'sent';
      delete from public.calendar_outbox o
      where o.calendar_id = new.id;
    end if;

    if new.is_enabled and new.visibility is distinct from old.visibility then
      update public.events e
      set visibility = private.imported_event_visibility(new.visibility, l.is_private_on_provider)
      from public.event_external_links l
      where l.calendar_id = new.id
        and l.origin = 'imported'
        and not l.visibility_overridden
        and e.id = l.event_id
        and e.visibility is distinct from private.imported_event_visibility(new.visibility, l.is_private_on_provider);
    end if;

    if new.is_enabled and new.weekdays_only and not old.weekdays_only then
      delete from public.events e
      using public.event_external_links l
      where l.calendar_id = new.id
        and l.origin = 'imported'
        and e.id = l.event_id
        and extract(isodow from (e.starts_at at time zone 'Europe/Rome')) in (6, 7);
    end if;
  end if;

  if private.external_calendar_is_target_eligible(new)
     and (tg_op = 'INSERT' or not private.external_calendar_is_target_eligible(old))
     and not exists (
       select 1
       from public.external_calendars t
       where t.member_id = new.member_id
         and t.is_new_events_target
     ) then
    update public.external_calendars c
    set is_new_events_target = true
    where c.id = new.id;
  end if;

  return null;
end;
$$;

create trigger external_calendars_after_write
  after insert or update on public.external_calendars
  for each row execute function private.external_calendars_after_write();

-- ---------------------------------------------------------------------------
-- event_external_links
-- ---------------------------------------------------------------------------

-- The link of an imported event is deleted (calendar switched off or gone, account
-- unlinked, adult gone, event gone at the provider): the event goes with it, whatever its
-- visibility, also «Tutto il Nest» (#34 §9). The link of an event sent with «Anche su»
-- goes alone: the event was born in FamilyNest and stays.
-- Security definer: the event may be invisible to the caller (for example an
-- administrator who removes an adult).
create or replace function private.event_external_links_after_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.origin = 'imported' then
    delete from public.events e
    where e.id = old.event_id;
  end if;
  return null;
end;
$$;

create trigger event_external_links_after_delete
  after delete on public.event_external_links
  for each row execute function private.event_external_links_after_delete();

-- ---------------------------------------------------------------------------
-- events: imported events are read only (#34 §15, richiesta-db point 5)
-- ---------------------------------------------------------------------------

-- For the Data API roles, on an imported event:
-- - title, place, times, repetition, notes and escort never change (they change at the
--   provider): 42501;
-- - only the visibility changes (only the author: events_before_update, which fires
--   before this trigger), never to «Tutto il Nest» for an event private at the provider,
--   and the change is remembered (the synchronisation does not bring it back);
-- - nobody deletes it (it is deleted at the provider): 42501.
-- Security invoker; the checks on the links go through security definer helpers.
create or replace function private.events_guard_imported()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if not private.is_imported_event(old.id) then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    raise exception 'imported events are deleted on their calendar' using errcode = '42501';
  end if;

  if new.title is distinct from old.title
     or new.location is distinct from old.location
     or new.notes is distinct from old.notes
     or new.starts_at is distinct from old.starts_at
     or new.ends_at is distinct from old.ends_at
     or new.recurrence is distinct from old.recurrence
     or new.recurrence_weekdays is distinct from old.recurrence_weekdays
     or new.recurrence_until is distinct from old.recurrence_until
     or new.escort_member_id is distinct from old.escort_member_id then
    raise exception 'imported events change only on their calendar' using errcode = '42501';
  end if;

  if new.visibility is distinct from old.visibility then
    if new.visibility = 'household' and private.is_private_imported_event(old.id) then
      raise exception 'an event private on its calendar is never shown to everyone' using errcode = '42501';
    end if;
    perform private.mark_imported_visibility_overridden(old.id);
  end if;

  return new;
end;
$$;

-- Named so that it fires after events_before_update (alphabetical order): the author check
-- and the normalisation come first.
create trigger events_guard_imported
  before update or delete on public.events
  for each row execute function private.events_guard_imported();

-- Nobody adds people to an imported event (#34 §7: without participants nor escort).
create or replace function private.event_members_guard_imported()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') and private.is_imported_event(new.event_id) then
    raise exception 'nobody can be added to an imported event' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger event_members_guard_imported
  before insert on public.event_members
  for each row execute function private.event_members_guard_imported();

-- ---------------------------------------------------------------------------
-- «Anche su»: what has to change at the provider (#34 §16)
-- ---------------------------------------------------------------------------

-- An event sent with «Anche su» changes title, place, times or repetition (also of one
-- occurrence): one «update» for the synchronisation service, unless one is already
-- pending (or the creation is still pending: it reads the latest values).
-- Security definer: the outbox is not writable by the app.
create or replace function private.queue_sent_event_update(p_event_id uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.calendar_outbox (household_id, calendar_id, action, event_id, provider_event_id)
  select l.household_id, l.calendar_id, 'update', l.event_id, l.provider_event_id
  from public.event_external_links l
  where l.event_id = p_event_id
    and l.origin = 'sent'
  on conflict (event_id) where event_id is not null do nothing;
$$;

create or replace function private.events_queue_sent_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.queue_sent_event_update(new.id);
  return null;
end;
$$;

create trigger events_queue_sent_update
  after update of title, location, starts_at, ends_at, recurrence, recurrence_weekdays, recurrence_until
  on public.events
  for each row
  when (
    old.title is distinct from new.title
    or old.location is distinct from new.location
    or old.starts_at is distinct from new.starts_at
    or old.ends_at is distinct from new.ends_at
    or old.recurrence is distinct from new.recurrence
    or old.recurrence_weekdays is distinct from new.recurrence_weekdays
    or old.recurrence_until is distinct from new.recurrence_until
  )
  execute function private.events_queue_sent_update();

create or replace function private.event_exceptions_queue_sent_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.queue_sent_event_update(coalesce(new.event_id, old.event_id));
  return null;
end;
$$;

create trigger event_exceptions_queue_sent_update
  after insert or update or delete on public.event_exceptions
  for each row execute function private.event_exceptions_queue_sent_update();

-- An event sent with «Anche su» is deleted in FamilyNest: its copy is deleted at the
-- provider (only the id at the provider is kept). Not when its calendar or its household
-- are being deleted at the same time (calendar unlinked, household deleted): then the copy
-- stays at the provider, as for every unlinked calendar.
create or replace function private.events_queue_sent_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.calendar_outbox (household_id, calendar_id, action, provider_event_id)
  select l.household_id, l.calendar_id, 'delete', l.provider_event_id
  from public.event_external_links l
  join public.external_calendars c on c.id = l.calendar_id
  join public.households h on h.id = l.household_id
  where l.event_id = old.id
    and l.origin = 'sent';
  return old;
end;
$$;

create trigger events_queue_sent_delete
  before delete on public.events
  for each row execute function private.events_queue_sent_delete();
