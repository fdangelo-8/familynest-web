import type { Locator, Page } from "@playwright/test";
import {
  GOOGLE,
  OUTLOOK,
  at,
  expect,
  linkInBackground,
  needsFake,
  test,
  tomorrow,
  withLinker,
  withLinkerRita,
  type Linker,
} from "../fixtures/calendari-collegati";
import type { FakeLogEntry } from "../fixtures/calendar-fake";
import { fieldOf, groupOf, toastOf } from "../fixtures/impegni";

// «Anche su …» nel modulo «Nuovo impegno» di Aggiungi (#304, PR #361): la riga,
// il calendario da ricollegare, l'invio, «Annulla», l'invio non riuscito, la
// lettura del calendario non riuscita, rete e privacy. Fornitore finto e utenti
// usa e getta (U, e Rita per la privacy): ogni test pulisce nel `finally` di
// `withLinker`. Il toast «Messo in …» compare solo quando il foglio si chiude
// (specifica grafica della #304, punto 1).

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });
test.describe.configure({ timeout: 150_000 });

test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

const NUOTO = "Nuoto Sofia";
const CREATE_EVENT = /\/rest\/v1\/rpc\/create_event(\?|$)/;
const SET_ALSO_ON = /\/rest\/v1\/rpc\/set_event_also_on(\?|$)/;
const SAVE_ERROR =
  "Non siamo riusciti a salvare l'impegno. Controlla la connessione e riprova.";
const READ_ERROR =
  "Non riusciamo a caricare i tuoi calendari collegati: per ora l'impegno resta solo in FamilyNest. Controlla la connessione e riprova.";
const TOAST = /^Messo in [^:.]+: Nuoto Sofia alle 17:00\.\s*Annulla$/;

/** «Dove vanno i nuovi impegni»: a calendar by name, or `null` («Nessuno»). */
async function chooseTarget(u: Linker, name: string | null) {
  const calendar = (await u.calendars()).find((c) => c.name === name);
  const { error } = await u.user.client.rpc("set_new_events_calendar", {
    // The function accepts null; the generated type says string.
    p_calendar_id: (calendar?.id ?? null) as string,
  });
  if (error) throw new Error("Calendario dei nuovi impegni non scelto");
}

/** U with Google linked and «Personale» chosen. */
async function withGoogle(
  browser: Parameters<typeof linkInBackground>[0],
  u: Linker,
  target: string | null = "Personale",
) {
  await u.prepare(GOOGLE);
  await linkInBackground(browser, u, "google");
  await chooseTarget(u, target);
}

const addDialog = (page: Page) =>
  page.getByRole("dialog", { name: "Aggiungi" });
const moduleOf = (page: Page) =>
  page.getByRole("dialog", { name: "Nuovo impegno" });
const switchOf = (form: Locator, provider = "Google") =>
  form.getByRole("switch", { name: `Anche su ${provider}`, exact: true });
/** The row: the switch has the test id, the row is the list row that holds it. */
const rowOf = (form: Locator) =>
  form
    .locator(".riga-lista")
    .filter({ has: form.getByTestId("impegno-anche-su") });
const submitOf = (form: Locator) =>
  form.getByRole("button", { name: /^Metti in / });
const isDesktop = (page: Page) => (page.viewportSize()?.width ?? 0) >= 1024;

/** Opens Aggiungi, writes the phrase and opens the full form «Nuovo impegno». */
async function openModule(page: Page, phrase = NUOTO) {
  await page.goto("/aggiungi");
  const dialog = addDialog(page);
  const field = dialog.getByRole("textbox", { name: "Cosa vuoi aggiungere?" });
  await expect(field).toBeFocused({ timeout: 20_000 });
  await field.pressSequentially(phrase);
  await dialog
    .getByRole("button", {
      name: isDesktop(page) ? "Tutti i dettagli" : "Più dettagli",
    })
    .click();
  const form = moduleOf(page);
  await expect(form).toBeVisible();
  await expect(fieldOf(form, "Titolo")).toBeFocused();
  return form;
}

