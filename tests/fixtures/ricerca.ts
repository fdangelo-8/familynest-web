import AxeBuilder from "@axe-core/playwright";
import {
  expect as baseExpect,
  type Locator,
  type Page,
} from "@playwright/test";
import {
  addDays,
  at1552,
  buildNest,
  CORS,
  isMobileProject,
  romeDay,
  setClock,
  test as casaTest,
  weekdayIndex,
  type CasaNest,
  type Day,
  type MemberSpec,
} from "./casa";
import { createEvent } from "./impegni";
import { throwawayConfigured, throwawaySkipReason } from "./throwaway-user";

// Helpers of the tests of Ricerca (#40).
//
// Data: every test builds its own throwaway Nest (tests/fixtures/casa.ts), so
// desktop and mobile never meet on the same rows and nothing depends on the
// seed. Credentials and keys come only from environment variables.
//
// Dates: the criteria use «martedì 20 ottobre 2026», but the search function of
// the database reads «adesso» from the real clock of the server (events that
// end after now, within 365 days). So no test hard-codes a date: `T` is the
// first Tuesday that is at least two days after the real today, the browser
// clock is set at T 15:52 (Rome), and every row is created relative to T. The
// layout of the dates (Oggi / Gio / 27 ...) is then the one of the criteria,
// whatever day the suite runs.

export { CORS, isMobileProject };
export type { CasaNest, Day };
export const expect = baseExpect.configure({ timeout: 10_000 });

// ----------------------------------------------------------------------- dates

function firstTuesdayFrom(day: Day): Day {
  let current = day;
  while (weekdayIndex(current) !== 2) current = addDays(current, 1);
  return current;
}

/** «Oggi» of the tests: a Tuesday in the near future of the real clock. */
export const T: Day = firstTuesdayFrom(addDays(romeDay(), 2));
export const CLOCK: Date = at1552(T);
/** The day `n` days after T. */
export const d = (n: number): Day => addDays(T, n);

const pad = (n: number) => String(n).padStart(2, "0");

/** The day `dayOfMonth` of the month after the one of `day`. */
export function dayInNextMonth(day: Day, dayOfMonth: number): Day {
  const year = Number(day.slice(0, 4));
  const month = Number(day.slice(5, 7));
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return `${nextYear}-${pad(nextMonth)}-${pad(dayOfMonth)}`;
}

/** The year of «novembre» when the clock is at T: this one, or the next in December. */
export function yearOfNovember(day: Day): number {
  const year = Number(day.slice(0, 4));
  return Number(day.slice(5, 7)) <= 11 ? year : year + 1;
}

// ------------------------------------------------------------------------ Nest

/** Casa D'Angelo with two accounts (Marco and Laura), as the criteria need. */
export const MEMBERS: MemberSpec[] = [
  { name: "Marco", kind: "adult", color: "pomodoro", account: true },
  { name: "Laura", kind: "adult", color: "glicine", account: true },
  { name: "Sofia", kind: "child", color: "salvia" },
  { name: "Tommaso", kind: "child", color: "cobalto" },
  { name: "Biscotto", kind: "pet", color: "zafferano" },
];

type Fixtures = {
  /** Throwaway Casa D'Angelo: Marco and Laura sign in */
  nest: CasaNest;
};

/** `test` with the throwaway Nest `nest` (and `bianchi`, from casa.ts). */
export const test = casaTest.extend<Fixtures>({
  nest: async ({}, provide) => {
    casaTest.skip(!throwawayConfigured(), throwawaySkipReason);
    const { nest, cleanup } = await buildNest("Casa D'Angelo", MEMBERS);
    try {
      await provide(nest);
    } finally {
      await cleanup();
    }
  },
});

// ------------------------------------------------------------------------ data

export const NUOTO = "Nuoto Sofia";
export const CUFFIA = "Comprare la cuffia da nuoto";
export const ISCRIZIONE = "Iscrizione al corso di nuoto";

/**
 * «Nuoto Sofia»: «Tutto il Nest» of Marco, every Tuesday and Thursday
 * 17:00 – 18:30 from T, Sofia participant.
 */
export function createNuoto(nest: CasaNest): Promise<string> {
  return createEvent(nest, "Marco", {
    title: NUOTO,
    day: T,
    from: "17:00",
    to: "18:30",
    members: ["Sofia"],
    repeat: { kind: "weekly", weekdays: [2, 4] },
  });
}

/** The data of CA-14: Nuoto Sofia, the cuffia (Laura, by Thursday), the iscrizione (T + 14). */
export async function seedNuoto(nest: CasaNest): Promise<{ eventId: string }> {
  const eventId = await createNuoto(nest);
  await nest.todo("Marco", { title: CUFFIA, assignee: "Laura", due: d(2) });
  await nest.deadline("Marco", {
    title: ISCRIZIONE,
    due: d(14),
    forMember: "Sofia",
  });
  return { eventId };
}

