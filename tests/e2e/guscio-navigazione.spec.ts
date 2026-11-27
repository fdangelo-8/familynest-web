import { expect, type Page } from "@playwright/test";
import { signInAs, skipReason, usersConfigured } from "../fixtures/auth";
import { waitHydrated } from "../fixtures/esplora";
import { createNuoto, detailPath } from "../fixtures/impegni";
import { test } from "../fixtures/casa";

// Shell and navigation (F5, #506, PR #656): the cases the layout spec does not
// reach, at the widths of D8 (spec 506 §1 and §12): 960 and 1040 (icons bar),
// 1440 (wide computer), and the short heights of the turned phone. CA numbers
// are the ones of the issue; thresholds are 900 / 1280 px and 600 px of height.

const NAV = { name: "Navigazione principale" };

function openFor(page: Page, baseURL: string | undefined, route: string) {
  return signInAs(page.context(), baseURL as string, "A").then(async () => {
    await page.goto(route);
    await expect(page.getByRole("main")).toBeVisible();
    await waitHydrated(
      page
        .getByTestId("barra-laterale")
        .or(page.getByTestId("testata"))
        .first(),
    );
  });
}

function width(page: Page, testId: string) {
  return page
    .getByTestId(testId)
    .evaluate((el) => Math.round(el.getBoundingClientRect().width));
}

