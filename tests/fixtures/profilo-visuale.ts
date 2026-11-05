import { expect, test, type Page } from "@playwright/test";
import { createThrowawayUser, type ThrowawayUser } from "./throwaway-user";

// Helpers shared by tests/visual/profilo.spec.ts and tests/a11y/profilo.spec.ts
// (page /profilo, issue #38). Seed users only read; everything that writes
// uses throwaway users (deleted at the end) or a fake answer for the write.

export const FIXED_NOW = new Date("2026-11-04T10:00:00+01:00");

export const baseURL = () =>
  test.info().project.use.baseURL ?? "http://localhost:3000";

/** Same mail on every run: the throwaway mail is random. */
export const FROZEN_MAIL = "ilaria.desantis@example.test";

/** Opens /profilo and waits for the real page and for React. */
export async function openProfile(page: Page, heading?: string | RegExp) {
  await expect(async () => {
    await page.goto("/profilo");
    await expect(
      heading
        ? page.getByRole("heading", { level: 1, name: heading })
        : page.locator("h1:visible"),
    ).toBeVisible({ timeout: 10_000 });
  }).toPass({ timeout: 60_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState("load");
  await expect(
    page.getByRole("radiogroup", { name: "Il tuo colore" }),
  ).toBeVisible();
}

/** Throwaway mail replaced by a fixed one, so the reference does not change. */
export async function freezeMail(page: Page) {
  await page.evaluate((mail) => {
    const p = document.querySelector("p.intestazione__sotto");
    if (p?.textContent?.includes("onboarding-")) {
      p.textContent = p.textContent.replace(/onboarding-[^ ]+/, mail);
    }
  }, FROZEN_MAIL);
}

/** Pins the pointer away and shoots: no hover state in the reference. */
export async function shoot(page: Page, name: string, fullPage = true) {
  await page.mouse.move(0, 0);
  await freezeMail(page);
  await expect(page).toHaveScreenshot(name, { fullPage });
}

/** A throwaway user with a Nest of their own, signed in the page's context. */
export async function throwawayWithNest(
  page: Page,
  fullName = "Ilaria De Santis",
): Promise<ThrowawayUser> {
  const user = await createThrowawayUser(fullName);
  const { error } = await user.client.rpc("create_household", {
    name: "Casa De Santis",
    household_type: "family_with_children",
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

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
};

export type WriteFailure = "network" | "server" | "taken";

/**
 * The writes (PATCH) of one table of the database fail in the given way; reads
 * go on. Nothing is written. "server" is a 500 with no code; "taken" is the
 * unique-violation answer (23505) of a colour taken meanwhile.
 */
export async function failWrites(
  page: Page,
  table: "household_members" | "profiles",
  failure: WriteFailure,
) {
  await page.route(`**/rest/v1/${table}*`, async (route) => {
    if (route.request().method() !== "PATCH") return route.fallback();
    if (failure === "network") return route.abort("failed");
    const taken = failure === "taken";
    return route.fulfill({
      status: taken ? 409 : 500,
      headers: { ...CORS, "content-type": "application/json" },
      body: JSON.stringify(
        taken
          ? { code: "23505", message: "duplicate key", details: "", hint: "" }
          : { message: "boom" },
      ),
    });
  });
}

/** The answer of POST /profilo/elimina, whatever the dialog sends. */
export async function fakeDeletion(
  page: Page,
  answer:
    | "network"
    | "server"
    | {
        outlook: {
          isLastAdultWithAccount: boolean;
          remainingNames: string[];
          newAdministratorName: string | null;
        };
      },
) {
  await page.route("**/profilo/elimina", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    if (answer === "network") return route.abort("failed");
    if (answer === "server") {
      return route.fulfill({ status: 500, json: { ok: false } });
    }
    return route.fulfill({
      status: 409,
      json: { ok: false, changed: true, outlook: answer.outlook },
    });
  });
}
