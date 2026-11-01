import { expect, isMobileProject, test } from "../fixtures/casa";
import {
  SAVE_FAILED_ALERT,
  deadlinesOf,
  editUrl,
  expectNames,
  expectPreview,
  holdRequests,
  openAddFromNav,
  openCasaPage,
  openDirect,
  refuseWrites,
  seedDeadline,
  shoppingOf,
  sheet,
  sideOf,
  todosOf,
  toastOf,
  toastWith,
  tapRowTitle,
  waitForSheet,
} from "../fixtures/aggiungi-casa";

// Aggiungi · parti comuni a Spesa, Da fare e Scadenza (#22): «Più dettagli» e
// «Tutti i dettagli» assenti (CA-48, CA-49), esempi (CA-50), salvataggio lento o
// rifiutato (CA-51, CA-52), apertura con il tipo già scelto (CA-53, CA-56),
// indirizzo senza testo (CA-54), testo d'esempio del campo (CA-56 ... CA-58)
// e stato vuoto. The browser clock is fixed at Tuesday 20 October 2026, 15:52 in
// Rome ([OR]). Every test builds its own throwaway Nests.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

const PHRASES = [
  "latte e pane",
  "Laura deve chiamare la nonna",
  "bollo auto scade il 7 dicembre",
];

test.describe("Aggiungi · parti comuni", () => {
  test("CA-48: su desktop nessuno dei tre tipi ha «Tutti i dettagli» e gli esempi a destra non nominano il pediatra", async ({
    page,
    baseURL,
    casa,
  }) => {
    test.skip(isMobileProject(), "Caso a 1280 px: la modale con gli esempi");
    await openAddFromNav(page, baseURL, casa, "Marco");
    const s = sheet(page);
    for (const phrase of PHRASES) {
      await s.field.fill(phrase);
      await expect(s.button(/^(Aggiungi|Dai a )/)).toBeVisible();
      await expect(s.button("Tutti i dettagli")).toHaveCount(0);
      await expect(s.dialog.getByText("Tutti i dettagli")).toHaveCount(0);
    }
    const side = sideOf(page);
    await expect(side.getByText("Esempi", { exact: true })).toBeVisible();
    await expect(side.getByRole("button", { name: /pediatra/i })).toHaveCount(
      0,
    );
    await expect(
      side.getByRole("button", { name: "Laura deve chiamare la nonna" }),
    ).toBeVisible();
    await expect(side.getByText(/pediatra/i)).toHaveCount(0);
  });

  test("CA-49: su mobile nessuno dei tre tipi ha «Più dettagli»", async ({
    page,
    baseURL,
    casa,
  }) => {
    test.skip(!isMobileProject(), "Caso a 390 px: il foglio dal basso");
    await openAddFromNav(page, baseURL, casa, "Marco");
    const s = sheet(page);
    for (const phrase of PHRASES) {
      await s.field.fill(phrase);
      await expect(s.button(/^(Aggiungi|Dai a )/)).toBeVisible();
      await expect(s.button("Più dettagli")).toHaveCount(0);
      await expect(s.dialog.getByText("Più dettagli")).toHaveCount(0);
    }
  });

  test("CA-50: toccare gli esempi «latte e pane» e «bollo auto scade il 7 dicembre» sceglie Spesa e Scadenza", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAddFromNav(page, baseURL, casa, "Marco");
    const s = sheet(page);
    const examples = s.dialog.getByRole("group", { name: "Esempi" });

    await examples.getByRole("button", { name: "latte e pane" }).click();
    await expect(s.type("Spesa")).toHaveAttribute("aria-pressed", "true");
    await expectPreview(page, [{ name: "Latte" }, { name: "Pane" }]);

    // On mobile the examples come back with the empty field.
    await s.field.fill("");
    await examples
      .getByRole("button", { name: "bollo auto scade il 7 dicembre" })
      .click();
    await expect(s.type("Scadenza")).toHaveAttribute("aria-pressed", "true");
  });

  test("CA-51: con il salvataggio lento il secondo tocco non crea due cose e il bottone ha «aria-busy»", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAddFromNav(page, baseURL, casa, "Marco");
    const s = sheet(page);
    await s.field.fill("Laura deve chiamare la nonna");
    const hold = await holdRequests(page, "todos", "POST");

    const submit = s.button("Dai a Laura");
    await submit.click();
    await expect(submit).toHaveAttribute("aria-busy", "true");
    // Second touch (the button is disabled while it waits: Playwright would wait).
    await submit.click({ force: true });
    await expect(submit).toHaveAttribute("aria-busy", "true");
    await expect(s.dialog).toBeVisible();

    hold.release();
    await expect(s.dialog).toHaveCount(0);
    await expect(
      toastWith(page, "Dato a Laura: Chiamare la nonna."),
    ).toBeVisible();
    expect(await todosOf(casa, "Marco")).toHaveLength(1);
    expect(hold.calls()).toBe(1);
  });

  test("CA-52: Spesa, salvataggio rifiutato: il foglio resta con il testo, c'è l'avviso nel foglio e non c'è il toast", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAddFromNav(page, baseURL, casa, "Marco");
    const s = sheet(page);
    await s.field.fill("latte e pane");
    await refuseWrites(page, "shopping_items", "POST");
    await s.button("Aggiungi 2 cose").click();

    await expect(
      s.dialog.getByRole("alert").filter({ hasText: SAVE_FAILED_ALERT }),
    ).toBeVisible();
    await expect(s.field).toHaveValue("latte e pane");
    await expect(s.type("Spesa")).toHaveAttribute("aria-pressed", "true");
    await expect(toastOf(page)).toHaveCount(0);
    expect(await shoppingOf(casa, "Marco")).toHaveLength(0);
  });

  test("CA-52: Da fare, salvataggio rifiutato: il foglio resta con il testo e le scelte e non c'è il toast", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAddFromNav(page, baseURL, casa, "Marco");
    const s = sheet(page);
    await s.field.fill("Laura deve chiamare la nonna");
    await expect(s.person("Laura")).toHaveAttribute("aria-pressed", "true");
    await refuseWrites(page, "todos", "POST");
    await s.button("Dai a Laura").click();

    await expect(
      s.dialog.getByRole("alert").filter({ hasText: SAVE_FAILED_ALERT }),
    ).toBeVisible();
    await expect(s.field).toHaveValue("Laura deve chiamare la nonna");
    await expect(s.person("Laura")).toHaveAttribute("aria-pressed", "true");
    await expect(toastOf(page)).toHaveCount(0);
    expect(await todosOf(casa, "Marco")).toHaveLength(0);
  });

  test("CA-52: Scadenza, salvataggio rifiutato: il foglio resta con il testo e gli avvisi scelti e non c'è il toast", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAddFromNav(page, baseURL, casa, "Marco");
    const s = sheet(page);
    await s.field.fill("bollo auto scade il 7 dicembre");
    await s.reminder("7 giorni").click();
    await refuseWrites(page, "deadlines", "POST");
    await s.button("Aggiungi alle scadenze").click();

    await expect(
      s.dialog.getByRole("alert").filter({ hasText: SAVE_FAILED_ALERT }),
    ).toBeVisible();
    await expect(s.field).toHaveValue("bollo auto scade il 7 dicembre");
    await expect(s.reminder("7 giorni")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await expect(s.reminder("30 giorni prima")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(toastOf(page)).toHaveCount(0);
    expect(await deadlinesOf(casa, "Marco")).toHaveLength(0);
  });

  test("CA-53: «Aggiungi una cosa da fare» di una Casa senza cose apre Aggiungi con «Da fare» scelto e il campo vuoto", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openCasaPage(page, baseURL, casa, "Marco", "/casa/da-fare");
    const link = page.getByRole("link", {
      name: "Aggiungi una cosa da fare",
      exact: true,
    });
    await expect(link).toBeVisible();
    const s = sheet(page);
    await expect(async () => {
      await link.click();
      await expect(s.dialog).toBeVisible({ timeout: 2000 });
    }).toPass();
    await waitForSheet(page);

    await expect(s.type("Da fare")).toHaveAttribute("aria-pressed", "true");
    await expect(s.type("Impegno")).toHaveAttribute("aria-pressed", "false");
    await expect(s.field).toHaveValue("");
  });

  test("CA-54: l'indirizzo non contiene mai il testo scritto; quello di modifica contiene solo l'identificativo", async ({
    page,
    baseURL,
    casa,
  }) => {
    const seen: string[] = [];
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) seen.push(frame.url());
    });
    await openAddFromNav(page, baseURL, casa, "Marco");
    seen.push(page.url());
    const s = sheet(page);
    await s.field.fill("Laura deve chiamare la nonna entro venerdì");
    seen.push(page.url());
    await s.button("Dai a Laura").click();
    await expect(
      toastWith(page, "Dato a Laura: Chiamare la nonna."),
    ).toBeVisible();
    seen.push(page.url());

    const [todo] = await todosOf(casa, "Marco");
    await page.goto("/casa/da-fare");
    await tapRowTitle(page, "Chiamare la nonna");
    seen.push(page.url());

    for (const url of seen) {
      expect(decodeURIComponent(url)).not.toMatch(/nonna|laura|chiamare/i);
    }
    // The address of the edit sheet carries the id and nothing else.
    const edit = new URL(page.url());
    expect(edit.searchParams.get("modifica")).toBe(todo!.id);
    // Only the id and the kind (`tipo=da-fare`) travel, never a title.
    expect([...edit.searchParams.keys()].sort()).toEqual(
      expect.arrayContaining(["modifica"]),
    );
    for (const key of edit.searchParams.keys()) {
      expect(["modifica", "tipo"]).toContain(key);
    }
  });
});

