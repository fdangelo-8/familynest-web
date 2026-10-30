import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { signInAs, skipReason, usersConfigured } from "../fixtures/auth";
import {
  IDS,
  h1,
  openMember,
  removeButton,
  roleSwitch,
  sendAgain,
  withRita,
} from "../fixtures/membro";
import {
  throwawayConfigured,
  throwawaySkipReason,
} from "../fixtures/throwaway-user";

// "Un membro del Nest" (#18), CA-37: axe on the page of Laura, with the
// dialog "Togliere Laura dal Nest?" open, and on the page of Biscotto, at 390
// and 1280 px. More: touch targets (390), order and visibility of the focus,
// dialog focus handling, and the states with an error message.

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations.filter((v) =>
    ["serious", "critical"].includes(v.impact ?? ""),
  );
}

async function duplicateIds(page: Page) {
  return page.evaluate(() => {
    const seen = new Map<string, number>();
    for (const el of document.querySelectorAll("[id]")) {
      seen.set(el.id, (seen.get(el.id) ?? 0) + 1);
    }
    return [...seen].filter(([, n]) => n > 1).map(([id]) => id);
  });
}

type Target = { name: string; width: number; height: number };

/** Interactive elements smaller than 44x44 once the invisible ::before area is counted. */
async function smallTargets(page: Page): Promise<Target[]> {
  return page.evaluate(() => {
    const sel =
      'a[href], button, input:not([type="hidden"]), select, textarea, [role="button"], [role="switch"], [role="checkbox"], [role="radio"]';
    const out: Target[] = [];
    for (const el of document.querySelectorAll<HTMLElement>(sel)) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (el.closest(".visivamente-nascosto, .vai-al-contenuto")) continue;
      const before = getComputedStyle(el, "::before");
      const width = Math.max(rect.width, parseFloat(before.width) || 0);
      const height = Math.max(rect.height, parseFloat(before.height) || 0);
      if (width < 43.5 || height < 43.5) {
        out.push({
          name: (el.getAttribute("aria-label") || el.textContent || el.tagName)
            .trim()
            .slice(0, 40),
          width: Math.round(width),
          height: Math.round(height),
        });
      }
    }
    return out;
  });
}

async function focusIsVisible(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return false;
    const cs = getComputedStyle(el);
    const outline =
      cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0;
    const shadow = cs.boxShadow !== "none";
    const parent = el.parentElement ? getComputedStyle(el.parentElement) : null;
    return outline || shadow || (!!parent && parent.boxShadow !== "none");
  });
}

const insideDialog = (page: Page) =>
  page.evaluate(
    () => !!document.activeElement?.closest('[role="alertdialog"]'),
  );

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  permissions: ["clipboard-read", "clipboard-write"],
});

test.describe("Un membro del Nest: accessibilità", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    test.skip(!usersConfigured("A"), skipReason("A"));
    await signInAs(page.context(), baseURL as string, "A");
  });

  test("CA-37: la pagina di Laura non ha violazioni serious o critical né id doppi", async ({
    page,
  }) => {
    await openMember(page, IDS.laura, "Laura");
    expect(await seriousViolations(page)).toEqual([]);
    expect(await duplicateIds(page)).toEqual([]);
  });

  test("CA-37: il dialogo «Togliere Laura dal Nest?» non ha violazioni né id doppi", async ({
    page,
  }) => {
    await openMember(page, IDS.laura, "Laura");
    await removeButton(page, "Laura").click();
    await expect(
      page.getByRole("alertdialog", { name: "Togliere Laura dal Nest?" }),
    ).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
    expect(await duplicateIds(page)).toEqual([]);
  });

  test("CA-37: la pagina di Biscotto non ha violazioni né id doppi", async ({
    page,
  }) => {
    await openMember(page, IDS.biscotto, "Biscotto");
    expect(await seriousViolations(page)).toEqual([]);
    expect(await duplicateIds(page)).toEqual([]);
  });

  test("aree di tocco di almeno 44 px (390 px)", async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "Area di tocco: solo a 390 px");
    await openMember(page, IDS.laura, "Laura");
    expect(await smallTargets(page)).toEqual([]);
  });

  test("tastiera: ordine del focus, anello visibile, interruttore spento saltato", async ({
    page,
  }) => {
    await openMember(page, IDS.laura, "Laura");
    const stops: string[] = [];
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press("Tab");
      const stop = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        return {
          role: el.getAttribute("role") ?? el.tagName.toLowerCase(),
          label: (el.getAttribute("aria-label") ?? el.textContent ?? "")
            .trim()
            .slice(0, 40),
        };
      });
      if (!stop) break;
      const label = `${stop.role}: ${stop.label}`;
      if (stops.includes(label)) break;
      stops.push(label);
      expect(await focusIsVisible(page), `anello assente su ${label}`).toBe(
        true,
      );
      if (stop.label.startsWith("Togli Laura dal Nest")) break;
    }
    const invite = stops.findIndex((s) =>
      s.includes("Manda di nuovo l'invito"),
    );
    const remove = stops.findIndex((s) => s.includes("Togli Laura dal Nest"));
    expect(invite, stops.join(" | ")).toBeGreaterThan(-1);
    expect(remove, stops.join(" | ")).toBeGreaterThan(invite);
    // The switch of an adult without account is disabled: Tab skips it.
    expect(stops.some((s) => s.startsWith("switch"))).toBe(false);
  });

  test("tastiera: il dialogo trattiene il focus, Esc lo chiude e lo restituisce", async ({
    page,
  }) => {
    await openMember(page, IDS.laura, "Laura");
    const trigger = removeButton(page, "Laura");
    await trigger.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("alertdialog", {
      name: "Togliere Laura dal Nest?",
    });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await expect.poll(() => insideDialog(page)).toBe(true);
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab");
      expect(await insideDialog(page), `Tab ${i + 1} fuori dal dialogo`).toBe(
        true,
      );
      expect(await focusIsVisible(page)).toBe(true);
    }
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Shift+Tab");
      expect(
        await insideDialog(page),
        `Maiusc+Tab ${i + 1} fuori dal dialogo`,
      ).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("«Manda di nuovo l'invito» si usa con Invio dalla tastiera", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, "share", {
        configurable: true,
        value: undefined,
      });
    });
    await openMember(page, IDS.laura, "Laura");
    await sendAgain(page).focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("status").filter({ hasText: "Link copiato" }),
    ).toBeVisible();
  });
});

test.describe("Un membro del Nest: stati con un utente usa e getta", () => {
  test("pagina di un adulto con account e dialogo: axe senza violazioni", async ({
    page,
    baseURL,
  }) => {
    test.skip(!throwawayConfigured(), throwawaySkipReason);
    await withRita(async ({ user, ritaId }) => {
      await user.signInContext(page.context(), baseURL as string);
      await openMember(page, ritaId, "Rita");
      await expect(roleSwitch(page)).toBeEnabled();
      expect(await seriousViolations(page)).toEqual([]);
      expect(await duplicateIds(page)).toEqual([]);
      // Switching on and off keeps the switch reachable and named.
      await roleSwitch(page).focus();
      await page.keyboard.press("Space");
      await expect(roleSwitch(page)).toHaveAttribute("aria-checked", "true");
      expect(await focusIsVisible(page)).toBe(true);
      await expect(h1(page)).toHaveText("Rita");
    });
  });
});