/** The «Impegno di prova»: tomorrow 17:00 - 18:00, with place and notes. */
async function fillTrial(form: Locator, repeat?: "weekly") {
  await fieldOf(form, "Titolo").fill(NUOTO);
  await fieldOf(form, "Giorno").fill(tomorrow());
  await fieldOf(form, "Dalle").fill("17:00");
  await fieldOf(form, "Alle").fill("18:00");
  await fieldOf(form, "Dove").fill("Piscina comunale");
  await fieldOf(form, "Note").fill("Portare la cuffia");
  if (repeat) await fieldOf(form, "Si ripete").selectOption(repeat);
}

/** The requests to the two functions, in order, with the answers of create_event. */
function watchRpc(page: Page) {
  const steps: string[] = [];
  const bodies: Array<{ name: string; body: Record<string, unknown> }> = [];
  const name = (url: string) => {
    const path = new URL(url).pathname;
    if (path.endsWith("/rpc/create_event")) return "create_event";
    if (path.endsWith("/rpc/set_event_also_on")) return "set_event_also_on";
    return null;
  };
  page.on("request", (request) => {
    const kind = name(request.url());
    if (!kind || request.method() !== "POST") return;
    steps.push(`request:${kind}`);
    bodies.push({
      name: kind,
      body: (request.postDataJSON() ?? {}) as Record<string, unknown>,
    });
  });
  page.on("response", (response) => {
    const kind = name(response.url());
    if (kind && response.request().method() === "POST") {
      steps.push(`response:${kind}:${response.status()}`);
    }
  });
  return {
    steps,
    count: (kind: string) =>
      steps.filter((step) => step === `request:${kind}`).length,
    bodiesOf: (kind: string) =>
      bodies.filter((entry) => entry.name === kind).map((entry) => entry.body),
  };
}

/** Rows of the queue of «Anche su» for an event (administrative key: only to check). */
async function outboxOf(u: Linker, eventId: string) {
  const { data, error } = await u.user.admin
    .from("calendar_outbox")
    .select("id, action")
    .eq("event_id", eventId);
  if (error) throw new Error("Lettura della coda di prova fallita");
  return data;
}

const logOf = async (u: Linker, action: FakeLogEntry["action"]) =>
  (await u.fake.log(u.user.id)).filter((entry) => entry.action === action);

const idOf = async (u: Linker, title = NUOTO): Promise<string> => {
  const events = await u.events(title);
  expect(events).toHaveLength(1);
  return events[0]!.id;
};

/** Fills the trial event, turns the switch on and saves. */
async function saveTrial(
  form: Locator,
  { on = true, repeat }: { on?: boolean; repeat?: "weekly" } = {},
) {
  await fillTrial(form, repeat);
  if (on) await switchOf(form).click();
  await submitOf(form).click();
}

