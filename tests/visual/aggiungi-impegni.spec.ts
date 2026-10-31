import { expect, test, type Page } from "@playwright/test";
import { THURSDAY, installFakes } from "../fixtures/aggiungi-fake";
import { hasTestUser } from "../fixtures/visual-login";
import { signInAsCached } from "../fixtures/visual-login-cached";

// Aggiungi · Impegni (#20, PR #172): one screenshot per state of the Add sheet,
// at 390 and 1280 px (projects). Needs test user A (Marco, Casa D'Angelo:
// Laura, Sofia, Tommaso, Biscotto): without TEST_USER_A_* the tests are skipped.
// The references are generated in the CI container (workflow visual-baseline).
//
// Nothing is written to the database and the shots do not depend on what other
// suites do in the same Nest: the events of the day, the save and the reading of
// the people are served by fakes (page.route). Sign-in, the Nest and its members
// are real: the ids of the members are read from the real response and used in
// the fake events.
// The page under the veil (Today) is hidden: it has real, changing content and
// is already covered by layout.spec.ts.

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

// Tuesday 20 October 2026, 15:52 in Rome (CEST)
const NOW = new Date("2026-10-20T15:52:00+02:00");
const PHRASE = "Nuoto Sofia giovedì alle 17";

test.beforeEach(async ({ page, context, baseURL }) => {
  test.skip(!hasTestUser("A"), "TEST_USER_A_* non impostati");
  const signedIn = await signInAsCached(context, baseURL!, "A");
  test.skip(!signedIn, "utente di test A non ancora creato (#55)");
  // The clock runs from a fixed day and time: «today» is Tuesday 20 October
  await page.clock.install({ time: NOW });
});

/** Opens the sheet over Today and waits until the page took over (field focused). */
async function open(page: Page) {
  await page.goto("/aggiungi");
  const dialog = page.getByRole("dialog", { name: "Aggiungi" });
  await expect(dialog).toBeVisible({ timeout: 20_000 });
  const field = dialog.getByRole("textbox", { name: "Cosa vuoi aggiungere?" });
  await expect(field).toBeFocused();
  await page.addStyleTag({
    content: "main:not(:has([role=dialog])) { visibility: hidden; }",
  });
  await page.evaluate(() => document.fonts.ready);
  return { dialog, field };
}

/** Two animation frames: the page has drawn what the last change asked for. */
async function settle(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

/** The pointer and the caret away: the shot shows the resting state. */
async function shoot(page: Page, name: string) {
  await page.mouse.move(0, 0);
  await settle(page);
  await expect(page).toHaveScreenshot(name);
}

function isDesktop(testInfo: { project: { name: string } }) {
  return testInfo.project.name === "desktop";
}

test("vuoto", async ({ page }) => {
  await installFakes(page);
  const { dialog } = await open(page);
  await expect(dialog.getByRole("button", { name: "Aggiungi" })).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "cena da Marta venerdì alle 20" }),
  ).toBeVisible();
  await shoot(page, "vuoto.png");
});

test("frase riconosciuta con le etichette", async ({ page }) => {
  const served = await installFakes(page);
  const { dialog, field } = await open(page);
  await field.pressSequentially(PHRASE);
  const labels = dialog.locator('[aria-live="polite"]');
  await expect(labels).toContainText("Giovedì 22");
  await expect(labels).toContainText("17:00");
  await expect(labels).toContainText("Sofia");
  await expect(
    dialog.getByRole("button", { name: "Metti in giovedì 22" }),
  ).toBeEnabled();
  await expect.poll(() => served.events).toBeGreaterThan(0);
  await expect(page.getByText("Caricamento in corso")).toHaveCount(0);
  await shoot(page, "frase-riconosciuta.png");
});

test("anteprima con gli Occupato degli altri", async ({ page }, testInfo) => {
  test.skip(!isDesktop(testInfo), "l'anteprima c'è solo da 1024 px");
  await installFakes(page, { events: THURSDAY });
  const { dialog, field } = await open(page);
  await field.pressSequentially(PHRASE);
  await expect(page.getByText("Anteprima", { exact: true })).toBeVisible();
  await expect(page.getByText("Colloquio con la maestra")).toBeVisible();
  await expect(page.getByText("Laura ha un impegno").first()).toBeVisible();
  await expect(
    dialog.getByText("Caricamento in corso", { exact: true }),
  ).toHaveCount(0);
  await shoot(page, "anteprima-occupato.png");
});

test("avviso «chi accompagna?»", async ({ page }) => {
  await installFakes(page, { events: THURSDAY });
  const { field } = await open(page);
  await field.pressSequentially(PHRASE);
  await expect(
    page.getByRole("status").filter({ hasText: "chi accompagna Sofia?" }),
  ).toHaveCount(1);
  await shoot(page, "avviso-chi-accompagna.png");
});

test("errore del campo", async ({ page }) => {
  await installFakes(page);
  const { field } = await open(page);
  await field.pressSequentially("giovedì");
  await field.press("Enter");
  await expect(field).toHaveAttribute("aria-invalid", "true");
  await shoot(page, "errore-campo.png");
});

test("salvataggio in corso", async ({ page }) => {
  await installFakes(page, { save: "hold" });
  const { dialog, field } = await open(page);
  await field.pressSequentially(PHRASE);
  const submit = dialog.getByRole("button", { name: "Metti in giovedì 22" });
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(submit).toHaveAttribute("aria-busy", "true");
  await shoot(page, "salvataggio-in-corso.png");
});

test("errore di salvataggio", async ({ page }) => {
  await installFakes(page, { save: "fail" });
  const { dialog, field } = await open(page);
  await field.pressSequentially(PHRASE);
  await dialog.getByRole("button", { name: "Metti in giovedì 22" }).click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "Non siamo riusciti a salvare l'impegno. Controlla la connessione e riprova.",
  );
  await shoot(page, "errore-salvataggio.png");
});

test("persone del Nest non lette", async ({ page }) => {
  await installFakes(page, { people: "fail" });
  const { dialog, field } = await open(page);
  await expect(dialog.getByRole("alert")).toContainText(
    "Non riusciamo a caricare le persone del Nest",
  );
  await field.pressSequentially(PHRASE);
  await expect(dialog.getByText("Giovedì 22").first()).toBeVisible();
  await shoot(page, "persone-non-lette.png");
});

test("toast dopo il salvataggio", async ({ page }) => {
  await installFakes(page);
  const { dialog, field } = await open(page);
  await field.pressSequentially(PHRASE);
  const submit = dialog.getByRole("button", { name: "Metti in giovedì 22" });
  await expect(submit).toBeEnabled();
  // Time stops: the toast (5 seconds) stays, the sheet gets the time to leave
  await page.clock.pauseAt(new Date(NOW.getTime() + 10 * 60_000));
  await submit.click();
  await page.clock.runFor(1000);
  await expect(dialog).toHaveCount(0);
  const toast = page.getByRole("status").filter({ hasText: "Messo in" });
  await expect(toast).toContainText(
    "Messo in giovedì 22: Nuoto Sofia alle 17:00.",
  );
  await expect(toast.getByRole("button", { name: "Annulla" })).toBeVisible();
  await shoot(page, "toast-dopo-il-salvataggio.png");
});
