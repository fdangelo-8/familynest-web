import {
  expect,
  test,
  type BrowserContext,
  type Page,
  type Route,
} from "@playwright/test";
import { signInAs, skipReason, usersConfigured } from "../fixtures/auth";

// #196 (F2 token e font): Figtree, how it loads, privacy of the font files and
// no horizontal scroll with the larger text. Seeded users: A = Marco (Nest A).

const PHRASE = "Il piano dei pasti della settimana";
const WOFF2 = "**/_next/static/media/*.woff2";

/**
 * Width of the sample phrase. `family` is a CSS font-family value.
 * `wait`: "none" measures at once, "load" asks the browser to load the first
 * family of the stack (the font of next/font, not its local fallback face,
 * which a runner may not have), "ready" only waits for `document.fonts.ready`
 * (when the font files are made to fail on purpose).
 */
async function phraseWidths(
  page: Page,
  family: string,
  sizes: number[],
  weights: number[],
  wait: "none" | "load" | "ready",
): Promise<Record<string, number>> {
  return page.evaluate(
    async ({ phrase, family, sizes, weights, wait }) => {
      const result: Record<string, number> = {};
      const spans: [string, HTMLSpanElement][] = [];
      for (const size of sizes) {
        for (const weight of weights) {
          const span = document.createElement("span");
          span.textContent = phrase;
          span.style.cssText = `position:absolute;left:0;top:0;white-space:nowrap;letter-spacing:0;font-feature-settings:normal;font-family:${family};font-size:${size}px;font-weight:${weight}`;
          document.body.append(span);
          spans.push([`${size}/${weight}`, span]);
        }
      }
      if (wait === "load") {
        for (const [key, span] of spans) {
          const [size, weight] = key.split("/");
          const first = getComputedStyle(span).fontFamily.split(",")[0]!.trim();
          await document.fonts.load(`${weight} ${size}px ${first}`, phrase);
        }
      }
      if (wait !== "none") await document.fonts.ready;
      for (const [key, span] of spans) {
        result[key] = span.getBoundingClientRect().width;
        span.remove();
      }
      return result;
    },
    { phrase: PHRASE, family, sizes, weights, wait },
  );
}

const APP_FONT = "var(--font-testo)";

async function delayFonts(page: Page, counter: { delayed: number }) {
  await page.route(WOFF2, async (route: Route) => {
    counter.delayed += 1;
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await route.continue();
  });
}

async function signInMarco(
  context: BrowserContext,
  baseURL: string | undefined,
) {
  await signInAs(context, baseURL as string, "A");
}

test.describe("Figtree", () => {
  test("CA-2: Figtree 400, 600 e 700 pronto, niente Parkinsans né Host Grotesk", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/design-system");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // The family of next/font has a generated name that contains "Figtree".
    const result = await page.evaluate(async () => {
      await document.fonts.ready;
      const family = getComputedStyle(document.body).fontFamily;
      // First family of the stack: the font itself, not its local fallback.
      const first = family.split(",")[0]!.trim();
      const ready: Record<string, boolean> = {};
      for (const weight of [400, 600, 700]) {
        await document.fonts.load(`${weight} 16px ${first}`, "Figtree");
        ready[weight] = document.fonts.check(
          `${weight} 16px ${first}`,
          "Figtree",
        );
      }
      return {
        family,
        ready,
        loaded: [...document.fonts]
          .filter((font) => font.status === "loaded")
          .map((font) => font.family),
        direct: ["400", "600", "700"].map((weight) =>
          document.fonts.check(`${weight} 16px Figtree`),
        ),
      };
    });
    expect(result.family).toContain("Figtree");
    expect(result.ready).toEqual({ 400: true, 600: true, 700: true });
    expect(result.direct).toEqual([true, true, true]);
    expect(result.loaded.some((family) => family.includes("Figtree"))).toBe(
      true,
    );
    for (const family of result.loaded) {
      expect(family).not.toMatch(/Parkinsans|Host.?Grotesk/i);
    }
  });

  test("CA-3: le larghezze dell'app stanno entro l'1% di Figtree da Google Fonts", async ({
    page,
    browser,
  }) => {
    // The reference page lives in its own context: CA-8 only looks at the app.
    const reference = await browser.newContext();
    try {
      const refPage = await reference.newPage();
      await refPage.route("https://riferimento.test/", (route) =>
        route.fulfill({
          contentType: "text/html",
          body: '<!doctype html><html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@300..900&display=swap"></head><body></body></html>',
        }),
      );
      await refPage.goto("https://riferimento.test/");
      const check = await refPage.evaluate(async () => {
        await document.fonts.load("400 16px Figtree", "Il piano");
        return document.fonts.check("400 16px Figtree");
      });
      // No Figtree in the reference page: the test fails, it is not skipped.
      expect(check, "Figtree di riferimento non caricato").toBe(true);
      const sizes = [16, 30];
      const weights = [400, 600, 700];
      const wanted = await phraseWidths(
        refPage,
        "Figtree",
        sizes,
        weights,
        "load",
      );

      await page.goto("/design-system");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const actual = await phraseWidths(page, APP_FONT, sizes, weights, "load");
      for (const key of Object.keys(wanted)) {
        const gap = Math.abs(actual[key]! - wanted[key]!) / wanted[key]!;
        expect(
          gap,
          `${key}: app ${actual[key]} contro riferimento ${wanted[key]}`,
        ).toBeLessThanOrEqual(0.01);
      }
    } finally {
      await reference.close();
    }
  });

  test("CA-5: con i font in ritardo la frase cambia al massimo del 3%", async ({
    page,
  }) => {
    const counter = { delayed: 0 };
    await delayFonts(page, counter);
    await page.goto("/design-system", { waitUntil: "domcontentloaded" });
    const before = await phraseWidths(page, APP_FONT, [16], [400, 600], "none");
    const after = await phraseWidths(page, APP_FONT, [16], [400, 600], "load");
    expect(
      counter.delayed,
      "nessun file dei font è stato richiesto",
    ).toBeGreaterThan(0);
    for (const key of Object.keys(before)) {
      const gap = Math.abs(after[key]! - before[key]!) / after[key]!;
      expect(
        gap,
        `${key}: prima ${before[key]}, dopo ${after[key]}`,
      ).toBeLessThanOrEqual(0.03);
    }
    await page.unrouteAll({ behavior: "ignoreErrors" });
  });
});

