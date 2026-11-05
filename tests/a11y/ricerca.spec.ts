import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { waitForAnimationsToEnd } from "../fixtures/animations";
import { installRicercaFake, seedRecents } from "../fixtures/ricerca-fake";
import {
  SEARCH_NOW,
  isDesktop,
  openSearch,
  searchAndWait,
  searchField,
} from "../fixtures/ricerca-open";
import { hasTestUser } from "../fixtures/visual-login";
import { signInAsCached } from "../fixtures/visual-login-cached";

// Ricerca (#40): axe on every state (initial, recent searches, results, all
// kinds, nothing found, nothing in the filter, loading, error, offline with
// the sections under the notice, period-only with an «Occupato» row) at
// 390 px (page) and 1280 px (palette), plus the keyboard (order of the focus,
// visible ring, no trap, Esc), the touch areas (44 px, measured with
// elementFromPoint) and the structure the specification asks for. The results
// come from a fake of `search_household`; the clock is fixed.

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

test.beforeEach(async ({ page, context, baseURL }) => {
  test.skip(!hasTestUser("A"), "TEST_USER_A_* non impostati");
  await page.clock.setFixedTime(SEARCH_NOW);
  const signedIn = await signInAsCached(context, baseURL!, "A");
  test.skip(!signedIn, "utente di test A non ancora creato (#55)");
});

async function expectNoBlocking(page: Page) {
  await waitForAnimationsToEnd(page);
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
}

test.describe("axe, uno per stato", () => {
  test("iniziale", async ({ page }, testInfo) => {
    await installRicercaFake(page);
    await openSearch(page, testInfo);
    await expectNoBlocking(page);
  });

  test("iniziale con ricerche recenti", async ({ page, context }, testInfo) => {
    await installRicercaFake(page);
    await seedRecents(page, context, ["nuoto", "bollo auto", "questo weekend"]);
    await openSearch(page, testInfo);
    await expect(page.getByTestId("ricerca-recenti")).toBeVisible();
    await expectNoBlocking(page);
  });

  test("risultati per «nuoto»", async ({ page }, testInfo) => {
    await installRicercaFake(page);
    await openSearch(page, testInfo);
    await searchAndWait(page, "nuoto");
    await expectNoBlocking(page);
  });

  test("risultati di tutti i tipi per «auto»", async ({ page }, testInfo) => {
    await installRicercaFake(page);
    await openSearch(page, testInfo);
    await searchAndWait(page, "auto");
    await expectNoBlocking(page);
  });

  test("nessun risultato", async ({ page }, testInfo) => {
    await installRicercaFake(page);
    await openSearch(page, testInfo);
    await searchAndWait(page, "piscina olimpica");
    await expect(page.getByTestId("ricerca-vuoto")).toBeVisible();
    await expectNoBlocking(page);
  });

  test("nessun risultato nel filtro scelto", async ({ page }, testInfo) => {
    test.skip(isDesktop(testInfo), "i filtri sono solo su telefono");
    await installRicercaFake(page);
    await openSearch(page, testInfo);
    await page.getByRole("button", { name: "Spesa", exact: true }).click();
    await searchAndWait(page, "nuoto");
    await expect(page.getByTestId("ricerca-vuoto")).toBeVisible();
    await expectNoBlocking(page);
  });

  test("caricamento", async ({ page }, testInfo) => {
    await installRicercaFake(page, { mode: "slow" });
    await openSearch(page, testInfo);
    await searchField(page).fill("nuoto");
    const loading = page.getByTestId("ricerca-caricamento");
    await expect(loading).toBeVisible();
    await expect(loading).toHaveAttribute("aria-busy", "true");
    await expect(loading).toContainText("Caricamento in corso");
    await expectNoBlocking(page);
  });

  test("errore", async ({ page }, testInfo) => {
    await installRicercaFake(page, { mode: "error" });
    await openSearch(page, testInfo);
    await searchField(page).fill("nuoto");
    const problem = page.getByTestId("ricerca-errore");
    await expect(problem).toBeVisible();
    await expect(problem.getByRole("alert")).toContainText(
      "Non siamo riusciti a cercare. Controlla la connessione e riprova.",
    );
    await expect(
      problem.getByRole("button", { name: "Riprova" }),
    ).toBeVisible();
    await expectNoBlocking(page);
  });

  test("offline, con le sezioni sotto l'avviso", async ({
    page,
    context,
  }, testInfo) => {
    await installRicercaFake(page);
    await seedRecents(page, context, ["nuoto", "bollo auto"]);
    await openSearch(page, testInfo);
    try {
      await context.setOffline(true);
      await searchField(page).fill("nuoto");
      await expect(page.getByTestId("ricerca-offline")).toBeVisible();
      await expect(
        page.getByTestId("ricerca-offline").getByRole("alert"),
      ).toContainText(
        "Sei offline: la ricerca riparte appena torna la connessione.",
      );
      await expect(page.getByTestId("ricerca-recenti")).toBeVisible();
      await expect(page.getByTestId("ricerca-esempi")).toBeVisible();
      if (!isDesktop(testInfo)) {
        await expect(page.getByTestId("ricerca-persone")).toBeVisible();
      }
      await expectNoBlocking(page);
    } finally {
      await context.setOffline(false);
    }
  });

  test("solo periodo, con una riga «Occupato»", async ({ page }, testInfo) => {
    await installRicercaFake(page);
    await openSearch(page, testInfo);
    await searchAndWait(page, "questo weekend");
    await expect(page.getByTestId("ricerca-riga")).toHaveCount(2);
    await expectNoBlocking(page);
  });
});

