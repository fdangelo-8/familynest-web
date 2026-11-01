import type { MemberColor } from "@/components/ui/Avatar/Avatar";
import { compareEvents } from "@/lib/calendar";
import type { FreeEvening } from "@/lib/calendar";
import type { CalendarDay } from "@/lib/datetime";
import type { FullEvent, HouseholdEvent } from "@/lib/household-events";

/**
 * Pure rules shared by the week, the day and the month views (issues #25, #26,
 * #27): the members, the texts of the rows and the classes of the grid blocks.
 * No reading and no clock.
 */

export type MemberKind = "adult" | "child" | "pet";

export type Member = {
  id: string;
  name: string;
  color: MemberColor;
  kind: MemberKind;
};

export type Roster = {
  /** In the order of the Nest (creation) */
  members: Member[];
  /** The member of the signed-in user */
  meId: string | null;
};

/** An event with a key that tells apart the repetitions of the same event. */
export type KeyedEvent = HouseholdEvent & { key: string };
export type KeyedFullEvent = FullEvent & { key: string };

export function keyEvents(events: readonly HouseholdEvent[]): KeyedEvent[] {
  return events
    .map((event, index) => ({
      ...event,
      key: `${event.masked ? "busy" : event.id}|${event.startsAt}|${event.endsAt}|${index}`,
    }))
    .sort(compareEvents);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** True if `name` appears in `title` as a whole word. */
export function titleHasName(title: string, name: string): boolean {
  if (!name.trim()) return false;
  return new RegExp(
    `(?<![\\p{L}\\p{N}])${escapeRegExp(name)}(?![\\p{L}\\p{N}])`,
    "iu",
  ).test(title);
}

/** `A`, `A e B`, `A, B e C`. */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}

const KIND_ORDER: Record<MemberKind, number> = { child: 0, adult: 1, pet: 2 };

/** True for a «Solo io» in which I am the only participant (or nobody is). */
export function isSoloTu(event: KeyedFullEvent, meId: string | null): boolean {
  return (
    event.visibility === "private" && event.memberIds.every((id) => id === meId)
  );
}

/** Participants of an event: children first, then adults, then pets. */
export function participantsOf(
  event: KeyedFullEvent,
  members: readonly Member[],
): Member[] {
  return members
    .filter((member) => event.memberIds.includes(member.id))
    .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
}

/** Participants in the order of the Nest (avatars). */
export function participantsInNestOrder(
  event: KeyedFullEvent,
  members: readonly Member[],
): Member[] {
  return members.filter((member) => event.memberIds.includes(member.id));
}

/**
 * Information line of a row: who (if I am not one of them), place, who takes
 * them. Empty parts are skipped.
 */
export function eventInfo(
  event: KeyedFullEvent,
  members: readonly Member[],
  meId: string | null,
): string {
  const parts: string[] = [];
  const participants = participantsOf(event, members);
  const iAmIn = meId !== null && event.memberIds.includes(meId);

  if (isSoloTu(event, meId)) {
    parts.push("Solo tu");
  } else if (!iAmIn) {
    const names = participants
      .map((member) => member.name)
      .filter((name) => !titleHasName(event.title, name));
    if (names.length > 0) parts.push(joinNames(names));
  }

  if (event.location) parts.push(event.location);

  if (event.escortMemberId) {
    const escort = members.find((member) => member.id === event.escortMemberId);
    if (escort) {
      parts.push(
        event.memberIds.length > 1
          ? `li porta ${escort.name}`
          : `la porta ${escort.name}`,
      );
    }
  }
  return parts.join(", ");
}

/** Text that lists the people of an event when they do not fit as avatars. */
export const MAX_AVATARS = 4;

export function peopleTag(
  participants: readonly Member[],
  members: readonly Member[],
): string {
  const everyone = members.filter((member) => member.kind !== "pet");
  const all =
    everyone.length > 0 &&
    everyone.every((member) =>
      participants.some((participant) => participant.id === member.id),
    );
  return all ? "Tutto il Nest" : `${participants.length} persone`;
}

/** Start of the event inside the day (an event that began before shows 0:00). */
export function startInDay(event: HouseholdEvent, day: CalendarDay): Date {
  return new Date(
    Math.max(new Date(event.startsAt).getTime(), day.start.getTime()),
  );
}

export function endInDay(event: HouseholdEvent, day: CalendarDay): Date {
  return new Date(
    Math.min(new Date(event.endsAt).getTime(), day.end.getTime()),
  );
}

export function isPast(endMs: number, nowMs: number): boolean {
  return endMs <= nowMs;
}

/** What one entry of the mobile list or of the desktop day can be. */
export type DayItem =
  | { kind: "event"; key: string; event: KeyedEvent; startMs: number }
  | { kind: "insieme"; key: string; evening: FreeEvening; startMs: number };

/** `Tu e Laura, fino a fine serata` names: adults except me. */
export function eveningOthers(
  adults: readonly Member[],
  meId: string | null,
): string[] {
  return adults
    .filter((member) => member.id !== meId)
    .map((member) => member.name);
}

/* ---------- Grid blocks (week and day) ---------- */

/** Quarters of an hour between 8:00 and 23:00 */
export const QUARTERS = 60;

export function heightClass(quarters: number): string {
  const whole = Math.floor(quarters / 4);
  const rest = quarters % 4;
  return rest === 0
    ? `per-${whole}`
    : `per-${whole}-${["", "25", "5", "75"][rest]}`;
}

export function startClass(quarter: number): string {
  const hour = 8 + Math.floor(quarter / 4);
  const minutes = String((quarter % 4) * 15).padStart(2, "0");
  return `da-${hour}-${minutes}`;
}
