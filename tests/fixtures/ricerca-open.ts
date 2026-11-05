import {
  expect,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";
import { waitForAnimationsToEnd } from "./animations";

// Helpers shared by the visual and accessibility tests of Ricerca (#40).
// 390 px (project "mobile") shows the search page; 1280 px (project
// "desktop") shows the palette over Oggi. Same address, same field.

/** The day of every test: Tuesday 20 October 2026, 15:52 in Rome. */
export const SEARCH_NOW = new Date("2026-10-20T15:52:00+02:00");

export function isDesktop(testInfo: TestInfo): boolean {
  return testInfo.project.name === "desktop";
}

export function searchField(page: Page): Locator {
  return page.locator("input.campo-ricerca__input");
}

/** Opens `/ricerca` and waits for the page to be ready (field with the focus). */
export async function openSearch(page: Page, testInfo: TestInfo) {
  await page.goto("/ricerca");
  const field = searchField(page);
  await expect(field).toBeVisible();
  // The focus goes to the field when the page is ready, on both layouts.
  await expect(field).toBeFocused();
  if (isDesktop(testInfo)) {
    await expect(page.getByTestId("ricerca-palette")).toBeVisible();
    await waitForAnimationsToEnd(page);
  } else {
    await expect(page.getByTestId("ricerca-pagina")).toBeVisible();
  }
  await page.evaluate(() => document.fonts.ready);
  return field;
}

/** Types a text and waits for the answer of the search. */
export async function searchAndWait(page: Page, text: string) {
  await searchField(page).fill(text);
  await expect(page.getByTestId("ricerca-annuncio")).toContainText(
    `per «${text}»`,
  );
}

/** Screenshot of the search in its current state, resting (no hover, no caret). */
export async function shot(
  page: Page,
  testInfo: TestInfo,
  name: string,
): Promise<void> {
  await page.mouse.move(0, 0);
  await waitForAnimationsToEnd(page);
  if (isDesktop(testInfo)) {
    await expect(page.getByTestId("ricerca-palette")).toHaveScreenshot(name);
  } else {
    await expect(page).toHaveScreenshot(name, { fullPage: true });
  }
}
