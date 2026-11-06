import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  RECOVERY_COOKIE_NAME,
  RECOVERY_EXPIRED_PATH,
  clearRecoveryCookieOptions,
  isRecoveryCookieValue,
} from "./recovery-cookie";

/**
 * Guard of /accesso/nuova-password: the page is for someone who has just
 * opened a recovery link, so it needs a session AND the recovery cookie.
 * Without both it goes to the expired-link page. Must be awaited by the page
 * itself (a layout is not a guard). Unlike the other sign-in pages it does
 * not send a signed-in person away.
 */
export async function requireRecoverySession(): Promise<void> {
  await connection();
  let allowed = false;
  try {
    const store = await cookies();
    if (isRecoveryCookieValue(store.get(RECOVERY_COOKIE_NAME)?.value)) {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.getUser();
      allowed = !error && !!data.user;
    }
  } catch {
    allowed = false;
  }
  // redirect() throws: it must stay outside the try block.
  if (!allowed) redirect(RECOVERY_EXPIRED_PATH);
}

/** Deletes the recovery cookie (server action or route handler). */
export async function clearRecoveryCookie(origin: string): Promise<void> {
  const store = await cookies();
  store.set(RECOVERY_COOKIE_NAME, "", clearRecoveryCookieOptions(origin));
}
