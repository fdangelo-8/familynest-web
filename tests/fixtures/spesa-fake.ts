import type { Page, Route } from "@playwright/test";

// A fake of the PostgREST endpoints of the shopping list, for the visual and
// accessibility tests of Casa · Spesa (#21).
//
// Why: the screenshots need exact, repeatable lists in every state, and the
// test project is shared with other suites that write to the same Nest. So the
// browser reads and writes the list through this fake (page.route) and nothing
// is ever written to the database. Everything else (sign-in, Nest, members,
// page code) is real: members are read from the real response and passed on.
//
// The «Da fare» column is drawn next to the Spesa at 1280 px since #23 and
// reads `todos`: that read is faked too, always an empty list, so the column
// never shows the real things to do of the test user.

export type FakeMemberName = "Marco" | "Laura" | "Biscotto";

export type FakeItem = {
  name: string;
  quantity?: string | null;
  /** ISO time; omitted = still to buy */
  checkedAt?: string | null;
  by: FakeMemberName;
};

type Row = {
  id: string;
  household_id: string;
  name: string;
  quantity: string | null;
  checked_at: string | null;
  created_at: string;
  added_by_member_id: string | null;
};

type Member = { id: string; name: string };

export type FakeOptions = {
  /** What the list contains when the page opens */
  items?: FakeItem[];
  /** "slow": the reads wait until release() is called; "error": they fail with a database error */
  reads?: "ok" | "slow" | "error";
};

export type SpesaFake = {
  /** Lets the held reads (reads: "slow") through */
  release: () => void;
  /** From now on every write is refused with a database error (not a network error) */
  refuseWrites: () => void;
  /** The list as the fake holds it now */
  rows: () => Row[];
  /** Number of reads of the list served so far */
  readCount: () => number;
};

const BASE = Date.parse("2026-10-19T09:00:00Z");
const HOUSEHOLD = "00000000-0000-4000-8000-0000000000aa";

function uuid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
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

export async function installSpesaFake(
  page: Page,
  options: FakeOptions = {},
): Promise<SpesaFake> {
  const mode = options.reads ?? "ok";
  let members: Member[] | null = null;
  let resolveMembers: () => void = () => {};
  const membersReady = new Promise<void>((resolve) => {
    resolveMembers = resolve;
  });
  let release: () => void = () => {};
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  let writesRefused = false;
  let reads = 0;
  let nextId = 1000;
  let rows: Row[] | null = null;
  const removed: Row[] = [];

  const idOf = (name: string) =>
    members?.find((m) => m.name === name)?.id ?? null;

  async function ensureRows() {
    if (rows) return rows;
    await membersReady;
    rows = (options.items ?? []).map((item, index) => ({
      id: uuid(index + 1),
      household_id: HOUSEHOLD,
      name: item.name,
      quantity: item.quantity ?? null,
      checked_at: item.checkedAt ?? null,
      created_at: new Date(BASE + index * 60_000).toISOString(),
      added_by_member_id: idOf(item.by),
    }));
    return rows;
  }

  // The members list is real: read the response, remember it, pass it on.
  await page.route("**/rest/v1/household_members?*", async (route) => {
    const url = route.request().url();
    if (
      route.request().method() !== "GET" ||
      !url.includes("household_id=eq.")
    ) {
      return route.continue();
    }
    try {
      const response = await route.fetch();
      const body = await response.body();
      try {
        members = JSON.parse(body.toString("utf8")) as Member[];
      } catch {
        members = [];
      }
      resolveMembers();
      return await route.fulfill({
        status: response.status(),
        headers: response.headers(),
        body,
      });
    } catch {
      // Offline or the page is gone: let the request fail by itself.
      return route.continue().catch(() => {});
    }
  });

  await page.route("**/rest/v1/todos*", async (route) => {
    const method = route.request().method();
    if (method === "OPTIONS") {
      return route.fulfill({ status: 204, headers: CORS });
    }
    if (method === "GET") return json(route, 200, []);
    return route.fulfill({ status: 204, headers: CORS, body: "" });
  });

  await page.route("**/rest/v1/shopping_items*", async (route) => {
    const request = route.request();
    const method = request.method();
    if (method === "OPTIONS") {
      return route.fulfill({ status: 204, headers: CORS });
    }
    if (method === "GET") {
      reads += 1;
      if (mode === "error") {
        return json(route, 500, { code: "XX000", message: "fake failure" });
      }
      if (mode === "slow") await released;
      const list = await ensureRows();
      return json(route, 200, list);
    }
    if (writesRefused) {
      return json(route, 403, { code: "42501", message: "fake refusal" });
    }
    const list = await ensureRows();
    if (method === "POST") {
      const body = request.postDataJSON() as { name: string };
      const dup = list.some(
        (r) =>
          r.checked_at === null &&
          r.name.toLocaleLowerCase("it-IT") ===
            body.name.toLocaleLowerCase("it-IT"),
      );
      if (dup) return json(route, 409, { code: "23505", message: "dup" });
      list.push({
        id: uuid(nextId++),
        household_id: HOUSEHOLD,
        name: body.name,
        quantity: null,
        checked_at: null,
        created_at: new Date(BASE + 3_600_000 + nextId * 1000).toISOString(),
        added_by_member_id: idOf("Marco"),
      });
      return route.fulfill({ status: 201, headers: CORS, body: "" });
    }
    if (method === "PATCH") {
      const id = new URL(request.url()).searchParams.get("id")?.slice(3);
      const body = request.postDataJSON() as { checked_at: string | null };
      const row = list.find((r) => r.id === id);
      if (row) row.checked_at = body.checked_at;
      return route.fulfill({ status: 204, headers: CORS, body: "" });
    }
    return route.continue();
  });

  await page.route(
    "**/rest/v1/rpc/clear_checked_shopping_items",
    async (route) => {
      if (route.request().method() === "OPTIONS") {
        return route.fulfill({ status: 204, headers: CORS });
      }
      if (writesRefused) {
        return json(route, 403, { code: "42501", message: "fake refusal" });
      }
      const list = await ensureRows();
      const { item_ids } = route.request().postDataJSON() as {
        item_ids: string[];
      };
      const gone = list.filter((r) => item_ids.includes(r.id));
      removed.push(...gone);
      rows = list.filter((r) => !item_ids.includes(r.id));
      return json(route, 200, gone);
    },
  );

  await page.route("**/rest/v1/rpc/restore_shopping_items", async (route) => {
    if (route.request().method() === "OPTIONS") {
      return route.fulfill({ status: 204, headers: CORS });
    }
    const list = await ensureRows();
    const { item_ids } = route.request().postDataJSON() as {
      item_ids: string[];
    };
    const back = removed.filter((r) => item_ids.includes(r.id));
    list.push(...back);
    return json(route, 200, back);
  });

  return {
    release: () => release(),
    refuseWrites: () => {
      writesRefused = true;
    },
    rows: () => rows ?? [],
    readCount: () => reads,
  };
}

