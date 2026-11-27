import { NextResponse, type NextRequest } from "next/server";
import { isSameOriginPost } from "@/lib/auth/same-origin-post";
import { clearLinkResultOptions } from "@/lib/calendar-sync/link-cookie";
import { LINK_RESULT_COOKIE } from "@/lib/calendar-sync/oauth";

/**
 * Deletes the short cookie that tells the calendar step how the link ended
 * (#34 §10), once the step has read it. It is a route and not a server
 * action on purpose: a cookie changed by a server action makes Next render
 * the current page again, and with the metadata in streaming the `<title>`
 * left the head for a moment (#590). A route changes the cookie and nothing
 * else. The cookie holds only a provider and one word; nothing else.
 * A POST from another origin is refused with 403.
 */
export function POST(request: NextRequest) {
  if (!isSameOriginPost(request)) {
    const refused = new NextResponse(null, { status: 403 });
    refused.headers.set("Cache-Control", "no-store");
    return refused;
  }
  const response = new NextResponse(null, { status: 204 });
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set(
    LINK_RESULT_COOKIE,
    "",
    clearLinkResultOptions(request.nextUrl.origin),
  );
  return response;
}
