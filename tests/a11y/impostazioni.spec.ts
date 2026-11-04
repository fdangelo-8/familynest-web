import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { waitForAnimationsToEnd } from "../fixtures/animations";
import { signInAs, skipReason, usersConfigured } from "../fixtures/auth";
import { dialog, leaveButton, openSettings } from "../fixtures/impostazioni-ca";

// "Impostazioni della casa" (#41), CA-37: axe on /impostazioni and with the
// dialog «Uscire da Casa D'Angelo?» open, at 390 and 1280 px, with no duplicate
// ids. A never saves anything: the dialog is only opened.

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

test.describe("impostazioni della casa: accessibilità", () => {
  test("CA-37: axe senza violazioni gravi, né con il dialogo aperto, né id duplicati", async ({
    page,
    baseURL,
  }) => {
    test.skip(!usersConfigured("A"), skipReason("A"));
    await signInAs(page.context(), baseURL as string, "A");
    await openSettings(page, "Casa D'Angelo");
    await waitForAnimationsToEnd(page);
    expect(await seriousViolations(page)).toEqual([]);
    expect(await duplicateIds(page)).toEqual([]);

    await leaveButton(page, "Casa D'Angelo").click();
    await expect(dialog(page)).toBeVisible();
    await waitForAnimationsToEnd(page);
    expect(await seriousViolations(page)).toEqual([]);
    expect(await duplicateIds(page)).toEqual([]);
  });
});
