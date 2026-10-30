import { type Locator, type Page } from "@playwright/test";
import {
  addDays,
  alerts,
  column,
  CORS,
  expect,
  filterGroup,
  isMobileProject,
  OFFLINE_ALERT,
  romeDay,
  switcher,
  switcherVoice,
  test,
  type CasaNest,
} from "../fixtures/casa";

// Casa · integrazione delle tre pagine (#128, PR #139): Spesa, Da fare e
// Scadenze sono una sola pagina con tre colonne. Questi test non ripetono i
// criteri delle pagine (#21, #23, #24): verificano la parte che le unisce, in
// ogni pagina e in ogni disposizione.
//
// Dati: ogni test usa il proprio Nest usa e getta (fixtures/casa.ts). Le date
// dei dati sono relative a oggi (Europe/Rome), nessun orologio fisso.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

type Section = "spesa" | "da-fare" | "scadenze";
const PAGES: { section: Section; path: string; label: string }[] = [
  { section: "spesa", path: "/casa/spesa", label: "Spesa" },
  { section: "da-fare", path: "/casa/da-fare", label: "Da fare" },
  { section: "scadenze", path: "/casa/scadenze", label: "Scadenze" },
];

const SHOPPING = ["Latte", "Pane"];
const TODOS = ["Chiamare l'idraulico", "Ritirare il pacco", "Pagare la mensa"];
const DEADLINES = ["Bollo dell'auto", "Assicurazione della casa"];

const PAGE_ERROR = "Questa pagina non si è caricata";
const COLUMN_ERROR: Record<Section, string> = {
  spesa: "Non riusciamo a caricare la spesa.",
  "da-fare": "Non riusciamo a caricare le cose da fare.",
  scadenze: "Non riusciamo a caricare le scadenze.",
};
const TABLE: Record<Section, RegExp> = {
  spesa: /\/rest\/v1\/shopping_items/,
  "da-fare": /\/rest\/v1\/todos/,
  scadenze: /\/rest\/v1\/deadlines/,
};
const LABEL: Record<Section, "Spesa" | "Da fare" | "Scadenze"> = {
  spesa: "Spesa",
  "da-fare": "Da fare",
  scadenze: "Scadenze",
};

// ------------------------------------------------------------------ helpers

const titles = (scope: Locator) => scope.locator(".riga-lista__titolo");
const region = (page: Page, section: Section) => column(page, LABEL[section]);

/** The page is drawn: the h1 of the page (never the first `main` seen). */
async function waitForPage(page: Page): Promise<void> {
  await expect(
    page.getByRole("heading", { level: 1, name: "Casa" }),
  ).toBeVisible({ timeout: 20_000 });
}

async function signInAndOpen(
  page: Page,
  baseURL: string | undefined,
  nest: CasaNest,
  who: string,
  path: string,
): Promise<void> {
  await nest.signIn(page, baseURL, who);
  await page.goto(path);
}

async function seedD(casa: CasaNest): Promise<void> {
  const today = romeDay();
  await casa.shopping("Marco", SHOPPING);
  for (const [index, title] of TODOS.entries()) {
    await casa.todo("Marco", {
      title,
      assignee: "Marco",
      due: addDays(today, 2 + index),
    });
  }
  await casa.deadline("Marco", {
    title: DEADLINES[0]!,
    due: addDays(today, 20),
    assignee: "Marco",
  });
  await casa.deadline("Marco", {
    title: DEADLINES[1]!,
    due: addDays(today, 60),
    assignee: "Marco",
  });
}

/** Expects the three real columns, each with its own rows. */
async function expectThreeColumns(page: Page): Promise<void> {
  await expect(titles(region(page, "spesa"))).toHaveText(SHOPPING);
  for (const title of TODOS) {
    await expect(
      titles(region(page, "da-fare")).filter({ hasText: title }),
    ).toHaveCount(1);
  }
  await expect(titles(region(page, "da-fare"))).toHaveCount(TODOS.length);
  await expect(titles(region(page, "scadenze"))).toHaveText(DEADLINES);
  for (const section of ["spesa", "da-fare", "scadenze"] as const) {
    await expect(
      region(page, section).getByRole("heading", {
        level: 2,
        name: LABEL[section],
      }),
    ).toBeVisible();
    await expect(region(page, section).getByText("In arrivo")).toHaveCount(0);
  }
}

