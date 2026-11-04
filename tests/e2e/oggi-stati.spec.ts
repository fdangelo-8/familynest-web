import {
  alerts,
  at,
  busy,
  chooseLens,
  d,
  ev,
  expect,
  expectAccessible,
  failReads,
  h1,
  holdReads,
  lensGroup,
  open,
  READ_DEADLINES,
  READ_EVENTS,
  READ_SHOPPING,
  READ_TODOS,
  sec,
  test,
  tick,
  toast,
  todoRow,
  T,
} from "../fixtures/oggi";

// Oggi (#30): caricamento, errori, offline e accessibilità (CA-36, CA-37,
// CA-38, CA-41).

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

test.describe("caricamento ed errori", () => {
  test("CA-36: con la lettura rallentata si vedono l'h1 con il saluto, la lente e un contenitore aria-busy con «Caricamento in corso»", async ({
    page,
    baseURL,
    casa,
  }) => {
    await ev(casa, "Marco", { title: "Riunione", from: "16:52", to: "17:52" });
    const reads = await holdReads(page);
    await open(page, baseURL, casa, "Marco", { pause: false, settle: false });
    await expect(h1(page)).toContainText("Marco");
    await expect(lensGroup(page)).toBeVisible();
    const loading = busy(page)
      .filter({ visible: true })
      .filter({ hasText: "Caricamento in corso" });
    await expect(loading).toHaveCount(1);
    await expect(sec(page, "Prossimo")).toHaveCount(0);

    reads.release();
    await expect(sec(page, "Prossimo")).toContainText("Riunione");
    await expect(busy(page)).toHaveCount(0);
  });

  test("CA-37: se le letture iniziali falliscono c'è l'errore di pagina con «Riprova»; a letture tornate si vedono le sezioni", async ({
    page,
    baseURL,
    casa,
  }) => {
    await ev(casa, "Marco", { title: "Riunione", from: "16:52", to: "17:52" });
    const reads = await failReads(page, [
      READ_EVENTS,
      READ_TODOS,
      READ_DEADLINES,
      READ_SHOPPING,
    ]);
    await open(page, baseURL, casa, "Marco");
    const main = page.getByRole("main");
    await expect(
      main.getByRole("heading", { name: "Questa pagina non si è caricata" }),
    ).toBeVisible();
    await expect(
      main.getByText("Controlla la connessione e riprova.", { exact: true }),
    ).toBeVisible();
    await expect(main).not.toContainText(/torna a oggi/i);
    await expect(main).not.toContainText("XX000");
    await expect(main).not.toContainText("fake failure");
    await expect(page.getByRole("link", { name: /torna a oggi/i })).toHaveCount(
      0,
    );
    await expect(sec(page, "Prossimo")).toHaveCount(0);

    reads.recover();
    await main.getByRole("button", { name: "Riprova" }).click();
    await expect(sec(page, "Prossimo")).toContainText("Riunione");
    await expect(
      page.getByRole("heading", { name: "Questa pagina non si è caricata" }),
    ).toHaveCount(0);
  });
});

test.describe("offline", () => {
  test("CA-38: offline compare l'avviso con «Riprova»; la spunta resta in coda; tornata la rete l'avviso sparisce entro 5 secondi e il da fare non è più aperto", async ({
    page,
    baseURL,
    casa,
  }) => {
    const title = "Pagare la bolletta";
    const id = await casa.todo("Marco", { title, assignee: "Marco" });
    await open(page, baseURL, casa, "Marco", { lens: "io", pause: false });
    await expect(tick(page, title)).toBeVisible();

    await page.context().setOffline(true);
    const notice = alerts(page).filter({ hasText: "Sei offline." });
    await expect(notice).toBeVisible();
    await expect(notice).toContainText(
      "Sei offline. Vedi le cose aggiornate alle",
    );
    await expect(notice).toContainText(/aggiornate alle \d{1,2}:\d{2}/);
    await expect(notice).toContainText(
      "le modifiche partiranno appena torna la connessione.",
    );
    await expect(notice.getByRole("button", { name: "Riprova" })).toBeVisible();
    // The data stay on screen, and ticking works: it waits in a queue.
    await expect(tick(page, title)).toBeVisible();
    await tick(page, title).click();
    await expect(tick(page, title)).toHaveAttribute("aria-checked", "true");

    await page.context().setOffline(false);
    await expect(notice).toHaveCount(0, { timeout: 5000 });
    await expect
      .poll(async () => {
        const rows = await casa.todoRows();
        return rows.find((row) => row.id === id)?.done_at ?? null;
      })
      .not.toBeNull();
    await page.goto("/oggi");
    await expect(h1(page)).toBeVisible({ timeout: 20_000 });
    await expect(busy(page)).toHaveCount(0);
    await expect(todoRow(page, title)).toHaveCount(0);
  });
});

