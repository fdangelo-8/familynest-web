import type { SupabaseClient } from "@supabase/supabase-js";
import type { MemberColor } from "@/components/ui/Avatar/Avatar";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import { getEventOccurrence } from "@/lib/household-events";

/**
 * The only place where pages read the notifications of the reader and mark
 * them read (issue #39, lessons of #124): a type with one variant for each
 * kind of notification, so a page cannot read a field a kind does not have.
 *
 * What is stored is only references and numbers (who receives, which kind,
 * who acted, which thing): titles and names are read here from the tables of
 * origin, with the permissions of the reader. A notification whose thing the
 * reader can no longer read, or whose person who acted is no longer in the
 * Nest, is not returned and not counted.
 */

/** How long notifications are shown (and kept by the database), in days. */
export const NOTIFICATION_DAYS = 30;
/** At most this many are shown: the most recent. */
export const NOTIFICATION_MAX = 100;

/** Who acted: the current name and colour of the member. */
export type NotificationActor = {
  memberId: string;
  name: string;
  color: MemberColor;
};

type NotificationBase = {
  id: string;
  /** ISO instant (UTC) the notification was born */
  createdAt: string;
  /** null = not read */
  readAt: string | null;
};

/** An adult assigned a thing to do to the reader. */
export type TodoAssignedNotification = NotificationBase & {
  kind: "todo_assigned";
  actor: NotificationActor;
  todo: {
    id: string;
    title: string;
    /** `YYYY-MM-DD`, or null without a date */
    dueDate: string | null;
    /** Done by anyone: the page offers only «Apri» */
    isDone: boolean;
  };
};

/** A deadline is near (30, 7, 1 days before, or the day itself). */
export type DeadlineReminderNotification = NotificationBase & {
  kind: "deadline_reminder";
  /** Which reminder: 30, 7, 1 or 0 (the day itself) */
  daysBefore: 30 | 7 | 1 | 0;
  deadline: {
    id: string;
    title: string;
    /** `YYYY-MM-DD` */
    dueDate: string;
    note: string | null;
  };
};

/** An evening free together, found by the job of 8:00. */
export type FreeTogetherNotification = NotificationBase & {
  kind: "free_together";
  /** The evening, `YYYY-MM-DD` (Rome) */
  eveningDate: string;
  /** ISO instant the window started when the notification was born */
  freeFrom: string;
};

/** An adult changed start or end of an event the reader sees in full. */
export type EventTimeChangedNotification = NotificationBase & {
  kind: "event_time_changed";
  actor: NotificationActor;
  /**
   * The occurrence as it is now: the changed one (one time only) or the
   * next one still to come, else the last (the whole series). The same rule
   * of the detail page, decided by the database.
   */
  event: {
    id: string;
    title: string;
    startsAt: string;
    endsAt: string;
    /** Rome day of the occurrence, `YYYY-MM-DD` (the `?giorno=` of the detail) */
    occurrenceDate: string;
  };
};

/** An adult added things to the shopping list. */
export type ShoppingAddedNotification = NotificationBase & {
  kind: "shopping_added";
  actor: NotificationActor;
  /** How many things were added, at least 1 */
  itemCount: number;
};

export type NotificationItem =
  | TodoAssignedNotification
  | DeadlineReminderNotification
  | FreeTogetherNotification
  | EventTimeChangedNotification
  | ShoppingAddedNotification;

export type NotificationKind = NotificationItem["kind"];

/** Why a call failed: no connection, or the server answered with an error. */
export type NotificationFailure = "network" | "server";

export type ListNotificationsResult =
  /** Newest first (at equal time, by id, newest first) */
  | { ok: true; notifications: NotificationItem[] }
  /** No detail on purpose: it could carry titles and names. */
  | { ok: false; reason: NotificationFailure };

/**
 * `status` 0: no answer arrived (network); so does a browser that knows it is
 * offline. Any other answer, with an error, is the server's.
 */
export function failureOf(status: number): NotificationFailure {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "network";
  }
  return status === 0 ? "network" : "server";
}

class OccurrenceReadFailed extends Error {}

