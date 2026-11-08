"use server";

import { headers } from "next/headers";
import { resolveDestination } from "@/lib/auth/destination";
import { clearRecoveryCookie } from "@/lib/auth/recovery";
import { createClient } from "@/lib/supabase/server";

/**
 * Last step of «Nuova password». The page has already changed the password
 * straight with Supabase (it never passes through our server): this deletes
 * the recovery cookie (HttpOnly, so only the server can) and says where the
 * person goes. It receives nothing and returns only a path.
 */
export async function finishRecovery(): Promise<{ destination: string }> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "";
  const proto = requestHeaders.get("x-forwarded-proto") ?? "http";
  await clearRecoveryCookie(`${proto}://${host}`);

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return { destination: "/accesso" };
    return { destination: await resolveDestination(supabase) };
  } catch {
    return { destination: "/oggi" };
  }
}