test.describe("la riga", () => {
  test("CA-1: con Google e «Personale» la riga è dopo «Chi lo vede», con titolo, info e interruttore spento", async ({
    page,
    browser,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await withGoogle(browser, u);
      await u.signIn(page);
      const form = await openModule(page);
      const row = rowOf(form);
      await expect(row).toBeVisible();
      await expect(row.locator(".riga-lista__titolo")).toHaveText(
        "Anche su Google",
      );
      await expect(row.locator(".riga-lista__info")).toHaveText(
        "Nel calendario Personale",
      );
      const toggle = switchOf(form);
      await expect(toggle).toHaveAttribute("aria-checked", "false");
      await expect(toggle).toBeEnabled();
      // After «Chi lo vede», before «Note»
      const before = await groupOf(form, "Chi lo vede").boundingBox();
      const after = await fieldOf(form, "Note").boundingBox();
      const own = await row.boundingBox();
      expect(own!.y).toBeGreaterThan(before!.y);
      expect(own!.y).toBeLessThan(after!.y);
    });
  });

  test("CA-2: con Outlook e «Calendario» la riga dice «Anche su Outlook» e «Nel calendario Calendario»", async ({
    page,
    browser,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await u.prepare(OUTLOOK);
      await linkInBackground(browser, u, "outlook");
      await chooseTarget(u, "Calendario");
      await u.signIn(page);
      const form = await openModule(page);
      const row = rowOf(form);
      await expect(row.locator(".riga-lista__titolo")).toHaveText(
        "Anche su Outlook",
      );
      await expect(row.locator(".riga-lista__info")).toHaveText(
        "Nel calendario Calendario",
      );
      await expect(switchOf(form, "Outlook")).toBeVisible();
    });
  });

  test("CA-3: nel foglio con la frase non c'è nessun interruttore né «Anche su»", async ({
    page,
    browser,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await withGoogle(browser, u);
      await u.signIn(page);
      await page.goto("/aggiungi");
      const dialog = addDialog(page);
      const field = dialog.getByRole("textbox", {
        name: "Cosa vuoi aggiungere?",
      });
      await expect(field).toBeFocused({ timeout: 20_000 });
      await field.pressSequentially("Nuoto Sofia domani alle 17");
      await expect(
        dialog.getByRole("button", {
          name: isDesktop(page) ? "Tutti i dettagli" : "Più dettagli",
        }),
      ).toBeVisible();
      await expect(dialog.getByRole("switch")).toHaveCount(0);
      await expect(dialog.getByText("Anche su")).toHaveCount(0);
    });
  });

  test("CA-4: con «Dove vanno i nuovi impegni» = «Nessuno» la riga non c'è", async ({
    page,
    browser,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await withGoogle(browser, u, null);
      await u.signIn(page);
      const form = await openModule(page);
      await expect(rowOf(form)).toHaveCount(0);
      await expect(form.getByRole("switch")).toHaveCount(0);
    });
  });

  test("CA-5: senza calendari collegati la riga non c'è", async ({
    page,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await u.signIn(page);
      const form = await openModule(page);
      await expect(rowOf(form)).toHaveCount(0);
      await expect(form.getByRole("switch")).toHaveCount(0);
    });
  });

  test("CA-6: l'interruttore acceso e il foglio chiuso senza salvare: riaprendo il modulo è spento", async ({
    page,
    browser,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await withGoogle(browser, u);
      await u.signIn(page);
      const form = await openModule(page);
      await switchOf(form).click();
      await expect(switchOf(form)).toHaveAttribute("aria-checked", "true");
      // «Chiudi» of the form goes back to the phrase, the second one closes the sheet.
      await form.getByRole("button", { name: "Chiudi" }).click();
      await expect(addDialog(page)).toBeVisible();
      await addDialog(page).getByRole("button", { name: "Chiudi" }).click();
      await expect(addDialog(page)).toHaveCount(0);

      const again = await openModule(page);
      await expect(switchOf(again)).toHaveAttribute("aria-checked", "false");
    });
  });
});

test.describe("calendario da ricollegare", () => {
  async function reconnect(u: Linker) {
    await u.fake.fail({
      userId: u.user.id,
      email: GOOGLE.email,
      authFailsFrom: new Date(Date.now() - 3_600_000).toISOString(),
    });
    await u.fake.sync(u.user.id);
    const [account] = await u.accounts();
    expect(account?.status).toBe("reconnect");
  }

  test("CA-7: la riga dice che Google non si sincronizza e l'interruttore è spento e disabilitato", async ({
    page,
    browser,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await withGoogle(browser, u);
      await reconnect(u);
      await u.signIn(page);
      const form = await openModule(page);
      const row = rowOf(form);
      await expect(row.locator(".riga-lista__titolo")).toHaveText(
        "Anche su Google",
      );
      const info = row.locator(".riga-lista__info");
      await expect(info).toHaveText(
        "Google non si sincronizza: ricollegalo da Calendari collegati.",
      );
      await expect(info).toHaveClass(/riga-lista__info--allerta/);
      await expect(switchOf(form)).toBeDisabled();
      await expect(switchOf(form)).toHaveAttribute("aria-checked", "false");
    });
  });

  test("CA-8: salvando l'impegno è creato, il toast compare e non parte nessun invio né riga in coda", async ({
    page,
    browser,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await withGoogle(browser, u);
      await reconnect(u);
      await u.signIn(page);
      const rpc = watchRpc(page);
      const form = await openModule(page);
      await saveTrial(form, { on: false });
      await expect(toastOf(page, TOAST)).toBeVisible();
      await expect(form).toHaveCount(0);
      const id = await idOf(u);
      expect(rpc.count("create_event")).toBe(1);
      expect(rpc.count("set_event_also_on")).toBe(0);
      expect(await outboxOf(u, id)).toHaveLength(0);
    });
  });
});

