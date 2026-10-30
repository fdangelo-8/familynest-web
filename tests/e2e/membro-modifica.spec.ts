import { expect, test, type Locator, type Page } from "@playwright/test";
import { signInAs, skipReason, usersConfigured } from "../fixtures/auth";
import {
  IDS,
  NOT_FOUND,
  adminClient,
  cutServerActions,
  h1,
  isServerAction,
  memberById,
  memberPath,
  openMember,
  pageText,
  removeButton,
  roleSwitch,
  sendAgain,
  subtitle,
  toast,
  withMemberNest,
  withRita,
  yearsAgo,
} from "../fixtures/membro";
import {
  throwawayConfigured,
  throwawaySkipReason,
} from "../fixtures/throwaway-user";

// "Un membro del Nest": riga «Modifica nome e colore» (#144, PR #146).
// Criteria CA-1 ... CA-6 are those of the issue (section 8); the other tests
// cover the rest of the specification (sections 1 to 5) and the decision of
// the coordinator on the birth date (#144, #18: the date of a pet reaches the
// browser only for an administrator, the dates of children never).
// Every test writes into its own throwaway Nest (user U, and U2 for Rita),
// deleted at the end; nothing here depends on another test.

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
});

const EDIT = "Modifica nome e colore";
const SAVED = "Modifiche salvate.";
const UNDO_FAILED =
  "Non siamo riusciti ad annullare. Le modifiche sono rimaste.";
const SAVE_FAILED =
  "Non siamo riusciti a salvare. Controlla la connessione e riprova.";
const COLOR_TAKEN =
  "Questo colore l'ha appena preso qualcun altro: scegline un altro.";

const isMobile = () => test.info().project.name === "mobile";

function needsThrowaway() {
  test.skip(!throwawayConfigured(), throwawaySkipReason);
}

const editRow = (page: Page) =>
  page.getByRole("button", { name: EDIT, exact: true });
const sheet = (page: Page, name: string) =>
  page.getByRole("dialog", { name: `Modifica ${name}`, exact: true });
const nameField = (dialog: Locator) =>
  dialog.getByRole("textbox", { name: "Nome", exact: true });
const saveButton = (dialog: Locator) =>
  dialog.getByRole("button", { name: "Salva le modifiche", exact: true });
const colorRadio = (dialog: Locator, label: string) =>
  dialog.getByRole("radio", { name: label, exact: true });
/** Any visible toast with text (the Next route announcer is empty). */
const anyToast = (page: Page) =>
  page.getByTestId("toast").filter({ hasText: /\S/ });

/** Opens the edit sheet of the member whose page is open. */
async function openSheet(page: Page, name: string) {
  await editRow(page).click();
  const dialog = sheet(page, name);
  await expect(dialog).toBeVisible();
  return dialog;
}

/** Counts the server actions (POST with `next-action`) sent by the page. */
function countServerActions(page: Page) {
  const state = { count: 0 };
  page.on("request", (request) => {
    if (request.method() === "POST" && request.headers()["next-action"]) {
      state.count += 1;
    }
  });
  return state;
}

/** Server-rendered HTML of a page, as the browser receives it. */
async function htmlOf(page: Page, path: string) {
  const response = await page.request.get(path);
  return response.text();
}

