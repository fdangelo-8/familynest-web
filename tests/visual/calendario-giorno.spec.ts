import { expect, test } from "@playwright/test";
import {
  DAY_WEEK,
  SEVEN,
  TEN,
  TUE,
  TUESDAY,
  boxIn,
  dayHeading,
  dayView,
  isMobile,
  mockupFrame,
  openDay,
  shootDay,
  throwawayConfigured,
  throwawaySkipReason,
  waitForDayData,
  withDayNest,
  withMockupNest,
  type EventSpec,
} from "./calendario-giorno-helpers";

// Calendario · Giorno «chi è dove» (#26): one screenshot per state, at 390 and
// 1280 px (projects). Every test builds its own throwaway Nest (Casa D'Angelo of
// the mockup 13-calendario-giorno), creates its own events in the week 19-25
// October 2026 and deletes everything at the end.
// Clock fixed at the time of the mockup: Tuesday 20 October 2026, 15:52 (Rome).
// «normale» and «lente Io» are shot in a window as tall as the frames of the
// mockup (390 x 1164, 1280 x 1040): the whole day fits, like in the mockup.
// The other states use the window of the project (the grid scrolls inside).
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
  await withMockupNest(DAY_WEEK, async (nest) => {
    await mockupFrame(page);
    await openDay(page, baseURL, nest, { lens: "nest" });
    await waitForDayData(page);
    await expect(
      page.getByTestId("testa-colonna").filter({ hasText: "Laura" }),
    ).toBeVisible();
    await expect(page.getByTestId("linea-adesso")).toBeAttached();
    await shootDay(page, "normale.png");
  });
});

test("lente Io", async ({ page, baseURL }) => {
  await withMockupNest(DAY_WEEK, async (nest) => {
    await mockupFrame(page);
    await openDay(page, baseURL, nest, { lens: "io" });
    await waitForDayData(page);
    await expect(
      page.getByRole("button", { name: /Io$/, pressed: true }).first(),
    ).toBeVisible();
    await expect(page.getByTestId("testa-colonna")).toHaveCount(1);
    await shootDay(page, "lente-io.png");
  });
});

test("normale: aperto un'ora prima di adesso", async ({ page, baseURL }) => {
  await withMockupNest(DAY_WEEK, async (nest) => {
    await openDay(page, baseURL, nest, { lens: "nest" });
    await waitForDayData(page);
    // Today the view opens scrolled to 14:52: only the view scrolls, not the page.
    await expect
      .poll(() => dayView(page).evaluate((el) => el.scrollTop))
      .toBeGreaterThan(0);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await shootDay(page, "normale-aperto-adesso.png");
  });
});

test("un altro giorno: il link «Oggi»", async ({ page, baseURL }) => {
  await withMockupNest(DAY_WEEK, async (nest) => {
    await openDay(page, baseURL, nest, { lens: "nest", day: "2026-10-22" });
    await waitForDayData(page, "2026-10-22");
    await expect(
      page.getByRole("link", { name: "Oggi", exact: true }).first(),
    ).toBeVisible();
    await shootDay(page, "altro-giorno.png");
  });
});

test("lente Io senza impegni miei", async ({ page, baseURL }) => {
  const others: EventSpec[] = [
    {
      who: "Laura",
      title: "Yoga",
      day: TUE,
      from: "20:30",
      to: "22:30",
      location: "Studio Respiro",
    },
    {
      who: "Laura",
      title: "Lavoro",
      day: TUE,
      from: "9:00",
      to: "15:00",
      visibility: "busy",
    },
  ];
  await withMockupNest(others, async (nest) => {
    await openDay(page, baseURL, nest, { lens: "io" });
    await waitForDayData(page);
    await expect(
      page.getByText(/degli altri nascosto|degli altri nascosti/),
    ).toBeVisible();
    await shootDay(page, "lente-io-senza-impegni.png");
  });
});

