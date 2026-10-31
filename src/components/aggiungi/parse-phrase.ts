import {
  addDaysToDayKey,
  fromFieldValues,
  isValidDayKey,
  toDayKey,
} from "../../lib/datetime";

/**
 * Reads a phrase like «Nuoto Sofia giovedì alle 17» (issue #20, requisito §4).
 * Pure code that runs in the browser: the text never leaves the app. Day and
 * time are read in Rome. Only the first day expression and the first time
 * expression count; everything else stays in the title.
 */

export type PhraseMember = { id: string; name: string };

export type ParsedPhrase = {
  /** The phrase without day and time, first letter in capitals; may be empty */
  title: string;
  /** `YYYY-MM-DD` of the day written in the phrase, null if there is none */
  dayKey: string | null;
  /** Minutes from midnight; `end` is null when the phrase gives no end */
  time: { start: number; end: number | null } | null;
  /** Recognized members, in the order of `members` */
  memberIds: string[];
};

const NOT_WORD = String.raw`[\p{L}\p{N}]`;
const BEFORE = String.raw`(?<!${NOT_WORD})`;
const AFTER = String.raw`(?!${NOT_WORD})`;

const MONTHS = [
  "gennaio",
  "febbraio",
  "marzo",
  "aprile",
  "maggio",
  "giugno",
  "luglio",
  "agosto",
  "settembre",
  "ottobre",
  "novembre",
  "dicembre",
];

const WEEKDAYS: Record<string, number> = {
  dom: 0,
  lun: 1,
  mar: 2,
  mer: 3,
  gio: 4,
  ven: 5,
  sab: 6,
};

type Span = { start: number; end: number };
type DayCandidate = Span & { dayKey: string };
type TimeCandidate = Span & { startMinutes: number; endMinutes: number | null };

