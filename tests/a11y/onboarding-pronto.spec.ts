import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import {
  throwawayConfigured,
  throwawaySkipReason,
} from "../fixtures/throwaway-user";
import { FAMILY, MORE, userWithNest } from "../visual/persone-helpers";
import { openReady, readyUser, settle } from "../visual/pronto-helpers";

// Accessibility of onboarding step 4 "Pronto" (#15), at 390 and 1280 px (the
// two projects): axe on every state, contrast of the night colours, focus
// order and visible focus, no trap, touch target of 44 px. Each test has its
// own throwaway user (marked in app_metadata, deleted at the end). Skipped
// when the keys are not set.

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

test.skip(!throwawayConfigured(), throwawaySkipReason);

const isMobile = () => test.info().project.name === "mobile";

async function expectNoBlocking(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations
      .filter((v) => ["serious", "critical"].includes(v.impact ?? ""))
      .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
  ).toEqual([]);
}

/** Contrast of a colour on another one, WCAG formula. */
function contrast(fg: string, bg: string): number {
  const lum = (css: string) => {
    const m = css.match(/[\d.]+/g)!.map(Number);
    const [r, g, b] = m.slice(0, 3).map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  };
  const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
  return (a! + 0.05) / (b! + 0.05);
}

async function expectContrast(page: Page, minPairs = 4) {
  const pairs = await page.evaluate(() => {
    const root = Array.from(
      document.querySelectorAll<HTMLElement>(
        ".schermo-notte, .split-onboarding__notte",
      ),
    ).find((el) => el.offsetParent !== null)!;
    const bg = getComputedStyle(root).backgroundColor;
    const pick = (el: Element | null) =>
      el
        ? { fg: getComputedStyle(el).color, bg, text: el.textContent ?? "" }
        : null;
    return [
      pick(root.querySelector("h1")),
      pick(root.querySelector(".marchio")),
      pick(root.querySelector(".riga-lista__titolo")),
      pick(root.querySelector(".riga-lista .icona")),
      (() => {
        const link = root.querySelector("a");
        // The light button has its own background.
        return link
          ? {
              fg: getComputedStyle(link).color,
              bg: getComputedStyle(link).backgroundColor,
              text: link.textContent ?? "",
            }
          : null;
      })(),
    ].filter(Boolean);
  });
  expect(pairs.length).toBeGreaterThanOrEqual(minPairs);
  for (const p of pairs) {
    expect(
      contrast(p!.fg, p!.bg),
      `contrasto di «${p!.text.slice(0, 30)}»`,
    ).toBeGreaterThanOrEqual(4.5);
  }
}

