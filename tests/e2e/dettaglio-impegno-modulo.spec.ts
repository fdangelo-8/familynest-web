import {
  barEditButton,
  buttonOf,
  card,
  chipOf,
  createEvent,
  createNuoto,
  editDialog,
  eventRow,
  expect,
  failRequests,
  fieldOf,
  groupOf,
  h1,
  helpOf,
  NUOTO,
  openDetail,
  openForm,
  orphanEvent,
  pressSave,
  RPC_UPDATE,
  switchTo,
  test,
  toastOf,
  confirmDialog,
  detailPath,
} from "../fixtures/impegni";

// Dettaglio impegno (#19), PR #174: il modulo «Modifica impegno», gli errori,
// il salvataggio di un impegno che non si ripete e chi può cambiare cosa
// (CA-20 – CA-34 e CA-60). Il salvataggio di un impegno che si ripete, con i
// suoi dialoghi, è in dettaglio-impegno-ripetizioni.spec.ts.

test.use({ locale: "it-IT", reducedMotion: "reduce" });
test.describe.configure({ timeout: 90_000 });

const SAVED = "Modifiche salvate";
const SAVE_FAILED =
  "Non riusciamo a salvare le modifiche. Controlla la connessione e riprova.";

// ------------------------------------------------------------------- aprire

