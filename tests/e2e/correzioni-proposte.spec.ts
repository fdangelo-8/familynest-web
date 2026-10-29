import { readFileSync } from "node:fs";
import {
  expect,
  test,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";
import {
  signInAs,
  skipReason,
  usersConfigured,
  type TestUserKey,
} from "../fixtures/auth";
import {
  getActiveNavItem,
  getNavAriaCurrent,
  hasTodayLinkOnError,
  type NavItem,
} from "../../src/lib/app-routes";

// Corrections 6-13 of #43 (issue #67). One test per acceptance criterion.
// [CI] tests need no test users. [CI-utenti] tests sign in as a test user and
// are skipped in CI while the remote test users do not exist: they are
// verified locally against a local Supabase (LEZIONI).

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

// Routes of the table of #10 (without /casa, which is not a page).
const FRAME_ROUTES = [
  "/oggi",
  "/aggiungi",
  "/calendario",
  "/casa/spesa",
  "/casa/da-fare",
  "/casa/scadenze",
  "/nest",
  "/notifiche",
  "/ricerca",
  "/profilo",
  "/calendari-collegati",
  "/impostazioni",
  "/membri",
];

const isMobile = (info: TestInfo) => info.project.name === "mobile";
const isDesktop = (info: TestInfo) => info.project.name === "desktop";

function onlyMobile(info: TestInfo) {
  test.skip(!isMobile(info), "il criterio vale a 390 px");
}
function onlyDesktop(info: TestInfo) {
  test.skip(!isDesktop(info), "il criterio vale a 1280 px");
}

/** Skips when the test users are missing, then signs the context in. */
async function loginAs(
  key: TestUserKey,
  {
    context,
    baseURL,
  }: { context: import("@playwright/test").BrowserContext; baseURL?: string },
) {
  test.skip(!usersConfigured(key), skipReason(key));
  await signInAs(context, baseURL!, key);
}

/** Waits for the frame to be rendered and the page to be hydrated. */
async function openFrame(page: Page, route: string) {
  await page.goto(route);
  await expect(page.locator("main")).toBeVisible();
}

/**
 * Touch-area audit (CA-6/CA-7): every visible a, button, checkbox, switch or
 * radio smaller than 44 px must have the points (cx, cy +- 21) (too short) or
 * (cx +- 21, cy) (too narrow) inside itself. Returns the failures.
 */
async function touchFailures(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const failures: string[] = [];
    const nodes = document.querySelectorAll<HTMLElement>(
      'a, button, [role="checkbox"], [role="switch"], [role="radio"]',
    );
    for (const el of nodes) {
      if (el.closest(".legale__link") || el.classList.contains("legale__link"))
        continue;
      if (el.classList.contains("vai-al-contenuto")) continue;
      if (!el.checkVisibility({ checkVisibilityCSS: true })) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.bottom < 0 || r.top > innerHeight) continue;
      const cx = r.x + r.width / 2;
      const cy = r.y + r.height / 2;
      const hit = (x: number, y: number) => {
        const found = document.elementFromPoint(x, y);
        return !!found && el.contains(found);
      };
      const label = `${el.tagName.toLowerCase()}.${el.className} "${(
        el.getAttribute("aria-label") ??
        el.textContent ??
        ""
      )
        .trim()
        .slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}`;
      if (r.height < 43.5 && !(hit(cx, cy - 21) && hit(cx, cy + 21))) {
        failures.push(`${label}: area verticale < 44`);
      }
      if (r.width < 43.5 && !(hit(cx - 21, cy) && hit(cx + 21, cy))) {
        failures.push(`${label}: area orizzontale < 44`);
      }
    }
    return failures;
  });
}

