import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  CROWD_EVENTS,
  MONTH_EVENTS,
  openMonth,
  waitForMonth,
} from "../visual/calendario-mese-helpers";
import {
  throwawayConfigured,
  throwawaySkipReason,
  withNest,
} from "../visual/calendario-settimana-helpers";

// Calendario · Mese (#27), visual tester's accessibility checks: axe in every
// state (normal with the lens «Nest» and «Io», empty, loading, month change in
// loading, another month with the link «Oggi», holiday chosen, five people,
// page error, offline), no duplicated id, the grid from the keyboard (one Tab
// stop, arrows, Home, End, Enter, Space, no trap), visible focus ring, touch
// areas of 44 px and no horizontal scroll. Every test builds its own throwaway
// Nest, with the clock at Tuesday 20 October 2026, 15:52 (Rome).

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

test.beforeEach(() => {
  test.skip(!throwawayConfigured(), throwawaySkipReason);
  test.setTimeout(180_000);
});

async function violations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  const extra = await new AxeBuilder({ page })
    .withRules(["label-content-name-mismatch", "aria-required-children"])
    .analyze();
  return [...results.violations, ...extra.violations]
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => n.target.join(" ")),
    }));
}

async function duplicatedIds(page: Page) {
  return page.evaluate(() => {
    const seen = new Map<string, number>();
    for (const el of document.querySelectorAll("[id]")) {
      seen.set(el.id, (seen.get(el.id) ?? 0) + 1);
    }
    return [...seen].filter(([, n]) => n > 1).map(([id]) => id);
  });
}

async function expectClean(page: Page) {
  expect(await violations(page)).toEqual([]);
  expect(await duplicatedIds(page)).toEqual([]);
}

const cell = (page: Page, start: RegExp) =>
  page.getByRole("gridcell", { name: start });

const todayLink = (page: Page) =>
  page.locator(".periodo").getByRole("link", { name: "Oggi", exact: true });

// --- axe, every state --------------------------------------------------------

test.describe("axe", () => {
  test("normale: lente Nest e lente Io", async ({ page, baseURL }) => {
    await withNest(MONTH_EVENTS, async (nest) => {
      await openMonth(page, baseURL, nest, { lens: "nest" });
      await waitForMonth(page);
      await expectClean(page);
      await page.getByRole("button", { name: /Io$/ }).click();
      await expect(
        page.getByRole("button", { name: /Io$/, pressed: true }),
      ).toBeVisible();
      await expectClean(page);
    });
  });

  test("vuoto", async ({ page, baseURL }) => {
    await withNest([], async (nest) => {
      await openMonth(page, baseURL, nest);
      await waitForMonth(page);
      await expect(page.getByText("Niente in programma")).toBeVisible();
      await expectClean(page);
    });
  });

  test("caricamento all'apertura", async ({ page, baseURL }) => {
    await withNest(MONTH_EVENTS, async (nest) => {
      await page.route("**/rpc/list_household_events*", () => {});
      await openMonth(page, baseURL, nest);
      await expect(
        page.getByRole("heading", { level: 1, name: "Ottobre 2026" }),
      ).toBeVisible({ timeout: 30_000 });
      await expect(page.locator('[aria-busy="true"]').first()).toBeAttached();
      await expectClean(page);
    });
  });

  test("cambio di mese in caricamento e altro mese con «Oggi»", async ({
    page,
    baseURL,
  }) => {
    await withNest(MONTH_EVENTS, async (nest) => {
      await openMonth(page, baseURL, nest);
      await waitForMonth(page);
      await page.route("**/rpc/list_household_events*", () => {});
      await page.getByRole("button", { name: "Mese successivo" }).click();
      await expect(
        page.getByRole("heading", { level: 1, name: "Novembre 2026" }),
      ).toBeVisible();
      await expect(page.locator('[aria-busy="true"]').first()).toBeAttached();
      await expect(todayLink(page)).toBeVisible();
      await expectClean(page);
    });
  });

  test("giorno festivo scelto e cinque persone", async ({ page, baseURL }) => {
    await withNest(CROWD_EVENTS, async (nest) => {
      await openMonth(page, baseURL, nest);
      await waitForMonth(page);
      await cell(page, /^1, domenica 1 novembre/).click();
      await expect(
        page.getByRole("heading", { level: 2, name: "Domenica 1 novembre" }),
      ).toBeVisible();
      await expectClean(page);
      await cell(page, /^7, mercoledì 7 ottobre/).click();
      await expectClean(page);
    });
  });

  test("errore di pagina", async ({ page, baseURL }) => {
    await withNest(MONTH_EVENTS, async (nest) => {
      await page.route("**/rpc/list_household_events*", (route) =>
        route.abort("failed"),
      );
      await openMonth(page, baseURL, nest);
      await expect(
        page.getByRole("heading", { name: "Questa pagina non si è caricata" }),
      ).toBeVisible({ timeout: 30_000 });
      await expectClean(page);
    });
  });

  test("avviso offline", async ({ page, context, baseURL }) => {
    await withNest(MONTH_EVENTS, async (nest) => {
      await openMonth(page, baseURL, nest);
      await waitForMonth(page);
      await context.setOffline(true);
      await page.getByRole("button", { name: "Mese successivo" }).click();
      await expect(
        page.getByText(
          "Non riusciamo a caricare questo mese. Controlla la connessione e riprova.",
        ),
      ).toBeVisible();
      await expectClean(page);
      await page.getByRole("button", { name: "Mese precedente" }).click();
      await expect(
        page
          .getByRole("alert")
          .filter({ hasText: "Non riusciamo ad aggiornare il calendario." }),
      ).toBeVisible();
      await expectClean(page);
    });
  });
});

