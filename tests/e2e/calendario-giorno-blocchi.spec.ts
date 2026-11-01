import { createEvent, watchNetwork } from "../fixtures/calendario";
import {
  allBlocks,
  boxOf,
  busyBlocks,
  columnsOf,
  dayPath,
  expect,
  freeBlocks,
  head,
  isMobileProject,
  MON,
  near,
  offsetAndHeight,
  only,
  open,
  overlap,
  panel,
  PATH,
  reopen,
  tabTo,
  test,
  TUE,
  WED,
  blocks,
  chooseLens,
  hydrated,
  region,
  type CasaNest,
} from "../fixtures/giorno";
import type { Page } from "@playwright/test";

// Calendario · Giorno «chi è dove» (#26), part 2: blocks, visibility and lens,
// desktop panel. See calendario-giorno.spec.ts for the premises.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

const detailHref = (id: string) => new RegExp(`^/impegni/${id}(\\?.*)?$`);

/** The visible time of a block (`__ora`), hidden for the short ones on desktop. */
const timeOf = (block: ReturnType<typeof blocks>) =>
  block.first().locator(".blocco-orario__ora");

async function expectOneBlock(page: Page, title: string) {
  const found = blocks(page, title);
  await expect(found.first()).toBeVisible();
  await expect(found).toHaveCount(1);
  return found;
}

// --------------------------------------------------------------------- blocks

