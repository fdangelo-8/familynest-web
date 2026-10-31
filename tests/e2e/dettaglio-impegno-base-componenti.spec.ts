import { randomUUID } from "node:crypto";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { eventHref, getEventOccurrence } from "../../src/lib/household-events";
import { skipReason, usersConfigured } from "../fixtures/auth";
import { mountComponents } from "../fixtures/component-harness";
import { apiAs } from "../fixtures/spesa";

// Shared base of Dettaglio impegno (#165, PR #170) in a real browser: async
// ConfirmDialog, aboveSheet, BarAction, PageError with `action`, and the
// reading of an occurrence against the real database. The pure rules are in
// dettaglio-impegno-base.spec.ts. No page uses these pieces yet, so the
// browser tests mount them with tests/fixtures/component-harness.ts.

const FIRST = "Elimina tutti i prossimi";
const SECOND = "Elimina solo questo";

function dialogOf(page: Page) {
  return page.getByRole("alertdialog", { name: "Eliminare «Nuoto Sofia»?" });
}

function buttonsOf(dialog: Locator) {
  return {
    first: dialog.getByRole("button", { name: FIRST }),
    second: dialog.getByRole("button", { name: SECOND }),
    cancel: dialog.getByRole("button", { name: "Annulla" }),
  };
}

async function openDialog(page: Page) {
  await mountComponents(page, "dialogo");
  await page.getByRole("button", { name: "Apri dialogo" }).click();
  const dialog = dialogOf(page);
  await expect(dialog).toBeVisible();
  return { dialog, ...buttonsOf(dialog) };
}

/** The look that must not change when a button becomes inactive. */
async function lookOf(button: Locator) {
  return button.evaluate((node) => {
    const style = getComputedStyle(node);
    return {
      opacity: style.opacity,
      backgroundColor: style.backgroundColor,
      color: style.color,
      borderColor: style.borderColor,
    };
  });
}

const settle = (page: Page, how: "ok" | "false" | "reject") =>
  page.evaluate((mode) => {
    if (mode === "reject") window.__ctl.reject();
    else window.__ctl.resolve(mode === "false" ? false : undefined);
  }, how);

const calls = (page: Page) => page.evaluate(() => window.__ctl.calls);

