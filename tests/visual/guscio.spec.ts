import { expect, test, type Page } from "@playwright/test";
import { waitForAnimationsToEnd } from "../fixtures/animations";
import { installOggiFake } from "../fixtures/oggi-visuale";
import { setAspetto } from "../fixtures/tema";
import { hasTestUser, signInAs } from "../fixtures/visual-login";

// The app shell of F5 (#506): bottom bar, headers, side bar (full and icons),
// top bar, tooltip, panel and the «Nuovo impegno» square of Oggi, at the widths
// of D8 and with the phone turned sideways. Compared with docs/design/telefono
// (oggi og1-02..04), docs/design/computer (oggi 01, 03, 09, casa 01) and
// docs/design/tablet. They need test user A.

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

test.beforeEach(async ({ page, context, baseURL }) => {
  test.skip(!hasTestUser("A"), "TEST_USER_A_* non impostati");
  await page.clock.setFixedTime(new Date("2026-10-20T15:00:00+02:00"));
  const signedIn = await signInAs(context, baseURL!, "A");
  test.skip(!signedIn, "utente di test A non ancora creato (#55)");
});

async function openOggi(page: Page) {
  await installOggiFake(page, { scenario: "normale" });
  await page.goto("/oggi");
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, {
    timeout: 20_000,
  });
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(0, 0);
  await waitForAnimationsToEnd(page);
}

// The shell at each width, once per width: the projects only give the first
// viewport, so each test sets its own.
const WIDTHS = [
  { name: "390", width: 390, height: 844 },
  { name: "960", width: 960, height: 800 },
  { name: "1040", width: 1040, height: 800 },
  { name: "1280", width: 1280, height: 800 },
  { name: "1440", width: 1440, height: 900 },
  { name: "telefono-orizzontale", width: 844, height: 390 },
];

for (const w of WIDTHS) {
  test(`guscio: Oggi a ${w.name}`, async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "le larghezze le imposta il test",
    );
    await page.setViewportSize({ width: w.width, height: w.height });
    await openOggi(page);
    await expect(page).toHaveScreenshot(`oggi-${w.name}.png`);
  });

  test(`guscio: Calendario a ${w.name}`, async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "le larghezze le imposta il test",
    );
    await page.setViewportSize({ width: w.width, height: w.height });
    await page.goto("/calendario");
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot(`calendario-${w.name}.png`);
  });
}

test("guscio: Oggi scuro a 390 e a 1280", async ({ page }, testInfo) => {
  await openOggi(page);
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await setAspetto(page, "scuro");
  await expect(page).toHaveScreenshot(
    `oggi-scuro-${testInfo.project.name}.png`,
  );
});

test("guscio: testata raccolta scorrendo (390)", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "solo telefono");
  await openOggi(page);
  await page.evaluate(() => window.scrollTo(0, 600));
  await expect(page.getByTestId("testata-raccolta")).toBeVisible();
  await waitForAnimationsToEnd(page);
  await expect(page).toHaveScreenshot("oggi-testata-raccolta.png");
});

test("guscio: fumetto di una voce a icone (1040)", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "solo computer");
  await page.setViewportSize({ width: 1040, height: 800 });
  await openOggi(page);
  await page
    .getByTestId("barra-laterale")
    .getByRole("link", { name: "Calendario" })
    .hover();
  await expect(page.locator(".fumetto")).toBeVisible();
  await waitForAnimationsToEnd(page);
  await expect(page).toHaveScreenshot("fumetto-1040.png");
});

test("guscio: «Nuovo impegno» di Oggi sul telefono", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "solo telefono");
  await openOggi(page);
  const plus = page.locator(".testa-giornata .btn-icona--pieno");
  await expect(plus).toBeVisible();
  await expect(plus).toHaveScreenshot("oggi-nuovo-impegno.png");
});
