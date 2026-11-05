import "server-only";
import { createHash, createHmac, hkdfSync, randomBytes } from "node:crypto";
import { getCalendarEncryptionKey } from "@/lib/env";
import { secretsMatch } from "./crypto";

/*
 * The way to a provider and back (#34 §9, §10). No "use client": server only.
 *
 * Out: the server draws a random `state` (32 bytes, 256 bits) and a PKCE
 * verifier, keeps them in an HttpOnly cookie that lasts 10 minutes and is bound
 * to the session (the signature includes the id of the user), and sends the
 * user to the provider in the same window.
 *
 * Back: the server reads the cookie, compares `state` in constant time, uses
 * the code at once and answers with a 303 to a clean address: no `code`, no
 * `state`, no parameter at all. The destination is one of two fixed values,
 * never an address from outside.
 *
 * How the page learns the result without a parameter: a second cookie
 * (`LINK_RESULT_COOKIE`), HttpOnly, 2 minutes, with only the provider and one
 * word of `LINK_RESULTS`. No mail, no id, no name.
 */

export const OAUTH_COOKIE = "fn-calendar-oauth";
export const OAUTH_COOKIE_MAX_AGE = 600;
export const LINK_RESULT_COOKIE = "fn-calendar-link";
export const LINK_RESULT_MAX_AGE = 120;

/** The two places a link can start from, and where it comes back to. */
export const LINK_DESTINATIONS = {
  page: "/calendari-collegati",
  onboarding: "/onboarding/calendario",
} as const;

export type LinkDestination = keyof typeof LINK_DESTINATIONS;

export function isLinkDestination(value: unknown): value is LinkDestination {
  return value === "page" || value === "onboarding";
}

/**
 * What happened when the user came back:
 * - linked: the account is saved, the first synchronisation has started;
 * - denied: the user refused or cancelled on the provider page (a notice, not
 *   an error);
 * - no_calendar_permission: the calendar permission was left off, nothing saved;
 * - limit: the adult has 5 accounts already, nothing saved;
 * - failed: anything else (the provider, the network, the database).
 */
export const LINK_RESULTS = [
  "linked",
  "denied",
  "no_calendar_permission",
  "limit",
  "failed",
] as const;

export type LinkResult = (typeof LINK_RESULTS)[number];

export function isLinkResult(value: unknown): value is LinkResult {
  return LINK_RESULTS.includes(value as LinkResult);
}

// The cookie value is `v1.<expires>.<state>.<verifier>.<provider>.<destination>.<mac>`;
// none of the parts contains a dot.
const COOKIE_VERSION = "v1";

// A key has one use only: the cookie is signed with a subkey derived (HKDF)
// from the encryption key, never with the bytes that serve AES-256-GCM.
function signingKey(): Buffer {
  const { key } = getCalendarEncryptionKey();
  return Buffer.from(
    hkdfSync("sha256", key, "", "familynest:calendar-oauth-cookie", 32),
  );
}

function sign(parts: string[], userId: string): string {
  return createHmac("sha256", signingKey())
    .update(["calendar-oauth", userId, ...parts].join("|"))
    .digest("base64url");
}

export type OAuthStart = {
  state: string;
  codeChallenge: string;
  /** Value of the cookie `OAUTH_COOKIE`. */
  cookieValue: string;
};

/** Draws `state` and the PKCE pair and builds the signed cookie value. */
export function startOAuth(params: {
  userId: string;
  provider: string;
  destination: LinkDestination;
  now?: number;
}): OAuthStart {
  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const expires = Math.floor(
    ((params.now ?? Date.now()) + OAUTH_COOKIE_MAX_AGE * 1000) / 1000,
  );
  const parts = [
    COOKIE_VERSION,
    String(expires),
    state,
    verifier,
    params.provider,
    params.destination,
  ];
  return {
    state,
    codeChallenge: createHash("sha256").update(verifier).digest("base64url"),
    cookieValue: [...parts, sign(parts, params.userId)].join("."),
  };
}

export type OAuthCheck =
  | {
      ok: true;
      codeVerifier: string;
      destination: LinkDestination;
    }
  | { ok: false; destination: LinkDestination };

/**
 * Checks the cookie against the state that came back and the user of the
 * session. On any doubt the answer is «no», with the page as destination.
 */
export function checkOAuth(params: {
  cookieValue: string | undefined;
  stateFromProvider: string | null;
  userId: string;
  provider: string;
  now?: number;
}): OAuthCheck {
  const refused: OAuthCheck = { ok: false, destination: "page" };
  if (!params.cookieValue || !params.stateFromProvider) return refused;
  const pieces = params.cookieValue.split(".");
  if (pieces.length !== 7 || pieces[0] !== COOKIE_VERSION) return refused;
  const [version = "", expires = "", state = "", verifier = ""] = pieces;
  const [provider = "", destination = "", mac = ""] = pieces.slice(4);
  if (!isLinkDestination(destination)) return refused;
  const answer: OAuthCheck = { ok: false, destination };
  const parts = [version, expires, state, verifier, provider, destination];
  let expected: string;
  try {
    expected = sign(parts, params.userId);
  } catch {
    return answer;
  }
  if (!secretsMatch(mac, expected)) return answer;
  if (provider !== params.provider) return answer;
  if (Number(expires) * 1000 < (params.now ?? Date.now())) return answer;
  if (!secretsMatch(params.stateFromProvider, state)) return answer;
  return { ok: true, codeVerifier: verifier, destination };
}

/** Value of the cookie `LINK_RESULT_COOKIE`. */
export function linkResultValue(provider: string, result: LinkResult): string {
  return `${provider}.${result}`;
}

/** Reads the cookie `LINK_RESULT_COOKIE`; null when absent or not ours. */
export function parseLinkResult(
  value: string | undefined,
): { provider: "google" | "outlook"; result: LinkResult } | null {
  if (!value) return null;
  const [provider, result, ...rest] = value.split(".");
  if (rest.length > 0) return null;
  if (provider !== "google" && provider !== "outlook") return null;
  return isLinkResult(result) ? { provider, result } : null;
}