test.describe("l'invio", () => {
  test("CA-9, CA-10 e CA-11: prima create_event, poi una sola set_event_also_on; la coda ha una creazione e il registro del finto solo il necessario", async ({
    page,
    browser,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await withGoogle(browser, u);
      await u.signIn(page);
      const rpc = watchRpc(page);
      const form = await openModule(page);
      await saveTrial(form);

      await expect(toastOf(page, TOAST)).toBeVisible();
      await expect(form).toHaveCount(0);
      const id = await idOf(u);
      expect(rpc.steps.filter((s) => !s.startsWith("response:set"))).toEqual([
        "request:create_event",
        "response:create_event:200",
        "request:set_event_also_on",
      ]);
      expect(rpc.bodiesOf("set_event_also_on")).toEqual([
        { p_event_id: id, p_enabled: true },
      ]);

      // CA-10
      const rows = await outboxOf(u, id);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.action).toBe("create");

      // CA-11
      await u.fake.outbox();
      const created = await logOf(u, "create");
      expect(created).toHaveLength(1);
      const [entry] = created;
      expect(entry?.calendarId).toBe("personale");
      expect(entry?.email).toBe(GOOGLE.email);
      const sent = entry?.outgoing;
      expect(sent?.title).toBe(NUOTO);
      expect(sent?.location).toBe("Piscina comunale");
      expect(new Date(sent!.startsAt).getTime()).toBe(
        new Date(at(tomorrow(), 17)).getTime(),
      );
      expect(new Date(sent!.endsAt).getTime()).toBe(
        new Date(at(tomorrow(), 18)).getTime(),
      );
      expect(sent?.isPrivate).toBe(true);
      for (const key of ["notes", "description", "attendees", "members"]) {
        expect(sent).not.toHaveProperty(key);
      }
      expect(JSON.stringify(await u.fake.log(u.user.id))).not.toContain(
        "cuffia",
      );
      await u.fake.sync(u.user.id);
      await u.fake.sync(u.user.id);
      expect(await u.events(NUOTO)).toHaveLength(1);
    });
  });

  test("CA-12: con «Ogni settimana» il registro ha una sola creazione con la ripetizione", async ({
    page,
    browser,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await withGoogle(browser, u);
      await u.signIn(page);
      const form = await openModule(page);
      await saveTrial(form, { repeat: "weekly" });
      await expect(toastOf(page, TOAST)).toBeVisible();
      await idOf(u);
      await u.fake.outbox();
      const created = await logOf(u, "create");
      expect(created.filter((entry) => entry.title === NUOTO)).toHaveLength(1);
      expect(created[0]?.outgoing?.recurrence).not.toBeNull();
    });
  });

  test("CA-13: con l'interruttore spento non parte nessun invio, la coda è vuota e il registro senza creazioni", async ({
    page,
    browser,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await withGoogle(browser, u);
      await u.signIn(page);
      const rpc = watchRpc(page);
      const form = await openModule(page);
      await saveTrial(form, { on: false });
      await expect(toastOf(page, TOAST)).toBeVisible();
      const id = await idOf(u);
      expect(rpc.count("set_event_also_on")).toBe(0);
      expect(await outboxOf(u, id)).toHaveLength(0);
      await u.fake.outbox();
      expect(await logOf(u, "create")).toHaveLength(0);
    });
  });

  test("CA-14: durante il salvataggio l'interruttore è disabilitato e un secondo invio non manda altre richieste", async ({
    page,
    browser,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await withGoogle(browser, u);
      await u.signIn(page);
      let release!: () => void;
      const gate = new Promise<void>((resolve) => (release = resolve));
      await page.route(CREATE_EVENT, async (route) => {
        await gate;
        await route.continue();
      });
      const rpc = watchRpc(page);
      const form = await openModule(page);
      await fillTrial(form);
      await switchOf(form).click();
      await submitOf(form).click();
      await expect(switchOf(form)).toBeDisabled();
      // A second try from the keyboard: the form refuses it.
      await fieldOf(form, "Titolo").press("Enter");
      release();
      await expect(toastOf(page, TOAST)).toBeVisible();
      await idOf(u);
      expect(rpc.count("create_event")).toBe(1);
      expect(rpc.count("set_event_also_on")).toBe(1);
    });
  });

  test("CA-15: se create_event risponde 500 non parte set_event_also_on, il modulo resta con l'avviso e l'interruttore acceso", async ({
    page,
    browser,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await withGoogle(browser, u);
      await u.signIn(page);
      await page.route(CREATE_EVENT, (route) =>
        route.fulfill({ status: 500, json: { message: "boom" } }),
      );
      const rpc = watchRpc(page);
      const form = await openModule(page);
      await saveTrial(form);
      await expect(form.getByText(SAVE_ERROR)).toBeVisible();
      await expect(form).toBeVisible();
      await expect(switchOf(form)).toHaveAttribute("aria-checked", "true");
      expect(rpc.count("set_event_also_on")).toBe(0);
      expect(await u.events(NUOTO)).toHaveLength(0);
    });
  });
});

