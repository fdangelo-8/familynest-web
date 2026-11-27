import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { waitForAnimationsToEnd } from "../fixtures/animations";
import { pickDay, typeTime } from "../fixtures/campi-data-ora";
import { waitHydrated } from "../fixtures/esplora";

// #505 (F4c): sheets, confirmation dialog, «Collega» row, date and time
// fields, on the design-system gallery (no data, no login). Examples and
// data: docs/specifiche/505 §8. The clock starts on Wednesday 18 November
// 2026, 10:00 in Rome and keeps running (the sheets use timers).

const NOW = new Date("2026-11-18T09:00:00Z");
const ROOT = process.cwd();

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

const tid = (page: Page, id: string) => page.getByTestId(id);

async function open(page: Page, time: Date = NOW) {
  await page.clock.install({ time });
  await page.goto("/design-system");
  await waitHydrated(tid(page, "ds-data"));
}

function css(locator: Locator, property: string) {
  return locator.evaluate(
    (el, prop) => getComputedStyle(el).getPropertyValue(prop),
    property,
  );
}

/** Computed value of an expression (`var(--color-pieno)`), seen from an element. */
function resolve(locator: Locator, expression: string, property: string) {
  return locator.evaluate(
    (el, [expr, prop]) => {
      const probe = document.createElement("span");
      probe.style.setProperty(prop as string, expr as string);
      el.appendChild(probe);
      const value = getComputedStyle(probe).getPropertyValue(prop as string);
      probe.remove();
      return value;
    },
    [expression, property],
  );
}

const box = async (locator: Locator) => (await locator.boundingBox())!;

// ------------------------------------------------------------- Foglio

