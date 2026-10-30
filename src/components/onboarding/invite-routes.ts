/**
 * Where the invite step sits in the onboarding: the one place to change when
 * the pages around it change. No "use client": server and client code import
 * it.
 */
export const PEOPLE_PATH = "/onboarding/persone";
export const INVITE_PATH = "/onboarding/invito";
export const READY_PATH = "/onboarding/pronto";

/** Address of the invitation of the adult at `position` (1 = first). */
export function invitePath(position: number): string {
  return position <= 1 ? INVITE_PATH : `${INVITE_PATH}?persona=${position}`;
}
