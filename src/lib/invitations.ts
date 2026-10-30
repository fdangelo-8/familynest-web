/**
 * Everything about the invitation link that more than one page needs (#14,
 * #16, #18). No "use client" and no "server-only": the pure functions are
 * used on both sides. The token is a credential: it travels only in the first
 * address of the link and then in an HttpOnly cookie, never in `next`, logs or
 * data sent to the browser.
 */

/** Name of the cookie that carries the token between the link and «Continua». */
export const INVITE_COOKIE_NAME = "familynest_invito";

/** How long the cookie lives at most (it expires earlier with the invitation). */
export const INVITE_COOKIE_MAX_AGE_SECONDS = 24 * 60 * 60;

/** Where the invited person goes after «Continua» (will become `/onboarding/calendario` with #37). */
export const AFTER_INVITE_PATH = "/oggi";

/** Welcome page and colour page of the invited person. */
export const INVITE_WELCOME_PATH = "/invito";
export const INVITE_COLOR_PATH = "/invito/colore";

const TOKEN_FORMAT = /^[0-9a-f]{32,128}$/;

/** A token is 32-128 lowercase hexadecimal characters. Anything else is never sent to the database. */
export function isValidInviteToken(value: unknown): value is string {
  return typeof value === "string" && TOKEN_FORMAT.test(value);
}

/** The part of a cookie store (`cookies()` or `request.cookies`) this file reads. */
export type CookieReader = {
  get(name: string): { value: string } | undefined;
};

/** Token in the invitation cookie, or `null` if missing or malformed. */
export function readInviteToken(cookies: CookieReader): string | null {
  const value = cookies.get(INVITE_COOKIE_NAME)?.value;
  return isValidInviteToken(value) ? value : null;
}

export type InviteCookieOptions = {
  httpOnly: true;
  sameSite: "lax";
  path: "/";
  secure: boolean;
  expires: Date;
};

/**
 * Options to set the cookie: HttpOnly, SameSite=Lax, Path=/, Secure on https.
 * It lasts 24 hours, or less if the invitation expires sooner.
 */
export function inviteCookieOptions(
  origin: string,
  invitationExpiresAt?: Date | string | null,
  now: Date = new Date(),
): InviteCookieOptions {
  let expires = new Date(now.getTime() + INVITE_COOKIE_MAX_AGE_SECONDS * 1000);
  if (invitationExpiresAt) {
    const invitation = new Date(invitationExpiresAt);
    if (!Number.isNaN(invitation.getTime()) && invitation < expires) {
      expires = invitation;
    }
  }
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: origin.startsWith("https:"),
    expires,
  };
}

/** Options to delete the cookie: a past expiry and the same path (a `maxAge` of 0 leaves an empty cookie, LEZIONI). */
export function clearInviteCookieOptions(origin: string): InviteCookieOptions {
  return { ...inviteCookieOptions(origin), expires: new Date(0) };
}

/** The link to share: `<origin>/invito/<token>`. */
export function buildInviteLink(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, "")}${INVITE_WELCOME_PATH}/${token}`;
}
