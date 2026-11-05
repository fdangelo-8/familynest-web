import { NextResponse } from "next/server";
import {
  LINK_DESTINATIONS,
  LINK_RESULT_COOKIE,
  LINK_RESULT_MAX_AGE,
  OAUTH_COOKIE,
  OAUTH_COOKIE_MAX_AGE,
  linkResultValue,
  type LinkDestination,
  type LinkResult,
} from "./oauth";

/*
 * Answers of the two routes of the link (`collega` and `ritorno`): always a
 * 303, never cached, never a referrer, and the cookies with the same rules
 * (HttpOnly, SameSite=Lax because the way back from the provider is a
 * navigation from another site, `Max-Age` and `expires` together).
 */

const OAUTH_COOKIE_PATH = "/calendari-collegati";

function baseOptions(origin: string) {
  return {
    httpOnly: true,
    secure: origin.startsWith("https:"),
    sameSite: "lax" as const,
  };
}

function hardened(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

/** To the provider (an absolute address), with the cookie of `state` and PKCE. */
export function redirectToProvider(
  origin: string,
  providerUrl: string,
  cookieValue: string,
): NextResponse {
  const response = hardened(NextResponse.redirect(providerUrl, 303));
  response.cookies.set(OAUTH_COOKIE, cookieValue, {
    ...baseOptions(origin),
    path: OAUTH_COOKIE_PATH,
    maxAge: OAUTH_COOKIE_MAX_AGE,
    expires: new Date(Date.now() + OAUTH_COOKIE_MAX_AGE * 1000),
  });
  return response;
}

/**
 * Back to the page the user started from, at the clean address of the
 * destination (no parameter), with the result in its own short cookie and the
 * cookie of `state` deleted.
 */
export function redirectToDestination(
  origin: string,
  destination: LinkDestination,
  provider: string,
  result: LinkResult,
): NextResponse {
  const response = hardened(
    NextResponse.redirect(new URL(LINK_DESTINATIONS[destination], origin), 303),
  );
  response.cookies.set(LINK_RESULT_COOKIE, linkResultValue(provider, result), {
    ...baseOptions(origin),
    path: "/",
    maxAge: LINK_RESULT_MAX_AGE,
    expires: new Date(Date.now() + LINK_RESULT_MAX_AGE * 1000),
  });
  response.cookies.set(OAUTH_COOKIE, "", {
    ...baseOptions(origin),
    path: OAUTH_COOKIE_PATH,
    maxAge: 0,
    expires: new Date(0),
  });
  return response;
}

/** Deletion of the result cookie (for the page that has read it). */
export function clearLinkResultOptions(origin: string) {
  return {
    ...baseOptions(origin),
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  };
}
