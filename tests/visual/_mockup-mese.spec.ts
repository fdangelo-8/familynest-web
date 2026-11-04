import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import {
  MONTH_EVENTS,
  openMonth,
  waitForMonth,
} from "./calendario-mese-helpers";
import {
  throwawayConfigured,
  throwawaySkipReason,
  withNest,
} from "./calendario-settimana-helpers";

// TEMPORARY (visual tester, #27): measures the text of the rows of the day
// list in the mockup and in the page, to find why the texts of the page look
// wider. Removed after the comparison.
test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

async function measure(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  return page.evaluate(() => {
    const out: Record<string, unknown> = {};
    const probe = (sel: string) => {
      const el = Array.from(document.querySelectorAll(sel)).find((e) =>
        /Piscina|Nuoto/.test(e.textContent ?? ""),
      ) as HTMLElement | undefined;
      if (!el) return "none";
      const s = getComputedStyle(el);
      const range = document.createRange();
      range.selectNodeContents(el);
      return {
        text: el.textContent,
        w: Math.round(range.getBoundingClientRect().width * 10) / 10,
        family: s.fontFamily.slice(0, 80),
        size: s.fontSize,
        weight: s.fontWeight,
        stretch: s.fontStretch,
        ls: s.letterSpacing,
        variation: s.fontVariationSettings,
        opt: s.fontOpticalSizing,
        smoothing: s.getPropertyValue("-webkit-font-smoothing"),
      };
    };
    out.titolo = probe(".riga-evento__titolo");
    out.info = probe(".riga-evento__info");
    out.fonts = Array.from(document.fonts).map(
      (f) => `${f.family} ${f.weight} ${f.status}`,
    );
    out.checkHost = document.fonts.check('600 14px "Host Grotesk"');
    return out;
  });
}

test("misure: mockup", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await page.goto(
    `file://${path.resolve("docs/mockup/14-calendario-mese.html")}`,
  );
  const normal = page.locator('[data-stato="normale"] .frame-desktop');
  await normal.waitFor();
  expect(JSON.stringify(await measure(page), null, 1)).toBe("");
});

test("misure: pagina", async ({ page, baseURL }, info) => {
  test.skip(info.project.name !== "desktop");
  test.skip(!throwawayConfigured(), throwawaySkipReason);
  test.setTimeout(180_000);
  await withNest(MONTH_EVENTS, async (nest) => {
    await openMonth(page, baseURL, nest, { lens: "nest" });
    await waitForMonth(page);
    expect(JSON.stringify(await measure(page), null, 1)).toBe("");
  });
});
