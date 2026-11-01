import AxeBuilder from "@axe-core/playwright";
import {
  test as plain,
  type Locator,
  type Page,
  type Route,
} from "@playwright/test";
import {
  alerts,
  buildNest,
  CORS,
  expect,
  isMobileProject,
  test,
  type CasaNest,
  type Day,
  type MemberSpec,
} from "../fixtures/casa";
import { signInAs, skipReason, usersConfigured } from "../fixtures/auth";
import { createEvent, watchNetwork } from "../fixtures/calendario";
import { SEED_HOME_B, adminClient } from "../fixtures/invito";

// Calendario · Settimana (#25): one test for every acceptance criterion
// (CA-1 ... CA-40) plus the extras that follow from the requirement.
//
// Written before the page exists, from the criteria of the issue and the
// specification of the designer. Roles, names and texts come from the
// criteria; the few classes and data attributes used (`data-passato`,
// `data-insieme`, `striscia-giorni__punto`, `riga-evento--insieme`) are the
// ones the criteria and the mockup name. Every test creates its events in its
// own throwaway Nest (fixtures/casa.ts) and the Nest is deleted at the end of
// the test: the seed Nests are only read. The page writes nothing.
//
// Clock: «today» is martedì 20 ottobre 2026, 15:52 Europe/Rome. The clock is
// installed a little earlier and stopped at that instant with
// `page.clock.pauseAt` once the page is up (LEZIONI: tests with timers); from
// there only `page.clock.runFor` moves time.
//
// The events are read by the browser through the `list_household_events`
// function: CA-34, CA-35 and CA-36 intercept that request.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

const PATH = "/calendario";
/** martedì 20 ottobre 2026, 15:52 a Roma (CEST, UTC+2) */
const TODAY = new Date("2026-10-20T13:52:00Z");
const LENS = "Punto di vista: solo tu o tutto il Nest";
const LENS_KEY = "familynest.lens";
const READ = "**/rest/v1/rpc/list_household_events*";

const MON: Day = "2026-10-19";
const TUE: Day = "2026-10-20";
const WED: Day = "2026-10-21";
const THU: Day = "2026-10-22";
const FRI: Day = "2026-10-23";
const SAT: Day = "2026-10-24";
const SUN: Day = "2026-10-25";

// Heads of the days (mobile list) and names of the columns (desktop grid).
const MON_H = "Lunedì 19";
const TUE_H = "Martedì 20";
const WED_H = "Mercoledì 21";
const THU_H = "Giovedì 22";
const FRI_H = "Venerdì 23";
const SAT_H = "Sabato 24";
const SUN_H = "Domenica 25";

// ------------------------------------------------------------------ locators

const h1 = (page: Page) => page.getByRole("heading", { level: 1 });
const lensGroup = (page: Page) => page.getByRole("group", { name: LENS });
const viewGroup = (page: Page) =>
  page.getByRole("group", { name: "Vista del calendario" });
const nextWeek = (page: Page) =>
  page.getByRole("button", { name: /^Settimana successiva$/ });
const previousWeek = (page: Page) =>
  page.getByRole("button", { name: /^Settimana precedente$/ });
const mainNav = (page: Page) =>
  page.getByRole("navigation", { name: "Navigazione principale" });
const retry = (page: Page) => page.getByRole("button", { name: "Riprova" });
const busyLoading = (page: Page) =>
  page
    .locator('[aria-busy="true"]')
    .filter({ hasText: "Caricamento in corso" });

const escapeRe = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Name of a day of the strip: «Venerdì 23 ottobre, 1 impegno» (CA-9). */
function tabName(label: string, count: number): RegExp {
  const amount =
    count === 0
      ? "nessun impegno"
      : `${count} ${count === 1 ? "impegno" : "impegni"}`;
  const weekday = label.split(" ")[0] ?? "";
  const rest = label.slice(weekday.length + 1);
  const prefix = `${weekday.slice(0, 3)} ${rest.split(" ")[0]}, ${weekday.toLowerCase()} ${rest}`;
  return new RegExp(
    `^${escapeRe(prefix)}(, oggi)?, ${amount}(, liberi insieme la sera)?$`,
  );
}
const tab = (page: Page, label: string, count: number) =>
  page.getByRole("tab", { name: tabName(label, count) });
const tabs = (page: Page) =>
  page
    .getByRole("tablist", { name: "Giorni della settimana" })
    .getByRole("tab");

/** Section of a day in the mobile list. */
const daySection = (page: Page, head: string) =>
  page
    .getByRole("heading", { level: 2, name: head, exact: true })
    .locator("xpath=ancestor::section[1]");
const dayRows = (page: Page, head: string) =>
  daySection(page, head).getByRole("link");

/** Column of a day in the desktop grid (it starts with a hidden h2). */
const gridColumn = (page: Page, label: string) =>
  page
    .getByRole("heading", {
      level: 2,
      name: new RegExp(`^${escapeRe(label)}( |,|$)`),
    })
    .locator("xpath=..");
const gridBlock = (page: Page, label: string, title: string) =>
  gridColumn(page, label).getByRole("link", {
    name: new RegExp(`^${escapeRe(title)}`),
  });

/** A section of the right panel (desktop), by its h2. */
const panel = (page: Page, title: string) =>
  page
    .getByRole("heading", { level: 2, name: title, exact: true })
    .locator("xpath=ancestor::section[1]");

/** «<Name> ha un impegno» (row or block «Occupato» of someone else). */
const busyItem = (page: Page, who: string) =>
  page
    .locator(`[aria-label^="${who} ha un impegno"]`)
    .or(page.getByText(`${who} ha un impegno`))
    .filter({ visible: true })
    .first();

/** Accessible name plus text of an element: where the time may be written. */
const nameAndText = (target: Locator) =>
  target.evaluate(
    (el) => `${el.getAttribute("aria-label") ?? ""} ${el.textContent ?? ""}`,
  );

/** True when the element is not a link, a button, nor inside one. */
const isInert = (target: Locator) =>
  target.evaluate(
    (el) =>
      el.closest('a, button, [role="link"], [role="button"]') === null &&
      el.querySelector("a, button") === null,
  );

// ------------------------------------------------------------------ helpers

type OpenOptions = {
  who?: string;
  path?: string;
  /** Lens kept for the session before the page opens (default: the app's «Io») */
  lens?: "io" | "nest";
  /** false: do not wait for the end of the loading (the test holds the read) */
  settle?: boolean;
};

/**
 * Opens the calendar as `who` with the clock stopped at TODAY. The clock is
 * installed two minutes earlier so that the page is up before the stop.
 */
