import { expect, test, type Page } from "@playwright/test";
import { signInAs, skipReason, usersConfigured } from "../fixtures/auth";

// Add · Impegni, phase 1 (#20): the main flow in the browser. Needs test user A
// (skipped, with a reason, while it is not available). The reading of the
// phrase itself is covered without a browser in aggiungi-impegni-frase.spec.ts.
//
// The test uses a far day with a year («3/11/2030», a Sunday) so it does not
// depend on today's date, and removes what it creates with «Annulla».

const PHRASE = "Prova Aggiungi 3/11/2030 alle 17";

function dialogOf(page: Page) {
  return page.getByRole("dialog", { name: "Aggiungi" });
}

/** Opens Add over Today. Retries until the click is handled by the hydrated page. */
async function openAdd(page: Page) {
  await page.goto("/oggi");
  await expect(page.getByRole("main")).toBeVisible();
  await expect(async () => {
    await page.getByRole("link", { name: "Aggiungi", exact: true }).click();
    await expect(dialogOf(page)).toBeVisible({ timeout: 2000 });
  }).toPass();
}

test.describe("Aggiungi · Impegni", () => {
  test.beforeEach(() => {
    test.skip(!usersConfigured("A"), skipReason("A"));
  });

  test("CA-3: all'apertura il campo ha il fuoco e l'invio è spento", async ({
    page,
    baseURL,
  }) => {
    await signInAs(page.context(), baseURL as string, "A");
    await openAdd(page);
    const dialog = dialogOf(page);
    await expect(
      dialog.getByRole("textbox", { name: "Cosa vuoi aggiungere?" }),
    ).toBeFocused();
    const type = dialog.getByRole("group", { name: "Tipo" });
    // Since #22 the selector has the four types; Impegno is the one chosen.
    await expect(type.getByRole("button")).toHaveText([
      "Impegno",
      "Da fare",
      "Spesa",
      "Scadenza",
    ]);
    await expect(type.getByRole("button", { name: "Impegno" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    for (const other of ["Da fare", "Spesa", "Scadenza"]) {
      await expect(type.getByRole("button", { name: other })).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    }
    await expect(
      dialog.getByRole("button", { name: "Aggiungi" }),
    ).toBeDisabled();
    await expect(
      dialog.getByRole("button", { name: "Detta a voce" }),
    ).toHaveCount(0);
  });

  test("CA-12, CA-18, CA-36: scrive, salva, vede il toast e annulla", async ({
    page,
    baseURL,
  }) => {
    await signInAs(page.context(), baseURL as string, "A");
    const requests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/rest/v1/")) {
        requests.push(`${request.url()} ${request.postData() ?? ""}`);
      }
    });
    await openAdd(page);
    const dialog = dialogOf(page);
    const field = dialog.getByRole("textbox", {
      name: "Cosa vuoi aggiungere?",
    });
    await field.pressSequentially(PHRASE);

    const labels = dialog.locator('[aria-live="polite"]');
    await expect(labels).toContainText("Domenica 3 novembre 2030");
    await expect(labels).toContainText("17:00");
    const submit = dialog.getByRole("button", {
      name: "Metti in domenica 3 novembre 2030",
    });
    await expect(submit).toBeEnabled();

    // While writing, the phrase never travels in any request.
    expect(requests.filter((r) => /Prova|Aggiungi/.test(r))).toEqual([]);

    const saved = page.waitForRequest((r) =>
      r.url().includes("/rpc/create_event"),
    );
    await submit.click();
    expect((await saved).postData()).toContain("Prova Aggiungi");

    await expect(dialog).toHaveCount(0);
    const toast = page.getByRole("status").filter({ hasText: "Messo in" });
    await expect(toast).toContainText(
      "Messo in domenica 3 novembre 2030: Prova Aggiungi alle 17:00.",
    );
    await expect(toast.locator("b")).toHaveText("domenica 3 novembre 2030");
    await toast.getByRole("button", { name: "Annulla" }).click();
    await expect(toast).toHaveCount(0);
  });

  test("CA-22: senza titolo l'invio dà l'errore sotto il campo", async ({
    page,
    baseURL,
  }) => {
    await signInAs(page.context(), baseURL as string, "A");
    await openAdd(page);
    const dialog = dialogOf(page);
    const field = dialog.getByRole("textbox", {
      name: "Cosa vuoi aggiungere?",
    });
    await field.fill("giovedì");
    await field.press("Enter");
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await expect(field).toHaveAccessibleDescription(
      "Manca cosa c'è da fare: scrivi per esempio «dentista giovedì alle 16».",
    );
    await expect(field).toBeFocused();
    await field.press("a");
    await expect(field).not.toHaveAttribute("aria-invalid", "true");
  });

  test("CA-21: salvataggio che fallisce, il testo resta e l'avviso è nel foglio", async ({
    page,
    baseURL,
  }) => {
    await signInAs(page.context(), baseURL as string, "A");
    await openAdd(page);
    const dialog = dialogOf(page);
    await page.route("**/rest/v1/rpc/create_event", (route) =>
      route.fulfill({ status: 500, json: { message: "boom" } }),
    );
    const field = dialog.getByRole("textbox", {
      name: "Cosa vuoi aggiungere?",
    });
    await field.fill(PHRASE);
    await dialog
      .getByRole("button", { name: "Metti in domenica 3 novembre 2030" })
      .click();
    await expect(dialog.getByRole("alert")).toHaveText(
      "Non siamo riusciti a salvare l'impegno. Controlla la connessione e riprova.",
    );
    await expect(field).toHaveValue(PHRASE);
    await expect(page.getByTestId("toast")).toHaveCount(0);
  });
});
