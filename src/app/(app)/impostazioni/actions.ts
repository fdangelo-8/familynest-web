"use server";

import { createClient } from "@/lib/supabase/server";

export type Failure = "network" | "server";
export type ActionResult = { ok: true } | { ok: false; reason: Failure };

const PREFERENCES = [
  "events",
  "assigned_todos",
  "shopping",
  "free_together",
  "morning_digest",
] as const;
export type PreferenceKey = (typeof PREFERENCES)[number];

/** supabase-js reports an unreachable server as an error without a code. */
function failureOf(error: { code?: string | null }): Failure {
  return error.code ? "server" : "network";
}

/*
 * Both actions are about the caller only. Nothing that identifies a Nest or
 * a member comes from the browser: the database takes both from the session
 * (RLS), and the administrative client is never used.
 */

/** Saves one notification choice of the caller. */
export async function setNotificationPreference(
  preference: PreferenceKey,
  enabled: boolean,
): Promise<ActionResult> {
  if (
    !(PREFERENCES as ReadonlyArray<unknown>).includes(preference) ||
    typeof enabled !== "boolean"
  ) {
    return { ok: false, reason: "server" };
  }
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("set_notification_preference", {
      p_preference: preference,
      p_enabled: enabled,
    });
    if (error) return { ok: false, reason: failureOf(error) };
    return { ok: true };
  } catch {
    return { ok: false, reason: "network" };
  }
}

/**
 * The caller leaves the Nest: deletes their own member row. The database does
 * the rest (promotes an administrator, or deletes the Nest with the last adult
 * who has an account). Already gone counts as done.
 */
export async function leaveHousehold(): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { data, error: userError } = await supabase.auth.getUser();
    if (userError) {
      return {
        ok: false,
        reason:
          userError.name === "AuthRetryableFetchError" ? "network" : "server",
      };
    }
    if (!data.user) return { ok: false, reason: "server" };

    const removed = await supabase
      .from("household_members")
      .delete()
      .eq("user_id", data.user.id);
    if (removed.error) return { ok: false, reason: failureOf(removed.error) };

    // A refused delete touches no row and gives no error: the row is read
    // again (separate query). Gone, or not visible any more, is done.
    const reread = await supabase
      .from("household_members")
      .select("id")
      .eq("user_id", data.user.id)
      .maybeSingle();
    if (reread.error) return { ok: false, reason: failureOf(reread.error) };
    return reread.data ? { ok: false, reason: "server" } : { ok: true };
  } catch {
    return { ok: false, reason: "network" };
  }
}