/** Text of an element with the whitespace collapsed. */
async function normalizedText(locator: Locator) {
  return ((await locator.textContent()) ?? "").replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------- Punto 6

test.describe("punto 6: errore di pagina con uscita", () => {
  test("CA-1: l'esempio con uscita ha Riprova e Torna a Oggi, in ordine", async ({
    page,
  }) => {
    await page.goto("/design-system");
    const example = page.getByTestId("errore-pagina-con-uscita");
    await expect(example).toHaveAttribute("role", "alert");
    const retry = example.getByRole("button", { name: "Riprova" });
    const exit = example.getByRole("link", { name: "Torna a Oggi" });
    await expect(retry).toBeVisible();
    await expect(exit).toHaveAttribute("href", "/oggi");
    expect(
      await retry.evaluate(
        (el, other) =>
          !!(
            el.compareDocumentPosition(other as Node) &
            Node.DOCUMENT_POSITION_FOLLOWING
          ),
        await exit.elementHandle(),
      ),
    ).toBe(true);
    const counter = page.getByTestId("errore-pagina-con-uscita-conteggio");
    await expect(counter).toHaveText("Riprova: 0");
    await expect(async () => {
      await retry.click();
      await expect(counter).toHaveText("Riprova: 1", { timeout: 1000 });
    }).toPass();
  });

  test("CA-2: l'esempio senza uscita ha solo Riprova", async ({ page }) => {
    await page.goto("/design-system");
    const example = page.getByTestId("errore-pagina");
    await expect(
      example.getByRole("button", { name: "Riprova" }),
    ).toBeVisible();
    await expect(example.getByRole("link")).toHaveCount(0);
    await expect(example.locator("a")).toHaveCount(0);
  });

  test("CA-3: la regola del link e l'uso in ErrorMain", () => {
    expect(hasTodayLinkOnError("/oggi")).toBe(false);
    for (const route of [
      "/aggiungi",
      "/calendario",
      "/casa/spesa",
      "/notifiche",
      "/nest",
      "/profilo",
    ]) {
      expect(hasTodayLinkOnError(route), route).toBe(true);
    }
    const source = readFileSync(
      "src/components/ui/AppFrame/ErrorMain.tsx",
      "utf8",
    );
    expect(source).toContain("hasTodayLinkOnError");
    expect(source).toContain("Torna a Oggi");
    expect(source).toContain("/oggi");
  });
});

// ---------------------------------------------------------------- Punto 7

test.describe("punto 7: aree di tocco", () => {
  test("CA-4: l'icona predefinita e' 40x40 con area di tocco 44", async ({
    page,
  }, info) => {
    onlyMobile(info);
    await page.goto("/design-system");
    const button = page.getByTestId("btn-icona-predefinito");
    await button.scrollIntoViewIfNeeded();
    const data = await button.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const cx = r.x + r.width / 2;
      const cy = r.y + r.height / 2;
      const hit = (x: number, y: number) => {
        const found = document.elementFromPoint(x, y);
        return !!found && el.contains(found);
      };
      const before = getComputedStyle(el, "::before");
      return {
        width: r.width,
        height: r.height,
        hits: [
          hit(cx - 21, cy),
          hit(cx + 21, cy),
          hit(cx, cy - 21),
          hit(cx, cy + 21),
        ],
        content: before.content,
        position: before.position,
        beforeWidth: before.width,
        beforeHeight: before.height,
        background: before.backgroundColor,
        borderWidth: before.borderTopWidth,
        shadow: before.boxShadow,
      };
    });
    expect(data.width).toBeCloseTo(40, 0);
    expect(data.height).toBeCloseTo(40, 0);
    expect(data.hits).toEqual([true, true, true, true]);
    expect(["", '""', "none"]).toContain(
      data.content === '""' ? "" : data.content,
    );
    expect(data.position).toBe("absolute");
    expect(data.beforeWidth).toBe("44px");
    expect(data.beforeHeight).toBe("44px");
    expect(data.background).toBe("rgba(0, 0, 0, 0)");
    expect(parseFloat(data.borderWidth)).toBe(0);
    expect(data.shadow).toBe("none");
  });

  test("CA-5: Tenue e Riprova piccolo restano alti 40 con area 44", async ({
    page,
  }, info) => {
    onlyMobile(info);
    await page.goto("/design-system");
    const targets = [
      page.getByTestId("btn-tenue-predefinito"),
      page
        .getByTestId("errore-pagina")
        .getByRole("button", { name: "Riprova" }),
    ];
    for (const target of targets) {
      await target.scrollIntoViewIfNeeded();
      const data = await target.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const cx = r.x + r.width / 2;
        const cy = r.y + r.height / 2;
        const hit = (x: number, y: number) => {
          const found = document.elementFromPoint(x, y);
          return !!found && el.contains(found);
        };
        return {
          height: r.height,
          up: hit(cx, cy - 21),
          down: hit(cx, cy + 21),
        };
      });
      expect(data.height).toBeCloseTo(40, 0);
      expect(data.up).toBe(true);
      expect(data.down).toBe(true);
    }
  });

  for (const route of [
    "/oggi",
    "/calendario",
    "/casa/spesa",
    "/notifiche",
    "/nest",
    "/profilo",
    "/oggi/pagina-che-non-esiste",
  ]) {
    test(`CA-6: A a 390 px, tutti i controlli di ${route} hanno area di tocco 44`, async ({
      page,
      context,
      baseURL,
    }, info) => {
      onlyMobile(info);
      await loginAs("A", { context, baseURL });
      await openFrame(page, route);
      expect(await touchFailures(page)).toEqual([]);
    });
  }

  for (const route of [
    "/accesso",
    "/accesso/mail",
    "/accesso/link-scaduto",
    "/termini",
  ]) {
    test(`CA-7: senza sessione, ${route} ha aree di tocco 44`, async ({
      page,
    }, info) => {
      onlyMobile(info);
      await page.goto(route);
      await expect(page.locator("h1:visible")).toHaveCount(1);
      expect(await touchFailures(page)).toEqual([]);
    });
  }

  test("CA-7: C a 390 px, /onboarding ha aree di tocco 44", async ({
    page,
    context,
    baseURL,
  }, info) => {
    onlyMobile(info);
    await loginAs("C", { context, baseURL });
    await page.goto("/onboarding");
    await expect(page.locator("h1:visible")).toHaveCount(1);
    expect(await touchFailures(page)).toEqual([]);
  });

  test("CA-8: i bottoni della cornice restano 40x40 e le aree non si rubano il tocco", async ({
    page,
    context,
    baseURL,
  }, info) => {
    await loginAs("A", { context, baseURL });
    await openFrame(page, "/oggi");
    const sizes = await page.evaluate(() =>
      [
        ...document.querySelectorAll<HTMLElement>(
          ".barra .btn-icona, .nav-alto .btn-icona, a.quadrato-nest:not(.quadrato-nest--notte)",
        ),
      ]
        .filter((el) => el.checkVisibility())
        .map((el) => {
          const r = el.getBoundingClientRect();
          return [Math.round(r.width), Math.round(r.height)];
        }),
    );
    expect(sizes.length).toBeGreaterThanOrEqual(2);
    for (const size of sizes) expect(size).toEqual([40, 40]);

    if (isDesktop(info)) {
      const nav = page.locator("header.nav-alto");
      const search = nav.getByRole("link", { name: /Cerca nel Nest/ });
      const bell = nav.getByRole("link", { name: "Notifiche" });
      const a = (await search.boundingBox())!;
      const b = (await bell.boundingBox())!;
      const midX = (a.x + a.width + b.x) / 2;
      const midY = a.y + a.height / 2;
      const owner = await page.evaluate(
        ([x, y]) => {
          const found = document.elementFromPoint(x!, y!);
          return {
            inSearch: !!found?.closest('a[href="/ricerca"]'),
            inBell: !!found?.closest('a[href="/notifiche"]'),
          };
        },
        [midX, midY],
      );
      expect(owner).toEqual({ inSearch: false, inBell: false });
    }
  });
});

