import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test } from "@playwright/test";

// TEMPORARY (tester visivo, PR #232): screenshots of the approved mockup, only
// to look at them next to the page. Removed before the final commit.
test.use({ locale: "it-IT", reducedMotion: "reduce" });

for (const state of ["normale", "conferma"]) {
  test(`mockup ${state}`, async ({ page }, info) => {
    await page.goto(
      pathToFileURL(resolve("docs/mockup/28-impostazioni-nest.html")).href,
    );
    await page.evaluate(() => document.fonts.ready);
    const frame =
      info.project.name === "mobile" ? ".frame-mobile" : ".frame-desktop";
    await expect(
      page.locator(`[data-stato="${state}"] ${frame}`),
    ).toHaveScreenshot(`mockup-${state}.png`);
  });
}
