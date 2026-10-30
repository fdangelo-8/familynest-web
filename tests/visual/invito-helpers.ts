import { expect, type Page } from "@playwright/test";
import type { ThrowawayUser } from "../fixtures/throwaway-user";
import type { userWithNest } from "./persone-helpers";

type Members = Parameters<typeof userWithNest>[1];

// Shared by tests/visual/onboarding-invito.spec.ts and
// tests/a11y/onboarding-invito-visivo.spec.ts (onboarding step 4 "Invito",
// #14, without QR). Every test has its own throwaway user with a Nest written
// with the administrative key of the local Supabase; the invitations are made
// by the page itself (opening it is what creates them), so the note under the
// title is always "Il link vale 7 giorni.".

export const CARLA: Members[number] = {
  name: "Carla",
  kind: "adult",
  color: "lampone",
};

/** Two adults with 40 characters each, the longest name the app allows. */
export const LONG_NAMES: Members = [
  {
    name: "Maria Francesca Giovanna Dall'Orto Bianc",
    kind: "adult",
    color: "glicine",
  },
  {
    name: "Giovanni Battista Alessandro Maria Rossi",
    kind: "adult",
    color: "lampone",
  },
];

export const FRESH_NOTE = "Il link vale 7 giorni.";

/** Visible one of the two layouts (one `<main>`, one shown at a time). */
export const shown = (
  page: Page,
  role: Parameters<Page["getByRole"]>[0],
  name: string | RegExp,
) => page.getByRole(role, { name }).filter({ visible: true });

/** Opens the page as the user and waits for the real one (not the skeleton). */
export async function openInvite(
  page: Page,
  user: ThrowawayUser,
  baseURL: string | undefined,
  path = "/onboarding/invito",
) {
  await user.signInContext(page.context(), baseURL as string);
  await page.goto(path);
  await page.locator("h1:visible").first().waitFor();
  await expect(shown(page, "button", "Copia il link")).toBeVisible();
}

/** Fonts loaded, pointer away from any control (no hover state). */
export async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(0, 0);
}

/**
 * Answers the next client-side visit of `?persona=2` as if the invitation
 * could not be prepared: the page is the same, with `failure` set and no
 * token (the server cannot be made to fail from the browser).
 */
export async function failInvite(page: Page, failure: "server" | "network") {
  await page.route(
    (url) => url.search.includes("persona=2"),
    async (route) => {
      if (route.request().headers()["rsc"] !== "1") return route.continue();
      try {
        const response = await route.fetch();
        const body = (await response.text())
          .replace(/"failure":null/, `"failure":"${failure}"`)
          .replace(/"token":"[0-9a-f]+"/, '"token":null')
          .replace(/"note":"[^"]*"/, '"note":""');
        await route.fulfill({ response, body });
      } catch {
        await route.abort().catch(() => undefined);
      }
    },
  );
}

/** Makes the copy to the clipboard fail, as when the browser refuses it. */
export async function breakClipboard(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: () =>
          Promise.reject(new DOMException("denied", "NotAllowedError")),
      },
      configurable: true,
    });
  });
}
