import { type Locator, type Page } from "@playwright/test";
import { expect, isMobileProject, test } from "../fixtures/casa";
import {
  MEMBERS_FAILED,
  PHRASE,
  SAVE_FAILED,
  alertsIn,
  dayRead,
  dialogOf,
  eventsOf,
  fieldOf,
  labelsOf,
  listedFor,
  noticeOf,
  openAdd,
  participantRowsOf,
  pauseClock,
  plain,
  recordNetwork,
  seedColloquio,
  seedEvent,
  sideOf,
  toastOf,
} from "../fixtures/aggiungi";

// Aggiungi · Impegni, phase 1 (#20): the criteria that need the database, the
// browser clock fixed at Tuesday 20 October 2026, 15:52 in Rome, and the
// isolation between Nests. The reading of the phrase without a browser is in
// aggiungi-impegni-frase.spec.ts; the main flow on the seed user is in
// aggiungi-impegni.spec.ts.
//
// Every test builds its own throwaway Nests (fixtures/casa.ts): desktop and
// mobile never meet on the same rows, and the tests do not depend on each other.
// «Nel database» = read with the session of the user (RLS applies) or, for the
// plain counts, with the administrative key. Criteria with both layouts are
// checked in the layout of the project that is running: desktop runs the
// desktop part, mobile the mobile part.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

const NOTICE_LAURA =
  "Laura ha un impegno fino alle 17:15: chi accompagna Sofia?";
const SAVED_TOAST = "Messo in giovedì 22: Nuoto Sofia alle 17:00.";

const submitButton = (page: Page, name: string) =>
  dialogOf(page).getByRole("button", { name });

/** Every text is among the labels (order is checked only where the criterion asks). */
async function expectLabels(labels: Locator, texts: string[]) {
  for (const text of texts) await expect(labels).toContainText(text);
}

/** The text of the toast with the bold part (the day) kept inside the sentence. */
async function expectSavedToast(page: Page, text: string) {
  await expect(toastOf(page)).toContainText(text);
}

// ------------------------------------------------------------------ Salvataggio

