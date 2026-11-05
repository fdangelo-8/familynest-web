import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  CORS,
  FULL_MIA,
  SAVE_RPC,
  anyToast,
  closeSheet,
  colorRadio,
  dataPartOfUrl,
  field,
  isEmptyRow,
  openChild,
  openSheet,
  pencil,
  readProfile,
  recordUrls,
  saveButton,
  section,
  sheetOf,
  sizesUpdatedLabel,
  subtitle,
  teacherGroup,
  toastOf,
  withFigli,
  writeProfile,
  type FigliCtx,
} from "../fixtures/figlio";
import {
  throwawayConfigured,
  throwawaySkipReason,
} from "../fixtures/throwaway-user";

// "Profilo di un figlio" (#31, PR #245): the edit sheet, CA-26, CA-29 ... CA-42
// and CA-48 ... CA-50. Every test writes into its own throwaway Nest (U = Ugo,
// U2 = Vera, Mia, Nico, Fido), deleted at the end. Criteria without «anche
// 1280» hold at 390 px: on desktop they are skipped. The clock is fixed at
// martedì 20 ottobre 2026, 15:52 (Europe/Rome). What is saved is read back with
// the administrative client, never from the page.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

test.beforeEach(() => {
  test.setTimeout(90_000);
});

const isMobile = () => test.info().project.name === "mobile";
const only390 = () =>
  test.skip(!isMobile(), "Criterio valido a 390 px (non dice «anche 1280»)");
const only1280 = () => test.skip(isMobile(), "Criterio valido solo a 1280 px");
const needsThrowaway = () =>
  test.skip(!throwawayConfigured(), throwawaySkipReason);

const SAVED = "Modifiche salvate";
const NETWORK_FAILED =
  "Non siamo riusciti a salvare. Controlla la connessione e riprova.";
const SERVER_FAILED =
  "Non siamo riusciti a salvare per un problema nostro. Riprova tra qualche minuto.";
const COLOR_TAKEN =
  "Questo colore l'ha appena preso qualcun altro: scegline un altro.";

/** The complete profile of Mia, opened as `who`. */
async function openMia(
  page: Page,
  baseURL: string | undefined,
  ctx: FigliCtx,
  who = "Ugo",
) {
  await openChild(page, baseURL, ctx, who, ctx.mia, "Mia");
}

const schoolGroup = (dialog: Locator) =>
  dialog.getByRole("group", { name: "Scuola", exact: true });
const teachersGroup = (dialog: Locator) =>
  dialog.getByRole("group", { name: "Maestre", exact: true });
const sizesGroup = (dialog: Locator) =>
  dialog.getByRole("group", { name: "Taglie", exact: true });
const addTeacher = (dialog: Locator) =>
  dialog.getByRole("button", { name: "Aggiungi una maestra", exact: true });
const removeTeacher = (dialog: Locator, index: number) =>
  teacherGroup(dialog, index).getByRole("button", {
    name: "Togli questa maestra",
    exact: true,
  });

/** Counts the calls of the save function the browser sends. */
function countSaves(page: Page) {
  const state = { count: 0 };
  page.on("request", (request) => {
    if (request.method() === "POST" && SAVE_RPC.test(request.url())) {
      state.count += 1;
    }
  });
  return state;
}

// ------------------------------------------------------------------ apertura

