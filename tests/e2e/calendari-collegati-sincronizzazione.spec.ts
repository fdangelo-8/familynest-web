import type { Locator } from "@playwright/test";
import {
  GOOGLE,
  accountSection,
  addDays,
  alerts,
  at,
  button,
  calendarRow,
  clock,
  createNestEvent,
  eventBlocks,
  expect,
  expectSwitch,
  freeBlocks,
  linkAs,
  inNewPage,
  linkInBackground,
  needsFake,
  openCalendars,
  openDay,
  openSettings,
  rowSummary,
  rowSwitch,
  test,
  today,
  tomorrow,
  waitHydrated,
  withEvents,
  withLinker,
  withLinkerRita,
  answer,
  type FakeEvent,
} from "../fixtures/calendari-collegati";

// «Calendari collegati» (#34, parte 1): sincronizzazione (CA-32 ... CA-39) ed
// errori (CA-40 ... CA-42). Fornitore finto con eventi preparati dal test;
// tutti gli orari partono dal giorno in cui gira il test.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });
test.describe.configure({ timeout: 90_000 });

const VISITA = "Visita in banca";

/** The different texts of some blocks (a column of U appears with the event). */
async function distinctTexts(blocks: Locator): Promise<string[]> {
  return [...new Set(await blocks.allTextContents())].sort();
}

const visita = (from: number, to: number, extra: Partial<FakeEvent> = {}) =>
  ({
    id: "visita",
    title: VISITA,
    startsAt: at(today(), from),
    endsAt: at(today(), to),
    ...extra,
  }) satisfies FakeEvent;