// ---------------------------------------------------------------- Punto 8

/** Accessible label of the focused element, as in the a11y focus-order test. */
async function focusedLabel(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return "";
    return (el.getAttribute("aria-label") ?? el.textContent ?? "").trim();
  });
}

test.describe("punto 8: Vai al contenuto", () => {
  test("CA-9: nascosto finche' non ha il focus, poi visibile e grande", async ({
    page,
    context,
    baseURL,
  }, info) => {
    onlyDesktop(info);
    await loginAs("A", { context, baseURL });
    await openFrame(page, "/oggi");
    const skip = page.getByRole("link", { name: "Vai al contenuto" });
    const before = await skip.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return {
        small: r.width <= 1 && r.height <= 1,
        outside:
          r.right <= 0 ||
          r.bottom <= 0 ||
          r.left >= innerWidth ||
          r.top >= innerHeight,
      };
    });
    expect(before.small || before.outside).toBe(true);
    await page.keyboard.press("Tab");
    await expect(skip).toBeFocused();
    const box = (await skip.boundingBox())!;
    const viewport = page.viewportSize()!;
    // Decision of the coordinator (editable by Francesco): 40 px (.btn--piccolo),
    // tolerance 1 px. The 44 px touch area is not checked here.
    expect(Math.abs(box.height - 40)).toBeLessThanOrEqual(1);
    await expect(skip).toBeVisible();
    const ring = await skip.evaluate((el) => {
      const s = getComputedStyle(el);
      return (
        (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) ||
        s.boxShadow !== "none"
      );
    });
    expect(ring).toBe(true);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
  });

  test("CA-10: Invio porta il focus sul main, senza ricaricare; il Tab successivo resta nel main", async ({
    page,
    context,
    baseURL,
  }, info) => {
    onlyDesktop(info);
    await loginAs("A", { context, baseURL });
    await openFrame(page, "/oggi");
    const skip = page.getByRole("link", { name: "Vai al contenuto" });
    await page.keyboard.press("Tab");
    await expect(skip).toBeFocused();

    const documentRequests: string[] = [];
    page.on("request", (request) => {
      if (request.resourceType() === "document") {
        documentRequests.push(request.url());
      }
    });
    await page.keyboard.press("Enter");

    await expect(page.locator("main")).toBeFocused();
    const url = new URL(page.url());
    expect(url.pathname).toBe("/oggi");
    expect(url.search).toBe("");
    expect(["", "#contenuto"]).toContain(url.hash);
    expect(documentRequests).toEqual([]);

    // The first activatable element inside <main> (if any) is the next stop.
    const firstInMain = await page.evaluate(() => {
      const main = document.querySelector("main")!;
      const candidate = main.querySelector<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      return candidate
        ? (
            candidate.getAttribute("aria-label") ??
            candidate.textContent ??
            ""
          ).trim()
        : null;
    });
    await page.keyboard.press("Tab");
    const inNavigation = await page.evaluate(
      () =>
        !!document.activeElement?.closest(
          "header, nav, .barra, .nav-alto, .nav-basso",
        ),
    );
    expect(inNavigation).toBe(false);
    if (firstInMain !== null) {
      expect(await focusedLabel(page)).toBe(firstInMain);
      expect(
        await page.evaluate(() => !!document.activeElement?.closest("main")),
      ).toBe(true);
    }
  });

  for (const route of FRAME_ROUTES) {
    test(`CA-11: ${route} ha un solo Vai al contenuto, primo con Tab, e un solo main`, async ({
      page,
      context,
      baseURL,
    }) => {
      await loginAs("A", { context, baseURL });
      await openFrame(page, route);
      await expect(
        page.getByRole("link", { name: "Vai al contenuto" }),
      ).toHaveCount(1);
      await expect(page.locator("main")).toHaveCount(1);
      await page.keyboard.press("Tab");
      await expect(
        page.getByRole("link", { name: "Vai al contenuto" }),
      ).toBeFocused();
    });
  }

  test("CA-11: anche la pagina inesistente ha il link e un solo main", async ({
    page,
    context,
    baseURL,
  }) => {
    await loginAs("A", { context, baseURL });
    await openFrame(page, "/oggi/pagina-che-non-esiste");
    await expect(
      page.getByRole("link", { name: "Vai al contenuto" }),
    ).toHaveCount(1);
    await expect(page.locator("main")).toHaveCount(1);
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("link", { name: "Vai al contenuto" }),
    ).toBeFocused();
  });

  test("CA-12: senza sessione /accesso non ha Vai al contenuto", async ({
    page,
  }, info) => {
    onlyMobile(info);
    await page.goto("/accesso");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(
      page.getByRole("link", { name: "Vai al contenuto" }),
    ).toHaveCount(0);
    await page.keyboard.press("Tab");
    expect(await focusedLabel(page)).not.toContain("Vai al contenuto");
  });
});

