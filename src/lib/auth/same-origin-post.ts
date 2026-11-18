import type { NextRequest } from "next/server";

/**
 * Same-origin check of the POST that uses a mail link (#419, #461), stricter
 * than the one of /auth/signout: `Origin` must be there and equal to the
 * address of the app; `Sec-Fetch-Site`, when the browser sends it, must say
 * `same-origin`.
 */
export function isSameOriginPost(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin || origin === "null" || origin !== request.nextUrl.origin) {
    return false;
  }
  const site = request.headers.get("sec-fetch-site");
  return site === null || site === "same-origin";
}
