import { expect, test, type Page } from "@playwright/test";
import { installFakes } from "../fixtures/aggiungi-fake";
import { hasTestUser } from "../fixtures/visual-login";
import { signInAsCached } from "../fixtures/visual-login-cached";

// Aggiungi · Impegni, phase 2 (#171, PR #264): one screenshot per state of the
// full form «Nuovo impegno» opened from the Add sheet, at 390 and 1280 px
// (projects): opened from «Più dettagli» / «Tutti i dettagli» and from the
// summary rows (desktop), errors, saving, save failed, back to the phrase.
// Needs test user A (Marco, Casa D'Angelo). The references are generated in the
// CI container (workflow visual-baseline). Nothing is written to the database:
// the events, the save and the people are served by fakes (fixtures/aggiungi-fake.ts).
// The page under the veil (Today) is hidden: it has real, changing content.

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

/** The phrase written and the entries present (people read, title known). */
async function openWithPhrase(page: Page, phrase = PHRASE) {
  const { dialog, field } = await open(page);
  await field.pressSequentially(phrase);
  const label = dialog.getByRole("button", {
    name: /^(Più|Tutti i) dettagli$/,
  });
  await expect(label).toBeVisible();
  return { dialog, field, entry: label };
}

function formOf(page: Page) {
  return page.getByRole("dialog", { name: "Nuovo impegno" });
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

test("frase riconosciuta con gli ingressi", async ({ page }) => {
  await installFakes(page);
  const { dialog } = await openWithPhrase(page);
  await expect(
    dialog.getByRole("button", { name: "Metti in giovedì 22" }),
  ).toBeEnabled();
  await shoot(page, "modulo-frase-con-ingressi.png");
});

test("frase con errore del campo e ingressi attivi", async ({ page }) => {
  await installFakes(page);
  const { dialog, field } = await open(page);
  await field.pressSequentially("dentista giovedì");
  await field.press("Enter");
  // #333: the error sits under the field that is wrong («Dalle»), not under the phrase
  const from = dialog.getByLabel("Dalle", { exact: true });
  await expect(from).toHaveAttribute("aria-invalid", "true");
  await expect(from).toHaveAccessibleDescription("Scegli l'ora d'inizio.");
  await expect(
    dialog.getByRole("button", { name: /^(Più|Tutti i) dettagli$/ }),
  ).toBeVisible();
  await shoot(page, "modulo-frase-errore-con-ingressi.png");
});

test("modulo aperto da «Più dettagli» / «Tutti i dettagli»", async ({
  page,
}) => {
  await installFakes(page);
  const { entry } = await openWithPhrase(page);
  await entry.click();
  const form = formOf(page);
  await expect(form).toBeVisible();
  await expect(form.getByLabel("Titolo")).toHaveValue("Nuoto Sofia");
  await expect(form.getByLabel("Titolo")).toBeFocused();
  await expect(
    form.getByRole("button", { name: "Metti in giovedì 22" }),
  ).toBeVisible();
  await shoot(page, "modulo-aperto-dettagli.png");
});

test("modulo aperto, in fondo: Chi lo vede, Note e bottone", async ({
  page,
}) => {
  await installFakes(page);
  const { entry } = await openWithPhrase(page);
  await entry.click();
  const form = formOf(page);
  await form
    .getByRole("button", { name: "Metti in giovedì 22" })
    .scrollIntoViewIfNeeded();
  await expect(form.getByLabel("Note")).toBeVisible();
  await shoot(page, "modulo-aperto-in-fondo.png");
});

test("modulo compilato: luogo, ripetizione, note, persone (senza «La porta»)", async ({
  page,
}) => {
  await installFakes(page);
  const { entry } = await openWithPhrase(page);
  await entry.click();
  const form = formOf(page);
  await form.getByLabel("Dove").fill("Piscina comunale, Lissone");
  await form.getByLabel("Si ripete").selectOption("weekly");
  await form.getByLabel("Note").fill("Portare la cuffia");
  // Only «Chi» has a «Tu» now (#333): it is not pressed, the phrase names Sofia
  await form
    .getByRole("button", { name: "Tu", exact: true, pressed: false })
    .last()
    .click();
  await expect(form.getByLabel("Dove")).toHaveValue(
    "Piscina comunale, Lissone",
  );
  await form.getByLabel("Titolo").focus();
  await shoot(page, "modulo-compilato.png");
});

test("modulo con fine in un altro giorno", async ({ page }) => {
  await installFakes(page);
  const { entry } = await openWithPhrase(page, "Cena da Marta venerdì alle 22");
  await entry.click();
  const form = formOf(page);
  await form.getByLabel("Alle", { exact: true }).fill("01:00");
  await expect(form.getByText(/^Finisce /)).toBeVisible();
  await form.getByLabel("Titolo").focus();
  await shoot(page, "modulo-fine-altro-giorno.png");
});

test("modulo senza ora né giorno", async ({ page }) => {
  await installFakes(page);
  const { entry } = await openWithPhrase(page, "Dentista");
  await entry.click();
  const form = formOf(page);
  await expect(form.getByRole("button", { name: "Aggiungi" })).toBeVisible();
  await shoot(page, "modulo-senza-giorno.png");
});

// #333: the four rows of the summary are gone; the sheet shows the fields.
test("foglio con i campi dell'impegno compilati dalla frase", async ({
  page,
}) => {
  await installFakes(page);
  const { dialog } = await openWithPhrase(page);
  await expect(dialog.getByLabel("Giorno", { exact: true })).toHaveValue(
    "2026-10-22",
  );
  await expect(
    dialog.getByRole("group", { name: "Chi lo vede", exact: true }),
  ).toBeVisible();
  await shoot(page, "foglio-campi-compilati.png");
});

test("errori dei campi nel modulo", async ({ page }) => {
  await installFakes(page);
  const { entry } = await openWithPhrase(page, "Dentista 3/11/2030");
  await entry.click();
  const form = formOf(page);
  await form.getByLabel("Titolo").fill("");
  await form.getByRole("button", { name: /^Metti in / }).click();
  await expect(form.getByLabel("Titolo")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(form.getByLabel("Titolo")).toBeFocused();
  await expect(form.getByText("Scegli l'ora d'inizio.")).toBeVisible();
  await shoot(page, "modulo-errori.png");
});

test("salvataggio in corso dal modulo", async ({ page }) => {
  await installFakes(page, { save: "hold" });
  const { entry } = await openWithPhrase(page);
  await entry.click();
  const form = formOf(page);
  const submit = form.getByRole("button", { name: "Metti in giovedì 22" });
  await submit.click();
  await expect(submit).toHaveAttribute("aria-busy", "true");
  await submit.scrollIntoViewIfNeeded();
  await shoot(page, "modulo-salvataggio-in-corso.png");
});

test("salvataggio non riuscito dal modulo", async ({ page }) => {
  await installFakes(page, { save: "fail" });
  const { entry } = await openWithPhrase(page);
  await entry.click();
  const form = formOf(page);
  const submit = form.getByRole("button", { name: "Metti in giovedì 22" });
  await submit.click();
  await expect(form.getByRole("alert")).toHaveText(
    "Non siamo riusciti a salvare l'impegno. Controlla la connessione e riprova.",
  );
  await submit.scrollIntoViewIfNeeded();
  await shoot(page, "modulo-salvataggio-non-riuscito.png");
});

test("ritorno alla frase con Esc", async ({ page }) => {
  await installFakes(page);
  const { dialog, field, entry } = await openWithPhrase(page);
  await entry.click();
  const form = formOf(page);
  await form.getByLabel("Titolo").fill("Altro");
  // From the keyboard, so that the ring of the focus on the entry is drawn
  await page.keyboard.press("Escape");
  await expect(formOf(page)).toHaveCount(0);
  await expect(dialog).toBeVisible();
  await expect(field).toHaveValue(PHRASE);
  await expect(entry).toBeFocused();
  await shoot(page, "modulo-ritorno-alla-frase.png");
});
