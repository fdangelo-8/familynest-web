import { type Page } from "@playwright/test";
import { expect, test, type CasaNest } from "../fixtures/casa";
import {
  GONE_ALERT,
  PRIVATE,
  SHARED,
  confirmOf,
  deadlinesOf,
  deleteRow,
  editUrl,
  expectGone,
  expectCard,
  goneMessage,
  holdRequests,
  labelText,
  openCasaPage,
  openDirect,
  openEditFromRow,
  pauseClock,
  recordNetwork,
  refuseWrites,
  seedDeadline,
  sheet,
  todoGroup,
  todoRow,
  todosOf,
  toastOf,
  toastWith,
  waitForSheet,
  writesOf,
} from "../fixtures/aggiungi-casa";
import { waitForAnimationsToEnd } from "../fixtures/animations";

// Aggiungi · modifica ed eliminazione di una cosa da fare o di una scadenza
// (#22): CA-35 ... CA-45, CA-59 ... CA-64, CA-67 ... CA-72. The browser clock is
// fixed at Tuesday 20 October 2026, 15:52 in Rome ([OR]). Every test builds its
// own throwaway Nests and creates its own rows with the session of a member
// (RLS applies). The edit sheet opens from the title of a row of Casa · Da fare
// (button «Modifica: <titolo>») or from `/aggiungi?modifica=<id>`.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

const GITA = "Firmare autorizzazione gita";
const PALESTRA = "Prenotare la palestra";
const BOLLO = "Bollo auto";

/** CA-35 data: for Sofia, Marco takes care of it, by 2026-10-23, shared. */
async function seedGita(casa: CasaNest) {
  return casa.todo("Marco", {
    title: GITA,
    forMember: "Sofia",
    assignee: "Marco",
    due: "2026-10-23",
  });
}

/** CA-36: the change of CA-36 made in the edit sheet (Laura, «entro lunedì»). */
async function giveToLauraMonday(page: Page) {
  const s = sheet(page, "edit");
  await s.person("Laura").click();
  await s.field.focus();
  await s.field.press("Control+End");
  await s.field.pressSequentially(" entro lunedì");
  await s.button("Salva").click();
}

// ------------------------------------------------------------------ Apertura

