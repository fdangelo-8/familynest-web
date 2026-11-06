import { expect, test, type Locator, type Page } from "@playwright/test";
import { saveWithStoppedClock } from "../fixtures/aggiungi-fake";
import {
  blocking,
  contrastFailures,
  focused,
  missedPoints,
} from "../fixtures/aggiungi-a11y";
import {
  DEADLINE_ID,
  DEADLINE_THING,
  SHOPPING_ID,
  SHOPPING_THING,
  TODO_ID,
  TODO_THING,
  installCasaFakes,
  type CasaOptions,
} from "../fixtures/aggiungi-casa-fake";
import { hasTestUser } from "../fixtures/visual-login";
import { signInAsCached } from "../fixtures/visual-login-cached";

// Aggiungi · Spesa, Da fare, Scadenza and the edit of a thing (#22, PR #203):
// accessibility of the Add sheet, in every state of the specification, at 390
// and 1280 px (projects). Needs test user A (Marco, Casa D'Angelo); without
// TEST_USER_A_* the tests are skipped. The shopping list, the todos and the
// deadlines are served by fakes (fixtures/aggiungi-casa-fake.ts): nothing is
// written to the database.
//
// - axe on the dialog, the confirm dialog and the toast (serious and critical);
// - the live region of the labels (a single one in Da fare and Scadenza, none in
//   Spesa: its preview is not announced letter by letter);
// - the focus: order, trapped, ring visible, where it goes after «Togli»;
// - touch areas of 44 px with elementFromPoint;
// - contrast of every text, measured on the computed colors.

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

const NOW = new Date("2026-10-20T15:52:00+02:00");
const TODO_PHRASE = "Laura deve chiamare la nonna entro venerdì";
const DEADLINE_PHRASE = "bollo auto scade il 7 dicembre";
const EDIT_TODO = `/aggiungi?modifica=${TODO_ID}&tipo=da-fare`;
const EDIT_DEADLINE = `/aggiungi?modifica=${DEADLINE_ID}&tipo=scadenza`;
const PEOPLE = ["Tu", "Laura", "Sofia", "Tommaso"];
const REMINDERS = [
  "30 giorni prima",
  "7 giorni",
  "1 giorno",
  "Il giorno stesso",
];

test.beforeEach(async ({ page, context, baseURL }) => {
  test.skip(!hasTestUser("A"), "TEST_USER_A_* non impostati");
  const signedIn = await signInAsCached(context, baseURL!, "A");
  test.skip(!signedIn, "utente di test A non ancora creato (#55)");
  await page.clock.install({ time: NOW });
});

function isDesktop(testInfo: { project: { name: string } }) {
  return testInfo.project.name === "desktop";
}

async function open(page: Page, url: string, name = "Aggiungi") {
  await page.goto(url);
  const dialog = page.getByRole("dialog", { name });
  await expect(dialog).toBeVisible({ timeout: 20_000 });
  await page.evaluate(() => document.fonts.ready);
  return dialog;
}

/** A new thing: the sheet with the type chosen and the phrase written. */
async function write(
  page: Page,
  type: "Spesa" | "Da fare" | "Scadenza",
  phrase: string,
  options: CasaOptions = {},
) {
  await installCasaFakes(page, options);
  const dialog = await open(page, "/aggiungi");
  const field = dialog.getByRole("textbox", { name: "Cosa vuoi aggiungere?" });
  await expect(field).toBeFocused();
  await dialog
    .getByRole("group", { name: "Tipo" })
    .getByRole("button", { name: type })
    .click();
  await field.pressSequentially(phrase);
  return { dialog, field };
}

/** The edit of a thing, once it is read and the form is there. */
async function edit(page: Page, url: string, options: CasaOptions) {
  await installCasaFakes(page, options);
  const dialog = await open(page, url, "Modifica");
  const field = dialog.getByRole("textbox", { name: "Titolo" });
  await expect(field).toBeVisible();
  await expect(field).toBeFocused();
  return { dialog, field };
}

