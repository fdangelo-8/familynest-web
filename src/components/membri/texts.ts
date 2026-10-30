import { formatDaysUntil, formatTime, formatTimeUntil } from "@/lib/datetime";

/** Fallback when the expiry cannot be told in words (never for a valid invitation). */
const DEFAULT_EXPIRY = "Il link vale 7 giorni";

/**
 * «oggi alle 21:10», «ieri alle 21:10», «3 giorni fa»: when the invitation was
 * created, counted in calendar days in Rome. Built only with the functions of
 * `src/lib/datetime.ts`.
 */
export function inviteSentText(createdAt: string, now: Date = new Date()) {
  const days = formatDaysUntil(createdAt, now);
  return days === "oggi" || days === "ieri"
    ? `${days} alle ${formatTime(createdAt)}`
    : days;
}

/** «Il link scade tra 6 giorni», «Il link scade domani», «Il link scade tra 2 h 5 min». */
export function inviteExpiryText(expiresAt: string, now: Date = new Date()) {
  const left = formatTimeUntil(expiresAt, now);
  return left ? `Il link scade ${left}` : DEFAULT_EXPIRY;
}

/** Line under the name of an adult without account, seen by an administrator. */
export function inviteSubtitle(sentText: string) {
  return `Adulto · invito inviato ${sentText}`;
}

/** Key in sessionStorage: the member page puts the focus on the invitation row once. */
export const FOCUS_INVITE_KEY = "familynest:focus-invite";
