import { test as plain, type Locator, type Page } from "@playwright/test";
import {
  alertColor,
  alerts,
  at1552,
  addDays,
  busy,
  capitalise,
  colorOf,
  column,
  CORS,
  expect,
  farDeadline,
  filterGroup,
  isMobileProject,
  lastTuesday,
  monthName,
  dayNumber,
  OFFLINE_ALERT,
  pauseClock,
  SAVE_FAILED,
  setClock,
  switcher,
  switcherVoice,
  test,
  type CasaNest,
  type Day,
} from "../fixtures/casa";
import { signInAs, skipReason, usersConfigured } from "../fixtures/auth";

// Casa · Da fare (#23): one test for every acceptance criterion (CA-1 ... CA-42)
// plus a few extras from the designer's specification.
//
// Roles and texts are those of the requirement and of the specification in the
// issue, checked against the code of PR #127. Every test that touches data
// uses its own throwaway Nest (fixtures/casa.ts): desktop and mobile never meet
// on the same rows. The seed users A, B, B2 and C are not used for writing.
//
// [OR] criteria: the browser clock is set at T = the most recent Tuesday at
// 15:52 Europe/Rome and then stopped, so the toast (5 s) and the 600 ms wait
// move only with `page.clock.runFor`.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

const PATH = "/casa/da-fare";
const TOAST_MS = 5100;
const T: Day = lastTuesday();
const d = (n: number): Day => addDays(T, n);

// ------------------------------------------------------------------ locators

const col = (page: Page) => column(page, "Da fare");
const group = (page: Page, name: string) =>
  col(page)
    .locator("section.sezione")
    .filter({ has: page.getByRole("heading", { level: 3, name }) });
const groupInfo = (page: Page, name: string) =>
  group(page, name).locator(".sezione__info").first();
const titles = (scope: Locator) => scope.locator(".riga-lista__titolo");
const rowOf = (page: Page, title: string) =>
  col(page)
    .locator("li.riga-lista")
    .filter({ has: page.locator(".riga-lista__titolo", { hasText: title }) });
const infoOf = (page: Page, title: string) =>
  rowOf(page, title).locator(".riga-lista__info");
const avatarOf = (page: Page, title: string) =>
  rowOf(page, title).locator(".avatar");
const allRows = (page: Page) => col(page).locator("li.riga-lista");
const toast = (page: Page) =>
  page.getByRole("status").filter({ hasText: "Fatto:" });
const chip = (page: Page, name: string) =>
  filterGroup(page).getByRole("button", { name, exact: true });
const quickField = (page: Page) =>
  page.getByRole("textbox", { name: "Aggiungi una cosa da fare…" });
const tick = (page: Page, title: string) =>
  page.getByRole("checkbox", { name: `Segna come fatto: ${title}` });
const untick = (page: Page, title: string) =>
  page.getByRole("checkbox", { name: `Rimetti da fare: ${title}` });

const FIRMARE = "Firmare autorizzazione gita";
const CUFFIA = "Comprare la cuffia da nuoto";
const REGALO = "Regalo per la festa di Giulia";
const BUS = "Rinnovare l'abbonamento del bus";
const CANTINA = "Sistemare la cantina";

/** Dati di base (DB) of the issue, created by Marco in Casa D'Angelo. */
async function seedBase(casa: CasaNest): Promise<void> {
  await casa.todo("Marco", {
    title: FIRMARE,
    forMember: "Sofia",
    assignee: "Marco",
    due: d(3),
  });
  await casa.todo("Marco", {
    title: CUFFIA,
    forMember: "Sofia",
    assignee: "Laura",
    due: d(2),
  });
  await casa.todo("Marco", { title: REGALO, assignee: "Laura", due: d(4) });
  await casa.todo("Marco", { title: BUS, assignee: "Sofia", due: d(13) });
  await casa.todo("Marco", { title: CANTINA });
}

/** Signs in, opens the page (clock set at `time` and stopped) and waits for the list. */
async function open(
  page: Page,
  baseURL: string | undefined,
  casa: CasaNest,
  options: { who?: string; time?: Date; pause?: boolean; ready?: Locator } = {},
): Promise<void> {
  const { who = "Marco", time = at1552(T), pause = true } = options;
  await setClock(page, time);
  await casa.signIn(page, baseURL, who);
  await page.goto(PATH);
  await expect(options.ready ?? col(page)).toBeVisible({ timeout: 20_000 });
  await expect(busy(page)).toHaveCount(0);
  if (pause) await pauseClock(page);
}

/** What the page shows as "open things": selector (mobile) or "N aperti" (desktop). */
async function expectOpenCount(page: Page, n: number): Promise<void> {
  if (isMobileProject()) {
    const count = switcherVoice(page, "Da fare").locator(
      ".selettore__conteggio",
    );
    if (n === 0) await expect(count).toHaveCount(0);
    else await expect(count).toHaveText(String(n));
  } else {
    const info = col(page)
      .locator(".sezione__testa")
      .first()
      .locator(".sezione__info");
    if (n === 0) await expect(info).toHaveCount(0);
    else await expect(info).toHaveText(n === 1 ? "1 aperto" : `${n} aperti`);
  }
}

async function expectChips(page: Page, names: string[]): Promise<void> {
  const buttons = filterGroup(page).getByRole("button");
  await expect(buttons).toHaveCount(names.length);
  for (const [index, name] of names.entries()) {
    await expect(buttons.nth(index)).toHaveAccessibleName(name);
  }
}

async function doneAtOf(casa: CasaNest, title: string) {
  const rows = await casa.todoRows();
  return rows.find((row) => row.title === title)?.done_at ?? null;
}

/** Makes every request to the matching REST path fail with a database error (not a network error). */
async function failReads(page: Page, pattern: RegExp): Promise<void> {
  await page.route(pattern, async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      headers: CORS,
      body: JSON.stringify({
        code: "XX000",
        message: "boom internal detail",
      }),
    });
  });
}

