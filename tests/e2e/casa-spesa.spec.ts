import {
  expect,
  test as plain,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";
import {
  signInAs,
  skipReason,
  usersConfigured,
  type TestUserKey,
} from "../fixtures/auth";
import {
  addShopping,
  apiAs,
  dragBlade,
  HOME_B,
  holdsFor,
  readShopping,
  takeShopping,
  tearShopping,
  test,
} from "../fixtures/spesa";

// Casa · Spesa (#21, PR #79): one test for every acceptance criterion.
//
// The tests with the test users need a seeded database (#55): they are skipped
// in CI while the remote project is not seeded, and are checked on a local
// Supabase (`npx supabase start`, `npm run seed:test-users`, see
// .env.example). Every test starts from empty lists, creates its own data
// through the API and leaves the lists empty (fixtures/spesa.ts). Desktop and
// mobile share the two Nests, so the tests run one at a time (lock).

const FIELD = /^(Aggiungi alla spesa…|Cosa manca in casa\?)$/;
const SAVE_FAILED =
  "Non siamo riusciti a salvare la modifica. Riprova tra qualche secondo.";
const OFFLINE_ALERT =
  "Sei offline: le cose che spunti partiranno appena torna la connessione.";
const COMMON = [
  "Latte",
  "Pane",
  "Uova",
  "Frutta",
  "Caffè",
  "Carta igienica",
] as const;

// ------------------------------------------------------------------- locators

const field = (page: Page) => page.getByRole("textbox", { name: FIELD });
const toTakeSection = (page: Page) => page.getByTestId("spesa-da-prendere");
const takenSection = (page: Page) => page.getByTestId("spesa-presi");
const commonSection = (page: Page) => page.getByTestId("spesa-piu-comuni");
const titles = (section: Locator) => section.locator(".riga-lista__titolo");
const toast = (page: Page) => page.getByRole("status");
// Next.js keeps an empty role="alert" (route announcer) in every page.
const alerts = (page: Page) =>
  page.getByRole("alert").filter({ hasText: /\S/ });
const blade = (page: Page) =>
  page.getByRole("button", { name: /^Togli dalla lista/ });
const chips = (page: Page) =>
  commonSection(page).getByRole("group", { name: "Le più comuni" });
const switcher = (page: Page) =>
  page.getByRole("group", { name: "Sezione della casa" });
const column = (page: Page) => page.getByRole("region", { name: "Spesa" });
const toTakeHeading = (page: Page) =>
  page.getByRole("heading", { level: 3, name: "Da prendere" });
const takenHeading = (page: Page) =>
  page.getByRole("heading", { level: 3, name: "Presi" });
const row = (section: Locator, name: string) =>
  section.getByRole("listitem").filter({ hasText: name });

function isMobile(testInfo: TestInfo): boolean {
  return testInfo.project.name === "mobile";
}

async function openSpesa(
  page: Page,
  baseURL: string | undefined,
  user: TestUserKey,
): Promise<void> {
  await signInAs(page.context(), baseURL as string, user);
  await page.goto("/casa/spesa");
  // On a busy machine the page can take longer than 5 s to read the list.
  await expect(field(page)).toBeVisible({ timeout: 20_000 });
}

/** A second browser of the same Nest, with the viewport of the project. */
async function openSecond(
  browser: Browser,
  baseURL: string | undefined,
  testInfo: TestInfo,
  user: TestUserKey,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    baseURL,
    viewport: testInfo.project.use.viewport ?? undefined,
  });
  const page = await context.newPage();
  await openSpesa(page, baseURL, user);
  return { context, page };
}

async function tearByClick(page: Page): Promise<void> {
  await blade(page).click();
  await expect(toast(page)).toBeVisible();
}

// ------------------------------------------------------- access and structure

plain.describe("accesso", () => {
  plain(
    "CA-1: senza sessione /casa/spesa porta a /accesso",
    async ({ page }) => {
      await page.goto("/casa/spesa");
      await expect(page).toHaveURL(/\/accesso$/);
    },
  );

  plain(
    "CA-2: l'utente C, senza Nest, viene portato su /onboarding",
    async ({ page, baseURL }) => {
      plain.skip(!usersConfigured("C"), skipReason("C"));
      await signInAs(page.context(), baseURL as string, "C");
      await page.goto("/casa/spesa");
      await expect(page).toHaveURL(/\/onboarding$/);
    },
  );
});

