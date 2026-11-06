import AxeBuilder from "@axe-core/playwright";
import { type Locator, type Page } from "@playwright/test";
import { waitForAnimationsToEnd } from "../fixtures/animations";
import {
  CORS,
  expect,
  isMobileProject,
  setClock,
  test,
  type CasaNest,
} from "../fixtures/casa";
import {
  MEMBERS_FAILED,
  NOW,
  PHRASE,
  SAVE_FAILED,
  alertsIn,
  dayRead,
  eventsOf,
  failMembersList,
  fieldOf,
  impegnoFields,
  listedFor,
  openAdd,
  participantRowsOf,
  pauseClock,
  plain,
  recordNetwork,
  seedColloquio,
  toastOf,
} from "../fixtures/aggiungi";
import { setPreferences } from "../fixtures/preferenze";

// Aggiungi · Impegni, phase 2 (#171): the full form «Nuovo impegno» opened from
// the phrase. One test (or more) per criterion, CA-1 ... CA-25. The four smoke
// tests on the seed user are in aggiungi-impegni-modulo.spec.ts.
//
// Every test builds its own throwaway Nests (fixtures/casa.ts), so desktop and
// mobile never meet on the same rows. The browser clock is fixed at Tuesday 20
// October 2026, 15:52 in Rome (nothing depends on the real date). «Nel
// database» = read with the session of the user (RLS applies); the participants
// and the plain counts use the administrative key, as the other Aggiungi specs.
// The criteria written for one width run only in the project of that width.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

const SAVED_TOAST = "Messo in giovedì 22: Nuoto Sofia alle 17:00.";
const SUBMIT = "Metti in giovedì 22";

// ------------------------------------------------------------------- helpers

const addOf = (page: Page) => page.getByRole("dialog", { name: "Aggiungi" });
const formOf = (page: Page) =>
  page.getByRole("dialog", { name: "Nuovo impegno" });

/** Skips the test in the other project: the criterion is written for one width. */
function onlyOn(width: "mobile" | "desktop") {
  test.skip(
    (width === "mobile") !== isMobileProject(),
    `Criterio scritto per ${width}`,
  );
}

const isDesktopNow = (page: Page) => (page.viewportSize()?.width ?? 0) >= 1024;

/** The entry of the width: «Più dettagli» (mobile) or «Tutti i dettagli» (desktop). */
const entryOf = (page: Page) =>
  addOf(page).getByRole("button", {
    name: isDesktopNow(page) ? "Tutti i dettagli" : "Più dettagli",
    exact: true,
  });

/** A group of chips of the form, by its name. */
const groupOf = (page: Page, name: string) =>
  formOf(page).getByRole("group", { name, exact: true });

const chip = (page: Page, group: string, name: string) =>
  groupOf(page, group).getByRole("button", { name, exact: true });

/** The accessible names of the buttons of a group, in order. */
async function expectChips(group: Locator, names: string[]) {
  const buttons = group.getByRole("button");
  await expect(buttons).toHaveCount(names.length);
  for (const [index, name] of names.entries()) {
    await expect(buttons.nth(index)).toHaveAccessibleName(name);
  }
}

/** The submit button of the form (it is in the foot of the sheet). */
const submitOf = (page: Page, name: string = SUBMIT) =>
  formOf(page).getByRole("button", { name, exact: true });

/** The status that tells «Messo in …». */
const savedToast = (page: Page) =>
  page.getByRole("status").filter({ hasText: "Messo in" });

/** Writes the phrase and opens the form with the entry of the width. */
async function fillAndOpen(page: Page, phrase: string) {
  await fieldOf(page).fill(phrase);
  const entry = entryOf(page);
  await expect(entry).toBeVisible();
  await entry.click();
  await expect(formOf(page)).toBeVisible();
  await waitForAnimationsToEnd(page);
}

/** Opens Aggiungi from Today, writes the phrase and opens the form. */
async function openForm(
  page: Page,
  baseURL: string | undefined,
  nest: CasaNest,
  who: string,
  phrase: string = PHRASE,
  options: { lens?: "io" | "nest" } = {},
) {
  await openAdd(page, baseURL, nest, who, options);
  await fillAndOpen(page, phrase);
}

/**
 * Opens Aggiungi from another page of the app (the link in the navigation),
 * with the clock fixed and the lens «Io». The click is repeated until the page
 * is hydrated and the sheet is open.
 */
async function openAddFrom(
  page: Page,
  baseURL: string | undefined,
  nest: CasaNest,
  who: string,
  path: string,
) {
  await setClock(page, NOW);
  await page.addInitScript(() => {
    window.sessionStorage.setItem("familynest.lens", "io");
  });
  await nest.signIn(page, baseURL, who);
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({
    timeout: 20_000,
  });
  await expect(async () => {
    await page.getByRole("link", { name: "Aggiungi", exact: true }).click();
    await expect(addOf(page)).toBeVisible({ timeout: 2000 });
  }).toPass();
  await expect(fieldOf(page)).toBeFocused();
}

type SavedRow = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  visibility: string;
  escort_member_id: string | null;
  recurrence: string;
  recurrence_weekdays: number[] | null;
  recurrence_until: string | null;
  location: string | null;
  notes: string | null;
  author_member_id: string | null;
  household_id: string;
  memberIds: string[];
};

