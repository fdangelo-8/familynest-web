import { formatWithYou, type FreeEvening } from "@/lib/calendar";
import {
  formatDayNumber,
  formatLongDay,
  formatTime,
  fromFieldValues,
  startOfDay,
  toDayKey,
  type CalendarDay,
} from "@/lib/datetime";
import type { FullEvent } from "@/lib/household-events";
import {
  joinNames,
  participantsInNestOrder,
  peopleTag,
  type KeyedEvent,
  type KeyedFullEvent,
  type Member,
} from "@/components/calendario-settimana/model";

/**
 * Pure rules of the day view «chi è dove» (issue #26): who has a column, which
 * columns an event takes, where each block sits and how overlapping blocks
 * share a column. No reading and no clock: `nowMs` comes from the caller.
 */

/* ---------- Columns ---------- */

export type DayColumn = {
  member: Member;
  /** «Tu» for me, the name for the others */
  label: string;
  isMe: boolean;
};

/** A Nest has at most 10 members (#74): the classes of the grid stop there. */
export const MAX_COLUMNS = 10;

function isInEvent(event: KeyedEvent, memberId: string): boolean {
  if (event.masked) return event.authorMemberId === memberId;
  return (
    event.memberIds.includes(memberId) || event.escortMemberId === memberId
  );
}

/**
 * The columns of the day. Lens «Io»: only «Tu». Lens «Nest»: me, the other
 * adults, the children, and the pets that have a visible event that day.
 * `events` are the events the Nest lens shows for the day.
 */
export function buildColumns(input: {
  members: readonly Member[];
  meId: string | null;
  lens: "io" | "nest";
  events: readonly KeyedEvent[];
}): DayColumn[] {
  const { members, meId, lens, events } = input;
  const me = members.find((member) => member.id === meId);
  if (lens === "io" && me) return [{ member: me, label: "Tu", isMe: true }];

  const others = members.filter((member) => member.id !== me?.id);
  const ordered: Member[] = [
    ...others.filter((member) => member.kind === "adult"),
    ...others.filter((member) => member.kind === "child"),
    ...others.filter(
      (member) =>
        member.kind === "pet" &&
        events.some((event) => isInEvent(event, member.id)),
    ),
  ];
  const columns: DayColumn[] = [];
  if (me) columns.push({ member: me, label: "Tu", isMe: true });
  for (const member of ordered) {
    columns.push({ member, label: member.name, isMe: false });
  }
  return columns.slice(0, MAX_COLUMNS);
}

/* ---------- Position classes ---------- */

const QUARTERS = 60;
const QUARTER_MS = 15 * 60_000;

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

/**
 * First and last quarter of an hour of a block, inside the 8:00-23:00 grid.
 * The start is rounded down, the end up. `minimum` is the shortest block in
 * quarters; near 23:00 a block that would go past the grid is moved up.
 */
export function gridQuarters(
  startMs: number,
  endMs: number,
  gridStart: number,
  gridEnd: number,
  minimum: number,
): { from: number; to: number } {
  if (endMs <= gridStart) return { from: 0, to: minimum };
  if (startMs >= gridEnd) return { from: QUARTERS - minimum, to: QUARTERS };
  const from = Math.min(
    QUARTERS - 1,
    Math.floor(Math.max(0, startMs - gridStart) / QUARTER_MS),
  );
  let to = Math.ceil((Math.min(gridEnd, endMs) - gridStart) / QUARTER_MS);
  if (to - from < minimum) to = from + minimum;
  if (to > QUARTERS) return { from: QUARTERS - minimum, to: QUARTERS };
  return { from, to };
}

/* ---------- Blocks ---------- */

export type PieceKind = "event" | "busy" | "insieme" | "altri";

/** One drawn block. An event in several columns can be several pieces. */
export type GridPiece = {
  key: string;
  kind: PieceKind;
  /** The event (full or masked); not for «insieme» and «altri» */
  event?: KeyedEvent;
  evening?: FreeEvening;
  /** Events a crowded stretch of a column could not show («altri») */
  hidden?: KeyedEvent[];
  /** Column of the piece (0-based) */
  column: number;
  /** Position and column classes */
  classes: string;
  from: number;
  to: number;
  /** The piece that carries the text for screen readers and the Tab stop */
  primary: boolean;
};

