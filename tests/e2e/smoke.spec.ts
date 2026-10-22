import { expect, test } from "@playwright/test";

test("la home risponde e mostra FamilyNest", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.ok()).toBe(true);
  await expect(page.getByRole("heading", { name: /FamilyNest/ })).toBeVisible();
});
