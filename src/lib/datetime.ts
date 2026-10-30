/**
 * Centralized date and time helpers.
 *
 * Rule (docs/agenti/LEZIONI.md): dates are stored in UTC and always shown in
 * the `Europe/Rome` time zone through these functions. No page formats dates
 * on its own. All functions are pure and use only `Intl`.
 */

const TIME_ZONE = "Europe/Rome";
const LOCALE = "it-IT";
const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;

export type Instant = Date | string | number;

function toDate(value: Instant): Date {
  return value instanceof Date ? value : new Date(value);
}

const partsFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
  hourCycle: "h23",
});

type RomeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

/** Calendar and clock values of an instant, as read in Rome. */
function romeParts(value: Instant): RomeParts {
  const parts: Record<string, number> = {};
  for (const part of partsFormatter.formatToParts(toDate(value))) {
    if (part.type !== "literal") parts[part.type] = Number(part.value);
  }
  return {
    year: parts.year ?? 0,
    month: parts.month ?? 0,
    day: parts.day ?? 0,
    hour: parts.hour ?? 0,
    minute: parts.minute ?? 0,
    second: parts.second ?? 0,
  };
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase(LOCALE) + text.slice(1);
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function textPart(
  value: Instant,
  options: Intl.DateTimeFormatOptions,
  type: Intl.DateTimeFormatPartTypes,
): string {
  const key = JSON.stringify(options);
  let formatter = formatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(LOCALE, {
      timeZone: TIME_ZONE,
      ...options,
    });
    formatterCache.set(key, formatter);
  }
  return (
    formatter.formatToParts(toDate(value)).find((p) => p.type === type)
      ?.value ?? ""
  );
}

/** `17:00`, `8:30`: 24 h, hour without leading zero, minutes with two digits. */
export function formatTime(value: Instant): string {
  const { hour, minute } = romeParts(value);
  return `${hour}:${pad(minute)}`;
}

/** `Martedì 20 ottobre` (or `martedì 20 ottobre`), no year. */
export function formatLongDay(
  value: Instant,
  options: { capitalized?: boolean } = {},
): string {
  const { capitalized = true } = options;
  const weekday = textPart(value, { weekday: "long" }, "weekday");
  const day = romeParts(value).day;
  const month = textPart(value, { month: "long" }, "month");
  const text = `${weekday} ${day} ${month}`;
  return capitalized ? capitalize(text) : text;
}

/** `Lun`: three letters, capital initial. */
export function formatShortWeekday(value: Instant): string {
  const weekday = textPart(value, { weekday: "short" }, "weekday");
  return capitalize(weekday.replace(".", ""));
}

/** `Ottobre 2026`. */
export function formatMonthYear(value: Instant): string {
  const month = textPart(value, { month: "long" }, "month");
  return `${capitalize(month)} ${romeParts(value).year}`;
}

/**
 * `19 – 25 ottobre`; across two months `28 settembre – 4 ottobre`;
 * across two years `29 dicembre 2026 – 4 gennaio 2027` (decision D-7).
 */
export function formatDayRange(start: Instant, end: Instant): string {
  const a = romeParts(start);
  const b = romeParts(end);
  const monthOf = (value: Instant) =>
    textPart(value, { month: "long" }, "month");
  if (a.year !== b.year) {
    return `${a.day} ${monthOf(start)} ${a.year} – ${b.day} ${monthOf(end)} ${b.year}`;
  }
  if (a.month !== b.month) {
    return `${a.day} ${monthOf(start)} – ${b.day} ${monthOf(end)}`;
  }
  return `${a.day} – ${b.day} ${monthOf(end)}`;
}

/** Day number of the Rome calendar day, to count calendar days. */
function romeDayNumber(value: Instant): number {
  const { year, month, day } = romeParts(value);
  return Math.floor(Date.UTC(year, month - 1, day) / MS_PER_DAY);
}

/**
 * Number of calendar days from `now` to `target`, counted in Rome (not in
 * 24-hour blocks): 0 the same day, 1 the next day, negative if `target` is
 * earlier. The number behind `formatDaysUntil`, for texts like «ancora 6 giorni».
 */
export function calendarDaysUntil(
  target: Instant,
  now: Instant = new Date(),
): number {
  return romeDayNumber(target) - romeDayNumber(now);
}

/**
 * Calendar days from `now` to `target`, counted in Rome (not in 24-hour blocks):
 * `oggi`, `domani`, `tra 6 giorni`, `ieri`, `3 giorni fa`.
 */
