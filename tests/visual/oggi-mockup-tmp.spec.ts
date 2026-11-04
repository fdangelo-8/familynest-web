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
    const section = page.locator(`[data-stato="${state}"]`);
    for (const [frame, width] of [
      [".frame-mobile", 390],
      [".frame-desktop", 1280],
    ] as const) {
      const box = await section.locator(frame).boundingBox();
      expect(box).not.toBeNull();
      const image = await page.screenshot({ fullPage: true, clip: box! });
      expect(image).toMatchSnapshot(`mockup-${state}-${width}.png`);
    }
  });
}