test.describe("Aggiungi · Impegni · salvataggio", () => {
  test("CA-12: «Nuoto Sofia giovedì alle 17» con la lente «Io» salva un «Occupato» con Sofia", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAdd(page, baseURL, casa, "Marco", { lens: "io" });
    await fieldOf(page).fill(PHRASE);

    await expect(labelsOf(page).locator(".chip")).toContainText([
      "Giovedì 22",
      "17:00",
      "Sofia",
    ]);
    await submitButton(page, "Metti in giovedì 22").click();

    await expect(dialogOf(page)).toHaveCount(0);
    const toast = page.getByRole("status").filter({ hasText: "Messo in" });
    await expectSavedToast(page, SAVED_TOAST);
    await expect(toast.locator("b")).toHaveText("giovedì 22");
    await expect(toast.getByRole("button", { name: "Annulla" })).toBeVisible();

    const rows = await eventsOf(casa);
    expect(rows).toHaveLength(1);
    const [row] = rows;
    expect(row).toMatchObject({
      title: "Nuoto Sofia",
      visibility: "busy",
      recurrence: "none",
      location: null,
      escort_member_id: null,
      household_id: casa.householdId,
      author_member_id: casa.members["Marco"],
    });
    expect(new Date(row!.starts_at).toISOString()).toBe(
      "2026-10-22T15:00:00.000Z",
    );
    expect(new Date(row!.ends_at).toISOString()).toBe(
      "2026-10-22T16:00:00.000Z",
    );
    expect(row!.memberIds).toEqual([casa.members["Sofia"]]);
  });

  test("CA-13: con la lente «Nest» l'impegno è visibile a tutto il Nest", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAdd(page, baseURL, casa, "Marco", { lens: "nest" });
    await fieldOf(page).fill("Cena da Marta venerdì alle 20");
    await submitButton(page, "Metti in venerdì 23").click();
    await expectSavedToast(
      page,
      "Messo in venerdì 23: Cena da Marta alle 20:00.",
    );

    const rows = await eventsOf(casa);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      title: "Cena da Marta",
      visibility: "household",
    });
    expect(new Date(rows[0]!.starts_at).toISOString()).toBe(
      "2026-10-23T18:00:00.000Z",
    );
  });

  test("CA-14: «dentista il 7 novembre alle 16» ha la sola etichetta «Tu» e salva Marco", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAdd(page, baseURL, casa, "Marco");
    const field = fieldOf(page);
    await field.fill("dentista il 7 novembre alle 16");

    // The only person label is «Tu»: the other labels are the day and the hour.
    const labels = labelsOf(page);
    await expectLabels(labels, ["Sabato 7 novembre", "16:00", "Tu"]);
    for (const name of ["Marco", "Laura", "Sofia", "Tommaso", "Biscotto"]) {
      await expect(labels.getByText(name, { exact: true })).toHaveCount(0);
    }

    await field.press("Enter");
    await expect(dialogOf(page)).toHaveCount(0);
    await expectSavedToast(
      page,
      "Messo in sabato 7 novembre: Dentista alle 16:00.",
    );

    const rows = await eventsOf(casa);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.title).toBe("Dentista");
    expect(new Date(rows[0]!.starts_at).toISOString()).toBe(
      "2026-11-07T15:00:00.000Z",
    );
    expect(rows[0]!.memberIds).toEqual([casa.members["Marco"]]);
  });

  test.describe("browser a New York", () => {
    test.use({ timezoneId: "America/New_York" });

    test("CA-16: «cena domenica alle 20» nel giorno del cambio dell'ora salva alle 19:00 UTC", async ({
      page,
      baseURL,
      casa,
    }) => {
      await openAdd(page, baseURL, casa, "Marco");
      await fieldOf(page).fill("cena domenica alle 20");
      await submitButton(page, "Metti in domenica 25").click();
      await expectSavedToast(page, "Messo in domenica 25: Cena alle 20:00.");

      const rows = await eventsOf(casa);
      expect(rows).toHaveLength(1);
      expect(new Date(rows[0]!.starts_at).toISOString()).toBe(
        "2026-10-25T19:00:00.000Z",
      );
    });
  });

  test("CA-18: «Annulla» entro 5 secondi toglie l'impegno e i suoi partecipanti", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAdd(page, baseURL, casa, "Marco");
    await fieldOf(page).fill(PHRASE);
    await submitButton(page, "Metti in giovedì 22").click();
    await expectSavedToast(page, SAVED_TOAST);
    expect(await eventsOf(casa)).toHaveLength(1);
    expect(await participantRowsOf(casa)).toBe(1);

    // The clock stops: the toast cannot expire while the test acts.
    await pauseClock(page);
    await toastOf(page).getByRole("button", { name: "Annulla" }).click();
    await expect(toastOf(page)).toHaveCount(0);
    await expect.poll(async () => (await eventsOf(casa)).length).toBe(0);
    expect(await participantRowsOf(casa)).toBe(0);
  });

  test("CA-19: dopo 5 secondi il toast sparisce e l'impegno resta", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAdd(page, baseURL, casa, "Marco");
    await fieldOf(page).fill(PHRASE);
    await submitButton(page, "Metti in giovedì 22").click();
    await expectSavedToast(page, SAVED_TOAST);

    await pauseClock(page);
    await expect(toastOf(page)).toBeVisible();
    await page.clock.runFor(5000);
    await expect(toastOf(page)).toHaveCount(0);
    expect(await eventsOf(casa)).toHaveLength(1);
  });
});

// ---------------------------------------------------------- Caricamento ed errori

