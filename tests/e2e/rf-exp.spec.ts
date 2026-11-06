import type { Request } from "@playwright/test";
import { createNuoto, expect, test } from "../fixtures/impegni";
import { waitHydrated } from "../fixtures/profilo";

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });
test.describe.configure({ timeout: 100_000, retries: 0 });

test("exp oggi", async ({ page, baseURL, casa }) => {
  await createNuoto(casa);
  await casa.signIn(page, baseURL, "Marco");
  await page.goto("/oggi");
  const h1 = page.getByRole("main").getByRole("heading", { level: 1 });
  await expect(h1).toBeVisible({ timeout: 20_000 });
  await waitHydrated(h1);
  await page.waitForTimeout(5000);
  let n = 0;
  const on = (r: Request) => {
    if (r.url().includes("/calendario")) n++;
  };
  page.on("request", on);
  await page.waitForTimeout(10_000);
  page.off("request", on);
  console.log(`EXP calendario requests in 10 s: ${n}`);
  expect(n).toBeLessThan(5);
});
