import type { Browser, Page } from "@playwright/test";
import { signInAs, skipReason, usersConfigured } from "../fixtures/auth";
import {
  GOOGLE,
  OUTLOOK,
  accountSection,
  at,
  browserKeeps,
  busyBlocks,
  calendarRow,
  eventBlocks,
  expect,
  linkFromPage,
  linkInBackground,
  needsFake,
  openCalendars,
  openDay,
  openSettings,
  rowSummary,
  test,
  today,
  watchBodies,
  withEvents,
  withLinker,
  withLinkerRita,
  type Linker,
} from "../fixtures/calendari-collegati";
import { seedClient } from "../fixtures/esplora";

// «Calendari collegati» (#34, parte 1): cosa vedono gli altri (CA-24 ...
// CA-29) e credenziali (CA-30, CA-31), più la privacy dei dati degli altri
// adulti. Fornitore finto, utenti usa e getta: Ilaria (U) e Rita nello stesso
// Nest, Marco (seed) in un altro.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

const VISITA = "Visita in banca";
const VIA = "Via Roma 1";

/** Everything U and the fake share, as the browser of somebody else sees it. */
type Seen = {
  page: Page;
  bodies: ReturnType<typeof watchBodies>;
  html: string[];
};

function watch(page: Page): Seen {
  return { page, bodies: watchBodies(page), html: [] };
}

async function collect(seen: Seen) {
  seen.html.push(await seen.page.content());
}

async function everything(seen: Seen): Promise<string> {
  await collect(seen);
  return [...seen.html, ...(await seen.bodies.texts())].join("\n");
}

function expectNone(text: string, forbidden: string[]) {
  for (const word of forbidden) {
    expect(text, `«${word}» non deve arrivare al browser`).not.toContain(word);
  }
}

const SECRETS = [VISITA, VIA, "Personale", GOOGLE.email];

/** U links Google with «Visita in banca» (10:00-11:00) and, optionally, more. */
async function ilariaLinks(
  browser: Browser,
  ctx: Linker,
  events = [
    {
      id: "visita",
      title: VISITA,
      location: VIA,
      startsAt: at(today(), 10),
      endsAt: at(today(), 11),
    },
  ],
) {
  await ctx.prepare(withEvents(GOOGLE, { personale: events }));
  await linkInBackground(browser, ctx, "google");
  await ctx.fake.sync(ctx.user.id);
  await ctx.waitForEvents(events[0]!.title, 1);
}

