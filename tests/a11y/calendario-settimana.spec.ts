import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  FULL_WEEK,
  SMALL_WEEK,
  WEEK_TITLE,
  isMobile,
  openWeek,
  throwawayConfigured,
  throwawaySkipReason,
  waitForData,
  withNest,
} from "../visual/calendario-settimana-helpers";

// Calendario · Settimana (#25), visual tester's accessibility checks: axe in
// every state (normal with the lens «Nest» and «Io», empty, loading, page
// error, offline), no duplicated id between the mobile and the desktop layout,
// headings in order, the strip of the days from the keyboard (arrows, Home,
// End, Enter, Space), focus order and visible ring, touch areas of 44 px and
// contrast. Every test builds its own throwaway Nest and its own events in the
// week 19-25 October 2026, with the clock at Tuesday 20 October, 15:52 (Rome).

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

test.beforeEach(() => {
  test.skip(!throwawayConfigured(), throwawaySkipReason);
  test.setTimeout(180_000);
});

async function violations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => n.target.join(" ")),
    }));
}

/** No two elements of the page share an id (the mobile and desktop layouts). */
async function duplicatedIds(page: Page) {
  return page.evaluate(() => {
    const seen = new Map<string, number>();
    for (const el of document.querySelectorAll("[id]")) {
      seen.set(el.id, (seen.get(el.id) ?? 0) + 1);
    }
    return [...seen].filter(([, n]) => n > 1).map(([id]) => id);
  });
}

async function expectClean(page: Page) {
  expect(await violations(page)).toEqual([]);
  expect(await duplicatedIds(page)).toEqual([]);
}

// --- axe, every state --------------------------------------------------------

test.describe("axe", () => {
  test("normale: lente Nest e lente Io", async ({ page, baseURL }) => {
    await withNest(FULL_WEEK, async (nest) => {
      await openWeek(page, baseURL, nest, { lens: "nest" });
      await waitForData(page);
      await expect(page.getByText("Cena dai nonni").first()).toBeVisible();
      await expectClean(page);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);

      await page
        .getByRole("group", { name: /Punto di vista/ })
        .getByRole("button", { name: /Io$/ })
        .click();
      await expect(
        page.getByRole("button", { name: /Io$/, pressed: true }),
      ).toBeVisible();
      await expectClean(page);
    });
  });

  test("vuoto", async ({ page, baseURL }) => {
    await withNest([], async (nest) => {
      await openWeek(page, baseURL, nest, { lens: "nest" });
      await waitForData(page);
      await expect(
        page.getByText("Questa settimana è ancora vuota"),
      ).toBeVisible();
      await expectClean(page);
    });
  });

  test("caricamento", async ({ page, baseURL }) => {
    await withNest(SMALL_WEEK, async (nest) => {
      await page.route("**/rpc/list_household_events*", () => {});
      await openWeek(page, baseURL, nest, { lens: "nest" });
      await expect(
        page.getByRole("heading", { level: 1, name: WEEK_TITLE }),
      ).toBeVisible({ timeout: 30_000 });
      await expect(page.locator('[aria-busy="true"]').first()).toBeAttached();
      await expectClean(page);
    });
  });

  test("errore: la pagina non si carica", async ({ page, baseURL }) => {
    await withNest(SMALL_WEEK, async (nest) => {
      await page.route("**/rpc/list_household_events*", (route) =>
        route.abort("failed"),
      );
      await openWeek(page, baseURL, nest, { lens: "nest" });
      await expect(
        page.getByRole("heading", { name: "Questa pagina non si è caricata" }),
      ).toBeVisible({ timeout: 30_000 });
      await expectClean(page);
    });
  });

  test("errore offline: impegni salvati e settimana nuova", async ({
    page,
    context,
    baseURL,
  }) => {
    await withNest(SMALL_WEEK, async (nest) => {
      await openWeek(page, baseURL, nest, { lens: "nest" });
      await waitForData(page);
      await context.setOffline(true);
      await page.getByRole("button", { name: "Settimana successiva" }).click();
      await expect(
        page.getByText("Non riusciamo a caricare questa settimana."),
      ).toBeVisible();
      await expectClean(page);

      await page.getByRole("button", { name: "Settimana precedente" }).click();
      await expect(
        page.getByRole("alert").filter({
          hasText: "Non riusciamo ad aggiornare il calendario.",
        }),
      ).toBeVisible();
      await expectClean(page);
    });
  });
});

