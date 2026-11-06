import { isValidDayKey } from "../../lib/datetime";
import type { AddType } from "./detect-type";
import { joinNames } from "./labels";
import {
  SHOPPING_NAME_MAX,
  SHOPPING_QUANTITY_MAX,
  type ShoppingEntry,
} from "./parse-list";

/** Texts and small rules of Spesa, Da fare and Scadenza (issue #22, specifica §8). */

export const TODO_TITLE_MAX_LENGTH = 80;

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

/** Messages under the fields when a thing of Spesa is edited (name, then quantity). */
export function validateShoppingEdit(
  name: string,
  quantity: string,
): { name: string | null; quantity: string | null } {
  return {
    name:
      name === ""
        ? "Scrivi cosa manca."
        : length(name) > SHOPPING_NAME_MAX
          ? `Il nome può avere al massimo ${SHOPPING_NAME_MAX} caratteri.`
          : null,
    quantity:
      length(quantity) > SHOPPING_QUANTITY_MAX
        ? `La quantità può avere al massimo ${SHOPPING_QUANTITY_MAX} caratteri.`
        : null,
  };
}

/** Under the name: another thing still to buy has it. */
export function shoppingDuplicateText(name: string): string {
  return `${name} è già in lista.`;
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
export function validateDeadline(title: string): string | null {
  if (title === "") {
    return `Manca cosa scade: scrivi per esempio ${DEADLINE_EXAMPLE}.`;
  }
  return length(title) > TODO_TITLE_MAX_LENGTH
    ? `Il titolo può avere al massimo ${TODO_TITLE_MAX_LENGTH} caratteri.`
    : null;
}

/** The last day a date can have (`deadlines_due_date_range`). */
const LAST_DAY = "2100-12-31";

export const DATE_MISSING_TEXT =
  "Manca la data: sceglila qui sotto o scrivila nella frase.";
export const DATE_PAST_TEXT =
  "Questa data è già passata: scegli una data da oggi in poi.";
export const DATE_TOO_FAR_TEXT = "Scegli una data entro il 2100.";

/**
 * Message under «Data» of Da fare and Scadenza, or null when it can be saved
 * (#333, R7). An empty date is wrong only for a Scadenza; a date not before today
 * and not after 31/12/2100 is checked when it is new or changed (`checkRange`).
 */
export function validateThingDate(args: {
  dueDate: string | null;
  todayKey: string;
  required: boolean;
  checkRange: boolean;
}): string | null {
  const { dueDate, todayKey, required, checkRange } = args;
  if (dueDate === null || dueDate === "") {
    return required ? DATE_MISSING_TEXT : null;
  }
  if (!checkRange) return null;
  // A year with more than four digits is not a day key: it is too far as well.
  if (!isValidDayKey(dueDate) || dueDate > LAST_DAY) return DATE_TOO_FAR_TEXT;
  return dueDate < todayKey ? DATE_PAST_TEXT : null;
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

/**
 * Text of the main button of Da fare: «Dai a Laura e Sofia» names the people
 * other than the author, in the order of the group; with nobody else it is
 * «Aggiungi ai da fare».
 */
export function todoSubmitLabel(args: {
  empty: boolean;
  otherNames: readonly string[];
}): string {
  if (args.empty) return "Aggiungi";
  return args.otherNames.length > 0
    ? `Dai a ${joinNames(args.otherNames)}`
    : "Aggiungi ai da fare";
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
  kind: "da-fare" | "scadenza" | "spesa",
  isPrivate: boolean,
): string {
  if (kind === "spesa") return "Sparisce dalla spesa di tutto il Nest.";
  if (kind === "da-fare") {
    return isPrivate
      ? "Sparisce dalla tua lista."
      : "Sparisce dalla lista di tutto il Nest.";
  }
  return isPrivate
    ? "Sparisce dalle tue scadenze e non riceverai più avvisi."
    : "Sparisce dalle scadenze di tutto il Nest e non arriveranno più avvisi.";
}
