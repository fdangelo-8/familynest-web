import AxeBuilder from "@axe-core/playwright";
import type { Locator, Page } from "@playwright/test";
import {
  addDays,
  at1552,
  capitalise,
  CORS,
  dayNumber,
  expect,
  lastTuesday,
  monthName,
  romeInstant,
  test as casaTest,
  weekdayIndex,
  weekdayName,
  type CasaNest,
  type Day,
} from "./casa";
import { createEvent, type Visibility } from "./impegni";

// Helpers of the tests of Oggi (#30).
//
// The page keeps two layouts in the DOM (below and from 1024 px), one of them
// `display: none`. Roles are read from the accessibility tree, which leaves out
// the hidden layout, so every locator here goes through `getByRole` or through
// an element found that way. Never `getByText` or a bare CSS selector on the
// whole page: they would also match the hidden copy (strict mode violation).
//
// Data: every test builds its own throwaway Nests (casa.ts) and creates its
// own rows. The Nests of the tests start with the starter list already closed
// (as the seed Nests do), unless a test is about the starter list.

export { expect, addDays };
export type { CasaNest, Day };

export const LENS = "Punto di vista: solo tu o tutto il Nest";
export const LENS_KEY = "familynest.lens";
const GREETING = /^(Buongiorno|Buon pomeriggio|Buonasera|Eccoti),/;

/** The most recent Tuesday that is not in the future (Rome). */
export const T: Day = lastTuesday();
/** Tuesday at 15:52 in Rome. */
export const NOW = at1552(T);
export const d = (days: number): Day => addDays(T, days);

export const SAVE_FAILED =
  "Non siamo riusciti a salvare la modifica. Riprova tra qualche secondo.";
export const TOAST_MS = 5100;

// ---------------------------------------------------------------------- dates

/** The instant of a wall-clock time «H:MM» of a day in Rome. */
export function at(day: Day, time: string): Date {
  const [hour, minute] = time.split(":").map(Number);
  return romeInstant(day, hour ?? 0, minute ?? 0);
}

/** Monday of the week of a day. */
export function mondayOf(day: Day): Day {
  return addDays(day, -((weekdayIndex(day) + 6) % 7));
}

/** «Martedì 20 ottobre». */
export const longDay = (day: Day) =>
  `${capitalise(weekdayName(day))} ${dayNumber(day)} ${monthName(day)}`;

/** «mercoledì 21». */
export const dayWithNumber = (day: Day) =>
  `${weekdayName(day)} ${dayNumber(day)}`;

/** «Gio 22». */
export const shortDay = (day: Day) =>
  `${capitalise(weekdayName(day).slice(0, 3))} ${dayNumber(day)}`;

/** «19 – 25 ottobre» or «28 settembre – 4 ottobre» (same year). */
export function dayRange(first: Day, last: Day): string {
  const a = { day: dayNumber(first), month: monthName(first) };
  const b = { day: dayNumber(last), month: monthName(last) };
  return a.month === b.month
    ? `${a.day} – ${b.day} ${b.month}`
    : `${a.day} ${a.month} – ${b.day} ${b.month}`;
}

/** The most recent Sunday at 15:52 that is not in the future (Rome). */
export function lastSunday(now: Date = new Date()): Day {
  const todayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
  }).format(now);
  let back = weekdayIndex(todayKey) % 7;
  if (back === 0 && now < at1552(todayKey)) back = 7;
  return addDays(todayKey, -back);
}

// ---------------------------------------------------------------------- Nests

/**
 * `test` with the throwaway Nests of casa.ts (Casa D'Angelo with Marco, Casa
 * Bianchi with Giulia and Paolo), already past their starter list.
 */
async function closeStarterList(nest: CasaNest, owner: string): Promise<void> {
  const user = nest.users[owner];
  if (!user) throw new Error(`${owner} non ha un account di prova`);
  const { error } = await user.admin
    .from("households")
    .update({ starter_list_completed_at: new Date().toISOString() })
    .eq("id", nest.householdId);
  if (error) throw new Error("Lista di partenza di prova non chiusa");
}

