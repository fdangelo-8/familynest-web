import type { Request } from "@playwright/test";
import { createNuoto, expect, test } from "../fixtures/impegni";
import { waitHydrated } from "../fixtures/profilo";
import { romeDay } from "../fixtures/casa";

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });
test.describe.configure({ timeout: 150_000, retries: 0 });

test("exp pages", async ({ page, baseURL, casa }) => {
  const id = await createNuoto(casa);
  await casa.signIn(page, baseURL, "Marco");
  const day = romeDay();
  const paths = [
    "/oggi",
    `/calendario/mese?mese=${day.slice(0, 7)}`,
    `/calendario/giorno?giorno=${day}`,
    "/calendario",
    `/impegni/${id}?giorno=${day}`,
    "/casa",
  ];
  for (const path of paths) {
    await page.goto(path);
    const h1 = page.getByRole("main").getByRole("heading", { level: 1 });
    await expect(h1).toBeVisible({ timeout: 20_000 });
    await waitHydrated(h1);
    await page.waitForTimeout(4000);
    const counts = new Map<string, number>();
    const on = (r: Request) => {
      const u = new URL(r.url());
      if (u.pathname.startsWith("/_next/static")) return;
      const key = `${u.pathname}${u.search.replace(/[?&]_rsc=\w+/, "")}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    };
    page.on("request", on);
    await page.waitForTimeout(4000);
    page.off("request", on);
    console.log(`EXP ${path} => ${JSON.stringify([...counts])}`);
  }
});
