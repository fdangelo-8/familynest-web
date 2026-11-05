import { expect, test } from "@playwright/test";
import { waitForAnimationsToEnd } from "../fixtures/animations";
import {
  throwawayConfigured,
  throwawaySkipReason,
  type ThrowawayUser,
} from "../fixtures/throwaway-user";
import {
  FIXED_NOW,
  answerProfileReads,
  childNest,
  editButton,
  editDialog,
  openChild,
  provokeErrors,
  shoot,
} from "../fixtures/figlio-visuale";

// PR #245 (#31): references of «Profilo di un figlio» (/figli/<id>) at 390 and
// 1280 px: normal, empty, loading, page error, offline, the edit sheet, the
// sheet with errors (top and teachers) and the toast «Modifiche salvate».
// The data is read in the browser, so every state has its own throwaway user
// and the clock of the browser is pinned to Monday 2 November 2026.

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

  test("#31: normale", async ({ page }) => {
    const nest = await childNest(page, "complete");
    user = nest.user;
    await openChild(page, nest.childId);
    await expect(page.getByText("Maestra Bianchi")).toBeVisible();
    await shoot(page, "figlio-normale.png");
  });

  test("#31: vuoto (profilo da completare)", async ({ page }) => {
    const nest = await childNest(page, "empty");
    user = nest.user;
    await openChild(page, nest.childId);
    await expect(page.getByText("Completa il profilo di Sofia")).toBeVisible();
    await shoot(page, "figlio-vuoto.png");
  });

  test("#31: caricamento (scheletro)", async ({ page }) => {
    const nest = await childNest(page, "complete");
    user = nest.user;
    let release: () => void = () => {};
    const hold = new Promise<void>((resolve) => (release = resolve));
    await answerProfileReads(page, { hold });
    try {
      const asked = page.waitForRequest(
        (r) =>
          /\/rest\/v1\/child_profiles/.test(r.url()) && r.method() === "GET",
      );
      await page.goto(`/figli/${nest.childId}`);
      await asked;
      await expect(page.getByText("Caricamento in corso")).toBeAttached();
      await page.evaluate(() => document.fonts.ready);
      await shoot(page, "figlio-caricamento.png");
    } finally {
      release();
    }
    await expect(
      page.getByRole("heading", { level: 1, name: "Sofia" }),
    ).toBeVisible();
  });

  test("#31: errore della pagina", async ({ page }) => {
    const nest = await childNest(page, "complete");
    user = nest.user;
    await answerProfileReads(page, "error");
    await page.goto(`/figli/${nest.childId}`);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Questa pagina non si è caricata",
      }),
    ).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForLoadState("load");
    await shoot(page, "figlio-errore.png");
  });

  test("#31: offline (avviso sopra il profilo)", async ({ page }) => {
    const nest = await childNest(page, "complete");
    user = nest.user;
    await openChild(page, nest.childId);
    await expect(page.getByText("Maestra Bianchi")).toBeVisible();
    await page.context().setOffline(true);
    await expect(
      page.getByText(
        "Sei offline. Vedi il profilo aggiornato alle 10:00; per modificarlo serve la connessione.",
      ),
    ).toBeVisible();
    await shoot(page, "figlio-offline.png");
  });

  test("#31: modulo di modifica", async ({ page }) => {
    const nest = await childNest(page, "complete");
    user = nest.user;
    await openChild(page, nest.childId);
    await editButton(page).click();
    await expect(editDialog(page)).toBeVisible();
    await waitForAnimationsToEnd(page);
    await shoot(page, "figlio-modulo.png", false);
  });

  test("#31: modulo di modifica, parte bassa (scuola, maestre, taglie)", async ({
    page,
  }) => {
    const nest = await childNest(page, "complete");
    user = nest.user;
    await openChild(page, nest.childId);
    await editButton(page).click();
    await expect(editDialog(page)).toBeVisible();
    await waitForAnimationsToEnd(page);
    await editDialog(page)
      .getByRole("heading", { level: 3, name: "Maestre" })
      .scrollIntoViewIfNeeded();
    await shoot(page, "figlio-modulo-maestre.png", false);
  });

  test("#31: modulo di modifica, in fondo (taglie e salvataggio)", async ({
    page,
  }) => {
    const nest = await childNest(page, "complete");
    user = nest.user;
    await openChild(page, nest.childId);
    await editButton(page).click();
    await expect(editDialog(page)).toBeVisible();
    await waitForAnimationsToEnd(page);
    await editDialog(page)
      .getByRole("button", { name: "Salva le modifiche" })
      .scrollIntoViewIfNeeded();
    await shoot(page, "figlio-modulo-fondo.png", false);
  });

  test("#31: modulo con errori, in alto", async ({ page }) => {
    const nest = await childNest(page, "complete");
    user = nest.user;
    await openChild(page, nest.childId);
    await editButton(page).click();
    await expect(editDialog(page)).toBeVisible();
    await waitForAnimationsToEnd(page);
    await provokeErrors(page);
    await editDialog(page)
      .getByLabel("Nome", { exact: true })
      .scrollIntoViewIfNeeded();
    await shoot(page, "figlio-modulo-errori.png", false);
  });

  test("#31: modulo con errori, orario e maestre", async ({ page }) => {
    const nest = await childNest(page, "complete");
    user = nest.user;
    await openChild(page, nest.childId);
    await editButton(page).click();
    await expect(editDialog(page)).toBeVisible();
    await waitForAnimationsToEnd(page);
    await provokeErrors(page);
    await expect(
      editDialog(page).getByText("L'uscita deve essere dopo l'entrata."),
    ).toBeVisible();
    await expect(
      editDialog(page).getByText("Scrivi il nome della maestra."),
    ).toBeVisible();
    await editDialog(page)
      .getByRole("heading", { level: 3, name: "Maestre" })
      .scrollIntoViewIfNeeded();
    await shoot(page, "figlio-modulo-errori-maestre.png", false);
  });

  test("#31: toast «Modifiche salvate»", async ({ page }) => {
    const nest = await childNest(page, "complete");
    user = nest.user;
    await openChild(page, nest.childId);
    await editButton(page).click();
    await expect(editDialog(page)).toBeVisible();
    await waitForAnimationsToEnd(page);
    await editDialog(page).getByLabel("Classe").fill("5ª A");
    await editDialog(page)
      .getByRole("button", { name: "Salva le modifiche" })
      .click();
    await expect(editDialog(page)).toHaveCount(0);
    await expect(
      page.getByRole("status").filter({ hasText: "Modifiche salvate" }),
    ).toBeVisible();
    await expect(page.getByText("5ª A, scuola Manzoni")).toBeVisible();
    await waitForAnimationsToEnd(page);
    await shoot(page, "figlio-toast.png", false);
  });
});
