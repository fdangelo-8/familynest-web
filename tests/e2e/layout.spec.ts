import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import {
  signInAs,
  skipReason,
  usersConfigured,
  type TestUserKey,
} from "../fixtures/auth";
import { waitHydrated } from "../fixtures/esplora";
import {
  NAV_ITEMS,
  PLACEHOLDERS,
  getActiveNavItem,
  getActiveSettingsItem,
  getBarConfig,
  getDesktopBarConfig,
  getNavAriaCurrent,
  hasAppRoute,
  hasBottomNav,
  isAppPath,
} from "../../src/lib/app-routes";
import { SPACES } from "../../src/lib/spaces";

// Frame and navigation (#10, rewritten for F5 #506). The tests without a
// session, the pure rules and the static checks need no test users; the rest
// depends on the test users (#55) and is skipped, with a reason, without them.

const PROTECTED_ROUTES = [
  "/oggi",
  "/aggiungi",
  "/calendario",
  "/casa/spesa",
  "/casa/da-fare",
  "/casa/scadenze",
  "/spazi",
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
    test(`senza sessione ${route} porta a /accesso`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/accesso$/);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(
        page.getByRole("navigation", { name: "Navigazione principale" }),
      ).toHaveCount(0);
    });
  }

  test("un cookie di sessione alterato porta a /accesso", async ({
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

  test("senza sessione / e /casa finiscono su /accesso", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/accesso$/);
    await page.goto("/casa");
    await expect(page).toHaveURL(/\/accesso$/);
  });

  test("un indirizzo inesistente senza sessione porta a /accesso", async ({
    page,
  }) => {
    for (const route of ["/pippo", "/oggi/pippo", "/esplora/pippo"]) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/accesso$/);
    }
  });

  // Updated by #11 (decision 5): src/proxy.ts exists, runs on Node and ONLY
  // refreshes the session cookies. No access checks, no redirects.
  test("nessun middleware Edge; il proxy rinnova solo i cookie", () => {
    expect(existsSync("middleware.ts")).toBe(false);
    expect(existsSync("src/middleware.ts")).toBe(false);
    expect(existsSync("proxy.ts")).toBe(false);
    // Read directly: a missing file makes the read throw (no check-then-read).
    const source = readFileSync("src/proxy.ts", "utf8");
    expect(source).not.toMatch(/NextResponse\s*\.\s*(redirect|rewrite)/);
    expect(source).not.toMatch(/\bredirect\s*\(/);
    expect(source).not.toMatch(/runtime\s*[:=]\s*["']edge["']/);
    // It only reads the session to refresh it.
    expect(source).toContain("getClaims()");
  });
});

test.describe("reindirizzamenti di Esplora (F5)", () => {
  test("/esplora e /esplora/<spazio> reindirizzano con 308", async ({
    request,
  }) => {
    const toSpazi = await request.get("/esplora", { maxRedirects: 0 });
    expect(toSpazi.status()).toBe(308);
    expect(new URL(toSpazi.headers()["location"]!, "http://x").pathname).toBe(
      "/spazi",
    );
    for (const space of SPACES) {
      const slug = space.href.replace("/spazi/", "");
      const response = await request.get(`/esplora/${slug}`, {
        maxRedirects: 0,
      });
      expect(response.status(), slug).toBe(308);
      expect(
        new URL(response.headers()["location"]!, "http://x").pathname,
        slug,
      ).toBe(space.href);
    }
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
    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(page.getByRole("navigation")).toHaveCount(0);
  });

  test("/onboarding senza sessione porta a /accesso", async ({ page }) => {
    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/accesso$/);
  });

  test("/onboarding: pagina senza cornice (utente C)", async ({
    page,
    baseURL,
  }) => {
    withUser("C");
    const response = await openAs(page, baseURL, "C", "/onboarding");
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle("FamilyNest · Chi vive con te?");
    await expect(
      page.getByRole("heading", { level: 1, name: "Chi vive con te?" }),
    ).toBeVisible();
    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(page.getByRole("navigation")).toHaveCount(0);
    // The placeholder is gone: the real step 1 (#12) has no "In arrivo".
    await expect(page.getByText("In arrivo")).toHaveCount(0);
  });
});

