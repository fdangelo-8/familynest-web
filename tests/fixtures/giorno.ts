import AxeBuilder from "@axe-core/playwright";
import type { Locator, Page, Route } from "@playwright/test";
import {
  addDays,
  capitalise,
  CORS,
  dayNumber,
  expect,
  isMobileProject,
  monthName,
  test,
  weekdayName,
  type CasaNest,
  type Day,
} from "./casa";

// Helpers for the tests of Calendario · Giorno «chi è dove» (#26). Every test
// builds its own throwaway Nests (fixtures/casa.ts) and events
// (fixtures/calendario.ts); the page writes nothing.
//
// Written from the criteria of the issue (requirement of 29/10, update of
// 31/10 09:06 and decisions of 30/10 01:56) and the specification of the
// designer. Roles, names and the few testids/classes used (`testa-colonna`,
// `linea-adesso`, `a.blocco-orario`, `.blocco-orario--occupato`,
// `.blocco-orario--insieme`, `.blocco-orario__ora`, `.giorno-persone__nome`,
// `.area-orari`, `.periodo__frecce`) are the ones the criteria and the
// specification name.
//
// Geometry: vertical measures are taken from the top of `.area-orari`, which
// is the 8:00 line. The mockup puts a block 2 px under the hour and 4 px
// shorter, so the criteria use ±4 px (decision of 30/10).

export { expect, isMobileProject, test };
export type { CasaNest, Day };

export const PATH = "/calendario/giorno";
/** martedì 20 ottobre 2026, 15:52 a Roma (CEST, UTC+2) */
export const TODAY = new Date("2026-10-20T13:52:00Z");
export const LENS = "Punto di vista: solo tu o tutto il Nest";
export const LENS_KEY = "familynest.lens";
export const READ = "**/rest/v1/rpc/list_household_events*";
export const REGION = "Chi è dove, dalle 8:00 alle 23:00";
export const OFFLINE_ALERT =
  "Non riusciamo ad aggiornare il calendario. Vedi gli impegni salvati alle";

export const MON: Day = "2026-10-19";
export const TUE: Day = "2026-10-20";
export const WED: Day = "2026-10-21";
export const THU: Day = "2026-10-22";
export const FRI: Day = "2026-10-23";
export const SUN: Day = "2026-10-25";
export { addDays };

/** The `h1` of a day: «Martedì 20» on mobile, «Martedì 20 ottobre» on desktop. */
export function dayTitle(day: Day, mobile = isMobileProject()): string {
  const base = `${capitalise(weekdayName(day))} ${dayNumber(day)}`;
  return mobile ? base : `${base} ${monthName(day)}`;
}

export const dayPath = (day: Day) => `${PATH}?giorno=${day}`;

// ------------------------------------------------------------------ locators

export const h1 = (page: Page) => page.getByRole("heading", { level: 1 });
export const lensGroup = (page: Page) =>
  page.getByRole("group", { name: LENS });
export const viewGroup = (page: Page) =>
  page.getByRole("group", { name: "Vista del calendario" });
export const nextDay = (page: Page) =>
  page.getByRole("button", { name: "Giorno successivo", exact: true });
export const previousDay = (page: Page) =>
  page.getByRole("button", { name: "Giorno precedente", exact: true });
/** The «Oggi» link of the period (the navigation has an «Oggi» voice too). */
export const todayLink = (page: Page) =>
  page
    .locator(".periodo__frecce")
    .getByRole("link", { name: "Oggi", exact: true });
export const mainNav = (page: Page) =>
  page.getByRole("navigation", { name: "Navigazione principale" });
export const retry = (page: Page) =>
  page.getByRole("button", { name: "Riprova" });
export const region = (page: Page) =>
  page.getByRole("region", { name: REGION, exact: true });
export const heads = (page: Page) => page.getByTestId("testa-colonna");
export const headNames = (page: Page) =>
  heads(page).locator(".giorno-persone__nome");
