import { hasShoppingPrefix, looksLikeList } from "./parse-list";
import { parsePhrase, type PhraseMember } from "./parse-phrase";
import {
  hasDeadlineWord,
  hasEntroDate,
  startsWithAssignee,
  type TodoPerson,
} from "./parse-todo";

/** The four types of the Add sheet, as the address and the selector name them. */
export type AddType = "impegno" | "da-fare" | "spesa" | "scadenza";

export const ADD_TYPES: readonly AddType[] = [
  "impegno",
  "da-fare",
  "spesa",
  "scadenza",
];

/**
 * The type the phrase asks for (issue #22, requisito §1), or null when no rule
 * applies and the type stays the one already chosen. Rules, first one wins:
 * «spesa:» at the start, a deadline word, «<Nome> deve» / «devo» / «entro» and
 * a date, a day or a time, a list.
 */
export function detectType(
  phrase: string,
  todayKey: string,
  members: readonly (TodoPerson & PhraseMember)[],
  meId: string | null,
): AddType | null {
  if (phrase.trim() === "") return null;
  if (hasShoppingPrefix(phrase)) return "spesa";
  if (hasDeadlineWord(phrase)) return "scadenza";
  if (
    startsWithAssignee(phrase, members, meId) ||
    hasEntroDate(phrase, todayKey)
  ) {
    return "da-fare";
  }
  const event = parsePhrase(phrase, todayKey, members);
  if (event.dayKey !== null || event.time !== null) return "impegno";
  if (looksLikeList(phrase)) return "spesa";
  return null;
}
