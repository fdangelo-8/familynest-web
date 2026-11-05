import {
  at,
  ev,
  eventRows,
  expect,
  info,
  mondayOf,
  open,
  sec,
  T,
  test,
} from "../fixtures/oggi";

// Oggi (#30): «Prossimo», «Dopo» and «Già fatti» (CA-8 ... CA-15, CA-28, CA-43,
// CA-44). The clock of the browser is stopped at Tuesday 15:52 Rome (or at the
// time of the criterion) and moves only with `page.clock.runFor`.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

const notInsieme = "a.riga-evento:not(.riga-evento--insieme)";

test.describe("prossimo", () => {
  test("CA-8: «Prossimo» mostra il tempo che manca, l'ora, il titolo, «Fino alle» e il luogo, ed è un link al dettaglio", async ({
    page,
    baseURL,
    casa,
  }) => {
    const id = await ev(casa, "Marco", {
      title: "Riunione di squadra",
      from: "16:00",
      to: "17:08",
      place: "Teams",
    });
    await open(page, baseURL, casa, "Marco");
    const prossimo = sec(page, "Prossimo");
    await expect(prossimo).toBeVisible();
    await expect(info(prossimo)).toHaveText("tra 8 minuti");
    const card = prossimo.getByRole("link");
    await expect(card).toContainText("16:00");
    await expect(card).toContainText("Riunione di squadra");
    await expect(card).toContainText("Fino alle 17:08, Teams");
    await expect(card).toHaveAttribute("href", `/impegni/${id}?giorno=${T}`);
  });

  test("CA-8 (decisione 04/11): «Prossimo» non dice chi accompagna, «Dopo» sì", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await ev(bianchi, "Paolo", {
      title: "Visita dal pediatra",
      from: "16:00",
      to: "17:00",
      members: ["Giulia", "Leo"],
      escort: "Anna",
    });
    await ev(bianchi, "Paolo", {
      title: "Allenamento di Leo",
      from: "18:00",
      to: "19:00",
      members: ["Giulia", "Leo"],
      escort: "Anna",
    });
    await open(page, baseURL, bianchi, "Giulia", { lens: "io" });
    const prossimo = sec(page, "Prossimo");
    await expect(prossimo).toContainText("Visita dal pediatra");
    await expect(prossimo).toContainText("Fino alle 17:00");
    await expect(prossimo).not.toContainText("la porta");
    await expect(prossimo).not.toContainText("Anna");
    await expect(sec(page, "Dopo")).toContainText("Allenamento di Leo");
    await expect(sec(page, "Dopo")).toContainText("la porta Anna");
  });

  test("CA-9: passati 60 secondi «Prossimo» dice «tra 7 minuti», senza ricaricare", async ({
    page,
    baseURL,
    casa,
  }) => {
    await ev(casa, "Marco", {
      title: "Riunione di squadra",
      from: "16:00",
      to: "17:08",
      place: "Teams",
    });
    await open(page, baseURL, casa, "Marco");
    await expect(info(sec(page, "Prossimo"))).toHaveText("tra 8 minuti");
    const navigations: string[] = [];
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) navigations.push(frame.url());
    });
    await page.clock.runFor(60_000);
    await expect(info(sec(page, "Prossimo"))).toHaveText("tra 7 minuti");
    expect(navigations).toEqual([]);
  });

  for (const [visibility, note] of [
    ["busy", "Gli altri vedono «occupato»"],
    ["private", "Lo vedi solo tu"],
    ["household", null],
  ] as const) {
    test(`CA-10: la scheda «Prossimo» di un impegno ${visibility === "busy" ? "«Occupato»" : visibility === "private" ? "«Solo io»" : "«Tutto il Nest»"} ${note ? `dice «${note}»` : "non ha nessuna nota"}`, async ({
      page,
      baseURL,
      casa,
    }) => {
      await ev(casa, "Marco", {
        title: "Visita di controllo",
        from: "16:22",
        to: "17:22",
        visibility,
      });
      await open(page, baseURL, casa, "Marco");
      const prossimo = sec(page, "Prossimo");
      await expect(prossimo).toContainText("Visita di controllo");
      if (note) {
        await expect(prossimo).toContainText(note);
      } else {
        await expect(prossimo).not.toContainText("Gli altri vedono");
        await expect(prossimo).not.toContainText("Lo vedi solo tu");
      }
    });
  }

  test("CA-11: con tre impegni «Prossimo» mostra il primo e «Dopo» gli altri due in ordine di inizio", async ({
    page,
    baseURL,
    casa,
  }) => {
    await ev(casa, "Marco", { title: "Primo", from: "16:52", to: "17:22" });
    await ev(casa, "Marco", { title: "Secondo", from: "17:52", to: "18:22" });
    await ev(casa, "Marco", { title: "Terzo", from: "18:52", to: "19:22" });
    await open(page, baseURL, casa, "Marco");
    await expect(sec(page, "Prossimo")).toContainText("Primo");
    await expect(sec(page, "Prossimo")).not.toContainText("Secondo");
    const rows = sec(page, "Dopo").locator(notInsieme);
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText("Secondo");
    await expect(rows.nth(1)).toContainText("Terzo");
  });
});