// --- headings in order --------------------------------------------------------

test("titoli in ordine: un solo h1, nessun livello saltato", async ({
  page,
  baseURL,
}) => {
  await withNest(FULL_WEEK, async (nest) => {
    await openWeek(page, baseURL, nest, { lens: "nest" });
    await waitForData(page);
    await expect(page.getByText("Cena dai nonni").first()).toBeVisible();
    const headings = await page
      .getByRole("main")
      .getByRole("heading")
      .evaluateAll((nodes) =>
        nodes.map((node) => ({
          level: Number(node.tagName.slice(1)),
          text: (node.textContent ?? "").replace(/\s+/g, " ").trim(),
        })),
      );
    expect(headings[0]).toEqual({ level: 1, text: WEEK_TITLE });
    expect(headings.filter((h) => h.level === 1)).toHaveLength(1);
    let previous = 1;
    for (const heading of headings.slice(1)) {
      expect(heading.level, heading.text).toBeLessThanOrEqual(previous + 1);
      expect(heading.level, heading.text).toBeGreaterThanOrEqual(2);
      previous = heading.level;
    }
    expect(headings.some((h) => h.level === 3)).toBe(false);
    const texts = headings.map((h) => h.text);
    if (isMobile(page)) {
      // One section for each day from today: «Martedì 20» … «Domenica 25».
      expect(texts.slice(1)).toEqual([
        "Martedì 20",
        "Mercoledì 21",
        "Giovedì 22",
        "Venerdì 23",
        "Sabato 24",
        "Domenica 25",
      ]);
    } else {
      expect(texts).toContain("Impegno");
      expect(texts).toContain("Serate libere insieme");
      expect(texts.indexOf("Impegno")).toBeLessThan(
        texts.indexOf("Serate libere insieme"),
      );
      // The hidden headings of the grid name the days, in order.
      const days = texts.slice(1).filter((t) => /ottobre/.test(t));
      expect(days).toHaveLength(7);
      expect(days[1]).toBe("Martedì 20 ottobre, oggi");
    }
  });
});

// --- the strip of the days from the keyboard (mobile) ---------------------------

async function focusRing(target: Locator) {
  return target.evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      style: style.outlineStyle,
      width: parseFloat(style.outlineWidth),
      color: style.outlineColor,
    };
  });
}

const tab = (page: Page, name: RegExp | string) =>
  page
    .getByRole("tablist", { name: "Giorni della settimana" })
    .getByRole("tab", { name });

