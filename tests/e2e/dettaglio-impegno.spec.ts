import {
  addDays,
  barEditButton,
  card,
  createEvent,
  createNuoto,
  dayLabel,
  detailPath,
  expect,
  h1,
  navigateInApp,
  NUOTO,
  openDetail,
  recordBodies,
  romeDay,
  romeMinutes,
  serverHtml,
  test,
  textRx,
} from "../fixtures/impegni";
import { createThrowawayUser } from "../fixtures/throwaway-user";

// Dettaglio impegno (#19), PR #174: accesso, scheda, ripetizione nell'indirizzo,
// chi apre l'impegno e isolamento tra Nest, azioni della scheda (CA-1 – CA-19).
// Every test builds its own throwaway Nests and creates its events with the
// session of the author. Dates are fixed (they do not depend on the clock),
// except CA-12.

test.use({ locale: "it-IT", reducedMotion: "reduce" });
test.describe.configure({ timeout: 90_000 });

const NOT_ANYMORE = "Questo impegno non c'è più";

// ------------------------------------------------------------------- accesso

test.describe("accesso", () => {
  test("CA-1: senza sessione si va su /accesso", async ({ page, casa }) => {
    const id = await createNuoto(casa);
    await page.goto(detailPath(id, "2026-10-20"));
    await expect(page).toHaveURL(/\/accesso/);
  });

  test("CA-2: un utente senza Nest va su /onboarding", async ({
    page,
    baseURL,
    casa,
  }) => {
    const id = await createNuoto(casa);
    const stranger = await createThrowawayUser("Carla");
    try {
      await stranger.signInContext(page.context(), baseURL as string);
      await page.goto(detailPath(id, "2026-10-20"));
      await expect(page).toHaveURL(/\/onboarding/);
    } finally {
      await stranger.remove();
    }
  });
});

// -------------------------------------------------------------------- scheda

