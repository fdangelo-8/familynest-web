/*
 * Pure helpers for the address of the app. The server reads the request in
 * `request-origin.ts` (the only file that does); the client builds the links
 * to share here, one function per kind of link.
 */

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);
const HOST_PATTERN = /^[a-z0-9.-]+(:\d{1,5})?$/i;

/** `https://<host>`, or `http://<host>` only for `localhost` and `127.0.0.1`. A malformed host falls back to `http://localhost`. */
export function originForHost(rawHost: string | null | undefined): string {
  const host = (rawHost ?? "").split(",")[0]?.trim() ?? "";
  if (!HOST_PATTERN.test(host)) return "http://localhost";
  const name = host.replace(/:\d+$/, "").toLowerCase();
  return `${LOCAL_HOSTS.has(name) ? "http" : "https"}://${host}`;
}

function trimOrigin(origin: string): string {
  return origin.replace(/\/+$/, "");
}

/** The link to share a wish list: `<origin>/desideri/<code>`. */
export function buildWishlistLink(origin: string, code: string): string {
  return `${trimOrigin(origin)}/desideri/${code}`;
}

/** The address a mail link goes back to: `<origin>/auth/callback?tipo=…`. */
export function buildAuthCallbackLink(
  origin: string,
  kind: "conferma" | "password",
): string {
  return `${trimOrigin(origin)}/auth/callback?tipo=${kind}`;
}
