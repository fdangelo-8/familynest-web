import {
  calendarInitial,
  sortCalendars,
  type AccountItem,
  type CalendarItem,
} from "@/components/calendari-collegati/model";
import {
  atText,
  sinceText,
  updatedText,
} from "@/components/calendari-collegati/times";
import { formatTime } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/server";

/*
 * Reads «Calendari collegati» (#34, #35) with the adult's own session, so the
 * rules of the database apply: only the adult's own accounts and calendars
 * come back, never the credentials (those columns cannot be read with this
 * session), never those of other adults.
 *
 * Only what the page shows leaves the server. Of the other adults only the
 * first name leaves, for the help text of «Occupato»; no id, no mail.
 */

/** A synchronisation older than this is redone when the page opens (#34 §7). */
export const STALE_AFTER_MS = 5 * 60_000;
const SILENT_AFTER_MS = 24 * 60 * 60_000;

export type PageData = {
  myName: string;
  /** First names of the other adults who have an account */
  others: string[];
  accounts: AccountItem[];
  /** Accounts whose last synchronisation is older than five minutes */
  staleAccountIds: string[];
  /** «15:40»: when this page was read (for the offline notice) */
  loadedAt: string;
  /** Mail of the account of `alreadyLinkedProvider` touched last (the one the adult just linked again) */
  alreadyLinkedEmail: string | null;
};

export type Loaded = { ok: true; data: PageData } | { ok: false };

export async function loadLinkedCalendars(
  fallbackName: string,
  alreadyLinkedProvider: string | null = null,
): Promise<Loaded> {
  const supabase = await createClient();
  const now = new Date();

  const [userResult, householdResult] = await Promise.all([
    supabase.auth.getUser(),
    supabase.rpc("current_household_id"),
  ]);
  const user = userResult.data.user;
  if (userResult.error || !user) return { ok: false };
  if (householdResult.error || !householdResult.data) return { ok: false };

  const [members, accounts, calendars] = await Promise.all([
    supabase
      .from("household_members")
      .select("name, kind, user_id")
      .eq("household_id", householdResult.data),
    supabase
      .from("calendar_accounts")
      .select(
        "id, provider, email, status, failing_since, last_synced_at, connected_at, updated_at",
      )
      .order("connected_at", { ascending: true })
      .order("id", { ascending: true }),
    supabase
      .from("external_calendars")
      .select(
        "id, account_id, name, is_primary, is_read_only, is_enabled, direction, visibility, counts_for_free_time, weekdays_only, is_new_events_target, last_synced_at, failing_since",
      ),
  ]);
  if (members.error || accounts.error || calendars.error) return { ok: false };

  const me = members.data.find((m) => m.user_id === user.id);
  const others = members.data
    .filter((m) => m.kind === "adult" && m.user_id && m.user_id !== user.id)
    .map((m) => m.name);

  const staleAccountIds: string[] = [];
  const items = accounts.data.map((account): AccountItem => {
    const own: CalendarItem[] = calendars.data
      .filter((c) => c.account_id === account.id)
      .map((c) => ({
        id: c.id,
        name: c.name,
        initial: calendarInitial(c.name, account.provider),
        isPrimary: c.is_primary,
        isReadOnly: c.is_read_only,
        isEnabled: c.is_enabled,
        direction: c.direction,
        visibility: c.visibility,
        countsForFreeTime: c.counts_for_free_time,
        weekdaysOnly: c.weekdays_only,
        isTarget: c.is_new_events_target,
        failingSince: c.failing_since ? sinceText(c.failing_since, now) : null,
        lastSynced: c.last_synced_at ? atText(c.last_synced_at, now) : null,
      }));

    const last = account.last_synced_at
      ? Date.parse(account.last_synced_at)
      : null;
    if (
      account.status !== "reconnect" &&
      (last === null || now.getTime() - last >= STALE_AFTER_MS)
    ) {
      staleAccountIds.push(account.id);
    }
    const silentSince = account.failing_since
      ? Date.parse(account.failing_since)
      : null;

    return {
      id: account.id,
      provider: account.provider,
      email: account.email,
      status: account.status,
      failingSince: account.failing_since
        ? sinceText(account.failing_since, now)
        : null,
      silentForDay:
        account.status === "temporary_error" &&
        silentSince !== null &&
        now.getTime() - silentSince >= SILENT_AFTER_MS,
      updatedAt: account.last_synced_at
        ? updatedText(account.last_synced_at, now)
        : null,
      calendars: sortCalendars(own),
    };
  });

  const touched = accounts.data
    .filter((a) => a.provider === alreadyLinkedProvider)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];

  return {
    ok: true,
    data: {
      alreadyLinkedEmail: touched?.email ?? null,
      myName: me?.name ?? fallbackName,
      others,
      accounts: items,
      staleAccountIds,
      loadedAt: formatTime(now),
    },
  };
}
