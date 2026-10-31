import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import { isValidDayKey, toDayKey, type Instant } from "@/lib/datetime";

/**
 * The only place where pages read the events of the Nest (issue #88, decision
 * on PR #96): it calls the `list_household_events` function and tells apart,
 * in the type, the rows the caller may see in full from the «Occupato» rows of
 * the others, which the database already strips of every detail.
 */

type Visibility = Database["public"]["Enums"]["event_visibility"];

/** An event the reader may see in full (their own, or «Tutto il Nest»). */
export type FullEvent = {
  masked: false;
  /** Event id: the same for every occurrence of a repeated event */
  id: string;
  /** ISO instants (UTC), safe to pass from server to client components */
  startsAt: string;
  endsAt: string;
  visibility: Visibility;
  /** null if the author left the Nest (a «Tutto il Nest» stays without author) */
  authorMemberId: string | null;
  title: string;
  location: string | null;
  escortMemberId: string | null;
  /** Participants, in the order of the Nest members */
  memberIds: string[];
};

/**
 * «Occupato» of someone else: only start, end and author. There is no id (it
 * cannot be opened), no title, place, escort or participants.
 */
export type MaskedEvent = {
  masked: true;
  startsAt: string;
  endsAt: string;
  visibility: "busy";
  authorMemberId: string;
};

export type HouseholdEvent = FullEvent | MaskedEvent;

export type ListEventsResult =
  | { ok: true; events: HouseholdEvent[] }
  /** The reading failed. No detail on purpose: it could carry event data. */
  | { ok: false };

type Row =
  Database["public"]["Functions"]["list_household_events"]["Returns"][number];

/**
 * The generated types declare these columns non-null, but the function returns
 * null on masked rows. Reading them through this type makes the checks honest.
 */
type RawRow = Omit<
  Row,
  | "id"
  | "title"
  | "location"
  | "escort_member_id"
  | "member_ids"
  | "author_member_id"
> & {
  id: string | null;
  author_member_id: string | null;
  title: string | null;
  location: string | null;
  escort_member_id: string | null;
  member_ids: string[] | null;
};

function toEvent(raw: RawRow): HouseholdEvent | null {
  // The database never sends «Solo io» of others and masks «Occupato» of
  // others: that guarantee is theirs. Here a row that is not provably complete
  // is reduced to the allowed fields, and rows that cannot exist are dropped.
  const hasDetails =
    raw.is_masked !== true &&
    raw.id !== null &&
    raw.title !== null &&
    raw.member_ids !== null;
  if (hasDetails) {
    return {
      masked: false,
      id: raw.id as string,
      startsAt: raw.starts_at,
      endsAt: raw.ends_at,
      visibility: raw.visibility,
      authorMemberId: raw.author_member_id,
      title: raw.title as string,
      location: raw.location,
      escortMemberId: raw.escort_member_id,
      memberIds: raw.member_ids as string[],
    };
  }
  // Anything that is not provably a full row is treated as «Occupato»: only
  // the three allowed fields are copied, nothing else can leak.
  if (raw.visibility !== "busy" || raw.author_member_id === null) return null;
  return {
    masked: true,
    startsAt: raw.starts_at,
    endsAt: raw.ends_at,
    visibility: "busy",
    authorMemberId: raw.author_member_id,
  };
}

/**
 * Events of the reader's Nest that touch `[from, to)`, repetitions expanded
 * (one entry per occurrence). The period lasts at most 42 days.
 *
 * - Never throws: a failure gives `{ ok: false }`, to be shown as the error of
 *   the page or of the part (never with technical details).
 * - Without `client` it uses the browser client; server code passes the one
 *   from `@/lib/supabase/server`.
 * - Rows come as the database gives them, in no particular order.
 */
export async function listHouseholdEvents(
  from: Instant,
  to: Instant,
  client?: SupabaseClient<Database>,
): Promise<ListEventsResult> {
  const fromDate = new Date(from);
  const toDate = new Date(to);
  if (
    Number.isNaN(fromDate.getTime()) ||
    Number.isNaN(toDate.getTime()) ||
    toDate <= fromDate
  ) {
    return { ok: false };
  }

  let rows: unknown;
  try {
    const supabase = client ?? createBrowserClient();
    const { data, error } = await supabase.rpc("list_household_events", {
      p_from: fromDate.toISOString(),
      p_to: toDate.toISOString(),
    });
    if (error || !Array.isArray(data)) return { ok: false };
    rows = data;
  } catch {
    return { ok: false };
  }

  const events: HouseholdEvent[] = [];
  for (const raw of rows as unknown[]) {
    if (typeof raw !== "object" || raw === null) continue;
    const event = toEvent(raw as RawRow);
    if (event) events.push(event);
  }
  return { ok: true, events };
}

/**
 * Address of the detail page of one occurrence of an event (#19, #165):
 * `/impegni/<id>?giorno=<Rome day the occurrence starts>`. Every link to the
 * detail goes through here. Nothing else (title, names, place) is put in it.
 */
