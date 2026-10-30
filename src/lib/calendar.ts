import { formatTime, fromFieldValues, type CalendarDay } from "@/lib/datetime";
import type {
  FullEvent,
  HouseholdEvent,
  MaskedEvent,
} from "@/lib/household-events";

/**
 * Rules shared by Calendario (#25) and Oggi (#30): lens filter, words of the
 * visibility, text of the «Occupato» rows, and «Liberi insieme». Pure
 * functions: no reading, no clock.
 */

/* ---------- Words ---------- */

export type EventVisibility = "private" | "busy" | "household";

/** Words of the visibility, the same as in Aggiungi. */
export const VISIBILITY_LABELS: Record<EventVisibility, string> = {
  household: "Tutto il Nest",
  busy: "Occupato",
  private: "Solo io",
};

/** Title of the «Occupato» rows and blocks of the others. */
export const BUSY_TITLE = "Occupato";

/** Text of the «Occupato» of another person: no gender, no detail. */
export function formatBusyLabel(name: string): string {
  return `${name} ha un impegno`;
}

/* ---------- Lens ---------- */

export type LensChoice = "io" | "nest";

/**
 * True if the event belongs to the person: author, participant or escort
 * («la porta»). A masked «Occupato» of someone else is never theirs; their own
 * «Occupato» comes back as a full row.
 */
export function isInvolved(event: HouseholdEvent, memberId: string): boolean {
  if (event.masked) return false;
  return (
    event.authorMemberId === memberId ||
    event.escortMemberId === memberId ||
    event.memberIds.includes(memberId)
  );
}

/** Events shown by the lens «Io» (their own) or «Nest» (everything visible). */
export function filterByLens<T extends HouseholdEvent>(
  events: readonly T[],
  lens: LensChoice,
  memberId: string,
): T[] {
  return lens === "nest"
    ? [...events]
    : events.filter((event) => isInvolved(event, memberId));
}

/**
 * Events that «Nest» would show and «Io» does not (masked ones included): the
 * «N impegni degli altri nascosti» of the mobile list.
 */
export function hiddenByLens<T extends HouseholdEvent>(
  events: readonly T[],
  memberId: string,
): T[] {
  return events.filter((event) => !isInvolved(event, memberId));
}

/** `1 impegno degli altri nascosto` / `3 impegni degli altri nascosti`. */
export function formatHiddenCount(count: number): string {
  return count === 1
    ? "1 impegno degli altri nascosto"
    : `${count} impegni degli altri nascosti`;
}

/* ---------- Events and days ---------- */

/** True if the event touches the day `[start, end)`. */
export function touchesDay(event: HouseholdEvent, day: CalendarDay): boolean {
  const start = new Date(event.startsAt).getTime();
  const end = new Date(event.endsAt).getTime();
  const dayStart = day.start.getTime();
  const dayEnd = day.end.getTime();
  return start < dayEnd && end > dayStart;
}

/**
 * Order of the rows: by start; at the same start the shortest first; then by
 * title (an «Occupato» of another has none and goes after).
 */
export function compareEvents(a: HouseholdEvent, b: HouseholdEvent): number {
  const startDiff =
    new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
  if (startDiff !== 0) return startDiff;
  const lengthA = new Date(a.endsAt).getTime() - new Date(a.startsAt).getTime();
  const lengthB = new Date(b.endsAt).getTime() - new Date(b.startsAt).getTime();
  if (lengthA !== lengthB) return lengthA - lengthB;
  const titleA = a.masked ? null : a.title;
  const titleB = b.masked ? null : b.title;
  if (titleA === null && titleB === null) return 0;
  if (titleA === null) return 1;
  if (titleB === null) return -1;
  return titleA.localeCompare(titleB, "it");
}

/** Events of a day, in the order of the rows. */
export function eventsOfDay<T extends HouseholdEvent>(
  events: readonly T[],
  day: CalendarDay,
): T[] {
  return events.filter((event) => touchesDay(event, day)).sort(compareEvents);
}

/* ---------- Liberi insieme ---------- */

/** Evening window, Rome time. */
export const FREE_EVENING_FROM = "18:00";
export const FREE_EVENING_TO = "23:00";
/** Shortest free window that counts, in minutes. */
export const FREE_EVENING_MIN_MINUTES = 60;

const MS_PER_MINUTE = 60_000;

export type Interval = { start: number; end: number };

/** Time in which an adult is busy. `start` and `end` are epoch milliseconds. */
export type BusyInterval = Interval & { memberId: string };

export type FreeEvening = {
  /** Rome day, `YYYY-MM-DD` */
  dayKey: string;
  start: Date;
  end: Date;
  /** True if the window reaches 23:00 («fino a fine serata») */
  untilEndOfEvening: boolean;
  /** True if the window starts at 18:00 and reaches 23:00 */
  wholeEvening: boolean;
};

