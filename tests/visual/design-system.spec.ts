import { expect, test } from "@playwright/test";

// CA-48: the gallery at 390 and 1280 px matches the approved reference and
// has no horizontal scroll at 390 px. Runs on both projects (mobile, desktop).

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

const FIXED_NOW = new Date("2026-10-20T15:00:00+02:00");

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW);
  await page.goto("/design-system");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("h1")).toHaveText("Design system");
});

test("CA-48: galleria intera, senza scorrimento orizzontale", async ({
  page,
}) => {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(page).toHaveScreenshot("galleria.png", { fullPage: true });
});

test("CA-48: foglio o modale aperto", async ({ page }) => {
  await page.getByRole("button", { name: "Apri foglio" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page).toHaveScreenshot("foglio-aperto.png");
});

test("CA-48: dialogo di conferma aperto", async ({ page }) => {
  await page.getByTestId("dialogo-apri").click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await expect(page).toHaveScreenshot("dialogo-aperto.png");
});

test("CA-48: toast con Annulla", async ({ page }) => {
  await page.getByTestId("toast-mostra").click();
  await expect(
    page.getByRole("status").filter({ hasText: "Annulla" }),
  ).toBeVisible();
  await expect(page).toHaveScreenshot("toast.png");
});

// #63 / PR #71: shared Casa components, one reference per state.
for (const id of ["tondo-spunta", "campo-rapido", "strappo"]) {
  test(`#63: sezione ${id}`, async ({ page }) => {
    await expect(page.locator(`#${id}`)).toHaveScreenshot(`sezione-${id}.png`);
  });
}

test("#63: selettore con voci-link", async ({ page }) => {
  await expect(page.getByTestId("selettore-link")).toHaveScreenshot(
    "selettore-link.png",
  );
});

test("#63: campo rapido con il fuoco", async ({ page }) => {
  await page.getByTestId("campo-rapido-normale").getByRole("textbox").focus();
  await expect(page.getByTestId("campo-rapido-normale")).toHaveScreenshot(
    "campo-rapido-fuoco.png",
  );
});

test("#63: toast con grassetto all'inizio e icona", async ({ page }) => {
  await page.getByTestId("toast-mostra-inizio").click();
  await expect(
    page.getByRole("status").filter({ hasText: "3 cose" }),
  ).toBeVisible();
  await expect(page).toHaveScreenshot("toast-inizio.png");
});

test("#63: toast senza icona", async ({ page }) => {
  await page.getByTestId("toast-mostra-senza-icona").click();
  await expect(
    page.getByRole("status").filter({ hasText: "Latte" }),
  ).toBeVisible();
  await expect(page).toHaveScreenshot("toast-senza-icona.png");
});