// --- keyboard ----------------------------------------------------------------

test.describe("tastiera", () => {
  test("la griglia è una sola fermata del Tab, sul giorno scelto", async ({
    page,
    baseURL,
  }) => {
    await withNest(MONTH_EVENTS, async (nest) => {
      await openMonth(page, baseURL, nest);
      await waitForMonth(page);
      const tabbable = await page
        .getByRole("grid")
        .getByRole("gridcell")
        .evaluateAll((els) =>
          els
            .filter((el) => (el as HTMLElement).tabIndex >= 0)
            .map((el) => el.getAttribute("aria-label") ?? ""),
        );
      expect(tabbable).toHaveLength(1);
      expect(tabbable[0]).toMatch(/^20, martedì 20 ottobre, oggi/);
    });
  });

  test("frecce, Inizio, Fine, Invio e Spazio", async ({ page, baseURL }) => {
    await withNest(MONTH_EVENTS, async (nest) => {
      await openMonth(page, baseURL, nest);
      await waitForMonth(page);
      const focusedName = () =>
        page.evaluate(
          () => document.activeElement?.getAttribute("aria-label") ?? "",
        );

      await cell(page, /^20, martedì 20 ottobre/).focus();
      await page.keyboard.press("ArrowRight");
      expect(await focusedName()).toMatch(/^21, mercoledì 21 ottobre/);
      await page.keyboard.press("ArrowDown");
      expect(await focusedName()).toMatch(/^28, mercoledì 28 ottobre/);
      await page.keyboard.press("ArrowLeft");
      expect(await focusedName()).toMatch(/^27, martedì 27 ottobre/);
      await page.keyboard.press("ArrowUp");
      expect(await focusedName()).toMatch(/^20, martedì 20 ottobre/);
      // Moving the focus does not choose the day.
      await expect(
        page.getByRole("heading", { level: 2, name: "Martedì 20" }),
      ).toBeVisible();

      await page.keyboard.press("Home");
      expect(await focusedName()).toMatch(/^19, lunedì 19 ottobre/);
      await page.keyboard.press("End");
      expect(await focusedName()).toMatch(/^25, domenica 25 ottobre/);

      await page.keyboard.press("Enter");
      await expect(
        page.getByRole("heading", { level: 2, name: "Domenica 25" }),
      ).toBeVisible();
      await expect(cell(page, /^25, domenica 25 ottobre/)).toHaveAttribute(
        "aria-selected",
        "true",
      );
      await page.keyboard.press("ArrowLeft");
      await page.keyboard.press("Space");
      await expect(
        page.getByRole("heading", { level: 2, name: "Sabato 24" }),
      ).toBeVisible();
      expect(new URL(page.url()).search).toBe("");

      // At the edges the focus stays: no change of month.
      await cell(page, /^28, lunedì 28 settembre/).focus();
      await page.keyboard.press("ArrowLeft");
      await page.keyboard.press("ArrowUp");
      expect(await focusedName()).toMatch(/^28, lunedì 28 settembre/);
      await expect(
        page.getByRole("heading", { level: 1, name: "Ottobre 2026" }),
      ).toBeVisible();
    });
  });

  test("ordine del focus e nessuna trappola", async ({ page, baseURL }) => {
    await withNest(MONTH_EVENTS, async (nest) => {
      await openMonth(page, baseURL, nest);
      await waitForMonth(page);
      await page.getByRole("heading", { level: 1 }).focus();
      const seen: string[] = [];
      for (let i = 0; i < 60; i++) {
        await page.keyboard.press("Tab");
        const stop = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          if (!el || el === document.body) return "body";
          if (el.closest('[role="grid"]')) return "griglia";
          return (
            el.getAttribute("aria-label") ||
            el.textContent?.trim().slice(0, 30) ||
            el.tagName
          );
        });
        seen.push(stop);
      }
      const label = seen.join(" | ");
      const prev = seen.indexOf("Mese precedente");
      const next = seen.indexOf("Mese successivo");
      const gridStop = seen.indexOf("griglia");
      const firstRow = seen.findIndex((s) => /^\d{1,2}:\d{2}/.test(s));
      expect(prev, label).toBeGreaterThanOrEqual(0);
      expect(next, label).toBeGreaterThan(prev);
      expect(gridStop, label).toBeGreaterThan(next);
      expect(firstRow, label).toBeGreaterThan(gridStop);
      // The grid is a single stop.
      expect(
        seen.filter((s) => s === "griglia"),
        label,
      ).toHaveLength(1);
      // The focus goes on past the page: no trap.
      expect(new Set(seen).size, label).toBeGreaterThan(8);
    });
  });

  test("l'anello del focus si vede e sta sopra le celle vicine", async ({
    page,
    baseURL,
  }) => {
    await withNest(MONTH_EVENTS, async (nest) => {
      await openMonth(page, baseURL, nest);
      await waitForMonth(page);
      await page.getByRole("heading", { level: 1 }).focus();
      let found: Locator | null = null;
      for (let i = 0; i < 30 && !found; i++) {
        await page.keyboard.press("Tab");
        const onGrid = await page.evaluate(
          () => !!document.activeElement?.closest('[role="grid"]'),
        );
        if (onGrid) found = page.locator(":focus");
      }
      expect(found, "la griglia prende il focus con il Tab").not.toBeNull();
      const ring = await found!.evaluate((el) => {
        const s = getComputedStyle(el);
        return {
          style: s.outlineStyle,
          width: parseFloat(s.outlineWidth),
          z: s.zIndex,
        };
      });
      expect(ring.style).toBe("solid");
      expect(ring.width).toBeGreaterThanOrEqual(2);
      expect(ring.z).not.toBe("auto");
    });
  });
});

