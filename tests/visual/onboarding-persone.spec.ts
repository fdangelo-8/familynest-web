import { expect, test, type Page } from "@playwright/test";
import {
  throwawayConfigured,
  throwawaySkipReason,
} from "../fixtures/throwaway-user";
import {
  actionAnswer,
  FAMILY,
  isAction,
  MORE,
  openAddSheet,
  openEditSheet,
  openPeople,
  settle,
  userWithNest,
  type HouseholdType,
} from "./persone-helpers";

// Onboarding step 2 "Chi c'è nel Nest?" (#13): one screenshot per state, at
// 390 and 1280 px (the two projects). Each test has its own throwaway user
// with a Nest written with the administrative key; "Continua" never reaches
// the database and the save of the sheet is answered by the test when the
// state is an error. Skipped when the keys are not set.

const START = new Date("2026-10-29T10:00:00+01:00");

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

test.skip(!throwawayConfigured(), throwawaySkipReason);

/** Runs `body` with a user with a Nest and always deletes the user. */
async function withNest(
  type: HouseholdType,
  members: Parameters<typeof userWithNest>[1],
  page: Page,
  baseURL: string | undefined,
  body: () => Promise<void>,
) {
  const user = await userWithNest(type, members);
  try {
    await page.clock.install({ time: START });
    await openPeople(page, user, baseURL);
    await body();
  } finally {
    await user.remove();
  }
}

/** The sheet is fixed on the viewport: its shot is the viewport. */
const sheetShot = (page: Page, name: string) =>
  expect(page).toHaveScreenshot(name);

/** Answers the save of the sheet (the server action) with `answer`. */
async function answerSave(page: Page, answer: object | "abort") {
  await page.route("**/onboarding/persone", (route) => {
    if (!isAction(route)) return route.continue();
    return answer === "abort"
      ? route.abort()
      : route.fulfill(actionAnswer(answer));
  });
}

async function addSofia(page: Page) {
  const dialog = await openAddSheet(page);
  await dialog.getByLabel("Nome").fill("Sofia");
  await dialog.getByRole("button", { name: "Aggiungi Sofia" }).click();
  return dialog;
}

