import { dateText, weekdayName } from "../fixtures/casa";
import {
  changeOccurrence,
  createEvent,
  instant,
  removeOccurrence,
  type EventSpec,
} from "../fixtures/impegni";
import {
  assign,
  at,
  bell,
  day,
  expect,
  freeFridayScene,
  memberId,
  notificationRows,
  open,
  openLink,
  pageText,
  removeMember,
  retime,
  rowOf,
  rows,
  runJob,
  setPreference,
  stamp,
  T,
  test,
  textOf,
  timeOf,
  userOf,
  withPageAt,
} from "../fixtures/notifiche";

// Notifiche (#39), notifications: birth, text and recipients.
// CA-9 ... CA-21 and CA-44 ... CA-49, plus the change of a single occurrence.
//
// The notifications are born the way the app makes them: a thing to do
// assigned or a time changed (triggers, with the session of the author), the
// jobs of 8:00, 9:00 and 19:00 (the test function of the database, with the
// administrative key, for the instant of the criterion). `created_at` of the
// ones born "now" is moved to the day and hour of the criterion. The clock of
// the browser is on T, the most recent Tuesday (the «martedì 20 ottobre» of the
// criteria): the dates of the criteria are T plus a number of days.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

const FIRMARE = "Firmare autorizzazione gita";
const CARTA = "Rinnovo carta d'identità di Leo";