test.describe("Aggiungi · modifica · Da fare", () => {
  test("CA-35: il titolo di una riga apre il foglio «Modifica» con i valori salvati", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seedGita(casa);
    await openEditFromRow(page, baseURL, casa, "Marco", GITA);

    const s = sheet(page, "edit");
    await expect(
      s.dialog.getByRole("heading", { name: "Modifica" }),
    ).toBeVisible();
    await expect(s.types).toHaveCount(0);
    await expect(s.field).toHaveValue(GITA);
    await expect(labelText(page, "Entro venerdì")).toBeVisible();
    await expect(labelText(page, "Per Sofia")).toBeVisible();
    await expect(s.person("Tu")).toHaveAttribute("aria-pressed", "true");
    await expect(s.button("Salva")).toBeVisible();
  });

  test("CA-36: scegliere «Laura» e aggiungere «entro lunedì» salva, mostra «Modifiche salvate.» con «Annulla» e aggiorna la riga", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seedGita(casa);
    await openEditFromRow(page, baseURL, casa, "Marco", GITA);
    await giveToLauraMonday(page);

    await expect(sheet(page, "edit").dialog).toHaveCount(0);
    const toast = toastWith(page, "Modifiche salvate.");
    await expect(toast).toBeVisible();
    await expect(toast.getByRole("button", { name: "Annulla" })).toBeVisible();

    const row = todoRow(page, GITA);
    await expect(row.locator(".avatar")).toHaveText("L");
    await expect(row.locator(".riga-lista__info")).toContainText(
      "Per Sofia, entro 26 ottobre",
    );
  });

  test("CA-37: «Togli la data» e «Togli Per Sofia» salvano la cosa senza data e senza «per chi è»", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seedGita(casa);
    await openEditFromRow(page, baseURL, casa, "Marco", GITA);
    const s = sheet(page, "edit");
    await s.button("Togli la data").click();
    await s.button("Togli Per Sofia").click();
    await s.button("Salva").click();

    await expect(toastWith(page, "Modifiche salvate.")).toBeVisible();
    await expect
      .poll(async () => {
        const [row] = await todosOf(casa, "Marco");
        return [row?.due_date ?? null, row?.for_member_id ?? null];
      })
      .toEqual([null, null]);
  });

  test("CA-38: Giulia elimina dal foglio la cosa condivisa di Paolo: dialogo, toast senza «Annulla», sparita per tutti", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await bianchi.todo("Paolo", { title: PALESTRA });
    const [row] = await todosOf(bianchi, "Paolo");
    await openDirect(page, baseURL, bianchi, "Giulia", editUrl(row!.id), {
      mode: "edit",
    });
    const s = sheet(page, "edit");
    await s.button("Elimina cosa da fare").click();

    const confirm = confirmOf(page, PALESTRA);
    await expect(confirm).toBeVisible();
    await waitForAnimationsToEnd(page);
    await expect(confirm).toHaveAccessibleDescription(
      "Sparisce dalla lista di tutto il Nest.",
    );
    await confirm.getByRole("button", { name: "Elimina cosa da fare" }).click();

    await expect(confirm).toHaveCount(0);
    await expect(s.dialog).toHaveCount(0);
    const toast = toastWith(page, `Eliminato: ${PALESTRA}.`);
    await expect(toast).toBeVisible();
    await expect(toast.getByRole("button", { name: "Annulla" })).toHaveCount(0);
    expect(await todosOf(bianchi, "Giulia")).toHaveLength(0);
    expect(await todosOf(bianchi, "Paolo")).toHaveLength(0);
  });

  test("CA-39: «Annulla» nel dialogo chiude solo il dialogo: il foglio resta, il fuoco è su «Elimina cosa da fare», la cosa esiste", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seedGita(casa);
    await openEditFromRow(page, baseURL, casa, "Marco", GITA);
    const s = sheet(page, "edit");
    await s.button("Elimina cosa da fare").click();

    const confirm = confirmOf(page, GITA);
    await expect(confirm).toBeVisible();
    await waitForAnimationsToEnd(page);
    await confirm.getByRole("button", { name: "Annulla" }).click();

    await expect(confirm).toHaveCount(0);
    await expect(s.dialog).toBeVisible();
    await expect(s.button("Elimina cosa da fare")).toBeFocused();
    expect(await todosOf(casa, "Marco")).toHaveLength(1);
  });

  test("CA-40: il bottone della visibilità c'è solo per chi ha creato la cosa; per gli altri c'è l'etichetta fissa", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await bianchi.todo("Paolo", { title: PALESTRA });
    await bianchi.todo("Giulia", { title: "Ritirare il pacco" });
    const rows = await todosOf(bianchi, "Giulia");
    const byPaolo = rows.find((row) => row.title === PALESTRA)!;
    const byGiulia = rows.find((row) => row.title === "Ritirare il pacco")!;

    await openDirect(page, baseURL, bianchi, "Giulia", editUrl(byPaolo.id), {
      mode: "edit",
    });
    const s = sheet(page, "edit");
    await expect(s.visibility).toHaveCount(0);
    await expect(labelText(page, SHARED)).toBeVisible();

    await page.goto(editUrl(byGiulia.id));
    await waitForSheet(page, "edit");
    await expect(s.field).toHaveValue("Ritirare il pacco");
    await expect(s.visibility).toHaveAccessibleName(SHARED);
  });

  test("CA-43: se Paolo elimina la cosa mentre Giulia ha il foglio aperto, «Salva» dà «non c'è più» e non crea niente", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await bianchi.todo("Paolo", { title: PALESTRA });
    const [row] = await todosOf(bianchi, "Paolo");
    await openDirect(page, baseURL, bianchi, "Giulia", editUrl(row!.id), {
      mode: "edit",
    });
    const s = sheet(page, "edit");

    await deleteRow(bianchi, "Paolo", "todos", row!.id);
    // A change, so that «Salva» really writes (CA-64: with no change it only closes).
    await s.field.focus();
    await s.field.press("Control+End");
    await s.field.pressSequentially(" domani");
    await s.button("Salva").click();

    await expect(
      s.dialog.getByRole("alert").filter({ hasText: GONE_ALERT }),
    ).toBeVisible();
    expect(await todosOf(bianchi, "Paolo")).toHaveLength(0);
    expect(await todosOf(bianchi, "Giulia")).toHaveLength(0);
  });

  test("CA-64: «Salva» senza cambiare niente chiude il foglio, senza toast e senza scrivere", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seedGita(casa);
    const [before] = await todosOf(casa, "Marco");
    await openEditFromRow(page, baseURL, casa, "Marco", GITA);
    const net = recordNetwork(page);
    const s = sheet(page, "edit");
    await s.button("Salva").click();

    await expect(s.dialog).toHaveCount(0);
    await expect(toastOf(page)).toHaveCount(0);
    expect(writesOf(net)).toEqual([]);
    const [after] = await todosOf(casa, "Marco");
    expect(after!.updated_at).toBe(before!.updated_at);
  });
});