test.describe("aprire il modulo", () => {
  test("CA-20: il modulo si apre con i valori salvati e i soli campi previsti", async ({
    page,
    baseURL,
    casa,
  }) => {
    const id = await createNuoto(casa);
    await openDetail(page, baseURL, casa, "Marco", id, "2026-10-20");
    await expect(h1(page, NUOTO)).toBeVisible();

    const mobile = (page.viewportSize()?.width ?? 0) < 1024;
    if (mobile) {
      // The pencil of the bar opens it too.
      await barEditButton(page).click();
      await expect(editDialog(page)).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(editDialog(page)).toBeHidden();
    }
    const dialog = await openForm(page);
    await expect(dialog).toHaveClass(mobile ? /\bfoglio\b/ : /\bmodale\b/);

    await expect(fieldOf(dialog, "Titolo")).toHaveValue(NUOTO);
    await expect(fieldOf(dialog, "Giorno")).toHaveValue("2026-10-20");
    await expect(fieldOf(dialog, "Dalle")).toHaveValue("17:00");
    await expect(fieldOf(dialog, "Alle")).toHaveValue("18:30");
    await expect(
      fieldOf(dialog, "Si ripete").locator("option:checked"),
    ).toHaveText("Ogni martedì e giovedì");
    await expect(fieldOf(dialog, "Dove")).toHaveValue(
      "Piscina comunale, Lissone",
    );

    const who = groupOf(dialog, "Chi").getByRole("button");
    await expect(who).toHaveCount(5);
    for (const [name, pressed] of [
      ["Tu", "false"],
      ["Laura", "false"],
      ["Sofia", "true"],
      ["Tommaso", "false"],
      ["Biscotto", "false"],
    ] as const) {
      await expect(chipOf(dialog, "Chi", name)).toHaveAttribute(
        "aria-pressed",
        pressed,
      );
    }

    const door = groupOf(dialog, "La porta").getByRole("button");
    await expect(door).toHaveCount(2);
    await expect(door.nth(0)).toHaveAccessibleName("Tu");
    await expect(door.nth(1)).toHaveAccessibleName("Laura");
    await expect(chipOf(dialog, "La porta", "Tu")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await expect(chipOf(dialog, "La porta", "Laura")).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await expect(
      groupOf(dialog, "Chi lo vede").getByRole("button", {
        name: "Tutti",
        exact: true,
      }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(fieldOf(dialog, "Note")).toHaveValue("Portare la cuffia");

    await expect(dialog.getByText("Anche su Google")).toHaveCount(0);
    await expect(
      dialog.getByText("Tutti riceveranno un avviso se cambi l'orario."),
    ).toHaveCount(0);
  });

  for (const how of ["Esc", "Chiudi"] as const) {
    test(`CA-21: ${how} chiude il modulo senza salvare, e riaprendolo ci sono i valori salvati`, async ({
      page,
      baseURL,
      casa,
    }) => {
      const id = await createNuoto(casa);
      await openDetail(page, baseURL, casa, "Marco", id, "2026-10-20");
      await expect(h1(page, NUOTO)).toBeVisible();
      const dialog = await openForm(page);
      await fieldOf(dialog, "Titolo").fill("Prova");
      if (how === "Esc") await page.keyboard.press("Escape");
      else await buttonOf(dialog, "Chiudi").click();
      await expect(editDialog(page)).toBeHidden();
      await expect(h1(page, NUOTO)).toBeVisible();

      const again = await openForm(page);
      await expect(fieldOf(again, "Titolo")).toHaveValue(NUOTO);
      expect((await eventRow(casa, id))?.title).toBe(NUOTO);
    });
  }
});

// ---------------------------------------------------- salvare senza dialogo

test.describe("salvare un impegno che non si ripete", () => {
  test("CA-24: una fine prima dell'inizio finisce il giorno dopo", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    const id = await createEvent(bianchi, "Giulia", {
      title: "Serata",
      day: "2026-10-20",
      from: "20:00",
      to: "21:00",
      members: ["Giulia"],
    });
    await openDetail(page, baseURL, bianchi, "Giulia", id, "2026-10-20");
    await expect(h1(page, "Serata")).toBeVisible();
    const dialog = await openForm(page);
    await fieldOf(dialog, "Dalle").fill("22:00");
    await fieldOf(dialog, "Alle").fill("01:00");
    await pressSave(page);
    await expect(editDialog(page)).toBeHidden();
    await expect(card(page)).toContainText("22:00 – 1:00 (mercoledì 21)");
  });

  test("CA-27: «La porta» e «Chi» di un «Tutto il Nest» di un altro si cambiano e si tolgono", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    const id = await createEvent(bianchi, "Paolo", {
      title: "Compiti",
      day: "2026-10-20",
      from: "15:00",
      to: "16:00",
      members: ["Leo"],
    });
    await openDetail(page, baseURL, bianchi, "Giulia", id, "2026-10-20");
    await expect(h1(page, "Compiti")).toBeVisible();
    let dialog = await openForm(page);
    await chipOf(dialog, "La porta", "Anna").click();
    await chipOf(dialog, "Chi", "Paolo").click();
    await pressSave(page);
    await expect(editDialog(page)).toBeHidden();
    await expect(
      card(page).getByText("La porta", { exact: true }),
    ).toBeVisible();
    await expect(
      card(page).getByRole("definition").filter({ hasText: "Anna" }),
    ).toBeVisible();
    await expect(
      card(page).getByText("Paolo e Leo", { exact: true }),
    ).toBeVisible();

    dialog = await openForm(page);
    await chipOf(dialog, "La porta", "Anna").click();
    await pressSave(page);
    await expect(editDialog(page)).toBeHidden();
    await expect(card(page).getByText("La porta", { exact: true })).toHaveCount(
      0,
    );
  });

  test("CA-32: se il salvataggio fallisce il modulo resta aperto, e si riprova", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    const id = await createEvent(bianchi, "Giulia", {
      title: "Parrucchiere",
      day: "2026-10-23",
      from: "10:00",
      to: "11:00",
      members: ["Giulia"],
    });
    await openDetail(page, baseURL, bianchi, "Giulia", id, "2026-10-23");
    await expect(h1(page, "Parrucchiere")).toBeVisible();
    const dialog = await openForm(page);
    await fieldOf(dialog, "Titolo").fill("Prova");
    await failRequests(page, RPC_UPDATE);
    await pressSave(page);
    await expect(
      dialog.getByRole("alert").filter({ hasText: SAVE_FAILED }),
    ).toBeVisible();
    await expect(editDialog(page)).toBeVisible();
    await expect(fieldOf(dialog, "Titolo")).toHaveValue("Prova");
    await expect(toastOf(page, SAVED)).toHaveCount(0);
    expect((await eventRow(bianchi, id))?.title).toBe("Parrucchiere");

    await page.unroute(RPC_UPDATE);
    await pressSave(page);
    await expect(editDialog(page)).toBeHidden();
    await expect(h1(page, "Prova")).toBeVisible();
    await expect(toastOf(page, SAVED)).toBeVisible();
  });
});

