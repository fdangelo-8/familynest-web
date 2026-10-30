import type { MemberColor } from "@/components/ui/Avatar/Avatar";
import {
  formatDayNumber,
  formatDeadline,
  startOfDay,
  toDayKey,
  type Instant,
} from "@/lib/datetime";

/** A deadline of the Nest, as the page shows it. */
export type Deadline = {
  id: string;
  title: string;
  /** `YYYY-MM-DD` calendar day, no time */
  dueDate: string;
  note: string | null;
  assigneeId: string | null;
  forMemberId: string | null;
  isPrivate: boolean;
  createdAt: string;
};

export type DeadlineMember = {
  id: string;
  name: string;
  color: MemberColor;
};

/** A deadline is urgent from 14 days before it (the mockup draws 14 as urgent). */
export const URGENT_DAYS = 14;
/** Up to this many days the number counts days; beyond, it counts months. */
const DAYS_LIMIT = 60;
const DAYS_PER_MONTH = 30;
const MS_PER_DAY = 86_400_000;

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Due date, then oldest created, then id. */
export function byDueDate(a: Deadline, b: Deadline): number {
  return (
    compareStrings(a.dueDate, b.dueDate) ||
    compareStrings(a.createdAt, b.createdAt) ||
    compareStrings(a.id, b.id)
  );
}

function dayNumber(dayKey: string): number {
  const [year, month, day] = dayKey.split("-").map(Number);
  return Math.floor(
    Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1) / MS_PER_DAY,
  );
}

/** Calendar days from today to the due day (both Rome `YYYY-MM-DD` keys). */
export function daysUntil(dueDate: string, todayKey: string): number {
  return dayNumber(dueDate) - dayNumber(todayKey);
}

export function isUrgent(days: number): boolean {
  return days <= URGENT_DAYS;
}

export type HowMuch = {
  /** The big number, or the word "Oggi" */
  number: string;
  /** Unit under the number; null for "Oggi" */
  unit: string | null;
  /** The number is a word: it uses the smaller type */
  word: boolean;
};

/** How much is left (or how late it is), as the big number and its unit. */
export function howMuch(days: number): HowMuch {
  if (days === 0) return { number: "Oggi", unit: null, word: true };
  if (days < 0) {
    const late = -days;
    if (late > DAYS_LIMIT) {
      return {
        number: String(Math.floor(late / DAYS_PER_MONTH)),
        unit: "mesi fa",
        word: false,
      };
    }
    return {
      number: String(late),
      unit: late === 1 ? "giorno fa" : "giorni fa",
      word: false,
    };
  }
  if (days > DAYS_LIMIT) {
    return {
      number: String(Math.floor(days / DAYS_PER_MONTH)),
      unit: "mesi",
      word: false,
    };
  }
  return {
    number: String(days),
    unit: days === 1 ? "giorno" : "giorni",
    word: false,
  };
}

/** `3 novembre`, or `20 gennaio 2027` when the year is not the current one. */
export function writtenDate(dueDate: string, now: Instant): string {
  const due = startOfDay(dueDate);
  // `Martedì 3 novembre` without the weekday.
  const dayAndMonth = formatDayNumber(due, { withMonth: true })
    .split(" ")
    .slice(1)
    .join(" ");
  return dueDate.slice(0, 4) === toDayKey(now).slice(0, 4)
    ? dayAndMonth
    : `${dayAndMonth} ${dueDate.slice(0, 4)}`;
}

function capitalizeFirst(text: string): string {
  return text.charAt(0).toLocaleUpperCase("it-IT") + text.slice(1);
}

export type DeadlineView = {
  deadline: Deadline;
  howMuch: HowMuch;
  urgent: boolean;
  /** Visible line under the title */
  info: string;
  /** Member of the avatar: who takes care of it, else who it is about */
  avatar: DeadlineMember | null;
  /** Hidden text that tells what the avatar means, or null */
  hiddenNote: string | null;
};

/** Everything a row shows, from the data and the member who is looking. */
export function toView(
  deadline: Deadline,
  membersById: ReadonlyMap<string, DeadlineMember>,
  meId: string | null,
  now: Instant,
  todayKey: string,
): DeadlineView {
  const days = daysUntil(deadline.dueDate, todayKey);
  const assignee = deadline.assigneeId
    ? (membersById.get(deadline.assigneeId) ?? null)
    : null;
  const about = deadline.forMemberId
    ? (membersById.get(deadline.forMemberId) ?? null)
    : null;
  const avatar = assignee ?? about;

  const date =
    days < 0
      ? formatDeadline(startOfDay(deadline.dueDate), now, {
          capitalized: false,
        })
      : writtenDate(deadline.dueDate, now);
  const takenByOther =
    assignee !== null && assignee.id !== meId && !deadline.isPrivate;
  const parts = [
    deadline.note,
    date,
    deadline.isPrivate ? "solo tu" : null,
    takenByOther ? `se ne occupa ${assignee.name}` : null,
  ].filter((part): part is string => part !== null);

  let hiddenNote: string | null = null;
  if (assignee) {
    if (assignee.id === meId) hiddenNote = ", te ne occupi tu";
  } else if (about) {
    hiddenNote = `, riguarda ${about.name}`;
  }

  return {
    deadline,
    howMuch: howMuch(days),
    urgent: isUrgent(days),
    info: capitalizeFirst(parts.join(", ")),
    avatar,
    hiddenNote,
  };
}

export function urgentLabel(count: number): string | undefined {
  if (count <= 0) return undefined;
  return count === 1 ? "1 urgente" : `${count} urgenti`;
}
