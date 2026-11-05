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
  answerProfileReads,
  childNest,
  editButton,
  editDialog,
  openChild,
  provokeErrors,
} from "../fixtures/figlio-visuale";

// PR #245 (#31): axe on every state of /figli/<id> (normal, empty, loading,
// page error, offline, the edit sheet with and without errors, the toast), plus
// the keyboard: order of the focus, visible ring, no trap in the sheet, Esc and
// return of the focus, and the 44 px touch areas at 390 px.
// Known and not tested here: the pencil of the bar has no aria-haspopup (#236).

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

/** What a screen reader reads for the focused element, spaces folded. */
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

/**
 * Length, in px, of the line through the centre of the element that hits the
 * element, horizontally and vertically. An area made with a `::before` counts
 * (`getBoundingClientRect` would not see it).
 */
async function touchSpans(target: Locator) {
  await target.evaluate((el) =>
    el.scrollIntoView({ block: "center", inline: "center" }),
  );
  return target.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const hits = (x: number, y: number) => {
      const hit = document.elementFromPoint(x, y);
      return !!hit && el.contains(hit);
    };
    const span = (horizontal: boolean) => {
      let first = Infinity;
      let last = -Infinity;
      const from = Math.floor(horizontal ? rect.left : rect.top) - 40;
      const to = Math.ceil(horizontal ? rect.right : rect.bottom) + 40;
      for (let v = from; v <= to; v++) {
        if (horizontal ? hits(v, cy) : hits(cx, v)) {
          first = Math.min(first, v);
          last = Math.max(last, v);
        }
      }
      return last >= first ? last - first + 1 : 0;
    };
    return { width: span(true), height: span(false) };
  });
}

