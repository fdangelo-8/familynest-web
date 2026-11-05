import { expect, type Page, type Route } from "@playwright/test";

// A fake of the endpoints the Notifiche page (#39) reads and writes in the
// browser, for its visual and accessibility tests: the notifications, the
// summary of the morning (events, things to do, preferences), the occurrence
// of a changed event and the two writes («Fatto», «Segna tutte»). Nothing is
// written to the database and the shots do not depend on what other suites do
// in the same Nest.
//
// Sign-in, the Nest and its members (Marco, Laura, Sofia, Tommaso, Biscotto)
// are real: the ids of the members are read from the real response and used
// in the fake rows. "Now" is Tuesday 20 October 2026, 15:52 (Rome), like the
// mockup (24-notifiche.html and 09-oggi.html): the call at 16:00 comes first
// in the summary.

export const NOTIFICHE_NOW = new Date("2026-10-20T15:52:00+02:00");

export type NotificheScenario =
  /** Mockup «normale»: today unread, yesterday read */
  | "normale"
  /** Mockup «vuoto»: nothing in the last 30 days */
  | "vuoto";

export type NotificheFakeOptions = {
  scenario?: NotificheScenario;
  /** "on": the summary is there; "off": the switch is off; "error": it fails alone */
  digest?: "on" | "off" | "error";
  /** "slow": the list waits until release() is called; "error": it fails */
  list?: "ok" | "slow" | "error";
  /** What the update of «Fatto» finds */
  todo?: "ok" | "already" | "gone" | "error";
};

export type NotificheFake = {
  /** Lets the held list (list: "slow") through */
  release: () => void;
  /** Makes the next marking as read (not the one of the opening) fail */
  failMarking: () => void;
  /** Ids sent to `mark_notifications_read`, one array per call */
  marked: () => string[][];
};

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
  "access-control-expose-headers": "*",
};

function json(route: Route, status: number, body: unknown) {
  return route.fulfill({
    status,
    contentType: "application/json",
    headers: CORS,
    body: JSON.stringify(body),
  });
}

function uuid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

type Member = { id: string; name: string; color: string };

const rome = (value: string) => new Date(`${value}:00+02:00`).toISOString();

type FakeEvent = {
  title: string;
  from: string;
  to: string;
  visibility?: "private" | "busy" | "household";
  author?: string;
  who: string[];
  location?: string | null;
  masked?: boolean;
};

// Same day as the mockup: the call at 16:00, the dinner at 19:30 and the
// «Occupato» of Laura that leave Friday free from 18:00 (and tonight from 21:30).
const EVENTS: FakeEvent[] = [
  {
    title: "Palestra",
    from: "2026-10-20T07:00",
    to: "2026-10-20T08:00",
    author: "Marco",
    who: ["Marco"],
  },
  // Laura is busy until the dinner: the first window of tonight is 21:30.
  {
    title: "",
    from: "2026-10-20T17:00",
    to: "2026-10-20T19:30",
    visibility: "busy",
    author: "Laura",
    who: [],
    masked: true,
  },
  {
    title: "Call con Acme",
    from: "2026-10-20T16:00",
    to: "2026-10-20T17:00",
    visibility: "busy",
    author: "Marco",
    who: ["Marco"],
    location: "Teams",
  },
  {
    title: "Cena dai nonni",
    from: "2026-10-20T19:30",
    to: "2026-10-20T21:30",
    author: "Marco",
    who: ["Marco", "Laura", "Sofia", "Tommaso"],
    location: "Monza",
  },
  {
    title: "",
    from: "2026-10-21T17:00",
    to: "2026-10-21T23:00",
    visibility: "busy",
    author: "Laura",
    who: [],
    masked: true,
  },
  {
    title: "",
    from: "2026-10-22T17:00",
    to: "2026-10-22T20:30",
    visibility: "busy",
    author: "Laura",
    who: [],
    masked: true,
  },
];

