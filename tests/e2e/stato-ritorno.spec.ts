import type { Locator, Page } from "@playwright/test";
import {
  addDays,
  column,
  romeDay,
  romeInstant,
  setClock,
  weekdayIndex,
} from "../fixtures/casa";
import {
  card,
  createEvent,
  dayLabel,
  editDialog,
  expect,
  fieldOf,
  h1,
  navigateInApp,
  openForm,
  pressSave,
  test,
  textRx,
  toastOf,
} from "../fixtures/impegni";
import {
  accountSection,
  button,
  directionRadio,
  GOOGLE,
  linkFromPage,
  needsFake,
  openSettings,
  settingsDialog,
  targetRow,
  withLinker,
  type Linker,
} from "../fixtures/calendari-collegati";
import {
  addDialog,
  addTrigger,
  birthIn,
  createList,
  disableButton,
  editDialog as ideaDialog,
  field as ideaField,
  fillIdea,
  IDEAS,
  insertIdea,
  insertLink,
  listPath,
  nextDecember14,
  openAdd,
  openIdea,
  shareBlock,
  wishH1,
} from "../fixtures/desideri";
import {
  field as childField,
  openSheet as openChildSheet,
  pencil as childPencil,
  setBirth,
  sheetOf as childSheet,
} from "../fixtures/figlio";
import {
  deleteButton,
  deleteDialog,
  sheetOf as profileSheet,
  signOutButton,
  signOutDialog,
  valueOf,
  waitHydrated,
} from "../fixtures/profilo";
import { allRows, field, isMobile } from "../fixtures/ricerca";

// Stato che torna tornando su una pagina (#322, da #319). With
// `cacheComponents: true` Next does not unmount the page that is left: it keeps
// it hidden (React Activity) with its local state. Each test: (1) creates the
// state (dialog open, edit in progress), (2) leaves the page with the
// navigation of the app, without reloading and without `page.goto`, (3) comes
// back with the navigation of the app, (4) checks the initial state the
// specification of the page gives.
// A modal that is open covers the navigation of the frame, so there the page is
// left with the browser's Back (soft navigation, same document). A marker on
// `window` proves nobody reloaded the page. Every test builds its own
// throwaway Nest (Marco is its administrator) and deletes it at the end.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });
test.describe.configure({ timeout: 120_000 });

const MARKER = "__stateOnReturn";

async function markPage(page: Page): Promise<void> {
  await page.evaluate((key) => {
    (window as unknown as Record<string, string>)[key] = "same page";
  }, MARKER);
}

/** Fails if the document was reloaded since `markPage`. */
async function expectNotReloaded(page: Page): Promise<void> {
  const value = await page.evaluate(
    (key) => (window as unknown as Record<string, string>)[key],
    MARKER,
  );
  expect(value, "la pagina è stata ricaricata").toBe("same page");
}

/** Taps a link of the app once React has taken over (a click before is a reload). */
async function tap(link: Locator): Promise<void> {
  await expect(link).toBeVisible({ timeout: 20_000 });
  await waitHydrated(link);
  await link.click();
}

const nestSquare = (page: Page) =>
  page.getByRole("link", { name: /^Apri .*: membri, Esplora e impostazioni$/ });
const mainNav = (page: Page) =>
  page.getByRole("navigation", { name: "Navigazione principale" });

/** Opens the calendar by address: the start of every journey. */
async function startAtCalendar(page: Page): Promise<void> {
  await page.goto("/calendario");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
    timeout: 20_000,
  });
  await markPage(page);
}

/** Back with the browser: the dialog that is open covers the navigation. */
async function goBackTo(page: Page, url: RegExp): Promise<void> {
  await page.goBack();
  await expect(page).toHaveURL(url);
}

// --------------------------------------------------------- dettaglio impegno