// --------------------------------------------------------- Annulla dopo Salva

test.describe("Aggiungi · modifica · «Annulla» dopo «Salva»", () => {
  test("CA-59: «Annulla» dopo la modifica di CA-36 rimette i valori di prima e la riga torna nel suo gruppo", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seedGita(casa);
    await openEditFromRow(page, baseURL, casa, "Marco", GITA);
    await expect(todoGroup(page, "Questa settimana")).toContainText(GITA);
    await giveToLauraMonday(page);
    const toast = toastWith(page, "Modifiche salvate.");
    await expect(toast).toBeVisible();
    await expect(todoGroup(page, "Più avanti")).toContainText(GITA);

    await pauseClock(page);
    await toast.getByRole("button", { name: "Annulla" }).click();
    await expect(toastOf(page)).toHaveCount(0);

    await expect
      .poll(async () => {
        const [row] = await todosOf(casa, "Marco");
        return row
          ? [
              row.assignee_member_id === casa.members["Marco"],
              row.due_date,
              row.for_member_id === casa.members["Sofia"],
              row.is_private,
            ]
          : null;
      })
      .toEqual([true, "2026-10-23", true, false]);
    await expect(todoGroup(page, "Questa settimana")).toContainText(GITA);
    await expect(toastOf(page)).toHaveCount(0);
  });

  test("CA-60: «Annulla» dopo la modifica di una scadenza rimette data, avvisi e visibilità di prima", async ({
    page,
    baseURL,
    casa,
  }) => {
    const id = await seedDeadline(casa, "Marco", {
      title: BOLLO,
      due: "2026-12-07",
      reminders: [30, 7, 1],
      assignee: "Marco",
    });
    await openDirect(page, baseURL, casa, "Marco", editUrl(id), {
      mode: "edit",
    });
    const s = sheet(page, "edit");
    await s.visibility.click();
    await expect(s.visibility).toHaveAccessibleName(PRIVATE);
    await s.reminder("7 giorni").click();
    await s.field.fill("Bollo auto scade il 9 dicembre");
    await s.button("Salva").click();

    const toast = toastWith(page, "Modifiche salvate.");
    await expect(toast).toBeVisible();
    await expect
      .poll(async () => (await deadlinesOf(casa, "Marco"))[0]?.due_date)
      .toBe("2026-12-09");

    await pauseClock(page);
    await toast.getByRole("button", { name: "Annulla" }).click();
    await expect
      .poll(async () => {
        const [row] = await deadlinesOf(casa, "Marco");
        return row
          ? [
              row.due_date,
              [...row.reminder_days].sort((a, b) => b - a),
              row.is_private,
            ]
          : null;
      })
      .toEqual(["2026-12-07", [30, 7, 1], false]);
  });

  test("CA-61: «Annulla» dopo aver reso condivisa una cosa «Solo io» la rende di nuovo privata", async ({
    page,
    baseURL,
    casa,
  }) => {
    await casa.todo("Marco", {
      title: GITA,
      assignee: "Marco",
      priv: true,
    });
    const [row] = await todosOf(casa, "Marco");
    await openDirect(page, baseURL, casa, "Marco", editUrl(row!.id), {
      mode: "edit",
    });
    const s = sheet(page, "edit");
    await expect(s.visibility).toHaveAccessibleName(PRIVATE);
    await s.visibility.click();
    await expect(s.visibility).toHaveAccessibleName(SHARED);
    await s.button("Salva").click();

    const toast = toastWith(page, "Modifiche salvate.");
    await expect(toast).toBeVisible();
    await expect
      .poll(async () => (await todosOf(casa, "Marco"))[0]?.is_private)
      .toBe(false);

    await pauseClock(page);
    await toast.getByRole("button", { name: "Annulla" }).click();
    await expect
      .poll(async () => (await todosOf(casa, "Marco"))[0]?.is_private)
      .toBe(true);
  });

  test("CA-62: se «Annulla» è rifiutato compare il toast senza icona e le modifiche restano", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seedGita(casa);
    await openEditFromRow(page, baseURL, casa, "Marco", GITA);
    await giveToLauraMonday(page);
    const toast = toastWith(page, "Modifiche salvate.");
    await expect(toast).toBeVisible();
    await expect
      .poll(async () => (await todosOf(casa, "Marco"))[0]?.due_date)
      .toBe("2026-10-26");

    await pauseClock(page);
    await refuseWrites(page, "todos", "PATCH");
    await toast.getByRole("button", { name: "Annulla" }).click();

    const failed = toastWith(
      page,
      "Non siamo riusciti ad annullare. Le modifiche sono rimaste.",
    );
    await expect(failed).toBeVisible();
    await expect(failed.getByRole("button", { name: "Annulla" })).toHaveCount(
      0,
    );
    await expect(failed.locator("svg")).toHaveCount(0);
    const [row] = await todosOf(casa, "Marco");
    expect(row).toMatchObject({
      assignee_member_id: casa.members["Laura"],
      due_date: "2026-10-26",
    });
  });

  test("CA-63: se la cosa è stata eliminata da un'altra sessione, «Annulla» dà «questa cosa non c'è più» e non crea niente", async ({
    page,
    baseURL,
    casa,
  }) => {
    const id = await seedGita(casa);
    await openEditFromRow(page, baseURL, casa, "Marco", GITA);
    await giveToLauraMonday(page);
    const toast = toastWith(page, "Modifiche salvate.");
    await expect(toast).toBeVisible();

    await pauseClock(page);
    await deleteRow(casa, "Marco", "todos", id);
    await toast.getByRole("button", { name: "Annulla" }).click();

    const gone = toastWith(
      page,
      "Non siamo riusciti ad annullare: questa cosa non c'è più.",
    );
    await expect(gone).toBeVisible();
    await expect(gone.getByRole("button", { name: "Annulla" })).toHaveCount(0);
    await expect(gone.locator("svg")).toHaveCount(0);
    expect(await todosOf(casa, "Marco")).toHaveLength(0);
  });
});

