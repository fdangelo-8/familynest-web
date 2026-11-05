import { createHash, randomBytes } from "node:crypto";
import {
  ProviderAuthError,
  ProviderTemporaryError,
  type CalendarProvider,
  type EventsPage,
  type OutgoingEvent,
  type ProviderEvent,
  type ProviderId,
  type ProviderSession,
} from "./types";

/*
 * The fake provider (#34 §11): the same questions as Google or Outlook, with
 * answers the tests prepare. It lives in the memory of the server process (a
 * `globalThis` store), so it works where tests and server share one process
 * (local server, CI) and nowhere else.
 *
 * It is switched on only by `CALENDAR_FAKE_PROVIDER` and never in production
 * (`isFakeCalendarProviderEnabled`); every entry point checks that. Its tokens
 * and codes are random strings that mean nothing outside this process. The
 * register (`log`) says what FamilyNest wrote, changed, deleted and revoked.
 *
 * Tests prepare it through `/api/calendar-sync/fake` (see `applyFakeControl`).
 */

export type FakeEventInput = ProviderEvent & {
  /** The event repeats `count` times, every `everyDays` days. */
  repeat?: { everyDays: number; count: number };
  /** Anything else a real provider sends and FamilyNest must never keep. */
  [extra: string]: unknown;
};

type FakeCalendar = {
  id: string;
  name: string;
  isPrimary: boolean;
  isReadOnly: boolean;
  events: Map<string, FakeEventInput>;
  revision: number;
};

type FakeAccount = {
  id: string;
  provider: ProviderId;
  email: string;
  calendars: Map<string, FakeCalendar>;
  authFailsFrom: number | null;
  unreachable: boolean;
  slowMs: number;
};

type FakeUser = {
  accounts: Map<string, FakeAccount>;
  /** Account the next consent page grants (default: the first prepared). */
  nextConsentKey: string | null;
};

type FakeToken = {
  userId: string;
  accountKey: string;
  revoked: boolean;
};

type FakeCode = {
  userId: string;
  accountKey: string;
  calendarGranted: boolean;
  challenge: string;
};

export type FakeLogEntry = {
  at: string;
  action: "token" | "create" | "update" | "delete" | "revoke";
  userId: string;
  email: string;
  calendarId?: string;
  eventId?: string;
  /** Token issued or revoked by the fake (it means nothing elsewhere). */
  token?: string;
  title?: string;
  /** Everything the fake received with «Anche su»: nothing else was sent. */
  outgoing?: OutgoingEvent;
};

type FakeStore = {
  users: Map<string, FakeUser>;
  tokens: Map<string, FakeToken>;
  codes: Map<string, FakeCode>;
  log: FakeLogEntry[];
  counter: number;
};

const STORE_KEY = Symbol.for("familynest.calendar-fake-provider");

function store(): FakeStore {
  const holder = globalThis as unknown as Record<symbol, FakeStore | undefined>;
  let current = holder[STORE_KEY];
  if (!current) {
    current = {
      users: new Map(),
      tokens: new Map(),
      codes: new Map(),
      log: [],
      counter: 0,
    };
    holder[STORE_KEY] = current;
  }
  return current;
}

function accountKey(provider: ProviderId, email: string): string {
  return `${provider}:${email}`;
}

function user(userId: string): FakeUser {
  const s = store();
  let u = s.users.get(userId);
  if (!u) {
    u = { accounts: new Map(), nextConsentKey: null };
    s.users.set(userId, u);
  }
  return u;
}

function random(): string {
  return randomBytes(24).toString("base64url");
}

function record(entry: Omit<FakeLogEntry, "at">): void {
  store().log.push({ at: new Date().toISOString(), ...entry });
}

function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const DAY_MS = 86_400_000;

// A repeated event gives one event per occurrence, each with its own key.
function expand(event: FakeEventInput): ProviderEvent[] {
  const { repeat, ...rest } = event;
  if (!repeat) return [{ ...rest, occurrenceKey: rest.occurrenceKey ?? "" }];
  const count = Math.min(Math.max(Math.trunc(repeat.count), 1), 400);
  const step = Math.max(Math.trunc(repeat.everyDays), 1) * DAY_MS;
  const result: ProviderEvent[] = [];
  for (let i = 0; i < count; i += 1) {
    const occurrence: FakeEventInput = { ...rest };
    if (rest.allDay && rest.startDate) {
      const shift = (iso: string) =>
        new Date(Date.parse(`${iso}T00:00:00Z`) + i * step)
          .toISOString()
          .slice(0, 10);
      occurrence.startDate = shift(rest.startDate);
      if (rest.endDate) occurrence.endDate = shift(rest.endDate);
      occurrence.occurrenceKey = occurrence.startDate;
    } else if (rest.startsAt) {
      const shift = (iso: string) =>
        new Date(Date.parse(iso) + i * step).toISOString();
      occurrence.startsAt = shift(rest.startsAt);
      if (rest.endsAt) occurrence.endsAt = shift(rest.endsAt);
      occurrence.occurrenceKey = occurrence.startsAt;
    }
    result.push(occurrence);
  }
  return result;
}

