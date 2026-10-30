import { createClient } from "@supabase/supabase-js";
import { test as plain, type Locator, type Page } from "@playwright/test";
import {
  alertColor,
  alerts,
  busy,
  colorOf,
  column,
  CORS,
  expect,
  filterGroup,
  isMobileProject,
  setClock,
  switcher,
  switcherVoice,
  test,
  type CasaNest,
} from "../fixtures/casa";
import { signInAs, skipReason, usersConfigured } from "../fixtures/auth";

// Casa · Scadenze (#24): one test for every acceptance criterion (CA-1 ... CA-28)
// plus the extras that follow from the decisions of the issue («Solo io» of
// 30/10, deadlines overdue by more than 60 days counted in months).
//
// Written before the page exists. Roles and texts are those of the requirement
// and of the designer's specification; what depends on the implementation is
// resolved against the code of the PR. Every test that touches data uses its own throwaway Nest
// (fixtures/casa.ts); the seed users A, B, B2 and C are not written.
//
// [OR] criteria: the browser clock is fixed at martedì 20 ottobre 2026, 15:52
// Europe/Rome (the dates of the data are absolute). The page writes nothing, so
// the clock can keep running.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

const PATH = "/casa/scadenze";
/** martedì 20 ottobre 2026, 15:52 a Roma (CEST, UTC+2) */
const TODAY = new Date("2026-10-20T13:52:00Z");

// ------------------------------------------------------------------ locators

const col = (page: Page) => column(page, "Scadenze");
const rows = (page: Page) => col(page).locator("li");
const titles = (scope: Locator) => scope.locator(".riga-lista__titolo");
const rowOf = (page: Page, title: string) =>
  rows(page).filter({
    has: page.locator(".riga-lista__titolo", { hasText: title }),
  });
const numberOf = (page: Page, title: string) =>
  rowOf(page, title).locator(".riga-scadenza__numero");
const unitOf = (page: Page, title: string) =>
  rowOf(page, title).locator(".riga-scadenza__unita");
const infoOf = (page: Page, title: string) =>
  rowOf(page, title).locator(".riga-lista__info");
const avatarOf = (page: Page, title: string) =>
  rowOf(page, title).locator(".avatar");
const dotOf = (page: Page, title: string) =>
  rowOf(page, title).getByTestId("pallino-urgente");
const section = (page: Page) =>
  col(page)
    .locator("section.sezione")
    .filter({ has: page.getByRole("heading", { level: 3, name: "Prossime" }) });
const columnInfo = (page: Page) =>
  col(page).locator(".sezione__testa").first().locator(".sezione__info");
const emptyTitle = (page: Page) =>
  page.getByText("Nessuna scadenza", { exact: true });
const EMPTY_TEXT =
  "Documenti, bollo, assicurazioni, abbonamenti: aggiungili e vedi sempre quanto manca.";

const CARTA = "Rinnovo carta d'identità di Sofia";
const BISCOTTO = "Assicurazione di Biscotto";
const BOLLO = "Bollo dell'auto";
const CASA = "Assicurazione della casa";

/** Dati di base (DS) of the issue, created by Marco in Casa D'Angelo. */
async function seedBase(casa: CasaNest): Promise<void> {
  await casa.deadline("Marco", {
    title: CARTA,
    due: "2026-11-03",
    note: "Serve per la gita",
    forMember: "Sofia",
  });
  await casa.deadline("Marco", {
    title: BISCOTTO,
    due: "2026-11-20",
    forMember: "Biscotto",
    assignee: "Laura",
  });
  await casa.deadline("Marco", {
    title: BOLLO,
    due: "2026-12-07",
    assignee: "Marco",
  });
  await casa.deadline("Marco", {
    title: CASA,
    due: "2027-01-20",
    assignee: "Marco",
  });
}

async function open(
  page: Page,
  baseURL: string | undefined,
  casa: CasaNest,
  options: { who?: string; time?: Date; path?: string; ready?: Locator } = {},
): Promise<void> {
  const { who = "Marco", time = TODAY, path = PATH } = options;
  await setClock(page, time);
  await casa.signIn(page, baseURL, who);
  await page.goto(path);
  await expect(options.ready ?? col(page)).toBeVisible({ timeout: 20_000 });
  await expect(busy(page)).toHaveCount(0);
}

