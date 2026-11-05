import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

// TEMPORARY (PR #245, #31): not a test of the app. It draws the markup of the
// approved mockup (docs/mockup/21-profilo-figlio.html) inside a page of the
// app, so it is painted with the same CSS and the same fonts and in the same
// browser as the real page, to compare it by eye. The images are only read from
// the artifact of visual-baseline and the file is deleted afterwards.

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

const html = readFileSync(
  join(process.cwd(), "docs/mockup/21-profilo-figlio.html"),
  "utf8",
);

for (const state of ["normale", "vuoto", "caricamento"]) {
  test(`mockup: ${state}`, async ({ page }, info) => {
    const kind = info.project.name;
    await page.goto("/accesso");
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(
      ({ source, state, kind }) => {
        const doc = new DOMParser().parseFromString(source, "text/html");
        const sprite = doc.querySelector("svg.sprite-icone")?.outerHTML ?? "";
        const frame = doc.querySelector(
          `[data-stato="${state}"] .frame-${kind}`,
        );
        document.body.className = "";
        document.body.innerHTML = sprite + (frame?.innerHTML ?? "");
      },
      { source: html, state, kind },
    );
    await page.evaluate(() => document.fonts.ready);
    await page.mouse.move(0, 0);
    await expect(page).toHaveScreenshot(`mockup-${state}.png`, {
      fullPage: true,
    });
  });
}