// ---------------------------------------------------------- Scadenze in modifica

test.describe("Aggiungi · modifica · Scadenza", () => {
  test("CA-41: il foglio di modifica della scadenza mostra i valori salvati e salvare cambia data e titolo", async ({
    page,
    baseURL,
    casa,
  }) => {
    const id = await seedDeadline(casa, "Marco", {
      title: BOLLO,
      due: "2026-12-07",
      reminders: [30, 7, 1],
      assignee: "Marco",
    });
    await openDirect(page, baseURL, casa, "Marco", editUrl(id), {
      mode: "edit",
    });
    const s = sheet(page, "edit");
    await expect(
      s.dialog.getByRole("heading", { name: "Modifica" }),
    ).toBeVisible();
    await expectCard(page, { number: "48", unit: "giorni" });
    await expect(s.field).toHaveValue(BOLLO);
    for (const name of ["30 giorni prima", "7 giorni", "1 giorno"]) {
      await expect(s.reminder(name)).toHaveAttribute("aria-pressed", "true");
    }

    await s.field.fill("Bollo auto scade il 9 dicembre");
    await s.button("Salva").click();
    await expect(toastWith(page, "Modifiche salvate.")).toBeVisible();
    await expect
      .poll(async () => {
        const [row] = await deadlinesOf(casa, "Marco");
        return [row?.due_date, row?.title];
      })
      .toEqual(["2026-12-09", BOLLO]);
  });

  test("CA-42: «Elimina scadenza» chiede conferma con il testo giusto, poi toglie la scadenza e mostra «Eliminato: Bollo auto.»", async ({
    page,
    baseURL,
    casa,
  }) => {
    const id = await seedDeadline(casa, "Marco", {
      title: BOLLO,
      due: "2026-12-07",
      assignee: "Marco",
    });
    await openDirect(page, baseURL, casa, "Marco", editUrl(id), {
      mode: "edit",
    });
    const s = sheet(page, "edit");
    await s.button("Elimina scadenza").click();

    const confirm = confirmOf(page, BOLLO);
    await expect(confirm).toBeVisible();
    await waitForAnimationsToEnd(page);
    await expect(confirm).toHaveAccessibleDescription(
      "Sparisce dalle scadenze di tutto il Nest e non arriveranno più avvisi.",
    );
    await confirm.getByRole("button", { name: "Elimina scadenza" }).click();

    await expect(s.dialog).toHaveCount(0);
    await expect(toastWith(page, `Eliminato: ${BOLLO}.`)).toBeVisible();
    expect(await deadlinesOf(casa, "Marco")).toHaveLength(0);
  });

  test("CA-67: per una scadenza condivisa di Paolo Giulia vede l'etichetta fissa; Paolo con la sua «Solo io» vede il dialogo «tue scadenze»", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    const shared = await seedDeadline(bianchi, "Paolo", {
      title: BOLLO,
      due: "2026-12-07",
    });
    const mine = await seedDeadline(bianchi, "Paolo", {
      title: "Assicurazione della casa",
      due: "2027-01-20",
      assignee: "Paolo",
      priv: true,
    });

    await openDirect(page, baseURL, bianchi, "Giulia", editUrl(shared), {
      mode: "edit",
    });
    const s = sheet(page, "edit");
    await expect(s.visibility).toHaveCount(0);
    await expect(labelText(page, SHARED)).toBeVisible();

    // Same browser, Paolo's session now.
    await bianchi.signIn(page, baseURL, "Paolo");
    await page.goto(editUrl(mine));
    await waitForSheet(page, "edit");
    await expect(s.visibility).toHaveAccessibleName(PRIVATE);
    await s.button("Elimina scadenza").click();
    const confirm = confirmOf(page, "Assicurazione della casa");
    await expect(confirm).toBeVisible();
    await waitForAnimationsToEnd(page);
    await expect(confirm).toHaveAccessibleDescription(
      "Sparisce dalle tue scadenze e non riceverai più avvisi.",
    );
    await confirm.getByRole("button", { name: "Annulla" }).click();
    expect(await deadlinesOf(bianchi, "Paolo")).toHaveLength(2);
  });
});

