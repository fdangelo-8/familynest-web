import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import { isValidDayKey } from "@/lib/datetime";
import { eventHref } from "@/lib/household-events";

/**
 * The only place where pages call `search_household` (issue #40, lessons of
 * #96): it tells apart, in the type, the rows the reader may see in full from
 * the «Occupato» rows of the others, which the database already strips of
 * every detail.
 *
 * The text typed by the user is sent in the body of a POST (what `rpc` does),
 * never in an address, and never saved, logged or put in an error: a failure
 * gives `{ ok: false }` and nothing else.
 */

export type SearchKind = Database["public"]["Enums"]["search_result_kind"];
type Visibility = Database["public"]["Enums"]["event_visibility"];
type Recurrence = Database["public"]["Enums"]["event_recurrence"];

/** The four kinds, in the order the page shows the groups. */
export const SEARCH_KINDS: readonly SearchKind[] = [
  "event",
  "deadline",
  "todo",
  "shopping_item",
];

/** Limits of the database function (issue #40, default 7). */
export const SEARCH_MIN_TEXT_LENGTH = 2;
export const SEARCH_MAX_TEXT_LENGTH = 100;
export const SEARCH_MAX_ROWS_PER_KIND = 20;
export const SEARCH_MAX_PERIOD_DAYS = 400;

/** An event occurrence the reader may see in full. */
export type EventHit = {
  kind: "event";
  masked: false;
  /** Event id: the same for every occurrence */
  id: string;
  title: string;
  location: string | null;
  /** ISO instants (UTC) of this occurrence */
  startsAt: string;
  endsAt: string;
  /** Rome day the occurrence starts, `YYYY-MM-DD` (the `?giorno=` of the detail) */
  occurrenceDay: string;
  visibility: Visibility;
  /** null if the author left the Nest */
  authorMemberId: string | null;
  /** Participants, in the order of the Nest members */
  memberIds: string[];
  escortMemberId: string | null;
  recurrence: Recurrence;
  /** ISO weekdays 1 = Monday ... 7 = Sunday (weekly series) */
  recurrenceWeekdays: number[];
  /** First day of the series, `YYYY-MM-DD`, for «ogni martedì e giovedì» */
  seriesStartsOn: string;
};

/**
 * «Occupato» of someone else, returned only by a search without text: start,
 * end, day and author. No id (it cannot be opened), no title, place,
 * participants or escort.
 */
export type MaskedEventHit = {
  kind: "event";
  masked: true;
  startsAt: string;
  endsAt: string;
  occurrenceDay: string;
  visibility: "busy";
  authorMemberId: string;
};

type ThingHit = {
  masked: false;
  id: string;
  title: string;
  /** `YYYY-MM-DD`, or null for a thing to do without a date */
  dueDate: string | null;
  isPrivate: boolean;
  /** Who takes care of it */
  assigneeMemberId: string | null;
  /** Who it is for */
  forMemberId: string | null;
};

export type TodoHit = ThingHit & { kind: "todo" };
export type DeadlineHit = ThingHit & { kind: "deadline" };

export type ShoppingHit = {
  kind: "shopping_item";
  masked: false;
  id: string;
  /** The name of the item */
  title: string;
  quantity: string | null;
};

export type SearchHit =
  EventHit | MaskedEventHit | DeadlineHit | TodoHit | ShoppingHit;

export type SearchQuery = {
  /** Words to find in the titles: 2 to 100 characters once trimmed */
  text?: string;
  /** A member of the Nest («cose di <Nome>») */
  memberId?: string;
  /** Period of days (Rome, `YYYY-MM-DD`), both included; both or none, at most 400 days */
  from?: string;
  to?: string;
  /** Kinds to search; without it, all of them */
  kinds?: readonly SearchKind[];
};

export type SearchResult =
  | { ok: true; hits: SearchHit[] }
  /** The reading failed. No detail on purpose: it could carry what was typed. */
  | { ok: false };

type Row =
  Database["public"]["Functions"]["search_household"]["Returns"][number];

/**
 * The generated types declare these columns non-null, but the function returns
 * null on rows of other kinds and on masked rows. Reading them through this
 * type makes the checks honest.
 */
type RawRow = Omit<
  Row,
  | "id"
  | "title"
  | "location"
  | "author_member_id"
  | "member_ids"
  | "escort_member_id"
  | "recurrence"
  | "recurrence_weekdays"
  | "series_starts_on"
  | "due_date"
  | "assignee_member_id"
  | "for_member_id"
  | "quantity"
  | "occurrence_day"
  | "starts_at"
  | "ends_at"
  | "visibility"
> & {
  id: string | null;
  title: string | null;
  location: string | null;
  author_member_id: string | null;
  member_ids: string[] | null;
  escort_member_id: string | null;
  recurrence: Recurrence | null;
  recurrence_weekdays: number[] | null;
  series_starts_on: string | null;
  due_date: string | null;
  assignee_member_id: string | null;
  for_member_id: string | null;
  quantity: string | null;
  occurrence_day: string | null;
  starts_at: string | null;
  ends_at: string | null;
  visibility: Visibility | null;
};