test.describe("Foglio", () => {
  test.beforeEach(async ({ page }) => {
    await open(page);
  });

  test("CA-1, CA-2, CA-8: X a sinistra, Salva a destra, titolo al centro, fondo e ombra", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await tid(page, "ds-foglio-azione")
      .getByRole("button", { name: "Apri Nuovo impegno" })
      .click();
    const dialog = page.getByRole("dialog", { name: "Nuovo impegno" });
    await expect(dialog).toBeVisible();
    await waitForAnimationsToEnd(page);
    const close = dialog.getByRole("button", { name: "Chiudi" });
    const save = dialog.getByRole("button", { name: "Salva", exact: true });
    const title = dialog.getByRole("heading", { name: "Nuovo impegno" });

    // DOM order: X, Salva, title.
    const order = await dialog.evaluate((el) => {
      const nodes = [
        el.querySelector('[aria-label="Chiudi"]')!,
        el.querySelector('[data-testid="sheet-azione"]')!,
        el.querySelector("h2")!,
      ];
      return [
        nodes[0]!.compareDocumentPosition(nodes[1]!),
        nodes[1]!.compareDocumentPosition(nodes[2]!),
      ].map((position) => Boolean(position & Node.DOCUMENT_POSITION_FOLLOWING));
    });
    expect(order).toEqual([true, true]);

    const dialogBox = await box(dialog);
    const closeBox = await box(close);
    const saveBox = await box(save);
    const titleBox = await box(title);
    expect(closeBox.x).toBeLessThan(titleBox.x);
    expect(saveBox.x).toBeGreaterThan(titleBox.x);
    const dialogCenter = dialogBox.x + dialogBox.width / 2;
    expect(
      Math.abs(titleBox.x + titleBox.width / 2 - dialogCenter),
    ).toBeLessThanOrEqual(1);

    expect(await css(save, "text-decoration-line")).toBe("underline");
    expect(await css(save, "font-weight")).toBe("600");
    expect(await css(save, "text-decoration-thickness")).toBe(
      await resolve(save, "var(--border-link)", "width"),
    );
    expect(saveBox.height).toBeGreaterThanOrEqual(44);
    expect(saveBox.width).toBeGreaterThanOrEqual(44);
    expect(await css(dialog, "border-top-left-radius")).toBe(
      await resolve(dialog, "var(--radius-xl)", "width"),
    );
    expect(await css(dialog, "box-shadow")).toBe(
      await resolve(dialog, "var(--shadow-foglio)", "box-shadow"),
    );
    expect(await css(dialog, "background-color")).toBe(
      await resolve(dialog, "var(--color-superficie)", "background-color"),
    );
    await expect(tid(page, "sheet-maniglia")).toHaveCount(0);
    // `tall`: up to the safe area (0 here), the whole height.
    expect(Math.round(dialogBox.y)).toBe(0);
    expect(Math.round(dialogBox.height)).toBe(844);
  });

  test("CA-3: Salva mostra la rotella, il foglio non si chiude, poi si chiude e il fuoco torna", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const opener = tid(page, "ds-foglio-azione").getByRole("button", {
      name: "Apri Nuovo impegno",
    });
    await opener.click();
    const dialog = page.getByRole("dialog", { name: "Nuovo impegno" });
    await dialog.getByLabel("Titolo").fill("Nuoto Sofia");
    const save = dialog.getByRole("button", { name: "Salva", exact: true });
    const saveWidth = (await box(save)).width;
    await save.click();
    const busy = dialog.locator('button[aria-busy="true"]');
    await expect(busy).toBeVisible();
    await expect(busy.locator(".spinner")).toBeVisible();
    expect(Math.abs((await box(busy)).width - saveWidth)).toBeLessThanOrEqual(
      1,
    );
    // A second tap, Escape and the veil do nothing.
    await busy.click({ force: true });
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    await expect(dialog).toBeHidden({ timeout: 5000 });
    await expect(opener).toBeFocused();
  });

  test("CA-3 (vuoto): Salva senza titolo non fa nulla", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await tid(page, "ds-foglio-azione")
      .getByRole("button", { name: "Apri Nuovo impegno" })
      .click();
    const dialog = page.getByRole("dialog", { name: "Nuovo impegno" });
    await dialog.getByRole("button", { name: "Salva", exact: true }).click();
    await expect(dialog.locator('[aria-busy="true"]')).toHaveCount(0);
    await expect(dialog).toBeVisible();
  });

  test("CA-4: il piede resta attaccato al fondo quando il corpo scorre", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await tid(page, "ds-foglio-lungo")
      .getByRole("button", { name: "Apri Nuova scadenza lunga" })
      .click();
    const dialog = page.getByRole("dialog", { name: "Nuova scadenza" });
    await waitForAnimationsToEnd(page);
    const foot = dialog.locator(".foglio__piede");
    const before = (await box(foot)).y + (await box(foot)).height;
    await dialog.locator(".foglio__corpo").evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    const after = (await box(foot)).y + (await box(foot)).height;
    expect(Math.abs(after - before)).toBeLessThanOrEqual(1);
    const dialogBox = await box(dialog);
    expect(
      Math.abs(dialogBox.y + dialogBox.height - after),
    ).toBeLessThanOrEqual(1);
    expect(await css(foot, "border-top-width")).toBe(
      await resolve(foot, "var(--border-sottile)", "width"),
    );
    expect(await css(foot, "border-top-color")).toBe(
      await resolve(foot, "var(--color-filo-barra)", "color"),
    );
    const cancel = dialog.getByRole("button", { name: "Annulla" });
    const add = dialog.getByRole("button", { name: "Aggiungi" });
    expect(await css(cancel, "text-decoration-line")).toBe("underline");
    expect((await box(cancel)).x).toBeLessThan((await box(add)).x);
    // The main button is the full one of F4a: since #634 its fill is
    // `--color-pieno` (`--color-azione` only at hover and press).
    expect(await css(add, "background-color")).toBe(
      await resolve(add, "var(--color-pieno)", "background-color"),
    );
  });

  test("CA-6, CA-8: il piede apre sul campo, Tab resta dentro, Esc chiude e il fuoco torna", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const opener = tid(page, "ds-foglio-piede").getByRole("button", {
      name: "Apri Nuova scadenza",
    });
    await opener.click();
    const dialog = page.getByRole("dialog", { name: "Nuova scadenza" });
    await expect(dialog.getByLabel("Che cosa")).toBeFocused();
    for (let i = 0; i < 8; i += 1) {
      await page.keyboard.press("Tab");
      expect(
        await dialog.evaluate((el) => el.contains(document.activeElement)),
      ).toBe(true);
    }
    await page.keyboard.press("Shift+Tab");
    expect(
      await dialog.evaluate((el) => el.contains(document.activeElement)),
    ).toBe(true);
    // Not `tall`: as tall as its content.
    await waitForAnimationsToEnd(page);
    expect((await box(dialog)).height).toBeLessThan(844 - 100);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test("CA-7: un foglio sopra un altro: Esc chiude solo quello sopra", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await tid(page, "ds-foglio-sopra")
      .getByRole("button", { name: "Apri Nuova scadenza sopra" })
      .click();
    const below = page.getByRole("dialog", { name: "Nuova scadenza" });
    await expect(below).toBeVisible();
    const row = below.getByRole("button", { name: /Si ripete/ });
    await row.click();
    const above = page.getByRole("dialog", { name: "Si ripete" });
    await expect(above).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(above).toBeHidden();
    await expect(below).toBeVisible();
    await expect(row).toBeFocused();
  });

  test("CA-9: il titolo a sinistra va a capo e non è tagliato", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await tid(page, "ds-foglio-titolo-inizio")
      .getByRole("button", { name: "Apri titolo lungo" })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Tommaso ha già un impegno alla stessa ora",
    });
    const title = dialog.getByRole("heading");
    const close = dialog.getByRole("button", { name: "Chiudi" });
    expect((await box(title)).x).toBeGreaterThanOrEqual(
      (await box(close)).x + (await box(close)).width - 1,
    );
    expect((await box(title)).height).toBeGreaterThan(30);
    expect(await title.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
      true,
    );
  });

  test("CA-10: a 1280 è una modale con la stessa testata; X, Esc e velo la chiudono", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const opener = tid(page, "ds-foglio-azione").getByRole("button", {
      name: "Apri Nuovo impegno",
    });
    await opener.click();
    const dialog = page.getByRole("dialog", { name: "Nuovo impegno" });
    await expect(dialog).toHaveClass(/modale/);
    const dialogBox = await box(dialog);
    expect(dialogBox.x).toBeGreaterThan(100);
    const close = dialog.getByRole("button", { name: "Chiudi" });
    const save = dialog.getByRole("button", { name: "Salva", exact: true });
    const title = dialog.getByRole("heading", { name: "Nuovo impegno" });
    expect((await box(close)).x).toBeLessThan((await box(title)).x);
    expect((await box(save)).x).toBeGreaterThan((await box(title)).x);
    await close.click();
    await expect(dialog).toBeHidden();
    await opener.click();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await opener.click();
    await page.mouse.click(5, 5);
    await expect(dialog).toBeHidden();
  });

  test("D8: a 899 × 844 è un foglio, a 900 × 844 una modale, a 1280 × 560 un foglio", async ({
    page,
  }) => {
    const opener = tid(page, "ds-foglio-azione").getByRole("button", {
      name: "Apri Nuovo impegno",
    });
    const dialog = page.getByRole("dialog", { name: "Nuovo impegno" });
    for (const [width, height, shape] of [
      [899, 844, /foglio/],
      [900, 844, /modale/],
      [1280, 560, /foglio/],
      [1280, 800, /modale/],
    ] as const) {
      await page.setViewportSize({ width, height });
      await opener.click();
      await expect(dialog).toHaveClass(shape);
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
    }
  });

  test("CA-11: trascinare la testata oltre il 25% chiude, sotto torna al suo posto", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await tid(page, "ds-foglio-piede")
      .getByRole("button", { name: "Apri Nuova scadenza" })
      .click();
    const dialog = page.getByRole("dialog", { name: "Nuova scadenza" });
    await waitForAnimationsToEnd(page);
    const head = tid(page, "sheet-testa");
    const headBox = await box(head);
    const dialogBox = await box(dialog);
    const startX = headBox.x + headBox.width / 2;
    const startY = headBox.y + headBox.height / 2;
    // Under the limit: back in its place.
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX, startY + dialogBox.height * 0.1, {
      steps: 4,
    });
    await page.mouse.up();
    await expect(dialog).toBeVisible();
    await waitForAnimationsToEnd(page);
    expect(Math.abs((await box(dialog)).y - dialogBox.y)).toBeLessThanOrEqual(
      1,
    );
    // Over the limit: closes.
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX, startY + dialogBox.height * 0.4, {
      steps: 4,
    });
    await page.mouse.up();
    await expect(dialog).toBeHidden();
  });
});

