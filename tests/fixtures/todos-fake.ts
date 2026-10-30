import type { Page, Route } from "@playwright/test";

// A fake of the PostgREST endpoint of the things to do (`todos`), for the
// visual and accessibility tests of Casa · Da fare (#23) and of the Da fare
// column that now sits in Casa · Spesa on desktop.
//
// Why: the screenshots need exact, repeatable lists in every state, and the
// test project is shared with other suites. So the browser reads and writes
// `todos` through this fake (page.route) and nothing is written to the
// database. Sign-in, the Nest and its members are real: the ids of the members
// are read once from the real members endpoint with the same credentials the
// page used, so the fake does not intercept the members request and can be
// installed next to the fake of the shopping list.

export type TodoMemberName = "Marco" | "Laura" | "Sofia" | "Tommaso";

export type FakeTodo = {
  title: string;
  /** «Chi se ne occupa» */
  assignee?: TodoMemberName;
  /** «Per chi è» */
  forWho?: TodoMemberName;
  /** Day `YYYY-MM-DD` */
  due?: string;
  /** «Solo io» */
  isPrivate?: boolean;
  /** ISO time; omitted = still to do */
  doneAt?: string;
  doneBy?: TodoMemberName;
};

type Row = {
  id: string;
  household_id: string;
  title: string;
  assignee_member_id: string | null;
  for_member_id: string | null;
  due_date: string | null;
  is_private: boolean;
  done_at: string | null;
  done_by_member_id: string | null;
  created_at: string;
};

export type TodosFakeOptions = {
  todos?: FakeTodo[];
  /** "slow": the reads wait until release() is called; "error": they fail with a database error */
  reads?: "ok" | "slow" | "error";
};

export type TodosFake = {
  release: () => void;
  /** From now on every write is refused with a database error (not a network error) */
  refuseWrites: () => void;
  rows: () => Row[];
};

const BASE = Date.parse("2026-10-19T09:00:00Z");
const HOUSEHOLD = "00000000-0000-4000-8000-0000000000bb";

function uuid(n: number): string {
  return `00000000-0000-4000-8000-${String(n + 500).padStart(12, "0")}`;
}

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
};

function json(route: Route, status: number, body: unknown) {
  return route.fulfill({
    status,
    contentType: "application/json",
    headers: CORS,
    body: JSON.stringify(body),
  });
}

export async function installTodosFake(
  page: Page,
  options: TodosFakeOptions = {},
): Promise<TodosFake> {
  const mode = options.reads ?? "ok";
  let release: () => void = () => {};
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  let writesRefused = false;
  let nextId = 1000;
  let members: { id: string; name: string }[] | null = null;
  let rows: Row[] | null = null;

  async function loadMembers(route: Route) {
    if (members) return members;
    const request = route.request();
    const url = new URL(request.url());
    const household = url.searchParams.get("household_id")?.slice(3);
    const headers = request.headers();
    const response = await page.request.get(
      `${url.origin}/rest/v1/household_members?select=id,name&household_id=eq.${household}`,
      {
        headers: {
          apikey: headers["apikey"] ?? "",
          authorization: headers["authorization"] ?? "",
        },
      },
    );
    members = (await response.json()) as { id: string; name: string }[];
    return members;
  }

  async function ensureRows(route: Route) {
    if (rows) return rows;
    const list = await loadMembers(route);
    const idOf = (name?: string) =>
      (name && list.find((m) => m.name === name)?.id) || null;
    rows = (options.todos ?? []).map((todo, index) => ({
      id: uuid(index + 1),
      household_id: HOUSEHOLD,
      title: todo.title,
      assignee_member_id: idOf(todo.assignee),
      for_member_id: idOf(todo.forWho),
      due_date: todo.due ?? null,
      is_private: todo.isPrivate ?? false,
      done_at: todo.doneAt ?? null,
      done_by_member_id: todo.doneAt ? idOf(todo.doneBy ?? "Marco") : null,
      created_at: new Date(BASE + index * 60_000).toISOString(),
    }));
    return rows;
  }

  await page.route("**/rest/v1/todos*", async (route) => {
    const request = route.request();
    const method = request.method();
    if (method === "OPTIONS") {
      return route.fulfill({ status: 204, headers: CORS });
    }
    if (method === "GET") {
      if (mode === "error") {
        return json(route, 500, { code: "XX000", message: "fake failure" });
      }
      if (mode === "slow") await released;
      return json(route, 200, await ensureRows(route));
    }
    if (writesRefused) {
      return json(route, 403, { code: "42501", message: "fake refusal" });
    }
    const list = await ensureRows(route);
    if (method === "POST") {
      const body = request.postDataJSON() as { title: string };
      list.push({
        id: uuid(nextId++),
        household_id: HOUSEHOLD,
        title: body.title,
        assignee_member_id: null,
        for_member_id: null,
        due_date: null,
        is_private: false,
        done_at: null,
        done_by_member_id: null,
        created_at: new Date(BASE + 3_600_000 + nextId * 1000).toISOString(),
      });
      return route.fulfill({ status: 201, headers: CORS, body: "" });
    }
    if (method === "PATCH") {
      const id = new URL(request.url()).searchParams.get("id")?.slice(3);
      const body = request.postDataJSON() as { done_at: string | null };
      const row = list.find((r) => r.id === id);
      if (row) {
        row.done_at = body.done_at;
        row.done_by_member_id = body.done_at
          ? (members?.find((m) => m.name === "Marco")?.id ?? null)
          : null;
      }
      return route.fulfill({ status: 204, headers: CORS, body: "" });
    }
    return route.continue();
  });

  return {
    release: () => release(),
    refuseWrites: () => {
      writesRefused = true;
    },
    rows: () => rows ?? [],
  };
}

// --- The lists used by the tests -------------------------------------------
// Today is Tuesday 20 October 2026, 15:52 (Europe/Rome), like the mockup.
// The mockup's «Prenotare il vaccino di Biscotto» is not used: nothing about
// health in examples (D1).

/** Like the mockup "normale": 4 this week, 1 later, 1 done (yesterday). */
export const NORMAL_TODOS: FakeTodo[] = [
  {
    title: "Firmare autorizzazione gita",
    assignee: "Marco",
    forWho: "Sofia",
    due: "2026-10-23",
  },
  {
    title: "Chiamare il commercialista",
    assignee: "Marco",
    due: "2026-10-21",
    isPrivate: true,
  },
  {
    title: "Comprare la cuffia da nuoto",
    assignee: "Laura",
    forWho: "Sofia",
    due: "2026-10-22",
  },
  {
    title: "Regalo per la festa di Giulia",
    assignee: "Laura",
    due: "2026-10-24",
  },
  {
    title: "Comprare le lampadine della cantina",
    assignee: "Laura",
    due: "2026-10-31",
  },
  {
    title: "Pagare la mensa",
    assignee: "Marco",
    doneAt: "2026-10-19T09:00:00Z",
    doneBy: "Marco",
  },
];

/** Things in every group, two without anyone, one overdue, a long title. */
export const FULL_TODOS: FakeTodo[] = [
  ...NORMAL_TODOS,
  { title: "Sistemare la cantina" },
  {
    title:
      "Restituire alla biblioteca i libri di Sofia e Tommaso prima della chiusura del prestito",
    assignee: "Marco",
    forWho: "Tommaso",
    due: "2026-10-15",
  },
  {
    title: "Rinnovare l'abbonamento del bus",
    assignee: "Sofia",
    due: "2026-11-02",
  },
];
