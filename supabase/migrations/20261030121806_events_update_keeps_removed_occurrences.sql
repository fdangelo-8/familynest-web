-- Issue #122 (for page #19 Dettaglio impegno): «Salva tutti i prossimi» that changes the
-- rule of the repetition («Si ripete») no longer brings back the occurrences removed with
-- «Elimina solo questo». Decision of Francesco of 30/10: «le ripetizioni tolte restano
-- tolte»; changed occurrences take the new values, as before.
--
-- New version of public.update_event() (PR #120, migration
-- events_exceptions_functions_and_triggers): same arguments, same result, same rules.
-- Only the removed occurrences of a new rule change:
-- - before: they were all dropped (the series started again);
-- - now: a removed occurrence stays removed when its day (Europe/Rome) is still a day of
--   the new rule, on the same day (no shift: the user removed that date). The others are
--   dropped (they are no longer occurrences: nothing left to hide). The day on which the
--   opened occurrence starts now is never kept removed: the user has just saved it.
--
-- `create or replace` keeps the owner and the execute grants of PR #120 (signed-in users
-- only, never anon). Still security invoker, with an empty search_path, «solo POST».

-- ---------------------------------------------------------------------------
-- RPC: change a whole event, or a repeated event from one occurrence on («Salva tutti
-- i prossimi»), in one transaction. Every argument is the new value (the complete form):
-- nothing is kept from before unless the app sends it again.
--
-- p_day is the occurrence the user opened (occurrence_date of get_event_occurrence, not
-- the day of the address: they differ for an occurrence moved to another day):
-- - null, the first occurrence, or an event that does not repeat: the whole event
--   changes;
-- - a later occurrence: the series is split there (private.split_event_series): the
--   occurrences before stay as they were, the new values apply from p_day on, to a new
--   event. When the occurrences before p_day were all removed, the old part has nothing
--   left and is deleted (it would keep title, place and notes, invisible to everyone).
--
-- How the new series is placed (the app sends the form as the user sees it):
-- - the shift is measured on the form: shift = day of p_starts_at - day on which the
--   opened occurrence starts now (its own start when it was moved, see starts_at of
--   get_event_occurrence). The app sends the days of the week moved by the same shift
--   («Ogni martedì e giovedì» moved by one day = {3,5}; unchanged when the day is not
--   changed);
-- - same rule (same repetition and, for weekly, the old days of the week moved by the
--   shift): the series keeps its rhythm and starts on p_day + shift, at the time of
--   p_starts_at, lasting p_ends_at - p_starts_at. For an occurrence that was not moved
--   this is exactly p_starts_at; for a moved one, the series does not follow the one-off
--   move (a Tuesday moved to Saturday, saved «tutti i prossimi» without changing the day,
--   goes back to Tuesday with the new values). So the start is always a day of the rule
--   and events_weekdays_include_start cannot fail for a form sent this way;
-- - a new rule: the series starts again from p_starts_at as sent.
-- Exceptions of the changed part (decision of Francesco of 30/10):
-- - changed occurrences take the new values (their own values are dropped);
-- - removed occurrences stay removed:
--   - same rule: moved by the shift (removed Thursday 29 of a series moved by one day
--     becomes Friday 30);
--   - a new rule (issue #122): on the same day, when that day is still an occurrence of
--     the new rule («Ogni martedì e giovedì» that becomes «Ogni martedì»: a removed
--     Tuesday stays removed, a removed Thursday is dropped). Never the day on which the
--     opened occurrence starts now. An event that does not repeat any more has none.
-- Participants: those of p_member_ids are added (RLS: only the author adds people to a
-- «Solo io» or «Occupato» event), the others removed.
--
-- Returns one row: id = the event that now holds the opened occurrence (a new id after a
-- split), day = the day (Europe/Rome) on which that occurrence starts now (for ?giorno=).
-- ---------------------------------------------------------------------------
create or replace function public.update_event(
  p_event_id uuid,
  p_day date,
  p_title text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_visibility public.event_visibility,
  p_member_ids uuid[],
  p_location text,
  p_escort_member_id uuid,
  p_recurrence public.event_recurrence,
  p_recurrence_weekdays smallint[],
  p_recurrence_until date,
  p_notes text
)
returns table (id uuid, day date)
language plpgsql
volatile
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_event public.events;
  v_day date;
  v_target uuid;
  v_open_start timestamptz;
  v_delta integer := 0;
  v_same_rule boolean := false;
  v_new_start timestamptz := p_starts_at;
  v_cancelled date[] := array[]::date[];
  v_changed public.events;
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  if p_member_ids is null or array_position(p_member_ids, null) is not null then
    raise exception 'invalid participants' using errcode = '22023';
  end if;

  -- RLS: only an event the caller sees in full (and may therefore change).
  select e.* into v_event
  from public.events e
  where e.id = p_event_id
  for update;

  if not found then
    raise exception 'event not found' using errcode = 'P0002';
  end if;

  if p_day is not null and (
    not private.event_has_occurrence_on(
      v_event.starts_at, v_event.recurrence, v_event.recurrence_weekdays, v_event.recurrence_until, p_day
    )
    or (
      v_event.recurrence <> 'none'
      and exists (
        select 1
        from public.event_exceptions x
        where x.event_id = p_event_id
          and x.occurrence_date = p_day
          and x.is_cancelled
      )
    )
  ) then
    raise exception 'event not found' using errcode = 'P0002';
  end if;

  -- The opened occurrence: its day in the series and where it starts now.
  v_day := coalesce(p_day, (v_event.starts_at at time zone 'Europe/Rome')::date);
  v_open_start := coalesce(
    (
      select x.starts_at
      from public.event_exceptions x
      where v_event.recurrence <> 'none'
        and x.event_id = p_event_id
        and x.occurrence_date = v_day
        and not x.is_cancelled
    ),
    (v_day + (v_event.starts_at at time zone 'Europe/Rome')::time) at time zone 'Europe/Rome'
  );

  if v_day <= (v_event.starts_at at time zone 'Europe/Rome')::date then
    v_target := p_event_id;
  else
    v_target := private.split_event_series(p_event_id, v_day);

    -- The old part may have nothing left (every occurrence before v_day removed).
    if not private.event_has_remaining_occurrence(p_event_id) then
      delete from public.events e
      where e.id = p_event_id;
    end if;
  end if;

  if v_event.recurrence <> 'none' then
    v_delta := (p_starts_at at time zone 'Europe/Rome')::date - (v_open_start at time zone 'Europe/Rome')::date;
    v_same_rule := coalesce(
      p_recurrence = v_event.recurrence
      and (
        p_recurrence <> 'weekly'
        or (
          select array_agg(d order by d)
          from (select distinct w as d from unnest(p_recurrence_weekdays) as w) s
        ) = (
          select array_agg(d order by d)
          from (
            select distinct ((((w - 1 + v_delta) % 7) + 7) % 7 + 1)::smallint as d
            from unnest(v_event.recurrence_weekdays) as w
          ) s
        )
      ),
      false
    );

    if v_same_rule then
      -- Keep the rhythm of the series: start on v_day + shift, at the time of the form.
      v_new_start := ((v_day + v_delta) + (p_starts_at at time zone 'Europe/Rome')::time) at time zone 'Europe/Rome';

      select coalesce(array_agg(x.occurrence_date + v_delta), array[]::date[]) into v_cancelled
      from public.event_exceptions x
      where x.event_id = v_target
        and x.is_cancelled;
    elsif p_recurrence is distinct from 'none' then
      -- A new rule (issue #122): removed days stay removed where the new rule still has
      -- an occurrence (filtered below); never the day the opened occurrence starts now,
      -- unless the opened occurrence was itself removed (only possible without p_day:
      -- the whole event changed from its first occurrence, which stays as it was).
      select coalesce(array_agg(x.occurrence_date), array[]::date[]) into v_cancelled
      from public.event_exceptions x
      where x.event_id = v_target
        and x.is_cancelled
        and (
          x.occurrence_date <> (v_new_start at time zone 'Europe/Rome')::date
          or exists (
            select 1
            from public.event_exceptions o
            where o.event_id = v_target
              and o.occurrence_date = v_day
              and o.is_cancelled
          )
        );
    end if;

    delete from public.event_exceptions x
    where x.event_id = v_target;
  end if;

  update public.events e
  set
    title = p_title,
    location = p_location,
    notes = p_notes,
    starts_at = v_new_start,
    ends_at = v_new_start + (p_ends_at - p_starts_at),
    visibility = p_visibility,
    escort_member_id = p_escort_member_id,
    recurrence = p_recurrence,
    recurrence_weekdays = p_recurrence_weekdays,
    recurrence_until = p_recurrence_until
  where e.id = v_target;

  if cardinality(v_cancelled) > 0 then
    select e.* into v_changed
    from public.events e
    where e.id = v_target;

    insert into public.event_exceptions (event_id, household_id, occurrence_date, is_cancelled)
    select v_target, v_changed.household_id, d, true
    from unnest(v_cancelled) as d
    where v_changed.recurrence <> 'none'
      and private.event_has_occurrence_on(
        v_changed.starts_at, v_changed.recurrence, v_changed.recurrence_weekdays,
        v_changed.recurrence_until, d
      );
  end if;

  -- Additions first: removing oneself from a «Solo io» or «Occupato» event of someone
  -- else ends what the caller may do on it.
  insert into public.event_members (event_id, member_id, household_id)
  select distinct v_target, m.member_id, v_event.household_id
  from unnest(p_member_ids) as m (member_id)
  where not exists (
    select 1
    from public.event_members em
    where em.event_id = v_target
      and em.member_id = m.member_id
  );

  delete from public.event_members em
  where em.event_id = v_target
    and em.member_id <> all (p_member_ids);

  return query
    select v_target, (v_new_start at time zone 'Europe/Rome')::date;
end;
$$;