async function confirmOpen(page: Page, dialog: Locator, name: string) {
  await dialog.getByRole("button", { name }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toBeVisible();
  return confirm;
}

/** Walks with Tab from the sheet's close button and gives the name of every stop. */
async function tabOrder(page: Page, stops: number) {
  const order: string[] = [];
  const rings: boolean[] = [];
  for (let i = 0; i < stops; i += 1) {
    await page.keyboard.press("Tab");
    order.push(await focused(page));
    rings.push(
      await page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        const style = getComputedStyle(el);
        const outline =
          style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0;
        // The fields have their own ring: inset shadow, no outline (as in the mockup)
        return (
          outline ||
          ((el.tagName === "TEXTAREA" || el.tagName === "INPUT") &&
            style.boxShadow !== "none")
        );
      }),
    );
  }
  return { order, rings };
}

test.describe("Aggiungi · Spesa, Da fare, Scadenza: axe", () => {
  test("spesa: anteprima con una cosa già in lista", async ({ page }) => {
    await write(page, "Spesa", "latte, pane e 6 uova", { toTake: ["Latte"] });
    expect(await blocking(page, '[role="dialog"]')).toEqual([]);
  });

  test("da fare: etichette, visibilità e chi se ne occupa", async ({
    page,
  }) => {
    const { dialog } = await write(page, "Da fare", TODO_PHRASE);
    await dialog.getByRole("button", { name: "Lo vedo solo io" }).click();
    expect(await blocking(page, '[role="dialog"]')).toEqual([]);
  });

  test("scadenza urgente con avvisi", async ({ page }) => {
    await write(page, "Scadenza", "bollo auto scade il 30 ottobre");
    expect(await blocking(page, '[role="dialog"]')).toEqual([]);
  });

  test("errore del campo e salvataggio non riuscito", async ({ page }) => {
    const { dialog, field } = await write(page, "Da fare", "entro venerdì", {
      write: "fail",
    });
    await field.press("Enter");
    await expect(field).toHaveAttribute("aria-invalid", "true");
    expect(await blocking(page, '[role="dialog"]')).toEqual([]);
    await field.fill(TODO_PHRASE);
    await dialog.getByRole("button", { name: "Dai a Laura" }).click();
    await expect(dialog.getByRole("alert")).toBeVisible();
    expect(await blocking(page, '[role="dialog"]')).toEqual([]);
  });

  test("salvataggio in corso", async ({ page }) => {
    const { dialog } = await write(page, "Da fare", TODO_PHRASE, {
      write: "hold",
    });
    const submit = dialog.getByRole("button", { name: "Dai a Laura" });
    await submit.click();
    await expect(submit).toHaveAttribute("aria-busy", "true");
    expect(await blocking(page, '[role="dialog"]')).toEqual([]);
  });

  test("modifica di una cosa da fare", async ({ page }) => {
    await edit(page, EDIT_TODO, { thing: TODO_THING });
    expect(await blocking(page, '[role="dialog"]')).toEqual([]);
  });

  test("modifica di una scadenza", async ({ page }) => {
    await edit(page, EDIT_DEADLINE, { thing: DEADLINE_THING });
    expect(await blocking(page, '[role="dialog"]')).toEqual([]);
  });

  test("lettura in corso", async ({ page }) => {
    await installCasaFakes(page, { thing: TODO_THING, read: "hold" });
    const dialog = await open(page, EDIT_TODO, "Modifica");
    await expect(dialog.getByTestId("aggiungi-caricamento")).toBeVisible();
    expect(await blocking(page, '[role="dialog"]')).toEqual([]);
  });

  test("la cosa non c'è più e lettura non riuscita", async ({ page }) => {
    await installCasaFakes(page, { thing: TODO_THING, read: "gone" });
    const dialog = await open(page, EDIT_TODO, "Modifica");
    await expect(dialog.getByText("Questa cosa non c'è più")).toBeVisible();
    expect(await blocking(page, '[role="dialog"]')).toEqual([]);
  });

  test("lettura non riuscita", async ({ page }) => {
    await installCasaFakes(page, { thing: TODO_THING, read: "fail" });
    const dialog = await open(page, EDIT_TODO, "Modifica");
    await expect(dialog.getByRole("alert")).toBeVisible();
    expect(await blocking(page, '[role="dialog"]')).toEqual([]);
  });

  test("conferma di eliminazione, anche non riuscita", async ({ page }) => {
    const { dialog } = await edit(page, EDIT_TODO, {
      thing: TODO_THING,
      remove: "fail",
    });
    const confirm = await confirmOpen(page, dialog, "Elimina cosa da fare");
    expect(await blocking(page, '[role="alertdialog"]')).toEqual([]);
    await confirm.getByRole("button", { name: "Elimina cosa da fare" }).click();
    await expect(page.locator(".toast")).toContainText(
      "Non siamo riusciti a eliminare",
    );
    expect(await blocking(page, '[role="alertdialog"]')).toEqual([]);
  });

  test("toast dopo il salvataggio", async ({ page }) => {
    const { dialog } = await write(page, "Da fare", TODO_PHRASE);
    const submit = dialog.getByRole("button", { name: "Dai a Laura" });
    await saveWithStoppedClock(page, dialog, submit, NOW, "Dato a Laura");
    const toast = page.locator(".toast");
    // axe needs timers: the mouse over the toast keeps it (5 seconds), then time flows again
    await toast.hover();
    await page.clock.resume();
    expect(await blocking(page, ".toast")).toEqual([]);
  });
});

