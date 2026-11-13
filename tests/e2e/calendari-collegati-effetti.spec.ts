import type { Page } from "@playwright/test";
import {
  GOOGLE,
  addDays,
  at,
  createNestEvent,
  expect,
  linkInBackground,
  needsFake,
  test,
  today,
  tomorrow,
  waitHydrated,
  withLinker,
  withLinkerRita,
  type Linker,
} from "../fixtures/calendari-collegati";
import type { FakeLogEntry } from "../fixtures/calendar-fake";
import {
  barEditButton,
  buttonOf,
  confirmDialog,
  detailPath,
  editDialog,
  failRequests,
  fieldOf,
  groupOf,
  openForm,
  pageEditButton,
  pressSave,
  toastOf,
} from "../fixtures/impegni";
import { expectReady, rowsOf, typeSearch } from "../fixtures/ricerca";

// «Calendari collegati» (#34, parte 2): effetti sulle altre pagine (CA-45 ...
// CA-54, CA-57). Fornitore finto, utenti usa e getta: U (amministratore) e
// Rita (seconda adulta dello stesso Nest). Ogni test pulisce nel `finally`.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });
test.describe.configure({ timeout: 120_000 });

const VISITA = "Visita in banca";
const NUOTO = "Nuoto Sofia";

/** U with Google linked, «Personale» ready for the events given. */
async function linkedWithVisit(
  browser: Parameters<typeof linkInBackground>[0],
  u: Linker,
  visibility: "private" | "busy" | "household" = "busy",
  startHour = 10,
  day = today(),
) {
  await u.prepare(GOOGLE);
  await linkInBackground(browser, u, "google");
  await u.setCalendar("Personale", { visibility });
  await u.provide(GOOGLE, "personale", [
    {
      id: "visita",
      title: VISITA,
      location: "Via Roma 1",
      startsAt: at(day, startHour),
      endsAt: at(day, startHour + 1),
    },
  ]);
  await u.fake.sync(u.user.id);
  await u.waitForEvents(VISITA, 1);
}

/**
 * Records the answers of the functions that tell where an event comes from,
 * as the browser of an adult sees them (LEZIONI: the network, not only the DOM).
 */
function watchSourceAnswers(page: Page) {
  const pending: Promise<string>[] = [];
  const rpc =
    /\/rest\/v1\/rpc\/(list_household_events_with_source|get_event_calendar_link|search_household)$/;
  page.on("response", (response) => {
    if (!rpc.test(new URL(response.url()).pathname)) return;
    pending.push(response.text().catch(() => ""));
  });
  return {
    count: () => pending.length,
    /** Fails if any answer names the provider, the calendar or the mail. */
    async expectNoOrigin() {
      for (const text of await Promise.all(pending)) {
        expect(text).not.toMatch(/google|outlook|personale|u\.finto@example/i);
      }
    },
  };
}

/** An event of U with notes, created with the session of U (RLS applies). */
async function createWithNotes(u: Linker, title: string): Promise<string> {
  const { data, error } = await u.user.client.rpc("create_event", {
    p_title: title,
    p_starts_at: at(today(), 17),
    p_ends_at: at(today(), 18),
    p_member_ids: [u.adminMemberId],
    p_visibility: "household",
    p_location: "Piscina comunale",
    p_notes: "Portare la cuffia",
  });
  if (error || !data) throw new Error("Impegno di prova non creato");
  return data;
}

/** Runs the queue of «Anche su» until the register has what the test waits for. */
async function waitForLog(
  u: Linker,
  action: "create" | "update" | "delete",
  match: (entry: FakeLogEntry) => boolean,
  count = 1,
) {
  await expect
    .poll(
      async () => {
        await u.fake.outbox();
        return (await u.fake.log(u.user.id)).filter(
          (entry) => entry.action === action && match(entry),
        ).length;
      },
      { timeout: 30_000 },
    )
    .toBe(count);
}

/** Sends an event of U to the calendar chosen, as «Anche su» does. */
async function sendNow(u: Linker, id: string) {
  const { error } = await u.user.client.rpc("set_event_also_on", {
    p_event_id: id,
    p_enabled: true,
  });
  if (error) throw new Error("Impegno di prova non mandato");
}

