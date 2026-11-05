import { expect, test, type Page } from "@playwright/test";
import { signInAs, skipReason, usersConfigured } from "../fixtures/auth";

// Aggiungi · Impegni, phase 2 (#171): from the phrase to the full form «Nuovo
// impegno», back, errors and saving. Needs test user A. A far day with a year
// («3/11/2030») keeps the test independent of today's date; what it creates is
// removed with «Annulla».

const PHRASE = "Prova Modulo 3/11/2030 alle 17";

function addOf(page: Page) {
  return page.getByRole("dialog", { name: "Aggiungi" });
}
function formOf(page: Page) {
  return page.getByRole("dialog", { name: "Nuovo impegno" });
}

async function openAdd(page: Page) {
  await page.goto("/oggi");
  await expect(page.getByRole("main")).toBeVisible();
  await expect(async () => {
    await page.getByRole("link", { name: "Aggiungi", exact: true }).click();
    await expect(addOf(page)).toBeVisible({ timeout: 2000 });
  }).toPass();
}

/** Writes the phrase and opens the form with the entry of the width. */
async function openForm(page: Page, phrase: string) {
  await openAdd(page);
  await page
    .getByRole("textbox", { name: "Cosa vuoi aggiungere?" })
    .pressSequentially(phrase);
  const desktop = (page.viewportSize()?.width ?? 0) >= 1024;
  const entry = addOf(page).getByRole("button", {
    name: desktop ? "Tutti i dettagli" : "Più dettagli",
  });
  await entry.click();
  await expect(formOf(page)).toBeVisible();
  return entry;
}

test.describe("Aggiungi · Impegni · modulo completo", () => {
  test.beforeEach(() => {
    test.skip(!usersConfigured("A"), skipReason("A"));
  });

  test("CA-3, CA-8: il modulo parte dalla frase e si salva con luogo e ripetizione", async ({
    page,
    baseURL,
  }) => {
    await signInAs(page.context(), baseURL as string, "A");
    await openForm(page, PHRASE);
    const form = formOf(page);
    expect(new URL(page.url()).pathname).toBe("/aggiungi");
    await expect(form.getByLabel("Titolo")).toHaveValue("Prova Modulo");
    await expect(form.getByLabel("Titolo")).toBeFocused();
    await expect(form.getByLabel("Giorno")).toHaveValue("2030-11-03");
    await expect(form.getByLabel("Dalle", { exact: true })).toHaveValue(
      "17:00",
    );
    await expect(form.getByLabel("Alle", { exact: true })).toHaveValue("18:00");
    await expect(form.getByLabel("Si ripete").locator("option")).toHaveText([
      "Mai",
      "Ogni settimana",
      "Ogni mese",
    ]);
    await expect(
      page.getByRole("textbox", { name: "Cosa vuoi aggiungere?" }),
    ).toHaveCount(0);

    await form.getByLabel("Dove").fill("Piscina comunale, Lissone");
    await form.getByLabel("Si ripete").selectOption("weekly");
    const saved = page.waitForRequest((r) =>
      r.url().includes("/rpc/create_event"),
    );
    await form
      .getByRole("button", { name: "Metti in domenica 3 novembre 2030" })
      .click();
    const body = (await saved).postDataJSON() as Record<string, unknown>;
    expect(body.p_location).toBe("Piscina comunale, Lissone");
    expect(body.p_recurrence).toBe("weekly");
    expect(body.p_recurrence_weekdays).toEqual([7]);

    await expect(form).toHaveCount(0);
    const toast = page.getByRole("status").filter({ hasText: "Messo in" });
    await expect(toast).toContainText(
      "Messo in domenica 3 novembre 2030: Prova Modulo alle 17:00.",
    );
    await toast.getByRole("button", { name: "Annulla" }).click();
    await expect(toast).toHaveCount(0);
  });

  test("CA-13: «Chiudi» riporta alla frase e il fuoco torna sull'ingresso", async ({
    page,
    baseURL,
  }) => {
    await signInAs(page.context(), baseURL as string, "A");
    const entry = await openForm(page, PHRASE);
    await formOf(page).getByLabel("Titolo").fill("Altro");
    await formOf(page).getByRole("button", { name: "Chiudi" }).click();
    await expect(addOf(page)).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "Cosa vuoi aggiungere?" }),
    ).toHaveValue(PHRASE);
    await expect(entry).toBeFocused();
    await entry.click();
    await expect(formOf(page).getByLabel("Titolo")).toHaveValue("Prova Modulo");
  });

  test("CA-17: gli errori arrivano all'invio, sotto i campi, e il fuoco va sul primo", async ({
    page,
    baseURL,
  }) => {
    await signInAs(page.context(), baseURL as string, "A");
    await openForm(page, "Prova Modulo 3/11/2030");
    const form = formOf(page);
    await form.getByLabel("Titolo").fill("");
    await form
      .getByRole("button", { name: "Metti in domenica 3 novembre 2030" })
      .click();
    const title = form.getByLabel("Titolo");
    await expect(title).toHaveAttribute("aria-invalid", "true");
    await expect(title).toHaveAccessibleDescription(
      "Scrivi il titolo dell'impegno.",
    );
    await expect(title).toBeFocused();
    await expect(form.getByText("Scegli l'ora d'inizio.")).toBeVisible();
    await expect(form.getByText("Scegli l'ora di fine.")).toBeVisible();
  });

  test("decisione 5: un titolo oltre 100 caratteri non si taglia e dà l'errore all'invio", async ({
    page,
    baseURL,
  }) => {
    await signInAs(page.context(), baseURL as string, "A");
    const long = "a".repeat(101);
    await openForm(page, `${long} 3/11/2030 alle 17`);
    const form = formOf(page);
    await expect(form.getByLabel("Titolo")).toHaveValue(
      long.charAt(0).toUpperCase() + long.slice(1),
    );
    await form
      .getByRole("button", { name: "Metti in domenica 3 novembre 2030" })
      .click();
    await expect(form.getByLabel("Titolo")).toHaveAccessibleDescription(
      "Il titolo può avere al massimo 100 caratteri.",
    );
  });
});
