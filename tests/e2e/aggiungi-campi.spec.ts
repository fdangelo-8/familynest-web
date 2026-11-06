import { expect, test } from "../fixtures/casa";
import {
  assigneesOf,
  deadlinesOf,
  holdRpc,
  idsOf,
  openAddFromNav,
  pauseClock,
  recordNetwork,
  refuseRpc,
  SAVE_FAILED_ALERT,
  PRIVATE,
  shoppingOf,
  sheet,
  toastOf,
  toastWith,
  todosOf,
  writesOf,
} from "../fixtures/aggiungi-casa";
import {
  eventsOf,
  impegnoFields,
  participantRowsOf,
} from "../fixtures/aggiungi";

// Aggiungi, the fields written by hand (#333): every type shows the fields it
// needs from the opening, and the phrase and the fields stay aligned (R1-R7).
// The browser clock is fixed at Tuesday 20 October 2026, 15:52 in Rome ([OR]).
// Every test builds its own throwaway Nests. Nothing here reads a date or a
// title from the address (CA-28 is in aggiungi-casa-comuni.spec.ts, CA-54).

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

const PHRASE = "Nuoto Sofia giovedì alle 17";

test.describe("Aggiungi · Impegno · campi", () => {
  test("CA-4: «Nuoto Sofia giovedì alle 17» riempie Giorno, Dalle, Alle, Chi e Chi lo vede; non ci sono i vecchi bottoni", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAddFromNav(page, baseURL, casa, "Marco", { lens: "nest" });
    const s = sheet(page);
    await s.field.fill(PHRASE);

    const f = impegnoFields(page);
    await expect(f.day).toHaveValue("2026-10-22");
    await expect(f.from).toHaveValue("17:00");
    await expect(f.to).toHaveValue("18:00");
    await f.expectWho(["Sofia"]);
    await f.expectVisibility("Tutti");
    await expect(s.button("Chi Sofia")).toHaveCount(0);
    await expect(s.button(/^Chi lo vede /)).toHaveCount(0);
    await expect(s.dialog.getByText("La porta")).toHaveCount(0);
  });

  test("CA-5: «dentista» con Giorno, Dalle e Alle scelti a mano si salva con quei valori", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAddFromNav(page, baseURL, casa, "Marco");
    const s = sheet(page);
    await s.field.fill("dentista");
    const f = impegnoFields(page);
    await f.day.fill("2026-10-23");
    await f.from.fill("16:00");
    await f.to.fill("17:00");
    await expect(s.button("Metti in venerdì 23")).toBeVisible();
    await s.button("Metti in venerdì 23").click();

    await expect(toastOf(page)).toContainText(
      "Messo in venerdì 23: Dentista alle 16:00.",
    );
    const rows = await eventsOf(casa);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      title: "Dentista",
      escort_member_id: null,
    });
    expect(new Date(rows[0]!.starts_at).toISOString()).toBe(
      "2026-10-23T14:00:00.000Z",
    );
    expect(new Date(rows[0]!.ends_at).toISOString()).toBe(
      "2026-10-23T15:00:00.000Z",
    );
    expect(rows[0]!.memberIds).toEqual([casa.members["Marco"]]);
  });

  test("CA-6: un campo cambiato a mano resta, finché la frase non riconosce un'altra cosa per quel campo", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAddFromNav(page, baseURL, casa, "Marco");
    const s = sheet(page);
    const f = impegnoFields(page);
    await s.field.fill("nuoto giovedì alle 17");
    await expect(f.day).toHaveValue("2026-10-22");
    await f.day.fill("2026-10-23");

    await s.field.focus();
    await s.field.press("End");
    await s.field.pressSequentially(" in piscina");
    await expect(s.field).toHaveValue("nuoto giovedì alle 17 in piscina");
    await expect(f.day).toHaveValue("2026-10-23");

    await s.field.fill("nuoto sabato alle 17 in piscina");
    await expect(f.day).toHaveValue("2026-10-24");
  });

  test("CA-7: «Più dettagli» e «Tutti i dettagli» aprono il modulo con i valori dei campi; chiudendolo il foglio ha gli stessi valori e il fuoco è sul bottone", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAddFromNav(page, baseURL, casa, "Marco");
    const s = sheet(page);
    const f = impegnoFields(page);
    await s.field.fill(PHRASE);
    await f.day.fill("2026-10-23");
    await f.person("Tu").click();
    await f.expectWho(["Tu", "Sofia"]);

    const entry = s.dialog.getByTestId("aggiungi-ingresso-details");
    await entry.click();
    const form = page.getByRole("dialog", { name: "Nuovo impegno" });
    await expect(form).toBeVisible();
    await expect(form.getByLabel("Giorno")).toHaveValue("2026-10-23");
    const who = form.getByRole("group", { name: "Chi", exact: true });
    await expect(who.locator('[aria-pressed="true"]')).toHaveCount(2);
    await expect(
      who.getByRole("button", { name: "Tu", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      who.getByRole("button", { name: "Sofia", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(form.getByText("La porta")).toHaveCount(0);

    await form.getByRole("button", { name: "Chiudi" }).click();
    await expect(sheet(page).dialog).toBeVisible();
    await expect(f.day).toHaveValue("2026-10-23");
    await f.expectWho(["Tu", "Sofia"]);
    await expect(
      sheet(page).dialog.getByTestId("aggiungi-ingresso-details"),
    ).toBeFocused();
  });

  test("CA-2: l'impegno salvato dal foglio non ha accompagnatore, né dal foglio né dal modulo", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAddFromNav(page, baseURL, casa, "Marco");
    const s = sheet(page);
    await s.field.fill(PHRASE);
    await expect(s.dialog.getByText("La porta")).toHaveCount(0);
    await s.dialog.getByTestId("aggiungi-ingresso-details").click();
    const form = page.getByRole("dialog", { name: "Nuovo impegno" });
    await expect(form).toBeVisible();
    await expect(form.getByText("La porta")).toHaveCount(0);
    await form.getByRole("button", { name: "Metti in giovedì 22" }).click();
    await expect(toastOf(page)).toBeVisible();
    const rows = await eventsOf(casa);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.escort_member_id).toBeNull();
  });

  test("Manca il giorno / Manca l'ora: sotto i campi, con il fuoco sul primo, e non si salva niente", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAddFromNav(page, baseURL, casa, "Marco");
    const s = sheet(page);
    const f = impegnoFields(page);
    await s.field.fill("dentista");
    await s.button("Aggiungi").click();

    await expect(f.day).toHaveAttribute("aria-invalid", "true");
    await expect(f.day).toHaveAccessibleDescription("Manca il giorno.");
    await expect(f.day).toBeFocused();
    await expect(f.from).toHaveAccessibleDescription("Manca l'ora.");
    expect(await eventsOf(casa)).toHaveLength(0);

    await f.day.fill("2026-10-23");
    await f.from.fill("16:00");
    await s.button("Metti in venerdì 23").click();
    await expect(f.to).toHaveAccessibleDescription("Manca l'ora.");
    await expect(f.to).toBeFocused();
    expect(await eventsOf(casa)).toHaveLength(0);
  });

  test("«Chi lo vede»: tre voci sempre visibili e la scelta si salva", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAddFromNav(page, baseURL, casa, "Marco", { lens: "nest" });
    const s = sheet(page);
    const f = impegnoFields(page);
    await s.field.fill(PHRASE);
    for (const name of ["Solo io", "Occupato", "Tutti"]) {
      await expect(f.voice(name)).toBeVisible();
    }
    await f.voice("Solo io").click();
    await f.expectVisibility("Solo io");
    await s.button("Metti in giovedì 22").click();
    await expect(toastOf(page)).toBeVisible();
    const rows = await eventsOf(casa);
    expect(rows[0]).toMatchObject({ visibility: "private" });
  });
});

