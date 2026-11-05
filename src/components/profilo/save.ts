import { createClient } from "@/lib/supabase/client";
import type { ChoosableColor } from "@/components/ui/ColorChoice/ColorChoice";
import type {
  DefaultVisibility,
  DigestTime,
  Failure,
  StartLens,
} from "./model";

/*
 * Writes of «Il tuo profilo» (#38), made from the browser with the user's own
 * session: the database rules (RLS) decide, and the filter is always the
 * person's own row (an administrator could otherwise touch every member).
 * Status 0 means no answer arrived (network); any other error is the server's.
 */

export type SaveResult = { ok: true } | { ok: false; reason: Failure };
export type ColorSaveResult =
  { ok: true } | { ok: false; reason: Failure | "taken" };

/** Id of the signed-in user, read from the session cookie (no request). */
async function myUserId(
  supabase: ReturnType<typeof createClient>,
): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/** `status` 0: no answer arrived (network). Any other error is the server's. */
function failureOf(status: number): Failure {
  return status === 0 ? "network" : "server";
}

/** Colour of the person's own member row. `23505`: someone took it first. */
export async function saveColor(
  color: ChoosableColor,
): Promise<ColorSaveResult> {
  try {
    const supabase = createClient();
    const userId = await myUserId(supabase);
    if (!userId) return { ok: false, reason: "server" };
    const { error, status, count } = await supabase
      .from("household_members")
      .update({ color }, { count: "exact" })
      .eq("user_id", userId);
    if (!error) {
      // No row touched (for example refused by the rules): not saved.
      return count === 0 ? { ok: false, reason: "server" } : { ok: true };
    }
    if (error.code === "23505") return { ok: false, reason: "taken" };
    return { ok: false, reason: failureOf(status) };
  } catch {
    return { ok: false, reason: "network" };
  }
}

export type PreferencePatch =
  | { start_lens: StartLens }
  | { morning_digest_time: DigestTime }
  | { default_event_visibility: DefaultVisibility };

/** One of the three preferences, in the person's own profile. */
export async function savePreference(
  patch: PreferencePatch,
): Promise<SaveResult> {
  try {
    const supabase = createClient();
    const userId = await myUserId(supabase);
    if (!userId) return { ok: false, reason: "server" };
    const { error, status, count } = await supabase
      .from("profiles")
      .update(patch, { count: "exact" })
      .eq("id", userId);
    if (error) return { ok: false, reason: failureOf(status) };
    return count === 0 ? { ok: false, reason: "server" } : { ok: true };
  } catch {
    return { ok: false, reason: "network" };
  }
}

/** Starts the download of «I tuoi dati». The file is prepared by the server. */
export async function downloadMyData(): Promise<SaveResult> {
  try {
    const response = await fetch("/profilo/dati", {
      method: "POST",
      cache: "no-store",
    });
    if (!response.ok) return { ok: false, reason: "server" };
    const blob = await response.blob();
    const disposition = response.headers.get("content-disposition") ?? "";
    const name =
      /filename="([^"]+)"/.exec(disposition)?.[1] ??
      "familynest-i-tuoi-dati.json";
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return { ok: true };
  } catch {
    return { ok: false, reason: "network" };
  }
}
