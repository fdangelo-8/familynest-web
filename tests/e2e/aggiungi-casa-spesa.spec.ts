import { type Page } from "@playwright/test";
import { expect, test } from "../fixtures/casa";
import {
  expectPreview,
  labelText,
  openAddFromNav,
  openCasaPage,
  pauseClock,
  secondBrowser,
  shoppingOf,
  sheet,
  takeShopping,
  toastOf,
  toastWith,
} from "../fixtures/aggiungi-casa";

// Aggiungi · Spesa, Da fare e Scadenze (#22): recognition of the type (CA-1 ...
// CA-4) and the Spesa type (CA-5 ... CA-13, CA-55). The browser clock is fixed at
// Tuesday 20 October 2026, 15:52 in Rome ([OR]). Every test builds its own
// throwaway Nests (fixtures `casa`, `bianchi`) and nothing depends on the seed.
// Mobile and desktop run the same flow; the layout does not change the criteria.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

const TYPES = ["Impegno", "Da fare", "Spesa", "Scadenza"] as const;

/** Exactly one voice of the «Tipo» selector is pressed. */
async function expectType(page: Page, chosen: (typeof TYPES)[number]) {
  const s = sheet(page);
  for (const type of TYPES) {
    await expect(s.type(type)).toHaveAttribute(
      "aria-pressed",
      type === chosen ? "true" : "false",
    );
  }
}

/** The titles and quantities of the section «Da prendere» in /casa/spesa. */
const toTake = (page: Page) => page.getByTestId("spesa-da-prendere");
const taken = (page: Page) => page.getByTestId("spesa-presi");
const titlesOf = (scope: ReturnType<typeof toTake>) =>
  scope.locator(".riga-lista__titolo");

// ------------------------------------------------- Riconoscimento del tipo

test.describe("Aggiungi · riconoscimento del tipo", () => {
  test("CA-1: «latte, pane e 6 uova» sceglie Spesa e le altre voci restano spente", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAddFromNav(page, baseURL, casa, "Marco");
    await sheet(page).field.fill("latte, pane e 6 uova");
    await expectType(page, "Spesa");
  });

  test("CA-2: «Laura deve chiamare la nonna entro venerdì» sceglie Da fare, poi «bollo auto scade il 7 dicembre» sceglie Scadenza", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAddFromNav(page, baseURL, casa, "Marco");
    const { field } = sheet(page);
    await field.fill("Laura deve chiamare la nonna entro venerdì");
    await expectType(page, "Da fare");
    await field.fill("");
    await field.fill("bollo auto scade il 7 dicembre");
    await expectType(page, "Scadenza");
  });

  test("CA-3: un tipo scelto a mano resta, anche se il testo cambia, e il testo non si cancella", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAddFromNav(page, baseURL, casa, "Marco");
    const s = sheet(page);
    await s.field.fill("latte e pane");
    await expectType(page, "Spesa");

    await s.type("Da fare").click();
    await expect(s.field).toHaveValue("latte e pane");
    await s.field.focus();
    await s.field.press("Control+End");
    await s.field.pressSequentially(", uova");

    await expect(s.field).toHaveValue("latte e pane, uova");
    await expectType(page, "Da fare");
    await expect(s.button("Aggiungi ai da fare")).toBeVisible();
  });

  test("CA-4: con il campo vuoto e «Scadenza» scelta il bottone principale è disabilitato", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAddFromNav(page, baseURL, casa, "Marco");
    const s = sheet(page);
    await s.type("Scadenza").click();
    await expectType(page, "Scadenza");
    await expect(s.button("Aggiungi")).toBeDisabled();
  });
});

// ------------------------------------------------------------------- Spesa