// ------------------------------------------------------------- Conferma

test.describe("Dialogo di conferma", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { vibrations: number }).vibrations = 0;
      navigator.vibrate = () => {
        (window as unknown as { vibrations: number }).vibrations += 1;
        return true;
      };
    });
    await open(page);
  });

  test("CA-12, CA-13: nome, descrizione, pulsanti uno sopra l'altro, fuoco su «Annulla»", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await tid(page, "ds-conferma")
      .getByRole("button", { name: "Togli Biscotto" })
      .click();
    const dialog = page.getByRole("alertdialog", {
      name: "Togliere Biscotto dal Nest?",
    });
    await expect(dialog).toBeVisible();
    // The pointer is away: no hover colour on the buttons.
    await page.mouse.move(0, 0);
    await expect(dialog).toHaveAccessibleDescription(
      "Spariscono il suo profilo e la foto. Scadenze e cose da fare restano, senza il suo nome.",
    );
    const remove = dialog.getByRole("button", { name: "Togli dal Nest" });
    const cancel = dialog.getByRole("button", { name: "Annulla" });
    expect((await box(remove)).y).toBeLessThan((await box(cancel)).y);
    expect(
      Math.abs((await box(remove)).width - (await box(cancel)).width),
    ).toBeLessThanOrEqual(1);
    expect(await css(remove, "background-color")).toBe(
      await resolve(remove, "var(--color-allerta-pieno)", "background-color"),
    );
    expect(await css(remove, "color")).toBe(
      await resolve(remove, "var(--color-latte)", "color"),
    );
    expect(await css(cancel, "background-color")).toBe(
      await resolve(cancel, "var(--color-superficie)", "background-color"),
    );
    // Level 2: the ring is an inner line of ink.
    expect(await css(cancel, "box-shadow")).toBe(
      await resolve(
        cancel,
        "inset 0 0 0 var(--border-sottile) var(--color-inchiostro)",
        "box-shadow",
      ),
    );
    await expect(cancel).toBeFocused();
    expect(
      await page.evaluate(
        () => (window as unknown as { vibrations: number }).vibrations,
      ),
    ).toBe(0);
  });

  test("CA-14: se l'azione fallisce il dialogo resta con l'avviso e il fuoco sull'avviso", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await tid(page, "ds-conferma-errore")
      .getByRole("button", { name: "Togli Biscotto" })
      .click();
    const dialog = page.getByRole("alertdialog");
    await dialog.getByRole("button", { name: "Togli dal Nest" }).click();
    await expect(
      dialog.getByRole("button", { name: "Annulla" }),
    ).toHaveAttribute("aria-disabled", "true");
    const alert = dialog.getByRole("alert");
    await expect(alert).toHaveText(
      "Non siamo riusciti a completare l'azione. Controlla la connessione e riprova.",
    );
    await expect(alert).toBeFocused();
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Annulla" }),
    ).not.toHaveAttribute("aria-disabled", "true");
  });
});

