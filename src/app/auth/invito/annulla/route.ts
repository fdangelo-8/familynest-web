import { NextResponse, type NextRequest } from "next/server";
import {
  INVITE_COOKIE_NAME,
  clearInviteCookieOptions,
} from "@/lib/invitations";

// Deletes the invitation cookie, so the invitation pages never loop through
// redirects when the token is no longer usable. POST only; the cookie is
// deleted with a past expiry, not `maxAge: 0`.
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return new NextResponse(null, { status: 403 });
  }
  const response = NextResponse.redirect(
    new URL("/oggi", request.nextUrl.origin),
    303,
  );
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set(
    INVITE_COOKIE_NAME,
    "",
    clearInviteCookieOptions(request.nextUrl.origin),
  );
  return response;
}