test.describe("ConfirmDialog asincrono (#165)", () => {
  test("CA-55 (#19): mentre un'azione lavora, quel bottone è in caricamento e gli altri sono aria-disabled", async ({
    page,
  }) => {
    const { second, first, cancel } = await openDialog(page);
    await expect(first).not.toHaveAttribute("aria-disabled", "true");
    await expect(cancel).not.toHaveAttribute("aria-disabled", "true");

    await second.click();

    await expect(second).toHaveClass(/is-caricamento/);
    await expect(second).toHaveAttribute("aria-busy", "true");
    await expect(first).toHaveAttribute("aria-disabled", "true");
    await expect(cancel).toHaveAttribute("aria-disabled", "true");
    // Inactive but still reachable by keyboard and announced
    await first.focus();
    await expect(first).toBeFocused();
    await expect(first).not.toHaveClass(/is-caricamento/);
  });

  test("CA-55 (#19): i bottoni inattivi hanno lo stesso aspetto di prima, anche al passaggio del mouse", async ({
    page,
  }) => {
    const { second, first, cancel } = await openDialog(page);
    const before = { first: await lookOf(first), cancel: await lookOf(cancel) };

    await second.click();
    await expect(first).toHaveAttribute("aria-disabled", "true");

    expect(await lookOf(first)).toEqual(before.first);
    expect(await lookOf(cancel)).toEqual(before.cancel);
    await first.hover();
    expect(await lookOf(first)).toEqual(before.first);
    await cancel.hover();
    expect(await lookOf(cancel)).toEqual(before.cancel);
    // The loading one does not look disabled either
    expect((await lookOf(second)).opacity).toBe("1");
  });

  test("un clic su un bottone inattivo non fa niente", async ({ page }) => {
    const { second, first, cancel } = await openDialog(page);
    await second.click();
    await expect(first).toHaveAttribute("aria-disabled", "true");

    // aria-disabled buttons are "not enabled" for Playwright: force the tap
    await first.click({ force: true });
    await second.click({ force: true });
    await cancel.click({ force: true });

    expect(await calls(page)).toEqual([SECOND]);
    await expect(dialogOf(page)).toBeVisible();
    await expect(page.getByTestId("chiusure")).toHaveText("Chiusure: 0");
  });

  test("Esc e il velo non chiudono il dialogo mentre un'azione lavora", async ({
    page,
  }) => {
    const { dialog, second } = await openDialog(page);
    await second.click();
    await expect(second).toHaveClass(/is-caricamento/);

    await page.keyboard.press("Escape");
    await page.getByTestId("velo").click({ position: { x: 4, y: 4 } });

    await expect(dialog).toBeVisible();
    await expect(page.getByTestId("chiusure")).toHaveText("Chiusure: 0");

    // When the action is done, the dialog closes
    await settle(page, "ok");
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId("chiusure")).toHaveText("Chiusure: 1");
  });

  test("senza un'azione in corso Esc, il velo e «Annulla» chiudono come prima", async ({
    page,
  }) => {
    const { dialog } = await openDialog(page);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    await page.getByRole("button", { name: "Apri dialogo" }).click();
    await expect(dialog).toBeVisible();
    await page.getByTestId("velo").click({ position: { x: 4, y: 4 } });
    await expect(dialog).toBeHidden();

    await page.getByRole("button", { name: "Apri dialogo" }).click();
    await dialog.getByRole("button", { name: "Annulla" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId("chiusure")).toHaveText("Chiusure: 3");
    expect(await calls(page)).toEqual([]);
  });

  for (const how of ["false", "reject"] as const) {
    test(`in caso di errore (${how === "false" ? "risposta false" : "promessa rifiutata"}) il dialogo resta aperto con l'avviso`, async ({
      page,
    }) => {
      const { dialog, first, second, cancel } = await openDialog(page);
      await expect(dialog.getByRole("alert")).toHaveCount(0);

      await second.click();
      await expect(second).toHaveClass(/is-caricamento/);
      await settle(page, how);

      await expect(dialog.getByRole("alert")).toHaveText(
        "Non siamo riusciti a eliminare l'impegno. Riprova.",
      );
      await expect(dialog).toBeVisible();
      await expect(page.getByTestId("chiusure")).toHaveText("Chiusure: 0");
      // All the buttons are usable again
      for (const button of [first, second, cancel]) {
        await expect(button).not.toHaveAttribute("aria-disabled", "true");
      }
      await expect(second).not.toHaveClass(/is-caricamento/);

      // The alert goes away at the next attempt, which can succeed
      await second.click();
      await expect(dialog.getByRole("alert")).toHaveCount(0);
      await settle(page, "ok");
      await expect(dialog).toBeHidden();
      expect(await calls(page)).toEqual([SECOND, SECOND]);
    });
  }

  test("dopo un errore Esc chiude il dialogo", async ({ page }) => {
    const { dialog, first } = await openDialog(page);
    await first.click();
    await settle(page, "false");
    await expect(dialog.getByRole("alert")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId("chiusure")).toHaveText("Chiusure: 1");
  });
});

