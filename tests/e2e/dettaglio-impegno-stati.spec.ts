import type { Page } from "@playwright/test";
import {
  blockingViolations,
  buttonOf,
  chipOf,
  confirmDialog,
  createEvent,
  createNuoto,
  detailPath,
  duplicateIds,
  editDialog,
  expect,
  failRequests,
  fieldOf,
  h1,
  holdRequests,
  NUOTO,
  openDetail,
  openForm,
  pageEditButton,
  pressSave,
  RPC_READ,
  test,
  toastOf,
  type CasaNest,
} from "../fixtures/impegni";

// Dettaglio impegno (#19), PR #174: caricamento, errore di pagina, accessibilità
// di ogni stato e tastiera (CA-43 – CA-46).

test.use({ locale: "it-IT", reducedMotion: "reduce" });
test.describe.configure({ timeout: 90_000 });

const NOT_ANYMORE = "Questo impegno non c'è più";
const ERROR_TITLE = "Questa pagina non si è caricata";

// ------------------------------------------------- caricamento ed errore

test.describe("caricamento ed errore di pagina", () => {
  test("CA-43: mentre legge, la pagina mostra gli scheletri con aria-busy e la navigazione", async ({
    page,
    baseURL,
    casa,
  }) => {
    const id = await createNuoto(casa);
    await casa.signIn(page, baseURL, "Marco");
    const release = await holdRequests(page, RPC_READ, "continue");
    await page.goto(detailPath(id, "2026-10-20"));

    const busy = page.locator('[aria-busy="true"]').first();
    await expect(busy).toBeAttached();
    await expect(busy).toContainText("Caricamento in corso");
    await expect(
      page.getByRole("navigation", { name: "Navigazione principale" }),
    ).toBeVisible();

    release();
    await expect(h1(page, NUOTO)).toBeVisible();
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  });

  test("CA-44: se la lettura fallisce c'è l'errore con «Riprova», e riprovando si vede l'impegno", async ({
    page,
    baseURL,
    casa,
  }) => {
    const id = await createNuoto(casa);
    await casa.signIn(page, baseURL, "Marco");
    await failRequests(page, RPC_READ);
    await page.goto(detailPath(id, "2026-10-20"));

    await expect(h1(page, ERROR_TITLE)).toBeVisible();
    const retry = page.getByRole("button", { name: "Riprova" });
    await expect(retry).toBeVisible();
    const text = await page.getByRole("main").innerText();
    expect(text).not.toMatch(
      /PGRST|fetch|TypeError|error|exception|\b\d{3}\b/i,
    );

    await page.unroute(RPC_READ);
    await retry.click();
    await expect(h1(page, NUOTO)).toBeVisible();
  });
});

// --------------------------------------------------------- accessibilità

/** The page as it is: no serious or critical violations, no duplicated ids. */
async function expectAccessible(page: Page) {
  expect(await blockingViolations(page)).toEqual([]);
  expect(await duplicateIds(page)).toEqual([]);
}

function createCena(bianchi: CasaNest): Promise<string> {
  return createEvent(bianchi, "Giulia", {
    title: "Cena da Marta",
    day: "2026-10-23",
    from: "20:00",
    to: "22:00",
    members: ["Giulia", "Paolo"],
  });
}

