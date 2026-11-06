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
  const info = await page.evaluate(async () => {
    const links = () =>
      [...document.querySelectorAll("a")].filter((a) =>
        a.getAttribute("href")?.includes("settimana"),
      );
    const before = links();
    let added = 0;
    let attrs = 0;
    const obs = new MutationObserver((records) => {
      for (const r of records) {
        added += r.addedNodes.length;
        if (r.type === "attributes") attrs++;
      }
    });
    obs.observe(document, { subtree: true, childList: true, attributes: true });
    const calls: string[] = [];
    const original = window.fetch;
    window.fetch = function (...args) {
      if (calls.length < 3) {
        const url = String(args[0] instanceof Request ? args[0].url : args[0]);
        if (url.includes("calendario"))
          calls.push(
            new Error().stack?.split("\n").slice(2, 9).join(" | ") ?? "",
          );
      }
      return original.apply(this, args);
    };
    await new Promise((r) => setTimeout(r, 3000));
    obs.disconnect();
    const after = links();
    return {
      count: before.length,
      same: before.filter((a) => after.includes(a)).length,
      added,
      attrs,
      calls,
      rects: before.map((a) => JSON.stringify(a.getBoundingClientRect())),
    };
  });
  console.log(`EXP ${JSON.stringify(info)}`);
  let n = 0;
  const on = (r: Request) => {
    if (r.url().includes("/calendario")) n++;
  };
  page.on("request", on);
  await page.waitForTimeout(5000);
  page.off("request", on);
  console.log(`EXP calendario requests in 5 s: ${n}`);
  expect(n).toBeLessThan(5);
});
