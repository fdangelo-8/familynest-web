import { expect, test } from "@playwright/test";
import { holdNavigation } from "../fixtures/held-navigation";
import {
  FIXED_NOW,
  GOOGLE,
  OUTLOOK,
  answerConsent,
  connectFromEmptyState,
  linkBoth,
  openCalendarSheet,
  openCalendars,
  openConnectSheet,
  openTargetSheet,
  putAccountIn,
  shoot,
  withUser,
} from "../fixtures/calendari-collegati-visuale";

// PR #289 (#34 part 1, #35): references of «Calendari collegati»
// (/calendari-collegati) at 390 and 1280 px, one per state of the
// specification. Every test makes a throwaway user, prepares the fake
// provider (the mails and calendars of the mockup 26) and links the accounts
// with the real path of the page. The times come from the server clock: they
// are put back to the ones of the mockup before the shot (see freezeTimes).
// The whole-page error cannot be provoked from the browser (the read runs on
// the server): checked by hand, no reference.

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

test.describe.configure({ timeout: 120_000 });

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW);
});

test.describe("non collegato", () => {
  test("#34: stato vuoto con «Collega Google» e «Collega Outlook»", async ({
    page,
  }) => {
    await withUser(page, async () => {
      await openCalendars(page, "empty");
      await shoot(page, "calendari-collegati-vuoto.png");
    });
  });

  test("#34: accesso annullato (Outlook)", async ({ page }) => {
    await withUser(page, async () => {
      await openCalendars(page, "empty");
      await connectFromEmptyState(page, "Outlook");
      await answerConsent(page, "Nega");
      await expect(page.getByText("annullato", { exact: false })).toBeVisible();
      await shoot(page, "calendari-collegati-annullato.png");
    });
  });

  test("#35: l'azienda non permette app esterne (Outlook)", async ({
    page,
  }) => {
    await withUser(page, async () => {
      await openCalendars(page, "empty");
      await connectFromEmptyState(page, "Outlook");
      await answerConsent(page, "Serve l'approvazione dell'amministratore");
      await expect(
        page.getByText("non permette di collegare app esterne", {
          exact: false,
        }),
      ).toBeVisible();
      await shoot(page, "calendari-collegati-approvazione.png");
    });
  });

  test("#35: permesso del calendario non dato (Outlook)", async ({ page }) => {
    await withUser(page, async () => {
      await openCalendars(page, "empty");
      await connectFromEmptyState(page, "Outlook");
      await answerConsent(page, "Consenti senza calendario");
      await expect(
        page.getByText("non ha un calendario che possiamo leggere"),
      ).toBeVisible();
      await shoot(page, "calendari-collegati-senza-calendario-outlook.png");
    });
  });

  test("#34: permesso del calendario non dato (Google)", async ({ page }) => {
    await withUser(page, async () => {
      await openCalendars(page, "empty");
      await connectFromEmptyState(page, "Google");
      await answerConsent(page, "Consenti senza calendario");
      await expect(page.getByText("ma non al calendario")).toBeVisible();
      await shoot(page, "calendari-collegati-senza-calendario-google.png");
    });
  });

  test("#34: caricamento della pagina", async ({ page }) => {
    await withUser(page, async () => {
      // Only the real navigation is held, not the prefetch of the loading
      // shell; the click waits for that prefetch (fixtures/held-navigation.ts).
      const { release, clickWhenReady } = await holdNavigation(
        page,
        /\/calendari-collegati\?_rsc=/,
      );
      await page.goto("/nest");
      await expect(
        page.getByRole("heading", { level: 1, name: "Casa D'Angelo" }),
      ).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await clickWhenReady(
        page.getByRole("main").getByRole("link", {
          name: /^Calendari collegati/,
        }),
      );
      await expect(page.getByText("Caricamento in corso")).toBeAttached();
      await shoot(page, "calendari-collegati-caricamento.png", false);
      release();
      await expect(page).toHaveURL(/\/calendari-collegati$/);
      await expect(
        page.getByText("Nessun calendario collegato", { exact: true }),
      ).toBeVisible();
    });
  });
});

