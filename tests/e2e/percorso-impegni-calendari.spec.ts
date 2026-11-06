import {
  GOOGLE,
  EMPTY_TITLE,
  accountSection,
  anySection,
  at,
  button,
  calendarRow,
  expect,
  linkAs,
  needsFake,
  openSettings,
  test,
  today,
  tomorrow,
  withEvents,
  withLinker,
} from "../fixtures/calendari-collegati";
import {
  closeStarterList,
  eventBlocks,
  inToday,
  visibleIn,
  monthRowsOf,
  openDay,
  openMonthDay,
  openToday,
  openWeek,
  searchEmpty,
  searchFor,
  searchRows,
  setNestLens,
  weekLinks,
} from "../fixtures/percorso-impegni";

// Percorso dei calendari collegati (#306), con il fornitore finto: collego
// Google, gli impegni importati compaiono in Calendario (settimana, giorno,
// mese), in Ricerca e in Oggi; sincronizzo di nuovo (uno cambia, uno sparisce,
// uno nuovo arriva); scollego e tutto sparisce ovunque. Utente usa e getta,
// date calcolate da oggi a Roma.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });
test.describe.configure({ timeout: 240_000 });

const VISITA = "Visita in banca";
const CENA = "Cena con i vicini";
const DENTISTA = "Dentista Ilaria";

test.describe("percorso: collego, sincronizzo, scollego", () => {
  test("PERCORSO-2: gli impegni importati compaiono ovunque, si aggiornano alla sincronizzazione e spariscono con «Scollega»", async ({
    page,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      const visita = {
        id: "visita",
        title: VISITA,
        location: "Via Roma 1",
        startsAt: at(today(), 20),
        endsAt: at(today(), 21),
      };
      const cena = {
        id: "cena",
        title: CENA,
        startsAt: at(tomorrow(), 20),
        endsAt: at(tomorrow(), 22),
      };
      await closeStarterList(u);
      await setNestLens(page);

      // 1. Collego Google dalla pagina (stato vuoto -> consenso -> ritorno).
      await linkAs(u, page, withEvents(GOOGLE, { personale: [visita, cena] }));
      const account = accountSection(page, "google", GOOGLE.email);
      await expect(account).toBeVisible();
      await expect(calendarRow(account, "Personale")).toBeVisible();
      await expect(anySection(page)).toHaveCount(1);

      // 2. Sincronizzo: gli impegni arrivano nel Nest.
      await u.fake.sync(u.user.id);
      await u.waitForEvents(VISITA, 1);
      await u.waitForEvents(CENA, 1);
      await expect
        .poll(async () => (await u.accounts())[0]?.last_synced_at)
        .not.toBeNull();

      // 3. Calendario: settimana, giorno, mese.
      await openWeek(page, today());
      await expect(weekLinks(page, VISITA).first()).toBeVisible();
      await openWeek(page, tomorrow());
      await expect(weekLinks(page, CENA).first()).toBeVisible();
      await openDay(page, today());
      await expect(eventBlocks(page, VISITA)).toHaveCount(1);
      await openDay(page, tomorrow());
      await expect(eventBlocks(page, CENA)).toHaveCount(1);
      await openMonthDay(page, tomorrow());
      await expect(monthRowsOf(page, CENA)).toHaveCount(1);

      // 4. Ricerca e Oggi: ci sono tutti e due.
      await searchFor(page, "banca");
      await expect(searchRows(page, VISITA)).toHaveCount(1);
      await openToday(page);
      await expect(inToday(page, VISITA).first()).toBeAttached();
      // Domani (desktop) o «Questa settimana» (telefono, con un impegno oggi).
      await expect(visibleIn(page, CENA).first()).toBeVisible();

      // 5. Il fornitore cambia: la visita sparisce, la cena si sposta, arriva
      // il dentista; dopo la sincronizzazione il Nest si allinea.
      await u.provide(GOOGLE, "personale", [
        { ...visita, status: "cancelled", version: "2" },
        {
          ...cena,
          startsAt: at(tomorrow(), 19),
          endsAt: at(tomorrow(), 21),
          version: "2",
        },
        {
          id: "dentista",
          title: DENTISTA,
          startsAt: at(tomorrow(), 9),
          endsAt: at(tomorrow(), 10),
        },
      ]);
      await u.fake.sync(u.user.id);
      await u.waitForEvents(VISITA, 0);
      await u.waitForEvents(DENTISTA, 1);
      await expect
        .poll(async () =>
          (await u.events(CENA)).map((row) =>
            new Date(row.starts_at).toISOString(),
          ),
        )
        .toEqual([at(tomorrow(), 19)]);

      await openDay(page, today());
      await expect(eventBlocks(page, VISITA)).toHaveCount(0);
      await openDay(page, tomorrow());
      await expect(eventBlocks(page, DENTISTA)).toHaveCount(1);
      await expect(eventBlocks(page, CENA)).toHaveCount(1);
      await openToday(page);
      await expect(inToday(page, VISITA)).toHaveCount(0);
      await expect(visibleIn(page, DENTISTA).first()).toBeVisible();
      await expect(visibleIn(page, CENA).first()).toBeVisible();
      await searchFor(page, "banca");
      await expect(searchEmpty(page)).toBeVisible();

      // 6. Scollego: sezione e impegni importati spariscono da ogni pagina.
      await page.goto("/calendari-collegati");
      const section2 = accountSection(page, "google", GOOGLE.email);
      const dialog = await openSettings(page, section2, "Personale");
      await button(dialog, "Scollega l'account Google").click();
      const confirm = page.getByRole("alertdialog", {
        name: `Scollegare «${GOOGLE.email}»?`,
        exact: true,
      });
      await expect(confirm).toBeVisible();
      await button(confirm, "Scollega").click();
      await expect(page.getByText(EMPTY_TITLE, { exact: true })).toBeVisible();
      await expect(anySection(page)).toHaveCount(0);

      await u.waitForEvents(CENA, 0);
      await u.waitForEvents(DENTISTA, 0);
      await openWeek(page, tomorrow());
      await expect(weekLinks(page, CENA)).toHaveCount(0);
      await expect(weekLinks(page, DENTISTA)).toHaveCount(0);
      await openDay(page, tomorrow());
      await expect(eventBlocks(page, CENA)).toHaveCount(0);
      await expect(eventBlocks(page, DENTISTA)).toHaveCount(0);
      await openMonthDay(page, tomorrow());
      await expect(monthRowsOf(page, CENA)).toHaveCount(0);
      await openToday(page);
      await expect(inToday(page, CENA)).toHaveCount(0);
      await searchFor(page, "cena");
      await expect(searchEmpty(page)).toBeVisible();
    });
  });
});
