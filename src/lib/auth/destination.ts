import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { safeNextPath } from "./safe-next";

/**
 * Where a signed-in person goes: a safe `next` if the route asked for one,
 * otherwise /oggi when they have a Nest and /onboarding when they do not.
 * On a technical error it goes to /oggi, whose layout checks everything again.
 */
export async function resolveDestination(
  supabase: SupabaseClient<Database>,
  next?: string | null,
): Promise<string> {
  const safeNext = safeNextPath(next);
  if (safeNext) return safeNext;
  const { data: householdId, error } = await supabase.rpc(
    "current_household_id",
  );
  if (error) return "/oggi";
  return householdId ? "/oggi" : "/onboarding";
}

/**
 * For the sign-in pages: someone with a valid session goes straight to their
 * destination. A technical error while reading the session shows the page as
 * for a visitor without a session.
 */
export async function redirectIfSignedIn(): Promise<void> {
  await connection();
  let destination: string | null = null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (!error && data.user) destination = await resolveDestination(supabase);
  } catch {
    destination = null;
  }
  // redirect() throws: it must stay outside the try block.
  if (destination) redirect(destination);
}
