import { expect, test } from "@playwright/test";
import { signInAs, skipReason, usersConfigured } from "../fixtures/auth";
import {
  notifyEventsChanged,
  subscribeEventsChanged,
} from "../../src/lib/events-changed";

// #164: Add opens over the current page (parallel + intercepted route) and
// the N key opens it from 1024 px. Needs test user A.

test.describe("Aggiungi sopra la pagina", () => {
  test.beforeEach(() => {
    test.skip(!usersConfigured("A"), skipReason("A"));
  });

  test("dal bottone Aggiungi si apre il foglio sopra la pagina, senza ricaricarla", async ({
    page,
    baseURL,
  }, testInfo) => {
    await signInAs(page.context(), baseURL as string, "A");
    await page.goto("/calendario");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await page.evaluate(() => {
      (window as unknown as { __marker: string }).__marker = "same-page";
    });
    const link =
      testInfo.project.name === "desktop"
        ? page.getByRole("link", { name: "Aggiungi" }).first()
        : page.getByRole("link", { name: "Aggiungi" }).last();
    await link.click();
    const dialog = page.getByRole("dialog", { name: "Aggiungi" });
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(/\/aggiungi$/);
    expect(
      await page.evaluate(
        () => (window as unknown as { __marker?: string }).__marker,
      ),
    ).toBe("same-page");
    await expect(dialog.getByText("scrivi come parli")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(/\/calendario$/);
  });

  test("tasto N: apre Aggiungi solo da 1024 px, non con Alt", async ({
    page,
    baseURL,
  }, testInfo) => {
    await signInAs(page.context(), baseURL as string, "A");
    await page.goto("/calendario");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    const dialog = page.getByRole("dialog", { name: "Aggiungi" });

    if (testInfo.project.name !== "desktop") {
      await page.keyboard.press("n");
      await page.waitForTimeout(300);
      await expect(dialog).toHaveCount(0);
      await expect(page).toHaveURL(/\/calendario$/);
      return;
    }

    await page.keyboard.press("Alt+n");
    await page.waitForTimeout(300);
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(/\/calendario$/);

    await expect(async () => {
      await page.keyboard.press("n");
      await expect(dialog).toBeVisible({ timeout: 1000 });
    }).toPass();
    await expect(page).toHaveURL(/\/aggiungi$/);
  });
});

test("notifyEventsChanged avvisa chi è iscritto, finché non annulla l'iscrizione", () => {
  const calls: string[] = [];
  const g = globalThis as { window?: unknown };
  const previous = g.window;
  g.window = new EventTarget();
  try {
    const stop = subscribeEventsChanged(() => calls.push("a"));
    notifyEventsChanged();
    expect(calls).toEqual(["a"]);
    stop();
    notifyEventsChanged();
    expect(calls).toEqual(["a"]);
  } finally {
    g.window = previous;
  }
});