test.describe("struttura", () => {
  test("CA-3: /casa porta a /casa/spesa, titolo della scheda e un solo h1", async ({
    page,
    baseURL,
  }) => {
    await signInAs(page.context(), baseURL as string, "A");
    await page.goto("/casa");
    await expect(page).toHaveURL(/\/casa\/spesa$/);
    await expect(page).toHaveTitle("FamilyNest · Casa · Spesa");
    const headings = page.getByRole("heading", { level: 1 });
    await expect(headings).toHaveCount(1);
    await expect(headings).toHaveText("Casa");
  });

  test("CA-3: a pagina caricata c'è un solo landmark main, con id «contenuto»", async ({
    page,
    baseURL,
  }) => {
    await openSpesa(page, baseURL, "A");
    // While the page streams in, React 19 keeps the skeleton and the real page
    // (in a hidden div) for an instant: the accessibility tree has one main,
    // so the roles are the right way to count them.
    const main = page.getByRole("main");
    await expect(main).toHaveCount(1);
    await expect(main).toHaveAttribute("id", "contenuto");
  });

  test("CA-4: il selettore «Sezione della casa» e la voce Casa attiva", async ({
    page,
    baseURL,
  }, testInfo) => {
    test.skip(!isMobile(testInfo), "Il selettore c'è solo su mobile (390 px)");
    await openSpesa(page, baseURL, "A");
    const group = switcher(page);
    await expect(group).toBeVisible();
    const entries = group.locator(".selettore__voce");
    await expect(entries).toHaveText(["Spesa", "Da fare", "Scadenze"]);
    await expect(
      group.getByRole("button", { name: "Spesa", pressed: true }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("navigation", { name: "Navigazione principale" })
        .locator('[aria-current="page"]'),
    ).toHaveText(/Casa/);
  });

  test("CA-5: «Da fare» e «Scadenze» portano alle loro pagine", async ({
    page,
    baseURL,
  }, testInfo) => {
    test.skip(!isMobile(testInfo), "Il selettore c'è solo su mobile (390 px)");
    await openSpesa(page, baseURL, "A");
    await switcher(page).getByRole("link", { name: "Da fare" }).click();
    await expect(page).toHaveURL(/\/casa\/da-fare$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/casa\/spesa$/);
    await expect(field(page)).toBeVisible();
    await switcher(page).getByRole("link", { name: "Scadenze" }).click();
    await expect(page).toHaveURL(/\/casa\/scadenze$/);
  });

  test("CA-6: su desktop il nome del Nest sopra l'h1, la regione «Spesa» e nessun selettore", async ({
    page,
    baseURL,
  }, testInfo) => {
    test.skip(isMobile(testInfo), "Caso a 1280 px");
    await openSpesa(page, baseURL, "A");
    const nest = page.getByRole("main").getByText("Casa D'Angelo", {
      exact: true,
    });
    const h1 = page.getByRole("heading", { level: 1, name: "Casa" });
    await expect(nest).toBeVisible();
    await expect(h1).toBeVisible();
    const nestBox = await nest.boundingBox();
    const h1Box = await h1.boundingBox();
    expect(nestBox?.y).toBeLessThan(h1Box?.y ?? 0);
    await expect(
      column(page).getByRole("heading", { level: 2, name: "Spesa" }),
    ).toBeVisible();
    await expect(switcher(page)).toHaveCount(0);
  });
});

// ------------------------------------------------------------- list and order

test.describe("lista e ordine", () => {
  test("CA-7: Da prendere in ordine di aggiunta, con quantità, avatar e conteggi", async ({
    page,
    baseURL,
  }, testInfo) => {
    await addShopping("A", [
      { name: "Latte", quantity: "2 l" },
      "Pane",
      { name: "Mele", quantity: "1 kg" },
    ]);
    await openSpesa(page, baseURL, "A");
    const section = toTakeSection(page);
    await expect(titles(section)).toHaveText(["Latte", "Pane", "Mele"]);
    await expect(section.locator(".sezione__info")).toHaveText("3 cose");
    await expect(section.locator(".riga-lista__quantita")).toHaveText([
      "2 l",
      "",
      "1 kg",
    ]);
    await expect(section.locator(".avatar")).toHaveText(["M", "M", "M"]);
    if (isMobile(testInfo)) {
      await expect(switcher(page).locator(".selettore__conteggio")).toHaveText(
        "3",
      );
    } else {
      await expect(
        column(page)
          .locator(".sezione__testa")
          .first()
          .locator(".sezione__info"),
      ).toHaveText("3 da prendere");
    }
  });

  test("CA-8: spuntando Pane e poi Mele, Presi mostra Mele sopra Pane e i conteggi", async ({
    page,
    baseURL,
  }, testInfo) => {
    await addShopping("A", ["Latte", "Pane", "Mele"]);
    await openSpesa(page, baseURL, "A");
    await page.getByRole("checkbox", { name: "Preso: Pane" }).click();
    await expect(
      page.getByRole("checkbox", { name: "Preso: Pane" }),
    ).toHaveCount(0);
    await page.getByRole("checkbox", { name: "Preso: Mele" }).click();
    await expect(titles(takenSection(page))).toHaveText(["Mele", "Pane"]);
    await expect(takenSection(page).locator(".sezione__info")).toHaveText("2");
    await expect(toTakeSection(page).locator(".sezione__info")).toHaveText(
      "1 cosa",
    );
    if (!isMobile(testInfo)) {
      await expect(
        column(page)
          .locator(".sezione__testa")
          .first()
          .locator(".sezione__info"),
      ).toHaveText("1 da prendere");
    }
  });

  test("CA-9: la spunta porta la riga in Presi entro 2 secondi e resta dopo il ricaricamento", async ({
    page,
    baseURL,
  }) => {
    await addShopping("A", ["Latte", "Pane"]);
    await openSpesa(page, baseURL, "A");
    await page.getByRole("checkbox", { name: "Preso: Latte" }).click();
    const done = page.getByRole("checkbox", {
      name: "Rimetti in lista: Latte",
    });
    await expect(done).toBeVisible({ timeout: 2000 });
    await expect(done).toHaveAttribute("aria-checked", "true");
    await expect(row(takenSection(page), "Latte")).toHaveCount(1);
    await expect(row(toTakeSection(page), "Latte")).toHaveCount(0);
    await expect
      .poll(async () => (await readShopping("A")).taken)
      .toEqual(["Latte"]);
    await page.reload();
    await expect(
      takenSection(page).getByRole("checkbox", {
        name: "Rimetti in lista: Latte",
      }),
    ).toBeVisible();
  });

  test("CA-9: la riga spuntata resta al suo posto per 600 ms e poi passa in Presi", async ({
    page,
    baseURL,
  }) => {
    await addShopping("A", ["Latte", "Pane"]);
    await signInAs(page.context(), baseURL as string, "A");
    await page.clock.install({ time: new Date() });
    await page.goto("/casa/spesa");
    await expect(field(page)).toBeVisible();
    await page.clock.pauseAt(new Date(Date.now() + 5000));
    const tick = page.getByRole("checkbox", { name: "Preso: Latte" });
    await tick.click();
    // Done at once, but still in its place.
    const checked = toTakeSection(page).getByRole("checkbox", {
      name: "Rimetti in lista: Latte",
    });
    await expect(checked).toHaveAttribute("aria-checked", "true");
    await expect(row(takenSection(page), "Latte")).toHaveCount(0);
    await page.clock.runFor(550);
    await expect(row(takenSection(page), "Latte")).toHaveCount(0);
    await page.clock.runFor(100);
    await expect(row(takenSection(page), "Latte")).toHaveCount(1);
    await expect(row(toTakeSection(page), "Latte")).toHaveCount(0);
  });

  test("CA-10: «Rimetti in lista» riporta la cosa al suo posto, anche dopo il ricaricamento", async ({
    page,
    baseURL,
  }) => {
    await addShopping("A", ["Latte", "Pane", "Mele"]);
    await takeShopping("A", ["Latte"]);
    await openSpesa(page, baseURL, "A");
    await expect(titles(toTakeSection(page))).toHaveText(["Pane", "Mele"]);
    await page
      .getByRole("checkbox", { name: "Rimetti in lista: Latte" })
      .click();
    await expect(titles(toTakeSection(page))).toHaveText([
      "Latte",
      "Pane",
      "Mele",
    ]);
    await expect(takenSection(page)).toHaveCount(0);
    await expect
      .poll(async () => (await readShopping("A")).toTake)
      .toEqual(["Latte", "Pane", "Mele"]);
    await page.reload();
    await expect(titles(toTakeSection(page))).toHaveText([
      "Latte",
      "Pane",
      "Mele",
    ]);
  });

  test("CA-11: senza cose prese non ci sono Presi né forbici", async ({
    page,
    baseURL,
  }) => {
    await addShopping("A", ["Latte", "Pane"]);
    await openSpesa(page, baseURL, "A");
    await expect(toTakeSection(page)).toBeVisible();
    await expect(takenHeading(page)).toHaveCount(0);
    await expect(takenSection(page)).toHaveCount(0);
    await expect(blade(page)).toHaveCount(0);
  });
});

// ------------------------------------------------------------------ quick add

test.describe("campo rapido", () => {
  test("CA-12: Invio aggiunge in fondo con l'avatar, il campo resta a fuoco, la cosa resta dopo il ricaricamento", async ({
    page,
    baseURL,
  }) => {
    const logged: string[] = [];
    page.on("console", (message) => logged.push(message.text()));
    await addShopping("A", ["Latte"]);
    await openSpesa(page, baseURL, "A");
    const input = field(page);
    await input.fill("Pomodori");
    await input.press("Enter");
    const rows = toTakeSection(page).getByRole("listitem");
    await expect(titles(toTakeSection(page))).toHaveText(["Latte", "Pomodori"]);
    await expect(rows.last().locator(".avatar")).toHaveText("M");
    await expect(input).toHaveValue("");
    await expect(input).toBeFocused();
    await expect
      .poll(async () => (await readShopping("A")).toTake)
      .toEqual(["Latte", "Pomodori"]);
    await page.reload();
    await expect(titles(toTakeSection(page))).toHaveText(["Latte", "Pomodori"]);
    // The text typed by the user is never written in the console.
    expect(logged.filter((text) => text.includes("Pomodori"))).toEqual([]);
  });

  test("CA-12: il nome si può aggiungere anche subito di seguito, con il fuoco sul campo", async ({
    page,
    baseURL,
  }) => {
    await addShopping("A", ["Latte"]);
    await openSpesa(page, baseURL, "A");
    const input = field(page);
    await input.fill("Burro");
    await input.press("Enter");
    await input.fill("Sale");
    await input.press("Enter");
    await expect(titles(toTakeSection(page))).toHaveText([
      "Latte",
      "Burro",
      "Sale",
    ]);
    await expect(input).toBeFocused();
  });

  test("CA-13: il testo viene ripulito dagli spazi", async ({
    page,
    baseURL,
  }) => {
    await addShopping("A", ["Latte"]);
    await openSpesa(page, baseURL, "A");
    const input = field(page);
    await input.fill("   Basilico   fresco  ");
    await input.press("Enter");
    const added = titles(toTakeSection(page)).last();
    await expect(added).toHaveText("Basilico fresco");
    // toHaveText normalises the spaces: the exact text is checked on the DOM too.
    expect(await added.evaluate((node) => node.textContent)).toBe(
      "Basilico fresco",
    );
    await expect
      .poll(async () => (await readShopping("A")).toTake)
      .toEqual(["Latte", "Basilico fresco"]);
  });

  test("CA-14: Invio con il campo vuoto o di soli spazi non fa nulla", async ({
    page,
    baseURL,
  }) => {
    await addShopping("A", ["Latte", "Pane"]);
    await openSpesa(page, baseURL, "A");
    const rows = toTakeSection(page).getByRole("listitem");
    await expect(rows).toHaveCount(2);
    const input = field(page);
    await input.press("Enter");
    await input.fill("     ");
    await input.press("Enter");
    await holdsFor(
      1000,
      async () =>
        (await rows.count()) === 2 &&
        (await toast(page).count()) === 0 &&
        (await alerts(page).count()) === 0,
      "righe, avvisi e toast devono restare invariati",
    );
    expect((await readShopping("A")).toTake).toEqual(["Latte", "Pane"]);
  });

  test("CA-15: il campo accetta al massimo 80 caratteri e la riga salvata ne ha 80", async ({
    page,
    baseURL,
  }) => {
    await addShopping("A", ["Latte"]);
    await openSpesa(page, baseURL, "A");
    const input = field(page);
    const typed = "abcdefghij".repeat(9);
    await input.pressSequentially(typed);
    await expect(input).toHaveValue(typed.slice(0, 80));
    await input.press("Enter");
    await expect(titles(toTakeSection(page))).toHaveCount(2);
    await expect
      .poll(async () => (await readShopping("A")).toTake[1]?.length)
      .toBe(80);
  });

  test("CA-16: un doppione in Da prendere non si aggiunge e compare il toast", async ({
    page,
    baseURL,
  }) => {
    await addShopping("A", ["Latte"]);
    await openSpesa(page, baseURL, "A");
    const input = field(page);
    await input.fill("latte");
    await input.press("Enter");
    await expect(toast(page)).toContainText("Latte");
    await expect(toast(page)).toContainText("già in lista");
    await expect(input).toHaveValue("");
    await holdsFor(
      800,
      async () =>
        (await toTakeSection(page).getByRole("listitem").count()) === 1,
      "nessuna riga nuova",
    );
    expect((await readShopping("A")).toTake).toEqual(["Latte"]);
  });

  test("CA-16: il doppione ignora maiuscole e spazi; se è solo in Presi si aggiunge", async ({
    page,
    baseURL,
  }) => {
    await addShopping("A", ["Latte", "Pane"]);
    await takeShopping("A", ["Pane"]);
    await openSpesa(page, baseURL, "A");
    const input = field(page);
    await input.fill("  LATTE ");
    await input.press("Enter");
    await expect(toast(page)).toContainText("già in lista");
    await input.fill("pane");
    await input.press("Enter");
    await expect(titles(toTakeSection(page))).toHaveText(["Latte", "pane"]);
    await expect(titles(takenSection(page))).toHaveText(["Pane"]);
  });
});

// ------------------------------------------------------------- tear and undo

test.describe("strappo e Annulla", () => {
  test("CA-17: le forbici si chiamano «Togli dalla lista le 3 cose prese» (e al singolare)", async ({
    page,
    baseURL,
  }) => {
    await addShopping("A", ["Latte", "Pane", "Mele"]);
    await takeShopping("A", ["Latte", "Pane", "Mele"]);
    await openSpesa(page, baseURL, "A");
    await expect(
      page.getByRole("button", { name: "Togli dalla lista le 3 cose prese" }),
    ).toBeVisible();
    await page
      .getByRole("checkbox", { name: "Rimetti in lista: Latte" })
      .click();
    await page
      .getByRole("checkbox", { name: "Rimetti in lista: Pane" })
      .click();
    await expect(
      page.getByRole("button", { name: "Togli dalla lista la cosa presa" }),
    ).toBeVisible();
  });

  test("CA-18: trascinando le forbici all'85% le tre cose spariscono con il toast", async ({
    page,
    baseURL,
  }) => {
    await addShopping("A", ["Latte", "Pane", "Mele", "Uova", "Caffè"]);
    await takeShopping("A", ["Latte", "Pane", "Mele"]);
    await openSpesa(page, baseURL, "A");
    await expect(titles(takenSection(page))).toHaveCount(3);
    await dragBlade(page, 0.85);
    await expect(takenSection(page)).toHaveCount(0);
    await expect(blade(page)).toHaveCount(0);
    await expect(titles(toTakeSection(page))).toHaveText(["Uova", "Caffè"]);
    await expect(toast(page)).toHaveText(/3 cose tolte dalla lista\./);
    await expect(
      toast(page).getByRole("button", { name: "Annulla" }),
    ).toBeVisible();
    await expect.poll(async () => (await readShopping("A")).taken).toEqual([]);
    await expect(toast(page)).toBeHidden({ timeout: 10_000 });
    await page.reload();
    await expect(titles(toTakeSection(page))).toHaveText(["Uova", "Caffè"]);
    await expect(takenSection(page)).toHaveCount(0);
  });

  test("CA-19: trascinando le forbici al 50% e rilasciandole non succede niente", async ({
    page,
    baseURL,
  }) => {
    await addShopping("A", ["Latte", "Pane", "Mele"]);
    await takeShopping("A", ["Latte", "Pane", "Mele"]);
    await openSpesa(page, baseURL, "A");
    await dragBlade(page, 0.5);
    await expect(titles(takenSection(page))).toHaveCount(3);
    await holdsFor(
      700,
      async () => (await toast(page).count()) === 0,
      "nessun toast",
    );
    expect((await readShopping("A")).taken).toHaveLength(3);
  });

  test("CA-39: trascinando la lama al 75% la lama torna all'inizio e non si toglie nulla", async ({
    page,
    baseURL,
  }) => {
    await addShopping("A", ["Latte", "Pane", "Mele"]);
    await takeShopping("A", ["Latte", "Pane", "Mele"]);
    await openSpesa(page, baseURL, "A");
    const lama = blade(page);
    await lama.scrollIntoViewIfNeeded();
    const start = await lama.boundingBox();
    const run = await dragBlade(page, 0.75);
    // Back at the beginning of the line.
    await expect
      .poll(async () => Math.round((await lama.boundingBox())?.x ?? -1))
      .toBe(Math.round(start?.x ?? -2));
    expect(run).toBeGreaterThan(100);
    await expect(titles(takenSection(page))).toHaveCount(3);
    await holdsFor(
      700,
      async () => (await toast(page).count()) === 0,
      "nessun toast",
    );
    await page.reload();
    await expect(titles(takenSection(page))).toHaveCount(3);
    expect((await readShopping("A")).taken).toHaveLength(3);
  });

  test("CA-18: durante il trascinamento la lama segue il puntatore (--strappo-avanzamento)", async ({
    page,
    baseURL,
  }) => {
    await addShopping("A", ["Latte"]);
    await takeShopping("A", ["Latte"]);
    await openSpesa(page, baseURL, "A");
    const lama = blade(page);
    await lama.hover();
    const box = await lama.boundingBox();
    if (!box) throw new Error("Forbici non trovate");
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 60, y, { steps: 6 });
    const strip = page.getByTestId("spesa-strappo");
    await expect(strip).toHaveClass(/is-trascinato/);
    await expect
      .poll(async () =>
        strip.evaluate((node) =>
          parseFloat(
            (node as HTMLElement).style.getPropertyValue(
              "--strappo-avanzamento",
            ),
          ),
        ),
      )
      .toBeCloseTo(60, -1);
    await page.mouse.up();
    await expect(strip).not.toHaveClass(/is-trascinato/);
  });

  test("CA-20: da tastiera, Invio sulle forbici strappa e il fuoco va su «Annulla»", async ({
    page,
    baseURL,
  }) => {
    await addShopping("A", ["Latte", "Pane", "Mele", "Uova"]);
    await takeShopping("A", ["Latte", "Pane", "Mele"]);
    await openSpesa(page, baseURL, "A");
    await blade(page).focus();
    await page.keyboard.press("Enter");
    await expect(takenSection(page)).toHaveCount(0);
    await expect(toast(page)).toHaveText(/3 cose tolte dalla lista\./);
    const undo = toast(page).getByRole("button", { name: "Annulla" });
    await expect(undo).toBeVisible();
    await expect(undo).toBeFocused();
    await expect
      .poll(async () => (await readShopping("A")).taken, { timeout: 15_000 })
      .toEqual([]);
  });

  test("CA-20: da tastiera anche Spazio sulle forbici strappa", async ({
    page,
    baseURL,
  }) => {
    await addShopping("A", ["Latte", "Pane"]);
    await takeShopping("A", ["Latte"]);
    await openSpesa(page, baseURL, "A");
    await blade(page).focus();
    await page.keyboard.press("Space");
    await expect(takenSection(page)).toHaveCount(0);
    await expect(toast(page)).toHaveText(/1 cosa tolta dalla lista\./);
    // The page updates first and the server follows: wait for the database.
    await expect
      .poll(async () => (await readShopping("A")).taken, { timeout: 15_000 })
      .toEqual([]);
  });

  test("CA-21: «Annulla» riporta le cose in Presi nello stesso ordine, anche dopo il ricaricamento", async ({
    page,
    baseURL,
  }) => {
    await addShopping("A", ["Alfa", "Beta", "Gamma", "Delta"]);
    await takeShopping("A", ["Alfa", "Beta", "Gamma"]);
    await openSpesa(page, baseURL, "A");
    await expect(titles(takenSection(page))).toHaveText([
      "Gamma",
      "Beta",
      "Alfa",
    ]);
    await tearByClick(page);
    await expect(takenSection(page)).toHaveCount(0);
    await toast(page).getByRole("button", { name: "Annulla" }).click();
    await expect(titles(takenSection(page))).toHaveText([
      "Gamma",
      "Beta",
      "Alfa",
    ]);
    await expect
      .poll(async () => (await readShopping("A")).taken)
      .toEqual(["Gamma", "Beta", "Alfa"]);
    await page.reload();
    await expect(titles(takenSection(page))).toHaveText([
      "Gamma",
      "Beta",
      "Alfa",
    ]);
  });

  test("CA-21: dopo «Annulla» il fuoco va sulle forbici", async ({
    page,
    baseURL,
  }) => {
    await addShopping("A", ["Latte", "Pane"]);
    await takeShopping("A", ["Latte"]);
    await openSpesa(page, baseURL, "A");
    await tearByClick(page);
    await toast(page).getByRole("button", { name: "Annulla" }).click();
    await expect(blade(page)).toBeFocused();
  });

  test("CA-22: lo strappo di una sola cosa dice «1 cosa tolta dalla lista.» e dopo 5 secondi non si recupera", async ({
    page,
    baseURL,
  }) => {
    await addShopping("A", ["Latte", "Pane"]);
    await takeShopping("A", ["Latte"]);
    await signInAs(page.context(), baseURL as string, "A");
    await page.clock.install({ time: new Date() });
    await page.goto("/casa/spesa");
    await expect(field(page)).toBeVisible();
    await page.clock.pauseAt(new Date(Date.now() + 5000));
    await tearByClick(page);
    await expect(toast(page)).toHaveText(/1 cosa tolta dalla lista\./);
    await page.clock.runFor(4800);
    await expect(toast(page)).toBeVisible();
    await page.clock.runFor(400);
    await expect(toast(page)).toHaveCount(0);
    await expect(takenSection(page)).toHaveCount(0);
    // The queue runs on real time: the server may still be writing.
    await expect
      .poll(async () => (await readShopping("A")).taken, { timeout: 15_000 })
      .toEqual([]);
  });

  test("CA-36: un semplice clic sulle forbici strappa subito, con «Annulla»", async ({
    page,
    baseURL,
  }) => {
    await addShopping("A", ["Latte", "Pane", "Mele", "Uova"]);
    await takeShopping("A", ["Latte", "Pane", "Mele"]);
    await openSpesa(page, baseURL, "A");
    await tearByClick(page);
    await expect(takenSection(page)).toHaveCount(0);
    await expect(toast(page)).toHaveText(/3 cose tolte dalla lista\./);
    await expect(
      toast(page).getByRole("button", { name: "Annulla" }),
    ).toBeVisible();
    await expect(titles(toTakeSection(page))).toHaveText(["Uova"]);
    // Focus after a tap or a drag: the heading «Da prendere».
    await expect(toTakeHeading(page)).toBeFocused();
  });
});

