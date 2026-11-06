import {
  eventInfo,
  eveningOthers,
  joinNames,
  startInDay,
  type KeyedEvent,
  type KeyedFullEvent,
  type Member,
} from "@/components/calendario/model";
import { todoInfo, type TodoMember } from "@/components/casa-da-fare/model";
import {
  computeFreeEvenings,
  filterByLens,
  formatWithYou,
  isInvolved,
  touchesDay,
  type FreeEvening,
} from "@/lib/calendar";
import {
  addDaysToDayKey,
  dayAndMonth,
  daysUntilDay,
  formatDayRange,
  formatFirstDeadline,
  formatLongDay,
  formatShortWeekday,
  formatTime,
  getCalendarDay,
  getWeekStartKey,
  isUrgent,
  startOfDay,
  toDayKey,
  type CalendarDay,
} from "@/lib/datetime";
import {
  getAvailableSpaces,
  countPinnedAvailable,
  isSpaceAvailable,
  SPACES,
  type MemberCounts,
  type SpaceDef,
  type SpaceKey,
} from "@/lib/spaces";
import type { Lens } from "@/lib/lens";
import type {
  DeadlineEntry,
  Household,
  InviteEntry,
  OpenTodo,
  ShoppingEntry,
} from "./read";

/**
 * Pure rules of Oggi (#30): which events go in «Prossimo», «Dopo», «Già
 * fatti», «Domani», «Questa settimana», which things to do and numbers of the
 * house are shown, the starter list and the summary. No reading and no clock:
 * the minute comes in as `nowMs`.
 */

/** «Dopo» says «stasera» when every row starts at this time or later. */
const EVENING_FROM_MINUTES = 17 * 60;
/** «Questa settimana» lists the events that start from this time. */
const WEEK_FROM_MINUTES = 18 * 60;
/** At most this many rows in «Questa settimana». */
export const WEEK_MAX_ROWS = 6;
/** At most this many rows in «Le mie cose» and «Da fare in casa». */
export const TODO_MAX_ROWS = 5;
/** A deadline enters «Nel Nest» this many days before it. */
const NEST_DEADLINE_DAYS = 7;

function minutesOfDay(value: Date): number {
  const [hour, minute] = formatTime(value).split(":");
  return Number(hour) * 60 + Number(minute);
}

function startMs(event: KeyedEvent): number {
  return new Date(event.startsAt).getTime();
}

function endMs(event: KeyedEvent): number {
  return new Date(event.endsAt).getTime();
}

function asFull(event: KeyedEvent): KeyedFullEvent | null {
  return event.masked ? null : (event as KeyedFullEvent);
}

/* ---------- Events of the day ---------- */

export type DopoRow =
  | { kind: "event"; key: string; event: KeyedEvent; inProgress: boolean }
  | { kind: "insieme"; key: string; evening: FreeEvening };

export type WeekRow =
  | {
      kind: "event";
      key: string;
      event: KeyedFullEvent;
      dayKey: string;
      startMs: number;
    }
  | {
      kind: "insieme";
      key: string;
      evening: FreeEvening;
      dayKey: string;
      startMs: number;
    };

export type EventsView = {
  /** Today (Rome) */
  today: CalendarDay;
  tomorrow: CalendarDay;
  prossimo: KeyedFullEvent | null;
  dopo: DopoRow[];
  /** `null` when «Dopo» has no rows */
  dopoInfo: "stasera" | "oggi" | null;
  /** Events of the lens that are over, in order */
  finished: KeyedEvent[];
  /** The lens has nothing today: no event, over or not, and no «Liberi insieme» */
  todayEmpty: boolean;
  /** There were events today but all are over, and nothing is left */
  allDone: boolean;
  tomorrowEvents: KeyedEvent[];
  /** Events of today in which I am not involved (lens «Io», «Nel Nest») */
  othersToday: KeyedFullEvent[];
  week: {
    title: "Questa settimana" | "La prossima settimana";
    range: string;
    rows: WeekRow[];
    more: number;
  };
};

