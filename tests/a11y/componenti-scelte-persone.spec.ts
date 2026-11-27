import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// #504 (F4b): choices and people components in the gallery. Runs on mobile
// (390) and desktop (1280): axe on the section and on the whole page, the
// contrast of the initials, and the keyboard of the groups.

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

test.beforeEach(async ({ page }) => {
  await page.goto("/design-system");
  await expect(page.locator("#scelte-persone")).toBeVisible();
});

const serious = (violations: { impact?: string | null }[]) =>
  violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""));

test("CA-32: la sezione non ha violazioni serious o critical", async ({
  page,
}) => {
  const results = await new AxeBuilder({ page })
    .include("#scelte-persone")
    .analyze();
  expect(serious(results.violations)).toEqual([]);
});

test("CA-32: tutta la galleria non ha violazioni serious o critical", async ({
  page,
}) => {
  const results = await new AxeBuilder({ page }).analyze();
  expect(serious(results.violations)).toEqual([]);
});

// The theme is set with data-aspetto on the root, which redefines the tokens
// (`.tema-notte` does not): the pairs are measured in each theme.
for (const aspetto of ["chiaro", "scuro"] as const) {
  test(`CA-27: i rapporti di contrasto di iniziali, pieni e spunte raggiungono il minimo (${aspetto})`, async ({
    page,
  }) => {
    await page.emulateMedia({
      colorScheme: aspetto === "scuro" ? "dark" : "light",
    });
    await page.evaluate((value) => {
      document.documentElement.setAttribute("data-aspetto", value);
    }, aspetto);
    // The theme really changed: the fill of the full controls differs.
    const pieno = await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue("--color-pieno")
        .trim()
        .toLowerCase(),
    );
    expect(pieno).toBe(aspetto === "scuro" ? "#1f7d8a" : "#10262a");
    await checkContrast(page);
  });
}

test("CA-27: i valori al buio sono diversi da quelli chiari", async ({
  page,
}) => {
  const read = async (aspetto: string) => {
    await page.evaluate((value) => {
      document.documentElement.setAttribute("data-aspetto", value);
    }, aspetto);
    return page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      return ["--color-pieno", "--color-superficie", "--color-inchiostro"].map(
        (name) => root.getPropertyValue(name).trim(),
      );
    });
  };
  const light = await read("chiaro");
  const dark = await read("scuro");
  for (let i = 0; i < light.length; i += 1) {
    expect(dark[i]).not.toBe(light[i]);
  }
});

async function checkContrast(page: Page) {
  const failures = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const rgb = (value: string) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = "#000";
      ctx.fillStyle = value;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      return [r!, g!, b!];
    };
    const lum = ([r, g, b]: number[]) => {
      const f = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
    };
    const ratio = (a: string, b: string) => {
      const [x, y] = [lum(rgb(a)), lum(rgb(b))];
      return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
    };
    const out: string[] = [];
    const codes = [
      "pomodoro",
      "glicine",
      "salvia",
      "cobalto",
      "zafferano",
      "lampone",
      "ceruleo",
      "peonia",
      "basilico",
      "cannella",
      "neutro",
    ];
    const root = getComputedStyle(document.documentElement);
    const token = (name: string) => root.getPropertyValue(name).trim();
    for (const code of codes) {
      const probe = document.createElement("span");
      probe.className = `membro-${code}`;
      document.body.appendChild(probe);
      const style = getComputedStyle(probe);
      const c = style.getPropertyValue("--c");
      const initial = style.getPropertyValue("--c-iniziale");
      const soft = style.getPropertyValue("--c-spento");
      probe.remove();
      if (ratio(initial, c) < 4.5) out.push(`${code}: iniziale su --c`);
      if (ratio(token("--color-inchiostro"), soft) < 4.5)
        out.push(`${code}: iniziale su --c-spento`);
    }
    {
      const t = (name: string) => root.getPropertyValue(name).trim();
      const check = (label: string, a: string, b: string, min: number) => {
        if (ratio(t(a), t(b)) < min) out.push(label);
      };
      check("latte su pieno", "--color-latte", "--color-pieno", 4.5);
      check(
        "inchiostro su superficie",
        "--color-inchiostro",
        "--color-superficie",
        4.5,
      );
      check(
        "inchiostro su scelta-tenue",
        "--color-inchiostro",
        "--color-scelta-tenue",
        4.5,
      );
      check(
        "inchiostro su premuto",
        "--color-inchiostro",
        "--color-premuto",
        4.5,
      );
      check(
        "filo-campo su superficie",
        "--color-filo-campo",
        "--color-superficie",
        3,
      );
      check(
        "allerta su allerta-fondo",
        "--color-allerta",
        "--color-allerta-fondo",
        4.5,
      );
      // Ring of the chosen card (ink border) against the surface: non-text, 3:1.
      check(
        "anello inchiostro su superficie",
        "--color-inchiostro",
        "--color-superficie",
        3,
      );
    }
    return out;
  });
  expect(failures).toEqual([]);
}

test("tastiera: le schede sono un solo gruppo con una fermata; Spazio sceglie", async ({
  page,
}) => {
  const group = page.getByTestId("ds-scelte-tessere");
  const radios = group.getByRole("radio");
  await radios.nth(1).focus();
  await page.keyboard.press("ArrowLeft");
  await expect(radios.nth(0)).toBeFocused();
  await expect(radios.nth(0)).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("ArrowUp");
  await expect(radios.nth(3)).toBeFocused();
  await expect(radios.nth(3)).toHaveAttribute("aria-checked", "true");
  await expect(radios.nth(0)).toHaveAttribute("tabindex", "-1");
});

test("tastiera: i pallini di «Per chi» e le pastiglie cambiano con Spazio e Invio", async ({
  page,
}) => {
  const group = page.getByTestId("ds-per-chi");
  const sofia = group.getByRole("button", { name: "Sofia", exact: true });
  await sofia.focus();
  await page.keyboard.press("Space");
  await expect(sofia).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Enter");
  await expect(sofia).toHaveAttribute("aria-pressed", "false");
  const chip = page
    .getByTestId("ds-pastiglie")
    .getByRole("button", { name: "Altro" });
  await chip.focus();
  await page.keyboard.press("Enter");
  await expect(chip).toHaveAttribute("aria-pressed", "true");
});

test("fuoco: i controlli nuovi mostrano l'anello da tastiera", async ({
  page,
}) => {
  const controls = [
    // The only tab stop of the group is the chosen card.
    page.getByTestId("ds-scelte-schede").locator('[aria-checked="true"]'),
    page.getByTestId("ds-per-chi").getByRole("button").first(),
    page.getByTestId("ds-giorni").getByRole("button").first(),
    page.getByTestId("ds-volti").getByRole("button").first(),
    page.getByTestId("ds-tessere-spazi").getByRole("link").first(),
  ];
  for (const control of controls) {
    await control.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    const outline = await control.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { style: cs.outlineStyle, width: parseFloat(cs.outlineWidth) };
    });
    expect(outline.style).not.toBe("none");
    expect(outline.width).toBeGreaterThan(0);
  }
});
