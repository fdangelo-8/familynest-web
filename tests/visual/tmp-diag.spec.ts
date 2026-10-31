import { test } from "@playwright/test";
test.use({ locale: "it-IT", timezoneId: "Europe/Rome", reducedMotion: "reduce" });
test("diag", async ({ page }) => {
  await page.goto("/design-system");
  await page.evaluate(() => document.fonts.ready);
  const snap = () =>
    page.evaluate(() => {
      const out: Record<string, string> = {};
      document.querySelectorAll("body *").forEach((el, i) => {
        const r = el.getBoundingClientRect();
        out[`${i}:${el.tagName}.${(el.getAttribute("class") ?? "").slice(0, 40)}`] =
          `${Math.round(r.width)}x${Math.round(r.height)}@${Math.round(r.top + window.scrollY)}`;
      });
      out["DOC"] = String(document.documentElement.scrollHeight);
      return out;
    });
  const a = await snap();
  await page.screenshot({ fullPage: true });
  const b = await snap();
  await page.screenshot({ fullPage: true });
  const c = await snap();
  for (const [n, x, y] of [["AB", a, b], ["BC", b, c]] as const) {
    const diffs = Object.keys(x).filter((k) => x[k] !== y[k]).slice(0, 12);
    console.log(`DIAG ${n} count=${diffs.length}`);
    for (const k of diffs) console.log(`DIAG ${n} ${k} ${x[k]} -> ${y[k]}`);
  }
});
