import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { waitForAnimationsToEnd } from "../fixtures/animations";
import { waitHydrated } from "../fixtures/esplora";

// #505 (F4c): sheet, confirmation dialog, «Collega» row in error and month
// calendar in the gallery, one at a time, on mobile (390) and desktop (1280),
// in the light and in the dark theme. The dark theme is set with
// `data-aspetto="scuro"` on the root (the class `.tema-notte` is not it).

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

const NOW = new Date("2026-11-18T09:00:00Z");

const serious = (violations: { impact?: string | null }[]) =>
  violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""));

async function openGallery(page: Page, aspetto: "chiaro" | "scuro") {
  await page.emulateMedia({
    colorScheme: aspetto === "scuro" ? "dark" : "light",
    reducedMotion: "reduce",
  });
  await page.clock.install({ time: NOW });
  await page.goto("/design-system");
  await page.evaluate((value) => {
    document.documentElement.setAttribute("data-aspetto", value);
  }, aspetto);
  await waitHydrated(page.getByTestId("ds-data"));
}

async function expectNoSeriousViolations(page: Page) {
  await waitForAnimationsToEnd(page);
  const results = await new AxeBuilder({ page }).analyze();
  expect(serious(results.violations)).toEqual([]);
}

for (const aspetto of ["chiaro", "scuro"] as const) {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1280, height: 800 },
  ]) {
    test.describe(`${viewport.width} px, tema ${aspetto}`, () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize(viewport);
        await openGallery(page, aspetto);
      });

      test("CA-37: il foglio con l'azione scritta", async ({ page }) => {
        await page
          .getByTestId("ds-foglio-azione")
          .getByRole("button", { name: "Apri Nuovo impegno" })
          .click();
        await expect(
          page.getByRole("dialog", { name: "Nuovo impegno" }),
        ).toBeVisible();
        await expectNoSeriousViolations(page);
      });

      test("CA-37: il foglio con il piede", async ({ page }) => {
        await page
          .getByTestId("ds-foglio-piede")
          .getByRole("button", { name: "Apri Nuova scadenza" })
          .click();
        await expect(
          page.getByRole("dialog", { name: "Nuova scadenza" }),
        ).toBeVisible();
        await expectNoSeriousViolations(page);
      });

      test("CA-37: il dialogo di conferma", async ({ page }) => {
        await page
          .getByTestId("ds-conferma")
          .getByRole("button", { name: "Togli Biscotto" })
          .click();
        await expect(page.getByRole("alertdialog")).toBeVisible();
        await expectNoSeriousViolations(page);
      });

      test("CA-37: la riga «Collega» in errore", async ({ page }) => {
        await page
          .getByTestId("ds-collega")
          .getByRole("button", { name: "Collega Google Calendar" })
          .click();
        await expect(
          page.getByTestId("ds-collega").getByRole("alert"),
        ).toBeVisible();
        await expectNoSeriousViolations(page);
      });

      test("CA-37: il calendario del mese", async ({ page }) => {
        await page
          .getByTestId("ds-data")
          .getByRole("button", { name: /^Giorno/ })
          .click();
        await expect(page.getByRole("grid")).toBeVisible();
        await expectNoSeriousViolations(page);
      });

      test("CA-37: il campo dell'ora con l'errore", async ({ page }) => {
        const from = page
          .getByTestId("ds-ora")
          .getByLabel("Dalle", { exact: true });
        await from.fill("25:00");
        await from.blur();
        await expect(
          page.getByText("Scrivi un'ora da 00:00 a 23:59, per esempio 17:30."),
        ).toBeVisible();
        await expectNoSeriousViolations(page);
      });
    });
  }
}

test("CA-38: con il testo al 200% nessun giorno è tagliato e il foglio non scorre di lato", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openGallery(page, "chiaro");
  await page.evaluate(() => {
    // Text at 200%: the root font size is what the user changes.
    document.documentElement.style.fontSize = "200%";
  });
  await page
    .getByTestId("ds-data")
    .getByRole("button", { name: /^Giorno/ })
    .click();
  const dialog = page.getByRole("dialog", { name: "Giorno" });
  await expect(dialog).toBeVisible();
  await waitForAnimationsToEnd(page);
  const clipped = await dialog.evaluate(
    (el) =>
      Array.from(el.querySelectorAll<HTMLElement>('[role="gridcell"]')).filter(
        (cell) => cell.scrollWidth > cell.clientWidth,
      ).length,
  );
  expect(clipped).toBe(0);
  const sideScroll = await dialog.evaluate((el) =>
    Array.from(el.querySelectorAll<HTMLElement>("*")).some(
      (node) =>
        node.scrollWidth > node.clientWidth &&
        getComputedStyle(node).overflowX !== "visible",
    ),
  );
  expect(sideScroll).toBe(false);
  expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
});