/** The adults of the Nest, with or without an account. */
export function adultsOf(members: readonly Member[]): Member[] {
  return members.filter((member) => member.kind === "adult");
}

export function buildEventsView(input: {
  events: readonly KeyedEvent[];
  lens: Lens;
  meId: string;
  members: readonly Member[];
  nowMs: number;
}): EventsView {
  const { events, lens, meId, members, nowMs } = input;
  const todayKey = toDayKey(nowMs);
  const today = getCalendarDay(todayKey);
  const tomorrow = getCalendarDay(addDaysToDayKey(todayKey, 1));
  const adultIds = adultsOf(members).map((member) => member.id);

  const lensEvents = filterByLens(events, lens, meId);
  const todayEvents = lensEvents.filter((event) => touchesDay(event, today));

  const eveningToday =
    computeFreeEvenings([today], adultIds, events).get(todayKey) ?? null;
  const eveningOpen =
    eveningToday && eveningToday.end.getTime() > nowMs ? eveningToday : null;

  const prossimo =
    todayEvents
      .map(asFull)
      .find((event) => event !== null && startMs(event) > nowMs) ?? null;

  const inProgress = todayEvents.filter(
    (event) => startMs(event) <= nowMs && endMs(event) > nowMs,
  );
  const coming = todayEvents.filter(
    (event) => startMs(event) > nowMs && event !== prossimo,
  );
  const finished = todayEvents.filter((event) => endMs(event) <= nowMs);

  const comingRows: Array<{ at: number; row: DopoRow }> = coming.map(
    (event) => ({
      at: startMs(event),
      row: { kind: "event", key: event.key, event, inProgress: false },
    }),
  );
  if (eveningOpen) {
    comingRows.push({
      at: eveningOpen.start.getTime(),
      row: {
        kind: "insieme",
        key: `insieme|${eveningOpen.dayKey}`,
        evening: eveningOpen,
      },
    });
  }
  // Array.prototype.sort is stable: events keep their order at the same start.
  comingRows.sort((a, b) => a.at - b.at);

  const dopo: DopoRow[] = [
    ...inProgress.map((event): DopoRow => ({
      kind: "event",
      key: event.key,
      event,
      inProgress: true,
    })),
    ...comingRows.map((item) => item.row),
  ];

  const dopoInfo =
    dopo.length === 0
      ? null
      : dopo.every((row) => {
            const start =
              row.kind === "insieme"
                ? row.evening.start
                : startInDay(row.event, today);
            return minutesOfDay(start) >= EVENING_FROM_MINUTES;
          })
        ? "stasera"
        : "oggi";

  const todayEmpty = todayEvents.length === 0 && eveningOpen === null;
  const allDone = finished.length > 0 && prossimo === null && dopo.length === 0;

  // The «Occupato» of the others are only in «Dopo» and «Già fatti».
  const tomorrowEvents = lensEvents.filter(
    (event) => !event.masked && touchesDay(event, tomorrow),
  );

  const othersToday = events.flatMap((event) => {
    const full = asFull(event);
    return full &&
      touchesDay(full, today) &&
      endMs(full) > nowMs &&
      !isInvolved(full, meId)
      ? [full]
      : [];
  });

  return {
    today,
    tomorrow,
    prossimo,
    dopo,
    dopoInfo,
    finished,
    todayEmpty,
    allDone,
    tomorrowEvents,
    othersToday,
    week: buildWeek(events, members, todayKey, nowMs),
  };
}

