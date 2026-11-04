import AxeBuilder from "@axe-core/playwright";
import type { Locator, Page } from "@playwright/test";
import {
  addDays,
  capitalise,
  dayNumber,
  expect,
  monthName,
  weekdayName,
  type CasaNest,
  type Day,
} from "./casa";
import {
  axeProblems,
  busyLoading,
  chooseLens,
  holdReads,
  noDuplicateIds,
  failReads,
  h1,
  hydrated,
  lensGroup,
  open,
  reopen,
  retry,
  viewGroup,
  alerts,
  mainNav,
  isMobileProject,
  test,
  TODAY,
  TUE,
  WED,
  THU,
  FRI,
  SUN,
  MON,
  OFFLINE_ALERT,
  READ,
  type OpenOptions,
} from "./giorno";

// Helpers for the tests of Calendario · Mese (#27). Every test builds its own
// throwaway Nest (fixtures/casa.ts) and events (fixtures/calendario.ts); the
// page writes nothing and the Nest is deleted with its users at the end.
//
// Written before the page exists, from the 38 criteria of the comment
// «Criteri di accettazione: aggiornamento (01/11)» of the issue, which wins
// over the body, and from the designer's specification of 31/10 and 01/11.
//
// Selectors the tests expect from the page (see also the report of the tester):
//  - `role="grid"` (name «Ottobre 2026») > `role="row"` > `role="gridcell"`
//    (a `button.griglia-mese__cella`) with `aria-selected`, `aria-current="date"`
//    and an accessible name «<n>, <weekday> <n> <month>[, oggi][, <holiday>],
//    <N impegni>: <people>» (or «nessun impegno»);
//  - `.griglia-mese__numero` is the visible number of a cell;
//  - dots: `[data-membro="<member id>"]` inside the cell, plus
//    `data-testid="punti-altri"` for the grey «e altri» dot;
//  - day section: `h2` (level 2, in `main`) with `.sezione__info` next to it,
//    rows are `.riga-evento` (`.riga-evento__ora`, `.riga-evento--insieme`,
//    `.riga-evento--occupato`, `data-passato`), on desktop inside an `aside`;
//  - period: `.periodo` with the buttons «Mese precedente» / «Mese successivo»
//    and the link «Oggi»; a `role="status"` region announces the month.

export { expect, isMobileProject, test };
export {
  addDays,
  alerts,
  busyLoading,
  chooseLens,
  failReads,
  h1,
  holdReads,
  hydrated,
  lensGroup,
  mainNav,
  OFFLINE_ALERT,
  open,
  reopen,
  retry,
  viewGroup,
  TUE,
  WED,
  THU,
  FRI,
  SUN,
  MON,
  TODAY,
};
export type { CasaNest, Day, OpenOptions };

export const PATH = "/calendario/mese";
export const monthPath = (month: string) => `${PATH}?mese=${month}`;
export const SAT: Day = "2026-10-24";
export const NOV1: Day = "2026-11-01";

export const LOAD_FAILED =
  "Non riusciamo a caricare questo mese. Controlla la connessione e riprova.";

// ------------------------------------------------------------------ locators

export const grid = (page: Page) => page.getByRole("grid");
export const cells = (page: Page) => grid(page).getByRole("gridcell");
export const prev = (page: Page) =>
  page.getByRole("button", { name: "Mese precedente", exact: true });
export const next = (page: Page) =>
  page.getByRole("button", { name: "Mese successivo", exact: true });
/** The «Oggi» link of the period (the navigation has an «Oggi» voice too). */
export const todayLink = (page: Page) =>
  page.locator(".periodo").getByRole("link", { name: "Oggi", exact: true });
export const selected = (page: Page) =>
  grid(page).locator('[role="gridcell"][aria-selected="true"]');
export const current = (page: Page) =>
  grid(page).locator('[role="gridcell"][aria-current="date"]');
export const status = (page: Page) =>
  page.getByRole("status").filter({ hasText: /\S/ });

const escapeRe = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** «20, martedì 20 ottobre»: how the name of a cell starts. */
export function cellStart(day: Day): string {
  const n = dayNumber(day);
  return `${n}, ${weekdayName(day)} ${n} ${monthName(day)}`;
}

/** The cell of a day, found by the start of its accessible name. */
export function cell(page: Page, day: Day): Locator {
  return grid(page).getByRole("gridcell", {
    name: new RegExp(`^${escapeRe(cellStart(day))}(,|$)`),
  });
}

/** The dots of a cell (all of them, visible or not). */
export const dots = (target: Locator) => target.locator("[data-membro]");
export const othersDot = (target: Locator) => target.getByTestId("punti-altri");

export async function dotIds(target: Locator): Promise<string[]> {
  return dots(target).evaluateAll((els) =>
    els.map((el) => el.getAttribute("data-membro") ?? ""),
  );
}

