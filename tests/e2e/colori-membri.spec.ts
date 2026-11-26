import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import {
  HOUSEHOLD_FULL_MESSAGE,
  MAX_HOUSEHOLD_MEMBERS,
  isHouseholdFullError,
} from "../../src/lib/household-limits";
import { MEMBER_COLORS } from "../../src/components/ui/Avatar/Avatar";

// Shared part of #74 (ten member colours) and #80 (icon of Alert).

// #196: the database codes stay, the tint shown changes (spec §5).
const SHADES: Record<string, string> = {
  pomodoro: "corallo",
  glicine: "glicine",
  salvia: "menta",
  cobalto: "blu",
  zafferano: "ambra",
  lampone: "sabbia",
  ceruleo: "azzurro",
  peonia: "rosa",
  basilico: "ardesia",
  cannella: "cannella",
};
const SHADE_NAMES: Record<string, string> = Object.fromEntries(
  Object.entries(SHADES).map(([code, shade]) => [
    code,
    shade.charAt(0).toUpperCase() + shade.slice(1),
  ]),
);
const COLORS: Record<string, string> = {
  pomodoro: "#f2765c",
  glicine: "#b9a2ec",
  salvia: "#8fd0a8",
  cobalto: "#3f6fe0",
  zafferano: "#e8a15c",
  lampone: "#d9b88f",
  ceruleo: "#7cc7e0",
  peonia: "#f0a3c0",
  basilico: "#68778d",
  cannella: "#af8273",
};
const TEN = Object.keys(COLORS);

function toHex(rgb: string): string {
  const [r, g, b] = (rgb.match(/\d+(\.\d+)?/g) ?? []).map(Number);
  return `#${[r, g, b].map((n) => Math.round(n!).toString(16).padStart(2, "0")).join("")}`;
}

