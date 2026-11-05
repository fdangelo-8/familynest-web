import { capitalise, dateText, setClock, weekdayName } from "../fixtures/casa";
import {
  alertWith,
  assign,
  at,
  bell,
  day,
  expect,
  failRequests,
  holdRequests,
  isMobileProject,
  loaded,
  markAllButton,
  newRows,
  notificationRows,
  open,
  PATH,
  REST_NOTIFICATIONS,
  rowOf,
  rows,
  runJob,
  sectionNews,
  sectionTitles,
  setPreference,
  T,
  test,
  toast,
  unreadCount,
  reload,
  RPC_MARK_READ,
} from "../fixtures/notifiche";

// Notifiche (#39), list, states, read and unread, bell: CA-22 ... CA-32 and CA-56.
// The clock of the browser is on T, the most recent Tuesday (the «martedì 20
// ottobre» of the criteria). Every test builds its own throwaway Nest.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

const FIRMARE = "Firmare autorizzazione gita";
const ERROR_TITLE = "Questa pagina non si è caricata";
const ERROR_TEXT =
  "Controlla la connessione e riprova. Se il problema resta, torna a Oggi.";

test.describe("elenco", () => {
  test("CA-22: le sezioni vanno dal giorno più recente, le righe dalla più recente, e ogni riga ha la sua ora", async ({
    page,
    baseURL,
    nest,
  }) => {
    await assign(nest, "Cosa uno", { when: at(0, "14:20") });
    await assign(nest, "Cosa due", { when: at(0, "08:00") });
    await assign(nest, "Cosa tre", { when: at(-1, "19:05") });
    await assign(nest, "Cosa quattro", { when: at(-3, "12:00") });
    await open(page, baseURL, nest, "Giulia", { time: at(0, "15:00") });

    const older = `${capitalise(weekdayName(day(-3)))} ${dateText(T, day(-3))}`;
    await expect(sectionTitles(page)).toHaveText(["Oggi", "Ieri", older]);
    await expect(rows(page)).toContainText([
      "Cosa uno",
      "Cosa due",
      "Cosa tre",
      "Cosa quattro",
    ]);
    await expect(page.locator(".riga-notifica__ora")).toHaveText([
      "14:20",
      "8:00",
      "19:05",
      "12:00",
    ]);
  });

  test("CA-23: «N nuove» nella testa del giorno, il pallino e «Nuova.» solo sulle non lette", async ({
    page,
    baseURL,
    nest,
  }) => {
    await assign(nest, "Cosa uno", { when: at(0, "09:00") });
    await assign(nest, "Cosa due", { when: at(0, "10:00") });
    await assign(nest, "Cosa tre", { when: at(0, "11:00") });
    await assign(nest, "Cosa quattro", {
      when: at(-1, "09:00"),
      readAt: at(-1, "20:00"),
    });
    await assign(nest, "Cosa cinque", {
      when: at(-1, "10:00"),
      readAt: at(-1, "20:00"),
    });
    await open(page, baseURL, nest, "Giulia", { time: at(0, "15:00") });

    const today = page.locator(`section[data-sezione="${day(0)}"]`);
    const yesterday = page.locator(`section[data-sezione="${day(-1)}"]`);
    await expect(today.locator(".sezione__testa")).toContainText("3 nuove");
    await expect(yesterday.locator(".sezione__testa")).not.toContainText(
      "nuov",
    );
    await expect(today.locator("li.riga-notifica.is-nuova")).toHaveCount(3);
    await expect(today.locator(".riga-notifica__testo")).toHaveText([
      /^Nuova\./,
      /^Nuova\./,
      /^Nuova\./,
    ]);
    await expect(yesterday.locator("li.riga-notifica")).toHaveCount(2);
    await expect(yesterday.locator("li.is-nuova")).toHaveCount(0);
    await expect(yesterday.locator(".riga-notifica__testo")).toHaveText([
      /^Paolo/,
      /^Paolo/,
    ]);
  });

  test("CA-24: si vedono le notifiche degli ultimi 30 giorni e la pulizia toglie le più vecchie dal database", async ({
    page,
    baseURL,
    nest,
  }) => {
    await assign(nest, "Cosa vecchia", { when: at(-31, "12:00") });
    await assign(nest, "Cosa recente", { when: at(-29, "12:00") });
    await open(page, baseURL, nest, "Giulia");

    await expect(rows(page)).toHaveCount(1);
    await expect(rowOf(page, "Cosa recente")).toHaveCount(1);
    await expect(rowOf(page, "Cosa vecchia")).toHaveCount(0);

    expect(await runJob(nest, "purge", at(0, "12:00"))).toBe(1);
    const left = await notificationRows(nest, "Giulia");
    expect(left).toHaveLength(1);
    expect(new Date(left[0]?.created_at ?? "").getTime()).toBe(
      at(-29, "12:00").getTime(),
    );
  });
});

