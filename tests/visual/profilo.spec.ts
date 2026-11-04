import { expect, test, type Page } from "@playwright/test";
import { waitForAnimationsToEnd } from "../fixtures/animations";
import { hasTestUser, signInAs } from "../fixtures/visual-login";
import {
  throwawayConfigured,
  throwawaySkipReason,
} from "../fixtures/throwaway-user";
import {
  FIXED_NOW,
  baseURL,
  failWrites,
  fakeDeletion,
  openProfile,
  shoot,
  throwawayWithNest,
} from "../fixtures/profilo-visuale";

// PR #235 (#38): references of «Il tuo profilo» (/profilo) at 390 and 1280 px,
// for every state of the specification (v2 and v2.1): normal, loading, the three
// choice sheets, the saved choices, the errors of colour / preference / file,
// the «I tuoi dati» wait and toast, the «Esci» and «Elimina l'account» dialogs
// (all three texts, errors, FN003) and the notice on /accesso.
// The whole-page error cannot be provoked from the browser (the database reads
// happen on the server): checked by hand, no reference.

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
  acceptDownloads: true,
});

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW);
});

type Key = "A" | "B" | "B2";
async function signIn(page: Page, key: Key) {
  const ok =
    hasTestUser(key as "A") &&
    (await signInAs(page.context(), baseURL(), key as "A"));
  test.skip(!ok, `Utente di prova ${key} non disponibile`);
}

/** The first colour that is not chosen and not taken by someone else. */
const freeColor = (page: Page) =>
  page.locator('[role="radio"][aria-checked="false"]:not([disabled])').first();

const dialog = (page: Page) => page.getByRole("alertdialog");

/** Opens a row sheet by the name of its row and waits for the end of the slide. */
async function openSheet(page: Page, row: RegExp, title: string) {
  await page.getByRole("button", { name: row }).click();
  await expect(page.getByRole("dialog", { name: title })).toBeVisible();
  await waitForAnimationsToEnd(page);
}

