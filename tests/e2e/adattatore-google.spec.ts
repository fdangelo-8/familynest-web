import { expect, test } from "@playwright/test";
import { createGoogleProvider } from "../../src/lib/calendar-sync/google-provider";
import {
  ProviderAuthError,
  ProviderTemporaryError,
  ProviderUnavailableError,
  type OutgoingEvent,
} from "../../src/lib/calendar-sync/types";
import {
  CLIENT_ID,
  NOW,
  createMock,
  idToken,
  type Reply,
} from "../fixtures/http-mock";

/*
 * Unit tests of the real Google adapter (#329). Node only, no page, no network:
 * the simulated `fetch` fails the test on any address it was not prepared for.
 */

const TOKEN = "https://oauth2.googleapis.com/token";
const REVOKE = "https://oauth2.googleapis.com/revoke";
const API = "https://www.googleapis.com/calendar/v3";
const SCOPE_ALL =
  "openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/calendar.calendarlist.readonly https://www.googleapis.com/auth/calendar.events";
const SECRET_TOKEN = "refresh-secret-123";
const SECRET_TITLE = "Dentista di Sofia";
const SECRET_CALENDAR = "Calendario segreto";
const TODAY = "2026-11-06";

function claims(extra: Record<string, unknown> = {}) {
  return {
    iss: "https://accounts.google.com",
    aud: CLIENT_ID,
    sub: "google-sub-1",
    email: "laura@example.com",
    exp: Math.floor(NOW.getTime() / 1000) + 3600,
    ...extra,
  };
}

function tokenReply(extra: Record<string, unknown> = {}): Reply {
  return {
    json: {
      access_token: "access-1",
      refresh_token: SECRET_TOKEN,
      scope: SCOPE_ALL,
      id_token: idToken(claims()),
      ...extra,
    },
  };
}

async function openSession(mock: ReturnType<typeof createMock>) {
  mock.on("POST", TOKEN, { json: { access_token: "access-1" } });
  const provider = createGoogleProvider(mock.options());
  return provider.openSession(SECRET_TOKEN);
}

const EVENTS_URL = `${API}/calendars/primary/events`;
const eventsRoute = new RegExp(`^${EVENTS_URL.replace(/[.]/g, "\\.")}\\?`);

function item(extra: Record<string, unknown> = {}) {
  return {
    id: "e1",
    etag: '"1"',
    status: "confirmed",
    summary: "Nuoto",
    start: { dateTime: "2026-11-10T17:00:00+01:00" },
    end: { dateTime: "2026-11-10T18:00:00+01:00" },
    ...extra,
  };
}

const WINDOW = {
  from: new Date("2026-10-07T00:00:00Z"),
  to: new Date("2027-11-06T00:00:00Z"),
};

const SINGLE: OutgoingEvent = {
  title: SECRET_TITLE,
  location: "Piscina",
  startsAt: "2026-11-10T16:00:00.000Z",
  endsAt: "2026-11-10T17:00:00.000Z",
  recurrence: null,
  isPrivate: true,
};