/**
 * Makes the REST reads of the lists in `failing` fail with a database error,
 * the others go through. The set can change between one page load and the next.
 */
async function failLists(page: Page): Promise<Set<Section>> {
  const failing = new Set<Section>();
  await page.route(/\/rest\/v1\/(shopping_items|todos|deadlines)/, (route) => {
    const request = route.request();
    const url = request.url();
    const section = (Object.keys(TABLE) as Section[]).find((key) =>
      TABLE[key].test(url),
    );
    if (
      request.method() === "OPTIONS" ||
      !section ||
      !failing.has(section) ||
      request.method() !== "GET"
    ) {
      return route.continue();
    }
    return route.fulfill({
      status: 500,
      contentType: "application/json",
      headers: CORS,
      body: JSON.stringify({ code: "XX000", message: "boom internal detail" }),
    });
  });
  return failing;
}

// ----------------------------------------------------- three columns, desktop

test.describe("tre colonne vere (desktop)", () => {
  for (const { path } of PAGES) {
    test(`CA-6: /casa/${path.split("/").pop()} ha le colonne Spesa, Da fare e Scadenze con le loro righe, senza «In arrivo»`, async ({
      page,
      baseURL,
      casa,
    }) => {
      test.skip(isMobileProject(), "Le tre colonne ci sono solo a 1280 px");
      await seedD(casa);
      await signInAndOpen(page, baseURL, casa, "Marco", path);
      await waitForPage(page);
      await expect(
        page.getByRole("heading", { level: 1, name: "Casa" }),
      ).toHaveCount(1);
      await expectThreeColumns(page);
      await expect(page.getByText("In arrivo")).toHaveCount(0);
      await expect(switcher(page)).toHaveCount(0);
    });
  }
});

// ------------------------------------------------------ switcher numbers, mobile

test.describe("numeri del selettore (mobile)", () => {
  for (const { path } of PAGES) {
    test(`CA-7: in /casa/${path.split("/").pop()} il selettore mostra i numeri di Spesa, Da fare e Scadenze`, async ({
      page,
      baseURL,
      casa,
    }) => {
      test.skip(!isMobileProject(), "Il selettore c'è solo su mobile (390 px)");
      await seedD(casa);
      await signInAndOpen(page, baseURL, casa, "Marco", path);
      await waitForPage(page);
      await expect(switcher(page)).toBeVisible();
      await expect(
        switcherVoice(page, "Spesa").locator(".selettore__conteggio"),
      ).toHaveText(String(SHOPPING.length));
      await expect(
        switcherVoice(page, "Da fare").locator(".selettore__conteggio"),
      ).toHaveText(String(TODOS.length));
      await expect(
        switcherVoice(page, "Scadenze").locator(".selettore__conteggio"),
      ).toHaveText(String(DEADLINES.length));
    });
  }

  test("CA-7: i numeri non cambiano passando da una pagina all'altra dal selettore", async ({
    page,
    baseURL,
    casa,
  }) => {
    test.skip(!isMobileProject(), "Il selettore c'è solo su mobile (390 px)");
    await seedD(casa);
    await signInAndOpen(page, baseURL, casa, "Marco", "/casa/spesa");
    await waitForPage(page);
    for (const { label, path } of PAGES.slice(1)) {
      await switcherVoice(page, label).click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await waitForPage(page);
      await expect(
        switcherVoice(page, "Spesa").locator(".selettore__conteggio"),
      ).toHaveText(String(SHOPPING.length));
      await expect(
        switcherVoice(page, "Da fare").locator(".selettore__conteggio"),
      ).toHaveText(String(TODOS.length));
      await expect(
        switcherVoice(page, "Scadenze").locator(".selettore__conteggio"),
      ).toHaveText(String(DEADLINES.length));
    }
  });
});

// ------------------------------------------------------------------- the chips

