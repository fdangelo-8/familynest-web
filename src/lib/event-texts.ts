import {
  formatLongDay,
  startOfDay,
  toDayKey,
  type Instant,
} from "@/lib/datetime";

/**
 * Texts about an event that repeats and about the people it concerns (issue
 * #19, shared with #20): the «Ripete» row, the dialogs for saving and deleting
 * and the toast after a deletion. Pure functions, no React. Days are Rome
 * `YYYY-MM-DD` keys; `now` only decides whether a year is written.
 */

const WEEKDAY_NAMES = [
  "lunedì",
  "martedì",
  "mercoledì",
  "giovedì",
  "venerdì",
  "sabato",
  "domenica",
] as const;

const MONTH_NAMES = [
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
] as const;

/** `A`, `A e B`, `A, B e C`. */
export function joinNames(names: ReadonlyArray<string>): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}

/** `il 20`, but `l'1`, `l'8`, `l'11`. */
function withDayArticle(day: number, text: string): string {
  return day === 1 || day === 8 || day === 11 ? `l'${text}` : `il ${text}`;
}

function parseDayKey(dayKey: string): {
  year: number;
  month: number;
  day: number;
} {
  const [year, month, day] = dayKey.split("-").map(Number);
  return { year: year ?? 0, month: month ?? 1, day: day ?? 1 };
}

/** `21 ottobre`, with the year (`21 ottobre 2027`) when it is not the year of `now`. */
function dayAndMonthOf(dayKey: string, now: Instant): string {
  const { year, month, day } = parseDayKey(dayKey);
  const text = `${day} ${MONTH_NAMES[month - 1]}`;
  return year === parseDayKey(toDayKey(now)).year ? text : `${text} ${year}`;
}

/** `martedì 20 ottobre`, with the year when it is not the year of `now`. Lowercase, for inside a sentence. */
export function formatDayInSentence(dayKey: string, now: Instant): string {
  const text = formatLongDay(startOfDay(dayKey), { capitalized: false });
  const { year } = parseDayKey(dayKey);
  return year === parseDayKey(toDayKey(now)).year ? text : `${text} ${year}`;
}

export type RecurrenceInfo = {
  recurrence: "none" | "weekly" | "monthly";
  /** ISO weekdays, 1 = Monday ... 7 = Sunday (weekly series) */
  weekdays: ReadonlyArray<number>;
  /** Day of the series that gives the day of the month (monthly series) */
  seriesDay: string;
  /** Last day of the series, `YYYY-MM-DD` */
  until: string | null;
};

/**
 * The rule of a series, for the «Ripete» row: `Ogni martedì e giovedì`,
 * `Ogni giorno`, `Ogni mese, il 20`, `Ogni mese, l'8`; with the last day
 * `, fino al 21 ottobre` (`fino all'8 dicembre`). Empty for «Mai».
 * - `capitalized: false`: lowercase, for inside a sentence.
 * - `withUntil: false`: without the last day (dialogs and toasts).
 */