test.describe("con un utente usa e getta", () => {
  test.skip(!throwawayConfigured(), throwawaySkipReason);

  let user: ThrowawayUser | null = null;
  test.afterEach(async () => {
    await user?.remove();
    user = null;
  });

  test("#31: normale, un solo h1, titoli, nomi accessibili", async ({
    page,
  }, info) => {
    const nest = await childNest(page, "complete");
    user = nest.user;
    await openChild(page, nest.childId);
    await expect(page.locator("h1:visible")).toHaveCount(1);
    await expect(page.locator("main")).toHaveCount(1);
    for (const name of ["Questa settimana", "Scuola", "Taglie"]) {
      await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
    }
    await expect(
      page.getByRole("link", {
        name: /^14 giorni alla scadenza\s*: «Rinnovo carta d'identità di Sofia»\s*, urgente$/,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /^Maestra Bianchi .*\s*, chiama$/ }),
    ).toHaveAttribute("href", "tel:+390392345678");
    await expect(
      page.getByRole("link", { name: /^Gio Nuoto .*Giovedì alle 17:00/ }),
    ).toBeVisible();
    // No health section (D1).
    await expect(page.getByText("Salute")).toHaveCount(0);
    if (info.project.name === "desktop") {
      // Starts with the visible text (WCAG 2.5.3) and announces the dialog.
      const button = editButton(page);
      await expect(button).toHaveText(/^Modifica il profilo/);
      await expect(button).toHaveAttribute("aria-haspopup", "dialog");
    }
    await axe(page);
  });

  test("#31: vuoto, azioni che aprono il modulo", async ({ page }) => {
    const nest = await childNest(page, "empty");
    user = nest.user;
    await openChild(page, nest.childId);
    for (const name of ["Aggiungi la scuola", "Aggiungi le taglie"]) {
      await expect(page.getByRole("button", { name })).toHaveAttribute(
        "aria-haspopup",
        "dialog",
      );
    }
    await axe(page);
    await page.getByRole("button", { name: "Aggiungi le taglie" }).click();
    await expect(editDialog(page)).toBeVisible();
    await waitForAnimationsToEnd(page);
    await expect(editDialog(page).getByLabel("Scarpe")).toBeFocused();
  });

  test("#31: caricamento", async ({ page }) => {
    const nest = await childNest(page, "complete");
    user = nest.user;
    let release: () => void = () => {};
    const hold = new Promise<void>((resolve) => (release = resolve));
    await answerProfileReads(page, { hold });
    try {
      const asked = page.waitForRequest(
        (r) =>
          /\/rest\/v1\/child_profiles/.test(r.url()) && r.method() === "GET",
      );
      await page.goto(`/figli/${nest.childId}`);
      await asked;
      await expect(page.getByText("Caricamento in corso")).toBeAttached();
      await expect(page.locator('[aria-busy="true"]').first()).toBeAttached();
      await axe(page);
    } finally {
      release();
    }
    await expect(
      page.getByRole("heading", { level: 1, name: "Sofia" }),
    ).toBeVisible();
  });

  test("#31: errore della pagina, «Riprova» e «Torna a Oggi»", async ({
    page,
  }) => {
    const nest = await childNest(page, "complete");
    user = nest.user;
    await answerProfileReads(page, "error");
    await page.goto(`/figli/${nest.childId}`);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Questa pagina non si è caricata",
      }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Riprova" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Torna a Oggi" }),
    ).toBeVisible();
    // No pencil while the page is in error.
    await expect(editButton(page)).toHaveCount(0);
    await axe(page);
  });

  test("#31: offline, l'avviso si annuncia", async ({ page }) => {
    const nest = await childNest(page, "complete");
    user = nest.user;
    await openChild(page, nest.childId);
    await page.context().setOffline(true);
    const notice = page
      .locator('[role="alert"]:not(#__next-route-announcer__)')
      .filter({ hasText: "Sei offline" });
    await expect(notice).toBeVisible();
    await expect(notice.getByRole("button", { name: "Riprova" })).toBeVisible();
    await axe(page);
  });

  test("#31: modulo, axe, fuoco intrappolato, Esc e ritorno del fuoco", async ({
    page,
  }) => {
    const nest = await childNest(page, "complete");
    user = nest.user;
    await openChild(page, nest.childId);
    const trigger = editButton(page);
    await trigger.click();
    await expect(editDialog(page)).toBeVisible();
    await waitForAnimationsToEnd(page);
    await expect(
      editDialog(page).getByLabel("Nome", { exact: true }),
    ).toBeFocused();
    await axe(page);
    // Forty Tab presses go round the whole form and the focus never leaves it.
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press("Tab");
      expect(
        await page.evaluate(
          () => !!document.activeElement?.closest('[role="dialog"]'),
        ),
      ).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(editDialog(page)).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("#31: modulo con errori, axe e fuoco sul primo campo sbagliato", async ({
    page,
  }) => {
    const nest = await childNest(page, "complete");
    user = nest.user;
    await openChild(page, nest.childId);
    await editButton(page).click();
    await expect(editDialog(page)).toBeVisible();
    await waitForAnimationsToEnd(page);
    await provokeErrors(page);
    const name = editDialog(page).getByLabel("Nome", { exact: true });
    await expect(name).toHaveAttribute("aria-invalid", "true");
    await expect(name).toBeFocused();
    for (const text of [
      "L'uscita deve essere dopo l'entrata.",
      "Scrivi il nome della maestra.",
      "Scrivi solo numeri, spazi e il + all'inizio.",
    ]) {
      await expect(editDialog(page).getByText(text)).toBeAttached();
    }
    await axe(page);
  });

  test("#31: toast «Modifiche salvate», axe", async ({ page }) => {
    const nest = await childNest(page, "complete");
    user = nest.user;
    await openChild(page, nest.childId);
    await editButton(page).click();
    await expect(editDialog(page)).toBeVisible();
    await waitForAnimationsToEnd(page);
    await editDialog(page).getByLabel("Classe").fill("5ª A");
    await editDialog(page)
      .getByRole("button", { name: "Salva le modifiche" })
      .click();
    await expect(editDialog(page)).toHaveCount(0);
    await expect(
      page.getByRole("status").filter({ hasText: "Modifiche salvate" }),
    ).toBeVisible();
    await waitForAnimationsToEnd(page);
    await axe(page);
  });

  test("#31: tastiera, ordine del fuoco e anello visibile", async ({
    page,
  }, info) => {
    const nest = await childNest(page, "complete");
    user = nest.user;
    await openChild(page, nest.childId);
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
    const names: string[] = [];
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press("Tab");
      const name = await focusedName(page);
      // The focus has gone through the whole page and left it: no trap.
      if (name === "") break;
      names.push(name);
      expect(await focusRingVisible(page), `anello su «${name}»`).toBe(true);
    }
    expect(names.length).toBeGreaterThan(8);
    expect(names.length).toBeLessThan(40);
    const expected: Array<string | RegExp> = [
      ...(info.project.name === "mobile"
        ? ["Indietro", "Modifica il profilo di Sofia"]
        : [/^Modifica il profilo di Sofia$/]),
      /giorni alla scadenza/,
      "Vedi nel calendario",
      /^Gio Nuoto/,
      /^Sab Festa di Giulia/,
      /^Maestra Bianchi/,
    ];
    let from = 0;
    for (const want of expected) {
      const at = names.findIndex(
        (n, i) =>
          i >= from && (typeof want === "string" ? n === want : want.test(n)),
      );
      expect(
        at,
        `«${String(want)}» dopo la posizione ${from} in ${JSON.stringify(names)}`,
      ).toBeGreaterThan(-1);
      from = at + 1;
    }
  });

  test("#31: aree di tocco di almeno 44 px (390 px)", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "mobile", "Solo a 390 px");
    const nest = await childNest(page, "complete");
    user = nest.user;
    await openChild(page, nest.childId);
    const targets: Record<string, Locator> = {
      Indietro: page.getByRole("link", { name: "Indietro" }),
      matita: editButton(page),
      "contatore scadenza": page.getByRole("link", {
        name: /giorni alla scadenza/,
      }),
      "Vedi nel calendario": page.getByRole("link", {
        name: "Vedi nel calendario",
      }),
      "riga Nuoto": page.getByRole("link", { name: /^Gio Nuoto/ }),
      "riga maestra": page.getByRole("link", { name: /^Maestra Bianchi/ }),
    };
    for (const [label, target] of Object.entries(targets)) {
      await expect(target, label).toBeVisible();
      const { width, height } = await touchSpans(target);
      expect(width, `${label}: larghezza`).toBeGreaterThanOrEqual(43);
      expect(height, `${label}: altezza`).toBeGreaterThanOrEqual(43);
    }
  });
});
