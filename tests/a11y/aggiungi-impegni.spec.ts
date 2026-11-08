import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  THURSDAY,
  installFakes,
  saveWithStoppedClock,
} from "../fixtures/aggiungi-fake";
import { hasTestUser } from "../fixtures/visual-login";
import { signInAsCached } from "../fixtures/visual-login-cached";

// Aggiungi · Impegni (#20, PR #172): accessibility of the Add sheet, in every
// state of the specification, at 390 and 1280 px (projects). Needs test user A
// (Marco, Casa D'Angelo); without TEST_USER_A_* the tests are skipped.
// The events of the day, the save and the people are served by fakes
// (fixtures/aggiungi-fake.ts): nothing is written to the database.
//
// - axe on the dialog (and on the toast), serious and critical violations;
// - the live region of the labels (a single one, always in the DOM);
// - the focus: order, trapped inside the sheet, ring visible;
// - touch areas of 44 px, checked with elementFromPoint (not boundingBox: the
//   area of the small controls is a transparent ::before, LEZIONI);
// - contrast of every text of the sheet, measured on the computed colors.

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

const NOW = new Date("2026-10-20T15:52:00+02:00");
const PHRASE = "Nuoto Sofia giovedì alle 17";
const EXAMPLE = "cena da Marta venerdì alle 20";

test.beforeEach(async ({ page, context, baseURL }) => {
  test.skip(!hasTestUser("A"), "TEST_USER_A_* non impostati");
  const signedIn = await signInAsCached(context, baseURL!, "A");
  test.skip(!signedIn, "utente di test A non ancora creato (#55)");
  await page.clock.install({ time: NOW });
});

/** Opens the sheet over Today and waits until the page took over (field focused). */
async function open(page: Page) {
  await page.goto("/aggiungi");
  const dialog = page.getByRole("dialog", { name: "Aggiungi" });
  await expect(dialog).toBeVisible({ timeout: 20_000 });
  const field = dialog.getByRole("textbox", { name: "Cosa vuoi aggiungere?" });
  await expect(field).toBeFocused();
  await page.evaluate(() => document.fonts.ready);
  return { dialog, field };
}

async function blocking(page: Page, selector: string) {
  const results = await new AxeBuilder({ page }).include(selector).analyze();
  return results.violations.filter((v) =>
    ["serious", "critical"].includes(v.impact ?? ""),
  );
}

/** Name of the element that has the focus, as a person would read it. */
function focused(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return "";
    const labels = (el as HTMLTextAreaElement).labels;
    return (
      el.getAttribute("aria-label") ??
      labels?.[0]?.textContent?.trim() ??
      (el.textContent ?? "").trim()
    );
  });
}

/**
 * The area of touch of a control: the points at the middle of the four sides of
 * a square of at least 44 px centered on it (and its center) must land on the
 * control or on something inside it. Returns the points that land elsewhere.
 */
async function missedPoints(control: Locator, min = 44) {
  // The sheet scrolls when the fields are many (#333): measure the control in view
  await control.scrollIntoViewIfNeeded();
  const box = await control.boundingBox();
  if (!box) throw new Error("the control is not visible");
  const w = Math.max(box.width, min);
  const h = Math.max(box.height, min);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const points = [
    [cx, cy],
    [cx, cy - h / 2 + 2],
    [cx, cy + h / 2 - 2],
    [cx - w / 2 + 2, cy],
    [cx + w / 2 - 2, cy],
  ];
  return control.evaluate((el, pts) => {
    const missed: string[] = [];
    for (const [x, y] of pts as number[][]) {
      const hit = document.elementFromPoint(x!, y!);
      if (!hit || !(el === hit || el.contains(hit))) {
        missed.push(
          `(${Math.round(x!)}, ${Math.round(y!)}) -> ${hit ? `${hit.tagName.toLowerCase()}.${String(hit.className)}` : "nothing"}`,
        );
      }
    }
    return missed;
  }, points);
}

