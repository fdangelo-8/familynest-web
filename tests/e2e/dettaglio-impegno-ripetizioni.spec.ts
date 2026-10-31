import type { Page } from "@playwright/test";
import {
  buttonOf,
  card,
  changeOccurrence,
  chipOf,
  confirmDialog,
  createEvent,
  createNuoto,
  detailPath,
  editDialog,
  eventRow,
  exceptionCount,
  expect,
  fieldOf,
  h1,
  holdRequests,
  instant,
  NUOTO,
  openDetail,
  openForm,
  pressSave,
  removeOccurrence,
  removeParticipant,
  RPC_UPDATE,
  RPC_UPDATE_ALL,
  RPC_UPDATE_ONE,
  savedAs,
  switchTo,
  test,
  textRx,
  toastOf,
  writeRequest,
  type CasaNest,
} from "../fixtures/impegni";

// Dettaglio impegno (#19), PR #174: salvare un impegno che si ripete. Il
// dialogo «Solo questo / Tutti i prossimi» e i suoi testi, il suo
// funzionamento e i suoi errori (CA-22, 23, 25, 25b, 26 e CA-47 – CA-59), più
// il caso trovato dal revisore: una serie del solo lunedì con una volta
// spostata da sola, salvata con «Salva tutti i prossimi».

test.use({ locale: "it-IT", reducedMotion: "reduce" });
test.describe.configure({ timeout: 90_000 });

const SAVED = "Modifiche salvate";
const SAVE_FAILED =
  "Non riusciamo a salvare le modifiche. Controlla la connessione e riprova.";
const NOT_ANYMORE = "Questo impegno non c'è più";
const ALL = "Salva tutti i prossimi";
const ONLY = "Salva solo questo";
const NUOTO_RULE = "Si ripete ogni martedì e giovedì.";
const AFTER_TEXT =
  "Puoi cambiare solo giovedì 22 ottobre oppure anche tutte le volte dopo, comprese quelle già cambiate a parte.";
const BEFORE_TEXT = "Le volte prima restano come sono.";
const SAME_TITLE = /^Nuoto$/;

/** The «Nuoto» of Marco, opened on that day. */
async function openNuoto(
  page: Page,
  baseURL: string | undefined,
  casa: CasaNest,
  day: string,
) {
  const id = await createNuoto(casa);
  await openDetail(page, baseURL, casa, "Marco", id, day);
  await expect(h1(page, NUOTO)).toBeVisible();
  return id;
}

/** Changes the title of the Nuoto and touches «Salva le modifiche». */
async function askToSaveTitle(page: Page, title = "Nuoto") {
  const dialog = await openForm(page);
  await fieldOf(dialog, "Titolo").fill(title);
  await pressSave(page);
  const confirm = confirmDialog(page);
  await expect(confirm).toBeVisible();
  return { dialog, confirm };
}

const urlOf = (id: string, day: string) =>
  new RegExp(`/impegni/${id}\\?giorno=${day}$`);

// ------------------------------------------------------ tutte le volte (CA-22…)

