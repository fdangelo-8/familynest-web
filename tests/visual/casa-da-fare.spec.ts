import { expect, test, type Page } from "@playwright/test";
import { NORMAL_LIST, installSpesaFake } from "../fixtures/spesa-fake";
import {
  FULL_TODOS,
  NORMAL_TODOS,
  installTodosFake,
  type TodosFakeOptions,
} from "../fixtures/todos-fake";
import { hasTestUser, signInAs } from "../fixtures/visual-login";

// Casa · Da fare (#23): one screenshot per state, at 390 and 1280 px (projects).
// The things to do and the shopping list are served by fakes of their endpoints
// (fixtures/todos-fake.ts, fixtures/spesa-fake.ts): nothing is written to the
// database and the shots do not depend on what other suites do in the same Nest.
// Sign-in, the Nest and its members (Marco, Laura, Sofia, Tommaso, Biscotto)
// are real: test user A is needed. The page clock is fixed to the mockup's
// "now" (Tuesday 20 October 2026, 15:52). The references are generated in the
// CI container (workflow visual-baseline).

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

type OpenOptions = TodosFakeOptions & {
  shopping?: "ok" | "error";
};

async function open(page: Page, options: OpenOptions, ready = true) {
  await page.clock.install({ time: NOW });
  await installSpesaFake(page, {
    items: NORMAL_LIST,
    reads: options.shopping ?? "ok",
  });
  const fake = await installTodosFake(page, options);
  await page.goto("/casa/da-fare");
  if (ready) {
    await expect(page.getByRole("region", { name: "Da fare" })).toBeVisible({
      timeout: 20_000,
    });
  }
  await page.evaluate(() => document.fonts.ready);
  return fake;
}

/** Stops the page clock: timers (row settling, toast) wait for runFor. */
async function freeze(page: Page) {
  await page.clock.pauseAt(new Date(NOW.getTime() + 60_000));
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

test("normale", async ({ page }) => {
  await open(page, { todos: NORMAL_TODOS });
  await expect(page.getByTestId("da-fare-riga")).toHaveCount(6);
  await shoot(page, "normale.png");
});

test("pieno: tutti i gruppi, senza persona, titolo lungo e scaduta", async ({
  page,
}) => {
  await open(page, { todos: FULL_TODOS });
  await expect(page.getByTestId("da-fare-riga")).toHaveCount(9);
  await shoot(page, "pieno.png");
});

test("vuoto", async ({ page }) => {
  await open(page, { todos: [] });
  await expect(page.getByText("Niente da fare, per ora")).toBeVisible();
  await shoot(page, "vuoto.png");
});

test("filtro per persona", async ({ page }) => {
  await open(page, { todos: NORMAL_TODOS });
  await page
    .getByRole("button", { name: "Laura" })
    .filter({ visible: true })
    .click();
  await expect(page.getByTestId("da-fare-riga")).toHaveCount(3);
  await shoot(page, "filtro-laura.png");
});

test("filtro senza risultati", async ({ page }) => {
  await open(page, { todos: NORMAL_TODOS });
  await page
    .getByRole("button", { name: "Tommaso" })
    .filter({ visible: true })
    .click();
  await expect(page.getByText("Niente da fare per Tommaso")).toBeVisible();
  await shoot(page, "filtro-vuoto.png");
});

test("caricamento", async ({ page }) => {
  await open(page, { todos: NORMAL_TODOS, reads: "slow" }, false);
  await expect(page.locator('[aria-busy="true"]').first()).toContainText(
    "Caricamento in corso",
  );
  await shoot(page, "caricamento.png");
});

test("errore di pagina", async ({ page }) => {
  // Both lists fail: on desktop that is the only case of a whole-page error.
  await open(page, { reads: "error", shopping: "error" }, false);
  await expect(
    page.getByRole("heading", { name: "Questa pagina non si è caricata" }),
  ).toBeVisible();
  await shoot(page, "errore-pagina.png");
});

test("errore nella colonna (desktop)", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop",
    "su mobile l'errore delle cose da fare è l'errore di pagina",
  );
  await open(page, { reads: "error" }, false);
  await expect(
    page.getByText("Non riusciamo a caricare le cose da fare"),
  ).toBeVisible();
  await shoot(page, "errore-colonna.png");
});

test("offline", async ({ page, context }) => {
  await open(page, { todos: NORMAL_TODOS });
  await context.setOffline(true);
  await page
    .getByRole("checkbox", {
      name: "Segna come fatto: Regalo per la festa di Giulia",
    })
    .click();
  await expect(page.locator(".avviso--errore")).toContainText("Sei offline");
  await shoot(page, "offline.png");
});

test("toast con Annulla", async ({ page }) => {
  await open(page, { todos: NORMAL_TODOS });
  await freeze(page);
  await page
    .getByRole("checkbox", {
      name: "Segna come fatto: Firmare autorizzazione gita",
    })
    .click();
  const toast = page.getByRole("status").filter({ hasText: "Fatto:" });
  await expect(toast).toBeVisible();
  await expect(toast.getByRole("button", { name: "Annulla" })).toBeVisible();
  await shoot(page, "toast-annulla.png");
});

test("riga spostata in Fatti", async ({ page }) => {
  await open(page, { todos: NORMAL_TODOS });
  await page
    .getByRole("checkbox", {
      name: "Segna come fatto: Firmare autorizzazione gita",
    })
    .click();
  await page.clock.runFor(5_500);
  await expect(
    page.getByRole("checkbox", {
      name: "Rimetti da fare: Firmare autorizzazione gita",
    }),
  ).toBeVisible();
  await expect(page.getByText("Fatto da Marco, oggi")).toBeVisible();
  await shoot(page, "riga-in-fatti.png");
});

test("toast di modifica rifiutata", async ({ page }) => {
  const fake = await open(page, { todos: NORMAL_TODOS });
  await freeze(page);
  fake.refuseWrites();
  await page
    .getByRole("checkbox", {
      name: "Segna come fatto: Regalo per la festa di Giulia",
    })
    .click();
  const toast = page
    .getByRole("status")
    .filter({ hasText: "Non siamo riusciti a salvare la modifica" });
  await expect(toast).toBeVisible();
  await page.clock.runFor(700);
  await expect(
    page.getByRole("checkbox", {
      name: "Segna come fatto: Regalo per la festa di Giulia",
    }),
  ).toBeVisible();
  await shoot(page, "toast-rifiutato.png");
});

test("campo rapido con il fuoco (desktop)", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop",
    "il campo rapido c'è solo da 1024 px",
  );
  await open(page, { todos: NORMAL_TODOS });
  await page
    .getByRole("textbox", { name: "Aggiungi una cosa da fare…" })
    .focus();
  await shoot(page, "campo-rapido.png");
});