// ------------------------------------------------------- access and structure

plain.describe("accesso", () => {
  plain(
    "CA-1: senza sessione /casa/scadenze porta a /accesso",
    async ({ page }) => {
      await page.goto(PATH);
      await expect(page).toHaveURL(/\/accesso$/);
    },
  );

  plain(
    "CA-2: l'utente C, senza Nest, viene portato su /onboarding",
    async ({ page, baseURL }) => {
      plain.skip(!usersConfigured("C"), skipReason("C"));
      await signInAs(page.context(), baseURL as string, "C");
      await page.goto(PATH);
      await expect(page).toHaveURL(/\/onboarding$/);
    },
  );
});

test.describe("struttura", () => {
  test("CA-3: titolo della scheda, un solo h1, selettore, voce Casa attiva e nessun filtro (mobile)", async ({
    page,
    baseURL,
    casa,
  }) => {
    test.skip(!isMobileProject(), "Il selettore c'è solo su mobile (390 px)");
    await open(page, baseURL, casa);
    await expect(page).toHaveTitle("FamilyNest · Casa · Scadenze");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Casa");
    await expect(switcher(page).locator(".selettore__voce")).toHaveText([
      /^Spesa/,
      /^Da fare/,
      /^Scadenze/,
    ]);
    await expect(
      switcher(page).getByRole("button", { name: /^Scadenze/ }),
    ).toHaveAttribute("aria-pressed", "true");
    // The navigation sets aria-current="page" only on the exact link of the
    // entry (/casa/spesa) and "true" on the other Casa pages (getNavAriaCurrent,
    // src/lib/app-routes.ts, checked by layout.spec.ts).
    await expect(
      page
        .getByRole("navigation", { name: "Navigazione principale" })
        .locator('[aria-current="true"]'),
    ).toHaveText(/Casa/);
    await expect(filterGroup(page)).toHaveCount(0);
  });

  test("CA-4: dal selettore si va a Spesa e a Da fare (mobile)", async ({
    page,
    baseURL,
    casa,
  }) => {
    test.skip(!isMobileProject(), "Il selettore c'è solo su mobile (390 px)");
    await open(page, baseURL, casa);
    await switcher(page)
      .getByRole("link", { name: /^Spesa/ })
      .click();
    await expect(page).toHaveURL(/\/casa\/spesa$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/casa\/scadenze$/);
    await expect(col(page)).toBeVisible();
    await switcher(page)
      .getByRole("link", { name: /^Da fare/ })
      .click();
    await expect(page).toHaveURL(/\/casa\/da-fare$/);
  });

  test("CA-5: su desktop nome del Nest sopra l'h1, tre regioni e nessun selettore", async ({
    page,
    baseURL,
    casa,
  }) => {
    test.skip(isMobileProject(), "Caso a 1280 px");
    await open(page, baseURL, casa);
    const nestName = page
      .getByRole("main")
      .getByText("Casa D'Angelo", { exact: true });
    const h1 = page.getByRole("heading", { level: 1, name: "Casa" });
    await expect(nestName).toBeVisible();
    await expect(h1).toBeVisible();
    expect((await nestName.boundingBox())!.y).toBeLessThan(
      (await h1.boundingBox())!.y,
    );
    await expect(column(page, "Spesa")).toBeVisible();
    await expect(column(page, "Da fare")).toBeVisible();
    await expect(
      col(page).getByRole("heading", { level: 2, name: "Scadenze" }),
    ).toBeVisible();
    await expect(switcher(page)).toHaveCount(0);
  });

  test.fixme("CA-5 (parte): su desktop il gruppo «Filtra per persona» c'è nell'intestazione", async ({
    page,
    baseURL,
    casa,
  }) => {
    // Seguito accettato dal coordinatore sulla PR #123 (issue #24): i chip su desktop non sono ancora
    // collegati alla pagina Scadenze (arrivano con la #23).
    test.skip(isMobileProject(), "Caso a 1280 px");
    await open(page, baseURL, casa);
    await expect(filterGroup(page)).toBeVisible();
  });

  test("CA-6 (parte): su desktop la colonna «Scadenze» di /casa/scadenze ha le 4 righe e non dice «In arrivo»", async ({
    page,
    baseURL,
    casa,
  }) => {
    test.skip(isMobileProject(), "Caso a 1280 px");
    await seedBase(casa);
    await open(page, baseURL, casa);
    await expect(rows(page)).toHaveCount(4);
    await expect(col(page)).not.toContainText("In arrivo");
  });

  test.fixme("CA-6 (parte): la stessa colonna «Scadenze» compare in /casa/spesa e /casa/da-fare", async ({
    page,
    baseURL,
    casa,
  }) => {
    // Seguito accettato dal coordinatore sulla PR #123 (issue #24): le pagine Spesa e Da fare non
    // hanno ancora la colonna Scadenze (colonne incrociate).
    test.skip(isMobileProject(), "Caso a 1280 px");
    await seedBase(casa);
    await open(page, baseURL, casa, { path: "/casa/spesa" });
    await expect(rows(page)).toHaveCount(4);
    await expect(col(page)).not.toContainText("In arrivo");
    await page.goto("/casa/da-fare");
    await expect(rows(page)).toHaveCount(4);
    await expect(col(page)).not.toContainText("In arrivo");
  });

  test("CA-7 (parte): la voce «Scadenze» del selettore di /casa/scadenze mostra 4 (mobile)", async ({
    page,
    baseURL,
    casa,
  }) => {
    test.skip(!isMobileProject(), "Il selettore c'è solo su mobile (390 px)");
    await seedBase(casa);
    await open(page, baseURL, casa);
    await expect(
      switcherVoice(page, "Scadenze").locator(".selettore__conteggio"),
    ).toHaveText("4");
  });

  test.fixme("CA-7 (parte): la voce «Scadenze» mostra 4 anche in /casa/spesa e /casa/da-fare (mobile)", async ({
    page,
    baseURL,
    casa,
  }) => {
    // Seguito accettato dal coordinatore sulla PR #123 (issue #24): Spesa e Da fare non
    // leggono ancora le scadenze (colonne incrociate).
    test.skip(!isMobileProject(), "Il selettore c'è solo su mobile (390 px)");
    await seedBase(casa);
    await open(page, baseURL, casa);
    for (const path of ["/casa/spesa", "/casa/da-fare"]) {
      await page.goto(path);
      await expect(switcher(page)).toBeVisible();
      await expect(
        switcherVoice(page, "Scadenze").locator(".selettore__conteggio"),
      ).toHaveText("4");
    }
  });
});