test.describe("apertura del modulo", () => {
  for (const viewport of ["390", "1280"] as const) {
    test(`CA-26: «Aggiungi la scuola» ha il fuoco su «Nome della scuola», «Aggiungi le taglie» su «Scarpe» (${viewport} px)`, async ({
      page,
      baseURL,
    }) => {
      test.skip(isMobile() !== (viewport === "390"), `Caso a ${viewport} px`);
      needsThrowaway();
      await withFigli(async (ctx) => {
        await openChild(page, baseURL, ctx, "Ugo", ctx.nico, "Nico");

        await page
          .getByRole("button", { name: "Aggiungi la scuola", exact: true })
          .click();
        const dialog = sheetOf(page, "Nico");
        await expect(dialog).toBeVisible();
        await expect(field(dialog, "Nome della scuola")).toBeFocused();
        await closeSheet(page, dialog);

        await page
          .getByRole("button", { name: "Aggiungi le taglie", exact: true })
          .click();
        await expect(dialog).toBeVisible();
        await expect(field(dialog, "Scarpe")).toBeFocused();
      });
    });

    test(`CA-29: il modulo si apre con i dati salvati di Mia (${viewport} px)`, async ({
      page,
      baseURL,
    }) => {
      test.skip(isMobile() !== (viewport === "390"), `Caso a ${viewport} px`);
      needsThrowaway();
      await withFigli(async (ctx) => {
        await writeProfile(ctx, ctx.mia, FULL_MIA);
        await openMia(page, baseURL, ctx);
        const dialog = await openSheet(page, "Mia");

        await expect(field(dialog, "Nome")).toBeFocused();
        await expect(field(dialog, "Nome")).toHaveValue("Mia");
        const kind = dialog.getByRole("group", { name: "Chi è", exact: true });
        await expect(
          kind.getByRole("button", { name: "Figlio o figlia" }),
        ).toHaveAttribute("aria-pressed", "true");
        await expect(
          kind.getByRole("button", { name: "Adulto" }),
        ).toBeDisabled();
        await expect(
          kind.getByRole("button", { name: "Animale" }),
        ).toBeDisabled();
        await expect(field(dialog, "Data di nascita")).toHaveValue(
          "2016-12-14",
        );
        await expect(colorRadio(dialog, "Salvia")).toBeChecked();

        const school = schoolGroup(dialog);
        await expect(field(school, "Nome della scuola")).toHaveValue(
          "scuola Manzoni",
        );
        await expect(field(school, "Classe")).toHaveValue("4ª B");
        await expect(field(school, "Entra alle")).toHaveValue("08:15");
        await expect(field(school, "Esce alle")).toHaveValue("16:15");
        await expect(field(school, "Giorni")).toHaveValue("5");
        await expect(
          field(school, "Giorni").locator("option:checked"),
        ).toHaveText("Dal lunedì al venerdì");
        await expect(field(school, "Nota sull'orario")).toHaveValue(
          "mensa compresa",
        );

        const first = teacherGroup(dialog, 1);
        await expect(field(first, "Nome della maestra")).toHaveValue(
          "Maestra Bianchi",
        );
        await expect(field(first, "Materia")).toHaveValue("Italiano e storia");
        await expect(field(first, "Telefono")).toHaveValue("039 234 5678");
        const second = teacherGroup(dialog, 2);
        await expect(field(second, "Nome della maestra")).toHaveValue(
          "Maestro Rossi",
        );
        await expect(field(second, "Materia")).toHaveValue("");
        await expect(field(second, "Telefono")).toHaveValue("");
        await expect(teachersGroup(dialog).getByRole("group")).toHaveCount(2);
        await expect(addTeacher(dialog)).toBeVisible();

        const sizes = sizesGroup(dialog);
        await expect(field(sizes, "Scarpe")).toHaveValue("33");
        await expect(field(sizes, "Vestiti")).toHaveValue("9–10");
        await expect(field(sizes, "Pigiama")).toHaveValue("140");
      });
    });
  }
});

// ------------------------------------------------------------------ salvataggio

