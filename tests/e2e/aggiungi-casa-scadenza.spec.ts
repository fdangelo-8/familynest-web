import { expect, test } from "../fixtures/casa";
import {
  GONE_TITLE,
  PRIVATE,
  SHARED,
  deadlinesOf,
  editUrl,
  expectCard,
  expectNames,
  goneMessage,
  labelText,
  openAddFromNav,
  openDirect,
  pauseClock,
  secondBrowser,
  sheet,
  toastOf,
  toastWith,
} from "../fixtures/aggiungi-casa";

// Aggiungi · Scadenza (#22): creation (CA-27 ... CA-34), «Solo io» (CA-65,
// CA-66) and the preview card (CA-73). The browser clock is fixed at Tuesday 20
// October 2026, 15:52 in Rome ([OR]). Every test builds its own throwaway Nests.
// No test uses a health-related deadline (D1).

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

const PHRASE = "bollo auto scade il 7 dicembre";

test.describe("Aggiungi · Scadenza · creazione", () => {
  test("CA-27: «bollo auto scade il 7 dicembre» mostra la scheda, i tre avvisi scelti, «Tu» e «Aggiungi alle scadenze»", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAddFromNav(page, baseURL, casa, "Marco");
    const s = sheet(page);
    await s.field.fill(PHRASE);

    await expectCard(page, {
      number: "48",
      unit: "giorni",
      day: "Lunedì 7 dicembre",
      title: "Bollo auto",
    });
    for (const name of ["30 giorni prima", "7 giorni", "1 giorno"]) {
      await expect(s.reminder(name)).toHaveAttribute("aria-pressed", "true");
    }
    await expect(s.reminder("Il giorno stesso")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await expect(s.person("Tu")).toHaveAttribute("aria-pressed", "true");
    await expect(s.button("Aggiungi alle scadenze")).toBeVisible();
  });

  test("CA-28: la scheda conta i giorni fino a 60 e poi i mesi interi", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAddFromNav(page, baseURL, casa, "Marco");
    const s = sheet(page);
    await s.type("Scadenza").click();

    await s.field.fill("assicurazione della casa scade il 20 gennaio");
    await expectCard(page, {
      number: "3",
      unit: "mesi",
      day: "Mercoledì 20 gennaio 2027",
    });
    await s.field.fill("assicurazione della casa scade il 19 dicembre");
    await expectCard(page, { number: "60", unit: "giorni" });
    await s.field.fill("assicurazione della casa scade il 20 dicembre");
    await expectCard(page, { number: "2", unit: "mesi" });
    await s.field.fill("assicurazione della casa scade domani");
    await expectCard(page, { number: "1", unit: "giorno" });
  });

  test("CA-29: togliere «1 giorno» e scegliere «Il giorno stesso» salva avvisi 30, 7 e 0, con il toast e «Annulla»", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAddFromNav(page, baseURL, casa, "Marco");
    const s = sheet(page);
    await s.field.fill(PHRASE);
    await s.reminder("1 giorno").click();
    await s.reminder("Il giorno stesso").click();
    await expect(s.reminder("1 giorno")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await expect(s.reminder("Il giorno stesso")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await s.button("Aggiungi alle scadenze").click();

    await expect(s.dialog).toHaveCount(0);
    const toast = toastWith(page, "Aggiunta alle scadenze: Bollo auto.");
    await expect(toast).toBeVisible();
    await expect(toast.getByRole("button", { name: "Annulla" })).toBeVisible();

    const rows = await deadlinesOf(casa, "Marco");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      title: "Bollo auto",
      due_date: "2026-12-07",
      assignee_member_id: casa.members["Marco"],
      for_member_id: null,
      is_private: false,
      note: null,
    });
    expect([...rows[0]!.reminder_days].sort((a, b) => b - a)).toEqual([
      30, 7, 0,
    ]);
  });

  test("CA-30: «rinnovo carta d'identità di Sofia il 15 marzo» sceglie Scadenza e salva «riguarda» Sofia", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAddFromNav(page, baseURL, casa, "Marco");
    const s = sheet(page);
    await s.field.fill("rinnovo carta d'identità di Sofia il 15 marzo");

    await expect(s.type("Scadenza")).toHaveAttribute("aria-pressed", "true");
    await expect(labelText(page, "Sofia")).toBeVisible();
    await s.button("Aggiungi alle scadenze").click();

    await expect(toastOf(page)).toBeVisible();
    const rows = await deadlinesOf(casa, "Marco");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      title: "Rinnovo carta d'identità di Sofia",
      due_date: "2027-03-15",
      for_member_id: casa.members["Sofia"],
    });
  });

  test("CA-31: «Laura deve pagare il bollo il 7 dicembre» sceglie Scadenza e «Laura» tra chi se ne occupa", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAddFromNav(page, baseURL, casa, "Marco");
    const s = sheet(page);
    await s.field.fill("Laura deve pagare il bollo il 7 dicembre");

    await expect(s.type("Scadenza")).toHaveAttribute("aria-pressed", "true");
    await expect(s.person("Laura")).toHaveAttribute("aria-pressed", "true");
    await expect(s.person("Tu")).toHaveAttribute("aria-pressed", "false");
  });

  test("CA-32: senza data, senza titolo o con data passata la scadenza non si salva e dà l'errore giusto", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAddFromNav(page, baseURL, casa, "Marco");
    const s = sheet(page);
    await s.type("Scadenza").click();

    await s.field.fill("passaporto");
    await s.button("Aggiungi alle scadenze").click();
    await s.expectError(
      "Manca la data: scrivi per esempio «bollo auto scade il 7 dicembre».",
    );

    await s.field.fill("scade il 7 dicembre");
    await s.button("Aggiungi alle scadenze").click();
    await s.expectError(
      "Manca cosa scade: scrivi per esempio «bollo auto scade il 7 dicembre».",
    );

    await s.field.fill("passaporto scade il 1/3/2026");
    await s.button("Aggiungi alle scadenze").click();
    await s.expectError(
      "Questa data è già passata: scrivi una data da oggi in poi.",
    );

    await expect(s.dialog).toBeVisible();
    expect(await deadlinesOf(casa, "Marco")).toHaveLength(0);
  });

  test("CA-33: togliendo tutti e quattro gli avvisi la scadenza si salva senza avvisi", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAddFromNav(page, baseURL, casa, "Marco");
    const s = sheet(page);
    await s.type("Scadenza").click();
    await s.field.fill(PHRASE);
    for (const name of ["30 giorni prima", "7 giorni", "1 giorno"]) {
      await s.reminder(name).click();
    }
    await expect(s.remind.locator('[aria-pressed="true"]')).toHaveCount(0);
    await s.button("Aggiungi alle scadenze").click();

    await expect(
      toastWith(page, "Aggiunta alle scadenze: Bollo auto."),
    ).toBeVisible();
    const rows = await deadlinesOf(casa, "Marco");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.reminder_days).toEqual([]);
  });

  test("CA-34: «Annulla» nel toast toglie la scadenza appena creata", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAddFromNav(page, baseURL, casa, "Marco");
    const s = sheet(page);
    await s.field.fill(PHRASE);
    await s.button("Aggiungi alle scadenze").click();
    const toast = toastWith(page, "Aggiunta alle scadenze: Bollo auto.");
    await expect(toast).toBeVisible();
    expect(await deadlinesOf(casa, "Marco")).toHaveLength(1);

    await pauseClock(page);
    await toast.getByRole("button", { name: "Annulla" }).click();
    await expect(toastOf(page)).toHaveCount(0);
    await expect
      .poll(async () => (await deadlinesOf(casa, "Marco")).length)
      .toBe(0);
  });
});

