-- Issue #617 (database of A13 «Il tuo Nest», #546; decisions of Francesco of 27/11):
-- - R1 public.invite_adult():               the adult and the invitation in one step;
-- - R2 public.renew_invitation():           a new invitation of 7 days when there is no
--                                           valid one (expired or missing);
-- - R3 public.household_member_calendars(): the calendars switched on of the adults of the
--                                           household, only in the form of #546 §4;
-- - R4 public.record_invitation_mail():     the counter of the invitation mails, with the
--                                           limits; private.purge_invitation_mails() for
--                                           the pg_cron job;
-- - R5 public.accept_invitation_with_color(): in a couple, who enters organises too;
-- - R6 private.household_members_couple_guard(): in a couple, the API roles never remove
--                                           the other adult nor take a role away;
-- - public.add_household_member():          a child or a pet (with its species) in one
--                                           step (from the analysis of #618, C2).
-- The one rule «in coppia» is private.household_is_couple(), used by R5, R6 and the data
-- migration couples_become_equal.
--
-- Conventions (same as the previous migrations):
-- - every function has `set search_path = ''` and fully qualified names;
-- - the functions of the page that write are security definer (owner: postgres), take the
--   household of the session (never a household id from the client), and refuse every
--   Data API method other than POST before reading anything (lesson of #112);
-- - guard triggers are security invoker: `current_user` is the role of the statement, so
--   the API roles get the checks while the security definer functions (owner: postgres),
--   service_role, the foreign key actions and the seed are trusted. The role is checked in
--   its own statement, before any call to a private function (lesson 27).
-- Execute grants are in the il_tuo_nest_policies_and_grants migration; the functions of
-- the public schema are revoked here at once (default privileges of the schema).
--
-- Error codes (messages never contain names, tokens or other data of a household):
-- - P0001 'use POST': called through the Data API with a method other than POST;
-- - 42501: no signed-in user, a caller without household or who does not organise (R1, R2,
--   R4), an invitation or a member that is not of the caller's household (same answer
--   whether it does not exist or is of another household); in a couple, removing the other
--   adult or taking a role away (R6);
-- - 22023: invalid arguments (name null, empty or longer than 40 after the spaces are
--   reduced, colour or kind null); R2 on an adult with an account, a child or a pet; R4 on
--   an invitation that is not pending or has expired; a species for a member that is not a
--   pet, a birth date for an adult;
-- - 23505: the colour is already taken in the household (household_members_household_color_key);
-- - P0001 'household member limit reached': the household has 10 members (household_members_limit);
-- - FN010 'invitation mail limit reached': R4, 3 mails for the invitation, 20 for the
--   household or 20 for the account in the last 24 hours (FN001–FN009 are used by earlier
--   migrations).

-- ===========================================================================
-- «In coppia» (#546 §1, answer 19)
-- ===========================================================================
-- True when the household has exactly two members and both are adults with an account: no
-- child, no pet, no adult without account (with or without a pending invitation).
--
-- Security invoker, on purpose: it counts the rows the caller can read. Called by the owner
-- (R5 inside accept_invitation_with_color, the data migration) it sees every member; called
-- by an adult (the R6 guard trigger, which runs as authenticated) it sees only the members
-- of the adult's own household (household_members_select), which is the household the
-- trigger asks about. For any other household it sees no row and answers false: it tells
-- nobody anything they could not already read. For this reason it is the only new private
-- function executable by authenticated (the trigger runs as the caller).
create or replace function private.household_is_couple(p_household_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select count(*) = 2
     and count(*) filter (where m.kind = 'adult' and m.user_id is not null) = 2
  from public.household_members m
  where m.household_id = p_household_id;
$$;

-- ===========================================================================
-- R1 · invite_adult
-- ===========================================================================
-- Creates, in one transaction, an adult without account in the caller's household and the
-- pending invitation for that adult (7 days, the column default; no message). Only who
-- organises. Returns the id of the new member: the token is read afterwards with a separate
-- query on public.invitations (lesson: no reading back after a write; invitations_select
-- lets only who organises read it).
--
-- The name: spaces at the start and at the end removed, inner runs of spaces reduced to
-- one (#546 §3, decision 7 of #617); then 1 to 40 characters.
-- The limit of 10 members (P0001), the unique colour (23505), the one pending invitation per
-- member and the checks of the invitation are the ones of every insert (triggers, unique
-- constraints): nothing is written when one of them fails.
create or replace function public.invite_adult(p_name text, p_color public.member_color)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_household_id uuid;
  v_caller_member_id uuid;
  v_name text;
  v_member_id uuid;
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  if (select auth.uid()) is null then
    raise exception 'permission denied for function invite_adult' using errcode = '42501';
  end if;

  select m.household_id, m.id into v_household_id, v_caller_member_id
  from public.household_members m
  where m.user_id = (select auth.uid())
    and m.is_admin;

  if not found then
    raise exception 'permission denied for function invite_adult' using errcode = '42501';
  end if;

  v_name := btrim(regexp_replace(p_name, '\s+', ' ', 'g'));
  if v_name is null or char_length(v_name) not between 1 and 40 or p_color is null then
    raise exception 'a name of 1 to 40 characters and a colour are required' using errcode = '22023';
  end if;

  insert into public.household_members (household_id, kind, name, color)
  values (v_household_id, 'adult', v_name, p_color)
  returning id into v_member_id;

  insert into public.invitations (household_id, member_id, invited_by_member_id)
  values (v_household_id, v_member_id, v_caller_member_id);

  return v_member_id;
end;
$$;

revoke execute on function public.invite_adult(text, public.member_color)
  from public, anon, authenticated, service_role;

-- ===========================================================================
-- R2 · renew_invitation
-- ===========================================================================
-- «Manda di nuovo» / «Manda l'invito» (#546 §3), only who organises, in one transaction:
-- - the adult has a valid pending invitation: nothing changes (same link, same expiry);
-- - the pending invitation has expired: it becomes revoked and a new one of 7 days is
--   created (new token);
-- - the adult has no pending invitation (decision 2 of #617): a new one of 7 days.
-- The member is locked (`for update`) before deciding, so two calls close together never
-- create two invitations (the unique index invitations_one_pending_per_member_idx would
-- refuse the second one anyway).
-- The member must be an adult without account of the caller's household: of another
-- household or unknown → 42501 (same message); with an account, a child or a pet → 22023.
create or replace function public.renew_invitation(p_member_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_household_id uuid;
  v_caller_member_id uuid;
  v_member public.household_members%rowtype;
  v_invitation public.invitations%rowtype;
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  if (select auth.uid()) is null then
    raise exception 'permission denied for function renew_invitation' using errcode = '42501';
  end if;

  select m.household_id, m.id into v_household_id, v_caller_member_id
  from public.household_members m
  where m.user_id = (select auth.uid())
    and m.is_admin;

  if not found then
    raise exception 'permission denied for function renew_invitation' using errcode = '42501';
  end if;

  select m.* into v_member
  from public.household_members m
  where m.id = p_member_id
    and m.household_id = v_household_id
  for update;

  if not found then
    raise exception 'permission denied for function renew_invitation' using errcode = '42501';
  end if;

  if v_member.kind <> 'adult' or v_member.user_id is not null then
    raise exception 'only an adult without account can be invited' using errcode = '22023';
  end if;

  select i.* into v_invitation
  from public.invitations i
  where i.member_id = v_member.id
    and i.status = 'pending'
  for update;

  if found then
    if v_invitation.expires_at > now() then
      return;
    end if;

    update public.invitations i
    set status = 'revoked'
    where i.id = v_invitation.id;
  end if;

  insert into public.invitations (household_id, member_id, invited_by_member_id)
  values (v_household_id, v_member.id, v_caller_member_id);
end;
$$;

revoke execute on function public.renew_invitation(uuid)
  from public, anon, authenticated, service_role;

-- ===========================================================================
-- R3 · household_member_calendars
-- ===========================================================================
-- The calendars switched on (is_enabled) of the adults with an account of the caller's
-- household, for «In casa · Calendari» of #546 §4: who, which service, the name of the
-- calendar and «Chi vede questi impegni nel Nest». Nothing else: never the email of the
-- account, the ids at the provider, the credentials, the status or the synchronisation.
-- A calendar «private» of another adult does not appear at all, not even its name
-- (decision 1 of #617); the caller sees all their own. No session or no household: no row.
-- Order: members by created_at (then id), then provider, then name (then id).
-- The one place of this rule. calendar_accounts and external_calendars keep their
-- policies: each adult still reads directly only their own rows.
create or replace function public.household_member_calendars()
returns table (
  member_id uuid,
  provider public.calendar_provider,
  calendar_name text,
  visibility public.event_visibility
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.member_id, a.provider, c.name, c.visibility
  from public.external_calendars c
  join public.calendar_accounts a
    on a.id = c.account_id
   and a.household_id = c.household_id
   and a.member_id = c.member_id
  join public.household_members m
    on m.id = c.member_id
   and m.household_id = c.household_id
  where c.household_id = (select public.current_household_id())
    and c.is_enabled
    and m.kind = 'adult'
    and m.user_id is not null
    and (c.visibility <> 'private' or m.user_id = (select auth.uid()))
  order by m.created_at, m.id, a.provider, c.name, c.id;
$$;

revoke execute on function public.household_member_calendars()
  from public, anon, authenticated, service_role;

-- ===========================================================================
-- R4 · record_invitation_mail and its purge
-- ===========================================================================
-- Called by the server of the app, with the session of the adult, before it sends a mail
-- of invitation. Only who organises, only for a pending invitation not expired of the
-- caller's household. Under the limits it records the mail and returns; beyond them it
-- records nothing and gives FN010. The address is never received nor stored.
-- The limits (decision 3 of #617 and decision of the coordinator on the review of #652),
-- the constants at the top and nowhere else:
--   at most 3 mails for one invitation in the last 24 hours,
--   at most 20 mails for one household in the last 24 hours,
--   at most 20 mails sent by one account in the last 24 hours.
-- The windows are sliding. The rows are deleted only by the purge, after 48 hours (longer
-- than the window), never with their invitation, household or account: every mail of the
-- window always counts. The limit per invitation follows the id of the invitation: a new
-- invitation is a new id, and the limits per household and per account cover it.
-- Concurrency (lesson: a limit checked with a count before the insert): the mails of one
-- account and of one household are serialised by two transaction advisory locks taken
-- before counting, always in the same order (account, then household).
-- Unknown invitation or of another household → 42501 (same message).
create or replace function public.record_invitation_mail(p_invitation_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c_window constant interval := interval '24 hours';
  c_max_per_invitation constant integer := 3;
  c_max_per_household constant integer := 20;
  c_max_per_account constant integer := 20;

  v_user_id uuid := (select auth.uid());
  v_household_id uuid;
  v_invitation public.invitations%rowtype;
  v_invitation_count integer;
  v_household_count integer;
  v_account_count integer;
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  if (select auth.uid()) is null then
    raise exception 'permission denied for function record_invitation_mail' using errcode = '42501';
  end if;

  select m.household_id into v_household_id
  from public.household_members m
  where m.user_id = (select auth.uid())
    and m.is_admin;

  if not found then
    raise exception 'permission denied for function record_invitation_mail' using errcode = '42501';
  end if;

  select i.* into v_invitation
  from public.invitations i
  where i.id = p_invitation_id
    and i.household_id = v_household_id;

  if not found then
    raise exception 'permission denied for function record_invitation_mail' using errcode = '42501';
  end if;

  if v_invitation.status <> 'pending' or v_invitation.expires_at <= now() then
    raise exception 'the invitation is not valid' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('private.invitation_mails:account:' || v_user_id::text, 0));
  perform pg_advisory_xact_lock(hashtextextended('private.invitation_mails:' || v_household_id::text, 0));

  select
    count(*) filter (where x.invitation_id = v_invitation.id),
    count(*)
  into v_invitation_count, v_household_count
  from private.invitation_mails x
  where x.household_id = v_household_id
    and x.sent_at > now() - c_window;

  select count(*) into v_account_count
  from private.invitation_mails x
  where x.sender_user_id = v_user_id
    and x.sent_at > now() - c_window;

  if v_invitation_count >= c_max_per_invitation
     or v_household_count >= c_max_per_household
     or v_account_count >= c_max_per_account then
    raise exception 'invitation mail limit reached' using errcode = 'FN010';
  end if;

  insert into private.invitation_mails (household_id, invitation_id, sender_user_id)
  values (v_household_id, v_invitation.id, v_user_id);
end;
$$;

revoke execute on function public.record_invitation_mail(uuid)
  from public, anon, authenticated, service_role;

-- Deletes the mails recorded more than 48 hours before p_now, for every household (the
-- global work runs only from the pg_cron job, lesson 24). Security invoker: it runs as the
-- role that calls it, postgres for pg_cron (owner of the table). No API role can execute
-- it (grants migration). Returns how many rows it deleted.
create or replace function private.purge_invitation_mails(p_now timestamptz)
returns integer
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  delete from private.invitation_mails x
  where x.sent_at < p_now - interval '48 hours';

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

-- ===========================================================================
-- R5 · accept_invitation_with_color: in a couple, who enters organises too
-- ===========================================================================
-- Same function as 20261126142928 (signature, return type, checks, errors, locks and the
-- member_joined notifications unchanged, so `create or replace` keeps the execute
-- privileges), with one more step: once the invitee is linked to the account, if the
-- household is now «in coppia» (private.household_is_couple: the person who organises and
-- the person who enters, nobody else), the person who enters organises too (decision 4 of
-- #617). Otherwise the person enters without the role, as before. Before the check the
-- household is serialised with the advisory lock of the role rules.
create or replace function public.accept_invitation_with_color(
  p_token text,
  p_color public.member_color
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_invitation public.invitations%rowtype;
  v_current_color public.member_color;
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if p_color is null then
    raise exception 'color is required' using errcode = '22023';
  end if;

  if exists (select 1 from public.household_members m where m.user_id = v_uid) then
    raise exception 'user already belongs to a household' using errcode = 'P0001';
  end if;

  select i.* into v_invitation
  from public.invitations i
  join public.household_members m
    on m.id = i.member_id
   and m.household_id = i.household_id
  where p_token ~ '^[0-9a-f]{64}$'
    and i.token = p_token
    and i.status = 'pending'
    and i.expires_at > now()
    and m.kind = 'adult'
    and m.user_id is null
  for update of i, m;

  if not found then
    raise exception 'invalid invitation' using errcode = 'P0001';
  end if;

  select m.color into v_current_color
  from public.household_members m
  where m.id = v_invitation.member_id;

  if p_color <> v_current_color and exists (
    select 1
    from public.household_members o
    where o.household_id = v_invitation.household_id
      and o.id <> v_invitation.member_id
      and o.color = p_color
  ) then
    raise exception 'color already taken' using errcode = '23505';
  end if;

  update public.household_members m
  set user_id = v_uid,
      joined_at = now(),
      is_admin = false,
      color = p_color
  where m.id = v_invitation.member_id;

  -- #617 R5: in a couple, who enters organises too. The household is serialised with the
  -- same advisory lock as the other role rules (household_members_guard_update,
  -- household_members_after_delete, household_members_couple_guard) before the check.
  perform pg_advisory_xact_lock(hashtextextended(v_invitation.household_id::text, 0));
  if private.household_is_couple(v_invitation.household_id) then
    update public.household_members m
    set is_admin = true
    where m.id = v_invitation.member_id;
  end if;

  update public.invitations i
  set status = 'accepted',
      accepted_at = now()
  where i.id = v_invitation.id;

  insert into public.notifications (household_id, recipient_member_id, kind, actor_member_id)
  select v_invitation.household_id, m.id, 'member_joined', v_invitation.member_id
  from public.household_members m
  where m.household_id = v_invitation.household_id
    and m.id <> v_invitation.member_id
    and m.kind = 'adult'
    and m.user_id is not null
  order by m.id
  on conflict do nothing;

  return v_invitation.household_id;
end;
$$;

-- ===========================================================================
-- R6 · in a couple, no «Togli» and no role taken away (answer 19)
-- ===========================================================================
-- Before delete, and before an update that takes the role away (is_admin true → false), of
-- a member, for the API roles only:
-- - removing oneself («Esci dalla casa», A19) is always allowed, as today;
-- - in a couple, removing the other adult, or taking the role away from anyone, gives 42501
--   and nothing changes.
-- Giving the role (false → true) is never blocked: in a couple it only makes the two equal
-- (for example a couple left with one organiser after a child was removed).
-- Statements of the security definer functions (owner: postgres), of service_role (the
-- deletion of the account of #513), of the foreign key actions and of the seed are trusted.
-- The household is serialised with the same advisory lock as household_members_guard_update
-- and household_members_after_delete, before the check.
create or replace function private.household_members_couple_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'UPDATE' or old.user_id is distinct from (select auth.uid()) then
      perform pg_advisory_xact_lock(hashtextextended(old.household_id::text, 0));

      if private.household_is_couple(old.household_id) then
        raise exception 'in a couple the other adult cannot be removed and roles cannot be taken away'
          using errcode = '42501';
      end if;
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- Named so that they fire before household_members_guard_update and the delete triggers
-- of the private things (alphabetical order of the BEFORE triggers).
create trigger household_members_couple_guard_delete
  before delete on public.household_members
  for each row execute function private.household_members_couple_guard();

create trigger household_members_couple_guard_update
  before update of is_admin on public.household_members
  for each row
  when (old.is_admin and not new.is_admin)
  execute function private.household_members_couple_guard();

-- ===========================================================================
-- add_household_member (from the analysis of #618, C2 «Aggiungi una persona o un animale»)
-- ===========================================================================
-- Adds a member to the caller's household and, for a pet with a species, its profile with
-- the species, in one transaction: both are saved or nothing is (lesson: no split writes).
-- Same rules as the insert of today (household_members_insert): every adult adds children
-- and pets; only who organises adds an adult (without account and without role; the
-- invitation goes through invite_adult or renew_invitation). Returns the id of the member.
-- - p_name: spaces at the start and at the end removed, inner runs reduced to one; then 1
--   to 40 characters (22023 otherwise, also when null);
-- - p_kind, p_color: required (22023);
-- - p_birth_date: only for a child or a pet (22023 for an adult); in the future → 23514
--   (household_members_normalize), a pet more than 40 years ago → 23514;
-- - p_species: only for a pet (22023 otherwise); null = «Non indicata», no profile row.
-- No species, date or other value of the profile of a pet is ever received beyond these.
create or replace function public.add_household_member(
  p_name text,
  p_kind public.member_kind,
  p_color public.member_color,
  p_birth_date date default null,
  p_species public.pet_species default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_household_id uuid;
  v_is_admin boolean;
  v_name text;
  v_member_id uuid;
begin
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'use POST' using errcode = 'P0001';
  end if;

  if (select auth.uid()) is null then
    raise exception 'permission denied for function add_household_member' using errcode = '42501';
  end if;

  select m.household_id, m.is_admin into v_household_id, v_is_admin
  from public.household_members m
  where m.user_id = (select auth.uid());

  if not found then
    raise exception 'permission denied for function add_household_member' using errcode = '42501';
  end if;

  v_name := btrim(regexp_replace(p_name, '\s+', ' ', 'g'));
  if v_name is null or char_length(v_name) not between 1 and 40 or p_kind is null or p_color is null then
    raise exception 'a name of 1 to 40 characters, a kind and a colour are required' using errcode = '22023';
  end if;

  if p_kind = 'adult' and not v_is_admin then
    raise exception 'permission denied for function add_household_member' using errcode = '42501';
  end if;

  if p_kind = 'adult' and p_birth_date is not null then
    raise exception 'an adult has no birth date here' using errcode = '22023';
  end if;

  if p_kind <> 'pet' and p_species is not null then
    raise exception 'only a pet has a species' using errcode = '22023';
  end if;

  insert into public.household_members (household_id, kind, name, color, birth_date)
  values (v_household_id, p_kind, v_name, p_color, p_birth_date)
  returning id into v_member_id;

  if p_kind = 'pet' and p_species is not null then
    insert into public.pet_profiles (household_id, member_id, species)
    values (v_household_id, v_member_id, p_species);
  end if;

  return v_member_id;
end;
$$;

revoke execute on function public.add_household_member(
  text, public.member_kind, public.member_color, date, public.pet_species
) from public, anon, authenticated, service_role;