test("striscia dei giorni: frecce, Inizio, Fine, Invio e Spazio", async ({
  page,
  baseURL,
}) => {
  test.skip(!isMobile(page), "la striscia dei giorni esiste solo su mobile");
  await withNest(FULL_WEEK, async (nest) => {
    await openWeek(page, baseURL, nest, { lens: "nest" });
    await waitForData(page);
    const strip = page.getByRole("tablist", { name: "Giorni della settimana" });
    const tabs = strip.getByRole("tab");
    await expect(tabs).toHaveCount(7);
    await expect(tabs.first()).toContainText("Lun");
    await expect(tabs.last()).toContainText("Dom");

    // Roving tabindex: the strip is a single stop, on the selected day (today).
    const stops = await tabs.evaluateAll((nodes) =>
      nodes
        .filter((n) => n.tabIndex === 0)
        .map((n) => n.getAttribute("aria-label")),
    );
    expect(stops).toHaveLength(1);
    expect(stops[0]).toContain("Martedì 20 ottobre");
    await expect(tab(page, /^Martedì 20 ottobre/)).toHaveAttribute(
      "aria-selected",
      "true",
    );

    // From the last control before the strip one Tab lands on the selected day,
    // the next one leaves the strip (no trap).
    await page.getByRole("link", { name: "Mese" }).focus();
    await page.keyboard.press("Tab");
    await expect(tab(page, /^Martedì 20 ottobre/)).toBeFocused();
    const ring = await focusRing(tab(page, /^Martedì 20 ottobre/));
    expect(ring.style).not.toBe("none");
    expect(ring.width).toBeGreaterThan(0);

    // Arrows move the focus, not the choice.
    await page.keyboard.press("ArrowRight");
    await expect(tab(page, /^Mercoledì 21 ottobre/)).toBeFocused();
    await expect(tab(page, /^Martedì 20 ottobre/)).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(tab(page, /^Mercoledì 21 ottobre/)).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(
      (await focusRing(tab(page, /^Mercoledì 21 ottobre/))).style,
    ).not.toBe("none");
    await page.keyboard.press("ArrowLeft");
    await expect(tab(page, /^Martedì 20 ottobre/)).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(tab(page, /^Lunedì 19 ottobre/)).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(tab(page, /^Lunedì 19 ottobre/)).toBeFocused();

    await page.keyboard.press("End");
    await expect(tab(page, /^Domenica 25 ottobre/)).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(tab(page, /^Domenica 25 ottobre/)).toBeFocused();
    await page.keyboard.press("Home");
    await expect(tab(page, /^Lunedì 19 ottobre/)).toBeFocused();

    // Still nothing chosen but today; the page did not move to another day.
    await expect(tabs.and(page.locator('[aria-selected="true"]'))).toHaveCount(
      1,
    );
    await expect(tab(page, /^Martedì 20 ottobre/)).toHaveAttribute(
      "aria-selected",
      "true",
    );

    // Enter chooses the day and brings its section into view.
    await page.keyboard.press("End");
    await page.keyboard.press("ArrowLeft");
    await expect(tab(page, /^Sabato 24 ottobre/)).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(tab(page, /^Sabato 24 ottobre/)).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(tab(page, /^Martedì 20 ottobre/)).toHaveAttribute(
      "aria-selected",
      "false",
    );
    const heading = page.getByRole("heading", { level: 2, name: "Sabato 24" });
    await expect(heading).toBeInViewport();
    await expect(heading).toBeFocused();

    // Space does the same, from the strip again.
    await tab(page, /^Venerdì 23 ottobre/).focus();
    await page.keyboard.press("Space");
    await expect(tab(page, /^Venerdì 23 ottobre/)).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(
      page.getByRole("heading", { level: 2, name: "Venerdì 23" }),
    ).toBeInViewport();

    // The selected day is the one stop of the strip: the next Tab leaves it.
    await tab(page, /^Venerdì 23 ottobre/).focus();
    await page.keyboard.press("Tab");
    const inside = await strip.evaluate((el) =>
      el.contains(document.activeElement),
    );
    expect(inside).toBe(false);
  });
});

// --- focus order and no trap -----------------------------------------------------

/**
 * Name of the focused element (its label or its text), and whether the focus
 * had already been there during this walk: every stop is marked once.
 */
async function focusedStop(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return { name: "(body)", seen: false };
    const seen = el.dataset.tabVisited === "1";
    el.dataset.tabVisited = "1";
    const own = el.getAttribute("aria-label") ?? el.textContent ?? "";
    const name = `${el.tagName.toLowerCase()}:${own.replace(/\s+/g, " ").trim().slice(0, 80)}`;
    return { name, seen };
  });
}

