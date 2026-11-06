import { type Page } from "@playwright/test";
import { expect, test, CORS, type CasaNest } from "../fixtures/casa";
import {
  confirmOf,
  expectNames,
  openCasaPage,
  openDirect,
  secondBrowser,
  sheet,
  shoppingOf,
  toastOf,
  toastWith,
} from "../fixtures/aggiungi-casa";
import { waitForAnimationsToEnd } from "../fixtures/animations";

// Aggiungi · modifica della Spesa (#335): CA-1 ... CA-31. Every test builds its
// own throwaway Nests (fixtures `casa` = Casa D'Angelo, `bianchi` = Casa Bianchi)
// and creates its data with the session of a member (RLS applies). The sheet
// opens from the name of a row of Casa · Spesa (button «Modifica: <nome>») or
// from `/aggiungi?tipo=spesa&modifica=<id>`. «Chi se ne occupa» is a multiple
// choice (decision 5 of #333).

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

const GONE_ALERT = "Questa cosa non c'è più. Forse l'ha tolta qualcun altro.";
const SAVE_FAILED_ALERT =
  "Non siamo riusciti a salvare. Controlla la connessione e riprova.";
const DELETE_FAILED =
  "Non siamo riusciti a eliminare. Riprova tra qualche secondo.";
const UNDO_FAILED =
  "Non siamo riusciti ad annullare. Le modifiche sono rimaste.";
const LOAD_FAILED =
  "Non riusciamo a caricare questa cosa. Controlla la connessione e riprova.";

// ------------------------------------------------------------------ helpers

type Seed = { name: string; quantity?: string; assignees?: string[] };

function clientOf(nest: CasaNest, who: string) {
  const user = nest.users[who];
  if (!user) throw new Error(`${who} non ha un account di prova`);
  return user.client;
}

/** Adds things in order with the session of `who`, then sets their people. */
async function seed(nest: CasaNest, who: string, items: Seed[]): Promise<void> {
  const client = clientOf(nest, who);
  for (const item of items) {
    const { error } = await client
      .from("shopping_items")
      .insert({ name: item.name, quantity: item.quantity ?? null });
    if (error) throw new Error("Cosa da prendere di prova non aggiunta");
  }
  const rows = await shoppingOf(nest, who);
  for (const item of items) {
    if (!item.assignees) continue;
    const id = idOf(rows, item.name);
    const { error } = await client.rpc("update_shopping_item", {
      p_item_id: id,
      p_name: item.name,
      p_quantity: item.quantity ?? "",
      p_assignee_member_ids: item.assignees.map((n) => nest.members[n]!),
    });
    if (error) throw new Error("Persone di prova non assegnate");
  }
}

function idOf(rows: { id: string; name: string }[], name: string): string {
  const row = rows.find((r) => r.name === name);
  if (!row) throw new Error("Cosa di prova non trovata");
  return row.id;
}

async function itemOf(nest: CasaNest, who: string, name: string) {
  const rows = await shoppingOf(nest, who);
  return rows.find((r) => r.name === name);
}

/** The member ids that take care of a thing (RLS applies). */
async function carersOf(
  nest: CasaNest,
  who: string,
  id: string,
): Promise<string[]> {
  const { data, error } = await clientOf(nest, who)
    .from("shopping_item_assignees")
    .select("member_id")
    .eq("shopping_item_id", id);
  if (error) throw new Error("Lettura delle persone di prova fallita");
  return (data ?? []).map((row) => row.member_id);
}

const toTake = (page: Page) => page.getByTestId("spesa-da-prendere");
const taken = (page: Page) => page.getByTestId("spesa-presi");
const titlesOf = (scope: ReturnType<typeof toTake>) =>
  scope.locator(".riga-lista__titolo");
const rowOf = (page: Page, name: string) =>
  toTake(page)
    .getByRole("listitem")
    .filter({
      has: page.getByRole("button", { name: `Modifica: ${name}`, exact: true }),
    });

const editSheet = (page: Page) => {
  const s = sheet(page, "edit");
  const nameField = s.dialog.getByRole("textbox", {
    name: "Nome",
    exact: true,
  });
  const quantity = s.dialog.getByRole("textbox", {
    name: "Quantità",
    exact: true,
  });
  return {
    ...s,
    nameField,
    quantity,
    /** Error under the name (the field's description) */
    expectNameError: async (text: string) => {
      await expect(nameField).toHaveAttribute("aria-invalid", "true");
      await expect(nameField).toHaveAccessibleDescription(text);
    },
  };
};

