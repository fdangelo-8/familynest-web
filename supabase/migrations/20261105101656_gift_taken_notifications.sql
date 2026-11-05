-- Issue #259 (for page #32 §10 and #39): the «Regalo preso» notification (gift_taken).
--
-- - notifications.wishlist_reservation_id: the reservation of origin, through a composite
--   foreign key with household_id (never a reservation of another household), on delete
--   cascade: the notification goes with the reservation (idea deleted, cleanup 30 days
--   after the occasion, child removed, household deleted);
-- - notifications_kind_fields: a gift_taken notification has only the reservation (no
--   person who acted: the giver has no account), every other kind never has it;
-- - private.notification_is_visible() takes the reservation too: a gift_taken notification
--   is shown and counted only while the reader can read its reservation (RLS of
--   wishlist_reservations). The select policy of notifications is created again with it;
-- - a trigger on the insertion of a reservation writes one notification for every adult
--   with an account of the household of the child. Always on: no switch in
--   notification_preferences (decision of the coordinator, #32 §10).
-- Like every other notification, it stores only references: the name of the giver, the
-- title of the idea and the name of the child are read by the page with the permissions of
-- the reader when it opens. The daily cleanup of the notifications (30 days) applies too.

-- ---------------------------------------------------------------------------
-- Column, foreign key, index
-- ---------------------------------------------------------------------------
alter table public.notifications
  add column wishlist_reservation_id uuid;

alter table public.notifications
  add constraint notifications_wishlist_reservation_fkey
    foreign key (wishlist_reservation_id, household_id)
    references public.wishlist_reservations (id, household_id) on delete cascade;

create index notifications_wishlist_reservation_id_idx
  on public.notifications (wishlist_reservation_id) where wishlist_reservation_id is not null;

-- ---------------------------------------------------------------------------
-- Exactly the fields of each kind, nothing else (same rule as before, plus gift_taken).
-- ---------------------------------------------------------------------------
alter table public.notifications
  drop constraint notifications_kind_fields;

alter table public.notifications
  add constraint notifications_kind_fields check (
    case kind
      when 'todo_assigned' then
        actor_member_id is not null and todo_id is not null
        and num_nonnulls(deadline_id, event_id, occurrence_date, days_before, evening_date, free_from, item_count,
                         wishlist_reservation_id) = 0
      when 'deadline_reminder' then
        deadline_id is not null and days_before is not null
        and num_nonnulls(actor_member_id, todo_id, event_id, occurrence_date, evening_date, free_from, item_count,
                         wishlist_reservation_id) = 0
      when 'free_together' then
        evening_date is not null and free_from is not null
        and num_nonnulls(actor_member_id, todo_id, deadline_id, event_id, occurrence_date, days_before, item_count,
                         wishlist_reservation_id) = 0
      when 'event_time_changed' then
        actor_member_id is not null and event_id is not null
        and num_nonnulls(todo_id, deadline_id, days_before, evening_date, free_from, item_count,
                         wishlist_reservation_id) = 0
      when 'shopping_added' then
        actor_member_id is not null and item_count is not null
        and num_nonnulls(todo_id, deadline_id, event_id, occurrence_date, days_before, evening_date, free_from,
                         wishlist_reservation_id) = 0
      when 'gift_taken' then
        wishlist_reservation_id is not null
        and num_nonnulls(actor_member_id, todo_id, deadline_id, event_id, occurrence_date, days_before,
                         evening_date, free_from, item_count) = 0
      else false
    end
  );

-- One notification per reservation and recipient.
create unique index notifications_gift_taken_key
  on public.notifications (recipient_member_id, wishlist_reservation_id)
  where kind = 'gift_taken';

-- ---------------------------------------------------------------------------
-- What the reader may see: same rules as 20261104200005 for the five kinds of #39, plus
-- gift_taken (the reservation exists and the reader sees it). Security invoker: the reads
-- go through the RLS of the reader. The select policy of notifications is the only user;
-- it is created again below with the new function, then the old one is dropped.
-- ---------------------------------------------------------------------------
create or replace function private.notification_is_visible(
  p_kind public.notification_kind,
  p_todo_id uuid,
  p_deadline_id uuid,
  p_event_id uuid,
  p_occurrence_date date,
  p_wishlist_reservation_id uuid
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select case p_kind
    when 'todo_assigned' then exists (
      select 1 from public.todos t where t.id = p_todo_id
    )
    when 'deadline_reminder' then exists (
      select 1 from public.deadlines d where d.id = p_deadline_id
    )
    when 'event_time_changed' then exists (
      select 1
      from public.events e
      where e.id = p_event_id
        and (
          p_occurrence_date is null
          or (
            e.recurrence <> 'none'
            and private.event_has_occurrence_on(
              e.starts_at, e.recurrence, e.recurrence_weekdays, e.recurrence_until, p_occurrence_date
            )
            and not exists (
              select 1
              from public.event_exceptions x
              where x.event_id = e.id
                and x.occurrence_date = p_occurrence_date
                and x.is_cancelled
            )
          )
        )
    )
    when 'gift_taken' then exists (
      select 1 from public.wishlist_reservations r where r.id = p_wishlist_reservation_id
    )
    else true
  end;
$$;

revoke execute on function private.notification_is_visible(
  public.notification_kind, uuid, uuid, uuid, date, uuid
) from public, anon;
grant execute on function private.notification_is_visible(
  public.notification_kind, uuid, uuid, uuid, date, uuid
) to authenticated;

drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select to authenticated
  using (
    household_id = (select public.current_household_id())
    and recipient_member_id = (select private.current_member_id())
    and private.notification_is_visible(
      kind, todo_id, deadline_id, event_id, occurrence_date, wishlist_reservation_id
    )
  );

drop function private.notification_is_visible(public.notification_kind, uuid, uuid, uuid, date);

-- ---------------------------------------------------------------------------
-- «Regalo preso»: after a reservation is saved (by reserve_public_wishlist_item(), or by the
-- administrative key of the page tests), one notification for every adult with an account
-- of the household. Nobody acted from the household: no actor, no preference.
-- Security definer (owner: postgres): the recipients are other members, whose rows the
-- caller cannot write.
-- ---------------------------------------------------------------------------
create or replace function private.wishlist_reservations_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (household_id, recipient_member_id, kind, wishlist_reservation_id)
  select new.household_id, m.id, 'gift_taken', new.id
  from public.household_members m
  where m.household_id = new.household_id
    and m.kind = 'adult'
    and m.user_id is not null
  order by m.id
  on conflict do nothing;

  return null;
end;
$$;

create trigger wishlist_reservations_notify
  after insert on public.wishlist_reservations
  for each row execute function private.wishlist_reservations_notify();

revoke execute on function private.wishlist_reservations_notify() from public, anon, authenticated;
