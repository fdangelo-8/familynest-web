import { expect, test, type Page } from "@playwright/test";
import {
  ALL_TAKEN_LIST,
  FEW_LIST,
  LONG_LIST,
  NORMAL_LIST,
  installSpesaFake,
  type FakeOptions,
} from "../fixtures/spesa-fake";
import { hasTestUser, signInAs } from "../fixtures/visual-login";

// Casa · Spesa (#21): one screenshot per state, at 390 and 1280 px (projects).
// The list is served by a fake of the shopping-list endpoints (see
// fixtures/spesa-fake.ts): nothing is written to the database, and the shots
// do not depend on what other suites do in the same Nest. Sign-in, the Nest
// and its members (Marco, Laura, Biscotto) are real: test user A is needed.
// The references are generated in the CI container (workflow visual-baseline).

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

const NOW = new Date("2026-10-20T15:00:00+02:00");

test.beforeEach(async ({ context, baseURL }) => {
  test.skip(!hasTestUser("A"), "TEST_USER_A_* non impostati");
  const signedIn = await signInAs(context, baseURL!, "A");
  test.skip(!signedIn, "utente di test A non ancora creato (#55)");
});

async function open(page: Page, options: FakeOptions, ready = true) {
  await page.clock.install({ time: NOW });
  const fake = await installSpesaFake(page, options);
  await page.goto("/casa/spesa");
  if (ready) {
    await expect(page.getByRole("region", { name: "Spesa" })).toBeVisible({
      timeout: 20_000,
    });
  }
  await page.evaluate(() => document.fonts.ready);
  return fake;
}

/** Stops the page clock: timers (rows settling, toast) wait for runFor. */
async function freeze(page: Page) {
  await page.clock.pauseAt(new Date(NOW.getTime() + 60_000));
}

/**
 * The window as tall as the page, like the frames of the mockup: the sticky bar
 * and navigation then sit at the top and at the bottom of the whole page
 * (a full-page shot of a shorter window would put the navigation over the content).
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

test("normale", async ({ page }) => {
  await open(page, { items: NORMAL_LIST });
  await expect(page.getByTestId("spesa-riga")).toHaveCount(7);
  await shoot(page, "normale.png");
});

test("vuoto", async ({ page }) => {
  await open(page, { items: [] });
  await expect(page.getByText("Una lista per tutta la casa")).toBeVisible();
  await shoot(page, "vuoto.png");
});

test("tutto preso", async ({ page }) => {
  await open(page, { items: ALL_TAKEN_LIST });
  await expect(page.getByText("Tutto preso")).toBeVisible();
  await shoot(page, "tutto-preso.png");
});

test("le più comuni con poche cose", async ({ page }) => {
  await open(page, { items: FEW_LIST });
  await expect(
    page.getByRole("group", { name: "Le più comuni" }),
  ).toBeVisible();
  await shoot(page, "poche-cose.png");
});

test("nomi lunghi", async ({ page }) => {
  await open(page, { items: LONG_LIST });
  await expect(page.getByTestId("spesa-riga")).toHaveCount(4);
  await shoot(page, "nomi-lunghi.png");
});

test("caricamento", async ({ page }) => {
  await open(page, { items: NORMAL_LIST, reads: "slow" }, false);
  // The page's own loading state (the route frame shows a similar one first).
  await expect(
    page.locator('[aria-busy="true"][aria-live="polite"]'),
  ).toContainText("Caricamento in corso");
  await shoot(page, "caricamento.png");
});

test("errore di lettura", async ({ page }) => {
  await open(page, { reads: "error" }, false);
  await expect(
    page.getByRole("heading", { name: "Questa pagina non si è caricata" }),
  ).toBeVisible();
  await shoot(page, "errore-pagina.png");
});

test("offline", async ({ page, context }) => {
  await open(page, { items: NORMAL_LIST });
  await context.setOffline(true);
  await page.getByRole("checkbox", { name: "Preso: Pane" }).click();
  await expect(page.locator(".avviso--errore")).toContainText("Sei offline");
  await page.clock.runFor(700);
  await expect(
    page.getByRole("checkbox", { name: "Rimetti in lista: Pane" }),
  ).toBeVisible();
  await shoot(page, "offline.png");
});

test("toast dello strappo", async ({ page }) => {
  await open(page, { items: NORMAL_LIST });
  await freeze(page);
  await page
    .getByRole("button", { name: /Togli dalla lista le 3 cose/ })
    .click();
  const toast = page
    .getByRole("status")
    .filter({ hasText: "tolte dalla lista" });
  await expect(toast).toBeVisible();
  await expect(toast.getByRole("button", { name: "Annulla" })).toBeVisible();
  await shoot(page, "toast-strappo.png");
});

test("toast del doppione", async ({ page }) => {
  await open(page, { items: NORMAL_LIST });
  await freeze(page);
  const field = page.getByRole("textbox", { name: "Aggiungi alla spesa…" });
  await field.fill("latte");
  await field.press("Enter");
  const toast = page.getByRole("status").filter({ hasText: "già in lista" });
  await expect(toast).toBeVisible();
  await shoot(page, "toast-doppione.png");
});

test("toast di modifica rifiutata", async ({ page }) => {
  const fake = await open(page, { items: NORMAL_LIST });
  await freeze(page);
  fake.refuseWrites();
  await page.getByRole("checkbox", { name: "Preso: Latte" }).click();
  const toast = page
    .getByRole("status")
    .filter({ hasText: "Non siamo riusciti a salvare la modifica" });
  await expect(toast).toBeVisible();
  // The row is back in "Da prendere" once its short wait is over.
  await page.clock.runFor(700);
  await expect(
    page.getByRole("checkbox", { name: "Preso: Latte" }),
  ).toBeVisible();
  await shoot(page, "toast-rifiutato.png");
});

test("lama trascinata", async ({ page }) => {
  await open(page, { items: NORMAL_LIST });
  const blade = page.getByRole("button", {
    name: /Togli dalla lista le 3 cose/,
  });
  await fit(page);
  const strip = page.getByTestId("spesa-strappo");
  const box = (await blade.boundingBox())!;
  const stripBox = (await strip.boundingBox())!;
  const travel = stripBox.width - box.width - 2 * 4;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + travel * 0.5, y, { steps: 8 });
  await expect(strip).toHaveClass(/is-trascinato/);
  await page.evaluate(() => window.scrollTo(0, 0));
  // The pointer stays on the blade: that is the dragged state.
  await expect(page).toHaveScreenshot("lama-trascinata.png");
  await page.mouse.up();
});
