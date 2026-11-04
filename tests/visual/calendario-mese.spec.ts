import { expect, test } from "@playwright/test";
import {
  CROWD_EVENTS,
  MONTH_EVENTS,
  openMonth,
  waitForMonth,
} from "./calendario-mese-helpers";
import {
  isMobile,
  shoot,
  throwawayConfigured,
  throwawaySkipReason,
  withNest,
} from "./calendario-settimana-helpers";

// Calendario · Mese (#27): one screenshot per state, at 390 and 1280 px
// (projects). The normal state with the lens «Nest» is the reference
// «calendario-mese.png» of date-calendario.spec.ts. Every test builds its own
// throwaway Nest (Casa D'Angelo of the mockup) with its own events in October
// 2026 and deletes everything at the end. Clock fixed at the time of the
// mockup: Tuesday 20 October 2026, 15:52 (Rome). References: CI container
// (workflow visual-baseline).

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

test.beforeEach(() => {
  test.skip(!throwawayConfigured(), throwawaySkipReason);
  test.setTimeout(180_000);
});

test("lente Io", async ({ page, baseURL }) => {
  await withNest(MONTH_EVENTS, async (nest) => {
    await openMonth(page, baseURL, nest, { lens: "io" });
    await waitForMonth(page);
    await expect(
      page.getByRole("button", { name: /Io$/, pressed: true }),
    ).toBeVisible();
    await shoot(page, "lente-io.png");
  });
});

test("vuoto", async ({ page, baseURL }) => {
  await withNest([], async (nest) => {
    await openMonth(page, baseURL, nest, { lens: "nest" });
    await waitForMonth(page);
    await expect(page.getByText("Niente in programma")).toBeVisible();
    await shoot(page, "vuoto.png");
  });
});

test("caricamento all'apertura", async ({ page, baseURL }) => {
  await withNest(MONTH_EVENTS, async (nest) => {
    // The reading of the events never answers: the page stays in loading.
    await page.route("**/rpc/list_household_events*", () => {});
    await openMonth(page, baseURL, nest, { lens: "nest" });
    await expect(
      page.getByRole("heading", { level: 1, name: "Ottobre 2026" }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('[aria-busy="true"]').first()).toBeAttached();
    await expect(page.getByText("Caricamento in corso").first()).toBeAttached();
    await shoot(page, "caricamento.png");
  });
});

test("cambio di mese in caricamento: la griglia resta, senza punti", async ({
  page,
  baseURL,
}) => {
  await withNest(MONTH_EVENTS, async (nest) => {
    await openMonth(page, baseURL, nest, { lens: "nest" });
    await waitForMonth(page);
    // From now on the readings never answer: the next month stays loading.
    await page.route("**/rpc/list_household_events*", () => {});
    await page.getByRole("button", { name: "Mese successivo" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Novembre 2026" }),
    ).toBeVisible();
    await expect(page.getByRole("grid")).toBeVisible();
    await expect(page.locator('[aria-busy="true"]').first()).toBeAttached();
    await shoot(page, "cambio-mese-caricamento.png");
  });
});

test("altro mese con il link «Oggi»", async ({ page, baseURL }) => {
  await withNest(MONTH_EVENTS, async (nest) => {
    await openMonth(page, baseURL, nest, {
      lens: "nest",
      path: "/calendario/mese?mese=2026-11",
    });
    await waitForMonth(page, "Novembre 2026");
    await expect(
      page.locator(".periodo").getByRole("link", { name: "Oggi", exact: true }),
    ).toBeVisible();
    await shoot(page, "altro-mese-oggi.png");
  });
});

test("giorno festivo scelto (1 novembre, Ognissanti)", async ({
  page,
  baseURL,
}) => {
  await withNest(MONTH_EVENTS, async (nest) => {
    await openMonth(page, baseURL, nest, { lens: "nest" });
    await waitForMonth(page);
    await page
      .getByRole("gridcell", { name: /^1, domenica 1 novembre/ })
      .click();
    await expect(
      page.getByRole("heading", { level: 2, name: "Domenica 1 novembre" }),
    ).toBeVisible();
    await shoot(page, "festivo-scelto.png");
  });
});

test("giorno con impegni degli altri nascosti (lente Io)", async ({
  page,
  baseURL,
}) => {
  await withNest(MONTH_EVENTS, async (nest) => {
    await openMonth(page, baseURL, nest, { lens: "io" });
    await waitForMonth(page);
    await page
      .getByRole("gridcell", { name: /^14, mercoledì 14 ottobre/ })
      .click();
    await expect(
      page.getByText("1 impegno degli altri nascosto"),
    ).toBeVisible();
    await shoot(page, "impegni-nascosti.png");
  });
});

test("da 5 persone: punto grigio «e altri» sul telefono", async ({
  page,
  baseURL,
}) => {
  await withNest(CROWD_EVENTS, async (nest) => {
    await openMonth(page, baseURL, nest, { lens: "nest" });
    await waitForMonth(page);
    const others = page.getByTestId("punti-altri").first();
    if (isMobile(page)) await expect(others).toBeVisible();
    else await expect(others).toBeHidden();
    await shoot(page, "cinque-persone.png");
  });
});

test("passaggio del mouse su un giorno", async ({ page, baseURL }) => {
  await withNest(MONTH_EVENTS, async (nest) => {
    await openMonth(page, baseURL, nest, { lens: "nest" });
    await waitForMonth(page);
    const cell = page.getByRole("gridcell", {
      name: /^22, giovedì 22 ottobre/,
    });
    await cell.hover();
    await page.evaluate(() => document.fonts.ready);
    await expect(cell).toHaveScreenshot("cella-passaggio.png");
  });
});

test("errore (la pagina non si carica)", async ({ page, baseURL }) => {
  await withNest(MONTH_EVENTS, async (nest) => {
    // The first reading fails: the whole page is in error.
    await page.route("**/rpc/list_household_events*", (route) =>
      route.abort("failed"),
    );
    await openMonth(page, baseURL, nest, { lens: "nest" });
    await expect(
      page.getByRole("heading", { name: "Questa pagina non si è caricata" }),
    ).toBeVisible({ timeout: 30_000 });
    await shoot(page, "errore.png");
  });
});

test("offline: mese nuovo e impegni salvati", async ({
  page,
  context,
  baseURL,
}) => {
  await withNest(MONTH_EVENTS, async (nest) => {
    await openMonth(page, baseURL, nest, { lens: "nest" });
    await waitForMonth(page);

    // The network goes away and the person looks at a month never read.
    await context.setOffline(true);
    await page.getByRole("button", { name: "Mese successivo" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Novembre 2026" }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Non riusciamo a caricare questo mese. Controlla la connessione e riprova.",
      ),
    ).toBeVisible();
    await shoot(page, "offline-mese-nuovo.png");

    // Back to the month already read: the events stay, with the notice.
    await page.getByRole("button", { name: "Mese precedente" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Ottobre 2026" }),
    ).toBeVisible();
    await expect(
      page.getByRole("alert").filter({
        hasText:
          "Non riusciamo ad aggiornare il calendario. Vedi gli impegni salvati alle 15:52.",
      }),
    ).toBeVisible();
    await shoot(page, "offline-impegni-salvati.png");
  });
});
