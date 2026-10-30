import AxeBuilder from "@axe-core/playwright";
import type { Locator, Page } from "@playwright/test";
import {
  alerts,
  busy,
  column,
  CORS,
  expect,
  isMobileProject,
  setClock,
  switcher,
  test,
  type CasaNest,
} from "../fixtures/casa";

// Casa · Scadenze (#24): axe in every state, one h1 and the order of the
// headings, what screen readers read in a row, touch areas (mobile) and
// keyboard order (the rows are not controls).
//
// Written before the page exists: roles and texts are those of the
// requirement and of the designer's specification; implementation details are
// resolved against the code of the PR. Every test has its own throwaway Nest (fixtures/casa.ts).
// Clock fixed at martedì 20 ottobre 2026, 15:52 Europe/Rome.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

const PATH = "/casa/scadenze";
const TODAY = new Date("2026-10-20T13:52:00Z");

const CARTA = "Rinnovo carta d'identità di Sofia";
const BISCOTTO = "Assicurazione di Biscotto";
const BOLLO = "Bollo dell'auto";
const CASA = "Assicurazione della casa";

const col = (page: Page) => column(page, "Scadenze");
const rowOf = (page: Page, title: string) =>
  col(page)
    .locator("li")
    .filter({ has: page.locator(".riga-lista__titolo", { hasText: title }) });

async function seed(casa: CasaNest) {
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
  ready: Locator = col(page),
  path = PATH,
) {
  await setClock(page, TODAY);
  await casa.signIn(page, baseURL, "Marco");
  await page.goto(path);
  await expect(ready).toBeVisible({ timeout: 20_000 });
  await expect(busy(page)).toHaveCount(0);
}

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => n.target.join(" ")),
    }));
}

async function hasTouchArea(target: Locator, size = 44) {
  return target.evaluate((el, s) => {
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const half = s / 2 - 1;
    const points = [
      [cx - half, cy - half],
      [cx + half, cy - half],
      [cx - half, cy + half],
      [cx + half, cy + half],
      [cx, cy],
    ];
    return points.every(([x, y]) => {
      const hit = document.elementFromPoint(x!, y!);
      return hit !== null && (hit === el || el.contains(hit));
    });
  }, size);
}

const failRead = async (page: Page) =>
  page.route(/\/rest\/v1\/deadlines/, async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      headers: CORS,
      body: JSON.stringify({ code: "XX000", message: "boom" }),
    });
  });

// --- axe, every state -----------------------------------------------------

