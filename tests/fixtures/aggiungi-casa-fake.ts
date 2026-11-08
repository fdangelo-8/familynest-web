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

export const SHOPPING_ID = "00000000-0000-4000-8000-00000000a024";

/** A thing of the shopping list the sheet can open to edit (#335). */
export type ShoppingThing = {
  id: string;
  name: string;
  quantity: string | null;
};

export const SHOPPING_THING: ShoppingThing = {
  id: SHOPPING_ID,
  name: "Latte",
  quantity: "2 l",
};

export type CasaOptions = Options & {
  /** Names of the things still to take in the shopping list */
  toTake?: string[];
  /** The thing of the shopping list the sheet opens to edit (#335) */
  shopping?: ShoppingThing;
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
    shopping,
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
      // The thing to edit, read by its id
      if (new URL(route.request().url()).searchParams.get("id")) {
        if (read === "hold") return;
        if (read === "fail") {
          return route.fulfill({ status: 500, json: { message: "boom" } });
        }
        if (read === "gone" || !shopping) return route.fulfill({ json: [] });
        return route.fulfill({ json: [{ ...shopping, checked_at: null }] });
      }
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
    if (method === "DELETE") {
      if (remove === "fail") {
        return route.fulfill({ status: 500, json: { message: "boom" } });
      }
      return route.fulfill({ status: 204, body: "" });
    }
    return route.fallback();
  });
  await page.route("**/rest/v1/shopping_item_assignees*", (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route("**/rest/v1/rpc/update_shopping_item*", (route) => {
    if (write === "hold") return;
    if (write === "fail") {
      return route.fulfill({ status: 500, json: { message: "boom" } });
    }
    if (write === "gone") {
      return route.fulfill({
        status: 404,
        json: { code: "P0002", message: "gone" },
      });
    }
    return route.fulfill({ status: 204, body: "" });
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

  // The people of the thing to edit (#333): one row per assignee, like the real table.
  const assigneesTable =
    (kind: "todo" | "deadline") => async (route: Route) => {
      if (route.request().method() !== "GET") return route.fallback();
      if (read === "hold") return;
      if (read === "fail") {
        return route.fulfill({ status: 500, json: { message: "boom" } });
      }
      if (read === "gone" || !thing || thing.kind !== kind) {
        return route.fulfill({ json: [] });
      }
      const names = await ids();
      const member = thing.assignee ? names.get(thing.assignee) : null;
      return route.fulfill({
        json: member
          ? [{ member_id: member, created_at: "2026-10-01T10:00:00Z" }]
          : [],
      });
    };
  await page.route("**/rest/v1/todo_assignees*", assigneesTable("todo"));
  await page.route(
    "**/rest/v1/deadline_assignees*",
    assigneesTable("deadline"),
  );

  // The writes of #333 are calls to functions of the database.
  const writeRpc =
    (answer: () => unknown, status = 200) =>
    (route: Route) => {
      if (route.request().method() !== "POST") return route.fallback();
      if (write === "hold") return;
      if (write === "fail") {
        return route.fulfill({ status: 500, json: { message: "boom" } });
      }
      if (write === "gone") {
        return route.fulfill({
          status: 404,
          json: { code: "P0002", message: "gone" },
        });
      }
      const body = answer();
      return body === undefined
        ? route.fulfill({ status: 204, body: "" })
        : route.fulfill({ status, json: body });
    };
  await page.route(
    "**/rest/v1/rpc/create_todo*",
    writeRpc(() => uuid(9100)),
  );
  await page.route(
    "**/rest/v1/rpc/create_deadline*",
    writeRpc(() => uuid(9101)),
  );
  await page.route(
    "**/rest/v1/rpc/update_todo*",
    writeRpc(() => undefined),
  );
  await page.route(
    "**/rest/v1/rpc/update_deadline*",
    writeRpc(() => undefined),
  );
  await page.route("**/rest/v1/rpc/add_shopping_items*", (route) => {
    // One id for every thing of the phrase, as the real function answers.
    const items = (route.request().postDataJSON() as { p_items?: unknown[] })
      .p_items;
    const count = Array.isArray(items) ? items.length : 0;
    return writeRpc(() =>
      Array.from({ length: count }, (_, index) => uuid(9102 + index)),
    )(route);
  });
  await page.route("**/rest/v1/rpc/undo_added_shopping_items*", (route) =>
    route.fulfill({ json: [] }),
  );

  return served;
}
