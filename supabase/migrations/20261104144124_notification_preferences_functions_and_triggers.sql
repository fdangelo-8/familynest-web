-- Issue #217: functions and triggers of the notification preferences (page #41).
--
-- Conventions (same as space_interests, #216):
-- - every function has `set search_path = ''` and fully qualified names;
-- - every function here is `security invoker`: the page only touches the row of its own
--   member, which RLS already allows. The member of the caller comes from
--   private.current_member_id(), the household from public.current_household_id();
-- - the guard trigger checks `current_user`: the Data API roles (authenticated, anon) get
--   the checks that depend on the caller, while statements run by the database owner
--   (foreign key actions, seed, tests set up as postgres) are trusted. The «adult with an
--   account» rule applies to every role.
-- Execute grants are set in the notification_preferences_policies_and_grants migration.
--
-- Errors:
-- - 42501: no signed-in user, or the caller has no household (or no privilege);
-- - 23514: the member is not an adult with an account of the household (trusted roles
--   only: the API roles always write for themselves);
-- - 22004: a null argument (set_notification_preference);
-- - 23505: a direct insert when the member already has a row (set_notification_preference
--   never gets it);
-- - P0001 'use POST': set_notification_preference called through the Data API with a
--   method other than POST (lesson of #112).

-- ---------------------------------------------------------------------------
-- Before insert:
-- - API roles: the household and the member are always those of the caller (the app
--   never chooses them, and has no insert privilege on those columns anyway);
-- - every role: the member is an adult with an account of the household.
-- ---------------------------------------------------------------------------
create or replace function private.notification_preferences_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_household_id uuid;
  v_member_id uuid;
begin
  if current_user in ('authenticated', 'anon') then
    v_household_id := (select public.current_household_id());
    v_member_id := (select private.current_member_id());
    if v_household_id is null or v_member_id is null then
      raise exception 'new row violates row-level security policy for table "notification_preferences"'
        using errcode = '42501';
    end if;

    new.household_id := v_household_id;
    new.member_id := v_member_id;
  end if;

  if not exists (
    select 1
    from public.household_members m
    where m.id = new.member_id
      and m.household_id = new.household_id
      and m.kind = 'adult'
      and m.user_id is not null
  ) then
    raise exception 'only adults with an account of the household have notification preferences'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger notification_preferences_before_insert
  before insert on public.notification_preferences
  for each row execute function private.notification_preferences_before_insert();

create trigger notification_preferences_set_updated_at
  before update on public.notification_preferences
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RPC (read): the five choices of the caller, in one row. When the caller never chose
-- anything (no row), the defaults: all on, «Spesa» off. Never writes (CA-15).
-- No row at all when the caller has no household.
-- The defaults here are the same as the defaults of the columns (pgTAP checks both).
-- ---------------------------------------------------------------------------
create or replace function public.get_notification_preferences()
returns table (
  events boolean,
  assigned_todos boolean,
  shopping boolean,
  free_together boolean,
  morning_digest boolean
)
language sql
stable
set search_path = ''
as $$
  select
    coalesce(p.events, true),
    coalesce(p.assigned_todos, true),
    coalesce(p.shopping, false),
    coalesce(p.free_together, true),
    coalesce(p.morning_digest, true)
  from (select private.current_member_id() as member_id) c
  left join public.notification_preferences p on p.member_id = c.member_id
  where c.member_id is not null;
$$;

-- ---------------------------------------------------------------------------
-- RPC (write): one switch of the caller. Receives only which notification and on/off;
-- household and member are set by the before insert trigger.
-- - First switch ever: the row is created with the defaults, then the choice is applied.
-- - Only the column of the touched switch changes: two switches touched at the same time
--   never undo each other (the update re-reads the row it waited for).
-- - Setting the value it already has changes nothing visible and gives no error.
-- ---------------------------------------------------------------------------
create or replace function public.set_notification_preference(
  p_preference public.notification_preference,
  p_enabled boolean
)
returns void
language plpgsql
volatile
set search_path = ''
as $$
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  if p_preference is null or p_enabled is null then
    raise exception 'preference and value are required' using errcode = '22004';
  end if;

  -- Raises 42501 (before insert trigger) when the caller has no household.
  insert into public.notification_preferences default values
  on conflict (member_id) do nothing;

  update public.notification_preferences p
  set
    events = case when p_preference = 'events' then p_enabled else p.events end,
    assigned_todos = case when p_preference = 'assigned_todos' then p_enabled else p.assigned_todos end,
    shopping = case when p_preference = 'shopping' then p_enabled else p.shopping end,
    free_together = case when p_preference = 'free_together' then p_enabled else p.free_together end,
    morning_digest = case when p_preference = 'morning_digest' then p_enabled else p.morning_digest end
  where p.member_id = (select private.current_member_id());
end;
$$;