test.describe("guscio: larghezze e altezze di D8", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "I formati si impostano nel test: si esegue una volta sola",
    );
    test.skip(!usersConfigured("A"), skipReason("A"));
  });

  for (const viewport of [960, 1040, 1279] as const) {
    test(`CA-1 e CA-21: a ${viewport} px barra a icone di 72 px, nessuna barra in basso, un solo main`, async ({
      page,
      baseURL,
    }) => {
      await page.setViewportSize({ width: viewport, height: 800 });
      await openFor(page, baseURL, "/oggi");
      expect(await width(page, "barra-laterale")).toBe(72);
      await expect(page.getByTestId("barra-basso")).toBeHidden();
      await expect(page.getByRole("main")).toHaveCount(1);
      // Calendario has the full name for the screen readers even with icons only
      await expect(
        page
          .getByTestId("barra-laterale")
          .getByRole("link", { name: "Calendario", exact: true }),
      ).toBeVisible();
    });
  }

  for (const [viewport, content] of [
    [960, 508],
    [1024, 572],
    [1194, 742],
  ] as const) {
    test(`CA-25 (D8): a ${viewport} px il pannello è largo 380, la barra 72 e il contenuto ${content}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: viewport, height: 800 });
      await page.goto("/design-system?guscio=1");
      const open = page.getByTestId("pannello-apri");
      await waitHydrated(open);
      await open.click();
      await expect(page.getByTestId("pannello-prova")).toBeVisible();
      await expect
        .poll(() => width(page, "barra-laterale"), { timeout: 3000 })
        .toBe(72);
      expect(await width(page, "pannello-prova")).toBe(380);
      const main = await page.getByTestId("guscio-contenuto").boundingBox();
      expect(Math.abs(main!.width - content)).toBeLessThanOrEqual(1);
    });
  }

  test("CA-2 e CA-3: a 1440 px barra intera di 248 px e contenuto non oltre 1200 px, centrato", async ({
    page,
    baseURL,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openFor(page, baseURL, "/oggi");
    expect(await width(page, "barra-laterale")).toBe(248);
    const box = (await page.getByRole("main").boundingBox())!;
    expect(box.width).toBeLessThanOrEqual(1200);
    const left = box.x - 248;
    const right = 1440 - (box.x + box.width);
    expect(Math.abs(left - right)).toBeLessThanOrEqual(1);
    // no horizontal scroll
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });

  test("CA-36: a 1280 px l'ordine del Tab è quello della specifica", async ({
    page,
    baseURL,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openFor(page, baseURL, "/oggi");
    const names: string[] = [];
    // 1 skip link + 2 lens buttons + 4 sections + Spesa + profile + 3 bar + main
    for (let i = 0; i < 13; i += 1) {
      await page.keyboard.press("Tab");
      names.push(
        await page.evaluate(() => {
          const el = document.activeElement as HTMLElement;
          const where = el.closest('[data-testid="barra-laterale"]')
            ? "laterale"
            : el.closest('[data-testid="barra-alto"]')
              ? "alto"
              : el.closest("main")
                ? "main"
                : "altro";
          const label =
            el.getAttribute("aria-label") ??
            (el.textContent ?? "").replace(/\s+/g, " ").trim();
          return `${where}:${label}`;
        }),
      );
    }
    // «Vai al contenuto» first
    expect(names[0]).toMatch(/Vai al contenuto/);
    const where = names.map((n) => n.split(":")[0]);
    // sidebar (lens, 4 sections, Spesa, profile), then the top bar, then main
    expect(where.slice(1, 9)).toEqual(Array(8).fill("laterale"));
    expect(where.slice(9, 12)).toEqual(["alto", "alto", "alto"]);
    const labels = names.map((n) => n.slice(n.indexOf(":") + 1));
    // the lens (Io, Nest) comes first
    expect(labels[1]).toMatch(/Io$/);
    expect(labels[2]).toMatch(/Nest$/);
    expect(labels.slice(3, 7)).toEqual(["Oggi", "Calendario", "Casa", "Spazi"]);
    expect(labels[7]).toBe("Spesa");
    expect(labels[8]).toMatch(/Il tuo Nest/);
    expect(labels[9]).toMatch(/Cerca/);
    expect(labels[10]).toBe("Notifiche");
    expect(labels[11]).toMatch(/Nuovo impegno/);
    expect(where[12]).toBe("main");
  });

  test("a 960 e 1280 px la voce attiva resta la stessa passando da una forma all'altra", async ({
    page,
    baseURL,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openFor(page, baseURL, "/casa/spesa");
    await expect(
      page.getByRole("navigation", NAV).getByRole("link", { name: "Casa" }),
    ).toHaveAttribute("aria-current", "page");
    for (const w of [960, 1280, 390]) {
      await page.setViewportSize({ width: w, height: 844 });
      await expect(page).toHaveURL(/\/casa\/spesa$/);
      await expect(
        page
          .getByRole("navigation", NAV)
          .getByRole("link", { name: "Casa" })
          .filter({ visible: true }),
        `${w}px`,
      ).toHaveAttribute("aria-current", "page");
    }
  });
});

test.describe("telefono girato (altezza sotto i 600 px)", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name !== "mobile",
      "Il formato si imposta nel test: si esegue una volta sola",
    );
    test.skip(!usersConfigured("A"), skipReason("A"));
  });

  for (const [w, h] of [
    [844, 390],
    [1024, 599],
  ] as const) {
    test(`D8: a ${w}×${h} vale la forma del telefono: barra in basso, testata, nessuna barra laterale, lettere ferme`, async ({
      page,
      baseURL,
    }) => {
      await page.setViewportSize({ width: w, height: h });
      await openFor(page, baseURL, "/spazi");
      await expect(page.getByTestId("barra-basso")).toBeVisible();
      expect(await width(page, "barra-laterale")).toBe(0);
      await expect(page.getByTestId("testata")).toBeVisible();
      await expect(
        page.getByRole("navigation", NAV).getByRole("link"),
      ).toHaveText(["Oggi", "Calendario", "Casa", "Spazi"]);
      // shortcuts only with the computer shape
      await page.keyboard.press("c");
      await expect(page).toHaveURL(/\/spazi$/);
      // the collapsed header at this height too
      await page.evaluate(() => window.scrollTo(0, 400));
      await expect(page.getByTestId("testata-raccolta")).toBeVisible();
    });
  }

  test("D8: a 1280×600 vale la forma del computer, a 1280×599 quella del telefono", async ({
    page,
    baseURL,
  }) => {
    await page.setViewportSize({ width: 1280, height: 600 });
    await openFor(page, baseURL, "/oggi");
    expect(await width(page, "barra-laterale")).toBe(248);
    await page.setViewportSize({ width: 1280, height: 599 });
    await expect(page.getByTestId("barra-basso")).toBeVisible();
    expect(await width(page, "barra-laterale")).toBe(0);
  });

  test("telefono: Calendario e Scadenze arrivano ad Aggiungi passando da Oggi con il «+»", async ({
    page,
    baseURL,
  }) => {
    for (const route of ["/calendario", "/casa/scadenze"]) {
      await openFor(page, baseURL, route);
      await page
        .getByRole("navigation", NAV)
        .getByRole("link", { name: "Oggi" })
        .click();
      await expect(page).toHaveURL(/\/oggi$/);
      const entry = page.getByRole("link", {
        name: "Nuovo impegno",
        exact: true,
      });
      await expect(entry).toBeVisible();
      await waitHydrated(entry);
      await entry.click();
      await expect(page, route).toHaveURL(/\/aggiungi$/);
    }
  });
});

test.describe("freccia indietro da un collegamento (CA-13)", () => {
  test("CA-13: da /impegni/<id> in scheda nuova «Indietro» porta a /calendario", async ({
    page,
    baseURL,
    casa,
  }) => {
    const id = await createNuoto(casa);
    await casa.signIn(page, baseURL, "Marco");
    await page.goto(detailPath(id, "2026-10-20"));
    const back = page
      .getByRole("link", { name: "Indietro", exact: true })
      .filter({ visible: true });
    await expect(back).toHaveCount(1);
    await waitHydrated(back);
    await back.click();
    await expect(page).toHaveURL(/\/calendario$/);
  });
});