test.describe("chip «Filtra per persona»", () => {
  test("CA-5 e CA-17: in Scadenze (desktop) i chip ci sono ma non filtrano la colonna Scadenze", async ({
    page,
    baseURL,
    casa,
  }) => {
    test.skip(isMobileProject(), "Caso a 1280 px");
    await seedD(casa);
    await casa.deadline("Marco", {
      title: "Dentista di Laura",
      due: addDays(romeDay(), 30),
      assignee: "Laura",
    });
    await signInAndOpen(page, baseURL, casa, "Marco", "/casa/scadenze");
    await waitForPage(page);
    await expect(filterGroup(page)).toBeVisible();
    for (const name of ["Tutti", "Miei", "Laura", "Sofia", "Tommaso"]) {
      await expect(
        filterGroup(page).getByRole("button", { name, exact: true }),
      ).toBeVisible();
    }
    const before = await titles(region(page, "scadenze")).allTextContents();
    expect(before).toHaveLength(3);
    for (const name of ["Laura", "Tommaso", "Miei"]) {
      const chip = filterGroup(page).getByRole("button", {
        name,
        exact: true,
      });
      await chip.click();
      await expect(chip).toHaveAttribute("aria-pressed", "true");
      await expect(titles(region(page, "scadenze"))).toHaveText(before);
    }
  });

  test("CA-5: i chip ci sono in intestazione in tutte e tre le pagine (desktop)", async ({
    page,
    baseURL,
    casa,
  }) => {
    test.skip(isMobileProject(), "Caso a 1280 px");
    await seedD(casa);
    await casa.signIn(page, baseURL, "Marco");
    for (const { path } of PAGES) {
      await page.goto(path);
      await waitForPage(page);
      await expect(filterGroup(page)).toHaveCount(1);
      await expect(
        filterGroup(page).getByRole("button", { name: "Tutti", exact: true }),
      ).toBeVisible();
    }
  });

  test("CA-3: su mobile i chip ci sono solo in Da fare, non in Spesa né in Scadenze", async ({
    page,
    baseURL,
    casa,
  }) => {
    test.skip(!isMobileProject(), "Caso a 390 px");
    await seedD(casa);
    await casa.signIn(page, baseURL, "Marco");
    for (const { section, path } of PAGES) {
      await page.goto(path);
      await waitForPage(page);
      await expect(filterGroup(page)).toHaveCount(
        section === "da-fare" ? 1 : 0,
      );
    }
  });
});

// ------------------------------------------------------------ the error rules