test("vuoto", async ({ page, baseURL }) => {
  await withMockupNest([], async (nest) => {
    await openDay(page, baseURL, nest, { lens: "nest" });
    await waitForDayData(page);
    await expect(page.getByText("Giornata libera")).toBeVisible();
    await expect(
      page.getByText("Nessuno ha impegni oggi.", { exact: false }),
    ).toBeVisible();
    await shootDay(page, "vuoto.png");
  });
});

test("caricamento", async ({ page, baseURL }) => {
  await withMockupNest(TUESDAY, async (nest) => {
    // The reading of the events never answers: the page stays in loading.
    await page.route("**/rpc/list_household_events*", () => {});
    await openDay(page, baseURL, nest, { lens: "nest" });
    await expect(dayHeading(page, TUE)).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('[aria-busy="true"]').first()).toBeAttached();
    await expect(page.getByText("Caricamento in corso").first()).toBeAttached();
    await shootDay(page, "caricamento.png");
  });
});

test("errore (la pagina non si carica)", async ({ page, baseURL }) => {
  await withMockupNest(TUESDAY, async (nest) => {
    // The first reading fails: the whole page is in error.
    await page.route("**/rpc/list_household_events*", (route) =>
      route.abort("failed"),
    );
    await openDay(page, baseURL, nest, { lens: "nest" });
    await expect(
      page.getByRole("heading", { name: "Questa pagina non si è caricata" }),
    ).toBeVisible({ timeout: 30_000 });
    await shootDay(page, "errore.png");
  });
});

test("offline: giorno di una settimana nuova e impegni salvati", async ({
  page,
  context,
  baseURL,
}) => {
  await withMockupNest(DAY_WEEK, async (nest) => {
    // Sunday 25 is the last day of the week already read.
    await openDay(page, baseURL, nest, { lens: "nest", day: "2026-10-25" });
    await waitForDayData(page, "2026-10-25");
    await expect(page.getByText("Pranzo dai nonni").first()).toBeVisible();

    // The network goes away and the person looks at Monday 26: another week, never read.
    await context.setOffline(true);
    await page.getByRole("button", { name: "Giorno successivo" }).click();
    await expect(dayHeading(page, "2026-10-26")).toBeVisible();
    await expect(
      page.getByText(
        "Non riusciamo a caricare questo giorno. Controlla la connessione e riprova.",
      ),
    ).toBeVisible();
    await shootDay(page, "offline-giorno-nuovo.png");

    // Back to Sunday, already read: the events stay, with the notice.
    await page.getByRole("button", { name: "Giorno precedente" }).click();
    await expect(dayHeading(page, "2026-10-25")).toBeVisible();
    await expect(
      page.getByRole("alert").filter({
        hasText:
          "Non riusciamo ad aggiornare il calendario. Vedi gli impegni salvati alle 15:52.",
      }),
    ).toBeVisible();
    await expect(page.getByText("Pranzo dai nonni").first()).toBeVisible();
    await shootDay(page, "offline-impegni-salvati.png");
  });
});

// --- six or more people: only the view scrolls, never the page ---------------

const SEVEN_DAY: EventSpec[] = [
  {
    who: "Marco",
    title: "Riunione di team",
    day: TUE,
    from: "10:00",
    to: "11:00",
  },
  {
    who: "Laura",
    title: "Yoga",
    day: TUE,
    from: "13:00",
    to: "14:30",
    location: "Studio Respiro",
  },
  {
    who: "Marco",
    title: "Nuoto Sofia",
    day: TUE,
    from: "17:00",
    to: "18:30",
    participants: ["Sofia"],
  },
  {
    who: "Marco",
    title: "Calcio Pietro",
    day: TUE,
    from: "17:00",
    to: "18:00",
    participants: ["Pietro"],
  },
  {
    who: "Marco",
    title: "Cena dai nonni",
    day: TUE,
    from: "19:30",
    to: "21:30",
    participants: [
      "Marco",
      "Laura",
      "Anna",
      "Sofia",
      "Tommaso",
      "Giada",
      "Pietro",
    ],
    location: "Monza",
  },
];