function buildWeek(
  events: readonly KeyedEvent[],
  members: readonly Member[],
  todayKey: string,
  nowMs: number,
): EventsView["week"] {
  // From tomorrow to Sunday; on Sunday the whole next week.
  const sunday = addDaysToDayKey(getWeekStartKey(todayKey), 6);
  const isSunday = todayKey === sunday;
  const firstKey = addDaysToDayKey(todayKey, 1);
  const lastKey = addDaysToDayKey(getWeekStartKey(firstKey), 6);

  const days: CalendarDay[] = [];
  for (let key = firstKey; key <= lastKey; key = addDaysToDayKey(key, 1)) {
    days.push(getCalendarDay(key));
  }

  const rows: WeekRow[] = [];
  for (const event of events) {
    const full = asFull(event);
    if (!full) continue;
    const dayKey = toDayKey(full.startsAt);
    if (dayKey < firstKey || dayKey > lastKey) continue;
    if (minutesOfDay(new Date(full.startsAt)) < WEEK_FROM_MINUTES) continue;
    rows.push({
      kind: "event",
      key: full.key,
      event: full,
      dayKey,
      startMs: startMs(full),
    });
  }
  const evenings = computeFreeEvenings(
    days,
    adultsOf(members).map((member) => member.id),
    events,
  );
  for (const evening of evenings.values()) {
    rows.push({
      kind: "insieme",
      key: `insieme|${evening.dayKey}`,
      evening,
      dayKey: evening.dayKey,
      startMs: evening.start.getTime(),
    });
  }
  rows.sort((a, b) =>
    a.dayKey === b.dayKey
      ? a.startMs - b.startMs
      : a.dayKey < b.dayKey
        ? -1
        : 1,
  );

  const range =
    firstKey === lastKey
      ? dayAndMonth(startOfDay(firstKey), nowMs)
      : formatDayRange(startOfDay(firstKey), startOfDay(lastKey));

  return {
    title: isSunday ? "La prossima settimana" : "Questa settimana",
    range,
    rows: rows.slice(0, WEEK_MAX_ROWS),
    more: Math.max(0, rows.length - WEEK_MAX_ROWS),
  };
}

/** `Mer 21`: short weekday and day number of the Rome day. */
export function weekDayLabel(dayKey: string): string {
  return `${formatShortWeekday(startOfDay(dayKey))} ${Number(dayKey.slice(8))}`;
}

/** `Già fatto: Palestra`, `Già fatti: A, B`, `Già fatti: A, B, C e altri 2`. */
export function doneLabel(titles: readonly string[]): string {
  if (titles.length === 1) return `Già fatto: ${titles[0]}`;
  if (titles.length <= 3) return `Già fatti: ${titles.join(", ")}`;
  return `Già fatti: ${titles.slice(0, 3).join(", ")} e altri ${titles.length - 3}`;
}

/**
 * The part of the information line of a row that says the place and who takes
 * them. It comes from `eventInfo` (the only place where the sentence «la porta
 * Laura» / «li porta Marco» is written): the event is shown to `eventInfo` as a
 * shared one that the first participant takes part in, so only the place and
 * the escort are left. The place is cut out here, because the rows of Oggi put
 * their own words before it.
 */
export function escortText(
  event: KeyedFullEvent,
  members: readonly Member[],
): string {
  return eventInfo(
    { ...event, location: null, visibility: "household" },
    members,
    event.memberIds[0] ?? null,
  );
}

/** `Fino alle 17:00, Teams, la porta Laura` and, in progress, `In corso, fino alle 17:00`. */
export function untilInfo(
  event: KeyedFullEvent,
  members: readonly Member[],
  day: CalendarDay,
  inProgress = false,
  withEscort = true,
): string {
  const end = new Date(Math.min(endMs(event), day.end.getTime()));
  const parts = [
    `${inProgress ? "In corso, fino" : "Fino"} alle ${formatTime(end)}`,
  ];
  if (event.location) parts.push(event.location);
  const escort = withEscort ? escortText(event, members) : "";
  if (escort) parts.push(escort);
  return parts.join(", ");
}

/** `Alle 17:00, la porta Laura` or `Alle 17:00, Teams` (rows of «Nel Nest»). */
export function atInfo(
  event: KeyedFullEvent,
  members: readonly Member[],
  day: CalendarDay,
): string {
  const parts = [`Alle ${formatTime(startInDay(event, day))}`];
  const escort = escortText(event, members);
  if (escort) parts.push(escort);
  else if (event.location) parts.push(event.location);
  return parts.join(", ");
}