test.describe("errori su desktop", () => {
  for (const { path } of PAGES) {
    test(`CA-27/CA-35/CA-42: in /casa/${path.split("/").pop()} l'errore di una colonna resta nella colonna; a pagina intera solo se non si legge niente`, async ({
      page,
      baseURL,
      casa,
    }) => {
      test.skip(isMobileProject(), "Caso a 1280 px");
      await seedD(casa);
      const failing = await failLists(page);
      await casa.signIn(page, baseURL, "Marco");
      const all: Section[] = ["spesa", "da-fare", "scadenze"];

      // One list at a time: the error is in its column, the others read.
      for (const broken of all) {
        failing.clear();
        failing.add(broken);
        await page.goto(path);
        await waitForPage(page);
        const error = region(page, broken)
          .getByRole("alert")
          .filter({ hasText: /\S/ });
        await expect(error).toContainText(COLUMN_ERROR[broken]);
        await expect(error).not.toContainText("boom");
        await expect(error).not.toContainText("XX000");
        await expect(
          error.getByRole("button", { name: "Riprova" }),
        ).toBeVisible();
        await expect(page.getByText(PAGE_ERROR)).toHaveCount(0);
        await expect(alerts(page)).toHaveCount(1);
        if (broken !== "spesa") {
          await expect(titles(region(page, "spesa"))).toHaveText(SHOPPING);
        }
        if (broken !== "scadenze") {
          await expect(titles(region(page, "scadenze"))).toHaveText(DEADLINES);
        }
        if (broken !== "da-fare") {
          await expect(titles(region(page, "da-fare"))).toHaveCount(
            TODOS.length,
          );
        }
      }

      // Two lists: still no page error, two column errors.
      failing.clear();
      failing.add("spesa");
      failing.add("scadenze");
      await page.goto(path);
      await waitForPage(page);
      await expect(page.getByText(PAGE_ERROR)).toHaveCount(0);
      await expect(alerts(page)).toHaveCount(2);
      await expect(titles(region(page, "da-fare"))).toHaveCount(TODOS.length);

      // Nothing can be read: the page error, no columns.
      failing.add("da-fare");
      await page.goto(path);
      await expect(alerts(page)).toContainText(PAGE_ERROR, {
        timeout: 20_000,
      });
      await expect(
        alerts(page).getByRole("button", { name: "Riprova" }),
      ).toBeVisible();
      for (const section of all) {
        await expect(region(page, section)).toHaveCount(0);
      }
      await expect(page.getByText(COLUMN_ERROR.spesa)).toHaveCount(0);

      // The way out of the error: «Riprova» reads again and the page is back.
      failing.clear();
      await alerts(page).getByRole("button", { name: "Riprova" }).click();
      await waitForPage(page);
      await expectThreeColumns(page);
    });
  }

  test("CA-27: «Riprova» di una colonna rilegge solo quella lista, senza ricaricare la pagina", async ({
    page,
    baseURL,
    casa,
  }) => {
    test.skip(isMobileProject(), "Caso a 1280 px");
    await seedD(casa);
    const failing = await failLists(page);
    failing.add("scadenze");
    await signInAndOpen(page, baseURL, casa, "Marco", "/casa/da-fare");
    await waitForPage(page);
    const error = region(page, "scadenze")
      .getByRole("alert")
      .filter({ hasText: /\S/ });
    await expect(error).toContainText(COLUMN_ERROR.scadenze);
    await page.evaluate(() => {
      (window as unknown as { __marker: string }).__marker = "same page";
    });
    failing.clear();
    await error.getByRole("button", { name: "Riprova" }).click();
    await expect(titles(region(page, "scadenze"))).toHaveText(DEADLINES, {
      timeout: 20_000,
    });
    await expect(alerts(page)).toHaveCount(0);
    expect(
      await page.evaluate(
        () => (window as unknown as { __marker?: string }).__marker,
      ),
    ).toBe("same page");
  });
});

test.describe("errori su mobile", () => {
  for (const { section, path } of PAGES) {
    test(`CA-26/CA-35/CA-42: in /casa/${path.split("/").pop()} se non si legge la lista della pagina c'è l'errore a pagina intera; se si rompono le altre due no`, async ({
      page,
      baseURL,
      casa,
    }) => {
      test.skip(!isMobileProject(), "Caso a 390 px");
      await seedD(casa);
      const failing = await failLists(page);
      await casa.signIn(page, baseURL, "Marco");

      // The lists of the other columns are not needed here: no page error.
      for (const other of ["spesa", "da-fare", "scadenze"] as const) {
        if (other !== section) failing.add(other);
      }
      await page.goto(path);
      await waitForPage(page);
      await expect(page.getByText(PAGE_ERROR)).toHaveCount(0);
      await expect(alerts(page)).toHaveCount(0);
      if (section === "spesa") {
        await expect(titles(region(page, "spesa"))).toHaveText(SHOPPING);
      } else if (section === "scadenze") {
        await expect(titles(region(page, "scadenze"))).toHaveText(DEADLINES);
      } else {
        await expect(titles(region(page, "da-fare"))).toHaveCount(TODOS.length);
      }

      // The list of the page itself: the page error, with no technical detail.
      failing.clear();
      failing.add(section);
      await page.goto(path);
      await expect(alerts(page)).toContainText(PAGE_ERROR, {
        timeout: 20_000,
      });
      await expect(alerts(page)).not.toContainText("boom");
      await expect(alerts(page)).not.toContainText("XX000");
      await expect(switcher(page)).toHaveCount(0);
      await expect(
        alerts(page).getByRole("button", { name: "Riprova" }),
      ).toBeVisible();
    });
  }
});

// ------------------------------------------------------------------- the focus