test.describe("Aggiungi · Impegni · caricamento ed errori", () => {
  test("CA-20: salvataggio lento, secondo tocco ed Esc non lo duplicano né chiudono il foglio", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAdd(page, baseURL, casa, "Marco");
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
    await fieldOf(page).fill(PHRASE);

    const submit = submitButton(page, "Metti in giovedì 22");
    await submit.click();
    await expect(submit).toHaveAttribute("aria-busy", "true");
    await expect(submit).toContainText("Metti in giovedì 22");

    // Second touch (the button is aria-disabled: Playwright would wait for it)
    // and Esc: nothing changes while the answer is on its way.
    await submit.click({ force: true });
    await page.keyboard.press("Escape");
    await expect(dialogOf(page)).toBeVisible();
    await expect(submit).toHaveAttribute("aria-busy", "true");

    release();
    await expect(dialogOf(page)).toHaveCount(0);
    await expectSavedToast(page, SAVED_TOAST);
    const rows = await eventsOf(casa);
    expect(rows.filter((r) => r.title === "Nuoto Sofia")).toHaveLength(1);
    expect(calls).toBe(1);
  });

  test("CA-21: se il salvataggio fallisce il foglio resta aperto con l'avviso, poi riprova e salva", async ({
    page,
    baseURL,
    casa,
  }) => {
    await openAdd(page, baseURL, casa, "Marco");
    let failing = true;
    await page.route("**/rest/v1/rpc/create_event", (route) =>
      failing ? route.abort("failed") : route.continue(),
    );
    const field = fieldOf(page);
    await field.fill(PHRASE);
    const submit = submitButton(page, "Metti in giovedì 22");
    await submit.click();

    // The sheet stays open with the phrase, the alert is inside it and above the button.
    const alert = alertsIn(dialogOf(page));
    await expect(alert).toHaveText(SAVE_FAILED);
    await expect(dialogOf(page)).toBeVisible();
    await expect(field).toHaveValue(PHRASE);
    await expect(toastOf(page)).toHaveCount(0);
    expect(await eventsOf(casa)).toHaveLength(0);
    const alertBox = await alert.boundingBox();
    const buttonBox = await submit.boundingBox();
    expect(alertBox).not.toBeNull();
    expect(buttonBox).not.toBeNull();
    expect(alertBox!.y + alertBox!.height).toBeLessThanOrEqual(
      buttonBox!.y + 1,
    );

    // The request works again: touching the button saves.
    failing = false;
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(dialogOf(page)).toHaveCount(0);
    await expectSavedToast(page, SAVED_TOAST);
    expect(await eventsOf(casa)).toHaveLength(1);
  });

  test("CA-39: senza le persone del Nest l'avviso c'è e l'impegno si salva con il solo Marco", async ({
    page,
    baseURL,
    casa,
  }) => {
    // Only the reading of the list of members (it asks for the names) fails:
    // the reading of the own member (`select=id`) must keep working.
    await page.route(
      (url) =>
        url.pathname.endsWith("/rest/v1/household_members") &&
        (url.searchParams.get("select") ?? "").includes("name"),
      (route) => route.abort("failed"),
    );
    await openAdd(page, baseURL, casa, "Marco");
    const dialog = dialogOf(page);

    const alert = alertsIn(dialog);
    await expect(alert).toContainText(MEMBERS_FAILED);
    await expect(alert.getByRole("button", { name: "Riprova" })).toBeVisible();
    // Under the type selector.
    const typeBox = await dialog
      .getByRole("group", { name: "Tipo" })
      .boundingBox();
    const alertBox = await alert.boundingBox();
    expect(alertBox!.y).toBeGreaterThanOrEqual(
      typeBox!.y + typeBox!.height - 1,
    );

    await fieldOf(page).fill(PHRASE);
    await expectLabels(labelsOf(page), ["Giovedì 22", "17:00"]);
    await expect(
      labelsOf(page).getByText("Sofia", { exact: true }),
    ).toHaveCount(0);
    await submitButton(page, "Metti in giovedì 22").click();
    await expect(dialogOf(page)).toHaveCount(0);
    await expectSavedToast(page, SAVED_TOAST);

    const rows = await eventsOf(casa);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.title).toBe("Nuoto Sofia");
    expect(rows[0]!.memberIds).toEqual([casa.members["Marco"]]);
  });

  test("CA-39: toccando «Riprova» l'avviso sparisce e il nome «Sofia» torna a essere riconosciuto", async ({
    page,
    baseURL,
    casa,
  }) => {
    let failing = true;
    await page.route(
      (url) =>
        url.pathname.endsWith("/rest/v1/household_members") &&
        (url.searchParams.get("select") ?? "").includes("name"),
      (route) => (failing ? route.abort("failed") : route.continue()),
    );
    await openAdd(page, baseURL, casa, "Marco");
    const dialog = dialogOf(page);
    await expect(alertsIn(dialog)).toContainText(MEMBERS_FAILED);

    failing = false;
    await alertsIn(dialog).getByRole("button", { name: "Riprova" }).click();
    await expect(alertsIn(dialog)).toHaveCount(0);

    await fieldOf(page).fill("Sofia");
    // Without a time the labels only show the person.
    await expectLabels(labelsOf(page), ["Sofia"]);
  });
});

