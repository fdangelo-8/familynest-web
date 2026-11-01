import { expect, test, type Page } from "@playwright/test";
import { saveWithStoppedClock } from "../fixtures/aggiungi-fake";
import {
  DEADLINE_ID,
  DEADLINE_THING,
  TODO_ID,
  TODO_THING,
  installCasaFakes,
  type CasaOptions,
} from "../fixtures/aggiungi-casa-fake";
import { hasTestUser } from "../fixtures/visual-login";
import { signInAsCached } from "../fixtures/visual-login-cached";

// Aggiungi · Spesa, Da fare e Scadenza, and the edit of a thing (#22, PR #203):
// one screenshot per state, at 390 and 1280 px (projects). Needs test user A
// (Marco, Casa D'Angelo: Laura, Sofia, Tommaso, Biscotto); without TEST_USER_A_*
// the tests are skipped. The references are generated in the CI container
// (workflow visual-baseline).
//
// Nothing is written to the database: the shopping list, the todos and the
// deadlines are served by fakes (fixtures/aggiungi-casa-fake.ts). Sign-in, the
// Nest and its members are real. The page under the veil (Today) is hidden:
// it has real, changing content and is covered by layout.spec.ts.

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

// Tuesday 20 October 2026, 15:52 in Rome (CEST)
const NOW = new Date("2026-10-20T15:52:00+02:00");
const TODO_PHRASE = "Laura deve chiamare la nonna entro venerdì";
const DEADLINE_PHRASE = "bollo auto scade il 7 dicembre";
const EDIT_TODO = `/aggiungi?modifica=${TODO_ID}&tipo=da-fare`;
const EDIT_DEADLINE = `/aggiungi?modifica=${DEADLINE_ID}&tipo=scadenza`;

test.beforeEach(async ({ page, context, baseURL }) => {
  test.skip(!hasTestUser("A"), "TEST_USER_A_* non impostati");
  const signedIn = await signInAsCached(context, baseURL!, "A");
  test.skip(!signedIn, "utente di test A non ancora creato (#55)");
  await page.clock.install({ time: NOW });
});

