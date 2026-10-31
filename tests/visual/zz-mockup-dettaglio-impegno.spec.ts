import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// TEMPORARY (tester visivo, PR #174): screenshots of the frames of the mockup
// 11-dettaglio-impegno.html, with the fonts of the app, to look at them next to
// the app. Not a test of the app; not committed to the final branch.

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

const STATES = [
  "normale",
  "modale-aperta",
  "conferma",
  "caricamento",
  "errore",
];

test("mockup frames", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "one project is enough");
  await page.setViewportSize({ width: 1400, height: 1000 });

  // The font faces of the app (next/font), renamed as the mockup names them.
  await page.goto("/login");
  const faces = await page.evaluate(() => {
    const out: string[] = [];
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList;
      try {
        rules = sheet.cssRules;
      } catch {
        continue;
      }
      for (const rule of Array.from(rules)) {
        if (rule instanceof CSSFontFaceRule) out.push(rule.cssText);
      }
    }
    return out;
  });
  const fontCss = faces
    .filter((css) => !/local\(/.test(css))
    .map((css) =>
      css.replace(
        /font-family:\s*[^;]+;/,
        /Parkinsans/.test(css)
          ? 'font-family: "Parkinsans";'
          : 'font-family: "Host Grotesk";',
      ),
    )
    .join("\n");
  console.log(`MOCKUP-FONTS ${faces.length} rules, ${fontCss.length} chars`);

  const read = (name: string) => readFileSync(`docs/mockup/${name}`, "utf8");
  const html = read("11-dettaglio-impegno.html")
    .replace(/<link[^>]*fonts\.(googleapis|gstatic)[^>]*>/g, "")
    .replace(
      '<link rel="stylesheet" href="tokens.css">',
      `<style>${read("tokens.css")}</style>`,
    )
    .replace(
      '<link rel="stylesheet" href="components.css">',
      `<style>${fontCss}\n${read("components.css")}</style>`,
    );
  await page.route("**/__mockup.html", (route) =>
    route.fulfill({ contentType: "text/html", body: html }),
  );
  await page.goto("/__mockup.html");
  await page.evaluate(async () => {
    await document.fonts.load('300 20px "Parkinsans"');
    await document.fonts.load('400 20px "Parkinsans"');
    await document.fonts.load('400 15px "Host Grotesk"');
    await document.fonts.load('600 15px "Host Grotesk"');
    await document.fonts.load('650 15px "Host Grotesk"');
    await document.fonts.ready;
  });

  for (const state of STATES) {
    for (const [kind, size] of [
      ["mobile", "frame-mobile"],
      ["desktop", "frame-desktop"],
    ] as const) {
      const frame = page.locator(`section[data-stato="${state}"] .${size}`);
      await expect(frame).toBeVisible();
      await page.mouse.move(0, 0);
      await expect(frame).toHaveScreenshot(`mockup-${state}-${kind}.png`);
    }
  }
});
