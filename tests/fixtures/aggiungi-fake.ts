import type { Page, Route } from "@playwright/test";

// Fakes for the tests of the Add sheet (#20): visual and accessibility specs.
// Nothing is written to the database and the shots do not depend on what other
// suites do in the same Nest: the events of the day, the save and the reading of
// the people are served by page.route. Sign-in, the Nest and its members are
// real: the ids of the members are read from the real response and used in the
// fake events (so the names of Laura, Sofia, Tommaso are the real seed ones).

export const SAVED_ID = "00000000-0000-4000-8000-000000000172";

type Names = Map<string, string>;

/** An event of the fake reading of the day (Thursday 22 October 2026, Rome time). */
export type FakeEvent =
  | {
      masked: true;
      by: string;
      from: string; // UTC
      to: string;
    }
  | {
      masked?: false;
      title: string;
      by: string;
      with: string[];
      visibility: "household" | "busy";
      from: string;
      to: string;
    };

/** Thursday 22: «Colloquio con la maestra» 16:30–17:15 and an «Occupato» of Laura. */
export const THURSDAY: FakeEvent[] = [
  {
    masked: true,
    by: "Laura",
    from: "2026-10-22T10:00:00Z",
    to: "2026-10-22T11:00:00Z",
  },
  {
    title: "Colloquio con la maestra",
    by: "Marco",
    with: ["Laura", "Tommaso"],
    visibility: "household",
    from: "2026-10-22T14:30:00Z",
    to: "2026-10-22T15:15:00Z",
  },
];

export type Options = {
  /** Events served for the day; "fail" = the reading fails */
  events?: FakeEvent[] | "fail";
  /** "ok" = a new id, "fail" = server error, "hold" = never answers */
  save?: "ok" | "fail" | "hold";
  /** "fail" = the list of the people of the Nest cannot be read */
  people?: "ok" | "fail";
};

export async function installFakes(page: Page, options: Options = {}) {
  const { events = [], save = "ok", people = "ok" } = options;
  let resolveNames: (names: Names) => void = () => {};
  const names = new Promise<Names>((resolve) => (resolveNames = resolve));
  const served = { events: 0 };

  await page.route("**/rest/v1/household_members*", async (route) => {
    const select = new URL(route.request().url()).searchParams.get("select");
    // Only the list of the people (the sheet also asks for its own id alone)
    if (route.request().method() !== "GET" || !select?.includes("color")) {
      return route.fallback();
    }
    if (people === "fail") {
      return route.fulfill({ status: 500, json: { message: "boom" } });
    }
    const response = await route.fetch();
    const rows = (await response.json()) as { id: string; name: string }[];
    resolveNames(new Map(rows.map((row) => [row.name, row.id])));
    return route.fulfill({ response });
  });

  await page.route("**/rest/v1/rpc/list_household_events*", async (route) => {
    served.events += 1;
    if (events === "fail") {
      return route.fulfill({ status: 500, json: { message: "boom" } });
    }
    const known = await Promise.race([
      names,
      new Promise<Names>((resolve) =>
        setTimeout(() => resolve(new Map()), 5000),
      ),
    ]);
    const id = (name: string) => known.get(name) ?? `missing-${name}`;
    return route.fulfill({
      json: events.map((event, index) =>
        event.masked
          ? {
              id: null,
              title: null,
              starts_at: event.from,
              ends_at: event.to,
              visibility: "busy",
              is_masked: true,
              author_member_id: id(event.by),
              location: null,
              escort_member_id: null,
              member_ids: null,
            }
          : {
              id: `00000000-0000-4000-8000-0000000001${String(index).padStart(2, "0")}`,
              title: event.title,
              starts_at: event.from,
              ends_at: event.to,
              visibility: event.visibility,
              is_masked: false,
              author_member_id: id(event.by),
              location: null,
              escort_member_id: null,
              member_ids: event.with.map(id),
            },
      ),
    });
  });

  await page.route("**/rest/v1/rpc/create_event*", async (route: Route) => {
    if (save === "fail") {
      return route.fulfill({ status: 500, json: { message: "boom" } });
    }
    if (save === "hold") return; // the request stays open until the test ends
    return route.fulfill({ json: SAVED_ID });
  });

  return served;
}
