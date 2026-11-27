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
  getDesktopBarConfig,
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
  // With React streaming a second, hidden <main> may exist for a moment.
  await expect(page.getByRole("main")).toBeVisible();
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
      // The week arrows of /calendario sit side by side: their 44 px areas
      // (the ::before) overlap in the middle, so the horizontal check looks
      // only at the outer edge (LEZIONI: elementFromPoint, never the box).
      const arrow = /^Settimana (precedente|successiva)$/.exec(
        el.getAttribute("aria-label") ?? "",
      );
      if (arrow) {
        const outer = arrow[1] === "precedente" ? cx - 21.5 : cx + 21.5;
        if (!(hit(cx, cy - 21.5) && hit(cx, cy + 21.5))) {
          failures.push(`${label}: area verticale < 44`);
        }
        if (!hit(outer, cy)) failures.push(`${label}: area orizzontale < 44`);
        continue;
      }
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

  test("CA-5: Tenue resta alto 40 con area 44; Riprova di PageError è di misura normale (52)", async ({
    page,
  }, info) => {
    onlyMobile(info);
    await page.goto("/design-system");
    // #503 (F4a), §1 e §3: «tenue» ha altezza invariata; il «Riprova» di
    // PageError è un secondario di misura normale (52), non più piccolo.
    const targets = [
      { target: page.getByTestId("btn-tenue-predefinito"), height: 40 },
      {
        target: page
          .getByTestId("errore-pagina")
          .getByRole("button", { name: "Riprova" }),
        height: 52,
      },
    ];
    for (const { target, height } of targets) {
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
      expect(data.height).toBeCloseTo(height, 0);
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

  for (const route of ["/accesso", "/accesso/link-scaduto", "/termini"]) {
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

  // F5 (#506): the icon controls of the phone header are bare and 44 px; on a
  // computer the bell stays 40 px (44 with the finger, `data-gesto`).
  test("CA-8: i bottoni della cornice hanno la misura del guscio e le aree non si rubano il tocco", async ({
    page,
    context,
    baseURL,
  }, info) => {
    await loginAs("A", { context, baseURL });
    await openFrame(page, "/oggi");
    const sizes = await page.evaluate(() =>
      [
        ...document.querySelectorAll<HTMLElement>(
          ".testata .btn-icona, .barra-alto .btn-icona",
        ),
      ]
        .filter((el) => el.checkVisibility())
        .map((el) => {
          const r = el.getBoundingClientRect();
          return [Math.round(r.width), Math.round(r.height)];
        }),
    );
    // Phone: «Cerca» and «Notifiche»; computer: the bell (the search is a field).
    expect(sizes.length).toBeGreaterThanOrEqual(isDesktop(info) ? 1 : 2);
    const side = isDesktop(info) ? 40 : 44;
    for (const size of sizes) expect(size).toEqual([side, side]);

    if (isDesktop(info)) {
      const bar = page.getByTestId("barra-alto");
      const search = bar.getByRole("link", { name: "Cerca" });
      const bell = bar.getByRole("link", { name: "Notifiche" });
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
    // Pages with two layouts (Oggi, #30) keep the hidden one in the DOM: only
    // the elements that are on screen can take the focus.
    const firstInMain = await page.evaluate(() => {
      const main = document.querySelector("main")!;
      const candidate = Array.from(
        main.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).find((element) => element.getClientRects().length > 0);
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
          "header, nav, .testata, .barra-alto, .barra-laterale, .barra-basso",
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
    }, info) => {
      await loginAs("A", { context, baseURL });
      await openFrame(page, route);
      await expect(
        page.getByRole("link", { name: "Vai al contenuto" }),
      ).toHaveCount(1);
      await expect(page.getByRole("main")).toHaveCount(1);
      if (route === "/ricerca" && info.project.name === "mobile") {
        // on a phone it is the real page (#40, section 3): by specification
        // the focus opens inside the search field, so the first Tab goes on
        // to «Annulla». The skip link is still the first stop of the page:
        // Shift+Tab from the field must land on it, and it must come before
        // the only <main>.
        await expect(page.getByRole("searchbox")).toBeFocused();
        await page.keyboard.press("Shift+Tab");
        await expect(
          page.getByRole("link", { name: "Vai al contenuto" }),
        ).toBeFocused();
        return;
      }
      if (route === "/ricerca" && info.project.name !== "mobile") {
        // opened directly it is a modal palette over Today (#40, section 3):
        // the focus opens in the field and is trapped inside the dialog, so
        // Tab never reaches the skip link behind it (same as /aggiungi)
        await expect(
          page.getByRole("dialog", { name: "Cerca nel Nest" }),
        ).toBeVisible();
        await page.keyboard.press("Tab");
        expect(
          await page.evaluate(
            () => !!document.activeElement?.closest('[role="dialog"]'),
          ),
        ).toBe(true);
        return;
      }
      await page.keyboard.press("Tab");
      if (route === "/aggiungi") {
        // opened directly it is a modal sheet over Today (#164): the focus is
        // trapped inside it, so Tab never reaches the skip link behind it
        await expect(
          page.getByRole("dialog", { name: "Aggiungi" }),
        ).toBeVisible();
        expect(
          await page.evaluate(
            () => !!document.activeElement?.closest('[role="dialog"]'),
          ),
        ).toBe(true);
        return;
      }
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
    await expect(page.getByRole("main")).toHaveCount(1);
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
  test("CA-13: la testata di Calendario ha titolo, lente, Cerca e Notifiche", async ({
    page,
    context,
    baseURL,
  }, info) => {
    onlyMobile(info);
    await loginAs("A", { context, baseURL });
    await openFrame(page, "/calendario");
    const bar = page.getByTestId("testata");
    const title = bar.getByText("Calendario", { exact: true });
    const lens = bar.getByRole("group", {
      name: /Punto di vista/,
    });
    const search = bar.getByRole("link", { name: "Cerca" });
    const bell = bar.getByRole("link", { name: "Notifiche" });
    await expect(title).toBeVisible();
    await expect(lens).toBeVisible();
    await expect(search).toHaveAttribute("href", "/ricerca");
    await expect(bell).toHaveAttribute("href", "/notifiche");
    expect(await comesBefore(title, lens)).toBe(true);
    expect(await comesBefore(lens, search)).toBe(true);
    expect(await comesBefore(search, bell)).toBe(true);
    await expect(async () => {
      await bell.click();
      await expect(page).toHaveURL(/\/notifiche$/, { timeout: 1000 });
    }).toPass();
  });

  test("CA-14: la testata di Casa ha h1 Casa, Cerca e Notifiche; Oggi ha la lente, Cerca e Notifiche", async ({
    page,
    context,
    baseURL,
  }, info) => {
    onlyMobile(info);
    await loginAs("A", { context, baseURL });
    await openFrame(page, "/casa/spesa");
    const bar = page.getByTestId("testata");
    const title = bar.getByRole("heading", { level: 1, name: "Casa" });
    const search = bar.getByRole("link", { name: "Cerca" });
    const bell = bar.getByRole("link", { name: "Notifiche" });
    await expect(title).toBeVisible();
    await expect(search).toBeVisible();
    await expect(bell).toBeVisible();
    expect(await comesBefore(title, search)).toBe(true);
    expect(await comesBefore(search, bell)).toBe(true);

    await openFrame(page, "/oggi");
    const today = page.getByTestId("testata");
    await expect(
      today.getByRole("group", { name: /Punto di vista/ }),
    ).toBeVisible();
    await expect(today.getByRole("link", { name: "Cerca" })).toBeVisible();
    await expect(today.getByRole("link", { name: "Notifiche" })).toBeVisible();
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
        const bar = document.querySelector("header.testata")!;
        const pick = (el: Element | null) => {
          const r = el!.getBoundingClientRect();
          return { x: r.x, y: r.y, right: r.right, bottom: r.bottom };
        };
        const title = bar.querySelector(".testata__titolo");
        const lens = bar.querySelector('[role="group"]');
        return [
          pick(title),
          ...(lens ? [pick(lens)] : []),
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
        .getByTestId("testata")
        .getByRole("link", { name: "Notifiche", exact: true });
      await expect(bell).toHaveCount(1);
      await expect(bell).toHaveAttribute("aria-label", "Notifiche");
      await expect(bell.locator(".btn-icona__punto")).toHaveCount(0);
    });
  }
});

// --------------------------------------------------------------- Punto 10

// F5 (#506): «Aggiungi» left the navigation; on a computer «Nuovo impegno» is
// the button on the right of the top bar, where §2 says so (Oggi, Calendario).
function visibleAdd(page: Page) {
  return page.getByRole("link", { name: "Nuovo impegno", exact: true });
}

test.describe("punto 10: «Nuovo impegno» su desktop", () => {
  for (const route of [...FRAME_ROUTES, "/oggi/pagina-che-non-esiste"]) {
    test(`CA-17: ${route} ha «Nuovo impegno» nella barra in alto solo dove la tabella lo prevede`, async ({
      page,
      context,
      baseURL,
    }, info) => {
      onlyDesktop(info);
      await loginAs("A", { context, baseURL });
      await openFrame(page, route);
      const inBar = page
        .getByTestId("barra-alto")
        .getByRole("link", { name: "Nuovo impegno", exact: true });
      if (getDesktopBarConfig(route).newEvent) {
        await expect(inBar).toHaveAttribute("href", "/aggiungi");
        await expect(visibleAdd(page)).toHaveCount(1);
      } else {
        await expect(inBar).toHaveCount(0);
      }
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
    // Sidebar (lens, entries, «Di casa», profile), top bar, then the content.
    const expected = [
      "Vai al contenuto",
      "Io",
      "Nest",
      "Oggi",
      "Calendario",
      "Casa",
      "Spazi",
      "Spesa",
      "Marco, Il tuo Nest",
      "Cerca",
      "Notifiche",
      "Nuovo impegno",
    ];
    for (const name of expected) {
      await page.keyboard.press("Tab");
      const label = await focusedLabel(page);
      expect(label.replace(/\s+/g, " ")).toContain(name);
    }
  });

  test("CA-19: da Calendario, «Nuovo impegno» porta a /aggiungi senza aria-current", async ({
    page,
    context,
    baseURL,
  }, info) => {
    onlyDesktop(info);
    await loginAs("A", { context, baseURL });
    await openFrame(page, "/calendario");
    const add = page
      .getByTestId("barra-alto")
      .getByRole("link", { name: "Nuovo impegno", exact: true });
    await expect(add).not.toHaveAttribute("aria-current", /.*/);
    await expect(async () => {
      await add.click();
      await expect(page).toHaveURL(/\/aggiungi$/, { timeout: 1000 });
    }).toPass();
    await expect(
      page
        .getByTestId("barra-alto")
        .getByRole("link", { name: "Nuovo impegno", exact: true }),
    ).not.toHaveAttribute("aria-current", /.*/);
  });

  test("CA-20: a 899 px non c'è la barra in alto, a 900 px sì con «Nuovo impegno»", async ({
    page,
    context,
    baseURL,
  }, info) => {
    onlyDesktop(info);
    await loginAs("A", { context, baseURL });
    await page.setViewportSize({ width: 899, height: 800 });
    await openFrame(page, "/oggi");
    await expect(page.getByTestId("barra-alto")).toBeHidden();
    await expect(visibleAdd(page)).toHaveCount(0);
    await expect(
      page
        .getByRole("navigation", { name: "Navigazione principale" })
        .getByRole("link"),
    ).toHaveCount(4);

    await page.setViewportSize({ width: 900, height: 800 });
    await expect(visibleAdd(page)).toHaveCount(1);
    await expect(page.getByTestId("barra-alto")).toBeVisible();
    await expect(page.getByTestId("barra-basso")).toBeHidden();
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

  // F5 (#506, §2): «Notifiche» has no entry lit any more (it was Oggi).
  for (const route of ["/aggiungi"]) {
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

  for (const route of ["/aggiungi"]) {
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
    // F5 (#506, §2): Spazi is the fourth entry; figli and spaces light it.
    expect(value("/spazi/a-tavola", "mobile", "spazi")).toBe("true");
    expect(value("/figli/x", "mobile", "spazi")).toBe("true");
    expect(value("/spazi/a-tavola", "desktop", "spazi")).toBe("true");
    expect(value("/figli/x", "desktop", "spazi")).toBe("true");
    for (const item of ["oggi", "calendario", "casa"] as const) {
      expect(value("/spazi/a-tavola", "desktop", item)).toBeUndefined();
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
      "/spazi",
      "/spazi/a-tavola",
      "/figli/x",
      "/nest",
      "/profilo",
    ];
    const items: NavItem[] = ["oggi", "calendario", "casa", "spazi"];
    for (const route of routes) {
      for (const viewport of ["mobile", "desktop"] as const) {
        const given = items.filter((item) => value(route, viewport, item));
        expect(given.length, `${route} ${viewport}`).toBeLessThanOrEqual(1);
        // "page" only for the four exact addresses.
        for (const item of given) {
          if (value(route, viewport, item) === "page") {
            expect(["/oggi", "/calendario", "/casa/spesa", "/spazi"]).toContain(
              route,
            );
          }
        }
      }
    }
  });

  // F5 (#506, §2): «Notifiche» lights no entry (it used to light Oggi), so
  // Oggi on /notifiche looks like the entries that are not chosen: it is bold
  // only on /oggi.
  test("CA-24: la voce Oggi è in grassetto su /oggi e normale su /notifiche", async ({
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
        .evaluate((el) => ({
          weight: getComputedStyle(el).fontWeight,
          chosen: el.classList.contains("is-attiva"),
        }));
    };
    expect(await read("/oggi")).toEqual({ weight: "700", chosen: true });
    expect(await read("/notifiche")).toEqual({ weight: "400", chosen: false });
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
  // #461: below 1024 px the sign-in page is the light column, with no night
  // cover and no stickers.
  test("CA-25: /accesso a 390 px non ha gli adesivi (colonna chiara)", async ({
    page,
  }, info) => {
    onlyMobile(info);
    await page.goto("/accesso");
    await expect(page.locator("h1:visible")).toHaveCount(1);
    await expect(page.locator(".adesivi:visible")).toHaveCount(0);
  });

  test("CA-26: /accesso a 1280 px ha i quattro adesivi", async ({
    page,
  }, info) => {
    onlyDesktop(info);
    await page.goto("/accesso");
    const container = page.locator(".adesivi:visible");
    await expect(container).toHaveCount(1);
    await expectFourStickers(container);
  });

  test("CA-26: nessuna pagina pubblica contiene la parola Pediatra", async ({
    page,
  }) => {
    for (const route of ["/accesso", "/accesso/link-scaduto"]) {
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

  const FIXED_EXAMPLE = "nuoto Sofia giovedì alle 17";

  async function expectNothingOfA(page: Page, route: string, withAdd: boolean) {
    await openFrame(page, route);
    // F5 (#506): the Nest of B shows in the profile of the sidebar, not in a square.
    // (Hidden on a phone, but always in the document.)
    const profile = page.locator('a[aria-label="Giulia, Il tuo Nest"]');
    await expect(profile.first()).toBeAttached();
    // The fixed example of the quick-add field of Oggi («nuoto Sofia giovedì
    // alle 17», text of the mockup) is not data of the Nest of A.
    const html = (await page.content()).replaceAll(FIXED_EXAMPLE, "");
    for (const word of FORBIDDEN) {
      expect(html, `${route} contiene ${word}`).not.toContain(word);
    }
    const raw = (
      await (await page.context().request.get(route)).text()
    ).replaceAll(FIXED_EXAMPLE, "");
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
      // Since #22 «Aggiungi una cosa da fare» opens Add with a fixed type
      // (`?tipo=da-fare`): the only query allowed, it carries no data.
      expect(
        href.replace(/\?tipo=(spesa|da-fare|scadenza)$/, ""),
      ).not.toContain("?");
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
