// Cookie that marks a session born from a password-recovery link (#327).
// Pure helpers (no server-only import) so route handlers, pages and tests
// share the name and the options.
export const RECOVERY_COOKIE_NAME = "familynest_recupero";
export const RECOVERY_COOKIE_MAX_AGE_SECONDS = 900;
export const RECOVERY_PATH = "/accesso/nuova-password";
export const RECOVERY_EXPIRED_PATH = "/accesso/link-scaduto?tipo=password";

export type RecoveryCookieOptions = {
  httpOnly: true;
  sameSite: "lax";
  path: "/";
  secure: boolean;
  maxAge: number;
};

/** A fresh random value for the recovery cookie. */
export function newRecoveryCookieValue(): string {
  return crypto.randomUUID();
}

/** HttpOnly, SameSite=Lax, Path=/, Secure on https, 900 seconds. */
export function recoveryCookieOptions(origin: string): RecoveryCookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: origin.startsWith("https:"),
    maxAge: RECOVERY_COOKIE_MAX_AGE_SECONDS,
  };
}

export type ClearRecoveryCookieOptions = {
  httpOnly: true;
  sameSite: "lax";
  path: "/";
  secure: boolean;
  expires: Date;
};

/** Deletion: a past `expires` and no `maxAge` (a `maxAge` of 0 leaves an empty cookie, LEZIONI). */
export function clearRecoveryCookieOptions(
  origin: string,
): ClearRecoveryCookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: origin.startsWith("https:"),
    expires: new Date(0),
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True for a value made by `newRecoveryCookieValue()`. */
export function isRecoveryCookieValue(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}