/** Opens the sheet over Today (a new thing, or the edit when the name is «Modifica»). */
async function open(page: Page, url: string, name = "Aggiungi") {
  await page.goto(url);
  const dialog = page.getByRole("dialog", { name });
  await expect(dialog).toBeVisible({ timeout: 20_000 });
  await page.addStyleTag({
    content: "main:not(:has([role=dialog])) { visibility: hidden; }",
  });
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

/** Two animation frames: the page has drawn what the last change asked for. */
async function settle(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

/** The pointer away: the shot shows the resting state. */
async function shoot(page: Page, name: string, clockStopped = false) {
  await page.mouse.move(0, 0);
  // With the clock stopped there are no animation frames to wait for
  if (!clockStopped) await settle(page);
  await expect(page).toHaveScreenshot(name);
}

test.describe("Spesa", () => {
  test("anteprima con una cosa già in lista", async ({ page }) => {
    const { dialog } = await write(page, "Spesa", "latte, pane e 6 uova", {
      toTake: ["Latte"],
    });
    await expect(dialog.getByTestId("aggiungi-spesa")).toBeVisible();
    await expect(dialog.getByText("Già in lista")).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Aggiungi 2 cose" }),
    ).toBeVisible();
    await shoot(page, "spesa-anteprima.png");
  });

  test("tutto già in lista", async ({ page }) => {
    const { dialog } = await write(page, "Spesa", "latte", {
      toTake: ["Latte"],
    });
    await expect(
      dialog.getByRole("button", { name: "Già tutto in lista" }),
    ).toBeDisabled();
    await shoot(page, "spesa-tutto-in-lista.png");
  });

  test("toast dopo il salvataggio", async ({ page }) => {
    const { dialog } = await write(page, "Spesa", "latte, pane e 6 uova");
    const submit = dialog.getByRole("button", { name: "Aggiungi 3 cose" });
    await saveWithStoppedClock(
      page,
      dialog,
      submit,
      NOW,
      "aggiunte alla spesa",
    );
    await shoot(page, "spesa-toast.png", true);
  });
});

test.describe("Da fare", () => {
  test("etichette, visibilità e chi se ne occupa", async ({ page }) => {
    const { dialog } = await write(page, "Da fare", TODO_PHRASE);
    await expect(
      dialog.getByRole("button", { name: "Dai a Laura" }),
    ).toBeVisible();
    await expect(dialog.getByTestId("aggiungi-visibilita")).toHaveText(
      "Lo vede tutto il Nest",
    );
    await shoot(page, "da-fare.png");
  });

  test("solo io", async ({ page }) => {
    const { dialog } = await write(page, "Da fare", TODO_PHRASE);
    await dialog.getByTestId("aggiungi-visibilita").click();
    await expect(dialog.getByTestId("aggiungi-visibilita")).toHaveText(
      "Lo vedi solo tu",
    );
    await shoot(page, "da-fare-solo-io.png");
  });

  test("errore del campo", async ({ page }) => {
    const { field } = await write(page, "Da fare", "entro venerdì");
    await field.press("Enter");
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await shoot(page, "da-fare-errore-campo.png");
  });

  test("salvataggio in corso", async ({ page }) => {
    const { dialog } = await write(page, "Da fare", TODO_PHRASE, {
      write: "hold",
    });
    const submit = dialog.getByRole("button", { name: "Dai a Laura" });
    await submit.click();
    await expect(submit).toHaveAttribute("aria-busy", "true");
    await shoot(page, "da-fare-salvataggio-in-corso.png");
  });

  test("salvataggio non riuscito", async ({ page }) => {
    const { dialog } = await write(page, "Da fare", TODO_PHRASE, {
      write: "fail",
    });
    await dialog.getByRole("button", { name: "Dai a Laura" }).click();
    await expect(dialog.getByRole("alert")).toContainText(
      "Non siamo riusciti a salvare",
    );
    await shoot(page, "da-fare-salvataggio-non-riuscito.png");
  });

  test("toast dopo il salvataggio", async ({ page }) => {
    const { dialog } = await write(page, "Da fare", TODO_PHRASE);
    const submit = dialog.getByRole("button", { name: "Dai a Laura" });
    await saveWithStoppedClock(page, dialog, submit, NOW, "Dato a Laura");
    await shoot(page, "da-fare-toast.png", true);
  });
});

test.describe("Scadenza", () => {
  test("scheda, avvisi e chi se ne occupa", async ({ page }) => {
    const { dialog } = await write(page, "Scadenza", DEADLINE_PHRASE);
    await expect(
      dialog.getByTestId("aggiungi-scadenza-anteprima"),
    ).toContainText("Lunedì 7 dicembre");
    await expect(
      dialog.getByRole("button", { name: "Aggiungi alle scadenze" }),
    ).toBeVisible();
    await shoot(page, "scadenza.png");
  });

  test("scheda urgente", async ({ page }) => {
    const { dialog } = await write(
      page,
      "Scadenza",
      "bollo auto scade il 30 ottobre",
    );
    await expect(
      dialog.getByTestId("aggiungi-scadenza-anteprima"),
    ).toContainText("urgente");
    await shoot(page, "scadenza-urgente.png");
  });

  test("senza la data", async ({ page }) => {
    const { dialog } = await write(page, "Scadenza", "bollo auto");
    await expect(
      dialog.getByTestId("aggiungi-scadenza-anteprima"),
    ).toContainText("Manca la data");
    await shoot(page, "scadenza-senza-data.png");
  });

  test("campo vuoto aperto dall'indirizzo con il tipo", async ({ page }) => {
    await installCasaFakes(page);
    const dialog = await open(page, "/aggiungi?tipo=scadenza");
    await expect(
      dialog.getByRole("textbox", { name: "Cosa vuoi aggiungere?" }),
    ).toHaveAttribute("placeholder", "Cosa scade, e quando?");
    await shoot(page, "scadenza-vuoto.png");
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
    await shoot(page, "scadenza-toast.png", true);
  });
});

test.describe("Modifica", () => {
  test("cosa da fare", async ({ page }) => {
    await edit(page, EDIT_TODO, { thing: TODO_THING });
    await expect(
      page.getByRole("button", { name: "Togli la data" }),
    ).toBeVisible();
    await shoot(page, "modifica-da-fare.png");
  });

  test("scadenza", async ({ page }) => {
    await edit(page, EDIT_DEADLINE, { thing: DEADLINE_THING });
    await expect(
      page.getByRole("button", { name: "Elimina scadenza" }),
    ).toBeVisible();
    await shoot(page, "modifica-scadenza.png");
  });

  test("lettura in corso", async ({ page }) => {
    await installCasaFakes(page, { thing: TODO_THING, read: "hold" });
    const dialog = await open(page, EDIT_TODO, "Modifica");
    await expect(dialog.getByTestId("aggiungi-caricamento")).toBeVisible();
    await shoot(page, "modifica-caricamento.png");
  });

  test("la cosa non c'è più", async ({ page }) => {
    await installCasaFakes(page, { thing: TODO_THING, read: "gone" });
    const dialog = await open(page, EDIT_TODO, "Modifica");
    await expect(dialog.getByText("Questa cosa non c'è più")).toBeVisible();
    await shoot(page, "modifica-non-c-e-piu.png");
  });

  test("lettura non riuscita", async ({ page }) => {
    await installCasaFakes(page, { thing: TODO_THING, read: "fail" });
    const dialog = await open(page, EDIT_TODO, "Modifica");
    await expect(dialog.getByRole("alert")).toContainText(
      "Non riusciamo a caricare questa cosa",
    );
    await shoot(page, "modifica-lettura-non-riuscita.png");
  });

  test("salvando, la cosa non c'è più", async ({ page }) => {
    const { dialog, field } = await edit(page, EDIT_TODO, {
      thing: TODO_THING,
      write: "gone",
    });
    await field.press("End");
    await field.pressSequentially(" subito");
    await dialog.getByRole("button", { name: "Salva" }).click();
    await expect(dialog.getByRole("alert")).toContainText(
      "Questa cosa non c'è più",
    );
    await shoot(page, "modifica-non-c-e-piu-salvando.png");
  });

  test("toast dopo il salvataggio", async ({ page }) => {
    const { dialog, field } = await edit(page, EDIT_TODO, {
      thing: TODO_THING,
    });
    await field.press("End");
    await field.pressSequentially(" subito");
    const submit = dialog.getByRole("button", { name: "Salva" });
    await saveWithStoppedClock(page, dialog, submit, NOW, "Modifiche salvate");
    await shoot(page, "modifica-toast.png", true);
  });
});

test.describe("Eliminazione", () => {
  test("conferma", async ({ page }) => {
    const { dialog } = await edit(page, EDIT_TODO, { thing: TODO_THING });
    await dialog.getByRole("button", { name: "Elimina cosa da fare" }).click();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm).toContainText(
      "Eliminare «Firmare autorizzazione gita»?",
    );
    await expect(confirm).toContainText(
      "Sparisce dalla lista di tutto il Nest.",
    );
    await shoot(page, "elimina-conferma.png");
  });

  test("scadenza", async ({ page }) => {
    const { dialog } = await edit(page, EDIT_DEADLINE, {
      thing: DEADLINE_THING,
    });
    await dialog.getByRole("button", { name: "Elimina scadenza" }).click();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm).toContainText("Eliminare «Bollo auto»?");
    await shoot(page, "elimina-scadenza.png");
  });

  test("non riuscita", async ({ page }) => {
    const { dialog } = await edit(page, EDIT_TODO, {
      thing: TODO_THING,
      remove: "fail",
    });
    await dialog.getByRole("button", { name: "Elimina cosa da fare" }).click();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm).toBeVisible();
    // Time stops: the toast (5 seconds) stays on screen
    await page.clock.pauseAt(new Date(NOW.getTime() + 10 * 60_000));
    await confirm.getByRole("button", { name: "Elimina cosa da fare" }).click();
    await expect(page.locator(".toast")).toContainText(
      "Non siamo riusciti a eliminare",
    );
    await shoot(page, "elimina-non-riuscita.png", true);
  });
});