test.describe("colori dei membri (#74, parte 2)", () => {
  test("CA-6: i 10 token hanno i valori della specifica", async ({ page }) => {
    await page.goto("/design-system");
    const values = await page.evaluate(
      (names) =>
        Object.fromEntries(
          names.map((n) => [
            n,
            getComputedStyle(document.documentElement)
              .getPropertyValue(`--color-membro-${n}`)
              .trim(),
          ]),
        ),
      TEN.map((code) => SHADES[code]!),
    );
    const wanted: Record<string, string> = Object.fromEntries(
      TEN.map((code) => [SHADES[code]!, COLORS[code]!]),
    );
    for (const name of TEN.map((code) => SHADES[code]!)) {
      const got = values[name]!.toLowerCase();
      const short = got.replace(
        /^#([0-9a-f])([0-9a-f])([0-9a-f])$/,
        "#$1$1$2$2$3$3",
      );
      expect(short, name).toBe(wanted[name]);
    }
  });

  test("CA-9: MEMBER_COLORS ha i 10 colori e insieme, con la classe di ognuno", () => {
    expect([...MEMBER_COLORS]).toEqual([...TEN, "insieme"]);
    const css = readFileSync("src/app/components.css", "utf8");
    for (const name of TEN) {
      // The class sets --c from the token of the shade of the code (#196).
      expect(css, name).toMatch(
        new RegExp(
          `\\.membro-${name}\\s*\\{\\s*--c:\\s*var\\(--color-membro-${SHADES[name]}\\);`,
        ),
      );
    }
  });

  test("CA-14: household-limits", () => {
    expect(MAX_HOUSEHOLD_MEMBERS).toBe(10);
    expect(MAX_HOUSEHOLD_MEMBERS).toBe(
      MEMBER_COLORS.filter((c) => c !== "insieme").length,
    );
    expect(HOUSEHOLD_FULL_MESSAGE).toBe(
      "Il Nest è al completo: ci stanno al massimo 10 tra persone e animali.",
    );
    expect(
      isHouseholdFullError({
        code: "P0001",
        message: "household member limit reached",
      }),
    ).toBe(true);
    expect(isHouseholdFullError({ code: "23505", message: "duplicate" })).toBe(
      false,
    );
    expect(isHouseholdFullError({ code: "42501", message: "denied" })).toBe(
      false,
    );
    expect(
      isHouseholdFullError({
        code: "P0001",
        message: "user already belongs to a household",
      }),
    ).toBe(false);
    expect(isHouseholdFullError(null)).toBe(false);
  });

  test("CA-8: avatar dei 10 colori", async ({ page }) => {
    await page.goto("/design-system");
    const group = page.getByTestId("avatar-dieci-colori");
    const avatars = group.getByRole("img");
    await expect(avatars).toHaveCount(10);
    // #196: the name read aloud is the one of the shade, the initial is white
    // on blue and slate and ink on the others.
    for (const [index, name] of TEN.entries()) {
      const avatar = avatars.nth(index);
      await expect(avatar).toHaveAttribute("aria-label", SHADE_NAMES[name]!);
      const colors = await avatar.evaluate((node) => {
        const style = getComputedStyle(node);
        return [style.backgroundColor, style.color];
      });
      expect(toHex(colors[0]!), name).toBe(COLORS[name]);
      expect(toHex(colors[1]!), name).toBe(
        name === "cobalto" || name === "basilico" ? "#ffffff" : "#10262a",
      );
    }
  });

  for (const [label, width, height] of [
    ["390", 390, 844],
    ["1280", 1280, 800],
  ] as const) {
    test(`CA-10/11: scelta del colore su due righe da 5 a ${label} px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await page.goto("/design-system");
      const group = page.getByTestId("scelta-colore-dieci");
      await expect(group).toHaveAttribute("role", "radiogroup");
      await expect(group).toHaveAttribute("aria-label", "Il tuo colore");
      const radios = group.getByRole("radio");
      await expect(radios).toHaveCount(10);
      const names = [
        "Corallo (già di Laura)",
        "Glicine",
        "Menta",
        "Blu",
        "Ambra",
        "Sabbia",
        "Azzurro",
        "Rosa",
        "Ardesia",
        "Cannella",
      ];
      const boxes = [];
      for (const [index, name] of names.entries()) {
        const radio = radios.nth(index);
        await expect(radio).toHaveAccessibleName(name);
        boxes.push((await radio.boundingBox())!);
      }
      await expect(radios.nth(1)).toHaveAttribute("aria-checked", "true");
      expect(new Set(boxes.slice(0, 5).map((b) => b.y)).size).toBe(1);
      expect(new Set(boxes.slice(5).map((b) => b.y)).size).toBe(1);
      expect(boxes[5]!.y).toBeGreaterThan(boxes[0]!.y);
      const box = (await group.boundingBox())!;
      for (const b of boxes) {
        expect(b.x).toBeGreaterThanOrEqual(box.x - 1);
        expect(b.x + b.width).toBeLessThanOrEqual(box.x + box.width + 1);
      }
      const overflow = await page.evaluate(() => ({
        doc:
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      }));
      expect(overflow.doc).toBe(true);
      expect(await group.evaluate((n) => n.scrollWidth <= n.clientWidth)).toBe(
        true,
      );
    });
  }

  test("CA-12: Tab tocca solo i 9 colori liberi, in ordine", async ({
    page,
  }) => {
    await page.goto("/design-system");
    const group = page.getByTestId("scelta-colore-dieci");
    const radios = group.getByRole("radio");
    // #196: only the first colour is taken (by Laura), the second is chosen.
    await expect(radios.nth(0)).toBeDisabled();
    await radios.nth(1).focus();
    const seen: string[] = [];
    for (let i = 0; i < 9; i++) {
      seen.push(
        await page.evaluate(
          () => document.activeElement?.getAttribute("aria-label") ?? "",
        ),
      );
      await page.keyboard.press("Tab");
    }
    expect(seen).toEqual([
      "Glicine",
      "Menta",
      "Blu",
      "Ambra",
      "Sabbia",
      "Azzurro",
      "Rosa",
      "Ardesia",
      "Cannella",
    ]);
  });
});

test.describe("Alert con icona a scelta (#80)", () => {
  test("CA-2: l'esempio usa wifi-off, gli altri tengono l'icona della variante", async ({
    page,
  }) => {
    await page.goto("/design-system");
    const custom = page.getByTestId("avviso-icona-personalizzata");
    await expect(custom.locator("use")).toHaveAttribute("href", "#i-wifi-off");
    await expect(
      page.getByTestId("avviso-errore").locator("use"),
    ).toHaveAttribute("href", "#i-circle-alert");
    await expect(
      page.getByTestId("avviso-avviso").locator("use"),
    ).toHaveAttribute("href", "#i-triangle-alert");
    await expect(
      page.getByTestId("avviso-info").locator("use"),
    ).toHaveAttribute("href", "#i-info");
    await expect(page.getByTestId("avviso-ok").locator("use")).toHaveAttribute(
      "href",
      "#i-check",
    );
  });
});