test.describe("Aggiungi · Da fare e Scadenza · «Data»", () => {
  test("CA-8: «comprare il regalo» ha «Data» vuota; scegliendo 2026-10-27 la salva", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAddFromNav(page, baseURL, casa, "Marco");
    const s = sheet(page);
    await s.type("Da fare").click();
    await s.field.fill("comprare il regalo");
    await expect(s.date).toHaveValue("");

    await s.date.fill("2026-10-27");
    await s.button("Aggiungi ai da fare").click();
    await expect(toastWith(page, "Aggiunto ai da fare:")).toBeVisible();
    const rows = await todosOf(casa, "Marco");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      title: "Comprare il regalo",
      due_date: "2026-10-27",
    });
  });

  test("CA-9: «Laura deve chiamare la nonna entro venerdì» ha 2026-10-23; cambiata a mano in 2026-10-26 si salva con il titolo «Chiamare la nonna»", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAddFromNav(page, baseURL, casa, "Marco");
    const s = sheet(page);
    await s.field.fill("Laura deve chiamare la nonna entro venerdì");
    await expect(s.date).toHaveValue("2026-10-23");
    await s.date.fill("2026-10-26");
    await s.button("Dai a Laura").click();

    await expect(
      toastWith(page, "Dato a Laura: Chiamare la nonna."),
    ).toBeVisible();
    const rows = await todosOf(casa, "Marco");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      title: "Chiamare la nonna",
      due_date: "2026-10-26",
    });
  });

  test("CA-11: la «Data» scelta a mano resta finché la frase non riconosce un'altra data, o non la perde", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAddFromNav(page, baseURL, casa, "Marco");
    const s = sheet(page);
    await s.type("Da fare").click();
    await s.field.fill("chiamare la nonna entro venerdì");
    await expect(s.date).toHaveValue("2026-10-23");
    await s.date.fill("2026-10-26");

    await s.field.focus();
    await s.field.press("End");
    await s.field.pressSequentially(" subito");
    await expect(s.date).toHaveValue("2026-10-26");

    await s.field.fill("chiamare la nonna entro giovedì subito");
    await expect(s.date).toHaveValue("2026-10-22");

    await s.date.fill("2026-10-26");
    await s.field.fill("chiamare la nonna subito");
    await expect(s.date).toHaveValue("");
  });

  test("CA-13: Scadenza senza data: «Manca la data» nell'anteprima e sotto «Data», fuoco sul campo, niente salvato; scegliendo la data si salva", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAddFromNav(page, baseURL, casa, "Marco");
    const s = sheet(page);
    await s.type("Scadenza").click();
    await s.field.fill("Compleanno Filippo – sld");
    await expect(s.date).toHaveValue("");
    await expect(
      s.card.getByText("Manca la data", { exact: true }),
    ).toBeVisible();

    await s.button("Aggiungi alle scadenze").click();
    await s.expectDateError(
      "Manca la data: sceglila qui sotto o scrivila nella frase.",
    );
    expect(await deadlinesOf(casa, "Marco")).toHaveLength(0);

    await s.date.fill("2026-12-07");
    await expect(s.card.locator(".riga-scadenza__numero")).toHaveText(/^48$/);
    await expect(s.card.locator(".riga-scadenza__unita")).toHaveText("giorni");
    await expect(s.card.locator(".riga-lista__titolo")).toHaveText(
      "Lunedì 7 dicembre",
    );
    await s.button("Aggiungi alle scadenze").click();
    await expect(toastWith(page, "Aggiunta alle scadenze:")).toBeVisible();
    const rows = await deadlinesOf(casa, "Marco");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      title: "Compleanno Filippo – sld",
      due_date: "2026-12-07",
    });
  });

  test("CA-14: una data passata o oltre il 2100 dà l'errore sotto «Data» e non salva nulla", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAddFromNav(page, baseURL, casa, "Marco");
    const s = sheet(page);
    for (const type of ["Da fare", "Scadenza"] as const) {
      await s.type(type).click();
      await s.field.fill("pagare il condominio");
      const submit = s.button(/^(Aggiungi ai da fare|Aggiungi alle scadenze)$/);

      await s.date.fill("2026-10-19");
      await submit.click();
      await s.expectDateError(
        "Questa data è già passata: scegli una data da oggi in poi.",
      );

      await s.date.fill("2101-01-01");
      await submit.click();
      await s.expectDateError("Scegli una data entro il 2100.");
    }
    expect(await todosOf(casa, "Marco")).toHaveLength(0);
    expect(await deadlinesOf(casa, "Marco")).toHaveLength(0);
  });

  test("CA-22: la «Data» scelta a mano resta tra Da fare e Scadenza, e si azzera passando da un altro tipo", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAddFromNav(page, baseURL, casa, "Marco");
    const s = sheet(page);
    await s.type("Da fare").click();
    await s.field.fill("comprare il regalo");
    await s.date.fill("2026-10-27");

    await s.type("Scadenza").click();
    await expect(s.date).toHaveValue("2026-10-27");
    await s.type("Impegno").click();
    await s.type("Da fare").click();
    await expect(s.date).toHaveValue("");
  });
});