test.describe("dopo", () => {
  test("CA-12: «Già fatto: Palestra» è chiuso, si apre al tocco e il testo non cambia", async ({
    page,
    baseURL,
    casa,
  }) => {
    await ev(casa, "Marco", { title: "Palestra", from: "10:00", to: "11:00" });
    await ev(casa, "Marco", { title: "Cena", from: "17:30", to: "18:30" });
    await open(page, baseURL, casa, "Marco");
    const button = sec(page, "Dopo").getByRole("button", {
      name: "Già fatto: Palestra",
    });
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expect(
      sec(page, "Dopo").getByRole("link", { name: /Palestra/ }),
    ).toHaveCount(0);
    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await expect(
      sec(page, "Dopo").getByRole("link", { name: /Palestra/ }),
    ).toBeVisible();
    await expect(button).toHaveText("Già fatto: Palestra");
    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "false");
  });

  test("CA-12: con due impegni finiti il bottone dice «Già fatti: Scuola, Palestra»", async ({
    page,
    baseURL,
    casa,
  }) => {
    await ev(casa, "Marco", { title: "Palestra", from: "10:00", to: "11:00" });
    await ev(casa, "Marco", { title: "Scuola", from: "8:00", to: "9:00" });
    await ev(casa, "Marco", { title: "Cena", from: "17:30", to: "18:30" });
    await open(page, baseURL, casa, "Marco");
    await expect(
      sec(page, "Dopo").getByRole("button", {
        name: "Già fatti: Scuola, Palestra",
      }),
    ).toBeVisible();
  });

  test("CA-12: con cinque impegni finiti il bottone dice «… Inglese e altri 2»", async ({
    page,
    baseURL,
    casa,
  }) => {
    const titles = ["Scuola", "Palestra", "Inglese", "Piano", "Calcio"];
    // Created in a different order: the button lists them in order of start.
    for (const [index, title] of [...titles.entries()].reverse()) {
      await ev(casa, "Marco", {
        title,
        from: `${7 + index}:00`,
        to: `${7 + index}:45`,
      });
    }
    await ev(casa, "Marco", { title: "Cena", from: "17:30", to: "18:30" });
    await open(page, baseURL, casa, "Marco");
    await expect(
      sec(page, "Dopo").getByRole("button", {
        name: "Già fatti: Scuola, Palestra, Inglese e altri 2",
      }),
    ).toBeVisible();
  });

  test("CA-13: un impegno iniziato 10 minuti fa è la prima riga di «Dopo» con «In corso, fino alle…» e non è in «Prossimo»", async ({
    page,
    baseURL,
    casa,
  }) => {
    await ev(casa, "Marco", {
      title: "Allenamento",
      from: "15:42",
      to: "16:42",
    });
    await ev(casa, "Marco", { title: "Cena", from: "17:52", to: "18:52" });
    await open(page, baseURL, casa, "Marco");
    const first = eventRows(sec(page, "Dopo")).first();
    await expect(first).toContainText("Allenamento");
    await expect(first).toContainText("In corso, fino alle 16:42");
    await expect(sec(page, "Prossimo")).toContainText("Cena");
    await expect(sec(page, "Prossimo")).not.toContainText("Allenamento");
  });

  test("CA-14: la riga «Liberi insieme» dopo la cena porta al Calendario Settimana", async ({
    page,
    baseURL,
    casa,
  }) => {
    await ev(casa, "Marco", {
      title: "Cena con i nonni",
      from: "18:00",
      to: "21:30",
      members: ["Marco", "Laura"],
    });
    await open(page, baseURL, casa, "Marco");
    const row = sec(page, "Dopo").locator("a.riga-evento--insieme");
    await expect(row).toBeVisible();
    await expect(row).toContainText("21:30");
    await expect(row).toContainText("Liberi insieme");
    await expect(row).toContainText("Tu e Laura, fino a fine serata");
    await expect(row).toHaveAttribute(
      "href",
      `/calendario?settimana=${mondayOf(T)}`,
    );
  });

  test("CA-43: la testa di «Dopo» dice «oggi» se una riga inizia prima delle 17:00, «stasera» altrimenti", async ({
    page,
    baseURL,
    casa,
  }) => {
    for (const [title, from, to] of [
      ["Uno", "16:00", "16:20"],
      ["Due", "16:30", "16:50"],
      ["Tre", "19:30", "19:50"],
    ]) {
      await ev(casa, "Marco", { title: title!, from: from!, to: to! });
    }
    await open(page, baseURL, casa, "Marco", { now: at(T, "15:00") });
    await expect(info(sec(page, "Dopo"))).toHaveText("oggi");
  });

  test("CA-43: con le righe di «Dopo» tutte dopo le 17:00 la testa dice «stasera»", async ({
    page,
    baseURL,
    casa,
  }) => {
    for (const [title, from, to] of [
      ["Uno", "16:00", "16:20"],
      ["Due", "17:30", "17:50"],
      ["Tre", "19:30", "19:50"],
    ]) {
      await ev(casa, "Marco", { title: title!, from: from!, to: to! });
    }
    await open(page, baseURL, casa, "Marco", { now: at(T, "15:00") });
    await expect(sec(page, "Prossimo")).toContainText("Uno");
    await expect(info(sec(page, "Dopo"))).toHaveText("stasera");
  });

  test("CA-44: se oggi è tutto finito non c'è «Prossimo», «Dopo» ha «Già fatti» e «Per oggi è tutto» con il link al calendario", async ({
    page,
    baseURL,
    casa,
  }) => {
    await ev(casa, "Marco", { title: "Scuola", from: "8:00", to: "9:00" });
    await ev(casa, "Marco", { title: "Palestra", from: "10:00", to: "11:00" });
    // 23:10: the free evening (18:00 - 23:00) is over too.
    await open(page, baseURL, casa, "Marco", { now: at(T, "23:10") });
    await expect(sec(page, "Prossimo")).toHaveCount(0);
    const dopo = sec(page, "Dopo");
    await expect(dopo).toBeVisible();
    await expect(
      dopo.getByRole("button", { name: "Già fatti: Scuola, Palestra" }),
    ).toBeVisible();
    await expect(dopo).toContainText("Per oggi è tutto");
    await expect(
      dopo.getByRole("link", { name: "calendario" }),
    ).toHaveAttribute("href", "/calendario");
    await expect(sec(page, "Oggi")).toHaveCount(0);
    await expect(sec(page, "Domani")).toHaveCount(0);
  });
});