test.describe("utenti del seed", () => {
  test("#38: normale (Marco)", async ({ page }) => {
    await signIn(page, "A");
    await openProfile(page, "Marco D'Angelo");
    await expect(page.getByText("Nessuno collegato")).toBeVisible();
    await shoot(page, "profilo-normale.png");
  });

  test("#38: caricamento (scheletro)", async ({ page }) => {
    await signIn(page, "A");
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    // Only the real navigation is held; the prefetch of the link goes on.
    await page.route(/\/profilo(\?|$)/, async (route) => {
      if (!route.request().headers()["next-router-prefetch"]) await gate;
      await route.continue();
    });
    const prefetched = page.waitForResponse(
      (r) =>
        /\/profilo(\?|$)/.test(r.url()) &&
        !!r.request().headers()["next-router-prefetch"],
    );
    await page.goto("/nest");
    await expect(page.getByRole("link", { name: /, tu/ })).toBeVisible();
    await page.waitForLoadState("load");
    await prefetched;
    await page.getByRole("link", { name: /, tu/ }).click();
    await expect(page.getByText("Caricamento in corso")).toBeAttached();
    await page.evaluate(() => document.fonts.ready);
    await shoot(page, "profilo-caricamento.png");
    release();
    await expect(
      page.getByRole("heading", { level: 1, name: "Marco D'Angelo" }),
    ).toBeVisible();
  });

  test("#38: foglio «All'apertura»", async ({ page }) => {
    await signIn(page, "A");
    await openProfile(page, "Marco D'Angelo");
    await openSheet(page, /^All'apertura/, "All'apertura");
    await shoot(page, "profilo-foglio-apertura.png", false);
  });

  test("#38: foglio «Sintesi del mattino»", async ({ page }) => {
    await signIn(page, "A");
    await openProfile(page, "Marco D'Angelo");
    await openSheet(page, /^Sintesi del mattino/, "Sintesi del mattino");
    await shoot(page, "profilo-foglio-sintesi.png", false);
  });

  test("#38: foglio «Visibilità predefinita»", async ({ page }) => {
    await signIn(page, "A");
    await openProfile(page, "Marco D'Angelo");
    await openSheet(page, /^Visibilità predefinita/, "Visibilità predefinita");
    await shoot(page, "profilo-foglio-visibilita.png", false);
  });

  test("#38: dialogo «Esci»", async ({ page }) => {
    await signIn(page, "A");
    await openProfile(page, "Marco D'Angelo");
    await page.getByRole("button", { name: "Esci", exact: true }).click();
    await expect(dialog(page)).toContainText("Uscire da FamilyNest?");
    await waitForAnimationsToEnd(page);
    await shoot(page, "profilo-dialogo-esci.png", false);
  });

  test("#38: dialogo «Esci», non riuscito", async ({ page }) => {
    await signIn(page, "A");
    await openProfile(page, "Marco D'Angelo");
    await page.route("**/auth/signout", (route) => route.abort("failed"));
    await page.getByRole("button", { name: "Esci", exact: true }).click();
    await dialog(page).getByRole("button", { name: "Esci" }).click();
    await expect(dialog(page)).toContainText(
      "Non siamo riusciti a farti uscire. Controlla la connessione e riprova.",
    );
    await shoot(page, "profilo-dialogo-esci-errore.png", false);
  });

  test("#38: dialogo «Elimina l'account», ultimo adulto (Marco)", async ({
    page,
  }) => {
    await signIn(page, "A");
    await openProfile(page, "Marco D'Angelo");
    await page.getByRole("button", { name: "Elimina l'account" }).click();
    await expect(dialog(page)).toContainText(
      "Perderai impegni, liste e impostazioni. Non si può annullare.",
    );
    await expect(
      dialog(page).getByRole("button", { name: "Esci e cancella la casa" }),
    ).toBeVisible();
    await waitForAnimationsToEnd(page);
    await shoot(page, "profilo-dialogo-elimina-ultimo.png", false);
  });

  test("#38: dialogo «Elimina l'account», resta un altro adulto, nuovo amministratore (Giulia)", async ({
    page,
  }) => {
    await signIn(page, "B");
    await openProfile(page);
    await page.getByRole("button", { name: "Elimina l'account" }).click();
    await expect(dialog(page)).toContainText("resterà a");
    await expect(dialog(page)).toContainText("da ora la gestirà");
    await waitForAnimationsToEnd(page);
    await shoot(page, "profilo-dialogo-elimina-resta-admin.png", false);
  });

  test("#38: dialogo «Elimina l'account», resta un altro adulto (Paolo)", async ({
    page,
  }) => {
    await signIn(page, "B2");
    await openProfile(page);
    await page.getByRole("button", { name: "Elimina l'account" }).click();
    await expect(dialog(page)).toContainText("resterà a");
    await expect(dialog(page)).not.toContainText("da ora la gestirà");
    await waitForAnimationsToEnd(page);
    await shoot(page, "profilo-dialogo-elimina-resta.png", false);
  });

  test("#38: dialogo «Elimina l'account», errore del server", async ({
    page,
  }) => {
    await signIn(page, "A");
    await openProfile(page, "Marco D'Angelo");
    await fakeDeletion(page, "server");
    await page.getByRole("button", { name: "Elimina l'account" }).click();
    await dialog(page)
      .getByRole("button", { name: "Esci e cancella la casa" })
      .click();
    await expect(dialog(page)).toContainText(
      "Non siamo riusciti a eliminare l'account per un problema nostro. Non è cambiato niente: riprova tra qualche minuto.",
    );
    await shoot(page, "profilo-dialogo-elimina-errore-server.png", false);
  });

  test("#38: dialogo «Elimina l'account», errore di rete", async ({ page }) => {
    await signIn(page, "A");
    await openProfile(page, "Marco D'Angelo");
    await fakeDeletion(page, "network");
    await page.getByRole("button", { name: "Elimina l'account" }).click();
    await dialog(page)
      .getByRole("button", { name: "Esci e cancella la casa" })
      .click();
    await expect(dialog(page)).toContainText(
      "Non siamo riusciti a eliminare l'account. Controlla la connessione e riprova.",
    );
    await shoot(page, "profilo-dialogo-elimina-errore-rete.png", false);
  });

  test("#38: FN003, il dialogo si riapre con il testo nuovo (Giulia)", async ({
    page,
  }) => {
    await signIn(page, "B");
    await openProfile(page);
    // While the dialog is open the others left: Giulia is now the last adult.
    await fakeDeletion(page, {
      outlook: {
        isLastAdultWithAccount: true,
        remainingNames: [],
        newAdministratorName: null,
      },
    });
    await page.getByRole("button", { name: "Elimina l'account" }).click();
    await dialog(page)
      .getByRole("button", { name: "Elimina l'account" })
      .click();
    await expect(
      dialog(page).getByRole("button", { name: "Esci e cancella la casa" }),
    ).toBeVisible();
    await expect(dialog(page)).toContainText(
      "Perderai impegni, liste e impostazioni. Non si può annullare.",
    );
    await expect(
      dialog(page).getByRole("button", { name: "Annulla" }),
    ).toBeFocused();
    await waitForAnimationsToEnd(page);
    await shoot(page, "profilo-dialogo-elimina-fn003.png", false);
  });

  test("#38: colore, salvataggio non riuscito (rete)", async ({ page }) => {
    await signIn(page, "A");
    await openProfile(page, "Marco D'Angelo");
    await failWrites(page, "household_members", "network");
    await freeColor(page).click();
    await expect(page.getByRole("alert")).toContainText(
      "Non siamo riusciti a cambiare il colore. Controlla la connessione e riprova.",
    );
    await shoot(page, "profilo-colore-errore-rete.png");
  });

  test("#38: colore, salvataggio non riuscito (server)", async ({ page }) => {
    await signIn(page, "A");
    await openProfile(page, "Marco D'Angelo");
    await failWrites(page, "household_members", "server");
    await freeColor(page).click();
    await expect(page.getByRole("alert")).toContainText(
      "Non siamo riusciti a cambiare il colore per un problema nostro. Riprova tra qualche minuto.",
    );
    await shoot(page, "profilo-colore-errore-server.png");
  });

  test("#38: colore preso nel frattempo", async ({ page }) => {
    await signIn(page, "A");
    await openProfile(page, "Marco D'Angelo");
    await failWrites(page, "household_members", "taken");
    await freeColor(page).click();
    await expect(page.getByRole("alert")).toContainText(
      "Questo colore l'ha appena preso qualcun altro: scegline un altro.",
    );
    await shoot(page, "profilo-colore-preso.png");
  });

  test("#38: preferenza, salvataggio non riuscito (rete)", async ({ page }) => {
    await signIn(page, "A");
    await openProfile(page, "Marco D'Angelo");
    await failWrites(page, "profiles", "network");
    await openSheet(page, /^All'apertura/, "All'apertura");
    await page.getByRole("radio", { name: /^Nest/ }).click();
    await expect(page.getByRole("alert")).toContainText(
      "Non siamo riusciti a salvare la scelta. Controlla la connessione e riprova.",
    );
    await shoot(page, "profilo-preferenza-errore-rete.png");
  });

  test("#38: preferenza, salvataggio non riuscito (server)", async ({
    page,
  }) => {
    await signIn(page, "A");
    await openProfile(page, "Marco D'Angelo");
    await failWrites(page, "profiles", "server");
    await openSheet(page, /^Visibilità predefinita/, "Visibilità predefinita");
    await page.getByRole("radio", { name: /^Tutto il Nest/ }).click();
    await expect(page.getByRole("alert")).toContainText(
      "Non siamo riusciti a salvare la scelta per un problema nostro. Riprova tra qualche minuto.",
    );
    await shoot(page, "profilo-preferenza-errore-server.png");
  });

  test("#38: «I tuoi dati» in preparazione", async ({ page }) => {
    await signIn(page, "A");
    await openProfile(page, "Marco D'Angelo");
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route("**/profilo/dati", async (route) => {
      await gate;
      await route.fulfill({ status: 500, json: { ok: false } });
    });
    const row = page.getByRole("button", { name: /^I tuoi dati/ });
    await row.click();
    await expect(row).toHaveAttribute("aria-busy", "true");
    await shoot(page, "profilo-dati-in-preparazione.png");
    release();
    await expect(page.getByRole("alert")).toBeVisible();
  });

  test("#38: «I tuoi dati», non riusciti (server)", async ({ page }) => {
    await signIn(page, "A");
    await openProfile(page, "Marco D'Angelo");
    await page.route("**/profilo/dati", (route) =>
      route.fulfill({ status: 500, json: { ok: false } }),
    );
    await page.getByRole("button", { name: /^I tuoi dati/ }).click();
    await expect(page.getByRole("alert")).toContainText(
      "Non siamo riusciti a preparare i tuoi dati per un problema nostro. Riprova tra qualche minuto.",
    );
    await shoot(page, "profilo-dati-errore-server.png");
  });

  test("#38: «I tuoi dati», non riusciti (rete)", async ({ page }) => {
    await signIn(page, "A");
    await openProfile(page, "Marco D'Angelo");
    await page.route("**/profilo/dati", (route) => route.abort("failed"));
    await page.getByRole("button", { name: /^I tuoi dati/ }).click();
    await expect(page.getByRole("alert")).toContainText(
      "Non siamo riusciti a preparare i tuoi dati. Controlla la connessione e riprova.",
    );
    await shoot(page, "profilo-dati-errore-rete.png");
  });

  test("#38: «I tuoi dati» scaricati (toast)", async ({ page }) => {
    await signIn(page, "A");
    await openProfile(page, "Marco D'Angelo");
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: /^I tuoi dati/ }).click();
    expect((await download).suggestedFilename()).toBe(
      "familynest-i-tuoi-dati-2026-11-04.json",
    );
    await expect(page.getByRole("status")).toContainText(
      "Dati scaricati: trovi il file tra i download.",
    );
    await waitForAnimationsToEnd(page);
    await shoot(page, "profilo-dati-scaricati.png", false);
  });
});

