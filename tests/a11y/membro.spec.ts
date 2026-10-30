import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { hasTestUser, signInAs } from "../fixtures/visual-login";
import {
  throwawayConfigured,
  type ThrowawayUser,
} from "../fixtures/throwaway-user";
import {
  ANNA_B,
  BISCOTTO_A,
  LAURA_A,
  PAOLO_B,
  baseURL,
  openMember,
  withLaura,
  withRita,
} from "../fixtures/membro-visuale";

// PR #131 (#18): axe on every state of /membri/<id>, keyboard order, focus
// ring, 44 px touch areas and aria-haspopup on «Togli».

type Key = "A" | "B" | "C";
async function signIn(page: Page, key: Key | "B2") {
  const ok = await signInAs(page.context(), baseURL(), key as Key);
  test.skip(!ok, `Utente di prova ${key} non disponibile`);
}

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
}

/** True when the 44 x 44 area centred on the element hits the element. */
async function hasTouchArea(page: Page, target: Locator) {
  const box = await target.boundingBox();
  expect(box).not.toBeNull();
  const cx = box!.x + box!.width / 2;
  const cy = box!.y + box!.height / 2;
  const handle = await target.elementHandle();
  return page.evaluate(
    ({ x, y, el }) =>
      [
        [x - 21, y],
        [x + 21, y],
        [x, y - 21],
        [x, y + 21],
      ].every(([px, py]) => {
        const hit = document.elementFromPoint(px!, py!);
        return !!hit && (el!.contains(hit) || hit.contains(el!));
      }),
    { x: cx, y: cy, el: handle },
  );
}

test.describe("utenti del seed", () => {
  test("#18: axe, invito valido, animale, scaduto, con account, non amministratore", async ({
    page,
  }) => {
    test.skip(!hasTestUser("A") || !hasTestUser("B"), "Utenti non configurati");
    await signIn(page, "A");
    await openMember(page, LAURA_A, "Laura");
    await axe(page);
    await openMember(page, BISCOTTO_A, "Biscotto");
    await axe(page);
    const other = await page.context().newPage();
    await signIn(other, "B");
    await openMember(other, ANNA_B, "Anna");
    await axe(other);
    await openMember(other, PAOLO_B, "Paolo");
    await axe(other);
  });

  test("#18: axe, non amministratore", async ({ page }) => {
    test.skip(!hasTestUser("B2" as "A"), "Utente B2 non configurato");
    await signIn(page, "B2");
    await openMember(page, ANNA_B, "Anna");
    await axe(page);
  });

  test("#18: axe con il dialogo aperto, focus su «Annulla» e ritorno", async ({
    page,
  }) => {
    test.skip(!hasTestUser("A"), "Utente A non configurato");
    await signIn(page, "A");
    await openMember(page, LAURA_A, "Laura");
    const togli = page.getByRole("button", { name: "Togli Laura dal Nest" });
    await expect(togli).toHaveAttribute("aria-haspopup", "dialog");
    await togli.click();
    const dialog = page.getByRole("alertdialog", {
      name: "Togliere Laura dal Nest?",
    });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Annulla" })).toBeFocused();
    await axe(page);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(togli).toBeFocused();
  });

  test("#18: aria-haspopup solo su «Togli»", async ({ page }) => {
    test.skip(!hasTestUser("A"), "Utente A non configurato");
    await signIn(page, "A");
    await openMember(page, LAURA_A, "Laura");
    await expect(page.locator("main [aria-haspopup]")).toHaveCount(1);
  });

  test("#18: tastiera, ordine del fuoco e anello visibile", async ({
    page,
  }, info) => {
    test.skip(!hasTestUser("A"), "Utente A non configurato");
    await signIn(page, "A");
    await openMember(page, LAURA_A, "Laura");
    await page.locator("main").focus();
    const seen: string[] = [];
    // Mobile: Indietro, invitation row, Togli (the switch is disabled and
    // skipped). Desktop: Settings menu links first, then the same.
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      const label = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || !el.closest("main")) return null;
        const ring = getComputedStyle(el).outlineStyle;
        return `${el.textContent?.trim().slice(0, 30)}|${ring}`;
      });
      if (label) seen.push(label);
    }
    const names = seen.map((s) => s.split("|")[0]);
    const rowAt = names.findIndex((n) => n?.startsWith("Manda di nuovo"));
    const togliAt = names.findIndex((n) => n?.startsWith("Togli Laura"));
    expect(rowAt, "riga dell'invito raggiunta").toBeGreaterThanOrEqual(0);
    expect(togliAt, "«Togli» raggiunto dopo la riga").toBeGreaterThan(rowAt);
    expect(names.some((n) => n === "")).toBe(false);
    // Disabled switch: never in the order.
    expect(await page.getByRole("switch").isDisabled()).toBe(true);
    // Focus ring visible on the row and on Togli.
    for (const entry of seen.filter(
      (s) => s.startsWith("Manda di nuovo") || s.startsWith("Togli Laura"),
    )) {
      expect(entry.endsWith("|none")).toBe(false);
    }
    expect(info.project.name).toMatch(/mobile|desktop/);
  });

  test("#18: aree di tocco di 44 px (riga, Togli)", async ({ page }) => {
    test.skip(!hasTestUser("A"), "Utente A non configurato");
    await signIn(page, "A");
    await openMember(page, LAURA_A, "Laura");
    const row = page.getByRole("button", { name: /Manda di nuovo/ });
    await expect(row).toBeVisible();
    expect((await row.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    const togli = page.getByRole("button", { name: "Togli Laura dal Nest" });
    expect(await hasTouchArea(page, togli)).toBe(true);
    const back = page.getByRole("link", { name: "Indietro" });
    if (await back.isVisible()) {
      expect(await hasTouchArea(page, back)).toBe(true);
    }
  });
});

test.describe("con utenti usa e getta", () => {
  test.skip(!throwawayConfigured(), "Chiavi Supabase non impostate");

  const cleanup: ThrowawayUser[] = [];
  test.afterEach(async () => {
    for (const u of cleanup.splice(0)) await u.remove();
  });

  test("#18: axe, da invitare", async ({ page }) => {
    const { user, lauraId } = await withLaura(page);
    cleanup.push(user);
    await openMember(page, lauraId, "Laura");
    await axe(page);
  });

  test("#18: axe e area di tocco, interruttore acceso", async ({ page }) => {
    const { user, user2, ritaId } = await withRita(page);
    cleanup.push(user, user2);
    await openMember(page, ritaId, "Rita");
    const toggle = page.getByRole("switch", { name: "Amministratore" });
    expect(await hasTouchArea(page, toggle)).toBe(true);
    await toggle.focus();
    await page.keyboard.press("Space");
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await axe(page);
  });
});