test.describe("stati", () => {
  test("CA-25 (vuoto): senza notifiche c'è «Tutto tranquillo» e, a 1280, «Segna tutte come lette» è disabilitato", async ({
    page,
    baseURL,
    solo,
  }) => {
    await setPreference(solo, "Rita", "morning_digest", false);
    await open(page, baseURL, solo, "Rita");

    await expect(page.getByText("Tutto tranquillo")).toBeVisible();
    await expect(
      page.getByText(
        "Quando qualcuno ti assegna una cosa o si avvicina una scadenza, lo trovi qui.",
      ),
    ).toBeVisible();
    await expect(rows(page)).toHaveCount(0);
    await expect(page.getByTestId("sintesi")).toHaveCount(0);
    if (!isMobileProject()) {
      await expect(markAllButton(page)).toBeDisabled();
    }
  });

  test("CA-26 (caricamento): scheletri con «Caricamento in corso», e la barra o l'intestazione sono già quelle giuste", async ({
    page,
    baseURL,
    nest,
  }) => {
    await assign(nest, FIRMARE, { when: at(0, "09:00") });
    await setClock(page, at(0, "12:00"));
    await nest.signIn(page, baseURL, "Giulia");
    const release = await holdRequests(page, REST_NOTIFICATIONS, "GET");
    await page.goto(PATH);

    // Two containers can coexist for an instant (loading.tsx and the page).
    const group = page
      .locator('[aria-busy="true"][aria-live="polite"]')
      .first();
    await expect(group).toBeVisible();
    await expect(group).toContainText("Caricamento in corso");
    await expect(
      page.getByRole("heading", { level: 1, name: "Notifiche" }),
    ).toBeVisible();
    if (isMobileProject()) {
      await expect(
        page.getByRole("link", { name: "Impostazioni delle notifiche" }),
      ).toBeVisible();
    } else {
      await expect(markAllButton(page)).toBeVisible();
      await expect(markAllButton(page)).toBeDisabled();
    }

    release();
    await loaded(page);
    await expect(rowOf(page, FIRMARE)).toBeVisible();
  });

  test("CA-27 (errore): se la lettura risponde 500 c'è l'errore di pagina, e «Riprova» mostra l'elenco", async ({
    page,
    baseURL,
    nest,
  }) => {
    await assign(nest, FIRMARE, { when: at(0, "09:00") });
    await setClock(page, at(0, "12:00"));
    await nest.signIn(page, baseURL, "Giulia");
    const restore = await failRequests(
      page,
      REST_NOTIFICATIONS,
      "GET",
      "server",
    );
    await page.goto(PATH);
    await loaded(page);

    await expect(page.getByText(ERROR_TITLE)).toBeVisible();
    await expect(page.getByText(ERROR_TEXT)).toBeVisible();
    await expect(page.getByRole("button", { name: "Riprova" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Torna a Oggi" }),
    ).toHaveAttribute("href", "/oggi");
    await expect(rows(page)).toHaveCount(0);
    await expect(page.getByText("boom")).toHaveCount(0);
    // The frame stays: the gear on mobile, the bell on desktop.
    if (isMobileProject()) {
      await expect(
        page.getByRole("link", { name: "Impostazioni delle notifiche" }),
      ).toBeVisible();
    } else {
      await expect(bell(page)).toBeVisible();
    }

    await restore();
    await page.getByRole("button", { name: "Riprova" }).click();
    await expect(rowOf(page, FIRMARE)).toBeVisible();
    await expect(page.getByText(ERROR_TITLE)).toHaveCount(0);
  });

  test("CA-56: aprendo la pagina senza rete si vede l'errore di pagina e nessuna riga", async ({
    page,
    baseURL,
    nest,
  }) => {
    await assign(nest, FIRMARE, { when: at(0, "09:00") });
    await setClock(page, at(0, "12:00"));
    await nest.signIn(page, baseURL, "Giulia");
    await failRequests(page, /\/rest\/v1\//, "GET", "network");
    await failRequests(page, /\/rest\/v1\//, "POST", "network");
    await page.goto(PATH);
    await loaded(page);

    await expect(page.getByText(ERROR_TITLE)).toBeVisible();
    await expect(page.getByText(ERROR_TEXT)).toBeVisible();
    await expect(page.getByRole("button", { name: "Riprova" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Torna a Oggi" }),
    ).toBeVisible();
    await expect(rows(page)).toHaveCount(0);
  });
});

test.describe("letta e non letta", () => {
  test("CA-28: la campanella conta le nuove, la pagina le mostra col pallino e alla visita dopo sono lette", async ({
    page,
    baseURL,
    nest,
  }) => {
    await assign(nest, "Cosa uno", { when: at(0, "09:00") });
    await assign(nest, "Cosa due", { when: at(0, "10:00") });
    await open(page, baseURL, nest, "Giulia", { path: "/oggi", pause: false });

    const counted = page.getByRole("link", { name: "Notifiche, 2 nuove" });
    await expect(counted).toBeVisible();
    await expect(counted.locator(".btn-icona__punto")).toHaveCount(1);

    await counted.click();
    await expect(page).toHaveURL(/\/notifiche$/);
    await expect(rows(page)).toHaveCount(2);
    await expect(newRows(page)).toHaveCount(2);

    // Opening the page marks them read; wait for it before the next visit.
    await expect.poll(() => unreadCount(nest, "Giulia")).toBe(0);
    await reload(page);
    await expect(rows(page)).toHaveCount(2);
    await expect(newRows(page)).toHaveCount(0);

    await page.goto("/oggi");
    await loaded(page);
    const quiet = page.getByRole("link", { name: "Notifiche", exact: true });
    await expect(quiet).toBeVisible();
    await expect(quiet.locator(".btn-icona__punto")).toHaveCount(0);
  });

  test("CA-29: una notifica nata dopo l'apertura compare alla visita dopo, col pallino; quella di prima no", async ({
    page,
    baseURL,
    nest,
  }) => {
    await assign(nest, "Chiamare il dentista", { when: at(0, "09:00") });
    await open(page, baseURL, nest, "Giulia", { pause: false });
    await expect(rowOf(page, "Chiamare il dentista")).toHaveClass(/is-nuova/);
    await expect.poll(() => unreadCount(nest, "Giulia")).toBe(0);

    await assign(nest, "Ritirare il pacco", { when: at(0, "10:00") });
    await reload(page);
    await expect(rows(page)).toHaveCount(2);
    await expect(rowOf(page, "Ritirare il pacco")).toHaveClass(/is-nuova/);
    await expect(rowOf(page, "Chiamare il dentista")).not.toHaveClass(
      /is-nuova/,
    );
  });

  test("CA-30: «Segna tutte come lette» toglie subito pallini, «3 nuove» e pallino della campanella", async ({
    page,
    baseURL,
    nest,
  }) => {
    test.skip(isMobileProject(), "Il bottone c'è solo a 1280 px");
    for (const [title, time] of [
      ["Cosa uno", "09:00"],
      ["Cosa due", "10:00"],
      ["Cosa tre", "11:00"],
    ] as const) {
      await assign(nest, title, { when: at(0, time) });
    }
    await open(page, baseURL, nest, "Giulia");

    await expect(newRows(page)).toHaveCount(3);
    await expect(sectionNews(page)).toHaveText(["3 nuove"]);
    await expect(
      page.getByRole("link", { name: "Notifiche, 3 nuove" }),
    ).toBeVisible();

    const button = markAllButton(page);
    await expect(button).toBeEnabled();
    await button.click();

    await expect(newRows(page)).toHaveCount(0);
    await expect(sectionNews(page)).toHaveCount(0);
    const quiet = page.getByRole("link", { name: "Notifiche", exact: true });
    await expect(quiet).toBeVisible();
    await expect(quiet.locator(".btn-icona__punto")).toHaveCount(0);
    await expect(button).toHaveAttribute("aria-disabled", "true");
    await expect(button).toBeFocused();
    await expect(
      page.getByRole("status").filter({
        hasText: "Tutte le notifiche sono segnate come lette.",
      }),
    ).toHaveCount(1);
    await expect(toast(page)).toHaveCount(0);
    await expect.poll(() => unreadCount(nest, "Giulia")).toBe(0);
  });

  test("CA-31 (errore): se il salvataggio non riesce i pallini restano, compare l'avviso e il bottone torna attivo con il fuoco", async ({
    page,
    baseURL,
    nest,
  }) => {
    test.skip(isMobileProject(), "Il bottone c'è solo a 1280 px");
    for (const [title, time] of [
      ["Cosa uno", "09:00"],
      ["Cosa due", "10:00"],
      ["Cosa tre", "11:00"],
    ] as const) {
      await assign(nest, title, { when: at(0, time) });
    }
    await open(page, baseURL, nest, "Giulia");
    await expect(newRows(page)).toHaveCount(3);

    const button = markAllButton(page);
    const restore = await failRequests(page, RPC_MARK_READ, "POST", "server");
    await button.click();

    await expect(
      alertWith(
        page,
        "Non siamo riusciti a segnare le notifiche come lette per un problema nostro. Riprova tra qualche minuto.",
      ),
    ).toBeVisible();
    await expect(newRows(page)).toHaveCount(3);
    await expect(sectionNews(page)).toHaveText(["3 nuove"]);
    await expect(button).toBeEnabled();
    await expect(button).not.toHaveAttribute("aria-disabled", "true");
    await expect(button).toBeFocused();

    await restore();
    await failRequests(page, RPC_MARK_READ, "POST", "network");
    await button.click();
    await expect(
      alertWith(
        page,
        "Non siamo riusciti a segnare le notifiche come lette. Controlla la connessione e riprova.",
      ),
    ).toBeVisible();
    await expect(newRows(page)).toHaveCount(3);
    await expect(button).toBeFocused();
  });

  test("CA-32: a 390 c'è la barra con l'ingranaggio e non «Segna tutte»; a 1280 c'è l'intestazione e la campanella è la pagina corrente", async ({
    page,
    baseURL,
    nest,
  }) => {
    await open(page, baseURL, nest, "Giulia");

    await expect(page).toHaveTitle("FamilyNest · Notifiche");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Notifiche",
    );
    if (isMobileProject()) {
      await expect(markAllButton(page)).toHaveCount(0);
      await expect(
        page.getByRole("link", { name: "Impostazioni delle notifiche" }),
      ).toHaveAttribute("href", "/impostazioni#notifiche");
    } else {
      await expect(markAllButton(page)).toBeVisible();
      await expect(
        page
          .getByRole("main")
          .getByRole("link", { name: "Impostazioni delle notifiche" }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("link", { name: "Notifiche", exact: true }),
      ).toHaveAttribute("aria-current", "page");
    }
  });
});