export async function expectDots(
  nest: CasaNest,
  target: Locator,
  names: string[],
  label = "",
) {
  await expect(dots(target), label).toHaveCount(names.length);
  expect(await dotIds(target), label).toEqual(
    names.map((name) => nest.members[name]),
  );
}

/** The section of the chosen day (the one that has the h2). */
export const daySection = (page: Page) =>
  page
    .getByRole("main")
    .getByRole("heading", { level: 2 })
    .locator("xpath=ancestor::section[1]");
export const dayHeading = (page: Page) =>
  page.getByRole("main").getByRole("heading", { level: 2 });
export const dayHead = (page: Page) =>
  daySection(page).locator(".sezione__testa");
export const dayInfo = (page: Page) =>
  daySection(page).locator(".sezione__testa .sezione__info");
export const rows = (page: Page) => daySection(page).locator(".riga-evento");
export const row = (page: Page, title: string) =>
  rows(page).filter({ hasText: title });
export const numberOf = (target: Locator) =>
  target.locator(".griglia-mese__numero");

/** The rows of the list have been replaced by the skeleton. */
export const skeletons = (page: Page) => page.locator(".gruppo-skeleton");

// ------------------------------------------------------------------ helpers

/**
 * Waits until the grid and its data are on screen (no loading container) so
 * that an absence can be checked (LEZIONI #155).
 */
export async function monthReady(page: Page) {
  await expect(grid(page)).toBeVisible();
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
}

/** Opens the month page; the grid is loaded when it returns. */
export async function openMonth(
  page: Page,
  baseURL: string | undefined,
  nest: CasaNest,
  options: OpenOptions & { month?: string } = {},
): Promise<void> {
  const { month, ...rest } = options;
  await open(page, baseURL, nest, {
    ...rest,
    path: rest.path ?? (month ? monthPath(month) : PATH),
    settle: rest.settle ?? true,
  });
  if (rest.settle !== false) await monthReady(page);
}

/** Reloads the page with the clock running, then stops it again. */
export async function reload(page: Page): Promise<void> {
  await page.clock.resume();
  await page.reload();
  await expect(h1(page)).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(now + 1000);
}

/** Capitalised «Martedì 20» as written in the h2 of a day. */
export const dayTitle = (day: Day) =>
  `${capitalise(weekdayName(day))} ${dayNumber(day)}`;

export async function boxOf(target: Locator) {
  const box = await target.boundingBox();
  expect(box, "elemento visibile con un riquadro").not.toBeNull();
  return box!;
}

/** The computed colour of a CSS variable, in the form of `getComputedStyle`. */
export async function tokenColor(page: Page, token: string): Promise<string> {
  return page.evaluate((name) => {
    const probe = document.createElement("span");
    probe.style.color = `var(${name})`;
    document.body.appendChild(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  }, token);
}

/** Colour of the shadow (outline) of an element, normalised. */
export async function shadowColor(target: Locator): Promise<string> {
  const shadow = await target.evaluate((el) => getComputedStyle(el).boxShadow);
  const match = /rgba?\([^)]*\)/.exec(shadow);
  expect(match, `box-shadow senza colore: ${shadow}`).not.toBeNull();
  return normaliseColor(match![0]);
}

export function normaliseColor(color: string): string {
  const numbers = (color.match(/[\d.]+/g) ?? []).map(Number);
  const [r, g, b, a = 1] = numbers;
  return `${r},${g},${b},${a}`;
}

/** True when the element is not a link, a button, nor inside one. */
export const isInert = (target: Locator) =>
  target.evaluate(
    (el) =>
      el.closest("a, button") === null &&
      !el.hasAttribute("href") &&
      el.tabIndex < 0,
  );

export async function pageWithout(page: Page, texts: string[], label: string) {
  const dom = await page.content();
  for (const text of texts) {
    expect(dom, `${label}, DOM: ${text}`).not.toContain(text);
  }
}

// ------------------------------------------------------------ accessibility

/**
 * axe, serious and critical violations, plus the two rules the criterion
 * names (`label-content-name-mismatch` is experimental, off by default).
 */
export async function axeProblemsMese(page: Page): Promise<string[]> {
  const base = await axeProblems(page);
  const extra = await new AxeBuilder({ page })
    .withRules(["label-content-name-mismatch", "aria-required-children"])
    .analyze();
  const named = extra.violations
    .filter((v) => ["serious", "critical"].includes(v.impact ?? ""))
    .map((v) => `${v.id}: ${v.nodes.length} elementi`);
  return [...base, ...named];
}

export async function expectAccessibleMese(page: Page) {
  expect(await axeProblemsMese(page)).toEqual([]);
  expect(await noDuplicateIds(page)).toEqual([]);
}

export { READ };
