import { expect, test } from "@playwright/test";

// #482 / PR #490: animal components in the gallery
// (/design-system?pezzi-pagine=1, section #pezzi-animali), one reference per
// example, on mobile and desktop.

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

const FIXED_NOW = new Date("2026-11-18T15:00:00+01:00");

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW);
  await page.goto("/design-system?pezzi-pagine=1");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("#pezzi-animali")).toBeVisible();
});

for (const id of [
  "avatar-foto",
  "avatar-foto-rifiutata",
  "campo-foto",
  "campo-foto-errore",
  "campo-foto-stati",
  "scelta-giorni",
  "scelta-giorni-stretta",
  "turno-persone",
  "turno-persone-stati",
  "si-ripete-scadenza",
  "si-ripete-giorni",
  "si-ripete-cosa",
]) {
  test(`#482: esempio ${id}`, async ({ page }) => {
    const example = page.getByTestId(id);
    await example.scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
    await expect(example).toHaveScreenshot(`esempio-${id}.png`);
  });
}
