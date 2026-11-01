import { addDaysToDayKey, isValidDayKey } from "../../lib/datetime";

/**
 * Reads a phrase for «Da fare» and «Scadenza» (issue #22, requisito §3, §4, §5).
 * Pure code that runs in the browser: the text never leaves the app. Days are
 * read in Rome. Only the first date expression counts; the rest stays in the
 * title.
 */

export type TodoPerson = {
  id: string;
  name: string;
  kind: "adult" | "child" | "pet";
};

export type ParsedTodo = {
  /** The phrase without the recognized parts, first letter in capitals; may be empty */
  title: string;
  /** `YYYY-MM-DD`, null if the phrase has no date */
  dueDate: string | null;
  /** Who takes care of it, from «<Nome> deve» or «Devo»; null if not written */
  assigneeId: string | null;
  /** True when the phrase starts with «<Nome> deve» or «Devo» */
  assigneeWritten: boolean;
  /** «Per chi è», from «per <Nome>»; null if not written */
  forId: string | null;
};

export type ParsedDeadline = {
  title: string;
  dueDate: string | null;
  assigneeId: string | null;
  assigneeWritten: boolean;
  /** «Riguarda»: the first member named in the text */
  aboutId: string | null;
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
const MONTH_NAMES = MONTHS.join("|");

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
type DateCandidate = Span & { dayKey: string };

const RELATIVE = new RegExp(`${BEFORE}(dopodomani|domani|oggi)${AFTER}`, "giu");
const WEEKDAY = new RegExp(
  `${BEFORE}(luned[iìí]|marted[iìí]|mercoled[iìí]|gioved[iìí]|venerd[iìí]|sabato|domenica)${AFTER}`,
  "giu",
);
const MONTH_DAY = new RegExp(
  String.raw`(?<![\p{L}\p{N}/.:])(\d{1,2})\s+(${MONTH_NAMES})${AFTER}(?:\s+(\d{4})(?!\d))?`,
  "giu",
);
const NUMERIC_DAY = new RegExp(
  String.raw`(?<![\p{L}\p{N}/.:])(\d{1,2})/(\d{1,2})(?:/(\d{4}))?(?![\p{N}/])`,
  "gu",
);
const END_OF_MONTH = new RegExp(`${BEFORE}fine\\s+mese${AFTER}`, "giu");
const END_OF_NAMED_MONTH = new RegExp(
  String.raw`${BEFORE}fine\s+(${MONTH_NAMES})${AFTER}(?:\s+(\d{4})(?!\d))?`,
  "giu",
);

/** Words just before a date that go away with it. */
const LEAD_TODO = /(^|\s)(?:entro(?:\s+il)?)\s+$/iu;
const LEAD_DEADLINE =
  /(^|\s)(?:scade(?:\s+il)?|scadono(?:\s+il)?|scadenza|entro(?:\s+il)?|il)\s+$/iu;

const DEADLINE_WORD = new RegExp(
  `${BEFORE}(?:scade|scadono|scadenza|rinnovo|bollo)${AFTER}`,
  "iu",
);

function pad(value: number): string {
  return String(value).padStart(2, "0");
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

function lastDayOfMonth(year: number, month: number): string {
  const day = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${pad(month)}-${pad(day)}`;
}

function dateCandidates(text: string, todayKey: string): DateCandidate[] {
  const found: DateCandidate[] = [];
  const add = (match: RegExpMatchArray, dayKey: string | null) => {
    if (dayKey === null || match.index === undefined) return;
    found.push({
      start: match.index,
      end: match.index + match[0].length,
      dayKey,
    });
  };
  const today = parseKey(todayKey);

  for (const match of text.matchAll(RELATIVE)) {
    const word = match[1]!.toLowerCase();
    const offset = word === "oggi" ? 0 : word === "domani" ? 1 : 2;
    add(match, addDaysToDayKey(todayKey, offset));
  }
  for (const match of text.matchAll(WEEKDAY)) {
    const target = WEEKDAYS[match[1]!.slice(0, 3).toLowerCase()]!;
    // The first day with that name AFTER today: from +1 to +7.
    const offset = ((target - weekdayOf(todayKey) + 6) % 7) + 1;
    add(match, addDaysToDayKey(todayKey, offset));
  }
  for (const match of text.matchAll(MONTH_DAY)) {
    const month = MONTHS.indexOf(match[2]!.toLowerCase()) + 1;
    const day = Number(match[1]);
    if (match[3] !== undefined) {
      const key = `${match[3]}-${pad(month)}-${pad(day)}`;
      add(match, isValidDayKey(key) ? key : null);
    } else {
      add(match, nextOccurrence(day, month, todayKey));
    }
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
  for (const match of text.matchAll(END_OF_MONTH)) {
    add(match, lastDayOfMonth(today.y, today.m));
  }
  for (const match of text.matchAll(END_OF_NAMED_MONTH)) {
    const month = MONTHS.indexOf(match[1]!.toLowerCase()) + 1;
    if (match[2] !== undefined) {
      add(match, lastDayOfMonth(Number(match[2]), month));
    } else {
      const thisYear = lastDayOfMonth(today.y, month);
      add(
        match,
        thisYear >= todayKey ? thisYear : lastDayOfMonth(today.y + 1, month),
      );
    }
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

/** Pattern of a name: its words may be split by any spaces. */
function namePattern(name: string): string | null {
  const words = name.trim().split(/\s+/).filter(Boolean).map(escapeRegExp);
  return words.length === 0 ? null : words.join(String.raw`\s+`);
}

/** Members with a usable name, longest name first (the longest wins). */
function byLongestName<T extends { name: string }>(members: readonly T[]): T[] {
  return members
    .filter((member) => namePattern(member.name) !== null)
    .sort((a, b) => b.name.trim().length - a.name.trim().length);
}

type Lead = { id: string | null; end: number };

/** «Laura deve …» or «Devo …» at the start of the text. */
function leadAssignee(
  text: string,
  members: readonly TodoPerson[],
  meId: string | null,
): Lead | null {
  const devo = new RegExp(`^devo${AFTER}`, "iu").exec(text);
  if (devo) return { id: meId, end: devo[0].length };
  for (const member of byLongestName(members)) {
    if (member.kind === "pet") continue;
    const match = new RegExp(
      `^${namePattern(member.name)}\\s+deve${AFTER}`,
      "iu",
    ).exec(text);
    if (match) return { id: member.id, end: match[0].length };
  }
  return null;
}

/** «per Sofia»: the span of the whole expression and the member. */
function findFor(
  text: string,
  members: readonly TodoPerson[],
): (Span & { id: string }) | null {
  let best: (Span & { id: string }) | null = null;
  for (const member of byLongestName(members)) {
    const match = new RegExp(
      `${BEFORE}per\\s+${namePattern(member.name)}${AFTER}`,
      "iu",
    ).exec(text);
    if (!match) continue;
    if (best === null || match.index < best.start) {
      best = {
        start: match.index,
        end: match.index + match[0].length,
        id: member.id,
      };
    }
  }
  return best;
}

/** The first member named in the text, from `from` on (longest name at a tie). */
function findFirstMention(
  text: string,
  from: number,
  members: readonly TodoPerson[],
): string | null {
  let best: { id: string; index: number } | null = null;
  const seen = new Set<string>();
  for (const member of byLongestName(members)) {
    const key = member.name.trim().toLocaleLowerCase("it-IT");
    if (seen.has(key)) continue;
    seen.add(key);
    const match = new RegExp(
      `${BEFORE}${namePattern(member.name)}${AFTER}`,
      "iu",
    ).exec(text.slice(from));
    if (!match) continue;
    if (best === null || match.index < best.index) {
      best = { id: member.id, index: match.index };
    }
  }
  return best ? best.id : null;
}

/** Moves `start` to the left over the lead words just before it. */
function extendLeft(text: string, start: number, lead: RegExp): number {
  let position = start;
  for (;;) {
    const match = lead.exec(text.slice(0, position));
    if (!match) return position;
    position = match.index + (match[1]?.length ?? 0);
  }
}

function buildTitle(text: string, cuts: readonly Span[]): string {
  const sorted = [...cuts].sort((a, b) => a.start - b.start);
  let rest = "";
  let cursor = 0;
  for (const cut of sorted) {
    if (cut.end <= cursor) continue;
    rest += `${text.slice(cursor, Math.max(cut.start, cursor))} `;
    cursor = cut.end;
  }
  rest += text.slice(cursor);
  const cleaned = rest
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[\s,;:.\-–—]+|[\s,;:.\-–—]+$/gu, "")
    .trim();
  return capitalizeFirst(cleaned);
}

function normalized(phrase: string): string {
  return phrase.replace(/\s+/g, " ").trim();
}

/** «Laura deve chiamare la nonna entro venerdì» → title, date, who, for whom. */
export function parseTodo(
  phrase: string,
  todayKey: string,
  members: readonly TodoPerson[],
  meId: string | null,
): ParsedTodo {
  const text = normalized(phrase);
  const lead = leadAssignee(text, members, meId);
  const forPart = findFor(text, members);
  const date = leftmost(dateCandidates(text, todayKey));

  const cuts: Span[] = [];
  if (lead) cuts.push({ start: 0, end: lead.end });
  if (forPart) cuts.push({ start: forPart.start, end: forPart.end });
  if (date) {
    cuts.push({
      start: extendLeft(text, date.start, LEAD_TODO),
      end: date.end,
    });
  }
  return {
    title: buildTitle(text, cuts),
    dueDate: date ? date.dayKey : null,
    assigneeId: lead ? lead.id : null,
    assigneeWritten: lead !== null,
    forId: forPart ? forPart.id : null,
  };
}

/** «bollo auto scade il 7 dicembre» → title, date, who takes care, about whom. */
export function parseDeadline(
  phrase: string,
  todayKey: string,
  members: readonly TodoPerson[],
  meId: string | null,
): ParsedDeadline {
  const text = normalized(phrase);
  const lead = leadAssignee(text, members, meId);
  const date = leftmost(dateCandidates(text, todayKey));

  const cuts: Span[] = [];
  if (lead) cuts.push({ start: 0, end: lead.end });
  if (date) {
    cuts.push({
      start: extendLeft(text, date.start, LEAD_DEADLINE),
      end: date.end,
    });
  }
  return {
    title: buildTitle(text, cuts),
    dueDate: date ? date.dayKey : null,
    assigneeId: lead ? lead.id : null,
    assigneeWritten: lead !== null,
    aboutId: findFirstMention(text, lead ? lead.end : 0, members),
  };
}

/** True when the text has one of the words that make it a deadline. */
export function hasDeadlineWord(phrase: string): boolean {
  return DEADLINE_WORD.test(phrase);
}

/** True when the text starts with «<Nome> deve» or «Devo». */
export function startsWithAssignee(
  phrase: string,
  members: readonly TodoPerson[],
  meId: string | null,
): boolean {
  return leadAssignee(normalized(phrase), members, meId) !== null;
}

/** True when «entro» comes right before a recognized date. */
export function hasEntroDate(phrase: string, todayKey: string): boolean {
  const text = normalized(phrase);
  return dateCandidates(text, todayKey).some((candidate) =>
    LEAD_TODO.test(text.slice(0, candidate.start)),
  );
}

/** True when the text has a recognized date. */
export function hasDate(phrase: string, todayKey: string): boolean {
  return dateCandidates(normalized(phrase), todayKey).length > 0;
}
