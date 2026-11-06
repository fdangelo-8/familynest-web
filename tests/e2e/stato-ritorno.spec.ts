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
  createEvent,
  editDialog,
  expect,
  fieldOf,
  h1,
  navigateInApp,
  openForm,
  test,
} from "../fixtures/impegni";
import { waitHydrated } from "../fixtures/profilo";
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
