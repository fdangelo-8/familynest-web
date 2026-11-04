import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { signInAs, skipReason, usersConfigured } from "../fixtures/auth";
import {
  throwawayConfigured,
  throwawaySkipReason,
  type ThrowawayUser,
} from "../fixtures/throwaway-user";
import { userWithNest } from "../fixtures/impostazioni";

// «Impostazioni della casa» (#41, PR #232): axe on every state, touch targets
// at 390 px, keyboard order, visible focus, no keyboard trap in the dialog.

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

/** Interactive elements smaller than 44x44 once the invisible ::before area
 * (the design system widens targets with it) is counted. */
async function smallTargets(page: Page): Promise<Target[]> {
  return page.evaluate(() => {
    const sel =
      'main a[href], main button, header a[href], header button, [role="switch"], [role="alertdialog"] button';
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

async function open(page: Page, heading: string) {
  await expect(async () => {
    await page.goto("/impostazioni");
    await expect(
      page.getByRole("heading", { level: 1, name: heading }),
    ).toBeVisible({ timeout: 10_000 });
  }).toPass({ timeout: 60_000 });
  await expect(page.getByRole("switch")).toHaveCount(5);
  await page.evaluate(() => document.fonts.ready);
}

async function openDialog(page: Page, nestName: string) {
  const dialog = page.getByRole("alertdialog");
  await expect(async () => {
    if (!(await dialog.isVisible())) {
      await page.getByRole("button", { name: `Esci da ${nestName}` }).click();
    }
    await expect(dialog).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 30_000 });
  return dialog;
}

test.describe("Impostazioni della casa: utenti del seed", () => {
  test("amministratore (Marco): axe, id unici, un solo h1, sezioni con nome", async ({
    page,
    baseURL,
  }) => {
    test.skip(!usersConfigured("A"), skipReason("A"));
    await signInAs(page.context(), baseURL as string, "A");
    await open(page, "Casa D'Angelo");
    expect(await seriousViolations(page)).toEqual([]);
    expect(await duplicateIds(page)).toEqual([]);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("region", { name: "Chi c’è" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Notifiche" })).toBeVisible();
    // «Spesa» is described by its second line.
    await expect(
      page.getByRole("switch", { name: "Spesa" }),
    ).toHaveAccessibleDescription("Raggruppate, una volta al giorno");
  });

  test("caso B (Giulia): axe, bottone spento con la nota collegata", async ({
    page,
    baseURL,
  }) => {
    test.skip(!usersConfigured("B"), skipReason("B"));
    await signInAs(page.context(), baseURL as string, "B");
    await open(page, "Casa Bianchi");
    const leave = page.getByRole("button", { name: "Esci da Casa Bianchi" });
    await expect(leave).toBeDisabled();
    await expect(leave).toHaveAccessibleDescription(/Sei l'unica persona/);
    expect(await seriousViolations(page)).toEqual([]);
    expect(await duplicateIds(page)).toEqual([]);
  });

  test("non amministratore (Paolo): axe e dialogo di uscita", async ({
    page,
    baseURL,
  }) => {
    test.skip(!usersConfigured("B2"), skipReason("B2"));
    await signInAs(page.context(), baseURL as string, "B2");
    await open(page, "Casa Bianchi");
    expect(await seriousViolations(page)).toEqual([]);
    const dialog = await openDialog(page, "Casa Bianchi");
    await expect(dialog).toHaveAccessibleName("Uscire da Casa Bianchi?");
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(await seriousViolations(page)).toEqual([]);
    expect(await duplicateIds(page)).toEqual([]);
  });

  test("dialogo (caso C, Marco): axe, fuoco su «Annulla», Tab senza uscire, Esc riporta il fuoco", async ({
    page,
    baseURL,
  }) => {
    test.skip(!usersConfigured("A"), skipReason("A"));
    await signInAs(page.context(), baseURL as string, "A");
    await open(page, "Casa D'Angelo");
    const dialog = await openDialog(page, "Casa D'Angelo");
    await expect(dialog).toHaveAccessibleName("Uscire da Casa D'Angelo?");
    await expect(dialog.getByRole("button", { name: "Annulla" })).toBeFocused();
    expect(await focusIsVisible(page)).toBe(true);
    expect(await seriousViolations(page)).toEqual([]);
    // The focus stays inside the dialog over a full round of Tab and Shift+Tab.
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press("Tab");
      expect(
        await page.evaluate(
          () => !!document.activeElement?.closest('[role="alertdialog"]'),
        ),
      ).toBe(true);
    }
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press("Shift+Tab");
      expect(
        await page.evaluate(
          () => !!document.activeElement?.closest('[role="alertdialog"]'),
        ),
      ).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Esci da Casa D'Angelo" }),
    ).toBeFocused();
  });

  test("tastiera: ordine del fuoco, fuoco visibile, nessuna trappola", async ({
    page,
    baseURL,
  }) => {
    test.skip(!usersConfigured("A"), skipReason("A"));
    await signInAs(page.context(), baseURL as string, "A");
    await open(page, "Casa D'Angelo");
    const seen: string[] = [];
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press("Tab");
      const label = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return "";
        if (!el.closest("main")) return "";
        return (
          el.getAttribute("aria-label") ||
          (el.textContent ?? "").replace(/\s+/g, " ").trim()
        );
      });
      if (label) {
        expect(await focusIsVisible(page)).toBe(true);
        seen.push(label);
      }
      if (label.startsWith("Esci da")) break;
    }
    const inMain = seen.filter(
      (l) =>
        !/^(Il tuo profilo|Calendari collegati|Casa D'Angelo$|Chi c’è$|Notifiche$)/.test(
          l,
        ),
    );
    const start = inMain.findIndex((l) => l.startsWith("Marco, tu"));
    expect(start).toBeGreaterThanOrEqual(0);
    const order = inMain.slice(start).map((l) => l.split(" Invito")[0]!);
    expect(order[0]).toMatch(/^Marco, tu/);
    expect(order[1]).toMatch(/^Laura/);
    // Children have no link: the next stop is the pet, then the five switches.
    expect(order[2]).toMatch(/^Biscotto/);
    expect(order.slice(3, 8)).toEqual([
      "Impegni e cambi d'orario",
      "Da fare assegnati a me",
      "Spesa",
      "Liberi insieme",
      "Sintesi del mattino",
    ]);
    expect(order[8]).toBe("Esci da Casa D'Angelo");
  });

  test("aree di tocco di almeno 44 px (390 px)", async ({
    page,
    baseURL,
  }, info) => {
    test.skip(info.project.name !== "mobile", "Area di tocco: solo a 390 px");
    test.skip(!usersConfigured("A"), skipReason("A"));
    await signInAs(page.context(), baseURL as string, "A");
    await open(page, "Casa D'Angelo");
    expect(await smallTargets(page)).toEqual([]);
    await openDialog(page, "Casa D'Angelo");
    expect(await smallTargets(page)).toEqual([]);
  });
});

test.describe("Impostazioni della casa: utente usa e getta", () => {
  test.skip(!throwawayConfigured(), throwawaySkipReason);

  let user: ThrowawayUser | null = null;
  test.afterEach(async () => {
    await user?.remove();
    user = null;
  });

  test("solo tu: axe e id unici", async ({ page }) => {
    user = await userWithNest(page);
    await open(page, "Casa De Santis");
    expect(await seriousViolations(page)).toEqual([]);
    expect(await duplicateIds(page)).toEqual([]);
  });

  test("interruttore non salvato: avviso con role=alert, axe, fuoco sull'interruttore", async ({
    page,
  }) => {
    user = await userWithNest(page);
    await open(page, "Casa De Santis");
    await page.route("**/impostazioni", async (route) => {
      if (route.request().method() === "POST") await route.abort();
      else await route.continue();
    });
    const toggle = page.getByRole("switch", { name: "Spesa" });
    const alert = page.locator("main").getByRole("alert");
    await expect(async () => {
      if (!(await alert.isVisible())) await toggle.click();
      await expect(alert).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 30_000 });
    await expect(alert).toContainText("cambiare la notifica «Spesa»");
    await expect(toggle).toBeFocused();
    expect(await seriousViolations(page)).toEqual([]);
    expect(await duplicateIds(page)).toEqual([]);
  });

  test("interruttore con la tastiera: Spazio lo cambia e aria-checked segue", async ({
    page,
  }) => {
    user = await userWithNest(page);
    await open(page, "Casa De Santis");
    const toggle = page.getByRole("switch", { name: "Sintesi del mattino" });
    await expect(async () => {
      await toggle.focus();
      await page.keyboard.press("Space");
      await expect(toggle).toHaveAttribute("aria-checked", "false", {
        timeout: 3000,
      });
    }).toPass({ timeout: 30_000 });
  });

  test("uscita non riuscita: avviso nel dialogo, fuoco su «Esci…», axe", async ({
    page,
  }) => {
    user = await userWithNest(page);
    await open(page, "Casa De Santis");
    const dialog = await openDialog(page, "Casa De Santis");
    await page.route("**/impostazioni", async (route) => {
      if (route.request().method() === "POST") await route.abort();
      else await route.continue();
    });
    const confirm = dialog.getByRole("button", {
      name: "Esci e cancella la casa",
    });
    await confirm.click();
    await expect(dialog.getByRole("alert")).toContainText(
      "Non siamo riusciti a farti uscire dalla casa.",
    );
    await expect(confirm).toBeFocused();
    expect(await seriousViolations(page)).toEqual([]);
    expect(await duplicateIds(page)).toEqual([]);
  });
});
