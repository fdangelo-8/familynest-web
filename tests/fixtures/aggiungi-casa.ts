import {
  expect,
  type BrowserContext,
  type Locator,
  type Page,
} from "@playwright/test";
import { waitForAnimationsToEnd } from "./animations";
import {
  NOW,
  dialogOf,
  fieldOf,
  openAdd,
  pauseClock,
  recordNetwork,
  sideOf,
  toastOf,
} from "./aggiungi";
import { CORS, busy, column, setClock, type CasaNest, type Day } from "./casa";

// Helpers for the tests of Aggiungi · Spesa, Da fare e Scadenze (#22).
//
// Data: every test builds its own throwaway Nests (fixtures/casa.ts: `casa`,
// `bianchi`), so desktop and mobile never meet on the same rows and nothing
// depends on the seed. Rows are created and read with the session of a member
// of the Nest (RLS applies); the administrative key is used only to find the id
// of a row just created. Credentials and keys come only from environment
// variables. No timed waits: every wait is a web-first assertion or a poll.
//
// Assumptions about the page (from the requirement, the designer's
// specification and the comments of the issue), listed in the report to the
// coordinator:
// - create sheet: `role="dialog"` named «Aggiungi»; edit sheet: named «Modifica»;
// - the edit sheet opens from `/aggiungi?modifica=<id>` (only the id), the
//   type from `/aggiungi?tipo=spesa|da-fare|scadenza`;
// - the writes are plain inserts / updates / deletes on `shopping_items`,
//   `todos`, `deadlines` (POST / PATCH / DELETE on `/rest/v1/<table>`), and the
//   reading of the thing to edit is a GET on `todos` / `deadlines` with `id=eq.`.

export { NOW, TODAY } from "./aggiungi";
export { pauseClock, toastOf };

// ------------------------------------------------------------------- texts

export const SAVE_FAILED_ALERT =
  "Non siamo riusciti a salvare. Controlla la connessione e riprova.";
export const GONE_TITLE = "Questa cosa non c'è più";
export const GONE_TEXT = "Forse l'ha tolta qualcun altro.";
export const GONE_ALERT =
  "Questa cosa non c'è più. Forse l'ha tolta qualcun altro.";

export const SHARED = "Lo vede tutto il Nest";
export const PRIVATE = "Lo vedi solo tu";

// ----------------------------------------------------------------- locators

/** The create sheet («Aggiungi») or the edit sheet («Modifica») with its parts. */
export function sheet(page: Page, mode: "add" | "edit" = "add") {
  const dialog =
    mode === "add"
      ? dialogOf(page)
      : page.getByRole("dialog", { name: "Modifica", exact: true });
  const field =
    mode === "add"
      ? fieldOf(page)
      : dialog.getByRole("textbox", { name: "Titolo", exact: true });
  const types = dialog.getByRole("group", { name: "Tipo", exact: true });
  const who = dialog.getByRole("group", {
    name: "Chi se ne occupa",
    exact: true,
  });
  const remind = dialog.getByRole("group", { name: "Avvisami", exact: true });
  return {
    dialog,
    field,
    types,
    /** A voice of the «Tipo» selector. */
    type: (name: "Impegno" | "Da fare" | "Spesa" | "Scadenza") =>
      types.getByRole("button", { name, exact: true }),
    /** The region of the labels («Entro venerdì», «Per Sofia», visibility). */
    labels: dialog.locator('[aria-live="polite"]'),
    who,
    /** A chip of «Chi se ne occupa»; «Tu» is the signed-in member. */
    person: (name: string) => who.getByRole("button", { name, exact: true }),
    remind,
    /** A chip of «Avvisami». */
    reminder: (name: string) =>
      remind.getByRole("button", { name, exact: true }),
    /** The visibility button (its name says its state). */
    visibility: dialog.getByRole("button", {
      name: /^(Lo vede tutto il Nest|Lo vedi solo tu)$/,
    }),
    button: (name: string | RegExp) =>
      dialog.getByRole("button", {
        name,
        ...(typeof name === "string" ? { exact: true } : {}),
      }),
    /** The preview of the shopping list: the only list of the sheet. */
    list: dialog.getByRole("list"),
    /** The preview card of a deadline. */
    card: dialog.locator(".riga-scadenza"),
    /** The text of the error under the field (it is the field's description). */
    expectError: async (text: string) => {
      await expect(field).toHaveAttribute("aria-invalid", "true");
      await expect(field).toHaveAccessibleDescription(text);
    },
  };
}

