import { type Page } from "@playwright/test";
import { column, setClock } from "../fixtures/casa";
import { NOW, dialogOf } from "../fixtures/aggiungi";
import {
  sheet,
  tapRowTitle,
  toastWith,
  waitForSheet,
} from "../fixtures/aggiungi-casa";
import { expect, greeting, test } from "../fixtures/oggi";
import { showColumn } from "../fixtures/percorso-casa";

// Percorso di Aggiungi aperto più volte di seguito (#307): chi organizza la
// casa aggiunge più cose una dopo l'altra, senza ricaricare la pagina. Ogni
// apertura del foglio deve mostrare il foglio, anche la seconda e la terza.
// L'orologio del browser è fermo a martedì 20 ottobre 2026, 15:52.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

async function openAddFromBar(page: Page): Promise<void> {
  await page.getByRole("link", { name: "Aggiungi", exact: true }).click();
  await waitForSheet(page, "add");
}

test.describe("Aggiungi più volte di seguito", () => {
  test("percorso: dal vuoto di «Scadenze» di una pagina appena aperta il foglio si apre", async ({
    page,
    baseURL,
    casa,
  }) => {
    await setClock(page, NOW);
    await casa.signIn(page, baseURL, "Marco");
    await page.goto("/casa/scadenze");
    await showColumn(page, "Scadenze");
    await column(page, "Scadenze")
      .getByRole("link", { name: "Aggiungi una scadenza", exact: true })
      .click();
    await waitForSheet(page, "add");
    await expect(sheet(page).type("Scadenza")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("percorso: con l'orologio vero, dalla barra, due cose di seguito: il foglio si apre la seconda volta", async ({
    page,
    baseURL,
    casa,
  }) => {
    await casa.signIn(page, baseURL, "Marco");
    await page.goto("/oggi");
    await expect(
      page.getByRole("heading", { level: 1, name: greeting }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(async () => {
      await page.getByRole("link", { name: "Aggiungi", exact: true }).click();
      await expect(dialogOf(page)).toBeVisible({ timeout: 2000 });
    }).toPass();
    await waitForSheet(page, "add");
    await sheet(page).field.fill("latte e pane");
    await sheet(page).button("Aggiungi 2 cose").click();
    await expect(sheet(page).dialog).toHaveCount(0);
    await expect(toastWith(page, "2 cose aggiunte alla spesa.")).toBeVisible();
    await expect(page).toHaveURL(/\/oggi$/);

    await openAddFromBar(page);
    await sheet(page).field.fill("devo portare le scarpe dal calzolaio");
    await sheet(page).button("Aggiungi ai da fare").click();
    await expect(sheet(page).dialog).toHaveCount(0);
  });

  test("percorso: dalla barra, due cose di seguito: il foglio si apre la seconda volta", async ({
    page,
    baseURL,
    casa,
  }) => {
    await setClock(page, NOW);
    await casa.signIn(page, baseURL, "Marco");
    await page.goto("/oggi");
    await expect(
      page.getByRole("heading", { level: 1, name: greeting }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(async () => {
      await page.getByRole("link", { name: "Aggiungi", exact: true }).click();
      await expect(dialogOf(page)).toBeVisible({ timeout: 2000 });
    }).toPass();
    await waitForSheet(page, "add");
    await sheet(page).field.fill("latte e pane");
    await sheet(page).button("Aggiungi 2 cose").click();
    await expect(sheet(page).dialog).toHaveCount(0);
    await expect(toastWith(page, "2 cose aggiunte alla spesa.")).toBeVisible();

    await openAddFromBar(page);
    await sheet(page).field.fill("devo portare le scarpe dal calzolaio");
    await sheet(page).button("Aggiungi ai da fare").click();
    await expect(sheet(page).dialog).toHaveCount(0);
  });

  test("percorso: da Casa, prima «Da fare» e poi «Scadenze»: il foglio si apre la seconda volta", async ({
    page,
    baseURL,
    casa,
  }) => {
    await setClock(page, NOW);
    await casa.signIn(page, baseURL, "Marco");
    await page.goto("/casa/da-fare");
    await showColumn(page, "Da fare");
    await column(page, "Da fare")
      .getByRole("link", { name: "Aggiungi una cosa da fare", exact: true })
      .click();
    await waitForSheet(page, "add");
    await sheet(page).field.fill("Laura deve chiamare la nonna entro venerdì");
    await sheet(page).button("Dai a Laura").click();
    await expect(sheet(page).dialog).toHaveCount(0);
    await expect(
      toastWith(page, "Dato a Laura: Chiamare la nonna."),
    ).toBeVisible();

    await showColumn(page, "Scadenze");
    await column(page, "Scadenze")
      .getByRole("link", { name: "Aggiungi una scadenza", exact: true })
      .click();
    await waitForSheet(page, "add");
    await expect(sheet(page).type("Scadenza")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("percorso: dopo aver modificato una cosa da fare, il titolo di un'altra riga apre «Modifica» senza ricaricare", async ({
    page,
    baseURL,
    casa,
  }) => {
    await casa.todo("Marco", { title: "Prenotare la palestra" });
    await casa.todo("Marco", { title: "Ritirare il pacco" });
    await setClock(page, NOW);
    await casa.signIn(page, baseURL, "Marco");
    await page.goto("/casa/da-fare");
    await showColumn(page, "Da fare");
    await tapRowTitle(page, "Prenotare la palestra");
    await sheet(page, "edit").person("Laura").click();
    await sheet(page, "edit").button("Salva").click();
    await expect(sheet(page, "edit").dialog).toHaveCount(0);
    await expect(toastWith(page, "Modifiche salvate.")).toBeVisible();

    await tapRowTitle(page, "Ritirare il pacco");
    await expect(sheet(page, "edit").field).toHaveValue("Ritirare il pacco");
  });
});
