import path from "node:path";
import { expect, test } from "@playwright/test";

// TEMPORARY (visual tester, #27): screenshots of the frames of the approved
// mockup 14-calendario-mese, to look at them next to the page. Removed after
// the comparison.
test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

for (const state of ["normale", "vuoto", "caricamento"]) {
  test(`mockup ${state}`, async ({ page }, info) => {
    await page.goto(
      `file://${path.resolve("docs/mockup/14-calendario-mese.html")}`,
    );
    await page.evaluate(() => document.fonts.ready);
    const frame = page
      .locator(`[data-stato="${state}"]`)
      .locator(
        info.project.name === "mobile" ? ".frame-mobile" : ".frame-desktop",
      );
    await expect(frame).toHaveScreenshot(`mockup-${state}.png`);
  });
}
