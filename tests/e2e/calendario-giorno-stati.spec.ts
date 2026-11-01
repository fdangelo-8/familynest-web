import { createEvent, watchNetwork } from "../fixtures/calendario";
import { buildNest, type MemberSpec } from "../fixtures/casa";
import {
  alerts,
  axeProblems,
  blocks,
  boxOf,
  busyBlocks,
  busyLoading,
  chooseLens,
  columnsOf,
  dayPath,
  dayTitle,
  expect,
  expectAccessible,
  failReads,
  freeBlocks,
  h1,
  head,
  heads,
  holdReads,
  hydrated,
  isMobileProject,
  near,
  nextDay,
  noDuplicateIds,
  nowLine,
  OFFLINE_ALERT,
  only,
  open,
  panel,
  PATH,
  previousDay,
  region,
  reopen,
  retry,
  test,
  TUE,
  SUN,
  WED,
  allBlocks,
  MON,
  type CasaNest,
} from "../fixtures/giorno";

// Calendario · Giorno «chi è dove» (#26), part 3: free evenings, now line and
// scrolling, states, time zone, isolation, accessibility. See
// calendario-giorno.spec.ts for the premises.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

const MON26 = "2026-10-26";

// ------------------------------------------------------------ free evenings

test.describe("liberi insieme", () => {
  async function evening(bianchi: CasaNest) {
    await createEvent(bianchi, "Giulia", {
      title: "Cena di famiglia",
      day: TUE,
      from: "18:00",
      to: "20:00",
      participants: ["Giulia", "Paolo", "Anna"],
    });
  }

  test("CA-26: «Liberi insieme» è un blocco solo sugli adulti, non è un link", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await evening(bianchi);
    await open(page, baseURL, bianchi, { lens: "nest" });
    await expect(blocks(page, "Cena di famiglia").first()).toBeVisible();
    const free = freeBlocks(page);
    await expect(free).toHaveCount(1);
    await expect(free).toContainText("Liberi insieme");
    await expect(free).toContainText("20:00 – 23:00");
    const box = await boxOf(free);
    const you = await boxOf(head(page, "Tu"));
    const anna = await boxOf(head(page, "Anna"));
    near(box.x, you.x, 4);
    near(box.x + box.width, anna.x + anna.width, 4);
    expect(
      await free.evaluate(
        (el) =>
          el.closest("a, button") === null &&
          el.querySelector("a, button") === null,
      ),
      "non è un link",
    ).toBe(true);

    await chooseLens(page, "Io");
    await expect(free).toHaveCount(1);
    expect(await columnsOf(page, free)).toEqual(["Tu"]);
  });

  only(
    "desktop",
    "CA-27: le serate libere portano al loro giorno, tranne quella già mostrata",
    async ({ page, baseURL, bianchi }) => {
      await evening(bianchi);
      // Wednesday needs a visible event of its own: an empty day shows the
      // «Giornata libera» state with an empty panel (requirement §8), so the
      // row of Tuesday could not be checked after the click.
      await createEvent(bianchi, "Giulia", {
        title: "Palestra",
        day: WED,
        from: "9:00",
        to: "10:00",
      });
      await open(page, baseURL, bianchi);
      const section = panel(page, "Serate libere insieme");
      await expect(section).toContainText("7 questa settimana");
      const row = (head: string) =>
        section.getByRole("listitem").filter({ hasText: head });
      await expect(row("Martedì 20")).toContainText(
        "Dalle 20:00 a fine serata",
      );
      await expect(row("Martedì 20").getByRole("link")).toHaveCount(0);
      await expect(row("Mercoledì 21")).toContainText(
        "Tutta la sera, dalle 18:00",
      );
      await expect(row("Mercoledì 21").getByRole("link")).toHaveAttribute(
        "href",
        "/calendario/giorno?giorno=2026-10-21",
      );

      await hydrated(page);
      await row("Mercoledì 21").getByRole("link").click();
      await expect(h1(page)).toHaveText("Mercoledì 21 ottobre");
      await expect(page).toHaveURL(/\/calendario\/giorno\?giorno=2026-10-21$/);
      await expect(row("Mercoledì 21").getByRole("link")).toHaveCount(0);
      await expect(row("Martedì 20").getByRole("link")).toHaveCount(1);
    },
  );

  test("CA-28: in un Nest con un solo adulto non c'è «Liberi insieme»", async ({
    page,
    baseURL,
  }) => {
    const specs: MemberSpec[] = [
      { name: "Chiara", kind: "adult", color: "pomodoro", account: true },
    ];
    const { nest, cleanup } = await buildNest("Solo io", specs);
    try {
      await createEvent(nest, "Chiara", {
        title: "Studio",
        day: TUE,
        from: "9:00",
        to: "10:00",
      });
      await open(page, baseURL, nest, { who: "Chiara", lens: "nest" });
      await expect(blocks(page, "Studio").first()).toBeVisible();
      await expect(freeBlocks(page)).toHaveCount(0);
      await expect(page.getByText("Liberi insieme")).toHaveCount(0);
      if (!isMobileProject()) {
        await expect(
          page.getByRole("heading", { name: "Serate libere insieme" }),
        ).toHaveCount(0);
      }
    } finally {
      await cleanup();
    }
  });

  test("CA-38: gli impegni di un altro Nest non tolgono la serata libera", async ({
    page,
    baseURL,
    bianchi,
    casa,
  }) => {
    await createEvent(casa, "Marco", {
      title: "Cena fuori",
      day: TUE,
      from: "18:00",
      to: "23:00",
      participants: ["Marco", "Laura"],
    });
    await createEvent(bianchi, "Giulia", {
      title: "Riunione di team",
      day: TUE,
      from: "10:00",
      to: "11:00",
    });
    await open(page, baseURL, bianchi);
    await expect(blocks(page, "Riunione di team").first()).toBeVisible();
    await expect(freeBlocks(page)).toHaveCount(1);
    await expect(freeBlocks(page)).toContainText("18:00 – 23:00");
  });
});