test.describe("fuoco quando sparisce l'avviso offline", () => {
  test("a11y: sparito l'avviso offline con il fuoco su «Riprova», il fuoco va su un titolo della colonna (Da fare, desktop)", async ({
    page,
    baseURL,
    casa,
  }) => {
    test.skip(isMobileProject(), "Caso a 1280 px");
    await seedD(casa);
    await signInAndOpen(page, baseURL, casa, "Marco", "/casa/da-fare");
    await waitForPage(page);
    await expect(titles(region(page, "da-fare"))).toHaveCount(TODOS.length);
    await page.context().setOffline(true);
    await page
      .getByRole("checkbox", { name: `Segna come fatto: ${TODOS[0]}` })
      .click();
    const offline = alerts(page).filter({ hasText: OFFLINE_ALERT });
    await expect(offline).toBeVisible();
    await offline.getByRole("button", { name: "Riprova" }).focus();
    await page.context().setOffline(false);
    await expect(alerts(page)).toHaveCount(0, { timeout: 15_000 });
    // The element with the focus is gone: the frame hands the focus to a
    // heading, it is not lost on the body.
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.tagName))
      .toMatch(/^H[1-6]$/);
  });

  test("a11y: sparito l'avviso offline, il «Riprova» dell'errore di un'altra colonna tiene il fuoco (Da fare, desktop)", async ({
    page,
    baseURL,
    casa,
  }) => {
    test.skip(isMobileProject(), "Caso a 1280 px");
    await seedD(casa);
    const failing = await failLists(page);
    failing.add("scadenze");
    await signInAndOpen(page, baseURL, casa, "Marco", "/casa/da-fare");
    await waitForPage(page);
    const columnRetry = region(page, "scadenze").getByRole("button", {
      name: "Riprova",
    });
    await expect(columnRetry).toBeVisible();
    await page.context().setOffline(true);
    await page
      .getByRole("checkbox", { name: `Segna come fatto: ${TODOS[0]}` })
      .click();
    const offline = alerts(page).filter({ hasText: OFFLINE_ALERT });
    await expect(offline).toBeVisible();
    await expect(alerts(page)).toHaveCount(2);
    await columnRetry.focus();
    await page.context().setOffline(false);
    await expect(offline).toHaveCount(0, { timeout: 15_000 });
    // Only the offline alert is gone: the focus stays where it was.
    await expect(alerts(page)).toHaveCount(1);
    await expect(columnRetry).toBeFocused();
  });
});

// ---------------------------------------------------- «Solo io» of other people

