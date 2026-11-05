import type { IconName } from "@/components/ui/Icon/Icon";
import type { MemberColor } from "@/components/ui/Avatar/Avatar";
import { formatBusyLabel } from "@/lib/calendar";
import {
  URGENT_DAYS,
  addDaysToDayKey,
  dayAndMonth,
  daysUntilDay,
  formatDaysUntil,
  formatDeadline,
  formatShortWeekday,
  formatTimeRange,
  isUrgent,
  startOfDay,
  toDayKey,
} from "@/lib/datetime";
import { formatRecurrence } from "@/lib/event-texts";
import {
  SEARCH_KINDS,
  eventHitHref,
  type SearchHit,
  type SearchKind,
} from "@/lib/search-household";
import { highlightParts, type TitlePart } from "./highlight";

/** What the page knows of a member of the Nest. */
export type PersonView = {
  id: string;
  name: string;
  color: MemberColor;
  kind: string;
};

/** Filter chips (mobile): everything, or one kind. */
export type FilterKey = "all" | SearchKind;

/** Order of the chips, as in the mockup. */
export const FILTER_ORDER: readonly FilterKey[] = [
  "all",
  "event",
  "shopping_item",
  "todo",
  "deadline",
];

export const FILTER_LABELS: Record<FilterKey, string> = {
  all: "Tutto",
  event: "Impegni",
  shopping_item: "Spesa",
  todo: "Da fare",
  deadline: "Scadenze",
};

/** Titles of the groups of results. */
export const GROUP_TITLES: Record<SearchKind, string> = {
  event: "Impegni",
  deadline: "Scadenze",
  todo: "Da fare",
  shopping_item: "Spesa",
};

/** Where the rows that are not events lead. */
export const KIND_HREFS = {
  deadline: "/casa/scadenze",
  todo: "/casa/da-fare",
  shopping_item: "/casa/spesa",
} as const;

export const FIELD_PLACEHOLDER = "Cerca nel Nest";

export type RowLead =
  { type: "day"; text: string } | { type: "icon"; icon: IconName };

/** Everything a row shows, ready to be drawn on mobile or in the palette. */
export type RowModel = {
  key: string;
  kind: SearchKind;
  /** «Occupato» of another person: not a link, nothing but time and author */
  masked: boolean;
  /** null for the masked rows */
  href: string | null;
  lead: RowLead;
  title: TitlePart[];
  titleText: string;
  info: string | null;
  urgent: boolean;
  /** Events only: a «Solo io» the reader sees in full */
  locked: boolean;
  avatarMemberId: string | null;
  /** Things to do only: what the box on mobile changes */
  todoId: string | null;
};

type BuildContext = {
  now: Date;
  /** Words looked for, to highlight in the titles */
  words: readonly string[];
  people: ReadonlyMap<string, PersonView>;
};

function capitalizeFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function dayLead(dayKey: string, now: Date): string {
  const days = daysUntilDay(dayKey, now);
  if (days === 0) return "Oggi";
  if (days >= 1 && days <= 6) return formatShortWeekday(startOfDay(dayKey));
  return String(Number(dayKey.slice(8, 10)));
}

/** «17:00 – 18:30», with the day first when it is not in this month. */
function timeInfo(
  hit: { startsAt: string; endsAt: string; occurrenceDay: string },
  now: Date,
): string {
  const range = formatTimeRange(hit.startsAt, hit.endsAt);
  const sameMonth = hit.occurrenceDay.slice(0, 7) === toDayKey(now).slice(0, 7);
  return sameMonth
    ? range
    : `${dayAndMonth(startOfDay(hit.occurrenceDay), now)}, ${range}`;
}