test.describe("«Annulla» dopo l'invio", () => {
  test("CA-16: «Annulla» prima del lavoro programmato toglie l'impegno e la coda, e il finto non vede nulla", async ({
    page,
    browser,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await withGoogle(browser, u);
      await u.signIn(page);
      const form = await openModule(page);
      await saveTrial(form);
      const toast = toastOf(page, TOAST);
      await expect(toast).toBeVisible();
      const id = await idOf(u);
      await toast.getByRole("button", { name: "Annulla" }).click();
      await expect.poll(() => u.events(NUOTO)).toHaveLength(0);
      expect(await outboxOf(u, id)).toHaveLength(0);
      await u.fake.outbox();
      const log = await u.fake.log(u.user.id);
      expect(
        log.filter(
          (entry) =>
            (entry.action === "create" || entry.action === "delete") &&
            (entry.title === NUOTO || entry.eventId === id),
        ),
      ).toHaveLength(0);
    });
  });

  test("CA-17: «Annulla» dopo il lavoro programmato manda al finto una cancellazione dello stesso impegno", async ({
    page,
    browser,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await withGoogle(browser, u);
      await u.signIn(page);
      const form = await openModule(page);
      await saveTrial(form);
      const toast = toastOf(page, TOAST);
      await expect(toast).toBeVisible();
      await idOf(u);
      await u.fake.outbox();
      const [created] = await logOf(u, "create");
      expect(created?.title).toBe(NUOTO);

      await toast.getByRole("button", { name: "Annulla" }).click();
      await expect.poll(() => u.events(NUOTO)).toHaveLength(0);
      await expect
        .poll(
          async () => {
            await u.fake.outbox();
            return (await logOf(u, "delete")).filter(
              (entry) => entry.eventId === created?.eventId,
            ).length;
          },
          { timeout: 30_000 },
        )
        .toBe(1);
    });
  });
});