test.describe("salvare tutti i prossimi", () => {
  test("CA-22: dalla prima volta, titolo, luogo e note cambiano tutta la serie", async ({
    page,
    baseURL,
    casa,
  }) => {
    const id = await openNuoto(page, baseURL, casa, "2026-10-06");
    const dialog = await openForm(page);
    await fieldOf(dialog, "Titolo").fill("Nuoto");
    await fieldOf(dialog, "Dove").fill("Piscina Lissone");
    await fieldOf(dialog, "Note").fill("Portare cuffia e occhialini");
    await pressSave(page);
    await buttonOf(confirmDialog(page), ALL).click();

    await expect(editDialog(page)).toBeHidden();
    await expect(confirmDialog(page)).toHaveCount(0);
    await expect(toastOf(page, SAVED)).toBeVisible();
    await expect(h1(page, SAME_TITLE)).toBeVisible();
    await expect(card(page)).toContainText("Piscina Lissone");
    await expect(card(page)).toContainText("Portare cuffia e occhialini");
    await expect(page).toHaveURL(urlOf(id, "2026-10-06"));

    await page.reload();
    await expect(h1(page, SAME_TITLE)).toBeVisible();
    await expect(card(page)).toContainText("Piscina Lissone");
    await expect(card(page)).toContainText("Portare cuffia e occhialini");
    await expect(page).toHaveURL(urlOf(id, "2026-10-06"));

    await page.goto(detailPath(id, "2026-10-22"));
    await expect(h1(page, SAME_TITLE)).toBeVisible();
  });

  test("CA-23: le ore nuove valgono per tutta la serie", async ({
    page,
    baseURL,
    casa,
  }) => {
    const id = await openNuoto(page, baseURL, casa, "2026-10-06");
    const dialog = await openForm(page);
    await fieldOf(dialog, "Dalle").fill("17:30");
    await fieldOf(dialog, "Alle").fill("19:00");
    await pressSave(page);
    await buttonOf(confirmDialog(page), ALL).click();
    await expect(editDialog(page)).toBeHidden();
    await expect(card(page)).toContainText("17:30 – 19:00");

    for (const day of ["2026-10-20", "2026-10-22"]) {
      await page.goto(detailPath(id, day));
      await expect(h1(page, NUOTO)).toBeVisible();
      await expect(card(page)).toContainText("17:30 – 19:00");
    }
  });

  test("CA-25: cambiare il giorno sposta la serie e dà un id nuovo", async ({
    page,
    baseURL,
    casa,
  }) => {
    const id = await openNuoto(page, baseURL, casa, "2026-10-20");
    const dialog = await openForm(page);
    await fieldOf(dialog, "Giorno").fill("2026-10-21");
    await pressSave(page);
    const saved = await savedAs(page, () =>
      buttonOf(confirmDialog(page), ALL).click(),
    );
    expect(saved.day).toBe("2026-10-21");

    await expect(editDialog(page)).toBeHidden();
    await expect(page).toHaveURL(urlOf(saved.id, "2026-10-21"));
    await expect(card(page)).toContainText(
      textRx("Mercoledì 21 ottobre", false),
    );
    await expect(
      card(page).getByText("Ogni mercoledì e venerdì"),
    ).toBeVisible();

    await page.goto(detailPath(saved.id, "2026-10-23"));
    await expect(h1(page, NUOTO)).toBeVisible();
    await expect(card(page)).toContainText(textRx("Venerdì 23 ottobre", false));

    await page.goto(detailPath(id, "2026-10-15"));
    await expect(h1(page, NUOTO)).toBeVisible();
    await expect(card(page)).toContainText(textRx("Giovedì 15 ottobre", false));

    await page.goto(detailPath(id, "2026-10-20"));
    await expect(h1(page, NOT_ANYMORE)).toBeVisible();
  });

  test("CA-25b: «Salva solo questo» sposta una volta sola e lo dice nella scheda", async ({
    page,
    baseURL,
    casa,
  }) => {
    const id = await openNuoto(page, baseURL, casa, "2026-10-20");
    const dialog = await openForm(page);
    await fieldOf(dialog, "Giorno").fill("2026-10-21");
    await pressSave(page);
    await buttonOf(confirmDialog(page), ONLY).click();

    await expect(editDialog(page)).toBeHidden();
    await expect(page).toHaveURL(urlOf(id, "2026-10-21"));
    await expect(card(page)).toContainText(
      textRx("Mercoledì 21 ottobre", false),
    );
    await expect(
      card(page).getByText(
        "Ogni martedì e giovedì, questa volta con modifiche",
      ),
    ).toBeVisible();

    await page.goto(detailPath(id, "2026-10-22"));
    await expect(h1(page, NUOTO)).toBeVisible();
    await expect(card(page)).toContainText(textRx("Giovedì 22 ottobre", false));
    await expect(
      card(page).getByText("Ogni martedì e giovedì", { exact: true }),
    ).toBeVisible();
    await expect(
      card(page).getByText(/questa volta con modifiche/),
    ).toHaveCount(0);
  });

  test("CA-26: «Mai» tiene solo questa volta; poi «Ogni settimana» la ripete nel suo giorno", async ({
    page,
    baseURL,
    casa,
  }) => {
    const id = await openNuoto(page, baseURL, casa, "2026-10-22");
    let dialog = await openForm(page);
    await fieldOf(dialog, "Si ripete").selectOption({ label: "Mai" });
    await pressSave(page);
    const confirm = confirmDialog(page);
    await expect(confirm).toHaveAccessibleDescription(
      textRx(
        `${NUOTO_RULE} Con «Mai» resta solo giovedì 22 ottobre: le volte dopo spariscono dal calendario. ${BEFORE_TEXT}`,
      ),
    );
    await expect(confirm.getByRole("button")).toHaveText([ALL, "Annulla"]);
    const saved = await savedAs(page, () => buttonOf(confirm, ALL).click());
    expect(saved.day).toBe("2026-10-22");

    await expect(editDialog(page)).toBeHidden();
    await expect(page).toHaveURL(urlOf(saved.id, "2026-10-22"));
    await expect(card(page).getByText("Ripete", { exact: true })).toHaveCount(
      0,
    );

    await page.goto(detailPath(id, "2026-10-20"));
    await expect(h1(page, NUOTO)).toBeVisible();
    await page.goto(detailPath(id, "2026-10-27"));
    await expect(h1(page, NOT_ANYMORE)).toBeVisible();

    // Now it does not repeat: no dialog.
    await page.goto(detailPath(saved.id, saved.day));
    await expect(h1(page, NUOTO)).toBeVisible();
    dialog = await openForm(page);
    await fieldOf(dialog, "Si ripete").selectOption({
      label: "Ogni settimana",
    });
    await pressSave(page);
    await expect(editDialog(page)).toBeHidden();
    await expect(confirmDialog(page)).toHaveCount(0);
    await expect(
      card(page).getByText("Ogni giovedì", { exact: true }),
    ).toBeVisible();
  });
});

