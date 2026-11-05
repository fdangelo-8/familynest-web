import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  CALL,
  installCalendarSide,
  labelSources,
  type CalendarSide,
} from "../fixtures/calendari-effetti-visuale";
import {
  NOW,
  detailUrl,
  installEventFake,
} from "../fixtures/dettaglio-impegno-fake";
import { installOggiFake, oggiNow } from "../fixtures/oggi-visuale";
import {
  FIXED_NOW,
  linkBoth,
  openCalendars,
  skipUnlessReady,
  withUser,
} from "../fixtures/calendari-collegati-visuale";
import { hasTestUser } from "../fixtures/visual-login";
import { signInAsCached } from "../fixtures/visual-login-cached";

// «Calendari collegati», part 2 (#34, PR #303): axe in every new state (source
// label in Oggi, imported event in Dettaglio, the locked form, the «Anche su»
// row and its notice, the rows of Profilo and Nest), names of the new controls,
// the keyboard on the «Anche su» switch and the «Riprova» of the notice, and
// touch areas of 44 px on mobile (elementFromPoint, never boundingBox).
// Data: the fakes of the other suites; the label and the link of the event come
// from tests/fixtures/calendari-effetti-visuale.ts. Nothing is written.

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

const isMobile = (name: string) => name === "mobile";

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => n.target.join(" ")),
    }));
}

/** True when the 44 x 44 px square around the centre of the control hits it. */
async function hasTouchArea(target: Locator, size = 44) {
  await target.evaluate((el) =>
    el.scrollIntoView({ block: "center", inline: "nearest" }),
  );
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

/** Outline or inner ring of the focused element, or «nessuno». */
async function focusRing(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return "nessuno";
    const own = getComputedStyle(el);
    if (own.outlineStyle !== "none" && parseFloat(own.outlineWidth) > 0) {
      return "contorno";
    }
    if (/inset/.test(own.boxShadow)) return "interno";
    return "nessuno";
  });
}

