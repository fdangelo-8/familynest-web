import { expect, test, type Page } from "@playwright/test";
import { hasTestUser, signInAs } from "../fixtures/visual-login";
import {
  throwawayConfigured,
  throwawaySkipReason,
  type ThrowawayUser,
} from "../fixtures/throwaway-user";
import {
  FIXED_NOW,
  baseURL,
  openLeaveDialog,
  openSettings,
  settle,
  userWithNest,
} from "../fixtures/impostazioni";

// PR #232 (#41): references of «Impostazioni della casa» (/impostazioni) at
// 390 and 1280 px. States: administrator (case C, nobody else has an
// account), only administrator with another adult with an account (case B,
// button off), not an administrator, confirmation dialog (cases A and C),
// only-you Nest, a 60-character name, switch saving and not saved, leaving
// in progress and not done, loading.
// The whole-page error and the server errors cannot be provoked from the
// browser (the database read and the actions run on the server): checked by
// hand, no reference.

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW);
});

type Key = "A" | "B" | "C";
async function signIn(page: Page, key: Key | "B2") {
  const ok = await signInAs(page.context(), baseURL(), key as Key);
  test.skip(!ok, `Utente di prova ${key} non disponibile`);
}

async function shoot(page: Page, name: string, fullPage = true) {
  await page.mouse.move(0, 0);
  await expect(page).toHaveScreenshot(name, { fullPage });
}

test.describe("utenti del seed", () => {
  test("#41: amministratore (Marco), nessun altro adulto con account", async ({
    page,
  }) => {
    test.skip(!hasTestUser("A"), "Utente A non configurato");
    await signIn(page, "A");
    await openSettings(page, "Casa D'Angelo");
    await expect(page.getByText("Invito in attesa")).toBeVisible();
    await settle(page);
    await shoot(page, "impostazioni-amministratore.png");
  });

  test("#41: dialogo di uscita, ultimo adulto (Marco)", async ({ page }) => {
    test.skip(!hasTestUser("A"), "Utente A non configurato");
    await signIn(page, "A");
    await openSettings(page, "Casa D'Angelo");
    const dialog = await openLeaveDialog(page, "Casa D'Angelo");
    await expect(
      dialog.getByRole("button", { name: "Esci e cancella la casa" }),
    ).toBeVisible();
    await shoot(page, "impostazioni-dialogo-ultimo-adulto.png", false);
  });

  test("#41: unico amministratore con un altro adulto (Giulia), bottone spento", async ({
    page,
  }) => {
    test.skip(!hasTestUser("B"), "Utente B non configurato");
    await signIn(page, "B");
    await openSettings(page, "Casa Bianchi");
    await expect(page.getByText("Invito scaduto")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Esci da Casa Bianchi" }),
    ).toBeDisabled();
    await expect(
      page.getByText("Sei l'unica persona che gestisce"),
    ).toBeVisible();
    await settle(page);
    await shoot(page, "impostazioni-caso-b.png");
  });

  test("#41: non amministratore (Paolo)", async ({ page }) => {
    test.skip(!hasTestUser("B2" as Key), "Utente B2 non configurato");
    await signIn(page, "B2");
    await openSettings(page, "Casa Bianchi");
    await expect(page.getByText("Invito scaduto")).toHaveCount(0);
    await settle(page);
    await shoot(page, "impostazioni-non-amministratore.png");
  });

  test("#41: dialogo di uscita (Paolo)", async ({ page }) => {
    test.skip(!hasTestUser("B2" as Key), "Utente B2 non configurato");
    await signIn(page, "B2");
    await openSettings(page, "Casa Bianchi");
    const dialog = await openLeaveDialog(page, "Casa Bianchi");
    await expect(
      dialog.getByRole("button", { name: "Esci dalla casa" }),
    ).toBeVisible();
    await shoot(page, "impostazioni-dialogo.png", false);
  });
});