export function formatDaysUntil(
  target: Instant,
  now: Instant = new Date(),
): string {
  const days = calendarDaysUntil(target, now);
  if (days === 0) return "oggi";
  if (days === 1) return "domani";
  if (days === -1) return "ieri";
  if (days > 1) return `tra ${days} giorni`;
  return `${-days} giorni fa`;
}

/**
 * Time left: `tra 8 minuti`, `tra 1 minuto`, `tra meno di un minuto`,
 * `tra 1 h 8 min`, `tra 2 h` (decision D-8). From the next calendar day on it
 * counts days (`domani`, `tra 6 giorni`). Returns `null` if `target` is not
 * in the future.
 */
export function formatTimeUntil(
  target: Instant,
  now: Instant = new Date(),
): string | null {
  const diffMs = toDate(target).getTime() - toDate(now).getTime();
  if (diffMs <= 0) return null;
  if (romeDayNumber(target) !== romeDayNumber(now)) {
    return formatDaysUntil(target, now);
  }
  const minutes = Math.floor(diffMs / MS_PER_MINUTE);
  if (minutes < 1) return "tra meno di un minuto";
  if (minutes === 1) return "tra 1 minuto";
  if (minutes < 60) return `tra ${minutes} minuti`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `tra ${hours} h` : `tra ${hours} h ${rest} min`;
}

/**
 * Age completed on `now`, counted in Rome, for children and pets:
 * `meno di un mese`, `1 mese`, `8 mesi`, `1 anno`, `9 anni`.
 * `birthDate` is a `YYYY-MM-DD` calendar day (as in a date field) or an
 * instant read in Rome. A birth date after `now` counts as `meno di un mese`.
 */
export function formatAge(
  birthDate: Instant,
  now: Instant = new Date(),
): string {
  const match =
    typeof birthDate === "string"
      ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate)
      : null;
  const birth = match
    ? { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
    : romeParts(birthDate);
  const today = romeParts(now);
  const months =
    (today.year - birth.year) * 12 +
    (today.month - birth.month) -
    (today.day < birth.day ? 1 : 0);
  if (months < 1) return "meno di un mese";
  if (months < 12) return months === 1 ? "1 mese" : `${months} mesi`;
  const years = Math.floor(months / 12);
  return years === 1 ? "1 anno" : `${years} anni`;
}

/* ---------- Conversion between instants and form fields ---------- */

/** Instant to the `YYYY-MM-DD` value of a date field (Rome day). */
export function toDateFieldValue(value: Instant): string {
  const { year, month, day } = romeParts(value);
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Instant to the `HH:MM` value of a time field (Rome clock, 24 h). */
export function toTimeFieldValue(value: Instant): string {
  const { hour, minute } = romeParts(value);
  return `${pad(hour)}:${pad(minute)}`;
}

/** Rome offset from UTC, in minutes, at a given instant (60 or 120). */
function romeOffsetMinutes(ms: number): number {
  const p = romeParts(ms);
  const asUtc = Date.UTC(
    p.year,
    p.month - 1,
    p.day,
    p.hour,
    p.minute,
    p.second,
  );
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / MS_PER_MINUTE);
}

/**
 * Field values (`YYYY-MM-DD` and `HH:MM`, read in Rome) to the UTC instant.
 * A time that does not exist (spring clock change) moves one hour forward;
 * a time that happens twice (autumn clock change) takes the first one
 * (decision D-10). Never throws on a valid pair; returns an invalid `Date`
 * if the strings are malformed.
 */
export function fromFieldValues(date: string, time: string): Date {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!d || !t) return new Date(Number.NaN);
  const wall = Date.UTC(
    Number(d[1]),
    Number(d[2]) - 1,
    Number(d[3]),
    Number(t[1]),
    Number(t[2]),
  );

  const candidates = [120, 60]
    .map((offset) => wall - offset * MS_PER_MINUTE)
    .filter((ms) => romeOffsetMinutes(ms) === (wall - ms) / MS_PER_MINUTE);
  if (candidates.length > 0) return new Date(Math.min(...candidates));

  // Time inside the spring gap: use the wall time one hour later.
  const shifted = wall + 60 * MS_PER_MINUTE;
  const fallback = [120, 60]
    .map((offset) => shifted - offset * MS_PER_MINUTE)
    .filter((ms) => romeOffsetMinutes(ms) === (shifted - ms) / MS_PER_MINUTE);
  return new Date(Math.min(...fallback));
}

/* ---------- Weeks and days in Rome (calendar, Oggi) ---------- */