// ------------------------------------------------------------- Collega

test.describe("Riga «Collega»", () => {
  test.beforeEach(async ({ page }) => {
    await open(page);
  });

  test("CA-16: pillola a filo e riga intera cliccabile", async ({ page }) => {
    const rows = tid(page, "ds-collega");
    const google = rows.getByRole("button", {
      name: "Collega Google Calendar",
    });
    const outlook = rows.getByRole("button", { name: "Collega Outlook" });
    for (const pill of [google, outlook]) {
      expect((await box(pill)).height).toBeGreaterThanOrEqual(36);
      // The browser draws a border in whole pixels: compare with a probe.
      expect(await css(pill, "border-top-width")).toBe(
        await pill.evaluate((el) => {
          const probe = document.createElement("span");
          probe.style.setProperty("border", "var(--border-medio) solid");
          el.appendChild(probe);
          const width = getComputedStyle(probe).borderTopWidth;
          probe.remove();
          return width;
        }),
      );
      expect(await css(pill, "border-top-color")).toBe(
        await resolve(pill, "var(--color-inchiostro)", "color"),
      );
      expect(await css(pill, "color")).toBe(
        await resolve(pill, "var(--color-inchiostro)", "color"),
      );
      expect(await css(pill, "background-color")).toBe("rgba(0, 0, 0, 0)");
      expect(await css(pill, "border-top-left-radius")).toBe(
        await resolve(pill, "var(--radius-capsula)", "width"),
      );
    }
    const text = rows.getByText("Lavoro e calendari condivisi");
    await text.scrollIntoViewIfNeeded();
    const textBox = await box(text);
    const hit = await page.evaluate(
      ([x, y]) => {
        const element = document.elementFromPoint(x!, y!);
        return element?.getAttribute("aria-label") ?? "";
      },
      [textBox.x + textBox.width / 2, textBox.y + textBox.height / 2],
    );
    expect(hit).toBe("Collega Outlook");
  });

  test("CA-17, CA-19: Outlook collega, «Collegato» in verde, annuncio e fuoco", async ({
    page,
  }) => {
    const rows = tid(page, "ds-collega");
    await rows.getByRole("button", { name: "Collega Outlook" }).click();
    await expect(
      rows.locator('button[aria-busy="true"] .spinner'),
    ).toBeVisible();
    const state = rows.getByTestId("collega-stato");
    await expect(state).toHaveText("Collegato");
    await expect(
      rows.getByText("12 impegni nelle prossime quattro settimane"),
    ).toBeVisible();
    await expect(rows.getByRole("button", { name: /Outlook/ })).toHaveCount(0);
    await expect(
      rows.getByRole("status").filter({ hasText: "Outlook collegato" }),
    ).toHaveCount(1);
    await expect(state).toBeFocused();
    expect(await css(state, "color")).toBe(
      await resolve(state, "var(--color-ok)", "color"),
    );
    expect(await css(state, "border-top-width")).toBe("0px");
  });

  test("CA-18: se Google Calendar non collega, avviso sopra l'elenco e «Riprova»", async ({
    page,
  }) => {
    const rows = tid(page, "ds-collega");
    await rows.getByRole("button", { name: "Collega Google Calendar" }).click();
    const alert = rows.getByRole("alert");
    await expect(alert).toHaveText(
      "Non siamo riusciti a collegare Google Calendar. Riprova, oppure continua senza.",
    );
    const retry = rows.getByRole("button", { name: "Riprova Google Calendar" });
    await expect(retry).toHaveText("Riprova");
    await expect(
      rows.getByRole("button", { name: "Collega Outlook" }),
    ).toBeVisible();
    await retry.click();
    await expect(rows.locator('button[aria-busy="true"]')).toHaveCount(1);
  });
});