// ----------------------------------------------------------------- Avviso e anteprima

test.describe("Aggiungi · Impegni · «chi accompagna?» e anteprima", () => {
  test("CA-29: l'avviso «chi accompagna Sofia?» c'è, uno solo, e su desktop l'anteprima è nell'ordine giusto", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seedColloquio(casa);
    await openAdd(page, baseURL, casa, "Marco");
    await fieldOf(page).fill(PHRASE);
    const notice = noticeOf(page).filter({ hasText: NOTICE_LAURA });
    await expect(notice).toHaveCount(1, { timeout: 15_000 });
    await expect(page.getByText(NOTICE_LAURA)).toHaveCount(1);

    if (isMobileProject()) {
      // Under the labels and above the submit button, without the rest of the preview.
      const labelsBox = await labelsOf(page).boundingBox();
      const noticeBox = await notice.boundingBox();
      const buttonBox = await submitButton(
        page,
        "Metti in giovedì 22",
      ).boundingBox();
      expect(noticeBox!.y).toBeGreaterThanOrEqual(
        labelsBox!.y + labelsBox!.height - 1,
      );
      expect(noticeBox!.y + noticeBox!.height).toBeLessThanOrEqual(
        buttonBox!.y + 1,
      );
      await expect(dialogOf(page).getByText("Anteprima")).toHaveCount(0);
      await expect(
        dialogOf(page).getByText("Colloquio con la maestra"),
      ).toHaveCount(0);
      return;
    }

    const side = sideOf(page);
    await expect(side.getByText("Nuovo", { exact: true })).toBeVisible();
    // Order of the column (textContent: CSS capitals do not matter).
    const text = (await side.textContent()) ?? "";
    let position = 0;
    for (const piece of [
      "Anteprima",
      "17:00",
      "Nuoto Sofia",
      "Giovedì 22, fino alle 18:00",
      "Giovedì 22",
      "16:30",
      "Colloquio con la maestra",
      "17:00",
      "Nuoto Sofia",
      "Nuovo",
      NOTICE_LAURA,
    ]) {
      const found = text.indexOf(piece, position);
      expect(found, `«${piece}» dopo la posizione ${position}`).toBeGreaterThan(
        -1,
      );
      position = found + piece.length;
    }

    // The rows of the day are not links and do not take the focus.
    const colloquio = side
      .locator(".riga-evento")
      .filter({ hasText: "Colloquio con la maestra" });
    await expect(colloquio).toHaveCount(1);
    await expect(colloquio.getByText("16:30")).toBeVisible();
    await expect(side.getByRole("link")).toHaveCount(0);
    await expect(
      side.locator(".riga-evento").filter({ hasText: "Nuovo" }),
    ).toHaveCount(1);
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press("Tab");
      expect(
        await colloquio.evaluate((el) => el.contains(document.activeElement)),
      ).toBe(false);
    }
    expect(await colloquio.evaluate((el) => el.tabIndex)).toBe(-1);
  });

  test("CA-30: l'avviso non c'è senza figli o senza adulti occupati, e nomina più figli", async ({
    page,
    baseURL,
    casa,
  }) => {
    await seedColloquio(casa);
    await openAdd(page, baseURL, casa, "Marco");
    const field = fieldOf(page);
    // The positive case first: it proves that the day has been read, so the
    // absences below are real and not "not loaded yet".
    await field.fill(PHRASE);
    await expect(noticeOf(page).filter({ hasText: NOTICE_LAURA })).toHaveCount(
      1,
      { timeout: 15_000 },
    );

    await field.fill("Riunione giovedì alle 17");
    await expectLabels(labelsOf(page), ["Giovedì 22", "17:00"]);
    await expect(noticeOf(page)).toHaveCount(0);

    await field.fill("Nuoto Sofia giovedì alle 19");
    await expectLabels(labelsOf(page), ["Giovedì 22", "19:00", "Sofia"]);
    await expect(noticeOf(page)).toHaveCount(0);

    await field.fill("Nuoto Sofia e Tommaso giovedì alle 17");
    await expect(noticeOf(page)).toHaveText(
      "Laura ha un impegno fino alle 17:15: chi accompagna Sofia e Tommaso?",
    );
    await expect(page.getByText("chi accompagna")).toHaveCount(1);
  });

  test("CA-31: gli «Occupato» degli altri contano per l'avviso ma non svelano titolo né «Solo io»", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await seedEvent(bianchi, "Paolo", {
      title: "Riunione segreta",
      starts: "2026-10-22T14:00:00Z",
      ends: "2026-10-22T16:00:00Z",
      visibility: "busy",
      who: ["Paolo"],
    });
    await seedEvent(bianchi, "Paolo", {
      title: "Prova privata",
      starts: "2026-10-22T18:00:00Z",
      ends: "2026-10-22T19:00:00Z",
      visibility: "private",
      who: ["Paolo"],
    });

    const network = recordNetwork(page);
    await openAdd(page, baseURL, bianchi, "Giulia");
    await fieldOf(page).fill("Inglese Leo giovedì alle 17");
    const notice = noticeOf(page).filter({
      hasText: "Paolo ha un impegno fino alle 18:00: chi accompagna Leo?",
    });
    await expect(notice).toHaveCount(1, { timeout: 15_000 });

    if (!isMobileProject()) {
      const side = sideOf(page);
      const row = side.locator(".riga-evento").filter({ hasText: "Paolo" });
      await expect(row).toHaveCount(1);
      await expect(row.getByText("16:00")).toBeVisible();
      expect(await row.evaluate((el) => el.tagName)).not.toBe("A");
      await expect(side.getByRole("link")).toHaveCount(0);
    }

    // Nothing of the title or of the «Solo io» reaches the page or the answers.
    const body = (await page.locator("body").textContent()) ?? "";
    for (const secret of ["Riunione segreta", "Prova privata", "20:00"]) {
      expect(body).not.toContain(secret);
    }
    // In the answers the hour of the «Solo io» would read 18:00 UTC.
    const answers = (await network.texts()).join("\n");
    for (const secret of [
      "Riunione segreta",
      "Prova privata",
      "2026-10-22T18:00",
    ]) {
      expect(answers).not.toContain(secret);
    }
  });

  test("privacy degli «Occupato»: Giulia riceve gli orari di Paolo senza titolo né persone, e nessun «Solo io»", async ({
    bianchi,
  }) => {
    await seedEvent(bianchi, "Paolo", {
      title: "Riunione segreta",
      starts: "2026-10-22T14:00:00Z",
      ends: "2026-10-22T16:00:00Z",
      visibility: "busy",
      who: ["Paolo"],
    });
    await seedEvent(bianchi, "Paolo", {
      title: "Prova privata",
      starts: "2026-10-22T18:00:00Z",
      ends: "2026-10-22T19:00:00Z",
      visibility: "private",
      who: ["Paolo"],
    });
    const rows = await listedFor(
      bianchi,
      "Giulia",
      "2026-10-21T22:00:00Z",
      "2026-10-22T22:00:00Z",
    );
    // Only the «Occupato», stripped of every detail.
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      is_masked: true,
      visibility: "busy",
      author_member_id: bianchi.members["Paolo"],
      id: null,
      title: null,
      location: null,
      escort_member_id: null,
      member_ids: null,
    });
    expect(JSON.stringify(rows)).not.toContain("Riunione segreta");
    expect(JSON.stringify(rows)).not.toContain("Prova privata");
    // The author sees both in full.
    const own = await listedFor(
      bianchi,
      "Paolo",
      "2026-10-21T22:00:00Z",
      "2026-10-22T22:00:00Z",
    );
    expect(own.map((row: { title: string }) => row.title).sort()).toEqual([
      "Prova privata",
      "Riunione segreta",
    ]);
  });
});