// ------------------------------------------------------- access and structure

plain.describe("accesso", () => {
  plain(
    "CA-1: senza sessione /casa/da-fare porta a /accesso",
    async ({ page }) => {
      await page.goto(PATH);
      await expect(page).toHaveURL(/\/accesso$/);
    },
  );

  plain(
    "CA-2: l'utente C, senza Nest, viene portato su /onboarding",
    async ({ page, baseURL }) => {
      plain.skip(!usersConfigured("C"), skipReason("C"));
      await signInAs(page.context(), baseURL as string, "C");
      await page.goto(PATH);
      await expect(page).toHaveURL(/\/onboarding$/);
    },
  );
});

test.describe("struttura", () => {
  test("CA-3: titolo della scheda, un solo h1, selettore e voce Casa attiva (mobile)", async ({
    page,
    baseURL,
    casa,
  }) => {
    test.skip(!isMobileProject(), "Il selettore c'è solo su mobile (390 px)");
    await open(page, baseURL, casa, { pause: false });
    await expect(page).toHaveTitle("FamilyNest · Casa · Da fare");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Casa");
    await expect(switcher(page).locator(".selettore__voce")).toHaveText([
      /^Spesa/,
      /^Da fare/,
      /^Scadenze/,
    ]);
    await expect(
      switcher(page).getByRole("button", { name: /^Da fare/ }),
    ).toHaveAttribute("aria-pressed", "true");
    // The criterion writes aria-current="page", but the rule of the frame
    // (#67, tests/e2e/correzioni-proposte.spec.ts CA-23) gives "page" only to
    // /oggi, /calendario and /casa/spesa: a related page like this one is
    // highlighted with "true". The voice is the current one all the same.
    const current = page
      .getByRole("navigation", { name: "Navigazione principale" })
      .locator("[aria-current]");
    await expect(current).toHaveText(/Casa/);
    await expect(current).toHaveAttribute("aria-current", "true");
  });

  test("CA-4: dal selettore si va a Spesa e a Scadenze (mobile)", async ({
    page,
    baseURL,
    casa,
  }) => {
    test.skip(!isMobileProject(), "Il selettore c'è solo su mobile (390 px)");
    await open(page, baseURL, casa, { pause: false });
    await switcher(page)
      .getByRole("link", { name: /^Spesa/ })
      .click();
    await expect(page).toHaveURL(/\/casa\/spesa$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/casa\/da-fare$/);
    await expect(col(page)).toBeVisible();
    await switcher(page)
      .getByRole("link", { name: /^Scadenze/ })
      .click();
    await expect(page).toHaveURL(/\/casa\/scadenze$/);
  });

  test("CA-5: su desktop nome del Nest sopra l'h1, filtro, tre regioni e nessun selettore", async ({
    page,
    baseURL,
    casa,
  }) => {
    test.skip(isMobileProject(), "Caso a 1280 px");
    await open(page, baseURL, casa, { pause: false });
    const main = page.getByRole("main");
    const nestName = main.getByText("Casa D'Angelo", { exact: true });
    const h1 = page.getByRole("heading", { level: 1, name: "Casa" });
    await expect(nestName).toBeVisible();
    await expect(h1).toBeVisible();
    const nameBox = (await nestName.boundingBox())!;
    const h1Box = (await h1.boundingBox())!;
    expect(nameBox.y).toBeLessThan(h1Box.y);
    await expect(filterGroup(page)).toBeVisible();
    await expect(column(page, "Spesa")).toBeVisible();
    await expect(col(page)).toBeVisible();
    await expect(
      col(page).getByRole("heading", { level: 2, name: "Da fare" }),
    ).toBeVisible();
    await expect(column(page, "Scadenze")).toBeVisible();
    await expect(switcher(page)).toHaveCount(0);
  });

  test("CA-6: su desktop /casa/spesa mostra la colonna «Da fare» con le stesse 5 righe", async ({
    page,
    baseURL,
    casa,
  }) => {
    test.skip(isMobileProject(), "Caso a 1280 px");
    await seedBase(casa);
    await setClock(page, at1552(T));
    await casa.signIn(page, baseURL, "Marco");
    await page.goto("/casa/spesa");
    await expect(col(page)).toBeVisible({ timeout: 20_000 });
    await expect(allRows(page)).toHaveCount(5);
    await expect(col(page)).not.toContainText("In arrivo");
    await page.goto(PATH);
    await expect(allRows(page)).toHaveCount(5);
  });

  test("CA-7: i numeri del selettore: Spesa 3, Da fare 5 (mobile)", async ({
    page,
    baseURL,
    casa,
  }) => {
    test.skip(!isMobileProject(), "Il selettore c'è solo su mobile (390 px)");
    await seedBase(casa);
    await casa.shopping("Marco", ["Latte", "Pane", "Uova"]);
    await open(page, baseURL, casa, { pause: false });
    await expect(
      switcherVoice(page, "Spesa").locator(".selettore__conteggio"),
    ).toHaveText("3");
    await expect(
      switcherVoice(page, "Da fare").locator(".selettore__conteggio"),
    ).toHaveText("5");
  });
});

// ------------------------------------------------------- groups, order, texts

