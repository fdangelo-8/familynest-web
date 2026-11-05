import { createEvent, instant } from "../fixtures/impegni";
import {
  ISCRIZIONE,
  NUOTO,
  T,
  addShopping,
  allRows,
  chipTexts,
  d,
  emptyTitle,
  example,
  expect,
  field,
  group,
  groupKinds,
  isMobile,
  openSearch,
  recordSearch,
  rowsOf,
  seedNuoto,
  surface,
  test,
  titlesOf,
  typeSearch,
  yearOfNovember,
  type CasaNest,
} from "../fixtures/ricerca";

// Ricerca (#40): expressions (CA-24 ... CA-28) and privacy and isolation
// (CA-29 ... CA-35). Data: a throwaway Nest per test; dates relative to T, a
// Tuesday (fixtures/ricerca.ts): the weekend of the criteria is T + 4 and T + 5.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

/** Saturday and Sunday of the week of T, Monday after. */
const SAT = d(4);
const SUN = d(5);
const MON_AFTER = d(6);

async function seedWeekend(nest: CasaNest) {
  await createEvent(nest, "Marco", {
    title: "Pizza dai nonni",
    day: SAT,
    from: "19:00",
    to: "21:00",
    members: ["Marco"],
  });
  await createEvent(nest, "Marco", {
    title: "Cinema",
    day: MON_AFTER,
    from: "20:00",
    to: "22:00",
    members: ["Marco"],
  });
  await nest.deadline("Marco", { title: "Bollo auto", due: SUN });
  await addShopping(nest, "Pizza surgelata");
}

test.describe("espressioni", () => {
  test("CA-24: il chip «questo weekend» scrive il testo e mostra sabato e domenica, senza Spesa e senza evidenziazioni", async ({
    page,
    baseURL,
    nest,
  }) => {
    await seedWeekend(nest);
    await openSearch(page, baseURL, nest);
    await example(page, "questo weekend").click();

    await expect(field(page)).toHaveValue("questo weekend");
    await expect(titlesOf(page, "event")).toHaveText(["Pizza dai nonni"]);
    await expect(titlesOf(page, "deadline")).toHaveText(["Bollo auto"]);
    await expect(surface(page).getByText("Cinema")).toHaveCount(0);
    await expect(group(page, "shopping_item")).toHaveCount(0);
    await expect(surface(page).getByText("Pizza surgelata")).toHaveCount(0);
    await expect(page.locator("mark.evidenzia")).toHaveCount(0);
  });

  test("CA-25: «pizza questo weekend» mostra solo la «Pizza dai nonni», con «Pizza» evidenziato", async ({
    page,
    baseURL,
    nest,
  }) => {
    await seedWeekend(nest);
    await openSearch(page, baseURL, nest);
    await typeSearch(page, "pizza questo weekend");

    await expect(allRows(page)).toHaveCount(1);
    await expect(titlesOf(page, "event")).toHaveText(["Pizza dai nonni"]);
    await expect(rowsOf(page, "event").locator("mark.evidenzia")).toHaveText(
      "Pizza",
    );
  });

  test("CA-26: «scade a novembre» mostra solo le scadenze di novembre, e i chip sono solo «Tutto» e «Scadenze»", async ({
    page,
    baseURL,
    nest,
  }) => {
    const year = yearOfNovember(T);
    await nest.deadline("Marco", {
      title: "Assicurazione prima",
      due: `${year}-10-31`,
    });
    await nest.deadline("Marco", {
      title: "Assicurazione tre",
      due: `${year}-11-03`,
    });
    await nest.deadline("Marco", {
      title: "Assicurazione trenta",
      due: `${year}-11-30`,
    });
    await nest.deadline("Marco", {
      title: "Assicurazione dopo",
      due: `${year}-12-01`,
    });
    await nest.todo("Marco", {
      title: "Cosa di novembre",
      due: `${year}-11-10`,
    });
    await openSearch(page, baseURL, nest);
    await typeSearch(page, "scade a novembre");

    await expect(titlesOf(page, "deadline")).toHaveText([
      "Assicurazione tre",
      "Assicurazione trenta",
    ]);
    await expect
      .poll(() => groupKinds(page))
      .toEqual(isMobile() ? ["deadline"] : ["deadline", "azioni"]);
    if (isMobile()) {
      await expect
        .poll(() => chipTexts(page))
        .toEqual(["Tutto 2", "Scadenze 2"]);
    }
  });

  test("CA-27: «cose di Sofia» mostra l'impegno e la scadenza di Sofia, non la cosa da fare di Tommaso", async ({
    page,
    baseURL,
    nest,
  }) => {
    await seedNuoto(nest);
    await nest.todo("Marco", {
      title: "Comprare le scarpe",
      assignee: "Tommaso",
    });
    await openSearch(page, baseURL, nest);
    await typeSearch(page, "cose di Sofia");

    await expect(titlesOf(page, "event").first()).toHaveText(NUOTO);
    await expect(titlesOf(page, "deadline")).toHaveText([ISCRIZIONE]);
    await expect(group(page, "todo")).toHaveCount(0);
    await expect(surface(page).getByText("Comprare le scarpe")).toHaveCount(0);
    await expect(page.locator("mark.evidenzia")).toHaveCount(0);
  });

  test("CA-28: «cose di Giulia» (non è del Nest) si cerca come testo e dà il vuoto", async ({
    page,
    baseURL,
    nest,
  }) => {
    await seedNuoto(nest);
    await openSearch(page, baseURL, nest);
    await typeSearch(page, "cose di Giulia");
    await expect(emptyTitle(page)).toHaveText(
      "Nessun risultato per «cose di Giulia»",
    );
    await expect(allRows(page)).toHaveCount(0);
  });
});

