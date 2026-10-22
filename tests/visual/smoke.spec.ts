import { expect, test } from "@playwright/test";

test("screenshot della home", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveScreenshot("home.png");
});