test.describe("sincronizzazione", () => {
  test("CA-32: se sul fornitore l'orario cambia, dopo la sincronizzazione l'impegno è alle nuove ore", async ({
    page,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await linkAs(
        u,
        page,
        withEvents(GOOGLE, { personale: [visita(10, 11)] }),
      );
      await u.waitForEvents(VISITA, 1);
      expect(new Date((await u.events(VISITA))[0]!.starts_at).getTime()).toBe(
        new Date(at(today(), 10)).getTime(),
      );

      await u.provide(GOOGLE, "personale", [visita(12, 13, { version: "2" })]);
      await u.fake.sync(u.user.id);
      await expect
        .poll(async () => {
          const rows = await u.events(VISITA);
          return rows.map((row) => new Date(row.starts_at).getTime());
        })
        .toEqual([new Date(at(today(), 12)).getTime()]);

      await openDay(page, today());
      await expect(eventBlocks(page, VISITA)).toHaveCount(1);
    });
  });

  test("CA-33: se sul fornitore l'evento si annulla o si cancella, sparisce per U e dal database", async ({
    page,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await linkAs(
        u,
        page,
        withEvents(GOOGLE, { personale: [visita(10, 11)] }),
      );
      await u.waitForEvents(VISITA, 1);

      await u.provide(GOOGLE, "personale", [
        visita(10, 11, { status: "cancelled", version: "2" }),
      ]);
      await u.fake.sync(u.user.id);
      await u.waitForEvents(VISITA, 0);
      await openDay(page, today());
      await expect(eventBlocks(page, VISITA)).toHaveCount(0);

      await u.provide(GOOGLE, "personale", [visita(10, 11, { version: "3" })]);
      await u.fake.sync(u.user.id);
      await u.waitForEvents(VISITA, 1);

      await u.provide(GOOGLE, "personale", [
        visita(10, 11, { deleted: true, version: "4" }),
      ]);
      await u.fake.sync(u.user.id);
      await u.waitForEvents(VISITA, 0);
    });
  });

  test("CA-34: un titolo di 150 caratteri diventa di 100 e finisce con «…»; senza titolo è «Senza titolo»", async ({
    page,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      const long = `Lungo${"x".repeat(145)}`;
      expect(long).toHaveLength(150);
      await linkAs(
        u,
        page,
        withEvents(GOOGLE, {
          personale: [
            {
              id: "lungo",
              title: long,
              startsAt: at(today(), 10),
              endsAt: at(today(), 11),
            },
            {
              id: "senza",
              startsAt: at(today(), 12),
              endsAt: at(today(), 13),
            },
          ],
        }),
      );
      await u.waitForEvents("Senza titolo", 1);
      const rows = await u.events();
      const cut = rows.find((row) => row.title.startsWith("Lungo"));
      expect(cut).toBeTruthy();
      expect(Array.from(cut!.title)).toHaveLength(100);
      expect(cut!.title.endsWith("…")).toBe(true);
    });
  });

  test("CA-35: una serie settimanale di quattro volte compare quattro volte", async ({
    page,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      const title = "Corso di inglese";
      const first = new Date(at(tomorrow(), 19)).getTime();
      await linkAs(
        u,
        page,
        withEvents(GOOGLE, {
          personale: [
            {
              id: "corso",
              title,
              startsAt: at(tomorrow(), 19),
              endsAt: at(tomorrow(), 20),
              repeat: { everyDays: 7, count: 4 },
            },
          ],
        }),
      );
      await u.waitForEvents(title, 4);
      const starts = (await u.events(title)).map((row) =>
        new Date(row.starts_at).getTime(),
      );
      expect(starts).toEqual(
        [0, 1, 2, 3].map((week) => first + week * 7 * 86_400_000),
      );

      await openDay(page, tomorrow());
      await expect(eventBlocks(page, title)).toHaveCount(1);
    });
  });

  test.skip("CA-35 (terza volta spostata alle 20:00): il fornitore finto non sa spostare una sola occorrenza", async () => {
    // `set-events` indicizza gli eventi per id e `repeat` produce occorrenze
    // identiche: non si può preparare «la terza volta alle 20:00». La parte di
    // CA-35 sulle quattro volte è verificata sopra.
  });

  test("CA-36: un invito rifiutato non compare", async ({ page, baseURL }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await linkAs(
        u,
        page,
        withEvents(GOOGLE, {
          personale: [
            {
              id: "cena-az",
              title: "Cena aziendale",
              declined: true,
              startsAt: at(today(), 20),
              endsAt: at(today(), 22),
            },
            visita(10, 11),
          ],
        }),
      );
      await u.waitForEvents(VISITA, 1);
      await u.fake.sync(u.user.id);
      expect(await u.events("Cena aziendale")).toHaveLength(0);
      await openDay(page, today());
      await expect(eventBlocks(page, "Cena aziendale")).toHaveCount(0);
      await expect(eventBlocks(page, VISITA)).toHaveCount(1);
    });
  });

  test("CA-37: «Liberi insieme» tiene conto di «Riunione serale» e smette se «Conta per Liberi insieme» si spegne", async ({
    page,
    browser,
    baseURL,
  }) => {
    needsFake();
    await withLinkerRita(baseURL, async (u) => {
      const day = tomorrow();
      await createNestEvent(u, "Dentista", day, [9, 0], [10, 0]);
      await u.prepare(GOOGLE);
      await linkInBackground(browser, u, "google");
      await u.provide(GOOGLE, "personale", [
        {
          id: "riunione",
          title: "Riunione serale",
          startsAt: at(day, 20),
          endsAt: at(day, 21, 30),
        },
      ]);
      await u.fake.sync(u.user.id);
      await u.waitForEvents("Riunione serale", 1);

      await u.asRita.signIn(page);
      await openDay(page, day);
      await expect(freeBlocks(page).first()).toContainText(
        "Liberi insieme dalle 18:00 alle 20:00",
      );

      await u.setCalendar("Personale", { counts_for_free_time: false });
      await openDay(page, day);
      await expect(freeBlocks(page).first()).toContainText(
        "Liberi insieme dalle 18:00 alle 23:00",
      );
    });
  });

  test("CA-38: un evento «tutto il giorno» compare nel giorno e non cambia «Liberi insieme»", async ({
    page,
    browser,
    baseURL,
  }) => {
    needsFake();
    await withLinkerRita(baseURL, async (u) => {
      const day = tomorrow();
      const title = "Festa della Repubblica";
      await createNestEvent(u, "Dentista", day, [9, 0], [10, 0]);
      await u.prepare(GOOGLE);
      await linkInBackground(browser, u, "google");

      await u.asRita.signIn(page);
      await openDay(page, day);
      await expect(freeBlocks(page).first()).toBeAttached();
      const before = await distinctTexts(freeBlocks(page));

      await u.provide(GOOGLE, "personale", [
        {
          id: "festa",
          title,
          allDay: true,
          startDate: day,
          endDate: addDays(day, 1),
        },
      ]);
      await u.fake.sync(u.user.id);
      await u.waitForEvents(title, 1);

      await inNewPage(browser, u, async (own) => {
        await openDay(own, day);
        await expect(own.getByText(title).first()).toBeAttached();
      });

      await openDay(page, day);
      await expect(freeBlocks(page).first()).toBeAttached();
      expect(await distinctTexts(freeBlocks(page))).toEqual(before);
    });
  });

  test("CA-39: con tre calendari accesi e il fornitore lento la pagina mostra l'avviso di avanzamento, si possono aprire le impostazioni e alla fine sparisce", async ({
    page,
    baseURL,
  }) => {
    needsFake();
    test.setTimeout(120_000);
    await withLinker(baseURL, async (u) => {
      await linkAs(u, page, GOOGLE);
      const section = accountSection(page, "google", GOOGLE.email);
      for (const name of ["Tennis", "Festività in Italia"]) {
        const row = calendarRow(section, name);
        await waitHydrated(rowSwitch(row, name));
        await rowSwitch(row, name).click();
        await expectSwitch(row, name, true);
        await expect
          .poll(
            async () =>
              (await u.calendars()).find((c) => c.name === name)
                ?.last_synced_at,
          )
          .toBeTruthy();
      }
      expect((await u.calendars()).filter((c) => c.is_enabled)).toHaveLength(3);

      // l'account risulta vecchio: aprendo la pagina riparte la sincronizzazione
      const [account] = await u.accounts();
      const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
      const { error } = await u.user.admin
        .from("calendar_accounts")
        .update({ last_synced_at: hourAgo })
        .eq("id", account!.id);
      expect(error).toBeNull();
      await u.fake.fail({
        userId: u.user.id,
        email: GOOGLE.email,
        slowMs: 4000,
      });

      await openCalendars(page);
      const progress = page
        .getByRole("status")
        .filter({ hasText: /^Sincronizzazione in corso: / });
      await expect(progress).toHaveText(
        /^Sincronizzazione in corso: (\d+ calendari|1 calendario) su 3\.$/,
      );

      const dialog = await openSettings(
        page,
        accountSection(page, "google", GOOGLE.email),
        "Personale",
      );
      await button(dialog, "Chiudi").click();
      await expect(dialog).toBeHidden();

      await expect(progress).toHaveCount(0, { timeout: 60_000 });
    });
  });
});