// ------------------------------------------------------- now line, scrolling

test.describe("adesso e scorrimento", () => {
  const grid = (page: import("@playwright/test").Page) =>
    page.locator(".area-orari");
  const lineTop = async (page: import("@playwright/test").Page) =>
    (await boxOf(nowLine(page))).y - (await boxOf(grid(page))).y;

  test("CA-29: la linea di adesso segue l'ora e c'è solo oggi tra le 8:00 e le 23:00", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    for (const day of [TUE, WED]) {
      await createEvent(bianchi, "Giulia", {
        title: "Riunione di team",
        day,
        from: "10:00",
        to: "11:00",
      });
    }
    await open(page, baseURL, bianchi);
    await expect(nowLine(page)).toBeVisible();
    near(await lineTop(page), 393, 2);
    await page.clock.runFor(1_800_000);
    await expect
      .poll(async () => Math.round(await lineTop(page)))
      .toBeGreaterThanOrEqual(416);
    near(await lineTop(page), 418, 2);

    await reopen(page, dayPath(WED));
    await expect(blocks(page, "Riunione di team").first()).toBeVisible();
    await expect(nowLine(page)).toHaveCount(0);
  });

  test("CA-29: alle 23:30 la linea di adesso non c'è", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await createEvent(bianchi, "Giulia", {
      title: "Riunione di team",
      day: TUE,
      from: "10:00",
      to: "11:00",
    });
    await open(page, baseURL, bianchi, {
      now: new Date("2026-10-20T21:30:00Z"),
    });
    await expect(blocks(page, "Riunione di team").first()).toBeVisible();
    await expect(nowLine(page)).toHaveCount(0);
  });

  const scrolled = (page: import("@playwright/test").Page) =>
    region(page).evaluate((el) => el.scrollTop);

  only(
    "mobile",
    "CA-30: oggi la vista parte un'ora prima di adesso, gli altri giorni dall'inizio",
    async ({ page, baseURL, bianchi }) => {
      for (const day of [TUE, WED]) {
        await createEvent(bianchi, "Giulia", {
          title: "Riunione di team",
          day,
          from: "10:00",
          to: "11:00",
        });
      }
      await open(page, baseURL, bianchi);
      await expect(blocks(page, "Riunione di team").first()).toBeVisible();
      await expect.poll(() => scrolled(page)).toBeGreaterThan(0);
      const view = await boxOf(region(page));
      const line = await boxOf(nowLine(page));
      expect(line.y).toBeGreaterThanOrEqual(view.y);
      expect(line.y + line.height).toBeLessThanOrEqual(view.y + view.height);

      await reopen(page, dayPath(WED));
      await expect(blocks(page, "Riunione di team").first()).toBeVisible();
      expect(await scrolled(page)).toBe(0);
    },
  );

  only(
    "mobile",
    "CA-30: alle 8:20 la vista parte dall'inizio",
    async ({ page, baseURL, bianchi }) => {
      await createEvent(bianchi, "Giulia", {
        title: "Riunione di team",
        day: TUE,
        from: "10:00",
        to: "11:00",
      });
      await open(page, baseURL, bianchi, {
        now: new Date("2026-10-20T06:20:00Z"),
      });
      await expect(blocks(page, "Riunione di team").first()).toBeVisible();
      await expect(nowLine(page)).toBeVisible();
      expect(await scrolled(page)).toBe(0);
    },
  );
});