test.describe("gruppi, ordine e testi", () => {
  test("CA-8: «Questa settimana» (3) e «Più avanti» (2) in ordine, nessun «Fatti»", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seedBase(casa);
    await open(page, baseURL, casa);
    await expect(groupInfo(page, "Questa settimana")).toHaveText("3");
    await expect(titles(group(page, "Questa settimana"))).toHaveText([
      CUFFIA,
      FIRMARE,
      REGALO,
    ]);
    await expect(groupInfo(page, "Più avanti")).toHaveText("2");
    await expect(titles(group(page, "Più avanti"))).toHaveText([BUS, CANTINA]);
    await expect(
      page.getByRole("heading", { level: 3, name: "Fatti" }),
    ).toHaveCount(0);
  });

  test("CA-9: informazioni e avatar delle cinque righe", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seedBase(casa);
    await open(page, baseURL, casa);
    const weekday = (n: number) =>
      new Intl.DateTimeFormat("it-IT", {
        weekday: "long",
        timeZone: "UTC",
      }).format(new Date(`${d(n)}T12:00:00Z`));
    await expect(infoOf(page, CUFFIA)).toHaveText(
      `Per Sofia, entro ${weekday(2)}`,
    );
    await expect(infoOf(page, FIRMARE)).toHaveText(
      `Per Sofia, entro ${weekday(3)}`,
    );
    await expect(infoOf(page, REGALO)).toHaveText(
      capitalise(`entro ${weekday(4)}`),
    );
    await expect(infoOf(page, BUS)).toHaveText(
      capitalise(farDeadline(T, d(13))),
    );
    await expect(infoOf(page, CANTINA)).toHaveCount(0);
    await expect(avatarOf(page, CUFFIA)).toHaveText("L");
    await expect(avatarOf(page, FIRMARE)).toHaveText("M");
    await expect(avatarOf(page, REGALO)).toHaveText("L");
    await expect(avatarOf(page, BUS)).toHaveText("S");
    await expect(avatarOf(page, CANTINA)).toHaveCount(0);
  });

  test("CA-10: rosso entro 3 giorni: Cuffia e Firmare sì, Regalo e Rinnovare no", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seedBase(casa);
    await open(page, baseURL, casa);
    const red = await alertColor(page);
    expect(await colorOf(infoOf(page, CUFFIA))).toBe(red);
    expect(await colorOf(infoOf(page, FIRMARE))).toBe(red);
    expect(await colorOf(infoOf(page, REGALO))).not.toBe(red);
    expect(await colorOf(infoOf(page, BUS))).not.toBe(red);
  });

  test("CA-11: le scadute stanno in cima a «Questa settimana», in rosso", async ({
    page,
    baseURL,
    casa,
  }) => {
    const items: [string, number][] = [
      ["Pagare la bolletta", -5],
      ["Ritirare il pacco", -1],
      ["Chiamare l'idraulico", 0],
      ["Portare fuori il vetro", 1],
    ];
    for (const [title, n] of items) {
      await casa.todo("Marco", { title, due: d(n) });
    }
    await open(page, baseURL, casa);
    await expect(titles(group(page, "Questa settimana"))).toHaveText(
      items.map(([title]) => title),
    );
    await expect(group(page, "Più avanti")).toHaveCount(0);
    const infos = [
      `Scaduto il ${dayNumber(d(-5))} ${monthName(d(-5))}`,
      "Scaduto ieri",
      "Entro oggi",
      "Entro domani",
    ];
    const red = await alertColor(page);
    for (const [index, [title]] of items.entries()) {
      await expect(infoOf(page, title)).toHaveText(infos[index]!);
      expect(await colorOf(infoOf(page, title))).toBe(red);
    }
  });

  test("CA-12: domenica è ancora «Questa settimana», lunedì è «Più avanti»", async ({
    page,
    baseURL,
    casa,
  }) => {
    await casa.todo("Marco", { title: "Lavare le tende", due: d(5) });
    await casa.todo("Marco", { title: "Cambiare le lenzuola", due: d(6) });
    await open(page, baseURL, casa);
    await expect(titles(group(page, "Questa settimana"))).toHaveText([
      "Lavare le tende",
    ]);
    await expect(infoOf(page, "Lavare le tende")).toHaveText("Entro domenica");
    await expect(titles(group(page, "Più avanti"))).toHaveText([
      "Cambiare le lenzuola",
    ]);
    await expect(infoOf(page, "Cambiare le lenzuola")).toHaveText(
      capitalise(farDeadline(T, d(6))),
    );
  });

  test("CA-13: «Entro fine mese», «Entro fine novembre», «Entro 15 gennaio 2027»", async ({
    page,
    baseURL,
    casa,
  }) => {
    const fixed = new Date("2026-10-20T13:52:00Z"); // martedì 20 ottobre 2026, 15:52 a Roma
    await casa.todo("Marco", {
      title: "Rinnovare il filtro",
      due: "2026-10-31",
    });
    await casa.todo("Marco", { title: "Pulire la caldaia", due: "2026-11-30" });
    await casa.todo("Marco", {
      title: "Sostituire il tappeto",
      due: "2027-01-15",
    });
    await open(page, baseURL, casa, { time: fixed });
    await expect(titles(group(page, "Più avanti"))).toHaveText([
      "Rinnovare il filtro",
      "Pulire la caldaia",
      "Sostituire il tappeto",
    ]);
    await expect(infoOf(page, "Rinnovare il filtro")).toHaveText(
      "Entro fine mese",
    );
    await expect(infoOf(page, "Pulire la caldaia")).toHaveText(
      "Entro fine novembre",
    );
    await expect(infoOf(page, "Sostituire il tappeto")).toHaveText(
      "Entro 15 gennaio 2027",
    );
  });

  test("CA-14: «Fatti» mostra solo gli ultimi 7 giorni, l'ultima fatta in cima", async ({
    page,
    baseURL,
    casa,
  }) => {
    const day = 24 * 60 * 60 * 1000;
    const t = at1552(T).getTime();
    await casa.todo("Marco", {
      title: "Pagare la rata",
      assignee: "Marco",
      doneAt: new Date(t - day),
    });
    await casa.todo("Marco", {
      title: "Spostare i vasi",
      doneAt: new Date(t - 3 * day),
    });
    await casa.todo("Marco", {
      title: "Pulire il balcone",
      doneAt: new Date(t - 8 * day),
    });
    await open(page, baseURL, casa);
    await expect(groupInfo(page, "Fatti")).toHaveText("ultimi 7 giorni");
    await expect(titles(group(page, "Fatti"))).toHaveText([
      "Pagare la rata",
      "Spostare i vasi",
    ]);
    await expect(infoOf(page, "Pagare la rata")).toHaveText(
      "Fatto da Marco, ieri",
    );
    await expect(infoOf(page, "Spostare i vasi")).toHaveText(
      `Fatto da Marco, sabato ${dayNumber(d(-3))}`,
    );
    await expect(untick(page, "Pagare la rata")).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(untick(page, "Spostare i vasi")).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(avatarOf(page, "Pagare la rata")).toHaveText("M");
    await expect(page.getByText("Pulire il balcone")).toHaveCount(0);
  });

  test("CA-15: se tutto scade oltre domenica, «Questa settimana» non c'è", async ({
    page,
    baseURL,
    casa,
  }) => {
    await casa.todo("Marco", { title: "Cambiare le gomme", due: d(8) });
    await casa.todo("Marco", { title: "Rifare il tetto", due: d(20) });
    await open(page, baseURL, casa);
    await expect(
      page.getByRole("heading", { level: 3, name: "Questa settimana" }),
    ).toHaveCount(0);
    await expect(group(page, "Più avanti")).toBeVisible();
  });
});

