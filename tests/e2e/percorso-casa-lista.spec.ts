import { type Page } from "@playwright/test";
import { column, setClock } from "../fixtures/casa";
import { NOW, dialogOf } from "../fixtures/aggiungi";
import {
  deadlinesOf,
  editUrl,
  expectGone,
  expectPreview,
  goneMessage,
  sheet,
  shoppingOf,
  tapRowTitle,
  todoGroup,
  todoRow,
  todosOf,
  toastWith,
  waitForSheet,
} from "../fixtures/aggiungi-casa";
import {
  chooseLens,
  expect,
  greeting,
  info,
  todoRow as todayTodoRow,
  sec,
  test,
} from "../fixtures/oggi";
import {
  bodyText,
  contextLike,
  goTo,
  showColumn,
  type Column,
} from "../fixtures/percorso-casa";
import {
  allRows,
  emptyTitle,
  expectReady,
  rowsOf,
  typeSearch,
} from "../fixtures/ricerca";

// Percorso della casa (#307): Spesa, Da fare e Scadenze creati da Casa e da
// Aggiungi, spuntati, modificati e ritrovati in Oggi e in Ricerca, e poi
// l'isolamento: un adulto di un altro Nest non vede e non raggiunge niente.
// Un solo test attraversa tutte le pagine, come farebbe una persona. Le pagine
// hanno già i loro test: qui conta il filo che le unisce. L'orologio del browser
// è fermo a martedì 20 ottobre 2026, 15:52 (come nei test di Aggiungi). Ogni
// test costruisce i propri Nest usa e getta.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

const SPESA_FIELD = /^(Aggiungi alla spesa…|Cosa manca in casa\?)$/;
const NONNA = "Chiamare la nonna";
const CUFFIA = "Comprare la cuffia";
const BOLLO = "Bollo auto";
const ASSICURAZIONE = "Assicurazione casa";

const toTake = (page: Page) => page.getByTestId("spesa-da-prendere");
const taken = (page: Page) => page.getByTestId("spesa-presi");
const titles = (scope: ReturnType<typeof toTake>) =>
  scope.locator(".riga-lista__titolo");
const deadlineRow = (page: Page, title: string) =>
  column(page, "Scadenze")
    .getByTestId("scadenza-riga")
    .filter({ hasText: title });

/** Opens the sheet of Aggiungi from the navigation, wherever the person is. */
async function openAddFromHere(page: Page): Promise<void> {
  await expect(async () => {
    await page.getByRole("link", { name: "Aggiungi", exact: true }).click();
    await expect(dialogOf(page)).toBeVisible({ timeout: 2000 });
  }).toPass();
  await waitForSheet(page, "add");
}

/** The empty-state button of a column of Casa (a link to Aggiungi). */
const emptyAction = (page: Page, label: Column, name: string) =>
  column(page, label)
    .getByRole("link", { name, exact: true })
    .or(column(page, label).getByRole("button", { name, exact: true }));

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus) return;
  // DIAG (temporary)
  const body = await page
    .locator("body")
    .innerText()
    .catch(() => "n/a");
  const dialogs = await page
    .locator('[role="dialog"]')
    .evaluateAll((els) => els.map((el) => el.outerHTML.slice(0, 400)))
    .catch(() => []);
  console.log(
    "DIAG",
    page.url(),
    JSON.stringify({ body: body.slice(0, 1500), dialogs }),
  );
});

