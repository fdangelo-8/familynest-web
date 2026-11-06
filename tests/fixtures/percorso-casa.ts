import {
  expect,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { column, isMobileProject, switcher } from "./casa";

// Helpers of the end-to-end journeys of the validation phase (#307): tests
// that cross many pages in one go, the way a person would. The pages
// themselves are covered by their own specs; here only what the journeys share.

export type Column = "Spesa" | "Da fare" | "Scadenze";

/** A browser context with the same size, language and time zone as `page`. */
export async function contextLike(
  browser: Browser,
  baseURL: string | undefined,
  page: Page,
): Promise<BrowserContext> {
  return browser.newContext({
    baseURL,
    viewport: page.viewportSize() ?? undefined,
    locale: "it-IT",
    timezoneId: "Europe/Rome",
  });
}

/** The main navigation (the bottom one on 390 px, the top one on 1280 px). */
export const mainNav = (page: Page) =>
  page.getByRole("navigation", { name: "Navigazione principale" });

/** Taps a voice of the main navigation and waits for the address. */
export async function goTo(
  page: Page,
  label: "Oggi" | "Calendario" | "Casa",
  path: RegExp,
): Promise<void> {
  await mainNav(page).getByRole("link", { name: label, exact: true }).click();
  await expect(page).toHaveURL(path);
}

/**
 * Shows a column of Casa: on 390 px it is one voice of the section switcher,
 * on 1280 px the three columns are always there.
 */
export async function showColumn(page: Page, label: Column): Promise<void> {
  if (isMobileProject()) {
    // The voice of the page that is open is not a link: it is only tapped
    // when it leads somewhere.
    const voice = switcher(page)
      .locator(".selettore__voce")
      .filter({ hasText: new RegExp(`^${label}`) });
    await expect(voice).toBeVisible({ timeout: 20_000 });
    if ((await voice.evaluate((el) => el.tagName)) === "A") {
      await voice.click();
    }
  }
  await expect(column(page, label)).toBeVisible({ timeout: 20_000 });
}

/** The text of the whole page, for the «never seen» checks. */
export const bodyText = (page: Page): Promise<string> =>
  page.locator("body").innerText();

/**
 * Like `recordResponses` of figlio.ts, but a body that never ends (a stream
 * kept open by the page) is given up after 10 seconds instead of blocking the
 * test until its timeout.
 */
export function recordBodies(page: Page) {
  const pending: Promise<string>[] = [];
  page.on("response", (response) => {
    const type = response.headers()["content-type"] ?? "";
    if (!/html|json|x-component|text\/plain/.test(type)) return;
    pending.push(
      Promise.race([
        response.text().catch(() => ""),
        new Promise<string>((resolve) => setTimeout(() => resolve(""), 10_000)),
      ]),
    );
  });
  return {
    async text(): Promise<string> {
      return (await Promise.all(pending)).join("\n");
    },
  };
}