/** Information of a row of «Questa settimana»: `20:00 · Centro sportivo`. */
export function weekRowInfo(
  row: WeekRow,
  members: readonly Member[],
  meId: string,
): string {
  if (row.kind === "insieme") {
    const others = eveningOthers(adultsOf(members), meId);
    return `${formatTime(row.evening.start)} · ${formatWithYou(others)}`;
  }
  const info = eventInfo(row.event, members, meId);
  const time = formatTime(row.event.startsAt);
  return info ? `${time} · ${info}` : time;
}

/* ---------- Things to do ---------- */

export type TodoRowView = {
  todo: OpenTodo;
  /** Just ticked: crossed out, waits for its toast */
  barred: boolean;
  info: { text: string; urgent: boolean } | null;
  /** Avatar of who takes care of it (lens «Nest» only) */
  assignee: Member | null;
};

export type TodosView = {
  rows: TodoRowView[];
  /** Things still open that belong to the lens («N da fare», «N aperti») */
  open: number;
  /** Open things beyond the rows shown */
  more: number;
};

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Earliest deadline first (gone ones too); no date last; then creation. */
function byDeadline(a: OpenTodo, b: OpenTodo): number {
  if (a.dueDate !== b.dueDate) {
    if (a.dueDate === null) return 1;
    if (b.dueDate === null) return -1;
    return compareText(a.dueDate, b.dueDate);
  }
  return compareText(a.createdAt, b.createdAt) || compareText(a.id, b.id);
}

export function buildTodosView(input: {
  todos: readonly OpenTodo[];
  /** Ticked things that wait for their toast, by id */
  barred: ReadonlyMap<string, OpenTodo>;
  /** Ticked things that are not shown any more (waiting to be written) */
  hidden: ReadonlySet<string>;
  lens: Lens;
  meId: string;
  members: readonly Member[];
  nowMs: number;
}): TodosView {
  const { todos, barred, hidden, lens, meId, members, nowMs } = input;
  const belongs = (todo: OpenTodo) =>
    lens === "io"
      ? todo.assigneeId === meId ||
        (todo.isPrivate && todo.createdById === meId)
      : !todo.isPrivate;

  const open = todos.filter((todo) => !hidden.has(todo.id) && belongs(todo));
  const barredList = [...barred.values()].filter(belongs);
  const all = [...open, ...barredList].sort(byDeadline);

  const now = new Date(nowMs);
  const membersById = new Map<string, TodoMember>(
    members.map((member) => [member.id, member]),
  );
  const shown = all.slice(0, TODO_MAX_ROWS).map((todo): TodoRowView => {
    const isBarred = barred.has(todo.id);
    const info = todoInfo(todo, { shownOpen: true, now, membersById });
    return {
      todo,
      barred: isBarred,
      info: info ? { text: info.text, urgent: info.urgent && !isBarred } : null,
      assignee:
        lens === "nest" && todo.assigneeId
          ? (members.find((member) => member.id === todo.assigneeId) ?? null)
          : null,
    };
  });
  const shownOpen = shown.filter((row) => !row.barred).length;
  return {
    rows: shown,
    open: open.length,
    more: open.length - shownOpen,
  };
}

/* ---------- The house ---------- */

/** `Latte`, `Latte e pane`, `Latte, pane e mele`, `Latte, pane, mele e altro`. */
export function shoppingInfo(items: readonly ShoppingEntry[]): string {
  const names = items
    .slice(0, 3)
    .map((item, index) =>
      index === 0
        ? item.name
        : item.name.charAt(0).toLocaleLowerCase("it-IT") + item.name.slice(1),
    );
  if (items.length > 3) return `${names.join(", ")} e altro`;
  return joinNames(names);
}

export type DeadlineView = {
  deadline: DeadlineEntry;
  days: number;
  urgent: boolean;
};

function byDue(a: DeadlineEntry, b: DeadlineEntry): number {
  return (
    compareText(a.dueDate, b.dueDate) ||
    compareText(a.createdAt, b.createdAt) ||
    compareText(a.id, b.id)
  );
}