export function eventHref(id: string, startsAt: Instant): string {
  return `/impegni/${encodeURIComponent(id)}?giorno=${toDayKey(startsAt)}`;
}

type Recurrence = Database["public"]["Enums"]["event_recurrence"];

/** One occurrence of an event the reader sees in full, with the series data. */
export type EventOccurrence = {
  /** Event id: the same for every occurrence */
  id: string;
  /** Rome day the occurrence starts, `YYYY-MM-DD` */
  occurrenceDate: string;
  /** ISO instants (UTC) of this occurrence */
  startsAt: string;
  endsAt: string;
  title: string;
  location: string | null;
  notes: string | null;
  visibility: Visibility;
  /** null if the author left the Nest */
  authorMemberId: string | null;
  escortMemberId: string | null;
  /** Participants, in the order of the Nest members */
  memberIds: string[];
  recurrence: Recurrence;
  /** ISO weekdays 1 = Monday ... 7 = Sunday (weekly series) */
  recurrenceWeekdays: number[];
  /** Last day of the series, `YYYY-MM-DD` */
  recurrenceUntil: string | null;
  /** First occurrence of the series */
  seriesStartsAt: string;
  seriesEndsAt: string;
  /** This occurrence has values of its own */
  isModified: boolean;
};

export type EventOccurrenceResult =
  /** `occurrence` is null when there is nothing to show: no such event, not visible in full, or the day is not an occurrence (the database does not tell them apart) */
  | { ok: true; occurrence: EventOccurrence | null }
  /** The reading failed. No detail on purpose. */
  | { ok: false };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type OccurrenceRow =
  Database["public"]["Functions"]["get_event_occurrence"]["Returns"][number];

/** Nullable columns that the generated types declare as non-null. */
type RawOccurrence = Omit<
  OccurrenceRow,
  | "location"
  | "notes"
  | "author_member_id"
  | "escort_member_id"
  | "recurrence_until"
  | "recurrence_weekdays"
  | "member_ids"
> & {
  location: string | null;
  notes: string | null;
  author_member_id: string | null;
  escort_member_id: string | null;
  recurrence_until: string | null;
  recurrence_weekdays: number[] | null;
  member_ids: string[] | null;
};

function toOccurrence(raw: RawOccurrence): EventOccurrence | null {
  if (
    typeof raw.id !== "string" ||
    typeof raw.title !== "string" ||
    typeof raw.starts_at !== "string" ||
    typeof raw.ends_at !== "string" ||
    typeof raw.occurrence_date !== "string" ||
    typeof raw.series_starts_at !== "string" ||
    typeof raw.series_ends_at !== "string"
  ) {
    return null;
  }
  return {
    id: raw.id,
    occurrenceDate: raw.occurrence_date,
    startsAt: raw.starts_at,
    endsAt: raw.ends_at,
    title: raw.title,
    location: raw.location,
    notes: raw.notes,
    visibility: raw.visibility,
    authorMemberId: raw.author_member_id,
    escortMemberId: raw.escort_member_id,
    memberIds: raw.member_ids ?? [],
    recurrence: raw.recurrence,
    recurrenceWeekdays: raw.recurrence_weekdays ?? [],
    recurrenceUntil: raw.recurrence_until,
    seriesStartsAt: raw.series_starts_at,
    seriesEndsAt: raw.series_ends_at,
    isModified: raw.is_modified === true,
  };
}

/**
 * Reads one occurrence of an event for the detail page: the database function
 * `get_event_occurrence` returns a row only if the reader sees the event in
 * full and `day` (`YYYY-MM-DD`, Rome) is a live occurrence.
 *
 * - `day` missing or not a real day: the occurrence in progress or the next
 *   one, else the last one (decided by the database).
 * - An `id` that is not a uuid is not sent: `{ ok: true, occurrence: null }`.
 * - Never throws: a failure gives `{ ok: false }`, distinct from «not found».
 * - Without `client` it uses the browser client; server code passes the one
 *   from `@/lib/supabase/server`.
 */
export async function getEventOccurrence(
  id: string,
  day?: string | null,
  client?: SupabaseClient<Database>,
): Promise<EventOccurrenceResult> {
  if (!UUID.test(id)) return { ok: true, occurrence: null };
  const validDay = typeof day === "string" && isValidDayKey(day) ? day : null;

  let rows: unknown;
  try {
    const supabase = client ?? createBrowserClient();
    const { data, error } = await supabase.rpc("get_event_occurrence", {
      p_event_id: id,
      ...(validDay ? { p_day: validDay } : {}),
    });
    if (error || !Array.isArray(data)) return { ok: false };
    rows = data;
  } catch {
    return { ok: false };
  }

  const first = (rows as unknown[])[0];
  if (typeof first !== "object" || first === null) {
    return { ok: true, occurrence: null };
  }
  const occurrence = toOccurrence(first as RawOccurrence);
  // A row that cannot be read is an error, not «not found».
  return occurrence ? { ok: true, occurrence } : { ok: false };
}