test.describe("scheda", () => {
  test("CA-3: la scheda del Nuoto mostra tutto, nell'ordine, senza «Avviso»", async ({
    page,
    baseURL,
    casa,
  }) => {
    const id = await createNuoto(casa);
    await openDetail(page, baseURL, casa, "Marco", id, "2026-10-20");
    await expect(h1(page, NUOTO)).toBeVisible();
    const scheda = card(page);
    await expect(scheda).toContainText(textRx("Martedì 20 ottobre", false));
    await expect(scheda).toContainText("17:00 – 18:30");
    await expect(scheda.getByText("Sofia", { exact: true })).toBeVisible();
    await expect(
      scheda.getByText("Impegno di Sofia, creato da te", { exact: true }),
    ).toBeVisible();
    await expect(scheda.getByRole("term")).toHaveText([
      "Dove",
      "Ripete",
      "La porta",
      "Chi lo vede",
      "Note",
    ]);
    await expect(scheda.getByRole("definition")).toHaveText([
      "Piscina comunale, Lissone",
      "Ogni martedì e giovedì",
      /Laura$/,
      "Tutto il Nest",
      "Portare la cuffia",
    ]);
    await expect(scheda.getByRole("term", { name: "Avviso" })).toHaveCount(0);
    await expect(page).toHaveTitle("FamilyNest · Impegno");
    await expect(
      page.getByRole("link", { name: "Calendario", exact: true }),
    ).toHaveAttribute("aria-current", "true");
  });

  test("CA-4: un'altra volta della serie mostra il suo giorno", async ({
    page,
    baseURL,
    casa,
  }) => {
    const id = await createNuoto(casa);
    await openDetail(page, baseURL, casa, "Marco", id, "2026-10-22");
    await expect(h1(page, NUOTO)).toBeVisible();
    await expect(card(page)).toContainText(textRx("Giovedì 22 ottobre", false));
    await expect(card(page)).toContainText("17:00 – 18:30");
  });

  test("CA-5: senza luogo, accompagnatore, ripetizione e note, la tabella ha solo «Chi lo vede»", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    const id = await createEvent(bianchi, "Paolo", {
      title: "Inglese",
      day: "2026-10-20",
      from: "16:00",
      to: "17:00",
      members: ["Leo"],
    });
    await openDetail(page, baseURL, bianchi, "Giulia", id, "2026-10-20");
    await expect(h1(page, "Inglese")).toBeVisible();
    const scheda = card(page);
    await expect(scheda.getByText("Leo", { exact: true })).toBeVisible();
    await expect(
      scheda.getByText("Impegno di Leo, creato da Paolo", { exact: true }),
    ).toBeVisible();
    await expect(scheda.getByRole("term")).toHaveText(["Chi lo vede"]);
    await expect(scheda.getByRole("definition")).toHaveText(["Tutto il Nest"]);
    await expect(page.getByRole("link", { name: /Indicazioni/ })).toHaveCount(
      0,
    );
  });

  test("CA-6: la riga delle persone scrive «Tu» per chi guarda", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    const withLeo = await createEvent(bianchi, "Paolo", {
      title: "Cinema",
      day: "2026-10-20",
      from: "20:00",
      to: "22:00",
      members: ["Giulia", "Leo"],
    });
    const alone = await createEvent(bianchi, "Giulia", {
      title: "Palestra",
      day: "2026-10-21",
      from: "19:00",
      to: "20:00",
      members: ["Giulia"],
    });
    await openDetail(page, baseURL, bianchi, "Giulia", withLeo, "2026-10-20");
    await expect(h1(page, "Cinema")).toBeVisible();
    await expect(
      card(page).getByText("Tu e Leo", { exact: true }),
    ).toBeVisible();
    await expect(
      card(page).getByText("Impegno tuo e di Leo, creato da Paolo", {
        exact: true,
      }),
    ).toBeVisible();

    await page.goto(detailPath(alone, "2026-10-21"));
    await expect(h1(page, "Palestra")).toBeVisible();
    await expect(card(page).getByText("Tu", { exact: true })).toBeVisible();
    await expect(
      card(page).getByText("Impegno tuo, creato da te", { exact: true }),
    ).toBeVisible();
  });

  test("CA-7: «Ripete» scrive il mese con l'ultimo giorno, e «Ogni giorno»", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    const monthly = await createEvent(bianchi, "Giulia", {
      title: "Affitto",
      day: "2026-10-20",
      from: "09:00",
      to: "09:30",
      members: ["Giulia"],
      repeat: { kind: "monthly" },
      until: "2026-12-15",
    });
    const daily = await createEvent(bianchi, "Giulia", {
      title: "Passeggiata",
      day: "2026-10-20",
      from: "07:00",
      to: "07:30",
      members: ["Giulia"],
      repeat: { kind: "weekly", weekdays: [1, 2, 3, 4, 5, 6, 7] },
    });
    await openDetail(page, baseURL, bianchi, "Giulia", monthly, "2026-10-20");
    await expect(h1(page, "Affitto")).toBeVisible();
    await expect(card(page).getByRole("definition").first()).toHaveText(
      textRx("Ogni mese, il 20, fino al 15 dicembre"),
    );

    await page.goto(detailPath(daily, "2026-10-20"));
    await expect(h1(page, "Passeggiata")).toBeVisible();
    await expect(card(page).getByRole("definition").first()).toHaveText(
      "Ogni giorno",
    );
  });

  test("CA-8: un impegno che finisce il giorno dopo scrive il giorno della fine", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    const id = await createEvent(bianchi, "Giulia", {
      title: "Veglia",
      day: "2026-10-19",
      from: "22:00",
      to: "01:00",
      endDay: "2026-10-20",
      members: ["Giulia"],
    });
    await openDetail(page, baseURL, bianchi, "Giulia", id, "2026-10-19");
    await expect(h1(page, "Veglia")).toBeVisible();
    await expect(card(page)).toContainText(textRx("Lunedì 19 ottobre", false));
    await expect(card(page)).toContainText("22:00 – 1:00 (martedì 20)");
  });

  test.describe("fuso del browser", () => {
    test.use({ timezoneId: "America/New_York" });

    test("CA-9: giorno e ore sono di Roma anche con il browser a New York", async ({
      page,
      baseURL,
      bianchi,
    }) => {
      const id = await createEvent(bianchi, "Giulia", {
        title: "Cena",
        day: "2026-10-25",
        from: "20:00",
        to: "21:00",
        members: ["Giulia"],
      });
      await openDetail(page, baseURL, bianchi, "Giulia", id, "2026-10-25");
      await expect(h1(page, "Cena")).toBeVisible();
      await expect(card(page)).toContainText(
        textRx("Domenica 25 ottobre", false),
      );
      await expect(card(page)).toContainText("20:00 – 21:00");
    });
  });
});