test.describe("collegato", () => {
  test("#34, #35: Outlook e Google con i loro calendari", async ({ page }) => {
    await withUser(page, async (ctx) => {
      await linkBoth(page, ctx);
      await shoot(page, "calendari-collegati-collegato.png");
    });
  });

  test("#34: sincronizzazione in corso dopo aver acceso un calendario", async ({
    page,
  }) => {
    await withUser(page, async (ctx) => {
      await linkBoth(page, ctx);
      // The provider answers slowly: the progress notice stays on screen.
      await ctx.fake.fail({
        userId: ctx.user.id,
        email: OUTLOOK.email,
        provider: "outlook",
        slowMs: 60_000,
      });
      const toggle = page.getByRole("switch", {
        name: "Sincronizza Ferie del team",
        exact: true,
      });
      await expect(async () => {
        if ((await toggle.getAttribute("aria-checked")) !== "true") {
          await toggle.click();
        }
        await expect(
          page.getByText(/^Sincronizzazione in corso: \d+ calendar/),
        ).toBeVisible({ timeout: 3000 });
      }).toPass({ timeout: 30_000 });
      await shoot(page, "calendari-collegati-sincronizzazione.png");
    });
  });

  test("#34, #35: «Ricollega» quando Outlook rifiuta l'accesso", async ({
    page,
  }) => {
    await withUser(page, async (ctx) => {
      await linkBoth(page, ctx);
      await putAccountIn(ctx, OUTLOOK.email, {
        status: "reconnect",
        failingMinutesAgo: 5,
      });
      await openCalendars(page, "linked");
      await expect(
        page.getByRole("button", { name: "Ricollega", exact: true }),
      ).toBeVisible();
      await shoot(page, "calendari-collegati-ricollega.png");
    });
  });

  test("#35: «Ricollega» con lo stesso account: toast e nessun avviso", async ({
    page,
  }) => {
    await withUser(page, async (ctx) => {
      await linkBoth(page, ctx);
      await putAccountIn(ctx, OUTLOOK.email, {
        status: "reconnect",
        failingMinutesAgo: 5,
      });
      await openCalendars(page, "linked");
      await page
        .getByRole("button", { name: "Ricollega", exact: true })
        .click();
      await page.waitForURL(/\/fornitore-finto\/outlook/);
      await answerConsent(page);
      // CA-9 of #35: the notice is gone and there is a single Outlook section.
      await expect(page.getByText("ricollegato.")).toBeVisible();
      await expect(
        page.getByRole("heading", { level: 2, name: "Outlook" }),
      ).toHaveCount(1);
      await expect(page.getByText("Non riusciamo a sincronizzare")).toHaveCount(
        0,
      );
      await shoot(page, "calendari-collegati-ricollegato.png", false);
    });
  });

  test("#34: errore del fornitore dopo 24 ore (Google)", async ({ page }) => {
    await withUser(page, async (ctx) => {
      await linkBoth(page, ctx);
      // Synchronised a moment ago, so the page does not synchronise again.
      await putAccountIn(ctx, GOOGLE.email, {
        status: "temporary_error",
        failingMinutesAgo: 30 * 60,
        syncedMinutesAgo: 1,
      });
      await openCalendars(page, "linked");
      await expect(page.getByText("non risponde")).toBeVisible();
      await shoot(page, "calendari-collegati-errore-fornitore.png");
    });
  });

  test("#34: offline", async ({ page, context }) => {
    await withUser(page, async (ctx) => {
      await linkBoth(page, ctx);
      await context.setOffline(true);
      await expect(page.getByText(/^Sei offline/)).toBeVisible();
      await shoot(page, "calendari-collegati-offline.png");
      await context.setOffline(false);
    });
  });
});

test.describe("fogli e dialoghi", () => {
  test("#34, #35: impostazioni di «Lavoro» (Outlook)", async ({ page }) => {
    await withUser(page, async (ctx) => {
      await linkBoth(page, ctx);
      await openCalendarSheet(page, "Lavoro");
      await shoot(page, "calendari-collegati-foglio-lavoro.png", false);
    });
  });

  test("#34, #35: impostazioni di un calendario di sola lettura", async ({
    page,
  }) => {
    await withUser(page, async (ctx) => {
      await linkBoth(page, ctx);
      await openCalendarSheet(page, "Ferie del team");
      await shoot(page, "calendari-collegati-foglio-sola-lettura.png", false);
    });
  });

  test("#34: impostazioni di un calendario Google", async ({ page }) => {
    await withUser(page, async (ctx) => {
      await linkBoth(page, ctx);
      await openCalendarSheet(page, "Tennis");
      await shoot(page, "calendari-collegati-foglio-tennis.png", false);
    });
  });

  test("#34: «Collega un altro account»", async ({ page }) => {
    await withUser(page, async (ctx) => {
      await linkBoth(page, ctx);
      await openConnectSheet(page);
      await shoot(page, "calendari-collegati-foglio-collega.png", false);
    });
  });

  test("#34: «Dove vanno i nuovi impegni»", async ({ page }) => {
    await withUser(page, async (ctx) => {
      await linkBoth(page, ctx);
      await openTargetSheet(page);
      await shoot(page, "calendari-collegati-foglio-dove-vanno.png", false);
    });
  });

  test("#34: dialogo «Scollega»", async ({ page }) => {
    await withUser(page, async (ctx) => {
      await linkBoth(page, ctx);
      const sheet = await openCalendarSheet(page, "Lavoro");
      await sheet
        .getByRole("button", { name: "Scollega l'account Outlook" })
        .click();
      await expect(page.getByRole("alertdialog")).toBeVisible();
      await shoot(page, "calendari-collegati-dialogo-scollega.png", false);
    });
  });

  test("#35: dopo «Scollega» di Outlook: avviso con i link a Microsoft", async ({
    page,
  }) => {
    await withUser(page, async (ctx) => {
      await linkBoth(page, ctx);
      const sheet = await openCalendarSheet(page, "Lavoro");
      await sheet
        .getByRole("button", { name: "Scollega l'account Outlook" })
        .click();
      await page
        .getByRole("alertdialog")
        .getByRole("button", { name: "Scollega", exact: true })
        .click();
      await expect(page.getByText("Account personale")).toBeVisible();
      await shoot(page, "calendari-collegati-scollegato.png", false);
    });
  });

  test("#34: toast «è già collegato» dopo un secondo «Collega Outlook»", async ({
    page,
  }) => {
    await withUser(page, async (ctx) => {
      await linkBoth(page, ctx);
      const sheet = await openConnectSheet(page);
      await sheet.getByRole("button", { name: "Collega Outlook" }).click();
      await page.waitForURL(/\/fornitore-finto\/outlook/);
      await answerConsent(page);
      await expect(page.getByText("è già collegato.")).toBeVisible();
      await shoot(page, "calendari-collegati-gia-collegato.png", false);
    });
  });

  test("#34: toast «collegato» dopo il primo collegamento", async ({
    page,
  }) => {
    await withUser(page, async () => {
      await openCalendars(page, "empty");
      await connectFromEmptyState(page, "Outlook");
      await answerConsent(page);
      await expect(
        page.getByText("collegato. Scegli quali calendari"),
      ).toBeVisible();
      await shoot(page, "calendari-collegati-appena-collegato.png", false);
    });
  });
});