test.describe("blocchi", () => {
  test("CA-11: un impegno sta nella colonna giusta, a 100 px dalle 8:00 e alto 50", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    const id = await createEvent(bianchi, "Giulia", {
      title: "Riunione di team",
      day: TUE,
      from: "10:00",
      to: "11:00",
    });
    await open(page, baseURL, bianchi);
    const block = await expectOneBlock(page, "Riunione di team");
    expect(await columnsOf(page, block)).toEqual(["Tu"]);
    await expect(timeOf(block)).toHaveText("10:00 – 11:00");
    const { top, height } = await offsetAndHeight(page, block);
    near(top, 100, 4);
    near(height, 50, 4);
    if (isMobileProject()) {
      await expect(block).toHaveAttribute("href", detailHref(id));
    }
  });

  test("CA-12: un impegno su più persone vicine è un blocco solo, largo quanto le colonne", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await createEvent(bianchi, "Paolo", {
      title: "Cena dai nonni",
      day: TUE,
      from: "19:30",
      to: "21:30",
      participants: ["Paolo", "Anna"],
    });
    await open(page, baseURL, bianchi, { lens: "nest" });
    const block = await expectOneBlock(page, "Cena dai nonni");
    const box = await boxOf(block);
    const paolo = await boxOf(head(page, "Paolo"));
    const anna = await boxOf(head(page, "Anna"));
    near(box.x, paolo.x, 4);
    near(box.x + box.width, anna.x + anna.width, 4);
  });

  test("CA-13: persone non vicine hanno un blocco ciascuno", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await createEvent(bianchi, "Giulia", {
      title: "Compiti",
      day: TUE,
      from: "17:00",
      to: "18:00",
      participants: ["Giulia", "Leo"],
    });
    await open(page, baseURL, bianchi, { lens: "nest" });
    const found = blocks(page, "Compiti");
    await expect(found.first()).toBeVisible();
    await expect(found).toHaveCount(2);
    const columns: string[] = [];
    for (const block of await found.all()) {
      columns.push(...(await columnsOf(page, block)));
    }
    expect(columns.sort()).toEqual(["Leo", "Tu"]);
  });

  test("CA-14: chi accompagna ha il blocco nella sua colonna", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await createEvent(bianchi, "Paolo", {
      title: "Inglese",
      day: TUE,
      from: "17:00",
      to: "18:00",
      participants: ["Leo"],
      escort: "Anna",
    });
    await open(page, baseURL, bianchi, { lens: "nest" });
    const block = await expectOneBlock(page, "Inglese");
    const box = await boxOf(block);
    const anna = await boxOf(head(page, "Anna"));
    const leo = await boxOf(head(page, "Leo"));
    near(box.x, anna.x, 4);
    near(box.x + box.width, leo.x + leo.width, 4);
    expect(await columnsOf(page, block)).not.toContain("Paolo");
  });

  test("CA-15: l'orario si legge nel blocco, tranne nei brevi su desktop", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await createEvent(bianchi, "Giulia", {
      title: "Scuola",
      day: TUE,
      from: "8:15",
      to: "8:45",
    });
    await createEvent(bianchi, "Giulia", {
      title: "Palestra",
      day: TUE,
      from: "13:00",
      to: "14:00",
    });
    await open(page, baseURL, bianchi);
    const school = await expectOneBlock(page, "Scuola");
    const { top, height } = await offsetAndHeight(page, school);
    if (isMobileProject()) {
      await expect(timeOf(school)).not.toHaveClass(/visivamente-nascosto/);
      await expect(timeOf(school)).toBeVisible();
      await expect(timeOf(school)).toHaveText("8:15 – 8:45");
      near(top, 12, 4);
      near(height, 46, 4);
    } else {
      // The time stays in the text for screen readers: it is only not drawn.
      await expect(timeOf(school)).toHaveClass(/visivamente-nascosto/);
      near(height, 21, 4);
    }
    const gym = await expectOneBlock(page, "Palestra");
    await expect(timeOf(gym)).toBeVisible();
    await expect(timeOf(gym)).toHaveText("13:00 – 14:00");
  });

  test("CA-16: due impegni che si sovrappongono nel tempo non si coprono", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await createEvent(bianchi, "Giulia", {
      title: "Alfa",
      day: TUE,
      from: "16:30",
      to: "17:15",
    });
    await createEvent(bianchi, "Giulia", {
      title: "Bravo",
      day: TUE,
      from: "17:00",
      to: "18:30",
    });
    await open(page, baseURL, bianchi);
    const alfa = await expectOneBlock(page, "Alfa");
    const bravo = await expectOneBlock(page, "Bravo");
    await expect(alfa).toBeVisible();
    await expect(bravo).toBeVisible();
    expect(await columnsOf(page, alfa)).toEqual(["Tu"]);
    expect(await columnsOf(page, bravo)).toEqual(["Tu"]);
    expect(overlap(await boxOf(alfa), await boxOf(bravo))).toBe(false);
  });

  test("CA-17: un impegno su più giorni mostra la parte del giorno, con l'orario vero", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await createEvent(bianchi, "Giulia", {
      title: "Notte fuori",
      day: MON,
      from: "22:00",
      to: "9:00",
      endDay: TUE,
    });
    await open(page, baseURL, bianchi, { path: dayPath(TUE) });
    const night = await expectOneBlock(page, "Notte fuori");
    await expect(night).toContainText("22:00 – 9:00");
    const tuesday = await offsetAndHeight(page, night);
    near(tuesday.top, 0, 4);
    near(tuesday.height, 50, 4);

    await reopen(page, dayPath(MON));
    const monday = await offsetAndHeight(
      page,
      await expectOneBlock(page, "Notte fuori"),
    );
    near(monday.top, 700, 4);
    near(monday.height, 50, 4);
  });

  test("CA-17: un impegno prima delle 8:00 sta in cima con l'orario vero", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await createEvent(bianchi, "Giulia", {
      title: "Alba",
      day: TUE,
      from: "6:00",
      to: "7:00",
    });
    await open(page, baseURL, bianchi, { path: dayPath(TUE) });
    const early = await expectOneBlock(page, "Alba");
    await expect(early).toContainText("6:00 – 7:00");
    const { top } = await offsetAndHeight(page, early);
    near(top, 0, 4);
  });
});

// ------------------------------------------------------ short blocks (mobile)