async function open(
  page: Page,
  baseURL: string | undefined,
  nest: CasaNest,
  options: OpenOptions = {},
): Promise<void> {
  const { who = "Giulia", path = PATH, lens, settle = true } = options;
  await page.clock.install({ time: new Date(TODAY.getTime() - 120_000) });
  if (lens) {
    await page.addInitScript(
      ([key, value]) => {
        if (!window.sessionStorage.getItem(key!)) {
          window.sessionStorage.setItem(key!, value!);
        }
      },
      [LENS_KEY, lens] as const,
    );
  }
  await nest.signIn(page, baseURL, who);
  await page.goto(path);
  await expect(h1(page)).toBeVisible({ timeout: 20_000 });
  if (settle) await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  await page.clock.pauseAt(TODAY);
}

/**
 * Opens the page again after the clock has been stopped: a page loaded with a
 * stopped clock never finishes starting, so the clock runs for the load and is
 * stopped again (one second ahead) once the page is up.
 */
async function reopen(page: Page, url: string): Promise<void> {
  await page.clock.resume();
  await page.goto(url);
  await expect(h1(page)).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(now + 1000);
}

/** Clicks a lens button until the client has hydrated and the state changes. */
async function chooseLens(page: Page, which: "Io" | "Nest") {
  const button = lensGroup(page).getByRole("button", {
    name: new RegExp(`${which}$`),
  });
  await expect(async () => {
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true", {
      timeout: 1000,
    });
  }).toPass();
}

function onlyOn(project: "mobile" | "desktop") {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name !== project,
      `Si esegue solo sul progetto ${project}`,
    );
  });
}

/** A test that runs on one project only, without building its Nest elsewhere. */
function only(
  project: "mobile" | "desktop",
  title: string,
  body: (args: {
    page: Page;
    baseURL: string | undefined;
    bianchi: CasaNest;
  }) => Promise<void>,
) {
  test.describe(() => {
    onlyOn(project);
    test(title, body);
  });
}

async function noDuplicateIds(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const seen = new Map<string, number>();
    for (const el of document.querySelectorAll("[id]")) {
      seen.set(el.id, (seen.get(el.id) ?? 0) + 1);
    }
    return [...seen].filter(([, n]) => n > 1).map(([id]) => id);
  });
}

async function axeProblems(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations
    .filter((v) => ["serious", "critical"].includes(v.impact ?? ""))
    .map((v) => `${v.id}: ${v.nodes.length} elementi`);
}

/** The reading of the events fails as a database error until `recover()`. */
async function failReads(page: Page): Promise<{ recover: () => void }> {
  let failing = true;
  await page.route(READ, async (route: Route) => {
    if (route.request().method() === "OPTIONS") {
      return route.fulfill({ status: 204, headers: CORS });
    }
    if (!failing) return route.continue();
    return route.fulfill({
      status: 500,
      contentType: "application/json",
      headers: CORS,
      body: JSON.stringify({ code: "XX000", message: "fake failure" }),
    });
  });
  return {
    recover: () => {
      failing = false;
    },
  };
}

/** The reading of the events waits until `release()` is called. */
async function holdReads(page: Page): Promise<{ release: () => void }> {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(READ, async (route: Route) => {
    if (route.request().method() === "OPTIONS") return route.continue();
    await gate;
    await route.continue().catch(() => {});
  });
  return { release: () => release() };
}

/**
 * The evening «Liberi insieme» of a day, in the layout of the project: the row
 * of the day on mobile, the row of «Serate libere insieme» on desktop.
 * `null` = there is none.
 */
async function expectInsieme(
  page: Page,
  head: string,
  expected: null | { desktop: string; mobile: string; time: string },
): Promise<void> {
  if (isMobileProject()) {
    const row = daySection(page, head).locator(".riga-evento--insieme");
    if (expected === null) {
      await expect(row).toHaveCount(0);
      return;
    }
    await expect(row).toContainText("Liberi insieme");
    await expect(row).toContainText(expected.mobile);
    await expect(row).toContainText(expected.time);
    return;
  }
  const item = panel(page, "Serate libere insieme")
    .getByRole("listitem")
    .filter({ has: page.getByText(head, { exact: true }) });
  if (expected === null) {
    await expect(item).toHaveCount(0);
    return;
  }
  await expect(item).toContainText(expected.desktop);
}

const OFFLINE_ALERT_AXE = "Non riusciamo ad aggiornare il calendario.";
const SERA = "Tutta la sera, dalle 18:00";
const SERA_MOBILE = "Tu, Paolo e Anna, fino a fine serata";

// ------------------------------------------------------- access and structure

plain.describe("accesso", () => {
  plain(
    "CA-1: senza sessione /calendario porta a /accesso",
    async ({ page }) => {
      await page.goto(PATH);
      await expect(page).toHaveURL(/\/accesso$/);
    },
  );

  plain(
    "CA-2: l'utente C senza Nest va su /onboarding",
    async ({ page, baseURL }) => {
      plain.skip(!usersConfigured("C"), skipReason("C"));
      await signInAs(page.context(), baseURL as string, "C");
      await page.goto(PATH);
      await expect(page).toHaveURL(/\/onboarding/);
    },
  );
});

test.describe("struttura", () => {
  only(
    "mobile",
    "CA-3: su mobile titolo, navigazione, vista e striscia",
    async ({ page, baseURL, bianchi }) => {
      await open(page, baseURL, bianchi);
      await expect(h1(page)).toHaveText("19 – 25 ottobre");
      await expect(
        mainNav(page).getByRole("link", { name: "Calendario" }),
      ).toHaveAttribute("aria-current", "page");
      await expect(
        viewGroup(page).getByRole("button", { name: "Settimana" }),
      ).toHaveAttribute("aria-pressed", "true");
      const strip = tabs(page);
      await expect(strip).toHaveCount(7);
      const short = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
      for (const [index, name] of short.entries()) {
        await expect(strip.nth(index)).toContainText(name);
      }
      await expect(strip.nth(1)).toHaveAttribute("aria-selected", "true");
      await expect(strip.nth(1)).not.toHaveAttribute("aria-current");
      await expect(
        page.getByRole("tab", { selected: true }),
        "uno solo selezionato",
      ).toHaveCount(1);
    },
  );

  only(
    "desktop",
    "CA-4: su desktop «Mar, oggi», lente nel main, «Aggiungi» solo nella navigazione",
    async ({ page, baseURL, bianchi }) => {
      // An empty week shows no grid: the week needs one event.
      await createEvent(bianchi, "Giulia", {
        title: "Riunione di team",
        day: MON,
        from: "10:00",
        to: "11:00",
      });
      await open(page, baseURL, bianchi);
      await expect(page.getByText("Mar, oggi")).toBeVisible();
      const main = page.getByRole("main");
      await expect(main.getByRole("group", { name: LENS })).toBeVisible();
      // Decision of 31/10: no «Aggiungi» in the page header, only the one of
      // the navigation at the top.
      await expect(main.getByRole("link", { name: "Aggiungi" })).toHaveCount(0);
      // The only visible «Aggiungi» is the one of the top bar (#67).
      const add = page.getByRole("link", { name: "Aggiungi" });
      await expect(add).toHaveCount(1);
      await expect(add).toHaveAttribute("href", "/aggiungi");
    },
  );
});