test("CA-1 (dettaglio impegno): il modulo di modifica non si ripresenta aperto né con il testo scritto", async ({
  page,
  baseURL,
  casa,
}) => {
  const title = "Corso di prova del ritorno";
  const id = await createEvent(casa, "Marco", {
    title,
    day: romeDay(),
    from: "10:00",
    to: "10:30",
    members: ["Marco"],
  });
  await casa.signIn(page, baseURL, "Marco");
  await startAtCalendar(page);
  // The event has no handy link on both sizes (on the desktop a click only
  // chooses the block): the app's router opens it, like a link would.
  const openEvent = async () => {
    await waitHydrated(nestSquare(page));
    await navigateInApp(page, `/impegni/${id}?giorno=${romeDay()}`);
  };

  // 1. Open the event and start an edit.
  await openEvent();
  await expect(page).toHaveURL(new RegExp(`/impegni/${id}`));
  await expect(h1(page, title)).toBeVisible({ timeout: 20_000 });
  const dialog = await openForm(page);
  await fieldOf(dialog, "Titolo").fill("Titolo scritto e non salvato");
  await expect(fieldOf(dialog, "Titolo")).toHaveValue(
    "Titolo scritto e non salvato",
  );

  // 2. Leave the page.
  await goBackTo(page, /\/calendario/);

  // 3. Come back the same way.
  await openEvent();
  await expect(page).toHaveURL(new RegExp(`/impegni/${id}`));

  // 4. Specification (#19): the card, the form closed; reopened it shows the
  // saved values, not what was written before (CA-21).
  await expect(h1(page, title)).toBeVisible({ timeout: 20_000 });
  await expect(editDialog(page)).toHaveCount(0);
  const again = await openForm(page);
  await expect(fieldOf(again, "Titolo")).toHaveValue(title);
  await expectNotReloaded(page);
});

// ------------------------------------------------------------- esci dal Nest

test("CA-1 (esci dal Nest): il dialogo di conferma non si ripresenta aperto", async ({
  page,
  baseURL,
  casa,
}) => {
  await casa.signIn(page, baseURL, "Marco");
  await startAtCalendar(page);
  const settingsLink = () =>
    page.getByRole("link", { name: /^Impostazioni della casa/ });
  const leaveButton = () =>
    page.getByRole("button", { name: `Esci da ${casa.name}` });

  // 1. Nest -> Impostazioni, open the confirmation.
  await tap(nestSquare(page));
  await expect(page).toHaveURL(/\/nest$/);
  await tap(settingsLink());
  await expect(page).toHaveURL(/\/impostazioni$/);
  await waitHydrated(leaveButton());
  const dialog = page.getByRole("alertdialog");
  await expect(async () => {
    if (!(await dialog.isVisible())) await leaveButton().click();
    await expect(dialog).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 30_000 });

  // 2. Leave.
  await goBackTo(page, /\/nest$/);

  // 3. Come back through the link.
  await tap(settingsLink());
  await expect(page).toHaveURL(/\/impostazioni$/);

  // 4. Specification (#41): the page with «Esci da …», the dialog closed.
  await expect(leaveButton()).toBeVisible();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expectNotReloaded(page);
});

// --------------------------------------------------------- invita qualcuno

test("CA-1 (invita qualcuno): il foglio non si ripresenta aperto e, riaperto, è vuoto", async ({
  page,
  baseURL,
  casa,
}) => {
  await casa.signIn(page, baseURL, "Marco");
  await startAtCalendar(page);
  const invite = () => page.getByRole("button", { name: "Invita qualcuno" });
  const sheet = () => page.getByRole("dialog", { name: "Invita qualcuno" });

  // 1. Nest, open «Invita qualcuno» and write a name.
  await tap(nestSquare(page));
  await expect(page).toHaveURL(/\/nest$/);
  await waitHydrated(invite());
  await expect(async () => {
    if (!(await sheet().isVisible())) await invite().click();
    await expect(sheet()).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 30_000 });
  await sheet().getByLabel("Nome").fill("Carla");
  await expect(sheet().getByLabel("Nome")).toHaveValue("Carla");

  // 2. Leave.
  await goBackTo(page, /\/calendario/);

  // 3. Come back through the square of the Nest.
  await tap(nestSquare(page));
  await expect(page).toHaveURL(/\/nest$/);

  // 4. Specification (#17): the page, the sheet closed; closing without
  // saving loses what was written, so reopened it is empty.
  await expect(invite()).toBeVisible();
  await expect(sheet()).toHaveCount(0);
  await invite().click();
  await expect(sheet()).toBeVisible();
  await expect(sheet().getByLabel("Nome")).toHaveValue("");
  await expectNotReloaded(page);
});