test.describe("da fare assegnato", () => {
  test("CA-9: la riga dice chi ha assegnato, la scadenza, l'ora, e ha «Fatto» e «Apri» collegati al testo", async ({
    page,
    baseURL,
    nest,
  }) => {
    await assign(nest, FIRMARE, { due: day(3), when: at(0, "09:15") });
    await open(page, baseURL, nest, "Giulia");

    await expect(page.locator("h2.sezione__titolo")).toHaveText(["Oggi"]);
    const row = rowOf(page, FIRMARE);
    await expect(row).toHaveCount(1);
    await expect(textOf(row)).toContainText(
      `Paolo ti ha assegnato ${FIRMARE}, entro ${weekdayName(day(3))}.`,
    );
    await expect(textOf(row).locator("b")).toHaveText(["Paolo", FIRMARE]);
    await expect(timeOf(row)).toHaveText("9:15");
    await expect(row.locator(".avatar")).toHaveText("P");
    await expect(row.locator(".avatar")).toHaveAttribute("aria-hidden", "true");

    const textId = await textOf(row).getAttribute("id");
    expect(textId).toBeTruthy();
    const done = row.getByRole("button", { name: "Fatto", exact: true });
    const openButton = openLink(row);
    await expect(done).toHaveAttribute("aria-describedby", textId!);
    await expect(openButton).toHaveAttribute("aria-describedby", textId!);
    await expect(openButton).toHaveAttribute("href", "/casa/da-fare");
  });

  test("CA-10: chi assegna a sé stesso, a un figlio o a nessuno non crea nessuna notifica", async ({
    nest,
  }) => {
    await nest.todo("Giulia", {
      title: "Pagare la bolletta",
      assignee: "Giulia",
    });
    await nest.todo("Paolo", {
      title: "Cambiare le lenzuola",
      assignee: "Leo",
    });
    await nest.todo("Paolo", { title: "Sistemare il garage" });
    expect(await notificationRows(nest)).toHaveLength(0);
  });

  test("CA-11: con «Da fare assegnati a me» spenta non nasce la notifica, e riaccendendo non torna", async ({
    page,
    baseURL,
    nest,
  }) => {
    await setPreference(nest, "Giulia", "assigned_todos", false);
    await nest.todo("Paolo", { title: FIRMARE, assignee: "Giulia" });
    expect(await notificationRows(nest, "Giulia")).toHaveLength(0);

    await setPreference(nest, "Giulia", "assigned_todos", true);
    expect(await notificationRows(nest, "Giulia")).toHaveLength(0);
    await open(page, baseURL, nest, "Giulia");
    await expect(page.getByText("Tutto tranquillo")).toBeVisible();
    await expect(rows(page)).toHaveCount(0);
  });

  test("CA-21: se Paolo cancella il da fare la riga non c'è più e la campanella non la conta", async ({
    page,
    baseURL,
    nest,
  }) => {
    const todo = await assign(nest, FIRMARE, {
      due: day(3),
      when: at(0, "09:15"),
    });
    const { error } = await userOf(nest, "Paolo")
      .client.from("todos")
      .delete()
      .eq("id", todo);
    expect(error).toBeNull();

    await open(page, baseURL, nest, "Giulia", { path: "/oggi", pause: false });
    await expect(bell(page)).toHaveAttribute("aria-label", "Notifiche");
    await page.goto("/notifiche");
    await expect(page.getByText("Tutto tranquillo")).toBeVisible();
    await expect(rowOf(page, FIRMARE)).toHaveCount(0);
  });

  test("CA-21: se Paolo lo rende «Solo io» togliendo l'assegnatario la riga non c'è più e la campanella non la conta", async ({
    page,
    baseURL,
    nest,
  }) => {
    const todo = await assign(nest, FIRMARE, {
      due: day(3),
      when: at(0, "09:15"),
    });
    const { error } = await userOf(nest, "Paolo")
      .client.from("todos")
      .update({ is_private: true, assignee_member_id: null })
      .eq("id", todo);
    expect(error).toBeNull();
    const counted = await userOf(nest, "Giulia").client.rpc(
      "count_unread_notifications",
    );
    expect(counted.data).toBe(0);

    await open(page, baseURL, nest, "Giulia", { path: "/oggi", pause: false });
    await expect(bell(page)).toHaveAttribute("aria-label", "Notifiche");
    await page.goto("/notifiche");
    await expect(page.getByText("Tutto tranquillo")).toBeVisible();
    await expect(rowOf(page, FIRMARE)).toHaveCount(0);
  });

  test("CA-44: la scadenza del da fare è «entro» il giorno, o manca se non c'è", async ({
    page,
    baseURL,
    nest,
  }) => {
    await assign(nest, "Ritirare le foto", { when: at(0, "09:00") });
    await assign(nest, "Comprare il regalo", {
      due: day(9),
      when: at(0, "09:10"),
    });
    await open(page, baseURL, nest, "Giulia");

    await expect(textOf(rowOf(page, "Ritirare le foto"))).toContainText(
      "Paolo ti ha assegnato Ritirare le foto.",
    );
    const far = `${weekdayName(day(9))} ${dateText(T, day(9))}`;
    await expect(textOf(rowOf(page, "Comprare il regalo"))).toContainText(
      `Paolo ti ha assegnato Comprare il regalo, entro ${far}.`,
    );
  });

  test("CA-48 (chi è uscito dal Nest): la notifica di chi è uscito non si vede e la campanella non la conta", async ({
    page,
    baseURL,
    nest,
  }) => {
    await assign(nest, FIRMARE, { due: day(3), when: at(0, "09:15") });
    await removeMember(nest, "Paolo");

    await open(page, baseURL, nest, "Giulia", { path: "/oggi", pause: false });
    await expect(bell(page)).toHaveAttribute("aria-label", "Notifiche");
    await page.goto("/notifiche");
    await expect(page.getByText("Tutto tranquillo")).toBeVisible();
    await expect(rowOf(page, "ti ha assegnato")).toHaveCount(0);
  });
});

