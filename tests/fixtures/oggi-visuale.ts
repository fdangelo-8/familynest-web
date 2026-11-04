import type { Page, Route } from "@playwright/test";

// A fake of the endpoints Oggi (#30) reads and writes in the browser, for the
// visual and accessibility tests of the page: events, things to do, the
// shopping list, deadlines, the Nest row, invitations, pinned spaces and the
// welcome. Nothing is written to the database and the shots do not depend on
// what other suites do in the same Nest.
//
// Sign-in, the Nest and its members (Marco, Laura, Sofia, Tommaso, Biscotto)
// are real: the ids of the members are read from the real response and used
// in the fake rows. "Now" is Tuesday 20 October 2026, 15:52 (Rome), like the
// mockup (09-oggi.html): the call at 16:00 is «tra 8 minuti».

export const OGGI_NOW = new Date("2026-10-20T15:52:00+02:00");

/** For «tutto-fatto»: the evening is over too (22:30). */
export const OGGI_LATE = new Date("2026-10-20T22:30:00+02:00");

export function oggiNow(scenario: OggiScenario | undefined): Date {
  return scenario === "tutto-fatto" ? OGGI_LATE : OGGI_NOW;
}

export type OggiScenario =
  /** Mockup «normale»: a full day */
  | "normale"
  /** Mockup «vuoto»: the first day, starter list, nothing planned */
  | "vuoto"
  /** Mockup «primo-accesso-invitato»: who joined with an invitation */
  | "invitato"
  /** Every event of today is over */
  | "tutto-fatto";

export type OggiFakeOptions = {
  scenario?: OggiScenario;
  /** "slow": the events wait until release() is called; "error": they fail */
  events?: "ok" | "slow" | "error";
  /** The things to do fail with a database error */
  todos?: "ok" | "error";
  /** The numbers of the house (shopping, deadlines) fail */
  house?: "ok" | "error";
  /** Every read fails: the error of the whole page */
  all?: "ok" | "error";
};