test.describe("accessibilità", () => {
  test("CA-41: axe senza violazioni serious o critical e senza id duplicati: lente «Io», lente «Nest», conferma e offline", async ({
    page,
    baseURL,
    casa,
  }) => {
    await ev(casa, "Marco", { title: "Palestra", from: "9:00", to: "10:00" });
    await ev(casa, "Marco", { title: "Riunione", from: "16:22", to: "17:22" });
    await ev(casa, "Marco", {
      title: "Cena con i nonni",
      from: "18:00",
      to: "21:30",
      members: ["Marco", "Laura"],
      place: "Da Rosa",
      escort: "Laura",
    });
    await ev(casa, "Marco", {
      title: "Nuoto",
      day: d(1),
      from: "17:00",
      to: "18:00",
      members: ["Sofia", "Tommaso"],
      escort: "Marco",
    });
    await ev(casa, "Marco", {
      title: "Cena di Laura",
      day: d(2),
      from: "20:30",
      to: "21:30",
      members: ["Laura"],
    });
    await casa.todo("Marco", {
      title: "Chiamare il commercialista",
      assignee: "Marco",
      due: d(1),
      priv: true,
    });
    await casa.todo("Marco", {
      title: "Ritirare il pacco",
      assignee: "Marco",
      due: d(2),
    });
    await casa.shopping("Marco", ["Latte", "Pane", "Mele", "Uova"]);
    await casa.deadline("Marco", { title: "Bollo auto", due: d(5) });
    await casa.deadline("Marco", { title: "Assicurazione", due: d(40) });

    await open(page, baseURL, casa, "Marco", { lens: "io" });
    await expect(sec(page, "Prossimo")).toBeVisible();
    // «Già fatti» stays closed: its rows are dimmed by the mockup (see #241).
    await expectAccessible(page, "lente Io");

    await chooseLens(page, "Nest");
    await expect(sec(page, "Casa")).toBeVisible();
    await expectAccessible(page, "lente Nest");

    await chooseLens(page, "Io");
    await tick(page, "Ritirare il pacco").click();
    await expect(toast(page)).toBeVisible();
    await expectAccessible(page, "conferma");

    await page.context().setOffline(true);
    await expect(
      alerts(page).filter({ hasText: "Sei offline." }),
    ).toBeVisible();
    await expectAccessible(page, "offline");
  });

  test("CA-41: axe sullo stato vuoto («Giornata libera, per ora»)", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await open(page, baseURL, bianchi, "Paolo", { lens: "io" });
    await expect(sec(page, "Oggi")).toContainText("Giornata libera, per ora");
    await expectAccessible(page, "vuoto, lente Io");
    await chooseLens(page, "Nest");
    await expect(sec(page, "Casa")).toBeVisible();
    await expectAccessible(page, "vuoto, lente Nest");
  });

  test("CA-41: axe sullo stato «Per oggi è tutto»", async ({
    page,
    baseURL,
    casa,
  }) => {
    await ev(casa, "Marco", { title: "Scuola", from: "8:00", to: "9:00" });
    await ev(casa, "Marco", { title: "Palestra", from: "10:00", to: "11:00" });
    await open(page, baseURL, casa, "Marco", { now: at(T, "23:10") });
    await expect(sec(page, "Dopo")).toContainText("Per oggi è tutto");
    await expectAccessible(page, "oggi tutto finito");
  });
});
