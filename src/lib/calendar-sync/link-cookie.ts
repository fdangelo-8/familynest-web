/*
 * Options of the cookies of the calendar link, with no server-only imports so
 * they can be tested. Deleting uses the same `secure`, `path` and `sameSite`
 * as creating.
 */

export const LINK_RESULT_COOKIE_PATH = "/";

export function linkCookieBaseOptions(origin: string) {
  return {
    httpOnly: true,
    secure: origin.startsWith("https:"),
    sameSite: "lax" as const,
  };
}

/** Deletion of the result cookie (for the page that has read it). */
export function clearLinkResultOptions(origin: string) {
  return {
    ...linkCookieBaseOptions(origin),
    path: LINK_RESULT_COOKIE_PATH,
    maxAge: 0,
    expires: new Date(0),
  };
}