test.describe("Aggiungi · Scadenza · «Solo io»", () => {
  test("CA-65: nella scadenza il bottone della visibilità passa a «Lo vedi solo tu» e sceglie «Tu»", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAddFromNav(page, baseURL, casa, "Marco");
    const s = sheet(page);
    await s.field.fill("Laura deve pagare il bollo il 7 dicembre");
    await expect(s.visibility).toHaveAccessibleName(SHARED);
    await expect(s.person("Laura")).toHaveAttribute("aria-pressed", "true");

    await s.visibility.click();
    await expect(s.visibility).toHaveAccessibleName(PRIVATE);
    await expect(s.person("Tu")).toHaveAttribute("aria-pressed", "true");
    await expectNames(s.who, ["Tu", "Laura", "Sofia", "Tommaso"]);
  });

  test("CA-66: la scadenza «Solo io» di Paolo è privata: Giulia non la legge e il suo indirizzo di modifica dice «non c'è più»", async ({
    page,
    browser,
    baseURL,
    bianchi,
  }, testInfo) => {
    await openAddFromNav(page, baseURL, bianchi, "Paolo");
    const s = sheet(page);
    await s.field.fill("assicurazione della casa scade il 20 gennaio");
    await s.visibility.click();
    await expect(s.visibility).toHaveAccessibleName(PRIVATE);
    await s.button("Aggiungi alle scadenze").click();
    await expect(
      toastWith(page, "Aggiunta alle scadenze: Assicurazione della casa."),
    ).toBeVisible();

    const mine = await deadlinesOf(bianchi, "Paolo");
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({
      is_private: true,
      assignee_member_id: bianchi.members["Paolo"],
    });
    expect(await deadlinesOf(bianchi, "Giulia")).toHaveLength(0);

    const giulia = await secondBrowser(
      browser,
      baseURL,
      testInfo.project.use.viewport,
    );
    try {
      await openDirect(
        giulia.page,
        baseURL,
        bianchi,
        "Giulia",
        editUrl(mine[0]!.id),
        { mode: "edit", ready: goneMessage },
      );
      await expect(
        sheet(giulia.page, "edit").dialog.getByText(GONE_TITLE, {
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        giulia.page.getByText("Assicurazione della casa"),
      ).toHaveCount(0);
    } finally {
      await giulia.context.close();
    }
  });
});

test.describe("Aggiungi · Scadenza · anteprima", () => {
  test("CA-73: la scheda mostra «Oggi» senza unità e «, urgente» solo sotto i 14 giorni", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAddFromNav(page, baseURL, casa, "Marco");
    const s = sheet(page);
    await s.type("Scadenza").click();

    await s.field.fill("bollo auto scade oggi");
    await expect(s.card.locator(".riga-scadenza__numero")).toHaveText("Oggi");
    await expect(s.card.locator(".riga-scadenza__giorni")).toHaveText(
      /^Oggi\s*,\s*urgente$/,
    );
    await expect(s.card.getByText(/urgente/)).toHaveCount(1);

    await s.field.fill("scade il 7 dicembre");
    await expect(s.card.locator(".riga-scadenza__numero")).toHaveText("48");
    await expect(s.card.getByText(/urgente/)).toHaveCount(0);

    await s.field.fill("scade il 30 ottobre");
    await expect(s.card.locator(".riga-scadenza__numero")).toHaveText("10");
    await expect(s.card.getByText(/urgente/)).toHaveCount(1);
  });
});
