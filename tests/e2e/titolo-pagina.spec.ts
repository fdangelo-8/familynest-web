import { expect, test, type Page } from "@playwright/test";
import { hasTestUser, signInAs } from "../fixtures/visual-login";

// The <title> must stay in the <head> while React takes the page over.
// With `cacheComponents` it was seen leaving the <head> for a few hundred
// milliseconds right after the hydration and coming back (issue #364): a check
// that ran in that gap (axe «document-title») failed. The test records every
// moment in which the page had a title, then had none.

async function watchTitle(page: Page) {
  await page.addInitScript(() => {
    const state = { seen: false, gaps: 0 };
    (window as unknown as { __title: typeof state }).__title = state;
    new MutationObserver(() => {
      if (document.title !== "") state.seen = true;
      else if (state.seen) state.gaps += 1;
    }).observe(document, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  });
}

async function titleGaps(page: Page) {
  return page.evaluate(
    () => (window as unknown as { __title: { gaps: number } }).__title.gaps,
  );
}

/** React owns the node (before that a click does nothing). */
async function hydrated(page: Page, selector: string) {
  await page.waitForFunction(
    (css) =>
      Object.keys(document.querySelector(css) ?? {}).some((key) =>
        key.startsWith("__reactFiber$"),
      ),
    selector,
  );
}

test.describe("titolo della pagina", () => {
  test("pagina pubblica: il titolo non lascia l'head durante l'idratazione", async ({
    page,
  }) => {
    await watchTitle(page);
    await page.goto("/accesso/mail");
    await expect(page).toHaveTitle("FamilyNest");
    await hydrated(page, "main form");
    // Two frames after the hydration, still no gap.
    await page.evaluate(
      () =>
        new Promise<void>((done) =>
          requestAnimationFrame(() => requestAnimationFrame(() => done())),
        ),
    );
    await expect(page).toHaveTitle("FamilyNest");
    expect(await titleGaps(page)).toBe(0);
  });

  test("pagina della casa: il titolo non lascia l'head durante l'idratazione", async ({
    page,
    context,
    baseURL,
  }) => {
    test.skip(!hasTestUser("A"), "TEST_USER_A_* non impostati");
    const signedIn = await signInAs(context, baseURL!, "A");
    test.skip(!signedIn, "utente di test A non ancora creato (#55)");
    await watchTitle(page);
    await page.goto("/casa/scadenze");
    await expect(page).toHaveTitle("FamilyNest · Casa · Scadenze");
    await hydrated(page, "main");
    await expect(page.getByRole("region", { name: "Scadenze" })).toBeVisible({
      timeout: 20_000,
    });
    await page.evaluate(
      () =>
        new Promise<void>((done) =>
          requestAnimationFrame(() => requestAnimationFrame(() => done())),
        ),
    );
    await expect(page).toHaveTitle("FamilyNest · Casa · Scadenze");
    expect(await titleGaps(page)).toBe(0);
  });
});
