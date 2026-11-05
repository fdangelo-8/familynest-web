import type { Page } from "@playwright/test";
import { dayNumber, romeDay } from "../fixtures/casa";
import {
  changeOccurrence,
  createEvent,
  instant,
  removeOccurrence,
} from "../fixtures/impegni";
import {
  CUFFIA,
  ISCRIZIONE,
  NUOTO,
  T,
  addShopping,
  allRows,
  announcement,
  chipTexts,
  d,
  dayInNextMonth,
  doneAtOf,
  emptyTitle,
  expect,
  expectReady,
  field,
  filterChip,
  group,
  groupKinds,
  heading2,
  isMobile,
  leadsOf,
  openSearch,
  palette,
  pressedChips,
  refuseTodoUpdates,
  rowsOf,
  seedNuoto,
  test,
  titlesOf,
  toast,
  typeSearch,
} from "../fixtures/ricerca";

// Ricerca (#40): results, rows, filters and the box of the things to do
// (CA-14 ... CA-23, CA-50, CA-51, CA-53, CA-55 ... CA-57).
// Data: a throwaway Nest per test; dates relative to T, a Tuesday (fixtures/ricerca.ts).

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

const num = (offset: number) => String(dayNumber(d(offset)));
const TIME = /^17:00 – 18:30$/;
const tick = (page: Page, title = CUFFIA) =>
  page.getByRole("checkbox", { name: `Segna come fatto: ${title}` });

