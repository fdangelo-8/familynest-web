import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Who goes through the whole onboarding (people, invitation, ready screen) and
 * who only links a calendar and moves on (steps 2 of 3).
 *
 * It must not depend on the role («organizza»): the rules of a Nest «in coppia»
 * make the person who joins an organizer too. The criterion is how the person
 * got into the Nest. The one who created it is inserted by `create_household`
 * with `joined_at` equal to `created_at` (same transaction). Whoever joined with
 * an invitation was added as a member first and got the account later, when the
 * invitation was accepted, so `joined_at` is later than `created_at`. Both
 * columns are readable by the member under the rules already in place, and only
 * the caller's own row is read.
 *
 * `error` is a failed read: the page shows the usual «Riprova».
 */
export type NestSetupRole = "creator" | "invited" | "error";

export async function nestSetupRole(
  supabase: SupabaseClient<Database>,
  userId: string,
  householdId: string,
): Promise<NestSetupRole> {
  const { data, error } = await supabase
    .from("household_members")
    .select("created_at, joined_at")
    .eq("household_id", householdId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return "error";
  if (!data?.joined_at) return "invited";
  return Date.parse(data.joined_at) > Date.parse(data.created_at)
    ? "invited"
    : "creator";
}
