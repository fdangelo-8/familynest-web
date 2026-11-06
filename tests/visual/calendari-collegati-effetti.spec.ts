import { expect, test, type Page } from "@playwright/test";
import {
  CALL,
  installCalendarSide,
  labelSources,
} from "../fixtures/calendari-effetti-visuale";
import {
  NOW,
  detailUrl,
  installEventFake,
} from "../fixtures/dettaglio-impegno-fake";
import { installOggiFake, oggiNow } from "../fixtures/oggi-visuale";
import {
  SEARCH_NOW,
  openSearch,
  searchAndWait,
  shot as shootSearch,
} from "../fixtures/ricerca-open";
import { installRicercaFake } from "../fixtures/ricerca-fake";
import {
  FULL_WEEK,
  isMobile,
  openWeek,
  shoot as shootWeek,
  throwawayConfigured,
  throwawaySkipReason,
  waitForData,
  withNest,
} from "./calendario-settimana-helpers";
import {
  linkBoth,
  openCalendars,
  skipUnlessReady,
  withUser,
  FIXED_NOW,
} from "../fixtures/calendari-collegati-visuale";
import { waitForAnimationsToEnd } from "../fixtures/animations";
import { hasTestUser } from "../fixtures/visual-login";
import { signInAsCached } from "../fixtures/visual-login-cached";

// «Calendari collegati», part 2 (#34, PR #303): references of the effects on
// the pages already closed, at 390 and 1280 px (projects), one per state of the
// specification: the source label on the rows of Oggi, Calendario · Settimana
// and Ricerca; an imported event in Dettaglio impegno (the «Origine» row and
// the locked form); the «Anche su …» row of the form and its notice with
// «Riprova»; the rows «Calendari collegati» of Profilo and Nest.
// The reads of the pages with data come from the fakes of the other suites;
// the label and the link of the event are put on top by
// tests/fixtures/calendari-effetti-visuale.ts. Profilo and Nest use a
// throwaway user with the two fake accounts linked. The clock is fixed to
// Tuesday 20 October 2026, 15:52 (Rome), like the mockups.

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

const LABELS = {
  "Call con Acme": "outlook",
  "Workshop cliente": "outlook",
} as const;

test.describe("etichetta della fonte", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    test.skip(!hasTestUser("A"), "TEST_USER_A_* non impostati");
    const signedIn = await signInAsCached(context, baseURL!, "A");
    test.skip(!signedIn, "utente di test A non ancora creato (#55)");
  });

  test("Oggi: la scheda «Prossimo» ha l'etichetta «Outlook»", async ({
    page,
  }) => {
    await page.clock.setFixedTime(oggiNow("normale"));
    await labelSources(page, LABELS);
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
    await page.evaluate(() => document.fonts.ready);
    const base = page.viewportSize()!;
    for (let i = 0; i < 2; i++) {
      const height = await page.evaluate(
        () => document.documentElement.scrollHeight,
      );
      await page.setViewportSize({
        width: base.width,
        height: Math.max(base.height, height),
      });
    }
    await page.mouse.move(0, 0);
    await expect(page).toHaveScreenshot("oggi-etichetta.png");
  });

  test("Ricerca: una riga di impegno ha l'etichetta «Outlook»", async ({
    page,
  }, testInfo) => {
    await page.clock.setFixedTime(SEARCH_NOW);
    await labelSources(page, { "Nuoto Sofia": "outlook" });
    await installRicercaFake(page);
    await openSearch(page, testInfo);
    await searchAndWait(page, "nuoto");
    await expect(
      page.getByTestId("ricerca-riga").getByText("Outlook").first(),
    ).toBeVisible();
    await shootSearch(page, testInfo, "ricerca-etichetta.png");
  });

  test("Calendario · Settimana: le righe hanno l'etichetta «Outlook»", async ({
    page,
    baseURL,
  }) => {
    test.skip(!throwawayConfigured(), throwawaySkipReason);
    test.setTimeout(180_000);
    await labelSources(page, LABELS);
    await withNest(FULL_WEEK, async (nest) => {
      await openWeek(page, baseURL, nest, { lens: "nest" });
      await waitForData(page);
      if (isMobile(page)) {
        await expect(page.getByText("Liberi insieme").first()).toBeVisible();
      }
      await expect(
        page
          .getByText("Outlook", { exact: true })
          .locator("visible=true")
          .first(),
      ).toBeVisible();
      await shootWeek(page, "calendario-etichetta.png");
    });
  });
});