function buildRow(
  hit: SearchHit,
  index: number,
  context: BuildContext,
): RowModel | null {
  const { now, words, people } = context;
  if (hit.kind === "event") {
    if (hit.masked) {
      const author = people.get(hit.authorMemberId);
      // Without the author's name there is nothing honest to say.
      if (!author) return null;
      const label = formatBusyLabel(author.name);
      return {
        key: `busy-${index}`,
        kind: "event",
        masked: true,
        href: null,
        lead: { type: "day", text: dayLead(hit.occurrenceDay, now) },
        title: [{ text: label, mark: false }],
        titleText: label,
        info: timeInfo(hit, now),
        urgent: false,
        locked: false,
        avatarMemberId: author.id,
        todoId: null,
      };
    }
    const place = hit.location ? `, ${hit.location}` : "";
    return {
      key: `event-${index}`,
      kind: "event",
      masked: false,
      href: eventHitHref(hit),
      lead: { type: "day", text: dayLead(hit.occurrenceDay, now) },
      title: highlightParts(hit.title, words),
      titleText: hit.title,
      info: `${timeInfo(hit, now)}${place}`,
      urgent: false,
      locked: hit.visibility === "private",
      avatarMemberId: hit.memberIds[0] ?? hit.authorMemberId,
      todoId: null,
    };
  }

  if (hit.kind === "deadline") {
    const days = hit.dueDate ? daysUntilDay(hit.dueDate, now) : null;
    const parts: string[] = [];
    if (hit.dueDate) {
      parts.push(
        capitalizeFirst(formatDaysUntil(startOfDay(hit.dueDate), now)),
      );
    }
    if (hit.isPrivate) parts.push("solo tu");
    return {
      key: `deadline-${index}`,
      kind: "deadline",
      masked: false,
      href: KIND_HREFS.deadline,
      lead: { type: "icon", icon: "file-clock" },
      title: highlightParts(hit.title, words),
      titleText: hit.title,
      info: parts.length > 0 ? parts.join(", ") : null,
      urgent: days !== null && isUrgent(days),
      locked: false,
      avatarMemberId: hit.forMemberId ?? hit.assigneeMemberId,
      todoId: null,
    };
  }

  if (hit.kind === "todo") {
    const assignee = hit.assigneeMemberId
      ? people.get(hit.assigneeMemberId)
      : undefined;
    const parts: string[] = [];
    if (assignee) parts.push(assignee.name);
    if (hit.dueDate) {
      parts.push(
        formatDeadline(startOfDay(hit.dueDate), now, { capitalized: false }),
      );
    }
    if (hit.isPrivate) parts.push("solo tu");
    return {
      key: `todo-${index}`,
      kind: "todo",
      masked: false,
      href: KIND_HREFS.todo,
      lead: { type: "icon", icon: "square-check" },
      title: highlightParts(hit.title, words),
      titleText: hit.title,
      info: parts.length > 0 ? capitalizeFirst(parts.join(", ")) : null,
      urgent:
        hit.dueDate !== null &&
        hit.dueDate <= addDaysToDayKey(toDayKey(now), URGENT_DAYS),
      locked: false,
      avatarMemberId: hit.assigneeMemberId,
      todoId: hit.id,
    };
  }

  return {
    key: `shopping-${index}`,
    kind: "shopping_item",
    masked: false,
    href: KIND_HREFS.shopping_item,
    lead: { type: "icon", icon: "shopping-basket" },
    title: highlightParts(hit.title, words),
    titleText: hit.title,
    info: hit.quantity,
    urgent: false,
    locked: false,
    avatarMemberId: null,
    todoId: null,
  };
}

export type RowGroups = Record<SearchKind, RowModel[]>;

/** Rows of the hits, grouped by kind in the order the database gave them. */
export function buildGroups(
  hits: readonly SearchHit[],
  context: BuildContext,
): RowGroups {
  const groups: RowGroups = {
    event: [],
    deadline: [],
    todo: [],
    shopping_item: [],
  };
  hits.forEach((hit, index) => {
    const row = buildRow(hit, index, context);
    if (row) groups[row.kind].push(row);
  });
  return groups;
}

/** Number of rows shown for each chip («Tutto» is the sum). */
export function countRows(groups: RowGroups): Record<FilterKey, number> {
  const counts = {
    event: groups.event.length,
    deadline: groups.deadline.length,
    todo: groups.todo.length,
    shopping_item: groups.shopping_item.length,
  };
  return {
    ...counts,
    all: SEARCH_KINDS.reduce((sum, kind) => sum + counts[kind], 0),
  };
}

/**
 * Info of the group of events: the rule of the series («ogni martedì e
 * giovedì») when every row is an occurrence of the same repeated event.
 */
export function eventGroupInfo(
  hits: readonly SearchHit[],
  now: Date,
): string | null {
  const events = hits.filter((hit) => hit.kind === "event");
  if (events.length === 0) return null;
  const first = events[0];
  if (!first || first.kind !== "event" || first.masked) return null;
  if (first.recurrence === "none") return null;
  const same = events.every(
    (hit) => hit.kind === "event" && !hit.masked && hit.id === first.id,
  );
  if (!same) return null;
  const text = formatRecurrence(
    {
      recurrence: first.recurrence,
      weekdays: first.recurrenceWeekdays,
      seriesDay: first.seriesStartsOn,
      until: null,
    },
    now,
    { capitalized: false, withUntil: false },
  );
  return text === "" ? null : text;
}

/** The sentence of the hidden live region, said when the results arrive. */
export function resultsAnnouncement(
  text: string,
  total: number,
  filter: FilterKey,
): string {
  const where = filter === "all" ? "" : ` in ${FILTER_LABELS[filter]}`;
  if (total === 0) return `Nessun risultato${where} per «${text}»`;
  const word = total === 1 ? "risultato" : "risultati";
  return `${total} ${word}${where} per «${text}»`;
}

export const ERROR_TEXT =
  "Non siamo riusciti a cercare. Controlla la connessione e riprova.";
export const OFFLINE_TEXT =
  "Sei offline: la ricerca riparte appena torna la connessione.";
export const SAVE_FAILED_TEXT =
  "Non siamo riusciti a salvare la modifica. Riprova tra qualche secondo.";
export const RECENTS_CLEARED_TEXT = "Ricerche recenti cancellate.";

/** Examples of the mockup: fixed texts, whoever lives in the Nest. */
export const EXAMPLES: readonly string[] = [
  "questo weekend",
  "cose di Sofia",
  "scade a novembre",
];

export function emptyTitle(text: string, filter: FilterKey): string {
  return filter === "all"
    ? `Nessun risultato per «${text}»`
    : `Nessun risultato in ${FILTER_LABELS[filter]} per «${text}»`;
}
