import { expect, type Browser, type Page } from "@playwright/test";
import { addDays, romeDay } from "./casa";
import { cell, monthReady, rows as monthRows } from "./mese";
import { mondayOf } from "./oggi";
import { eventBlocks, openDay, type Linker } from "./calendari-collegati";
import { waitHydrated } from "./profilo";

// Helpers of the end-to-end journeys of #306 (events: add -> calendar -> detail
// -> search -> notifications -> Today; linked calendars with the fake provider).
// One journey crosses many pages, so the steps live here and the specs read as
// a story. The clock is the real one: every date is computed from today in
// Europe/Rome, nothing is written by hand.

export { addDays, eventBlocks, openDay, romeDay };

export const LENS_KEY = "familynest.lens";
const GREETING = /^(Buongiorno|Buon pomeriggio|Buonasera|Eccoti)/;

const escapeRe = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The lens «Nest» for the whole session of the page, so every page lists all. */
export async function setNestLens(page: Page) {
  await page.addInitScript((key) => {
    window.sessionStorage.setItem(key, "nest");
  }, LENS_KEY);
}

/** Today's page is out of the «lista di partenza» (a new Nest starts with it). */
export async function closeStarterList(u: Linker) {
  const { error } = await u.user.admin
    .from("households")
    .update({ starter_list_completed_at: new Date().toISOString() })
    .eq("id", u.householdId);
  if (error) throw new Error("Lista di partenza di prova non chiusa");
}

// ------------------------------------------------------------------- Today

export const busy = (page: Page) => page.locator('[aria-busy="true"]');

