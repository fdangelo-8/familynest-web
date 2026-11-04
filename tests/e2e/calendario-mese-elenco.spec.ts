import { createEvent } from "../fixtures/calendario";
import {
  boxOf,
  cell,
  chooseLens,
  dayHead,
  dayHeading,
  dayInfo,
  daySection,
  dots,
  expect,
  expectDots,
  FRI,
  grid,
  h1,
  hydrated,
  isInert,
  isMobileProject,
  openMonth,
  pageWithout,
  PATH,
  row,
  rows,
  test,
  THU,
  TUE,
  WED,
  type CasaNest,
} from "../fixtures/mese";
import { watchNetwork } from "../fixtures/calendario";

// Calendario · Mese (#27), part 3: the list of the chosen day, the empty
// state, isolation between Nests. See calendario-mese.spec.ts for the setting.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

/** The situation of CA-20: three events on Tuesday 20 October. */
async function threeEvents(nest: CasaNest) {
  await createEvent(nest, "Giulia", {
    title: "Palestra",
    day: TUE,
    from: "13:00",
    to: "14:00",
  });
  await createEvent(nest, "Giulia", {
    title: "Call con Acme",
    day: TUE,
    from: "16:00",
    to: "17:00",
  });
  return createEvent(nest, "Paolo", {
    title: "Cena dai nonni",
    day: TUE,
    from: "19:30",
    to: "21:30",
    participants: ["Paolo", "Anna"],
    location: "Monza",
  });
}

