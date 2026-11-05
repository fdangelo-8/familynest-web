import path from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test } from "@playwright/test";

// TEMPORARY, never merged: photographs the frames of the mockup 24-notifiche in
// the same container as the CI, so that the comparison with the page is made
// with the same text rendering.

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

test("mockup notifiche", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "una sola volta");
  await page.setViewportSize({ width: 1500, height: 1000 });
  await page.goto(
    pathToFileURL(path.resolve("docs/mockup/24-notifiche.html")).href,
  );
  await page.evaluate(() => document.fonts.ready);
  for (const state of ["normale", "vuoto", "caricamento"]) {
    const section = page.locator(`section[data-stato="${state}"]`);
    await expect(section.locator(".frame-mobile")).toHaveScreenshot(
      `mock-${state}-mobile.png`,
    );
    await expect(section.locator(".frame-desktop")).toHaveScreenshot(
      `mock-${state}-desktop.png`,
    );
  }
});