/**
 * The events of the Nest as `who` reads them (RLS applies), with the
 * participants (administrative key).
 */
async function savedBy(nest: CasaNest, who: string): Promise<SavedRow[]> {
  const user = nest.users[who];
  if (!user) throw new Error(`${who} non ha un account di prova`);
  const { data, error } = await user.client
    .from("events")
    .select(
      "id, title, starts_at, ends_at, visibility, escort_member_id, recurrence, recurrence_weekdays, recurrence_until, location, notes, author_member_id, household_id",
    )
    .eq("household_id", nest.householdId)
    .order("created_at", { ascending: true });
  if (error) throw new Error("Lettura degli impegni di prova fallita");
  const withMembers = await eventsOf(nest);
  return (data ?? []).map((row) => ({
    ...row,
    memberIds: withMembers.find((e) => e.id === row.id)?.memberIds ?? [],
  }));
}

const iso = (value: string) => new Date(value).toISOString();

/** Answers `create_event` with a 500 while `failing()` is true. */
async function failSave(page: Page, failing: () => boolean = () => true) {
  await page.route("**/rest/v1/rpc/create_event", async (route) => {
    if (!failing() || route.request().method() === "OPTIONS") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      headers: CORS,
      body: JSON.stringify({ code: "XX000", message: "boom" }),
    });
  });
}

/** Holds the answer of `create_event` until `release()` is called. */
async function slowSave(page: Page) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let calls = 0;
  await page.route("**/rest/v1/rpc/create_event", async (route) => {
    calls += 1;
    await gate;
    await route.continue();
  });
  return { release, calls: () => calls };
}

// -------------------------------------------------------------------- Ingressi

test.describe("Aggiungi · Impegni · modulo · ingressi", () => {
  test("CA-1: su mobile «Più dettagli» c'è con titolo e persone lette, nel posto giusto, e manca negli altri casi", async ({
    page,
    baseURL,
    casa,
  }) => {
    onlyOn("mobile");
    await openAdd(page, baseURL, casa, "Marco");
    const dialog = addOf(page);
    const field = fieldOf(page);
    await field.fill(PHRASE);

    // The positive case first: the absences below are then real.
    const entry = dialog.getByRole("button", {
      name: "Più dettagli",
      exact: true,
    });
    await expect(entry).toBeVisible();
    await expect(dialog.getByText("Tutti i dettagli")).toHaveCount(0);
    const submit = dialog.getByRole("button", { name: SUBMIT, exact: true });
    await expect(submit).toBeVisible();

    // Document order: the fields (#333: «Chi lo vede» is the last one), then
    // «Più dettagli», then the submit button.
    const label = await impegnoFields(page).visibility.elementHandle();
    const entryNode = await entry.elementHandle();
    const submitNode = await submit.elementHandle();
    expect(label).not.toBeNull();
    const order = await page.evaluate(
      ([a, b, c]) => ({
        labelBeforeEntry: !!(
          a!.compareDocumentPosition(b!) & Node.DOCUMENT_POSITION_FOLLOWING
        ),
        entryBeforeSubmit: !!(
          b!.compareDocumentPosition(c!) & Node.DOCUMENT_POSITION_FOLLOWING
        ),
      }),
      [label, entryNode, submitNode] as const,
    );
    expect(order).toEqual({ labelBeforeEntry: true, entryBeforeSubmit: true });

    // Empty field, only spaces, a phrase without a title.
    await field.fill("");
    await expect(dialog.getByText("Più dettagli")).toHaveCount(0);
    await field.fill("   ");
    await expect(dialog.getByText("Più dettagli")).toHaveCount(0);
    await field.fill("giovedì alle 17");
    await expect(impegnoFields(page).day).toHaveValue("2026-10-22");
    await expect(dialog.getByText("Più dettagli")).toHaveCount(0);

    // Type «Spesa».
    await field.fill(PHRASE);
    await expect(entry).toBeVisible();
    const spesa = dialog
      .getByRole("group", { name: "Tipo" })
      .getByRole("button", { name: "Spesa", exact: true });
    await spesa.click();
    await expect(spesa).toHaveAttribute("aria-pressed", "true");
    await expect(dialog.getByText("Più dettagli")).toHaveCount(0);
  });

  test("CA-1: con «/aggiungi?tipo=da-fare» non c'è «Più dettagli»", async ({
    page,
    baseURL,
    casa,
  }) => {
    onlyOn("mobile");
    await openAdd(page, baseURL, casa, "Marco");
    await page.goto("/aggiungi?tipo=da-fare");
    const dialog = addOf(page);
    await expect(dialog).toBeVisible();
    await expect(fieldOf(page)).toBeFocused();
    await expect(
      dialog
        .getByRole("group", { name: "Tipo" })
        .getByRole("button", { name: "Da fare", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await fieldOf(page).fill("Chiamare l'idraulico");
    await expect(dialog.getByText("Più dettagli")).toHaveCount(0);
    await expect(dialog.getByText("Tutti i dettagli")).toHaveCount(0);
  });

  // #333 (decision 3, CA-2): the four rows of the summary are gone with «La porta».
  test("CA-2: su desktop «Tutti i dettagli» sta a sinistra del bottone d'invio, senza righe del riepilogo e senza «La porta»", async ({
    page,
    baseURL,
    casa,
  }) => {
    onlyOn("desktop");
    await openAdd(page, baseURL, casa, "Marco");
    const dialog = addOf(page);
    await fieldOf(page).fill(PHRASE);

    const all = dialog.getByRole("button", {
      name: "Tutti i dettagli",
      exact: true,
    });
    const submit = dialog.getByRole("button", { name: SUBMIT, exact: true });
    await expect(all).toBeVisible();
    await expect(submit).toBeVisible();
    const allBox = await all.boundingBox();
    const submitBox = await submit.boundingBox();
    expect(allBox!.x + allBox!.width).toBeLessThanOrEqual(submitBox!.x + 1);
    await expect(dialog.getByText("Più dettagli")).toHaveCount(0);

    await expect(dialog.locator("button.riga-opzione")).toHaveCount(0);
    await expect(dialog.getByText("La porta")).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: /La porta/ })).toHaveCount(
      0,
    );
    await expect(dialog.getByRole("group", { name: "La porta" })).toHaveCount(
      0,
    );

    // A phrase without a title: no entry.
    await fieldOf(page).fill("giovedì alle 17");
    await expect(impegnoFields(page).day).toHaveValue("2026-10-22");
    await expect(dialog.getByText("Tutti i dettagli")).toHaveCount(0);
  });
});

