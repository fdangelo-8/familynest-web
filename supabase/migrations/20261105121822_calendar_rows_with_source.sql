-- Issue #266 (for #34 parts 1 and 2, richiesta-db point 6): the rows of the calendar say
-- where an event comes from, still in one single place for the visibility rules
-- (private.household_event_rows_for_member, LEZIONI #239), shared by the calendar, the
-- notifications and the search.
--
-- Three more columns, at the end:
-- - source_provider: the provider of the calendar an event was imported from («Google»,
--   «Outlook» label of #34 §13), only when the reader is its author; null for everybody
--   else, also on «Tutto il Nest» events (the others see it as if written in FamilyNest),
--   and for events born in FamilyNest;
-- - is_imported: the event arrived from an external calendar (read only for everybody:
--   no change of the content, no deletion); null for masked rows;
-- - counts_for_free_time: false for an imported event whose calendar does not count for
--   «Liberi insieme», or marked free at the provider, or «tutto il giorno»; true otherwise
--   (every event born in FamilyNest). Also on masked rows: it says nothing of the content.
--
-- The return type of a function cannot change with `create or replace`, so:
-- - private.household_event_rows_for_member() is dropped and created again: same arguments,
--   same rows, same order, same columns plus the three above (owner only, as before);
-- - private.household_events_for_member() and public.list_household_events() do not change
--   (they read the old columns by name: same columns as before for the pages already on
--   main and their tests);
-- - public.list_household_events_with_source() is new: the rows of list_household_events()
--   with the three columns above, for the pages of #34 part 2 (signed-in users only);
-- - private.free_together_start() (job «Liberi insieme» of 8:00, #229) reads the new rows:
--   an event that does not count for «Liberi insieme» makes nobody busy (#34 §14);
-- - public.search_household() is dropped and created again with one more column,
--   source_provider (same rule: only for the author); everything else is unchanged.

drop function private.household_event_rows_for_member(uuid, timestamptz, timestamptz);

create function private.household_event_rows_for_member(
  p_member_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  event_id uuid,
  id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  visibility public.event_visibility,
  author_member_id uuid,
  is_masked boolean,
  title text,
  location text,
  escort_member_id uuid,
  member_ids uuid[],
  recurrence public.event_recurrence,
  recurrence_weekdays smallint[],
  series_starts_at timestamptz,
  source_provider public.calendar_provider,
  is_imported boolean,
  counts_for_free_time boolean
)
language sql
stable
set search_path = ''
as $$
  with me as (
    select m.id as member_id, m.household_id
    from public.household_members m
    where m.id = p_member_id
  ),
  candidates as (
    select
      e.*,
      (
        e.author_member_id is not distinct from me.member_id
        or e.escort_member_id is not distinct from me.member_id
        or exists (
          select 1
          from public.event_members em
          where em.event_id = e.id
            and em.member_id = me.member_id
        )
      ) as involved,
      src.provider as import_provider,
      src.counts as import_counts
    from me
    join public.events e on e.household_id = me.household_id
    left join lateral (
      select
        a.provider,
        (c.counts_for_free_time and l.is_busy_on_provider) as counts
      from public.event_external_links l
      join public.external_calendars c on c.id = l.calendar_id
      join public.calendar_accounts a on a.id = c.account_id
      where l.event_id = e.id
        and l.origin = 'imported'
    ) src on true
    where (
        e.starts_at < p_to
        and (
          (e.recurrence = 'none' and e.ends_at > p_from)
          or (
            e.recurrence <> 'none'
            and (
              e.recurrence_until is null
              or e.recurrence_until >= (p_from at time zone 'Europe/Rome')::date - 8
            )
          )
        )
      )
      -- An occurrence moved into the period from far away.
      or exists (
        select 1
        from public.event_exceptions x
        where x.event_id = e.id
          and not x.is_cancelled
          and x.starts_at < p_to
          and x.ends_at > p_from
      )
  ),
  visible as (
    select
      c.*,
      -- Fail closed: anything not provably involved is treated as not involved.
      (c.visibility <> 'household' and not coalesce(c.involved, false)) as masked
    from candidates c
    where coalesce(c.involved, false) or c.visibility <> 'private'
  ),
  occurrences as (
    select
      v.*,
      o.occurrence_start,
      o.occurrence_end,
      o.is_modified,
      o.occurrence_title,
      o.occurrence_location,
      o.occurrence_escort_member_id
    from visible v
    cross join lateral private.event_occurrences(
      v.id,
      v.starts_at,
      v.ends_at,
      v.recurrence,
      v.recurrence_weekdays,
      v.recurrence_until,
      p_from,
      p_to
    ) as o (
      occurrence_date,
      occurrence_start,
      occurrence_end,
      is_modified,
      occurrence_title,
      occurrence_location,
      occurrence_notes,
      occurrence_escort_member_id
    )
  )
  select
    o.id,
    case when o.masked then null else o.id end,
    o.occurrence_start,
    o.occurrence_end,
    o.visibility,
    o.author_member_id,
    o.masked,
    case
      when o.masked then null
      when o.is_modified then o.occurrence_title
      else o.title
    end,
    case
      when o.masked then null
      when o.is_modified then o.occurrence_location
      else o.location
    end,
    case
      when o.masked then null
      when o.is_modified then o.occurrence_escort_member_id
      else o.escort_member_id
    end,
    case
      when o.masked then null
      else coalesce(
        (
          select array_agg(em.member_id order by m.created_at, m.id)
          from public.event_members em
          join public.household_members m on m.id = em.member_id
          where em.event_id = o.id
        ),
        array[]::uuid[]
      )
    end,
    case when o.masked then null else o.recurrence end,
    case when o.masked then null else o.recurrence_weekdays end,
    case when o.masked then null else o.starts_at end,
    -- Fail closed: the provider only to the author, never on a masked row.
    case
      when not o.masked and o.author_member_id is not distinct from p_member_id then o.import_provider
    end,
    case when o.masked then null else o.import_provider is not null end,
    coalesce(o.import_counts, true)
  from occurrences o
  where o.occurrence_start < p_to
    and o.occurrence_end > p_from
  order by o.occurrence_start, o.occurrence_end, o.id;
$$;

revoke execute on function private.household_event_rows_for_member(uuid, timestamptz, timestamptz)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPC: the events of the caller's household that touch a period, with the three columns
-- of the linked calendars (see the header). Same arguments, checks, errors, rows and order
-- as public.list_household_events() (#229), which does not change (its columns are used by
-- the pages and their tests as they are): both read the same private rows, so the rules
-- live in one place. The pages of #34 part 2 read this one. The generated types say
-- `string` and `boolean` for source_provider and is_imported, but they can be null
-- (lesson of #96).
-- ---------------------------------------------------------------------------
create function public.list_household_events_with_source(p_from timestamptz, p_to timestamptz)
returns table (
  id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  visibility public.event_visibility,
  author_member_id uuid,
  is_masked boolean,
  title text,
  location text,
  escort_member_id uuid,
  member_ids uuid[],
  source_provider public.calendar_provider,
  is_imported boolean,
  counts_for_free_time boolean
)
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
    raise exception 'permission denied for function list_household_events_with_source' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or not isfinite(p_from) or not isfinite(p_to) or p_to <= p_from then
    raise exception 'invalid period' using errcode = '22023';
  end if;
  if (p_to at time zone 'Europe/Rome') - (p_from at time zone 'Europe/Rome') > interval '42 days' then
    raise exception 'the period cannot last more than 42 days' using errcode = '22023';
  end if;

  select m.id into v_member_id
  from public.household_members m
  where m.user_id = (select auth.uid());

  if v_member_id is null then
    return;
  end if;

  return query
    select
      r.id,
      r.starts_at,
      r.ends_at,
      r.visibility,
      r.author_member_id,
      r.is_masked,
      r.title,
      r.location,
      r.escort_member_id,
      r.member_ids,
      r.source_provider,
      r.is_imported,
      r.counts_for_free_time
    from private.household_event_rows_for_member(v_member_id, p_from, p_to) as r
    order by r.starts_at, r.ends_at, r.event_id;
end;
$$;

revoke execute on function public.list_household_events_with_source(timestamptz, timestamptz) from public, anon;
grant execute on function public.list_household_events_with_source(timestamptz, timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- «Liberi insieme» of one evening as one member sees it (new version of #229, same
-- arguments and result, same rules) with one more rule (#34 §14): an event that does not
-- count for «Liberi insieme» (counts_for_free_time false) makes nobody busy, for every
-- reader. It still counts as «something visible in that week». `create or replace` keeps
-- the owner and the privileges (owner only).
-- ---------------------------------------------------------------------------
create or replace function private.free_together_start(p_member_id uuid, p_day date)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  with bounds as (
    select
      ((p_day - (extract(isodow from p_day)::integer - 1))::timestamp at time zone 'Europe/Rome') as week_from,
      ((p_day - (extract(isodow from p_day)::integer - 1) + 7)::timestamp at time zone 'Europe/Rome') as week_to,
      ((p_day + time '18:00') at time zone 'Europe/Rome') as evening_from,
      ((p_day + time '23:00') at time zone 'Europe/Rome') as evening_to
  ),
  adults as (
    select a.id
    from public.household_members me
    join public.household_members a on a.household_id = me.household_id and a.kind = 'adult'
    where me.id = p_member_id
  ),
  seen as (
    select s.*
    from bounds b
    cross join lateral private.household_event_rows_for_member(p_member_id, b.week_from, b.week_to) s
  ),
  busy as (
    select tstzrange(greatest(s.starts_at, b.evening_from), least(s.ends_at, b.evening_to)) as span
    from seen s
    cross join bounds b
    where s.starts_at < b.evening_to
      and s.ends_at > b.evening_from
      and s.counts_for_free_time
      and exists (
        select 1
        from adults a
        where case
          when s.is_masked then s.author_member_id = a.id
          when s.visibility = 'private' then false
          else a.id = any (s.member_ids)
            or s.escort_member_id is not distinct from a.id
            or (s.visibility = 'busy' and s.author_member_id is not distinct from a.id)
        end
      )
  ),
  free as (
    select f.span
    from bounds b
    cross join lateral unnest(
      tstzmultirange(tstzrange(b.evening_from, b.evening_to))
      - coalesce((select range_agg(x.span) from busy x), '{}'::tstzmultirange)
    ) as f (span)
  )
  select lower(f.span)
  from free f
  where (select count(*) from adults) >= 2
    and exists (select 1 from seen)
    and upper(f.span) - lower(f.span) >= interval '60 minutes'
  order by upper(f.span) - lower(f.span) desc, lower(f.span)
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- RPC: search the caller's household (page #40). Same arguments, rules, rows and order as
-- the version of #230 (migration search_household_function), one more column at the end:
-- source_provider, the provider of an imported event, only for its author (null for every
-- other row and reader). The generated types say `string`, but it can be null (lesson of
-- #96).
-- ---------------------------------------------------------------------------
drop function public.search_household(text, uuid, date, date, public.search_result_kind[]);

create function public.search_household(
  p_text text default null,
  p_member_id uuid default null,
  p_from date default null,
  p_to date default null,
  p_kinds public.search_result_kind[] default null
)
returns table (
  kind public.search_result_kind,
  sort_index integer,
  id uuid,
  title text,
  starts_at timestamptz,
  ends_at timestamptz,
  occurrence_day date,
  visibility public.event_visibility,
  is_masked boolean,
  author_member_id uuid,
  member_ids uuid[],
  escort_member_id uuid,
  location text,
  recurrence public.event_recurrence,
  recurrence_weekdays smallint[],
  series_starts_on date,
  due_date date,
  is_private boolean,
  assignee_member_id uuid,
  for_member_id uuid,
  quantity text,
  source_provider public.calendar_provider
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  -- Limits of issue #40 (§6 and domanda 7).
  c_max_rows constant integer := 20;
  c_max_per_series constant integer := 3;
  c_max_text_length constant integer := 100;
  c_min_text_length constant integer := 2;
  c_max_period_days constant integer := 400;
  c_default_days constant interval := interval '365 days';
  v_member_id uuid;
  v_household_id uuid;
  v_words text[];
  v_has_text boolean;
  v_has_period boolean;
  v_kinds public.search_result_kind[];
  v_from timestamptz;
  v_to timestamptz;
begin
  -- Before reading anything (the text must never travel in a URL).
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  if (select auth.uid()) is null then
    raise exception 'permission denied for function search_household' using errcode = '42501';
  end if;

  -- Arguments. The messages never contain what the user wrote.
  if p_text is not null and char_length(p_text) > c_max_text_length then
    raise exception 'the text cannot be longer than 100 characters' using errcode = '22023';
  end if;
  v_words := array(
    select w.word
    from regexp_split_to_table(private.search_normalize(p_text), '\s+') as w (word)
    where w.word <> ''
  );
  v_has_text := cardinality(v_words) > 0;
  if v_has_text and char_length(array_to_string(v_words, '')) < c_min_text_length then
    raise exception 'the text needs at least 2 characters' using errcode = '22023';
  end if;

  if (p_from is null) <> (p_to is null) then
    raise exception 'the period needs a start and an end' using errcode = '22023';
  end if;
  v_has_period := p_from is not null;
  if v_has_period then
    if not isfinite(p_from) or not isfinite(p_to) or p_to < p_from then
      raise exception 'invalid period' using errcode = '22023';
    end if;
    if p_to - p_from + 1 > c_max_period_days then
      raise exception 'the period cannot last more than 400 days' using errcode = '22023';
    end if;
  end if;

  if not v_has_text and p_member_id is null and not v_has_period then
    raise exception 'nothing to search' using errcode = '22023';
  end if;

  if p_kinds is not null and array_position(p_kinds, null) is not null then
    raise exception 'kinds cannot be null' using errcode = '22023';
  end if;
  v_kinds := coalesce(p_kinds, enum_range(null::public.search_result_kind));

  -- The household is always the caller's (one household per account).
  select m.id, m.household_id into v_member_id, v_household_id
  from public.household_members m
  where m.user_id = (select auth.uid());

  if v_household_id is null then
    return;
  end if;

  -- A person who is not a member of the caller's household: no rows, no error.
  if p_member_id is not null and not exists (
    select 1
    from public.household_members m
    where m.id = p_member_id
      and m.household_id = v_household_id
  ) then
    return;
  end if;

  -- -------------------------------------------------------------------------
  -- Events
  -- -------------------------------------------------------------------------
  if 'event' = any (v_kinds) then
    if v_has_period then
      v_from := p_from::timestamp at time zone 'Europe/Rome';
      v_to := (p_to + 1)::timestamp at time zone 'Europe/Rome';
    else
      v_from := now();
      v_to := now() + c_default_days;
    end if;

    return query
      with base as (
        -- The rows of the calendar as the caller sees it: the visibility rules live only in
        -- private.household_event_rows_for_member(), shared with list_household_events()
        -- and the notifications. Masked rows arrive there already without title, place,
        -- participants, escort and repetition. With a text they are dropped here, before
        -- any comparison, any limit and any count.
        select r.*
        from private.household_event_rows_for_member(v_member_id, v_from, v_to) as r
        where not (v_has_text and r.is_masked)
      ),
      matched as (
        select b.*
        from base b
        where (
            not v_has_text
            or case
              when b.is_masked then false
              else private.search_matches(b.title, v_words)
            end
          )
          and (
            p_member_id is null
            or b.author_member_id = p_member_id
            or (
              not b.is_masked
              and (b.escort_member_id = p_member_id or p_member_id = any (b.member_ids))
            )
          )
      ),
      per_series as (
        select
          m.*,
          row_number() over (
            partition by m.event_id
            order by m.starts_at, m.ends_at
          ) as series_rank
        from matched m
      ),
      ranked as (
        select
          p.*,
          row_number() over (order by p.starts_at, p.ends_at, p.event_id) as rank_in_kind
        from per_series p
        where p.series_rank <= c_max_per_series
      )
      select
        'event'::public.search_result_kind,
        r.rank_in_kind::integer,
        r.id,
        r.title,
        r.starts_at,
        r.ends_at,
        (r.starts_at at time zone 'Europe/Rome')::date,
        -- Masked rows: only start, end, day and author (and is_masked).
        case when r.is_masked then null else r.visibility end,
        r.is_masked,
        r.author_member_id,
        r.member_ids,
        r.escort_member_id,
        r.location,
        r.recurrence,
        r.recurrence_weekdays,
        (r.series_starts_at at time zone 'Europe/Rome')::date,
        null::date,
        null::boolean,
        null::uuid,
        null::uuid,
        null::text,
        -- Only for the author (already null for everybody else in the rows).
        r.source_provider
      from ranked r
      where r.rank_in_kind <= c_max_rows
      order by r.rank_in_kind;
  end if;

  -- -------------------------------------------------------------------------
  -- Deadlines: all, also past ones; «Solo io» only of the caller.
  -- -------------------------------------------------------------------------
  if 'deadline' = any (v_kinds) then
    return query
      select
        'deadline'::public.search_result_kind,
        (row_number() over (order by d.due_date, d.created_at, d.id))::integer,
        d.id,
        d.title,
        null::timestamptz,
        null::timestamptz,
        null::date,
        null::public.event_visibility,
        false,
        d.created_by_member_id,
        null::uuid[],
        null::uuid,
        null::text,
        null::public.event_recurrence,
        null::smallint[],
        null::date,
        d.due_date,
        d.is_private,
        d.assignee_member_id,
        d.for_member_id,
        null::text,
        null::public.calendar_provider
      from public.deadlines d
      where d.household_id = v_household_id
        and (not d.is_private or d.created_by_member_id = v_member_id)
        and (not v_has_period or d.due_date between p_from and p_to)
        and (p_member_id is null or d.assignee_member_id = p_member_id or d.for_member_id = p_member_id)
        and (not v_has_text or private.search_matches(d.title, v_words))
      order by d.due_date, d.created_at, d.id
      limit c_max_rows;
  end if;

  -- -------------------------------------------------------------------------
  -- Things to do: only to do; «Solo io» only of the caller.
  -- -------------------------------------------------------------------------
  if 'todo' = any (v_kinds) then
    return query
      select
        'todo'::public.search_result_kind,
        (row_number() over (order by t.due_date nulls last, t.created_at, t.id))::integer,
        t.id,
        t.title,
        null::timestamptz,
        null::timestamptz,
        null::date,
        null::public.event_visibility,
        false,
        t.created_by_member_id,
        null::uuid[],
        null::uuid,
        null::text,
        null::public.event_recurrence,
        null::smallint[],
        null::date,
        t.due_date,
        t.is_private,
        t.assignee_member_id,
        t.for_member_id,
        null::text,
        null::public.calendar_provider
      from public.todos t
      where t.household_id = v_household_id
        and t.done_at is null
        and (not t.is_private or t.created_by_member_id = v_member_id)
        and (not v_has_period or t.due_date between p_from and p_to)
        and (p_member_id is null or t.assignee_member_id = p_member_id or t.for_member_id = p_member_id)
        and (not v_has_text or private.search_matches(t.title, v_words))
      order by t.due_date nulls last, t.created_at, t.id
      limit c_max_rows;
  end if;

  -- -------------------------------------------------------------------------
  -- Shopping items: only to buy; never with a person or a period.
  -- -------------------------------------------------------------------------
  if 'shopping_item' = any (v_kinds) and p_member_id is null and not v_has_period then
    return query
      select
        'shopping_item'::public.search_result_kind,
        (row_number() over (order by s.created_at, s.id))::integer,
        s.id,
        s.name,
        null::timestamptz,
        null::timestamptz,
        null::date,
        null::public.event_visibility,
        false,
        null::uuid,
        null::uuid[],
        null::uuid,
        null::text,
        null::public.event_recurrence,
        null::smallint[],
        null::date,
        null::date,
        null::boolean,
        null::uuid,
        null::uuid,
        s.quantity,
        null::public.calendar_provider
      from public.shopping_items s
      where s.household_id = v_household_id
        and s.checked_at is null
        and private.search_matches(s.name, v_words)
      order by s.created_at, s.id
      limit c_max_rows;
  end if;
end;
$$;

revoke execute on function public.search_household(
  text, uuid, date, date, public.search_result_kind[]
) from public, anon;
grant execute on function public.search_household(
  text, uuid, date, date, public.search_result_kind[]
) to authenticated;
