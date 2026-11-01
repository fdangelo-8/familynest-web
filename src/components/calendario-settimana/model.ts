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
  formatShortWeekday,
  formatTime,
  fromFieldValues,
  getWeekDays,
  startOfDay,
  toDayKey,
  type CalendarDay,
} from "@/lib/datetime";
import {
  MAX_AVATARS,
  QUARTERS,
  endInDay,
  heightClass,
  isSoloTu,
  joinNames,
  participantsInNestOrder,
  peopleTag,
  startClass,
  startInDay,
  type DayItem,
  type KeyedEvent,
  type KeyedFullEvent,
  type Member,
} from "@/components/calendario/model";

/**
 * Pure rules of the week view (issue #25): who sees what, the texts of the
 * rows and the position of the blocks. No reading and no clock: `nowMs` comes
 * from the caller.
 */

/* ---------- Texts ---------- */

export function formatImpegni(count: number): string {
  return count === 1 ? "1 impegno" : `${count} impegni`;
}

export function dayHeadInfo(count: number, isToday: boolean): string {
  const text = count === 0 ? "niente in programma" : formatImpegni(count);
  return isToday ? `${text} · oggi` : text;
}

/**
 * `Mar 20, martedì 20 ottobre, 6 impegni` (the lens decides the count). It starts
 * with the visible text of the tab («Mar» «20»), as WCAG 2.5.3 asks.
 */
export function tabLabel(
  day: CalendarDay,
  count: number | null,
  hasEvening: boolean,
  isToday = false,
): string {
  const base = `${formatShortWeekday(day.start)} ${Number(day.key.slice(8, 10))}, ${formatLongDay(day.start, { capitalized: false })}`;
  if (count === null) return base;
  const amount = count === 0 ? "nessun impegno" : formatImpegni(count);
  return `${base}${isToday ? ", oggi" : ""}, ${amount}${hasEvening ? ", liberi insieme la sera" : ""}`;
}

/* ---------- Days ---------- */

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
  /** «Liberi insieme» of the week, in the order of the days */
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

/**
 * Accessible description of a block: `martedì 20 ottobre, dalle 17:00 alle 18:30, con Sofia`.
 * The accessible name is the visible text (title and time range), so it can
 * never disagree with it (WCAG 2.5.3); the rest goes here.
 */
export function blockDescription(
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
  return `${formatLongDay(day.start, { capitalized: false })}, dalle ${formatTime(startInDay(event, day))} alle ${formatTime(endInDay(event, day))}${who}${event.visibility === "private" ? ", visibile solo a te" : ""}`;
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

/** People of the panel note: `Tutto il Nest`, `Laura e Tommaso`, `Marco, Laura, Sofia e altri 2`. */
export function panelPeople(
  event: KeyedFullEvent,
  people: readonly Member[],
  members: readonly Member[],
  meId: string | null,
): string {
  if (isSoloTu(event, meId)) return "Solo tu";
  if (peopleTag(people, members) === "Tutto il Nest") return "Tutto il Nest";
  const names = people.map((member) => member.name);
  if (names.length > MAX_AVATARS) {
    return `${names.slice(0, 3).join(", ")} e altri ${names.length - 3}`;
  }
  return joinNames(names);
}

/** Information line of the panel card: `Fino alle 21:30, Monza`. */
export function weekPanelInfo(event: KeyedFullEvent, todayKey: string): string {
  const until = `fino alle ${formatTime(event.endsAt)}`;
  const sameDay = toDayKey(event.startsAt) === todayKey;
  return [
    sameDay
      ? `${until.charAt(0).toLocaleUpperCase("it-IT")}${until.slice(1)}`
      : `${formatDayNumber(event.startsAt)}, ${until}`,
    event.location,
  ]
    .filter(Boolean)
    .join(", ");
}
