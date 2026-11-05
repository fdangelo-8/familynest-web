import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { waitForAnimationsToEnd } from "../fixtures/animations";
import {
  throwawayConfigured,
  throwawaySkipReason,
  type ThrowawayUser,
} from "../fixtures/throwaway-user";
import {
  FIXED_NOW,
  LINK_EXPIRES_AT,
  answerListReads,
  answerPublicReads,
  ideaButton,
  openPublic,
  openWishlist,
  pinLinkExpiry,
  wishNest,
  type WishNest,
} from "../fixtures/lista-desideri-visuale";

// PR #279 (#32 and #33): axe on every state of the wish list of a child and of
// the public page, plus the keyboard (order of the focus, visible ring, no trap
// in the sheet, Esc and return of the focus) and the 44 px touch areas at 390 px.

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW);
});

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations
      .filter((v) => ["serious", "critical"].includes(v.impact ?? ""))
      .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
  ).toEqual([]);
}

const focusedName = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return "";
    return (el.getAttribute("aria-label") ?? el.textContent ?? "")
      .replace(/\s+/g, " ")
      .trim();
  });

const focusRingVisible = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return false;
    const s = getComputedStyle(el);
    return (
      (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) ||
      s.boxShadow !== "none"
    );
  });

/** Tab until the focused element is the one asked, at most `max` times. */
async function tabTo(page: Page, target: Locator, max = 40) {
  const handle = await target.elementHandle();
  for (let i = 0; i < max; i++) {
    await page.keyboard.press("Tab");
    const there = await page.evaluate(
      (el) => document.activeElement === el,
      handle,
    );
    if (there) return i + 1;
  }
  throw new Error("Il fuoco non ha raggiunto l'elemento");
}

/**
 * The area of touch is at least 44 x 44 px: the points of a 44 px square
 * centred on the control hit the control itself (LEZIONI: `elementFromPoint`,
 * not `boundingBox`).
 */
async function touchArea(locator: Locator, label: string) {
  await locator.evaluate((el) => el.scrollIntoView({ block: "center" }));
  const result = await locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const bad: string[] = [];
    for (const dx of [-21, 0, 21]) {
      for (const dy of [-21, 0, 21]) {
        const hit = document.elementFromPoint(cx + dx, cy + dy);
        if (!hit || !(el === hit || el.contains(hit) || hit.contains(el))) {
          bad.push(`${dx},${dy}`);
        }
      }
    }
    return { bad, w: Math.round(r.width), h: Math.round(r.height) };
  });
  expect(result.bad, `${label} (${result.w}x${result.h})`).toEqual([]);
}

