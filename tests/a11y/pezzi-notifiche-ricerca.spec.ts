import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { hasTestUser, signInAs } from "../fixtures/visual-login";

// PR #244 (#243): shared parts for Notifiche (#39) and Ricerca (#40).
// Gallery examples (/design-system?pezzi-pagine=1) at 390 and 1280 px, measured
// against the designer's CSS of #39 (a.parola, .parola--a-capo) and #40
// (campo-ricerca focus ring, palette scroll, long empty-state title, P1 chips),
// plus axe; and /ricerca at 390 px (no top bar, «Torna a Oggi»).

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

async function expectNoBlocking(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
}

test.describe("galleria: esempi nuovi", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/design-system?pezzi-pagine=1");
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator("#pezzi-pagine")).toBeVisible();
  });

  test("axe sui due esempi nuovi, senza violazioni serious o critical", async ({
    page,
  }) => {
    const results = await new AxeBuilder({ page })
      .include('[data-testid="sintesi-parole"]')
      .include('[data-testid="ricerca-pezzi"]')
      .analyze();
    expect(
      results.violations.filter((v) =>
        ["serious", "critical"].includes(v.impact ?? ""),
      ),
    ).toEqual([]);
    await expectNoBlocking(page);
  });

  test("#39: a.parola a riposo come span.parola, .parola--a-capo va a capo dentro la scheda", async ({
    page,
  }) => {
    const sintesi = page.getByTestId("sintesi-parole");
    await sintesi.scrollIntoViewIfNeeded();
    const m = await page.evaluate(() => {
      const root = document.querySelector('[data-testid="sintesi-parole"]')!;
      const plain = root.querySelector("a.parola:not(.parola--a-capo)")!;
      const wrap = document.querySelector('[data-testid="parola-a-capo"]')!;
      const ps = getComputedStyle(plain);
      const ws = getComputedStyle(wrap);
      const card = root.getBoundingClientRect();
      const rects = Array.from(wrap.getClientRects());
      return {
        plainWhiteSpace: ps.whiteSpace,
        plainDecoration: ps.textDecorationLine,
        plainCursor: ps.cursor,
        wrapWhiteSpace: ws.whiteSpace,
        wrapClone: ws.getPropertyValue("box-decoration-break"),
        wrapRects: rects.length,
        wrapMaxRight: Math.max(...rects.map((r) => r.right)),
        cardRight: card.right,
        pageOverflow:
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      };
    });
    expect(m.plainWhiteSpace).toBe("nowrap");
    expect(m.plainDecoration).toBe("none");
    expect(m.plainCursor).toBe("pointer");
    expect(m.wrapWhiteSpace).toBe("normal");
    expect(m.wrapClone).toBe("clone");
    expect(m.wrapRects).toBeGreaterThan(1);
    expect(m.wrapMaxRight).toBeLessThanOrEqual(m.cardRight);
    expect(m.pageOverflow).toBeLessThanOrEqual(0);
  });

  test("#39: passaggio del mouse su a.parola e a.parola--insieme", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "il passaggio è solo desktop",
    );
    const bg = (sel: string) =>
      page.evaluate((s) => {
        const el = document.querySelector(s)!;
        return {
          bg: getComputedStyle(el).backgroundColor,
          shadow: getComputedStyle(el).boxShadow,
        };
      }, sel);
    const tokens = await page.evaluate(() => {
      const probe = document.createElement("i");
      document.body.append(probe);
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries({
        carta2: "--color-carta-2",
        insieme: "--color-insieme",
        bordo: "--color-insieme-bordo",
      })) {
        probe.style.backgroundColor = `var(${v})`;
        out[k] = getComputedStyle(probe).backgroundColor;
        probe.style.boxShadow = `inset 0 0 0 2px var(${v})`;
      }
      probe.remove();
      return out;
    });
    const plain = page
      .getByTestId("sintesi-parole")
      .getByRole("link", { name: "16:00" });
    await plain.scrollIntoViewIfNeeded();
    await plain.hover();
    await expect
      .poll(
        async () => (await bg('[data-testid="sintesi-parole"] a.parola')).bg,
      )
      .toBe(tokens.carta2);
    const together = page
      .getByTestId("sintesi-parole")
      .getByRole("link", { name: "liberi dalle 21:30" });
    await together.hover();
    await expect
      .poll(async () => (await bg("a.parola--insieme")).bg)
      .toBe(tokens.insieme);
    expect((await bg("a.parola--insieme")).shadow).not.toBe("none");
    await page.mouse.move(0, 0);
  });

  test("#40: anello del campo di ricerca con il fuoco, sul contenitore", async ({
    page,
  }) => {
    const form = page.locator('[data-testid="ricerca-pezzi"] .campo-ricerca');
    await form.scrollIntoViewIfNeeded();
    const before = await form.evaluate(
      (el) => getComputedStyle(el).outlineStyle,
    );
    expect(before).toBe("none");
    await page.getByRole("searchbox", { name: "Cerca nel Nest" }).focus();
    const ring = await form.evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        style: s.outlineStyle,
        width: s.outlineWidth,
        offset: s.outlineOffset,
        color: s.outlineColor,
      };
    });
    const info = await page.evaluate(() => {
      const probe = document.createElement("i");
      probe.style.backgroundColor = "var(--color-info)";
      document.body.append(probe);
      const c = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return c;
    });
    expect(ring.style).toBe("solid");
    // --border-medio is 1.5px; Chromium snaps outline widths to whole pixels.
    expect(parseFloat(ring.width)).toBeGreaterThanOrEqual(1);
    expect(ring.offset).toBe("2px");
    expect(ring.color).toBe(info);
  });

  test("#40 P1: il numero dei chip non scelti è a piena opacità", async ({
    page,
  }) => {
    const chip = page
      .locator('[data-testid="ricerca-pezzi"] .chip[aria-pressed="false"]')
      .first();
    await chip.scrollIntoViewIfNeeded();
    const o = await chip.evaluate((el) => {
      const n = el.querySelector(".chip__conteggio")!;
      return {
        own: getComputedStyle(n).opacity,
        chip: getComputedStyle(el).opacity,
        color: getComputedStyle(n).color,
        chipColor: getComputedStyle(el).color,
      };
    });
    expect(o.own).toBe("1");
    expect(o.chip).toBe("1");
    expect(o.color).toBe(o.chipColor);
  });

  test("#40: la palette scorre solo nel mezzo, il piede resta visibile", async ({
    page,
  }) => {
    const m = await page.evaluate(() => {
      const r = document.querySelector('[data-testid="palette-risultati"]')!;
      const s = getComputedStyle(r);
      const foot = document.querySelector(".palette__piede")!;
      return {
        overflowY: s.overflowY,
        overscroll: s.overscrollBehaviorY,
        padding: s.paddingTop,
        margin: s.marginTop,
        footVisible: foot.getBoundingClientRect().height > 0,
        footText: foot.textContent,
      };
    });
    expect(m.overflowY).toBe("auto");
    expect(m.overscroll).toBe("contain");
    expect(m.padding).toBe("4px");
    expect(m.margin).toBe("-4px");
    expect(m.footVisible).toBe(true);
    expect(m.footText).toContain("↑ ↓ per scorrere");
    expect(m.footText).toContain("↵ per aprire");
    expect(m.footText).toContain("esc per chiudere");
  });

  test("#40: titolo lungo senza spazi nello stato vuoto, nessuno scorrimento orizzontale", async ({
    page,
  }) => {
    const empty = page.getByTestId("vuoto-lungo");
    await empty.scrollIntoViewIfNeeded();
    const m = await page.evaluate(() => {
      const root = document.querySelector('[data-testid="vuoto-lungo"]')!;
      const title = root.querySelector(".stato-vuoto__titolo")!;
      const t = title.getBoundingClientRect();
      const r = root.getBoundingClientRect();
      return {
        wrap: getComputedStyle(title).overflowWrap,
        titleRight: t.right,
        rootRight: r.right,
        pageOverflow:
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      };
    });
    expect(m.wrap).toBe("anywhere");
    expect(m.titleRight).toBeLessThanOrEqual(m.rootRight);
    expect(m.pageOverflow).toBeLessThanOrEqual(0);
  });

  test("tastiera: le parole e il bottone dell'esempio hanno un anello visibile", async ({
    page,
  }) => {
    const link = page
      .getByTestId("sintesi-parole")
      .getByRole("link", { name: "16:00" });
    await link.scrollIntoViewIfNeeded();
    await link.focus();
    await page.keyboard.press("Tab");
    const ring = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      const s = getComputedStyle(el);
      return {
        text: el.textContent,
        visible: s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0,
      };
    });
    expect(ring.text).toContain("Riunione di condominio");
    expect(ring.visible).toBe(true);
  });
});

test.describe("/ricerca a 390 px (utente A)", () => {
  test.beforeEach(async ({ context, baseURL }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "solo mobile (390 px)");
    test.skip(!hasTestUser("A"), "TEST_USER_A_* non impostati");
    const signedIn = await signInAs(context, baseURL!, "A");
    test.skip(!signedIn, "utente di test A non ancora creato");
  });

  test("niente barra in alto, c'è «Torna a Oggi», axe pulito", async ({
    page,
  }) => {
    await page.goto("/ricerca");
    await expect(page.getByRole("main")).toBeVisible();
    const back = page.getByRole("link", { name: "Torna a Oggi" });
    await expect(back).toBeVisible();
    await expect(back).toHaveAttribute("href", "/oggi");
    expect(await page.locator(".barra").count()).toBe(0);
    await expect(page.locator("h1:visible")).toHaveCount(1);
    await expectNoBlocking(page);
  });
});
