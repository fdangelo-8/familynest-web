import type { Page } from "@playwright/test";
import { blockingViolations, createEvent } from "../fixtures/impegni";
import { waitForAnimationsToEnd } from "../fixtures/animations";
import { setClock } from "../fixtures/casa";
import {
  alertWith,
  assign,
  at,
  countRequests,
  day,
  doneButton,
  expect,
  failRequests,
  freeFridayScene,
  holdRequests,
  insertNotification,
  isMobileProject,
  loaded,
  markAllButton,
  memberId,
  notificationRows,
  open,
  openLink,
  PATH,
  pageText,
  reload,
  REST_NOTIFICATIONS,
  REST_TODOS,
  RPC_MARK_READ,
  rowOf,
  rows,
  settle,
  test,
  toast,
  userOf,
  type CasaNest,
} from "../fixtures/notifiche";

// Notifiche (#39), actions, isolation, accessibility:
// CA-33 ... CA-39, CA-50 ... CA-55, CA-57 and CA-58.
// The notification of CA-9 is «Paolo ti ha assegnato Firmare autorizzazione
// gita, entro venerdì» (made by the trigger of the database, then moved to
// 9:15 of T). The clock of the browser is on T, the most recent Tuesday.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

const FIRMARE = "Firmare autorizzazione gita";

/** The notification of CA-9 for Giulia. Returns the id of the thing to do. */
function ca9(nest: CasaNest): Promise<string> {
  return assign(nest, FIRMARE, { due: day(3), when: at(0, "09:15") });
}

async function todoOf(nest: CasaNest, id: string) {
  const found = (await nest.todoRows()).find((row) => row.id === id);
  if (!found) throw new Error("Cosa da fare di prova non trovata");
  return found;
}

const sectionOfToday = (page: Page) =>
  page.locator(`section[data-sezione="${day(0)}"]`);

