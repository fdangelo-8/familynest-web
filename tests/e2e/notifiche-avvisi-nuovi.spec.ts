import { createEvent } from "../fixtures/impegni";
import {
  at,
  bell,
  day,
  expect,
  insertAvviso,
  loaded,
  newRows,
  open,
  openLink,
  PATH,
  rowOf,
  rows,
  test,
  textOf,
  unreadCount,
  reload,
  withPageAt,
} from "../fixtures/notifiche";
import type { CasaNest } from "../fixtures/notifiche";

// Notifiche (#613, PR #629): the five kinds of avviso of #511 on the page and
// in the bell: CA-2 and CA-3.
//
// IMPORTANT: these tests insert rows of kinds and with columns that exist only
// in the database of #612 (`db/notifiche-2-parte-2`). They pass only AFTER the
// merge of #612 (or on a merge of the two branches); on the database of today
// the insert is refused. They are not skipped on purpose.
//
// The clock of the browser is on T, the most recent Tuesday, at 12:00: the
// events are on day(1), so the texts say «domani».

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

const WHEN = at(0, "09:00");

async function swimming(nest: CasaNest, title: string, members: string[]) {
  return createEvent(nest, "Paolo", {
    title,
    day: day(1),
    from: "17:00",
    to: "18:00",
    members,
  });
}