export const test = casaTest.extend({
  casa: async ({ casa }, provide) => {
    await closeStarterList(casa, "Marco");
    await provide(casa);
  },
  bianchi: async ({ bianchi }, provide) => {
    await closeStarterList(bianchi, "Giulia");
    await provide(bianchi);
  },
});

export { closeStarterList };

export type Ev = {
  title: string;
  day?: Day;
  from: string;
  to: string;
  visibility?: Visibility;
  /** Default: only the author */
  members?: string[];
  place?: string;
  escort?: string;
};

/** Creates an event authored by `who` (today, only the author, by default). */
export function ev(nest: CasaNest, who: string, spec: Ev): Promise<string> {
  return createEvent(nest, who, {
    day: T,
    members: [who],
    visibility: "household",
    ...spec,
  });
}

// ------------------------------------------------------------------ locators

export const h1 = (page: Page) => page.getByRole("heading", { level: 1 });

/** A section of the page by its title (only the layout on screen). */
export const sec = (page: Page, name: string) =>
  page.getByRole("region", { name, exact: true });

/** The head info of a section: «tra 8 minuti», «oggi», «2 da fare». */
export const info = (section: Locator) =>
  section.locator(".sezione__testa .sezione__info").first();

/** The rows of events of a section. */
export const eventRows = (section: Locator) => section.locator("a.riga-evento");

export const busy = (page: Page) => page.locator('[aria-busy="true"]');

/** Next.js keeps an empty role="alert" (route announcer) in every page. */
export const alerts = (page: Page) =>
  page.getByRole("alert").filter({ hasText: /\S/ });

export const toast = (page: Page) =>
  page.getByRole("status").filter({ hasText: "Fatto:" });

export const tick = (page: Page, title: string) =>
  page.getByRole("checkbox", { name: `Segna come fatto: ${title}` });

/** The row of a thing to do (`li[data-todo-id]`) on screen. */
export const todoRow = (page: Page, title: string) =>
  page
    .getByRole("listitem")
    .filter({
      has: page.getByRole("checkbox", { name: `Segna come fatto: ${title}` }),
    });

export const lensGroup = (page: Page) =>
  page.getByRole("group", { name: LENS });

export const lensButton = (page: Page, which: "Io" | "Nest") =>
  lensGroup(page).getByRole("button", { name: new RegExp(`${which}$`) });

/** Clicks a lens button until the state changes (the page is hydrated). */
export async function chooseLens(page: Page, which: "Io" | "Nest") {
  const button = lensButton(page, which);
  await expect(async () => {
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true", {
      timeout: 1000,
    });
  }).toPass();
}

// ---------------------------------------------------------------------- open

export type OpenOptions = {
  path?: string;
  /** Lens kept in the session before the page opens (default: the profile's) */
  lens?: "io" | "nest";
  /** The instant of «now» (default: Tuesday 15:52) */
  now?: Date;
  /** false: leave the clock running (tests that need the real network time) */
  pause?: boolean;
  /** false: do not wait for the end of the loading */
  settle?: boolean;
};

/**
 * Signs `who` in and opens the page with the clock of the browser stopped at
 * `now`: from here on only `page.clock.runFor` moves the time (LEZIONI: tests
 * with timers). The clock starts two minutes earlier so that the page is up
 * before the stop.
 */
export async function open(
  page: Page,
  baseURL: string | undefined,
  nest: CasaNest,
  who: string,
  options: OpenOptions = {},
): Promise<void> {
  const {
    path = "/oggi",
    lens,
    now = NOW,
    pause = true,
    settle = true,
  } = options;
  await page.clock.install({ time: new Date(now.getTime() - 120_000) });
  if (lens) {
    await page.addInitScript(
      ([key, value]) => {
        if (!window.sessionStorage.getItem(key!)) {
          window.sessionStorage.setItem(key!, value!);
        }
      },
      [LENS_KEY, lens] as const,
    );
  }
  await nest.signIn(page, baseURL, who);
  await page.goto(path);
  await expect(h1(page)).toBeVisible({ timeout: 20_000 });
  if (settle) await expect(busy(page)).toHaveCount(0);
  if (pause) await page.clock.pauseAt(now);
}

