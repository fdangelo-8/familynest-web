import type { Page } from "@playwright/test";

/**
 * Waits for the finite animations on the page (sheet slide, backdrop fade) to
 * end. Infinite ones (spinner, skeleton) are ignored: they never finish.
 * No fixed wait.
 */
export async function waitForAnimationsToEnd(page: Page) {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().endTime !== Infinity)
        // An animation cut short (its element left the page) is over too.
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );
}
