import type { Page } from "@playwright/test";
import {
  GOOGLE,
  SAVE_ERROR,
  accountSection,
  alerts,
  at,
  button,
  calendarRow,
  clock,
  directionRadio,
  eventBlocks,
  expect,
  expectSwitch,
  failCalendarWrites,
  linkFromPage,
  needsFake,
  nextSaturday,
  openCalendars,
  openDay,
  openSettings,
  rowSummary,
  rowSwitch,
  saveSettings,
  targetRow,
  test,
  tomorrow,
  visibilityButton,
  waitHydrated,
  withEvents,
  withLinker,
  type Linker,
} from "../fixtures/calendari-collegati";

// «Calendari collegati» (#34, parte 1): interruttori (CA-12 ... CA-16) e
// impostazioni di un calendario (CA-17 ... CA-23). Fornitore finto, utenti usa
// e getta; gli orari sono sempre calcolati dal giorno in cui gira il test.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });
test.describe.configure({ timeout: 90_000 });

const TENNIS = "Tennis con Luca";

/** U linked to the standard Google, on the page. */
async function linked(
  ctx: Linker,
  page: Page,
  events: Parameters<typeof withEvents>[1] = {},
) {
  await ctx.prepare(withEvents(GOOGLE, events));
  await ctx.signIn(page);
  await linkFromPage(page, "google");
  return accountSection(page, "google", GOOGLE.email);
}

test.describe("interruttori", () => {
  test("CA-12: accendere «Sincronizza Tennis» lo mostra acceso, lo conserva e porta l'impegno in /calendario", async ({
    page,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      const day = tomorrow();
      const section = await linked(u, page, {
        tennis: [
          {
            id: "tennis-1",
            title: TENNIS,
            startsAt: at(day, 18),
            endsAt: at(day, 19, 30),
          },
        ],
      });
      const row = calendarRow(section, "Tennis");
      await expect(rowSummary(row)).toHaveText("Non sincronizzato");
      await waitHydrated(rowSwitch(row, "Tennis"));
      await rowSwitch(row, "Tennis").click();
      await expectSwitch(row, "Tennis", true);
      await expect(rowSummary(row)).toHaveText("Entrata e uscita · Occupato");

      await u.waitForEvents(TENNIS, 1);
      await openCalendars(page);
      const again = calendarRow(
        accountSection(page, "google", GOOGLE.email),
        "Tennis",
      );
      await expectSwitch(again, "Tennis", true);

      await openDay(page, day);
      await expect(eventBlocks(page, TENNIS)).toHaveCount(1);
    });
  });

  test("CA-13: spegnere «Sincronizza Tennis» toglie l'impegno da /calendario e dal database", async ({
    page,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      const day = tomorrow();
      const section = await linked(u, page, {
        tennis: [
          {
            id: "tennis-1",
            title: TENNIS,
            startsAt: at(day, 18),
            endsAt: at(day, 19, 30),
          },
        ],
      });
      const row = calendarRow(section, "Tennis");
      await waitHydrated(rowSwitch(row, "Tennis"));
      await rowSwitch(row, "Tennis").click();
      await expectSwitch(row, "Tennis", true);
      await u.waitForEvents(TENNIS, 1);

      await openCalendars(page);
      const same = calendarRow(
        accountSection(page, "google", GOOGLE.email),
        "Tennis",
      );
      await waitHydrated(rowSwitch(same, "Tennis"));
      await rowSwitch(same, "Tennis").click();
      await expectSwitch(same, "Tennis", false);
      await expect(rowSummary(same)).toHaveText("Non sincronizzato");

      await u.waitForEvents(TENNIS, 0);
      await openDay(page, day);
      await expect(eventBlocks(page, TENNIS)).toHaveCount(0);
    });
  });

  test("CA-14: se il salvataggio dell'interruttore fallisce, l'interruttore torna spento e compare l'errore", async ({
    page,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      const section = await linked(u, page);
      const row = calendarRow(section, "Tennis");
      await waitHydrated(rowSwitch(row, "Tennis"));
      await failCalendarWrites(page);
      await rowSwitch(row, "Tennis").click();

      await expect(alerts(page).filter({ hasText: SAVE_ERROR })).toBeVisible();
      await expectSwitch(row, "Tennis", false);
      await expect(rowSummary(row)).toHaveText("Non sincronizzato");
    });
  });

  test("CA-15: un calendario di sola lettura si accende «Solo in entrata» e «Entrata e uscita» è disabilitata", async ({
    page,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      const section = await linked(u, page);
      const row = calendarRow(section, "Festività in Italia");
      await waitHydrated(rowSwitch(row, "Festività in Italia"));
      await rowSwitch(row, "Festività in Italia").click();
      await expectSwitch(row, "Festività in Italia", true);
      await expect(rowSummary(row)).toHaveText("Solo in entrata · Occupato");

      const dialog = await openSettings(page, section, "Festività in Italia");
      await expect(directionRadio(dialog, "Entrata e uscita")).toHaveAttribute(
        "aria-disabled",
        "true",
      );
      await expect(directionRadio(dialog, "Solo in entrata")).toHaveAttribute(
        "aria-checked",
        "true",
      );
    });
  });

  test("CA-16: con «Personale» unico calendario in entrata e uscita, «Dove vanno i nuovi impegni» lo propone", async ({
    page,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await linked(u, page);
      await expect(targetRow(page)).toContainText(
        "Quando scegli «Anche su» in Aggiungi",
      );
      await expect(targetRow(page).locator(".riga-lista__valore")).toHaveText(
        "Personale",
      );
    });
  });
});