const logOf = async (u: Linker, action: FakeLogEntry["action"]) =>
  (await u.fake.log(u.user.id)).filter((entry) => entry.action === action);

async function visitId(u: Linker): Promise<string> {
  return (await u.events(VISITA))[0]!.id;
}

test.describe("righe di Profilo e Nest", () => {
  test("CA-54: senza account collegati il profilo dice «Nessuno collegato» senza numero e il Nest non ha testo sotto", async ({
    page,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await u.signIn(page);
      await page.goto("/profilo");
      const row = page.locator("a.riga-lista", {
        hasText: "Calendari collegati",
      });
      await expect(row).toBeVisible();
      await expect(row.locator(".riga-lista__info")).toHaveText(
        "Nessuno collegato",
      );
      await expect(row.locator(".riga-lista__valore")).toHaveText("");

      await page.goto("/nest");
      const nestRow = page.locator("a.riga-lista", {
        hasText: "Calendari collegati",
      });
      await expect(nestRow).toBeVisible();
      await expect(nestRow.locator(".riga-lista__info")).toHaveCount(0);
    });
  });

  test("CA-53: con Google collegato il profilo dice «Google» e il numero dei calendari accesi, il Nest «Google · n attivi»", async ({
    page,
    browser,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await u.prepare(GOOGLE);
      await linkInBackground(browser, u, "google");
      await u.setCalendar("Tennis", { is_enabled: true });
      const on = (await u.calendars()).filter((c) => c.is_enabled).length;
      expect(on).toBe(2);

      await u.signIn(page);
      await page.goto("/profilo");
      const row = page.locator("a.riga-lista", {
        hasText: "Calendari collegati",
      });
      await expect(row.locator(".riga-lista__info")).toHaveText("Google");
      await expect(row.locator(".riga-lista__valore")).toHaveText(String(on));

      await page.goto("/nest");
      const nestRow = page.locator("a.riga-lista", {
        hasText: "Calendari collegati",
      });
      await expect(nestRow.locator(".riga-lista__info")).toHaveText(
        `Google · ${on} attivi`,
      );
    });
  });
});

test.describe("etichetta della fonte", () => {
  test("CA-45: «Visita in banca» importata ha l'etichetta «Google» per U e nessuna riga con «Google» per Rita", async ({
    page,
    browser,
    baseURL,
  }) => {
    needsFake();
    await withLinkerRita(baseURL, async (u) => {
      // The visit is at 9:30 and the page thinks it is 8:30, whatever the hour of the run.
      await linkedWithVisit(browser, u, "household", 9);
      await page.clock.setFixedTime(new Date(at(today(), 8, 30)));

      await u.signIn(page);
      await page.goto("/oggi");
      const next = page.getByRole("link", { name: new RegExp(VISITA) });
      await expect(next.first()).toBeVisible();
      await expect(next.first()).toContainText("Google");

      await page.context().clearCookies();
      await u.rita.signInContext(page.context(), baseURL as string);
      const seen = watchSourceAnswers(page);
      await page.goto("/oggi");
      await expect(
        page.getByRole("link", { name: new RegExp(VISITA) }).first(),
      ).toBeVisible();
      await page.getByRole("button", { name: /Nest/ }).first().click();
      await expect(page.getByRole("main")).not.toContainText("Google");
      // The network too: what reached Rita's browser has no provider, calendar or mail.
      await expect.poll(() => seen.count()).toBeGreaterThan(0);
      await seen.expectNoOrigin();
    });
  });
});

test.describe("etichetta della fonte nella ricerca", () => {
  test("CA-45: nella ricerca «Visita in banca» ha l'etichetta «Google» per U e non per Rita", async ({
    page,
    browser,
    baseURL,
  }) => {
    needsFake();
    await withLinkerRita(baseURL, async (u) => {
      await linkedWithVisit(browser, u, "household", 10, tomorrow());

      await u.signIn(page);
      await page.goto("/ricerca");
      await expectReady(page);
      await typeSearch(page, "Visita");
      await expect(rowsOf(page, "event").first()).toContainText(VISITA);
      await expect(rowsOf(page, "event").first()).toContainText("Google");

      await page.context().clearCookies();
      await u.rita.signInContext(page.context(), baseURL as string);
      const seen = watchSourceAnswers(page);
      await page.goto("/ricerca");
      await expectReady(page);
      await typeSearch(page, "Visita");
      await expect(rowsOf(page, "event").first()).toContainText(VISITA);
      await expect(rowsOf(page, "event").first()).not.toContainText("Google");
      await expect.poll(() => seen.count()).toBeGreaterThan(0);
      await seen.expectNoOrigin();
    });
  });
});