/** The label (static chip) with exactly this text. */
export const labelText = (page: Page, text: string | RegExp) =>
  page
    .getByRole("dialog")
    .locator('[aria-live="polite"]')
    .getByText(text, typeof text === "string" ? { exact: true } : {});

/** A toast (role status) that contains the text. */
export const toastWith = (page: Page, text: string) =>
  page.getByRole("status").filter({ hasText: text });

/** The confirmation dialog of the deletion. */
export const confirmOf = (page: Page, title: string) =>
  page.getByRole("alertdialog", { name: `Eliminare «${title}»?` });

// -------------------------------------------------------------------- open

/**
 * True when React has attached its props to the element: the page is hydrated
 * and a tap or a key will be handled (LEZIONI: no clicks before hydration).
 */
export async function hydrated(target: Locator): Promise<void> {
  await expect
    .poll(
      () =>
        target.evaluate((el) =>
          Object.keys(el).some((key) => key.startsWith("__reactProps$")),
        ),
      { timeout: 20_000 },
    )
    .toBe(true);
}

/**
 * Waits until the sheet is open, its field is hydrated and the finite
 * animations (the sheet rises) are over. No fixed wait.
 */
export async function waitForSheet(
  page: Page,
  mode: "add" | "edit" = "add",
): Promise<void> {
  const s = sheet(page, mode);
  await expect(s.dialog).toBeVisible({ timeout: 20_000 });
  await expect(s.field).toBeVisible();
  await hydrated(s.field);
  await waitForAnimationsToEnd(page);
}

/**
 * Signs `who` in, fixes the browser clock (it keeps running), loads `url`
 * directly and waits for the sheet. With `ready` it waits for that element
 * instead of the field (the «non c'è più» message has no field).
 */
export async function openDirect(
  page: Page,
  baseURL: string | undefined,
  nest: CasaNest,
  who: string,
  url: string,
  options: {
    mode?: "add" | "edit";
    time?: Date;
    lens?: "io" | "nest";
    ready?: (page: Page) => Locator;
  } = {},
): Promise<void> {
  const { mode = "add", time = NOW, lens = "io", ready } = options;
  await setClock(page, time);
  await page.addInitScript((value) => {
    window.sessionStorage.setItem("familynest.lens", value);
  }, lens);
  await nest.signIn(page, baseURL, who);
  await page.goto(url);
  if (ready) {
    await expect(sheet(page, mode).dialog).toBeVisible({ timeout: 20_000 });
    await expect(ready(page)).toBeVisible({ timeout: 20_000 });
    await waitForAnimationsToEnd(page);
  } else {
    await waitForSheet(page, mode);
  }
}

/** Opens the edit sheet of a thing from its address (only the id travels). */
export const editUrl = (id: string) => `/aggiungi?modifica=${id}`;

/** Opens Aggiungi from the navigation (over Today) with the clock fixed. */
export async function openAddFromNav(
  page: Page,
  baseURL: string | undefined,
  nest: CasaNest,
  who: string,
  options: { lens?: "io" | "nest"; time?: Date } = {},
): Promise<void> {
  await openAdd(page, baseURL, nest, who, options);
  await waitForSheet(page, "add");
}

/** Signs in, fixes the clock and loads a page of Casa until its column is drawn. */
export async function openCasaPage(
  page: Page,
  baseURL: string | undefined,
  nest: CasaNest,
  who: string,
  path: "/casa/da-fare" | "/casa/spesa",
  options: { time?: Date } = {},
): Promise<void> {
  await setClock(page, options.time ?? NOW);
  await nest.signIn(page, baseURL, who);
  await page.goto(path);
  await expect(
    column(page, path === "/casa/da-fare" ? "Da fare" : "Spesa"),
  ).toBeVisible({ timeout: 20_000 });
  await expect(busy(page)).toHaveCount(0);
}