const DAYS_BEFORE = [30, 7, 1, 0] as const;

type RawNotification = {
  id: string;
  kind: Database["public"]["Enums"]["notification_kind"];
  created_at: string;
  read_at: string | null;
  event_id: string | null;
  occurrence_date: string | null;
  days_before: number | null;
  evening_date: string | null;
  free_from: string | null;
  item_count: number | null;
  actor: { id: string; name: string; color: MemberColor } | null;
  todo: {
    id: string;
    title: string;
    due_date: string | null;
    done_at: string | null;
  } | null;
  deadline: {
    id: string;
    title: string;
    due_date: string;
    note: string | null;
  } | null;
};

const COLUMNS = `
  id, kind, created_at, read_at, event_id, occurrence_date, days_before,
  evening_date, free_from, item_count,
  actor:household_members!notifications_actor_fkey(id, name, color),
  todo:todos!notifications_todo_fkey(id, title, due_date, done_at),
  deadline:deadlines!notifications_deadline_fkey(id, title, due_date, note)
`;

function toActor(raw: RawNotification["actor"]): NotificationActor | null {
  return raw ? { memberId: raw.id, name: raw.name, color: raw.color } : null;
}

/**
 * Reduces a row to its variant, or to null when the fields of its kind are
 * not all there (the database guarantees them; a row that is not provably
 * complete is dropped, never shown half).
 */
function toItem(raw: RawNotification): NotificationItem | null {
  const base = {
    id: raw.id,
    createdAt: raw.created_at,
    readAt: raw.read_at,
  };
  switch (raw.kind) {
    case "todo_assigned": {
      const actor = toActor(raw.actor);
      if (!actor || !raw.todo) return null;
      return {
        ...base,
        kind: "todo_assigned",
        actor,
        todo: {
          id: raw.todo.id,
          title: raw.todo.title,
          dueDate: raw.todo.due_date,
          isDone: raw.todo.done_at !== null,
        },
      };
    }
    case "deadline_reminder": {
      const days = DAYS_BEFORE.find((value) => value === raw.days_before);
      if (days === undefined || !raw.deadline) return null;
      return {
        ...base,
        kind: "deadline_reminder",
        daysBefore: days,
        deadline: {
          id: raw.deadline.id,
          title: raw.deadline.title,
          dueDate: raw.deadline.due_date,
          note: raw.deadline.note,
        },
      };
    }
    case "free_together":
      if (raw.evening_date === null || raw.free_from === null) return null;
      return {
        ...base,
        kind: "free_together",
        eveningDate: raw.evening_date,
        freeFrom: raw.free_from,
      };
    case "shopping_added": {
      const actor = toActor(raw.actor);
      if (!actor || raw.item_count === null || raw.item_count < 1) return null;
      return {
        ...base,
        kind: "shopping_added",
        actor,
        itemCount: raw.item_count,
      };
    }
    // The occurrence is read separately (see `listNotifications`).
    default:
      return null;
  }
}

/**
 * The notifications of the reader: the ones of the last 30 days, the 100 most
 * recent, newest first. The database decides what the reader may see (their
 * own, of their Nest, whose thing they can still read); this function drops
 * the ones whose actor or occurrence it cannot show.
 *
 * - Never throws: a failure gives `{ ok: false, reason }`, to be shown as the
 *   error of the page (never with technical details).
 * - `now` is only for the 30 days window; tests pass a fixed one.
 * - Without `client` it uses the browser client; server code passes the one
 *   from `@/lib/supabase/server`.
 * - Opening the page marks the shown ones read with `markNotificationsRead`.
 */
