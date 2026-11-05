import { dialogOf, fieldOf } from "../fixtures/aggiungi";
import {
  alerts,
  allRows,
  announcement,
  chipTexts,
  d,
  empty,
  emptyTitle,
  expect,
  expectNoBlockingViolations,
  failSearch,
  field,
  filterChip,
  filters,
  groupKinds,
  holdSearch,
  isMobile,
  openSearch,
  palette,
  pressedChips,
  rowsOf,
  SEARCH_RPC,
  seedNuoto,
  surface,
  test,
  typeSearch,
} from "../fixtures/ricerca";

// Ricerca (#40): empty, keyboard, loading, error and offline states, and axe
// (CA-41 ... CA-49, CA-52, CA-54, CA-60). Data: a throwaway Nest per test; dates
// relative to T, a Tuesday (fixtures/ricerca.ts).

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

const ERROR_TEXT =
  "Non siamo riusciti a cercare. Controlla la connessione e riprova.";
const OFFLINE_TEXT =
  "Sei offline: la ricerca riparte appena torna la connessione.";

test.describe("vuoto e «aggiungilo»", () => {
  test("CA-41: senza risultati: titolo, testo con «aggiungilo», niente chip su mobile e niente riga «Aggiungi» su desktop", async ({
    page,
    baseURL,
    nest,
  }) => {
    await seedNuoto(nest);
    await openSearch(page, baseURL, nest);
    await typeSearch(page, "piscina olimpica");

    await expect(emptyTitle(page)).toHaveText(
      "Nessun risultato per «piscina olimpica»",
    );
    await expect(empty(page).locator(".stato-vuoto__testo")).toHaveText(
      /^Prova con un.altra parola, oppure aggiungilo\.$/,
    );
    await expect(
      empty(page).getByRole("link", { name: "aggiungilo", exact: true }),
    ).toBeVisible();
    if (isMobile()) {
      await expect(filters(page)).toHaveCount(0);
    } else {
      await expect(
        palette(page).getByText("Aggiungi «piscina olimpica» come impegno"),
      ).toHaveCount(0);
      await expect(page.getByTestId("ricerca-gruppo-azioni")).toHaveCount(0);
    }
  });

  test("CA-42: «aggiungilo» apre Aggiungi sul tipo Impegno con il testo già scritto, e l'indirizzo non lo contiene", async ({
    page,
    baseURL,
    nest,
  }) => {
    await openSearch(page, baseURL, nest);
    await typeSearch(page, "piscina olimpica");
    await empty(page).getByRole("link", { name: "aggiungilo" }).click();

    await expect(dialogOf(page)).toBeVisible();
    await expect(fieldOf(page)).toHaveValue("piscina olimpica");
    await expect(
      dialogOf(page)
        .getByRole("group", { name: "Tipo" })
        .getByRole("button", { name: "Impegno" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveURL(/\/aggiungi$/);
    expect(page.url()).not.toContain("piscina");
  });
});

test.describe("tastiera sulla palette (desktop)", () => {
  test.beforeEach(() => {
    test.skip(isMobile(), "La palette c'è solo su desktop (1280 px)");
  });

  test("CA-43: ↓ fino all'ultima riga porta a «Aggiungi «nuoto» come impegno»; ↵ apre Aggiungi con «nuoto»", async ({
    page,
    baseURL,
    nest,
  }) => {
    await seedNuoto(nest);
    await openSearch(page, baseURL, nest);
    await typeSearch(page, "nuoto");
    await expect(rowsOf(page, "event")).toHaveCount(3);
    await expect
      .poll(() => groupKinds(page))
      .toEqual(["event", "deadline", "todo", "azioni"]);

    const input = field(page);
    // Three events, a deadline, a thing to do and the action: the first is chosen, five steps
    // reach the action and a sixth stays on it (the last one does not wrap).
    for (let step = 0; step < 6; step++) await input.press("ArrowDown");
    const action = page.getByTestId("ricerca-azione-aggiungi");
    await expect(action).toContainText("Aggiungi «nuoto» come impegno");
    await expect(input).toHaveAttribute(
      "aria-activedescendant",
      (await action.getAttribute("id")) ?? "",
    );
    await input.press("Enter");

    await expect(dialogOf(page)).toBeVisible();
    await expect(fieldOf(page)).toHaveValue("nuoto");
    await expect(page).toHaveURL(/\/aggiungi$/);
  });

  test("CA-44: la prima riga è quella indicata dal campo; ↓ passa alla seconda e ↵ la apre", async ({
    page,
    baseURL,
    nest,
  }) => {
    const { eventId } = await seedNuoto(nest);
    await openSearch(page, baseURL, nest);
    await typeSearch(page, "nuoto");
    await expect(rowsOf(page, "event")).toHaveCount(3);

    const rows = allRows(page);
    const input = field(page);
    await expect(input).toHaveAttribute(
      "aria-activedescendant",
      (await rows.nth(0).getAttribute("id")) ?? "",
    );
    await input.press("ArrowDown");
    await expect(input).toHaveAttribute(
      "aria-activedescendant",
      (await rows.nth(1).getAttribute("id")) ?? "",
    );
    await input.press("Enter");
    await expect(page).toHaveURL(
      new RegExp(`/impegni/${eventId}\\?giorno=${d(2)}$`),
    );
  });

  test("CA-45: scrivere «nuova» nel campo scrive e basta: Aggiungi non si apre", async ({
    page,
    baseURL,
    nest,
  }) => {
    await openSearch(page, baseURL, nest);
    await field(page).pressSequentially("nuova");
    await expect(field(page)).toHaveValue("nuova");
    await expect(dialogOf(page)).toHaveCount(0);
    await expect(page).toHaveURL(/\/ricerca$/);
  });

  test("CA-60: il mouse sulla terza riga la sceglie (aria-activedescendant) e ↵ la apre", async ({
    page,
    baseURL,
    nest,
  }) => {
    const { eventId } = await seedNuoto(nest);
    await openSearch(page, baseURL, nest);
    await typeSearch(page, "nuoto");
    await expect(rowsOf(page, "event")).toHaveCount(3);

    const third = allRows(page).nth(2);
    await third.hover();
    await expect(field(page)).toHaveAttribute(
      "aria-activedescendant",
      (await third.getAttribute("id")) ?? "",
    );
    await field(page).press("Enter");
    await expect(page).toHaveURL(new RegExp(`/impegni/${eventId}\\?giorno=`));
  });
});

test.describe("caricamento, errore, offline", () => {
  test("CA-46: con la risposta trattenuta si vede il contenitore aria-busy con «Caricamento in corso»; poi i risultati e il contenitore sparisce", async ({
    page,
    baseURL,
    nest,
  }) => {
    await seedNuoto(nest);
    await openSearch(page, baseURL, nest);
    const hold = await holdSearch(page);
    await typeSearch(page, "nuoto");
    await hold.arrived;

    const busy = surface(page).locator('[aria-busy="true"]');
    await expect(busy).toHaveCount(1);
    await expect(busy).toContainText("Caricamento in corso");
    await expect(allRows(page)).toHaveCount(0);

    hold.release();
    await expect(rowsOf(page, "event")).toHaveCount(3);
    await expect(busy).toHaveCount(0);
  });

  test("CA-47: con la ricerca che dà errore c'è l'avviso con «Riprova», senza il testo cercato; «Riprova» a servizio tornato mostra i risultati", async ({
    page,
    baseURL,
    nest,
  }) => {
    await seedNuoto(nest);
    await openSearch(page, baseURL, nest);
    await failSearch(page);
    await typeSearch(page, "nuoto");

    await expect(alerts(page)).toContainText(ERROR_TEXT);
    await expect(
      alerts(page).getByRole("button", { name: "Riprova" }),
    ).toBeVisible();
    await expect(allRows(page)).toHaveCount(0);
    expect((await alerts(page).textContent()) ?? "").not.toMatch(/nuoto/i);

    await page.unroute(SEARCH_RPC);
    await alerts(page).getByRole("button", { name: "Riprova" }).click();
    await expect(rowsOf(page, "event")).toHaveCount(3);
    await expect(rowsOf(page, "deadline")).toHaveCount(1);
    await expect(rowsOf(page, "todo")).toHaveCount(1);
    await expect(alerts(page)).toHaveCount(0);
  });

  test("CA-48: la risposta lenta di un testo vecchio non copre i risultati del testo nuovo", async ({
    page,
    baseURL,
    nest,
  }) => {
    await seedNuoto(nest);
    await openSearch(page, baseURL, nest);
    const slow = await holdSearch(page, /"p_text":"nu"/);
    await typeSearch(page, "nu");
    await slow.arrived;

    await typeSearch(page, "nuoto");
    await expect(rowsOf(page, "event")).toHaveCount(3);

    const lateAnswer = page.waitForResponse(
      (response) =>
        response.url().includes("/rest/v1/rpc/search_household") &&
        (response.request().postData() ?? "").includes('"p_text":"nu"'),
    );
    slow.release();
    await lateAnswer;
    // Let the page handle the late answer before looking again.
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await expect(field(page)).toHaveValue("nuoto");
    await expect(rowsOf(page, "event")).toHaveCount(3);
    await expect(announcement(page)).toHaveText("5 risultati per «nuoto»");
  });

  test("CA-52: con un filtro senza risultati il chip resta scelto, gli altri hanno i numeri e c'è «Nessun risultato in Spesa»", async ({
    page,
    baseURL,
    nest,
  }) => {
    test.skip(!isMobile(), "I chip dei filtri ci sono solo su mobile");
    await seedNuoto(nest);
    await openSearch(page, baseURL, nest);
    await filterChip(page, "Spesa").click();
    await typeSearch(page, "nuoto");

    await expect
      .poll(() => chipTexts(page))
      .toEqual(["Tutto 5", "Impegni 3", "Spesa", "Da fare 1", "Scadenze 1"]);
    await expect.poll(() => pressedChips(page)).toEqual(["Spesa"]);
    await expect(emptyTitle(page)).toHaveText(
      "Nessun risultato in Spesa per «nuoto»",
    );
    await expect(empty(page).locator(".stato-vuoto__testo")).toHaveText(
      /^Prova con un.altra parola, oppure aggiungilo\.$/,
    );
    await expect(
      empty(page).getByRole("link", { name: "aggiungilo", exact: true }),
    ).toBeVisible();

    await filterChip(page, "Tutto").click();
    await expect
      .poll(() => groupKinds(page))
      .toEqual(["event", "deadline", "todo"]);
  });

  test("CA-54: offline compare l'avviso con «Riprova» (e restano gli esempi); tornata la rete l'avviso sparisce e i risultati compaiono da soli", async ({
    page,
    baseURL,
    nest,
  }) => {
    await seedNuoto(nest);
    await openSearch(page, baseURL, nest);
    await page.context().setOffline(true);
    await typeSearch(page, "nuoto");

    await expect(alerts(page)).toContainText(OFFLINE_TEXT);
    await expect(
      alerts(page).getByRole("button", { name: "Riprova" }),
    ).toBeVisible();
    await expect(allRows(page)).toHaveCount(0);
    await expect(page.getByTestId("ricerca-esempi")).toBeVisible();
    if (isMobile()) {
      await expect(page.getByTestId("ricerca-persone")).toBeVisible();
    }

    await page.context().setOffline(false);
    await expect(alerts(page)).toHaveCount(0);
    await expect(rowsOf(page, "event")).toHaveCount(3);
    await expect(rowsOf(page, "deadline")).toHaveCount(1);
    await expect(rowsOf(page, "todo")).toHaveCount(1);
  });
});

test.describe("accessibilità (axe)", () => {
  test("CA-49: nessuna violazione grave nello stato normale, con risultati e vuoto", async ({
    page,
    baseURL,
    nest,
  }) => {
    await seedNuoto(nest);
    await openSearch(page, baseURL, nest);
    await expectNoBlockingViolations(page);

    await typeSearch(page, "nuoto");
    await expect(rowsOf(page, "event")).toHaveCount(3);
    await expectNoBlockingViolations(page);

    await typeSearch(page, "piscina olimpica");
    await expect(emptyTitle(page)).toHaveText(
      "Nessun risultato per «piscina olimpica»",
    );
    await expectNoBlockingViolations(page);
  });

  test("CA-49: nessuna violazione grave nello stato di caricamento", async ({
    page,
    baseURL,
    nest,
  }) => {
    await seedNuoto(nest);
    await openSearch(page, baseURL, nest);
    const hold = await holdSearch(page);
    await typeSearch(page, "nuoto");
    await hold.arrived;
    await expect(surface(page).locator('[aria-busy="true"]')).toHaveCount(1);
    await expectNoBlockingViolations(page);
    hold.release();
    await expect(rowsOf(page, "event")).toHaveCount(3);
  });

  test("CA-49: nessuna violazione grave nello stato di errore", async ({
    page,
    baseURL,
    nest,
  }) => {
    await seedNuoto(nest);
    await openSearch(page, baseURL, nest);
    await failSearch(page);
    await typeSearch(page, "nuoto");
    await expect(alerts(page)).toContainText(ERROR_TEXT);
    await expectNoBlockingViolations(page);
  });
});
