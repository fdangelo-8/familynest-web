"use server";

import { cookies } from "next/headers";
import { clearLinkResultOptions } from "@/lib/calendar-sync/link-cookie";
import { LINK_RESULT_COOKIE } from "@/lib/calendar-sync/oauth";
import { getRequestOrigin } from "@/lib/request-origin";

/**
 * The page has shown the result of a link (the short cookie of the way back
 * from the provider): the cookie is deleted so it is shown only once. It holds
 * the provider and one word, nothing else.
 */
export async function clearLinkResult(): Promise<void> {
  const origin = await getRequestOrigin();
  const store = await cookies();
  store.set(LINK_RESULT_COOKIE, "", clearLinkResultOptions(origin));
}
