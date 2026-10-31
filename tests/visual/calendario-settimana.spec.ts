import { expect, test } from "@playwright/test";
import {
  FULL_WEEK,
  SMALL_WEEK,
  WEEK_TITLE,
  isMobile,
  openWeek,
  shoot,
  throwawayConfigured,
  throwawaySkipReason,
  waitForData,
  withNest,
} from "./calendario-settimana-helpers";

// Calendario · Settimana (#25): one screenshot per state, at 390 and 1280 px
// (projects). Every test builds its own throwaway Nest (Casa D'Angelo of the
// mockup, with Laura as a second adult with an account), creates its own events
// in the week 19-25 October 2026 and deletes everything at the end.
// Clock fixed at the time of the mockup: Tuesday 20 October 2026, 15:52 (Rome).
// The references are generated in the CI container (workflow visual-baseline).

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

test.beforeEach(() => {
  test.skip(!throwawayConfigured(), throwawaySkipReason);
  test.setTimeout(180_000);
});

test("normale (lente Nest)", async ({ page, baseURL }) => {
  await withNest(FULL_WEEK, async (nest) => {
    await openWeek(page, baseURL, nest, { lens: "nest" });
    await waitForData(page);
    if (isMobile(page)) {
      await expect(page.getByText("Liberi insieme").first()).toBeVisible();
    } else {
      await expect(
        page.getByRole("img", { name: "Adesso, 15:52" }),
      ).toBeVisible();
    }
    await shoot(page, "normale.png");
  });
});

test("lente Io", async ({ page, baseURL }) => {
  await withNest(FULL_WEEK, async (nest) => {
    await openWeek(page, baseURL, nest, { lens: "io" });
    await waitForData(page);
    await expect(
      page.getByRole("button", { name: /Io$/, pressed: true }),
    ).toBeVisible();
    await shoot(page, "lente-io.png");
  });
});

test("vuoto", async ({ page, baseURL }) => {
  await withNest([], async (nest) => {
    await openWeek(page, baseURL, nest, { lens: "nest" });
    await waitForData(page);
    await expect(
      page.getByText("Questa settimana è ancora vuota"),
    ).toBeVisible();
    await shoot(page, "vuoto.png");
  });
});

test("caricamento", async ({ page, baseURL }) => {
  await withNest(SMALL_WEEK, async (nest) => {
    // The reading of the events never answers: the page stays in loading.
    await page.route("**/rpc/list_household_events*", () => {});
    await openWeek(page, baseURL, nest, { lens: "nest" });
    await expect(
      page.getByRole("heading", { level: 1, name: WEEK_TITLE }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('[aria-busy="true"]').first()).toBeAttached();
    await expect(page.getByText("Caricamento in corso")).toBeAttached();
    await shoot(page, "caricamento.png");
  });
});

test("errore (la pagina non si carica)", async ({ page, baseURL }) => {
  await withNest(SMALL_WEEK, async (nest) => {
    // The first reading fails: the whole page is in error.
    await page.route("**/rpc/list_household_events*", (route) =>
      route.abort("failed"),
    );
    await openWeek(page, baseURL, nest, { lens: "nest" });
    await expect(
      page.getByRole("heading", { name: "Questa pagina non si è caricata" }),
    ).toBeVisible({ timeout: 30_000 });
    await shoot(page, "errore.png");
  });
});

test("offline: impegni salvati e settimana nuova", async ({
  page,
  context,
  baseURL,
}) => {
  await withNest(SMALL_WEEK, async (nest) => {
    await openWeek(page, baseURL, nest, { lens: "nest" });
    await waitForData(page);
    await expect(page.getByText("Call con Acme").first()).toBeVisible();

    // The network goes away and the person looks at a week never read.
    await context.setOffline(true);
    await page.getByRole("button", { name: "Settimana successiva" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "26 ottobre – 1 novembre" }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Non riusciamo a caricare questa settimana. Controlla la connessione e riprova.",
      ),
    ).toBeVisible();
    await shoot(page, "offline-settimana-nuova.png");

    // Back to the week already read: the events stay, with the notice.
    await page.getByRole("button", { name: "Settimana precedente" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: WEEK_TITLE }),
    ).toBeVisible();
    await expect(
      page.getByRole("alert").filter({
        hasText:
          "Non riusciamo ad aggiornare il calendario. Vedi gli impegni salvati alle 15:52.",
      }),
    ).toBeVisible();
    await expect(page.getByText("Call con Acme").first()).toBeVisible();
    await shoot(page, "offline-impegni-salvati.png");
  });
});
