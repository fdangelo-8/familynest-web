import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import {
  HARNESS_HTML,
  mountHarness,
} from "../fixtures/calendar-states-harness";
import { hasTestUser, signInAs } from "../fixtures/visual-login";

// Dates and calendar (#88, PR #100): the "In arrivo" pages of
// /calendario/giorno, /calendario/mese and /impegni/<id>, and the CSS states
// for #25 (Calendario) and #30 (Oggi): hover and pressed on rows, cards, day
// strip, time blocks and steps, the "adesso" line and the "Già fatti" arrow.
// No page uses those classes yet, so they are shown on a test page
// (tests/fixtures/calendar-states-harness.ts, markup copied from the mockup)
// mounted on a public page. At 390 and 1280 px (projects).
// The placeholders need test user A (without TEST_USER_A_* they are skipped).

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

const PAGES = [
  {
    route: "/calendario/giorno",
    file: "calendario-giorno",
    text: "Qui vedrai gli impegni di un giorno, ora per ora.",
    title: "Calendario",
  },
  {
    route: "/calendario/mese",
    file: "calendario-mese",
    text: "Qui vedrai gli impegni del mese, giorno per giorno.",
    title: "Calendario",
  },
  {
    route: "/impegni/6f1b7c0e-3c1d-4f6a-9d1e-2b7a5c8d9e10",
    file: "impegno",
    text: "Qui vedrai i dettagli di un impegno.",
    title: "Impegno",
  },
];

test.describe("segnaposto «In arrivo»", () => {
  test.use({ reducedMotion: "reduce" });

  test.beforeEach(async ({ page, context, baseURL }) => {
    test.skip(!hasTestUser("A"), "TEST_USER_A_* non impostati");
    await page.clock.setFixedTime(new Date("2026-10-20T15:00:00+02:00"));
    const signedIn = await signInAs(context, baseURL!, "A");
    test.skip(!signedIn, "utente di test A non ancora creato");
  });

  // One test (one sign-in) for the three pages.
  test("segnaposto: /calendario/giorno, /calendario/mese, /impegni/<id>", async ({
    page,
  }) => {
    for (const p of PAGES) {
      await page.goto(p.route);
      await expect(
        page.getByRole("heading", { level: 1, name: p.title }),
      ).toBeVisible();
      await expect(page.getByText("In arrivo", { exact: true })).toBeVisible();
      await expect(page.getByText(p.text)).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Torna a Oggi" }),
      ).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await page.mouse.move(0, 0);
      await expect(page).toHaveScreenshot(`${p.file}.png`);
    }
  });
});

// ---------------------------------------------------------------------------
// CSS states, on a public page of the app.

const CARTA = "rgb(241, 242, 238)";
const CARTA_2 = "rgb(231, 232, 226)";
const SUPERFICIE = "rgb(255, 255, 255)";
const INSIEME = "rgb(251, 243, 214)";
const TRASPARENTE = "rgba(0, 0, 0, 0)";

async function openHarness(page: Page) {
  await page.goto("/termini");
  // Wait for hydration: mounting earlier would be undone by React.
  await page.waitForLoadState("networkidle");
  await mountHarness(page);
  await page.mouse.move(0, 0);
}

function bg(page: Page, selector: string) {
  return page
    .locator(selector)
    .evaluate((el) => getComputedStyle(el).backgroundColor);
}

const GROUPS = ["righe", "schede", "striscia", "orario", "passi"] as const;
// The element to point at in each group, for the "hover" screenshot.
const HOVER_TARGET: Record<(typeof GROUPS)[number], string> = {
  righe: "#riga",
  schede: "#prossimo",
  striscia: "#giorno",
  orario: "#blocco",
  passi: "#passo",
};