// ------------------------------------------------------------------- weeks

test.describe("settimane", () => {
  test("CA-5: le frecce cambiano settimana e indirizzo", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await open(page, baseURL, bianchi);
    // A full reload would clear this mark: the frame is not reloaded.
    await page.evaluate(() => Object.assign(window, { __calMark: true }));
    await nextWeek(page).click();
    await expect(h1(page)).toHaveText("26 ottobre – 1 novembre");
    await expect(page).toHaveURL(/settimana=2026-10-26/);
    expect(await page.evaluate(() => "__calMark" in window)).toBe(true);

    await reopen(page, page.url());
    await expect(h1(page)).toHaveText("26 ottobre – 1 novembre");

    await previousWeek(page).click();
    await expect(h1(page)).toHaveText("19 – 25 ottobre");
    await previousWeek(page).click();
    await expect(h1(page)).toHaveText("12 – 18 ottobre");
    await expect(page).toHaveURL(/settimana=2026-10-12/);
  });

  test("CA-5: il bottone indietro del browser torna alla settimana prima", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await open(page, baseURL, bianchi);
    await nextWeek(page).click();
    await expect(h1(page)).toHaveText("26 ottobre – 1 novembre");
    await page.goBack();
    await expect(h1(page)).toHaveText("19 – 25 ottobre");
  });

  test("CA-6: un giorno qualsiasi mostra la sua settimana, un valore non valido quella di oggi", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await open(page, baseURL, bianchi, {
      path: `${PATH}?settimana=2026-10-21`,
    });
    await expect(h1(page)).toHaveText("19 – 25 ottobre");
    await reopen(page, `${PATH}?settimana=xyz`);
    await expect(h1(page)).toHaveText("19 – 25 ottobre");
    await expect(alerts(page)).toHaveCount(0);
    await expect(retry(page)).toHaveCount(0);
  });

  test("CA-6: la settimana a cavallo di due anni ha il titolo con gli anni", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await open(page, baseURL, bianchi, {
      path: `${PATH}?settimana=2026-12-28`,
    });
    await expect(h1(page)).toHaveText("28 dicembre 2026 – 3 gennaio 2027");
  });

  only(
    "mobile",
    "CA-7: «Giorno» e «Mese» seguono il giorno scelto nella striscia",
    async ({ page, baseURL, bianchi }) => {
      await open(page, baseURL, bianchi);
      await page
        .getByRole("tab", { name: /^Gio 22, giovedì 22 ottobre/ })
        .click();
      await expect(
        page.getByRole("tab", { name: /^Gio 22, giovedì 22 ottobre/ }),
      ).toHaveAttribute("aria-selected", "true");
      await expect(
        viewGroup(page).getByRole("link", { name: "Giorno" }),
      ).toHaveAttribute("href", "/calendario/giorno?giorno=2026-10-22");
      await expect(
        viewGroup(page).getByRole("link", { name: "Mese" }),
      ).toHaveAttribute("href", "/calendario/mese?mese=2026-10");
    },
  );
});

// ----------------------------------------------------- mobile list and strip