test.describe("cosa vedono gli altri", () => {
  test("CA-24: con «Occupato» Rita vede una riga «Occupato» di U e nessun dato dell'impegno", async ({
    page,
    browser,
    baseURL,
  }) => {
    needsFake();
    await withLinkerRita(baseURL, async (u) => {
      await ilariaLinks(browser, u);
      expect((await u.events(VISITA))[0]?.visibility).toBe("busy");

      await u.rita.signInContext(page.context(), baseURL as string);
      const seen = watch(page);
      await openDay(page, today());
      await expect(busyBlocks(page)).toHaveCount(1);
      await expect(busyBlocks(page)).toContainText(
        "Ilaria ha un impegno, dalle 10:00 alle 11:00",
      );
      await expect(eventBlocks(page, VISITA)).toHaveCount(0);
      await collect(seen);
      await page.goto("/calendario");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);

      expectNone(await everything(seen), SECRETS);
    });
  });

  test("CA-25: con «Solo io» Rita non vede niente di U alle 10:00", async ({
    page,
    browser,
    baseURL,
  }) => {
    needsFake();
    await withLinkerRita(baseURL, async (u) => {
      await u.prepare(GOOGLE);
      await linkInBackground(browser, u, "google");
      await u.setCalendar("Personale", { visibility: "private" });
      await u.provide(GOOGLE, "personale", [
        {
          id: "visita",
          title: VISITA,
          location: VIA,
          startsAt: at(today(), 10),
          endsAt: at(today(), 11),
        },
      ]);
      await u.fake.sync(u.user.id);
      await u.waitForEvents(VISITA, 1);
      expect((await u.events(VISITA))[0]?.visibility).toBe("private");

      await u.rita.signInContext(page.context(), baseURL as string);
      const seen = watch(page);
      await openDay(page, today());
      await expect(busyBlocks(page)).toHaveCount(0);
      await expect(eventBlocks(page, VISITA)).toHaveCount(0);
      await collect(seen);
      await page.goto("/calendario");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);

      expectNone(await everything(seen), SECRETS);
    });
  });

  test("CA-26: con «Tutti» Rita vede titolo e luogo, senza etichetta «Google» e senza nome del calendario né mail", async ({
    page,
    browser,
    baseURL,
  }) => {
    needsFake();
    await withLinkerRita(baseURL, async (u) => {
      await u.prepare(GOOGLE);
      await linkInBackground(browser, u, "google");
      await u.setCalendar("Personale", { visibility: "household" });
      await u.provide(GOOGLE, "personale", [
        {
          id: "visita",
          title: VISITA,
          location: VIA,
          startsAt: at(today(), 10),
          endsAt: at(today(), 11),
        },
      ]);
      await u.fake.sync(u.user.id);
      await u.waitForEvents(VISITA, 1);
      const [row] = await u.events(VISITA);
      expect(row?.visibility).toBe("household");
      expect(row?.location).toBe(VIA);

      await u.rita.signInContext(page.context(), baseURL as string);
      const seen = watch(page);
      await openDay(page, today());
      await expect(eventBlocks(page, VISITA)).toHaveCount(1);
      await expect(eventBlocks(page, VISITA)).not.toContainText("Google");
      await expect(busyBlocks(page)).toHaveCount(0);

      const text = await everything(seen);
      expectNone(text, ["Personale", GOOGLE.email]);
    });
  });

  test("CA-27: un impegno privato sul fornitore, in un calendario «Tutti», per Rita è solo «Occupato»", async ({
    page,
    browser,
    baseURL,
  }) => {
    needsFake();
    await withLinkerRita(baseURL, async (u) => {
      await u.prepare(GOOGLE);
      await linkInBackground(browser, u, "google");
      await u.setCalendar("Personale", { visibility: "household" });
      await u.provide(GOOGLE, "personale", [
        {
          id: "visita",
          title: VISITA,
          startsAt: at(today(), 10),
          endsAt: at(today(), 11),
        },
        {
          id: "colloquio",
          title: "Colloquio",
          isPrivate: true,
          startsAt: at(today(), 14),
          endsAt: at(today(), 15),
        },
      ]);
      await u.fake.sync(u.user.id);
      await u.waitForEvents(VISITA, 1);
      await u.waitForEvents("Colloquio", 1);

      await u.rita.signInContext(page.context(), baseURL as string);
      const seen = watch(page);
      await openDay(page, today());
      await expect(eventBlocks(page, VISITA)).toHaveCount(1);
      await expect(eventBlocks(page, "Colloquio")).toHaveCount(0);
      await expect(busyBlocks(page)).toHaveCount(1);
      await expect(busyBlocks(page)).toContainText(
        "Ilaria ha un impegno, dalle 14:00 alle 15:00",
      );
      expectNone(await everything(seen), ["Colloquio"]);
    });
  });

  test("CA-28: Rita non vede account né calendari di U, né dalla pagina né dal database", async ({
    page,
    browser,
    baseURL,
  }) => {
    needsFake();
    await withLinkerRita(baseURL, async (u) => {
      await ilariaLinks(browser, u);

      await u.rita.signInContext(page.context(), baseURL as string);
      const seen = watch(page);
      await openCalendars(page);
      await expect(
        page.getByText("Nessun calendario collegato", { exact: true }),
      ).toBeVisible();
      await expect(accountSection(page, "google")).toHaveCount(0);
      expectNone(await everything(seen), [GOOGLE.email, "Personale", "Tennis"]);

      for (const table of [
        "calendar_accounts",
        "external_calendars",
        "event_external_links",
      ]) {
        const { data } = await u.rita.client.from(table).select("id");
        expect(data ?? [], `Rita legge ${table}`).toEqual([]);
      }
    });
  });

  test("CA-29: Marco, di un altro Nest, non trova impegni, account o calendari di U", async ({
    page,
    browser,
    baseURL,
  }) => {
    needsFake();
    test.skip(!usersConfigured("A"), skipReason("A"));
    await withLinker(baseURL, async (u) => {
      await u.prepare(GOOGLE);
      await linkInBackground(browser, u, "google");
      await u.setCalendar("Personale", { visibility: "household" });
      await u.provide(GOOGLE, "personale", [
        {
          id: "visita",
          title: VISITA,
          location: VIA,
          startsAt: at(today(), 10),
          endsAt: at(today(), 11),
        },
      ]);
      await u.fake.sync(u.user.id);
      await u.waitForEvents(VISITA, 1);

      await signInAs(page.context(), baseURL as string, "A");
      const seen = watch(page);
      for (const path of ["/calendario", "/calendari-collegati"]) {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
        await collect(seen);
      }
      await page.goto("/ricerca?q=Visita");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
      expectNone(await everything(seen), SECRETS);

      const marco = await seedClient("A");
      for (const table of [
        "calendar_accounts",
        "external_calendars",
        "event_external_links",
      ]) {
        const { data } = await marco
          .from(table)
          .select("id")
          .eq("id", (await u.accounts())[0]!.id);
        expect(data ?? [], `Marco legge ${table}`).toEqual([]);
      }
      const events = await marco
        .from("events")
        .select("id")
        .eq("title", VISITA);
      expect(events.data ?? []).toEqual([]);
    });
  });

  test("privacy: nella pagina di U di Rita ci sono solo il nome e nessun dato dei suoi account", async ({
    page,
    browser,
    baseURL,
  }) => {
    needsFake();
    await withLinkerRita(baseURL, async (u) => {
      const ritaAccount = {
        ...OUTLOOK,
        email: "rita.segreta@example.test",
        calendars: [
          {
            id: "lavoro-rita",
            name: "Calendario segreto di Rita",
            primary: true,
          },
        ],
      };
      await u.asRita.prepare(ritaAccount);
      await linkInBackground(browser, u.asRita, "outlook");
      await u.prepare(GOOGLE);
      await linkInBackground(browser, u, "google");

      await u.signIn(page);
      const seen = watch(page);
      await openCalendars(page);
      const section = accountSection(page, "google", GOOGLE.email);
      const dialog = await openSettings(page, section, "Personale");
      await expect(dialog).toContainText(
        "Con «Occupato» Rita vede «Ilaria ha un impegno» e l'orario, senza titolo né luogo.",
      );
      await expect(rowSummary(calendarRow(section, "Personale"))).toHaveText(
        "Entrata e uscita · Occupato",
      );
      expectNone(await everything(seen), [
        ritaAccount.email,
        "Calendario segreto di Rita",
        "lavoro-rita",
      ]);
    });
  });
});

