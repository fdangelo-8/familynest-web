import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { setAspetto } from "../fixtures/tema";
import { hasTestUser, signInAs } from "../fixtures/visual-login";

// Visual tester's accessibility checks of the shell (F5 #506), on top of
// layout.spec.ts: dark theme, the phone turned sideways, the «Nuovo impegno»
// square, the tooltip (Esc, no focus), reduced motion and safe areas.

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

test.beforeEach(async ({ context, baseURL }) => {
  test.skip(!hasTestUser("A"), "TEST_USER_A_* non impostati");
  const signedIn = await signInAs(context, baseURL!, "A");
  test.skip(!signedIn, "utente di test A non ancora creato (#55)");
});

async function expectNoBlocking(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
}

const SHAPES = [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 960, height: 800 },
  { width: 1040, height: 800 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
];

for (const theme of ["chiaro", "scuro"] as const) {
  for (const size of SHAPES) {
    test(`guscio ${theme} a ${size.width} × ${size.height}: axe con contrasto`, async ({
      page,
    }, testInfo) => {
      test.skip(testInfo.project.name !== "desktop", "una sola volta");
      await page.setViewportSize(size);
      for (const route of ["/oggi", "/calendario", "/spazi"]) {
        await page.goto(route);
        await expect(page.getByRole("main")).toBeVisible();
        await setAspetto(page, theme);
        const results = await new AxeBuilder({ page })
          .options({ runOnly: ["wcag2a", "wcag2aa", "wcag21aa"] })
          .analyze();
        expect(
          results.violations.filter((v) =>
            ["serious", "critical"].includes(v.impact ?? ""),
          ),
          route,
        ).toEqual([]);
      }
    });
  }
}

test("guscio: il + di Oggi ha 44 px, nome «Nuovo impegno» e porta ad Aggiungi", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "solo telefono");
  await page.goto("/oggi");
  const plus = page.getByRole("link", { name: "Nuovo impegno" });
  await expect(plus).toBeVisible();
  const box = await plus.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await expect(plus).toHaveAttribute("href", "/aggiungi");
  await expectNoBlocking(page);
});

test("guscio: il fumetto non prende il fuoco e Esc lo nasconde", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "solo computer");
  await page.setViewportSize({ width: 1040, height: 800 });
  await page.goto("/oggi");
  const link = page
    .getByTestId("barra-laterale")
    .getByRole("link", { name: "Calendario" });
  await link.focus();
  await expect(page.locator(".fumetto")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".fumetto")).toBeHidden();
  await expect(link).toBeFocused();
});

test("guscio: telefono girato, la barra in basso resta con 4 voci da 44 px", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "una sola volta");
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("/oggi");
  await expect(page.getByTestId("barra-basso")).toBeVisible();
  const voci = page.locator(".barra-basso__voce:visible");
  await expect(voci).toHaveCount(4);
  for (const v of await voci.all()) {
    const box = await v.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);
  }
  // Nothing is cut off at the bottom of the window.
  const bar = await page.getByTestId("barra-basso-capsula").boundingBox();
  expect(bar!.y + bar!.height).toBeLessThanOrEqual(390);
});

test("guscio: con il movimento ridotto la testata raccolta compare senza transizione", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "solo telefono");
  await page.goto("/oggi");
  await expect(page.getByRole("main")).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 600));
  const raccolta = page.getByTestId("testata-raccolta");
  await expect(raccolta).toBeVisible();
  const duration = await raccolta.evaluate(
    (el) => getComputedStyle(el).transitionDuration,
  );
  expect(duration.split(",").every((d) => parseFloat(d) === 0)).toBe(true);
});

test("guscio: le aree sicure sono lette con env() e viewport-fit=cover", async ({
  page,
}) => {
  await page.goto("/oggi");
  const viewport = await page
    .locator('meta[name="viewport"]')
    .getAttribute("content");
  expect(viewport).toContain("viewport-fit=cover");
  const bottom = await page.evaluate(() =>
    getComputedStyle(document.documentElement)
      .getPropertyValue("--area-sicura-basso")
      .trim(),
  );
  expect(bottom).toMatch(/env\(safe-area-inset-bottom/);
});