async function waitForEditSheet(page: Page): Promise<void> {
  const s = editSheet(page);
  await expect(s.dialog).toBeVisible({ timeout: 20_000 });
  await expect(s.nameField).toBeVisible();
  await waitForAnimationsToEnd(page);
}

/** Taps the name of a row of Casa · Spesa until the edit sheet is open. */
async function tapRow(page: Page, name: string): Promise<void> {
  const button = page.getByRole("button", {
    name: `Modifica: ${name}`,
    exact: true,
  });
  await expect(button).toBeVisible({ timeout: 20_000 });
  await expect(async () => {
    await button.click();
    await expect(editSheet(page).dialog).toBeVisible({ timeout: 2000 });
  }).toPass();
  await waitForEditSheet(page);
}

async function openSpesaEdit(
  page: Page,
  baseURL: string | undefined,
  nest: CasaNest,
  who: string,
  name: string,
): Promise<void> {
  await openCasaPage(page, baseURL, nest, who, "/casa/spesa");
  await tapRow(page, name);
}

const editUrl = (id: string) => `/aggiungi?tipo=spesa&modifica=${id}`;

async function openDirectEdit(
  page: Page,
  baseURL: string | undefined,
  nest: CasaNest,
  who: string,
  id: string,
  ready?: (page: Page) => ReturnType<Page["locator"]>,
): Promise<void> {
  await openDirect(page, baseURL, nest, who, editUrl(id), {
    mode: "edit",
    ready: ready ?? ((p) => editSheet(p).nameField),
  });
}

/** Fails the function `name` with a database error while `failing()` is true. */
async function failRpc(
  page: Page,
  name: string,
  failing: () => boolean = () => true,
): Promise<void> {
  await page.route(
    (url) => url.pathname.endsWith(`/rest/v1/rpc/${name}`),
    async (route) => {
      if (route.request().method() !== "POST" || !failing()) {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        headers: CORS,
        body: JSON.stringify({ code: "XX000", message: "boom" }),
      });
    },
  );
}

/** Writes (POST, PATCH, DELETE) the page sends to the data API. */
function recordWrites(page: Page): () => string[] {
  const seen: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (
      url.pathname.includes("/rest/v1/") &&
      ["POST", "PATCH", "DELETE"].includes(request.method())
    ) {
      seen.push(`${request.method()} ${url.pathname}`);
    }
  });
  return () => seen;
}

// ---------------------------------------------------------------- Apertura

test.describe("Aggiungi · modifica della Spesa · apertura", () => {
  test("CA-1: «Modifica: Latte» apre il foglio con nome, quantità e nessuna persona scelta", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seed(casa, "Marco", [{ name: "Latte", quantity: "2 l" }]);
    const item = await itemOf(casa, "Marco", "Latte");
    await openSpesaEdit(page, baseURL, casa, "Marco", "Latte");

    await expect(page).toHaveURL(
      new RegExp(`/aggiungi\\?tipo=spesa&modifica=${item!.id}$`),
    );
    const s = editSheet(page);
    await expect(
      s.dialog.getByRole("heading", { name: "Modifica" }),
    ).toBeVisible();
    await expect(s.types).toHaveCount(0);
    await expect(s.visibility).toHaveCount(0);
    await expect(s.nameField).toHaveValue("Latte");
    await expect(s.quantity).toHaveValue("2 l");
    for (const person of ["Tu", "Laura", "Sofia", "Tommaso"]) {
      await expect(s.person(person)).toHaveAttribute("aria-pressed", "false");
    }
    await expect(s.button("Salva")).toBeVisible();
    await expect(s.button("Elimina dalla spesa")).toBeVisible();
  });

  test("CA-2: su desktop si apre la modale «Modifica» dalla colonna «Spesa»", async ({
    page,
    baseURL,
    casa,
  }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "Solo desktop");
    await seed(casa, "Marco", [{ name: "Latte", quantity: "2 l" }]);
    await openCasaPage(page, baseURL, casa, "Marco", "/casa/spesa");
    await page
      .getByRole("region", { name: "Spesa" })
      .getByRole("button", { name: "Modifica: Latte", exact: true })
      .click();
    await waitForEditSheet(page);
    const s = editSheet(page);
    await expect(s.nameField).toHaveValue("Latte");
    await expect(s.quantity).toHaveValue("2 l");
  });

  test("CA-3: il cerchio «Preso: Latte» sposta la riga in «Presi» e non apre il foglio", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seed(casa, "Marco", [{ name: "Latte" }]);
    await openCasaPage(page, baseURL, casa, "Marco", "/casa/spesa");
    await page.getByRole("checkbox", { name: "Preso: Latte" }).click();

    await expect(titlesOf(taken(page))).toHaveText(["Latte"]);
    await expect(editSheet(page).dialog).toHaveCount(0);
  });

  test("CA-4: una cosa in «Presi» non ha il bottone «Modifica: Uova»", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seed(casa, "Marco", [{ name: "Uova" }]);
    const uova = await itemOf(casa, "Marco", "Uova");
    const { error } = await clientOf(casa, "Marco")
      .from("shopping_items")
      .update({ checked_at: new Date().toISOString() })
      .eq("id", uova!.id);
    expect(error).toBeNull();
    await openCasaPage(page, baseURL, casa, "Marco", "/casa/spesa");

    await expect(titlesOf(taken(page))).toHaveText(["Uova"]);
    await expect(
      page.getByRole("button", { name: "Modifica: Uova" }),
    ).toHaveCount(0);
  });

  test("CA-5: le persone sono «Tu», «Laura», «Sofia», «Tommaso» e non c'è «Biscotto»", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seed(casa, "Marco", [{ name: "Latte" }]);
    await openSpesaEdit(page, baseURL, casa, "Marco", "Latte");

    await expectNames(editSheet(page).who, ["Tu", "Laura", "Sofia", "Tommaso"]);
  });
});

