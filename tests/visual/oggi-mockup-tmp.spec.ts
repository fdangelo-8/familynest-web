import path from "node:path";
import { expect, test } from "@playwright/test";

// Temporary (#30): screenshots of the frames of the mockup 09-oggi.html, only
// to look at them next to the app. Removed right after the comparison.

const STATES = [
  "normale",
  "normale-lente-nest",
  "vuoto",
  "caricamento",
  "errore",
  "conferma",
  "primo-accesso-invitato",
];

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

for (const state of STATES) {
  test(`mockup ${state}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "una sola volta");
    await page.setViewportSize({ width: 1500, height: 1000 });
    await page.goto(`file://${path.resolve("docs/mockup/09-oggi.html")}`, {
      waitUntil: "load",
    });
    await page.evaluate(() => document.fonts.ready);
    const section = page.locator(`#09-oggi--${state}`);
    await expect(section.locator(".frame-mobile")).toHaveScreenshot(
      `mockup-${state}-390.png`,
    );
    await expect(section.locator(".frame-desktop")).toHaveScreenshot(
      `mockup-${state}-1280.png`,
    );
  });
}
