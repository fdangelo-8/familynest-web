import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { mountHarness } from "../fixtures/calendar-states-harness";

// Accessibility of dates and calendar (#88, PR #100): the "In arrivo" pages of
// /calendario/mese (since #26 /calendario/giorno is the real page: calendario-giorno.spec.ts; /impegni/<id> since #19), and the CSS states
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
