import { toDayKey } from "../datetime";
import {
  MAX_PAGES,
  arrayOf,
  buildCursor,
  endOfRomeDay,
  hasAudience,
  isNotExpired,
  isValidEmail,
  readCursor,
  readIdToken,
  recordOf,
  requestToken,
  romeDayOfMonth,
  romeLocalDateTime,
  scopeSet,
  seg,
  send,
  stringOf,
  toUtcIso,
  weeklyDays,
  type AdapterOptions,
  type Authorizer,
  type RequestSpec,
} from "./http";
import {
  ProviderAuthError,
  ProviderTemporaryError,
  type CalendarProvider,
  type EventsPage,
  type OutgoingEvent,
  type ProviderCalendar,
  type ProviderEvent,
  type ProviderSession,
} from "./types";

/*
 * The real adapter of Google Calendar (#329, #34). It receives everything from
 * outside (keys, `fetch`, `sleep`, `now`) and imports neither `server-only` nor
 * the environment, so the tests load it in Node with simulated answers.
 *
 * Minimum permissions: the list of calendars (read only) and the events.
 * Only the fields of `ProviderEvent` are asked for and copied: description,
 * guests, organiser and links never enter the result.
 */

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const API = "https://www.googleapis.com/calendar/v3";

const SCOPE_CALENDAR_LIST =
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly";
const SCOPE_EVENTS = "https://www.googleapis.com/auth/calendar.events";
export const GOOGLE_SCOPE = `openid email ${SCOPE_CALENDAR_LIST} ${SCOPE_EVENTS}`;

const EVENT_FIELDS =
  "nextPageToken,nextSyncToken,items(id,etag,status,summary,location,start,end,recurringEventId,originalStartTime,transparency,visibility,attendees(self,responseStatus))";
const CURSOR_PREFIX = "g1";
const TIME_ZONE = "Europe/Rome";
const WEEKDAY_CODES = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const;

export function createGoogleProvider(
  options: AdapterOptions,
): CalendarProvider {
  return {
    id: "google",
    canRevoke: true,

    authorizationUrl({ state, codeChallenge, redirectUri }) {
      const url = new URL(AUTH_URL);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("client_id", options.clientId);
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("scope", GOOGLE_SCOPE);
      url.searchParams.set("state", state);
      url.searchParams.set("code_challenge", codeChallenge);
      url.searchParams.set("code_challenge_method", "S256");
      url.searchParams.set("access_type", "offline");
      url.searchParams.set("prompt", "consent select_account");
      return url.toString();
    },

    async exchangeCode({ code, codeVerifier, redirectUri }) {
      const token = await requestToken(options, TOKEN_URL, {
        grant_type: "authorization_code",
        code,
        code_verifier: codeVerifier,
        redirect_uri: redirectUri,
      });
      const claims = readIdToken(token.idToken);
      const issuer = stringOf(claims.iss);
      const id = stringOf(claims.sub);
      const email = claims.email;
      if (
        !hasAudience(claims, options.clientId) ||
        !isNotExpired(claims, options.now()) ||
        (issuer !== "https://accounts.google.com" &&
          issuer !== "accounts.google.com") ||
        !id ||
        id.length > 255 ||
        !isValidEmail(email) ||
        !token.refreshToken
      ) {
        throw new ProviderAuthError();
      }
      const granted = scopeSet(token.scope);
      return {
        account: { id, email },
        refreshToken: token.refreshToken,
        calendarGranted:
          granted.has(SCOPE_EVENTS) && granted.has(SCOPE_CALENDAR_LIST),
      };
    },

    async openSession(refreshToken) {
      let refresh = refreshToken;
      let rotated: string | null = null;
      let access = "";
      const renew = async () => {
        const token = await requestToken(options, TOKEN_URL, {
          grant_type: "refresh_token",
          refresh_token: refresh,
        });
        access = token.accessToken;
        if (token.refreshToken && token.refreshToken !== refresh) {
          refresh = token.refreshToken;
          rotated = token.refreshToken;
        }
      };
      await renew();
      const auth: Authorizer = { token: () => access, renew };
      return createSession(options, auth, () => rotated);
    },

    async revoke(refreshToken) {
      const answer = await send(
        options,
        {
          method: "POST",
          url: REVOKE_URL,
          body: new URLSearchParams({ token: refreshToken }).toString(),
          contentType: "application/x-www-form-urlencoded",
          accept: [400],
        },
        null,
      );
      if (answer.status === 400) {
        // Already revoked or expired: nothing is left to do.
        if (recordOf(answer.body).error === "invalid_token") return;
        throw new ProviderTemporaryError();
      }
    },
  };
}

