import { expect, test, type Page } from "@playwright/test";
import {
  throwawayConfigured,
  throwawaySkipReason,
} from "../fixtures/throwaway-user";
import { waitHydrated } from "../fixtures/invito-ingresso";
import {
  caseVisitor,
  removeShared,
  settle,
  signIn,
  waitBusyButton,
} from "./invito-ingresso-helpers";

// Page of the button of the new-password link (#461, PR #484):
// `/auth/confirm?type=recovery` is rewritten to `/accesso/conferma-recupero`.
// One screenshot per state of the designer's texts, at 390 and 1280 px (the
// two projects): without a session, with another session open, and while the
// button is sending (with and without the session). The link is never used:
// the page is only read, so a made-up `token_hash` is enough. The mail of the
// throwaway user is random: `settle` replaces it by a fixed text.

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

test.afterAll(removeShared);

const LINK = "/auth/confirm?type=recovery&token_hash=link-di-prova";
const BUTTON = "Scegli una nuova password";

const shot = (page: Page, name: string) =>
  expect(page).toHaveScreenshot(name, { fullPage: true });

const button = (page: Page) =>
  page.getByRole("button", { name: BUTTON, exact: true });

async function openRecovery(page: Page) {
  await page.goto(LINK);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Hai chiesto una nuova password",
      exact: true,
    }),
  ).toBeVisible();
  // Scripts loaded: before that a click is a native submit, with no loading state.
  await waitHydrated(button(page));
}

/** The POST is cancelled: the page keeps the loading state. */
async function holdPost(page: Page) {
  await page.route("**/auth/recupero", (route) =>
    route.request().method() === "POST"
      ? route.abort("aborted")
      : route.continue(),
  );
}

test.describe("link della nuova password · pagina del bottone", () => {
  test("senza sessione", async ({ page }) => {
    await openRecovery(page);
    await settle(page);
    await shot(page, "recupero-normale.png");
  });

  test("in corso", async ({ page }) => {
    await holdPost(page);
    await openRecovery(page);
    await button(page).click({ noWaitAfter: true });
    await waitBusyButton(page, "Apertura in corso");
    await settle(page);
    await shot(page, "recupero-in-corso.png");
  });

  test("sessione già aperta", async ({ page, baseURL }) => {
    test.skip(!throwawayConfigured(), throwawaySkipReason);
    await signIn(page, baseURL, await caseVisitor("mockup"));
    await openRecovery(page);
    await expect(
      page.getByRole("link", { name: "Resta con questo account", exact: true }),
    ).toBeVisible();
    await settle(page);
    await shot(page, "recupero-sessione-aperta.png");
  });

  test("in corso, con sessione già aperta", async ({ page, baseURL }) => {
    test.skip(!throwawayConfigured(), throwawaySkipReason);
    await signIn(page, baseURL, await caseVisitor("mockup"));
    await holdPost(page);
    await openRecovery(page);
    await button(page).click({ noWaitAfter: true });
    await waitBusyButton(page, "Apertura in corso");
    await settle(page);
    await shot(page, "recupero-in-corso-sessione-aperta.png");
  });
});