// #333: the date, the people and the visibility are fields; the only polite region
// is the label «Per <Nome>» (what the phrase said, not a control), when there is one.
test.describe("Aggiungi · Spesa, Da fare, Scadenza: regione live", () => {
  test("da fare: una sola regione, solo con «Per»; data, persone e visibilità fuori", async ({
    page,
  }) => {
    const { dialog } = await write(
      page,
      "Da fare",
      "Laura deve firmare per Sofia entro venerdì",
    );
    const live = dialog.locator("[aria-live]");
    await expect(live).toHaveCount(1);
    await expect(live).toHaveAttribute("aria-live", "polite");
    await expect(live).toContainText("Per Sofia");
    await expect(live.getByTestId("aggiungi-visibilita")).toHaveCount(0);
    await expect(
      live.getByRole("group", { name: "Chi se ne occupa" }),
    ).toHaveCount(0);
    await expect(live.getByLabel("Data", { exact: true })).toHaveCount(0);
  });

  test("scadenza: nessuna regione senza «riguarda»; la scheda non è live", async ({
    page,
  }) => {
    const { dialog, field } = await write(page, "Scadenza", DEADLINE_PHRASE);
    await expect(dialog.locator("[aria-live]")).toHaveCount(0);
    await expect(
      dialog.locator("[aria-live]").getByTestId("aggiungi-scadenza-anteprima"),
    ).toHaveCount(0);
    await field.pressSequentially(" per Sofia");
    await expect(dialog.locator("[aria-live]")).toHaveCount(1);
    await expect(
      dialog.locator("[aria-live]").getByTestId("aggiungi-scadenza-anteprima"),
    ).toHaveCount(0);
  });

  test("spesa: nessuna regione, l'anteprima non è annunciata lettera per lettera", async ({
    page,
  }) => {
    const { dialog } = await write(page, "Spesa", "latte, pane e 6 uova");
    await expect(dialog.getByTestId("aggiungi-spesa")).toBeVisible();
    await expect(dialog.locator("[aria-live]")).toHaveCount(0);
  });

  test("modifica: una sola regione con «Per Sofia»; tolta, non resta niente da annunciare", async ({
    page,
  }) => {
    const { dialog } = await edit(page, EDIT_TODO, { thing: TODO_THING });
    const live = dialog.locator("[aria-live]");
    await expect(live).toHaveCount(1);
    await expect(live).toContainText("Per Sofia");
    await dialog.getByRole("button", { name: "Togli Per Sofia" }).click();
    await expect(dialog.locator("[aria-live]")).toHaveCount(0);
  });
});

