import { existsSync, readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import {
  signInAs,
  skipReason,
  usersConfigured,
  type TestUserKey,
} from "../fixtures/auth";
import {
  PLACEHOLDERS,
  getActiveNavItem,
  getActiveSettingsItem,
  getBarConfig,
  hasBottomNav,
} from "../../src/lib/app-routes";

// Layout and navigation (#10). These tests need no test users: public
// routes, redirects without a session, placeholders and pure rules.
// The tests with signed-in users depend on the test users (#55).

const PROTECTED_ROUTES = [
  "/oggi",
  "/aggiungi",
  "/calendario",
  "/casa/spesa",
  "/nest",
  "/notifiche",
  "/ricerca",
  "/profilo",
  "/calendari-collegati",
  "/impostazioni",
  "/membri",
];

test.describe("sessione", () => {
  for (const route of PROTECTED_ROUTES) {
    test(`CA-1: senza sessione ${route} porta a /accesso`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/accesso$/);
      await expect(
        page.getByRole("heading", { level: 1, name: "Accesso" }),
      ).toBeVisible();
      await expect(
        page.getByRole("navigation", { name: "Navigazione principale" }),
      ).toHaveCount(0);
    });
  }

  test("CA-2: un cookie di sessione alterato porta a /accesso", async ({
    page,
    context,
    baseURL,
  }) => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    test.skip(!supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL non impostato");
    const projectRef = new URL(supabaseUrl!).hostname.split(".")[0]!;
    await context.addCookies([
      {
        name: `sb-${projectRef}-auth-token`,
        value: "valore-non-valido",
        url: baseURL!,
      },
    ]);
    await page.goto("/oggi");
    await expect(page).toHaveURL(/\/accesso$/);
    await expect(page.locator("body")).not.toContainText("Casa D'Angelo");
    await expect(page.locator("body")).not.toContainText("Casa Bianchi");
  });

  test("CA-4: senza sessione / e /casa finiscono su /accesso", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/accesso$/);
    await page.goto("/casa");
    await expect(page).toHaveURL(/\/accesso$/);
  });

  test("un indirizzo inesistente senza sessione porta a /accesso", async ({
    page,
  }) => {
    for (const route of ["/pippo", "/oggi/pippo"]) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/accesso$/);
    }
  });

  test("CA-5: non esiste un middleware", () => {
    expect(existsSync("middleware.ts")).toBe(false);
    expect(existsSync("src/middleware.ts")).toBe(false);
    expect(existsSync("proxy.ts")).toBe(false);
    expect(existsSync("src/proxy.ts")).toBe(false);
  });
});

test.describe("pagine fuori dalla cornice", () => {
  test("/accesso: un solo h1, un solo main, nessuna navigazione", async ({
    page,
  }) => {
    const response = await page.goto("/accesso");
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle("FamilyNest · Accesso");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(
      page.getByRole("heading", { level: 1, name: "Accesso" }),
    ).toBeVisible();
    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(page.getByRole("navigation")).toHaveCount(0);
  });

  test("/onboarding: segnaposto senza cornice", async ({ page }) => {
    const response = await page.goto("/onboarding");
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle("FamilyNest · Chi vive con te?");
    await expect(
      page.getByRole("heading", { level: 1, name: "Chi vive con te?" }),
    ).toBeVisible();
    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(page.getByRole("navigation")).toHaveCount(0);
    await expect(page.getByText("In arrivo")).toBeVisible();
  });
});