// ------------------------------------------------------------- Data

test.describe("Selettore di data, telefono", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page);
  });

  const fieldOf = (page: Page, id: string, name: string | RegExp) =>
    tid(page, id).getByRole("button", { name });

  test("CA-20, CA-21: il campo è un pulsante con il giorno scritto", async ({
    page,
  }) => {
    const field = fieldOf(page, "ds-data", "Giorno, Mercoledì 18 novembre");
    await expect(field).toHaveAttribute("aria-haspopup", "dialog");
    await expect(
      page.locator('input[type="date"], input[type="time"]'),
    ).toHaveCount(0);
    await expect(
      fieldOf(page, "ds-data-anno", "Giorno, Lunedì 4 gennaio 2027"),
    ).toBeVisible();
    await expect(
      fieldOf(page, "ds-data-limiti", "Fino a, Martedì 24 novembre"),
    ).toBeVisible();
    await expect(fieldOf(page, "ds-data-vuota", "Quando")).toBeVisible();
  });

  test("CA-22: il foglio ha mese e anno, sette giorni, griglia e tondi da 44 px", async ({
    page,
  }) => {
    await fieldOf(page, "ds-data", /^Giorno/).click();
    const dialog = page.getByRole("dialog", { name: "Giorno" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Novembre", { exact: true })).toBeVisible();
    await expect(dialog.getByText("2026", { exact: true })).toBeVisible();
    await expect(dialog.getByRole("columnheader")).toHaveCount(7);
    await expect(dialog.getByRole("columnheader").first()).toHaveText("lun");
    await expect(dialog.getByRole("columnheader").last()).toHaveText("dom");
    const grid = dialog.getByRole("grid", { name: "Novembre 2026" });
    const eighteen = grid.locator('[data-day="2026-11-18"]');
    await expect(eighteen).toHaveAttribute("aria-selected", "true");
    await expect(eighteen).toHaveAttribute("aria-current", "date");
    for (const cell of await grid.getByRole("gridcell").all()) {
      const size = await box(cell);
      expect(Math.round(size.width)).toBe(44);
      expect(Math.round(size.height)).toBe(44);
    }
    // The chosen day is a full fill with the light text on it.
    expect(await css(eighteen, "background-color")).toBe(
      await resolve(eighteen, "var(--color-pieno)", "background-color"),
    );
    expect(await css(eighteen, "color")).toBe(
      await resolve(eighteen, "var(--color-latte)", "color"),
    );
  });

  test("CA-23: un solo tocco sceglie il 24 e chiude, senza «Conferma»", async ({
    page,
  }) => {
    const field = fieldOf(page, "ds-data", /^Giorno/);
    await field.click();
    const dialog = page.getByRole("dialog", { name: "Giorno" });
    await expect(
      dialog.getByRole("button", { name: /Conferma|Fatto/ }),
    ).toHaveCount(0);
    await dialog.locator('[data-day="2026-11-24"]').click();
    await expect(dialog).toBeHidden();
    await expect(field).toHaveAccessibleName("Giorno, Martedì 24 novembre");
    await expect(tid(page, "ds-data-stato")).toHaveText("Valore: 2026-11-24");
    await expect(field).toBeFocused();
  });

  test("CA-24: le frecce cambiano mese", async ({ page }) => {
    await fieldOf(page, "ds-data", /^Giorno/).click();
    const dialog = page.getByRole("dialog", { name: "Giorno" });
    await dialog.getByRole("button", { name: "Mese successivo" }).click();
    await dialog.getByRole("button", { name: "Mese successivo" }).click();
    await expect(dialog.getByText("Gennaio", { exact: true })).toBeVisible();
    await expect(dialog.getByText("2027", { exact: true })).toBeVisible();
    for (let i = 0; i < 3; i += 1) {
      await dialog.getByRole("button", { name: "Mese precedente" }).click();
    }
    await expect(dialog.getByText("Ottobre", { exact: true })).toBeVisible();
    await expect(dialog.getByText("2026", { exact: true })).toBeVisible();
  });

  test("CA-25: la tastiera muove il fuoco e Invio sceglie", async ({
    page,
  }) => {
    const field = fieldOf(page, "ds-data", /^Giorno/);
    await field.click();
    const dialog = page.getByRole("dialog", { name: "Giorno" });
    const day = (key: string) => dialog.locator(`[data-day="${key}"]`);
    await expect(day("2026-11-18")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(day("2026-11-19")).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(day("2026-11-26")).toBeFocused();
    await page.keyboard.press("PageDown");
    await expect(day("2026-12-26")).toBeFocused();
    await page.keyboard.press("Home");
    await expect(day("2026-12-21")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(dialog).toBeHidden();
    await expect(field).toHaveAccessibleName("Giorno, Lunedì 21 dicembre");
    await field.click();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(field).toHaveAccessibleName("Giorno, Lunedì 21 dicembre");
  });

  test("CA-26: fuori da min e max non si sceglie", async ({ page }) => {
    const field = fieldOf(page, "ds-data-limiti", /^Fino a/);
    await field.click();
    const dialog = page.getByRole("dialog", { name: "Fino a" });
    await waitForAnimationsToEnd(page);
    const nine = dialog.locator('[data-day="2026-11-09"]');
    await expect(nine).toHaveAttribute("aria-disabled", "true");
    // A day that cannot be chosen: the click is forced past the check of
    // Playwright, which waits for an enabled element.
    await nine.click({ force: true });
    await expect(dialog).toBeVisible();
    await expect(tid(page, "ds-data-limiti-stato")).toHaveText(
      "Valore: 2026-11-24",
    );
    const next = dialog.getByRole("button", { name: "Mese successivo" });
    await next.click();
    await expect(dialog.getByText("Dicembre", { exact: true })).toBeVisible();
    await expect(dialog.locator('[data-day="2026-12-21"]')).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await expect(next).toHaveAttribute("aria-disabled", "true");
  });

  test("CA-27: senza valore il fuoco è su oggi e nessun giorno è scelto", async ({
    page,
  }) => {
    await fieldOf(page, "ds-data-vuota", "Quando").click();
    const dialog = page.getByRole("dialog", { name: "Quando" });
    await expect(dialog.locator('[data-day="2026-11-18"]')).toBeFocused();
    await expect(dialog.locator('[aria-selected="true"]')).toHaveCount(0);
  });

  test("l'aiuto unico sceglie un giorno in un altro mese", async ({ page }) => {
    const field = fieldOf(page, "ds-data", /^Giorno/);
    await pickDay(field, "2027-02-03");
    await expect(field).toHaveAccessibleName(
      "Giorno, Mercoledì 3 febbraio 2027",
    );
    await expect(tid(page, "ds-data-stato")).toHaveText("Valore: 2027-02-03");
  });
});

test.describe("Selettore di data, fuso", () => {
  test.use({ timezoneId: "America/Los_Angeles" });

  test("CA-28: «oggi» è il giorno di Roma, non quello del telefono", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    // 00:30 in Rome on 18 November is still 17 November in Los Angeles.
    await open(page, new Date("2026-11-17T23:30:00Z"));
    await tid(page, "ds-data-vuota")
      .getByRole("button", { name: "Quando" })
      .click();
    const today = page.locator('[role="gridcell"][aria-current="date"]');
    await expect(today).toHaveAttribute("data-day", "2026-11-18");
  });
});

test.describe("Selettore di data, computer", () => {
  test("CA-29: il calendario è un riquadro sotto il campo; Esc e clic fuori lo chiudono", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await open(page);
    const field = tid(page, "ds-data").getByRole("button", { name: /^Giorno/ });
    await field.click();
    const popover = page.getByTestId("calendario-riquadro");
    await expect(popover).toBeVisible();
    await expect(page.locator(".foglio")).toHaveCount(0);
    const fieldBox = await box(field);
    expect((await box(popover)).y).toBeGreaterThanOrEqual(
      fieldBox.y + fieldBox.height,
    );
    await page.keyboard.press("Escape");
    await expect(popover).toBeHidden();
    await expect(field).toBeFocused();
    await field.click();
    await expect(popover).toBeVisible();
    await page.mouse.click(5, 5);
    await expect(popover).toBeHidden();
    await expect(field).toBeFocused();
  });
});

