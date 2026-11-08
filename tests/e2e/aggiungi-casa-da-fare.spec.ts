import { expect, test } from "../fixtures/casa";
import {
  PRIVATE,
  SHARED,
  assigneesOf,
  expectNames,
  expectNobody,
  idsOf,
  labelText,
  openAddFromNav,
  pauseClock,
  sheet,
  todosOf,
  toastOf,
  toastWith,
} from "../fixtures/aggiungi-casa";

// Aggiungi · Da fare (#22): creation (CA-14 ... CA-24), recognised dates (CA-25,
// CA-26) and the check on a name that is not in the Nest (CA-47). The browser
// clock is fixed at Tuesday 20 October 2026, 15:52 in Rome ([OR]). Every test
// builds its own throwaway Nests. The labels of the dates are the ones of
// `formatDeadline` (table of #23), as the alignment of the criteria of 31/10
// says.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

const PHRASE = "Laura deve chiamare la nonna entro venerdì";

test.describe("Aggiungi · Da fare · creazione", () => {
  test("CA-14: «Laura deve chiamare la nonna entro venerdì» mostra le etichette, le persone nell'ordine giusto e «Dai a Laura»", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAddFromNav(page, baseURL, casa, "Marco");
    const s = sheet(page);
    await s.field.fill(PHRASE);

    // The day is in the field «Data» (#333), not in a label
    await expect(s.date).toHaveValue("2026-10-23");
    await s.expectVoice(SHARED);
    await expect(s.voice(PRIVATE)).toBeVisible();
    await expectNames(s.who, ["Tu", "Laura", "Sofia", "Tommaso"]);
    await expect(s.person("Biscotto")).toHaveCount(0);
    await expect(s.person("Laura")).toHaveAttribute("aria-pressed", "true");
    await expect(s.button("Dai a Laura")).toBeVisible();
  });

  test("CA-15: «Dai a Laura» salva la cosa e mostra il toast «Dato a Laura: Chiamare la nonna.» con «Annulla»", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAddFromNav(page, baseURL, casa, "Marco");
    const s = sheet(page);
    await s.field.fill(PHRASE);
    await s.button("Dai a Laura").click();

    await expect(s.dialog).toHaveCount(0);
    const toast = toastWith(page, "Dato a Laura: Chiamare la nonna.");
    await expect(toast).toBeVisible();
    await expect(toast.getByRole("button", { name: "Annulla" })).toBeVisible();

    const rows = await todosOf(casa, "Marco");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      title: "Chiamare la nonna",
      assignee_member_id: casa.members["Laura"],
      due_date: "2026-10-23",
      is_private: false,
      created_by_member_id: casa.members["Marco"],
    });
  });

  test("CA-16: «comprare la cuffia per Sofia entro giovedì» salva «per Sofia», senza chi se ne occupa", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAddFromNav(page, baseURL, casa, "Marco");
    const s = sheet(page);
    await s.field.fill("comprare la cuffia per Sofia entro giovedì");
    await expect(labelText(page, /Per Sofia$/)).toBeVisible();
    await s.button("Aggiungi ai da fare").click();

    await expect(
      toastWith(page, "Aggiunto ai da fare: Comprare la cuffia."),
    ).toBeVisible();
    const rows = await todosOf(casa, "Marco");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      title: "Comprare la cuffia",
      for_member_id: casa.members["Sofia"],
      due_date: "2026-10-22",
      assignee_member_id: null,
    });
  });

  test("CA-17 (#22): «devo portare le scarpe dal calzolaio» sceglie «Tu»; un secondo tocco su «Tu» toglie la scelta", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAddFromNav(page, baseURL, casa, "Marco");
    const s = sheet(page);
    await s.type("Da fare").click();
    await s.field.fill("devo portare le scarpe dal calzolaio");

    await expect(s.person("Tu")).toHaveAttribute("aria-pressed", "true");
    await expect(s.button("Aggiungi ai da fare")).toBeVisible();

    await s.person("Tu").click();
    await expectNobody(s.who);
  });

  // #333 (decision 5, CA-17): a tap adds a person, it does not replace the one chosen.
  test("CA-17: toccare «Sofia» dopo «Laura deve…» sceglie Laura e Sofia; il bottone dice «Dai a Laura e Sofia» e il toast le nomina", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAddFromNav(page, baseURL, casa, "Marco");
    const s = sheet(page);
    await s.field.fill("Laura deve chiamare la nonna");
    await expect(s.person("Laura")).toHaveAttribute("aria-pressed", "true");

    await s.person("Sofia").click();
    await expect(s.person("Sofia")).toHaveAttribute("aria-pressed", "true");
    await expect(s.person("Laura")).toHaveAttribute("aria-pressed", "true");
    await expect(s.person("Tu")).toHaveAttribute("aria-pressed", "false");
    await s.button("Dai a Laura e Sofia").click();

    await expect(
      toastWith(page, "Dato a Laura e Sofia: Chiamare la nonna."),
    ).toBeVisible();
    const rows = await todosOf(casa, "Marco");
    expect(rows).toHaveLength(1);
    expect(await assigneesOf(casa, "Marco", "todo", rows[0]!.id)).toEqual(
      idsOf(casa, ["Laura", "Sofia"]),
    );
  });

  test("CA-19 (#22, CA-16): «Lo vedo solo io» lascia scelto solo «Tu»; scegliere «Laura» riporta «Lo vede tutto il Nest»", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAddFromNav(page, baseURL, casa, "Marco");
    const s = sheet(page);
    await s.field.fill("Laura deve chiamare la nonna");
    await s.person("Sofia").click();
    await s.expectVoice(SHARED);

    await s.voice(PRIVATE).click();
    await s.expectVoice(PRIVATE);
    await expect(s.person("Tu")).toHaveAttribute("aria-pressed", "true");
    await expect(s.person("Laura")).toHaveAttribute("aria-pressed", "false");
    await expect(s.person("Sofia")).toHaveAttribute("aria-pressed", "false");

    await s.person("Laura").click();
    await s.expectVoice(SHARED);
    await expect(s.person("Laura")).toHaveAttribute("aria-pressed", "true");
    await expect(s.person("Tu")).toHaveAttribute("aria-pressed", "true");
  });

  test("CA-20: una cosa «Solo io» di Paolo è privata e Giulia non la legge", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await openAddFromNav(page, baseURL, bianchi, "Paolo");
    const s = sheet(page);
    await s.field.fill("prenotare il ristorante entro domani");
    await s.type("Da fare").click();
    await s.voice(PRIVATE).click();
    await s.expectVoice(PRIVATE);
    await s.button("Aggiungi ai da fare").click();

    await expect(
      toastWith(page, "Aggiunto ai da fare: Prenotare il ristorante."),
    ).toBeVisible();
    const mine = await todosOf(bianchi, "Paolo");
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({
      title: "Prenotare il ristorante",
      is_private: true,
      due_date: "2026-10-21",
    });
    expect(await todosOf(bianchi, "Giulia")).toHaveLength(0);
  });

  test("CA-15: con la lente «Io», in Da fare e in Scadenza le due voci ci sono insieme e c'è «Lo vede tutto il Nest»; in Spesa nessuna", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAddFromNav(page, baseURL, casa, "Marco", { lens: "io" });
    const s = sheet(page);
    for (const type of ["Da fare", "Scadenza"] as const) {
      await s.type(type).click();
      await expect(s.voice(SHARED)).toBeVisible();
      await expect(s.voice(PRIVATE)).toBeVisible();
      await s.expectVoice(SHARED);
    }
    await s.type("Spesa").click();
    await expect(s.visibility).toHaveCount(0);
    await expect(s.voice(SHARED)).toHaveCount(0);
    await expect(s.voice(PRIVATE)).toHaveCount(0);
  });

  test("CA-22: «Laura deve entro venerdì» dà l'errore del titolo mancante e non salva nulla", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAddFromNav(page, baseURL, casa, "Marco");
    const s = sheet(page);
    await s.type("Da fare").click();
    await s.field.fill("Laura deve entro venerdì");
    await s.button(/^(Dai a Laura|Aggiungi ai da fare)$/).click();

    await s.expectError(
      "Manca cosa c'è da fare: scrivi per esempio «Laura deve chiamare la nonna entro venerdì».",
    );
    expect(await todosOf(casa, "Marco")).toHaveLength(0);
  });

  test("CA-23: un titolo di 81 caratteri dà l'errore dei 80 caratteri e non salva nulla", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAddFromNav(page, baseURL, casa, "Marco");
    const s = sheet(page);
    await s.type("Da fare").click();
    await s.field.fill("a".repeat(81));
    await s.button("Aggiungi ai da fare").click();

    await s.expectError("Il titolo può avere al massimo 80 caratteri.");
    expect(await todosOf(casa, "Marco")).toHaveLength(0);
  });

  test("CA-24: «Annulla» nel toast toglie la cosa appena creata", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAddFromNav(page, baseURL, casa, "Marco");
    const s = sheet(page);
    await s.field.fill(PHRASE);
    await s.button("Dai a Laura").click();
    const toast = toastWith(page, "Dato a Laura: Chiamare la nonna.");
    await expect(toast).toBeVisible();
    expect(await todosOf(casa, "Marco")).toHaveLength(1);

    await pauseClock(page);
    await toast.getByRole("button", { name: "Annulla" }).click();
    await expect(toastOf(page)).toHaveCount(0);
    await expect
      .poll(async () => (await todosOf(casa, "Marco")).length)
      .toBe(0);
  });
});