test.describe("regole di navigazione (funzioni pure)", () => {
  test("voce attiva su mobile", () => {
    const mobile = (path: string) => getActiveNavItem(path, "mobile");
    expect(mobile("/oggi")).toBe("oggi");
    expect(mobile("/aggiungi")).toBe("oggi");
    expect(mobile("/calendario")).toBe("calendario");
    expect(mobile("/calendario/mese")).toBe("calendario");
    expect(mobile("/impegni/abc")).toBe("calendario");
    expect(mobile("/casa/spesa")).toBe("casa");
    expect(mobile("/casa/scadenze")).toBeNull();
    expect(mobile("/notifiche")).toBe("oggi");
    expect(mobile("/esplora/palestra")).toBe("oggi");
    expect(mobile("/figli/sofia")).toBe("oggi");
    expect(mobile("/ricerca")).toBeNull();
    expect(mobile("/nest")).toBeNull();
  });

  test("voce attiva su desktop", () => {
    const desktop = (path: string) => getActiveNavItem(path, "desktop");
    expect(desktop("/oggi")).toBe("oggi");
    expect(desktop("/aggiungi")).toBe("oggi");
    expect(desktop("/ricerca")).toBe("oggi");
    expect(desktop("/calendario")).toBe("calendario");
    expect(desktop("/casa/spesa")).toBe("casa");
    for (const path of [
      "/nest",
      "/notifiche",
      "/esplora/palestra",
      "/figli/sofia",
      "/profilo",
      "/calendari-collegati",
      "/impostazioni",
      "/membri",
    ]) {
      expect(desktop(path)).toBeNull();
    }
  });

  test("il prefisso non confonde rotte simili", () => {
    expect(getActiveNavItem("/casalinga", "mobile")).toBeNull();
    expect(getActiveSettingsItem("/membri-extra")).toBeNull();
  });

  test("navigazione in basso", () => {
    for (const path of [
      "/oggi",
      "/aggiungi",
      "/calendario",
      "/casa/spesa",
      "/notifiche",
    ]) {
      expect(hasBottomNav(path)).toBe(true);
    }
    for (const path of [
      "/nest",
      "/ricerca",
      "/profilo",
      "/calendari-collegati",
      "/impostazioni",
      "/membri",
    ]) {
      expect(hasBottomNav(path)).toBe(false);
    }
  });

  test("menu laterale delle impostazioni", () => {
    expect(getActiveSettingsItem("/profilo")).toBe("profilo");
    expect(getActiveSettingsItem("/calendari-collegati")).toBe(
      "calendari-collegati",
    );
    expect(getActiveSettingsItem("/impostazioni")).toBe("impostazioni");
    expect(getActiveSettingsItem("/membri/laura")).toBe("membri");
    expect(getActiveSettingsItem("/oggi")).toBeNull();
  });

  test("forma della barra in alto", () => {
    expect(getBarConfig("/oggi")).toEqual({
      kind: "section",
      center: "lens",
      right: "bell",
    });
    expect(getBarConfig("/calendario")).toEqual({
      kind: "section",
      center: "lens",
      right: "search",
    });
    expect(getBarConfig("/casa/spesa")).toEqual({
      kind: "section",
      center: "title",
      right: "search",
    });
    expect(getBarConfig("/nest")).toEqual({ kind: "close", href: "/oggi" });
    expect(getBarConfig("/profilo")).toEqual({
      kind: "detail",
      fallback: "/nest",
    });
    expect(getBarConfig("/notifiche")).toEqual({
      kind: "detail",
      fallback: "/oggi",
    });
  });

  test("ogni segnaposto ha titolo e titolo del browser", () => {
    for (const def of Object.values(PLACEHOLDERS)) {
      expect(def.browserTitle).toBe(
        def.title === "Casa"
          ? "FamilyNest · Casa · Spesa"
          : `FamilyNest · ${def.title}`,
      );
    }
  });
});

test.describe("controlli statici del codice", () => {
  test("«Riprova» dell'errore di pagina rilegge i dati con retry()", () => {
    const source = readFileSync("src/app/(app)/error.tsx", "utf8");
    expect(source).toMatch(/\bretry\b/);
    expect(source).not.toMatch(/\breset\b/);
  });

  test("ogni pagina dell'area (app) chiama requireNest()", () => {
    const pages = [
      "oggi",
      "aggiungi",
      "calendario",
      "casa/spesa",
      "nest",
      "notifiche",
      "ricerca",
      "profilo",
      "calendari-collegati",
      "impostazioni",
      "membri",
      "[...rest]",
    ];
    for (const page of pages) {
      const source = readFileSync(`src/app/(app)/${page}/page.tsx`, "utf8");
      expect(source, page).toContain("await requireNest()");
    }
  });
});

// ---------------------------------------------------------------------------
// Tests with signed-in users (A = Marco, B = Giulia, C = no Nest).
// They are skipped, with a reason, while the test users are not available.
// ---------------------------------------------------------------------------

const NAV = { name: "Navigazione principale" };
const LENS = "Punto di vista: solo tu o tutto il Nest";
const NEST_LINK = /^Apri .+: membri, Esplora e impostazioni$/;
const NEST_A = "Apri Casa D'Angelo: membri, Esplora e impostazioni";
const NEST_B = "Apri Casa Bianchi: membri, Esplora e impostazioni";
// the app writes the title with a typographic apostrophe
const NOT_FOUND_TITLE = /Questa pagina non c['’]è/;
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const SCREENS: [route: string, h1: string, title: string][] = [
  ["/oggi", "Oggi", "FamilyNest · Oggi"],
  ["/aggiungi", "Aggiungi", "FamilyNest · Aggiungi"],
  ["/calendario", "Calendario", "FamilyNest · Calendario"],
  ["/casa/spesa", "Casa", "FamilyNest · Casa · Spesa"],
  ["/nest", "Il tuo Nest", "FamilyNest · Il tuo Nest"],
  ["/notifiche", "Notifiche", "FamilyNest · Notifiche"],
  ["/ricerca", "Ricerca", "FamilyNest · Ricerca"],
  ["/profilo", "Il tuo profilo", "FamilyNest · Il tuo profilo"],
  [
    "/calendari-collegati",
    "Calendari collegati",
    "FamilyNest · Calendari collegati",
  ],
  [
    "/impostazioni",
    "Impostazioni della casa",
    "FamilyNest · Impostazioni della casa",
  ],
  ["/membri", "Chi c’è", "FamilyNest · Chi c’è"],
];

/** Runs a describe only on one Playwright project (390 or 1280 px). */
function onlyOn(project: "mobile" | "desktop") {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name !== project,
      `Si esegue solo sul progetto ${project}`,
    );
  });
}

