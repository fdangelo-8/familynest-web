import { expect, test, type Locator, type Page } from "@playwright/test";
import { hasTestUser, signInAs } from "../fixtures/visual-login";

// PR #94 (#85): references of the shared member components (colour choice
// with ten colours, MemberSheet in add, edit and invite mode with its error
// and saving states) on /design-system/membri, and of the close X of /nest.
// Runs on both projects (mobile 390 px, desktop 1280 px). /esplora has its own
// references in esplora.spec.ts (#28).
// The sheets are captured as the dialog element, so the references do not
// depend on the layout of the test page behind the veil.

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

const DEMO = "/design-system/membri";
const ADD = "Aggiungi una persona o un animale";
const FIXED_NOW = new Date("2026-10-29T12:00:00+01:00");

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW);
});

async function goToDemo(page: Page) {
  await page.goto(DEMO);
  await page.evaluate(() => document.fonts.ready);
  await expect(
    page.getByRole("heading", { level: 1, name: "Membri" }),
  ).toBeVisible();
}

async function open(page: Page, button: string, outcome?: string) {
  await goToDemo(page);
  if (outcome) await page.getByRole("button", { name: outcome }).click();
  await page.getByRole("button", { name: button }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}

/** No caret, no hover, no focus ring from the last click: a resting state. */
async function rest(page: Page, field?: Locator) {
  await page.mouse.move(0, 0);
  if (field) await field.blur();
}

test("#85: scelta del colore, due righe da cinque con tre colori spenti", async ({
  page,
}) => {
  await goToDemo(page);
  const group = page.getByTestId("scelta-colore-demo");
  await expect(group.getByRole("radio")).toHaveCount(10);
  await expect(group).toHaveScreenshot("scelta-colore.png");
});

test("#85: scelta del colore con il fuoco da tastiera", async ({ page }) => {
  await goToDemo(page);
  const group = page.getByTestId("scelta-colore-demo");
  await page.getByRole("button", { name: "Riuscito" }).focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(group.getByRole("radio", { name: "Lampone" })).toBeFocused();
  await expect(group).toHaveScreenshot("scelta-colore-fuoco.png");
});

test("#85: foglio «Aggiungi una persona», compilato", async ({ page }) => {
  const dialog = await open(page, ADD);
  await dialog.getByLabel("Nome").fill("Sofia");
  await dialog.getByLabel("Data di nascita").fill("2017-03-14");
  await rest(page, dialog.getByLabel("Data di nascita"));
  await expect(page.getByRole("dialog")).toHaveScreenshot(
    "foglio-aggiungi.png",
  );
});

test("#85: foglio «Aggiungi una persona», nome vuoto", async ({ page }) => {
  const dialog = await open(page, ADD);
  await dialog.getByRole("button", { name: "Aggiungi", exact: true }).click();
  await expect(
    dialog.getByText("Scrivi il nome per continuare."),
  ).toBeVisible();
  await rest(page);
  await expect(page.getByRole("dialog")).toHaveScreenshot(
    "foglio-aggiungi-errore.png",
  );
});

test("#85: foglio «Aggiungi una persona», data nel futuro", async ({
  page,
}) => {
  const dialog = await open(page, ADD);
  await dialog.getByLabel("Nome").fill("Sofia");
  await dialog.getByLabel("Data di nascita").fill("2999-01-01");
  await dialog.getByRole("button", { name: "Aggiungi Sofia" }).click();
  await expect(dialog.getByText(/nel futuro/)).toBeVisible();
  await rest(page);
  await expect(page.getByRole("dialog")).toHaveScreenshot(
    "foglio-aggiungi-data-futura.png",
  );
});

test("#85: foglio «Modifica Sofia»", async ({ page }) => {
  const dialog = await open(page, "Modifica Sofia");
  await expect(dialog).toHaveAccessibleName("Modifica Sofia");
  await rest(page, dialog.getByLabel("Nome"));
  await expect(page.getByRole("dialog")).toHaveScreenshot(
    "foglio-modifica.png",
  );
});

test("#85: foglio «Invita qualcuno»", async ({ page }) => {
  const dialog = await open(page, "Invita qualcuno");
  await rest(page, dialog.getByLabel("Nome"));
  await expect(page.getByRole("dialog")).toHaveScreenshot("foglio-invito.png");
});

test("#85: foglio «Invita qualcuno», nome vuoto", async ({ page }) => {
  const dialog = await open(page, "Invita qualcuno");
  await dialog.getByRole("button", { name: "Continua" }).click();
  await expect(
    dialog.getByText("Scrivi il nome per continuare."),
  ).toBeVisible();
  await rest(page);
  await expect(page.getByRole("dialog")).toHaveScreenshot(
    "foglio-invito-errore.png",
  );
});

test("#85: colore preso nel frattempo", async ({ page }) => {
  const dialog = await open(page, ADD, "Colore preso");
  await dialog.getByLabel("Nome").fill("Rita");
  await dialog.getByRole("button", { name: "Aggiungi Rita" }).click();
  await expect(dialog.getByRole("alert")).toContainText("appena preso");
  await rest(page);
  await expect(page.getByRole("dialog")).toHaveScreenshot(
    "foglio-colore-preso.png",
  );
});

test("#85: Nest al completo al salvataggio", async ({ page }) => {
  const dialog = await open(page, ADD, "Al completo");
  await dialog.getByLabel("Nome").fill("Rita");
  await dialog.getByRole("button", { name: "Aggiungi Rita" }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Il Nest è al completo",
  );
  await rest(page);
  await expect(page.getByRole("dialog")).toHaveScreenshot(
    "foglio-nest-al-completo.png",
  );
});

test("#85: rete non raggiungibile, con «Riprova»", async ({ page }) => {
  const dialog = await open(page, ADD, "Rete");
  await dialog.getByLabel("Nome").fill("Rita");
  await dialog.getByRole("button", { name: "Aggiungi Rita" }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Non siamo riusciti a salvare",
  );
  await rest(page);
  await expect(page.getByRole("dialog")).toHaveScreenshot("foglio-rete.png");
});

test("#85: errore del server, con «Riprova»", async ({ page }) => {
  const dialog = await open(page, "Modifica Sofia", "Server");
  await dialog.getByRole("button", { name: "Salva le modifiche" }).click();
  await expect(dialog.getByRole("alert")).toContainText("un problema nostro");
  await rest(page);
  await expect(page.getByRole("dialog")).toHaveScreenshot("foglio-server.png");
});

test("#85: salvataggio in corso", async ({ page }) => {
  const dialog = await open(page, ADD, "Lento");
  await dialog.getByLabel("Nome").fill("Rita");
  await dialog.getByRole("button", { name: "Aggiungi Rita" }).click();
  await expect(
    dialog.getByRole("button", { name: "Aggiungi Rita" }),
  ).toHaveAttribute("aria-busy", "true");
  await rest(page);
  await expect(page.getByRole("dialog")).toHaveScreenshot(
    "foglio-salvataggio.png",
  );
});

test.describe("/nest (utente A)", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    test.skip(!hasTestUser("A"), "TEST_USER_A_* non impostati");
    const signedIn = await signInAs(context, baseURL!, "A");
    test.skip(!signedIn, "utente di test A non ancora creato");
  });

  test("#85: /nest su mobile con la X «Chiudi»", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "la X esiste solo su mobile");
    await page.goto("/nest");
    await expect(page.getByRole("link", { name: "Chiudi" })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.mouse.move(0, 0);
    // Top bar only: the rest of /nest belongs to #17 and has its own references.
    await expect(page).toHaveScreenshot("nest-barra-chiudi.png", {
      clip: { x: 0, y: 0, width: 390, height: 72 },
    });
  });
});