test("ordine del focus e nessuna trappola", async ({ page, baseURL }) => {
  await withNest(FULL_WEEK, async (nest) => {
    await openWeek(page, baseURL, nest, { lens: "nest" });
    await waitForData(page);
    await expect(page.getByText("Cena dai nonni").first()).toBeVisible();

    // No positive tabindex anywhere.
    const positive = await page.evaluate(
      () =>
        [...document.querySelectorAll("[tabindex]")].filter(
          (el) => Number(el.getAttribute("tabindex")) > 0,
        ).length,
    );
    expect(positive).toBe(0);

    // Tab through the whole page: every stop is reached once and the focus gets
    // out of the page at the end, so there is no trap.
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
    const order: string[] = [];
    let ended = false;
    for (let i = 0; i < 200; i++) {
      await page.keyboard.press("Tab");
      const stop = await focusedStop(page);
      if (stop.name === "(body)" || stop.seen) {
        ended = true;
        break;
      }
      order.push(stop.name);
    }
    expect(ended, `nessuna uscita dopo ${order.length} passi`).toBe(true);
    expect(order.length).toBeGreaterThan(8);

    const index = (re: RegExp) => order.findIndex((name) => re.test(name));
    const mainOrder = [
      /Settimana precedente/,
      /Settimana successiva/,
      isMobile(page) ? /^a:Giorno/ : /^button:.*Io$/,
    ].map(index);
    expect(
      mainOrder.every((i) => i >= 0),
      JSON.stringify(order),
    ).toBe(true);
    expect([...mainOrder].sort((a, b) => a - b)).toEqual(mainOrder);

    if (isMobile(page)) {
      const giorno = index(/^a:Giorno/);
      const mese = index(/^a:Mese/);
      const striscia = index(/^button:Martedì 20 ottobre/);
      const riga = index(/^a:.*Call con Acme/);
      expect(giorno).toBeLessThan(mese);
      expect(mese).toBeLessThan(striscia);
      expect(striscia).toBeLessThan(riga);
      // The strip is one stop only.
      expect(
        order.filter((name) => /^button:.*ottobre, /.test(name)),
      ).toHaveLength(1);
    } else {
      // Blocks column by column: the days of the labels never go back.
      const blocks = order.filter((name) => /ottobre, dalle/.test(name));
      expect(blocks.length).toBeGreaterThan(5);
      const days = blocks.map((name) =>
        Number(/(\d+) ottobre/.exec(name)?.[1] ?? 0),
      );
      expect([...days].sort((a, b) => a - b)).toEqual(days);
    }
  });
});

test("blocchi della griglia da tastiera e pannello (desktop)", async ({
  page,
  baseURL,
}) => {
  test.skip(isMobile(page), "la griglia esiste solo su desktop");
  await withNest(FULL_WEEK, async (nest) => {
    await openWeek(page, baseURL, nest, { lens: "nest" });
    await waitForData(page);
    const url = page.url();
    const block = page.getByRole("link", {
      name: /^Tennis.*mercoledì 21 ottobre/,
    });
    await block.focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    await expect(block).toBeFocused();
    const ring = await focusRing(block);
    expect(ring.style).not.toBe("none");
    expect(ring.width).toBeGreaterThan(0);

    await page.keyboard.press("Enter");
    await expect(block).toHaveAttribute("aria-current", "true");
    await expect(
      page.locator('[aria-current="true"].blocco-orario'),
    ).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "Impegno" })).toBeVisible();
    await expect(page.locator("a.prossimo")).toContainText("Tennis");
    expect(page.url()).toBe(url);

    const other = page.getByRole("link", {
      name: /^Calcetto.*venerdì 23 ottobre/,
    });
    await other.focus();
    await page.keyboard.press("Space");
    await expect(other).toHaveAttribute("aria-current", "true");
    await expect(block).not.toHaveAttribute("aria-current", "true");
    await expect(page.locator("a.prossimo")).toContainText("Calcetto");
    expect(page.url()).toBe(url);

    // The «Occupato» of someone else and «Liberi insieme» are not stops.
    const busy = page.getByRole("group", { name: /Laura ha un impegno/ });
    await expect(busy.first()).toBeVisible();
    const busyStops = await busy.evaluateAll(
      (nodes) => nodes.filter((n) => n.matches("a, button, [tabindex]")).length,
    );
    expect(busyStops).toBe(0);
  });
});

// --- touch areas (mobile) ---------------------------------------------------------

/**
 * True when the 44 x 44 px square around the centre of the control hits the
 * control (or something inside it): the touch area is the whole square.
 */
async function hasTouchArea(target: Locator, size = 44) {
  return target.evaluate((el, s) => {
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const half = s / 2 - 1;
    const points = [
      [cx - half, cy - half],
      [cx + half, cy - half],
      [cx - half, cy + half],
      [cx + half, cy + half],
      [cx, cy],
    ];
    return points.every(([x, y]) => {
      const hit = document.elementFromPoint(x!, y!);
      return hit !== null && (hit === el || el.contains(hit));
    });
  }, size);
}