// ----------------------------------------------------------------- «Solo io»

test.describe("«Solo io»", () => {
  test("CA-16: la cosa «Solo io» ha «solo tu», il lucchetto e l'avatar di chi se ne occupa", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await bianchi.todo("Paolo", {
      title: "Prenotare il ristorante",
      priv: true,
      assignee: "Paolo",
      due: d(1),
    });
    await open(page, baseURL, bianchi, { who: "Paolo" });
    await expect(infoOf(page, "Prenotare il ristorante")).toHaveText(
      "Entro domani, solo tu",
    );
    await expect(
      rowOf(page, "Prenotare il ristorante").getByTestId("lucchetto"),
    ).toHaveCount(1);
    await expect(avatarOf(page, "Prenotare il ristorante")).toHaveText("P");
  });

  test("CA-17: Giulia non vede la cosa di Paolo: stato vuoto e nessun numero", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await bianchi.todo("Paolo", {
      title: "Prenotare il ristorante",
      priv: true,
      assignee: "Paolo",
      due: d(1),
    });
    await open(page, baseURL, bianchi, { who: "Giulia" });
    await expect(page.getByText("Prenotare il ristorante")).toHaveCount(0);
    await expect(
      page.getByText("Niente da fare, per ora", { exact: true }),
    ).toBeVisible();
    await expectOpenCount(page, 0);
  });

  test("CA-18: via API Giulia non legge, non segna fatta e non cambia la cosa di Paolo", async ({
    bianchi,
  }) => {
    const id = await bianchi.todo("Paolo", {
      title: "Prenotare il ristorante",
      priv: true,
      assignee: "Paolo",
      due: d(1),
    });
    const giulia = bianchi.users["Giulia"]!.client;
    const read = await giulia.from("todos").select("id").eq("id", id);
    expect(read.error).toBeNull();
    expect(read.data).toHaveLength(0);
    const done = await giulia
      .from("todos")
      .update({ done_at: new Date().toISOString() }, { count: "exact" })
      .eq("id", id);
    expect(done.count ?? 0).toBe(0);
    const renamed = await giulia
      .from("todos")
      .update({ title: "Cambiata" }, { count: "exact" })
      .eq("id", id);
    expect(renamed.count ?? 0).toBe(0);
    const row = (await bianchi.todoRows()).find((r) => r.id === id);
    expect(row?.title).toBe("Prenotare il ristorante");
    expect(row?.done_at).toBeNull();
  });
});

// ------------------------------------------------------ mark done and undo

