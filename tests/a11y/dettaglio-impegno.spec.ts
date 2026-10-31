import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  CENA,
  NOW,
  RIUNIONE,
  detailUrl,
  installEventFake,
  type EventFakeOptions,
} from "../fixtures/dettaglio-impegno-fake";
import { hasTestUser } from "../fixtures/visual-login";
import { signInAsCached } from "../fixtures/visual-login-cached";

// Dettaglio impegno (#19), visual tester's accessibility checks: axe in every
// state (card, form, disabled fields, field errors, both save dialogs, the
// delete dialog, loading, «Non c'è più», read error, toast), keyboard (focus
// order, visible ring, no trap, focus given back), touch areas of 44 px with
// elementFromPoint, and contrast of the texts of the page.
// The event is served by a fake of the database functions
// (fixtures/dettaglio-impegno-fake.ts): nothing is written to the database.
// Test user A (Casa D'Angelo: Marco, Laura, Sofia, Tommaso, Biscotto) is needed.

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

test.beforeEach(async ({ context, baseURL }) => {
  test.skip(!hasTestUser("A"), "TEST_USER_A_* non impostati");
  const signedIn = await signInAsCached(context, baseURL!, "A");
  test.skip(!signedIn, "utente di test A non ancora creato (#55)");
});

async function open(
  page: Page,
  options: EventFakeOptions = {},
  day = "2026-10-20",
  ready = true,
) {
  await page.clock.install({ time: NOW });
  const fake = await installEventFake(page, options);
  await page.goto(detailUrl(day));
  if (ready) {
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: 20_000,
    });
  }
  return fake;
}

const main = (page: Page) => page.getByRole("main");
const isMobile = (name: string) => name === "mobile";

async function openForm(page: Page) {
  await main(page).getByRole("button", { name: "Modifica" }).click();
  await expect(
    page.getByRole("dialog", { name: "Modifica impegno" }),
  ).toBeVisible();
  await expect(page.getByLabel("Titolo")).toBeFocused();
}

const saveButton = (page: Page) =>
  page.getByRole("button", { name: "Salva le modifiche" });

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => n.target.join(" ")),
    }));
}

/** Nuoto, title changed: the save dialog with two choices. */
async function openChoiceDialog(page: Page) {
  await openForm(page);
  await page.getByLabel("Titolo").fill("Nuoto");
  await saveButton(page).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
}

/** Nuoto, Tommaso added: the save dialog with the only choice. */
async function openAllDialog(page: Page) {
  await openForm(page);
  await page
    .getByRole("group", { name: "Chi", exact: true })
    .getByRole("button", { name: /Tommaso/ })
    .click();
  await saveButton(page).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
}

// --- axe, every state -------------------------------------------------------

