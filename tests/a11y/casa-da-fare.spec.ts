import AxeBuilder from "@axe-core/playwright";
import type { Locator, Page } from "@playwright/test";
import {
  addDays,
  alerts,
  at1552,
  busy,
  column,
  CORS,
  expect,
  filterGroup,
  isMobileProject,
  lastTuesday,
  pauseClock,
  setClock,
  switcher,
  test,
  type CasaNest,
} from "../fixtures/casa";

// Casa · Da fare (#23): axe in every state, one h1 and the order of the
// headings, names read by screen readers, touch areas (mobile), keyboard
// order, visible focus and focus moves, live region.
//
// Roles and texts are those of the requirement and of the designer's
// specification, checked against the code of PR #127. Every test has its own
// throwaway Nest (fixtures/casa.ts).

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

const PATH = "/casa/da-fare";
const T = lastTuesday();
const d = (n: number) => addDays(T, n);

const FIRMARE = "Firmare autorizzazione gita";
const CUFFIA = "Comprare la cuffia da nuoto";
const REGALO = "Regalo per la festa di Giulia";
const BUS = "Rinnovare l'abbonamento del bus";

const col = (page: Page) => column(page, "Da fare");
const rowOf = (page: Page, title: string) =>
  col(page)
    .locator("li.riga-lista")
    .filter({ has: page.locator(".riga-lista__titolo", { hasText: title }) });
const toast = (page: Page) =>
  page.getByRole("status").filter({ hasText: "Fatto:" });

async function seed(casa: CasaNest) {
  await casa.todo("Marco", {
    title: FIRMARE,
    forMember: "Sofia",
    assignee: "Marco",
    due: d(3),
  });
  await casa.todo("Marco", {
    title: CUFFIA,
    forMember: "Sofia",
    assignee: "Laura",
    due: d(2),
  });
  await casa.todo("Marco", { title: REGALO, assignee: "Laura", due: d(4) });
  await casa.todo("Marco", { title: BUS, assignee: "Sofia", due: d(13) });
  await casa.todo("Marco", {
    title: "Pagare la rata",
    assignee: "Marco",
    doneAt: new Date(at1552(T).getTime() - 24 * 60 * 60 * 1000),
  });
  await casa.todo("Marco", {
    title: "Prenotare il ristorante",
    priv: true,
    assignee: "Marco",
    due: d(1),
  });
}

