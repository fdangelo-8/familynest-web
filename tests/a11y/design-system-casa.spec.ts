import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// #63 / PR #71: shared Casa components in the gallery (tondo-spunta,
// SectionSwitcher, QuickAddField, Toast with lead and icon, strappo).

test.use({ reducedMotion: "reduce" });

async function seriousViolations(page: import("@playwright/test").Page) {
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
}

test("a11y: galleria con i componenti di Casa, senza violazioni", async ({
  page,
}) => {
  await page.goto("/design-system");
  expect(await seriousViolations(page)).toEqual([]);
  await expect(page.locator("h1")).toHaveCount(1);
});

test("a11y: toast con grassetto all'inizio visibile", async ({ page }) => {
  await page.goto("/design-system");
  await page.getByTestId("toast-mostra-inizio").click();
  await expect(
    page.getByRole("status").filter({ hasText: "3 cose" }),
  ).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
});

test("a11y: toast senza icona visibile", async ({ page }) => {
  await page.goto("/design-system");
  await page.getByTestId("toast-mostra-senza-icona").click();
  await expect(
    page.getByRole("status").filter({ hasText: "Latte" }),
  ).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
});

test("a11y: selettore con voci-link, ordine del focus e anello visibile", async ({
  page,
}) => {
  await page.goto("/design-system");
  const group = page.getByTestId("selettore-link");
  await group.getByRole("button", { name: "Spesa 4" }).focus();
  await page.keyboard.press("Tab");
  const link1 = group.getByRole("link", { name: "Da fare" });
  await expect(link1).toBeFocused();
  const outline = await link1.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { style: cs.outlineStyle, width: parseFloat(cs.outlineWidth) };
  });
  expect(outline.style).not.toBe("none");
  expect(outline.width).toBeGreaterThan(0);
  await page.keyboard.press("Tab");
  await expect(group.getByRole("link", { name: "Scadenze 99+" })).toBeFocused();
});

test("a11y: contrasto del conteggio del selettore almeno 4.5:1", async ({
  page,
}) => {
  await page.goto("/design-system");
  const count = page
    .getByTestId("selettore-link")
    .getByRole("link", { name: "Scadenze 99+" })
    .locator(".selettore__conteggio");
  const ratio = await count.evaluate((el) => {
    const lum = (rgb: string) => {
      const [r, g, b] = (rgb.match(/[\d.]+/g) ?? []).slice(0, 3).map((v) => {
        const c = Number(v) / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const cs = getComputedStyle(el);
    let bgEl: Element | null = el;
    let bg = "rgba(0, 0, 0, 0)";
    while (bgEl) {
      bg = getComputedStyle(bgEl).backgroundColor;
      if (!bg.startsWith("rgba(0, 0, 0, 0")) break;
      bgEl = bgEl.parentElement;
    }
    const a = lum(cs.color);
    const b = lum(bg);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });
  expect(ratio).toBeGreaterThanOrEqual(4.5);
});

test("a11y: aree di tocco di almeno 44 px (tondo, voci del selettore)", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "area di tocco: mobile");
  await page.goto("/design-system");
  const targets = [
    page.getByTestId("tondo-vuoto"),
    page.getByTestId("tondo-riga-1"),
    page.getByTestId("selettore-link").getByRole("button", { name: "Spesa 4" }),
    page.getByRole("link", { name: "Da fare" }),
    page.getByRole("link", { name: "Scadenze 99+" }),
  ];
  for (const t of targets) {
    const box = await t.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const b = getComputedStyle(el, "::before");
      return {
        w: Math.max(r.width, parseFloat(b.width) || 0),
        h: Math.max(r.height, parseFloat(b.height) || 0),
      };
    });
    expect(box.w).toBeGreaterThanOrEqual(44);
    expect(box.h).toBeGreaterThanOrEqual(44);
  }
});

test("a11y: campo rapido e tondo con tastiera", async ({ page }) => {
  await page.goto("/design-system");
  const field = page
    .getByTestId("campo-rapido-normale")
    .getByRole("textbox", { name: "Aggiungi alla spesa…" });
  await field.focus();
  await expect(field).toBeFocused();
  const tondo = page.getByTestId("tondo-vuoto");
  await tondo.focus();
  await page.keyboard.press("Space");
  await expect(tondo).toHaveAttribute("aria-checked", "true");
});