function calendarUrl(calendarId: string): string {
  return `${API}/calendars/${seg(calendarId)}/events`;
}

function createSession(
  options: AdapterOptions,
  auth: Authorizer,
  rotated: () => string | null,
): ProviderSession {
  const call = (spec: RequestSpec) => send(options, spec, auth);

  async function listCalendars(): Promise<ProviderCalendar[]> {
    const result: ProviderCalendar[] = [];
    let pageToken: string | undefined;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const query = new URLSearchParams({
        minAccessRole: "reader",
        maxResults: "250",
        fields:
          "nextPageToken,items(id,summary,summaryOverride,primary,accessRole)",
      });
      if (pageToken) query.set("pageToken", pageToken);
      const answer = await call({
        method: "GET",
        url: `${API}/users/me/calendarList?${query.toString()}`,
      });
      const body = recordOf(answer.body);
      for (const raw of arrayOf(body.items)) {
        const item = recordOf(raw);
        const id = stringOf(item.id);
        if (!id) continue;
        const role = stringOf(item.accessRole);
        result.push({
          id,
          name: stringOf(item.summaryOverride) ?? stringOf(item.summary) ?? id,
          isPrimary: item.primary === true,
          isReadOnly: role !== "owner" && role !== "writer",
        });
      }
      pageToken = stringOf(body.nextPageToken);
      if (!pageToken) return result;
    }
    throw new ProviderTemporaryError();
  }

  type Read = { events: ProviderEvent[]; token: string | null } | "full";

  // Reads every page; "full" means the incremental read cannot be trusted.
  async function readEvents(
    calendarId: string,
    base: Record<string, string>,
    incremental: boolean,
  ): Promise<Read> {
    const events: ProviderEvent[] = [];
    let pageToken: string | undefined;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const query = new URLSearchParams({
        ...base,
        singleEvents: "true",
        maxResults: "250",
        fields: EVENT_FIELDS,
      });
      if (pageToken) query.set("pageToken", pageToken);
      const answer = await call({
        method: "GET",
        url: `${calendarUrl(calendarId)}?${query.toString()}`,
        accept: incremental ? [410] : [],
      });
      // The sync token is no longer valid (fullSyncRequired).
      if (answer.status === 410) return "full";
      const body = recordOf(answer.body);
      for (const raw of arrayOf(body.items)) {
        const item = recordOf(raw);
        if (incremental && item.status === "cancelled") {
          const gone = cancelledOccurrence(item);
          if (!gone) return "full";
          events.push(gone);
          continue;
        }
        const event = toProviderEvent(item);
        if (event) events.push(event);
      }
      pageToken = stringOf(body.nextPageToken);
      if (!pageToken) {
        return { events, token: stringOf(body.nextSyncToken) ?? null };
      }
    }
    throw new ProviderTemporaryError();
  }

  async function listEvents(
    calendar: { id: string },
    window: { from: Date; to: Date },
    cursor: string | null,
  ): Promise<EventsPage> {
    const today = toDayKey(options.now());
    const syncToken = readCursor(CURSOR_PREFIX, cursor, today);
    if (syncToken) {
      const incremental = await readEvents(calendar.id, { syncToken }, true);
      if (incremental !== "full") {
        return {
          events: incremental.events,
          full: false,
          cursor: buildCursor(CURSOR_PREFIX, today, incremental.token),
        };
      }
    }
    const full = await readEvents(
      calendar.id,
      {
        timeMin: window.from.toISOString(),
        timeMax: window.to.toISOString(),
      },
      false,
    );
    if (full === "full") throw new ProviderTemporaryError();
    return {
      events: full.events,
      full: true,
      cursor: buildCursor(CURSOR_PREFIX, today, full.token),
    };
  }

  async function createEvent(
    calendar: { id: string },
    event: OutgoingEvent,
  ): Promise<{ id: string; version: string | null }> {
    const answer = await call({
      method: "POST",
      url: `${calendarUrl(calendar.id)}?sendUpdates=none`,
      body: JSON.stringify(outgoingBody(event, false)),
      contentType: "application/json",
      creates: true,
    });
    const body = recordOf(answer.body);
    const id = stringOf(body.id);
    if (!id) throw new ProviderTemporaryError();
    return { id, version: stringOf(body.etag) ?? null };
  }

  async function updateEvent(
    calendar: { id: string },
    eventId: string,
    event: OutgoingEvent,
  ): Promise<{ version: string | null }> {
    const answer = await call({
      method: "PATCH",
      url: `${calendarUrl(calendar.id)}/${seg(eventId)}?sendUpdates=none`,
      body: JSON.stringify(outgoingBody(event, true)),
      contentType: "application/json",
    });
    return { version: stringOf(recordOf(answer.body).etag) ?? null };
  }

  async function deleteEvent(
    calendar: { id: string },
    eventId: string,
  ): Promise<void> {
    // Gone already (404, 410) counts as done.
    await call({
      method: "DELETE",
      url: `${calendarUrl(calendar.id)}/${seg(eventId)}?sendUpdates=none`,
      accept: [404, 410],
    });
  }

  return {
    get rotatedRefreshToken() {
      return rotated();
    },
    listCalendars,
    listEvents,
    createEvent,
    updateEvent,
    deleteEvent,
  };
}