test("sette persone: scorre solo la vista", async ({ page, baseURL }) => {
  await withDayNest(SEVEN, SEVEN_DAY, async (nest) => {
    await openDay(page, baseURL, nest, { lens: "nest" });
    await waitForDayData(page);
    await expect(page.getByTestId("testa-colonna")).toHaveCount(7);
    const view = dayView(page);
    const viewport = page.viewportSize()!;

    // The page never scrolls sideways, on a phone and on a desktop.
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(viewport.width);

    if (isMobile(page)) {
      // Each column is at least 70 px wide and the view scrolls by itself.
      const widths = await page
        .getByTestId("testa-colonna")
        .evaluateAll((nodes) =>
          nodes.map((n) => n.getBoundingClientRect().width),
        );
      for (const width of widths) expect(width).toBeGreaterThanOrEqual(70);
      const sizes = await view.evaluate((el) => ({
        scroll: el.scrollWidth,
        client: el.clientWidth,
      }));
      expect(sizes.scroll).toBeGreaterThan(sizes.client);
      await shootDay(page, "sette-persone.png");

      // Sideways: the hours stay at the left, the page stays still.
      await view.evaluate((el) => {
        el.scrollLeft = 200;
      });
      await expect
        .poll(() => view.evaluate((el) => el.scrollLeft))
        .toBeGreaterThan(0);
      expect(await page.evaluate(() => window.scrollX)).toBe(0);
      const hours = await boxIn(
        page.locator(".colonna-ore"),
        page.locator(".area-orari"),
      );
      const viewBox = (await view.boundingBox())!;
      expect(hours.left).toBeLessThanOrEqual(viewBox.x + 4);

      // The hours stay under the heads of the columns: no label is drawn over
      // the (blank) head of the hours column (specification §10.5: fixed hours
      // and blank space above them, background «carta»).
      const bleeding = await page.evaluate(() => {
        const head = document
          .querySelector(".vista-giorno .giorno-persone__testa")!
          .getBoundingClientRect();
        const bad: string[] = [];
        for (const label of document.querySelectorAll(".colonna-ore__ora")) {
          const r = label.getBoundingClientRect();
          const x = r.left + r.width / 2;
          const y = r.top + r.height / 2;
          if (y < head.top || y > head.bottom) continue;
          const hit = document.elementFromPoint(x, y);
          if (hit && hit.closest(".colonna-ore")) bad.push(label.textContent!);
        }
        return bad;
      });
      expect(bleeding, "ore disegnate sopra la testa delle colonne").toEqual(
        [],
      );
      await shootDay(page, "sette-persone-scorsa.png");
    } else {
      // All the columns side by side: nothing to scroll sideways.
      const sizes = await view.evaluate((el) => ({
        scroll: el.scrollWidth,
        client: el.clientWidth,
      }));
      expect(sizes.scroll).toBeLessThanOrEqual(sizes.client + 1);
      await shootDay(page, "sette-persone.png");
    }
  });
});

test("dieci persone: nessuno scorrimento della pagina", async ({
  page,
  baseURL,
}) => {
  await withDayNest(TEN, SEVEN_DAY.slice(0, 1), async (nest) => {
    await openDay(page, baseURL, nest, { lens: "nest" });
    await waitForDayData(page);
    await expect(page.getByTestId("testa-colonna")).toHaveCount(10);
    const viewport = page.viewportSize()!;
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(viewport.width);
    const heads = await page.getByTestId("testa-colonna").evaluateAll((nodes) =>
      nodes.map((n) => {
        const r = n.getBoundingClientRect();
        return { left: r.left, right: r.right, width: r.width };
      }),
    );
    if (isMobile(page)) {
      for (const head of heads) expect(head.width).toBeGreaterThanOrEqual(70);
    } else {
      // On a desktop all ten heads are inside the window.
      for (const head of heads) {
        expect(head.left).toBeGreaterThanOrEqual(0);
        expect(head.right).toBeLessThanOrEqual(viewport.width);
      }
    }
    await shootDay(page, "dieci-persone.png");
  });
});