test.describe("struttura", () => {
  test("telefono: un solo h1, nessuna barra, campo con etichetta e Annulla", async ({
    page,
  }, testInfo) => {
    test.skip(isDesktop(testInfo), "solo telefono");
    await installRicercaFake(page);
    await openSearch(page, testInfo);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Cerca nel Nest",
    );
    expect(await page.locator("header.barra").count()).toBe(0);
    await expect(page.locator("nav:visible")).toHaveCount(0);
    await expect(page.getByRole("search")).toBeVisible();
    await expect(
      page.getByRole("searchbox", { name: "Cerca nel Nest" }),
    ).toBeFocused();
    await expect(page.getByRole("link", { name: "Annulla" })).toBeVisible();
    await expect(page.getByTestId("ricerca-annuncio")).toHaveAttribute(
      "role",
      "status",
    );
    const field = searchField(page);
    await expect(field).toHaveAttribute("maxlength", "100");
    expect(await field.getAttribute("name")).toBeNull();
    // Filters: one pressed, the group has a name.
    const filters = page.getByRole("group", { name: "Filtra i risultati" });
    await expect(filters.locator('[aria-pressed="true"]')).toHaveCount(1);
    await expect(
      filters.getByRole("button", { name: "Tutto" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  test("computer: finestra «Cerca nel Nest» modale, piede, nessun filtro", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktop(testInfo), "solo computer");
    await installRicercaFake(page);
    await openSearch(page, testInfo);
    const dialog = page.getByRole("dialog", { name: "Cerca nel Nest" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await expect(dialog.getByRole("combobox")).toBeFocused();
    await expect(dialog).toContainText("per scorrere");
    await expect(dialog).toContainText("per aprire");
    await expect(dialog).toContainText("per chiudere");
    await expect(
      page.getByRole("group", { name: "Filtra i risultati" }),
    ).toHaveCount(0);
    await expect(page.getByTestId("ricerca-persone")).toHaveCount(0);
    await expect(page.getByTestId("ricerca-annuncio")).toHaveAttribute(
      "role",
      "status",
    );
  });

  test("la riga «Occupato» non si può aprire né raggiungere con il Tab", async ({
    page,
  }, testInfo) => {
    await installRicercaFake(page);
    await openSearch(page, testInfo);
    await searchAndWait(page, "questo weekend");
    const masked = page.locator('[data-masked="true"]');
    await expect(masked).toHaveCount(1);
    await expect(masked).toContainText("Laura ha un impegno");
    const focusable = await masked.evaluate(
      (el) =>
        el.querySelectorAll("a, button, input, [tabindex]").length +
        (el.matches("a, button, [tabindex]") ? 1 : 0),
    );
    expect(focusable).toBe(0);
  });

  test("l'annuncio dei risultati dice quanti sono, e si svuota", async ({
    page,
  }, testInfo) => {
    await installRicercaFake(page);
    await openSearch(page, testInfo);
    const status = page.getByTestId("ricerca-annuncio");
    await expect(status).toHaveAttribute("role", "status");
    await expect(status).toHaveText("");
    await searchAndWait(page, "nuoto");
    await expect(status).toHaveText("5 risultati per «nuoto»");
    await searchField(page).fill("");
    await expect(status).toHaveText("");
    await searchAndWait(page, "piscina olimpica");
    await expect(status).toHaveText("Nessun risultato per «piscina olimpica»");
  });
});

test.describe("tastiera", () => {
  /** Name of the focused element and whether a ring shows on it. */
  async function focused(page: Page) {
    return page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const ring = (node: Element | null) => {
        if (!node) return false;
        const s = getComputedStyle(node);
        const outline =
          s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0;
        const shadow = s.boxShadow !== "none" && s.boxShadow !== "";
        return outline || shadow;
      };
      // The field keeps the ring on its container (documented in the spec).
      const visible =
        ring(el) ||
        ring(el.closest(".campo-ricerca")) ||
        ring(el.querySelector(".casella"));
      const raw =
        el.getAttribute("aria-label") ||
        (el.textContent ?? "").replace(/\s+/g, " ").trim() ||
        el.tagName;
      // The initial of an avatar (aria-hidden) is in the text of a person chip.
      const label = raw.replace(/^[A-Z](?=[A-Z][a-z])/, "");
      const inDialog = !!el.closest('[role="dialog"]');
      return { label, visible, inDialog };
    });
  }

  /** Presses Tab `times` times from the field: names in order, ring always visible. */
  async function tabOrder(page: Page, times: number) {
    const first = await focused(page);
    expect(first?.visible).toBe(true);
    const order: string[] = [];
    for (let i = 0; i < times; i += 1) {
      await page.keyboard.press("Tab");
      const now = await focused(page);
      if (now === null) break;
      expect(now.visible, `anello su «${now.label}»`).toBe(true);
      order.push(now.label);
    }
    return order;
  }

  test("telefono, prima di scrivere: campo, Annulla, filtri, persone, Cancella, recenti, esempi", async ({
    page,
    context,
  }, testInfo) => {
    test.skip(isDesktop(testInfo), "solo telefono");
    await installRicercaFake(page);
    await seedRecents(page, context, ["nuoto", "bollo auto", "questo weekend"]);
    await openSearch(page, testInfo);
    const order = await tabOrder(page, 16);
    expect(order).toEqual([
      "Annulla",
      "Tutto",
      "Impegni",
      "Spesa",
      "Da fare",
      "Scadenze",
      "Tu",
      "Laura",
      "Sofia",
      "Tommaso",
      "Biscotto",
      "Cancella le ricerche recenti",
      "nuoto",
      "bollo auto",
      "questo weekend",
      "questo weekend",
    ]);
  });

  test("telefono, con i risultati: nei Da fare prima la casella, poi il titolo", async ({
    page,
  }, testInfo) => {
    test.skip(isDesktop(testInfo), "solo telefono");
    await installRicercaFake(page);
    await openSearch(page, testInfo);
    await searchAndWait(page, "nuoto");
    const order = await tabOrder(page, 12);
    expect(order.slice(0, 2)).toEqual(["Annulla", "Tutto5"]);
    const box = order.findIndex((l) =>
      l.startsWith("Segna come fatto: Comprare la cuffia da nuoto"),
    );
    const title = order.findIndex((l) => l === "Comprare la cuffia da nuoto");
    expect(box).toBeGreaterThan(0);
    expect(title).toBe(box + 1);
  });

  test("telefono, errore: campo, Annulla, Riprova", async ({
    page,
  }, testInfo) => {
    test.skip(isDesktop(testInfo), "solo telefono");
    await installRicercaFake(page, { mode: "error" });
    await openSearch(page, testInfo);
    await searchField(page).fill("nuoto");
    await expect(page.getByTestId("ricerca-errore")).toBeVisible();
    expect(await tabOrder(page, 2)).toEqual(["Annulla", "Riprova"]);
  });

  test("telefono, nessun risultato: campo, Annulla, «aggiungilo»", async ({
    page,
  }, testInfo) => {
    test.skip(isDesktop(testInfo), "solo telefono");
    await installRicercaFake(page);
    await openSearch(page, testInfo);
    await searchAndWait(page, "piscina olimpica");
    expect(await tabOrder(page, 2)).toEqual(["Annulla", "aggiungilo"]);
  });

  test("telefono: Shift+Tab dal campo porta fuori dalla pagina, senza trappole", async ({
    page,
  }, testInfo) => {
    test.skip(isDesktop(testInfo), "solo telefono");
    await installRicercaFake(page);
    await openSearch(page, testInfo);
    await page.keyboard.press("Shift+Tab");
    const now = await focused(page);
    expect(now === null || now.label !== "INPUT").toBe(true);
  });

  test("computer, prima di scrivere: campo, Cancella, campo (fuoco dentro la palette)", async ({
    page,
    context,
  }, testInfo) => {
    test.skip(!isDesktop(testInfo), "solo computer");
    await installRicercaFake(page);
    await seedRecents(page, context, ["nuoto", "bollo auto"]);
    await openSearch(page, testInfo);
    const order = await tabOrder(page, 4);
    expect(order).toEqual([
      "Cancella le ricerche recenti",
      "INPUT",
      "Cancella le ricerche recenti",
      "INPUT",
    ]);
  });

  test("computer, con i risultati: solo il campo; le righe si scelgono con le frecce", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktop(testInfo), "solo computer");
    await installRicercaFake(page);
    await openSearch(page, testInfo);
    await searchAndWait(page, "nuoto");
    expect(await tabOrder(page, 3)).toEqual(["INPUT", "INPUT", "INPUT"]);
  });

  test("computer, errore: campo, Riprova", async ({ page }, testInfo) => {
    test.skip(!isDesktop(testInfo), "solo computer");
    await installRicercaFake(page, { mode: "error" });
    await openSearch(page, testInfo);
    await searchField(page).fill("nuoto");
    await expect(page.getByTestId("ricerca-errore")).toBeVisible();
    expect(await tabOrder(page, 3)).toEqual(["Riprova", "INPUT", "Riprova"]);
  });

  test("computer, nessun risultato: campo, «aggiungilo», campo", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktop(testInfo), "solo computer");
    await installRicercaFake(page);
    await openSearch(page, testInfo);
    await searchAndWait(page, "piscina olimpica");
    expect(await tabOrder(page, 3)).toEqual([
      "aggiungilo",
      "INPUT",
      "aggiungilo",
    ]);
  });

  test("computer: Esc chiude la palette anche con del testo; le frecce spostano la scelta e il fuoco resta nel campo", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktop(testInfo), "solo computer");
    await installRicercaFake(page);
    await openSearch(page, testInfo);
    await searchAndWait(page, "nuoto");
    await page.keyboard.press("ArrowDown");
    await expect(searchField(page)).toBeFocused();
    const active = await searchField(page).getAttribute(
      "aria-activedescendant",
    );
    expect(active).toBeTruthy();
    await expect(page.locator(`[id="${active}"]`)).toHaveClass(
      /is-selezionata/,
    );
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/oggi$/);
    await expect(page.getByTestId("ricerca-palette")).toBeHidden();
  });
});