// ------------------------------------------------------ rows, order and texts

test.describe("righe, ordine e testi", () => {
  test("CA-8: una sola sezione «Prossime» con le quattro righe in ordine di data", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seedBase(casa);
    await open(page, baseURL, casa);
    await expect(col(page).getByRole("heading", { level: 3 })).toHaveText([
      "Prossime",
    ]);
    await expect(section(page).locator(".sezione__info").first()).toHaveText(
      "in ordine di data",
    );
    await expect(titles(col(page))).toHaveText([CARTA, BISCOTTO, BOLLO, CASA]);
    const expected: [string, string, string, string, string][] = [
      [CARTA, "14", "giorni", "Serve per la gita, 3 novembre", "S"],
      [BISCOTTO, "31", "giorni", "20 novembre, se ne occupa Laura", "L"],
      [BOLLO, "48", "giorni", "7 dicembre", "M"],
      [CASA, "3", "mesi", "20 gennaio 2027", "M"],
    ];
    for (const [title, number, unit, info, avatar] of expected) {
      await expect(numberOf(page, title)).toHaveText(number);
      await expect(unitOf(page, title)).toHaveText(unit);
      await expect(infoOf(page, title)).toHaveText(info);
      await expect(avatarOf(page, title)).toHaveText(avatar);
    }
  });

  test("CA-9: solo la prima riga ha il pallino urgente e l'informazione in rosso", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seedBase(casa);
    await open(page, baseURL, casa);
    await expect(col(page).getByTestId("pallino-urgente")).toHaveCount(1);
    await expect(dotOf(page, CARTA)).toHaveCount(1);
    const red = await alertColor(page);
    expect(await colorOf(infoOf(page, CARTA))).toBe(red);
    for (const title of [BISCOTTO, BOLLO, CASA]) {
      await expect(dotOf(page, title)).toHaveCount(0);
      expect(await colorOf(infoOf(page, title))).not.toBe(red);
    }
  });

  test("CA-10: giorni, mesi e soglia dell'urgente (14 sì, 15 no)", async ({
    page,
    baseURL,
    casa,
  }) => {
    const dates = [
      ["Prima scadenza", "2026-10-21"],
      ["Seconda scadenza", "2026-11-03"],
      ["Terza scadenza", "2026-11-04"],
      ["Quarta scadenza", "2026-12-18"],
      ["Quinta scadenza", "2026-12-19"],
      ["Sesta scadenza", "2026-12-20"],
    ] as const;
    for (const [title, due] of dates)
      await casa.deadline("Marco", { title, due });
    await open(page, baseURL, casa);
    await expect(titles(col(page))).toHaveText(dates.map(([title]) => title));
    const expected = [
      ["1", "giorno", true],
      ["14", "giorni", true],
      ["15", "giorni", false],
      ["59", "giorni", false],
      ["60", "giorni", false],
      ["2", "mesi", false],
    ] as const;
    for (const [index, [number, unit, urgent]] of expected.entries()) {
      const title = dates[index]![0];
      await expect(numberOf(page, title)).toHaveText(number);
      await expect(unitOf(page, title)).toHaveText(unit);
      await expect(dotOf(page, title)).toHaveCount(urgent ? 1 : 0);
    }
  });

  test("CA-11: scadute e di oggi in cima, tutte urgenti e in rosso", async ({
    page,
    baseURL,
    casa,
  }) => {
    await casa.deadline("Marco", { title: "Oggi scade", due: "2026-10-20" });
    await casa.deadline("Marco", { title: "Scaduta ieri", due: "2026-10-19" });
    await casa.deadline("Marco", {
      title: "Scaduta da cinque",
      due: "2026-10-15",
    });
    await casa.deadline("Marco", { title: "Più avanti", due: "2026-12-01" });
    await open(page, baseURL, casa);
    await expect(titles(col(page))).toHaveText([
      "Scaduta da cinque",
      "Scaduta ieri",
      "Oggi scade",
      "Più avanti",
    ]);
    const red = await alertColor(page);
    await expect(numberOf(page, "Scaduta da cinque")).toHaveText("5");
    await expect(unitOf(page, "Scaduta da cinque")).toHaveText("giorni fa");
    await expect(infoOf(page, "Scaduta da cinque")).toHaveText(
      "Scaduto il 15 ottobre",
    );
    await expect(numberOf(page, "Scaduta ieri")).toHaveText("1");
    await expect(unitOf(page, "Scaduta ieri")).toHaveText("giorno fa");
    await expect(infoOf(page, "Scaduta ieri")).toHaveText("Scaduto ieri");
    await expect(numberOf(page, "Oggi scade")).toHaveText("Oggi");
    await expect(unitOf(page, "Oggi scade")).toHaveCount(0);
    await expect(infoOf(page, "Oggi scade")).toHaveText("20 ottobre");
    for (const title of ["Scaduta da cinque", "Scaduta ieri", "Oggi scade"]) {
      await expect(dotOf(page, title)).toHaveCount(1);
      expect(await colorOf(infoOf(page, title))).toBe(red);
    }
    // Class of the specification (section 2) for the word «Oggi».
    await expect(numberOf(page, "Oggi scade")).toHaveClass(
      /riga-scadenza__numero--parola/,
    );
  });

  test("CA-12: a mezzanotte e mezza in Italia il conto dei giorni è quello di Roma", async ({
    page,
    baseURL,
    casa,
  }) => {
    // mercoledì 21 ottobre 2026, 00:30 a Roma: in UTC è ancora il 20 ottobre.
    await casa.deadline("Marco", { title: CARTA, due: "2026-11-03" });
    await open(page, baseURL, casa, {
      time: new Date("2026-10-20T22:30:00Z"),
    });
    await expect(numberOf(page, CARTA)).toHaveText("13");
    await expect(unitOf(page, CARTA)).toHaveText("giorni");
  });

  test("CA-13: a pari data la più vecchia per creazione sta sopra", async ({
    page,
    baseURL,
    casa,
  }) => {
    await casa.deadline("Marco", { title: "Prima creata", due: "2026-12-07" });
    await casa.deadline("Marco", {
      title: "Seconda creata",
      due: "2026-12-07",
    });
    await open(page, baseURL, casa);
    await expect(titles(col(page))).toHaveText([
      "Prima creata",
      "Seconda creata",
    ]);
  });

  test("CA-14: informazione e avatar di chi se ne occupa; senza nessuno la riga non ha avatar", async ({
    page,
    baseURL,
    casa,
  }) => {
    await casa.deadline("Marco", {
      title: "Rinnovo abbonamento del bus",
      due: "2026-11-30",
      assignee: "Sofia",
      forMember: "Tommaso",
    });
    await casa.deadline("Marco", {
      title: "Rinnovo del domino",
      due: "2026-11-30",
    });
    await open(page, baseURL, casa);
    await expect(infoOf(page, "Rinnovo abbonamento del bus")).toHaveText(
      "30 novembre, se ne occupa Sofia",
    );
    await expect(avatarOf(page, "Rinnovo abbonamento del bus")).toHaveText("S");
    await expect(infoOf(page, "Rinnovo del domino")).toHaveText("30 novembre");
    await expect(avatarOf(page, "Rinnovo del domino")).toHaveCount(0);
  });

  test("CA-15: le righe non sono né link né bottoni (fino alla #22)", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seedBase(casa);
    await open(page, baseURL, casa);
    for (const title of [CARTA, BISCOTTO, BOLLO, CASA]) {
      await expect(page.getByRole("link", { name: title })).toHaveCount(0);
      await expect(page.getByRole("button", { name: title })).toHaveCount(0);
    }
    await expect(col(page).getByRole("link")).toHaveCount(0);
    await expect(col(page).getByRole("button")).toHaveCount(0);
  });

  test("Extra (decisione del coordinatore): scaduta da più di 60 giorni si conta in mesi, «3 mesi fa»", async ({
    page,
    baseURL,
    casa,
  }) => {
    // 20 luglio 2026 -> 92 giorni prima di oggi: 3 mesi.
    // Decision of the coordinator (30/10): the unit is «mesi fa».
    await casa.deadline("Marco", {
      title: "Rinnovare il passaporto",
      due: "2026-07-20",
    });
    await open(page, baseURL, casa);
    await expect(numberOf(page, "Rinnovare il passaporto")).toHaveText("3");
    await expect(unitOf(page, "Rinnovare il passaporto")).toHaveText("mesi fa");
    await expect(dotOf(page, "Rinnovare il passaporto")).toHaveCount(1);
  });
});