function toDeadlineView(deadline: DeadlineEntry, nowMs: number): DeadlineView {
  const days = daysUntilDay(deadline.dueDate, nowMs);
  return { deadline, days, urgent: isUrgent(days) };
}

export type HouseView = {
  shoppingCount: number;
  shoppingInfo: string;
  /** The nearest deadline within 7 days, mine «Solo io» included (lens «Io») */
  nestDeadline: DeadlineView | null;
  /** The shared deadlines, nearest first (lens «Nest») */
  shared: DeadlineView[];
};

export function buildHouseView(input: {
  shopping: readonly ShoppingEntry[];
  deadlines: readonly DeadlineEntry[];
  nowMs: number;
}): HouseView {
  const { shopping, deadlines, nowMs } = input;
  const sorted = [...deadlines].sort(byDue);
  const views = sorted.map((deadline) => toDeadlineView(deadline, nowMs));
  const first = views[0] ?? null;
  return {
    shoppingCount: shopping.length,
    shoppingInfo: shopping.length > 0 ? shoppingInfo(shopping) : "",
    nestDeadline: first && first.days <= NEST_DEADLINE_DAYS ? first : null,
    shared: views.filter((view) => !view.deadline.isPrivate),
  };
}

/** `Il primo scade venerdì`, `Nessuno ha una data`, `Niente da fare in casa`. */
export function todoCounterInfo(
  sharedOpen: readonly OpenTodo[],
  nowMs: number,
): string {
  if (sharedOpen.length === 0) return "Niente da fare in casa";
  const dates = sharedOpen
    .map((todo) => todo.dueDate)
    .filter((date): date is string => date !== null)
    .sort();
  const first = dates[0];
  if (first === undefined) return "Nessuno ha una data";
  return formatFirstDeadline(startOfDay(first), nowMs);
}

/* ---------- Spaces ---------- */

export type SpacesView = {
  spaces: SpaceDef[];
  /** Available spaces that are not pinned (the dashed card) */
  others: number;
};

export function memberCounts(members: readonly Member[]): MemberCounts {
  return {
    adults: members.filter((member) => member.kind === "adult").length,
    children: members.filter((member) => member.kind === "child").length,
    pets: members.filter((member) => member.kind === "pet").length,
  };
}

/** `null` when there is nothing to show. */
export function buildSpacesView(
  pinned: readonly SpaceKey[],
  members: readonly Member[],
): SpacesView | null {
  const counts = memberCounts(members);
  const shown = pinned
    .filter((key) => isSpaceAvailable(key, counts))
    .map((key) => SPACES.find((space) => space.key === key))
    .filter((space): space is SpaceDef => space !== undefined);
  if (shown.length === 0) return null;
  return {
    spaces: shown,
    others: Math.max(
      0,
      getAvailableSpaces(counts).length - countPinnedAvailable(pinned, counts),
    ),
  };
}

/* ---------- Starter list ---------- */

export type StarterStep = {
  key: "nest" | "calendario" | "spesa" | "invito";
  done: boolean;
  text: string;
  /** `Invito inviato`, `Inviti inviati` */
  tag?: string;
  href?: string;
};

export type StarterView = {
  steps: StarterStep[];
  doneCount: number;
  allDone: boolean;
  title: string;
};

const NUMBER_WORDS = ["Zero", "Una", "Due", "Tre", "Quattro", "Cinque"];

function nameOf(members: readonly Member[], id: string): string | null {
  return members.find((member) => member.id === id)?.name ?? null;
}

function inviteText(names: readonly string[]): string {
  return `Aspetta che ${joinNames(names)} ${names.length > 1 ? "entrino" : "entri"}`;
}