test.describe("scadenza vicina", () => {
  test("CA-12: il lavoro delle 9:00 scrive una notifica per persona, con la nota e il rosso se urgente, senza doppioni", async ({
    page,
    baseURL,
    nest,
  }) => {
    await nest.deadline("Paolo", {
      title: CARTA,
      due: day(7),
      note: "Serve per il viaggio.",
      forMember: "Leo",
    });
    expect(await runJob(nest, "deadline_reminders", at(0, "09:00"))).toBe(2);
    expect(await notificationRows(nest, "Giulia")).toHaveLength(1);
    expect(await notificationRows(nest, "Paolo")).toHaveLength(1);

    await open(page, baseURL, nest, "Giulia");
    const row = rowOf(page, CARTA);
    await expect(row).toHaveCount(1);
    await expect(textOf(row)).toContainText(
      `${CARTA} scade tra 7 giorni. Serve per il viaggio.`,
    );
    await expect(timeOf(row)).toHaveText("9:00");
    await expect(
      row.locator('.icona-riquadro use[href="#i-file-clock"]'),
    ).toHaveCount(1);
    await expect(row.locator(".t-allerta")).toHaveText("tra 7 giorni");

    expect(await runJob(nest, "deadline_reminders", at(0, "09:00"))).toBe(0);
    expect(await notificationRows(nest)).toHaveLength(2);
  });

  test("CA-13: con un assegnatario la notifica è solo sua, e un giorno che non è un promemoria non ne crea", async ({
    nest,
  }) => {
    await nest.deadline("Paolo", {
      title: CARTA,
      due: day(7),
      forMember: "Leo",
      assignee: "Paolo",
    });
    expect(await runJob(nest, "deadline_reminders", at(0, "09:00"))).toBe(1);
    const all = await notificationRows(nest);
    expect(all).toHaveLength(1);
    expect(all[0]?.recipient_member_id).toBe(memberId(nest, "Paolo"));

    expect(await runJob(nest, "deadline_reminders", at(1, "09:00"))).toBe(0);
    expect(await notificationRows(nest)).toHaveLength(1);
  });

  test("CA-14 (privacy): la scadenza «Solo io» di Paolo avvisa solo lui, e Giulia non ne vede il titolo", async ({
    page,
    baseURL,
    nest,
  }) => {
    await nest.deadline("Paolo", {
      title: CARTA,
      due: day(7),
      priv: true,
    });
    expect(await runJob(nest, "deadline_reminders", at(0, "09:00"))).toBe(1);
    expect(await notificationRows(nest, "Paolo")).toHaveLength(1);
    expect(await notificationRows(nest, "Giulia")).toHaveLength(0);

    await open(page, baseURL, nest, "Giulia");
    await expect(page.getByText("Tutto tranquillo")).toBeVisible();
    expect(await pageText(page)).not.toContain("carta d'identità");
  });

  test("CA-45: a 30 giorni la scadenza non è rossa", async ({
    page,
    baseURL,
    nest,
  }) => {
    await nest.deadline("Paolo", {
      title: "Passaporto di Leo",
      due: day(30),
      forMember: "Leo",
    });
    expect(await runJob(nest, "deadline_reminders", at(0, "09:00"))).toBe(2);

    await open(page, baseURL, nest, "Giulia");
    const row = rowOf(page, "Passaporto di Leo");
    await expect(textOf(row)).toContainText(
      "Passaporto di Leo scade tra 30 giorni.",
    );
    await expect(row.locator(".t-allerta")).toHaveCount(0);
  });
});