// ---------------------------------------------------------------- Modifica

test.describe("Aggiungi · modifica della Spesa · salvataggio", () => {
  test("CA-6: nome ripulito e quantità nuova, toast con «Annulla», riga al suo posto anche dopo il ricaricamento", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seed(casa, "Marco", [
      { name: "Latte", quantity: "2 l" },
      { name: "Pane" },
    ]);
    await openSpesaEdit(page, baseURL, casa, "Marco", "Latte");
    const s = editSheet(page);
    await s.nameField.fill("  Latte   di soia ");
    await s.quantity.fill("1 l");
    await s.button("Salva").click();

    await expect(s.dialog).toHaveCount(0);
    const toast = toastWith(page, "Modifiche salvate.");
    await expect(toast).toBeVisible();
    await expect(toast.getByRole("button", { name: "Annulla" })).toBeVisible();
    await expect(titlesOf(toTake(page))).toHaveText(["Latte di soia", "Pane"]);
    await expect(rowOf(page, "Latte di soia")).toContainText("1 l");
    await expect(
      page.getByRole("button", { name: "Modifica: Latte di soia" }),
    ).toBeFocused();

    await page.reload();
    await expect(titlesOf(toTake(page))).toHaveText(["Latte di soia", "Pane"]);
    await expect(rowOf(page, "Latte di soia")).toContainText("1 l");
  });

  test("CA-7: con la quantità svuotata il database ha «quantity» nullo", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seed(casa, "Marco", [{ name: "Latte", quantity: "2 l" }]);
    await openSpesaEdit(page, baseURL, casa, "Marco", "Latte");
    const s = editSheet(page);
    await s.quantity.fill("");
    await s.button("Salva").click();

    await expect(toastWith(page, "Modifiche salvate.")).toBeVisible();
    await expect
      .poll(async () => (await itemOf(casa, "Marco", "Latte"))?.quantity)
      .toBeNull();
    await expect(
      rowOf(page, "Latte").locator(".riga-lista__quantita"),
    ).toHaveText("");
  });

  test("CA-8: «Salva» senza cambiare niente chiude il foglio, senza toast e senza scritture", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seed(casa, "Marco", [{ name: "Latte", quantity: "2 l" }]);
    await openSpesaEdit(page, baseURL, casa, "Marco", "Latte");
    const writes = recordWrites(page);
    await editSheet(page).button("Salva").click();

    await expect(editSheet(page).dialog).toHaveCount(0);
    await expect(toastOf(page)).toHaveCount(0);
    expect(writes()).toEqual([]);
    expect((await itemOf(casa, "Marco", "Latte"))?.quantity).toBe("2 l");
  });

  test("CA-9: «Annulla» rimette i valori di prima e non mostra un secondo toast", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seed(casa, "Marco", [{ name: "Latte", quantity: "2 l" }]);
    await openSpesaEdit(page, baseURL, casa, "Marco", "Latte");
    const s = editSheet(page);
    await s.nameField.fill("Latte di soia");
    await s.quantity.fill("1 l");
    await s.button("Salva").click();
    // The sheet has left (the page below is /casa/spesa again) before undoing
    await expect(s.dialog).toHaveCount(0);
    const toast = toastWith(page, "Modifiche salvate.");
    await toast.getByRole("button", { name: "Annulla" }).click();

    await expect(titlesOf(toTake(page))).toHaveText(["Latte"]);
    await expect(rowOf(page, "Latte")).toContainText("2 l");
    await expect(toastOf(page)).toHaveCount(0);

    await page.reload();
    await expect(titlesOf(toTake(page))).toHaveText(["Latte"]);
    await expect(rowOf(page, "Latte")).toContainText("2 l");
    expect(
      await carersOf(casa, "Marco", (await itemOf(casa, "Marco", "Latte"))!.id),
    ).toEqual([]);
  });

  test("CA-10: se «Annulla» non riesce compare il testo d'errore senza «Annulla» e la riga resta modificata", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seed(casa, "Marco", [{ name: "Latte", quantity: "2 l" }]);
    await openSpesaEdit(page, baseURL, casa, "Marco", "Latte");
    let failing = false;
    await failRpc(page, "update_shopping_item", () => failing);
    const s = editSheet(page);
    await s.nameField.fill("Latte di soia");
    await s.button("Salva").click();
    const saved = toastWith(page, "Modifiche salvate.");
    await expect(saved).toBeVisible();
    failing = true;
    await saved.getByRole("button", { name: "Annulla" }).click();

    const failed = toastWith(page, UNDO_FAILED);
    await expect(failed).toBeVisible();
    await expect(failed.getByRole("button", { name: "Annulla" })).toHaveCount(
      0,
    );
    await expect(titlesOf(toTake(page))).toHaveText(["Latte di soia"]);
  });
});