export async function installNotificheFake(
  page: Page,
  options: NotificheFakeOptions = {},
): Promise<NotificheFake> {
  const scenario = options.scenario ?? "normale";
  const digestMode = options.digest ?? "on";
  const listMode = options.list ?? "ok";
  const todoMode = options.todo ?? "ok";

  let members: Member[] = [];
  let resolveMembers: () => void = () => {};
  const membersReady = new Promise<void>((resolve) => {
    resolveMembers = resolve;
  });
  let release: () => void = () => {};
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  const marked: string[][] = [];
  let failNext = false;

  const memberOf = (name: string): Member => {
    const found = members.find((m) => m.name === name);
    if (!found) throw new Error(`member ${name} not found in the Nest`);
    return found;
  };
  const idOf = (name: string | undefined) =>
    name ? (members.find((m) => m.name === name)?.id ?? null) : null;

  // The members of the Nest are real: read the response of the page and
  // remember it (the same query the page makes, with the user column).
  page.on("response", async (response) => {
    const url = decodeURIComponent(response.url());
    if (
      response.request().method() !== "GET" ||
      !url.includes("/rest/v1/household_members?") ||
      !url.includes("select=id,name,color,kind,user_id")
    ) {
      return;
    }
    try {
      members = JSON.parse(
        (await response.body()).toString("utf8"),
      ) as Member[];
    } catch {
      members = [];
    }
    resolveMembers();
  });

  const fail = (route: Route) =>
    json(route, 500, { code: "XX000", message: "fake failure" });

  const handle = (
    pattern: string,
    body: (route: Route) => Promise<unknown> | unknown,
  ) =>
    page.route(pattern, async (route) => {
      if (route.request().method() === "OPTIONS") {
        return route.fulfill({ status: 204, headers: CORS });
      }
      return body(route);
    });

  const actor = (name: string) => {
    const member = memberOf(name);
    return { id: member.id, name: member.name, color: member.color };
  };

  const rows = () => {
    if (scenario === "vuoto") return [];
    const blank = {
      event_id: null,
      occurrence_date: null,
      days_before: null,
      evening_date: null,
      free_from: null,
      item_count: null,
      actor: null,
      todo: null,
      deadline: null,
    };
    // Newest first, like the database.
    return [
      {
        ...blank,
        id: uuid(901),
        kind: "todo_assigned",
        created_at: rome("2026-10-20T14:20"),
        read_at: null,
        actor: actor("Laura"),
        todo: {
          id: uuid(200),
          title: "Firmare autorizzazione gita",
          due_date: "2026-10-23",
          done_at: null,
        },
      },
      {
        ...blank,
        id: uuid(902),
        kind: "deadline_reminder",
        created_at: rome("2026-10-20T09:00"),
        read_at: null,
        days_before: 7,
        deadline: {
          id: uuid(400),
          title: "Rinnovo carta d'identità di Sofia",
          due_date: "2026-10-27",
          note: "Serve per il nuoto.",
        },
      },
      {
        ...blank,
        id: uuid(903),
        kind: "free_together",
        created_at: rome("2026-10-20T08:00"),
        read_at: null,
        evening_date: "2026-10-23",
        free_from: rome("2026-10-23T18:00"),
      },
      {
        ...blank,
        id: uuid(904),
        kind: "shopping_added",
        created_at: rome("2026-10-19T19:05"),
        read_at: rome("2026-10-19T20:00"),
        item_count: 3,
        actor: actor("Laura"),
      },
      {
        ...blank,
        id: uuid(905),
        kind: "event_time_changed",
        created_at: rome("2026-10-19T11:40"),
        read_at: rome("2026-10-19T12:00"),
        event_id: uuid(500),
        occurrence_date: "2026-10-22",
        actor: actor("Laura"),
      },
    ];
  };

  await handle("**/rest/v1/notifications*", async (route) => {
    if (listMode === "error") return fail(route);
    if (listMode === "slow") await released;
    await membersReady;
    return json(route, 200, rows());
  });

  await handle("**/rest/v1/rpc/count_unread_notifications*", (route) =>
    json(route, 200, scenario === "vuoto" ? 0 : 3),
  );

  await handle("**/rest/v1/rpc/mark_notifications_read*", (route) => {
    const body = route.request().postDataJSON() as { p_ids?: string[] };
    marked.push(body.p_ids ?? []);
    // The first call is the one of the opening: it always works.
    if (failNext && marked.length > 1) {
      failNext = false;
      return fail(route);
    }
    return route.fulfill({ status: 204, headers: CORS, body: "" });
  });

  await handle("**/rest/v1/rpc/get_notification_preferences*", (route) =>
    digestMode === "error"
      ? fail(route)
      : json(route, 200, [{ morning_digest: digestMode === "on" }]),
  );

  // Only the reading of the summary (the time of the summary and the lens) is
  // fake: the other reads of the profile are real.
  await handle("**/rest/v1/profiles*", (route) =>
    decodeURIComponent(route.request().url()).includes("morning_digest_time")
      ? json(route, 200, [
          { morning_digest_time: "07:30:00", start_lens: "io" },
        ])
      : route.fallback(),
  );

  await handle("**/rest/v1/rpc/list_household_events*", async (route) => {
    await membersReady;
    return json(
      route,
      200,
      EVENTS.map((event, index) => ({
        id: event.masked ? null : uuid(100 + index),
        starts_at: rome(event.from),
        ends_at: rome(event.to),
        visibility: event.visibility ?? "household",
        author_member_id: idOf(event.author ?? "Marco"),
        title: event.masked ? null : event.title,
        location: event.masked ? null : (event.location ?? null),
        escort_member_id: null,
        member_ids: event.masked ? null : event.who.map((name) => idOf(name)),
        is_masked: event.masked === true,
      })),
    );
  });

  await handle("**/rest/v1/rpc/get_event_occurrence*", async (route) => {
    await membersReady;
    return json(route, 200, [
      {
        id: uuid(500),
        title: "Nuoto Sofia",
        starts_at: rome("2026-10-22T18:00"),
        ends_at: rome("2026-10-22T19:30"),
        occurrence_date: "2026-10-22",
        series_starts_at: rome("2026-10-22T18:00"),
        series_ends_at: rome("2026-10-22T19:30"),
        location: null,
        notes: null,
        visibility: "household",
        author_member_id: idOf("Laura"),
        escort_member_id: null,
        member_ids: [idOf("Sofia")],
        recurrence: "none",
        recurrence_weekdays: null,
        recurrence_until: null,
        is_modified: false,
      },
    ]);
  });

  await handle("**/rest/v1/todos*", async (route) => {
    const request = route.request();
    const url = decodeURIComponent(request.url());
    if (request.method() === "GET") {
      // The summary asks for the titles of the things to do for Marco; the
      // reading after a «Fatto» that changed nothing asks for `done_at`.
      if (url.includes("select=done_at")) {
        if (todoMode === "error") return fail(route);
        return json(
          route,
          200,
          todoMode === "already" ? [{ done_at: rome("2026-10-20T15:40") }] : [],
        );
      }
      return json(route, 200, [{ title: "Chiamare il commercialista" }]);
    }
    if (request.method() === "PATCH") {
      const body = request.postDataJSON() as { done_at: string | null };
      // «Annulla» (done_at null) always works.
      if (body.done_at !== null) {
        if (todoMode === "error") return fail(route);
        if (todoMode === "already" || todoMode === "gone") {
          return route.fulfill({
            status: 204,
            headers: { ...CORS, "content-range": "*/0" },
            body: "",
          });
        }
      }
      return route.fulfill({
        status: 204,
        headers: { ...CORS, "content-range": "0-0/1" },
        body: "",
      });
    }
    return route.fulfill({ status: 204, headers: CORS, body: "" });
  });

  return {
    release,
    failMarking: () => {
      failNext = true;
    },
    marked: () => marked,
  };
}

/**
 * Opens `/notifiche` with the fake and the page clock at the mockup's «now».
 * With `ready` it waits for the page to be read (the rows, or the empty
 * state); the callers of the other states wait for their own sign.
 */
export async function openNotifiche(
  page: Page,
  options: NotificheFakeOptions = {},
  ready = true,
): Promise<NotificheFake> {
  await page.clock.install({ time: NOTIFICHE_NOW });
  const fake = await installNotificheFake(page, options);
  await page.goto("/notifiche");
  if (ready) {
    if (options.scenario === "vuoto") {
      await expect(page.getByText("Tutto tranquillo")).toBeVisible({
        timeout: 20_000,
      });
    } else {
      await expect(page.getByTestId("notifica")).toHaveCount(5, {
        timeout: 20_000,
      });
    }
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  }
  await page.evaluate(() => document.fonts.ready);
  return fake;
}
