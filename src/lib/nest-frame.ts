import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { NestMember, NestSelf } from "@/lib/nest-types";

export type NestFrameData = {
  /** null when the data could not be read (technical error) */
  nestName: string | null;
  /** First 4 members; the name is set only for the first 3 */
  members: NestMember[];
  me: NestSelf | null;
  failed: boolean;
};

const FAILED: NestFrameData = {
  nestName: null,
  members: [],
  me: null,
  failed: true,
};

/**
 * Checks the session on the server and reads what the app frame needs.
 * No valid session -> /accesso, no Nest -> /onboarding (redirects throw).
 */
async function loadNestFrame(): Promise<NestFrameData> {
  // Request-time data: never prerendered, even when env variables are missing.
  await connection();
  const supabase = await createClient();

  // Verifies the token with the auth server, not only the cookie.
  const { data: userData, error: userError } = await supabase.auth.getUser();
  // A network failure towards the auth server is a technical error, not a missing session.
  if (userError?.name === "AuthRetryableFetchError") return FAILED;
  if (userError || !userData.user) redirect("/accesso");
  const userId = userData.user.id;

  const { data: householdId, error: householdError } = await supabase.rpc(
    "current_household_id",
  );
  if (householdError) return FAILED;
  if (!householdId) redirect("/onboarding");

  const [household, members] = await Promise.all([
    supabase
      .from("households")
      .select("name")
      .eq("id", householdId)
      .maybeSingle(),
    supabase
      .from("household_members")
      .select("name, color, user_id")
      .eq("household_id", householdId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true }),
  ]);

  if (household.error || !household.data || members.error) return FAILED;

  const me = members.data.find((m) => m.user_id === userId);
  return {
    nestName: household.data.name,
    // Minimization: only what the frame displays is sent to the browser.
    members: members.data.slice(0, 4).map((m, index) => ({
      name: index < 3 ? m.name : null,
      color: m.color,
    })),
    me: me ? { name: me.name, color: me.color } : null,
    failed: false,
  };
}

/**
 * Session and Nest check, shared by the layout and the pages (deduplicated
 * per request with cache()).
 *
 * IMPORTANT: the layout is NOT a guard for the content of a page: Next runs
 * the page segment even when the layout redirects. Every page of the (app)
 * area must `await requireNest()` BEFORE reading any data. Reads always use
 * the signed-in user's session, so RLS applies.
 */
export const requireNest = cache(loadNestFrame);
