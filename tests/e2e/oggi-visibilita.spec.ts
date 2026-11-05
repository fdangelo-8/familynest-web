import { watchNetwork } from "../fixtures/calendario";
import {
  at,
  chooseLens,
  ev,
  expect,
  expectNeverSeen,
  lensButton,
  open,
  sec,
  tabNeverEnters,
  test,
  d,
} from "../fixtures/oggi";

// Oggi (#30): lens and visibility of the events (CA-5, CA-6, CA-7), isolation
// between Nests (CA-39, CA-40). The «Solo io» of the others and the «Occupato»
// details never reach the browser: the tests look at the page, at the HTML of
// the server and at every answer the page receives.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

test.describe("lente e visibilità", () => {
  test("CA-5: un impegno di Paolo non è di Giulia con la lente «Io»; con «Nest» compare in «Prossimo»", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    const title = "Pranzo in giardino";
    await ev(bianchi, "Paolo", { title, from: "17:52", to: "18:52" });
    await open(page, baseURL, bianchi, "Giulia", { lens: "io" });
    await expect(lensButton(page, "Io")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(sec(page, "Prossimo")).toHaveCount(0);
    // «Liberi insieme» is in both lenses: «Dopo» may exist, but not with that event.
    await expect(sec(page, "Dopo")).not.toContainText(title);

    await chooseLens(page, "Nest");
    await expect(lensButton(page, "Nest")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page).toHaveURL(/\/oggi$/);
    await expect(sec(page, "Prossimo")).toContainText(title);
  });

  test("CA-6: il «Solo io» di Paolo non arriva a Giulia: né nella pagina, né nell'HTML, né nelle risposte di rete", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    const title = "Prova privata";
    await ev(bianchi, "Paolo", {
      title,
      from: "17:52",
      to: "18:52",
      visibility: "private",
    });
    const net = watchNetwork(page);
    await open(page, baseURL, bianchi, "Giulia", { lens: "nest" });
    await expect(lensButton(page, "Nest")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // Nothing else is planned: the page says so, and no row has that time.
    await expect(sec(page, "Oggi")).toContainText("Giornata libera, per ora");
    await expect(page.getByText("17:52")).toHaveCount(0);
    await expectNeverSeen(page, net.bodies, [title]);
  });

  test("CA-7: l'«Occupato» di Paolo è una riga grigia, non un link, senza fuoco, e nessun dettaglio arriva a Giulia", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    const title = "Riunione segreta";
    const place = "Ufficio Nord";
    await ev(bianchi, "Paolo", {
      title,
      from: "16:00",
      to: "17:00",
      visibility: "busy",
      place,
    });
    const net = watchNetwork(page);
    await open(page, baseURL, bianchi, "Giulia", {
      lens: "nest",
      now: at(d(0), "15:00"),
    });

    const row = sec(page, "Dopo").getByRole("group", {
      name: "Paolo ha un impegno, dalle 16:00 alle 17:00",
    });
    await expect(row).toBeVisible();
    await expect(row).toContainText("16:00");
    await expect(row).toContainText("Occupato");
    await expect(row).toContainText("Paolo");
    await expect(row).toHaveClass(/riga-evento--occupato/);
    // Not a link and not a button, and Tab never lands on it.
    await expect(
      page.getByRole("link", { name: /Paolo ha un impegno/ }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /Paolo ha un impegno/ }),
    ).toHaveCount(0);
    await expect(row.locator("a, button, [tabindex]")).toHaveCount(0);
    await tabNeverEnters(page, row);
    // It is never the «Prossimo».
    await expect(sec(page, "Prossimo")).toHaveCount(0);
    await expectNeverSeen(page, net.bodies, [title, place]);

    // With the lens «Io» the row is not there.
    await chooseLens(page, "Io");
    await expect(lensButton(page, "Io")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(
      page.getByRole("group", { name: /ha un impegno/ }),
    ).toHaveCount(0);
    await expect(
      sec(page, "Dopo").locator("a.riga-evento:not(.riga-evento--insieme)"),
    ).toHaveCount(0);
  });

  test("CA-7 (decisione 04/11): l'«Occupato» di Paolo domani non compare in «Domani», nemmeno con la lente «Nest»; l'impegno condiviso sì", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    const title = "Riunione segreta";
    const place = "Ufficio Nord";
    await ev(bianchi, "Paolo", {
      title,
      day: d(1),
      from: "10:00",
      to: "11:00",
      visibility: "busy",
      place,
    });
    await ev(bianchi, "Paolo", {
      title: "Cena in famiglia",
      day: d(1),
      from: "20:00",
      to: "22:00",
    });
    const net = watchNetwork(page);
    await open(page, baseURL, bianchi, "Giulia", {
      lens: "nest",
      now: at(d(0), "23:10"),
    });
    const domani = sec(page, "Domani");
    await expect(domani).toBeVisible();
    await expect(domani).toContainText("Cena in famiglia");
    await expect(domani).not.toContainText("Occupato");
    await expect(domani).not.toContainText("10:00");
    await expect(
      page.getByRole("group", { name: /Paolo ha un impegno/ }),
    ).toHaveCount(0);
    await expectNeverSeen(page, net.bodies, [title, place]);
  });

  test("CA-7 (decisione 04/11): con solo un «Occupato» di Paolo domani non c'è «Domani»", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await ev(bianchi, "Paolo", {
      title: "Riunione segreta",
      day: d(1),
      from: "10:00",
      to: "11:00",
      visibility: "busy",
    });
    await open(page, baseURL, bianchi, "Giulia", {
      lens: "nest",
      now: at(d(0), "23:10"),
    });
    await expect(lensButton(page, "Nest")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(sec(page, "Domani")).toHaveCount(0);
    await expect(page.getByText("Occupato")).toHaveCount(0);
    await expect(
      page.getByRole("group", { name: /Paolo ha un impegno/ }),
    ).toHaveCount(0);
  });
});

