import { test } from "@playwright/test";

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

test("DIAG gallery height", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-20T15:00:00+02:00"));
  await page.goto("/design-system");
  await page.evaluate(() => document.fonts.ready);
  const snap = () =>
    page.evaluate(() => {
      const out: Record<string, number> = {
        __h: document.documentElement.scrollHeight,
        __cw: document.documentElement.clientWidth,
        __iw: window.innerWidth,
      };
      document.querySelectorAll("section[id]").forEach((s) => {
        out["sec:" + s.id] = Math.round(s.getBoundingClientRect().height);
      });
      document.querySelectorAll("#scelte-persone figure").forEach((f, i) => {
        out["fig" + i] = Math.round(f.getBoundingClientRect().height);
      });
      return out;
    });
  const before = await snap();
  console.log("DIAG before", JSON.stringify(before));
  const shot1 = await page.screenshot({ fullPage: true, animations: "disabled" });
  console.log("DIAG shot1 height", shot1.readUInt32BE(20));
  const mid = await snap();
  const shot2 = await page.screenshot({ fullPage: true, animations: "disabled" });
  console.log("DIAG shot2 height", shot2.readUInt32BE(20));
  const after = await snap();
  for (const [label, s] of [
    ["mid", mid],
    ["after", after],
  ] as const) {
    const diff = Object.keys(s)
      .filter((k) => s[k] !== before[k])
      .map((k) => `${k}:${before[k]}->${s[k]}`);
    console.log("DIAG", label, "changes vs before:", diff.join(" ") || "none");
  }
});