test.describe("axe", () => {
  test("scheda", async ({ page }) => {
    await open(page);
    expect(await seriousViolations(page)).toEqual([]);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(page).toHaveTitle("FamilyNest · Impegno");
  });

  test("scheda di un impegno che non si ripete", async ({ page }) => {
    await open(page, { row: CENA }, "2026-10-23");
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("modulo aperto", async ({ page }) => {
    await open(page);
    await openForm(page);
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("modulo con gli errori dei campi", async ({ page }) => {
    await open(page);
    await openForm(page);
    await page.getByLabel("Titolo").fill("");
    await page
      .getByRole("group", { name: "Chi", exact: true })
      .getByRole("button", { name: /Sofia/ })
      .click();
    await saveButton(page).click();
    const title = page.getByLabel("Titolo");
    await expect(title).toHaveAttribute("aria-invalid", "true");
    await expect(title).toBeFocused();
    await expect(
      page.getByText("Scrivi il titolo dell'impegno."),
    ).toBeVisible();
    await expect(page.getByText("Scegli almeno una persona.")).toBeVisible();
    // The field is described by its error.
    const describedBy = await title.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(
      await page.evaluate(
        (ids) =>
          ids
            .split(" ")
            .map((id) => document.getElementById(id)?.textContent ?? "")
            .join(" "),
        describedBy!,
      ),
    ).toContain("Scrivi il titolo dell'impegno.");
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("modulo con i campi disabilitati (Occupato di un altro)", async ({
    page,
  }) => {
    await open(page, { row: RIUNIONE }, "2026-10-23");
    await openForm(page);
    const visibility = page.getByRole("group", { name: "Chi lo vede" });
    for (const voice of await visibility.getByRole("button").all()) {
      await expect(voice).toBeDisabled();
    }
    await expect(
      visibility.getByRole("button", { name: "Occupato" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByText("Le persone le sceglie Laura, che l'ha creato."),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Gli altri vedono solo che c'è un impegno, senza dettagli. Lo decide Laura, che l'ha creato.",
      ),
    ).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("dialogo di salvataggio con due scelte", async ({ page }) => {
    await open(page);
    await openChoiceDialog(page);
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("dialogo di salvataggio con una sola scelta", async ({ page }) => {
    await open(page);
    await openAllDialog(page);
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("dialogo di salvataggio con l'errore (role=alert)", async ({ page }) => {
    const fake = await open(page);
    await openChoiceDialog(page);
    fake.failWrites("network");
    const dialog = page.getByRole("alertdialog");
    await dialog.getByRole("button", { name: "Salva solo questo" }).click();
    const alert = dialog.getByRole("alert");
    await expect(alert).toHaveText(
      "Non riusciamo a salvare le modifiche. Controlla la connessione e riprova.",
    );
    // The error does not take the focus away from the buttons.
    expect(
      await page.evaluate(
        () =>
          document.activeElement?.closest('[role="alertdialog"]') !== null &&
          document.activeElement?.getAttribute("role") !== "alert",
      ),
    ).toBe(true);
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("dialogo di eliminazione", async ({ page }) => {
    await open(page);
    await openForm(page);
    await page.getByRole("button", { name: "Elimina impegno" }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("caricamento: aria-busy, testo nascosto, matita inattiva", async ({
    page,
  }, testInfo) => {
    await open(page, { reads: "slow" }, "2026-10-20", false);
    await expect(page.locator(".skeleton--grande")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText("Caricamento in corso")).toBeAttached();
    await expect(page.locator("main .gruppo-skeleton")).toHaveAttribute(
      "aria-busy",
      "true",
    );
    if (isMobile(testInfo.project.name)) {
      // Same look as the active one, but it only waits.
      await expect(
        page.getByRole("button", { name: "Modifica" }),
      ).toHaveAttribute("aria-disabled", "true");
    }
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("«Questo impegno non c'è più»", async ({ page }) => {
    await open(page, { reads: "missing" });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Questo impegno non c'è più",
    );
    // Not the route announcer of Next, which is a `role="alert"` too.
    await expect(main(page).getByRole("alert")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Vai al calendario" }),
    ).toHaveAttribute("href", "/calendario");
    await expect(page.getByRole("button", { name: "Modifica" })).toHaveCount(0);
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("lettura non riuscita", async ({ page }) => {
    await open(page, { reads: "error" });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Questa pagina non si è caricata",
    );
    await expect(page.getByRole("button", { name: "Riprova" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Modifica" })).toHaveCount(0);
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("toast «Modifiche salvate»", async ({ page }) => {
    await open(page);
    await openChoiceDialog(page);
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Salva solo questo" })
      .click();
    const toast = page.getByRole("status").filter({
      hasText: "Modifiche salvate",
    });
    await expect(toast).toBeVisible();
    // Focus goes back to the button that opened the form.
    await expect(
      main(page).getByRole("button", { name: "Modifica" }),
    ).toBeFocused();
    expect(await seriousViolations(page)).toEqual([]);
  });
});

// --- names and descriptions ----------------------------------------------------

test.describe("nomi e descrizioni", () => {
  test("scheda: orario letto per esteso, indicazioni, freccia nascosta", async ({
    page,
  }, testInfo) => {
    await open(page);
    // The card is named by its title.
    await expect(
      page.getByRole("article", { name: "Nuoto Sofia" }),
    ).toBeVisible();
    // «17:00 – 18:30» is hidden from the readers, which get the sentence.
    await expect(page.getByText("dalle 17:00 alle 18:30")).toBeAttached();
    const directions = main(page).getByRole("link", {
      name: "Indicazioni per Piscina comunale, Lissone, si apre in un'altra scheda",
    });
    await expect(directions).toHaveAttribute("target", "_blank");
    expect(await directions.getAttribute("rel")).toContain("noopener");
    if (!isMobile(testInfo.project.name)) {
      // The arrow is text hidden from the readers: the name is only the words.
      await expect(
        main(page).getByRole("link", {
          name: "Torna al calendario",
          exact: true,
        }),
      ).toBeVisible();
    }
  });

  test("«Chi lo vede»: la frase descrive il gruppo (live solo per l'autore)", async ({
    page,
  }) => {
    await open(page, { row: CENA }, "2026-10-23");
    await openForm(page);
    const group = page.getByRole("group", { name: "Chi lo vede" });
    const describedBy = await group.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const help = page.locator(`[id="${describedBy}"]`);
    await expect(help).toHaveText("Lo vede tutto il Nest.");
    await expect(help).toHaveAttribute("aria-live", "polite");
    await group.getByRole("button", { name: "Occupato" }).click();
    await expect(help).toHaveText("Gli altri vedono solo che sei occupato.");
    await group.getByRole("button", { name: "Solo io" }).click();
    await expect(help).toHaveText("Lo vedi solo tu e chi partecipa.");
  });

  test("«Chi lo vede» bloccato: nessuna regione live", async ({ page }) => {
    await open(page, { row: RIUNIONE }, "2026-10-23");
    await openForm(page);
    const group = page.getByRole("group", { name: "Chi lo vede" });
    const describedBy = await group.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    await expect(page.locator(`[id="${describedBy}"]`)).not.toHaveAttribute(
      "aria-live",
      /.+/,
    );
  });
});

// --- keyboard -----------------------------------------------------------------

/** What the focused element is, for the order of the focus. */
async function whereIsFocus(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return "";
    const group = el.closest('[role="group"]');
    if (group) {
      const labelledBy = group.getAttribute("aria-labelledby");
      const label =
        group.getAttribute("aria-label") ??
        (labelledBy ? document.getElementById(labelledBy)?.textContent : null);
      return `gruppo:${label}`;
    }
    const label = (el as HTMLInputElement).labels?.[0]?.textContent;
    return (
      label ??
      el.getAttribute("aria-label") ??
      (el.textContent ?? "").trim().replace(/\s+/g, " ")
    );
  });
}

/** Tab once, going through the parts of a date or time field as one stop. */
async function nextStop(page: Page) {
  const before = await page.evaluateHandle(() => document.activeElement);
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Tab");
    const same = await page.evaluate(
      (el) => el === document.activeElement,
      before,
    );
    if (!same) return;
  }
}

test.describe("tastiera", () => {
  test("nessun tabindex positivo; ordine del fuoco nella pagina", async ({
    page,
  }, testInfo) => {
    await open(page);
    expect(
      await page.evaluate(
        () =>
          Array.from(document.querySelectorAll("[tabindex]")).filter(
            (el) => Number(el.getAttribute("tabindex")) > 0,
          ).length,
      ),
    ).toBe(0);

    const seen: string[] = [];
    for (let i = 0; i < 24; i++) {
      await nextStop(page);
      seen.push(await whereIsFocus(page));
    }
    const mobile = isMobile(testInfo.project.name);
    const expected = mobile
      ? ["Modifica", "Modifica", "Indicazioni"]
      : ["← Torna al calendario", "Indicazioni", "Modifica"];
    let from = 0;
    for (const part of expected) {
      const at = seen.findIndex((s, i) => i >= from && s.startsWith(part));
      expect(at, `${part} in ${JSON.stringify(seen)}`).toBeGreaterThanOrEqual(
        0,
      );
      from = at + 1;
    }
  });

  test("ordine del fuoco nel modulo, anello visibile, nessuna trappola", async ({
    page,
  }, testInfo) => {
    // Marco's own event: he is the author, so «Chi lo vede» is active.
    await open(page, { row: CENA }, "2026-10-23");
    await openForm(page);
    const mobile = isMobile(testInfo.project.name);
    const expected = [
      "Titolo",
      "Giorno",
      "Dalle",
      "Alle",
      "Si ripete",
      "Dove",
      "gruppo:Chi",
      "gruppo:La porta",
      "gruppo:Chi lo vede",
      "Note",
      ...(mobile
        ? ["Salva le modifiche", "Elimina impegno"]
        : ["Elimina impegno", "Salva le modifiche"]),
      "Chiudi",
      "Titolo",
    ];
    const seen = [await whereIsFocus(page)];
    const rings: { where: string; ring: string }[] = [];
    for (let i = 0; i < 40 && seen.length < expected.length + 12; i++) {
      await nextStop(page);
      const where = await whereIsFocus(page);
      if (where !== seen[seen.length - 1]) seen.push(where);
      // Always inside the form (the focus is trapped).
      expect(
        await page.evaluate(
          () => document.activeElement?.closest('[role="dialog"]') !== null,
        ),
      ).toBe(true);
      rings.push({ where, ring: await focusRing(page) });
      if (seen.length === expected.length) break;
    }
    expect(seen).toEqual(expected);
    for (const { where, ring } of rings) {
      expect(ring, `anello su ${where}`).not.toBe("nessuno");
    }
  });

  test("anello di fuoco della pagina", async ({ page }, testInfo) => {
    await open(page);
    const target = isMobile(testInfo.project.name)
      ? main(page).getByRole("link", { name: /^Indicazioni/ })
      : main(page).getByRole("link", { name: /Torna al calendario/ });
    await target.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(target).toBeFocused();
    expect(await focusRing(page)).toBe("contorno");
  });

  test("dialogo di salvataggio: il fuoco parte da Annulla, ordine e trappola", async ({
    page,
  }) => {
    await open(page);
    await openChoiceDialog(page);
    const dialog = page.getByRole("alertdialog");
    await expect(dialog.getByRole("button", { name: "Annulla" })).toBeFocused();
    // From «Annulla» the order wraps to the first button.
    const seen: string[] = [];
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab");
      expect(
        await page.evaluate(
          () =>
            document.activeElement?.closest('[role="alertdialog"]') !== null,
        ),
      ).toBe(true);
      seen.push(await whereIsFocus(page));
    }
    expect(seen.slice(0, 3)).toEqual([
      "Salva tutti i prossimi",
      "Salva solo questo",
      "Annulla",
    ]);
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Shift+Tab");
      expect(
        await page.evaluate(
          () =>
            document.activeElement?.closest('[role="alertdialog"]') !== null,
        ),
      ).toBe(true);
    }
    expect(await focusRing(page)).not.toBe("nessuno");
  });

  test("dialogo con una sola scelta: ordine del fuoco", async ({ page }) => {
    await open(page);
    await openAllDialog(page);
    const dialog = page.getByRole("alertdialog");
    await expect(dialog.getByRole("button", { name: "Annulla" })).toBeFocused();
    await page.keyboard.press("Tab");
    expect(await whereIsFocus(page)).toBe("Salva tutti i prossimi");
    await page.keyboard.press("Tab");
    expect(await whereIsFocus(page)).toBe("Annulla");
  });

  test("Esc chiude solo il dialogo e il fuoco torna a «Salva le modifiche»", async ({
    page,
  }) => {
    await open(page);
    await openChoiceDialog(page);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(
      page.getByRole("dialog", { name: "Modifica impegno" }),
    ).toBeVisible();
    await expect(page.getByLabel("Titolo")).toHaveValue("Nuoto");
    await expect(saveButton(page)).toBeFocused();
  });

  test("«Annulla» chiude solo il dialogo di eliminazione e il fuoco torna a «Elimina impegno»", async ({
    page,
  }) => {
    await open(page);
    await openForm(page);
    await page.getByRole("button", { name: "Elimina impegno" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog.getByRole("button", { name: "Annulla" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByRole("dialog", { name: "Modifica impegno" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Elimina impegno" }),
    ).toBeFocused();
  });

  test("Esc chiude il modulo e il fuoco torna a «Modifica»", async ({
    page,
  }) => {
    await open(page);
    await openForm(page);
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("dialog", { name: "Modifica impegno" }),
    ).toHaveCount(0);
    await expect(
      main(page).getByRole("button", { name: "Modifica" }),
    ).toBeFocused();
  });

  test("scritta con la tastiera: Invio nel titolo salva", async ({ page }) => {
    await open(page, { row: CENA }, "2026-10-23");
    await openForm(page);
    await page.getByLabel("Titolo").fill("Cena da Marta e Luca");
    await page.keyboard.press("Enter");
    // Does not repeat: it saves straight away, no dialog.
    await expect(
      page.getByRole("dialog", { name: "Modifica impegno" }),
    ).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Cena da Marta e Luca",
    );
  });
});

/** How the focused element shows the focus: outline, inset ring of a field, or none. */
async function focusRing(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return "nessuno";
    const own = getComputedStyle(el);
    if (own.outlineStyle !== "none" && parseFloat(own.outlineWidth) > 0) {
      return "contorno";
    }
    // Fields have no outline: an inner ring at :focus, as in the mockup.
    if (/inset/.test(own.boxShadow) && /1\.5px/.test(own.boxShadow)) {
      return "interno";
    }
    // The ring of a field can sit on its box (the select inside .campo__select-box).
    const box = el.closest(".campo__select-box, .campo__input");
    if (box) {
      const s = getComputedStyle(box);
      if (/inset/.test(s.boxShadow) && /1\.5px/.test(s.boxShadow)) {
        return "interno";
      }
      if (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) {
        return "contorno";
      }
    }
    return "nessuno";
  });
}

// --- touch areas -----------------------------------------------------------------

/**
 * True when the 44 x 44 px square around the centre of the control hits the
 * control (or something inside it): the touch area is the whole square.
 */
async function hasTouchArea(target: Locator, size = 44) {
  await target.evaluate((el) =>
    el.scrollIntoView({ block: "center", inline: "nearest" }),
  );
  return target.evaluate((el, s) => {
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const half = s / 2 - 1;
    const points = [
      [cx - half, cy - half],
      [cx + half, cy - half],
      [cx - half, cy + half],
      [cx + half, cy + half],
      [cx, cy],
    ];
    return points.every(([x, y]) => {
      const hit = document.elementFromPoint(x!, y!);
      return hit !== null && (hit === el || el.contains(hit));
    });
  }, size);
}

test.describe("aree di tocco di almeno 44 px (mobile)", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(!isMobile(testInfo.project.name), "area di tocco: solo mobile");
  });

  test("scheda", async ({ page }) => {
    await open(page);
    for (const control of [
      page.getByRole("link", { name: "Indietro" }),
      page.getByRole("button", { name: "Modifica" }).first(),
      main(page).getByRole("button", { name: "Modifica" }),
      main(page).getByRole("link", { name: /^Indicazioni/ }),
    ]) {
      expect(await hasTouchArea(control), await control.innerText()).toBe(true);
    }
  });

  test("modulo", async ({ page }) => {
    await open(page);
    await openForm(page);
    const form = page.getByRole("dialog", { name: "Modifica impegno" });
    const controls: Locator[] = [
      form.getByRole("button", { name: "Chiudi" }),
      form.getByLabel("Titolo"),
      form.getByLabel("Giorno"),
      form.getByLabel("Dalle", { exact: true }),
      form.getByLabel("Alle", { exact: true }),
      form.getByLabel("Si ripete"),
      form.getByLabel("Dove"),
      form.getByLabel("Note"),
      saveButton(page),
      form.getByRole("button", { name: "Elimina impegno" }),
    ];
    for (const group of ["Chi", "La porta", "Chi lo vede"]) {
      const buttons = await form
        .getByRole("group", { name: group, exact: true })
        .getByRole("button")
        .all();
      expect(buttons.length, group).toBeGreaterThan(1);
      controls.push(...buttons);
    }
    for (const control of controls) {
      const name =
        (await control.getAttribute("aria-label")) ??
        (await control.innerText().catch(() => "")) ??
        "";
      expect(await hasTouchArea(control), `area di tocco: ${name}`).toBe(true);
    }
  });

  test("dialoghi", async ({ page }) => {
    await open(page);
    await openChoiceDialog(page);
    for (const button of await page
      .getByRole("alertdialog")
      .getByRole("button")
      .all()) {
      expect(await hasTouchArea(button), await button.innerText()).toBe(true);
    }
  });

  test("«Non c'è più»", async ({ page }) => {
    await open(page, { reads: "missing" });
    const link = page.getByRole("link", { name: "Vai al calendario" });
    expect(await hasTouchArea(link)).toBe(true);
  });

  test("errore di lettura", async ({ page }) => {
    await open(page, { reads: "error" });
    expect(
      await hasTouchArea(page.getByRole("button", { name: "Riprova" })),
    ).toBe(true);
    expect(
      await hasTouchArea(page.getByRole("link", { name: "Torna a Oggi" })),
    ).toBe(true);
  });
});

// --- contrast ---------------------------------------------------------------------

type Pair = { what: string; ratio: number; min: number };

/**
 * Contrast of the text of the elements that match `selector` (colour of the
 * text over the first solid background above it). Elements at reduced
 * opacity (disabled) are left out: they are exempt.
 */
async function contrastOf(
  page: Page,
  selector: string,
  min = 4.5,
): Promise<Pair[]> {
  return page.evaluate(
    ({ selector, min }) => {
      const parse = (css: string) => {
        const m = /rgba?\(([^)]+)\)/.exec(css);
        if (!m) return null;
        const [r, g, b, a] = m[1]!.split(",").map((v) => parseFloat(v));
        return { r: r!, g: g!, b: b!, a: a ?? 1 };
      };
      const channel = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      const lum = (c: { r: number; g: number; b: number }) =>
        0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
      const backgroundOf = (el: Element) => {
        let node: Element | null = el;
        while (node) {
          const c = parse(getComputedStyle(node).backgroundColor);
          if (c && c.a > 0.99) return c;
          node = node.parentElement;
        }
        return { r: 255, g: 255, b: 255, a: 1 };
      };
      return Array.from(document.querySelectorAll(selector))
        .filter((el) => {
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) return false;
          for (let n: Element | null = el; n; n = n.parentElement) {
            if (Number(getComputedStyle(n).opacity) < 1) return false;
          }
          return (el.textContent ?? "").trim() !== "";
        })
        .map((el) => {
          const fg = parse(getComputedStyle(el).color)!;
          const bg = backgroundOf(el);
          const l1 = lum(fg);
          const l2 = lum(bg);
          const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
          return {
            what: `${selector}: «${(el.textContent ?? "").trim().slice(0, 40)}» ${getComputedStyle(el).color} su ${getComputedStyle(el).backgroundColor === "rgba(0, 0, 0, 0)" ? "(fondo del contenitore)" : getComputedStyle(el).backgroundColor}`,
            ratio: Math.round(ratio * 100) / 100,
            min,
          };
        });
    },
    { selector, min },
  );
}

function expectContrast(pairs: Pair[]) {
  expect(pairs.length).toBeGreaterThan(0);
  for (const p of pairs) expect(p.ratio, p.what).toBeGreaterThanOrEqual(p.min);
}

test.describe("contrasti", () => {
  test("scheda", async ({ page }) => {
    await open(page);
    const pairs: Pair[] = [];
    for (const selector of [
      ".intestazione__sopra",
      ".prossimo__ora",
      ".prossimo__titolo",
      ".riga-lista__titolo",
      ".riga-lista__info",
      ".tabella-dati dt",
      ".tabella-dati dd",
      "main .btn-primary",
      "main .btn-secondary",
      "main .btn-link",
    ]) {
      pairs.push(...(await contrastOf(page, selector)));
    }
    expectContrast(pairs);
  });

  test("modulo e dialogo di salvataggio", async ({ page }) => {
    await open(page);
    await openForm(page);
    const pairs: Pair[] = [];
    for (const selector of [
      ".foglio__titolo, .modale__titolo",
      ".campo__etichetta",
      ".campo__input",
      ".chip",
      ".selettore__voce",
      ".campo__aiuto",
      ".btn-primary",
      ".btn-pericolo",
    ]) {
      pairs.push(...(await contrastOf(page, selector)));
    }
    expectContrast(pairs);

    await page.getByLabel("Titolo").fill("");
    await saveButton(page).click();
    expectContrast(await contrastOf(page, ".campo__errore"));

    await page.getByLabel("Titolo").fill("Nuoto");
    await saveButton(page).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    const dialogPairs: Pair[] = [];
    for (const selector of [
      ".dialogo__titolo",
      ".dialogo__testo",
      ".dialogo .btn-primary",
      ".dialogo .btn-secondary",
    ]) {
      dialogPairs.push(...(await contrastOf(page, selector)));
    }
    expectContrast(dialogPairs);
  });

  test("dialogo di eliminazione e errore nel dialogo", async ({ page }) => {
    const fake = await open(page);
    await openForm(page);
    await page.getByRole("button", { name: "Elimina impegno" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    const pairs: Pair[] = [];
    for (const selector of [
      ".dialogo__titolo",
      ".dialogo__testo",
      ".dialogo .btn-pericolo-pieno",
      ".dialogo .btn-secondary",
    ]) {
      pairs.push(...(await contrastOf(page, selector)));
    }
    fake.failWrites("network");
    await dialog.getByRole("button", { name: "Elimina solo questo" }).click();
    await expect(dialog.getByRole("alert")).toBeVisible();
    pairs.push(...(await contrastOf(page, ".dialogo .avviso")));
    expectContrast(pairs);
  });

  test("«Non c'è più» e lettura non riuscita", async ({ page }) => {
    await open(page, { reads: "missing" });
    expectContrast([
      ...(await contrastOf(page, ".errore-pagina__titolo")),
      ...(await contrastOf(page, ".errore-pagina__testo")),
      ...(await contrastOf(page, ".errore-pagina .btn-secondary")),
    ]);
  });
});