// -------------------------------------------------------- Isolamento tra Nest

test.describe("Aggiungi · modifica · isolamento tra Nest", () => {
  test("CA-44: Marco apre l'indirizzo di modifica di una cosa e di una scadenza di Casa Bianchi e vede «non c'è più»", async ({
    page,
    baseURL,
    casa,
    bianchi,
  }) => {
    await bianchi.todo("Giulia", { title: "Prenotare il campeggio" });
    const [todo] = await todosOf(bianchi, "Giulia");
    const deadline = await seedDeadline(bianchi, "Giulia", {
      title: "Assicurazione del camper",
      due: "2026-12-15",
    });

    await openDirect(page, baseURL, casa, "Marco", editUrl(todo!.id), {
      mode: "edit",
      ready: goneMessage,
    });
    await expectGone(page);
    await expect(page.getByText("Prenotare il campeggio")).toHaveCount(0);

    await page.goto(editUrl(deadline));
    await expect(goneMessage(page)).toBeVisible({ timeout: 20_000 });
    await expectGone(page);
    await expect(page.getByText("Assicurazione del camper")).toHaveCount(0);
  });

  test("CA-45: la «Solo io» di Paolo, aperta da Giulia, dà lo stesso messaggio «non c'è più»", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await bianchi.todo("Paolo", {
      title: "Prenotare il medico di famiglia",
      assignee: "Paolo",
      priv: true,
    });
    const [todo] = await todosOf(bianchi, "Paolo");
    await openDirect(page, baseURL, bianchi, "Giulia", editUrl(todo!.id), {
      mode: "edit",
      ready: goneMessage,
    });
    await expectGone(page);
    await expect(page.getByText("Prenotare il medico di famiglia")).toHaveCount(
      0,
    );
  });

  test("CA-46: con la sua sessione Marco non legge, non crea, non modifica e non elimina le scadenze di Casa Bianchi", async ({
    casa,
    bianchi,
  }) => {
    const id = await seedDeadline(bianchi, "Giulia", {
      title: BOLLO,
      due: "2026-12-07",
    });
    const marco = casa.users["Marco"]!.client;

    const read = await marco.from("deadlines").select("id");
    expect(read.error).toBeNull();
    expect(read.data ?? []).toHaveLength(0);

    const created = await marco.from("deadlines").insert({
      household_id: bianchi.householdId,
      title: "Intruso",
      due_date: "2026-12-31",
    });
    expect(created.error).not.toBeNull();

    await marco.from("deadlines").update({ title: "Cambiata" }).eq("id", id);
    await marco.from("deadlines").delete().eq("id", id);
    const rows = await deadlinesOf(bianchi, "Giulia");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id, title: BOLLO });
  });
});

