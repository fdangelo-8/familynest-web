import "server-only";
import { cookies } from "next/headers";
import { getRequestOrigin } from "@/lib/request-origin";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  clearInviteCookieOptions,
  INVITE_COOKIE_NAME,
} from "@/lib/invitations";
import type { Database } from "@/types/database";

export type InviteSession =
  | { kind: "error" }
  | { kind: "anonymous" }
  | { kind: "user"; householdId: string | null };

/**
 * Who is asking. A missing session is `anonymous`; an unreachable Auth server
 * or database is `error` (never read as «no session»). Nothing of the person
 * is returned: only whether they already have a Nest.
 */
export async function readInviteSession(
  supabase: SupabaseClient<Database>,
): Promise<InviteSession> {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error?.name === "AuthRetryableFetchError") return { kind: "error" };
    if (error || !data.user) return { kind: "anonymous" };
    const household = await supabase.rpc("current_household_id");
    if (household.error) return { kind: "error" };
    return { kind: "user", householdId: household.data || null };
  } catch {
    return { kind: "error" };
  }
}

/** Deletes the invitation cookie from a server action (past expiry, same path). */
export async function clearInviteCookie(): Promise<void> {
  const store = await cookies();
  store.set(
    INVITE_COOKIE_NAME,
    "",
    clearInviteCookieOptions(await getRequestOrigin()),
  );
}
