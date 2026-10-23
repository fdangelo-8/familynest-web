import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// #52: measured contrast of the approved design-system corrections.

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

type Rgb = [number, number, number];

function luminance([r, g, b]: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function rgb(color: string): Rgb {
  const m = color.match(/rgba?\(([^)]+)\)/);
  if (!m) throw new Error(`Unexpected color ${color}`);
  const [r = 0, g = 0, b = 0] = (m[1] ?? "").split(/[ ,/]+/).map(Number);
  return [r, g, b];
}

const WHITE: Rgb = [255, 255, 255];
const CARTA: Rgb = [241, 242, 238];

async function resting(page: Page, selector: string) {
  return page
    .locator(selector)
    .first()
    .evaluate((el) => {
      const s = getComputedStyle(el);
      return { shadow: s.boxShadow, bg: s.backgroundColor };
    });
}

test("il bordo dei campi a riposo ha contrasto >= 3:1 su bianco e carta", async ({
  page,
}) => {
  await page.goto("/design-system");
  const field = await resting(page, "#campo .campo__input");
  expect(field.shadow).toMatch(/inset/);
  const border = rgb(field.shadow);
  expect(border).toEqual([130, 133, 139]);
  const onWhite = contrast(border, WHITE);
  const onCarta = contrast(border, CARTA);
  expect(onWhite).toBeGreaterThanOrEqual(3);
  expect(onCarta).toBeGreaterThanOrEqual(3);
  test.info().annotations.push({
    type: "contrasto",
    description: `bordo campo: ${onWhite.toFixed(2)}:1 su bianco, ${onCarta.toFixed(2)}:1 su carta`,
  });
});

test("giorno fuori mese: grigio leggibile >= 4,5:1", async ({ page }) => {
  await page.goto("/design-system");
  const color = await page.evaluate(() => {
    const cell = document.createElement("div");
    cell.className = "griglia-mese__cella griglia-mese__cella--fuori";
    const num = document.createElement("span");
    num.className = "griglia-mese__numero";
    num.textContent = "28";
    cell.appendChild(num);
    document.body.appendChild(cell);
    return getComputedStyle(num).color;
  });
  const c = rgb(color);
  expect(c).toEqual([90, 93, 100]);
  expect(contrast(c, CARTA)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(c, WHITE)).toBeGreaterThanOrEqual(4.5);
});

test("bottone rosso pieno al passaggio: bianco su rosso scuro >= 4,5:1", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop",
    "il passaggio del mouse esiste solo con un puntatore",
  );
  await page.goto("/design-system");
  const btn = page.getByTestId("btn-pericolo-pieno-predefinito");
  await btn.hover();
  const bg = rgb(
    await btn.evaluate((el) => getComputedStyle(el).backgroundColor),
  );
  expect(bg).toEqual([168, 42, 39]);
  expect(contrast(WHITE, bg)).toBeGreaterThanOrEqual(4.5);
});

test("axe senza violazioni serious/critical su /accesso/mail con campo a riposo", async ({
  page,
}) => {
  await page.goto("/accesso/mail");
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
});