export type OggiFake = {
  /** Lets the held reads (events: "slow") through */
  release: () => void;
  /** Ids of the things to do the page ticked as done */
  ticked: () => string[];
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

type Member = { id: string; name: string };
type Visibility = "private" | "busy" | "household";

type FakeEvent = {
  title: string;
  /** Rome time, `YYYY-MM-DDTHH:MM` */
  from: string;
  to: string;
  visibility?: Visibility;
  author?: string;
  escort?: string;
  who: string[];
  location?: string | null;
};

type FakeTodo = {
  title: string;
  due?: string;
  assignee?: string;
  forWho?: string;
  isPrivate?: boolean;
};

type Scenario = {
  events: FakeEvent[];
  todos: FakeTodo[];
  shopping: string[];
  deadlines: { title: string; due: string }[];
  /** Name of who invited, when a welcome is to be shown */
  welcome: string | null;
  starterOpen: boolean;
  invited: string[];
};

const rome = (value: string) => new Date(`${value}:00+02:00`).toISOString();

const WEEK: FakeEvent[] = [
  {
    title: "Tennis",
    from: "2026-10-21T20:00",
    to: "2026-10-21T21:30",
    author: "Marco",
    who: ["Marco"],
    location: "Centro sportivo",
  },
  {
    title: "Yoga",
    from: "2026-10-22T20:30",
    to: "2026-10-22T21:30",
    author: "Laura",
    who: ["Laura"],
    location: "Studio Respiro",
  },
  {
    title: "Cena da Marta e Paolo",
    from: "2026-10-24T20:00",
    to: "2026-10-24T23:00",
    author: "Marco",
    who: ["Marco", "Laura"],
    location: "Isola",
  },
];

const TODAY_FULL: FakeEvent[] = [
  {
    title: "Palestra",
    from: "2026-10-20T07:00",
    to: "2026-10-20T08:00",
    author: "Marco",
    who: ["Marco"],
  },
  {
    title: "Scuola",
    from: "2026-10-20T08:15",
    to: "2026-10-20T13:00",
    author: "Laura",
    escort: "Laura",
    who: ["Sofia", "Tommaso"],
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
    title: "Nuoto Sofia",
    from: "2026-10-20T17:00",
    to: "2026-10-20T18:30",
    author: "Laura",
    escort: "Laura",
    who: ["Sofia"],
  },
  {
    title: "Cena dai nonni",
    from: "2026-10-20T19:30",
    to: "2026-10-20T21:30",
    author: "Marco",
    who: ["Marco", "Laura", "Sofia", "Tommaso"],
    location: "Monza",
  },
];

const SCENARIOS: Record<OggiScenario, Scenario> = {
  normale: {
    events: [
      ...TODAY_FULL,
      {
        title: "Scuola",
        from: "2026-10-21T08:15",
        to: "2026-10-21T13:00",
        author: "Laura",
        escort: "Marco",
        who: ["Sofia", "Tommaso"],
      },
      ...WEEK,
    ],
    todos: [
      {
        title: "Chiamare il commercialista",
        due: "2026-10-21",
        assignee: "Marco",
        isPrivate: true,
      },
      {
        title: "Rinnovare l'assicurazione dell'auto",
        due: "2026-10-31",
        assignee: "Marco",
        isPrivate: true,
      },
      {
        title: "Firmare autorizzazione gita",
        due: "2026-10-23",
        assignee: "Laura",
        forWho: "Sofia",
      },
      {
        title: "Comprare la cuffia da nuoto",
        due: "2026-10-22",
        assignee: "Laura",
        forWho: "Sofia",
      },
    ],
    shopping: ["Latte", "Pane", "Mele", "Uova"],
    deadlines: [
      // 5 days: «Nel Nest» only shows a deadline within 7 days (the mockup
      // has 14, the requirement says 7).
      { title: "Rinnovo carta d'identità di Sofia", due: "2026-10-25" },
      { title: "Bollo dell'auto", due: "2026-12-07" },
    ],
    welcome: null,
    starterOpen: false,
    invited: [],
  },
  vuoto: {
    events: [],
    todos: [],
    shopping: [],
    deadlines: [],
    welcome: null,
    starterOpen: true,
    invited: ["Laura"],
  },
  invitato: {
    events: [
      {
        title: "Inglese",
        from: "2026-10-21T16:30",
        to: "2026-10-21T17:30",
        author: "Marco",
        who: ["Sofia"],
        location: "via Dante 4",
      },
      ...WEEK,
    ],
    todos: [],
    shopping: ["Latte", "Pane", "Mele", "Uova"],
    deadlines: [],
    welcome: "Laura",
    starterOpen: false,
    invited: [],
  },
  "tutto-fatto": {
    events: [
      ...TODAY_FULL.filter(
        (e) => e.title === "Palestra" || e.title === "Scuola",
      ),
      {
        title: "Cena dai nonni",
        from: "2026-10-20T18:00",
        to: "2026-10-20T22:15",
        author: "Marco",
        who: ["Marco", "Laura", "Sofia", "Tommaso"],
        location: "Monza",
      },
    ],
    todos: [],
    shopping: [],
    deadlines: [],
    welcome: null,
    starterOpen: false,
    invited: [],
  },
};

export async function installOggiFake(
  page: Page,
  options: OggiFakeOptions = {},
): Promise<OggiFake> {
  const scenario = SCENARIOS[options.scenario ?? "normale"];
  const eventsMode = options.events ?? "ok";
  const everything = options.all === "error";

  let members: Member[] | null = null;
  let resolveMembers: () => void = () => {};
  const membersReady = new Promise<void>((resolve) => {
    resolveMembers = resolve;
  });
  let release: () => void = () => {};
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  const ticked: string[] = [];

  const idOf = (name: string | undefined) =>
    name ? (members?.find((m) => m.name === name)?.id ?? null) : null;

  // The members of the Nest are real: read the response of the page and
  // remember it (the same query Oggi makes, without a user filter).
  page.on("response", async (response) => {
    const url = decodeURIComponent(response.url());
    if (
      response.request().method() !== "GET" ||
      !url.includes("/rest/v1/household_members?") ||
      !url.includes("select=id,name,color,kind")
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
    mode: boolean,
    body: (route: Route) => Promise<unknown> | unknown,
  ) =>
    page.route(pattern, async (route) => {
      const method = route.request().method();
      if (method === "OPTIONS") {
        return route.fulfill({ status: 204, headers: CORS });
      }
      if (mode) return fail(route);
      return body(route);
    });

  await handle(
    "**/rest/v1/rpc/list_household_events*",
    everything,
    async (route) => {
      if (eventsMode === "error") return fail(route);
      if (eventsMode === "slow") await released;
      await membersReady;
      return json(
        route,
        200,
        scenario.events.map((event, index) => ({
          id: uuid(100 + index),
          starts_at: rome(event.from),
          ends_at: rome(event.to),
          visibility: event.visibility ?? "household",
          author_member_id: idOf(event.author ?? "Marco"),
          title: event.title,
          location: event.location ?? null,
          escort_member_id: idOf(event.escort),
          member_ids: event.who.map((name) => idOf(name)),
          is_masked: false,
        })),
      );
    },
  );

  await handle("**/rest/v1/rpc/current_member_welcome*", everything, (route) =>
    json(
      route,
      200,
      scenario.welcome === null ? [] : [{ inviter_name: scenario.welcome }],
    ),
  );

  let todoRows: Array<Record<string, unknown>> | null = null;
  async function ensureTodos() {
    if (todoRows) return todoRows;
    await membersReady;
    todoRows = scenario.todos.map((todo, index) => ({
      id: uuid(200 + index),
      title: todo.title,
      assignee_member_id: idOf(todo.assignee),
      for_member_id: idOf(todo.forWho),
      due_date: todo.due ?? null,
      is_private: todo.isPrivate ?? false,
      done_at: null,
      done_by_member_id: null,
      created_by_member_id: idOf(todo.isPrivate ? "Marco" : "Laura"),
      created_at: new Date(Date.UTC(2026, 9, 19, 9, index)).toISOString(),
    }));
    return todoRows;
  }
  await handle(
    "**/rest/v1/todos*",
    everything || options.todos === "error",
    async (route) => {
      const request = route.request();
      const rows = await ensureTodos();
      const idParam = new URL(request.url()).searchParams.get("id");
      const id = idParam?.startsWith("eq.") ? idParam.slice(3) : null;
      if (request.method() === "GET") {
        return json(
          route,
          200,
          rows.filter((row) => row.done_at === null && (!id || row.id === id)),
        );
      }
      if (request.method() === "PATCH") {
        const body = request.postDataJSON() as { done_at: string | null };
        const row = rows.find((r) => r.id === id);
        if (row) {
          row.done_at = body.done_at;
          if (body.done_at) ticked.push(String(row.id));
        }
        return route.fulfill({
          status: 204,
          headers: { ...CORS, "content-range": row ? "0-0/1" : "*/0" },
          body: "",
        });
      }
      return route.fulfill({ status: 204, headers: CORS, body: "" });
    },
  );

  await handle(
    "**/rest/v1/shopping_items*",
    everything || options.house === "error",
    (route) =>
      json(
        route,
        200,
        scenario.shopping.map((name, index) => ({
          id: uuid(300 + index),
          name,
        })),
      ),
  );

  await handle(
    "**/rest/v1/deadlines*",
    everything || options.house === "error",
    (route) =>
      json(
        route,
        200,
        scenario.deadlines.map((deadline, index) => ({
          id: uuid(400 + index),
          title: deadline.title,
          due_date: deadline.due,
          is_private: false,
          created_at: new Date(Date.UTC(2026, 9, 1, 9, index)).toISOString(),
        })),
      ),
  );

  await handle("**/rest/v1/households*", everything, (route) =>
    json(route, 200, [
      {
        first_shopping_item_at: scenario.starterOpen
          ? null
          : "2026-10-19T09:00:00Z",
        starter_list_completed_at: scenario.starterOpen
          ? null
          : "2026-10-19T10:00:00Z",
      },
    ]),
  );

  await handle("**/rest/v1/invitations*", everything, async (route) => {
    await membersReady;
    return json(
      route,
      200,
      scenario.invited.map((name) => ({
        member_id: idOf(name),
        status: "pending",
        expires_at: "2026-10-30T09:00:00Z",
      })),
    );
  });

  await handle("**/rest/v1/pinned_spaces*", everything, (route) =>
    json(route, 200, [{ space: "meals" }]),
  );

  return { release, ticked: () => ticked };
}
