import type { Page } from "@playwright/test";
import { CORS } from "../fixtures/casa";
import { watchNetwork } from "../fixtures/calendario";
import {
  alerts,
  d,
  expect,
  info,
  lensButton,
  open,
  reopen,
  sec,
  SAVE_FAILED,
  test,
  tick,
  toast,
  TOAST_MS,
  todoRow,
  chooseLens,
  failReads,
  READ_TODOS,
  ev,
  type CasaNest,
} from "../fixtures/oggi";

// Oggi (#30): le cose da fare (CA-20 ... CA-25, CA-45, CA-47). The browser
// clock is stopped on Tuesday at 15:52 Rome: the toast (5 s) moves only with
// `page.clock.runFor`.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

const COMMERCIALISTA = "Chiamare il commercialista";
const ALTRA = "Ritirare il pacco";

async function seedTwo(casa: CasaNest): Promise<{ commercialista: string }> {
  const commercialista = await casa.todo("Marco", {
    title: COMMERCIALISTA,
    assignee: "Marco",
    due: d(1),
    priv: true,
  });
  await casa.todo("Marco", { title: ALTRA, assignee: "Marco", due: d(6) });
  return { commercialista };
}

async function doneAtOf(casa: CasaNest, id: string) {
  const rows = await casa.todoRows();
  return rows.find((row) => row.id === id)?.done_at ?? null;
}

/** Counts, from now on, how many times the row of a thing to do is in the DOM. */
async function watchRow(page: Page, id: string) {
  await page.evaluate((todoId) => {
    const win = window as unknown as { __rowCounts?: number[] };
    win.__rowCounts = [];
    const main = document.querySelector("main");
    if (!main) return;
    const record = () =>
      win.__rowCounts!.push(
        main.querySelectorAll(`[data-todo-id="${todoId}"]`).length,
      );
    new MutationObserver(record).observe(main, {
      childList: true,
      subtree: true,
      attributes: true,
    });
    record();
  }, id);
}

async function rowCounts(page: Page): Promise<number[]> {
  return page.evaluate(
    () => (window as unknown as { __rowCounts?: number[] }).__rowCounts ?? [],
  );
}

/** Resolves once the write of the tick and the new reading of the list have been seen. */
function watchWrite(page: Page) {
  const seen = { patched: false, reread: false };
  page.on("response", (response) => {
    const request = response.request();
    if (!response.url().includes("/rest/v1/todos")) return;
    if (request.method() === "PATCH") seen.patched = true;
    else if (request.method() === "GET" && seen.patched) seen.reread = true;
  });
  return seen;
}