/** Date `iso` in the formats a page could print it in. */
function dateForms(iso: string): string[] {
  const [y, m, d] = iso.split("-").map(Number);
  const when = new Date(Date.UTC(y!, m! - 1, d!, 12));
  const zone = { timeZone: "Europe/Rome" } as const;
  return [
    iso,
    when.toLocaleDateString("it-IT", zone),
    when.toLocaleDateString("it-IT", {
      ...zone,
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    when.toLocaleDateString("it-IT", {
      ...zone,
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    when.toLocaleDateString("it-IT", {
      ...zone,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
  ];
}

// ------------------------------------------------- chi vede la riga, dove

test.describe("la riga: chi la vede e dove sta", () => {
  test("CA-1: l'amministratore vede la riga su Laura (adulta senza account), sopra «Ruolo»", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withMemberNest(async ({ user, addAdult, invite }) => {
      const laura = await addAdult("Laura", "glicine");
      await invite(laura);
      await user.signInContext(page.context(), baseURL as string);
      await openMember(page, laura, "Laura");

      const row = editRow(page);
      await expect(row).toBeVisible();
      await expect(row).toHaveAttribute("aria-haspopup", "dialog");

      const invitation = await sendAgain(page).boundingBox();
      const edit = await row.boundingBox();
      const role = await page
        .getByRole("heading", { name: "Ruolo", exact: true })
        .boundingBox();
      const remove = await removeButton(page, "Laura").boundingBox();
      // Order of the column: invitation, edit, role, remove.
      expect(invitation!.y).toBeLessThan(edit!.y);
      expect(edit!.y).toBeLessThan(role!.y);
      expect(role!.y).toBeLessThan(remove!.y);
      // Row 56 px high, as wide as the invitation row.
      expect(Math.round(edit!.height)).toBe(56);
      expect(Math.round(edit!.width)).toBe(Math.round(invitation!.width));
    });
  });

  test("CA-1: la riga c'è anche su Laura con invito scaduto e senza invito mandato", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withMemberNest(async ({ user, addAdult, invite }) => {
      const expired = await addAdult("Scaduta", "glicine");
      await invite(expired, "expired");
      const never = await addAdult("Mai", "salvia");
      await user.signInContext(page.context(), baseURL as string);

      await openMember(page, expired, "Scaduta");
      await expect(subtitle(page)).toContainText("invito scaduto");
      await expect(editRow(page)).toBeVisible();

      await openMember(page, never, "Mai");
      await expect(subtitle(page)).toContainText("da invitare");
      await expect(editRow(page)).toBeVisible();
    });
  });

  test("CA-1: l'amministratore vede la riga su Biscotto (animale), subito sotto la testa", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withMemberNest(async ({ user, addPet }) => {
      const biscotto = await addPet("Biscotto", "lampone", yearsAgo(3));
      await user.signInContext(page.context(), baseURL as string);
      await openMember(page, biscotto, "Biscotto");

      const row = editRow(page);
      await expect(row).toBeVisible();
      await expect(row).toHaveAttribute("aria-haspopup", "dialog");
      const head = await subtitle(page).boundingBox();
      const edit = await row.boundingBox();
      const remove = await removeButton(page, "Biscotto").boundingBox();
      expect(head!.y).toBeLessThan(edit!.y);
      expect(edit!.y).toBeLessThan(remove!.y);
      // No role section for a pet.
      await expect(roleSwitch(page)).toHaveCount(0);
    });
  });

  test("CA-2: l'amministratore non vede la riga sull'adulto con account", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withRita(async ({ user, ritaId }) => {
      await user.signInContext(page.context(), baseURL as string);
      await openMember(page, ritaId, "Rita");
      await expect(removeButton(page, "Rita")).toBeVisible();
      await expect(editRow(page)).toHaveCount(0);
    });
  });

  test("CA-2: chi non è amministratore non vede la riga su nessuna pagina", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withRita(async ({ u2, addAdult, addPet, adminMemberId }) => {
      const laura = await addAdult("Laura", "salvia");
      const fido = await addPet("Fido", "cobalto", yearsAgo(2));
      await u2.signInContext(page.context(), baseURL as string);

      await openMember(page, laura, "Laura");
      await expect(editRow(page)).toHaveCount(0);
      await expect(removeButton(page, "Laura")).toHaveCount(0);
      await openMember(page, fido, "Fido");
      await expect(editRow(page)).toHaveCount(0);
      await openMember(page, adminMemberId, "Ilaria");
      await expect(editRow(page)).toHaveCount(0);
      // Without the row, nothing of the edit reaches the page.
      expect(await htmlOf(page, memberPath(fido))).not.toContain(EDIT);
    });
  });

  test("#144: ordine del fuoco con la tastiera, su Laura e su Biscotto", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withMemberNest(async ({ user, addAdult, addPet, invite }) => {
      const laura = await addAdult("Laura", "glicine");
      await invite(laura);
      const biscotto = await addPet("Biscotto", "lampone");
      await user.signInContext(page.context(), baseURL as string);

      // Laura has no account: the role switch is disabled and skipped.
      await openMember(page, laura, "Laura");
      await sendAgain(page).focus();
      await page.keyboard.press("Tab");
      await expect(editRow(page)).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(removeButton(page, "Laura")).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await expect(editRow(page)).toBeFocused();

      await openMember(page, biscotto, "Biscotto");
      await editRow(page).focus();
      await page.keyboard.press("Tab");
      await expect(removeButton(page, "Biscotto")).toBeFocused();
    });
  });
});

// --------------------------------------------------- il foglio in modifica