// ----------------------------------------------------------------- empty state

test.describe("stato vuoto", () => {
  test("CA-23: lista vuota di Marco, chip, messaggio con Laura e nessuna sezione", async ({
    page,
    baseURL,
  }) => {
    await openSpesa(page, baseURL, "A");
    await expect(
      page.getByRole("textbox", { name: "Cosa manca in casa?" }),
    ).toHaveAttribute("placeholder", "Cosa manca in casa?");
    await expect(
      commonSection(page).getByRole("heading", { name: "Le più comuni" }),
    ).toBeVisible();
    await expect(commonSection(page).locator(".sezione__info")).toHaveText(
      "un tocco per aggiungere",
    );
    await expect(chips(page).getByRole("button")).toHaveText([
      ...COMMON,
      "Crocchette per Biscotto",
    ]);
    await expect(
      page.getByText("Una lista per tutta la casa", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Quando Laura aggiunge qualcosa, lo vedi subito anche tu.",
      ),
    ).toBeVisible();
    await expect(toTakeHeading(page)).toHaveCount(0);
    await expect(takenHeading(page)).toHaveCount(0);
    await expect(blade(page)).toHaveCount(0);
  });

  test("CA-24: Casa Bianchi, sei chip senza «Crocchette» e il testo con Paolo", async ({
    page,
    baseURL,
  }) => {
    await openSpesa(page, baseURL, "B");
    await expect(chips(page).getByRole("button")).toHaveText([...COMMON]);
    await expect(
      chips(page).getByRole("button", { name: /Crocchette/ }),
    ).toHaveCount(0);
    await expect(
      page.getByText(
        "Quando Paolo aggiunge qualcosa, lo vedi subito anche tu.",
      ),
    ).toBeVisible();
  });

  test("CA-25: il tocco su «Uova» aggiunge la cosa e passa allo stato normale", async ({
    page,
    baseURL,
  }) => {
    await openSpesa(page, baseURL, "A");
    await page.getByRole("button", { name: "Aggiungi Uova" }).click();
    await expect(
      page.getByText("Una lista per tutta la casa", { exact: true }),
    ).toHaveCount(0);
    await expect(titles(toTakeSection(page))).toHaveText(["Uova"]);
    await expect(toTakeSection(page).locator(".avatar")).toHaveText("M");
    await expect(chips(page).getByRole("button")).toHaveText([
      "Latte",
      "Pane",
      "Frutta",
      "Caffè",
      "Carta igienica",
      "Crocchette per Biscotto",
    ]);
    await expect
      .poll(async () => (await readShopping("A")).toTake)
      .toEqual(["Uova"]);
    await page.reload();
    await expect(titles(toTakeSection(page))).toHaveText(["Uova"]);
    await expect(
      chips(page).getByRole("button", { name: "Aggiungi Uova" }),
    ).toHaveCount(0);
  });

  test("CA-25: con tutte le cose strappate si torna allo stato vuoto", async ({
    page,
    baseURL,
  }) => {
    await addShopping("A", ["Latte"]);
    await takeShopping("A", ["Latte"]);
    await openSpesa(page, baseURL, "A");
    await tearByClick(page);
    await expect(
      page.getByText("Una lista per tutta la casa", { exact: true }),
    ).toBeVisible();
    await expect(toast(page)).toHaveText(/1 cosa tolta dalla lista\./);
  });
});