// ----------------------------------------------------------------- un membro

test("CA-1 (un membro): la modifica di nome e colore non si ripresenta aperta né con il testo scritto", async ({
  page,
  baseURL,
  casa,
}) => {
  await casa.signIn(page, baseURL, "Marco");
  await startAtCalendar(page);
  const memberLink = () =>
    page.locator(`a[href="/membri/${casa.members["Laura"]}"]`);
  const editRow = () =>
    page.getByRole("button", { name: "Modifica nome e colore", exact: true });
  const sheet = () =>
    page.getByRole("dialog", { name: "Modifica Laura", exact: true });

  // 1. Nest -> Laura, open the edit and write another name.
  await tap(nestSquare(page));
  await expect(page).toHaveURL(/\/nest$/);
  await tap(memberLink());
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Laura");
  await waitHydrated(editRow());
  await expect(async () => {
    if (!(await sheet().isVisible())) await editRow().click();
    await expect(sheet()).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 30_000 });
  await sheet()
    .getByRole("textbox", { name: "Nome", exact: true })
    .fill("Lauretta");
  await expect(
    sheet().getByRole("textbox", { name: "Nome", exact: true }),
  ).toHaveValue("Lauretta");

  // 2. Leave.
  await goBackTo(page, /\/nest$/);

  // 3. Come back through the row of Laura.
  await tap(memberLink());
  await expect(page).toHaveURL(new RegExp(`/membri/${casa.members["Laura"]}`));

  // 4. Specification (#18, #144): the member, the sheet closed; reopened it
  // shows the saved name.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Laura");
  await expect(sheet()).toHaveCount(0);
  await editRow().click();
  await expect(sheet()).toBeVisible();
  await expect(
    sheet().getByRole("textbox", { name: "Nome", exact: true }),
  ).toHaveValue("Laura");
  await expectNotReloaded(page);
});

// ------------------------------------------------------------------- Da fare

test("CA-1 (Da fare): tornando dopo mezzanotte la lista usa il giorno di adesso", async ({
  page,
  baseURL,
  casa,
}) => {
  // A Sunday just before midnight: a thing due on Monday is in «Più avanti».
  const today = romeDay();
  const sunday = addDays(today, -weekdayIndex(today));
  const monday = addDays(sunday, 1);
  const title = "Pagare la bolletta del ritorno";
  await casa.todo("Marco", { title, assignee: "Marco", due: monday });

  await setClock(page, romeInstant(sunday, 23, 50));
  await casa.signIn(page, baseURL, "Marco");
  const list = column(page, "Da fare");
  const group = (name: string) =>
    list
      .locator("section.sezione")
      .filter({ has: page.getByRole("heading", { level: 3, name }) });
  const titlesOf = (scope: Locator) => scope.locator(".riga-lista__titolo");

  // 1. The page before midnight.
  await page.goto("/casa/da-fare");
  await expect(list).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  await expect(titlesOf(group("Più avanti"))).toHaveText([title]);
  await expect(group("Questa settimana")).toHaveCount(0);
  await markPage(page);

  // 2. Leave through the navigation, then midnight passes while it is hidden.
  await tap(
    mainNav(page).getByRole("link", { name: "Calendario", exact: true }),
  );
  await expect(page).toHaveURL(/\/calendario/);
  await page.clock.fastForward(20 * 60 * 1000);

  // 3. Come back (router: «Da fare» has no link in the bars of both sizes).
  await navigateInApp(page, "/casa/da-fare");
  await expect(page).toHaveURL(/\/casa\/da-fare$/);

  // 4. Specification (#23, «Date e fuso»): «oggi» and the week are read with
  // the clock of the browser, so Monday is now «Questa settimana».
  await expect(list).toBeVisible();
  await expect(titlesOf(group("Questa settimana"))).toHaveText([title]);
  await expect(group("Più avanti")).toHaveCount(0);
  await expectNotReloaded(page);
});

// ------------------------------------------------------------------ Ricerca