test.describe("Aggiungi · Spesa, Da fare, Scadenza: fuoco", () => {
  test("intrappolato nel foglio: da fare, scadenza e modifica", async ({
    page,
  }) => {
    const { dialog } = await write(page, "Da fare", TODO_PHRASE);
    const inside = () =>
      dialog.evaluate((el) => el.contains(document.activeElement));
    for (let i = 0; i < 16; i += 1) {
      await page.keyboard.press("Tab");
      expect(await inside()).toBe(true);
    }
    for (let i = 0; i < 16; i += 1) {
      await page.keyboard.press("Shift+Tab");
      expect(await inside()).toBe(true);
    }
  });

  test("intrappolato nel foglio di modifica", async ({ page }) => {
    const { dialog } = await edit(page, EDIT_DEADLINE, {
      thing: DEADLINE_THING,
    });
    const inside = () =>
      dialog.evaluate((el) => el.contains(document.activeElement));
    for (let i = 0; i < 18; i += 1) {
      await page.keyboard.press("Tab");
      expect(await inside()).toBe(true);
    }
  });

  test("intrappolato nel dialogo di eliminazione; parte da «Annulla»", async ({
    page,
  }) => {
    const { dialog } = await edit(page, EDIT_TODO, { thing: TODO_THING });
    const confirm = await confirmOpen(page, dialog, "Elimina cosa da fare");
    await expect(
      confirm.getByRole("button", { name: "Annulla" }),
    ).toBeFocused();
    const inside = () =>
      confirm.evaluate((el) => el.contains(document.activeElement));
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press("Tab");
      expect(await inside()).toBe(true);
    }
    // Annulla closes only the dialog; the focus goes back to «Elimina cosa da fare»
    await confirm.getByRole("button", { name: "Annulla" }).click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(
      dialog.getByRole("button", { name: "Elimina cosa da fare" }),
    ).toBeFocused();
  });

  // #333: «Data» is a native date field (one stop per part: same name in a row,
  // counted once), then the people, then the two voices of the visibility.
  /** The stops of the Tab, deduplicated, from the field until `last` is reached. */
  async function stopsUntil(page: Page, last: string) {
    const order: string[] = [];
    const rings: boolean[] = [];
    for (let i = 0; i < 40; i += 1) {
      const { order: one, rings: ring } = await tabOrder(page, 1);
      order.push(one[0]!);
      rings.push(ring[0]!);
      if (one[0] === last) break;
    }
    return {
      order: order.filter((name, i) => name !== order[i - 1]),
      rings,
    };
  }

  test("ordine in Da fare: campo, tipi, data, persone, visibilità, invio", async ({
    page,
  }) => {
    const { field } = await write(page, "Da fare", "chiamare la nonna");
    await field.focus();
    await page.keyboard.press("Shift+Tab");
    expect(await focused(page)).toBe("Chiudi");
    const { order, rings } = await stopsUntil(page, "Aggiungi ai da fare");
    expect(order).toEqual([
      "Cosa vuoi aggiungere?",
      "Impegno",
      "Da fare",
      "Spesa",
      "Scadenza",
      "Data",
      ...PEOPLE,
      "Lo vede tutto il Nest",
      "Lo vedo solo io",
      "Aggiungi ai da fare",
    ]);
    expect(rings).toEqual(rings.map(() => true));
    // After the button the Tab goes back to the start of the sheet (#333: no
    // side column of examples any more)
    await page.keyboard.press("Tab");
    expect(await focused(page)).toBe("Chiudi");
  });

  test("ordine in Scadenza: campo, tipi, data, persone, visibilità, avvisi, invio", async ({
    page,
  }) => {
    const { field } = await write(page, "Scadenza", DEADLINE_PHRASE);
    await field.focus();
    await page.keyboard.press("Shift+Tab");
    expect(await focused(page)).toBe("Chiudi");
    const { order, rings } = await stopsUntil(page, "Aggiungi alle scadenze");
    expect(order).toEqual([
      "Cosa vuoi aggiungere?",
      "Impegno",
      "Da fare",
      "Spesa",
      "Scadenza",
      "Data",
      ...PEOPLE,
      "Lo vede tutto il Nest",
      "Lo vedo solo io",
      ...REMINDERS,
      "Aggiungi alle scadenze",
    ]);
    expect(rings).toEqual(rings.map(() => true));
  });

  test("ordine in Spesa: l'anteprima non ha controlli; le persone sì", async ({
    page,
  }) => {
    const { field } = await write(page, "Spesa", "latte, pane e 6 uova");
    await field.focus();
    await page.keyboard.press("Shift+Tab");
    const { order } = await stopsUntil(page, "Aggiungi 3 cose");
    expect(order).toEqual([
      "Cosa vuoi aggiungere?",
      "Impegno",
      "Da fare",
      "Spesa",
      "Scadenza",
      ...PEOPLE,
      "Aggiungi 3 cose",
    ]);
  });

  test("ordine nella modifica di una cosa da fare", async ({
    page,
  }, testInfo) => {
    const { dialog } = await edit(page, EDIT_TODO, { thing: TODO_THING });
    await dialog.getByRole("textbox", { name: "Titolo" }).focus();
    await page.keyboard.press("Shift+Tab");
    expect(await focused(page)).toBe("Chiudi");
    // Mobile: «Salva» then «Elimina»; desktop: «Elimina» then «Salva» (as in the mockup 11)
    const end = isDesktop(testInfo)
      ? ["Elimina cosa da fare", "Salva"]
      : ["Salva", "Elimina cosa da fare"];
    const { order, rings } = await stopsUntil(page, end[1]!);
    expect(order).toEqual([
      "Titolo",
      "Togli Per Sofia",
      "Data",
      ...PEOPLE,
      "Lo vede tutto il Nest",
      "Lo vedo solo io",
      ...end,
    ]);
    expect(rings).toEqual(rings.map(() => true));
  });

  test("dopo «Togli Per Sofia» il fuoco va alla voce scelta della visibilità", async ({
    page,
  }) => {
    const { dialog } = await edit(page, EDIT_TODO, { thing: TODO_THING });
    await dialog.getByRole("button", { name: "Togli Per Sofia" }).click();
    await expect(
      dialog.getByRole("button", { name: "Lo vede tutto il Nest" }),
    ).toBeFocused();
  });

  test("la cosa non c'è più: il fuoco va su «Chiudi»", async ({ page }) => {
    await installCasaFakes(page, { thing: TODO_THING, read: "gone" });
    const dialog = await open(page, EDIT_TODO, "Modifica");
    await expect(
      dialog.getByRole("button", { name: "Chiudi" }).last(),
    ).toBeVisible();
    await expect(dialog.getByTestId("aggiungi-gone-chiudi")).toBeFocused();
  });
});