// ------------------------------------------------- ripetizione nell'indirizzo

test.describe("ripetizione nell'indirizzo", () => {
  test("CA-10: un giorno che non è una volta dell'impegno dà «Non c'è più»", async ({
    page,
    baseURL,
    casa,
  }) => {
    const id = await createNuoto(casa);
    await openDetail(page, baseURL, casa, "Marco", id, "2026-10-21");
    await expect(h1(page, NOT_ANYMORE)).toBeVisible();
    const toCalendar = page
      .getByRole("main")
      .getByRole("link", { name: "Vai al calendario" })
      .or(
        page
          .getByRole("main")
          .getByRole("button", { name: "Vai al calendario" }),
      );
    await expect(toCalendar).toHaveAttribute("href", "/calendario");
    await expect(barEditButton(page)).toHaveCount(0);
    await toCalendar.click();
    await expect(page).toHaveURL(/\/calendario$/);
  });

  test("CA-11: senza giorno o con un giorno non valido si vede la volta giusta", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    const single = await createEvent(bianchi, "Giulia", {
      title: "Teatro",
      day: "2026-10-23",
      from: "20:00",
      to: "22:00",
      members: ["Giulia"],
    });
    const ended = await createEvent(bianchi, "Giulia", {
      title: "Corso serale",
      day: "2026-10-01",
      from: "18:00",
      to: "19:00",
      members: ["Giulia"],
      repeat: { kind: "weekly", weekdays: [4] },
      until: "2026-10-15",
    });
    await openDetail(page, baseURL, bianchi, "Giulia", single);
    await expect(h1(page, "Teatro")).toBeVisible();
    await expect(card(page)).toContainText(textRx("Venerdì 23 ottobre", false));

    await page.goto(detailPath(single, "xyz"));
    await expect(h1(page, "Teatro")).toBeVisible();
    await expect(card(page)).toContainText(textRx("Venerdì 23 ottobre", false));
    await expect(page.getByText(NOT_ANYMORE)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Riprova" })).toHaveCount(0);

    // The series is over: the last occurrence.
    await page.goto(detailPath(ended));
    await expect(h1(page, "Corso serale")).toBeVisible();
    await expect(card(page)).toContainText(textRx("Giovedì 15 ottobre", false));
  });

  test("CA-12: senza giorno, un impegno di ogni giorno mostra la volta in corso o la prossima", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    const before = new Date();
    const id = await createEvent(bianchi, "Giulia", {
      title: "Corsa notturna",
      day: addDays(romeDay(before), -7),
      from: "23:00",
      to: "23:30",
      members: ["Giulia"],
      repeat: { kind: "weekly", weekdays: [1, 2, 3, 4, 5, 6, 7] },
    });
    await openDetail(page, baseURL, bianchi, "Giulia", id);
    await expect(h1(page, "Corsa notturna")).toBeVisible();
    const after = new Date();
    // Until 23:30 the occurrence of today is the one in progress or the next;
    // after 23:30 it is the one of tomorrow. The clock is the real one, so the
    // expected day is computed at the start and at the end of the test.
    const expectedAt = (instant: Date) => {
      const today = romeDay(instant);
      return romeMinutes(instant) < 23 * 60 + 30 ? today : addDays(today, 1);
    };
    const days = new Set([expectedAt(before), expectedAt(after)]);
    const wanted = new RegExp(
      [...days].map((day) => textRx(dayLabel(day), false).source).join("|"),
    );
    await expect(card(page)).toContainText(wanted);
  });
});