// ------------------------------------------------------------ Modulo compilato

test.describe("Aggiungi · Impegni · modulo · già compilato", () => {
  test("CA-3: il modulo si apre già compilato dalla frase, nello stesso dialogo", async ({
    page,
    baseURL,
    casa,
  }) => {
    await setPreferences(casa.users["Marco"]!, {
      default_event_visibility: "busy",
    });
    await openForm(page, baseURL, casa, "Marco", PHRASE, { lens: "io" });
    const form = formOf(page);

    await expect(page.getByRole("dialog")).toHaveCount(1);
    await expect(form).toHaveAccessibleName("Nuovo impegno");
    expect(new URL(page.url()).pathname).toBe("/aggiungi");

    await expect(
      page.getByRole("textbox", { name: "Cosa vuoi aggiungere?" }),
    ).toHaveCount(0);
    await expect(form.getByRole("group", { name: "Tipo" })).toHaveCount(0);
    await expect(form.getByText("scrivi come parli")).toHaveCount(0);
    await expect(
      form.getByRole("button", { name: "Elimina impegno" }),
    ).toHaveCount(0);

    await expect(form.getByLabel("Titolo")).toHaveValue("Nuoto Sofia");
    await expect(form.getByLabel("Titolo")).toBeFocused();
    await expect(form.getByLabel("Giorno")).toHaveValue("2026-10-22");
    await expect(form.getByLabel("Dalle", { exact: true })).toHaveValue(
      "17:00",
    );
    await expect(form.getByLabel("Alle", { exact: true })).toHaveValue("18:00");
    await expect(form.getByLabel("Si ripete")).toHaveValue("none");
    await expect(form.getByLabel("Si ripete").locator("option")).toHaveText([
      "Mai",
      "Ogni settimana",
      "Ogni mese",
    ]);
    await expect(form.getByLabel("Dove")).toHaveValue("");
    await expect(form.getByLabel("Note")).toHaveValue("");

    await expectChips(groupOf(page, "Chi"), [
      "Tu",
      "Laura",
      "Sofia",
      "Tommaso",
      "Biscotto",
    ]);
    await expect(
      groupOf(page, "Chi").getByRole("button", { pressed: true }),
    ).toHaveCount(1);
    await expect(chip(page, "Chi", "Sofia")).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // #333 (specifica grafica §4): «La porta» stays in the form, nobody chosen
    await expectChips(groupOf(page, "La porta"), ["Tu", "Laura"]);
    await expect(
      groupOf(page, "La porta").getByRole("button", { pressed: true }),
    ).toHaveCount(0);

    const visibility = groupOf(page, "Chi lo vede");
    await expect(visibility.getByRole("button", { pressed: true })).toHaveCount(
      1,
    );
    await expect(
      visibility.getByRole("button", { name: "Occupato", pressed: true }),
    ).toBeVisible();
    await expect(visibility).toHaveAccessibleDescription(
      "Gli altri vedono solo che sei occupato.",
    );
    await expect(submitOf(page)).toBeVisible();
  });

  test("CA-4: con la lente «Nest» il modulo parte da «Tutti» e dal solo «Tu»", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openForm(page, baseURL, casa, "Marco", "Dentista domani alle 16", {
      lens: "nest",
    });
    const visibility = groupOf(page, "Chi lo vede");
    await expect(
      visibility.getByRole("button", { name: "Tutti", pressed: true }),
    ).toBeVisible();
    await expect(visibility).toHaveAccessibleDescription(
      "Lo vede tutto il Nest.",
    );
    const people = groupOf(page, "Chi");
    await expect(people.getByRole("button", { pressed: true })).toHaveCount(1);
    await expect(chip(page, "Chi", "Tu")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("CA-4: con la lente «Io» e la preferenza «Solo io» il modulo parte da «Solo io»", async ({
    page,
    baseURL,
    casa,
  }) => {
    await setPreferences(casa.users["Marco"]!, {
      default_event_visibility: "private",
    });
    await openForm(page, baseURL, casa, "Marco", "Dentista domani alle 16", {
      lens: "io",
    });
    const visibility = groupOf(page, "Chi lo vede");
    await expect(
      visibility.getByRole("button", { name: "Solo io", pressed: true }),
    ).toBeVisible();
    await expect(visibility).toHaveAccessibleDescription(
      "Lo vedi solo tu e chi partecipa.",
    );
  });

  test("CA-5: giorno e ore del modulo vengono dalla frase (senza ora, solo ora, notte)", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openForm(page, baseURL, casa, "Marco", "Nuoto Sofia giovedì");
    const form = formOf(page);
    await expect(form.getByLabel("Giorno")).toHaveValue("2026-10-22");
    await expect(form.getByLabel("Dalle", { exact: true })).toHaveValue("");
    await expect(form.getByLabel("Alle", { exact: true })).toHaveValue("");

    await form.getByRole("button", { name: "Chiudi" }).click();
    await expect(addOf(page)).toBeVisible();
    await fillAndOpen(page, "calcetto alle 18");
    await expect(form.getByLabel("Giorno")).toHaveValue("2026-10-20");
    await expect(form.getByLabel("Dalle", { exact: true })).toHaveValue(
      "18:00",
    );
    await expect(form.getByLabel("Alle", { exact: true })).toHaveValue("19:00");

    await form.getByRole("button", { name: "Chiudi" }).click();
    await expect(addOf(page)).toBeVisible();
    await fillAndOpen(page, "festa sabato dalle 22 alle 1");
    await expect(form.getByLabel("Dalle", { exact: true })).toHaveValue(
      "22:00",
    );
    await expect(form.getByLabel("Alle", { exact: true })).toHaveValue("01:00");
    await expect(form.getByText("Finisce domenica 25.")).toBeVisible();
    await expect(
      form.getByLabel("Alle", { exact: true }),
    ).toHaveAccessibleDescription(/Finisce domenica 25\./);
  });

  // #333: one entry only («Tutti i dettagli» / «Più dettagli»), focus on the title.
  test("CA-6: l'unico ingresso apre il modulo con il fuoco sul titolo", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAdd(page, baseURL, casa, "Marco", { lens: "io" });
    await fieldOf(page).fill(PHRASE);
    const form = formOf(page);

    await expect(entryOf(page)).toBeVisible();
    await entryOf(page).click();
    await expect(form).toBeVisible();
    await expect(form.getByLabel("Titolo")).toBeFocused();
    await form.getByRole("button", { name: "Chiudi" }).click();
    await expect(addOf(page)).toBeVisible();
  });

  test("CA-7: il modulo da desktop è una modale singola e il bottone segue «Giorno»", async ({
    page,
    baseURL,
    casa,
  }) => {
    onlyOn("desktop");
    await openForm(page, baseURL, casa, "Marco");
    const form = formOf(page);
    await expect(form.getByText("Anteprima")).toHaveCount(0);
    await expect(form.getByText("Esempi")).toHaveCount(0);
    await expect(form.getByRole("complementary")).toHaveCount(0);

    await form.getByLabel("Giorno").fill("2026-11-07");
    await expect(submitOf(page, "Metti in sabato 7 novembre")).toBeVisible();

    await form.getByLabel("Giorno").fill("");
    const empty = submitOf(page, "Aggiungi");
    await expect(empty).toBeVisible();
    await expect(empty).toBeEnabled();
    await expect(empty).not.toHaveAttribute("aria-disabled", "true");
  });
});