test.describe("invio non riuscito", () => {
  /** Saves with the sending refused: the sheet stays open with the notice. */
  async function failedSend(page: Page, u: Linker) {
    await page.route(SET_ALSO_ON, (route) =>
      route.fulfill({ status: 500, json: { message: "boom" } }),
    );
    const rpc = watchRpc(page);
    const form = await openModule(page);
    await saveTrial(form);
    const notice = page.getByTestId("anche-su-errore");
    await expect(notice).toBeVisible();
    expect(await u.events(NUOTO)).toHaveLength(1);
    return { form, notice, rpc };
  }

  test("CA-18: l'impegno resta salvato, il foglio resta aperto con l'avviso e «Riprova», e il toast non c'è ancora", async ({
    page,
    browser,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await withGoogle(browser, u);
      await u.signIn(page);
      const { form, notice, rpc } = await failedSend(page, u);
      await expect(notice).toHaveAttribute("role", "alert");
      await expect(notice).toContainText(
        /^«Nuoto Sofia» è in calendario [^,]+ alle 17:00, ma non siamo riusciti a mandarlo a Google\. Controlla la connessione e riprova\./,
      );
      await expect(
        notice.getByRole("button", { name: "Riprova" }),
      ).toBeVisible();
      await expect(
        notice.getByRole("button", { name: "Riprova" }),
      ).toBeFocused();
      await expect(
        moduleOf(page).getByText(
          "Se chiudi, l'impegno resta solo in FamilyNest. Puoi mandarlo a Google più tardi, da «Modifica» nel dettaglio dell'impegno.",
        ),
      ).toBeVisible();
      // The form is gone: no button to save twice, no «Indietro».
      await expect(submitOf(form)).toHaveCount(0);
      await expect(fieldOf(form, "Titolo")).toHaveCount(0);
      await expect(form.getByRole("button", { name: "Indietro" })).toHaveCount(
        0,
      );
      // The toast waits for the closing.
      await expect(toastOf(page, /Messo in/)).toHaveCount(0);
      expect(rpc.count("create_event")).toBe(1);
    });
  });

  test("CA-19: dopo 6 secondi l'avviso c'è ancora", async ({
    page,
    browser,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await withGoogle(browser, u);
      await u.signIn(page);
      const { notice } = await failedSend(page, u);
      await page.waitForTimeout(6_000);
      await expect(notice).toBeVisible();
      await expect(moduleOf(page)).toBeVisible();
    });
  });

  test("CA-20: tolto il blocco, «Riprova» manda una sola set_event_also_on, il foglio si chiude con il toast e il registro ha una creazione", async ({
    page,
    browser,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await withGoogle(browser, u);
      await u.signIn(page);
      const { notice, rpc } = await failedSend(page, u);
      await page.unroute(SET_ALSO_ON);
      const before = {
        create: rpc.count("create_event"),
        set: rpc.count("set_event_also_on"),
      };
      await notice.getByRole("button", { name: "Riprova" }).click();
      await expect(toastOf(page, TOAST)).toBeVisible();
      await expect(moduleOf(page)).toHaveCount(0);
      await expect(notice).toHaveCount(0);
      expect(rpc.count("set_event_also_on")).toBe(before.set + 1);
      expect(rpc.count("create_event")).toBe(before.create);
      expect(rpc.bodiesOf("set_event_also_on").at(-1)).toEqual({
        p_event_id: await idOf(u),
        p_enabled: true,
      });
      await u.fake.outbox();
      expect(
        (await logOf(u, "create")).filter((entry) => entry.title === NUOTO),
      ).toHaveLength(1);
    });
  });

  test("CA-21: con il blocco ancora attivo «Riprova» lascia l'avviso, con «Riprova» utilizzabile, e un solo impegno", async ({
    page,
    browser,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await withGoogle(browser, u);
      await u.signIn(page);
      const { notice, rpc } = await failedSend(page, u);
      const retry = notice.getByRole("button", { name: "Riprova" });
      await retry.click();
      await expect.poll(() => rpc.count("set_event_also_on")).toBe(2);
      await expect(page.getByTestId("anche-su-errore")).toBeVisible();
      const again = page
        .getByTestId("anche-su-errore")
        .getByRole("button", { name: "Riprova" });
      await expect(again).toBeEnabled();
      await expect(again).toBeFocused();
      expect(await u.events(NUOTO)).toHaveLength(1);
      expect(rpc.count("create_event")).toBe(1);
    });
  });

  test("CA-22: chiudendo il foglio compare il toast e «Annulla» toglie l'impegno e la coda", async ({
    page,
    browser,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await withGoogle(browser, u);
      await u.signIn(page);
      const { form, notice } = await failedSend(page, u);
      const id = await idOf(u);
      await form.getByRole("button", { name: "Chiudi" }).click();
      await expect(moduleOf(page)).toHaveCount(0);
      await expect(notice).toHaveCount(0);
      const toast = toastOf(page, TOAST);
      await expect(toast).toBeVisible();
      await toast.getByRole("button", { name: "Annulla" }).click();
      await expect.poll(() => u.events(NUOTO)).toHaveLength(0);
      expect(await outboxOf(u, id)).toHaveLength(0);
    });
  });
});