test.describe("onboarding · chi c'è nel Nest", () => {
  test("lista con membri", async ({ page, baseURL }) => {
    await withNest("family_with_children", FAMILY, page, baseURL, async () => {
      await settle(page);
      await expect(page).toHaveScreenshot("lista-con-membri.png", {
        fullPage: true,
      });
    });
  });

  test("lista vuota (solo tu)", async ({ page, baseURL }) => {
    await withNest("couple", [], page, baseURL, async () => {
      await settle(page);
      await expect(page).toHaveScreenshot("lista-vuota.png", {
        fullPage: true,
      });
    });
  });

  test("tre passi (Solo io)", async ({ page, baseURL }) => {
    await withNest("single", [], page, baseURL, async () => {
      await expect(
        page
          .getByRole("progressbar", { name: "Passo 2 di 3" })
          .filter({ visible: true }),
      ).toBeVisible();
      await settle(page);
      await expect(page).toHaveScreenshot("tre-passi.png", { fullPage: true });
    });
  });

  test("quattro passi", async ({ page, baseURL }) => {
    await withNest("roommates", FAMILY.slice(0, 1), page, baseURL, async () => {
      await expect(
        page
          .getByRole("progressbar", { name: "Passo 2 di 4" })
          .filter({ visible: true }),
      ).toBeVisible();
      await settle(page);
      await expect(page).toHaveScreenshot("quattro-passi.png", {
        fullPage: true,
      });
    });
  });

  test("Nest al completo (10 membri)", async ({ page, baseURL }) => {
    await withNest(
      "family_with_children",
      [...FAMILY, ...MORE],
      page,
      baseURL,
      async () => {
        await expect(
          page.getByText("Il Nest è al completo").filter({ visible: true }),
        ).toBeVisible();
        await settle(page);
        await expect(page).toHaveScreenshot("nest-al-completo.png", {
          fullPage: true,
        });
      },
    );
  });

  test.describe("caricamento", () => {
    // The shell of the page (with the skeleton) comes first and the list
    // streams in after it. Without scripts the list never replaces the
    // skeleton, so the skeleton stays on screen to be photographed.
    test.use({ javaScriptEnabled: false });

    test("scheletro", async ({ page, baseURL }) => {
      const user = await userWithNest("family_with_children", FAMILY);
      try {
        await user.signInContext(page.context(), baseURL as string);
        await page.goto("/onboarding/persone");
        await expect(
          page.getByText("Caricamento in corso").first(),
        ).toBeAttached();
        // No scripts, so no page.evaluate: just take the pointer away.
        await page.mouse.move(0, 0);
        await expect(page).toHaveScreenshot("caricamento.png", {
          fullPage: true,
        });
      } finally {
        await user.remove();
      }
    });
  });

  test.describe("foglio", () => {
    test("aggiunta, vuoto", async ({ page, baseURL }) => {
      await withNest(
        "family_with_children",
        FAMILY,
        page,
        baseURL,
        async () => {
          const dialog = await openAddSheet(page);
          await expect(dialog.getByLabel("Nome")).toBeFocused();
          await settle(page);
          await sheetShot(page, "foglio-aggiunta-vuoto.png");
        },
      );
    });

    test("aggiunta, compilato (Sofia)", async ({ page, baseURL }) => {
      await withNest("couple", [FAMILY[0]!], page, baseURL, async () => {
        const dialog = await openAddSheet(page);
        await dialog.getByLabel("Nome").fill("Sofia");
        await dialog.getByRole("button", { name: "Figlio o figlia" }).click();
        await dialog.getByLabel("Data di nascita").fill("2017-05-12");
        await dialog.getByRole("radio", { name: /^Salvia/ }).click();
        await expect(
          dialog.getByRole("button", { name: "Aggiungi Sofia" }),
        ).toBeVisible();
        await settle(page);
        await sheetShot(page, "foglio-aggiunta-compilato.png");
      });
    });

    test("modifica di una persona (Sofia)", async ({ page, baseURL }) => {
      await withNest(
        "family_with_children",
        FAMILY,
        page,
        baseURL,
        async () => {
          await openEditSheet(page, "Sofia");
          await settle(page);
          await sheetShot(page, "foglio-modifica.png");
        },
      );
    });

    test("modifica di te (Adulto bloccato)", async ({ page, baseURL }) => {
      await withNest(
        "family_with_children",
        FAMILY,
        page,
        baseURL,
        async () => {
          await openEditSheet(page, "Marco");
          await expect(
            page.getByText(
              "Chi usa FamilyNest con il suo account è sempre un adulto.",
            ),
          ).toBeVisible();
          await settle(page);
          await sheetShot(page, "foglio-modifica-tu.png");
        },
      );
    });
  });

  test.describe("errori del foglio", () => {
    test("nome vuoto", async ({ page, baseURL }) => {
      await withNest(
        "family_with_children",
        [FAMILY[0]!],
        page,
        baseURL,
        async () => {
          const dialog = await openAddSheet(page);
          await dialog
            .getByRole("button", { name: "Aggiungi", exact: true })
            .click();
          await expect(
            dialog.getByText("Scrivi il nome per continuare."),
          ).toBeVisible();
          await expect(dialog.getByLabel("Nome")).toBeFocused();
          await settle(page);
          await sheetShot(page, "errore-nome-vuoto.png");
        },
      );
    });

    test("data nel futuro", async ({ page, baseURL }) => {
      await withNest(
        "family_with_children",
        FAMILY.slice(0, 1),
        page,
        baseURL,
        async () => {
          const dialog = await openAddSheet(page);
          await dialog.getByLabel("Nome").fill("Sofia");
          await dialog.getByLabel("Data di nascita").fill("2030-01-01");
          await dialog.getByRole("button", { name: "Aggiungi Sofia" }).click();
          await expect(
            dialog.getByText(
              "Questa data è nel futuro: scegli un giorno fino a oggi.",
            ),
          ).toBeVisible();
          await settle(page);
          await sheetShot(page, "errore-data-futuro.png");
        },
      );
    });

    test("colore preso nel frattempo", async ({ page, baseURL }) => {
      await withNest("couple", [FAMILY[0]!], page, baseURL, async () => {
        await answerSave(page, { ok: false, reason: "color-taken" });
        const dialog = await addSofia(page);
        await expect(
          dialog.getByText(
            "Questo colore l'ha appena preso qualcun altro: scegline un altro.",
          ),
        ).toBeVisible();
        await settle(page);
        await sheetShot(page, "errore-colore-preso.png");
      });
    });

    test("salvataggio non riuscito, rete", async ({ page, baseURL }) => {
      await withNest("couple", [FAMILY[0]!], page, baseURL, async () => {
        await answerSave(page, "abort");
        const dialog = await addSofia(page);
        await expect(
          dialog.getByText(
            "Non siamo riusciti a salvare. Controlla la connessione e riprova.",
          ),
        ).toBeVisible();
        await settle(page);
        await sheetShot(page, "errore-salvataggio-rete.png");
      });
    });

    test("salvataggio non riuscito, server", async ({ page, baseURL }) => {
      await withNest("couple", [FAMILY[0]!], page, baseURL, async () => {
        await answerSave(page, { ok: false, reason: "server" });
        const dialog = await addSofia(page);
        await expect(
          dialog.getByText(
            "Non siamo riusciti a salvare per un problema nostro. Riprova tra qualche minuto.",
          ),
        ).toBeVisible();
        await settle(page);
        await sheetShot(page, "errore-salvataggio-server.png");
      });
    });

    test("Nest al completo al salvataggio", async ({ page, baseURL }) => {
      await withNest("couple", [FAMILY[0]!], page, baseURL, async () => {
        await answerSave(page, { ok: false, reason: "full" });
        const dialog = await addSofia(page);
        await expect(
          dialog.getByText(
            "Il Nest è al completo: ci stanno al massimo 10 tra persone e animali.",
          ),
        ).toBeVisible();
        await settle(page);
        await sheetShot(page, "errore-nest-completo.png");
      });
    });
  });
});