test.describe("aree di tocco", () => {
  async function smallTargets(page: Page) {
    return page.evaluate(() => {
      const root = document.querySelector("main") ?? document.body;
      const selector =
        'a[href], button, input, [role="checkbox"], [role="option"], [tabindex="0"]';
      const bad: string[] = [];
      for (const el of Array.from(
        root.querySelectorAll<HTMLElement>(selector),
      )) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const style = getComputedStyle(el);
        if (style.visibility === "hidden" || style.display === "none") continue;
        // The area that can be touched: points of a 44 x 44 box around the
        // centre must hit the element (the area may be a transparent ::before).
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const wide = Math.max(r.width, 44);
        const tall = Math.max(r.height, 44);
        const points: Array<[number, number]> = [
          [cx - wide / 2 + 1, cy],
          [cx + wide / 2 - 1, cy],
          [cx, cy - tall / 2 + 1],
          [cx, cy + tall / 2 - 1],
        ];
        // A control that already covers 44 px on a side only needs the other.
        const ok = points.every(([x, y]) => {
          if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return true;
          const hit = document.elementFromPoint(x, y);
          if (!hit) return true;
          return (
            el.contains(hit) || hit.contains(el) || !!hit.closest("label[for]")
          );
        });
        if (!ok) {
          bad.push(
            `${el.tagName.toLowerCase()} «${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40)}» ${Math.round(r.width)}x${Math.round(r.height)}`,
          );
        }
      }
      return bad;
    });
  }

  test("telefono: iniziale, tutti i controlli hanno almeno 44 x 44 px toccabili", async ({
    page,
    context,
  }, testInfo) => {
    test.skip(isDesktop(testInfo), "aree di tocco solo su telefono");
    await installRicercaFake(page);
    await seedRecents(page, context, ["nuoto", "bollo auto", "questo weekend"]);
    await openSearch(page, testInfo);
    expect(await smallTargets(page)).toEqual([]);
  });

  test("telefono: con i risultati, righe, caselle e filtri hanno almeno 44 x 44 px", async ({
    page,
  }, testInfo) => {
    test.skip(isDesktop(testInfo), "aree di tocco solo su telefono");
    await installRicercaFake(page);
    await openSearch(page, testInfo);
    await searchAndWait(page, "nuoto");
    expect(await smallTargets(page)).toEqual([]);
    // The box «Segna come fatto» is the 22 px box with its area around it.
    const box = page.getByRole("checkbox", {
      name: "Segna come fatto: Comprare la cuffia da nuoto",
    });
    await expect(box).toBeVisible();
  });
});