test.describe("impegni brevi", () => {
  test("CA-41: su mobile gli impegni brevi sono alti almeno 44 px, su desktop 21", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await createEvent(bianchi, "Giulia", {
      title: "Uno",
      day: TUE,
      from: "10:00",
      to: "10:30",
    });
    await createEvent(bianchi, "Giulia", {
      title: "Due",
      day: TUE,
      from: "10:30",
      to: "11:00",
    });
    await open(page, baseURL, bianchi);
    const one = await expectOneBlock(page, "Uno");
    const two = await expectOneBlock(page, "Due");
    const first = await boxOf(one);
    const second = await boxOf(two);
    if (isMobileProject()) {
      expect(first.height).toBeGreaterThanOrEqual(44);
      expect(second.height).toBeGreaterThanOrEqual(44);
      await expect(timeOf(one)).toHaveText("10:00 – 10:30");
      await expect(timeOf(two)).toHaveText("10:30 – 11:00");
      expect(await columnsOf(page, one)).toEqual(["Tu"]);
      expect(await columnsOf(page, two)).toEqual(["Tu"]);
      expect(overlap(first, second)).toBe(false);
    } else {
      near(first.height, 21, 4);
      near(second.height, 21, 4);
    }
  });

  only(
    "mobile",
    "CA-42: su mobile un impegno vicino alle 23:00 sale e finisce alle 23:00",
    async ({ page, baseURL, bianchi }) => {
      await createEvent(bianchi, "Giulia", {
        title: "Tardi",
        day: TUE,
        from: "22:30",
        to: "23:00",
      });
      await open(page, baseURL, bianchi);
      const late = await expectOneBlock(page, "Tardi");
      await expect(timeOf(late)).toHaveText("22:30 – 23:00");
      const { bottom, height } = await offsetAndHeight(page, late);
      near(bottom, 750, 4);
      near(height, 46, 4);
    },
  );

  only(
    "mobile",
    "CA-43: su mobile l'«Occupato» di mezz'ora non si allunga",
    async ({ page, baseURL, bianchi }) => {
      await createEvent(bianchi, "Paolo", {
        title: "Riunione segreta",
        day: TUE,
        from: "9:00",
        to: "9:30",
        visibility: "busy",
      });
      await open(page, baseURL, bianchi, { lens: "nest" });
      const busy = busyBlocks(page);
      await expect(busy).toHaveCount(1);
      await expect(busy).toBeVisible();
      const { height } = await offsetAndHeight(page, busy);
      near(height, 21, 4);
    },
  );
});

// ------------------------------------------------------ visibility and lens

test.describe("visibilità e lente", () => {
  const SECRET = ["Riunione segreta", "Ufficio Nord"];

  async function busyOfPaolo(bianchi: CasaNest) {
    return createEvent(bianchi, "Paolo", {
      title: "Riunione segreta",
      day: TUE,
      from: "9:00",
      to: "15:00",
      visibility: "busy",
      location: "Ufficio Nord",
    });
  }

  test("CA-18: l'«Occupato» degli altri non si apre e non rivela nulla", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await busyOfPaolo(bianchi);
    const net = watchNetwork(page);
    await open(page, baseURL, bianchi, { lens: "nest" });
    const busy = busyBlocks(page);
    await expect(busy).toHaveCount(1);
    await expect(busy).toBeVisible();
    expect(await columnsOf(page, busy)).toEqual(["Paolo"]);
    await expect(busy.locator(".blocco-orario__titolo")).toHaveText("Occupato");
    await expect(busy).toContainText("9:00 – 15:00");
    const inert = await busy.evaluate(
      (el) =>
        el.closest('a, button, [role="link"], [role="button"]') === null &&
        el.querySelector("a, button") === null &&
        el.tabIndex < 0,
    );
    expect(inert, "non è un link né un bottone e non prende il focus").toBe(
      true,
    );

    const dom = await page.content();
    const bodies = await net.bodies();
    const html = await (await page.request.get(PATH)).text();
    for (const text of SECRET) {
      expect(dom, `DOM: ${text}`).not.toContain(text);
      expect(bodies, `rete: ${text}`).not.toContain(text);
      expect(html, `HTML: ${text}`).not.toContain(text);
    }

    // Tab never lands on the block.
    await region(page).focus();
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      const onBusy = await page.evaluate(
        () =>
          document.activeElement?.closest(".blocco-orario--occupato") != null,
      );
      expect(onBusy, "Tab non arriva sull'«Occupato»").toBe(false);
    }

    const before = page.url();
    await hydrated(page);
    await busy.click();
    expect(page.url()).toBe(before);
  });

  test("CA-19: l'autore dell'«Occupato» vede il suo impegno per intero", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    const id = await busyOfPaolo(bianchi);
    await open(page, baseURL, bianchi, { who: "Paolo" });
    const block = await expectOneBlock(page, "Riunione segreta");
    expect(await columnsOf(page, block)).toEqual(["Tu"]);
    if (isMobileProject()) {
      await expect(block).toHaveAttribute("href", detailHref(id));
    }
  });

  test("CA-20: il «Solo io» degli altri non c'è e non conta per lo stato vuoto", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await createEvent(bianchi, "Paolo", {
      title: "Prova privata",
      day: TUE,
      from: "10:00",
      to: "11:00",
      visibility: "private",
    });
    const net = watchNetwork(page);
    await open(page, baseURL, bianchi, { lens: "nest" });
    await expect(page.getByText("Giornata libera")).toBeVisible();
    expect(await page.content()).not.toContain("Prova privata");
    expect(await net.bodies()).not.toContain("Prova privata");
    const html = await (await page.request.get(PATH)).text();
    expect(html).not.toContain("Prova privata");
    await expect(page.getByText("Prova privata")).toHaveCount(0);
  });

  async function lensEvents(bianchi: CasaNest) {
    await createEvent(bianchi, "Paolo", {
      title: "Piscina",
      day: TUE,
      from: "17:00",
      to: "18:00",
      participants: ["Paolo", "Leo"],
    });
    await createEvent(bianchi, "Paolo", {
      title: "Inglese",
      day: TUE,
      from: "18:00",
      to: "19:00",
      participants: ["Leo"],
      escort: "Giulia",
    });
    await createEvent(bianchi, "Giulia", {
      title: "Colloquio",
      day: TUE,
      from: "10:00",
      to: "11:00",
    });
  }

  test("CA-21: la lente «Io» mostra solo ciò che riguarda me, «Nest» tutto", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await lensEvents(bianchi);
    await open(page, baseURL, bianchi, { lens: "io" });
    await expectOneBlock(page, "Colloquio");
    const english = await expectOneBlock(page, "Inglese");
    expect(await columnsOf(page, english)).toEqual(["Tu"]);
    await expect(blocks(page, "Piscina")).toHaveCount(0);

    const before = page.url();
    await hydrated(page);
    await chooseLens(page, "Nest");
    await expect(blocks(page, "Piscina").first()).toBeVisible();
    expect(page.url()).toBe(before);
  });
});