const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for a real calendar day written `YYYY-MM-DD` (rejects 2026-02-30). */
export function isValidDayKey(value: string): boolean {
  const match = DAY_KEY.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** `YYYY-MM-DD` of the Rome day that is `days` after (or before) `dayKey`. */
export function addDaysToDayKey(dayKey: string, days: number): string {
  const match = DAY_KEY.exec(dayKey);
  if (!match) return dayKey;
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days),
  );
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** The Rome day of an instant, as `YYYY-MM-DD`. */
export function toDayKey(value: Instant): string {
  return toDateFieldValue(value);
}

/** UTC instant of 00:00 in Rome on `dayKey` (safe across clock changes). */
export function startOfDay(dayKey: string): Date {
  return fromFieldValues(dayKey, "00:00");
}

/** ISO weekday of a day key: 1 = Monday ... 7 = Sunday. */
function isoWeekday(dayKey: string): number {
  const match = DAY_KEY.exec(dayKey);
  if (!match) return 1;
  const day = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  ).getUTCDay();
  return day === 0 ? 7 : day;
}

/** Day key of the Monday of the week (Rome) that contains `dayKey`. */
export function getWeekStartKey(dayKey: string): string {
  return addDaysToDayKey(dayKey, 1 - isoWeekday(dayKey));
}

/** Monday 00:00 in Rome of the week that contains the instant. */
export function getWeekStart(value: Instant): Date {
  return startOfDay(getWeekStartKey(toDayKey(value)));
}

export type CalendarDay = {
  /** `YYYY-MM-DD`, Rome day */
  key: string;
  /** 00:00 in Rome */
  start: Date;
  /** 00:00 in Rome of the next day (the day is `[start, end)`) */
  end: Date;
};

/** A Rome day from its key. It lasts 23 or 25 hours on clock-change days. */
export function getCalendarDay(dayKey: string): CalendarDay {
  return {
    key: dayKey,
    start: startOfDay(dayKey),
    end: startOfDay(addDaysToDayKey(dayKey, 1)),
  };
}

/**
 * The 7 days, Monday to Sunday, of the week that contains `reference`
 * (an instant, or a `YYYY-MM-DD` day key).
 */
export function getWeekDays(reference: Instant): CalendarDay[] {
  const dayKey =
    typeof reference === "string" && DAY_KEY.test(reference)
      ? reference
      : toDayKey(reference);
  const monday = getWeekStartKey(dayKey);
  return Array.from({ length: 7 }, (_, index) =>
    getCalendarDay(addDaysToDayKey(monday, index)),
  );
}

/** Value of the `settimana` address parameter: the Monday as `YYYY-MM-DD`. */
export function formatWeekParam(reference: Instant): string {
  return getWeekStartKey(toDayKey(reference));
}

/**
 * Reads the `settimana` parameter. A valid date gives the week that contains
 * it (Monday not required); anything else gives the week of `now`, silently.
 * Returns the Monday 00:00 in Rome.
 */
export function parseWeekParam(
  value: string | string[] | null | undefined,
  now: Instant = new Date(),
): Date {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw === "string" && isValidDayKey(raw)) {
    return startOfDay(getWeekStartKey(raw));
  }
  return getWeekStart(now);
}

/** Value of the `mese` address parameter: `YYYY-MM`. */
export function formatMonthParam(value: Instant): string {
  const { year, month } = romeParts(value);
  return `${year}-${pad(month)}`;
}

/** `10:00 – 11:00` (24 h, hour without leading zero, as `formatTime`). */
export function formatTimeRange(start: Instant, end: Instant): string {
  return `${formatTime(start)} – ${formatTime(end)}`;
}

/**
 * `Martedì 20` (capitalized by default). With `withMonth` the month follows
 * (`Domenica 1 novembre`), for the days of the second month in a week.
 */
export function formatDayNumber(
  value: Instant,
  options: { capitalized?: boolean; withMonth?: boolean } = {},
): string {
  const { capitalized = true, withMonth = false } = options;
  const weekday = textPart(value, { weekday: "long" }, "weekday");
  const day = romeParts(value).day;
  const month = withMonth
    ? ` ${textPart(value, { month: "long" }, "month")}`
    : "";
  const text = `${weekday} ${day}${month}`;
  return capitalized ? capitalize(text) : text;
}

/** `Buongiorno` 05:00-12:59, `Buon pomeriggio` 13:00-17:59, else `Buonasera`. */
export function formatGreeting(now: Instant = new Date()): string {
  const { hour } = romeParts(now);
  if (hour >= 5 && hour < 13) return "Buongiorno";
  if (hour >= 13 && hour < 18) return "Buon pomeriggio";
  return "Buonasera";
}

