import { createClient } from "@/lib/supabase/client";
import type { Direction, Visibility } from "./model";

/*
 * Writes of «Calendari collegati» (#34), made from the browser with the
 * adult's own session: the database rules (RLS and the column grants) decide
 * what can change, and each filter is the id of the row. Credentials never
 * come here: the columns that hold them cannot be read with this session.
 *
 * A write that touched no row counts as not saved (for example refused by the
 * rules), like in «Il tuo profilo».
 */

export type Saved = { ok: boolean };

const FAILED: Saved = { ok: false };
const DONE: Saved = { ok: true };

/** One calendar switched on or off. Effects (events, target) are triggers. */
export async function setCalendarEnabled(
  calendarId: string,
  enabled: boolean,
): Promise<Saved> {
  try {
    const { error, count } = await createClient()
      .from("external_calendars")
      .update({ is_enabled: enabled }, { count: "exact" })
      .eq("id", calendarId);
    return error || count === 0 ? FAILED : DONE;
  } catch {
    return FAILED;
  }
}

export type CalendarChoices = {
  direction: Direction;
  visibility: Visibility;
  countsForFreeTime: boolean;
  weekdaysOnly: boolean;
};

/** The four choices of the sheet of a calendar, saved together. */
export async function saveCalendarChoices(
  calendarId: string,
  choices: CalendarChoices,
): Promise<Saved> {
  try {
    const { error, count } = await createClient()
      .from("external_calendars")
      .update(
        {
          direction: choices.direction,
          visibility: choices.visibility,
          counts_for_free_time: choices.countsForFreeTime,
          weekdays_only: choices.weekdaysOnly,
        },
        { count: "exact" },
      )
      .eq("id", calendarId);
    return error || count === 0 ? FAILED : DONE;
  } catch {
    return FAILED;
  }
}

/** «Dove vanno i nuovi impegni»: a calendar of the adult, or none (`null`). */
export async function saveNewEventsCalendar(
  calendarId: string | null,
): Promise<Saved> {
  try {
    const { error } = await createClient().rpc("set_new_events_calendar", {
      // The function accepts null («Nessuno»); the generated type says string.
      p_calendar_id: calendarId as string,
    });
    return error ? FAILED : DONE;
  } catch {
    return FAILED;
  }
}

/**
 * «Scollega»: deletes the account. Calendars and imported events go with it,
 * the credentials go to the revocation queue (triggers of the database).
 */
export async function disconnectAccount(accountId: string): Promise<Saved> {
  try {
    const { error, count } = await createClient()
      .from("calendar_accounts")
      .delete({ count: "exact" })
      .eq("id", accountId);
    return error || count === 0 ? FAILED : DONE;
  } catch {
    return FAILED;
  }
}

/**
 * Asks the server to synchronise one account of the adult (`accountId`) or the
 * accounts that are out of date. Resolves when the work is finished.
 */
export async function requestSync(accountId?: string): Promise<Saved> {
  try {
    const response = await fetch("/calendari-collegati/sincronizza", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(accountId ? { accountId } : {}),
    });
    return response.ok ? DONE : FAILED;
  } catch {
    return FAILED;
  }
}

/** When each calendar was last synchronised: the progress of a running sync. */
export async function readSyncMarks(): Promise<Map<
  string,
  string | null
> | null> {
  try {
    const { data, error } = await createClient()
      .from("external_calendars")
      .select("id, last_synced_at");
    if (error) return null;
    return new Map(data.map((row) => [row.id, row.last_synced_at]));
  } catch {
    return null;
  }
}