export function formatRecurrence(
  info: RecurrenceInfo,
  now: Instant,
  options: { capitalized?: boolean; withUntil?: boolean } = {},
): string {
  const { capitalized = true, withUntil = true } = options;
  let text: string;
  if (info.recurrence === "weekly") {
    const days = [...new Set(info.weekdays)]
      .filter((d) => d >= 1 && d <= 7)
      .sort((a, b) => a - b);
    if (days.length === 0) return "";
    text =
      days.length === 7
        ? "ogni giorno"
        : `ogni ${joinNames(days.map((d) => WEEKDAY_NAMES[d - 1] as string))}`;
  } else if (info.recurrence === "monthly") {
    const day = parseDayKey(info.seriesDay).day;
    text = `ogni mese, ${withDayArticle(day, String(day))}`;
  } else {
    return "";
  }
  if (withUntil && info.until) {
    const day = parseDayKey(info.until).day;
    const when = dayAndMonthOf(info.until, now);
    text += `, fino ${day === 1 || day === 8 || day === 11 ? "all'" : "al "}${when}`;
  }
  return capitalized ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

/** `Si ripete ogni martedì e giovedì.` (no last day), or empty for «Mai». */
export function formatRepeatSentence(
  info: RecurrenceInfo,
  now: Instant,
): string {
  const rule = formatRecurrence(info, now, {
    capitalized: false,
    withUntil: false,
  });
  return rule ? `Si ripete ${rule}.` : "";
}

/* ---------- Deleting ---------- */

export type DeleteScope = "one" | "following" | "all";

/** Title of the delete dialog: `Eliminare «Nuoto Sofia»?` */
export function deleteDialogTitle(title: string): string {
  return `Eliminare «${title}»?`;
}

/**
 * Text of the delete dialog. `others` are the names of the people concerned
 * (author, participants, escort) without me and without pets, in the order of
 * the members, each once.
 * `Si ripete ogni martedì e giovedì. Laura e Sofia non lo vedranno più nel
 * calendario.` · `Laura non lo vedrà più nel calendario.` · `Sparisce dal
 * calendario.`
 */
export function deleteDialogText(
  info: RecurrenceInfo,
  others: ReadonlyArray<string>,
  now: Instant,
): string {
  const parts: string[] = [];
  const repeats = formatRepeatSentence(info, now);
  if (repeats) parts.push(repeats);
  if (others.length === 0) {
    // «Sparisce dal calendario.» only when nothing else was said
    if (!repeats) parts.push("Sparisce dal calendario.");
  } else if (others.length === 1) {
    parts.push(`${others[0]} non lo vedrà più nel calendario.`);
  } else {
    parts.push(`${joinNames(others)} non lo vedranno più nel calendario.`);
  }
  return parts.join(" ");
}

/**
 * Toast after a deletion (no «Annulla»), as parts of `ToastOptions`:
 * `Eliminato: **Nuoto Sofia**.` · `Eliminato martedì 20 ottobre: **…**.` ·
 * `Eliminato da martedì 20 ottobre in poi: **…**.`
 * Deleting the whole event, or the following ones from the first occurrence
 * (`isFirst`), reads like deleting everything.
 */
export function deleteToast(
  scope: DeleteScope,
  title: string,
  dayKey: string,
  isFirst: boolean,
  now: Instant,
): { text: string; emphasis: string; after: string } {
  const day = formatDayInSentence(dayKey, now);
  let text = "Eliminato:";
  if (scope === "one") text = `Eliminato ${day}:`;
  else if (scope === "following" && !isFirst) {
    text = `Eliminato da ${day} in poi:`;
  }
  return { text, emphasis: title, after: "." };
}

/* ---------- Saving a repeated event ---------- */

/** Title of the save dialog: `Salvare le modifiche a «Nuoto Sofia»?` (the saved title). */
export function saveDialogTitle(savedTitle: string): string {
  return `Salvare le modifiche a «${savedTitle}»?`;
}

/**
 * Text of the dialog with two choices (only details changed):
 * `Si ripete ogni martedì e giovedì. Puoi cambiare solo giovedì 22 ottobre
 * oppure anche tutte le volte dopo, comprese quelle già cambiate a parte.
 * Le volte prima restano come sono.`
 * - `isFirst`: the open occurrence is the first of the series (no last sentence).
 * - `movedAloneTo`: day the open occurrence goes back to in the rhythm of the
 *   series with «Salva tutti i prossimi», when it had been moved by itself.
 */
export function saveChoiceText(args: {
  info: RecurrenceInfo;
  openDay: string;
  isFirst: boolean;
  movedAloneTo?: string | null;
  now: Instant;
}): string {
  const { info, openDay, isFirst, movedAloneTo, now } = args;
  const parts = [
    formatRepeatSentence(info, now),
    `Puoi cambiare solo ${formatDayInSentence(openDay, now)} oppure anche tutte le volte dopo, comprese quelle già cambiate a parte.`,
  ];
  if (!isFirst) parts.push("Le volte prima restano come sono.");
  if (movedAloneTo) {
    parts.push(
      `Questa volta era stata spostata da sola: con «Salva tutti i prossimi» va a ${formatDayInSentence(movedAloneTo, now)}, nel giorno della serie.`,
    );
  }
  return parts.join(" ");
}

export type SaveChange = "recurrence" | "members" | "visibility";

const CHANGE_NAMES: Record<SaveChange, string> = {
  recurrence: "la ripetizione",
  members: "chi partecipa",
  visibility: "chi lo vede",
};

/**
 * Text of the dialog with the only choice «Salva tutti i prossimi». Sentences
 * appear only when they apply, in this order.
 * - `changes`: what changed among «Si ripete» (not to «Mai»), «Chi», «Chi lo
 *   vede»; the list follows the order of the form.
 * - `toNever`: «Si ripete» became «Mai».
 * - `escortUnseen`: name of the escort who does not see the event.
 * - `fromDay`: day the open occurrence will start after saving.
 */
export function saveAllText(args: {
  info: RecurrenceInfo;
  fromDay: string;
  isFirst: boolean;
  changes: ReadonlyArray<SaveChange>;
  toNever?: boolean;
  escortUnseen?: string | null;
  now: Instant;
}): string {
  const { info, fromDay, isFirst, changes, toNever, escortUnseen, now } = args;
  const day = formatDayInSentence(fromDay, now);
  const parts = [formatRepeatSentence(info, now)];
  if (toNever) {
    parts.push(
      `Con «Mai» resta solo ${day}: le volte dopo spariscono dal calendario.`,
    );
  }
  const listed = (["recurrence", "members", "visibility"] as const)
    .filter((c) => changes.includes(c))
    .filter((c) => !(toNever && c === "recurrence"))
    .map((c) => CHANGE_NAMES[c]);
  if (listed.length > 0) {
    parts.push(
      `Hai cambiato ${joinNames(listed)}: vale per tutte le volte da ${day} in poi.`,
    );
  }
  if (escortUnseen) {
    parts.push(
      `${escortUnseen} ora non vede questo impegno: se la scegli in «La porta», lo vedrà da ${day} in poi.`,
    );
  }
  if (!isFirst) parts.push("Le volte prima restano come sono.");
  return parts.filter(Boolean).join(" ");
}