// ------------------------------------------------------------------- states

test.describe("stati", () => {
  test("CA-31: senza impegni c'è «Giornata libera», con ogni lente", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await open(page, baseURL, bianchi, { lens: "io" });
    for (const lens of ["Io", "Nest"] as const) {
      await chooseLens(page, lens);
      await expect(page.getByText("Giornata libera")).toBeVisible();
      await expect(page.getByText(/Nessuno ha impegni oggi\./)).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Aggiungi qualcosa" }),
      ).toHaveAttribute("href", "/aggiungi");
      await expect(heads(page)).toHaveCount(0);
      await expect(head(page, "Tu")).toHaveCount(0);
      await expect(freeBlocks(page)).toHaveCount(0);
      await expect(nowLine(page)).toHaveCount(0);
      if (!isMobileProject()) {
        await expect(
          page.getByRole("heading", { name: "Impegno", exact: true }),
        ).toHaveCount(0);
        await expect(
          page.getByRole("heading", { name: "Serate libere insieme" }),
        ).toHaveCount(0);
      }
    }
    await reopen(page, dayPath(WED));
    await expect(page.getByText("Giornata libera")).toBeVisible();
    await expect(page.getByText(/Nessuno ha impegni domani\./)).toBeVisible();
  });

  test("CA-32: se solo io non ho impegni c'è la colonna «Tu» vuota, non «Giornata libera»", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await createEvent(bianchi, "Paolo", {
      title: "Piscina",
      day: TUE,
      from: "17:00",
      to: "18:00",
      participants: ["Paolo", "Leo"],
    });
    await open(page, baseURL, bianchi, { lens: "io" });
    await expect(region(page)).toBeVisible();
    await expect(page.getByText("Giornata libera")).toHaveCount(0);
    await expect(head(page, "Tu")).toHaveCount(1);
    await expect(allBlocks(page)).toHaveCount(0);
    await expect(busyBlocks(page)).toHaveCount(0);
  });

  test("CA-33: mentre legge gli impegni mostra il titolo e il caricamento", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await createEvent(bianchi, "Giulia", {
      title: "Riunione di team",
      day: TUE,
      from: "10:00",
      to: "11:00",
    });
    const held = await holdReads(page);
    try {
      await open(page, baseURL, bianchi, { settle: false });
      await expect(h1(page)).toHaveText(dayTitle(TUE));
      await expect(busyLoading(page).first()).toBeVisible();
    } finally {
      held.release();
    }
    await expect(blocks(page, "Riunione di team").first()).toBeVisible();
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  });

  test("CA-34: se la prima lettura fallisce c'è l'errore con «Riprova»", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await createEvent(bianchi, "Giulia", {
      title: "Riunione di team",
      day: TUE,
      from: "10:00",
      to: "11:00",
    });
    const reads = await failReads(page);
    await open(page, baseURL, bianchi, { settle: false });
    await expect(retry(page)).toBeVisible();
    const text = (await page.locator("body").textContent()) ?? "";
    for (const detail of ["fake failure", "XX000", "PGRST", "Error:"]) {
      expect(text, `dettaglio tecnico: ${detail}`).not.toContain(detail);
    }
    reads.recover();
    await retry(page).click();
    await expect(blocks(page, "Riunione di team").first()).toBeVisible();
    await expect(h1(page)).toHaveText(dayTitle(TUE));
  });

  /** Page with «Riunione di team» read, then the network goes away (CA-35). */
  async function goOffline(
    page: import("@playwright/test").Page,
    baseURL: string | undefined,
    bianchi: CasaNest,
  ) {
    await createEvent(bianchi, "Giulia", {
      title: "Riunione di team",
      day: SUN,
      from: "10:00",
      to: "11:00",
    });
    await open(page, baseURL, bianchi, {
      path: dayPath(SUN),
      pause: false,
    });
    await expect(blocks(page, "Riunione di team").first()).toBeVisible();
    await hydrated(page);
    await page.context().setOffline(true);
    // Monday 26 is in another week, never read: the read fails offline.
    await nextDay(page).click();
    await expect(h1(page)).toHaveText(dayTitle(MON26));
    await previousDay(page).click();
    await expect(h1(page)).toHaveText(dayTitle(SUN));
  }

  test("CA-35: offline restano gli impegni già letti con l'avviso, poi torna tutto", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    try {
      await goOffline(page, baseURL, bianchi);
      await expect(blocks(page, "Riunione di team").first()).toBeVisible();
      const alert = alerts(page).filter({ hasText: OFFLINE_ALERT });
      await expect(alert).toBeVisible();
      await expect(alert).toContainText(/alle \d{1,2}:\d{2}/);
      await expect(
        alert.getByRole("button", { name: "Riprova" }),
      ).toBeVisible();
    } finally {
      await page.context().setOffline(false);
    }
    await expect(alerts(page).filter({ hasText: OFFLINE_ALERT })).toHaveCount(
      0,
      {
        timeout: 5000,
      },
    );
  });

  // ------------------------------------------------------------- time zone

  test.describe("fuso orario", () => {
    test.use({ timezoneId: "America/New_York" });

    test("CA-36: con il browser a New York l'impegno resta all'ora di Roma", async ({
      page,
      baseURL,
      bianchi,
    }) => {
      await createEvent(bianchi, "Giulia", {
        title: "Cena del cambio ora",
        day: "2026-10-25",
        from: "20:00",
        to: "21:00",
      });
      await open(page, baseURL, bianchi, { path: dayPath("2026-10-25") });
      const block = blocks(page, "Cena del cambio ora");
      await expect(block).toHaveCount(1);
      await expect(block).toContainText("20:00 – 21:00");
      const area = await boxOf(page.locator(".area-orari"));
      near((await boxOf(block)).y - area.y, 600, 4);
    });
  });
});

