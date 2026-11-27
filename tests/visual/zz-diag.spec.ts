import { test } from "@playwright/test";

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

test("DIAG tiles", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-20T15:00:00+02:00"));
  await page.goto("/design-system");
  await page.evaluate(() => document.fonts.ready);
  const snap = () =>
    page.evaluate(() => {
      const out: Record<string, string> = {};
      document
        .querySelectorAll('[data-testid="ds-tessere-nest"] .tessera')
        .forEach((t, i) => {
          const r = t.getBoundingClientRect();
          const l = t.querySelector(".tessera__riga");
          const lr = l?.getBoundingClientRect();
          out["tile" + i] =
            `${Math.round(r.width)}x${Math.round(r.height)} line ${Math.round(lr?.width ?? 0)}x${Math.round(lr?.height ?? 0)}`;
        });
      out.fonts = [...document.fonts]
        .map((f) => `${f.family}:${f.status}`)
        .join(",");
      out.lineHeightVar = getComputedStyle(
        document.querySelector(".tessera__riga")!,
      ).lineHeight;
      out.font = getComputedStyle(
        document.querySelector(".tessera__riga")!,
      ).fontFamily.slice(0, 40);
      return out;
    });
  const before = await snap();
  console.log("DIAG before", JSON.stringify(before));
  await page.screenshot({ fullPage: true, animations: "disabled" });
  const after = await snap();
  console.log("DIAG after", JSON.stringify(after));
});
