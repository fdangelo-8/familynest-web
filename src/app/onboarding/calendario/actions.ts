"use server";

import { cookies, headers } from "next/headers";
import { clearLinkResultOptions } from "@/lib/calendar-sync/link-response";
import { LINK_RESULT_COOKIE } from "@/lib/calendar-sync/oauth";

/**
 * Deletes the short cookie that tells the calendar step how the link ended
 * (#34 §10), once the step has read it: a reload does not show the notice
 * again. The cookie holds only a provider and one word; nothing else.
 */
export async function clearLinkResult(): Promise<void> {
  try {
    const list = await headers();
    const proto = list.get("x-forwarded-proto") ?? "http";
    const origin =
      list.get("origin") ?? `${proto}://${list.get("host") ?? "localhost"}`;
    (await cookies()).set(
      LINK_RESULT_COOKIE,
      "",
      clearLinkResultOptions(origin),
    );
  } catch {
    // The cookie expires by itself in two minutes.
  }
}