function findAccount(token: string): {
  token: FakeToken;
  account: FakeAccount;
} {
  const entry = store().tokens.get(token);
  if (!entry || entry.revoked) throw new ProviderAuthError();
  const account = user(entry.userId).accounts.get(entry.accountKey);
  if (!account) throw new ProviderAuthError();
  return { token: entry, account };
}

function openFakeSession(
  account: FakeAccount,
  userId: string,
): ProviderSession {
  const calendarOf = (id: string): FakeCalendar => {
    const calendar = account.calendars.get(id);
    if (!calendar) throw new ProviderTemporaryError();
    return calendar;
  };
  return {
    async listCalendars() {
      return [...account.calendars.values()].map((c) => ({
        id: c.id,
        name: c.name,
        isPrimary: c.isPrimary,
        isReadOnly: c.isReadOnly,
      }));
    },
    async listEvents(calendar, _window, cursor): Promise<EventsPage> {
      const found = calendarOf(calendar.id);
      const revision = String(found.revision);
      if (cursor === revision) {
        return { events: [], full: false, cursor: revision };
      }
      const events = [...found.events.values()].flatMap(expand);
      return { events, full: true, cursor: revision };
    },
    async createEvent(calendar, event: OutgoingEvent) {
      const found = calendarOf(calendar.id);
      if (found.isReadOnly) throw new ProviderAuthError();
      const id = `fake-event-${(store().counter += 1)}`;
      found.events.set(id, {
        id,
        title: event.title,
        location: event.location ?? undefined,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        isPrivate: event.isPrivate,
        version: "1",
      });
      found.revision += 1;
      record({
        action: "create",
        userId,
        email: account.email,
        calendarId: found.id,
        eventId: id,
        title: event.title,
        outgoing: { ...event },
      });
      return { id, version: "1" };
    },
    async updateEvent(calendar, eventId, event: OutgoingEvent) {
      const found = calendarOf(calendar.id);
      const current = found.events.get(eventId);
      if (!current) throw new ProviderTemporaryError();
      const version = String(Number(current.version ?? "1") + 1);
      found.events.set(eventId, {
        ...current,
        title: event.title,
        location: event.location ?? undefined,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        isPrivate: event.isPrivate,
        version,
      });
      found.revision += 1;
      record({
        action: "update",
        userId,
        email: account.email,
        calendarId: found.id,
        eventId,
        title: event.title,
        outgoing: { ...event },
      });
      return { version };
    },
    async deleteEvent(calendar, eventId) {
      const found = calendarOf(calendar.id);
      found.events.delete(eventId);
      found.revision += 1;
      record({
        action: "delete",
        userId,
        email: account.email,
        calendarId: found.id,
        eventId,
      });
    },
  };
}

export function createFakeProvider(id: ProviderId): CalendarProvider {
  return {
    id,
    canRevoke: true,
    authorizationUrl({ state, codeChallenge, redirectUri }) {
      const url = new URL(`/fornitore-finto/${id}`, redirectUri);
      url.searchParams.set("state", state);
      url.searchParams.set("code_challenge", codeChallenge);
      return url.toString();
    },
    async exchangeCode({ code, codeVerifier }) {
      const s = store();
      const entry = s.codes.get(code);
      // A code works once.
      s.codes.delete(code);
      if (!entry || entry.challenge !== pkceChallenge(codeVerifier)) {
        throw new ProviderAuthError();
      }
      const account = user(entry.userId).accounts.get(entry.accountKey);
      if (!account || account.provider !== id) throw new ProviderAuthError();
      const refreshToken = `fake-refresh-${random()}`;
      s.tokens.set(refreshToken, {
        userId: entry.userId,
        accountKey: entry.accountKey,
        revoked: false,
      });
      record({
        action: "token",
        userId: entry.userId,
        email: account.email,
        token: refreshToken,
      });
      return {
        account: { id: account.id, email: account.email },
        refreshToken,
        calendarGranted: entry.calendarGranted,
      };
    },
    async openSession(refreshToken) {
      const { token, account } = findAccount(refreshToken);
      if (
        account.authFailsFrom !== null &&
        Date.now() >= account.authFailsFrom
      ) {
        throw new ProviderAuthError();
      }
      if (account.slowMs > 0) await sleep(account.slowMs);
      if (account.unreachable) throw new ProviderTemporaryError();
      return openFakeSession(account, token.userId);
    },
    async revoke(refreshToken) {
      const entry = store().tokens.get(refreshToken);
      if (!entry) return;
      entry.revoked = true;
      const account = user(entry.userId).accounts.get(entry.accountKey);
      record({
        action: "revoke",
        userId: entry.userId,
        email: account?.email ?? "",
        token: refreshToken,
      });
    },
  };
}