// ------------------------------------------------------ few things to take

test.describe("«Le più comuni» con poche cose", () => {
  test("CA-37: con 3 cose da prendere non c'è, con una sola compare senza i chip già in lista", async ({
    page,
    baseURL,
  }) => {
    await addShopping("A", ["Latte", "Pane", "Mele"]);
    await openSpesa(page, baseURL, "A");
    await expect(toTakeSection(page)).toBeVisible();
    await expect(commonSection(page)).toHaveCount(0);
    await page.getByRole("checkbox", { name: "Preso: Pane" }).click();
    await page.getByRole("checkbox", { name: "Preso: Mele" }).click();
    await expect(titles(takenSection(page))).toHaveCount(2);
    await expect(chips(page).getByRole("button")).toHaveText([
      "Pane",
      "Uova",
      "Frutta",
      "Caffè",
      "Carta igienica",
      "Crocchette per Biscotto",
    ]);
    await expect(
      chips(page).getByRole("button", { name: "Aggiungi Latte" }),
    ).toHaveCount(0);
  });

  test("CA-37: con due cose il tocco su un chip porta a tre e la sezione sparisce", async ({
    page,
    baseURL,
  }) => {
    await addShopping("A", ["Latte", "Pane"]);
    await openSpesa(page, baseURL, "A");
    await expect(commonSection(page)).toBeVisible();
    await page.getByRole("button", { name: "Aggiungi Uova" }).click();
    await expect(titles(toTakeSection(page))).toHaveText([
      "Latte",
      "Pane",
      "Uova",
    ]);
    await expect(commonSection(page)).toHaveCount(0);
    // Focus: the section is gone, so the heading «Da prendere».
    await expect(toTakeHeading(page)).toBeFocused();
  });

  test("CA-37: un chip dà il fuoco al chip successivo (o al precedente se è l'ultimo)", async ({
    page,
    baseURL,
  }) => {
    await openSpesa(page, baseURL, "A");
    await page.getByRole("button", { name: "Aggiungi Uova" }).click();
    await expect(
      page.getByRole("button", { name: "Aggiungi Frutta" }),
    ).toBeFocused();
    await page
      .getByRole("button", { name: "Aggiungi Crocchette per Biscotto" })
      .click();
    await expect(
      page.getByRole("button", { name: "Aggiungi Carta igienica" }),
    ).toBeFocused();
    await expect(page.getByTestId("spesa-annuncio")).toHaveText(
      "Aggiunto: Crocchette per Biscotto",
    );
  });

  test("CA-38: «Tutto preso» con i presi, le forbici e senza il conteggio", async ({
    page,
    baseURL,
  }, testInfo) => {
    await addShopping("A", ["Latte", "Pane"]);
    await takeShopping("A", ["Latte", "Pane"]);
    await openSpesa(page, baseURL, "A");
    const section = toTakeSection(page);
    await expect(toTakeHeading(page)).toBeVisible();
    await expect(
      section.getByText("Tutto preso", { exact: true }),
    ).toBeVisible();
    await expect(
      section.getByText(
        "Quando hai finito, togli i presi con le forbici qui sotto.",
      ),
    ).toBeVisible();
    await expect(section.locator(".sezione__info")).toHaveCount(0);
    await expect(takenHeading(page)).toBeVisible();
    await expect(titles(takenSection(page))).toHaveText(["Pane", "Latte"]);
    await expect(blade(page)).toBeVisible();
    if (isMobile(testInfo)) {
      await expect(switcher(page).locator(".selettore__conteggio")).toHaveCount(
        0,
      );
    } else {
      await expect(
        column(page)
          .locator(".sezione__testa")
          .first()
          .locator(".sezione__info"),
      ).toHaveCount(0);
    }
    // With 0 things to take «Le più comuni» is there (without the taken ones' rule).
    await expect(commonSection(page)).toBeVisible();
    await expect(
      chips(page).getByRole("button", { name: "Aggiungi Latte" }),
    ).toBeVisible();
  });

  test("CA-38: spuntando l'ultima cosa si arriva a «Tutto preso» con il fuoco sul tondo", async ({
    page,
    baseURL,
  }) => {
    await addShopping("A", ["Latte"]);
    await openSpesa(page, baseURL, "A");
    await page.getByRole("checkbox", { name: "Preso: Latte" }).click();
    await expect(page.getByText("Tutto preso", { exact: true })).toBeVisible();
    await expect(
      takenSection(page).getByRole("checkbox", {
        name: "Rimetti in lista: Latte",
      }),
    ).toBeFocused();
  });
});