test.describe("regole di navigazione (funzioni pure, §2)", () => {
  test("voce attiva sul telefono", () => {
    const phone = (path: string) => getActiveNavItem(path, "mobile");
    expect(phone("/oggi")).toBe("oggi");
    expect(phone("/aggiungi")).toBe("oggi");
    expect(phone("/calendario")).toBe("calendario");
    expect(phone("/calendario/mese")).toBe("calendario");
    expect(phone("/impegni/abc")).toBe("calendario");
    expect(phone("/casa/spesa")).toBe("casa");
    expect(phone("/casa/scadenze")).toBe("casa");
    expect(phone("/spazi")).toBe("spazi");
    expect(phone("/spazi/a-tavola")).toBe("spazi");
    expect(phone("/spazi/palestra")).toBeNull();
    expect(phone("/figli/sofia")).toBe("spazi");
    expect(phone("/figli/sofia/lista-desideri")).toBe("spazi");
    for (const path of [
      "/notifiche",
      "/ricerca",
      "/esplora",
      "/pippo",
      "/casa/pippo",
      "/casalinga",
    ]) {
      expect(phone(path), path).toBeNull();
    }
    for (const path of [
      "/nest",
      "/profilo",
      "/impostazioni",
      "/calendari-collegati",
      "/membri",
      "/membri/laura",
    ]) {
      expect(phone(path), path).toBe("spazi");
    }
  });

  test("voce attiva sul computer: le pagine del Nest accendono il profilo", () => {
    const computer = (path: string) => getActiveNavItem(path, "desktop");
    expect(computer("/oggi")).toBe("oggi");
    expect(computer("/spazi")).toBe("spazi");
    expect(computer("/figli/sofia")).toBe("spazi");
    for (const path of [
      "/nest",
      "/profilo",
      "/impostazioni",
      "/calendari-collegati",
      "/membri",
      "/membri/laura",
    ]) {
      expect(computer(path), path).toBe("profilo");
    }
    for (const path of ["/notifiche", "/ricerca", "/pippo"]) {
      expect(computer(path), path).toBeNull();
    }
  });

  test("aria-current: «page» sull'indirizzo esatto, «true» sulle altre rotte, mai due voci", () => {
    const current = (path: string, item: (typeof NAV_ITEMS)[number]["id"]) =>
      getNavAriaCurrent(path, "mobile", item);
    expect(current("/calendario", "calendario")).toBe("page");
    expect(current("/calendario/mese", "calendario")).toBe("true");
    expect(current("/casa/spesa", "casa")).toBe("page");
    expect(current("/casa/da-fare", "casa")).toBe("true");
    expect(current("/spazi", "spazi")).toBe("page");
    expect(current("/spazi/a-tavola", "spazi")).toBe("true");
    expect(current("/calendario", "oggi")).toBeUndefined();
    expect(getNavAriaCurrent("/nest", "desktop", "profilo")).toBe("page");
    expect(getNavAriaCurrent("/profilo", "desktop", "profilo")).toBe("true");
    for (const path of ["/oggi", "/calendario", "/spazi", "/nest", "/pippo"]) {
      const active = NAV_ITEMS.filter(
        (item) => getNavAriaCurrent(path, "mobile", item.id) !== undefined,
      );
      expect(active.length, path).toBeLessThanOrEqual(1);
    }
  });

  test("l'elenco ha i quattro link nell'ordine giusto", () => {
    expect(NAV_ITEMS.map((item) => [item.label, item.href])).toEqual([
      ["Oggi", "/oggi"],
      ["Calendario", "/calendario"],
      ["Casa", "/casa/spesa"],
      ["Spazi", "/spazi"],
    ]);
  });

  test("navigazione in basso", () => {
    for (const path of [
      "/oggi",
      "/aggiungi",
      "/calendario",
      "/impegni/x",
      "/casa/spesa",
      "/spazi",
      "/spazi/a-tavola",
      "/figli/x",
      "/notifiche",
      "/pippo",
    ]) {
      expect(hasBottomNav(path), path).toBe(true);
    }
    for (const path of [
      "/nest",
      "/ricerca",
      "/profilo",
      "/calendari-collegati",
      "/impostazioni",
      "/membri",
      "/membri/laura",
    ]) {
      expect(hasBottomNav(path), path).toBe(false);
    }
  });

  test("menu laterale delle impostazioni", () => {
    expect(getActiveSettingsItem("/profilo")).toBe("profilo");
    expect(getActiveSettingsItem("/calendari-collegati")).toBe(
      "calendari-collegati",
    );
    expect(getActiveSettingsItem("/impostazioni")).toBe("impostazioni");
    expect(getActiveSettingsItem("/membri/laura")).toBe("membri");
    expect(getActiveSettingsItem("/membri-extra")).toBeNull();
    expect(getActiveSettingsItem("/oggi")).toBeNull();
  });

  test("testata del telefono", () => {
    expect(getBarConfig("/oggi")).toMatchObject({
      kind: "section",
      lens: true,
    });
    expect(getBarConfig("/oggi")).not.toHaveProperty("title", "Oggi");
    expect(getBarConfig("/calendario")).toMatchObject({
      kind: "section",
      lens: true,
      title: "Calendario",
    });
    expect(getBarConfig("/casa/spesa")).toMatchObject({
      kind: "section",
      lens: false,
      title: "Casa",
      titleIsHeading: true,
    });
    expect(getBarConfig("/spazi")).toMatchObject({
      kind: "section",
      title: "Spazi",
    });
    expect(getBarConfig("/impegni/abc")).toEqual({
      kind: "detail",
      fallback: "/calendario",
    });
    expect(getBarConfig("/spazi/a-tavola")).toMatchObject({
      kind: "detail",
      fallback: "/spazi",
    });
    expect(getBarConfig("/nest")).toMatchObject({
      kind: "detail",
      fallback: "/spazi",
    });
    expect(getBarConfig("/profilo")).toMatchObject({
      kind: "detail",
      fallback: "/nest",
      title: "Il tuo profilo",
    });
    // «Notifiche» (#39): the title is the h1, the gear leads to the settings.
    expect(getBarConfig("/notifiche")).toEqual({
      kind: "detail",
      fallback: "/oggi",
      title: "Notifiche",
      titleIsHeading: true,
      link: {
        href: "/impostazioni#notifiche",
        icon: "settings-2",
        label: "Impostazioni delle notifiche",
      },
    });
    const wishlist =
      "/figli/6f1c2d3e-0000-4000-8000-000000000001/lista-desideri";
    expect(getBarConfig(wishlist)).toEqual({
      kind: "detail",
      fallback: "/figli/6f1c2d3e-0000-4000-8000-000000000001",
    });
    // The search has no header on the phone (#40).
    expect(getBarConfig("/ricerca")).toEqual({ kind: "none" });
    expect(getBarConfig("/pippo")).toEqual({
      kind: "detail",
      fallback: "/oggi",
    });
  });

  test("barra in alto del computer: titolo, pulsante, freccia", () => {
    expect(getDesktopBarConfig("/oggi")).toEqual({
      title: "Oggi",
      newEvent: true,
      back: null,
    });
    expect(getDesktopBarConfig("/calendario/mese")).toMatchObject({
      title: "Calendario",
      newEvent: true,
    });
    for (const path of ["/casa/spesa", "/spazi", "/notifiche", "/nest"]) {
      expect(getDesktopBarConfig(path).newEvent, path).toBe(false);
    }
    expect(getDesktopBarConfig("/impegni/x")).toEqual({
      title: "Calendario",
      newEvent: false,
      back: "/calendario",
    });
    expect(getDesktopBarConfig("/spazi/a-tavola").back).toBe("/spazi");
    expect(getDesktopBarConfig("/pippo").title).toBeNull();
  });

  test("hasAppRoute legge solo l'elenco delle rotte", () => {
    for (const path of [
      "/oggi",
      "/aggiungi",
      "/calendario",
      "/calendario/giorno",
      "/calendario/mese",
      "/impegni/abc",
      "/casa",
      "/casa/spesa",
      "/casa/da-fare",
      "/casa/scadenze",
      "/spazi",
      "/spazi/a-tavola",
      "/figli/abc",
      "/figli/abc/lista-desideri",
      "/notifiche",
      "/ricerca",
      "/nest",
      "/profilo",
      "/impostazioni",
      "/calendari-collegati",
      "/membri",
      "/membri/abc",
      "/oggi/",
      "/oggi?x=1",
      "/oggi#a",
    ]) {
      expect(hasAppRoute(path), path).toBe(true);
    }
    for (const path of [
      "oggi",
      "https://esempio.com/oggi",
      "//esempio.com/oggi",
      "/Oggi",
      "/impegni/a/b",
      "/impegni",
      "/esplora",
      "/spazi/palestra",
      "/impostazioni/aspetto",
      "/ricette",
      "/api/x",
    ]) {
      expect(hasAppRoute(path), path).toBe(false);
    }
  });

  test("isAppPath: rotte dell'app e pubbliche sì, il resto no", () => {
    for (const path of [
      "/oggi",
      "/spazi/a-tavola",
      "/accesso",
      "/accesso/link-scaduto",
      "/onboarding",
      "/onboarding/persone",
      "/invito/abc",
      "/desideri/xyz",
      "/privacy",
      "/termini",
    ]) {
      expect(isAppPath(path), path).toBe(true);
    }
    for (const path of [
      "/api/x",
      "/design-system",
      "/design-system/membri",
      "/fornitore-finto/x",
      "//esempio.com/oggi",
      "https://esempio.com/oggi",
      "/pippo",
    ]) {
      expect(isAppPath(path), path).toBe(false);
    }
  });

  test("ogni segnaposto ha titolo e titolo del browser", () => {
    const casaTitles: Record<string, string> = {
      casa: "FamilyNest · Casa · Spesa",
      "casa-da-fare": "FamilyNest · Casa · Da fare",
      "casa-scadenze": "FamilyNest · Casa · Scadenze",
    };
    for (const [key, def] of Object.entries(PLACEHOLDERS)) {
      expect(def.browserTitle).toBe(
        casaTitles[key] ?? `FamilyNest · ${def.title}`,
      );
    }
  });
});

