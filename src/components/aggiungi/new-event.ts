import type { EventVisibility } from "../../lib/calendar";
import { isValidDayKey, toDayKey } from "../../lib/datetime";
import { computeTimes, type EventFormValues } from "../evento-modulo/model";
import { dayInSentence } from "./labels";
import type { PhraseSlot } from "./parse-phrase";

/** Pure rules of the fields of an Impegno and of the full form «Nuovo impegno» (#171, #333). */

/**
 * The fields of an Impegno in the sheet, as they are now: what the phrase
 * says, unless the user changed the field by hand (#333, R1-R3).
 */
export type EventFields = {
  /** `YYYY-MM-DD`, or empty */
  day: string;
  /** `HH:MM`, or empty */
  from: string;
  /** `HH:MM`, or empty */
  to: string;
  memberIds: string[];
  visibility: EventVisibility;
};

/** The values of the full form: the fields of the sheet, with the phrase's title. */
export function initialFormValues(
  title: string,
  fields: EventFields,
): EventFormValues {
  return {
    title,
    day: fields.day,
    from: fields.from,
    to: fields.to,
    repeat: "none",
    place: "",
    memberIds: fields.memberIds,
    escortId: null,
    visibility: fields.visibility,
    notes: "",
  };
}

/**
 * Start, end and days of the fields (the end keeps the same day as the start,
 * or the next one when it is not after it), or null while something is missing.
 */
export function slotOfFields(
  fields: Pick<EventFields, "day" | "from" | "to">,
): PhraseSlot | null {
  const times = computeTimes(fields, 0);
  if (!times) return null;
  return {
    dayKey: fields.day,
    endDayKey: toDayKey(times.end),
    startsAt: times.start,
    endsAt: times.end,
  };
}

/** «Metti in giovedì 22», or «Aggiungi» while «Giorno» is empty. */
export function formSubmitLabel(day: string, todayKey: string): string {
  return isValidDayKey(day)
    ? `Metti in ${dayInSentence(day, todayKey)}`
    : "Aggiungi";
}
