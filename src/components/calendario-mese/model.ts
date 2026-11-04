import { filterByLens, touchesDay, type LensChoice } from "@/lib/calendar";
import {
  addDaysToDayKey,
  formatLongDay,
  formatMonthYear,
  getMonthGridDays,
  getMonthStartKey,
  getWeekStartKey,
  startOfDay,
  type CalendarDay,
} from "@/lib/datetime";
import { holidayName } from "@/lib/holidays";
import {
  formatImpegni,
  buildWeekView,
  type DayView,
} from "@/components/calendario-settimana/model";
import {
  joinNames,
  type KeyedEvent,
  type Member,
} from "@/components/calendario/model";

/**
 * Pure rules of the month view (issue #27): who has a dot, the name of every
 * day and the chosen day. No reading and no clock: `todayKey` comes from the
 * caller.
 */

/** Monday to Sunday, for the column headers (read in full by screen readers). */
export const WEEKDAY_NAMES = [
  "lunedì",
  "martedì",
  "mercoledì",
  "giovedì",
  "venerdì",
  "sabato",
  "domenica",
] as const;

/** From this number of people a day shows 3 dots and the grey one («e altri»). */
export const MANY_PEOPLE = 5;

export type MonthCell = {
  day: CalendarDay;
  /** Number shown in the cell */
  number: number;
  /** The day belongs to the month shown */
  inMonth: boolean;
  weekend: boolean;
  /** Name of the national holiday, if any */
  holiday: string | null;
  isToday: boolean;
  /** People with a dot, in order: me, other adults, children, pets */
  people: Member[];
  /** Events of the lens on the day, or `null` while the data is not there */
  count: number | null;
};

/** The people of a set of ids: me first, then adults, children and pets. */
export function orderPeople(
  ids: ReadonlySet<string>,
  members: readonly Member[],
  meId: string | null,
): Member[] {
  const rank = (member: Member): number => {
    if (member.id === meId) return 0;
    if (member.kind === "adult") return 1;
    if (member.kind === "child") return 2;
    return 3;
  };
  return members
    .map((member, index) => ({ member, index }))
    .filter(({ member }) => ids.has(member.id))
    .sort((a, b) => rank(a.member) - rank(b.member) || a.index - b.index)
    .map(({ member }) => member);
}

/** Members who are busy in one of the events: participants and escort, or the author of an «Occupato». */
function addPeople(ids: Set<string>, event: KeyedEvent): void {
  if (event.masked) {
    ids.add(event.authorMemberId);
    return;
  }
  for (const id of event.memberIds) ids.add(id);
  if (event.escortMemberId) ids.add(event.escortMemberId);
}

/**
 * The days of the grid of a month. Without `events` (loading, or the month
 * could not be read) the days have their number, holiday and «oggi», but no
 * dots and no count.
 */
export function buildMonthCells(input: {
  monthKey: string;
  events: readonly KeyedEvent[] | null;
  members: readonly Member[];
  meId: string | null;
  lens: LensChoice;
  todayKey: string;
}): MonthCell[] {
  const { monthKey, events, members, meId, lens, todayKey } = input;
  const monthPrefix = monthKey.slice(0, 7);
  const lensEvents = events ? filterByLens(events, lens, meId ?? "") : null;
  return getMonthGridDays(monthKey).map((day, index) => {
    let people: Member[] = [];
    let count: number | null = null;
    if (lensEvents) {
      const dayEvents = lensEvents.filter((event) => touchesDay(event, day));
      const ids = new Set<string>();
      for (const event of dayEvents) addPeople(ids, event);
      people = orderPeople(ids, members, meId);
      count = dayEvents.length;
    }
    return {
      day,
      number: Number(day.key.slice(8, 10)),
      inMonth: day.key.startsWith(monthPrefix),
      weekend: index % 7 >= 5,
      holiday: holidayName(day.key),
      isToday: day.key === todayKey,
      people,
      count,
    };
  });
}

/**
 * Name of a cell. It starts with the visible number (WCAG 2.5.3), then the
 * whole day, «oggi», the holiday, and the events with the people of the dots:
 * `20, martedì 20 ottobre, oggi, 3 impegni: tu, Laura, Sofia e Tommaso`.
 */
export function cellLabel(cell: MonthCell, meId: string | null): string {
  const parts = [
    String(cell.number),
    formatLongDay(cell.day.start, { capitalized: false }),
  ];
  if (cell.isToday) parts.push("oggi");
  if (cell.holiday) parts.push(cell.holiday);
  if (cell.count !== null) {
    if (cell.count === 0) {
      parts.push("nessun impegno");
    } else {
      const names = cell.people.map((member) =>
        member.id === meId ? "tu" : member.name,
      );
      const amount = formatImpegni(cell.count);
      parts.push(names.length > 0 ? `${amount}: ${joinNames(names)}` : amount);
    }
  }
  return parts.join(", ");
}

/** The day chosen when the month opens: today if it is in the month, else the 1st. */
export function defaultChoice(monthKey: string, todayKey: string): string {
  const first = getMonthStartKey(monthKey);
  return todayKey.slice(0, 7) === first.slice(0, 7) ? todayKey : first;
}

/**
 * The chosen day with its rows. «Liberi insieme» is calculated on the week of
 * the day with every visible event of that week, whatever the lens.
 */
export function buildChosenDay(input: {
  dayKey: string;
  events: readonly KeyedEvent[];
  members: readonly Member[];
  meId: string | null;
  lens: LensChoice;
  todayKey: string;
}): DayView {
  const { dayKey, events, members, meId, lens, todayKey } = input;
  const weekKey = getWeekStartKey(dayKey);
  const week: CalendarDay = {
    key: weekKey,
    start: startOfDay(weekKey),
    end: startOfDay(addDaysToDayKey(weekKey, 7)),
  };
  const weekEvents = events.filter((event) => touchesDay(event, week));
  const view = buildWeekView({
    weekKey,
    events: weekEvents,
    members,
    meId,
    lens,
    todayKey,
  });
  const chosen = view.days.find((candidate) => candidate.day.key === dayKey);
  // The day is always inside its own week: the fallback only satisfies the types.
  return (
    chosen ?? {
      day: week,
      isToday: false,
      events: [],
      hiddenCount: 0,
      evening: null,
    }
  );
}

/**
 * Information on the right of the head of the day, without empty parts:
 * `oggi · Ognissanti · 2 impegni`. `count` is `null` while the data is not there.
 */
export function chosenInfo(input: {
  isToday: boolean;
  holiday: string | null;
  count: number | null;
}): string {
  const parts: string[] = [];
  if (input.isToday) parts.push("oggi");
  if (input.holiday) parts.push(input.holiday);
  if (input.count !== null && input.count > 0) {
    parts.push(formatImpegni(input.count));
  }
  return parts.join(" · ");
}

/** `Novembre 2026`: the month of the address, as announced and as the title. */
export function monthTitle(monthKey: string): string {
  return formatMonthYear(startOfDay(monthKey));
}
