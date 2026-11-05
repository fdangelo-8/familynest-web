import type { BrowserContext, Page, Route } from "@playwright/test";

// A fake of the `search_household` function for the visual and accessibility
// tests of Ricerca (#40).
//
// Why: the screenshots need exact, repeatable results in every state, and the
// test project is shared with other suites that write to the same Nest. So the
// search request goes through this fake (page.route) and the database is never
// read for results. Everything else (sign-in, Nest, members, page code) is
// real: the members are read from the real response and their ids are put in
// the fake rows, so that the avatars are the real ones.
//
// Days are the ones of the mockup: «oggi» is Tuesday 20 October 2026, 15:52
// (Europe/Rome); tests fix the clock to that moment.

export type FakeMode = "ok" | "error" | "slow";

export type RicercaFake = {
  /** Lets the held requests (mode "slow") through */
  release: () => void;
  /** Number of requests served or held so far */
  calls: () => number;
  /** The last request body (parameters of the function), for the tests */
  lastBody: () => Record<string, unknown> | null;
};

type Member = { id: string; name: string };

type Raw = {
  kind: "event" | "deadline" | "todo" | "shopping_item";
  id: string | null;
  title: string | null;
  location: string | null;
  starts_at: string | null;
  ends_at: string | null;
  occurrence_day: string | null;
  visibility: "private" | "busy" | "household" | null;
  author_member_id: string | null;
  member_ids: string[] | null;
  escort_member_id: string | null;
  recurrence: "none" | "weekly" | "monthly" | null;
  recurrence_weekdays: number[] | null;
  series_starts_on: string | null;
  is_masked: boolean;
  due_date: string | null;
  is_private: boolean;
  assignee_member_id: string | null;
  for_member_id: string | null;
  quantity: string | null;
  sort_index: number;
};

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

function uuid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

