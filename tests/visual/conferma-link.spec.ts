import { expect, test, type Page } from "@playwright/test";
import {
  throwawayConfigured,
  throwawaySkipReason,
} from "../fixtures/throwaway-user";
import { waitHydrated } from "../fixtures/invito-ingresso";
import {
  caseNest,
  caseVisitor,
  fixAccountMail,
  openColor,
  removeShared,
  settle,
  signIn,
  waitBusyButton,
} from "./invito-ingresso-helpers";

// Link of the confirmation mail (#419), one screenshot per state of the
// graphic specification, at 390 and 1280 px (the two projects):
//  - «Conferma il tuo indirizzo» (`/auth/confirm?type=email…`, served by
//    `/accesso/conferma-mail`), without a session, with another session open
//    («sessione già aperta») and while the button is sending;
//  - «Mail confermata» (`/accesso/mail-confermata`), normal and while leaving;
//  - the account line of «Il tuo colore» with a very long mail
//    (the normal states of `/invito/colore` are in invito-ingresso.spec.ts).
// The link is never used: the page is only read, so a made-up `token_hash`
// is enough. The mail of the throwaway user is random: it is replaced by a
// fixed text before each shot. The technical error of «Mail confermata» needs
// the auth server to fail on the server side and is checked by hand.
// Skipped when the Supabase keys are not set.

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

test.skip(!throwawayConfigured(), throwawaySkipReason);
test.afterAll(removeShared);

const LINK = "/auth/confirm?type=email&token_hash=link-di-prova";
const LONG_MAIL =
  "una.persona.con.un.indirizzo.molto.lungo.da.scrivere@famiglia-con-un-nome-lungo.example.test";

const shot = (page: Page, name: string) =>
  expect(page).toHaveScreenshot(name, { fullPage: true });

const heading = (page: Page, name: string) =>
  page.getByRole("heading", { level: 1, name, exact: true });

async function openConfirm(page: Page) {
  await page.goto(LINK);
  await expect(heading(page, "Conferma il tuo indirizzo")).toBeVisible();
  // Scripts loaded: before that a click is a native submit, with no loading state.
  await waitHydrated(
    page.getByRole("button", { name: "Conferma l'indirizzo", exact: true }),
  );
}

async function openConfirmed(page: Page, baseURL: string | undefined) {
  await signIn(page, baseURL, await caseVisitor("mockup"));
  await page.goto("/accesso/mail-confermata");
  await expect(heading(page, "Mail confermata")).toBeVisible();
  await waitHydrated(
    page.getByRole("button", { name: "Non sei tu? Esci", exact: true }),
  );
}

test.describe("conferma del link · «Conferma il tuo indirizzo»", () => {
  test("senza sessione", async ({ page }) => {
    await openConfirm(page);
    await settle(page);
    await shot(page, "conferma-normale.png");
  });

  test("sessione già aperta", async ({ page, baseURL }) => {
    await signIn(page, baseURL, await caseVisitor("mockup"));
    await openConfirm(page);
    await expect(
      page.getByRole("link", { name: "Resta con questo account", exact: true }),
    ).toBeVisible();
    await settle(page);
    await shot(page, "conferma-sessione-aperta.png");
  });

  test("sessione già aperta, mail lunga", async ({ page, baseURL }) => {
    await signIn(page, baseURL, await caseVisitor("mockup"));
    await openConfirm(page);
    await expect(page.getByRole("status")).toBeVisible();
    await page.evaluate((text) => {
      for (const el of document.querySelectorAll(".avviso b")) {
        el.textContent = text;
      }
    }, LONG_MAIL);
    await settle(page);
    await shot(page, "conferma-sessione-aperta-mail-lunga.png");
  });

  test("conferma in corso", async ({ page }) => {
    // The POST is cancelled: the browser stays on the page, which keeps the
    // loading state (a held request would keep a navigation pending).
    await page.route("**/auth/confirm", (route) =>
      route.request().method() === "POST"
        ? route.abort("aborted")
        : route.continue(),
    );
    await openConfirm(page);
    await page
      .getByRole("button", { name: "Conferma l'indirizzo", exact: true })
      .click({ noWaitAfter: true });
    await waitBusyButton(page, "Conferma in corso");
    await settle(page);
    await shot(page, "conferma-in-corso.png");
  });

  test("conferma in corso, con sessione già aperta", async ({
    page,
    baseURL,
  }) => {
    await signIn(page, baseURL, await caseVisitor("mockup"));
    await page.route("**/auth/confirm", (route) =>
      route.request().method() === "POST"
        ? route.abort("aborted")
        : route.continue(),
    );
    await openConfirm(page);
    await page
      .getByRole("button", { name: "Conferma l'indirizzo", exact: true })
      .click({ noWaitAfter: true });
    await waitBusyButton(page, "Conferma in corso");
    await settle(page);
    await shot(page, "conferma-in-corso-sessione-aperta.png");
  });
});

test.describe("conferma del link · «Mail confermata»", () => {
  test("normale", async ({ page, baseURL }) => {
    await openConfirmed(page, baseURL);
    await settle(page);
    await shot(page, "mail-confermata-normale.png");
  });

  test("mail lunga", async ({ page, baseURL }) => {
    await openConfirmed(page, baseURL);
    await settle(page);
    await fixAccountMail(page, LONG_MAIL);
    await shot(page, "mail-confermata-mail-lunga.png");
  });

  test("uscita in corso", async ({ page, baseURL }) => {
    await page.route("**/auth/signout", (route) =>
      route.request().method() === "POST"
        ? route.abort("aborted")
        : route.continue(),
    );
    await openConfirmed(page, baseURL);
    await page
      .getByRole("button", { name: "Non sei tu? Esci", exact: true })
      .click({ noWaitAfter: true });
    await waitBusyButton(page, "Uscita in corso");
    await settle(page);
    await shot(page, "mail-confermata-uscita-in-corso.png");
  });
});

test.describe("conferma del link · «Il tuo colore» con la riga dell'account", () => {
  test("mail lunga", async ({ page, baseURL }) => {
    const nest = await caseNest("mockup");
    await openColor(page, baseURL, await caseVisitor("mockup"), nest.token);
    await settle(page);
    await fixAccountMail(page, LONG_MAIL);
    await shot(page, "colore-mail-lunga.png");
  });
});