test.describe("risultati e righe", () => {
  test("CA-14 (mobile): «nuoto» mostra Impegni, Scadenze, Da fare in ordine, tre volte con «ogni martedì e giovedì» e i chip con i conteggi", async ({
    page,
    baseURL,
    nest,
  }) => {
    test.skip(!isMobile(), "I chip e l'info del gruppo ci sono solo su mobile");
    await seedNuoto(nest);
    await openSearch(page, baseURL, nest);
    await typeSearch(page, "nuoto");

    // The criterion says «entro 2 secondi»: no longer timeout than that.
    await expect(heading2(page, "Impegni")).toBeVisible({ timeout: 2000 });
    await expect(heading2(page, "Scadenze")).toBeVisible({ timeout: 2000 });
    await expect(heading2(page, "Da fare")).toBeVisible({ timeout: 2000 });
    await expect
      .poll(() => groupKinds(page))
      .toEqual(["event", "deadline", "todo"]);
    await expect(heading2(page, "Spesa")).toHaveCount(0);

    await expect(rowsOf(page, "event")).toHaveCount(3);
    await expect(leadsOf(page)).toHaveText(["Oggi", "Gio", num(7)]);
    await expect(group(page, "event").locator(".sezione__info")).toHaveText(
      "ogni martedì e giovedì",
    );
    await expect
      .poll(() => chipTexts(page))
      .toEqual(["Tutto 5", "Impegni 3", "Da fare 1", "Scadenze 1"]);
  });

  test("CA-14 (desktop): «nuoto» mostra Impegni, Scadenze, Da fare e Azioni in ordine; le tre volte hanno Oggi, Gio e il numero", async ({
    page,
    baseURL,
    nest,
  }) => {
    test.skip(isMobile(), "Caso della palette (1280 px)");
    await seedNuoto(nest);
    await openSearch(page, baseURL, nest);
    await typeSearch(page, "nuoto");
    await expect(rowsOf(page, "event")).toHaveCount(3, { timeout: 2000 });
    await expect
      .poll(() => groupKinds(page))
      .toEqual(["event", "deadline", "todo", "azioni"]);
    await expect(leadsOf(page)).toHaveText(["Oggi", "Gio", num(7)]);
    await expect(rowsOf(page, "deadline")).toHaveCount(1);
    await expect(rowsOf(page, "todo")).toHaveCount(1);
    await expect(page.getByTestId("ricerca-filtri")).toHaveCount(0);
  });

  test("CA-15: la parola è dentro un mark con il testo del titolo; orario, giorni che mancano e «Laura, entro giovedì»", async ({
    page,
    baseURL,
    nest,
  }) => {
    await seedNuoto(nest);
    await openSearch(page, baseURL, nest);
    await typeSearch(page, "nuoto");
    await expect(rowsOf(page, "event")).toHaveCount(3);

    const events = rowsOf(page, "event");
    for (const index of [0, 1, 2]) {
      await expect(events.nth(index).locator("mark.evidenzia")).toHaveText(
        "Nuoto",
      );
      await expect(events.nth(index).locator(".riga-lista__titolo")).toHaveText(
        NUOTO,
      );
    }
    await expect(events.first().locator(".riga-lista__info")).toHaveText(TIME);

    const deadline = rowsOf(page, "deadline");
    await expect(deadline.locator("mark.evidenzia")).toHaveText("nuoto");
    await expect(deadline.locator(".riga-lista__titolo")).toHaveText(
      ISCRIZIONE,
    );
    await expect(deadline.locator(".riga-lista__info")).toContainText(
      "Tra 14 giorni",
    );

    const todo = rowsOf(page, "todo");
    await expect(todo.locator("mark.evidenzia")).toHaveText("nuoto");
    await expect(todo.locator(".riga-lista__titolo")).toHaveText(CUFFIA);
    await expect(todo.locator(".riga-lista__info")).toHaveText(
      "Laura, entro giovedì",
    );
  });

  test("CA-16: la riga «Gio» porta al dettaglio del giorno; la scadenza porta a /casa/scadenze", async ({
    page,
    baseURL,
    nest,
  }) => {
    const { eventId } = await seedNuoto(nest);
    await openSearch(page, baseURL, nest);
    await typeSearch(page, "nuoto");
    await expect(rowsOf(page, "event")).toHaveCount(3);
    await rowsOf(page, "event").nth(1).click();
    await expect(page).toHaveURL(
      new RegExp(`/impegni/${eventId}\\?giorno=${d(2)}$`),
    );

    await page.goto("/ricerca");
    await expectReady(page);
    await typeSearch(page, "nuoto");
    await expect(rowsOf(page, "deadline")).toHaveCount(1);
    await rowsOf(page, "deadline").click();
    await expect(page).toHaveURL(/\/casa\/scadenze$/);
  });

  test("CA-17: su mobile il chip «Scadenze» mostra solo quel gruppo; «Tutto» li riporta tutti", async ({
    page,
    baseURL,
    nest,
  }) => {
    test.skip(!isMobile(), "I chip dei filtri ci sono solo su mobile");
    await seedNuoto(nest);
    await openSearch(page, baseURL, nest);
    await typeSearch(page, "nuoto");
    await expect(rowsOf(page, "event")).toHaveCount(3);

    await filterChip(page, "Scadenze").click();
    await expect.poll(() => groupKinds(page)).toEqual(["deadline"]);
    await expect.poll(() => pressedChips(page)).toEqual(["Scadenze"]);

    await filterChip(page, "Tutto").click();
    await expect
      .poll(() => groupKinds(page))
      .toEqual(["event", "deadline", "todo"]);
    await expect.poll(() => pressedChips(page)).toEqual(["Tutto"]);
  });

  test("CA-18: la ricerca ignora maiuscole e accenti e vuole tutte le parole", async ({
    page,
    baseURL,
    nest,
  }) => {
    await seedNuoto(nest);
    await nest.todo("Marco", { title: "Caffè per la riunione" });
    await openSearch(page, baseURL, nest);

    await typeSearch(page, "caffe");
    await expect(rowsOf(page, "todo")).toHaveCount(1);
    await expect(
      rowsOf(page, "todo").locator("mark.evidenzia", { hasText: "Caffè" }),
    ).toHaveCount(1);

    await typeSearch(page, "riunione caffe");
    await expect(rowsOf(page, "todo")).toHaveCount(1);
    await expect(rowsOf(page, "todo").locator("mark.evidenzia")).toHaveText([
      "Caffè",
      "riunione",
    ]);

    await typeSearch(page, "caffe nuoto");
    await expect(emptyTitle(page)).toHaveText(
      "Nessun risultato per «caffe nuoto»",
    );
    await expect(allRows(page)).toHaveCount(0);
  });

  test("CA-19: nella Spesa solo quello da prendere, con la quantità e il link a /casa/spesa", async ({
    page,
    baseURL,
    nest,
  }) => {
    await addShopping(nest, "Latte", { quantity: "2 litri" });
    await addShopping(nest, "Latte di soia", { taken: true });
    await openSearch(page, baseURL, nest);
    await typeSearch(page, "latte");
    const rows = rowsOf(page, "shopping_item");
    await expect(rows).toHaveCount(1);
    await expect(rows.locator(".riga-lista__titolo")).toHaveText("Latte");
    await expect(rows.locator(".riga-lista__info")).toHaveText("2 litri");
    await expect(rows).toHaveAttribute("href", "/casa/spesa");
  });

  test("CA-20: le volte tolte non ci sono e quelle modificate hanno il loro titolo", async ({
    page,
    baseURL,
    nest,
  }) => {
    const { eventId } = await seedNuoto(nest);
    await removeOccurrence(nest, "Marco", eventId, d(2));
    await changeOccurrence(nest, "Marco", eventId, d(7), {
      title: "Nuoto gara",
      start: instant(d(7), "17:00"),
      end: instant(d(7), "18:30"),
      place: null,
      notes: null,
      escort: null,
    });
    await openSearch(page, baseURL, nest);
    await typeSearch(page, "nuoto");
    await expect(rowsOf(page, "event")).toHaveCount(3);
    await expect(leadsOf(page)).toHaveText(["Oggi", num(7), num(9)]);
    await expect(titlesOf(page, "event")).toHaveText([
      NUOTO,
      "Nuoto gara",
      NUOTO,
    ]);
  });

  test("CA-21: non compaiono gli impegni già finiti né le cose da fare già fatte", async ({
    page,
    baseURL,
    nest,
  }) => {
    // The database reads «adesso» from the real clock: this case uses the real
    // time (no fixed clock) and times relative to now, not to T.
    const now = new Date();
    const minutes = (offset: number) =>
      new Date(now.getTime() + offset * 60_000);
    const hhmm = (date: Date) =>
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/Rome",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(date);
    const span = (title: string, from: number, to: number) =>
      createEvent(nest, "Marco", {
        title,
        day: romeDay(minutes(from)),
        from: hhmm(minutes(from)),
        endDay: romeDay(minutes(to)),
        to: hhmm(minutes(to)),
        members: ["Sofia"],
      });
    await createEvent(nest, "Marco", {
      title: "Nuoto prova",
      day: d(-9),
      from: "10:00",
      to: "11:00",
      members: ["Sofia"],
    });
    await span("Nuoto appena finito", -65, -5);
    await span("Nuoto in corso", -60, 60);
    await nest.todo("Marco", { title: "Nuoto ieri", doneAt: new Date() });
    await nest.todo("Marco", { title: "Nuoto da fare" });

    await openSearch(page, baseURL, nest, { clock: false });
    await typeSearch(page, "nuoto");
    await expect(titlesOf(page, "event")).toHaveText(["Nuoto in corso"]);
    await expect(titlesOf(page, "todo")).toHaveText(["Nuoto da fare"]);
    await expect(page.getByText("Nuoto prova")).toHaveCount(0);
    await expect(page.getByText("Nuoto appena finito")).toHaveCount(0);
    await expect(page.getByText("Nuoto ieri")).toHaveCount(0);
  });

  test("CA-22: al massimo 20 righe per tipo, nell'ordine di aggiunta", async ({
    page,
    baseURL,
    nest,
  }) => {
    for (let n = 1; n <= 25; n++) await addShopping(nest, `Pane ${n}`);
    await openSearch(page, baseURL, nest);
    await typeSearch(page, "pane");
    const rows = rowsOf(page, "shopping_item");
    await expect(rows).toHaveCount(20);
    await expect(titlesOf(page, "shopping_item")).toHaveText(
      Array.from({ length: 20 }, (_, index) => `Pane ${index + 1}`),
    );
    if (isMobile()) {
      await expect
        .poll(() => chipTexts(page))
        .toEqual(["Tutto 20", "Spesa 20"]);
    }
  });

  test("CA-53: l'impegno di un altro mese ha il giorno e il mese; quello del mese in corso solo l'orario", async ({
    page,
    baseURL,
    nest,
  }) => {
    await seedNuoto(nest);
    const other = dayInNextMonth(T, 10);
    await createEvent(nest, "Marco", {
      title: "Nuoto in vasca grande",
      day: other,
      from: "17:00",
      to: "18:30",
      members: ["Sofia"],
    });
    await openSearch(page, baseURL, nest);
    await typeSearch(page, "nuoto");
    await expect(rowsOf(page, "event")).toHaveCount(4);

    const big = rowsOf(page, "event").filter({
      hasText: "Nuoto in vasca grande",
    });
    await expect(big.locator(".riga-lista__ora")).toHaveText("10");
    const year =
      other.slice(0, 4) === T.slice(0, 4) ? "" : ` ${other.slice(0, 4)}`;
    const months = [
      "gennaio",
      "febbraio",
      "marzo",
      "aprile",
      "maggio",
      "giugno",
      "luglio",
      "agosto",
      "settembre",
      "ottobre",
      "novembre",
      "dicembre",
    ];
    await expect(big.locator(".riga-lista__info")).toHaveText(
      `10 ${months[Number(other.slice(5, 7)) - 1]}${year}, 17:00 – 18:30`,
    );

    const today = rowsOf(page, "event").filter({ hasText: NUOTO }).first();
    await expect(today.locator(".riga-lista__ora")).toHaveText("Oggi");
    await expect(today.locator(".riga-lista__info")).toHaveText(TIME);
  });
});

