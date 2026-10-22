import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("la pagina di accesso non ha violazioni serious o critical", async ({ page }) => {
  await page.goto("/accesso");
  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(blocking).toEqual([]);
});
