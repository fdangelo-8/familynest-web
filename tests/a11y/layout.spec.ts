import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { hasBottomNav } from "../../src/lib/app-routes";
import { hasTestUser, signInAs } from "../fixtures/visual-login";

// Accessibility of the frame (#10, F5 #506): axe on every route at the sizes
// of D8, one visible h1, visible focus, focus order, touch areas of 44 px.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

async function expectNoBlocking(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
}

async function visibleH1Count(page: Page) {
  return page.locator("h1:visible").count();
}

async function focusRingVisible(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return false;
    const s = getComputedStyle(el);
    return (
      (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) ||
      s.boxShadow !== "none"
    );
  });
}

test.describe("pagine pubbliche", () => {
  for (const route of [
    "/accesso",
    "/accesso/link-scaduto",
    "/termini",
    "/privacy",
  ]) {
    test(`${route}: axe, un solo h1, focus visibile`, async ({ page }) => {
      // The stickers fade in on /accesso: axe must not read half-transparent colors.
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(route);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      expect(await visibleH1Count(page)).toBe(1);
      await expectNoBlocking(page);

      // Every focus stop must show a ring; no keyboard trap (Tab always moves on).
      const seen = new Set<string>();
      for (let i = 0; i < 12; i += 1) {
        await page.keyboard.press("Tab");
        const stop = await page.evaluate(() => {
          const el = document.activeElement;
          return el && el !== document.body
            ? `${el.tagName}:${el.textContent?.trim().slice(0, 30)}:${el.getAttribute("href")}`
            : "";
        });
        if (!stop) break;
        if (seen.has(stop)) break;
        seen.add(stop);
        expect(await focusRingVisible(page), `focus su ${stop}`).toBe(true);
      }
    });
  }

  test("un indirizzo inesistente senza accesso porta a /accesso con un solo h1", async ({
    page,
  }) => {
    await page.goto("/casa/pippo");
    await expect(page).toHaveURL(/\/accesso$/);
    await expect(page.locator("h1:visible")).toHaveCount(1);
  });
});

const APP_ROUTES = [
  "/oggi",
  "/aggiungi",
  "/calendario",
  "/casa/spesa",
  "/spazi",
  "/nest",
  "/notifiche",
  "/ricerca",
  "/profilo",
  "/calendari-collegati",
  "/impostazioni",
  "/membri",
  "/pippo",
  "/casa/pippo",
];

/** The sizes of D8 (§12 of the spec) and the shape of the frame at each. */
const SIZES: {
  width: number;
  height: number;
  shape: "telefono" | "icone" | "intera";
}[] = [
  { width: 390, height: 844, shape: "telefono" },
  { width: 768, height: 1024, shape: "telefono" },
  { width: 899, height: 844, shape: "telefono" },
  { width: 900, height: 768, shape: "icone" },
  { width: 1024, height: 768, shape: "icone" },
  { width: 1194, height: 834, shape: "icone" },
  { width: 1280, height: 800, shape: "intera" },
  { width: 1280, height: 560, shape: "telefono" },
  { width: 1440, height: 900, shape: "intera" },
];

/** True when every point 22 px around the centre of the element hits it. */
async function touchAreaOk(page: Page, selector: string) {
  return page.evaluate((query) => {
    return Array.from(document.querySelectorAll<HTMLElement>(query))
      .filter((el) => el.getClientRects().length > 0)
      .map((el) => {
        const r = el.getBoundingClientRect();
        const cx = r.x + r.width / 2;
        const cy = r.y + r.height / 2;
        const hit = (x: number, y: number) =>
          el.contains(document.elementFromPoint(x, y));
        return (
          hit(cx - 21, cy) &&
          hit(cx + 21, cy) &&
          hit(cx, cy - 21) &&
          hit(cx, cy + 21)
        );
      });
  }, selector);
}