test.describe("campo e annuncio", () => {
  test("CA-50: su mobile il campo non ha «name», senza «x» del browser; cancellando tutto tornano Persone e Prova a cercare", async ({
    page,
    baseURL,
    nest,
  }) => {
    test.skip(!isMobile(), "Caso a 390 px");
    await seedNuoto(nest);
    await openSearch(page, baseURL, nest);
    await typeSearch(page, "nuoto");
    await expect(rowsOf(page, "event")).toHaveCount(3);

    const input = field(page);
    await expect(input).not.toHaveAttribute("name");
    const appearance = await input.evaluate(
      (element) =>
        getComputedStyle(element, "::-webkit-search-cancel-button").appearance,
    );
    expect(appearance).toBe("none");

    await input.press("Control+a");
    await input.press("Backspace");
    await expect(input).toHaveValue("");
    await expect(page.getByTestId("ricerca-persone")).toBeVisible();
    await expect(page.getByTestId("ricerca-esempi")).toBeVisible();
    await expect
      .poll(() => chipTexts(page))
      .toEqual(["Tutto", "Impegni", "Spesa", "Da fare", "Scadenze"]);
    await expect.poll(() => pressedChips(page)).toEqual(["Tutto"]);
  });

  test("CA-51: su desktop la palette non ha caselle; la cosa da fare è un link a /casa/da-fare e resta da fare", async ({
    page,
    baseURL,
    nest,
  }) => {
    test.skip(isMobile(), "Caso della palette (1280 px)");
    await seedNuoto(nest);
    await openSearch(page, baseURL, nest);
    await typeSearch(page, "nuoto");
    await expect(rowsOf(page, "todo")).toHaveCount(1);
    await expect(palette(page).getByRole("checkbox")).toHaveCount(0);

    const row = rowsOf(page, "todo");
    await expect(row).toHaveText(new RegExp(CUFFIA));
    await expect(row).toHaveAttribute("href", "/casa/da-fare");
    expect(await row.evaluate((element) => element.tagName)).toBe("A");
    await row.click();
    await expect(page).toHaveURL(/\/casa\/da-fare$/);
    expect(await doneAtOf(nest, CUFFIA)).toBeNull();
  });

  test("CA-55: la regione di stato annuncia i risultati, anche con un filtro, ed è vuota a campo vuoto", async ({
    page,
    baseURL,
    nest,
  }) => {
    test.skip(!isMobile(), "I chip dei filtri ci sono solo su mobile");
    await seedNuoto(nest);
    await openSearch(page, baseURL, nest);
    await expect(announcement(page)).toHaveText("");
    await typeSearch(page, "nuoto");
    await expect(announcement(page)).toHaveText("5 risultati per «nuoto»");
    await filterChip(page, "Impegni").click();
    await expect(announcement(page)).toHaveText(
      "3 risultati in Impegni per «nuoto»",
    );
    await field(page).fill("");
    await expect(announcement(page)).toHaveText("");
  });
});