export async function listNotifications(
  client?: SupabaseClient<Database>,
  now: Date = new Date(),
): Promise<ListNotificationsResult> {
  const since = new Date(
    now.getTime() - NOTIFICATION_DAYS * 86_400_000,
  ).toISOString();

  let rows: RawNotification[];
  try {
    const supabase = client ?? createBrowserClient();
    const { data, error, status } = await supabase
      .from("notifications")
      .select(COLUMNS)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(NOTIFICATION_MAX);
    if (error) return { ok: false, reason: failureOf(status) };
    if (!Array.isArray(data)) return { ok: false, reason: "server" };
    rows = data as unknown as RawNotification[];
  } catch {
    return { ok: false, reason: "network" };
  }

  // Cambi d'orario: the current occurrence of each event, one read each.
  const occurrences = new Map<
    string,
    Promise<EventTimeChangedNotification["event"] | null | "failed">
  >();
  const readOccurrence = (eventId: string, day: string | null) => {
    const key = `${eventId}|${day ?? ""}`;
    let found = occurrences.get(key);
    if (!found) {
      // `ok: true` with no occurrence = «cannot be shown»; `ok: false` = the
      // read failed, and the whole list fails with it (never an incomplete list).
      found = getEventOccurrence(eventId, day, client).then((result) => {
        if (!result.ok) return "failed" as const;
        return result.occurrence
          ? {
              id: result.occurrence.id,
              title: result.occurrence.title,
              startsAt: result.occurrence.startsAt,
              endsAt: result.occurrence.endsAt,
              occurrenceDate: result.occurrence.occurrenceDate,
            }
          : null;
      });
      occurrences.set(key, found);
    }
    return found;
  };

  let items: (NotificationItem | null)[];
  try {
    items = await Promise.all(
      rows.map(async (raw): Promise<NotificationItem | null> => {
        if (raw.kind !== "event_time_changed") return toItem(raw);
        const actor = toActor(raw.actor);
        if (!actor || raw.event_id === null) return null;
        const event = await readOccurrence(raw.event_id, raw.occurrence_date);
        if (event === "failed") throw new OccurrenceReadFailed();
        if (!event) return null;
        return {
          id: raw.id,
          createdAt: raw.created_at,
          readAt: raw.read_at,
          kind: "event_time_changed",
          actor,
          event,
        };
      }),
    );
  } catch (error) {
    if (!(error instanceof OccurrenceReadFailed)) throw error;
    // The read of an occurrence does not say why it failed.
    const offline =
      typeof navigator !== "undefined" && navigator.onLine === false;
    return { ok: false, reason: offline ? "network" : "server" };
  }

  return {
    ok: true,
    notifications: items.filter((item): item is NotificationItem => !!item),
  };
}

export type CountNotificationsResult =
  { ok: true; count: number } | { ok: false; reason: NotificationFailure };

/**
 * How many notifications the page would show are not read (the number of the
 * bell): those of the last 30 days that the reader can still see, among the
 * 100 most recent. Decided by the database.
 *
 * Never throws. The bell shows no number when this fails, and no error.
 */
export async function countUnreadNotifications(
  client?: SupabaseClient<Database>,
): Promise<CountNotificationsResult> {
  try {
    const supabase = client ?? createBrowserClient();
    const { data, error, status } = await supabase.rpc(
      "count_unread_notifications",
    );
    if (error) return { ok: false, reason: failureOf(status) };
    if (typeof data !== "number" || !Number.isFinite(data) || data < 0) {
      return { ok: false, reason: "server" };
    }
    return { ok: true, count: Math.floor(data) };
  } catch {
    return { ok: false, reason: "network" };
  }
}

export type MarkReadResult =
  { ok: true } | { ok: false; reason: NotificationFailure };

/** The database accepts at most this many ids in one call. */
const MARK_READ_MAX = 200;

/**
 * Marks as read the notifications with these ids. Only ids travel; the
 * database marks only the reader's own. An empty list does nothing and
 * succeeds; more than 200 ids go in several calls.
 *
 * Never throws: «Segna tutte come lette» tells `network` from `server` to
 * choose its message.
 */
export async function markNotificationsRead(
  ids: readonly string[],
  client?: SupabaseClient<Database>,
): Promise<MarkReadResult> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return { ok: true };
  try {
    const supabase = client ?? createBrowserClient();
    for (let start = 0; start < unique.length; start += MARK_READ_MAX) {
      const { error, status } = await supabase.rpc("mark_notifications_read", {
        p_ids: unique.slice(start, start + MARK_READ_MAX),
      });
      if (error) return { ok: false, reason: failureOf(status) };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "network" };
  }
}