test.describe("il foglio in modifica", () => {
  test("CA-3: si apre «Modifica Laura» con nome e colore di Laura, e i colori degli altri spenti", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withMemberNest(async ({ user, addAdult, invite }) => {
      const laura = await addAdult("Laura", "glicine");
      await invite(laura);
      await addAdult("Marta", "salvia");
      await user.signInContext(page.context(), baseURL as string);
      await openMember(page, laura, "Laura");

      const dialog = await openSheet(page, "Laura");
      await expect(nameField(dialog)).toHaveValue("Laura");
      await expect(saveButton(dialog)).toBeVisible();
      // Laura's own colour is chosen and available.
      const own = colorRadio(dialog, "Glicine");
      await expect(own).toBeChecked();
      await expect(own).toBeEnabled();
      // The colours of the others are off, with the name of whoever has them.
      const ilaria = colorRadio(dialog, "Pomodoro (già di Ilaria)");
      await expect(ilaria).toBeDisabled();
      await expect(ilaria).not.toBeChecked();
      await expect(colorRadio(dialog, "Salvia (già di Marta)")).toBeDisabled();
      // A free colour can be chosen.
      await expect(colorRadio(dialog, "Cobalto")).toBeEnabled();
      // «Chi è»: only the current voice is active; an adult has no birth date.
      const kind = dialog.getByRole("group", { name: "Chi è" });
      await expect(kind.getByRole("button", { name: "Adulto" })).toBeEnabled();
      await expect(
        kind.getByRole("button", { name: "Animale" }),
      ).toBeDisabled();
      await expect(dialog.getByLabel("Data di nascita")).toHaveCount(0);
      // Cancel on the left only on desktop.
      const cancel = dialog.getByRole("button", {
        name: "Annulla",
        exact: true,
      });
      if (isMobile()) await expect(cancel).toHaveCount(0);
      else await expect(cancel).toBeVisible();
    });
  });

  test("#144: il foglio di un animale mostra «Data di nascita» compilata e solo «Animale» attivo", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withMemberNest(async ({ user, addPet }) => {
      const birthDate = yearsAgo(3);
      const biscotto = await addPet("Biscotto", "lampone", birthDate);
      await user.signInContext(page.context(), baseURL as string);
      await openMember(page, biscotto, "Biscotto");

      const dialog = await openSheet(page, "Biscotto");
      await expect(dialog.getByLabel("Data di nascita")).toHaveValue(birthDate);
      const kind = dialog.getByRole("group", { name: "Chi è" });
      await expect(kind.getByRole("button", { name: "Animale" })).toBeEnabled();
      await expect(kind.getByRole("button", { name: "Adulto" })).toBeDisabled();
      await expect(
        colorRadio(dialog, "Pomodoro (già di Ilaria)"),
      ).toBeDisabled();
      await expect(colorRadio(dialog, "Lampone")).toBeChecked();
    });
  });

  test("#144: il fuoco parte dal campo «Nome» e torna sulla riga alla chiusura (Esc e Annulla)", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withMemberNest(async ({ user, addAdult }) => {
      const laura = await addAdult("Laura", "glicine");
      await user.signInContext(page.context(), baseURL as string);
      await openMember(page, laura, "Laura");

      let dialog = await openSheet(page, "Laura");
      await expect(nameField(dialog)).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(editRow(page)).toBeFocused();

      dialog = await openSheet(page, "Laura");
      await expect(nameField(dialog)).toBeFocused();
      if (isMobile()) {
        await page.keyboard.press("Escape");
      } else {
        await dialog
          .getByRole("button", { name: "Annulla", exact: true })
          .click();
      }
      await expect(dialog).toBeHidden();
      await expect(editRow(page)).toBeFocused();
      // Closing never writes anything.
      expect((await memberById(laura))!.name).toBe("Laura");
      await expect(anyToast(page)).toHaveCount(0);
    });
  });

  test("#144: senza nome il foglio non scrive e dice «Scrivi il nome per continuare.»", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withMemberNest(async ({ user, addAdult }) => {
      const laura = await addAdult("Laura", "glicine");
      await user.signInContext(page.context(), baseURL as string);
      await openMember(page, laura, "Laura");
      const actions = countServerActions(page);

      const dialog = await openSheet(page, "Laura");
      await nameField(dialog).fill("   ");
      await saveButton(dialog).click();
      await expect(
        dialog.getByText("Scrivi il nome per continuare."),
      ).toBeVisible();
      await expect(nameField(dialog)).toBeFocused();
      expect(actions.count).toBe(0);
      expect((await memberById(laura))!.name).toBe("Laura");
    });
  });
});

// ------------------------------------------------------------- salvataggio