// --------------------------------------------------------------------- realtime

test.describe("tempo reale", () => {
  test("CA-26: quello che Paolo aggiunge compare da Giulia entro 5 secondi", async ({
    page,
    browser,
    baseURL,
  }, testInfo) => {
    await addShopping("B", ["Biscotti"]);
    await openSpesa(page, baseURL, "B");
    const second = await openSecond(browser, baseURL, testInfo, "B2");
    try {
      await expect(toTakeSection(page).locator(".sezione__info")).toHaveText(
        "1 cosa",
      );
      const input = field(second.page);
      await input.fill("Yogurt");
      await input.press("Enter");
      await expect(titles(toTakeSection(page))).toHaveText(
        ["Biscotti", "Yogurt"],
        { timeout: 5000 },
      );
      await expect(
        row(toTakeSection(page), "Yogurt").locator(".avatar"),
      ).toHaveText("P");
      await expect(toTakeSection(page).locator(".sezione__info")).toHaveText(
        "2 cose",
      );
      if (isMobile(testInfo)) {
        await expect(
          switcher(page).locator(".selettore__conteggio"),
        ).toHaveText("2");
      }
    } finally {
      await second.context.close();
    }
  });

  test("CA-26: senza il canale del tempo reale la pagina rilegge da sola entro 5 secondi", async ({
    page,
    browser,
    baseURL,
  }, testInfo) => {
    await addShopping("B", ["Biscotti"]);
    // The realtime socket is closed as soon as it opens: only the polling is left.
    await page.routeWebSocket(/\/realtime\/v1\/websocket/, (socket) => {
      void socket.close();
    });
    await openSpesa(page, baseURL, "B");
    await expect(titles(toTakeSection(page))).toHaveText(["Biscotti"]);
    const second = await openSecond(browser, baseURL, testInfo, "B2");
    try {
      const input = field(second.page);
      await input.fill("Yogurt");
      await input.press("Enter");
      await expect(titles(toTakeSection(page))).toHaveText(
        ["Biscotti", "Yogurt"],
        { timeout: 5000 },
      );
    } finally {
      await second.context.close();
    }
  });

  test("CA-27: spunta, strappo e Annulla di Paolo arrivano a Giulia entro 5 secondi", async ({
    page,
    browser,
    baseURL,
  }, testInfo) => {
    await addShopping("B", ["Yogurt", "Biscotti", "Mele"]);
    await openSpesa(page, baseURL, "B");
    const second = await openSecond(browser, baseURL, testInfo, "B2");
    try {
      await second.page
        .getByRole("checkbox", { name: "Preso: Yogurt" })
        .click();
      await expect(titles(takenSection(second.page))).toHaveText(["Yogurt"]);
      await expect(titles(takenSection(page))).toHaveText(["Yogurt"], {
        timeout: 5000,
      });
      await expect(titles(toTakeSection(page))).toHaveText([
        "Biscotti",
        "Mele",
      ]);

      await tearByClick(second.page);
      await expect(takenSection(page)).toHaveCount(0, { timeout: 5000 });
      await expect(titles(toTakeSection(page))).toHaveText([
        "Biscotti",
        "Mele",
      ]);

      await second.page
        .getByRole("status")
        .getByRole("button", { name: "Annulla" })
        .click();
      await expect(titles(takenSection(page))).toHaveText(["Yogurt"], {
        timeout: 5000,
      });
    } finally {
      await second.context.close();
    }
  });

  test("CA-27: una modifica altrui che toglie la riga a fuoco sposta il fuoco sul titolo della sezione", async ({
    page,
    baseURL,
  }) => {
    await addShopping("A", ["Latte", "Pane"]);
    await takeShopping("A", ["Pane"]);
    await openSpesa(page, baseURL, "A");
    const pane = page.getByRole("checkbox", { name: "Rimetti in lista: Pane" });
    await pane.focus();
    await expect(pane).toBeFocused();
    await tearShopping("A");
    await expect(takenSection(page)).toHaveCount(0, { timeout: 6000 });
    await expect(toTakeHeading(page)).toBeFocused();
  });
});