test.describe("fuso del browser", () => {
  test.use({ timezoneId: "America/New_York" });

  test("CA-15: un impegno alle 23:30 di Roma è di oggi, non di domani, anche con il browser a New York", async ({
    page,
    baseURL,
    casa,
  }) => {
    await ev(casa, "Marco", {
      title: "Cena tardi",
      from: "23:30",
      to: "23:55",
    });
    await open(page, baseURL, casa, "Marco");
    const where = sec(page, "Prossimo");
    await expect(where).toContainText("Cena tardi");
    await expect(where).toContainText("23:30");
    await expect(sec(page, "Domani")).toHaveCount(0);
    // The day on top is the one of Rome, whatever the browser says.
    await expect(page.locator("p.intestazione__sopra:visible")).toContainText(
      String(Number(T.slice(8))),
    );
  });
});

test.describe("nel Nest", () => {
  test("CA-28: l'impegno di Leo accompagnato da Anna, in cui Giulia non c'entra, è in «Nel Nest» con «Alle…, la porta Anna»", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    const id = await ev(bianchi, "Paolo", {
      title: "Visita dal pediatra",
      from: "16:52",
      to: "17:52",
      members: ["Leo"],
      escort: "Anna",
    });
    await open(page, baseURL, bianchi, "Giulia", { lens: "io" });
    const row = sec(page, "Nel Nest").getByRole("link", {
      name: /Visita dal pediatra/,
    });
    await expect(row).toBeVisible();
    await expect(row).toContainText("Alle 16:52, la porta Anna");
    await expect(row).toHaveAttribute("href", `/impegni/${id}?giorno=${T}`);
    // It is not in the day of Giulia.
    await expect(sec(page, "Prossimo")).toHaveCount(0);
  });
});