/** Adds a shopping item, with a quantity, and takes it already if asked. */
export async function addShopping(
  nest: CasaNest,
  name: string,
  options: { quantity?: string; taken?: boolean } = {},
): Promise<void> {
  const api = nest.users["Marco"]!.client;
  const { error } = await api
    .from("shopping_items")
    .insert({ name, quantity: options.quantity ?? null });
  if (error) throw new Error("Cosa della spesa di prova non aggiunta");
  if (options.taken) {
    const { error: takeError } = await api
      .from("shopping_items")
      .update({ checked_at: new Date().toISOString() })
      .eq("name", name);
    if (takeError) throw new Error("Cosa della spesa di prova non presa");
  }
}

/** `done_at` of the thing to do with that title, read with the administrative key. */
export async function doneAtOf(
  nest: CasaNest,
  title: string,
): Promise<string | null> {
  const rows = await nest.todoRows();
  return rows.find((row) => row.title === title)?.done_at ?? null;
}

// --------------------------------------------------------------------- opening

export const isMobile = () => isMobileProject();

/** The palette (desktop). */
export const palette = (page: Page) =>
  page.getByRole("dialog", { name: "Cerca nel Nest" });

/** The search field: a searchbox on the page (mobile), the combobox of the palette (desktop). */
export const field = (page: Page) =>
  isMobile()
    ? page.getByRole("searchbox", { name: "Cerca nel Nest" })
    : palette(page).getByRole("combobox", { name: "Cerca nel Nest" });

/** The page (mobile) or the palette (desktop). */
export const surface = (page: Page) =>
  isMobile() ? page.getByTestId("ricerca-pagina") : palette(page);

/**
 * Signs `who` in with the clock at T 15:52 and opens `/ricerca` by address:
 * the page (mobile) or the palette over Today (desktop). Returns when the field
 * has the focus (the page is hydrated) and, on mobile, the people are known.
 */
export async function openSearch(
  page: Page,
  baseURL: string | undefined,
  nest: CasaNest,
  options: { who?: string; clock?: boolean } = {},
): Promise<void> {
  const { who = "Marco", clock = true } = options;
  if (clock) await setClock(page, CLOCK);
  await nest.signIn(page, baseURL, who);
  await page.goto("/ricerca");
  await expectReady(page);
}

/** The field has the focus (hydrated); on mobile also the people of the Nest are there. */
export async function expectReady(page: Page): Promise<void> {
  await expect(field(page)).toBeFocused({ timeout: 20_000 });
  if (isMobile()) {
    await expect(page.getByTestId("ricerca-persone")).toBeVisible({
      timeout: 20_000,
    });
  }
}

/** Types the text in the field in one go and waits for it to be there. */
export async function typeSearch(page: Page, text: string): Promise<void> {
  const input = field(page);
  await input.fill(text);
  await expect(input).toHaveValue(text);
}

// -------------------------------------------------------------------- locators

export const group = (page: Page, kind: string) =>
  page.getByTestId(`ricerca-gruppo-${kind}`);
export const rowsOf = (page: Page, kind: string) =>
  group(page, kind).getByTestId("ricerca-riga");
export const allRows = (page: Page) => page.getByTestId("ricerca-riga");
export const announcement = (page: Page) =>
  page.getByTestId("ricerca-annuncio");
export const filters = (page: Page) => page.getByTestId("ricerca-filtri");
export const toast = (page: Page) => page.getByTestId("toast");
/** The empty state: title and text (the hidden announcement says the same, so no getByText). */
export const empty = (page: Page) => page.getByTestId("ricerca-vuoto");
export const emptyTitle = (page: Page) =>
  empty(page).locator(".stato-vuoto__titolo");
export const heading2 = (page: Page, name: string) =>
  page.getByRole("heading", { level: 2, name, exact: true });

/** Next.js keeps an empty role="alert" (route announcer) in every page. */
export const alerts = (page: Page) =>
  page.getByRole("alert").filter({ hasText: /\S/ });

/** The kinds of the groups on screen, in order (the «Azioni» group of the palette included). */
export async function groupKinds(page: Page): Promise<string[]> {
  return page
    .locator('[data-testid^="ricerca-gruppo-"]')
    .evaluateAll((elements) =>
      elements.map((element) =>
        (element.getAttribute("data-testid") ?? "").replace(
          "ricerca-gruppo-",
          "",
        ),
      ),
    );
}

/** The filter chips as «Tutto 5» (the number only when there is one), in order. */
export async function chipTexts(page: Page): Promise<string[]> {
  return filters(page)
    .getByRole("button")
    .evaluateAll((buttons) =>
      buttons.map((button) => {
        const count = button.querySelector(".chip__conteggio");
        const label = Array.from(button.childNodes)
          .filter((node) => node !== count)
          .map((node) => node.textContent ?? "")
          .join("")
          .trim();
        return count ? `${label} ${count.textContent}` : label;
      }),
    );
}

/** The labels of the chips with `aria-pressed="true"` (count not included). */
export async function pressedChips(page: Page): Promise<string[]> {
  return filters(page)
    .getByRole("button")
    .evaluateAll((buttons) =>
      buttons
        .filter((button) => button.getAttribute("aria-pressed") === "true")
        .map((button) => {
          const count = button.querySelector(".chip__conteggio");
          return Array.from(button.childNodes)
            .filter((node) => node !== count)
            .map((node) => node.textContent ?? "")
            .join("")
            .trim();
        }),
    );
}

