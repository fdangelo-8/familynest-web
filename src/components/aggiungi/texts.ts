import type { AddType } from "./detect-type";
import {
  SHOPPING_NAME_MAX,
  SHOPPING_QUANTITY_MAX,
  type ShoppingEntry,
} from "./parse-list";

/** Texts and small rules of Spesa, Da fare and Scadenza (issue #22, specifica §8). */

export const TODO_TITLE_MAX_LENGTH = 80;

export const EXAMPLES = [
  "cena da Marta venerdì alle 20",
  "latte e pane",
  "Laura deve chiamare la nonna",
  "bollo auto scade il 7 dicembre",
] as const;

/** Text of the field when it is empty, by type (proposal P1 of the #113). */
export function placeholderOf(type: AddType): string {
  if (type === "spesa") return "Cosa manca in casa?";
  if (type === "scadenza") return "Cosa scade, e quando?";
  return "Cosa c'è da fare?";
}

export const SAVE_FAILED_THING_TEXT =
  "Non siamo riusciti a salvare. Controlla la connessione e riprova.";
export const DELETE_FAILED_TEXT =
  "Non siamo riusciti a eliminare. Riprova tra qualche secondo.";
export const GONE_TITLE = "Questa cosa non c'è più";
export const GONE_TEXT = "Forse l'ha tolta qualcun altro.";
export const GONE_ALERT_TEXT = `${GONE_TITLE}. ${GONE_TEXT}`;
export const LOAD_FAILED_TEXT =
  "Non riusciamo a caricare questa cosa. Controlla la connessione e riprova.";

export const UNDO_EDIT_FAILED_TEXT =
  "Non siamo riusciti ad annullare. Le modifiche sono rimaste.";
export const UNDO_EDIT_GONE_TEXT =
  "Non siamo riusciti ad annullare: questa cosa non c'è più.";
export const UNDO_SHOPPING_FAILED_TEXT =
  "Non siamo riusciti ad annullare. Le cose sono rimaste nella spesa.";
export const UNDO_TODO_FAILED_TEXT =
  "Non siamo riusciti ad annullare. La cosa è rimasta nei da fare.";
export const UNDO_DEADLINE_FAILED_TEXT =
  "Non siamo riusciti ad annullare. La scadenza è rimasta tra le scadenze.";

const SHOPPING_EXAMPLE = "«latte, pane e 6 uova»";
const TODO_EXAMPLE = "«Laura deve chiamare la nonna entro venerdì»";
const DEADLINE_EXAMPLE = "«bollo auto scade il 7 dicembre»";

function length(text: string): number {
  return [...text].length;
}

/** Message under the field for Spesa, or null when it can be saved. */
export function validateShopping(
  entries: readonly ShoppingEntry[],
): string | null {
  if (entries.length === 0) {
    return `Scrivi cosa manca: per esempio ${SHOPPING_EXAMPLE}.`;
  }
  const tooLong = entries.some(
    (entry) =>
      length(entry.name) > SHOPPING_NAME_MAX ||
      (entry.quantity !== null &&
        length(entry.quantity) > SHOPPING_QUANTITY_MAX),
  );
  return tooLong
    ? `Ogni cosa può avere al massimo ${SHOPPING_NAME_MAX} caratteri, e la quantità ${SHOPPING_QUANTITY_MAX}.`
    : null;
}

/** Message under the field for Da fare, or null when it can be saved. */
export function validateTodo(title: string): string | null {
  if (title === "") {
    return `Manca cosa c'è da fare: scrivi per esempio ${TODO_EXAMPLE}.`;
  }
  return length(title) > TODO_TITLE_MAX_LENGTH
    ? `Il titolo può avere al massimo ${TODO_TITLE_MAX_LENGTH} caratteri.`
    : null;
}

/** Message under the field for Scadenza, or null when it can be saved. */
export function validateDeadline(args: {
  title: string;
  dueDate: string | null;
  todayKey: string;
  /** The «già passata» check: on a new deadline, or when the date changed */
  checkPast: boolean;
}): string | null {
  const { title, dueDate, todayKey, checkPast } = args;
  if (dueDate === null) {
    return `Manca la data: scrivi per esempio ${DEADLINE_EXAMPLE}.`;
  }
  if (title === "") {
    return `Manca cosa scade: scrivi per esempio ${DEADLINE_EXAMPLE}.`;
  }
  if (checkPast && dueDate < todayKey) {
    return "Questa data è già passata: scrivi una data da oggi in poi.";
  }
  return length(title) > TODO_TITLE_MAX_LENGTH
    ? `Il titolo può avere al massimo ${TODO_TITLE_MAX_LENGTH} caratteri.`
    : null;
}

export function thingsCount(count: number): string {
  return count === 1 ? "1 cosa" : `${count} cose`;
}

/** Text of the main button of Spesa. */
export function shoppingSubmitLabel(args: {
  empty: boolean;
  total: number;
  fresh: number;
}): string {
  const { empty, total, fresh } = args;
  if (empty || total === 0) return "Aggiungi";
  if (fresh === 0) return "Già tutto in lista";
  return `Aggiungi ${thingsCount(fresh)}`;
}

/** Text of the main button of Da fare. */
export function todoSubmitLabel(args: {
  empty: boolean;
  otherName: string | null;
}): string {
  if (args.empty) return "Aggiungi";
  return args.otherName ? `Dai a ${args.otherName}` : "Aggiungi ai da fare";
}

export const REMINDERS = [
  { days: 30, label: "30 giorni prima" },
  { days: 7, label: "7 giorni" },
  { days: 1, label: "1 giorno" },
  { days: 0, label: "Il giorno stesso" },
] as const;

export const DEFAULT_REMINDERS: readonly number[] = [30, 7, 1];

/** Consequence shown in the dialog that asks to delete. */
export function deleteConsequence(
  kind: "da-fare" | "scadenza",
  isPrivate: boolean,
): string {
  if (kind === "da-fare") {
    return isPrivate
      ? "Sparisce dalla tua lista."
      : "Sparisce dalla lista di tutto il Nest.";
  }
  return isPrivate
    ? "Sparisce dalle tue scadenze e non riceverai più avvisi."
    : "Sparisce dalle scadenze di tutto il Nest e non arriveranno più avvisi.";
}
