import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { oggiNow, installOggiFake } from "../fixtures/oggi-visuale";
import { hasTestUser } from "../fixtures/visual-login";
import { signInAsCached } from "../fixtures/visual-login-cached";

// Temporary (#30): computed text styles of the app and of the mockup, to find
// why bold text looks wider in the app. Removed right after.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

const _UNUSED = [
  ".riga-lista__titolo",
  ".sezione__titolo",
  ".riga-evento__titolo",
  ".prossimo__titolo",
  ".riga-lista__info",
  ".riga-gia-fatti",
];

async function probe(page: Page) {
  return page.evaluate(() => {
    const out: Record<string, unknown> = {};
    const span = document.createElement("span");
    span.style.cssText =
      "position:absolute;visibility:hidden;white-space:nowrap;font-size:15px;font-family:'Host Grotesk'";
    span.textContent = "Chiamare il commercialista";
    document.body.appendChild(span);
    for (const w of [400, 500, 600, 650, 700]) {
      span.style.fontWeight = String(w);
      out[`w${w}`] = span.getBoundingClientRect().width;
    }
    span.remove();
    const rules: string[] = [];
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        for (const rule of Array.from(sheet.cssRules)) {
          if (rule.constructor.name === "CSSFontFaceRule") {
            rules.push(rule.cssText.replace(/\s+/g, " ").slice(0, 260));
          }
        }
      } catch {
        rules.push("blocked sheet");
      }
    }
    out.rules = rules;
    return out;
  });
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
  await expect(
    page.getByText("Call con Acme").locator("visible=true").first(),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const info = await probe(page);
  expect(JSON.stringify(info, null, 1)).toBe("APP");
});
