import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// #461 / PR #484: axe on the sign-in example of the gallery, at 390 and
// 1280 px.

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

test("#461: axe sull'esempio dell'accesso, senza violazioni serious o critical", async ({
  page,
}) => {
  await page.goto("/design-system?pezzi-pagine=1");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByTestId("accesso-pezzi")).toBeVisible();
  const results = await new AxeBuilder({ page })
    .include('[data-testid="accesso-pezzi"]')
    .analyze();
  expect(
    results.violations
      .filter((v) => ["serious", "critical"].includes(v.impact ?? ""))
      .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
  ).toEqual([]);
});
