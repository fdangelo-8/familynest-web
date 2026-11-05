import { signInAs, skipReason, usersConfigured } from "../fixtures/auth";
import {
  EMPTY_TITLE,
  GOOGLE,
  NAME,
  OUTLOOK,
  PAGE_TITLE,
  PATH,
  accountSection,
  alerts,
  anySection,
  button,
  calendarRow,
  expect,
  h1,
  isMobile,
  linkFromPage,
  linkWithForm,
  needsFake,
  openCalendars,
  rowButton,
  rowButtonName,
  rowSummary,
  rowSwitch,
  startLink,
  answer,
  test,
  withLinker,
} from "../fixtures/calendari-collegati";

// «Calendari collegati» (#34, parte 1): accesso e testa, stato vuoto e
// collegamento (CA-1 ... CA-11). Il fornitore è quello finto; ogni test usa
// un utente usa e getta con il suo Nest e lo cancella alla fine.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });
test.describe.configure({ timeout: 90_000 });

test.describe("accesso e testa", () => {
  test("CA-1: Chiara senza Nest finisce su /onboarding, un visitatore su /accesso", async ({
    page,
    baseURL,
  }) => {
    test.skip(!usersConfigured("C"), skipReason("C"));
    await page.goto(PATH);
    await expect(page).toHaveURL(/\/accesso$/);

    await signInAs(page.context(), baseURL as string, "C");
    await page.goto(PATH);
    await expect(page).toHaveURL(/\/onboarding/);
  });

  test("CA-2: titolo del browser, intestazione e «Indietro» verso /nest (mobile)", async ({
    page,
    baseURL,
  }) => {
    needsFake();
    test.skip(!isMobile(), "CA-2 riguarda il telefono");
    await withLinker(baseURL, async (u) => {
      await u.signIn(page);
      await openCalendars(page);
      await expect(page).toHaveTitle(PAGE_TITLE);
      await expect(h1(page)).toHaveText("Calendari collegati");
      await expect(page.locator(".intestazione__sopra")).toHaveText(
        "Impostazioni",
      );
      await expect(page.locator(".intestazione__sotto")).toHaveText(
        "Scegli quali calendari portare in FamilyNest e cosa vedono gli altri.",
      );
      await expect(
        page.getByRole("link", { name: "Indietro", exact: true }),
      ).toHaveAttribute("href", "/nest");
    });
  });

  test("CA-3: nel menu delle impostazioni «Calendari collegati» è la pagina corrente (desktop)", async ({
    page,
    baseURL,
  }) => {
    needsFake();
    test.skip(isMobile(), "CA-3 riguarda il computer");
    await withLinker(baseURL, async (u) => {
      await u.signIn(page);
      await openCalendars(page);
      const menu = page.getByRole("navigation", {
        name: "Impostazioni",
        exact: true,
      });
      await expect(
        menu.getByRole("link", { name: "Calendari collegati", exact: true }),
      ).toHaveAttribute("aria-current", "page");
      await expect(
        menu.getByRole("link", { name: "Il tuo profilo", exact: true }),
      ).not.toHaveAttribute("aria-current", /.+/);
    });
  });
});

test.describe("stato vuoto", () => {
  test("CA-4: senza account c'è lo stato vuoto con «Collega Google» e senza «Collega un altro account»", async ({
    page,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await u.signIn(page);
      await openCalendars(page);
      await expect(page.getByText(EMPTY_TITLE, { exact: true })).toBeVisible();
      await expect(
        page.getByText(
          "Collega Google, Outlook o iCloud: i tuoi impegni arrivano qui da soli e gli altri vedono solo che sei occupato.",
          { exact: true },
        ),
      ).toBeVisible();
      await expect(button(page, "Collega Google")).toBeVisible();
      await expect(button(page, "Collega un altro account")).toHaveCount(0);
      await expect(
        page.getByText("Dove vanno i nuovi impegni", { exact: true }),
      ).toHaveCount(0);
      await expect(anySection(page)).toHaveCount(0);
    });
  });
});

