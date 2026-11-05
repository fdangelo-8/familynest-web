import type { LinkResult } from "@/lib/calendar-sync/oauth";

/*
 * What the page «Calendari collegati» (#34, #35) shows, already shaped by the
 * server: texts that depend on the clock («dalle 13:10», «oggi alle 15:48»)
 * are written there, so the browser never has to guess the time zone.
 *
 * Nothing here is a credential, a token or an id of the provider: only the
 * ids of FamilyNest's own rows (the adult's own accounts and calendars), the
 * mail of the account and the names of the calendars, which only that adult
 * can read.
 */

export type ProviderKey = "google" | "outlook";
export type Direction = "two_way" | "incoming";
export type Visibility = "private" | "busy" | "household";
export type AccountStatus = "active" | "reconnect" | "temporary_error";

export type CalendarItem = {
  id: string;
  name: string;
  /** Capital letter of the logo */
  initial: string;
  isPrimary: boolean;
  isReadOnly: boolean;
  isEnabled: boolean;
  direction: Direction;
  visibility: Visibility;
  countsForFreeTime: boolean;
  weekdaysOnly: boolean;
  isTarget: boolean;
  /** «dalle 13:10»: since when this calendar cannot be read, or null */
  failingSince: string | null;
  /** «oggi alle 15:48», or null when it was never synchronised */
  lastSynced: string | null;
};

export type AccountItem = {
  id: string;
  provider: ProviderKey;
  email: string;
  status: AccountStatus;
  /** «dalle 13:10» of the first failed attempt (only with `reconnect`) */
  failingSince: string | null;
  /** The provider has been silent for more than 24 hours */
  silentForDay: boolean;
  /** «alle 13:10»: when the events on screen were last updated */
  updatedAt: string | null;
  calendars: CalendarItem[];
};

export const PROVIDER_NAME: Record<ProviderKey, string> = {
  google: "Google",
  outlook: "Outlook",
};

export const LOGO_CLASS: Record<ProviderKey, string> = {
  google: "logo-marchio--google",
  outlook: "logo-marchio--outlook",
};

const COLLATOR = new Intl.Collator("it", { sensitivity: "base" });

/** The capital letter for the logo; the provider's own initial if none. */
export function calendarInitial(name: string, provider: ProviderKey): string {
  const first = Array.from(name.trim())[0];
  if (first && /\p{L}/u.test(first)) return first.toLocaleUpperCase("it");
  return PROVIDER_NAME[provider].slice(0, 1);
}

/**
 * Order of the rows of an account (#34 §3): the main calendar, then the ones
 * switched on, then the ones switched off; inside each group alphabetical.
 */
export function sortCalendars<T extends CalendarItem>(items: T[]): T[] {
  const group = (c: CalendarItem) => (c.isPrimary ? 0 : c.isEnabled ? 1 : 2);
  return [...items].sort(
    (a, b) =>
      group(a) - group(b) ||
      COLLATOR.compare(a.name, b.name) ||
      a.id.localeCompare(b.id),
  );
}

export const VISIBILITY_LABEL: Record<Visibility, string> = {
  private: "Solo io",
  busy: "Occupato",
  household: "Tutto il Nest",
};

export const DIRECTION_LABEL: Record<Direction, string> = {
  two_way: "Entrata e uscita",
  incoming: "Solo in entrata",
};

/** The line under the name of a calendar. */
export function calendarSummary(calendar: CalendarItem): string {
  if (!calendar.isEnabled) return "Non sincronizzato";
  return `${DIRECTION_LABEL[calendar.direction]} · ${VISIBILITY_LABEL[calendar.visibility]}`;
}

/** A calendar that can receive the events sent with «Anche su». */
export function canBeTarget(calendar: CalendarItem): boolean {
  return (
    calendar.isEnabled &&
    calendar.direction === "two_way" &&
    !calendar.isReadOnly
  );
}

/** «Mario», «Mario e Anna», «Mario, Anna e Luca». */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}

/** «Con «Occupato» Laura vede «Marco è occupato» e l'orario…» (mockup 26). */
export function visibilityHelp(
  visibility: Visibility,
  myName: string,
  others: readonly string[],
): string {
  const change = "Puoi cambiarlo per un singolo impegno.";
  if (visibility === "private") {
    return `Gli altri non vedono niente di questi impegni. ${change}`;
  }
  if (visibility === "household") {
    return `Tutto il Nest vede titolo, orario e luogo. ${change}`;
  }
  const phrase = `«${myName} è occupato» e l'orario, senza titolo né luogo.`;
  if (others.length === 0) return `Gli altri vedono ${phrase} ${change}`;
  const verb = others.length === 1 ? "vede" : "vedono";
  return `Con «Occupato» ${joinNames(others)} ${verb} ${phrase} ${change}`;
}

/** «1 calendario», «3 calendari». */
export function calendarCount(count: number): string {
  return count === 1 ? "1 calendario" : `${count} calendari`;
}

/** The notice while a synchronisation started from the page is running. */
export function syncProgressText(done: number, total: number): string {
  return `Sincronizzazione in corso: ${calendarCount(done)} su ${total}.`;
}

/** What `parseLinkResult` gives, plus the provider's name. */
export type LinkNotice = { provider: ProviderKey; result: LinkResult };

/** Shown to nobody: the shape of the sheets the page opens. */
export type SheetState =
  | { kind: "calendar"; accountId: string; calendarId: string }
  | { kind: "connect" }
  | { kind: "target" }
  | null;
