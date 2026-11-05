import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";
import { isFakeCalendarProviderEnabled } from "@/lib/env";
import { decryptCredentials } from "./crypto";
import { providerFor } from "./providers";
import {
  ProviderAuthError,
  ProviderTemporaryError,
  ProviderUnavailableError,
  type ProviderCalendar,
  type ProviderEvent,
  type ProviderSession,
} from "./types";

/*
 * The synchronisation service (#34 §7, §8, §9, §16; decision F1 = B).
 *
 * It runs on the server with the administrative client and talks to the
 * database only through the functions of the migration `linked_calendars_server_
 * functions`, which hold the rules of the data (window, texts, «tutto il
 * giorno», private, free, duplicates, limits). What lives here is what the
 * database cannot do: talk to the providers, decrypt the credentials.
 *
 * Nothing in this file logs or throws a token, a code, a mail, a calendar
 * name, a title or a place: errors are classified (`ProviderAuthError`,
 * `ProviderTemporaryError`) and only the class travels.
 */

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Counts the answers of the database that came back with an error. Only the
 * number travels: no message, no data (they could carry a title or a name).
 */
export type Tally = { dbErrors: number };

function noteError(tally: Tally | undefined, result: { error: unknown }) {
  if (result.error && tally) tally.dbErrors += 1;
  return !result.error;
}

export const SYNC_WINDOW_PAST_DAYS = 30;
export const SYNC_WINDOW_FUTURE_MONTHS = 12;
// The database refuses a call with more items than this.
const MAX_EVENTS_PER_CALL = 10_000;

export type AccountSyncResult =
  "ok" | "auth_error" | "temporary_error" | "skipped";

type AccountRow = {
  id: string;
  provider: "google" | "outlook";
  is_fake: boolean;
  status: "active" | "reconnect" | "temporary_error";
  credentials_ciphertext: string;
};

const ACCOUNT_COLUMNS =
  "id, provider, is_fake, status, credentials_ciphertext" as const;

function syncWindow(now: Date): { from: Date; to: Date } {
  const from = new Date(now.getTime() - SYNC_WINDOW_PAST_DAYS * 86_400_000);
  const to = new Date(now);
  to.setUTCMonth(to.getUTCMonth() + SYNC_WINDOW_FUTURE_MONTHS);
  return { from, to };
}

/**
 * The only fields FamilyNest reads of an event (#34 §7). Anything else the
 * provider sent (description, participants, organiser, attachments, links,
 * reminders, colours) is dropped here, before the database sees it.
 */
export function toSyncEvent(event: ProviderEvent): Record<string, Json> {
  const result: Record<string, Json> = { id: event.id };
  const set = (key: string, value: Json | undefined) => {
    if (value !== undefined) result[key] = value;
  };
  set("occurrence_key", event.occurrenceKey);
  set("version", event.version);
  set("title", event.title);
  set("location", event.location);
  set("starts_at", event.startsAt);
  set("ends_at", event.endsAt);
  set("all_day", event.allDay);
  set("start_date", event.startDate);
  set("end_date", event.endDate);
  set("status", event.status);
  set("declined", event.declined);
  set("is_private", event.isPrivate);
  set("is_free", event.isFree);
  set("deleted", event.deleted);
  return result;
}

// If the provider sends more than the database takes in one call, the ones
// nearest to now stay (the database keeps at most 2,000 anyway).
function nearestEvents(events: ProviderEvent[], now: Date): ProviderEvent[] {
  if (events.length <= MAX_EVENTS_PER_CALL) return events;
  const distance = (e: ProviderEvent) => {
    const gap = Math.abs(
      Date.parse(e.startsAt ?? e.startDate ?? "") - now.getTime(),
    );
    return Number.isNaN(gap) ? Number.MAX_SAFE_INTEGER : gap;
  };
  return [...events]
    .sort((a, b) => distance(a) - distance(b))
    .slice(0, MAX_EVENTS_PER_CALL);
}

async function recordResult(
  admin: Admin,
  accountId: string,
  outcome: "ok" | "auth_error" | "temporary_error",
  now: Date,
  tally?: Tally,
): Promise<void> {
  // A failure to record is not worth stopping the others: the next run tries.
  noteError(
    tally,
    await admin.rpc("record_calendar_sync_result", {
      p_account_id: accountId,
      p_outcome: outcome,
      p_at: now.toISOString(),
    }),
  );
}

async function saveCalendars(
  admin: Admin,
  accountId: string,
  calendars: ProviderCalendar[],
): Promise<void> {
  const { error } = await admin.rpc("save_external_calendars", {
    p_account_id: accountId,
    p_calendars: calendars.map((c) => ({
      id: c.id,
      name: c.name,
      is_primary: c.isPrimary,
      is_read_only: c.isReadOnly,
    })),
  });
  if (error) throw new Error("Calendars could not be saved.");
}

