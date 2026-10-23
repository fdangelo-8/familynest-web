const MAX_LENGTH = 200;

/**
 * Validates the `next` parameter of the sign-in return routes. Returns the
 * path when it is a safe internal path, otherwise null (the caller falls back
 * to the default destination). Blocks external redirects (`//host`, `/\host`,
 * full URLs), the sign-in pages themselves and anything with control characters.
 */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw || raw.length > MAX_LENGTH) return null;
  if (raw[0] !== "/") return null;
  if (raw[1] === "/" || raw[1] === "\\") return null;
  if (raw.includes("\\")) return null;
  if (/[\u0000-\u001f\u007f]/.test(raw)) return null;
  if (raw === "/auth" || raw.startsWith("/auth/")) return null;
  if (raw.startsWith("/accesso")) return null;
  return raw;
}