test.describe("«Solo io» di un altro nelle colonne incrociate", () => {
  const PRIVATE_TODO = "Regalo a sorpresa per Paolo";
  const PRIVATE_DEADLINE = "Rinnovo riservato di Giulia";
  const SHARED_TODO = "Portare fuori il bidone";
  const SHARED_DEADLINE = "Revisione dell'auto";

  async function seedBianchi(bianchi: CasaNest): Promise<void> {
    const today = romeDay();
    await bianchi.todo("Giulia", {
      title: PRIVATE_TODO,
      priv: true,
      assignee: "Giulia",
      due: addDays(today, 2),
    });
    await bianchi.todo("Giulia", {
      title: SHARED_TODO,
      assignee: "Giulia",
      due: addDays(today, 3),
    });
    await bianchi.deadline("Giulia", {
      title: PRIVATE_DEADLINE,
      due: addDays(today, 5),
      priv: true,
      assignee: "Giulia",
    });
    await bianchi.deadline("Giulia", {
      title: SHARED_DEADLINE,
      due: addDays(today, 40),
      assignee: "Giulia",
    });
    await bianchi.shopping("Giulia", ["Caffè"]);
  }

  for (const { path } of PAGES) {
    test(`Extra: in /casa/${path.split("/").pop()} Paolo non vede le «Solo io» di Giulia in nessuna colonna e non le conta`, async ({
      page,
      baseURL,
      bianchi,
    }) => {
      await seedBianchi(bianchi);
      await signInAndOpen(page, baseURL, bianchi, "Paolo", path);
      await waitForPage(page);
      if (isMobileProject()) {
        await expect(switcher(page)).toBeVisible();
        // Only the shared rows are counted: 1 to buy, 1 thing to do, 1 deadline.
        await expect(
          switcherVoice(page, "Spesa").locator(".selettore__conteggio"),
        ).toHaveText("1");
        await expect(
          switcherVoice(page, "Da fare").locator(".selettore__conteggio"),
        ).toHaveText("1");
        await expect(
          switcherVoice(page, "Scadenze").locator(".selettore__conteggio"),
        ).toHaveText("1");
      } else {
        await expect(
          titles(region(page, "da-fare")).filter({ hasText: SHARED_TODO }),
        ).toHaveCount(1);
        await expect(
          titles(region(page, "scadenze")).filter({
            hasText: SHARED_DEADLINE,
          }),
        ).toHaveCount(1);
        await expect(titles(region(page, "da-fare"))).toHaveCount(1);
        await expect(titles(region(page, "scadenze"))).toHaveCount(1);
        await expect(
          region(page, "scadenze").getByTestId("lucchetto"),
        ).toHaveCount(0);
        await expect(
          region(page, "da-fare").getByTestId("lucchetto"),
        ).toHaveCount(0);
      }
      await expect(page.getByText(PRIVATE_TODO)).toHaveCount(0);
      await expect(page.getByText(PRIVATE_DEADLINE)).toHaveCount(0);
    });
  }

  test("Extra: Giulia vede le sue «Solo io» nelle colonne incrociate di /casa/spesa, con il lucchetto (desktop)", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    test.skip(isMobileProject(), "Caso a 1280 px");
    await seedBianchi(bianchi);
    await signInAndOpen(page, baseURL, bianchi, "Giulia", "/casa/spesa");
    await waitForPage(page);
    await expect(
      titles(region(page, "da-fare")).filter({ hasText: PRIVATE_TODO }),
    ).toHaveCount(1);
    await expect(
      titles(region(page, "scadenze")).filter({ hasText: PRIVATE_DEADLINE }),
    ).toHaveCount(1);
    await expect(region(page, "scadenze").getByTestId("lucchetto")).toHaveCount(
      1,
    );
    await expect(region(page, "da-fare").getByTestId("lucchetto")).toHaveCount(
      1,
    );
  });
});

// ------------------------------------------------------------ isolation, empty

test.describe("isolamento e stato vuoto", () => {
  test("Isolamento: Giulia (Casa Bianchi) non vede nelle tre colonne ciò che crea Marco (Casa D'Angelo)", async ({
    page,
    baseURL,
    casa,
    bianchi,
  }) => {
    test.skip(isMobileProject(), "Caso a 1280 px");
    await seedD(casa);
    await signInAndOpen(page, baseURL, bianchi, "Giulia", "/casa/spesa");
    await waitForPage(page);
    for (const text of [...SHOPPING, ...TODOS, ...DEADLINES]) {
      await expect(page.getByText(text, { exact: true })).toHaveCount(0);
    }
    await expect(page.getByText("Casa D'Angelo")).toHaveCount(0);
  });

  test("Isolamento: i numeri del selettore di Giulia non contano i dati di Casa D'Angelo (mobile)", async ({
    page,
    baseURL,
    casa,
    bianchi,
  }) => {
    test.skip(!isMobileProject(), "Il selettore c'è solo su mobile (390 px)");
    await seedD(casa);
    await signInAndOpen(page, baseURL, bianchi, "Giulia", "/casa/scadenze");
    await waitForPage(page);
    for (const label of ["Spesa", "Da fare", "Scadenze"]) {
      await expect(
        switcherVoice(page, label).locator(".selettore__conteggio"),
      ).toHaveCount(0);
    }
  });

  test("Stato vuoto: senza dati le tre colonne di desktop non dicono «In arrivo» e non c'è errore", async ({
    page,
    baseURL,
    casa,
  }) => {
    test.skip(isMobileProject(), "Caso a 1280 px");
    await signInAndOpen(page, baseURL, casa, "Marco", "/casa/scadenze");
    await waitForPage(page);
    for (const section of ["spesa", "da-fare", "scadenze"] as const) {
      await expect(region(page, section)).toBeVisible();
    }
    await expect(page.getByText("In arrivo")).toHaveCount(0);
    await expect(
      page.getByText("Nessuna scadenza", { exact: true }),
    ).toBeVisible();
    await expect(alerts(page)).toHaveCount(0);
  });
});