test.describe("Aggiungi · Spesa, Da fare, Scadenza: aree di tocco", () => {
  test("da fare: tipi, visibilità, persone e invio", async ({ page }) => {
    const { dialog } = await write(page, "Da fare", TODO_PHRASE);
    const controls: Locator[] = [
      dialog.getByRole("button", { name: "Chiudi" }),
      ...["Impegno", "Da fare", "Spesa", "Scadenza"].map((name) =>
        dialog
          .getByRole("group", { name: "Tipo" })
          .getByRole("button", { name }),
      ),
      dialog.getByRole("button", { name: "Lo vede tutto il Nest" }),
      dialog.getByRole("button", { name: "Lo vedo solo io" }),
      ...PEOPLE.map((name) =>
        dialog
          .getByRole("group", { name: "Chi se ne occupa" })
          .getByRole("button", { name, exact: true }),
      ),
      dialog.getByRole("button", { name: "Dai a Laura" }),
    ];
    for (const control of controls) {
      expect(await missedPoints(control)).toEqual([]);
    }
  });

  test("scadenza: i quattro avvisi", async ({ page }) => {
    const { dialog } = await write(page, "Scadenza", DEADLINE_PHRASE);
    for (const name of REMINDERS) {
      expect(
        await missedPoints(
          dialog
            .getByRole("group", { name: "Avvisami" })
            .getByRole("button", { name }),
        ),
        name,
      ).toEqual([]);
    }
    expect(
      await missedPoints(
        dialog.getByRole("button", { name: "Aggiungi alle scadenze" }),
      ),
    ).toEqual([]);
  });

  test("modifica: «Togli», «Salva» ed «Elimina»", async ({ page }) => {
    const { dialog } = await edit(page, EDIT_TODO, { thing: TODO_THING });
    for (const name of ["Togli Per Sofia", "Salva", "Elimina cosa da fare"]) {
      expect(
        await missedPoints(dialog.getByRole("button", { name })),
        name,
      ).toEqual([]);
    }
  });

  test("dialogo di eliminazione: i due bottoni", async ({ page }) => {
    const { dialog } = await edit(page, EDIT_DEADLINE, {
      thing: DEADLINE_THING,
    });
    const confirm = await confirmOpen(page, dialog, "Elimina scadenza");
    for (const name of ["Elimina scadenza", "Annulla"]) {
      const button = confirm.getByRole("button", { name });
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      expect(await missedPoints(button), name).toEqual([]);
    }
  });

  test("«Chiudi» e «Riprova» degli stati della lettura", async ({ page }) => {
    await installCasaFakes(page, { thing: TODO_THING, read: "gone" });
    const gone = await open(page, EDIT_TODO, "Modifica");
    expect(
      await missedPoints(gone.getByTestId("aggiungi-gone-chiudi")),
    ).toEqual([]);
    await page.unroute("**/rest/v1/todos*");
    await page.route("**/rest/v1/todos*", (route) =>
      route.fulfill({ status: 500, json: { message: "boom" } }),
    );
    await page.reload();
    const failed = page.getByRole("dialog", { name: "Modifica" });
    await expect(failed.getByRole("alert")).toBeVisible();
    expect(
      await missedPoints(failed.getByRole("button", { name: "Riprova" })),
    ).toEqual([]);
  });
});