// ------------------------------------------------------------------ Salvataggio

test.describe("Aggiungi · Impegni · modulo · salvataggio", () => {
  test("CA-8: «La porta» e «Tutti» si salvano, il toast ha il giorno in grassetto", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openForm(page, baseURL, casa, "Marco");
    await chip(page, "La porta", "Tu").click();
    await groupOf(page, "Chi lo vede")
      .getByRole("button", { name: "Tutti" })
      .click();
    await submitOf(page).click();

    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(new URL(page.url()).pathname).toBe("/oggi");
    const toast = savedToast(page);
    await expect(toast).toContainText(SAVED_TOAST);
    await expect(toast.locator("b")).toHaveText("giovedì 22");
    await expect(toast.getByRole("button", { name: "Annulla" })).toBeVisible();

    const rows = await savedBy(casa, "Marco");
    expect(rows).toHaveLength(1);
    const [row] = rows;
    expect(row).toMatchObject({
      title: "Nuoto Sofia",
      visibility: "household",
      escort_member_id: casa.members["Marco"],
      recurrence: "none",
      location: null,
      notes: null,
      author_member_id: casa.members["Marco"],
      household_id: casa.householdId,
    });
    expect(iso(row!.starts_at)).toBe("2026-10-22T15:00:00.000Z");
    expect(iso(row!.ends_at)).toBe("2026-10-22T16:00:00.000Z");
    expect(row!.memberIds).toEqual([casa.members["Sofia"]]);
  });

  test("CA-9: i campi cambiati si salvano e il calendario sotto si aggiorna", async ({
    page,
    baseURL,
    casa,
  }) => {
    onlyOn("desktop");
    await setPreferences(casa.users["Marco"]!, {
      default_event_visibility: "busy",
    });
    await openAddFrom(
      page,
      baseURL,
      casa,
      "Marco",
      "/calendario?settimana=2026-10-26",
    );
    await fillAndOpen(page, "Riunione giovedì alle 9");
    const form = formOf(page);

    await form.getByLabel("Titolo").fill("  Nuoto  ");
    await form.getByLabel("Giorno").fill("2026-10-29");
    await form.getByLabel("Dalle", { exact: true }).fill("17:30");
    await form.getByLabel("Alle", { exact: true }).fill("18:45");
    await form.getByLabel("Dove").fill("Piscina comunale, Lissone");
    await chip(page, "Chi", "Tommaso").click();
    await form.getByLabel("Note").fill("Portare la merenda");
    await submitOf(page, "Metti in giovedì 29").click();

    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(savedToast(page)).toContainText(
      "Messo in giovedì 29: Nuoto alle 17:30.",
    );
    const rows = await savedBy(casa, "Marco");
    expect(rows).toHaveLength(1);
    const [row] = rows;
    expect(row).toMatchObject({
      title: "Nuoto",
      location: "Piscina comunale, Lissone",
      notes: "Portare la merenda",
      visibility: "busy",
      escort_member_id: null,
    });
    expect(iso(row!.starts_at)).toBe("2026-10-29T16:30:00.000Z");
    expect(iso(row!.ends_at)).toBe("2026-10-29T17:45:00.000Z");
    expect([...row!.memberIds].sort()).toEqual(
      [casa.members["Marco"]!, casa.members["Tommaso"]!].sort(),
    );

    // Without reloading, the column of Thursday 29 shows the new event.
    const column = page
      .getByRole("heading", { level: 2, name: /^Giovedì 29( |,|$)/ })
      .locator("xpath=..");
    await expect(column.getByRole("link", { name: /^Nuoto/ })).toBeVisible();
  });

  test("CA-10: «Ogni settimana» salva la ripetizione senza dialogo", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openForm(page, baseURL, casa, "Marco");
    await formOf(page).getByLabel("Si ripete").selectOption("weekly");
    await submitOf(page).click();

    await expect(savedToast(page)).toContainText(SAVED_TOAST);
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    const rows = await savedBy(casa, "Marco");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      recurrence: "weekly",
      recurrence_weekdays: [4],
      recurrence_until: null,
    });
  });

  test("CA-10: «Ogni mese» salva la ripetizione mensile senza giorni", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openForm(page, baseURL, casa, "Marco");
    await formOf(page).getByLabel("Si ripete").selectOption("monthly");
    await submitOf(page).click();

    await expect(savedToast(page)).toContainText(SAVED_TOAST);
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    const rows = await savedBy(casa, "Marco");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      recurrence: "monthly",
      recurrence_weekdays: null,
      recurrence_until: null,
    });
  });

  test("CA-11: «Annulla» toglie l'impegno che si ripete con tutte le sue volte", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openForm(page, baseURL, casa, "Marco");
    await formOf(page).getByLabel("Si ripete").selectOption("weekly");
    await submitOf(page).click();
    await expect(savedToast(page)).toContainText(SAVED_TOAST);
    expect(await savedBy(casa, "Marco")).toHaveLength(1);
    expect(await participantRowsOf(casa)).toBe(1);

    // The clock stops: the toast cannot expire while the test acts.
    await pauseClock(page);
    await savedToast(page).getByRole("button", { name: "Annulla" }).click();
    await expect(savedToast(page)).toHaveCount(0);
    await expect
      .poll(async () => (await savedBy(casa, "Marco")).length)
      .toBe(0);
    expect(await participantRowsOf(casa)).toBe(0);
    expect(
      await listedFor(
        casa,
        "Marco",
        "2026-10-19T00:00:00Z",
        "2026-11-30T00:00:00Z",
      ),
    ).toHaveLength(0);
  });

  test("CA-12: aprendo direttamente /aggiungi si salva e si torna su /oggi con il toast", async ({
    page,
    baseURL,
    casa,
  }) => {
    await setClock(page, NOW);
    await page.addInitScript(() => {
      window.sessionStorage.setItem("familynest.lens", "io");
    });
    await casa.signIn(page, baseURL, "Marco");
    await page.goto("/aggiungi");
    await expect(addOf(page)).toBeVisible({ timeout: 20_000 });
    await expect(fieldOf(page)).toBeFocused();
    await fillAndOpen(page, PHRASE);
    await submitOf(page).click();

    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).toHaveURL(/\/oggi$/);
    await expect(savedToast(page)).toContainText(SAVED_TOAST);
    expect(await savedBy(casa, "Marco")).toHaveLength(1);
  });
});