test.describe("elenco mobile e striscia", () => {
  onlyOn("mobile");

  test("CA-8: la riga di un impegno ha ora, titolo, luogo, avatar e link", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    const id = await createEvent(bianchi, "Giulia", {
      title: "Cena da Marta",
      day: FRI,
      from: "20:00",
      to: "23:00",
      location: "Via Roma 1",
      participants: ["Giulia", "Paolo"],
    });
    await open(page, baseURL, bianchi);
    const row = dayRows(page, FRI_H).filter({ hasText: "Cena da Marta" });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText("20:00");
    await expect(row).toContainText("Via Roma 1");
    await expect(row.getByRole("img", { name: "Giulia, Paolo" })).toBeVisible();
    await expect(row).toHaveAttribute("href", `/impegni/${id}?giorno=${FRI}`);
  });

  test("#190: la riga della volta di giovedì apre il dettaglio di giovedì", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    const id = await createEvent(bianchi, "Giulia", {
      title: "Nuoto ripetuto",
      day: TUE,
      from: "18:00",
      to: "19:00",
      weekdays: [2, 4],
    });
    await open(page, baseURL, bianchi);
    const tuesday = dayRows(page, TUE_H).filter({ hasText: "Nuoto ripetuto" });
    const thursday = dayRows(page, THU_H).filter({
      hasText: "Nuoto ripetuto",
    });
    await expect(tuesday).toHaveAttribute(
      "href",
      `/impegni/${id}?giorno=${TUE}`,
    );
    await expect(thursday).toHaveAttribute(
      "href",
      `/impegni/${id}?giorno=${THU}`,
    );
    await thursday.click();
    await expect(page).toHaveURL(new RegExp(`/impegni/${id}\\?giorno=${THU}$`));
  });

  test("CA-9: i numeri della striscia e delle teste contano gli impegni, con al massimo 4 punti", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await createEvent(bianchi, "Giulia", {
      title: "Cena da Marta",
      day: FRI,
      from: "20:00",
      to: "23:00",
      participants: ["Giulia", "Paolo"],
    });
    for (const hour of [8, 9, 10, 11, 12, 13]) {
      await createEvent(bianchi, "Giulia", {
        title: `Impegno delle ${hour}`,
        day: THU,
        from: `${hour}:00`,
        to: `${hour}:30`,
      });
    }
    await open(page, baseURL, bianchi);
    const friday = tab(page, "Venerdì 23 ottobre", 1);
    await expect(friday).toBeVisible();
    await expect(
      friday.locator(
        ".striscia-giorni__punto:not(.striscia-giorni__punto--insieme)",
      ),
    ).toHaveCount(1);
    const thursday = tab(page, "Giovedì 22 ottobre", 6);
    await expect(thursday).toBeVisible();
    await expect(
      thursday.locator(
        ".striscia-giorni__punto:not(.striscia-giorni__punto--insieme)",
      ),
    ).toHaveCount(4);
    await expect(
      daySection(page, THU_H).getByText("6 impegni", { exact: true }),
    ).toBeVisible();
  });

  test("CA-10: toccare un giorno lo seleziona e porta a quella sezione", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await createEvent(bianchi, "Giulia", {
      title: "Cena da Marta",
      day: FRI,
      from: "20:00",
      to: "23:00",
    });
    await open(page, baseURL, bianchi);
    const friday = page.getByRole("tab", {
      name: /^Ven 23, venerdì 23 ottobre/,
    });
    await friday.click();
    await expect(friday).toHaveAttribute("aria-selected", "true");
    await expect(
      page.getByRole("tab", { name: /^Mar 20, martedì 20 ottobre/ }),
    ).toHaveAttribute("aria-selected", "false");
    await expect(
      page.getByRole("heading", { level: 2, name: FRI_H, exact: true }),
    ).toBeInViewport();
  });

  test("CA-11: le righe sono in ordine di inizio, poi di durata, poi di titolo", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await createEvent(bianchi, "Giulia", {
      title: "Bravo",
      day: WED,
      from: "18:00",
      to: "19:00",
    });
    await createEvent(bianchi, "Giulia", {
      title: "Alfa",
      day: WED,
      from: "18:00",
      to: "18:30",
    });
    await createEvent(bianchi, "Giulia", {
      title: "Zeta",
      day: WED,
      from: "9:00",
      to: "10:00",
    });
    await open(page, baseURL, bianchi);
    await expect(dayRows(page, WED_H)).toHaveCount(3);
    const texts = await dayRows(page, WED_H).allInnerTexts();
    const order = ["Zeta", "Alfa", "Bravo"].map((title) =>
      texts.findIndex((text) => text.includes(title)),
    );
    expect(order).toEqual([0, 1, 2]);
  });

  test("CA-12: gli impegni già finiti hanno data-passato e la testa dice «oggi»", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await createEvent(bianchi, "Giulia", {
      title: "Pranzo con Anna",
      day: TUE,
      from: "13:00",
      to: "14:00",
    });
    await createEvent(bianchi, "Giulia", {
      title: "Palestra",
      day: TUE,
      from: "17:00",
      to: "18:00",
    });
    await open(page, baseURL, bianchi);
    const rows = dayRows(page, TUE_H);
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText("Pranzo con Anna");
    await expect(rows.nth(0)).toHaveAttribute("data-passato", "true");
    await expect(rows.nth(1)).toContainText("Palestra");
    await expect(rows.nth(1)).not.toHaveAttribute("data-passato", "true");
    await expect(
      daySection(page, TUE_H).getByText("2 impegni · oggi", { exact: true }),
    ).toBeVisible();
  });

  test("CA-13: l'informazione dice chi, il luogo e chi accompagna", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await createEvent(bianchi, "Paolo", {
      title: "Inglese",
      day: TUE,
      from: "17:00",
      to: "18:00",
      location: "Via Dante 4",
      participants: ["Leo"],
      escort: "Paolo",
    });
    await createEvent(bianchi, "Paolo", {
      title: "Nuoto Leo",
      day: WED,
      from: "17:00",
      to: "18:00",
      location: "Via Dante 4",
      participants: ["Leo"],
      escort: "Paolo",
    });
    await open(page, baseURL, bianchi, { lens: "nest" });
    const english = dayRows(page, TUE_H).filter({ hasText: "Inglese" });
    await expect(
      english.getByText("Leo, Via Dante 4, la porta Paolo", { exact: true }),
    ).toBeVisible();
    const swim = dayRows(page, WED_H).filter({ hasText: "Nuoto Leo" });
    await expect(
      swim.getByText("Via Dante 4, la porta Paolo", { exact: true }),
    ).toBeVisible();
  });

  test("CA-14: un impegno a cavallo di mezzanotte è in tutti e due i giorni", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await createEvent(bianchi, "Giulia", {
      title: "Cena lunga",
      day: MON,
      from: "23:00",
      to: "1:00",
      endDay: TUE,
    });
    await open(page, baseURL, bianchi);
    // The list starts from today: Monday is added by tapping its day.
    await page.getByRole("tab", { name: /^Lun 19, lunedì 19 ottobre/ }).click();
    const monday = dayRows(page, MON_H).filter({ hasText: "Cena lunga" });
    await expect(monday).toHaveCount(1);
    await expect(monday).toContainText("23:00");
    const tuesday = dayRows(page, TUE_H).filter({ hasText: "Cena lunga" });
    await expect(tuesday).toHaveCount(1);
    expect(await tuesday.innerText()).toMatch(/(^|\s)0:00(\s|$)/);
  });
});

// -------------------------------------------------------------- visibility

test.describe("visibilità", () => {
  const SECRET_TITLE = "Riunione segreta";
  const SECRET_PLACE = "Ufficio Nord";

  async function expectNoLeak(
    page: Page,
    net: { bodies: () => Promise<string> },
    forbidden: string[],
  ) {
    const html = await (await page.request.get(PATH)).text();
    const dom = await page.content();
    const bodies = await net.bodies();
    for (const text of forbidden) {
      await expect(page.locator("body")).not.toContainText(text);
      expect(dom, `DOM: ${text}`).not.toContain(text);
      expect(html, `HTML del server: ${text}`).not.toContain(text);
      expect(bodies, `risposte di rete: ${text}`).not.toContain(text);
    }
  }

  test("CA-15: l'«Occupato» di un altro non mostra titolo né luogo", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await createEvent(bianchi, "Paolo", {
      title: SECRET_TITLE,
      location: SECRET_PLACE,
      day: TUE,
      from: "9:00",
      to: "15:00",
      visibility: "busy",
    });
    const net = watchNetwork(page);
    await open(page, baseURL, bianchi, { lens: "nest" });
    const item = busyItem(page, "Paolo");
    await expect(item).toBeVisible();
    expect(await nameAndText(item)).toContain("9:00");
    expect(await isInert(item), "non è un link").toBe(true);
    await expectNoLeak(page, net, [SECRET_TITLE, SECRET_PLACE]);
  });

  test("CA-16: l'autore vede il titolo e la riga è un link", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    const id = await createEvent(bianchi, "Paolo", {
      title: SECRET_TITLE,
      location: SECRET_PLACE,
      day: TUE,
      from: "9:00",
      to: "15:00",
      visibility: "busy",
    });
    await open(page, baseURL, bianchi, { who: "Paolo" });
    const link = page.getByRole("link", { name: new RegExp(SECRET_TITLE) });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", `/impegni/${id}?giorno=${TUE}`);
  });

  test("CA-17: il «Solo io» di un altro non c'è, in nessuna forma", async ({
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
    await createEvent(bianchi, "Giulia", {
      title: "Riunione del lunedì",
      day: MON,
      from: "10:00",
      to: "11:00",
    });
    const net = watchNetwork(page);
    await open(page, baseURL, bianchi, { lens: "nest" });
    if (isMobileProject()) {
      await expect(tab(page, "Lunedì 19 ottobre", 1)).toBeVisible();
      await expect(tab(page, "Martedì 20 ottobre", 0)).toBeVisible();
      await expect(
        daySection(page, TUE_H).getByText("niente in programma · oggi", {
          exact: true,
        }),
      ).toBeVisible();
    } else {
      await expect(
        page.getByRole("link", { name: /Riunione del lunedì/ }).first(),
      ).toBeVisible();
    }
    await expectNoLeak(page, net, ["Prova privata"]);
    await expect(busyItem(page, "Paolo")).toHaveCount(0);
  });
});

// -------------------------------------------------------------------- lens

