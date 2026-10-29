import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { signInAs, skipReason, usersConfigured } from "../fixtures/auth";

// "Il tuo Nest" (#17), CA-30: axe on the page and on the open "Invita
// qualcuno" dialog, at 390 and 1280 px (the two Playwright projects).

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations.filter((v) =>
    ["serious", "critical"].includes(v.impact ?? ""),
  );
}

async function duplicateIds(page: Page) {
  return page.evaluate(() => {
    const seen = new Map<string, number>();
    for (const el of document.querySelectorAll("[id]")) {
      seen.set(el.id, (seen.get(el.id) ?? 0) + 1);
    }
    return [...seen].filter(([, n]) => n > 1).map(([id]) => id);
  });
}

test.describe("Il tuo Nest: accessibilità", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    test.skip(!usersConfigured("A"), skipReason("A"));
    await signInAs(page.context(), baseURL as string, "A");
    await page.goto("/nest");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("CA-30: la pagina non ha violazioni serious o critical né id doppi", async ({
    page,
  }) => {
    expect(await seriousViolations(page)).toEqual([]);
    expect(await duplicateIds(page)).toEqual([]);
  });

  test("CA-30: il dialogo «Invita qualcuno» non ha violazioni né id doppi", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Invita qualcuno" }).click();
    await expect(
      page.getByRole("dialog", { name: "Invita qualcuno" }),
    ).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
    expect(await duplicateIds(page)).toEqual([]);
  });
});