test.describe("elenco del giorno", () => {
  test("CA-20: testa, ordine e contenuto delle righe", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    const dinnerId = await threeEvents(bianchi);
    await openMonth(page, baseURL, bianchi, { lens: "nest" });
    await expect(dayHeading(page)).toHaveText("Martedì 20");
    await expect(dayInfo(page)).toHaveText("oggi · 3 impegni");
    await expect(rows(page)).toHaveCount(4);
    const order = [
      "Palestra",
      "Call con Acme",
      "Liberi insieme",
      "Cena dai nonni",
    ];
    for (const [i, title] of order.entries()) {
      await expect(rows(page).nth(i), `riga ${i + 1}`).toContainText(title);
    }
    await expect(row(page, "Palestra")).toHaveAttribute("data-passato", "true");
    await expect(row(page, "Call con Acme")).not.toHaveAttribute(
      "data-passato",
      "true",
    );

    const dinner = row(page, "Cena dai nonni");
    await expect(dinner).toContainText("19:30");
    await expect(dinner).toContainText("Paolo e Anna, Monza");
    await expect(
      dinner.getByRole("img", { name: "Paolo, Anna" }),
    ).toBeVisible();
    await expect(dinner).toHaveAttribute(
      "href",
      `/impegni/${dinnerId}?giorno=2026-10-20`,
    );

    const free = row(page, "Liberi insieme");
    await expect(free).toContainText("18:00");
    await expect(free).toContainText("Tu, Paolo e Anna, fino alle 19:30");
  });

  test("CA-21: «Liberi insieme» porta alla Settimana di quel giorno", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await threeEvents(bianchi);
    await openMonth(page, baseURL, bianchi, { lens: "nest" });
    await hydrated(page);
    await page.clock.resume();
    await row(page, "Liberi insieme").click();
    await expect(page).toHaveURL(/\/calendario\?settimana=2026-10-19$/);
    await expect(h1(page)).toHaveText("19 – 25 ottobre");
  });

  test("CA-22: «Occupato» di un altro non è un link; il suo autore vede l'impegno", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await createEvent(bianchi, "Paolo", {
      title: "Riunione segreta",
      location: "Ufficio Nord",
      day: TUE,
      from: "9:00",
      to: "15:00",
      visibility: "busy",
    });
    await openMonth(page, baseURL, bianchi, { lens: "nest" });
    const busy = daySection(page).locator(
      '[aria-label="Paolo ha un impegno, dalle 9:00 alle 15:00"]',
    );
    await expect(busy).toHaveCount(1);
    await expect(busy).toContainText("Occupato");
    await expect(busy).toContainText("Paolo");
    expect(await isInert(busy)).toBe(true);
    await expect(dayInfo(page)).toHaveText("oggi · 1 impegno");
    await expect(page.getByText("Riunione segreta")).toHaveCount(0);
    // Tab never lands on the row.
    await cell(page, TUE).focus();
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab");
      const onRow = await busy.evaluate((el) =>
        el.contains(document.activeElement),
      );
      expect(onRow, `Tab numero ${i + 1}`).toBe(false);
    }
  });

  test("CA-22: l'autore dell'«Occupato» lo vede come link al dettaglio", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    const id = await createEvent(bianchi, "Paolo", {
      title: "Riunione segreta",
      day: TUE,
      from: "9:00",
      to: "15:00",
      visibility: "busy",
    });
    await openMonth(page, baseURL, bianchi, { who: "Paolo", lens: "nest" });
    const own = row(page, "Riunione segreta");
    await expect(own).toHaveCount(1);
    await expect(own).toHaveAttribute("href", new RegExp(`^/impegni/${id}`));
  });

  test("CA-23: il mio «Solo io» ha il testo nascosto, per gli altri non esiste", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await createEvent(bianchi, "Giulia", {
      title: "Solo mio",
      day: THU,
      from: "10:00",
      to: "11:00",
      visibility: "private",
    });
    await openMonth(page, baseURL, bianchi);
    await hydrated(page);
    await cell(page, THU).click();
    await expect(dayHeading(page)).toHaveText("Giovedì 22");
    await expect(row(page, "Solo mio")).toContainText("Visibile solo a te");
  });

  test("CA-23: l'altro adulto non vede il «Solo io» né il punto", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await createEvent(bianchi, "Giulia", {
      title: "Solo mio",
      day: THU,
      from: "10:00",
      to: "11:00",
      visibility: "private",
    });
    await openMonth(page, baseURL, bianchi, { who: "Paolo", lens: "nest" });
    await hydrated(page);
    await cell(page, THU).click();
    await expect(dayHeading(page)).toHaveText("Giovedì 22");
    await expect(dots(cell(page, THU))).toHaveCount(0);
    await expect(page.getByText("Solo mio")).toHaveCount(0);
    await expect(
      daySection(page).getByText("Niente in programma"),
    ).toBeVisible();
  });

  test("CA-24: un impegno su due giorni ha l'ora di ogni giorno", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await createEvent(bianchi, "Giulia", {
      title: "Notte fuori",
      day: WED,
      from: "23:00",
      to: "1:00",
      endDay: THU,
    });
    await openMonth(page, baseURL, bianchi);
    await hydrated(page);
    await cell(page, WED).click();
    await expect(dayHeading(page)).toHaveText("Mercoledì 21");
    await expect(
      row(page, "Notte fuori").locator(".riga-evento__ora"),
    ).toHaveText("23:00");
    await cell(page, THU).click();
    await expect(dayHeading(page)).toHaveText("Giovedì 22");
    await expect(
      row(page, "Notte fuori").locator(".riga-evento__ora"),
    ).toHaveText("0:00");
  });

  test("CA-25: con la lente «Io» gli impegni degli altri sono nascosti e contati", async ({
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
    await createEvent(bianchi, "Giulia", {
      title: "Dentro casa",
      day: TUE,
      from: "18:00",
      to: "19:00",
    });
    await openMonth(page, baseURL, bianchi, { lens: "io" });
    await expect(row(page, "Piscina")).toHaveCount(0);
    await expect(dayInfo(page)).toHaveText("oggi · 1 impegno");
    await expect(
      daySection(page).getByText("1 impegno degli altri nascosto"),
    ).toBeVisible();

    await chooseLens(page, "Nest");
    await expect(row(page, "Piscina")).toHaveCount(1);
    await expect(daySection(page).getByText(/degli altri nascost/)).toHaveCount(
      0,
    );
  });

  test("CA-26: sotto la griglia su mobile, in un aside a destra su desktop", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await createEvent(bianchi, "Giulia", {
      title: "Allenamento",
      day: TUE,
      from: "17:00",
      to: "18:00",
    });
    await openMonth(page, baseURL, bianchi);
    const gridBox = await boxOf(grid(page));
    const sectionBox = await boxOf(daySection(page));
    if (isMobileProject()) {
      expect(sectionBox.y).toBeGreaterThanOrEqual(
        gridBox.y + gridBox.height - 4,
      );
    } else {
      await expect(
        page.locator("aside").getByRole("heading", { level: 2 }),
      ).toHaveText("Martedì 20");
      expect(sectionBox.x).toBeGreaterThanOrEqual(
        gridBox.x + gridBox.width - 4,
      );
    }
  });
});