type Item = {
  id: string;
  kind: "event" | "busy" | "insieme";
  event?: KeyedEvent;
  evening?: FreeEvening;
  cols: number[];
  from: number;
  to: number;
  order: number;
};

type Slot = { n: number; p: number; hidden: boolean };

const MAX_PARTS = 4;

/** Columns an event takes (participants and escort; the author of an «Occupato»). */
function columnsOfEvent(
  event: KeyedEvent,
  columns: readonly DayColumn[],
): number[] {
  if (columns.length === 0) return [];
  const all = columns.map((_, index) => index);
  if (columns.length === 1) return all;
  const ids = event.masked
    ? [event.authorMemberId]
    : [
        ...event.memberIds,
        ...(event.escortMemberId ? [event.escortMemberId] : []),
      ];
  const found: number[] = [];
  columns.forEach((column, index) => {
    if (ids.includes(column.member.id)) found.push(index);
  });
  // Nobody with a column: the event goes on every column.
  return found.length > 0 ? found : all;
}

function place(
  from: number,
  to: number,
  column: number,
  span: number,
  part: { n: number; p: number } | null,
): string {
  return [
    startClass(from),
    heightClass(to - from),
    `col-${column + 1}`,
    `largo-${span}`,
    part && part.n > 1 ? `parte-${part.n}-${part.p}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Blocks of a day with their classes. `compact` (below 1024 px): a visible
 * event lasts at least one hour in the grid, so it can be touched. The parts
 * of overlapping blocks are worked out on the drawn height.
 */
export function layoutDayGrid(input: {
  day: CalendarDay;
  events: readonly KeyedEvent[];
  evening: FreeEvening | null;
  columns: readonly DayColumn[];
  compact: boolean;
}): GridPiece[] {
  const { day, events, evening, columns, compact } = input;
  if (columns.length === 0) return [];
  const gridStart = fromFieldValues(day.key, "08:00").getTime();
  const gridEnd = fromFieldValues(day.key, "23:00").getTime();

  const items: Item[] = events.map((event, order) => {
    const startMs = Math.max(
      new Date(event.startsAt).getTime(),
      day.start.getTime(),
    );
    const endMs = Math.min(new Date(event.endsAt).getTime(), day.end.getTime());
    const minimum = compact && !event.masked ? 4 : 2;
    return {
      id: event.key,
      kind: event.masked ? "busy" : "event",
      event,
      cols: columnsOfEvent(event, columns),
      order,
      ...gridQuarters(startMs, endMs, gridStart, gridEnd, minimum),
    };
  });
  if (evening) {
    const adults = columns.flatMap((column, index) =>
      column.member.kind === "adult" ? [index] : [],
    );
    items.push({
      id: `insieme-${day.key}`,
      kind: "insieme",
      evening,
      cols: columns.length === 1 ? [0] : adults,
      order: items.length,
      ...gridQuarters(
        evening.start.getTime(),
        evening.end.getTime(),
        gridStart,
        gridEnd,
        2,
      ),
    });
  }

  // Column by column: blocks that touch share the width in equal parts.
  const slots = new Map<string, Slot>();
  const crowded: { column: number; from: number; to: number; items: Item[] }[] =
    [];
  columns.forEach((_, column) => {
    const inColumn = items
      .filter((item) => item.cols.includes(column))
      .sort((a, b) => a.from - b.from || b.to - a.to || a.order - b.order);
    let cluster: { item: Item; lane: number }[] = [];
    let laneEnds: number[] = [];
    let clusterEnd = -1;

    const flush = () => {
      if (cluster.length === 0) return;
      const lanes = laneEnds.length;
      const hidden: Item[] = [];
      for (const { item, lane } of cluster) {
        const slotKey = `${item.id}|${column}`;
        if (lanes <= MAX_PARTS) {
          slots.set(slotKey, { n: lanes, p: lane + 1, hidden: false });
        } else if (lane < MAX_PARTS - 1) {
          slots.set(slotKey, { n: MAX_PARTS, p: lane + 1, hidden: false });
        } else {
          slots.set(slotKey, { n: MAX_PARTS, p: MAX_PARTS, hidden: true });
          hidden.push(item);
        }
      }
      if (hidden.length > 0) {
        crowded.push({
          column,
          from: Math.min(...hidden.map((item) => item.from)),
          to: Math.max(...hidden.map((item) => item.to)),
          items: hidden,
        });
      }
      cluster = [];
      laneEnds = [];
      clusterEnd = -1;
    };

    for (const item of inColumn) {
      if (cluster.length > 0 && item.from >= clusterEnd) flush();
      let lane = laneEnds.findIndex((end) => end <= item.from);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(item.to);
      } else {
        laneEnds[lane] = item.to;
      }
      cluster.push({ item, lane });
      clusterEnd = Math.max(clusterEnd, item.to);
    }
    flush();
  });

  const pieces: GridPiece[] = [];
  for (const item of items) {
    // Plain neighbours (the item is alone in its stretch) become one block.
    const runs: {
      column: number;
      span: number;
      part: { n: number; p: number } | null;
    }[] = [];
    for (const column of item.cols) {
      const slot = slots.get(`${item.id}|${column}`);
      if (!slot || slot.hidden) continue;
      const last = runs[runs.length - 1];
      if (
        slot.n === 1 &&
        last &&
        last.part === null &&
        column === last.column + last.span
      ) {
        last.span += 1;
      } else {
        runs.push({ column, span: 1, part: slot.n === 1 ? null : slot });
      }
    }
    const itemPieces: GridPiece[] = runs.map((run) => ({
      key: `${item.id}|${run.column}`,
      kind: item.kind,
      event: item.event,
      evening: item.evening,
      column: run.column,
      classes: place(item.from, item.to, run.column, run.span, run.part),
      from: item.from,
      to: item.to,
      primary: false,
    }));
    const leftmost = itemPieces[0];
    if (leftmost) leftmost.primary = true;
    pieces.push(...itemPieces);
  }

  for (const group of crowded) {
    let from = group.from;
    let to = compact ? Math.max(group.to, from + 4) : group.to;
    if (to > QUARTERS) {
      from = QUARTERS - (to - from);
      to = QUARTERS;
    }
    pieces.push({
      key: `altri-${day.key}-${group.column}-${group.from}`,
      kind: "altri",
      hidden: group.items.flatMap((item) => (item.event ? [item.event] : [])),
      column: group.column,
      classes: place(from, to, group.column, 1, {
        n: MAX_PARTS,
        p: MAX_PARTS,
      }),
      from,
      to,
      primary: true,
    });
  }

  // Reading and Tab order: by start, then the leftmost column, then the longest.
  return pieces.sort(
    (a, b) => a.from - b.from || a.column - b.column || b.to - a.to,
  );
}

/* ---------- Selection (desktop) ---------- */

export function isFull(event: KeyedEvent): event is KeyedFullEvent {
  return !event.masked;
}

/**
 * The event the panel shows when nobody chose one: today the first not
 * finished (the one in progress or the next), or the last if all are over;
 * other days the first. `events` are the day's events, in order.
 */
export function defaultChoice(
  events: readonly KeyedEvent[],
  isToday: boolean,
  nowMs: number,
): KeyedFullEvent | null {
  const choosable = events.filter(isFull);
  if (choosable.length === 0) return null;
  if (!isToday) return choosable[0] ?? null;
  return (
    choosable.find((event) => new Date(event.endsAt).getTime() > nowMs) ??
    choosable[choosable.length - 1] ??
    null
  );
}

/* ---------- Texts ---------- */

/** Days between two day keys (positive if `dayKey` is later). */
function daysBetween(dayKey: string, otherKey: string): number {
  const toUtc = (key: string) => {
    const [year, month, day] = key.split("-").map(Number);
    return Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1);
  };
  return Math.round((toUtc(dayKey) - toUtc(otherKey)) / 86_400_000);
}

/** `Nessuno ha impegni oggi.` / `domani.` / `giovedì 22.` / `Nessuno aveva impegni ieri.` */
export function emptyDayText(dayKey: string, todayKey: string): string {
  const diff = daysBetween(dayKey, todayKey);
  const start = diff < 0 ? "Nessuno aveva impegni" : "Nessuno ha impegni";
  if (diff === 0) return `${start} oggi.`;
  if (diff === 1) return `${start} domani.`;
  if (diff === -1) return `${start} ieri.`;
  const sameMonth = dayKey.slice(0, 7) === todayKey.slice(0, 7);
  const label = formatDayNumber(startOfDay(dayKey), {
    capitalized: false,
    withMonth: !sameMonth,
  });
  return `${start} ${label}.`;
}

/** `Martedì 20 ottobre, oggi` / `Mercoledì 21 ottobre`. */
export function dayAnnouncement(dayKey: string, todayKey: string): string {
  const text = formatLongDay(startOfDay(dayKey));
  return dayKey === todayKey ? `${text}, oggi` : text;
}

function capitalizeFirst(text: string): string {
  return `${text.charAt(0).toLocaleUpperCase("it-IT")}${text.slice(1)}`;
}

/** `, con te e Paolo` / `, con tutto il Nest` / empty without participants. */
function withText(
  event: KeyedFullEvent,
  members: readonly Member[],
  meId: string | null,
): string {
  const people = participantsInNestOrder(event, members);
  if (people.length === 0) return "";
  const nonPets = members.filter((member) => member.kind !== "pet");
  if (nonPets.length > 1 && peopleTag(people, members) === "Tutto il Nest") {
    return ", con tutto il Nest";
  }
  const names = [
    ...people.filter((member) => member.id === meId).map(() => "te"),
    ...people.filter((member) => member.id !== meId).map((m) => m.name),
  ];
  return `, con ${joinNames(names)}`;
}

/** `, la porta Anna` / `, li porti tu` / empty without an escort. */
function escortText(
  event: KeyedFullEvent,
  members: readonly Member[],
  meId: string | null,
): string {
  if (!event.escortMemberId) return "";
  const many = event.memberIds.length > 1;
  if (event.escortMemberId === meId) {
    return many ? ", li porti tu" : ", la porti tu";
  }
  const escort = members.find((member) => member.id === event.escortMemberId);
  if (!escort) return "";
  return many ? `, li porta ${escort.name}` : `, la porta ${escort.name}`;
}

/**
 * What a screen reader reads after the title and the time of a block: who is
 * in it, who takes them, who can see it and the other days it touches.
 */
export function blockDetails(
  event: KeyedFullEvent,
  day: CalendarDay,
  members: readonly Member[],
  meId: string | null,
): string {
  const startsBefore = new Date(event.startsAt).getTime() < day.start.getTime();
  const endsAfter = new Date(event.endsAt).getTime() > day.end.getTime();
  return [
    withText(event, members, meId),
    escortText(event, members, meId),
    event.visibility === "private" ? ", visibile solo a te" : "",
    startsBefore
      ? `, da ${formatDayNumber(event.startsAt, { capitalized: false })}`
      : "",
    endsAfter
      ? `, fino a ${formatDayNumber(event.endsAt, { capitalized: false })}`
      : "",
  ].join("");
}

/** Text of the «Liberi insieme» block for a screen reader. */
export function eveningDetails(
  evening: FreeEvening,
  otherNames: readonly string[],
): string {
  const who = formatWithYou(otherNames).replace(/^Tu/, "tu");
  return `Liberi insieme dalle ${formatTime(evening.start)} alle ${formatTime(evening.end)}: ${who}`;
}

/** Second line of the panel card: `Fino alle 21:30, Monza`. */
export function panelInfo(event: FullEvent, dayKey: string): string {
  const startsBefore = toDayKey(event.startsAt) < dayKey;
  const endsOtherDay = toDayKey(event.endsAt) !== dayKey;
  const until = endsOtherDay
    ? `fino a ${formatDayNumber(event.endsAt, { capitalized: false })} alle ${formatTime(event.endsAt)}`
    : `fino alle ${formatTime(event.endsAt)}`;
  const time = startsBefore
    ? `Da ${formatDayNumber(event.startsAt, { capitalized: false })}, ${until}`
    : capitalizeFirst(until);
  return [time, event.location].filter(Boolean).join(", ");
}
