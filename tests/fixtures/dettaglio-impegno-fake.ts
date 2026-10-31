import type { Page, Route } from "@playwright/test";

// A fake of the database functions of Dettaglio impegno (#19), for the visual
// and accessibility tests: `get_event_occurrence`, `update_event`,
// `update_event_occurrence` and `delete_event_occurrence`.
//
// Why: the screenshots need the exact event of the mockup (Nuoto Sofia) in
// every state, and the test project is shared with other suites. So the
// browser reads and writes the event through this fake (page.route) and
// nothing is written to the database. Sign-in, the Nest and its members are
// real: the member ids below are the ones of the seed (Casa D'Angelo), and
// the page reads the members from the real endpoint.

export const MEMBER = {
  marco: "a1000000-0000-4000-8000-000000000001",
  laura: "a1000000-0000-4000-8000-000000000002",
  sofia: "a1000000-0000-4000-8000-000000000003",
  tommaso: "a1000000-0000-4000-8000-000000000004",
  biscotto: "a1000000-0000-4000-8000-000000000005",
} as const;

export const EVENT_ID = "e0000000-0000-4000-8000-000000000019";

/** Tuesday 20 October 2026, 15:52 (Europe/Rome), like the mockup. */
export const NOW = new Date("2026-10-20T15:52:00+02:00");

export const detailUrl = (day = "2026-10-20") =>
  `/impegni/${EVENT_ID}?giorno=${day}`;

export type FakeRow = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  occurrence_date: string;
  location: string | null;
  notes: string | null;
  visibility: "private" | "busy" | "household";
  author_member_id: string | null;
  escort_member_id: string | null;
  member_ids: string[];
  recurrence: "none" | "weekly" | "monthly";
  recurrence_weekdays: number[] | null;
  recurrence_until: string | null;
  series_starts_at: string;
  series_ends_at: string;
  is_modified: boolean;
};

/** The event of the mockup: Nuoto Sofia, every Tuesday and Thursday, open on the 20th. */
export const NUOTO: FakeRow = {
  id: EVENT_ID,
  title: "Nuoto Sofia",
  starts_at: "2026-10-20T15:00:00+00:00",
  ends_at: "2026-10-20T16:30:00+00:00",
  occurrence_date: "2026-10-20",
  location: "Piscina comunale, Lissone",
  notes: "Portare la cuffia",
  visibility: "household",
  author_member_id: MEMBER.laura,
  escort_member_id: MEMBER.laura,
  member_ids: [MEMBER.sofia],
  recurrence: "weekly",
  recurrence_weekdays: [2, 4],
  recurrence_until: null,
  series_starts_at: "2026-10-06T15:00:00+00:00",
  series_ends_at: "2026-10-06T16:30:00+00:00",
  is_modified: false,
};

/** Marco's own event, which does not repeat: Friday 23 October, 20:00 – 22:30. */
export const CENA: FakeRow = {
  id: EVENT_ID,
  title: "Cena da Marta",
  starts_at: "2026-10-23T18:00:00+00:00",
  ends_at: "2026-10-23T20:30:00+00:00",
  occurrence_date: "2026-10-23",
  location: "Via Roma 12, Monza",
  notes: "Portare il dolce",
  visibility: "household",
  author_member_id: MEMBER.marco,
  escort_member_id: null,
  member_ids: [MEMBER.marco, MEMBER.laura],
  recurrence: "none",
  recurrence_weekdays: null,
  recurrence_until: null,
  series_starts_at: "2026-10-23T18:00:00+00:00",
  series_ends_at: "2026-10-23T20:30:00+00:00",
  is_modified: false,
};

/** An «Occupato» of Laura where Marco takes part: the people and «Chi lo vede» are locked for him. */
export const RIUNIONE: FakeRow = {
  ...CENA,
  title: "Riunione di classe",
  visibility: "busy",
  author_member_id: MEMBER.laura,
  location: null,
  notes: null,
  member_ids: [MEMBER.marco, MEMBER.laura],
};

export type DbError = { code: string; message: string };

export type EventFake = {
  /** Lets the slow reads and writes go on */
  release: () => void;
  /** From now on every write fails with this database error (null: works again) */
  failWrites: (error: DbError | "network" | null) => void;
  /** The calls to the write functions, with their arguments */
  writes: () => { name: string; body: Record<string, unknown> }[];
  row: () => FakeRow | null;
};

export type EventFakeOptions = {
  row?: FakeRow;
  /** "slow": the read waits for release(); "error": it fails; "missing": no row (gone or not visible) */
  reads?: "ok" | "slow" | "error" | "missing";
  /** "slow": the writes wait for release() */
  writes?: "ok" | "slow";
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

export async function installEventFake(
  page: Page,
  options: EventFakeOptions = {},
): Promise<EventFake> {
  const reads = options.reads ?? "ok";
  const slowWrites = options.writes === "slow";
  let row: FakeRow | null =
    reads === "missing" ? null : { ...(options.row ?? NUOTO) };
  let release: () => void = () => {};
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  let writeError: DbError | "network" | null = null;
  const writes: { name: string; body: Record<string, unknown> }[] = [];

  await page.route(
    /\/rest\/v1\/rpc\/(get_event_occurrence|update_event_occurrence|update_event|delete_event_occurrence)(\?|$)/,
    async (route) => {
      const request = route.request();
      if (request.method() === "OPTIONS") {
        return route.fulfill({ status: 204, headers: CORS });
      }
      const name = /\/rpc\/([a-z_]+)/.exec(request.url())?.[1] ?? "";
      const body = (request.postDataJSON() ?? {}) as Record<string, unknown>;

      if (name === "get_event_occurrence") {
        if (reads === "error") {
          return json(route, 500, { code: "XX000", message: "fake failure" });
        }
        if (reads === "slow") await released;
        return json(route, 200, row ? [row] : []);
      }

      writes.push({ name, body });
      if (slowWrites) await released;
      if (writeError === "network") return route.abort("failed");
      if (writeError) return json(route, 400, writeError);
      if (!row) {
        return json(route, 400, { code: "P0002", message: "event not found" });
      }

      if (name === "delete_event_occurrence") {
        row = null;
        return route.fulfill({ status: 204, headers: CORS, body: "" });
      }

      // Both update functions: what the form sends becomes the event.
      const next: FakeRow = {
        ...row,
        title: String(body.p_title ?? row.title),
        starts_at: String(body.p_starts_at ?? row.starts_at),
        ends_at: String(body.p_ends_at ?? row.ends_at),
        location: (body.p_location as string | null) ?? null,
        notes: (body.p_notes as string | null) ?? null,
        escort_member_id: (body.p_escort_member_id as string | null) ?? null,
      };
      if (name === "update_event_occurrence") {
        next.is_modified = true;
        row = next;
        return route.fulfill({ status: 204, headers: CORS, body: "" });
      }
      next.visibility =
        (body.p_visibility as FakeRow["visibility"]) ?? row.visibility;
      next.member_ids = (body.p_member_ids as string[]) ?? row.member_ids;
      next.recurrence =
        (body.p_recurrence as FakeRow["recurrence"]) ?? row.recurrence;
      next.recurrence_weekdays =
        (body.p_recurrence_weekdays as number[] | null) ?? null;
      next.recurrence_until =
        (body.p_recurrence_until as string | null) ?? null;
      next.is_modified = false;
      row = next;
      return json(route, 200, [{ id: row.id, day: row.occurrence_date }]);
    },
  );

  return {
    release: () => release(),
    failWrites: (error) => {
      writeError = error;
    },
    writes: () => writes,
    row: () => row,
  };
}