test.describe("lettura del calendario non riuscita", () => {
  const EXTERNAL = /\/rest\/v1\/external_calendars(\?|$)/;
  const ACCOUNTS = /\/rest\/v1\/calendar_accounts(\?|$)/;
  const failing = (route: import("@playwright/test").Route) =>
    route.fulfill({ status: 500, json: { message: "boom" } });
  const notice = (page: Page) => page.getByTestId("anche-su-lettura-errore");

  test("CA-23: senza la lettura la riga non c'è, c'è l'avviso con «Riprova» e si salva senza invio", async ({
    page,
    browser,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await withGoogle(browser, u);
      await u.signIn(page);
      await page.route(EXTERNAL, failing);
      const rpc = watchRpc(page);
      const form = await openModule(page);
      // The reading is repeated by the client before it gives up.
      await expect(notice(page)).toBeVisible({ timeout: 30_000 });
      await expect(notice(page)).toHaveAttribute("role", "alert");
      await expect(notice(page)).toContainText(READ_ERROR);
      await expect(
        notice(page).getByRole("button", { name: "Riprova" }),
      ).toBeVisible();
      await expect(rowOf(form)).toHaveCount(0);
      await saveTrial(form, { on: false });
      await expect(toastOf(page, TOAST)).toBeVisible();
      await idOf(u);
      expect(rpc.count("set_event_also_on")).toBe(0);
    });
  });

  test("CA-24: lo stesso avviso se a fallire è la lettura degli account", async ({
    page,
    browser,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await withGoogle(browser, u);
      await u.signIn(page);
      await page.route(ACCOUNTS, failing);
      const form = await openModule(page);
      await expect(notice(page)).toBeVisible({ timeout: 30_000 });
      await expect(notice(page)).toContainText(READ_ERROR);
      await expect(rowOf(form)).toHaveCount(0);
    });
  });

  test("CA-25: tolto il blocco, «Riprova» fa sparire l'avviso e compare la riga spenta, con il fuoco sull'interruttore", async ({
    page,
    browser,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await withGoogle(browser, u);
      await u.signIn(page);
      await page.route(EXTERNAL, failing);
      const form = await openModule(page);
      await expect(notice(page)).toBeVisible({ timeout: 30_000 });
      await page.unroute(EXTERNAL);
      await notice(page).getByRole("button", { name: "Riprova" }).click();
      await expect(notice(page)).toHaveCount(0);
      await expect(switchOf(form)).toHaveAttribute("aria-checked", "false");
      await expect(switchOf(form)).toBeFocused();
    });
  });

  test("CA-26: una nuova lettura che fallisce cancella il calendario letto prima", async ({
    page,
    browser,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await withGoogle(browser, u);
      await u.signIn(page);
      // The people fail first: the reading of the calendar before had worked.
      const people = /\/rest\/v1\/household_members\?.*color/;
      await page.route(people, failing);
      await page.goto("/aggiungi");
      const dialog = addDialog(page);
      const retryPeople = dialog.getByRole("button", {
        name: "Riprova",
        exact: true,
      });
      await expect(retryPeople).toBeVisible({ timeout: 30_000 });
      await page.unroute(people);
      await page.route(EXTERNAL, failing);
      await retryPeople.click();
      await dialog
        .getByRole("textbox", { name: "Cosa vuoi aggiungere?" })
        .pressSequentially(NUOTO);
      await dialog
        .getByRole("button", {
          name: isDesktop(page) ? "Tutti i dettagli" : "Più dettagli",
        })
        .click();
      const form = moduleOf(page);
      await expect(form).toBeVisible();
      await expect(notice(page)).toBeVisible({ timeout: 30_000 });
      await expect(rowOf(form)).toHaveCount(0);
      await expect(form.getByRole("switch")).toHaveCount(0);
    });
  });
});