function adultIsBusyFor(
  event: FullEvent | MaskedEvent,
  adultId: string,
): boolean {
  if (event.masked) return event.authorMemberId === adultId;
  // «Solo io» of the reader does not count (it would tell the others that the
  // person has something on).
  if (event.visibility === "private") return false;
  if (event.memberIds.includes(adultId)) return true;
  if (event.escortMemberId === adultId) return true;
  return event.visibility === "busy" && event.authorMemberId === adultId;
}

/**
 * Intervals in which each adult is busy: visible events («Tutto il Nest» and
 * «Occupato») where the adult takes part, escorts, or is the author of an
 * «Occupato». Events of children alone, without an escort, busy nobody.
 */
export function busyIntervals(
  events: readonly HouseholdEvent[],
  adultIds: readonly string[],
): BusyInterval[] {
  const result: BusyInterval[] = [];
  for (const event of events) {
    const start = new Date(event.startsAt).getTime();
    const end = new Date(event.endsAt).getTime();
    for (const memberId of adultIds) {
      if (adultIsBusyFor(event, memberId))
        result.push({ memberId, start, end });
    }
  }
  return result;
}

/**
 * The longest stretch of the evening (18:00-23:00, Rome) in which no adult is
 * busy, if it lasts at least 60 minutes; at equal length the earliest. `null`
 * if there is none. Does not apply the «one adult» and «empty week» rules:
 * see `computeFreeEvenings`.
 */
export function findFreeEvening(
  dayKey: string,
  busy: readonly Interval[],
): FreeEvening | null {
  const windowStart = fromFieldValues(dayKey, FREE_EVENING_FROM).getTime();
  const windowEnd = fromFieldValues(dayKey, FREE_EVENING_TO).getTime();
  if (Number.isNaN(windowStart) || Number.isNaN(windowEnd)) return null;

  const clipped = busy
    .map((i) => ({
      start: Math.max(i.start, windowStart),
      end: Math.min(i.end, windowEnd),
    }))
    .filter((i) => i.end > i.start)
    .sort((a, b) => a.start - b.start);

  let best: Interval | null = null;
  let cursor = windowStart;
  const consider = (start: number, end: number) => {
    if (end <= start) return;
    if (!best || end - start > best.end - best.start) best = { start, end };
  };
  for (const interval of clipped) {
    consider(cursor, interval.start);
    cursor = Math.max(cursor, interval.end);
  }
  consider(cursor, windowEnd);

  const found = best as Interval | null;
  if (
    !found ||
    found.end - found.start < FREE_EVENING_MIN_MINUTES * MS_PER_MINUTE
  ) {
    return null;
  }
  return {
    dayKey,
    start: new Date(found.start),
    end: new Date(found.end),
    untilEndOfEvening: found.end === windowEnd,
    wholeEvening: found.start === windowStart && found.end === windowEnd,
  };
}

/**
 * «Liberi insieme» of each day, by day key. Rules (issue #25 §8):
 * - the Nest needs at least two adults (with or without an account);
 * - if `events` is empty (nothing visible in the period) there is none;
 * - an adult is busy as in `busyIntervals`.
 * Days without a free evening are not in the map.
 */
export function computeFreeEvenings(
  days: readonly Pick<CalendarDay, "key">[],
  adultIds: readonly string[],
  events: readonly HouseholdEvent[],
): Map<string, FreeEvening> {
  const result = new Map<string, FreeEvening>();
  if (adultIds.length < 2 || events.length === 0) return result;
  const busy = busyIntervals(events, adultIds);
  for (const day of days) {
    const evening = findFreeEvening(day.key, busy);
    if (evening) result.set(day.key, evening);
  }
  return result;
}

/** Panel text: `Tutta la sera, dalle 18:00`, `Dalle 21:30 a fine serata`, ... */
export function formatFreeEveningWindow(evening: FreeEvening): string {
  if (evening.wholeEvening)
    return `Tutta la sera, dalle ${formatTime(evening.start)}`;
  if (evening.untilEndOfEvening) {
    return `Dalle ${formatTime(evening.start)} a fine serata`;
  }
  return `Dalle ${formatTime(evening.start)} alle ${formatTime(evening.end)}`;
}

/** `Tu e Laura`, `Tu, Laura e Paolo`, `Tu e altri 4`. */
export function formatWithYou(otherNames: readonly string[]): string {
  if (otherNames.length === 0) return "Tu";
  if (otherNames.length === 1) return `Tu e ${otherNames[0]}`;
  if (otherNames.length === 2) return `Tu, ${otherNames[0]} e ${otherNames[1]}`;
  return `Tu e altri ${otherNames.length}`;
}

/** Row text: `Tu e Laura, fino a fine serata` / `..., fino alle 20:00`. */
export function formatFreeEveningRow(
  evening: FreeEvening,
  otherNames: readonly string[],
): string {
  const until = evening.untilEndOfEvening
    ? "fino a fine serata"
    : `fino alle ${formatTime(evening.end)}`;
  return `${formatWithYou(otherNames)}, ${until}`;
}
