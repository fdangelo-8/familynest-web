import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { signInAs, skipReason, usersConfigured } from "../fixtures/auth";
import {
  createThrowawayUser,
  throwawayConfigured,
  throwawaySkipReason,
} from "../fixtures/throwaway-user";

// "Il tuo Nest" (#17), CA-30: axe on the page and on the open "Invita
// qualcuno" dialog, at 390 and 1280 px (the two Playwright projects).

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

test.describe("Il tuo Nest: accessibilità", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    test.skip(!usersConfigured("A"), skipReason("A"));
    await signInAs(page.context(), baseURL as string, "A");
    await page.goto("/nest");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("CA-30: la pagina non ha violazioni serious o critical né id doppi", async ({
    page,
  }) => {
    expect(await seriousViolations(page)).toEqual([]);
    expect(await duplicateIds(page)).toEqual([]);
  });

  test("CA-30: il dialogo «Invita qualcuno» non ha violazioni né id doppi", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Invita qualcuno" }).click();
    await expect(
      page.getByRole("dialog", { name: "Invita qualcuno" }),
    ).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
    expect(await duplicateIds(page)).toEqual([]);
  });
});

// Completion of the accessibility pass (visual tester, #103): more states,
// touch targets, keyboard order, focus visibility, dialog focus handling.

type Target = { name: string; width: number; height: number };

/** Interactive elements smaller than 44x44 once the invisible ::before area
 * (the design system widens targets with it) is counted. */