/**
 * For the consent page of the fake: the two codes that «Consenti» and
 * «Consenti senza calendario» use. Null when the user has no prepared account.
 */
export function mintFakeConsentCodes(
  provider: ProviderId,
  userId: string,
  challenge: string,
): { full: string; withoutCalendar: string } | null {
  const u = user(userId);
  const key =
    u.nextConsentKey && u.accounts.has(u.nextConsentKey)
      ? u.nextConsentKey
      : ([...u.accounts.keys()].find((k) => k.startsWith(`${provider}:`)) ??
        null);
  if (!key) return null;
  const s = store();
  const mint = (calendarGranted: boolean): string => {
    const code = `fake-code-${random()}`;
    s.codes.set(code, { userId, accountKey: key, calendarGranted, challenge });
    return code;
  };
  return { full: mint(true), withoutCalendar: mint(false) };
}

// ---------------------------------------------------------------------------
// What the tests ask the fake to do (`/api/calendar-sync/fake`).
// ---------------------------------------------------------------------------

export type FakeCalendarInput = {
  id: string;
  name: string;
  primary?: boolean;
  readOnly?: boolean;
  events?: FakeEventInput[];
};

export type FakeControl =
  | { action: "reset"; userId?: string }
  | {
      action: "setup";
      userId: string;
      provider?: ProviderId;
      email: string;
      calendars: FakeCalendarInput[];
      /** This account is the one the next consent page grants. */
      nextConsent?: boolean;
    }
  | {
      action: "set-events";
      userId: string;
      provider?: ProviderId;
      email: string;
      calendarId: string;
      events: FakeEventInput[];
    }
  | {
      action: "fail";
      userId: string;
      provider?: ProviderId;
      email: string;
      /** Credentials refused from this instant on (ISO), or never. */
      authFailsFrom?: string | null;
      unreachable?: boolean;
      slowMs?: number;
    }
  | { action: "log"; userId?: string };

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function toCalendar(input: FakeCalendarInput): FakeCalendar {
  const events = new Map<string, FakeEventInput>();
  for (const event of input.events ?? []) {
    events.set(`${event.id}`, event);
  }
  return {
    id: input.id,
    name: input.name,
    isPrimary: input.primary === true,
    isReadOnly: input.readOnly === true,
    events,
    revision: 1,
  };
}

/** Applies one instruction of a test; returns what the test may read. */
export function applyFakeControl(body: unknown): {
  ok: boolean;
  log?: FakeLogEntry[];
} {
  const input = asRecord(body);
  if (!input || typeof input.action !== "string") return { ok: false };
  const s = store();
  const control = input as unknown as FakeControl;
  const provider = (p: ProviderId | undefined) => p ?? "google";

  switch (control.action) {
    case "reset": {
      if (control.userId) {
        s.users.delete(control.userId);
        for (const [token, entry] of s.tokens) {
          if (entry.userId === control.userId) s.tokens.delete(token);
        }
        for (const [code, entry] of s.codes) {
          if (entry.userId === control.userId) s.codes.delete(code);
        }
        s.log = s.log.filter((entry) => entry.userId !== control.userId);
      } else {
        s.users.clear();
        s.tokens.clear();
        s.codes.clear();
        s.log = [];
      }
      return { ok: true };
    }
    case "setup": {
      const key = accountKey(provider(control.provider), control.email);
      const calendars = new Map<string, FakeCalendar>();
      for (const calendar of control.calendars) {
        calendars.set(calendar.id, toCalendar(calendar));
      }
      const u = user(control.userId);
      u.accounts.set(key, {
        id: `fake-account-${createHash("sha256").update(control.email).digest("hex").slice(0, 16)}`,
        provider: provider(control.provider),
        email: control.email,
        calendars,
        authFailsFrom: null,
        unreachable: false,
        slowMs: 0,
      });
      if (control.nextConsent) u.nextConsentKey = key;
      return { ok: true };
    }
    case "set-events": {
      const account = user(control.userId).accounts.get(
        accountKey(provider(control.provider), control.email),
      );
      const calendar = account?.calendars.get(control.calendarId);
      if (!calendar) return { ok: false };
      calendar.events = new Map(control.events.map((e) => [e.id, e]));
      calendar.revision += 1;
      return { ok: true };
    }
    case "fail": {
      const account = user(control.userId).accounts.get(
        accountKey(provider(control.provider), control.email),
      );
      if (!account) return { ok: false };
      if (control.authFailsFrom !== undefined) {
        account.authFailsFrom =
          control.authFailsFrom === null
            ? null
            : Date.parse(control.authFailsFrom);
      }
      if (control.unreachable !== undefined) {
        account.unreachable = control.unreachable;
      }
      if (control.slowMs !== undefined) account.slowMs = control.slowMs;
      return { ok: true };
    }
    case "log": {
      return {
        ok: true,
        log: control.userId
          ? s.log.filter((entry) => entry.userId === control.userId)
          : [...s.log],
      };
    }
    default:
      return { ok: false };
  }
}
