import { expect, test } from "@playwright/test";
import {
  at,
  withLinkerRita,
  waitHydrated,
} from "../fixtures/calendari-collegati";
import {
  buttonOf,
  card,
  confirmDialog,
  editDialog,
  fieldOf,
  h1,
  openForm,
  pressSave,
  toastOf,
} from "../fixtures/impegni";
import { loaded, openLink, rowOf, textOf } from "../fixtures/notifiche";
import {
  addByForm,
  addByPhrase,
  addDays,
  asOther,
  closeStarterList,
  eventBlocks,
  inToday,
  isMobile,
  visibleIn,
  monthRowsOf,
  openDay,
  openDetailFromDay,
  openMonthDay,
  openToday,
  openWeek,
  romeDay,
  searchEmpty,
  searchFor,
  searchRows,
  setNestLens,
  weekLinks,
} from "../fixtures/percorso-impegni";
import {
  throwawayConfigured,
  throwawaySkipReason,
} from "../fixtures/throwaway-user";

// Percorso completo degli impegni (#306): una persona vera che aggiunge un
// impegno con la frase e uno con il modulo (con ripetizione), lo ritrova nel
// Calendario (settimana, giorno, mese), lo modifica e lo elimina dal Dettaglio,
// poi lo cerca, vede la notifica dell'altra adulta e controlla Oggi. Un solo
// test attraversa tutte le pagine; le pagine singole hanno già i loro test.
// Utenti usa e getta (Ilaria, amministratrice, e Rita), orologio vero: le date
// sono calcolate da oggi a Roma.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });
test.describe.configure({ timeout: 240_000 });

const YOGA = "Yoga Rita";
const CUCINA = "Corso di cucina";
const DOVE = "Cucina comunale";

