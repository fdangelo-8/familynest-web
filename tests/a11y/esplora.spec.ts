import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  busy,
  CATALOGUE,
  cards,
  card,
  errorBox,
  failRequests,
  FULL,
  h1,
  holdRequests,
  isMobileProject,
  openEsplora,
  PATH,
  PINNED_READ,
  pin,
  pinFix,
  pinRemove,
  pins,
  SOLO,
  toast,
  withNest,
} from "../fixtures/esplora";
import {
  throwawayConfigured,
  throwawaySkipReason,
} from "../fixtures/throwaway-user";

// Esplora (#28): accessibility of every state (axe, serious and critical),
// the pin as a two-state button, keyboard, visible focus, 44 px touch areas on
// mobile and contrast of the pin. Every test uses a throwaway Nest.

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

test.beforeEach(() => {
  test.skip(!throwawayConfigured(), throwawaySkipReason);
});

const SIX = [
  "A tavola",
  "Noi due",
  "Stare bene",
  "Tempo insieme",
  "Passioni",
  "Casa in ordine",
];

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations.filter((v) =>
    ["serious", "critical"].includes(v.impact ?? ""),
  );
}

async function focusRingVisible(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return false;
    const s = getComputedStyle(el);
    return (
      (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) ||
      s.boxShadow !== "none"
    );
  });
}

/**
 * True when a pointer anywhere inside the 44 x 44 px square centred on the
 * element (2 px in from each edge) lands on the element itself.
 */
async function hasTouchArea(locator: Locator, size = 44) {
  return locator.evaluate((el, side) => {
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const half = side / 2 - 2;
    const points: Array<[number, number]> = [
      [cx, cy],
      [cx - half, cy - half],
      [cx + half, cy - half],
      [cx - half, cy + half],
      [cx + half, cy + half],
    ];
    return points.every(([x, y]) => {
      const hit = document.elementFromPoint(x, y);
      return hit === el || el.contains(hit);
    });
  }, size);
}

/** Contrast of the icon of a pin (its colour) against what it sits on. */
async function pinContrast(button: Locator): Promise<number> {
  return button.evaluate((el) => {
    const parse = (value: string): [number, number, number, number] => {
      const m = /rgba?\(([^)]+)\)/.exec(value);
      if (!m) return [0, 0, 0, 0];
      const p = m[1]!
        .split(/[ ,/]+/)
        .filter(Boolean)
        .map(Number);
      return [p[0]!, p[1]!, p[2]!, p[3] ?? 1];
    };
    const luminance = ([r, g, b]: number[]) => {
      const f = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
    };
    const color = parse(getComputedStyle(el).color);
    let node: HTMLElement | null = el as HTMLElement;
    let background: [number, number, number, number] = [0, 0, 0, 0];
    while (node) {
      background = parse(getComputedStyle(node).backgroundColor);
      if (background[3] > 0) break;
      node = node.parentElement;
    }
    const a = luminance(color);
    const b = luminance(background);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });
}

test.describe("axe in ogni stato", () => {
  test("normale, con due spazi fissati", async ({ page, baseURL }) => {
    await withNest(FULL, async (nest) => {
      await nest.pinAll(["A tavola", "Noi due"]);
      await nest.signIn(page, baseURL);
      await openEsplora(page, 10);
      await expect(page.locator("h1:visible")).toHaveCount(1);
      expect(await seriousViolations(page)).toEqual([]);
    });
  });

  test("caricamento", async ({ page, baseURL }) => {
    await withNest(FULL, async (nest) => {
      await nest.signIn(page, baseURL);
      const hold = await holdRequests(page, PINNED_READ);
      try {
        await page.goto(PATH, { waitUntil: "commit" });
        await expect(h1(page)).toBeVisible();
        await expect(busy(page)).toHaveCount(1);
        expect(await seriousViolations(page)).toEqual([]);
      } finally {
        hold.release();
      }
    });
  });

  test("toast dopo aver fissato", async ({ page, baseURL }) => {
    await withNest(FULL, async (nest) => {
      await nest.signIn(page, baseURL);
      await openEsplora(page, 10);
      await pinFix(page, "Zampe").click();
      await expect(toast(page)).toContainText("Zampe fissato in fondo a Oggi.");
      expect(await seriousViolations(page)).toEqual([]);
    });
  });

  test("limite di sei spazi", async ({ page, baseURL }) => {
    await withNest(FULL, async (nest) => {
      await nest.pinAll(SIX);
      await nest.signIn(page, baseURL);
      await openEsplora(page, 10);
      await pinFix(page, "Progetti").click();
      await expect(toast(page)).toContainText("Puoi fissare al massimo sei");
      expect(await seriousViolations(page)).toEqual([]);
    });
  });

  test("errore di lettura", async ({ page, baseURL }) => {
    await withNest(FULL, async (nest) => {
      await nest.signIn(page, baseURL);
      await failRequests(page, PINNED_READ);
      await page.goto(PATH);
      await expect(errorBox(page)).toBeVisible({ timeout: 20_000 });
      expect(await seriousViolations(page)).toEqual([]);
    });
  });

  test("solo io", async ({ page, baseURL }) => {
    await withNest(SOLO, async (nest) => {
      await nest.signIn(page, baseURL);
      await openEsplora(page, 6);
      expect(await seriousViolations(page)).toEqual([]);
    });
  });
});