test.describe("Aggiungi · Spesa", () => {
  test("CA-5: «latte, pane e 6 uova» con Latte già in lista mostra le tre righe e «Aggiungi 2 cose»", async ({
    page,
    baseURL,
    casa,
  }) => {
    await casa.shopping("Marco", ["Latte"]);
    await openAddFromNav(page, baseURL, casa, "Marco");
    await sheet(page).field.fill("latte, pane e 6 uova");

    await expectPreview(page, [
      { name: "Latte", already: true },
      { name: "Pane" },
      { name: "Uova", quantity: "6" },
    ]);
    await expect(sheet(page).button("Aggiungi 2 cose")).toBeVisible();
  });

  test("CA-5 isolamento: «Latte» nella spesa di un altro Nest non conta come già in lista", async ({
    page,
    baseURL,
    casa,
    bianchi,
  }) => {
    await bianchi.shopping("Giulia", ["Latte"]);
    await openAddFromNav(page, baseURL, casa, "Marco");
    await sheet(page).field.fill("latte e pane");

    await expectPreview(page, [{ name: "Latte" }, { name: "Pane" }]);
    await expect(sheet(page).button("Aggiungi 2 cose")).toBeVisible();
  });

  test("CA-6: «Aggiungi 2 cose» chiude il foglio, mostra il toast con «Annulla» e la spesa ha Latte, Pane, Uova", async ({
    page,
    baseURL,
    casa,
  }) => {
    await casa.shopping("Marco", ["Latte"]);
    await openAddFromNav(page, baseURL, casa, "Marco");
    await sheet(page).field.fill("latte, pane e 6 uova");
    await sheet(page).button("Aggiungi 2 cose").click();

    await expect(sheet(page).dialog).toHaveCount(0);
    const toast = toastWith(page, "2 cose aggiunte alla spesa.");
    await expect(toast).toBeVisible();
    await expect(toast.getByRole("button", { name: "Annulla" })).toBeVisible();

    const rows = await shoppingOf(casa, "Marco");
    expect(rows.map((row) => row.name).sort()).toEqual([
      "Latte",
      "Pane",
      "Uova",
    ]);

    await page.goto("/casa/spesa");
    await expect(titlesOf(toTake(page))).toHaveText(["Latte", "Pane", "Uova"], {
      timeout: 20_000,
    });
    await expect(
      toTake(page)
        .getByRole("listitem")
        .filter({ hasText: "Uova" })
        .locator(".riga-lista__quantita"),
    ).toHaveText("6");
  });

  test("CA-7: «1 kg di mele, 2l latte, pane e Pane» salva Mele «1 kg», Latte «2 l» e un solo Pane", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAddFromNav(page, baseURL, casa, "Marco");
    await sheet(page).field.fill("1 kg di mele, 2l latte, pane e Pane");
    await sheet(page).button("Aggiungi 3 cose").click();

    await expect(toastWith(page, "3 cose aggiunte alla spesa.")).toBeVisible();
    const rows = await shoppingOf(casa, "Marco");
    expect(rows).toHaveLength(3);
    const byName = Object.fromEntries(
      rows.map((row) => [row.name, row.quantity || null]),
    );
    expect(byName).toEqual({ Mele: "1 kg", Latte: "2 l", Pane: null });

    await page.goto("/casa/spesa");
    await expect(titlesOf(toTake(page))).toHaveText(["Mele", "Latte", "Pane"], {
      timeout: 20_000,
    });
    await expect(toTake(page).locator(".riga-lista__quantita")).toHaveText([
      "1 kg",
      "2 l",
    ]);
  });

  test("CA-8: con Latte e Pane già in lista, «latte e pane» dà «Già tutto in lista» disabilitato", async ({
    page,
    baseURL,
    casa,
  }) => {
    await casa.shopping("Marco", ["Latte", "Pane"]);
    await openAddFromNav(page, baseURL, casa, "Marco");
    await sheet(page).field.fill("latte e pane");

    await expectPreview(page, [
      { name: "Latte", already: true },
      { name: "Pane", already: true },
    ]);
    await expect(sheet(page).button("Già tutto in lista")).toBeDisabled();
  });

  test("CA-9: una cosa solo in «Presi» si aggiunge di nuovo a «Da prendere»", async ({
    page,
    baseURL,
    casa,
  }) => {
    await casa.shopping("Marco", ["Latte"]);
    await takeShopping(casa, "Marco", "Latte");
    await openAddFromNav(page, baseURL, casa, "Marco");
    await sheet(page).field.fill("latte e caffè");
    await expectPreview(page, [{ name: "Latte" }, { name: "Caffè" }]);
    await sheet(page).button("Aggiungi 2 cose").click();
    await expect(toastWith(page, "2 cose aggiunte alla spesa.")).toBeVisible();

    await page.goto("/casa/spesa");
    await expect(titlesOf(toTake(page))).toHaveText(["Latte", "Caffè"], {
      timeout: 20_000,
    });
    await expect(titlesOf(taken(page))).toHaveText(["Latte"]);
  });

  test("CA-10: «Annulla» toglie le cose appena aggiunte, anche dopo il ricaricamento, senza un secondo toast", async ({
    page,
    baseURL,
    casa,
  }) => {
    await casa.shopping("Marco", ["Latte"]);
    await openAddFromNav(page, baseURL, casa, "Marco");
    await sheet(page).field.fill("latte, pane e 6 uova");
    await sheet(page).button("Aggiungi 2 cose").click();
    const toast = toastWith(page, "2 cose aggiunte alla spesa.");
    await expect(toast).toBeVisible();

    // The clock stops: the toast cannot expire while the test acts.
    await pauseClock(page);
    await toast.getByRole("button", { name: "Annulla" }).click();
    await expect(toastOf(page)).toHaveCount(0);
    await expect
      .poll(async () => (await shoppingOf(casa, "Marco")).map((r) => r.name))
      .toEqual(["Latte"]);
    await expect(toastOf(page)).toHaveCount(0);

    await page.goto("/casa/spesa");
    await expect(titlesOf(toTake(page))).toHaveText(["Latte"], {
      timeout: 20_000,
    });
  });

  test("CA-11: quello che Giulia aggiunge compare da Paolo entro 5 secondi, senza ricaricare, con l'iniziale «G»", async ({
    page,
    browser,
    baseURL,
    bianchi,
  }, testInfo) => {
    await openCasaPage(page, baseURL, bianchi, "Paolo", "/casa/spesa");
    const giulia = await secondBrowser(
      browser,
      baseURL,
      testInfo.project.use.viewport,
    );
    try {
      await openAddFromNav(giulia.page, baseURL, bianchi, "Giulia");
      await sheet(giulia.page).field.fill("yogurt e mele");
      await sheet(giulia.page).button("Aggiungi 2 cose").click();
      await expect(
        toastWith(giulia.page, "2 cose aggiunte alla spesa."),
      ).toBeVisible();

      await expect(titlesOf(toTake(page))).toHaveText(["Yogurt", "Mele"], {
        timeout: 5000,
      });
      await expect(toTake(page).locator(".avatar")).toHaveText(["G", "G"]);
    } finally {
      await giulia.context.close();
    }
  });

  test("CA-12: con il tipo Spesa, «, e ,» dà l'errore sotto il campo e non salva nulla", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAddFromNav(page, baseURL, casa, "Marco");
    const s = sheet(page);
    await s.type("Spesa").click();
    await s.field.fill(", e ,");
    await s.button("Aggiungi").click();

    await s.expectError(
      "Scrivi cosa manca: per esempio «latte, pane e 6 uova».",
    );
    await expect(s.dialog).toBeVisible();
    expect(await shoppingOf(casa, "Marco")).toHaveLength(0);
  });

  test("CA-13: una cosa di 81 caratteri dà l'errore dei limiti e la spesa non cambia", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAddFromNav(page, baseURL, casa, "Marco");
    const s = sheet(page);
    await s.type("Spesa").click();
    await s.field.fill("a".repeat(81));
    await s.button("Aggiungi 1 cosa").click();

    await s.expectError(
      "Ogni cosa può avere al massimo 80 caratteri, e la quantità 20.",
    );
    expect(await shoppingOf(casa, "Marco")).toHaveLength(0);
  });

  test("CA-55: «spesa: latte e pane» sceglie Spesa, il prefisso non entra nelle cose (anche con la maiuscola)", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAddFromNav(page, baseURL, casa, "Marco");
    const s = sheet(page);
    await s.field.fill("spesa: latte e pane");
    await expectType(page, "Spesa");
    await expectPreview(page, [{ name: "Latte" }, { name: "Pane" }]);
    await expect(s.button("Aggiungi 2 cose")).toBeVisible();

    await s.field.fill("Spesa: latte e pane");
    await expectType(page, "Spesa");
    await expectPreview(page, [{ name: "Latte" }, { name: "Pane" }]);

    await s.button("Aggiungi 2 cose").click();
    await expect(toastWith(page, "2 cose aggiunte alla spesa.")).toBeVisible();
    const names = (await shoppingOf(casa, "Marco")).map((row) => row.name);
    expect(names.sort()).toEqual(["Latte", "Pane"]);

    await page.goto("/casa/spesa");
    await expect(titlesOf(toTake(page))).toHaveText(["Latte", "Pane"], {
      timeout: 20_000,
    });
  });

  test("CA-4, CA-5: stato vuoto della Spesa (tipo scelto, nessuna anteprima, «Aggiungi» spento) e anteprima che segue il testo", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAddFromNav(page, baseURL, casa, "Marco");
    const s = sheet(page);
    await s.type("Spesa").click();
    // Stato vuoto: tipo scelto, nessun blocco, «Aggiungi» disabilitato.
    await expect(s.list).toHaveCount(0);
    await expect(s.button("Aggiungi")).toBeDisabled();
    await expect(labelText(page, /\S/)).toHaveCount(0);

    await s.field.fill("latte");
    await expectPreview(page, [{ name: "Latte" }]);
    await expect(s.button("Aggiungi 1 cosa")).toBeVisible();
    await s.field.fill("");
    await expect(s.list).toHaveCount(0);
  });
});