test.describe("avvisi nuovi", () => {
  test("CA-2: la pagina mostra gli avvisi nuovi con i testi di i18n, segnati letti all'apertura, e la campanella torna a zero", async ({
    page,
    baseURL,
    nest,
  }) => {
    const reminder = await swimming(nest, "Nuoto", ["Giulia"]);
    const escort = await swimming(nest, "Calcio", ["Leo"]);
    const pickup = await swimming(nest, "Danza", ["Leo"]);
    const mineA = await swimming(nest, "Pediatra", ["Giulia"]);
    const mineB = await createEvent(nest, "Paolo", {
      title: "Dentista",
      day: day(1),
      from: "17:30",
      to: "18:30",
      members: ["Giulia"],
    });
    const otherA = await swimming(nest, "Basket", ["Leo"]);
    const otherB = await createEvent(nest, "Paolo", {
      title: "Inglese",
      day: day(1),
      from: "17:30",
      to: "18:30",
      members: ["Leo"],
    });
    const request = await swimming(nest, "Judo", ["Leo"]);

    await insertAvviso(
      nest,
      { kind: "member_joined", recipient: "Giulia", actor: "Paolo" },
      at(0, "08:00"),
    );
    await insertAvviso(
      nest,
      {
        kind: "event_reminder",
        recipient: "Giulia",
        eventId: reminder,
        occurrence: day(1),
      },
      at(0, "08:10"),
    );
    await insertAvviso(
      nest,
      {
        kind: "ride_reminder",
        recipient: "Giulia",
        eventId: escort,
        occurrence: day(1),
        leg: "escort",
      },
      at(0, "08:20"),
    );
    await insertAvviso(
      nest,
      {
        kind: "ride_reminder",
        recipient: "Giulia",
        eventId: pickup,
        occurrence: day(1),
        leg: "pickup",
      },
      at(0, "08:30"),
    );
    await insertAvviso(
      nest,
      {
        kind: "overlap_tomorrow",
        recipient: "Giulia",
        eventId: mineA,
        occurrence: day(1),
        otherEventId: mineB,
        otherOccurrence: day(1),
        subject: "Giulia",
      },
      at(0, "08:40"),
    );
    await insertAvviso(
      nest,
      {
        kind: "overlap_tomorrow",
        recipient: "Giulia",
        eventId: otherA,
        occurrence: day(1),
        otherEventId: otherB,
        otherOccurrence: day(1),
        subject: "Leo",
      },
      at(0, "08:50"),
    );
    await insertAvviso(
      nest,
      {
        kind: "ride_request",
        recipient: "Giulia",
        actor: "Paolo",
        eventId: request,
        occurrence: day(1),
        leg: "escort",
      },
      at(0, "08:55"),
    );
    await insertAvviso(
      nest,
      {
        kind: "ride_request",
        recipient: "Giulia",
        actor: "Paolo",
        eventId: pickup,
        occurrence: day(1),
        leg: "pickup",
      },
      at(0, "08:58"),
    );

    // The bell counts all eight before the page is opened.
    await open(page, baseURL, nest, "Giulia", { path: "/oggi", pause: false });
    const counted = page.getByRole("link", { name: "Notifiche, 8 nuove" });
    await expect(counted).toBeVisible();
    await counted.click();
    await expect(page).toHaveURL(/\/notifiche$/);
    await expect(rows(page)).toHaveCount(8);
    await expect(newRows(page)).toHaveCount(8);

    await expect(textOf(rowOf(page, "ha accettato l'invito"))).toHaveText(
      "Nuova. Paolo ha accettato l'invito: ora avete lo stesso calendario e le stesse liste.",
    );
    await expect(textOf(rowOf(page, "Promemoria"))).toHaveText(
      "Nuova. Promemoria: Nuoto, domani alle 17:00.",
    );
    await expect(textOf(rowOf(page, "Calcio"))).toHaveText(
      "Nuova. Tocca a te portare, domani alle 17:00: Calcio.",
    );
    await expect(textOf(rowOf(page, "Tocca a te riprendere"))).toHaveText(
      "Nuova. Tocca a te riprendere, domani alle 18:00: Danza.",
    );
    await expect(textOf(rowOf(page, "Sei in due posti insieme"))).toHaveText(
      "Nuova. Domani, alla stessa ora: Pediatra e Dentista. Sei in due posti insieme.",
    );
    await expect(textOf(rowOf(page, "Riguarda Leo"))).toHaveText(
      "Nuova. Domani, alla stessa ora: Basket e Inglese. Riguarda Leo.",
    );
    await expect(textOf(rowOf(page, "ti chiede di portare"))).toHaveText(
      "Nuova. Paolo ti chiede di portare, domani alle 17:00: Judo.",
    );
    await expect(textOf(rowOf(page, "ti chiede di riprendere"))).toHaveText(
      "Nuova. Paolo ti chiede di riprendere, domani alle 18:00: Danza.",
    );

    // Opening the page reads them all, like the other kinds.
    await expect.poll(() => unreadCount(nest, "Giulia")).toBe(0);
    await reload(page);
    await expect(rows(page)).toHaveCount(8);
    await expect(newRows(page)).toHaveCount(0);
    await page.goto("/oggi");
    await loaded(page);
    const quiet = page.getByRole("link", { name: "Notifiche", exact: true });
    await expect(quiet).toBeVisible();
    await expect(quiet.locator(".btn-icona__punto")).toHaveCount(0);
    await expect(bell(page)).toHaveAccessibleName("Notifiche");
  });

  test("CA-2: member_joined mostra solo il testo, senza azioni", async ({
    page,
    baseURL,
    nest,
  }) => {
    await insertAvviso(
      nest,
      { kind: "member_joined", recipient: "Giulia", actor: "Paolo" },
      WHEN,
    );
    await open(page, baseURL, nest, "Giulia", { pause: false });

    const row = rowOf(page, "ha accettato l'invito");
    await expect(row).toBeVisible();
    await expect(row.getByRole("link")).toHaveCount(0);
    await expect(row.getByRole("button")).toHaveCount(0);
    await expect.poll(() => unreadCount(nest, "Giulia")).toBe(0);
  });

  test("CA-2: gli avvisi sull'impegno hanno «Apri», che porta all'impegno", async ({
    page,
    baseURL,
    nest,
  }) => {
    const id = await swimming(nest, "Nuoto", ["Giulia"]);
    await insertAvviso(
      nest,
      {
        kind: "event_reminder",
        recipient: "Giulia",
        eventId: id,
        occurrence: day(1),
      },
      WHEN,
    );
    await open(page, baseURL, nest, "Giulia", { pause: false });

    const link = openLink(rowOf(page, "Promemoria: Nuoto"));
    await expect(link).toHaveAttribute(
      "href",
      `/impegni/${id}?giorno=${day(1)}`,
    );
  });

  test("CA-3: ride_request ha «Vedi l'impegno», che porta all'impegno, e non «Apri»", async ({
    page,
    baseURL,
    nest,
  }) => {
    const id = await swimming(nest, "Nuoto", ["Leo", "Giulia"]);
    await insertAvviso(
      nest,
      {
        kind: "ride_request",
        recipient: "Giulia",
        actor: "Paolo",
        eventId: id,
        occurrence: day(1),
        leg: "escort",
      },
      WHEN,
    );
    await open(page, baseURL, nest, "Giulia", { pause: false });

    const row = rowOf(page, "ti chiede di portare");
    await expect(textOf(row)).toHaveText(
      "Nuova. Paolo ti chiede di portare, domani alle 17:00: Nuoto.",
    );
    await expect(openLink(row)).toHaveCount(0);
    const link = row.getByRole("link", { name: "Vedi l'impegno", exact: true });
    await expect(link).toHaveAttribute(
      "href",
      `/impegni/${id}?giorno=${day(1)}`,
    );
    await link.click();
    await expect(page).toHaveURL(new RegExp(`/impegni/${id}`));
  });

  test("CA-2: isolamento, ciò che è per Giulia non lo vede Paolo e non lo vede un altro Nest", async ({
    page,
    browser,
    baseURL,
    nest,
    solo,
  }) => {
    const id = await swimming(nest, "Nuoto", ["Giulia"]);
    await insertAvviso(
      nest,
      { kind: "member_joined", recipient: "Giulia", actor: "Paolo" },
      WHEN,
    );
    await insertAvviso(
      nest,
      {
        kind: "event_reminder",
        recipient: "Giulia",
        eventId: id,
        occurrence: day(1),
      },
      WHEN,
    );

    // Same Nest, another recipient: nothing, and the bell stays quiet.
    await open(page, baseURL, nest, "Paolo", { pause: false });
    await expect(page.getByText("Tutto tranquillo")).toBeVisible();
    await expect(rows(page)).toHaveCount(0);
    await expect(page.getByText("ha accettato l'invito")).toHaveCount(0);
    await expect(page.getByText("Promemoria")).toHaveCount(0);
    expect(await unreadCount(nest, "Paolo")).toBe(0);
    expect(await unreadCount(nest, "Giulia")).toBe(2);

    // Another Nest: nothing either (a new browser context, own session).
    await withPageAt(
      browser,
      page.viewportSize(),
      baseURL,
      solo,
      "Rita",
      at(0, "12:00"),
      async (other) => {
        await expect(other).toHaveURL(new RegExp(`${PATH}$`));
        await expect(other.getByText("Tutto tranquillo")).toBeVisible();
        await expect(other.getByText("Nuoto")).toHaveCount(0);
      },
    );
  });

  test("CA-2: stato vuoto, senza avvisi la pagina dice «Tutto tranquillo» e la campanella è a zero", async ({
    page,
    baseURL,
    solo,
  }) => {
    // The bell is on Oggi (on mobile it is not in the frame of this page).
    await open(page, baseURL, solo, "Rita", { path: "/oggi", pause: false });
    await expect(bell(page)).toHaveAccessibleName("Notifiche");

    await page.goto(PATH);
    await loaded(page);
    await expect(page.getByText("Tutto tranquillo")).toBeVisible();
    await expect(rows(page)).toHaveCount(0);
  });
});
