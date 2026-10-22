import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("CA-47: nessuno scorrimento orizzontale a 390 px e un solo h1", async ({
  page,
}, testInfo) => {
  await page.goto("/design-system");
  if (testInfo.project.name === "mobile") {
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  }
  await expect(page.locator("h1")).toHaveCount(1);
});

test("CA-47: nessuna violazione con il dialogo di conferma aperto", async ({
  page,
}) => {
  await page.goto("/design-system");
  await page.getByTestId("dialogo-apri").click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    ),
  ).toEqual([]);
});

test("focus da tastiera: ogni controllo raggiunto con Tab ha un anello visibile", async ({
  page,
}) => {
  await page.goto("/design-system");
  const bad: string[] = [];
  const seen = new Set<string>();
  await page.keyboard.press("Tab");
  for (let i = 0; i < 80; i++) {
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const cs = getComputedStyle(el);
      const ring =
        (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0) ||
        cs.boxShadow !== "none";
      const name = (
        el.getAttribute("aria-label") ||
        el.textContent ||
        el.tagName
      )
        .trim()
        .slice(0, 30);
      return { name: `${el.tagName} ${name}`, ring };
    });
    if (info && !info.ring) bad.push(info.name);
    if (info) seen.add(info.name);
    await page.keyboard.press("Tab");
  }
  expect(seen.size).toBeGreaterThan(20);
  expect(bad).toEqual([]);
});

// Touch targets are checked against the sizes drawn in the mockup (issue #43,
// proposal 7 covers raising them): general controls 40 px, segmented-control
// items 32 px tall, round tick 22 px. Controls the design system explicitly
// widens (small icon button, checkbox, switch, chip) must reach 44 px.
test("aree di tocco dei controlli (mobile)", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "solo mobile");
  await page.goto("/design-system");
  const small = await page.evaluate(() => {
    const out: string[] = [];
    const sel =
      "button, a[href], [role=checkbox], [role=switch], input, select, textarea";
    for (const el of document.querySelectorAll<HTMLElement>(sel)) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const before = getComputedStyle(el, "::before");
      const w = Math.max(r.width, parseFloat(before.width) || 0);
      const h = Math.max(r.height, parseFloat(before.height) || 0);
      const inline =
        el.tagName === "A" &&
        [...(el.parentElement?.childNodes ?? [])].some(
          (n) => n.nodeType === 3 && (n.textContent ?? "").trim() !== "",
        );
      if (inline) continue;
      const cl = el.classList;
      let minW = 40;
      let minH = 40;
      if (cl.contains("selettore__voce")) {
        minW = 0;
        minH = 32;
      } else if (cl.contains("tondo-spunta")) {
        minW = 22;
        minH = 22;
      } else if (
        cl.contains("btn-icona--piccolo") ||
        cl.contains("casella") ||
        cl.contains("toggle") ||
        (cl.contains("chip") && !cl.contains("chip--statico"))
      ) {
        minW = 44;
        minH = 44;
      }
      if (w < minW - 0.5 || h < minH - 0.5) {
        const label = el.getAttribute("aria-label") || el.textContent || "";
        out.push(
          `${el.className || el.tagName} ${Math.round(w)}x${Math.round(h)} (min ${minW}x${minH}) "${label.trim().slice(0, 25)}"`,
        );
      }
    }
    return out;
  });
  expect(small).toEqual([]);
});