test.describe("percorso della casa", () => {
  test("percorso: creo da Casa e da Aggiungi, spunto, modifico, ritrovo in Oggi e in Ricerca; un altro Nest non vede niente", async ({
    page,
    browser,
    baseURL,
    casa,
    bianchi,
  }) => {
    test.setTimeout(300_000);
    await setClock(page, NOW);
    await casa.signIn(page, baseURL, "Marco");
    await page.goto("/oggi");
    await expect(
      page.getByRole("heading", { level: 1, name: greeting }),
    ).toBeVisible({ timeout: 20_000 });

    // ---- Da Oggi a Casa: la Spesa si aggiunge dal campo veloce
    await goTo(page, "Casa", /\/casa\/spesa$/);
    await showColumn(page, "Spesa");
    const quick = page.getByRole("textbox", { name: SPESA_FIELD });
    await expect(quick).toBeVisible({ timeout: 20_000 });
    await quick.fill("Latte");
    await quick.press("Enter");
    await expect(titles(toTake(page))).toHaveText(["Latte"]);
    await quick.fill("Pane");
    await quick.press("Enter");
    await expect(titles(toTake(page))).toHaveText(["Latte", "Pane"]);
    await expect
      .poll(async () => (await shoppingOf(casa, "Marco")).map((r) => r.name))
      .toEqual(["Latte", "Pane"]);

    // ---- Da Casa: «Da fare» vuoto porta ad Aggiungi con il tipo già scelto
    await showColumn(page, "Da fare");
    await expect(
      column(page, "Da fare").getByText("Niente da fare, per ora"),
    ).toBeVisible();
    await emptyAction(page, "Da fare", "Aggiungi una cosa da fare").click();
    await waitForSheet(page, "add");
    const add = sheet(page);
    await expect(add.type("Da fare")).toHaveAttribute("aria-pressed", "true");
    await add.field.fill("Laura deve chiamare la nonna entro venerdì");
    await expect(add.button("Dai a Laura")).toBeVisible();
    await add.button("Dai a Laura").click();
    await expect(add.dialog).toHaveCount(0);
    await expect(
      toastWith(page, "Dato a Laura: Chiamare la nonna."),
    ).toBeVisible();
    await expect(todoRow(page, NONNA)).toBeVisible({ timeout: 20_000 });
    await expect(todoGroup(page, "Questa settimana")).toContainText(NONNA);

    // ---- Da Casa: «Scadenze» vuoto porta ad Aggiungi con «Scadenza» scelta
    await showColumn(page, "Scadenze");
    await expect(
      column(page, "Scadenze").getByText("Nessuna scadenza"),
    ).toBeVisible();
    await emptyAction(page, "Scadenze", "Aggiungi una scadenza").click();
    await waitForSheet(page, "add");
    await expect(sheet(page).type("Scadenza")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await sheet(page).field.fill("bollo auto scade il 7 dicembre");
    await sheet(page).button("Aggiungi alle scadenze").click();
    await expect(sheet(page).dialog).toHaveCount(0);
    await expect(
      toastWith(page, "Aggiunta alle scadenze: Bollo auto."),
    ).toBeVisible();
    await expect(deadlineRow(page, BOLLO)).toBeVisible({ timeout: 20_000 });
    await expect(
      deadlineRow(page, BOLLO).locator(".riga-scadenza__numero"),
    ).toHaveText(/^48/);

    // ---- Da Aggiungi (dalla barra): una spesa, un da fare, una scadenza
    await openAddFromHere(page);
    await sheet(page).field.fill("caffè e 6 uova");
    await expectPreview(page, [
      { name: "Caffè" },
      { name: "Uova", quantity: "6" },
    ]);
    await sheet(page).button("Aggiungi 2 cose").click();
    await expect(sheet(page).dialog).toHaveCount(0);
    await expect(toastWith(page, "2 cose aggiunte alla spesa.")).toBeVisible();

    await openAddFromHere(page);
    await sheet(page).field.fill("comprare la cuffia per Sofia entro giovedì");
    await sheet(page).button("Aggiungi ai da fare").click();
    await expect(sheet(page).dialog).toHaveCount(0);
    await expect(
      toastWith(page, "Aggiunto ai da fare: Comprare la cuffia."),
    ).toBeVisible();

    await openAddFromHere(page);
    await sheet(page).field.fill("assicurazione casa scade il 24 ottobre");
    await expect(sheet(page).type("Scadenza")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await sheet(page).button("Aggiungi alle scadenze").click();
    await expect(sheet(page).dialog).toHaveCount(0);
    await expect(
      toastWith(page, "Aggiunta alle scadenze: Assicurazione casa."),
    ).toBeVisible();

    // Quello che Aggiungi ha creato è anche in Casa e nel database.
    await showColumn(page, "Spesa");
    await expect(titles(toTake(page))).toHaveText([
      "Latte",
      "Pane",
      "Caffè",
      "Uova",
    ]);
    await showColumn(page, "Da fare");
    await expect(todoRow(page, CUFFIA)).toBeVisible({ timeout: 20_000 });
    await showColumn(page, "Scadenze");
    await expect(deadlineRow(page, ASSICURAZIONE)).toBeVisible({
      timeout: 20_000,
    });
    await expect(deadlineRow(page, BOLLO)).toBeVisible();
    const todos = await todosOf(casa, "Marco");
    expect(todos.map((t) => t.title).sort()).toEqual([NONNA, CUFFIA]);
    expect(todos.find((t) => t.title === NONNA)).toMatchObject({
      assignee_member_id: casa.members["Laura"],
      due_date: "2026-10-23",
    });
    expect(todos.find((t) => t.title === CUFFIA)).toMatchObject({
      for_member_id: casa.members["Sofia"],
      due_date: "2026-10-22",
    });
    const deadlines = await deadlinesOf(casa, "Marco");
    expect(deadlines.map((d) => [d.title, d.due_date]).sort()).toEqual([
      [ASSICURAZIONE, "2026-10-24"],
      [BOLLO, "2026-12-07"],
    ]);

    // ---- Spunto: una cosa presa e una cosa fatta
    await showColumn(page, "Spesa");
    await page.getByRole("checkbox", { name: "Preso: Latte" }).click();
    await expect(
      taken(page).getByRole("checkbox", { name: "Rimetti in lista: Latte" }),
    ).toBeVisible();
    await expect(titles(toTake(page))).toHaveText(["Pane", "Caffè", "Uova"]);
    await expect
      .poll(async () => {
        const rows = await shoppingOf(casa, "Marco");
        return rows.find((r) => r.name === "Latte")?.checked_at ?? null;
      })
      .not.toBeNull();

    await showColumn(page, "Da fare");
    await page
      .getByRole("checkbox", { name: `Segna come fatto: ${NONNA}` })
      .click();
    await expect(
      page.getByRole("checkbox", { name: `Rimetti da fare: ${NONNA}` }),
    ).toBeVisible();
    await expect
      .poll(async () => {
        const rows = await casa.todoRows();
        return rows.find((r) => r.title === NONNA)?.done_at ?? null;
      })
      .not.toBeNull();

    // ---- Modifico: il da fare passa a Laura «entro lunedì», la scadenza cambia data
    await tapRowTitle(page, CUFFIA);
    const edit = sheet(page, "edit");
    await edit.person("Laura").click();
    await edit.field.focus();
    await edit.field.press("Control+End");
    await edit.field.pressSequentially(" entro lunedì");
    await edit.button("Salva").click();
    await expect(edit.dialog).toHaveCount(0);
    await expect(toastWith(page, "Modifiche salvate.")).toBeVisible();
    await expect(todoRow(page, CUFFIA).locator(".avatar")).toHaveText("L");
    await expect(
      todoRow(page, CUFFIA).locator(".riga-lista__info"),
    ).toContainText("Per Sofia, entro 26 ottobre");

    await showColumn(page, "Scadenze");
    await deadlineRow(page, BOLLO).getByRole("link").click();
    await waitForSheet(page, "edit");
    await sheet(page, "edit").field.fill("Bollo auto scade il 9 dicembre");
    await sheet(page, "edit").button("Salva").click();
    await expect(sheet(page, "edit").dialog).toHaveCount(0);
    await expect(toastWith(page, "Modifiche salvate.")).toBeVisible();
    await expect(
      deadlineRow(page, BOLLO).locator(".riga-scadenza__numero"),
    ).toHaveText(/^50/);
    await expect
      .poll(async () => {
        const rows = await deadlinesOf(casa, "Marco");
        const row = rows.find((r) => r.title === BOLLO);
        return row?.due_date ?? null;
      })
      .toBe("2026-12-09");

    // ---- Oggi: la spesa, la scadenza vicina e le cose da fare ci sono
    await goTo(page, "Oggi", /\/oggi$/);
    await expect(
      page.getByRole("heading", { level: 1, name: greeting }),
    ).toBeVisible({ timeout: 20_000 });
    await chooseLens(page, "Io");
    const nest = sec(page, "Nel Nest");
    const shopping = nest.getByRole("link", { name: /Cose da comprare/ });
    await expect(shopping).toBeVisible({ timeout: 20_000 });
    await expect(shopping.locator(".riga-lista__ora")).toHaveText("3");
    await expect(shopping).toHaveAttribute("href", "/casa/spesa");
    const near = nest.getByRole("link", { name: new RegExp(ASSICURAZIONE) });
    await expect(near).toContainText("Scade tra 4 giorni");
    await expect(near).toHaveAttribute("href", "/casa/scadenze");

    await chooseLens(page, "Nest");
    const house = sec(page, "Da fare in casa");
    await expect(house).toBeVisible({ timeout: 20_000 });
    await expect(info(house)).toHaveText("1 aperto");
    await expect(todayTodoRow(page, CUFFIA)).toBeVisible();
    await expect(todayTodoRow(page, NONNA)).toHaveCount(0);

    // ---- Ricerca: ritrovo quello che c'è, non quello che è già fatto
    await page.goto("/ricerca");
    await expectReady(page);
    await typeSearch(page, "pane");
    await expect(rowsOf(page, "shopping_item")).toHaveCount(1);
    await expect(rowsOf(page, "shopping_item")).toHaveAttribute(
      "href",
      "/casa/spesa",
    );
    await typeSearch(page, "cuffia");
    await expect(rowsOf(page, "todo")).toHaveCount(1);
    await expect(rowsOf(page, "todo")).toHaveAttribute("href", "/casa/da-fare");
    await typeSearch(page, "latte");
    await expect(emptyTitle(page)).toContainText(
      "Nessun risultato per «latte»",
    );
    await typeSearch(page, "nonna");
    await expect(emptyTitle(page)).toContainText(
      "Nessun risultato per «nonna»",
    );
    await typeSearch(page, "bollo");
    await expect(rowsOf(page, "deadline")).toHaveCount(1);
    await expect(rowsOf(page, "deadline")).toContainText(BOLLO);
    await rowsOf(page, "deadline").click();
    await expect(page).toHaveURL(/\/casa\/scadenze$/);
    await expect(deadlineRow(page, BOLLO)).toBeVisible({ timeout: 20_000 });

    // ---- Isolamento: un adulto di un altro Nest non vede e non raggiunge niente
    const ids = {
      todo: todos.find((t) => t.title === CUFFIA)!.id,
      deadline: deadlines.find((d) => d.title === BOLLO)!.id,
    };
    const context = await contextLike(browser, baseURL, page);
    try {
      await bianchi.signInContext(context, baseURL, "Giulia");
      const other = await context.newPage();
      const mine = [NONNA, CUFFIA, BOLLO, ASSICURAZIONE];
      const never = async (label: string) => {
        const text = await bodyText(other);
        for (const title of mine) {
          expect(text, `${label}: ${title}`).not.toContain(title);
        }
      };

      await other.goto("/casa/spesa");
      await expect(column(other, "Spesa")).toBeVisible({ timeout: 20_000 });
      await expect(
        other.getByRole("textbox", { name: SPESA_FIELD }),
      ).toBeVisible();
      await expect(toTake(other)).toHaveCount(0);
      await expect(taken(other)).toHaveCount(0);

      await other.goto("/casa/da-fare");
      await expect(
        column(other, "Da fare").getByText("Niente da fare, per ora"),
      ).toBeVisible({ timeout: 20_000 });
      await never("Da fare");

      await other.goto("/casa/scadenze");
      await expect(
        column(other, "Scadenze").getByText("Nessuna scadenza"),
      ).toBeVisible({ timeout: 20_000 });
      await never("Scadenze");

      await other.goto("/oggi");
      await expect(
        other.getByRole("heading", { level: 1, name: greeting }),
      ).toBeVisible({ timeout: 20_000 });
      await expect(other.locator('[aria-busy="true"]')).toHaveCount(0);
      await expect(sec(other, "Nel Nest")).toHaveCount(0);
      await expect(other.getByText("Cose da comprare")).toHaveCount(0);
      await never("Oggi");

      await other.goto("/ricerca");
      await expectReady(other);
      for (const word of [
        "pane",
        "caffè",
        "cuffia",
        "nonna",
        "bollo",
        "assicurazione",
      ]) {
        await typeSearch(other, word);
        await expect(emptyTitle(other)).toContainText(
          `Nessun risultato per «${word}»`,
        );
        await expect(allRows(other)).toHaveCount(0);
      }

      // Per indirizzo diretto: «Questa cosa non c'è più», senza il titolo.
      await other.goto(editUrl(ids.todo));
      await expect(goneMessage(other)).toBeVisible({ timeout: 20_000 });
      await expectGone(other);
      await expect(other.getByText(CUFFIA)).toHaveCount(0);
      await other.goto(editUrl(ids.deadline));
      await expect(goneMessage(other)).toBeVisible({ timeout: 20_000 });
      await expectGone(other);
      await expect(other.getByText(BOLLO)).toHaveCount(0);
    } finally {
      await context.close();
    }

    // Con la sua sessione Giulia non legge, non crea, non modifica, non toglie.
    const giulia = bianchi.users["Giulia"]!.client;
    for (const table of ["todos", "deadlines", "shopping_items"] as const) {
      const read = await giulia.from(table).select("id");
      expect(read.error, table).toBeNull();
      expect(read.data ?? [], table).toEqual([]);
    }
    const intruder = await giulia.from("todos").insert({
      household_id: casa.householdId,
      title: "Intruso",
    });
    expect(intruder.error).not.toBeNull();
    await giulia.from("todos").update({ title: "Cambiata" }).eq("id", ids.todo);
    await giulia.from("todos").delete().eq("id", ids.todo);
    await giulia.from("deadlines").delete().eq("id", ids.deadline);
    await giulia
      .from("shopping_items")
      .delete()
      .eq("household_id", casa.householdId);
    expect((await casa.todoRows()).map((t) => t.title).sort()).toEqual([
      NONNA,
      CUFFIA,
    ]);
    expect(
      (await deadlinesOf(casa, "Marco")).map((d) => d.title).sort(),
    ).toEqual([ASSICURAZIONE, BOLLO]);
    expect(await shoppingOf(casa, "Marco")).toHaveLength(4);
  });
});