test.describe("Aggiungi · Impegni: axe", () => {
  test("vuoto", async ({ page }) => {
    await installFakes(page);
    await open(page);
    expect(await blocking(page, '[role="dialog"]')).toEqual([]);
  });

  test("frase riconosciuta, anteprima e avviso «chi accompagna?»", async ({
    page,
  }) => {
    await installFakes(page, { events: THURSDAY });
    const { field } = await open(page);
    await field.pressSequentially(PHRASE);
    await expect(
      page.getByRole("status").filter({ hasText: "chi accompagna Sofia?" }),
    ).toHaveCount(1);
    expect(await blocking(page, '[role="dialog"]')).toEqual([]);
  });

  test("errore del campo", async ({ page }) => {
    await installFakes(page);
    const { field } = await open(page);
    await field.pressSequentially("giovedì");
    await field.press("Enter");
    await expect(field).toHaveAttribute("aria-invalid", "true");
    expect(await blocking(page, '[role="dialog"]')).toEqual([]);
  });

  test("salvataggio in corso", async ({ page }) => {
    await installFakes(page, { save: "hold" });
    const { dialog, field } = await open(page);
    await field.pressSequentially(PHRASE);
    const submit = dialog.getByRole("button", { name: "Metti in giovedì 22" });
    await submit.click();
    await expect(submit).toHaveAttribute("aria-busy", "true");
    expect(await blocking(page, '[role="dialog"]')).toEqual([]);
  });

  test("errore di salvataggio", async ({ page }) => {
    await installFakes(page, { save: "fail" });
    const { dialog, field } = await open(page);
    await field.pressSequentially(PHRASE);
    await dialog.getByRole("button", { name: "Metti in giovedì 22" }).click();
    await expect(dialog.getByRole("alert")).toBeVisible();
    expect(await blocking(page, '[role="dialog"]')).toEqual([]);
  });

  test("persone del Nest non lette", async ({ page }) => {
    await installFakes(page, { people: "fail" });
    const { dialog } = await open(page);
    await expect(dialog.getByRole("alert")).toBeVisible();
    expect(await blocking(page, '[role="dialog"]')).toEqual([]);
  });

  test("toast dopo il salvataggio", async ({ page }) => {
    await installFakes(page);
    const { dialog, field } = await open(page);
    await field.pressSequentially(PHRASE);
    const submit = dialog.getByRole("button", { name: "Metti in giovedì 22" });
    await saveWithStoppedClock(page, dialog, submit, NOW);
    const toast = page.locator(".toast");
    await expect(toast).toContainText("Messo in giovedì 22");
    expect(
      await missedPoints(toast.getByRole("button", { name: "Annulla" })),
    ).toEqual([]);
    // axe needs timers: the mouse over the toast keeps it (5 seconds), then time flows again
    await toast.hover();
    await page.clock.resume();
    expect(await blocking(page, ".toast")).toEqual([]);
  });
});

// #333: the chips of what was understood are gone (the values are in the fields);
// the one polite region is the sentence under «Chi lo vede».
test.describe("Aggiungi · Impegni: regione live", () => {
  test("una sola regione, sempre nel DOM: la frase sotto «Chi lo vede»", async ({
    page,
  }) => {
    await installFakes(page);
    const { dialog, field } = await open(page);
    const live = dialog.locator("[aria-live]");
    await expect(live).toHaveCount(1);
    await expect(live).toHaveAttribute("aria-live", "polite");
    await expect(live).not.toBeEmpty();
    const handle = await live.elementHandle();

    await field.pressSequentially(PHRASE);
    // The same element before and after: the announcement is not lost by a remount
    expect(await handle!.evaluate((el) => el.isConnected)).toBe(true);
    await expect(dialog.locator("[aria-live]")).toHaveCount(1);
    // The sentence is not a control, and describes the group of the three voices
    await expect(live.getByRole("button")).toHaveCount(0);
    await expect(
      dialog.getByRole("group", { name: "Chi lo vede", exact: true }),
    ).toHaveAccessibleDescription(/.+/);
  });

  test("l'avviso «chi accompagna?» è uno status, uno solo, e non è live per attributo", async ({
    page,
  }) => {
    await installFakes(page, { events: THURSDAY });
    const { dialog, field } = await open(page);
    await field.pressSequentially(PHRASE);
    const notice = page
      .getByRole("status")
      .filter({ hasText: "chi accompagna Sofia?" });
    await expect(notice).toHaveCount(1);
    await expect(notice).toHaveText(
      "Laura ha un impegno fino alle 17:15: chi accompagna Sofia?",
    );
    await expect(dialog.locator("[aria-live]")).toHaveCount(1);
  });
});