test.describe("segnare fatto e annullare", () => {
  test("CA-19: toccare la casella la riempie subito, la riga resta al suo posto e compare il toast", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seedBase(casa);
    await open(page, baseURL, casa);
    await tick(page, FIRMARE).click();
    const done = untick(page, FIRMARE);
    await expect(done).toHaveAttribute("aria-checked", "true");
    await expect(
      group(page, "Questa settimana").getByRole("checkbox", {
        name: `Rimetti da fare: ${FIRMARE}`,
      }),
    ).toBeVisible();
    await expectOpenCount(page, 4);
    await expect(toast(page)).toContainText(`Fatto: ${FIRMARE}.`);
    await expect(
      toast(page).getByRole("button", { name: "Annulla" }),
    ).toBeVisible();
  });

  test("CA-20: dopo 5 secondi il toast sparisce e la riga è la prima di «Fatti», anche dopo il ricaricamento", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seedBase(casa);
    await open(page, baseURL, casa);
    await tick(page, FIRMARE).click();
    await expect(toast(page)).toBeVisible();
    await page.clock.runFor(TOAST_MS);
    await expect(toast(page)).toHaveCount(0);
    await expect(titles(group(page, "Fatti")).first()).toHaveText(FIRMARE);
    await expect(infoOf(page, FIRMARE)).toHaveText("Fatto da Marco, oggi");
    await expect.poll(() => doneAtOf(casa, FIRMARE)).not.toBeNull();
    await page.goto(PATH);
    await expect(titles(group(page, "Fatti")).first()).toHaveText(FIRMARE);
    await expect(infoOf(page, FIRMARE)).toHaveText("Fatto da Marco, oggi");
  });

  test("CA-21: «Annulla» rimette la riga da fare al suo posto, il numero torna 5 e il database non cambia", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seedBase(casa);
    await open(page, baseURL, casa);
    await tick(page, FIRMARE).click();
    await toast(page).getByRole("button", { name: "Annulla" }).click();
    await expect(toast(page)).toHaveCount(0);
    await expect(tick(page, FIRMARE)).toHaveAttribute("aria-checked", "false");
    await expect(titles(group(page, "Questa settimana"))).toHaveText([
      CUFFIA,
      FIRMARE,
      REGALO,
    ]);
    await expectOpenCount(page, 5);
    // Nothing else is announced: no second toast.
    await expect(
      page.getByRole("status").filter({ hasText: /\S/ }),
    ).toHaveCount(0);
    await expect.poll(() => doneAtOf(casa, FIRMARE)).toBeNull();
    await page.goto(PATH);
    await expect(group(page, "Questa settimana")).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 3, name: "Fatti" }),
    ).toHaveCount(0);
  });

  test("CA-22: «Rimetti da fare» riporta la riga nel suo gruppo, senza toast", async ({
    page,
    baseURL,
    casa,
  }) => {
    await casa.todo("Marco", {
      title: FIRMARE,
      forMember: "Sofia",
      assignee: "Marco",
      due: d(3),
      doneAt: new Date(at1552(T).getTime() - 24 * 60 * 60 * 1000),
    });
    await casa.todo("Marco", {
      title: CUFFIA,
      forMember: "Sofia",
      assignee: "Laura",
      due: d(2),
    });
    await open(page, baseURL, casa);
    await expect(titles(group(page, "Fatti"))).toHaveText([FIRMARE]);
    await untick(page, FIRMARE).click();
    await expect(tick(page, FIRMARE)).toHaveAttribute("aria-checked", "false");
    await page.clock.runFor(700);
    await expect(titles(group(page, "Questa settimana"))).toHaveText([
      CUFFIA,
      FIRMARE,
    ]);
    await expect(infoOf(page, FIRMARE)).not.toContainText("Fatto da");
    await expect(toast(page)).toHaveCount(0);
    await expect(
      page.getByRole("heading", { level: 3, name: "Fatti" }),
    ).toHaveCount(0);
    await expect.poll(() => doneAtOf(casa, FIRMARE)).toBeNull();
    await page.goto(PATH);
    await expect(titles(group(page, "Questa settimana"))).toHaveText([
      CUFFIA,
      FIRMARE,
    ]);
  });

  test("CA-23: Giulia segna fatta una cosa di Paolo e Paolo la vede in «Fatti» come fatta da Giulia", async ({
    page,
    browser,
    baseURL,
    bianchi,
  }, testInfo) => {
    await bianchi.todo("Paolo", {
      title: "Portare giù il cartone",
      assignee: "Paolo",
    });
    // Real time here: only the 5 s of the toast are moved by hand.
    await setClock(page, new Date());
    await bianchi.signIn(page, baseURL, "Giulia");
    await page.goto(PATH);
    await expect(col(page)).toBeVisible({ timeout: 20_000 });
    await pauseClock(page);
    await tick(page, "Portare giù il cartone").click();
    await page.clock.runFor(TOAST_MS);
    await expect(toast(page)).toHaveCount(0);
    await expect
      .poll(() => doneAtOf(bianchi, "Portare giù il cartone"))
      .not.toBeNull();

    const context = await browser.newContext({
      baseURL,
      viewport: testInfo.project.use.viewport ?? undefined,
      locale: "it-IT",
      timezoneId: "Europe/Rome",
    });
    try {
      const second = await context.newPage();
      await bianchi.signInContext(context, baseURL, "Paolo");
      await second.goto(PATH);
      await expect(col(second)).toBeVisible({ timeout: 20_000 });
      await expect(titles(group(second, "Fatti"))).toHaveText([
        "Portare giù il cartone",
      ]);
      await expect(infoOf(second, "Portare giù il cartone")).toHaveText(
        "Fatto da Giulia, oggi",
      );
    } finally {
      await context.close();
    }
  });
});

// ------------------------------------------------------------------- filters