test.describe("utenti usa e getta", () => {
  test.beforeEach(() => {
    test.skip(!throwawayConfigured(), throwawaySkipReason);
  });

  test("#38: scelte salvate (colore, apertura, sintesi, visibilità)", async ({
    page,
  }) => {
    const user = await throwawayWithNest(page);
    try {
      await openProfile(page, "Ilaria De Santis");
      await freeColor(page).click();
      await openSheet(page, /^All'apertura/, "All'apertura");
      await page.getByRole("radio", { name: /^Nest/ }).click();
      await openSheet(page, /^Sintesi del mattino/, "Sintesi del mattino");
      await page.getByRole("button", { name: "8:30" }).click();
      await openSheet(
        page,
        /^Visibilità predefinita/,
        "Visibilità predefinita",
      );
      await page.getByRole("radio", { name: /^Tutto il Nest/ }).click();
      await expect(
        page.getByRole("button", {
          name: /^Visibilità predefinita.*Tutto il Nest/,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /^Sintesi del mattino.*8:30/ }),
      ).toBeVisible();
      await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
      await shoot(page, "profilo-scelte-salvate.png");
    } finally {
      await user.remove();
    }
  });

  test("#38: foglio «Sintesi del mattino», scelta 8:30", async ({ page }) => {
    const user = await throwawayWithNest(page);
    try {
      await openProfile(page, "Ilaria De Santis");
      await openSheet(page, /^Sintesi del mattino/, "Sintesi del mattino");
      await page.getByRole("button", { name: "8:30" }).focus();
      await page.mouse.move(0, 0);
      await shoot(page, "profilo-foglio-sintesi-focus.png", false);
    } finally {
      await user.remove();
    }
  });

  test("#38: nome e mail lunghi", async ({ page }) => {
    const user = await throwawayWithNest(page, "A".repeat(100));
    try {
      await openProfile(page);
      // The mail cannot be 254 characters long in the seed: written in the page.
      await page.evaluate(() => {
        const p = document.querySelector("p.intestazione__sotto");
        if (p) {
          p.textContent = `${"lunga".repeat(48)}@${"esempio".repeat(1)}.test · Adulto in Casa De Santis`;
        }
      });
      await page.mouse.move(0, 0);
      await expect(page).toHaveScreenshot("profilo-testi-lunghi.png", {
        fullPage: true,
      });
      // Nothing leaves the column: no horizontal scroll.
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      );
      expect(overflow).toBe(false);
    } finally {
      await user.remove();
    }
  });
});

test.describe("accesso dopo l'eliminazione", () => {
  test("#38: avviso su /accesso?account=eliminato", async ({ page }) => {
    await page.goto("/accesso?account=eliminato");
    await expect(page.locator("h1:visible")).toHaveCount(1);
    await expect(page.getByRole("status")).toContainText(
      "Il tuo account è stato eliminato.",
    );
    await page.evaluate(() => document.fonts.ready);
    await page.mouse.move(0, 0);
    await expect(page).toHaveScreenshot("accesso-account-eliminato.png", {
      fullPage: true,
    });
  });
});