test.describe("salvataggio", () => {
  test("CA-30: classe, scarpe e una terza maestra: toast, fuoco, pagina e database", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    await withFigli(async (ctx) => {
      await writeProfile(ctx, ctx.mia, FULL_MIA);
      await openMia(page, baseURL, ctx);
      const dialog = await openSheet(page, "Mia");

      await field(schoolGroup(dialog), "Classe").fill("5ª B");
      await field(sizesGroup(dialog), "Scarpe").fill("34");
      await addTeacher(dialog).click();
      const third = teacherGroup(dialog, 3);
      await expect(field(third, "Nome della maestra")).toBeFocused();
      await field(third, "Nome della maestra").fill("Maestra Neri");
      await field(third, "Materia").fill("Inglese");
      await field(third, "Telefono").fill("+39 333 000 1111");
      await saveButton(dialog).click();

      await expect(dialog).toBeHidden();
      const toast = toastOf(page, SAVED);
      await expect(toast).toBeVisible();
      await expect(toast.getByRole("button")).toHaveCount(0);
      await expect(pencil(page, "Mia")).toBeFocused();

      await expect(subtitle(page)).toHaveText("9 anni · 5ª B, scuola Manzoni");
      const school = section(page, "Scuola");
      await expect(school.locator(".sezione__info")).toHaveText("5ª B");
      await expect(school.locator(".riga-lista__titolo")).toHaveText([
        "8:15 – 16:15",
        "Maestra Bianchi",
        "Maestro Rossi",
        "Maestra Neri",
      ]);
      await expect(school.locator('a[href="tel:+393330001111"]')).toContainText(
        "Maestra Neri",
      );
      await expect(section(page, "Taglie").locator(".chip")).toHaveText([
        "Scarpe 34",
        "Vestiti 9–10",
        "Pigiama 140",
      ]);

      const saved = await readProfile(ctx, ctx.mia);
      expect(saved.row?.school_class).toBe("5ª B");
      expect(saved.row?.shoe_size).toBe("34");
      expect(saved.row?.clothing_size).toBe("9–10");
      expect(saved.row?.school_name).toBe("scuola Manzoni");
      expect(
        saved.teachers.map((t) => [t.name, t.subject, t.phone, t.sort_order]),
      ).toEqual([
        ["Maestra Bianchi", "Italiano e storia", "039 234 5678", 1],
        ["Maestro Rossi", null, null, 2],
        ["Maestra Neri", "Inglese", "+39 333 000 1111", 3],
      ]);
      await expect(
        section(page, "Taglie").locator(".sezione__info"),
      ).toHaveText(sizesUpdatedLabel(saved.row!.sizes_updated_at!));
    });
  });

  test("CA-31: U2, non amministratrice, cambia la nota e salva", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    await withFigli(async (ctx) => {
      await writeProfile(ctx, ctx.mia, FULL_MIA);
      await openMia(page, baseURL, ctx, "Vera");
      const dialog = await openSheet(page, "Mia");

      await field(schoolGroup(dialog), "Nota sull'orario").fill(
        "mensa e doposcuola",
      );
      await saveButton(dialog).click();

      await expect(dialog).toBeHidden();
      await expect(toastOf(page, SAVED)).toBeVisible();
      await expect(
        section(page, "Scuola").locator(".riga-lista__info").first(),
      ).toHaveText("Dal lunedì al venerdì, mensa e doposcuola");
      expect((await readProfile(ctx, ctx.mia)).row?.school_note).toBe(
        "mensa e doposcuola",
      );
    });
  });

  test("CA-32: «Togli questa maestra» vale solo dopo «Salva le modifiche»", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    await withFigli(async (ctx) => {
      await writeProfile(ctx, ctx.mia, FULL_MIA);
      await openMia(page, baseURL, ctx);

      // Removed in the sheet, then «Chiudi»: nothing is lost, no toast.
      let dialog = await openSheet(page, "Mia");
      await removeTeacher(dialog, 2).click();
      await expect(teacherGroup(dialog, 2)).toHaveCount(0);
      await closeSheet(page, dialog);
      await expect(anyToast(page)).toHaveCount(0);
      dialog = await openSheet(page, "Mia");
      await expect(
        field(teacherGroup(dialog, 2), "Nome della maestra"),
      ).toHaveValue("Maestro Rossi");
      expect((await readProfile(ctx, ctx.mia)).teachers).toHaveLength(2);

      // Removed and saved.
      await removeTeacher(dialog, 2).click();
      await saveButton(dialog).click();
      await expect(dialog).toBeHidden();
      await expect(toastOf(page, SAVED)).toBeVisible();
      await expect(
        section(page, "Scuola").getByText("Maestro Rossi"),
      ).toHaveCount(0);
      const saved = await readProfile(ctx, ctx.mia);
      expect(saved.teachers.map((t) => t.name)).toEqual(["Maestra Bianchi"]);
    });
  });

  test("CA-33: svuotare tutto porta allo stato vuoto e il database non ha più scuola, maestre né taglie", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    await withFigli(async (ctx) => {
      await writeProfile(ctx, ctx.mia, FULL_MIA);
      await openMia(page, baseURL, ctx);
      const dialog = await openSheet(page, "Mia");

      const school = schoolGroup(dialog);
      for (const label of [
        "Nome della scuola",
        "Classe",
        "Entra alle",
        "Esce alle",
        "Nota sull'orario",
      ]) {
        await field(school, label).fill("");
      }
      await removeTeacher(dialog, 1).click();
      await removeTeacher(dialog, 1).click();
      for (const label of ["Scarpe", "Vestiti", "Pigiama"]) {
        await field(sizesGroup(dialog), label).fill("");
      }
      await saveButton(dialog).click();

      await expect(dialog).toBeHidden();
      await expect(page.getByText("Completa il profilo di Mia")).toBeVisible();
      await expect(
        page.getByRole("heading", { level: 2, name: "Scuola", exact: true }),
      ).toHaveCount(0);
      // The empty row may still exist: it is judged by its fields.
      const saved = await readProfile(ctx, ctx.mia);
      expect(isEmptyRow(saved.row)).toBe(true);
      expect(saved.teachers).toEqual([]);
    });
  });

  test("CA-50: «Giorni» offre due voci; «Dal lunedì al sabato» si salva come 1 ... 6", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    await withFigli(async (ctx) => {
      await writeProfile(ctx, ctx.mia, FULL_MIA);
      await openMia(page, baseURL, ctx);
      const dialog = await openSheet(page, "Mia");

      const days = field(schoolGroup(dialog), "Giorni");
      await expect(days.locator("option")).toHaveText([
        "Dal lunedì al venerdì",
        "Dal lunedì al sabato",
      ]);
      await days.selectOption({ label: "Dal lunedì al sabato" });
      await saveButton(dialog).click();

      await expect(dialog).toBeHidden();
      await expect(
        section(page, "Scuola").locator(".riga-lista__info").first(),
      ).toHaveText("Dal lunedì al sabato, mensa compresa");
      expect((await readProfile(ctx, ctx.mia)).row?.school_days).toEqual([
        1, 2, 3, 4, 5, 6,
      ]);
    });
  });
});