test.describe("impegni importati in Dettaglio", () => {
  test("CA-46, CA-47 e CA-51: U apre Modifica, i campi sono bloccati, «Chi lo vede» no, non c'è «Elimina impegno» né «Anche su»; «Solo io» resta dopo una sincronizzazione", async ({
    page,
    browser,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await linkedWithVisit(browser, u);
      const id = await visitId(u);
      await u.signIn(page);
      await page.goto(detailPath(id));
      await waitHydrated(page.getByRole("heading", { level: 1 }));
      await expect(page.getByRole("main")).toContainText("Google");

      const dialog = await openForm(page);
      await expect(dialog).toContainText("Si cambia su Google");
      for (const label of ["Titolo", "Giorno", "Dalle", "Alle", "Dove"]) {
        await expect(fieldOf(dialog, label)).toBeDisabled();
      }
      await expect(fieldOf(dialog, "Si ripete")).toBeDisabled();
      const solo = groupOf(dialog, "Chi lo vede").getByRole("button", {
        name: "Solo io",
        exact: true,
      });
      await expect(solo).toBeEnabled();
      await expect(buttonOf(dialog, "Elimina impegno")).toHaveCount(0);
      await expect(dialog.getByRole("switch")).toHaveCount(0);

      await solo.click();
      await pressSave(page);
      await expect(toastOf(page, "Modifiche salvate")).toBeVisible();
      await expect(editDialog(page)).toHaveCount(0);
      expect((await u.events(VISITA))[0]?.visibility).toBe("private");

      await u.fake.sync(u.user.id);
      expect((await u.events(VISITA))[0]?.visibility).toBe("private");
      const calendar = (await u.calendars()).find(
        (c) => c.name === "Personale",
      );
      expect(calendar?.visibility).toBe("busy");
    });
  });

  test("CA-48: Rita vede l'impegno «Tutti» ma non ha «Modifica», e una modifica o una cancellazione con la sua sessione è rifiutata", async ({
    page,
    browser,
    baseURL,
  }) => {
    needsFake();
    await withLinkerRita(baseURL, async (u) => {
      await linkedWithVisit(browser, u, "household");
      const id = await visitId(u);
      await u.rita.signInContext(page.context(), baseURL as string);
      const seen = watchSourceAnswers(page);
      await page.goto(detailPath(id));
      await expect(
        page.getByRole("heading", { level: 1, name: VISITA }),
      ).toBeVisible();
      await expect(pageEditButton(page)).toHaveCount(0);
      await expect(barEditButton(page)).toHaveCount(0);
      await expect(page.getByRole("main")).not.toContainText("Google");
      await expect.poll(() => seen.count()).toBeGreaterThan(0);
      await seen.expectNoOrigin();

      const change = await u.rita.client
        .from("events")
        .update({ title: "Cambiato" })
        .eq("id", id);
      expect(change.error).not.toBeNull();
      const removal = await u.rita.client.from("events").delete().eq("id", id);
      expect(removal.error).not.toBeNull();
      const rows = await u.events(VISITA);
      expect(rows).toHaveLength(1);
    });
  });
});

