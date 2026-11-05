import { setClock } from "../fixtures/casa";
import { createEvent } from "../fixtures/impegni";
import {
  alertWith,
  at,
  day,
  digest,
  expect,
  failRequests,
  loaded,
  open,
  pageText,
  reload,
  rows,
  RPC_LIST_EVENTS,
  sentence,
  setLens,
  setMorningTime,
  setPreference,
  T,
  test,
  withPageAt,
  assign,
} from "../fixtures/notifiche";

// Notifiche (#39), morning summary: CA-1 ... CA-8 and CA-40 ... CA-43.
//
// Time: the clock of the browser is set on T, the most recent Tuesday (the
// «martedì 20 ottobre 2026» of the criteria), at the hour of the criterion.
// Every test builds its own throwaway Nest: N = Casa Bianchi with Giulia and
// Paolo (accounts) and the child Leo; U = a Nest with one adult.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

const TOP = (name: string, time: string) => `${name} · ${time}`;

test.describe("sintesi del mattino", () => {
  test("CA-1: alle 7:30 la sintesi dice il prossimo impegno e le due parole portano all'impegno", async ({
    page,
    baseURL,
    nest,
  }) => {
    const call = await createEvent(nest, "Paolo", {
      title: "Call con Acme",
      day: T,
      from: "16:00",
      to: "17:00",
      members: ["Giulia"],
    });
    await open(page, baseURL, nest, "Giulia", { time: at(0, "07:30") });

    const region = digest(page, "Il tuo martedì");
    await expect(region).toBeVisible();
    await expect(region).toContainText(TOP("Il tuo martedì", "7:30"));
    await expect(region).toContainText("Sintesi");
    await expect(sentence(page)).toContainText("Alle 16:00 hai Call con Acme.");
    const href = `/impegni/${call}?giorno=${T}`;
    await expect(
      region.getByRole("link", { name: "16:00", exact: true }),
    ).toHaveAttribute("href", href);
    await expect(
      region.getByRole("link", { name: "Call con Acme", exact: true }),
    ).toHaveAttribute("href", href);
  });

  test("CA-2: prima dell'ora scelta la sintesi non c'è; con le 8:30 compare alle 8:30", async ({
    page,
    browser,
    baseURL,
    nest,
  }) => {
    await createEvent(nest, "Paolo", {
      title: "Call con Acme",
      day: T,
      from: "16:00",
      to: "17:00",
      members: ["Giulia"],
    });
    const viewport = page.viewportSize();
    const region = (p: typeof page) => digest(p, "Il tuo martedì");

    await withPageAt(
      browser,
      viewport,
      baseURL,
      nest,
      "Giulia",
      at(0, "07:29"),
      async (p) => {
        await expect(region(p)).toHaveCount(0);
      },
    );

    await setMorningTime(nest, "Giulia", "08:30");
    await withPageAt(
      browser,
      viewport,
      baseURL,
      nest,
      "Giulia",
      at(0, "08:00"),
      async (p) => {
        await expect(region(p)).toHaveCount(0);
      },
    );
    await withPageAt(
      browser,
      viewport,
      baseURL,
      nest,
      "Giulia",
      at(0, "08:30"),
      async (p) => {
        await expect(region(p)).toBeVisible();
        await expect(region(p)).toContainText(TOP("Il tuo martedì", "8:30"));
      },
    );
  });

  test("CA-3: con «Sintesi del mattino» spenta la sintesi non c'è", async ({
    page,
    baseURL,
    nest,
  }) => {
    await createEvent(nest, "Paolo", {
      title: "Call con Acme",
      day: T,
      from: "16:00",
      to: "17:00",
      members: ["Giulia"],
    });
    await setPreference(nest, "Giulia", "morning_digest", false);
    await open(page, baseURL, nest, "Giulia", { time: at(0, "12:00") });

    await expect(digest(page, "Il tuo martedì")).toHaveCount(0);
    await expect(page.getByTestId("sintesi")).toHaveCount(0);
    await expect(page.getByText("Sintesi", { exact: true })).toHaveCount(0);
  });

  test("CA-4: la sintesi usa solo quello che resta della giornata, mai un impegno già finito", async ({
    page,
    browser,
    baseURL,
    nest,
  }) => {
    for (const [title, from, to] of [
      ["Colazione", "09:00", "10:00"],
      ["Pranzo", "12:00", "13:00"],
      ["Call con Acme", "16:00", "17:00"],
      ["Corso", "20:00", "21:00"],
    ] as const) {
      await createEvent(nest, "Giulia", {
        title,
        day: T,
        from,
        to,
        members: ["Giulia"],
      });
    }
    const viewport = page.viewportSize();

    await withPageAt(
      browser,
      viewport,
      baseURL,
      nest,
      "Giulia",
      at(0, "13:30"),
      async (p) => {
        await expect(digest(p, "Il tuo martedì")).toBeVisible();
        await expect(sentence(p)).toContainText(
          "Alle 16:00 hai Call con Acme.",
        );
        for (const gone of ["Colazione", "Pranzo", "Corso"]) {
          await expect(sentence(p)).not.toContainText(gone);
        }
      },
    );
    await withPageAt(
      browser,
      viewport,
      baseURL,
      nest,
      "Giulia",
      at(0, "12:30"),
      async (p) => {
        await expect(sentence(p)).toContainText("Alle 12:00 hai Pranzo.");
      },
    );
  });

  test("CA-5 (privacy): la sintesi non mostra titolo né ora di un «Occupato» o «Solo io» di un altro", async ({
    page,
    baseURL,
    nest,
  }) => {
    await createEvent(nest, "Paolo", {
      title: "Visita privata",
      day: T,
      from: "10:00",
      to: "11:00",
      visibility: "busy",
      members: [],
    });
    await createEvent(nest, "Paolo", {
      title: "Regalo sorpresa",
      day: T,
      from: "11:00",
      to: "12:00",
      visibility: "private",
      members: [],
    });
    await setLens(nest, "Giulia", "nest");
    await open(page, baseURL, nest, "Giulia", { time: at(0, "07:30") });

    await expect(digest(page, "Il tuo martedì")).toBeVisible();
    const text = await pageText(page);
    for (const secret of [
      "Visita privata",
      "Regalo sorpresa",
      "10:00",
      "11:00",
    ]) {
      expect(text).not.toContain(secret);
    }
  });

  test("CA-6: con la lente «Nest» la sintesi dice l'impegno di altri e i da fare per lei, senza la spesa", async ({
    page,
    baseURL,
    nest,
  }) => {
    await setLens(nest, "Giulia", "nest");
    await createEvent(nest, "Paolo", {
      title: "Nuoto Leo",
      day: T,
      from: "17:00",
      to: "18:00",
      members: ["Paolo", "Leo"],
    });
    await nest.shopping("Paolo", ["Latte", "Pane"]);
    // Self-assigned: no notification row, so the titles are only in the summary.
    await nest.todo("Giulia", {
      title: "Chiamare il commercialista",
      assignee: "Giulia",
      due: day(1),
    });
    await nest.todo("Giulia", {
      title: "Pagare la mensa",
      assignee: "Giulia",
      due: day(5),
    });
    await open(page, baseURL, nest, "Giulia", {
      time: at(0, "07:30"),
      pause: false,
    });

    const region = digest(page, "Il tuo martedì");
    await expect(region).toBeVisible();
    await expect(sentence(page)).toContainText("Alle 17:00 c'è Nuoto Leo.");
    await expect(sentence(page)).toContainText(
      "Da fare per te: Chiamare il commercialista e un'altra cosa.",
    );
    await expect(
      region.getByRole("link", { name: "Chiamare il commercialista" }),
    ).toHaveAttribute("href", "/casa/da-fare");
    await expect(
      region.getByRole("link", { name: "Pagare la mensa" }),
    ).toHaveCount(0);
    await expect(sentence(page)).not.toContainText("spesa");

    await nest.todo("Giulia", {
      title: "Ritirare il pacco",
      assignee: "Giulia",
    });
    await reload(page);
    await expect(sentence(page)).toHaveText(/ e altre 2 cose\.$/);
  });

  test("CA-7: se è libera anche stasera la sintesi lo dice, con la parola «liberi dalle 18:00»", async ({
    page,
    baseURL,
    nest,
  }) => {
    // Any visible event of the week makes the calendar look for free evenings.
    await createEvent(nest, "Paolo", {
      title: "Dentista Leo",
      day: day(2),
      from: "10:00",
      to: "11:00",
      members: ["Leo"],
    });
    await open(page, baseURL, nest, "Giulia", { time: at(0, "07:30") });

    await expect(digest(page, "Il tuo martedì")).toBeVisible();
    await expect(sentence(page)).toHaveText(
      "Stasera tu e Paolo siete liberi dalle 18:00.",
    );
    const word = sentence(page).getByRole("link", {
      name: "liberi dalle 18:00",
      exact: true,
    });
    await expect(word).toHaveAttribute("href", "/calendario");
    await expect(word).toHaveClass(/parola--insieme/);
  });

  test("CA-8 (vuoto): la domenica, senza niente, la sintesi lo dice e sotto c'è «Tutto tranquillo»", async ({
    page,
    baseURL,
    solo,
  }) => {
    await open(page, baseURL, solo, "Rita", { time: at(5, "07:30") });

    const region = digest(page, "La tua domenica");
    await expect(region).toBeVisible();
    await expect(region).toContainText(TOP("La tua domenica", "7:30"));
    await expect(sentence(page)).toHaveText(
      "Per il resto della giornata non hai niente in programma.",
    );
    await expect(region.getByRole("link")).toHaveCount(0);
    await expect(page.getByText("Tutto tranquillo")).toBeVisible();
    await expect(rows(page)).toHaveCount(0);
  });
});

