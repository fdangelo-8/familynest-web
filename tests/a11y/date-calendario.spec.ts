import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { mountHarness } from "../fixtures/calendar-states-harness";
import { hasTestUser, signInAs } from "../fixtures/visual-login";

// Accessibility of dates and calendar (#88, PR #100): the "In arrivo" pages of
// /calendario/giorno, /calendario/mese and /impegni/<id>, and the CSS states
// for #25 and #30 (rows, cards, day strip, time blocks, steps) shown on the
// test page of tests/fixtures/calendar-states-harness.ts: axe in every state
// (resting, hover and pressed), focus order and ring, touch areas.
// At 390 and 1280 px (projects). The placeholders need test user A.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

const BLOCKING = ["serious", "critical"];

async function blocking(page: Page, include?: string, rules?: string[]) {
  let builder = new AxeBuilder({ page });
  if (include) builder = builder.include(include);
  if (rules) builder = builder.withRules(rules);
  const results = await builder.analyze();
  return results.violations
    .filter((v) => BLOCKING.includes(v.impact ?? ""))
    .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target.join(" ")) }));
}

async function ringVisible(page: Page) {
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

// A 44 x 44 px box centred on every line of the control must hit the control
// (its own ::before counts: elementFromPoint returns the control itself). A
// link broken over two lines has two boxes: the 44 px area of its ::before is
// centred on the whole link, not on each line.
async function touchAreaIs44(page: Page, target: Locator) {
  const handle = await target.elementHandle();
  return page.evaluate((el) => {
    const hitsLink = (x: number, y: number) => {
      const hit = document.elementFromPoint(x, y);
      return Boolean(hit && (hit === el || el!.contains(hit)));
    };
    return Array.from(el!.getClientRects()).map((r) => {
      const cx = r.x + r.width / 2;
      const cy = r.y + r.height / 2;
      return {
        lineWidth: Math.round(r.width),
        ok: [
          [cx, cy],
          [cx - 21, cy - 21],
          [cx + 21, cy - 21],
          [cx - 21, cy + 21],
          [cx + 21, cy + 21],
        ].every(([x, y]) => hitsLink(x as number, y as number)),
      };
    });
  }, handle);
}

// ---------------------------------------------------------------------------
// "In arrivo" pages.

const PAGES = [
  { route: "/calendario/giorno", h1: "Calendario", lens: true },
  { route: "/calendario/mese", h1: "Calendario", lens: true },
  {
    route: "/impegni/6f1b7c0e-3c1d-4f6a-9d1e-2b7a5c8d9e10",
    h1: "Impegno",
    lens: false,
  },
];

test.describe("segnaposto «In arrivo»", () => {
  test.use({ reducedMotion: "reduce" });
  test.setTimeout(60_000);

  test.beforeEach(async ({ context, baseURL }) => {
    test.skip(!hasTestUser("A"), "TEST_USER_A_* non impostati");
    const signedIn = await signInAs(context, baseURL!, "A");
    test.skip(!signedIn, "utente di test A non ancora creato");
  });

  for (const p of PAGES) {
    test(`${p.route.replace(/[0-9a-f-]{36}/, "<id>")}: axe, un solo h1, voce attiva, tastiera, aree di tocco`, async ({
      page,
    }, testInfo) => {
      await page.goto(p.route);
      await expect(
        page.getByRole("heading", { level: 1, name: p.h1 }),
      ).toBeVisible();
      await expect(page.locator("h1:visible")).toHaveCount(1);
      expect(await blocking(page)).toEqual([]);

      // The "Calendario" entry of the navigation is the current one.
      const mobile = testInfo.project.name === "mobile";
      const nav = page.getByRole("navigation", {
        name: "Navigazione principale",
      });
      const calendario = nav
        .filter({ visible: true })
        .getByRole("link", { name: "Calendario" });
      await expect(calendario).toHaveAttribute("aria-current", /page|true/);

      // The lens is there on the day and month pages, not on the detail.
      const lens = page.getByRole("group", {
        name: "Punto di vista: solo tu o tutto il Nest",
      });
      if (p.lens) await expect(lens.first()).toBeVisible();
      else await expect(lens).toHaveCount(0);

      // Keyboard: every stop shows a ring, no trap, and the main content has
      // a skip link target.
      await page.keyboard.press("Tab");
      const first = await page.evaluate(
        () => document.activeElement?.textContent?.trim() ?? "",
      );
      expect(first).toBe("Vai al contenuto");
      const seen = new Set<string>();
      let reachedBack = false;
      for (let i = 0; i < 25; i += 1) {
        const stop = await page.evaluate(() => {
          const el = document.activeElement;
          return el && el !== document.body
            ? `${el.tagName}|${el.getAttribute("aria-label") ?? el.textContent?.trim().slice(0, 30)}|${el.getAttribute("href")}`
            : "";
        });
        if (!stop || seen.has(stop)) break;
        seen.add(stop);
        expect(await ringVisible(page), `focus su ${stop}`).toBe(true);
        if (stop.includes("Torna a Oggi")) reachedBack = true;
        await page.keyboard.press("Tab");
      }
      expect(reachedBack, "«Torna a Oggi» raggiungibile da tastiera").toBe(
        true,
      );

      // Touch area of "Torna a Oggi" (not "in line": it has its own row).
      if (mobile) {
        const back = page.getByRole("link", { name: "Torna a Oggi" });
        // One line, one box: all the boxes must have the 44 px area.
        const lines = await touchAreaIs44(page, back);
        expect(
          lines,
          "«Torna a Oggi» a capo su due righe: l'area di 44 px non copre ogni riga",
        ).toEqual(
          lines.map(() => ({ lineWidth: expect.any(Number), ok: true })),
        );
        for (const name of ["Oggi", "Calendario", "Casa", "Aggiungi"]) {
          const link = nav
            .filter({ visible: true })
            .getByRole("link", { name, exact: true });
          const box = await link.boundingBox();
          expect(box!.height, `altezza di ${name}`).toBeGreaterThanOrEqual(44);
        }
      }
    });
  }
});

// ---------------------------------------------------------------------------
// States on the test page.

async function openHarness(page: Page) {
  await page.goto("/termini");
  await page.waitForLoadState("networkidle");
  await mountHarness(page);
  await page.mouse.move(0, 0);
}

const INTERACTIVE = [
  "#riga",
  "#riga-insieme",
  "#gia-fatti",
  "#gia-fatti-aperto",
  "#prossimo",
  "#contatore",
  "#spazio",
  "#spazio-tratteggiato",
  "#giorno-scelto",
  "#giorno",
  "#blocco",
  "#blocco-pulsante",
  "#passo",
];

test.describe("stati CSS di righe, schede, striscia, blocchi e passi", () => {
  test.use({ reducedMotion: "reduce" });

  test("axe a riposo", async ({ page }) => {
    await openHarness(page);
    // The day buttons carry the mockup's aria-label ("Lunedì 19 ottobre, 4
    // impegni") on the visible "Lun" + "19": axe flags the label that does not
    // contain the visible text (2.5.3). It is the markup #25 will write, not
    // this PR's CSS: reported on the PR, left out here.
    const found = await blocking(page);
    expect(found.filter((v) => v.id !== "label-content-name-mismatch")).toEqual(
      [],
    );
  });

  test("contrasto con il mouse sopra e premuto, in ogni elemento", async ({
    page,
  }) => {
    test.setTimeout(600_000);
    await openHarness(page);
    for (const selector of INTERACTIVE) {
      await page.locator(selector).scrollIntoViewIfNeeded();
      await page.locator(selector).hover();
      expect(
        await blocking(page, selector, ["color-contrast"]),
        `${selector} con il mouse sopra`,
      ).toEqual([]);
      await page.mouse.down();
      expect(
        await blocking(page, selector, ["color-contrast"]),
        `${selector} premuto`,
      ).toEqual([]);
      await page.mouse.up();
    }
  });

  test("tastiera: ordine del fuoco, anello sempre visibile, nessuna trappola", async ({
    page,
  }) => {
    await openHarness(page);
    const order: string[] = [];
    for (let i = 0; i < 30; i += 1) {
      await page.keyboard.press("Tab");
      const stop = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return "";
        return el.id || el.getAttribute("aria-label") || el.textContent || "";
      });
      if (!stop) break;
      if (order.includes(stop)) break;
      order.push(stop);
      expect(await ringVisible(page), `anello su ${stop}`).toBe(true);
    }
    // DOM order; "Occupato" and "Liberi insieme" blocks and the "Occupato" row
    // are not controls and are never reached.
    const wanted = INTERACTIVE.map((s) => s.slice(1));
    expect(order.filter((o) => wanted.includes(o))).toEqual(wanted);
    expect(order).not.toContain("riga-occupato");
    expect(order).not.toContain("blocco-occupato");
    expect(order).not.toContain("blocco-insieme");
  });

  test("aree di tocco: giorni della striscia, «Già fatti» e passi almeno 44 px", async ({
    page,
  }, testInfo) => {
    await openHarness(page);
    for (const sel of [
      "#giorno",
      "#giorno-scelto",
      "#gia-fatti",
      "#passo",
      "#riga",
      "#spazio",
    ]) {
      const box = await page.locator(sel).boundingBox();
      expect(box!.height, `${sel} altezza`).toBeGreaterThanOrEqual(44);
      expect(box!.width, `${sel} larghezza`).toBeGreaterThanOrEqual(44);
    }
    expect(testInfo.project.name).toMatch(/mobile|desktop/);
  });

  test("il blocco non cliccabile non prende il fuoco e non cambia aspetto", async ({
    page,
  }) => {
    await openHarness(page);
    for (const sel of [
      "#blocco-occupato",
      "#blocco-insieme",
      "#riga-occupato",
    ]) {
      expect(await page.locator(sel).getAttribute("tabindex")).toBeNull();
      expect(await page.locator(sel).evaluate((el) => el.tagName)).toBe("DIV");
    }
  });
});