/** Every file of `src/` as [path, text]. */
function sourceTexts(dir = "src"): [string, string][] {
  // Entry types come with the listing: no stat before the read.
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const name = entry.name;
    const path = join(dir, name);
    if (entry.isDirectory()) return sourceTexts(path);
    return /\.(tsx?|css)$/.test(name)
      ? [[path, readFileSync(path, "utf8")]]
      : [];
  });
}

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
      "casa/da-fare",
      "casa/scadenze",
      "nest",
      "spazi",
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

  test("CA-17: nessun collegamento a /esplora e niente del vecchio guscio", () => {
    expect(existsSync("src/app/(app)/esplora")).toBe(false);
    for (const file of ["TopNav", "AddShortcut", "SearchShortcut", "AppBar"]) {
      expect(existsSync(`src/components/ui/AppFrame/${file}.tsx`), file).toBe(
        false,
      );
    }
    for (const [path, text] of sourceTexts()) {
      if (path.endsWith("app-routes.ts")) continue;
      expect(text, path).not.toMatch(/href=["'`]\/esplora/);
      expect(text, path).not.toMatch(/["'`]\/esplora["'`/]/);
      expect(text, path).not.toMatch(/\.nav-alto|\.nav-basso|\.btn-aggiungi/);
      expect(text, path).not.toMatch(
        /["' ]nav-alto|["' ]nav-basso|["' ]btn-aggiungi/,
      );
    }
  });

  test("CA-41: le quattro aree sicure e il loro uso", () => {
    const globals = readFileSync("src/app/globals.css", "utf8");
    for (const side of ["top", "bottom", "left", "right"]) {
      expect(globals).toContain(`env(safe-area-inset-${side}, 0px)`);
    }
    for (const name of ["alto", "basso", "sinistra", "destra"]) {
      expect(globals).toContain(`--area-sicura-${name}:`);
    }
    const layout = readFileSync("src/app/layout.tsx", "utf8");
    expect(layout).toContain("viewport-fit");
    const components = readFileSync("src/app/components.css", "utf8");
    // Between the markers of the frame only the variables are used.
    const start = components.indexOf("GUSCIO DELL'APP");
    const end = components.indexOf("Tasto disegnato accanto al comando");
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const frame = components.slice(start, end);
    expect(frame).not.toContain("env(safe-area-inset-");
    for (const name of ["alto", "basso", "sinistra", "destra"]) {
      expect(frame, name).toContain(`--area-sicura-${name}`);
    }
  });

  test("le soglie del guscio sono in un solo modulo e coincidono con il CSS", () => {
    const breakpoints = readFileSync("src/lib/breakpoints.ts", "utf8");
    expect(breakpoints).toContain("(max-width: 899px), (max-height: 599px)");
    expect(breakpoints).toContain(
      "(min-width: 900px) and (max-width: 1279px) and (min-height: 600px)",
    );
    expect(breakpoints).toContain(
      "(min-width: 1280px) and (min-height: 600px)",
    );
    const css = readFileSync("src/app/components.css", "utf8");
    expect(css).toContain("@media (min-width: 900px) and (min-height: 600px)");
    expect(css).toContain("@media (min-width: 1280px) and (min-height: 600px)");
    // `useIsDesktop` reads the module, not a width of its own.
    const overlay = readFileSync("src/components/ui/overlay.ts", "utf8");
    expect(overlay).toContain("useShellLayout");
    expect(overlay).not.toContain("min-width: 1024px");
  });
});

// ---------------------------------------------------------------------------
// Tests with signed-in users (A = Marco, B = Giulia, C = no Nest).
// They are skipped, with a reason, while the test users are not available.
// ---------------------------------------------------------------------------

const NAV = { name: "Navigazione principale" };
const LENS = "Punto di vista: solo tu o tutto il Nest";
// the app writes the title with a typographic apostrophe
const NOT_FOUND_TITLE = /Questa pagina non c['’]è/;

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

/** Opens a page for A and waits until the shell has taken over. */
async function openReady(
  page: Page,
  baseURL: string | undefined,
  route: string,
) {
  await openAs(page, baseURL, "A", route);
  await expect(page.getByRole("main")).toBeVisible();
  await waitHydrated(
    page.getByTestId("barra-laterale").or(page.getByTestId("testata")).first(),
  );
}

function mainNav(page: Page) {
  return page.getByRole("navigation", NAV);
}

function sidebar(page: Page) {
  return page.getByTestId("barra-laterale");
}

async function width(page: Page, testId: string) {
  return page
    .getByTestId(testId)
    .evaluate((el) => Math.round(el.getBoundingClientRect().width));
}

/** Presses a key until the address changes: the shortcuts are attached after hydration. */
async function pressUntilUrl(page: Page, key: string, url: RegExp) {
  await expect(async () => {
    await page.keyboard.press(key);
    await expect(page).toHaveURL(url, { timeout: 1000 });
  }).toPass();
}

test.describe("sessione con utenti", () => {
  test("C senza Nest va a /onboarding", async ({ page, baseURL }) => {
    withUser("C");
    await openAs(page, baseURL, "C", "/oggi");
    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Chi vive con te?" }),
    ).toBeVisible();
    await expect(mainNav(page)).toHaveCount(0);
  });

  test("A, / porta a /oggi e /casa a /casa/spesa", async ({
    page,
    baseURL,
  }) => {
    withUser("A");
    await openAs(page, baseURL, "A", "/");
    await expect(page).toHaveURL(/\/oggi$/);
    await page.goto("/casa");
    await expect(page).toHaveURL(/\/casa\/spesa$/);
  });

  test("CA-45: un indirizzo inesistente mostra «Questa pagina non c'è» dentro la cornice, senza voce attiva", async ({
    page,
    baseURL,
  }) => {
    withUser("A");
    for (const route of [
      "/pippo",
      "/oggi/pippo",
      "/spazi/inesistente",
      "/esplora/inesistente",
    ]) {
      await openAs(page, baseURL, "A", route);
      await expect(
        page.getByRole("heading", { level: 1, name: NOT_FOUND_TITLE }),
      ).toBeVisible();
      await expect(page.getByRole("main")).toHaveCount(1);
      await expect(mainNav(page).locator("[aria-current]")).toHaveCount(0);
    }
  });

  test("CA-18 e CA-15: A apre /spazi, 200, Spazi attiva, riga «Il tuo Nest»", async ({
    page,
    baseURL,
  }) => {
    withUser("A");
    const response = await openAs(page, baseURL, "A", "/spazi");
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle("FamilyNest · Spazi");
    await expect(
      mainNav(page).getByRole("link", { name: "Spazi" }),
    ).toHaveAttribute("aria-current", "page");
    const row = page
      .getByRole("main")
      .getByRole("link", { name: /Il tuo Nest/ });
    await expect(row).toHaveAttribute("href", "/nest");
    await expect(row).toContainText("Persone, piano, impostazioni");
  });

  test("CA-16: /esplora e /esplora/a-tavola portano a /spazi", async ({
    page,
    baseURL,
  }) => {
    withUser("A");
    await openAs(page, baseURL, "A", "/esplora");
    await expect(page).toHaveURL(/\/spazi$/);
    await page.goto("/esplora/a-tavola");
    await expect(page).toHaveURL(/\/spazi\/a-tavola$/);
  });

  test("CA-4: il main è un contenitore chiamato «contenuto»", async ({
    page,
    baseURL,
  }) => {
    withUser("A");
    for (const route of ["/oggi", "/calendario", "/casa/spesa", "/spazi"]) {
      await openAs(page, baseURL, "A", route);
      // The <main> can be swapped (loading shell -> page): read it again until
      // the one that stays is measured (a detached node has no styles).
      await expect
        .poll(
          () =>
            page.locator("main#contenuto").evaluate((el) => {
              const s = getComputedStyle(el);
              return { type: s.containerType, name: s.containerName };
            }),
          { message: route },
        )
        .toEqual({ type: "inline-size", name: "contenuto" });
    }
  });
});

test.describe("telefono", () => {
  onlyOn("mobile");

  test("CA-1: a 899 px la barra in basso, a 900 niente barra in basso e barra laterale a icone", async ({
    page,
    baseURL,
  }) => {
    withUser("A");
    await page.setViewportSize({ width: 899, height: 900 });
    await openReady(page, baseURL, "/oggi");
    await expect(mainNav(page)).toBeVisible();
    await expect(page.getByTestId("barra-basso")).toBeVisible();
    expect(await width(page, "barra-laterale")).toBe(0);
    // 900 px is the threshold of the computer shape (D8)
    await page.setViewportSize({ width: 900, height: 900 });
    await expect(page.getByTestId("barra-basso")).toBeHidden();
    await expect.poll(() => width(page, "barra-laterale")).toBe(72);
  });

  test("CA-5: quattro link nell'ordine giusto, senza «Aggiungi» nella barra", async ({
    page,
    baseURL,
  }) => {
    withUser("A");
    await openReady(page, baseURL, "/oggi");
    const links = mainNav(page).getByRole("link");
    await expect(links).toHaveCount(4);
    expect(
      await links.evaluateAll((els) => els.map((el) => el.textContent?.trim())),
    ).toEqual(["Oggi", "Calendario", "Casa", "Spazi"]);
    expect(
      await links.evaluateAll((els) =>
        els.map((el) => el.getAttribute("href")),
      ),
    ).toEqual(["/oggi", "/calendario", "/casa/spesa", "/spazi"]);
    await expect(page.locator(".btn-aggiungi")).toHaveCount(0);
    await expect(mainNav(page).locator('a[href="/aggiungi"]')).toHaveCount(0);
  });

  test("CA-6 e CA-7: ogni rotta ha la barra e la voce attiva della tabella", async ({
    page,
    baseURL,
  }) => {
    withUser("A");
    await signInAs(page.context(), baseURL as string, "A");
    const rows: [string, string | null][] = [
      ["/oggi", "Oggi"],
      ["/calendario", "Calendario"],
      ["/calendario/mese", "Calendario"],
      ["/casa/spesa", "Casa"],
      ["/casa/da-fare", "Casa"],
      ["/spazi", "Spazi"],
      ["/spazi/a-tavola", "Spazi"],
      ["/notifiche", null],
      ["/pippo", null],
    ];
    for (const [route, active] of rows) {
      await page.goto(route);
      await expect(page.getByRole("main"), route).toBeVisible();
      await expect(mainNav(page), route).toHaveCount(1);
      const current = mainNav(page).locator("[aria-current]");
      if (active === null) {
        await expect(current, route).toHaveCount(0);
      } else {
        await expect(current, route).toHaveText(active);
      }
    }
    await page.goto("/calendario");
    await expect(
      mainNav(page).getByRole("link", { name: "Calendario" }),
    ).toHaveAttribute("aria-current", "page");
    await page.goto("/calendario/mese");
    await expect(
      mainNav(page).getByRole("link", { name: "Calendario" }),
    ).toHaveAttribute("aria-current", "true");
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
  });

  test("CA-8: nessun disco dell'assistente né «Chiedi a Nest»", async ({
    page,
    baseURL,
  }) => {
    withUser("A");
    await openReady(page, baseURL, "/oggi");
    await expect(page.getByText("Chiedi a Nest")).toHaveCount(0);
  });

  test("CA-10: la barra in basso non copre l'ultimo elemento del main", async ({
    page,
    baseURL,
  }) => {
    withUser("A");
    await openReady(page, baseURL, "/casa/spesa");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const bar = await page.getByTestId("barra-basso-capsula").boundingBox();
    expect(bar).not.toBeNull();
    const last = await page
      .getByRole("main")
      .locator("a:visible, button:visible, input:visible")
      .last()
      .boundingBox();
    expect(last).not.toBeNull();
    expect(last!.y + last!.height).toBeLessThanOrEqual(bar!.y + 0.5);
  });

  test("CA-11: la testata di Calendario, Casa e Spazi, e la lente su Oggi", async ({
    page,
    baseURL,
  }) => {
    withUser("A");
    await signInAs(page.context(), baseURL as string, "A");
    for (const route of ["/calendario", "/casa/spesa", "/spazi"]) {
      await page.goto(route);
      const header = page.getByTestId("testata");
      await expect(header, route).toBeVisible();
      const links = header.getByRole("link");
      expect(
        await links.evaluateAll((els) =>
          els.map((el) => [
            el.getAttribute("aria-label"),
            el.getAttribute("href"),
          ]),
        ),
        route,
      ).toEqual([
        ["Cerca", "/ricerca"],
        ["Notifiche", "/notifiche"],
      ]);
    }
    await page.goto("/oggi");
    const header = page.getByTestId("testata");
    await expect(header.getByRole("group", { name: LENS })).toBeVisible();
    await expect(header.getByRole("link", { name: "Cerca" })).toBeVisible();
    await expect(header.getByRole("link", { name: "Notifiche" })).toBeVisible();
  });

  test("CA-12: scorrendo resta in cima la barra raccolta di 56 px", async ({
    page,
    baseURL,
  }) => {
    withUser("A");
    await openReady(page, baseURL, "/spazi");
    await expect(page.getByTestId("testata-raccolta")).toHaveCount(0);
    await page.evaluate(() => window.scrollTo(0, 400));
    const collapsed = page.getByTestId("testata-raccolta");
    await expect(collapsed).toBeVisible();
    expect(Math.round((await collapsed.boundingBox())!.height)).toBe(56);
    await expect(collapsed.getByRole("link", { name: "Cerca" })).toBeVisible();
    await expect(
      collapsed.getByRole("link", { name: "Notifiche" }),
    ).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(collapsed).toHaveCount(0);
  });

  test("CA-13: «Indietro» senza cronologia va al ripiego", async ({
    page,
    baseURL,
  }) => {
    withUser("A");
    for (const [route, fallback] of [
      ["/spazi/a-tavola", /\/spazi$/],
      ["/profilo", /\/nest$/],
    ] as const) {
      await openAs(page, baseURL, "A", route);
      const back = page.getByTestId("testata").getByRole("link", {
        name: "Indietro",
      });
      await waitHydrated(back);
      await back.click();
      await expect(page, route).toHaveURL(fallback);
    }
  });

  test("CA-14: Calendario, Casa, indietro due volte riporta a /oggi", async ({
    page,
    baseURL,
  }) => {
    withUser("A");
    await openReady(page, baseURL, "/oggi");
    await mainNav(page).getByRole("link", { name: "Calendario" }).click();
    await expect(page).toHaveURL(/\/calendario$/);
    await mainNav(page).getByRole("link", { name: "Casa" }).click();
    await expect(page).toHaveURL(/\/casa\/spesa$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/calendario$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/oggi$/);
  });

  test("CA-35: sul telefono le lettere non fanno nulla", async ({
    page,
    baseURL,
  }) => {
    withUser("A");
    await openReady(page, baseURL, "/oggi");
    await page.keyboard.press("c");
    await page.keyboard.press("?");
    await expect(page).toHaveURL(/\/oggi$/);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("CA-43: B vede solo il proprio Nest e nell'HTML non c'è nulla di A", async ({
    page,
    baseURL,
  }) => {
    withUser("B");
    await signInAs(page.context(), baseURL as string, "B");
    const response = await page.goto("/oggi");
    const html = await response!.text();
    const lens = page.getByTestId("testata").getByRole("group", { name: LENS });
    await expect(lens.getByLabel("Giulia", { exact: true })).toBeVisible();
    await expect(
      lens.getByLabel("Giulia, Paolo, Leo", { exact: true }),
    ).toBeVisible();
    const content = (html + (await page.content())).replaceAll(
      "nuoto Sofia giovedì alle 17",
      "",
    );
    expect(content).not.toMatch(
      /Casa D(?:'|&#x27;|&#39;|&apos;|\\u0027)Angelo/,
    );
    for (const word of ["Marco", "Laura", "Sofia", "Tommaso", "Biscotto"]) {
      expect(content, word).not.toContain(word);
    }
  });
});

test.describe("computer", () => {
  onlyOn("desktop");

  test("CA-2 e CA-1: la barra laterale passa da 72 a 248 px a 1280", async ({
    page,
    baseURL,
  }) => {
    withUser("A");
    await page.setViewportSize({ width: 1279, height: 800 });
    await openReady(page, baseURL, "/oggi");
    expect(await width(page, "barra-laterale")).toBe(72);
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect.poll(() => width(page, "barra-laterale")).toBe(248);
    await expect(
      sidebar(page).getByRole("link", { name: "Calendario" }),
    ).toContainText("Calendario");
  });

  test("a 1280 px ma alta 560 vale la forma del telefono", async ({
    page,
    baseURL,
  }) => {
    withUser("A");
    await page.setViewportSize({ width: 1280, height: 560 });
    await openReady(page, baseURL, "/oggi");
    await expect(page.getByTestId("barra-basso")).toBeVisible();
    expect(await width(page, "barra-laterale")).toBe(0);
  });

  test("CA-3: a 1920 px il contenuto è largo al massimo 1200 px e centrato", async ({
    page,
    baseURL,
  }) => {
    withUser("A");
    await page.setViewportSize({ width: 1920, height: 900 });
    await openReady(page, baseURL, "/oggi");
    const box = await page.getByRole("main").boundingBox();
    const side = await width(page, "barra-laterale");
    expect(box!.width).toBeLessThanOrEqual(1200);
    const left = box!.x - side;
    const right = 1920 - (box!.x + box!.width);
    expect(Math.abs(left - right)).toBeLessThanOrEqual(1);
  });

  test("CA-19 e CA-20: la barra laterale e le voci attive", async ({
    page,
    baseURL,
  }) => {
    withUser("A");
    await openReady(page, baseURL, "/oggi");
    const bar = sidebar(page);
    // brand: not a link
    await expect(
      bar.getByRole("img", { name: "FamilyNest" }).first(),
    ).toBeAttached();
    await expect(bar.locator("a", { hasText: "FamilyNest" })).toHaveCount(0);
    await expect(bar.getByRole("group", { name: LENS })).toBeVisible();
    const main = bar.getByRole("navigation", NAV);
    expect(
      await main
        .getByRole("link")
        .evaluateAll((els) => els.map((el) => el.textContent?.trim())),
    ).toEqual(["Oggi", "Calendario", "Casa", "Spazi"]);
    await expect(
      bar.getByText("Di casa", { exact: true }).first(),
    ).toBeVisible();
    const home = bar.getByRole("navigation", { name: "Di casa" });
    await expect(home.getByRole("link")).toHaveCount(1);
    await expect(home.getByRole("link", { name: "Spesa" })).toHaveAttribute(
      "href",
      "/casa/spesa",
    );
    await expect(
      bar.getByRole("link", { name: /Il tuo Nest$/ }),
    ).toHaveAttribute("href", "/nest");
    await expect(
      bar.getByRole("link", { name: "Marco, Il tuo Nest" }),
    ).toBeVisible();

    await page.goto("/casa/spesa");
    await expect(main.getByRole("link", { name: "Casa" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(home.getByRole("link", { name: "Spesa" })).not.toHaveAttribute(
      "aria-current",
      /.*/,
    );
    await page.goto("/profilo");
    await expect(
      bar.getByRole("link", { name: /Il tuo Nest$/ }),
    ).toHaveAttribute("aria-current", "true");
  });

  test("CA-21: a 1040 px ogni icona ha il nome e il fumetto, Esc lo toglie", async ({
    page,
    baseURL,
  }) => {
    withUser("A");
    await page.setViewportSize({ width: 1040, height: 800 });
    await openReady(page, baseURL, "/oggi");
    await page.getByRole("link", { name: "Vai al contenuto" }).focus();
    for (const name of ["Oggi", "Calendario", "Casa", "Spazi", "Spesa"]) {
      // Tab until the link of the entry has the focus (the lens comes first).
      await expect(async () => {
        await page.keyboard.press("Tab");
        await expect(
          sidebar(page).getByRole("link", { name, exact: true }),
        ).toBeFocused({ timeout: 500 });
      }).toPass();
      const balloon = page.locator(".fumetto");
      await expect(balloon).toHaveText(name);
      // Not clipped by the scrolling sidebar: inside the window and on top
      // of whatever is under its centre.
      const box = (await balloon.boundingBox())!;
      const link = (await sidebar(page)
        .getByRole("link", { name, exact: true })
        .boundingBox())!;
      // Beside the icon, not over it; it may stick out of the 72 px bar.
      expect(box.x, name).toBeGreaterThanOrEqual(link.x + link.width);
      expect(box.x + box.width, name).toBeLessThanOrEqual(1040);
      // It is a child of the body, so no scrolling ancestor can clip it.
      expect(
        await balloon.evaluate((el) => el.parentElement === document.body),
        name,
      ).toBe(true);
      // And the whole width of the text is drawn: the box is as wide as the text.
      expect(
        await balloon.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
        name,
      ).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(page.locator(".fumetto")).toHaveCount(0);
    await expect(
      sidebar(page).getByRole("link", { name: "Spesa", exact: true }),
    ).toBeFocused();
  });

  test("CA-22: la lente della barra laterale non cambia indirizzo né ricarica", async ({
    page,
    baseURL,
  }) => {
    withUser("A");
    await openReady(page, baseURL, "/calendario");
    const lens = sidebar(page).getByRole("group", { name: LENS });
    const nest = lens.getByRole("button", { name: /Nest$/ });
    const navigations: string[] = [];
    page.on("request", (request) => {
      if (request.isNavigationRequest()) navigations.push(request.url());
    });
    await expect(async () => {
      await nest.click();
      await expect(nest).toHaveAttribute("aria-pressed", "true", {
        timeout: 1000,
      });
    }).toPass();
    await expect(page).toHaveURL(/\/calendario$/);
    expect(navigations).toEqual([]);
    await sidebar(page)
      .getByRole("link", { name: "Oggi", exact: true })
      .click();
    await expect(page).toHaveURL(/\/oggi$/);
    await expect(nest).toHaveAttribute("aria-pressed", "true");
  });

  test("le due lenti (barra laterale e pagina) restano allineate: cambiarne una cambia l'altra", async ({
    page,
    baseURL,
  }) => {
    withUser("A");
    await openReady(page, baseURL, "/calendario");
    const side = sidebar(page).getByRole("group", { name: LENS });
    const own = page.getByRole("main").getByRole("group", { name: LENS });
    await expect(side).toBeVisible();
    await expect(own).toBeVisible();
    const choose = async (from: typeof side, which: "Io" | "Nest") => {
      const button = from.getByRole("button", {
        name: new RegExp(`${which}$`),
      });
      await expect(async () => {
        await button.click();
        await expect(button).toHaveAttribute("aria-pressed", "true", {
          timeout: 1000,
        });
      }).toPass();
    };
    await choose(own, "Nest");
    await expect(side.getByRole("button", { name: /Nest$/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(side.getByRole("button", { name: /Io$/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await choose(side, "Io");
    await expect(own.getByRole("button", { name: /Io$/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(own.getByRole("button", { name: /Nest$/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  test("con il pannello aperto e la pagina cambiata, chiuderlo non torna indietro", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/design-system?guscio=1");
    const open = page.getByTestId("pannello-apri");
    await waitHydrated(open);
    await open.click();
    const panel = page.getByTestId("pannello-prova");
    await expect(panel).toBeVisible();
    // The person goes to another page of the app while the panel is open: a
    // new entry of the history, which is not the one of the panel.
    await page.evaluate(() =>
      window.history.pushState({}, "", "/design-system?guscio=1&altra=1"),
    );
    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
    // The panel did not call `history.back()`: the address is still the new one.
    await page.waitForTimeout(300);
    expect(new URL(page.url()).searchParams.get("altra")).toBe("1");
  });

  test("a 960 px una pagina di dettaglio ha l'azione nella barra in alto", async ({
    page,
    baseURL,
  }) => {
    withUser("A");
    await page.setViewportSize({ width: 960, height: 800 });
    await openAs(page, baseURL, "A", "/spazi/a-tavola");
    const bar = page.getByTestId("barra-alto");
    await expect(bar).toBeVisible();
    // The pin of the space sits in the bar between 900 and 1023 px...
    await expect(
      bar.getByRole("button", { name: "Fissa A tavola in Oggi" }),
    ).toBeVisible();
    // ...and from 1024 px the page has no pin and the bar does not repeat it.
    await page.setViewportSize({ width: 1040, height: 800 });
    await expect(
      bar.getByRole("button", { name: "Fissa A tavola in Oggi" }),
    ).toHaveCount(0);
  });

  test("CA-23: la barra in alto di Oggi, Calendario, Casa e Spazi", async ({
    page,
    baseURL,
  }) => {
    withUser("A");
    await signInAs(page.context(), baseURL as string, "A");
    for (const [route, title, hasNew] of [
      ["/oggi", "Oggi", true],
      ["/calendario", "Calendario", true],
      ["/casa/spesa", "Casa", false],
      ["/spazi", "Spazi", false],
    ] as const) {
      await page.goto(route);
      const bar = page.getByTestId("barra-alto");
      await expect(bar, route).toContainText(title);
      const search = bar.getByRole("link", { name: "Cerca" });
      await expect(search, route).toBeVisible();
      expect(Math.round((await search.boundingBox())!.width), route).toBe(280);
      await expect(bar.getByRole("link", { name: "Notifiche" })).toBeVisible();
      const add = bar.getByRole("link", { name: "Nuovo impegno" });
      if (hasNew) await expect(add, route).toHaveAttribute("href", "/aggiungi");
      else await expect(add, route).toHaveCount(0);
    }
  });

  test("CA-24: il campo «Cerca» apre la ricerca con il fuoco nel suo campo", async ({
    page,
    baseURL,
  }) => {
    withUser("A");
    await openReady(page, baseURL, "/oggi");
    await page
      .getByTestId("barra-alto")
      .getByRole("link", { name: "Cerca" })
      .click();
    const dialog = page.getByRole("dialog", { name: "Cerca nel Nest" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("combobox")).toBeFocused();
    expect(new URL(page.url()).search).toBe("");
  });

  test("CA-28: C, A, S, O portano alle sezioni", async ({ page, baseURL }) => {
    withUser("A");
    await openReady(page, baseURL, "/oggi");
    await pressUntilUrl(page, "c", /\/calendario$/);
    await pressUntilUrl(page, "a", /\/casa\/spesa$/);
    await pressUntilUrl(page, "s", /\/spazi$/);
    await pressUntilUrl(page, "o", /\/oggi$/);
  });

  test("CA-29: dentro un campo di testo le lettere si scrivono, con Ctrl/Alt/un dialogo non fanno nulla", async ({
    page,
    baseURL,
  }) => {
    withUser("A");
    await openReady(page, baseURL, "/oggi");
    await page.keyboard.press("/");
    const search = page.getByRole("dialog", { name: "Cerca nel Nest" });
    await expect(search.getByRole("combobox")).toBeFocused();
    await page.keyboard.press("c");
    await expect(search.getByRole("combobox")).toHaveValue("c");
    await expect(page).toHaveURL(/\/ricerca$/);
    await page.keyboard.press("Escape");
    await expect(search).toHaveCount(0);
    await page.keyboard.press("Control+c");
    await page.keyboard.press("Alt+c");
    await expect(page).toHaveURL(/\/oggi$/);
  });

  test("CA-30: N preme «Nuovo impegno» dove c'è, altrove niente", async ({
    page,
    baseURL,
  }) => {
    withUser("A");
    await openReady(page, baseURL, "/calendario");
    await pressUntilUrl(page, "n", /\/aggiungi$/);
    await page.goto("/casa/spesa");
    await expect(page.getByRole("main")).toBeVisible();
    await waitHydrated(sidebar(page));
    await page.keyboard.press("n");
    await expect(page).toHaveURL(/\/casa\/spesa$/);
  });

  test("CA-31 e CA-32: «/» apre la ricerca, Ctrl+K no", async ({
    page,
    baseURL,
  }) => {
    withUser("A");
    await openReady(page, baseURL, "/oggi");
    await page.keyboard.press("Control+k");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).toHaveURL(/\/oggi$/);
    await expect(async () => {
      await page.keyboard.press("/");
      await expect(
        page.getByRole("dialog", { name: "Cerca nel Nest" }),
      ).toBeVisible({ timeout: 1000 });
    }).toPass();
    await expect(
      page.getByRole("combobox", { name: "Cerca nel Nest" }),
    ).toHaveValue("");
  });

  test("CA-33 e CA-34: «?» apre le scorciatoie, l'interruttore le spegne e resta dopo il ricaricamento", async ({
    page,
    baseURL,
  }) => {
    withUser("A");
    await openReady(page, baseURL, "/oggi");
    await expect(async () => {
      await page.keyboard.press("?");
      await expect(
        page.getByRole("dialog", { name: "Scorciatoie da tastiera" }),
      ).toBeVisible({ timeout: 1000 });
    }).toPass();
    const dialog = page.getByRole("dialog", {
      name: "Scorciatoie da tastiera",
    });
    for (const key of ["O", "C", "A", "S", "N", "/", "?", "Esc"]) {
      await expect(
        dialog.locator("kbd", {
          hasText: new RegExp(
            `^${key === "/" ? "/" : key === "?" ? "\\?" : key}$`,
          ),
        }),
        key,
      ).toHaveCount(1);
    }
    await expect(dialog.locator("kbd", { hasText: /^K$/ })).toHaveCount(0);
    await dialog
      .getByRole("switch", { name: "Scorciatoie a una lettera" })
      .click();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("main")).toBeVisible();
    await waitHydrated(sidebar(page));
    await page.keyboard.press("c");
    await expect(page).toHaveURL(/\/oggi$/);
    await expect(async () => {
      await page.keyboard.press("?");
      await expect(
        page.getByRole("dialog", { name: "Scorciatoie da tastiera" }),
      ).toBeVisible({ timeout: 1000 });
    }).toPass();
    await page
      .getByRole("switch", { name: "Scorciatoie a una lettera" })
      .click();
    await page.keyboard.press("Escape");
    await pressUntilUrl(page, "c", /\/calendario$/);
    // leave the preference as found
    await page.evaluate(() =>
      window.localStorage.removeItem("single-letter-shortcuts"),
    );
  });

  test("CA-38: «Vai al contenuto» porta il fuoco sul main", async ({
    page,
    baseURL,
  }) => {
    withUser("A");
    await openReady(page, baseURL, "/oggi");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Vai al contenuto" });
    await expect(skip).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("main#contenuto")).toBeFocused();
  });

  test("CA-39: anello di fuoco di 2 px sui comandi della barra laterale e in alto", async ({
    page,
    baseURL,
  }) => {
    withUser("A");
    await openReady(page, baseURL, "/oggi");
    await page.keyboard.press("Tab");
    for (let i = 0; i < 11; i += 1) {
      await page.keyboard.press("Tab");
      const ring = await page.evaluate(() => {
        const s = getComputedStyle(document.activeElement as Element);
        return [s.outlineWidth, s.outlineColor, s.outlineOffset];
      });
      // The global ring (#634) is `--border-medio` (1.5 px), which the browser
      // rounds to 1 px on a screen of 1×; §9 of the spec writes «2 px»: reported
      // in the PR as a difference between the spec and the token.
      expect(ring, `Tab ${i + 1}`).toEqual(["1px", "rgb(15, 61, 68)", "2px"]);
    }
  });

  test("CA-44: la campanella senza pallino e il profilo con il nome", async ({
    page,
    baseURL,
  }) => {
    withUser("A");
    await openReady(page, baseURL, "/oggi");
    await expect(
      page.getByTestId("barra-alto").getByRole("link", { name: /^Notifiche/ }),
    ).toBeVisible();
    await expect(
      sidebar(page).getByRole("link", { name: /^Marco/ }),
    ).toBeVisible();
  });

  test("CA-43: B vede solo il proprio Nest nella barra laterale", async ({
    page,
    baseURL,
  }) => {
    withUser("B");
    await signInAs(page.context(), baseURL as string, "B");
    const response = await page.goto("/oggi");
    const html = await response!.text();
    await expect(
      sidebar(page).getByRole("link", { name: "Giulia, Il tuo Nest" }),
    ).toBeVisible();
    // The fixed example of the quick-add field of Oggi is not data of A.
    const content = (html + (await page.content())).replaceAll(
      "nuoto Sofia giovedì alle 17",
      "",
    );
    for (const word of ["Marco", "Laura", "Sofia", "Tommaso", "Biscotto"]) {
      expect(content, word).not.toContain(word);
    }
  });

  test("nessuna violazione axe serious o critical", async ({
    page,
    baseURL,
  }) => {
    withUser("A");
    await signInAs(page.context(), baseURL as string, "A");
    for (const route of [
      "/oggi",
      "/casa/spesa",
      "/spazi",
      "/nest",
      "/profilo",
    ]) {
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

test.describe("telefono: punto delle novità e ordine del Tab", () => {
  onlyOn("mobile");

  test("CA-9: nell'app «Spazi» non ha il punto delle novità", async ({
    page,
    baseURL,
  }) => {
    withUser("A");
    await openReady(page, baseURL, "/oggi");
    const spaces = mainNav(page).getByRole("link", {
      name: "Spazi",
      exact: true,
    });
    await expect(spaces).toBeVisible();
    await expect(spaces.locator(".barra-basso__punto")).toHaveCount(0);
    await expect(
      mainNav(page).getByRole("link", { name: "Spazi, ci sono novità" }),
    ).toHaveCount(0);
  });

  test("CA-37: ordine del Tab: Vai al contenuto, testata, contenuto, barra in basso", async ({
    page,
    baseURL,
  }) => {
    withUser("A");
    await openReady(page, baseURL, "/calendario");
    // Order of the document, which is the order of Tab (no `tabindex` above 0).
    const order = await page.evaluate(() => {
      const nodes = Array.from(
        document.querySelectorAll<HTMLElement>(
          "a[href], button, input, select, textarea",
        ),
      ).filter((el) => el.getClientRects().length > 0);
      const where = (el: HTMLElement) =>
        el.closest(".vai-al-contenuto")
          ? "skip"
          : el.closest("header.testata, .testata-raccolta")
            ? "testata"
            : el.closest("main")
              ? "contenuto"
              : el.closest(".barra-basso")
                ? "basso"
                : "altro";
      const seq: string[] = [];
      for (const el of nodes) {
        const part = where(el);
        if (seq[seq.length - 1] !== part) seq.push(part);
      }
      const bottom = nodes
        .filter((el) => el.closest(".barra-basso"))
        .map((el) => el.textContent?.trim());
      return { seq, bottom };
    });
    expect(order.seq).toEqual(["skip", "testata", "contenuto", "basso"]);
    expect(order.bottom).toEqual(["Oggi", "Calendario", "Casa", "Spazi"]);
  });
});

test.describe("galleria del guscio (esempio con novità e pannello)", () => {
  test("CA-9: l'esempio «con novità» ha il punto e il nome «Spazi, ci sono novità»", async ({
    page,
  }) => {
    await page.goto("/design-system?guscio=1");
    const spaces = page.getByRole("link", { name: "Spazi, ci sono novità" });
    await expect(spaces).toBeVisible();
    await expect(spaces.locator(".barra-basso__punto")).toHaveCount(1);
  });

  for (const [viewport, content] of [
    [1280, 788],
    [1440, 948],
  ] as const) {
    test(`CA-25: a ${viewport} px il pannello è largo 420, la barra 72 e il contenuto ${content}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: viewport, height: 900 });
      await page.goto("/design-system?guscio=1");
      const open = page.getByTestId("pannello-apri");
      await waitHydrated(open);
      await open.click();
      const panel = page.getByTestId("pannello-prova");
      await expect(panel).toBeVisible();
      // the sidebar goes to icons and the panel stops entering
      await expect
        .poll(() => width(page, "barra-laterale"), { timeout: 3000 })
        .toBe(72);
      expect(await width(page, "pannello-prova")).toBe(420);
      const main = await page.getByTestId("guscio-contenuto").boundingBox();
      expect(Math.abs(main!.width - content)).toBeLessThanOrEqual(1);
    });
  }

  test("CA-26: Esc chiude il pannello e il fuoco torna al pulsante; «indietro» lo chiude senza lasciare la galleria", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/design-system?guscio=1");
    const open = page.getByTestId("pannello-apri");
    await waitHydrated(open);
    await open.focus();
    await page.keyboard.press("Enter");
    const panel = page.getByTestId("pannello-prova");
    await expect(panel).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
    await expect(open).toBeFocused();

    await open.click();
    await expect(panel).toBeVisible();
    await page.goBack();
    await expect(panel).toHaveCount(0);
    expect(new URL(page.url()).pathname).toBe("/design-system");
    expect(new URL(page.url()).search).toBe("?guscio=1");
  });

  test("CA-27: con movimento ridotto barra laterale e pannello non hanno transizione", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/design-system?guscio=1");
    const open = page.getByTestId("pannello-apri");
    await waitHydrated(open);
    await open.click();
    const panel = page.getByTestId("pannello-prova");
    await expect(panel).toBeVisible();
    for (const id of ["barra-laterale", "pannello-prova"]) {
      expect(
        await page
          .getByTestId(id)
          .evaluate((el) => getComputedStyle(el).transitionDuration),
        id,
      ).toBe("0s");
    }
  });
});

test.describe("entrambe le larghezze", () => {
  test("nessun indirizzo visitato contiene parametri o id", async ({
    browser,
    baseURL,
  }, testInfo) => {
    test.slow();
    withUser("A", "B");
    const uuid =
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
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
        expect(hrefs.size).toBeGreaterThan(3);
        for (const href of hrefs) {
          expect(href, href).not.toMatch(/\?/);
          expect(href, href).not.toMatch(uuid);
          await page.goto(href);
          await expect(page.getByRole("main")).toBeVisible();
        }
        for (const url of visited) {
          expect(url, url).not.toMatch(/\?/);
          expect(url, url).not.toMatch(uuid);
        }
      } finally {
        await context.close();
      }
    }
  });
});