/** `null` when the list is not for this person, or already completed. */
export function buildStarter(input: {
  household: Household | null;
  invites: readonly InviteEntry[] | null;
  isAdmin: boolean;
  members: readonly Member[];
  nowMs: number;
}): StarterView | null {
  const { household, invites, isAdmin, members, nowMs } = input;
  if (!isAdmin || !household || household.starterCompletedAt !== null) {
    return null;
  }
  if (invites === null) return null;

  const steps: StarterStep[] = [
    { key: "nest", done: true, text: "Crea il Nest" },
    {
      key: "calendario",
      done: household.hasLinkedCalendar,
      text: "Collega il tuo calendario",
      href: "/calendari-collegati",
    },
    {
      key: "spesa",
      done: household.firstShoppingAt !== null,
      text: "Scrivi la prima cosa da comprare",
      href: "/casa/spesa",
    },
  ];

  const names = (entries: readonly InviteEntry[]) =>
    Array.from(new Set(entries.map((entry) => entry.memberId)))
      .map((id) => nameOf(members, id))
      .filter((name): name is string => name !== null);
  // A revoked or expired invitation does not count and is not shown.
  const waiting = invites.filter(
    (entry) =>
      entry.status === "pending" && new Date(entry.expiresAt).getTime() > nowMs,
  );
  const joined = invites.filter((entry) => entry.status === "accepted");
  const waitingNames = names(waiting);
  const joinedNames = names(joined);
  if (waitingNames.length > 0) {
    steps.push({
      key: "invito",
      done: false,
      text: inviteText(waitingNames),
      tag: waitingNames.length > 1 ? "Inviti inviati" : "Invito inviato",
    });
  } else if (joinedNames.length > 0) {
    steps.push({ key: "invito", done: true, text: inviteText(joinedNames) });
  }

  const doneCount = steps.filter((step) => step.done).length;
  return {
    steps,
    doneCount,
    allDone: doneCount === steps.length,
    title: `${NUMBER_WORDS[steps.length] ?? steps.length} cose e la casa è pronta`,
  };
}

/* ---------- Summary for who joined with an invitation ---------- */

export type SummaryView = {
  event: { when: "Oggi" | "Domani"; title: string; time: string } | null;
  shopping: number;
  /** `Stasera`, `Domani sera`, `Venerdì sera` */
  free: string | null;
};

export function buildSummary(input: {
  events: readonly KeyedEvent[];
  members: readonly Member[];
  shoppingCount: number;
  nowMs: number;
}): SummaryView {
  const { events, members, shoppingCount, nowMs } = input;
  const todayKey = toDayKey(nowMs);
  const tomorrowKey = addDaysToDayKey(todayKey, 1);
  const today = getCalendarDay(todayKey);
  const tomorrow = getCalendarDay(tomorrowKey);

  // Only the events of everybody: nothing «Solo io» or «Occupato».
  const shared = events.flatMap((event) => {
    const full = asFull(event);
    return full && full.visibility === "household" ? [full] : [];
  });
  const todayNext = shared.find(
    (event) => touchesDay(event, today) && startMs(event) > nowMs,
  );
  const tomorrowFirst = shared.find((event) => touchesDay(event, tomorrow));
  const chosen = todayNext ?? tomorrowFirst ?? null;
  const when = todayNext ? "Oggi" : "Domani";

  const days = Array.from({ length: 7 }, (_, index) =>
    getCalendarDay(addDaysToDayKey(todayKey, index)),
  );
  const evenings = computeFreeEvenings(
    days,
    adultsOf(members).map((member) => member.id),
    events,
  );
  const evening = days
    .map((day) => evenings.get(day.key))
    .find((item) => item !== undefined && item.end.getTime() > nowMs);
  let free: string | null = null;
  if (evening) {
    if (evening.dayKey === todayKey) free = "Stasera";
    else if (evening.dayKey === tomorrowKey) free = "Domani sera";
    else {
      const weekday = formatLongDay(startOfDay(evening.dayKey)).split(" ")[0];
      free = `${weekday} sera`;
    }
  }

  return {
    event: chosen
      ? {
          when,
          title: chosen.title,
          time: formatTime(
            startInDay(chosen, when === "Oggi" ? today : tomorrow),
          ),
        }
      : null,
    shopping: shoppingCount,
    free,
  };
}