test.describe("Figtree su /oggi", () => {
  test.beforeEach(() => {
    test.skip(!usersConfigured("A"), skipReason("A"));
  });

  test("CA-6: /oggi con i font in ritardo sposta il layout al massimo di 0,01", async ({
    page,
    context,
    baseURL,
  }, info) => {
    test.skip(info.project.name !== "mobile", "Criterio a 390×844");
    await signInMarco(context, baseURL);
    await page.addInitScript(() => {
      const holder = window as unknown as {
        __cls: number;
        __shifts: string[];
      };
      holder.__cls = 0;
      holder.__shifts = [];
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & {
            value: number;
            hadRecentInput: boolean;
            sources?: { node: Node | null }[];
          };
          if (shift.hadRecentInput) continue;
          holder.__cls += shift.value;
          // What moved, to read the failure without a trace.
          const moved = (shift.sources ?? []).map((source) => {
            const node = source.node as Element | null;
            return node
              ? `${node.nodeName.toLowerCase()}.${String(node.className).slice(0, 40)}`
              : "?";
          });
          holder.__shifts.push(
            `${shift.value.toFixed(4)} a ${Math.round(shift.startTime)} ms: ${moved.join(", ")}`,
          );
        }
      }).observe({ type: "layout-shift", buffered: true });
    });
    const counter = { delayed: 0 };
    await delayFonts(page, counter);
    const fontArrived = page.waitForResponse((response) =>
      /\.woff2(\?|$)/.test(response.url()),
    );
    await page.goto("/oggi");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await fontArrived;
    // The window of the criterion ends one second after the fonts are ready.
    const total = await page.evaluate(async () => {
      await document.fonts.ready;
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const holder = window as unknown as {
        __cls: number;
        __shifts: string[];
      };
      return { cls: holder.__cls, shifts: holder.__shifts };
    });
    expect(counter.delayed).toBeGreaterThan(0);
    expect(total.cls, total.shifts.join(" | ")).toBeLessThanOrEqual(0.01);
    await page.unrouteAll({ behavior: "ignoreErrors" });
  });

  test("CA-7 (errore): senza i file dei font /oggi resta usabile e la frase cambia al massimo del 3%", async ({
    browser,
    baseURL,
  }) => {
    const real = await browser.newContext({ baseURL });
    const blocked = await browser.newContext({ baseURL });
    try {
      await signInMarco(real, baseURL);
      const realPage = await real.newPage();
      await realPage.goto("/oggi");
      await expect(realPage.getByRole("heading", { level: 1 })).toBeVisible();
      const wanted = (
        await phraseWidths(realPage, APP_FONT, [16], [400], "load")
      )["16/400"]!;

      await signInMarco(blocked, baseURL);
      const page = await blocked.newPage();
      await page.route(WOFF2, (route) => route.fulfill({ status: 404 }));
      await page.goto("/oggi");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page).toHaveURL(/\/oggi/);
      await expect(page.getByRole("button", { name: "Riprova" })).toHaveCount(
        0,
      );
      const got = (await phraseWidths(page, APP_FONT, [16], [400], "ready"))[
        "16/400"
      ]!;
      expect(Math.abs(got - wanted) / wanted).toBeLessThanOrEqual(0.03);
      await page.unrouteAll({ behavior: "ignoreErrors" });
    } finally {
      await real.close();
      await blocked.close();
    }
  });

  test("CA-8 (privacy): nessuna richiesta a fonts.googleapis.com o fonts.gstatic.com", async ({
    page,
    context,
    browser,
    baseURL,
  }) => {
    const hosts: string[] = [];
    const record = (target: Page) =>
      target.on("request", (request) =>
        hosts.push(new URL(request.url()).host),
      );

    // /accesso without a session, in a clean context.
    const anonymous = await browser.newContext({ baseURL });
    try {
      const anonymousPage = await anonymous.newPage();
      record(anonymousPage);
      await anonymousPage.goto("/accesso");
      await expect(
        anonymousPage.getByRole("heading", { level: 1 }),
      ).toBeVisible();
    } finally {
      await anonymous.close();
    }

    await signInMarco(context, baseURL);
    record(page);
    for (const path of ["/oggi", "/nest", "/design-system"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
    }
    expect(hosts.length).toBeGreaterThan(0);
    expect(
      hosts.filter((host) => /fonts\.g(oogleapis|static)\.com$/.test(host)),
    ).toEqual([]);
  });

  test("CA-25: a 390 px nessuna pagina scorre di lato", async ({
    page,
    context,
    baseURL,
  }, info) => {
    test.skip(info.project.name !== "mobile", "Criterio a 390 px");
    await signInMarco(context, baseURL);
    for (const path of [
      "/oggi",
      "/calendario",
      "/casa",
      "/nest",
      "/impostazioni",
      "/esplora",
    ]) {
      await page.goto(path);
      await expect(
        page.getByRole("heading", { level: 1 }).first(),
        path,
      ).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      const width = await page.evaluate(
        () => document.documentElement.scrollWidth,
      );
      expect(width, `${path}: scrollWidth`).toBeLessThanOrEqual(390);
    }
  });
});
