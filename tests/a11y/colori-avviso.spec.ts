import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// PR #91: ten member colours (#74) and Alert with a custom icon (#80), seen in
// the /design-system gallery. Runs on both projects (mobile, desktop).

test.use({ reducedMotion: "reduce" });

const COLOR_NAMES = [
  "Pomodoro",
  "Glicine",
  "Salvia",
  "Cobalto",
  "Zafferano",
  "Lampone",
  "Ceruleo",
  "Peonia",
  "Basilico",
  "Cannella",
];

function luminance(rgb: number[]) {
  const [r = 0, g = 0, b = 0] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a: number[], b: number[]) {
  const hi = Math.max(luminance(a), luminance(b));
  const lo = Math.min(luminance(a), luminance(b));
  return (hi + 0.05) / (lo + 0.05);
}

async function serious(page: Page, include: string) {
  const results = await new AxeBuilder({ page }).include(include).analyze();
  return results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
}

test.beforeEach(async ({ page }) => {
  await page.goto("/design-system");
  await page.evaluate(() => document.fonts.ready);
});

test("a11y: axe sui tre esempi nuovi, senza violazioni", async ({ page }) => {
  for (const id of [
    "avatar-dieci-colori",
    "scelta-colore-dieci",
    "avviso-icona-personalizzata",
  ]) {
    expect(await serious(page, `[data-testid="${id}"]`), id).toEqual([]);
  }
});

test("a11y: avatar dei 10 colori con nome accessibile e iniziale a 4,5:1", async ({
  page,
}) => {
  const avatars = page.getByTestId("avatar-dieci-colori").getByRole("img");
  await expect(avatars).toHaveCount(10);
  for (const [index, name] of COLOR_NAMES.entries()) {
    await expect(avatars.nth(index)).toHaveAttribute("aria-label", name);
  }
  const pairs = await avatars.evaluateAll((nodes) =>
    nodes.map((node) => {
      const style = getComputedStyle(node);
      const parse = (value: string) =>
        (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
      return {
        fg: parse(style.color),
        bg: parse(style.backgroundColor),
      };
    }),
  );
  for (const [index, pair] of pairs.entries()) {
    expect(
      ratio(pair.fg, pair.bg),
      `contrasto dell'iniziale di ${COLOR_NAMES[index]}`,
    ).toBeGreaterThanOrEqual(4.5);
  }
});

test("a11y: scelta del colore è un radiogroup con nomi e stati", async ({
  page,
}) => {
  const group = page.getByRole("radiogroup", { name: "Il tuo colore" });
  await expect(group).toBeVisible();
  const radios = group.getByRole("radio");
  await expect(radios).toHaveCount(10);
  const names = await radios.evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("aria-label")),
  );
  expect(names).toEqual([
    "Pomodoro",
    "Glicine (già usato)",
    "Salvia (già usato)",
    "Cobalto",
    "Zafferano",
    "Lampone",
    "Ceruleo",
    "Peonia",
    "Basilico",
    "Cannella",
  ]);
  await expect(radios.first()).toHaveAttribute("aria-checked", "true");
  await expect(radios.nth(1)).toBeDisabled();
  await expect(radios.nth(2)).toBeDisabled();
  await expect(radios.nth(5)).toHaveAttribute("aria-checked", "false");
});

test("a11y: scelta del colore, focus visibile e area di tocco di 44 px", async ({
  page,
}) => {
  const radios = page
    .getByRole("radiogroup", { name: "Il tuo colore" })
    .getByRole("radio");
  await radios.nth(5).focus();
  await expect(radios.nth(5)).toBeFocused();
  const outline = await radios
    .nth(5)
    .evaluate((node) => getComputedStyle(node).outlineStyle);
  expect(outline).not.toBe("none");

  // Touch area: a point 21 px from the centre in every direction still hits
  // the same colour (the transparent ::before), and neighbours do not overlap.
  const box = await radios.nth(5).boundingBox();
  expect(box).not.toBeNull();
  const cx = box!.x + box!.width / 2;
  const cy = box!.y + box!.height / 2;
  for (const { dx, dy } of [
    { dx: 21, dy: 0 },
    { dx: -21, dy: 0 },
    { dx: 0, dy: 21 },
    { dx: 0, dy: -21 },
  ]) {
    const hit = await page.evaluate(
      ({ x, y }) =>
        document.elementFromPoint(x, y)?.getAttribute("aria-label") ?? null,
      { x: cx + dx, y: cy + dy },
    );
    expect(hit, `punto a ${dx},${dy}`).toBe("Lampone");
  }
});

test("a11y: avviso con wifi-off è uno stato con icona decorativa", async ({
  page,
}) => {
  const alert = page.getByTestId("avviso-icona-personalizzata");
  await expect(alert).toHaveAttribute("role", "status");
  await expect(alert).toContainText("Sei offline.");
  const icon = alert.locator("svg").first();
  await expect(icon).toHaveAttribute("aria-hidden", "true");
  await expect(icon.locator("use")).toHaveAttribute("href", "#i-wifi-off");
});

test("a11y: tastiera, i colori liberi si raggiungono con Tab e nessuna trappola", async ({
  page,
}) => {
  const radios = page
    .getByRole("radiogroup", { name: "Il tuo colore" })
    .getByRole("radio");
  await radios.first().focus();
  await page.keyboard.press("Tab");
  // Next focus is not a disabled colour and focus moves on (no trap).
  const label = await page.evaluate(() =>
    document.activeElement?.getAttribute("aria-label"),
  );
  expect(["Glicine (già usato)", "Salvia (già usato)"]).not.toContain(label);
  await page.keyboard.press("Shift+Tab");
  await expect(radios.first()).toBeFocused();
});