/** On /casa/da-fare: taps the title of a row until the edit sheet is open. */
export async function openEditFromRow(
  page: Page,
  baseURL: string | undefined,
  nest: CasaNest,
  who: string,
  title: string,
  options: { time?: Date } = {},
): Promise<void> {
  await openCasaPage(page, baseURL, nest, who, "/casa/da-fare", options);
  await tapRowTitle(page, title);
}

/** Taps the title button of a row of Casa · Da fare until the edit sheet opens. */
export async function tapRowTitle(page: Page, title: string): Promise<void> {
  const button = page.getByRole("button", { name: `Modifica: ${title}` });
  await expect(button).toBeVisible({ timeout: 20_000 });
  await expect(async () => {
    await button.click();
    await expect(sheet(page, "edit").dialog).toBeVisible({ timeout: 2000 });
  }).toPass();
  await waitForSheet(page, "edit");
}

/** Closes the context at the end of a test (second browser of the same Nest). */
export async function secondBrowser(
  browser: import("@playwright/test").Browser,
  baseURL: string | undefined,
  viewport: { width: number; height: number } | null | undefined,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    baseURL,
    viewport: viewport ?? undefined,
    locale: "it-IT",
    timezoneId: "Europe/Rome",
  });
  const page = await context.newPage();
  return { context, page };
}

// ------------------------------------------------- Casa · Da fare, rows

const col = (page: Page) => column(page, "Da fare");

/** A group of Casa · Da fare, by the name of its h3. */
export const todoGroup = (page: Page, name: string) =>
  col(page)
    .locator("section.sezione")
    .filter({ has: page.getByRole("heading", { level: 3, name }) });

/** A row of Casa · Da fare, by title. */
export const todoRow = (page: Page, title: string) =>
  col(page)
    .locator("li.riga-lista")
    .filter({ has: page.locator(".riga-lista__titolo", { hasText: title }) });

// ---------------------------------------------------------------- database

export type TodoFull = {
  id: string;
  title: string;
  assignee_member_id: string | null;
  for_member_id: string | null;
  due_date: string | null;
  is_private: boolean;
  created_by_member_id: string | null;
  updated_at: string;
};

export type DeadlineFull = {
  id: string;
  title: string;
  due_date: string;
  assignee_member_id: string | null;
  for_member_id: string | null;
  is_private: boolean;
  reminder_days: number[];
  note: string | null;
  created_by_member_id: string | null;
  updated_at: string;
};

export type ShoppingFull = {
  id: string;
  name: string;
  quantity: string | null;
  checked_at: string | null;
};

function clientOf(nest: CasaNest, who: string) {
  const user = nest.users[who];
  if (!user) throw new Error(`${who} non ha un account di prova`);
  return user.client;
}

/** The things to do `who` may read (RLS applies). */
export async function todosOf(
  nest: CasaNest,
  who: string,
): Promise<TodoFull[]> {
  const { data, error } = await clientOf(nest, who)
    .from("todos")
    .select(
      "id, title, assignee_member_id, for_member_id, due_date, is_private, created_by_member_id, updated_at",
    );
  if (error) throw new Error("Lettura delle cose da fare di prova fallita");
  return (data ?? []) as TodoFull[];
}

/** The deadlines `who` may read (RLS applies). */
export async function deadlinesOf(
  nest: CasaNest,
  who: string,
): Promise<DeadlineFull[]> {
  const { data, error } = await clientOf(nest, who)
    .from("deadlines")
    .select(
      "id, title, due_date, assignee_member_id, for_member_id, is_private, reminder_days, note, created_by_member_id, updated_at",
    );
  if (error) throw new Error("Lettura delle scadenze di prova fallita");
  return (data ?? []) as DeadlineFull[];
}

