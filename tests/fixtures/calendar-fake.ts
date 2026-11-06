// Fixture of the fake calendar provider (#34 §11, #272): lets a test prepare
// accounts, calendars and events for ONE user, cause failures, run the
// synchronisation or the revocation queue now, and read the register of what
// FamilyNest wrote, changed, deleted and revoked at the provider.
//
// The fake lives in the memory of the server process, so the test and the
// server must share the environment: `CALENDAR_FAKE_PROVIDER=1`,
// `CALENDAR_SYNC_SECRET` (at least 32 characters) and `CALENDAR_ENCRYPTION_KEY`
// (32 random bytes in base64) are set for both. Nothing here has a value of
// its own: the secret comes only from the environment.
//
// Tests that link calendars use throwaway users only, deleted at the end
// (LEZIONI), and call `reset` for them in the `finally`.

export type FakeEvent = {
  id: string;
  occurrenceKey?: string;
  version?: string;
  title?: string;
  location?: string;
  startsAt?: string;
  endsAt?: string;
  allDay?: boolean;
  startDate?: string;
  endDate?: string;
  status?: "confirmed" | "tentative" | "cancelled";
  declined?: boolean;
  isPrivate?: boolean;
  isFree?: boolean;
  deleted?: boolean;
  /** Repeated event: `count` occurrences, one every `everyDays` days. */
  repeat?: { everyDays: number; count: number };
  /** What a real provider sends and FamilyNest must never keep. */
  description?: string;
  attendees?: Array<{ email: string }>;
  organizer?: { email: string };
};

export type FakeCalendar = {
  id: string;
  name: string;
  primary?: boolean;
  readOnly?: boolean;
  events?: FakeEvent[];
};

export type FakeLogEntry = {
  at: string;
  action: "token" | "create" | "update" | "delete" | "revoke";
  userId: string;
  email: string;
  calendarId?: string;
  eventId?: string;
  token?: string;
  title?: string;
  /** Everything the fake received with «Anche su» (nothing else was sent). */
  outgoing?: {
    title: string;
    location: string | null;
    startsAt: string;
    endsAt: string;
    recurrence: unknown;
    isPrivate: boolean;
  };
};

/** The «Google finto standard» of the specification (#34 §CA). */
export const STANDARD_FAKE_ACCOUNT = {
  email: "u.finto@example.test",
  calendars: [
    { id: "personale", name: "Personale", primary: true },
    { id: "tennis", name: "Tennis" },
    { id: "festivita", name: "Festività in Italia", readOnly: true },
  ] satisfies FakeCalendar[],
};

export function fakeCalendarConfigured(): boolean {
  return (
    process.env.CALENDAR_FAKE_PROVIDER === "1" &&
    (process.env.CALENDAR_SYNC_SECRET ?? "").length >= 32 &&
    !!process.env.CALENDAR_ENCRYPTION_KEY
  );
}

export const fakeCalendarSkipReason =
  "Fornitore finto dei calendari non attivo (CALENDAR_FAKE_PROVIDER, CALENDAR_SYNC_SECRET, CALENDAR_ENCRYPTION_KEY)";

async function call<T>(
  baseURL: string,
  body: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(new URL("/api/calendar-sync/fake", baseURL), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.CALENDAR_SYNC_SECRET ?? ""}`,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(
      `Fake provider: ${String(body.action)} answered ${response.status}`,
    );
  }
  return (await response.json()) as T;
}

export function fakeCalendar(baseURL: string) {
  return {
    /** Prepares an account of the user, with its calendars and events. */
    setup(params: {
      userId: string;
      email: string;
      calendars: FakeCalendar[];
      provider?: "google" | "outlook";
      /** The next consent page grants this account. */
      nextConsent?: boolean;
    }) {
      return call<{ ok: boolean }>(baseURL, { action: "setup", ...params });
    },
    /** Replaces the events of a calendar. */
    setEvents(params: {
      userId: string;
      email: string;
      calendarId: string;
      events: FakeEvent[];
      provider?: "google" | "outlook";
    }) {
      return call<{ ok: boolean }>(baseURL, {
        action: "set-events",
        ...params,
      });
    },
    /** Failures: credentials refused from an instant on, unreachable, slow. */
    fail(params: {
      userId: string;
      email: string;
      authFailsFrom?: string | null;
      unreachable?: boolean;
      slowMs?: number;
      /** Every renewal gives back a new refresh token (as Outlook does). */
      rotateTokens?: boolean;
      provider?: "google" | "outlook";
    }) {
      return call<{ ok: boolean }>(baseURL, { action: "fail", ...params });
    },
    /** Synchronises the accounts of the user now. */
    sync(userId: string) {
      return call<{ ok: boolean; results: string[] }>(baseURL, {
        action: "sync",
        userId,
      });
    },
    /** Runs the revocation queue now. */
    revocations() {
      return call<{ ok: boolean; revoked: number; kept: number }>(baseURL, {
        action: "revocations",
      });
    },
    /** Runs the queue of «Anche su» now. */
    outbox() {
      return call<{ ok: boolean; done: number; failed: number }>(baseURL, {
        action: "outbox",
      });
    },
    /** What FamilyNest did at the provider, with the tokens the fake issued. */
    async log(userId?: string): Promise<FakeLogEntry[]> {
      const answer = await call<{ ok: boolean; log: FakeLogEntry[] }>(baseURL, {
        action: "log",
        userId,
      });
      return answer.log;
    },
    /** Forgets the user (or everything). Call it in the `finally`. */
    reset(userId?: string) {
      return call<{ ok: boolean }>(baseURL, { action: "reset", userId });
    },
  };
}
