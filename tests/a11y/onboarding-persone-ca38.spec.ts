import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { signInAs, skipReason, usersConfigured } from "../fixtures/auth";

// Accessibility of onboarding step 2 (#13), CA-38: axe on the page and on the
// "Modifica Sofia" sheet, at 390 and 1280 px (the two projects). User A only
// reads; nothing is saved. Skipped when the test users are not set up.

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

test.skip(!usersConfigured("A"), skipReason("A"));

async function expectNoBlocking(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations
      .filter((v) => ["serious", "critical"].includes(v.impact ?? ""))
      .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
  ).toEqual([]);
  // No duplicated id (axe reports it as "duplicate-id*", usually minor).
  const ids = await page.evaluate(() => {
    const seen = new Map<string, number>();
    for (const el of document.querySelectorAll("[id]")) {
      seen.set(el.id, (seen.get(el.id) ?? 0) + 1);
    }
    return [...seen].filter(([, n]) => n > 1).map(([id]) => id);
  });
  expect(ids).toEqual([]);
}

test("CA-38: la pagina e il foglio «Modifica Sofia» non hanno violazioni gravi", async ({
  page,
  baseURL,
}) => {
  await signInAs(page.context(), baseURL as string, "A");
  await page.goto("/onboarding/persone");
  await expect(page.locator("h1:visible")).toHaveText("Chi c'è nel Nest?");
  await expect(
    page.getByRole("list", { name: "Persone del Nest" }).getByRole("listitem"),
  ).toHaveCount(5);
  await expectNoBlocking(page);

  const edit = page.getByRole("dialog", { name: "Modifica Sofia" });
  await expect(async () => {
    await page.getByRole("button", { name: "Modifica Sofia" }).click();
    await expect(edit).toBeVisible({ timeout: 1000 });
  }).toPass();
  await expectNoBlocking(page);
});