// ------------------------------------------------------------------- privacy

/** Asks the database again, as the rows of the answers say: nothing may be in them. */
function leaked(answers: string[], words: string[]): string[] {
  return words.filter((word) =>
    answers.some((answer) => answer.includes(word)),
  );
}

test.describe("privacy e isolamento", () => {
  test("CA-29: le cose «Solo io» di Laura non compaiono a Marco, né nei conteggi né nelle risposte", async ({
    page,
    baseURL,
    nest,
  }) => {
    await createEvent(nest, "Marco", {
      title: NUOTO,
      day: T,
      from: "17:00",
      to: "18:30",
      members: ["Sofia"],
    });
    await createEvent(nest, "Laura", {
      title: "Nuoto con Anna",
      day: SAT,
      from: "10:00",
      to: "11:00",
      visibility: "private",
      members: ["Laura"],
    });
    await nest.todo("Laura", {
      title: "Nuoto regalo",
      priv: true,
      assignee: "Laura",
      due: SUN,
    });
    await nest.deadline("Laura", {
      title: "Nuoto abbonamento",
      priv: true,
      assignee: "Laura",
      due: SUN,
    });
    await nest.todo("Marco", {
      title: "Pane per Laura",
      assignee: "Laura",
      due: SUN,
    });
    await openSearch(page, baseURL, nest);
    const search = recordSearch(page);

    await typeSearch(page, "nuoto");
    await expect(titlesOf(page, "event")).toHaveText([NUOTO]);
    await expect(group(page, "todo")).toHaveCount(0);
    await expect(group(page, "deadline")).toHaveCount(0);
    if (isMobile()) {
      await expect
        .poll(() => chipTexts(page))
        .toEqual(["Tutto 1", "Impegni 1"]);
    }

    await typeSearch(page, "questo weekend");
    await expect(titlesOf(page, "todo")).toHaveText(["Pane per Laura"]);
    await expect
      .poll(() => groupKinds(page))
      .toEqual(isMobile() ? ["todo"] : ["todo", "azioni"]);

    await typeSearch(page, "cose di Laura");
    await expect(titlesOf(page, "todo")).toHaveText(["Pane per Laura"]);
    await expect
      .poll(() => groupKinds(page))
      .toEqual(isMobile() ? ["todo"] : ["todo", "azioni"]);

    await expect.poll(() => search.answers.length).toBeGreaterThanOrEqual(3);
    expect(leaked(search.answers, ["Anna", "regalo", "abbonamento"])).toEqual(
      [],
    );
    await expect(surface(page).getByText("Nuoto con Anna")).toHaveCount(0);
  });

  test("CA-30: un «Occupato» di Laura non si trova per testo: né riga, né conteggio, né titolo nelle risposte", async ({
    page,
    baseURL,
    nest,
  }) => {
    await createEvent(nest, "Marco", {
      title: NUOTO,
      day: T,
      from: "17:00",
      to: "18:30",
      members: ["Sofia"],
    });
    await createEvent(nest, "Laura", {
      title: "Nuoto Laura",
      day: SAT,
      from: "10:00",
      to: "11:00",
      visibility: "busy",
      members: ["Laura"],
    });
    await openSearch(page, baseURL, nest);
    const search = recordSearch(page);
    await typeSearch(page, "nuoto");

    await expect(titlesOf(page, "event")).toHaveText([NUOTO]);
    await expect(surface(page).getByText("Laura ha un impegno")).toHaveCount(0);
    await expect(surface(page).getByText("Nuoto Laura")).toHaveCount(0);
    if (isMobile()) {
      await expect
        .poll(() => chipTexts(page))
        .toEqual(["Tutto 1", "Impegni 1"]);
    }
    await expect.poll(() => search.answers.length).toBeGreaterThan(0);
    expect(leaked(search.answers, ["Nuoto Laura"])).toEqual([]);
    const startMs = instant(SAT, "10:00").getTime();
    for (const answer of search.answers) {
      const rows = JSON.parse(answer) as { starts_at: string | null }[];
      expect(
        rows.some(
          (row) =>
            row.starts_at && new Date(row.starts_at).getTime() === startMs,
        ),
      ).toBe(false);
    }
  });

  test("CA-31: con «questo weekend» e «cose di Laura» compare «Laura ha un impegno», senza titolo e non apribile", async ({
    page,
    baseURL,
    nest,
  }) => {
    await createEvent(nest, "Laura", {
      title: "Nuoto Laura",
      day: SAT,
      from: "10:00",
      to: "11:00",
      visibility: "busy",
      members: ["Laura"],
    });
    await openSearch(page, baseURL, nest);
    const search = recordSearch(page);

    for (const text of ["questo weekend", "cose di Laura"]) {
      await typeSearch(page, text);
      const row = rowsOf(page, "event");
      await expect(row, text).toHaveCount(1);
      await expect(row.locator(".riga-lista__titolo")).toHaveText(
        "Laura ha un impegno",
      );
      await expect(row.locator(".riga-lista__info")).toHaveText(
        "10:00 – 11:00",
      );
      await expect(row.locator(".avatar.membro-glicine")).toHaveCount(1);
      await expect(row.locator("a, button, [tabindex]")).toHaveCount(0);
      expect(await row.evaluate((element) => element.tagName)).not.toBe("A");
      for (let press = 0; press < 8; press++) {
        await page.keyboard.press("Tab");
        expect(
          await row.evaluate((element) =>
            element.contains(document.activeElement),
          ),
        ).toBe(false);
      }
      expect(await page.content()).not.toContain("Nuoto Laura");
    }
    await expect.poll(() => search.answers.length).toBeGreaterThan(0);
    expect(leaked(search.answers, ["Nuoto Laura"])).toEqual([]);
  });

  test("CA-32: un «Solo io» di Laura a cui Marco partecipa si vede per intero, con il link e «Visibile solo a te»", async ({
    page,
    baseURL,
    nest,
  }) => {
    const id = await createEvent(nest, "Laura", {
      title: "Nuoto insieme",
      day: SAT,
      from: "10:00",
      to: "11:00",
      visibility: "private",
      members: ["Laura", "Marco"],
    });
    await openSearch(page, baseURL, nest);
    await typeSearch(page, "nuoto");
    const row = rowsOf(page, "event");
    await expect(row).toHaveCount(1);
    await expect(row).toHaveAttribute("href", new RegExp(`^/impegni/${id}\\?`));
    await expect(row).toContainText("Visibile solo a te");
    await expect(row.locator(".riga-lista__titolo")).toContainText(
      "Nuoto insieme",
    );
  });

  test("CA-33: Marco non vede nulla del Nest B (nemmeno come persona); Giulia non vede nulla del Nest A", async ({
    page,
    baseURL,
    browser,
    nest,
    bianchi,
  }) => {
    await seedNuoto(nest);
    await createEvent(bianchi, "Giulia", {
      title: "Nuoto Leo",
      day: T,
      from: "17:00",
      to: "18:00",
      members: ["Leo"],
    });
    await bianchi.todo("Giulia", { title: "Nuoto compiti", due: d(2) });
    await bianchi.deadline("Giulia", {
      title: "Nuoto abbonamento Leo",
      due: d(3),
    });
    await bianchi.shopping("Giulia", ["Nuoto cuffie"]);
    const nestB = [
      "Nuoto Leo",
      "Nuoto compiti",
      "Nuoto abbonamento Leo",
      "Nuoto cuffie",
    ];
    const nestA = [NUOTO, "Comprare la cuffia da nuoto", ISCRIZIONE];

    await openSearch(page, baseURL, nest);
    await typeSearch(page, "nuoto");
    await expect(rowsOf(page, "event").first()).toBeVisible();
    for (const title of nestB) {
      await expect(surface(page).getByText(title), title).toHaveCount(0);
    }
    if (isMobile()) {
      for (const name of ["Giulia", "Paolo", "Leo", "Anna"]) {
        await expect(
          page
            .getByTestId("ricerca-persone")
            .getByRole("button", { name, exact: true }),
        ).toHaveCount(0);
      }
    }

    const viewport = page.viewportSize();
    const other = await browser.newContext({
      locale: "it-IT",
      timezoneId: "Europe/Rome",
      ...(viewport ? { viewport } : {}),
    });
    try {
      const pageB = await other.newPage();
      await openSearch(pageB, baseURL, bianchi, { who: "Giulia" });
      await typeSearch(pageB, "nuoto");
      await expect(rowsOf(pageB, "event").first()).toBeVisible();
      await expect(surface(pageB).getByText("Nuoto Leo")).toBeVisible();
      for (const title of nestA) {
        await expect(surface(pageB).getByText(title), title).toHaveCount(0);
      }
    } finally {
      await other.close();
    }
  });

  test("CA-34: la funzione del database con una persona del Nest B dà 0 righe e nessun errore", async ({
    nest,
    bianchi,
  }) => {
    await seedNuoto(nest);
    const marco = nest.users["Marco"]!.client;

    const own = await marco.rpc("search_household", {
      p_member_id: nest.members["Sofia"],
    });
    expect(own.error).toBeNull();
    expect((own.data as unknown[]).length).toBeGreaterThan(0);

    const foreign = await marco.rpc("search_household", {
      p_member_id: bianchi.members["Leo"],
    });
    expect(foreign.error).toBeNull();
    expect(foreign.data).toEqual([]);
  });

  test("CA-35: il testo cercato non finisce in nessun indirizzo e le richieste di ricerca sono POST", async ({
    page,
    baseURL,
    nest,
  }) => {
    await seedNuoto(nest);
    const urls: string[] = [];
    page.on("request", (request) => urls.push(request.url()));
    page.on("framenavigated", (frame) => urls.push(frame.url()));
    const search = recordSearch(page);

    await openSearch(page, baseURL, nest);
    await typeSearch(page, "nuoto");
    await expect(rowsOf(page, "event")).toHaveCount(3);
    await rowsOf(page, "event").first().click();
    await expect(page).toHaveURL(/\/impegni\//);

    expect(urls.filter((url) => url.toLowerCase().includes("nuoto"))).toEqual(
      [],
    );
    const real = search.calls.filter((call) => call.method !== "OPTIONS");
    expect(real.length).toBeGreaterThan(0);
    expect(real.map((call) => call.method)).toEqual(real.map(() => "POST"));
    expect(real.some((call) => call.body.includes("nuoto"))).toBe(true);
  });
});