test.describe("Aggiungi · Impegni: fuoco", () => {
  for (const [name, phrase] of [
    ["campo vuoto", ""],
    ["con la frase", PHRASE],
  ] as const) {
    test(`intrappolato nel foglio con Tab e Maiusc+Tab (${name})`, async ({
      page,
    }) => {
      await installFakes(page, { events: THURSDAY });
      const { dialog, field } = await open(page);
      if (phrase) await field.pressSequentially(phrase);
      const inside = () =>
        dialog.evaluate((el) => el.contains(document.activeElement));
      for (let i = 0; i < 10; i += 1) {
        await page.keyboard.press("Tab");
        expect(await inside()).toBe(true);
      }
      for (let i = 0; i < 10; i += 1) {
        await page.keyboard.press("Shift+Tab");
        expect(await inside()).toBe(true);
      }
    });
  }

  /**
   * The names of the stops of the Tab from «Chiudi» until the focus wraps back
   * to it. The native date and time fields have one stop per part: same name in
   * a row, counted once.
   */
  async function tabStops(page: Page): Promise<string[]> {
    await page.keyboard.press("Shift+Tab");
    const order = [await focused(page)];
    for (let i = 0; i < 40; i += 1) {
      await page.keyboard.press("Tab");
      const name = await focused(page);
      if (name === "Chiudi") break;
      order.push(name);
    }
    return order.filter((name, i) => name !== order[i - 1]);
  }

  // #333: no examples. The fields come right after the types: «Giorno», «Dalle»,
  // «Alle», the people of «Chi» (their names start with the initial of the avatar)
  // and the three voices of «Chi lo vede».
  test("ordine con il campo vuoto: Chiudi, campo, i quattro tipi, i campi dell'impegno; l'invio spento si salta", async ({
    page,
  }) => {
    await installFakes(page);
    await open(page);
    const stops = await tabStops(page);
    expect(stops.slice(0, 9)).toEqual([
      "Chiudi",
      "Cosa vuoi aggiungere?",
      "Impegno",
      "Da fare",
      "Spesa",
      "Scadenza",
      "Giorno",
      "Dalle",
      "Alle",
    ]);
    expect(stops.slice(-3)).toEqual(["Solo io", "Occupato", "Tutti"]);
    // Between the times and the voices: the chips of the people
    expect(stops.length).toBeGreaterThanOrEqual(9 + 2 + 3);
    expect(stops).not.toContain(EXAMPLE);
    expect(stops).not.toContain("latte e pane");
  });

  test("ordine con la frase: i campi, «Più dettagli» o «Tutti i dettagli» e l'invio; l'avviso non prende il fuoco", async ({
    page,
  }) => {
    await installFakes(page, { events: THURSDAY });
    const { field } = await open(page);
    await field.pressSequentially(PHRASE);
    await expect(
      page.getByRole("status").filter({ hasText: "chi accompagna Sofia?" }),
    ).toHaveCount(1);
    const stops = await tabStops(page);
    expect(stops.slice(0, 9)).toEqual([
      "Chiudi",
      "Cosa vuoi aggiungere?",
      "Impegno",
      "Da fare",
      "Spesa",
      "Scadenza",
      "Giorno",
      "Dalle",
      "Alle",
    ]);
    // #333: the only entry to the full form comes before the button
    expect(stops.slice(-5, -2)).toEqual(["Solo io", "Occupato", "Tutti"]);
    expect(stops.at(-2)).toMatch(/^(Più|Tutti i) dettagli$/);
    expect(stops.at(-1)).toBe("Metti in giovedì 22");
  });

  test("l'anello del fuoco si vede su Chiudi, Impegno, una voce della visibilità, invio e campo", async ({
    page,
  }) => {
    await installFakes(page);
    const { dialog, field } = await open(page);
    const ring = (target: Locator) =>
      target.evaluate((el) => {
        const style = getComputedStyle(el);
        return {
          outline:
            style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0,
          shadow: style.boxShadow !== "none",
        };
      });
    // The field has its own ring (inset box-shadow, outline none), as in the mockup
    expect((await ring(field)).shadow).toBe(true);
    await page.keyboard.press("Shift+Tab");
    await expect(dialog.getByRole("button", { name: "Chiudi" })).toBeFocused();
    expect(
      (await ring(dialog.getByRole("button", { name: "Chiudi" }))).outline,
    ).toBe(true);
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    const type = dialog.getByRole("button", { name: "Impegno" });
    await expect(type).toBeFocused();
    expect((await ring(type)).outline).toBe(true);
    // A voice of «Chi lo vede», reached with the keyboard
    const voice = dialog.getByRole("button", { name: "Occupato", exact: true });
    for (let i = 0; i < 40; i += 1) {
      await page.keyboard.press("Tab");
      if (await voice.evaluate((el) => el === document.activeElement)) break;
    }
    await expect(voice).toBeFocused();
    expect((await ring(voice)).outline).toBe(true);
    // With a phrase: the submit button, the last stop before the start
    await field.fill("cena da Marta venerdì alle 20");
    const submit = dialog.getByRole("button", { name: "Metti in venerdì 23" });
    await expect(submit).toBeEnabled();
    await submit.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(submit).toBeFocused();
    expect((await ring(submit)).outline).toBe(true);
  });
});

