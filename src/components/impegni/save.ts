import type { SupabaseClient } from "@supabase/supabase-js";
import { addDaysToDayKey } from "@/lib/datetime";
import type { EventOccurrence } from "@/lib/household-events";
import type { Database } from "@/types/database";
import {
  initialRepeat,
  isoWeekdayOf,
  shiftOf,
  type EventFormValues,
} from "./model";

type Client = SupabaseClient<Database>;
type Functions = Database["public"]["Functions"];
type UpdateEventArgs = Functions["update_event"]["Args"];
type UpdateOccurrenceArgs = Functions["update_event_occurrence"]["Args"];

/** «Solo questo» changes the open occurrence, «Tutti i prossimi» it and the following ones. */
export type SaveScope = "this" | "following";

export type SaveOutcome =
  | {
      ok: true;
      /** The event that now holds the occurrence (new after a split of the series) */
      id: string;
      /** `YYYY-MM-DD` of the occurrence for `?giorno=` */
      day: string;
    }
  | {
      ok: false;
      reason:
        /** The event is gone (deleted by someone else) */
        | "missing"
        /** Another occurrence of the series starts on that day */
        | "day-taken"
        /** The escort does not see the event: only with «Tutti i prossimi» */
        | "escort"
        /** A repeated event lasts at most 7 days */
        | "duration"
        /** Network or any other failure: nothing is told about it */
        | "failed";
    };

type DbError = { code?: string | null; message?: string | null };

/** Maps a database error to what the page tells the user. */
export function failureReason(
  error: DbError,
): Extract<SaveOutcome, { ok: false }>["reason"] {
  const message = error.message ?? "";
  if (error.code === "P0002") return "missing";
  if (
    error.code === "P0001" &&
    message.includes("another occurrence of the event starts on that day")
  ) {
    return "day-taken";
  }
  if (error.code === "42501" && message.includes("must already see")) {
    return "escort";
  }
  if (message.includes("events_repeated_duration")) return "duration";
  return "failed";
}

/** The weekdays of the rule moved by the same days as the form's day. */
function shiftWeekdays(weekdays: ReadonlyArray<number>, shift: number) {
  return [
    ...new Set(weekdays.map((d) => ((((d - 1 + shift) % 7) + 7) % 7) + 1)),
  ].sort((a, b) => a - b);
}

/**
 * The repetition the form asks for, as the database wants it:
 * - same rule: the series keeps its rhythm, moved by the shift of the form's
 *   day (weekdays and last day move with it);
 * - new rule: it starts from the form's day; the last day stays only if it is
 *   not before that day.
 */
function repetitionOf(
  occ: EventOccurrence,
  values: EventFormValues,
): {
  recurrence: UpdateEventArgs["p_recurrence"];
  weekdays: number[] | null;
  until: string | null;
} {
  const shift = shiftOf(occ, values);
  const sameRule = values.repeat === initialRepeat(occ);
  if (values.repeat === "none") {
    return { recurrence: "none", weekdays: null, until: null };
  }
  const until = occ.recurrenceUntil
    ? sameRule
      ? addDaysToDayKey(occ.recurrenceUntil, shift)
      : occ.recurrenceUntil >= values.day
        ? occ.recurrenceUntil
        : null
    : null;
  if (values.repeat === "monthly") {
    return { recurrence: "monthly", weekdays: null, until };
  }
  const weekdays =
    values.repeat === "current"
      ? shiftWeekdays(occ.recurrenceWeekdays, shift)
      : [isoWeekdayOf(values.day)];
  return { recurrence: "weekly", weekdays, until };
}

const orNull = (text: string): string | null => {
  const trimmed = text.trim();
  return trimmed === "" ? null : trimmed;
};

/**
 * Saves the form. Never throws. `p_day` is always the day of the open
 * occurrence (`occurrenceDate`), never null (#129).
 */
export async function saveEvent(
  supabase: Client,
  occ: EventOccurrence,
  values: EventFormValues,
  times: { start: Date; end: Date },
  scope: SaveScope,
): Promise<SaveOutcome> {
  try {
    if (scope === "this") {
      const args = {
        p_event_id: occ.id,
        p_day: occ.occurrenceDate,
        p_title: values.title.trim(),
        p_starts_at: times.start.toISOString(),
        p_ends_at: times.end.toISOString(),
        p_location: orNull(values.place),
        p_escort_member_id: values.escortId,
        p_notes: orNull(values.notes),
      } as UpdateOccurrenceArgs;
      const { error } = await supabase.rpc("update_event_occurrence", args);
      if (error) return { ok: false, reason: failureReason(error) };
      return { ok: true, id: occ.id, day: values.day };
    }

    const repetition = repetitionOf(occ, values);
    const args = {
      p_event_id: occ.id,
      p_day: occ.occurrenceDate,
      p_title: values.title.trim(),
      p_starts_at: times.start.toISOString(),
      p_ends_at: times.end.toISOString(),
      p_visibility: values.visibility,
      p_member_ids: values.memberIds,
      p_location: orNull(values.place),
      p_escort_member_id: values.escortId,
      p_recurrence: repetition.recurrence,
      p_recurrence_weekdays: repetition.weekdays,
      p_recurrence_until: repetition.until,
      p_notes: orNull(values.notes),
    } as UpdateEventArgs;
    const { data, error } = await supabase.rpc("update_event", args);
    if (error) return { ok: false, reason: failureReason(error) };
    const row = Array.isArray(data) ? data[0] : null;
    if (!row || typeof row.id !== "string" || typeof row.day !== "string") {
      return { ok: false, reason: "failed" };
    }
    return { ok: true, id: row.id, day: row.day };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

export type DeleteScope = "this" | "following";

/** Deletes the open occurrence («this»), or it and the following ones. Never throws. */
export async function deleteEvent(
  supabase: Client,
  occ: EventOccurrence,
  scope: DeleteScope,
): Promise<"ok" | "missing" | "failed"> {
  try {
    const { error } = await supabase.rpc("delete_event_occurrence", {
      p_event_id: occ.id,
      p_day: occ.occurrenceDate,
      p_scope: scope,
    });
    if (!error) return "ok";
    return failureReason(error) === "missing" ? "missing" : "failed";
  } catch {
    return "failed";
  }
}