test.describe("sintesi: casi della specifica grafica", () => {
  test("CA-40: impegno, sera di tutta la casa e liberi insieme stanno nella stessa frase", async ({
    page,
    browser,
    baseURL,
    nest,
  }) => {
    await createEvent(nest, "Paolo", {
      title: "Call con Acme",
      day: T,
      from: "16:00",
      to: "17:00",
      members: ["Giulia"],
    });
    const cena = await createEvent(nest, "Paolo", {
      title: "Cena dai nonni",
      day: T,
      from: "18:30",
      to: "21:30",
      members: ["Giulia", "Paolo", "Leo"],
    });
    const viewport = page.viewportSize();

    await withPageAt(
      browser,
      viewport,
      baseURL,
      nest,
      "Giulia",
      at(0, "07:30"),
      async (p) => {
        await expect(sentence(p)).toHaveText(
          "Alle 16:00 hai Call con Acme. Stasera tutti insieme: Cena dai nonni, poi tu e Paolo siete liberi dalle 21:30.",
        );
        await expect(
          sentence(p).getByRole("link", { name: "Cena dai nonni" }),
        ).toHaveAttribute("href", `/impegni/${cena}?giorno=${T}`);
        await expect(
          sentence(p).getByRole("link", { name: "liberi dalle 21:30" }),
        ).toHaveAttribute("href", "/calendario");
      },
    );
    await withPageAt(
      browser,
      viewport,
      baseURL,
      nest,
      "Giulia",
      at(0, "17:30"),
      async (p) => {
        await expect(sentence(p)).toHaveText(
          "Stasera tutti insieme: Cena dai nonni, poi tu e Paolo siete liberi dalle 21:30.",
        );
        await expect(sentence(p)).not.toContainText("Alle 18:30");
      },
    );
  });

  test("CA-41: con un solo da fare la frase finisce con il suo titolo", async ({
    page,
    baseURL,
    nest,
  }) => {
    await nest.todo("Giulia", {
      title: "Chiamare il commercialista",
      assignee: "Giulia",
    });
    await open(page, baseURL, nest, "Giulia", { time: at(0, "07:30") });

    await expect(sentence(page)).toContainText(
      "Da fare per te: Chiamare il commercialista.",
    );
  });

  test("CA-42: una parola lunga più di 24 caratteri va a capo, una corta no", async ({
    page,
    baseURL,
    nest,
  }) => {
    await createEvent(nest, "Giulia", {
      title: "Call con Acme",
      day: T,
      from: "16:00",
      to: "17:00",
      members: ["Giulia"],
    });
    await nest.todo("Giulia", {
      title: "Prenotare la revisione dell'auto",
      assignee: "Giulia",
    });
    await open(page, baseURL, nest, "Giulia", { time: at(0, "07:30") });

    const region = digest(page, "Il tuo martedì");
    await expect(
      region.getByRole("link", { name: "Prenotare la revisione dell'auto" }),
    ).toHaveClass(/parola--a-capo/);
    await expect(
      region.getByRole("link", { name: "Call con Acme", exact: true }),
    ).not.toHaveClass(/parola--a-capo/);
  });

  test("CA-43 (errore della sintesi): le notifiche si vedono e «Riprova» rilegge solo la sintesi", async ({
    page,
    baseURL,
    nest,
  }) => {
    await assign(nest, "Firmare autorizzazione gita", {
      when: at(0, "06:00"),
    });
    await setClock(page, at(0, "07:30"));
    const restore = await failRequests(page, RPC_LIST_EVENTS, "POST", "server");
    await nest.signIn(page, baseURL, "Giulia");
    await page.goto("/notifiche");
    await loaded(page);

    const failure = alertWith(
      page,
      "Non riusciamo a caricare la sintesi di oggi. Controlla la connessione e riprova.",
    );
    await expect(failure).toBeVisible();
    await expect(
      failure.getByRole("button", { name: "Riprova" }),
    ).toBeVisible();
    await expect(digest(page, "Il tuo martedì")).toHaveCount(0);
    await expect(rows(page)).toHaveCount(1);

    await restore();
    await failure.getByRole("button", { name: "Riprova" }).click();
    await expect(digest(page, "Il tuo martedì")).toBeVisible();
    await expect(failure).toHaveCount(0);
    await expect(rows(page)).toHaveCount(1);
  });
});
