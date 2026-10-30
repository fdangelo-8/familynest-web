import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { hasTestUser, signInAs } from "../fixtures/visual-login";

// Accessibility of the layout (#10, CA-33): axe on every state at 390 and
// 1280 px (the two projects), one visible h1, visible focus, focus order.

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
    "/accesso/mail",
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

test.describe("pagine dell'app (utente A)", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    test.skip(!hasTestUser("A"), "TEST_USER_A_* non impostati");
    const signedIn = await signInAs(context, baseURL!, "A");
    test.skip(!signedIn, "utente di test A non ancora creato (#55)");
  });

  for (const route of APP_ROUTES) {
    test(`${route}: axe, un solo h1, una sola nav principale`, async ({
      page,
    }, testInfo) => {
      await page.goto(route);
      await expect(page.getByRole("main")).toBeVisible();
      await expect(page.locator("h1:visible")).toHaveCount(1);
      // Desktop: always one. Mobile: one, except on detail pages (no bottom nav).
      const navCount = await page
        .getByRole("navigation", { name: "Navigazione principale" })
        .count();
      if (testInfo.project.name === "desktop") expect(navCount).toBe(1);
      else expect(navCount).toBeLessThanOrEqual(1);
      await expect(page.locator("main")).toHaveCount(1);
      await expectNoBlocking(page);
    });
  }

  test("ordine del focus e anello visibile", async ({ page }, testInfo) => {
    await page.goto("/oggi");
    await expect(page.getByRole("main")).toBeVisible();
    const expected =
      testInfo.project.name === "desktop"
        ? [
            "Vai al contenuto",
            "FamilyNest",
            "Oggi",
            "Calendario",
            "Casa",
            "Aggiungi",
            "Cerca nel Nest",
            "Notifiche",
            "Apri Casa D'Angelo",
          ]
        : ["Vai al contenuto", "Apri Casa D'Angelo", "Io", "Nest", "Notifiche"];
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

  test("aree di tocco della navigazione su mobile", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "solo mobile");
    await page.goto("/oggi");
    const nav = page.getByRole("navigation", {
      name: "Navigazione principale",
    });
    await expect(nav).toBeVisible();
    for (const link of await nav.getByRole("link").all()) {
      const box = await link.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.width).toBeGreaterThanOrEqual(44);
    }
    // Icon buttons and the Nest square are drawn 40 px but touchable at 44 px (#67)
    const touch = await page.evaluate(() =>
      Array.from(
        document.querySelectorAll<HTMLElement>(
          ".barra .btn-icona, .barra .quadrato-nest",
        ),
      ).map((el) => {
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
      }),
    );
    expect(touch.length).toBeGreaterThan(0);
    expect(touch.every(Boolean)).toBe(true);
  });
});