test.describe("errori", () => {
  test("CA-40: con le credenziali rifiutate compare l'avviso con «Ricollega» e gli impegni restano", async ({
    page,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await linkAs(
        u,
        page,
        withEvents(GOOGLE, { personale: [visita(10, 11)] }),
      );
      await u.waitForEvents(VISITA, 1);

      await u.fake.fail({
        userId: u.user.id,
        email: GOOGLE.email,
        authFailsFrom: new Date(Date.now() - 3_600_000).toISOString(),
      });
      await u.fake.sync(u.user.id);
      const [account] = await u.accounts();
      expect(account?.status).toBe("reconnect");
      expect(account?.failing_since).toBeTruthy();

      await openCalendars(page);
      const alert = alerts(page).filter({
        hasText: "Non riusciamo a sincronizzare",
      });
      await expect(alert).toContainText(
        `Non riusciamo a sincronizzare Google dalle ${clock(account!.failing_since!)}: la password potrebbe essere cambiata.`,
      );
      await expect(button(alert, "Ricollega")).toBeVisible();
      const section = accountSection(page, "google", GOOGLE.email);
      await expect(section.getByRole("listitem")).toHaveCount(3);
      expect(await u.events(VISITA)).toHaveLength(1);
      await openDay(page, today());
      await expect(eventBlocks(page, VISITA)).toHaveCount(1);
    });
  });

  test("CA-41: «Ricollega» con «Consenti» sullo stesso account toglie l'avviso e lascia una sola sezione", async ({
    page,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await linkAs(u, page, GOOGLE);
      await u.fake.fail({
        userId: u.user.id,
        email: GOOGLE.email,
        authFailsFrom: new Date(Date.now() - 3_600_000).toISOString(),
      });
      await u.fake.sync(u.user.id);

      await openCalendars(page);
      const alert = alerts(page).filter({
        hasText: "Non riusciamo a sincronizzare",
      });
      await expect(alert).toBeVisible();

      await u.prepare(GOOGLE);
      await button(alert, "Ricollega").click();
      await expect(page).toHaveURL(/\/fornitore-finto\/google/);
      await answer(page, "Consenti");

      await expect(alerts(page)).toHaveCount(0);
      await expect(accountSection(page, "google")).toHaveCount(1);
      expect(await u.accounts()).toHaveLength(1);
      expect((await u.accounts())[0]!.status).toBe("active");
    });
  });

  test("CA-42: se il fornitore non risponde per una sola sincronizzazione non c'è nessun avviso", async ({
    page,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await linkAs(u, page, GOOGLE);
      await u.fake.fail({
        userId: u.user.id,
        email: GOOGLE.email,
        unreachable: true,
      });
      await u.fake.sync(u.user.id);

      await openCalendars(page);
      await expect(accountSection(page, "google")).toHaveCount(1);
      await expect(alerts(page)).toHaveCount(0);
      await expect(
        page.getByRole("status").filter({ hasText: "non risponde" }),
      ).toHaveCount(0);
      await expect(
        rowSummary(calendarRow(accountSection(page, "google"), "Personale")),
      ).toHaveText("Entrata e uscita · Occupato");
    });
  });
});
