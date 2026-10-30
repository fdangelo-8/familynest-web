import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import {
  throwawayConfigured,
  throwawaySkipReason,
} from "../fixtures/throwaway-user";
import { FAMILY, userWithNest } from "../visual/persone-helpers";
import {
  breakClipboard,
  CARLA,
  failInvite,
  LONG_NAMES,
  openInvite,
  shown,
} from "../visual/invito-helpers";

// Accessibility of onboarding step 4 "Invito" (#14), visual tester: axe on
// every state, focus order and visible focus, no trap, touch targets of 44 px,
// roles of toast and alert. Skipped when the keys are not set.

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
  permissions: ["clipboard-read", "clipboard-write"],
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

async function copy(page: Page, expected: "status" | "alert") {
  await expect(async () => {
    await shown(page, "button", "Copia il link").click();
    await expect(
      page.getByRole(expected).filter({ hasText: /copi/i }),
    ).toBeVisible({
      timeout: 1000,
    });
  }).toPass();
}

test.describe("onboarding · invito · accessibilità", () => {
  test("normale: axe, un solo h1, nessun id doppio", async ({
    page,
    baseURL,
  }) => {
    const user = await userWithNest("family_with_children", FAMILY);
    try {
      await openInvite(page, user, baseURL);
      await expectNoBlocking(page);
      await expect(page.locator("h1:visible")).toHaveCount(1);
      const dup = await page.evaluate(() => {
        const ids = Array.from(document.querySelectorAll("[id]")).map(
          (e) => e.id,
        );
        return ids.filter((id, i) => ids.indexOf(id) !== i);
      });
      expect(dup).toEqual([]);
      await expect(
        page
          .getByRole("progressbar", { name: "Passo 4 di 4" })
          .filter({ visible: true }),
      ).toHaveAttribute("aria-valuenow", "4");
    } finally {
      await user.remove();
    }
  });

  test("link copiato: toast role status, axe", async ({ page, baseURL }) => {
    const user = await userWithNest("family_with_children", FAMILY);
    try {
      await openInvite(page, user, baseURL);
      await copy(page, "status");
      await expectNoBlocking(page);
    } finally {
      await user.remove();
    }
  });

  test("copia non riuscita: avviso role alert, axe", async ({
    page,
    baseURL,
  }) => {
    const user = await userWithNest("family_with_children", FAMILY);
    try {
      await breakClipboard(page);
      await openInvite(page, user, baseURL);
      await copy(page, "alert");
      await expectNoBlocking(page);
    } finally {
      await user.remove();
    }
  });

  test("più adulti e nomi lunghi: axe", async ({ page, baseURL }) => {
    const user = await userWithNest("family_with_children", LONG_NAMES);
    try {
      await openInvite(page, user, baseURL);
      await expectNoBlocking(page);
    } finally {
      await user.remove();
    }
  });

  test("invito non preparato: axe, avviso role alert", async ({
    page,
    baseURL,
  }) => {
    const user = await userWithNest("family_with_children", [...FAMILY, CARLA]);
    try {
      await openInvite(page, user, baseURL);
      await failInvite(page, "server");
      await expect(async () => {
        await shown(page, "button", "Ora invita Carla").click();
        await expect(page.getByRole("alert")).toBeVisible({ timeout: 2000 });
      }).toPass();
      await expectNoBlocking(page);
    } finally {
      await user.remove();
    }
  });

  test("tastiera: ordine del fuoco, anello visibile, nessuna trappola, aree di tocco", async ({
    page,
    baseURL,
  }) => {
    const user = await userWithNest("family_with_children", FAMILY);
    try {
      await openInvite(page, user, baseURL);
      const expected = isMobile()
        ? [
            "Indietro",
            "Manda il link a Laura",
            "Copia il link",
            "Lo faccio dopo",
          ]
        : ["Manda il link a Laura", "Copia il link", "Indietro", "Ho finito"];
      await page.evaluate(() =>
        (document.activeElement as HTMLElement | null)?.blur(),
      );
      const seen: string[] = [];
      for (let i = 0; i < expected.length; i += 1) {
        await page.keyboard.press("Tab");
        const info = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement;
          const cs = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          const before = getComputedStyle(el, "::before");
          return {
            name: el.getAttribute("aria-label") ?? el.textContent?.trim() ?? "",
            outline:
              cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0,
            w: Math.max(r.width, parseFloat(before.width) || 0),
            h: Math.max(r.height, parseFloat(before.height) || 0),
          };
        });
        seen.push(info.name);
        expect(info.outline, `anello su ${info.name}`).toBe(true);
        if (isMobile()) {
          expect(info.w, `larghezza ${info.name}`).toBeGreaterThanOrEqual(44);
          expect(info.h, `altezza ${info.name}`).toBeGreaterThanOrEqual(44);
        }
      }
      expect(seen).toEqual(expected);
      // No trap: one more Tab leaves the last control.
      await page.keyboard.press("Tab");
      const after = await page.evaluate(
        () =>
          (document.activeElement as HTMLElement).getAttribute("aria-label") ??
          document.activeElement?.textContent?.trim(),
      );
      expect(after).not.toBe(expected[expected.length - 1]);
    } finally {
      await user.remove();
    }
  });
});