test.describe("isolamento tra nuclei", () => {
  test("CA-39: Giulia (Casa Bianchi) non vede nulla di Casa D'Angelo, con tutte e due le lenti", async ({
    page,
    baseURL,
    casa,
    bianchi,
  }) => {
    const mine = {
      event: "Cena dai nonni",
      busy: "Visita riservata",
      todo: "Firmare autorizzazione gita",
      deadline: "Bollo auto",
      shopping: "Latte",
    };
    await ev(casa, "Marco", { title: mine.event, from: "17:52", to: "18:52" });
    await ev(casa, "Marco", {
      title: mine.busy,
      from: "16:30",
      to: "17:30",
      visibility: "busy",
    });
    await casa.todo("Marco", { title: mine.todo, assignee: "Marco" });
    await casa.deadline("Marco", { title: mine.deadline, due: d(5) });
    await casa.shopping("Marco", [mine.shopping]);
    // The space «A tavola» pinned by Marco.
    const { error } = await casa.users["Marco"]!.client.rpc("pin_space", {
      p_space: "meals",
    });
    if (error) throw new Error("Spazio fissato di prova non scritto");

    const net = watchNetwork(page);
    await open(page, baseURL, bianchi, "Giulia", { lens: "io" });
    const forbidden = [...Object.values(mine), "Marco", "A tavola"];
    await expectNeverSeen(page, net.bodies, forbidden);
    await expect(page.locator(".riga-evento--occupato")).toHaveCount(0);

    await chooseLens(page, "Nest");
    await expect(lensButton(page, "Nest")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // The counters are those of Casa Bianchi: nothing to count.
    const casaSection = sec(page, "Casa");
    await expect(casaSection).toBeVisible();
    await expect(casaSection.locator("a.contatore").first()).toContainText(
      "La lista è vuota",
    );
    await expect(casaSection).toContainText("Nessuna scadenza in arrivo");
    await expect(sec(page, "I tuoi spazi")).toHaveCount(0);
    await expectNeverSeen(page, net.bodies, forbidden);
    await expect(page.locator(".riga-evento--occupato")).toHaveCount(0);
  });

  test("CA-40: il «Solo io» di Giulia non arriva a Paolo, con tutte e due le lenti", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    const title = "Regalo a sorpresa";
    await bianchi.todo("Giulia", {
      title,
      assignee: "Giulia",
      priv: true,
    });
    const net = watchNetwork(page);
    await open(page, baseURL, bianchi, "Paolo", { lens: "io" });
    await expect(sec(page, "Le mie cose")).toHaveCount(0);
    await expectNeverSeen(page, net.bodies, [title]);

    await chooseLens(page, "Nest");
    await expect(lensButton(page, "Nest")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(sec(page, "Casa")).toBeVisible();
    await expect(sec(page, "Da fare in casa")).toHaveCount(0);
    await expectNeverSeen(page, net.bodies, [title]);
  });
});
