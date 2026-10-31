import type { Page } from "@playwright/test";
import {
  buttonOf,
  card,
  confirmDialog,
  createEvent,
  createNuoto,
  deleteEventAsOther,
  detailPath,
  editDialog,
  eventRow,
  expect,
  failRequests,
  fieldOf,
  h1,
  listDays,
  longTitle,
  NUOTO,
  openDetail,
  openForm,
  pressSave,
  RPC_DELETE,
  test,
  textRx,
  toastOf,
  type CasaNest,
} from "../fixtures/impegni";

// Dettaglio impegno (#19), PR #174: eliminare un impegno o una sua volta, con il
// toast sul calendario (CA-35 – CA-42 e CA-61).

test.use({ locale: "it-IT", reducedMotion: "reduce" });
test.describe.configure({ timeout: 90_000 });

const NOT_ANYMORE = "Questo impegno non c'è più";
const DELETE_FAILED =
  "Non riusciamo a eliminare l'impegno. Controlla la connessione e riprova.";

/** «Cena da Marta» of Giulia: does not repeat, with Giulia and Paolo. */
function createCena(bianchi: CasaNest): Promise<string> {
  return createEvent(bianchi, "Giulia", {
    title: "Cena da Marta",
    day: "2026-10-23",
    from: "20:00",
    to: "22:00",
    members: ["Giulia", "Paolo"],
  });
}

/** Opens the form and then the dialog to delete. */
async function askToDelete(page: Page) {
  const dialog = await openForm(page);
  await buttonOf(dialog, "Elimina impegno").click();
  const confirm = confirmDialog(page);
  await expect(confirm).toBeVisible();
  return { dialog, confirm };
}

test.describe("il dialogo di eliminazione", () => {
  test("CA-35: per un impegno che non si ripete dice chi non lo vedrà più, e «Annulla» torna al modulo", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    const id = await createCena(bianchi);
    await openDetail(page, baseURL, bianchi, "Giulia", id, "2026-10-23");
    await expect(h1(page, "Cena da Marta")).toBeVisible();
    const { confirm } = await askToDelete(page);
    await expect(confirm).toHaveAccessibleName("Eliminare «Cena da Marta»?");
    await expect(confirm).toHaveAccessibleDescription(
      "Paolo non lo vedrà più nel calendario.",
    );
    await expect(confirm.getByRole("button")).toHaveText([
      "Elimina impegno",
      "Annulla",
    ]);

    await buttonOf(confirm, "Annulla").click();
    await expect(confirmDialog(page)).toHaveCount(0);
    await expect(editDialog(page)).toBeVisible();
  });

  test("CA-37: per una serie dice la regola e chi non la vedrà più, con tre bottoni", async ({
    page,
    baseURL,
    casa,
  }) => {
    const id = await createNuoto(casa);
    await openDetail(page, baseURL, casa, "Marco", id, "2026-10-20");
    await expect(h1(page, NUOTO)).toBeVisible();
    const { confirm } = await askToDelete(page);
    await expect(confirm).toHaveAccessibleName("Eliminare «Nuoto Sofia»?");
    await expect(confirm).toHaveAccessibleDescription(
      "Si ripete ogni martedì e giovedì. Laura e Sofia non lo vedranno più nel calendario.",
    );
    await expect(confirm.getByRole("button")).toHaveText([
      "Elimina tutti i prossimi",
      "Elimina solo questo",
      "Annulla",
    ]);
  });
});

