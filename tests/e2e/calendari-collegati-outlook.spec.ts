import {
  GOOGLE,
  OUTLOOK,
  accountSection,
  alerts,
  anySection,
  at,
  busyBlocks,
  button,
  calendarRow,
  clock,
  deleteOwnAccount,
  directionRadio,
  eventBlocks,
  expect,
  expectSwitch,
  leftovers,
  linkAs,
  linkFromPage,
  linkInBackground,
  needsFake,
  openCalendars,
  openDay,
  openSettings,
  revokedTokens,
  rowButton,
  rowButtonName,
  rowSummary,
  rowSwitch,
  snapshot,
  startLink,
  answer,
  test,
  today,
  waitHydrated,
  watchBodies,
  withEvents,
  withLinker,
  withLinkerRita,
} from "../fixtures/calendari-collegati";

// Outlook (#35): le stesse scelte della #34 con il fornitore finto «Outlook»
// (CA-1 ... CA-12). CA-10 (parte 2 della #34) e CA-13 ... CA-15 (adattatore
// Microsoft vero, prova a mano di Francesco) sono saltati con il motivo.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });
test.describe.configure({ timeout: 90_000 });

const MAIL = OUTLOOK.email;

test.describe("Outlook · collegamento", () => {
  test("CA-1: lo stato vuoto ha «Collega Google» e poi «Collega Outlook»", async ({
    page,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await u.signIn(page);
      await openCalendars(page);
      const names = await page
        .getByRole("button", { name: /^Collega (Google|Outlook|iCloud)$/ })
        .allTextContents();
      expect(names.slice(0, 2)).toEqual(["Collega Google", "Collega Outlook"]);
    });
  });

  test("CA-2: «Collega Outlook» e «Consenti» mostrano la sezione con logo, mail e le due righe", async ({
    page,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await linkAs(u, page, OUTLOOK);

      const url = new URL(page.url());
      expect(url.pathname).toBe("/calendari-collegati");
      expect(url.search).toBe("");

      const section = accountSection(page, "outlook");
      await expect(section).toHaveCount(1);
      await expect(section).toHaveAccessibleName(/^Account Outlook/);
      await expect(section.getByRole("heading", { level: 2 })).toHaveText(
        "Outlook",
      );
      await expect(section).toContainText(MAIL);

      const rows = section.getByRole("listitem");
      await expect(rows).toHaveCount(2);
      await expect(rowButton(rows.nth(0))).toHaveAccessibleName(
        rowButtonName("Calendario"),
      );
      await expect(rowButton(rows.nth(1))).toHaveAccessibleName(
        rowButtonName("Ferie del team"),
      );

      const calendario = calendarRow(section, "Calendario");
      await expect(calendario.locator(".logo-marchio--outlook")).toHaveText(
        "C",
      );
      await expect(rowSummary(calendario)).toHaveText(
        "Entrata e uscita · Occupato",
      );
      await expectSwitch(calendario, "Calendario", true);

      const ferie = calendarRow(section, "Ferie del team");
      await expect(ferie.locator(".logo-marchio--outlook")).toHaveText("F");
      await expect(rowSummary(ferie)).toHaveText("Non sincronizzato");
      await expectSwitch(ferie, "Ferie del team", false);
    });
  });

  test("CA-3: «Ferie del team» acceso è «Solo in entrata · Occupato» e «Entrata e uscita» è disabilitata", async ({
    page,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await linkAs(u, page, OUTLOOK);
      const section = accountSection(page, "outlook", MAIL);
      const row = calendarRow(section, "Ferie del team");
      await waitHydrated(rowSwitch(row, "Ferie del team"));
      await rowSwitch(row, "Ferie del team").click();
      await expectSwitch(row, "Ferie del team", true);
      await expect(rowSummary(row)).toHaveText("Solo in entrata · Occupato");

      const dialog = await openSettings(page, section, "Ferie del team");
      await expect(
        dialog.getByRole("heading", { name: "Ferie del team · Outlook" }),
      ).toBeVisible();
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

  test("CA-4: i testi delle direzioni di «Calendario» nominano Outlook", async ({
    page,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await linkAs(u, page, OUTLOOK);
      const dialog = await openSettings(
        page,
        accountSection(page, "outlook", MAIL),
        "Calendario",
      );
      await expect(dialog).toContainText(
        "Quello che crei su Outlook arriva qui, e puoi mandare su Outlook gli impegni di FamilyNest.",
      );
      await expect(dialog).toContainText(
        "Vedi i tuoi impegni di lavoro, ma FamilyNest non scrive su Outlook.",
      );
    });
  });

  test("CA-5: con Google e Outlook collegati in quest'ordine, la sezione Google sta sopra Outlook", async ({
    page,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await linkAs(u, page, GOOGLE);
      await u.prepare(OUTLOOK);
      await startLink(page, "outlook", "altro");
      await answer(page, "Consenti");

      const sections = anySection(page);
      await expect(sections).toHaveCount(2);
      await expect(sections.nth(0)).toHaveAccessibleName(/^Account Google/);
      await expect(sections.nth(1)).toHaveAccessibleName(/^Account Outlook/);
    });
  });

  test.skip("CA-5 (in /profilo l'info è «Google, Outlook»): la riga sul Profilo è della parte 2 della #34", async () => {
    // Le righe di Il tuo profilo e Il tuo Nest sono nella parte 2 della #34
    // (§17), non in questa PR.
  });

  test("CA-6: «Call con Acme» arriva con «Teams» e nessun dato riservato resta nel database", async ({
    page,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      const secret = "Ordine del giorno riservato";
      const mails = ["a.rossi@example.test", "b.verdi@example.test"];
      await linkAs(
        u,
        page,
        withEvents(OUTLOOK, {
          calendario: [
            {
              id: "acme",
              title: "Call con Acme",
              location: "Teams",
              startsAt: at(today(), 16),
              endsAt: at(today(), 17),
              description: secret,
              attendees: mails.map((email) => ({ email })),
              organizer: { email: "capo@example.test" },
            },
          ],
        }),
      );
      await u.waitForEvents("Call con Acme", 1);
      expect((await u.events("Call con Acme"))[0]?.location).toBe("Teams");
      await openDay(page, today());
      await expect(eventBlocks(page, "Call con Acme")).toHaveCount(1);

      const admin = u.user.admin;
      const calendars = await u.calendars();
      const tables = await Promise.all([
        admin.from("events").select("*").eq("household_id", u.householdId),
        admin
          .from("calendar_accounts")
          .select("*")
          .eq("member_id", u.adminMemberId),
        admin
          .from("external_calendars")
          .select("*")
          .eq("member_id", u.adminMemberId),
        admin
          .from("event_external_links")
          .select("*")
          .in(
            "calendar_id",
            calendars.map((c) => c.id),
          ),
        admin.from("calendar_outbox").select("*"),
      ]);
      for (const { error } of tables) expect(error).toBeNull();
      const dump = JSON.stringify(tables.map(({ data }) => data));
      for (const word of [secret, ...mails, "capo@example.test"]) {
        expect(dump, `«${word}» nel database`).not.toContain(word);
      }
    });
  });

  test.skip("CA-6 (etichetta «Outlook» sull'impegno): l'etichetta della fonte è della parte 2 della #34", async () => {
    // L'etichetta della fonte nelle altre pagine è la parte 2 (#34 §13).
  });

  test("CA-7: un impegno privato di Outlook in un calendario «Tutti» per Rita è solo «Occupato»", async ({
    page,
    browser,
    baseURL,
  }) => {
    needsFake();
    await withLinkerRita(baseURL, async (u) => {
      await u.prepare(OUTLOOK);
      await linkInBackground(browser, u, "outlook");
      await u.setCalendar("Calendario", { visibility: "household" });
      await u.provide(OUTLOOK, "calendario", [
        {
          id: "riservato",
          title: "Colloquio riservato",
          location: "Sala 3",
          isPrivate: true,
          startsAt: at(today(), 11),
          endsAt: at(today(), 12),
        },
      ]);
      await u.fake.sync(u.user.id);
      await u.waitForEvents("Colloquio riservato", 1);

      await u.asRita.signIn(page);
      const bodies = watchBodies(page);
      await openDay(page, today());
      await expect(busyBlocks(page)).toHaveCount(1);
      await expect(busyBlocks(page)).toContainText(
        "Ilaria ha un impegno, dalle 11:00 alle 12:00",
      );
      await expect(eventBlocks(page, "Colloquio riservato")).toHaveCount(0);
      const seen = [await page.content(), ...(await bodies.texts())].join("\n");
      expect(seen).not.toContain("Colloquio riservato");
      expect(seen).not.toContain("Sala 3");
    });
  });
});