// ------------------------------------------------------ Errori di compilazione

test.describe("Aggiungi · modifica della Spesa · errori di compilazione", () => {
  test("CA-11: nome vuoto, «Scrivi cosa manca.» sotto il campo e niente cambia", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seed(casa, "Marco", [{ name: "Latte" }]);
    await openSpesaEdit(page, baseURL, casa, "Marco", "Latte");
    const s = editSheet(page);
    await s.nameField.fill("");
    await s.button("Salva").click();

    await s.expectNameError("Scrivi cosa manca.");
    await expect(s.dialog).toBeVisible();
    expect(await itemOf(casa, "Marco", "Latte")).toBeDefined();
  });

  test("CA-12: nome di 81 caratteri e quantità di 21 caratteri danno i due errori", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seed(casa, "Marco", [{ name: "Latte" }]);
    await openSpesaEdit(page, baseURL, casa, "Marco", "Latte");
    const s = editSheet(page);
    await s.nameField.fill("a".repeat(81));
    await s.button("Salva").click();
    await s.expectNameError("Il nome può avere al massimo 80 caratteri.");

    await s.nameField.fill("Latte");
    await s.quantity.fill("1".repeat(21));
    await s.button("Salva").click();
    await expect(s.quantity).toHaveAttribute("aria-invalid", "true");
    await expect(s.quantity).toHaveAccessibleDescription(
      "La quantità può avere al massimo 20 caratteri.",
    );
    await expect(s.dialog).toBeVisible();
    expect(await itemOf(casa, "Marco", "Latte")).toBeDefined();
    expect((await shoppingOf(casa, "Marco")).map((r) => r.name)).toEqual([
      "Latte",
    ]);
  });

  test("CA-13: un nome uguale a un'altra cosa da prendere, senza maiuscole, dà «Latte è già in lista.»", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seed(casa, "Marco", [{ name: "Latte" }, { name: "Pane" }]);
    await openSpesaEdit(page, baseURL, casa, "Marco", "Pane");
    const s = editSheet(page);
    await s.nameField.fill("latte");
    await s.button("Salva").click();

    await s.expectNameError("Latte è già in lista.");
    await expect(s.dialog).toBeVisible();
    expect((await shoppingOf(casa, "Marco")).map((r) => r.name).sort()).toEqual(
      ["Latte", "Pane"],
    );
  });

  test("CA-14: un nome presente solo in «Presi», o le sole maiuscole cambiate, si salvano", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seed(casa, "Marco", [{ name: "Uova" }, { name: "Pane" }]);
    const uova = await itemOf(casa, "Marco", "Uova");
    await clientOf(casa, "Marco")
      .from("shopping_items")
      .update({ checked_at: new Date().toISOString() })
      .eq("id", uova!.id);
    await openSpesaEdit(page, baseURL, casa, "Marco", "Pane");
    const s = editSheet(page);
    await s.nameField.fill("uova");
    await s.button("Salva").click();
    await expect(s.dialog).toHaveCount(0);
    await expect(toastWith(page, "Modifiche salvate.")).toBeVisible();
    await expect(titlesOf(toTake(page))).toHaveText(["uova"]);

    await tapRow(page, "uova");
    await s.nameField.fill("UOVA");
    await s.button("Salva").click();
    // No error under the name: the sheet closes and the row has the new name
    await expect(s.dialog).toHaveCount(0);
    await expect(titlesOf(toTake(page))).toHaveText(["UOVA"]);
  });
});

