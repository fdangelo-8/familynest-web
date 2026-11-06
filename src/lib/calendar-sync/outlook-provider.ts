import { toDayKey } from "../datetime";
import {
  MAX_PAGES,
  arrayOf,
  buildCursor,
  dayOfNoon,
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
 * The real adapter of Outlook / Microsoft Graph (#329, #35). Same shape and
 * rules as the Google one: everything comes from outside, no `server-only`,
 * only the fields of `ProviderEvent` are asked for and copied.
 *
 * Endpoint `common`: personal and work accounts. At every renewal Microsoft
 * sends a new refresh token (the old one expires after 90 days): the session
 * says so in `rotatedRefreshToken`. Outlook has no revocation service.
 */

const AUTH_URL =
  "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const GRAPH = "https://graph.microsoft.com/v1.0";
export const OUTLOOK_SCOPE =
  "openid profile email offline_access Calendars.ReadWrite";
const CURSOR_PREFIX = "m1";
const TIME_ZONE = "W. Europe Standard Time";
const WEEKDAY_NAMES = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;
const EVENT_SELECT =
  "id,seriesMasterId,type,originalStart,changeKey,subject,location,start,end,isAllDay,isCancelled,showAs,sensitivity,responseStatus";

export function createOutlookProvider(
  options: AdapterOptions,
): CalendarProvider {
  return {
    id: "outlook",
    // Microsoft has no service that revokes a refresh token (#35 §5).
    canRevoke: false,

    authorizationUrl({ state, codeChallenge, redirectUri }) {
      const url = new URL(AUTH_URL);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("client_id", options.clientId);
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("scope", OUTLOOK_SCOPE);
      url.searchParams.set("state", state);
      url.searchParams.set("code_challenge", codeChallenge);
      url.searchParams.set("code_challenge_method", "S256");
      url.searchParams.set("response_mode", "query");
      url.searchParams.set("prompt", "select_account");
      return url.toString();
    },

    async exchangeCode({ code, codeVerifier, redirectUri }) {
      const token = await requestToken(options, TOKEN_URL, {
        grant_type: "authorization_code",
        code,
        code_verifier: codeVerifier,
        redirect_uri: redirectUri,
        scope: OUTLOOK_SCOPE,
      });
      const claims = readIdToken(token.idToken);
      const tid = stringOf(claims.tid);
      const oid = stringOf(claims.oid);
      const email = claims.email ?? claims.preferred_username;
      if (
        !hasAudience(claims, options.clientId) ||
        !isNotExpired(claims, options.now()) ||
        !tid ||
        !oid ||
        claims.iss !== `https://login.microsoftonline.com/${tid}/v2.0` ||
        `${tid}.${oid}`.length > 255 ||
        !isValidEmail(email) ||
        !token.refreshToken
      ) {
        throw new ProviderAuthError();
      }
      let calendarGranted = scopeSet(token.scope).has("calendars.readwrite");
      if (calendarGranted) {
        calendarGranted = await hasMailbox(options, token.accessToken);
      }
      return {
        account: { id: `${tid}.${oid}`, email },
        refreshToken: token.refreshToken,
        calendarGranted,
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
          scope: OUTLOOK_SCOPE,
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

    async revoke() {
      // Nothing to call: the user removes the access from the account.
    },
  };
}

// Whether the account has a mailbox with a calendar the REST API can reach.
async function hasMailbox(
  options: AdapterOptions,
  accessToken: string,
): Promise<boolean> {
  const answer = await send(
    options,
    {
      method: "GET",
      url: `${GRAPH}/me/calendars?$top=1&$select=id`,
      accept: [403, 404],
    },
    {
      token: () => accessToken,
      renew: async () => {
        throw new ProviderAuthError();
      },
    },
  );
  if (answer.status === 404) return false;
  if (answer.status === 403) {
    const text = JSON.stringify(answer.body ?? "");
    if (text.includes('"MailboxNotEnabledForRESTAPI"')) return false;
    if (text.includes('"ErrorAccessDenied"')) throw new ProviderAuthError();
    throw new ProviderTemporaryError();
  }
  return true;
}

// Graph gives back full addresses for the next page: they must stay on Graph,
// or the access token would travel to someone else.
function isGraphUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "graph.microsoft.com";
  } catch {
    return false;
  }
}

function createSession(
  options: AdapterOptions,
  auth: Authorizer,
  rotated: () => string | null,
): ProviderSession {
  const call = (spec: RequestSpec) => send(options, spec, auth);

  async function listCalendars(): Promise<ProviderCalendar[]> {
    const result: ProviderCalendar[] = [];
    let url: string | undefined =
      `${GRAPH}/me/calendars?$select=id,name,canEdit,isDefaultCalendar&$top=100`;
    for (let page = 0; page < MAX_PAGES && url; page += 1) {
      const answer = await call({ method: "GET", url });
      const body = recordOf(answer.body);
      for (const raw of arrayOf(body.value)) {
        const item = recordOf(raw);
        const id = stringOf(item.id);
        if (!id) continue;
        result.push({
          id,
          name: stringOf(item.name) ?? id,
          isPrimary: item.isDefaultCalendar === true,
          isReadOnly: item.canEdit !== true,
        });
      }
      const next = stringOf(body["@odata.nextLink"]);
      if (!next) return result;
      if (!isGraphUrl(next)) throw new ProviderTemporaryError();
      url = next;
    }
    throw new ProviderTemporaryError();
  }

  type Read = { events: ProviderEvent[]; deltaLink: string | null } | "full";

  async function readDelta(first: string, incremental: boolean): Promise<Read> {
    const events: ProviderEvent[] = [];
    let url: string = first;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const answer = await call({
        method: "GET",
        url,
        headers: {
          Prefer: 'outlook.timezone="UTC", odata.maxpagesize=200',
        },
        accept: incremental ? [410] : [],
      });
      // The delta state is gone (syncStateNotFound).
      if (answer.status === 410) return "full";
      const body = recordOf(answer.body);
      for (const raw of arrayOf(body.value)) {
        const item = recordOf(raw);
        // A removal cannot be tied to one occurrence: read everything.
        if ("@removed" in item) return "full";
        const event = toProviderEvent(item);
        if (event) events.push(event);
      }
      const next = stringOf(body["@odata.nextLink"]);
      if (next) {
        if (!isGraphUrl(next)) throw new ProviderTemporaryError();
        url = next;
        continue;
      }
      const delta = stringOf(body["@odata.deltaLink"]);
      return {
        events,
        deltaLink: isGraphUrl(delta) ? delta : null,
      };
    }
    throw new ProviderTemporaryError();
  }

  async function listEvents(
    calendar: { id: string },
    window: { from: Date; to: Date },
    cursor: string | null,
  ): Promise<EventsPage> {
    const today = toDayKey(options.now());
    const deltaLink = readCursor(CURSOR_PREFIX, cursor, today);
    // A delta link to another host is never called.
    if (isGraphUrl(deltaLink ?? undefined)) {
      const incremental = await readDelta(deltaLink as string, true);
      if (incremental !== "full") {
        return {
          events: incremental.events,
          full: false,
          cursor: buildCursor(CURSOR_PREFIX, today, incremental.deltaLink),
        };
      }
    }
    const first = `${GRAPH}/me/calendars/${seg(calendar.id)}/calendarView/delta?startDateTime=${encodeURIComponent(
      window.from.toISOString(),
    )}&endDateTime=${encodeURIComponent(window.to.toISOString())}&$select=${EVENT_SELECT}`;
    const full = await readDelta(first, false);
    if (full === "full") throw new ProviderTemporaryError();
    return {
      events: full.events,
      full: true,
      cursor: buildCursor(CURSOR_PREFIX, today, full.deltaLink),
    };
  }

  async function createEvent(
    calendar: { id: string },
    event: OutgoingEvent,
  ): Promise<{ id: string; version: string | null }> {
    const answer = await call({
      method: "POST",
      url: `${GRAPH}/me/calendars/${seg(calendar.id)}/events`,
      body: JSON.stringify(outgoingBody(event, false)),
      contentType: "application/json",
      creates: true,
    });
    const body = recordOf(answer.body);
    const id = stringOf(body.id);
    if (!id) throw new ProviderTemporaryError();
    return { id, version: stringOf(body.changeKey) ?? null };
  }

  async function updateEvent(
    _calendar: { id: string },
    eventId: string,
    event: OutgoingEvent,
  ): Promise<{ version: string | null }> {
    const answer = await call({
      method: "PATCH",
      url: `${GRAPH}/me/events/${seg(eventId)}`,
      body: JSON.stringify(outgoingBody(event, true)),
      contentType: "application/json",
    });
    return { version: stringOf(recordOf(answer.body).changeKey) ?? null };
  }

  async function deleteEvent(
    _calendar: { id: string },
    eventId: string,
  ): Promise<void> {
    // Gone already (404, 410) counts as done.
    await call({
      method: "DELETE",
      url: `${GRAPH}/me/events/${seg(eventId)}`,
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

// Explicit list of keys, never a copy of the answer.
function toProviderEvent(item: Record<string, unknown>): ProviderEvent | null {
  const type = stringOf(item.type);
  // The master of a series is not an event of the calendar view.
  if (type === "seriesMaster") return null;
  const ownId = stringOf(item.id);
  const id = stringOf(item.seriesMasterId) ?? ownId;
  if (!id) return null;

  const isAllDay = item.isAllDay === true;
  const start = stringOf(recordOf(item.start).dateTime);
  const end = stringOf(recordOf(item.end).dateTime);

  const event: ProviderEvent = { id, occurrenceKey: "" };
  if (type === "occurrence" || type === "exception") {
    const original = stringOf(item.originalStart);
    if (original && isAllDay) {
      event.occurrenceKey = dayOfNoon(original) ?? ownId ?? "";
    } else {
      event.occurrenceKey = toUtcIso(original) ?? ownId ?? "";
    }
  }

  const changeKey = stringOf(item.changeKey);
  if (changeKey) event.version = changeKey;
  const title = stringOf(item.subject);
  if (title !== undefined) event.title = title;
  const location = stringOf(recordOf(item.location).displayName);
  if (location !== undefined) event.location = location;

  if (isAllDay) {
    const startDate = dayOfNoon(start);
    const endDate = dayOfNoon(end);
    if (!startDate || !endDate) return null;
    event.allDay = true;
    event.startDate = startDate;
    event.endDate = endDate;
  } else {
    const startsAt = toUtcIso(start);
    const endsAt = toUtcIso(end);
    if (!startsAt || !endsAt) return null;
    event.startsAt = startsAt;
    event.endsAt = endsAt;
  }

  event.status = item.isCancelled === true ? "cancelled" : "confirmed";
  event.declined = recordOf(item.responseStatus).response === "declined";
  event.isPrivate =
    item.sensitivity === "private" || item.sensitivity === "confidential";
  event.isFree = item.showAs === "free";
  return event;
}

// Only title, place, times and repetition; always private; no guests, no
// description, no online meeting.
function outgoingBody(
  event: OutgoingEvent,
  isUpdate: boolean,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    subject: event.title,
    location: { displayName: event.location ?? "" },
    start: { dateTime: romeLocalDateTime(event.startsAt), timeZone: TIME_ZONE },
    end: { dateTime: romeLocalDateTime(event.endsAt), timeZone: TIME_ZONE },
    sensitivity: "private",
    isOnlineMeeting: false,
  };
  const recurrence = recurrenceOf(event);
  if (recurrence) body.recurrence = recurrence;
  else if (isUpdate) body.recurrence = null;
  return body;
}

function recurrenceOf(event: OutgoingEvent): Record<string, unknown> | null {
  const recurrence = event.recurrence;
  if (!recurrence) return null;
  const pattern =
    recurrence.frequency === "weekly"
      ? {
          type: "weekly",
          interval: 1,
          daysOfWeek: weeklyDays(recurrence.weekdays, event.startsAt).map(
            (d) => WEEKDAY_NAMES[d - 1],
          ),
          firstDayOfWeek: "monday",
        }
      : {
          type: "absoluteMonthly",
          interval: 1,
          dayOfMonth: romeDayOfMonth(event.startsAt),
        };
  const startDate = toDayKey(event.startsAt);
  const range = recurrence.until
    ? { type: "endDate", startDate, endDate: recurrence.until }
    : { type: "noEnd", startDate };
  return { pattern, range };
}
