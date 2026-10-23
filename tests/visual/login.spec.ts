import { expect, test, type Page } from "@playwright/test";

// Public screens of the sign-in (#11): one screenshot per state, at 390 and
// 1280 px (the two projects). Clock fixed, motion reduced so the stickers are
// already in place, the seconds countdown of "Controlla la posta" frozen.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const MAIL = "marco.dangelo@example.com";
const START = new Date("2026-10-23T10:00:00+02:00");

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  // Take the pointer and the focus ring out of the picture.
  await page.mouse.move(0, 0);
}

test.describe("accesso e pagine pubbliche", () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: START });
  });

  test("accesso: stato normale", async ({ page }) => {
    await page.goto("/accesso");
    await expect(page.locator("h1:visible")).toHaveCount(1);
    await expect(
      page.getByRole("button", { name: "Continua con Google" }).first(),
    ).toBeVisible();
    await settle(page);
    await expect(page).toHaveScreenshot("accesso.png", { fullPage: true });
  });

  test("accesso: errore del fornitore", async ({ page }) => {
    await page.goto("/accesso?errore=google");
    await expect(page.locator(".avviso--errore:visible")).toContainText(
      "Accesso con Google non riuscito. Controlla la connessione e riprova.",
    );
    // On arrival the alert takes the focus (spec): wait for it, so the ring is
    // always in the picture.
    await expect(page.locator(".avviso--errore:visible")).toBeFocused();
    await settle(page);
    await expect(page).toHaveScreenshot("accesso-errore.png", {
      fullPage: true,
    });
  });

  test("accesso con la mail: inserimento", async ({ page }) => {
    await page.goto("/accesso/mail");
    await expect(page.locator("h1:visible")).toHaveText("Qual è la tua mail?");
    await settle(page);
    await expect(page).toHaveScreenshot("mail-inserimento.png", {
      fullPage: true,
    });
  });

  test("accesso con la mail: controlla la posta", async ({ page }) => {
    test.skip(!supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL non impostato");
    await page.route("**/auth/v1/otp**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "{}",
      }),
    );
    await page.goto("/accesso/mail");
    const heading = page.getByRole("heading", {
      level: 1,
      name: "Controlla la posta",
    });
    // The page may not be hydrated yet: retry the submit until it goes through.
    await expect(async () => {
      await page
        .getByLabel("La tua mail")
        .filter({ visible: true })
        .fill(MAIL, { timeout: 2000 });
      await page
        .getByRole("button", { name: "Mandami il link" })
        .filter({ visible: true })
        .click({ timeout: 2000, noWaitAfter: true });
      await expect(heading).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 15_000 });
    // Freeze the countdown: from here on the clock only moves when told to.
    await page.clock.pauseAt(new Date(START.getTime() + 2000));
    await expect(
      page.locator("main").getByText(MAIL).filter({ visible: true }),
    ).toBeVisible();
    await settle(page);
    await expect(page).toHaveScreenshot("mail-controlla-la-posta.png", {
      fullPage: true,
    });
  });

  test("link scaduto", async ({ page }) => {
    await page.goto("/accesso/link-scaduto");
    await expect(page.locator("h1:visible")).toHaveCount(1);
    await settle(page);
    await expect(page).toHaveScreenshot("link-scaduto.png", { fullPage: true });
  });

  test("termini d'uso", async ({ page }) => {
    await page.goto("/termini");
    await expect(
      page.getByRole("heading", { level: 1, name: "Termini d'uso" }),
    ).toBeVisible();
    await settle(page);
    await expect(page).toHaveScreenshot("termini.png", { fullPage: true });
  });

  test("informativa sulla privacy", async ({ page }) => {
    await page.goto("/privacy");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Informativa sulla privacy",
      }),
    ).toBeVisible();
    await settle(page);
    await expect(page).toHaveScreenshot("privacy.png", { fullPage: true });
  });
});