// ------------------------------------------------------ chiusura senza salvare

test.describe("chiusura senza salvare", () => {
  test("CA-34: «Chiudi», Esc e (a 1280 px) «Annulla» chiudono senza toast e senza cambiare niente", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withFigli(async (ctx) => {
      await writeProfile(ctx, ctx.mia, FULL_MIA);
      await openMia(page, baseURL, ctx);
      const saves = countSaves(page);
      const before = await readProfile(ctx, ctx.mia);

      const ways: ("Chiudi" | "Esc" | "Annulla")[] = isMobile()
        ? ["Chiudi", "Esc"]
        : ["Chiudi", "Esc", "Annulla"];
      for (const way of ways) {
        let dialog = await openSheet(page, "Mia");
        if (isMobile()) {
          await expect(
            dialog.getByRole("button", { name: "Annulla" }),
          ).toHaveCount(0);
        }
        await field(schoolGroup(dialog), "Classe").fill("5ª A");
        if (way === "Esc") {
          await page.keyboard.press("Escape");
        } else {
          await dialog.getByRole("button", { name: way, exact: true }).click();
        }
        await expect(dialog).toBeHidden();
        await expect(anyToast(page)).toHaveCount(0);
        await expect(subtitle(page)).toHaveText(
          "9 anni · 4ª B, scuola Manzoni",
        );
        expect(await readProfile(ctx, ctx.mia), way).toEqual(before);

        dialog = await openSheet(page, "Mia");
        await expect(field(schoolGroup(dialog), "Classe")).toHaveValue("4ª B");
        await closeSheet(page, dialog);
      }
      expect(saves.count).toBe(0);
    });
  });

  test("CA-48: «Salva le modifiche» senza cambiare niente chiude il modulo senza toast", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    await withFigli(async (ctx) => {
      await writeProfile(ctx, ctx.mia, FULL_MIA);
      await openMia(page, baseURL, ctx);
      const saves = countSaves(page);
      const dialog = await openSheet(page, "Mia");

      await saveButton(dialog).click();

      await expect(dialog).toBeHidden();
      await expect(pencil(page, "Mia")).toBeFocused();
      await expect(anyToast(page)).toHaveCount(0);
      expect(saves.count).toBe(0);
    });
  });

  test("CA-49: a 1280 px «Modifica il profilo» apre il modulo con il fuoco su «Nome» e «Annulla» riporta il fuoco sul bottone", async ({
    page,
    baseURL,
  }) => {
    only1280();
    needsThrowaway();
    await withFigli(async (ctx) => {
      await writeProfile(ctx, ctx.mia, FULL_MIA);
      await openMia(page, baseURL, ctx);

      const button = pencil(page, "Mia");
      await button.click();
      const dialog = sheetOf(page, "Mia");
      await expect(dialog).toBeVisible();
      await expect(field(dialog, "Nome")).toBeFocused();
      await dialog
        .getByRole("button", { name: "Annulla", exact: true })
        .click();
      await expect(dialog).toBeHidden();
      await expect(button).toBeFocused();
    });
  });
});