// ---------------------------------------------------------------- Punto 9

/** True when `first` comes before `second` in the document. */
async function comesBefore(first: Locator, second: Locator) {
  const other = await second.elementHandle();
  return first.evaluate(
    (el, node) =>
      !!(
        el.compareDocumentPosition(node as Node) &
        Node.DOCUMENT_POSITION_FOLLOWING
      ),
    other,
  );
}

test.describe("punto 9: campanella in Calendario e Casa", () => {
  test("CA-13: la barra di Calendario ha quadrato, lente, Cerca e Notifiche", async ({
    page,
    context,
    baseURL,
  }, info) => {
    onlyMobile(info);
    await loginAs("A", { context, baseURL });
    await openFrame(page, "/calendario");
    const bar = page.locator("header.barra");
    const square = bar.getByRole("link", { name: /^Apri / });
    const lens = bar.getByRole("group", {
      name: /Punto di vista/,
    });
    const search = bar.getByRole("link", { name: "Cerca nel Nest" });
    const bell = bar.getByRole("link", { name: "Notifiche" });
    await expect(square).toBeVisible();
    await expect(lens).toBeVisible();
    await expect(search).toHaveAttribute("href", "/ricerca");
    await expect(bell).toHaveAttribute("href", "/notifiche");
    expect(await comesBefore(square, lens)).toBe(true);
    expect(await comesBefore(lens, search)).toBe(true);
    expect(await comesBefore(search, bell)).toBe(true);
    await expect(async () => {
      await bell.click();
      await expect(page).toHaveURL(/\/notifiche$/, { timeout: 1000 });
    }).toPass();
  });

  test("CA-14: la barra di Casa ha quadrato, h1 Casa, Cerca e Notifiche; Oggi non ha Cerca", async ({
    page,
    context,
    baseURL,
  }, info) => {
    onlyMobile(info);
    await loginAs("A", { context, baseURL });
    await openFrame(page, "/casa/spesa");
    const bar = page.locator("header.barra");
    const square = bar.getByRole("link", { name: /^Apri / });
    const title = bar.getByRole("heading", { level: 1, name: "Casa" });
    const search = bar.getByRole("link", { name: "Cerca nel Nest" });
    const bell = bar.getByRole("link", { name: "Notifiche" });
    await expect(title).toBeVisible();
    await expect(search).toBeVisible();
    await expect(bell).toBeVisible();
    expect(await comesBefore(square, title)).toBe(true);
    expect(await comesBefore(title, search)).toBe(true);
    expect(await comesBefore(search, bell)).toBe(true);

    await openFrame(page, "/oggi");
    const today = page.locator("header.barra");
    await expect(today.getByRole("link", { name: /^Apri / })).toBeVisible();
    await expect(
      today.getByRole("group", { name: /Punto di vista/ }),
    ).toBeVisible();
    await expect(today.getByRole("link", { name: "Notifiche" })).toBeVisible();
    await expect(
      today.getByRole("link", { name: "Cerca nel Nest" }),
    ).toHaveCount(0);
  });

  for (const route of ["/calendario", "/casa/spesa"]) {
    test(`CA-15: la barra di ${route} non si sovrappone e non scorre in orizzontale`, async ({
      page,
      context,
      baseURL,
    }, info) => {
      onlyMobile(info);
      await loginAs("A", { context, baseURL });
      await openFrame(page, route);
      const rects = await page.evaluate(() => {
        const bar = document.querySelector("header.barra")!;
        const pick = (el: Element | null) => {
          const r = el!.getBoundingClientRect();
          return { x: r.x, y: r.y, right: r.right, bottom: r.bottom };
        };
        const centre =
          bar.querySelector('[role="group"]') ?? bar.querySelector("h1");
        return [
          pick(bar.querySelector("a.quadrato-nest")),
          pick(centre),
          pick(bar.querySelector('a[href="/ricerca"]')),
          pick(bar.querySelector('a[href="/notifiche"]')),
        ];
      });
      for (const r of rects) {
        expect(r.x).toBeGreaterThanOrEqual(0);
        expect(r.right).toBeLessThanOrEqual(390);
      }
      for (let i = 0; i < rects.length; i += 1) {
        for (let j = i + 1; j < rects.length; j += 1) {
          const a = rects[i]!;
          const b = rects[j]!;
          const overlap =
            a.x < b.right - 0.5 &&
            b.x < a.right - 0.5 &&
            a.y < b.bottom - 0.5 &&
            b.y < a.bottom - 0.5;
          expect(overlap, `elementi ${i} e ${j} si sovrappongono`).toBe(false);
        }
      }
      const scroll = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(scroll.scrollWidth).toBeLessThanOrEqual(scroll.clientWidth);
    });

    test(`CA-16: la campanella di ${route} si chiama Notifiche e non ha il pallino`, async ({
      page,
      context,
      baseURL,
    }, info) => {
      onlyMobile(info);
      await loginAs("A", { context, baseURL });
      await openFrame(page, route);
      const bell = page
        .locator("header.barra")
        .getByRole("link", { name: "Notifiche", exact: true });
      await expect(bell).toHaveCount(1);
      await expect(bell).toHaveAttribute("aria-label", "Notifiche");
      await expect(bell.locator(".btn-icona__punto")).toHaveCount(0);
    });
  }
});

