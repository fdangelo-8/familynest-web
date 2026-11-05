import type { EventVisibility } from "../../lib/calendar";
import { isValidDayKey, toTimeFieldValue } from "../../lib/datetime";
import type { EventFormValues, FocusKey } from "../evento-modulo/model";
import { dayInSentence } from "./labels";
import type { ParsedPhrase, PhraseSlot } from "./parse-phrase";

/** Pure rules of the full form «Nuovo impegno» opened from Aggiungi (#171). */

/** Where the form was opened from: the button or one of the four summary rows. */
export type FormEntry = "details" | "day" | "people" | "escort" | "visibility";

/** The field that takes the focus when the form opens from each entry. */
export const ENTRY_FOCUS: Record<FormEntry, FocusKey> = {
  details: "title",
  day: "day",
  people: "people",
  escort: "escort",
  visibility: "visibility",
};

/** The values of the form, read from the phrase the way the first step reads it. */
export function initialFormValues({
  parsed,
  slot,
  todayKey,
  memberIds,
  visibility,
}: {
  parsed: ParsedPhrase;
  slot: PhraseSlot | null;
  todayKey: string;
  memberIds: string[];
  visibility: EventVisibility;
}): EventFormValues {
  return {
    title: parsed.title,
    day: parsed.dayKey ?? (parsed.time ? todayKey : ""),
    from: slot ? toTimeFieldValue(slot.startsAt) : "",
    to: slot ? toTimeFieldValue(slot.endsAt) : "",
    repeat: "none",
    place: "",
    memberIds,
    escortId: null,
    visibility,
    notes: "",
  };
}

/** «Metti in giovedì 22», or «Aggiungi» while «Giorno» is empty. */
export function formSubmitLabel(day: string, todayKey: string): string {
  return isValidDayKey(day)
    ? `Metti in ${dayInSentence(day, todayKey)}`
    : "Aggiungi";
}