test.describe("pagine dell'app (utente A)", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    test.skip(!hasTestUser("A"), "TEST_USER_A_* non impostati");
    const signedIn = await signInAs(context, baseURL!, "A");
    test.skip(!signedIn, "utente di test A non ancora creato (#55)");
  });

  for (const route of APP_ROUTES) {
    test(`${route}: axe, un solo h1 e un solo main, al formato del progetto`, async ({
      page,
    }, testInfo) => {
      await page.goto(route);
      await expect(page.getByRole("main")).toBeVisible();
      await expect(page.locator("h1:visible")).toHaveCount(1);
      await expect(page.locator("main")).toHaveCount(1);
      // Computer: the sidebar is always there. Phone: the bottom bar, where the route has it.
      const expectedNavs =
        testInfo.project.name === "desktop" || hasBottomNav(route) ? 1 : 0;
      await expect(
        page.getByRole("navigation", { name: "Navigazione principale" }),
      ).toHaveCount(expectedNavs);
      await expectNoBlocking(page);
    });
  }

  for (const size of SIZES) {
    test(`${size.width} × ${size.height}: forma «${size.shape}» e aree di tocco`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto("/oggi");
      await expect(page.getByRole("main")).toBeVisible();
      const nav = page.getByRole("navigation", {
        name: "Navigazione principale",
      });
      await expect(nav).toBeVisible();
      const sidebarWidth = await page
        .getByTestId("barra-laterale")
        .evaluate((el) => el.getBoundingClientRect().width);
      if (size.shape === "telefono") {
        expect(sidebarWidth).toBe(0);
        await expect(page.locator(".barra-basso__voce:visible")).toHaveCount(4);
      } else {
        expect(sidebarWidth).toBe(size.shape === "icone" ? 72 : 248);
        await expect(page.locator(".barra-basso__voce:visible")).toHaveCount(0);
      }
      for (const link of await nav.getByRole("link").all()) {
        const box = await link.boundingBox();
        expect(box!.height).toBeGreaterThanOrEqual(44);
        expect(box!.width).toBeGreaterThanOrEqual(44);
      }
      // Icon controls are drawn small but touchable at 44 px (#67, risposta 217)
      const selector =
        size.shape === "telefono"
          ? ".testata .btn-icona, .testata .btn-freccia"
          : ".barra-alto .btn-icona, .barra-alto .campo-cerca-barra, .barra-alto .pulsante-barra, .barra-laterale .voce-barra";
      const touch = await touchAreaOk(page, selector);
      expect(touch.length).toBeGreaterThan(0);
      expect(touch.every(Boolean)).toBe(true);
    });
  }

  test("a 1024 × 768 con il dito i comandi della barra in alto sono alti 44 px", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto("/oggi");
    await expect(page.getByRole("main")).toBeVisible();
    await page.evaluate(() => {
      document.documentElement.dataset.gesto = "tocco";
    });
    for (const selector of [".campo-cerca-barra", ".pulsante-barra"]) {
      const box = await page.locator(selector).first().boundingBox();
      expect(box!.height, selector).toBeGreaterThanOrEqual(44);
    }
  });

  // CA-40 at 1040 px (barra a icone): the pages still draw their phone layout
  // between 900 and 1023 px, here the computer layout starts at 1024.
  for (const route of APP_ROUTES) {
    test(`${route}: a 1040 px axe, un solo h1 e un solo main`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1040, height: 800 });
      await page.goto(route);
      await expect(page.getByRole("main")).toBeVisible();
      await expect(page.locator("h1:visible")).toHaveCount(1);
      await expect(page.locator("main")).toHaveCount(1);
      await expect(
        page.getByRole("navigation", { name: "Navigazione principale" }),
      ).toHaveCount(1);
      await expectNoBlocking(page);
    });
  }

  // Between 900 and 1023 px the h1 of Casa and Notifiche is the title of the bar.
  for (const route of ["/casa/spesa", "/notifiche"]) {
    test(`${route}: a 960 px c'è un solo h1 visibile`, async ({ page }) => {
      await page.setViewportSize({ width: 960, height: 800 });
      await page.goto(route);
      await expect(page.getByRole("main")).toBeVisible();
      await expect(page.locator("h1:visible")).toHaveCount(1);
    });
  }

  test("ordine del focus e anello visibile", async ({ page }, testInfo) => {
    await page.goto("/oggi");
    await expect(page.getByRole("main")).toBeVisible();
    const expected =
      testInfo.project.name === "desktop"
        ? [
            "Vai al contenuto",
            "Io",
            "Nest",
            "Oggi",
            "Calendario",
            "Casa",
            "Spazi",
            "Spesa",
            "Il tuo Nest",
            "Cerca",
            "Notifiche",
            "Nuovo impegno",
          ]
        : ["Vai al contenuto", "Io", "Nest", "Cerca", "Notifiche"];
    for (const name of expected) {
      await page.keyboard.press("Tab");
      const label = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        return (el.getAttribute("aria-label") ?? el.textContent ?? "").trim();
      });
      expect(label).toContain(name);
      expect(await focusRingVisible(page), `focus su ${name}`).toBe(true);
    }
  });
});