test.describe("adattatore Google", () => {
  test("CA-1: indirizzo di consenso", () => {
    const provider = createGoogleProvider(createMock().options());
    const url = new URL(
      provider.authorizationUrl({
        state: "S",
        codeChallenge: "C",
        redirectUri: "https://app.test/ritorno/google",
      }),
    );
    expect(url.origin + url.pathname).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth",
    );
    const p = url.searchParams;
    expect(p.get("state")).toBe("S");
    expect(p.get("code_challenge")).toBe("C");
    expect(p.get("redirect_uri")).toBe("https://app.test/ritorno/google");
    expect(p.get("code_challenge_method")).toBe("S256");
    expect(p.get("access_type")).toBe("offline");
    expect(p.get("prompt")).toBe("consent select_account");
    expect(p.get("response_type")).toBe("code");
    expect(p.get("client_id")).toBe(CLIENT_ID);
    expect(p.get("scope")).toBe(
      "openid email https://www.googleapis.com/auth/calendar.calendarlist.readonly https://www.googleapis.com/auth/calendar.events",
    );
    expect(p.has("include_granted_scopes")).toBe(false);
  });

  test("CA-3: scambio del codice", async () => {
    const mock = createMock();
    mock.on("POST", TOKEN, tokenReply());
    const result = await createGoogleProvider(mock.options()).exchangeCode({
      code: "CODE",
      codeVerifier: "VERIFIER",
      redirectUri: "https://app.test/r",
    });
    expect(result).toEqual({
      account: { id: "google-sub-1", email: "laura@example.com" },
      refreshToken: SECRET_TOKEN,
      calendarGranted: true,
    });
    const form = new URLSearchParams(mock.calls[0]?.body ?? "");
    expect(form.get("grant_type")).toBe("authorization_code");
    expect(form.get("code")).toBe("CODE");
    expect(form.get("code_verifier")).toBe("VERIFIER");
    expect(form.get("redirect_uri")).toBe("https://app.test/r");
    expect(form.get("client_id")).toBe(CLIENT_ID);
    mock.done();
  });

  test("CA-4: senza il permesso del calendario", async () => {
    const mock = createMock();
    mock.on("POST", TOKEN, tokenReply({ scope: "openid email" }));
    const result = await createGoogleProvider(mock.options()).exchangeCode({
      code: "c",
      codeVerifier: "v",
      redirectUri: "https://app.test/r",
    });
    expect(result.calendarGranted).toBe(false);
    mock.done();
  });

  for (const [name, extra] of [
    ["aud diverso", { aud: "other-client" }],
    ["mail non valida", { email: "no-at-sign" }],
    ["mail mancante", { email: undefined }],
    ["token scaduto", { exp: 1 }],
    ["emittente sconosciuto", { iss: "https://evil.test" }],
  ] as const) {
    test(`CA-5: ${name} dà ProviderAuthError`, async () => {
      const mock = createMock();
      mock.on("POST", TOKEN, tokenReply({ id_token: idToken(claims(extra)) }));
      await expect(
        createGoogleProvider(mock.options()).exchangeCode({
          code: "c",
          codeVerifier: "v",
          redirectUri: "https://app.test/r",
        }),
      ).rejects.toBeInstanceOf(ProviderAuthError);
      mock.done();
    });
  }

  test("CA-6: rinnovo rifiutato", async () => {
    for (const [error, expected] of [
      ["invalid_grant", ProviderAuthError],
      ["interaction_required", ProviderAuthError],
      ["invalid_client", ProviderUnavailableError],
      ["unauthorized_client", ProviderUnavailableError],
    ] as const) {
      const mock = createMock();
      mock.on("POST", TOKEN, { status: 400, json: { error } });
      await expect(
        createGoogleProvider(mock.options()).openSession(SECRET_TOKEN),
      ).rejects.toBeInstanceOf(expected);
      mock.done();
    }
  });

  test("CA-7: refresh token ruotato solo se nuovo", async () => {
    const mock = createMock();
    mock.on("POST", TOKEN, { json: { access_token: "a" } });
    const same = await createGoogleProvider(mock.options()).openSession(
      SECRET_TOKEN,
    );
    expect(same.rotatedRefreshToken).toBeNull();
    const rotating = createMock();
    rotating.on("POST", TOKEN, {
      json: { access_token: "a", refresh_token: "brand-new" },
    });
    const next = await createGoogleProvider(rotating.options()).openSession(
      SECRET_TOKEN,
    );
    expect(next.rotatedRefreshToken).toBe("brand-new");
  });

  test("CA-9: due pagine di calendari", async () => {
    const mock = createMock();
    const session = await openSession(mock);
    const list = `${API}/users/me/calendarList`;
    mock.on(
      "GET",
      new RegExp(`^${list.replace(/[.]/g, "\\.")}\\?(?!.*pageToken)`),
      {
        json: {
          nextPageToken: "P2",
          items: [
            {
              id: "me@example.com",
              summary: "Io",
              primary: true,
              accessRole: "owner",
            },
          ],
        },
      },
    );
    mock.on("GET", /calendarList\?.*pageToken=P2/, {
      json: {
        items: [
          {
            id: "a#b@group.calendar.google.com",
            summary: SECRET_CALENDAR,
            summaryOverride: "Famiglia",
            accessRole: "reader",
          },
        ],
      },
    });
    const calendars = await session.listCalendars();
    expect(calendars).toEqual([
      { id: "me@example.com", name: "Io", isPrimary: true, isReadOnly: false },
      {
        id: "a#b@group.calendar.google.com",
        name: "Famiglia",
        isPrimary: false,
        isReadOnly: true,
      },
    ]);
    expect(mock.calls[1]?.url).toContain("minAccessRole=reader");
    mock.done();
  });

  test("CA-10: lettura completa con più pagine", async () => {
    const mock = createMock();
    const session = await openSession(mock);
    mock.on(
      "GET",
      eventsRoute,
      { json: { nextPageToken: "P2", items: [item()] } },
      { json: { nextSyncToken: "SYNC1", items: [item({ id: "e2" })] } },
    );
    const page = await session.listEvents({ id: "primary" }, WINDOW, null);
    expect(page.full).toBe(true);
    expect(page.events.map((e) => e.id)).toEqual(["e1", "e2"]);
    expect(page.cursor).toBe(`g1.${TODAY}.SYNC1`);
    const first = new URL(mock.calls[1]?.url ?? "").searchParams;
    expect(first.get("timeMin")).toBe(WINDOW.from.toISOString());
    expect(first.get("timeMax")).toBe(WINDOW.to.toISOString());
    expect(first.get("singleEvents")).toBe("true");
    expect(first.has("syncToken")).toBe(false);
    mock.done();
  });

  test("CA-11: lettura incrementale con il syncToken", async () => {
    const mock = createMock();
    const session = await openSession(mock);
    mock.on("GET", eventsRoute, {
      json: { nextSyncToken: "SYNC2", items: [] },
    });
    const page = await session.listEvents(
      { id: "primary" },
      WINDOW,
      `g1.${TODAY}.SYNC1`,
    );
    expect(page).toEqual({
      events: [],
      full: false,
      cursor: `g1.${TODAY}.SYNC2`,
    });
    expect(mock.calls).toHaveLength(2);
    const params = new URL(mock.calls[1]?.url ?? "").searchParams;
    expect(params.get("syncToken")).toBe("SYNC1");
    expect(params.has("timeMin")).toBe(false);
    mock.done();
  });

  for (const cursor of [
    "g1.2026-11-05.SYNC1",
    "formato-sconosciuto",
    "g2.x.y",
  ]) {
    test(`CA-12: cursore «${cursor}» riparte dalla lettura completa`, async () => {
      const mock = createMock();
      const session = await openSession(mock);
      mock.on("GET", eventsRoute, { json: { nextSyncToken: "N", items: [] } });
      const page = await session.listEvents({ id: "primary" }, WINDOW, cursor);
      expect(page.full).toBe(true);
      expect(page.cursor).toBe(`g1.${TODAY}.N`);
      expect(mock.calls).toHaveLength(2);
      mock.done();
    });
  }

  test("CA-13: 410 sul cursore di oggi, poi lettura completa", async () => {
    const mock = createMock();
    const session = await openSession(mock);
    mock.on(
      "GET",
      eventsRoute,
      {
        status: 410,
        json: { error: { errors: [{ reason: "fullSyncRequired" }] } },
      },
      { json: { nextSyncToken: "N", items: [item()] } },
    );
    const page = await session.listEvents(
      { id: "primary" },
      WINDOW,
      `g1.${TODAY}.OLD`,
    );
    expect(page.full).toBe(true);
    expect(page.events).toHaveLength(1);
    mock.done();
  });

  test("CA-15: cancellazione non riconducibile a una volta", async () => {
    const mock = createMock();
    const session = await openSession(mock);
    mock.on(
      "GET",
      eventsRoute,
      {
        json: {
          nextSyncToken: "X",
          items: [{ id: "e1", status: "cancelled" }],
        },
      },
      { json: { nextSyncToken: "N", items: [item()] } },
    );
    const page = await session.listEvents(
      { id: "primary" },
      WINDOW,
      `g1.${TODAY}.S`,
    );
    expect(page.full).toBe(true);
    mock.done();
  });

  test("CA-15: cancellazione di una volta di una serie resta incrementale", async () => {
    const mock = createMock();
    const session = await openSession(mock);
    mock.on("GET", eventsRoute, {
      json: {
        nextSyncToken: "X",
        items: [
          {
            id: "e1_20261110",
            status: "cancelled",
            recurringEventId: "e1",
            originalStartTime: { dateTime: "2026-11-10T17:00:00+01:00" },
          },
        ],
      },
    });
    const page = await session.listEvents(
      { id: "primary" },
      WINDOW,
      `g1.${TODAY}.S`,
    );
    expect(page.full).toBe(false);
    expect(page.events).toEqual([
      { id: "e1", occurrenceKey: "2026-11-10T16:00:00.000Z", deleted: true },
    ]);
    mock.done();
  });

  test("CA-16: serie di 3 volte con una spostata", async () => {
    const mock = createMock();
    const session = await openSession(mock);
    const volta = (day: string, extra: Record<string, unknown> = {}) =>
      item({
        id: `s1_${day}`,
        recurringEventId: "s1",
        originalStartTime: { dateTime: `2026-11-${day}T17:00:00+01:00` },
        start: { dateTime: `2026-11-${day}T17:00:00+01:00` },
        end: { dateTime: `2026-11-${day}T18:00:00+01:00` },
        ...extra,
      });
    mock.on("GET", eventsRoute, {
      json: {
        nextSyncToken: "N",
        items: [
          volta("10"),
          volta("17", {
            start: { dateTime: "2026-11-17T19:00:00+01:00" },
            end: { dateTime: "2026-11-17T20:00:00+01:00" },
          }),
          volta("24"),
        ],
      },
    });
    const page = await session.listEvents({ id: "primary" }, WINDOW, null);
    expect(page.events.map((e) => e.id)).toEqual(["s1", "s1", "s1"]);
    expect(page.events.map((e) => e.occurrenceKey)).toEqual([
      "2026-11-10T16:00:00.000Z",
      "2026-11-17T16:00:00.000Z",
      "2026-11-24T16:00:00.000Z",
    ]);
    expect(page.events[1]?.startsAt).toBe("2026-11-17T18:00:00.000Z");
    mock.done();
  });

  test("CA-17: l'ora legale si converte in UTC", async () => {
    const mock = createMock();
    const session = await openSession(mock);
    mock.on("GET", eventsRoute, {
      json: {
        nextSyncToken: "N",
        items: [
          item({
            start: { dateTime: "2026-03-29T09:00:00+02:00" },
            end: { dateTime: "2026-03-29T10:00:00+02:00" },
          }),
        ],
      },
    });
    const page = await session.listEvents({ id: "primary" }, WINDOW, null);
    expect(page.events[0]?.startsAt).toBe("2026-03-29T07:00:00.000Z");
    mock.done();
  });

  test("CA-18: evento di tutto il giorno", async () => {
    const mock = createMock();
    const session = await openSession(mock);
    mock.on("GET", eventsRoute, {
      json: {
        nextSyncToken: "N",
        items: [
          item({ start: { date: "2026-11-10" }, end: { date: "2026-11-11" } }),
        ],
      },
    });
    const page = await session.listEvents({ id: "primary" }, WINDOW, null);
    expect(page.events[0]).toMatchObject({
      allDay: true,
      startDate: "2026-11-10",
      endDate: "2026-11-11",
    });
    expect(page.events[0]?.startsAt).toBeUndefined();
    mock.done();
  });

  test("CA-19: privato, libero, rifiutato; nessun dato in più", async () => {
    const mock = createMock();
    const session = await openSession(mock);
    mock.on("GET", eventsRoute, {
      json: {
        nextSyncToken: "N",
        items: [
          item({
            visibility: "private",
            transparency: "transparent",
            description: "descrizione-riservata",
            hangoutLink: "https://meet.example/link-riservato",
            organizer: { email: "capo@example.com" },
            attendees: [
              { email: "ospite@example.com", responseStatus: "accepted" },
              {
                email: "laura@example.com",
                self: true,
                responseStatus: "declined",
              },
            ],
          }),
        ],
      },
    });
    const page = await session.listEvents({ id: "primary" }, WINDOW, null);
    expect(page.events[0]).toMatchObject({
      isPrivate: true,
      isFree: true,
      declined: true,
    });
    const allowed = [
      "id",
      "occurrenceKey",
      "version",
      "title",
      "location",
      "startsAt",
      "endsAt",
      "allDay",
      "startDate",
      "endDate",
      "status",
      "declined",
      "isPrivate",
      "isFree",
      "deleted",
    ];
    for (const key of Object.keys(page.events[0] ?? {})) {
      expect(allowed).toContain(key);
    }
    const json = JSON.stringify(page);
    for (const secret of [
      "ospite@example.com",
      "laura@example.com",
      "descrizione-riservata",
      "link-riservato",
      "capo@example.com",
    ]) {
      expect(json).not.toContain(secret);
    }
    mock.done();
  });

  test("CA-20: creazione di un impegno singolo", async () => {
    const mock = createMock();
    const session = await openSession(mock);
    mock.on("POST", `${EVENTS_URL}?sendUpdates=none`, {
      json: { id: "new1", etag: '"7"' },
    });
    const created = await session.createEvent({ id: "primary" }, SINGLE);
    expect(created).toEqual({ id: "new1", version: '"7"' });
    const body = JSON.parse(mock.calls[1]?.body ?? "{}") as Record<
      string,
      unknown
    >;
    expect(Object.keys(body).sort()).toEqual(
      ["end", "location", "start", "summary", "visibility"].sort(),
    );
    expect(body.visibility).toBe("private");
    expect(body.summary).toBe(SECRET_TITLE);
    expect(body.start).toEqual({
      dateTime: "2026-11-10T17:00:00",
      timeZone: "Europe/Rome",
    });
    mock.done();
  });

  test("CA-21: settimanale lunedì e mercoledì con fine", async () => {
    const mock = createMock();
    const session = await openSession(mock);
    mock.on("POST", `${EVENTS_URL}?sendUpdates=none`, { json: { id: "s" } });
    await session.createEvent(
      { id: "primary" },
      {
        ...SINGLE,
        startsAt: "2026-11-09T16:00:00.000Z",
        endsAt: "2026-11-09T17:00:00.000Z",
        recurrence: {
          frequency: "weekly",
          weekdays: [3, 1],
          until: "2026-12-31",
        },
      },
    );
    const body = JSON.parse(mock.calls[1]?.body ?? "{}") as Record<
      string,
      unknown
    >;
    expect(body.recurrence).toEqual([
      "RRULE:FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20261231T225959Z",
    ]);
    expect(body.start).toEqual({
      dateTime: "2026-11-09T17:00:00",
      timeZone: "Europe/Rome",
    });
    mock.done();
  });

  test("CA-22: mensile senza fine", async () => {
    const mock = createMock();
    const session = await openSession(mock);
    mock.on("POST", `${EVENTS_URL}?sendUpdates=none`, { json: { id: "s" } });
    await session.createEvent(
      { id: "primary" },
      {
        ...SINGLE,
        recurrence: { frequency: "monthly", weekdays: null, until: null },
      },
    );
    const body = JSON.parse(mock.calls[1]?.body ?? "{}") as Record<
      string,
      unknown
    >;
    expect(body.recurrence).toEqual(["RRULE:FREQ=MONTHLY;BYMONTHDAY=10"]);
    mock.done();
  });

  test("CA-23: PATCH senza ripetizione", async () => {
    const mock = createMock();
    const session = await openSession(mock);
    mock.on("PATCH", `${EVENTS_URL}/e1?sendUpdates=none`, {
      json: { etag: '"8"' },
    });
    const updated = await session.updateEvent({ id: "primary" }, "e1", SINGLE);
    expect(updated).toEqual({ version: '"8"' });
    const body = JSON.parse(mock.calls[1]?.body ?? "{}") as Record<
      string,
      unknown
    >;
    expect(body.recurrence).toEqual([]);
    mock.done();
  });

  test("CA-24: cancellare con 404 e 410 è fatto", async () => {
    for (const status of [404, 410]) {
      const mock = createMock();
      const session = await openSession(mock);
      mock.on("DELETE", `${EVENTS_URL}/e1?sendUpdates=none`, { status });
      await session.deleteEvent({ id: "primary" }, "e1");
      mock.done();
    }
  });

  test("CA-25: gli id passano da encodeURIComponent", async () => {
    const mock = createMock();
    const session = await openSession(mock);
    const calendar = "a#b@group.calendar.google.com";
    const base = `${API}/calendars/${encodeURIComponent(calendar)}/events`;
    mock.on(
      "DELETE",
      `${base}/${encodeURIComponent("x/y+z")}?sendUpdates=none`,
      {
        status: 204,
      },
    );
    await session.deleteEvent({ id: calendar }, "x/y+z");
    expect(mock.calls[1]?.url).toContain("a%23b%40group.calendar.google.com");
    expect(mock.calls[1]?.url).toContain("x%2Fy%2Bz");
    mock.done();
  });

  test("CA-26: revoca", async () => {
    const mock = createMock();
    const provider = createGoogleProvider(mock.options());
    expect(provider.canRevoke).toBe(true);
    mock.on("POST", REVOKE, { status: 200, json: {} });
    await provider.revoke(SECRET_TOKEN);
    expect(mock.calls[0]?.method).toBe("POST");
    expect(mock.calls[0]?.url).toBe(REVOKE);
    expect(mock.calls[0]?.body).toBe(`token=${SECRET_TOKEN}`);

    const gone = createMock();
    gone.on("POST", REVOKE, { status: 400, json: { error: "invalid_token" } });
    await createGoogleProvider(gone.options()).revoke(SECRET_TOKEN);

    const down = createMock();
    down.on("POST", REVOKE, { status: 503 }, { status: 503 }, { status: 503 });
    await expect(
      createGoogleProvider(down.options()).revoke(SECRET_TOKEN),
    ).rejects.toBeInstanceOf(ProviderTemporaryError);
    expect(down.calls).toHaveLength(3);
  });

  test("CA-28: 401 poi 200 rinnova una volta; 401 dopo il rinnovo è un rifiuto", async () => {
    const mock = createMock();
    mock.on(
      "POST",
      TOKEN,
      { json: { access_token: "a1" } },
      { json: { access_token: "a2" } },
    );
    const session = await createGoogleProvider(mock.options()).openSession(
      SECRET_TOKEN,
    );
    mock.on("DELETE", /sendUpdates=none$/, { status: 401 }, { status: 204 });
    await session.deleteEvent({ id: "primary" }, "e1");
    expect(mock.calls.filter((c) => c.url === TOKEN)).toHaveLength(2);
    expect(mock.calls[3]?.headers.authorization).toBe("Bearer a2");
    mock.done();

    const refused = createMock();
    refused.on(
      "POST",
      TOKEN,
      { json: { access_token: "a1" } },
      { json: { access_token: "a2" } },
    );
    const second = await createGoogleProvider(refused.options()).openSession(
      SECRET_TOKEN,
    );
    refused.on("DELETE", /sendUpdates=none$/, { status: 401 }, { status: 401 });
    await expect(
      second.deleteEvent({ id: "primary" }, "e1"),
    ).rejects.toBeInstanceOf(ProviderAuthError);
  });

  test("CA-29: 429 con Retry-After e tentativi", async () => {
    const mock = createMock();
    const session = await openSession(mock);
    mock.on(
      "GET",
      eventsRoute,
      { status: 429, headers: { "Retry-After": "3" } },
      { json: { nextSyncToken: "N", items: [] } },
    );
    await session.listEvents({ id: "primary" }, WINDOW, null);
    expect(mock.sleeps).toEqual([3000]);
    mock.done();

    const three = createMock();
    const s3 = await openSession(three);
    three.on(
      "GET",
      eventsRoute,
      { status: 429 },
      { status: 429 },
      { status: 429 },
    );
    await expect(
      s3.listEvents({ id: "primary" }, WINDOW, null),
    ).rejects.toBeInstanceOf(ProviderTemporaryError);
    expect(three.calls.filter((c) => c.method === "GET")).toHaveLength(3);
    expect(three.sleeps).toEqual([1000, 2000]);

    const long = createMock();
    const sl = await openSession(long);
    long.on(
      "GET",
      eventsRoute,
      { status: 429, headers: { "Retry-After": "120" } },
      { json: { nextSyncToken: "N", items: [] } },
    );
    await sl.listEvents({ id: "primary" }, WINDOW, null);
    expect(long.sleeps).toEqual([10_000]);
  });

  test("CA-30: la creazione non si ripete dopo un 500 o una rete caduta", async () => {
    for (const reply of [{ status: 500 }, { networkError: true }] as Reply[]) {
      const mock = createMock();
      const session = await openSession(mock);
      mock.on("POST", `${EVENTS_URL}?sendUpdates=none`, reply);
      await expect(
        session.createEvent({ id: "primary" }, SINGLE),
      ).rejects.toBeInstanceOf(ProviderTemporaryError);
      expect(mock.calls.filter((c) => c.url.includes("/events"))).toHaveLength(
        1,
      );
      mock.done();
    }
  });

  test("lettura: una rete caduta si ripete una volta", async () => {
    const mock = createMock();
    const session = await openSession(mock);
    mock.on("GET", eventsRoute, { networkError: true }, { networkError: true });
    await expect(
      session.listEvents({ id: "primary" }, WINDOW, null),
    ).rejects.toBeInstanceOf(ProviderTemporaryError);
    expect(mock.calls.filter((c) => c.method === "GET")).toHaveLength(2);
  });

  test("CA-31: 403 per permesso o per quota", async () => {
    const mock = createMock();
    const session = await openSession(mock);
    mock.on("GET", eventsRoute, {
      status: 403,
      json: { error: { errors: [{ reason: "insufficientPermissions" }] } },
    });
    await expect(
      session.listEvents({ id: "primary" }, WINDOW, null),
    ).rejects.toBeInstanceOf(ProviderAuthError);

    const quota = createMock();
    const sq = await openSession(quota);
    quota.on(
      "GET",
      eventsRoute,
      {
        status: 403,
        json: { error: { errors: [{ reason: "userRateLimitExceeded" }] } },
      },
      { json: { nextSyncToken: "N", items: [] } },
    );
    await sq.listEvents({ id: "primary" }, WINDOW, null);
    expect(quota.sleeps).toEqual([1000]);
    quota.done();
  });

  test("CA-32: gli errori non contengono dati personali", async () => {
    const mock = createMock();
    const session = await openSession(mock);
    const leaky = {
      error: {
        message: `${SECRET_TOKEN} ${SECRET_TITLE} ${SECRET_CALENDAR} laura@example.com CODE-9`,
      },
    };
    mock.on("POST", `${EVENTS_URL}?sendUpdates=none`, {
      status: 400,
      json: leaky,
    });
    mock.on(
      "GET",
      eventsRoute,
      { status: 500, json: leaky },
      { status: 500, json: leaky },
      { status: 500, json: leaky },
    );
    mock.on(
      "POST",
      REVOKE,
      { status: 503, json: leaky },
      { status: 503, json: leaky },
      { status: 503, json: leaky },
    );
    const errors: unknown[] = [];
    for (const run of [
      () => session.createEvent({ id: "primary" }, SINGLE),
      () => session.listEvents({ id: "primary" }, WINDOW, null),
      () => createGoogleProvider(mock.options()).revoke(SECRET_TOKEN),
    ]) {
      try {
        await run();
      } catch (caught) {
        errors.push(caught);
      }
    }
    expect(errors).toHaveLength(3);
    for (const error of errors) {
      const text = `${String(error)} ${(error as Error).message}`;
      for (const secret of [
        SECRET_TOKEN,
        SECRET_TITLE,
        SECRET_CALENDAR,
        "laura@example.com",
        "CODE-9",
      ]) {
        expect(text).not.toContain(secret);
      }
    }
  });
});