test.describe("ConfirmDialog sopra un foglio (#165)", () => {
  test("aboveSheet: il velo del dialogo sta sopra il foglio e Esc chiude solo il dialogo", async ({
    page,
  }) => {
    await page.goto("/design-system");
    await page.getByTestId("foglio-apri").click();
    const sheet = page.getByRole("dialog", { name: "Aggiungi" });
    await expect(sheet).toBeVisible();

    await page.getByTestId("foglio-elimina").click();
    const dialog = page.getByTestId("dialogo-annidato");
    await expect(dialog).toBeVisible();

    const veils = page.getByTestId("velo");
    await expect(veils).toHaveCount(2);
    await expect(veils.last()).toHaveClass(/velo--sopra-foglio/);
    await expect(veils.first()).not.toHaveClass(/velo--sopra-foglio/);

    // A point on the page, outside both the sheet and the dialog, belongs to
    // the veil of the dialog: it is above the sheet.
    const topAtCorner = await page.evaluate(() => {
      const veilsOnPage = document.querySelectorAll('[data-testid="velo"]');
      const top = document.elementFromPoint(4, 4);
      return top === veilsOnPage[veilsOnPage.length - 1];
    });
    expect(topAtCorner).toBe(true);
    // The dialog itself is above its veil
    const dialogOnTop = await dialog.evaluate((node) => {
      const box = node.getBoundingClientRect();
      const top = document.elementFromPoint(
        box.left + box.width / 2,
        box.top + box.height / 2,
      );
      return node.contains(top);
    });
    expect(dialogOnTop).toBe(true);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(sheet).toBeVisible();
    await expect(veils).toHaveCount(1);
  });

  test("aboveSheet: l'azione del dialogo funziona e il foglio resta aperto", async ({
    page,
  }) => {
    await page.goto("/design-system");
    await page.getByTestId("foglio-apri").click();
    const sheet = page.getByRole("dialog", { name: "Aggiungi" });
    await page.getByTestId("foglio-elimina").click();
    const dialog = page.getByTestId("dialogo-annidato");
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: "Elimina impegno" }).click();

    await expect(dialog).toBeHidden();
    await expect(sheet).toBeVisible();
    await expect(page.getByTestId("foglio-eliminati")).toHaveText(
      "Eliminati: 1",
    );
  });

  test("senza aboveSheet il velo non ha la classe", async ({ page }) => {
    await page.goto("/design-system");
    await page.getByTestId("dialogo-apri").click();
    await expect(page.getByTestId("dialogo-aperto")).toBeVisible();
    await expect(page.getByTestId("velo")).not.toHaveClass(
      /velo--sopra-foglio/,
    );
  });
});

test.describe("regressione: dialogo sincrono della galleria (MemberView e galleria)", () => {
  test("un'azione sincrona chiude subito, nessun bottone è inattivo", async ({
    page,
  }) => {
    await page.goto("/design-system");
    await page.getByTestId("dialogo-apri").click();
    const dialog = page.getByTestId("dialogo-aperto");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('[aria-disabled="true"]')).toHaveCount(0);
    await expect(dialog.locator('[aria-busy="true"]')).toHaveCount(0);
    await expect(dialog.getByRole("alert")).toHaveCount(0);

    await dialog.getByRole("button", { name: SECOND }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByTestId("dialogo-conteggio")).toHaveText(
      "Eliminazioni: 1",
    );
  });

  test("Esc e «Annulla» chiudono senza eseguire l'azione", async ({ page }) => {
    await page.goto("/design-system");
    const dialog = page.getByTestId("dialogo-aperto");
    await page.getByTestId("dialogo-apri").click();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    await page.getByTestId("dialogo-apri").click();
    await dialog.getByRole("button", { name: "Annulla" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId("dialogo-conteggio")).toHaveText(
      "Eliminazioni: 0",
    );
  });

  test("gli esempi di PageError con «Riprova» e uscita non cambiano", async ({
    page,
  }) => {
    await page.goto("/design-system");
    const error = page.getByTestId("errore-pagina-con-uscita");
    await expect(
      error.getByRole("link", { name: "Torna a Oggi" }),
    ).toHaveAttribute("href", "/oggi");
    await error.getByRole("button", { name: "Riprova" }).click();
    await expect(
      page.getByTestId("errore-pagina-con-uscita-conteggio"),
    ).toHaveText("Riprova: 1");
  });
});