async function open(
  page: Page,
  baseURL: string | undefined,
  casa: CasaNest,
  ready: Locator = col(page),
  pause = false,
) {
  await setClock(page, at1552(T));
  await casa.signIn(page, baseURL, "Marco");
  await page.goto(PATH);
  await expect(ready).toBeVisible({ timeout: 20_000 });
  await expect(busy(page)).toHaveCount(0);
  if (pause) await pauseClock(page);
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

/**
 * True when the 44 x 44 px square around the centre of the control hits the
 * control (or something inside it): the touch area is the whole square.
 */
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

async function hasFocusRing(target: Locator) {
  return target.evaluate((el) => {
    const cs = getComputedStyle(el);
    return (
      (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0) ||
      cs.boxShadow !== "none"
    );
  });
}

// --- axe, every state -----------------------------------------------------

test.describe("axe", () => {
  test("normale", async ({ page, baseURL, casa }) => {
    await seed(casa);
    await open(page, baseURL, casa);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("vuoto", async ({ page, baseURL, casa }) => {
    await open(page, baseURL, casa, page.getByText("Niente da fare, per ora"));
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("filtro senza risultati", async ({ page, baseURL, casa }) => {
    await seed(casa);
    await open(page, baseURL, casa);
    await filterGroup(page)
      .getByRole("button", { name: "Tommaso", exact: true })
      .click();
    await expect(page.getByText("Niente da fare per Tommaso")).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("caricamento", async ({ page, baseURL, casa }) => {
    await seed(casa);
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(/\/rest\/v1\/todos/, async (route) => {
      await gate;
      await route.continue();
    });
    await setClock(page, at1552(T));
    await casa.signIn(page, baseURL, "Marco");
    await page.goto(PATH);
    await expect(busy(page)).toHaveCount(1);
    expect(await seriousViolations(page)).toEqual([]);
    release();
    await expect(col(page)).toBeVisible({ timeout: 20_000 });
  });

  test("errore di pagina (mobile) o di colonna (desktop)", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seed(casa);
    await page.route(/\/rest\/v1\/todos/, async (route) => {
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
    await setClock(page, at1552(T));
    await casa.signIn(page, baseURL, "Marco");
    await page.goto(PATH);
    // Mobile: error of the whole page. Desktop: error in the «Da fare» column
    // only (coordinator, 30/10; specification 3.7b).
    await expect(alerts(page)).toContainText(
      isMobileProject()
        ? "Questa pagina non si è caricata"
        : "Non riusciamo a caricare le cose da fare",
    );
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("avviso offline", async ({ page, baseURL, casa }) => {
    await seed(casa);
    await open(page, baseURL, casa);
    await page.context().setOffline(true);
    await page
      .getByRole("checkbox", { name: `Segna come fatto: ${FIRMARE}` })
      .click();
    await expect(alerts(page)).toContainText("Sei offline");
    expect(await seriousViolations(page)).toEqual([]);
    await page.context().setOffline(false);
  });

  test("conferma (toast)", async ({ page, baseURL, casa }) => {
    await seed(casa);
    await open(page, baseURL, casa);
    await page
      .getByRole("checkbox", { name: `Segna come fatto: ${FIRMARE}` })
      .click();
    await expect(toast(page)).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });
});

// --- structure and names read by screen readers -----------------------------

test.describe("struttura e nomi", () => {
  test("un solo h1; su desktop h1, h2 «Da fare», h3 dei gruppi", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seed(casa);
    await open(page, baseURL, casa);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(col(page).getByRole("heading", { level: 3 })).toHaveText([
      "Questa settimana",
      "Più avanti",
      "Fatti",
    ]);
    if (!isMobileProject()) {
      await expect(
        col(page).getByRole("heading", { level: 2, name: "Da fare" }),
      ).toBeVisible();
    }
  });

  test("le caselle hanno ruolo checkbox, aria-checked e un nome con l'azione", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seed(casa);
    await open(page, baseURL, casa);
    const open1 = page.getByRole("checkbox", {
      name: `Segna come fatto: ${FIRMARE}`,
    });
    await expect(open1).toHaveAttribute("aria-checked", "false");
    const done = page.getByRole("checkbox", {
      name: "Rimetti da fare: Pagare la rata",
    });
    await expect(done).toHaveAttribute("aria-checked", "true");
  });

  test("chi se ne occupa è scritto per i lettori di schermo; il lucchetto è decorativo", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seed(casa);
    await open(page, baseURL, casa);
    // Specification section 6: hidden text «, se ne occupa <nome>».
    await expect(
      rowOf(page, FIRMARE).locator(".riga-lista__testo"),
    ).toContainText("se ne occupa Marco");
    await expect(
      rowOf(page, CUFFIA).locator(".riga-lista__testo"),
    ).toContainText("se ne occupa Laura");
    const lock = rowOf(page, "Prenotare il ristorante").getByTestId(
      "lucchetto",
    );
    await expect(lock).toHaveAttribute("aria-hidden", "true");
    await expect(
      rowOf(page, "Prenotare il ristorante").locator(".riga-lista__info"),
    ).toContainText("solo tu");
  });

  test("i chip sono bottoni con aria-pressed e l'avatar è decorativo", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seed(casa);
    await open(page, baseURL, casa);
    const group = filterGroup(page);
    await expect(group).toBeVisible();
    // The name of the chip is the name of the person (the avatar is aria-hidden).
    await expect(
      group.getByRole("button", { name: "Laura", exact: true }),
    ).toHaveAttribute("aria-pressed", "false");
    await expect(
      group.getByRole("button", { name: "Tutti", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  test("scegliere un chip annuncia quante cose restano per quella persona", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seed(casa);
    await open(page, baseURL, casa);
    await filterGroup(page)
      .getByRole("button", { name: "Laura", exact: true })
      .click();
    // Specification 3.6: «<N> da fare per <nome>» in the live region.
    await expect(
      page.locator('[aria-live="polite"]').filter({
        hasText: "2 da fare per Laura",
      }),
    ).toHaveCount(1);
  });
});

// --- touch areas ------------------------------------------------------------

test("aree di tocco di almeno 44 px (mobile)", async ({
  page,
  baseURL,
  casa,
}) => {
  test.skip(!isMobileProject(), "area di tocco: solo mobile");
  await seed(casa);
  await open(page, baseURL, casa);
  await page.evaluate(() => window.scrollTo(0, 0));
  const checkbox = page.getByRole("checkbox", {
    name: `Segna come fatto: ${FIRMARE}`,
  });
  expect(await hasTouchArea(checkbox, 44)).toBe(true);
  for (const name of ["Tutti", "Miei", "Laura"]) {
    expect(
      await hasTouchArea(
        filterGroup(page).getByRole("button", { name, exact: true }),
        44,
      ),
    ).toBe(true);
  }
  const voices = switcher(page).locator(".selettore__voce");
  for (let i = 0; i < (await voices.count()); i++) {
    expect((await voices.nth(i).boundingBox())!.height).toBeGreaterThanOrEqual(
      44,
    );
  }
});

// --- keyboard and focus -------------------------------------------------------

test.describe("tastiera e fuoco", () => {
  test("Tab arriva alle caselle e Spazio le spunta; l'anello di fuoco si vede", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seed(casa);
    await open(page, baseURL, casa);
    const checkbox = page.getByRole("checkbox", {
      name: `Segna come fatto: ${FIRMARE}`,
    });
    await page.keyboard.press("Tab"); // makes :focus-visible apply
    await checkbox.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(checkbox).toBeFocused();
    expect(await hasFocusRing(checkbox)).toBe(true);
    await page.keyboard.press("Space");
    await expect(
      page.getByRole("checkbox", { name: `Rimetti da fare: ${FIRMARE}` }),
    ).toHaveAttribute("aria-checked", "true");
  });

  test("i chip si scelgono da tastiera e tengono il fuoco", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seed(casa);
    await open(page, baseURL, casa);
    const laura = filterGroup(page).getByRole("button", {
      name: "Laura",
      exact: true,
    });
    await laura.focus();
    await page.keyboard.press("Enter");
    await expect(laura).toHaveAttribute("aria-pressed", "true");
    await expect(laura).toBeFocused();
  });

  test("il fuoco resta sulla casella della stessa riga quando passa in «Fatti»", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seed(casa);
    await open(page, baseURL, casa, col(page), true);
    const checkbox = page.getByRole("checkbox", {
      name: `Segna come fatto: ${FIRMARE}`,
    });
    await checkbox.focus();
    await page.keyboard.press("Space");
    await page.clock.runFor(5100);
    await expect(toast(page)).toHaveCount(0);
    const moved = page
      .locator("section.sezione")
      .filter({ has: page.getByRole("heading", { level: 3, name: "Fatti" }) })
      .getByRole("checkbox", { name: `Rimetti da fare: ${FIRMARE}` });
    await expect(moved).toBeVisible();
    await expect(moved).toBeFocused();
  });

  test("«Annulla» riporta il fuoco sulla casella della riga", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seed(casa);
    await open(page, baseURL, casa, col(page), true);
    await page
      .getByRole("checkbox", { name: `Segna come fatto: ${FIRMARE}` })
      .click();
    await toast(page).getByRole("button", { name: "Annulla" }).click();
    await expect(
      page.getByRole("checkbox", { name: `Segna come fatto: ${FIRMARE}` }),
    ).toBeFocused();
  });

  test("su desktop il campo rapido è nell'ordine del fuoco prima delle caselle", async ({
    page,
    baseURL,
    casa,
  }) => {
    test.skip(isMobileProject(), "Il campo rapido c'è solo su desktop");
    await seed(casa);
    await open(page, baseURL, casa);
    const field = page.getByRole("textbox", {
      name: "Aggiungi una cosa da fare…",
    });
    await field.focus();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("checkbox").first()).toBeFocused();
  });
});