test.describe("Dettaglio impegno importato e «Anche su»", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    test.skip(!hasTestUser("A"), "TEST_USER_A_* non impostati");
    const signedIn = await signInAsCached(context, baseURL!, "A");
    test.skip(!signedIn, "utente di test A non ancora creato (#55)");
  });

  async function open(
    page: Page,
    side: Parameters<typeof installCalendarSide>[1],
  ) {
    await page.clock.install({ time: NOW });
    const fake = await installEventFake(page, { row: CALL });
    await installCalendarSide(page, side);
    await page.goto(detailUrl());
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Call con Acme",
      { timeout: 20_000 },
    );
    await page.evaluate(() => document.fonts.ready);
    return fake;
  }

  async function openForm(page: Page, imported = false) {
    await page
      .getByRole("main")
      .getByRole("button", { name: "Modifica" })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Modifica impegno" }),
    ).toBeVisible();
    // An imported event has the title locked: the focus is not on it.
    if (!imported) await expect(page.getByLabel("Titolo")).toBeFocused();
  }

  /** The switch inside the view: the sheet of the phone scrolls inside itself. */
  async function revealSwitch(page: Page) {
    await page
      .getByRole("switch", { name: "Anche su Google", exact: true })
      .scrollIntoViewIfNeeded();
    await waitForAnimationsToEnd(page);
  }

  async function shot(page: Page, name: string) {
    await page.mouse.move(0, 0);
    await expect(page).toHaveScreenshot(name);
  }

  const IMPORTED = {
    link: {
      isImported: true,
      provider: "Google" as const,
      calendarName: "Personale",
    },
  };

  test("scheda: la riga «Origine» di un impegno importato", async ({
    page,
  }) => {
    await open(page, IMPORTED);
    await expect(page.getByText("Origine", { exact: true })).toBeVisible();
    await shot(page, "importato-scheda.png");
  });

  test("modulo: un impegno importato è bloccato, resta «Chi lo vede»", async ({
    page,
  }) => {
    await open(page, IMPORTED);
    await openForm(page, true);
    await expect(
      page.getByRole("dialog", { name: "Modifica impegno" }),
    ).toContainText("Si cambia su Google");
    await shot(page, "importato-modulo.png");
  });

  test("modulo: la riga «Anche su Google», spenta", async ({ page }) => {
    await open(page, {
      target: { provider: "google", name: "Personale" },
    });
    await openForm(page);
    await expect(
      page.getByRole("switch", { name: "Anche su Google", exact: true }),
    ).toBeVisible();
    await revealSwitch(page);
    await shot(page, "anche-su-spenta.png");
  });

  test("modulo: la riga «Anche su Google», accesa", async ({ page }) => {
    await open(page, {
      target: { provider: "google", name: "Personale" },
    });
    await openForm(page);
    await page
      .getByRole("switch", { name: "Anche su Google", exact: true })
      .click();
    await expect(
      page.getByRole("switch", { name: "Anche su Google", exact: true }),
    ).toHaveAttribute("aria-checked", "true");
    await revealSwitch(page);
    await shot(page, "anche-su-accesa.png");
  });

  test("modulo: account da ricollegare, interruttore spento e avviso", async ({
    page,
  }) => {
    await open(page, {
      target: { provider: "google", name: "Personale" },
      reconnect: true,
    });
    await openForm(page);
    await expect(
      page.getByRole("switch", { name: "Anche su Google", exact: true }),
    ).toBeDisabled();
    await revealSwitch(page);
    await shot(page, "anche-su-da-ricollegare.png");
  });

  test("errore: salvato ma «Anche su» non riuscito, con «Riprova»", async ({
    page,
  }) => {
    await open(page, {
      target: { provider: "google", name: "Personale" },
      alsoOnFails: true,
    });
    await openForm(page);
    await page.getByLabel("Titolo").fill("Call con Acme, Milano");
    await page
      .getByRole("switch", { name: "Anche su Google", exact: true })
      .click();
    await page.getByRole("button", { name: "Salva le modifiche" }).click();
    await expect(page.getByTestId("anche-su-errore")).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    // The toast «Modifiche salvate» goes away by itself: shoot the resting page.
    await expect(
      page.getByRole("status").filter({ hasText: "Modifiche salvate" }),
    ).toHaveCount(0, { timeout: 20_000 });
    await shot(page, "anche-su-errore.png");
  });

  test("errore nel modulo: cambia solo «Anche su» e non riesce", async ({
    page,
  }) => {
    await open(page, {
      target: { provider: "google", name: "Personale" },
      alsoOnFails: true,
    });
    await openForm(page);
    await page
      .getByRole("switch", { name: "Anche su Google", exact: true })
      .click();
    await page.getByRole("button", { name: "Salva le modifiche" }).click();
    await expect(
      page.getByRole("dialog", { name: "Modifica impegno" }).getByRole("alert"),
    ).toBeVisible();
    await page
      .getByRole("dialog", { name: "Modifica impegno" })
      .getByRole("alert")
      .scrollIntoViewIfNeeded();
    await shot(page, "anche-su-errore-modulo.png");
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
      // «Tennis» on too: three calendars on, like the mockup («3 attivi»).
      const { error, count } = await ctx.user.client
        .from("external_calendars")
        .update({ is_enabled: true }, { count: "exact" })
        .eq("name", "Tennis");
      if (error || count === 0) throw new Error("Tennis non acceso");
      await openCalendars(page, "linked");
      await body();
    });
  }

  test("Il tuo profilo: «Outlook, Google» e il numero dei calendari", async ({
    page,
  }) => {
    await linked(page, async () => {
      await page.goto("/profilo");
      const row = page.locator("a.riga-lista", {
        hasText: "Calendari collegati",
      });
      await expect(row.locator(".riga-lista__info")).toHaveText(
        "Outlook, Google",
      );
      await expect(row.locator(".riga-lista__valore")).toHaveText("3");
      await expect(
        page.getByRole("heading", { level: 1 }).locator("visible=true").first(),
      ).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      // The throwaway user has a random mail: put back the one of the mockup.
      await page.evaluate(() => {
        for (const el of document.querySelectorAll("main *")) {
          if (
            el.children.length === 0 &&
            /@example\.test/.test(el.textContent ?? "")
          ) {
            el.textContent = (el.textContent ?? "").replace(
              /\S+@example\.test/,
              "marco.dangelo@gmail.com",
            );
          }
        }
      });
      await waitForAnimationsToEnd(page);
      await page.mouse.move(0, 0);
      await expect(page).toHaveScreenshot("profilo-calendari.png", {
        fullPage: true,
      });
    });
  });

  test("Il tuo Nest: «Outlook, Google · 3 attivi»", async ({ page }) => {
    await linked(page, async () => {
      await page.goto("/nest");
      const row = page.locator("a.riga-lista", {
        hasText: "Calendari collegati",
      });
      await expect(row.locator(".riga-lista__info")).toHaveText(
        "Outlook, Google · 3 attivi",
      );
      await expect(
        page.getByRole("heading", { level: 1 }).locator("visible=true").first(),
      ).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await waitForAnimationsToEnd(page);
      await page.mouse.move(0, 0);
      await expect(page).toHaveScreenshot("nest-calendari.png", {
        fullPage: true,
      });
    });
  });
});