test.describe("BarAction nella barra mobile (#165)", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name === "desktop",
      "La barra superiore esiste solo sotto 1024 px",
    );
  });

  const barButton = (page: Page) =>
    page.getByTestId("barra-prova").getByRole("button", { name: "Modifica" });

  test("la pagina mette «Modifica» a destra nella barra e il tocco la raggiunge", async ({
    page,
  }) => {
    await mountComponents(page, "barra");
    const button = barButton(page);
    await expect(button).toBeVisible();
    await expect(button).not.toHaveAttribute("aria-disabled", "true");

    const bar = await page.getByTestId("barra-prova").boundingBox();
    const box = await button.boundingBox();
    expect(bar && box && box.x + box.width > bar.x + bar.width / 2).toBe(true);

    await button.click();
    await button.click();
    await expect(page.getByTestId("pressioni")).toHaveText("Pressioni: 2");
  });

  test("inattiva: resta visibile, aria-disabled, stesso aspetto, il tocco non fa niente", async ({
    page,
  }) => {
    await mountComponents(page, "barra");
    const button = barButton(page);
    await expect(button).toBeVisible();
    const active = await lookOf(button);
    const activeBox = await button.boundingBox();

    await page.getByRole("button", { name: "Cambia stato" }).click();

    await expect(button).toHaveAttribute("aria-disabled", "true");
    await expect(button).toBeVisible();
    expect(await lookOf(button)).toEqual(active);
    expect(await button.boundingBox()).toEqual(activeBox);
    // Still focusable, so it is announced
    await button.focus();
    await expect(button).toBeFocused();
    await button.click({ force: true });
    await expect(page.getByTestId("pressioni")).toHaveText("Pressioni: 0");

    // Active again: it works
    await page.getByRole("button", { name: "Cambia stato" }).click();
    await expect(button).not.toHaveAttribute("aria-disabled", "true");
    await button.click();
    await expect(page.getByTestId("pressioni")).toHaveText("Pressioni: 1");
  });

  test("senza l'azione (stato «Non c'è più», errore) non c'è il bottone e la barra non salta", async ({
    page,
  }) => {
    await mountComponents(page, "barra");
    const button = barButton(page);
    await expect(button).toBeVisible();
    const withButton = await page.getByTestId("barra-prova").boundingBox();

    await page.getByRole("button", { name: "Mostra o nascondi" }).click();

    await expect(button).toHaveCount(0);
    await expect(
      page.getByTestId("barra-prova").getByRole("button"),
    ).toHaveCount(0);
    expect(await page.getByTestId("barra-prova").boundingBox()).toEqual(
      withButton,
    );

    // Shown again: the button comes back
    await page.getByRole("button", { name: "Mostra o nascondi" }).click();
    await expect(button).toBeVisible();
  });
});

test.describe("PageError con action (#165)", () => {
  test("al posto di «Riprova» c'è il link, con la sua etichetta e la sua destinazione", async ({
    page,
  }) => {
    await mountComponents(page, "errore-pagina");
    const error = page.getByTestId("errore-azione");
    await expect(
      error.getByRole("heading", { name: "Questo impegno non c'è più" }),
    ).toBeVisible();
    const link = error.getByRole("link", { name: "Vai al calendario" });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "#calendario");
    await expect(link).toHaveClass(/btn-secondary/);
    await expect(link.locator("svg use")).toHaveAttribute(
      "href",
      "#i-calendar",
    );
    await expect(error.getByRole("button")).toHaveCount(0);
    await expect(error.getByText("Riprova")).toHaveCount(0);
  });

  test("l'icona predefinita dell'azione è quella di «Riprova»", async ({
    page,
  }) => {
    await mountComponents(page, "errore-pagina");
    // The second error has no `action`: «Riprova» keeps working
    const retry = page
      .getByTestId("errore-riprova")
      .getByRole("button", { name: "Riprova" });
    await expect(retry).toBeVisible();
    await expect(retry.locator("svg use")).toHaveAttribute(
      "href",
      "#i-rotate-cw",
    );
    await retry.click();
    await expect(page.getByTestId("riprova-conteggio")).toHaveText(
      "Riprova: 1",
    );
    await expect(
      page.getByTestId("errore-riprova").getByRole("link"),
    ).toHaveCount(0);
  });

  test("il link si usa da tastiera", async ({ page }) => {
    await mountComponents(page, "errore-pagina");
    const link = page
      .getByTestId("errore-azione")
      .getByRole("link", { name: "Vai al calendario" });
    await link.focus();
    await expect(link).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#calendario$/);
  });
});

