import { expect, test, type Page } from "@playwright/test";
import { formatAge } from "../../src/lib/datetime";
import { PLACEHOLDERS, getBarConfig } from "../../src/lib/app-routes";

// Shared part of #85: ColorChoice, formatAge, MemberSheet, "Esplora" placeholder.

test.describe("formatAge", () => {
  const now = "2026-10-29T12:00:00Z";

  test("anni, mesi e meno di un mese, nel fuso di Roma", () => {
    expect(formatAge("2016-12-14", now)).toBe("9 anni");
    expect(formatAge("2020-04-02", now)).toBe("6 anni");
    expect(formatAge("2025-10-29", now)).toBe("1 anno");
    expect(formatAge("2025-10-30", now)).toBe("11 mesi");
    expect(formatAge("2026-09-29", now)).toBe("1 mese");
    expect(formatAge("2026-09-30", now)).toBe("meno di un mese");
    expect(formatAge("2026-10-19", now)).toBe("meno di un mese");
    expect(formatAge("2026-10-29", now)).toBe("meno di un mese");
    expect(formatAge("2026-02-10", now)).toBe("8 mesi");
  });

  test("un istante vale il giorno di Roma, una data futura è «meno di un mese»", () => {
    // 23:30 UTC of the 28th is already the 29th in Rome
    expect(formatAge("2025-10-28T23:30:00Z", now)).toBe("1 anno");
    expect(formatAge("2027-01-01", now)).toBe("meno di un mese");
  });
});

test.describe("segnaposto di Esplora", () => {
  test("titolo, icona e testo", () => {
    const def = PLACEHOLDERS["esplora"];
    expect(def.title).toBe("Esplora");
    expect(def.browserTitle).toBe("FamilyNest · Esplora");
    expect(def.icon).toBe("compass");
    expect(def.text).toBe(
      "Qui scoprirai cosa può fare la vostra casa. Stiamo preparando questa pagina.",
    );
    expect(def.backToToday).toBe(true);
  });

  test("la X del Nest ha ancora /oggi come ripiego", () => {
    expect(getBarConfig("/nest")).toEqual({ kind: "close", href: "/oggi" });
  });
});

const DEMO = "/design-system/membri";

async function openSheet(page: Page, name: string) {
  await page.goto(DEMO);
  await page.getByRole("button", { name }).click();
  return page.getByRole("dialog");
}