/** The shopping list `who` may read (RLS applies). */
export async function shoppingOf(
  nest: CasaNest,
  who: string,
): Promise<ShoppingFull[]> {
  const { data, error } = await clientOf(nest, who)
    .from("shopping_items")
    .select("id, name, quantity, checked_at");
  if (error) throw new Error("Lettura della spesa di prova fallita");
  return (data ?? []) as ShoppingFull[];
}

/** Marks a thing to buy as taken (the only update the database allows). */
export async function takeShopping(
  nest: CasaNest,
  who: string,
  name: string,
): Promise<void> {
  const { error } = await clientOf(nest, who)
    .from("shopping_items")
    .update({ checked_at: new Date().toISOString() })
    .eq("name", name);
  if (error) throw new Error("Cosa presa di prova non segnata");
}

export type DeadlineSeed = {
  title: string;
  due: Day;
  /** Days before; 0 = the same day. Default 30, 7, 1. */
  reminders?: number[];
  assignee?: string;
  forMember?: string;
  priv?: boolean;
};

/** Creates a deadline with the session of `who` and returns its id. */
export async function seedDeadline(
  nest: CasaNest,
  who: string,
  spec: DeadlineSeed,
): Promise<string> {
  const user = nest.users[who];
  if (!user) throw new Error(`${who} non ha un account di prova`);
  const memberId = (name: string | undefined) => {
    if (name === undefined) return null;
    const id = nest.members[name];
    if (!id) throw new Error(`Membro di prova sconosciuto: ${name}`);
    return id;
  };
  const { error } = await user.client.from("deadlines").insert({
    title: spec.title,
    due_date: spec.due,
    reminder_days: spec.reminders ?? [30, 7, 1],
    assignee_member_id: memberId(spec.assignee),
    for_member_id: memberId(spec.forMember),
    is_private: spec.priv ?? false,
  });
  if (error) throw new Error("Scadenza di prova non creata");
  const { data, error: readError } = await user.admin
    .from("deadlines")
    .select("id")
    .eq("household_id", nest.householdId)
    .eq("title", spec.title);
  if (readError || !data || data.length === 0)
    throw new Error("Scadenza di prova non trovata");
  return data[data.length - 1]!.id as string;
}

/** Deletes a row with the session of `who` (another session of the same Nest). */
export async function deleteRow(
  nest: CasaNest,
  who: string,
  table: "todos" | "deadlines",
  id: string,
): Promise<void> {
  const { error } = await clientOf(nest, who).from(table).delete().eq("id", id);
  if (error) throw new Error("Cancellazione di prova fallita");
}

// ----------------------------------------------------------------- network

type Table = "shopping_items" | "todos" | "deadlines";

const isTable = (url: URL, table: Table) =>
  url.pathname.endsWith(`/rest/v1/${table}`);

/**
 * Makes every request with `method` to the table fail with a database error
 * (500) while `failing()` is true. Other requests, and the preflight, go on.
 * A 500 is answered at once: the data client retries a GET that never gets an
 * answer (LEZIONI).
 */
export async function refuseWrites(
  page: Page,
  table: Table,
  method: "POST" | "PATCH" | "DELETE",
  failing: () => boolean = () => true,
): Promise<void> {
  await page.route(
    (url) => isTable(url, table),
    async (route) => {
      if (route.request().method() !== method || !failing()) {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        headers: CORS,
        body: JSON.stringify({ code: "XX000", message: "boom" }),
      });
    },
  );
}

/** Same for a function of the database (`/rest/v1/rpc/<name>`). */
export async function refuseRpc(page: Page, name: string): Promise<void> {
  await page.route(
    (url) => url.pathname.endsWith(`/rest/v1/rpc/${name}`),
    async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        headers: CORS,
        body: JSON.stringify({ code: "XX000", message: "boom" }),
      });
    },
  );
}

/**
 * Holds the requests with `method` to the table until `release()` is called.
 * `calls()` counts the requests that reached the page's network.
 */