// ------------------------------------------------- il dialogo del salvataggio

test.describe("il dialogo del salvataggio", () => {
  test("CA-47: con due scelte il dialogo sta sopra il modulo, con i testi e il fuoco su «Annulla»", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openNuoto(page, baseURL, casa, "2026-10-22");
    const { confirm } = await askToSaveTitle(page);
    await expect(confirm).toHaveAccessibleName(
      "Salvare le modifiche a «Nuoto Sofia»?",
    );
    await expect(confirm).toHaveAccessibleDescription(
      textRx(`${NUOTO_RULE} ${AFTER_TEXT} ${BEFORE_TEXT}`),
    );
    await expect(confirm.getByRole("button")).toHaveText([
      ALL,
      ONLY,
      "Annulla",
    ]);
    await expect(buttonOf(confirm, "Annulla")).toBeFocused();
    await expect(editDialog(page)).toBeVisible();
  });

  test("CA-47: dalla prima volta il testo non dice «Le volte prima restano come sono.»", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openNuoto(page, baseURL, casa, "2026-10-06");
    const { confirm } = await askToSaveTitle(page);
    await expect(confirm).toHaveAccessibleDescription(
      textRx(
        `${NUOTO_RULE} Puoi cambiare solo martedì 6 ottobre oppure anche tutte le volte dopo, comprese quelle già cambiate a parte.`,
      ),
    );
  });

  test("CA-48: «Salva solo questo» cambia una volta sola", async ({
    page,
    baseURL,
    casa,
  }) => {
    const id = await openNuoto(page, baseURL, casa, "2026-10-20");
    const dialog = await openForm(page);
    await fieldOf(dialog, "Dove").fill("Piscina Lissone");
    await pressSave(page);
    await buttonOf(confirmDialog(page), ONLY).click();

    await expect(editDialog(page)).toBeHidden();
    await expect(toastOf(page, SAVED)).toBeVisible();
    await expect(card(page)).toContainText("Piscina Lissone");
    await expect(
      card(page).getByText(
        "Ogni martedì e giovedì, questa volta con modifiche",
      ),
    ).toBeVisible();

    await page.goto(detailPath(id, "2026-10-22"));
    await expect(h1(page, NUOTO)).toBeVisible();
    await expect(card(page)).toContainText("Piscina comunale, Lissone");
    await expect(
      card(page).getByText(/questa volta con modifiche/),
    ).toHaveCount(0);
  });

  test("CA-49: «Salva tutti i prossimi» porta i valori nuovi alle volte già cambiate e lascia tolte quelle tolte", async ({
    page,
    baseURL,
    casa,
  }) => {
    const id = await createNuoto(casa);
    await changeOccurrence(casa, "Marco", id, "2026-10-20", {
      title: NUOTO,
      start: instant("2026-10-20", "17:00"),
      end: instant("2026-10-20", "18:30"),
      place: "Piscina Lissone",
      notes: "Portare la cuffia",
      escort: "Laura",
    });
    await removeOccurrence(casa, "Marco", id, "2026-10-27");
    await openDetail(page, baseURL, casa, "Marco", id, "2026-10-15");
    await expect(h1(page, NUOTO)).toBeVisible();

    const dialog = await openForm(page);
    await fieldOf(dialog, "Titolo").fill("Nuoto");
    await pressSave(page);
    const saved = await savedAs(page, () =>
      buttonOf(confirmDialog(page), ALL).click(),
    );
    await expect(editDialog(page)).toBeHidden();

    await page.goto(detailPath(saved.id, "2026-10-20"));
    await expect(h1(page, SAME_TITLE)).toBeVisible();
    await expect(
      card(page).getByText(/questa volta con modifiche/),
    ).toHaveCount(0);
    await page.goto(detailPath(saved.id, "2026-10-27"));
    await expect(h1(page, NOT_ANYMORE)).toBeVisible();
    await page.goto(detailPath(id, "2026-10-13"));
    await expect(h1(page, NUOTO)).toBeVisible();
  });

  test("CA-50: cambiare chi partecipa lascia la sola scelta «Salva tutti i prossimi»", async ({
    page,
    baseURL,
    casa,
  }) => {
    const id = await openNuoto(page, baseURL, casa, "2026-10-22");
    const dialog = await openForm(page);
    await chipOf(dialog, "Chi", "Tommaso").click();
    await pressSave(page);
    const confirm = confirmDialog(page);
    await expect(confirm).toHaveAccessibleDescription(
      textRx(
        `${NUOTO_RULE} Hai cambiato chi partecipa: vale per tutte le volte da giovedì 22 ottobre in poi. ${BEFORE_TEXT}`,
      ),
    );
    await expect(confirm.getByRole("button")).toHaveText([ALL, "Annulla"]);
    await expect(buttonOf(confirm, ALL)).toHaveClass(/btn-primary/);
    const saved = await savedAs(page, () => buttonOf(confirm, ALL).click());

    await expect(editDialog(page)).toBeHidden();
    await expect(page).toHaveURL(urlOf(saved.id, saved.day));
    await expect(
      card(page).getByText("Sofia e Tommaso", { exact: true }),
    ).toBeVisible();

    await page.goto(detailPath(id, "2026-10-20"));
    await expect(h1(page, NUOTO)).toBeVisible();
    await expect(card(page).getByText("Sofia", { exact: true })).toBeVisible();
    await expect(
      card(page).getByText("Sofia e Tommaso", { exact: true }),
    ).toHaveCount(0);
  });

  test("CA-51: cambiare chi partecipa e chi lo vede lo dice, dalla prima volta", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openNuoto(page, baseURL, casa, "2026-10-06");
    const dialog = await openForm(page);
    await chipOf(dialog, "Chi lo vede", "Occupato").click();
    await chipOf(dialog, "Chi", "Tommaso").click();
    await pressSave(page);
    const confirm = confirmDialog(page);
    await expect(confirm).toHaveAccessibleDescription(
      textRx(
        `${NUOTO_RULE} Hai cambiato chi partecipa e chi lo vede: vale per tutte le volte da martedì 6 ottobre in poi.`,
      ),
    );
    await expect(confirm.getByRole("button")).toHaveText([ALL, "Annulla"]);
  });

  test("CA-52: «La porta» a chi non vede l'impegno lo dice e, salvando, gli dà accesso", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    const id = await createEvent(bianchi, "Paolo", {
      title: "Basket Leo",
      day: "2026-10-05",
      from: "18:00",
      to: "19:00",
      visibility: "busy",
      members: ["Leo"],
      repeat: { kind: "weekly", weekdays: [1] },
    });
    await openDetail(page, baseURL, bianchi, "Paolo", id, "2026-10-26");
    await expect(h1(page, "Basket Leo")).toBeVisible();
    const dialog = await openForm(page);
    await chipOf(dialog, "La porta", "Giulia").click();
    await pressSave(page);
    const confirm = confirmDialog(page);
    await expect(confirm).toHaveAccessibleDescription(
      textRx(
        "Si ripete ogni lunedì. Giulia ora non vede questo impegno: se scegli Giulia in «La porta», lo vedrà da lunedì 26 ottobre in poi. Le volte prima restano come sono.",
      ),
    );
    await expect(confirm.getByRole("button")).toHaveText([ALL, "Annulla"]);
    const saved = await savedAs(page, () => buttonOf(confirm, ALL).click());
    await expect(editDialog(page)).toBeHidden();

    await switchTo(page, baseURL, bianchi, "Giulia");
    await page.goto(detailPath(saved.id, "2026-10-26"));
    await expect(h1(page, "Basket Leo")).toBeVisible();
  });

  test("CA-53: toccare due volte una persona la lascia com'era: si chiude senza dialogo né toast", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openNuoto(page, baseURL, casa, "2026-10-20");
    const dialog = await openForm(page);
    await chipOf(dialog, "Chi", "Tommaso").click();
    await chipOf(dialog, "Chi", "Tommaso").click();
    await expect(chipOf(dialog, "Chi", "Tommaso")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await pressSave(page);
    await expect(editDialog(page)).toBeHidden();
    await expect(confirmDialog(page)).toHaveCount(0);
    await expect(toastOf(page, SAVED)).toHaveCount(0);
  });

  for (const how of ["Annulla", "Esc"] as const) {
    test(`CA-54: ${how} chiude solo il dialogo; il modulo resta con il fuoco su «Salva le modifiche»`, async ({
      page,
      baseURL,
      casa,
    }) => {
      const id = await openNuoto(page, baseURL, casa, "2026-10-22");
      const { dialog, confirm } = await askToSaveTitle(page);
      if (how === "Annulla") await buttonOf(confirm, "Annulla").click();
      else await page.keyboard.press("Escape");

      await expect(confirmDialog(page)).toHaveCount(0);
      await expect(editDialog(page)).toBeVisible();
      await expect(fieldOf(dialog, "Titolo")).toHaveValue("Nuoto");
      await expect(buttonOf(dialog, "Salva le modifiche")).toBeFocused();
      expect((await eventRow(casa, id))?.title).toBe(NUOTO);
    });
  }

  test("CA-55: mentre scrive il bottone è occupato, gli altri no; se fallisce l'avviso sta nel dialogo; poi si riprova", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openNuoto(page, baseURL, casa, "2026-10-22");
    const { confirm } = await askToSaveTitle(page);
    const release = await holdRequests(page, RPC_UPDATE, "abort");

    const only = buttonOf(confirm, ONLY);
    await only.click();
    await expect(only).toHaveAttribute("aria-busy", "true");
    await expect(buttonOf(confirm, ALL)).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await expect(buttonOf(confirm, "Annulla")).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await page.keyboard.press("Escape");
    await expect(confirm).toBeVisible();
    await expect(editDialog(page)).toBeVisible();

    release();
    await expect(
      confirm.getByRole("alert").filter({ hasText: SAVE_FAILED }),
    ).toBeVisible();
    await expect(toastOf(page, SAVED)).toHaveCount(0);

    await page.unroute(RPC_UPDATE);
    await only.click();
    await expect(editDialog(page)).toBeHidden();
    await expect(h1(page, SAME_TITLE)).toBeVisible();
    await expect(toastOf(page, SAVED)).toBeVisible();
  });

  test("CA-56: il giorno di un'altra volta della serie dà l'errore sotto «Giorno» e non cambia niente", async ({
    page,
    baseURL,
    casa,
  }) => {
    const id = await openNuoto(page, baseURL, casa, "2026-10-20");
    const before = await eventRow(casa, id);
    const dialog = await openForm(page);
    await fieldOf(dialog, "Giorno").fill("2026-10-22");
    await pressSave(page);
    await buttonOf(confirmDialog(page), ONLY).click();

    await expect(confirmDialog(page)).toHaveCount(0);
    await expect(editDialog(page)).toBeVisible();
    await expect(
      dialog.getByText(
        textRx(
          "Giovedì 22 ottobre c'è già un'altra volta di questo impegno: scegli un altro giorno.",
        ),
      ),
    ).toBeVisible();
    const day = fieldOf(dialog, "Giorno");
    await expect(day).toHaveAttribute("aria-invalid", "true");
    await expect(day).toBeFocused();

    const after = await eventRow(casa, id);
    expect(after?.starts_at).toBe(before?.starts_at);
    expect(after?.title).toBe(before?.title);
    expect(await exceptionCount(casa, id)).toBe(0);
  });

  test("CA-57: se nel frattempo la persona non vede più l'impegno, l'errore sta sotto «La porta»", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    const id = await createEvent(bianchi, "Paolo", {
      title: "Allenamento",
      day: "2026-10-05",
      from: "17:00",
      to: "18:00",
      visibility: "busy",
      members: ["Giulia"],
      repeat: { kind: "weekly", weekdays: [1] },
    });
    await openDetail(page, baseURL, bianchi, "Paolo", id, "2026-10-26");
    await expect(h1(page, "Allenamento")).toBeVisible();
    const dialog = await openForm(page);
    await chipOf(dialog, "La porta", "Giulia").click();
    await pressSave(page);
    const confirm = confirmDialog(page);
    await expect(confirm.getByRole("button")).toHaveText([
      ALL,
      ONLY,
      "Annulla",
    ]);

    await removeParticipant(bianchi, id, "Giulia");
    await buttonOf(confirm, ONLY).click();

    await expect(confirmDialog(page)).toHaveCount(0);
    await expect(editDialog(page)).toBeVisible();
    await expect(
      dialog.getByText(
        "Giulia non vede questo impegno: puoi scegliere Giulia in «La porta» solo con «Salva tutti i prossimi».",
      ),
    ).toBeVisible();
    await expect(chipOf(dialog, "La porta", "Giulia")).toBeFocused();
  });

  test("CA-58: una volta spostata da sola avverte dove tornerà con «Salva tutti i prossimi»", async ({
    page,
    baseURL,
    casa,
  }) => {
    const id = await createNuoto(casa);
    await changeOccurrence(casa, "Marco", id, "2026-10-20", {
      title: NUOTO,
      start: instant("2026-10-21", "17:00"),
      end: instant("2026-10-21", "18:30"),
      place: "Piscina comunale, Lissone",
      notes: "Portare la cuffia",
      escort: "Laura",
    });
    await openDetail(page, baseURL, casa, "Marco", id, "2026-10-21");
    await expect(h1(page, NUOTO)).toBeVisible();
    await expect(card(page)).toContainText(
      textRx("Mercoledì 21 ottobre", false),
    );
    const { confirm } = await askToSaveTitle(page);
    await expect(confirm).toHaveAccessibleDescription(
      textRx(
        "Questa volta era stata spostata da sola: con «Salva tutti i prossimi» va a martedì 20 ottobre, nel giorno della serie.",
        false,
      ),
    );
  });

  test("CA-58: una serie del solo lunedì con una volta spostata da sola resta del lunedì con «Salva tutti i prossimi»", async ({
    page,
    baseURL,
    casa,
  }) => {
    // The case found by the reviewer: the series repeats on one weekday only.
    const id = await createEvent(casa, "Marco", {
      title: "Yoga",
      day: "2026-10-05",
      from: "18:00",
      to: "19:00",
      members: ["Marco"],
      repeat: { kind: "weekly", weekdays: [1] },
    });
    await changeOccurrence(casa, "Marco", id, "2026-10-26", {
      title: "Yoga",
      start: instant("2026-10-28", "18:00"),
      end: instant("2026-10-28", "19:00"),
      place: null,
      notes: null,
      escort: null,
    });
    await openDetail(page, baseURL, casa, "Marco", id, "2026-10-28");
    await expect(h1(page, "Yoga")).toBeVisible();
    await expect(card(page)).toContainText(
      textRx("Mercoledì 28 ottobre", false),
    );

    const { confirm } = await askToSaveTitle(page, "Yoga serale");
    await expect(confirm).toHaveAccessibleDescription(
      textRx("va a lunedì 26 ottobre, nel giorno della serie.", false),
    );
    const saved = await savedAs(page, () => buttonOf(confirm, ALL).click());
    expect(saved.day).toBe("2026-10-26");
    await expect(editDialog(page)).toBeHidden();

    const row = await eventRow(casa, saved.id);
    expect(row?.recurrence).toBe("weekly");
    expect(row?.recurrence_weekdays).toEqual([1]);

    await page.goto(detailPath(saved.id, saved.day));
    await expect(h1(page, "Yoga serale")).toBeVisible();
    await expect(card(page)).toContainText(textRx("Lunedì 26 ottobre", false));
    await expect(
      card(page).getByText("Ogni lunedì", { exact: true }),
    ).toBeVisible();

    await page.goto(detailPath(saved.id, "2026-11-02"));
    await expect(h1(page, "Yoga serale")).toBeVisible();
    await expect(card(page)).toContainText(textRx("Lunedì 2 novembre", false));

    await page.goto(detailPath(saved.id, "2026-10-28"));
    await expect(h1(page, NOT_ANYMORE)).toBeVisible();
  });

  for (const [scope, label, url] of [
    ["solo questo", ONLY, RPC_UPDATE_ONE],
    ["tutti i prossimi", ALL, RPC_UPDATE_ALL],
  ] as const) {
    test(`CA-59: «${label}» manda sempre il giorno della volta aperta, mai null (${scope})`, async ({
      page,
      baseURL,
      casa,
    }) => {
      await openNuoto(page, baseURL, casa, "2026-10-20");
      const { confirm } = await askToSaveTitle(page);
      const request = await writeRequest(page, url, () =>
        buttonOf(confirm, label).click(),
      );
      const body = request.postDataJSON() as { p_day?: string | null };
      expect(body.p_day).toBe("2026-10-20");
    });
  }
});
