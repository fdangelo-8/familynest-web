import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("CA-47: la galleria non ha violazioni serious o critical", async ({
  page,
}) => {
  await page.goto("/design-system");
  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter(
    (violation) =>
      violation.impact === "serious" || violation.impact === "critical",
  );
  expect(blocking).toEqual([]);
  await expect(page.locator("h1")).toHaveCount(1);
});

test("CA-47: neanche con foglio e dialogo aperti", async ({ page }) => {
  await page.goto("/design-system");
  await page.getByRole("button", { name: "Apri foglio" }).click();
  const sheet = await new AxeBuilder({ page }).analyze();
  expect(
    sheet.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    ),
  ).toEqual([]);
});