test.describe("onboarding · pronto · accessibilità", () => {
  test("normale: axe, contrasto, un solo h1 e un solo main", async ({
    page,
    baseURL,
  }) => {
    const user = await readyUser("family_with_children", FAMILY, ["Laura"]);
    try {
      await openReady(page, user, baseURL);
      await settle(page);
      await expectNoBlocking(page);
      await expectContrast(page);
      await expect(page.locator("main")).toHaveCount(1);
      await expect(page.locator("h1:visible")).toHaveCount(1);
      await expect(
        page.getByRole("heading", {
          level: 1,
          name: "Casa D'Angelo è pronta.",
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("img", {
          name: "Marco, Laura, Sofia, Tommaso, Biscotto",
        }),
      ).toBeVisible();
    } finally {
      await user.remove();
    }
  });

  test("vuoto (Solo io): axe e contrasto", async ({ page, baseURL }) => {
    const user = await readyUser("single", []);
    try {
      await openReady(page, user, baseURL);
      await settle(page);
      await expectNoBlocking(page);
      // No list in the empty state: heading, brand and button only.
      await expectContrast(page, 3);
    } finally {
      await user.remove();
    }
  });

  test("dieci membri: axe, un solo nome per il gruppo, nessuno scorrimento laterale", async ({
    page,
    baseURL,
  }) => {
    const user = await readyUser(
      "family_with_children",
      [...FAMILY, ...MORE],
      ["Laura"],
    );
    try {
      await openReady(page, user, baseURL);
      await settle(page);
      await expectNoBlocking(page);
      await expectContrast(page);
      await expect(
        page.getByRole("img", {
          name: "Marco, Laura, Sofia, Tommaso, Biscotto, Nonna Rosa, Zio Piero, Giulia, Micio, Luca",
        }),
      ).toBeVisible();
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    } finally {
      await user.remove();
    }
  });

  test("inviti, singolare e plurale: axe", async ({ page, baseURL }) => {
    const user = await readyUser(
      "family_with_children",
      [...FAMILY, MORE[0]!],
      ["Laura", "Nonna Rosa"],
    );
    try {
      await openReady(page, user, baseURL);
      await settle(page);
      await expectNoBlocking(page);
    } finally {
      await user.remove();
    }
  });

  test("tastiera: l'unico stop è «Vai a Oggi», con anello visibile e nessuna trappola", async ({
    page,
    baseURL,
  }) => {
    const user = await readyUser("family_with_children", FAMILY, ["Laura"]);
    try {
      await openReady(page, user, baseURL);
      await settle(page);
      const link = page.getByRole("link", { name: "Vai a Oggi" }).filter({
        visible: true,
      });
      await page.keyboard.press("Tab");
      await expect(link).toBeFocused();
      const ring = await link.evaluate((el) => {
        const s = getComputedStyle(el);
        return {
          style: s.outlineStyle,
          width: parseFloat(s.outlineWidth),
          color: s.outlineColor,
        };
      });
      expect(ring.style).not.toBe("none");
      expect(ring.width).toBeGreaterThan(0);
      // The ring is the light one of the night screens, 15.55:1 on it.
      const bg = await page.evaluate(() => {
        const root = Array.from(
          document.querySelectorAll<HTMLElement>(
            ".schermo-notte, .split-onboarding__notte",
          ),
        ).find((el) => el.offsetParent !== null)!;
        return getComputedStyle(root).backgroundColor;
      });
      expect(contrast(ring.color, bg)).toBeGreaterThanOrEqual(3);
      // Another Tab leaves the page: no trap, no other stop.
      await page.keyboard.press("Tab");
      await expect(link).not.toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await expect(link).toBeFocused();
    } finally {
      await user.remove();
    }
  });

  test("area di tocco di «Vai a Oggi»: almeno 44 px", async ({
    page,
    baseURL,
  }) => {
    const user = await readyUser("family_with_children", FAMILY, ["Laura"]);
    try {
      await openReady(page, user, baseURL);
      const box = await page
        .getByRole("link", { name: "Vai a Oggi" })
        .filter({ visible: true })
        .boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.width).toBeGreaterThanOrEqual(44);
      if (isMobile()) expect(box!.width).toBeGreaterThanOrEqual(340);
    } finally {
      await user.remove();
    }
  });

  test.describe("caricamento", () => {
    test("axe, un solo main, nessun link a /oggi, bottone occupato", async ({
      page,
      baseURL,
    }) => {
      const user = await userWithNest("family_with_children", FAMILY);
      try {
        await user.signInContext(page.context(), baseURL as string);
        // The skeleton is on screen only until the content streams in: the
        // scripts are cut from the answer so it stays (axe needs scripts in
        // the browser, so they cannot be switched off).
        await page.route("**/onboarding/pronto", async (route) => {
          const response = await route.fetch();
          const body = (await response.text()).replace(
            /<script[\s\S]*?<\/script>/g,
            "",
          );
          await route.fulfill({ response, body });
        });
        await page.goto("/onboarding/pronto");
        await expect(
          page.getByText("Stiamo preparando la casa").first(),
        ).toBeAttached();
        await expectNoBlocking(page);
        // The real content waits, hidden, in the streamed answer.
        await expect(page.locator("main:visible")).toHaveCount(1);
        await expect(page.locator('main:visible a[href="/oggi"]')).toHaveCount(
          0,
        );
        const busy = page
          .getByRole("button", { name: "Preparazione in corso" })
          .filter({ visible: true });
        await expect(busy).toHaveAttribute("aria-busy", "true");
        await expect(busy).toHaveAttribute("aria-disabled", "true");
      } finally {
        await user.remove();
      }
    });
  });
});