test("aree di tocco di almeno 44 px (mobile)", async ({ page, baseURL }) => {
  test.skip(!isMobile(page), "area di tocco: solo mobile");
  await withNest(FULL_WEEK, async (nest) => {
    await openWeek(page, baseURL, nest, { lens: "nest" });
    await waitForData(page);
    await page.evaluate(() => window.scrollTo(0, 0));

    const controls: [string, Locator][] = [
      [
        "Settimana precedente",
        page.getByRole("button", { name: "Settimana precedente" }),
      ],
      [
        "Settimana successiva",
        page.getByRole("button", { name: "Settimana successiva" }),
      ],
      ["Giorno", page.getByRole("link", { name: "Giorno" })],
      [
        "Settimana",
        page.getByRole("button", { name: "Settimana", exact: true }),
      ],
      ["Mese", page.getByRole("link", { name: "Mese" })],
      [
        "lente Io",
        page
          .getByRole("group", { name: /Punto di vista/ })
          .getByRole("button", { name: /Io$/ }),
      ],
      [
        "lente Nest",
        page
          .getByRole("group", { name: /Punto di vista/ })
          .getByRole("button", { name: /Nest$/ }),
      ],
    ];
    const strip = page.getByRole("tablist", { name: "Giorni della settimana" });
    for (let i = 0; i < 7; i++) {
      controls.push([
        `giorno ${i + 1} della striscia`,
        strip.getByRole("tab").nth(i),
      ]);
    }
    for (const [name, control] of controls) {
      expect(await hasTouchArea(control), name).toBe(true);
    }

    // The rows of the list are links at least 44 px high and wide.
    const rows = page.locator("main a.riga-evento");
    const count = await rows.count();
    expect(count).toBeGreaterThan(10);
    for (let i = 0; i < count; i++) {
      const box = await rows.nth(i).boundingBox();
      expect(box?.height, `riga ${i + 1}`).toBeGreaterThanOrEqual(44);
      expect(box?.width, `riga ${i + 1}`).toBeGreaterThanOrEqual(44);
    }

    // The areas of two neighbours do not overlap: the days of the strip are 44 px
    // apart or more, centre to centre.
    const centres = await strip.getByRole("tab").evaluateAll((nodes) =>
      nodes.map((n) => {
        const r = n.getBoundingClientRect();
        return r.left + r.width / 2;
      }),
    );
    for (let i = 1; i < centres.length; i++) {
      expect(centres[i]! - centres[i - 1]!).toBeGreaterThanOrEqual(44);
    }
  });
});

test("«Riprova» ha l'area di tocco di 44 px (mobile)", async ({
  page,
  context,
  baseURL,
}) => {
  test.skip(!isMobile(page), "area di tocco: solo mobile");
  await withNest(SMALL_WEEK, async (nest) => {
    await openWeek(page, baseURL, nest, { lens: "nest" });
    await waitForData(page);
    await context.setOffline(true);
    await page.getByRole("button", { name: "Settimana successiva" }).click();
    const retry = page.getByRole("button", { name: "Riprova" });
    await expect(retry).toBeVisible();
    expect(await hasTouchArea(retry), "Riprova").toBe(true);
  });
});

test("il bottone dello stato vuoto ha l'area di tocco di 44 px (mobile)", async ({
  page,
  baseURL,
}) => {
  test.skip(!isMobile(page), "area di tocco: solo mobile");
  await withNest([], async (nest) => {
    await openWeek(page, baseURL, nest, { lens: "nest" });
    await waitForData(page);
    const add = page.getByRole("link", { name: "Aggiungi un impegno" });
    await expect(add).toBeVisible();
    expect(await hasTouchArea(add), "Aggiungi un impegno").toBe(true);
  });
});

// --- contrast ----------------------------------------------------------------------

/** WCAG contrast ratio of the text of an element against its background. */
async function contrastOf(target: Locator, backgroundToken?: string) {
  return target.evaluate((el, token) => {
    const parse = (value: string) => {
      const m = /rgba?\(([^)]+)\)/.exec(value);
      if (!m) throw new Error(`colore non riconosciuto: ${value}`);
      const [r, g, b, a] = m[1]!
        .split(/[ ,/]+/)
        .filter(Boolean)
        .map(Number);
      return { r: r!, g: g!, b: b!, a: a ?? 1 };
    };
    const solid = (value: string) => {
      const c = parse(value);
      return c.a > 0.99 ? c : null;
    };
    const resolveToken = (name: string) => {
      const probe = document.createElement("span");
      probe.style.backgroundColor = `var(${name})`;
      document.body.appendChild(probe);
      const color = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return parse(color);
    };
    let background = token ? resolveToken(token) : null;
    for (
      let node: HTMLElement | null = el as HTMLElement;
      !background && node;
      node = node.parentElement
    ) {
      background = solid(getComputedStyle(node).backgroundColor);
    }
    if (!background) background = { r: 255, g: 255, b: 255, a: 1 };
    const fg = parse(getComputedStyle(el).color);
    const lum = ({ r, g, b }: { r: number; g: number; b: number }) => {
      const f = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const l1 = lum(fg);
    const l2 = lum(background);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }, backgroundToken);
}

