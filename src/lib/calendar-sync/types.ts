/*
 * What the synchronisation service needs from a calendar provider (Google,
 * Outlook, or the fake provider of the tests). No "use client": server only.
 *
 * Only the fields of #34 §7 exist here. Descriptions, participants, organiser,
 * attachments, video call links, reminders and colours have no place in these
 * types: even when a provider sends them, `toSyncEvent` (sync.ts) drops them.
 */

export type ProviderId = "google" | "outlook";

export const PROVIDER_IDS: readonly ProviderId[] = ["google", "outlook"];

export function isProviderId(value: unknown): value is ProviderId {
  return value === "google" || value === "outlook";
}

/** The provider refused the credentials (revoked access, changed password). */
export class ProviderAuthError extends Error {
  constructor() {
    super("The provider refused the credentials.");
    this.name = "ProviderAuthError";
  }
}

/** The provider did not answer or asked to slow down: tried again later. */
export class ProviderTemporaryError extends Error {
  constructor() {
    super("The provider is not available now.");
    this.name = "ProviderTemporaryError";
  }
}

/** The provider is not configured on this server (no keys, no fake). */
export class ProviderUnavailableError extends Error {
  constructor() {
    super("The provider is not configured.");
    this.name = "ProviderUnavailableError";
  }
}

export type ProviderAccount = {
  /** Stable id of the account at the provider. */
  id: string;
  email: string;
};

export type ProviderCalendar = {
  id: string;
  name: string;
  isPrimary: boolean;
  isReadOnly: boolean;
};

/** One event, or one occurrence of a repeated event, as FamilyNest reads it. */
export type ProviderEvent = {
  /** Id of the event (of the series, for a repeated one). */
  id: string;
  /** Which occurrence ('' for a single event). */
  occurrenceKey?: string;
  /** etag or change key */
  version?: string;
  title?: string;
  location?: string;
  /** ISO instants, for events with a time */
  startsAt?: string;
  endsAt?: string;
  allDay?: boolean;
  /** Dates (YYYY-MM-DD, end excluded) for events «tutto il giorno» */
  startDate?: string;
  endDate?: string;
  status?: "confirmed" | "tentative" | "cancelled";
  declined?: boolean;
  isPrivate?: boolean;
  isFree?: boolean;
  deleted?: boolean;
};

export type EventsPage = {
  events: ProviderEvent[];
  /** The list is the whole window (what is not in it is deleted here). */
  full: boolean;
  /** Where to start next time (sync token, delta link). */
  cursor: string | null;
};

/** The repetition of an event sent with «Anche su»; null for a single event. */
export type OutgoingRecurrence = {
  frequency: "weekly" | "monthly";
  /** Days of the week of a weekly series, as FamilyNest stores them. */
  weekdays: number[] | null;
  /** Last day of the series (`YYYY-MM-DD`), null if it has no end. */
  until: string | null;
} | null;

/**
 * What «Anche su» sends to the provider (#34 §16): only title, start, end,
 * place and repetition, always marked private. Never notes, people, escort.
 * `isPrivate` is the literal `true`: an adapter cannot send a public copy.
 */
export type OutgoingEvent = {
  title: string;
  location: string | null;
  startsAt: string;
  endsAt: string;
  recurrence: OutgoingRecurrence;
  isPrivate: true;
};

/** A session with a short-lived access token, kept in memory only. */
export interface ProviderSession {
  /**
   * A new refresh token the provider issued while the session was opened or
   * renewed (Outlook sends one at every renewal); null when it did not. The
   * caller saves it encrypted: the old one expires.
   */
  readonly rotatedRefreshToken: string | null;
  listCalendars(): Promise<ProviderCalendar[]>;
  listEvents(
    calendar: { id: string },
    window: { from: Date; to: Date },
    cursor: string | null,
  ): Promise<EventsPage>;
  createEvent(
    calendar: { id: string },
    event: OutgoingEvent,
  ): Promise<{ id: string; version: string | null }>;
  updateEvent(
    calendar: { id: string },
    eventId: string,
    event: OutgoingEvent,
  ): Promise<{ version: string | null }>;
  /**
   * Deletes the event. For real adapters a 404 or 410 (already gone) counts as
   * done: a deletion may be repeated after the database failed to record it.
   */
  deleteEvent(calendar: { id: string }, eventId: string): Promise<void>;
}

export interface CalendarProvider {
  readonly id: ProviderId;
  /** True when the provider has a service that revokes a credential. */
  readonly canRevoke: boolean;
  /** The address of the consent page, in the same window. */
  authorizationUrl(params: {
    state: string;
    codeChallenge: string;
    redirectUri: string;
  }): string;
  exchangeCode(params: {
    code: string;
    codeVerifier: string;
    redirectUri: string;
  }): Promise<{
    account: ProviderAccount;
    refreshToken: string;
    /** The user left the calendar permission off on the consent page. */
    calendarGranted: boolean;
  }>;
  /** Asks for a short-lived access token with the refresh token. */
  openSession(refreshToken: string): Promise<ProviderSession>;
  revoke(refreshToken: string): Promise<void>;
}