test.describe("Aggiungi · Da fare e Scadenza · «Chi se ne occupa» e visibilità", () => {
  test("CA-16: «Lo vedo solo io» salva una cosa privata che l'altro adulto non legge", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await openAddFromNav(page, baseURL, bianchi, "Paolo");
    const s = sheet(page);
    await s.type("Da fare").click();
    await s.field.fill("prenotare il ristorante entro domani");
    await s.voice(PRIVATE).click();
    await s.button("Aggiungi ai da fare").click();

    await expect(toastWith(page, "Aggiunto ai da fare:")).toBeVisible();
    const mine = await todosOf(bianchi, "Paolo");
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ is_private: true, due_date: "2026-10-21" });
    expect(await todosOf(bianchi, "Giulia")).toHaveLength(0);
  });

  test("CA-18: «Tommaso deve» all'inizio rimette la scelta a Tommaso; senza nessuno il bottone dice «Aggiungi ai da fare» e si salva con zero responsabili", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAddFromNav(page, baseURL, casa, "Marco");
    const s = sheet(page);
    await s.type("Da fare").click();
    await s.field.fill("chiamare la nonna");
    await s.person("Laura").click();
    await s.person("Sofia").click();
    await expect(s.button("Dai a Laura e Sofia")).toBeVisible();

    await s.field.fill("Tommaso deve chiamare la nonna");
    await expect(s.person("Tommaso")).toHaveAttribute("aria-pressed", "true");
    await expect(s.who.locator('[aria-pressed="true"]')).toHaveCount(1);

    await s.person("Tommaso").click();
    await s.person("Tu").click();
    await expect(s.button("Aggiungi ai da fare")).toBeVisible();
    await s.person("Tu").click();
    await expect(s.who.locator('[aria-pressed="true"]')).toHaveCount(0);
    await expect(s.button("Aggiungi ai da fare")).toBeVisible();

    await s.button("Aggiungi ai da fare").click();
    await expect(toastWith(page, "Aggiunto ai da fare:")).toBeVisible();
    const rows = await todosOf(casa, "Marco");
    expect(rows).toHaveLength(1);
    expect(await assigneesOf(casa, "Marco", "todo", rows[0]!.id)).toEqual([]);
  });

  test("CA-20: «bollo auto scade il 7 dicembre» sceglie «Tu»; aggiungendo «Laura» la scadenza ha Marco e Laura", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAddFromNav(page, baseURL, casa, "Marco");
    const s = sheet(page);
    await s.field.fill("bollo auto scade il 7 dicembre");
    await expect(s.person("Tu")).toHaveAttribute("aria-pressed", "true");
    await s.person("Laura").click();
    await s.button("Aggiungi alle scadenze").click();

    await expect(toastWith(page, "Aggiunta alle scadenze:")).toBeVisible();
    const rows = await deadlinesOf(casa, "Marco");
    expect(rows).toHaveLength(1);
    expect(await assigneesOf(casa, "Marco", "deadline", rows[0]!.id)).toEqual(
      idsOf(casa, ["Marco", "Laura"]),
    );
  });

  test("CA-27: salvataggio rifiutato: il foglio resta con frase, data e persone e c'è l'avviso", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAddFromNav(page, baseURL, casa, "Marco");
    const s = sheet(page);
    await s.type("Da fare").click();
    await s.field.fill("comprare il regalo");
    await s.date.fill("2026-10-27");
    await s.person("Laura").click();
    await s.person("Sofia").click();
    await refuseRpc(page, "create_todo");
    await s.button("Dai a Laura e Sofia").click();

    await expect(
      s.dialog.getByRole("alert").filter({ hasText: SAVE_FAILED_ALERT }),
    ).toBeVisible();
    await expect(s.field).toHaveValue("comprare il regalo");
    await expect(s.date).toHaveValue("2026-10-27");
    await expect(s.person("Laura")).toHaveAttribute("aria-pressed", "true");
    await expect(s.person("Sofia")).toHaveAttribute("aria-pressed", "true");
    await expect(toastOf(page)).toHaveCount(0);
    expect(await todosOf(casa, "Marco")).toHaveLength(0);
  });

  test("doppio invio: il secondo tocco non crea due cose", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAddFromNav(page, baseURL, casa, "Marco");
    const s = sheet(page);
    await s.type("Scadenza").click();
    await s.field.fill("bollo auto scade il 7 dicembre");
    const hold = await holdRpc(page, "create_deadline");
    const submit = s.button("Aggiungi alle scadenze");
    await submit.click();
    await expect(submit).toHaveAttribute("aria-busy", "true");
    await submit.click({ force: true });
    hold.release();
    await expect(s.dialog).toHaveCount(0);
    expect(hold.calls()).toBe(1);
    expect(await deadlinesOf(casa, "Marco")).toHaveLength(1);
  });
});