test.describe("eliminare", () => {
  test("CA-36: eliminare un impegno porta al calendario con il toast e lo toglie davvero", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    const id = await createCena(bianchi);
    await openDetail(page, baseURL, bianchi, "Giulia", id, "2026-10-23");
    await expect(h1(page, "Cena da Marta")).toBeVisible();
    const { confirm } = await askToDelete(page);
    await buttonOf(confirm, "Elimina impegno").click();

    await expect(page).toHaveURL(/\/calendario\?settimana=2026-10-19$/);
    const toast = toastOf(page, textRx("Eliminato: Cena da Marta."));
    await expect(toast).toBeVisible();
    await expect(toast.locator("b")).toHaveText("Cena da Marta");
    await expect(toast.locator("svg").first()).toBeVisible();
    await expect(toast.getByRole("button")).toHaveCount(0);
    // It leaves by itself after 5 seconds.
    await expect(toast).toBeHidden({ timeout: 15_000 });

    await page.goto(detailPath(id, "2026-10-23"));
    await expect(h1(page, NOT_ANYMORE)).toBeVisible();
    expect(await eventRow(bianchi, id)).toBeNull();
  });

  test("CA-38: «Elimina solo questo» toglie quella volta e basta", async ({
    page,
    baseURL,
    casa,
  }) => {
    const id = await createNuoto(casa);
    await openDetail(page, baseURL, casa, "Marco", id, "2026-10-20");
    await expect(h1(page, NUOTO)).toBeVisible();
    const { confirm } = await askToDelete(page);
    await buttonOf(confirm, "Elimina solo questo").click();

    await expect(page).toHaveURL(/\/calendario\?settimana=2026-10-19$/);
    await expect(
      toastOf(page, textRx("Eliminato martedì 20 ottobre: Nuoto Sofia.")),
    ).toBeVisible();

    await page.goto(detailPath(id, "2026-10-20"));
    await expect(h1(page, NOT_ANYMORE)).toBeVisible();
    for (const day of ["2026-10-22", "2026-10-27"]) {
      await page.goto(detailPath(id, day));
      await expect(h1(page, NUOTO)).toBeVisible();
    }
    const week = await listDays(casa, "Marco", "2026-10-19", "2026-10-26");
    expect(
      week.filter((row) => row.title === NUOTO).map((row) => row.day),
    ).toEqual(["2026-10-22"]);
  });

  test("CA-39: «Elimina tutti i prossimi» toglie quella volta e le seguenti", async ({
    page,
    baseURL,
    casa,
  }) => {
    const id = await createNuoto(casa);
    await openDetail(page, baseURL, casa, "Marco", id, "2026-10-22");
    await expect(h1(page, NUOTO)).toBeVisible();
    const { confirm } = await askToDelete(page);
    await buttonOf(confirm, "Elimina tutti i prossimi").click();

    await expect(page).toHaveURL(/\/calendario\?settimana=2026-10-19$/);
    await expect(
      toastOf(
        page,
        textRx("Eliminato da giovedì 22 ottobre in poi: Nuoto Sofia."),
      ),
    ).toBeVisible();

    await page.goto(detailPath(id, "2026-10-20"));
    await expect(h1(page, NUOTO)).toBeVisible();
    await expect(
      card(page).getByText(
        textRx("Ogni martedì e giovedì, fino al 21 ottobre"),
      ),
    ).toBeVisible();
    for (const day of ["2026-10-22", "2026-10-27"]) {
      await page.goto(detailPath(id, day));
      await expect(h1(page, NOT_ANYMORE)).toBeVisible();
    }
  });

  test("CA-39: «Elimina tutti i prossimi» dalla prima volta toglie tutto l'impegno", async ({
    page,
    baseURL,
    casa,
  }) => {
    const id = await createNuoto(casa);
    await openDetail(page, baseURL, casa, "Marco", id, "2026-10-06");
    await expect(h1(page, NUOTO)).toBeVisible();
    const { confirm } = await askToDelete(page);
    await buttonOf(confirm, "Elimina tutti i prossimi").click();

    await expect(page).toHaveURL(/\/calendario\?settimana=2026-10-05$/);
    await expect(
      toastOf(page, textRx("Eliminato: Nuoto Sofia.")),
    ).toBeVisible();
    expect(await eventRow(casa, id)).toBeNull();
  });

  test("CA-40: una volta tolta sparisce per tutti, anche dalla riga «Occupato» degli altri", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    const id = await createEvent(bianchi, "Paolo", {
      title: "Turno in ufficio",
      day: "2026-10-06",
      from: "09:00",
      to: "10:00",
      visibility: "busy",
      members: ["Paolo"],
      repeat: { kind: "weekly", weekdays: [2, 4] },
    });
    await openDetail(page, baseURL, bianchi, "Paolo", id, "2026-10-20");
    await expect(h1(page, "Turno in ufficio")).toBeVisible();
    const { confirm } = await askToDelete(page);
    await buttonOf(confirm, "Elimina solo questo").click();
    await expect(page).toHaveURL(/\/calendario\?settimana=2026-10-19$/);

    const asGiulia = await listDays(
      bianchi,
      "Giulia",
      "2026-10-19",
      "2026-10-26",
    );
    expect(asGiulia.map((row) => row.day)).toEqual(["2026-10-22"]);
    expect(asGiulia[0]?.masked).toBe(true);
  });

  test("CA-41: se l'eliminazione fallisce il dialogo resta aperto con l'avviso, e l'impegno c'è ancora", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    const id = await createCena(bianchi);
    await openDetail(page, baseURL, bianchi, "Giulia", id, "2026-10-23");
    await expect(h1(page, "Cena da Marta")).toBeVisible();
    await failRequests(page, RPC_DELETE);
    const { confirm } = await askToDelete(page);
    await buttonOf(confirm, "Elimina impegno").click();

    await expect(
      confirm.getByRole("alert").filter({ hasText: DELETE_FAILED }),
    ).toBeVisible();
    await expect(confirm).toBeVisible();
    await expect(page).toHaveURL(/\/impegni\//);
    await expect(toastOf(page, /Eliminato/)).toHaveCount(0);
    expect(await eventRow(bianchi, id)).not.toBeNull();
  });

  test("CA-42: se nel frattempo l'ha eliminato un altro, salvare porta a «Non c'è più» senza toast", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    const id = await createEvent(bianchi, "Paolo", {
      title: "Mercatino",
      day: "2026-10-24",
      from: "10:00",
      to: "12:00",
      members: ["Leo"],
    });
    await openDetail(page, baseURL, bianchi, "Giulia", id, "2026-10-24");
    await expect(h1(page, "Mercatino")).toBeVisible();
    const dialog = await openForm(page);
    await fieldOf(dialog, "Titolo").fill("Mercatino dell'usato");
    await deleteEventAsOther(bianchi, id);
    await pressSave(page);

    await expect(h1(page, NOT_ANYMORE)).toBeVisible();
    await expect(editDialog(page)).toHaveCount(0);
    await expect(toastOf(page, /Modifiche salvate|Eliminato/)).toHaveCount(0);
  });

  test("CA-42: se nel frattempo l'ha eliminato un altro, eliminare porta a «Non c'è più» senza toast", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    const id = await createEvent(bianchi, "Paolo", {
      title: "Mercatino",
      day: "2026-10-24",
      from: "10:00",
      to: "12:00",
      members: ["Leo"],
    });
    await openDetail(page, baseURL, bianchi, "Giulia", id, "2026-10-24");
    await expect(h1(page, "Mercatino")).toBeVisible();
    const { confirm } = await askToDelete(page);
    await deleteEventAsOther(bianchi, id);
    await buttonOf(confirm, "Elimina impegno").click();

    await expect(h1(page, NOT_ANYMORE)).toBeVisible();
    await expect(confirmDialog(page)).toHaveCount(0);
    await expect(toastOf(page, /Modifiche salvate|Eliminato/)).toHaveCount(0);
  });
});

