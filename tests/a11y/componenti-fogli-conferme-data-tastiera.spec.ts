import { expect, test, type Locator, type Page } from "@playwright/test";
import { waitForAnimationsToEnd } from "../fixtures/animations";
import { waitHydrated } from "../fixtures/esplora";

// #505 (F4c): keyboard, focus, touch targets, accessible names and reduced
// motion of sheets, the confirmation dialog and the month calendar, on the
// design-system gallery (no login). Axe is in
// `componenti-fogli-conferme-data.spec.ts`.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

const NOW = new Date("2026-11-18T09:00:00Z");
const tid = (page: Page, id: string) => page.getByTestId(id);

async function open(page: Page, reducedMotion: "reduce" | "no-preference") {
  await page.emulateMedia({ reducedMotion });
  await page.clock.install({ time: NOW });
  await page.goto("/design-system");
  await waitHydrated(tid(page, "ds-data"));
}

/** True if every point of the inner area of the element hits it (or a child). */
async function hitsItself(locator: Locator, minSize = 44) {
  return locator.evaluate((el, min) => {
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let w = rect.width;
    let h = rect.height;
    // The touch area may be wider than the drawn box (a transparent ::before).
    const probe = (x: number, y: number) => {
      const hit = document.elementFromPoint(x, y);
      return !!hit && (el === hit || el.contains(hit));
    };
    const step = 2;
    let left = cx;
    while (probe(left - step, cy) && cx - left < 200) left -= step;
    let right = cx;
    while (probe(right + step, cy) && right - cx < 200) right += step;
    let top = cy;
    while (probe(cx, top - step) && cy - top < 200) top -= step;
    let bottom = cy;
    while (probe(cx, bottom + step) && bottom - cy < 200) bottom += step;
    w = Math.max(w, right - left);
    h = Math.max(h, bottom - top);
    return { width: w, height: h, ok: w >= min - 1 && h >= min - 1 };
  }, minSize);
}

async function expectTouchTarget(locator: Locator, label: string) {
  await locator.scrollIntoViewIfNeeded();
  const result = await hitsItself(locator);
  const drawn = (await locator.boundingBox())!;
  expect(
    result.ok,
    `${label}: area di tocco ${result.width}×${result.height} px, disegnato ${drawn.width}×${drawn.height} px`,
  ).toBe(true);
}

