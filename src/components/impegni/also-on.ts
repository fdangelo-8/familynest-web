import type { SupabaseClient } from "@supabase/supabase-js";
import { providerName } from "@/lib/linked-calendars";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

/*
 * «Anche su …» (#34, §16): the calendar the adult chose in «Dove vanno i
 * nuovi impegni», and the call that sends an event there or takes it back.
 * Read with the adult's own session: the policies give back only their own
 * calendars, never those of another adult.
 */

export type AlsoOnTarget = {
  /** «Google», «Outlook» */
  providerLabel: string;
  calendarName: string;
  /** The account needs «Ricollega»: the switch cannot be used now */
  broken: boolean;
};

/**
 * The chosen calendar, `null` when there is none («Nessuno»), `"error"` when
 * the reading failed. Never throws.
 */
export async function readAlsoOnTarget(
  supabase: Client,
): Promise<AlsoOnTarget | null | "error"> {
  try {
    const calendar = await supabase
      .from("external_calendars")
      .select("name, account_id")
      .eq("is_new_events_target", true)
      .maybeSingle();
    if (calendar.error) return "error";
    if (!calendar.data) return null;
    const account = await supabase
      .from("calendar_accounts")
      .select("provider, status")
      .eq("id", calendar.data.account_id)
      .maybeSingle();
    if (account.error) return "error";
    const providerLabel = account.data
      ? providerName(account.data.provider)
      : null;
    if (!account.data || !providerLabel) return null;
    return {
      providerLabel,
      calendarName: calendar.data.name,
      broken: account.data.status === "reconnect",
    };
  } catch {
    return "error";
  }
}

/** Sends the event to the chosen calendar, or takes the copy back. Never throws. */
export async function setAlsoOn(
  supabase: Client,
  eventId: string,
  enabled: boolean,
): Promise<boolean> {
  try {
    const { error } = await supabase.rpc("set_event_also_on", {
      p_event_id: eventId,
      p_enabled: enabled,
    });
    return !error;
  } catch {
    return false;
  }
}

/**
 * Changes only «Chi lo vede» of an imported event: its other fields change
 * on the provider, and the database refuses them. Never throws.
 * `"private-at-source"` is an event private on its calendar, which is never
 * shown to the whole Nest.
 */
export async function saveImportedVisibility(
  supabase: Client,
  eventId: string,
  visibility: Database["public"]["Enums"]["event_visibility"],
): Promise<"ok" | "missing" | "private-at-source" | "failed"> {
  try {
    const { error } = await supabase
      .from("events")
      .update({ visibility })
      .eq("id", eventId);
    if (!error) return "ok";
    if (error.code === "42501" && visibility === "household") {
      return "private-at-source";
    }
    return error.code === "P0002" ? "missing" : "failed";
  } catch {
    return "failed";
  }
}
