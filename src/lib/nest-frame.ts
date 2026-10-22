import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { NestMember } from "@/lib/nest-types";

export type NestFrameData = {
  /** null when the data could not be read (technical error) */
  nestName: string | null;
  members: NestMember[];
  failed: boolean;
};

const FAILED: NestFrameData = { nestName: null, members: [], failed: true };

/**
 * Checks the session on the server and reads what the app frame needs.
 * No valid session -> /accesso, no Nest -> /onboarding (redirects throw).
 */
export async function loadNestFrame(): Promise<NestFrameData> {
  const supabase = await createClient();

  // Verifies the token with the auth server, not only the cookie.
  const { data: userData, error: userError } = await supabase.auth.getUser();
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

  return {
    nestName: household.data.name,
    members: members.data.map((m) => ({
      name: m.name,
      color: m.color,
      isMe: m.user_id === userId,
    })),
    failed: false,
  };
}