test.describe("con un utente usa e getta", () => {
  test.skip(!throwawayConfigured(), throwawaySkipReason);

  let user: ThrowawayUser | null = null;
  test.afterEach(async () => {
    await user?.remove();
    user = null;
  });

  test("#41: solo tu (Nest «Solo io»)", async ({ page }) => {
    user = await userWithNest(page);
    await openSettings(page, "Casa De Santis");
    await expect(
      page.getByRole("listitem").filter({ hasText: ", tu" }),
    ).toHaveCount(1);
    await settle(page);
    await shoot(page, "impostazioni-solo-tu.png");
  });

  test("#41: nome del Nest di 60 caratteri", async ({ page }) => {
    const name = "Casa della famiglia De Santis in via dei Tigli numero 12 bis";
    expect(name).toHaveLength(60);
    user = await userWithNest(page, { name });
    await openSettings(page, name);
    await settle(page);
    await shoot(page, "impostazioni-nome-lungo.png");
  });

  test("#41: interruttore in salvataggio", async ({ page }) => {
    user = await userWithNest(page);
    await openSettings(page, "Casa De Santis");
    await settle(page);
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route("**/impostazioni", async (route) => {
      if (route.request().method() === "POST") await gate;
      await route.continue();
    });
    const toggle = page.getByRole("switch", { name: "Liberi insieme" });
    const row = toggle.locator("xpath=ancestor::li");
    await expect(async () => {
      if ((await row.getAttribute("aria-busy")) !== "true") {
        await toggle.click();
      }
      await expect(row).toHaveAttribute("aria-busy", "true", {
        timeout: 2000,
      });
    }).toPass({ timeout: 30_000 });
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await shoot(page, "impostazioni-interruttore-in-salvataggio.png");
    release();
    await expect(row).not.toHaveAttribute("aria-busy", "true");
  });

  test("#41: interruttore non salvato (rete)", async ({ page }) => {
    user = await userWithNest(page);
    await openSettings(page, "Casa De Santis");
    await settle(page);
    await page.route("**/impostazioni", async (route) => {
      if (route.request().method() === "POST") await route.abort();
      else await route.continue();
    });
    const toggle = page.getByRole("switch", { name: "Spesa" });
    const alert = page.locator("main").getByRole("alert");
    await expect(async () => {
      if (!(await alert.isVisible())) await toggle.click();
      await expect(alert).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 30_000 });
    await expect(alert).toContainText(
      "Non siamo riusciti a cambiare la notifica «Spesa». Controlla la connessione e riprova.",
    );
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await shoot(page, "impostazioni-interruttore-rete.png");
  });

  test("#41: dialogo di uscita, solo tu", async ({ page }) => {
    user = await userWithNest(page);
    await openSettings(page, "Casa De Santis");
    await openLeaveDialog(page, "Casa De Santis");
    await shoot(page, "impostazioni-dialogo-solo-tu.png", false);
  });

  test("#41: uscita in corso", async ({ page }) => {
    user = await userWithNest(page);
    await openSettings(page, "Casa De Santis");
    const dialog = await openLeaveDialog(page, "Casa De Santis");
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route("**/impostazioni", async (route) => {
      if (route.request().method() === "POST") await gate;
      await route.continue();
    });
    const confirm = dialog.getByRole("button", {
      name: "Esci e cancella la casa",
    });
    await confirm.click();
    await expect(confirm).toHaveAttribute("aria-busy", "true");
    await shoot(page, "impostazioni-uscita-in-corso.png", false);
    release();
    await expect(page).toHaveURL(/\/onboarding/);
  });

  test("#41: uscita non riuscita (rete)", async ({ page }) => {
    user = await userWithNest(page);
    await openSettings(page, "Casa De Santis");
    const dialog = await openLeaveDialog(page, "Casa De Santis");
    await page.route("**/impostazioni", async (route) => {
      if (route.request().method() === "POST") await route.abort();
      else await route.continue();
    });
    await dialog
      .getByRole("button", { name: "Esci e cancella la casa" })
      .click();
    await expect(
      dialog.getByText("Non siamo riusciti a farti uscire dalla casa."),
    ).toBeVisible();
    await shoot(page, "impostazioni-uscita-rete.png", false);
  });

  test("#41: caricamento", async ({ page }) => {
    user = await userWithNest(page);
    await page.goto("/nest");
    await expect(
      page.getByRole("heading", { level: 1, name: "Casa De Santis" }),
    ).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route(/\/impostazioni\?_rsc=/, async (route) => {
      // Hold only the real navigation, not the prefetch of the loading shell:
      // without the shell the loading state is never shown.
      if (route.request().headers()["next-router-prefetch"]) {
        await route.continue();
        return;
      }
      await gate;
      await route.continue();
    });
    await page.getByRole("link", { name: /Impostazioni della casa/ }).click();
    await expect(page.getByText("Caricamento in corso")).toBeAttached();
    await shoot(page, "impostazioni-caricamento.png", false);
    release();
    await expect(page).toHaveURL(/\/impostazioni$/);
    await expect(page.getByRole("switch")).toHaveCount(5);
  });
});