test.describe("accessibilità degli stati", () => {
  test("CA-45: scheda", async ({ page, baseURL, casa }) => {
    const id = await createNuoto(casa);
    await openDetail(page, baseURL, casa, "Marco", id, "2026-10-20");
    await expect(h1(page, NUOTO)).toBeVisible();
    await expectAccessible(page);
  });

  test("CA-45: modulo aperto", async ({ page, baseURL, casa }) => {
    const id = await createNuoto(casa);
    await openDetail(page, baseURL, casa, "Marco", id, "2026-10-20");
    await expect(h1(page, NUOTO)).toBeVisible();
    await openForm(page);
    await expectAccessible(page);
  });

  test("CA-45: dialogo di eliminazione di una serie", async ({
    page,
    baseURL,
    casa,
  }) => {
    const id = await createNuoto(casa);
    await openDetail(page, baseURL, casa, "Marco", id, "2026-10-20");
    await expect(h1(page, NUOTO)).toBeVisible();
    const dialog = await openForm(page);
    await buttonOf(dialog, "Elimina impegno").click();
    await expect(confirmDialog(page)).toBeVisible();
    await expectAccessible(page);
  });

  test("CA-45: dialogo di eliminazione di un impegno che non si ripete", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    const id = await createCena(bianchi);
    await openDetail(page, baseURL, bianchi, "Giulia", id, "2026-10-23");
    await expect(h1(page, "Cena da Marta")).toBeVisible();
    const dialog = await openForm(page);
    await buttonOf(dialog, "Elimina impegno").click();
    await expect(confirmDialog(page)).toBeVisible();
    await expectAccessible(page);
  });

  test("CA-45: dialogo del salvataggio con due scelte", async ({
    page,
    baseURL,
    casa,
  }) => {
    const id = await createNuoto(casa);
    await openDetail(page, baseURL, casa, "Marco", id, "2026-10-22");
    await expect(h1(page, NUOTO)).toBeVisible();
    const dialog = await openForm(page);
    await fieldOf(dialog, "Titolo").fill("Nuoto");
    await pressSave(page);
    await expect(confirmDialog(page)).toBeVisible();
    await expectAccessible(page);
  });

  test("CA-45: dialogo del salvataggio con una scelta", async ({
    page,
    baseURL,
    casa,
  }) => {
    const id = await createNuoto(casa);
    await openDetail(page, baseURL, casa, "Marco", id, "2026-10-22");
    await expect(h1(page, NUOTO)).toBeVisible();
    const dialog = await openForm(page);
    await chipOf(dialog, "Chi", "Tommaso").click();
    await pressSave(page);
    await expect(confirmDialog(page)).toBeVisible();
    await expectAccessible(page);
  });

  test("CA-45: errore sotto «Giorno»", async ({ page, baseURL, casa }) => {
    const id = await createNuoto(casa);
    await openDetail(page, baseURL, casa, "Marco", id, "2026-10-20");
    await expect(h1(page, NUOTO)).toBeVisible();
    const dialog = await openForm(page);
    await fieldOf(dialog, "Giorno").fill("2026-10-22");
    await pressSave(page);
    await buttonOf(confirmDialog(page), "Salva solo questo").click();
    await expect(fieldOf(dialog, "Giorno")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(confirmDialog(page)).toHaveCount(0);
    await expectAccessible(page);
  });

  test("CA-45: caricamento", async ({ page, baseURL, casa }) => {
    const id = await createNuoto(casa);
    await casa.signIn(page, baseURL, "Marco");
    const release = await holdRequests(page, RPC_READ, "continue");
    await page.goto(detailPath(id, "2026-10-20"));
    await expect(page.locator('[aria-busy="true"]').first()).toBeAttached();
    await expectAccessible(page);
    release();
    await expect(h1(page, NUOTO)).toBeVisible();
  });

  test("CA-45: «Non c'è più»", async ({ page, baseURL, casa }) => {
    const id = await createNuoto(casa);
    await openDetail(page, baseURL, casa, "Marco", id, "2026-10-21");
    await expect(h1(page, NOT_ANYMORE)).toBeVisible();
    await expectAccessible(page);
  });

  test("CA-45: errore di pagina", async ({ page, baseURL, casa }) => {
    const id = await createNuoto(casa);
    await casa.signIn(page, baseURL, "Marco");
    await failRequests(page, RPC_READ);
    await page.goto(detailPath(id, "2026-10-20"));
    await expect(h1(page, ERROR_TITLE)).toBeVisible();
    await expectAccessible(page);
  });

  test("CA-45: toast dopo l'eliminazione, sul calendario", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    const id = await createCena(bianchi);
    await openDetail(page, baseURL, bianchi, "Giulia", id, "2026-10-23");
    await expect(h1(page, "Cena da Marta")).toBeVisible();
    const dialog = await openForm(page);
    await buttonOf(dialog, "Elimina impegno").click();
    await buttonOf(confirmDialog(page), "Elimina impegno").click();
    await expect(page).toHaveURL(/\/calendario\?settimana=2026-10-19$/);
    await expect(toastOf(page, "Eliminato:")).toBeVisible();
    // The loading state and the page of the calendar coexist for a moment.
    await expect(page.getByRole("main")).toHaveCount(1);
    await expectAccessible(page);
  });
});

// ---------------------------------------------------------------- tastiera

test.describe("tastiera", () => {
  test("CA-46: il fuoco resta nel modulo con Tab e torna al bottone con Esc", async ({
    page,
    baseURL,
    casa,
  }) => {
    const id = await createNuoto(casa);
    await openDetail(page, baseURL, casa, "Marco", id, "2026-10-20");
    await expect(h1(page, NUOTO)).toBeVisible();
    const opener = pageEditButton(page);
    await openForm(page);

    const insideTheDialog = () =>
      page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'));
    for (let step = 0; step < 30; step++) {
      await page.keyboard.press("Tab");
      expect(await insideTheDialog(), `Tab ${step + 1}`).toBe(true);
    }
    for (let step = 0; step < 6; step++) {
      await page.keyboard.press("Shift+Tab");
      expect(await insideTheDialog(), `Maiusc+Tab ${step + 1}`).toBe(true);
    }

    await page.keyboard.press("Escape");
    await expect(editDialog(page)).toBeHidden();
    await expect(opener).toBeFocused();
  });
});