/** Two frames: the page has drawn what React has just decided. */
async function drawn(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

test.describe("le mie cose", () => {
  test("CA-20: «Le mie cose» dice «2 da fare»; la riga del «Solo io» ha scadenza, «solo tu», il lucchetto e la casella con il suo nome", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seedTwo(casa);
    await open(page, baseURL, casa, "Marco", { lens: "io" });
    const mine = sec(page, "Le mie cose");
    await expect(mine).toBeVisible();
    await expect(info(mine)).toHaveText("2 da fare");
    const row = todoRow(page, COMMERCIALISTA);
    await expect(row).toBeVisible();
    await expect(row.locator(".riga-lista__info")).toHaveText(
      "Entro domani, solo tu",
    );
    await expect(row).toContainText("Visibile solo a te");
    await expect(tick(page, COMMERCIALISTA)).toBeVisible();
  });

  test("CA-21: toccare la casella la riempie, la riga resta barrata al suo posto, il toast ha «Annulla»; dopo 5 secondi la riga sparisce, anche dopo il ricaricamento", async ({
    page,
    baseURL,
    casa,
  }) => {
    const { commercialista } = await seedTwo(casa);
    await open(page, baseURL, casa, "Marco", { lens: "io" });
    await tick(page, COMMERCIALISTA).click();
    await expect(tick(page, COMMERCIALISTA)).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(todoRow(page, COMMERCIALISTA)).toBeVisible();
    await expect(todoRow(page, COMMERCIALISTA)).toHaveClass(
      /riga-lista--fatto/,
    );
    await expect(info(sec(page, "Le mie cose"))).toHaveText("1 da fare");
    const message = toast(page);
    await expect(message).toContainText("Fatto:");
    await expect(message).toContainText(COMMERCIALISTA);
    await expect(
      message.getByRole("button", { name: "Annulla" }),
    ).toBeVisible();

    await page.clock.runFor(TOAST_MS);
    await expect(toast(page)).toHaveCount(0);
    await expect(todoRow(page, COMMERCIALISTA)).toHaveCount(0);
    await expect(info(sec(page, "Le mie cose"))).toHaveText("1 da fare");
    await expect.poll(() => doneAtOf(casa, commercialista)).not.toBeNull();

    await reopen(page);
    await expect(todoRow(page, COMMERCIALISTA)).toHaveCount(0);
    await expect(todoRow(page, ALTRA)).toBeVisible();
  });

  test("CA-22: «Annulla» entro 5 secondi riapre il da fare: casella vuota, «2 da fare», ancora aperto dopo il ricaricamento", async ({
    page,
    baseURL,
    casa,
  }) => {
    const { commercialista } = await seedTwo(casa);
    await open(page, baseURL, casa, "Marco", { lens: "io" });
    await tick(page, COMMERCIALISTA).click();
    await expect(info(sec(page, "Le mie cose"))).toHaveText("1 da fare");
    await toast(page).getByRole("button", { name: "Annulla" }).click();
    await expect(toast(page)).toHaveCount(0);
    await expect(tick(page, COMMERCIALISTA)).toHaveAttribute(
      "aria-checked",
      "false",
    );
    await expect(info(sec(page, "Le mie cose"))).toHaveText("2 da fare");
    // No second message.
    await expect(
      page.getByRole("status").filter({ hasText: /\S/ }),
    ).toHaveCount(0);
    await expect.poll(() => doneAtOf(casa, commercialista)).toBeNull();

    await reopen(page);
    await expect(tick(page, COMMERCIALISTA)).toHaveAttribute(
      "aria-checked",
      "false",
    );
    await expect(info(sec(page, "Le mie cose"))).toHaveText("2 da fare");
  });

  test("CA-22: «Annulla» dopo che la spunta è già nel database: la riga non sparisce mai, il conteggio è giusto e il fuoco è sulla casella", async ({
    page,
    baseURL,
    casa,
  }) => {
    const { commercialista } = await seedTwo(casa);
    await open(page, baseURL, casa, "Marco", { lens: "io" });
    const seen = watchWrite(page);
    await tick(page, COMMERCIALISTA).click();
    // The write has reached the database and the list has been read again
    // (without the thing, now done): the row stays only because it is crossed out.
    await expect.poll(() => seen.reread).toBe(true);
    await expect.poll(() => doneAtOf(casa, commercialista)).not.toBeNull();
    await drawn(page);
    await expect(todoRow(page, COMMERCIALISTA)).toBeVisible();
    await expect(info(sec(page, "Le mie cose"))).toHaveText("1 da fare");

    await watchRow(page, commercialista);
    await toast(page).getByRole("button", { name: "Annulla" }).click();
    // At once, in the same drawing: row, box, count and focus.
    await expect(todoRow(page, COMMERCIALISTA)).toBeVisible();
    await expect(tick(page, COMMERCIALISTA)).toHaveAttribute(
      "aria-checked",
      "false",
    );
    await expect(info(sec(page, "Le mie cose"))).toHaveText("2 da fare");
    await expect(tick(page, COMMERCIALISTA)).toBeFocused();
    // The row has never left the page, even for an instant.
    await expect.poll(() => doneAtOf(casa, commercialista)).toBeNull();
    await drawn(page);
    const counts = await rowCounts(page);
    expect(counts.length).toBeGreaterThan(0);
    expect(Math.min(...counts)).toBeGreaterThan(0);
    await expect(todoRow(page, COMMERCIALISTA)).toBeVisible();
    await expect(info(sec(page, "Le mie cose"))).toHaveText("2 da fare");
    await expect(tick(page, COMMERCIALISTA)).toBeFocused();
  });

  test("CA-22: un secondo tocco sulla casella, dopo che la spunta è già nel database, la riapre senza far sparire la riga e con il fuoco sulla casella", async ({
    page,
    baseURL,
    casa,
  }) => {
    const { commercialista } = await seedTwo(casa);
    await open(page, baseURL, casa, "Marco", { lens: "io" });
    const seen = watchWrite(page);
    await tick(page, COMMERCIALISTA).click();
    await expect.poll(() => seen.reread).toBe(true);
    await expect.poll(() => doneAtOf(casa, commercialista)).not.toBeNull();
    await drawn(page);

    await watchRow(page, commercialista);
    await tick(page, COMMERCIALISTA).click();
    await expect(tick(page, COMMERCIALISTA)).toHaveAttribute(
      "aria-checked",
      "false",
    );
    await expect(todoRow(page, COMMERCIALISTA)).toBeVisible();
    await expect(info(sec(page, "Le mie cose"))).toHaveText("2 da fare");
    await expect(tick(page, COMMERCIALISTA)).toBeFocused();
    // The toast goes away without a second message.
    await expect(toast(page)).toHaveCount(0);
    await expect.poll(() => doneAtOf(casa, commercialista)).toBeNull();
    await drawn(page);
    expect(Math.min(...(await rowCounts(page)))).toBeGreaterThan(0);
    await expect(tick(page, COMMERCIALISTA)).toBeFocused();
  });

  test("CA-23: se il server rifiuta la scrittura la casella torna vuota, il conteggio non cambia e compare il toast di errore", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seedTwo(casa);
    await open(page, baseURL, casa, "Marco", { lens: "io" });
    // A database error has a `code`: without it the page takes the answer
    // for a lost connection and waits in a queue.
    await page.route("**/rest/v1/todos*", async (route) => {
      if (route.request().method() === "PATCH") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          headers: CORS,
          body: JSON.stringify({ code: "XX000", message: "fake failure" }),
        });
        return;
      }
      await route.continue();
    });
    await tick(page, ALTRA).click();
    const failed = page.getByRole("status").filter({ hasText: SAVE_FAILED });
    await expect(failed).toHaveText(SAVE_FAILED);
    await expect(tick(page, ALTRA)).toHaveAttribute("aria-checked", "false");
    await expect(todoRow(page, ALTRA)).not.toHaveClass(/riga-lista--fatto/);
    await expect(info(sec(page, "Le mie cose"))).toHaveText("2 da fare");
    // A refusal is not a lost connection.
    await expect(alerts(page)).toHaveCount(0);
  });

  test("CA-25: senza cose da fare di Paolo la sezione «Le mie cose» non c'è", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await open(page, baseURL, bianchi, "Paolo", { lens: "io" });
    await expect(sec(page, "Oggi")).toBeVisible();
    await expect(sec(page, "Le mie cose")).toHaveCount(0);
  });

  test("CA-45: con 7 da fare «Le mie cose» mostra 5 righe in ordine di scadenza, «Altri 2 da fare» e la regola dei 3 giorni", async ({
    page,
    baseURL,
    casa,
  }) => {
    const plan: [string, number | null][] = [
      ["Sette", null],
      ["Cinque", 9],
      ["Quattro", 6],
      ["Tre", 4],
      ["Due", 3],
      ["Uno", 2],
      ["Zero", 1],
    ];
    for (const [title, offset] of plan) {
      await casa.todo("Marco", {
        title,
        assignee: "Marco",
        ...(offset === null ? {} : { due: d(offset) }),
      });
    }
    await open(page, baseURL, casa, "Marco", { lens: "io" });
    const mine = sec(page, "Le mie cose");
    await expect(info(mine)).toHaveText("7 da fare");
    const rows = mine.locator("li[data-todo-id]");
    await expect(rows).toHaveCount(5);
    await expect(rows.locator(".riga-lista__titolo")).toHaveText([
      "Zero",
      "Uno",
      "Due",
      "Tre",
      "Quattro",
    ]);
    const more = mine.getByRole("link", { name: /Altri 2 da fare/ });
    await expect(more).toBeVisible();
    await expect(more).toHaveAttribute("href", "/casa/da-fare");
    // Within 3 days from today the line is red; a day later it is not.
    await expect(
      todoRow(page, "Due").locator(".riga-lista__info--allerta"),
    ).toHaveCount(1);
    await expect(
      todoRow(page, "Tre").locator(".riga-lista__info--allerta"),
    ).toHaveCount(0);
  });
});