test.describe("Aggiungi · Spesa · «Chi se ne occupa» e cambio di tipo", () => {
  test("CA-30: «latte e pane» con Laura e Tu si salva con i responsabili; «Annulla» toglie cose e responsabili", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAddFromNav(page, baseURL, casa, "Marco");
    const s = sheet(page);
    await s.field.fill("latte e pane");
    await expect(s.type("Spesa")).toHaveAttribute("aria-pressed", "true");
    await expect(s.who.locator('[aria-pressed="true"]')).toHaveCount(0);
    await expect(s.person("Biscotto")).toHaveCount(0);

    await s.person("Laura").click();
    await s.person("Tu").click();
    await s.button("Aggiungi 2 cose").click();
    const toast = toastWith(page, "2 cose aggiunte alla spesa.");
    await expect(toast).toBeVisible();

    const items = await shoppingOf(casa, "Marco");
    expect(items.map((item) => item.name).sort()).toEqual(["Latte", "Pane"]);
    for (const item of items) {
      expect(
        await assigneesOf(casa, "Marco", "shopping_item", item.id),
      ).toEqual(idsOf(casa, ["Laura", "Marco"]));
    }

    await pauseClock(page);
    await toast.getByRole("button", { name: "Annulla" }).click();
    await expect
      .poll(async () => (await shoppingOf(casa, "Marco")).length)
      .toBe(0);
    for (const item of items) {
      expect(
        await assigneesOf(casa, "Marco", "shopping_item", item.id),
      ).toEqual([]);
    }
  });

  test("CA-29: una Scadenza senza data non si salva in nessuna lista; passando a Spesa l'anteprima mostra la riga e non si salva finché non si tocca il bottone", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAddFromNav(page, baseURL, casa, "Marco");
    const s = sheet(page);
    const net = recordNetwork(page);
    await s.type("Scadenza").click();
    await s.field.fill("Compleanno Filippo – sld");
    await s.button("Aggiungi alle scadenze").click();
    await s.expectDateError(
      "Manca la data: sceglila qui sotto o scrivila nella frase.",
    );
    expect(await deadlinesOf(casa, "Marco")).toHaveLength(0);
    expect(await todosOf(casa, "Marco")).toHaveLength(0);
    expect(await shoppingOf(casa, "Marco")).toHaveLength(0);

    await s.type("Spesa").click();
    await expect(s.list.getByRole("listitem")).toHaveCount(1);
    await expect(
      s.list.getByRole("listitem").locator(".riga-lista__titolo"),
    ).toHaveText("Compleanno Filippo – sld");
    await expect(s.button("Aggiungi 1 cosa")).toBeVisible();
    expect(await shoppingOf(casa, "Marco")).toHaveLength(0);
    expect(writesOf(net)).toEqual([]);
  });
});