test.describe("salvataggio con modifiche", () => {
  test("CA-4: Laura diventa «Lara»: dialogo chiuso, h1, «Togli Lara dal Nest» e toast con «Annulla»", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withMemberNest(async ({ user, addAdult, invite }) => {
      const laura = await addAdult("Laura", "glicine");
      await invite(laura);
      await user.signInContext(page.context(), baseURL as string);
      await openMember(page, laura, "Laura");

      const dialog = await openSheet(page, "Laura");
      await nameField(dialog).fill("Lara");
      await saveButton(dialog).click();

      await expect(dialog).toBeHidden();
      await expect(h1(page)).toHaveText("Lara");
      await expect(removeButton(page, "Lara")).toBeVisible();
      await expect(removeButton(page, "Laura")).toHaveCount(0);
      const saved = toast(page, SAVED);
      await expect(saved).toBeVisible();
      await expect(saved.locator("svg")).toHaveCount(1);
      await expect(
        saved.getByRole("button", { name: "Annulla", exact: true }),
      ).toBeVisible();

      // The new name is in every text of the page.
      await expect(
        page.getByText("Entrando, Lara vedrà", { exact: false }),
      ).toBeVisible();
      await removeButton(page, "Lara").click();
      await expect(
        page.getByRole("alertdialog", { name: "Togliere Lara dal Nest?" }),
      ).toBeVisible();
      await page.keyboard.press("Escape");

      const row = await memberById(laura);
      expect(row!.name).toBe("Lara");
      expect(row!.color).toBe("glicine");
      // Saved for good: still «Lara» after a reload.
      await page.reload();
      await expect(h1(page)).toHaveText("Lara");
    });
  });

  test("#144: cambiando il colore l'avatar e il database prendono il colore nuovo", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withMemberNest(async ({ user, addAdult }) => {
      const laura = await addAdult("Laura", "glicine");
      await user.signInContext(page.context(), baseURL as string);
      await openMember(page, laura, "Laura");
      const avatar = page.locator(".profilo-testa .avatar");
      await expect(avatar).toHaveClass(/membro-glicine/);

      const dialog = await openSheet(page, "Laura");
      await colorRadio(dialog, "Cobalto").click();
      await expect(colorRadio(dialog, "Cobalto")).toBeChecked();
      await saveButton(dialog).click();

      await expect(dialog).toBeHidden();
      await expect(avatar).toHaveClass(/membro-cobalto/);
      await expect(avatar).not.toHaveClass(/membro-glicine/);
      await expect(h1(page)).toHaveText("Laura");
      await expect(toast(page, SAVED)).toBeVisible();
      const row = await memberById(laura);
      expect(row!.color).toBe("cobalto");
      expect(row!.name).toBe("Laura");
    });
  });

  test("#144: per un animale nome, colore ed età si aggiornano insieme", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withMemberNest(async ({ user, addPet }) => {
      const biscotto = await addPet("Biscotto", "lampone", yearsAgo(3));
      await user.signInContext(page.context(), baseURL as string);
      await openMember(page, biscotto, "Biscotto");
      await expect(subtitle(page)).toHaveText("Animale · 3 anni");

      const dialog = await openSheet(page, "Biscotto");
      await nameField(dialog).fill("Briciola");
      await colorRadio(dialog, "Ceruleo").click();
      await dialog.getByLabel("Data di nascita").fill(yearsAgo(5));
      await saveButton(dialog).click();

      await expect(dialog).toBeHidden();
      await expect(h1(page)).toHaveText("Briciola");
      await expect(subtitle(page)).toHaveText("Animale · 5 anni");
      await expect(page.locator(".profilo-testa .avatar")).toHaveClass(
        /membro-ceruleo/,
      );
      await expect(removeButton(page, "Briciola")).toBeVisible();
      await expect(toast(page, SAVED)).toBeVisible();
      const row = await memberById(biscotto);
      expect(row!.name).toBe("Briciola");
      expect(row!.color).toBe("ceruleo");
      expect(row!.birth_date).toBe(yearsAgo(5));
      expect(row!.kind).toBe("pet");
    });
  });

  test("#144: un animale senza data di nascita resta «Animale» dopo il salvataggio", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withMemberNest(async ({ user, addPet }) => {
      const biscotto = await addPet("Biscotto", "lampone");
      await user.signInContext(page.context(), baseURL as string);
      await openMember(page, biscotto, "Biscotto");
      await expect(subtitle(page)).toHaveText("Animale");

      const dialog = await openSheet(page, "Biscotto");
      await expect(dialog.getByLabel("Data di nascita")).toHaveValue("");
      await nameField(dialog).fill("Briciola");
      await saveButton(dialog).click();

      await expect(dialog).toBeHidden();
      await expect(h1(page)).toHaveText("Briciola");
      await expect(subtitle(page)).toHaveText("Animale");
      expect((await memberById(biscotto))!.birth_date).toBeNull();
    });
  });

  test("#144: durante il salvataggio il foglio resta bloccato e si salva una volta sola", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withMemberNest(async ({ user, addAdult }) => {
      const laura = await addAdult("Laura", "glicine");
      await user.signInContext(page.context(), baseURL as string);
      await openMember(page, laura, "Laura");
      const actions = countServerActions(page);

      // The answer of the server is held until the test lets it go.
      let release: () => void = () => {};
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route("**/membri/**", async (route) => {
        if (isServerAction(route)) await held;
        await route.continue();
      });

      const dialog = await openSheet(page, "Laura");
      await nameField(dialog).fill("Lara");
      await saveButton(dialog).click();
      await expect(saveButton(dialog)).toHaveAttribute("aria-busy", "true");
      await expect(dialog).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(dialog).toBeVisible();

      release();
      await expect(dialog).toBeHidden();
      await expect(h1(page)).toHaveText("Lara");
      expect(actions.count).toBe(1);
    });
  });
});