test.describe("eventHref e getEventOccurrence con id strani (#165)", () => {
  const UUID = "3f1d2c4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f";

  test("eventHref: l'id è codificato e nell'indirizzo c'è solo il giorno", () => {
    const href = eventHref("a/b?c#d", "2026-10-20T15:00:00Z");
    expect(href).toBe("/impegni/a%2Fb%3Fc%23d?giorno=2026-10-20");
    expect(new URL(href, "http://x").searchParams.keys().next().value).toBe(
      "giorno",
    );
  });

  test("id non valido: nessuna chiamata di rete e risultato «non trovato»", async () => {
    for (const bad of [
      "",
      " ",
      "undefined",
      "1",
      `${UUID}x`,
      "../etc",
      UUID.toUpperCase().slice(1),
    ]) {
      const calls: unknown[] = [];
      const client = {
        rpc: async (...args: unknown[]) => {
          calls.push(args);
          return { data: [], error: null };
        },
      } as never;
      expect(await getEventOccurrence(bad, "2026-10-20", client)).toEqual({
        ok: true,
        occurrence: null,
      });
      expect(calls).toHaveLength(0);
    }
  });
});

test.describe("getEventOccurrence contro il database vero (#165)", () => {
  test.beforeEach(() => {
    test.skip(!usersConfigured("A", "B"), skipReason("A", "B"));
  });

  test("un impegno di un altro Nest risulta «non trovato», senza errore", async () => {
    const a = await apiAs("A");
    const b = await apiAs("B");
    const tag = `Prova165 ${randomUUID().slice(0, 8)}`;
    // 2027-03-02 is a Tuesday: the weekly event repeats on Tuesdays
    const { error } = await a.from("events").insert({
      title: tag,
      starts_at: "2027-03-02T17:00:00+01:00",
      ends_at: "2027-03-02T18:00:00+01:00",
      visibility: "household",
      recurrence: "weekly",
      recurrence_weekdays: [2],
    });
    if (error) throw new Error("Creazione impegno di prova fallita");
    try {
      const { data } = await a.from("events").select("id").eq("title", tag);
      const id = data?.[0]?.id;
      if (!id) throw new Error("Impegno di prova non trovato");

      // The author's Nest reads it, on a repetition too
      const own = await getEventOccurrence(id, "2027-03-09", a);
      expect(own.ok && own.occurrence?.title).toBe(tag);
      expect(own.ok && own.occurrence?.occurrenceDate).toBe("2027-03-09");
      // A day without the event: not found, not an error
      expect(await getEventOccurrence(id, "2027-03-10", a)).toEqual({
        ok: true,
        occurrence: null,
      });
      // Another Nest: the same answer as for an id that does not exist
      for (const day of ["2027-03-02", "2027-03-09", undefined]) {
        expect(await getEventOccurrence(id, day, b)).toEqual({
          ok: true,
          occurrence: null,
        });
      }
      expect(await getEventOccurrence(randomUUID(), "2027-03-09", a)).toEqual({
        ok: true,
        occurrence: null,
      });
    } finally {
      await a.from("events").delete().eq("title", tag);
    }
  });
});