async function expectVisibleFocus(locator: Locator, label: string) {
  await expect(locator, `${label} ha il fuoco`).toBeFocused();
  const visible = await locator.evaluate((el) => {
    const style = getComputedStyle(el);
    const outline =
      style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0;
    const shadow = style.boxShadow !== "none";
    const parent = el.closest(":focus-within");
    const parentStyle = parent ? getComputedStyle(parent) : null;
    const inside =
      !!parentStyle &&
      (parentStyle.boxShadow !== "none" ||
        (parentStyle.outlineStyle !== "none" &&
          parseFloat(parentStyle.outlineWidth) > 0));
    return outline || shadow || inside;
  });
  expect(visible, `${label}: anello del fuoco visibile`).toBe(true);
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
]) {
  test.describe(`${viewport.width} px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(viewport);
      await open(page, "no-preference");
    });

    test("foglio con il piede: nomi, tocco, fuoco intrappolato e restituito", async ({
      page,
    }) => {
      const opener = tid(page, "ds-foglio-piede").getByRole("button", {
        name: "Apri Nuova scadenza",
      });
      await opener.click();
      const dialog = page.getByRole("dialog", { name: "Nuova scadenza" });
      await expect(dialog).toBeVisible();
      await waitForAnimationsToEnd(page);
      await expect(dialog).toHaveAttribute("aria-modal", "true");

      const close = dialog.getByRole("button", { name: "Chiudi" });
      await expectTouchTarget(close, "X «Chiudi»");
      // The X is at the left of the header title.
      const closeBox = (await close.boundingBox())!;
      const titleBox = (await dialog
        .getByRole("heading", { name: "Nuova scadenza" })
        .boundingBox())!;
      expect(closeBox.x).toBeLessThan(titleBox.x);

      for (const name of ["Annulla", "Aggiungi"]) {
        await expectTouchTarget(
          dialog.getByRole("button", { name, exact: true }),
          `«${name}»`,
        );
      }

      // Tab goes round inside the sheet and shows the ring on each stop.
      let first: string | null = null;
      let wrapped = false;
      for (let i = 0; i < 30 && !wrapped; i += 1) {
        await page.keyboard.press("Tab");
        const state = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          const dlg = document.querySelector('[role="dialog"]');
          return {
            inside: !!el && !!dlg && dlg.contains(el),
            id: el
              ? `${el.tagName}|${el.getAttribute("aria-label") ?? el.textContent?.trim().slice(0, 30)}`
              : "",
          };
        });
        expect(state.inside, `Tab ${i + 1} resta nel foglio`).toBe(true);
        if (first === null) first = state.id;
        else if (state.id === first) wrapped = true;
      }
      expect(wrapped, "il fuoco gira dentro il foglio").toBe(true);

      await page.keyboard.press("Tab");
      await expectVisibleFocus(
        page.locator(":focus"),
        "elemento con il fuoco nel foglio",
      );

      await page.keyboard.press("Shift+Tab");
      expect(
        await dialog.evaluate((el) => el.contains(document.activeElement)),
      ).toBe(true);

      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(opener).toBeFocused();
    });

    test("dialogo di conferma: nomi, tocco, fuoco intrappolato, Esc e ritorno", async ({
      page,
    }) => {
      const opener = tid(page, "ds-conferma").getByRole("button", {
        name: "Togli Biscotto",
      });
      await opener.click();
      const dialog = page.getByRole("alertdialog", {
        name: "Togliere Biscotto dal Nest?",
      });
      await expect(dialog).toBeVisible();
      await waitForAnimationsToEnd(page);
      await expect(dialog).toHaveAttribute("aria-modal", "true");
      const cancel = dialog.getByRole("button", { name: "Annulla" });
      const remove = dialog.getByRole("button", { name: "Togli dal Nest" });
      await expectTouchTarget(cancel, "«Annulla»");
      await expectTouchTarget(remove, "«Togli dal Nest»");
      await expectVisibleFocus(cancel, "«Annulla» (fuoco iniziale)");

      for (let i = 0; i < 6; i += 1) {
        await page.keyboard.press("Tab");
        expect(
          await dialog.evaluate((el) => el.contains(document.activeElement)),
          `Tab ${i + 1}`,
        ).toBe(true);
      }
      await page.keyboard.press("Shift+Tab");
      expect(
        await dialog.evaluate((el) => el.contains(document.activeElement)),
      ).toBe(true);
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(opener).toBeFocused();
    });

    test("calendario del mese: nomi, tocco, tastiera e «Togli la data»", async ({
      page,
    }) => {
      const field = tid(page, "ds-data-facoltativa").getByRole("button", {
        name: /^Data di nascita/,
      });
      await expect(field).toBeVisible();
      await expectTouchTarget(field, "campo «Data di nascita»");
      await field.click();
      const grid = page.getByRole("grid");
      await expect(grid).toBeVisible();
      await waitForAnimationsToEnd(page);
      await expect(grid).toHaveAccessibleName(/\d{4}$/);

      for (const name of ["Mese precedente", "Mese successivo"]) {
        const arrow = page
          .locator(".calendario-scelta")
          .getByRole("button", { name, exact: true });
        await expect(arrow).toHaveCount(1);
        await expectTouchTarget(arrow, `«${name}»`);
      }
      const cells = await grid.getByRole("gridcell").all();
      expect(cells.length).toBeGreaterThanOrEqual(28);
      for (const cell of cells.slice(0, 7)) {
        await expectTouchTarget(cell, "giorno del mese");
      }

      const clear = page.getByTestId("calendario-togli");
      await expect(clear).toHaveAccessibleName("Togli la data");
      await expectTouchTarget(clear, "«Togli la data»");

      // Keyboard: the arrow keys move the focus inside the grid.
      const before = await page.evaluate(
        () => document.activeElement?.getAttribute("data-day") ?? "",
      );
      expect(before).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      await page.keyboard.press("ArrowRight");
      const after = await page.evaluate(
        () => document.activeElement?.getAttribute("data-day") ?? "",
      );
      expect(after).not.toBe(before);
      await expectVisibleFocus(page.locator(":focus"), "giorno con il fuoco");

      // Tab reaches «Togli la data», Shift+Tab goes back; there is no trap
      // other than the sheet/box itself, and Esc gives the focus back.
      let reached = false;
      for (let i = 0; i < 12 && !reached; i += 1) {
        await page.keyboard.press("Tab");
        reached = await clear.evaluate((el) => el === document.activeElement);
      }
      expect(reached, "Tab raggiunge «Togli la data»").toBe(true);
      await expectVisibleFocus(clear, "«Togli la data»");
      await page.keyboard.press("Escape");
      await expect(grid).toBeHidden();
      await expect(field).toBeFocused();
    });
  });
}

test.describe("movimento ridotto", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, "reduce");
  });

  test("foglio e dialogo: solo dissolvenza, al massimo 200 ms, nessun transform", async ({
    page,
  }) => {
    for (const [wrapper, name, role] of [
      ["ds-foglio-piede", "Apri Nuova scadenza", "dialog"],
      ["ds-conferma", "Togli Biscotto", "alertdialog"],
    ] as const) {
      await tid(page, wrapper).getByRole("button", { name }).click();
      const dialog = page.getByRole(role).first();
      await expect(dialog).toBeVisible();
      const animations = await page.evaluate(() =>
        document
          .getAnimations()
          .filter((a) => a.effect?.getComputedTiming().endTime !== Infinity)
          .map((a) => ({
            duration: Number(a.effect?.getComputedTiming().endTime ?? 0),
            props: (a.effect as KeyframeEffect)
              .getKeyframes()
              .flatMap((k) => Object.keys(k))
              .filter(
                (p) =>
                  !["offset", "easing", "composite", "computedOffset"].includes(
                    p,
                  ),
              ),
          })),
      );
      for (const a of animations) {
        expect(a.duration, `${name}: durata`).toBeLessThanOrEqual(200);
        expect(a.props, `${name}: proprietà animate`).not.toContain(
          "transform",
        );
        expect(a.props, `${name}: proprietà animate`).not.toContain(
          "translate",
        );
      }
      await waitForAnimationsToEnd(page);
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
    }
  });
});