// -------------------------------------------------------------------- isolation

test.describe("isolamento tra Nest", () => {
  test("CA-28: Marco non vede niente di Casa Bianchi", async ({
    page,
    baseURL,
  }) => {
    await addShopping("B2", ["Yogurt", "Biscotti"]);
    await takeShopping("B2", ["Biscotti"]);
    await openSpesa(page, baseURL, "A");
    await expect(
      page.getByText("Una lista per tutta la casa", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Yogurt")).toHaveCount(0);
    await expect(page.getByText("Biscotti")).toHaveCount(0);
    await expect(
      page.getByRole("listitem").filter({ hasText: "Yogurt" }),
    ).toHaveCount(0);
    expect(await page.content()).not.toContain("Yogurt");
  });

  test("CA-28: Giulia non vede le cose di Casa D'Angelo", async ({
    page,
    baseURL,
  }) => {
    await addShopping("A", [{ name: "Latte", quantity: "2 l" }]);
    await openSpesa(page, baseURL, "B");
    // «Latte» is also a chip of «Le più comuni»: only the rows are checked.
    await expect(
      page.getByRole("listitem").filter({ hasText: "Latte" }),
    ).toHaveCount(0);
    await expect(page.getByText("2 l", { exact: true })).toHaveCount(0);
    await expect(toTakeHeading(page)).toHaveCount(0);
  });

  test("CA-29: quello che Paolo aggiunge o strappa in Casa Bianchi non cambia la pagina di Marco", async ({
    page,
    baseURL,
  }) => {
    await addShopping("A", ["Latte", "Pane"]);
    await takeShopping("A", ["Pane"]);
    await openSpesa(page, baseURL, "A");
    const before = {
      toTake: await titles(toTakeSection(page)).allInnerTexts(),
      taken: await titles(takenSection(page)).allInnerTexts(),
    };
    expect(before).toEqual({ toTake: ["Latte"], taken: ["Pane"] });
    await addShopping("B2", ["Yogurt", "Biscotti"]);
    await takeShopping("B2", ["Biscotti"]);
    await tearShopping("B2");
    await holdsFor(
      5500,
      async () =>
        (await titles(toTakeSection(page)).allInnerTexts()).join() ===
          "Latte" &&
        (await titles(takenSection(page)).allInnerTexts()).join() === "Pane" &&
        (await page.getByText("Yogurt").count()) === 0 &&
        (await toast(page).count()) === 0,
      "la pagina di Marco non deve cambiare",
    );
  });

  test("CA-30: Marco, con la sua sessione, non legge né tocca le cose di Casa Bianchi", async () => {
    await addShopping("B", ["Yogurt", "Biscotti"]);
    await takeShopping("B", ["Biscotti"]);
    const giulia = await apiAs("B");
    const { data: theirs } = await giulia
      .from("shopping_items")
      .select("id, name, checked_at");
    const yogurt = theirs?.find((r) => r.name === "Yogurt")?.id as string;
    const biscotti = theirs?.find((r) => r.name === "Biscotti")?.id as string;
    expect(yogurt).toBeTruthy();

    const marco = await apiAs("A");
    // Read
    const read = await marco.from("shopping_items").select("id");
    expect(read.error).toBeNull();
    expect(read.data).toEqual([]);
    const readById = await marco
      .from("shopping_items")
      .select("id")
      .in("id", [yogurt, biscotti]);
    expect(readById.data).toEqual([]);
    // Insert in the other Nest
    const insert = await marco
      .from("shopping_items")
      .insert({ name: "Intruso", household_id: HOME_B });
    expect(insert.error).not.toBeNull();
    // Update
    await marco
      .from("shopping_items")
      .update({ checked_at: new Date().toISOString() })
      .eq("id", yogurt);
    // Delete
    await marco.from("shopping_items").delete().eq("id", biscotti);
    await marco.from("shopping_items").delete().eq("id", yogurt);
    // Tear and Annulla through the functions
    const clear = await marco.rpc("clear_checked_shopping_items", {
      item_ids: [biscotti],
    });
    expect(clear.error).not.toBeNull();
    const restore = await marco.rpc("restore_shopping_items", {
      item_ids: [biscotti, yogurt],
    });
    expect(restore.error).not.toBeNull();

    const after = await giulia
      .from("shopping_items")
      .select("name, checked_at")
      .order("name");
    expect(after.data?.map((r) => [r.name, r.checked_at === null])).toEqual([
      ["Biscotti", false],
      ["Yogurt", true],
    ]);
  });
});

// --------------------------------------------------------- loading and errors

test.describe("caricamento ed errore", () => {
  test("CA-31: durante la lettura rallentata si vedono selettore (mobile) e un contenitore aria-busy", async ({
    page,
    baseURL,
  }, testInfo) => {
    await addShopping("A", ["Latte"]);
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(/\/rest\/v1\/shopping_items/, async (route) => {
      await gate;
      await route.continue();
    });
    await signInAs(page.context(), baseURL as string, "A");
    await page.goto("/casa/spesa");
    const busy = page.locator('[aria-busy="true"]');
    await expect(busy).toHaveCount(1);
    await expect(busy).toContainText("Caricamento in corso");
    if (isMobile(testInfo)) {
      await expect(switcher(page)).toBeVisible();
      await expect(switcher(page).locator(".selettore__conteggio")).toHaveCount(
        0,
      );
    } else {
      await expect(switcher(page)).toHaveCount(0);
      await expect(
        page.getByRole("heading", { level: 1, name: "Casa" }),
      ).toBeVisible();
      await expect(
        page.getByRole("main").getByText("Casa D'Angelo"),
      ).toBeVisible();
    }
    await expect(field(page)).toHaveCount(0);
    release();
    await expect(field(page)).toBeVisible();
    await expect(busy).toHaveCount(0);
    await expect(titles(toTakeSection(page))).toHaveText(["Latte"]);
  });

  test("CA-32: offline, spuntare mostra l'avviso con «Riprova» e la cosa passa in Presi", async ({
    page,
    baseURL,
  }) => {
    await addShopping("A", ["Pane", "Latte"]);
    await openSpesa(page, baseURL, "A");
    await expect(alerts(page)).toHaveCount(0);
    await page.context().setOffline(true);
    await page.getByRole("checkbox", { name: "Preso: Pane" }).click();
    const alert = alerts(page);
    await expect(alert).toContainText(OFFLINE_ALERT);
    await expect(alert.getByRole("button", { name: "Riprova" })).toBeVisible();
    await expect(titles(takenSection(page))).toHaveText(["Pane"]);
    // The list stays visible.
    await expect(titles(toTakeSection(page))).toHaveText(["Latte"]);
  });

  test("CA-33: tornata la rete, l'avviso sparisce entro 5 secondi e la spunta è salvata", async ({
    page,
    baseURL,
  }) => {
    await addShopping("A", ["Pane", "Latte"]);
    await openSpesa(page, baseURL, "A");
    await page.context().setOffline(true);
    await page.getByRole("checkbox", { name: "Preso: Pane" }).click();
    await expect(alerts(page)).toContainText(OFFLINE_ALERT);
    await expect(titles(takenSection(page))).toHaveText(["Pane"]);
    await page.context().setOffline(false);
    await expect(alerts(page)).toHaveCount(0, { timeout: 5000 });
    await expect
      .poll(async () => (await readShopping("A")).taken)
      .toEqual(["Pane"]);
    await page.reload();
    await expect(titles(takenSection(page))).toHaveText(["Pane"]);
  });

  test("CA-34: «Riprova» con la rete ancora assente: l'avviso resta e la cosa resta in Presi", async ({
    page,
    baseURL,
  }) => {
    await addShopping("A", ["Pane", "Latte"]);
    await openSpesa(page, baseURL, "A");
    await page.context().setOffline(true);
    await page.getByRole("checkbox", { name: "Preso: Pane" }).click();
    const alert = alerts(page);
    await expect(alert).toContainText(OFFLINE_ALERT);
    await expect(titles(takenSection(page))).toHaveText(["Pane"]);
    await alert.getByRole("button", { name: "Riprova" }).click();
    await holdsFor(
      1500,
      async () =>
        (await alert.count()) === 1 &&
        (await titles(takenSection(page)).allInnerTexts()).join() === "Pane",
      "l'avviso resta e Pane resta in Presi",
    );
    expect((await readShopping("A")).taken).toEqual([]);
    // Nothing is lost: with the network back, «Riprova» sends the queue.
    await page.context().setOffline(false);
    await expect
      .poll(async () => (await readShopping("A")).taken)
      .toEqual(["Pane"]);
    await expect(alert).toHaveCount(0, { timeout: 5000 });
  });

  test("CA-33: la coda offline (aggiungere, spuntare, strappare) parte al ritorno della rete", async ({
    page,
    baseURL,
  }) => {
    await addShopping("A", ["Pane", "Sale"]);
    await takeShopping("A", ["Sale"]);
    await openSpesa(page, baseURL, "A");
    await page.context().setOffline(true);
    const input = field(page);
    await input.fill("Burro");
    await input.press("Enter");
    await page.getByRole("checkbox", { name: "Preso: Pane" }).click();
    await expect(titles(takenSection(page))).toHaveText(["Pane", "Sale"]);
    await tearByClick(page);
    await expect(takenSection(page)).toHaveCount(0);
    await expect(titles(toTakeSection(page))).toHaveText(["Burro"]);
    await expect(alerts(page)).toContainText(OFFLINE_ALERT);
    expect(await readShopping("A")).toEqual({
      toTake: ["Pane"],
      taken: ["Sale"],
    });
    await page.context().setOffline(false);
    await expect
      .poll(async () => readShopping("A"), { timeout: 10_000 })
      .toEqual({ toTake: ["Burro"], taken: [] });
    await expect(alerts(page)).toHaveCount(0, { timeout: 5000 });
    await expect(titles(toTakeSection(page))).toHaveText(["Burro"]);
  });

  test("CA-34: «Riprova» a rete tornata invia la coda e il fuoco va sul titolo della prima sezione", async ({
    page,
    baseURL,
  }) => {
    await addShopping("A", ["Pane", "Latte"]);
    await openSpesa(page, baseURL, "A");
    await page.context().setOffline(true);
    await page.getByRole("checkbox", { name: "Preso: Pane" }).click();
    // The row settles into «Presi» after a moment and takes the focus back if
    // it had it: wait for it, or that late move steals the focus we test.
    await expect(titles(takenSection(page))).toHaveText(["Pane"]);
    const retry = page
      .getByRole("alert")
      .getByRole("button", { name: "Riprova" });
    await expect(retry).toBeVisible();
    await retry.focus();
    await page.context().setOffline(false);
    await page.keyboard.press("Enter");
    await expect(alerts(page)).toHaveCount(0, { timeout: 5000 });
    // With fewer than 3 things «Le più comuni» is the first section.
    await expect(
      page.getByRole("heading", { level: 3, name: "Le più comuni" }),
    ).toBeFocused();
  });

  test("CA-34: se la rete torna da sola con il fuoco su «Riprova», il fuoco va sul titolo della prima sezione", async ({
    page,
    baseURL,
  }) => {
    await addShopping("A", ["Pane", "Latte"]);
    await openSpesa(page, baseURL, "A");
    await page.context().setOffline(true);
    await page.getByRole("checkbox", { name: "Preso: Pane" }).click();
    // Same as above: let the row settle into «Presi» before moving the focus.
    await expect(titles(takenSection(page))).toHaveText(["Pane"]);
    const retry = alerts(page).getByRole("button", { name: "Riprova" });
    await expect(retry).toBeVisible();
    await retry.focus();
    await page.context().setOffline(false);
    await expect(alerts(page)).toHaveCount(0, { timeout: 5000 });
    await expect(
      page.getByRole("heading", { level: 3, name: "Le più comuni" }),
    ).toBeFocused();
  });

  test("CA-35: se la lettura iniziale fallisce c'è l'errore di pagina; «Riprova» a lettura tornata mostra la lista", async ({
    page,
    baseURL,
  }, testInfo) => {
    test.skip(
      !isMobile(testInfo),
      "Su desktop l'errore è nella colonna, vedi il caso successivo (#23 CA-42, #128)",
    );
    await addShopping("A", ["Latte"]);
    const cors = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
    };
    await page.route(/\/rest\/v1\/shopping_items/, async (route) => {
      if (route.request().method() === "OPTIONS") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        headers: cors,
        body: JSON.stringify({
          code: "XX000",
          message: "boom internal detail",
        }),
      });
    });
    await signInAs(page.context(), baseURL as string, "A");
    await page.goto("/casa/spesa");
    const error = alerts(page);
    await expect(error).toContainText("Questa pagina non si è caricata");
    await expect(error).toContainText(
      "Controlla la connessione e riprova. Se il problema resta, torna a Oggi.",
    );
    await expect(error.getByRole("button", { name: "Riprova" })).toBeVisible();
    // No technical detail, no names, no selector or heading of the page.
    await expect(error).not.toContainText("boom");
    await expect(error).not.toContainText("XX000");
    await expect(page.getByText("Latte")).toHaveCount(0);
    await expect(switcher(page)).toHaveCount(0);
    await expect(field(page)).toHaveCount(0);

    await page.unroute(/\/rest\/v1\/shopping_items/);
    await error.getByRole("button", { name: "Riprova" }).click();
    await expect(field(page)).toBeVisible();
    await expect(titles(toTakeSection(page))).toHaveText(["Latte"]);
    await expect(alerts(page)).toHaveCount(0);
  });

  test("CA-35 (desktop): se si legge tutto tranne la spesa l'errore è nella colonna «Spesa» e «Riprova» rilegge solo quella lista", async ({
    page,
    baseURL,
  }, testInfo) => {
    test.skip(isMobile(testInfo), "Caso a 1280 px");
    await addShopping("A", ["Latte"]);
    const cors = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
    };
    await page.route(/\/rest\/v1\/shopping_items/, async (route) => {
      if (route.request().method() === "OPTIONS") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        headers: cors,
        body: JSON.stringify({
          code: "XX000",
          message: "boom internal detail",
        }),
      });
    });
    await signInAs(page.context(), baseURL as string, "A");
    await page.goto("/casa/spesa");
    const error = column(page).getByRole("alert");
    await expect(error).toContainText(
      "Non riusciamo a caricare la spesa. Controlla la connessione e riprova.",
      { timeout: 20_000 },
    );
    await expect(error).not.toContainText("boom");
    // No page error: the other columns are there.
    await expect(page.getByText("Questa pagina non si è caricata")).toHaveCount(
      0,
    );
    await expect(page.getByRole("region", { name: "Da fare" })).toBeVisible();

    await page.unroute(/\/rest\/v1\/shopping_items/);
    await error.getByRole("button", { name: "Riprova" }).click();
    await expect(field(page)).toBeVisible({ timeout: 20_000 });
    await expect(titles(toTakeSection(page))).toHaveText(["Latte"]);
    await expect(alerts(page)).toHaveCount(0);
  });

  test("Extra: una spunta rifiutata dal server rimette la riga com'era e mostra il toast di errore", async ({
    page,
    baseURL,
  }) => {
    await addShopping("A", ["Latte", "Pane"]);
    await openSpesa(page, baseURL, "A");
    await page.route(/\/rest\/v1\/shopping_items/, async (route) => {
      if (route.request().method() === "PATCH") {
        await route.fulfill({
          status: 403,
          contentType: "application/json",
          headers: { "access-control-allow-origin": "*" },
          body: JSON.stringify({ code: "42501", message: "denied" }),
        });
        return;
      }
      await route.continue();
    });
    await page.getByRole("checkbox", { name: "Preso: Latte" }).click();
    await expect(toast(page)).toHaveText(SAVE_FAILED);
    await expect(titles(toTakeSection(page))).toHaveText(["Latte", "Pane"]);
    await expect(takenSection(page)).toHaveCount(0);
    // The error is not shown as a lost connection.
    await expect(alerts(page)).toHaveCount(0);
  });

  test("Extra: un'aggiunta rifiutata dal server fa sparire la riga e rimette il testo nel campo", async ({
    page,
    baseURL,
  }) => {
    await addShopping("A", ["Latte"]);
    await openSpesa(page, baseURL, "A");
    await page.route(/\/rest\/v1\/shopping_items/, async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 403,
          contentType: "application/json",
          headers: { "access-control-allow-origin": "*" },
          body: JSON.stringify({ code: "42501", message: "denied" }),
        });
        return;
      }
      await route.continue();
    });
    const input = field(page);
    await input.fill("Burro");
    await input.press("Enter");
    await expect(toast(page)).toHaveText(SAVE_FAILED);
    await expect(titles(toTakeSection(page))).toHaveText(["Latte"]);
    await expect(input).toHaveValue("Burro");
  });

  test("Extra: lo stesso nome aggiunto da un altro nello stesso momento dà il toast del doppione", async ({
    page,
    baseURL,
  }) => {
    await addShopping("A", ["Latte"]);
    await openSpesa(page, baseURL, "A");
    // Someone else adds «Burro» just before: the page does not know it yet.
    await page.route(/\/rest\/v1\/shopping_items/, async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 409,
          contentType: "application/json",
          headers: { "access-control-allow-origin": "*" },
          body: JSON.stringify({
            code: "23505",
            message: "shopping item already to buy",
          }),
        });
        return;
      }
      await route.continue();
    });
    const input = field(page);
    await input.fill("Burro");
    await input.press("Enter");
    await expect(toast(page)).toContainText("Burro");
    await expect(toast(page)).toContainText("è già in lista.");
    await expect(titles(toTakeSection(page))).toHaveText(["Latte"]);
  });
});

