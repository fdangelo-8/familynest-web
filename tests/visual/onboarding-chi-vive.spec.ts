import { expect, test, type Page } from "@playwright/test";
import { signInAs, skipReason, usersConfigured } from "../fixtures/auth";

// Onboarding step 1 (#12): one screenshot per state, at 390 and 1280 px (the
// two projects). The user is C (Chiara, no Nest); "Continua" never reaches the
// database: the request of the server action is held, aborted or answered by
// the test, so C keeps no Nest. Skipped when the test users are not set up.

const START = new Date("2026-10-23T10:00:00+02:00");

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

test.skip(!usersConfigured("C"), skipReason("C"));

async function openAsC(page: Page, baseURL: string | undefined) {
  await page.clock.install({ time: START });
  await signInAs(page.context(), baseURL as string, "C");
  await page.goto("/onboarding");
  await expect(page.locator("h1:visible")).toHaveText("Chi vive con te?");
  // The page may not be hydrated yet: the choice must take effect.
  await expect(page.locator('[role="radiogroup"]:visible')).toBeVisible();
}

async function choose(page: Page, name: string) {
  const radio = page.getByRole("radio", { name }).filter({ visible: true });
  await expect(async () => {
    await radio.click({ timeout: 2000 });
    await expect(radio).toHaveAttribute("aria-checked", "true", {
      timeout: 1000,
    });
  }).toPass({ timeout: 15_000 });
}

async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  // Take the pointer out of the picture (no hover state).
  await page.mouse.move(0, 0);
}

const isAction = (route: {
  request(): { method(): string; headers(): Record<string, string> };
}) =>
  route.request().method() === "POST" &&
  "next-action" in route.request().headers();

test.describe("onboarding · chi vive con te", () => {
  test("nessuna scelta", async ({ page, baseURL }) => {
    await openAsC(page, baseURL);
    await expect(
      page.getByText("Scegli una risposta per continuare.").filter({
        visible: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Continua" }).filter({ visible: true }),
    ).toBeDisabled();
    await settle(page);
    await expect(page).toHaveScreenshot("nessuna-scelta.png", {
      fullPage: true,
    });
  });

  test("scelta fatta", async ({ page, baseURL }) => {
    await openAsC(page, baseURL);
    await choose(page, "In famiglia, con figli");
    await expect(
      page.getByRole("button", { name: "Continua" }).filter({ visible: true }),
    ).toBeEnabled();
    await settle(page);
    await expect(page).toHaveScreenshot("scelta-fatta.png", { fullPage: true });
  });

  test("invio in corso", async ({ page, baseURL }) => {
    await openAsC(page, baseURL);
    // The request is held until the end of the test, then dropped.
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/onboarding", async (route) => {
      if (!isAction(route)) return route.continue();
      await held;
      await route.abort();
    });
    await choose(page, "In famiglia, con figli");
    const next = page
      .getByRole("button", { name: "Continua" })
      .filter({ visible: true });
    await next.click();
    await expect(next).toHaveAttribute("aria-busy", "true");
    await settle(page);
    await expect(page).toHaveScreenshot("invio-in-corso.png", {
      fullPage: true,
    });
    release();
  });

  test("errore di rete", async ({ page, baseURL }) => {
    await openAsC(page, baseURL);
    await page.route("**/onboarding", (route) =>
      isAction(route) ? route.abort() : route.continue(),
    );
    await choose(page, "In coppia");
    await page
      .getByRole("button", { name: "Continua" })
      .filter({ visible: true })
      .click();
    const notice = page.locator('.avviso--errore[role="alert"]:visible');
    await expect(notice).toContainText(
      "Non siamo riusciti a creare il tuo Nest. Controlla la connessione e riprova.",
    );
    await expect(
      page.getByRole("button", { name: "Continua" }).filter({ visible: true }),
    ).toBeEnabled();
    await settle(page);
    await expect(page).toHaveScreenshot("errore-di-rete.png", {
      fullPage: true,
    });
  });

  test("errore del server", async ({ page, baseURL }) => {
    await openAsC(page, baseURL);
    // The answer of the server action is the one the real action gives when
    // the database refuses: {status: "error"}, in the Flight format.
    await page.route("**/onboarding", (route) =>
      isAction(route)
        ? route.fulfill({
            status: 200,
            contentType: "text/x-component",
            body: '0:{"a":"$@1","f":"","b":"x"}\n1:{"status":"error"}\n',
          })
        : route.continue(),
    );
    await choose(page, "In coppia");
    await page
      .getByRole("button", { name: "Continua" })
      .filter({ visible: true })
      .click();
    const notice = page.locator('.avviso--errore[role="alert"]:visible');
    await expect(notice).toContainText(
      "Non siamo riusciti a creare il tuo Nest per un problema nostro. Riprova tra qualche minuto.",
    );
    await expect(
      page.getByRole("button", { name: "Continua" }).filter({ visible: true }),
    ).toBeEnabled();
    await settle(page);
    await expect(page).toHaveScreenshot("errore-del-server.png", {
      fullPage: true,
    });
  });
});