test.describe("cambio d'orario", () => {
  const nuoto: EventSpec = {
    title: "Nuoto",
    day: "",
    from: "17:00",
    to: "18:00",
    members: ["Giulia", "Paolo"],
  };

  test("CA-15: Giulia vede chi ha spostato l'impegno e «Apri» porta al giorno nuovo; Paolo non ha notifiche", async ({
    page,
    baseURL,
    nest,
  }) => {
    const spec = { ...nuoto, day: day(1) };
    const id = await createEvent(nest, "Paolo", spec);
    await retime(nest, "Paolo", id, spec, {
      day: day(2),
      from: "17:30",
      to: "18:30",
    });
    expect(await notificationRows(nest, "Paolo")).toHaveLength(0);
    const mine = await notificationRows(nest, "Giulia");
    expect(mine).toHaveLength(1);
    expect(mine[0]?.kind).toBe("event_time_changed");
    await stamp(nest, { event_id: id }, { createdAt: at(0, "10:00") });

    await open(page, baseURL, nest, "Giulia");
    const row = rowOf(page, "ha spostato");
    await expect(row).toHaveCount(1);
    await expect(textOf(row)).toContainText(
      `Paolo ha spostato Nuoto: ora è ${weekdayName(day(2))} alle 17:30.`,
    );
    await expect(row.locator(".avatar")).toHaveText("P");
    await expect(openLink(row)).toHaveAttribute(
      "href",
      `/impegni/${id}?giorno=${day(2)}`,
    );
  });

  test("CA-16 (privacy): un «Occupato» o «Solo io» senza Giulia non la avvisa; un «Occupato» con lei sì, con il titolo", async ({
    page,
    baseURL,
    nest,
  }) => {
    const busySpec: EventSpec = {
      title: "Visita privata",
      day: day(2),
      from: "10:00",
      to: "11:00",
      visibility: "busy",
      members: [],
    };
    const privateSpec: EventSpec = {
      title: "Regalo sorpresa",
      day: day(2),
      from: "12:00",
      to: "13:00",
      visibility: "private",
      members: [],
    };
    const sharedSpec: EventSpec = {
      title: "Colloquio",
      day: day(2),
      from: "14:00",
      to: "15:00",
      visibility: "busy",
      members: ["Giulia"],
    };
    const busyId = await createEvent(nest, "Paolo", busySpec);
    const privateId = await createEvent(nest, "Paolo", privateSpec);
    const sharedId = await createEvent(nest, "Paolo", sharedSpec);

    await retime(nest, "Paolo", busyId, busySpec, {
      day: day(3),
      from: "10:00",
      to: "11:00",
    });
    await retime(nest, "Paolo", privateId, privateSpec, {
      day: day(3),
      from: "12:00",
      to: "13:00",
    });
    expect(await notificationRows(nest, "Giulia")).toHaveLength(0);

    await retime(nest, "Paolo", sharedId, sharedSpec, {
      day: day(3),
      from: "14:00",
      to: "15:00",
    });
    const mine = await notificationRows(nest, "Giulia");
    expect(mine).toHaveLength(1);
    expect(mine[0]?.event_id).toBe(sharedId);
    await stamp(nest, { event_id: sharedId }, { createdAt: at(0, "10:00") });

    await open(page, baseURL, nest, "Giulia");
    await expect(textOf(rowOf(page, "Colloquio"))).toContainText(
      `Paolo ha spostato Colloquio: ora è ${weekdayName(day(3))} alle 14:00.`,
    );
    const text = await pageText(page);
    expect(text).not.toContain("Visita privata");
    expect(text).not.toContain("Regalo sorpresa");
  });

  test("CA-17: con «Impegni e cambi d'orario» spenta non nasce nessuna notifica", async ({
    nest,
  }) => {
    await setPreference(nest, "Giulia", "events", false);
    const spec = { ...nuoto, day: day(1) };
    const id = await createEvent(nest, "Paolo", spec);
    await retime(nest, "Paolo", id, spec, {
      day: day(2),
      from: "17:30",
      to: "18:30",
    });
    expect(await notificationRows(nest, "Giulia")).toHaveLength(0);
  });

  test("CA-46: spostando tutta la serie si vede il giorno della prossima volta", async ({
    page,
    baseURL,
    nest,
  }) => {
    // Every Monday, from T-1 to T+6 (two times): the next one, or the last, is T+6.
    const spec: EventSpec = {
      title: "Inglese",
      day: day(-1),
      from: "17:00",
      to: "18:00",
      members: ["Giulia", "Paolo"],
      repeat: { kind: "weekly", weekdays: [1] },
      until: day(6),
    };
    const id = await createEvent(nest, "Paolo", spec);
    await retime(nest, "Paolo", id, spec, { from: "18:00", to: "19:00" });
    await stamp(nest, { event_id: id }, { createdAt: at(0, "10:00") });

    await open(page, baseURL, nest, "Giulia");
    const row = rowOf(page, "ha spostato");
    await expect(textOf(row)).toContainText(
      "Paolo ha spostato Inglese: ora è lunedì alle 18:00.",
    );
    await expect(openLink(row)).toHaveAttribute(
      "href",
      `/impegni/${id}?giorno=${day(6)}`,
    );
  });

  test("CA-46 (una sola volta): spostando una sola volta si vede il giorno di quella volta", async ({
    page,
    baseURL,
    nest,
  }) => {
    const spec: EventSpec = {
      title: "Inglese",
      day: day(-1),
      from: "17:00",
      to: "18:00",
      members: ["Giulia", "Paolo"],
      repeat: { kind: "weekly", weekdays: [1] },
      until: day(6),
    };
    const id = await createEvent(nest, "Paolo", spec);
    await changeOccurrence(nest, "Paolo", id, day(6), {
      title: "Inglese",
      start: instant(day(6), "19:00"),
      end: instant(day(6), "20:00"),
      place: null,
      notes: null,
      escort: null,
    });
    await stamp(nest, { event_id: id }, { createdAt: at(0, "10:00") });

    await open(page, baseURL, nest, "Giulia");
    const row = rowOf(page, "ha spostato");
    await expect(textOf(row)).toContainText(
      "Paolo ha spostato Inglese: ora è lunedì alle 19:00.",
    );
    await expect(openLink(row)).toHaveAttribute(
      "href",
      `/impegni/${id}?giorno=${day(6)}`,
    );
  });

  test("CA-47 (tipi esclusi): un impegno nuovo o cancellato non crea notifiche", async ({
    page,
    baseURL,
    nest,
  }) => {
    await createEvent(nest, "Paolo", {
      title: "Gita al lago",
      day: day(2),
      from: "10:00",
      to: "11:00",
      members: ["Giulia"],
    });
    const doomed = await createEvent(nest, "Paolo", {
      title: "Visita dal dentista",
      day: day(2),
      from: "15:00",
      to: "16:00",
      members: ["Giulia"],
    });
    await removeOccurrence(nest, "Paolo", doomed, day(2), "this");
    expect(await notificationRows(nest, "Giulia")).toHaveLength(0);

    await open(page, baseURL, nest, "Giulia");
    await expect(page.getByText("Tutto tranquillo")).toBeVisible();
    const text = await pageText(page);
    expect(text).not.toContain("ha aggiunto");
    expect(text).not.toContain("ha eliminato");
  });

  test("CA-49: «Apri» di un cambio d'orario porta all'impegno nel giorno nuovo", async ({
    page,
    baseURL,
    nest,
  }) => {
    const spec = { ...nuoto, day: day(1) };
    const id = await createEvent(nest, "Paolo", spec);
    await retime(nest, "Paolo", id, spec, {
      day: day(2),
      from: "17:30",
      to: "18:30",
    });
    await stamp(nest, { event_id: id }, { createdAt: at(0, "10:00") });

    await open(page, baseURL, nest, "Giulia", { pause: false });
    await openLink(rowOf(page, "ha spostato")).click();
    await expect(page).toHaveURL(
      new RegExp(`/impegni/${id}\\?giorno=${day(2)}$`),
    );
  });
});