test.describe("stati CSS di righe, schede, striscia, blocchi e passi", () => {
  test.use({ reducedMotion: "reduce" });

  for (const group of GROUPS) {
    test(`stati: ${group} a riposo`, async ({ page }) => {
      await openHarness(page);
      await expect(page.locator(`[data-gruppo="${group}"]`)).toHaveScreenshot(
        `stati-${group}.png`,
      );
    });

    test(`stati: ${group} con il mouse sopra`, async ({ page }) => {
      await openHarness(page);
      const section = page.locator(`[data-gruppo="${group}"]`);
      // Scroll first: a scroll after the hover would move another element
      // under the pointer.
      await section.scrollIntoViewIfNeeded();
      await section.locator(HOVER_TARGET[group]).hover();
      await expect(section).toHaveScreenshot(`stati-${group}-passaggio.png`);
    });
  }

  test("stati: «Già fatti» aperto, riga premuta e giorno premuto", async ({
    page,
  }) => {
    await openHarness(page);
    const section = page.locator('[data-gruppo="righe"]');
    await section.scrollIntoViewIfNeeded();
    await section.locator("#gia-fatti-aperto").hover();
    await page.mouse.down();
    await expect(section).toHaveScreenshot("stati-righe-premuta.png");
    await page.mouse.up();
    await page.mouse.move(0, 0);

    const strip = page.locator('[data-gruppo="striscia"]');
    await strip.scrollIntoViewIfNeeded();
    await strip.locator("#giorno-scelto").hover();
    await page.mouse.down();
    await expect(strip).toHaveScreenshot("stati-striscia-scelto-premuto.png");
    await page.mouse.up();
  });
});

test.describe("regole CSS misurate", () => {
  // Real transitions on, to check the timing.
  const HOVERED: Array<[string, string, string]> = [
    ["#riga", SUPERFICIE, CARTA],
    ["#prossimo", SUPERFICIE, CARTA],
    ["#contatore", SUPERFICIE, CARTA],
    ["#spazio", SUPERFICIE, CARTA],
    ["#spazio-tratteggiato", TRASPARENTE, CARTA_2],
    ["#gia-fatti", TRASPARENTE, CARTA_2],
    ["#gia-fatti-aperto", TRASPARENTE, CARTA_2],
    ["#giorno", TRASPARENTE, CARTA_2],
    ["#giorno-scelto", SUPERFICIE, CARTA],
    ["#blocco", SUPERFICIE, CARTA],
    ["#blocco-pulsante", SUPERFICIE, CARTA],
    ["#passo", TRASPARENTE, CARTA],
  ];

  for (const [selector, rest, over] of HOVERED) {
    test(`passaggio e premuto: ${selector}`, async ({ page }) => {
      await openHarness(page);
      expect(await bg(page, selector)).toBe(rest);
      await page.locator(selector).hover();
      await expect.poll(() => bg(page, selector)).toBe(over);
      // Pressed: same background as hover, no movement and no resize.
      const before = await page.locator(selector).boundingBox();
      await page.mouse.down();
      expect(await bg(page, selector)).toBe(over);
      expect(await page.locator(selector).boundingBox()).toEqual(before);
      await page.mouse.up();
      await page.mouse.move(0, 0);
      await expect.poll(() => bg(page, selector)).toBe(rest);
    });
  }

  test("la transizione del fondo dura 200 ms", async ({ page }) => {
    await openHarness(page);
    for (const [selector] of HOVERED) {
      const t = await page.locator(selector).evaluate((el) => {
        const s = getComputedStyle(el);
        return `${s.transitionProperty}|${s.transitionDuration}`;
      });
      expect(t, selector).toMatch(/background/);
      expect(t, selector).toMatch(/0\.2s/);
    }
  });

  test("righe e blocchi che non si toccano non cambiano", async ({ page }) => {
    await openHarness(page);
    for (const selector of [
      "#riga-insieme",
      "#riga-occupato",
      "#blocco-insieme",
      "#blocco-occupato",
    ]) {
      const read = () =>
        page
          .locator(selector)
          .evaluate(
            (el) =>
              `${getComputedStyle(el).backgroundColor}|${getComputedStyle(el).backgroundImage}`,
          );
      const before = await read();
      await page.locator(selector).hover();
      await page.mouse.down();
      expect(await read(), selector).toBe(before);
      await page.mouse.up();
      await page.mouse.move(0, 0);
    }
    expect(await bg(page, "#riga-insieme")).toBe(INSIEME);
  });

  test("cursore: mano sui blocchi cliccabili, normale sugli altri", async ({
    page,
  }) => {
    await openHarness(page);
    const cursor = (s: string) =>
      page.locator(s).evaluate((el) => getComputedStyle(el).cursor);
    expect(await cursor("#blocco")).toBe("pointer");
    expect(await cursor("#blocco-pulsante")).toBe("pointer");
    expect(await cursor("#blocco-occupato")).toBe("default");
    expect(await cursor("#blocco-insieme")).toBe("default");
  });

  test("linea di adesso: 15:52 cade a 7,8667 ore dalle 8:00", async ({
    page,
  }) => {
    await openHarness(page);
    const { top, hour } = await page.locator("#adesso").evaluate((el) => {
      const h = parseFloat(
        getComputedStyle(el.parentElement!).getPropertyValue("--h") || "0",
      );
      return { top: parseFloat(getComputedStyle(el).top), hour: h };
    });
    expect(hour).toBeGreaterThan(0);
    expect(top).toBeCloseTo(hour * 7.8667, 1);
  });

  test("freccia di «Già fatti»: capovolta solo quando è aperto", async ({
    page,
  }) => {
    await openHarness(page);
    const scale = (s: string) =>
      page
        .locator(`${s} .icona:last-child`)
        .evaluate((el) => getComputedStyle(el).scale);
    expect(await scale("#gia-fatti")).toBe("none");
    expect(await scale("#gia-fatti-aperto")).toBe("1 -1");
  });
});

