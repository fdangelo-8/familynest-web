import { expect, test, type Page } from "@playwright/test";
import {
  oggiNow,
  installOggiFake,
  type OggiFakeOptions,
} from "../fixtures/oggi-visuale";
import { hasTestUser } from "../fixtures/visual-login";
import { signInAsCached } from "../fixtures/visual-login-cached";

// Oggi (#30): one screenshot per state of the mockup 09-oggi.html, at 390 and
// 1280 px (projects). The page reads its data in the browser, and that data is
// served by a fake (fixtures/oggi-visuale.ts): nothing is written to the
// database and the shots do not depend on what other suites do in the same
// Nest. Sign-in, the Nest and its members are real: test user A is needed.
// The clock is fixed at Tuesday 20 October 2026, 15:52 (Rome), like the mockup.
// «Già fatti» open has no reference yet: its rows wait for the shared request
// #241 (colour of the secondary text), see tests/a11y/oggi.spec.ts.
// The references are generated in the CI container (workflow visual-baseline).

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

test.beforeEach(async ({ context, baseURL }) => {
  test.skip(!hasTestUser("A"), "TEST_USER_A_* non impostati");
  const signedIn = await signInAsCached(context, baseURL!, "A");
  test.skip(!signedIn, "utente di test A non ancora creato (#55)");
});

/** The first visible match: the page has two layouts, one is always hidden. */
const shown = (page: Page, text: string | RegExp) =>
  page.getByText(text).locator("visible=true").first();

async function open(page: Page, options: OggiFakeOptions, ready = true) {
  await page.clock.setFixedTime(oggiNow(options.scenario));
  const fake = await installOggiFake(page, options);
  await page.goto("/oggi");
  await expect(page.getByRole("main")).toBeVisible();
  if (ready) {
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, {
      timeout: 20_000,
    });
  }
  await page.evaluate(() => document.fonts.ready);
  return fake;
}

/**
 * The window as tall as the page, like the frames of the mockup: the sticky bar
 * and navigation then sit at the top and at the bottom of the whole page.
 */
async function fit(page: Page) {
  const base = page.viewportSize()!;
  for (let i = 0; i < 2; i++) {
    const height = await page.evaluate(
      () => document.documentElement.scrollHeight,
    );
    await page.setViewportSize({
      width: base.width,
      height: Math.max(base.height, height),
    });
  }
}

/** The pointer away from everything: the shot shows the resting state. */
async function shoot(page: Page, name: string) {
  await page.mouse.move(0, 0);
  await fit(page);
  await expect(page).toHaveScreenshot(name);
}

test("normale: lente «Io»", async ({ page }) => {
  await open(page, { scenario: "normale" });
  await expect(shown(page, "Call con Acme")).toBeVisible();
  await expect(shown(page, "Chiamare il commercialista")).toBeVisible();
  await shoot(page, "normale-io.png");
});

test("normale: lente «Nest»", async ({ page }) => {
  await open(page, { scenario: "normale" });
  const lens = page.getByRole("group", {
    name: "Punto di vista: solo tu o tutto il Nest",
  });
  const nest = lens.getByRole("button", { name: /Nest$/ });
  await nest.click();
  await expect(nest).toHaveAttribute("aria-pressed", "true");
  await expect(shown(page, "Firmare autorizzazione gita")).toBeVisible();
  await shoot(page, "normale-nest.png");
});

test("vuoto: il primo giorno", async ({ page }) => {
  await open(page, { scenario: "vuoto" });
  await expect(shown(page, "Giornata libera, per ora")).toBeVisible();
  await expect(shown(page, "Per cominciare")).toBeVisible();
  await shoot(page, "vuoto.png");
});

test("caricamento", async ({ page }) => {
  await open(page, { scenario: "normale", events: "slow" }, false);
  await expect(
    page.locator('[aria-busy="true"]').locator("visible=true").first(),
  ).toBeVisible();
  await shoot(page, "caricamento.png");
});

test("errore: offline", async ({ page, context }) => {
  await open(page, { scenario: "normale" });
  await expect(shown(page, "Call con Acme")).toBeVisible();
  await context.setOffline(true);
  await expect(shown(page, /^Sei offline\./)).toBeVisible();
  await shoot(page, "errore-offline.png");
});

test("conferma: cosa da fare spuntata", async ({ page }) => {
  await open(page, { scenario: "normale" });
  await page
    .getByRole("checkbox", {
      name: "Segna come fatto: Chiamare il commercialista",
    })
    .click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Fatto: Chiamare il commercialista" }),
  ).toBeVisible();
  await shoot(page, "conferma.png");
});

test("primo accesso di chi è stato invitato", async ({ page }) => {
  await open(page, { scenario: "invitato" });
  await expect(
    page.getByRole("region", { name: "La casa in una frase" }),
  ).toBeVisible();
  await shoot(page, "primo-accesso-invitato.png");
});

test("per oggi è tutto", async ({ page }) => {
  await open(page, { scenario: "tutto-fatto" });
  await expect(shown(page, "Per oggi è tutto")).toBeVisible();
  await shoot(page, "tutto-fatto.png");
});