test.describe("filtri", () => {
  test("CA-24: chip di Marco: Tutti, Miei, Laura, Sofia, Tommaso (niente Biscotto)", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seedBase(casa);
    await open(page, baseURL, casa, { pause: false });
    await expectChips(page, ["Tutti", "Miei", "Laura", "Sofia", "Tommaso"]);
    await expect(chip(page, "Biscotto")).toHaveCount(0);
    await expect(chip(page, "Tutti")).toHaveAttribute("aria-pressed", "true");
  });

  test("CA-25: chip di Giulia: Tutti, Miei, Paolo, Leo, Anna", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await bianchi.todo("Giulia", { title: "Svuotare la lavastoviglie" });
    await open(page, baseURL, bianchi, { who: "Giulia", pause: false });
    await expectChips(page, ["Tutti", "Miei", "Paolo", "Leo", "Anna"]);
  });

  test("CA-26: Laura, poi Miei, poi Tutti filtrano le righe e non cambiano il numero", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seedBase(casa);
    await open(page, baseURL, casa);
    await chip(page, "Laura").click();
    await expect(chip(page, "Laura")).toHaveAttribute("aria-pressed", "true");
    await expect(chip(page, "Tutti")).toHaveAttribute("aria-pressed", "false");
    await expect(allRows(page)).toHaveCount(2);
    await expect(titles(group(page, "Questa settimana"))).toHaveText([
      CUFFIA,
      REGALO,
    ]);
    await expect(groupInfo(page, "Questa settimana")).toHaveText("2");
    await expect(
      page.getByRole("heading", { level: 3, name: "Più avanti" }),
    ).toHaveCount(0);
    await expectOpenCount(page, 5);
    await chip(page, "Miei").click();
    await expect(allRows(page)).toHaveCount(1);
    await expect(titles(col(page))).toHaveText([FIRMARE]);
    await chip(page, "Tutti").click();
    await expect(allRows(page)).toHaveCount(5);
  });

  test("CA-27: con una cosa fatta, «Miei» mostra «Fatti» e «Laura» no", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seedBase(casa);
    await casa.todo("Marco", {
      title: "Pagare la rata",
      assignee: "Marco",
      doneAt: new Date(at1552(T).getTime() - 60 * 60 * 1000),
    });
    await open(page, baseURL, casa);
    await chip(page, "Miei").click();
    await expect(titles(group(page, "Fatti"))).toHaveText(["Pagare la rata"]);
    await chip(page, "Laura").click();
    await expect(
      page.getByRole("heading", { level: 3, name: "Fatti" }),
    ).toHaveCount(0);
  });

  test("CA-28: «Tommaso» non ha righe: compare il messaggio del filtro senza risultati", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seedBase(casa);
    await open(page, baseURL, casa);
    await chip(page, "Tommaso").click();
    await expect(allRows(page)).toHaveCount(0);
    // CA-28 follows the designer's specification (section 3.6), confirmed by
    // the coordinator on 30/10: «Niente da fare per Tommaso» and the button
    // «Mostra tutte le cose da fare», not «Nessuna cosa da fare per Tommaso.».
    await expect(col(page)).toContainText("Niente da fare per Tommaso");
    await expect(
      col(page).getByRole("button", { name: "Mostra tutte le cose da fare" }),
    ).toBeVisible();
    await expect(
      col(page).getByText("Qui compaiono le cose di cui si occupa Tommaso."),
    ).toBeVisible();
    // The button brings back «Tutti» and its five rows, focus on the chip.
    await col(page)
      .getByRole("button", { name: "Mostra tutte le cose da fare" })
      .click();
    await expect(chip(page, "Tutti")).toHaveAttribute("aria-pressed", "true");
    await expect(chip(page, "Tutti")).toBeFocused();
    await expect(allRows(page)).toHaveCount(5);
  });

  test("CA-29: ricaricando il filtro riparte da «Tutti» e l'indirizzo resta senza parametri", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seedBase(casa);
    await open(page, baseURL, casa);
    await chip(page, "Laura").click();
    await expect(allRows(page)).toHaveCount(2);
    await page.reload();
    await expect(col(page)).toBeVisible();
    await expect(chip(page, "Tutti")).toHaveAttribute("aria-pressed", "true");
    await expect(allRows(page)).toHaveCount(5);
    expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe(
      PATH,
    );
  });

  test("CA-30: su desktop il filtro cambia solo la colonna «Da fare»", async ({
    page,
    baseURL,
    casa,
  }) => {
    test.skip(isMobileProject(), "Caso a 1280 px");
    await seedBase(casa);
    await casa.shopping("Marco", ["Latte", "Pane"]);
    await open(page, baseURL, casa);
    const spesaTitles = titles(column(page, "Spesa"));
    await expect(spesaTitles).toHaveText(["Latte", "Pane"]);
    await chip(page, "Laura").click();
    await expect(allRows(page)).toHaveCount(2);
    await expect(spesaTitles).toHaveText(["Latte", "Pane"]);
  });
});

// --------------------------------------------------------------- empty state

test.describe("stato vuoto", () => {
  test("CA-31: senza cose da fare (mobile): messaggio, bottone, niente chip né numero", async ({
    page,
    baseURL,
    casa,
  }) => {
    test.skip(!isMobileProject(), "Caso a 390 px");
    await open(page, baseURL, casa, {
      pause: false,
      ready: page.getByText("Niente da fare, per ora", { exact: true }),
    });
    await expect(
      page.getByText("Niente da fare, per ora", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Le cose da fare della casa compaiono qui, con chi se ne occupa e per quando.",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Aggiungi una cosa da fare" }),
    ).toBeVisible();
    await expect(filterGroup(page)).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 3 })).toHaveCount(0);
    await expectOpenCount(page, 0);
  });

  test("CA-32: senza cose da fare (desktop): stesso messaggio, senza «N aperti», con i chip", async ({
    page,
    baseURL,
    casa,
  }) => {
    test.skip(isMobileProject(), "Caso a 1280 px");
    await open(page, baseURL, casa, {
      pause: false,
      ready: page.getByText("Niente da fare, per ora", { exact: true }),
    });
    await expect(col(page)).toContainText("Niente da fare, per ora");
    await expect(col(page)).toContainText(
      "Le cose da fare della casa compaiono qui, con chi se ne occupa e per quando.",
    );
    await expectOpenCount(page, 0);
    await expect(filterGroup(page)).toBeVisible();
  });

  test("CA-33: «Aggiungi una cosa da fare» porta dove porta «Aggiungi» della navigazione", async ({
    page,
    baseURL,
    casa,
  }) => {
    await open(page, baseURL, casa, {
      pause: false,
      ready: page.getByText("Niente da fare, per ora", { exact: true }),
    });
    // Today the target is /aggiungi; #22 will open Aggiungi with the type
    // Da fare already chosen and will update this line.
    await page
      .getByRole("link", { name: "Aggiungi una cosa da fare", exact: true })
      .click();
    await expect(page).toHaveURL(/\/aggiungi/);
  });

  test("CA-34: con una sola cosa fatta ieri non c'è lo stato vuoto e si vede solo «Fatti»", async ({
    page,
    baseURL,
    casa,
  }) => {
    await casa.todo("Marco", {
      title: "Pagare la rata",
      doneAt: new Date(at1552(T).getTime() - 24 * 60 * 60 * 1000),
    });
    await open(page, baseURL, casa);
    await expect(group(page, "Fatti")).toBeVisible();
    await expect(
      page.getByText("Niente da fare, per ora", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { level: 3, name: "Questa settimana" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { level: 3, name: "Più avanti" }),
    ).toHaveCount(0);
  });
});