test.describe("«Fatto» e «Apri»", () => {
  test("CA-33: «Fatto» segna il da fare, «Apri» prende il fuoco e compare il toast con «Annulla»", async ({
    page,
    baseURL,
    nest,
  }) => {
    const todo = await ca9(nest);
    await open(page, baseURL, nest, "Giulia");

    const row = rowOf(page, FIRMARE);
    await doneButton(row).click();

    await expect(doneButton(row)).toHaveCount(0);
    await expect(openLink(row)).toBeFocused();
    await expect(toast(page)).toContainText(`Fatto: ${FIRMARE}`);
    await expect(
      toast(page).getByRole("button", { name: "Annulla" }),
    ).toBeVisible();
    const saved = await todoOf(nest, todo);
    expect(saved.done_at).not.toBeNull();
    expect(saved.done_by_member_id).toBe(memberId(nest, "Giulia"));

    await reload(page, { paused: true });
    await expect(openLink(rowOf(page, FIRMARE))).toBeVisible();
    await expect(doneButton(rowOf(page, FIRMARE))).toHaveCount(0);
  });

  test("CA-34 (errore): se l'aggiornamento non riesce «Fatto» resta col fuoco e sotto la sezione c'è l'avviso", async ({
    page,
    baseURL,
    nest,
  }) => {
    const todo = await ca9(nest);
    await open(page, baseURL, nest, "Giulia");

    const row = rowOf(page, FIRMARE);
    const section = sectionOfToday(page);
    const restore = await failRequests(page, REST_TODOS, "PATCH", "server");
    await doneButton(row).click();

    const server = `Non siamo riusciti a segnare come fatto «${FIRMARE}» per un problema nostro. Riprova tra qualche minuto.`;
    await expect(section.getByRole("alert")).toHaveText(server);
    await expect(doneButton(row)).toBeVisible();
    await expect(doneButton(row)).toBeFocused();
    expect((await todoOf(nest, todo)).done_at).toBeNull();

    await restore();
    await failRequests(page, REST_TODOS, "PATCH", "network");
    await doneButton(row).click();
    const network = `Non siamo riusciti a segnare come fatto «${FIRMARE}». Controlla la connessione e riprova.`;
    // Never two notices in the same section: the new one takes the place of the old.
    await expect(section.getByRole("alert")).toHaveText(network);
    await expect(doneButton(row)).toBeFocused();
    expect((await todoOf(nest, todo)).done_at).toBeNull();
  });

  test("CA-35: se il da fare è già fatto la riga ha «Apri» e non «Fatto»", async ({
    page,
    baseURL,
    nest,
  }) => {
    const todo = await ca9(nest);
    const { error } = await userOf(nest, "Paolo")
      .client.from("todos")
      .update({ done_at: new Date().toISOString() })
      .eq("id", todo);
    expect(error).toBeNull();
    await open(page, baseURL, nest, "Giulia");

    const row = rowOf(page, FIRMARE);
    await expect(row).toHaveCount(1);
    await expect(openLink(row)).toBeVisible();
    await expect(doneButton(row)).toHaveCount(0);
  });

  test("CA-36: «Apri» di un da fare porta a /casa/da-fare", async ({
    page,
    baseURL,
    nest,
  }) => {
    await ca9(nest);
    await open(page, baseURL, nest, "Giulia", { pause: false });

    await openLink(rowOf(page, FIRMARE)).click();
    await expect(page).toHaveURL(/\/casa\/da-fare$/);
  });

  test("CA-50: «Annulla» rimette il da fare da fare, «Fatto» torna col fuoco e non c'è un secondo toast", async ({
    page,
    baseURL,
    nest,
  }) => {
    const todo = await ca9(nest);
    await open(page, baseURL, nest, "Giulia");

    const row = rowOf(page, FIRMARE);
    await doneButton(row).click();
    await expect(toast(page)).toContainText(`Fatto: ${FIRMARE}`);
    await toast(page).getByRole("button", { name: "Annulla" }).click();

    await expect(doneButton(row)).toBeVisible();
    await expect(doneButton(row)).toBeFocused();
    await expect(toast(page)).toHaveCount(0);
    await expect
      .poll(async () => (await todoOf(nest, todo)).done_at)
      .toBeNull();
  });

  test("CA-51: due tocchi di fila su «Fatto» mandano una sola richiesta, e «Fatto» è occupato finché non risponde", async ({
    page,
    baseURL,
    nest,
  }) => {
    await ca9(nest);
    await open(page, baseURL, nest, "Giulia");

    const row = rowOf(page, FIRMARE);
    const requests = countRequests(page, REST_TODOS, "PATCH");
    const release = await holdRequests(page, REST_TODOS, "PATCH");
    const button = doneButton(row);
    await button.click();
    await expect(button).toHaveAttribute("aria-busy", "true");
    // The second tap: the button is busy, so Playwright would wait; tap anyway.
    await button.click({ force: true });
    await settle(page);
    expect(requests()).toBe(1);
    await expect(button).toHaveAttribute("aria-busy", "true");

    release();
    await expect(doneButton(row)).toHaveCount(0);
    expect(requests()).toBe(1);
  });

  test("CA-52 (già fatto): se Paolo l'ha già fatto dopo l'apertura il toast lo dice, senza «Annulla», e il database non cambia", async ({
    page,
    baseURL,
    nest,
  }) => {
    const todo = await ca9(nest);
    await open(page, baseURL, nest, "Giulia");

    const done = await userOf(nest, "Paolo")
      .client.from("todos")
      .update({ done_at: new Date().toISOString() })
      .eq("id", todo);
    expect(done.error).toBeNull();
    const row = rowOf(page, FIRMARE);
    await doneButton(row).click();

    await expect(doneButton(row)).toHaveCount(0);
    await expect(toast(page)).toContainText(`${FIRMARE} era già fatto.`);
    await expect(
      toast(page).getByRole("button", { name: "Annulla" }),
    ).toHaveCount(0);
    expect((await todoOf(nest, todo)).done_by_member_id).toBe(
      memberId(nest, "Paolo"),
    );
  });

  test("CA-53 (non c'è più): se Paolo l'ha cancellato la riga resta senza bottoni e l'avviso prende il fuoco", async ({
    page,
    baseURL,
    nest,
  }) => {
    const todo = await ca9(nest);
    await open(page, baseURL, nest, "Giulia");

    const removed = await userOf(nest, "Paolo")
      .client.from("todos")
      .delete()
      .eq("id", todo);
    expect(removed.error).toBeNull();
    const row = rowOf(page, FIRMARE);
    await doneButton(row).click();

    const gone = alertWith(
      page,
      "Questa cosa da fare non c'è più. Forse l'ha eliminata chi l'aveva creata.",
    );
    await expect(gone).toBeVisible();
    await expect(gone).toBeFocused();
    await expect(row).toHaveCount(1);
    await expect(doneButton(row)).toHaveCount(0);
    await expect(openLink(row)).toHaveCount(0);
  });
});

