import { NextResponse, type NextRequest } from "next/server";
import {
  INVITE_COOKIE_NAME,
  INVITE_WELCOME_PATH,
  clearInviteCookieOptions,
} from "@/lib/invitations";

// Deletes the invitation cookie and goes on. The invitation pages cannot
// delete a cookie while they render, so they send people here when the
// invitation is no longer usable: no redirect loop, no stale cookie.
// `vai` is one of a closed list, never an address.
const DESTINATIONS: Record<string, string> = {
  errore: INVITE_WELCOME_PATH,
  oggi: "/oggi",
  "altro-nest": `${INVITE_WELCOME_PATH}?stato=altro-nest`,
};

export function GET(request: NextRequest) {
  const { origin, searchParams } = request.nextUrl;
  const key = searchParams.get("vai") ?? "";
  const target = Object.hasOwn(DESTINATIONS, key)
    ? DESTINATIONS[key]!
    : INVITE_WELCOME_PATH;
  const response = NextResponse.redirect(new URL(target, origin), 303);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.cookies.set(
    INVITE_COOKIE_NAME,
    "",
    clearInviteCookieOptions(origin),
  );
  return response;
}