export const nowLine = (page: Page) => page.getByTestId("linea-adesso");
export const busyLoading = (page: Page) =>
  page
    .locator('[aria-busy="true"]')
    .filter({ hasText: "Caricamento in corso" });
export const alerts = (page: Page) =>
  page.getByRole("alert").filter({ hasText: /\S/ });

const escapeRe = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The head of the column of a person. */
export const head = (page: Page, name: string) =>
  heads(page).filter({
    has: page.locator(".giorno-persone__nome", {
      hasText: new RegExp(`^${escapeRe(name)}$`),
    }),
  });

/** Blocks of an event the viewer can open (every piece of it). */
export const blocks = (page: Page, title: string) =>
  page.locator("a.blocco-orario").filter({ hasText: title });
export const allBlocks = (page: Page) => page.locator("a.blocco-orario");
export const busyBlocks = (page: Page) =>
  page.locator(".blocco-orario--occupato");
export const freeBlocks = (page: Page) =>
  page.locator(".blocco-orario--insieme");

/** A section of the right panel (desktop), by its h2. */
export const panel = (page: Page, title: string) =>
  page
    .getByRole("heading", { level: 2, name: title, exact: true })
    .locator("xpath=ancestor::section[1]");

// ----------------------------------------------------------------- geometry

export async function boxOf(target: Locator) {
  const box = await target.boundingBox();
  expect(box, "elemento visibile con un riquadro").not.toBeNull();
  return box!;
}

/** Top and height of a block, from the 8:00 line (top of `.area-orari`). */
export async function offsetAndHeight(page: Page, block: Locator) {
  const area = await boxOf(page.locator(".area-orari"));
  const box = await boxOf(block);
  return {
    top: box.y - area.y,
    height: box.height,
    bottom: box.y + box.height - area.y,
  };
}

/** Names of the columns whose head holds the horizontal centre of the block. */
export async function columnsOf(page: Page, block: Locator): Promise<string[]> {
  const box = await boxOf(block);
  const centre = box.x + box.width / 2;
  const found: string[] = [];
  const all = await heads(page).all();
  for (const item of all) {
    const rect = await boxOf(item);
    if (centre >= rect.x && centre <= rect.x + rect.width) {
      found.push(
        (await item.locator(".giorno-persone__nome").innerText()).trim(),
      );
    }
  }
  return found;
}

export function overlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  const eps = 0.5;
  return (
    a.x + a.width > b.x + eps &&
    b.x + b.width > a.x + eps &&
    a.y + a.height > b.y + eps &&
    b.y + b.height > a.y + eps
  );
}

/** ±`tolerance` comparison with a readable message. */
export function near(actual: number, expected: number, tolerance: number) {
  expect(
    Math.abs(actual - expected),
    `atteso ${expected} ±${tolerance}, ottenuto ${Math.round(actual * 10) / 10}`,
  ).toBeLessThanOrEqual(tolerance);
}

// ------------------------------------------------------------------ helpers

export type OpenOptions = {
  who?: string;
  path?: string;
  /** Lens kept for the session before the page opens (default: the app's «Io») */
  lens?: "io" | "nest";
  /** false: do not wait for the end of the loading (the test holds the read) */
  settle?: boolean;
  /** false: leave the clock running (tests that only look at days) */
  pause?: boolean;
  /** The instant of «now» (default: TODAY) */
  now?: Date;
};

/**
 * Opens the page as `who` with the clock stopped at `now`. The clock is
 * installed two minutes earlier so that the page is up before the stop
 * (LEZIONI: tests with timers).
 */
