import type { Page, Route } from "@playwright/test";

// A fake of the PostgREST endpoint of the deadlines, for the visual and
// accessibility tests of Casa · Scadenze (#24).
//
// Why: the screenshots need exact, repeatable lists in every state, and the
// test project is shared with other suites that write to the same Nest. So the
// browser reads the deadlines through this fake (page.route) and nothing is
// ever written to the database. Everything else (sign-in, Nest, members, page
// code) is real: the members are read from the real response and passed on.
// Casa reads the three lists on every page: the tests also install the fakes of
// Spesa and Da fare (spesa-fake.ts, todos-fake.ts) before this one.

export type FakeMemberName = "Marco" | "Laura" | "Sofia" | "Tommaso";

export type FakeDeadline = {
  title: string;
  /** YYYY-MM-DD */
  dueDate: string;
  note?: string | null;
  assignee?: FakeMemberName | null;
  forMember?: FakeMemberName | "Biscotto" | null;
  isPrivate?: boolean;
};

type Member = { id: string; name: string };

export type FakeOptions = {
  deadlines?: FakeDeadline[];
  /** "slow": the reads wait until release() is called; "error": they fail with a database error */
  reads?: "ok" | "slow" | "error";
};

export type ScadenzeFake = {
  /** Lets the held reads (reads: "slow") through */
  release: () => void;
  /** From now on the reads work again */
  recover: () => void;
  /** Number of reads of the deadlines served so far */
  readCount: () => number;
};

const BASE = Date.parse("2026-10-19T09:00:00Z");
const HOUSEHOLD = "00000000-0000-4000-8000-0000000000aa";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,HEAD,OPTIONS",
  "access-control-expose-headers": "content-range",
};

function json(route: Route, status: number, body: unknown) {
  return route.fulfill({
    status,
    contentType: "application/json",
    headers: CORS,
    body: JSON.stringify(body),
  });
}

export async function installScadenzeFake(
  page: Page,
  options: FakeOptions = {},
): Promise<ScadenzeFake> {
  let mode = options.reads ?? "ok";
  let members: Member[] | null = null;
  let resolveMembers: () => void = () => {};
  const membersReady = new Promise<void>((resolve) => {
    resolveMembers = resolve;
  });
  let release: () => void = () => {};
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  let reads = 0;

  const idOf = (name: string | null | undefined) =>
    name ? (members?.find((m) => m.name === name)?.id ?? null) : null;

  // The members list is real: read the response and remember it. A response
  // listener (not a route) so that the fakes of the other lists of Casa, which
  // read the same list, can be installed on the same page.
  page.on("response", async (response) => {
    const request = response.request();
    if (
      request.method() !== "GET" ||
      !response.url().includes("/rest/v1/household_members?") ||
      !response.url().includes("order=created_at")
    ) {
      return;
    }
    try {
      const parsed = JSON.parse(
        (await response.body()).toString("utf8"),
      ) as Member[];
      // Only the list that carries the names (other reads may exist).
      if (Array.isArray(parsed) && parsed.every((m) => "name" in m)) {
        members = parsed;
        resolveMembers();
      }
    } catch {
      // not a members list, or the page is gone: ignore
    }
  });

  await page.route("**/rest/v1/deadlines*", async (route) => {
    const method = route.request().method();
    if (method === "OPTIONS") {
      return route.fulfill({ status: 204, headers: CORS });
    }
    if (method !== "GET") return route.continue();
    reads += 1;
    if (mode === "error") {
      return json(route, 500, { code: "XX000", message: "fake failure" });
    }
    if (mode === "slow") await released;
    await membersReady;
    const rows = (options.deadlines ?? []).map((d, index) => ({
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      title: d.title,
      due_date: d.dueDate,
      note: d.note ?? null,
      assignee_member_id: idOf(d.assignee),
      for_member_id: idOf(d.forMember),
      is_private: d.isPrivate ?? false,
      created_at: new Date(BASE + index * 60_000).toISOString(),
      household_id: HOUSEHOLD,
    }));
    return json(route, 200, rows);
  });

  return {
    release: () => release(),
    recover: () => {
      mode = "ok";
    },
    readCount: () => reads,
  };
}

// --- The lists used by the tests -------------------------------------------
// «Today» in the tests is Tuesday 20 October 2026 (clock fixed). No health
// themes in the examples (D1).

/** The data of the mockup, with the examples of the requirement (DS). */
export const NORMAL_DEADLINES: FakeDeadline[] = [
  {
    title: "Rinnovo carta d'identità di Sofia",
    dueDate: "2026-11-03",
    note: "Serve per la gita",
    forMember: "Sofia",
  },
  {
    title: "Assicurazione di Biscotto",
    dueDate: "2026-11-20",
    forMember: "Biscotto",
    assignee: "Laura",
  },
  { title: "Bollo dell'auto", dueDate: "2026-12-07", assignee: "Marco" },
  {
    title: "Assicurazione della casa",
    dueDate: "2027-01-20",
    assignee: "Marco",
  },
];

/** Overdue, due today, and a «Solo io» of Marco, on top of the usual ones. */
export const OVERDUE_TODAY_PRIVATE_DEADLINES: FakeDeadline[] = [
  {
    title: "Rinnovo abbonamento del bus",
    dueDate: "2026-10-15",
    note: "Serve per la scuola",
    assignee: "Sofia",
  },
  { title: "Bollo della moto", dueDate: "2026-10-19", assignee: "Marco" },
  { title: "Tagliando dell'auto", dueDate: "2026-10-20", assignee: "Laura" },
  ...NORMAL_DEADLINES,
  {
    title: "Rinnovo del passaporto",
    dueDate: "2027-01-12",
    isPrivate: true,
    assignee: "Marco",
  },
];

/** Long titles and notes: they wrap, never cut. */
export const LONG_DEADLINES: FakeDeadline[] = [
  {
    title:
      "Rinnovo dell'abbonamento annuale della palestra e della piscina comunale",
    dueDate: "2026-11-02",
    note: "Portare la tessera, il documento e la ricevuta dell'anno scorso",
    assignee: "Laura",
  },
  {
    title: "Assicurazione",
    dueDate: "2026-12-30",
    forMember: "Tommaso",
  },
];