// ------------------------------------------------- «Solo io» (decisione 30/10)

test.describe("«Solo io»", () => {
  test("Extra: una scadenza «Solo io» ha «solo tu», il lucchetto e l'avatar di Marco", async ({
    page,
    baseURL,
    casa,
  }) => {
    // No numbered CA for «Solo io» (decision of Francesco, 30/10).
    await casa.deadline("Marco", {
      title: "Rinnovo del passaporto",
      due: "2027-01-12",
      priv: true,
      assignee: "Marco",
    });
    await open(page, baseURL, casa);
    await expect(numberOf(page, "Rinnovo del passaporto")).toHaveText("2");
    await expect(unitOf(page, "Rinnovo del passaporto")).toHaveText("mesi");
    await expect(infoOf(page, "Rinnovo del passaporto")).toHaveText(
      "12 gennaio 2027, solo tu",
    );
    await expect(
      rowOf(page, "Rinnovo del passaporto").getByTestId("lucchetto"),
    ).toHaveCount(1);
    await expect(avatarOf(page, "Rinnovo del passaporto")).toHaveText("M");
  });

  test("Extra: la «Solo io» di Giulia non si vede, non si conta nel selettore né in «N urgenti» per Paolo", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await bianchi.deadline("Giulia", {
      title: "Rinnovo riservato",
      due: "2026-10-25",
      priv: true,
    });
    await open(page, baseURL, bianchi, {
      who: "Paolo",
      ready: emptyTitle(page),
    });
    await expect(page.getByText("Rinnovo riservato")).toHaveCount(0);
    if (isMobileProject()) {
      await expect(
        switcherVoice(page, "Scadenze").locator(".selettore__conteggio"),
      ).toHaveCount(0);
    } else {
      await expect(columnInfo(page)).toHaveCount(0);
    }
  });
});