test.describe("Aggiungi · Spesa, Da fare, Scadenza: contrasto", () => {
  test("spesa: nome, quantità, «Già in lista» e cerchio", async ({ page }) => {
    await write(page, "Spesa", "latte, pane e 6 uova", { toTake: ["Latte"] });
    expect(await contrastFailures(page)).toEqual([]);
  });

  test("da fare: etichette, visibilità, persone e invio", async ({ page }) => {
    const { dialog } = await write(
      page,
      "Da fare",
      "Laura deve firmare per Sofia entro venerdì",
    );
    expect(await contrastFailures(page)).toEqual([]);
    await dialog.getByRole("button", { name: "Lo vedo solo io" }).click();
    expect(await contrastFailures(page)).toEqual([]);
  });

  test("scadenza: scheda, urgente, senza data, avvisi scelti e non", async ({
    page,
  }) => {
    const { field } = await write(
      page,
      "Scadenza",
      "bollo auto scade il 30 ottobre",
    );
    expect(await contrastFailures(page)).toEqual([]);
    await field.fill("bollo auto");
    await expect(page.getByText("Manca la data")).toBeVisible();
    expect(await contrastFailures(page)).toEqual([]);
  });

  test("errori: del campo e del salvataggio", async ({ page }) => {
    const { dialog, field } = await write(page, "Da fare", "entro venerdì", {
      write: "fail",
    });
    await field.press("Enter");
    await expect(field).toHaveAttribute("aria-invalid", "true");
    expect(await contrastFailures(page)).toEqual([]);
    await field.fill(TODO_PHRASE);
    await dialog.getByRole("button", { name: "Dai a Laura" }).click();
    await expect(dialog.getByRole("alert")).toBeVisible();
    expect(await contrastFailures(page)).toEqual([]);
  });

  test("modifica con «Togli»", async ({ page }) => {
    await edit(page, EDIT_TODO, { thing: TODO_THING });
    expect(await contrastFailures(page)).toEqual([]);
  });

  test("la cosa non c'è più e lettura non riuscita", async ({ page }) => {
    await installCasaFakes(page, { thing: TODO_THING, read: "gone" });
    const dialog = await open(page, EDIT_TODO, "Modifica");
    await expect(dialog.getByText("Questa cosa non c'è più")).toBeVisible();
    expect(await contrastFailures(page)).toEqual([]);
  });

  test("dialogo di eliminazione", async ({ page }) => {
    const { dialog } = await edit(page, EDIT_DEADLINE, {
      thing: DEADLINE_THING,
    });
    await confirmOpen(page, dialog, "Elimina scadenza");
    expect(await contrastFailures(page)).toEqual([]);
  });

  test("toast dopo il salvataggio", async ({ page }) => {
    const { dialog } = await write(page, "Scadenza", DEADLINE_PHRASE);
    const submit = dialog.getByRole("button", {
      name: "Aggiungi alle scadenze",
    });
    await saveWithStoppedClock(
      page,
      dialog,
      submit,
      NOW,
      "Aggiunta alle scadenze",
    );
    expect(await contrastFailures(page)).toEqual([]);
  });
});

// Edit of a thing of the shopping list (#335): name, quantity, people (several
// at once), «Salva» and «Elimina dalla spesa».
const EDIT_SHOPPING = `/aggiungi?tipo=spesa&modifica=${SHOPPING_ID}`;

