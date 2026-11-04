import { expect, test, type Page } from "@playwright/test";
import { createThrowawayUser, type ThrowawayUser } from "./throwaway-user";

// Helpers shared by tests/visual/impostazioni.spec.ts and
// tests/a11y/impostazioni.spec.ts (page /impostazioni, issue #41).
// Seed users only read; every test that writes uses a throwaway user.

export const FIXED_NOW = new Date("2026-10-29T12:00:00+01:00");

export const baseURL = () =>
  test.info().project.use.baseURL ?? "http://localhost:3000";

const AGES: Record<string, string> = {
  Sofia: "9 anni",
  Tommaso: "6 anni",
  Leo: "7 anni",
};

/**
 * Opens /impostazioni and waits for the real page (not the skeleton) and for
 * React: a click before hydration does nothing. Ages are written by the
 * server from the real clock: they are pinned so the references do not change
 * when someone has a birthday.
 */
export async function openSettings(page: Page, heading: string) {
  await expect(async () => {
    await page.goto("/impostazioni");
    await expect(
      page.getByRole("heading", { level: 1, name: heading }),
    ).toBeVisible({ timeout: 10_000 });
  }).toPass({ timeout: 60_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState("load");
  await page.evaluate((fixed) => {
    for (const row of document.querySelectorAll("main li")) {
      const title = row.querySelector(".riga-lista__titolo")?.textContent ?? "";
      const info = row.querySelector(".riga-lista__info");
      if (info && fixed[title] && /^\d+ anni?$/.test(info.textContent ?? "")) {
        info.textContent = fixed[title]!;
      }
    }
  }, AGES);
}

export async function userWithNest(
  page: Page,
  options: {
    name?: string;
    type?: "single" | "family_with_children";
  } = {},
): Promise<ThrowawayUser> {
  const user = await createThrowawayUser("Ilaria De Santis");
  const { error } = await user.client.rpc("create_household", {
    name: options.name ?? "Casa De Santis",
    household_type: options.type ?? "single",
    member_name: "Ilaria",
    color: "pomodoro",
  });
  if (error) {
    await user.remove();
    throw new Error("Nest di prova non creato");
  }
  await user.signInContext(page.context(), baseURL());
  return user;
}

/** Opens the «Esci da …» dialog; retries until React has taken over. */
export async function openLeaveDialog(page: Page, nestName: string) {
  const dialog = page.getByRole("alertdialog");
  await expect(async () => {
    if (!(await dialog.isVisible())) {
      await page.getByRole("button", { name: `Esci da ${nestName}` }).click();
    }
    await expect(dialog).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 30_000 });
  return dialog;
}

/** Waits for the five switches, then moves the pointer away from the page. */
export async function settle(page: Page) {
  await expect(page.getByRole("switch")).toHaveCount(5);
  await page.mouse.move(0, 0);
}
