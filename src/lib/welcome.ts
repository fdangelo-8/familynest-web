import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * The only place where pages read the welcome of a member who has just joined
 * with an invitation (issue #30, decision of 29/10): it calls
 * `current_member_welcome()` and tells apart, in the type, «no welcome» from a
 * welcome with or without the name of who invited. It returns nothing else.
 */
export type MemberWelcome =
  /** No welcome to show (no row: not invited, or more than 24 hours ago) */
  | { status: "none" }
  /** Welcome, with the name of who invited */
  | { status: "named"; inviterName: string }
  /** Welcome, but the person who invited left the Nest */
  | { status: "unnamed" }
  /** The function could not be read */
  | { status: "error" };

/** Reads the welcome of the signed-in member. Never throws. */
export async function readMemberWelcome(
  client: SupabaseClient<Database>,
): Promise<MemberWelcome> {
  let rows: unknown;
  try {
    const supabase = client;
    const { data, error } = await supabase.rpc("current_member_welcome");
    if (error || !Array.isArray(data)) return { status: "error" };
    rows = data;
  } catch {
    return { status: "error" };
  }

  const first = (rows as unknown[])[0];
  if (first === undefined) return { status: "none" };
  if (typeof first !== "object" || first === null) return { status: "error" };

  // The generated type says `string`, but the name is null when the inviter left.
  const name = (first as { inviter_name?: unknown }).inviter_name;
  if (typeof name === "string" && name.trim() !== "") {
    return { status: "named", inviterName: name };
  }
  if (name === null || name === undefined || name === "") {
    return { status: "unnamed" };
  }
  return { status: "error" };
}
