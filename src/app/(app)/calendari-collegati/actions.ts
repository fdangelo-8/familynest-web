"use server";

import { cookies, headers } from "next/headers";
import { clearLinkResultOptions } from "@/lib/calendar-sync/link-response";
import { LINK_RESULT_COOKIE } from "@/lib/calendar-sync/oauth";

/**
 * The page has shown the result of a link (the short cookie of the way back
 * from the provider): the cookie is deleted so it is shown only once. It holds
 * the provider and one word, nothing else.
 */
export async function clearLinkResult(): Promise<void> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https");
  const store = await cookies();
  store.set(
    LINK_RESULT_COOKIE,
    "",
    clearLinkResultOptions(`${protocol}://${host}`),
  );
}