test.describe("il toast con un titolo lungo", () => {
  test("CA-61: un titolo di 100 caratteri sta intero nel toast, va a capo e non ha i puntini", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    const title = longTitle();
    const id = await createEvent(bianchi, "Giulia", {
      title,
      day: "2026-10-23",
      from: "09:00",
      to: "15:00",
      members: ["Giulia"],
    });
    await openDetail(page, baseURL, bianchi, "Giulia", id, "2026-10-23");
    await expect(h1(page, title)).toBeVisible();
    const { confirm } = await askToDelete(page);
    await buttonOf(confirm, "Elimina impegno").click();

    await expect(page).toHaveURL(/\/calendario\?settimana=2026-10-19$/);
    const toast = toastOf(page, "Eliminato:");
    await expect(toast).toBeVisible();
    await expect(toast.locator("b")).toHaveText(title);

    const look = await toast.evaluate((element) => {
      const box = element.getBoundingClientRect();
      let ellipsis = false;
      for (const node of [element, ...element.querySelectorAll("*")]) {
        if (getComputedStyle(node).textOverflow === "ellipsis") ellipsis = true;
      }
      const title = element.querySelector("b");
      return {
        ellipsis,
        left: box.left,
        right: box.right,
        width: window.innerWidth,
        overflows: element.scrollWidth > element.clientWidth + 1,
        lines: title ? title.getClientRects().length : 0,
      };
    });
    expect(look.ellipsis).toBe(false);
    expect(look.overflows).toBe(false);
    expect(look.left).toBeGreaterThanOrEqual(0);
    expect(look.right).toBeLessThanOrEqual(look.width);
    if (look.width <= 500) expect(look.lines).toBeGreaterThan(1);
  });
});