// --------------------------------------------------------------- Punto 10

function visibleAdd(page: Page) {
  return page.getByRole("link", { name: "Aggiungi", exact: true });
}

test.describe("punto 10: Aggiungi su desktop", () => {
  for (const route of [...FRAME_ROUTES, "/oggi/pagina-che-non-esiste"]) {
    test(`CA-17: ${route} ha Aggiungi nella navigazione in alto`, async ({
      page,
      context,
      baseURL,
    }, info) => {
      onlyDesktop(info);
      await loginAs("A", { context, baseURL });
      await openFrame(page, route);
      const inHeader = page
        .locator("header.nav-alto")
        .getByRole("link", { name: "Aggiungi", exact: true });
      await expect(inHeader).toHaveAttribute("href", "/aggiungi");
      await expect(visibleAdd(page)).toHaveCount(1);
    });
  }

  test("CA-18: l'ordine del Tab su desktop", async ({
    page,
    context,
    baseURL,
  }, info) => {
    onlyDesktop(info);
    await loginAs("A", { context, baseURL });
    await openFrame(page, "/oggi");
    const expected = [
      "Vai al contenuto",
      "FamilyNest",
      "Oggi",
      "Calendario",
      "Casa",
      "Aggiungi",
      "Cerca nel Nest (⌘K)",
      "Notifiche",
      "Apri Casa D'Angelo: membri, Esplora e impostazioni",
    ];
    for (const name of expected) {
      await page.keyboard.press("Tab");
      const label = await focusedLabel(page);
      expect(label.replace(/\s+/g, " ")).toBe(name);
    }
  });

  test("CA-19: da Casa, Aggiungi porta a /aggiungi senza aria-current", async ({
    page,
    context,
    baseURL,
  }, info) => {
    onlyDesktop(info);
    await loginAs("A", { context, baseURL });
    await openFrame(page, "/casa/spesa");
    const add = page.locator("header.nav-alto").getByRole("link", {
      name: "Aggiungi",
      exact: true,
    });
    await expect(add).not.toHaveAttribute("aria-current", /.*/);
    await expect(async () => {
      await add.click();
      await expect(page).toHaveURL(/\/aggiungi$/, { timeout: 1000 });
    }).toPass();
    await expect(
      page
        .locator("header.nav-alto")
        .getByRole("link", { name: "Aggiungi", exact: true }),
    ).not.toHaveAttribute("aria-current", /.*/);
  });

  test("CA-20: a 1023 px l'unico Aggiungi e' in basso, a 1024 px in alto", async ({
    page,
    context,
    baseURL,
  }, info) => {
    onlyDesktop(info);
    await loginAs("A", { context, baseURL });
    await page.setViewportSize({ width: 1023, height: 800 });
    await openFrame(page, "/oggi");
    await expect(visibleAdd(page)).toHaveCount(1);
    await expect(
      page
        .getByRole("navigation", { name: "Navigazione principale" })
        .getByRole("link", { name: "Aggiungi", exact: true }),
    ).toHaveCount(1);
    await expect(
      page.locator("header.nav-alto").getByRole("link", { name: "Aggiungi" }),
    ).toHaveCount(0);

    await page.setViewportSize({ width: 1024, height: 800 });
    await expect(visibleAdd(page)).toHaveCount(1);
    await expect(
      page
        .locator("header.nav-alto")
        .getByRole("link", { name: "Aggiungi", exact: true }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("navigation", { name: "Navigazione principale" })
        .getByRole("link", { name: "Aggiungi" }),
    ).toHaveCount(0);
  });
});

// --------------------------------------------------------------- Punto 11

/** aria-current of every link of the visible main navigation, by label. */
async function navCurrent(page: Page) {
  return page.evaluate(() => {
    const navs = [
      ...document.querySelectorAll<HTMLElement>(
        'nav[aria-label="Navigazione principale"]',
      ),
    ].filter((nav) => nav.checkVisibility());
    const out: Record<string, { current: string | null; active: boolean }> = {};
    for (const link of navs.flatMap((nav) => [...nav.querySelectorAll("a")])) {
      out[(link.textContent ?? "").trim()] = {
        current: link.getAttribute("aria-current"),
        active: link.classList.contains("is-attiva"),
      };
    }
    return out;
  });
}

function currentOf(
  nav: Record<string, { current: string | null }>,
  label: string,
) {
  const key = Object.keys(nav).find((name) => name.includes(label));
  return key ? nav[key]!.current : undefined;
}

test.describe("punto 11: aria-current", () => {
  for (const [route, item, label] of [
    ["/oggi", "oggi", "Oggi"],
    ["/calendario", "calendario", "Calendario"],
    ["/casa/spesa", "casa", "Casa"],
  ] as const) {
    test(`CA-21: su ${route} la voce ${label} (mobile) ha aria-current=page`, async ({
      page,
      context,
      baseURL,
    }, info) => {
      onlyMobile(info);
      await loginAs("A", { context, baseURL });
      await openFrame(page, route);
      const nav = await navCurrent(page);
      expect(currentOf(nav, label)).toBe("page");
      expect(item).toBeTruthy();
      const withCurrent = Object.values(nav).filter((v) => v.current !== null);
      expect(withCurrent).toHaveLength(1);
    });

    test(`CA-22: su ${route} la voce ${label} (desktop) ha aria-current=page`, async ({
      page,
      context,
      baseURL,
    }, info) => {
      onlyDesktop(info);
      await loginAs("A", { context, baseURL });
      await openFrame(page, route);
      const nav = await navCurrent(page);
      expect(currentOf(nav, label)).toBe("page");
      expect(Object.values(nav).filter((v) => v.current !== null)).toHaveLength(
        1,
      );
    });
  }

  for (const route of ["/aggiungi", "/notifiche"]) {
    test(`CA-21: su ${route} Oggi (mobile) e' evidenziato con aria-current=true`, async ({
      page,
      context,
      baseURL,
    }, info) => {
      onlyMobile(info);
      await loginAs("A", { context, baseURL });
      await openFrame(page, route);
      const nav = await navCurrent(page);
      expect(currentOf(nav, "Oggi")).toBe("true");
      const today = Object.entries(nav).find(([name]) => name.includes("Oggi"));
      expect(today![1].active).toBe(true);
      expect(Object.values(nav).some((v) => v.current === "page")).toBe(false);
    });
  }

  for (const route of ["/aggiungi", "/ricerca"]) {
    test(`CA-22: su ${route} Oggi (desktop) ha aria-current=true`, async ({
      page,
      context,
      baseURL,
    }, info) => {
      onlyDesktop(info);
      await loginAs("A", { context, baseURL });
      await openFrame(page, route);
      const nav = await navCurrent(page);
      expect(currentOf(nav, "Oggi")).toBe("true");
      expect(Object.values(nav).some((v) => v.current === "page")).toBe(false);
    });
  }

  for (const route of [
    "/nest",
    "/notifiche",
    "/profilo",
    "/calendari-collegati",
    "/impostazioni",
    "/membri",
  ]) {
    test(`CA-22: su ${route} nessuna voce desktop ha aria-current`, async ({
      page,
      context,
      baseURL,
    }, info) => {
      onlyDesktop(info);
      await loginAs("A", { context, baseURL });
      await openFrame(page, route);
      const nav = await navCurrent(page);
      expect(Object.values(nav).filter((v) => v.current !== null)).toEqual([]);
    });
  }

  test("CA-23: la regola pura di aria-current", () => {
    const value = (
      path: string,
      viewport: "mobile" | "desktop",
      item: NavItem,
    ) => getNavAriaCurrent(path, viewport, item);
    for (const viewport of ["mobile", "desktop"] as const) {
      expect(value("/calendario/giorno", viewport, "calendario")).toBe("true");
      expect(value("/impegni/123", viewport, "calendario")).toBe("true");
      expect(value("/casa/da-fare", viewport, "casa")).toBe("true");
    }
    expect(value("/esplora/x", "mobile", "oggi")).toBe("true");
    expect(value("/figli/x", "mobile", "oggi")).toBe("true");
    expect(getActiveNavItem("/esplora/x", "desktop")).toBeNull();
    expect(getActiveNavItem("/figli/x", "desktop")).toBeNull();
    for (const item of ["oggi", "calendario", "casa"] as const) {
      expect(value("/esplora/x", "desktop", item)).toBeUndefined();
      expect(value("/figli/x", "desktop", item)).toBeUndefined();
    }
    expect(value("/oggi", "mobile", "oggi")).toBe("page");
    expect(value("/calendario", "desktop", "calendario")).toBe("page");
    expect(value("/casa/spesa", "mobile", "casa")).toBe("page");

    const routes = [
      "/oggi",
      "/aggiungi",
      "/calendario",
      "/calendario/giorno",
      "/impegni/123",
      "/casa/spesa",
      "/casa/da-fare",
      "/casa/scadenze",
      "/notifiche",
      "/ricerca",
      "/esplora/x",
      "/figli/x",
      "/nest",
      "/profilo",
    ];
    const items: NavItem[] = ["oggi", "calendario", "casa"];
    for (const route of routes) {
      for (const viewport of ["mobile", "desktop"] as const) {
        const given = items.filter((item) => value(route, viewport, item));
        expect(given.length, `${route} ${viewport}`).toBeLessThanOrEqual(1);
        // "page" only for the three exact addresses.
        for (const item of given) {
          if (value(route, viewport, item) === "page") {
            expect(["/oggi", "/calendario", "/casa/spesa"]).toContain(route);
          }
        }
      }
    }
  });

  test("CA-24: la voce Oggi ha lo stesso aspetto su /oggi e su /notifiche", async ({
    page,
    context,
    baseURL,
  }, info) => {
    onlyMobile(info);
    await loginAs("A", { context, baseURL });
    const read = async (route: string) => {
      await openFrame(page, route);
      return page
        .getByRole("navigation", { name: "Navigazione principale" })
        .getByRole("link", { name: /Oggi/ })
        .evaluate((el) => {
          const s = getComputedStyle(el);
          const after = getComputedStyle(el, "::after");
          const inner = el.querySelector("span, svg");
          const innerStyle = inner ? getComputedStyle(inner) : null;
          return {
            color: s.color,
            background: s.backgroundColor,
            weight: s.fontWeight,
            afterContent: after.content,
            afterBackground: after.backgroundColor,
            afterWidth: after.width,
            afterHeight: after.height,
            innerColor: innerStyle?.color ?? null,
          };
        });
    };
    const onToday = await read("/oggi");
    const onNotifications = await read("/notifiche");
    expect(onNotifications).toEqual(onToday);
  });
});

// --------------------------------------------------------------- Punto 12

const STICKERS = [
  "S Nuoto gio 17:00",
  "Latte e pane",
  "Liberi insieme ven sera",
  "L Calcetto sab 10:00",
];

async function expectFourStickers(container: Locator) {
  await expect(container).toHaveAttribute("aria-hidden", "true");
  const stickers = container.locator(".adesivo");
  await expect(stickers).toHaveCount(4);
  const texts: string[] = [];
  for (const sticker of await stickers.all()) {
    texts.push(await normalizedText(sticker));
  }
  // The avatar letter and the text are separate elements: whitespace is
  // normalized away on both sides, so "S Nuoto" and "SNuoto" are the same.
  const squash = (value: string) => value.replace(/\s+/g, "");
  expect(texts.map(squash)).toEqual(STICKERS.map(squash));
  await expect(stickers.nth(3)).toHaveClass(/adesivo--destra/);
  await expect(stickers.nth(3)).toHaveClass(/membro-glicine/);
}

test.describe("punto 12: adesivo Calcetto", () => {
  test("CA-25: /accesso a 390 px ha quattro adesivi, il quarto e' Calcetto", async ({
    page,
  }, info) => {
    onlyMobile(info);
    await page.goto("/accesso");
    const container = page.locator(".adesivi:visible");
    await expect(container).toHaveCount(1);
    await expectFourStickers(container);
  });

  for (const route of ["/accesso", "/accesso/mail"]) {
    test(`CA-26: ${route} a 1280 px ha gli stessi quattro adesivi`, async ({
      page,
    }, info) => {
      onlyDesktop(info);
      await page.goto(route);
      const container = page.locator(".adesivi:visible");
      await expect(container).toHaveCount(1);
      await expectFourStickers(container);
    });
  }

  test("CA-26: nessuna pagina pubblica contiene la parola Pediatra", async ({
    page,
  }) => {
    for (const route of [
      "/accesso",
      "/accesso/mail",
      "/accesso/link-scaduto",
    ]) {
      const response = await page.request.get(route);
      expect(await response.text(), route).not.toContain("Pediatra");
      await page.goto(route);
      expect(await page.content(), route).not.toContain("Pediatra");
    }
  });

  test("CA-26: C a 1280 px, /onboarding ha gli adesivi senza Pediatra", async ({
    page,
    context,
    baseURL,
  }, info) => {
    onlyDesktop(info);
    await loginAs("C", { context, baseURL });
    await page.goto("/onboarding");
    const container = page.locator(".adesivi:visible");
    await expect(container).toHaveCount(1);
    await expectFourStickers(container);
    expect(await page.content()).not.toContain("Pediatra");
  });

  test("CA-27: gli adesivi non entrano nell'albero di accessibilita'", async ({
    page,
  }, info) => {
    onlyMobile(info);
    await page.goto("/accesso");
    const root = page.locator("main").or(page.locator("body")).first();
    const snapshot = await root.ariaSnapshot();
    expect(snapshot).not.toContain("Calcetto");
    expect(snapshot).not.toContain("Nuoto");
  });
});

// --------------------------------------------------------------- Punto 13

const CANCELLED = (name: string) =>
  `Accesso con ${name} annullato. Riprova o scegli un altro modo per entrare.`;

/** The notice that is shown on screen, whatever its role. */
function notice(page: Page, text: string) {
  return page.locator(".avviso:visible").filter({ hasText: text });
}

test.describe("punto 13: accesso annullato", () => {
  for (const [provider, name, error] of [
    ["google", "Google", "access_denied"],
    ["apple", "Apple", "user_cancelled_authorize"],
  ] as const) {
    test(`CA-${provider === "google" ? 28 : 29}: ${name} annullato mostra l'avviso neutro`, async ({
      page,
    }) => {
      await page.goto(`/auth/callback?provider=${provider}&error=${error}`);
      await expect(page).toHaveURL(
        new RegExp(`/accesso\\?errore=${provider}&annullato=1$`),
      );
      const box = notice(page, CANCELLED(name));
      await expect(box).toHaveCount(1);
      await expect(box).toHaveClass(/avviso--info/);
      await expect(box).toHaveAttribute("role", "status");
      await expect(box).toBeFocused();
      await expect(
        page.getByRole("button", { name: "Riprova", exact: true }),
      ).toBeVisible();
      await expect(page.locator('[role="alert"].avviso')).toHaveCount(0);
      await expect(page.locator(".avviso--errore")).toHaveCount(0);
      await expect(
        page.getByRole("alert").filter({ hasText: "Accesso" }),
      ).toHaveCount(0);
    });
  }

  test("CA-30: Riprova rilancia Google e fa sparire l'avviso", async ({
    page,
  }) => {
    test.skip(!supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL non impostato");
    const urls: string[] = [];
    await page.route(`${supabaseUrl}/auth/v1/authorize*`, async (route) => {
      urls.push(route.request().url());
      await route.fulfill({ status: 204 });
    });
    await page.goto("/accesso?errore=google&annullato=1");
    const box = notice(page, CANCELLED("Google"));
    await expect(box).toBeVisible();
    // Clicks from the DOM (a locator click would wait for the pending
    // navigation) until the page is hydrated and the request leaves.
    await expect(async () => {
      await page.evaluate(() => {
        const retry = [
          ...document.querySelectorAll<HTMLButtonElement>("main button"),
        ].find(
          (b) =>
            b.checkVisibility() && (b.textContent ?? "").trim() === "Riprova",
        );
        retry?.click();
      });
      await expect
        .poll(() => urls.length, { timeout: 1000 })
        .toBeGreaterThan(0);
    }).toPass();
    expect(new URL(urls[0]!).searchParams.get("provider")).toBe("google");
    // Read from the DOM: while the (held) provider request is pending, locators
    // would wait for the navigation to finish.
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            [...document.querySelectorAll<HTMLElement>(".avviso")].filter(
              (el) =>
                el.checkVisibility() &&
                (el.textContent ?? "").includes("annullato"),
            ).length,
        ),
      )
      .toBe(0);
  });

  test("CA-31: gli errori veri restano rossi", async ({ page, context }) => {
    await page.goto("/auth/callback?provider=google&error=server_error");
    const red = page.locator(".avviso--errore:visible").filter({
      hasText:
        "Accesso con Google non riuscito. Controlla la connessione e riprova.",
    });
    await expect(red).toHaveCount(1);
    await expect(red).toHaveAttribute("role", "alert");
    await expect(page.locator(".avviso--info")).toHaveCount(0);

    await page.goto("/accesso");
    const apple = page.getByRole("button", { name: "Continua con Apple" });
    await expect(apple).toBeEnabled();
    await context.setOffline(true);
    await expect(async () => {
      await apple.click({ timeout: 2000, noWaitAfter: true });
      await expect(
        page.locator(".avviso--errore:visible").filter({
          hasText:
            "Accesso con Apple non riuscito. Controlla la connessione e riprova.",
        }),
      ).toHaveAttribute("role", "alert", { timeout: 1000 });
    }).toPass();
  });
});