test("CA-1 (Ricerca, telefono): riaperta ha il fuoco nel campo; il testo rimasto è solo annotato", async ({
  page,
  baseURL,
  casa,
}, testInfo) => {
  test.skip(!isMobile(), "La pagina a tutto schermo c'è solo su telefono");
  await createEvent(casa, "Marco", {
    title: "Nuoto Sofia",
    day: addDays(romeDay(), 1),
    from: "17:00",
    to: "18:30",
    members: ["Sofia"],
  });
  await casa.signIn(page, baseURL, "Marco");
  await startAtCalendar(page);
  const lens = () =>
    page.getByRole("link", { name: "Cerca nel Nest", exact: true });

  // 1. Open the search and write a text with results.
  await tap(lens());
  await expect(page).toHaveURL(/\/ricerca$/);
  await expect(field(page)).toBeFocused({ timeout: 20_000 });
  await field(page).fill("nuoto");
  await expect(allRows(page).first()).toBeVisible({ timeout: 20_000 });

  // 2. Leave with «Annulla».
  await page.getByRole("link", { name: "Annulla", exact: true }).click();
  await expect(page).toHaveURL(/\/calendario/);

  // 3. Come back with the magnifier.
  await tap(lens());
  await expect(page).toHaveURL(/\/ricerca$/);

  // 4. Specification (#40, §3): when the search opens the focus is in the
  // field. Whether the old text and results must be gone is NOT decided by the
  // specification (§4 describes the «normale» state only for an empty field):
  // it is not imposed here, only recorded for the coordinator.
  await expect(field(page)).toBeFocused({ timeout: 20_000 });
  testInfo.annotations.push({
    type: "ricerca-testo-dopo-ritorno",
    description: JSON.stringify({
      value: await field(page).inputValue(),
      rows: await allRows(page).count(),
    }),
  });
  // No «not reloaded» check here: under 1024 px the magnifier loads /ricerca as
  // a new page by design (`SearchOverlay`, `window.location.replace`).
});

// ----------------------------------------------- #324: other pages with state

/**
 * Leaves the page with the router of the app (a sheet that is open covers the
 * navigation of the frame) and comes back with the browser's Back, a soft
 * navigation to the page that Next kept hidden.
 */
async function leaveAndComeBack(page: Page, url: RegExp): Promise<void> {
  await navigateInApp(page, "/calendario");
  await expect(page).toHaveURL(/\/calendario/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
    timeout: 20_000,
  });
  await goBackTo(page, url);
}

// Review of #325, suggestion 1: after a save `handleSaved` changes the address
// with `history.replaceState`; the page that comes back must show what was
// saved, not the event as it was before.
test("CA-1 (dettaglio impegno salvato): tornando con Indietro dopo aver cambiato il giorno, la scheda mostra i valori salvati", async ({
  page,
  baseURL,
  casa,
}) => {
  const title = "Gara di nuoto prima";
  const newTitle = "Gara di nuoto dopo";
  const day = romeDay();
  const newDay = addDays(day, 1);
  const id = await createEvent(casa, "Marco", {
    title,
    day,
    from: "10:00",
    to: "10:30",
    members: ["Marco"],
  });
  await casa.signIn(page, baseURL, "Marco");
  await startAtCalendar(page);

  // 1. Open the event (router), change title and day, save.
  await waitHydrated(nestSquare(page));
  await navigateInApp(page, `/impegni/${id}?giorno=${day}`);
  await expect(h1(page, title)).toBeVisible({ timeout: 20_000 });
  const dialog = await openForm(page);
  await fieldOf(dialog, "Titolo").fill(newTitle);
  await fieldOf(dialog, "Giorno").fill(newDay);
  await pressSave(page);
  await expect(editDialog(page)).toBeHidden();
  await expect(toastOf(page, "Modifiche salvate")).toBeVisible();
  await expect(h1(page, newTitle)).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`giorno=${newDay}`));

  // 2. Leave with the navigation of the app.
  await tap(
    mainNav(page).getByRole("link", { name: "Calendario", exact: true }),
  );
  await expect(page).toHaveURL(/\/calendario/);

  // 3. Come back with the browser's Back.
  await goBackTo(page, new RegExp(`/impegni/.*giorno=${newDay}`));

  // 4. The saved values, the form closed.
  await expect(h1(page, newTitle)).toBeVisible({ timeout: 20_000 });
  await expect(h1(page, title)).toHaveCount(0);
  await expect(card(page)).toContainText(textRx(dayLabel(newDay), false));
  await expect(editDialog(page)).toHaveCount(0);
  const again = await openForm(page);
  await expect(fieldOf(again, "Titolo")).toHaveValue(newTitle);
  await expect(fieldOf(again, "Giorno")).toHaveValue(newDay);
  await expectNotReloaded(page);
});