test.describe("salvataggio senza modifiche", () => {
  test("CA-6: salvare senza cambiare niente chiude il foglio, senza toast e senza scrivere", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withMemberNest(async ({ user, addAdult, invite }) => {
      const laura = await addAdult("Laura", "glicine");
      await invite(laura);
      await user.signInContext(page.context(), baseURL as string);
      await openMember(page, laura, "Laura");
      const actions = countServerActions(page);

      const dialog = await openSheet(page, "Laura");
      await saveButton(dialog).click();
      await expect(dialog).toBeHidden();
      await expect(h1(page)).toHaveText("Laura");
      await expect(anyToast(page)).toHaveCount(0);
      await expect(editRow(page)).toBeFocused();
      expect(actions.count).toBe(0);
      const row = await memberById(laura);
      expect(row!.name).toBe("Laura");
      expect(row!.color).toBe("glicine");
    });
  });

  test("#144: un animale salvato senza cambiare niente non scrive e non mostra il toast", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withMemberNest(async ({ user, addPet }) => {
      const birthDate = yearsAgo(3);
      const biscotto = await addPet("Biscotto", "lampone", birthDate);
      await user.signInContext(page.context(), baseURL as string);
      await openMember(page, biscotto, "Biscotto");
      const actions = countServerActions(page);

      const dialog = await openSheet(page, "Biscotto");
      await saveButton(dialog).click();
      await expect(dialog).toBeHidden();
      await expect(anyToast(page)).toHaveCount(0);
      await expect(subtitle(page)).toHaveText("Animale · 3 anni");
      expect(actions.count).toBe(0);
      expect((await memberById(biscotto))!.birth_date).toBe(birthDate);
    });
  });
});

// ----------------------------------------------------------------- Annulla