/**
 * After the link: reads the calendars of the account and saves them with the
 * starting choices (#34 §6). The events come with `syncAccount`.
 */
export async function refreshCalendarList(
  admin: Admin,
  accountId: string,
  session: ProviderSession,
): Promise<void> {
  await saveCalendars(admin, accountId, await session.listCalendars());
}

async function syncCalendars(
  admin: Admin,
  accountId: string,
  session: ProviderSession,
  now: Date,
  tally?: Tally,
): Promise<"ok" | "temporary_error"> {
  const { data: rows, error } = await admin
    .from("external_calendars")
    .select("id, provider_calendar_id, sync_cursor")
    .eq("account_id", accountId)
    .eq("is_enabled", true);
  if (error) throw new Error("Calendars could not be read.");
  if (rows.length === 0) return "ok";

  const window = syncWindow(now);
  let failed = 0;
  for (const row of rows) {
    try {
      const page = await session.listEvents(
        { id: row.provider_calendar_id },
        window,
        row.sync_cursor,
      );
      const { error: syncError } = await admin.rpc(
        "sync_external_calendar_events",
        {
          p_calendar_id: row.id,
          p_events: nearestEvents(page.events, now).map(toSyncEvent),
          p_full: page.full,
          ...(page.cursor ? { p_cursor: page.cursor } : {}),
          p_at: now.toISOString(),
        },
      );
      if (syncError) throw new Error("Events could not be saved.");
    } catch (caught) {
      // The credentials are refused for the whole account.
      if (caught instanceof ProviderAuthError) throw caught;
      failed += 1;
      noteError(
        tally,
        await admin.rpc("mark_external_calendar_failing", {
          p_calendar_id: row.id,
          p_at: now.toISOString(),
        }),
      );
    }
  }
  return failed === rows.length ? "temporary_error" : "ok";
}

async function syncOne(
  admin: Admin,
  account: AccountRow,
  now: Date,
  tally?: Tally,
): Promise<AccountSyncResult> {
  let session: ProviderSession;
  try {
    const provider = providerFor(account.provider, account.is_fake);
    session = await provider.openSession(
      decryptCredentials(account.credentials_ciphertext),
    );
  } catch (caught) {
    if (caught instanceof ProviderAuthError) {
      await recordResult(admin, account.id, "auth_error", now, tally);
      return "auth_error";
    }
    if (caught instanceof ProviderTemporaryError) {
      await recordResult(admin, account.id, "temporary_error", now, tally);
      return "temporary_error";
    }
    // Not configured here, or credentials this server cannot read (wrong key):
    // the account is not at fault, so its state does not change.
    return "skipped";
  }

  try {
    await saveCalendars(admin, account.id, await session.listCalendars());
    const outcome = await syncCalendars(admin, account.id, session, now, tally);
    await recordResult(admin, account.id, outcome, now, tally);
    return outcome;
  } catch (caught) {
    const outcome =
      caught instanceof ProviderAuthError ? "auth_error" : "temporary_error";
    await recordResult(admin, account.id, outcome, now, tally);
    return outcome;
  }
}

/** Synchronises one account. Accounts waiting for «Ricollega» are skipped. */
export async function syncAccount(
  admin: Admin,
  accountId: string,
  now: Date = new Date(),
  tally?: Tally,
): Promise<AccountSyncResult> {
  const { data, error } = await admin
    .from("calendar_accounts")
    .select(ACCOUNT_COLUMNS)
    .eq("id", accountId)
    .maybeSingle();
  if (error || !data || data.status === "reconnect") return "skipped";
  return syncOne(admin, data, now, tally);
}

/**
 * Synchronises the accounts of one adult (the id is the one of the verified
 * session, chosen by the caller): after a link, and when the page opens with a
 * last synchronisation older than `olderThanMs`.
 */
export async function syncAccountsOfUser(
  admin: Admin,
  userId: string,
  options: { olderThanMs?: number; now?: Date } = {},
): Promise<AccountSyncResult[]> {
  const now = options.now ?? new Date();
  const { data: members, error: membersError } = await admin
    .from("household_members")
    .select("id")
    .eq("user_id", userId)
    .eq("kind", "adult");
  if (membersError || members.length === 0) return [];

  const { data: accounts, error } = await admin
    .from("calendar_accounts")
    .select(`${ACCOUNT_COLUMNS}, last_synced_at`)
    .in(
      "member_id",
      members.map((m) => m.id),
    )
    .neq("status", "reconnect");
  if (error) return [];

  const limit =
    options.olderThanMs === undefined
      ? null
      : now.getTime() - options.olderThanMs;
  const due = accounts.filter(
    (a) =>
      limit === null ||
      a.last_synced_at === null ||
      Date.parse(a.last_synced_at) <= limit,
  );
  return Promise.all(due.map((a) => syncOne(admin, a, now)));
}

