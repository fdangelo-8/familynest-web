import { expect, test, type Page, type Route } from "@playwright/test";
import { installFakes } from "../fixtures/aggiungi-fake";
import { hasTestUser } from "../fixtures/visual-login";
import { signInAsCached } from "../fixtures/visual-login-cached";

// «Anche su …» nel modulo «Nuovo impegno» di Aggiungi (#304, PR #361, CA-32):
// uno screenshot per stato a 390 e 1280 px (progetti): la riga spenta e accesa,
// il calendario da ricollegare, l'avviso di invio non riuscito con «Riprova»,
// l'avviso di lettura non riuscita. Serve l'utente di prova A. Non si scrive nulla
// nel database: salvataggio, persone e calendario sono finti
// (fixtures/aggiungi-fake.ts e le rotte di questo file). I riferimenti si
// generano nel container della CI (workflow visual-baseline). La pagina sotto il
// velo (Oggi) è nascosta: ha contenuto vero e variabile.

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

// Tuesday 20 October 2026, 15:52 in Rome (CEST)
const NOW = new Date("2026-10-20T15:52:00+02:00");
const PHRASE = "Nuoto Sofia giovedì alle 17";
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
};

type Side = {
  reconnect?: boolean;
  readFails?: boolean;
  sendFails?: boolean;
};

test.beforeEach(async ({ page, context, baseURL }) => {
  test.skip(!hasTestUser("A"), "TEST_USER_A_* non impostati");
  const signedIn = await signInAsCached(context, baseURL!, "A");
  test.skip(!signedIn, "utente di test A non ancora creato (#55)");
  await page.clock.install({ time: NOW });
});

/** The reads and the sending of «Anche su»: Google, «Personale». */
async function installAlsoOn(page: Page, side: Side) {
  const answer = (route: Route, row: Record<string, unknown>) => {
    if (route.request().method() === "OPTIONS") {
      return route.fulfill({ status: 204, headers: CORS });
    }
    if (side.readFails) {
      return route.fulfill({ status: 500, json: { message: "boom" } });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/vnd.pgrst.object+json",
      headers: CORS,
      body: JSON.stringify(row),
    });
  };
  await page.route("**/rest/v1/external_calendars*", (route) =>
    answer(route, {
      name: "Personale",
      account_id: "ac000000-0000-4000-8000-0001",
    }),
  );
  await page.route("**/rest/v1/calendar_accounts*", (route) =>
    answer(route, {
      provider: "google",
      status: side.reconnect ? "reconnect" : "active",
    }),
  );
  if (side.sendFails) {
    await page.route("**/rest/v1/rpc/set_event_also_on*", (route) => {
      if (route.request().method() === "OPTIONS") {
        return route.fulfill({ status: 204, headers: CORS });
      }
      return route.fulfill({
        status: 500,
        headers: CORS,
        json: { code: "XX000", message: "fake failure" },
      });
    });
  }
}

function formOf(page: Page) {
  return page.getByRole("dialog", { name: "Nuovo impegno" });
}
const sw = (page: Page) =>
  page.getByRole("switch", { name: "Anche su Google", exact: true });

/** Opens the full form «Nuovo impegno» with the phrase. */
async function openForm(page: Page, side: Side = {}) {
  await installFakes(page);
  await installAlsoOn(page, side);
  await page.goto("/aggiungi");
  const dialog = page.getByRole("dialog", { name: "Aggiungi" });
  await expect(dialog).toBeVisible({ timeout: 20_000 });
  const field = dialog.getByRole("textbox", { name: "Cosa vuoi aggiungere?" });
  await expect(field).toBeFocused();
  await page.addStyleTag({
    content: "main:not(:has([role=dialog])) { visibility: hidden; }",
  });
  await page.evaluate(() => document.fonts.ready);
  await field.pressSequentially(PHRASE);
  await dialog
    .getByRole("button", { name: /^(Più|Tutti i) dettagli$/ })
    .click();
  await expect(formOf(page)).toBeVisible();
  return formOf(page);
}

async function settle(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

/** The pointer away and the page at rest: the shot shows the resting state. */
async function shoot(page: Page, name: string) {
  await page.mouse.move(0, 0);
  await settle(page);
  await expect(page).toHaveScreenshot(name);
}

test("riga «Anche su Google» spenta", async ({ page }) => {
  const form = await openForm(page);
  await expect(sw(page)).toHaveAttribute("aria-checked", "false");
  await expect(form).toContainText("Nel calendario Personale");
  await sw(page).scrollIntoViewIfNeeded();
  await shoot(page, "anche-su-spenta.png");
});

test("riga «Anche su Google» accesa", async ({ page }) => {
  const form = await openForm(page);
  await sw(page).click();
  await expect(sw(page)).toHaveAttribute("aria-checked", "true");
  await expect(form).toContainText("Nel calendario Personale");
  await sw(page).scrollIntoViewIfNeeded();
  await shoot(page, "anche-su-accesa.png");
});

test("calendario da ricollegare", async ({ page }) => {
  const form = await openForm(page, { reconnect: true });
  await expect(sw(page)).toBeDisabled();
  await expect(form).toContainText(
    "Google non si sincronizza: ricollegalo da Calendari collegati.",
  );
  await sw(page).scrollIntoViewIfNeeded();
  await shoot(page, "anche-su-da-ricollegare.png");
});

test("invio non riuscito: avviso con «Riprova»", async ({ page }) => {
  const form = await openForm(page, { sendFails: true });
  await sw(page).click();
  await form.getByRole("button", { name: /^Metti in / }).click();
  const notice = page.getByTestId("anche-su-errore");
  await expect(notice).toBeVisible();
  await expect(notice.getByRole("button", { name: "Riprova" })).toBeFocused();
  await shoot(page, "anche-su-invio-non-riuscito.png");
});

test("lettura del calendario non riuscita: avviso in fondo al modulo", async ({
  page,
}) => {
  const form = await openForm(page, { readFails: true });
  // The client repeats the reading before it gives up
  const notice = page.getByTestId("anche-su-lettura-errore");
  await expect(notice).toBeVisible({ timeout: 30_000 });
  await form.getByLabel("Note", { exact: true }).scrollIntoViewIfNeeded();
  await notice.scrollIntoViewIfNeeded();
  await shoot(page, "anche-su-lettura-non-riuscita.png");
});