// ---------------------------------------------------------------------- Isolamento

test.describe("Aggiungi · Impegni · isolamento tra Nest", () => {
  test("CA-34: Giulia salva nel suo Nest, senza i nomi di Casa D'Angelo, e Marco non lo vede", async ({
    page,
    baseURL,
    casa,
    bianchi,
  }) => {
    await openAdd(page, baseURL, bianchi, "Giulia");
    await fieldOf(page).fill(PHRASE);

    // Giulia's Nest has no Sofia: only the day, the hour and «Tu» (CA-14).
    // «Tu» appears once the people are read, so the absence below is real.
    const labels = labelsOf(page);
    await expectLabels(labels, ["Giovedì 22", "17:00", "Tu"]);
    await expect(labels.getByText("Sofia", { exact: true })).toHaveCount(0);

    await submitButton(page, "Metti in giovedì 22").click();
    await expect(dialogOf(page)).toHaveCount(0);
    await expectSavedToast(page, SAVED_TOAST);

    const rows = await eventsOf(bianchi);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      title: "Nuoto Sofia",
      household_id: bianchi.householdId,
      author_member_id: bianchi.members["Giulia"],
    });
    expect(rows[0]!.memberIds).toEqual([bianchi.members["Giulia"]]);
    expect(await eventsOf(casa)).toHaveLength(0);

    // Marco, 19-26 October: nothing from the other Nest.
    const seenByMarco = await listedFor(
      casa,
      "Marco",
      "2026-10-18T22:00:00Z",
      "2026-10-26T23:00:00Z",
    );
    expect(seenByMarco).toEqual([]);
  });

  test("CA-35: Giulia non vede l'impegno di Casa D'Angelo né i suoi nomi, né nella pagina né in rete", async ({
    page,
    baseURL,
    casa,
    bianchi,
  }) => {
    await seedColloquio(casa);
    const network = recordNetwork(page);
    await openAdd(page, baseURL, bianchi, "Giulia");
    await fieldOf(page).fill("Nuoto Leo giovedì alle 17");
    await expectLabels(labelsOf(page), ["Giovedì 22", "17:00", "Leo"]);
    await dayRead(page, !isMobileProject());

    await expect(noticeOf(page)).toHaveCount(0);
    const body = (await page.locator("body").textContent()) ?? "";
    for (const foreign of ["Colloquio con la maestra", "Laura", "Marco"]) {
      expect(body).not.toContain(foreign);
    }
    const answers = (await network.texts()).join("\n");
    for (const foreign of ["Colloquio con la maestra", "Laura", "Marco"]) {
      expect(answers).not.toContain(foreign);
    }
  });
});