// --------------------------------------------------------------- empty states

test.describe("stato vuoto", () => {
  for (const lens of ["io", "nest"] as const) {
    test(`CA-27: un mese senza impegni, con la lente ${lens}`, async ({
      page,
      baseURL,
      bianchi,
    }) => {
      await openMonth(page, baseURL, bianchi, { lens });
      await expect(dots(grid(page))).toHaveCount(0);
      await expect(dayHeading(page)).toHaveText("Martedì 20");
      await expect(dayInfo(page)).toHaveText("oggi");
      const section = daySection(page);
      await expect(section.getByText("Niente in programma")).toBeVisible();
      await expect(
        section.getByRole("link", { name: "Aggiungi un impegno" }),
      ).toHaveAttribute("href", "/aggiungi");
      await expect(section).toContainText("Aggiungi un impegno.");
      await expect(page.getByText("collega il calendario")).toHaveCount(0);

      await hydrated(page);
      await cell(page, FRI).click();
      await expect(dayHeading(page)).toHaveText("Venerdì 23");
      await expect(dayHead(page)).toHaveText("Venerdì 23");
      await expect(section.getByText("Niente in programma")).toBeVisible();

      await cell(page, "2026-10-19").click();
      await expect(dayHeading(page)).toHaveText("Lunedì 19");
      await expect(
        section.getByText("Nessun impegno", { exact: true }),
      ).toBeVisible();
      await expect(section.getByText("Niente in programma")).toHaveCount(0);
    });
  }
});

// ------------------------------------------------------------------ isolation

test.describe("isolamento tra Nest", () => {
  const FORBIDDEN = [
    "Cena dai nonni",
    "Impegno riservato",
    "Marco",
    "Laura",
    "Sofia",
    "Tommaso",
    "Biscotto",
    "Occupato",
  ];

  test("CA-33: gli impegni di un altro Nest non arrivano, con nessuna lente", async ({
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
      participants: ["Marco", "Laura", "Sofia", "Tommaso"],
    });
    await createEvent(casa, "Marco", {
      title: "Impegno riservato",
      day: TUE,
      from: "9:00",
      to: "12:00",
      visibility: "busy",
    });
    // Another week, so that the 20th has no «Liberi insieme».
    await createEvent(bianchi, "Giulia", {
      title: "Spesa grande",
      day: "2026-10-12",
      from: "10:00",
      to: "11:00",
    });
    const net = watchNetwork(page);
    await openMonth(page, baseURL, bianchi, { lens: "io" });

    const check = async (label: string) => {
      await expectDots(bianchi, cell(page, TUE), [], label);
      await expect(cell(page, TUE)).toHaveAccessibleName(
        "20, martedì 20 ottobre, oggi, nessun impegno",
      );
      await expect(
        daySection(page).getByText("Niente in programma"),
      ).toBeVisible();
      await pageWithout(page, FORBIDDEN, label);
      const bodies = await net.bodies();
      for (const text of FORBIDDEN)
        expect(bodies, `${label}, rete: ${text}`).not.toContain(text);
    };
    await check("lente Io");
    await chooseLens(page, "Nest");
    await check("lente Nest");
    const html = await (await page.request.get(PATH)).text();
    for (const text of FORBIDDEN)
      expect(html, `HTML: ${text}`).not.toContain(text);
  });

  test("CA-34: gli impegni di un altro Nest non tolgono la serata libera", async ({
    page,
    baseURL,
    bianchi,
    casa,
  }) => {
    await createEvent(casa, "Marco", {
      title: "Cena a casa",
      day: TUE,
      from: "18:00",
      to: "23:00",
      participants: ["Marco", "Laura"],
    });
    await createEvent(bianchi, "Giulia", {
      title: "Lezione di chitarra",
      day: TUE,
      from: "10:00",
      to: "11:00",
    });
    await openMonth(page, baseURL, bianchi, { lens: "nest" });
    const free = row(page, "Liberi insieme");
    await expect(free).toHaveCount(1);
    await expect(free).toContainText("18:00");
    await expect(free).toContainText("Tu, Paolo e Anna, fino a fine serata");
  });
});
