import { test } from "@playwright/test";
test.use({ locale: "it-IT", timezoneId: "Europe/Rome", reducedMotion: "reduce" });
test("diag", async ({ page }) => {
  await page.goto("/design-system");
  await page.evaluate(() => document.fonts.ready);
  const measure = () =>
    page.evaluate(
      () =>
        [...document.querySelectorAll("main > section")]
          .map((s) => `${s.id}:${Math.round(s.getBoundingClientRect().height)}`)
          .join(" ") + ` | doc=${document.documentElement.scrollHeight}`,
    );
  const w = page.viewportSize()!.width;
  console.log("DIAG A " + (await measure()));
  await page.setViewportSize({ width: w, height: 20000 });
  await page.waitForTimeout(500);
  console.log("DIAG B " + (await measure()));
  await page.setViewportSize({ width: w, height: 844 });
  await page.waitForTimeout(500);
  console.log("DIAG C " + (await measure()));
});