test.describe("«Anche su» nel modulo dell'impegno", () => {
  /** «Dove vanno i nuovi impegni»: a calendar by name, or `null` («Nessuno»). */
  async function chooseTarget(u: Linker, name: string | null) {
    const calendar = (await u.calendars()).find((c) => c.name === name);
    const { error } = await u.user.client.rpc("set_new_events_calendar", {
      // The function accepts null; the generated type says string.
      p_calendar_id: (calendar?.id ?? null) as string,
    });
    if (error) throw new Error("Calendario dei nuovi impegni non scelto");
  }

  test("CA-51: con «Dove vanno i nuovi impegni» = «Nessuno» nel modulo di un impegno di U non c'è «Anche su»", async ({
    page,
    browser,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await u.prepare(GOOGLE);
      await linkInBackground(browser, u, "google");
      await createNestEvent(u, NUOTO, today(), [17, 0], [18, 0]);
      const id = (await u.events(NUOTO))[0]!.id;
      await u.signIn(page);
      await chooseTarget(u, null);
      await page.goto(detailPath(id));
      await waitHydrated(page.getByRole("heading", { level: 1 }));
      const dialog = await openForm(page);
      await expect(dialog.getByRole("switch")).toHaveCount(0);
    });
  });

  test("CA-49: «Anche su Google» manda a «Personale» titolo, orari e luogo come privato, senza note né persone, e dopo la sincronizzazione c'è una sola riga", async ({
    page,
    browser,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await u.prepare(GOOGLE);
      await linkInBackground(browser, u, "google");
      await chooseTarget(u, "Personale");
      const id = await createWithNotes(u, NUOTO);
      await u.signIn(page);
      await page.goto(detailPath(id));
      await waitHydrated(page.getByRole("heading", { level: 1 }));
      const dialog = await openForm(page);
      await expect(dialog).toContainText("Nel calendario Personale");
      const toggle = dialog.getByRole("switch", {
        name: "Anche su Google",
        exact: true,
      });
      await expect(toggle).toHaveAttribute("aria-checked", "false");
      await toggle.click();
      await pressSave(page);
      await expect(toastOf(page, "Modifiche salvate")).toBeVisible();
      await expect(editDialog(page)).toHaveCount(0);

      await waitForLog(u, "create", (entry) => entry.title === NUOTO);
      const [created] = await logOf(u, "create");
      expect(created?.calendarId).toBe("personale");
      expect(created?.email).toBe(GOOGLE.email);
      const sent = created?.outgoing;
      expect(sent?.title).toBe(NUOTO);
      expect(sent?.location).toBe("Piscina comunale");
      expect(new Date(sent!.startsAt).getTime()).toBe(
        new Date(at(today(), 17)).getTime(),
      );
      expect(new Date(sent!.endsAt).getTime()).toBe(
        new Date(at(today(), 18)).getTime(),
      );
      expect(sent?.isPrivate).toBe(true);
      // Nothing else left: no notes, no people.
      for (const key of ["notes", "description", "attendees", "members"]) {
        expect(sent).not.toHaveProperty(key);
      }
      expect(JSON.stringify(created)).not.toContain("cuffia");

      // The next synchronisation brings the copy back: still one row.
      await u.fake.sync(u.user.id);
      expect(await u.events(NUOTO)).toHaveLength(1);
      await u.fake.sync(u.user.id);
      expect(await u.events(NUOTO)).toHaveLength(1);
    });
  });

  test("CA-50: cambiare l'orario di un impegno mandato manda un aggiornamento e spegnere «Anche su Google» una cancellazione", async ({
    page,
    browser,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await u.prepare(GOOGLE);
      await linkInBackground(browser, u, "google");
      await chooseTarget(u, "Personale");
      const id = await createWithNotes(u, NUOTO);
      await sendNow(u, id);
      await waitForLog(u, "create", (entry) => entry.title === NUOTO);
      const [created] = await logOf(u, "create");

      await u.signIn(page);
      await page.goto(detailPath(id));
      await waitHydrated(page.getByRole("heading", { level: 1 }));
      let dialog = await openForm(page);
      await fieldOf(dialog, "Dalle").fill("16:00");
      await pressSave(page);
      await expect(toastOf(page, "Modifiche salvate")).toBeVisible();
      await expect(editDialog(page)).toHaveCount(0);

      await waitForLog(
        u,
        "update",
        (entry) =>
          entry.eventId === created?.eventId &&
          new Date(entry.outgoing?.startsAt ?? 0).getTime() ===
            new Date(at(today(), 16)).getTime(),
      );

      // Off: the copy at the provider is deleted.
      dialog = await openForm(page);
      const toggle = dialog.getByRole("switch", {
        name: "Anche su Google",
        exact: true,
      });
      await expect(toggle).toHaveAttribute("aria-checked", "true");
      await toggle.click();
      await pressSave(page);
      await expect(toastOf(page, "Modifiche salvate")).toBeVisible();
      await waitForLog(
        u,
        "delete",
        (entry) => entry.eventId === created?.eventId,
      );
    });
  });

  test("CA-50: eliminare in FamilyNest un impegno mandato cancella la sua copia dal fornitore", async ({
    page,
    browser,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await u.prepare(GOOGLE);
      await linkInBackground(browser, u, "google");
      await chooseTarget(u, "Personale");
      const id = await createWithNotes(u, NUOTO);
      await sendNow(u, id);
      await waitForLog(u, "create", (entry) => entry.title === NUOTO);
      const [created] = await logOf(u, "create");

      await u.signIn(page);
      await page.goto(detailPath(id));
      await waitHydrated(page.getByRole("heading", { level: 1 }));
      const dialog = await openForm(page);
      await buttonOf(dialog, "Elimina impegno").click();
      await buttonOf(confirmDialog(page), "Elimina impegno").click();
      await expect(page).toHaveURL(/\/calendario/);
      expect(await u.events(NUOTO)).toHaveLength(0);

      await waitForLog(
        u,
        "delete",
        (entry) => entry.eventId === created?.eventId,
      );
    });
  });

  test("CA-52: con il fornitore non raggiungibile il salvataggio riesce, e quando torna la copia viene creata", async ({
    page,
    browser,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await u.prepare(GOOGLE);
      await linkInBackground(browser, u, "google");
      await chooseTarget(u, "Personale");
      const id = await createWithNotes(u, NUOTO);
      await u.signIn(page);
      await page.goto(detailPath(id));
      await waitHydrated(page.getByRole("heading", { level: 1 }));
      const dialog = await openForm(page);
      await fieldOf(dialog, "Titolo").fill(`${NUOTO} 2`);
      await dialog
        .getByRole("switch", { name: "Anche su Google", exact: true })
        .click();

      const provider = {
        userId: u.user.id,
        email: GOOGLE.email,
        provider: GOOGLE.provider,
      };
      await u.fake.fail({ ...provider, unreachable: true });
      await pressSave(page);
      await expect(toastOf(page, "Modifiche salvate")).toBeVisible();
      await expect(editDialog(page)).toHaveCount(0);
      await expect(page.getByTestId("anche-su-errore")).toHaveCount(0);
      expect(await u.events(`${NUOTO} 2`)).toHaveLength(1);

      // The scheduled job meets the unreachable provider: nothing is created.
      const first = await u.fake.outbox();
      expect(first.done).toBe(0);
      expect(await logOf(u, "create")).toHaveLength(0);

      // The provider is back and the retry is due: the copy is created.
      // Slow provider: the second run starts while the first still waits.
      await u.fake.fail({ ...provider, unreachable: false, slowMs: 3000 });
      const due = await u.user.admin
        .from("calendar_outbox")
        .update(
          { next_attempt_at: new Date(Date.now() - 60_000).toISOString() },
          { count: "exact" },
        )
        .eq("event_id", id);
      expect(due.error).toBeNull();
      expect(due.count).toBe(1);
      await waitForLog(u, "create", (entry) => entry.title === `${NUOTO} 2`);
    });
  });

  test("due invii della coda partiti insieme prenotano righe diverse e la copia è una sola (#373)", async ({
    page,
    browser,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await u.prepare(GOOGLE);
      await linkInBackground(browser, u, "google");
      await chooseTarget(u, "Personale");
      const id = await createWithNotes(u, NUOTO);
      await u.signIn(page);
      await page.goto(detailPath(id));
      await waitHydrated(page.getByRole("heading", { level: 1 }));
      const dialog = await openForm(page);
      await dialog
        .getByRole("switch", { name: "Anche su Google", exact: true })
        .click();

      const provider = {
        userId: u.user.id,
        email: GOOGLE.email,
        provider: GOOGLE.provider,
      };
      // Held back while unreachable, then both runs start at the same time.
      await u.fake.fail({ ...provider, unreachable: true });
      await pressSave(page);
      await expect(toastOf(page, "Modifiche salvate")).toBeVisible();
      await u.fake.outbox();
      expect(await logOf(u, "create")).toHaveLength(0);
      await u.fake.fail({ ...provider, unreachable: false });
      const due = await u.user.admin
        .from("calendar_outbox")
        .update(
          { next_attempt_at: new Date(Date.now() - 60_000).toISOString() },
          { count: "exact" },
        )
        .eq("event_id", id);
      expect(due.error).toBeNull();
      expect(due.count).toBe(1);

      const runs = await Promise.all([u.fake.outbox(), u.fake.outbox()]);
      expect(runs.map((run) => run.done).sort()).toEqual([0, 1]);
      expect(runs.every((run) => run.failed === 0)).toBe(true);
      const created = await logOf(u, "create");
      expect(created).toHaveLength(1);
      expect(created[0]?.title).toBe(NUOTO);
      await u.fake.outbox();
      expect(await logOf(u, "create")).toHaveLength(1);
    });
  });

  /** A weekly event of U that starts today, sent to Google and created there. */
  async function weeklySent(u: Linker, title: string): Promise<string> {
    const weekday = new Date(`${today()}T12:00:00Z`).getUTCDay() || 7;
    const { data, error } = await u.user.client.rpc("create_event", {
      p_title: title,
      p_starts_at: at(today(), 17),
      p_ends_at: at(today(), 18),
      p_member_ids: [u.adminMemberId],
      p_visibility: "household",
      p_recurrence: "weekly",
      p_recurrence_weekdays: [weekday],
    });
    if (error || !data) throw new Error("Impegno ripetuto di prova non creato");
    const sent = await u.user.client.rpc("set_event_also_on", {
      p_event_id: data,
      p_enabled: true,
    });
    if (sent.error) throw new Error("Impegno di prova non mandato");
    await u.fake.outbox();
    await expect
      .poll(async () =>
        (await u.fake.log(u.user.id)).filter(
          (entry) => entry.action === "create" && entry.title === title,
        ),
      )
      .toHaveLength(1);
    return data;
  }

  test("CA-50: la serie mandata che si divide con «Anche su» acceso manda la serie nuova al fornitore", async ({
    page,
    browser,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await u.prepare(GOOGLE);
      await linkInBackground(browser, u, "google");
      const id = await weeklySent(u, NUOTO);
      await u.signIn(page);
      await page.goto(detailPath(id, addDays(today(), 7)));
      await waitHydrated(page.getByRole("heading", { level: 1 }));
      const dialog = await openForm(page);
      await expect(
        dialog.getByRole("switch", { name: "Anche su Google", exact: true }),
      ).toHaveAttribute("aria-checked", "true");
      await fieldOf(dialog, "Titolo").fill(`${NUOTO} 2`);
      await pressSave(page);
      await buttonOf(confirmDialog(page), "Salva tutti i prossimi").click();
      await expect(toastOf(page, "Modifiche salvate")).toBeVisible();

      await u.fake.outbox();
      await expect
        .poll(async () =>
          (await u.fake.log(u.user.id)).filter(
            (entry) =>
              entry.action === "create" && entry.title === `${NUOTO} 2`,
          ),
        )
        .toHaveLength(1);
    });
  });

  test("CA-50: la serie mandata che si divide con «Anche su» spento ritira la copia della serie di partenza e non manda la nuova", async ({
    page,
    browser,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await u.prepare(GOOGLE);
      await linkInBackground(browser, u, "google");
      const id = await weeklySent(u, NUOTO);
      const [created] = await logOf(u, "create");
      await u.signIn(page);
      await page.goto(detailPath(id, addDays(today(), 7)));
      await waitHydrated(page.getByRole("heading", { level: 1 }));
      const dialog = await openForm(page);
      const toggle = dialog.getByRole("switch", {
        name: "Anche su Google",
        exact: true,
      });
      await expect(toggle).toHaveAttribute("aria-checked", "true");
      await toggle.click();
      await fieldOf(dialog, "Titolo").fill(`${NUOTO} 2`);
      await pressSave(page);
      await buttonOf(confirmDialog(page), "Salva tutti i prossimi").click();
      await expect(toastOf(page, "Modifiche salvate")).toBeVisible();
      await expect(editDialog(page)).toHaveCount(0);

      await waitForLog(
        u,
        "delete",
        (entry) => entry.eventId === created?.eventId,
      );
      await u.fake.outbox();
      expect(
        (await logOf(u, "create")).filter(
          (entry) => entry.title === `${NUOTO} 2`,
        ),
      ).toHaveLength(0);
      expect((await u.events(`${NUOTO} 2`)).length).toBe(1);
    });
  });

  test("CA-52: se solo «Anche su» non riesce l'impegno resta salvato, il foglio si chiude e «Riprova» manda solo «Anche su»", async ({
    page,
    browser,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await u.prepare(GOOGLE);
      await linkInBackground(browser, u, "google");
      await createNestEvent(u, NUOTO, today(), [17, 0], [18, 0]);
      const id = (await u.events(NUOTO))[0]!.id;
      await u.signIn(page);
      await page.goto(detailPath(id));
      await waitHydrated(page.getByRole("heading", { level: 1 }));
      const dialog = await openForm(page);
      await fieldOf(dialog, "Titolo").fill(`${NUOTO} 2`);
      await dialog
        .getByRole("switch", { name: "Anche su Google", exact: true })
        .click();
      const route = /\/rest\/v1\/rpc\/set_event_also_on(\?|$)/;
      await failRequests(page, route);
      await pressSave(page);

      await expect(editDialog(page)).toHaveCount(0);
      const notice = page.getByTestId("anche-su-errore");
      await expect(notice).toContainText("Le modifiche sono salvate");
      await expect(page.getByText("Non riusciamo a salvare")).toHaveCount(0);
      expect((await u.events(`${NUOTO} 2`)).length).toBe(1);

      await page.unroute(route);
      await buttonOf(notice, "Riprova").click();
      await expect(notice).toHaveCount(0);
      await u.fake.outbox();
      await expect
        .poll(async () =>
          (await u.fake.log(u.user.id)).filter(
            (entry) =>
              entry.action === "create" && entry.title === `${NUOTO} 2`,
          ),
        )
        .toHaveLength(1);
    });
  });

  test("CA-51: l'impegno «Tutti» di U non ha «Anche su» per Rita", async ({
    page,
    baseURL,
  }) => {
    needsFake();
    await withLinkerRita(baseURL, async (u) => {
      await createNestEvent(u, NUOTO, today(), [17, 0], [18, 0]);
      const id = (await u.events(NUOTO))[0]!.id;
      await u.rita.signInContext(page.context(), baseURL as string);
      await page.goto(detailPath(id));
      await waitHydrated(page.getByRole("heading", { level: 1 }));
      const dialog = await openForm(page);
      await expect(dialog.getByRole("switch")).toHaveCount(0);
    });
  });
});

test.describe("«I tuoi dati»", () => {
  test("CA-57: il file ha la sezione dei calendari con Google, la mail e le impostazioni, e nessun token", async ({
    page,
    browser,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await u.prepare(GOOGLE);
      await linkInBackground(browser, u, "google");
      await u.signIn(page);
      const response = await page.request.post("/profilo/dati");
      expect(response.status()).toBe(200);
      const text = await response.text();
      const file = JSON.parse(text) as {
        calendari_collegati: Array<{
          servizio: string;
          mail: string;
          calendari: Array<{ nome: string; chi_lo_vede: string }>;
        }>;
      };
      expect(file.calendari_collegati).toHaveLength(1);
      const account = file.calendari_collegati[0]!;
      expect(account.servizio).toBe("Google");
      expect(account.mail).toBe("u.finto@example.test");
      expect(account.calendari.map((c) => c.nome)).toContain("Personale");
      expect(account.calendari[0]).toHaveProperty("chi_lo_vede");
      for (const token of await u.tokens()) {
        expect(text).not.toContain(token);
      }
      expect(text).not.toContain("credentials");
    });
  });
});