test.describe("Outlook · errori e ricollegamento", () => {
  test("CA-8: «serve l'approvazione dell'amministratore» dà un avviso dedicato e nessun account", async ({
    page,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await u.prepare(OUTLOOK);
      await u.signIn(page);
      await linkFromPage(
        page,
        "outlook",
        "vuoto",
        "Serve l'approvazione dell'amministratore",
      );

      const alert = alerts(page).filter({
        hasText: "Il tuo account di lavoro non permette",
      });
      await expect(alert).toContainText(
        "Il tuo account di lavoro non permette di collegare app esterne a Outlook. Chiedi a chi gestisce gli account in ufficio di approvare FamilyNest, oppure collega un altro calendario.",
      );
      await expect(alert).not.toContainText("annullato");
      await expect(button(alert, "Riprova")).toBeVisible();
      await expect(anySection(page)).toHaveCount(0);
      expect(await u.accounts()).toHaveLength(0);
    });
  });

  test("CA-9: con le credenziali rifiutate l'avviso nomina Outlook e «Ricollega» lo toglie", async ({
    page,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await linkAs(u, page, OUTLOOK);
      await u.fake.fail({
        userId: u.user.id,
        provider: "outlook",
        email: MAIL,
        authFailsFrom: new Date(Date.now() - 3_600_000).toISOString(),
      });
      await u.fake.sync(u.user.id);
      const [account] = await u.accounts();
      expect(account?.status).toBe("reconnect");

      await openCalendars(page);
      const alert = alerts(page).filter({
        hasText: "Non riusciamo a sincronizzare",
      });
      await expect(alert).toContainText(
        `Non riusciamo a sincronizzare Outlook dalle ${clock(account!.failing_since!)}: la password potrebbe essere cambiata.`,
      );
      await expect(button(alert, "Ricollega")).toBeVisible();

      await u.prepare(OUTLOOK);
      await button(alert, "Ricollega").click();
      await expect(page).toHaveURL(/\/fornitore-finto\/outlook/);
      await answer(page, "Consenti");

      await expect(alerts(page)).toHaveCount(0);
      await expect(accountSection(page, "outlook")).toHaveCount(1);
      expect(await u.accounts()).toHaveLength(1);
    });
  });

  test.skip("CA-10: «Anche su Outlook» è della parte 2 della #34", async () => {
    // Il modulo di Dettaglio impegno con «Anche su …» e la coda di uscita
    // sono nella parte 2 della #34 (§16), non in questa PR.
  });
});