// ---------------------------------------------------------------- isolation

test.describe("isolamento tra Nest", () => {
  const FORBIDDEN = [
    "Cena dai nonni",
    "Marco",
    "Laura",
    "Sofia",
    "Tommaso",
    "Biscotto",
  ];

  test("CA-37: gli impegni di un altro Nest non arrivano, con nessuna lente", async ({
    page,
    baseURL,
    bianchi,
    casa,
  }) => {
    await createEvent(casa, "Marco", {
      title: "Cena dai nonni",
      day: TUE,
      from: "19:00",
      to: "21:00",
    });
    await createEvent(casa, "Marco", {
      title: "Impegno riservato",
      day: TUE,
      from: "9:00",
      to: "12:00",
      visibility: "busy",
    });
    await createEvent(bianchi, "Giulia", {
      title: "Spesa grande",
      day: MON,
      from: "10:00",
      to: "11:00",
    });
    const net = watchNetwork(page);
    await open(page, baseURL, bianchi, { lens: "io" });
    // Nothing of Casa Bianchi on Tuesday: the day is free.
    await expect(page.getByText("Giornata libera")).toBeVisible();

    const check = async () => {
      const dom = await page.content();
      const bodies = await net.bodies();
      for (const text of FORBIDDEN) {
        expect(dom, `DOM: ${text}`).not.toContain(text);
        expect(bodies, `rete: ${text}`).not.toContain(text);
      }
      await expect(busyBlocks(page)).toHaveCount(0);
      await expect(page.getByText("Giornata libera")).toBeVisible();
    };
    await check();
    await chooseLens(page, "Nest");
    await check();
    const html = await (await page.request.get(PATH)).text();
    for (const text of FORBIDDEN)
      expect(html, `HTML: ${text}`).not.toContain(text);
  });
});