test.describe("lente", () => {
  only(
    "mobile",
    "CA-18: la lente «Io» nasconde gli impegni degli altri e li conta",
    async ({ page, baseURL, bianchi }) => {
      await createEvent(bianchi, "Paolo", {
        title: "Piscina",
        day: TUE,
        from: "17:00",
        to: "18:00",
        participants: ["Paolo", "Leo"],
      });
      await createEvent(bianchi, "Giulia", {
        title: "Cena in famiglia",
        day: TUE,
        from: "18:00",
        to: "19:00",
      });
      await open(page, baseURL, bianchi);
      await expect(
        page.getByRole("link", { name: /Cena in famiglia/ }).first(),
      ).toBeVisible();
      await expect(page.getByRole("link", { name: /Piscina/ })).toHaveCount(0);
      const tuesday = daySection(page, TUE_H);
      await expect(
        tuesday.getByText("1 impegno · oggi", { exact: true }),
      ).toBeVisible();
      await expect(tuesday).toContainText("1 impegno degli altri nascosto");

      const url = page.url();
      await chooseLens(page, "Nest");
      await expect(
        page.getByRole("link", { name: /Piscina/ }).first(),
      ).toBeVisible();
      await expect(
        lensGroup(page).getByRole("button", { name: /Nest$/ }),
      ).toHaveAttribute("aria-pressed", "true");
      await expect(tuesday).not.toContainText("degli altri nascosto");
      expect(page.url()).toBe(url);
    },
  );

  test("CA-19: chi accompagna vede l'impegno anche con la lente «Io»", async ({
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
      escort: "Giulia",
    });
    await open(page, baseURL, bianchi);
    await expect(
      lensGroup(page).getByRole("button", { name: /Io$/ }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("link", { name: /Inglese/ }).first(),
    ).toBeVisible();
  });

  test("CA-20: con la lente «Io» e nessun impegno proprio c'è «Niente di tuo questa settimana»", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await createEvent(bianchi, "Paolo", {
      title: "Impegno riservato",
      day: TUE,
      from: "9:00",
      to: "15:00",
      visibility: "busy",
    });
    await open(page, baseURL, bianchi);
    // Decision of 31/10: the empty state of the lens «Io» (designer §4.4).
    await expect(
      page.getByText("Niente di tuo questa settimana"),
    ).toBeVisible();
    await expect(
      page.getByText(
        /Gli altri del Nest ha 1 impegno: li vedi con la lente Nest\./,
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Aggiungi un impegno" }),
    ).toHaveAttribute("href", "/aggiungi");
    await expect(busyItem(page, "Paolo")).toHaveCount(0);
    await page.getByRole("button", { name: "Mostra tutto il Nest" }).click();
    await expect(
      lensGroup(page).getByRole("button", { name: /Nest$/ }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(busyItem(page, "Paolo")).toBeVisible();
  });
});

// ---------------------------------------------------------- liberi insieme

test.describe("liberi insieme", () => {
  /** CA-21: Tuesday 18:00-20:00 for the three adults, nothing else. */
  async function cena(bianchi: CasaNest) {
    await createEvent(bianchi, "Giulia", {
      title: "Cena in tre",
      day: TUE,
      from: "18:00",
      to: "20:00",
      participants: ["Giulia", "Paolo", "Anna"],
    });
  }

  test("CA-21: dopo l'impegno delle 18:00-20:00 la serata libera parte dalle 20:00", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await cena(bianchi);
    await open(page, baseURL, bianchi);
    if (isMobileProject()) {
      const row = daySection(page, TUE_H).locator(".riga-evento--insieme");
      await expect(row).toContainText("20:00");
      await expect(row).toContainText("Liberi insieme");
      await expect(row).toContainText("Tu, Paolo e Anna, fino a fine serata");
      expect(await isInert(row), "non è un link").toBe(true);
      await expect(
        page
          .getByRole("tab", { name: /^Mar 20, martedì 20 ottobre/ })
          .locator('[data-insieme="true"]'),
      ).toHaveCount(1);
    } else {
      await expectInsieme(page, TUE_H, {
        desktop: "Dalle 20:00 a fine serata",
        mobile: "",
        time: "",
      });
    }
  });

  test("CA-22: le altre sere sono libere e un impegno di Paolo accorcia la finestra", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await cena(bianchi);
    await open(page, baseURL, bianchi);
    if (!isMobileProject()) {
      const section = panel(page, "Serate libere insieme");
      await expect(section.getByText("7 questa settimana")).toBeVisible();
      await expectInsieme(page, WED_H, {
        desktop: SERA,
        mobile: "",
        time: "",
      });
    }
    await createEvent(bianchi, "Paolo", {
      title: "Allenamento di Paolo",
      day: WED,
      from: "20:00",
      to: "23:00",
    });
    await reopen(page, PATH);
    await expect(h1(page)).toHaveText("19 – 25 ottobre");
    await expectInsieme(page, WED_H, {
      desktop: "Dalle 18:00 alle 20:00",
      mobile: "Tu, Paolo e Anna, fino alle 20:00",
      time: "18:00",
    });
  });

  test("CA-23: la finestra deve durare almeno un'ora (45 minuti no)", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await createEvent(bianchi, "Paolo", {
      title: "Corso serale",
      day: THU,
      from: "18:00",
      to: "22:15",
    });
    await open(page, baseURL, bianchi, { lens: "nest" });
    await expect(
      page.getByRole("link", { name: /Corso serale/ }).first(),
    ).toBeVisible();
    await expectInsieme(page, THU_H, null);
  });

  test("CA-23: la finestra di un'ora esatta c'è", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await createEvent(bianchi, "Paolo", {
      title: "Corso serale",
      day: THU,
      from: "18:00",
      to: "22:00",
    });
    await open(page, baseURL, bianchi, { lens: "nest" });
    await expectInsieme(page, THU_H, {
      desktop: "Dalle 22:00 a fine serata",
      mobile: "Tu, Paolo e Anna, fino a fine serata",
      time: "22:00",
    });
  });

  only(
    "desktop",
    "CA-24: vince la finestra più lunga, a parità la più presto",
    async ({ page, baseURL, bianchi }) => {
      const first = await createEvent(bianchi, "Paolo", {
        title: "Corso serale",
        day: FRI,
        from: "19:00",
        to: "20:30",
      });
      await open(page, baseURL, bianchi);
      await expectInsieme(page, FRI_H, {
        desktop: "Dalle 20:30 a fine serata",
        mobile: "",
        time: "",
      });
      await bianchi.users.Paolo!.admin.from("events").delete().eq("id", first);
      await createEvent(bianchi, "Paolo", {
        title: "Corso serale",
        day: FRI,
        from: "19:30",
        to: "21:30",
      });
      await reopen(page, PATH);
      await expectInsieme(page, FRI_H, {
        desktop: "Dalle 18:00 alle 19:30",
        mobile: "",
        time: "",
      });
    },
  );

  test("CA-25: chi è occupato: «Occupato» sì, «Solo io» no, figli solo con accompagnatore", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    // The Monday event only makes sure the week has something visible (§8).
    await createEvent(bianchi, "Giulia", {
      title: "Riunione del lunedì",
      day: MON,
      from: "10:00",
      to: "11:00",
    });
    const slot = { day: SAT, from: "18:00", to: "23:00" };
    const everyone = { desktop: SERA, mobile: SERA_MOBILE, time: "18:00" };
    const remove = async (id: string) => {
      await bianchi.users.Giulia!.admin.from("events").delete().eq("id", id);
    };

    const busy = await createEvent(bianchi, "Paolo", {
      ...slot,
      title: "Occupato di Paolo",
      visibility: "busy",
    });
    await open(page, baseURL, bianchi);
    await expectInsieme(page, SAT_H, null);

    await remove(busy);
    const solo = await createEvent(bianchi, "Paolo", {
      ...slot,
      title: "Solo di Paolo",
      visibility: "private",
    });
    await reopen(page, PATH);
    await expectInsieme(page, SAT_H, everyone);

    await remove(solo);
    const child = await createEvent(bianchi, "Giulia", {
      ...slot,
      title: "Festa di Leo",
      participants: ["Leo"],
    });
    await reopen(page, PATH);
    await expectInsieme(page, SAT_H, everyone);

    await remove(child);
    await createEvent(bianchi, "Giulia", {
      ...slot,
      title: "Festa di Leo",
      participants: ["Leo"],
      escort: "Anna",
    });
    await reopen(page, PATH);
    await expectInsieme(page, SAT_H, null);
  });

  test("CA-26: in un Nest con un solo adulto non c'è nessun «Liberi insieme»", async ({
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
      await open(page, baseURL, nest, { who: "Chiara" });
      await expect(
        page.getByRole("link", { name: /Studio/ }).first(),
      ).toBeVisible();
      await expect(page.getByText(/liberi insieme/i)).toHaveCount(0);
      expect(await page.content()).not.toContain('data-insieme="true"');
      await expect(
        page.getByRole("heading", { name: "Serate libere insieme" }),
      ).toHaveCount(0);
    } finally {
      await cleanup();
    }
  });

  test("CA-27: «Liberi insieme» c'è anche con la lente «Io»", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await cena(bianchi);
    await open(page, baseURL, bianchi, { lens: "nest" });
    const evening = isMobileProject()
      ? daySection(page, TUE_H).locator(".riga-evento--insieme")
      : gridColumn(page, "Martedì 20 ottobre").getByText("Liberi insieme");
    await expect(evening).toBeVisible();
    await chooseLens(page, "Io");
    await expect(evening).toBeVisible();
  });
});