test.describe("rete e privacy", () => {
  test("CA-27: compilando e accendendo l'interruttore non parte nessuna richiesta ai servizi e nessun indirizzo contiene i dati", async ({
    page,
    browser,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await withGoogle(browser, u);
      await u.signIn(page);
      const urls: string[] = [];
      page.on("request", (request) => urls.push(request.url()));
      const form = await openModule(page);
      const opened = urls.length;
      await fillTrial(form);
      await switchOf(form).click();
      await expect(switchOf(form)).toHaveAttribute("aria-checked", "true");
      const during = urls.slice(opened);
      expect(
        during.filter((url) =>
          /\/(rest|auth|realtime|storage|functions)\/v1\//.test(url),
        ),
      ).toEqual([]);
      for (const url of urls) {
        expect(decodeURIComponent(url).toLowerCase()).not.toMatch(
          /nuoto|piscina|cuffia|personale|u\.finto@example\.test/,
        );
      }
    });
  });

  test("CA-28: Rita senza calendari non ha la riga e le risposte che riceve non nominano Google, Personale né la mail di U", async ({
    page,
    browser,
    baseURL,
  }) => {
    needsFake();
    await withLinkerRita(baseURL, async (u) => {
      await withGoogle(browser, u);
      await u.rita.signInContext(page.context(), baseURL as string);
      const pending: Promise<string>[] = [];
      page.on("response", (response) => {
        const type = response.request().resourceType();
        if (!["document", "fetch", "xhr"].includes(type)) return;
        pending.push(response.text().catch(() => ""));
      });
      const form = await openModule(page);
      await expect(rowOf(form)).toHaveCount(0);
      await expect(form.getByRole("switch")).toHaveCount(0);
      expect(pending.length).toBeGreaterThan(0);
      for (const text of await Promise.all(pending)) {
        expect(text).not.toMatch(/personale|google|u\.finto@example\.test/i);
      }
    });
  });

  test("CA-29: un impegno salvato da Rita con il modulo non arriva al finto di U", async ({
    page,
    browser,
    baseURL,
  }) => {
    needsFake();
    await withLinkerRita(baseURL, async (u) => {
      await withGoogle(browser, u);
      await u.rita.signInContext(page.context(), baseURL as string);
      const form = await openModule(page, "Visita di Rita");
      await fieldOf(form, "Giorno").fill(tomorrow());
      await fieldOf(form, "Dalle").fill("17:00");
      await fieldOf(form, "Alle").fill("18:00");
      await submitOf(form).click();
      await expect(
        toastOf(page, /Messo in .*: Visita di Rita alle 17:00\./),
      ).toBeVisible();
      expect(await u.events("Visita di Rita")).toHaveLength(1);
      await u.fake.outbox();
      const log = await u.fake.log(u.user.id);
      expect(JSON.stringify(log)).not.toContain("Visita di Rita");
    });
  });
});