// Runs `task` for every item with at most `size` at the same time, and stops
// taking new items after `deadline`.
async function inPool<T>(
  items: T[],
  size: number,
  deadline: number,
  task: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length && Date.now() < deadline) {
      const item = items[next] as T;
      next += 1;
      await task(item);
    }
  };
  await Promise.all(Array.from({ length: size }, worker));
}

/** The scheduled job: every account (the oldest synchronisation first). */
export async function syncAllAccounts(
  admin: Admin,
  options: { now?: Date; deadline: number; tally?: Tally },
): Promise<Record<AccountSyncResult, number>> {
  const now = options.now ?? new Date();
  const { data, error } = await admin
    .from("calendar_accounts")
    .select(ACCOUNT_COLUMNS)
    .neq("status", "reconnect")
    // Fake accounts live only where the fake provider does, and the real ones
    // are left alone there (#34 §9: production ignores the fake ones).
    .eq("is_fake", isFakeCalendarProviderEnabled())
    .order("last_synced_at", { ascending: true, nullsFirst: true })
    .limit(500);
  if (error) throw new Error("Accounts could not be read.");

  const totals: Record<AccountSyncResult, number> = {
    ok: 0,
    auth_error: 0,
    temporary_error: 0,
    skipped: 0,
  };
  await inPool(data, 4, options.deadline, async (account) => {
    totals[await syncOne(admin, account, now, options.tally)] += 1;
  });
  return totals;
}

/**
 * The revocation queue (#34 §9): asks the provider to revoke each credential
 * and deletes the row. A revocation that fails stays for the next run; the job
 * of the database deletes every row after 23 hours anyway.
 */
export async function processRevocations(
  admin: Admin,
  options: { deadline: number },
): Promise<{ revoked: number; kept: number }> {
  const { data, error } = await admin
    .from("calendar_credential_revocations")
    .select("id, provider, is_fake, credentials_ciphertext")
    .eq("is_fake", isFakeCalendarProviderEnabled())
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) throw new Error("Revocations could not be read.");

  const result = { revoked: 0, kept: 0 };
  await inPool(data, 4, options.deadline, async (row) => {
    let done = false;
    try {
      const provider = providerFor(row.provider, row.is_fake);
      if (provider.canRevoke) {
        await provider.revoke(decryptCredentials(row.credentials_ciphertext));
      }
      done = true;
    } catch (caught) {
      // A fake credential in a place without the fake can never be revoked.
      done = caught instanceof ProviderUnavailableError && row.is_fake;
    }
    if (done) {
      const { error: deleteError } = await admin
        .from("calendar_credential_revocations")
        .delete()
        .eq("id", row.id);
      if (!deleteError) {
        result.revoked += 1;
        return;
      }
    }
    result.kept += 1;
  });
  return result;
}

const OUTBOX_BATCH = 50;

/**
 * The changes of «Anche su» (#34 §16): creates, changes or deletes the event at
 * the provider, then tells the database. The text comes from the event at the
 * moment of sending, never from the queue.
 */
