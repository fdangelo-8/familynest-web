import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function loadUser(): Promise<{ userId: string | null; failed: boolean }> {
  // Request-time data: never prerendered.
  await connection();
  const supabase = await createClient();
  // Verifies the token with the auth server, not only the cookie.
  const { data, error } = await supabase.auth.getUser();
  // A network failure towards the auth server is a technical error, not a missing session.
  if (error?.name === "AuthRetryableFetchError")
    return { userId: null, failed: true };
  if (error || !data.user) redirect("/accesso");
  return { userId: data.user.id, failed: false };
}

/**
 * Session check only (no Nest needed), for /onboarding. No valid session ->
 * /accesso. Like `requireNest()`, it must be awaited by the page itself:
 * a layout is not a guard.
 */
export const requireUser = cache(loadUser);