// ------------------------------------------------------------ desktop panel

test.describe("pannello desktop", () => {
  async function threeEvents(bianchi: CasaNest) {
    await createEvent(bianchi, "Giulia", {
      title: "Palestra",
      day: TUE,
      from: "13:00",
      to: "14:00",
    });
    await createEvent(bianchi, "Giulia", {
      title: "Call con Acme",
      day: TUE,
      from: "16:00",
      to: "17:00",
    });
    return createEvent(bianchi, "Giulia", {
      title: "Cena dai nonni",
      day: TUE,
      from: "19:30",
      to: "21:30",
      location: "Monza",
    });
  }

  const current = (page: Page) =>
    page.locator('a.blocco-orario[aria-current="true"]');

  only(
    "desktop",
    "CA-22: all'apertura il pannello sceglie il prossimo impegno",
    async ({ page, baseURL, bianchi }) => {
      await threeEvents(bianchi);
      await open(page, baseURL, bianchi);
      const section = panel(page, "Impegno");
      await expect(section).toContainText("16:00");
      await expect(section).toContainText("Call con Acme");
      await expect(current(page)).toHaveCount(1);
      await expect(current(page)).toContainText("Call con Acme");
    },
  );

  only(
    "desktop",
    "CA-23: sceglie quello in corso, e in un altro giorno il primo",
    async ({ page, baseURL, bianchi }) => {
      await threeEvents(bianchi);
      await createEvent(bianchi, "Giulia", {
        title: "In corso",
        day: TUE,
        from: "15:00",
        to: "16:30",
      });
      await createEvent(bianchi, "Giulia", {
        title: "Primo",
        day: WED,
        from: "9:00",
        to: "10:00",
      });
      await createEvent(bianchi, "Giulia", {
        title: "Ultimo",
        day: WED,
        from: "18:00",
        to: "19:00",
      });
      await open(page, baseURL, bianchi);
      await expect(panel(page, "Impegno")).toContainText("In corso");
      await reopen(page, dayPath(WED));
      await expect(panel(page, "Impegno")).toContainText("Primo");
      await expect(panel(page, "Impegno")).not.toContainText("Ultimo");
    },
  );

  only(
    "desktop",
    "CA-24: il clic su un blocco lo sceglie nel pannello, senza cambiare pagina",
    async ({ page, baseURL, bianchi }) => {
      const id = await threeEvents(bianchi);
      await open(page, baseURL, bianchi);
      const section = panel(page, "Impegno");
      await expect(section).toContainText("Call con Acme");
      const before = page.url();
      await hydrated(page);
      const dinner = blocks(page, "Cena dai nonni");
      await expect(async () => {
        await dinner.click();
        await expect(section).toContainText("Cena dai nonni", {
          timeout: 1000,
        });
      }).toPass();
      expect(page.url()).toBe(before);
      await expect(section).toContainText("19:30");
      await expect(section).toContainText("Fino alle 21:30, Monza");
      await expect(section).toContainText("Tutto il Nest");
      await expect(current(page)).toHaveCount(1);
      await expect(current(page)).toContainText("Cena dai nonni");
      await expect(section.getByRole("link").first()).toHaveAttribute(
        "href",
        detailHref(id),
      );
    },
  );

  only(
    "desktop",
    "CA-24: Tab fino al blocco e Invio lo scelgono",
    async ({ page, baseURL, bianchi }) => {
      await threeEvents(bianchi);
      await open(page, baseURL, bianchi);
      const section = panel(page, "Impegno");
      await expect(section).toContainText("Call con Acme");
      await hydrated(page);
      const dinner = blocks(page, "Cena dai nonni");
      await tabTo(page, dinner);
      const before = page.url();
      await expect(async () => {
        await page.keyboard.press("Enter");
        await expect(section).toContainText("Cena dai nonni", {
          timeout: 1000,
        });
      }).toPass();
      expect(page.url()).toBe(before);
      await expect(current(page)).toHaveCount(1);
      await expect(current(page)).toContainText("Cena dai nonni");
    },
  );

  only(
    "desktop",
    "CA-25: «Occupato» e «Liberi insieme» non si possono scegliere",
    async ({ page, baseURL, bianchi }) => {
      await threeEvents(bianchi);
      await createEvent(bianchi, "Paolo", {
        title: "Riunione segreta",
        day: TUE,
        from: "9:00",
        to: "15:00",
        visibility: "busy",
        location: "Ufficio Nord",
      });
      await open(page, baseURL, bianchi, { lens: "nest" });
      const section = panel(page, "Impegno");
      await expect(section).toContainText("Call con Acme");
      await hydrated(page);
      await expect(busyBlocks(page)).toHaveCount(1);
      await busyBlocks(page).click();
      await expect(section).toContainText("Call con Acme");
      await expect(freeBlocks(page)).toHaveCount(1);
      await freeBlocks(page).click();
      await expect(section).toContainText("Call con Acme");
      await expect(current(page)).toHaveCount(1);
      await expect(current(page)).toContainText("Call con Acme");
    },
  );
});