// ------------------------------------------------ chi lo apre e isolamento

test.describe("chi lo apre e isolamento", () => {
  test("CA-13: un «Occupato» di un altro non coinvolto non arriva al browser", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    const id = await createEvent(bianchi, "Paolo", {
      title: "Riunione segreta",
      day: "2026-10-20",
      from: "10:00",
      to: "11:00",
      visibility: "busy",
      members: ["Paolo"],
      place: "Ufficio Nord",
      notes: "Portare il badge",
    });
    await bianchi.signIn(page, baseURL, "Giulia");
    const bodies = recordBodies(page);
    await page.goto(detailPath(id, "2026-10-20"));
    await expect(h1(page, NOT_ANYMORE)).toBeVisible();
    const html = await serverHtml(page, detailPath(id, "2026-10-20"));
    const shown = await page.content();
    const network = await bodies();
    for (const secret of [
      "Riunione segreta",
      "Ufficio Nord",
      "Portare il badge",
    ]) {
      expect(shown, `pagina: ${secret}`).not.toContain(secret);
      expect(html, `HTML del server: ${secret}`).not.toContain(secret);
      expect(network, `risposte di rete: ${secret}`).not.toContain(secret);
    }
  });

  test("CA-14: un «Solo io» di un altro non coinvolto non arriva al browser", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    const id = await createEvent(bianchi, "Paolo", {
      title: "Prova privata",
      day: "2026-10-20",
      from: "12:00",
      to: "13:00",
      visibility: "private",
      members: ["Paolo"],
    });
    await bianchi.signIn(page, baseURL, "Giulia");
    const bodies = recordBodies(page);
    await page.goto(detailPath(id, "2026-10-20"));
    await expect(h1(page, NOT_ANYMORE)).toBeVisible();
    const html = await serverHtml(page, detailPath(id, "2026-10-20"));
    const shown = await page.content();
    const network = await bodies();
    expect(shown).not.toContain("Prova privata");
    expect(html).not.toContain("Prova privata");
    expect(network).not.toContain("Prova privata");
  });

  test("CA-15: un «Solo io» a cui si partecipa si apre per intero", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    const id = await createEvent(bianchi, "Paolo", {
      title: "Sorpresa",
      day: "2026-10-20",
      from: "18:00",
      to: "19:00",
      visibility: "private",
      members: ["Paolo", "Giulia"],
    });
    await openDetail(page, baseURL, bianchi, "Giulia", id, "2026-10-20");
    await expect(h1(page, "Sorpresa")).toBeVisible();
    await expect(
      card(page).getByRole("term", { name: "Chi lo vede" }),
    ).toBeVisible();
    await expect(card(page).getByRole("definition").last()).toHaveText(
      "Solo io",
    );
  });

  test("CA-16: l'impegno di un altro Nest non si vede e non arriva al browser", async ({
    page,
    baseURL,
    casa,
    bianchi,
  }) => {
    const id = await createNuoto(casa);
    await bianchi.signIn(page, baseURL, "Giulia");
    const bodies = recordBodies(page);
    await page.goto(detailPath(id, "2026-10-20"));
    await expect(h1(page, NOT_ANYMORE)).toBeVisible();
    const html = await serverHtml(page, detailPath(id, "2026-10-20"));
    const shown = await page.content();
    const network = await bodies();
    for (const secret of [
      "Nuoto Sofia",
      "Piscina comunale",
      "Portare la cuffia",
      "Sofia",
      "Laura",
    ]) {
      expect(shown, `pagina: ${secret}`).not.toContain(secret);
      expect(html, `HTML del server: ${secret}`).not.toContain(secret);
      expect(network, `risposte di rete: ${secret}`).not.toContain(secret);
    }
  });

  test("CA-17: un id che non esiste o non è un uuid dà «Non c'è più» senza dettagli tecnici", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await bianchi.signIn(page, baseURL, "Giulia");
    for (const id of ["00000000-0000-4000-8000-000000000000", "abc"]) {
      await page.goto(`/impegni/${id}`);
      await expect(h1(page, NOT_ANYMORE)).toBeVisible();
      const text = await page.getByRole("main").innerText();
      expect(text, id).not.toMatch(
        /PGRST|error|exception|undefined|uuid|invalid|\b4\d{2}\b|\b5\d{2}\b|\b\d{5}\b/i,
      );
    }
  });
});