async function editShopping(page: Page, options: CasaOptions = {}) {
  await installCasaFakes(page, { shopping: SHOPPING_THING, ...options });
  const dialog = await open(page, EDIT_SHOPPING, "Modifica");
  const field = dialog.getByRole("textbox", { name: "Nome", exact: true });
  await expect(field).toBeVisible();
  await expect(field).toBeFocused();
  return { dialog, field };
}

test.describe("Aggiungi · modifica della Spesa", () => {
  test("axe: foglio di modifica e conferma", async ({ page }) => {
    const { dialog } = await editShopping(page);
    expect(await blocking(page, '[role="dialog"]')).toEqual([]);
    expect(await contrastFailures(page)).toEqual([]);
    const confirm = await confirmOpen(page, dialog, "Elimina dalla spesa");
    await expect(
      confirm.getByText("Sparisce dalla spesa di tutto il Nest."),
    ).toBeVisible();
    expect(await blocking(page, '[role="alertdialog"]')).toEqual([]);
  });

  test("axe: la cosa non c'è più", async ({ page }) => {
    await installCasaFakes(page, { shopping: SHOPPING_THING, read: "gone" });
    const dialog = await open(page, EDIT_SHOPPING, "Modifica");
    await expect(dialog.getByText("Questa cosa non c'è più")).toBeVisible();
    expect(await blocking(page, '[role="dialog"]')).toEqual([]);
  });

  test("errori dei campi: nome vuoto e quantità lunga, con aria-describedby", async ({
    page,
  }) => {
    const { dialog, field } = await editShopping(page);
    await field.fill("");
    await dialog.getByRole("button", { name: "Salva", exact: true }).click();
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await expect(field).toHaveAccessibleDescription("Scrivi cosa manca.");
    await expect(field).toBeFocused();
    expect(await blocking(page, '[role="dialog"]')).toEqual([]);

    await field.fill("Latte");
    const quantity = dialog.getByRole("textbox", {
      name: "Quantità",
      exact: true,
    });
    await quantity.fill("1".repeat(21));
    await dialog.getByRole("button", { name: "Salva", exact: true }).click();
    await expect(quantity).toHaveAttribute("aria-invalid", "true");
    await expect(quantity).toHaveAccessibleDescription(
      "La quantità può avere al massimo 20 caratteri.",
    );
    await expect(quantity).toBeFocused();
    expect(await blocking(page, '[role="dialog"]')).toEqual([]);
  });

  test("ordine: nome, quantità, persone, «Salva» ed «Elimina dalla spesa»", async ({
    page,
  }, testInfo) => {
    const { dialog, field } = await editShopping(page);
    await field.focus();
    await page.keyboard.press("Shift+Tab");
    expect(await focused(page)).toBe("Chiudi");
    const { order, rings } = await tabOrder(page, 8);
    const end = isDesktop(testInfo)
      ? ["Elimina dalla spesa", "Salva"]
      : ["Salva", "Elimina dalla spesa"];
    expect(order).toEqual(["Nome", "Quantità", ...PEOPLE, ...end]);
    expect(rings).toEqual(rings.map(() => true));
    const inside = () =>
      dialog.evaluate((el) => el.contains(document.activeElement));
    for (let i = 0; i < 14; i += 1) {
      await page.keyboard.press("Tab");
      expect(await inside()).toBe(true);
    }
  });

  test("più persone si scelgono insieme e un secondo tocco la toglie", async ({
    page,
  }) => {
    const { dialog } = await editShopping(page);
    const who = dialog.getByRole("group", { name: "Chi se ne occupa" });
    const laura = who.getByRole("button", { name: "Laura" });
    const sofia = who.getByRole("button", { name: "Sofia" });
    await laura.click();
    await sofia.click();
    await expect(laura).toHaveAttribute("aria-pressed", "true");
    await expect(sofia).toHaveAttribute("aria-pressed", "true");
    await laura.click();
    await expect(laura).toHaveAttribute("aria-pressed", "false");
    await expect(sofia).toHaveAttribute("aria-pressed", "true");
  });

  test("aree di tocco: persone, «Salva» ed «Elimina dalla spesa»", async ({
    page,
  }) => {
    const { dialog } = await editShopping(page);
    for (const name of ["Tu", "Laura", "Salva", "Elimina dalla spesa"]) {
      expect(
        await missedPoints(dialog.getByRole("button", { name, exact: true })),
        name,
      ).toEqual([]);
    }
  });
});
