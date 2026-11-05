import { addDaysToDayKey, getWeekStartKey, toDayKey } from "@/lib/datetime";
import type { SearchQuery } from "@/lib/search-household";

/**
 * What the search page understands in the typed text (issue #40, §7): the
 * expressions («questo weekend», «cose di Sofia», «scade a novembre») are
 * taken out of the text, and the words left are the ones looked for in the
 * titles. All in the browser: the text itself never leaves it except in the
 * body of the search request.
 */

export type SearchMember = {
  id: string;
  name: string;
};

export type ParsedSearch = {
  /** Words looked for in the titles (and highlighted), lowercase, no accents */
  words: string[];
  member: SearchMember | null;
  /** Both days included, `YYYY-MM-DD` */
  period: { from: string; to: string } | null;
  /** «scade» as first word: only deadlines */
  deadlinesOnly: boolean;
};

/** Lowercase, no accents, spaces collapsed and trimmed. */
export function normalizeSearchText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

type Period = { from: string; to: string };
type Expression = { phrase: string; period: (todayKey: string) => Period };

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

const DEADLINE_WORDS = new Set(["scade", "scadono", "scadenze"]);

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function day(todayKey: string, offset: number): Period {
  const key = addDaysToDayKey(todayKey, offset);
  return { from: key, to: key };
}

function week(todayKey: string, weeksAhead: number): Period {
  const start = addDaysToDayKey(getWeekStartKey(todayKey), 7 * weeksAhead);
  return { from: start, to: addDaysToDayKey(start, 6) };
}

/** Saturday and Sunday of this week; on Sunday, only today. */
function weekend(todayKey: string): Period {
  const start = getWeekStartKey(todayKey);
  const sunday = addDaysToDayKey(start, 6);
  if (todayKey === sunday) return { from: sunday, to: sunday };
  return { from: addDaysToDayKey(start, 5), to: sunday };
}

/** The month in progress if it is that one, otherwise the next that comes. */
function month(monthNumber: number, todayKey: string): Period {
  const currentYear = Number(todayKey.slice(0, 4));
  const currentMonth = Number(todayKey.slice(5, 7));
  const year = monthNumber >= currentMonth ? currentYear : currentYear + 1;
  const from = `${year}-${pad(monthNumber)}-01`;
  const nextFirst =
    monthNumber === 12
      ? `${year + 1}-01-01`
      : `${year}-${pad(monthNumber + 1)}-01`;
  return { from, to: addDaysToDayKey(nextFirst, -1) };
}

const EXPRESSIONS: readonly Expression[] = [
  { phrase: "questo fine settimana", period: weekend },
  { phrase: "questo weekend", period: weekend },
  { phrase: "weekend", period: weekend },
  { phrase: "questa settimana", period: (key) => week(key, 0) },
  { phrase: "prossima settimana", period: (key) => week(key, 1) },
  { phrase: "settimana prossima", period: (key) => week(key, 1) },
  { phrase: "oggi", period: (key) => day(key, 0) },
  { phrase: "domani", period: (key) => day(key, 1) },
  ...MONTHS.flatMap((name, index) => [
    { phrase: `a ${name}`, period: (key: string) => month(index + 1, key) },
    { phrase: name, period: (key: string) => month(index + 1, key) },
  ]),
];

/** Removes `length` characters of `text` from `at`, keeping one space. */
function cut(text: string, at: number, length: number): string {
  return `${text.slice(0, at)} ${text.slice(at + length)}`;
}

/**
 * Reads the typed text. Expressions are found with the text padded by spaces,
 * so they only match whole words.
 */
export function parseSearchText(
  text: string,
  members: readonly SearchMember[],
  now: Date,
): ParsedSearch {
  const normalized = normalizeSearchText(text);
  const todayKey = toDayKey(now);
  let rest = ` ${normalized} `;

  // «cose di <Nome>»: the whole name of a member, the longest name first.
  let member: SearchMember | null = null;
  const named = members
    .map((candidate) => ({
      candidate,
      name: normalizeSearchText(candidate.name),
    }))
    .filter((entry) => entry.name !== "")
    .sort((a, b) => b.name.length - a.name.length);
  for (const entry of named) {
    const needle = ` cose di ${entry.name} `;
    const at = rest.indexOf(needle);
    if (at >= 0) {
      member = entry.candidate;
      rest = cut(rest, at, needle.length);
      break;
    }
  }

  // «scade», «scadono», «scadenze» as first word: only deadlines.
  const firstWord = normalized.split(" ")[0] ?? "";
  let deadlinesOnly = false;
  if (DEADLINE_WORDS.has(firstWord)) {
    const needle = ` ${firstWord} `;
    const at = rest.indexOf(needle);
    if (at >= 0) {
      deadlinesOnly = true;
      rest = cut(rest, at, needle.length);
    }
  }

  // Periods, from left to right; more than one are crossed.
  const periods: Period[] = [];
  for (;;) {
    let best: { at: number; length: number; expression: Expression } | null =
      null;
    for (const expression of EXPRESSIONS) {
      const needle = ` ${expression.phrase} `;
      const at = rest.indexOf(needle);
      if (at >= 0 && (best === null || at < best.at)) {
        best = { at, length: needle.length, expression };
      }
    }
    if (best === null) break;
    periods.push(best.expression.period(todayKey));
    rest = cut(rest, best.at, best.length);
  }
  let period: Period | null = periods[0] ?? null;
  if (periods.length > 1) {
    const from = periods.reduce((max, p) => (p.from > max ? p.from : max), "");
    const to = periods.reduce(
      (min, p) => (min === "" || p.to < min ? p.to : min),
      "",
    );
    if (from <= to) period = { from, to };
  }

  let words = rest.split(" ").filter((word) => word !== "");

  // Nothing but «scade»: it is a word to look for, not an expression.
  if (words.length === 0 && member === null && period === null) {
    deadlinesOnly = false;
    words = normalized.split(" ").filter((word) => word !== "");
  }

  return { words, member, period, deadlinesOnly };
}

/** The request for the database function. */
export function toSearchQuery(parsed: ParsedSearch): SearchQuery {
  const text = parsed.words.join(" ");
  return {
    ...(text !== "" ? { text } : {}),
    ...(parsed.member ? { memberId: parsed.member.id } : {}),
    ...(parsed.period
      ? { from: parsed.period.from, to: parsed.period.to }
      : {}),
    ...(parsed.deadlinesOnly ? { kinds: ["deadline" as const] } : {}),
  };
}