// ------------------------------------------------------ Chiudere senza salvare

test.describe("Aggiungi · Impegni · modulo · chiusura", () => {
  test("CA-13: «Chiudi» riporta alla frase, il fuoco torna su «Più dettagli» e le scelte si perdono", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openForm(page, baseURL, casa, "Marco");
    const form = formOf(page);
    await form.getByLabel("Titolo").fill("Altro");
    await chip(page, "Chi", "Tommaso").click();
    await form.getByRole("button", { name: "Chiudi" }).click();

    await expect(page.getByRole("dialog")).toHaveCount(1);
    await expect(addOf(page)).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/aggiungi");
    await expect(fieldOf(page)).toHaveValue(PHRASE);
    // #333 (CA-7): the sheet keeps its fields, the choices made in the form are lost
    const f = impegnoFields(page);
    await expect(f.day).toHaveValue("2026-10-22");
    await expect(f.from).toHaveValue("17:00");
    await f.expectWho(["Sofia"]);
    await expect(entryOf(page)).toBeFocused();
    expect(await savedBy(casa, "Marco")).toHaveLength(0);

    await entryOf(page).click();
    await expect(form.getByLabel("Titolo")).toHaveValue("Nuoto Sofia");
    await expect(chip(page, "Chi", "Tommaso")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  test("CA-14: Esc dal modulo di desktop riporta alla frase, con il fuoco su «Tutti i dettagli»", async ({
    page,
    baseURL,
    casa,
  }) => {
    onlyOn("desktop");
    await openAdd(page, baseURL, casa, "Marco");
    await fieldOf(page).fill(PHRASE);
    await expect(entryOf(page)).toBeVisible();
    await entryOf(page).click();
    await expect(formOf(page)).toBeVisible();
    await waitForAnimationsToEnd(page);

    await page.keyboard.press("Escape");
    await expect(addOf(page)).toBeVisible();
    await expect(fieldOf(page)).toHaveValue(PHRASE);
    await expect(entryOf(page)).toBeFocused();
  });

  test("CA-14: il tocco sul velo dal modulo di mobile riporta alla frase", async ({
    page,
    baseURL,
    casa,
  }) => {
    onlyOn("mobile");
    await openForm(page, baseURL, casa, "Marco");
    await waitForAnimationsToEnd(page);
    await page.getByTestId("velo").click({ position: { x: 5, y: 2 } });
    await expect(addOf(page)).toBeVisible();
    await expect(fieldOf(page)).toHaveValue(PHRASE);
    await expect(formOf(page)).toHaveCount(0);
  });

  test("CA-15: «Indietro» del browser chiude tutto Aggiungi senza salvare", async ({
    page,
    baseURL,
    casa,
  }) => {
    onlyOn("mobile");
    await openAddFrom(page, baseURL, casa, "Marco", "/calendario");
    await fillAndOpen(page, PHRASE);

    await page.goBack();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).toHaveURL(/\/calendario$/);
    expect(await savedBy(casa, "Marco")).toHaveLength(0);
  });

  test("CA-16: passando da 1280 a 390 px il modulo resta aperto con i valori scritti", async ({
    page,
    baseURL,
    casa,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openForm(page, baseURL, casa, "Marco");
    await formOf(page).getByLabel("Titolo").fill("Nuoto");

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(formOf(page)).toBeVisible();
    await expect(formOf(page).getByLabel("Titolo")).toHaveValue("Nuoto");
  });
});

// ------------------------------------------------------- Errori e caricamento

test.describe("Aggiungi · Impegni · modulo · errori e caricamento", () => {
  test("CA-17: i controlli arrivano all'invio, sotto i campi, e il fuoco va sul titolo", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openForm(page, baseURL, casa, "Marco", "Nuoto Sofia giovedì");
    const form = formOf(page);
    await form.getByLabel("Titolo").fill("");
    await chip(page, "Chi", "Sofia").click();
    await expect(chip(page, "Chi", "Sofia")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    // Nothing is checked while typing.
    await expect(form.getByText("Scrivi il titolo dell'impegno.")).toHaveCount(
      0,
    );
    await submitOf(page).click();

    const title = form.getByLabel("Titolo");
    await expect(title).toHaveAttribute("aria-invalid", "true");
    await expect(title).toHaveAccessibleDescription(
      "Scrivi il titolo dell'impegno.",
    );
    await expect(title).toBeFocused();
    await expect(
      form.getByLabel("Dalle", { exact: true }),
    ).toHaveAccessibleDescription("Scegli l'ora d'inizio.");
    await expect(
      form.getByLabel("Alle", { exact: true }),
    ).toHaveAccessibleDescription("Scegli l'ora di fine.");
    await expect(groupOf(page, "Chi")).toHaveAccessibleDescription(
      "Scegli almeno una persona.",
    );
    await expect(form).toBeVisible();
    expect(await savedBy(casa, "Marco")).toHaveLength(0);
  });

  test("CA-18: fine uguale all'inizio e giorno vuoto danno l'errore sotto il campo e non salvano", async ({
    page,
    baseURL,
    casa,
  }) => {
    onlyOn("desktop");
    await openForm(page, baseURL, casa, "Marco");
    const form = formOf(page);
    await form.getByLabel("Alle", { exact: true }).fill("17:00");
    await submitOf(page).click();
    await expect(
      form.getByLabel("Alle", { exact: true }),
    ).toHaveAccessibleDescription(
      /L'ora di fine deve essere diversa da quella d'inizio\./,
    );
    await expect(form.getByLabel("Alle", { exact: true })).toBeFocused();
    expect(await savedBy(casa, "Marco")).toHaveLength(0);

    await form.getByLabel("Giorno").fill("");
    await submitOf(page, "Aggiungi").click();
    await expect(form.getByLabel("Giorno")).toHaveAccessibleDescription(
      "Scegli il giorno.",
    );
    await expect(form.getByLabel("Giorno")).toBeFocused();
    expect(await savedBy(casa, "Marco")).toHaveLength(0);
  });

  test("CA-19: oltre i limiti non si scrive (100, 100 e 500 caratteri)", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openForm(page, baseURL, casa, "Marco");
    const form = formOf(page);
    const title = form.getByLabel("Titolo");
    await title.fill("");
    await title.pressSequentially("a".repeat(101));
    await form.getByLabel("Dove").pressSequentially("b".repeat(101));
    await form.getByLabel("Note").pressSequentially("c".repeat(501));
    expect((await title.inputValue()).length).toBe(100);
    expect((await form.getByLabel("Dove").inputValue()).length).toBe(100);
    expect((await form.getByLabel("Note").inputValue()).length).toBe(500);
  });

  test("CA-20: se il salvataggio fallisce il modulo resta aperto con l'avviso, poi riprova e salva", async ({
    page,
    baseURL,
    casa,
  }) => {
    let failing = true;
    await failSave(page, () => failing);
    await openForm(page, baseURL, casa, "Marco");
    const form = formOf(page);
    const submit = submitOf(page);
    await submit.click();

    await expect(form).toBeVisible();
    await expect(form.getByLabel("Titolo")).toHaveValue("Nuoto Sofia");
    const alert = alertsIn(form);
    await expect(alert).toHaveText(SAVE_FAILED);
    await expect(alert).not.toContainText(/boom|XX000|500/);
    await expect(toastOf(page)).toHaveCount(0);
    expect(await savedBy(casa, "Marco")).toHaveLength(0);
    // The alert is above the submit button.
    const alertBox = await alert.boundingBox();
    const buttonBox = await submit.boundingBox();
    expect(alertBox!.y + alertBox!.height).toBeLessThanOrEqual(
      buttonBox!.y + 1,
    );

    failing = false;
    await submit.click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(savedToast(page)).toContainText(SAVED_TOAST);
    expect(await savedBy(casa, "Marco")).toHaveLength(1);
  });

  test("CA-21: durante il salvataggio un secondo tocco ed Esc non fanno niente e si salva una volta sola", async ({
    page,
    baseURL,
    casa,
  }) => {
    const slow = await slowSave(page);
    await openForm(page, baseURL, casa, "Marco");
    const form = formOf(page);
    const submit = submitOf(page);
    await submit.click();
    await expect(submit).toHaveAttribute("aria-busy", "true");
    await expect(submit).toContainText(SUBMIT);

    // The button is aria-disabled: the second touch is forced.
    await submit.click({ force: true });
    await page.keyboard.press("Escape");
    await expect(form).toBeVisible();
    await expect(form.getByRole("button", { name: "Chiudi" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await expect(submit).toHaveAttribute("aria-busy", "true");

    slow.release();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(savedToast(page)).toContainText(SAVED_TOAST);
    expect(await savedBy(casa, "Marco")).toHaveLength(1);
    expect(slow.calls()).toBe(1);
  });

  test("CA-22: senza le persone lette non ci sono gli ingressi, e dopo «Riprova» compaiono", async ({
    page,
    baseURL,
    casa,
  }) => {
    let failing = true;
    await failMembersList(page, () => failing);
    await openAdd(page, baseURL, casa, "Marco");
    const dialog = addOf(page);
    await expect(alertsIn(dialog)).toContainText(MEMBERS_FAILED);
    await fieldOf(page).fill(PHRASE);
    await expect(impegnoFields(page).day).toHaveValue("2026-10-22");
    await expect(dialog.getByText("Più dettagli")).toHaveCount(0);
    await expect(dialog.getByText("Tutti i dettagli")).toHaveCount(0);

    failing = false;
    await alertsIn(dialog).getByRole("button", { name: "Riprova" }).click();
    await expect(entryOf(page)).toBeVisible();
  });
});

// ---------------------------------------------------------- Isolamento e privacy

test.describe("Aggiungi · Impegni · modulo · isolamento e privacy", () => {
  test("CA-23: Giulia vede solo le persone di Casa Bianchi e salva nel suo Nest", async ({
    page,
    baseURL,
    casa,
    bianchi,
  }) => {
    onlyOn("desktop");
    await seedColloquio(casa);
    const network = recordNetwork(page);
    await openForm(
      page,
      baseURL,
      bianchi,
      "Giulia",
      "Nuoto Leo giovedì alle 17",
    );

    await expectChips(groupOf(page, "Chi"), ["Tu", "Paolo", "Leo", "Anna"]);
    await expect(
      groupOf(page, "Chi").getByRole("button", { pressed: true }),
    ).toHaveCount(1);
    await expect(chip(page, "Chi", "Leo")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expectChips(groupOf(page, "La porta"), ["Tu", "Paolo", "Anna"]);

    // Nothing of the other Nest reaches the page or the answers it reads.
    // Visible text of the page (not the scripts, which carry the examples).
    // The only «Sofia» left is the fixed example of the page behind the sheet
    // («Es. «nuoto Sofia giovedì alle 17»»), the same for every Nest.
    const body = (await page.locator("body").innerText()).replaceAll(
      "«nuoto Sofia giovedì alle 17»",
      "",
    );
    const answers = (await network.texts()).join("\n");
    for (const secret of [
      "Marco",
      "Laura",
      "Sofia",
      "Tommaso",
      "Biscotto",
      "Colloquio con la maestra",
    ]) {
      expect(body, secret).not.toContain(secret);
      expect(answers, secret).not.toContain(secret);
    }

    await submitOf(page).click();
    await expect(savedToast(page)).toContainText("Nuoto Leo alle 17:00.");
    const rows = await savedBy(bianchi, "Giulia");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ household_id: bianchi.householdId });
    expect(rows[0]!.memberIds).toEqual([bianchi.members["Leo"]]);

    const marcoSees = await listedFor(
      casa,
      "Marco",
      "2026-10-19T00:00:00Z",
      "2026-10-26T00:00:00Z",
    );
    expect(JSON.stringify(marcoSees)).not.toContain("Nuoto Leo");
  });

  test("CA-24: finché il modulo è aperto non parte nessuna richiesta a Supabase e luogo e note escono solo con il salvataggio", async ({
    page,
    baseURL,
    casa,
  }) => {
    onlyOn("mobile");
    const urls: string[] = [];
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) urls.push(frame.url());
    });
    await openAdd(page, baseURL, casa, "Marco");
    await fieldOf(page).fill(PHRASE);
    await expect(entryOf(page)).toBeVisible();

    const network = recordNetwork(page);
    await entryOf(page).click();
    await expect(formOf(page)).toBeVisible();
    await formOf(page).getByLabel("Dove").fill("Piscina comunale, Lissone");
    await formOf(page).getByLabel("Note").fill("Portare la merenda");
    urls.push(page.url());

    const isSupabase = (url: string) =>
      /\/(rest|auth|realtime|storage|functions)\/v1\//.test(url);
    expect(
      network.requests.filter((r) => isSupabase(r.url)).map((r) => r.url),
    ).toEqual([]);

    const saved = page.waitForRequest((r) =>
      r.url().includes("/rpc/create_event"),
    );
    await submitOf(page).click();
    await saved;
    await expect(savedToast(page)).toContainText(SAVED_TOAST);
    urls.push(page.url());

    for (const url of urls) {
      const text = plain(url).toLowerCase();
      for (const part of ["nuoto", "piscina", "merenda", "lissone"]) {
        expect(text, url).not.toContain(part);
      }
    }
    const withNotes = network.requests.filter(
      (r) =>
        plain(r.url).includes("Portare la merenda") ||
        r.body.includes("Portare la merenda"),
    );
    expect(withNotes).toHaveLength(1);
    expect(withNotes[0]!.url).toContain("/rpc/create_event");
  });
});