/** Skips the test, with a reason, when the test user is not available. */
function withUser(...users: TestUserKey[]) {
  test.skip(!usersConfigured(...users), skipReason(...users));
}

async function openAs(
  page: Page,
  baseURL: string | undefined,
  user: TestUserKey,
  route: string,
) {
  await signInAs(page.context(), baseURL as string, user);
  return page.goto(route);
}

/** Clicks a lens button until the client has hydrated and the state changes. */
async function chooseLens(page: Page, which: "Io" | "Nest") {
  const group = page.getByRole("group", { name: LENS });
  const button = group.getByRole("button", { name: new RegExp(`${which}$`) });
  await expect(async () => {
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true", {
      timeout: 1000,
    });
  }).toPass();
}

function mainNav(page: Page) {
  return page.getByRole("navigation", NAV);
}

function settingsMenu(page: Page) {
  return page.getByRole("navigation", { name: "Impostazioni" });
}

function visibleHeader(page: Page) {
  return page.locator("header").filter({ visible: true });
}

test.describe("sessione con utenti", () => {
  test("CA-3: C senza Nest va a /onboarding", async ({ page, baseURL }) => {
    withUser("C");
    await openAs(page, baseURL, "C", "/oggi");
    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Chi vive con te?" }),
    ).toBeVisible();
    await expect(mainNav(page)).toHaveCount(0);
  });

  test("CA-4: A, / porta a /oggi e /casa a /casa/spesa", async ({
    page,
    baseURL,
  }) => {
    withUser("A");
    await openAs(page, baseURL, "A", "/");
    await expect(page).toHaveURL(/\/oggi$/);
    await page.goto("/casa");
    await expect(page).toHaveURL(/\/casa\/spesa$/);
  });

  test("un indirizzo inesistente mostra «Questa pagina non c'è» dentro la cornice", async ({
    page,
    baseURL,
  }) => {
    withUser("A");
    for (const route of ["/pippo", "/oggi/pippo"]) {
      await openAs(page, baseURL, "A", route);
      await expect(
        page.getByRole("heading", { level: 1, name: NOT_FOUND_TITLE }),
      ).toBeVisible();
      await expect(page.getByRole("main")).toHaveCount(1);
    }
  });

  test("un indirizzo sotto /casa non resta in Casa: un solo h1 e nessuna voce attiva", async ({
    page,
    baseURL,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "Caso a 390 px");
    withUser("A");
    await openAs(page, baseURL, "A", "/casa/pippo");
    await expect(
      page.getByRole("heading", { name: NOT_FOUND_TITLE }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(mainNav(page).locator('[aria-current="page"]')).toHaveCount(0);
  });
  test("/casa/da-fare non esiste ancora: un solo h1 e nessuna voce attiva", async ({
    page,
    baseURL,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "Caso a 390 px");
    withUser("A");
    await openAs(page, baseURL, "A", "/casa/da-fare");
    await expect(
      page.getByRole("heading", { name: NOT_FOUND_TITLE }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(mainNav(page).locator('[aria-current="page"]')).toHaveCount(0);
  });
});

test.describe("segnaposto", () => {
  for (const [route, h1, title] of SCREENS) {
    test(`CA-6: A apre ${route}: stato 200, un solo h1 «${h1}», titolo, segnaposto`, async ({
      page,
      baseURL,
    }) => {
      withUser("A");
      const response = await openAs(page, baseURL, "A", route);
      expect(response?.status()).toBe(200);
      await expect(page).toHaveURL(new RegExp(`${route}$`));
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(
        page.getByRole("heading", { level: 1, name: h1, exact: true }),
      ).toBeVisible();
      await expect(page).toHaveTitle(title);
      const placeholder = page.getByTestId("pagina-segnaposto");
      await expect(placeholder).toBeVisible();
      // empty state of the design system
      await expect(placeholder).toContainText("In arrivo");
    });
  }
});

test.describe("mobile 390 px", () => {
  onlyOn("mobile");

  test("CA-7: /oggi mostra navigazione in basso e barra in alto", async ({
    page,
    baseURL,
  }) => {
    withUser("A");
    await openAs(page, baseURL, "A", "/oggi");
    const nav = mainNav(page);
    await expect(nav).toBeVisible();
    const links = nav.getByRole("link");
    await expect(links).toHaveText(["Oggi", "Calendario", "Casa", "Aggiungi"]);
    const hrefs = await links.evaluateAll((els) =>
      els.map((el) => el.getAttribute("href")),
    );
    expect(hrefs).toEqual(["/oggi", "/calendario", "/casa/spesa", "/aggiungi"]);
    await expect(
      page.getByRole("link", { name: "FamilyNest", exact: true }),
    ).toHaveCount(0);
    const bar = visibleHeader(page);
    await expect(bar).toHaveCount(1);
    await expect(bar.getByRole("link", { name: NEST_A })).toBeVisible();
    await expect(bar.getByRole("group", { name: LENS })).toBeVisible();
    await expect(bar.getByRole("link", { name: "Notifiche" })).toBeVisible();
  });

  test("CA-8: i quattro tocchi della navigazione in basso", async ({
    page,
    baseURL,
  }) => {
    withUser("A");
    await openAs(page, baseURL, "A", "/oggi");
    const steps: [string, RegExp, string][] = [
      ["Calendario", /\/calendario$/, "Calendario"],
      ["Casa", /\/casa\/spesa$/, "Casa"],
      ["Aggiungi", /\/aggiungi$/, "Oggi"],
      ["Oggi", /\/oggi$/, "Oggi"],
    ];
    for (const [name, url, current] of steps) {
      await mainNav(page).getByRole("link", { name, exact: true }).click();
      await expect(page).toHaveURL(url);
      const active = mainNav(page).locator('[aria-current="page"]');
      await expect(active).toHaveCount(1);
      await expect(active).toHaveText(current);
    }
  });

  test("CA-9: /notifiche evidenzia Oggi, le altre rotte senza navigazione in basso", async ({
    page,
    baseURL,
  }) => {
    withUser("A");
    await openAs(page, baseURL, "A", "/notifiche");
    const active = mainNav(page).locator('[aria-current="page"]');
    await expect(active).toHaveCount(1);
    await expect(active).toHaveText("Oggi");
    for (const route of [
      "/nest",
      "/ricerca",
      "/profilo",
      "/calendari-collegati",
      "/impostazioni",
      "/membri",
    ]) {
      await page.goto(route);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(mainNav(page), route).toHaveCount(0);
    }
  });

  test("CA-10: barra e navigazione restano al loro posto, il contenuto non finisce coperto", async ({
    page,
    baseURL,
  }) => {
    withUser("A");
    await openAs(page, baseURL, "A", "/oggi");
    await expect(mainNav(page)).toBeVisible();
    const positions = await page.evaluate(() => {
      const nav = document.querySelector("nav.nav-basso");
      const bar = document.querySelector("header.barra");
      return {
        nav: nav ? getComputedStyle(nav).position : null,
        bar: bar ? getComputedStyle(bar).position : null,
      };
    });
    expect(["fixed", "sticky"]).toContain(positions.nav);
    expect(["fixed", "sticky"]).toContain(positions.bar);

    // Makes the page taller than the screen, then scrolls to the very bottom.
    await page.evaluate(() => {
      const filler = document.createElement("div");
      filler.dataset.testid = "riempitivo";
      filler.style.height = "2500px";
      document.querySelector("main")?.appendChild(filler);
    });
    await page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight),
    );
    const filler = page.getByTestId("riempitivo");
    await expect(async () => {
      const lastBox = await filler.boundingBox();
      const navBox = await mainNav(page).boundingBox();
      expect(lastBox && navBox).toBeTruthy();
      expect(lastBox!.y + lastBox!.height).toBeLessThanOrEqual(navBox!.y + 1);
    }).toPass();
    // the top bar is still at the top while the page is scrolled
    const barBox = await visibleHeader(page).boundingBox();
    expect(barBox!.y).toBeLessThanOrEqual(1);
  });

  test("CA-11: la barra di Calendario e di Casa", async ({ page, baseURL }) => {
    withUser("A");
    await openAs(page, baseURL, "A", "/calendario");
    let bar = visibleHeader(page);
    await expect(bar.getByRole("link", { name: NEST_A })).toBeVisible();
    await expect(bar.getByRole("group", { name: LENS })).toBeVisible();
    await expect(
      bar.getByRole("link", { name: "Cerca nel Nest" }),
    ).toHaveAttribute("href", "/ricerca");
    await expect(bar.getByRole("link", { name: "Notifiche" })).toHaveCount(0);

    await page.goto("/casa/spesa");
    bar = visibleHeader(page);
    await expect(bar.getByRole("link", { name: NEST_A })).toBeVisible();
    await expect(
      bar.getByRole("heading", { level: 1, name: "Casa" }),
    ).toBeVisible();
    await expect(
      bar.getByRole("link", { name: "Cerca nel Nest" }),
    ).toBeVisible();
    await expect(bar.getByRole("group", { name: LENS })).toHaveCount(0);
  });

  test("CA-12: «Chiudi» del Nest porta a /oggi e la barra non ha il quadrato", async ({
    page,
    baseURL,
  }) => {
    withUser("A");
    await openAs(page, baseURL, "A", "/nest");
    const bar = visibleHeader(page);
    await expect(bar.getByRole("link", { name: NEST_LINK })).toHaveCount(0);
    await bar.getByLabel("Chiudi", { exact: true }).click();
    await expect(page).toHaveURL(/\/oggi$/);
  });

  test("CA-13: «Indietro» torna alla pagina precedente o al ripiego", async ({
    page,
    baseURL,
    context,
  }) => {
    withUser("A");
    await openAs(page, baseURL, "A", "/oggi");
    await page.getByRole("link", { name: "Notifiche", exact: true }).click();
    await expect(page).toHaveURL(/\/notifiche$/);
    await page.getByLabel("Indietro", { exact: true }).click();
    await expect(page).toHaveURL(/\/oggi$/);

    const fallbacks: [string, RegExp][] = [
      ["/profilo", /\/nest$/],
      ["/calendari-collegati", /\/nest$/],
      ["/impostazioni", /\/nest$/],
      ["/membri", /\/nest$/],
      ["/notifiche", /\/oggi$/],
      ["/ricerca", /\/oggi$/],
    ];
    for (const [route, expected] of fallbacks) {
      const fresh = await context.newPage();
      await fresh.goto(route);
      await fresh.getByLabel("Indietro", { exact: true }).click();
      await expect(fresh, route).toHaveURL(expected);
      await fresh.close();
    }
  });

  test("CA-14: /profilo non ha il menu «Impostazioni»", async ({
    page,
    baseURL,
  }) => {
    withUser("A");
    await openAs(page, baseURL, "A", "/profilo");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(settingsMenu(page)).toHaveCount(0);
  });

  test("CA-30: la campanella si chiama «Notifiche», senza pallino", async ({
    page,
    baseURL,
  }) => {
    withUser("A");
    await openAs(page, baseURL, "A", "/oggi");
    const bell = page.getByRole("link", { name: "Notifiche", exact: true });
    await expect(bell).toBeVisible();
    await expect(bell.locator(".btn-icona__punto")).toHaveCount(0);
    await bell.click();
    await expect(page).toHaveURL(/\/notifiche$/);
  });

  test("CA-25: la lente parte su «Io» con gli avatar giusti", async ({
    page,
    baseURL,
  }) => {
    withUser("A");
    await openAs(page, baseURL, "A", "/oggi");
    const lens = page.getByRole("group", { name: LENS });
    const io = lens.getByRole("button", { name: /Io$/ });
    const nest = lens.getByRole("button", { name: /Nest$/ });
    await expect(io).toHaveAttribute("aria-pressed", "true");
    await expect(nest).toHaveAttribute("aria-pressed", "false");
    await expect(io.getByLabel("Marco", { exact: true })).toBeVisible();
    await expect(
      nest.getByLabel("Marco, Laura, Sofia", { exact: true }),
    ).toBeVisible();
  });

  test("CA-26: cambiare lente non cambia indirizzo né ricarica", async ({
    page,
    baseURL,
  }) => {
    withUser("A");
    await openAs(page, baseURL, "A", "/oggi");
    const lens = page.getByRole("group", { name: LENS });
    await expect(lens).toBeVisible();
    const navigations: string[] = [];
    page.on("request", (request) => {
      if (request.isNavigationRequest()) navigations.push(request.url());
    });
    await chooseLens(page, "Nest");
    await expect(lens.getByRole("button", { name: /Io$/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await expect(page).toHaveURL(/\/oggi$/);
    expect(navigations).toEqual([]);
  });

  test("CA-27: la lente resta cambiando pagina e ricaricando", async ({
    page,
    baseURL,
  }) => {
    withUser("A");
    await openAs(page, baseURL, "A", "/oggi");
    await chooseLens(page, "Nest");
    await mainNav(page).getByRole("link", { name: "Calendario" }).click();
    await expect(page).toHaveURL(/\/calendario$/);
    const nestButton = page
      .getByRole("group", { name: LENS })
      .getByRole("button", { name: /Nest$/ });
    await expect(nestButton).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await expect(nestButton).toHaveAttribute("aria-pressed", "true");
  });

  test("CA-28: una nuova sessione del browser riparte da «Io»", async ({
    page,
    baseURL,
    browser,
  }) => {
    withUser("A");
    await openAs(page, baseURL, "A", "/oggi");
    await chooseLens(page, "Nest");

    const fresh = await browser.newContext({
      baseURL,
      viewport: { width: 390, height: 844 },
    });
    try {
      await signInAs(fresh, baseURL as string, "A");
      const other = await fresh.newPage();
      await other.goto("/oggi");
      const lens = other.getByRole("group", { name: LENS });
      await expect(lens.getByRole("button", { name: /Io$/ })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await expect(lens.getByRole("button", { name: /Nest$/ })).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    } finally {
      await fresh.close();
    }
  });

  test("CA-31: B vede solo il proprio Nest e nell'HTML non c'è nulla di A", async ({
    page,
    baseURL,
  }) => {
    withUser("B");
    await signInAs(page.context(), baseURL as string, "B");
    const response = await page.goto("/oggi");
    const html = await response!.text();
    const nest = page.getByRole("link", { name: NEST_B });
    await expect(nest).toBeVisible();
    await expect(nest.locator("[data-color]")).toHaveCount(4);
    expect(
      await nest
        .locator("[data-color]")
        .evaluateAll((dots) => dots.map((d) => d.getAttribute("data-color"))),
    ).toEqual(["cobalto", "salvia", "zafferano", "pomodoro"]);
    const lens = page.getByRole("group", { name: LENS });
    await expect(lens.getByLabel("Giulia", { exact: true })).toBeVisible();
    await expect(
      lens.getByLabel("Giulia, Paolo, Leo", { exact: true }),
    ).toBeVisible();

    const content = html + (await page.content());
    expect(content).not.toMatch(
      /Casa D(?:'|&#x27;|&#39;|&apos;|\\u0027)Angelo/,
    );
    for (const word of ["Marco", "Laura", "Sofia", "Tommaso", "Biscotto"]) {
      expect(content, word).not.toContain(word);
    }
  });

  test("CA-33: mobile, un solo main e nessuna navigazione dove non prevista", async ({
    page,
    baseURL,
  }) => {
    withUser("A");
    await signInAs(page.context(), baseURL as string, "A");
    for (const route of [
      "/nest",
      "/ricerca",
      "/profilo",
      "/calendari-collegati",
      "/impostazioni",
      "/membri",
    ]) {
      await page.goto(route);
      await expect(page.getByRole("main"), route).toHaveCount(1);
      await expect(mainNav(page), route).toHaveCount(0);
    }
    for (const route of ["/oggi", "/casa/spesa"]) {
      await page.goto(route);
      await expect(page.getByRole("main"), route).toHaveCount(1);
      await expect(mainNav(page), route).toHaveCount(1);
    }
  });
});

test.describe("desktop 1280 px", () => {
  onlyOn("desktop");

  test("CA-15: la navigazione in alto ha le voci nell'ordine giusto", async ({
    page,
    baseURL,
  }) => {
    withUser("A");
    await openAs(page, baseURL, "A", "/oggi");
    const header = visibleHeader(page);
    await expect(header).toHaveCount(1);
    await expect(
      header.getByRole("link", { name: "FamilyNest" }),
    ).toBeVisible();
    const names = await header
      .getByRole("link")
      .evaluateAll((els) =>
        els.map((el) => el.getAttribute("aria-label") ?? el.textContent ?? ""),
      );
    expect(names).toEqual([
      "FamilyNest",
      "Oggi",
      "Calendario",
      "Casa",
      "Cerca nel Nest (⌘K)",
      "Notifiche",
      NEST_A,
    ]);
    const hrefs = await header
      .getByRole("link")
      .evaluateAll((els) => els.map((el) => el.getAttribute("href")));
    expect(hrefs).toEqual([
      "/oggi",
      "/oggi",
      "/calendario",
      "/casa/spesa",
      "/ricerca",
      "/notifiche",
      "/nest",
    ]);
    await expect(header.getByRole("navigation", NAV)).toBeVisible();
    // the only visible main navigation is the one in the header
    await expect(mainNav(page)).toHaveCount(1);
    await expect(page.getByRole("link", { name: "Aggiungi" })).toHaveCount(0);
  });

  test("CA-16: il logo porta a Oggi", async ({ page, baseURL }) => {
    withUser("A");
    await openAs(page, baseURL, "A", "/casa/spesa");
    await page.getByRole("link", { name: "FamilyNest", exact: true }).click();
    await expect(page).toHaveURL(/\/oggi$/);
    await expect(
      mainNav(page).getByRole("link", { name: "Oggi" }),
    ).toHaveAttribute("aria-current", "page");
  });

  test("CA-17: la voce attiva della navigazione in alto per ogni rotta", async ({
    page,
    baseURL,
  }) => {
    withUser("A");
    await signInAs(page.context(), baseURL as string, "A");
    const expected: Record<string, string | null> = {
      "/oggi": "Oggi",
      "/aggiungi": "Oggi",
      "/ricerca": "Oggi",
      "/calendario": "Calendario",
      "/casa/spesa": "Casa",
      "/nest": null,
      "/notifiche": null,
      "/profilo": null,
      "/calendari-collegati": null,
      "/impostazioni": null,
      "/membri": null,
    };
    for (const [route, voice] of Object.entries(expected)) {
      await page.goto(route);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const active = mainNav(page).locator("[aria-current]");
      if (voice) {
        await expect(active, route).toHaveCount(1);
        await expect(active, route).toHaveText(voice);
        await expect(active, route).toHaveAttribute("aria-current", "page");
      } else {
        await expect(active, route).toHaveCount(0);
      }
    }
  });

  for (const combo of ["Control+K", "Meta+K"]) {
    test(`CA-18: ${combo} porta a /ricerca`, async ({ page, baseURL }) => {
      withUser("A");
      await openAs(page, baseURL, "A", "/oggi");
      await chooseLens(page, "Nest"); // proves the page is interactive
      await page.evaluate(() =>
        (document.activeElement as HTMLElement)?.blur(),
      );
      await page.keyboard.press(combo);
      await expect(page).toHaveURL(/\/ricerca$/);
    });
  }

  test("CA-18: la scorciatoia non fa nulla dentro un campo di testo", async ({
    page,
    baseURL,
  }) => {
    withUser("A");
    await openAs(page, baseURL, "A", "/oggi");
    await chooseLens(page, "Nest"); // proves the page is interactive
    await page.evaluate(() => {
      const input = document.createElement("input");
      input.type = "text";
      input.setAttribute("aria-label", "Campo di prova");
      document.querySelector("main")?.prepend(input);
      input.focus();
    });
    const field = page.getByLabel("Campo di prova");
    await expect(field).toBeFocused();
    await page.keyboard.press("Control+K");
    await expect(field).toBeFocused();
    await expect(page).toHaveURL(/\/oggi$/);
    // outside the field the same shortcut works
    await field.evaluate((el) => (el as HTMLElement).blur());
    await page.keyboard.press("Control+K");
    await expect(page).toHaveURL(/\/ricerca$/);
  });

  test("CA-19: il menu «Impostazioni» di /profilo", async ({
    page,
    baseURL,
  }) => {
    withUser("A");
    await openAs(page, baseURL, "A", "/profilo");
    const menu = settingsMenu(page);
    await expect(menu).toBeVisible();
    const links = menu.getByRole("link");
    await expect(links).toHaveText([
      "Il tuo profilo",
      "Calendari collegati",
      "Casa D'Angelo",
      "Chi c’è",
      "Notifiche",
    ]);
    const hrefs = await links.evaluateAll((els) =>
      els.map((el) => el.getAttribute("href")),
    );
    expect(hrefs).toEqual([
      "/profilo",
      "/calendari-collegati",
      "/impostazioni",
      "/membri",
      "/impostazioni#notifiche",
    ]);
    await expect(menu.locator("[aria-current]")).toHaveCount(1);
    await expect(links.first()).toHaveAttribute("aria-current", "page");
  });

  test("CA-20: la voce attiva del menu «Impostazioni»", async ({
    page,
    baseURL,
  }) => {
    withUser("A");
    await signInAs(page.context(), baseURL as string, "A");
    const expected: [string, string][] = [
      ["/calendari-collegati", "Calendari collegati"],
      ["/impostazioni", "Casa D'Angelo"],
      ["/membri", "Chi c’è"],
    ];
    for (const [route, voice] of expected) {
      await page.goto(route);
      const active = settingsMenu(page).locator("[aria-current]");
      await expect(active, route).toHaveCount(1);
      await expect(active, route).toHaveText(voice);
    }
    await page.goto("/oggi");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(settingsMenu(page)).toHaveCount(0);
  });

  test("CA-21: la campanella apre la pagina, senza tendine", async ({
    page,
    baseURL,
  }) => {
    withUser("A");
    await openAs(page, baseURL, "A", "/oggi");
    await page.getByRole("link", { name: "Notifiche", exact: true }).click();
    await expect(page).toHaveURL(/\/notifiche$/);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("menu")).toHaveCount(0);
  });

  test("CA-23: a 800 px il main è stretto e centrato", async ({
    page,
    baseURL,
  }) => {
    withUser("A");
    await page.setViewportSize({ width: 800, height: 900 });
    await openAs(page, baseURL, "A", "/oggi");
    const main = page.getByRole("main");
    await expect(main).toBeVisible();
    const box = await main.boundingBox();
    expect(box!.width).toBeLessThanOrEqual(720.5);
    const left = box!.x;
    const right = 800 - (box!.x + box!.width);
    expect(Math.abs(left - right)).toBeLessThanOrEqual(1);
  });

  test("CA-22: i punti di passaggio tra mobile e desktop", async ({
    page,
    baseURL,
  }) => {
    withUser("A");
    await openAs(page, baseURL, "A", "/oggi");
    for (const width of [767, 768, 1023]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(
        mainNav(page).getByRole("link", { name: "Aggiungi" }),
        `${width}`,
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "FamilyNest", exact: true }),
        `${width}`,
      ).toHaveCount(0);
    }
    await page.setViewportSize({ width: 1024, height: 900 });
    await expect(
      page.getByRole("link", { name: "FamilyNest", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Aggiungi" })).toHaveCount(0);
  });

  test("CA-29: su desktop la lente sta nel main, non nella navigazione in alto", async ({
    page,
    baseURL,
  }) => {
    withUser("A");
    await openAs(page, baseURL, "A", "/oggi");
    await expect(
      page.getByRole("main").getByRole("group", { name: LENS }),
    ).toBeVisible();
    await expect(
      page.locator("header").getByRole("group", { name: LENS }),
    ).toHaveCount(0);
  });

  test("CA-32: B vede il proprio Nest nel menu «Impostazioni»", async ({
    page,
    baseURL,
  }) => {
    withUser("B");
    await openAs(page, baseURL, "B", "/impostazioni");
    const links = settingsMenu(page).getByRole("link");
    await expect(links.nth(2)).toHaveText("Casa Bianchi");
    await expect(page.locator("body")).not.toContainText("Casa D'Angelo");
  });

  test("CA-33: desktop, un solo main e una sola navigazione principale", async ({
    page,
    baseURL,
  }) => {
    withUser("A");
    await signInAs(page.context(), baseURL as string, "A");
    for (const route of ["/oggi", "/casa/spesa", "/nest", "/profilo"]) {
      await page.goto(route);
      await expect(page.getByRole("main"), route).toHaveCount(1);
      await expect(mainNav(page), route).toHaveCount(1);
    }
  });
});

test.describe("entrambe le larghezze", () => {
  test("CA-24: il quadrato del Nest ha 4 punti e porta a /nest", async ({
    page,
    baseURL,
  }) => {
    withUser("A");
    await openAs(page, baseURL, "A", "/oggi");
    const nest = page.getByRole("link", { name: NEST_A });
    await expect(nest).toBeVisible();
    const colors = await nest
      .locator("[data-color]")
      .evaluateAll((dots) => dots.map((d) => d.getAttribute("data-color")));
    expect(colors).toEqual(["pomodoro", "glicine", "salvia", "cobalto"]);
    await nest.click();
    await expect(page).toHaveURL(/\/nest$/);
  });

  test("CA-29: nessuna lente su /casa/spesa e /nest", async ({
    page,
    baseURL,
  }) => {
    withUser("A");
    await signInAs(page.context(), baseURL as string, "A");
    for (const route of ["/casa/spesa", "/nest"]) {
      await page.goto(route);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByRole("group", { name: LENS }), route).toHaveCount(
        0,
      );
    }
  });

  test("CA-32: nessun indirizzo visitato contiene parametri o id", async ({
    browser,
    baseURL,
  }, testInfo) => {
    withUser("A", "B");
    for (const user of ["A", "B"] as const) {
      const context = await browser.newContext({
        baseURL,
        viewport: testInfo.project.use.viewport ?? undefined,
      });
      try {
        await signInAs(context, baseURL as string, user);
        const page = await context.newPage();
        const visited: string[] = [];
        page.on("framenavigated", (frame) => {
          if (frame === page.mainFrame()) visited.push(frame.url());
        });
        const hrefs = new Set<string>();
        for (const start of ["/oggi", "/profilo", "/nest"]) {
          await page.goto(start);
          await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
          const found = await page
            .locator("header a:visible, nav a:visible")
            .evaluateAll((els) => els.map((el) => el.getAttribute("href")));
          for (const href of found) if (href) hrefs.add(href);
        }
        expect(hrefs.size).toBeGreaterThan(4);
        for (const href of hrefs) {
          expect(href, href).not.toMatch(/\?/);
          expect(href, href).not.toMatch(UUID);
          await page.goto(href);
          await expect(page.getByRole("main")).toBeVisible();
        }
        expect(visited.length).toBeGreaterThan(4);
        for (const url of visited) {
          expect(url, url).not.toMatch(/\?/);
          expect(url, url).not.toMatch(UUID);
        }
      } finally {
        await context.close();
      }
    }
  });

  test("CA-33: nessuna violazione axe serious o critical", async ({
    page,
    baseURL,
  }) => {
    withUser("A");
    await signInAs(page.context(), baseURL as string, "A");
    for (const route of ["/oggi", "/casa/spesa", "/nest", "/profilo"]) {
      await page.goto(route);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const results = await new AxeBuilder({ page }).analyze();
      expect(
        results.violations.filter((v) =>
          ["serious", "critical"].includes(v.impact ?? ""),
        ),
        route,
      ).toEqual([]);
    }
  });
});