// ------------------------------------------------------------ profilo figlio

test("CA-1 (profilo di un figlio): il foglio di modifica non si ripresenta aperto né con il testo scritto", async ({
  page,
  baseURL,
  casa,
}) => {
  const sofia = casa.members["Sofia"]!;
  await casa.signIn(page, baseURL, "Marco");
  await startAtCalendar(page);
  const open = async () => {
    await waitHydrated(nestSquare(page));
    await navigateInApp(page, `/figli/${sofia}`);
    await expect(page).toHaveURL(new RegExp(`/figli/${sofia}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sofia", {
      timeout: 20_000,
    });
    await waitHydrated(childPencil(page, "Sofia"));
  };

  // 1. Open the profile, the edit sheet, write another name.
  await open();
  const sheet = await openChildSheet(page, "Sofia");
  await childField(sheet, "Nome").fill("Sofietta");
  await expect(childField(sheet, "Nome")).toHaveValue("Sofietta");

  // 2-3. Leave and come back.
  await leaveAndComeBack(page, new RegExp(`/figli/${sofia}$`));

  // 4. Specification (#31): «Ogni apertura riparte dai dati salvati».
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sofia");
  await expect(childSheet(page, "Sofia")).toHaveCount(0);
  const again = await openChildSheet(page, "Sofia");
  await expect(childField(again, "Nome")).toHaveValue("Sofia");
  await expectNotReloaded(page);
});

// ------------------------------------------------------------ lista desideri

test.describe("lista desideri", () => {
  async function openWishlist(page: Page, childId: string): Promise<void> {
    await waitHydrated(nestSquare(page));
    await navigateInApp(page, listPath(childId));
    await expect(h1(page, wishH1("Sofia"))).toBeVisible({ timeout: 20_000 });
  }

  test("CA-1 (lista desideri, aggiungi): il foglio non si ripresenta aperto e, riaperto, ha i campi vuoti", async ({
    page,
    baseURL,
    casa,
  }) => {
    const sofia = casa.members["Sofia"]!;
    const scope = {
      admin: casa.users["Marco"]!.admin,
      householdId: casa.householdId,
    };
    const listId = await createList(scope, sofia);
    await insertIdea(scope, listId, IDEAS.I1);
    await casa.signIn(page, baseURL, "Marco");
    await startAtCalendar(page);

    await openWishlist(page, sofia);
    await waitHydrated(addTrigger(page));
    const dialog = await openAdd(page);
    await fillIdea(dialog, { idea: "Corso di pattinaggio" });
    await expect(ideaField(dialog, "Oppure scrivi l'idea")).toHaveValue(
      "Corso di pattinaggio",
    );

    await leaveAndComeBack(page, new RegExp(`/figli/${sofia}/lista-desideri`));

    // Specification (#32): «Ogni apertura riparte da campi vuoti».
    await expect(h1(page, wishH1("Sofia"))).toBeVisible();
    await expect(addDialog(page)).toHaveCount(0);
    const again = await openAdd(page);
    await expect(ideaField(again, "Oppure scrivi l'idea")).toHaveValue("");
    await expect(ideaField(again, "Link del negozio")).toHaveValue("");
    await expectNotReloaded(page);
  });

  test("CA-1 (lista desideri, modifica): il foglio non si ripresenta aperto né con il testo scritto", async ({
    page,
    baseURL,
    casa,
  }) => {
    const sofia = casa.members["Sofia"]!;
    const scope = {
      admin: casa.users["Marco"]!.admin,
      householdId: casa.householdId,
    };
    const listId = await createList(scope, sofia);
    await insertIdea(scope, listId, IDEAS.I1);
    await casa.signIn(page, baseURL, "Marco");
    await startAtCalendar(page);

    await openWishlist(page, sofia);
    const dialog = await openIdea(page, IDEAS.I1.title);
    await ideaField(dialog, "Nota per chi regala").fill("Quello blu");

    await leaveAndComeBack(page, new RegExp(`/figli/${sofia}/lista-desideri`));

    // Specification (#32 §5.3): closing without saving loses what was written.
    await expect(h1(page, wishH1("Sofia"))).toBeVisible();
    await expect(ideaDialog(page)).toHaveCount(0);
    const again = await openIdea(page, IDEAS.I1.title);
    await expect(ideaField(again, "Nota per chi regala")).toHaveValue(
      IDEAS.I1.note!,
    );
    await expectNotReloaded(page);
  });

  test("CA-1 (lista desideri, disattiva il link): il dialogo di conferma non si ripresenta aperto", async ({
    page,
    baseURL,
    casa,
  }) => {
    const sofia = casa.members["Sofia"]!;
    const scope = {
      admin: casa.users["Marco"]!.admin,
      householdId: casa.householdId,
    };
    const listId = await createList(scope, sofia);
    await insertIdea(scope, listId, IDEAS.I1);
    await setBirth(scope.admin, sofia, birthIn(10));
    await insertLink(scope, listId, { occasion: nextDecember14() });
    await casa.signIn(page, baseURL, "Marco");
    await startAtCalendar(page);

    await openWishlist(page, sofia);
    await expect(shareBlock(page)).toContainText("Condivisa con un link");
    await waitHydrated(disableButton(page));
    await disableButton(page).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();

    await leaveAndComeBack(page, new RegExp(`/figli/${sofia}/lista-desideri`));

    await expect(h1(page, wishH1("Sofia"))).toBeVisible();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(shareBlock(page)).toContainText("Condivisa con un link");
    await expectNotReloaded(page);
  });
});

// ------------------------------------------------------ calendari collegati

test.describe("calendari collegati", () => {
  test.describe.configure({ timeout: 180_000 });

  /** U linked to the standard Google, on the page, marked as not reloaded. */
  async function linkedPage(u: Linker, page: Page) {
    await u.prepare(GOOGLE);
    await u.signIn(page);
    await linkFromPage(page, "google");
    await markPage(page);
    return accountSection(page, "google", GOOGLE.email);
  }
  const back = /\/calendari-collegati$/;

  test("CA-1 (calendari collegati, impostazioni di un calendario): il foglio non si ripresenta aperto né con la scelta non salvata", async ({
    page,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      const section = await linkedPage(u, page);
      const dialog = await openSettings(page, section, "Personale");
      await directionRadio(dialog, "Solo in entrata").click();
      await expect(directionRadio(dialog, "Solo in entrata")).toBeChecked();

      await leaveAndComeBack(page, back);

      // Specification (#34): closing without «Salva» changes nothing.
      await expect(settingsDialog(page, "Personale")).toHaveCount(0);
      const again = await openSettings(
        page,
        accountSection(page, "google", GOOGLE.email),
        "Personale",
      );
      await expect(directionRadio(again, "Solo in entrata")).not.toBeChecked();
      await expectNotReloaded(page);
    });
  });

  test("CA-1 (calendari collegati, collega un altro account): il foglio non si ripresenta aperto", async ({
    page,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await linkedPage(u, page);
      await button(page, "Collega un altro account").click();
      const connect = page.getByRole("dialog", {
        name: "Collega un altro account",
      });
      await expect(connect).toBeVisible();

      await leaveAndComeBack(page, back);

      await expect(connect).toHaveCount(0);
      await expectNotReloaded(page);
    });
  });

  test("CA-1 (calendari collegati, dove vanno i nuovi impegni): il foglio non si ripresenta aperto né con la scelta non salvata", async ({
    page,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await linkedPage(u, page);
      const value = targetRow(page).locator(".riga-lista__valore");
      await expect(value).toHaveText("Personale");
      await targetRow(page).click();
      const target = page.getByRole("dialog", {
        name: "Dove vanno i nuovi impegni",
        exact: true,
      });
      await expect(target).toBeVisible();
      await target.getByRole("radio", { name: /^Nessuno/ }).click();

      await leaveAndComeBack(page, back);

      await expect(target).toHaveCount(0);
      await expect(value).toHaveText("Personale");
      await targetRow(page).click();
      await expect(
        target.getByRole("radio", { name: /^Personale · Google/ }),
      ).toBeChecked();
      await expectNotReloaded(page);
    });
  });
});

// ------------------------------------------------------------------- profilo

test.describe("profilo", () => {
  async function openProfilePage(page: Page): Promise<void> {
    await waitHydrated(nestSquare(page));
    await navigateInApp(page, "/profilo");
    await expect(page).toHaveURL(/\/profilo$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: 20_000,
    });
    await waitHydrated(signOutButton(page));
  }

  test("CA-1 (profilo, scelta «All'apertura»): il foglio non si ripresenta aperto", async ({
    page,
    baseURL,
    casa,
  }) => {
    await casa.signIn(page, baseURL, "Marco");
    await startAtCalendar(page);
    await openProfilePage(page);
    const before = await valueOf(page, "All'apertura").innerText();
    await valueOf(page, "All'apertura").click();
    await expect(profileSheet(page, "All'apertura")).toBeVisible();

    await leaveAndComeBack(page, /\/profilo$/);

    // Specification (#38 §4): the sheets are closed; the choice is the saved one.
    await expect(signOutButton(page)).toBeVisible();
    await expect(profileSheet(page, "All'apertura")).toHaveCount(0);
    await expect(valueOf(page, "All'apertura")).toHaveText(before);
    await expectNotReloaded(page);
  });

  test("CA-1 (profilo, «Sintesi del mattino»): il foglio dell'orario non si ripresenta aperto", async ({
    page,
    baseURL,
    casa,
  }) => {
    await casa.signIn(page, baseURL, "Marco");
    await startAtCalendar(page);
    await openProfilePage(page);
    await valueOf(page, "Sintesi del mattino").click();
    await expect(profileSheet(page, "Sintesi del mattino")).toBeVisible();

    await leaveAndComeBack(page, /\/profilo$/);

    await expect(signOutButton(page)).toBeVisible();
    await expect(profileSheet(page, "Sintesi del mattino")).toHaveCount(0);
    await expectNotReloaded(page);
  });

  test("CA-1 (profilo, «Esci»): il dialogo di conferma non si ripresenta aperto", async ({
    page,
    baseURL,
    casa,
  }) => {
    await casa.signIn(page, baseURL, "Marco");
    await startAtCalendar(page);
    await openProfilePage(page);
    await signOutButton(page).click();
    await expect(signOutDialog(page)).toBeVisible();

    await leaveAndComeBack(page, /\/profilo$/);

    // Specification (#38): «Annulla»/Esc close it; the page stays as it was.
    await expect(signOutButton(page)).toBeVisible();
    await expect(signOutDialog(page)).toHaveCount(0);
    await expectNotReloaded(page);
  });

  test("CA-1 (profilo, «Elimina l'account»): il dialogo di conferma non si ripresenta aperto", async ({
    page,
    baseURL,
    casa,
  }) => {
    await casa.signIn(page, baseURL, "Marco");
    await startAtCalendar(page);
    await openProfilePage(page);
    await waitHydrated(deleteButton(page));
    await deleteButton(page).click();
    await expect(deleteDialog(page)).toBeVisible();

    await leaveAndComeBack(page, /\/profilo$/);

    await expect(deleteButton(page)).toBeVisible();
    await expect(deleteDialog(page)).toHaveCount(0);
    await expectNotReloaded(page);
  });
});

// Calendario · Giorno (`DayPage`, `openPiece`): NOT tested on purpose. The
// panel «Altri impegni» (desktop, block «+N») is a choice of the user inside
// the page, and the specification of #26 says only that it is kept while the
// data update («la scelta fatta a mano dall'utente non cambia») and that the
// «Impegno» panel restarts from the rule of §7 when the day changes. It does
// not say what happens when the page is left and reached again: to be decided.