function toEventHit(raw: RawRow): EventHit | MaskedEventHit | null {
  if (
    raw.starts_at === null ||
    raw.ends_at === null ||
    raw.occurrence_day === null
  ) {
    return null;
  }
  const hasDetails =
    raw.is_masked !== true &&
    raw.id !== null &&
    raw.title !== null &&
    raw.member_ids !== null &&
    raw.recurrence !== null &&
    raw.visibility !== null &&
    raw.series_starts_on !== null;
  if (hasDetails) {
    return {
      kind: "event",
      masked: false,
      id: raw.id as string,
      title: raw.title as string,
      location: raw.location,
      startsAt: raw.starts_at,
      endsAt: raw.ends_at,
      occurrenceDay: raw.occurrence_day,
      visibility: raw.visibility as Visibility,
      authorMemberId: raw.author_member_id,
      memberIds: raw.member_ids as string[],
      escortMemberId: raw.escort_member_id,
      recurrence: raw.recurrence as Recurrence,
      recurrenceWeekdays: raw.recurrence_weekdays ?? [],
      seriesStartsOn: raw.series_starts_on as string,
    };
  }
  // Anything that is not provably a full row is treated as «Occupato»: only
  // the allowed fields are copied, nothing else can leak.
  if (raw.visibility !== "busy" || raw.author_member_id === null) return null;
  return {
    kind: "event",
    masked: true,
    startsAt: raw.starts_at,
    endsAt: raw.ends_at,
    occurrenceDay: raw.occurrence_day,
    visibility: "busy",
    authorMemberId: raw.author_member_id,
  };
}

function toThingHit(
  raw: RawRow,
  kind: "todo" | "deadline",
): TodoHit | DeadlineHit | null {
  if (raw.id === null || raw.title === null) return null;
  return {
    kind,
    masked: false,
    id: raw.id,
    title: raw.title,
    dueDate: raw.due_date,
    isPrivate: raw.is_private === true,
    assigneeMemberId: raw.assignee_member_id,
    forMemberId: raw.for_member_id,
  } as TodoHit | DeadlineHit;
}

function toHit(raw: RawRow): SearchHit | null {
  switch (raw.kind) {
    case "event":
      return toEventHit(raw);
    case "todo":
    case "deadline":
      return toThingHit(raw, raw.kind);
    case "shopping_item":
      if (raw.id === null || raw.title === null) return null;
      return {
        kind: "shopping_item",
        masked: false,
        id: raw.id,
        title: raw.title,
        quantity: raw.quantity,
      };
    default:
      return null;
  }
}

/**
 * True when the query can be sent: at least one of text (2 to 100 characters
 * once trimmed), person or a whole period; a period is both days, real,
 * in order and at most 400 days long. The function checks the same things
 * and answers with an error; checking here saves the request.
 */
export function isSearchable(query: SearchQuery): boolean {
  const text = query.text?.trim() ?? "";
  const hasText = text !== "";
  if (hasText && text.length < SEARCH_MIN_TEXT_LENGTH) return false;
  if (text.length > SEARCH_MAX_TEXT_LENGTH) return false;
  const hasFrom = query.from !== undefined;
  const hasTo = query.to !== undefined;
  if (hasFrom !== hasTo) return false;
  if (hasFrom && hasTo) {
    const from = query.from as string;
    const to = query.to as string;
    if (!isValidDayKey(from) || !isValidDayKey(to) || to < from) return false;
    const days = (Date.parse(to) - Date.parse(from)) / 86_400_000 + 1;
    if (days > SEARCH_MAX_PERIOD_DAYS) return false;
  }
  if (query.kinds !== undefined && query.kinds.length === 0) return false;
  return hasText || query.memberId !== undefined || hasFrom;
}

/**
 * Searches the reader's Nest: events (repetitions expanded, up to 3 per
 * series), deadlines, things to do and shopping items, at most 20 per kind.
 *
 * - Never throws: a failure, or a query that cannot be sent (see
 *   `isSearchable`), gives `{ ok: false }`, to be shown as the error of the
 *   part (never with technical details).
 * - Rows come in the order of the groups of the page (events, deadlines,
 *   things to do, shopping), and inside a kind in the order the database
 *   decided.
 * - Without `client` it uses the browser client; server code passes the one
 *   from `@/lib/supabase/server`.
 */
export async function searchHousehold(
  query: SearchQuery,
  client?: SupabaseClient<Database>,
): Promise<SearchResult> {
  if (!isSearchable(query)) return { ok: false };
  const text = query.text?.trim();

  let rows: unknown;
  try {
    const supabase = client ?? createBrowserClient();
    const { data, error } = await supabase.rpc("search_household", {
      ...(text ? { p_text: text } : {}),
      ...(query.memberId ? { p_member_id: query.memberId } : {}),
      ...(query.from && query.to ? { p_from: query.from, p_to: query.to } : {}),
      ...(query.kinds ? { p_kinds: [...query.kinds] } : {}),
    });
    if (error || !Array.isArray(data)) return { ok: false };
    rows = data;
  } catch {
    return { ok: false };
  }

  const hits: SearchHit[] = [];
  for (const raw of rows as unknown[]) {
    if (typeof raw !== "object" || raw === null) continue;
    const hit = toHit(raw as RawRow);
    if (hit) hits.push(hit);
  }
  return { ok: true, hits };
}

/**
 * Address of the detail page of an event hit: the same `eventHref` of every
 * link to the detail. Nothing but the id and the day is put in it.
 */
export function eventHitHref(hit: EventHit): string {
  return eventHref(hit.id, hit.startsAt);
}