test.describe("Aggiungi · testo d'esempio del campo", () => {
  test("CA-56: /aggiungi?tipo=… apre il tipo scelto con il testo d'esempio giusto e il nome «Cosa vuoi aggiungere?»", async ({
    page,
    baseURL,
    casa,
  }) => {
    const cases: [string, string, string][] = [
      ["spesa", "Spesa", "Cosa manca in casa?"],
      ["da-fare", "Da fare", "Cosa c'è da fare?"],
      ["scadenza", "Scadenza", "Cosa scade, e quando?"],
    ];
    await openDirect(
      page,
      baseURL,
      casa,
      "Marco",
      `/aggiungi?tipo=${cases[0]![0]}`,
    );
    for (const [index, [tipo, type, placeholder]] of cases.entries()) {
      if (index > 0) {
        await page.goto(`/aggiungi?tipo=${tipo}`);
        await waitForSheet(page);
      }
      const s = sheet(page);
      await expect(
        s.type(type as "Spesa" | "Da fare" | "Scadenza"),
      ).toHaveAttribute("aria-pressed", "true");
      // `s.field` is found by its accessible name: the label stays.
      await expect(s.field).toHaveAttribute("placeholder", placeholder);
      await expect(s.field).toHaveValue("");
    }
  });

  test("CA-57: cambiare tipo a mano con il campo vuoto cambia il testo d'esempio; con del testo il testo non cambia", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAddFromNav(page, baseURL, casa, "Marco");
    const s = sheet(page);
    await s.type("Scadenza").click();
    await expect(s.field).toHaveAttribute(
      "placeholder",
      "Cosa scade, e quando?",
    );
    await s.type("Spesa").click();
    await expect(s.field).toHaveAttribute("placeholder", "Cosa manca in casa?");

    await s.field.fill("latte");
    await s.type("Da fare").click();
    await expect(s.field).toHaveValue("latte");
  });

  test("CA-58: in modifica, svuotando il campo, il testo d'esempio è quello del tipo", async ({
    page,
    baseURL,
    casa,
  }) => {
    const deadline = await seedDeadline(casa, "Marco", {
      title: "Bollo auto",
      due: "2026-12-07",
      assignee: "Marco",
    });
    const todo = await casa.todo("Marco", { title: "Chiamare la nonna" });

    await openDirect(page, baseURL, casa, "Marco", editUrl(deadline), {
      mode: "edit",
    });
    const s = sheet(page, "edit");
    await s.field.fill("");
    await expect(s.field).toHaveAttribute(
      "placeholder",
      "Cosa scade, e quando?",
    );

    await page.goto(editUrl(todo));
    await waitForSheet(page, "edit");
    await s.field.fill("");
    await expect(s.field).toHaveAttribute("placeholder", "Cosa c'è da fare?");
  });

  test("CA-4: stato vuoto di ogni tipo: nessun blocco, nessuna persona né avviso, «Aggiungi» disabilitato", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAddFromNav(page, baseURL, casa, "Marco");
    const s = sheet(page);
    for (const type of ["Da fare", "Spesa", "Scadenza"] as const) {
      await s.type(type).click();
      await expect(s.type(type)).toHaveAttribute("aria-pressed", "true");
      await expect(s.button("Aggiungi")).toBeDisabled();
      await expect(s.who).toHaveCount(0);
      await expect(s.remind).toHaveCount(0);
      await expect(s.list).toHaveCount(0);
      await expect(s.card).toHaveCount(0);
    }
    // The persons of the Nest appear only once there is a text.
    await s.type("Da fare").click();
    await s.field.fill("Laura deve chiamare la nonna");
    await expectNames(s.who, ["Tu", "Laura", "Sofia", "Tommaso"]);
  });
});
