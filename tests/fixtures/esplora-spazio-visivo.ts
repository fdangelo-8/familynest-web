import { expect, type Page } from "@playwright/test";
import { waitHydrated } from "./esplora";

// Helpers shared by the visual and accessibility tests of the «In arrivo»
// page of a space (#29): /esplora/<spazio>.

export const SPACE_PATH = (slug: string) => `/esplora/${slug}`;

/** Requests of the interest of the member («Avvisami»). */
export const INTEREST_READ = /\/rest\/v1\/space_interests(\?|$)/;
export const INTEREST_ADD = /\/rest\/v1\/rpc\/add_space_interest(\?|$)/;
export const INTEREST_REMOVE = /\/rest\/v1\/rpc\/remove_space_interest(\?|$)/;
/** Names of children and pets (Crescere and Zampe). */
export const MEMBERS_READ = /\/rest\/v1\/household_members(\?|$)/;

export const h1 = (page: Page) => page.getByRole("heading", { level: 1 });

export const notifyButton = (page: Page) =>
  page.getByRole("button", {
    name: /^(Avvisami quando è pronto|Ti avvisiamo appena è pronto)$/,
  });

/** The pin of the bar (mobile only: on desktop there is none). */
export const barPin = (page: Page) =>
  page.locator(".barra button[aria-pressed]");

/** The loading area (hidden text «Caricamento in corso», aria-busy). */
export const busyArea = (page: Page) =>
  page
    .locator('[aria-busy="true"]')
    .filter({ hasText: "Caricamento in corso" });

/** Opens the page of a space and waits for the «Avvisami» button, hydrated. */
export async function openSpace(page: Page, slug: string, name: string) {
  await page.goto(SPACE_PATH(slug));
  await expect(h1(page)).toHaveText(name);
  await expect(notifyButton(page)).toBeVisible({ timeout: 20_000 });
  await waitHydrated(notifyButton(page));
}