test.describe("«Segna tutte come lette» e rete", () => {
  test("CA-54 (disabilitato): se sono tutte già lette il bottone è disabilitato e un clic non manda richieste", async ({
    page,
    baseURL,
    nest,
  }) => {
    test.skip(isMobileProject(), "Il bottone c'è solo a 1280 px");
    for (const [title, time] of [
      ["Cosa uno", "09:00"],
      ["Cosa due", "10:00"],
    ] as const) {
      await assign(nest, title, {
        when: at(0, time),
        readAt: at(0, "11:00"),
      });
    }
    const marks = countRequests(page, RPC_MARK_READ, "POST");
    await open(page, baseURL, nest, "Giulia");

    await expect(rows(page)).toHaveCount(2);
    await expect(markAllButton(page)).toBeDisabled();
    await markAllButton(page).click({ force: true });
    await settle(page);
    expect(marks()).toBe(0);
  });

  test("CA-55 (offline): senza rete compare l'avviso, «Fatto» e «Segna tutte» sono inattivi, «Apri» resta un link; tornata la rete tutto riparte", async ({
    page,
    baseURL,
    nest,
  }) => {
    await ca9(nest);
    await open(page, baseURL, nest, "Giulia", { time: at(0, "15:40") });
    const patches = countRequests(page, REST_TODOS, "PATCH");
    const marks = countRequests(page, RPC_MARK_READ, "POST");
    const row = rowOf(page, FIRMARE);

    await page.context().setOffline(true);
    const notice = page.getByRole("status").filter({ hasText: "Sei offline" });
    await expect(notice).toContainText(
      "Sei offline: vedi le notifiche arrivate fino alle 15:40.",
    );
    await expect(notice.getByRole("button", { name: "Riprova" })).toBeVisible();
    await expect(rows(page)).toHaveCount(1);
    await expect(doneButton(row)).toHaveAttribute("aria-disabled", "true");
    await doneButton(row).click({ force: true });
    if (!isMobileProject()) {
      await expect(markAllButton(page)).toHaveAttribute(
        "aria-disabled",
        "true",
      );
      await markAllButton(page).click({ force: true });
    }
    await settle(page);
    expect(patches()).toBe(0);
    expect(marks()).toBe(0);
    await expect(openLink(row)).toHaveAttribute("href", "/casa/da-fare");

    await page.context().setOffline(false);
    await expect(notice).toHaveCount(0);
    await expect(doneButton(row)).not.toHaveAttribute("aria-disabled");
  });

  test("CA-57: una notifica nata dopo l'apertura non compare da sola, ma ricaricando sì", async ({
    page,
    baseURL,
    nest,
  }) => {
    await assign(nest, "Chiamare il dentista", { when: at(0, "09:00") });
    await open(page, baseURL, nest, "Giulia");
    await expect(rows(page)).toHaveCount(1);

    await assign(nest, "Ritirare il pacco", { when: at(0, "10:00") });
    expect(await notificationRows(nest, "Giulia")).toHaveLength(2);
    // A minute goes by in the page: nothing is read again by itself.
    await page.clock.runFor(60_000);
    await settle(page);
    await expect(rows(page)).toHaveCount(1);
    await expect(rowOf(page, "Ritirare il pacco")).toHaveCount(0);

    await reload(page, { paused: true });
    await expect(rows(page)).toHaveCount(2);
    await expect(rowOf(page, "Ritirare il pacco")).toHaveCount(1);
  });
});