// ------------------------------------------------------------------------ Privacy

test.describe("Aggiungi · Impegni · privacy della frase", () => {
  test("CA-36: mentre scrive partono solo letture degli impegni del giorno, senza la frase", async ({
    page,
    baseURL,
    casa,
  }) => {
    // The Nest members are read when the sheet opens: wait for them, then record.
    const membersRead = page.waitForResponse(
      (response) =>
        response.url().includes("/rest/v1/household_members") &&
        new URL(response.url()).searchParams.get("select")?.includes("name") ===
          true,
    );
    await openAdd(page, baseURL, casa, "Marco");
    await membersRead;

    const visited: string[] = [];
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) visited.push(frame.url());
    });
    const network = recordNetwork(page);
    await fieldOf(page).pressSequentially(PHRASE);
    await expectLabels(labelsOf(page), ["Giovedì 22", "17:00", "Sofia"]);

    // Only the reading of the events of the day, once per day recognised.
    const api = network.api();
    expect(api.length).toBeLessThanOrEqual(1);
    for (const request of api) {
      expect(request.url).toContain("/rpc/list_household_events");
    }
    for (const request of network.requests) {
      const content = plain(`${request.url} ${request.body}`).toLowerCase();
      expect(content).not.toContain("giovedì alle 17");
      expect(content).not.toContain("nuoto");
    }
    for (const url of [...visited, page.url()]) {
      expect(plain(url).toLowerCase()).not.toMatch(/nuoto|sofia|giovedì/);
    }

    const saved = page.waitForRequest((request) =>
      request.url().includes("/rpc/create_event"),
    );
    await submitButton(page, "Metti in giovedì 22").click();
    const request = await saved;
    expect(request.postData() ?? "").toContain("Nuoto Sofia");
    expect(plain(request.url())).not.toContain("giovedì");
    await expect(dialogOf(page)).toHaveCount(0);
  });
});