test.describe("«Annulla» del toast", () => {
  test("CA-5: «Annulla» rimette «Laura» e non compare un secondo toast", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withMemberNest(async ({ user, addAdult }) => {
      const laura = await addAdult("Laura", "glicine");
      await user.signInContext(page.context(), baseURL as string);
      await openMember(page, laura, "Laura");

      const dialog = await openSheet(page, "Laura");
      await nameField(dialog).fill("Lara");
      await colorRadio(dialog, "Cobalto").click();
      await saveButton(dialog).click();
      await expect(h1(page)).toHaveText("Lara");
      await expect(toast(page, SAVED)).toBeVisible();

      await toast(page, SAVED)
        .getByRole("button", { name: "Annulla", exact: true })
        .click();

      await expect(h1(page)).toHaveText("Laura");
      await expect(removeButton(page, "Laura")).toBeVisible();
      await expect(page.locator(".profilo-testa .avatar")).toHaveClass(
        /membro-glicine/,
      );
      // The toast is gone and nothing replaces it.
      await expect(anyToast(page)).toHaveCount(0);
      await expect
        .poll(async () => (await memberById(laura))!.name)
        .toBe("Laura");
      expect((await memberById(laura))!.color).toBe("glicine");
    });
  });

  test("#144: «Annulla» rimette anche la data dell'animale, e il fuoco torna sulla riga", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withMemberNest(async ({ user, addPet }) => {
      const before = yearsAgo(3);
      const biscotto = await addPet("Biscotto", "lampone", before);
      await user.signInContext(page.context(), baseURL as string);
      await openMember(page, biscotto, "Biscotto");

      const dialog = await openSheet(page, "Biscotto");
      await nameField(dialog).fill("Briciola");
      await dialog.getByLabel("Data di nascita").fill(yearsAgo(6));
      await saveButton(dialog).click();
      await expect(subtitle(page)).toHaveText("Animale · 6 anni");

      // With the keyboard, so that the button of the toast has the focus.
      const undo = toast(page, SAVED).getByRole("button", {
        name: "Annulla",
        exact: true,
      });
      await undo.focus();
      await expect(undo).toBeFocused();
      await page.keyboard.press("Enter");

      await expect(h1(page)).toHaveText("Biscotto");
      await expect(subtitle(page)).toHaveText("Animale · 3 anni");
      await expect(editRow(page)).toBeFocused();
      await expect(anyToast(page)).toHaveCount(0);
      await expect
        .poll(async () => (await memberById(biscotto))!.birth_date)
        .toBe(before);
      const row = await memberById(biscotto);
      expect(row!.name).toBe("Biscotto");
      expect(row!.color).toBe("lampone");
    });
  });

  test("#144: se «Annulla» non riesce per la rete, toast senza icona e senza «Annulla», valori nuovi", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withMemberNest(async ({ user, addAdult }) => {
      const laura = await addAdult("Laura", "glicine");
      await user.signInContext(page.context(), baseURL as string);
      await openMember(page, laura, "Laura");

      const dialog = await openSheet(page, "Laura");
      await nameField(dialog).fill("Lara");
      await saveButton(dialog).click();
      await expect(h1(page)).toHaveText("Lara");
      await expect(toast(page, SAVED)).toBeVisible();

      await cutServerActions(page);
      await toast(page, SAVED)
        .getByRole("button", { name: "Annulla", exact: true })
        .click();

      const failed = toast(page, UNDO_FAILED);
      await expect(failed).toBeVisible();
      await expect(failed.locator("svg")).toHaveCount(0);
      await expect(failed.getByRole("button")).toHaveCount(0);
      await expect(toast(page, SAVED)).toHaveCount(0);
      await expect(h1(page)).toHaveText("Lara");
      expect((await memberById(laura))!.name).toBe("Lara");
    });
  });

  test("#144: se il colore di prima l'ha preso un altro, «Annulla» non riesce e restano i valori nuovi", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withMemberNest(async ({ user, addAdult }) => {
      const laura = await addAdult("Laura", "glicine");
      await user.signInContext(page.context(), baseURL as string);
      await openMember(page, laura, "Laura");

      const dialog = await openSheet(page, "Laura");
      await colorRadio(dialog, "Cobalto").click();
      await saveButton(dialog).click();
      await expect(toast(page, SAVED)).toBeVisible();
      await expect(page.locator(".profilo-testa .avatar")).toHaveClass(
        /membro-cobalto/,
      );

      // Someone else takes Laura's old colour in the meantime.
      await addAdult("Marta", "glicine");

      await toast(page, SAVED)
        .getByRole("button", { name: "Annulla", exact: true })
        .click();
      const failed = toast(page, UNDO_FAILED);
      await expect(failed).toBeVisible();
      await expect(failed.locator("svg")).toHaveCount(0);
      await expect(failed.getByRole("button")).toHaveCount(0);
      await expect(page.locator(".profilo-testa .avatar")).toHaveClass(
        /membro-cobalto/,
      );
      expect((await memberById(laura))!.color).toBe("cobalto");
    });
  });
});

// ------------------------------------------------------------ errori nel foglio

test.describe("errori nel foglio", () => {
  test("#144: colore già preso nel frattempo: errore nel foglio, colore spento, nessun toast e nessuna scrittura", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withMemberNest(async ({ user, addAdult }) => {
      const laura = await addAdult("Laura", "glicine");
      await user.signInContext(page.context(), baseURL as string);
      await openMember(page, laura, "Laura");

      const dialog = await openSheet(page, "Laura");
      // Cobalto is free when the sheet opens...
      await expect(colorRadio(dialog, "Cobalto")).toBeEnabled();
      await colorRadio(dialog, "Cobalto").click();
      // ... and somebody takes it before the save.
      await addAdult("Marta", "cobalto");
      await saveButton(dialog).click();

      await expect(dialog.getByText(COLOR_TAKEN)).toBeVisible();
      await expect(dialog).toBeVisible();
      await expect(colorRadio(dialog, "Cobalto")).toBeDisabled();
      await expect(colorRadio(dialog, "Cobalto")).not.toBeChecked();
      await expect(anyToast(page)).toHaveCount(0);
      await expect(h1(page)).toHaveText("Laura");
      expect((await memberById(laura))!.color).toBe("glicine");

      // Choosing another colour and saving works.
      await colorRadio(dialog, "Salvia").click();
      await saveButton(dialog).click();
      await expect(dialog).toBeHidden();
      await expect(toast(page, SAVED)).toBeVisible();
      expect((await memberById(laura))!.color).toBe("salvia");
    });
  });

  test("#144: senza rete il foglio resta aperto con «Riprova», che poi salva", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withMemberNest(async ({ user, addAdult }) => {
      const laura = await addAdult("Laura", "glicine");
      await user.signInContext(page.context(), baseURL as string);
      await openMember(page, laura, "Laura");

      const dialog = await openSheet(page, "Laura");
      await nameField(dialog).fill("Lara");
      await cutServerActions(page);
      await saveButton(dialog).click();

      await expect(dialog.getByText(SAVE_FAILED)).toBeVisible();
      await expect(dialog).toBeVisible();
      await expect(anyToast(page)).toHaveCount(0);
      await expect(h1(page)).toHaveText("Laura");
      expect((await memberById(laura))!.name).toBe("Laura");

      await page.unrouteAll({ behavior: "ignoreErrors" });
      await dialog.getByRole("button", { name: "Riprova" }).click();
      await expect(dialog).toBeHidden();
      await expect(h1(page)).toHaveText("Lara");
      await expect(toast(page, SAVED)).toBeVisible();
      expect((await memberById(laura))!.name).toBe("Lara");
    });
  });
});

