import { test } from "@playwright/test";

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

test("DIAG fig16", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-20T15:00:00+02:00"));
  await page.goto("/design-system");
  await page.evaluate(() => document.fonts.ready);
  const snap = () =>
    page.evaluate(() => {
      const out: Record<string, string> = {};
      const fig = document.querySelectorAll("#scelte-persone figure")[16]!;
      fig.querySelectorAll("*").forEach((el, i) => {
        const r = el.getBoundingClientRect();
        out[`${i}:${el.tagName}.${String(el.className).slice(0, 30)}:${(el.textContent ?? "").slice(0, 25)}`] =
          `${Math.round(r.width)}x${Math.round(r.height)}`;
      });
      return out;
    });
  const before = await snap();
  await page.screenshot({ fullPage: true, animations: "disabled" });
  const after = await snap();
  const diff = Object.keys(after).filter((k) => after[k] !== before[k]);
  console.log(
    "DIAG diff",
    JSON.stringify(diff.map((k) => `${k} ${before[k]} -> ${after[k]}`)),
  );
  console.log("DIAG caption", Object.keys(before).filter((k) => /FIGCAPTION/.test(k)).map((k) => `${k} ${before[k]}`).join(" "));
});