// ------------------------------------------------------------- Ora

test.describe("Campo dell'ora", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page);
  });

  test("CA-30: «1730», «9» e «17.05» diventano HH:MM e arrivano a onChange", async ({
    page,
  }) => {
    const from = tid(page, "ds-ora").getByLabel("Dalle", { exact: true });
    await expect(from).toHaveAttribute("type", "text");
    await expect(from).toHaveAttribute("inputmode", "numeric");
    await expect(from).toHaveAttribute("autocomplete", "off");
    const status = tid(page, "ds-ora-stato");
    await typeTime(from, "1730");
    await expect(from).toHaveValue("17:30");
    await expect(status).toHaveText("Valore: 17:30");
    await typeTime(from, "9");
    await expect(from).toHaveValue("09:00");
    await typeTime(from, "17.05");
    await expect(from).toHaveValue("17:05");
    await expect(status).toHaveText("Valore: 17:05");
  });

  test("CA-31: un'ora impossibile mostra l'errore e il valore di prima resta", async ({
    page,
  }) => {
    const from = tid(page, "ds-ora").getByLabel("Dalle", { exact: true });
    const status = tid(page, "ds-ora-stato");
    for (const wrong of ["25:00", "17:75", "abc"]) {
      await typeTime(from, wrong);
      const error = tid(page, "ds-ora").getByText(
        "Scrivi un'ora da 00:00 a 23:59, per esempio 17:30.",
      );
      await expect(error).toBeVisible();
      await expect(from).toHaveAttribute("aria-invalid", "true");
      const describedBy = await from.getAttribute("aria-describedby");
      expect(describedBy).toBeTruthy();
      await expect(page.locator(`[id="${describedBy}"]`)).toHaveText(
        /Scrivi un'ora da 00:00 a 23:59/,
      );
      await expect(error.locator("xpath=..").locator("svg")).toHaveCount(1);
      await expect(status).toHaveText("Valore: 16:00");
    }
  });
});