// --------------------------------------------------------------- quick field

test.describe("campo rapido (desktop)", () => {
  test("CA-35: Invio aggiunge la cosa in fondo a «Più avanti», il campo si svuota e resta a fuoco", async ({
    page,
    baseURL,
    casa,
  }) => {
    test.skip(isMobileProject(), "Il campo rapido c'è solo su desktop");
    await seedBase(casa);
    await open(page, baseURL, casa);
    const field = quickField(page);
    await field.click();
    await field.fill("   Comprare   le lampadine  ");
    await field.press("Enter");
    await expect(titles(group(page, "Più avanti")).last()).toHaveText(
      "Comprare le lampadine",
    );
    await expect(infoOf(page, "Comprare le lampadine")).toHaveCount(0);
    await expect(avatarOf(page, "Comprare le lampadine")).toHaveCount(0);
    await expect(field).toHaveValue("");
    await expect(field).toBeFocused();
    await expectOpenCount(page, 6);
    await expect
      .poll(async () =>
        (await casa.todoRows()).some(
          (r) => r.title === "Comprare le lampadine",
        ),
      )
      .toBe(true);
    await page.goto(PATH);
    await expect(titles(group(page, "Più avanti")).last()).toHaveText(
      "Comprare le lampadine",
    );
  });

  test("CA-36: Invio a campo vuoto o di soli spazi non fa nulla; il campo si ferma a 80 caratteri", async ({
    page,
    baseURL,
    casa,
  }) => {
    test.skip(isMobileProject(), "Il campo rapido c'è solo su desktop");
    await casa.todo("Marco", { title: CANTINA });
    await open(page, baseURL, casa);
    const field = quickField(page);
    await expect(allRows(page)).toHaveCount(1);
    await field.click();
    await field.press("Enter");
    await field.fill("   ");
    await field.press("Enter");
    await expect(allRows(page)).toHaveCount(1);
    await expect(toast(page)).toHaveCount(0);
    await expect(
      page.getByRole("status").filter({ hasText: /\S/ }),
    ).toHaveCount(0);
    await field.fill("");
    await field.pressSequentially("a".repeat(90));
    expect((await field.inputValue()).length).toBe(80);
    expect((await casa.todoRows()).length).toBe(1);
  });

  test("CA-37: su mobile non c'è il campo rapido", async ({
    page,
    baseURL,
    casa,
  }) => {
    test.skip(!isMobileProject(), "Caso a 390 px");
    await seedBase(casa);
    await open(page, baseURL, casa, { pause: false });
    await expect(quickField(page)).toHaveCount(0);
  });
});

// ----------------------------------------------------------------- isolation

test.describe("isolamento tra Nest", () => {
  test("CA-38: Marco non vede né tocca le cose di Casa Bianchi", async ({
    page,
    baseURL,
    casa,
    bianchi,
  }) => {
    await casa.todo("Marco", { title: CANTINA });
    const foreignId = await bianchi.todo("Giulia", {
      title: "Prenotare la palestra",
    });
    await open(page, baseURL, casa, { pause: false });
    await expect(titles(col(page))).toHaveText([CANTINA]);
    await expect(page.getByText("Prenotare la palestra")).toHaveCount(0);

    const marco = casa.users["Marco"]!.client;
    const read = await marco.from("todos").select("id").eq("id", foreignId);
    expect(read.error).toBeNull();
    expect(read.data).toHaveLength(0);
    const done = await marco
      .from("todos")
      .update({ done_at: new Date().toISOString() }, { count: "exact" })
      .eq("id", foreignId);
    expect(done.count ?? 0).toBe(0);
    const renamed = await marco
      .from("todos")
      .update({ title: "Cambiata" }, { count: "exact" })
      .eq("id", foreignId);
    expect(renamed.count ?? 0).toBe(0);
    const created = await marco.from("todos").insert({
      household_id: bianchi.householdId,
      title: "Intrusa",
    });
    expect(created.error).not.toBeNull();

    const rows = await bianchi.todoRows();
    expect(rows.map((r) => r.title)).toEqual(["Prenotare la palestra"]);
    expect(rows[0]!.done_at).toBeNull();
  });
});

// ------------------------------------------------------- loading and errors