// A cancelled copy of one occurrence of a series: the occurrence is deleted.
// Anything else cancelled cannot be told apart safely: the caller reads all.
function cancelledOccurrence(
  item: Record<string, unknown>,
): ProviderEvent | null {
  const series = stringOf(item.recurringEventId);
  const key = occurrenceKeyOf(item);
  if (!series || !key) return null;
  return { id: series, occurrenceKey: key, deleted: true };
}

function occurrenceKeyOf(item: Record<string, unknown>): string | null {
  const original = recordOf(item.originalStartTime);
  const dateTime = stringOf(original.dateTime);
  if (dateTime) return toUtcIso(dateTime);
  return stringOf(original.date) ?? null;
}

const STATUSES = ["confirmed", "tentative", "cancelled"] as const;

// Explicit list of keys, never a copy of the answer.
function toProviderEvent(item: Record<string, unknown>): ProviderEvent | null {
  const ownId = stringOf(item.id);
  const series = stringOf(item.recurringEventId);
  const id = series ?? ownId;
  if (!id) return null;

  let occurrenceKey = "";
  if (series) occurrenceKey = occurrenceKeyOf(item) ?? "";

  const start = recordOf(item.start);
  const end = recordOf(item.end);
  const event: ProviderEvent = { id, occurrenceKey };
  if (series && !occurrenceKey) {
    // No original start: the start of the copy is the best stable key.
    const fallback = toUtcIso(stringOf(start.dateTime)) ?? stringOf(start.date);
    if (fallback) event.occurrenceKey = fallback;
  }

  const etag = stringOf(item.etag);
  if (etag) event.version = etag;
  const title = stringOf(item.summary);
  if (title !== undefined) event.title = title;
  const location = stringOf(item.location);
  if (location !== undefined) event.location = location;

  const startDate = stringOf(start.date);
  if (startDate) {
    const endDate = stringOf(end.date);
    if (!endDate) return null;
    event.allDay = true;
    event.startDate = startDate;
    event.endDate = endDate;
  } else {
    const startsAt = toUtcIso(stringOf(start.dateTime));
    const endsAt = toUtcIso(stringOf(end.dateTime));
    if (!startsAt || !endsAt) return null;
    event.startsAt = startsAt;
    event.endsAt = endsAt;
  }

  const status = STATUSES.find((s) => s === item.status);
  if (status) event.status = status;
  const self = arrayOf(item.attendees)
    .map(recordOf)
    .find((a) => a.self === true);
  event.declined = self?.responseStatus === "declined";
  event.isPrivate =
    item.visibility === "private" || item.visibility === "confidential";
  event.isFree = item.transparency === "transparent";
  return event;
}

// The body of «Anche su»: only title, place, times and repetition; always
// private; never guests, description or a video call.
function outgoingBody(
  event: OutgoingEvent,
  isUpdate: boolean,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    summary: event.title,
    location: event.location ?? "",
    start: { dateTime: romeLocalDateTime(event.startsAt), timeZone: TIME_ZONE },
    end: { dateTime: romeLocalDateTime(event.endsAt), timeZone: TIME_ZONE },
    visibility: "private",
  };
  const rule = recurrenceRule(event);
  if (rule) body.recurrence = [rule];
  else if (isUpdate) body.recurrence = [];
  return body;
}

function recurrenceRule(event: OutgoingEvent): string | null {
  const recurrence = event.recurrence;
  if (!recurrence) return null;
  const parts: string[] = [];
  if (recurrence.frequency === "weekly") {
    const days = weeklyDays(recurrence.weekdays, event.startsAt).map(
      (d) => WEEKDAY_CODES[d - 1],
    );
    parts.push("FREQ=WEEKLY", `BYDAY=${days.join(",")}`);
  } else {
    parts.push("FREQ=MONTHLY", `BYMONTHDAY=${romeDayOfMonth(event.startsAt)}`);
  }
  if (recurrence.until) {
    const until = endOfRomeDay(recurrence.until)
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
    parts.push(`UNTIL=${until}`);
  }
  return `RRULE:${parts.join(";")}`;
}