// ------------------------------------------------------------ accessibility

// axe waits on timers: with the clock stopped it never answers, so these
// tests leave the clock running.
test.describe("accessibilità", () => {
  async function withEvents(bianchi: CasaNest) {
    await createEvent(bianchi, "Giulia", {
      title: "Riunione di team",
      day: TUE,
      from: "10:00",
      to: "11:00",
    });
    await createEvent(bianchi, "Giulia", {
      title: "Cena dai nonni",
      day: TUE,
      from: "19:30",
      to: "21:30",
      participants: ["Giulia", "Paolo"],
    });
    await createEvent(bianchi, "Paolo", {
      title: "Riunione segreta",
      day: TUE,
      from: "9:00",
      to: "15:00",
      visibility: "busy",
    });
  }

  test("CA-39: stato normale con la lente «Io»", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await withEvents(bianchi);
    await open(page, baseURL, bianchi, { lens: "io", pause: false });
    await expect(blocks(page, "Riunione di team").first()).toBeVisible();
    await expectAccessible(page);
  });

  test("CA-39: stato normale con la lente «Nest»", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await withEvents(bianchi);
    await open(page, baseURL, bianchi, { lens: "nest", pause: false });
    await expect(busyBlocks(page)).toHaveCount(1);
    await expectAccessible(page);
  });

  test("CA-39: stato vuoto", async ({ page, baseURL, bianchi }) => {
    await open(page, baseURL, bianchi, { pause: false });
    await expect(page.getByText("Giornata libera")).toBeVisible();
    await expectAccessible(page);
  });

  test("CA-39: stato di caricamento", async ({ page, baseURL, bianchi }) => {
    await withEvents(bianchi);
    const held = await holdReads(page);
    try {
      await open(page, baseURL, bianchi, { settle: false, pause: false });
      await expect(busyLoading(page).first()).toBeVisible();
      expect(await axeProblems(page)).toEqual([]);
      expect(await noDuplicateIds(page)).toEqual([]);
    } finally {
      held.release();
    }
  });

  test("CA-39: stato di errore offline", async ({ page, baseURL, bianchi }) => {
    await createEvent(bianchi, "Giulia", {
      title: "Riunione di team",
      day: SUN,
      from: "10:00",
      to: "11:00",
    });
    await open(page, baseURL, bianchi, { path: dayPath(SUN), pause: false });
    await expect(blocks(page, "Riunione di team").first()).toBeVisible();
    await hydrated(page);
    try {
      await page.context().setOffline(true);
      await nextDay(page).click();
      await expect(h1(page)).toHaveText(dayTitle(MON26));
      await previousDay(page).click();
      await expect(h1(page)).toHaveText(dayTitle(SUN));
      await expect(
        alerts(page).filter({ hasText: OFFLINE_ALERT }),
      ).toBeVisible();
      await expectAccessible(page);
    } finally {
      await page.context().setOffline(false);
    }
  });
});