// ---------------------------------------------------------------- Accessibilità

test.describe("Aggiungi · Impegni · modulo · accessibilità", () => {
  async function expectNoBlockingViolations(page: Page) {
    await waitForAnimationsToEnd(page);
    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter((v) =>
        ["serious", "critical"].includes(v.impact ?? ""),
      ),
    ).toEqual([]);
    const duplicates = await page.evaluate(() => {
      const seen = new Set<string>();
      const dup = new Set<string>();
      for (const el of document.querySelectorAll("[id]")) {
        if (seen.has(el.id)) dup.add(el.id);
        seen.add(el.id);
      }
      return [...dup];
    });
    expect(duplicates).toEqual([]);
  }

  test("CA-25: il modulo appena aperto non ha violazioni", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openForm(page, baseURL, casa, "Marco");
    await expectNoBlockingViolations(page);
  });

  test("CA-25: il modulo con gli errori non ha violazioni", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openForm(page, baseURL, casa, "Marco", "Nuoto Sofia giovedì");
    await formOf(page).getByLabel("Titolo").fill("");
    await submitOf(page).click();
    await expect(
      formOf(page).getByText("Scrivi il titolo dell'impegno."),
    ).toBeVisible();
    await expectNoBlockingViolations(page);
  });

  test("CA-25: il modulo in salvataggio non ha violazioni", async ({
    page,
    baseURL,
    casa,
  }) => {
    const slow = await slowSave(page);
    await openForm(page, baseURL, casa, "Marco");
    try {
      await submitOf(page).click();
      await expect(submitOf(page)).toHaveAttribute("aria-busy", "true");
      await expectNoBlockingViolations(page);
    } finally {
      slow.release();
    }
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("CA-25: il modulo con il salvataggio non riuscito non ha violazioni", async ({
    page,
    baseURL,
    casa,
  }) => {
    await failSave(page);
    await openForm(page, baseURL, casa, "Marco");
    await submitOf(page).click();
    await expect(alertsIn(formOf(page))).toHaveText(SAVE_FAILED);
    await expectNoBlockingViolations(page);
  });

  test("CA-25: il foglio «Aggiungi» con i campi dell'impegno non ha violazioni", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAdd(page, baseURL, casa, "Marco");
    await fieldOf(page).fill(PHRASE);
    await expect(impegnoFields(page).visibility).toBeVisible();
    await dayRead(page);
    await expectNoBlockingViolations(page);
  });
});