test.describe("Outlook · scollega e cancellazione", () => {
  test("CA-11: «Scollega» cancella le credenziali senza chiamare Microsoft e indica dove togliere il permesso", async ({
    page,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await linkAs(u, page, OUTLOOK);
      const before = await snapshot(u);
      expect(before.tokens.length).toBeGreaterThan(0);

      const dialog = await openSettings(
        page,
        accountSection(page, "outlook", MAIL),
        "Calendario",
      );
      await button(dialog, "Scollega l'account Outlook").click();
      const confirm = page.getByRole("alertdialog", {
        name: `Scollegare «${MAIL}»?`,
        exact: true,
      });
      await expect(confirm).toContainText(
        "Gli impegni di Calendario spariscono da FamilyNest. Su Outlook non cambia niente.",
      );
      await button(confirm, "Scollega").click();

      await expect(anySection(page)).toHaveCount(0);
      const notice = page.getByRole("status").filter({
        hasText: "FamilyNest non può più usare il tuo account Outlook.",
      });
      await expect(notice).toContainText(
        "Se vuoi, togli il permesso anche dalla pagina Microsoft delle app con accesso al tuo account.",
      );
      await expect(
        notice.getByRole("link", { name: "Account personale" }),
      ).toHaveAttribute("href", "https://account.live.com/consent/Manage");
      await expect(
        notice.getByRole("link", { name: "Account di lavoro" }),
      ).toHaveAttribute("href", "https://myapps.microsoft.com");

      expect(await revokedTokens(u)).toEqual([]);
      expect(await leftovers(u, before)).toEqual({
        accounts: 0,
        calendars: 0,
        links: 0,
        events: 0,
        queue: 0,
      });
    });
  });

  test("CA-12: eliminando l'account FamilyNest non restano credenziali, calendari, collegamenti né impegni di U", async ({
    page,
    browser,
    baseURL,
  }) => {
    needsFake();
    await withLinkerRita(baseURL, async (u) => {
      await u.prepare(
        withEvents(OUTLOOK, {
          calendario: [
            {
              id: "acme",
              title: "Call con Acme",
              startsAt: at(today(), 16),
              endsAt: at(today(), 17),
            },
          ],
        }),
      );
      await linkInBackground(browser, u, "outlook");
      await u.waitForEvents("Call con Acme", 1);
      const before = await snapshot(u);

      await deleteOwnAccount(u, page);

      expect(await revokedTokens(u)).toEqual([]);
      expect(await leftovers(u, before)).toEqual({
        accounts: 0,
        calendars: 0,
        links: 0,
        events: 0,
        queue: 0,
      });
    });
  });
});

test.describe("Outlook · prova a mano di Francesco", () => {
  for (const ca of ["CA-13", "CA-14", "CA-15"]) {
    test.skip(`${ca}: richiede l'adattatore Microsoft vero e le azioni di Francesco (§6 della #35)`, async () => {
      // Prova a mano sulla produzione con un account Microsoft vero: il
      // fornitore finto non la può simulare.
    });
  }
});