test.describe("liberi insieme", () => {
  test("CA-18: una sola notifica per la prima sera libera, con il giorno che segue la data di apertura, senza bottoni e senza doppioni", async ({
    page,
    browser,
    baseURL,
    nest,
  }) => {
    expect(await freeFridayScene(nest)).toBe(2);
    const mine = await notificationRows(nest, "Giulia");
    expect(mine).toHaveLength(1);
    expect(mine[0]?.kind).toBe("free_together");
    expect(mine[0]?.evening_date).toBe(day(3));

    const viewport = page.viewportSize();
    const phrase = (when: string) =>
      `${when} tu e Paolo siete liberi insieme dalle 18:00.`;
    for (const [opened, expected] of [
      [at(0, "12:00"), phrase("Venerdì sera")],
      [at(2, "12:00"), phrase("Domani sera")],
      [at(3, "12:00"), phrase("Stasera")],
    ] as const) {
      await withPageAt(
        browser,
        viewport,
        baseURL,
        nest,
        "Giulia",
        opened,
        async (p) => {
          const row = rowOf(p, "liberi insieme");
          await expect(row).toHaveCount(1);
          await expect(textOf(row)).toContainText(expected);
          await expect(row.locator("b")).toHaveText("liberi insieme");
          await expect(
            row.locator(".icona-riquadro--insieme use[href='#i-heart']"),
          ).toHaveCount(1);
          await expect(row.locator("button, a")).toHaveCount(0);
          await expect(p.getByText("Proponi qualcosa")).toHaveCount(0);
        },
      );
    }

    await runJob(nest, "free_together", at(1, "08:00"));
    const after = await notificationRows(nest, "Giulia");
    expect(after.filter((row) => row.evening_date === day(3))).toHaveLength(1);
  });

  test("CA-19 (privacy): un «Solo io» di Paolo non lo rende occupato e il testo non ne dice il titolo", async ({
    page,
    baseURL,
    nest,
  }) => {
    // The evenings before Friday are busy for both, so Friday is the first free one.
    for (const n of [1, 2]) {
      await createEvent(nest, "Paolo", {
        title: `Cena in due ${n}`,
        day: day(n),
        from: "18:00",
        to: "23:00",
        members: ["Giulia", "Paolo"],
      });
    }
    await createEvent(nest, "Paolo", {
      title: "Sorpresa per Giulia",
      day: day(3),
      from: "18:00",
      to: "23:00",
      visibility: "private",
      members: [],
    });
    await createEvent(nest, "Giulia", {
      title: "Riunione di lunedì",
      day: day(-1),
      from: "10:00",
      to: "11:00",
      members: ["Giulia"],
    });
    expect(await runJob(nest, "free_together", at(0, "08:00"))).toBe(2);
    const mine = await notificationRows(nest, "Giulia");
    expect(mine).toHaveLength(1);
    expect(mine[0]?.evening_date).toBe(day(3));

    await open(page, baseURL, nest, "Giulia");
    await expect(textOf(rowOf(page, "liberi insieme"))).toContainText(
      "Venerdì sera tu e Paolo siete liberi insieme dalle 18:00.",
    );
    expect(await pageText(page)).not.toContain("Sorpresa per Giulia");
  });
});

