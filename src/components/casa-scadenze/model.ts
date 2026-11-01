import type { MemberColor } from "@/components/ui/Avatar/Avatar";
import {
  dayAndMonth,
  daysUntilDay,
  formatDeadline,
  howMuch,
  isUrgent,
  startOfDay,
  type HowMuch,
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

/** `3 novembre`, or `20 gennaio 2027` when the year is not the current one. */
export function writtenDate(dueDate: string, now: Instant): string {
  return dayAndMonth(startOfDay(dueDate), now);
}

function capitalizeFirst(text: string): string {
  return text.charAt(0).toLocaleUpperCase("it-IT") + text.slice(1);
}

export type DeadlineView = {
  deadline: Deadline;
  howMuch: HowMuch;
  /** The due day is before today (Rome): the row goes in «Scadute» */
  overdue: boolean;
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
): DeadlineView {
  const days = daysUntilDay(deadline.dueDate, now);
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
    overdue: days < 0,
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