// ------------------------------------------------------ desktop column, filter

test.describe("colonna desktop e filtri", () => {
  test("CA-16: «1 urgente» e, con due scadenze in più, «3 urgenti»", async ({
    page,
    baseURL,
    casa,
  }) => {
    test.skip(isMobileProject(), "Caso a 1280 px");
    await seedBase(casa);
    await open(page, baseURL, casa);
    await expect(columnInfo(page)).toHaveText("1 urgente");
    await casa.deadline("Marco", { title: "Scaduta ieri", due: "2026-10-19" });
    await casa.deadline("Marco", { title: "Scade oggi", due: "2026-10-20" });
    await page.goto(PATH);
    await expect(rows(page)).toHaveCount(6);
    await expect(columnInfo(page)).toHaveText("3 urgenti");
  });

  test.fixme("CA-17: i chip «Laura» e «Tommaso» non filtrano la colonna «Scadenze»", async ({
    page,
    baseURL,
    casa,
  }) => {
    // Seguito accettato dal coordinatore sulla PR #123 (issue #24): i chip su desktop non sono ancora
    // collegati alla pagina Scadenze (arrivano con la #23).
    test.skip(isMobileProject(), "Caso a 1280 px");
    await seedBase(casa);
    await open(page, baseURL, casa);
    for (const name of ["Laura", "Tommaso"]) {
      await filterGroup(page)
        .getByRole("button", { name, exact: true })
        .click();
      await expect(
        filterGroup(page).getByRole("button", { name, exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
      await expect(titles(col(page))).toHaveText([
        CARTA,
        BISCOTTO,
        BOLLO,
        CASA,
      ]);
      await expect(columnInfo(page)).toHaveText("1 urgente");
    }
  });

  test("CA-18: niente campo «Aggiungi una scadenza…» e niente avviso «Ti avvisiamo…»", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seedBase(casa);
    await open(page, baseURL, casa);
    await expect(
      page.getByRole("textbox", { name: "Aggiungi una scadenza…" }),
    ).toHaveCount(0);
    await expect(col(page)).not.toContainText("Aggiungi una scadenza…");
    await expect(
      page.getByText("Ti avvisiamo 30, 7 e 1 giorno prima.", { exact: false }),
    ).toHaveCount(0);
  });
});

// --------------------------------------------------------------- empty state

test.describe("stato vuoto", () => {
  test("CA-19: senza scadenze (mobile): messaggio, bottone, niente «Prossime» né numero", async ({
    page,
    baseURL,
    casa,
  }) => {
    test.skip(!isMobileProject(), "Caso a 390 px");
    await open(page, baseURL, casa, { ready: emptyTitle(page) });
    await expect(emptyTitle(page)).toBeVisible();
    await expect(page.getByText(EMPTY_TEXT)).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Aggiungi una scadenza" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 3, name: "Prossime" }),
    ).toHaveCount(0);
    await expect(
      switcherVoice(page, "Scadenze").locator(".selettore__conteggio"),
    ).toHaveCount(0);
    await expect(page.getByText(/vaccini|certificati/i)).toHaveCount(0);
  });

  test("CA-20: senza scadenze (desktop): stesso messaggio, senza «urgente»", async ({
    page,
    baseURL,
    casa,
  }) => {
    test.skip(isMobileProject(), "Caso a 1280 px");
    await open(page, baseURL, casa, { ready: emptyTitle(page) });
    await expect(col(page)).toContainText("Nessuna scadenza");
    await expect(col(page)).toContainText(EMPTY_TEXT);
    await expect(col(page)).not.toContainText(/urgent[ei]/);
  });

  test("CA-21: «Aggiungi una scadenza» porta dove porta «Aggiungi» della navigazione", async ({
    page,
    baseURL,
    casa,
  }) => {
    await open(page, baseURL, casa, { ready: emptyTitle(page) });
    // Today /aggiungi; #22 will open Aggiungi with the type Scadenza.
    await page
      .getByRole("link", { name: "Aggiungi una scadenza", exact: true })
      .click();
    await expect(page).toHaveURL(/\/aggiungi/);
  });
});

// ----------------------------------------------------------------- isolation

test.describe("isolamento tra Nest", () => {
  test("CA-22: Marco non vede la scadenza di Casa Bianchi e il selettore non la conta", async ({
    page,
    baseURL,
    casa,
    bianchi,
  }) => {
    await seedBase(casa);
    await bianchi.deadline("Giulia", {
      title: "Revisione della caldaia",
      due: "2026-11-10",
    });
    await open(page, baseURL, casa);
    await expect(rows(page)).toHaveCount(4);
    await expect(page.getByText("Revisione della caldaia")).toHaveCount(0);
    if (isMobileProject()) {
      await expect(
        switcherVoice(page, "Scadenze").locator(".selettore__conteggio"),
      ).toHaveText("4");
    }
  });

  test("CA-23: via API Marco non legge, non modifica, non cancella e non crea nel Nest di Giulia", async ({
    casa,
    bianchi,
  }) => {
    const foreignId = await bianchi.deadline("Giulia", {
      title: "Revisione della caldaia",
      due: "2026-11-10",
    });
    const marco = casa.users["Marco"]!.client;
    const read = await marco.from("deadlines").select("id").eq("id", foreignId);
    expect(read.error).toBeNull();
    expect(read.data).toHaveLength(0);
    const changed = await marco
      .from("deadlines")
      .update({ title: "Cambiata" }, { count: "exact" })
      .eq("id", foreignId);
    expect(changed.count ?? 0).toBe(0);
    const removed = await marco
      .from("deadlines")
      .delete({ count: "exact" })
      .eq("id", foreignId);
    expect(removed.count ?? 0).toBe(0);
    const created = await marco.from("deadlines").insert({
      household_id: bianchi.householdId,
      title: "Intrusa",
      due_date: "2026-11-11",
    });
    expect(created.error).not.toBeNull();
    expect((await bianchi.deadlineRows()).map((r) => r.title)).toEqual([
      "Revisione della caldaia",
    ]);

    // A visitor without a session reads nothing.
    const anonymous = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const anon = await anonymous.from("deadlines").select("id");
    expect(anon.data ?? []).toHaveLength(0);
  });

  test("CA-24: Marco non può creare una scadenza che riguarda Leo o di cui si occupa Anna", async ({
    casa,
    bianchi,
  }) => {
    const marco = casa.users["Marco"]!.client;
    const forLeo = await marco.from("deadlines").insert({
      title: "Per Leo",
      due_date: "2026-11-11",
      for_member_id: bianchi.members["Leo"],
    });
    expect(forLeo.error).not.toBeNull();
    const byAnna = await marco.from("deadlines").insert({
      title: "Da Anna",
      due_date: "2026-11-11",
      assignee_member_id: bianchi.members["Anna"],
    });
    expect(byAnna.error).not.toBeNull();
    expect(await casa.deadlineRows()).toHaveLength(0);
    expect(await bianchi.deadlineRows()).toHaveLength(0);
  });
});

// ------------------------------------------------------- loading and errors

test.describe("caricamento ed errori", () => {
  test("CA-25: durante la lettura rallentata: selettore senza numeri e contenitore aria-busy (mobile)", async ({
    page,
    baseURL,
    casa,
  }) => {
    test.skip(!isMobileProject(), "Caso a 390 px");
    await seedBase(casa);
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(/\/rest\/v1\/deadlines/, async (route) => {
      await gate;
      await route.continue();
    });
    await setClock(page, TODAY);
    await casa.signIn(page, baseURL, "Marco");
    await page.goto(PATH);
    await expect(busy(page)).toHaveCount(1);
    await expect(busy(page)).toContainText("Caricamento in corso");
    await expect(switcher(page)).toBeVisible();
    await expect(switcher(page).locator(".selettore__conteggio")).toHaveCount(
      0,
    );
    await expect(rows(page)).toHaveCount(0);
    await expect(emptyTitle(page)).toHaveCount(0);
    release();
    await expect(rows(page)).toHaveCount(4, { timeout: 20_000 });
    await expect(busy(page)).toHaveCount(0);
  });

  test("CA-26: se la lettura fallisce c'è l'errore di pagina; «Riprova» a lettura tornata mostra la lista (mobile)", async ({
    page,
    baseURL,
    casa,
  }) => {
    test.skip(!isMobileProject(), "Caso a 390 px");
    await seedBase(casa);
    await page.route(/\/rest\/v1\/deadlines/, async (route) => {
      if (route.request().method() === "OPTIONS") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        headers: CORS,
        body: JSON.stringify({
          code: "XX000",
          message: "boom internal detail",
        }),
      });
    });
    await setClock(page, TODAY);
    await casa.signIn(page, baseURL, "Marco");
    await page.goto(PATH);
    const error = alerts(page);
    await expect(error).toContainText("Questa pagina non si è caricata");
    await expect(error.getByRole("button", { name: "Riprova" })).toBeVisible();
    await expect(error).not.toContainText("boom");
    await expect(error).not.toContainText("XX000");
    await expect(page.getByText(CARTA)).toHaveCount(0);
    await page.unroute(/\/rest\/v1\/deadlines/);
    await error.getByRole("button", { name: "Riprova" }).click();
    await expect(rows(page)).toHaveCount(4, { timeout: 20_000 });
    await expect(alerts(page)).toHaveCount(0);
  });

  test("CA-27: su desktop se falliscono solo le scadenze, la colonna mostra l'errore e «Riprova» rimette la lista", async ({
    page,
    baseURL,
    casa,
  }) => {
    test.skip(isMobileProject(), "Caso a 1280 px");
    await seedBase(casa);
    await page.route(/\/rest\/v1\/deadlines/, async (route) => {
      if (route.request().method() === "OPTIONS") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        headers: CORS,
        body: JSON.stringify({
          code: "XX000",
          message: "boom internal detail",
        }),
      });
    });
    await open(page, baseURL, casa, { ready: col(page) });
    const error = col(page).getByRole("alert").filter({ hasText: /\S/ });
    await expect(error).toContainText(
      "Non riusciamo a caricare le scadenze. Controlla la connessione e riprova.",
    );
    await expect(error).not.toContainText("boom");
    await page.unroute(/\/rest\/v1\/deadlines/);
    await error.getByRole("button", { name: "Riprova" }).click();
    await expect(rows(page)).toHaveCount(4, { timeout: 20_000 });
  });

  test.fixme("CA-27 (parte): in /casa/spesa su desktop se falliscono solo le scadenze, la colonna mostra l'errore e la Spesa resta usabile", async ({
    page,
    baseURL,
    casa,
  }) => {
    // Seguito accettato dal coordinatore sulla PR #123 (issue #24): Spesa non ha ancora la colonna
    // Scadenze (colonne incrociate).
    test.skip(isMobileProject(), "Caso a 1280 px");
    await seedBase(casa);
    await casa.shopping("Marco", ["Latte", "Pane"]);
    await page.route(/\/rest\/v1\/deadlines/, async (route) => {
      if (route.request().method() === "OPTIONS") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        headers: CORS,
        body: JSON.stringify({
          code: "XX000",
          message: "boom internal detail",
        }),
      });
    });
    await open(page, baseURL, casa, {
      path: "/casa/spesa",
      ready: column(page, "Spesa"),
    });
    const error = col(page).getByRole("alert").filter({ hasText: /\S/ });
    await expect(error).toContainText(
      "Non riusciamo a caricare le scadenze. Controlla la connessione e riprova.",
    );
    await expect(error.getByRole("button", { name: "Riprova" })).toBeVisible();
    await expect(error).not.toContainText("boom");
    await expect(titles(column(page, "Spesa"))).toHaveText(["Latte", "Pane"]);
    await page.unroute(/\/rest\/v1\/deadlines/);
    await error.getByRole("button", { name: "Riprova" }).click();
    await expect(rows(page)).toHaveCount(4, { timeout: 20_000 });
  });

  test("CA-28: offline a pagina caricata le righe restano e non compare nessun avviso (mobile)", async ({
    page,
    baseURL,
    casa,
  }) => {
    test.skip(!isMobileProject(), "Caso a 390 px");
    await seedBase(casa);
    await open(page, baseURL, casa);
    await expect(rows(page)).toHaveCount(4);
    await page.context().setOffline(true);
    await expect(rows(page)).toHaveCount(4);
    await expect(alerts(page)).toHaveCount(0);
    await page.context().setOffline(false);
  });
});
