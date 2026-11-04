import type { NextRequest, NextResponse } from "next/server";

/**
 * Deleting the session cookies of the browser, shared by `/auth/signout` and
 * the route that deletes the account (#38): one place, so both leave no cookie
 * behind (LEZIONI: a cookie is deleted with an `expires` in the past).
 */
const SESSION_COOKIE =
  /^sb-.+-auth-token(\.\d+)?$|^sb-.+-auth-token-code-verifier$/;

// `maxAge: 0` is dropped when the cookie is serialised, so a cookie is deleted
// with an `expires` in the past (same path as the session cookies).
export const DELETE_COOKIE_OPTIONS = {
  path: "/",
  maxAge: 0,
  expires: new Date(0),
} as const;

/** True for the name of a Supabase session cookie. */
export function isSessionCookie(name: string): boolean {
  return SESSION_COOKIE.test(name);
}

/** Puts on `response` the deletion of every session cookie of `request`. */
export function clearSessionCookies(
  request: NextRequest,
  response: NextResponse,
): void {
  for (const cookie of request.cookies.getAll()) {
    if (isSessionCookie(cookie.name)) {
      response.cookies.set(cookie.name, "", DELETE_COOKIE_OPTIONS);
    }
  }
}