test.describe("da fare in casa", () => {
  test("CA-24: «Da fare in casa» dice «4 aperti» con 4 righe e senza «Altri…»; il «Solo io» di Giulia non compare", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    const secret = "Regalo a sorpresa";
    for (const [index, title] of [
      "Pulire il garage",
      "Comprare le lampadine",
      "Chiamare l'idraulico",
      "Annaffiare le piante",
    ].entries()) {
      await bianchi.todo("Giulia", {
        title,
        assignee: index % 2 === 0 ? "Paolo" : "Anna",
        due: d(index + 1),
      });
    }
    await bianchi.todo("Giulia", {
      title: secret,
      assignee: "Giulia",
      priv: true,
    });
    const net = watchNetwork(page);
    await open(page, baseURL, bianchi, "Paolo", { lens: "nest" });
    await expect(lensButton(page, "Nest")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const list = sec(page, "Da fare in casa");
    await expect(info(list)).toHaveText("4 aperti");
    await expect(list.locator("li[data-todo-id]")).toHaveCount(4);
    await expect(list.getByRole("link", { name: /Altri|Altro/ })).toHaveCount(
      0,
    );
    // The avatar is that of who takes care of it.
    await expect(
      todoRow(page, "Pulire il garage").locator(".avatar"),
    ).toHaveCount(1);
    expect(await page.content()).not.toContain(secret);
    expect(await (await page.request.get("/oggi")).text()).not.toContain(
      secret,
    );
    expect(await net.bodies()).not.toContain(secret);
    await chooseLens(page, "Io");
    expect(await page.content()).not.toContain(secret);
  });
});

test.describe("una parte che non si carica", () => {
  test("CA-47: se le cose da fare non si leggono, «Prossimo» c'è, e un avviso con «Riprova» che sparisce quando la lettura torna", async ({
    page,
    baseURL,
    casa,
  }) => {
    await ev(casa, "Marco", { title: "Riunione", from: "16:52", to: "17:52" });
    const reads = await failReads(page, [READ_TODOS]);
    await open(page, baseURL, casa, "Marco", { lens: "io" });
    await expect(sec(page, "Prossimo")).toContainText("Riunione");
    const notice = alerts(page).filter({
      hasText:
        "Non riusciamo a caricare le cose da fare. Controlla la connessione e riprova.",
    });
    await expect(notice).toBeVisible();
    await expect(notice.getByRole("button", { name: "Riprova" })).toBeVisible();

    reads.recover();
    await notice.getByRole("button", { name: "Riprova" }).click();
    await expect(notice).toHaveCount(0);
    await expect(sec(page, "Prossimo")).toContainText("Riunione");
  });
});
