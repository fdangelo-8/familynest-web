import { expect, test } from "@playwright/test";
import { createOutlookProvider } from "../../src/lib/calendar-sync/outlook-provider";
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
 * Unit tests of the real Outlook adapter (#329). Node only, no page, no
 * network: the simulated `fetch` fails the test on any unprepared address.
 */

const TOKEN = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const GRAPH = "https://graph.microsoft.com/v1.0";
const CALENDARS_PROBE = `${GRAPH}/me/calendars?$top=1&$select=id`;
const SECRET_TOKEN = "refresh-secret-456";
const SECRET_TITLE = "Riunione scuola";
const SECRET_CALENDAR = "Calendario riservato";
const TODAY = "2026-11-06";
const TID = "tenant-1";

function claims(extra: Record<string, unknown> = {}) {
  return {
    iss: `https://login.microsoftonline.com/${TID}/v2.0`,
    aud: CLIENT_ID,
    tid: TID,
    oid: "object-1",
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
      scope: "openid profile email Calendars.ReadWrite",
      id_token: idToken(claims()),
      ...extra,
    },
  };
}

const EXCHANGE = {
  code: "CODE",
  codeVerifier: "VERIFIER",
  redirectUri: "https://app.test/r",
};

async function openSession(mock: ReturnType<typeof createMock>) {
  mock.on("POST", TOKEN, { json: { access_token: "access-1" } });
  return createOutlookProvider(mock.options()).openSession(SECRET_TOKEN);
}

const DELTA = /\/me\/calendars\/primary\/calendarView\/delta\?startDateTime=/;
const DELTA_LINK = "https://graph.microsoft.com/v1.0/delta?token=D1";

function item(extra: Record<string, unknown> = {}) {
  return {
    id: "e1",
    changeKey: "ck1",
    type: "singleInstance",
    subject: "Nuoto",
    start: { dateTime: "2026-11-10T16:00:00.0000000", timeZone: "UTC" },
    end: { dateTime: "2026-11-10T17:00:00.0000000", timeZone: "UTC" },
    ...extra,
  };
}

const WINDOW = {
  from: new Date("2026-10-07T00:00:00Z"),
  to: new Date("2027-11-06T00:00:00Z"),
};

const SINGLE: OutgoingEvent = {
  title: SECRET_TITLE,
  location: "Scuola",
  startsAt: "2026-11-10T16:00:00.000Z",
  endsAt: "2026-11-10T17:00:00.000Z",
  recurrence: null,
  isPrivate: true,
};

