import { expect, test, type Page } from "@playwright/test";
import {
  NOTIFICHE_NOW,
  openNotifiche,
  type NotificheFakeOptions,
} from "../fixtures/notifiche-visuale";
import { hasTestUser } from "../fixtures/visual-login";
import { signInAsCached } from "../fixtures/visual-login-cached";

// Notifiche (#39): one screenshot per state, at 390 and 1280 px (projects).
// The notifications, the summary and the two writes are served by a fake of
// their endpoints (fixtures/notifiche-visuale.ts): nothing is written to the
// database and the shots do not depend on what other suites do in the same
// Nest. Sign-in, the Nest and its members (Marco, Laura, Sofia, Tommaso,
// Biscotto) are real: test user A is needed. The page clock is fixed to the
// mockup's "now" (Tuesday 20 October 2026, 15:52). The references are
// generated in the CI container (workflow visual-baseline).

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

/** Stops the page clock: the toast and the timers wait. */
async function freeze(page: Page) {
  await page.clock.pauseAt(new Date(NOTIFICHE_NOW.getTime() + 60_000));
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

async function open(
  page: Page,
  options: NotificheFakeOptions = {},
  ready = true,
) {
  return openNotifiche(page, options, ready);
}

test("normale con sintesi", async ({ page }) => {
  await open(page);
  await expect(page.getByTestId("sintesi")).toBeVisible();
  await freeze(page);
  await shoot(page, "normale.png");
});

test("vuoto", async ({ page }) => {
  await open(page, { scenario: "vuoto", digest: "off" });
  await expect(page.getByText("Tutto tranquillo")).toBeVisible();
  await freeze(page);
  await shoot(page, "vuoto.png");
});

test("vuoto con la sintesi sopra", async ({ page }) => {
  await open(page, { scenario: "vuoto" });
  await expect(page.getByTestId("sintesi")).toBeVisible();
  await freeze(page);
  await shoot(page, "vuoto-con-sintesi.png");
});

test("caricamento", async ({ page }) => {
  await open(page, { list: "slow" }, false);
  await expect(page.locator('[aria-busy="true"]').first()).toContainText(
    "Caricamento in corso",
  );
  await shoot(page, "caricamento.png");
});

test("errore di pagina", async ({ page }) => {
  await open(page, { list: "error" }, false);
  await expect(
    page.getByRole("heading", { name: "Questa pagina non si è caricata" }),
  ).toBeVisible();
  await shoot(page, "errore-pagina.png");
});

test("errore della sola sintesi", async ({ page }) => {
  await open(page, { digest: "error" });
  await expect(
    page.getByText("Non riusciamo a caricare la sintesi di oggi"),
  ).toBeVisible();
  await expect(page.getByTestId("notifica")).toHaveCount(5);
  await freeze(page);
  await shoot(page, "errore-sintesi.png");
});

test("offline", async ({ page, context }) => {
  await open(page);
  await context.setOffline(true);
  await expect(page.getByTestId("avviso-offline")).toContainText(
    "Sei offline: vedi le notifiche arrivate fino alle",
  );
  await freeze(page);
  await shoot(page, "offline.png");
});

test("«Fatto» con toast", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Fatto" }).click();
  const toast = page.getByRole("status").filter({ hasText: "Fatto:" });
  await expect(toast).toBeVisible();
  await expect(toast.getByRole("button", { name: "Annulla" })).toBeVisible();
  await freeze(page);
  await shoot(page, "fatto-toast.png");
});

test("«Fatto», ma il da fare non c'è più", async ({ page }) => {
  await open(page, { todo: "gone" });
  await page.getByRole("button", { name: "Fatto" }).click();
  await expect(page.getByText("Questa cosa da fare non c'è più")).toBeVisible();
  await freeze(page);
  await shoot(page, "fatto-sparito.png");
});

test("«Segna tutte come lette» (desktop)", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop",
    "su mobile il bottone non c'è: le notifiche si segnano all'apertura",
  );
  await open(page);
  const button = page.getByRole("button", { name: "Segna tutte come lette" });
  await expect(button).toBeEnabled();
  await button.click();
  await expect(button).toHaveAttribute("aria-disabled", "true");
  await expect(
    page.getByText("Tutte le notifiche sono segnate come lette."),
  ).toBeAttached();
  await expect(page.locator(".sezione__info")).toHaveCount(0);
  await freeze(page);
  await shoot(page, "segna-tutte.png");
});

test("«Segna tutte come lette» non riuscito (desktop)", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "solo desktop");
  const fake = await open(page);
  fake.failMarking();
  await page.getByRole("button", { name: "Segna tutte come lette" }).click();
  await expect(
    page.getByText("Non siamo riusciti a segnare le notifiche come lette"),
  ).toBeVisible();
  await expect(page.locator(".sezione__info").first()).toBeVisible();
  await freeze(page);
  await shoot(page, "segna-tutte-errore.png");
});