test.describe("Aggiungi · privacy", () => {
  test("CA-28: l'indirizzo non contiene date, titoli né nomi, a nessun passo", async ({
    page,
    baseURL,
    casa,
  }) => {
    const seen: string[] = [];
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) seen.push(frame.url());
    });
    await openAddFromNav(page, baseURL, casa, "Marco");
    const s = sheet(page);
    await s.type("Da fare").click();
    await s.field.fill("Laura deve chiamare la nonna entro venerdì");
    seen.push(page.url());
    await s.date.fill("2026-10-26");
    seen.push(page.url());
    await s.person("Sofia").click();
    seen.push(page.url());
    await s.button("Dai a Laura e Sofia").click();
    await expect(toastWith(page, "Dato a Laura e Sofia:")).toBeVisible();
    seen.push(page.url());

    for (const url of seen) {
      const text = decodeURIComponent(url);
      expect(text).not.toMatch(/nonna|laura|sofia|chiamare|2026|venerd/i);
    }
  });
});

test.describe("Aggiungi · valori iniziali e persone", () => {
  test("CA-26: Impegno appena aperto: Giorno, Dalle e Alle vuoti, «Tu» scelto in «Chi», bottone spento; con «Scadenza» «Data» è vuota", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAddFromNav(page, baseURL, casa, "Marco");
    const s = sheet(page);
    const f = impegnoFields(page);
    await expect(s.type("Impegno")).toHaveAttribute("aria-pressed", "true");
    await expect(f.day).toHaveValue("");
    await expect(f.from).toHaveValue("");
    await expect(f.to).toHaveValue("");
    await f.expectWho(["Tu"]);
    await expect(s.button("Aggiungi")).toBeDisabled();

    await s.type("Scadenza").click();
    await expect(s.date).toHaveValue("");
    await expect(s.button("Aggiungi")).toBeDisabled();
  });

  test("conteggio dei partecipanti: un impegno ha le persone scelte", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAddFromNav(page, baseURL, casa, "Marco");
    const s = sheet(page);
    const f = impegnoFields(page);
    await s.field.fill("cena venerdì alle 20");
    await f.person("Laura").click();
    await f.person("Tommaso").click();
    await f.expectWho(["Tu", "Laura", "Tommaso"]);
    await s.button("Metti in venerdì 23").click();
    await expect(toastOf(page)).toBeVisible();
    expect(await participantRowsOf(casa)).toBe(3);
  });
});