// --------------------------------------------------------------------- errori

test.describe("errori di compilazione", () => {
  test("CA-35: nome vuoto e data nel futuro: errore sotto il campo, il modulo resta aperto, il database non cambia", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    await withFigli(async (ctx) => {
      await writeProfile(ctx, ctx.mia, FULL_MIA);
      await openMia(page, baseURL, ctx);
      const before = await readProfile(ctx, ctx.mia);
      const dialog = await openSheet(page, "Mia");

      await field(dialog, "Nome").fill("");
      await saveButton(dialog).click();
      await expect(
        dialog.getByText("Scrivi il nome per continuare.", { exact: true }),
      ).toBeVisible();
      await expect(dialog).toBeVisible();
      await expect(field(dialog, "Nome")).toBeFocused();
      expect(await readProfile(ctx, ctx.mia)).toEqual(before);

      await field(dialog, "Nome").fill("Mia");
      // 21/10/2026 is the day after «today» (the clock is fixed at 20/10).
      await field(dialog, "Data di nascita").fill("2026-10-21");
      await saveButton(dialog).click();
      await expect(
        dialog.getByText(
          "Questa data è nel futuro: scegli un giorno fino a oggi.",
          { exact: true },
        ),
      ).toBeVisible();
      await expect(dialog).toBeVisible();
      expect(await readProfile(ctx, ctx.mia)).toEqual(before);
      await expect(anyToast(page)).toHaveCount(0);
    });
  });

  test("CA-36: gli errori di scuola, orario, telefono e nome della maestra", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    await withFigli(async (ctx) => {
      await writeProfile(ctx, ctx.mia, FULL_MIA);
      await openMia(page, baseURL, ctx);
      const before = await readProfile(ctx, ctx.mia);

      const cases: {
        change: (dialog: Locator) => Promise<void>;
        error: string;
      }[] = [
        {
          change: (d) => field(schoolGroup(d), "Esce alle").fill(""),
          error: "Scegli anche l'ora d'uscita.",
        },
        {
          change: (d) => field(schoolGroup(d), "Entra alle").fill(""),
          error: "Scegli anche l'ora d'entrata.",
        },
        {
          change: (d) => field(schoolGroup(d), "Esce alle").fill("08:00"),
          error: "L'uscita deve essere dopo l'entrata.",
        },
        {
          change: (d) => field(teacherGroup(d, 1), "Telefono").fill("abc"),
          error: "Scrivi solo numeri, spazi e il + all'inizio.",
        },
        {
          change: (d) => field(teacherGroup(d, 1), "Telefono").fill("12345"),
          error: "Scrivi solo numeri, spazi e il + all'inizio.",
        },
        {
          change: (d) =>
            field(teacherGroup(d, 1), "Nome della maestra").fill(""),
          error: "Scrivi il nome della maestra.",
        },
        {
          change: async (d) => {
            await field(schoolGroup(d), "Entra alle").fill("");
            await field(schoolGroup(d), "Esce alle").fill("");
          },
          error: "Per la nota serve anche l'orario.",
        },
      ];

      for (const { change, error } of cases) {
        const dialog = await openSheet(page, "Mia");
        await change(dialog);
        await saveButton(dialog).click();
        await expect(
          dialog.getByText(error, { exact: true }),
          error,
        ).toBeVisible();
        await expect(dialog).toBeVisible();
        expect(await readProfile(ctx, ctx.mia), error).toEqual(before);
        await closeSheet(page, dialog);
      }
      await expect(anyToast(page)).toHaveCount(0);
    });
  });

  test("CA-37: ogni campo tiene al massimo il suo limite", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    await withFigli(async (ctx) => {
      await writeProfile(ctx, ctx.mia, FULL_MIA);
      await openMia(page, baseURL, ctx);
      const dialog = await openSheet(page, "Mia");

      const school = schoolGroup(dialog);
      const first = teacherGroup(dialog, 1);
      const targets: [Locator, string, number][] = [
        [field(school, "Nome della scuola"), "a", 60],
        [field(school, "Nota sull'orario"), "a", 60],
        [field(school, "Classe"), "a", 20],
        [field(first, "Nome della maestra"), "a", 40],
        [field(first, "Materia"), "a", 40],
        [field(first, "Telefono"), "1", 20],
        [field(sizesGroup(dialog), "Scarpe"), "a", 10],
      ];
      for (const [target, character, limit] of targets) {
        await target.fill("");
        // Typed key by key, as a person does: the browser applies the limit.
        await target.pressSequentially(character.repeat(limit + 1));
        await expect(target).toHaveValue(character.repeat(limit));
      }
    });
  });

  test("CA-38: con 5 maestre non c'è «Aggiungi una maestra» ma «Puoi aggiungere fino a 5 maestre.»", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    await withFigli(async (ctx) => {
      await writeProfile(ctx, ctx.mia, {
        ...FULL_MIA,
        teachers: ["Uno", "Due", "Tre", "Quattro", "Cinque"].map((name) => ({
          name: `Maestra ${name}`,
        })),
      });
      await openMia(page, baseURL, ctx);
      const dialog = await openSheet(page, "Mia");

      const note = dialog.getByText("Puoi aggiungere fino a 5 maestre.", {
        exact: true,
      });
      await expect(teachersGroup(dialog).getByRole("group")).toHaveCount(5);
      await expect(addTeacher(dialog)).toHaveCount(0);
      await expect(note).toBeVisible();

      await removeTeacher(dialog, 5).click();
      await expect(addTeacher(dialog)).toBeVisible();
      await expect(note).toHaveCount(0);
    });
  });

  test("CA-39: rete interrotta o risposta 500: avviso nel modulo che resta aperto, database invariato", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    await withFigli(async (ctx) => {
      await writeProfile(ctx, ctx.mia, FULL_MIA);
      await openMia(page, baseURL, ctx);
      const before = await readProfile(ctx, ctx.mia);

      let mode: "abort" | "500" = "abort";
      await page.route(SAVE_RPC, async (route) => {
        if (route.request().method() === "OPTIONS") {
          await route.continue();
          return;
        }
        if (mode === "abort") {
          await route.abort("connectionfailed");
          return;
        }
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          headers: CORS,
          body: JSON.stringify({ code: "XX000", message: "boom internal" }),
        });
      });

      const dialog = await openSheet(page, "Mia");
      await field(schoolGroup(dialog), "Classe").fill("5ª B");
      await saveButton(dialog).click();
      await expect(
        dialog.getByRole("alert").filter({ hasText: NETWORK_FAILED }),
      ).toBeVisible();
      await expect(dialog).toBeVisible();
      await expect(field(schoolGroup(dialog), "Classe")).toHaveValue("5ª B");
      expect(await readProfile(ctx, ctx.mia)).toEqual(before);

      mode = "500";
      await saveButton(dialog).click();
      await expect(
        dialog.getByRole("alert").filter({ hasText: SERVER_FAILED }),
      ).toBeVisible();
      await expect(dialog).toBeVisible();
      await expect(field(schoolGroup(dialog), "Classe")).toHaveValue("5ª B");
      expect(await readProfile(ctx, ctx.mia)).toEqual(before);
      await expect(anyToast(page)).toHaveCount(0);
    });
  });

  test("CA-40: colore preso nel frattempo: errore sul colore e niente salvato", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    await withFigli(async (ctx) => {
      await writeProfile(ctx, ctx.mia, FULL_MIA);
      await openMia(page, baseURL, ctx);
      const before = await readProfile(ctx, ctx.mia);
      const dialog = await openSheet(page, "Mia");

      const { error } = await ctx.admin
        .from("household_members")
        .update({ color: "glicine" })
        .eq("id", ctx.fido);
      expect(error).toBeNull();

      await colorRadio(dialog, "Glicine").click();
      await field(schoolGroup(dialog), "Classe").fill("5ª B");
      await saveButton(dialog).click();

      await expect(
        dialog.getByText(COLOR_TAKEN, { exact: true }),
      ).toBeVisible();
      await expect(dialog).toBeVisible();
      const after = await readProfile(ctx, ctx.mia);
      expect(after.member.color).toBe("salvia");
      expect(after.row?.school_class).toBe("4ª B");
      expect(after).toEqual(before);
    });
  });

  test("CA-41: due tocchi veloci su «Salva le modifiche» salvano una volta sola", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    await withFigli(async (ctx) => {
      await writeProfile(ctx, ctx.mia, FULL_MIA);
      await openMia(page, baseURL, ctx);

      // The answer is held, so the second tap comes while the first is working.
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const saves = countSaves(page);
      await page.route(SAVE_RPC, async (route) => {
        if (route.request().method() === "OPTIONS") {
          await route.continue();
          return;
        }
        await gate;
        await route.continue();
      });

      const dialog = await openSheet(page, "Mia");
      await addTeacher(dialog).click();
      const third = teacherGroup(dialog, 3);
      await field(third, "Nome della maestra").fill("Maestra Neri");
      const save = saveButton(dialog);
      await save.click();
      await save.click({ force: true });
      release();

      await expect(dialog).toBeHidden();
      await expect(toastOf(page, SAVED)).toBeVisible();
      expect(saves.count).toBe(1);
      expect((await readProfile(ctx, ctx.mia)).teachers).toHaveLength(3);
    });
  });

  test("CA-42: negli indirizzi delle richieste non ci sono nome, scuola, maestre, classe né data di nascita", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    await withFigli(async (ctx) => {
      await writeProfile(ctx, ctx.mia, FULL_MIA);
      const urls = recordUrls(page);
      await openMia(page, baseURL, ctx);
      const dialog = await openSheet(page, "Mia");
      await field(schoolGroup(dialog), "Classe").fill("5ª B");
      await saveButton(dialog).click();
      await expect(dialog).toBeHidden();
      await expect(toastOf(page, SAVED)).toBeVisible();

      const addresses = urls
        .map((url) => dataPartOfUrl(url))
        .filter((part): part is string => part !== null);
      // The test is not empty: the page did talk to the database.
      expect(urls.some((url) => /\/rest\/v1\//.test(url))).toBe(true);
      for (const forbidden of [
        "Mia",
        "Manzoni",
        "Bianchi",
        "234",
        "4ª",
        "5ª",
        "2016-12-14",
      ]) {
        for (const address of addresses) {
          expect(address, forbidden).not.toContain(forbidden);
        }
      }
    });
  });
});