// --------------------------------------------------------- desktop grid

test.describe("griglia desktop e pannello", () => {
  onlyOn("desktop");

  /** Offset of a block from the top of its column (the 8:00 line). */
  async function offsetAndHeight(column: Locator, block: Locator) {
    const columnBox = await column.boundingBox();
    const box = await block.boundingBox();
    expect(columnBox, "colonna visibile").not.toBeNull();
    expect(box, "blocco visibile").not.toBeNull();
    return { top: box!.y - columnBox!.y, height: box!.height };
  }

  test("CA-28: il blocco sta nella colonna giusta, a 80 px dalle 8:00 e alto 40", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await createEvent(bianchi, "Giulia", {
      title: "Riunione di team",
      day: MON,
      from: "10:00",
      to: "11:00",
    });
    await open(page, baseURL, bianchi);
    const column = gridColumn(page, "Lunedì 19 ottobre");
    const block = gridBlock(page, "Lunedì 19 ottobre", "Riunione di team");
    await expect(block).toBeVisible();
    await expect(block).toContainText("Riunione di team");
    await expect(block).toContainText(/10:00\s–\s11:00/);
    // ±4 px: the mockup sets the block 2 px under the hour and 4 px shorter
    // (decision of the coordinator on #26).
    const { top, height } = await offsetAndHeight(column, block);
    expect(Math.abs(top - 80)).toBeLessThanOrEqual(4);
    expect(Math.abs(height - 40)).toBeLessThanOrEqual(4);
  });

  test("CA-29: due impegni sovrapposti si dividono la colonna a metà", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await createEvent(bianchi, "Giulia", {
      title: "Primo",
      day: THU,
      from: "16:30",
      to: "17:15",
    });
    await createEvent(bianchi, "Giulia", {
      title: "Secondo",
      day: THU,
      from: "17:00",
      to: "18:30",
    });
    await open(page, baseURL, bianchi);
    const column = gridColumn(page, "Giovedì 22 ottobre");
    const first = gridBlock(page, "Giovedì 22 ottobre", "Primo");
    const second = gridBlock(page, "Giovedì 22 ottobre", "Secondo");
    await expect(first).toBeVisible();
    await expect(second).toBeVisible();
    const c = (await column.boundingBox())!;
    const a = (await first.boundingBox())!;
    const b = (await second.boundingBox())!;
    expect(Math.abs(a.width - b.width)).toBeLessThanOrEqual(1);
    // ±4 px: the lanes of the mockup are 50% minus 4 px wide.
    expect(Math.abs(a.width - c.width / 2)).toBeLessThanOrEqual(4.5);
    const [left, right] = a.x <= b.x ? [a, b] : [b, a];
    expect(left.x + left.width, "non si coprono").toBeLessThanOrEqual(
      right.x + 1,
    );
  });

  test("CA-30: all'apertura il pannello mostra il primo impegno non ancora iniziato", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    const id = await createEvent(bianchi, "Giulia", {
      title: "Cena dai nonni",
      day: TUE,
      from: "19:30",
      to: "21:30",
      location: "Monza",
      participants: ["Giulia", "Paolo", "Leo", "Anna"],
    });
    await open(page, baseURL, bianchi);
    const section = panel(page, "Impegno");
    await expect(section).toContainText("19:30");
    await expect(section).toContainText("Cena dai nonni");
    await expect(section).toContainText("Fino alle 21:30, Monza");
    // The note shows the people (decision of 31/10): all of them = «Tutto il Nest».
    await expect(section).toContainText("Tutto il Nest");
    await expect(section.getByRole("link")).toHaveAttribute(
      "href",
      `/impegni/${id}`,
    );
    await expect(
      gridBlock(page, "Martedì 20 ottobre", "Cena dai nonni"),
    ).toHaveAttribute("aria-current", "true");
  });

  test("CA-30: la nota del pannello elenca le persone", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await createEvent(bianchi, "Giulia", {
      title: "Cena dai nonni",
      day: TUE,
      from: "19:30",
      to: "21:30",
      participants: ["Giulia", "Paolo"],
    });
    await open(page, baseURL, bianchi);
    const section = panel(page, "Impegno");
    await expect(section).toContainText("Cena dai nonni");
    await expect(section).toContainText("Giulia e Paolo");
    await expect(section).not.toContainText("Tutto il Nest");
  });

  test("CA-31: il clic su un blocco lo sceglie, «Occupato» e «Liberi insieme» no", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await createEvent(bianchi, "Giulia", {
      title: "Cena dai nonni",
      day: TUE,
      from: "19:30",
      to: "21:30",
    });
    await createEvent(bianchi, "Giulia", {
      title: "Riunione di team",
      day: MON,
      from: "10:00",
      to: "11:00",
    });
    await createEvent(bianchi, "Paolo", {
      title: "Riunione segreta",
      day: TUE,
      from: "9:00",
      to: "15:00",
      visibility: "busy",
    });
    await open(page, baseURL, bianchi, { lens: "nest" });
    const section = panel(page, "Impegno");
    const marked = page.getByRole("main").locator('[aria-current="true"]');
    await expect(section).toContainText("Cena dai nonni");

    const url = page.url();
    const monday = gridBlock(page, "Lunedì 19 ottobre", "Riunione di team");
    await monday.click();
    await expect(section).toContainText("Riunione di team");
    await expect(monday).toHaveAttribute("aria-current", "true");
    await expect(marked).toHaveCount(1);
    expect(page.url()).toBe(url);

    await busyItem(page, "Paolo").click();
    await gridColumn(page, "Lunedì 19 ottobre")
      .getByText("Liberi insieme")
      .click();
    await expect(section).toContainText("Riunione di team");
    await expect(section).not.toContainText("Cena dai nonni");
    await expect(monday).toHaveAttribute("aria-current", "true");
    expect(page.url()).toBe(url);
  });

  test("CA-31: Invio sul blocco lo sceglie come il clic", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await createEvent(bianchi, "Giulia", {
      title: "Cena dai nonni",
      day: TUE,
      from: "19:30",
      to: "21:30",
    });
    await createEvent(bianchi, "Giulia", {
      title: "Riunione di team",
      day: MON,
      from: "10:00",
      to: "11:00",
    });
    await open(page, baseURL, bianchi);
    const monday = gridBlock(page, "Lunedì 19 ottobre", "Riunione di team");
    await monday.focus();
    await page.keyboard.press("Enter");
    await expect(panel(page, "Impegno")).toContainText("Riunione di team");
    await expect(monday).toHaveAttribute("aria-current", "true");
  });

  test("CA-32: la linea «adesso» segue il minuto e c'è solo nella settimana di oggi", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await createEvent(bianchi, "Giulia", {
      title: "Riunione di team",
      day: MON,
      from: "10:00",
      to: "11:00",
    });
    await open(page, baseURL, bianchi);
    const column = gridColumn(page, "Martedì 20 ottobre");
    await expect(column.getByLabel("Adesso, 15:52")).toBeAttached();
    await page.clock.runFor(60_000);
    await expect(column.getByLabel("Adesso, 15:53")).toBeAttached();
    await expect(page.getByLabel(/^Adesso,/)).toHaveCount(1);
    await nextWeek(page).click();
    await expect(h1(page)).toHaveText("26 ottobre – 1 novembre");
    await expect(page.getByLabel(/^Adesso,/)).toHaveCount(0);
  });
});