test.describe("Oggi, etichetta della fonte", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    test.skip(!hasTestUser("A"), "TEST_USER_A_* non impostati");
    const signedIn = await signInAsCached(context, baseURL!, "A");
    test.skip(!signedIn, "utente di test A non ancora creato (#55)");
  });

  async function open(page: Page) {
    await page.clock.setFixedTime(oggiNow("normale"));
    await labelSources(page, { "Call con Acme": "outlook" });
    await installOggiFake(page, { scenario: "normale" });
    await page.goto("/oggi");
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, {
      timeout: 20_000,
    });
    await expect(
      page
        .getByText("Outlook", { exact: true })
        .locator("visible=true")
        .first(),
    ).toBeVisible();
  }

  test("axe: nessuna violazione serious o critical", async ({ page }) => {
    await open(page);
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("l'etichetta è dentro il link dell'impegno e non cambia il suo nome per intero", async ({
    page,
  }) => {
    await open(page);
    const link = page
      .getByRole("link", { name: /Call con Acme/ })
      .locator("visible=true")
      .first();
    await expect(link).toContainText("Outlook");
    await expect(link.locator(".etichetta--piccola svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });
});

test.describe("Dettaglio impegno importato e «Anche su»", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    test.skip(!hasTestUser("A"), "TEST_USER_A_* non impostati");
    const signedIn = await signInAsCached(context, baseURL!, "A");
    test.skip(!signedIn, "utente di test A non ancora creato (#55)");
  });

  async function open(page: Page, side: CalendarSide) {
    await page.clock.install({ time: NOW });
    await installEventFake(page, { row: CALL });
    await installCalendarSide(page, side);
    await page.goto(detailUrl());
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Call con Acme",
      { timeout: 20_000 },
    );
  }

  async function openForm(page: Page) {
    await page
      .getByRole("main")
      .getByRole("button", { name: "Modifica" })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Modifica impegno" }),
    ).toBeVisible();
    await expect(page.getByLabel("Titolo")).toBeFocused();
  }

  const IMPORTED: CalendarSide = {
    link: { isImported: true, provider: "Google", calendarName: "Personale" },
  };
  const TARGET: CalendarSide = {
    target: { provider: "google", name: "Personale" },
  };

  const sw = (page: Page) =>
    page.getByRole("switch", { name: "Anche su Google", exact: true });

  test("axe: scheda di un impegno importato", async ({ page }) => {
    await open(page, IMPORTED);
    await expect(page.getByText("Origine", { exact: true })).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("axe: modulo di un impegno importato (campi bloccati)", async ({
    page,
  }) => {
    await open(page, IMPORTED);
    await openForm(page);
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("axe: modulo con «Anche su Google» spenta e accesa", async ({
    page,
  }) => {
    await open(page, TARGET);
    await openForm(page);
    expect(await seriousViolations(page)).toEqual([]);
    await sw(page).click();
    await expect(sw(page)).toHaveAttribute("aria-checked", "true");
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("axe: modulo con account da ricollegare", async ({ page }) => {
    await open(page, { ...TARGET, reconnect: true });
    await openForm(page);
    await expect(sw(page)).toBeDisabled();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("axe: avviso «salvato, ma Anche su non riuscito» con «Riprova»", async ({
    page,
  }) => {
    await open(page, { ...TARGET, alsoOnFails: true });
    await openForm(page);
    await page.getByLabel("Titolo").fill("Call con Acme, Milano");
    await sw(page).click();
    await page.getByRole("button", { name: "Salva le modifiche" }).click();
    const notice = page.getByTestId("anche-su-errore");
    await expect(notice).toBeVisible();
    await expect(notice).toHaveAttribute("role", "alert");
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("nomi: l'interruttore ha il nome «Anche su Google» e la descrizione del calendario", async ({
    page,
  }) => {
    await open(page, TARGET);
    await openForm(page);
    await expect(sw(page)).toBeVisible();
    await expect(
      page.getByRole("dialog", { name: "Modifica impegno" }),
    ).toContainText("Nel calendario Personale");
  });

  test("tastiera: Tab raggiunge l'interruttore, Spazio lo accende, il fuoco si vede", async ({
    page,
  }) => {
    await open(page, TARGET);
    await openForm(page);
    await sw(page).focus();
    await expect(sw(page)).toBeFocused();
    expect(await focusRing(page)).not.toBe("nessuno");
    await page.keyboard.press("Space");
    await expect(sw(page)).toHaveAttribute("aria-checked", "true");
    // No trap: Escape closes the form and the focus is given back to the page.
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("tastiera: «Riprova» dell'avviso si raggiunge con Tab e ha il fuoco visibile", async ({
    page,
  }) => {
    await open(page, { ...TARGET, alsoOnFails: true });
    await openForm(page);
    await page.getByLabel("Titolo").fill("Call con Acme, Milano");
    await sw(page).click();
    await page.getByRole("button", { name: "Salva le modifiche" }).click();
    const retry = page
      .getByTestId("anche-su-errore")
      .getByRole("button", { name: "Riprova" });
    await expect(retry).toBeVisible();
    let reached = false;
    for (let i = 0; i < 25 && !reached; i++) {
      await page.keyboard.press("Tab");
      reached = await retry.evaluate((el) => el === document.activeElement);
    }
    expect(reached).toBe(true);
    expect(await focusRing(page)).not.toBe("nessuno");
  });

  test.describe("aree di tocco di almeno 44 px (mobile)", () => {
    test.beforeEach(({}, testInfo) => {
      test.skip(!isMobile(testInfo.project.name), "area di tocco: solo mobile");
    });

    test("interruttore «Anche su Google»", async ({ page }) => {
      await open(page, TARGET);
      await openForm(page);
      expect(await hasTouchArea(sw(page))).toBe(true);
    });

    test("«Riprova» dell'avviso", async ({ page }) => {
      await open(page, { ...TARGET, alsoOnFails: true });
      await openForm(page);
      await page.getByLabel("Titolo").fill("Call con Acme, Milano");
      await sw(page).click();
      await page.getByRole("button", { name: "Salva le modifiche" }).click();
      const retry = page
        .getByTestId("anche-su-errore")
        .getByRole("button", { name: "Riprova" });
      await expect(retry).toBeVisible();
      expect(await hasTouchArea(retry)).toBe(true);
    });
  });
});

test.describe("righe «Calendari collegati» di Profilo e Nest", () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(FIXED_NOW);
  });

  async function linked(page: Page, body: () => Promise<void>) {
    skipUnlessReady();
    test.setTimeout(180_000);
    await withUser(page, async (ctx) => {
      await linkBoth(page, ctx);
      await openCalendars(page, "linked");
      await body();
    });
  }

  for (const path of ["/profilo", "/nest"]) {
    test(`${path}: axe e riga «Calendari collegati» (link, nome, area di tocco)`, async ({
      page,
    }, testInfo) => {
      await linked(page, async () => {
        await page.goto(path);
        await expect(page.getByRole("main")).toBeVisible();
        const row = page.getByRole("link", { name: /^Calendari collegati/ });
        await expect(row).toBeVisible();
        await expect(row).toContainText("Outlook, Google");
        expect(await seriousViolations(page)).toEqual([]);
        await row.focus();
        expect(await focusRing(page)).not.toBe("nessuno");
        if (isMobile(testInfo.project.name)) {
          expect(await hasTouchArea(row)).toBe(true);
        }
      });
    });
  }
});