test.describe("Aggiungi · Da fare · date riconosciute", () => {
  // #333 (CA-10): the day written in the phrase is the value of the field «Data».
  test("CA-10: le date scritte diventano il valore del campo «Data»", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAddFromNav(page, baseURL, casa, "Marco");
    const s = sheet(page);
    await s.type("Da fare").click();

    const cases: [string, string][] = [
      ["x entro domani", "2026-10-21"],
      ["x entro martedì", "2026-10-27"],
      ["x entro 7 dicembre", "2026-12-07"],
      ["x entro 15 ottobre", "2027-10-15"],
      ["x entro fine mese", "2026-10-31"],
      ["x entro fine novembre", "2026-11-30"],
      ["x entro 7/12/2027", "2027-12-07"],
      ["x entro oggi", "2026-10-20"],
      ["x entro 31/11", ""],
    ];
    for (const [phrase, day] of cases) {
      await s.field.fill("");
      await s.field.fill(phrase);
      await expect(s.date).toHaveValue(day);
    }
  });

  test("CA-26 (#22): «x entro 31/11» non ha data e salva il titolo intero, senza scadenza", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAddFromNav(page, baseURL, casa, "Marco");
    const s = sheet(page);
    await s.type("Da fare").click();
    await s.field.fill("x entro 31/11");
    await expect(s.button("Aggiungi ai da fare")).toBeVisible();
    await expect(s.date).toHaveValue("");

    await s.button("Aggiungi ai da fare").click();
    await expect(
      toastWith(page, "Aggiunto ai da fare: X entro 31/11."),
    ).toBeVisible();
    const rows = await todosOf(casa, "Marco");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      title: "X entro 31/11",
      due_date: null,
    });
  });

  test("CA-47: «Giulia deve chiamare la nonna» (Giulia non è del Nest) non sceglie nessuno e il titolo resta intero", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAddFromNav(page, baseURL, casa, "Marco");
    const s = sheet(page);
    await s.type("Da fare").click();
    await s.field.fill("Giulia deve chiamare la nonna");

    await expectNobody(s.who);
    await s.button("Aggiungi ai da fare").click();
    await expect(toastOf(page)).toBeVisible();
    const rows = await todosOf(casa, "Marco");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      title: "Giulia deve chiamare la nonna",
      assignee_member_id: null,
    });
  });
});