// ------------------------------------------------------- errori del modulo

test.describe("errori del modulo", () => {
  for (const [label, value] of [
    ["vuoto", ""],
    ["fatto di soli spazi", "   "],
  ] as const) {
    test(`CA-28: un titolo ${label} dà l'errore sotto il campo e non salva`, async ({
      page,
      baseURL,
      casa,
    }) => {
      const id = await createNuoto(casa);
      await openDetail(page, baseURL, casa, "Marco", id, "2026-10-20");
      await expect(h1(page, NUOTO)).toBeVisible();
      const dialog = await openForm(page);
      const title = fieldOf(dialog, "Titolo");
      await title.fill(value);
      await pressSave(page);
      await expect(
        dialog.getByText("Scrivi il titolo dell'impegno."),
      ).toBeVisible();
      await expect(title).toHaveAttribute("aria-invalid", "true");
      await expect(title).toBeFocused();
      await expect(editDialog(page)).toBeVisible();
      await expect(confirmDialog(page)).toHaveCount(0);

      await buttonOf(dialog, "Chiudi").click();
      await expect(editDialog(page)).toBeHidden();
      await page.reload();
      await expect(h1(page, NUOTO)).toBeVisible();
    });
  }

  test("CA-29: i campi di testo si fermano a 100, 100 e 500 caratteri", async ({
    page,
    baseURL,
    casa,
  }) => {
    const id = await createNuoto(casa);
    await openDetail(page, baseURL, casa, "Marco", id, "2026-10-06");
    await expect(h1(page, NUOTO)).toBeVisible();
    const dialog = await openForm(page);
    const typed = async (label: string, length: number) => {
      const field = fieldOf(dialog, label);
      await field.fill("");
      await field.pressSequentially("a".repeat(length));
      return field;
    };
    const title = await typed("Titolo", 101);
    const place = await typed("Dove", 101);
    const notes = await typed("Note", 501);
    expect((await title.inputValue()).length).toBe(100);
    expect((await place.inputValue()).length).toBe(100);
    expect((await notes.inputValue()).length).toBe(500);

    await pressSave(page);
    await buttonOf(confirmDialog(page), "Salva tutti i prossimi").click();
    await expect(editDialog(page)).toBeHidden();
    await expect(h1(page, "a".repeat(100))).toBeVisible();
  });

  test("CA-30: «Alle» uguale a «Dalle» e nessuna persona danno errore e non salvano", async ({
    page,
    baseURL,
    casa,
  }) => {
    const id = await createNuoto(casa);
    const before = await eventRow(casa, id);
    await openDetail(page, baseURL, casa, "Marco", id, "2026-10-20");
    await expect(h1(page, NUOTO)).toBeVisible();
    const dialog = await openForm(page);

    await fieldOf(dialog, "Titolo").fill("Prova");
    await fieldOf(dialog, "Alle").fill("17:00");
    await pressSave(page);
    await expect(
      dialog.getByText("L'ora di fine deve essere diversa da quella d'inizio."),
    ).toBeVisible();
    await expect(fieldOf(dialog, "Alle")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(confirmDialog(page)).toHaveCount(0);

    await fieldOf(dialog, "Alle").fill("18:30");
    await chipOf(dialog, "Chi", "Sofia").click();
    await expect(chipOf(dialog, "Chi", "Sofia")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await pressSave(page);
    await expect(dialog.getByText("Scegli almeno una persona.")).toBeVisible();
    await expect(confirmDialog(page)).toHaveCount(0);
    await expect(editDialog(page)).toBeVisible();

    const after = await eventRow(casa, id);
    expect(after?.title).toBe(NUOTO);
    expect(after?.starts_at).toBe(before?.starts_at);
    expect(after?.ends_at).toBe(before?.ends_at);
    await expect(toastOf(page, SAVED)).toHaveCount(0);
  });

  test("CA-30: «Dalle» e «Alle» vuoti dicono quale ora manca", async ({
    page,
    baseURL,
    casa,
  }) => {
    const id = await createNuoto(casa);
    await openDetail(page, baseURL, casa, "Marco", id, "2026-10-20");
    await expect(h1(page, NUOTO)).toBeVisible();
    const dialog = await openForm(page);
    await fieldOf(dialog, "Dalle").fill("");
    await fieldOf(dialog, "Alle").fill("");
    await pressSave(page);
    await expect(dialog.getByText("Scegli l'ora d'inizio.")).toBeVisible();
    await expect(dialog.getByText("Scegli l'ora di fine.")).toBeVisible();
    await expect(confirmDialog(page)).toHaveCount(0);
    await expect(fieldOf(dialog, "Dalle")).toBeFocused();
  });

  // The CA writes 10:00 on Tuesday 20 to 10:00 on Wednesday 28, but with the same
  // hour in «Dalle» and «Alle» the form refuses first (CA-30, requirement 5.3:
  // «Alle» must differ from «Dalle»), so the 7-day message cannot show. The
  // test keeps the 8 days and ends at 11:00: see the outcome on the PR.
  test("CA-31: un impegno più lungo di 7 giorni non può ripetersi", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    const id = await createEvent(bianchi, "Giulia", {
      title: "Viaggio",
      day: "2026-10-20",
      from: "10:00",
      to: "11:00",
      endDay: "2026-10-28",
      members: ["Giulia"],
    });
    await openDetail(page, baseURL, bianchi, "Giulia", id, "2026-10-20");
    await expect(h1(page, "Viaggio")).toBeVisible();
    const dialog = await openForm(page);
    await fieldOf(dialog, "Si ripete").selectOption({
      label: "Ogni settimana",
    });
    await pressSave(page);
    await expect(
      dialog.getByText(
        "Un impegno che si ripete può durare al massimo 7 giorni.",
      ),
    ).toBeVisible();
    await expect(fieldOf(dialog, "Si ripete")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(editDialog(page)).toBeVisible();

    await page.reload();
    await expect(h1(page, "Viaggio")).toBeVisible();
    await expect(card(page).getByText("Ripete", { exact: true })).toHaveCount(
      0,
    );
    expect((await eventRow(bianchi, id))?.recurrence).toBe("none");
  });
});

// --------------------------------------------------- chi può cambiare cosa

test.describe("chi può cambiare cosa", () => {
  test("CA-33: chi non ha creato un «Tutto il Nest» non cambia «Chi lo vede»; l'autore sì", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    const id = await createEvent(bianchi, "Paolo", {
      title: "Pranzo da nonna",
      day: "2026-10-25",
      from: "12:30",
      to: "14:30",
      members: ["Leo"],
    });
    await openDetail(page, baseURL, bianchi, "Giulia", id, "2026-10-25");
    await expect(h1(page, "Pranzo da nonna")).toBeVisible();
    let dialog = await openForm(page);
    const visibility = groupOf(dialog, "Chi lo vede");
    await expect(
      visibility.getByRole("button", { name: "Tutti", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    for (const name of ["Solo io", "Occupato", "Tutti"]) {
      await expect(
        visibility.getByRole("button", { name, exact: true }),
      ).toBeDisabled();
    }
    const help = await helpOf(dialog, "Chi lo vede");
    await expect(help).toHaveCount(1);
    await expect(help).toHaveText(
      "Lo vede tutto il Nest. Lo decide Paolo, che l'ha creato.",
    );
    await expect(help).not.toHaveAttribute("aria-live", /.+/);
    // One paragraph, not two.
    await expect(
      visibility.locator("xpath=..").getByRole("paragraph"),
    ).toHaveCount(1);

    await switchTo(page, baseURL, bianchi, "Paolo");
    await page.goto(detailPath(id, "2026-10-25"));
    await expect(h1(page, "Pranzo da nonna")).toBeVisible();
    dialog = await openForm(page);
    await chipOf(dialog, "Chi lo vede", "Occupato").click();
    await pressSave(page);
    await expect(editDialog(page)).toBeHidden();
    await expect(confirmDialog(page)).toHaveCount(0);
    await expect(
      card(page).getByRole("definition").filter({ hasText: "Occupato" }),
    ).toBeVisible();

    await switchTo(page, baseURL, bianchi, "Giulia");
    await page.goto(detailPath(id, "2026-10-25"));
    await expect(h1(page, "Questo impegno non c'è più")).toBeVisible();
  });

  test("CA-33: se chi l'ha creato non è più nel Nest, la frase lo dice e resta così", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    const id = await createEvent(bianchi, "Paolo", {
      title: "Gita al lago",
      day: "2026-10-25",
      from: "10:00",
      to: "17:00",
      members: ["Leo"],
    });
    await orphanEvent(bianchi, "Paolo");
    await openDetail(page, baseURL, bianchi, "Giulia", id, "2026-10-25");
    await expect(h1(page, "Gita al lago")).toBeVisible();
    const dialog = await openForm(page);
    const visibility = groupOf(dialog, "Chi lo vede");
    for (const name of ["Solo io", "Occupato", "Tutti"]) {
      await expect(
        visibility.getByRole("button", { name, exact: true }),
      ).toBeDisabled();
    }
    const help = await helpOf(dialog, "Chi lo vede");
    await expect(help).toHaveText(
      "Lo vede tutto il Nest. Chi l'ha creato non è più nel Nest: resta così.",
    );
    await expect(help).not.toHaveAttribute("aria-live", /.+/);
  });

  test("CA-34: su un «Occupato» di un altro «Chi» e «La porta» sono bloccati, ma il titolo si cambia", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    const id = await createEvent(bianchi, "Paolo", {
      title: "Riunione",
      day: "2026-10-20",
      from: "14:00",
      to: "15:00",
      visibility: "busy",
      members: ["Paolo", "Giulia"],
    });
    await openDetail(page, baseURL, bianchi, "Giulia", id, "2026-10-20");
    await expect(h1(page, "Riunione")).toBeVisible();
    const dialog = await openForm(page);
    for (const group of ["Chi", "La porta"]) {
      const chips = groupOf(dialog, group).getByRole("button");
      expect(await chips.count()).toBeGreaterThan(0);
      for (const chip of await chips.all()) await expect(chip).toBeDisabled();
    }
    await expect(
      dialog.getByText("Le persone le sceglie Paolo, che l'ha creato."),
    ).toBeVisible();
    await expect(await helpOf(dialog, "Chi lo vede")).toHaveText(
      "Gli altri vedono solo che c'è un impegno, senza dettagli. Lo decide Paolo, che l'ha creato.",
    );

    await fieldOf(dialog, "Titolo").fill("Riunione spostata");
    await pressSave(page);
    await expect(editDialog(page)).toBeHidden();
    await expect(h1(page, "Riunione spostata")).toBeVisible();
  });
});

// -------------------------------------------------- «Chi lo vede» e la frase

test.describe("la frase sotto «Chi lo vede»", () => {
  test("CA-60: la frase cambia con la voce scelta ed è collegata al gruppo", async ({
    page,
    baseURL,
    casa,
  }) => {
    const id = await createNuoto(casa);
    await openDetail(page, baseURL, casa, "Marco", id, "2026-10-20");
    await expect(h1(page, NUOTO)).toBeVisible();
    const dialog = await openForm(page);
    const help = await helpOf(dialog, "Chi lo vede");
    await expect(help).toHaveText("Lo vede tutto il Nest.");
    await expect(help).toHaveAttribute("aria-live", "polite");

    await chipOf(dialog, "Chi lo vede", "Occupato").click();
    await expect(help).toHaveText("Gli altri vedono solo che sei occupato.");
    await chipOf(dialog, "Chi lo vede", "Solo io").click();
    await expect(help).toHaveText("Lo vedi solo tu e chi partecipa.");
  });

  test("CA-60: per chi non è l'autore le frasi sono quelle ricavate, collegate al gruppo", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    const id = await createEvent(bianchi, "Paolo", {
      title: "Appuntamento",
      day: "2026-10-20",
      from: "09:00",
      to: "10:00",
      visibility: "private",
      members: ["Paolo", "Giulia"],
    });
    await openDetail(page, baseURL, bianchi, "Giulia", id, "2026-10-20");
    await expect(h1(page, "Appuntamento")).toBeVisible();
    const dialog = await openForm(page);
    const help = await helpOf(dialog, "Chi lo vede");
    await expect(help).toHaveText(
      "Lo vede solo chi l'ha creato e chi partecipa. Lo decide Paolo, che l'ha creato.",
    );
    await expect(help).not.toHaveAttribute("aria-live", /.+/);
  });
});
