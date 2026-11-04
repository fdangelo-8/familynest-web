import { createEvent } from "../fixtures/calendario";
import {
  BIANCHI,
  buildNest,
  romeInstant,
  type MemberSpec,
} from "../fixtures/casa";
import {
  alerts,
  boxOf,
  busyLoading,
  cell,
  cells,
  current,
  dayHead,
  dayHeading,
  dayInfo,
  daySection,
  dots,
  expect,
  expectAccessibleMese,
  failReads,
  FRI,
  grid,
  h1,
  holdReads,
  hydrated,
  isMobileProject,
  LOAD_FAILED,
  monthPath,
  monthReady,
  next,
  NOV1,
  OFFLINE_ALERT,
  open,
  openMonth,
  prev,
  retry,
  row,
  rows,
  selected,
  skeletons,
  status,
  test,
  todayLink,
  TUE,
  viewGroup,
  reopen,
  type CasaNest,
} from "../fixtures/mese";

// Calendario · Mese (#27), part 4: loading, errors, offline, the clock, the
// link «Oggi», the loading of a new month, accessibility. See
// calendario-mese.spec.ts for the setting.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

// ---------------------------------------------------------------- loading

test.describe("caricamento ed errori", () => {
  test("CA-28: all'apertura, mentre legge, ci sono i selettori e il caricamento ma non la griglia", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    const held = await holdReads(page);
    await open(page, baseURL, bianchi, { settle: false });
    await expect(h1(page)).toHaveText("Ottobre 2026");
    await expect(prev(page)).toBeVisible();
    await expect(next(page)).toBeVisible();
    await expect(viewGroup(page)).toBeVisible();
    await expect(busyLoading(page).first()).toBeAttached();
    await expect(grid(page)).toHaveCount(0);
    held.release();
    await expect(grid(page)).toBeVisible();
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  });

  test("CA-29: se la prima lettura fallisce c'è l'errore di pagina con «Riprova»", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    const reads = await failReads(page);
    await open(page, baseURL, bianchi, { settle: false });
    await expect(retry(page)).toBeVisible();
    const text = (await page.locator("body").textContent()) ?? "";
    for (const detail of ["fake failure", "XX000", "PGRST", "Error:"]) {
      expect(text, `dettaglio tecnico: ${detail}`).not.toContain(detail);
    }
    reads.recover();
    await retry(page).click();
    await expect(grid(page)).toBeVisible();
    await expect(h1(page)).toHaveText("Ottobre 2026");
  });

  /** Page loaded with «Riunione di team», then the network goes away. */
  async function loadedWithMeeting(
    page: import("@playwright/test").Page,
    baseURL: string | undefined,
    bianchi: CasaNest,
  ) {
    await createEvent(bianchi, "Giulia", {
      title: "Riunione di team",
      day: TUE,
      from: "17:00",
      to: "18:00",
    });
    await openMonth(page, baseURL, bianchi, { pause: false });
    await expect(row(page, "Riunione di team")).toBeVisible();
    await hydrated(page);
  }

  test("CA-30: offline, un mese nuovo dà l'avviso con la griglia vuota; il mese letto resta con l'altro avviso", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    try {
      await loadedWithMeeting(page, baseURL, bianchi);
      await page.context().setOffline(true);
      await next(page).click();
      await expect(h1(page)).toHaveText("Novembre 2026");
      const failed = alerts(page).filter({ hasText: LOAD_FAILED });
      await expect(failed).toBeVisible();
      await expect(
        failed.getByRole("button", { name: "Riprova" }),
      ).toBeVisible();
      await expect(grid(page)).toBeVisible();
      await expect(cells(page)).toHaveCount(42);
      await expect(dots(grid(page))).toHaveCount(0);
      await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
      await expect(dayHeading(page)).toHaveText("Domenica 1");
      await expect(dayInfo(page)).toContainText("Ognissanti");
      await expect(rows(page)).toHaveCount(0);
      await expect(skeletons(page)).toHaveCount(0);

      await prev(page).click();
      await expect(h1(page)).toHaveText("Ottobre 2026");
      await expect(row(page, "Riunione di team")).toBeVisible();
      await expect(dots(cell(page, TUE))).toHaveCount(1);
      await expect(dots(cell(page, TUE))).toHaveAttribute(
        "data-membro",
        bianchi.members["Giulia"]!,
      );
      const stale = alerts(page).filter({ hasText: OFFLINE_ALERT });
      await expect(stale).toBeVisible();
      await expect(stale).toContainText(/alle \d{1,2}:\d{2}/);
      await expect(
        stale.getByRole("button", { name: "Riprova" }),
      ).toBeVisible();
    } finally {
      await page.context().setOffline(false);
    }
    await expect(alerts(page).filter({ hasText: OFFLINE_ALERT })).toHaveCount(
      0,
      { timeout: 5000 },
    );
  });

  test("CA-31: a mezzanotte «oggi» passa al giorno dopo, il giorno scelto resta", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await openMonth(page, baseURL, bianchi, {
      now: romeInstant(TUE, 23, 59),
    });
    await expect(current(page)).toHaveAccessibleName(
      /^20, martedì 20 ottobre, oggi/,
    );
    await page.clock.runFor(120_000);
    await expect(current(page)).toHaveCount(1);
    await expect(current(page)).toHaveAccessibleName(
      /^21, mercoledì 21 ottobre, oggi/,
    );
    await expect(cell(page, TUE)).not.toHaveAttribute("aria-current", "date");
    await expect(cell(page, TUE)).not.toHaveAccessibleName(/oggi/);
    await expect(selected(page)).toHaveAccessibleName(
      /^20, martedì 20 ottobre/,
    );
    await expect(dayHeading(page)).toHaveText("Martedì 20");
    await expect(dayHead(page)).not.toContainText("oggi");
  });
});