/** Lower case, no accents, no extra spaces: how the database compares. */
function flat(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function blank(partial: Partial<Raw> & Pick<Raw, "kind">): Raw {
  return {
    id: null,
    title: null,
    location: null,
    starts_at: null,
    ends_at: null,
    occurrence_day: null,
    visibility: null,
    author_member_id: null,
    member_ids: null,
    escort_member_id: null,
    recurrence: null,
    recurrence_weekdays: null,
    series_starts_on: null,
    is_masked: false,
    due_date: null,
    is_private: false,
    assignee_member_id: null,
    for_member_id: null,
    quantity: null,
    sort_index: 0,
    ...partial,
  };
}

type Ids = { marco: string; laura: string; sofia: string };

function datasets(ids: Ids) {
  let n = 100;
  const next = () => uuid(++n);
  const event = (p: {
    id: string;
    title: string;
    day: string;
    start: string;
    end: string;
    location?: string | null;
    visibility?: "private" | "household";
    members: string[];
    author?: string;
    series?: { weekdays: number[]; startsOn: string };
  }): Raw =>
    blank({
      kind: "event",
      id: p.id,
      title: p.title,
      location: p.location ?? null,
      starts_at: p.start,
      ends_at: p.end,
      occurrence_day: p.day,
      visibility: p.visibility ?? "household",
      author_member_id: p.author ?? ids.marco,
      member_ids: p.members,
      recurrence: p.series ? "weekly" : "none",
      recurrence_weekdays: p.series?.weekdays ?? [],
      series_starts_on: p.series?.startsOn ?? p.day,
    });

  // «Nuoto Sofia»: every Tuesday and Thursday 17:00 - 18:30 (Rome, CEST).
  const swim = uuid(1);
  const swimSeries = { weekdays: [2, 4], startsOn: "2026-10-20" };
  const nuoto: Raw[] = [
    event({
      id: swim,
      title: "Nuoto Sofia",
      day: "2026-10-20",
      start: "2026-10-20T15:00:00Z",
      end: "2026-10-20T16:30:00Z",
      location: "piscina comunale",
      members: [ids.sofia],
      series: swimSeries,
    }),
    event({
      id: swim,
      title: "Nuoto Sofia",
      day: "2026-10-22",
      start: "2026-10-22T15:00:00Z",
      end: "2026-10-22T16:30:00Z",
      location: "piscina comunale",
      members: [ids.sofia],
      series: swimSeries,
    }),
    event({
      id: swim,
      title: "Nuoto Sofia",
      day: "2026-10-27",
      start: "2026-10-27T16:00:00Z",
      end: "2026-10-27T17:30:00Z",
      location: "piscina comunale",
      members: [ids.sofia],
      series: swimSeries,
    }),
    blank({
      kind: "deadline",
      id: uuid(2),
      title: "Iscrizione al corso di nuoto",
      due_date: "2026-11-03",
      for_member_id: ids.sofia,
      assignee_member_id: ids.marco,
    }),
    blank({
      kind: "todo",
      id: uuid(3),
      title: "Comprare la cuffia da nuoto",
      due_date: "2026-10-22",
      assignee_member_id: ids.laura,
    }),
  ];

  // «auto»: all four kinds, a day of another month and a «Solo io».
  const auto: Raw[] = [
    event({
      id: next(),
      title: "Auto dal meccanico",
      day: "2026-10-23",
      start: "2026-10-23T07:30:00Z",
      end: "2026-10-23T08:30:00Z",
      location: "officina Rossi",
      visibility: "private",
      members: [ids.marco],
    }),
    event({
      id: next(),
      title: "Revisione auto",
      day: "2026-11-03",
      start: "2026-11-03T16:00:00Z",
      end: "2026-11-03T17:30:00Z",
      members: [ids.laura],
    }),
    blank({
      kind: "deadline",
      id: next(),
      title: "Bollo auto",
      due_date: "2026-10-31",
      assignee_member_id: ids.marco,
    }),
    blank({
      kind: "todo",
      id: next(),
      title: "Lavare l'auto",
      assignee_member_id: ids.laura,
      due_date: "2026-10-25",
    }),
    blank({
      kind: "shopping_item",
      id: next(),
      title: "Cera per auto",
      quantity: "1",
    }),
  ];

  // Period without text («questo weekend»): an event and an «Occupato» of Laura.
  const weekend: Raw[] = [
    event({
      id: next(),
      title: "Gita al lago",
      day: "2026-10-24",
      start: "2026-10-24T07:00:00Z",
      end: "2026-10-24T10:00:00Z",
      location: "lago di Garda",
      members: [ids.marco, ids.laura],
    }),
    blank({
      kind: "event",
      is_masked: true,
      starts_at: "2026-10-25T08:00:00Z",
      ends_at: "2026-10-25T09:00:00Z",
      occurrence_day: "2026-10-25",
      author_member_id: ids.laura,
    }),
  ];

  return { nuoto, auto, weekend };
}

/**
 * Installs the fake. Call it before `page.goto`. The members are read from the
 * page's own response; the rows are built when the first search arrives.
 */
export async function installRicercaFake(
  page: Page,
  options: { mode?: FakeMode } = {},
): Promise<RicercaFake> {
  const mode = options.mode ?? "ok";
  let members: Member[] = [];
  let resolveMembers: () => void = () => {};
  const membersReady = new Promise<void>((resolve) => {
    resolveMembers = resolve;
  });
  let release: () => void = () => {};
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  let calls = 0;
  let last: Record<string, unknown> | null = null;

  page.on("response", async (response) => {
    if (
      response.request().method() !== "GET" ||
      !response.url().includes("/rest/v1/household_members?")
    ) {
      return;
    }
    try {
      const body = JSON.parse((await response.body()).toString("utf8"));
      if (
        Array.isArray(body) &&
        body.some((m: Member) => m.name === "Marco") &&
        body.length >= members.length
      ) {
        members = body as Member[];
        resolveMembers();
      }
    } catch {
      // not the list we want
    }
  });

  await page.route("**/rest/v1/rpc/search_household*", async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") {
      return route.fulfill({ status: 204, headers: CORS });
    }
    calls += 1;
    last = request.postDataJSON() as Record<string, unknown>;
    if (mode === "error") {
      return json(route, 500, { code: "XX000", message: "fake failure" });
    }
    if (mode === "slow") await released;
    await Promise.race([
      membersReady,
      new Promise((resolve) => setTimeout(resolve, 10_000)),
    ]);
    const idOf = (name: string) =>
      members.find((m) => m.name === name)?.id ?? uuid(900);
    const sets = datasets({
      marco: idOf("Marco"),
      laura: idOf("Laura"),
      sofia: idOf("Sofia"),
    });
    const text = flat(String(last.p_text ?? ""));
    const kinds = last.p_kinds as string[] | undefined;
    let rows: Raw[] = [];
    if (text === "") {
      rows = last.p_from ? sets.weekend : [];
    } else {
      const words = text.split(" ");
      rows = [...sets.nuoto, ...sets.auto].filter(
        (row) =>
          !row.is_masked &&
          words.every((word) => flat(row.title ?? "").includes(word)),
      );
    }
    if (kinds) rows = rows.filter((row) => kinds.includes(row.kind));
    return json(
      route,
      200,
      rows.map((row, index) => ({ ...row, sort_index: index })),
    );
  });

  return { release: () => release(), calls: () => calls, lastBody: () => last };
}

/**
 * The id of the signed-in user, read from the session cookie put by
 * `signInAs`: the recent searches live under a key that carries it.
 */
export async function userIdOf(context: BrowserContext): Promise<string> {
  const cookies = (await context.cookies()).filter((c) =>
    /^sb-.+-auth-token(\.\d+)?$/.test(c.name),
  );
  cookies.sort((a, b) => a.name.localeCompare(b.name));
  const raw = cookies.map((c) => c.value).join("");
  const text = Buffer.from(raw.replace(/^base64-/, ""), "base64url").toString(
    "utf8",
  );
  return (JSON.parse(text) as { user: { id: string } }).user.id;
}

/** Puts the recent searches in the browser, before the page opens. */
export async function seedRecents(
  page: Page,
  context: BrowserContext,
  texts: string[],
): Promise<void> {
  const key = `familynest:recent-searches:${await userIdOf(context)}`;
  await page.addInitScript(
    ([k, v]) => {
      if (window.localStorage.getItem(k) === null) {
        window.localStorage.setItem(k, v);
      }
    },
    [key, JSON.stringify(texts)] as const,
  );
}