// ------------------------------------------------------- Fuoco ed eliminazione

test.describe("Aggiungi · modifica · fuoco ed errori", () => {
  test("CA-68: «Togli la data» porta il fuoco su «Togli Per Sofia», che lo porta sul bottone della visibilità", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seedGita(casa);
    await openEditFromRow(page, baseURL, casa, "Marco", GITA);
    const s = sheet(page, "edit");

    await s.button("Togli la data").click();
    await expect(labelText(page, /^Entro /)).toHaveCount(0);
    await expect(s.button("Togli Per Sofia")).toBeFocused();

    await s.button("Togli Per Sofia").click();
    await expect(labelText(page, "Per Sofia")).toHaveCount(0);
    await expect(s.visibility).toBeFocused();
  });

  test("CA-69: dopo «Salva» il fuoco torna sul titolo «Modifica: …» della riga", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seedGita(casa);
    await openEditFromRow(page, baseURL, casa, "Marco", GITA);
    const s = sheet(page, "edit");
    await s.person("Laura").click();
    await s.button("Salva").click();

    await expect(s.dialog).toHaveCount(0);
    await expect(toastWith(page, "Modifiche salvate.")).toBeVisible();
    await expect(
      page.getByRole("button", { name: `Modifica: ${GITA}` }),
    ).toBeFocused();
  });

  test("CA-70: eliminando l'unica cosa di «Questa settimana» il fuoco va sull'h1 «Casa»", async ({
    page,
    baseURL,
    casa,
  }) => {
    await casa.todo("Marco", { title: GITA, due: "2026-10-23" });
    await casa.todo("Marco", {
      title: "Sistemare la cantina",
      due: "2026-11-10",
    });
    await openEditFromRow(page, baseURL, casa, "Marco", GITA);
    const s = sheet(page, "edit");
    await s.button("Elimina cosa da fare").click();
    const confirm = confirmOf(page, GITA);
    await expect(confirm).toBeVisible();
    await waitForAnimationsToEnd(page);
    await confirm.getByRole("button", { name: "Elimina cosa da fare" }).click();

    await expect(s.dialog).toHaveCount(0);
    await expect(
      page.getByRole("heading", { level: 3, name: "Questa settimana" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { level: 1, name: "Casa" }),
    ).toBeFocused();
  });

  test("CA-70: eliminando una di due cose dello stesso gruppo il fuoco va sull'h3 del gruppo", async ({
    page,
    baseURL,
    casa,
  }) => {
    await casa.todo("Marco", { title: GITA, due: "2026-10-23" });
    await casa.todo("Marco", {
      title: "Sistemare la cantina",
      due: "2026-10-22",
    });
    await openEditFromRow(page, baseURL, casa, "Marco", GITA);
    const s = sheet(page, "edit");
    await s.button("Elimina cosa da fare").click();
    const confirm = confirmOf(page, GITA);
    await expect(confirm).toBeVisible();
    await waitForAnimationsToEnd(page);
    await confirm.getByRole("button", { name: "Elimina cosa da fare" }).click();

    await expect(s.dialog).toHaveCount(0);
    await expect(
      page.getByRole("heading", { level: 3, name: "Questa settimana" }),
    ).toBeFocused();
  });

  test("CA-71: se l'eliminazione è rifiutata il dialogo resta, compare il toast senza icona e la cosa esiste ancora", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seedGita(casa);
    await openEditFromRow(page, baseURL, casa, "Marco", GITA);
    await refuseWrites(page, "todos", "DELETE");
    const s = sheet(page, "edit");
    await s.button("Elimina cosa da fare").click();
    const confirm = confirmOf(page, GITA);
    await expect(confirm).toBeVisible();
    await waitForAnimationsToEnd(page);
    await confirm.getByRole("button", { name: "Elimina cosa da fare" }).click();

    const failed = toastWith(
      page,
      "Non siamo riusciti a eliminare. Riprova tra qualche secondo.",
    );
    await expect(failed).toBeVisible();
    await expect(failed.locator("svg")).toHaveCount(0);
    await expect(confirm).toBeVisible();
    expect(await todosOf(casa, "Marco")).toHaveLength(1);
  });

  test("CA-72: mentre la cosa si legge il foglio ha la testa «Modifica» e un elemento in caricamento, senza modulo", async ({
    page,
    baseURL,
    casa,
  }) => {
    const id = await seedGita(casa);
    const todosRead = await holdRequests(page, "todos", "GET", true);
    const deadlinesRead = await holdRequests(page, "deadlines", "GET", true);
    await openDirect(page, baseURL, casa, "Marco", editUrl(id), {
      mode: "edit",
      ready: (p) => sheet(p, "edit").dialog.getByText("Caricamento in corso"),
    });
    const s = sheet(page, "edit");
    await expect(
      s.dialog.getByRole("heading", { name: "Modifica" }),
    ).toBeVisible();
    await expect(s.dialog.locator('[aria-busy="true"]')).toHaveCount(1);
    await expect(s.dialog.getByRole("textbox")).toHaveCount(0);
    await expect(s.button("Salva")).toHaveCount(0);

    todosRead.release();
    deadlinesRead.release();
    await expect(s.field).toHaveValue(GITA);
    await expect(s.dialog.locator('[aria-busy="true"]')).toHaveCount(0);
  });
});

test.describe("Aggiungi · modifica · cosa già eliminata", () => {
  test("CA-43: aprendo l'indirizzo di una cosa già eliminata da un'altra sessione il foglio dice «non c'è più»", async ({
    page,
    baseURL,
    casa,
  }) => {
    const id = await seedGita(casa);
    await openCasaPage(page, baseURL, casa, "Marco", "/casa/da-fare");
    await expect(todoRow(page, GITA)).toBeVisible();
    await deleteRow(casa, "Marco", "todos", id);
    await page.goto(editUrl(id));
    await expect(goneMessage(page)).toBeVisible({ timeout: 20_000 });
    await expectGone(page);
    await expect(page.getByText(GITA)).toHaveCount(0);
  });
});