/** Opens Today and waits for the greeting and the end of the loading. */
export async function openToday(page: Page) {
  await page.goto("/oggi");
  await expect(
    page.getByRole("heading", { level: 1, name: GREETING }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(busy(page)).toHaveCount(0);
}

export const section = (page: Page, name: string) =>
  page.getByRole("region", { name, exact: true });

/** A title anywhere in the main part of Today (rows or the «Già fatti» label). */
export const inToday = (page: Page, title: string) =>
  page.getByRole("main").getByText(title);

/** The same title, on screen only (rows of the layout in use). */
export const visibleIn = (page: Page, title: string) =>
  inToday(page, title).filter({ visible: true });

// --------------------------------------------------------------------- Add

const addDialog = (page: Page) =>
  page.getByRole("dialog", { name: "Aggiungi" });
const phraseField = (page: Page) =>
  addDialog(page).getByRole("textbox", { name: "Cosa vuoi aggiungere?" });
const formDialog = (page: Page) =>
  page.getByRole("dialog", { name: "Nuovo impegno" });
const savedToast = (page: Page) =>
  page.getByRole("status").filter({ hasText: "Messo in" });

/** Opens the Add sheet from the navigation of Today (clicks until hydrated). */
async function openAddSheet(page: Page) {
  await openToday(page);
  await expect(async () => {
    await page.getByRole("link", { name: "Aggiungi", exact: true }).click();
    await expect(addDialog(page)).toBeVisible({ timeout: 2000 });
  }).toPass();
  await expect(phraseField(page)).toBeFocused();
}

/** «Aggiungi» with a phrase only: one touch on «Metti in ...». */
export async function addByPhrase(page: Page, phrase: string) {
  await openAddSheet(page);
  await phraseField(page).fill(phrase);
  await addDialog(page)
    .getByRole("button", { name: /^Metti in / })
    .click();
  await expect(savedToast(page)).toBeVisible();
  await expect(addDialog(page)).toHaveCount(0);
}

/** «Aggiungi» through the full form, with a place and a weekly repetition. */
export async function addByForm(
  page: Page,
  phrase: string,
  options: { where: string; weekly: boolean },
) {
  await openAddSheet(page);
  await phraseField(page).fill(phrase);
  const desktop = (page.viewportSize()?.width ?? 0) >= 1024;
  await addDialog(page)
    .getByRole("button", {
      name: desktop ? "Tutti i dettagli" : "Più dettagli",
    })
    .click();
  const form = formDialog(page);
  await expect(form).toBeVisible();
  await form.getByLabel("Dove").fill(options.where);
  if (options.weekly) await form.getByLabel("Si ripete").selectOption("weekly");
  await form.getByRole("button", { name: /^Metti in / }).click();
  await expect(savedToast(page)).toBeVisible();
  await expect(formDialog(page)).toHaveCount(0);
}

// ---------------------------------------------------------------- Calendar

/** Opens the week of a day (the page reads `?settimana=` = the Monday). */
export async function openWeek(page: Page, day: string) {
  await page.goto(`/calendario?settimana=${mondayOf(day)}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
    timeout: 20_000,
  });
  await expect(busy(page)).toHaveCount(0);
}

/** The links of the week with that title (rows on mobile, blocks on desktop). */
export const weekLinks = (page: Page, title: string) =>
  page
    .getByRole("main")
    .getByRole("link", { name: new RegExp(escapeRe(title)) })
    .filter({ visible: true });

/** Opens the month of a day and selects the day, once the page is hydrated. */
export async function openMonthDay(page: Page, day: string) {
  await page.goto(`/calendario/mese?mese=${day.slice(0, 7)}`);
  await monthReady(page);
  await waitHydrated(page.getByRole("grid"));
  await expect(async () => {
    await cell(page, day).click();
    await expect(cell(page, day)).toHaveAttribute("aria-selected", "true", {
      timeout: 2000,
    });
  }).toPass();
}

/** The rows of the selected day of the month with that title. */
export const monthRowsOf = (page: Page, title: string) =>
  monthRows(page).filter({ hasText: title });

/**
 * Opens the detail of an event from the day view: on the phone the block is the
 * link; on the desktop a click chooses the block and the panel «Impegno» has
 * the link to the detail.
 */
export async function openDetailFromDay(page: Page, title: string) {
  const block = eventBlocks(page, title);
  if ((page.viewportSize()?.width ?? 0) < 1024) {
    await block.click();
    return;
  }
  const panel = page
    .getByRole("heading", { level: 2, name: "Impegno", exact: true })
    .locator("xpath=ancestor::section[1]");
  await expect(async () => {
    await block.click();
    await expect(panel).toContainText(title, { timeout: 1000 });
  }).toPass();
  await panel.getByRole("link").first().click();
}

// ------------------------------------------------------------------ Search

/** Opens the search (palette on desktop, page on mobile) and writes the text. */
export async function searchFor(page: Page, text: string) {
  await page.goto("/ricerca");
  const isMobile = (page.viewportSize()?.width ?? 0) < 1024;
  const field = isMobile
    ? page.getByRole("searchbox", { name: "Cerca nel Nest" })
    : page
        .getByRole("dialog", { name: "Cerca nel Nest" })
        .getByRole("combobox", { name: "Cerca nel Nest" });
  await expect(field).toBeFocused({ timeout: 20_000 });
  await field.fill(text);
  await expect(field).toHaveValue(text);
}

/** The rows of the search with that title. */
export const searchRows = (page: Page, title: string) =>
  page.getByTestId("ricerca-riga").filter({ hasText: title });

export const searchEmpty = (page: Page) => page.getByTestId("ricerca-vuoto");

// ------------------------------------------------------------- other people

/** Runs `body` in a browser of its own, signed in as another adult of the Nest. */
export async function asOther(
  browser: Browser,
  page: Page,
  who: Linker,
  body: (other: Page) => Promise<void>,
) {
  const context = await browser.newContext({
    baseURL: who.baseURL,
    viewport: page.viewportSize() ?? undefined,
    locale: "it-IT",
    timezoneId: "Europe/Rome",
  });
  try {
    const other = await context.newPage();
    await setNestLens(other);
    await who.signIn(other);
    await body(other);
  } finally {
    await context.close();
  }
}

/** The Nest events with that title, as the database holds them. */
export async function titlesInNest(u: Linker, title: string) {
  return (await u.events(title)).length;
}