// -------------------------------------------------------- il membro non c'è più

test.describe("il membro tolto nel frattempo", () => {
  test("#144: se Laura è stata tolta mentre il foglio era aperto, al salvataggio si vede «Questa pagina non c’è»", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withMemberNest(async ({ user, addAdult, invite }) => {
      const laura = await addAdult("Laura", "glicine");
      await invite(laura);
      await user.signInContext(page.context(), baseURL as string);
      await openMember(page, laura, "Laura");

      const dialog = await openSheet(page, "Laura");
      await nameField(dialog).fill("Lara");
      // Somebody else takes Laura out of the Nest.
      const admin = adminClient();
      await admin.from("invitations").delete().eq("member_id", laura);
      const removed = await admin
        .from("household_members")
        .delete()
        .eq("id", laura);
      expect(removed.error).toBeNull();
      expect(await memberById(laura)).toBeNull();

      await saveButton(dialog).click();

      await expect(dialog).toBeHidden();
      await expect(h1(page)).toHaveText(NOT_FOUND);
      await expect(anyToast(page)).toHaveCount(0);
      // Nothing was written back for a member who is gone.
      expect(await memberById(laura)).toBeNull();
    });
  });

  test("#144: se Biscotto è stato tolto mentre il toast era aperto, «Annulla» porta a «Questa pagina non c’è»", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withMemberNest(async ({ user, addPet }) => {
      const biscotto = await addPet("Biscotto", "lampone", yearsAgo(3));
      await user.signInContext(page.context(), baseURL as string);
      await openMember(page, biscotto, "Biscotto");

      const dialog = await openSheet(page, "Biscotto");
      await nameField(dialog).fill("Briciola");
      await saveButton(dialog).click();
      await expect(toast(page, SAVED)).toBeVisible();

      const removed = await adminClient()
        .from("household_members")
        .delete()
        .eq("id", biscotto);
      expect(removed.error).toBeNull();

      await toast(page, SAVED)
        .getByRole("button", { name: "Annulla", exact: true })
        .click();
      await expect(h1(page)).toHaveText(NOT_FOUND);
      expect(await memberById(biscotto)).toBeNull();
    });
  });
});

// ------------------------------------------------------- privacy e isolamento