test.describe("Aggiungi · Impegni: aree di tocco", () => {
  test("Chiudi, Impegno e le voci della visibilità hanno 44 px di area (campo vuoto)", async ({
    page,
  }) => {
    await installFakes(page);
    const { dialog } = await open(page);
    expect(
      await missedPoints(dialog.getByRole("button", { name: "Chiudi" })),
    ).toEqual([]);
    expect(
      await missedPoints(dialog.getByRole("button", { name: "Impegno" })),
    ).toEqual([]);
    for (const name of ["Solo io", "Occupato", "Tutti"]) {
      expect(
        await missedPoints(dialog.getByRole("button", { name, exact: true })),
        name,
      ).toEqual([]);
    }
  });

  test("il bottone d'invio ha 44 px di area e altezza", async ({ page }) => {
    await installFakes(page);
    const { dialog, field } = await open(page);
    await field.pressSequentially(PHRASE);
    const submit = dialog.getByRole("button", { name: "Metti in giovedì 22" });
    const box = await submit.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(await missedPoints(submit)).toEqual([]);
  });

  test("«Riprova» delle persone non lette ha 44 px di area", async ({
    page,
  }) => {
    await installFakes(page, { people: "fail" });
    const { dialog } = await open(page);
    const retry = dialog.getByRole("button", { name: "Riprova" });
    await expect(retry).toBeVisible();
    expect(await missedPoints(retry)).toEqual([]);
  });

  test("le aree di Chiudi e di Impegno non si sovrappongono ad altri controlli vicini", async ({
    page,
  }) => {
    await installFakes(page);
    const { dialog } = await open(page);
    const close = await dialog
      .getByRole("button", { name: "Chiudi" })
      .boundingBox();
    const field = await dialog
      .getByRole("textbox", { name: "Cosa vuoi aggiungere?" })
      .boundingBox();
    // The area of the X (44 px centered) ends above the field
    expect(close!.y + close!.height / 2 + 22).toBeLessThanOrEqual(field!.y + 1);
  });
});