/** A filter chip by its label (any number after it is ignored). */
export const filterChip = (page: Page, label: string) =>
  filters(page).getByRole("button", { name: new RegExp(`^${label}\\s*\\d*$`) });

/** A chip of «Prova a cercare»: a button on the page, an option in the palette. */
export const example = (page: Page, text: string) =>
  page
    .getByTestId("ricerca-esempi")
    .getByRole(isMobile() ? "button" : "option", { name: text, exact: true });

/** The titles of the rows of a group (the text of the title, marks included). */
export const titlesOf = (page: Page, kind: string) =>
  rowsOf(page, kind).locator(".riga-lista__titolo");

/** The day shown at the left of the rows of the events. */
export const leadsOf = (page: Page, kind = "event") =>
  rowsOf(page, kind).locator(".riga-lista__ora");

/** The title of a row, found by its text. */
export const rowByTitle = (page: Page, title: string | RegExp) =>
  allRows(page).filter({ hasText: title });

// -------------------------------------------------------------- network traps

export const SEARCH_RPC = "**/rest/v1/rpc/search_household*";

export type SearchCall = { method: string; url: string; body: string };

/** Records the search requests (and the bodies of their answers). */
export function recordSearch(page: Page): {
  calls: SearchCall[];
  answers: string[];
} {
  const calls: SearchCall[] = [];
  const answers: string[] = [];
  page.on("request", (request) => {
    if (!request.url().includes("/rest/v1/rpc/search_household")) return;
    calls.push({
      method: request.method(),
      url: request.url(),
      body: request.postData() ?? "",
    });
  });
  page.on("response", async (response) => {
    if (!response.url().includes("/rest/v1/rpc/search_household")) return;
    if (response.request().method() !== "POST") return;
    try {
      answers.push(await response.text());
    } catch {
      // The page went away before the body arrived: nothing to record.
    }
  });
  return { calls, answers };
}

/** Every search request fails with a database error (not a network error). */
export async function failSearch(page: Page): Promise<void> {
  await page.route(SEARCH_RPC, async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      headers: CORS,
      body: JSON.stringify({ code: "XX000", message: "boom internal detail" }),
    });
  });
}

/**
 * Holds the search requests (the ones that `match`) until `release()`. Returns
 * a promise that resolves when the first held request has arrived.
 */
export async function holdSearch(
  page: Page,
  match: RegExp = /./,
): Promise<{ release: () => void; arrived: Promise<void> }> {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let arrive: () => void = () => {};
  const arrived = new Promise<void>((resolve) => {
    arrive = resolve;
  });
  await page.route(SEARCH_RPC, async (route) => {
    const request = route.request();
    if (
      request.method() === "OPTIONS" ||
      !match.test(request.postData() ?? "")
    ) {
      await route.continue();
      return;
    }
    arrive();
    await gate;
    await route.continue();
  });
  return { release, arrived };
}

/** The update of the things to do (PATCH on `todos`) is refused by the server. */
export async function refuseTodoUpdates(page: Page): Promise<void> {
  await page.route("**/rest/v1/todos*", async (route) => {
    if (route.request().method() !== "PATCH") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      headers: CORS,
      body: JSON.stringify({ code: "XX000", message: "boom internal detail" }),
    });
  });
}

// ---------------------------------------------------------------- local storage

const RECENTS_KEY = (userId: string) => `familynest:recent-searches:${userId}`;

/** Puts recent searches in the browser of Marco (the page must be on the app's origin). */
export async function seedRecents(
  page: Page,
  userId: string,
  recents: string[],
): Promise<void> {
  await page.goto("/oggi");
  await page.evaluate(
    ([key, value]) => window.localStorage.setItem(key!, value!),
    [RECENTS_KEY(userId), JSON.stringify(recents)],
  );
}

/** The recent searches in the browser's storage for that account. */
export async function storedRecents(
  page: Page,
  userId: string,
): Promise<string[]> {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as string[]) : [];
  }, RECENTS_KEY(userId));
}

/** The texts of the rows of «Recenti». */
export const recentTexts = (page: Page) =>
  page
    .getByTestId("ricerca-recenti")
    .locator(".riga-lista__titolo")
    .allTextContents();

// ------------------------------------------------------------------ accessibility

/** axe on the search surface: no serious or critical violation. */
export async function expectNoBlockingViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .include(isMobile() ? '[data-testid="ricerca-pagina"]' : '[role="dialog"]')
    .analyze();
  expect(
    results.violations
      .filter((violation) =>
        ["serious", "critical"].includes(violation.impact ?? ""),
      )
      .map((violation) => ({
        id: violation.id,
        nodes: violation.nodes.map((node) => node.target),
      })),
  ).toEqual([]);
}

/** The computed outline of the container of the field. */
export async function ringOf(
  container: Locator,
): Promise<{ style: string; width: number }> {
  return container.evaluate((element) => {
    const computed = getComputedStyle(element);
    return {
      style: computed.outlineStyle,
      width: parseFloat(computed.outlineWidth),
    };
  });
}
