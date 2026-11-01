import type { Page, Route } from "@playwright/test";
import { installFakes, type Options } from "./aggiungi-fake";

// Fakes for the tests of Add · Spesa, Da fare and Scadenza and of the edit of a
// thing (#22): visual and accessibility specs. Same idea as aggiungi-fake.ts:
// nothing is written to the database; the shopping list, the todos and the
// deadlines the sheet reads and writes are served by page.route. Sign-in, the
// Nest and its members are real: the ids of the members (Marco, Laura, Sofia…)
// come from the real response and are used in the fake rows.

export const TODO_ID = "00000000-0000-4000-8000-00000000a022";
export const DEADLINE_ID = "00000000-0000-4000-8000-00000000a023";

/** A thing the sheet can open to edit (names are the members of the seed). */
export type Thing = {
  kind: "todo" | "deadline";
  id: string;
  title: string;
  assignee: string | null;
  forName: string | null;
  dueDate: string | null;
  isPrivate: boolean;
  createdBy: string;
  reminders?: number[];
};

export const TODO_THING: Thing = {
  kind: "todo",
  id: TODO_ID,
  title: "Firmare autorizzazione gita",
  assignee: "Marco",
  forName: "Sofia",
  dueDate: "2026-10-23",
  isPrivate: false,
  createdBy: "Marco",
};

export const DEADLINE_THING: Thing = {
  kind: "deadline",
  id: DEADLINE_ID,
  title: "Bollo auto",
  assignee: "Marco",
  forName: null,
  dueDate: "2026-12-07",
  isPrivate: false,
  createdBy: "Marco",
  reminders: [30, 7, 1],
};

export type CasaOptions = Options & {
  /** Names of the things still to take in the shopping list */
  toTake?: string[];
  /** The thing the sheet opens to edit */
  thing?: Thing;
  /** Reading of that thing: "gone" = not there (any more), "hold" = never answers */
  read?: "ok" | "gone" | "fail" | "hold";
  /** Writes (insert, update): "gone" = the update goes through but the row is not there any more */
  write?: "ok" | "fail" | "hold" | "gone";
  /** Delete of the thing */
  remove?: "ok" | "fail";
};

function uuid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

export async function installCasaFakes(page: Page, options: CasaOptions = {}) {
  const {
    toTake = [],
    thing,
    read = "ok",
    write = "ok",
    remove = "ok",
  } = options;
  const served = await installFakes(page, options);

  const ids = async () =>
    Promise.race([
      served.names,
      new Promise<Map<string, string>>((resolve) =>
        setTimeout(() => resolve(new Map()), 5000),
      ),
    ]);

  await page.route("**/rest/v1/shopping_items*", async (route) => {
    const method = route.request().method();
    if (method === "GET") {
      return route.fulfill({
        json: toTake.map((name, index) => ({ id: uuid(9000 + index), name })),
      });
    }
    if (method === "POST") {
      if (write === "hold") return;
      if (write === "fail") {
        return route.fulfill({ status: 500, json: { message: "boom" } });
      }
      return route.fulfill({ status: 201, body: "" });
    }
    return route.fallback();
  });

  const thingTable = (table: "todos" | "deadlines") => async (route: Route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    if (method === "GET") {
      const byId = url.searchParams.get("id");
      if (!byId || !thing) return route.fulfill({ json: [] });
      const select = url.searchParams.get("select") ?? "";
      // The check after a write: is the row still there?
      if (select === "id") {
        return route.fulfill({
          json: write === "gone" ? [] : [{ id: thing.id }],
        });
      }
      if (read === "hold") return;
      if (read === "fail") {
        return route.fulfill({ status: 500, json: { message: "boom" } });
      }
      const mine = thing.kind === (table === "todos" ? "todo" : "deadline");
      if (read === "gone" || !mine) return route.fulfill({ json: [] });
      const names = await ids();
      const id = (name: string | null) =>
        name ? (names.get(name) ?? null) : null;
      return route.fulfill({
        json: [
          {
            id: thing.id,
            title: thing.title,
            assignee_member_id: id(thing.assignee),
            for_member_id: id(thing.forName),
            due_date: thing.dueDate,
            is_private: thing.isPrivate,
            created_by_member_id: id(thing.createdBy),
            ...(thing.reminders ? { reminder_days: thing.reminders } : {}),
          },
        ],
      });
    }
    if (method === "POST" || method === "PATCH") {
      if (write === "hold") return;
      if (write === "fail") {
        return route.fulfill({ status: 500, json: { message: "boom" } });
      }
      return route.fulfill({ status: method === "POST" ? 201 : 204, body: "" });
    }
    if (method === "DELETE") {
      if (remove === "fail") {
        return route.fulfill({ status: 500, json: { message: "boom" } });
      }
      return route.fulfill({ status: 204, body: "" });
    }
    return route.fallback();
  };
  await page.route("**/rest/v1/todos*", thingTable("todos"));
  await page.route("**/rest/v1/deadlines*", thingTable("deadlines"));
  await page.route("**/rest/v1/rpc/undo_added_shopping_items*", (route) =>
    route.fulfill({ json: [] }),
  );

  return served;
}