test.describe("privacy della data di nascita", () => {
  test("#144: chi non è amministratore non riceve la data dell'animale, né la riga, né i colori degli altri", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withRita(async ({ u2, addPet }) => {
      const birthDate = yearsAgo(3);
      const fido = await addPet("Fido", "lampone", birthDate);
      await u2.signInContext(page.context(), baseURL as string);
      await openMember(page, fido, "Fido");
      await expect(subtitle(page)).toHaveText("Animale · 3 anni");

      const html = await htmlOf(page, memberPath(fido));
      for (const form of dateForms(birthDate)) {
        expect(html, `HTML contiene ${form}`).not.toContain(form);
      }
      expect(html).not.toContain(EDIT);
      // The colours with the names of the others go to the administrator only.
      expect(html).not.toContain("già di Ilaria");
      const text = await pageText(page);
      for (const form of dateForms(birthDate)) {
        expect(text).not.toContain(form);
      }
    });
  });

  test("#144: le date di nascita dei figli non arrivano mai al browser, né all'amministratore né agli altri", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withRita(async ({ user, u2, householdId, addAdult, addPet }) => {
      const childDate = yearsAgo(9);
      const sofia = (
        await adminClient()
          .from("household_members")
          .insert({
            household_id: householdId,
            kind: "child",
            name: "Sofia",
            color: "peonia",
            birth_date: childDate,
          })
          .select("id")
          .single()
      ).data!.id as string;
      const laura = await addAdult("Laura", "salvia");
      const fido = await addPet("Fido", "lampone", yearsAgo(3));

      for (const who of [user, u2]) {
        await page.context().clearCookies();
        await who.signInContext(page.context(), baseURL as string);
        for (const id of [laura, fido]) {
          const html = await htmlOf(page, memberPath(id));
          for (const form of dateForms(childDate)) {
            expect(html, `HTML contiene ${form}`).not.toContain(form);
          }
        }
        // The page of a child is not this page: no date there either.
        const response = await page.request.get(memberPath(sofia));
        const body = await response.text();
        for (const form of dateForms(childDate)) {
          expect(body).not.toContain(form);
        }
      }

      // Administrator: the sheet shows the colour of the child, never its date.
      await page.context().clearCookies();
      await user.signInContext(page.context(), baseURL as string);
      await openMember(page, fido, "Fido");
      const dialog = await openSheet(page, "Fido");
      await expect(colorRadio(dialog, "Peonia (già di Sofia)")).toBeDisabled();
      for (const form of dateForms(childDate)) {
        expect(await pageText(page)).not.toContain(form);
      }
    });
  });

  test("#144: per l'amministratore la data dell'animale non compare nel testo visibile, solo nel campo del foglio", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withMemberNest(async ({ user, addPet }) => {
      const birthDate = yearsAgo(3);
      const fido = await addPet("Fido", "lampone", birthDate);
      await user.signInContext(page.context(), baseURL as string);
      await openMember(page, fido, "Fido");

      const visible = async () => {
        const text = await pageText(page);
        for (const form of dateForms(birthDate)) {
          expect(text, `testo visibile contiene ${form}`).not.toContain(form);
        }
      };
      // Page: the age text only.
      await expect(subtitle(page)).toHaveText("Animale · 3 anni");
      await visible();

      // Sheet: the date is in the field (value), not in the text.
      const dialog = await openSheet(page, "Fido");
      await expect(dialog.getByLabel("Data di nascita")).toHaveValue(birthDate);
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await visible();

      // After a save and after «Annulla» the date is still not in the text.
      const again = await openSheet(page, "Fido");
      await again.getByLabel("Data di nascita").fill(yearsAgo(4));
      await saveButton(again).click();
      await expect(subtitle(page)).toHaveText("Animale · 4 anni");
      await visible();
      for (const form of dateForms(yearsAgo(4))) {
        expect(await pageText(page)).not.toContain(form);
      }
    });
  });
});

test.describe("isolamento tra Nest", () => {
  test("#144: un amministratore non apre né modifica i membri di un altro Nest", async ({
    page,
    baseURL,
  }) => {
    test.skip(!usersConfigured("A"), skipReason("A"));
    needsThrowaway();
    await withMemberNest(async ({ user, addPet }) => {
      const fido = await addPet("Fido", "lampone", yearsAgo(3));
      await user.signInContext(page.context(), baseURL as string);

      // The members of Casa D'Angelo (seed): the same page as a wrong id.
      for (const id of [IDS.biscotto, IDS.laura]) {
        await page.goto(memberPath(id));
        await expect(h1(page)).toHaveText(NOT_FOUND);
        await expect(editRow(page)).toHaveCount(0);
      }
      const before = await memberById(IDS.biscotto);

      // The page of his own pet does not leak names of the other Nest.
      const html = await htmlOf(page, memberPath(fido));
      expect(html).not.toContain("Marco");
      expect(html).not.toContain("Biscotto");
      expect(html).not.toMatch(/Casa D(?:'|&#x27;|&#39;|\\u0027)Angelo/);

      // And nothing changed for the other Nest.
      expect(await memberById(IDS.biscotto)).toEqual(before);
    });
  });

  test("#144: il Nest di un altro non vede ciò che si modifica qui", async ({
    page,
    baseURL,
  }) => {
    test.skip(!usersConfigured("B"), skipReason("B"));
    needsThrowaway();
    await withMemberNest(async ({ user, addAdult }) => {
      const laura = await addAdult("Laura", "glicine");
      await user.signInContext(page.context(), baseURL as string);
      await openMember(page, laura, "Laura");
      const dialog = await openSheet(page, "Laura");
      await nameField(dialog).fill("Lara");
      await saveButton(dialog).click();
      await expect(h1(page)).toHaveText("Lara");

      // Giulia (Casa Bianchi) cannot reach the member.
      await page.context().clearCookies();
      await signInAs(page.context(), baseURL as string, "B");
      await page.goto(memberPath(laura));
      await expect(h1(page)).toHaveText(NOT_FOUND);
      await expect(page.getByText("Lara")).toHaveCount(0);
    });
  });
});