// -------------------------------------------------------------- Isolamento

test.describe("isolamento tra nuclei", () => {
  const FORBIDDEN = [
    "Casa D'Angelo",
    "Marco",
    "Laura",
    "Sofia",
    "Tommaso",
    "Biscotto",
  ];

  async function expectNothingOfA(page: Page, route: string, withAdd: boolean) {
    await openFrame(page, route);
    const square = page.getByRole("link", {
      name: "Apri Casa Bianchi: membri, Esplora e impostazioni",
    });
    await expect(square.first()).toBeAttached();
    const html = await page.content();
    for (const word of FORBIDDEN) {
      expect(html, `${route} contiene ${word}`).not.toContain(word);
    }
    const raw = await (await page.context().request.get(route)).text();
    for (const word of FORBIDDEN) {
      expect(raw, `${route} (HTML grezzo) contiene ${word}`).not.toContain(
        word,
      );
    }
    const hrefs = await page.evaluate(() => {
      const pick = (selector: string) =>
        [...document.querySelectorAll<HTMLAnchorElement>(selector)].map((a) =>
          a.getAttribute("href"),
        );
      return {
        bell: pick('a[href^="/notifiche"]'),
        add: pick('a[href^="/aggiungi"]'),
        skip: pick('a[href^="#"]'),
      };
    });
    const uuid = /[0-9a-f]{8}-[0-9a-f]{4}-/i;
    const all = [...hrefs.bell, ...hrefs.add, ...hrefs.skip].map(String);
    for (const href of all) {
      expect(href).not.toContain("?");
      expect(href).not.toMatch(uuid);
    }
    expect(hrefs.bell.length).toBeGreaterThan(0);
    expect(hrefs.skip).toContain("#contenuto");
    if (withAdd) expect(hrefs.add.length).toBeGreaterThan(0);
  }

  for (const route of ["/calendario", "/casa/spesa"]) {
    test(`CA-32: B a 390 px su ${route} non vede nulla di A`, async ({
      page,
      context,
      baseURL,
    }, info) => {
      onlyMobile(info);
      await loginAs("B", { context, baseURL });
      await expectNothingOfA(page, route, false);
    });
  }

  test("CA-32: B a 1280 px su /oggi non vede nulla di A", async ({
    page,
    context,
    baseURL,
  }, info) => {
    onlyDesktop(info);
    await loginAs("B", { context, baseURL });
    await expectNothingOfA(page, "/oggi", true);
  });
});
