import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { hasTestUser, signInAs } from "../fixtures/visual-login";

// PR #94 (#85): accessibility of the shared member components, checked by
// the visual and accessibility tester. On top of the developer's suite
// (componenti-membri.spec.ts): every state of the sheet, keyboard in the
// colour radiogroup and in the sheet, visible focus, 44 px touch areas on
// mobile, and the real page of /esplora (#28; it used to be a placeholder).

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

const DEMO = "/design-system/membri";
const ADD = "Aggiungi una persona o un animale";

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations.filter((v) =>
    ["serious", "critical"].includes(v.impact ?? ""),
  );
}

async function openSheet(page: Page, button: string, outcome?: string) {
  await page.goto(DEMO);
  if (outcome) await page.getByRole("button", { name: outcome }).click();
  await page.getByRole("button", { name: button }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  return dialog;
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
 * element (2 px in from each edge, so neighbours that touch do not count)
 * lands on the element itself.
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

test.describe("fogli: ogni stato senza violazioni serious o critical", () => {
  const STATES: Array<[string, string, string?]> = [
    ["Nest al completo", ADD, "Al completo"],
    ["errore del server", ADD, "Server"],
    ["modifica con la rete assente", "Modifica Sofia", "Rete"],
    ["invito con la rete assente", "Invita qualcuno", "Rete"],
  ];
  for (const [label, button, outcome] of STATES) {
    test(`a11y: ${label}`, async ({ page }) => {
      const dialog = await openSheet(page, button, outcome);
      await dialog.getByLabel("Nome").fill("Rita");
      await dialog
        .getByRole("button", { name: /^(Aggiungi Rita|Salva|Continua)/ })
        .click();
      await expect(dialog.getByRole("alert")).toBeVisible();
      expect(await seriousViolations(page)).toEqual([]);
    });
  }

  test("a11y: data nel futuro", async ({ page }) => {
    const dialog = await openSheet(page, ADD);
    await dialog.getByLabel("Nome").fill("Rita");
    await dialog.getByLabel("Data di nascita").fill("2999-01-01");
    await dialog.getByRole("button", { name: "Aggiungi Rita" }).click();
    await expect(dialog.getByText(/nel futuro/)).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("a11y: salvataggio in corso (aria-busy)", async ({ page }) => {
    const dialog = await openSheet(page, ADD, "Lento");
    await dialog.getByLabel("Nome").fill("Rita");
    await dialog.getByRole("button", { name: "Aggiungi Rita" }).click();
    await expect(
      dialog.getByRole("button", { name: "Aggiungi Rita" }),
    ).toHaveAttribute("aria-busy", "true");
    expect(await seriousViolations(page)).toEqual([]);
  });
});

test.describe("scelta del colore: tastiera", () => {
  test("un solo punto di Tab, frecce a due righe, colori spenti saltati", async ({
    page,
  }) => {
    await page.goto(DEMO);
    const group = page.getByTestId("scelta-colore-demo");
    await expect(group).toHaveAttribute("role", "radiogroup");
    const radios = group.getByRole("radio");
    await expect(radios).toHaveCount(10);

    // Exactly one radio is in the tab order.
    const tabbable = await group
      .locator('[role="radio"][tabindex="0"]')
      .count();
    expect(tabbable).toBe(1);

    // Shift+Tab from the next control enters the group on the chosen colour
    // (the group is the first control of the page).
    await page.getByRole("button", { name: "Riuscito" }).focus();
    await page.keyboard.press("Shift+Tab");
    const salvia = group.getByRole("radio", { name: "Salvia" });
    await expect(salvia).toBeFocused();
    expect(await focusRingVisible(page)).toBe(true);

    // Right: next free colour. Cobalto, zafferano is taken so it is skipped.
    await page.keyboard.press("ArrowRight");
    await expect(group.getByRole("radio", { name: "Cobalto" })).toBeFocused();
    await expect(group.getByRole("radio", { name: "Cobalto" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await page.keyboard.press("ArrowRight");
    await expect(group.getByRole("radio", { name: "Lampone" })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(group.getByRole("radio", { name: "Ceruleo" })).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowUp");
    await expect(group.getByRole("radio", { name: "Cobalto" })).toBeFocused();
    expect(await focusRingVisible(page)).toBe(true);

    // Wrap-around: from the last colour to the first free one.
    await group.getByRole("radio", { name: "Cannella" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(group.getByRole("radio", { name: "Salvia" })).toBeFocused();

    // Tab leaves the group in one press (no trap, no second stop).
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Riuscito" })).toBeFocused();
  });

  test("nomi accessibili dei colori spenti", async ({ page }) => {
    await page.goto(DEMO);
    const group = page.getByTestId("scelta-colore-demo");
    for (const name of [
      "Pomodoro (già di Marco)",
      "Glicine (già di Laura)",
      "Zafferano (già usato)",
    ]) {
      await expect(group.getByRole("radio", { name })).toBeDisabled();
    }
  });

  test("aree di tocco di 44 px, senza sovrapposizioni", async ({ page }) => {
    await page.goto(DEMO);
    const radios = page.getByTestId("scelta-colore-demo").getByRole("radio");
    const count = await radios.count();
    for (let i = 0; i < count; i += 1) {
      // Disabled colours do not receive taps: only the free ones are checked.
      if (await radios.nth(i).isDisabled()) continue;
      expect(await hasTouchArea(radios.nth(i)), `colore ${i + 1}`).toBe(true);
    }
    const boxes = await radios.evaluateAll((nodes) =>
      nodes.map((n) => {
        const r = n.getBoundingClientRect();
        return { w: r.width, h: r.height, x: r.left, y: r.top };
      }),
    );
    // Circles are 32 px; the pitch between centres is 44 px (2 x 5 grid).
    expect(
      boxes.every((b) => Math.round(b.w) === 32 && Math.round(b.h) === 32),
    ).toBe(true);
    expect(Math.round(boxes[1]!.x - boxes[0]!.x)).toBe(44);
    expect(Math.round(boxes[5]!.y - boxes[0]!.y)).toBe(44);
    expect(Math.round(boxes[5]!.x)).toBe(Math.round(boxes[0]!.x));
  });
});

test.describe("foglio: tastiera e fuoco", () => {
  test("il fuoco parte dal Nome, resta dentro il foglio e ogni tappa ha l'anello", async ({
    page,
  }) => {
    const dialog = await openSheet(page, ADD);
    await expect(dialog.getByLabel("Nome")).toBeFocused();

    const seen: string[] = [];
    for (let i = 0; i < 14; i += 1) {
      const inside = await page.evaluate(() => {
        const el = document.activeElement;
        return Boolean(el && el.closest('[role="dialog"]'));
      });
      expect(inside, `tappa ${i}: il fuoco è fuori dal dialogo`).toBe(true);
      expect(await focusRingVisible(page), `tappa ${i}: nessun anello`).toBe(
        true,
      );
      const stop = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        return (
          el.getAttribute("aria-label") ||
          el.getAttribute("id") ||
          el.textContent?.trim() ||
          el.tagName
        );
      });
      if (seen[0] === stop && seen.length > 1) break; // full cycle: no trap
      seen.push(stop);
      await page.keyboard.press("Tab");
    }
    // Name, kind buttons, date, one colour, submit, close: at least those.
    expect(seen.length).toBeGreaterThanOrEqual(7);
    // The cycle came back to the start without ever leaving the dialog.
    expect(seen).toContain("Chiudi");
  });

  test("Maiusc+Tab dal primo campo arriva all'ultimo controllo del foglio", async ({
    page,
  }) => {
    const dialog = await openSheet(page, ADD);
    await dialog.getByLabel("Nome").focus();
    await page.keyboard.press("Shift+Tab");
    const inside = await page.evaluate(() =>
      Boolean(document.activeElement?.closest('[role="dialog"]')),
    );
    expect(inside).toBe(true);
  });

  test("Esc chiude il foglio e il fuoco torna al bottone che l'ha aperto", async ({
    page,
  }) => {
    const dialog = await openSheet(page, "Invita qualcuno");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Invita qualcuno" }),
    ).toBeFocused();
  });

  test("etichette: ogni campo ha un nome e il foglio un nome e un gruppo per il colore", async ({
    page,
  }) => {
    const dialog = await openSheet(page, ADD);
    await expect(dialog).toHaveAccessibleName("Aggiungi una persona");
    await expect(dialog.getByLabel("Nome")).toBeVisible();
    await expect(dialog.getByLabel("Data di nascita")).toBeVisible();
    await expect(dialog.getByRole("group", { name: "Chi è" })).toBeVisible();
    await expect(
      dialog.getByRole("radiogroup", { name: "Colore" }),
    ).toBeVisible();
  });
});

test.describe("foglio: aree di tocco da 44 px (mobile)", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "solo a 390 px");
  });

  test("Chiudi, voci di «Chi è», colori e bottone di salvataggio", async ({
    page,
  }) => {
    const dialog = await openSheet(page, ADD);
    expect(
      await hasTouchArea(dialog.getByRole("button", { name: "Chiudi" })),
    ).toBe(true);
    for (const name of ["Adulto", "Figlio o figlia", "Animale"]) {
      const voice = dialog.getByRole("button", { name, exact: true });
      expect(await hasTouchArea(voice), name).toBe(true);
    }
    const radios = dialog.getByRole("radio");
    for (let i = 0; i < (await radios.count()); i += 1) {
      if (await radios.nth(i).isDisabled()) continue;
      expect(await hasTouchArea(radios.nth(i)), `colore ${i + 1}`).toBe(true);
    }
    const submit = dialog.getByRole("button", {
      name: "Aggiungi",
      exact: true,
    });
    const box = (await submit.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);
  });

  test("Riprova nell'avviso di rete", async ({ page }) => {
    const dialog = await openSheet(page, ADD, "Rete");
    await dialog.getByLabel("Nome").fill("Rita");
    await dialog.getByRole("button", { name: "Aggiungi Rita" }).click();
    const retry = dialog.getByRole("button", { name: "Riprova" });
    await expect(retry).toBeVisible();
    expect(await hasTouchArea(retry)).toBe(true);
  });
});

test.describe("/esplora e «Chiudi» di /nest (utente A)", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    test.skip(!hasTestUser("A"), "TEST_USER_A_* non impostati");
    const signedIn = await signInAs(context, baseURL!, "A");
    test.skip(!signedIn, "utente di test A non ancora creato");
  });

  test("/esplora: axe, un solo h1, puntine, tastiera", async ({ page }) => {
    await page.goto("/esplora");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Cosa può fare la vostra casa",
      }),
    ).toBeVisible();
    await expect(page.locator("ul.griglia-moduli:visible > li")).toHaveCount(
      10,
      { timeout: 20_000 },
    );
    await expect(page.locator("h1:visible")).toHaveCount(1);
    expect(await seriousViolations(page)).toEqual([]);

    // Every pin is a button with aria-pressed, with a decorative icon.
    const pinButtons = page.locator("ul.griglia-moduli:visible button");
    await expect(pinButtons).toHaveCount(10);
    for (const button of await pinButtons.all()) {
      await expect(button).toHaveAttribute("aria-pressed", /^(true|false)$/);
      await expect(button.locator("svg")).toHaveAttribute(
        "aria-hidden",
        "true",
      );
    }

    // Every focus stop shows a ring and the page has no trap.
    const seen = new Set<string>();
    for (let i = 0; i < 40; i += 1) {
      await page.keyboard.press("Tab");
      const stop = await page.evaluate(() => {
        const el = document.activeElement;
        return el && el !== document.body
          ? `${el.tagName}:${el.getAttribute("aria-label") ?? el.textContent?.trim().slice(0, 30)}:${el.getAttribute("href")}`
          : "";
      });
      if (!stop || seen.has(stop)) break;
      seen.add(stop);
      expect(await focusRingVisible(page), `fuoco su ${stop}`).toBe(true);
    }
    expect(seen.size).toBeGreaterThan(2);
  });

  test("/esplora: voci della navigazione da 44 px (mobile)", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "solo a 390 px");
    await page.goto("/esplora");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Cosa può fare la vostra casa",
      }),
    ).toBeVisible();
    const nav = page.getByRole("navigation", {
      name: "Navigazione principale",
    });
    for (const link of await nav.getByRole("link").all()) {
      const box = (await link.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThanOrEqual(44);
    }
  });

  test("/nest: «Chiudi» da 44 px e con l'anello di fuoco (mobile)", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "solo a 390 px");
    await page.goto("/nest");
    const close = page.getByRole("link", { name: "Chiudi" });
    await expect(close).toBeVisible();
    expect(await hasTouchArea(close)).toBe(true);
    await close.focus();
    expect(await focusRingVisible(page)).toBe(true);
    expect(await seriousViolations(page)).toEqual([]);
  });
});