// ------------------------------------------------------------ link «Oggi»

test.describe("link «Oggi» (proposta 1)", () => {
  test("CA-36: da un altro mese c'è «Oggi», dopo «Mese successivo», e riporta al mese di oggi", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await openMonth(page, baseURL, bianchi, { month: "2026-12" });
    await hydrated(page);
    await expect(todayLink(page)).toBeVisible();
    await expect(todayLink(page)).toHaveAttribute("href", "/calendario/mese");
    await next(page).focus();
    await page.keyboard.press("Tab");
    await expect(todayLink(page)).toBeFocused();

    await todayLink(page).click();
    await expect(h1(page)).toHaveText("Ottobre 2026");
    await expect(page).toHaveURL(/\/calendario\/mese$/);
    await expect(todayLink(page)).toHaveCount(0);
    await expect(h1(page)).toBeFocused();
    await expect(selected(page)).toHaveAccessibleName(
      /^20, martedì 20 ottobre/,
    );
  });

  test("CA-36: nel mese di oggi il link non c'è", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await openMonth(page, baseURL, bianchi);
    await expect(todayLink(page)).toHaveCount(0);
  });

  test("CA-36: tornando al mese di oggi con la freccia il link sparisce e il fuoco resta sulla freccia", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await openMonth(page, baseURL, bianchi, { month: "2026-11" });
    await hydrated(page);
    await expect(todayLink(page)).toBeVisible();
    await prev(page).click();
    await expect(h1(page)).toHaveText("Ottobre 2026");
    await expect(todayLink(page)).toHaveCount(0);
    await expect(prev(page)).toBeFocused();
  });

  test("CA-36: la posizione del link, senza scorrimento orizzontale", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await openMonth(page, baseURL, bianchi, { month: "2026-11" });
    const arrow = await boxOf(next(page));
    const link = await boxOf(todayLink(page));
    if (isMobileProject()) {
      expect(link.y).toBeGreaterThanOrEqual(arrow.y + arrow.height - 4);
      expect(
        Math.abs(link.x + link.width - (arrow.x + arrow.width)),
      ).toBeLessThanOrEqual(4);
    } else {
      expect(
        Math.abs(link.y + link.height / 2 - (arrow.y + arrow.height / 2)),
      ).toBeLessThanOrEqual(4);
      expect(link.x).toBeGreaterThanOrEqual(arrow.x + arrow.width);
    }

    // The longest title, on one line, with no horizontal scroll.
    await reopen(page, monthPath("2026-09"));
    await monthReady(page);
    await expect(h1(page)).toHaveText("Settembre 2026");
    const oneLine = await h1(page).evaluate((el) => {
      const style = getComputedStyle(el);
      const line =
        parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.3;
      return el.getBoundingClientRect().height <= line * 1.5;
    });
    expect(oneLine, "l'h1 sta su una riga").toBe(true);
    const width = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      view: window.innerWidth,
    }));
    expect(width.scroll).toBeLessThanOrEqual(width.view);
  });
});

// ------------------------------------------- a month that is being loaded

test.describe("cambio di mese in caricamento (proposta 2)", () => {
  test("CA-37: la griglia di novembre resta visibile, senza punti, e poi arrivano i dati", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await createEvent(bianchi, "Giulia", {
      title: "Messa del mattino",
      day: NOV1,
      from: "10:00",
      to: "11:00",
    });
    await openMonth(page, baseURL, bianchi, { pause: false });
    await hydrated(page);
    // Only the reading of the next month is held: the page is already loaded.
    const held = await holdReads(page);
    await next(page).click();
    await expect(h1(page)).toHaveText("Novembre 2026");
    await expect(grid(page)).toBeVisible();
    await expect(cells(page)).toHaveCount(42);
    await expect(selected(page)).toHaveAccessibleName(
      "1, domenica 1 novembre, Ognissanti",
    );
    await expect(dots(grid(page))).toHaveCount(0);
    await expect(busyLoading(page).first()).toBeAttached();
    await expect(dayHeading(page)).toHaveText("Domenica 1");
    await expect(dayInfo(page)).toHaveText("Ognissanti");
    await expect(skeletons(page).first()).toBeAttached();

    held.release();
    await expect(selected(page)).toHaveAccessibleName(
      "1, domenica 1 novembre, Ognissanti, 1 impegno: tu",
    );
    await expect(dots(cell(page, NOV1))).toHaveCount(1);
    await expect(dayInfo(page)).toHaveText("Ognissanti · 1 impegno");
    await expect(row(page, "Messa del mattino")).toBeVisible();
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
    await expect(status(page)).toContainText("Novembre 2026");
  });
});