test.describe("collegamento", () => {
  test("CA-5: «Collega Google» e «Consenti» mostrano la sezione con le tre righe in ordine", async ({
    page,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await u.prepare(GOOGLE);
      await u.signIn(page);
      await linkFromPage(page, "google");

      const section = accountSection(page, "google");
      await expect(section).toHaveCount(1);
      await expect(section.getByRole("heading", { level: 2 })).toHaveText(
        "Google",
      );
      await expect(section).toContainText(GOOGLE.email);

      const names = ["Personale", "Festività in Italia", "Tennis"];
      const rows = section.getByRole("listitem");
      await expect(rows).toHaveCount(3);
      for (const [index, name] of names.entries()) {
        await expect(rowButton(rows.nth(index))).toHaveAccessibleName(
          rowButtonName(name),
        );
      }

      const personale = calendarRow(section, "Personale");
      await expect(rowSummary(personale)).toHaveText(
        "Entrata e uscita · Occupato",
      );
      await expect(rowSwitch(personale, "Personale")).toHaveAttribute(
        "aria-checked",
        "true",
      );
      for (const name of ["Festività in Italia", "Tennis"]) {
        const row = calendarRow(section, name);
        await expect(rowSummary(row)).toHaveText("Non sincronizzato");
        await expect(rowSwitch(row, name)).toHaveAttribute(
          "aria-checked",
          "false",
        );
      }
    });
  });

  test("CA-6: dopo il ritorno l'indirizzo è /calendari-collegati senza parametri e la cronologia non ha code= o state=", async ({
    page,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await u.prepare(GOOGLE);
      await u.signIn(page);
      await openCalendars(page);

      const visited: string[] = [];
      page.on("framenavigated", (frame) => {
        if (frame === page.mainFrame()) visited.push(frame.url());
      });
      await startLink(page, "google", "vuoto");
      await answer(page, "Consenti");

      const url = new URL(page.url());
      expect(url.pathname).toBe(PATH);
      expect(url.search).toBe("");
      expect(url.hash).toBe("");
      const lastFake = visited.findLastIndex((entry) =>
        entry.includes("/fornitore-finto/"),
      );
      expect(lastFake).toBeGreaterThanOrEqual(0);
      const afterFake = visited.slice(lastFake + 1);
      expect(afterFake.length).toBeGreaterThan(0);
      for (const entry of afterFake) {
        expect(entry).not.toMatch(/[?&](code|state)=/);
      }
    });
  });

  test("CA-7: «Nega» riporta alla pagina con l'avviso e nessun account", async ({
    page,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await u.prepare(GOOGLE);
      await u.signIn(page);
      await linkFromPage(page, "google", "vuoto", "Nega");

      await expect(
        alerts(page).filter({
          hasText:
            "Collegamento con Google annullato: senza il tuo permesso non possiamo leggere il calendario.",
        }),
      ).toBeVisible();
      await expect(page.getByText(EMPTY_TITLE, { exact: true })).toBeVisible();
      await expect(anySection(page)).toHaveCount(0);
      expect(await u.accounts()).toHaveLength(0);
    });
  });

  test("CA-8: «Consenti senza calendario» finisce come «Nega»: avviso, stato vuoto, nessun account", async ({
    page,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await u.prepare(GOOGLE);
      await u.signIn(page);
      await linkFromPage(page, "google", "vuoto", "Consenti senza calendario");

      await expect(
        alerts(page).filter({
          hasText:
            "Google ci ha dato l'accesso all'account ma non al calendario. Riprova e lascia la spunta su «Calendario».",
        }),
      ).toBeVisible();
      await expect(page.getByText(EMPTY_TITLE, { exact: true })).toBeVisible();
      await expect(anySection(page)).toHaveCount(0);
      expect(await u.accounts()).toHaveLength(0);
    });
  });

  test("CA-9: collegare di nuovo lo stesso account lascia una sola sezione e le impostazioni com'erano", async ({
    page,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await u.prepare(GOOGLE);
      await u.signIn(page);
      await linkFromPage(page, "google");

      const first = accountSection(page, "google", GOOGLE.email);
      const tennis = calendarRow(first, "Tennis");
      await rowSwitch(tennis, "Tennis").click();
      await expect(rowSwitch(tennis, "Tennis")).toHaveAttribute(
        "aria-checked",
        "true",
      );
      await expect(rowSummary(tennis)).toHaveText(
        "Entrata e uscita · Occupato",
      );
      // la sincronizzazione partita dall'interruttore deve essere finita
      await expect
        .poll(async () => {
          const rows = await u.calendars();
          return rows.find((row) => row.name === "Tennis")?.last_synced_at;
        })
        .toBeTruthy();
      const before = await u.calendars();

      await u.prepare(GOOGLE);
      await openCalendars(page);
      await startLink(page, "google", "altro");
      await answer(page, "Consenti");

      await expect(accountSection(page, "google")).toHaveCount(1);
      expect(await u.accounts()).toHaveLength(1);
      const section = accountSection(page, "google", GOOGLE.email);
      await expect(
        rowSwitch(calendarRow(section, "Tennis"), "Tennis"),
      ).toHaveAttribute("aria-checked", "true");
      await expect(
        rowSwitch(calendarRow(section, "Personale"), "Personale"),
      ).toHaveAttribute("aria-checked", "true");
      const after = await u.calendars();
      const pick = (rows: typeof before) =>
        rows
          .map((row) => ({
            name: row.name,
            is_enabled: row.is_enabled,
            direction: row.direction,
            visibility: row.visibility,
            counts_for_free_time: row.counts_for_free_time,
            weekdays_only: row.weekdays_only,
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
      expect(pick(after)).toEqual(pick(before));
      // il toast senza icona lo dice con la mail
      await expect(
        page.getByText(`${GOOGLE.email} è già collegato.`),
      ).toBeVisible();
    });
  });

  test("CA-10: con 5 account collegati il sesto dà un avviso di errore e restano 5 sezioni", async ({
    page,
    baseURL,
  }) => {
    needsFake();
    test.setTimeout(180_000);
    await withLinker(baseURL, async (u) => {
      const specs = [1, 2, 3, 4, 5, 6].map((n) => ({
        ...GOOGLE,
        email: `u${n}.finto@example.test`,
      }));
      await u.signIn(page);
      await openCalendars(page);
      for (const spec of specs.slice(0, 5)) {
        await u.prepare(spec);
        await linkWithForm(page, "google");
      }
      await expect(anySection(page)).toHaveCount(5);

      await u.prepare(specs[5]!);
      await linkWithForm(page, "google");
      await expect(
        alerts(page).filter({
          hasText:
            "Hai già collegato 5 account, il massimo. Scollegane uno per aggiungerne un altro.",
        }),
      ).toBeVisible();
      await expect(anySection(page)).toHaveCount(5);
      expect(await u.accounts()).toHaveLength(5);
    });
  });

  test("CA-11: «Collega un altro account» apre la scelta del fornitore che porta alla pagina finta", async ({
    page,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await u.prepare(GOOGLE);
      await u.signIn(page);
      await linkFromPage(page, "google");

      await button(page, "Collega un altro account").click();
      const dialog = page.getByRole("dialog", {
        name: "Collega un altro account",
      });
      await expect(dialog).toBeVisible();
      await expect(dialog).toHaveClass(
        isMobile() ? /\bfoglio\b/ : /\bmodale\b/,
      );
      await expect(button(dialog, `Collega ${NAME.google}`)).toBeVisible();
      await expect(button(dialog, `Collega ${NAME.outlook}`)).toBeVisible();

      await button(dialog, "Collega Google").click();
      await expect(page).toHaveURL(/\/fornitore-finto\/google/);
      await expect(
        page.getByRole("link", { name: "Consenti", exact: true }),
      ).toBeVisible();
    });
  });
});

test.describe("Outlook nella scelta", () => {
  test("la scelta del fornitore ha anche Outlook e porta alla sua pagina finta", async ({
    page,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await u.prepare(GOOGLE);
      await u.prepare(OUTLOOK, false);
      await u.signIn(page);
      await linkFromPage(page, "google");
      await startLink(page, "outlook", "altro");
      await expect(
        page.getByRole("link", { name: "Consenti", exact: true }),
      ).toBeVisible();
    });
  });
});
