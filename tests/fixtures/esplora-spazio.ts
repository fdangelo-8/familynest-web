import { expect, type Locator, type Page } from "@playwright/test";
import type { EsploraNest } from "./esplora";
import { hrefOf, waitHydrated } from "./esplora";
import type { SpaceKey } from "../../src/lib/spaces";

// Helpers for the tests of the «In arrivo» page of a space (#29, `/esplora/<spazio>`).
//
// Selectors used (from the page, the PR and the comments of the coordinator):
//   - «Avvisami»: a button named "Avvisami quando è pronto"
//     (`aria-pressed="false"`) or "Ti avvisiamo appena è pronto" (`true`);
//   - the puntina of mobile: `header.barra button[aria-pressed]`;
//   - the link of desktop: `a[href="/esplora"].spazio-arrivo__desktop`;
//   - the error of reading: `[role=alert].avviso--errore` with «Riprova»;
//   - loading: `[aria-busy="true"]` with the hidden text "Caricamento in corso";
//   - toast: `role="status"`.

export const askButton = (page: Page) =>
  page.getByRole("button", { name: "Avvisami quando è pronto", exact: true });

export const doneButton = (page: Page) =>
  page.getByRole("button", {
    name: "Ti avvisiamo appena è pronto",
    exact: true,
  });

/** The «Avvisami» button whatever its state (the only toggle inside `main`). */
export const interestToggle = (page: Page) =>
  page.getByRole("main").locator("button[aria-pressed]");

/** The puntina of the top bar (mobile). */
export const barPin = (page: Page) =>
  page.locator("header.barra button[aria-pressed]");

export const notFoundTitle = (page: Page) =>
  page.getByRole("heading", { level: 1, name: "Questa pagina non c’è" });

export const spaceTitle = (page: Page, name: string) =>
  page.getByRole("heading", { level: 1, name, exact: true });

export const desktopLink = (page: Page) =>
  page.locator('main a[href="/esplora"].spazio-arrivo__desktop');

export const errorAlert = (page: Page) =>
  page.locator("[role=alert].avviso--errore");

export const rowsList = (page: Page) =>
  page.getByRole("main").getByRole("list");

// ----------------------------------------------------------- network patterns

/** The read of my interests (only the table, not the functions). */
export const INTEREST_READ = /\/rest\/v1\/space_interests(\?|$)/;
export const ADD_RPC = /\/rest\/v1\/rpc\/add_space_interest(\?|$)/;
export const REMOVE_RPC = /\/rest\/v1\/rpc\/remove_space_interest(\?|$)/;

// ------------------------------------------------------------------- opening

/**
 * Opens `/esplora/<space>` and waits for the title and for the «Avvisami»
 * button (in either state) to be drawn and hydrated. No fixed wait.
 */
export async function openSpace(page: Page, name: string): Promise<void> {
  await page.goto(hrefOf(name));
  await expect(spaceTitle(page, name)).toBeVisible();
  const toggle = askButton(page).or(doneButton(page));
  await expect(toggle).toBeVisible({ timeout: 20_000 });
  await waitHydrated(toggle);
}

export { waitHydrated };

// ---------------------------------------------------------------------- data

export type InterestRow = { member_id: string; space: SpaceKey };

/** Rows of `space_interests` of the whole Nest, read with the administrative key. */
export async function interestRows(ctx: EsploraNest): Promise<InterestRow[]> {
  const { data, error } = await ctx.user.admin
    .from("space_interests")
    .select("member_id, space")
    .eq("household_id", ctx.nest.householdId);
  if (error) throw new Error("Lettura amministrativa degli avvisi fallita");
  return (data ?? []) as InterestRow[];
}

/** Registers the interest with the client of the owner (RLS applies). */
export async function addInterest(
  ctx: EsploraNest,
  space: SpaceKey,
): Promise<void> {
  const { error } = await ctx.user.client.rpc("add_space_interest", {
    p_space: space,
  });
  if (error) throw new Error(`Avviso di prova non registrato: ${space}`);
}

/** Computed background of `--color-inchiostro`, normalised by the browser. */
export async function inkColor(page: Page): Promise<string> {
  return page.evaluate(() => {
    const probe = document.createElement("span");
    probe.style.backgroundColor = "var(--color-inchiostro)";
    document.body.append(probe);
    const color = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return color;
  });
}

export const backgroundOf = (target: Locator): Promise<string> =>
  target.evaluate((node) => getComputedStyle(node).backgroundColor);