test.describe("Aggiungi · Impegni: contrasto", () => {
  /** Measures every text of the sheet (and the toast) against its background. */
  async function failing(page: Page) {
    return page.evaluate(() => {
      type Rgba = { r: number; g: number; b: number; a: number };
      const parse = (value: string): Rgba | null => {
        const m = value.match(/rgba?\(([^)]+)\)/);
        if (!m) return null;
        const p = m[1]!
          .split(/[ ,/]+/)
          .filter(Boolean)
          .map(Number);
        return { r: p[0]!, g: p[1]!, b: p[2]!, a: p[3] ?? 1 };
      };
      const over = (fg: Rgba, bg: Rgba): Rgba => ({
        r: fg.r * fg.a + bg.r * (1 - fg.a),
        g: fg.g * fg.a + bg.g * (1 - fg.a),
        b: fg.b * fg.a + bg.b * (1 - fg.a),
        a: 1,
      });
      const lum = (c: Rgba) => {
        const f = (v: number) => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
      };
      const ratio = (a: Rgba, b: Rgba) => {
        const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
        return (hi! + 0.05) / (lo! + 0.05);
      };
      /** Possible backgrounds under an element: one, or the colors of a striped gradient */
      const backgrounds = (el: Element): Rgba[] => {
        const layers: Rgba[] = [];
        let stripes: Rgba[] = [];
        for (let n: Element | null = el; n; n = n.parentElement) {
          const style = getComputedStyle(n);
          if (style.backgroundImage !== "none" && !stripes.length) {
            stripes = (style.backgroundImage.match(/rgba?\([^)]+\)/g) ?? [])
              .map(parse)
              .filter((c): c is Rgba => c !== null);
          }
          const c = parse(style.backgroundColor);
          if (c && c.a > 0) {
            layers.push(c);
            if (c.a === 1) break;
          }
        }
        const base = (): Rgba => {
          let acc: Rgba = { r: 255, g: 255, b: 255, a: 1 };
          for (let i = layers.length - 1; i >= 0; i -= 1)
            acc = over(layers[i]!, acc);
          return acc;
        };
        if (stripes.length) return stripes.map((s) => over(s, base()));
        return [base()];
      };
      const opacityOf = (el: Element) => {
        let o = 1;
        for (let n: Element | null = el; n; n = n.parentElement) {
          o *= parseFloat(getComputedStyle(n).opacity);
        }
        return o;
      };

      const roots = document.querySelectorAll('[role="dialog"], .toast');
      const bad: string[] = [];
      let checked = 0;
      const checkText = (el: Element, color: string, label: string) => {
        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        if (rect.width <= 1 || rect.height <= 1) return; // visually hidden
        if (style.visibility === "hidden") return;
        if (el.closest("[disabled]")) return; // disabled controls are exempt (1.4.3)
        const fg = parse(color);
        if (!fg) return;
        checked += 1;
        const size = parseFloat(style.fontSize);
        const bold = parseInt(style.fontWeight, 10) >= 700;
        const needed = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5;
        const opacity = opacityOf(el);
        for (const bg of backgrounds(el)) {
          const solid = over({ ...fg, a: fg.a * opacity }, bg);
          const r = ratio(solid, bg);
          if (r < needed) {
            bad.push(
              `${label} «${(el.textContent ?? "").trim().slice(0, 40)}» ${r.toFixed(2)}:1 < ${needed}`,
            );
          }
        }
      };
      for (const root of roots) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const seen = new Set<Element>();
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const parent = node.parentElement;
          if (!parent || seen.has(parent) || !node.textContent?.trim())
            continue;
          seen.add(parent);
          checkText(
            parent,
            getComputedStyle(parent).color,
            parent.tagName.toLowerCase(),
          );
        }
        for (const area of root.querySelectorAll("textarea")) {
          const field = area as HTMLTextAreaElement;
          if (field.value)
            checkText(field, getComputedStyle(field).color, "textarea (text)");
          const placeholder = getComputedStyle(field, "::placeholder").color;
          const fieldBg = parse(getComputedStyle(field).backgroundColor);
          const fg = parse(placeholder);
          if (!field.value && fg && fieldBg) {
            const r = ratio(over(fg, fieldBg), fieldBg);
            if (r < 4.5) bad.push(`placeholder ${r.toFixed(2)}:1 < 4.5`);
          }
        }
      }
      if (checked < 3) bad.push(`only ${checked} texts measured`);
      return bad;
    });
  }

  test("campo vuoto: testi dei campi e segnaposto", async ({ page }) => {
    await installFakes(page);
    await open(page);
    expect(await failing(page)).toEqual([]);
  });

  test("frase, anteprima, «Occupato» degli altri e avviso", async ({
    page,
  }) => {
    await installFakes(page, { events: THURSDAY });
    const { field } = await open(page);
    await field.pressSequentially(PHRASE);
    await expect(
      page.getByRole("status").filter({ hasText: "chi accompagna Sofia?" }),
    ).toHaveCount(1);
    expect(await failing(page)).toEqual([]);
  });

  test("errore del campo e salvataggio non riuscito", async ({ page }) => {
    await installFakes(page, { save: "fail" });
    const { dialog, field } = await open(page);
    await field.pressSequentially("giovedì");
    await field.press("Enter");
    await expect(field).toHaveAttribute("aria-invalid", "true");
    expect(await failing(page)).toEqual([]);
    await field.fill(PHRASE);
    await dialog.getByRole("button", { name: "Metti in giovedì 22" }).click();
    await expect(dialog.getByRole("alert")).toBeVisible();
    expect(await failing(page)).toEqual([]);
  });

  test("persone del Nest non lette", async ({ page }) => {
    await installFakes(page, { people: "fail" });
    const { dialog } = await open(page);
    await expect(dialog.getByRole("alert")).toBeVisible();
    expect(await failing(page)).toEqual([]);
  });

  test("toast dopo il salvataggio", async ({ page }) => {
    await installFakes(page);
    const { dialog, field } = await open(page);
    await field.pressSequentially(PHRASE);
    const submit = dialog.getByRole("button", { name: "Metti in giovedì 22" });
    await saveWithStoppedClock(page, dialog, submit, NOW);
    await expect(page.locator(".toast")).toContainText("Messo in giovedì 22");
    expect(await failing(page)).toEqual([]);
  });
});