test.describe("caricamento ed errori", () => {
  test("CA-39: durante la lettura rallentata si vedono il selettore e un contenitore aria-busy (mobile)", async ({
    page,
    baseURL,
    casa,
  }) => {
    test.skip(!isMobileProject(), "Caso a 390 px");
    await seedBase(casa);
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(/\/rest\/v1\/todos/, async (route) => {
      await gate;
      await route.continue();
    });
    await casa.signIn(page, baseURL, "Marco");
    await page.goto(PATH);
    await expect(busy(page)).toHaveCount(1);
    await expect(busy(page)).toContainText("Caricamento in corso");
    await expect(switcher(page)).toBeVisible();
    await expect(filterGroup(page)).toHaveCount(0);
    release();
    await expect(col(page)).toBeVisible({ timeout: 20_000 });
    await expect(busy(page)).toHaveCount(0);
  });

  test("CA-40: offline compare l'avviso con «Riprova»; tornata la rete sparisce e la cosa è in «Fatti»", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seedBase(casa);
    await open(page, baseURL, casa, { pause: false });
    await page.context().setOffline(true);
    await tick(page, FIRMARE).click();
    await expect(alerts(page)).toContainText(OFFLINE_ALERT);
    await expect(
      alerts(page).getByRole("button", { name: "Riprova" }),
    ).toBeVisible();
    await expect(untick(page, FIRMARE)).toHaveAttribute("aria-checked", "true");
    await page.context().setOffline(false);
    await expect(alerts(page)).toHaveCount(0, { timeout: 5000 });
    await expect.poll(() => doneAtOf(casa, FIRMARE)).not.toBeNull();
    await page.goto(PATH);
    await expect(titles(group(page, "Fatti"))).toHaveText([FIRMARE]);
  });

  test("CA-41: se il server rifiuta la modifica la casella torna vuota e compare il toast di errore", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seedBase(casa);
    await open(page, baseURL, casa, { pause: false });
    await page.route(/\/rest\/v1\/todos/, async (route) => {
      if (route.request().method() === "PATCH") {
        await route.fulfill({
          status: 403,
          contentType: "application/json",
          headers: CORS,
          body: JSON.stringify({ code: "42501", message: "denied" }),
        });
        return;
      }
      await route.continue();
    });
    await tick(page, FIRMARE).click();
    await expect(
      page.getByRole("status").filter({ hasText: SAVE_FAILED }),
    ).toHaveText(SAVE_FAILED);
    await expect(tick(page, FIRMARE)).toHaveAttribute("aria-checked", "false");
    // A refusal is not a lost connection.
    await expect(alerts(page)).toHaveCount(0);
  });

  test("CA-42 (mobile): se la lettura iniziale fallisce c'è l'errore di pagina; «Riprova» a lettura tornata mostra la lista", async ({
    page,
    baseURL,
    casa,
  }) => {
    test.skip(!isMobileProject(), "Su mobile l'errore è a pagina intera");
    await seedBase(casa);
    await failReads(page, /\/rest\/v1\/todos/);
    await casa.signIn(page, baseURL, "Marco");
    await page.goto(PATH);
    const error = alerts(page);
    await expect(error).toContainText("Questa pagina non si è caricata");
    await expect(error.getByRole("button", { name: "Riprova" })).toBeVisible();
    await expect(error).not.toContainText("boom");
    await expect(error).not.toContainText("XX000");
    await expect(page.getByText(CANTINA)).toHaveCount(0);
    await expect(switcher(page)).toHaveCount(0);

    await page.unroute(/\/rest\/v1\/todos/);
    await error.getByRole("button", { name: "Riprova" }).click();
    await expect(col(page)).toBeVisible({ timeout: 20_000 });
    await expect(allRows(page)).toHaveCount(5);
    await expect(alerts(page)).toHaveCount(0);
  });

  // Decision of the coordinator (30/10) and specification 3.7b: on desktop an
  // error of one list shows in its column and its «Riprova» reads only that
  // list; the page error is for when nothing can be read.
  test("CA-42 (desktop): se si legge solo la Spesa l'errore è nella colonna «Da fare» e «Riprova» rilegge solo quella lista", async ({
    page,
    baseURL,
    casa,
  }) => {
    test.skip(isMobileProject(), "Caso a 1280 px");
    await seedBase(casa);
    await casa.shopping("Marco", ["Latte"]);
    await failReads(page, /\/rest\/v1\/todos/);
    await casa.signIn(page, baseURL, "Marco");
    await page.goto(PATH);
    const error = col(page).getByRole("alert");
    await expect(error).toContainText(
      "Non riusciamo a caricare le cose da fare. Controlla la connessione e riprova.",
    );
    await expect(error).not.toContainText("boom");
    await expect(error).not.toContainText("XX000");
    await expect(error.getByRole("button", { name: "Riprova" })).toBeVisible();
    // No page error, no «N aperti», no quick field; Spesa works.
    await expect(page.getByText("Questa pagina non si è caricata")).toHaveCount(
      0,
    );
    await expect(quickField(page)).toHaveCount(0);
    await expect(
      col(page).locator(".sezione__testa").first().locator(".sezione__info"),
    ).toHaveCount(0);
    await expect(
      column(page, "Spesa").locator(".riga-lista__titolo", {
        hasText: "Latte",
      }),
    ).toBeVisible();

    await page.unroute(/\/rest\/v1\/todos/);
    // The page must not reload: this marker would be lost.
    await page.evaluate(() => {
      (window as unknown as { __marker: string }).__marker = "same page";
    });
    await error.getByRole("button", { name: "Riprova" }).click();
    await expect(allRows(page)).toHaveCount(5, { timeout: 20_000 });
    await expect(alerts(page)).toHaveCount(0);
    expect(
      await page.evaluate(
        () => (window as unknown as { __marker?: string }).__marker,
      ),
    ).toBe("same page");
    await expect(
      column(page, "Spesa").locator(".riga-lista__titolo", {
        hasText: "Latte",
      }),
    ).toBeVisible();
  });

  test("CA-42 (desktop): se non si legge niente c'è l'errore a pagina intera", async ({
    page,
    baseURL,
    casa,
  }) => {
    test.skip(isMobileProject(), "Caso a 1280 px");
    await seedBase(casa);
    await failReads(page, /\/rest\/v1\/todos/);
    await failReads(page, /\/rest\/v1\/shopping_items/);
    await casa.signIn(page, baseURL, "Marco");
    await page.goto(PATH);
    await expect(alerts(page)).toContainText("Questa pagina non si è caricata");
    await expect(
      alerts(page).getByRole("button", { name: "Riprova" }),
    ).toBeVisible();
    await expect(col(page)).toHaveCount(0);
  });

  test("Extra: un errore delle cose da fare non rompe la Spesa su /casa/spesa", async ({
    page,
    baseURL,
    casa,
  }) => {
    await casa.shopping("Marco", ["Latte"]);
    await failReads(page, /\/rest\/v1\/todos/);
    await casa.signIn(page, baseURL, "Marco");
    await page.goto("/casa/spesa");
    await expect(
      column(page, "Spesa").locator(".riga-lista__titolo", {
        hasText: "Latte",
      }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Questa pagina non si è caricata")).toHaveCount(
      0,
    );
    if (!isMobileProject()) {
      await expect(col(page).getByRole("alert")).toContainText(
        "Non riusciamo a caricare le cose da fare.",
      );
    }
  });
});