/**
 * Loads the page again after the clock has been stopped: the clock runs for
 * the load and is stopped again a second ahead once the page is up.
 */
export async function reopen(page: Page, path = "/oggi"): Promise<void> {
  await page.clock.resume();
  await page.goto(path);
  await expect(h1(page)).toBeVisible({ timeout: 20_000 });
  await expect(busy(page)).toHaveCount(0);
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(now + 1000);
}

/** The greeting regular expression of the h1, for the tests that only need the page. */
export const greeting = GREETING;

// ------------------------------------------------------------------- network

/** Every request to a path of the API that is not a write fails as a database error. */
export async function failReads(
  page: Page,
  patterns: string[],
): Promise<{ recover: () => void }> {
  let failing = true;
  for (const pattern of patterns) {
    await page.route(pattern, async (route) => {
      const method = route.request().method();
      if (method === "OPTIONS") {
        return route.fulfill({ status: 204, headers: CORS });
      }
      if (!failing || !["GET", "HEAD", "POST"].includes(method)) {
        return route.continue();
      }
      // A PostgREST error has a `code`: without it the page takes the answer
      // for a lost connection (LEZIONI #21).
      return route.fulfill({
        status: 500,
        contentType: "application/json",
        headers: CORS,
        body: JSON.stringify({ code: "XX000", message: "fake failure" }),
      });
    });
  }
  return {
    recover: () => {
      failing = false;
    },
  };
}

export const READ_EVENTS = "**/rest/v1/rpc/list_household_events*";
export const READ_TODOS = "**/rest/v1/todos*";
export const READ_DEADLINES = "**/rest/v1/deadlines*";
export const READ_SHOPPING = "**/rest/v1/shopping_items*";

/** The reading of the events waits until `release()` is called. */
export async function holdReads(
  page: Page,
  pattern: string = READ_EVENTS,
): Promise<{ release: () => void }> {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(pattern, async (route) => {
    if (route.request().method() === "OPTIONS") return route.continue();
    await gate;
    await route.continue().catch(() => {});
  });
  return { release: () => release() };
}

/** Texts that must not be in the page, in the HTML of the server or in the answers. */
export async function expectNeverSeen(
  page: Page,
  bodies: () => Promise<string>,
  texts: string[],
): Promise<void> {
  const html = await (await page.request.get("/oggi")).text();
  const dom = await page.content();
  const network = await bodies();
  for (const text of texts) {
    expect(dom, `DOM: ${text}`).not.toContain(text);
    expect(html, `HTML del server: ${text}`).not.toContain(text);
    expect(network, `risposte di rete: ${text}`).not.toContain(text);
  }
}

/**
 * The elements that can take the focus with Tab never include a descendant of
 * `row`: Tab is pressed through the whole page.
 */
export async function tabNeverEnters(page: Page, row: Locator): Promise<void> {
  await page.locator("main").focus();
  for (let i = 0; i < 80; i++) {
    await page.keyboard.press("Tab");
    const inside = await row.evaluate((element) =>
      element.contains(document.activeElement),
    );
    expect(inside, "il fuoco è entrato nella riga").toBe(false);
  }
}

// ------------------------------------------------------------ accessibility

export async function axeProblems(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations
    .filter((v) => ["serious", "critical"].includes(v.impact ?? ""))
    .map(
      (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`,
    );
}

/** Ids that appear more than once in the whole DOM, the hidden layout included. */
export async function duplicateIds(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const seen = new Map<string, number>();
    for (const element of document.querySelectorAll("[id]")) {
      seen.set(element.id, (seen.get(element.id) ?? 0) + 1);
    }
    return [...seen].filter(([, n]) => n > 1).map(([id]) => id);
  });
}

export async function expectAccessible(page: Page, label: string) {
  expect(await axeProblems(page), `axe: ${label}`).toEqual([]);
  expect(await duplicateIds(page), `id duplicati: ${label}`).toEqual([]);
}
