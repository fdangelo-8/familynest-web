import { createEvent, watchNetwork } from "../fixtures/calendario";
import {
  BIANCHI,
  buildNest,
  alertColor,
  colorOf,
  type MemberSpec,
} from "../fixtures/casa";
import {
  cell,
  chooseLens,
  dayHeading,
  dayInfo,
  dots,
  expect,
  expectDots,
  FRI,
  grid,
  hydrated,
  isMobileProject,
  monthPath,
  monthReady,
  normaliseColor,
  numberOf,
  openMonth,
  othersDot,
  pageWithout,
  PATH,
  reopen,
  SAT,
  shadowColor,
  test,
  THU,
  tokenColor,
  TUE,
  WED,
  boxOf,
  type CasaNest,
  type Day,
} from "../fixtures/mese";

// Calendario · Mese (#27), part 2: the dots under each day, the holidays, the
// outline of the dots. See calendario-mese.spec.ts for the setting.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

const SUN25: Day = "2026-10-25";

// ----------------------------------------------------------------------- dots

test.describe("punti", () => {
  test("CA-12: un punto per persona, nell'ordine tu, adulti, figli", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await createEvent(bianchi, "Giulia", {
      title: "Piscina",
      day: FRI,
      from: "17:00",
      to: "18:00",
      participants: ["Giulia", "Leo"],
    });
    await createEvent(bianchi, "Paolo", {
      title: "Spesa grande",
      day: FRI,
      from: "18:00",
      to: "19:00",
      participants: ["Paolo"],
      escort: "Anna",
    });
    await openMonth(page, baseURL, bianchi, { lens: "nest" });
    const friday = cell(page, FRI);
    await expectDots(bianchi, friday, ["Giulia", "Paolo", "Anna", "Leo"]);
    await expect(friday).toHaveAccessibleName(
      "23, venerdì 23 ottobre, 2 impegni: tu, Paolo, Anna e Leo",
    );
    const thursday = cell(page, THU);
    await expect(dots(thursday)).toHaveCount(0);
    await expect(thursday).toHaveAccessibleName(
      "22, giovedì 22 ottobre, nessun impegno",
    );
  });

  test("CA-13: una persona ha al massimo un punto per giorno, anche con più impegni o su più giorni", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await createEvent(bianchi, "Giulia", {
      title: "Studio mattina",
      day: THU,
      from: "9:00",
      to: "10:00",
    });
    await createEvent(bianchi, "Giulia", {
      title: "Studio sera",
      day: THU,
      from: "18:00",
      to: "19:00",
    });
    await createEvent(bianchi, "Giulia", {
      title: "Turno di notte",
      day: WED,
      from: "23:00",
      to: "1:00",
      endDay: THU,
    });
    await openMonth(page, baseURL, bianchi);
    await expectDots(bianchi, cell(page, THU), ["Giulia"], "giorno 22");
    await expectDots(bianchi, cell(page, WED), ["Giulia"], "giorno 21");
  });

  test("CA-14: «Occupato» dà il punto all'autore, «Solo io» degli altri mai", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await createEvent(bianchi, "Paolo", {
      title: "Riunione segreta",
      location: "Ufficio Nord",
      day: FRI,
      from: "9:00",
      to: "15:00",
      visibility: "busy",
    });
    await createEvent(bianchi, "Paolo", {
      title: "Prova privata",
      day: SAT,
      from: "10:00",
      to: "11:00",
      visibility: "private",
    });
    const net = watchNetwork(page);
    await openMonth(page, baseURL, bianchi, { lens: "nest" });
    await expectDots(bianchi, cell(page, FRI), ["Paolo"], "giorno 23");
    await expect(dots(cell(page, SAT))).toHaveCount(0);

    const hidden = ["Riunione segreta", "Ufficio Nord", "Prova privata"];
    await pageWithout(page, hidden, "lente Nest");
    await expect(page.getByText("Riunione segreta")).toHaveCount(0);
    const html = await (await page.request.get(PATH)).text();
    for (const text of hidden)
      expect(html, `HTML: ${text}`).not.toContain(text);
    const bodies = await net.bodies();
    for (const text of hidden)
      expect(bodies, `rete: ${text}`).not.toContain(text);

    await chooseLens(page, "Io");
    await expect(dots(cell(page, FRI))).toHaveCount(0);
    await pageWithout(page, hidden, "lente Io");
  });

  test.describe("molte persone", () => {
    const KIDS = ["Bea", "Carlo", "Dario", "Elisa", "Fabio", "Gina"];
    const specs: MemberSpec[] = [
      ...BIANCHI,
      ...KIDS.map((name, i): MemberSpec => ({
        name,
        kind: "child",
        color: (["salvia", "zafferano", "glicine"] as const)[i % 3]!,
      })),
    ];

    /** Casa Bianchi with 6 more children; the Nest is deleted at the end. */
    async function crowd(
      run: (nest: CasaNest) => Promise<void>,
    ): Promise<void> {
      const { nest, cleanup } = await buildNest("Casa Bianchi", specs);
      try {
        await createEvent(nest, "Giulia", {
          title: "Gita in cinque",
          day: WED,
          from: "10:00",
          to: "11:00",
          participants: ["Giulia", "Paolo", "Anna", "Leo", "Bea"],
        });
        await createEvent(nest, "Giulia", {
          title: "Gita in quattro",
          day: THU,
          from: "10:00",
          to: "11:00",
          participants: ["Giulia", "Paolo", "Anna", "Leo"],
        });
        await createEvent(nest, "Giulia", {
          title: "Festa di tutti",
          day: FRI,
          from: "10:00",
          to: "11:00",
          participants: ["Giulia", "Paolo", "Anna", "Leo", ...KIDS],
        });
        await run(nest);
      } finally {
        await cleanup();
      }
    }

    test("CA-15: da 5 persone, sotto 768 px, 3 punti e il punto grigio «e altri»; da 768 px tutti", async ({
      page,
      baseURL,
    }) => {
      await crowd(async (nest) => {
        await openMonth(page, baseURL, nest, { lens: "nest" });
        const wed = cell(page, WED);
        const thu = cell(page, THU);
        const fri = cell(page, FRI);
        await expect(dots(wed)).toHaveCount(5);
        await expect(dots(thu)).toHaveCount(4);
        await expect(dots(fri)).toHaveCount(10);

        if (isMobileProject()) {
          for (let i = 0; i < 5; i++) {
            if (i < 3) await expect(dots(wed).nth(i)).toBeVisible();
            else await expect(dots(wed).nth(i)).toBeHidden();
          }
          await expect(othersDot(wed)).toBeVisible();
          for (let i = 0; i < 4; i++)
            await expect(dots(thu).nth(i)).toBeVisible();
          await expect(othersDot(thu)).toBeHidden();
          for (let i = 0; i < 10; i++) {
            if (i < 3) await expect(dots(fri).nth(i)).toBeVisible();
            else await expect(dots(fri).nth(i)).toBeHidden();
          }
          await expect(othersDot(fri)).toBeVisible();
          const first3 = await Promise.all(
            [0, 1, 2].map((i) => dots(fri).nth(i).getAttribute("data-membro")),
          );
          expect(first3).toEqual(
            ["Giulia", "Paolo", "Anna"].map((n) => nest.members[n]),
          );
          const width = await page.evaluate(
            () => document.documentElement.scrollWidth,
          );
          expect(width).toBeLessThanOrEqual(390);
          for (const day of [WED, FRI]) {
            const box = await boxOf(cell(page, day));
            const dot = await boxOf(othersDot(cell(page, day)));
            expect(dot.x).toBeGreaterThanOrEqual(box.x - 1);
            expect(dot.x + dot.width).toBeLessThanOrEqual(
              box.x + box.width + 1,
            );
            expect(dot.y).toBeGreaterThanOrEqual(box.y - 1);
            expect(dot.y + dot.height).toBeLessThanOrEqual(
              box.y + box.height + 1,
            );
          }
        } else {
          for (let i = 0; i < 10; i++)
            await expect(dots(fri).nth(i)).toBeVisible();
          await expect(othersDot(fri)).toBeHidden();
        }

        const name = (await fri.getAttribute("aria-label")) ?? "";
        expect(name).toContain("1 impegno: tu, Paolo, Anna, Leo");
        for (const kid of KIDS) expect(name, kid).toContain(kid);
      });
    });

    test("CA-38: anche il punto grigio «e altri» ha il contorno", async ({
      page,
      baseURL,
    }) => {
      test.skip(
        !isMobileProject(),
        "Il punto grigio si vede solo sotto 768 px",
      );
      await crowd(async (nest) => {
        await openMonth(page, baseURL, nest, { lens: "nest" });
        const target = othersDot(cell(page, FRI));
        await expect(target).toBeVisible();
        expect(await shadowColor(target)).toBe(
          normaliseColor(await tokenColor(page, "--color-filo-campo")),
        );
      });
    });
  });

  test("CA-16: la lente «Io» mostra le persone dei miei impegni, «Nest» anche gli altri", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await createEvent(bianchi, "Paolo", {
      title: "Piscina",
      day: FRI,
      from: "17:00",
      to: "18:00",
      participants: ["Paolo", "Leo"],
    });
    await createEvent(bianchi, "Giulia", {
      title: "Colazione",
      day: THU,
      from: "10:00",
      to: "11:00",
      participants: ["Giulia", "Paolo"],
    });
    await openMonth(page, baseURL, bianchi, { lens: "io" });
    await expect(dots(cell(page, FRI))).toHaveCount(0);
    await expectDots(bianchi, cell(page, THU), ["Giulia", "Paolo"], "Io 22");
    await chooseLens(page, "Nest");
    await expectDots(bianchi, cell(page, FRI), ["Paolo", "Leo"], "Nest 23");
  });

  test("CA-38: i punti hanno il contorno del colore --color-filo-campo", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await createEvent(bianchi, "Giulia", {
      title: "Allenamento",
      day: TUE,
      from: "17:00",
      to: "18:00",
      participants: ["Giulia", "Leo"],
    });
    await createEvent(bianchi, "Giulia", {
      title: "Colazione",
      day: THU,
      from: "10:00",
      to: "11:00",
    });
    await openMonth(page, baseURL, bianchi);
    const expected = normaliseColor(
      await tokenColor(page, "--color-filo-campo"),
    );
    // Day 20 is the chosen one (white card), day 22 is not.
    for (const [day, count] of [
      [TUE, 2],
      [THU, 1],
    ] as const) {
      const found = dots(cell(page, day));
      await expect(found).toHaveCount(count);
      for (let i = 0; i < count; i++) {
        expect(
          await shadowColor(found.nth(i)),
          `giorno ${day}, punto ${i}`,
        ).toBe(expected);
      }
    }
  });
});

