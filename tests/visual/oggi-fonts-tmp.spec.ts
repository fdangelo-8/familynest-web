import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { oggiNow, installOggiFake } from "../fixtures/oggi-visuale";
import { hasTestUser } from "../fixtures/visual-login";
import { signInAsCached } from "../fixtures/visual-login-cached";

// Temporary (#30): computed text styles of the app and of the mockup, to find
// why bold text looks wider in the app. Removed right after.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

const SELECTORS = [
  ".riga-lista__titolo",
  ".sezione__titolo",
  ".riga-evento__titolo",
  ".prossimo__titolo",
  ".riga-lista__info",
  ".riga-gia-fatti",
];

async function probe(page: Page) {
  return page.evaluate((selectors) => {
    const out: Record<string, unknown> = {};
    for (const selector of selectors) {
      const el = Array.from(document.querySelectorAll(selector)).find(
        (e) => (e as HTMLElement).offsetWidth > 0,
      ) as HTMLElement | undefined;
      if (!el) {
        out[selector] = "none";
        continue;
      }
      const s = getComputedStyle(el);
      const range = document.createRange();
      range.selectNodeContents(el);
      out[selector] =
        `${el.textContent?.trim().slice(0, 24)} | ${s.fontFamily.slice(0, 40)} | w${s.fontWeight} | ${s.fontSize} | ls ${s.letterSpacing} | var ${s.fontVariationSettings} | width ${Math.round(range.getBoundingClientRect().width)}`;
    }
    out.fonts = Array.from(document.fonts)
      .map((f) => `${f.family}:${f.weight}:${f.status}`)
      .join(" ; ");
    return out;
  }, SELECTORS);
}

test("fonts: mockup", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "una sola volta");
  await page.goto(`file://${path.resolve("docs/mockup/09-oggi.html")}`);
  await page.evaluate(() => document.fonts.ready);
  const info = await probe(page);
  expect(JSON.stringify(info, null, 1)).toBe("MOCKUP");
});

test("fonts: app", async ({ page, context, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "una sola volta");
  test.skip(!hasTestUser("A"), "TEST_USER_A_* non impostati");
  await signInAsCached(context, baseURL!, "A");
  await page.clock.setFixedTime(oggiNow("normale"));
  await installOggiFake(page, { scenario: "normale" });
  await page.goto("/oggi");
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
  const info = await probe(page);
  expect(JSON.stringify(info, null, 1)).toBe("APP");
});
