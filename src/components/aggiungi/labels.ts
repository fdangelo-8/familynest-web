import {
  formatDayNumber,
  formatLongDay,
  formatTime,
  startOfDay,
  type Instant,
} from "../../lib/datetime";
import type { ParsedPhrase, PhraseSlot } from "./parse-phrase";

/** Texts and short formats of the Add sheet (issue #20, specifica §8). */

export const TITLE_MAX_LENGTH = 100;

export const EXAMPLE_PHRASE = "cena da Marta venerdì alle 20";

export const SAVE_FAILED_TEXT =
  "Non siamo riusciti a salvare l'impegno. Controlla la connessione e riprova.";
export const UNDO_FAILED_TEXT =
  "Non siamo riusciti ad annullare. L'impegno è rimasto in calendario.";
export const MEMBERS_FAILED_TEXT =
  "Non riusciamo a caricare le persone del Nest, quindi i nomi non vengono riconosciuti. Controlla la connessione e riprova.";

const HINT = "scrivi per esempio «dentista giovedì alle 16».";
const MISSING_TITLE = `Manca cosa c'è da fare: ${HINT}`;
const MISSING_DAY_AND_TIME = `Mancano il giorno e l'ora: ${HINT}`;
const MISSING_TIME = `Manca l'ora: ${HINT}`;
const TITLE_TOO_LONG = `Il titolo può avere al massimo ${TITLE_MAX_LENGTH} caratteri.`;

/** The message under the field, or null when the phrase can be saved. */
export function validatePhrase(parsed: ParsedPhrase): string | null {
  if (parsed.title === "") return MISSING_TITLE;
  if (parsed.dayKey === null && parsed.time === null)
    return MISSING_DAY_AND_TIME;
  if (parsed.time === null) return MISSING_TIME;
  if ([...parsed.title].length > TITLE_MAX_LENGTH) return TITLE_TOO_LONG;
  return null;
}

function yearOf(dayKey: string): string {
  return dayKey.slice(0, 4);
}

function sameMonth(dayKey: string, todayKey: string): boolean {
  return dayKey.slice(0, 7) === todayKey.slice(0, 7);
}

/**
 * «Giovedì 22», «Sabato 7 novembre» (other month), «Giovedì 7 ottobre 2027»
 * (other year).
 */
export function dayLabel(dayKey: string, todayKey: string): string {
  const base = formatDayNumber(startOfDay(dayKey), {
    withMonth: !sameMonth(dayKey, todayKey),
  });
  return yearOf(dayKey) === yearOf(todayKey)
    ? base
    : `${base} ${yearOf(dayKey)}`;
}

/** «Giovedì 22 ottobre», with the year when it is not the current one. */
export function longDayLabel(dayKey: string, todayKey: string): string {
  const base = formatLongDay(startOfDay(dayKey));
  return yearOf(dayKey) === yearOf(todayKey)
    ? base
    : `${base} ${yearOf(dayKey)}`;
}

/** «alle 17:00», but «all'1:00» for the hour 1. */
export function atTime(value: Instant): string {
  const text = formatTime(value);
  return text.startsWith("1:") ? `all'${text}` : `alle ${text}`;
}

function lower(text: string): string {
  return text.toLocaleLowerCase("it-IT");
}

/** The day as it reads in the button and in the toast: «giovedì 22». */
export function dayInSentence(dayKey: string, todayKey: string): string {
  return lower(dayLabel(dayKey, todayKey));
}

/** Text of the submit button. */
export function submitLabel(
  phrase: string,
  parsed: ParsedPhrase,
  todayKey: string,
): string {
  if (phrase.trim() === "") return "Aggiungi";
  const dayKey = parsed.dayKey ?? (parsed.time ? todayKey : null);
  return dayKey ? `Metti in ${dayInSentence(dayKey, todayKey)}` : "Aggiungi";
}

/** «17:00 – 18:00», or «22:00 – 1:00 (domenica 25)» when it ends the next day. */
export function rangeLabel(slot: PhraseSlot, todayKey: string): string {
  const range = `${formatTime(slot.startsAt)} – ${formatTime(slot.endsAt)}`;
  return slot.endDayKey === slot.dayKey
    ? range
    : `${range} (${dayInSentence(slot.endDayKey, todayKey)})`;
}

/** «Giovedì 22, fino alle 18:00» / «Sabato 24, fino all'1:00 di domenica 25». */
export function previewInfo(slot: PhraseSlot, todayKey: string): string {
  const start = dayLabel(slot.dayKey, todayKey);
  const until = atTime(slot.endsAt);
  return slot.endDayKey === slot.dayKey
    ? `${start}, fino ${until}`
    : `${start}, fino ${until} di ${dayInSentence(slot.endDayKey, todayKey)}`;
}

/** «Sofia», «Sofia e Tommaso», «Sofia, Tommaso e Leo». */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}