// -------------------------------------------------------------- Assegnazione

test.describe("Aggiungi · modifica della Spesa · chi se ne occupa", () => {
  test("CA-15: scegliere «Laura» mostra il suo avatar e il testo nascosto; il database ha la sua riga", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seed(casa, "Marco", [{ name: "Latte", quantity: "2 l" }]);
    await openSpesaEdit(page, baseURL, casa, "Marco", "Latte");
    const s = editSheet(page);
    await s.person("Laura").click();
    await expect(s.person("Laura")).toHaveAttribute("aria-pressed", "true");
    await s.button("Salva").click();

    const row = toTake(page).getByRole("listitem").filter({ hasText: "Latte" });
    await expect(row.locator(".avatar")).toHaveText("L");
    await expect(row).toContainText(", se ne occupa Laura");
    const item = await itemOf(casa, "Marco", "Latte");
    await expect
      .poll(() => carersOf(casa, "Marco", item!.id))
      .toEqual([casa.members["Laura"]]);
  });

  test("CA-16: «Laura» è già scelta; un secondo tocco la toglie e torna l'avatar di chi l'ha aggiunta", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seed(casa, "Marco", [{ name: "Latte", assignees: ["Laura"] }]);
    await openSpesaEdit(page, baseURL, casa, "Marco", "Latte");
    const s = editSheet(page);
    await expect(s.person("Laura")).toHaveAttribute("aria-pressed", "true");
    await s.person("Laura").click();
    await s.button("Salva").click();

    const row = toTake(page).getByRole("listitem").filter({ hasText: "Latte" });
    await expect(row.locator(".avatar")).toHaveText("M");
    const item = await itemOf(casa, "Marco", "Latte");
    await expect.poll(() => carersOf(casa, "Marco", item!.id)).toEqual([]);
  });

  test("più persone insieme: si possono scegliere «Laura» e «Sofia»", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seed(casa, "Marco", [{ name: "Latte" }]);
    await openSpesaEdit(page, baseURL, casa, "Marco", "Latte");
    const s = editSheet(page);
    await s.person("Laura").click();
    await s.person("Sofia").click();
    await expect(s.person("Laura")).toHaveAttribute("aria-pressed", "true");
    await expect(s.person("Sofia")).toHaveAttribute("aria-pressed", "true");
    await s.button("Salva").click();

    const row = toTake(page).getByRole("listitem").filter({ hasText: "Latte" });
    await expect(row.locator(".avatar")).toHaveText(["L", "S"]);
    await expect(row).toContainText(", se ne occupano Laura e Sofia");
    const item = await itemOf(casa, "Marco", "Latte");
    await expect
      .poll(async () => (await carersOf(casa, "Marco", item!.id)).sort())
      .toEqual([casa.members["Laura"]!, casa.members["Sofia"]!].sort());
  });

  test("CA-17: quello che Giulia cambia compare da Paolo entro 5 secondi, senza ricaricare", async ({
    page,
    browser,
    baseURL,
    bianchi,
  }, testInfo) => {
    await seed(bianchi, "Giulia", [{ name: "Mele" }]);
    await openCasaPage(page, baseURL, bianchi, "Paolo", "/casa/spesa");
    await expect(titlesOf(toTake(page))).toHaveText(["Mele"]);
    const giulia = await secondBrowser(
      browser,
      baseURL,
      testInfo.project.use.viewport,
    );
    try {
      await openSpesaEdit(giulia.page, baseURL, bianchi, "Giulia", "Mele");
      const s = editSheet(giulia.page);
      await s.nameField.fill("Mele rosse");
      await s.person("Paolo").click();
      await s.button("Salva").click();
      await expect(toastWith(giulia.page, "Modifiche salvate.")).toBeVisible();

      await expect(titlesOf(toTake(page))).toHaveText(["Mele rosse"], {
        timeout: 5000,
      });
      await expect(toTake(page).locator(".avatar")).toHaveText(["P"], {
        timeout: 5000,
      });
    } finally {
      await giulia.context.close();
    }
  });
});