// ------------------------------------------------------ azioni della scheda

test.describe("azioni della scheda", () => {
  test("CA-18: «Indicazioni» apre le mappe in un'altra scheda, senza Referer", async ({
    page,
    baseURL,
    casa,
  }) => {
    const id = await createNuoto(casa);
    await openDetail(page, baseURL, casa, "Marco", id, "2026-10-20");
    await expect(h1(page, NUOTO)).toBeVisible();
    const directions = page.getByRole("link", { name: /^Indicazioni/ });
    await expect(directions).toHaveAttribute(
      "href",
      "https://www.google.com/maps/search/?api=1&query=Piscina%20comunale%2C%20Lissone",
    );
    await expect(directions).toHaveAttribute("target", "_blank");
    await expect(directions).toHaveAttribute("rel", /noopener/);
    await expect(directions).toHaveAttribute("rel", /noreferrer/);
  });

  test.describe("desktop", () => {
    test.skip(
      ({ viewport }) => (viewport?.width ?? 0) < 1024,
      "«← Torna al calendario» c'è solo da 1024 px",
    );

    test("CA-18: «← Torna al calendario» porta alla settimana della volta", async ({
      page,
      baseURL,
      casa,
    }) => {
      const id = await createNuoto(casa);
      await openDetail(page, baseURL, casa, "Marco", id, "2026-10-20");
      await expect(h1(page, NUOTO)).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Torna al calendario" }),
      ).toHaveAttribute("href", "/calendario?settimana=2026-10-19");
    });
  });

  test.describe("mobile", () => {
    test.skip(
      ({ viewport }) => (viewport?.width ?? 0) >= 1024,
      "«Indietro» della barra c'è solo su mobile",
    );

    test("CA-19: «Indietro» torna alla pagina di prima, o al calendario se si arriva da fuori", async ({
      page,
      baseURL,
      casa,
    }) => {
      const id = await createNuoto(casa);
      await casa.signIn(page, baseURL, "Marco");
      await page.goto("/calendario?settimana=2026-10-19");
      await expect(page.getByRole("main")).toBeVisible();
      await navigateInApp(page, detailPath(id, "2026-10-20"));
      await expect(h1(page, NUOTO)).toBeVisible();
      await page.getByRole("link", { name: "Indietro", exact: true }).click();
      await expect(page).toHaveURL(/\/calendario\?settimana=2026-10-19$/);

      // Opened directly (a new tab): there is no page before, so the calendar.
      const fresh = await page.context().newPage();
      await fresh.goto(detailPath(id, "2026-10-20"));
      await expect(h1(fresh, NUOTO)).toBeVisible();
      await fresh.getByRole("link", { name: "Indietro", exact: true }).click();
      await expect(fresh).toHaveURL(/\/calendario$/);
    });
  });
});
