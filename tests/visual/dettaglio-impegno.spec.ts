import { expect, test, type Page } from "@playwright/test";
import {
  CENA,
  NOW,
  detailUrl,
  installEventFake,
  type EventFakeOptions,
} from "../fixtures/dettaglio-impegno-fake";
import { hasTestUser } from "../fixtures/visual-login";
import { signInAsCached } from "../fixtures/visual-login-cached";

// Dettaglio impegno (#19): one screenshot per state, at 390 and 1280 px
// (projects). The event is served by a fake of the database functions
// (fixtures/dettaglio-impegno-fake.ts): nothing is written to the database and
// the shots do not depend on what other suites do in the same Nest. Sign-in,
// the Nest and its members (Marco, Laura, Sofia, Tommaso, Biscotto) are real:
// test user A is needed. The page clock is fixed to the mockup's "now"
// (Tuesday 20 October 2026, 15:52). The references are generated in the CI
// container (workflow visual-baseline).

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

test.beforeEach(async ({ context, baseURL }) => {
  test.skip(!hasTestUser("A"), "TEST_USER_A_* non impostati");
  const signedIn = await signInAsCached(context, baseURL!, "A");
  test.skip(!signedIn, "utente di test A non ancora creato (#55)");
});

async function open(
  page: Page,
  options: EventFakeOptions = {},
  {
    day = "2026-10-20",
    ready = "h1",
  }: { day?: string; ready?: "h1" | "none" } = {},
) {
  await page.clock.install({ time: NOW });
  const fake = await installEventFake(page, options);
  await page.goto(detailUrl(day));
  if (ready === "h1") {
    // Not the first `main` that shows up: loading and page can coexist for a moment.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: 20_000,
    });
  }
  await page.evaluate(() => document.fonts.ready);
  return fake;
}

const main = (page: Page) => page.getByRole("main");

async function openForm(page: Page) {
  await main(page).getByRole("button", { name: "Modifica" }).click();
  await expect(
    page.getByRole("dialog", { name: "Modifica impegno" }),
  ).toBeVisible();
  await expect(page.getByLabel("Titolo")).toBeFocused();
}

const save = (page: Page) =>
  page.getByRole("button", { name: "Salva le modifiche" });

async function shot(page: Page, name: string) {
  // The pointer sits on the last button tapped: no hover state in the shot.
  await page.mouse.move(0, 0);
  await expect(page).toHaveScreenshot(name);
}

test("scheda: giorno, orario, titolo, persone e tabella", async ({ page }) => {
  await open(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Nuoto Sofia",
  );
  await shot(page, "scheda.png");
});

test("scheda di un impegno che non si ripete", async ({ page }) => {
  await open(page, { row: CENA }, { day: "2026-10-23" });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Cena da Marta",
  );
  await shot(page, "scheda-senza-ripetizione.png");
});

test("modulo di modifica (foglio su mobile, modale su desktop)", async ({
  page,
}) => {
  await open(page);
  await openForm(page);
  await shot(page, "modulo.png");
});

test("modulo con gli errori dei campi", async ({ page }) => {
  await open(page);
  await openForm(page);
  await page.getByLabel("Titolo").fill("");
  await page
    .getByRole("group", { name: "Chi", exact: true })
    .getByRole("button", { name: /Sofia/ })
    .click();
  await save(page).click();
  await expect(page.getByText("Scrivi il titolo dell'impegno.")).toBeVisible();
  await expect(page.getByText("Scegli almeno una persona.")).toBeVisible();
  await shot(page, "modulo-errori.png");
});

test("dialogo di salvataggio con due scelte", async ({ page }) => {
  await open(page);
  await openForm(page);
  await page.getByLabel("Titolo").fill("Nuoto");
  await save(page).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Salva solo questo" }),
  ).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Annulla" })).toBeFocused();
  await shot(page, "dialogo-salva-due-scelte.png");
});

test("dialogo di salvataggio con una sola scelta", async ({ page }) => {
  await open(page);
  await openForm(page);
  await page
    .getByRole("group", { name: "Chi", exact: true })
    .getByRole("button", { name: /Tommaso/ })
    .click();
  await save(page).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Salva solo questo" }),
  ).toHaveCount(0);
  await shot(page, "dialogo-salva-una-scelta.png");
});

test("dialogo di salvataggio con l'errore", async ({ page }) => {
  const fake = await open(page);
  await openForm(page);
  await page.getByLabel("Titolo").fill("Nuoto");
  await save(page).click();
  const dialog = page.getByRole("alertdialog");
  fake.failWrites("network");
  await dialog.getByRole("button", { name: "Salva solo questo" }).click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "Non riusciamo a salvare le modifiche. Controlla la connessione e riprova.",
  );
  await shot(page, "dialogo-salva-errore.png");
});

test("dialogo di eliminazione di un impegno che si ripete", async ({
  page,
}) => {
  await open(page);
  await openForm(page);
  await page.getByRole("button", { name: "Elimina impegno" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(
    dialog.getByRole("heading", { name: "Eliminare «Nuoto Sofia»?" }),
  ).toBeVisible();
  await shot(page, "dialogo-elimina-ripete.png");
});

test("dialogo di eliminazione di un impegno che non si ripete", async ({
  page,
}) => {
  await open(page, { row: CENA }, { day: "2026-10-23" });
  await openForm(page);
  await page.getByRole("button", { name: "Elimina impegno" }).click();
  await expect(
    page
      .getByRole("alertdialog")
      .getByRole("heading", { name: "Eliminare «Cena da Marta»?" }),
  ).toBeVisible();
  await shot(page, "dialogo-elimina-singolo.png");
});

test("caricamento", async ({ page }) => {
  await open(page, { reads: "slow" }, { ready: "none" });
  await expect(page.locator(".skeleton--grande")).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText("Caricamento in corso")).toBeAttached();
  await shot(page, "caricamento.png");
});

test("«Questo impegno non c'è più»", async ({ page }) => {
  await open(page, { reads: "missing" });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Questo impegno non c'è più",
  );
  await shot(page, "non-c-e-piu.png");
});

test("errore di lettura", async ({ page }) => {
  await open(page, { reads: "error" });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Questa pagina non si è caricata",
  );
  await shot(page, "errore.png");
});