test.describe("Campo dell'ora, lingua inglese", () => {
  test.use({ locale: "en-US" });

  test("CA-32: «Dalle» mostra 16:00 e non compaiono AM né PM", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page);
    await expect(
      tid(page, "ds-ora").getByLabel("Dalle", { exact: true }),
    ).toHaveValue("16:00");
    await expect(tid(page, "ds-ora")).not.toContainText(/\b(AM|PM)\b/);
  });
});

// ------------------------------------------------------------- Tema

test.describe("Tema scuro e token", () => {
  test("CA-36: giorno scelto, pillola, «Collegato», rosso e fondo del foglio seguono i token", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page);
    await page.addStyleTag({
      content: `html:root {
        --color-pieno: rgb(10, 20, 30) !important;
        --color-latte: rgb(40, 50, 60) !important;
        --color-superficie: rgb(70, 80, 90) !important;
        --color-inchiostro: rgb(100, 110, 120) !important;
        --color-allerta-pieno: rgb(130, 140, 150) !important;
        --color-ok: rgb(160, 170, 180) !important;
      }`,
    });
    const pill = tid(page, "ds-collega").getByRole("button", {
      name: "Collega Outlook",
    });
    expect(await css(pill, "border-top-color")).toBe("rgb(100, 110, 120)");
    await pill.click();
    await expect(
      tid(page, "ds-collega").getByTestId("collega-stato"),
    ).toHaveText("Collegato");
    expect(
      await css(tid(page, "ds-collega").getByTestId("collega-stato"), "color"),
    ).toBe("rgb(160, 170, 180)");
    await tid(page, "ds-data")
      .getByRole("button", { name: /^Giorno/ })
      .click();
    const dialog = page.getByRole("dialog", { name: "Giorno" });
    expect(await css(dialog, "background-color")).toBe("rgb(70, 80, 90)");
    const day = dialog.locator('[data-day="2026-11-18"]');
    expect(await css(day, "background-color")).toBe("rgb(10, 20, 30)");
    await page.keyboard.press("Escape");
    await tid(page, "ds-conferma")
      .getByRole("button", { name: "Togli Biscotto" })
      .click();
    expect(
      await css(
        page
          .getByRole("alertdialog")
          .getByRole("button", { name: "Togli dal Nest" }),
        "background-color",
      ),
    ).toBe("rgb(130, 140, 150)");
  });
});