// ------------------------------------------------------------- Cancellazione

test.describe("Aggiungi · modifica della Spesa · cancellazione", () => {
  test("CA-18: «Elimina dalla spesa» apre la conferma con titolo, testo e bottoni", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seed(casa, "Marco", [{ name: "Latte" }]);
    await openSpesaEdit(page, baseURL, casa, "Marco", "Latte");
    await editSheet(page).button("Elimina dalla spesa").click();

    const confirm = confirmOf(page, "Latte");
    await expect(confirm).toBeVisible();
    await expect(
      confirm.getByText("Sparisce dalla spesa di tutto il Nest."),
    ).toBeVisible();
    await expect(
      confirm.getByRole("button", { name: "Elimina dalla spesa", exact: true }),
    ).toBeVisible();
    await expect(
      confirm.getByRole("button", { name: "Annulla", exact: true }),
    ).toBeVisible();
  });

  test("CA-19: confermando, il foglio si chiude, il toast non ha «Annulla» e «Latte» non c'è più", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seed(casa, "Marco", [{ name: "Latte" }, { name: "Pane" }]);
    await openSpesaEdit(page, baseURL, casa, "Marco", "Latte");
    await editSheet(page).button("Elimina dalla spesa").click();
    await confirmOf(page, "Latte")
      .getByRole("button", { name: "Elimina dalla spesa", exact: true })
      .click();

    await expect(editSheet(page).dialog).toHaveCount(0);
    const toast = toastWith(page, "Eliminato: Latte.");
    await expect(toast).toBeVisible();
    await expect(toast.getByRole("button", { name: "Annulla" })).toHaveCount(0);
    await expect(titlesOf(toTake(page))).toHaveText(["Pane"]);
    await expect(
      page.getByRole("heading", { level: 3, name: "Da prendere" }),
    ).toBeFocused();

    await page.reload();
    await expect(titlesOf(toTake(page))).toHaveText(["Pane"]);
  });

  test("CA-20: «Annulla» nella conferma chiude solo la conferma", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seed(casa, "Marco", [{ name: "Latte" }]);
    await openSpesaEdit(page, baseURL, casa, "Marco", "Latte");
    await editSheet(page).button("Elimina dalla spesa").click();
    await confirmOf(page, "Latte")
      .getByRole("button", { name: "Annulla", exact: true })
      .click();

    await expect(confirmOf(page, "Latte")).toHaveCount(0);
    await expect(editSheet(page).dialog).toBeVisible();
    expect(await itemOf(casa, "Marco", "Latte")).toBeDefined();
  });

  test("CA-21: se l'eliminazione fallisce la conferma resta aperta con il testo d'errore", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seed(casa, "Marco", [{ name: "Latte" }]);
    await openSpesaEdit(page, baseURL, casa, "Marco", "Latte");
    await page.route(
      (url) => url.pathname.endsWith("/rest/v1/shopping_items"),
      async (route) => {
        if (route.request().method() !== "DELETE") {
          await route.continue();
          return;
        }
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          headers: CORS,
          body: JSON.stringify({ code: "XX000", message: "boom" }),
        });
      },
    );
    await editSheet(page).button("Elimina dalla spesa").click();
    const confirm = confirmOf(page, "Latte");
    await confirm
      .getByRole("button", { name: "Elimina dalla spesa", exact: true })
      .click();

    await expect(confirm).toBeVisible();
    await expect(confirm.getByText(DELETE_FAILED)).toBeVisible();
    expect(await itemOf(casa, "Marco", "Latte")).toBeDefined();
  });

  test("CA-22: eliminata l'unica cosa, la spesa mostra lo stato vuoto e il fuoco va su «Le più comuni»", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seed(casa, "Marco", [{ name: "Latte" }]);
    await openSpesaEdit(page, baseURL, casa, "Marco", "Latte");
    await editSheet(page).button("Elimina dalla spesa").click();
    await confirmOf(page, "Latte")
      .getByRole("button", { name: "Elimina dalla spesa", exact: true })
      .click();

    await expect(
      page.getByText("Una lista per tutta la casa", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 3, name: "Le più comuni" }),
    ).toBeFocused();
  });
});

// ------------------------------------------------------------------ Permessi

