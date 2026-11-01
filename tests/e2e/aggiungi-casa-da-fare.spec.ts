import { expect, test } from "../fixtures/casa";
import {
  PRIVATE,
  SHARED,
  expectNames,
  expectNobody,
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

    await expect(labelText(page, "Entro venerdì")).toBeVisible();
    await expect(s.visibility).toHaveAccessibleName(SHARED);
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

  test("CA-17: «devo portare le scarpe dal calzolaio» sceglie «Tu»; un secondo tocco su «Tu» toglie la scelta", async ({
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

  test("CA-18: toccare «Sofia» dopo «Laura deve…» sceglie Sofia e il bottone dice «Dai a Sofia»", async ({
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
    await expect(s.person("Laura")).toHaveAttribute("aria-pressed", "false");
    await expect(s.button("Dai a Sofia")).toBeVisible();
  });

  test("CA-19: «Solo io» porta la scelta a «Tu»; scegliere «Laura» riporta la visibilità a tutto il Nest", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAddFromNav(page, baseURL, casa, "Marco");
    const s = sheet(page);
    await s.field.fill("Laura deve chiamare la nonna");
    await expect(s.visibility).toHaveAccessibleName(SHARED);

    await s.visibility.click();
    await expect(s.visibility).toHaveAccessibleName(PRIVATE);
    await expect(s.person("Tu")).toHaveAttribute("aria-pressed", "true");
    await expect(s.person("Laura")).toHaveAttribute("aria-pressed", "false");

    await s.person("Laura").click();
    await expect(s.visibility).toHaveAccessibleName(SHARED);
    await expect(s.person("Laura")).toHaveAttribute("aria-pressed", "true");
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
    await s.visibility.click();
    await expect(s.visibility).toHaveAccessibleName(PRIVATE);
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

  test("CA-21: con la lente «Io» l'etichetta della visibilità è «Lo vede tutto il Nest»", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAddFromNav(page, baseURL, casa, "Marco", { lens: "io" });
    const s = sheet(page);
    await s.field.fill("Laura deve chiamare la nonna");
    await expect(s.visibility).toHaveAccessibleName(SHARED);
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
  test("CA-25: le date scritte diventano le etichette «Entro …» della tabella di #23", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAddFromNav(page, baseURL, casa, "Marco");
    const s = sheet(page);
    await s.type("Da fare").click();

    const cases: [string, string][] = [
      ["x entro domani", "Entro domani"],
      ["x entro martedì", "Entro 27 ottobre"],
      ["x entro 7 dicembre", "Entro 7 dicembre"],
      ["x entro 15 ottobre", "Entro 15 ottobre 2027"],
      ["x entro fine mese", "Entro fine mese"],
      ["x entro fine novembre", "Entro fine novembre"],
      ["x entro 7/12/2027", "Entro 7 dicembre 2027"],
      ["x entro oggi", "Entro oggi"],
    ];
    for (const [phrase, label] of cases) {
      await s.field.fill("");
      await s.field.fill(phrase);
      await expect(labelText(page, label)).toBeVisible();
      await expect(labelText(page, /^Entro /)).toHaveCount(1);
    }
  });

  test("CA-26: «x entro 31/11» non ha etichetta di data e salva il titolo intero, senza scadenza", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAddFromNav(page, baseURL, casa, "Marco");
    const s = sheet(page);
    await s.type("Da fare").click();
    await s.field.fill("x entro 31/11");
    await expect(s.button("Aggiungi ai da fare")).toBeVisible();
    await expect(labelText(page, /^Entro /)).toHaveCount(0);

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