test.describe("isolamento", () => {
  test("CA-37 (isolamento nel Nest): Paolo non vede la notifica di Giulia, né la legge né la segna letta", async ({
    page,
    baseURL,
    nest,
  }) => {
    await ca9(nest);
    const [theirs] = await notificationRows(nest, "Giulia");
    expect(theirs).toBeDefined();
    expect(theirs?.read_at).toBeNull();

    await open(page, baseURL, nest, "Paolo");
    await expect(page.getByText("Tutto tranquillo")).toBeVisible();
    await expect(rows(page)).toHaveCount(0);
    expect(await pageText(page)).not.toContain(FIRMARE);

    const client = userOf(nest, "Paolo").client;
    const read = await client.from("notifications").select("id");
    expect(read.error).toBeNull();
    expect(read.data).toEqual([]);
    await client.rpc("mark_notifications_read", { p_ids: [theirs?.id] });
    const after = await notificationRows(nest, "Giulia");
    expect(after).toHaveLength(1);
    expect(after[0]?.read_at).toBeNull();
  });

  test("CA-38 (isolamento tra Nest): Giulia non riceve nessuna riga di Casa D'Angelo e la pagina non nomina Marco né Laura", async ({
    page,
    baseURL,
    nest,
    dangelo,
  }) => {
    const bolletta = await dangelo.todo("Marco", {
      title: "Pagare la bolletta",
      assignee: "Marco",
    });
    const foreign = await insertNotification(dangelo, {
      recipient: "Marco",
      kind: "todo_assigned",
      actorId: memberId(dangelo, "Laura"),
      todoId: bolletta,
    });
    await ca9(nest);

    await open(page, baseURL, nest, "Giulia");
    await expect(rows(page)).toHaveCount(1);
    const text = await pageText(page);
    for (const name of ["Marco", "Laura", "Pagare la bolletta"]) {
      expect(text).not.toContain(name);
    }

    const read = await userOf(nest, "Giulia")
      .client.from("notifications")
      .select("id, household_id");
    expect(read.error).toBeNull();
    const found = (read.data ?? []) as { id: string; household_id: string }[];
    expect(found).toHaveLength(1);
    expect(found.every((item) => item.household_id === nest.householdId)).toBe(
      true,
    );
    expect(found.some((item) => item.id === foreign)).toBe(false);
  });

  test("CA-39: senza sessione /notifiche porta all'accesso; con la sessione non si scrivono né si cambiano notifiche", async ({
    page,
    nest,
  }) => {
    await page.goto(PATH);
    await expect(page).toHaveURL(/\/accesso(\?|$)/);

    const todo = await ca9(nest);
    const before = await notificationRows(nest);
    const [mine] = before;
    expect(mine).toBeDefined();
    const client = userOf(nest, "Giulia").client;

    const inserted = await client.from("notifications").insert({
      household_id: nest.householdId,
      recipient_member_id: memberId(nest, "Giulia"),
      kind: "todo_assigned",
      actor_member_id: memberId(nest, "Paolo"),
      todo_id: todo,
    });
    expect(inserted.error).not.toBeNull();
    for (const change of [
      { recipient_member_id: memberId(nest, "Paolo") },
      { kind: "shopping_added" },
      { todo_id: null },
      { read_at: new Date().toISOString() },
    ]) {
      const changed = await client
        .from("notifications")
        .update(change)
        .eq("id", mine?.id);
      expect(changed.error).not.toBeNull();
    }
    const removed = await client
      .from("notifications")
      .delete()
      .eq("id", mine?.id);
    expect(removed.error).not.toBeNull();

    expect(await notificationRows(nest)).toEqual(before);
  });
});

test.describe("accessibilità", () => {
  // axe uses timers of its own: the clock of the page must be running.
  const noBlocking = async (page: Page) => {
    await waitForAnimationsToEnd(page);
    expect(await blockingViolations(page)).toEqual([]);
  };

  test("CA-58: stato normale (con sintesi, «Da fare assegnato» e «Liberi insieme») senza violazioni serious o critical", async ({
    page,
    baseURL,
    nest,
  }) => {
    await freeFridayScene(nest);
    await ca9(nest);
    await createEvent(nest, "Paolo", {
      title: "Call con Acme",
      day: day(0),
      from: "16:00",
      to: "17:00",
      members: ["Giulia"],
    });
    await open(page, baseURL, nest, "Giulia", { pause: false });

    await expect(page.getByTestId("sintesi")).toBeVisible();
    await expect(rows(page)).toHaveCount(2);
    await noBlocking(page);
  });

  test("CA-58: stato vuoto senza violazioni serious o critical", async ({
    page,
    baseURL,
    solo,
  }) => {
    await open(page, baseURL, solo, "Rita", { pause: false });

    await expect(page.getByText("Tutto tranquillo")).toBeVisible();
    await noBlocking(page);
  });

  test("CA-58: stato di caricamento senza violazioni serious o critical", async ({
    page,
    baseURL,
    nest,
  }) => {
    await ca9(nest);
    await setClock(page, at(0, "12:00"));
    await nest.signIn(page, baseURL, "Giulia");
    const release = await holdRequests(page, REST_NOTIFICATIONS, "GET");
    await page.goto(PATH);

    await expect(
      page.locator('[aria-busy="true"][aria-live="polite"]').first(),
    ).toBeVisible();
    await noBlocking(page);
    release();
    await loaded(page);
  });

  test("CA-58: errore di pagina senza violazioni serious o critical", async ({
    page,
    baseURL,
    nest,
  }) => {
    await ca9(nest);
    await setClock(page, at(0, "12:00"));
    await nest.signIn(page, baseURL, "Giulia");
    await failRequests(page, REST_NOTIFICATIONS, "GET", "server");
    await page.goto(PATH);
    await loaded(page);

    await expect(
      page.getByText("Questa pagina non si è caricata"),
    ).toBeVisible();
    await noBlocking(page);
  });

  test("CA-58: stato offline senza violazioni serious o critical", async ({
    page,
    baseURL,
    nest,
  }) => {
    await ca9(nest);
    await open(page, baseURL, nest, "Giulia", {
      time: at(0, "15:40"),
      pause: false,
    });

    await page.context().setOffline(true);
    await expect(
      page.getByRole("status").filter({ hasText: "Sei offline" }),
    ).toBeVisible();
    await noBlocking(page);
    await page.context().setOffline(false);
  });
});