test.describe("spesa raggruppata", () => {
  test("CA-20: con «Spesa» accesa Giulia riceve «Paolo ha aggiunto 3 cose alla spesa.» e Paolo nessuna; spenta no", async ({
    page,
    baseURL,
    nest,
  }) => {
    await nest.shopping("Paolo", ["Latte", "Pane", "Uova"]);
    const removed = await userOf(nest, "Paolo")
      .client.from("shopping_items")
      .delete()
      .eq("name", "Pane");
    expect(removed.error).toBeNull();
    // The additions are recorded when they are made (now): the job counts the
    // 24 hours before the instant it is given, so it runs a minute from now.
    const evening = new Date(Date.now() + 60_000);

    // «Spesa» is off by default: nobody is told.
    expect(await runJob(nest, "shopping_digest", evening)).toBe(0);
    expect(await notificationRows(nest)).toHaveLength(0);

    await setPreference(nest, "Giulia", "shopping", true);
    await setPreference(nest, "Paolo", "shopping", true);
    expect(await runJob(nest, "shopping_digest", evening)).toBe(1);
    const giulia = await notificationRows(nest, "Giulia");
    expect(giulia).toHaveLength(1);
    expect(giulia[0]?.item_count).toBe(3);
    expect(giulia[0]?.actor_member_id).toBe(memberId(nest, "Paolo"));
    expect(await notificationRows(nest, "Paolo")).toHaveLength(0);

    await stamp(
      nest,
      { kind: "shopping_added" },
      { createdAt: at(0, "19:00") },
    );
    await open(page, baseURL, nest, "Giulia", { time: at(0, "20:00") });
    const row = rowOf(page, "alla spesa");
    await expect(textOf(row)).toContainText(
      "Paolo ha aggiunto 3 cose alla spesa.",
    );
    await expect(timeOf(row)).toHaveText("19:00");
  });
});