test.describe("casella dei Da fare (mobile)", () => {
  test("CA-23: la casella segna la cosa come fatta, compare «Fatto: …» con «Annulla» e il database la ha fatta", async ({
    page,
    baseURL,
    nest,
  }) => {
    test.skip(
      !isMobile(),
      "La casella c'è solo su mobile (su desktop vedi CA-51)",
    );
    await seedNuoto(nest);
    await openSearch(page, baseURL, nest);
    await typeSearch(page, "nuoto");
    await expect(tick(page)).toBeVisible();
    await tick(page).click();

    await expect(tick(page)).toHaveAttribute("aria-checked", "true");
    await expect(toast(page)).toContainText(
      /Fatto:\s*Comprare la cuffia da nuoto\s*\./,
    );
    await expect(
      toast(page).getByRole("button", { name: "Annulla" }),
    ).toBeVisible();
    await expect.poll(() => doneAtOf(nest, CUFFIA)).not.toBeNull();
  });

  test("CA-57: «Annulla» nel toast rimette la casella vuota con il fuoco e la cosa non è fatta", async ({
    page,
    baseURL,
    nest,
  }) => {
    test.skip(!isMobile(), "La casella c'è solo su mobile");
    await seedNuoto(nest);
    await openSearch(page, baseURL, nest);
    await typeSearch(page, "nuoto");
    await tick(page).click();
    await expect(tick(page)).toHaveAttribute("aria-checked", "true");
    await expect.poll(() => doneAtOf(nest, CUFFIA)).not.toBeNull();

    await toast(page).getByRole("button", { name: "Annulla" }).click();
    await expect(tick(page)).toHaveAttribute("aria-checked", "false");
    await expect(tick(page)).toBeFocused();
    await expect.poll(() => doneAtOf(nest, CUFFIA)).toBeNull();
  });

  test("CA-56: se il server rifiuta la modifica la casella torna vuota e compare il toast di errore senza «Annulla»", async ({
    page,
    baseURL,
    nest,
  }) => {
    test.skip(!isMobile(), "La casella c'è solo su mobile");
    await seedNuoto(nest);
    await openSearch(page, baseURL, nest);
    await typeSearch(page, "nuoto");
    await expect(tick(page)).toBeVisible();
    await refuseTodoUpdates(page);
    await tick(page).click();

    await expect(toast(page)).toContainText(
      "Non siamo riusciti a salvare la modifica. Riprova tra qualche secondo.",
    );
    await expect(
      toast(page).getByRole("button", { name: "Annulla" }),
    ).toHaveCount(0);
    await expect(tick(page)).toHaveAttribute("aria-checked", "false");
    expect(await doneAtOf(nest, CUFFIA)).toBeNull();
  });

  test("senza rete la spunta resta in coda e parte quando torna la rete", async ({
    page,
    baseURL,
    nest,
  }) => {
    test.skip(!isMobile(), "La casella c'è solo su mobile");
    await seedNuoto(nest);
    await openSearch(page, baseURL, nest);
    await typeSearch(page, "nuoto");
    await expect(tick(page)).toBeVisible();

    await page.context().setOffline(true);
    await tick(page).click();
    // Lost connection is not a refusal: the tick stays, no error toast.
    await expect(tick(page)).toHaveAttribute("aria-checked", "true");
    await expect(toast(page)).toContainText(
      /Fatto:\s*Comprare la cuffia da nuoto\s*\./,
    );
    await expect(toast(page)).not.toContainText("Non siamo riusciti");
    expect(await doneAtOf(nest, CUFFIA)).toBeNull();

    await page.context().setOffline(false);
    await expect.poll(() => doneAtOf(nest, CUFFIA)).not.toBeNull();
    await expect(tick(page)).toHaveAttribute("aria-checked", "true");
    await expect(
      page.getByText("Non siamo riusciti a salvare la modifica"),
    ).toHaveCount(0);
  });
});