// --- touch areas and layout --------------------------------------------------

test.describe("aree di tocco e layout", () => {
  test("celle, frecce e «Oggi»: almeno 44 px", async ({ page, baseURL }) => {
    await withNest(MONTH_EVENTS, async (nest) => {
      await openMonth(page, baseURL, nest, {
        path: "/calendario/mese?mese=2026-11",
      });
      await waitForMonth(page, "Novembre 2026");
      const small: string[] = [];
      const targets: Array<[string, Locator]> = [
        [
          "Mese precedente",
          page.getByRole("button", { name: "Mese precedente" }),
        ],
        [
          "Mese successivo",
          page.getByRole("button", { name: "Mese successivo" }),
        ],
        ["Oggi", todayLink(page)],
      ];
      const gridCells = page.getByRole("grid").getByRole("gridcell");
      const n = await gridCells.count();
      for (let i = 0; i < n; i++) {
        targets.push([`cella ${i + 1}`, gridCells.nth(i)]);
      }
      for (const [name, target] of targets) {
        const box = await target.boundingBox();
        if (!box || box.width < 43.5 || box.height < 43.5) {
          small.push(`${name}: ${box?.width}x${box?.height}`);
        }
      }
      expect(small).toEqual([]);
    });
  });

  test("righe dell'elenco alte almeno 44 px", async ({ page, baseURL }) => {
    await withNest(MONTH_EVENTS, async (nest) => {
      await openMonth(page, baseURL, nest);
      await waitForMonth(page);
      const rows = page.getByRole("main").locator("a.riga-evento");
      await expect(rows.first()).toBeVisible();
      const heights = await rows.evaluateAll((els) =>
        els.map((el) => el.getBoundingClientRect().height),
      );
      expect(heights.length).toBeGreaterThan(0);
      for (const h of heights) expect(h).toBeGreaterThanOrEqual(44);
    });
  });

  test("nessuno scorrimento orizzontale, anche a settembre e agosto", async ({
    page,
    baseURL,
  }) => {
    await withNest(CROWD_EVENTS, async (nest) => {
      for (const month of ["2026-10", "2026-09", "2026-08"]) {
        await openMonth(page, baseURL, nest, {
          path: `/calendario/mese?mese=${month}`,
        });
        await expect(page.getByRole("grid")).toBeVisible({ timeout: 30_000 });
        await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, {
          timeout: 30_000,
        });
        const { scroll, width } = await page.evaluate(() => ({
          scroll: document.documentElement.scrollWidth,
          width: window.innerWidth,
        }));
        expect(scroll, month).toBeLessThanOrEqual(width);
      }
    });
  });

  test("titoli in ordine: un h1 e poi un h2", async ({ page, baseURL }) => {
    await withNest(MONTH_EVENTS, async (nest) => {
      await openMonth(page, baseURL, nest);
      await waitForMonth(page);
      const levels = await page.evaluate(() =>
        Array.from(document.querySelectorAll("h1, h2, h3")).map(
          (h) => h.tagName,
        ),
      );
      expect(levels).toEqual(["H1", "H2"]);
    });
  });
});
