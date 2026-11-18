import { resolveDestination } from "@/lib/auth/destination";
import { createClient } from "@/lib/supabase/server";

/**
 * Who is signed in in this browser, read on the server; `null` if nobody (or
 * on a technical error: the page then behaves as the one without a session).
 * Used by the pages of the mail links (#419, #461).
 */
export async function readCurrentAccount(): Promise<{
  email: string;
  destination: string;
} | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    const email = data.user?.email;
    if (error || !email) return null;
    return { email, destination: await resolveDestination(supabase) };
  } catch {
    return null;
  }
}