const RELATIVE = new RegExp(`${BEFORE}(dopodomani|domani|oggi)${AFTER}`, "giu");
const WEEKDAY = new RegExp(
  `${BEFORE}(luned[iìí]|marted[iìí]|mercoled[iìí]|gioved[iìí]|venerd[iìí]|sabato|domenica)${AFTER}`,
  "giu",
);
const MONTH_DAY = new RegExp(
  String.raw`(?<![\p{L}\p{N}/.:])(\d{1,2})\s+(${MONTHS.join("|")})${AFTER}`,
  "giu",
);
const NUMERIC_DAY = new RegExp(
  String.raw`(?<![\p{L}\p{N}/.:])(\d{1,2})/(\d{1,2})(?:/(\d{4}))?(?![\p{N}/])`,
  "gu",
);
const TIME_RANGE = new RegExp(
  String.raw`${BEFORE}dalle\s+(?:ore\s+)?(\d{1,2})(?:[:.](\d{2}))?\s+alle\s+(?:ore\s+)?(\d{1,2})(?:[:.](\d{2}))?(?![\p{L}\p{N}]|[:.]\d)`,
  "giu",
);
const TIME_SINGLE = new RegExp(
  String.raw`${BEFORE}(?:alle\s+ore|alle|ore)\s+(\d{1,2})(?:[:.](\d{2}))?(?![\p{L}\p{N}]|[:.]\d)`,
  "giu",
);
/** «il», «di», «per» just before a day expression are dropped with it. */
const LEAD_WORD = /(^|\s)(?:il|di|per)\s+$/iu;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function minutesOf(hour: string, minute: string | undefined): number | null {
  const h = Number(hour);
  const m = minute === undefined ? 0 : Number(minute);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

function parseKey(dayKey: string): { y: number; m: number; d: number } {
  return {
    y: Number(dayKey.slice(0, 4)),
    m: Number(dayKey.slice(5, 7)),
    d: Number(dayKey.slice(8, 10)),
  };
}

function weekdayOf(dayKey: string): number {
  const { y, m, d } = parseKey(dayKey);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** First date from `today` (included) with this day and month; null if none exists. */
function nextOccurrence(
  day: number,
  month: number,
  todayKey: string,
): string | null {
  const startYear = parseKey(todayKey).y;
  for (let year = startYear; year <= startYear + 8; year += 1) {
    const key = `${year}-${pad(month)}-${pad(day)}`;
    if (isValidDayKey(key) && key >= todayKey) return key;
  }
  return null;
}

function dayCandidates(text: string, todayKey: string): DayCandidate[] {
  const found: DayCandidate[] = [];
  const add = (match: RegExpMatchArray, dayKey: string | null) => {
    if (dayKey === null || match.index === undefined) return;
    found.push({
      start: match.index,
      end: match.index + match[0].length,
      dayKey,
    });
  };

  for (const match of text.matchAll(RELATIVE)) {
    const word = match[1]!.toLowerCase();
    const offset = word === "oggi" ? 0 : word === "domani" ? 1 : 2;
    add(match, addDaysToDayKey(todayKey, offset));
  }
  for (const match of text.matchAll(WEEKDAY)) {
    const target = WEEKDAYS[match[1]!.slice(0, 3).toLowerCase()]!;
    const offset = (target - weekdayOf(todayKey) + 7) % 7;
    add(match, addDaysToDayKey(todayKey, offset));
  }
  for (const match of text.matchAll(MONTH_DAY)) {
    const month = MONTHS.indexOf(match[2]!.toLowerCase()) + 1;
    add(match, nextOccurrence(Number(match[1]), month, todayKey));
  }
  for (const match of text.matchAll(NUMERIC_DAY)) {
    const day = Number(match[1]);
    const month = Number(match[2]);
    if (match[3] !== undefined) {
      const key = `${match[3]}-${pad(month)}-${pad(day)}`;
      add(match, isValidDayKey(key) ? key : null);
    } else {
      add(match, nextOccurrence(day, month, todayKey));
    }
  }
  return found;
}

function timeCandidates(text: string): TimeCandidate[] {
  const found: TimeCandidate[] = [];
  for (const match of text.matchAll(TIME_RANGE)) {
    const start = minutesOf(match[1]!, match[2]);
    const end = minutesOf(match[3]!, match[4]);
    if (start === null || end === null || match.index === undefined) continue;
    found.push({
      start: match.index,
      end: match.index + match[0].length,
      startMinutes: start,
      endMinutes: end,
    });
  }
  for (const match of text.matchAll(TIME_SINGLE)) {
    const start = minutesOf(match[1]!, match[2]);
    if (start === null || match.index === undefined) continue;
    found.push({
      start: match.index,
      end: match.index + match[0].length,
      startMinutes: start,
      endMinutes: null,
    });
  }
  return found;
}

/** The candidate that starts first; at the same start the longer one. */
function leftmost<T extends Span>(candidates: T[]): T | null {
  let best: T | null = null;
  for (const c of candidates) {
    if (
      best === null ||
      c.start < best.start ||
      (c.start === best.start && c.end > best.end)
    ) {
      best = c;
    }
  }
  return best;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function capitalizeFirst(text: string): string {
  const first = text.charAt(0);
  return first.toLocaleUpperCase("it-IT") + text.slice(1);
}

/** Whole-word, case-insensitive check; words of the name may be split by any spaces. */
function mentions(text: string, name: string): boolean {
  const words = name.trim().split(/\s+/).filter(Boolean).map(escapeRegExp);
  if (words.length === 0) return false;
  return new RegExp(
    `${BEFORE}${words.join(String.raw`\s+`)}${AFTER}`,
    "iu",
  ).test(text);
}

/**
 * `todayKey` is the Rome day of «now» (`YYYY-MM-DD`). `members` are the
 * members of the signed-in user's Nest, in the order of the Nest.
 */
export function parsePhrase(
  phrase: string,
  todayKey: string,
  members: readonly PhraseMember[],
): ParsedPhrase {
  const text = phrase.replace(/\s+/g, " ");

  const day = leftmost(dayCandidates(text, todayKey));
  let time = leftmost(timeCandidates(text));
  // A time that overlaps the day expression is part of it, not a time.
  if (day && time && time.start < day.end && time.end > day.start) time = null;

  const cuts: Span[] = [];
  if (day) {
    let start = day.start;
    for (;;) {
      const lead = LEAD_WORD.exec(text.slice(0, start));
      if (!lead) break;
      start = lead.index + (lead[1]?.length ?? 0);
    }
    cuts.push({ start, end: day.end });
  }
  if (time) cuts.push({ start: time.start, end: time.end });
  cuts.sort((a, b) => a.start - b.start);

  let rest = "";
  let cursor = 0;
  for (const cut of cuts) {
    rest += `${text.slice(cursor, cut.start)} `;
    cursor = cut.end;
  }
  rest += text.slice(cursor);
  const title = capitalizeFirst(rest.replace(/\s+/g, " ").trim());

  // Two members with the same name: the first one wins.
  const seen = new Set<string>();
  const memberIds: string[] = [];
  for (const member of members) {
    const key = member.name.trim().toLocaleLowerCase("it-IT");
    if (seen.has(key)) continue;
    seen.add(key);
    if (mentions(text, member.name)) memberIds.push(member.id);
  }

  return {
    title,
    dayKey: day ? day.dayKey : null,
    time: time ? { start: time.startMinutes, end: time.endMinutes } : null,
    memberIds,
  };
}

export type PhraseSlot = {
  /** Rome day the event starts on */
  dayKey: string;
  /** Rome day the event ends on (the day after when it ends past midnight) */
  endDayKey: string;
  startsAt: Date;
  endsAt: Date;
};

function clock(minutes: number): string {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

/**
 * Start and end of the event, or null without a time. Without a day it is
 * today. Without an end it lasts 60 minutes; an end that is not after the
 * start is on the next day.
 */
export function slotOf(
  parsed: ParsedPhrase,
  todayKey: string,
): PhraseSlot | null {
  if (!parsed.time) return null;
  const dayKey = parsed.dayKey ?? todayKey;
  const startsAt = fromFieldValues(dayKey, clock(parsed.time.start));
  let endsAt: Date;
  if (parsed.time.end === null) {
    endsAt = new Date(startsAt.getTime() + 60 * 60_000);
  } else {
    const endDay =
      parsed.time.end <= parsed.time.start
        ? addDaysToDayKey(dayKey, 1)
        : dayKey;
    endsAt = fromFieldValues(endDay, clock(parsed.time.end));
  }
  return { dayKey, endDayKey: toDayKey(endsAt), startsAt, endsAt };
}