test.describe("adattatore Outlook", () => {
  test("CA-2: indirizzo di consenso", () => {
    const url = new URL(
      createOutlookProvider(createMock().options()).authorizationUrl({
        state: "S",
        codeChallenge: "C",
        redirectUri: "https://app.test/ritorno/outlook",
      }),
    );
    expect(url.origin + url.pathname).toBe(
      "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    );
    const p = url.searchParams;
    expect(p.get("state")).toBe("S");
    expect(p.get("code_challenge")).toBe("C");
    expect(p.get("code_challenge_method")).toBe("S256");
    expect(p.get("scope")).toBe(
      "openid profile email offline_access Calendars.ReadWrite",
    );
    expect(p.get("response_mode")).toBe("query");
    expect(p.get("prompt")).toBe("select_account");
  });

  test("CA-3: scambio del codice, id tid.oid e mail", async () => {
    const mock = createMock();
    mock.on("POST", TOKEN, tokenReply());
    mock.on("GET", CALENDARS_PROBE, { json: { value: [] } });
    const result = await createOutlookProvider(mock.options()).exchangeCode(
      EXCHANGE,
    );
    expect(result).toEqual({
      account: { id: "tenant-1.object-1", email: "laura@example.com" },
      refreshToken: SECRET_TOKEN,
      calendarGranted: true,
    });
    const form = new URLSearchParams(mock.calls[0]?.body ?? "");
    expect(form.get("grant_type")).toBe("authorization_code");
    expect(form.get("code_verifier")).toBe("VERIFIER");
    expect(form.get("redirect_uri")).toBe("https://app.test/r");
    mock.done();
  });

  test("CA-3: senza email si usa preferred_username", async () => {
    const mock = createMock();
    mock.on(
      "POST",
      TOKEN,
      tokenReply({
        id_token: idToken(
          claims({ email: undefined, preferred_username: "anna@example.com" }),
        ),
      }),
    );
    mock.on("GET", CALENDARS_PROBE, { json: { value: [] } });
    const result = await createOutlookProvider(mock.options()).exchangeCode(
      EXCHANGE,
    );
    expect(result.account.email).toBe("anna@example.com");
  });

  test("CA-4: permesso mancante o casella senza calendario", async () => {
    const noScope = createMock();
    noScope.on("POST", TOKEN, tokenReply({ scope: "openid profile email" }));
    const first = await createOutlookProvider(noScope.options()).exchangeCode(
      EXCHANGE,
    );
    expect(first.calendarGranted).toBe(false);
    noScope.done();

    const noMailbox = createMock();
    noMailbox.on("POST", TOKEN, tokenReply());
    noMailbox.on("GET", CALENDARS_PROBE, {
      status: 403,
      json: { error: { code: "MailboxNotEnabledForRESTAPI" } },
    });
    const second = await createOutlookProvider(
      noMailbox.options(),
    ).exchangeCode(EXCHANGE);
    expect(second.calendarGranted).toBe(false);
    noMailbox.done();
  });

  for (const [name, extra] of [
    ["aud diverso", { aud: "other" }],
    ["mail non valida", { email: "senza-chiocciola" }],
    [
      "emittente di un altro tenant",
      { iss: "https://login.microsoftonline.com/x/v2.0" },
    ],
    ["oid mancante", { oid: undefined }],
  ] as const) {
    test(`CA-5: ${name} dà ProviderAuthError`, async () => {
      const mock = createMock();
      mock.on("POST", TOKEN, tokenReply({ id_token: idToken(claims(extra)) }));
      await expect(
        createOutlookProvider(mock.options()).exchangeCode(EXCHANGE),
      ).rejects.toBeInstanceOf(ProviderAuthError);
      mock.done();
    });
  }

  test("CA-6: rinnovo rifiutato", async () => {
    for (const [error, expected] of [
      ["invalid_grant", ProviderAuthError],
      ["consent_required", ProviderAuthError],
      ["invalid_client", ProviderUnavailableError],
    ] as const) {
      const mock = createMock();
      mock.on("POST", TOKEN, { status: 400, json: { error } });
      await expect(
        createOutlookProvider(mock.options()).openSession(SECRET_TOKEN),
      ).rejects.toBeInstanceOf(expected);
    }
  });

  test("CA-7: il refresh token nuovo è in rotatedRefreshToken", async () => {
    const mock = createMock();
    mock.on("POST", TOKEN, {
      json: { access_token: "a", refresh_token: "brand-new" },
    });
    const session = await createOutlookProvider(mock.options()).openSession(
      SECRET_TOKEN,
    );
    expect(session.rotatedRefreshToken).toBe("brand-new");
    const same = createMock();
    same.on("POST", TOKEN, {
      json: { access_token: "a", refresh_token: SECRET_TOKEN },
    });
    const unchanged = await createOutlookProvider(same.options()).openSession(
      SECRET_TOKEN,
    );
    expect(unchanged.rotatedRefreshToken).toBeNull();
  });

  test("CA-9: due pagine di calendari", async () => {
    const mock = createMock();
    const session = await openSession(mock);
    const second = `${GRAPH}/me/calendars?$skip=100`;
    mock.on(
      "GET",
      `${GRAPH}/me/calendars?$select=id,name,canEdit,isDefaultCalendar&$top=100`,
      {
        json: {
          "@odata.nextLink": second,
          value: [
            {
              id: "c1",
              name: "Calendario",
              canEdit: true,
              isDefaultCalendar: true,
            },
          ],
        },
      },
    );
    mock.on("GET", second, {
      json: { value: [{ id: "c2", name: SECRET_CALENDAR, canEdit: false }] },
    });
    expect(await session.listCalendars()).toEqual([
      { id: "c1", name: "Calendario", isPrimary: true, isReadOnly: false },
      { id: "c2", name: SECRET_CALENDAR, isPrimary: false, isReadOnly: true },
    ]);
    mock.done();
  });

  test("CA-10: lettura completa fino al deltaLink", async () => {
    const mock = createMock();
    const session = await openSession(mock);
    const next = `${GRAPH}/me/calendars/primary/calendarView/delta?$skiptoken=P2`;
    mock.on("GET", DELTA, {
      json: { "@odata.nextLink": next, value: [item()] },
    });
    mock.on("GET", next, {
      json: { "@odata.deltaLink": DELTA_LINK, value: [item({ id: "e2" })] },
    });
    const page = await session.listEvents({ id: "primary" }, WINDOW, null);
    expect(page.full).toBe(true);
    expect(page.events.map((e) => e.id)).toEqual(["e1", "e2"]);
    expect(page.cursor).toBe(`m1.${TODAY}.${DELTA_LINK}`);
    const url = mock.calls[1]?.url ?? "";
    expect(url).toContain(
      `startDateTime=${encodeURIComponent(WINDOW.from.toISOString())}`,
    );
    expect(url).toContain(
      `endDateTime=${encodeURIComponent(WINDOW.to.toISOString())}`,
    );
    expect(mock.calls[1]?.headers.prefer).toContain('outlook.timezone="UTC"');
    mock.done();
  });

  test("CA-11: lettura incrementale con il deltaLink", async () => {
    const mock = createMock();
    const session = await openSession(mock);
    mock.on("GET", DELTA_LINK, {
      json: { "@odata.deltaLink": `${DELTA_LINK}2`, value: [] },
    });
    const page = await session.listEvents(
      { id: "primary" },
      WINDOW,
      `m1.${TODAY}.${DELTA_LINK}`,
    );
    expect(page).toEqual({
      events: [],
      full: false,
      cursor: `m1.${TODAY}.${DELTA_LINK}2`,
    });
    expect(mock.calls).toHaveLength(2);
    mock.done();
  });

  for (const cursor of [`m1.2026-11-05.${DELTA_LINK}`, "formato-sconosciuto"]) {
    test(`CA-12: cursore «${cursor.slice(0, 12)}» riparte dalla lettura completa`, async () => {
      const mock = createMock();
      const session = await openSession(mock);
      mock.on("GET", DELTA, {
        json: { "@odata.deltaLink": DELTA_LINK, value: [] },
      });
      const page = await session.listEvents({ id: "primary" }, WINDOW, cursor);
      expect(page.full).toBe(true);
      mock.done();
    });
  }

  test("CA-13: 410 sul cursore di oggi, poi lettura completa", async () => {
    const mock = createMock();
    const session = await openSession(mock);
    mock.on("GET", DELTA_LINK, {
      status: 410,
      json: { error: { code: "syncStateNotFound" } },
    });
    mock.on("GET", DELTA, {
      json: { "@odata.deltaLink": DELTA_LINK, value: [item()] },
    });
    const page = await session.listEvents(
      { id: "primary" },
      WINDOW,
      `m1.${TODAY}.${DELTA_LINK}`,
    );
    expect(page.full).toBe(true);
    mock.done();
  });

  test("CA-14: un deltaLink di un altro host non si chiama", async () => {
    const mock = createMock();
    const session = await openSession(mock);
    mock.on("GET", DELTA, {
      json: { "@odata.deltaLink": DELTA_LINK, value: [] },
    });
    const page = await session.listEvents(
      { id: "primary" },
      WINDOW,
      `m1.${TODAY}.https://evil.example/delta?token=x`,
    );
    expect(page.full).toBe(true);
    expect(mock.calls.some((c) => c.url.includes("evil.example"))).toBe(false);
    mock.done();
  });

  test("CA-15: @removed in lettura incrementale, poi lettura completa", async () => {
    const mock = createMock();
    const session = await openSession(mock);
    mock.on("GET", DELTA_LINK, {
      json: {
        "@odata.deltaLink": DELTA_LINK,
        value: [{ id: "e1", "@removed": { reason: "deleted" } }],
      },
    });
    mock.on("GET", DELTA, {
      json: { "@odata.deltaLink": DELTA_LINK, value: [item()] },
    });
    const page = await session.listEvents(
      { id: "primary" },
      WINDOW,
      `m1.${TODAY}.${DELTA_LINK}`,
    );
    expect(page.full).toBe(true);
    mock.done();
  });

  test("CA-16: serie di 3 volte con una spostata", async () => {
    const mock = createMock();
    const session = await openSession(mock);
    const volta = (day: string, hour = "16", type = "occurrence") =>
      item({
        id: `occ-${day}`,
        seriesMasterId: "series-1",
        type,
        originalStart: `2026-11-${day}T16:00:00Z`,
        start: { dateTime: `2026-11-${day}T${hour}:00:00.0000000` },
        end: { dateTime: `2026-11-${day}T${Number(hour) + 1}:00:00.0000000` },
      });
    mock.on("GET", DELTA, {
      json: {
        "@odata.deltaLink": DELTA_LINK,
        value: [
          { id: "series-1", type: "seriesMaster", subject: "master" },
          volta("10"),
          volta("17", "18", "exception"),
          volta("24"),
        ],
      },
    });
    const page = await session.listEvents({ id: "primary" }, WINDOW, null);
    expect(page.events.map((e) => e.id)).toEqual([
      "series-1",
      "series-1",
      "series-1",
    ]);
    expect(page.events.map((e) => e.occurrenceKey)).toEqual([
      "2026-11-10T16:00:00.000Z",
      "2026-11-17T16:00:00.000Z",
      "2026-11-24T16:00:00.000Z",
    ]);
    expect(page.events[1]?.startsAt).toBe("2026-11-17T18:00:00.000Z");
    mock.done();
  });

  test("CA-17: 07:00 UTC resta 07:00 UTC", async () => {
    const mock = createMock();
    const session = await openSession(mock);
    mock.on("GET", DELTA, {
      json: {
        "@odata.deltaLink": DELTA_LINK,
        value: [
          item({
            start: { dateTime: "2026-03-29T07:00:00.0000000" },
            end: { dateTime: "2026-03-29T08:00:00.0000000" },
          }),
        ],
      },
    });
    const page = await session.listEvents({ id: "primary" }, WINDOW, null);
    expect(page.events[0]?.startsAt).toBe("2026-03-29T07:00:00.000Z");
  });

  test("CA-18: evento di tutto il giorno", async () => {
    const mock = createMock();
    const session = await openSession(mock);
    mock.on("GET", DELTA, {
      json: {
        "@odata.deltaLink": DELTA_LINK,
        value: [
          item({
            isAllDay: true,
            start: { dateTime: "2026-11-09T23:00:00.0000000" },
            end: { dateTime: "2026-11-10T23:00:00.0000000" },
          }),
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
  });

  test("CA-19: privato, libero, rifiutato; nessun dato in più", async () => {
    const mock = createMock();
    const session = await openSession(mock);
    mock.on("GET", DELTA, {
      json: {
        "@odata.deltaLink": DELTA_LINK,
        value: [
          item({
            sensitivity: "private",
            showAs: "free",
            responseStatus: { response: "declined" },
            body: { content: "descrizione-riservata" },
            attendees: [{ emailAddress: { address: "ospite@example.com" } }],
            onlineMeeting: { joinUrl: "https://teams.example/link-riservato" },
            organizer: { emailAddress: { address: "capo@example.com" } },
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
      "descrizione-riservata",
      "link-riservato",
      "capo@example.com",
    ]) {
      expect(json).not.toContain(secret);
    }
  });

  test("CA-20: creazione di un impegno singolo", async () => {
    const mock = createMock();
    const session = await openSession(mock);
    mock.on("POST", `${GRAPH}/me/calendars/primary/events`, {
      json: { id: "new1", changeKey: "ck9" },
    });
    expect(await session.createEvent({ id: "primary" }, SINGLE)).toEqual({
      id: "new1",
      version: "ck9",
    });
    const body = JSON.parse(mock.calls[1]?.body ?? "{}") as Record<
      string,
      unknown
    >;
    expect(Object.keys(body).sort()).toEqual(
      [
        "end",
        "isOnlineMeeting",
        "location",
        "sensitivity",
        "start",
        "subject",
      ].sort(),
    );
    expect(body.sensitivity).toBe("private");
    expect(body.isOnlineMeeting).toBe(false);
    mock.done();
  });

  test("CA-21: settimanale lunedì e mercoledì con fine", async () => {
    const mock = createMock();
    const session = await openSession(mock);
    mock.on("POST", `${GRAPH}/me/calendars/primary/events`, {
      json: { id: "s" },
    });
    await session.createEvent(
      { id: "primary" },
      {
        ...SINGLE,
        startsAt: "2026-11-09T16:00:00.000Z",
        endsAt: "2026-11-09T17:00:00.000Z",
        recurrence: {
          frequency: "weekly",
          weekdays: [1, 3],
          until: "2026-12-31",
        },
      },
    );
    const body = JSON.parse(mock.calls[1]?.body ?? "{}") as Record<
      string,
      unknown
    >;
    expect(body.recurrence).toEqual({
      pattern: {
        type: "weekly",
        interval: 1,
        daysOfWeek: ["monday", "wednesday"],
        firstDayOfWeek: "monday",
      },
      range: {
        type: "endDate",
        startDate: "2026-11-09",
        endDate: "2026-12-31",
      },
    });
    expect(body.start).toEqual({
      dateTime: "2026-11-09T17:00:00",
      timeZone: "W. Europe Standard Time",
    });
    mock.done();
  });

  test("CA-22: mensile senza fine", async () => {
    const mock = createMock();
    const session = await openSession(mock);
    mock.on("POST", `${GRAPH}/me/calendars/primary/events`, {
      json: { id: "s" },
    });
    await session.createEvent(
      { id: "primary" },
      {
        ...SINGLE,
        recurrence: { frequency: "monthly", weekdays: null, until: null },
      },
    );
    const body = JSON.parse(mock.calls[1]?.body ?? "{}") as {
      recurrence: Record<string, unknown>;
    };
    expect(body.recurrence.pattern).toEqual({
      type: "absoluteMonthly",
      interval: 1,
      dayOfMonth: 10,
    });
    expect(body.recurrence.range).toEqual({
      type: "noEnd",
      startDate: "2026-11-10",
    });
  });

  test("CA-23: PATCH senza ripetizione", async () => {
    const mock = createMock();
    const session = await openSession(mock);
    mock.on("PATCH", `${GRAPH}/me/events/e1`, { json: { changeKey: "ck10" } });
    expect(await session.updateEvent({ id: "primary" }, "e1", SINGLE)).toEqual({
      version: "ck10",
    });
    const body = JSON.parse(mock.calls[1]?.body ?? "{}") as Record<
      string,
      unknown
    >;
    expect(body.recurrence).toBeNull();
    mock.done();
  });

  test("CA-24: cancellare con 404 e 410 è fatto", async () => {
    for (const status of [404, 410]) {
      const mock = createMock();
      const session = await openSession(mock);
      mock.on("DELETE", `${GRAPH}/me/events/e1`, { status });
      await session.deleteEvent({ id: "primary" }, "e1");
      mock.done();
    }
  });

  test("CA-25: gli id passano da encodeURIComponent", async () => {
    const mock = createMock();
    const session = await openSession(mock);
    mock.on("DELETE", `${GRAPH}/me/events/x%2Fy%2Bz`, { status: 204 });
    await session.deleteEvent({ id: "a#b@c" }, "x/y+z");
    mock.on("POST", `${GRAPH}/me/calendars/a%23b%40c/events`, {
      json: { id: "n" },
    });
    await session.createEvent({ id: "a#b@c" }, SINGLE);
    mock.done();
  });

  test("CA-27: nessuna revoca", async () => {
    const mock = createMock();
    const provider = createOutlookProvider(mock.options());
    expect(provider.canRevoke).toBe(false);
    await provider.revoke(SECRET_TOKEN);
    expect(mock.calls).toHaveLength(0);
  });

  test("CA-28: 401 poi 200 rinnova una volta; 401 dopo il rinnovo è un rifiuto", async () => {
    const mock = createMock();
    mock.on(
      "POST",
      TOKEN,
      { json: { access_token: "a1" } },
      { json: { access_token: "a2" } },
    );
    const session = await createOutlookProvider(mock.options()).openSession(
      SECRET_TOKEN,
    );
    mock.on(
      "DELETE",
      `${GRAPH}/me/events/e1`,
      { status: 401 },
      { status: 204 },
    );
    await session.deleteEvent({ id: "primary" }, "e1");
    expect(mock.calls.filter((c) => c.url === TOKEN)).toHaveLength(2);
    mock.done();

    const refused = createMock();
    refused.on(
      "POST",
      TOKEN,
      { json: { access_token: "a1" } },
      { json: { access_token: "a2" } },
    );
    const second = await createOutlookProvider(refused.options()).openSession(
      SECRET_TOKEN,
    );
    refused.on(
      "DELETE",
      `${GRAPH}/me/events/e1`,
      { status: 401 },
      { status: 401 },
    );
    await expect(
      second.deleteEvent({ id: "primary" }, "e1"),
    ).rejects.toBeInstanceOf(ProviderAuthError);
  });

  test("CA-29: 429 con Retry-After e tentativi", async () => {
    const mock = createMock();
    const session = await openSession(mock);
    mock.on(
      "GET",
      DELTA,
      { status: 429, headers: { "Retry-After": "3" } },
      { json: { "@odata.deltaLink": DELTA_LINK, value: [] } },
    );
    await session.listEvents({ id: "primary" }, WINDOW, null);
    expect(mock.sleeps).toEqual([3000]);

    const three = createMock();
    const s3 = await openSession(three);
    three.on("GET", DELTA, { status: 429 }, { status: 429 }, { status: 429 });
    await expect(
      s3.listEvents({ id: "primary" }, WINDOW, null),
    ).rejects.toBeInstanceOf(ProviderTemporaryError);
    expect(three.calls.filter((c) => c.method === "GET")).toHaveLength(3);

    const long = createMock();
    const sl = await openSession(long);
    long.on(
      "GET",
      DELTA,
      { status: 429, headers: { "Retry-After": "120" } },
      { json: { "@odata.deltaLink": DELTA_LINK, value: [] } },
    );
    await sl.listEvents({ id: "primary" }, WINDOW, null);
    expect(long.sleeps).toEqual([10_000]);
  });

  test("CA-30: la creazione non si ripete dopo un 500 o una rete caduta", async () => {
    for (const reply of [{ status: 500 }, { networkError: true }] as Reply[]) {
      const mock = createMock();
      const session = await openSession(mock);
      mock.on("POST", `${GRAPH}/me/calendars/primary/events`, reply);
      await expect(
        session.createEvent({ id: "primary" }, SINGLE),
      ).rejects.toBeInstanceOf(ProviderTemporaryError);
      expect(mock.calls.filter((c) => c.url.includes("/events"))).toHaveLength(
        1,
      );
    }
  });

  test("403 ErrorAccessDenied dà ProviderAuthError", async () => {
    const mock = createMock();
    const session = await openSession(mock);
    mock.on("GET", DELTA, {
      status: 403,
      json: { error: { code: "ErrorAccessDenied" } },
    });
    await expect(
      session.listEvents({ id: "primary" }, WINDOW, null),
    ).rejects.toBeInstanceOf(ProviderAuthError);
  });

  test("CA-32: gli errori non contengono dati personali", async () => {
    const mock = createMock();
    const session = await openSession(mock);
    const leaky = {
      error: {
        message: `${SECRET_TOKEN} ${SECRET_TITLE} ${SECRET_CALENDAR} laura@example.com CODE-9`,
      },
    };
    mock.on("POST", `${GRAPH}/me/calendars/primary/events`, {
      status: 400,
      json: leaky,
    });
    mock.on(
      "GET",
      DELTA,
      { status: 500, json: leaky },
      { status: 500, json: leaky },
      { status: 500, json: leaky },
    );
    mock.on("POST", TOKEN, {
      status: 400,
      json: { error: "invalid_grant", error_description: leaky.error.message },
    });
    const errors: unknown[] = [];
    for (const run of [
      () => session.createEvent({ id: "primary" }, SINGLE),
      () => session.listEvents({ id: "primary" }, WINDOW, null),
      () => createOutlookProvider(mock.options()).openSession(SECRET_TOKEN),
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