// ---------------------------------------------------------------------------
// Comparison with the approved mockup: the same markup, rendered with the
// mockup's own CSS, and the app's CSS, must give the same resting styles.

const PROPS = [
  "backgroundColor",
  "backgroundImage",
  "boxShadow",
  "borderRadius",
  "borderTopWidth",
  "borderTopStyle",
  "borderTopColor",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "color",
  "fontSize",
  "fontWeight",
  "minHeight",
  "display",
  "position",
  "columnGap",
  "rowGap",
] as const;

const IDS = [
  "riga",
  "riga-insieme",
  "riga-occupato",
  "gia-fatti",
  "prossimo",
  "contatore",
  "spazio",
  "spazio-tratteggiato",
  "giorno",
  "giorno-scelto",
  "blocco",
  "blocco-occupato",
  "blocco-insieme",
  "passo",
] as const;

async function readStyles(page: Page) {
  return page.evaluate(
    ({ ids, props }) => {
      const out: Record<string, Record<string, string>> = {};
      for (const id of ids) {
        const el = document.getElementById(id)!;
        const s = getComputedStyle(el) as unknown as Record<string, string>;
        out[id] = Object.fromEntries(props.map((p) => [p, s[p] as string]));
      }
      return out;
    },
    { ids: [...IDS], props: [...PROPS] },
  );
}

test("confronto con il mockup: stili a riposo identici", async ({ page }) => {
  await openHarness(page);
  const app = await readStyles(page);

  await page.goto(
    `file://${path.resolve("docs/mockup/12-calendario-settimana.html")}`,
  );
  await page.evaluate((html) => {
    // Keep the mockup's icon sprite(s); replace the rest.
    for (const child of Array.from(document.body.children)) {
      if (!child.querySelector("symbol")) child.remove();
    }
    // The mockup's body styles (text size, link colors) live on its frames.
    const wrap = document.createElement("main");
    wrap.className = "frame-mobile";
    wrap.innerHTML = html;
    document.body.append(wrap);
    document.getElementById("adesso")?.classList.add("da-15-52");
  }, HARNESS_HTML);
  const mock = await readStyles(page);

  // Known, approved differences: none expected at rest.
  const diffs: string[] = [];
  for (const id of IDS) {
    for (const prop of PROPS) {
      if (app[id]![prop] !== mock[id]![prop]) {
        diffs.push(
          `${id}.${prop}: app ${app[id]![prop]} / mockup ${mock[id]![prop]}`,
        );
      }
    }
  }
  expect(diffs).toEqual([]);
});
