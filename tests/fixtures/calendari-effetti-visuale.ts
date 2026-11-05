import type { Page, Route } from "@playwright/test";
import { CENA, EVENT_ID, MEMBER, type FakeRow } from "./dettaglio-impegno-fake";

// Helpers of the visual and accessibility tests of the effects of «Calendari
// collegati» on the other pages (#34 part 2, PR #303): the source label on
// the rows, an imported event in Dettaglio impegno, the «Anche su» row.
//
// Nothing is written to the database. The label and the link of an event with
// its calendar are put on the answers of the page by the browser (the database
// says them only to the author of a real imported event, which needs a real
// provider and the server clock).

export type Source = "google" | "outlook";

/**
 * Puts `source_provider` on the rows of the event lists the page reads
 * (`list_household_events`, `search_household`) whose title is in `titles`.
 * It wraps `fetch` before the page starts, so it works on top of the fakes
 * of the other fixtures as well as on the real database.
 */
export async function labelSources(
  page: Page,
  titles: Record<string, Source>,
): Promise<void> {
  await page.addInitScript((map: Record<string, Source>) => {
    const original = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const response = await original(input, init);
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      if (!/\/rpc\/(list_household_events|search_household)/.test(url)) {
        return response;
      }
      try {
        const rows = (await response.clone().json()) as unknown;
        if (!Array.isArray(rows)) return response;
        for (const row of rows as Array<Record<string, unknown>>) {
          const source = map[String(row.title)];
          if (source) row.source_provider = source;
        }
        return new Response(JSON.stringify(rows), {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        });
      } catch {
        return response;
      }
    };
  }, titles);
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

/** Marco's event of «Call con Acme», the one of the mockup 09: 16:00 – 17:00. */
export const CALL: FakeRow = {
  ...CENA,
  id: EVENT_ID,
  title: "Call con Acme",
  starts_at: "2026-10-20T14:00:00+00:00",
  ends_at: "2026-10-20T15:00:00+00:00",
  occurrence_date: "2026-10-20",
  location: "Teams",
  notes: null,
  visibility: "busy",
  author_member_id: MEMBER.marco,
  member_ids: [MEMBER.marco],
  series_starts_at: "2026-10-20T14:00:00+00:00",
  series_ends_at: "2026-10-20T15:00:00+00:00",
};

export type CalendarSide = {
  /** Where the event comes from, as the database says it to its author */
  link?: {
    isImported: boolean;
    isSent?: boolean;
    provider: "Google" | "Outlook" | null;
    calendarName?: string | null;
  };
  /** «Dove vanno i nuovi impegni»: the calendar chosen, or nothing */
  target?: { provider: "google" | "outlook"; name: string } | null;
  /** The account of the target needs «Ricollega» */
  reconnect?: boolean;
  /** `set_event_also_on` fails (the event itself is saved) */
  alsoOnFails?: boolean;
};

/**
 * The reads of Dettaglio impegno about linked calendars: where the event
 * comes from, and the calendar of «Dove vanno i nuovi impegni». Install it
 * next to `installEventFake`.
 */
export async function installCalendarSide(
  page: Page,
  side: CalendarSide,
): Promise<void> {
  const link = side.link ?? { isImported: false, provider: null };
  await page.route("**/rest/v1/rpc/get_event_calendar_link*", (route) => {
    if (route.request().method() === "OPTIONS") {
      return route.fulfill({ status: 204, headers: CORS });
    }
    return json(route, 200, [
      {
        is_imported: link.isImported,
        is_sent: link.isSent ?? false,
        provider: link.provider ? link.provider.toLowerCase() : null,
        calendar_name: link.calendarName ?? null,
      },
    ]);
  });

  // `.maybeSingle()` asks for one object, or nothing.
  const one = (route: Route, row: Record<string, unknown> | null) => {
    if (route.request().method() === "OPTIONS") {
      return route.fulfill({ status: 204, headers: CORS });
    }
    if (!row) {
      return route.fulfill({
        status: 406,
        contentType: "application/json",
        headers: CORS,
        body: JSON.stringify({
          code: "PGRST116",
          details: "The result contains 0 rows",
          hint: null,
          message: "JSON object requested, multiple (or no) rows returned",
        }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/vnd.pgrst.object+json",
      headers: CORS,
      body: JSON.stringify(row),
    });
  };
  await page.route("**/rest/v1/external_calendars*", (route) =>
    one(
      route,
      side.target
        ? { name: side.target.name, account_id: "ac000000-0000-4000-8000-0001" }
        : null,
    ),
  );
  await page.route("**/rest/v1/calendar_accounts*", (route) =>
    one(
      route,
      side.target
        ? {
            provider: side.target.provider,
            status: side.reconnect ? "reconnect" : "active",
          }
        : null,
    ),
  );
  if (side.alsoOnFails) {
    await page.route("**/rest/v1/rpc/set_event_also_on*", (route) => {
      if (route.request().method() === "OPTIONS") {
        return route.fulfill({ status: 204, headers: CORS });
      }
      return json(route, 500, { code: "XX000", message: "fake failure" });
    });
  }
}