test.describe("impostazioni di un calendario", () => {
  test("CA-17: il dialogo di «Personale» ha nome, titolo, direzione, visibilità, interruttori e ultima sincronizzazione", async ({
    page,
    baseURL,
  }, testInfo) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      const section = await linked(u, page);
      const dialog = await openSettings(page, section, "Personale");
      await expect(dialog).toHaveClass(
        testInfo.project.name === "mobile" ? /\bfoglio\b/ : /\bmodale\b/,
      );
      await expect(
        dialog.getByRole("heading", { name: "Personale · Google", level: 2 }),
      ).toBeVisible();

      const direction = dialog.getByRole("radiogroup", { name: "Direzione" });
      await expect(
        directionRadio(direction, "Entrata e uscita"),
      ).toHaveAttribute("aria-checked", "true");
      await expect(direction).toContainText(
        "Quello che crei su Google arriva qui, e puoi mandare su Google gli impegni di FamilyNest.",
      );
      await expect(visibilityButton(dialog, "Solo io")).toHaveAttribute(
        "aria-pressed",
        "false",
      );
      await expect(visibilityButton(dialog, "Occupato")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await expect(visibilityButton(dialog, "Tutti")).toHaveAttribute(
        "aria-pressed",
        "false",
      );
      await expect(
        dialog.getByRole("switch", { name: "Conta per Liberi insieme" }),
      ).toHaveAttribute("aria-checked", "true");
      await expect(
        dialog.getByRole("switch", { name: "Solo giorni feriali" }),
      ).toHaveAttribute("aria-checked", "false");

      const synced = (await u.calendars()).find(
        (row) => row.name === "Personale",
      )?.last_synced_at;
      expect(synced).toBeTruthy();
      await expect(dialog.getByText(/^Ultima sincronizzazione:/)).toHaveText(
        `Ultima sincronizzazione: oggi alle ${clock(synced!)}.`,
      );

      await expect(button(dialog, "Salva")).toBeVisible();
      if (testInfo.project.name === "desktop") {
        await expect(button(dialog, "Annulla")).toBeVisible();
      }
    });
  });

  test("CA-18: «Solo in entrata» e «Solo io» con «Salva» chiudono il dialogo e restano dopo il ricaricamento", async ({
    page,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      const section = await linked(u, page);
      const dialog = await openSettings(page, section, "Personale");
      await directionRadio(dialog, "Solo in entrata").click();
      await visibilityButton(dialog, "Solo io").click();
      await saveSettings(dialog);

      const row = calendarRow(section, "Personale");
      await expect(rowSummary(row)).toHaveText("Solo in entrata · Solo io");
      await openCalendars(page);
      await expect(
        rowSummary(
          calendarRow(
            accountSection(page, "google", GOOGLE.email),
            "Personale",
          ),
        ),
      ).toHaveText("Solo in entrata · Solo io");
    });
  });

  test("CA-19: «Chiudi» ed «Esc» chiudono senza salvare", async ({
    page,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      const section = await linked(u, page);
      const row = calendarRow(section, "Personale");

      let dialog = await openSettings(page, section, "Personale");
      await visibilityButton(dialog, "Tutti").click();
      await expect(visibilityButton(dialog, "Tutti")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await button(dialog, "Chiudi").click();
      await expect(dialog).toBeHidden();
      await expect(rowSummary(row)).toHaveText("Entrata e uscita · Occupato");

      dialog = await openSettings(page, section, "Personale");
      await visibilityButton(dialog, "Tutti").click();
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(rowSummary(row)).toHaveText("Entrata e uscita · Occupato");
      expect(
        (await u.calendars()).find((c) => c.name === "Personale")?.visibility,
      ).toBe("busy");
    });
  });

  test("CA-20: se «Salva» fallisce il dialogo resta aperto con «Tutti» premuto e l'errore", async ({
    page,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      const section = await linked(u, page);
      const dialog = await openSettings(page, section, "Personale");
      await visibilityButton(dialog, "Tutti").click();
      await failCalendarWrites(page);
      await button(dialog, "Salva").click();

      await expect(alerts(page).filter({ hasText: SAVE_ERROR })).toBeVisible();
      await expect(dialog).toBeVisible();
      await expect(visibilityButton(dialog, "Tutti")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });
  });

  test("CA-21: «Solo giorni feriali» toglie l'impegno di sabato e spegnerlo lo riporta", async ({
    page,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      const saturday = nextSaturday();
      const title = "Pranzo dai nonni";
      const section = await linked(u, page, {
        personale: [
          {
            id: "pranzo",
            title,
            startsAt: at(saturday, 12),
            endsAt: at(saturday, 14),
          },
        ],
      });
      await u.waitForEvents(title, 1);

      let dialog = await openSettings(page, section, "Personale");
      await dialog.getByRole("switch", { name: "Solo giorni feriali" }).click();
      await saveSettings(dialog);
      await u.fake.sync(u.user.id);
      await u.waitForEvents(title, 0);
      await openDay(page, saturday);
      await expect(eventBlocks(page, title)).toHaveCount(0);

      await openCalendars(page);
      dialog = await openSettings(
        page,
        accountSection(page, "google", GOOGLE.email),
        "Personale",
      );
      await dialog.getByRole("switch", { name: "Solo giorni feriali" }).click();
      await saveSettings(dialog);
      await u.fake.sync(u.user.id);
      await u.waitForEvents(title, 1);
      await openDay(page, saturday);
      await expect(eventBlocks(page, title)).toHaveCount(1);
    });
  });

  test("CA-22: mettere «Personale» in «Solo in entrata» porta «Dove vanno i nuovi impegni» a «Nessuno»", async ({
    page,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      const section = await linked(u, page);
      await expect(targetRow(page).locator(".riga-lista__valore")).toHaveText(
        "Personale",
      );
      const dialog = await openSettings(page, section, "Personale");
      await directionRadio(dialog, "Solo in entrata").click();
      await saveSettings(dialog);
      await expect(targetRow(page).locator(".riga-lista__valore")).toHaveText(
        "Nessuno",
      );
    });
  });

  test("CA-23: la scelta di «Dove vanno i nuovi impegni» elenca i calendari scrivibili e si conserva", async ({
    page,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      const section = await linked(u, page);
      const tennis = calendarRow(section, "Tennis");
      await waitHydrated(rowSwitch(tennis, "Tennis"));
      await rowSwitch(tennis, "Tennis").click();
      await expectSwitch(tennis, "Tennis", true);
      await expect
        .poll(async () => (await u.calendars()).filter((c) => c.is_enabled))
        .toHaveLength(2);

      await targetRow(page).click();
      const dialog = page.getByRole("dialog", {
        name: "Dove vanno i nuovi impegni",
        exact: true,
      });
      await expect(dialog).toBeVisible();
      const choices = dialog.getByRole("radio");
      await expect(choices).toHaveCount(3);
      await expect(choices.nth(0)).toContainText("Personale · Google");
      await expect(choices.nth(1)).toContainText("Tennis · Google");
      await expect(choices.nth(2)).toContainText("Nessuno");
      await expect(dialog).not.toContainText("Festività in Italia");

      await dialog.getByRole("radio", { name: /^Tennis · Google/ }).click();
      await saveSettings(dialog);
      await expect(targetRow(page).locator(".riga-lista__valore")).toHaveText(
        "Tennis",
      );
      await openCalendars(page);
      await expect(targetRow(page).locator(".riga-lista__valore")).toHaveText(
        "Tennis",
      );
    });
  });
});
