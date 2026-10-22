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

function textPart(
  value: Instant,
  options: Intl.DateTimeFormatOptions,
  type: Intl.DateTimeFormatPartTypes,
): string {
  const formatter = new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIME_ZONE,
    ...options,
  });
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
 * Calendar days from `now` to `target`, counted in Rome (not in 24-hour blocks):
 * `oggi`, `domani`, `tra 6 giorni`, `ieri`, `3 giorni fa`.
 */
export function formatDaysUntil(
  target: Instant,
  now: Instant = new Date(),
): string {
  const days = romeDayNumber(target) - romeDayNumber(now);
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