test.describe("con un utente usa e getta", () => {
  test.skip(!throwawayConfigured(), throwawaySkipReason);

  let user: ThrowawayUser | null = null;
  test.afterEach(async () => {
    await user?.remove();
    user = null;
  });

  async function parents(
    page: Page,
    options: Parameters<typeof wishNest>[1] = {},
  ): Promise<WishNest> {
    const nest = await wishNest(page, { login: true, ...options });
    user = nest.user;
    await pinLinkExpiry(page, LINK_EXPIRES_AT);
    await openWishlist(page, nest.childId);
    return nest;
  }

  const addButton = (page: Page) =>
    page.getByRole("button", { name: "Aggiungi un'idea" });

  // ---- axe: parents' page ----------------------------------------------

  test("axe: lista con idee e link attivo", async ({ page }) => {
    await parents(page, { share: "attivo" });
    await axe(page);
  });

  test("axe: lista con le foto", async ({ page }) => {
    await parents(page, { ideas: "mockup-con-foto", share: "attivo" });
    await axe(page);
  });

  test("axe: lista vuota", async ({ page }) => {
    await parents(page, { ideas: "nessuna" });
    await axe(page);
  });

  test("axe: tutte le idee già prese", async ({ page }) => {
    await parents(page, { ideas: "tutte-prese", share: "attivo" });
    await axe(page);
  });

  test("axe: mai condivisa", async ({ page }) => {
    await parents(page, { share: "mai" });
    await axe(page);
  });

  test("axe: senza data di nascita", async ({ page }) => {
    await parents(page, { birth: null });
    await axe(page);
  });

  test("axe: foglio «Aggiungi un'idea»", async ({ page }) => {
    await parents(page, { share: "attivo" });
    await addButton(page).click();
    const dialog = page.getByRole("dialog", { name: "Aggiungi un'idea" });
    await expect(dialog).toBeVisible();
    await waitForAnimationsToEnd(page);
    await axe(page);
  });

  test("axe: foglio «Aggiungi un'idea» con errore", async ({ page }) => {
    await parents(page, { share: "attivo" });
    await addButton(page).click();
    const dialog = page.getByRole("dialog", { name: "Aggiungi un'idea" });
    await dialog.getByRole("button", { name: "Aggiungi alla lista" }).click();
    await expect(
      dialog.getByText(
        "Incolla il link di un negozio o scrivi l'idea qui sotto.",
      ),
    ).toBeVisible();
    await waitForAnimationsToEnd(page);
    await axe(page);
  });

  test("axe: foglio «Modifica l'idea» (libera e presa)", async ({ page }) => {
    await parents(page, { share: "attivo" });
    await ideaButton(page, "Diario segreto con lucchetto").click();
    const dialog = page.getByRole("dialog", { name: "Modifica l'idea" });
    await expect(dialog).toBeVisible();
    await waitForAnimationsToEnd(page);
    await axe(page);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await ideaButton(page, "Casco per la bici").click();
    await expect(dialog.getByText("La regala Nonna Anna.")).toBeVisible();
    await waitForAnimationsToEnd(page);
    await axe(page);
  });

  test("axe: conferme (elimina e disattiva)", async ({ page }) => {
    await parents(page, { share: "attivo" });
    await page.getByRole("button", { name: "Disattiva il link" }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await waitForAnimationsToEnd(page);
    await axe(page);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("alertdialog")).toBeHidden();
    await ideaButton(page, "Casco per la bici").click();
    await page.getByRole("button", { name: "Elimina l'idea" }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await waitForAnimationsToEnd(page);
    await axe(page);
  });

  test("axe: «Condividi» con copia a mano", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: () => Promise.reject(new Error("no")) },
        configurable: true,
      });
    });
    await parents(page, { share: "mai" });
    await page.getByRole("button", { name: "Condividi", exact: true }).click();
    await expect(
      page.getByRole("dialog", { name: "Copia il link" }),
    ).toBeVisible();
    await waitForAnimationsToEnd(page);
    await axe(page);
  });

  test("axe: caricamento", async ({ page }) => {
    const nest = await wishNest(page, { login: true, share: "attivo" });
    user = nest.user;
    let release: () => void = () => {};
    const hold = new Promise<void>((resolve) => (release = resolve));
    await answerListReads(page, { hold });
    try {
      const asked = page.waitForRequest(
        (r) => /\/rest\/v1\/wishlists/.test(r.url()) && r.method() === "GET",
      );
      await page.goto(`/figli/${nest.childId}/lista-desideri`);
      await asked;
      await expect(page.getByText("Caricamento in corso")).toBeAttached();
      await axe(page);
    } finally {
      release();
    }
  });

  test("axe: errore della pagina", async ({ page }) => {
    const nest = await wishNest(page, { login: true });
    user = nest.user;
    await answerListReads(page, "error");
    await expect(async () => {
      await page.goto(`/figli/${nest.childId}/lista-desideri`);
      await expect(
        page.getByRole("heading", { name: "Questa pagina non si è caricata" }),
      ).toBeVisible({ timeout: 15_000 });
    }).toPass({ timeout: 60_000 });
    await axe(page);
  });

  test("axe: offline con la pagina aperta", async ({ page }) => {
    await parents(page, { share: "attivo" });
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await expect(page.getByText(/^Sei offline\./)).toBeVisible();
    await axe(page);
  });

  // ---- keyboard: parents' page ------------------------------------------

  test("tastiera: fuoco, anello visibile, foglio senza trappola", async ({
    page,
  }, info) => {
    await parents(page, { share: "attivo" });
    const order: string[] = [];
    const wanted = [
      "Condividi",
      "Disattiva il link",
      "Diario segreto con lucchetto",
      "Set di acquerelli con pennelli",
      "Cuffie senza fili per bambini",
      "Biglietti per il musical",
      "Casco per la bici",
      "Puzzle da 1000 pezzi",
    ];
    const first = page.getByRole("button", { name: "Condividi", exact: true });
    await tabTo(page, first);
    for (let i = 0; i < wanted.length; i++) {
      order.push(await focusedName(page));
      expect(await focusRingVisible(page), wanted[i]).toBe(true);
      if (i < wanted.length - 1) await page.keyboard.press("Tab");
    }
    expect(order).toEqual(wanted);

    // The sheet: the focus goes in, stays in, Esc gives it back.
    const opener = ideaButton(page, "Biglietti per il musical");
    await opener.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Modifica l'idea" });
    await expect(dialog).toBeVisible();
    await waitForAnimationsToEnd(page);
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press("Tab");
      const inside = await page.evaluate(() => {
        const d = document.querySelector('[role="dialog"]');
        return !!d && d.contains(document.activeElement);
      });
      expect(
        inside,
        `Tab ${i + 1} resta nel foglio (${info.project.name})`,
      ).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test("aree di tocco a 390 px: lista", async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "solo su mobile");
    await parents(page, { share: "attivo" });
    await touchArea(
      page.getByRole("button", { name: "Condividi", exact: true }),
      "Condividi",
    );
    await touchArea(
      page.getByRole("button", { name: "Disattiva il link" }),
      "Disattiva il link",
    );
    await touchArea(addButton(page), "+ della barra");
    await touchArea(
      page.getByRole("link", { name: "Indietro" }),
      "Indietro della barra",
    );
    for (const title of [
      "Diario segreto con lucchetto",
      "Biglietti per il musical",
      "Casco per la bici",
    ]) {
      await touchArea(ideaButton(page, title), `riga ${title}`);
    }
  });

  test("aree di tocco a 390 px: senza data di nascita", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "mobile", "solo su mobile");
    await parents(page, { birth: null });
    await touchArea(
      page.getByRole("link", { name: /^Aggiungila/ }),
      "Aggiungila",
    );
  });

  // ---- public page --------------------------------------------------------

  async function publicPage(
    page: Page,
    options: Parameters<typeof wishNest>[1] = {},
  ): Promise<WishNest> {
    const nest = await wishNest(page, { share: "attivo", ...options });
    user = nest.user;
    await openPublic(page, nest.code!);
    return nest;
  }

  const giveButtons = (page: Page) =>
    page.getByRole("button", { name: /^Lo regalo io/ });

  test("axe: pagina pubblica, normale e con le foto", async ({ page }) => {
    await publicPage(page, { ideas: "mockup-con-foto" });
    await axe(page);
  });

  test("axe: pagina pubblica, tutto preso", async ({ page }) => {
    await publicPage(page, { ideas: "tutte-prese" });
    await axe(page);
  });

  test("axe: pagina pubblica, senza idee", async ({ page }) => {
    const nest = await wishNest(page, { share: "attivo" });
    user = nest.user;
    await nest.user.admin
      .from("wishlist_items")
      .delete()
      .eq("household_id", nest.householdId);
    await openPublic(page, nest.code!);
    await axe(page);
  });

  test("axe: pagina pubblica, link non attivo", async ({ page }) => {
    const nest = await wishNest(page, { share: "disattivato" });
    user = nest.user;
    await page.goto(`/desideri/${nest.code}`);
    await expect(
      page.getByRole("heading", { name: "Questa lista non è più attiva" }),
    ).toBeVisible();
    await axe(page);
  });

  test("axe: pagina pubblica, errore di caricamento", async ({ page }) => {
    const nest = await wishNest(page, { share: "attivo" });
    user = nest.user;
    await answerPublicReads(page, "error");
    await page.goto(`/desideri/${nest.code}`);
    await expect(
      page.getByRole("heading", { name: "Questa pagina non si è caricata" }),
    ).toBeVisible();
    await axe(page);
  });

  test("axe: pagina pubblica, offline", async ({ page }) => {
    await publicPage(page);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "Sei offline" })
        .locator("visible=true"),
    ).toContainText("Sei offline.");
    await axe(page);
  });

  test("axe: foglio «Lo regalo io», con errore e dopo", async ({ page }) => {
    await publicPage(page);
    await giveButtons(page).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await waitForAnimationsToEnd(page);
    await axe(page);
    await dialog.getByRole("button", { name: "Lo regalo io" }).click();
    await expect(
      dialog.getByText(
        "Scrivi il tuo nome, così i genitori sanno chi lo regala.",
      ),
    ).toBeVisible();
    await axe(page);
    await dialog.getByLabel("Come ti chiami?").fill("Nonno Piero");
    await dialog.getByRole("button", { name: "Lo regalo io" }).click();
    await expect(page.getByText("Segnato a tuo nome.")).toBeVisible();
    await waitForAnimationsToEnd(page);
    await axe(page);
  });

  test("tastiera pubblica: ordine del fuoco, anello, foglio e ritorno", async ({
    page,
  }) => {
    await publicPage(page);
    const first = page
      .getByRole("link", { name: /^Diario segreto con lucchetto/ })
      .locator("visible=true");
    await tabTo(page, first);
    expect(await focusRingVisible(page)).toBe(true);
    await page.keyboard.press("Tab");
    expect(await focusedName(page)).toMatch(/^Lo regalo io/);
    expect(await focusRingVisible(page)).toBe(true);
    await page.keyboard.press("Tab");
    expect(await focusedName(page)).toMatch(/^Set di acquerelli con pennelli/);
    // The sheet.
    const opener = giveButtons(page).first();
    await opener.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await waitForAnimationsToEnd(page);
    await expect(dialog.getByLabel("Come ti chiami?")).toBeFocused();
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("Tab");
      const inside = await page.evaluate(() => {
        const d = document.querySelector('[role="dialog"]');
        return !!d && d.contains(document.activeElement);
      });
      expect(inside, `Tab ${i + 1} resta nel foglio`).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test("aree di tocco a 390 px: pagina pubblica", async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "solo su mobile");
    await publicPage(page);
    const buttons = giveButtons(page);
    const count = await buttons.count();
    expect(count).toBe(4);
    for (let i = 0; i < count; i++) {
      await touchArea(buttons.nth(i), `Lo regalo io ${i + 1}`);
    }
    const links = page
      .getByRole("link", { name: /sito del negozio/ })
      .locator("visible=true");
    const linkCount = await links.count();
    expect(linkCount).toBeGreaterThan(0);
    for (let i = 0; i < linkCount; i++) {
      await touchArea(links.nth(i), `titolo-link ${i + 1}`);
    }
  });
});