// ----------------------------------------------------- empty, loading, errors

test.describe("stato vuoto, caricamento, errori", () => {
  test("CA-33: senza impegni la settimana è vuota", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await open(page, baseURL, bianchi);
    await expect(
      page.getByText("Questa settimana è ancora vuota"),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Aggiungi un impegno" }),
    ).toHaveAttribute("href", "/aggiungi");
    // Provisional text until Calendari collegati (#34), decision of 31/10.
    await expect(
      page.getByText(
        "Gli impegni che aggiungi compaiono qui, giorno per giorno.",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Collega il calendario" }),
    ).toHaveCount(0);
    await expect(page.getByText("Liberi insieme")).toHaveCount(0);
    if (isMobileProject()) {
      for (const label of ["Lunedì 19", "Martedì 20", "Domenica 25"]) {
        await expect(
          tab(page, `${label} ottobre`, 0),
          `${label} a zero`,
        ).toBeVisible();
      }
    } else {
      await expect(
        panel(page, "Serate libere insieme").getByText(
          "Ancora niente da calcolare",
        ),
      ).toBeVisible();
    }
  });

  test("CA-34: mentre legge gli impegni mostra il titolo e il caricamento", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await createEvent(bianchi, "Giulia", {
      title: "Cena da Marta",
      day: FRI,
      from: "20:00",
      to: "23:00",
    });
    const held = await holdReads(page);
    try {
      await open(page, baseURL, bianchi, { settle: false });
      await expect(h1(page)).toHaveText("19 – 25 ottobre");
      await expect(busyLoading(page).first()).toBeVisible();
    } finally {
      held.release();
    }
    await expect(
      page.getByRole("link", { name: /Cena da Marta/ }).first(),
    ).toBeVisible();
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  });

  test("CA-35: se la prima lettura fallisce c'è l'errore con «Riprova»", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await createEvent(bianchi, "Giulia", {
      title: "Cena da Marta",
      day: FRI,
      from: "20:00",
      to: "23:00",
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
    await expect(
      page.getByRole("link", { name: /Cena da Marta/ }).first(),
    ).toBeVisible();
    await expect(h1(page)).toHaveText("19 – 25 ottobre");
  });

  /** Page with «Cena da Marta» read, then the network goes away (CA-36). */
  async function goOffline(
    page: Page,
    baseURL: string | undefined,
    bianchi: CasaNest,
  ) {
    await createEvent(bianchi, "Giulia", {
      title: "Cena da Marta",
      day: FRI,
      from: "20:00",
      to: "23:00",
      participants: ["Giulia", "Paolo"],
    });
    await open(page, baseURL, bianchi);
    await expect(
      page.getByRole("link", { name: /Cena da Marta/ }).first(),
    ).toBeVisible();
    await page.context().setOffline(true);
    await nextWeek(page).click();
    // A week never read: its own notice, the arrows stay (decision of 31/10).
    await expect(h1(page)).toHaveText("26 ottobre – 1 novembre");
    await expect(
      alerts(page).filter({
        hasText:
          "Non riusciamo a caricare questa settimana. Controlla la connessione e riprova.",
      }),
    ).toBeVisible();
    await expect(previousWeek(page)).toBeVisible();
    await expect(nextWeek(page)).toBeVisible();
    await previousWeek(page).click();
    await expect(h1(page)).toHaveText("19 – 25 ottobre");
  }

  const OFFLINE_ALERT =
    "Non riusciamo ad aggiornare il calendario. Vedi gli impegni salvati alle";

  test("CA-36: offline restano gli impegni già letti con l'avviso, poi torna tutto", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    try {
      await goOffline(page, baseURL, bianchi);
      await expect(
        page.getByRole("link", { name: /Cena da Marta/ }).first(),
      ).toBeVisible();
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
});

// ---------------------------------------------------------------- time zone

test.describe("fuso orario", () => {
  test.use({ timezoneId: "America/New_York" });

  test("CA-37: con il browser a New York l'impegno resta all'ora di Roma", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await createEvent(bianchi, "Giulia", {
      title: "Cena del cambio ora",
      day: SUN,
      from: "20:00",
      to: "21:00",
    });
    await open(page, baseURL, bianchi);
    await expect(h1(page)).toHaveText("19 – 25 ottobre");
    if (isMobileProject()) {
      const row = dayRows(page, SUN_H).filter({
        hasText: "Cena del cambio ora",
      });
      await expect(row).toHaveCount(1);
      await expect(row).toContainText("20:00");
      return;
    }
    const column = gridColumn(page, "Domenica 25 ottobre");
    const block = gridBlock(page, "Domenica 25 ottobre", "Cena del cambio ora");
    await expect(block).toBeVisible();
    const columnBox = (await column.boundingBox())!;
    const box = (await block.boundingBox())!;
    // 12 hours x 40 px = 480 px; ±4 px as in CA-28 (mockup offsets).
    expect(Math.abs(box.y - columnBox.y - 480)).toBeLessThanOrEqual(4);
  });
});

// ---------------------------------------------------------------- isolation

test.describe("isolamento tra Nest", () => {
  const FORBIDDEN = ["Cena dai nonni", "Marco"];

  test("CA-38: gli impegni di un altro Nest non arrivano, con nessuna lente", async ({
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
      day: TUE,
      from: "17:00",
      to: "18:00",
    });
    const net = watchNetwork(page);
    await open(page, baseURL, bianchi);
    await expect(
      page.getByRole("link", { name: /Spesa grande/ }).first(),
    ).toBeVisible();

    const check = async () => {
      const dom = await page.content();
      const bodies = await net.bodies();
      for (const text of FORBIDDEN) {
        expect(dom, `DOM: ${text}`).not.toContain(text);
        expect(bodies, `rete: ${text}`).not.toContain(text);
      }
      await expect(busyItem(page, "Marco")).toHaveCount(0);
      if (isMobileProject()) {
        await expect(tab(page, "Martedì 20 ottobre", 1)).toBeVisible();
      }
    };
    await check();
    await chooseLens(page, "Nest");
    await expect(
      page.getByRole("link", { name: /Spesa grande/ }).first(),
    ).toBeVisible();
    await check();
    const html = await (await page.request.get(PATH)).text();
    for (const text of FORBIDDEN)
      expect(html, `HTML: ${text}`).not.toContain(text);
  });

  test("CA-38: un utente del seed (Casa Bianchi) non vede gli impegni di un Nest di prova", async ({
    page,
    baseURL,
    casa,
  }) => {
    test.skip(!usersConfigured("B"), skipReason("B"));
    const admin = adminClient();
    const { count } = await admin
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("household_id", SEED_HOME_B)
      .in("title", ["Cena dai nonni", "Impegno riservato"]);
    expect(count, "il Nest del seed non ha questi impegni").toBe(0);
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
    const net = watchNetwork(page);
    await page.clock.install({ time: new Date(TODAY.getTime() - 120_000) });
    await signInAs(page.context(), baseURL as string, "B");
    await page.goto(PATH);
    await expect(h1(page)).toHaveText("19 – 25 ottobre");
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
    await chooseLens(page, "Nest");
    expect(await page.content()).not.toContain("Cena dai nonni");
    expect(await net.bodies()).not.toContain("Cena dai nonni");
    await expect(page.getByText("Marco ha un impegno")).toHaveCount(0);
  });

  test("CA-39: gli impegni di un altro Nest non tolgono la serata libera", async ({
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
      title: "Riunione del lunedì",
      day: MON,
      from: "10:00",
      to: "11:00",
    });
    await open(page, baseURL, bianchi);
    await expectInsieme(page, TUE_H, {
      desktop: SERA,
      mobile: SERA_MOBILE,
      time: "18:00",
    });
  });
});