test.describe("la puntina", () => {
  test("è un bottone con aria-pressed e un nome che dice cosa fa, fuori dal link", async ({
    page,
    baseURL,
  }) => {
    await withNest(FULL, async (nest) => {
      await nest.signIn(page, baseURL);
      await openEsplora(page, 10);
      await expect(pins(page)).toHaveCount(10);
      for (const name of CATALOGUE) {
        const button = pin(page, name);
        await expect(button).toHaveAttribute("aria-pressed", "false");
        await expect(button).toHaveAccessibleName(`Fissa ${name} in Oggi`);
        // not inside a link
        expect(await button.evaluate((el) => !!el.closest("a"))).toBe(false);
        // the icon is decorative
        await expect(button.locator("svg")).toHaveAttribute(
          "aria-hidden",
          "true",
        );
      }
    });
  });

  test("cambia aria-pressed e nome quando si fissa e si toglie, e tiene il fuoco", async ({
    page,
    baseURL,
  }) => {
    await withNest(FULL, async (nest) => {
      await nest.signIn(page, baseURL);
      await openEsplora(page, 10);
      await pinFix(page, "Passioni").focus();
      await page.keyboard.press("Space");
      const pressed = pinRemove(page, "Passioni");
      await expect(pressed).toHaveAttribute("aria-pressed", "true");
      await expect(pressed).toBeFocused();
      expect(await focusRingVisible(page)).toBe(true);
      await page.keyboard.press("Enter");
      await expect(pinFix(page, "Passioni")).toHaveAttribute(
        "aria-pressed",
        "false",
      );
      await expect(pinFix(page, "Passioni")).toBeFocused();
    });
  });

  test("il contrasto dell'icona è almeno 3:1 in ogni stato, anche sulla scheda scura", async ({
    page,
    baseURL,
  }) => {
    await withNest(FULL, async (nest) => {
      await nest.pinAll(["A tavola", "Noi due"]);
      await nest.signIn(page, baseURL);
      await openEsplora(page, 10);
      for (const name of CATALOGUE) {
        const ratio = await pinContrast(pin(page, name));
        expect(ratio, `contrasto della puntina di ${name}`).toBeGreaterThan(3);
      }
      // «Noi due» is dark and pinned: light on dark inside the dark card.
      await expect(pinRemove(page, "Noi due")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });
  });

  test("aree di tocco da 44 px (mobile)", async ({
    page,
    baseURL,
  }, testInfo) => {
    test.skip(!isMobileProject(testInfo.project.name), "solo a 390 px");
    await withNest(FULL, async (nest) => {
      await nest.signIn(page, baseURL);
      await openEsplora(page, 10);
      for (const name of CATALOGUE) {
        const button = pin(page, name);
        await button.scrollIntoViewIfNeeded();
        expect(await hasTouchArea(button), `puntina di ${name}`).toBe(true);
        const box = (await card(page, name).getByRole("link").boundingBox())!;
        expect(box.height, `scheda di ${name}`).toBeGreaterThanOrEqual(44);
      }
      const nav = page.getByRole("navigation", {
        name: "Navigazione principale",
      });
      for (const link of await nav.getByRole("link").all()) {
        const box = (await link.boundingBox())!;
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.width).toBeGreaterThanOrEqual(44);
      }
    });
  });
});

test.describe("tastiera", () => {
  test("ordine del fuoco: per ogni spazio puntina e poi link; anello sempre visibile; nessuna trappola", async ({
    page,
    baseURL,
  }) => {
    await withNest(FULL, async (nest) => {
      await nest.signIn(page, baseURL);
      await openEsplora(page, 10);
      await page.evaluate(() =>
        (document.activeElement as HTMLElement | null)?.blur(),
      );
      const inGrid: string[] = [];
      const seen = new Set<string>();
      let ended = false;
      for (let i = 0; i < 80; i += 1) {
        await page.keyboard.press("Tab");
        const stop = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          if (!el || el === document.body) return null;
          const inList = !!el.closest("ul.griglia-moduli");
          const label =
            el.getAttribute("aria-label") ??
            el.textContent?.replace(/\s+/g, " ").trim().slice(0, 40) ??
            "";
          return {
            key: `${el.tagName}:${label}:${el.getAttribute("href")}`,
            inList,
            kind: el.tagName === "BUTTON" ? "pin" : "link",
            label,
          };
        });
        if (!stop || seen.has(stop.key)) {
          ended = true;
          break;
        }
        seen.add(stop.key);
        expect(await focusRingVisible(page), `fuoco su ${stop.key}`).toBe(true);
        if (stop.inList) inGrid.push(`${stop.kind}:${stop.label}`);
      }
      expect(ended, "il fuoco esce dalla pagina").toBe(true);
      expect(inGrid).toHaveLength(20);
      CATALOGUE.forEach((name, index) => {
        expect(inGrid[index * 2]).toBe(`pin:Fissa ${name} in Oggi`);
        expect(inGrid[index * 2 + 1]).toMatch(new RegExp(`^link:${name}`));
      });
    });
  });

  test("ordine del fuoco con un solo adulto: sei spazi", async ({
    page,
    baseURL,
  }) => {
    await withNest(SOLO, async (nest) => {
      await nest.signIn(page, baseURL);
      await openEsplora(page, 6);
      await expect(cards(page)).toHaveCount(6);
      await pins(page).first().focus();
      expect(await focusRingVisible(page)).toBe(true);
      await page.keyboard.press("Tab");
      await expect(card(page, "A tavola").getByRole("link")).toBeFocused();
      expect(await focusRingVisible(page)).toBe(true);
    });
  });
});
