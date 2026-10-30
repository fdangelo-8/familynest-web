import { expect, test, type Page } from "@playwright/test";
import {
  LONG_DEADLINES,
  NORMAL_DEADLINES,
  OVERDUE_TODAY_PRIVATE_DEADLINES,
  installScadenzeFake,
  type FakeOptions,
} from "../fixtures/scadenze-fake";
import { NORMAL_LIST, installSpesaFake } from "../fixtures/spesa-fake";
import { NORMAL_TODOS, installTodosFake } from "../fixtures/todos-fake";
import { hasTestUser, signInAs } from "../fixtures/visual-login";

// Casa · Scadenze (#24): one screenshot per state, at 390 and 1280 px (projects).
// The deadlines are served by a fake of the endpoint (see
// fixtures/scadenze-fake.ts): nothing is written to the database, and the shots
// do not depend on what other suites do in the same Nest. Sign-in, the Nest
// and its members (Marco, Laura, Sofia, Biscotto) are real: test user A is needed.
// Clock fixed at the time of the mockup: Tuesday 20 October 2026, 15:52 (Rome).
// The references are generated in the CI container (workflow visual-baseline).

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

const NOW = new Date("2026-10-20T15:52:00+02:00");

test.beforeEach(async ({ context, baseURL }) => {
  test.skip(!hasTestUser("A"), "TEST_USER_A_* non impostati");
  const signedIn = await signInAs(context, baseURL!, "A");
  test.skip(!signedIn, "utente di test A non ancora creato (#55)");
});

async function open(page: Page, options: FakeOptions, ready = true) {
  await page.clock.install({ time: NOW });
  // Casa reads the three lists on every page: the other two are faked too.
  await installSpesaFake(page, { items: NORMAL_LIST });
  await installTodosFake(page, { todos: NORMAL_TODOS });
  const fake = await installScadenzeFake(page, options);
  await page.goto("/casa/scadenze");
  if (ready) {
    await expect(page.getByRole("region", { name: "Scadenze" })).toBeVisible({
      timeout: 20_000,
    });
  }
  await page.evaluate(() => document.fonts.ready);
  return fake;
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
  await open(page, { deadlines: NORMAL_DEADLINES });
  await expect(page.getByTestId("scadenza-riga")).toHaveCount(4);
  await shoot(page, "normale.png");
});

test("scadute, oggi e Solo io", async ({ page }) => {
  await open(page, { deadlines: OVERDUE_TODAY_PRIVATE_DEADLINES });
  await expect(page.getByTestId("scadenza-riga")).toHaveCount(8);
  await expect(page.getByTestId("lucchetto")).toHaveCount(1);
  await shoot(page, "scadute-oggi-solo-io.png");
});

test("titoli lunghi", async ({ page }) => {
  await open(page, { deadlines: LONG_DEADLINES });
  await expect(page.getByTestId("scadenza-riga")).toHaveCount(2);
  await shoot(page, "titoli-lunghi.png");
});

test("vuoto", async ({ page }) => {
  await open(page, { deadlines: [] });
  await expect(page.getByText("Nessuna scadenza")).toBeVisible();
  await shoot(page, "vuoto.png");
});

test("caricamento", async ({ page }) => {
  await open(page, { deadlines: NORMAL_DEADLINES, reads: "slow" }, false);
  await expect(
    page.locator('[aria-busy="true"][aria-live="polite"]'),
  ).toContainText("Caricamento in corso");
  await shoot(page, "caricamento.png");
});

test("errore di lettura", async ({ page }) => {
  await open(page, { reads: "error" }, false);
  // Phone: the error of the page. Desktop: the error inside the column.
  if ((page.viewportSize()?.width ?? 0) < 1024) {
    await expect(
      page.getByRole("heading", { name: "Questa pagina non si è caricata" }),
    ).toBeVisible();
  } else {
    await expect(
      page.getByText("Non riusciamo a caricare le scadenze."),
    ).toBeVisible();
  }
  await shoot(page, "errore.png");
});