test.describe("percorso: aggiungo, ritrovo, modifico, elimino", () => {
  test.beforeEach(() => {
    test.skip(!throwawayConfigured(), throwawaySkipReason);
  });

  test("PERCORSO-1: frase e modulo con ripetizione, calendario, dettaglio, ricerca, notifiche e Oggi", async ({
    page,
    browser,
    baseURL,
  }) => {
    await withLinkerRita(baseURL, async (u) => {
      const tomorrow = addDays(romeDay(), 1);
      const dayAfter = addDays(romeDay(), 2);
      const nextWeek = addDays(dayAfter, 7);

      await closeStarterList(u);
      await setNestLens(page);
      await u.signIn(page);

      // 1. Aggiungi con la frase: «domani alle 17», con Rita tra le persone.
      await addByPhrase(page, `${YOGA} domani alle 17`);
      await u.waitForEvents(YOGA, 1);
      const yoga = (await u.events(YOGA))[0]!;
      expect(new Date(yoga.starts_at).toISOString()).toBe(at(tomorrow, 17));
      expect(new Date(yoga.ends_at).toISOString()).toBe(at(tomorrow, 18));
      expect(yoga.visibility).toBe("household");
      const { data: people } = await u.user.admin
        .from("event_members")
        .select("member_id")
        .eq("event_id", yoga.id);
      expect((people ?? []).map((row) => row.member_id)).toContain(u.ritaId);

      // 2. Aggiungi con il modulo: dopodomani alle 18, con luogo, ogni settimana.
      await addByForm(page, `${CUCINA} dopodomani alle 18`, {
        where: DOVE,
        weekly: true,
      });
      await u.waitForEvents(CUCINA, 1);
      const cucina = (await u.events(CUCINA))[0]!;
      expect(cucina.location).toBe(DOVE);
      expect(new Date(cucina.starts_at).toISOString()).toBe(at(dayAfter, 18));
      const { data: series } = await u.user.admin
        .from("events")
        .select("recurrence")
        .eq("id", cucina.id)
        .single();
      expect(series?.recurrence).toBe("weekly");

      // 3. Li ritrovo nel Calendario: settimana, giorno (anche la settimana dopo
      // per quello che si ripete) e mese.
      await openWeek(page, tomorrow);
      await expect(weekLinks(page, YOGA).first()).toBeVisible();
      await openWeek(page, dayAfter);
      await expect(weekLinks(page, CUCINA).first()).toBeVisible();

      await openDay(page, tomorrow);
      await expect(eventBlocks(page, YOGA)).toHaveCount(1);
      await openDay(page, dayAfter);
      await expect(eventBlocks(page, CUCINA)).toHaveCount(1);
      await openDay(page, nextWeek);
      await expect(eventBlocks(page, CUCINA)).toHaveCount(1);
      await expect(eventBlocks(page, YOGA)).toHaveCount(0);

      await openMonthDay(page, tomorrow);
      await expect(monthRowsOf(page, YOGA)).toHaveCount(1);
      await openMonthDay(page, dayAfter);
      await expect(monthRowsOf(page, CUCINA)).toHaveCount(1);

      // 4. Dettaglio: apro «Yoga Rita» dal giorno e ne sposto l'orario.
      await openDay(page, tomorrow);
      await openDetailFromDay(page, YOGA);
      await expect(page).toHaveURL(new RegExp(`/impegni/${yoga.id}`));
      await expect(h1(page, YOGA)).toBeVisible();
      await waitHydrated(h1(page, YOGA));
      const form = await openForm(page);
      await fieldOf(form, "Dalle").fill("19:00");
      await fieldOf(form, "Alle").fill("20:00");
      await pressSave(page);
      await expect(toastOf(page, "Modifiche salvate")).toBeVisible();
      await expect(editDialog(page)).toBeHidden();
      await expect(card(page)).toContainText("19:00");
      const moved = (await u.events(YOGA))[0]!;
      expect(new Date(moved.starts_at).toISOString()).toBe(at(tomorrow, 19));

      // 5. Dettaglio: elimino tutta la serie «Corso di cucina» dalla prima volta.
      await openDay(page, dayAfter);
      await openDetailFromDay(page, CUCINA);
      await expect(page).toHaveURL(new RegExp(`/impegni/${cucina.id}`));
      await expect(h1(page, CUCINA)).toBeVisible();
      await waitHydrated(h1(page, CUCINA));
      const edit = await openForm(page);
      await buttonOf(edit, "Elimina impegno").click();
      const confirm = confirmDialog(page);
      await expect(confirm).toBeVisible();
      await buttonOf(confirm, "Elimina tutti i prossimi").click();
      await expect(page).toHaveURL(/\/calendario\?settimana=/);
      await expect(toastOf(page, `Eliminato: ${CUCINA}.`)).toBeVisible();
      await u.waitForEvents(CUCINA, 0);

      // ... e sparisce ovunque: settimana, giorno (due volte), mese.
      await openWeek(page, dayAfter);
      await expect(weekLinks(page, CUCINA)).toHaveCount(0);
      await expect(weekLinks(page, YOGA).first()).toBeVisible();
      await openDay(page, dayAfter);
      await expect(eventBlocks(page, CUCINA)).toHaveCount(0);
      await openDay(page, nextWeek);
      await expect(eventBlocks(page, CUCINA)).toHaveCount(0);
      await openMonthDay(page, dayAfter);
      await expect(monthRowsOf(page, CUCINA)).toHaveCount(0);

      // 6. Ricerca: trova Yoga (spostato), non trova il corso eliminato.
      await searchFor(page, "yoga");
      await expect(searchRows(page, YOGA)).toHaveCount(1);
      await searchFor(page, "cucina");
      await expect(searchEmpty(page)).toBeVisible();
      await expect(searchRows(page, CUCINA)).toHaveCount(0);

      // 7. Notifiche (di Rita): «Ilaria ha spostato Yoga Rita», con «Apri».
      // 8. Oggi di Rita: «Domani c'è Yoga Rita alle 19:00».
      await asOther(browser, page, u.asRita, async (rita) => {
        await rita.goto("/notifiche");
        await loaded(rita);
        const row = rowOf(rita, "ha spostato");
        await expect(row).toHaveCount(1);
        await expect(textOf(row)).toContainText(
          new RegExp(`Ilaria ha spostato ${YOGA}: ora è .+ alle 19:00\\.`),
        );
        await openLink(row).click();
        await expect(rita).toHaveURL(new RegExp(`/impegni/${yoga.id}`));
        await expect(h1(rita, YOGA)).toBeVisible();

        await openToday(rita);
        // «Domani» is on the desktop; the phone shows tomorrow only when today
        // is empty (CA-17 of Oggi), which depends on the hour of the run.
        if (!isMobile(rita)) {
          await expect(visibleIn(rita, YOGA).first()).toBeVisible();
          await expect(rita.getByRole("main")).toContainText("19:00");
        }
        await expect(inToday(rita, CUCINA)).toHaveCount(0);
      });

      // 9. Oggi di Ilaria: Yoga alle 19:00 e non il corso eliminato.
      await openToday(page);
      if (!isMobile(page)) {
        await expect(visibleIn(page, YOGA).first()).toBeVisible();
        await expect(page.getByRole("main")).toContainText("19:00");
      }
      await expect(inToday(page, CUCINA)).toHaveCount(0);

      // 10. Elimino anche Yoga dal Dettaglio: sparisce da Oggi, dalla ricerca e
      // dalle notifiche di Rita (la cosa non si può più leggere).
      await openDay(page, tomorrow);
      await openDetailFromDay(page, YOGA);
      await expect(page).toHaveURL(new RegExp(`/impegni/${yoga.id}`));
      await expect(h1(page, YOGA)).toBeVisible();
      await waitHydrated(h1(page, YOGA));
      const last = await openForm(page);
      await buttonOf(last, "Elimina impegno").click();
      await buttonOf(confirmDialog(page), "Elimina impegno").click();
      await expect(toastOf(page, `Eliminato: ${YOGA}.`)).toBeVisible();
      await u.waitForEvents(YOGA, 0);

      await openToday(page);
      await expect(inToday(page, YOGA)).toHaveCount(0);
      await searchFor(page, "yoga");
      await expect(searchEmpty(page)).toBeVisible();
      await expect(searchRows(page, YOGA)).toHaveCount(0);
      await asOther(browser, page, u.asRita, async (rita) => {
        await rita.goto("/notifiche");
        await loaded(rita);
        await expect(rowOf(rita, "ha spostato")).toHaveCount(0);
        await expect(rita.getByText(YOGA)).toHaveCount(0);
      });
    });
  });
});