function weekdayName(value: Instant): string {
  return textPart(value, { weekday: "long" }, "weekday");
}

function dayAndMonth(value: Instant, now: Instant): string {
  const { day, year } = romeParts(value);
  const month = textPart(value, { month: "long" }, "month");
  return year === romeParts(now).year
    ? `${day} ${month}`
    : `${day} ${month} ${year}`;
}

/** Last day of the month of a day key. */
function isLastDayOfMonth(dayKey: string): boolean {
  return addDaysToDayKey(dayKey, 1).slice(0, 7) !== dayKey.slice(0, 7);
}

/**
 * How a coming deadline reads after «entro»: `oggi`, `domani`, a weekday up
 * to Sunday of the current week, then `fine mese` / `fine novembre` /
 * `fine gennaio 2027` for the last day of a month, else `26 ottobre`
 * (year only if it is not the current one).
 */
function comingDeadline(due: Instant, now: Instant): string {
  const dueKey = toDayKey(due);
  const nowKey = toDayKey(now);
  const days = romeDayNumber(due) - romeDayNumber(now);
  if (days === 0) return "oggi";
  if (days === 1) return "domani";
  if (dueKey <= addDaysToDayKey(getWeekStartKey(nowKey), 6)) {
    return weekdayName(due);
  }
  if (isLastDayOfMonth(dueKey)) {
    const dueParts = romeParts(due);
    const nowParts = romeParts(now);
    if (dueParts.year === nowParts.year && dueParts.month === nowParts.month) {
      return "fine mese";
    }
    const month = textPart(due, { month: "long" }, "month");
    return dueParts.year === nowParts.year
      ? `fine ${month}`
      : `fine ${month} ${dueParts.year}`;
  }
  return dayAndMonth(due, now);
}

/** `ieri` or `il 15 ottobre`, for a deadline already gone. */
function pastDeadline(due: Instant, now: Instant): string {
  return romeDayNumber(now) - romeDayNumber(due) === 1
    ? "ieri"
    : withDateArticle(dayAndMonth(due, now));
}

/** `il 28 ottobre`, but `l'1 ottobre`, `l'8 ottobre`, `l'11 ottobre`. */
function withDateArticle(dayAndMonthText: string): string {
  const day = Number.parseInt(dayAndMonthText, 10);
  return day === 1 || day === 8 || day === 11
    ? `l'${dayAndMonthText}`
    : `il ${dayAndMonthText}`;
}

/** After «scade»: `a fine mese`, `il 28 ottobre`; words stay as they are. */
function withPreposition(phrase: string): string {
  if (phrase.startsWith("fine ")) return `a ${phrase}`;
  if (/^\d/.test(phrase)) return withDateArticle(phrase);
  return phrase;
}

function capitalizeIf(text: string, capitalized: boolean): string {
  return capitalized ? capitalize(text) : text;
}

/**
 * Deadline in words (table of issue #23, valid for every page): `Entro oggi`,
 * `Entro domani`, `Entro giovedì` (up to Sunday of this week), `Entro fine
 * mese`, `Entro fine novembre`, `Entro 26 ottobre`, `Entro 15 gennaio 2027`;
 * already gone: `Scaduto ieri`, `Scaduto il 15 ottobre`. With
 * `capitalized: false` it reads inside a sentence (`entro venerdì`).
 */
export function formatDeadline(
  due: Instant,
  now: Instant = new Date(),
  options: { capitalized?: boolean } = {},
): string {
  const { capitalized = true } = options;
  const days = romeDayNumber(due) - romeDayNumber(now);
  const text =
    days < 0
      ? `scaduto ${pastDeadline(due, now)}`
      : `entro ${comingDeadline(due, now)}`;
  return capitalizeIf(text, capitalized);
}

/**
 * For the closest deadline: `Il primo scade oggi`, `... domani`, `... venerdì`,
 * `... fine mese`, `... 26 ottobre` (same rules as `formatDeadline`);
 * already gone: `Il primo è scaduto ieri`.
 */
export function formatFirstDeadline(
  due: Instant,
  now: Instant = new Date(),
  options: { capitalized?: boolean } = {},
): string {
  const { capitalized = true } = options;
  const days = romeDayNumber(due) - romeDayNumber(now);
  const text =
    days < 0
      ? `il primo è scaduto ${pastDeadline(due, now)}`
      : `il primo scade ${withPreposition(comingDeadline(due, now))}`;
  return capitalizeIf(text, capitalized);
}
