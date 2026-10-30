import type { MemberColor } from "@/components/ui/Avatar/Avatar";
import {
  addDaysToDayKey,
  formatDayNumber,
  formatDeadline,
  getWeekStartKey,
  startOfDay,
  toDayKey,
} from "@/lib/datetime";

/** A thing to do, as the page shows it. */
export type Todo = {
  /** Stable React key: the server id, or the temporary id of a new thing */
  key: string;
  /** Server id (a temporary `tmp-` id until the insert is confirmed) */
  id: string;
  title: string;
  /** «Chi se ne occupa» */
  assigneeId: string | null;
  /** «Per chi è» */
  forId: string | null;
  /** `YYYY-MM-DD`, a day without time */
  dueDate: string | null;
  isPrivate: boolean;
  /** null = still to do */
  doneAt: string | null;
  /** When it was done, kept while the row waits to leave «Fatti» (ordering) */
  doneSortAt: string | null;
  doneById: string | null;
  createdAt: string;
};

export type TodoMember = {
  id: string;
  name: string;
  color: MemberColor;
  kind: "adult" | "child" | "pet";
};

/** `"all"`, `"me"` or the id of a member */
export type TodoFilter = string;

/** «Fatti» keeps what was done in the last 7 × 24 hours. */
const DONE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
/** Deadlines up to today + 3 days are red. */
const URGENT_DAYS = 3;

function timeValue(value: string | null): number {
  const parsed = value ? Date.parse(value) : 0;
  return Number.isNaN(parsed) ? 0 : parsed;
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Oldest first, then by id so the order never jumps. */
function byCreation(a: Todo, b: Todo): number {
  return (
    timeValue(a.createdAt) - timeValue(b.createdAt) ||
    compareStrings(a.id, b.id)
  );
}

/** Earliest deadline first (overdue on top); no date goes last. */
function byDeadline(a: Todo, b: Todo): number {
  if (a.dueDate !== b.dueDate) {
    if (a.dueDate === null) return 1;
    if (b.dueDate === null) return -1;
    return compareStrings(a.dueDate, b.dueDate);
  }
  return byCreation(a, b);
}

/** «Fatti»: the last one done on top. */
function byLastDone(a: Todo, b: Todo): number {
  return (
    timeValue(b.doneSortAt) - timeValue(a.doneSortAt) ||
    compareStrings(a.id, b.id)
  );
}

export type TodoGroups = {
  thisWeek: Todo[];
  later: Todo[];
  done: Todo[];
};

/**
 * A row that was just toggled (`settling`) stays in the group it was in until
 * it settles: «shown open» = not done XOR settling.
 */
export function isShownOpen(
  todo: Todo,
  settling: ReadonlySet<string>,
): boolean {
  return (todo.doneAt === null) !== settling.has(todo.key);
}

/** Does the filter keep this thing? */
export function matchesFilter(
  todo: Todo,
  filter: TodoFilter,
  meMemberId: string | null,
): boolean {
  if (filter === "all") return true;
  if (filter === "me") {
    return meMemberId !== null && todo.assigneeId === meMemberId;
  }
  return todo.assigneeId === filter;
}

export function groupTodos(
  todos: ReadonlyArray<Todo>,
  options: {
    settling: ReadonlySet<string>;
    filter: TodoFilter;
    meMemberId: string | null;
    now: Date;
  },
): TodoGroups {
  const { settling, filter, meMemberId, now } = options;
  const weekEnd = addDaysToDayKey(getWeekStartKey(toDayKey(now)), 6);
  const doneLimit = now.getTime() - DONE_WINDOW_MS;
  const groups: TodoGroups = { thisWeek: [], later: [], done: [] };
  for (const todo of todos) {
    if (!matchesFilter(todo, filter, meMemberId)) continue;
    if (isShownOpen(todo, settling)) {
      if (todo.dueDate !== null && todo.dueDate <= weekEnd) {
        groups.thisWeek.push(todo);
      } else {
        groups.later.push(todo);
      }
    } else if (timeValue(todo.doneSortAt) > doneLimit) {
      groups.done.push(todo);
    }
  }
  groups.thisWeek.sort(byDeadline);
  groups.later.sort(byDeadline);
  groups.done.sort(byLastDone);
  return groups;
}

/** Things still to do (what the switcher and «N aperti» count). */
export function countOpen(todos: ReadonlyArray<Todo>): number {
  return todos.filter((todo) => todo.doneAt === null).length;
}

function capitalizeFirst(text: string): string {
  return text.charAt(0).toLocaleUpperCase("it-IT") + text.slice(1);
}

/** `oggi`, `ieri`, or `sabato 17`. */
function formatDoneWhen(doneAt: string, now: Date): string {
  const doneKey = toDayKey(doneAt);
  const todayKey = toDayKey(now);
  if (doneKey === todayKey) return "oggi";
  if (doneKey === addDaysToDayKey(todayKey, -1)) return "ieri";
  return formatDayNumber(doneAt, { capitalized: false });
}

export type TodoInfo = { text: string; urgent: boolean };

/**
 * The line under the title. Open things: «Per Sofia, entro venerdì, solo tu»;
 * things shown in «Fatti»: «Fatto da Marco, ieri». Red (`urgent`) only for a
 * thing that is really still to do, due up to today + 3 days or overdue.
 */
export function todoInfo(
  todo: Todo,
  options: {
    shownOpen: boolean;
    now: Date;
    membersById: ReadonlyMap<string, TodoMember>;
  },
): TodoInfo | null {
  const { shownOpen, now, membersById } = options;
  const parts: string[] = [];
  if (!shownOpen && todo.doneSortAt) {
    const doneBy = todo.doneById ? membersById.get(todo.doneById) : undefined;
    const when = formatDoneWhen(todo.doneSortAt, now);
    parts.push(doneBy ? `Fatto da ${doneBy.name}, ${when}` : `Fatto ${when}`);
    if (todo.isPrivate) parts.push("solo tu");
    return { text: parts.join(", "), urgent: false };
  }
  const forMember = todo.forId ? membersById.get(todo.forId) : undefined;
  if (forMember) parts.push(`Per ${forMember.name}`);
  if (todo.dueDate) {
    parts.push(
      formatDeadline(startOfDay(todo.dueDate), now, { capitalized: false }),
    );
  }
  if (todo.isPrivate) parts.push("solo tu");
  if (parts.length === 0) return null;
  const urgent =
    todo.doneAt === null &&
    todo.dueDate !== null &&
    todo.dueDate <= addDaysToDayKey(toDayKey(now), URGENT_DAYS);
  return { text: capitalizeFirst(parts.join(", ")), urgent };
}

/** The sentence of the live region after a filter change (WCAG 4.1.3). */
export function filterAnnouncement(options: {
  filter: TodoFilter;
  filterName: string;
  open: number;
  shown: number;
}): string {
  const { filter, filterName, open, shown } = options;
  if (filter === "all") return `${open} da fare in tutto`;
  const who = filter === "me" ? "te" : filterName;
  return shown === 0
    ? `Niente da fare per ${who}`
    : `${open} da fare per ${who}`;
}