// ------------------------------------------------------------------------ focus

test.describe("fuoco e tastiera", () => {
  test("Fuoco: dopo la spunta il fuoco resta sul tondo della stessa riga", async ({
    page,
    baseURL,
  }) => {
    await addShopping("A", ["Latte", "Pane"]);
    await openSpesa(page, baseURL, "A");
    await page.getByRole("checkbox", { name: "Preso: Latte" }).focus();
    await page.keyboard.press("Space");
    await expect(row(takenSection(page), "Latte")).toHaveCount(1);
    await expect(
      page.getByRole("checkbox", { name: "Rimetti in lista: Latte" }),
    ).toBeFocused();
  });

  test("Fuoco: l'ordine con Tab è campo, chip, tondi di Da prendere, tondi di Presi, forbici", async ({
    page,
    baseURL,
  }) => {
    await addShopping("A", ["Latte", "Pane"]);
    await takeShopping("A", ["Pane"]);
    await openSpesa(page, baseURL, "A");
    await field(page).focus();
    const seen: string[] = [];
    for (let step = 0; step < 25; step += 1) {
      await page.keyboard.press("Tab");
      const label = await page.evaluate(
        () =>
          document.activeElement?.getAttribute("aria-label") ??
          (document.activeElement as HTMLElement | null)?.innerText ??
          "",
      );
      seen.push(label.trim());
      if (label.startsWith("Togli dalla lista")) break;
    }
    const first = seen.indexOf("Preso: Latte");
    const second = seen.indexOf("Rimetti in lista: Pane");
    const third = seen.findIndex((l) => l.startsWith("Togli dalla lista"));
    expect(first, seen.join(" | ")).toBeGreaterThan(0);
    expect(second).toBeGreaterThan(first);
    expect(third).toBeGreaterThan(second);
    // Before the first row only the chips of «Le più comuni».
    expect(
      seen.slice(0, first).every((l) => l.startsWith("Aggiungi ")),
      seen.join(" | "),
    ).toBe(true);
  });
});

test.describe("compatibilità con le altre pagine di Casa", () => {
  test("Extra: su desktop «Da fare» e «Scadenze» sono colonne vere accanto alla Spesa, senza «In arrivo»", async ({
    page,
    baseURL,
  }, testInfo) => {
    test.skip(isMobile(testInfo), "Le tre colonne ci sono solo a 1280 px");
    await openSpesa(page, baseURL, "A");
    const todo = page.getByRole("region", { name: "Da fare" });
    await expect(
      todo.getByRole("heading", { level: 2, name: "Da fare" }),
    ).toBeVisible();
    await expect(
      todo.getByRole("textbox", { name: "Aggiungi una cosa da fare…" }),
    ).toBeVisible();
    await expect(todo.getByText("In arrivo")).toHaveCount(0);
    // The three pages share one frame since #128: Scadenze is a real column.
    const deadlines = page.getByRole("region", { name: "Scadenze" });
    await expect(
      deadlines.getByRole("heading", { level: 2, name: "Scadenze" }),
    ).toBeVisible();
    await expect(deadlines.getByText("In arrivo")).toHaveCount(0);
  });
});