test.describe("credenziali", () => {
  test("CA-30: il database non ha il token in chiaro e la sessione di U non può leggere la colonna", async ({
    page,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await u.prepare(GOOGLE);
      await u.signIn(page);
      await linkFromPage(page, "google");

      const tokens = await u.tokens();
      expect(tokens.length).toBeGreaterThan(0);
      const [account] = await u.accounts();
      expect(account?.credentials_ciphertext).toBeTruthy();
      for (const token of tokens) {
        expect(account!.credentials_ciphertext).not.toContain(token);
      }

      const own = await u.user.client
        .from("calendar_accounts")
        .select("credentials_ciphertext");
      expect(own.error).not.toBeNull();
      expect(own.data).toBeNull();
    });
  });

  test("CA-31: né pagine, né risposte, né cookie, né storage contengono token o codice", async ({
    page,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await u.prepare(
        withEvents(GOOGLE, {
          personale: [
            {
              id: "visita",
              title: VISITA,
              startsAt: at(today(), 10),
              endsAt: at(today(), 11),
            },
          ],
        }),
      );
      await u.signIn(page);
      const seen = watch(page);
      const codes: string[] = [];
      page.on("request", (request) => {
        const url = new URL(request.url());
        const code = url.searchParams.get("code");
        if (url.pathname.includes("/ritorno/") && code) codes.push(code);
      });

      await linkFromPage(page, "google");
      await collect(seen);
      const section = accountSection(page, "google", GOOGLE.email);
      await openSettings(page, section, "Personale");
      await collect(seen);
      for (const path of ["/oggi", "/calendario", "/profilo"]) {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await collect(seen);
      }
      await openCalendars(page);

      const secrets = [...(await u.tokens()), ...codes];
      expect(codes.length).toBeGreaterThan(0);
      expect((await u.tokens()).length).toBeGreaterThan(0);
      const text = [await everything(seen), await browserKeeps(page)].join(
        "\n",
      );
      expectNone(text, secrets);
    });
  });
});