// ------------------------------------------------------------- Statici

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : [path];
  });
}

test.describe("regole statiche", () => {
  const uiFiles = () =>
    sourceFiles(join(ROOT, "src/components/ui")).filter((file) =>
      /\.tsx?$/.test(file),
    );

  test("CA-15: `pericolo-pieno` compare solo in ConfirmDialog (e nella definizione di Button)", () => {
    const users = uiFiles().filter(
      (file) =>
        /pericolo-pieno/.test(readFileSync(file, "utf8")) &&
        !file.includes("/Button/"),
    );
    expect(users.map((file) => file.split("/").pop())).toEqual([
      "ConfirmDialog.tsx",
    ]);
  });

  test("CA-34: i file nuovi non importano Supabase né chiamano fetch", () => {
    for (const file of [
      "Sheet/Sheet.tsx",
      "ConfirmDialog/ConfirmDialog.tsx",
      "ConnectRow/ConnectRow.tsx",
      "MonthCalendar/MonthCalendar.tsx",
      "Field/DateTimeFields.tsx",
      "Field/FieldShell.tsx",
      "Field/Field.tsx",
    ]) {
      const source = readFileSync(
        join(ROOT, "src/components/ui", file),
        "utf8",
      );
      expect(source, file).not.toMatch(/@\/lib\/supabase/);
      expect(source, file).not.toMatch(/\bfetch\(/);
    }
  });

  test("CA-35: nelle regole nuove non c'è nessun colore scritto a mano", () => {
    const css = readFileSync(
      join(ROOT, "src/app/components.css"),
      "utf8",
    ).replace(/\/\*[\s\S]*?\*\//g, "");
    const start = css.indexOf(".elenco-collega {");
    expect(start).toBeGreaterThan(0);
    expect(css.slice(start)).not.toMatch(
      /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|\bwhite\b|\bblack\b/,
    );
  });

  test("CA-i18n: i testi dei componenti nuovi vengono da it.ts", () => {
    for (const [file, texts] of [
      [
        "ConnectRow/ConnectRow.tsx",
        ["Collegato", "Riprova", "Non siamo riusciti"],
      ],
      [
        "MonthCalendar/MonthCalendar.tsx",
        ["Mese precedente", "Mese successivo"],
      ],
      ["Field/DateTimeFields.tsx", ["Scrivi un'ora"]],
      ["ConfirmDialog/ConfirmDialog.tsx", ["Non siamo riusciti"]],
    ] as const) {
      // Comments say the words too: only the code counts.
      const source = readFileSync(join(ROOT, "src/components/ui", file), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      for (const text of texts) {
        expect(source, `${file}: ${text}`).not.toContain(text);
      }
    }
    const it = readFileSync(join(ROOT, "src/lib/i18n/messages/it.ts"), "utf8");
    for (const text of [
      "Mese precedente",
      "Mese successivo",
      "Collegato",
      "Scrivi un'ora da 00:00 a 23:59",
    ]) {
      expect(it).toContain(text);
    }
  });
});
