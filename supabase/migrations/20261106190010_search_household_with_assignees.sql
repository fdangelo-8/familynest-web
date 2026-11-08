-- Issue #337 (spec 333 §6.9): the search of the household (page #40) with several people
-- per thing.
-- Same arguments, checks, errors, rows and order as the version of #266 (migration
-- calendar_rows_with_source), with two changes:
-- - the filter by person (p_member_id) finds a deadline or a thing to do when the person
--   is ANY of its people (deadline_assignees, todo_assignees), or «riguarda» / «per chi»
--   as before;
-- - one more column at the end, assignee_member_ids: the people of a deadline, a thing to
--   do or a thing to buy, in their order (earliest link first, at equal time the order of
--   the members); null for events. assignee_member_id stays (the first person, the
--   compatibility column) for the page already on main.
-- The return type of a function cannot change with `create or replace`: dropped and
-- created again, with the same grants. The generated types say `string[]`, but it can be
-- null (lesson of #96).

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
  source_provider public.calendar_provider,
  assignee_member_ids uuid[]
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
        r.source_provider,
        null::uuid[]
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
        null::public.calendar_provider,
        coalesce(
          (
            select array_agg(a.member_id order by a.created_at, m.created_at, m.id)
            from public.deadline_assignees a
            join public.household_members m on m.id = a.member_id
            where a.deadline_id = d.id
          ),
          array[]::uuid[]
        )
      from public.deadlines d
      where d.household_id = v_household_id
        and (not d.is_private or d.created_by_member_id = v_member_id)
        and (not v_has_period or d.due_date between p_from and p_to)
        and (
          p_member_id is null
          or d.for_member_id = p_member_id
          or exists (
            select 1
            from public.deadline_assignees a
            where a.deadline_id = d.id
              and a.member_id = p_member_id
          )
        )
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
        null::public.calendar_provider,
        coalesce(
          (
            select array_agg(a.member_id order by a.created_at, m.created_at, m.id)
            from public.todo_assignees a
            join public.household_members m on m.id = a.member_id
            where a.todo_id = t.id
          ),
          array[]::uuid[]
        )
      from public.todos t
      where t.household_id = v_household_id
        and t.done_at is null
        and (not t.is_private or t.created_by_member_id = v_member_id)
        and (not v_has_period or t.due_date between p_from and p_to)
        and (
          p_member_id is null
          or t.for_member_id = p_member_id
          or exists (
            select 1
            from public.todo_assignees a
            where a.todo_id = t.id
              and a.member_id = p_member_id
          )
        )
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
        null::public.calendar_provider,
        coalesce(
          (
            select array_agg(a.member_id order by a.created_at, m.created_at, m.id)
            from public.shopping_item_assignees a
            join public.household_members m on m.id = a.member_id
            where a.shopping_item_id = s.id
          ),
          array[]::uuid[]
        )
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
