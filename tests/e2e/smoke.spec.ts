import { expect, test } from "@playwright/test";

test("la home porta chi non ha fatto l'accesso alla pagina di accesso", async ({
  page,
}) => {
  const response = await page.goto("/");
  expect(response?.ok()).toBe(true);
  await expect(page).toHaveURL(/\/accesso$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
});