export async function holdRequests(
  page: Page,
  table: Table,
  method: "POST" | "PATCH" | "GET",
  onlyWithId = false,
): Promise<{ release: () => void; calls: () => number }> {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let calls = 0;
  await page.route(
    (url) => isTable(url, table),
    async (route) => {
      const url = new URL(route.request().url());
      if (
        route.request().method() !== method ||
        (onlyWithId && !(url.searchParams.get("id") ?? "").startsWith("eq."))
      ) {
        await route.continue();
        return;
      }
      calls += 1;
      await gate;
      await route.continue();
    },
  );
  return { release, calls: () => calls };
}

/** Writes to the data API seen so far, with the method (to prove «no write»). */
export function writesOf(net: ReturnType<typeof recordNetwork>) {
  return net
    .api()
    .filter((request) => ["POST", "PATCH", "DELETE"].includes(request.method));
}

export { recordNetwork, sideOf };

// ------------------------------------------------------------ expectations

/** The accessible names of the buttons of a group, in order. */
export async function expectNames(
  group: Locator,
  names: string[],
): Promise<void> {
  const buttons = group.getByRole("button");
  await expect(buttons).toHaveCount(names.length);
  for (const [index, name] of names.entries()) {
    await expect(buttons.nth(index)).toHaveAccessibleName(name);
  }
}

/** Nobody is chosen in a group of persons. */
export async function expectNobody(group: Locator): Promise<void> {
  await expect(group.getByRole("button").first()).toBeVisible();
  await expect(group.locator('[aria-pressed="true"]')).toHaveCount(0);
}

export type PreviewRow = {
  name: string;
  quantity?: string;
  already?: boolean;
};

/** The rows of the shopping preview, in order. */
export async function expectPreview(
  page: Page,
  rows: PreviewRow[],
): Promise<void> {
  const items = sheet(page).list.getByRole("listitem");
  await expect(items).toHaveCount(rows.length);
  for (const [index, row] of rows.entries()) {
    const item = items.nth(index);
    await expect(item.locator(".riga-lista__titolo")).toHaveText(row.name);
    if (row.quantity === undefined) {
      await expect(item.locator(".riga-lista__quantita")).toHaveCount(0);
    } else {
      await expect(item.locator(".riga-lista__quantita")).toHaveText(
        row.quantity,
      );
    }
    const already = item.getByText("Già in lista", { exact: true });
    if (row.already) await expect(already).toBeVisible();
    else await expect(already).toHaveCount(0);
  }
}

/** The countdown card of a deadline: number, unit and day title, info. */
export async function expectCard(
  page: Page,
  expected: { number: string; unit?: string; day?: string; title?: string },
): Promise<void> {
  const card = page.getByRole("dialog").locator(".riga-scadenza");
  // The hidden «, urgente» sits inside the number element when it applies.
  await expect(card.locator(".riga-scadenza__numero")).toHaveText(
    new RegExp(`^${expected.number}(\\s*,\\s*urgente)?$`),
  );
  if (expected.unit !== undefined) {
    await expect(card.locator(".riga-scadenza__unita")).toHaveText(
      expected.unit,
    );
  }
  if (expected.day !== undefined) {
    await expect(card.locator(".riga-lista__titolo")).toHaveText(expected.day);
  }
  if (expected.title !== undefined) {
    await expect(card.locator(".riga-lista__info")).toHaveText(expected.title);
  }
}

/** The state «la cosa non c'è più» of the edit sheet (opening). */
export async function expectGone(page: Page): Promise<void> {
  const s = sheet(page, "edit");
  await expect(s.dialog.getByText(GONE_TITLE, { exact: true })).toBeVisible();
  await expect(s.dialog.getByText(GONE_TEXT)).toBeVisible();
  // The sheet's own «X» is also named «Chiudi»: the button of the message has a test id.
  await expect(s.dialog.getByTestId("aggiungi-gone-chiudi")).toBeVisible();
  await expect(s.dialog.getByRole("textbox")).toHaveCount(0);
}

/** The element that «non c'è più» waits for when the edit sheet is opened. */
export const goneMessage = (page: Page) =>
  sheet(page, "edit").dialog.getByText(GONE_TITLE, { exact: true });
