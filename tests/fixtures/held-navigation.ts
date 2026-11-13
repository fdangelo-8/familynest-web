import type { Locator, Page } from "@playwright/test";
import { waitHydrated } from "./esplora";

// Tests of the loading shell of a page (`loading.tsx`): the real navigation to
// the page is held, so the shell stays on screen.
//
// The shell is shown only if the router already has it: it comes with the
// prefetch of the link. A click before that prefetch has finished (or before
// React owns the link, when the click is a native navigation that never goes
// through `?_rsc=`) finds nothing to show and the page just waits: the test
// then looked for «Caricamento in corso» for 5 seconds and failed, and passed
// when run again with the prefetch done (issues #253, #353).

export type HeldNavigation = {
  /** Lets the held navigation go on. */
  release: () => void;
  /**
   * Clicks `link` when it is safe: the prefetch of the page has been
   * answered and the link belongs to React.
   */
  clickWhenReady: (link: Locator) => Promise<void>;
};

/**
 * Holds the navigation (not the prefetch) to the page whose RSC request
 * matches `address`. Call it BEFORE `page.goto`, so no prefetch is missed.
 * Release it with `release()` (the test must do it, or the page never opens).
 */
export async function holdNavigation(
  page: Page,
  address: RegExp,
): Promise<HeldNavigation> {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => (release = resolve));
  const prefetched = page.waitForResponse(
    (response) =>
      address.test(response.url()) &&
      !!response.request().headers()["next-router-prefetch"],
  );
  // The wait may be abandoned if the test fails earlier: not an error.
  prefetched.catch(() => {});
  await page.route(address, async (route) => {
    if (route.request().headers()["next-router-prefetch"]) {
      await route.continue();
      return;
    }
    await gate;
    await route.continue();
  });
  return {
    release,
    clickWhenReady: async (link) => {
      await (await prefetched).finished();
      await waitHydrated(link);
      await link.click();
    },
  };
}