test("contrasto: testi principali e axe color-contrast", async ({
  page,
  baseURL,
}) => {
  await withNest(FULL_WEEK, async (nest) => {
    await openWeek(page, baseURL, nest, { lens: "nest" });
    await waitForData(page);
    await expect(page.getByText("Cena dai nonni").first()).toBeVisible();

    const minimum = 4.5;
    const checks: [string, Locator, string?][] = [
      ["titolo della pagina", page.getByRole("heading", { level: 1 })],
    ];
    if (isMobile(page)) {
      checks.push(
        [
          "nome del giorno (striscia)",
          page.locator(".striscia-giorni__nome").nth(1),
        ],
        [
          "numero del giorno (striscia)",
          page.locator(".striscia-giorni__numero").nth(2),
        ],
        ["testa del giorno", page.locator(".sezione__info").first()],
        [
          "info di una riga futura",
          page
            .locator("a.riga-evento:not([data-passato]) .riga-evento__info")
            .first(),
        ],
        [
          "titolo di una riga futura",
          page
            .locator("a.riga-evento:not([data-passato]) .riga-evento__titolo")
            .first(),
        ],
        [
          "ora di una riga futura",
          page
            .locator("a.riga-evento:not([data-passato]) .riga-evento__ora")
            .first(),
        ],
        [
          "Occupato di un altro",
          page
            .locator(
              ".riga-evento--occupato:not([data-passato]) .riga-evento__info",
            )
            .first(),
          "--color-occupato-2",
        ],
        [
          "titolo Occupato",
          page
            .locator(
              ".riga-evento--occupato:not([data-passato]) .riga-evento__titolo",
            )
            .first(),
          "--color-occupato-2",
        ],
        [
          "Liberi insieme (titolo)",
          page
            .locator(
              ".riga-evento--insieme:not([data-passato]) .riga-evento__titolo",
            )
            .first(),
          "--color-insieme",
        ],
        [
          "Liberi insieme (info)",
          page
            .locator(
              ".riga-evento--insieme:not([data-passato]) .riga-evento__info",
            )
            .first(),
          "--color-insieme",
        ],
      );
    } else {
      checks.push(
        [
          "nome del giorno (griglia)",
          page.locator(".griglia-settimana__nome").nth(1),
        ],
        [
          "ora di un blocco",
          page.locator("a.blocco-orario .blocco-orario__ora").first(),
        ],
        [
          "titolo di un blocco",
          page.locator("a.blocco-orario .blocco-orario__titolo").first(),
        ],
        [
          "Occupato di un altro",
          page.locator(".blocco-orario--occupato .blocco-orario__ora").first(),
          "--color-occupato-2",
        ],
        [
          "Liberi insieme (blocco)",
          page.locator(".blocco-orario--insieme .blocco-orario__ora").first(),
          "--color-insieme",
        ],
        ["ora del pannello", page.locator(".prossimo__info")],
        ["nota del pannello", page.locator(".prossimo__nota").first()],
        [
          "info di una serata libera",
          page.locator(".riga-lista__info").first(),
        ],
      );
    }
    for (const [name, target, token] of checks) {
      await expect(target, name).toBeVisible();
      const ratio = await contrastOf(target, token);
      expect(ratio, `${name}: ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
        minimum,
      );
    }

    // The same, as axe measures it, on both lenses.
    const run = async () =>
      (
        await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze()
      ).violations
        .filter((v) => v.impact === "serious" || v.impact === "critical")
        .map((v) => v.nodes.map((n) => n.target.join(" ")));
    expect(await run()).toEqual([]);
    await page
      .getByRole("group", { name: /Punto di vista/ })
      .getByRole("button", { name: /Io$/ })
      .click();
    await expect(
      page.getByRole("button", { name: /Io$/, pressed: true }),
    ).toBeVisible();
    expect(await run()).toEqual([]);
  });
});