export async function processOutbox(
  admin: Admin,
  options: { now?: Date; deadline: number; tally?: Tally },
): Promise<{ done: number; failed: number }> {
  const now = options.now ?? new Date();
  const tally = options.tally;
  const { data: items, error } = await admin
    .from("calendar_outbox")
    .select(
      "id, action, event_id, provider_event_id, attempts, calendar_id, external_calendars!inner(calendar_accounts!inner(is_fake))",
    )
    .eq(
      "external_calendars.calendar_accounts.is_fake",
      isFakeCalendarProviderEnabled(),
    )
    .lte("next_attempt_at", now.toISOString())
    .order("next_attempt_at", { ascending: true })
    .limit(OUTBOX_BATCH);
  if (error) throw new Error("Outbox could not be read.");

  const sessions = new Map<string, ProviderSession | null>();
  const result = { done: 0, failed: 0 };

  const sessionOf = async (
    accountId: string,
  ): Promise<ProviderSession | null> => {
    if (sessions.has(accountId)) return sessions.get(accountId) ?? null;
    let session: ProviderSession | null = null;
    const { data: account } = await admin
      .from("calendar_accounts")
      .select(ACCOUNT_COLUMNS)
      .eq("id", accountId)
      .maybeSingle();
    if (account && account.status !== "reconnect") {
      try {
        const provider = providerFor(account.provider, account.is_fake);
        session = await provider.openSession(
          decryptCredentials(account.credentials_ciphertext),
        );
      } catch (caught) {
        if (caught instanceof ProviderAuthError) {
          await recordResult(admin, accountId, "auth_error", now, tally);
        }
      }
    }
    sessions.set(accountId, session);
    return session;
  };

  for (const item of items) {
    if (Date.now() >= options.deadline) break;
    const retry = async () => {
      result.failed += 1;
      const minutes = Math.min(5 * 2 ** item.attempts, 360);
      noteError(
        tally,
        await admin.rpc("fail_calendar_outbox_item", {
          p_id: item.id,
          p_retry_at: new Date(now.getTime() + minutes * 60_000).toISOString(),
        }),
      );
    };

    const { data: calendar } = await admin
      .from("external_calendars")
      .select("provider_calendar_id, account_id, is_enabled, direction")
      .eq("id", item.calendar_id)
      .maybeSingle();
    if (!calendar || !calendar.is_enabled || calendar.direction !== "two_way") {
      // The database removes such rows by itself; if one is left, try later.
      await retry();
      continue;
    }
    const session = await sessionOf(calendar.account_id);
    if (!session) {
      await retry();
      continue;
    }
    const target = { id: calendar.provider_calendar_id };

    try {
      if (item.action === "delete") {
        if (!item.provider_event_id) throw new Error("Invalid outbox item.");
        await session.deleteEvent(target, item.provider_event_id);
        const completed = await admin.rpc("complete_calendar_outbox_item", {
          p_id: item.id,
        });
        if (!noteError(tally, completed)) throw new Error("Not completed.");
      } else {
        if (!item.event_id) throw new Error("Invalid outbox item.");
        const { data: event } = await admin
          .from("events")
          .select(
            "title, location, starts_at, ends_at, recurrence, recurrence_until, recurrence_weekdays",
          )
          .eq("id", item.event_id)
          .maybeSingle();
        if (!event) {
          // The event went away: the queue row goes with it (cascade).
          continue;
        }
        const outgoing = {
          title: event.title,
          location: event.location,
          startsAt: event.starts_at,
          endsAt: event.ends_at,
          recurrence:
            event.recurrence === "none"
              ? null
              : {
                  frequency: event.recurrence,
                  weekdays: event.recurrence_weekdays,
                  until: event.recurrence_until,
                },
          isPrivate: true as const,
        };
        if (item.action === "create") {
          const created = await session.createEvent(target, outgoing);
          // The link between the copy and the event must be saved, or the next
          // run would create a second copy: one more try, and if the database
          // still refuses, the copy just made is deleted before the retry.
          let kept: boolean | null = null;
          let saved = false;
          for (let attempt = 0; attempt < 2 && !saved; attempt += 1) {
            const completed = await admin.rpc("complete_calendar_outbox_item", {
              p_id: item.id,
              p_provider_event_id: created.id,
              ...(created.version
                ? { p_provider_version: created.version }
                : {}),
            });
            saved = noteError(tally, completed);
            if (saved) kept = completed.data;
          }
          if (!saved) {
            try {
              await session.deleteEvent(target, created.id);
            } catch {
              // Nothing more can be done from here.
            }
            throw new Error("Not completed.");
          }
          // The user switched «Anche su» off meanwhile: the copy goes.
          if (kept === false) await session.deleteEvent(target, created.id);
        } else {
          if (!item.provider_event_id) throw new Error("Invalid outbox item.");
          const updated = await session.updateEvent(
            target,
            item.provider_event_id,
            outgoing,
          );
          const completed = await admin.rpc("complete_calendar_outbox_item", {
            p_id: item.id,
            ...(updated.version ? { p_provider_version: updated.version } : {}),
          });
          if (!noteError(tally, completed)) throw new Error("Not completed.");
        }
      }
      result.done += 1;
    } catch (caught) {
      if (caught instanceof ProviderAuthError) {
        await recordResult(admin, calendar.account_id, "auth_error", now);
      }
      await retry();
    }
  }
  return result;
}

/** The scheduled job, in the order of urgency. */
export async function runScheduledJob(
  admin: Admin,
  options: { now?: Date; deadline: number },
): Promise<{
  revocations: { revoked: number; kept: number };
  accounts: Record<AccountSyncResult, number>;
  outbox: { done: number; failed: number };
  /** Answers of the database that came back with an error (a count only). */
  dbErrors: number;
}> {
  const tally: Tally = { dbErrors: 0 };
  const withTally = { ...options, tally };
  const revocations = await processRevocations(admin, options);
  const outbox = await processOutbox(admin, withTally);
  const accounts = await syncAllAccounts(admin, withTally);
  return { revocations, accounts, outbox, dbErrors: tally.dbErrors };
}