test.describe("ColorChoice", () => {
  test("10 radio, nomi accessibili e un solo punto di Tab", async ({
    page,
  }) => {
    await page.goto(DEMO);
    const group = page.getByRole("radiogroup", { name: "Il tuo colore" });
    const radios = group.getByRole("radio");
    await expect(radios).toHaveCount(10);
    await expect(
      group.getByRole("radio", { name: "Pomodoro (già di Marco)" }),
    ).toBeDisabled();
    await expect(
      group.getByRole("radio", { name: "Zafferano (già usato)" }),
    ).toBeDisabled();
    await expect(group.getByRole("radio", { name: "Salvia" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(radios.and(page.locator('[tabindex="0"]'))).toHaveCount(1);
  });

  test("due righe da cinque", async ({ page }) => {
    await page.goto(DEMO);
    const radios = page
      .getByRole("radiogroup", { name: "Il tuo colore" })
      .getByRole("radio");
    const boxes = await radios.evaluateAll((nodes) =>
      nodes.map((n) => {
        const r = n.getBoundingClientRect();
        return { x: Math.round(r.x), y: Math.round(r.y) };
      }),
    );
    const rows = new Set(boxes.map((b) => b.y));
    expect(rows.size).toBe(2);
    expect(boxes.slice(0, 5).every((b) => b.y === boxes[0]!.y)).toBe(true);
    expect(boxes.slice(5).every((b) => b.y === boxes[5]!.y)).toBe(true);
  });

  test("le frecce scelgono e saltano i colori spenti, con ritorno da 10 a 1", async ({
    page,
  }) => {
    await page.goto(DEMO);
    const group = page.getByRole("radiogroup", { name: "Il tuo colore" });
    const salvia = group.getByRole("radio", { name: "Salvia" });
    await salvia.focus();
    await page.keyboard.press("ArrowRight");
    await expect(group.getByRole("radio", { name: "Cobalto" })).toBeFocused();
    await expect(group.getByRole("radio", { name: "Cobalto" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    // zafferano is taken: skipped
    await page.keyboard.press("ArrowDown");
    await expect(group.getByRole("radio", { name: "Lampone" })).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(group.getByRole("radio", { name: "Cobalto" })).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(group.getByRole("radio", { name: "Salvia" })).toBeFocused();
    // back from salvia: glicine and pomodoro are taken, wraps to the last
    await page.keyboard.press("ArrowLeft");
    await expect(group.getByRole("radio", { name: "Cannella" })).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(group.getByRole("radio", { name: "Salvia" })).toBeFocused();
  });
});

test.describe("MemberSheet", () => {
  test("aggiungi: valori iniziali e bottone con il nome", async ({ page }) => {
    const dialog = await openSheet(page, "Aggiungi una persona o un animale");
    await expect(dialog).toHaveAccessibleName("Aggiungi una persona");
    const name = dialog.getByLabel("Nome");
    await expect(name).toBeFocused();
    await expect(name).toHaveAttribute("placeholder", "Come si chiama?");
    await expect(name).toHaveAttribute("maxlength", "40");
    await expect(
      dialog.getByRole("button", { name: "Figlio o figlia" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(dialog.getByLabel("Data di nascita")).toBeVisible();
    // pomodoro, glicine, zafferano are taken: first free is salvia
    await expect(dialog.getByRole("radio")).toHaveCount(10);
    await expect(dialog.getByRole("radio", { name: "Salvia" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(
      dialog.getByRole("button", { name: "Aggiungi" }),
    ).toBeVisible();
    await name.fill("  Sofia  ");
    await expect(
      dialog.getByRole("button", { name: "Aggiungi Sofia" }),
    ).toBeVisible();
    await name.fill("Un nome molto molto lungo");
    await expect(
      dialog.getByRole("button", { name: "Aggiungi", exact: true }),
    ).toBeVisible();
  });

  test("la data sparisce con Adulto e ricompare con il valore scritto", async ({
    page,
  }) => {
    const dialog = await openSheet(page, "Aggiungi una persona o un animale");
    await dialog.getByLabel("Data di nascita").fill("2020-04-02");
    await dialog.getByRole("button", { name: "Adulto" }).click();
    await expect(dialog.getByLabel("Data di nascita")).toHaveCount(0);
    await dialog.getByRole("button", { name: "Figlio o figlia" }).click();
    await expect(dialog.getByLabel("Data di nascita")).toHaveValue(
      "2020-04-02",
    );
  });

  test("nome vuoto: errore sotto il campo e fuoco sul campo", async ({
    page,
  }) => {
    const dialog = await openSheet(page, "Aggiungi una persona o un animale");
    await dialog.getByLabel("Nome").fill("   ");
    await dialog.getByRole("button", { name: "Aggiungi" }).click();
    const name = dialog.getByLabel("Nome");
    await expect(
      dialog.getByText("Scrivi il nome per continuare."),
    ).toBeVisible();
    await expect(name).toHaveAttribute("aria-invalid", "true");
    await expect(name).toBeFocused();
    await expect(page.getByTestId("membri-chiamate")).toHaveText("Chiamate: 0");
  });

  test("data nel futuro: errore e nessun salvataggio", async ({ page }) => {
    const dialog = await openSheet(page, "Aggiungi una persona o un animale");
    await dialog.getByLabel("Nome").fill("Sofia");
    await dialog.getByLabel("Data di nascita").evaluate((input) => {
      const element = input as HTMLInputElement;
      element.removeAttribute("max");
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!;
      setter.call(element, "2099-01-01");
      element.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await dialog.getByRole("button", { name: "Aggiungi Sofia" }).click();
    await expect(
      dialog.getByText(
        "Questa data è nel futuro: scegli un giorno fino a oggi.",
      ),
    ).toBeVisible();
    await expect(page.getByTestId("membri-chiamate")).toHaveText("Chiamate: 0");
  });

  test("salvataggio riuscito: valori puliti, foglio chiuso, fuoco restituito", async ({
    page,
  }) => {
    const dialog = await openSheet(page, "Aggiungi una persona o un animale");
    await dialog.getByLabel("Nome").fill("  Sofia  ");
    await dialog.getByLabel("Data di nascita").fill("2016-12-14");
    await dialog.getByRole("radio", { name: "Cobalto" }).click();
    await dialog.getByRole("button", { name: "Aggiungi Sofia" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByTestId("membri-salvato")).toHaveText(
      JSON.stringify({
        name: "Sofia",
        kind: "child",
        birthDate: "2016-12-14",
        color: "cobalto",
      }),
    );
    await expect(
      page.getByRole("button", { name: "Aggiungi una persona o un animale" }),
    ).toBeFocused();
  });

  test("Adulto: la data non viene mandata", async ({ page }) => {
    const dialog = await openSheet(page, "Aggiungi una persona o un animale");
    await dialog.getByLabel("Nome").fill("Laura");
    await dialog.getByLabel("Data di nascita").fill("2016-12-14");
    await dialog.getByRole("button", { name: "Adulto" }).click();
    await dialog.getByRole("button", { name: "Aggiungi Laura" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByTestId("membri-salvato")).toContainText(
      '"kind":"adult","birthDate":null',
    );
  });

  test("durante il salvataggio: aria-busy, un solo invio, Esc non chiude", async ({
    page,
  }) => {
    const dialog = await openSheet(page, "Aggiungi una persona o un animale");
    await dialog.getByLabel("Nome").fill("Rita");
    const save = dialog.getByRole("button", { name: "Aggiungi Rita" });
    await save.click();
    await save.click({ force: true });
    await expect(save).toHaveAttribute("aria-busy", "true");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByTestId("membri-chiamate")).toHaveText("Chiamate: 1");
  });

  test("colore preso nel frattempo: resta aperto, nessun colore scelto", async ({
    page,
  }) => {
    await page.goto(DEMO);
    await page.getByRole("button", { name: "Colore preso" }).click();
    await page
      .getByRole("button", { name: "Aggiungi una persona o un animale" })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Nome").fill("Rita");
    await dialog.getByRole("button", { name: "Aggiungi Rita" }).click();
    await expect(
      dialog.getByText(
        "Questo colore l'ha appena preso qualcun altro: scegline un altro.",
      ),
    ).toBeVisible();
    await expect(dialog.getByLabel("Nome")).toHaveValue("Rita");
    // focus moves to the colour group and the error is announced
    await expect(
      dialog.getByRole("radio").and(page.locator(":focus")),
    ).toHaveCount(1);
    await expect(
      dialog.getByRole("alert").filter({ hasText: "appena preso" }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("radiogroup", { name: "Colore" }),
    ).toHaveAccessibleDescription(/appena preso/);
    await expect(
      dialog.getByRole("radio", { name: "Salvia (già usato)" }),
    ).toBeDisabled();
    await expect(
      dialog.locator('[role="radio"][aria-checked="true"]'),
    ).toHaveCount(0);
    await dialog.getByRole("radio", { name: "Cobalto" }).click();
    await expect(
      dialog.getByText("Questo colore l'ha appena preso"),
    ).toHaveCount(0);
  });

  test("errori di rete, di server e Nest al completo", async ({ page }) => {
    await page.goto(DEMO);
    const cases: [string, string, boolean][] = [
      [
        "Rete",
        "Non siamo riusciti a salvare. Controlla la connessione e riprova.",
        true,
      ],
      [
        "Server",
        "Non siamo riusciti a salvare per un problema nostro. Riprova tra qualche minuto.",
        true,
      ],
      [
        "Al completo",
        "Il Nest è al completo: ci stanno al massimo 10 tra persone e animali.",
        false,
      ],
    ];
    for (const [outcome, text, retry] of cases) {
      await page.getByRole("button", { name: outcome, exact: true }).click();
      await page
        .getByRole("button", { name: "Aggiungi una persona o un animale" })
        .click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Nome").fill("Rita");
      await dialog.getByRole("button", { name: "Aggiungi Rita" }).click();
      const alert = dialog.getByRole("alert");
      await expect(alert).toContainText(text);
      await expect(alert.getByRole("button", { name: "Riprova" })).toHaveCount(
        retry ? 1 : 0,
      );
      await expect(dialog.getByLabel("Nome")).toHaveValue("Rita");
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
    }
  });

  test("modifica: titolo, dati compilati, ruolo bloccato, colore proprio acceso", async ({
    page,
  }) => {
    const dialog = await openSheet(page, "Modifica Sofia");
    await expect(dialog).toHaveAccessibleName("Modifica Sofia");
    await expect(dialog.getByLabel("Nome")).toHaveValue("Sofia");
    await expect(dialog.getByLabel("Data di nascita")).toHaveValue(
      "2016-12-14",
    );
    const child = dialog.getByRole("button", { name: "Figlio o figlia" });
    await expect(child).toHaveAttribute("aria-pressed", "true");
    for (const other of ["Adulto", "Animale"]) {
      await expect(dialog.getByRole("button", { name: other })).toHaveAttribute(
        "aria-disabled",
        "true",
      );
    }
    await expect(dialog.getByRole("radio", { name: "Salvia" })).toBeEnabled();
    await expect(dialog.getByRole("radio", { name: "Salvia" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(
      dialog.getByRole("button", { name: "Salva le modifiche" }),
    ).toBeVisible();
  });

  test("invito: solo nome e colore, «Continua», frase provvisoria", async ({
    page,
  }) => {
    const dialog = await openSheet(page, "Invita qualcuno");
    await expect(dialog).toHaveAccessibleName("Invita qualcuno");
    await expect(dialog).toHaveAccessibleDescription(/Per ora aggiungi/);
    await expect(dialog.getByLabel("Nome")).toBeFocused();
    await expect(dialog.getByRole("group", { name: "Chi è" })).toHaveCount(0);
    await expect(dialog.getByLabel("Data di nascita")).toHaveCount(0);
    await expect(dialog.getByRole("radio")).toHaveCount(10);
    await dialog.getByLabel("Nome").fill("Rita");
    await dialog.getByRole("button", { name: "Continua" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByTestId("membri-salvato")).toContainText(
      '"name":"Rita","kind":"adult","birthDate":null',
    );
  });

  test("chiudere senza salvare: Chiudi, Esc e Annulla (desktop) non salvano", async ({
    page,
  }, testInfo) => {
    const open = "Aggiungi una persona o un animale";
    let dialog = await openSheet(page, open);
    await dialog.getByLabel("Nome").fill("Rita");
    await dialog.getByRole("button", { name: "Chiudi" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("button", { name: open })).toBeFocused();

    await page.getByRole("button", { name: open }).click();
    dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Nome")).toHaveValue("");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    if (testInfo.project.name === "desktop") {
      await page.getByRole("button", { name: open }).click();
      await page.getByRole("button", { name: "Annulla" }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page.getByRole("button", { name: open })).toBeFocused();
    }
    await expect(page.getByTestId("membri-chiamate")).toHaveText("Chiamate: 0");
  });

  test("Invio nel nome salva", async ({ page }) => {
    const dialog = await openSheet(page, "Aggiungi una persona o un animale");
    await dialog.getByLabel("Nome").fill("Rita");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByTestId("membri-chiamate")).toHaveText("Chiamate: 1");
  });
});

test.describe("MemberSheet: correzioni della revisione", () => {
  test("trascinare il foglio durante il salvataggio non lo sposta", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "Solo il foglio mobile");
    await page.goto(DEMO);
    await page.getByRole("button", { name: "Lento" }).click();
    await page
      .getByRole("button", { name: "Aggiungi una persona o un animale" })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Nome").fill("Rita");
    // let the entry animation finish
    await page.waitForTimeout(600);
    const before = (await dialog.boundingBox())!;
    await dialog.getByRole("button", { name: "Aggiungi Rita" }).click();
    await expect(
      dialog.getByRole("button", { name: "Aggiungi Rita" }),
    ).toHaveAttribute("aria-busy", "true");
    const handle = (await page.getByTestId("sheet-maniglia").boundingBox())!;
    const x = handle.x + handle.width / 2;
    const y = handle.y + handle.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + 500, { steps: 5 });
    await page.mouse.up();
    await expect(dialog).toBeVisible();
    const after = (await dialog.boundingBox())!;
    expect(Math.abs(after.y - before.y)).toBeLessThan(2);
  });

  test("«Riprova» tiene il fuoco dentro il dialogo", async ({ page }) => {
    await page.goto(DEMO);
    await page.getByRole("button", { name: "Rete" }).click();
    await page
      .getByRole("button", { name: "Aggiungi una persona o un animale" })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Nome").fill("Rita");
    await dialog.getByRole("button", { name: "Aggiungi Rita" }).click();
    await dialog.getByRole("button", { name: "Riprova" }).click();
    const inside = await page.evaluate(() =>
      document
        .querySelector('[role="dialog"]')
        ?.contains(document.activeElement),
    );
    expect(inside).toBe(true);
    await expect(dialog.getByRole("alert")).toBeVisible();
    const stillInside = await page.evaluate(() =>
      document
        .querySelector('[role="dialog"]')
        ?.contains(document.activeElement),
    );
    expect(stillInside).toBe(true);
  });
});