test.describe("Aggiungi · modifica della Spesa · permessi", () => {
  test("CA-23: Giulia rinomina ed elimina la cosa aggiunta da Paolo; Paolo non la vede più", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await seed(bianchi, "Paolo", [{ name: "Mele" }]);
    await openSpesaEdit(page, baseURL, bianchi, "Giulia", "Mele");
    const s = editSheet(page);
    await s.nameField.fill("Mele verdi");
    await s.button("Salva").click();
    await expect(toastWith(page, "Modifiche salvate.")).toBeVisible();
    await expect(titlesOf(toTake(page))).toHaveText(["Mele verdi"]);

    await tapRow(page, "Mele verdi");
    await s.button("Elimina dalla spesa").click();
    await confirmOf(page, "Mele verdi")
      .getByRole("button", { name: "Elimina dalla spesa", exact: true })
      .click();
    await expect(toastWith(page, "Eliminato: Mele verdi.")).toBeVisible();

    await expect
      .poll(async () => (await shoppingOf(bianchi, "Paolo")).length)
      .toBe(0);
  });
});

// -------------------------------------------------------------------- Errori

test.describe("Aggiungi · modifica della Spesa · errori", () => {
  test("CA-24: salvataggio non riuscito, il foglio resta aperto con i valori scritti", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seed(casa, "Marco", [{ name: "Latte", quantity: "2 l" }]);
    await openSpesaEdit(page, baseURL, casa, "Marco", "Latte");
    await failRpc(page, "update_shopping_item");
    const s = editSheet(page);
    await s.nameField.fill("Latte intero");
    await s.button("Salva").click();

    await expect(s.dialog).toBeVisible();
    await expect(s.nameField).toHaveValue("Latte intero");
    await expect(s.dialog.getByText(SAVE_FAILED_ALERT)).toBeVisible();
    expect((await itemOf(casa, "Marco", "Latte"))?.name).toBe("Latte");
  });

  test("CA-25: la cosa tolta da Paolo mentre Giulia ha il foglio aperto dà «Questa cosa non c'è più»", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await seed(bianchi, "Giulia", [{ name: "Mele" }]);
    const mele = await itemOf(bianchi, "Giulia", "Mele");
    await openSpesaEdit(page, baseURL, bianchi, "Giulia", "Mele");
    const { error } = await clientOf(bianchi, "Paolo")
      .from("shopping_items")
      .delete()
      .eq("id", mele!.id);
    expect(error).toBeNull();
    const s = editSheet(page);
    await s.nameField.fill("Mele rosse");
    await s.button("Salva").click();

    await expect(s.dialog.getByText(GONE_ALERT)).toBeVisible();
    expect(await shoppingOf(bianchi, "Giulia")).toHaveLength(0);
  });

  test("CA-26: un id che non esiste mostra «Questa cosa non c'è più» con «Chiudi» e nessun campo «Nome»", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openDirectEdit(
      page,
      baseURL,
      casa,
      "Marco",
      "00000000-0000-4000-8000-000000000000",
      (p) => editSheet(p).dialog.getByText("Questa cosa non c'è più"),
    );
    const s = editSheet(page);
    await expect(
      s.dialog.getByText("Forse l'ha tolta qualcun altro."),
    ).toBeVisible();
    await expect(s.dialog.getByTestId("aggiungi-gone-chiudi")).toBeVisible();
    await expect(s.nameField).toHaveCount(0);
  });

  test("CA-27: lettura non riuscita, «Riprova» mostra il modulo con «Latte»", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seed(casa, "Marco", [{ name: "Latte" }]);
    const item = await itemOf(casa, "Marco", "Latte");
    let failing = true;
    await page.route(
      (url) =>
        url.pathname.endsWith("/rest/v1/shopping_items") &&
        (url.searchParams.get("id") ?? "").startsWith("eq."),
      async (route) => {
        if (!failing) {
          await route.continue();
          return;
        }
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          headers: CORS,
          body: JSON.stringify({ code: "XX000", message: "boom" }),
        });
      },
    );
    await openDirectEdit(page, baseURL, casa, "Marco", item!.id, (p) =>
      editSheet(p).dialog.getByText(LOAD_FAILED),
    );
    failing = false;
    await editSheet(page)
      .dialog.getByRole("button", { name: "Riprova" })
      .click();
    await waitForEditSheet(page);
    await expect(editSheet(page).nameField).toHaveValue("Latte");
  });
});

// ------------------------------------------------------ Isolamento e privacy