// ------------------------------------------------------------- «Occupato» (44)

test.describe("nome dell'«Occupato»", () => {
  test("CA-44: «Occupato» si legge «Paolo ha un impegno, dalle 9:00 alle 15:00» e non è un link", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await createEvent(bianchi, "Paolo", {
      title: "Riunione segreta",
      day: TUE,
      from: "9:00",
      to: "15:00",
      visibility: "busy",
      location: "Ufficio Nord",
    });
    await open(page, baseURL, bianchi, { lens: "nest" });
    const busy = busyBlocks(page);
    await expect(busy).toHaveCount(1);
    expect(await columnsOf(page, busy)).toEqual(["Paolo"]);
    await expect(busy.locator(".blocco-orario__titolo")).toHaveText("Occupato");
    const spoken = busy.getByText("Paolo ha un impegno, dalle 9:00 alle 15:00");
    await expect(spoken).toHaveCount(1);
    const hidden = await spoken.evaluate(
      (el) => el.closest('[aria-hidden="true"]') !== null,
    );
    expect(hidden, "il nome accessibile non è nascosto ai lettori").toBe(false);
    await expect(
      page.getByRole("link", { name: /Paolo ha un impegno/ }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /Paolo ha un impegno/ }),
    ).toHaveCount(0);
    expect(await busy.evaluate((el) => el.tagName)).not.toBe("A");
    expect(await allBlocks(page).count()).toBe(0);
  });
});
