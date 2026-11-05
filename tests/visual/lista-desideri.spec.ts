import { expect, test, type Page } from "@playwright/test";
import { waitForAnimationsToEnd } from "../fixtures/animations";
import {
  throwawayConfigured,
  throwawaySkipReason,
  type ThrowawayUser,
} from "../fixtures/throwaway-user";
import {
  CHILD,
  FIXED_NOW,
  LINK_EXPIRES_AT,
  answerListReads,
  answerPublicReads,
  ideaButton,
  openPublic,
  openWishlist,
  pinLinkExpiry,
  settle,
  shoot,
  wishNest,
  type WishNest,
} from "../fixtures/lista-desideri-visuale";

// PR #279 (#32 and #33): references of the wish list of a child
// (/figli/<id>/lista-desideri) and of the public page (/desideri/<code>) at 390
// and 1280 px (and 768 px for the main states): ideas, empty, all taken, the
// block of the link in its states, the sheets of adding and editing, the
// dialogs, loading, errors, offline; public: normal, with photos, all taken,
// empty, link not active, error, loading, offline, the sheet «Lo regalo io» and
// the idea taken. Every date is counted from the pinned clock of the browser.

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW);
});

test.describe("con un utente usa e getta", () => {
  test.skip(!throwawayConfigured(), throwawaySkipReason);

  let user: ThrowawayUser | null = null;
  test.afterEach(async () => {
    await user?.remove();
    user = null;
  });

  async function parents(
    page: Page,
    options: Parameters<typeof wishNest>[1] = {},
    expiry: string | null = LINK_EXPIRES_AT,
  ): Promise<WishNest> {
    const nest = await wishNest(page, { login: true, ...options });
    user = nest.user;
    if (expiry) await pinLinkExpiry(page, expiry);
    await openWishlist(page, nest.childId);
    return nest;
  }

  async function addButton(page: Page) {
    const button = page.getByRole("button", { name: "Aggiungi un'idea" });
    await button.click();
    const dialog = page.getByRole("dialog", { name: "Aggiungi un'idea" });
    await expect(dialog).toBeVisible();
    await waitForAnimationsToEnd(page);
    return dialog;
  }

  // ---- parents' page: the list ------------------------------------------

  test("#32: lista con idee, link attivo", async ({ page }) => {
    await parents(page, { share: "attivo" });
    await expect(ideaButton(page, "Casco per la bici")).toBeVisible();
    await expect(page.getByText("Attivo fino al 15 dicembre")).toBeVisible();
    await shoot(page, "lista-normale.png");
  });

  test("#32: lista con le foto del negozio", async ({ page }) => {
    await parents(page, { ideas: "mockup-con-foto", share: "attivo" });
    await shoot(page, "lista-con-foto.png");
  });

  test("#32: lista vuota", async ({ page }) => {
    await parents(page, { ideas: "nessuna" });
    await expect(page.getByText("Ancora nessuna idea")).toBeVisible();
    await shoot(page, "lista-vuota.png");
  });

  test("#32: tutte le idee già prese", async ({ page }) => {
    await parents(page, { ideas: "tutte-prese", share: "attivo" });
    await expect(page.getByText("Nonno Piero")).toBeVisible();
    await shoot(page, "lista-tutte-prese.png");
  });

  // ---- the block of the link, in its states -----------------------------

  test("#32: blocco, mai condivisa", async ({ page }) => {
    await parents(page, { share: "mai" });
    await expect(page.getByText("Non ancora condivisa")).toBeVisible();
    await shoot(page, "blocco-mai-condivisa.png");
  });

  test("#32: blocco, link scaduto", async ({ page }) => {
    await parents(page, { share: "attivo" }, "2026-10-30T23:00:00+00:00");
    await shoot(page, "blocco-scaduto.png");
  });

  test("#32: blocco, link disattivato", async ({ page }) => {
    await parents(page, { share: "disattivato" }, null);
    await shoot(page, "blocco-disattivato.png");
  });

  test("#32: blocco, senza data di nascita", async ({ page }) => {
    await parents(page, { birth: null });
    await expect(page.getByText("Manca la data di nascita")).toBeVisible();
    await shoot(page, "blocco-senza-data.png");
  });

  test("#32: «Condividi», link copiato", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: () => Promise.resolve() },
        configurable: true,
      });
    });
    await parents(page, { share: "mai" });
    await page.getByRole("button", { name: "Condividi", exact: true }).click();
    await expect(
      page.getByText("Link copiato. Mandalo a nonni e parenti."),
    ).toBeVisible();
    await expect(page.getByText("Attivo fino al 15 dicembre")).toBeVisible();
    await waitForAnimationsToEnd(page);
    await shoot(page, "condividi-copiato.png");
  });

  test("#32: «Condividi», copia a mano", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: () => Promise.reject(new Error("no")) },
        configurable: true,
      });
    });
    await parents(page, { share: "mai" });
    await page.getByRole("button", { name: "Condividi", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Copia il link" });
    await expect(dialog).toBeVisible();
    await waitForAnimationsToEnd(page);
    await shoot(page, "condividi-copia-a-mano.png");
  });

  test("#32: «Disattiva il link», conferma", async ({ page }) => {
    await parents(page, { share: "attivo" });
    await page.getByRole("button", { name: "Disattiva il link" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await waitForAnimationsToEnd(page);
    await shoot(page, "disattiva-conferma.png");
  });

  // ---- sheets and dialogs ------------------------------------------------

  test("#32: foglio «Aggiungi un'idea»", async ({ page }) => {
    await parents(page, { share: "attivo" });
    await addButton(page);
    await shoot(page, "foglio-aggiungi.png", false);
  });

  test("#32: foglio «Aggiungi un'idea» con errore", async ({ page }) => {
    await parents(page, { share: "attivo" });
    const dialog = await addButton(page);
    await dialog.getByRole("button", { name: "Aggiungi alla lista" }).click();
    await expect(
      dialog.getByText("Incolla il link di un negozio o scrivi l'idea qui sotto."),
    ).toBeVisible();
    await shoot(page, "foglio-aggiungi-errore.png", false);
  });

  test("#32: foglio «Aggiungi un'idea» compilato", async ({ page }) => {
    await parents(page, { share: "attivo" });
    const dialog = await addButton(page);
    await dialog
      .getByLabel("Oppure scrivi l'idea")
      .fill("Corso di pattinaggio");
    await dialog.getByLabel("Nota per chi regala").fill("lo chiede da un anno");
    await shoot(page, "foglio-aggiungi-compilato.png", false);
  });

  test("#32: foglio «Modifica l'idea»", async ({ page }) => {
    await parents(page, { share: "attivo" });
    await ideaButton(page, "Diario segreto con lucchetto").click();
    const dialog = page.getByRole("dialog", { name: "Modifica l'idea" });
    await expect(dialog).toBeVisible();
    await waitForAnimationsToEnd(page);
    await shoot(page, "foglio-modifica.png", false);
  });

  test("#32: foglio «Modifica l'idea» già presa", async ({ page }) => {
    await parents(page, { share: "attivo" });
    await ideaButton(page, "Casco per la bici").click();
    const dialog = page.getByRole("dialog", { name: "Modifica l'idea" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("La regala Nonna Anna.")).toBeVisible();
    await waitForAnimationsToEnd(page);
    await shoot(page, "foglio-modifica-presa.png", false);
  });

  test("#32: foglio «Modifica l'idea» con errore", async ({ page }) => {
    await parents(page, { share: "attivo" });
    await ideaButton(page, "Biglietti per il musical").click();
    const dialog = page.getByRole("dialog", { name: "Modifica l'idea" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Nome dell'idea").fill("");
    await dialog.getByRole("button", { name: "Salva le modifiche" }).click();
    await expect(
      dialog.getByText("Scrivi il nome dell'idea per salvarla."),
    ).toBeVisible();
    await waitForAnimationsToEnd(page);
    await shoot(page, "foglio-modifica-errore.png", false);
  });

  test("#32: conferma «Elimina l'idea»", async ({ page }) => {
    await parents(page, { share: "attivo" });
    await ideaButton(page, "Casco per la bici").click();
    const sheet = page.getByRole("dialog", { name: "Modifica l'idea" });
    await expect(sheet).toBeVisible();
    await sheet.getByRole("button", { name: "Elimina l'idea" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await waitForAnimationsToEnd(page);
    await shoot(page, "elimina-conferma.png", false);
  });

  // ---- loading, errors, offline ------------------------------------------

  test("#32: caricamento (scheletro)", async ({ page }) => {
    const nest = await wishNest(page, { login: true, share: "attivo" });
    user = nest.user;
    let release: () => void = () => {};
    const hold = new Promise<void>((resolve) => (release = resolve));
    await answerListReads(page, { hold });
    try {
      const asked = page.waitForRequest(
        (r) => /\/rest\/v1\/wishlists/.test(r.url()) && r.method() === "GET",
      );
      await page.goto(`/figli/${nest.childId}/lista-desideri`);
      await asked;
      await expect(page.getByText("Caricamento in corso")).toBeAttached();
      await page.evaluate(() => document.fonts.ready);
      await shoot(page, "lista-caricamento.png");
    } finally {
      release();
    }
    await expect(
      page.getByRole("heading", { level: 1, name: `I desideri di ${CHILD}` }),
    ).toBeVisible();
  });

  test("#32: errore della pagina", async ({ page }) => {
    const nest = await wishNest(page, { login: true });
    user = nest.user;
    await answerListReads(page, "error");
    await expect(async () => {
      await page.goto(`/figli/${nest.childId}/lista-desideri`);
      await expect(
        page.getByRole("heading", { name: "Questa pagina non si è caricata" }),
      ).toBeVisible({ timeout: 15_000 });
    }).toPass({ timeout: 60_000 });
    await page.evaluate(() => document.fonts.ready);
    await shoot(page, "lista-errore.png");
  });

  test("#32: offline con la pagina aperta", async ({ page }) => {
    await parents(page, { share: "attivo" });
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await expect(page.getByText(/^Sei offline\./)).toBeVisible();
    await shoot(page, "lista-offline.png");
  });

  // ---- 768 px --------------------------------------------------------------

  test("#32: lista a 768 px", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "una sola volta");
    await page.setViewportSize({ width: 768, height: 1024 });
    await parents(page, { share: "attivo" });
    await shoot(page, "lista-768.png");
  });

  test("#32: lista vuota a 768 px", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "una sola volta");
    await page.setViewportSize({ width: 768, height: 1024 });
    await parents(page, { ideas: "nessuna" });
    await shoot(page, "lista-vuota-768.png");
  });

  test("#32: foglio «Aggiungi un'idea» a 768 px", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "una sola volta");
    await page.setViewportSize({ width: 768, height: 1024 });
    await parents(page, { share: "attivo" });
    await addButton(page);
    await shoot(page, "foglio-aggiungi-768.png", false);
  });

  // ---- public page --------------------------------------------------------

  async function publicPage(
    page: Page,
    options: Parameters<typeof wishNest>[1] = {},
  ): Promise<WishNest> {
    const nest = await wishNest(page, { share: "attivo", ...options });
    user = nest.user;
    await openPublic(page, nest.code!);
    return nest;
  }

  test("#33: pagina pubblica, normale", async ({ page }) => {
    await publicPage(page);
    await shoot(page, "pubblica-normale.png");
  });

  test("#33: pagina pubblica, con le foto", async ({ page }) => {
    await publicPage(page, { ideas: "mockup-con-foto" });
    await shoot(page, "pubblica-con-foto.png");
  });

  test("#33: pagina pubblica, tutto preso", async ({ page }) => {
    await publicPage(page, { ideas: "tutte-prese" });
    await shoot(page, "pubblica-tutto-preso.png");
  });

  test("#33: pagina pubblica, senza idee", async ({ page }) => {
    const nest = await wishNest(page, { share: "attivo" });
    user = nest.user;
    const removed = await nest.user.admin
      .from("wishlist_items")
      .delete()
      .eq("household_id", nest.householdId);
    expect(removed.error).toBeNull();
    await openPublic(page, nest.code!);
    await expect(
      page.getByText("Ancora nessuna idea").locator("visible=true"),
    ).toBeVisible();
    await shoot(page, "pubblica-vuota.png");
  });

  test("#33: pagina pubblica, link non attivo", async ({ page }) => {
    const nest = await wishNest(page, { share: "disattivato" });
    user = nest.user;
    await page.goto(`/desideri/${nest.code}`);
    await expect(
      page.getByRole("heading", { name: "Questa lista non è più attiva" }),
    ).toBeVisible();
    await settle(page);
    await shoot(page, "pubblica-non-attiva.png");
  });

  test("#33: pagina pubblica, errore di caricamento", async ({ page }) => {
    const nest = await wishNest(page, { share: "attivo" });
    user = nest.user;
    await answerPublicReads(page, "error");
    await page.goto(`/desideri/${nest.code}`);
    await expect(
      page.getByRole("heading", { name: "Questa pagina non si è caricata" }),
    ).toBeVisible();
    await settle(page);
    await shoot(page, "pubblica-errore.png");
  });

  test("#33: pagina pubblica, caricamento (scheletro)", async ({ page }) => {
    const nest = await wishNest(page, { share: "attivo" });
    user = nest.user;
    let release: () => void = () => {};
    const hold = new Promise<void>((resolve) => (release = resolve));
    await answerPublicReads(page, { hold });
    try {
      const asked = page.waitForRequest((r) =>
        /\/rest\/v1\/rpc\/get_public_wishlist$/.test(r.url()),
      );
      await page.goto(`/desideri/${nest.code}`);
      await asked;
      await expect(
        page.getByText("Caricamento in corso").first(),
      ).toBeAttached();
      await page.evaluate(() => document.fonts.ready);
      await shoot(page, "pubblica-caricamento.png");
    } finally {
      release();
    }
  });

  test("#33: pagina pubblica, offline con la pagina aperta", async ({
    page,
  }) => {
    await publicPage(page);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await expect(page.getByRole("alert").filter({ hasText: "Sei offline" }).locator("visible=true")).toContainText(
      "Sei offline. Per segnare un regalo serve la connessione.",
    );
    await shoot(page, "pubblica-offline.png");
  });

  test("#33: foglio «Lo regalo io»", async ({ page }) => {
    await publicPage(page);
    await page
      .getByRole("button", { name: /^Lo regalo io/ })
      .first()
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await waitForAnimationsToEnd(page);
    await shoot(page, "pubblica-foglio.png", false);
  });

  test("#33: foglio «Lo regalo io» con errore", async ({ page }) => {
    await publicPage(page);
    await page
      .getByRole("button", { name: /^Lo regalo io/ })
      .first()
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Lo regalo io" }).click();
    await expect(
      dialog.getByText("Scrivi il tuo nome, così i genitori sanno chi lo regala."),
    ).toBeVisible();
    await waitForAnimationsToEnd(page);
    await shoot(page, "pubblica-foglio-errore.png", false);
  });

  test("#33: regalo segnato («Lo regali tu»)", async ({ page }) => {
    await publicPage(page);
    await page
      .getByRole("button", { name: /^Lo regalo io/ })
      .first()
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Come ti chiami?").fill("Nonno Piero");
    await dialog.getByRole("button", { name: "Lo regalo io" }).click();
    await expect(page.getByText("Segnato a tuo nome.")).toBeVisible();
    await expect(
      page.getByText("Lo regali tu").locator("visible=true"),
    ).toBeVisible();
    await waitForAnimationsToEnd(page);
    await shoot(page, "pubblica-regalo-segnato.png");
  });

  test("#33: pagina pubblica a 768 px", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "una sola volta");
    await page.setViewportSize({ width: 768, height: 1024 });
    await publicPage(page);
    await shoot(page, "pubblica-normale-768.png");
  });

  test("#33: pagina pubblica non attiva a 768 px", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "una sola volta");
    await page.setViewportSize({ width: 768, height: 1024 });
    const nest = await wishNest(page, { share: "disattivato" });
    user = nest.user;
    await page.goto(`/desideri/${nest.code}`);
    await expect(
      page.getByRole("heading", { name: "Questa lista non è più attiva" }),
    ).toBeVisible();
    await settle(page);
    await shoot(page, "pubblica-non-attiva-768.png");
  });

  test("#33: foglio «Lo regalo io» a 768 px", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "una sola volta");
    await page.setViewportSize({ width: 768, height: 1024 });
    await publicPage(page);
    await page
      .getByRole("button", { name: /^Lo regalo io/ })
      .first()
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await waitForAnimationsToEnd(page);
    await shoot(page, "pubblica-foglio-768.png", false);
  });
});