test.describe("axe", () => {
  test("normale", async ({ page, baseURL, casa }) => {
    await seed(casa);
    await open(page, baseURL, casa);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("con scadute, di oggi e «Solo io»", async ({ page, baseURL, casa }) => {
    await seed(casa);
    await casa.deadline("Marco", {
      title: "Scaduta da cinque",
      due: "2026-10-15",
    });
    await casa.deadline("Marco", { title: "Scade oggi", due: "2026-10-20" });
    await casa.deadline("Marco", {
      title: "Rinnovo del passaporto",
      due: "2027-01-12",
      priv: true,
      assignee: "Marco",
    });
    await open(page, baseURL, casa);
    await expect(col(page).locator("li")).toHaveCount(7);
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("vuoto", async ({ page, baseURL, casa }) => {
    await open(
      page,
      baseURL,
      casa,
      page.getByText("Nessuna scadenza", { exact: true }),
    );
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("caricamento", async ({ page, baseURL, casa }) => {
    await seed(casa);
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
    expect(await seriousViolations(page)).toEqual([]);
    release();
    await expect(col(page)).toBeVisible({ timeout: 20_000 });
  });

  test("errore (di pagina su mobile, di colonna su desktop)", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seed(casa);
    await failRead(page);
    await setClock(page, TODAY);
    await casa.signIn(page, baseURL, "Marco");
    await page.goto(PATH);
    if (isMobileProject()) {
      await expect(alerts(page)).toContainText(
        "Questa pagina non si è caricata",
      );
    } else {
      await expect(
        col(page).getByRole("alert").filter({ hasText: /\S/ }),
      ).toContainText("Non riusciamo a caricare le scadenze");
    }
    expect(await seriousViolations(page)).toEqual([]);
  });
});

// --- structure and what the screen reader reads -------------------------------

test.describe("struttura e lettura delle righe", () => {
  test("un solo h1; h3 «Prossime»; su desktop l'h2 «Scadenze» sta tra i due", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seed(casa);
    await open(page, baseURL, casa);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(
      col(page).getByRole("heading", { level: 3, name: "Prossime" }),
    ).toBeVisible();
    if (!isMobileProject()) {
      await expect(
        col(page).getByRole("heading", { level: 2, name: "Scadenze" }),
      ).toBeVisible();
    }
  });

  test("le righe sono elementi di una lista", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seed(casa);
    await open(page, baseURL, casa);
    await expect(col(page).getByRole("list")).toHaveCount(1);
    await expect(col(page).getByRole("listitem")).toHaveCount(4);
  });

  test("urgente, «te ne occupi tu» e «riguarda <nome>» sono scritti per i lettori di schermo", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seed(casa);
    await open(page, baseURL, casa);
    // Specification section 6: hidden texts after the unit and at the end of
    // the text of the row.
    await expect(rowOf(page, CARTA)).toContainText("urgente");
    await expect(rowOf(page, CARTA)).toContainText("riguarda Sofia");
    await expect(rowOf(page, BOLLO)).toContainText("te ne occupi tu");
    await expect(rowOf(page, BOLLO)).not.toContainText("urgente");
    await expect(rowOf(page, BISCOTTO)).not.toContainText("riguarda");
    await expect(rowOf(page, BISCOTTO)).not.toContainText("te ne occupi tu");
    // The red dot is decorative: the word comes from the hidden text.
    await expect(
      rowOf(page, CARTA).getByTestId("pallino-urgente"),
    ).toHaveAttribute("aria-hidden", "true");
  });

  test("il lucchetto di una «Solo io» è decorativo e «solo tu» è scritto", async ({
    page,
    baseURL,
    casa,
  }) => {
    await casa.deadline("Marco", {
      title: "Rinnovo del passaporto",
      due: "2027-01-12",
      priv: true,
      assignee: "Marco",
    });
    await open(page, baseURL, casa);
    // Specification section 2: the icon inside the lock is aria-hidden.
    await expect(
      rowOf(page, "Rinnovo del passaporto")
        .getByTestId("lucchetto")
        .locator("svg"),
    ).toHaveAttribute("aria-hidden", "true");
    await expect(
      rowOf(page, "Rinnovo del passaporto").getByTestId("lucchetto"),
    ).toHaveText("");
    await expect(
      rowOf(page, "Rinnovo del passaporto").locator(".riga-lista__info"),
    ).toContainText("solo tu");
  });
});

// --- touch areas ------------------------------------------------------------

test.describe("aree di tocco e tastiera", () => {
  test("aree di tocco di almeno 44 px (mobile): voci del selettore, «Aggiungi una scadenza», «Riprova»", async ({
    page,
    baseURL,
    casa,
  }) => {
    test.skip(!isMobileProject(), "area di tocco: solo mobile");
    await open(
      page,
      baseURL,
      casa,
      page.getByText("Nessuna scadenza", { exact: true }),
    );
    const voices = switcher(page).locator(".selettore__voce");
    // The voices are 32 px high: the 44 px area comes from ::before (#63).
    for (let i = 0; i < (await voices.count()); i++) {
      expect(await hasTouchArea(voices.nth(i), 44), `voce ${i}`).toBe(true);
    }
    const add = page.getByRole("link", { name: "Aggiungi una scadenza" });
    expect(await hasTouchArea(add, 44)).toBe(true);
    expect((await add.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  });

  test("«Riprova» dell'errore ha un'area di tocco di almeno 44 px (mobile)", async ({
    page,
    baseURL,
    casa,
  }) => {
    test.skip(!isMobileProject(), "area di tocco: solo mobile");
    await seed(casa);
    await failRead(page);
    await setClock(page, TODAY);
    await casa.signIn(page, baseURL, "Marco");
    await page.goto(PATH);
    const retry = alerts(page).getByRole("button", { name: "Riprova" });
    await expect(retry).toBeVisible();
    expect(await hasTouchArea(retry, 44)).toBe(true);
  });

  test("le righe non ricevono il fuoco: Tab non entra nella lista", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seed(casa);
    await open(page, baseURL, casa);
    await expect(
      col(page).locator("a[href], button, [tabindex]:not([tabindex='-1'])"),
    ).toHaveCount(0);
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      const inside = await page.evaluate(
        () =>
          !!document.activeElement?.closest(
            'section[aria-label="Scadenze"] ul',
          ),
      );
      expect(inside).toBe(false);
    }
  });

  test("su mobile il fuoco va dalle voci del selettore alla navigazione in basso (nessun controllo nella lista)", async ({
    page,
    baseURL,
    casa,
  }) => {
    test.skip(!isMobileProject(), "Il selettore c'è solo su mobile");
    await seed(casa);
    await open(page, baseURL, casa);
    await switcher(page)
      .getByRole("link", { name: /^Da fare/ })
      .focus();
    await page.keyboard.press("Tab");
    // After «Da fare» comes «Spesa»/«Da fare»/«Scadenze» order: the last voice.
    await expect(
      switcher(page).getByRole("button", { name: /^Scadenze/ }),
    ).toBeFocused();
    await page.keyboard.press("Tab");
    const insideList = await page.evaluate(
      () => !!document.activeElement?.closest("ul.scheda"),
    );
    expect(insideList).toBe(false);
  });
});