export async function open(
  page: Page,
  baseURL: string | undefined,
  nest: CasaNest,
  options: OpenOptions = {},
): Promise<void> {
  const {
    who = "Giulia",
    path = PATH,
    lens,
    settle = true,
    pause = true,
    now = TODAY,
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
  if (settle) await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  if (pause) await page.clock.pauseAt(now);
}

/**
 * Opens the page again after the clock has been stopped: the clock runs for
 * the load and is stopped again one second ahead once the page is up.
 */
export async function reopen(page: Page, url: string): Promise<void> {
  await page.clock.resume();
  await page.goto(url);
  await expect(h1(page)).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(now + 1000);
}

/** Clicks a lens button until the client has hydrated and the state changes. */
export async function chooseLens(page: Page, which: "Io" | "Nest") {
  const button = lensGroup(page).getByRole("button", {
    name: new RegExp(`${which}$`),
  });
  await expect(async () => {
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true", {
      timeout: 1000,
    });
  }).toPass();
}

/**
 * Waits for the hydration of the page (a click on the lens changes the state
 * only once the client is up), so that a click on a link or an arrow is not
 * a native navigation (LEZIONI).
 */
export async function hydrated(page: Page) {
  await chooseLens(page, "Nest");
}

/** Waits for the grid of the persons (or the empty state) to be on screen. */
export async function gridReady(page: Page) {
  await expect(region(page)).toBeVisible();
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
}

export function onlyOn(project: "mobile" | "desktop") {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name !== project,
      `Si esegue solo sul progetto ${project}`,
    );
  });
}

/** A test that runs on one project only. */
export function only(
  project: "mobile" | "desktop",
  title: string,
  body: (args: {
    page: Page;
    baseURL: string | undefined;
    bianchi: CasaNest;
    casa: CasaNest;
  }) => Promise<void>,
) {
  test.describe(() => {
    onlyOn(project);
    test(title, body);
  });
}

/** Presses Tab from the region of the grid until `target` has the focus. */
export async function tabTo(page: Page, target: Locator, limit = 60) {
  await region(page).focus();
  for (let i = 0; i < limit; i++) {
    const focused = await target.evaluate(
      (el) => el === document.activeElement,
    );
    if (focused) return;
    await page.keyboard.press("Tab");
  }
  await expect(target).toBeFocused();
}

export async function pageWithout(page: Page, texts: string[], label: string) {
  const dom = await page.content();
  for (const text of texts) {
    expect(dom, `${label}, DOM: ${text}`).not.toContain(text);
  }
}

// ------------------------------------------------------------------ network

/** The reading of the events fails as a database error until `recover()`. */
export async function failReads(page: Page): Promise<{ recover: () => void }> {
  let failing = true;
  await page.route(READ, async (route: Route) => {
    if (route.request().method() === "OPTIONS") {
      return route.fulfill({ status: 204, headers: CORS });
    }
    if (!failing) return route.continue();
    return route.fulfill({
      status: 500,
      contentType: "application/json",
      headers: CORS,
      body: JSON.stringify({ code: "XX000", message: "fake failure" }),
    });
  });
  return {
    recover: () => {
      failing = false;
    },
  };
}

/** The reading of the events waits until `release()` is called. */
export async function holdReads(page: Page): Promise<{ release: () => void }> {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(READ, async (route: Route) => {
    if (route.request().method() === "OPTIONS") return route.continue();
    await gate;
    await route.continue().catch(() => {});
  });
  return { release: () => release() };
}

// ------------------------------------------------------------ accessibility

export async function noDuplicateIds(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const seen = new Map<string, number>();
    for (const el of document.querySelectorAll("[id]")) {
      seen.set(el.id, (seen.get(el.id) ?? 0) + 1);
    }
    return [...seen].filter(([, n]) => n > 1).map(([id]) => id);
  });
}

export async function axeProblems(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations
    .filter((v) => ["serious", "critical"].includes(v.impact ?? ""))
    .map((v) => `${v.id}: ${v.nodes.length} elementi`);
}

export async function expectAccessible(page: Page) {
  expect(await axeProblems(page)).toEqual([]);
  expect(await noDuplicateIds(page)).toEqual([]);
}