/** Time of a taken item: a fixed minute of the same day, later = taken later. */
export function takenAt(minute: number): string {
  return new Date(
    Date.parse("2026-10-20T07:00:00Z") + minute * 60_000,
  ).toISOString();
}

// --- The lists used by the tests -------------------------------------------

/** Like the mockup "normale": 4 to buy, 3 taken (the last taken on top). */
export const NORMAL_LIST: FakeItem[] = [
  { name: "Latte", quantity: "2 l", by: "Laura" },
  { name: "Pane", by: "Marco" },
  { name: "Mele", quantity: "1 kg", by: "Marco" },
  { name: "Crocchette per Biscotto", by: "Laura" },
  { name: "Detersivo", checkedAt: takenAt(1), by: "Laura" },
  { name: "Pasta", checkedAt: takenAt(2), by: "Laura" },
  { name: "Uova", quantity: "6", checkedAt: takenAt(3), by: "Marco" },
];

/** Nothing left to buy, two taken. */
export const ALL_TAKEN_LIST: FakeItem[] = [
  { name: "Latte", quantity: "2 l", checkedAt: takenAt(1), by: "Laura" },
  { name: "Pane", checkedAt: takenAt(2), by: "Marco" },
];

/** Two to buy, two taken: "Le più comuni" shows. */
export const FEW_LIST: FakeItem[] = [
  { name: "Latte", quantity: "2 l", by: "Laura" },
  { name: "Mele", quantity: "1 kg", by: "Marco" },
  { name: "Pane", checkedAt: takenAt(1), by: "Marco" },
  { name: "Pasta", checkedAt: takenAt(2), by: "Laura" },
];

/** Long names and many rows, for the overflow checks. */
export const LONG_LIST: FakeItem[] = [
  {
    name: "Biscotti integrali senza zucchero aggiunto per la colazione della domenica mattina",
    quantity: "3 conf.",
    by: "Marco",
  },
  { name: "Latte", quantity: "2 l", by: "Laura" },
  { name: "Pane", by: "Marco" },
  { name: "Mele", quantity: "1 kg", by: "Marco" },
];