// ------------------------------------------------------------------- holidays

test.describe("festività", () => {
  test("CA-17: Ognissanti e San Francesco in rosso e nel nome, un giorno normale no", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await openMonth(page, baseURL, bianchi);
    const ognissanti = grid(page).getByRole("gridcell", {
      name: /^1, domenica 1 novembre/,
    });
    const francesco = grid(page).getByRole("gridcell", {
      name: /^4, domenica 4 ottobre/,
    });
    const normal = grid(page).getByRole("gridcell", {
      name: /^3, sabato 3 ottobre/,
    });
    await expect(ognissanti).toHaveAccessibleName(
      "1, domenica 1 novembre, Ognissanti, nessun impegno",
    );
    await expect(francesco).toHaveAccessibleName(
      "4, domenica 4 ottobre, San Francesco, nessun impegno",
    );
    await expect(normal).toHaveAccessibleName(
      "3, sabato 3 ottobre, nessun impegno",
    );
    const alert = await alertColor(page);
    expect(await colorOf(numberOf(ognissanti))).toBe(alert);
    expect(await colorOf(numberOf(francesco))).toBe(alert);
    expect(await colorOf(numberOf(normal))).not.toBe(alert);
  });

  const holidays: [string, string, string][] = [
    ["2026-12", "8, martedì 8 dicembre", "Immacolata"],
    ["2026-12", "25, venerdì 25 dicembre", "Natale"],
    ["2026-12", "26, sabato 26 dicembre", "Santo Stefano"],
    ["2026-12", "1, venerdì 1 gennaio", "Capodanno"],
    ["2027-03", "28, domenica 28 marzo", "Pasqua"],
    ["2027-03", "29, lunedì 29 marzo", "Pasquetta"],
    ["2026-04", "5, domenica 5 aprile", "Pasqua"],
    ["2026-04", "6, lunedì 6 aprile", "Pasquetta"],
    ["2026-04", "25, sabato 25 aprile", "Festa della Liberazione"],
  ];

  async function checkHolidays(
    page: import("@playwright/test").Page,
    baseURL: string | undefined,
    nest: CasaNest,
  ) {
    let last = "";
    for (const [month, start, name] of holidays) {
      if (month !== last) {
        if (last === "") {
          await openMonth(page, baseURL, nest, { month });
        } else {
          await reopen(page, monthPath(month));
          await monthReady(page);
        }
        last = month;
      }
      const found = grid(page).getByRole("gridcell", {
        name: new RegExp(`^${start}`),
      });
      await expect(found, `${start}`).toHaveAccessibleName(
        new RegExp(`, ${name}(,|$)`),
      );
    }
    await reopen(page, monthPath("2026-12"));
    await monthReady(page);
    await expect(
      grid(page).getByRole("gridcell", { name: /^25, venerdì 25 dicembre/ }),
    ).toHaveAccessibleName("25, venerdì 25 dicembre, Natale, nessun impegno");
  }

  test("CA-18: le festività di dicembre, Pasqua e Pasquetta", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await checkHolidays(page, baseURL, bianchi);
  });

  test.describe("con il browser a New York", () => {
    test.use({ timezoneId: "America/New_York" });

    test("CA-18: le festività non dipendono dal fuso del browser", async ({
      page,
      baseURL,
      bianchi,
    }) => {
      await checkHolidays(page, baseURL, bianchi);
    });
  });

  test("CA-19: la testa del 1° novembre dice «Ognissanti · 2 impegni»", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await createEvent(bianchi, "Giulia", {
      title: "Messa",
      day: "2026-11-01",
      from: "10:00",
      to: "11:00",
    });
    await createEvent(bianchi, "Giulia", {
      title: "Pranzo",
      day: "2026-11-01",
      from: "12:00",
      to: "14:00",
    });
    await openMonth(page, baseURL, bianchi, { month: "2026-11" });
    await expect(dayHeading(page)).toHaveText("Domenica 1");
    await expect(dayInfo(page)).toHaveText("Ognissanti · 2 impegni");
  });
});

// ------------------------------------------------------------------ time zone

test.describe("fuso orario", () => {
  test.use({ timezoneId: "America/New_York" });

  test("CA-32: un impegno dopo mezzanotte a Roma resta sul giorno di Roma", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await createEvent(bianchi, "Giulia", {
      title: "Sveglia presto",
      day: SUN25,
      from: "0:30",
      to: "1:30",
    });
    await openMonth(page, baseURL, bianchi);
    await expectDots(bianchi, cell(page, SUN25), ["Giulia"], "giorno 25");
    await expect(dots(cell(page, "2026-10-24"))).toHaveCount(0);
    await hydrated(page);
    await cell(page, SUN25).click();
    await expect(
      page.locator(".riga-evento").filter({ hasText: "Sveglia presto" }),
    ).toContainText("0:30");
  });
});
