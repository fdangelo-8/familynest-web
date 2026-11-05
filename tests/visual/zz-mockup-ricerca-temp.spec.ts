import { expect, test } from "@playwright/test";
import { pathToFileURL } from "node:url";
import path from "node:path";

// TEMPORARY (tester visivo, PR #257): screenshots of the approved mockup, to
// compare with the page by eye. Not a reference: the file is removed before
// the end of the work and its images are never committed.

test.use({ viewport: { width: 1500, height: 1000 }, locale: "it-IT" });

for (const state of ["normale", "normale-risultati", "vuoto", "caricamento"]) {
  test(`mockup ${state}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "una sola volta");
    await page.goto(
      pathToFileURL(path.resolve("docs/mockup/25-ricerca.html")).href,
    );
    await page.evaluate(() => document.fonts.ready);
    const section = page.locator(`.mock-stato[data-stato="${state}"]`);
    const mobile = section.locator(".frame-mobile").first();
    await expect(mobile).toBeVisible();
    await expect(mobile).toHaveScreenshot(`mockup-${state}-mobile.png`);
    const desktop = section.locator(".frame-desktop").first();
    if (await desktop.count()) {
      await expect(desktop).toHaveScreenshot(`mockup-${state}-desktop.png`);
    }
  });
}