test.describe("Aggiungi · modifica della Spesa · isolamento e privacy", () => {
  test("CA-28: la cosa di un altro Nest dà lo stesso messaggio e il nome non passa dalla rete", async ({
    page,
    baseURL,
    casa,
    bianchi,
  }) => {
    await seed(bianchi, "Giulia", [{ name: "Yogurt" }]);
    const yogurt = await itemOf(bianchi, "Giulia", "Yogurt");
    const bodies: string[] = [];
    page.on("response", async (response) => {
      if (!response.url().includes("/rest/v1/")) return;
      try {
        bodies.push(await response.text());
      } catch {
        // the page moved on
      }
    });
    await openDirectEdit(page, baseURL, casa, "Marco", yogurt!.id, (p) =>
      editSheet(p).dialog.getByText("Questa cosa non c'è più"),
    );
    await expect(editSheet(page).nameField).toHaveCount(0);
    expect(await page.content()).not.toContain("Yogurt");
    expect(bodies.join(" ")).not.toContain("Yogurt");
  });

  test("CA-29: con la sessione di Marco le cose di Casa Bianchi non cambiano e le persone di un altro Nest sono rifiutate", async ({
    casa,
    bianchi,
  }) => {
    await seed(bianchi, "Giulia", [{ name: "Yogurt" }, { name: "Mele" }]);
    await seed(casa, "Marco", [{ name: "Latte" }]);
    const yogurt = (await itemOf(bianchi, "Giulia", "Yogurt"))!;
    const mele = (await itemOf(bianchi, "Giulia", "Mele"))!;
    await clientOf(bianchi, "Giulia")
      .from("shopping_items")
      .update({ checked_at: new Date().toISOString() })
      .eq("id", mele.id);
    const marco = clientOf(casa, "Marco");

    const renamed = await marco.rpc("update_shopping_item", {
      p_item_id: yogurt.id,
      p_name: "Rubato",
      p_quantity: "",
      p_assignee_member_ids: [],
    });
    expect(renamed.error?.code).toBe("P0002");
    for (const id of [yogurt.id, mele.id]) {
      const deleted = await marco
        .from("shopping_items")
        .delete()
        .eq("id", id)
        .select("id");
      expect(deleted.data ?? []).toEqual([]);
    }
    expect(
      (await shoppingOf(bianchi, "Giulia")).map((r) => r.name).sort(),
    ).toEqual(["Mele", "Yogurt"]);

    const latte = (await itemOf(casa, "Marco", "Latte"))!;
    for (const other of [bianchi.members["Leo"]!, casa.members["Biscotto"]!]) {
      const assigned = await marco.rpc("update_shopping_item", {
        p_item_id: latte.id,
        p_name: "Latte",
        p_quantity: "",
        p_assignee_member_ids: [other],
      });
      expect(assigned.error).not.toBeNull();
    }
    expect(await carersOf(casa, "Marco", latte.id)).toEqual([]);
  });

  test("CA-30: l'indirizzo del foglio non contiene il nome né la quantità", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seed(casa, "Marco", [{ name: "Latte", quantity: "2 l" }]);
    await openSpesaEdit(page, baseURL, casa, "Marco", "Latte");
    const s = editSheet(page);
    await s.nameField.fill("Latte di soia");
    await s.button("Salva").click();
    await expect(toastWith(page, "Modifiche salvate.")).toBeVisible();

    const url = decodeURIComponent(page.url());
    expect(url).not.toContain("Latte");
    expect(url).not.toContain("2 l");
  });
});

// -------------------------------------------------------------------- Strappo

test.describe("Aggiungi · modifica della Spesa · strappo", () => {
  test("CA-31: una cosa assegnata a Laura, presa e strappata, torna in «Presi» con l'avatar di Laura dopo «Annulla»", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seed(casa, "Marco", [{ name: "Latte", assignees: ["Laura"] }]);
    await openCasaPage(page, baseURL, casa, "Marco", "/casa/spesa");
    await page.getByRole("checkbox", { name: "Preso: Latte" }).click();
    await expect(titlesOf(taken(page))).toHaveText(["Latte"]);

    const blade = page.getByRole("button", { name: /^Togli dalla lista/ });
    await blade.focus();
    await blade.press("Enter");
    const torn = toastOf(page).filter({ hasText: "tolta dalla lista." });
    await expect(torn).toBeVisible();
    await torn.getByRole("button", { name: "Annulla" }).click();

    await expect(titlesOf(taken(page))).toHaveText(["Latte"]);
    await expect(taken(page).locator(".avatar")).toHaveText(["L"]);
    await page.reload();
    await expect(taken(page).locator(".avatar")).toHaveText(["L"]);
  });
});
