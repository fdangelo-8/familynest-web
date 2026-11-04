import { expect, test } from "@playwright/test";

// #221 / PR #224: examples of the shared page parts in the gallery
// (/design-system?pezzi-pagine=1), one reference per example, on mobile and
// desktop.

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

const FIXED_NOW = new Date("2026-10-20T15:00:00+02:00");

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW);
  await page.goto("/design-system?pezzi-pagine=1");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("#pezzi-pagine")).toBeVisible();
});

for (const id of [
  "sezione-link",
  "profilo-testa-azione",
  "modulo-gruppi",
  "campo-doppio-tre",
  "sezione-ancora",
  "spazio-arrivo",
  "oggi-disposizioni",
]) {
  test(`#221 / #231: esempio ${id}`, async ({ page }) => {
    const example = page.getByTestId(id);
    await example.scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
    await expect(example).toHaveScreenshot(`esempio-${id}.png`);
  });
}

test("#221: sezione intera dei pezzi delle pagine", async ({ page }) => {
  const section = page.locator("#pezzi-pagine");
  await section.scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0);
  await expect(section).toHaveScreenshot("sezione-pezzi-pagine.png");
});