// ---------------------------------------------------------- accessibility

// axe waits on timers: with the clock stopped it never answers, so these
// tests leave the clock running (`pause: false`).
test.describe("accessibilità", () => {
  async function withEvents(bianchi: CasaNest) {
    await createEvent(bianchi, "Giulia", {
      title: "Allenamento",
      day: TUE,
      from: "17:00",
      to: "18:00",
      participants: ["Giulia", "Leo"],
    });
    await createEvent(bianchi, "Paolo", {
      title: "Riunione segreta",
      day: FRI,
      from: "9:00",
      to: "15:00",
      visibility: "busy",
    });
  }

  test("CA-35: stato normale con la lente «Io»", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await withEvents(bianchi);
    await openMonth(page, baseURL, bianchi, { lens: "io", pause: false });
    await expect(row(page, "Allenamento")).toBeVisible();
    await expectAccessibleMese(page);
  });

  test("CA-35: stato normale con la lente «Nest»", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await withEvents(bianchi);
    await openMonth(page, baseURL, bianchi, { lens: "nest", pause: false });
    await expect(dots(cell(page, FRI))).toHaveCount(1);
    await expectAccessibleMese(page);
  });

  test("CA-35: con il punto grigio «e altri»", async ({ page, baseURL }) => {
    const kids = ["Bea", "Carlo", "Dario", "Elisa", "Fabio", "Gina"];
    const specs: MemberSpec[] = [
      ...BIANCHI,
      ...kids.map((name): MemberSpec => ({
        name,
        kind: "child",
        color: "salvia",
      })),
    ];
    const { nest, cleanup } = await buildNest("Casa Bianchi", specs);
    try {
      await createEvent(nest, "Giulia", {
        title: "Festa di tutti",
        day: FRI,
        from: "10:00",
        to: "11:00",
        participants: ["Giulia", "Paolo", "Anna", "Leo", ...kids],
      });
      await openMonth(page, baseURL, nest, { lens: "nest", pause: false });
      await expect(dots(cell(page, FRI))).toHaveCount(10);
      await expectAccessibleMese(page);
    } finally {
      await cleanup();
    }
  });

  test("CA-35: stato vuoto", async ({ page, baseURL, bianchi }) => {
    await openMonth(page, baseURL, bianchi, { pause: false });
    await expect(
      daySection(page).getByText("Niente in programma"),
    ).toBeVisible();
    await expectAccessibleMese(page);
  });

  test("CA-35: caricamento all'apertura", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await withEvents(bianchi);
    const held = await holdReads(page);
    try {
      await open(page, baseURL, bianchi, { settle: false, pause: false });
      await expect(busyLoading(page).first()).toBeAttached();
      await expectAccessibleMese(page);
    } finally {
      held.release();
    }
  });

  test("CA-35: cambio di mese in caricamento", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await withEvents(bianchi);
    await openMonth(page, baseURL, bianchi, { pause: false });
    await hydrated(page);
    const held = await holdReads(page);
    try {
      await next(page).click();
      await expect(h1(page)).toHaveText("Novembre 2026");
      await expect(grid(page)).toBeVisible();
      await expect(busyLoading(page).first()).toBeAttached();
      await expectAccessibleMese(page);
    } finally {
      held.release();
    }
  });

  test("CA-35: un altro mese con il link «Oggi»", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await withEvents(bianchi);
    await openMonth(page, baseURL, bianchi, {
      month: "2026-11",
      pause: false,
    });
    await expect(todayLink(page)).toBeVisible();
    await expectAccessibleMese(page);
  });

  test("CA-35: errore di pagina", async ({ page, baseURL, bianchi }) => {
    await failReads(page);
    await open(page, baseURL, bianchi, { settle: false, pause: false });
    await expect(retry(page)).toBeVisible();
    await expectAccessibleMese(page);
  });

  test("CA-35: avviso offline", async ({ page, baseURL, bianchi }) => {
    await withEvents(bianchi);
    await openMonth(page, baseURL, bianchi, { pause: false });
    await hydrated(page);
    try {
      await page.context().setOffline(true);
      await next(page).click();
      await expect(h1(page)).toHaveText("Novembre 2026");
      await expect(prev(page)).toBeVisible();
      await prev(page).click();
      await expect(h1(page)).toHaveText("Ottobre 2026");
      await expect(
        alerts(page).filter({ hasText: OFFLINE_ALERT }),
      ).toBeVisible();
      await expectAccessibleMese(page);
    } finally {
      await page.context().setOffline(false);
    }
  });
});
