const MAX_LENGTH = 200;
const BASE = "http://app.invalid";

/**
 * Validates the `next` parameter of the sign-in return routes. Returns a safe
 * internal path, otherwise null (the caller falls back to the default
 * destination). The value is normalised with `new URL`, so `.`/`..` segments
 * and `%2e%2e` cannot hide an external host or a forbidden path; the rules are
 * then applied to the normalised path.
 */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw || raw.length > MAX_LENGTH) return null;
  if (raw[0] !== "/") return null;
  if (raw[1] === "/" || raw[1] === "\\") return null;
  if (raw.includes("\\")) return null;
  if (/[\u0000-\u001f\u007f]/.test(raw)) return null;

  let url: URL;
  try {
    url = new URL(raw, BASE);
  } catch {
    return null;
  }
  if (url.origin !== BASE) return null;
  const path = url.pathname;
  if (path[0] !== "/" || path[1] === "/") return null;
  if (path.includes("\\")) return null;
  if (path === "/auth" || path.startsWith("/auth/")) return null;
  if (path.startsWith("/accesso")) return null;
  // The normalised form is what gets used.
  return path + url.search;
}