// ------------------------------------------------------------ accessibility

test.describe("accessibilità", () => {
  async function expectAccessible(page: Page) {
    // axe runs on timers: the clock runs again for the analysis.
    await page.clock.resume();
    expect(await axeProblems(page), "violazioni serious o critical").toEqual(
      [],
    );
    expect(await noDuplicateIds(page), "id duplicati").toEqual([]);
  }

  async function withEvents(bianchi: CasaNest) {
    await createEvent(bianchi, "Giulia", {
      title: "Cena da Marta",
      day: FRI,
      from: "20:00",
      to: "23:00",
      participants: ["Giulia", "Paolo"],
    });
    await createEvent(bianchi, "Paolo", {
      title: "Impegno riservato",
      day: TUE,
      from: "9:00",
      to: "15:00",
      visibility: "busy",
    });
  }

  test("CA-40: stato normale con la lente «Io»", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await withEvents(bianchi);
    await open(page, baseURL, bianchi, { lens: "io" });
    await expect(
      page.getByRole("link", { name: /Cena da Marta/ }).first(),
    ).toBeVisible();
    await expectAccessible(page);
  });

  test("CA-40: stato normale con la lente «Nest»", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await withEvents(bianchi);
    await open(page, baseURL, bianchi, { lens: "nest" });
    await expect(busyItem(page, "Paolo")).toBeVisible();
    await expectAccessible(page);
  });

  test("CA-40: stato vuoto", async ({ page, baseURL, bianchi }) => {
    await open(page, baseURL, bianchi);
    await expect(
      page.getByText("Questa settimana è ancora vuota"),
    ).toBeVisible();
    await expectAccessible(page);
  });

  test("CA-40: stato di caricamento", async ({ page, baseURL, bianchi }) => {
    await withEvents(bianchi);
    const held = await holdReads(page);
    try {
      await open(page, baseURL, bianchi, { settle: false });
      await expect(busyLoading(page).first()).toBeVisible();
      await expectAccessible(page);
    } finally {
      held.release();
    }
  });

  test("CA-40: stato di errore offline", async ({ page, baseURL, bianchi }) => {
    await withEvents(bianchi);
    await open(page, baseURL, bianchi);
    await expect(
      page.getByRole("link", { name: /Cena da Marta/ }).first(),
    ).toBeVisible();
    try {
      await page.context().setOffline(true);
      await nextWeek(page).click();
      await previousWeek(page).click();
      await expect(h1(page)).toHaveText("19 – 25 ottobre");
      await expect(
        alerts(page).filter({ hasText: OFFLINE_ALERT_AXE }),
      ).toBeVisible();
      await expectAccessible(page);
    } finally {
      await page.context().setOffline(false);
    }
  });
});
