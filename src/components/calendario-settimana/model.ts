import type { MemberColor } from "@/components/ui/Avatar/Avatar";
import {
  computeFreeEvenings,
  compareEvents,
  eventsOfDay,
  filterByLens,
  hiddenByLens,
  type FreeEvening,
  type LensChoice,
} from "@/lib/calendar";
import {
  addDaysToDayKey,
  formatDayNumber,
  formatLongDay,
  formatTime,
  fromFieldValues,
  getWeekDays,
  startOfDay,
  type CalendarDay,
} from "@/lib/datetime";
import type { FullEvent, HouseholdEvent } from "@/lib/household-events";

/**
 * Pure rules of the week view (issue #25): who sees what, the texts of the
 * rows and the position of the blocks. No reading and no clock: `nowMs` comes
 * from the caller.
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

/* ---------- Texts ---------- */

export function formatImpegni(count: number): string {
  return count === 1 ? "1 impegno" : `${count} impegni`;
}

export function dayHeadInfo(count: number, isToday: boolean): string {
  const text = count === 0 ? "niente in programma" : formatImpegni(count);
  return isToday ? `${text} · oggi` : text;
}

/** `Martedì 20 ottobre, 6 impegni` (the lens decides the count). */
export function tabLabel(
  day: CalendarDay,
  count: number | null,
  hasEvening: boolean,
): string {
  const base = formatLongDay(day.start);
  if (count === null) return base;
  const amount = count === 0 ? "nessun impegno" : formatImpegni(count);
  return `${base}, ${amount}${hasEvening ? ", liberi insieme la sera" : ""}`;
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
  const othersOnly = event.memberIds.every((id) => id === meId);

  if (event.visibility === "private" && othersOnly) {
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

/* ---------- Days ---------- */

export type EveningInfo = {
  evening: FreeEvening;
  /** `Tu e Laura, fino a fine serata` pieces */
  otherNames: string[];
  adults: Member[];
};

export type DayView = {
  day: CalendarDay;
  isToday: boolean;
  /** Events the lens shows, in the order of the rows */
  events: KeyedEvent[];
  /** Mobile, lens «Io»: events of the others that the lens hides */
  hiddenCount: number;
  evening: FreeEvening | null;
};

export type WeekView = {
  weekKey: string;
  days: DayView[];
  /** Any visible event in the week, with any lens */
  hasAnyEvent: boolean;
  /** Events of the others that the lens «Io» hides, in the whole week */
  adults: Member[];
  evenings: FreeEvening[];
};

export function buildWeekView(input: {
  weekKey: string;
  events: readonly KeyedEvent[];
  members: readonly Member[];
  meId: string | null;
  lens: LensChoice;
  todayKey: string;
}): WeekView {
  const { weekKey, events, members, meId, lens, todayKey } = input;
  const days = getWeekDays(weekKey);
  const adults = members.filter((member) => member.kind === "adult");
  const evenings = computeFreeEvenings(
    days,
    adults.map((member) => member.id),
    events,
  );
  const lensEvents = filterByLens(events, lens, meId ?? "");
  return {
    weekKey,
    hasAnyEvent: events.length > 0,
    adults,
    evenings: days.flatMap((day) => {
      const evening = evenings.get(day.key);
      return evening ? [evening] : [];
    }),
    days: days.map((day) => {
      const dayEvents = eventsOfDay(lensEvents, day);
      return {
        day,
        isToday: day.key === todayKey,
        events: dayEvents,
        hiddenCount:
          lens === "io" && meId !== null
            ? hiddenByLens(eventsOfDay(events, day), meId).length
            : 0,
        evening: evenings.get(day.key) ?? null,
      };
    }),
  };
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

/** Events and «Liberi insieme» of a day in the order of the rows. */
export function dayItems(view: DayView): DayItem[] {
  const items: DayItem[] = view.events.map((event) => ({
    kind: "event",
    key: event.key,
    event,
    startMs: startInDay(event, view.day).getTime(),
  }));
  if (view.evening) {
    const eveningStart = view.evening.start.getTime();
    let index = items.findIndex((item) => item.startMs > eveningStart);
    if (index === -1) index = items.length;
    items.splice(index, 0, {
      kind: "insieme",
      key: `insieme-${view.day.key}`,
      evening: view.evening,
      startMs: eveningStart,
    });
  }
  return items;
}

/** `Tu e Laura, fino a fine serata` names: adults except me. */
export function eveningOthers(
  adults: readonly Member[],
  meId: string | null,
): string[] {
  return adults
    .filter((member) => member.id !== meId)
    .map((member) => member.name);
}

/* ---------- Selection (desktop) ---------- */

export function isSelectable(item: KeyedEvent): item is KeyedFullEvent {
  return !item.masked;
}

/** The first event not started yet (this week) or the first of the week. */
export function defaultSelection(
  days: readonly DayView[],
  containsToday: boolean,
  nowMs: number,
): KeyedFullEvent | null {
  const candidates: KeyedFullEvent[] = [];
  for (const view of days) {
    for (const event of view.events) {
      if (isSelectable(event)) candidates.push(event);
    }
  }
  candidates.sort(compareEvents);
  if (!containsToday) return candidates[0] ?? null;
  return (
    candidates.find((event) => new Date(event.startsAt).getTime() >= nowMs) ??
    null
  );
}

/* ---------- Grid (desktop) ---------- */

const QUARTERS = 60;

export type Block = {
  key: string;
  kind: "event" | "busy" | "insieme" | "altri";
  item?: DayItem;
  /** Rows hidden by an «Altri N» block */
  hidden?: DayItem[];
  startMs: number;
  endMs: number;
  /** First and last quarter of an hour of the visual block */
  from: number;
  to: number;
  classes: string;
};

function heightClass(quarters: number): string {
  const whole = Math.floor(quarters / 4);
  const rest = quarters % 4;
  return rest === 0
    ? `per-${whole}`
    : `per-${whole}-${["", "25", "5", "75"][rest]}`;
}

function startClass(quarter: number): string {
  const hour = 8 + Math.floor(quarter / 4);
  const minutes = String((quarter % 4) * 15).padStart(2, "0");
  return `da-${hour}-${minutes}`;
}

/** Start quarter (rounded down) and end quarter (rounded up) of a block. */
function quartersOf(
  startMs: number,
  endMs: number,
  gridStart: number,
  gridEnd: number,
): { from: number; to: number } {
  if (endMs <= gridStart) return { from: 0, to: 2 };
  if (startMs >= gridEnd) return { from: QUARTERS - 2, to: QUARTERS };
  const minute = 60_000;
  const from = Math.floor(Math.max(0, (startMs - gridStart) / minute) / 15);
  let to = Math.ceil(
    Math.min((gridEnd - gridStart) / minute, (endMs - gridStart) / minute) / 15,
  );
  if (to - from < 2) to = from + 2;
  if (to > QUARTERS) return { from: QUARTERS - 2, to: QUARTERS };
  return { from, to };
}

/** Blocks of a day with their position and lane classes. */
export function layoutDay(view: DayView): Block[] {
  const gridStart = fromFieldValues(view.day.key, "08:00").getTime();
  const gridEnd = fromFieldValues(view.day.key, "23:00").getTime();

  const blocks: Block[] = dayItems(view).map((item) => {
    const startMs = item.startMs;
    const endMs =
      item.kind === "insieme"
        ? item.evening.end.getTime()
        : endInDay(item.event, view.day).getTime();
    const { from, to } = quartersOf(startMs, endMs, gridStart, gridEnd);
    return {
      key: item.key,
      kind:
        item.kind === "insieme"
          ? "insieme"
          : item.event.masked
            ? "busy"
            : "event",
      item,
      startMs,
      endMs,
      from,
      to,
      classes: "",
    };
  });

  // Group the blocks that touch, then give each one a lane.
  const ordered = [...blocks].sort((a, b) => a.from - b.from || b.to - a.to);
  const result: Block[] = [];
  let cluster: { block: Block; lane: number }[] = [];
  let clusterEnd = -1;
  let laneEnds: number[] = [];

  const flush = () => {
    if (cluster.length === 0) return;
    const lanes = laneEnds.length;
    if (lanes === 1) {
      for (const { block } of cluster) {
        block.classes = `${startClass(block.from)} ${heightClass(block.to - block.from)} corsia-unica`;
        result.push(block);
      }
    } else if (lanes === 2) {
      for (const { block, lane } of cluster) {
        block.classes = `${startClass(block.from)} ${heightClass(block.to - block.from)} ${lane === 0 ? "corsia-a" : "corsia-b"}`;
        result.push(block);
      }
    } else if (lanes <= 4) {
      for (const { block, lane } of cluster) {
        block.classes = `${startClass(block.from)} ${heightClass(block.to - block.from)} persone-${lanes} col-${lane + 1} largo-1`;
        result.push(block);
      }
    } else {
      const hidden: DayItem[] = [];
      let from = QUARTERS;
      let to = 0;
      let startMs = Number.POSITIVE_INFINITY;
      for (const { block, lane } of cluster) {
        if (lane < 3) {
          block.classes = `${startClass(block.from)} ${heightClass(block.to - block.from)} persone-4 col-${lane + 1} largo-1`;
          result.push(block);
        } else if (block.item) {
          hidden.push(block.item);
          from = Math.min(from, block.from);
          to = Math.max(to, block.to);
          startMs = Math.min(startMs, block.startMs);
        }
      }
      result.push({
        key: `altri-${view.day.key}-${from}`,
        kind: "altri",
        hidden,
        startMs,
        endMs: startMs,
        from,
        to,
        classes: `${startClass(from)} ${heightClass(to - from)} persone-4 col-4 largo-1`,
      });
    }
    cluster = [];
    laneEnds = [];
    clusterEnd = -1;
  };

  for (const block of ordered) {
    if (cluster.length > 0 && block.from >= clusterEnd) flush();
    let lane = laneEnds.findIndex((end) => end <= block.from);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(block.to);
    } else {
      laneEnds[lane] = block.to;
    }
    cluster.push({ block, lane });
    clusterEnd = Math.max(clusterEnd, block.to);
  }
  flush();

  return result;
}

/** Hours since 8:00 of an instant on its Rome day (for the «adesso» line). */
export function hoursSinceGridStart(
  nowMs: number,
  dayKey: string,
): number | null {
  const gridStart = fromFieldValues(dayKey, "08:00").getTime();
  const gridEnd = fromFieldValues(dayKey, "23:00").getTime();
  if (nowMs < gridStart || nowMs > gridEnd) return null;
  return (nowMs - gridStart) / 3_600_000;
}

/* ---------- Labels ---------- */

/** Accessible name of a block: `Nuoto Sofia, martedì 20 ottobre, dalle 17:00 alle 18:30, con Sofia`. */
export function blockLabel(
  event: KeyedFullEvent,
  day: CalendarDay,
  members: readonly Member[],
): string {
  const participants = participantsInNestOrder(event, members);
  let who = "";
  if (participants.length > MAX_AVATARS) {
    const tag = peopleTag(participants, members);
    who =
      tag === "Tutto il Nest"
        ? ", con tutto il Nest"
        : `, con ${joinNames(participants.map((member) => member.name))}`;
  } else if (participants.length > 0) {
    who = `, con ${joinNames(participants.map((member) => member.name))}`;
  }
  return `${event.title}, ${formatLongDay(day.start, { capitalized: false })}, dalle ${formatTime(startInDay(event, day))} alle ${formatTime(endInDay(event, day))}${who}${event.visibility === "private" ? ", visibile solo a te" : ""}`;
}

/** `Settimana dal 19 al 25 ottobre` / `Settimana dal 26 ottobre all'1 novembre`. */
export function weekAnnouncement(weekKey: string): string {
  const lastKey = addDaysToDayKey(weekKey, 6);
  const first = startOfDay(weekKey);
  const last = startOfDay(lastKey);
  const day = (key: string) => Number(key.slice(8, 10));
  const month = (date: Date) =>
    formatLongDay(date, { capitalized: false }).split(" ")[2];
  const year = (key: string) => key.slice(0, 4);
  const from = day(weekKey);
  const to = day(lastKey);
  const fromWord = from === 8 || from === 11 ? "dall'" : "dal ";
  const toWord = to === 1 || to === 8 || to === 11 ? "all'" : "al ";
  const fromMonth = month(first);
  const toMonth = month(last);
  if (year(weekKey) !== year(lastKey)) {
    return `Settimana ${fromWord}${from} ${fromMonth} ${year(weekKey)} ${toWord}${to} ${toMonth} ${year(lastKey)}`;
  }
  if (fromMonth !== toMonth) {
    return `Settimana ${fromWord}${from} ${fromMonth} ${toWord}${to} ${toMonth}`;
  }
  return `Settimana ${fromWord}${from} ${toWord}${to} ${toMonth}`;
}

/** `Martedì 20`; the days of the second month carry it (`Domenica 1 novembre`). */
export function dayHeading(view: DayView, weekKey: string): string {
  return formatDayNumber(view.day.start, {
    withMonth: view.day.key.slice(5, 7) !== weekKey.slice(5, 7),
  });
}