async function smallTargets(page: Page, root?: string): Promise<Target[]> {
  return page.evaluate((rootSelector) => {
    const scope = rootSelector
      ? document.querySelector(rootSelector)
      : document;
    if (!scope) return [];
    const sel =
      'a[href], button, input:not([type="hidden"]), select, textarea, [role="button"], [role="switch"], [role="checkbox"], [role="radio"]';
    const out: { name: string; width: number; height: number }[] = [];
    for (const el of scope.querySelectorAll<HTMLElement>(sel)) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (el.closest(".visivamente-nascosto, .vai-al-contenuto")) continue;
      const before = getComputedStyle(el, "::before");
      const bw = parseFloat(before.width) || 0;
      const bh = parseFloat(before.height) || 0;
      const width = Math.max(rect.width, bw);
      const height = Math.max(rect.height, bh);
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
  }, root);
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
  page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'));

test.describe("Il tuo Nest: accessibilità, stati e tastiera", () => {
  test("pagina: aree di tocco di almeno 44 px (390 px)", async ({
    page,
    baseURL,
  }, info) => {
    test.skip(info.project.name !== "mobile", "Area di tocco: solo a 390 px");
    test.skip(!usersConfigured("A"), skipReason("A"));
    await signInAs(page.context(), baseURL as string, "A");
    await page.goto("/nest");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await smallTargets(page)).toEqual([]);
  });

  test("pagina di un non amministratore: axe senza violazioni", async ({
    page,
    baseURL,
  }) => {
    test.skip(!usersConfigured("B2"), skipReason("B2"));
    await signInAs(page.context(), baseURL as string, "B2");
    await page.goto("/nest");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
    expect(await duplicateIds(page)).toEqual([]);
  });

  test("Nest al completo: axe, bottone spento e messaggio visibile", async ({
    page,
    baseURL,
  }) => {
    test.skip(!throwawayConfigured(), throwawaySkipReason);
    const user = await createThrowawayUser("Ilaria De Santis");
    try {
      const created = await user.client.rpc("create_household", {
        name: "Casa De Santis",
        household_type: "family_with_children",
        member_name: "Ilaria",
        color: "pomodoro",
      });
      expect(created.error).toBeNull();
      const { data: id } = await user.client.rpc("current_household_id");
      const colors = [
        "glicine",
        "salvia",
        "cobalto",
        "zafferano",
        "lampone",
        "ceruleo",
        "peonia",
        "basilico",
        "cannella",
      ] as const;
      for (const [i, color] of colors.entries()) {
        const { error } = await user.client.from("household_members").insert({
          household_id: id as string,
          kind: "child",
          name: `Membro${i + 1}`,
          color,
        });
        expect(error).toBeNull();
      }
      await user.signInContext(page.context(), baseURL as string);
      await page.goto("/nest");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Invita qualcuno" }),
      ).toBeDisabled();
      await expect(
        page.getByText(
          "Il Nest è al completo: ci stanno al massimo 10 tra persone e animali.",
        ),
      ).toBeVisible();
      expect(await seriousViolations(page)).toEqual([]);
      expect(await duplicateIds(page)).toEqual([]);
    } finally {
      await user.remove();
    }
  });

  test("dialogo: nome, aria-modal, focus dentro, errore del campo, aree di tocco", async ({
    page,
    baseURL,
  }, info) => {
    test.skip(!usersConfigured("A"), skipReason("A"));
    await signInAs(page.context(), baseURL as string, "A");
    await page.goto("/nest");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.getByRole("button", { name: "Invita qualcuno" }).click();
    const dialog = page.getByRole("dialog", { name: "Invita qualcuno" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await expect.poll(() => insideDialog(page)).toBe(true);
    for (const input of await dialog.locator("input, select, textarea").all()) {
      const type = await input.getAttribute("type");
      if (type === "radio" || type === "hidden") continue;
      await expect(input).toHaveAccessibleName(/.+/);
    }
    if (info.project.name === "mobile") {
      expect(await smallTargets(page, '[role="dialog"]')).toEqual([]);
    }
    await dialog.getByRole("button", { name: "Continua" }).click();
    const name = dialog.getByLabel("Nome");
    await expect(name).toHaveAttribute("aria-invalid", "true");
    await expect(name).toHaveAttribute("aria-describedby", /.+/);
    await expect(name).toBeFocused();
    expect(await seriousViolations(page)).toEqual([]);
    expect(await duplicateIds(page)).toEqual([]);
  });

  test("tastiera: ordine del focus, anello visibile, nessuna trappola", async ({
    page,
    baseURL,
  }) => {
    test.skip(!usersConfigured("A"), skipReason("A"));
    await signInAs(page.context(), baseURL as string, "A");
    await page.goto("/nest");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const stops: string[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) {
      await page.keyboard.press("Tab");
      const stop = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const r = el.getBoundingClientRect();
        const text = (el.getAttribute("aria-label") ?? el.textContent ?? "")
          .trim()
          .slice(0, 30);
        return {
          key: `${el.tagName}|${text}|${Math.round(r.x)}|${Math.round(r.y)}`,
          label: `${el.tagName.toLowerCase()}: ${text}`,
        };
      });
      if (!stop || seen.has(stop.key)) break;
      seen.add(stop.key);
      stops.push(stop.label);
      expect(
        await focusIsVisible(page),
        `anello assente su ${stop.label}`,
      ).toBe(true);
    }
    expect(stops[0]).toMatch(/Vai al contenuto/);
    expect(stops.join("|")).toContain("Invita qualcuno");
    expect(stops.length).toBeLessThan(60);
  });

  test("tastiera: il dialogo trattiene il focus, Esc lo chiude e lo restituisce", async ({
    page,
    baseURL,
  }) => {
    test.skip(!usersConfigured("A"), skipReason("A"));
    await signInAs(page.context(), baseURL as string, "A");
    await page.goto("/nest");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const trigger = page.getByRole("button", { name: "Invita qualcuno" });
    await trigger.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Invita qualcuno" });
    await expect(dialog).toBeVisible();
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press("Tab");
      expect(await insideDialog(page), `Tab ${i + 1} fuori dal dialogo`).toBe(
        true,
      );
      expect(await focusIsVisible(page)).toBe(true);
    }
    for (let i = 0; i < 25; i++) {
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
});
